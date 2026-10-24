// Should look-to-press (dwell) and look-to-steer start on?
//
// Eye Gazer's games used to switch them off on any touch-screen device. But eye-gaze learners very
// often use a tablet — with an eye tracker, or the tablet's own eye tracking — so on a tablet the
// games ignored their eyes and seemed broken, while the same games worked on a computer. Taps keep
// working with look-to-press on (it never reacts to a finger), so nothing is lost by leaving it on.
//
// So: an eye-gaze account gets look-to-press on every device. Anyone else on a touch-only screen
// still starts on tap-only, as before. And a tablet that saved "tap only" only because that was the
// old default is put back once per game (the person can still switch it off in the game's settings).

let eyeGazeUser = false;

/** Set by AuthContext as the signed-in person changes. */
export function setEyeGazeUser(on: boolean): void {
  eyeGazeUser = on;
}

/** A screen you can only touch (a tablet or phone with no mouse or trackpad). */
export function touchOnly(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;
}

/** The starting choice for look-to-press / look-to-steer on this device. */
export function lookByDefault(): boolean {
  return eyeGazeUser || !touchOnly();
}

/**
 * Settings loaded from storage: for an eye-gaze account on a touch screen, the first time this
 * runs for a game, the look options go back to on (`look` holds what "on" means for this game).
 */
export function restoreLook<T extends object>(game: string, uid: unknown, settings: T, look: Partial<T>): T {
  if (!eyeGazeUser || !touchOnly()) return settings;
  const key = `arise-gaze-defaults-v2:${game}:${uid ?? "guest"}`;
  try {
    if (localStorage.getItem(key)) return settings;
    localStorage.setItem(key, "1");
  } catch { return settings; }
  return { ...settings, ...look };
}
