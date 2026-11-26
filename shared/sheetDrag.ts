// Swiping a bottom sheet down to close it, like an iPhone sheet. The sheets (Cooked inside To Do) follow the
// finger while it drags the handle or the title bar, and either fly away or spring back when it lets go.
// The decision lives here so it can be tested without a screen.

/** How far (px) a finger has to move before it counts as a drag and not a tap on a button in the title bar. */
export const DRAG_START = 6;
/** A slow drag closes the sheet once it has been pulled this far (px), or 40% of the sheet's height if that's less. */
export const DISMISS_DISTANCE = 120;
/** A quick flick closes it from a much shorter pull: this fast (px per millisecond) and at least FLICK_MIN px. */
export const DISMISS_SPEED = 0.5;
export const FLICK_MIN = 40;

/** How far down the sheet sits for a finger that has moved `dy` px: it follows the finger down, never up. */
export function dragOffset(dy: number): number {
  return Number.isFinite(dy) && dy > 0 ? dy : 0;
}

/** Whether letting go now closes the sheet. `ms` is how long the drag took; `height` is the sheet's height. */
export function shouldDismiss(dy: number, ms: number, height: number): boolean {
  if (!Number.isFinite(dy) || dy <= 0) return false;
  if (dy >= Math.min(DISMISS_DISTANCE, Math.max(FLICK_MIN, (Number.isFinite(height) ? height : 0) * 0.4))) return true;
  return dy >= FLICK_MIN && dy / Math.max(ms, 1) >= DISMISS_SPEED;
}
