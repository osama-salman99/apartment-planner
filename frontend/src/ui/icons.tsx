// Schematic top-down icons, deliberately drafting-plan style (thin strokes, no fill) rather
// than skeuomorphic furniture glyphs — matches the CAD-plan register of the rest of the UI.
import type { JSX } from 'react';
import { WOONSPOT_BEDS, type BedHead } from '../lib/woonspotBeds';
import { WOONSPOT_SOFAS, type SofaLayout } from '../lib/woonspotSofas';

const base = {
  viewBox: '0 0 32 32',
  fill: 'none',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const CategoryIcons: Record<string, () => JSX.Element> = {
  bed: () => (
    <svg {...base}>
      <rect x="4" y="6" width="24" height="20" rx="2" />
      <rect x="4" y="6" width="24" height="7" rx="2" />
      <line x1="4" y1="17" x2="28" y2="17" />
    </svg>
  ),
  // The bare mattress: just the slab, with the quilted seam that runs round its edge.
  bedding: () => (
    <svg {...base}>
      <rect x="5" y="4" width="22" height="24" rx="2" />
      <rect x="8" y="7" width="16" height="18" rx="1.5" strokeWidth="1" />
    </svg>
  ),
  // Made up: the mattress rectangle, two pillows along the head, and the duvet's turned-back cuff
  // banded across it.
  beddingMadeUp: () => (
    <svg {...base}>
      <rect x="5" y="4" width="22" height="24" rx="2" />
      <rect x="7" y="6" width="8" height="5" rx="1" strokeWidth="1" />
      <rect x="17" y="6" width="8" height="5" rx="1" strokeWidth="1" />
      <path d="M5 14h22" strokeWidth="1" />
      <path d="M5 17h22" strokeWidth="1" />
    </svg>
  ),
  nightstand: () => (
    <svg {...base}>
      <rect x="8" y="8" width="16" height="16" rx="1.5" />
      <line x1="8" y1="16" x2="24" y2="16" />
    </svg>
  ),
  wardrobe: () => (
    <svg {...base}>
      <rect x="6" y="4" width="20" height="24" rx="1" />
      <line x1="16" y1="4" x2="16" y2="28" />
      <circle cx="14" cy="16" r="0.8" fill="currentColor" />
      <circle cx="18" cy="16" r="0.8" fill="currentColor" />
    </svg>
  ),
  // On plan a corner wardrobe is an L: two runs against the walls, doors drawn as the inner face.
  paxCorner: () => (
    <svg {...base}>
      <path d="M5 5h22v9h-13v13H5z" />
      <path d="M14 14 27 14" strokeWidth="1" />
      <path d="M14 14 14 27" strokeWidth="1" />
    </svg>
  ),
  desk: () => (
    <svg {...base}>
      <rect x="4" y="10" width="24" height="12" rx="1" />
      <rect x="20" y="12" width="6" height="8" />
    </svg>
  ),
  chair: () => (
    <svg {...base}>
      <rect x="9" y="12" width="14" height="14" rx="1.5" />
      <path d="M9 12 a7 7 0 0 1 14 0" />
    </svg>
  ),
  sofa: () => (
    <svg {...base}>
      <rect x="4" y="12" width="24" height="12" rx="2" />
      <rect x="4" y="8" width="5" height="16" rx="1.5" />
      <rect x="23" y="8" width="5" height="16" rx="1.5" />
      <line x1="9" y1="12" x2="23" y2="12" />
    </svg>
  ),
  // A U on plan: back run along the top, unequal wings coming down off both ends.
  trentinoU: () => (
    <svg {...base}>
      <path d="M4 5h24v22h-7V15H11v8H4z" />
      <path d="M11 15 21 15" strokeWidth="1" />
    </svg>
  ),
  // The ordered Solida on plan: back across the top and turning the corner down the right, the
  // narrow arm at the left end, the lounge ending in its half-round tip.
  solidaOrdered: () => (
    <svg {...base}>
      <path d="M3 6h26v10.3a4.93 4.93 0 0 1-9.9 0V15H3z" />
      <path d="M3 8.2H29" strokeWidth="1" />
      <path d="M4.8 8.2V15" strokeWidth="1" />
      <path d="M12 8.2V15" strokeWidth="1" />
      <path d="M19.1 8.2v8.1" strokeWidth="1" />
      <path d="M26.9 8.2v8.1" strokeWidth="1" />
    </svg>
  ),
  armchair: () => (
    <svg {...base}>
      <rect x="6" y="10" width="20" height="16" rx="2" />
      <rect x="6" y="8" width="4" height="18" rx="1.5" />
      <rect x="22" y="8" width="4" height="18" rx="1.5" />
    </svg>
  ),
  coffeeTable: () => (
    <svg {...base}>
      <rect x="6" y="10" width="20" height="12" rx="4" />
    </svg>
  ),
  diningTable: () => (
    <svg {...base}>
      <ellipse cx="16" cy="16" rx="12" ry="9" />
    </svg>
  ),
  diningChair: () => (
    <svg {...base}>
      <rect x="10" y="13" width="12" height="12" rx="1" />
      <line x1="10" y1="10" x2="22" y2="10" />
    </svg>
  ),
  tvConsole: () => (
    <svg {...base}>
      <rect x="3" y="13" width="26" height="8" rx="1.5" />
      <circle cx="8" cy="17" r="1" fill="currentColor" />
      <circle cx="24" cy="17" r="1" fill="currentColor" />
    </svg>
  ),
  bookshelf: () => (
    <svg {...base}>
      <rect x="6" y="4" width="20" height="24" rx="1" />
      <line x1="6" y1="12" x2="26" y2="12" />
      <line x1="6" y1="20" x2="26" y2="20" />
    </svg>
  ),
  rug: () => (
    <svg {...base}>
      <rect x="4" y="8" width="24" height="16" rx="2" strokeDasharray="3 2.5" />
    </svg>
  ),
  // The ONSEVIG on plan: a round rug, so a dashed circle, with its medallion drawn in the middle —
  // that centred medallion is what tells this rug apart from any other round one.
  onsevigRug: () => (
    <svg {...base}>
      <circle cx="16" cy="16" r="12" strokeDasharray="3 2.5" />
      <circle cx="16" cy="16" r="8.5" strokeWidth="0.9" />
      <path d="M16 10.5 20 16 16 21.5 12 16z" strokeWidth="0.9" />
    </svg>
  ),
  // On plan a lamp is its shade circle over its base; a plant is its pot ring under a leaf cluster.
  lamp: () => (
    <svg {...base}>
      <circle cx="16" cy="16" r="9" />
      <circle cx="16" cy="16" r="2.5" />
    </svg>
  ),
  plant: () => (
    <svg {...base}>
      <circle cx="16" cy="16" r="4" />
      <path d="M16 12c0-4 3-6 6-6M16 12c0-4-3-6-6-6M16 12c2-3 5-3.5 7-2.5M16 12c-2-3-5-3.5-7-2.5" />
    </svg>
  ),
  // The console standing on its foot: the two covers' silhouette, the dark waist between them and
  // the light line on the front edge.
  ps5: () => (
    <svg {...base}>
      <path d="M11 6h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
      <path d="M16 6v20" />
      <path d="M13 28h6" />
    </svg>
  ),
  // The same console on its side: long axis across, the waist line along it, pads underneath.
  // A panel on two splayed feet.
  tclTv43: () => (
    <svg {...base}>
      <rect x="4" y="7" width="24" height="14" rx="1.5" />
      <path d="M11 21l-2 4M21 21l2 4M7 25h4M21 25h4" />
    </svg>
  ),
  ps5Flat: () => (
    <svg {...base}>
      <path d="M6 11h20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" />
      <path d="M6 16h20" />
      <path d="M9 23v2M23 23v2" />
    </svg>
  ),
  box: () => (
    <svg {...base}>
      <rect x="7" y="7" width="18" height="18" rx="1.5" />
    </svg>
  ),
  cylinder: () => (
    <svg {...base}>
      <circle cx="16" cy="16" r="10" />
    </svg>
  ),
};

/**
 * The WoonSpot XXL range on plan: the back run along the top, with the deep wing coming down off
 * one end. Three silhouettes — an open chaise (its outline breaks where there is no back or arm),
 * a hoekbank whose back turns the corner, and a U with a wing off both ends. `deepSide: 'left'`
 * mirrors the glyph, so the icon shows which way round the sofa actually sits.
 */
const SOFA_GLYPHS: Record<SofaLayout, JSX.Element> = {
  // Open platform: drawn as the run's solid outline plus the chaise as a lighter open rectangle.
  chaise: (
    <>
      <path d="M4 5h24v10H16" />
      <path d="M4 5v10h12" />
      <path d="M16 15h12v12H16z" strokeWidth="1" />
    </>
  ),
  corner: (
    <>
      <path d="M4 5h24v22h-9V15H4z" />
      <path d="M19 15 19 27" strokeWidth="1" />
    </>
  ),
  u: (
    <>
      <path d="M4 5h24v22h-7V15H11v8H4z" />
      <path d="M11 15 21 15" strokeWidth="1" />
    </>
  ),
};

for (const s of WOONSPOT_SOFAS) {
  const glyph = SOFA_GLYPHS[s.layout];
  const mirrored = s.deepSide === 'left';
  CategoryIcons[s.id] = () => (
    <svg {...base}>
      <g transform={mirrored ? 'translate(32,0) scale(-1,1)' : undefined}>{glyph}</g>
    </svg>
  );
}

/**
 * The boxspring range on plan: the mattress is the same rectangle on every model, so the icon is
 * really the headboard — drawn along the top edge in the style that distinguishes that model.
 */
const BED_HEAD_GLYPHS: Record<BedHead, JSX.Element> = {
  flat: <path d="M5 4h22v4H5z" />,
  arched: <path d="M5 8a11 5 0 0 1 22 0z" />,
  vChannel: (
    <>
      <path d="M5 4h22v4H5z" />
      <path d="M10 4v4M16 4v4M22 4v4" strokeWidth="0.9" />
    </>
  ),
  hPanel: (
    <>
      <path d="M5 4h22v4H5z" />
      <path d="M5 6 27 6" strokeWidth="0.9" />
    </>
  ),
  panelGrid: (
    <>
      <path d="M5 4h22v4H5z" />
      <path d="M12.3 4v4M19.6 4v4M5 6 27 6" strokeWidth="0.9" />
    </>
  ),
  buttoned: (
    <>
      <path d="M5 4h22v4H5z" />
      <path d="M9 4 12 8M15 4 18 8M21 4 24 8M12 4 9 8M18 4 15 8M24 4 21 8" strokeWidth="0.7" />
    </>
  ),
  bubble: (
    <>
      <path d="M5 4h22v5H5z" />
      <path d="M8.7 9a3.7 2.5 0 0 0 0-5M16 9a3.7 2.5 0 0 0 0-5M23.3 9a3.7 2.5 0 0 0 0-5" strokeWidth="0.8" />
    </>
  ),
};

for (const b of WOONSPOT_BEDS) {
  const head = BED_HEAD_GLYPHS[b.head];
  // Wide headboards and bedside wings are what you actually see on plan, so they are drawn too.
  const wings = b.wings === 'shelf';
  CategoryIcons[b.id] = () => (
    <svg {...base}>
      {head}
      <rect x="8" y="10" width="16" height="18" rx="1.5" />
      <line x1="8" y1="16" x2="24" y2="16" strokeWidth="0.9" />
      {wings && (
        <>
          <rect x="3" y="10" width="4" height="5" strokeWidth="0.9" />
          <rect x="25" y="10" width="4" height="5" strokeWidth="0.9" />
        </>
      )}
    </svg>
  );
}
