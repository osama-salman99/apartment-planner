/**
 * Every measurable length in the apartment, derived from the geometry in `dimensions.ts` so the
 * two can never drift apart. Lengths are reported in whole centimetres — that is the unit you
 * actually shop and build in, and the werktekening prints millimetres, so nothing is lost.
 *
 * All measurements are CLEAR dimensions between finished faces, not wall centrelines. Walls are
 * no longer all the same thickness (250 outside, 70 for partitions), so each face is taken from
 * that wall's own thickness rather than one global half-width.
 */

import {
  WIDTH,
  DEPTH,
  EXTERIOR_WALL,
  PARTITION,
  CEILING_HEIGHT,
  IN_X0,
  IN_X1,
  IN_Z0,
  IN_Z1,
  BEDROOM_WEST_X,
  BEDROOM_SOUTH_Z,
  BATH_WEST_X,
  BATH_SPLIT_X,
  SPLIT_WALL_T,
  BATH_NORTH_Z,
  BATH_NORTH_WALL_T,
  WC_SOUTH_Z,
  UTILITY_SOUTH_Z,
  CUPBOARD_NORTH_Z,
  CUPBOARD_WALL_T_UTILITY,
  CUPBOARD_WALL_T_SHAFT,
  CUPBOARD_DIVIDER_X,
  SHOWER,
  SOLID_VOIDS,
  SV_X1,
  GV_X0,
  GLAZED_WINDOWS,
  GLAZED_DOOR_HEIGHT,
  WINDOW_SILL,
  DOOR_OPENINGS,
  WALLS,
} from './dimensions';

export { IN_X0, IN_X1, IN_Z0, IN_Z1 };

/** Half a partition — the offset from an internal centreline to either finished face. */
const P = PARTITION / 2;

export type DimKind = 'overall' | 'room' | 'facade' | 'opening' | 'position' | 'fixture' | 'wall';

export interface DimLine {
  /** The direction the measurement runs. */
  axis: 'x' | 'z';
  /** The perpendicular coordinate: z for an 'x' run, x for a 'z' run. */
  at: number;
  from: number;
  to: number;
  kind: DimKind;
  /** Perpendicular shift applied to the figure only, so it clears the wall it measures. */
  off?: number;
  /** Overrides the figure. Used where a length alone doesn't say enough (a wall's run AND its thickness). */
  label?: string;
  /**
   * Where along the run the figure sits, 0..1, default the middle.
   *
   * Every other overlay puts its figure at the midpoint, which is exactly where a wall's thickness
   * landed too — so a partition's `7` sat under the door position or room figure beside it, and on a
   * phone the two were one unreadable blob. Wall figures take a quarter-point instead; the line and
   * its ticks are unchanged, so nothing about what is being measured moves.
   */
  bias?: number;
}

export interface RoomRect {
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/**
 * Metres to centimetres, carrying the tenth — i.e. exact to the millimetre the drawing prints.
 *
 * Whole centimetres threw away real information (a 985 door is 98.5, not 99, and the difference is
 * a fifth of a wall thickness) and turned floating-point noise into a visible inconsistency: the
 * two identical 985 doors come out of chain arithmetic, one landing on 0.9849999999999994, so
 * rounding straight to cm printed them as 98 and 99 side by side. Snapping to mm first fixes both.
 */
export const cm = (metres: number): number => Math.round(metres * 1000) / 10;

/**
 * A figure as it appears on the plan. A bare `.0` is noise on a drawing this crowded — it adds two
 * glyphs to every whole figure and buys nothing — so it is dropped, and only real tenths show.
 */
export const cmLabel = (metres: number): string => {
  const v = cm(metres);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
export const areaM2 = (r: RoomRect): number => (r.x2 - r.x1) * (r.z2 - r.z1);

/**
 * Clear floor rectangles, face to face. The open living column is measured as two rectangles
 * because it genuinely changes width: it is 3.00 m alongside the bedroom and steps out to 3.45 m
 * once the bedroom's head wall ends — the single most useful fact for planning the kitchen end.
 */
export const ROOM_RECTS: RoomRect[] = [
  { name: 'Living / dining', x1: IN_X0, z1: IN_Z0, x2: BEDROOM_WEST_X - P, z2: BEDROOM_SOUTH_Z + P },
  { name: 'Kitchen / entrance', x1: IN_X0, z1: BEDROOM_SOUTH_Z + P, x2: BATH_WEST_X - P, z2: IN_Z1 },
  { name: 'Bedroom', x1: BEDROOM_WEST_X + P, z1: IN_Z0, x2: IN_X1, z2: BEDROOM_SOUTH_Z - P },
  // The bathroom is an L: full 1930 width up to where the shower partition starts, then a 930 recess
  // in the party-wall corner holding the shower. Measured as two rectangles because that is what it is.
  { name: 'Bathroom', x1: BATH_WEST_X + P, z1: BEDROOM_SOUTH_Z + P, x2: IN_X1, z2: WC_SOUTH_Z - P },
  // Bounded by the 70 shower partition, not by the 100 wall above it, and 900 deep — measured off
  // the wrong wall it came out 900 × 585.
  { name: 'Shower recess', x1: SHOWER.x0, z1: SHOWER.z0, x2: SHOWER.x1, z2: SHOWER.z1 },
  // The duct and the shaft come straight from SOLID_VOIDS — the same rectangles the shell fills in
  // solid — so the figure and the block can't disagree about how much space they steal.
  ...SOLID_VOIDS,
  {
    name: 'Utility',
    x1: BATH_WEST_X + P,
    z1: UTILITY_SOUTH_Z + P,
    x2: BATH_SPLIT_X - SPLIT_WALL_T / 2,
    z2: CUPBOARD_NORTH_Z - CUPBOARD_WALL_T_UTILITY,
  },
  // Both entered off the gallery: storage is the wide one, service the narrow one.
  { name: 'Storage', x1: CUPBOARD_DIVIDER_X + 0.025, z1: CUPBOARD_NORTH_Z, x2: SV_X1, z2: IN_Z1 },
  { name: 'Service', x1: GV_X0, z1: CUPBOARD_NORTH_Z, x2: CUPBOARD_DIVIDER_X - 0.025, z2: IN_Z1 },
];

/**
 * The fitted kitchen run: 3000 long against the gable, 600 deep — both printed. It starts hard
 * against the gallery wall, which is where the drawing puts the fridge, and runs 3000 north from
 * there; it was modelled 130 short of that wall.
 *
 * It gets its own dimensions because it is the only built-in furniture in the flat, and its two
 * figures decide the whole kitchen end: how much gable wall is left, and how much clear floor is
 * left in front of it. Must stay in step with FixedFixtures.
 */
export const KITCHEN_RUN = { x0: IN_X0, x1: IN_X0 + 0.6, z0: IN_Z1 - 3.0, z1: IN_Z1 };

export function kitchenDims(): DimLine[] {
  return [
    // the 3000 run, read off its front face into the room
    { axis: 'z', at: KITCHEN_RUN.x1 + 0.13, from: KITCHEN_RUN.z0, to: KITCHEN_RUN.z1, kind: 'fixture', off: 0.2 },
    // the 600 depth
    { axis: 'x', at: 6.45, from: KITCHEN_RUN.x0, to: KITCHEN_RUN.x1, kind: 'fixture', off: 0.2 },
  ];
}

/** Overall interior width and depth, drawn clear of the building. */
export const OVERALL: DimLine[] = [
  { axis: 'x', at: -0.62, from: IN_X0, to: IN_X1, kind: 'overall' },
  { axis: 'z', at: -0.62, from: IN_Z0, to: IN_Z1, kind: 'overall' },
];

/**
 * Running chains across the two glazed walls: pier, window, pier… Reading them as chains is what
 * tells you where a bed or a sofa can sit without blocking glass. The façade carries the printed
 * 284 | 2060 | 790 | 2060 | 256; the gable carries the third 2060.
 */
export function facadeChain(): DimLine[] {
  const out: DimLine[] = [];
  const push = (axis: 'x' | 'z', at: number, stops: number[]) => {
    for (let i = 0; i < stops.length - 1; i++) {
      if (stops[i + 1] - stops[i] < 0.06) continue; // skip slivers at a corner
      out.push({ axis, at, from: stops[i], to: stops[i + 1], kind: 'facade' });
    }
  };
  const north = GLAZED_WINDOWS.filter((w) => w.axis === 'x').sort((a, b) => a.from - b.from);
  push('x', -0.26, [IN_X0, ...north.flatMap((w) => [w.from, w.to]), IN_X1]);
  const west = GLAZED_WINDOWS.filter((w) => w.axis === 'z').sort((a, b) => a.from - b.from);
  push('z', -0.26, [IN_Z0, ...west.flatMap((w) => [w.from, w.to]), IN_Z1]);
  return out;
}

/**
 * Every wall that carries a door, and the two finished faces its dimension chain runs between.
 * `off` pushes the figures clear of the wall — the internal walls read into the open living side,
 * the gallery wall reads outside the building, which is where a drafter would put it.
 *
 * The bathroom's own 900 door is deliberately absent: its position is the one opening on the
 * drawing that is scaled rather than printed, and a chain inside a 93-wide room would both imply
 * precision it hasn't got and land three figures on top of each other.
 */
const DOOR_WALLS: { axis: 'x' | 'z'; at: number; from: number; to: number; off: number }[] = [
  // Bedroom partition, chained inside the bedroom from the head wall to the façade.
  { axis: 'z', at: BEDROOM_WEST_X, from: BEDROOM_SOUTH_Z - P, to: IN_Z0, off: -0.19 },
  // Bath-block partition: the drawing's printed 522 | 985 | 945 | 985 | 193 = 3630.
  { axis: 'z', at: BATH_WEST_X, from: IN_Z1, to: BEDROOM_SOUTH_Z + P, off: -0.19 },
  // Gallery wall: the front door, then the two meter-cupboard fronts.
  { axis: 'x', at: IN_Z1, from: IN_X0, to: IN_X1, off: 0.3 },
];

/**
 * Where the doors ARE, not just how wide they are: a running chain along each wall that carries a
 * door — wall, opening, wall, opening, wall — so the figure you need ("how much clear wall is there
 * beside this door") is on screen instead of being arithmetic on two other numbers.
 *
 * This supersedes measuring the openings on their own: the chain already contains every opening
 * width, and drawing both put two figures on the same spot.
 */
export function doorPositionDims(): DimLine[] {
  const out: DimLine[] = [];
  for (const w of DOOR_WALLS) {
    // A DOOR_OPENING's axis names the wall it sits in; the measurement runs along that wall. The
    // gallery-wall openings are recorded on the wall centreline while the chain runs along its
    // interior face, hence the tolerance rather than an exact match.
    const openings = DOOR_OPENINGS.filter(
      (o) => o.axis === w.axis && Math.abs(o.at - w.at) < 0.2,
    ).sort((a, b) => a.from - b.from);
    const stops = [
      Math.min(w.from, w.to),
      ...openings.flatMap((o) => [o.from, o.to]),
      Math.max(w.from, w.to),
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      // Slivers (the 46 between the two meter cupboards) have no room for a figure.
      if (stops[i + 1] - stops[i] < 0.06) continue;
      out.push({
        axis: w.axis,
        at: w.at,
        from: stops[i],
        to: stops[i + 1],
        // stops alternate solid / opening / solid, starting on a solid run.
        kind: i % 2 === 1 ? 'opening' : 'position',
        off: w.off,
      });
    }
  }
  return out;
}

/** The two dimension lines for a room: its width along the north edge, depth along the west. */
export function roomDims(r: RoomRect): DimLine[] {
  const inset = Math.min(0.16, (r.z2 - r.z1) / 3, (r.x2 - r.x1) / 3);
  return [
    { axis: 'x', at: r.z1 + inset, from: r.x1, to: r.x2, kind: 'room' },
    { axis: 'z', at: r.x1 + inset, from: r.z1, to: r.z2, kind: 'room' },
  ];
}

/**
 * A room narrower than this can't hold two dimension lines without the figures landing on top of
 * each other — the cupboards, the WC and the bathroom are all under a metre one way. Those read
 * as a single `93 × 236` block at the room's centre instead.
 */
const COMPACT_BELOW = 0.95;

export interface RoomBlock {
  name: string;
  x: number;
  z: number;
  w: string;
  d: string;
}

const isCompact = (r: RoomRect) => Math.min(r.x2 - r.x1, r.z2 - r.z1) < COMPACT_BELOW;

export const COMPACT_ROOMS: RoomBlock[] = staggerRows(
  ROOM_RECTS.filter(isCompact).map((r) => ({
    name: r.name,
    x: (r.x1 + r.x2) / 2,
    z: (r.z1 + r.z2) / 2,
    w: cmLabel(r.x2 - r.x1),
    d: cmLabel(r.z2 - r.z1),
  })),
);

/**
 * Chips for compact rooms that share a band across the drawing get spread apart within it.
 *
 * Storage and Service are both 357 deep, side by side off the gallery, so their figures came out on
 * exactly the same line 900 apart — which is closer than a `103.9 × 35.7` chip is wide, and on a
 * phone the two overlapped outright. Nothing moves on the desktop by more than a few pixels, and no
 * label leaves its own room: the spread is a fraction of the shallowest of them.
 */
function staggerRows(blocks: RoomBlock[]): RoomBlock[] {
  const BAND = 0.4; // how close in z counts as "the same line"
  const SPREAD = 0.26; // metres between two chips sharing one
  const rows = new Map<number, RoomBlock[]>();
  for (const b of blocks) {
    const key = Math.round(b.z / BAND);
    (rows.get(key) ?? rows.set(key, []).get(key)!).push(b);
  }
  for (const row of rows.values()) {
    if (row.length < 2) continue;
    row.sort((a, b) => a.x - b.x);
    row.forEach((b, i) => {
      b.z += (i - (row.length - 1) / 2) * SPREAD;
    });
  }
  return blocks;
}

export const ALL_DIMS: DimLine[] = [
  ...OVERALL,
  ...facadeChain(),
  ...ROOM_RECTS.filter((r) => !isCompact(r)).flatMap(roomDims),
  ...doorPositionDims(),
  ...kitchenDims(),
];

/**
 * Colour per kind of measurement. Lives here rather than in the renderer so the scene's lines and
 * the legend on the readout plate can never disagree about what a colour means.
 */
export const DIM_COLOR: Record<DimKind, string> = {
  overall: '#e0913f',
  facade: '#6fb3c9',
  room: '#dfe3e8',
  opening: '#8ad196',
  position: '#c79bd8',
  fixture: '#e6c86a',
  wall: '#7f8fa6',
};

/** What each colour in the overlay measures — rendered as the legend on the readout plate. */
export const DIM_LEGEND: { kind: DimKind; label: string }[] = [
  { kind: 'overall', label: 'Overall interior' },
  { kind: 'facade', label: 'Glazing chain' },
  { kind: 'room', label: 'Room, face to face' },
  { kind: 'opening', label: 'Door opening' },
  { kind: 'position', label: 'Wall beside a door' },
  { kind: 'fixture', label: 'Fitted kitchen' },
];

/** The legend rows that belong to the wall overlay, which has its own toggle. */
export const WALL_LEGEND: { kind: DimKind; label: string }[] = [
  { kind: 'wall', label: 'Wall thickness' },
];

/**
 * Floor area per room, computed from the same rectangles the dimension chains are drawn from — so a
 * figure on the plate can never disagree with the lines on the plan.
 *
 * The bathroom is one room in an L shape, so its recess is folded into it rather than listed as a
 * room of its own; the duct and the shaft are left out entirely because they are solid, not floor.
 * Ordered largest first, which is also the order that reads best as a list.
 *
 * These are CLEAR areas, face to face. They will not add up to the 50 m² the BAG records, which
 * measures to the middle of the party wall and counts the whole footprint — see the reference note
 * on the official area. The gap is the walls themselves, and it is the honest number for furniture.
 */
const AREA_ROOM: Record<string, { color: string; short: string }> = {
  'Living / dining': { color: '#4f9dd9', short: 'Living' },
  'Kitchen / entrance': { color: '#e3a93f', short: 'Kitchen' },
  Bedroom: { color: '#8d7ad6', short: 'Bed' },
  Bathroom: { color: '#48b39b', short: 'Bath' },
  Utility: { color: '#d9705f', short: 'Utility' },
  Storage: { color: '#b4c04a', short: 'Store' },
  Service: { color: '#c76fae', short: 'Service' },
};

export interface RoomArea {
  name: string;
  /** One word, for the phone's single chip row where the full name doesn't fit. */
  short: string;
  color: string;
  m2: number;
  /** Every rectangle that makes up the room — one for most, two for the L-shaped bathroom. */
  rects: RoomRect[];
}

export const ROOM_AREAS: RoomArea[] = Object.entries(AREA_ROOM)
  .map(([name, { color, short }]) => {
    const rects = ROOM_RECTS.filter((r) => r.name === name || (name === 'Bathroom' && r.name === 'Shower recess'));
    return { name, short, color, rects, m2: rects.reduce((sum, r) => sum + areaM2(r), 0) };
  })
  .filter((r) => r.rects.length > 0)
  .sort((a, b) => b.m2 - a.m2);

export const TOTAL_AREA_M2 = ROOM_AREAS.reduce((sum, r) => sum + r.m2, 0);

/**
 * Every wall's THICKNESS, on a separate toggle from the room dimensions.
 *
 * The two answer different questions and would fight for the same screen space if they shared a
 * switch: the room chains measure the SPACE you furnish, this measures the STRUCTURE around it —
 * which wall is a 250 party wall you cannot touch, which is a 70 partition, and which of the block's
 * walls are the 100s and 125s.
 *
 * The figure is the thickness alone. It carried the run length too (`308 · 7`), which read as a pair
 * of coordinates rather than a thickness and doubled the width of every label on the busiest overlay
 * in the app — and the run lengths are already on the room and chain dimensions.
 */
export function wallDims(): DimLine[] {
  const out: DimLine[] = [];
  for (const w of WALLS) {
    const vertical = Math.abs(w.x1 - w.x2) < 1e-6;
    const len = vertical ? Math.abs(w.z2 - w.z1) : Math.abs(w.x2 - w.x1);
    // Stubs shorter than this carry no readable figure — the sliver between the meter cupboards.
    if (len < 0.2) continue;
    const t = w.t ?? PARTITION;
    out.push({
      axis: vertical ? 'z' : 'x',
      at: vertical ? w.x1 : w.z1,
      from: vertical ? Math.min(w.z1, w.z2) : Math.min(w.x1, w.x2),
      to: vertical ? Math.max(w.z1, w.z2) : Math.max(w.x1, w.x2),
      kind: 'wall',
      label: cmLabel(t),
      bias: 0.28,
    });
  }
  return out;
}

export const WALL_DIMS: DimLine[] = wallDims();

/** Vertical dimensions — these have no place on a plan, so they read out as a small card. */
export const HEIGHTS: { label: string; cm: number }[] = [
  { label: 'Ceiling', cm: cm(CEILING_HEIGHT) },
  { label: 'Door head', cm: 205 },
  { label: 'Window head', cm: cm(GLAZED_DOOR_HEIGHT) },
  { label: 'Window sill', cm: cm(WINDOW_SILL) },
  { label: 'External wall', cm: cm(EXTERIOR_WALL) },
  { label: 'Partition', cm: cm(PARTITION) },
];

/** Handy totals for the readout panel. */
export const INTERIOR_AREA_M2 = (IN_X1 - IN_X0) * (IN_Z1 - IN_Z0);
export const ENVELOPE = { width: WIDTH, depth: DEPTH };
