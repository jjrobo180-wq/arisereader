export const DEFAULT_EYE_GAZE_BACKGROUND = '#e6f4ee';
export function normalizeEyeGazeBackground(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_EYE_GAZE_BACKGROUND;
}
