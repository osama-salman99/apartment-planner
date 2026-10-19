import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { cmToM } from '../lib/units';
import { Bedding } from './Bedding';
import { OnsevigRug } from './OnsevigRug';
import { PaxCornerWardrobe } from './PaxWardrobe';
import { PlayStation5 } from './PlayStation5';
import { TclTv } from './TclTv';
import { SolidaSofa } from './SolidaSofa';
import { TrentinoSofa } from './TrentinoSofa';
import { TvUnit } from './TvUnit';
import { WoonspotBed } from './WoonspotBed';
import { WoonspotSofa } from './WoonspotSofa';
import { woonspotBed } from '../lib/woonspotBeds';
import { woonspotSofa } from '../lib/woonspotSofas';
import type { FurnitureShape, MaterialFamily } from '../lib/types';

interface Props {
  shape: FurnitureShape;
  w: number; // cm
  d: number; // cm
  h: number; // cm
  color: string;
  material?: MaterialFamily; // optional hint for the fallback archetype's finish; real models ignore it
  // The placed item's name. Only used where one archetype covers products that are genuinely
  // different objects — a "Tv-meubel" bench vs a "Tv-meubel, combi" storage wall.
  name?: string;
  // Left-right flip for handed pieces. The WoonSpot range is built from a spec that says which
  // side the deep wing is on, so mirroring is that one field flipped — a real mirror, not a
  // negative scale (which would flip the normals and light the whole sofa inside out).
  mirrored?: boolean;
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

function Legs({ w, d, legH, color }: { w: number; d: number; legH: number; color: string }) {
  const inset = Math.min(0.05, w / 2 - 0.01, d / 2 - 0.01);
  const xs = [-(w / 2 - inset), w / 2 - inset];
  const zs = [-(d / 2 - inset), d / 2 - inset];
  return (
    <>
      {xs.map((x) =>
        zs.map((z) => (
          <mesh key={`${x}-${z}`} position={[x, legH / 2, z]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, legH, 10]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        )),
      )}
    </>
  );
}

/**
 * Procedural, parametric furniture — not imported models. Every dimension the user edits
 * (W/D/H) drives real geometry, and every category still reads as its silhouette rather than
 * a plain cube: beveled main volumes (RoundedBox), legs, backrests/armrests where the real
 * object has them.
 */
export function FurnitureMesh({ shape, w: wCm, d: dCm, h: hCm, color, name, mirrored }: Props) {
  const w = cmToM(wCm);
  const d = cmToM(dCm);
  const h = cmToM(hCm);
  const dark = shade(color, -0.12);
  const light = shade(color, 0.1);

  // The WoonSpot XXL range is 19 specific models off one parametric build, so it is matched by
  // spec lookup rather than 19 switch cases.
  const woonspot = useMemo(() => {
    const spec = woonspotSofa(shape);
    if (!spec || !mirrored) return spec;
    return { ...spec, deepSide: spec.deepSide === 'left' ? ('right' as const) : ('left' as const) };
  }, [shape, mirrored]);
  if (woonspot) return <WoonspotSofa spec={woonspot} w={wCm} d={dCm} h={hCm} color={color} />;

  // Same for the 33 boxsprings: one parametric build, matched by spec lookup.
  const boxspring = woonspotBed(shape);
  if (boxspring) return <WoonspotBed spec={boxspring} w={wCm} d={dCm} h={hCm} color={color} />;

  switch (shape) {
    case 'bed': {
      // A mattress is about 20 cm thick whatever bed it lies on. Splitting the item's height between
      // base and mattress assumed that height described the sleeping surface — on most frames it
      // describes the HEADBOARD (MALM's is 100 cm), which produced a 58 cm thick mattress standing
      // taller than the nightstand next to it.
      const MATTRESS_H = 0.2;
      // Above this the height is a headboard; below it, the number is the frame itself — a platform
      // frame like NORDLI is 30 cm tall and has no headboard at all.
      const hasHeadboard = h >= 0.6;
      const mattressH = Math.min(MATTRESS_H, h * 0.6);
      const baseH = hasHeadboard ? Math.min(h * 0.42, 0.45) : Math.max(h - mattressH, h * 0.5);
      const topH = baseH + mattressH;
      // The mattress is smaller than the frame around it: a frame overhangs its mattress by roughly
      // 9 cm across, so the sheet does not run out to the outer edge of the wood.
      const mattressW = Math.max(w - 0.09, w * 0.85);
      const mattressD = Math.max(d - 0.09, d * 0.85);
      return (
        <group>
          <RoundedBox args={[w, baseH, d]} radius={0.02} position={[0, baseH / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.6} />
          </RoundedBox>
          <RoundedBox
            args={[mattressW, mattressH, mattressD]}
            radius={0.03}
            position={[0, baseH + mattressH / 2, 0]}
            castShadow
          >
            <meshStandardMaterial color="#f2f0ea" roughness={0.85} />
          </RoundedBox>
          {hasHeadboard && (
            <RoundedBox args={[w, h, 0.08]} radius={0.02} position={[0, h / 2, -d / 2 - 0.02]} castShadow>
              <meshStandardMaterial color={color} roughness={0.55} />
            </RoundedBox>
          )}
          {/* pillows */}
          {[-w / 4, w / 4].map((x) => (
            <RoundedBox key={x} args={[w * 0.4, 0.12, 0.4]} radius={0.05} position={[x, topH + 0.05, -d / 2 + 0.32]}>
              <meshStandardMaterial color="#ffffff" roughness={0.9} />
            </RoundedBox>
          ))}
        </group>
      );
    }

    // Several soft layers, none of them the item's own box — its own build. The two entries are the
    // same component: bare mattress, or the same mattress made up with a duvet and pillows.
    case 'bedding':
      return <Bedding w={wCm} d={dCm} h={hCm} color={color} />;
    case 'beddingMadeUp':
      return <Bedding w={wCm} d={dCm} h={hCm} color={color} madeUp />;

    // Not a box at all — its own L-shaped module, so it gets the dispatch to itself.
    case 'paxCorner':
      return <PaxCornerWardrobe w={wCm} d={dCm} h={hCm} color={color} />;

    // A U, and quilted all over — nothing the generic sofa archetype can express.
    case 'trentinoU':
      return <TrentinoSofa w={wCm} d={dCm} h={hCm} color={color} />;

    // The Solida as ordered: rolled loose back cushions, one 20 cm arm and an R55 round tip — three
    // things the parametric WoonSpot build has no vocabulary for, so it gets its own component.
    case 'solidaOrdered':
      return <SolidaSofa w={wCm} d={dCm} h={hCm} color={color} mirrored={mirrored} />;

    // Anything from a low bench to a 2.3 m combi wall — its own build, because a combi is several
    // volumes with the TV's air between them, not one box.
    case 'tvConsole':
      return <TvUnit w={wCm} d={dCm} h={hCm} color={color} name={name} mirrored={mirrored} />;

    case 'nightstand':
    case 'wardrobe':
    case 'bookshelf': {
      const isBookshelf = shape === 'bookshelf';
      return (
        <group>
          <RoundedBox args={[w, h, d]} radius={0.015} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.5} />
          </RoundedBox>
          {isBookshelf &&
            [0.25, 0.5, 0.75].map((f) => (
              <mesh key={f} position={[0, h * f, d / 2 - 0.02]}>
                <boxGeometry args={[w * 0.94, 0.02, d * 0.85]} />
                <meshStandardMaterial color={dark} roughness={0.5} />
              </mesh>
            ))}
          {!isBookshelf && (
            <mesh position={[0, h * 0.5, d / 2 + 0.001]}>
              <boxGeometry args={[0.01, h * 0.9, 0.01]} />
              <meshStandardMaterial color={dark} />
            </mesh>
          )}
          {shape === 'wardrobe' &&
            [-0.05, 0.05].map((x) => (
              <mesh key={x} position={[x, h * 0.55, d / 2 + 0.01]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.3} />
              </mesh>
            ))}
        </group>
      );
    }

    case 'desk':
    case 'coffeeTable':
    case 'diningTable': {
      const topH = shape === 'coffeeTable' ? 0.04 : 0.045;
      return (
        <group>
          <RoundedBox args={[w, topH, d]} radius={0.01} position={[0, h - topH / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.4} />
          </RoundedBox>
          <Legs w={w} d={d} legH={h - topH} color={dark} />
          {shape === 'desk' && (
            <mesh position={[w / 2 - 0.15, h - 0.25, 0]} castShadow>
              <boxGeometry args={[0.28, 0.35, d * 0.9]} />
              <meshStandardMaterial color={dark} roughness={0.5} />
            </mesh>
          )}
        </group>
      );
    }

    case 'chair':
    case 'diningChair': {
      const seatH = h * 0.5;
      return (
        <group>
          <RoundedBox args={[w, 0.05, d]} radius={0.015} position={[0, seatH, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.6} />
          </RoundedBox>
          <RoundedBox args={[w * 0.92, h - seatH, 0.05]} radius={0.02} position={[0, seatH + (h - seatH) / 2, -d / 2 + 0.02]} castShadow>
            <meshStandardMaterial color={color} roughness={0.6} />
          </RoundedBox>
          <Legs w={w * 0.85} d={d * 0.85} legH={seatH} color={dark} />
        </group>
      );
    }

    case 'sofa':
    case 'armchair': {
      const seatH = h * 0.45;
      const armW = Math.min(0.18, w * 0.16);
      return (
        <group>
          <RoundedBox args={[w, seatH, d]} radius={0.06} position={[0, seatH / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.85} />
          </RoundedBox>
          <RoundedBox args={[w - armW * 2, h - seatH, 0.18]} radius={0.06} position={[0, seatH + (h - seatH) / 2, -d / 2 + 0.09]} castShadow>
            <meshStandardMaterial color={color} roughness={0.85} />
          </RoundedBox>
          {[-(w / 2 - armW / 2), w / 2 - armW / 2].map((x) => (
            <RoundedBox key={x} args={[armW, h * 0.75, d]} radius={0.05} position={[x, (h * 0.75) / 2, 0]} castShadow>
              <meshStandardMaterial color={light} roughness={0.8} />
            </RoundedBox>
          ))}
        </group>
      );
    }

    case 'rug': {
      return (
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      );
    }

    // The one rug that is a specific product rather than an archetype: on a rug the pattern IS the
    // product, and a plain coloured disc says nothing about which one it is.
    case 'onsevigRug':
      return <OnsevigRug w={wCm} d={dCm} h={hCm} />;

    // A potted plant: tapered pot plus a loose cluster of leaf blobs. Only ever the stand-in — the
    // real IKEA GLB renders instead whenever it is loaded. A HANGING plant's model hangs below its
    // own origin (the hook), which a floor-standing silhouette cannot express, so the fallback
    // always draws it standing.
    case 'plant': {
      const potH = Math.min(h * 0.4, Math.min(w, d) * 0.9);
      const potR = Math.min(w, d) / 2;
      const foliageR = Math.max(potR * 0.9, Math.min(w, d) / 2);
      const crown = h - potH;
      return (
        <group>
          <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[potR, potR * 0.72, potH, 20]} />
            {/* colorHex on a plant is the foliage, so the pot gets its own neutral stoneware. */}
            <meshStandardMaterial color="#a89e93" roughness={0.85} />
          </mesh>
          {[
            [0, potH + crown * 0.45, 0, 1],
            [foliageR * 0.5, potH + crown * 0.72, foliageR * 0.2, 0.66],
            [-foliageR * 0.45, potH + crown * 0.68, -foliageR * 0.3, 0.6],
            [foliageR * 0.1, potH + crown * 0.95, -foliageR * 0.15, 0.45],
          ].map(([x, y, z, scale], i) => (
            <mesh key={i} position={[x, y, z]} castShadow>
              <sphereGeometry args={[foliageR * 0.62 * scale, 14, 10]} />
              <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>
          ))}
        </group>
      );
    }

    // Sony's console, built rather than imported (no usable model of it is free to download).
    // The user's actual TV, at Coolblue's published figures.
    case 'tclTv43':
      return <TclTv w={wCm} d={dCm} h={hCm} />;
    case 'ps5Flat':
      return <PlayStation5 w={wCm} d={dCm} h={hCm} lying />;
    case 'ps5':
      return <PlayStation5 w={wCm} d={dCm} h={hCm} />;

    case 'cylinder': {
      return (
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[Math.min(w, d) / 2, Math.min(w, d) / 2, h, 28]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      );
    }

    case 'box':
    default: {
      return (
        <RoundedBox args={[w, h, d]} radius={0.015} position={[0, h / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={color} roughness={0.6} />
        </RoundedBox>
      );
    }
  }
}
