/**
 * The WoonSpot XXL sofa range (https://woonspotxxl.nl/product-category/banken/) — all 20 models,
 * as their own archetypes rather than the generic `sofa` box.
 *
 * WHERE THE NUMBERS COME FROM. Each product page prints exactly one spec line under
 * "Afmetingen & prijzen" and nothing else — no height, no seat height, no seat depth, just the plan
 * dimensions and the price. Those are quoted the way Dutch shops quote a hoek/U-bank:
 *   - three numbers `A × B × C` = the three legs of a U — B is the middle run, A and C the wings,
 *     so the footprint is B wide × max(A, C) deep and the wings are deliberately unequal;
 *   - two numbers = the two legs of an L / chaise, so the footprint is the longer × the shorter.
 * `w`/`d` below are that footprint, `shortWing` the shallow leg of a U. Nothing here is guessed
 * from a render — only the classification of the silhouette is (see `layout` below).
 *
 * HEIGHT IS AN ASSUMPTION for every model: 75 cm overall with a 42 cm seat, which is typical of
 * this low, chunky style and is what the renders scale to against the coffee tables beside them.
 * Edit an item's H field if the shop confirms otherwise.
 *
 * The Trentino U-bank is in this range too, but it shipped earlier as its own hand-built component
 * (`three/TrentinoSofa.tsx`, shape `trentinoU`) and stays that way — it is the one model the user
 * has actually placed, so it is deliberately not re-derived from this table.
 *
 * The Solida is in the table as the shop's own U-bank (`solidaU`), but the one the user ORDERED is
 * those modules re-arranged into a corner at 290 × 170 — a different silhouette with a different
 * construction, so it too is its own component (`three/SolidaSofa.tsx`, shape `solidaOrdered`).
 */

export type SofaLayout =
  /** Back along the whole run, one open chaise platform off one end — no back, no arm on it. */
  | 'chaise'
  /** Hoekbank: the back turns the corner and carries on down the wing. */
  | 'corner'
  /** Back along the whole run with a wing (and its arm) off BOTH ends. */
  | 'u';

/** How the upholstery is broken up. All three are the same puff grid at different coarseness. */
export type SofaQuilt =
  /** Trentino-family marshmallow quilting: small puffs, two courses everywhere. */
  | 'bubble'
  /** Distinct big seat and back cushions — the most common look in the range. */
  | 'panel'
  /** Tight upholstery: one smooth mass per element, seat cushions only. */
  | 'tight';

export interface WoonspotSofaSpec {
  /** Also the FurnitureShape id. */
  id: string;
  label: string;
  /** Slug on woonspotxxl.nl, so the model is traceable back to its page. */
  slug: string;
  layout: SofaLayout;
  /** Which side carries the deep wing / chaise, looking at the front of the sofa. */
  deepSide: 'left' | 'right';
  /** Footprint, cm — straight off the page's spec line. */
  w: number;
  d: number;
  /** The shallow leg of a U, cm. Absent for chaise/corner. */
  shortWing?: number;
  /** Assumed, not published — see the note above. */
  h: number;
  quilt: SofaQuilt;
  /** Recessed dark plinth vs the thin black metal legs some models stand on. */
  legs: 'plinth' | 'metal';
  /** The far end of the deep wing is a rounded module (a quarter/half circle on plan). */
  roundEnd?: boolean;
  priceEUR: number;
  colorHex: string;
}

/** Every model's height comes from the same assumption, so it is not repeated 19 times. */
const H = 75;
/** The range is almost entirely cream bouclé. */
const CREAM = '#efe7da';

export const WOONSPOT_SOFAS = [
  {
    id: 'aylaLounge', label: 'Ayla Loungebank', slug: 'ayla-loungebank',
    layout: 'chaise', deepSide: 'right', w: 270, d: 190, h: H,
    quilt: 'panel', legs: 'plinth', priceEUR: 1795, colorHex: CREAM,
  },
  {
    id: 'bergamoLounge', label: 'Bergamo Loungebank', slug: 'bergamo-loungebank',
    layout: 'chaise', deepSide: 'right', w: 280, d: 235, h: H,
    quilt: 'panel', legs: 'metal', priceEUR: 1395, colorHex: CREAM,
  },
  {
    id: 'capriLounge', label: 'Capri Loungebank', slug: 'capri-loungebank',
    layout: 'chaise', deepSide: 'right', w: 305, d: 150, h: H,
    quilt: 'panel', legs: 'plinth', roundEnd: true, priceEUR: 1195, colorHex: CREAM,
  },
  {
    // 260 × 380 × 150: middle run 380, deep wing 260, shallow wing 150.
    id: 'capriU', label: 'Capri U-bank', slug: 'capri-u-bank',
    layout: 'u', deepSide: 'right', w: 380, d: 260, shortWing: 150, h: H,
    quilt: 'panel', legs: 'plinth', roundEnd: true, priceEUR: 1695, colorHex: CREAM,
  },
  {
    id: 'deniseLounge', label: 'Denise Loungebank', slug: 'denise-loungebank',
    layout: 'chaise', deepSide: 'left', w: 350, d: 235, h: H,
    quilt: 'tight', legs: 'plinth', roundEnd: true, priceEUR: 1595, colorHex: CREAM,
  },
  {
    // 170 × 335 × 230: middle 335, deep wing 230, shallow 170.
    id: 'luganoU', label: 'Lugano U-bank', slug: 'lugano-u-bank',
    layout: 'u', deepSide: 'right', w: 335, d: 230, shortWing: 170, h: H,
    quilt: 'panel', legs: 'plinth', priceEUR: 1495, colorHex: CREAM,
  },
  {
    id: 'majesticCorner', label: 'Majestic Hoekbank', slug: 'majestic-hoekbank',
    layout: 'corner', deepSide: 'right', w: 290, d: 290, h: H,
    quilt: 'tight', legs: 'metal', priceEUR: 1695, colorHex: '#e8e2d6',
  },
  {
    // Sold as a U-bank but quoted with two numbers, so it is planned as the L it measures.
    id: 'marbellaU', label: 'Marbella U-bank', slug: 'marbella-u-bank',
    layout: 'chaise', deepSide: 'right', w: 400, d: 170, h: H,
    quilt: 'panel', legs: 'plinth', roundEnd: true, priceEUR: 2895, colorHex: CREAM,
  },
  {
    // 230 × 405 × 205.
    id: 'mioU', label: 'Mio U-bank', slug: 'mio-ubank',
    layout: 'u', deepSide: 'right', w: 405, d: 230, shortWing: 205, h: H,
    quilt: 'panel', legs: 'metal', priceEUR: 2895, colorHex: CREAM,
  },
  {
    id: 'monacoLounge', label: 'Monaco Loungebank', slug: 'monaco-loungebank',
    layout: 'chaise', deepSide: 'right', w: 280, d: 230, h: H,
    quilt: 'tight', legs: 'metal', priceEUR: 1195, colorHex: CREAM,
  },
  {
    // 225 × 400 × 225 — the only symmetric U in the range.
    id: 'monzaU', label: 'Monza U-bank', slug: 'monza-ubank',
    layout: 'u', deepSide: 'right', w: 400, d: 225, shortWing: 225, h: H,
    quilt: 'panel', legs: 'metal', priceEUR: 2695, colorHex: '#b9a898',
  },
  {
    id: 'osloLounge', label: 'Oslo Loungebank', slug: 'oslo-loungebank',
    layout: 'chaise', deepSide: 'left', w: 280, d: 240, h: H,
    quilt: 'panel', legs: 'plinth', priceEUR: 1495, colorHex: CREAM,
  },
  {
    // 160 × 415 × 150 — the longest run in the range on the shallowest wings.
    id: 'palermoU', label: 'Palermo U-bank', slug: 'palermo-ubank',
    layout: 'u', deepSide: 'left', w: 415, d: 160, shortWing: 150, h: H,
    quilt: 'panel', legs: 'metal', roundEnd: true, priceEUR: 1795, colorHex: CREAM,
  },
  {
    id: 'parisLounge', label: 'Paris Loungebank', slug: 'paris-loungebank',
    layout: 'chaise', deepSide: 'right', w: 310, d: 156, h: H,
    quilt: 'bubble', legs: 'plinth', priceEUR: 1295, colorHex: CREAM,
  },
  {
    id: 'romeLounge', label: 'Rome Loungebank', slug: 'rome-loungebank',
    layout: 'corner', deepSide: 'left', w: 320, d: 245, h: H,
    quilt: 'panel', legs: 'plinth', priceEUR: 1395, colorHex: '#d8cbb6',
  },
  {
    // 170 × 390 × 230, and curved at both ends.
    id: 'solidaU', label: 'Solida U-bank', slug: 'solida-ubank',
    layout: 'u', deepSide: 'right', w: 390, d: 230, shortWing: 170, h: H,
    quilt: 'tight', legs: 'plinth', roundEnd: true, priceEUR: 2595, colorHex: CREAM,
  },
  {
    id: 'torinoCorner', label: 'Torino Hoekbank', slug: 'torino-hoekbank',
    layout: 'corner', deepSide: 'left', w: 335, d: 260, h: H,
    quilt: 'tight', legs: 'plinth', priceEUR: 1495, colorHex: CREAM,
  },
  {
    // The Trentino U-bank's two-seat sibling: same marshmallow quilting, one chaise.
    id: 'trentinoLounge', label: 'Trentino Loungebank', slug: 'trentino-loungebank',
    layout: 'chaise', deepSide: 'left', w: 300, d: 180, h: H,
    quilt: 'bubble', legs: 'plinth', priceEUR: 1395, colorHex: CREAM,
  },
  {
    id: 'valenciaCorner', label: 'Valencia Hoekbank', slug: 'valencia-hoekbank',
    layout: 'corner', deepSide: 'right', w: 325, d: 280, h: H,
    quilt: 'tight', legs: 'plinth', priceEUR: 1895, colorHex: CREAM,
  },
] as const satisfies readonly WoonspotSofaSpec[];

export type WoonspotSofaId = (typeof WOONSPOT_SOFAS)[number]['id'];

const BY_ID = new Map<string, WoonspotSofaSpec>(WOONSPOT_SOFAS.map((s) => [s.id, s]));

/** The spec for a shape id, or undefined if it isn't one of these sofas. */
export function woonspotSofa(id: string): WoonspotSofaSpec | undefined {
  return BY_ID.get(id);
}
