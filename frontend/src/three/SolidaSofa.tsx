import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { cmToM } from '../lib/units';
import { boucle, cells, plinthColor, QUILT_GAP } from './upholstery';

/**
 * The Solida as actually ordered from WoonSpot XXL — not the catalog opstelling.
 *
 * WHERE THE NUMBERS COME FROM. The shop sells the Solida as a U-bank and prints one spec line,
 * `170 x 390 x 230 cm` (€ 2.595), which is what `solidaU` in `lib/woonspotSofas.ts` renders. The
 * ordered piece is the same modules re-arranged and resized into a corner (L), dimensioned by hand
 * on the order sketch:
 *
 *     20 arm | 80 seat | 80 seat | 110 lounge  =  290 wide,  170 deep
 *
 * so the side arm is at one end, the back turns the corner and runs down the outer face of the
 * lounge, and the lounge ends in a half-round tip of R55 (= half the 110 lounge width). The
 * back-run band is 100 deep — 24 of upholstered back plus a 76 seat. The sketch draws that band
 * nearer 70, but the sketch's own scale is ~8 % inconsistent between its two axes, and the
 * showroom photos of the un-adjusted sofa show a seat far deeper than 46, so 100 is what is built.
 *
 * HEIGHTS ARE ASSUMED, as for every sofa in this range: nothing is published beyond the plan
 * dimensions. 75 overall / 42 seat, matching the rest of the WoonSpot builds.
 *
 * THE FABRIC is Top Textil Clara, colour 215.04 (https://www.toptextil.pl/en/collection/clara/):
 * 100 % polyester, 340 g/m², 142 cm wide, 80 000 Martindale, PetProof and flame-retardant. Its
 * swatch photo is a warm ivory (#e8e3d5, sampled off that page) in a FINE linen-look chenille — a
 * much tighter grain than the chunky bouclé the rest of the range is drawn with, so the shared
 * weave texture is repeated three times finer here.
 *
 * HOW IT IS BUILT, from the showroom photos of the un-adjusted opstelling — the ordered sofa is
 * the same parts, so the same construction:
 *   - a full-height upholstered back shell — from behind, the sofa is one smooth wall from plinth
 *     to top — with THICK ROLLED loose bolsters standing on the seat in front of it, segmented at
 *     the seat bays. Those bolsters are the sofa's whole character; a flat slab back reads as a
 *     completely different (and much cheaper) piece of furniture.
 *   - one rounded upright arm module, rounded in plan as well as elevation, at the arm end.
 *   - deep seat cushions, one per bay, crowned.
 *   - a backless half-round drum at the lounge tip, seat height only, chamfered at the top rim.
 *   - no legs: a deeply recessed dark plinth, near-invisible in the photos.
 *
 * At rotation 0 the back is against the −Z wall and the sofa opens toward +Z. Unmirrored, the arm
 * is on −X and the lounge on +X — the handing the user asked for ("flipped … no lounge on the
 * left, only side arm"). `mirrored` swaps them by negating X, not by scaling the group negative,
 * which would invert every normal and light the sofa inside out.
 */

// --- construction (cm) --------------------------------------------------------------------------
/** The side arm's width — the 20 off the sketch. */
const ARM_W = 20;
/** The lounge leg's width — the 110 off the sketch. Its half is the round tip's radius. */
const WING_W = 110;
/** Depth of the back-run band, upholstered back included. */
const RUN_D = 100;
/** Depth of the upholstered back frame, and the width of the back where it turns the corner. */
const BACK_T = 24;
const PLINTH_H = 5;
/** Seat top as a fraction of overall height (42 on 75). */
const SEAT_RATIO = 42 / 75;
/** Diameter of a rolled back cushion. It rests ON the seat, in front of the back shell. */
const ROLL_D = 30;
/** How far a roll settles into the seat it rests on. */
const ROLL_SINK = 2;
/** Nominal length of one rolled back cushion / one seat cushion — both come out near the 80 bays. */
const ROLL_CELL = 88;
const SEAT_CELL = 84;
/** How far the plinth is set back from the upholstery above it. */
const INSET = 9;

interface Slab {
  key: string;
  args: [number, number, number];
  position: [number, number, number];
  radius: number;
}

interface Drum {
  key: string;
  r: number;
  h: number;
  position: [number, number, number];
}

/** A rounded box from a clear volume in the sofa's own cm coordinates. */
function slab(
  key: string,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  radiusCm: number,
): Slab {
  const args: [number, number, number] = [cmToM(x1 - x0), cmToM(y1 - y0), cmToM(z1 - z0)];
  return {
    key,
    args,
    position: [cmToM((x0 + x1) / 2), cmToM((y0 + y1) / 2), cmToM((z0 + z1) / 2)],
    // drei needs the radius strictly inside half the smallest side, or the box turns inside out.
    radius: Math.min(cmToM(radiusCm), Math.min(...args) / 2.05),
  };
}

/** How much finer Clara's grain is than the range's bouclé — see the fabric note above. */
const WEAVE_REPEAT = 9;
/**
 * The drum's side UVs run 0..1 right around a ~345 cm circumference against 0..1 up a ~37 cm
 * height, so the repeat has to be stretched by that ratio or the weave comes out as streaks.
 */
const DRUM_ASPECT = 9.3;

export function SolidaSofa({
  w: wCm,
  d: dCm,
  h: hCm,
  color,
  mirrored,
}: {
  w: number;
  d: number;
  h: number;
  color: string;
  mirrored?: boolean;
}) {
  const shared = useMemo(() => boucle(), []);
  // Clara is a fine chenille, so this sofa gets its own copy of the weave at a tighter repeat
  // rather than the range's chunky-bouclé setting — a clone, so nothing else in the scene changes.
  const map = useMemo(() => {
    if (!shared) return null;
    const t = shared.clone();
    t.repeat.set(WEAVE_REPEAT, WEAVE_REPEAT);
    t.needsUpdate = true;
    return t;
  }, [shared]);

  const geo = useMemo(() => {
    // Clamps, so a resized sofa still has an arm, a lounge and a round tip in it.
    const armW = Math.min(ARM_W, wCm * 0.12);
    const wingW = Math.min(WING_W, wCm * 0.45);
    const backT = Math.min(BACK_T, dCm * 0.2);
    const runD = Math.min(RUN_D, dCm * 0.65);
    const seatTop = Math.max(PLINTH_H + 8, hCm * SEAT_RATIO);
    // A bolster no taller than the shell behind it, and never so deep there is no seat left.
    const rollD = Math.min(
      ROLL_D,
      hCm - seatTop + ROLL_SINK,
      Math.max(10, runD - backT - 30),
    );
    /** Half-round tip of the lounge: as wide as the lounge, and never deeper than the lounge is. */
    const tipR = Math.min(wingW / 2, Math.max(0, dCm - runD));

    const x0 = -wCm / 2;
    const x1 = wCm / 2;
    const z0 = -dCm / 2;
    const z1 = dCm / 2;
    /** Where the straight seat stops and the round tip takes over. */
    const tipZ = z1 - tipR;
    /** Inboard edge of the back where it has turned the corner. */
    const wingBackX = x1 - backT;
    /** Inboard edge of the lounge leg. */
    const wingX = x1 - wingW;

    const frames: Slab[] = [
      // The back shell, full height across the whole width, and the same shell turning the corner
      // down the +X face. Full height because that is what the sofa looks like from BEHIND — one
      // smooth upholstered wall from plinth to top, with the loose bolsters only on the inside.
      slab('back', x0, x1, PLINTH_H, hCm, z0, z0 + backT, 7),
      slab('back-wing', wingBackX, x1, PLINTH_H, hCm, z0 + backT, tipZ, 7),
      // The one arm: full height, rounded in plan and in elevation.
      slab('arm', x0, x0 + armW, PLINTH_H, hCm, z0, z0 + runD, armW / 2),
    ];

    // Seats: the run's bays between arm and lounge, then the lounge's own deep pad. Both stop
    // short of the back frame and are split into cushions with a reveal between them.
    const seats: Slab[] = [];
    const seatY: [number, number] = [PLINTH_H, seatTop];
    cells(Math.max(0, wingX - (x0 + armW)), SEAT_CELL).forEach((c, i) => {
      const cx = x0 + armW + c.at;
      seats.push(
        slab(
          `seat-run-${i}`,
          cx - c.size / 2 + QUILT_GAP / 2,
          cx + c.size / 2 - QUILT_GAP / 2,
          seatY[0],
          seatY[1],
          z0 + backT + QUILT_GAP,
          z0 + runD,
          9,
        ),
      );
    });
    seats.push(
      slab('seat-wing', wingX + QUILT_GAP, wingBackX, seatY[0], seatY[1], z0 + backT + QUILT_GAP, tipZ, 9),
    );

    // The round tip — backless, seat height, the full width of the lounge.
    const drums: Drum[] = [];
    if (tipR > 1) {
      drums.push({
        key: 'tip',
        r: tipR,
        h: seatTop - PLINTH_H,
        position: [cmToM(x1 - wingW / 2), cmToM((PLINTH_H + seatTop) / 2), cmToM(tipZ)],
      });
    }

    // Rolled back cushions — thick loose bolsters standing on the seat against the shell, which is
    // what the whole sofa reads as from the front. Segmented at the seat bays. They turn the corner
    // as an L: the run's course carries on to the shell's inner face, the lounge's starts past it.
    const rolls: Slab[] = [];
    const rollY: [number, number] = [seatTop - ROLL_SINK, seatTop - ROLL_SINK + rollD];
    const rollZ0 = z0 + backT;
    cells(Math.max(0, wingBackX - (x0 + armW)), ROLL_CELL).forEach((c, i) => {
      const cx = x0 + armW + c.at;
      rolls.push(
        slab(
          `roll-run-${i}`,
          cx - c.size / 2 + QUILT_GAP / 2,
          cx + c.size / 2 - QUILT_GAP / 2,
          rollY[0],
          rollY[1],
          rollZ0,
          rollZ0 + rollD,
          rollD / 2,
        ),
      );
    });
    cells(Math.max(0, tipZ - (rollZ0 + rollD)), ROLL_CELL).forEach((c, i) => {
      const cz = rollZ0 + rollD + c.at;
      rolls.push(
        slab(
          `roll-wing-${i}`,
          wingBackX - rollD,
          wingBackX,
          rollY[0],
          rollY[1],
          cz - c.size / 2 + QUILT_GAP / 2,
          cz + c.size / 2 - QUILT_GAP / 2,
          rollD / 2,
        ),
      );
    });

    // Base: a recessed plinth per footprint, plus a round one under the tip. It is set back from
    // every *exposed* face — the front of the run, the inboard face of the lounge — so the sofa
    // reads as floating; where the two footprints meet they overlap, so no gap opens mid-sofa.
    // With the round tip clamped away there is no drum to hide behind, so the lounge's own front
    // face gets the same setback.
    const plinths: Slab[] = [
      slab('p-run', x0 + INSET, wingX + INSET, 0, PLINTH_H, z0 + INSET, z0 + runD - INSET, 0.5),
      slab(
        'p-lounge',
        wingX + INSET,
        x1 - INSET,
        0,
        PLINTH_H,
        z0 + INSET,
        tipR > 1 ? tipZ : z1 - INSET,
        0.5,
      ),
    ];
    const roundPlinth =
      tipR > INSET + 2
        ? {
            key: 'p-tip',
            r: tipR - INSET,
            h: PLINTH_H,
            position: [cmToM(x1 - wingW / 2), cmToM(PLINTH_H / 2), cmToM(tipZ)] as [
              number,
              number,
              number,
            ],
          }
        : null;

    const flip = <T extends { position: [number, number, number] }>(t: T): T =>
      mirrored
        ? ({ ...t, position: [-t.position[0], t.position[1], t.position[2]] } as T)
        : t;

    return {
      frames: frames.map(flip),
      seats: seats.map(flip),
      rolls: rolls.map(flip),
      plinths: plinths.map(flip),
      drums: drums.map(flip),
      roundPlinth: roundPlinth ? flip(roundPlinth) : null,
    };
  }, [wCm, dCm, hCm, mirrored]);

  // A cylinder's UVs run 0..1 right around its circumference against 0..1 up its (much shorter)
  // height, so the shared weave gets smeared into vertical streaks and the round tip comes out
  // looking like brushed metal. The drum gets its own copy of the texture, repeated across the
  // circumference in proportion to it.
  const drumMap = useMemo(() => {
    if (!map) return null;
    const t = map.clone();
    t.repeat.set(WEAVE_REPEAT * DRUM_ASPECT, WEAVE_REPEAT);
    t.needsUpdate = true;
    return t;
  }, [map]);

  const fabric = (
    <meshStandardMaterial color={color} map={map ?? undefined} roughness={0.95} metalness={0} />
  );
  // A cylinder's three material slots are side, top cap, bottom cap. Only the side wants the
  // circumference-stretched copy; the caps are ordinary flat panels of the same weave.
  const drumFabric = (
    <>
      <meshStandardMaterial attach="material-0" color={color} map={drumMap ?? undefined} roughness={0.95} metalness={0} />
      <meshStandardMaterial attach="material-1" color={color} map={map ?? undefined} roughness={0.95} metalness={0} />
      <meshStandardMaterial attach="material-2" color={color} map={map ?? undefined} roughness={0.95} metalness={0} />
    </>
  );
  const upholstered = (s: Slab) => (
    <RoundedBox key={s.key} args={s.args} radius={s.radius} smoothness={4} position={s.position} castShadow receiveShadow>
      {fabric}
    </RoundedBox>
  );

  return (
    <group>
      {geo.plinths.map((p) => (
        <mesh key={p.key} position={p.position} castShadow receiveShadow>
          <boxGeometry args={p.args} />
          <meshStandardMaterial color={plinthColor(color)} roughness={0.85} />
        </mesh>
      ))}
      {geo.roundPlinth && (
        <mesh position={geo.roundPlinth.position} castShadow receiveShadow>
          <cylinderGeometry
            args={[cmToM(geo.roundPlinth.r), cmToM(geo.roundPlinth.r), cmToM(geo.roundPlinth.h), 28]}
          />
          <meshStandardMaterial color={plinthColor(color)} roughness={0.85} />
        </mesh>
      )}

      {geo.frames.map(upholstered)}
      {geo.seats.map(upholstered)}
      {geo.rolls.map(upholstered)}

      {/* The round tip, as a body plus a chamfered crown — a bare cylinder's knife-edge top rim is
          the one thing that makes an upholstered pad read as a drum of sheet metal. */}
      {geo.drums.map((r) => {
        const crown = cmToM(3);
        const body = cmToM(r.h) - crown;
        return (
          <group key={r.key} position={r.position}>
            <mesh position={[0, -crown / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[cmToM(r.r), cmToM(r.r), body, 44]} />
              {drumFabric}
            </mesh>
            <mesh position={[0, body / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[cmToM(r.r) - crown * 0.6, cmToM(r.r), crown, 44]} />
              {drumFabric}
            </mesh>
          </group>
        );
      })}

    </group>
  );
}
