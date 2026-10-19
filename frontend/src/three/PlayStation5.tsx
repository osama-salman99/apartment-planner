import { useMemo } from 'react';
import * as THREE from 'three';
import { cmToM } from '../lib/units';

/**
 * PlayStation 5 Digital Edition — the 2023 model (CFI-2000B, the one on sale now), standing on its
 * vertical stand or lying flat on the two small feet.
 *
 * Sony's published envelope is 358 × 80 × 216 mm, which is what the geometry below is built at
 * (Wikipedia quotes the same figures for the disc model at 96 mm wide). No downloadable model of the
 * console exists that is actually free to use — the accurate ones on Sketchfab are all login-gated,
 * and Sony publishes none — so this is built, not imported.
 *
 * What makes it read as a PS5 rather than a white box: the two covers are not slabs. They sail
 * outward from a much darker, narrower chassis, widest around mid-height, and stand slightly proud
 * of it at top and bottom. The Digital Edition has no disc slot, so the front carries only the
 * power button, the USB ports and the blue light line — that absence is the whole visual
 * difference from the disc model.
 *
 * W/D/H still drive it: the piece is built at Sony's real size and scaled to whatever envelope the
 * placed item has, so a resize is a resize rather than a no-op.
 */

/** Sony's figures for the Digital Edition, in cm: 358 × 80 × 216 mm. */
const CONSOLE_H = 35.8;
const CONSOLE_W = 8.0;
const CONSOLE_D = 21.6;
/** The round foot of the vertical stand. */
const BASE_H = 1.6;
const BASE_R = 5.0;
/** The two little pads it rests on lying down, in place of the vertical stand. */
const FOOT_H = 1.2;

/** Standing: the console on its stand, footprint sized by the round foot. */
export const PS5_DIMS = { w: BASE_R * 2, d: CONSOLE_D, h: CONSOLE_H + BASE_H };
/**
 * Lying down: the same console tipped onto one cover, so its long axis runs across and what was
 * the width becomes the height. Depth is unchanged — it is the same 216 mm front-to-back either
 * way, which is why the flat orientation is the one that fits on a TV bench.
 */
export const PS5_FLAT_DIMS = { w: CONSOLE_H, d: CONSOLE_D, h: CONSOLE_W + FOOT_H };

/**
 * One cover, as its side outline extruded across the console's width and then bowed.
 *
 * The outline is drawn in the depth/height plane with a big radius on the top-front corner — the
 * lean that gives the console its silhouette. Bowing the vertices afterwards is what turns a flat
 * cover into the sail: the offset peaks at mid-height and falls to nothing at the ends, so the
 * cover still meets the chassis top and bottom.
 */
function coverGeometry(d: number, h: number, t: number, bow: number): THREE.BufferGeometry {
  const r = Math.min(d * 0.2, h * 0.12);
  const s = new THREE.Shape();
  s.moveTo(-d / 2 + r * 0.4, 0);
  s.lineTo(d / 2 - r * 0.5, 0);
  s.quadraticCurveTo(d / 2, 0, d / 2, r * 0.5);
  s.lineTo(d / 2, h - r * 2.1);
  s.quadraticCurveTo(d / 2, h, d / 2 - r * 1.9, h);
  s.lineTo(-d / 2 + r * 0.7, h);
  s.quadraticCurveTo(-d / 2, h, -d / 2, h - r * 0.9);
  s.lineTo(-d / 2, r * 0.5);
  s.quadraticCurveTo(-d / 2, 0, -d / 2 + r * 0.4, 0);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: t,
    bevelEnabled: true,
    bevelThickness: t * 0.3,
    bevelSize: t * 0.3,
    bevelSegments: 3,
    curveSegments: 28,
  });
  // Extrude builds along +Z, but the cover's thickness is the console's WIDTH — so the extrusion
  // axis is rotated onto X, which sends the outline's own depth axis to Z where it belongs.
  geo.rotateY(Math.PI / 2);

  // Two deformations turn a flat cover into the PS5's sail. The bow pushes it away from the
  // chassis, peaking above mid-height (^0.75 leans the fullness upward, where the real cover's
  // is); the taper pulls the bottom in along the depth axis, so the console narrows into its
  // stand instead of sitting on a full-depth slab.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t01 = THREE.MathUtils.clamp(pos.getY(i) / h, 0, 1);
    const f = Math.sin(Math.PI * Math.pow(t01, 0.75));
    pos.setX(i, pos.getX(i) + bow * f);
    pos.setZ(i, pos.getZ(i) * (0.87 + 0.13 * THREE.MathUtils.smoothstep(t01, 0, 0.55)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * The console itself, built standing with its bottom on the origin, so the orientation below is
 * only a matter of where this group is put and how it is turned.
 */
function ConsoleBody() {
  // The width budget is Sony's 80 mm at the console's widest point: chassis 44 + two 5.5 covers +
  // two 12.5 of bow. The chassis is shallower and a little shorter than the covers too, so they
  // stand proud of it all the way round and the dark waist between them stays visible.
  const coverT = cmToM(0.55);
  const bow = cmToM(1.25);
  const chassisW = cmToM(4.4);
  // Kept clear of the covers' rounded top-back corner: any chassis that reaches into it shows as
  // a black square poking out of the silhouette.
  const chassisD = cmToM(CONSOLE_D) * 0.85;
  const chassisH = cmToM(CONSOLE_H - 1.4);
  const half = chassisW / 2;

  const covers = useMemo(() => {
    const d = cmToM(CONSOLE_D);
    const h = cmToM(CONSOLE_H);
    // Generated per side rather than mirrored with a negative scale, which would flip the normals
    // and light one cover inside out.
    return {
      right: coverGeometry(d, h, coverT, bow),
      left: coverGeometry(d, h, coverT, -bow),
    };
  }, [coverT, bow]);

  return (
    <group>
      {/* Chassis */}
      <mesh position={[0, chassisH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[chassisW, chassisH, chassisD]} />
        <meshStandardMaterial color="#191a1e" roughness={0.62} />
      </mesh>
      {/* Top vent, sunk into the chassis between the cover tips. */}
      <mesh position={[0, chassisH - cmToM(0.15), 0]}>
        <boxGeometry args={[chassisW * 0.82, cmToM(0.35), chassisD * 0.86]} />
        <meshStandardMaterial color="#0d0e11" roughness={0.9} />
      </mesh>

      {/* Covers */}
      <mesh geometry={covers.right} position={[half, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f1f0ee" roughness={0.28} metalness={0.04} />
      </mesh>
      <mesh geometry={covers.left} position={[-half - coverT, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f1f0ee" roughness={0.28} metalness={0.04} />
      </mesh>

      {/* The light line down the front edge of the chassis — the console's one bright feature,
          and a thin one: a few millimetres wide, not a blue panel. Lying down it becomes the
          horizontal line along the front, which is exactly what the real one does. */}
      <mesh position={[0, chassisH * 0.52, chassisD / 2 + cmToM(0.03)]}>
        <boxGeometry args={[cmToM(0.35), chassisH * 0.66, cmToM(0.06)]} />
        <meshStandardMaterial color="#1d5fd8" emissive="#2f7dff" emissiveIntensity={0.9} roughness={0.4} />
      </mesh>

      {/* Front furniture: power button and the two USB ports, low down where they really are.
          No disc slot — this is the Digital Edition, and that absence is the only way to tell
          the two models apart. */}
      <mesh position={[0, cmToM(3.1), chassisD / 2 + cmToM(0.03)]}>
        <boxGeometry args={[cmToM(0.7), cmToM(0.3), cmToM(0.05)]} />
        <meshStandardMaterial color="#33353b" roughness={0.45} />
      </mesh>
      {[-1, 1].map((f) => (
        <mesh key={f} position={[cmToM(0.85) * f, cmToM(1.9), chassisD / 2 + cmToM(0.03)]}>
          <boxGeometry args={[cmToM(0.8), cmToM(0.32), cmToM(0.05)]} />
          <meshStandardMaterial color="#22242a" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export function PlayStation5({
  w: wCm,
  d: dCm,
  h: hCm,
  lying = false,
}: {
  w: number;
  d: number;
  h: number;
  lying?: boolean;
}) {
  const dims = lying ? PS5_FLAT_DIMS : PS5_DIMS;
  // Built at Sony's real size, then scaled into whatever envelope the placed item carries.
  const scale: [number, number, number] = [wCm / dims.w, hCm / dims.h, dCm / dims.d];

  if (lying) {
    // Tipped onto one cover: a -90° turn about Z sends the console's height axis to +X and its
    // width axis to -Y, so the long side runs across, the front still faces +Z, and the light
    // line runs horizontally along it. The offsets then re-centre it and set it down on the pads.
    return (
      <group scale={scale}>
        {/* The two feet the console lies on — small dark pads near the ends, not the round stand. */}
        {[-1, 1].map((f) => (
          <mesh key={f} position={[cmToM(11) * f, cmToM(FOOT_H) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[cmToM(6), cmToM(FOOT_H), cmToM(12)]} />
            <meshStandardMaterial color="#1c1d21" roughness={0.5} />
          </mesh>
        ))}
        <group
          position={[-cmToM(CONSOLE_H) / 2, cmToM(CONSOLE_W / 2 + FOOT_H), 0]}
          rotation={[0, 0, -Math.PI / 2]}
        >
          <ConsoleBody />
        </group>
      </group>
    );
  }

  return (
    <group scale={scale}>
      {/* Vertical stand: a round foot under the chassis. */}
      <mesh position={[0, cmToM(BASE_H) / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[cmToM(BASE_R), cmToM(BASE_R), cmToM(BASE_H), 40]} />
        <meshStandardMaterial color="#1c1d21" roughness={0.5} />
      </mesh>
      <group position={[0, cmToM(BASE_H), 0]}>
        <ConsoleBody />
      </group>
    </group>
  );
}
