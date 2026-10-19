import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Renders a real IKEA glTF model (DRACO-compressed) at its native real-world scale. The model's
// origin sits on the floor, so the enclosing FurnitureItem group's position/rotation place it in
// the room directly. Cloned per instance so the same product can be placed multiple times.
export function GltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Lift the real product's PBR materials off the scene's image-based lighting so fabric,
        // wood and especially metal/chrome read with proper reflections even under the room's
        // deliberately soft window light — without touching the global lighting balance.
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          if (std && 'envMapIntensity' in std) std.envMapIntensity = 1.35;
        }
      }
    });
    return clone;
  }, [scene]);
  return <primitive object={object} />;
}
