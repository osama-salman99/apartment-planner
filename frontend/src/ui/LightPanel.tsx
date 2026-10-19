import { useLayoutStore } from '../state/layoutStore';

function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatHour(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function LightPanel() {
  const sun = useLayoutStore((s) => s.sun);
  const setSun = useLayoutStore((s) => s.setSun);

  return (
    <div className="panel-section" style={{ borderBottom: 'none' }}>
      <p className="empty-state" style={{ padding: 0, marginTop: 0, marginBottom: 16 }}>
        The listing didn't specify which way the windows face — dial these in once you're
        standing in the room, or leave the default.
      </p>

      <div className="slider-row">
        <div className="slider-label">
          <span>Sun direction</span>
          <span>{compassLabel(sun.azimuthDeg)} · {Math.round(sun.azimuthDeg)}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={359}
          value={sun.azimuthDeg}
          onChange={(e) => setSun({ azimuthDeg: +e.target.value })}
        />
      </div>

      <div className="slider-row">
        <div className="slider-label">
          <span>Time of day</span>
          <span>{formatHour(sun.hourOfDay)}</span>
        </div>
        <input
          type="range"
          min={6}
          max={21}
          step={0.25}
          value={sun.hourOfDay}
          onChange={(e) => setSun({ hourOfDay: +e.target.value })}
        />
      </div>

      <div className="slider-row">
        <div className="slider-label">
          <span>Cloud cover</span>
          <span>{Math.round(sun.cloudiness * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={sun.cloudiness}
          onChange={(e) => setSun({ cloudiness: +e.target.value })}
        />
      </div>
    </div>
  );
}
