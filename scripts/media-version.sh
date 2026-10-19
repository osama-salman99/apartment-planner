#!/usr/bin/env bash
#
# Version store for the home-app media bucket.
#
# WHY THIS EXISTS
# ---------------
# The 3D models, product images and the product catalogue do not live in this repo and are not
# shipped by the deployer — they sit in /opt/home-app/media on the VPS and Caddy serves them
# straight off disk. That is deliberate: a new IKEA model is 3 MB of binary that has nothing to do
# with the application's code, and putting it through a build and a release would be absurd.
#
# The cost of that split is that the bucket had no history. A model replaced by a worse export, a
# products.json rewritten by a script that got a rule wrong, an image deleted by accident — all of
# it was unrecoverable, and there was no way to answer "did this file change?". This tool gives the
# bucket the one property the repo was providing for everything else: you can see what changed and
# put it back.
#
# It is NOT a backup. Snapshots are pruned after two weeks by design (see `prune`), they live on the
# same disk as the bucket, and they exist to undo *our own* edits — not to survive losing the VPS.
#
# HOW A SNAPSHOT IS STORED, AND THE ONE WAY TO BREAK IT
# ----------------------------------------------------
# Each snapshot is a directory holding a MANIFEST (a checksum, a size and a path per file) and a
# `files/` tree. Files in that tree are stored one of two ways:
#
#   * real copy   — every *.json and anything small. These are the files that actually get
#                   rewritten, they are tiny, and a real copy is immune to the hazard below. This is
#                   why the product catalogue's history can be trusted unconditionally.
#   * hardlinked  — the big binaries (models, images). A hardlink costs a directory entry and no
#                   data, which is the only reason two weeks of snapshots of a 2.8 GB bucket is
#                   free instead of 40 GB.
#
# A hardlink shares its data with the live file, so WRITING THROUGH A LIVE FILE'S NAME ALSO REWRITES
# EVERY SNAPSHOT OF IT. `echo ... > models/x.glb` and `cp new.glb models/x.glb` both do this, and
# both destroy that file's history silently. This was not a theory — the first version of this tool
# was tested by replacing a model with a shell redirect, and the "old" copy in the snapshot came back
# holding the new bytes.
#
# So: change the bucket with `media-version put`, which writes a temp file and renames it over the
# target. A rename replaces the directory entry and leaves the old inode — and therefore every
# snapshot pointing at it — untouched. Anything that writes-then-renames (rsync, most download
# tools) is equally safe. `fsck` exists to catch the cases where someone did it the other way.
#
# Everything is checksummed, including the 2.8 GB of models: about 13 seconds of CPU per snapshot.
# That is deliberately not optimised away. The cheaper alternative — trusting size and modification
# time on the big files — cannot tell a same-size replacement inside the same second from no change
# at all, which is exactly what a script rewriting a model does, and it made the first version of
# this tool report "nothing changed" while a model had in fact been swapped.
set -uo pipefail

BUCKET=${MEDIA_BUCKET:-/opt/home-app/media}
STORE=${MEDIA_STORE:-/opt/home-app/media-versions}
# Two weeks, as asked. `prune` will not go below KEEP_MIN snapshots however old they are, so a
# bucket nobody has touched for a month still has something to roll back to.
KEEP_DAYS=${MEDIA_KEEP_DAYS:-14}
KEEP_MIN=${MEDIA_KEEP_MIN:-3}
# Files at or under this size are stored as real copies rather than hardlinks, as are all *.json.
COPY_MAX=${MEDIA_COPY_MAX:-65536}

die() { echo "media-version: $*" >&2; exit 1; }
now_stamp() { date -u +%Y-%m-%dT%H%M%SZ; }

[ -d "$BUCKET" ] || die "no bucket at $BUCKET"
mkdir -p "$STORE" || die "cannot create $STORE"

# True for paths stored as real copies: the catalogues, and anything small.
realcopy() {
  case "$1" in *.json|*.json.*) return 0 ;; esac
  local sz
  sz=$(stat -c %s "$2/$1" 2>/dev/null) || return 1
  [ "$sz" -le "$COPY_MAX" ]
}

# MANIFEST lines are: <sha256> <TAB> <size> <TAB> <relpath>, sorted by path so two manifests compare
# with plain diff. Modification time is deliberately absent: once every file is checksummed it adds
# nothing, and including it would make `touch` look like an edit.
#
# Both passes are BULK on purpose. The obvious loop — sha256sum and stat once per file — took two
# minutes on this bucket against thirteen seconds of actual hashing, because 5827 files meant 11654
# process spawns and the fork overhead dwarfed the work. Hourly, that difference is the gap between
# noticeable and invisible on a VPS this size.
write_manifest() {
  local out=$1 root=${2:-$BUCKET} sizes hashes
  sizes=$(mktemp); hashes=$(mktemp)
  (cd "$root" && find . -type f -printf '%s\t%P\n') | sort -t$'\t' -k2 >"$sizes"
  # sha256sum writes "<sha>  <path>"; the two spaces become the field separator. Bucket paths are
  # article numbers and known filenames, so no tabs or newlines to escape.
  (cd "$root" && find . -type f -printf '%P\0' | xargs -0 -r sha256sum 2>/dev/null) \
    | sed 's/^\([0-9a-f]\{64\}\)  /\1\t/' | sort -t$'\t' -k2 >"$hashes"
  join -t$'\t' -1 2 -2 2 -o 1.2,2.1,1.1 "$sizes" "$hashes" \
    | awk -F'\t' '{print $2"\t"$3"\t"$1}' | sort -t$'\t' -k3 >"$out"
  rm -f "$sizes" "$hashes"
}

# Newest by directory modification time, NOT by name. Sorting by name looks equivalent and is not:
# the label is part of the name, so two snapshots taken in the same second put "…-pre-restore" after
# "…-after-restore" and "latest" silently meant the wrong one.
latest_snapshot() {
  find "$STORE" -mindepth 1 -maxdepth 1 -type d -printf '%T@\t%f\n' 2>/dev/null \
    | sort -n | tail -1 | cut -f2
}

all_snapshots() {
  find "$STORE" -mindepth 1 -maxdepth 1 -type d -printf '%T@\t%f\n' 2>/dev/null \
    | sort -n | cut -f2
}

resolve_snapshot() {
  case "${1:-}" in
    latest|'') latest_snapshot ;;
    *) if [ -d "$STORE/$1" ]; then echo "$1"; else all_snapshots | grep -F -- "$1" | tail -1; fi ;;
  esac
}

cmd_snapshot() {
  local label='' if_changed=''
  while [ $# -gt 0 ]; do
    case $1 in
      -l|--label) label=${2:-}; shift 2 ;;
      --if-changed) if_changed=1; shift ;;
      *) die "snapshot: unknown option $1" ;;
    esac
  done

  local tmp_man; tmp_man=$(mktemp) || die "mktemp failed"
  write_manifest "$tmp_man"

  local prev; prev=$(latest_snapshot)
  if [ -n "$if_changed" ] && [ -n "$prev" ] && cmp -s "$tmp_man" "$STORE/$prev/MANIFEST"; then
    rm -f "$tmp_man"
    echo "unchanged since $prev — no snapshot taken"
    return 0
  fi

  local name; name=$(now_stamp)${label:+-$label}
  local n=1; while [ -e "$STORE/$name" ]; do name="$(now_stamp)${label:+-$label}.$n"; n=$((n+1)); done

  local dir="$STORE/$name"
  mkdir -p "$dir/files" || die "cannot create $dir"
  local rel dest copied=0 linked=0
  while IFS=$'\t' read -r _sha _sz rel; do
    dest="$dir/files/$rel"
    mkdir -p "$(dirname "$dest")"
    if realcopy "$rel" "$BUCKET"; then
      cp -p "$BUCKET/$rel" "$dest" 2>/dev/null && copied=$((copied+1))
    else
      # Hardlink where we can; fall back to a real copy across a device boundary.
      ln "$BUCKET/$rel" "$dest" 2>/dev/null && linked=$((linked+1)) \
        || { cp -p "$BUCKET/$rel" "$dest" 2>/dev/null && copied=$((copied+1)); }
    fi
  done <"$tmp_man"

  mv "$tmp_man" "$dir/MANIFEST"
  {
    echo "taken:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "label:   ${label:-none}"
    echo "by:      ${SUDO_USER:-${USER:-unknown}}@$(hostname)"
    echo "files:   $((copied+linked)) ($copied copied, $linked hardlinked)"
  } >"$dir/NOTE"
  echo "snapshot $name — $((copied+linked)) files ($copied copied, $linked hardlinked)"
  [ -n "$prev" ] && cmd_diff "$prev" "$name" | sed 's/^/  /'
  return 0
}

# Compare two snapshots, or a snapshot against the live bucket. Reports paths, not byte diffs — the
# point is to see at a glance what an edit touched.
cmd_diff() {
  local a b amf bmf tmp=''
  a=$(resolve_snapshot "${1:-}"); [ -n "$a" ] && [ -d "$STORE/$a" ] || die "no such snapshot: ${1:-}"
  amf="$STORE/$a/MANIFEST"
  b=${2:-live}
  if [ "$b" = live ]; then
    tmp=$(mktemp); write_manifest "$tmp"; bmf=$tmp
  else
    b=$(resolve_snapshot "$b"); [ -n "$b" ] && [ -d "$STORE/$b" ] || die "no such snapshot: $2"
    bmf="$STORE/$b/MANIFEST"
  fi

  local sa sb
  sa=$(mktemp); sb=$(mktemp)
  sort -t$'\t' -k3 "$amf" >"$sa"; sort -t$'\t' -k3 "$bmf" >"$sb"
  local added removed changed
  added=$(join -v2 -t$'\t' -1 3 -2 3 "$sa" "$sb" | wc -l)
  removed=$(join -v1 -t$'\t' -1 3 -2 3 "$sa" "$sb" | wc -l)
  changed=$(join -t$'\t' -1 3 -2 3 -o 0,1.1,2.1 "$sa" "$sb" | awk -F'\t' '$2!=$3' | wc -l)
  echo "$a -> $b: $added added, $removed removed, $changed changed"
  join -v2 -t$'\t' -1 3 -2 3 "$sa" "$sb" | cut -f1 | sed 's/^/  + /' | head -25
  join -v1 -t$'\t' -1 3 -2 3 "$sa" "$sb" | cut -f1 | sed 's/^/  - /' | head -25
  join -t$'\t' -1 3 -2 3 -o 0,1.1,2.1 "$sa" "$sb" | awk -F'\t' '$2!=$3 {print "  ~ "$1}' | head -25
  rm -f "$sa" "$sb"; [ -n "$tmp" ] && rm -f "$tmp"
  return 0
}

cmd_list() {
  local s n sz
  printf '%-38s %8s %9s  %s\n' SNAPSHOT FILES CONTENT LABEL
  for s in $(all_snapshots); do
    n=$(wc -l <"$STORE/$s/MANIFEST" 2>/dev/null || echo 0)
    sz=$(du -sh --apparent-size "$STORE/$s/files" 2>/dev/null | cut -f1)
    printf '%-38s %8s %9s  %s\n' "$s" "$n" "$sz" "$(sed -n 's/^label:  *//p' "$STORE/$s/NOTE" 2>/dev/null)"
  done
  echo
  # `du` on the store alone reports ~3 GB, which is wrong in the way that matters: almost every file
  # in it is a hardlink sharing its blocks with the live bucket, and du has no way to know that from
  # inside the store. Counting only the files with a single link gives the store's true extra cost.
  local extra
  extra=$(find "$STORE" -type f -links 1 -printf '%b\n' 2>/dev/null | awk '{s+=$1} END {printf "%.0f", s/2048}')
  echo "store: ${extra:-0} MB of real extra disk (the rest is hardlinked to the live bucket, which is $(du -sh "$BUCKET" 2>/dev/null | cut -f1))"
}

# Put a file into the bucket the safe way: snapshot first, then swap the directory entry rather than
# writing through it, so existing snapshots of that path keep their contents. See the header.
cmd_put() {
  local src=$1 rel=$2
  [ -f "$src" ] || die "put: no such file $src"
  case "$rel" in /*|*..*) die "put: destination must be a relative path inside the bucket" ;; esac
  cmd_snapshot --if-changed -l "pre-put" >/dev/null
  mkdir -p "$(dirname "$BUCKET/$rel")"
  local tmp="$BUCKET/$rel.mv-new.$$"
  cp "$src" "$tmp" || die "put: copy failed"
  chmod 644 "$tmp"
  mv -f "$tmp" "$BUCKET/$rel" || die "put: rename failed"
  echo "put $rel ($(stat -c %s "$BUCKET/$rel") bytes)"
}

cmd_restore() {
  # --exact is documented as trailing (restore SNAP [RELPATH...] [--exact]) as well as leading, so
  # scan every argument for it rather than stopping at the snapshot name — an earlier version stopped,
  # and silently took a trailing --exact for a file to restore.
  local exact='' snap='' files=()
  while [ $# -gt 0 ]; do
    case $1 in
      --exact) exact=1 ;;
      -*) die "restore: unknown option $1" ;;
      *) if [ -z "$snap" ]; then snap=$1; else files+=("$1"); fi ;;
    esac
    shift
  done
  snap=$(resolve_snapshot "$snap"); [ -n "$snap" ] && [ -d "$STORE/$snap" ] || die "restore: no such snapshot"

  # Always snapshot the state we are about to overwrite, or a wrong restore is as unrecoverable as
  # the accident it was fixing.
  cmd_snapshot -l "pre-restore" >/dev/null

  local rel n=0
  if [ ${#files[@]} -eq 0 ]; then
    while IFS=$'\t' read -r _s _z rel; do files+=("$rel"); done <"$STORE/$snap/MANIFEST"
  fi
  for rel in "${files[@]}"; do
    [ -f "$STORE/$snap/files/$rel" ] || { echo "  ! not in $snap: $rel"; continue; }
    mkdir -p "$(dirname "$BUCKET/$rel")"
    # Copy to a temp name and rename, for the same reason `put` does: never write through a name
    # that snapshots may be hardlinked to.
    cp -p "$STORE/$snap/files/$rel" "$BUCKET/$rel.mv-new.$$" \
      && mv -f "$BUCKET/$rel.mv-new.$$" "$BUCKET/$rel" && n=$((n+1))
  done
  local gone=0
  if [ -n "$exact" ]; then
    local keep; keep=$(mktemp); cut -f3 "$STORE/$snap/MANIFEST" | sort >"$keep"
    while IFS= read -r rel; do
      grep -qxF "$rel" "$keep" || { rm -f "$BUCKET/$rel" && gone=$((gone+1)); }
    done < <(cd "$BUCKET" && find . -type f -printf '%P\n')
    rm -f "$keep"
  fi
  echo "restored $n file(s) from $snap${exact:+, removed $gone not present in it}"
}

# Two weeks, then gone. Snapshots older than that are deleted outright — but anything whose only
# remaining copy is in the snapshot being deleted is recorded in PRUNED.log first, because that is
# the one case where pruning loses data rather than just history.
cmd_prune() {
  local days=$KEEP_DAYS dry=''
  while [ $# -gt 0 ]; do
    case $1 in
      --days) days=${2:-}; shift 2 ;;
      --dry-run|-n) dry=1; shift ;;
      *) die "prune: unknown option $1" ;;
    esac
  done
  local all count s
  all=$(all_snapshots); count=$(echo "$all" | grep -c . || true)
  [ "$count" -gt 0 ] || { echo "nothing to prune"; return 0; }

  local doomed='' survivors='' i=0 keep_newest
  keep_newest=$((count - KEEP_MIN))
  for s in $all; do
    i=$((i+1))
    # Eligible only if it is older than the cutoff AND not one of the newest KEEP_MIN.
    if [ "$i" -le "$keep_newest" ] \
       && [ -n "$(find "$STORE/$s" -maxdepth 0 -type d -mtime "+$days" 2>/dev/null)" ]; then
      doomed="$doomed $s"
    else
      survivors="$survivors $s"
    fi
  done
  [ -n "${doomed// /}" ] || { echo "nothing older than $days days ($count snapshot(s) kept)"; return 0; }

  # Paths that will still exist somewhere after the prune: the live bucket plus every survivor.
  local safe; safe=$(mktemp)
  (cd "$BUCKET" && find . -type f -printf '%P\n') >>"$safe"
  for s in $survivors; do cut -f3 "$STORE/$s/MANIFEST" >>"$safe"; done
  sort -u -o "$safe" "$safe"

  for s in $doomed; do
    local lost nfiles
    nfiles=$(wc -l <"$STORE/$s/MANIFEST")
    lost=$(comm -23 <(cut -f3 "$STORE/$s/MANIFEST" | sort -u) "$safe")
    if [ -n "$dry" ]; then
      echo "would delete $s ($nfiles files)$([ -n "$lost" ] && echo " — LAST COPY of $(echo "$lost" | wc -l) path(s)")"
      [ -n "$lost" ] && echo "$lost" | head -10 | sed 's/^/    last copy: /'
    else
      {
        echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) pruned $s ($nfiles files, older than $days days)"
        [ -n "$lost" ] && echo "$lost" | sed 's/^/    last copy removed: /'
      } >>"$STORE/PRUNED.log"
      rm -rf "$STORE/$s"
      echo "deleted $s${lost:+ (last copy of $(echo "$lost" | wc -l) path(s) — see PRUNED.log)}"
    fi
  done
  rm -f "$safe"
}

# Has the live bucket drifted from its newest snapshot?
cmd_verify() { cmd_diff "$(latest_snapshot)" live; }

# Do the snapshots still hold what they claim to? This is what catches the hardlink hazard in the
# header: a stored file whose checksum no longer matches its own MANIFEST was rewritten in place
# through the live bucket, and that snapshot of it is gone.
cmd_fsck() {
  local s bad=0 total=0
  for s in $(all_snapshots); do
    local mf="$STORE/$s/MANIFEST" cur; cur=$(mktemp)
    write_manifest "$cur" "$STORE/$s/files"
    local n; n=$(diff <(sort "$mf") <(sort "$cur") | grep -c '^[<>]' || true)
    total=$((total+1))
    if [ "$n" -gt 0 ]; then
      bad=$((bad+1))
      echo "CORRUPT $s — $n manifest line(s) no longer match the stored files:"
      diff <(sort "$mf") <(sort "$cur") | grep '^[<>]' | head -10 | sed 's/^/    /'
    fi
    rm -f "$cur"
  done
  [ "$bad" -eq 0 ] && echo "fsck: $total snapshot(s), all intact"
  return 0
}

usage() {
  cat <<'EOF'
media-version — history for the home-app media bucket (3D models, product images, catalogue)

  snapshot [-l LABEL] [--if-changed]   record the bucket's current state
  list                                 every snapshot, oldest first
  diff SNAP [SNAP|live]                what changed between two points
  put FILE RELPATH                     write into the bucket safely (snapshots first) — USE THIS
  restore SNAP [RELPATH...] [--exact]  put files back (snapshots the current state first)
  prune [--days N] [--dry-run]         delete snapshots older than N days (default 14)
  verify                               has the bucket drifted from its newest snapshot?
  fsck                                 do the snapshots still hold what they claim to?

SNAP can be a full name, any substring of one, or "latest".
Never write over a live file in place (`> file`, `cp x file`) — it rewrites the snapshots too.
Bucket: /opt/home-app/media   Store: /opt/home-app/media-versions
EOF
}

case "${1:-}" in
  snapshot) shift; cmd_snapshot "$@" ;;
  list|ls) shift; cmd_list "$@" ;;
  diff) shift; cmd_diff "$@" ;;
  put) shift; [ $# -eq 2 ] || die "usage: put FILE RELPATH"; cmd_put "$@" ;;
  restore) shift; cmd_restore "$@" ;;
  prune) shift; cmd_prune "$@" ;;
  verify) shift; cmd_verify "$@" ;;
  fsck) shift; cmd_fsck "$@" ;;
  ''|-h|--help|help) usage ;;
  *) usage; exit 2 ;;
esac
