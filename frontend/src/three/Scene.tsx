import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
  Grid,
  ContactShadows,
  Environment,
  Lightformer,
} from '@react-three/drei';
import * as THREE from 'three';
import { useLayoutStore } from '../state/layoutStore';
import { useDesignsStore } from '../state/designsStore';
import { WIDTH, DEPTH, CEILING_HEIGHT } from '../lib/dimensions';
import { ApartmentShell } from './ApartmentShell';
import { OutdoorBackdrop } from './OutdoorBackdrop';
import { SkyAndSun } from './SkyAndSun';
import { FurnitureItem } from './FurnitureItem';
import { WalkControls } from './WalkControls';
import { DimensionLayer, RoomAreaLayer, WallDimensionLayer } from './DimensionLayer';
import { notePointerDown, wasDrag } from './pointerGesture';
import { HEIGHTS, DIM_LEGEND, WALL_LEGEND, DIM_COLOR, ROOM_AREAS, TOTAL_AREA_M2 } from '../lib/dimensionLines';
import { isPhoneViewport } from '../lib/device';
import { planFrame, PLAN_BAR_PHONE_PX, PLATE_STRIP_PHONE_PX } from '../lib/planFit';

// Watches for WebGL context loss (a phone running low on GPU memory drops the context, which no
// React error boundary can catch). Calling preventDefault lets the browser restore the same
// context instead of killing it for good; r3f re-renders the scene on the restore event.
function ContextLossGuard({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, onLost, onRestored]);
  return null;
}

const CENTER: [number, number, number] = [WIDTH / 2, 0, DEPTH / 2];

// Walk mode: lock the *horizontal* field of view to a natural-wide human value and derive the
// vertical fov (what three.js actually takes) from the live aspect ratio, so the horizontal view
// stays constant no matter the window shape. 110° horizontal ≈ immersive human vision without
// fisheye.
const WALK_H_FOV_DEG = 110;
function walkVerticalFov(aspect: number): number {
  const h = THREE.MathUtils.degToRad(WALK_H_FOV_DEG);
  const v = 2 * Math.atan(Math.tan(h / 2) / aspect);
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(v), 50, 100);
}

// Test-only: expose the live camera + orbit controls on window so the headless harness can drive
// arbitrary cinematic perspectives (close-ups, low/eye-level, any side). No-op in normal use.
const TEST = typeof window !== 'undefined' && window.location.search.includes('test');
function TestCamBridge() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const gl = useThree((s) => s.gl);
  (window as unknown as { __cam: unknown }).__cam = { camera, controls, gl };
  return null;
}

/**
 * The whole app is oriented to read like the construction drawing: gallery and front door at the
 * TOP of the screen, party wall on the LEFT, façade glazing along the bottom, kitchen gable on the
 * right. The model's own frame is that drawing turned through 180° (see dimensions.ts), so every
 * default camera turns 180° back — screen up is +Z and screen right is −X. It is a rotation of the
 * view, not a mirror of the geometry, so the flat keeps its real hand.
 */
const PLAN_UP: [number, number, number] = [0, 0, 1];

/**
 * Top-down plan.
 *
 * The framing itself lives in lib/planFit.ts — the camera and the heights/legend plate both have to
 * agree on it, and it is pure arithmetic worth testing on its own. Here the rig just applies it and
 * keeps the pan honest.
 */
/** How far, in metres, the plan may be dragged past its own edge — enough to clear a dimension label. */
const PAN_SLACK = 0.7;

function PlanRig({ isTransforming }: { isTransforming: boolean }) {
  const size = useThree((s) => s.size);
  const controls = useRef<React.ComponentRef<typeof OrbitControls> | null>(null);
  const showDimensions = useLayoutStore((s) => s.showDimensions);
  const showWallDims = useLayoutStore((s) => s.showWallDims);
  const showAreas = useLayoutStore((s) => s.showAreas);
  const setPlanPlate = useLayoutStore((s) => s.setPlanPlate);
  const cam = useRef<THREE.OrthographicCamera>(null);

  const frame = planFrame(size.width, size.height, {
    dims: showDimensions,
    plate: showDimensions || showWallDims || showAreas,
    // The phone's strip is taller than the desktop's and floats 66 px up, clear of the Plan/3D
    // switch — so it needs a bigger reserve, not none at all.
    stripPx: isPhoneViewport() ? PLATE_STRIP_PHONE_PX : undefined,
    barPx: isPhoneViewport() ? PLAN_BAR_PHONE_PX : undefined,
  });
  const { zoom, focus, bounds } = frame;

  // The plate reads this to place itself in whichever slack the fit actually left.
  useEffect(() => setPlanPlate(frame.plate), [frame.plate, setPlanPlate]);

  useEffect(() => {
    if (!cam.current) return;
    cam.current.zoom = zoom;
    cam.current.updateProjectionMatrix();
  }, [zoom]);

  // Re-frame when the fit changes (a resize, or a layer being toggled): OrbitControls owns the target
  // once the user has dragged, so without this the view keeps the old, now-wrong centre.
  useEffect(() => {
    const c = controls.current as unknown as
      | { target: THREE.Vector3; object: THREE.OrthographicCamera; update: () => void }
      | null;
    if (!c) return;
    c.target.set(focus[0], 0, focus[2]);
    c.object.position.set(focus[0], 30, focus[2]);
    c.object.zoom = zoom;
    c.object.updateProjectionMatrix();
    c.update();
  }, [focus[0], focus[2], zoom]);

  /**
   * Keep the drawing on screen without limiting how far you can travel across it.
   *
   * This used to clamp the target to ±3 m of where the plan frames itself, which is fine zoomed out
   * and wrong zoomed in: 3 m is less than half the flat's 9,7 m depth, so once you were close enough
   * to read a chain you could not drag the façade or the gallery end into the middle of the screen at
   * all — the view just stopped. The limit now follows the content instead. The visible rectangle may
   * roam anywhere over the padded drawing (PAN_SLACK of overhang, so a label sitting just outside a
   * wall can still be pulled clear of the edge), which means every part of the plan is reachable at
   * any zoom, while the centre of the screen never leaves the drawing. On an axis where the drawing
   * already fits, the view stays pinned to its framed position — there is nothing to go and look at.
   *
   * Camera and target move together; moving only the target would swing the view instead of sliding it.
   */
  const clampPan = () => {
    const c = controls.current as unknown as { target: THREE.Vector3; object: THREE.OrthographicCamera } | null;
    if (!c) return;
    const z = c.object.zoom || zoom;
    // Screen right is −x and screen up is +z (see PLAN_UP), so width bounds x and height bounds z.
    const span = (lo: number, hi: number, visible: number, framed: number) => {
      const half = visible / 2 - PAN_SLACK;
      return lo + half > hi - half ? ([framed, framed] as const) : ([lo + half, hi - half] as const);
    };
    const [xLo, xHi] = span(bounds.xLo, bounds.xHi, size.width / z, focus[0]);
    const [zLo, zHi] = span(bounds.zLo, bounds.zHi, size.height / z, focus[2]);
    const x = THREE.MathUtils.clamp(c.target.x, xLo, xHi);
    const zt = THREE.MathUtils.clamp(c.target.z, zLo, zHi);
    if (x === c.target.x && zt === c.target.z) return;
    c.object.position.x += x - c.target.x;
    c.object.position.z += zt - c.target.z;
    c.target.set(x, c.target.y, zt);
  };

  return (
    <>
      <OrthographicCamera
        ref={cam}
        makeDefault
        position={[focus[0], 30, focus[2]]}
        zoom={zoom}
        up={PLAN_UP}
        near={0.1}
        far={100}
      />
      <OrbitControls
        key="plan"
        ref={controls}
        makeDefault
        target={focus}
        enableRotate={false}
        enabled={!isTransforming}
        // Zooming out past the fit only ever adds dead space — and because the pan clamp pins the view
        // when the drawing fits, it also left you stuck looking at a small plan you could not move. A
        // little slack under the fit is useful (it shows the whole padded drawing at once), a lot is not.
        minZoom={zoom * 0.9}
        maxZoom={Math.max(240, zoom * 6)}
        // Drag the plan to move it. Rotation is off here, so a left drag (and a one-finger drag on
        // a phone) was doing nothing at all — the only way to see past the frame edge when zoomed in
        // was to zoom back out. Right-drag keeps panning, as it always did.
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        onChange={clampPan}
      />
    </>
  );
}

const PHONE_FOV = 58;
const PHONE_ELEV_DEG = 45; // looking down into the flat, close to the desktop view's 44°
const PHONE_TARGET = new THREE.Vector3(WIDTH / 2, CEILING_HEIGHT / 2, DEPTH / 2);
const FLAT_CORNERS: THREE.Vector3[] = [0, WIDTH].flatMap((x) =>
  [0, CEILING_HEIGHT].flatMap((y) => [0, DEPTH].map((z) => new THREE.Vector3(x, y, z))),
);

/**
 * Viewing direction for the phone, turned so the flat's long axis lies along the screen's long axis:
 * nearly end-on in portrait, nearly broadside in landscape.
 *
 * Reusing the desktop's fixed 43° azimuth is the tempting shortcut, but it lays the 9.7 m axis
 * diagonally across the frame, which is the worst fit for either phone shape — measured against this
 * rule it costs about a third of the flat's on-screen size in portrait and nearly half in landscape.
 */
function phoneDir(aspect: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(45 + 32 * Math.log2(Math.max(0.05, aspect)), 16, 76),
  );
  const el = THREE.MathUtils.degToRad(PHONE_ELEV_DEG);
  // Negated in x and z so the phone looks over the same corner as Plan and the desktop 3D view —
  // the drawing's near corner. The elevation is untouched: this is a turn, not a flip.
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/**
 * Smallest camera distance along `dir` that still keeps all eight corners of the flat on screen.
 *
 * Fitting the flat's enclosing sphere instead is the obvious shortcut, but the flat is a long thin
 * slab: the sphere is far bigger than the shape, so a sphere fit leaves the flat small and floating
 * in the middle of the screen. Trimming the sphere to compensate then clips the corners, because the
 * guarantee is gone — which is exactly what the first cut of this did. Projecting the real corners
 * and binary-searching the distance is both tight and exact at any aspect, and it runs once per
 * orientation change rather than per frame.
 */
function fitPhoneDistance(aspect: number, dir: THREE.Vector3): number {
  const probe = new THREE.PerspectiveCamera(PHONE_FOV, aspect, 0.1, 400);
  const worstExtent = (d: number) => {
    probe.position.copy(dir).multiplyScalar(d).add(PHONE_TARGET);
    probe.lookAt(PHONE_TARGET);
    probe.updateMatrixWorld(true);
    probe.updateProjectionMatrix();
    let m = 0;
    for (const c of FLAT_CORNERS) {
      const p = c.clone().project(probe);
      m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
    }
    return m;
  };
  // lo starts clear of the flat's own radius so every corner stays in front of the probe camera —
  // a corner behind it projects inverted and would poison the search.
  let lo = 8;
  let hi = 90;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    // Extent shrinks as the camera pulls back. 0.93 leaves a slim, even margin all round.
    if (worstExtent(mid) > 0.93) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * 3D orbit rig for phones. The desktop 3D view is a single fixed pose framed for a landscape window;
 * on a phone both the direction and the distance have to follow the viewport, or the flat ends up
 * clipped down its long axis in portrait and tiny in landscape.
 */
function PhoneOrbitRig({ isTransforming }: { isTransforming: boolean }) {
  const size = useThree((s) => s.size);
  const aspect = size.height ? size.width / size.height : 0.5;
  const cam = useRef<THREE.PerspectiveCamera>(null);

  const FOV = PHONE_FOV;
  const target = PHONE_TARGET;
  const dir = phoneDir(aspect);
  const dist = fitPhoneDistance(aspect, dir);
  const pos = dir.clone().multiplyScalar(dist).add(target);

  // Re-frame on mount and on a real orientation/size change only — after that OrbitControls owns
  // the camera, so re-applying the pose every render would fight the user's own dragging.
  const fitKey = Math.round(aspect * 20);
  useEffect(() => {
    const c = cam.current;
    if (!c) return;
    c.position.set(pos.x, pos.y, pos.z);
    c.fov = FOV;
    c.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <>
      <PerspectiveCamera
        ref={cam}
        makeDefault
        position={[pos.x, pos.y, pos.z]}
        fov={FOV}
        near={0.1}
        far={400}
      />
      <OrbitControls
        key="orbit-phone"
        makeDefault
        target={[target.x, target.y, target.z]}
        enabled={!isTransforming}
        enablePan
        screenSpacePanning
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        maxPolarAngle={Math.PI / 2.4}
        minDistance={1.5}
        maxDistance={dist * 2.2}
      />
    </>
  );
}

function Rig() {
  const viewMode = useLayoutStore((s) => s.viewMode);
  const isTransforming = useLayoutStore((s) => s.isTransforming);
  const size = useThree((s) => s.size);
  const aspect = size.height ? size.width / size.height : 1.6;

  if (viewMode === 'plan') return <PlanRig isTransforming={isTransforming} />;
  if (viewMode === 'orbit' && isPhoneViewport()) return <PhoneOrbitRig isTransforming={isTransforming} />;

  // Walk (eye level, grounded) and Free (6-DOF fly) — WalkControls drives the camera in both.
  if (viewMode === 'walk' || viewMode === 'free') {
    return (
      <>
        {/* Walk = standing in the room, so a wide human field of view — its horizontal fov is
            locked to 110° (see walkVerticalFov) and the vertical follows the window aspect. Free
            keeps the tighter 72° camera-lens framing for flying around. */}
        <PerspectiveCamera
          makeDefault
          position={[WIDTH * 0.68, 1.6, DEPTH * 0.5]}
          fov={viewMode === 'walk' ? walkVerticalFov(aspect) : 72}
          near={0.03}
          far={800}
        />
        {/* key by mode so Walk and Free each re-init to their own spawn instead of Free
            inheriting Walk's last camera pose. */}
        <WalkControls key={viewMode} free={viewMode === 'free'} />
      </>
    );
  }

  // Standing inside the lounge at eye height, looking out — free to look around and move
  // (right-drag / two-finger to pan the eye position, scroll to step forward/back).
  if (viewMode === 'window') {
    return (
      <>
        <PerspectiveCamera makeDefault position={[WIDTH - 1.6, 1.55, 3.0]} fov={62} near={0.03} far={800} />
        <OrbitControls
          key="window"
          makeDefault
          target={[WIDTH - 1.62, 1.15, -4]}
          enabled={!isTransforming}
          enablePan
          screenSpacePanning
          minDistance={0.3}
          maxDistance={16}
          maxPolarAngle={Math.PI * 0.62}
        />
      </>
    );
  }

  // The ceiling is invisible from up here (see ApartmentShell: it is a downward-facing single
  // face) and every side is a solid exterior wall (this
  // is a real enclosed floor plan, not a dollhouse cutaway) — so the camera sits high on a
  // steep-ish downward angle. Panning is on so you can move around freely.
  //
  // The corner it sits over is the drawing's near corner (façade × gable), so switching between
  // Plan and 3D no longer turns the flat through 180°. It also happens to be the better view: the
  // two nearest walls are the corner glazing, so you look INTO the living room through the glass
  // instead of over the blind gallery wall.
  return (
    <>
      <PerspectiveCamera makeDefault position={[WIDTH / 2 - 6, 8.5, DEPTH / 2 - 6.5]} fov={48} near={0.1} far={220} />
      <OrbitControls
        key="orbit"
        makeDefault
        target={CENTER}
        enabled={!isTransforming}
        enablePan
        screenSpacePanning
        maxPolarAngle={Math.PI / 2.4}
        minDistance={1.5}
        maxDistance={40}
      />
    </>
  );
}

export function Scene() {
  const items = useLayoutStore((s) => s.items);
  const gridSnap = useLayoutStore((s) => s.gridSnap);
  const select = useLayoutStore((s) => s.select);
  const viewMode = useLayoutStore((s) => s.viewMode);
  const showDimensions = useLayoutStore((s) => s.showDimensions);
  const showWallDims = useLayoutStore((s) => s.showWallDims);
  const showAreas = useLayoutStore((s) => s.showAreas);
  const planPlate = useLayoutStore((s) => s.planPlate);
  const [contextLost, setContextLost] = useState(false);

  // Phones are GPU-memory-tight, so cap the pixel ratio and skip antialiasing there. The heavy
  // outdoor backdrop is loaded only when it can
  // actually be seen: looking straight down in Plan it is invisible, so it stays off until the phone
  // switches to a 3D view, where the ground and neighbouring blocks are most of the realism.
  const phone = isPhoneViewport();
  // The backdrop stays off for a signed-out visitor.
  const signedIn = useDesignsStore((s) => s.authenticated);
  const wantsBackdrop = signedIn && (!phone || viewMode !== 'plan');

  // Capture phase on window, so the press position is recorded before any r3f handler runs — including
  // for a piece of furniture whose own handler bails out to let the camera take the gesture.
  useEffect(() => {
    window.addEventListener('pointerdown', notePointerDown, true);
    return () => window.removeEventListener('pointerdown', notePointerDown, true);
  }, []);

  return (
    <>
    <Canvas
      // Soft (PCSS) shadows are a real per-pixel cost; phones get plain PCF instead, which reads
      // near-identically at phone size and keeps the 3D view smooth under touch.
      shadows={phone ? true : 'soft'}
      dpr={phone ? [1, 1.5] : [1, 2]}
      gl={{ antialias: !phone, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.25, powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        {/* Atmospheric haze: negligible on the near room, but fades the distant blocks so the
            skyline has real depth instead of every building rendering equally sharp. Colour
            matches the horizon sky. */}
        <fogExp2 attach="fog" args={['#c4d2e0', 0.0055]} />

        {/* Image-based lighting from a couple of sky/ground light cards — self-contained (no
            external HDR), gives the glass and car paint something real to reflect. */}
        <Environment resolution={128} frames={1}>
          <Lightformer intensity={1.1} position={[0, 6, -12]} scale={[30, 18, 1]} color="#e8f0f8" />
          <Lightformer intensity={0.5} position={[0, -8, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} color="#9a9385" />
          <Lightformer intensity={0.6} position={[-14, 4, 2]} scale={[10, 12, 1]} color="#dfe6ee" />
        </Environment>

        <Rig />
        {TEST && <TestCamBridge />}
        <ContextLossGuard onLost={() => setContextLost(true)} onRestored={() => setContextLost(false)} />
        {/* Seen from straight above, the sky shader is a near-white sheet that blinds on a phone.
            Plan view gets a flat mid-tone warm stone instead (#e2dcd1 and #bdb5a8 were still too bright) — in both
            themes (charcoal was tried and rejected: the plan should read as a bright drawing). */}
        {viewMode === 'plan' && <color attach="background" args={['#aca497']} />}
        <SkyAndSun sky={viewMode !== 'plan'} />
        {wantsBackdrop && <OutdoorBackdrop />}
        <ApartmentShell />

        {/* Every mode, not just the overlay ones: standing in the room is exactly when you want to
            know how wide the wall in front of you is. The lines ignore depth, so they read as an
            x-ray of the plan from inside — and the figures carry a behind-the-camera guard, which
            only the immersive modes need. */}
        {showDimensions && <DimensionLayer />}
        {showWallDims && <WallDimensionLayer />}
        {showAreas && <RoomAreaLayer />}

        {gridSnap && !showDimensions && (viewMode === 'orbit' || viewMode === 'plan') && (
          <Grid
            position={[WIDTH / 2, 0.006, DEPTH / 2]}
            args={[WIDTH, DEPTH]}
            cellSize={0.1}
            cellThickness={0.4}
            cellColor="#8a8577"
            sectionSize={1}
            sectionThickness={1}
            sectionColor="#d68a4c"
            fadeDistance={20}
            fadeStrength={1}
            infiniteGrid={false}
          />
        )}

        {/* far=0.35 keeps this to near-floor furniture height — at far=3 it was also capturing
            the 2.6m walls and baking their footprint into a big diagonal smudge on the floor. */}
        {viewMode === 'orbit' && (
          <ContactShadows position={[WIDTH / 2, 0.005, DEPTH / 2]} opacity={0.35} scale={12} blur={2} far={0.35} />
        )}

        {items.map((item) => (
          <FurnitureItem key={item.id} item={item} />
        ))}

        {/* click empty space to deselect — but not when the click is the end of a pan */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[WIDTH / 2, -0.01, DEPTH / 2]}
          onClick={(e) => {
            if (wasDrag(e.nativeEvent)) return;
            // A cmd/ctrl-click that misses everything is an aimed-and-missed add, not "clear the
            // group" — dropping a six-piece selection because the modifier-click landed 3 px off a
            // rug edge is the one mistake that makes multi-select not worth using.
            if (e.nativeEvent.metaKey || e.nativeEvent.ctrlKey) return;
            select(null);
          }}
          visible={false}
        >
          <planeGeometry args={[200, 200]} />
        </mesh>
      </Suspense>
    </Canvas>
    {(showDimensions || showWallDims || showAreas) && (
      /* In Plan the plate goes wherever the fitted drawing left room — see lib/planFit.ts. The other
         views are 3D: nothing is fitted to the frame there, so the plate keeps its corner. */
      /* A phone has its own strip rules keyed off the window width, and they must not be overridden. */
      <div className={`dim-heights ${viewMode === 'plan' && !phone ? `plate-${planPlate}` : ''}`}>
        {(showDimensions || showWallDims) && (
          <>
            <span className="dim-heights-head">Heights</span>
            {HEIGHTS.map((h) => (
              <span key={h.label} className="dim-heights-row">
                <span>{h.label}</span>
                <b>{h.cm}</b>
              </span>
            ))}
            {/* Forty figures in five colours is unreadable without a key, and the colours are the
                only thing distinguishing a door's width from the wall beside it. */}
            <span className="dim-legend">
              <span className="dim-heights-head">Plan figures</span>
              {[...(showDimensions ? DIM_LEGEND : []), ...(showWallDims ? WALL_LEGEND : [])].map((l) => (
                <span key={l.kind} className="dim-legend-row">
                  <i style={{ background: DIM_COLOR[l.kind] }} />
                  {l.label}
                </span>
              ))}
            </span>
          </>
        )}
        {/* The areas earn this space more than the footnote that used to sit here: it repeated what
            the figures already say. Swatches double as the key for the Room areas wash, and go pale
            while that layer is off so the card never implies colour is on the plan when it isn't. */}
        <span className={`dim-areas ${showAreas ? 'on' : ''}`}>
          <span className="dim-heights-head">
            Floor area <em>m²</em>
          </span>
          {ROOM_AREAS.map((r) => (
            <span key={r.name} className="dim-areas-row">
              <i style={{ background: r.color }} />
              <span className="dim-areas-name">{r.name}</span>
              <span className="dim-areas-short">{r.short}</span>
              <b>{r.m2.toFixed(1)}</b>
            </span>
          ))}
          <span className="dim-areas-row dim-areas-total">
            <i />
            <span className="dim-areas-name">Total clear floor</span>
            <b>{TOTAL_AREA_M2.toFixed(1)}</b>
          </span>
        </span>
      </div>
    )}
    {contextLost && (
      <div className="gl-recover">
        <div className="gl-recover-card">
          <p>Recovering the 3D view…</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )}
    </>
  );
}
