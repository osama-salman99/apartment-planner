import { create } from 'zustand';
import {
  EMPTY_ID,
  EMPTY_NAME,
  Unauthorised,
  createDesign,
  deleteDesign,
  fetchSession,
  fetchPlace,
  type Place,
  listDesigns,
  loadDesign,
  renameDesign,
  saveDesign,
  setDefaultDesign,
  type DesignMeta,
  type DesignPayload,
} from '../api/designsApi';
import { useLayoutStore } from './layoutStore';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'readonly';

/**
 * Which design is open, what else exists, and keeping the open one saved.
 *
 * Two rules shape the whole thing:
 *
 *  1. **Empty is not a row.** It is a fixed entry with a reserved id, so there is nothing on the
 *     server to rename, overwrite or delete, and a first-run (or wiped) database still opens on a
 *     bare apartment. Editing while Empty is open saves nothing anywhere and creates nothing: a new
 *     design only ever comes from the + or duplicate button. Duplicate copies what is on screen, so
 *     work started on Empty can still be kept — but only when the user says so.
 *  2. **Signed out is a supported state, not an error.** home.osmosis.work is public on purpose, and
 *     so is every saved design: without a session you can still list them, open them and walk around
 *     inside them. What a session buys is the right to *change* things — create, save, rename, delete,
 *     set the default. Signed out the planner opens on Empty and nothing you do is written down.
 */

const AUTOSAVE_MS = 600;

const EMPTY_META: DesignMeta = { id: EMPTY_ID, name: EMPTY_NAME };

interface DesignsState {
  ready: boolean;
  authenticated: boolean;
  /** The flat's address, or null when signed out: it says where someone lives. */
  place: Place | null;
  designs: DesignMeta[];
  defaultId: string;
  currentId: string;
  saveStatus: SaveStatus;
  /** Set when a write is rejected because the session expired mid-session. */
  lostSession: boolean;

  init: () => Promise<void>;
  open: (id: string) => Promise<void>;
  createNew: () => Promise<void>;
  duplicateCurrent: () => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  makeDefault: (id: string) => Promise<void>;
  onLayoutChanged: () => void;
}

/** The layout store's half of a design — the part that is actually the user's work. */
function payload(): DesignPayload {
  const s = useLayoutStore.getState();
  // Snap is deliberately NOT in here: it is a drafting aid belonging to the session, not to the
  // design (see DesignPayload.gridSnap).
  return { items: s.items, sun: s.sun };
}

function hydrate(data: DesignPayload | null) {
  useLayoutStore.getState().hydrate({
    items: data?.items ?? [],
    sun: data?.sun,
  });
}

function nextDesignName(existing: DesignMeta[]) {
  const taken = new Set(existing.map((d) => d.name));
  let n = 1;
  while (taken.has(`Design ${n}`)) n++;
  return `Design ${n}`;
}

/** Suppresses the autosave subscription while we are the ones writing into the layout store. */
let loading = false;
let timer: number | undefined;

export const useDesignsStore = create<DesignsState>((set, get) => ({
  ready: false,
  authenticated: false,
  place: null,
  designs: [EMPTY_META],
  defaultId: EMPTY_ID,
  currentId: EMPTY_ID,
  saveStatus: 'readonly',
  lostSession: false,

  init: async () => {
    const authenticated = await fetchSession();
    set({ authenticated });
    if (authenticated) void fetchPlace().then((place) => set({ place }));
    try {
      const { designs, defaultId } = await listDesigns();
      set({ designs: [EMPTY_META, ...designs], defaultId });
      // Signed out we always open Empty: nothing gets saved, so landing on someone's work-in-progress
      // and quietly editing it in the tab would be misleading. The list is right there to pick from.
      await get().open(authenticated ? defaultId : EMPTY_ID);
    } catch {
      // The list failed (server hiccup, or a wall we didn't expect) — open Empty rather than a blank
      // screen, and leave the list as just Empty.
      loading = true;
      hydrate(null);
      loading = false;
      set({ currentId: EMPTY_ID, saveStatus: 'readonly' });
    }
    set({ ready: true });
  },

  open: async (id) => {
    window.clearTimeout(timer);
    if (id === EMPTY_ID) {
      loading = true;
      hydrate(null);
      loading = false;
      set({ currentId: EMPTY_ID, saveStatus: 'readonly' });
      return;
    }
    try {
      const design = await loadDesign(id);
      loading = true;
      hydrate(design.data);
      loading = false;
      // Signed out the design is on screen but nothing goes back: 'readonly' is what the top bar and
      // the panel both key off to say so.
      set({ currentId: id, saveStatus: get().authenticated ? 'saved' : 'readonly' });
    } catch (e) {
      loading = false;
      if (e instanceof Unauthorised) set({ authenticated: false, lostSession: true });
      set({ saveStatus: 'error' });
    }
  },

  createNew: async () => {
    if (!get().authenticated) return;
    window.clearTimeout(timer);
    try {
      const meta = await createDesign(nextDesignName(get().designs), { items: [] });
      loading = true;
      hydrate(null);
      loading = false;
      set((s) => ({ designs: [...s.designs, meta], currentId: meta.id, saveStatus: 'saved' }));
    } catch (e) {
      if (e instanceof Unauthorised) set({ authenticated: false, lostSession: true });
      else set({ saveStatus: 'error' });
    }
  },

  duplicateCurrent: async () => {
    if (!get().authenticated) return;
    window.clearTimeout(timer);
    const from = get().designs.find((d) => d.id === get().currentId);
    const name = from && from.id !== EMPTY_ID ? `${from.name} copy` : nextDesignName(get().designs);
    try {
      // The copy is taken from what is on screen, so it includes edits the debounce hasn't flushed.
      const meta = await createDesign(name, payload());
      set((s) => ({ designs: [...s.designs, meta], currentId: meta.id, saveStatus: 'saved' }));
    } catch (e) {
      if (e instanceof Unauthorised) set({ authenticated: false, lostSession: true });
      else set({ saveStatus: 'error' });
    }
  },

  rename: async (id, name) => {
    if (id === EMPTY_ID || !get().authenticated) return;
    const clean = name.trim();
    if (!clean) return;
    // Optimistic: the row is already showing the typed name, and a failure re-lists on next load.
    set((s) => ({ designs: s.designs.map((d) => (d.id === id ? { ...d, name: clean } : d)) }));
    try {
      await renameDesign(id, clean);
    } catch (e) {
      if (e instanceof Unauthorised) set({ authenticated: false, lostSession: true });
    }
  },

  remove: async (id) => {
    if (id === EMPTY_ID || !get().authenticated) return;
    try {
      await deleteDesign(id);
    } catch (e) {
      if (e instanceof Unauthorised) {
        set({ authenticated: false, lostSession: true });
        return;
      }
    }
    const wasDefault = get().defaultId === id;
    set((s) => ({
      designs: s.designs.filter((d) => d.id !== id),
      defaultId: wasDefault ? EMPTY_ID : s.defaultId,
    }));
    if (get().currentId === id) await get().open(EMPTY_ID);
  },

  makeDefault: async (id) => {
    if (!get().authenticated) return;
    const previous = get().defaultId;
    set({ defaultId: id });
    try {
      await setDefaultDesign(id);
    } catch (e) {
      set({ defaultId: previous });
      if (e instanceof Unauthorised) set({ authenticated: false, lostSession: true });
    }
  },

  onLayoutChanged: () => {
    const { authenticated, currentId } = get();
    if (!authenticated) return; // signed out: the edit lives in the tab, which the panel says plainly
    // Empty is a scratch pad, not a design. Editing it deliberately creates nothing: a new design
    // comes from the + or duplicate button and nowhere else, so nothing appears in the list that the
    // user didn't ask for. Duplicate copies what is on screen, which is the way to keep this work.
    if (currentId === EMPTY_ID) return;

    set({ saveStatus: 'saving' });
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const id = get().currentId;
      if (id === EMPTY_ID) return;
      saveDesign(id, payload())
        .then((meta) => {
          set((s) => ({
            saveStatus: 'saved',
            designs: s.designs.map((d) => (d.id === meta.id ? { ...d, ...meta } : d)),
          }));
        })
        .catch((e) => {
          if (e instanceof Unauthorised) set({ authenticated: false, lostSession: true, saveStatus: 'readonly' });
          else set({ saveStatus: 'error' });
        });
    }, AUTOSAVE_MS);
  },
}));

/**
 * Autosave trigger. Watches the two slices of the layout store a design actually contains, so
 * camera moves, selections and display toggles don't write to the server. Snapshots are replaced
 * wholesale rather than mutated, so identity comparison is enough.
 */
useLayoutStore.subscribe((s, prev) => {
  if (loading) return;
  if (s.items === prev.items && s.sun === prev.sun) return;
  useDesignsStore.getState().onLayoutChanged();
});
