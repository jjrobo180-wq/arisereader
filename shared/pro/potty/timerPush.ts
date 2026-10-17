// Potty Training: the reminder timer as a phone notification. The page tells the server when a timer ends
// (only when the parent turned "Notify my phone" on); the server sends a push at that time even if the app is closed.
// The server keeps one entry per person: the newest timer replaces the old one, stopping it removes it.

export const TIMER_URL = "/#/pro?app=potty";
/** A timer that ended longer ago than this is not announced (the phone was off, the server restarted). */
export const STALE_MS = 30 * 60_000;
/** Longest timer accepted, and how long an entry is kept. */
export const MAX_AHEAD_MS = 6 * 3600_000;
export const KEEP_MS = 3 * 3600_000;
/** If the timer is not answered the phone is reminded again, this many times, this far apart. */
export const REPEAT_EVERY_MS = 10 * 60_000;
export const MAX_REPEATS = 2;

export type TimerEntry = { kid: string; kidName: string; endAt: number; minutes: number; updatedAt: number; sends?: number; lastSentAt?: number };
export type TimerMap = Record<string, TimerEntry>;
export type TimerSync = { clear: true } | { clear?: false; entry: Omit<TimerEntry, "updatedAt" | "sends" | "lastSentAt"> };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** What the page sent, made safe. null when it is not a timer. */
export function cleanTimerSync(body: any, now: number): TimerSync | null {
  if (body?.clear === true) return { clear: true };
  const endAt = Number(body?.endAt);
  if (!Number.isFinite(endAt) || endAt < now - STALE_MS || endAt > now + MAX_AHEAD_MS) return null;
  const minutes = Math.max(1, Math.min(240, Math.round(Number(body?.minutes) || 0) || 1));
  const kid = text(body?.kid, 60);
  if (!kid) return null;
  return { entry: { kid, kidName: text(body?.kidName, 40) || "your child", endAt: Math.round(endAt), minutes } };
}

/** The saved map made safe to use (it comes from a settings string). */
export function readTimers(raw: string | null | undefined): TimerMap {
  try {
    const parsed = JSON.parse(raw || "{}");
    const out: TimerMap = {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
    for (const [user, e] of Object.entries<any>(parsed)) {
      if (!/^\d{1,12}$/.test(user) || !e || typeof e !== "object" || !Number.isFinite(Number(e.endAt)) || !text(e.kid, 60)) continue;
      out[user] = { kid: text(e.kid, 60), kidName: text(e.kidName, 40) || "your child", endAt: Number(e.endAt), minutes: Number(e.minutes) || 1, updatedAt: Number(e.updatedAt) || 0,
        ...(Number(e.sends) > 0 ? { sends: Math.min(Number(e.sends), MAX_REPEATS + 1) } : {}), ...(Number(e.lastSentAt) > 0 ? { lastSentAt: Number(e.lastSentAt) } : {}) };
    }
    return out;
  } catch { return {}; }
}

/** Entries that are long over are dropped. */
export function pruneTimers(map: TimerMap, now: number): TimerMap {
  const out: TimerMap = {};
  for (const [user, e] of Object.entries(map)) if (now - e.endAt < KEEP_MS) out[user] = e;
  return out;
}

/** The people whose timer should be announced now: it has ended (not too long ago) and it is the first time, or a repeat is due. */
export function dueTimers(map: TimerMap, now: number): string[] {
  return Object.entries(map).filter(([, e]) => {
    if (e.endAt > now || now - e.endAt > STALE_MS) return false;
    if (!e.sends) return true;
    return e.sends <= MAX_REPEATS && now - (e.lastSentAt || e.endAt) >= REPEAT_EVERY_MS;
  }).map(([user]) => user);
}

/** What the phone shows. The tag makes a repeat replace the one before it, and the "closeTags" take away the running-timer notification. */
export function ringMessage(e: Pick<TimerEntry, "kidName" | "sends">): { title: string; body: string; url: string; tag: string; urgent: true; closeTags: string[] } {
  const again = (e.sends || 0) > 0;
  return {
    title: again ? "🚽 Potty time, still waiting" : "🚽 Potty time",
    body: again ? `${e.kidName} still needs a trip to the toilet. Open the app to log it or snooze.` : `Time to take ${e.kidName} to the toilet. Open the app to log it or snooze.`,
    url: TIMER_URL, tag: "potty-timer", urgent: true, closeTags: ["potty-live"],
  };
}
