import type { CatalogEntry, FurnitureShape } from '../lib/types';
import type { ROOM_BOUNDS } from '../lib/dimensions';
import { BED_BASE_D, BED_BASE_W, WOONSPOT_BEDS, type WoonspotBedId } from '../lib/woonspotBeds';
import { WOONSPOT_SOFAS, type WoonspotSofaId } from '../lib/woonspotSofas';

// Where a freshly-added item spawns by default — bedroom pieces in the bedroom, everything else
// in the lounge (the apartment's only other open floor; the kitchen is fully fitted already and
// isn't a placement target). The user can always drag it anywhere afterward.
export const DEFAULT_ROOM_BY_SHAPE: Record<FurnitureShape, keyof typeof ROOM_BOUNDS> = {
  // Every WoonSpot XXL sofa lands in the lounge — the only room any of them fits in.
  ...(Object.fromEntries(WOONSPOT_SOFAS.map((s) => [s.id, 'lounge'])) as Record<
    WoonspotSofaId,
    'lounge'
  >),
  // …and every WoonSpot XXL boxspring in the bedroom.
  ...(Object.fromEntries(WOONSPOT_BEDS.map((b) => [b.id, 'bedroom'])) as Record<
    WoonspotBedId,
    'bedroom'
  >),
  bed: 'bedroom',
  bedding: 'bedroom',
  beddingMadeUp: 'bedroom',
  nightstand: 'bedroom',
  wardrobe: 'bedroom',
  paxCorner: 'bedroom',
  desk: 'bedroom',
  chair: 'bedroom',
  sofa: 'lounge',
  trentinoU: 'lounge',
  solidaOrdered: 'lounge',
  armchair: 'lounge',
  coffeeTable: 'lounge',
  diningTable: 'lounge',
  diningChair: 'lounge',
  tvConsole: 'lounge',
  bookshelf: 'lounge',
  rug: 'lounge',
  onsevigRug: 'bedroom',
  lamp: 'lounge',
  plant: 'lounge',
  ps5: 'lounge',
  ps5Flat: 'lounge',
  tclTv43: 'lounge',
  box: 'lounge',
  cylinder: 'lounge',
};

// Reasonable off-the-shelf dimensions (cm) — a sensible starting point the user resizes to
// match whatever they actually order. Colors are varied per category on purpose so an empty
// room doesn't read as one monochrome block once a few defaults are dropped in; every
// instance gets its own picker afterward (no forced global theme, per the brief).
export const CATALOG: CatalogEntry[] = [
  { id: 'bed', label: 'Bed', defaultDims: { w: 160, d: 210, h: 45 }, defaultColorHex: '#6b4a34' },
  // A mattress, to lay on a bed frame that has none (the IDANÄS model is frame-only). Default is the
  // 180 × 200 size the placed IDANÄS ottoman bed actually takes — its opening measures 181 × 199 in
  // its own GLB — and 22 cm thick. Set Y to the frame's slat platform: 44 cm on that bed, measured
  // off the model. See three/Bedding.tsx; the made-up version below is the same component.
  {
    id: 'bedding',
    label: 'Mattress',
    defaultDims: { w: 180, d: 200, h: 22 },
    defaultColorHex: '#e7e7e5',
  },
  // The same mattress made up the way IKEA's own room shot of this bed has it: white duvet with its
  // head edge turned back, four pillows standing in two rows, and a charcoal throw across the foot
  // half. `h` scales the whole stack, so it is the 72 cm from the mattress underside to the top of the
  // back row of pillows, NOT a mattress thickness — it must stay equal to BEDDING_STACK_H.madeUp in
  // three/Bedding.tsx or the whole stack renders at the wrong scale. The colour is the duvet cover's;
  // the mattress under it and the throw over it keep their own (a mattress is white and a contrasting
  // throw has to contrast). Neutral rather than cream on purpose: against the frame's warm Naggen
  // beige, cream bedding reads as one continuous object instead of white bedding on a beige bed.
  {
    id: 'beddingMadeUp',
    label: 'Bedding (made up)',
    defaultDims: { w: 180, d: 200, h: 72 },
    defaultColorHex: '#ecebe8',
  },
  { id: 'nightstand', label: 'Nightstand', defaultDims: { w: 40, d: 35, h: 50 }, defaultColorHex: '#8a6a4d' },
  { id: 'wardrobe', label: 'Wardrobe', defaultDims: { w: 100, d: 60, h: 220 }, defaultColorHex: '#e5e1d8' },
  // The specific PAX corner the user configured in IKEA's planner, at its own measured envelope
  // (210.5 × 210.4 × 236.4) rather than a generic size — see three/PaxWardrobe.tsx.
  {
    id: 'paxCorner',
    label: 'PAX corner wardrobe',
    defaultDims: { w: 210.5, d: 210.4, h: 236.4 },
    defaultColorHex: '#4a4a4c',
  },
  { id: 'desk', label: 'Desk', defaultDims: { w: 120, d: 60, h: 75 }, defaultColorHex: '#c9a876' },
  { id: 'chair', label: 'Chair', defaultDims: { w: 45, d: 50, h: 85 }, defaultColorHex: '#3b3f45' },
  { id: 'sofa', label: 'Sofa', defaultDims: { w: 200, d: 90, h: 80 }, defaultColorHex: '#6e655c' },
  // The Trentino U-bank at the shop's own 180 × 360 × 240 — the three legs of the U, so the
  // footprint is 360 × 240. Height is not published; 75 is the assumption, see three/TrentinoSofa.tsx.
  {
    id: 'trentinoU',
    label: 'Trentino U-sofa',
    defaultDims: { w: 360, d: 240, h: 75 },
    defaultColorHex: '#efe7da',
  },
  // The Solida as ordered from WoonSpot XXL — the catalog U's modules rebuilt as a corner at the
  // dimensions on the order sketch (20 arm | 80 | 80 | 110 lounge = 290, by 170 deep). Colour is
  // the ordered fabric, Top Textil Clara 215.04, sampled off its own swatch photo
  // (toptextil.pl/en/collection/clara — a warm ivory, and within 2/255 of the showroom photos it
  // used to be taken from). Height is the range's usual assumption. See three/SolidaSofa.tsx.
  {
    id: 'solidaOrdered',
    label: 'Solida (ordered)',
    defaultDims: { w: 290, d: 170, h: 75 },
    defaultColorHex: '#e8e3d5',
  },
  { id: 'armchair', label: 'Armchair', defaultDims: { w: 80, d: 85, h: 90 }, defaultColorHex: '#8a7c6c' },
  { id: 'coffeeTable', label: 'Coffee table', defaultDims: { w: 100, d: 55, h: 40 }, defaultColorHex: '#5b3f2c' },
  { id: 'diningTable', label: 'Dining table', defaultDims: { w: 140, d: 80, h: 75 }, defaultColorHex: '#c9a876' },
  { id: 'diningChair', label: 'Dining chair', defaultDims: { w: 45, d: 50, h: 85 }, defaultColorHex: '#2e2b28' },
  { id: 'tvConsole', label: 'TV console', defaultDims: { w: 140, d: 40, h: 45 }, defaultColorHex: '#3f2c20' },
  { id: 'bookshelf', label: 'Bookshelf', defaultDims: { w: 80, d: 30, h: 180 }, defaultColorHex: '#e8e4da' },
  { id: 'rug', label: 'Rug', defaultDims: { w: 200, d: 140, h: 1 }, defaultColorHex: '#a9967f' },
  // One specific rug rather than an archetype: IKEA's ONSEVIG (706.267.44, EUR 99), round Ø160 low
  // pile in the multicolour medallion pattern. IKEA publishes only the diameter, so the 10 mm of
  // pile is read off "low pile" — see three/OnsevigRug.tsx. The colour is its cream ground, which is
  // all that shows while the product photo loads.
  {
    id: 'onsevigRug',
    label: 'ONSEVIG rug Ø160',
    defaultDims: { w: 160, d: 160, h: 1 },
    defaultColorHex: '#e6ded0',
  },
  // One specific product rather than an archetype, like the PAX corner and the Solida: Sony's
  // Digital Edition (358 × 80 × 216 mm) standing on the vertical stand, so the footprint is the
  // stand's round foot and the height includes it. See three/PlayStation5.tsx.
  {
    id: 'ps5',
    label: 'PlayStation 5 Digital',
    defaultDims: { w: 10, d: 21.6, h: 37.4 },
    defaultColorHex: '#f1f0ee',
  },
  // The TV the user is buying, at Coolblue's own figures for it: 95 x 55 panel, 60 tall and 18.4
  // deep once it is on its two V feet. See three/TclTv.tsx.
  {
    id: 'tclTv43',
    label: 'TCL 43" QLED P71K',
    defaultDims: { w: 95, d: 18.4, h: 60 },
    defaultColorHex: '#15161a',
  },
  // The same console lying flat on its two pads, which is the orientation that actually fits under
  // a TV: the long side runs across (35.8), the depth is unchanged, and the height is the console's
  // 8 cm width plus the pads.
  {
    id: 'ps5Flat',
    label: 'PlayStation 5 (lying)',
    defaultDims: { w: 35.8, d: 21.6, h: 9.2 },
    defaultColorHex: '#f1f0ee',
  },
];

/**
 * The WoonSpot XXL sofa range, as library entries. Kept out of CATALOG so the "Basic shapes" grid
 * stays a grid of generic archetypes — these are 19 specific products and get their own section,
 * with the shop's price alongside (see lib/woonspotSofas.ts for the dimensions' provenance).
 */
export const WOONSPOT_CATALOG: (CatalogEntry & { priceEUR: number; slug: string })[] =
  WOONSPOT_SOFAS.map((s) => ({
    id: s.id,
    label: s.label,
    defaultDims: { w: s.w, d: s.d, h: s.h },
    defaultColorHex: s.colorHex,
    priceEUR: s.priceEUR,
    slug: s.slug,
  }));

/**
 * The WoonSpot XXL boxspring range, as library entries. Every model is planned at the 160 × 200
 * mattress; the footprint is that plus the headboard's depth, and the width is the headboard's
 * where that reaches past the mattress (it usually does). Height is the top of the headboard.
 */
export const WOONSPOT_BED_CATALOG: (CatalogEntry & { priceEUR: number; slug: string })[] =
  WOONSPOT_BEDS.map((b) => ({
    id: b.id,
    label: b.label,
    defaultDims: {
      w: Math.max(BED_BASE_W, b.headW),
      d: BED_BASE_D + b.headT,
      h: b.headH,
    },
    defaultColorHex: b.colorHex,
    priceEUR: b.priceEUR,
    slug: b.slug,
  }));

export const CUSTOM_SHAPES: CatalogEntry[] = [
  { id: 'box', label: 'Box', defaultDims: { w: 60, d: 60, h: 60 }, defaultColorHex: '#7a7166', custom: true },
  { id: 'cylinder', label: 'Cylinder', defaultDims: { w: 50, d: 50, h: 60 }, defaultColorHex: '#7a7166', custom: true },
];

export function catalogEntry(id: string): CatalogEntry {
  return (
    CATALOG.find((c) => c.id === id) ??
    WOONSPOT_CATALOG.find((c) => c.id === id) ??
    WOONSPOT_BED_CATALOG.find((c) => c.id === id) ??
    CUSTOM_SHAPES.find((c) => c.id === id) ?? {
      id: 'box',
      label: 'Item',
      defaultDims: { w: 60, d: 60, h: 60 },
      defaultColorHex: '#7a7166',
    }
  );
}
