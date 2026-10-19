import { create } from 'zustand';
import type { PlacedItem, Product, ProductVariant, SunSettings, ViewMode, FurnitureShape } from '../lib/types';
import { catalogEntry, DEFAULT_ROOM_BY_SHAPE } from './furnitureCatalog';
import { ROOM_BOUNDS, WIDTH, DEPTH } from '../lib/dimensions';
import { placeWithClearance } from '../lib/clearance';
import { isPhoneViewport } from '../lib/device';
import type { PlatePlacement } from '../lib/planFit';

let idCounter = 0;
const nextId = () => `item-${Date.now()}-${idCounter++}`;

// Phones default to the top-down Plan view (the orbit/3D controls are awkward on a small touch
// screen). Tablets and desktop open in 3D. Same viewport-only test as the layout switch.
const DEFAULT_VIEW: ViewMode = isPhoneViewport() ? 'plan' : 'orbit';

// Per-room spawn counter (not persisted — purely so items you add in the same session land in a
// loose grid instead of exactly on top of each other; irrelevant once saved/reloaded).
const spawnCounts: Partial<Record<keyof typeof ROOM_BOUNDS, number>> = {};

function nextSpawnPoint(room: keyof typeof ROOM_BOUNDS) {
  const b = ROOM_BOUNDS[room];
  const count = spawnCounts[room] ?? 0;
  spawnCounts[room] = count + 1;
  const col = count % 3;
  const row = Math.floor(count / 3);
  return {
    x: ((b.x1 + b.x2) / 2) * 100 + (col - 1) * 55,
    z: ((b.z1 + b.z2) / 2) * 100 + row * 55,
  };
}

interface LayoutState {
  items: PlacedItem[];
  selectedId: string | null;
  /**
   * When on, nothing in the room can be picked up. The default, and deliberately so: most visits
   * are to look at the flat, and a stray click on a wardrobe used to select it — one drag away from
   * moving furniture you only wanted to look at. Session state, never saved with a design.
   */
  selectionLocked: boolean;
  /**
   * The rest of a multi-selection: everything selected alongside `selectedId`, which stays the
   * anchor the inspector reads. Empty for an ordinary single selection, and only ever filled by
   * cmd/ctrl-clicking on the desktop.
   *
   * A group can be moved and nothing else. Sizes stay per-piece deliberately: "make these three
   * 10 cm deeper" is never what you mean — the group exists so a sofa, its rug and its lamp keep
   * their arrangement while you try the arrangement somewhere else.
   */
  alsoSelectedIds: string[];
  viewMode: ViewMode;
  gridSnap: boolean;
  showLabels: boolean;
  sun: SunSettings;
  hydrated: boolean;
  isTransforming: boolean;
  gizmoMode: 'translate' | 'rotate';
  showWalkPad: boolean;
  hideWalls: boolean;
  showWallLabels: boolean;
  showCeiling: boolean;
  showDimensions: boolean;
  showWallDims: boolean;
  showAreas: boolean;
  // Where Plan view's heights/legend plate can sit without covering the drawing. Computed by the
  // plan camera rig (it is the only thing that knows the live canvas and the fitted zoom) and read
  // by the plate itself. Transient view state, never part of a saved design.
  planPlate: PlatePlacement;
  // Undo/redo history of the items array (snapshots; item objects are never mutated in place).
  past: PlacedItem[][];
  future: PlacedItem[][];

  addFromCatalog: (shapeId: FurnitureShape, room?: keyof typeof ROOM_BOUNDS) => void;
  addProduct: (product: Product, room?: keyof typeof ROOM_BOUNDS) => void;
  addCustom: (name: string, shape: 'box' | 'cylinder', w: number, d: number, h: number) => void;
  updateItem: (id: string, patch: Partial<PlacedItem>) => void;
  /**
   * Swap a placed piece to another size/finish of the same product. One action rather than four
   * updateItem calls, because it is one decision ("make it the 180 in black") and has to land as a
   * single undo step — and because clearing the 3D model when the new size has none is easy to
   * forget and shows up as a bed rendered at the wrong size.
   */
  applyVariant: (id: string, variant: ProductVariant) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  select: (id: string | null) => void;
  /** cmd/ctrl-click: add a piece to the selection, or take it back out. */
  toggleInSelection: (id: string) => void;
  /** Shift every selected piece by the same delta, in cm. One `set`, so a drag stays smooth. */
  moveSelection: (dxCm: number, dzCm: number) => void;
  setSelectionLocked: (v: boolean) => void;
  setViewMode: (m: ViewMode) => void;
  setGridSnap: (v: boolean) => void;
  setShowLabels: (v: boolean) => void;
  setSun: (patch: Partial<SunSettings>) => void;
  hydrate: (data: { items: PlacedItem[]; sun?: SunSettings }) => void;
  setIsTransforming: (v: boolean) => void;
  setGizmoMode: (m: 'translate' | 'rotate') => void;
  setShowWalkPad: (v: boolean) => void;
  setHideWalls: (v: boolean) => void;
  setShowWallLabels: (v: boolean) => void;
  setShowCeiling: (v: boolean) => void;
  setShowDimensions: (v: boolean) => void;
  setShowWallDims: (v: boolean) => void;
  setShowAreas: (v: boolean) => void;
  setPlanPlate: (p: PlatePlacement) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

// 100 undo steps within the open design. Switching design resets it (see hydrate) — the history is
// of your edits to this layout, so carrying it across would let ⌘Z pull one design's furniture into
// another. A snapshot is an array of small plain objects, so 100 of them is a few hundred KB at most.
const HISTORY_LIMIT = 100;

export const useLayoutStore = create<LayoutState>((set, get) => {
  // One history entry per discrete edit. A drag emits many updateItem calls but is coalesced into
  // the single snapshot taken when the drag starts (see setIsTransforming). Panel edits to the
  // same field within 600ms also coalesce so typing a value isn't 5 undo steps.
  const snapshot = () =>
    set((s) => ({ past: [...s.past, s.items].slice(-HISTORY_LIMIT), future: [] }));
  let lastEditSig = '';
  let lastEditAt = 0;

  return {
  items: [],
  selectedId: null,
  selectionLocked: true,
  alsoSelectedIds: [],
  viewMode: DEFAULT_VIEW,
  // Off by default on every platform, every design, every load: the 5 cm step fights placing a
  // piece hard against a wall, which is the measurement that actually matters here — and on a
  // phone, where a drag is already coarse, it fights the drag itself. It is a session toggle and
  // is never restored from a saved design.
  gridSnap: false,
  // Room names: off by default, same reasoning as gridSnap — the default view should be the flat,
  // not the annotation.
  showLabels: false,
  showWalkPad: true,
  hideWalls: false,
  showWallLabels: false,
  // On by default. It costs the overhead views nothing — the ceiling plane's single face points
  // down into the room, so a camera above it is looking at a culled backface and sees straight
  // through — while walk-through and interior shots get a real room instead of open sky overhead.
  showCeiling: true,
  showDimensions: false,
  showWallDims: false,
  // Off by default: a colour wash over every floor is a reading aid, not the way the flat looks.
  showAreas: false,
  planPlate: 'side',
  // Windows face EAST (ENE ~75°) — determined from OSM: the blocks visible out the window across
  // the parking lot are the apartment buildings to the east; the west side is the complex's own
  // courtyard. So at 18:00 in July the sun is in the WNW (~285°), BEHIND the building: the room
  // sits in soft evening light and the blocks across the courtyard catch the low sun. azimuth 327
  // is that WNW sun in scene coordinates (scene −Z = the ENE window wall). Morning is when direct
  // sun streams in; slide the time back to see it.
  sun: { azimuthDeg: 327, hourOfDay: 18, cloudiness: 0.1 },
  hydrated: false,
  isTransforming: false,
  gizmoMode: 'translate',
  past: [],
  future: [],

  addFromCatalog: (shapeId, room) => {
    snapshot();
    const entry = catalogEntry(shapeId);
    const roomKey = room ?? DEFAULT_ROOM_BY_SHAPE[shapeId] ?? 'lounge';
    const spawn = nextSpawnPoint(roomKey);
    // Land clear of existing pieces and walls (≥ 0.5 cm) instead of stacking on top of them.
    const pos = placeWithClearance(entry.defaultDims, 0, ROOM_BOUNDS[roomKey], get().items, spawn);
    const item: PlacedItem = {
      id: nextId(),
      shape: entry.id,
      name: entry.label,
      w: entry.defaultDims.w,
      d: entry.defaultDims.d,
      h: entry.defaultDims.h,
      x: pos.x,
      z: pos.z,
      rotationDeg: 0,
      colorHex: entry.defaultColorHex,
    };
    set((s) => ({ items: [...s.items, item], selectedId: item.id, alsoSelectedIds: [] }));
  },

  addProduct: (product, room) => {
    snapshot();
    const spawn = nextSpawnPoint(room ?? DEFAULT_ROOM_BY_SHAPE[product.archetype] ?? 'lounge');
    const item: PlacedItem = {
      id: nextId(),
      productId: product.articleNo,
      // The card's own article is one of the family's variants, so record it as the one in the room
      // — otherwise the inspector cannot tell which swatch is currently selected.
      variantArticle: product.variants?.length ? product.articleNo : undefined,
      modelUrl: product.modelUrl,
      shape: product.archetype,
      name: product.typeName ? `${product.name} ${product.typeName}` : product.name,
      w: product.dims.w,
      d: product.dims.d,
      h: product.dims.h,
      x: spawn.x,
      z: spawn.z,
      y: product.defaultY,
      // A product with a hanging height is only placeable BY its height, so it arrives with the
      // field already open rather than making the user find the lock first.
      yUnlocked: product.defaultY !== undefined,
      rotationDeg: 0,
      colorHex: product.colorHex,
    };
    set((s) => ({ items: [...s.items, item], selectedId: item.id, alsoSelectedIds: [] }));
  },

  addCustom: (name, shape, w, d, h) => {
    snapshot();
    const spawn = nextSpawnPoint('lounge');
    const pos = placeWithClearance({ w, d }, 0, ROOM_BOUNDS.lounge, get().items, spawn);
    const item: PlacedItem = {
      id: nextId(),
      shape,
      name: name || 'Custom item',
      w,
      d,
      h,
      x: pos.x,
      z: pos.z,
      rotationDeg: 0,
      colorHex: '#7a7166',
    };
    set((s) => ({ items: [...s.items, item], selectedId: item.id, alsoSelectedIds: [] }));
  },

  updateItem: (id, patch) => {
    // During a gizmo drag the whole gesture is one undo step (snapshotted at drag start), so skip
    // here. Panel edits coalesce per item+field within a short window.
    if (!get().isTransforming) {
      const sig = id + '|' + Object.keys(patch).sort().join(',');
      const now = Date.now();
      if (sig !== lastEditSig || now - lastEditAt > 600) snapshot();
      lastEditSig = sig;
      lastEditAt = now;
    }
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  },

  applyVariant: (id, variant) => {
    snapshot();
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id
          ? {
              ...it,
              variantArticle: variant.articleNo,
              w: variant.dims.w,
              d: variant.dims.d,
              h: variant.dims.h,
              colorHex: variant.colorHex,
              // Deliberately assigned even when undefined: a glTF is scaled to its own article's
              // real size, so keeping the 90x200 model on a 180x200 frame would draw a bed 90 cm
              // wide inside a 195 cm footprint. Without a model the piece falls back to the
              // procedural silhouette, which is built from these dimensions and so is correct.
              modelUrl: variant.modelUrl,
            }
          : it,
      ),
    }));
  },

  removeItem: (id) => {
    snapshot();
    set((s) => ({
      items: s.items.filter((it) => it.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      alsoSelectedIds: s.alsoSelectedIds.filter((x) => x !== id),
    }));
  },

  duplicateItem: (id) => {
    const item = get().items.find((it) => it.id === id);
    if (!item) return;
    snapshot();
    // Offset the copy, then nudge it to a clear spot anywhere in the apartment.
    const pos = placeWithClearance(
      { w: item.w, d: item.d },
      item.rotationDeg,
      { x1: 0, z1: 0, x2: WIDTH, z2: DEPTH },
      get().items,
      { x: item.x + 20, z: item.z + 20 },
    );
    const copy: PlacedItem = { ...item, id: nextId(), x: pos.x, z: pos.z };
    set((s) => ({ items: [...s.items, copy], selectedId: copy.id, alsoSelectedIds: [] }));
  },

  // Blocked while the view is locked, so the guard sits in one place and covers every caller —
  // a click on a piece in 3D, a tap in Plan on the phone, the Escape/deselect paths.
  select: (id) =>
    set((s) => (s.selectionLocked && id !== null ? {} : { selectedId: id, alsoSelectedIds: [] })),

  toggleInSelection: (id) =>
    set((s) => {
      if (s.selectionLocked) return {};
      if (s.selectedId === null) return { selectedId: id, alsoSelectedIds: [] };
      // Taking the anchor back out promotes one of the others, so a group never loses its anchor
      // while it still has members — the inspector reads the anchor.
      if (s.selectedId === id) {
        const [next, ...rest] = s.alsoSelectedIds;
        return { selectedId: next ?? null, alsoSelectedIds: next ? rest : [] };
      }
      if (s.alsoSelectedIds.includes(id)) {
        return { alsoSelectedIds: s.alsoSelectedIds.filter((x) => x !== id) };
      }
      return { alsoSelectedIds: [...s.alsoSelectedIds, id] };
    }),

  moveSelection: (dxCm, dzCm) =>
    set((s) => {
      const ids = new Set([s.selectedId, ...s.alsoSelectedIds].filter(Boolean) as string[]);
      if (!ids.size) return {};
      return {
        items: s.items.map((it) => (ids.has(it.id) ? { ...it, x: it.x + dxCm, z: it.z + dzCm } : it)),
      };
    }),
  // Locking clears whatever was selected — the point of the lock is that nothing in the room can
  // be nudged, and a still-selected piece is still draggable. Adding a piece from the library is a
  // deliberate act and keeps selecting it (see addFromCatalog/addProduct) so it can be placed.
  setSelectionLocked: (v) =>
    set(v ? { selectionLocked: true, selectedId: null, alsoSelectedIds: [] } : { selectionLocked: false }),
  // Deselect on camera-mode switch: TransformControls stays attached to the outgoing camera
  // for one frame during the perspective/orthographic swap and crashes the renderer otherwise.
  setViewMode: (m) => set({ viewMode: m, selectedId: null, alsoSelectedIds: [] }),
  setGridSnap: (v) => set({ gridSnap: v }),
  setShowLabels: (v) => set({ showLabels: v }),
  setSun: (patch) => set((s) => ({ sun: { ...s.sun, ...patch } })),

  hydrate: (data) =>
    set({
      items: data.items ?? [],
      selectedId: null,
      alsoSelectedIds: [],
      sun: data.sun ?? get().sun,
      hydrated: true,
      // Loading the saved layout is the baseline, not an undoable action.
      past: [],
      future: [],
    }),


  setIsTransforming: (v) => set({ isTransforming: v }),

  // Explicit history checkpoint — callers take it at the start of a drag gesture (body drag's
  // first move, or a gizmo grab) so the whole gesture collapses to one undo step. Not taken on a
  // plain select-click, which would otherwise wipe the redo stack on every click.
  pushHistory: () => snapshot(),
  setGizmoMode: (m) => set({ gizmoMode: m }),
  setShowWalkPad: (v) => set({ showWalkPad: v }),
  setHideWalls: (v) => set({ hideWalls: v }),
  setShowWallLabels: (v) => set({ showWallLabels: v }),
  setShowCeiling: (v) => set({ showCeiling: v }),
  setShowDimensions: (v) => set({ showDimensions: v }),
  setShowWallDims: (v) => set({ showWallDims: v }),
  setShowAreas: (v) => set({ showAreas: v }),
  setPlanPlate: (p) => set((s) => (s.planPlate === p ? s : { planPlate: p })),

  undo: () => {
    const { past, items, selectedId } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const keepSel = !!selectedId && prev.some((it) => it.id === selectedId);
    set((s) => ({
      items: prev,
      past: s.past.slice(0, -1),
      future: [...s.future, items].slice(-HISTORY_LIMIT),
      selectedId: keepSel ? selectedId : null,
      alsoSelectedIds: s.alsoSelectedIds.filter((x) => prev.some((it) => it.id === x)),
      isTransforming: false,
    }));
  },

  redo: () => {
    const { future, items, selectedId } = get();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const keepSel = !!selectedId && next.some((it) => it.id === selectedId);
    set((s) => ({
      items: next,
      future: s.future.slice(0, -1),
      past: [...s.past, items].slice(-HISTORY_LIMIT),
      selectedId: keepSel ? selectedId : null,
      alsoSelectedIds: s.alsoSelectedIds.filter((x) => next.some((it) => it.id === x)),
      isTransforming: false,
    }));
  },
  };
});
