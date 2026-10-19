import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { useLayoutStore } from './state/layoutStore';
import { useDesignsStore } from './state/designsStore';
import './styles.css';

// Test hook: expose the stores on window when the URL carries ?test so the headless verification
// harness can drive the full matrix (archetypes, dims, colors, positions) and check what saving and
// design-switching actually did. No-op in normal use.
if (typeof window !== 'undefined' && window.location.search.includes('test')) {
  const w = window as unknown as {
    __store: typeof useLayoutStore;
    __designs: typeof useDesignsStore;
  };
  w.__store = useLayoutStore;
  w.__designs = useDesignsStore;
}

// iOS Safari only applies :active (the pressed look) once some touch listener exists.
document.addEventListener('touchstart', function () {}, { passive: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
