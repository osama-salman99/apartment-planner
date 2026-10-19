import * as THREE from 'three';

/**
 * Geometry for soft things — duvets, pillows, throws.
 *
 * WHY IT IS BUILT BY HAND. The obvious route is a RoundedBoxGeometry with its vertices nudged, and
 * that was the first attempt: it fails, and it fails in a way that no amount of material tuning
 * rescues. Two reasons. First, resolution: RoundedBoxGeometry subdivides all three axes and
 * de-indexes, so the vertex count is cubic in its `segments` and you cannot afford more than about
 * ten — which is roughly a 9 cm cell on a double duvet, far too coarse to carry a fold. Second,
 * gravity: pushing the overhang straight down spreads the fall across the whole overhang and you get
 * a 45° ramp splaying out under the mattress, because real cloth turns the edge in a couple of
 * centimetres and then drops nearly vertically.
 *
 * So these build the slab directly: a top surface and a bottom surface on their own grids at ~2 cm,
 * a rounded lip where they meet, the overhang pulled DOWN and back IN, and the top displaced by
 * multi-octave folds plus long soft creases. That is what separates cloth from foam.
 *
 * The noise is a hashed value noise — deterministic, so a duvet has the same folds on every load
 * and every device rather than reshuffling per mount (the same reason the MISTUDDEN door texture is
 * seeded). No Math.random anywhere.
 */

function hash2(i: number, j: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xffff) / 0xffff;
}

/** Value noise in 0..1, smooth across cell boundaries. */
function noise2(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j);
  const b = hash2(i + 1, j);
  const c = hash2(i, j + 1);
  const e = hash2(i + 1, j + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + e * sx) * sy;
}

/** Three octaves, centred on 0 — the big folds, a finer crumple, and a little grain. */
function fold(x: number, y: number, seed: number): number {
  return (
    (noise2(x + seed, y - seed) - 0.5) +
    (noise2(x * 2.7 - seed, y * 2.7 + seed) - 0.5) * 0.45 +
    (noise2(x * 6.1 + seed * 2, y * 6.1 - seed * 2) - 0.5) * 0.18
  );
}

type Side = 'both' | 'plus' | 'minus' | 'none';

function past(v: number, flat: number, side: Side): number {
  if (side === 'none') return 0;
  if (side === 'plus') return Math.max(0, v - flat);
  if (side === 'minus') return Math.max(0, -v - flat);
  return Math.max(0, Math.abs(v) - flat);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * A woven-cloth bump map, drawn once and shared. White bedding under soft room light is otherwise
 * a flat silhouette — the weave is what tells the eye it is fabric rather than painted plaster, and
 * it is the difference between "a white shape on a bed" and "a duvet" at walking distance.
 * Fixed-seed PRNG so it is identical on every load, like the MISTUDDEN door pattern.
 */
let weaveCanvas: HTMLCanvasElement | null = null;
function weave(): HTMLCanvasElement | null {
  if (weaveCanvas) return weaveCanvas;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#808080'; // mid grey = no displacement
  g.fillRect(0, 0, 256, 256);
  let seed = 20260810;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Warp and weft: two sets of threads, each slightly irregular in spacing and brightness.
  for (const vertical of [false, true]) {
    for (let i = 0; i < 256; i += 4) {
      const off = i + (rnd() - 0.5) * 1.2;
      const v = vertical ? 150 + rnd() * 55 : 88 - rnd() * 40;
      g.strokeStyle = `rgb(${v},${v},${v})`;
      g.lineWidth = 1.4 + rnd() * 0.8;
      g.beginPath();
      if (vertical) {
        g.moveTo(off, 0);
        g.lineTo(off, 256);
      } else {
        g.moveTo(0, off);
        g.lineTo(256, off);
      }
      g.stroke();
    }
  }
  // A few slubs — the thicker flecks that make linen linen.
  for (let i = 0; i < 260; i++) {
    const v = rnd() > 0.5 ? 190 : 70;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 7, 1 + rnd() * 2);
  }
  weaveCanvas = c;
  return c;
}

let weaveTex: THREE.CanvasTexture | null = null;
/** The shared weave, repeated to the given density (per metre of cloth). */
export function fabricBump(repeat: number): THREE.Texture | undefined {
  if (!weaveTex) {
    const c = weave();
    if (!c) return undefined;
    weaveTex = new THREE.CanvasTexture(c);
    weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping;
  }
  const t = weaveTex.clone();
  t.needsUpdate = true;
  t.repeat.set(repeat, repeat);
  return t;
}

export interface DrapeOptions {
  /** Half-extents (m) of the flat top; fabric beyond this falls away. */
  flatX?: number;
  flatZ?: number;
  /** How far (m) the fabric has fallen by the outer edge. */
  dropX?: number;
  dropZ?: number;
  /** Which sides it hangs over. A duvet drapes over both long sides but only the foot. */
  xSide?: Side;
  zSide?: Side;
  /**
   * How much of the overhang is pulled back in as it falls, 0..1. Cloth hanging over the edge of a
   * bed turns the corner within a few centimetres and then drops nearly straight; at 0 the fall is
   * spread over the whole overhang and you get a ramp splaying out under the mattress.
   */
  curl?: number;
  /** Amplitude (m) of the surface folds, and how large they are. */
  ripple?: number;
  rippleScale?: number;
  /** Amplitude (m) of the long soft ridges that run across the cloth where it has been pulled up. */
  crease?: number;
  creaseScale?: number;
  /** Amplitude (m) of the gentle dome over the middle — a filled duvet is not a flat sheet. */
  puff?: number;
  /**
   * Amplitude (m) of the long vertical flutes down the HANGING part, and how far apart they are.
   * Everything above is faded out where the cloth is taut, which is right for the flat top and wrong
   * for the fall: the side of a bed is the one place a duvet is most folded, and with no term for it
   * the drape renders as a perfectly smooth plane — the loudest "starched cardboard" cue left on an
   * otherwise convincing bed. The flutes sway the cloth in and out as it drops, and carry the hem up
   * and down with them, so the bottom edge is a wavy line rather than a ruled one.
   */
  flute?: number;
  fluteScale?: number;
  seed?: number;
  /** Grid cell (m). Smaller = more folds resolved, more vertices. */
  cell?: number;
}

/**
 * A cloth slab: a top surface, a bottom surface, and a rounded lip joining them. `w`/`h`/`d` are the
 * overall size in metres; the drape happens INSIDE that envelope, so the piece never grows past the
 * numbers the user typed.
 */
export function linenGeometry(w: number, h: number, d: number, o: DrapeOptions = {}): THREE.BufferGeometry {
  const {
    flatX = w / 2,
    flatZ = d / 2,
    dropX = 0,
    dropZ = 0,
    xSide = 'both',
    zSide = 'both',
    curl = 0.78,
    ripple = 0.012,
    rippleScale = 0.55,
    crease = 0,
    creaseScale = 0.42,
    puff = 0,
    flute = 0,
    fluteScale = 0.24,
    seed = 1,
    cell = 0.022,
  } = o;

  const nx = Math.max(6, Math.min(120, Math.round(w / cell)));
  const nz = Math.max(6, Math.min(120, Math.round(d / cell)));
  const outerX = Math.max(1e-4, w / 2 - flatX);
  const outerZ = Math.max(1e-4, d / 2 - flatZ);
  // The rounded lip: how far in from the edge the surfaces start turning over. A hard 90° rim is
  // the single loudest "this is a box" cue on an otherwise convincing duvet.
  const lip = Math.min(h * 0.45, 0.022);

  const top: number[] = [];
  const bot: number[] = [];
  const uvT: number[] = [];
  const uvB: number[] = [];
  // The un-inset position of every vertex, i.e. before the rounded lip pulls it in. The rim ring uses
  // it to bulge back out to full size at mid-height — see the ring construction below.
  const rawX: number[] = [];
  const rawZ: number[] = [];

  // Quarter-circle turn-over: how far the surface has dropped, `e` metres in from the edge.
  const roll = (e: number) => {
    if (e >= lip || lip <= 0) return 0;
    const t = (lip - e) / lip;
    return lip * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
  };

  for (let j = 0; j <= nz; j++) {
    const z0 = -d / 2 + (d * j) / nz;
    for (let i = 0; i <= nx; i++) {
      const x0 = -w / 2 + (w * i) / nx;

      // Gravity: how far past the flat top this column is, on each axis.
      const overX = past(x0, flatX, xSide);
      const overZ = past(z0, flatZ, zSide);
      const fx = smooth(Math.min(1, overX / outerX));
      const fz = smooth(Math.min(1, overZ / outerZ));
      // The LONGER of the two falls, not their sum. A corner of cloth hangs off a corner of the bed;
      // it does not hang off the side and then off the foot as well. Summing them is the obvious thing
      // and it is badly wrong wherever both drops are large: a duvet falling 40 cm down the sides and
      // 34 over the foot dropped 74 cm at its corners, which put its hem 6 cm BELOW THE FLOOR and made
      // the whole piece read as a tablecloth pulled over the bed. It went unnoticed for as long as both
      // drops were single-figure, where the surplus is a centimetre or two and hidden in the fold.
      let fall = Math.max(dropX * fx, dropZ * fz);
      // …and the overhang draws back towards the edge as it drops, so it hangs instead of ramping.
      let x = overX > 0 ? x0 - Math.sign(x0) * overX * curl * fx : x0;
      let z = overZ > 0 ? z0 - Math.sign(z0) * overZ * curl * fz : z0;

      // The flutes down the fall (see `flute`). They sway whichever axis this column is hanging off,
      // and they grow from nothing at the fold to full amplitude at the hem, because that is how cloth
      // gathers: pinned along the top edge and free at the bottom. `along` is the coordinate that runs
      // ALONG the hanging edge, so consecutive columns of the drape get different sway and the surface
      // corrugates instead of moving as one slab. The hem wave is deliberately a fraction of the sway,
      // not an independent number: a fold that pushes cloth out also shortens its drop.
      const hang = Math.max(fx, fz);
      if (flute > 0 && hang > 0) {
        const alongX = fx >= fz;
        const along = alongX ? z0 : x0;
        const sway = fold(along / fluteScale, seed * 0.7, seed + 3) * flute * hang;
        if (alongX) x += Math.sign(x0 || 1) * sway;
        else z += Math.sign(z0 || 1) * sway;
        // The hem follows the sway only weakly. Coupling it one-for-one (0.9) is geometrically tidy —
        // cloth pushed outwards has less length left to drop — but it scallops the bottom edge into a
        // row of pointed tabs, which at arm's length reads as torn rather than gathered. A third of the
        // sway keeps the edge broadly level while still stopping it looking ruled.
        fall -= Math.abs(sway) * 0.32;
      }

      // The rounded lip, pulled in from whichever edge is nearest on each axis.
      const eX = w / 2 - Math.abs(x0);
      const eZ = d / 2 - Math.abs(z0);
      const rX = roll(eX);
      const rZ = roll(eZ);
      rawX.push(x);
      rawZ.push(z);
      x -= Math.sign(x0 || 1) * rX;
      z -= Math.sign(z0 || 1) * rZ;
      const turn = Math.max(rX, rZ);

      // Surface movement: folds, long creases and the filled dome, all fading out where the cloth
      // is pulled tight over an edge (taut fabric does not crumple).
      const slack = 1 - Math.max(fx, fz);
      let lift = 0;
      if (slack > 0) {
        lift += ripple * fold(x0 / rippleScale, z0 / rippleScale, seed) * slack;
        if (crease > 0) {
          lift +=
            crease *
            Math.sin(z0 / creaseScale + 2.4 * noise2(x0 * 0.9 + seed, seed * 0.5)) *
            slack;
        }
        if (puff > 0) {
          const px = 1 - Math.min(1, Math.abs(x0) / Math.max(1e-4, flatX));
          const pz = 1 - Math.min(1, Math.abs(z0) / Math.max(1e-4, flatZ));
          lift += puff * smooth(Math.min(1, px * 1.7)) * smooth(Math.min(1, pz * 1.7));
        }
      }

      top.push(x, h / 2 - fall + lift - turn, z);
      bot.push(x, -h / 2 - fall + turn, z);
      const u = i / nx;
      const v = j / nz;
      uvT.push(u, v);
      uvB.push(u, v);
    }
  }

  const row = nx + 1;
  const nTop = top.length / 3;
  const positions = top.concat(bot);
  const uvs = uvT.concat(uvB);
  const index: number[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const e = c + 1;
      index.push(a, c, b, b, c, e); // top face, wound to face up
      index.push(nTop + a, nTop + b, nTop + c, nTop + b, nTop + e, nTop + c); // bottom, faces down
    }
  }
  // The rim, joining the two surfaces all the way round — via a THIRD ring at mid-height that stands
  // back out at the un-inset position. Without it the lip pulls both the top and the bottom surface in
  // by `lip`, so the widest point of the whole piece is `lip` short of the size that was asked for: a
  // 180 mattress measured 175.6 and left a 2.7 cm slot down each side of the bed frame it was supposed
  // to fill. A real mattress is widest at mid-height and rounded off towards both faces, which is
  // exactly what three rings give.
  const ring: number[] = [];
  for (let i = 0; i <= nx; i++) ring.push(i);
  for (let j = 1; j <= nz; j++) ring.push(j * row + nx);
  for (let i = nx - 1; i >= 0; i--) ring.push(nz * row + i);
  for (let j = nz - 1; j >= 1; j--) ring.push(j * row);

  const midStart = positions.length / 3;
  for (const a of ring) {
    positions.push(rawX[a], (top[a * 3 + 1] + bot[a * 3 + 1]) / 2, rawZ[a]);
    uvs.push(uvT[a * 2], uvT[a * 2 + 1]);
  }

  for (let k = 0; k < ring.length; k++) {
    const n = (k + 1) % ring.length;
    const a = ring[k];
    const b = ring[n];
    const ma = midStart + k;
    const mb = midStart + n;
    // Wound (a, b, mid-a), NOT (a, mid-a, b). With the other winding every one of these quads faces
    // INWARD: on the z = −d/2 side the normal came out as +Z. The rim was therefore backface-culled
    // all the way round, and the piece rendered as its top surface floating over the inside of its own
    // underside. It went unnoticed for as long as everything using this drooped over its edges — a
    // duvet's rim is a couple of millimetres of cloth tucked under a fold — and showed up the moment
    // something flat-sided came along: a 22 cm mattress you could see the bed's slats straight through.
    index.push(a, b, ma, b, mb, ma);
    index.push(ma, mb, nTop + a, mb, nTop + b, nTop + a);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(index);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * A pillow. Built as a superellipsoid rather than a rounded box: a filled pillowcase is fat in the
 * middle and pinched to a thin lip at the seam, which is exactly what the exponent below does and
 * exactly what a bevelled box cannot do. Then the middle is plumped, the seam pinched further, and
 * the whole thing given the soft irregularity of something that has been slept on.
 */
export function pillowGeometry(w: number, h: number, d: number, seed = 1, border = 0): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(0.5, 56, 38);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  // <1 pushes the sphere out towards a box; 0.62 is a plump pillow, 1.0 is an ellipsoid pancake.
  const EXP = 0.62;
  const sq = (v: number) => Math.sign(v) * Math.pow(Math.abs(v) * 2, EXP) * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const nx = sq(pos.getX(i));
    const ny = sq(pos.getY(i));
    const nz = sq(pos.getZ(i));
    // How far in from the seam this point is — 1 at the centre of a face, 0 at the perimeter.
    const rx = 1 - Math.min(1, Math.abs(nx) * 2);
    const rz = 1 - Math.min(1, Math.abs(nz) * 2);
    // NOT `min(1, rx * 1.5)`: multiplying up and clamping puts a PLATEAU across the middle third of
    // the face, so the pillow is dead flat everywhere except a rounded border. A flat face with a
    // rounded border is a seat cushion or a plate — which is exactly what the standing pillows read
    // as, once they were stood up and their big face was the thing you looked at. Un-clamped, `plump`
    // falls off smoothly from the centre all the way to the seam, so the face is a dome.
    const plump = smooth(rx) * smooth(rz);
    // Thin at the seam, fat in the middle, plus a slept-on wobble. 0.42/0.95 rather than 0.5/0.72
    // because the dome loses the plateau's height: this puts the crown back where it was while
    // keeping the seam thin.
    let thick = 0.42 + 0.95 * plump;
    // THE OXFORD BORDER, when asked for: a flat sewn hem of empty cloth standing out all the way
    // round the filled middle. It is not decoration — it is the loudest single cue that separates a
    // dressed pillow from a cushion, and the reference photo's four pillows all have one, a good
    // hand's width wide and clearly flat. Modelled by collapsing the loft to almost nothing over the
    // outer `border` metres, so the plump dome starts inboard of the hem instead of running to the
    // seam. `inset` is the distance from the nearer perimeter on each axis, in the same metres as w/d.
    if (border > 0) {
      const inset = Math.min(w / 2 - Math.abs(nx * w), d / 2 - Math.abs(nz * d));
      const t = smooth(Math.min(1, Math.max(0, inset / border)));
      // 0.22 rather than 0.13: at 0.13 the hem is so nearly flat that the whole pillow measured only
      // 6 cm thick and read as a plate with a dome stuck on it. A real Oxford hem is two layers of
      // slightly-slack cloth, so it still has a couple of centimetres of body.
      thick = 0.22 + (thick - 0.22) * t;
    }
    const n = fold((nx * w) / 0.3, (nz * d) / 0.3, seed);
    // THE SEAM. Without it this is a smooth superellipsoid, and a smooth superellipsoid the size of
    // a pillow reads as a boulder — that was the single loudest wrong note on the whole bed. A real
    // pillowcase is sewn shut around a flange that stands out past the loft, so the silhouette has a
    // crisp equatorial line and the corners are pinched into little ears rather than rounded off.
    // `edge` is 1 exactly on the perimeter and dies away over the outer few centimetres.
    const edge = smooth(Math.min(1, Math.max(0, 1 - plump * 3.2)));
    // Corners: 1 only where BOTH axes are near their extreme. Cloth has more material to shed there
    // than anywhere else on the seam, so that is where it stands up.
    const corner = smooth(Math.min(1, Math.max(0, 1 - rx * 2.6))) * smooth(Math.min(1, Math.max(0, 1 - rz * 2.6)));
    const flange = 1 + 0.05 * edge + 0.05 * corner;
    // The ear lifts towards whichever face this vertex is on, so it flicks up on top and down below
    // instead of shearing the seam sideways. It must scale with `ny` and NOT with sign(ny): a sign
    // flips discontinuously across the seam, which tore the silhouette into a dumbbell — fat corners,
    // pinched waist — and that was the "bone" shape the pillows read as. `ny * 2` runs -1..1 through
    // the seam and passes through zero there, so the two faces meet. Small, too: at 0.4·h the corners
    // stood taller than the pillow's own loft.
    // …but a sewn Oxford hem lies flat, so the ears all but disappear once there is a border: what
    // stands up on a plain pillowcase is the surplus cloth at the corner, and on a bordered one that
    // surplus is already spread out into the hem.
    const ear = ny * 2 * h * (0.14 * corner + 0.035 * edge) * (border > 0 ? 0.35 : 1);
    pos.setX(i, nx * w * (1 - 0.04 * (1 - plump)) * flange);
    pos.setZ(i, nz * d * (1 - 0.04 * (1 - plump)) * flange);
    pos.setY(i, ny * h * thick + h * 0.09 * n * plump + ear);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}
