// Potty Training: the reminder timer as a phone notification.
//
// The page (when "Notify my phone" is on) tells the server when its timer ends. At that moment the server sends a
// push to the parent's phones, even if the app is closed, and again a couple of times if nobody answers. The newest
// timer replaces the old one; stopping it, snoozing it or logging a trip sends the new end time (or a clear).
//
//   PUT  /api/pro/potty/timer            { kid, kidName, endAt, minutes }  or  { clear: true }
//   POST /api/pro/potty/push/subscribe   { subscription, timeZone }  turns this phone on for potty notifications
//   POST /api/pro/potty/push/test        sends a test notification to the parent's phones
//
// Timers are kept in memory and saved as one small setting, so a restart or deploy keeps them. The rules are in
// shared/pro/potty/timerPush.ts.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { MAX_REPEATS, REPEAT_EVERY_MS, cleanTimerSync, dueTimers, pruneTimers, readTimers, ringMessage, type TimerMap } from "../shared/pro/potty/timerPush";

export const POTTY_TIMERS_KEY = "potty_timers";
const TICK_MS = 30_000;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export type PottyMessage = { title: string; body: string; url?: string; tag?: string; urgent?: boolean; closeTags?: string[] };
export type PottyTimerDeps = {
  load: () => Promise<string | null>;
  save: (value: string) => Promise<void>;
  /** Sends to every phone the person turned notifications on for. Returns how many arrived. */
  notify: (userId: number, message: PottyMessage) => Promise<number>;
  /** Saves a phone for potty notifications. */
  registerDevice: (userId: number, body: unknown) => Promise<{ ok: true } | { ok: false; status: number; message: string }>;
  now?: () => number;
  /** For tests: how a wake-up is scheduled. */
  schedule?: (fn: () => void, ms: number) => { unref?: () => void } | any;
  unschedule?: (handle: any) => void;
};

export function createPottyTimers(deps: PottyTimerDeps) {
  const now = deps.now ?? Date.now;
  const schedule = deps.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const unschedule = deps.unschedule ?? ((h: any) => clearTimeout(h));
  let timers: TimerMap = {};
  let loaded: Promise<void> | null = null;
  let writing: Promise<void> = Promise.resolve();
  const wakeups = new Map<string, any>();

  const ensure = () => (loaded ??= deps.load().then((raw) => { timers = pruneTimers(readTimers(raw), now()); for (const user of Object.keys(timers)) wake(user); }).catch((e) => { loaded = null; throw e; }));
  const persist = () => { const snapshot = JSON.stringify(timers); writing = writing.then(() => deps.save(snapshot)).catch((e) => console.error("[potty] could not save timers:", e?.message || e)); return writing; };

  /** Wakes up exactly when this person's timer ends (or its next repeat is due), so the push is not a minute late. */
  function wake(user: string) {
    const old = wakeups.get(user);
    if (old) { unschedule(old); wakeups.delete(user); }
    const e = timers[user];
    if (!e) return;
    const sends = e.sends || 0;
    if (sends > MAX_REPEATS) return;
    const at = sends ? (e.lastSentAt || e.endAt) + REPEAT_EVERY_MS : e.endAt;
    const wait = Math.min(MAX_TIMEOUT_MS, Math.max(0, at - now()) + 250);
    const handle = schedule(() => { wakeups.delete(user); void fire().catch(() => {}); }, wait);
    handle?.unref?.();
    wakeups.set(user, handle);
  }

  /** One pass: announce the timers that have ended. Safe to call as often as wanted; each timer is announced once per repeat. */
  async function fire(at = now()): Promise<number> {
    await ensure();
    let sent = 0;
    for (const user of dueTimers(timers, at)) {
      const e = timers[user];
      if (!e) continue;
      const message = ringMessage(e);
      // Marked first, so a slow phone service can't cause a double send.
      timers[user] = { ...e, sends: (e.sends || 0) + 1, lastSentAt: at };
      await persist();
      try { if ((await deps.notify(Number(user), message)) > 0) sent++; } catch (error: any) { console.error("[potty] push failed:", error?.message || error); }
      wake(user);
    }
    const kept = pruneTimers(timers, at);
    if (Object.keys(kept).length !== Object.keys(timers).length) { for (const user of Object.keys(timers)) if (!kept[user]) wake(user); timers = kept; await persist(); }
    return sent;
  }

  async function sync(userId: number, body: unknown): Promise<boolean> {
    const asked = cleanTimerSync(body, now());
    if (!asked) return false;
    await ensure();
    const user = String(userId);
    if ("clear" in asked && asked.clear) { if (!timers[user]) return true; delete timers[user]; }
    else if ("entry" in asked) {
      const same = timers[user];
      // The same timer sent again (the page does this when it opens) must not forget that it already rang.
      timers[user] = same && same.kid === asked.entry.kid && same.endAt === asked.entry.endAt
        ? { ...same, kidName: asked.entry.kidName, minutes: asked.entry.minutes }
        : { ...asked.entry, updatedAt: now() };
    }
    wake(user);
    await persist();
    return true;
  }

  let ticker: ReturnType<typeof setInterval> | null = null;
  const start = () => { if (ticker) return; ticker = setInterval(() => { void fire().catch((e) => console.error("[potty] pass failed:", e?.message || e)); }, TICK_MS); (ticker as any).unref?.(); void ensure().catch(() => {}); };
  return { sync, fire, start, snapshot: () => ({ ...timers }), ready: ensure };
}
export type PottyTimers = ReturnType<typeof createPottyTimers>;

export function registerPottyTimerRoutes(app: Express, authMiddleware: RequestHandler, deps: PottyTimerDeps, start = true) {
  const timers = createPottyTimers(deps);
  if (start) timers.start();
  const limit = createAttemptLimiter({ max: 90, windowMs: 60_000 });
  const tests = createAttemptLimiter({ max: 5, windowMs: 15 * 60_000 });
  const realAccount = (req: any, res: any, next: any) => {
    if (req.adminPreview || !Number.isSafeInteger(Number(req.user?.id))) return res.status(403).json({ message: "Sign in to your own account to turn on notifications." });
    next();
  };

  app.put("/api/pro/potty/timer", authMiddleware, realAccount, async (req: any, res) => {
    const who = String(req.user.id);
    const wait = limit.retryAfter(who);
    if (wait) return res.status(429).json({ message: `Too many timer updates. Try again in ${waitWords(wait)}.` });
    limit.fail(who);
    try {
      if (!(await timers.sync(Number(req.user.id), req.body))) return res.status(400).json({ message: "That timer doesn't look right." });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[potty] timer sync failed:", error?.message || error);
      res.status(500).json({ message: "Couldn't set the phone notification. It will try again." });
    }
  });

  app.post("/api/pro/potty/push/subscribe", authMiddleware, realAccount, async (req: any, res) => {
    const result = await deps.registerDevice(Number(req.user.id), req.body).catch(() => ({ ok: false as const, status: 500, message: "Could not turn notifications on. Try again in a moment." }));
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    res.json({ ok: true });
  });

  app.post("/api/pro/potty/push/test", authMiddleware, realAccount, async (req: any, res) => {
    const who = String(req.user.id);
    const wait = tests.retryAfter(who);
    if (wait) return res.status(429).json({ message: `That's a lot of tests. Try again in ${waitWords(wait)}.` });
    tests.fail(who);
    const delivered = await deps.notify(Number(req.user.id), { title: "🚽 Potty notifications are on", body: "You'll get one like this when the potty timer ends, even with the app closed.", url: "/#/pro?app=potty", tag: "potty-test" }).catch(() => 0);
    if (!delivered) return res.status(409).json({ message: "No phone is signed up yet. Turn notifications on first." });
    res.json({ ok: true, delivered });
  });
  return timers;
}
