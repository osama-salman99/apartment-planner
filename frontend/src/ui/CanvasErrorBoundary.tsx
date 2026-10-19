import { Component, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

// Isolates the 3D <Canvas> so a WebGL failure (context couldn't start, driver crash, a bad model)
// no longer blanks the entire app — the furniture library, shopping list and panels keep working.
// Error boundaries must be class components; this is the one class in the codebase for that reason.
export class CanvasErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D view failed:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="canvas-fallback">
          <div className="canvas-fallback-card">
            <h2>3D view unavailable</h2>
            <p>
              This device or browser couldn&apos;t start WebGL, so the room can&apos;t be shown. The furniture
              library and shopping list still work — try a different browser or a device with hardware
              graphics for the 3D view.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
