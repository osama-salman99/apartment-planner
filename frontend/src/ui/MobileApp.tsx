import { useEffect, useState } from 'react';
import { Scene } from '../three/Scene';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { useLayoutStore } from '../state/layoutStore';
import { useDesignsStore } from '../state/designsStore';
import { SelectionLock } from './SelectionLock';
import { DisplayMenu } from './DisplayMenu';

// Phone experience: full-bleed viewer with two cameras — the top-down Plan (the measuring tool) and
// a 3D orbit of the flat. Still deliberately stripped of the desktop editing chrome (library,
// inspector, walk/free modes): on a phone this is something you look at, not something you build in.
export function MobileApp() {
  const viewMode = useLayoutStore((s) => s.viewMode);
  const setViewMode = useLayoutStore((s) => s.setViewMode);
  const items = useLayoutStore((s) => s.items);
  const selectedId = useLayoutStore((s) => s.selectedId);
  const select = useLayoutStore((s) => s.select);
  const selected = items.find((it) => it.id === selectedId) ?? null;

  // Open on Plan, and pin anything that isn't one of the phone's two cameras back to it (a saved
  // layout can carry walk/free/window, none of which has touch controls).
  useEffect(() => {
    if (viewMode !== 'plan' && viewMode !== 'orbit') setViewMode('plan');
  }, [viewMode, setViewMode]);

  const is3D = viewMode === 'orbit';
  // Shown once per mount when 3D is first opened — the gesture set isn't guessable on a phone.
  const [hintSeen, setHintSeen] = useState(false);

  // Designs, read-only: you can switch which saved layout you're looking at, and nothing more —
  // creating and renaming belong on the desktop, where the editing lives. It shows as soon as the
  // list has loaded, signed in or not: reading designs is public, and a control that hides itself
  // until some condition is met is a control you can't find.
  const designs = useDesignsStore((s) => s.designs);
  const currentId = useDesignsStore((s) => s.currentId);
  const openDesign = useDesignsStore((s) => s.open);
  const canPickDesign = useDesignsStore((s) => s.ready);
  const [designSheet, setDesignSheet] = useState(false);
  const place = useDesignsStore((s) => s.place);
  const currentName = designs.find((d) => d.id === currentId)?.name ?? 'Empty';

  return (
    <div className="mobile-app">
      <header className="m-header">
        <span className="m-place">
          {/* The address only reaches a signed-in visitor. */}
          <span className="m-unit">{place ? place.unit : 'Home'}</span>
          <span className="m-street">{place ? place.street : '3D apartment planner'}</span>
          {place && <span className="m-postcode">{place.postcode}</span>}
        </span>
        {/* The same Display menu the desktop bar carries, in the slot the lone Dimensions toggle
            used to hold. Dimensions was the only overlay the phone could reach, which made every
            other one — wall thicknesses, room areas, labels, walls off to look down into the flat —
            desktop-only for no reason other than bar width. One trigger costs the same space. */}
        <DisplayMenu />
      </header>

      <div className="m-viewport">
        <CanvasErrorBoundary>
          <Scene />
        </CanvasErrorBoundary>

        {is3D && !hintSeen && (
          <div className="m-hint" role="status">Drag to turn · pinch to zoom · two fingers to pan</div>
        )}

        {selected && (
          <button className="m-selected" onClick={() => select(null)}>
            <span className="m-selected-name">{selected.name}</span>
            <span className="m-selected-x" aria-hidden>×</span>
          </button>
        )}

        {canPickDesign && (
          <div className="m-designs">
            {designSheet && (
              <ul className="m-designs-sheet">
                {designs.map((d) => (
                  <li key={d.id}>
                    <button
                      className={d.id === currentId ? 'on' : ''}
                      onClick={() => {
                        openDesign(d.id);
                        setDesignSheet(false);
                      }}
                    >
                      {d.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className={`m-designs-btn ${designSheet ? 'open' : ''}`}
              aria-expanded={designSheet}
              onClick={() => setDesignSheet((v) => !v)}
            >
              <span>{currentName}</span>
              {/* Points up: the list opens above the button. */}
              <em aria-hidden>▴</em>
            </button>
          </div>
        )}

        <SelectionLock />

        <div className="m-viewtoggle" role="group" aria-label="View">
          <button
            className={!is3D ? 'active' : ''}
            aria-pressed={!is3D}
            onClick={() => setViewMode('plan')}
          >
            Plan
          </button>
          <button
            className={is3D ? 'active' : ''}
            aria-pressed={is3D}
            onClick={() => {
              setViewMode('orbit');
              setHintSeen(false);
              window.setTimeout(() => setHintSeen(true), 3600);
            }}
          >
            3D
          </button>
        </div>
      </div>
    </div>
  );
}
