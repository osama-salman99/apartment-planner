#!/bin/sh
# Installs the frontend's packages for the Gradle build (npmInstall). Plain `npm ci`, unless
# NODE_MODULES_CACHE names a folder (the VPS build runner sets it): then each finished install is
# kept there under a key of package-lock.json, the Node version and the CPU, and a later build with
# the same key copies it back as hard links (well under a second) instead of running npm ci (~3 s).
# The kept copy is made from a clean `npm ci`, so the result is the same either way.
set -eu
cd "$(dirname "$0")/.."
[ -n "${NODE_MODULES_CACHE:-}" ] || exec npm ci
key=$( { cat package-lock.json; node --version; uname -m; } | sha256sum | cut -c1-16)
saved="$NODE_MODULES_CACHE/$key"
rm -rf node_modules
if [ -d "$saved" ]; then
  cp -al "$saved" node_modules 2>/dev/null || { rm -rf node_modules; cp -a "$saved" node_modules; }
  echo "node_modules: reused the install kept for this package-lock.json ($key)"
  exit 0
fi
npm ci
# Keep a copy for the next build. Made under a temporary name and renamed into place, so a build
# running at the same time never sees half a copy; if another build kept one first, this one is dropped.
mkdir -p "$NODE_MODULES_CACHE"
tmp=$(mktemp -d "$NODE_MODULES_CACHE/.new-XXXXXX")
if cp -al node_modules "$tmp/m" 2>/dev/null && mv -T "$tmp/m" "$saved" 2>/dev/null; then
  echo "node_modules: kept this install for later builds ($key)"
fi
rm -rf "$tmp"
# Only the three most recent lock files are worth keeping.
ls -1dt "$NODE_MODULES_CACHE"/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
