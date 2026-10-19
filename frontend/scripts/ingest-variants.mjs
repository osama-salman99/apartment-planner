// Attach the full colour/size variant set to catalogue products.
//
// WHY THIS EXISTS
// ---------------
// The original ingest (ingest-ikea.mjs) walked the search backend and kept one catalogue row per
// result. IKEA's search collapses a product family down to a few representative results, and every
// size-and-colour combination is its own article number — so we ended up with, for example, three
// MALM "Bedframe, hoog, met 2 bedlades" rows out of the 47 that exist: white 90x200, white 140x200
// and black-brown 90x200. The 180x200 black-brown one the planner actually wanted was simply absent,
// and nothing in the data said the three rows were the same product, so no UI could offer "the
// colours this bed comes in".
//
// This script fixes that shape. Rather than adding a row per variant — which would turn a 3826-row
// catalogue into a five-figure one and put 47 near-identical MALM cards in the library — it collapses
// each family to ONE row carrying a `variants` array. The library shows one card per product with a
// swatch per available colour, and the inspector offers exactly the sizes and colours that exist.
//
//   node scripts/ingest-variants.mjs --group "MALM|Bedframe, hoog, met 2 bedlades"
//   node scripts/ingest-variants.mjs --archetype bed
//   node scripts/ingest-variants.mjs --all
//
// Reads the live catalogue over HTTP by default and writes a new file; it never installs anything
// itself. Publish the result with `media-version put <file> products.json` on the VPS so the change
// is snapshotted and revertible.
//
// Only the search host is used (sik.search.blue.cdtapps.com). www.ikea.com is Cloudflare-blocked for
// our IP, so nothing here may depend on it — including images: a variant's own thumbnail URL points
// at www.ikea.com and cannot be mirrored into our bucket from here (see localise-catalog-images.sh).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const API = 'https://sik.search.blue.cdtapps.com/nl/nl/search-result-page';
const CATALOGUE_URL = process.env.CATALOGUE_URL ?? 'https://home.osmosis.work/media/products.json';

// The mattress sizes IKEA sells bed frames in. Used to build targeted queries: searching the family
// name alone returns a handful of representatives, but adding a size surfaces that size's articles.
const BED_SIZES = ['90x200', '120x200', '140x200', '160x200', '180x200'];

// Second half of a colour string like "zwartbruin/Luröy" or "wit/Vesteröy stevig". A slatted base or
// a mattress bundled with the frame is a different ARTICLE but not a different colour, and treating
// it as one produced a colour list with "zwartbruin" three times over. Kept as `bundle` so a bare
// frame can be preferred and the extra can still be named.
const BUNDLE_WORDS = /^(Luröy|Lönset|Leirsund|Vesteröy|Valevåg|Åbygda|Åfjäll|Åkrehamn|Vågstranda|Vadsø|Snarum|Ebbarp|zacht|middelhard|stevig|extra stevig)\b/i;

// The Dutch colour words IKEA's cover names end in. A boxspring's design text reads
// "Näsfjället Odensvi lichtbeige" — mattress model, then cover fabric, then colour — so without this
// one bed comes out in fourteen "colours" that are really two covers times seven mattresses. Used to
// spot that a name ENDS in a colour, which is the only case where the leading words can be dropped
// safely: "wit gelazuurd eikenfineer" ends in a material and really is its own finish.
const COLOUR_WORDS =
  /^(wit|zwart|zwartbruin|grijs|donkergrijs|lichtgrijs|antraciet|antracietgrijs|beige|lichtbeige|donkerbeige|bruin|donkerbruin|lichtbruin|blauw|donkerblauw|lichtblauw|groen|donkergroen|lichtgroen|rood|roze|geel|oranje|paars|turkoois|zilverkleurig|goudkleurig|naturel|crème)([-/][a-zà-ÿ]+)*$/i;

// IKEA's own hex, where the feed gives one, is a generic colour-family swatch: "zwartbruin" comes
// back as brown #814820 plus black #000000, neither of which is the finish. These are sampled to the
// actual painted/stained finish instead. Anything not listed falls back to the feed's first hex.
const FINISH_HEX = {
  'wit': '#ffffff',
  'zwartbruin': '#2b2420',
  'grijs gelazuurd': '#8d8b86',
  'wit gelazuurd eikenfineer': '#e8ddc9',
  'wit gelazuurd': '#ece6da',
  'eikenfineer': '#c9a876',
  'gelazuurd eikenfineer': '#c9a876',
  'zwart': '#1a1a1a',
  'bruin': '#6b4a34',
  'beige': '#d9cdb8',
  'grijs': '#949494',
  'donkergrijs': '#4a4a4a',
  'antracietgrijs': '#3b3f45',
  'blauw': '#4a6d8c',
  'groen': '#5c7a6e',
  'rood': '#b23a3a',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Wait between queries, unless the last answer came from the cache and cost nobody anything. */
const pause = () => (lastFromCache ? Promise.resolve() : sleep(350));

// Where answers from the search backend are kept, when --cache is given. IKEA's search host is the
// only one still talking to this network, a full sweep is thousands of queries, and the answers do
// not change during one — so a re-run to fix a derivation bug should cost nothing rather than
// repeating the whole conversation.
let cacheDir = null;
let cacheHits = 0;
// Whether the answer just returned came off disk. Callers pause between queries to be a polite guest
// on someone else's search backend; there is nothing to be polite about when nothing was sent.
let lastFromCache = false;
let cacheMisses = 0;
const cachePath = (q) => join(cacheDir, createHash('sha1').update(q).digest('hex') + '.json');

async function search(q, size = 96) {
  const url = `${API}?q=${encodeURIComponent(q)}&size=${size}`;
  if (cacheDir) {
    try {
      const hit = JSON.parse(await readFile(cachePath(q), 'utf8'));
      cacheHits++;
      lastFromCache = true;
      return hit;
    } catch {
      cacheMisses++;
    }
  }
  lastFromCache = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (cacheDir) await writeFile(cachePath(q), JSON.stringify(json));
      return json;
    } catch (err) {
      if (attempt === 2) {
        console.warn(`  ! query failed after 3 tries: ${q} (${err.message})`);
        return null;
      }
      await sleep(1500 * (attempt + 1));
    }
  }
}

/** Every product object in a search response, including the truncated per-item variant previews. */
function* productsIn(json) {
  const items = json?.searchResultPage?.products?.main?.items ?? [];
  for (const it of items) {
    const p = it.product ?? it;
    yield p;
    for (const v of p.gprDescription?.variants ?? []) yield { name: p.name, typeName: p.typeName, ...v };
  }
}

function splitFinish(raw) {
  const text = (raw ?? '').trim();
  if (!text) return { finish: '', bundle: '' };
  const parts = text.split('/').map((s) => s.trim()).filter(Boolean);
  const finish = [];
  const bundle = [];
  for (const part of parts) {
    if (BUNDLE_WORDS.test(part)) {
      bundle.push(part);
      continue;
    }
    // "Näsfjället Odensvi lichtbeige" -> cover "Odensvi lichtbeige", mattress "Näsfjället" as the
    // bundle. Only when the name ends in a colour word and has a word to spare in front of the fabric.
    const words = part.split(/\s+/);
    if (words.length > 2 && COLOUR_WORDS.test(words[words.length - 1])) {
      bundle.push(words.slice(0, -2).join(' '));
      finish.push(words.slice(-2).join(' '));
      continue;
    }
    finish.push(part);
  }
  return { finish: finish.join('/'), bundle: bundle.filter(Boolean).join(' / ') };
}

function hexFor(finish, feedColors) {
  const key = finish.toLowerCase();
  if (FINISH_HEX[key]) return FINISH_HEX[key];
  // Longest matching known finish word inside a compound like "wit gelazuurd eikenfineer".
  const hit = Object.keys(FINISH_HEX)
    .filter((k) => key.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  if (hit) return FINISH_HEX[hit];
  const feed = (feedColors ?? []).find((c) => c.hex);
  return feed ? `#${feed.hex}` : '#cccccc';
}

const groupKey = (name, typeName) => `${name ?? ''}|${typeName ?? ''}`;
// IKEA states a reference measurement in one of two shapes: two numbers ("180x200 cm" — the
// mattress a bed frame takes) or one ("160 cm" — the bed width a headboard spans, its own depth
// being the same in every size). Read both; `d: null` marks the one-number form so the caller
// knows the depth has to come from somewhere else.
const parseSize = (label) => {
  const two = /(\d+)\s*x\s*(\d+)/.exec(label ?? '');
  if (two) return { w: +two[1], d: +two[2] };
  const one = /(\d+)\s*cm/.exec(label ?? '');
  return one ? { w: +one[1], d: null } : null;
};

// Size buttons read left to right as the piece gets bigger, so the whole stated measurement is
// compared number by number — otherwise a 120 cm cabinet 193 cm tall sorts ahead of the same
// cabinet 74 cm tall, which reads as random.
const bySizeLabel = (a, b) => {
  const na = (a.sizeLabel ?? '').match(/\d+/g)?.map(Number) ?? [];
  const nb = (b.sizeLabel ?? '').match(/\d+/g)?.map(Number) ?? [];
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const d = (na[i] ?? 0) - (nb[i] ?? 0);
    if (d) return d;
  }
  return a.colorName.localeCompare(b.colorName);
};

/** Collect every article the search backend will admit for one product family. */
async function collectFamily(name, typeName, isBed) {
  const wanted = groupKey(name, typeName);
  const out = new Map();
  const seenColours = new Set();
  // How many articles IKEA says this family has. The feed states it per product and truncates the
  // variant preview to six, so it is the one signal that says whether more querying is worth doing —
  // and most families have exactly one, where the base query is already the whole answer.
  let expected = 0;

  const absorb = (json) => {
    for (const p of productsIn(json)) {
      if (groupKey(p.name, p.typeName) !== wanted) continue;
      expected = Math.max(expected, p.gprDescription?.numberOfVariants ?? 0);
      const { finish, bundle } = splitFinish(p.validDesignText ?? (p.colors ?? []).map((c) => c.name).join('/'));
      if (finish) seenColours.add(finish);
      const article = String(p.itemNo ?? p.id ?? '').replace(/^s/, '');
      if (!article) continue;
      const prev = out.get(article);
      // A variant preview carries no `colors`, so a later top-level sighting of the same article is
      // strictly better information — merge rather than first-write-wins.
      out.set(article, {
        article,
        id: p.id,
        sizeLabel: p.itemMeasureReferenceText ?? prev?.sizeLabel ?? '',
        finish: finish || prev?.finish || '',
        bundle: bundle || prev?.bundle || '',
        colors: (p.colors ?? []).length ? p.colors : prev?.colors,
        priceEUR: p.salesPrice?.numeral ?? prev?.priceEUR ?? 0,
        productUrl: p.pipUrl ?? prev?.productUrl ?? '',
        imageUrl: p.mainImageUrl ?? prev?.imageUrl ?? '',
      });
    }
  };

  const base = `${name} ${typeName}`;
  absorb(await search(base));
  await pause();

  // Two widening passes: by size (surfaces every size's articles), then by the colours those turned
  // up (surfaces colours the size queries did not rank highly enough to return). Both stop as soon as
  // the family is complete — this is someone else's search backend and the range is 3800 products, so
  // the query budget goes where there is actually something missing.
  const done = () => expected > 0 && out.size >= expected;
  const sizeTerms = isBed ? BED_SIZES : [];
  for (const s of sizeTerms) {
    if (done()) break;
    absorb(await search(`${base} ${s}`));
    await pause();
  }
  for (const c of [...seenColours].slice(0, 8)) {
    if (done()) break;
    absorb(await search(`${base} ${c}`));
    await pause();
  }
  return { found: [...out.values()], expected };
}

// The overhang used when a family has nothing measured to derive from. It is the median across the
// 64 bed frames in the catalogue whose dimensions came off a real 3D model — a frame sticks out about
// 9 cm past its mattress in each direction, though the measured range runs from 0 to 27, so a variant
// dimensioned this way is marked 'estimated' and the panel says so.
const FALLBACK_OVERHANG = { overhangW: 9, overhangD: 9 };

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * Outer dimensions per size. The feed's measurement is the MATTRESS size, not the frame, so it
 * cannot be used as the footprint directly — a MALM 90x200 frame is 105x209 on the floor. Where the
 * family already has a row whose dimensions were measured off a real 3D model, the difference between
 * that frame and its mattress is the frame's overhang, and it holds across the sizes of one design;
 * so the overhang is carried over and the height (headboard) with it.
 */
function dimsForSize(sizeLabel, anchor) {
  const size = parseSize(sizeLabel);
  if (!size || !anchor) return null;
  // One-number label: only the width changes with the size, so the depth is whatever the measured
  // sibling's actually was rather than a number plus an overhang.
  if (size.d === null) {
    if (anchor.depthAbs == null) return null;
    return { w: size.w + anchor.overhangW, d: anchor.depthAbs, h: anchor.h };
  }
  return {
    w: size.w + anchor.overhangW,
    d: size.d + anchor.overhangD,
    h: anchor.h,
  };
}

function anchorFrom(rows) {
  // Only rows whose dimensions came off a real model: those are the ones known to describe the frame
  // rather than the mattress. Several sizes of one design are often modelled, so take the median of
  // what they imply — one mislabelled pairing then cannot drag the whole family off.
  const measured = rows.filter((r) => r.dimsSource === 'glb' && r.dims && parseSize(r._sizeLabel));
  const ws = [];
  const ds = [];
  const hs = [];
  const depths = []; // absolute depths, for the one-number labels where depth doesn't scale
  for (const r of measured) {
    const size = parseSize(r._sizeLabel);
    const ow = r.dims.w - size.w;
    if (ow < 0 || ow > 60) continue;
    if (size.d === null) {
      ws.push(ow);
      depths.push(r.dims.d);
      hs.push(r.dims.h);
      continue;
    }
    const od = r.dims.d - size.d;
    // A frame narrower than its own mattress means the pairing is wrong, so drop that one rather
    // than generating footprints smaller than the mattress they hold.
    if (od < 0 || od > 60) continue;
    ws.push(ow);
    ds.push(od);
    hs.push(r.dims.h);
  }
  if (!ws.length) return null;
  return {
    overhangW: median(ws),
    overhangD: ds.length ? median(ds) : 0,
    depthAbs: depths.length ? median(depths) : null,
    h: median(hs),
    measured: true,
  };
}

/**
 * IKEA's stated measurement is a string of numbers whose meaning changes with the product: "100x48 cm"
 * on a desk is width by depth, "77x147 cm" on a KALLAX shelf is width by height, and "50x58x236 cm" on
 * a wardrobe is all three. So the meaning is not assumed — it is proven, per family, against the
 * articles whose dimensions came off a real 3D model: if every modelled article in the family is
 * exactly as tall as the third number of its own label says, then the third number is the height, and
 * the sizes that had to borrow their dimensions from a differently-sized sibling can take that number
 * for their own. Slots that fit no dimension, or more than one, are left alone.
 */
const AXES = ['w', 'd', 'h'];
function alignFromLabel(variants, archetype) {
  const stated = (v) => (v.sizeLabel ?? '').match(/\d+/g)?.map(Number) ?? [];
  const proofs = variants.filter((v) => v.dimsSource === 'glb' && stated(v).length);
  if (!proofs.length) return 0;

  const meaning = {};
  const claimed = new Set();
  for (let slot = 0; slot < 3; slot++) {
    const tested = proofs.filter((v) => stated(v).length > slot);
    if (!tested.length) continue;
    const fits = AXES.filter((ax) => tested.every((v) => Math.abs(stated(v)[slot] - v.dims[ax]) <= 3));
    if (fits.length !== 1 || claimed.has(fits[0])) continue;
    meaning[slot] = fits[0];
    claimed.add(fits[0]);
  }
  if (!Object.keys(meaning).length) return 0;

  let fixed = 0;
  for (const v of variants) {
    if (v.dimsSource === 'glb') continue;
    const nums = stated(v);
    const dims = { ...v.dims };
    let changed = false;
    for (const [slot, ax] of Object.entries(meaning)) {
      const n = nums[slot];
      if (n == null || Math.abs(n - dims[ax]) <= 3) continue;
      dims[ax] = n;
      changed = true;
    }
    // A rug given a single number is round, and that number is across it whichever way you measure.
    if (archetype === 'rug' && nums.length === 1 && meaning[0] === 'w' && Math.abs(nums[0] - dims.d) > 3) {
      dims.d = nums[0];
      changed = true;
    }
    if (!changed) continue;
    v.dims = dims;
    v.dimsSource = 'measure';
    fixed++;
  }
  return fixed;
}

/**
 * A bed frame cannot be narrower than the mattress it holds. Where a model measurement says it is,
 * the model measured the wrong thing (a sub-part, usually), and believing it would tell someone a
 * 160 cm bed fits in 142 cm — so the footprint worked out from the mattress is used instead.
 */
function fixNarrowBeds(variants, anchor) {
  if (!anchor) return 0;
  let fixed = 0;
  for (const v of variants) {
    const size = parseSize(v.sizeLabel);
    if (!size || size.d === null || v.dims.w + 1 >= size.w) continue;
    const derived = dimsForSize(v.sizeLabel, anchor);
    if (!derived || derived.w <= v.dims.w) continue;
    v.dims = derived;
    v.dimsSource = anchor.measured ? 'derived' : 'estimated';
    fixed++;
  }
  return fixed;
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const onlyGroup = arg('--group');
  const onlyArchetype = arg('--archetype');
  const all = args.includes('--all');
  const outPath = arg('--out') ?? '/tmp/products-variants.json';
  if (!onlyGroup && !onlyArchetype && !all) {
    console.error('need --group "NAME|typeName", --archetype <shape>, or --all');
    process.exit(2);
  }

  // Optional: keep every answer from the search backend on disk, so fixing a derivation bug and
  // re-running is free instead of thousands of fresh queries.
  const cacheArg = arg('--cache');
  if (cacheArg) {
    await mkdir(cacheArg, { recursive: true });
    cacheDir = cacheArg;
    console.log(`query cache: ${cacheDir}`);
  }

  // Optional: `ls /opt/home-app/media/models` from the VPS, so a variant can be given the model that
  // is genuinely in the bucket even when no catalogue row mentions it.
  const modelArticles = new Set();
  const modelsFile = arg('--models');
  if (modelsFile) {
    for (const line of (await readFile(modelsFile, 'utf8')).split('\n')) {
      const m = /^(\d+)\.glb$/.exec(line.trim());
      if (m) modelArticles.add(m[1]);
    }
    console.log(`models in bucket: ${modelArticles.size}`);
  }

  const src = arg('--in');
  const rows = src
    ? JSON.parse(await readFile(src, 'utf8'))
    : await (await fetch(CATALOGUE_URL)).json();
  console.log(`catalogue: ${rows.length} rows`);

  // Group the existing rows by family.
  const families = new Map();
  for (const r of rows) {
    const k = groupKey(r.name, r.typeName);
    if (!families.has(k)) families.set(k, []);
    families.get(k).push(r);
  }

  const targets = [...families.keys()].filter((k) => {
    if (onlyGroup) return k === onlyGroup;
    if (onlyArchetype) return families.get(k).some((r) => r.archetype === onlyArchetype);
    return true;
  });
  console.log(`families to expand: ${targets.length}`);
  if (!targets.length) {
    console.error('nothing matched — check the group key spelling against the catalogue');
    process.exit(1);
  }

  const drop = new Set();
  let expanded = 0;

  for (const key of targets) {
    const [name, typeName] = key.split('|');
    const siblings = families.get(key);
    const isBed = siblings.some((r) => r.archetype === 'bed');
    process.stdout.write(`\n${key}  (${siblings.length} existing row(s))\n`);

    const { found, expected } = await collectFamily(name, typeName, isBed);
    if (!found.length) {
      console.log('  ! no articles returned; left unchanged');
      continue;
    }

    // Label the existing rows with their size so one can serve as the dimension anchor.
    const bySize = new Map(found.map((f) => [f.article, f.sizeLabel]));
    for (const r of siblings) r._sizeLabel = bySize.get(r.articleNo) ?? '';
    const measured = anchorFrom(siblings);
    // Only beds get the fallback: the 9 cm figure was measured off bed frames and means nothing for a
    // wardrobe or a rug, where a "size" is the piece itself rather than the mattress inside it.
    const anchor = measured ?? (isBed ? { ...FALLBACK_OVERHANG, h: siblings[0].dims.h } : null);

    // One variant per (size, finish). A bare frame beats a bundle, and among equals the cheaper wins
    // — the bundled article is the same piece of furniture with a slatted base or mattress added, so
    // it would only ever duplicate the colour.
    // An article we already have a catalogue row for outranks all of that, though: that row is where
    // the measured dimensions and the 3D model live, and it is the article the card itself names — a
    // list that excludes it leaves the app unable to say which variant is the one standing in the room.
    const isSibling = new Set(siblings.map((r) => r.articleNo));
    const best = new Map();
    for (const f of found) {
      if (!f.finish) continue;
      const k = `${f.sizeLabel}|${f.finish}`;
      const cur = best.get(k);
      const better =
        !cur ||
        (isSibling.has(f.article) && !isSibling.has(cur.article)) ||
        (isSibling.has(f.article) === isSibling.has(cur.article) &&
          ((!f.bundle && cur.bundle) ||
            (!!f.bundle === !!cur.bundle && (f.priceEUR || Infinity) < (cur.priceEUR || Infinity))));
      if (better) best.set(k, f);
    }

    // Which of these articles has a real 3D model. Taken from the bucket listing when one was
    // supplied, because collapsing a family drops rows — and with them the only record that a dropped
    // article had a model sitting in the bucket. The file is what matters, not the row.
    const existingModel = new Map(siblings.filter((r) => r.modelUrl).map((r) => [r.articleNo, r.modelUrl]));
    for (const f of found) {
      if (modelArticles.has(f.article) && !existingModel.has(f.article)) {
        existingModel.set(f.article, `/media/models/${f.article}.glb`);
      }
    }
    const variants = [...best.values()]
      .map((f) => {
        const derived = dimsForSize(f.sizeLabel, anchor);
        const sib = siblings.find((r) => r.articleNo === f.article);
        // An article that was measured off its own model keeps those numbers — they beat anything
        // worked out from a sibling. Everything else takes the derived footprint, and only falls back
        // to the family's when there was no size to derive from at all.
        const exact = sib?.dimsSource === 'glb' ? sib.dims : null;
        return {
          articleNo: f.article,
          colorName: f.finish,
          colorHex: hexFor(f.finish, f.colors),
          sizeLabel: f.sizeLabel,
          dims: exact ?? derived ?? sib?.dims ?? siblings[0].dims,
          dimsSource: exact ? 'glb' : derived ? (anchor.measured ? 'derived' : 'estimated') : 'inherited',
          priceEUR: f.priceEUR || sib?.priceEUR || 0,
          productUrl: f.productUrl || sib?.productUrl || '',
          imageUrl: sib?.imageUrl || f.imageUrl || '',
          // A model is scaled to its own article's real size and cannot stand in for another size,
          // so it is carried only on the article it was measured from.
          ...(existingModel.has(f.article) ? { modelUrl: existingModel.get(f.article) } : {}),
          ...(f.bundle ? { bundle: f.bundle } : {}),
        };
      })
      .sort(bySizeLabel);

    const aligned = alignFromLabel(variants, siblings[0].archetype);
    if (aligned) console.log(`  ${aligned} size(s) took the measurement IKEA states for them`);
    const renarrowed = isBed ? fixNarrowBeds(variants, anchor) : 0;
    if (renarrowed) console.log(`  ${renarrowed} size(s) were drawn narrower than their own mattress — refitted`);

    // A family sold in exactly one size and finish has nothing to pick between — writing a
    // one-entry list would only grow the file (and, across ~2000 families, grow it a lot) and the
    // UI treats a single variant as no variants anyway. Leave the rows untouched.
    if (variants.length <= 1) {
      console.log(`  only ${variants.length} article(s) in the range — left unchanged`);
      continue;
    }

    // Keep the sibling with a real model as the card, so the library still shows the photoreal piece;
    // otherwise the cheapest/first. The rest of the siblings become redundant and are dropped.
    // Whichever it is, it has to be a variant in its own list — the app identifies what is placed by
    // article number, and a card naming an article the list does not contain cannot be resolved. A
    // sibling with a model wins, then any sibling in the list, and only then the plain first row (whose
    // article is then added to the list, since it is a real thing IKEA sells).
    const inList = new Set(variants.map((v) => v.articleNo));
    const rep =
      siblings.find((r) => r.modelUrl && inList.has(r.articleNo)) ??
      siblings.find((r) => inList.has(r.articleNo)) ??
      siblings.find((r) => r.modelUrl) ??
      siblings[0];
    if (!inList.has(rep.articleNo)) {
      const f = found.find((x) => x.article === rep.articleNo);
      variants.push({
        articleNo: rep.articleNo,
        colorName: f?.finish || rep.colorHex,
        colorHex: f?.finish ? hexFor(f.finish, f.colors) : rep.colorHex,
        sizeLabel: f?.sizeLabel ?? rep._sizeLabel ?? '',
        dims: rep.dims,
        dimsSource: rep.dimsSource === 'glb' ? 'glb' : 'inherited',
        priceEUR: f?.priceEUR || rep.priceEUR || 0,
        productUrl: f?.productUrl || rep.productUrl,
        imageUrl: f?.imageUrl || rep.imageUrl,
        ...(existingModel.has(rep.articleNo) ? { modelUrl: existingModel.get(rep.articleNo) } : {}),
        ...(f?.bundle ? { bundle: f.bundle } : {}),
      });
      variants.sort(bySizeLabel);
      console.log(`  note: card article ${rep.articleNo} was not in the range's own results — added it`);
    }
    // The card and the variant it names must agree on how big the thing is, or the library shows one
    // footprint and placing it gives another. The variant's number is the better one — it knows which
    // size it is — so the row follows it.
    const own = variants.find((v) => v.articleNo === rep.articleNo);
    if (own && (rep.dims.w !== own.dims.w || rep.dims.d !== own.dims.d || rep.dims.h !== own.dims.h)) {
      console.log(`  card dims ${rep.dims.w}x${rep.dims.d}x${rep.dims.h} -> ${own.dims.w}x${own.dims.d}x${own.dims.h} (${own.sizeLabel})`);
      rep.dims = { ...own.dims };
      rep.dimsSource = own.dimsSource;
    }
    rep.variants = variants;
    for (const r of siblings) if (r !== rep) drop.add(r.articleNo);
    expanded++;
    const colours = [...new Set(variants.map((v) => v.colorName))];
    const sizes = [...new Set(variants.map((v) => v.sizeLabel))];
    const short = expected && found.length < expected ? ` (IKEA says ${expected} articles, found ${found.length})` : '';
    console.log(`  ${variants.length} variants — ${sizes.length} size(s), ${colours.length} colour(s): ${colours.join(', ')}${short}`);
    console.log(`  card: ${rep.articleNo}${rep.modelUrl ? ' (has 3D model)' : ''}, dropped ${siblings.length - 1} duplicate row(s)`);
    if (!anchor) console.log("  note: nothing measured to derive from — every size keeps the card's footprint");
    else if (!anchor.measured) console.log('  note: no measured sibling — footprints estimated at mattress + 9 cm');
  }

  const out = rows.filter((r) => !drop.has(r.articleNo));
  for (const r of out) delete r._sizeLabel;
  await writeFile(outPath, JSON.stringify(out));
  console.log(`\nexpanded ${expanded} family/families, dropped ${drop.size} duplicate row(s)`);
  console.log(`${rows.length} -> ${out.length} rows, written to ${outPath}`);
  if (cacheDir) console.log(`queries: ${cacheMisses} sent, ${cacheHits} answered from the cache`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
