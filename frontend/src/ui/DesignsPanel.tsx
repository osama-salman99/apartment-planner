import { useEffect, useRef, useState } from 'react';
import { EMPTY_ID, signInUrl } from '../api/designsApi';
import { useDesignsStore } from '../state/designsStore';

/**
 * Drawn rather than typed. The obvious characters for these three (⧉ ✎ ✕) are not all in the UI
 * font stack, and a missing glyph renders as a tofu box — which is exactly what the duplicate
 * button did. ★/☆ for the default marker do resolve, so those stay as text.
 */
const Icon = {
  duplicate: (
    <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1.2" y="1.2" width="8" height="8" rx="1.4" />
      <path d="M4.8 12.8h6a2 2 0 0 0 2-2v-6" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 2.2v9.6M2.2 7h9.6" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M9.4 1.8l2.8 2.8-7 7H2.4V9.4z" />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3.2 3.2l7.6 7.6M10.8 3.2l-7.6 7.6" />
    </svg>
  ),
};

/**
 * The designs list, pinned to the bottom of the right column under the inspector.
 *
 * Empty always heads the list and is deliberately inert — no rename, no delete, no autosave into it.
 * It can still be made the default, which is the one thing it is for: opening on a bare apartment.
 *
 * Signed out the whole list is still here and every design still opens; what disappears is every
 * control that would change something, because only reading is public.
 */
export function DesignsPanel() {
  const designs = useDesignsStore((s) => s.designs);
  const currentId = useDesignsStore((s) => s.currentId);
  const defaultId = useDesignsStore((s) => s.defaultId);
  const authenticated = useDesignsStore((s) => s.authenticated);
  const lostSession = useDesignsStore((s) => s.lostSession);
  const ready = useDesignsStore((s) => s.ready);

  const open = useDesignsStore((s) => s.open);
  const createNew = useDesignsStore((s) => s.createNew);
  const duplicateCurrent = useDesignsStore((s) => s.duplicateCurrent);
  const rename = useDesignsStore((s) => s.rename);
  const remove = useDesignsStore((s) => s.remove);
  const makeDefault = useDesignsStore((s) => s.makeDefault);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const commit = () => {
    if (editingId) rename(editingId, draft);
    setEditingId(null);
  };

  return (
    <section className="designs">
      <header className="designs-head">
        <span className="designs-title">Designs</span>
        {authenticated && (
          <div className="designs-head-actions">
            <button onClick={duplicateCurrent} title="Duplicate the open design" aria-label="Duplicate design">
              {Icon.duplicate}
            </button>
            <button onClick={createNew} title="New design" aria-label="New design">
              {Icon.plus}
            </button>
          </div>
        )}
      </header>

      <ul className="designs-list">
        {designs.map((d) => {
          const isEmpty = d.id === EMPTY_ID;
          const isCurrent = d.id === currentId;
          const isDefault = d.id === defaultId;
          return (
            <li key={d.id} className={`designs-row ${isCurrent ? 'current' : ''}`}>
              <button
                className={`designs-star ${isDefault ? 'on' : ''}`}
                title={isDefault ? 'Opens by default' : 'Make this the default design'}
                aria-label={isDefault ? 'Default design' : 'Make default'}
                aria-pressed={isDefault}
                disabled={!authenticated}
                onClick={() => makeDefault(d.id)}
              >
                {isDefault ? '★' : '☆'}
              </button>

              {editingId === d.id ? (
                <input
                  ref={inputRef}
                  className="designs-rename"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button
                  className="designs-name"
                  onClick={() => open(d.id)}
                  onDoubleClick={() => {
                    if (isEmpty || !authenticated) return;
                    setDraft(d.name);
                    setEditingId(d.id);
                  }}
                  title={isEmpty ? 'The apartment with no furniture — cannot be edited' : d.name}
                >
                  {d.name}
                  {isEmpty && <em className="designs-lock" aria-hidden> · fixed</em>}
                </button>
              )}

              {authenticated && !isEmpty && editingId !== d.id && (
                <span className="designs-row-actions">
                  <button
                    title="Rename"
                    aria-label={`Rename ${d.name}`}
                    onClick={() => {
                      setDraft(d.name);
                      setEditingId(d.id);
                    }}
                  >
                    {Icon.pencil}
                  </button>
                  <button
                    title="Delete"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete “${d.name}”? This cannot be undone.`)) remove(d.id);
                    }}
                  >
                    {Icon.cross}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {ready && !authenticated && (
        <p className="designs-signedout">
          {lostSession ? 'Session expired — ' : 'Read-only — '}
          open any design to look around; anything you change stays in this tab.{' '}
          <a href={signInUrl()}>Sign in</a> to edit and save.
        </p>
      )}
      {authenticated && currentId === EMPTY_ID && (
        <p className="designs-note">Nothing here is saved — use + or duplicate to start a design.</p>
      )}
    </section>
  );
}
