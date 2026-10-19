import { useMemo } from 'react';
import * as THREE from 'three';
import { MeshReflectorMaterial } from '@react-three/drei';
import { cmToM } from '../lib/units';
import { isPhoneViewport } from '../lib/device';

/**
 * The PAX corner wardrobe as actually configured in IKEA's planner — exterior only.
 *
 * WHAT IT IS. Two runs meeting in a corner, dark grey frames 236 high and 58 deep, with the
 * elbow filled by an add-on corner unit. Six doors, three per run, 229 tall: the run that shows
 * its full face carries three MISTUDDEN grey/patterned doors, the run that runs away from you
 * carries two ÅHEIM mirror doors plus one MISTUDDEN at the elbow (which is why there is a
 * patterned panel on the mirror side of the corner). Four BORGHAMN black 170 mm bar handles, on
 * the two door pairs; the elbow doors have none.
 *
 * WHERE THE NUMBERS COME FROM. The planner's own dimension labels: 210.5 × 210.4 on plan, 60.3 /
 * 60.4 deep, 236.4 high. Those reconcile exactly with the parts list — a run's doors span
 * 210.5 − 58 = 152.5, i.e. 53 + 50 + 50, and the depth is the 58 frame plus a 23 mm door.
 *
 * Interior fittings (rails, drawers, shelves, the shoe shelf, the mesh basket) are deliberately
 * NOT modelled: they are invisible behind closed doors and the ask was the exterior.
 *
 * `w` and `d` are the two arms of the L, so resizing still means something: `w` is the arm along
 * local X (fully doored across the width bar the elbow), `d` the arm along local Z. The corner
 * itself is at local (−w/2, −d/2), so at rotation 0 the wardrobe backs onto the walls to its
 * north and west and opens toward +X/+Z.
 */

/** Frame depth (cm). The exterior depth is this plus a door. */
const CARCASS_D = 58;
const DOOR_T = 2.3;
/** Doors are 229 on a 236 frame: the gap is bigger under the door than over it. */
const DOOR_H = 229;
const DOOR_BOTTOM = 5.4;
/** Panel widths (cm) along a run, starting at the elbow: the corner unit's door, then two frames'. */
const PANELS = [53, 50, 50];
/** Reveal between two door panels. */
const DOOR_GAP = 0.4;
const HANDLE_L = 17; // BORGHAMN, 170 mm
const HANDLE_Y = 108;
/** How far the bar stands off the door face, and how far its centre sits in from the door edge. */
const HANDLE_STANDOFF = 1.6;
const HANDLE_INSET = 3;

const MIRROR = '#c5ced4';
const PATTERN_BASE = '#e9e7e1';

/**
 * MISTUDDEN's finish is a fine mottled relief, not a flat white — flat white next to a mirror
 * reads as a missing texture. Drawn once into a canvas and shared by every panel (same repeat on
 * all of them), with a fixed-seed PRNG so the pattern is identical on every load rather than
 * reshuffling each time the scene mounts.
 */
let patternTexture: THREE.CanvasTexture | null = null;
function misstuddenTexture(): THREE.CanvasTexture | null {
  if (patternTexture) return patternTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = PATTERN_BASE;
  g.fillRect(0, 0, 256, 256);
  let seed = 20260809;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2800; i++) {
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, 1.1 + rnd() * 2.4, 0, Math.PI * 2);
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(197,193,185,0.45)';
    g.fill();
  }
  patternTexture = new THREE.CanvasTexture(canvas);
  patternTexture.wrapS = patternTexture.wrapT = THREE.RepeatWrapping;
  patternTexture.repeat.set(2, 7);
  return patternTexture;
}

/** Panel spans (cm, offset + width) laid along a run of `span`, elbow end first. */
function panelLayout(span: number) {
  const total = PANELS.reduce((a, b) => a + b, 0);
  let at = 0;
  return PANELS.map((p) => {
    const width = (p / total) * span;
    const seg = { at, width };
    at += width;
    return seg;
  });
}

function DoorPanel({
  kind,
  args,
  position,
  reflective = false,
}: {
  kind: 'mirror' | 'pattern';
  args: [number, number, number];
  position: [number, number, number];
  /** True when a real reflecting surface is drawn over this panel, so the box is only its edges. */
  reflective?: boolean;
}) {
  const map = useMemo(() => (kind === 'pattern' ? misstuddenTexture() : null), [kind]);
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      {kind === 'mirror' ? (
        // A mirror door's box is its carrier: with a reflecting face over it, all that shows is the
        // dark glass edge; without one, the box itself has to look like the mirror.
        <meshStandardMaterial
          color={reflective ? '#2b3136' : MIRROR}
          metalness={reflective ? 0.4 : 0.92}
          roughness={reflective ? 0.35 : 0.08}
        />
      ) : (
        <meshStandardMaterial color="#ffffff" map={map ?? undefined} roughness={0.62} metalness={0.02} />
      )}
    </mesh>
  );
}

function Handle({ position }: { position: [number, number, number] }) {
  const l = cmToM(HANDLE_L);
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[0.007, 0.007, l, 10]} />
      <meshStandardMaterial color="#1b1b1d" metalness={0.65} roughness={0.35} />
    </mesh>
  );
}

export function PaxCornerWardrobe({
  w: wCm,
  d: dCm,
  h: hCm,
  color,
}: {
  w: number;
  d: number;
  h: number;
  color: string;
}) {
  const W = cmToM(wCm);
  const D = cmToM(dCm);
  const H = cmToM(hCm);
  const cd = cmToM(CARCASS_D);
  const t = cmToM(DOOR_T);
  const doorH = cmToM(Math.min(DOOR_H, hCm - DOOR_BOTTOM - 2));
  const doorY = cmToM(DOOR_BOTTOM) + doorH / 2;
  const gap = cmToM(DOOR_GAP);
  const handleY = cmToM(Math.min(HANDLE_Y, hCm - HANDLE_L));
  const standoff = t / 2 + cmToM(HANDLE_STANDOFF);
  const inset = cmToM(HANDLE_INSET);

  // Arm along X sits against the −Z wall and takes the elbow with it, so the corner is closed
  // rather than a notch you can see through from above. The arm along Z butts onto its side.
  const armXDoorSpan = W - cd;
  const armZLength = D - cd;

  const xPanels = useMemo(() => panelLayout(armXDoorSpan), [armXDoorSpan]);
  const zPanels = useMemo(() => panelLayout(armZLength), [armZLength]);

  const xDoorZ = -D / 2 + cd + t / 2;
  const zDoorX = -W / 2 + cd + t / 2;

  // The two ÅHEIM doors are one continuous piece of glass as far as reflection goes: span them with
  // a single reflecting surface, and mark where their reveal falls so it can be drawn back in.
  const reflect = !isPhoneViewport();
  const mirrorStart = -D / 2 + cd + zPanels[1].at;
  const mirrorEnd = -D / 2 + cd + zPanels[2].at + zPanels[2].width;
  const mirrorSpan = mirrorEnd - mirrorStart;
  const mirrorZ = (mirrorStart + mirrorEnd) / 2;
  const mirrorRevealZ = -D / 2 + cd + zPanels[2].at - gap / 2;

  return (
    <group>
      {/* frames */}
      <mesh position={[0, H / 2, -D / 2 + cd / 2]} castShadow receiveShadow>
        <boxGeometry args={[W, H, cd]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[-W / 2 + cd / 2, H / 2, -D / 2 + cd + armZLength / 2]} castShadow receiveShadow>
        <boxGeometry args={[cd, H, armZLength]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>

      {/* the fully-doored arm: three MISTUDDEN panels */}
      {xPanels.map((p, i) => (
        <DoorPanel
          key={`x${i}`}
          kind="pattern"
          args={[p.width - gap, doorH, t]}
          position={[-W / 2 + cd + p.at + p.width / 2, doorY, xDoorZ]}
        />
      ))}
      {/* the mirror arm: MISTUDDEN at the elbow, then the two ÅHEIM mirrors */}
      {zPanels.map((p, i) => (
        <DoorPanel
          key={`z${i}`}
          kind={i === 0 ? 'pattern' : 'mirror'}
          args={[t, doorH, p.width - gap]}
          position={[zDoorX, doorY, -D / 2 + cd + p.at + p.width / 2]}
          reflective={i > 0 && reflect}
        />
      ))}
      {/* The mirror. A shiny grey panel reflects only the sky cards, which is why it read as painted
          metal rather than glass — this is a real planar reflection of the room, so the bed and the
          window actually appear in it. Both ÅHEIM doors are coplanar, so they share ONE reflecting
          surface (one extra render pass, not two) and a thin dark strip redraws the reveal between
          them. Phones keep the cheap material: a full second pass every frame is the one cost a
          phone cannot absorb here. */}
      {reflect && (
        <>
          <mesh
            position={[zDoorX + t / 2 + cmToM(0.05), doorY, mirrorZ]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[mirrorSpan - gap, doorH - gap]} />
            <MeshReflectorMaterial
              resolution={1024}
              mirror={1}
              mixStrength={1}
              mixBlur={0}
              blur={[0, 0]}
              color={MIRROR}
              metalness={0.35}
              roughness={0.06}
            />
          </mesh>
          <mesh position={[zDoorX + t / 2 + cmToM(0.1), doorY, mirrorRevealZ]}>
            <boxGeometry args={[cmToM(0.1), doorH, gap]} />
            <meshStandardMaterial color="#3a4045" roughness={0.5} />
          </mesh>
        </>
      )}

      {/* Handles on the two outer pairs only, either side of the reveal where each pair meets. */}
      <Handle position={[-W / 2 + cd + xPanels[1].at + xPanels[1].width - inset, handleY, xDoorZ + standoff]} />
      <Handle position={[-W / 2 + cd + xPanels[2].at + inset, handleY, xDoorZ + standoff]} />
      <Handle position={[zDoorX + standoff, handleY, -D / 2 + cd + zPanels[1].at + zPanels[1].width - inset]} />
      <Handle position={[zDoorX + standoff, handleY, -D / 2 + cd + zPanels[2].at + inset]} />
    </group>
  );
}
