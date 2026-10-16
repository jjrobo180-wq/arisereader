// A second copy of the sign-in, kept in the browser's storage as well as the cookie.
//
// The sign-in lives in a cookie (arise_session) that many parts of the app read. Phone browsers are quick to
// drop cookies: an app added to the Home Screen can lose them when it is force-closed, and Safari clears
// cookies written by a page after a few days. The page's own storage (localStorage) is kept much longer, so
// when the cookie is gone the app puts it back from here instead of asking the person to sign in again.
// Signing out clears both.
const KEY = "arise_session_backup";

export function saveSessionBackup(value: string): void {
  try { window.localStorage.setItem(KEY, value); } catch { /* storage is off: the cookie still works */ }
}

export function readSessionBackup(): string | null {
  try { return window.localStorage.getItem(KEY) || null; } catch { return null; }
}

export function clearSessionBackup(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/** Asks the browser not to clear this site's storage when space runs low (installed apps usually get yes). */
export function keepStorage(): void {
  try { void navigator.storage?.persist?.(); } catch { /* fine without it */ }
}
