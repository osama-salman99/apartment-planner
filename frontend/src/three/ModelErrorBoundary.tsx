import { Component, type ReactNode } from 'react';

// A per-item error boundary around a single GLB. <Suspense> only catches the model's
// *loading* promise; a load *failure* (404, corrupt/renamed GLB, or the DRACO decoder
// not loading) makes useGLTF re-throw on render, and that error sails past Suspense to
// the nearest boundary. Without this, that boundary is the app-wide CanvasErrorBoundary,
// so one missing model — e.g. after a CATALOG/PRESETS_VERSION bump or a pruned file —
// blanks the entire 3D view with "3D view unavailable" for every visitor. Catching it
// here degrades that one piece to its procedural silhouette instead.
//
// Error boundaries must be class components. Keyed by the model url at the call site, so
// swapping an item's model remounts this fresh and retries rather than staying failed.
export class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('furniture model failed to load — showing placeholder:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
