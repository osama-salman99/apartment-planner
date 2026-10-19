// IKEA catalog ingestion → public/products.json
//
// Enumerates the IKEA NL range via the (un-gated) search backend and normalizes each SKU into
// the frontend's Product shape. ikea.com itself is behind a Cloudflare managed challenge, but
// sik.search.blue.cdtapps.com serves clean JSON, so this needs no headless browser.
//
//   node scripts/ingest-ikea.mjs            # prototype run (a few furniture queries)
//   node scripts/ingest-ikea.mjs --full     # broad sweep across all query terms
//
// Dimensions are NOT in the search feed, so we seed a plausible archetype footprint here
// (editable in-app). A later headless pass can backfill exact W/D/H from the PDP.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'products.json');
const API = 'https://sik.search.blue.cdtapps.com/nl/nl/search-result-page';

// Query terms to enumerate. The prototype set is furniture with a floor footprint (what a
// planner cares about); --full just widens the same mechanism. Deduped by article number.
const PROTOTYPE_TERMS = ['bank', 'fauteuil', 'bed', 'eettafel', 'bureau', 'boekenkast'];
// Comprehensive Dutch furniture vocabulary to enumerate the whole placeable range. Overlap is
// fine — everything is deduped by article number, then fit-filtered.
const FULL_TERMS = [
  // seating
  'bank', 'hoekbank', 'slaapbank', 'tweezitsbank', 'driezitsbank', 'chaise longue', 'zitzak',
  'fauteuil', 'relaxfauteuil', 'oorfauteuil', 'stoel', 'eetkamerstoel', 'bureaustoel',
  'gamingstoel', 'schommelstoel', 'kruk', 'barkruk', 'poef', 'voetenbank', 'bijzetstoel',
  // beds
  'bed', 'bedframe', 'boxspring', 'tweepersoonsbed', 'eenpersoonsbed', 'bedbank', 'kinderbed',
  'stapelbed', 'divanbed',
  // tables
  'eettafel', 'salontafel', 'bijzettafel', 'bureau', 'tafel', 'uitschuifbare tafel', 'klaptafel',
  'consoletafel', 'wandtafel', 'nachtkastje', 'kaptafel',
  // storage
  'kast', 'kledingkast', 'boekenkast', 'opbergkast', 'vitrinekast', 'dressoir', 'ladekast',
  'commode', 'tv-meubel', 'sideboard', 'wandmeubel', 'halkast', 'schoenenkast', 'badkamerkast',
  'wandplank', 'stellingkast', 'kubuskast', 'roomdivider', 'garderobe', 'kaptafel',
  // other placeable
  'spiegel', 'kapstok', 'vloerkleed', 'paraplubak', 'plantenstandaard',
];

// Non-furniture / not-standalone parts and accessories — skipped entirely. A floor planner only
// wants things with a real footprint, not covers, spare doors, tabletops, legs, shelves, etc.
const EXCLUDE = /hoes|\bdeur\b|tafelblad|\bpoot\b|\bpoten\b|bovendeel|onderdeel|extra plank|\bplank\b|matras\b|kussen|onderstel$/;

// typeName (Dutch) → renderer archetype. Ordered specific→general; FIRST hit wins, so the more
// specific "boekenkast" must precede the generic "kast", and bare "tafel" must come last.
const ARCHETYPE_RULES = [
  [/nachtkast/, 'nightstand'],
  [/boekenkast|wandplank|stellingkast|open kast/, 'bookshelf'],
  [/tv-?meubel|tv-?bank/, 'tvConsole'],
  [/ladekast|commode/, 'nightstand'],
  [/(kleding|garderobe|vitrine|opberg|schoenen|hoge |draai)?kast|dressoir/, 'wardrobe'],
  [/slaapbank|hoekbank|zitbank|bedbank|\bbank\b|zitsbank|zitselement|zitshoek|divanbed/, 'sofa'],
  [/fauteuil|relaxfauteuil|oorfauteuil/, 'armchair'],
  [/bedframe|\bbed\b|boxspring|hoofdeinde|matrasbodem|bedonderstel/, 'bed'],
  [/salontafel|bijzettafel/, 'coffeeTable'],
  [/bureaustoel/, 'chair'],
  [/bureau|toilettafel/, 'desk'],
  [/eetkamerstoel|eetstoel/, 'diningChair'],
  [/eettafel|eetkamertafel|uitschuifbare tafel|klaptafel|tafelcombinatie|\btafel\b/, 'diningTable'],
  [/vloerkleed|tapijt|karpet/, 'rug'],
  [/kruk|barkruk/, 'chair'],
  [/stoel/, 'chair'],
];

// Fallback footprint per archetype (cm) — mirrors the app's built-in "reasonable off-the-shelf"
// catalog defaults. Refined for a few sofa sizes below.
const DIMS = {
  bed: { w: 160, d: 210, h: 45 }, nightstand: { w: 40, d: 35, h: 50 },
  wardrobe: { w: 100, d: 60, h: 220 }, desk: { w: 120, d: 60, h: 75 },
  chair: { w: 45, d: 50, h: 85 }, sofa: { w: 200, d: 90, h: 80 },
  armchair: { w: 80, d: 85, h: 90 }, coffeeTable: { w: 100, d: 55, h: 40 },
  diningTable: { w: 140, d: 80, h: 75 }, diningChair: { w: 45, d: 50, h: 85 },
  tvConsole: { w: 140, d: 40, h: 45 }, bookshelf: { w: 80, d: 30, h: 180 },
  rug: { w: 200, d: 140, h: 1 }, box: { w: 60, d: 60, h: 60 },
};

// Apartment fit filter: drop products whose FOOTPRINT can't fit the largest open room (lounge
// ≈ 234×468 cm), rotation allowed. Height is intentionally ignored (a tall wardrobe still fits).
const ROOM_W = 234;
const ROOM_D = 468;
function fitsApartment({ w, d }) {
  const short = Math.min(w, d);
  const long = Math.max(w, d);
  return short <= ROOM_W && long <= ROOM_D;
}

function classify(typeName = '') {
  const t = typeName.toLowerCase();
  for (const [re, arch] of ARCHETYPE_RULES) if (re.test(t)) return arch;
  return 'box';
}

function dimsFor(archetype, typeName = '') {
  const t = typeName.toLowerCase();
  if (archetype === 'sofa') {
    if (/hoekbank|chaise/.test(t)) return { w: 240, d: 160, h: 66 };
    if (/3-?zit/.test(t)) return { w: 218, d: 88, h: 66 };
    if (/2-?zit/.test(t)) return { w: 180, d: 88, h: 66 };
    if (/4-?zit/.test(t)) return { w: 260, d: 95, h: 66 };
  }
  return DIMS[archetype] ?? DIMS.box;
}

function materialFor(archetype) {
  if (['sofa', 'armchair', 'rug'].includes(archetype)) return 'fabric';
  if (archetype === 'bed') return 'fabric';
  return 'wood';
}

async function fetchTerm(term, size = 100) {
  const url = `${API}?types=PRODUCT&q=${encodeURIComponent(term)}&size=${size}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`${term}: HTTP ${res.status}`);
  const data = await res.json();
  return data?.searchResultPage?.products?.main?.items ?? [];
}

function normalize(item) {
  const p = item.product;
  if (!p || !p.itemNo) return null;
  // Availability: drop items that can't be ordered/home-delivered (onlineSellable=false) or that
  // are being discontinued (lastChance). IKEA NL home-delivers all online-sellable furniture
  // nationwide, so this also covers "deliverable to the apartment".
  if (p.onlineSellable === false || p.lastChance === true) return null;
  if (EXCLUDE.test((p.typeName ?? '').toLowerCase())) return null;
  const archetype = classify(p.typeName);
  const dims = dimsFor(archetype, p.typeName);
  if (!fitsApartment(dims)) return null; // too big for any room (footprint; height ignored)
  const hex = p.colors?.[0]?.hex;
  return {
    articleNo: p.itemNo,
    name: p.name ?? 'IKEA product',
    typeName: p.typeName ?? '',
    category: (p.categoryPath ?? []).map((c) => c.name).join(' / '),
    dims,
    priceEUR: p.salesPrice?.numeral ?? 0,
    imageUrl: p.mainImageUrl ?? '',
    productUrl: p.pipUrl ?? '',
    colorHex: hex ? `#${hex}` : '#b7ada0',
    material: materialFor(archetype),
    archetype,
  };
}

async function main() {
  const full = process.argv.includes('--full');
  const terms = full ? FULL_TERMS : PROTOTYPE_TERMS;
  const size = full ? 300 : 100;
  const byArticle = new Map();
  for (const term of terms) {
    try {
      const items = await fetchTerm(term, size);
      let added = 0;
      for (const it of items) {
        const prod = normalize(it);
        if (prod && !byArticle.has(prod.articleNo)) {
          byArticle.set(prod.articleNo, prod);
          added++;
        }
      }
      console.log(`  ${term}: ${items.length} items, +${added} new`);
    } catch (e) {
      console.warn(`  ${term}: FAILED — ${e.message}`);
    }
  }
  const products = [...byArticle.values()].sort((a, b) => a.name.localeCompare(b.name));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(products, null, 0));

  const byArch = {};
  for (const p of products) byArch[p.archetype] = (byArch[p.archetype] ?? 0) + 1;
  console.log(`\n${products.length} products → ${OUT}`);
  console.log('archetypes:', byArch);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
