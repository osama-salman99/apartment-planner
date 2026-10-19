import { Suspense, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import { FurnitureMesh } from './three/FurnitureMeshes';
import { cmToM } from './lib/units';
import type { FurnitureShape, MaterialFamily } from './lib/types';

// Standalone single-element product shot. Two modes:
//   ?glb=/models/x.glb                          → render the REAL IKEA glTF model (photoreal)
//   ?shape=sofa&w=200&d=90&h=80&color=%23..      → render the procedural archetype (fallback)
// Studio lighting + a 3/4 camera, auto-framed to the piece. Used to show individual pieces and to
// iterate on realism.
const p = new URLSearchParams(location.search);
const glb = p.get('glb');
const shape = (p.get('shape') || 'sofa') as FurnitureShape;
const w = +(p.get('w') || 200);
const d = +(p.get('d') || 90);
const h = +(p.get('h') || 80);
const color = p.get('color') || '#b0724a';
const material = (p.get('material') || undefined) as MaterialFamily | undefined;
// Some archetypes vary by product name (a TV bench vs a "combi" storage wall) — pass it through.
const itemName = p.get('name') || undefined;

function GlbModel({ url }: { url: string }) {
  // Real IKEA models are DRACO-compressed (glb_draco) — enable the draco decoder.
  const { scene } = useGLTF(url, true);
  // Publish the model's own measurements: the overall box, and every part's box. That is how you
  // find the numbers a stacked piece has to match — the height of a bed's slat platform, the clear
  // span between its rails, which end the headboard is on — without guessing them off a screenshot.
  useEffect(() => {
    const all = new THREE.Box3().setFromObject(scene);
    const parts: unknown[] = [];
    scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      const r = (v: number) => Math.round(v * 1000) / 10; // cm, 1 decimal
      parts.push({
        name: o.name,
        x: [r(b.min.x), r(b.max.x)],
        y: [r(b.min.y), r(b.max.y)],
        z: [r(b.min.z), r(b.max.z)],
      });
    });
    const r = (v: number) => Math.round(v * 1000) / 10;
    (window as unknown as Record<string, unknown>).__glb = {
      x: [r(all.min.x), r(all.max.x)],
      y: [r(all.min.y), r(all.max.y)],
      z: [r(all.min.z), r(all.max.z)],
      parts,
    };
    // The scene itself, so a harness can go further and sample the vertices — a merged mesh has no
    // parts to measure, and the number you actually need off a bed frame (the height of its slat
    // platform) only exists as a cloud of points inside the rails.
    (window as unknown as Record<string, unknown>).__glbScene = scene;
  }, [scene]);
  return <primitive object={scene} />;
}

// Pass BOTH glb and shape to stack an archetype on a real model at height ?y= (cm) — how you check
// that a piece meant to sit on another one (bedding on a bed frame) lands at the right level.
const overY = p.has('y') ? +(p.get('y') as string) : null;
// ?dz= shifts the stacked piece along the model's own depth axis (cm). A frame is rarely symmetric
// about its centre — the IDANÄS spends 17 cm of its length on the headboard — so the layer that lies
// on it is not centred on the model, and without this the whole check is off by half that.
const overZ = p.has('dz') ? +(p.get('dz') as string) : 0;
const withShape = p.has('shape');

function Piece() {
  const archetype = (
    <FurnitureMesh shape={shape} w={w} d={d} h={h} color={color} material={material} name={itemName} />
  );
  if (!glb) return archetype;
  return (
    <group>
      <GlbModel url={glb} />
      {withShape && overY !== null && (
        <group position={[0, cmToM(overY), cmToM(overZ)]}>{archetype}</group>
      )}
    </group>
  );
}

// Rough scene scale for lighting/shadow sizing (real GLBs are ~1-2.5m; procedural uses its dims).
const size = glb ? 1.6 : Math.max(cmToM(w), cmToM(d), cmToM(h));

function Scene() {
  return (
    <>
      <color attach="background" args={['#eceae5']} />
      <hemisphereLight intensity={0.5} groundColor={'#bdb8ad'} color={'#ffffff'} />
      <directionalLight
        position={[size * 2, size * 3, size * 1.5]}
        intensity={2.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-size * 2, size * 2, size * 2, -size * 2, 0.1, size * 12]} />
      </directionalLight>
      <directionalLight position={[-size * 2, size * 1.5, -size * 1.5]} intensity={0.45} />
      <Suspense fallback={null}>
        {/* Soft image-based lighting makes real materials read correctly; preset is fetched once. */}
        {glb && <Environment preset="apartment" />}
        <Bounds fit clip observe margin={1.15}>
          <Piece />
        </Bounds>
      </Suspense>
      <ContactShadows position={[0, 0.002, 0]} opacity={0.45} scale={size * 4} blur={2.4} far={size * 2.2} resolution={1024} />
      <OrbitControls makeDefault enablePan={false} />
    </>
  );
}

// ?top=1 looks straight down and ?side=1 is a true side elevation — the two views that settle
// whether a stacked piece is centred, and what sits at which height. Both are ORTHOGRAPHIC on
// purpose: under perspective a 2 m bed foreshortens so hard that a layer resting on another one
// looks like it is floating, which sent this exact investigation down a blind alley once.
const ortho = p.has('top') || p.has('side');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Canvas
    shadows
    orthographic={ortho}
    camera={{
      position: p.has('top')
        ? [0, size * 3, 0.001]
        : p.has('side')
          // Level with the middle of the piece, so the sight line is horizontal and heights read
          // off directly. Aim it low and you look UP at the underside, which fakes gaps under
          // every layer — exactly the false "floating bedding" this view was added to disprove.
          ? [size * 3, size * 0.38, 0.001]
          : [size * 1.4, size * 1.1, size * 1.9],
      ...(ortho ? { zoom: 260, near: -size * 20, far: size * 20 } : { fov: 32 }),
    }}
    style={{ position: 'fixed', inset: 0 }}
  >
    <Scene />
  </Canvas>,
);
