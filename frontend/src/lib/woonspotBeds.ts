/**
 * The WoonSpot XXL boxspring range — https://woonspotxxl.nl/bedden/ (33 models, read 2026-08-09).
 *
 * What the shop actually publishes, and what it doesn't:
 *  - Every model is sold in exactly four sizes, 120/140/160/180 × 200 cm, price stepping up per
 *    size. Nothing else is quoted: no headboard height, no headboard width, no depth, no leg
 *    type. `priceEUR` here is the **160 × 200** price, since that is the size this planner
 *    defaults to.
 *  - So the headboard geometry below is **read off each model's own product photo**, not off a
 *    spec sheet: the style, roughly how far the headboard reaches past the mattress, and roughly
 *    how high it stands. Treat `headW` / `headH` / `headT` as ±10 cm, and the mattress footprint
 *    (which is quoted) as exact. A model whose headboard spans the whole wall in the photo gets a
 *    wide `headW` and `wings: 'panel'`; one with separate lit bedside units gets `wings: 'shelf'`.
 *  - `headW` is stated for the 160-wide base. Scaling a placed bed scales the two together.
 *
 * The photos also show benches, poufs and nightstands next to most beds. Those are separate
 * products and are not modelled here — only the bed itself.
 */

/** Headboard construction, as it reads in the product photo. */
export type BedHead =
  | 'flat' // one smooth upholstered panel
  | 'arched' // panel with a curved / domed top
  | 'vChannel' // vertical fluting, channels running floor-to-top
  | 'hPanel' // two or three stacked horizontal bands
  | 'panelGrid' // a grid of large square pads
  | 'buttoned' // capitonné: small diamond-tufted pads
  | 'bubble'; // fat rounded puffs, the "cloud" look

/** Whether the headboard grows sideways into bedside furniture. */
export type BedWings =
  | 'none' // headboard is about as wide as the bed
  | 'shelf' // separate lit bedside units flanking the headboard
  | 'panel'; // one continuous panel reaching well past the mattress

export interface WoonspotBedSpec {
  id: string;
  label: string;
  slug: string;
  head: BedHead;
  wings: BedWings;
  /** Overall headboard width in cm, for a 160-wide mattress. */
  headW: number;
  /** Top of the headboard above the floor, cm. */
  headH: number;
  /** Headboard depth, cm — this is what the bed's footprint gains over the 200 cm mattress. */
  headT: number;
  base: 'plinth' | 'legs';
  /** Softly rounded base corners rather than a crisp box. */
  round?: boolean;
  /** Price of the 160 × 200 size, incl. mattress. */
  priceEUR: number;
  colorHex: string;
}

const CREAM = '#efe7da';
const BEIGE = '#ddd0bd';

export const WOONSPOT_BEDS = [
  { id: 'arthurBed', label: 'Arthur', slug: 'boxspring-arthur', head: 'buttoned', wings: 'none', headW: 170, headH: 120, headT: 15, base: 'legs', priceEUR: 1395, colorHex: BEIGE },
  { id: 'athenaBed', label: 'Athena', slug: 'boxspring-athena', head: 'panelGrid', wings: 'shelf', headW: 260, headH: 105, headT: 18, base: 'legs', priceEUR: 1895, colorHex: CREAM },
  { id: 'auraBed', label: 'Aura', slug: 'boxspring-aura', head: 'hPanel', wings: 'panel', headW: 230, headH: 115, headT: 18, base: 'plinth', priceEUR: 1495, colorHex: '#c6b6a2' },
  { id: 'bellezaBed', label: 'Belleza', slug: 'boxspring-belleza', head: 'arched', wings: 'shelf', headW: 300, headH: 130, headT: 20, base: 'plinth', priceEUR: 1795, colorHex: '#efe9df' },
  { id: 'cancunBed', label: 'Cancun', slug: 'boxspring-cancun', head: 'hPanel', wings: 'shelf', headW: 240, headH: 110, headT: 18, base: 'plinth', priceEUR: 1395, colorHex: BEIGE },
  { id: 'cloudBed', label: 'Cloud', slug: 'boxspring-cloud', head: 'bubble', wings: 'none', headW: 200, headH: 95, headT: 25, base: 'plinth', round: true, priceEUR: 1995, colorHex: CREAM },
  { id: 'comoBed', label: 'Como', slug: 'boxspring-como', head: 'flat', wings: 'none', headW: 180, headH: 115, headT: 15, base: 'legs', priceEUR: 1195, colorHex: '#b8b6b2' },
  { id: 'curveBed', label: 'Curve', slug: 'boxspring-curve', head: 'arched', wings: 'none', headW: 175, headH: 110, headT: 16, base: 'plinth', round: true, priceEUR: 1495, colorHex: CREAM },
  { id: 'dianaBed', label: 'Diana', slug: 'boxspring-diana', head: 'flat', wings: 'panel', headW: 220, headH: 105, headT: 15, base: 'legs', priceEUR: 1695, colorHex: BEIGE },
  { id: 'elaraBed', label: 'Elara', slug: 'boxspring-elara', head: 'bubble', wings: 'none', headW: 190, headH: 90, headT: 25, base: 'plinth', round: true, priceEUR: 1495, colorHex: CREAM },
  { id: 'elenorBed', label: 'Elenor', slug: 'boxspring-elenor', head: 'panelGrid', wings: 'none', headW: 200, headH: 105, headT: 20, base: 'plinth', round: true, priceEUR: 1495, colorHex: CREAM },
  { id: 'julieBed', label: 'Julie', slug: 'boxspring-julie', head: 'vChannel', wings: 'shelf', headW: 260, headH: 125, headT: 18, base: 'legs', priceEUR: 1795, colorHex: '#cfd0cc' },
  { id: 'linaBed', label: 'Lina', slug: 'boxspring-lina', head: 'hPanel', wings: 'none', headW: 170, headH: 90, headT: 14, base: 'plinth', priceEUR: 1395, colorHex: CREAM },
  { id: 'lunaBed', label: 'Luna', slug: 'boxspring-luna', head: 'vChannel', wings: 'shelf', headW: 240, headH: 105, headT: 16, base: 'plinth', priceEUR: 1595, colorHex: CREAM },
  { id: 'marsilyaBed', label: 'Marsilya', slug: 'boxspring-marsilya', head: 'hPanel', wings: 'panel', headW: 300, headH: 150, headT: 20, base: 'plinth', priceEUR: 2295, colorHex: '#cbbba6' },
  { id: 'modernaBed', label: 'Moderna', slug: 'boxspring-moderna', head: 'panelGrid', wings: 'panel', headW: 300, headH: 140, headT: 20, base: 'legs', priceEUR: 2095, colorHex: CREAM },
  { id: 'monacoBed', label: 'Monaco', slug: 'boxspring-monaco', head: 'flat', wings: 'shelf', headW: 220, headH: 100, headT: 16, base: 'plinth', priceEUR: 1695, colorHex: BEIGE },
  { id: 'monzaBed', label: 'Monza', slug: 'boxspring-monza', head: 'buttoned', wings: 'none', headW: 190, headH: 120, headT: 15, base: 'legs', priceEUR: 1295, colorHex: CREAM },
  { id: 'moonBed', label: 'Moon', slug: 'boxspring-moon', head: 'arched', wings: 'none', headW: 185, headH: 110, headT: 18, base: 'legs', priceEUR: 1495, colorHex: CREAM },
  { id: 'noorBed', label: 'Noor', slug: 'boxspring-noor', head: 'flat', wings: 'shelf', headW: 260, headH: 110, headT: 18, base: 'plinth', priceEUR: 1895, colorHex: BEIGE },
  { id: 'noraBed', label: 'Nora', slug: 'boxspring-nora', head: 'vChannel', wings: 'none', headW: 180, headH: 115, headT: 16, base: 'legs', priceEUR: 1495, colorHex: '#4a4f55' },
  { id: 'orlaBed', label: 'Orla', slug: 'boxspring-orla', head: 'vChannel', wings: 'panel', headW: 230, headH: 105, headT: 15, base: 'legs', priceEUR: 1195, colorHex: CREAM },
  { id: 'osloBed', label: 'Oslo', slug: 'boxspring-oslo', head: 'flat', wings: 'panel', headW: 280, headH: 115, headT: 18, base: 'plinth', priceEUR: 1995, colorHex: CREAM },
  { id: 'pacoBed', label: 'Paco', slug: 'boxspring-paco', head: 'bubble', wings: 'none', headW: 175, headH: 100, headT: 20, base: 'legs', round: true, priceEUR: 1195, colorHex: CREAM },
  { id: 'parosBed', label: 'Paros', slug: 'boxspring-paros', head: 'flat', wings: 'none', headW: 200, headH: 95, headT: 15, base: 'legs', priceEUR: 1495, colorHex: CREAM },
  { id: 'piannoBed', label: 'Pianno', slug: 'boxspring-pianno', head: 'vChannel', wings: 'none', headW: 200, headH: 130, headT: 16, base: 'plinth', priceEUR: 1295, colorHex: CREAM },
  { id: 'rodosBed', label: 'Rodos', slug: 'boxspring-rodos', head: 'bubble', wings: 'panel', headW: 230, headH: 100, headT: 25, base: 'plinth', round: true, priceEUR: 1595, colorHex: CREAM },
  { id: 'shakiraBed', label: 'Shakira', slug: 'boxspring-shakira', head: 'flat', wings: 'none', headW: 180, headH: 100, headT: 18, base: 'plinth', round: true, priceEUR: 1395, colorHex: BEIGE },
  { id: 'sofiBed', label: 'Sofi', slug: 'boxspring-sofi', head: 'vChannel', wings: 'panel', headW: 320, headH: 120, headT: 20, base: 'plinth', priceEUR: 2695, colorHex: CREAM },
  { id: 'toscoBed', label: 'Tosco', slug: 'boxspring-tosco', head: 'bubble', wings: 'none', headW: 190, headH: 100, headT: 22, base: 'plinth', round: true, priceEUR: 1795, colorHex: CREAM },
  { id: 'vestaBed', label: 'Vesta', slug: 'boxspring-vesta', head: 'buttoned', wings: 'none', headW: 200, headH: 115, headT: 16, base: 'legs', priceEUR: 1595, colorHex: '#8b8b8b' },
  { id: 'zenaBed', label: 'Zena', slug: 'boxspring-zena', head: 'bubble', wings: 'none', headW: 200, headH: 105, headT: 24, base: 'plinth', round: true, priceEUR: 1695, colorHex: CREAM },
  { id: 'zyrenBed', label: 'Zyren', slug: 'boxspring-zyren', head: 'arched', wings: 'none', headW: 180, headH: 105, headT: 16, base: 'plinth', round: true, priceEUR: 1495, colorHex: CREAM },
] as const satisfies readonly WoonspotBedSpec[];

export type WoonspotBedId = (typeof WOONSPOT_BEDS)[number]['id'];

/** Mattress width this range is planned at; the other quoted sizes are 120 / 140 / 180. */
export const BED_BASE_W = 160;
/** Mattress length — every model in the range is 200 cm long. */
export const BED_BASE_D = 200;

const BY_ID = new Map<string, WoonspotBedSpec>(WOONSPOT_BEDS.map((b) => [b.id, b]));

export function woonspotBed(id: string): WoonspotBedSpec | undefined {
  return BY_ID.get(id);
}
