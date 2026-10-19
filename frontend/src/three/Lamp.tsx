import * as THREE from 'three';
import type { PlacedItem } from '../lib/types';
import { cmToM } from '../lib/units';
import { useLayoutStore } from '../state/layoutStore';
import { CEILING_HEIGHT } from '../lib/dimensions';

// Lamps light the room at night only (20:00–06:00), per the brief; off during daylight. The shade
// glows (emissive) and casts a warm point light when "on"; both go dark at night.
export function Lamp({ item }: { item: PlacedItem }) {
  const hour = useLayoutStore((s) => s.sun.hourOfDay);
  const on = hour >= 20 || hour < 6; // lamps light the room at night only (20:00–06:00)
  const kind = lampKind(item);
  const h = cmToM(item.h);
  const shadeColor = item.colorHex || '#e8dcc0';
  const warm = '#ffd8a0';
  const shadeR = Math.max(0.09, cmToM(Math.max(item.w, item.d)) / 2);

  if (kind === 'pendant') {
    const y = CEILING_HEIGHT - 0.5;
    return (
      <group>
        <mesh position={[0, (CEILING_HEIGHT + y) / 2, 0]}>
          <cylinderGeometry args={[0.006, 0.006, CEILING_HEIGHT - y, 6]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[0, y, 0]} castShadow>
          <coneGeometry args={[shadeR, shadeR * 0.95, 24, 1, true]} />
          <meshStandardMaterial
            color={shadeColor}
            emissive={warm}
            emissiveIntensity={on ? 1.3 : 0}
            side={THREE.DoubleSide}
            roughness={0.5}
          />
        </mesh>
        {on && <pointLight position={[0, y - 0.1, 0]} intensity={0.9} distance={3.8} decay={2} color={warm} />}
      </group>
    );
  }

  // floor / table lamp: base + pole + glowing shade at the top
  const shadeH = Math.min(0.24, h * 0.42);
  const shadeY = h - shadeH / 2;
  const poleR = kind === 'floor' ? 0.02 : 0.014;
  return (
    <group>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[shadeR * 0.55, shadeR * 0.7, 0.02, 16]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, (h - shadeH) / 2, 0]}>
        <cylinderGeometry args={[poleR, poleR, Math.max(0.02, h - shadeH), 8]} />
        <meshStandardMaterial color="#555" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, shadeY, 0]} castShadow>
        <cylinderGeometry args={[shadeR * 0.8, shadeR, shadeH, 24, 1, true]} />
        <meshStandardMaterial
          color={shadeColor}
          emissive={warm}
          emissiveIntensity={on ? 1.15 : 0}
          side={THREE.DoubleSide}
          roughness={0.5}
        />
      </mesh>
      {on && <pointLight position={[0, shadeY, 0]} intensity={0.7} distance={3} decay={2} color={warm} />}
    </group>
  );
}

// Just the light a lamp throws, with no stand-in geometry — for a lamp that is rendering its REAL
// IKEA model. The GLB brings its own shade and pole, but a GLB is inert: without this the room's
// lamps all went dark the moment they started looking right. Same night-only schedule and warm
// colour as the procedural lamp above, and the light sits where that lamp's shade would be.
export function LampLight({ item }: { item: PlacedItem }) {
  const hour = useLayoutStore((s) => s.sun.hourOfDay);
  const on = hour >= 20 || hour < 6;
  if (!on) return null;
  const kind = lampKind(item);
  const h = cmToM(item.h);
  // A pendant hangs from the ceiling; anything standing lights from just under its own top.
  const y = kind === 'pendant' ? CEILING_HEIGHT - 0.6 : Math.max(0.1, h - Math.min(0.24, h * 0.42) / 2);
  return (
    <pointLight
      position={[0, y, 0]}
      intensity={kind === 'pendant' ? 0.9 : 0.7}
      distance={kind === 'pendant' ? 3.8 : 3}
      decay={2}
      color="#ffd8a0"
    />
  );
}

function lampKind(item: PlacedItem): 'floor' | 'table' | 'pendant' {
  const lt = (item as { lightType?: string }).lightType;
  if (lt === 'pendant' || lt === 'ceiling') return 'pendant';
  if (lt === 'floorLamp') return 'floor';
  if (lt === 'tableLamp' || lt === 'wallLamp') return 'table';
  return item.h >= 90 ? 'floor' : 'table';
}
