import { Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { cmToM } from '../lib/units';
import { ModelErrorBoundary } from './ModelErrorBoundary';

/**
 * ONSEVIG (art. 70626744, €99) — IKEA's round low-pile rug, Ø160, in the multicolour medallion
 * pattern. The catalog has no glTF for it, and a rug is the one archetype where the *pattern* is
 * the product: a plain coloured disc says nothing about which rug this is. So it renders as its own
 * piece, with the product photo mapped onto its face.
 *
 * IKEA publishes only the diameter for this one, so 10 mm of pile is read off the "low pile"
 * description rather than published (`dimsSource: "estimate"` in the catalog).
 *
 * The photo is a flat top-down shot with the rug filling the frame, which is exactly what a
 * cylinder's cap UVs want: three maps a cap into the unit square with the circle inscribed, so the
 * pattern lands square with no unwrapping needed. What it does need is the photo's thin white
 * margin cropped off, or the rug renders with a pale halo around its border.
 */
export const ONSEVIG_DIMS = { w: 160, d: 160, h: 1 };

const TEXTURE_URL = '/media/images/70626744.jpg';
/**
 * Fraction of the photo that is white background on each side — measured off the file itself
 * (the rug spans x 30..1369 and y 38..1367 of 1400²). Erring a hair inside the pile beats leaving
 * any of it: a leftover sliver reads as a pale halo all the way round the border.
 */
const MARGIN = 0.026;
/** Cut pile edge and backing, sampled off the photo's border. */
const EDGE = '#cdc3b2';

function Face({ r, h }: { r: number; h: number }) {
  const tex = useTexture(TEXTURE_URL, (t) => {
    const one = Array.isArray(t) ? t[0] : t;
    one.colorSpace = THREE.SRGBColorSpace;
    one.repeat.set(1 - 2 * MARGIN, 1 - 2 * MARGIN);
    one.offset.set(MARGIN, MARGIN);
    // The pattern is a one-off, not a tile: clamp, or the crop's edge pixels wrap round and draw a
    // sliver of the opposite border.
    one.wrapS = THREE.ClampToEdgeWrapping;
    one.wrapT = THREE.ClampToEdgeWrapping;
    one.anisotropy = 8;
  });
  return (
    <mesh position={[0, h / 2, 0]} receiveShadow>
      <cylinderGeometry args={[r, r, h, 96, 1, false]} />
      {/* side, then the two caps — the pattern goes on the top one only */}
      <meshStandardMaterial attach="material-0" color={EDGE} roughness={1} />
      <meshStandardMaterial attach="material-1" map={tex as THREE.Texture} roughness={1} />
      <meshStandardMaterial attach="material-2" color={EDGE} roughness={1} />
    </mesh>
  );
}

/** Plain disc in the rug's ground colour, for while the photo loads or if it fails to. */
function Plain({ r, h }: { r: number; h: number }) {
  return (
    <mesh position={[0, h / 2, 0]} receiveShadow>
      <cylinderGeometry args={[r, r, h, 64, 1, false]} />
      <meshStandardMaterial color="#e6ded0" roughness={1} />
    </mesh>
  );
}

/**
 * `w`/`d`/`h` are the placed item's own, in cm, so a resized instance stretches to an oval the same
 * way every other archetype does — the rug is round at its default 160 × 160.
 */
export function OnsevigRug({ w, d, h }: { w: number; d: number; h: number }) {
  const hM = Math.max(0.004, cmToM(h));
  const plain = <Plain r={0.5} h={1} />;
  return (
    <group scale={[cmToM(w), hM, cmToM(d)]}>
      <ModelErrorBoundary fallback={plain}>
        <Suspense fallback={plain}>
          <Face r={0.5} h={1} />
        </Suspense>
      </ModelErrorBoundary>
    </group>
  );
}
