import { useEffect, useRef, useState } from 'react';
import { useLayoutStore } from '../state/layoutStore';

/**
 * Everything that changes what you *see* (and the one thing that changes how dragging behaves),
 * behind a single trigger in the top bar.
 *
 * It used to be seven native checkboxes strung across the bar. Three problems, all fixed here:
 * the browser's checkbox is the only control in the app that isn't drawn by us; the labels mixed
 * "show this" with "hide that" so a tick meant the opposite thing on different pills; and seven
 * pills ate ~700px, which squeezed the view switcher and the save readout into two lines. One
 * trigger costs ~90px and the rows can be as wordy as they need to be.
 *
 * Toggling stays one click because the panel does NOT close on select — flipping Room dimensions
 * and Wall thicknesses together is the common move, and that's now two clicks in the same spot
 * instead of two hunts across the bar.
 */
export function DisplayMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const viewMode = useLayoutStore((s) => s.viewMode);
  const showDimensions = useLayoutStore((s) => s.showDimensions);
  const setShowDimensions = useLayoutStore((s) => s.setShowDimensions);
  const showWallDims = useLayoutStore((s) => s.showWallDims);
  const setShowWallDims = useLayoutStore((s) => s.setShowWallDims);
  const showAreas = useLayoutStore((s) => s.showAreas);
  const setShowAreas = useLayoutStore((s) => s.setShowAreas);
  const showLabels = useLayoutStore((s) => s.showLabels);
  const setShowLabels = useLayoutStore((s) => s.setShowLabels);
  const showWallLabels = useLayoutStore((s) => s.showWallLabels);
  const setShowWallLabels = useLayoutStore((s) => s.setShowWallLabels);
  const hideWalls = useLayoutStore((s) => s.hideWalls);
  const setHideWalls = useLayoutStore((s) => s.setHideWalls);
  const showCeiling = useLayoutStore((s) => s.showCeiling);
  const setShowCeiling = useLayoutStore((s) => s.setShowCeiling);
  const gridSnap = useLayoutStore((s) => s.gridSnap);
  const setGridSnap = useLayoutStore((s) => s.setGridSnap);
  const showWalkPad = useLayoutStore((s) => s.showWalkPad);
  const setShowWalkPad = useLayoutStore((s) => s.setShowWalkPad);

  const walking = viewMode === 'walk' || viewMode === 'free';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Every row is phrased so that ON = "this is in the render", which is why Walls reads as Walls
  // and not "Hide walls" — the store keeps the inverted flag, the UI doesn't expose it.
  const overlays: Array<{ group: string; rows: Array<{ label: string; hint?: string; on: boolean; set: (v: boolean) => void }> }> = [
    {
      group: 'Measurements',
      rows: [
        { label: 'Room dimensions', hint: 'Clear widths and depths, plan view', on: showDimensions, set: setShowDimensions },
        { label: 'Wall thicknesses', hint: 'Which run is a 250 party wall', on: showWallDims, set: setShowWallDims },
        { label: 'Room areas', hint: 'Washes each floor in its colour on the card', on: showAreas, set: setShowAreas },
      ],
    },
    {
      group: 'Labels',
      rows: [
        { label: 'Room names', on: showLabels, set: setShowLabels },
        { label: 'Wall labels', hint: 'What each wall carries', on: showWallLabels, set: setShowWallLabels },
      ],
    },
    {
      group: 'Structure',
      rows: [
        { label: 'Walls', hint: 'Off to look straight down into the flat', on: !hideWalls, set: (v) => setHideWalls(!v) },
        { label: 'Ceiling', on: showCeiling, set: setShowCeiling },
      ],
    },
  ];

  const onCount = overlays.flatMap((g) => g.rows).filter((r) => r.on).length;

  return (
    <div className="display-menu" ref={wrapRef}>
      <button
        className={`display-trigger ${open ? 'open' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {onCount > 0 && <span className="display-count">{onCount}</span>}
        Display
        <svg className="display-chevron" width="8" height="5" viewBox="0 0 8 5" aria-hidden="true">
          <path d="M0.5 0.5 L4 4 L7.5 0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      {open && (
        <div className="display-panel" role="group" aria-label="Display options">
          {overlays.map((g) => (
            <div className="display-group" key={g.group}>
              <div className="display-group-title">{g.group}</div>
              {g.rows.map((r) => (
                <ToggleRow key={r.label} {...r} />
              ))}
            </div>
          ))}

          {/* Not a visibility toggle, so it sits below a rule rather than pretending to be one. */}
          <div className="display-group display-group-alt">
            <div className="display-group-title">Editing</div>
            {walking ? (
              <ToggleRow
                label="On-screen arrows"
                hint="Touch pad for walking without a keyboard"
                on={showWalkPad}
                set={setShowWalkPad}
              />
            ) : (
              <ToggleRow label="Snap to grid" hint="5 cm steps, 15° turns" on={gridSnap} set={setGridSnap} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, hint, on, set }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button className={`display-row ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => set(!on)}>
      <span className="display-tick" aria-hidden="true">
        <svg width="10" height="8" viewBox="0 0 10 8">
          <path d="M1 4 L3.6 6.6 L9 1.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="display-row-text">
        <span className="display-row-label">{label}</span>
        {hint && <span className="display-row-hint">{hint}</span>}
      </span>
    </button>
  );
}
