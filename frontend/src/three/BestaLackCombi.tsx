import * as THREE from 'three';
import { cmToM } from '../lib/units';
import { sharedTextures } from '../lib/textures';

/**
 * The BESTÅ / LACK "Tv-meubel, combi" as the real product, not as a TV-wall archetype.
 *
 * IKEA sells combinations under an `s`-prefixed number and publishes no glTF for them, so this one
 * is built from its actual packing list, scraped off the PDP for s89398742 (240 × 42 × 129,
 * black-brown, €401.98):
 *
 *   1 × BESTÅ frame 60×40×128        1 × BESTÅ TV bench 120×40×38
 *   1 × BESTÅ frame 60×40×64         2 × LACK wall shelf 110×26
 *   2 × LAPPVIKEN door 60×64         2 × LAPPVIKEN drawer front 60×26
 *   1 × SINDVIK glass door 60×64     1 × BESTÅ glass shelf 56×36 + 5 × shelf 56×36
 *   2 × drawer frame 60×15×40, push-open runners
 *
 * Which the product photo arranges as a staircase, left to right: the 64-high unit behind one solid
 * door, the 120 bench with two push-open drawers and an open slot above them, then the 128 column
 * with a solid door below and the glass door above. Two LACK boards hang on the wall over the low
 * half, staggered — the lower one butting the column, the upper one further left.
 *
 * Two things worth knowing about the numbers:
 *  - The published 42 depth is the 40 carcase with its doors standing 2 proud, so the carcase is set
 *    back and the fronts are what reaches 42.
 *  - Wall-shelf height is the customer's choice, so IKEA's stated overall height is the only fix on
 *    it. Hanging the top board with its top face exactly at H is what makes 128 of frame come out as
 *    a 129 combination — and it keeps a resize meaningful.
 *
 * Everything is driven by W/D/H so the other members of the range work too: the 300×42×195 and
 * 240×42×193 combos get the 192 frame instead of the 128, and a stretched width goes into the bench.
 */

/** BESTÅ frames come in these heights, so the column is the tallest one that fits (cm). */
const FRAME_HEIGHTS = [64, 128, 192];
const DOOR_T = 2;
const PANEL_T = 1.6;
/** LACK wall shelf: 110 × 26, and 5 thick with its hollow honeycomb core. */
const LACK = { w: 110, d: 26, t: 5 };
const COL_W = 60;
const LOW_W = 60;
const LOW_H = 64;
const BENCH_H = 38;
/** The bench's drawer fronts are 26 of the 38, leaving an open slot under the top. */
const DRAWER_FRONT_H = 26;

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

/**
 * The grain bump, scaled to the panel it is on so a 2.4 m front and a 15 cm reveal carry the same
 * physical grain rather than the same number of stripes. Sheets are cached at half-repeat steps —
 * a couple of textures for the whole piece instead of a clone per panel.
 */
const grainCache = new Map<string, THREE.Texture>();
function grainFor(uM: number, vM: number): THREE.Texture {
  const q = (n: number) => Math.max(1, Math.round((n / 0.6) * 2) / 2);
  const u = q(uM);
  const v = q(vM);
  const key = `${u}x${v}`;
  let t = grainCache.get(key);
  if (!t) {
    t = sharedTextures().boardGrain.clone();
    t.repeat.set(u, v);
    t.needsUpdate = true;
    grainCache.set(key, t);
  }
  return t;
}

function Panel({
  w,
  h,
  d,
  pos,
  color,
  rough = 0.55,
  grain = true,
}: {
  w: number;
  h: number;
  d: number;
  pos: [number, number, number];
  color: string;
  rough?: number;
  /** Off for the things that aren't laminated board: the cable cut-out, the shadow gaps. */
  grain?: boolean;
}) {
  const bump = grain ? grainFor(Math.max(w, d), Math.max(h, d)) : undefined;
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={rough} bumpMap={bump} bumpScale={bump ? 0.05 : 0} />
    </mesh>
  );
}

/**
 * An open-fronted carcase: five panels rather than one solid block, so what you see through a glass
 * door is a real interior with real reveals. `y`/`x` are the bottom-centre of the box, in metres.
 */
function Carcase({
  w,
  h,
  d,
  x,
  y,
  zBack,
  color,
  inner,
  children,
}: {
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  zBack: number;
  color: string;
  inner: string;
  children?: React.ReactNode;
}) {
  const t = cmToM(PANEL_T);
  const zc = zBack + d / 2;
  return (
    <group position={[x, y, zc]}>
      {/* sides */}
      <Panel w={t} h={h} d={d} pos={[-w / 2 + t / 2, h / 2, 0]} color={color} />
      <Panel w={t} h={h} d={d} pos={[w / 2 - t / 2, h / 2, 0]} color={color} />
      {/* top and bottom, between the sides */}
      <Panel w={w - 2 * t} h={t} d={d} pos={[0, h - t / 2, 0]} color={color} />
      <Panel w={w - 2 * t} h={t} d={d} pos={[0, t / 2, 0]} color={color} />
      {/* back panel, thin and a shade darker like the real hardboard back */}
      <Panel w={w - 2 * t} h={h - 2 * t} d={t * 0.4} pos={[0, h / 2, -d / 2 + t * 0.2]} color={inner} rough={0.8} />
      {children}
    </group>
  );
}

export function BestaLackCombi({
  w: wCm,
  d: dCm,
  h: hCm,
  color,
  mirrored,
}: {
  w: number;
  d: number;
  h: number;
  color: string;
  mirrored?: boolean;
}) {
  // Fronts are a touch lighter than the carcase on the real thing (different foil on a different
  // board), and the interior a touch darker. On black-brown that difference is most of what makes
  // the piece read as separate doors rather than one dark mass.
  const front = shade(color, 0.035);
  const inner = shade(color, -0.06);
  const gap = shade(color, -0.16);

  const carcaseDCm = Math.max(20, dCm - DOOR_T);
  const d = cmToM(carcaseDCm);
  const doorT = cmToM(DOOR_T);
  // Front is +Z, so the wall is at −Z: the carcase backs onto it and the doors face the room.
  const zBack = -cmToM(dCm) / 2;
  const zFront = zBack + d;

  // Widths: the column and the low unit are 60 modules; the bench takes what is left. A narrow
  // combination drops the low unit before it starts shrinking the modules.
  const colWCm = Math.min(COL_W, wCm * 0.3);
  const withLow = wCm - colWCm >= 150;
  const lowWCm = withLow ? Math.min(LOW_W, wCm * 0.3) : 0;
  const benchWCm = wCm - colWCm - lowWCm;

  // The column is the tallest standard frame that fits under the stated height.
  const colHCm = FRAME_HEIGHTS.filter((f) => f <= hCm - 1).pop() ?? Math.max(38, hCm - 1);
  const lowHCm = Math.min(LOW_H, colHCm - 26);
  const benchHCm = Math.min(BENCH_H, lowHCm - 10);

  const sx = mirrored ? -1 : 1;
  // Module centres, left to right: low unit, bench, column.
  const lowX = sx * cmToM(-wCm / 2 + lowWCm / 2);
  const benchX = sx * cmToM(-wCm / 2 + lowWCm + benchWCm / 2);
  const colX = sx * cmToM(wCm / 2 - colWCm / 2);
  const colLeftFace = cmToM(wCm / 2 - colWCm);

  const colW = cmToM(colWCm);
  const lowW = cmToM(lowWCm);
  const benchW = cmToM(benchWCm);
  const colH = cmToM(colHCm);
  const lowH = cmToM(lowHCm);
  const benchH = cmToM(benchHCm);

  // The column is a 64 door with the glass door above it, so its own door line sits at 64.
  const colDoorHCm = Math.min(64, colHCm / 2);
  const colDoorH = cmToM(colDoorHCm);
  const glassH = colH - colDoorH;

  const drawerHCm = Math.min(DRAWER_FRONT_H, benchHCm - 6);
  const drawerH = cmToM(drawerHCm);
  const drawers = Math.max(1, Math.round(benchWCm / 60));

  // Wall boards: the top one's top face is the combination's stated height, the other 26 below it
  // (the board's own depth — the interval the product photo uses). The lower board is pushed right
  // to butt the column; the upper one sits back at the far end.
  const boardW = cmToM(Math.min(LACK.w, wCm - colWCm - 10));
  const boardD = cmToM(Math.min(LACK.d, carcaseDCm * 0.7));
  const boardT = cmToM(LACK.t);
  const boardZ = zBack + boardD / 2;
  const lowerY = cmToM(hCm - LACK.d) - boardT / 2;
  const upperY = cmToM(hCm) - boardT / 2;
  const boards: Array<[number, number]> = [
    [sx * (colLeftFace - boardW / 2), lowerY],
    [sx * (-cmToM(wCm) / 2 + boardW / 2), upperY],
  ];

  return (
    <group>
      {/* ── the 64-high unit, one solid push-open door ───────────────────────────────── */}
      {withLow && (
        <>
          <Carcase w={lowW} h={lowH} d={d} x={lowX} y={0} zBack={zBack} color={color} inner={inner} />
          <Panel
            w={lowW - cmToM(0.4)}
            h={lowH - cmToM(0.4)}
            d={doorT}
            pos={[lowX, lowH / 2, zFront + doorT / 2]}
            color={front}
            rough={0.5}
          />
        </>
      )}

      {/* ── the TV bench: two push-open drawers under an open slot ──────────────────── */}
      <Carcase w={benchW} h={benchH} d={d} x={benchX} y={0} zBack={zBack} color={color} inner={inner}>
        {/* divider between the two drawer bays */}
        {drawers > 1 && <Panel w={cmToM(PANEL_T)} h={benchH - cmToM(2 * PANEL_T)} d={d} pos={[0, benchH / 2, 0]} color={color} />}
      </Carcase>
      {Array.from({ length: drawers }, (_, i) => {
        const cx = benchX + (sx * (-benchW / 2 + (benchW / drawers) * (i + 0.5)));
        return (
          <group key={i}>
            <Panel
              w={benchW / drawers - cmToM(0.4)}
              h={drawerH}
              d={doorT}
              pos={[cx, drawerH / 2 + cmToM(0.6), zFront + doorT / 2]}
              color={front}
              rough={0.5}
            />
            {/* the shadow gap the open slot leaves between drawer front and bench top */}
            <Panel
              w={benchW / drawers - cmToM(1.2)}
              h={benchH - drawerH - cmToM(PANEL_T + 0.6)}
              d={cmToM(0.4)}
              pos={[cx, (drawerH + benchH) / 2, zFront - cmToM(0.2)]}
              color={gap}
              rough={0.9}
              grain={false}
            />
          </group>
        );
      })}
      {/* the cable cut-out at the back of the bench top, visible in every product shot */}
      <Panel
        w={cmToM(9)}
        h={cmToM(0.6)}
        d={cmToM(5)}
        pos={[benchX + sx * benchW * 0.22, benchH - cmToM(PANEL_T) / 2, zBack + cmToM(6)]}
        color="#141110"
        rough={0.95}
        grain={false}
      />

      {/* ── the tall column: solid door below, SINDVIK glass door above ─────────────── */}
      <Carcase w={colW} h={colH} d={d} x={colX} y={0} zBack={zBack} color={color} inner={inner}>
        {/* the fixed shelf on the door line, plus the glass shelf inside the display half */}
        <Panel w={colW - cmToM(2 * PANEL_T)} h={cmToM(PANEL_T)} d={d * 0.92} pos={[0, colDoorH, 0]} color={color} />
        <mesh position={[0, colDoorH + glassH * 0.48, 0]}>
          <boxGeometry args={[colW - cmToM(2 * PANEL_T + 0.8), cmToM(0.5), d * 0.88]} />
          <meshPhysicalMaterial color="#dfe7e6" transparent opacity={0.34} roughness={0.08} metalness={0} />
        </mesh>
      </Carcase>
      <Panel
        w={colW - cmToM(0.4)}
        h={colDoorH - cmToM(0.4)}
        d={doorT}
        pos={[colX, colDoorH / 2, zFront + doorT / 2]}
        color={front}
        rough={0.5}
      />
      {/* SINDVIK: a slim frame in the same finish around a single pane. */}
      <group position={[colX, colDoorH + glassH / 2, zFront + doorT / 2]}>
        <mesh>
          <boxGeometry args={[colW - cmToM(0.4), glassH - cmToM(0.6), doorT * 0.5]} />
          <meshPhysicalMaterial
            color="#c9d6d4"
            transparent
            opacity={0.24}
            roughness={0.05}
            metalness={0}
          />
        </mesh>
        {[
          [0, glassH / 2 - cmToM(1.1), colW - cmToM(0.4), cmToM(2.2)],
          [0, -glassH / 2 + cmToM(1.1), colW - cmToM(0.4), cmToM(2.2)],
          [-colW / 2 + cmToM(1.3), 0, cmToM(2.2), glassH - cmToM(0.6)],
          [colW / 2 - cmToM(1.3), 0, cmToM(2.2), glassH - cmToM(0.6)],
        ].map(([px, py, pw, ph], i) => (
          <mesh key={i} position={[px, py, 0]} castShadow>
            <boxGeometry args={[pw, ph, doorT]} />
            <meshStandardMaterial color={front} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ── the two LACK wall boards ────────────────────────────────────────────────── */}
      {boards.map(([bx, by], i) => (
        <mesh key={i} position={[bx, by, boardZ]} castShadow receiveShadow>
          <boxGeometry args={[boardW, boardT, boardD]} />
          <meshStandardMaterial color={front} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}
