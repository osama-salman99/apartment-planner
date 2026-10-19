import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { cmToM } from '../lib/units';
import { boucle, plinthColor, quilt, shade } from './upholstery';

/**
 * The Trentino U-bank (WoonSpot XXL) — the bouclé "marshmallow" U-sofa, built to the shop's
 * own dimensions.
 *
 * WHERE THE NUMBERS COME FROM. The product page prints exactly one spec line, under
 * "Afmetingen & prijzen": `180 x 360 x 240 cm` (€ 1.895, was € 3.395), which the image filename
 * repeats (`…-1895-180x360x240cm`). Those are the three legs of the U the way Dutch shops quote a
 * hoek/U-bank — the middle run 360 with a 180 wing on one side and a 240 wing on the other — so the
 * footprint is 360 × 240 and the two wings are deliberately UNEQUAL, which is what the renders
 * show too. `w` is the back run, `d` the deep wing; the shallow wing follows `d` at the same 180/240
 * ratio, so resizing keeps the sofa's proportions.
 *
 * HEIGHT IS AN ASSUMPTION, not a spec: the page gives no height, seat height or seat depth, and
 * offers only "wil je een andere opstelling, kleur of stof? Neem contact op". 75 cm overall with a
 * 42 cm seat is typical for this low, chunky style and is what the renders scale to against the
 * coffee table beside it. Change the H field if the shop confirms otherwise.
 *
 * HOW IT IS BUILT. Everything is quilted: the upholstery is one grid of rounded "puffs" (bubble
 * quilting), which is the whole character of this sofa — a plain box with a bevel reads as an
 * entirely different piece of furniture. The back run and the two wing arms are two courses of
 * puffs from the plinth to full height; the seat is a coarser grid, two courses deep, so the
 * front face of the open wing shows the same quilting as the top. No legs — the base is a
 * recessed dark plinth, as in the renders. Loose square scatter cushions on the back and arms.
 *
 * At rotation 0 the back is against the −Z wall and the U opens toward +Z, with the DEEP wing on
 * the +X side.
 */

// --- construction (cm) --------------------------------------------------------------------------
/** Depth of the back run's upholstered back. */
const BACK_T = 24;
/** Width of a wing's arm. It stops level with the back run: past that the wing is an open chaise. */
const ARM_T = 30;
/** Depth of the back-run band, back included — so the seat in front of the back is 76 deep. */
const RUN_D = 100;
/** Width of a wing, arm included. */
const WING_W = 100;
const PLINTH_H = 5;
/** The shallow wing is the printed 180 against the deep wing's 240. */
const SHORT_LEG_RATIO = 180 / 240;
/** Seat top as a fraction of overall height (42 on 75). */
const SEAT_RATIO = 42 / 75;
/** Puff grid: the seat's pads are coarser than the back's quilting, as in the renders. */
const SEAT_CELL = 50;
const BACK_CELL = 36;
const CUSHION = 46;
const CUSHION_T = 16;

export function TrentinoSofa({
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
  const map = useMemo(() => boucle(), []);

  const geo = useMemo(() => {
    // Clamp the fixed construction thicknesses so a heavily resized sofa still has a U in it.
    const backT = Math.min(BACK_T, dCm * 0.2);
    const armT = Math.min(ARM_T, wCm * 0.12);
    const wingW = Math.min(WING_W, wCm * 0.32);
    const runD = Math.min(RUN_D, dCm * 0.55);
    const seatTop = Math.max(PLINTH_H + 8, hCm * SEAT_RATIO);
    const longLeg = dCm;
    const shortLeg = Math.max(runD + 10, dCm * SHORT_LEG_RATIO);

    const x0 = -wCm / 2;
    const x1 = wCm / 2;
    const z0 = -dCm / 2;

    // The three upholstered masses that make the U, at full height: the back run and one arm per
    // wing. The DEEP wing is +X, so its arm is the one on the right at rotation 0.
    const frames = [
      quilt('back', { x0, x1, z0, z1: z0 + backT, y0: PLINTH_H, y1: hCm }, BACK_CELL, backT, 2),
      quilt(
        'arm-short',
        { x0, x1: x0 + armT, z0, z1: z0 + runD, y0: PLINTH_H, y1: hCm },
        armT,
        BACK_CELL,
        2,
      ),
      quilt(
        'arm-deep',
        { x0: x1 - armT, x1, z0, z1: z0 + runD, y0: PLINTH_H, y1: hCm },
        armT,
        BACK_CELL,
        2,
      ),
    ].flat();

    // Seat: the band across the back run, then each wing carrying on forward from it.
    const seatBox = { y0: PLINTH_H, y1: seatTop };
    const seats = [
      quilt(
        'seat-run',
        { x0: x0 + armT, x1: x1 - armT, z0: z0 + backT, z1: z0 + runD, ...seatBox },
        SEAT_CELL,
        SEAT_CELL,
        2,
      ),
      // Past the arm the wing is a bare chaise, so its pads run out to the sofa's own edge.
      quilt(
        'seat-short',
        { x0, x1: x0 + wingW, z0: z0 + runD, z1: z0 + shortLeg, ...seatBox },
        SEAT_CELL,
        SEAT_CELL,
        2,
      ),
      quilt(
        'seat-deep',
        { x0: x1 - wingW, x1, z0: z0 + runD, z1: z0 + longLeg, ...seatBox },
        SEAT_CELL,
        SEAT_CELL,
        2,
      ),
    ].flat();

    // Recessed plinth under each of those footprints — no legs on this sofa, just a dark shadow
    // gap, so it is inset on every side and never reaches the floor edge of the upholstery.
    const inset = 9;
    const plinths: { key: string; args: [number, number, number]; position: [number, number, number] }[] = [
      { key: 'p-run', x0: x0 + inset, x1: x1 - inset, z0: z0 + inset, z1: z0 + runD - inset },
      { key: 'p-short', x0: x0 + inset, x1: x0 + wingW - inset, z0: z0 + runD, z1: z0 + shortLeg - inset },
      { key: 'p-deep', x0: x1 - wingW + inset, x1: x1 - inset, z0: z0 + runD, z1: z0 + longLeg - inset },
    ].map((p) => ({
      key: p.key,
      args: [cmToM(p.x1 - p.x0), cmToM(PLINTH_H), cmToM(p.z1 - p.z0)] as [number, number, number],
      position: [cmToM((p.x0 + p.x1) / 2), cmToM(PLINTH_H / 2), cmToM((p.z0 + p.z1) / 2)] as [
        number,
        number,
        number,
      ],
    }));

    // Loose scatter cushions: leaning on the back, plus one into each wing's arm, the way the
    // renders group them — two by the shallow wing, two by the deep one.
    const cs = Math.min(CUSHION, wCm * 0.18);
    const lean = 0.3;
    const cushions: { key: string; position: [number, number, number]; rotation: [number, number, number] }[] = [
      { key: 'c1', x: x0 + armT + cs * 0.6, rot: [-lean, 0.05, 0] as [number, number, number] },
      { key: 'c2', x: x0 + armT + cs * 1.5, rot: [-lean, -0.12, 0] as [number, number, number] },
      { key: 'c3', x: x1 - armT - cs * 1.6, rot: [-lean, 0.1, 0] as [number, number, number] },
      { key: 'c4', x: x1 - armT - cs * 0.6, rot: [-lean, -0.06, 0] as [number, number, number] },
    ].map((c) => ({
      key: c.key,
      position: [cmToM(c.x), cmToM(Math.min(seatTop + cs / 2, hCm - cs / 2 + 6)), cmToM(z0 + backT + CUSHION_T * 0.7)] as [
        number,
        number,
        number,
      ],
      rotation: c.rot,
    }));

    return { frames, seats, plinths, cushions, cushionSize: cmToM(cs) };
  }, [wCm, dCm, hCm]);

  const cushionColor = shade(color, 0.04);

  return (
    <group>
      {geo.plinths.map((p) => (
        <mesh key={p.key} position={p.position} castShadow receiveShadow>
          <boxGeometry args={p.args} />
          <meshStandardMaterial color={plinthColor(color)} roughness={0.85} />
        </mesh>
      ))}

      {geo.frames.map((p) => (
        <RoundedBox
          key={p.key}
          args={p.args}
          radius={Math.min(0.05, Math.min(...p.args) / 3.4)}
          smoothness={3}
          position={p.position}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={color} map={map ?? undefined} roughness={0.95} metalness={0} />
        </RoundedBox>
      ))}

      {geo.seats.map((p) => (
        <RoundedBox
          key={p.key}
          args={p.args}
          radius={Math.min(0.055, Math.min(...p.args) / 3.4)}
          smoothness={3}
          position={p.position}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={color} map={map ?? undefined} roughness={0.95} metalness={0} />
        </RoundedBox>
      ))}

      {geo.cushions.map((c) => (
        <RoundedBox
          key={c.key}
          args={[geo.cushionSize, geo.cushionSize, cmToM(CUSHION_T)]}
          radius={Math.min(0.07, cmToM(CUSHION_T) / 2.2)}
          smoothness={3}
          position={c.position}
          rotation={c.rotation}
          castShadow
        >
          <meshStandardMaterial color={cushionColor} map={map ?? undefined} roughness={0.95} metalness={0} />
        </RoundedBox>
      ))}
    </group>
  );
}
