import { useMemo } from 'react';
import * as THREE from 'three';
import { cmToM } from '../lib/units';
import { fabricBump, linenGeometry, pillowGeometry } from './softLinen';

/**
 * The bedding that goes on a bed frame — a bare mattress, or that mattress made up. It is a separate
 * placed piece rather than part of any bed, because the beds here are either real IKEA GLB models (the
 * IDANÄS is frame-and-slats only) or parametric frames — neither ships bedding. So this lays ON a
 * frame: set its Y to the frame's mattress platform and it makes that bed.
 *
 * WHAT IT IS MODELLED ON. IKEA's own room shot of the exact article the placed frame is (50588088,
 * IDANÄS upholstered ottoman bed, Naggen beige) — the picture the user keeps in the media store as
 * "IDANÄS preview", IKEA's PE942247. That photo shows the bed FULLY DRESSED, and every layer in the
 * made-up version below is one thing visible in it:
 *
 *   - a white fitted sheet over the mattress, which is all that shows at the head to the right of the
 *     pillows and along the far side;
 *   - a white duvet, laid from just in front of the pillows down over the foot, hanging well past the
 *     mattress on both long sides and over the foot, its head edge turned back on itself;
 *   - FOUR pillows, all standing, in two rows of two: a back row near-upright against the headboard
 *     and a front row leaning forward against it, its tops a few centimetres lower. Every one of them
 *     has a flat Oxford hem round the filled middle;
 *   - a charcoal throw laid across the bed on the diagonal, over the foot half, hanging down the room
 *     side past the duvet.
 *
 * (An earlier version of this file was matched to a DIFFERENT picture of the same article — the plain
 * catalogue cut-out 50588088.jpg, which carries a bare mattress and nothing else. That is why the bare
 * entry exists and why it is worth keeping: it is the frame as IKEA sells it, with no bedding bought
 * yet. The dressed entry is the room shot. Neither is wrong; they are two photos of one bed.)
 *
 * COLOURS ARE SAMPLED, NOT GUESSED, off those photos. Mattress top rgb(234,234,232), side
 * rgb(212,212,203) — neutral white, a hair cool. In the room shot the duvet's lit top is rgb(224,223,219)
 * and the throw is rgb(59,58,54) in shade and rgb(108,110,109) where the light catches it, so the throw
 * is a genuine near-neutral charcoal rather than a blue or brown grey. The frame around all of it is
 * genuinely warm (lit face rgb(201,193,174), shaded rgb(172,159,139)), which is exactly why the white
 * layers must not be cream: see MATTRESS_COLOR.
 *
 * The cloth is real draped geometry, not boxes — see three/softLinen.ts for why a box cannot be made
 * to look like a duvet.
 *
 * GEOMETRY. Head is at local −Z, matching the IDANÄS model (whose headboard sits at its −Z end), so
 * bedding and frame take the same rotation. Y = 0 is the mattress underside, i.e. the frame's slat
 * platform, measured off the GLB's vertex cloud at 44 cm — the base's outer rim tops out at 49, so 17
 * of the mattress's 22 cm stand proud, as in the photo. (The 46/47 peaks in the vertex histogram are
 * that rim, not the slats; taking them for the platform floated the mattress 3 cm and let the slats
 * show through it.) The piece is NOT centred on the frame: the opening runs from the headboard at
 * z −94 to the foot panel at z +105, so a 200-long mattress sits at local z +5, leaving the beige
 * ledge and lift bar visible at the foot exactly as the photo shows.
 *
 * Those frame landmarks, restated in THIS component's own coordinates — every fall below is measured
 * against them, because cloth that falls further than the frame's own rim disappears inside the beige
 * and pokes out the far side of it: the base's rim top is local y = +5, its outer side faces are local
 * x = ±95.6, its foot panel's outer face is local z = +106, and the front of the headboard is local
 * z = −99.
 *
 * The throw hangs over local −X. That is deliberate rather than arbitrary: with the bed placed as it
 * is in the bedroom (rotated 90°, headboard against the living-room partition), local −X is the side
 * that faces the open floor, so the drape is on the side you walk past and can see.
 *
 * `h` is a vertical scale over the canonical stack, so a thinner mattress stays one number rather
 * than a rebuild. Note it scales the WHOLE stack, so the two library entries have different canonical
 * heights (22 bare, 72 made up) and swapping one for the other means swapping `h` too.
 */

const MATTRESS_H = 22;
/**
 * Canonical height the `h` scale is relative to: the mattress alone, or mattress-underside to the top
 * of the back row of pillows when the made-up layers are on (22 of mattress plus the 50 a 50 cm pillow
 * reaches once it is leaned back against the headboard — derived below, not guessed). Kept in step
 * with the two library entries' default `h` in state/furnitureCatalog.ts: they are the same two numbers,
 * and a mismatch silently renders the whole stack at the wrong scale.
 */
export const BEDDING_STACK_H = { bare: MATTRESS_H, madeUp: 72 };

/**
 * THE DUVET. Thickness, how far it reaches past the mattress sides, and how far it has fallen there.
 *
 * The overhang and the fall are the two numbers that took the longest to get right, and they are
 * constrained from both directions. Too little and the drape is geometrically present but completely
 * invisible, hidden inside the mattress it is hanging over — that is what a 9 cm overhang pulled back
 * by the default curl gives. Too much of the wrong kind and it falls INTO the frame: the base's outer
 * side is 5.6 cm further out than the mattress's, so cloth that drops before it has cleared that line
 * ends up inside the beige. So the duvet reaches 13 cm past the mattress and keeps almost all of it
 * (curl 0.22), which puts the hem about 4 cm proud of the base's own face — outside the frame — and
 * only then falls the 33 cm that lands it a third of the way down the base, as the photo has it.
 *
 * 13 rather than the 17 it was first built at, because the throw hangs off the SAME fold line on the
 * room side and the two drapes were interpenetrating: the duvet's white was showing through the dark
 * throw in a row of ragged holes. Both cloths sway in and out as they fall (see `flute`), so they only
 * stay apart if the gap between their two fall surfaces is wider than the sum of the two sways. Pulling
 * the duvet's fall 4 cm nearer the bed widens that gap without moving anything the eye reads.
 */
const DUVET_H = 11;
const DUVET_OVER = 13;
const DUVET_CURL = 0.28;
const DUVET_FALL = 33;
/** A filled duvet domes over the middle and carries long soft ridges. At 0 it is a card. */
const DUVET_PUFF = 5;
const DUVET_CREASE = 1.9;
/**
 * The foot: reaching 12 cm past the mattress clears the frame's foot panel (whose outer face is 6 cm
 * past the mattress) by a few centimetres, so the hem hangs in front of the panel rather than through
 * it, and 34 cm of fall lands it just below the panel's top edge.
 */
const DUVET_PAST_FOOT = 12;
const DUVET_FOOT_FALL = 33;
/**
 * Where the duvet's head edge falls, measured from the head end — i.e. how much of the bed is pillows
 * rather than duvet. In the photo the duvet's turned-back edge runs right along the base of the front
 * row of pillows, so this is derived from where that row ends up (see frontZ below) rather than picked:
 * a few centimetres further head-ward, so the duvet tucks under the pillows instead of stopping short
 * of them and showing a stripe of sheet in between.
 */
const DUVET_FROM_HEAD = 68;
/**
 * The cuff: the duvet's head edge turned back over itself. Modelled as a ROLLED edge — a soft
 * cylinder lying across the bed, half sunk into the duvet — plus a thin pale band of the inside
 * face behind it. It started as a slab of cloth sitting on top of the duvet and that read as a
 * plank floating over the bed, because a flat-bottomed box on a flat surface shows a hard shadow
 * line all the way round. A roll is tangent to what it lies on, so it cannot.
 */
const CUFF_ROLL_R = 4.5;
const CUFF_FLAT = 2.5;
const CUFF_D = 22;

/**
 * THE PILLOWS. Four, all standing, in two rows of two — which is what the reference photo shows, and
 * it is worth being explicit that it is NOT what an earlier version of this file did (two standing and
 * two lying flat in front of them). The give-away in the photo is that all four have their sewn faces
 * turned towards the room and their tops at almost the same height; a pillow lying flat shows you its
 * face from above and its hem edge-on from the front.
 *
 * 70 × 50 is the European standard size, and it is also what the photo measures: two of them span the
 * width of the 180 mattress with a small gap in the middle, and the front row's visible face is about
 * half again as wide as it is tall, which is a 70 cm pillow foreshortened by its lean.
 *
 * Both rows are built LYING DOWN and then stood up by their rotation. `pillowGeometry` lofts along its
 * own Y, so the flat faces you sleep on are its top and bottom; asking for a tall thin box instead
 * gives a pillow whose flat faces point at the ceiling and the floor, and head-on you then see its
 * sewn seam edge-on — a scalloped plate, which is exactly how the first version rendered.
 */
const PILLOW_W = 70;
const PILLOW_D = 50;
const PILLOW_LOFT = 19;
/** The flat sewn hem round the filled middle — see pillowGeometry's `border`. */
const PILLOW_BORDER = 5;
/** How far each row leans back off vertical, in radians: the back row rests on the headboard, the
 *  front row on the back row, so the front one is further over. */
const PILLOW_BACK_LEAN = 0.35;
const PILLOW_FRONT_LEAN = 0.72;
/** How much of the front pillow's depth is tucked in behind, resting against the back row. */
const PILLOW_OVERLAP = 9;
const PILLOW_GAP = 4;

/**
 * THE THROW. A charcoal blanket laid across the bed on the diagonal, over the foot half, hanging down
 * the room side. Its angle and position are not free: rotating a band about Y swings its corners in Z
 * by half its length times the sine of the angle, so a wide band at a bold angle puts one corner past
 * the foot panel and the other underneath the pillows. 16° with a 76 cm band, centred a little towards
 * the foot, is the most diagonal it can be while both corners stay on the bed — and it reproduces what
 * the photo shows, which is the throw's far edge running along the far side over the foot half and its
 * near end swinging up towards the head and over the side.
 *
 * It drapes over ONE side only, and it is therefore deliberately OFF-CENTRE (THROW_X): its far edge
 * stops a few centimetres short of the far side of the mattress and lies flat on the duvet there,
 * which is what the photo shows, while all of its surplus length is on the room side where it hangs.
 * Centring it and letting it drape over both sides is the obvious thing and it is wrong — the fall is
 * longer than the duvet's, so on the far side it would come down INSIDE the frame's beige base and
 * poke out the other face of it.
 *
 * THROW_FALL is 44 rather than the 62 it was first built at. 62 is closer to the length of cloth the
 * photo hangs over the side, but in the room's own light a dark 62 cm sheet down the whole flank of
 * the bed reads as a curtain hung off the mattress, not as a throw: it covers the beige base almost
 * to the legs, so the eye loses the bed's own shape and only sees the dark panel. Stopping it around
 * the middle of the base keeps the base visible above and below the fold, which is the cue that says
 * "cloth laid over a bed".
 */
const THROW_H = 3.5;
const THROW_ACROSS = 190;
const THROW_ALONG = 88;
const THROW_FALL = 44;
const THROW_CURL = 0.3;
const THROW_ANGLE = -0.1;
// How far the throw's own centre sits from the bed's, towards the room side. It does NOT move the
// fold — `flatX` is derived from it so the fall always starts at the mattress edge — it decides how
// much cloth is left hanging past that fold (5 - THROW_X, so 24 cm here). Made more negative than the
// original -16 to buy the fall a wider berth outside the duvet's; see DUVET_OVER.
const THROW_X = -19;
const THROW_Z = 32;

/**
 * The mattress has its OWN colour rather than deriving from the item's, because a mattress is white
 * whatever colour duvet cover you put on the bed — tie it to the item colour and picking a charcoal
 * duvet gives you a charcoal mattress.
 *
 * Sampled off the reference photos: the mattress's lit top face is rgb(234,234,232) and its side face
 * rgb(212,212,203) — i.e. NEUTRAL, a hair cool if anything. The set used to inherit the item's cream
 * #f2efe7 (11 points more red than blue), and against the frame's genuinely warm Naggen beige that
 * read as one continuous cream object instead of white bedding on a beige bed. This is the albedo, so
 * it sits under the render's lighting rather than matching the studio-lit photo value directly.
 */
const MATTRESS_COLOR = '#e7e7e5';
/**
 * The throw's own colour, fixed for the same reason the mattress's is: it is a second, contrasting
 * piece, so inheriting the duvet's colour would make it vanish. Sampled off the photo (rgb(59,58,54)
 * shaded, rgb(108,110,109) lit) and set a little above the shaded value, since this is albedo.
 */
const THROW_COLOR = '#565551';

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

export function Bedding({
  w: wCm,
  d: dCm,
  h: hCm,
  color,
  madeUp = false,
}: {
  w: number;
  d: number;
  h: number;
  color: string;
  madeUp?: boolean;
}) {
  const stackH = madeUp ? BEDDING_STACK_H.madeUp : BEDDING_STACK_H.bare;
  const w = cmToM(wCm);
  const d = cmToM(dCm);
  // Pillowcases and the turned-back cuff (the duvet's inside face) read lighter than the cover.
  const pale = shade(color, 0.05);

  const mattressH = cmToM(MATTRESS_H);
  const mattressTop = mattressH;

  const duvetW = w + cmToM(DUVET_OVER * 2);
  const duvetZ0 = -d / 2 + cmToM(DUVET_FROM_HEAD);
  const duvetZ1 = d / 2 + cmToM(DUVET_PAST_FOOT);
  const duvetLen = duvetZ1 - duvetZ0;
  const duvetTop = mattressTop + cmToM(DUVET_H);

  const geom = useMemo(() => {
    const mattress = linenGeometry(w, mattressH, d, {
      // A fitted sheet is taut: no drape, and only the faintest surface movement.
      ripple: 0.004,
      rippleScale: 0.9,
      seed: 3,
    });
    const duvet = linenGeometry(duvetW, cmToM(DUVET_H), duvetLen, {
      // The fall starts at the mattress's own edges, not inboard of them, so the flat top of the
      // duvet covers the mattress and everything past it is drape.
      flatX: w / 2,
      flatZ: duvetLen / 2 - cmToM(DUVET_PAST_FOOT),
      dropX: cmToM(DUVET_FALL),
      dropZ: cmToM(DUVET_FOOT_FALL),
      zSide: 'plus', // it hangs over the foot; the head end is turned back instead
      curl: DUVET_CURL,
      ripple: 0.032,
      rippleScale: 0.38,
      crease: cmToM(DUVET_CREASE),
      creaseScale: 0.32,
      puff: cmToM(DUVET_PUFF),
      // The long vertical folds down the sides and the foot. Without them the drape is three flat
      // planes meeting at hard corners, which is what made the whole duvet read as a moulded shell.
      // 3.2 rather than 4.5: the sway pushes the cloth OUTWARD as well as inward, and at 4.5 it
      // reached through the throw hanging just outside it. See DUVET_OVER.
      flute: cmToM(3.2),
      fluteScale: 0.3,
      seed: 11,
    });
    // The turned-back inside face: thin enough that it reads as fabric lying on fabric.
    const cuff = linenGeometry(duvetW, cmToM(CUFF_FLAT), cmToM(CUFF_D), {
      flatX: w / 2 - cmToM(4),
      dropX: cmToM(8),
      zSide: 'none',
      ripple: 0.008,
      rippleScale: 0.3,
      seed: 5,
    });
    const throwCloth = linenGeometry(cmToM(THROW_ACROSS), cmToM(THROW_H), cmToM(THROW_ALONG), {
      // Flat across the mattress, then over the room-side edge. `flatX` is measured in the throw's
      // OWN frame, whose centre is THROW_X off the bed's, so the mattress edge it has to start falling
      // at is that much nearer its middle — hence the term. Getting this wrong by that one offset puts
      // the start of the fall either 14 cm out in mid-air or 14 cm in over the mattress.
      flatX: w / 2 + cmToM(THROW_X),
      xSide: 'minus',
      zSide: 'none',
      dropX: cmToM(THROW_FALL),
      curl: THROW_CURL,
      ripple: 0.014,
      rippleScale: 0.34,
      crease: cmToM(1.2),
      creaseScale: 0.3,
      // A throw is loosely woven and much lighter than a duvet, so it gathers into fewer, deeper
      // folds over a shorter distance — bigger amplitude on a smaller scale than the duvet's. Capped
      // at 4 because the inward half of the sway would otherwise push it into the duvet underneath.
      flute: cmToM(4.0),
      fluteScale: 0.2,
      seed: 23,
    });
    // Both rows are built lying down — see PILLOW_W. They are stood up by their rotation, not by
    // their dimensions. Different seeds so the four are not one shape repeated.
    const pillows = [7, 13, 29, 41].map((s) =>
      pillowGeometry(cmToM(PILLOW_W), cmToM(PILLOW_LOFT), cmToM(PILLOW_D), s, cmToM(PILLOW_BORDER)),
    );
    return { mattress, duvet, cuff, throwCloth, pillows };
  }, [w, d, mattressH, duvetW, duvetLen]);

  // Cloth catches the light along the fibre — a flat diffuse white reads as paper. Sheen plus a
  // woven bump is what makes these look like textiles at walking distance in Walk mode.
  const bump = useMemo(() => ({ fine: fabricBump(9), coarse: fabricBump(5) }), []);

  /**
   * Standing up a pillow that was built lying down: rotate it a quarter turn about X, less the lean it
   * keeps by resting on whatever is behind it. Its 50 cm depth becomes (most of) its height and its
   * 17 cm loft becomes its thickness, so the face turned towards the room is the 70 × 50 one you sleep
   * on. `rise` and `reach` are what it then measures vertically and front-to-back, which is what
   * places it: sitting ON the mattress, and with its back against the front of the headboard or of the
   * row behind it rather than inside either.
   */
  const rise = (lean: number) => PILLOW_D * Math.cos(lean) + PILLOW_LOFT * Math.sin(lean);
  const reach = (lean: number) => PILLOW_D * Math.sin(lean) + PILLOW_LOFT * Math.cos(lean);
  const backReach = reach(PILLOW_BACK_LEAN);
  const frontReach = reach(PILLOW_FRONT_LEAN);
  // 1 cm off the headboard: touching it exactly leaves a seam that flickers as the camera moves.
  const backZ = -d / 2 + cmToM(backReach / 2 - 2);
  const backY = mattressTop + cmToM(rise(PILLOW_BACK_LEAN) / 2 - 1);
  const frontZ = backZ + cmToM((backReach + frontReach) / 2 - PILLOW_OVERLAP);
  const frontY = mattressTop + cmToM(rise(PILLOW_FRONT_LEAN) / 2 - 1);
  // Two pillows across a 180 bed: 70 wide each, leaving a small gap in the middle and a hand's width
  // at each side, which is how the photo has them.
  const pillowX = cmToM((PILLOW_W + PILLOW_GAP) / 2);
  const rows = [
    { lean: PILLOW_BACK_LEAN, y: backY, z: backZ },
    { lean: PILLOW_FRONT_LEAN, y: frontY, z: frontZ },
  ];

  return (
    // Vertical scale so `h` stays a real, editable number without re-deriving every layer.
    <group scale={[1, hCm / stackH, 1]}>
      <mesh geometry={geom.mattress} position={[0, mattressH / 2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={MATTRESS_COLOR}
          roughness={0.92}
          bumpMap={bump.fine}
          bumpScale={0.5}
          sheen={0.5}
          sheenRoughness={0.85}
          sheenColor="#ffffff"
        />
      </mesh>

      {madeUp && (
        <>
          <mesh
            geometry={geom.duvet}
            position={[0, mattressTop + cmToM(DUVET_H / 2), (duvetZ0 + duvetZ1) / 2]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color={color}
              roughness={0.95}
              bumpMap={bump.fine}
              bumpScale={0.8}
              sheen={0.55}
              sheenRoughness={0.8}
              sheenColor="#ffffff"
            />
          </mesh>
          {/* The head edge turned back over itself, so what shows is the inside of the cover: a thin
              band of it lying on the duvet, ending in the soft roll of the fold. */}
          <mesh
            geometry={geom.cuff}
            // Sunk 1 cm INTO the duvet, not stood on top of it. `duvetTop` is the duvet's nominal top,
            // but its rounded lip pulls the surface down by ~2 cm at the very head edge where this
            // band lies, so a band placed at duvetTop floats over a hollow — that was the flat white
            // card hanging in mid-air at the head end.
            position={[0, duvetTop - cmToM(CUFF_FLAT / 2 + 1), duvetZ0 + cmToM(CUFF_D / 2 - 1)]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color={pale}
              roughness={0.93}
              bumpMap={bump.fine}
              bumpScale={0.7}
              sheen={0.55}
              sheenRoughness={0.8}
              sheenColor="#ffffff"
            />
          </mesh>
          {/* The fold itself. Flattened to an oval by the group scale — a true circle reads as a pipe
              laid on the bed, an oval reads as cloth doubled over. Half sunk, so there is no gap. */}
          <group position={[0, duvetTop - cmToM(1.5), duvetZ0 + cmToM(2)]} scale={[1, 0.6, 1]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              {/* Length is the MATTRESS width, not the duvet's: the duvet is `DUVET_OVER` wider on each
                  side but that surplus is curled down the sides, so a roll cut to the full duvet width
                  stuck out into thin air as two stubs poking past the bed. */}
              <cylinderGeometry args={[cmToM(CUFF_ROLL_R), cmToM(CUFF_ROLL_R), w + cmToM(3), 24, 1]} />
              <meshPhysicalMaterial
                color={pale}
                roughness={0.93}
                bumpMap={bump.fine}
                bumpScale={0.7}
                sheen={0.55}
                sheenRoughness={0.8}
                sheenColor="#ffffff"
              />
            </mesh>
          </group>

          {/* Two rows of two, all standing: the back row against the headboard, the front row leaning
              forward against it. The alternating small Z-roll and Y-yaw per pillow is what stops four
              copies of one mesh reading as a printed pattern. */}
          {rows.map((row, r) =>
            [-1, 1].map((s) => (
              <mesh
                key={`p${r}${s}`}
                geometry={geom.pillows[r * 2 + (s > 0 ? 1 : 0)]}
                position={[s * pillowX, row.y, row.z]}
                rotation={[Math.PI / 2 - row.lean, s * 0.05 * (r + 1), s * (r ? -0.04 : 0.035)]}
                castShadow
                receiveShadow
              >
                <meshPhysicalMaterial
                  color={pale}
                  roughness={0.95}
                  bumpMap={bump.fine}
                  bumpScale={0.6}
                  sheen={0.6}
                  sheenRoughness={0.75}
                  sheenColor="#ffffff"
                />
              </mesh>
            )),
          )}

          {/* The throw, laid on the diagonal over the duvet. Its own group carries the rotation so the
              drape is built square and then turned, rather than trying to skew the cloth itself. */}
          <group position={[cmToM(THROW_X), 0, cmToM(THROW_Z)]} rotation={[0, THROW_ANGLE, 0]}>
            <mesh
              geometry={geom.throwCloth}
              // Clear of the duvet's dome: the duvet's flat top is DUVET_H up, and its puff lifts the
              // middle another DUVET_PUFF — which is exactly where this lies, so a throw parked at the
              // nominal top has the duvet growing through it.
              position={[0, mattressTop + cmToM(DUVET_H + DUVET_PUFF + THROW_H / 2), 0]}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color={THROW_COLOR}
                roughness={0.88}
                bumpMap={bump.coarse}
                bumpScale={1.1}
                sheen={0.45}
                sheenRoughness={0.6}
                sheenColor="#c9c9c4"
              />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}
