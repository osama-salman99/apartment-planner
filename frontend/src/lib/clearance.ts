import { WALLS, WALL_THICKNESS, WIDTH, DEPTH } from './dimensions';
import type { PlacedItem } from './types';

// Real furniture shouldn't touch — walls, skirting, and simple installation tolerance mean two
// pieces (or a piece and a wall) need a little air between them. We require at least this gap;
// anything closer (or overlapping) is reported as a clash.
export const CLEARANCE_CM = 0.5;

type Pt = { x: number; z: number }; // centimetres, apartment space
type Poly = Pt[]; // convex, 4 corners

const EPS = 1e-4;

/** Footprint of a placed item as a rotated rectangle (cm). x/z is the centre; rotationDeg is the
 *  Three.js Y-rotation applied to the mesh, so we use the same matrix here. */
export function itemPolygon(it: Pick<PlacedItem, 'x' | 'z' | 'w' | 'd' | 'rotationDeg'>): Poly {
  const hw = it.w / 2;
  const hd = it.d / 2;
  const t = (it.rotationDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Three's Y-rotation: worldX = lx*c + lz*s, worldZ = -lx*s + lz*c.
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, lz]) => ({ x: it.x + lx * c + lz * s, z: it.z - lx * s + lz * c }));
}

function wallPolygon(seg: { x1: number; z1: number; x2: number; z2: number; t?: number }): Poly {
  const t = (seg.t ?? WALL_THICKNESS) / 2;
  // Segments are axis-aligned; pad both ends by half-thickness to match the rendered wall boxes
  // (which extend length by WALL_THICKNESS to close corners).
  const xmin = (Math.min(seg.x1, seg.x2) - t) * 100;
  const xmax = (Math.max(seg.x1, seg.x2) + t) * 100;
  const zmin = (Math.min(seg.z1, seg.z2) - t) * 100;
  const zmax = (Math.max(seg.z1, seg.z2) + t) * 100;
  return [
    { x: xmin, z: zmin },
    { x: xmax, z: zmin },
    { x: xmax, z: zmax },
    { x: xmin, z: zmax },
  ];
}

const WALL_POLYS: Poly[] = WALLS.map(wallPolygon);

function projectRange(poly: Poly, ax: number, az: number) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * ax + p.z * az;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

/** Separating-axis test for two convex polygons. */
function intersects(a: Poly, b: Poly): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      // edge normal
      const ax = -(q.z - p.z);
      const az = q.x - p.x;
      const ra = projectRange(a, ax, az);
      const rb = projectRange(b, ax, az);
      if (ra.max < rb.min - EPS || rb.max < ra.min - EPS) return false; // a gap on this axis
    }
  }
  return true;
}

function pointSegDist(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const len2 = vx * vx + vz * vz;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * vx + (p.z - a.z) * vz) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = p.x - (a.x + t * vx);
  const dz = p.z - (a.z + t * vz);
  return Math.hypot(dx, dz);
}

/** Minimum gap (cm) between two convex footprints; 0 if they overlap or touch. */
export function polyGap(a: Poly, b: Poly): number {
  if (intersects(a, b)) return 0;
  let min = Infinity;
  const edges = (poly: Poly, p: Pt) => {
    for (let i = 0; i < poly.length; i++) {
      const d = pointSegDist(p, poly[i], poly[(i + 1) % poly.length]);
      if (d < min) min = d;
    }
  };
  for (const p of a) edges(b, p);
  for (const p of b) edges(a, p);
  return min;
}

export interface Conflict {
  a: string;
  b: string;
  kind: 'item' | 'wall';
  gapCm: number; // 0 = overlapping/touching
}

/** Display names, numbering duplicates ("Chair (1)", "Chair (2)") so the tooltip is unambiguous. */
function displayNames(items: PlacedItem[]): string[] {
  const total = new Map<string, number>();
  for (const it of items) total.set(it.name, (total.get(it.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return items.map((it) => {
    if ((total.get(it.name) ?? 0) <= 1) return it.name;
    const n = (seen.get(it.name) ?? 0) + 1;
    seen.set(it.name, n);
    return `${it.name} (${n})`;
  });
}

/** Rugs, lamps, plants and bedding are placed against, under and on top of things on purpose. */
function loosePlacement(shape: string): boolean {
  return (
    shape === 'rug' ||
    shape === 'onsevigRug' ||
    shape === 'lamp' ||
    shape === 'plant' ||
    shape === 'bedding' ||
    shape === 'beddingMadeUp'
  );
}

/** Every pair of pieces — and every piece vs. a wall — closer than CLEARANCE_CM. */
// Some pairings aren't spacing problems: rugs go under furniture, lamps sit on/beside surfaces (or
// hang from the ceiling), plants stand in the gaps furniture leaves (or hang over it), and dining
// chairs are meant to tuck under their table. Don't flag those.
function exemptPair(a: PlacedItem, b: PlacedItem): boolean {
  const sa = a.shape as string;
  const sb = b.shape as string;
  if (loosePlacement(sa) || loosePlacement(sb)) return true;
  // Preset "bedding" (mattress/duvet layer) sits on the bed and the "TV" sits on its console —
  // both are intentional overlays, not spacing clashes.
  const overlay = /^Bedding$|^TV\b/;
  if (overlay.test(a.name) || overlay.test(b.name)) return true;
  // Height is editable, so a piece can be set ON another one — a TV on its bench, a console on the
  // unit next to it, a box on a shelf. Two pieces at different base heights are stacked on purpose:
  // their footprints overlap in plan while nothing actually collides, and there is no volume model
  // here that could tell a bench top from the air above it. Pieces at the SAME height are still
  // tested, so two things sharing one surface still have to fit side by side.
  if (Math.abs((a.y ?? 0) - (b.y ?? 0)) > 0.5) return true;
  const s = [sa, sb];
  if (s.includes('diningTable') && (s.includes('diningChair') || s.includes('chair'))) return true;
  return false;
}

export function findConflicts(items: PlacedItem[]): Conflict[] {
  const polys = items.map(itemPolygon);
  const names = displayNames(items);
  const out: Conflict[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (exemptPair(items[i], items[j])) continue;
      const g = polyGap(polys[i], polys[j]);
      if (g < CLEARANCE_CM - EPS) out.push({ a: names[i], b: names[j], kind: 'item', gapCm: g });
    }
    // vs walls — report the single closest offending wall for this item. Rugs meet walls by design
    // and lamps live in corners, so skip those.
    if (loosePlacement(items[i].shape as string)) continue;
    let wallMin = Infinity;
    for (const wp of WALL_POLYS) {
      const g = polyGap(polys[i], wp);
      if (g < wallMin) wallMin = g;
      if (wallMin <= 0) break;
    }
    if (wallMin < CLEARANCE_CM - EPS) out.push({ a: names[i], b: 'Wall', kind: 'wall', gapCm: wallMin });
  }
  // Overlaps (gap 0) first, then closest.
  return out.sort((p, q) => p.gapCm - q.gapCm);
}

/** True if a footprint at (x,z) keeps ≥ CLEARANCE_CM from every wall and every other item. */
function spotClears(x: number, z: number, w: number, d: number, rotationDeg: number, others: Poly[]): boolean {
  const poly = itemPolygon({ x, z, w, d, rotationDeg });
  for (const wp of WALL_POLYS) if (polyGap(poly, wp) < CLEARANCE_CM) return false;
  for (const op of others) if (polyGap(poly, op) < CLEARANCE_CM) return false;
  return true;
}

/**
 * Find a spot for a new/duplicated piece that respects the clearance rule: start from the
 * preferred point and spiral outward on a grid, staying inside `bounds` (metres). Falls back to
 * the preferred point if the piece simply can't fit clear anywhere (the indicator will then flag
 * it, rather than silently dropping it somewhere wrong).
 */
export function placeWithClearance(
  dims: { w: number; d: number },
  rotationDeg: number,
  bounds: { x1: number; z1: number; x2: number; z2: number },
  existing: PlacedItem[],
  preferred: { x: number; z: number },
): { x: number; z: number } {
  const others = existing.map(itemPolygon);
  const hw = dims.w / 2;
  const hd = dims.d / 2;
  // Allowed centre range so the footprint stays inside the room; if the piece is bigger than the
  // room, widen to the whole apartment interior so it can still land somewhere clear.
  const fit = (lo: number, hi: number, half: number) => (hi - lo >= 2 * half ? { lo: lo + half, hi: hi - half } : null);
  const rx = fit(bounds.x1 * 100, bounds.x2 * 100, hw) ?? { lo: hw, hi: WIDTH * 100 - hw };
  const rz = fit(bounds.z1 * 100, bounds.z2 * 100, hd) ?? { lo: hd, hi: DEPTH * 100 - hd };
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const px = clamp(preferred.x, rx.lo, rx.hi);
  const pz = clamp(preferred.z, rz.lo, rz.hi);

  if (spotClears(px, pz, dims.w, dims.d, rotationDeg, others)) return { x: px, z: pz };

  const STEP = 10; // cm
  const maxR = Math.ceil(Math.max(rx.hi - rx.lo, rz.hi - rz.lo) / STEP);
  for (let r = 1; r <= maxR; r++) {
    for (let dxi = -r; dxi <= r; dxi++) {
      for (let dzi = -r; dzi <= r; dzi++) {
        if (Math.max(Math.abs(dxi), Math.abs(dzi)) !== r) continue; // ring only
        const cx = clamp(px + dxi * STEP, rx.lo, rx.hi);
        const cz = clamp(pz + dzi * STEP, rz.lo, rz.hi);
        if (spotClears(cx, cz, dims.w, dims.d, rotationDeg, others)) return { x: cx, z: cz };
      }
    }
  }
  return { x: px, z: pz };
}
