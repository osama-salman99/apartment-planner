import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { Shape } from 'three';
import { cmToM } from '../lib/units';
import { BED_BASE_D, BED_BASE_W, type WoonspotBedSpec } from '../lib/woonspotBeds';
import { boucle, cells, plinthColor, quilt, shade, type Puff } from './upholstery';

/**
 * The whole WoonSpot XXL boxspring range from one parametric build — see `lib/woonspotBeds.ts` for
 * which numbers are quoted by the shop and which are read off the product photo.
 *
 * All 33 models are the same object under the upholstery: an upholstered box base carrying a
 * mattress, and a headboard whose *style* is the only thing that really separates them. So the
 * headboard is the parametric part — seven constructions — and everything else is shared.
 *
 * At rotation 0 the headboard is against the −Z wall and the foot of the bed points to +Z. The
 * item's width covers the headboard where that is wider than the mattress, which it usually is:
 * `headW` in the spec is the headboard's own width at a 160-wide mattress, and the two scale
 * together when the item is resized.
 */

// --- construction (cm) --------------------------------------------------------------------------
/** Top of the boxspring base — the mattress sits on this. */
const BASE_H = 32;
/** Mattress thickness. These are all sold "incl. matras", and it is a thick one. */
const MATTRESS_H = 27;
const PLINTH_H = 4;
const LEG_H = 13;
/** Recess of the base's plinth / leg positions from its own edge. */
const BASE_INSET = 8;
const PILLOW_W = 60;
const PILLOW_D = 38;
const PILLOW_H = 13;
/** A lit bedside unit flanking the headboard, for `wings: 'shelf'`. */
const SHELF_W = 46;
const SHELF_H = 52;

interface Panel {
  key: string;
  args: [number, number, number];
  position: [number, number, number];
  radius: number;
}

/** Puffs of the diamond-tufted (capitonné) grid, offset row to row so it reads as diamonds. */
function buttoned(w: number, h: number, t: number, y0: number, z: number): Puff[] {
  const out: Puff[] = [];
  const cell = 22;
  const rows = Math.max(2, Math.round(h / cell));
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    // Half-cell shift on alternate courses: without it this is just a grid of squares.
    const offset = r % 2 ? 0.5 : 0;
    const n = Math.max(2, Math.round(w / cell));
    const cw = w / n;
    for (let i = 0; i <= n; i++) {
      const cx = -w / 2 + (i + offset) * cw;
      if (cx - cw / 2 < -w / 2 - 0.5 || cx + cw / 2 > w / 2 + 0.5) continue;
      out.push({
        key: `b-${r}-${i}`,
        args: [cmToM(cw - 1.6), cmToM(rowH - 1.6), cmToM(t)],
        position: [cmToM(cx), cmToM(y0 + r * rowH + rowH / 2), cmToM(z)],
      });
    }
  }
  return out;
}

export function WoonspotBed({
  spec,
  w: wCm,
  d: dCm,
  h: hCm,
  color,
}: {
  spec: WoonspotBedSpec;
  w: number;
  d: number;
  h: number;
  color: string;
}) {
  const map = useMemo(() => boucle(), []);
  const onLegs = spec.base === 'legs';

  const geo = useMemo(() => {
    // The item's own box, and how the mattress sits inside it. The spec's headW/BED_BASE_W ratio is
    // preserved on resize, so a widened bed widens headboard and mattress together.
    const headScale = wCm / Math.max(spec.headW, BED_BASE_W);
    const mattressW = Math.min(wCm, BED_BASE_W * headScale);
    const headW = Math.min(wCm, spec.headW * headScale);
    const headT = Math.min(spec.headT * headScale, dCm * 0.2);

    const base = onLegs ? LEG_H : PLINTH_H;
    const baseTop = base + BASE_H;
    const mattressTop = baseTop + MATTRESS_H;
    // The item's height *is* the top of the headboard — that is what the catalog seeds it with —
    // but never let it be shortened below the mattress it stands behind.
    const headH = Math.max(hCm, mattressTop + 12);

    const z0 = -dCm / 2;
    const mattressZ0 = z0 + headT;
    const mattressD = dCm - headT;
    const headZ = z0 + headT / 2;

    // --- headboard ------------------------------------------------------------------------------
    const panels: Panel[] = [];
    const puffs: Puff[] = [];
    // Set only by the arched models: a swept silhouette rather than a stack of boxes.
    let arch: Shape | null = null;
    const hb0 = base; // headboards on these run to the floor / plinth, not just off the base
    const hbH = headH - hb0;
    // A quilted headboard is pads on a board, not pads floating in the air: the pads sit on the
    // front two-thirds of the depth and this slab closes the back.
    const puffZ0 = headZ - headT * 0.2;
    const puffZ1 = headZ + headT * 0.5;
    const backing: Panel = {
      key: 'hb-back',
      args: [cmToM(headW), cmToM(hbH), cmToM(headT * 0.36)],
      position: [0, cmToM(hb0 + hbH / 2), cmToM(headZ - headT * 0.32)],
      radius: 0.02,
    };

    switch (spec.head) {
      case 'flat':
        panels.push({
          key: 'hb',
          args: [cmToM(headW), cmToM(hbH), cmToM(headT)],
          position: [0, cmToM(hb0 + hbH / 2), cmToM(headZ)],
          radius: 0.04,
        });
        break;
      case 'arched': {
        // A genuinely curved top: the silhouette is extruded from a rectangle capped with a half
        // ellipse spanning the board's full width. Stacking narrowing boxes reads as a staircase at
        // these sizes, so it has to be one swept shape.
        const capH = Math.min(hbH * 0.42, headW * 0.34);
        const bodyH = hbH - capH;
        const hw = cmToM(headW / 2);
        const by = cmToM(bodyH);
        arch = new Shape();
        arch.moveTo(-hw, 0);
        arch.lineTo(hw, 0);
        arch.lineTo(hw, by);
        arch.absellipse(0, by, hw, cmToM(capH), 0, Math.PI, false, 0);
        arch.closePath();
        break;
      }
      case 'vChannel': {
        // Fluting: one tall rounded channel per column, so the reveals run floor to top.
        const cs = cells(headW, 15);
        cs.forEach((c, i) =>
          panels.push({
            key: `v${i}`,
            args: [cmToM(c.size - 1.2), cmToM(hbH), cmToM(headT)],
            position: [cmToM(-headW / 2 + c.at), cmToM(hb0 + hbH / 2), cmToM(headZ)],
            radius: Math.min(cmToM(c.size) / 2.6, 0.05),
          }),
        );
        break;
      }
      case 'hPanel': {
        const cs = cells(hbH, 34);
        cs.forEach((c, i) =>
          panels.push({
            key: `h${i}`,
            args: [cmToM(headW), cmToM(c.size - 1.4), cmToM(headT)],
            position: [0, cmToM(hb0 + c.at), cmToM(headZ)],
            radius: Math.min(cmToM(c.size) / 2.6, 0.05),
          }),
        );
        break;
      }
      case 'panelGrid':
        panels.push(backing);
        puffs.push(
          ...quilt(
            'g',
            { x0: -headW / 2, x1: headW / 2, z0: puffZ0, z1: puffZ1, y0: hb0, y1: headH },
            48,
            puffZ1 - puffZ0,
            Math.max(2, Math.round(hbH / 46)),
          ),
        );
        break;
      case 'buttoned':
        panels.push(backing);
        puffs.push(...buttoned(headW, hbH, puffZ1 - puffZ0, hb0, (puffZ0 + puffZ1) / 2));
        break;
      case 'bubble':
        // Fat puffs, deeper than they are tall — the "cloud" headboards.
        panels.push(backing);
        puffs.push(
          ...quilt(
            'p',
            { x0: -headW / 2, x1: headW / 2, z0: puffZ0, z1: puffZ1, y0: hb0, y1: headH },
            34,
            puffZ1 - puffZ0,
            Math.max(2, Math.round(hbH / 32)),
          ),
        );
        break;
    }

    // --- base, mattress, pillows ----------------------------------------------------------------
    const bx = mattressW / 2;
    const plinth = {
      args: [cmToM(mattressW - BASE_INSET * 2), cmToM(PLINTH_H), cmToM(mattressD - BASE_INSET * 2)] as [
        number,
        number,
        number,
      ],
      position: [0, cmToM(PLINTH_H / 2), cmToM(mattressZ0 + mattressD / 2)] as [number, number, number],
    };
    const legs = [-bx + BASE_INSET, bx - BASE_INSET].flatMap((x) =>
      [mattressZ0 + BASE_INSET, mattressZ0 + mattressD - BASE_INSET].map((z) => ({
        key: `l${x.toFixed(0)}-${z.toFixed(0)}`,
        position: [cmToM(x), cmToM(LEG_H / 2), cmToM(z)] as [number, number, number],
      })),
    );
    const pw = Math.min(PILLOW_W, mattressW / 2 - 4);
    const pillows = (mattressW > 110 ? [-1, 1] : [0]).map((s) => ({
      key: `pl${s}`,
      position: [cmToM(s * (mattressW / 4)), cmToM(mattressTop + PILLOW_H / 2), cmToM(mattressZ0 + PILLOW_D / 2 + 6)] as [
        number,
        number,
        number,
      ],
      w: cmToM(pw),
    }));
    // Bedside units read as part of the bed on these models, so they are drawn with it.
    const shelves =
      spec.wings === 'shelf' && headW > mattressW + SHELF_W
        ? [-1, 1].map((s) => ({
            key: `sh${s}`,
            position: [
              cmToM(s * (headW / 2 - SHELF_W / 2)),
              cmToM(SHELF_H / 2),
              cmToM(z0 + headT + 22),
            ] as [number, number, number],
            args: [cmToM(SHELF_W), cmToM(SHELF_H), cmToM(40)] as [number, number, number],
          }))
        : [];

    return {
      panels,
      puffs,
      plinth,
      legs,
      pillows,
      shelves,
      baseArgs: [cmToM(mattressW), cmToM(BASE_H), cmToM(mattressD)] as [number, number, number],
      basePos: [0, cmToM(base + BASE_H / 2), cmToM(mattressZ0 + mattressD / 2)] as [number, number, number],
      mattressArgs: [cmToM(mattressW - 1), cmToM(MATTRESS_H), cmToM(mattressD - 1)] as [number, number, number],
      mattressPos: [0, cmToM(baseTop + MATTRESS_H / 2), cmToM(mattressZ0 + mattressD / 2)] as [
        number,
        number,
        number,
      ],
      pillowArgs: [cmToM(PILLOW_H), cmToM(PILLOW_D)] as [number, number],
      headT: cmToM(headT),
      arch,
      // The extrusion runs from z=0 forward, so it is pushed back by half the board's depth. The
      // bevel is taken out of the depth so the total still matches headT.
      archOpts: {
        depth: cmToM(headT) - 0.03,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 2,
        curveSegments: 28,
      },
      archPos: [0, cmToM(hb0), cmToM(headZ - headT / 2) + 0.015] as [number, number, number],
    };
  }, [spec, wCm, dCm, hCm, onLegs]);

  const fabric = (
    <meshStandardMaterial color={color} map={map ?? undefined} roughness={0.95} metalness={0} />
  );

  return (
    <group>
      {onLegs ? (
        geo.legs.map((l) => (
          <mesh key={l.key} position={l.position} castShadow>
            <cylinderGeometry args={[0.014, 0.014, cmToM(LEG_H), 8]} />
            <meshStandardMaterial color="#1c1c1e" roughness={0.35} metalness={0.7} />
          </mesh>
        ))
      ) : (
        <mesh position={geo.plinth.position} castShadow receiveShadow>
          <boxGeometry args={geo.plinth.args} />
          <meshStandardMaterial color={plinthColor(color)} roughness={0.85} />
        </mesh>
      )}

      {/* boxspring base */}
      <RoundedBox
        args={geo.baseArgs}
        radius={spec.round ? 0.09 : 0.02}
        smoothness={3}
        position={geo.basePos}
        castShadow
        receiveShadow
      >
        {fabric}
      </RoundedBox>

      {/* mattress: always its own near-white, whatever the upholstery colour is */}
      <RoundedBox args={geo.mattressArgs} radius={0.05} smoothness={3} position={geo.mattressPos} castShadow>
        <meshStandardMaterial color="#f4f2ec" roughness={0.9} />
      </RoundedBox>

      {geo.pillows.map((p) => (
        <RoundedBox
          key={p.key}
          args={[p.w, geo.pillowArgs[0], geo.pillowArgs[1]]}
          radius={0.05}
          smoothness={3}
          position={p.position}
          castShadow
        >
          <meshStandardMaterial color="#ffffff" roughness={0.92} />
        </RoundedBox>
      ))}

      {geo.arch && (
        <mesh position={geo.archPos} castShadow receiveShadow>
          <extrudeGeometry args={[geo.arch, geo.archOpts]} />
          {fabric}
        </mesh>
      )}

      {geo.panels.map((p) => (
        <RoundedBox
          key={p.key}
          args={p.args}
          radius={Math.min(p.radius, Math.min(...p.args) / 2.5)}
          smoothness={3}
          position={p.position}
          castShadow
          receiveShadow
        >
          {fabric}
        </RoundedBox>
      ))}

      {geo.puffs.map((p) => (
        <RoundedBox
          key={p.key}
          args={p.args}
          radius={Math.min(0.055, Math.min(...p.args) / 3.2)}
          smoothness={3}
          position={p.position}
          castShadow
          receiveShadow
        >
          {fabric}
        </RoundedBox>
      ))}

      {geo.shelves.map((s) => (
        <RoundedBox key={s.key} args={s.args} radius={0.02} smoothness={3} position={s.position} castShadow receiveShadow>
          <meshStandardMaterial color={shade(color, -0.03)} map={map ?? undefined} roughness={0.9} />
        </RoundedBox>
      ))}
    </group>
  );
}
