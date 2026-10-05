// Lets any page tell the notification bell to check again right away, for example after
// approving a teacher, so the item disappears without waiting for the next check.
const REFRESH_EVENT = "arise:notifications-refresh";

export function refreshNotifications() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function onNotificationsRefresh(listener: () => void): () => void {
  window.addEventListener(REFRESH_EVENT, listener);
  return () => window.removeEventListener(REFRESH_EVENT, listener);
}

const SESSION_COOKIE = "arise_session";

/** The signed-in session token, read from the session cookie. */
export function sessionToken(): string | null {
  try {
    for (const rawCookie of document.cookie.split(";")) {
      const cookie = rawCookie.trim();
      if (!cookie.startsWith(`${SESSION_COOKIE}=`)) continue;
      const data = JSON.parse(atob(cookie.substring(SESSION_COOKIE.length + 1)));
      return data.token || null;
    }
  } catch {}
  return null;
}

/** "now", "5m", "3h", "2d" or a date. */
export function relativeTime(value: string): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
