import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { cmToM } from '../lib/units';
import { BestaLackCombi } from './BestaLackCombi';

/**
 * TV furniture, from a 45 cm bench to a 2.3 m storage wall — off one parametric build.
 *
 * Why this exists: IKEA's "Tv-meubel, **combi**" SKUs are whole wall arrangements (a low bench plus
 * cabinets or wall shelves above it), and the ones the catalog has no glTF for — BESTÅ, BESTÅ/LACK,
 * BRIMNES, BILLY/BESTÅ, KALLAX/LACK, TONSTAD — fell back to the generic archetype, which was one
 * solid box at the published envelope. A BESTÅ/LACK combi is 240 × 42 × **193**, so the fallback
 * came out as a 2 m-tall slab of chipboard-coloured wall. Height is the whole point of a combi, so
 * it has to be built as separate volumes with air between them.
 *
 * Everything below is driven by W/D/H, so a resize still means something:
 *   - up to ~90 cm tall it is just the bench: plinth-recessed base, scribed door/drawer fronts.
 *   - taller than that, the bench keeps bench proportions and the remaining height becomes an upper
 *     section, with an open bay above the bench where the TV actually goes.
 *
 * The upper section comes in two flavours because the real products do. `shelves` (LACK, BERGSHULT
 * and friends) are shallow wall boards spanning the width; `cabinets` (BESTÅ, BRIMNES, BILLY,
 * TONSTAD, HAVSTA) are full-depth columns flanking the TV bay, bridged by a top cabinet when there
 * is room for one. The name picks between them — see `upperStyle` — and cabinets is the default,
 * since that is what most of the range is.
 */

/** Bench-only above this height would be a wardrobe, not a TV bench (cm). */
const COMBI_MIN_H = 90;
/** A bench on its own is about this tall; a combi's bench stays near it however tall the wall is. */
const BENCH_H = 50;
/** Clear space left above the bench for the TV (cm) — a 55" screen is ~70 cm tall. */
const BAY_MIN_H = 62;
const PLINTH_H = 6;
const BOARD_T = 5;

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

/**
 * The scribed joint colour. Fronts are drawn as a recessed line, which on a mid-tone carcase means
 * a darker shade — but on a black unit (and black is what half of this range actually comes in) a
 * darker line is no line at all, and the bench goes back to reading as one plain block. So the
 * scribing goes the other way on a dark body: it becomes the highlight along the shadow gap.
 */
function jointColor(hex: string): string {
  const { l } = new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 });
  return shade(hex, l < 0.28 ? 0.16 : -0.14);
}

function upperStyle(name?: string): 'shelves' | 'cabinets' {
  return /\b(LACK|BERGSHULT|LAIVA)\b/i.test(name ?? '') ? 'shelves' : 'cabinets';
}

/** A carcase with its fronts scribed in: door/drawer joints as recessed dark lines, plus handles. */
function Carcase({
  w,
  h,
  d,
  y,
  z,
  color,
  dark,
  fronts,
  horizontal,
}: {
  w: number;
  h: number;
  d: number;
  y: number;
  z: number;
  color: string;
  dark: string;
  /** How many door/drawer fronts across (or up, when `horizontal`). 0 leaves it plain. */
  fronts: number;
  /** Drawers stack, doors sit side by side. */
  horizontal?: boolean;
}) {
  const joints: number[] = [];
  for (let i = 1; i < fronts; i++) joints.push(i / fronts);
  return (
    <group position={[0, y + h / 2, z]}>
      <RoundedBox args={[w, h, d]} radius={0.008} smoothness={2} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      {joints.map((f) => (
        <mesh
          key={f}
          position={
            horizontal ? [0, -h / 2 + h * f, d / 2 + 0.002] : [-w / 2 + w * f, 0, d / 2 + 0.002]
          }
        >
          <boxGeometry args={horizontal ? [w * 0.99, 0.006, 0.004] : [0.006, h * 0.99, 0.004]} />
          <meshStandardMaterial color={dark} roughness={0.6} />
        </mesh>
      ))}
      {/* Handles: one per front, on the joint side, so the piece reads as openable at plan scale too. */}
      {fronts > 1 &&
        Array.from({ length: fronts }, (_, i) => {
          const c = (i + 0.5) / fronts;
          return horizontal ? (
            <mesh key={i} position={[0, -h / 2 + h * c, d / 2 + 0.008]}>
              <boxGeometry args={[Math.min(w * 0.3, 0.18), 0.012, 0.012]} />
              <meshStandardMaterial color="#4a4a4a" metalness={0.5} roughness={0.4} />
            </mesh>
          ) : (
            <mesh key={i} position={[-w / 2 + w * c, -h * 0.1, d / 2 + 0.008]}>
              <boxGeometry args={[0.012, Math.min(h * 0.3, 0.16), 0.012]} />
              <meshStandardMaterial color="#4a4a4a" metalness={0.5} roughness={0.4} />
            </mesh>
          );
        })}
    </group>
  );
}

/**
 * BESTÅ / LACK is the one combination in this family whose packing list I have, and it is not a
 * symmetric TV wall at all — it steps up from a low door unit through the bench to a glass-door
 * column. Matched on name rather than on the Å, which the catalog is not guaranteed to spell in one
 * normalisation.
 */
function isBestaLack(name?: string): boolean {
  return /BEST/i.test(name ?? '') && /\bLACK\b/i.test(name ?? '');
}

export function TvUnit({
  w: wCm,
  d: dCm,
  h: hCm,
  color,
  name,
  mirrored,
}: {
  w: number;
  d: number;
  h: number;
  color: string;
  name?: string;
  mirrored?: boolean;
}) {
  if (isBestaLack(name) && hCm >= COMBI_MIN_H) {
    return <BestaLackCombi w={wCm} d={dCm} h={hCm} color={color} mirrored={mirrored} />;
  }

  const w = cmToM(wCm);
  const d = cmToM(dCm);
  const dark = jointColor(color);
  const plinthColor = shade(color, -0.3);

  // A plain bench: the whole height is the carcase, lifted off the floor on a recessed plinth.
  const benchOnly = hCm < COMBI_MIN_H;
  const benchHCm = benchOnly ? hCm : Math.min(BENCH_H, hCm * 0.35);
  const benchH = cmToM(benchHCm);
  const plinthH = cmToM(Math.min(PLINTH_H, benchHCm * 0.2));
  const carcaseH = benchH - plinthH;
  // Doors get wider than ~50 cm on nobody's TV bench, so the count follows the width.
  const benchFronts = Math.max(2, Math.round(wCm / 60));

  const plinth = (
    <mesh position={[0, plinthH / 2, 0]} receiveShadow>
      <boxGeometry args={[w * 0.94, plinthH, d * 0.9]} />
      <meshStandardMaterial color={plinthColor} roughness={0.7} />
    </mesh>
  );

  const bench = (
    <>
      {plinth}
      <Carcase
        w={w}
        h={carcaseH}
        d={d}
        y={plinthH}
        z={0}
        color={color}
        dark={dark}
        fronts={benchFronts}
        horizontal={benchOnly && hCm > 55}
      />
    </>
  );

  if (benchOnly) return <group>{bench}</group>;

  // Combi: everything from the top of the TV bay upwards is the upper section.
  const upperY = cmToM(benchHCm + BAY_MIN_H);
  const upperHCm = hCm - benchHCm - BAY_MIN_H;
  const upperH = cmToM(upperHCm);
  const style = upperStyle(name);

  if (style === 'shelves') {
    // Wall boards: shallower than the bench (they hang off the wall), back-aligned, and spaced so
    // the topmost sits at the stated overall height. Front is +Z, so the wall is at −Z.
    const boardT = cmToM(BOARD_T);
    const boardD = d * 0.62;
    const boardZ = -d / 2 + boardD / 2;
    const count = Math.max(1, Math.min(3, Math.round(upperHCm / 40) || 1));
    // Hung from the top down, not up from the bay: the published height is the *top* board, so a
    // combi with only room for one shelf must put it there rather than floating it mid-wall.
    const step = count > 1 ? upperH / (count - 1) : 0;
    const top = cmToM(hCm) - boardT / 2;
    return (
      <group>
        {bench}
        {Array.from({ length: count }, (_, i) => (
          <mesh key={i} position={[0, top - step * i, boardZ]} castShadow receiveShadow>
            <boxGeometry args={[w * 0.95, boardT, boardD]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
        ))}
      </group>
    );
  }

  // Cabinets: two columns up the sides of the TV bay. Keep a real bay between them — if the piece
  // is too narrow for that, the upper section becomes a single bridging cabinet instead.
  const colW = Math.min(w * 0.3, cmToM(60));
  const bayW = w - 2 * colW;
  const columns = bayW >= cmToM(90);
  const bridgeHCm = Math.min(40, upperHCm * (columns ? 0.45 : 1));
  const bridgeH = cmToM(bridgeHCm);
  // Only bridge across when the columns leave a stretch worth spanning and enough height for it.
  const bridge = columns && upperHCm - bridgeHCm >= 45;

  return (
    <group>
      {bench}
      {columns ? (
        <>
          {[-(w / 2 - colW / 2), w / 2 - colW / 2].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <Carcase
                w={colW}
                h={upperH}
                d={d}
                y={upperY}
                z={0}
                color={color}
                dark={dark}
                fronts={Math.max(2, Math.round(upperHCm / 45))}
                horizontal
              />
            </group>
          ))}
          {bridge && (
            <Carcase
              w={bayW}
              h={bridgeH}
              d={d * 0.85}
              y={cmToM(hCm - bridgeHCm)}
              z={-d / 2 + (d * 0.85) / 2}
              color={color}
              dark={dark}
              fronts={Math.max(2, Math.round(bayW / cmToM(60)))}
            />
          )}
        </>
      ) : (
        <Carcase
          w={w}
          h={bridgeH}
          d={d}
          y={cmToM(hCm - bridgeHCm)}
          z={0}
          color={color}
          dark={dark}
          fronts={Math.max(2, Math.round(wCm / 60))}
        />
      )}
    </group>
  );
}
