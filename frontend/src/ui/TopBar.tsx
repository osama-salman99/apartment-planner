import { useMemo } from 'react';
import { useLayoutStore } from '../state/layoutStore';
import { findConflicts } from '../lib/clearance';
import { DisplayMenu } from './DisplayMenu';
import { useDesignsStore } from '../state/designsStore';

export function TopBar() {
  const saveStatus = useDesignsStore((s) => s.saveStatus);
  const designName = useDesignsStore((s) => {
    const d = s.designs.find((x) => x.id === s.currentId);
    return d?.name ?? 'Empty';
  });
  const place = useDesignsStore((s) => s.place);
  const viewMode = useLayoutStore((s) => s.viewMode);
  const items = useLayoutStore((s) => s.items);
  const conflicts = useMemo(() => findConflicts(items), [items]);
  const setViewMode = useLayoutStore((s) => s.setViewMode);

  return (
    <div className="topbar">
      <div className="plaque">
        {/* The address only reaches a signed-in visitor; everyone else sees what the app is.
            Street name and postcode are separate so the bar shrinks the street first — the
            postcode is the part worth keeping on screen when the window gets narrow. */}
        <span className="unit">{place ? place.unit : 'Home'}</span>
        <span className="street">{place ? place.street : '3D apartment planner'}</span>
        {place && <span className="postcode">{`${place.postcode} ${place.city}`}</span>}
      </div>

      {items.length > 0 && (
        <div className={`clearance ${conflicts.length ? 'bad' : 'ok'}`}>
          <span className="clearance-dot" />
          <span className="clearance-label">
            {conflicts.length
              ? `${conflicts.length} clash${conflicts.length > 1 ? 'es' : ''}`
              : 'Spacing OK'}
          </span>
          {conflicts.length > 0 && (
            <div className="clearance-tip" role="tooltip">
              <div className="clearance-tip-head">Too close — need ≥ 0.5 cm apart</div>
              <ul>
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <span>
                      {c.a} <em>↔</em> {c.b}
                    </span>
                    <span className="clearance-gap">{c.gapCm <= 0 ? 'overlapping' : `${c.gapCm.toFixed(1)} cm`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="topbar-spacer" />

      <DisplayMenu />

      <div className="viewmode-toggle">
        <button className={viewMode === 'orbit' ? 'active' : ''} onClick={() => setViewMode('orbit')}>
          3D
        </button>
        <button className={viewMode === 'plan' ? 'active' : ''} onClick={() => setViewMode('plan')}>
          Plan
        </button>
        <button className={viewMode === 'window' ? 'active' : ''} onClick={() => setViewMode('window')}>
          Window
        </button>
        <button className={viewMode === 'walk' ? 'active' : ''} onClick={() => setViewMode('walk')}>
          Walk
        </button>
        <button className={viewMode === 'free' ? 'active' : ''} onClick={() => setViewMode('free')}>
          Free
        </button>
      </div>

      {/* Which design is open, and whether it is safely on the server. 'readonly' — Empty, or
          signed out — says nothing here; the Designs panel is where that is explained. */}
      <div className="autosave">
        <span className={`autosave-dot ${saveStatus}`} />
        <span className="autosave-name">{designName}</span>
        {saveStatus === 'saving' && <em>Saving…</em>}
        {saveStatus === 'saved' && <em>Saved</em>}
        {saveStatus === 'error' && <em className="bad">Save failed</em>}
      </div>
    </div>
  );
}
