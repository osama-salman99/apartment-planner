import { useLayoutStore } from '../state/layoutStore';

/**
 * The padlock in the bottom-left corner of the view: on, and nothing in the room can be picked up;
 * off, and clicking a piece selects it as before.
 *
 * It starts LOCKED. The flat is mostly something you look at and measure, and an unlocked view turns
 * every stray click into a selection — one drag away from moving furniture you never meant to touch.
 * Turning the lock on also drops the current selection, since a selected piece is a draggable piece.
 *
 * Same control, same corner, on the phone: a tap is even easier to make by accident than a click.
 */
export function SelectionLock() {
  const locked = useLayoutStore((s) => s.selectionLocked);
  const setLocked = useLayoutStore((s) => s.setSelectionLocked);

  return (
    <button
      className={`select-lock ${locked ? 'on' : ''}`}
      onClick={() => setLocked(!locked)}
      aria-pressed={locked}
      aria-label={locked ? 'Unlock the furniture' : 'Lock the furniture'}
      title={locked ? 'Furniture locked — click to allow selecting' : 'Furniture unlocked — click to lock'}
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {/* The body is the same either way; only the shackle moves, so the two states read as one
            object opening rather than as two different icons. */}
        <rect x="4.2" y="9" width="11.6" height="8.2" rx="1.7" stroke="currentColor" strokeWidth="1.5" />
        <path
          d={locked ? 'M7 9V6.6a3 3 0 0 1 6 0V9' : 'M7 9V6.6a3 3 0 0 1 5.9-.7'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="13.1" r="1.15" fill="currentColor" />
      </svg>
    </button>
  );
}
