import { useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';
import { mergeBufferGeometries } from 'three-stdlib';
import { WIDTH, DEPTH } from '../lib/dimensions';
import {
  makeRenderFacadeTexture,
  makeBrickTexture,
  makeWindowFacadeTexture,
} from '../lib/outdoorTextures';
import { useLayoutStore } from '../state/layoutStore';

// The whole exterior is modeled on the unit's real 360°-tour bedroom-window photo: a light
// asphalt parking lot filled with cars, a grass median, and a ring of mid-rises across the way
// — warm-render and brick blocks with regular windows and recessed balconies, all still framed
// by a newly-landscaped, under-development setting. 6th floor, so street level sits ~18m below
// the room; building heights are absolute from there so rooftops land at/below the horizon.
export const GROUND_OFFSET = -18;

// --- Real-world geo-reference (Stage: real surroundings) --------------------------------------

// A window-grid facade painted procedurally from world position, so the merged building massing
// reads as rows of glazing without per-building UVs. Vertical faces only (roofs stay plain); floors
// every ~3.1 m, window columns every ~2.6 m.
function makeBuildingMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vWNorm = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          if (abs(vWNorm.y) < 0.5) {
            float u = (abs(vWNorm.x) > abs(vWNorm.z)) ? vWPos.z : vWPos.x;
            float v = vWPos.y - (${GROUND_OFFSET.toFixed(1)});
            float fv = fract(v / 3.1);
            float fu = fract(u / 2.6);
            float win = step(0.30, fv) * step(fv, 0.85) * step(0.16, fu) * step(fu, 0.80);
            float sky = clamp(0.45 + vWNorm.x * 0.35 + vWNorm.z * 0.2, 0.2, 0.8);
            vec3 glass = mix(vec3(0.20, 0.24, 0.30), vec3(0.62, 0.72, 0.82), sky);
            diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * 0.80);
          }
        }`,
      );
  };
  return m;
}

// Seeded RNG so the scene is identical every load (no flicker between renders).
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  floorH: number;
  body: string;
  facade: 'render' | 'brick';
  balconies: boolean;
  seed: number;
}

// Heights are deliberately modest (3–5 storeys). From a 6th-floor window the opposite blocks'
// rooftops should sit at or just BELOW the horizon, as they do in the real photo — a taller
// tower would loom over eye level, which reads wrong for floor 6. They're also staggered with a
// gap toward the centre so the view stays open rather than being walled off by one big block.
const BUILDINGS: BuildingSpec[] = [
  { x: -20, z: -50, w: 22, d: 12, floors: 4, floorH: 3.0, body: '#b58a68', facade: 'brick', balconies: true, seed: 23 },
  { x: 20, z: -56, w: 20, d: 13, floors: 4, floorH: 3.0, body: '#d0c9bb', facade: 'render', balconies: true, seed: 11 },
  { x: 46, z: -70, w: 18, d: 13, floors: 5, floorH: 3.0, body: '#cfc8ba', facade: 'render', balconies: false, seed: 31 },
  { x: -44, z: -66, w: 22, d: 13, floors: 4, floorH: 3.0, body: '#bd9b7e', facade: 'brick', balconies: false, seed: 43 },
  { x: 66, z: -58, w: 16, d: 12, floors: 3, floorH: 3.1, body: '#d4ccbd', facade: 'render', balconies: true, seed: 57 },
  { x: -4, z: -92, w: 26, d: 15, floors: 5, floorH: 3.0, body: '#c9c2b4', facade: 'render', balconies: false, seed: 61 },
];

function Building({ spec }: { spec: BuildingSpec }) {
  const { w, d, floors, floorH } = spec;
  const h = floors * floorH;
  const rand = useMemo(() => rng(spec.seed), [spec.seed]);

  const facadeTex = useMemo(
    () => (spec.facade === 'brick' ? makeBrickTexture() : makeRenderFacadeTexture(spec.body)),
    [spec.facade, spec.body],
  );

  // Window grid on the front (+z) face.
  const bay = 2.6;
  const cols = Math.max(2, Math.floor(w / bay));
  const gapX = w / cols;
  const winW = gapX * 0.62;
  const winH = floorH * 0.6;

  const { frames, glass, balconies } = useMemo(() => {
    const frames: { pos: [number, number, number] }[] = [];
    const glass: { pos: [number, number, number]; color: string }[] = [];
    const balconies: { y: number }[] = [];
    for (let f = 0; f < floors; f++) {
      const y = f * floorH + floorH * 0.52;
      const isBalconyFloor = spec.balconies && f % 2 === 1;
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + gapX * (c + 0.5);
        frames.push({ pos: [x, y, d / 2 + 0.02] });
        const lit = rand() > 0.82;
        // Lighter, sky-tinted glass base (not near-black) so windows read as daylit glazing
        // reflecting an overcast sky; a few warm-lit ones for life.
        glass.push({
          pos: [x, y, d / 2 + 0.05],
          color: lit ? '#ffe9c0' : '#7d95a8',
        });
      }
      if (isBalconyFloor) balconies.push({ y: f * floorH });
    }
    return { frames, glass, balconies };
  }, [floors, floorH, cols, gapX, w, d, spec.balconies, rand]);

  return (
    <group position={[spec.x, GROUND_OFFSET, spec.z]}>
      {/* body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={facadeTex} color={spec.body} roughness={0.82} />
      </mesh>

      {/* window frames (recessed reveal) */}
      <Instances limit={frames.length} castShadow position={[0, 0, 0]}>
        <boxGeometry args={[winW + 0.14, winH + 0.14, 0.04]} />
        <meshStandardMaterial color="#3c3b38" roughness={0.7} />
        {frames.map((fr, i) => (
          <Instance key={i} position={fr.pos} />
        ))}
      </Instances>

      {/* glass */}
      <Instances limit={glass.length}>
        <boxGeometry args={[winW, winH, 0.03]} />
        <meshStandardMaterial roughness={0.1} metalness={0.2} envMapIntensity={1.6} />
        {glass.map((g, i) => (
          <Instance key={i} position={g.pos} color={g.color} />
        ))}
      </Instances>

      {/* recessed balconies: slab + glass railing */}
      {balconies.map((b, i) => (
        <group key={i} position={[0, b.y, d / 2 + 0.5]}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[w * 0.92, 0.12, 1.0]} />
            <meshStandardMaterial color="#b9b3a6" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.55, 0.48]}>
            <boxGeometry args={[w * 0.92, 0.95, 0.04]} />
            <meshStandardMaterial color="#aebdc8" roughness={0.15} metalness={0.1} transparent opacity={0.35} />
          </mesh>
        </group>
      ))}

      {/* parapet + rooftop plant room */}
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w + 0.15, 0.3, d + 0.15]} />
        <meshStandardMaterial color="#8f8a7d" roughness={0.9} />
      </mesh>
      <mesh position={[w * 0.2, h + 1.1, -d * 0.15]} castShadow>
        <boxGeometry args={[w * 0.3, 1.6, d * 0.35]} />
        <meshStandardMaterial color="#9a958a" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, GROUND_OFFSET, z]} scale={s}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 1.8, 6]} />
        <meshStandardMaterial color="#6b5842" roughness={0.9} />
      </mesh>
      {[
        [0, 2.1, 0, 0.95],
        [0.5, 2.4, 0.2, 0.7],
        [-0.45, 2.35, -0.15, 0.65],
        [0.1, 2.8, 0.1, 0.6],
      ].map(([ox, oy, oz, r], i) => (
        <mesh key={i} position={[ox, oy, oz]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? '#5f7a4c' : '#6d8a56'} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function LampPost({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, GROUND_OFFSET, z]}>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 5, 8]} />
        <meshStandardMaterial color="#3a3d40" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0.4, 5, 0]}>
        <boxGeometry args={[0.8, 0.16, 0.24]} />
        <meshStandardMaterial color="#4a4d50" roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Car({ x, z, rot, color }: { x: number; z: number; rot: number; color: string }) {
  return (
    <group position={[x, GROUND_OFFSET, z]} rotation={[0, rot, 0]}>
      {/* lower body */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.82, 0.6, 4.3]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} envMapIntensity={1.2} />
      </mesh>
      {/* cabin */}
      <mesh position={[0, 0.98, -0.2]} castShadow>
        <boxGeometry args={[1.66, 0.55, 2.2]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} envMapIntensity={1.2} />
      </mesh>
      {/* greenhouse glazing */}
      <mesh position={[0, 1.0, -0.2]}>
        <boxGeometry args={[1.7, 0.4, 2.05]} />
        <meshStandardMaterial color="#1c2833" roughness={0.08} metalness={0.3} envMapIntensity={1.8} />
      </mesh>
      {/* wheels */}
      {[
        [0.85, -1.3],
        [-0.85, -1.3],
        [0.85, 1.3],
        [-0.85, 1.3],
      ].map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.32, wz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.33, 0.33, 0.2, 12]} />
          <meshStandardMaterial color="#15161a" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

const CAR_COLORS = ['#e8e6e0', '#2b2f36', '#8a8f96', '#9c2a2f', '#26364a', '#c9c5bc', '#54585e', '#b9bcc0'];

/** A stack of pallets / building materials — the real photo shows these staged on the lot,
 * since the area around it is still under construction. */
function MaterialStack({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, GROUND_OFFSET, z]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.2, 0.7, 1.2]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.3, 0.16, 1.3]} />
        <meshStandardMaterial color="#8a6a44" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** The rest of the user's own building, below the 6th-floor apartment — just a facade so the
 * flat doesn't float. Same footprint, running from the room floor (y=0) down to street level. */
function BuildingBelow() {
  const h = -GROUND_OFFSET; // 18 m of building below
  const cy = GROUND_OFFSET / 2;
  const texFront = useMemo(() => makeWindowFacadeTexture(6, 5), []);
  const texSide = useMemo(() => makeWindowFacadeTexture(6, 8), []);
  const faces: { pos: [number, number, number]; rot: [number, number, number]; w: number; tex: THREE.Texture }[] = [
    { pos: [WIDTH / 2, cy, -0.03], rot: [0, Math.PI, 0], w: WIDTH, tex: texFront }, // front (window side)
    { pos: [WIDTH / 2, cy, DEPTH + 0.03], rot: [0, 0, 0], w: WIDTH, tex: texFront }, // back
    { pos: [-0.03, cy, DEPTH / 2], rot: [0, -Math.PI / 2, 0], w: DEPTH, tex: texSide }, // left
    { pos: [WIDTH + 0.03, cy, DEPTH / 2], rot: [0, Math.PI / 2, 0], w: DEPTH, tex: texSide }, // right
  ];
  return (
    // Shift the whole building down 8 cm so its top face never coincides with the flat's floor
    // at y=0 (that coincidence was the z-fighting flicker).
    <group position={[0, -0.08, 0]}>
      <mesh position={[WIDTH / 2, cy, DEPTH / 2]} receiveShadow>
        <boxGeometry args={[WIDTH, h, DEPTH]} />
        <meshStandardMaterial color="#cbc4b6" roughness={0.85} />
      </mesh>
      {faces.map((f, i) => (
        <mesh key={i} position={f.pos} rotation={f.rot}>
          <planeGeometry args={[f.w, h]} />
          <meshStandardMaterial map={f.tex} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export function OutdoorBackdrop() {
  const viewMode = useLayoutStore((s) => s.viewMode);
  const showGroundDetail = viewMode === 'window';

  const cars = useMemo(() => {
    const rand = rng(99);
    const list: { x: number; z: number; rot: number; color: string }[] = [];
    // Rows placed in the part of the lot the window camera actually frames (mid-distance),
    // parked nose-in toward the drive aisles, like the real photo's packed lot.
    for (const bankZ of [-30, -38, -46]) {
      for (let i = 0; i < 13; i++) {
        list.push({
          x: -30 + i * 4.6 + (rand() - 0.5) * 0.3,
          z: bankZ + (rand() - 0.5) * 0.4,
          rot: Math.PI / 2 + (rand() - 0.5) * 0.04,
          color: CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)],
        });
      }
    }
    return list;
  }, []);

  return (
    <group>
      {/* the user's own building below the flat */}
      <BuildingBelow />

      {showGroundDetail && (
        <>
          {cars.map((c, i) => (
            <Car key={i} x={c.x} z={c.z} rot={c.rot} color={c.color} />
          ))}
          <Tree x={-6} z={-25} s={1.3} />
          <Tree x={8} z={-25} s={1.1} />
          <Tree x={22} z={-25} s={1.25} />
          <Tree x={-20} z={-42} s={1.2} />
          <Tree x={4} z={-42} s={1.15} />
          <Tree x={-32} z={-25} s={1.2} />
          <LampPost x={-14} z={-15} />
          <LampPost x={2} z={-15} />
          <LampPost x={18} z={-15} />
          <MaterialStack x={-8} z={-19} color="#d8d4cc" />
          <MaterialStack x={-5.5} z={-20} color="#c2beb4" />
          <MaterialStack x={10} z={-21} color="#b23a3a" />
          <MaterialStack x={12} z={-20} color="#d8d4cc" />
          <MaterialStack x={0} z={-17} color="#8f9aa5" />
        </>
      )}
    </group>
  );
}
