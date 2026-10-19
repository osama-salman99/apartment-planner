import { useLayoutStore } from '../state/layoutStore';
import { walkInput, type WalkDir } from '../three/walkInput';

function PadBtn({ dir, label }: { dir: WalkDir; label: string }) {
  const press = (v: boolean) => () => {
    walkInput[dir] = v;
  };
  return (
    <button
      className="walkpad-btn"
      aria-label={dir}
      onPointerDown={(e) => {
        e.preventDefault();
        walkInput[dir] = true;
      }}
      onPointerUp={press(false)}
      onPointerLeave={press(false)}
      onPointerCancel={press(false)}
    >
      {label}
    </button>
  );
}

/** On-screen movement arrows for the Walk / Free views (touch- and mouse-friendly). Toggled
 * from the top bar. */
export function WalkPad() {
  const viewMode = useLayoutStore((s) => s.viewMode);
  const show = useLayoutStore((s) => s.showWalkPad);
  if (!(viewMode === 'walk' || viewMode === 'free') || !show) return null;
  const free = viewMode === 'free';
  return (
    <div className="walkpad">
      <div className="walkpad-grid">
        <span />
        <PadBtn dir="fwd" label="↑" />
        <span />
        <PadBtn dir="left" label="←" />
        <PadBtn dir="back" label="↓" />
        <PadBtn dir="right" label="→" />
      </div>
      {free && (
        <div className="walkpad-vert">
          <PadBtn dir="up" label="⤒" />
          <PadBtn dir="down" label="⤓" />
        </div>
      )}
    </div>
  );
}
