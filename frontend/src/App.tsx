import { useEffect, useState } from 'react';
import { Scene } from './three/Scene';
import { TopBar } from './ui/TopBar';
import { LibraryPanel } from './ui/LibraryPanel';
import { RightPanel } from './ui/RightPanel';
import { WalkPad } from './ui/WalkPad';
import { SelectionLock } from './ui/SelectionLock';
import { CanvasErrorBoundary } from './ui/CanvasErrorBoundary';
import { MobileApp } from './ui/MobileApp';
import { DesignsPanel } from './ui/DesignsPanel';
import { useIsPhone } from './ui/useIsPhone';
import { useDesignsStore } from './state/designsStore';
import { useLayoutStore } from './state/layoutStore';

// The catalog panel starts collapsed: the room is what you came to look at, and the library is only
// needed while adding pieces. The choice is remembered so it doesn't have to be re-made every visit,
// but a first visit always opens with the widest possible viewport.
const LIBRARY_KEY = 'home-app.library-open';

function readLibraryOpen(): boolean {
  try {
    return window.localStorage.getItem(LIBRARY_KEY) === '1';
  } catch {
    return false; // private mode / blocked storage — collapsed is still the right default
  }
}

export function App() {
  const isPhone = useIsPhone();
  const [libraryOpen, setLibraryOpen] = useState(readLibraryOpen);

  useEffect(() => {
    try {
      window.localStorage.setItem(LIBRARY_KEY, libraryOpen ? '1' : '0');
    } catch {
      /* not worth surfacing — the panel still works, it just won't be remembered */
    }
  }, [libraryOpen]);

  // Work out whether we're signed in, then open the default design (Empty when we aren't).
  useEffect(() => {
    useDesignsStore.getState().init();
  }, []);

  // Global shortcuts: ⌘Z / Ctrl+Z to undo (redo with ⇧ or Ctrl+Y), Backspace or Delete to remove the
  // selected piece. All ignored while typing in a field, so Backspace still deletes characters in the
  // numeric dimension inputs and the browser's own text-undo keeps working there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const { selectedId, removeItem } = useLayoutStore.getState();
        if (!selectedId) return;
        // Backspace is still "go back" in some browsers, and the piece is already gone by then.
        e.preventDefault();
        removeItem(selectedId); // takes its own undo snapshot, so ⌘Z brings the piece back
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) useLayoutStore.getState().redo();
        else useLayoutStore.getState().undo();
      } else if (k === 'y') {
        e.preventDefault();
        useLayoutStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Phone: a stripped-down Plan-only viewer. Desktop is unchanged.
  if (isPhone) return <MobileApp />;

  return (
    <div className={`app ${libraryOpen ? '' : 'library-collapsed'}`}>
      <TopBar />
      <LibraryPanel />
      {/* The handle sits on the seam between panel and viewport, so it reads as the panel's edge
          whichever side it's on, and stays in the same place when the panel slides away. */}
      <button
        className="library-handle"
        onClick={() => setLibraryOpen((v) => !v)}
        title={libraryOpen ? 'Hide the catalog' : 'Show the catalog'}
        aria-label={libraryOpen ? 'Hide the catalog' : 'Show the catalog'}
        aria-expanded={libraryOpen}
      >
        <svg viewBox="0 0 12 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={libraryOpen ? 'M8 8 4 12l4 4' : 'M4 8l4 4-4 4'} />
        </svg>
      </button>
      <div className="viewport">
        <CanvasErrorBoundary>
          <Scene />
        </CanvasErrorBoundary>
        <WalkPad />
        <SelectionLock />
      </div>
      <div className="rightcol">
        <RightPanel />
        <DesignsPanel />
      </div>
    </div>
  );
}
