// Cooked on the iPhone: Apple Health (@capgo/capacitor-health, plugin "Health") and reminders
// (@capacitor/local-notifications). Called through Capacitor's bridge directly, so the website build
// never needs those packages; on the website, or in an app build without the plugins, every call
// says so instead of failing silently.
import { isNativeApp, nativeCall } from "@/lib/nativeApp";
import { REPEATING_IDS, buildLocalReminders, cleanReminders, defaultReminders as defaults, type Reminders, type SleepRemind } from "@shared/fitReminders";

const health = (method: string, options?: unknown) => nativeCall(/^Health$|CapacitorHealth/i, "Health", method, options);
const notes = (method: string, options?: unknown) => nativeCall(/LocalNotifications/i, "LocalNotifications", method, options);
const friendly = (e: any, what: string) => {
  const m = String(e?.message || e || "");
  if (/not implemented|unimplemented|plugin|not available/i.test(m)) return new Error(`${what} needs the newest Cooked from TestFlight.`);
  if (/entitlement|healthkit/i.test(m)) return new Error("Apple Health isn't switched on for this build yet. Update Cooked from TestFlight.");
  return new Error(m || `${what} didn't answer. Try again.`);
};

const LS = { health: "arise-fit-health", reminders: "arise-fit-reminders" };
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* not kept */ } };

export const canUseNative = () => isNativeApp();

// ——— Apple Health ——————————————————————————————————————————————————————————————————————————————
export const healthConnected = () => read(LS.health) === "1";
const READ = ["steps", "calories", "weight", "heartRate", "distance", "sleep", "restingHeartRate", "heartRateVariability", "mindfulness"];
const WRITE = ["weight", "calories", "distance", "mindfulness"];
// Sleep, heart rate variability and mindful minutes were added after Health first connected: anyone
// connected before is asked once more (iOS only shows the new ones).
const ASKED = "arise-fit-health-asked-v2";

export async function connectHealth(): Promise<void> {
  if (!isNativeApp()) throw new Error("Apple Health works in the Cooked iPhone app.");
  const ok = await health("isAvailable").catch(() => null);
  if (ok && ok.available === false) throw new Error(ok.reason || "Apple Health isn't available on this device.");
  try { await health("requestAuthorization", { read: READ, write: WRITE }); } catch (e) { throw friendly(e, "Apple Health"); }
  write(LS.health, "1"); write(ASKED, "1");
}
async function askNewTypes() {
  if (read(ASKED) === "1") return;
  try { await health("requestAuthorization", { read: READ, write: WRITE }); write(ASKED, "1"); } catch { /* asked next time */ }
}

/** Sleep from Apple Health for the last `days` nights, as stage pieces (an Apple Watch or the iPhone's
 *  Sleep schedule writes them; any sleep app that saves to Health does too). */
export async function readSleepHealth(days = 14): Promise<{ state: string; start: number; end: number }[]> {
  if (!isNativeApp() || !healthConnected()) return [];
  await askNewTypes();
  const end = new Date(), start = new Date(end.getTime() - days * 864e5);
  let res: any;
  try { res = await health("readSamples", { dataType: "sleep", startDate: start.toISOString(), endDate: end.toISOString(), limit: 5000, ascending: true }); }
  catch (e) { throw friendly(e, "Apple Health sleep"); }
  const out: { state: string; start: number; end: number }[] = [];
  for (const s of res?.samples ?? []) {
    // A sample can carry its night's stages, or be one stage itself.
    if (Array.isArray(s?.stages) && s.stages.length) for (const g of s.stages) out.push({ state: String(g?.stage || "asleep"), start: Date.parse(g?.startDate), end: Date.parse(g?.endDate) });
    else out.push({ state: String(s?.sleepState || s?.value || "asleep"), start: Date.parse(s?.startDate), end: Date.parse(s?.endDate) });
  }
  return out.filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end) && x.end > x.start);
}

/** Saves mindful minutes (a finished breathing or meditation session) to Apple Health. */
export function saveMindful(start: Date, end: Date) {
  if (!healthConnected() || !isNativeApp() || end.getTime() - start.getTime() < 30_000) return;
  void health("saveSample", { dataType: "mindfulness", value: Math.round((end.getTime() - start.getTime()) / 60_000) || 1, unit: "minute", startDate: start.toISOString(), endDate: end.toISOString() }).catch(() => {});
}
export const disconnectHealth = () => write(LS.health, null);

const dayRange = (days: number) => { const end = new Date(); end.setHours(24, 0, 0, 0); const start = new Date(end); start.setDate(start.getDate() - days); return { startDate: start.toISOString(), endDate: end.toISOString() }; };
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Daily totals for the last `days` days: { "2026-11-01": 8421, … }. */
async function daily(dataType: string, days: number): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const res = await health("queryAggregated", { dataType, ...dayRange(days), bucket: "day", aggregation: "sum" });
    for (const s of res?.samples ?? []) if (Number(s?.value) > 0) out[localDay(s.startDate)] = Math.round(Number(s.value));
    if (Object.keys(out).length) return out;
  } catch { /* fall back to raw samples */ }
  const res = await health("readSamples", { dataType, ...dayRange(days), limit: 20000, ascending: true });
  for (const s of res?.samples ?? []) { const v = Number(s?.value); if (v > 0) { const d = localDay(s.startDate); out[d] = Math.round((out[d] ?? 0) + v); } }
  return out;
}

export type HealthSnapshot = { steps: Record<string, number>; active: Record<string, number>; weights: { date: string; kg: number }[] };
/** Steps and active calories (last 14 days) and weigh-ins (last 90) from Apple Health. */
export async function readHealth(): Promise<HealthSnapshot> {
  try {
    const [steps, active, w] = await Promise.all([daily("steps", 14), daily("calories", 14).catch(() => ({})),
      health("readSamples", { dataType: "weight", ...dayRange(90), limit: 500, ascending: true }).catch(() => ({ samples: [] }))]);
    const weights = (w?.samples ?? []).map((s: any) => ({ date: localDay(s.startDate), kg: Math.round((/lb|pound/i.test(String(s.unit)) ? Number(s.value) / 2.20462 : Number(s.value)) * 10) / 10 })).filter((x: { kg: number }) => x.kg > 20 && x.kg < 400);
    return { steps, active, weights };
  } catch (e) { throw friendly(e, "Apple Health"); }
}

/** Saves to Apple Health when it's connected (never interrupts if it can't). */
export function saveToHealth(kind: "weight" | "calories" | "distance", value: number, start = new Date(), end = new Date()) {
  if (!healthConnected() || !isNativeApp() || !(value > 0)) return;
  const unit = kind === "weight" ? "kilogram" : kind === "calories" ? "kilocalorie" : "meter";
  void health("saveSample", { dataType: kind, value, unit, startDate: start.toISOString(), endDate: end.toISOString() }).catch(() => {});
}

// ——— Reminders —————————————————————————————————————————————————————————————————————————————————
// Which reminders, their times and ids are in shared/fitReminders.ts. Sleep reminders follow the bedtime
// schedule saved with sleep (FitSleep), so they are passed in each time.
export type { Reminders } from "@shared/fitReminders";
export const defaultReminders = defaults;
const LS_SLEEP = "arise-fit-sleep-remind";
export function readReminders(): Reminders {
  try { return cleanReminders(JSON.parse(read(LS.reminders) || "{}")); } catch { return defaults(); }
}
const readSleepRemind = (): SleepRemind | null => { try { return JSON.parse(read(LS_SLEEP) || "null"); } catch { return null; } };
const OFF = "Notifications are off for Cooked. Turn them on in Settings → Notifications → Cooked.";

/** Saves the settings and sets every repeating reminder again (workout, water, weigh-in, meals, sleep). */
export async function applyReminders(r: Reminders, sleep: SleepRemind | null = readSleepRemind()): Promise<void> {
  write(LS.reminders, JSON.stringify(r));
  write(LS_SLEEP, sleep ? JSON.stringify(sleep) : null);
  if (!isNativeApp()) return;
  try {
    const list = buildLocalReminders(r, sleep);
    if (list.length) {
      const perm = await notes("requestPermissions");
      if (perm?.display && perm.display !== "granted") throw new Error(OFF);
    }
    await notes("cancel", { notifications: REPEATING_IDS.map((id) => ({ id })) });
    if (r.paused) await notes("cancel", { notifications: [{ id: 400 }, { id: 500 }] });
    if (list.length) await notes("schedule", { notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { on: n.on, allowWhileIdle: true }, ...(n.url ? { extra: { url: n.url } } : {}) })) });
  } catch (e) { throw friendly(e, "Reminders"); }
}

/** Sleep reminders, around a bedtime schedule ("22:30", "06:30"): wind down 30 minutes before bed, a
 *  bedtime nudge, and a morning check-in 15 minutes after waking. Off when `sc` is missing. */
export async function applySleepReminders(sc: { bed: string; wake: string } | undefined, on: { windDown: boolean; morning: boolean; bedtime?: boolean }): Promise<void> {
  await applyReminders(readReminders(), sc ? { bed: sc.bed, wake: sc.wake, windDown: on.windDown, morning: on.morning, bedtime: on.bedtime === true } : null);
}

/** A test notification in 5 seconds, so you can see they work. false when notifications are off. */
export async function testNotification(app = "Cooked"): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const perm = await notes("requestPermissions");
    if (perm?.display && perm.display !== "granted") return false;
    await notes("schedule", { notifications: [{ id: 999, title: app, body: "Notifications are working.", schedule: { at: new Date(Date.now() + 5000).toISOString(), allowWhileIdle: true } }] });
    return true;
  } catch { return false; }
}

/** A one-off "fast complete" alert at the goal time (replaced or cancelled with the fast). Only set for
 *  a goal at least a few minutes away, so starting a fast can never fire it on the spot. */
export function scheduleFastEnd(at: number | null, startedAt?: number) {
  if (!isNativeApp() || !readReminders().fasting || readReminders().paused) return;
  void (async () => {
    try {
      await notes("cancel", { notifications: [{ id: 400 }] });
      // A fast that was just started has its whole goal still ahead; anything closer than 10 minutes
      // after the start, or already past, is not a finished fast and is never scheduled.
      const ahead = at ? at - Date.now() : 0;
      if (!at || ahead < 10 * 60_000 || (startedAt && at - startedAt < 10 * 60_000)) return;
      await notes("schedule", { notifications: [{ id: 400, title: "Fast complete", body: "You hit your fasting goal. Break it with protein and log your meal.", schedule: { at: new Date(at).toISOString(), allowWhileIdle: true } }] });
    } catch { /* no notifications on this build */ }
  })();
}

/** A one-off "time to eat" reminder after a workout (replaces the last one). false when it can't be set. */
export async function scheduleRefuel(at: number, body: string): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const perm = await notes("requestPermissions");
    if (perm?.display && perm.display !== "granted") return false;
    await notes("cancel", { notifications: [{ id: 500 }] });
    await notes("schedule", { notifications: [{ id: 500, title: "Refuel", body, schedule: { at: new Date(at).toISOString(), allowWhileIdle: true } }] });
    return true;
  } catch { return false; }
}

/** Phone reminders for the Medicine tracker: one at each dose time on each day it's taken (ids 10000–10600,
 *  so setting them again replaces the old ones). Nothing happens off the iPhone app. */
export async function applyMedReminders(meds: { name: string; dose: string; times: string[]; days: number[]; remind: boolean }[]): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const perm = await notes("requestPermissions");
    if (perm?.display && perm.display !== "granted") return false;
    await notes("cancel", { notifications: Array.from({ length: 600 }, (_, i) => ({ id: 10000 + i })) });
    const list: any[] = [];
    meds.slice(0, 20).forEach((m, mi) => {
      if (!m.remind) return;
      m.times.slice(0, 4).forEach((t, ti) => {
        const [hour, minute] = t.split(":").map(Number);
        m.days.forEach((d) => list.push({ id: 10000 + (mi * 4 + ti) * 7 + d, title: "Time for your medicine", body: `${m.name}${m.dose ? ` · ${m.dose}` : ""}. Tap to tick it off.`, schedule: { on: { weekday: d + 1, hour, minute }, allowWhileIdle: true }, extra: { url: "arisefit://do/meds" } }));
      });
    });
    if (list.length) await notes("schedule", { notifications: list });
    return true;
  } catch { return false; }
}

/** Replaces a set of local notifications: cancels `ids`, then schedules `list` (at a time, or every day at hour:minute). */
export async function replaceLocal(ids: number[], list: { id: number; title: string; body: string; at?: string; on?: { hour: number; minute: number } }[]): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    if (list.length) { const perm = await notes("requestPermissions"); if (perm?.display && perm.display !== "granted") return false; }
    await notes("cancel", { notifications: ids.map((id) => ({ id })) });
    if (list.length) await notes("schedule", { notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: n.at ? { at: n.at, allowWhileIdle: true } : { on: n.on, allowWhileIdle: true } })) });
    return true;
  } catch { return false; }
}
