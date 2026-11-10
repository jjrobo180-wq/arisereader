export const DEFAULT_EYE_GAZE_BACKGROUND = '#f7f8ff';
/** The first default (mint). Accounts that never picked a colour have it saved, so they move to the new default. */
const OLD_DEFAULT = '#e6f4ee';
export function normalizeEyeGazeBackground(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return DEFAULT_EYE_GAZE_BACKGROUND;
  const v = value.toLowerCase();
  return v === OLD_DEFAULT ? DEFAULT_EYE_GAZE_BACKGROUND : v;
}
