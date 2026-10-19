import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { cmToM } from '../lib/units';
import type { WoonspotSofaSpec } from '../lib/woonspotSofas';
import { boucle, plinthColor, quilt, shade, type Box, type Puff } from './upholstery';

/**
 * Every WoonSpot XXL sofa except the Trentino U-bank, from one parametric build — see
 * `lib/woonspotSofas.ts` for where each model's numbers come from and what is assumed.
 *
 * The range is 20 variations on the same construction, so it is built once and driven by the spec
 * rather than hand-modelled 19 times: a back run with a wing off one end (chaise / hoekbank) or
 * off both (U-bank), upholstery broken into puffs at three coarsenesses, on a recessed plinth or
 * thin black metal legs, optionally with a rounded module at the far end of the deep wing.
 *
 * At rotation 0 the back is against the −Z wall and the sofa opens toward +Z. `deepSide` is read
 * looking at the front of the sofa, so `right` puts the deep wing on +X.
 */

// --- construction (cm) --------------------------------------------------------------------------
/** Depth of the back run's upholstered back. */
const BACK_T = 24;
/** Width of a wing's arm. Past the back run's depth the wing is an open chaise. */
const ARM_T = 30;
/** Depth of the back-run band, back included. */
const RUN_D = 100;
/** Width of a wing, arm included. */
const WING_W = 105;
const PLINTH_H = 5;
const LEG_H = 14;
/** Seat top as a fraction of overall height (42 on 75). */
const SEAT_RATIO = 42 / 75;
const CUSHION = 46;
const CUSHION_T = 16;

/** Puff grid per quilt style: [frame cell, seat cell, frame courses, seat courses]. */
const GRID: Record<WoonspotSofaSpec['quilt'], [number, number, number, number]> = {
  bubble: [36, 50, 2, 2],
  panel: [60, 78, 2, 1],
  // One cell each: a single smooth mass for the frame, one deep cushion per seat run.
  tight: [9999, 96, 1, 1],
};

interface Round {
  key: string;
  r: number;
  y0: number;
  y1: number;
  position: [number, number];
}

export function WoonspotSofa({
  spec,
  w: wCm,
  d: dCm,
  h: hCm,
  color,
}: {
  spec: WoonspotSofaSpec;
  w: number;
  d: number;
  h: number;
  color: string;
}) {
  const map = useMemo(() => boucle(), []);
  const metal = spec.legs === 'metal';

  const geo = useMemo(() => {
    const [frameCell, seatCell, frameRows, seatRows] = GRID[spec.quilt];
    // Clamp the fixed thicknesses so a heavily resized sofa still reads as its own silhouette.
    const backT = Math.min(BACK_T, dCm * 0.2);
    const armT = Math.min(ARM_T, wCm * 0.12);
    const wingW = Math.min(WING_W, wCm * 0.34);
    const runD = Math.min(RUN_D, dCm * 0.6);
    const base = metal ? LEG_H : PLINTH_H;
    const seatTop = Math.max(base + 8, hCm * SEAT_RATIO);

    const x0 = -wCm / 2;
    const x1 = wCm / 2;
    const z0 = -dCm / 2;
    const deepRight = spec.deepSide === 'right';
    /** Deep wing: full depth. Shallow wing: only a U has one, at its own published leg length. */
    const deepLeg = dCm;
    const shortLeg =
      spec.layout === 'u' ? Math.max(runD + 10, Math.min(dCm, spec.shortWing ?? dCm * 0.75)) : 0;

    // The wing bands in x, deep and (for a U) shallow.
    const deepBand = deepRight ? { x0: x1 - wingW, x1 } : { x0, x1: x0 + wingW };
    const shortBand = deepRight ? { x0, x1: x0 + wingW } : { x0: x1 - wingW, x1 };
    const deepArm = deepRight ? { x0: x1 - armT, x1 } : { x0, x1: x0 + armT };
    const shortArm = deepRight ? { x0, x1: x0 + armT } : { x0: x1 - armT, x1 };

    const frameBox = { y0: base, y1: hCm };
    const seatBox = { y0: base, y1: seatTop };

    // --- frames: the full-height masses ---------------------------------------------------------
    const frameParts: { key: string; box: Box; cellX: number; cellZ: number }[] = [
      { key: 'back', box: { x0, x1, z0, z1: z0 + backT, ...frameBox }, cellX: frameCell, cellZ: backT },
      // The arm at the end away from the deep wing is there in every layout.
      { key: 'arm-short', box: { ...shortArm, z0, z1: z0 + runD, ...frameBox }, cellX: armT, cellZ: frameCell },
    ];
    if (spec.layout === 'u') {
      // Both wings get an arm — that is what makes a U rather than an L.
      frameParts.push({
        key: 'arm-deep',
        box: { ...deepArm, z0, z1: z0 + runD, ...frameBox },
        cellX: armT,
        cellZ: frameCell,
      });
    } else if (spec.layout === 'corner') {
      // A hoekbank's back turns the corner and runs down the outer face of the wing.
      frameParts.push({
        key: 'back-wing',
        box: { ...deepArm, z0: z0 + backT, z1: z0 + deepLeg, ...frameBox },
        cellX: armT,
        cellZ: frameCell,
      });
    }
    const frames = frameParts.flatMap((p) => quilt(p.key, p.box, p.cellX, p.cellZ, frameRows));

    // --- seats ---------------------------------------------------------------------------------
    // A rounded end is a full-width drum at the tip of the wing — the whole point of Capri/Denise/
    // Solida/Marbella/Palermo — so it is as wide as the wing and the straight seat stops short of it.
    const roundR = (leg: number) => (spec.roundEnd ? Math.min(wingW / 2, Math.max(0, leg - runD)) : 0);
    const endR = roundR(deepLeg);
    const shortR = roundR(shortLeg);
    const deepSeatZ1 = z0 + deepLeg - endR;
    // The run's seat stops at whatever stands at each end: an arm on the shallow side always, and
    // on the deep side an arm (U) or the wrapped-around back (corner) — but nothing at all on a
    // chaise, where the seat runs straight out into the open platform.
    const deepStop = spec.layout === 'chaise' ? 0 : armT;
    const runSeat = deepRight
      ? { x0: x0 + armT, x1: x1 - deepStop }
      : { x0: x0 + deepStop, x1: x1 - armT };
    // Same on the wing itself: a hoekbank's wing seat sits inboard of its outer back.
    const deepSeatBand = deepRight
      ? { x0: deepBand.x0, x1: deepBand.x1 - deepStop }
      : { x0: deepBand.x0 + deepStop, x1: deepBand.x1 };

    const seatParts: { key: string; box: Box }[] = [
      { key: 'seat-run', box: { ...runSeat, z0: z0 + backT, z1: z0 + runD, ...seatBox } },
      // The deep wing carries on forward from the run. On a chaise it is open on three sides, so
      // its pads run out to the sofa's own edge.
      { key: 'seat-deep', box: { ...deepSeatBand, z0: z0 + runD, z1: deepSeatZ1, ...seatBox } },
    ];
    if (spec.layout === 'u') {
      seatParts.push({
        key: 'seat-short',
        box: { ...shortBand, z0: z0 + runD, z1: z0 + shortLeg - shortR, ...seatBox },
      });
    }
    const seats = seatParts.flatMap((p) => quilt(p.key, p.box, seatCell, seatCell, seatRows));

    // --- rounded end modules -------------------------------------------------------------------
    const rounds: Round[] = [];
    if (endR > 1) {
      rounds.push({
        key: 'round-deep',
        r: endR,
        y0: base,
        y1: seatTop,
        position: [(deepSeatBand.x0 + deepSeatBand.x1) / 2, deepSeatZ1],
      });
    }
    // Solida and Capri are curved at both ends, so on a U the shallow wing gets one too.
    if (spec.layout === 'u' && shortR > 1) {
      rounds.push({
        key: 'round-short',
        r: shortR,
        y0: base,
        y1: seatTop,
        position: [(shortBand.x0 + shortBand.x1) / 2, z0 + shortLeg - shortR],
      });
    }

    // --- base: recessed plinth, or thin legs ---------------------------------------------------
    // Each footprint stops where a rounded module takes over, so no plinth slab sticks out past the
    // upholstery; the drums get their own round plinth instead.
    const inset = 9;
    const footprints = [
      { key: 'run', x0, x1, z0, z1: z0 + runD },
      { key: 'deep', ...deepBand, z0: z0 + runD, z1: z0 + deepLeg - endR },
      ...(spec.layout === 'u'
        ? [{ key: 'short', ...shortBand, z0: z0 + runD, z1: z0 + shortLeg - shortR }]
        : []),
    ].filter((p) => p.z1 - p.z0 > inset * 2 + 2);
    const plinths = footprints.map((p) => ({
      key: `p-${p.key}`,
      args: [cmToM(p.x1 - p.x0 - inset * 2), cmToM(PLINTH_H), cmToM(p.z1 - p.z0 - inset * 2)] as [
        number,
        number,
        number,
      ],
      position: [cmToM((p.x0 + p.x1) / 2), cmToM(PLINTH_H / 2), cmToM((p.z0 + p.z1) / 2)] as [
        number,
        number,
        number,
      ],
    }));
    const legInset = 12;
    const legs = footprints.flatMap((p) =>
      [p.x0 + legInset, p.x1 - legInset].flatMap((x) =>
        [p.z0 + legInset, p.z1 - legInset].map((z) => ({
          key: `l-${p.key}-${x.toFixed(1)}-${z.toFixed(1)}`,
          position: [cmToM(x), cmToM(LEG_H / 2), cmToM(z)] as [number, number, number],
        })),
      ),
    );

    // --- loose scatter cushions ----------------------------------------------------------------
    const cs = Math.min(CUSHION, wCm * 0.18);
    const lean = 0.3;
    const inner = deepRight ? x0 + armT : x1 - armT;
    const dir = deepRight ? 1 : -1;
    const cushions = [0.6, 1.5, 2.5].slice(0, spec.layout === 'chaise' ? 2 : 3).map((k, i) => ({
      key: `c${i}`,
      position: [
        cmToM(inner + dir * cs * k),
        cmToM(Math.min(seatTop + cs / 2, hCm - cs / 2 + 6)),
        cmToM(z0 + backT + CUSHION_T * 0.7),
      ] as [number, number, number],
      rotation: [-lean, i % 2 ? -0.12 : 0.08, 0] as [number, number, number],
    }));

    const roundPlinths = rounds
      .filter((r) => r.r > inset + 2)
      .map((r) => ({ key: `p-${r.key}`, r: r.r - inset, position: r.position }));

    return { frames, seats, rounds, plinths, roundPlinths, legs, cushions, cushionSize: cmToM(cs) };
  }, [spec, wCm, dCm, hCm, metal]);

  const cushionColor = shade(color, 0.04);
  const fabric = (
    <meshStandardMaterial color={color} map={map ?? undefined} roughness={0.95} metalness={0} />
  );

  const puff = (p: Puff, maxRadius: number) => (
    <RoundedBox
      key={p.key}
      args={p.args}
      radius={Math.min(maxRadius, Math.min(...p.args) / 3.4)}
      smoothness={3}
      position={p.position}
      castShadow
      receiveShadow
    >
      {fabric}
    </RoundedBox>
  );

  return (
    <group>
      {!metal &&
        geo.plinths.map((p) => (
          <mesh key={p.key} position={p.position} castShadow receiveShadow>
            <boxGeometry args={p.args} />
            <meshStandardMaterial color={plinthColor(color)} roughness={0.85} />
          </mesh>
        ))}

      {!metal &&
        geo.roundPlinths.map((p) => (
          <mesh
            key={p.key}
            position={[cmToM(p.position[0]), cmToM(PLINTH_H / 2), cmToM(p.position[1])]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[cmToM(p.r), cmToM(p.r), cmToM(PLINTH_H), 24]} />
            <meshStandardMaterial color={plinthColor(color)} roughness={0.85} />
          </mesh>
        ))}

      {metal &&
        geo.legs.map((l) => (
          <mesh key={l.key} position={l.position} castShadow>
            <cylinderGeometry args={[0.011, 0.011, cmToM(LEG_H), 8]} />
            <meshStandardMaterial color="#1c1c1e" roughness={0.35} metalness={0.7} />
          </mesh>
        ))}

      {geo.frames.map((p) => puff(p, spec.quilt === 'tight' ? 0.09 : 0.05))}
      {geo.seats.map((p) => puff(p, spec.quilt === 'tight' ? 0.1 : 0.055))}

      {geo.rounds.map((r) => (
        <mesh key={r.key} position={[cmToM(r.position[0]), cmToM((r.y0 + r.y1) / 2), cmToM(r.position[1])]} castShadow receiveShadow>
          <cylinderGeometry args={[cmToM(r.r), cmToM(r.r), cmToM(r.y1 - r.y0), 28]} />
          {fabric}
        </mesh>
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
