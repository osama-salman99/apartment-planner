import { Suspense, useRef, useState, useCallback, memo } from 'react';
import { TransformControls, Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlacedItem } from '../lib/types';
import { cmToM, mToCm } from '../lib/units';
import { useLayoutStore } from '../state/layoutStore';
import { FurnitureMesh } from './FurnitureMeshes';
import { GltfModel } from './GltfModel';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { Lamp, LampLight } from './Lamp';
import { isPhoneViewport } from '../lib/device';
import { IN_X0, IN_X1, IN_Z0, IN_Z1 } from '../lib/dimensions';
import { wasDrag } from './pointerGesture';

// Snap step while dragging the body (cm) — matches the gizmo's 5 cm translation snap.
const SNAP_CM = 5;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const IS_PHONE = isPhoneViewport();

/**
 * Is this click meant to extend the selection? ⌘ on a Mac, Ctrl elsewhere — the platform's own
 * "add to selection" chord, the same one Finder and Explorer use.
 *
 * Desktop only, and not because a phone couldn't hold a modifier: there is nothing on a phone to
 * hold. The phone build is a viewer with one tap-to-select, so a group there would have no way in
 * and no way out of it.
 */
function isAdditive(e: { metaKey?: boolean; ctrlKey?: boolean }): boolean {
  return !IS_PHONE && !!(e.metaKey || e.ctrlKey);
}

// The real GLB models are the memory hog that used to crash a phone tab while flipping through
// designs, so phones drew the procedural archetype and nothing else. That also meant a piece placed
// from the catalog looked nothing like the product on the very device the flat gets planned on — a
// SKÅLSTA table came out as a generic slab-and-legs.
//
// So the block is a budget rather than a ban: a phone loads the real models while the design is
// small enough for it to be safe, and falls back to the archetype above that. The presets that
// crashed were 20-40 items; a hand-built layout is a dozen. Desktops and tablets are unrestricted.
const PHONE_MODEL_BUDGET = 18;

// On top of that, on every platform: a piece only gets its real model once it is actually IN the
// flat. Something parked out on the gallery or off past the façade — staged there while you decide,
// or shoved aside to try a layout without it — is not part of the plan you are looking at, so it
// stays a coloured box and costs nothing to draw. Bringing it inside loads the model.
//
// The test is the item's origin (the centre of its footprint) against the interior faces, so a piece
// pushed hard against a wall, or deliberately half through one, still counts as in.
function insideFlat(x: number, z: number): boolean {
  const xm = cmToM(x);
  const zm = cmToM(z);
  return xm >= IN_X0 && xm <= IN_X1 && zm >= IN_Z0 && zm <= IN_Z1;
}

// memo: a body/gizmo drag calls updateItem ~60x/s → Scene re-renders and re-runs items.map;
// without memo every FurnitureItem re-runs each frame (jank on the phone with a 20-40 item
// preset). The store preserves referential identity for unchanged items, so memo lets all but
// the dragged one bail out. With the derived `selected` subscription below, a drag re-renders
// one item/frame and a selection change re-renders only the two affected items.
export const FurnitureItem = memo(function FurnitureItem({ item }: { item: PlacedItem }) {
  const groupRef = useRef<THREE.Group | null>(null);
  const [target, setTarget] = useState<THREE.Group | null>(null);
  const setRef = useCallback((node: THREE.Group | null) => {
    groupRef.current = node;
    setTarget(node);
  }, []);
  // The anchor of the selection — the one piece that gets the gizmo and the inspector.
  const selected = useLayoutStore((s) => s.selectedId === item.id);
  // In the selection at all: the anchor, or one of the others cmd-clicked in beside it. Drawn the
  // same, draggable the same; the group moves as one.
  const inSelection = useLayoutStore((s) => s.selectedId === item.id || s.alsoSelectedIds.includes(item.id));
  const multi = useLayoutStore((s) => s.alsoSelectedIds.length > 0);
  const select = useLayoutStore((s) => s.select);
  const toggleInSelection = useLayoutStore((s) => s.toggleInSelection);
  const moveSelection = useLayoutStore((s) => s.moveSelection);
  const updateItem = useLayoutStore((s) => s.updateItem);
  const setIsTransforming = useLayoutStore((s) => s.setIsTransforming);
  const pushHistory = useLayoutStore((s) => s.pushHistory);
  const gizmoMode = useLayoutStore((s) => s.gizmoMode);
  const gridSnap = useLayoutStore((s) => s.gridSnap);
  // Only changes when a piece is added or deleted, so this costs nothing during a drag.
  const overPhoneBudget = useLayoutStore((s) => IS_PHONE && s.items.length > PHONE_MODEL_BUDGET);
  const showModel = !overPhoneBudget && insideFlat(item.x, item.z);
  const viewMode = useLayoutStore((s) => s.viewMode);

  // Direct-drag is only for the editing views; in walk/free the same click means "look/move".
  // On a phone in 3D it is also off: there one finger has to mean "orbit the camera", and a drag
  // that started on a sofa would otherwise shove the sofa instead of turning the room. The phone's
  // Plan view keeps dragging, since nothing competes for a one-finger drag there (rotation is off).
  const draggable = viewMode === 'plan' || (viewMode === 'orbit' && !IS_PHONE);

  // Offset (in metres) between the object origin and where the pointer grabbed the floor, so the
  // piece doesn't jump to the cursor on grab.
  const dragOffset = useRef<THREE.Vector3 | null>(null);
  // Whether the current gesture has actually moved the piece — history is checkpointed on the
  // first real move, so a plain select-click leaves undo/redo untouched.
  const dragMoved = useRef(false);

  const handleObjectChange = () => {
    const obj = groupRef.current;
    if (!obj) return;
    updateItem(item.id, {
      x: mToCm(obj.position.x),
      z: mToCm(obj.position.z),
      rotationDeg: THREE.MathUtils.radToDeg(obj.rotation.y),
    });
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!draggable) return;
    // A cmd/ctrl-click is a selection gesture, never a drag — let it through to onClick.
    if (isAdditive(e.nativeEvent)) return;
    // Only move the piece if it is ALREADY selected. On an unselected piece don't hijack the
    // gesture: let the drag fall through to OrbitControls (so the camera orbits, even with
    // furniture under the cursor) and let the click — a pointerup without a drag — select it.
    // So the piece only moves on a second gesture, once it's the selected item.
    if (!inSelection) return;
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (e.ray.intersectPlane(GROUND, hit)) {
      dragOffset.current = new THREE.Vector3(cmToM(item.x), 0, cmToM(item.z)).sub(hit);
    } else {
      dragOffset.current = new THREE.Vector3();
    }
    dragMoved.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    document.body.style.cursor = 'grabbing';
    setIsTransforming(true); // frees OrbitControls so the drag doesn't also orbit the camera
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current) return;
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND, hit)) return;
    hit.add(dragOffset.current);
    let xCm = mToCm(hit.x);
    let zCm = mToCm(hit.z);
    if (gridSnap) {
      xCm = Math.round(xCm / SNAP_CM) * SNAP_CM;
      zCm = Math.round(zCm / SNAP_CM) * SNAP_CM;
    }
    if (xCm === item.x && zCm === item.z) return; // no-op (snap kept it in place)
    if (!dragMoved.current) {
      dragMoved.current = true;
      pushHistory(); // one undo step for the whole drag, taken on the first real move
    }
    // A group moves by the delta this piece just travelled, so the pieces keep their arrangement
    // exactly — including whatever fractional offsets they had, which absolute snapping would eat.
    if (multi) moveSelection(xCm - item.x, zCm - item.z);
    else updateItem(item.id, { x: xCm, z: zCm });
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current) return;
    e.stopPropagation();
    dragOffset.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    document.body.style.cursor = '';
    setIsTransforming(false);
  };

  // What gets drawn when the real IKEA model isn't there (not loaded yet, failed, off-budget on a
  // phone, or the product simply has no GLB). A lamp's stand-in is the procedural glowing lamp;
  // everything else falls back to its archetype silhouette.
  const isLamp = item.shape === 'lamp';
  const stand = isLamp ? (
    <Lamp item={item} />
  ) : (
    <FurnitureMesh shape={item.shape} w={item.w} d={item.d} h={item.h} color={item.colorHex} name={item.name} mirrored={item.mirrored} />
  );

  return (
    <>
      <group
        ref={setRef}
        position={[cmToM(item.x), cmToM(item.y ?? 0), cmToM(item.z)]}
        rotation={[0, THREE.MathUtils.degToRad(item.rotationDeg), 0]}
        onClick={(e) => {
          e.stopPropagation();
          // A pan that happened to start on this piece must not select it: in Plan a left drag is
          // the camera's, and r3f still raises `click` on pointerup over whatever is under the ray.
          if (wasDrag(e.nativeEvent)) return;
          if (isAdditive(e.nativeEvent)) toggleInSelection(item.id);
          else select(item.id);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={() => {
          if (draggable && inSelection && !dragOffset.current) document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          if (!dragOffset.current) document.body.style.cursor = '';
        }}
      >
        {item.modelUrl && showModel ? (
          // Suspense covers loading; ModelErrorBoundary covers a load *failure* (a missing/
          // corrupt GLB or the DRACO decoder failing) — both fall back to the procedural box,
          // so one bad model degrades to a placeholder instead of blanking the whole 3D view.
          <ModelErrorBoundary key={item.modelUrl} fallback={stand}>
            <Suspense fallback={stand}>
              <GltfModel url={item.modelUrl} />
            </Suspense>
          </ModelErrorBoundary>
        ) : (
          stand
        )}
        {/* A real lamp model is inert geometry, so the light it throws is added separately. The
            procedural stand-in carries its own light, hence only when the model is what's drawn. */}
        {isLamp && item.modelUrl && showModel && <LampLight item={item} />}
        {inSelection && (
          <mesh position={[0, cmToM(item.h) / 2, 0]}>
            <boxGeometry args={[cmToM(item.w) * 1.03, cmToM(item.h) * 1.03, cmToM(item.d) * 1.03]} />
            <meshBasicMaterial color="#d68a4c" wireframe transparent opacity={0.5} />
            <Edges color="#d68a4c" />
          </mesh>
        )}
      </group>
      {/* One piece only. A translate gizmo would move the anchor out of its group, and a rotate
          gizmo would spin one piece inside an arrangement the group exists to preserve — so a
          multi-selection is moved by dragging any of its members instead. */}
      {selected && !multi && target && (
        <TransformControls
          object={target}
          mode={gizmoMode}
          showX={gizmoMode === 'translate'}
          showZ={gizmoMode === 'translate'}
          showY={gizmoMode === 'rotate'}
          translationSnap={gridSnap ? 0.05 : undefined}
          rotationSnap={gridSnap ? THREE.MathUtils.degToRad(15) : undefined}
          onObjectChange={handleObjectChange}
          onMouseDown={() => {
            pushHistory(); // gizmo grab starts one undo step
            setIsTransforming(true);
          }}
          onMouseUp={() => setIsTransforming(false)}
        />
      )}
    </>
  );
});
