/**
 * Tells a click apart from a drag, so selection follows a tap and never a pan.
 *
 * Plan view pans on a LEFT drag, and r3f raises `click` on pointerup over whatever the ray hits no
 * matter how far the pointer travelled in between. Without this guard every pan would also register
 * as a click: a pan begun on empty floor would clear the selection, and one begun on a piece of
 * furniture would select it. The overlay views never showed this because nothing used a left drag.
 *
 * The position is recorded from a capture-phase listener on window, so it is set before any r3f
 * handler runs — including for objects whose own pointerdown handler bails out early (an unselected
 * piece deliberately lets the gesture fall through to the camera).
 */
const DRAG_SLOP_PX = 6;

let downX = 0;
let downY = 0;

export function notePointerDown(e: PointerEvent): void {
  downX = e.clientX;
  downY = e.clientY;
}

/** True if the pointer travelled far enough since pressing that this was a drag, not a click. */
export function wasDrag(e: { clientX: number; clientY: number }): boolean {
  return Math.hypot(e.clientX - downX, e.clientY - downY) > DRAG_SLOP_PX;
}
