import { useMemo } from 'react';
import * as THREE from 'three';
import { MeshReflectorMaterial, RoundedBox } from '@react-three/drei';
import {
  BATH_WEST_X,
  BATH_SPLIT_X,
  BEDROOM_SOUTH_Z,
  WC_SOUTH_Z,
  SHOWER,
  IN_X0,
  IN_X1,
  IN_Z0,
  WALL_THICKNESS,
  CEILING_HEIGHT,
} from '../lib/dimensions';
import { KITCHEN_RUN } from '../lib/dimensionLines';
import { sharedTextures } from '../lib/textures';
import { isPhoneViewport } from '../lib/device';

/**
 * Fitted fixtures, placed from the werktekening.
 *
 * The kitchen is the one that matters: the drawing shows a single 3000 straight run, 600 deep, against
 * the GABLE (west) wall, starting hard against the gallery wall. Its modules are measured off the
 * drawing and its appliances confirmed against a walkthrough of the flat — see the layout comment
 * below. Sanitary fittings are indicative: the drawing shows the symbols but prints no dimensions
 * for them.
 */
export function FixedFixtures() {
  const tex = sharedTextures();

  // Kitchen run: 600 deep off the gable's finished face, 3000 long (printed), starting hard against
  // the gallery wall.
  const counterDepth = KITCHEN_RUN.x1 - KITCHEN_RUN.x0;
  const counterMidX = IN_X0 + counterDepth / 2;
  const counterTopY = 0.9;
  /**
   * Module boundaries measured off the drawing (the run's own symbols), read from the gallery end:
   * fridge 600 | filler 300 | hob 600 | cabinet 460 | sink 450 | dishwasher 600 = 3010 ≈ the printed
   * 3000. The tenant's walkthrough confirms the order and the appliances — hob nearest the front
   * door, then a stretch of worktop, then the sink with a freestanding white dishwasher at the
   * living-room end — and it is what settles the two symbols the drawing leaves ambiguous.
   *
   * The fridge is the drawing's snowflake box in the gallery corner. It is the one appliance the
   * walkthrough never frames (the camera starts past it), so it is placed and sized from the drawing
   * alone: 600 × 600, hard into the corner.
   */
  const kzGallery = KITCHEN_RUN.z1; // 9.405 — the gallery wall's finished face
  const fridgeZ0 = kzGallery - 0.6;
  const hobZ1 = fridgeZ0 - 0.3; // 300 filler between fridge and hob
  const hobZ0 = hobZ1 - 0.6;
  const hobZ = (hobZ0 + hobZ1) / 2;
  const sinkZ1 = hobZ0 - 0.46;
  const sinkZ0 = sinkZ1 - 0.45;
  const sinkZ = (sinkZ0 + sinkZ1) / 2;
  const dwZ1 = sinkZ0;
  const dwZ0 = KITCHEN_RUN.z0; // living-room end of the run
  const dwZ = (dwZ0 + dwZ1) / 2;
  // Base run: worktop over everything from the dishwasher up to the fridge tower.
  const baseZ0 = dwZ1;
  const baseZ1 = fridgeZ0;
  const baseMidZ = (baseZ0 + baseZ1) / 2;
  const baseZLen = baseZ1 - baseZ0;
  // Wall units stop at the fridge tower and at the sink, as filmed; the splashback runs the full
  // length of worktop, dishwasher included.
  const upperZ0 = sinkZ0;
  const upperMidZ = (upperZ0 + fridgeZ0) / 2;
  const upperZLen = fridgeZ0 - upperZ0;
  const upperUnderside = 1.5;
  const upperTop = 2.2;
  const splashMidZ = (dwZ0 + fridgeZ0) / 2;
  const splashZLen = fridgeZ0 - dwZ0;

  // Bathroom block, east column: bathroom on the party-wall side (930 × 2350), WC/lobby, duct and
  // utility (930 × 1030) on the living-room side, and a sealed 900 × 675 shaft behind the bathroom.
  const wcMidX = (BATH_WEST_X + BATH_SPLIT_X) / 2;

  // Finished face of the bathroom's head wall (the bedroom's south partition), which the basin and
  // the mirror stand against.
  const bathHeadZ = BEDROOM_SOUTH_Z + WALL_THICKNESS / 2;

  // Living-room radiator: 1400 long on the gable wall, its north end 50 short of the gable window's
  // south jamb (z 2.725), which is the gap the photos show. Centre of the 1400 run.
  const RADIATOR_Z = 2.775 + 0.7;

  // Bedroom radiator: 400 long, in the façade corner of the party wall, 120 clear of the façade so
  // the pipes have the corner to rise in — the gap the photos show. Centre of the 400 run.
  const BED_RADIATOR_Z = IN_Z0 + 0.12 + 0.2;

  return (
    <group>
      {/* ---------------- kitchen (gable / west wall, gallery end) ----------------
          Base units white slab fronts on a recessed dark plinth, black worktop, white 150 tiles up
          to the wall units — all as photographed in the empty flat. */}
      <mesh position={[counterMidX, 0.5, baseMidZ]} castShadow receiveShadow>
        <boxGeometry args={[counterDepth - 0.04, 0.78, baseZLen]} />
        <meshStandardMaterial color="#f2f1ec" roughness={0.55} />
      </mesh>
      {/* recessed dark plinth, continuing behind the dishwasher */}
      <mesh position={[counterMidX - 0.03, 0.055, (dwZ0 + baseZ1) / 2]}>
        <boxGeometry args={[counterDepth - 0.1, 0.11, baseZ1 - dwZ0]} />
        <meshStandardMaterial color="#232528" roughness={0.6} />
      </mesh>
      <RoundedBox
        args={[counterDepth, 0.04, baseZLen + 0.02]}
        radius={0.01}
        position={[counterMidX, counterTopY, baseMidZ]}
        castShadow
      >
        <meshStandardMaterial map={tex.countertop} roughness={0.25} metalness={0.1} />
      </RoundedBox>
      {/* Worktop returning down to the floor at the living-room end, which is how the run ends. */}
      <mesh position={[counterMidX, 0.45, baseZ0 - 0.02]} castShadow receiveShadow>
        <boxGeometry args={[counterDepth, 0.9, 0.04]} />
        <meshStandardMaterial color="#f2f1ec" roughness={0.55} />
      </mesh>
      {/* splashback: white 300 × 150 tile in a running bond, worktop up to the wall units */}
      <mesh position={[IN_X0 + 0.02, (counterTopY + upperUnderside) / 2, splashMidZ]}>
        <boxGeometry args={[0.03, upperUnderside - counterTopY, splashZLen]} />
        <meshStandardMaterial map={tex.splashback} roughness={0.35} />
      </mesh>
      {/* upper cabinets, stopping short of the ceiling as filmed */}
      <mesh position={[IN_X0 + 0.19, (upperUnderside + upperTop) / 2, upperMidZ]} castShadow>
        <boxGeometry args={[0.38, upperTop - upperUnderside, upperZLen]} />
        <meshStandardMaterial color="#f2f1ec" roughness={0.55} />
      </mesh>
      {/* slim stainless extractor hood, under the first wall unit over the hob */}
      <mesh position={[IN_X0 + 0.21, upperUnderside - 0.03, hobZ]}>
        <boxGeometry args={[0.42, 0.06, 0.6]} />
        <meshStandardMaterial color="#c7c9cc" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* ---- fridge-freezer: the drawing's snowflake box, hard into the gallery corner ---- */}
      <mesh position={[counterMidX, upperTop / 2, (fridgeZ0 + kzGallery) / 2]} castShadow receiveShadow>
        <boxGeometry args={[counterDepth, upperTop, 0.6]} />
        <meshStandardMaterial color="#f2f1ec" roughness={0.55} />
      </mesh>
      {/* door split and the two bar pulls, so it reads as a fridge over a freezer and not a cupboard */}
      <mesh position={[KITCHEN_RUN.x1 + 0.002, 1.5, (fridgeZ0 + kzGallery) / 2]}>
        <boxGeometry args={[0.004, 0.012, 0.58]} />
        <meshStandardMaterial color="#c9c7c2" roughness={0.6} />
      </mesh>
      <mesh position={[KITCHEN_RUN.x1 + 0.02, 1.56, fridgeZ0 + 0.14]}>
        <boxGeometry args={[0.02, 0.02, 0.24]} />
        <meshStandardMaterial color="#b9bcbf" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[KITCHEN_RUN.x1 + 0.02, 1.44, fridgeZ0 + 0.14]}>
        <boxGeometry args={[0.02, 0.02, 0.24]} />
        <meshStandardMaterial color="#b9bcbf" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* ---- freestanding white dishwasher at the living-room end ---- */}
      <mesh position={[counterMidX + 0.01, 0.42, dwZ]} castShadow receiveShadow>
        <boxGeometry args={[counterDepth - 0.01, 0.84, dwZ1 - dwZ0 - 0.01]} />
        <meshStandardMaterial color="#ececeb" roughness={0.4} />
      </mesh>
      <mesh position={[counterMidX + 0.01, 0.85, dwZ]}>
        <boxGeometry args={[counterDepth - 0.01, 0.02, dwZ1 - dwZ0 - 0.01]} />
        <meshStandardMaterial color="#e2e2e0" roughness={0.45} />
      </mesh>
      {/* sink: single bowl with a gooseneck mixer */}
      <mesh position={[counterMidX, counterTopY + 0.025, sinkZ]}>
        <boxGeometry args={[0.4, 0.02, 0.42]} />
        <meshStandardMaterial color="#cfd2d4" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[IN_X0 + 0.09, counterTopY + 0.13, sinkZ]}>
        <cylinderGeometry args={[0.018, 0.018, 0.26, 12]} />
        <meshStandardMaterial color="#c2c6c9" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* induction hob */}
      <mesh position={[counterMidX, counterTopY + 0.022, hobZ]}>
        <boxGeometry args={[0.5, 0.015, 0.56]} />
        <meshStandardMaterial color="#111214" roughness={0.2} />
      </mesh>

      {/* ---------------- bathroom (party-wall side of the block, 930 × 2350) ----------------
          The two fixtures were at opposite ends from the drawing, which is what made the room read
          wrong: the drawing puts the SHOWER in the gallery half — a diagonal hatch with a floor
          drain, 900 wide — and a drawn basin outline, about 560 × 510 with its waste marked, hard
          against the head wall at the FAÇADE end. The app had the tray at the façade end and the
          basin against the party wall.

          Positions here are pixel-measured off the drawing, not printed on it: the bathroom carries
          only its 930 × 2350 envelope and a "900" against the shower, so treat the fixtures as
          ±5 cm. The envelope itself is exact. */}
      {/* Shower: the 930 × 900 recess in the party-wall corner, which is exactly what the drawing's
          diagonal hatch and floor drain fill. Three real walls make it — party wall, the 100 head
          wall, and the 70 partition that juts 900 back into the room — so it is a walk-in, open on
          the fourth side. Both earlier attempts were wrong in the same place: first a glass screen
          invented on the partition's line, then, once that came out, a tray floating in the middle of
          the room measured off the 100 wall (900 × 620). The partition is real and it is 70. */}
      {/* The zone itself is tiled floor, not a tray: the tour shows the bathroom's own floor tile
          running straight into the shower with a flush square gully in it, which is what a walk-in
          with a floor drain is. It used to be a 50 mm glossy white slab, and it read as a shower tray
          dropped on the floor. All that is left is a 12 mm step for the fall to the gully. */}
      <mesh
        position={[(SHOWER.x0 + SHOWER.x1) / 2, 0.008, (SHOWER.z0 + SHOWER.z1) / 2]}
        receiveShadow
      >
        <boxGeometry args={[SHOWER.x1 - SHOWER.x0, 0.012, SHOWER.z1 - SHOWER.z0]} />
        <meshStandardMaterial map={tex.tile} color="#e7e6e2" roughness={0.35} />
      </mesh>
      {/* Square stainless gully where the drawing marks the drain — the tour shows a square grate,
          not the round disc this used to be. */}
      <group position={[SHOWER.x0 + 0.15, 0.015, SHOWER.z1 - 0.12]}>
        <mesh>
          <boxGeometry args={[0.1, 0.008, 0.1]} />
          <meshStandardMaterial color="#aeb2b5" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.001, 0]}>
          <boxGeometry args={[0.072, 0.009, 0.072]} />
          <meshStandardMaterial color="#8f9498" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>
      {/* The fittings stay on the partition, where the drawing marks the mixer; what changes is what
          they are. */}
      <ShowerFittings x={SHOWER.x0} z={SHOWER.z1 - 0.35} />
      {/* basin against the head wall at the façade end */}
      <Basin x={5.11} z={bathHeadZ} w={0.56} d={0.5} rimY={0.85} />
      {/* mirror over the basin, on the head wall */}
      <BathroomMirror x={5.11} y={1.55} z={bathHeadZ} w={0.56} h={0.7} />
      {/* Ceiling fitting. The bathroom has no window, so the only thing reaching it is the sky
          environment — which has nothing above the room, so every upward-facing surface (the basin
          rim above all) shaded a cold grey however white its colour was. The real room has a flush
          ceiling light and it is on whenever anyone is in there, so it is modelled as fitted. */}
      <group position={[4.72, CEILING_HEIGHT, 6.95]}>
        <mesh position={[0, -0.022, 0]}>
          <cylinderGeometry args={[0.13, 0.14, 0.045, 24]} />
          <meshStandardMaterial color="#f6f5f2" roughness={0.4} emissive="#fff6e6" emissiveIntensity={0.45} />
        </mesh>
        <pointLight position={[0, -0.1, 0]} intensity={3.2} distance={4.6} decay={1.5} color="#fff4e2" />
      </group>

      {/* ---------------- WC ---------------- */}
      {/* Pan at the gallery end of the room, hung off the duct wall, as drawn. The cistern is inside
          that wall — the tour shows a wall-hung pan with nothing but a flush plate above it, so the
          box that used to stand there was a cistern this flat does not have. */}
      <WallHungWc x={wcMidX + 0.07} z={WC_SOUTH_Z - WALL_THICKNESS / 2} />
      {/* roll holder on the blank stretch of the room's west wall, past the door */}
      <group position={[BATH_WEST_X + WALL_THICKNESS / 2 + 0.008, 0.74, 7.24]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.016, 8]} />
          <meshStandardMaterial color="#c2c6c9" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh position={[0.022, 0, 0]}>
          <boxGeometry args={[0.03, 0.012, 0.14]} />
          <meshStandardMaterial color="#c2c6c9" metalness={0.75} roughness={0.25} />
        </mesh>
      </group>

      {/* ---------------- utility: washing machine, in the position the drawing marks "wm" ------ */}
      <mesh position={[4.36, 0.42, 8.61]} castShadow>
        <boxGeometry args={[0.6, 0.84, 0.6]} />
        <meshStandardMaterial color="#e9eaea" metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh position={[4.05, 0.5, 8.61]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 20]} />
        <meshStandardMaterial color="#3a3d42" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Nothing stands behind the bathroom's head wall: that is a 900 × 675 services shaft, walled
          off on all four sides. A dryer used to be drawn there, on the assumption the utility
          wrapped round into it — it doesn't, which also cost the utility 39 cm of depth it never had. */}

      {/* ---------------- radiators ----------------
          The living-room radiator is on the GABLE wall, not the façade: in photos of the flat it
          sits on the solid stretch of that wall with its far end at the gable window's jamb, which
          is also where the pipework rises. It was modelled as a 60 × 50 panel on the façade pier —
          wrong wall, and less than half the size.

          Size measured off the empty-flat and furnished shots by rectifying that wall (its ceiling
          and floor lines give the vertical scale at any point along it): ≈ 140 long × 50 high,
          bottom ≈ 15 above the floor, top ≈ 65 — a wide, low panel with visible columns, which is
          what a 2020 low-temperature district-heating system needs. Call it ±10 on the length: the
          photos are WhatsApp-recompressed wide-angle, so the far end sits at a steeply foreshortened
          part of the wall.

          It matters for furniture: it takes 1,4 m of the 3,68 m of blank gable wall between the
          kitchen run and the window, and nothing tall or deep should sit in front of it. */}
      <PanelRadiator position={[IN_X0 + 0.05, 0.4, RADIATOR_Z]} length={1.4} height={0.5} />

      {/* The bedroom's is the same panel, one size down and turned portrait.
          What photos of the flat do settle: it is a ribbed panel of the same family as the
          living-room one (not the plain slab this used to be), it stands beside the window rather
          than out along the wall, it is clearly TALLER than it is long — the opposite proportion to
          the living room's wide, low run — and its pipes and valve rise in the corner just past it.

          What they do NOT settle is absolute size, and this wall is the worst case in the whole set.
          The trick that scaled the living-room radiator — rectify the wall off its ceiling and floor
          lines — has nothing to work with here: the wall/ceiling junction is white-on-white and
          survives no gradient threshold at this compression, and the floor at that wall is behind the
          bed. Measured spans are 104 px long against ≥ 181 px tall, so length : height is at most
          1 : 1,74 and probably nearer 1 : 2. Off the standard ladder that leaves 400 × 700 (taken
          here), with 300 × 600 and 500 × 900 the neighbours either side. Two independent checks
          agree with 400: at that scale the pipe run reads 77 mm wide and the gap to the corner
          96 mm, both right for 15 mm pipe with a TRV head. Treat it as ±100 on each axis.

          Placement is a compromise the model forces. In the photos the radiator is on the WINDOW
          wall, in the strip between the window's jamb and the corner. The werktekening leaves only
          284 mm of façade wall there (window ends 5,416, party wall 5,7) and 71 mm on the other side
          — no radiator of any real size fits either, and the photo's own strip is far wider than 284.
          That is one more count against the flat being this unit type, already the standing
          conclusion in the photo set's README. So it goes where this plan can carry it: the party
          wall, hard into the façade corner, which from inside the room still reads as "beside the
          window" and keeps the same wall free for the bed. */}
      <PanelRadiator position={[IN_X1 - 0.05, 0.5, BED_RADIATOR_Z]} length={0.4} height={0.7} facing={-1} />
    </group>
  );
}

/** The sanitaryware white and the chrome, shared so the three fittings cannot drift apart. */
const CERAMIC = '#fbfbfa';
const CHROME = '#c6cacd';

function Chrome({ rough = 0.22 }: { rough?: number }) {
  return <meshStandardMaterial color={CHROME} metalness={0.85} roughness={rough} />;
}

/**
 * Glazed sanitary ware. The environment map has to be held back: at ceramic's real gloss the sky
 * dominates the shading and white porcelain renders a cold grey-blue, which is exactly how the
 * basin first came out.
 */
function CeramicMat({ rough = 0.22, env = 0.4 }: { rough?: number; env?: number }) {
  return <meshStandardMaterial color={CERAMIC} roughness={rough} metalness={0.02} envMapIntensity={env} />;
}

/**
 * Plan outline of the basin: flat against the wall, straight down both sides for the first ~40 % of
 * the depth, then a broad rounded front. A plain half-ellipse (the first attempt) comes out
 * pointed, like a teardrop — no basin is that shape.
 */
function basinOutline(hw: number, d: number): THREE.Shape {
  const straight = d * 0.42;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, straight);
  s.quadraticCurveTo(hw, d, 0, d);
  s.quadraticCurveTo(-hw, d, -hw, straight);
  s.lineTo(-hw, 0);
  return s;
}

/**
 * Wall-hung basin with a half-round front, as the tour's Badkamer post shows it: no pedestal, no
 * cabinet, a raised tap deck at the back with a single-lever chrome mixer, a chrome grid waste, and
 * the bottle trap on show underneath. It was two white boxes.
 *
 * The plan outline is the drawing's: `w` × `d` (560 × 500 there), flat against the wall and a
 * half-ellipse at the front. That outline is extruded with a bevel so the rim is rounded, and it
 * carries the bowl opening as a hole, so the bevel rounds the inside of the rim as well. The bowl
 * itself is a squashed hemisphere seen from inside, with a slightly larger one outside it for the
 * belly you actually see from across the room.
 *
 * `z` is the finished face of the wall; the basin projects into the room along +Z.
 */
function Basin({ x, z, w, d, rimY }: { x: number; z: number; w: number; d: number; rimY: number }) {
  const hw = w / 2;
  // The bowl: inset from the rim all round, and pushed forward of the tap deck at the back.
  const deck = 0.1;
  const bowlZ = deck + (d - deck) / 2 - 0.01;
  const bowlRx = hw - 0.055;
  const bowlRz = (d - deck) / 2 - 0.035;

  const rim = useMemo(() => {
    const s = basinOutline(hw, d);
    const hole = new THREE.Path();
    hole.absellipse(0, bowlZ, bowlRx, bowlRz, 0, Math.PI * 2, false);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.038,
      bevelEnabled: true,
      bevelThickness: 0.011,
      bevelSize: 0.011,
      bevelSegments: 3,
      curveSegments: 28,
    });
    // Lay the outline down so it becomes the plan. It has to be +90°, not −90°: that is what sends
    // the shape's own y (the basin's depth) to world +Z, out into the room. The other way round puts
    // the whole rim inside the wall, which is exactly how it first came out.
    g.rotateX(Math.PI / 2);
    return g;
  }, [hw, d, bowlZ, bowlRx, bowlRz]);

  // The belly is the SAME outline, inset — an ellipsoid instead (the first attempt) is wider than
  // the rim halfway back and shows as two white crescents sticking out past it. A fat bevel at both
  // ends of the extrusion is what rounds the underside.
  const belly = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(basinOutline(hw - 0.032, d - 0.042), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.032,
      bevelSegments: 5,
      curveSegments: 28,
    });
    g.rotateX(Math.PI / 2);
    return g;
  }, [hw, d]);

  const spout = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.088, 0),
      new THREE.Vector3(0, 0.126, 0.012),
      new THREE.Vector3(0, 0.138, 0.048),
      new THREE.Vector3(0, 0.128, 0.082),
      new THREE.Vector3(0, 0.112, 0.096),
    ]);
    return new THREE.TubeGeometry(c, 28, 0.013, 14, false);
  }, []);

  return (
    <group position={[x, 0, z]}>
      {/* The rim's top face is horizontal, so at ceramic gloss it mirrors the sky and reads blue-grey
          however white the colour is. It needs the environment held back further than the rest. */}
      <mesh geometry={rim} position={[0, rimY, 0]} castShadow receiveShadow>
        <CeramicMat rough={0.32} env={0.14} />
      </mesh>
      {/* The belly's top is a flat plate — it has to sit low enough that the bowl below covers it,
          or you look down through the rim's opening straight onto it and the bowl reads as a flat
          white ellipse with no depth at all. */}
      <mesh geometry={belly} position={[0, rimY - 0.075, 0]} castShadow>
        <CeramicMat rough={0.26} env={0.3} />
      </mesh>
      {/* the bowl, seen from inside; a shade wider than the rim's opening so the rim hides its edge */}
      <mesh position={[0, rimY - 0.028, bowlZ]} scale={[bowlRx + 0.014, 0.12, bowlRz + 0.014]}>
        <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#f6f6f4" roughness={0.24} envMapIntensity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* chrome grid waste in the bottom of the bowl */}
      <mesh position={[0, rimY - 0.142, bowlZ]}>
        <cylinderGeometry args={[0.019, 0.019, 0.006, 16]} />
        <Chrome rough={0.3} />
      </mesh>
      {/* bottle trap and the pipe back into the wall */}
      <mesh position={[0, rimY - 0.245, bowlZ]}>
        <cylinderGeometry args={[0.026, 0.026, 0.135, 14]} />
        <Chrome rough={0.28} />
      </mesh>
      <mesh position={[0, rimY - 0.215, bowlZ / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, bowlZ, 12]} />
        <Chrome rough={0.28} />
      </mesh>
      {/* single-lever mixer on the tap deck: round base, slim body, cast spout arching over the bowl */}
      <group position={[0, rimY + 0.016, 0.055]}>
        <mesh>
          <cylinderGeometry args={[0.027, 0.029, 0.018, 20]} />
          <Chrome />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.021, 0.024, 0.082, 20]} />
          <Chrome />
        </mesh>
        <mesh geometry={spout} castShadow>
          <Chrome />
        </mesh>
        <mesh position={[0, 0.104, -0.03]} rotation={[-0.28, 0, 0]}>
          <boxGeometry args={[0.017, 0.013, 0.072]} />
          <Chrome rough={0.18} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Wall-hung WC, as the tour shows it: a rounded pan cantilevered off the wall with a closed soft-close
 * lid, and a white dual-flush plate on the wall above — two round buttons, the small one left. The
 * cistern is concealed in the duct behind, which is why there is no visible box; the model used to
 * draw one, and a 850-tall slab against the wall is what a 1990s exposed cistern looks like.
 *
 * `z` is the finished face of the duct wall; the pan hangs off it into the room along −Z.
 */
function WallHungWc({ x, z }: { x: number; z: number }) {
  const seatY = 0.4;
  const proj = 0.54;

  // Pan, seat and lid all share one plan outline: narrow where it meets the wall, widest about
  // halfway out, closing to a rounded nose. A rounded BOX (what these were) reads as a capsule for
  // the pan and, for the lid, as a 360 × 460 flat slab with square corners — nothing like a WC.
  const [pan, seat, lid] = useMemo(() => {
    const shape = (hw: number, len: number) => {
      const back = hw * 0.66;
      const s = new THREE.Shape();
      s.moveTo(-back, 0);
      s.lineTo(back, 0);
      s.quadraticCurveTo(hw, -len * 0.28, hw, -len * 0.54);
      s.quadraticCurveTo(hw, -len, 0, -len);
      s.quadraticCurveTo(-hw, -len, -hw, -len * 0.54);
      s.quadraticCurveTo(-hw, -len * 0.28, -back, 0);
      return s;
    };
    // The outline runs to −y so that laying it down (+90° about X, as with the basin) sends it to
    // world −Z: out of the duct wall and into the room, which is the way the pan hangs.
    const lay = (s: THREE.Shape, o: THREE.ExtrudeGeometryOptions) => {
      const g = new THREE.ExtrudeGeometry(s, { ...o, bevelEnabled: true, bevelSegments: 4, curveSegments: 24 });
      g.rotateX(Math.PI / 2);
      return g;
    };
    return [
      lay(shape(0.18, proj), { depth: 0.11, bevelThickness: 0.05, bevelSize: 0.042 }),
      lay(shape(0.176, proj - 0.012), { depth: 0.014, bevelThickness: 0.006, bevelSize: 0.006 }),
      lay(shape(0.178, proj - 0.008), { depth: 0.014, bevelThickness: 0.006, bevelSize: 0.006 }),
    ];
  }, [proj]);

  return (
    <group position={[x, 0, z]}>
      {/* pan, hung off the wall with its top at seat height */}
      <mesh geometry={pan} position={[0, seatY - 0.05, 0]} castShadow receiveShadow>
        <CeramicMat rough={0.22} env={0.3} />
      </mesh>
      {/* seat ring on the pan, and the closed soft-close lid on top of that */}
      <mesh geometry={seat} position={[0, seatY + 0.024, 0]} castShadow>
        <meshStandardMaterial color="#f1f1ef" roughness={0.35} envMapIntensity={0.3} />
      </mesh>
      <mesh geometry={lid} position={[0, seatY + 0.044, 0]} castShadow>
        <meshStandardMaterial color="#f8f8f7" roughness={0.28} envMapIntensity={0.3} />
      </mesh>
      {/* dual-flush plate: white, landscape, the standard 212 × 142 */}
      <group position={[0, 1.02, -0.006]}>
        <mesh>
          <boxGeometry args={[0.212, 0.142, 0.012]} />
          <meshStandardMaterial color="#fafafa" roughness={0.3} />
        </mesh>
        {/* the two buttons have to sit PROUD of the plate, on its room side (−Z): at the plate's own
            depth they are swallowed by it and the plate reads as a blank white rectangle. */}
        <mesh position={[-0.038, -0.006, -0.0155]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.007, 20]} />
          <meshStandardMaterial color="#f0f0ef" roughness={0.4} />
        </mesh>
        <mesh position={[0.032, -0.006, -0.0155]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.033, 0.033, 0.007, 20]} />
          <meshStandardMaterial color="#f0f0ef" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Shower fittings, as the tour shows them: an exposed single-lever mixer at about a metre with its
 * two wall unions, a slide rail above it carrying the handset, and the metal hose looping down from
 * the mixer and back up. That is the whole shower — there is no fixed rain head, which is what the
 * model drew (a 180 disc up at 2.0 with a box below it, i.e. a thermostatic bar shower).
 *
 * `x` is the finished face of the partition it is mounted on; everything projects into the room
 * along +X, and the mixer body runs along Z, parallel to the wall.
 */
function ShowerFittings({ x, z }: { x: number; z: number }) {
  const railY0 = 1.36;
  const railY1 = 2.04;
  const mixerY = 1.06;

  // The hose: out of the underside of the mixer, down into a loop, and back up to the handset. A
  // swept tube is what makes it read as a shower rather than two chrome cylinders on a wall.
  const hose = useMemo(() => {
    const p = [
      [0.055, mixerY - 0.055, 0],
      [0.075, mixerY - 0.2, 0.045],
      [0.105, mixerY - 0.3, 0.115],
      [0.085, mixerY - 0.17, 0.16],
      [0.06, mixerY + 0.2, 0.1],
      [0.056, railY1 - 0.25, 0.035],
      [0.058, railY1 - 0.115, 0.006],
    ].map(([a, b, c]) => new THREE.Vector3(a, b, c));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 48, 0.0075, 10, false);
  }, [mixerY, railY1]);

  return (
    <group position={[x, 0, z]}>
      {/* slide rail on its two brackets */}
      <mesh position={[0.045, (railY0 + railY1) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, railY1 - railY0, 12]} />
        <Chrome />
      </mesh>
      {[railY0 + 0.02, railY1 - 0.02].map((y) => (
        <mesh key={y} position={[0.022, y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.044, 12]} />
          <Chrome />
        </mesh>
      ))}
      {/* Handset parked in the top holder. The lean has to be a good 55°, not a token 30°: any less
          and the spray face points at the ceiling, which is not where a shower aims. */}
      {/* The group is pivoted on the handset's BUTT, not its middle: pivot it centrally and leaning it
          out swings the butt — and the hose it carries — back into the wall. */}
      <group position={[0.058, railY1 - 0.115, 0]} rotation={[0, 0, -0.95]}>
        <mesh position={[0, 0.065, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.016, 0.13, 14]} />
          <Chrome />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.05, 0.032, 0.036, 22]} />
          <Chrome rough={0.26} />
        </mesh>
        <mesh position={[0, 0.169, 0]}>
          <cylinderGeometry args={[0.049, 0.049, 0.004, 22]} />
          <meshStandardMaterial color="#e8eaeb" roughness={0.55} />
        </mesh>
      </group>
      {/* exposed single-lever mixer: body across the wall on two unions, lever out to the right */}
      <group position={[0.05, mixerY, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.185, 20]} />
          <Chrome />
        </mesh>
        {[-0.075, 0.075].map((dz) => (
          <mesh key={dz} position={[-0.028, 0, dz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.05, 14]} />
            <Chrome />
          </mesh>
        ))}
        <mesh position={[0.03, -0.02, 0.055]} rotation={[0, 0, -0.55]}>
          <cylinderGeometry args={[0.011, 0.015, 0.1, 14]} />
          <Chrome rough={0.18} />
        </mesh>
        {/* hose outlet on the underside */}
        <mesh position={[0.005, -0.03, 0]}>
          <cylinderGeometry args={[0.013, 0.013, 0.03, 12]} />
          <Chrome />
        </mesh>
      </group>
      <mesh geometry={hose} castShadow>
        <meshStandardMaterial color="#b7bcc0" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  );
}

/**
 * The bathroom mirror, as the unit's own 360° tour shows it (kuula.co/share/NZFkm — the Badkamer
 * post; the panorama is mirrored left-to-right relative to this plan, so read fittings off it, not
 * sides): a plain FRAMELESS rectangle of glass fixed straight onto the tile, with a slim dark rail
 * screwed to the wall right under its bottom edge. No cabinet, no bevel, no light.
 *
 * It used to be a shiny grey box, which is the same mistake the ÅHEIM wardrobe doors made: a
 * polished `meshStandardMaterial` reflects only the environment cards, so it reads as painted metal.
 * This is a real planar reflection of the room, so the shower wall and the doorway actually appear in
 * it. The mirror is small and faces down a 930-wide room, so 512 is plenty of resolution — a phone
 * still gets the cheap material, since the extra render pass every frame is what phones can't carry.
 *
 * `z` is the finished face of the wall it hangs on; the glass stands 8 mm off it (the adhesive pad
 * thickness), and a dark backing plate behind gives the frameless edge something to be an edge of.
 */
function BathroomMirror({ x, y, z, w, h }: { x: number; y: number; z: number; w: number; h: number }) {
  const reflect = !isPhoneViewport();
  const railY = y - h / 2 - 0.025;

  return (
    <group>
      {/* backing plate: the sliver of dark that a frameless mirror's edge actually shows */}
      <mesh position={[x, y, z + 0.004]}>
        <boxGeometry args={[w, h, 0.008]} />
        <meshStandardMaterial color="#2a2f33" roughness={0.5} />
      </mesh>
      <mesh position={[x, y, z + 0.0085]}>
        <planeGeometry args={[w, h]} />
        {reflect ? (
          <MeshReflectorMaterial
            resolution={512}
            mirror={1}
            mixStrength={1}
            mixBlur={0}
            blur={[0, 0]}
            color="#c8d0d5"
            metalness={0.35}
            roughness={0.06}
          />
        ) : (
          <meshStandardMaterial color="#c8d0d5" metalness={0.92} roughness={0.08} />
        )}
      </mesh>
      {/* the rail under the mirror, on its two end brackets */}
      <mesh position={[x, railY, z + 0.035]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, w - 0.06, 12]} />
        <meshStandardMaterial color="#33383c" roughness={0.45} metalness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * (w / 2 - 0.03), railY, z + 0.018]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.036, 10]} />
          <meshStandardMaterial color="#33383c" roughness={0.45} metalness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One panel radiator, both of the flat's radiators built from it so they cannot drift apart.
 *
 * The ribs are the point: a plain slab reads as a box on the wall, and photos of the flat show a
 * ribbed front on both. Rib pitch is fixed at 50 with a 35 margin at each end, so a longer panel
 * simply gets more of them — the same detail at both sizes.
 *
 * `length` runs along Z (both radiators are on a side wall), `facing` is +1 when the room is on the
 * +X side of the wall and −1 when it is on the −X side; it puts the ribs and the valve on the face
 * you can actually see.
 */
function PanelRadiator({
  position,
  length,
  height,
  facing = 1,
}: {
  position: [number, number, number];
  length: number;
  height: number;
  facing?: 1 | -1;
}) {
  const ribs = Math.round((length - 0.1) / 0.05) + 1;
  const ribStart = -((ribs - 1) * 0.05) / 2;

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.1, height, length]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.5} metalness={0.1} />
      </mesh>
      {Array.from({ length: ribs }, (_, i) => (
        <mesh key={i} position={[0.052 * facing, 0, ribStart + i * 0.05]}>
          <boxGeometry args={[0.012, height - 0.04, 0.03]} />
          <meshStandardMaterial color="#eceae6" roughness={0.55} />
        </mesh>
      ))}
      {/* thermostatic valve at the window end, where the pipes rise */}
      <mesh position={[0.03 * facing, -height / 2 + 0.06, -(length / 2 - 0.02)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.07, 12]} />
        <meshStandardMaterial color="#f6f6f4" roughness={0.4} />
      </mesh>
    </group>
  );
}
