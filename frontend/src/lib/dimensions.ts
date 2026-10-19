/**
 * Apartment geometry.
 *
 * SOURCE: the dimensioned construction drawing (werktekening) for this unit.
 * Unlike an estate-agent plan, that drawing prints its dimensions in millimetres, so almost
 * every number below is READ OFF THE DRAWING rather than scaled off pixels. Anything that was
 * still scaled is marked `SCALED` in a comment and is good to roughly ±5 cm.
 *
 * Printed and load-bearing on everything else:
 *   interior envelope   5450 × 9155         (structural bay 5700 = 5450 + 250 party wall)
 *   depth chain         3630 + 70 + 5455  = 9155
 *   width, front half   1930 + 70 + 3450  = 5450
 *   width, rear half    2380 + 70 + 3000  = 5450
 *
 * The living room is therefore an L, not a rectangle: it is 3450 wide alongside the bathroom
 * block and steps in by 450 to 3000 once the bedroom starts. Interior floor area 49,90 m².
 *
 * FRAME: origin = the outer corner where the façade meets the gable. +X east, +Z south. The
 * window façade is the NORTH wall (z ≈ 0), the gallery/front door the SOUTH wall (z ≈ DEPTH),
 * the blind party wall is EAST, and the second external wall — the gable, with the corner
 * glazing and the kitchen run against it — is WEST. Metres, wall centrelines.
 *
 * The drawing is read with the gallery at the top and the party wall on the left; this file is
 * that drawing turned through 180°, which is a rotation (not a mirror), so the hand is the real
 * one. To go from a drawing dimension to this frame: x = 5.70 − u, z = 9.405 − v.
 *
 * LAYOUT: the open living/kitchen is the WEST column and runs the full depth, with the kitchen's
 * 3000 straight run (5 × 600 modules) against the gable at the gallery end. The EAST column holds
 * the bedroom at the façade end and, beyond its head wall, the bathroom block at the gallery end.
 * That block is ONE bathroom across the full 1930 — toilet, basin and shower together — plus, at the
 * gallery end only, a 1030-deep utility holding the washing machine, a 200 soil-stack duct behind the
 * toilet, a sealed 900 × 675 services shaft, and the storage and service cupboards, which are entered
 * from the gallery and so cost no interior floor. The front door opens straight into the
 * living/kitchen: there is no hall.
 */

export const CEILING_HEIGHT = 2.6; // NOT on the drawing — a plan never carries it. Needs the section.

/** Structural/party/external walls, printed as the 250 in `constructie 5450 + 250`. */
export const EXTERIOR_WALL = 0.25;
/** Internal partitions, printed as 70 throughout. */
export const PARTITION = 0.07;
/** Default for anything that doesn't name its own thickness. */
export const WALL_THICKNESS = PARTITION;

// Outer envelope: the 5450 × 9155 interior plus a 250 wall on each side.
export const WIDTH = 5.95;
export const DEPTH = 9.655;

/** Interior faces of the envelope — the numbers you actually measure a sofa against. */
export const IN_X0 = 0.25; // gable (west)
export const IN_X1 = 5.7; // party wall (east)
export const IN_Z0 = 0.25; // façade (north)
export const IN_Z1 = 9.405; // gallery (south)

// --- reference lines (m, centrelines) ---------------------------------------------------------
/** Living | bedroom partition. Printed: 2380 + 70 + 3000. */
export const BEDROOM_WEST_X = 3.285;
/** Living | bathroom-block partition. Printed: 1930 + 70 + 3450. */
export const BATH_WEST_X = 3.735;
/** Bedroom head wall — where the living room steps from 3000 back out to 3450. Printed 3630 + 70. */
export const BEDROOM_SOUTH_Z = 5.74;
/**
 * Shaft | utility partition, at the gallery end only — it does not continue down into the bathroom,
 * which is one undivided room the full 1930 wide.
 *
 * The chain across it is utility 930 | wall 100 | shaft 900 = 1930, which closes on the printed 1930
 * exactly. It was read as 930 | 70 | 930 before, on the assumption that every internal wall is a 70
 * partition; this one is 100, and the shaft is 900 wide, not 930.
 */
export const BATH_SPLIT_X = 4.75;
/** The utility | shaft wall is 100, not the usual 70. */
export const SPLIT_WALL_T = 0.1;
/**
 * Bathroom | duct partition.
 *
 * Behind the toilet is a 200 void between two 70 partitions — the soil stack. Chaining back from the
 * cupboards: 357 cupboard, 125 wall, utility 1030, 70, the 200 duct, 70. That leaves the bathroom
 * 1778 deep on this side rather than the 1730 printed beside it; the ~5 cm has to sit somewhere, and
 * this is the end of the chain anchored by measured figures rather than by a scaled read.
 */
export const WC_SOUTH_Z = 7.588;
/** Duct | utility. Puts the utility at its 1030, measured back from the cupboards. */
export const UTILITY_SOUTH_Z = 7.858;
/**
 * Head of the bathroom — the wall between the shower and the shaft. 100 thick, and there is no door
 * in it: beyond it is a 900 × 675 services shaft, not usable floor.
 *
 * With the four thicknesses read off the drawing the party side of the block now closes on the
 * printed 3630 to the millimetre: bathroom 2398 | wall 100 | shaft 675 | wall 100 | cupboard 357.
 * (It was modelled with a 200 head wall, which left the arithmetic 100 short and the shaft in the
 * wrong place.) The living side is bathroom 1778 | 70 | duct 200 | 70 | utility 1030 | 125 | 357.
 */
export const BATH_NORTH_Z = 8.223;
export const BATH_NORTH_WALL_T = 0.1;
/**
 * SHOWER PARTITION — a 70 wall, 900 long, teeing off the head wall and stopping dead in the room.
 *
 * The bathroom carries TWO width chains, not one, and they are different: at the gallery end
 * `shaft 900 | 100 | utility 930`, and lower down, inside the bathroom, `930 | 70 | 930`. That
 * second chain measures THIS wall, which is a separate, thinner wall on nearly the same line — the
 * two are flush on their living-room face (x 4.700), so on the drawing they look like one band.
 * Reading them as one wall is what made this partition disappear from the model.
 *
 * It is what encloses the shower: a 930 × 900 recess in the party-wall corner, walled on three
 * sides and open to the room. The 900 is printed against it (measured off the head wall's face),
 * hence the free south end at BATH_NORTH_Z − 0.05 − 0.900.
 */
export const SHOWER_WALL_X = 4.735;
export const SHOWER_WALL_T = 0.07;
export const SHOWER_WALL_SOUTH_Z = 7.273;
/** The recess itself: clear faces, 930 × 900. */
export const SHOWER = {
  x0: SHOWER_WALL_X + SHOWER_WALL_T / 2,
  x1: 5.7,
  z0: SHOWER_WALL_SOUTH_Z,
  z1: BATH_NORTH_Z - BATH_NORTH_WALL_T / 2,
};
/**
 * Back FACE of the gallery-entered cupboards — 357 deep off the gallery wall, printed.
 *
 * A face, not a centreline, because the wall behind the cupboards is not one thickness: it is 125
 * where the storage cupboard backs onto the utility and 100 where it backs onto the shaft. Both are
 * printed; the model had a single 100 wall.
 */
export const CUPBOARD_NORTH_Z = 9.048;
export const CUPBOARD_WALL_T_UTILITY = 0.125;
export const CUPBOARD_WALL_T_SHAFT = 0.1;
/** Divider between the two cupboards (storage 1041 | service 770, printed). */
export const CUPBOARD_DIVIDER_X = 4.636;

// --- openings (m) ------------------------------------------------------------------------------
/** Bedroom door: 985 clear, set 770 down from the head wall (both printed). Swings into the bedroom. */
export const BEDROOM_DOOR_Z0 = 4.02;
export const BEDROOM_DOOR_Z1 = 5.005;
/**
 * The two 985 doors off the living room, from the printed chain 522 / 985 / 945 / 985 / 193. The
 * first (nearer the façade) is the BATHROOM's only door; the second is the utility's.
 */
export const WC_DOOR_Z0 = 5.968;
export const WC_DOOR_Z1 = 6.953;
export const UTILITY_DOOR_Z0 = 7.898;
export const UTILITY_DOOR_Z1 = 8.883;
/**
 * There is no separate bathroom door. Toilet, basin and shower share one room, so the bathroom's
 * door is the FIRST of the two 985 leaves off the living room above — the one this file used to call
 * the WC door. The 930/70/930 split exists only at the gallery end, where the shaft and the utility
 * sit side by side; below that the room runs the block's full 1930 width.
 */
/** Front door: a 1295 element in the gallery wall (printed width; SCALED position). */
export const ENTRANCE_X0 = 2.005;
export const ENTRANCE_X1 = 3.3;
/** Cupboard doors onto the gallery: storage (sv) 1041, service (gvr) 770 (printed). */
export const SV_X0 = 4.659;
export const SV_X1 = 5.7;
export const GV_X0 = 3.843;
export const GV_X1 = 4.613;

export interface WallSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  /** Wall thickness; defaults to WALL_THICKNESS (a 70 partition). */
  t?: number;
}

const E = EXTERIOR_WALL;

/** Straight wall runs with door/window gaps already cut out. Centrelines, metres. */
export const WALLS: WallSegment[] = [
  // ---------------- exterior perimeter (250) ----------------
  // NORTH — the façade. Printed chain along it: 284 | 2060 | 790 | 2060 | 256 = 5450, i.e. two
  // full-height 2060 windows, one to the living room and one to the bedroom.
  { x1: 0, z1: 0.125, x2: 0.506, z2: 0.125, t: E },
  { x1: 2.566, z1: 0.125, x2: 3.356, z2: 0.125, t: E },
  { x1: 5.416, z1: 0.125, x2: WIDTH, z2: 0.125, t: E },
  // WEST — the gable. Solid where the kitchen runs against it, then a 2060 opening at the façade
  // end, which is what makes the living room a glazed corner rather than a room with two windows.
  { x1: 0.125, z1: 0, x2: 0.125, z2: 0.665, t: E },
  { x1: 0.125, z1: 2.725, x2: 0.125, z2: DEPTH, t: E },
  // EAST — party wall, blind.
  { x1: WIDTH - 0.125, z1: 0, x2: WIDTH - 0.125, z2: DEPTH, t: E },
  // SOUTH — the gallery wall: front door, then the two meter cupboards.
  { x1: 0, z1: 9.53, x2: ENTRANCE_X0, z2: 9.53, t: E },
  { x1: ENTRANCE_X1, z1: 9.53, x2: GV_X0, z2: 9.53, t: E },
  { x1: GV_X1, z1: 9.53, x2: SV_X0, z2: 9.53, t: E },
  { x1: SV_X1, z1: 9.53, x2: WIDTH, z2: 9.53, t: E },

  // ---------------- living | bedroom partition (x 3.285, z 0.125 .. 5.74) ----------------
  { x1: BEDROOM_WEST_X, z1: 0.125, x2: BEDROOM_WEST_X, z2: BEDROOM_DOOR_Z0 },
  { x1: BEDROOM_WEST_X, z1: BEDROOM_DOOR_Z1, x2: BEDROOM_WEST_X, z2: BEDROOM_SOUTH_Z },

  // ---------------- bedroom head wall — solid, and the living room's step ----------------
  { x1: 3.25, z1: BEDROOM_SOUTH_Z, x2: WIDTH - 0.125, z2: BEDROOM_SOUTH_Z },

  // ---------------- living | bathroom-block partition (x 3.735), with the two 985 doors --------
  { x1: BATH_WEST_X, z1: BEDROOM_SOUTH_Z, x2: BATH_WEST_X, z2: WC_DOOR_Z0 },
  { x1: BATH_WEST_X, z1: WC_DOOR_Z1, x2: BATH_WEST_X, z2: UTILITY_DOOR_Z0 },
  { x1: BATH_WEST_X, z1: UTILITY_DOOR_Z1, x2: BATH_WEST_X, z2: 9.53 },

  // ---------------- inside the bathroom block ----------------
  // The printed 930 / 100 / 900 split runs only from the bathroom's head up to the cupboards, where
  // the shaft and the utility sit side by side. Below that there is NO wall — the toilet, basin and
  // shower are one room, the block's full 1930 wide.
  { x1: BATH_SPLIT_X, z1: WC_SOUTH_Z, x2: BATH_SPLIT_X, z2: CUPBOARD_NORTH_Z, t: SPLIT_WALL_T },
  // Shower partition: 70, flush with the wall above on its living-room face, running 900 back into
  // the room off the head wall and ending free. Three-sided walk-in recess, no screen.
  { x1: SHOWER_WALL_X, z1: SHOWER_WALL_SOUTH_Z, x2: SHOWER_WALL_X, z2: BATH_NORTH_Z, t: SHOWER_WALL_T },
  // Bathroom | duct, then duct | utility: the 200 soil-stack void behind the toilet.
  { x1: BATH_WEST_X, z1: WC_SOUTH_Z, x2: BATH_SPLIT_X, z2: WC_SOUTH_Z },
  { x1: BATH_WEST_X, z1: UTILITY_SOUTH_Z, x2: BATH_SPLIT_X, z2: UTILITY_SOUTH_Z },
  // Head of the bathroom: solid, 100 thick, no opening — a services shaft sits behind it.
  { x1: BATH_SPLIT_X, z1: BATH_NORTH_Z, x2: WIDTH - 0.125, z2: BATH_NORTH_Z, t: BATH_NORTH_WALL_T },
  // Back of the cupboards: 125 behind the utility, 100 behind the shaft, so the two are separate
  // runs whose gallery-side faces line up on CUPBOARD_NORTH_Z.
  {
    x1: BATH_WEST_X,
    z1: CUPBOARD_NORTH_Z - CUPBOARD_WALL_T_UTILITY / 2,
    x2: BATH_SPLIT_X,
    z2: CUPBOARD_NORTH_Z - CUPBOARD_WALL_T_UTILITY / 2,
    t: CUPBOARD_WALL_T_UTILITY,
  },
  {
    x1: BATH_SPLIT_X,
    z1: CUPBOARD_NORTH_Z - CUPBOARD_WALL_T_SHAFT / 2,
    x2: WIDTH - 0.125,
    z2: CUPBOARD_NORTH_Z - CUPBOARD_WALL_T_SHAFT / 2,
    t: CUPBOARD_WALL_T_SHAFT,
  },
  // sv | gv
  { x1: CUPBOARD_DIVIDER_X, z1: CUPBOARD_NORTH_Z, x2: CUPBOARD_DIVIDER_X, z2: 9.53, t: 0.05 },
];

/**
 * Glazing. Two 2060 windows in the façade (widths printed on the kozijn chain; their positions
 * measured off the drawing and agreeing with that chain to ~20 mm), plus a third 2060 opening in
 * the gable at the façade end. The living room is therefore glazed on TWO adjacent walls — a
 * corner of glass, not a wall of punched windows — and both façade windows run to the floor.
 */
export const GLAZED_DOOR_HEIGHT = 2.35;
export const WINDOW_SILL = 0.06;
export interface GlazedWindow {
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  room: 'living' | 'bedroom';
  sill: number;
}
export const GLAZED_WINDOWS: GlazedWindow[] = [
  { axis: 'x', at: 0.125, from: 0.506, to: 2.566, room: 'living', sill: WINDOW_SILL },
  { axis: 'x', at: 0.125, from: 3.356, to: 5.416, room: 'bedroom', sill: WINDOW_SILL },
  { axis: 'z', at: 0.125, from: 0.665, to: 2.725, room: 'living', sill: WINDOW_SILL },
];

/**
 * Door leaves. Every interior door on this drawing is a normal hinged leaf.
 *
 * `hx`/`hz` is the HINGE and `rot` orients the leaf, which extends along the group's local +X: a
 * leaf tip therefore lands at `(hx + w·cos rot, hz − w·sin rot)`. Closed means the tip sits on the
 * opening's other jamb, so `rot` must be within ±90° of that direction — get the sign wrong and the
 * leaf is drawn on the far side of the hinge, i.e. across the wall it is supposed to fill.
 *
 * WHICH WAY EACH ONE SWINGS IS READ OFF THE DRAWING, not guessed. The werktekening draws a quarter
 * swing arc per door; each hinge/direction pair below was checked by sampling the drawing's ink
 * along the arc it predicts and comparing against the three alternatives (contrast +0.10..+0.21
 * for the readings used here, ≈0.00 or negative for every alternative). Two consequences worth
 * keeping: the bedroom door opens INTO the bedroom, and the WC and utility doors hinge on opposite
 * jambs so they open away from each other and leave the 945 of wall between them usable.
 */
export interface DoorLeaf {
  hx: number;
  hz: number;
  w: number;
  rot: number;
  sliding?: boolean;
}
export const DOORS: DoorLeaf[] = [
  // bedroom: hinged at the head-wall jamb, opening into the bedroom
  { hx: BEDROOM_WEST_X, hz: BEDROOM_DOOR_Z1, w: BEDROOM_DOOR_Z1 - BEDROOM_DOOR_Z0, rot: Math.PI / 2 - 0.45 },
  // bathroom: hinged at the façade-side jamb, opening into the living room
  { hx: BATH_WEST_X, hz: WC_DOOR_Z0, w: WC_DOOR_Z1 - WC_DOOR_Z0, rot: -Math.PI / 2 - 0.45 },
  // utility: hinged at the gallery-side jamb, also opening into the living room
  { hx: BATH_WEST_X, hz: UTILITY_DOOR_Z1, w: UTILITY_DOOR_Z1 - UTILITY_DOOR_Z0, rot: Math.PI / 2 + 0.45 },
  // Meter cupboards. Entered from the gallery, so they are not part of the flat at all, and the
  // drawing gives them flat closed leaves with no swing arc — drawn closed, in the outer face of
  // the gallery wall. Ajar they were two flaps hanging off the outside of the building.
  { hx: GV_X1, hz: DEPTH - 0.02, w: GV_X1 - GV_X0, rot: Math.PI },
  { hx: SV_X1, hz: DEPTH - 0.02, w: SV_X1 - SV_X0, rot: Math.PI },
  // front door: hinged at the party-wall jamb, swinging into the living/kitchen
  { hx: ENTRANCE_X1, hz: 9.53, w: ENTRANCE_X1 - ENTRANCE_X0, rot: Math.PI - 0.5 },
];

export interface Opening {
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  headY: number;
  t?: number;
}
export const DOOR_OPENINGS: Opening[] = [
  { axis: 'z', at: BEDROOM_WEST_X, from: BEDROOM_DOOR_Z0, to: BEDROOM_DOOR_Z1, headY: 2.05 },
  { axis: 'z', at: BATH_WEST_X, from: WC_DOOR_Z0, to: WC_DOOR_Z1, headY: 2.05 },
  { axis: 'z', at: BATH_WEST_X, from: UTILITY_DOOR_Z0, to: UTILITY_DOOR_Z1, headY: 2.05 },
  { axis: 'x', at: 9.53, from: ENTRANCE_X0, to: ENTRANCE_X1, headY: 2.05, t: E },
  { axis: 'x', at: 9.53, from: GV_X0, to: GV_X1, headY: 2.05, t: E },
  { axis: 'x', at: 9.53, from: SV_X0, to: SV_X1, headY: 2.05, t: E },
];
export const WINDOW_OPENINGS: Opening[] = GLAZED_WINDOWS.map((w) => ({
  axis: w.axis,
  at: w.at,
  from: w.from,
  to: w.to,
  headY: GLAZED_DOOR_HEIGHT,
  t: E,
}));

/**
 * VOIDS — floor area inside the flat's envelope that you can neither use nor enter, so it is built
 * as solid poché to the ceiling rather than as tiled floor with walls round it.
 *
 * The 200 strip behind the toilet is the soil stack: full of the drainage it exists to hide, and
 * only 200 deep, so there is nothing to stand in it. The 900 × 675 shaft has no door on any of its
 * four sides. Drawn as floor they both read as small rooms someone forgot to fit out, which
 * overstates the flat by 0,79 m² of unreachable "space".
 *
 * Clear rectangles, between the faces of the walls that bound them.
 */
export interface Void {
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}
export const SOLID_VOIDS: Void[] = [
  {
    name: 'Duct',
    x1: BATH_WEST_X + PARTITION / 2,
    z1: WC_SOUTH_Z + PARTITION / 2,
    x2: BATH_SPLIT_X - SPLIT_WALL_T / 2,
    z2: UTILITY_SOUTH_Z - PARTITION / 2,
  },
  {
    name: 'Shaft',
    x1: BATH_SPLIT_X + SPLIT_WALL_T / 2,
    z1: BATH_NORTH_Z + BATH_NORTH_WALL_T / 2,
    x2: IN_X1,
    z2: CUPBOARD_NORTH_Z - CUPBOARD_WALL_T_SHAFT,
  },
];

export interface RoomLabel {
  name: string;
  x: number;
  z: number;
}

export const ROOM_LABELS: RoomLabel[] = [
  { name: 'Living', x: 1.75, z: 2.6 },
  { name: 'Dining', x: 1.9, z: 5.2 },
  { name: 'Kitchen', x: 2.1, z: 7.9 },
  { name: 'Bedroom', x: 4.5, z: 2.8 },
  { name: 'Bathroom', x: 4.4, z: 6.5 },
  { name: 'Shower', x: (SHOWER.x0 + SHOWER.x1) / 2, z: (SHOWER.z0 + SHOWER.z1) / 2 },
  { name: 'Utility', x: 4.235, z: 8.41 },
  { name: 'Shaft', x: 5.25, z: 8.61 },
  // Both open off the gallery, not off the flat: storage is the wide one (1041) behind the shaft,
  // service the narrow one (770) behind the utility.
  { name: 'Storage', x: 5.18, z: 9.23 },
  { name: 'Service', x: 4.23, z: 9.23 },
];

/**
 * The walls you can actually put something against, one label each.
 *
 * ONE GRAMMAR, THREE FIELDS: `zone · which wall · what it carries`. Every label fills all three,
 * always in that order, so the labels can be compared down the list instead of read one at a time.
 *   · zone — the same names the room labels use: Living, Kitchen, Bedroom.
 *   · which wall — the drawing's own word for the external ones (façade, gable, party wall, gallery
 *     wall) and, for a partition, the room on the FAR side of it. Never a compass direction: "east"
 *     tells you nothing while standing in the room, and half the old labels said it while the other
 *     half named the element.
 *   · what it carries — the opening or fitted run in that wall with its width in cm, or "no
 *     openings" where there is nothing, which is the useful fact for a wardrobe.
 *
 * Widths are cm to match every other figure in the app; the old labels mixed mm ("2060 window") with
 * depths ("600 run"), so two numbers in the same style meant different things.
 */
export const WALL_LABELS: RoomLabel[] = [
  { name: 'Living · façade · window 206', x: 1.54, z: 0.42 },
  { name: 'Living · gable · window 206', x: 0.42, z: 1.7 },
  { name: 'Living · bedroom wall · door 98.5', x: 3.1, z: 3.2 },
  { name: 'Kitchen · gable · fitted run 300', x: 0.42, z: 7.8 },
  { name: 'Kitchen · bathroom wall · doors 2 × 98.5', x: 3.55, z: 7.6 },
  { name: 'Kitchen · gallery wall · front door 129.5', x: 1.2, z: 9.24 },
  { name: 'Bedroom · façade · window 206', x: 4.39, z: 0.42 },
  { name: 'Bedroom · party wall · no openings', x: 5.52, z: 3.0 },
  { name: 'Bedroom · head wall · no openings', x: 4.5, z: 5.56 },
];

/**
 * Furniture-placement rectangles (m), inset from the finished faces so a spawned piece starts
 * clear of the walls. `lounge` is the wide façade end of the living room, `kitchen` the front
 * end beside the entrance — they are one room, split here only so new pieces land sensibly.
 */
export const ROOM_BOUNDS = {
  bedroom: { x1: 3.37, z1: 0.3, x2: 5.65, z2: 5.65 },
  lounge: { x1: 0.3, z1: 0.3, x2: 3.2, z2: 5.72 },
  // clear of the 600-deep kitchen run on the gable wall
  kitchen: { x1: 0.95, z1: 5.85, x2: 3.65, z2: 9.35 },
};
