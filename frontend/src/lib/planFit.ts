import { DEPTH, WIDTH } from './dimensions';

/**
 * How Plan view frames the drawing in a given canvas — one pure function, because two things have to
 * agree on it: the orthographic camera, and the heights/legend plate that must not cover the drawing.
 *
 * The rule that matters: **the drawing is fitted to the canvas and never shrunk to make room for the
 * plate.** Reserving a fixed 250 px gutter for the card was fine in a 1060 px desktop viewport and
 * catastrophic anywhere narrower — on a tablet in portrait the viewport column is about 300 px, so the
 * reservation left ~50 px for a 5.95 m flat and the plan came out at 14 % of the width it should be,
 * with the pan clamp then pinning it there because a drawing that small has nothing to scroll to.
 *
 * So the gutter is taken out of *spare* pixels only. Whichever axis the fit binds on, the plate goes
 * wherever the slack actually is:
 *   - `side`  — spare width ≥ the card: it stays in the top corner and the drawing shifts clear.
 *   - `strip` — no spare width but spare height: the card collapses into a strip along the bottom,
 *               in the slack under the drawing, and the drawing lifts clear of it.
 *   - `over`  — no slack either way: the card overlaps a corner. A big plan under a small card beats
 *               a legible card over a useless plan.
 */
export type PlatePlacement = 'side' | 'strip' | 'over';

/** The plate's own width plus its margin — keep in step with `.dim-heights` in styles.css. */
export const PLATE_PX = 250;
/** Width of the compact card used when there is no slack to put it in — `.dim-heights.plate-over`. */
export const PLATE_COMPACT_PX = 206;
/** Height of the collapsed bottom strip, ditto `.dim-heights.plate-strip` — two wrapped rows' worth. */
export const PLATE_STRIP_PX = 84;
/**
 * What the phone's strip really costs: it sits 66 px up (clear of the Plan/3D switch) and wraps to
 * about 66 px of its own when the heights and the area chips are both on. The phone used to reserve
 * nothing at all, on the grounds that the strip lives "in the slack below the drawing" — but the
 * drawing is centred in that slack, so half of it went behind the strip and the south wall's figures
 * were unreadable. This is the height that has to be cleared, not the desktop strip's.
 */
export const PLATE_STRIP_PHONE_PX = 140;
/**
 * The phone's floating bottom bar (lock, Plan/3D, layout picker) and the safe area under it. With no
 * strip to clear, a centred drawing still put its south wall behind that bar while leaving an empty
 * band above the north wall — so the drawing lifts by this much (or by all the spare height, if less).
 */
export const PLAN_BAR_PHONE_PX = 110;

export interface PlanFrame {
  /** Pixels per metre — the orthographic camera's zoom. */
  zoom: number;
  /** Room-space point the view centres on. */
  focus: [number, number, number];
  /** Padded extent of the drawing, in room space, that the view may roam over. */
  bounds: { xLo: number; xHi: number; zLo: number; zHi: number };
  plate: PlatePlacement;
}

/**
 * Padding is per-edge, not a uniform border: with the dimension layer on, the overall and façade
 * chains hang off the north and west sides and the three gallery-door figures read just outside the
 * south wall, while the east side needs nothing. Centring one margin on all four edges wasted a third
 * of a phone screen. These are world-space, so they are unaffected by the view's 180° orientation.
 */
function pads(dims: boolean) {
  return {
    n: dims ? 1.0 : 0.22,
    w: dims ? 0.95 : 0.22,
    s: dims ? 0.45 : 0.22,
    e: 0.22,
  };
}

export function planFrame(
  canvasW: number,
  canvasH: number,
  opts: { dims: boolean; plate: boolean; stripPx?: number; barPx?: number },
): PlanFrame {
  const p = pads(opts.dims);
  const spanX = WIDTH + p.w + p.e;
  const spanZ = DEPTH + p.n + p.s;
  // The fit itself: the whole padded drawing, as large as the canvas allows. Nothing below may
  // reduce it.
  const zoom = Math.max(1, Math.min(canvasW / spanX, canvasH / spanZ));
  const spareW = canvasW - spanX * zoom;
  const spareH = canvasH - spanZ * zoom;

  const stripPx = opts.stripPx ?? PLATE_STRIP_PX;
  let plate: PlatePlacement = 'over';
  if (opts.plate) {
    if (spareW >= PLATE_PX) plate = 'side';
    // A strip is worth taking even when the slack is short of it: clearing 100 of the 140 px the
    // phone's strip wants still lifts most of the south wall's figures out from under it.
    else if (spareH >= Math.min(stripPx, PLATE_STRIP_PX)) plate = 'strip';
  }

  // Screen right is −x and screen up is +z (see PLAN_UP in Scene.tsx), so clearing a card on the
  // right means moving the focus down-x, and clearing a strip along the bottom means moving it
  // down-z. Both shifts are half the cleared pixels, converted to metres at this zoom.
  //
  // `over` shifts too, by whatever spare width there is: the card cannot be fully cleared, but pushing
  // the drawing to the far side turns most of a 200 px overlap into none of it.
  const clearedX =
    plate === 'side' ? PLATE_PX : plate === 'over' && opts.plate ? Math.min(PLATE_COMPACT_PX, spareW) : 0;
  const shiftX = clearedX / 2 / zoom;
  const bottomPx = plate === 'strip' ? stripPx : (opts.barPx ?? 0);
  const shiftZ = Math.min(bottomPx, spareH) / 2 / zoom;

  return {
    zoom,
    focus: [
      WIDTH / 2 + (p.e - p.w) / 2 - shiftX,
      0,
      DEPTH / 2 + (p.s - p.n) / 2 - shiftZ,
    ],
    bounds: { xLo: -p.w, xHi: WIDTH + p.e, zLo: -p.n, zHi: DEPTH + p.s },
    plate,
  };
}
