import { cmToM } from '../lib/units';

/**
 * TCL 43" QLED P71K 4K (2025) — the set the user is buying, at Coolblue's published figures rather
 * than a generic 43-inch box (coolblue.nl product 961415):
 *
 *   panel        95 × 55 cm, 7.7 cm deep
 *   on the stand 95 × 18.4 cm footprint, 60 cm tall, of which the stand is 5 cm
 *   weight       6.6 kg, 6.7 kg with the stand
 *
 * Shape comes from the product photos: a near-frameless black panel with a slightly taller chin
 * carrying a small centred TCL wordmark, and two black V-blade feet set well in from the corners
 * (about 33 cm either side of centre), each splaying outward as it comes down. The feet are drawn
 * running forward from the panel's back face so the whole piece is exactly the 18.4 cm deep it is
 * specified at — the photos are all front-on, so the split of that depth between panel and feet is
 * the one thing here that is read rather than published.
 *
 * It is a 43-inch 16:9 panel, so the active area is about 95.3 × 53.6 cm — which is why the 95 × 55
 * envelope leaves so little for a bezel.
 */

const PANEL_W = 95;
const PANEL_H = 55;
const PANEL_D = 7.7;
/** The panel's bottom edge sits this far off the bench, on the feet. */
const STAND_H = 5;
const TOTAL_D = 18.4;
/** How far out the feet are from the centre line, off the product photos. */
const FOOT_X = 33;

export const TCL_TV_DIMS = { w: PANEL_W, d: TOTAL_D, h: STAND_H + PANEL_H };

/** Bezel: a couple of millimetres at the sides and top, a real chin at the bottom. */
const BEZEL = 0.8;
const CHIN = 2.4;
/** The front plate carries the bezel and screen; the electronics housing sits behind it. */
const FRONT_T = 2.2;

export function TclTv({ w: wCm, d: dCm, h: hCm }: { w: number; d: number; h: number }) {
  const scale: [number, number, number] = [
    wCm / TCL_TV_DIMS.w,
    hCm / TCL_TV_DIMS.h,
    dCm / TCL_TV_DIMS.d,
  ];

  const panelW = cmToM(PANEL_W);
  const panelH = cmToM(PANEL_H);
  const frontT = cmToM(FRONT_T);
  const rearT = cmToM(PANEL_D - FRONT_T);
  // Panel front face at +Z, back face at the envelope's back — a TV stands against a wall, so the
  // back is the flat side and the feet run forward from it.
  const frontZ = cmToM(PANEL_D) / 2;
  const panelY = cmToM(STAND_H) + panelH / 2;

  const footD = cmToM(TOTAL_D);
  // Runs from the panel's back face forward, which is what makes the footprint 18.4 deep.
  const footZ = -cmToM(PANEL_D) / 2 + footD / 2;
  const footH = cmToM(STAND_H);

  return (
    <group scale={scale}>
      {/* Front plate: the black surround the screen is set into. */}
      <mesh position={[0, panelY, frontZ - frontT / 2]} castShadow receiveShadow>
        <boxGeometry args={[panelW, panelH, frontT]} />
        <meshStandardMaterial color="#21232a" roughness={0.42} />
      </mesh>

      {/* The screen itself — dark and a little glossy, i.e. switched off. Lighting it up would
          make every render of the room look like an advert. */}
      <mesh position={[0, panelY + cmToM(CHIN - BEZEL) / 2, frontZ + cmToM(0.04)]}>
        <boxGeometry
          args={[panelW - cmToM(BEZEL * 2), panelH - cmToM(BEZEL + CHIN), cmToM(0.08)]}
        />
        <meshStandardMaterial color="#0b0d12" roughness={0.12} metalness={0.2} />
      </mesh>

      {/* The wordmark on the chin: at this scale it can only be a light mark, not letters. */}
      <mesh position={[0, cmToM(STAND_H + CHIN / 2), frontZ + cmToM(0.05)]}>
        <boxGeometry args={[cmToM(3.4), cmToM(0.55), cmToM(0.06)]} />
        <meshStandardMaterial color="#6d7076" roughness={0.6} />
      </mesh>

      {/* Electronics housing behind the panel — narrower and shorter than the front, so the set
          reads as thin at the edges the way a slim panel does. */}
      <mesh position={[0, panelY - panelH * 0.06, frontZ - frontT - rearT / 2]} castShadow>
        <boxGeometry args={[panelW * 0.9, panelH * 0.78, rearT]} />
        <meshStandardMaterial color="#1a1b1f" roughness={0.7} />
      </mesh>

      {/* The two V feet. Each is a pair of blades leaning out from an apex under the panel, plus a
          thin pad where it meets the bench. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[cmToM(FOOT_X) * side, 0, footZ]}>
          {[-1, 1].map((leg) => (
            <mesh
              key={leg}
              position={[cmToM(2.6) * leg, footH / 2, 0]}
              rotation={[0, 0, (-leg * 27 * Math.PI) / 180]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[cmToM(1.1), footH * 1.12, footD * 0.92]} />
              <meshStandardMaterial color="#191a1e" roughness={0.55} />
            </mesh>
          ))}
          <mesh position={[0, cmToM(0.25), 0]} receiveShadow>
            <boxGeometry args={[cmToM(7.6), cmToM(0.5), footD]} />
            <meshStandardMaterial color="#141519" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
