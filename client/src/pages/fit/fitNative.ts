// Arise Fit on the iPhone: Apple Health (@capgo/capacitor-health, plugin "Health") and reminders
// (@capacitor/local-notifications). Called through Capacitor's bridge directly, so the website build
// never needs those packages; on the website, or in an app build without the plugins, every call
// says so instead of failing silently.
import { isNativeApp, nativeCall } from "@/lib/nativeApp";

const health = (method: string, options?: unknown) => nativeCall(/^Health$|CapacitorHealth/i, "Health", method, options);
const notes = (method: string, options?: unknown) => nativeCall(/LocalNotifications/i, "LocalNotifications", method, options);
const friendly = (e: any, what: string) => {
  const m = String(e?.message || e || "");
  if (/not implemented|unimplemented|plugin|not available/i.test(m)) return new Error(`${what} needs the newest Arise Fit from TestFlight.`);
  if (/entitlement|healthkit/i.test(m)) return new Error("Apple Health isn't switched on for this build yet. Update Arise Fit from TestFlight.");
  return new Error(m || `${what} didn't answer. Try again.`);
};

const LS = { health: "arise-fit-health", reminders: "arise-fit-reminders" };
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* not kept */ } };

export const canUseNative = () => isNativeApp();

// ——— Apple Health ——————————————————————————————————————————————————————————————————————————————
export const healthConnected = () => read(LS.health) === "1";
const READ = ["steps", "calories", "weight", "heartRate", "distance"];
const WRITE = ["weight", "calories", "distance"];

export async function connectHealth(): Promise<void> {
  if (!isNativeApp()) throw new Error("Apple Health works in the Arise Fit iPhone app.");
  const ok = await health("isAvailable").catch(() => null);
  if (ok && ok.available === false) throw new Error(ok.reason || "Apple Health isn't available on this device.");
  try { await health("requestAuthorization", { read: READ, write: WRITE }); } catch (e) { throw friendly(e, "Apple Health"); }
  write(LS.health, "1");
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
export type Reminders = { workout: { on: boolean; hour: number; minute: number; days: number[] }; water: boolean; weighIn: boolean; fasting: boolean };
export const defaultReminders = (): Reminders => ({ workout: { on: false, hour: 18, minute: 0, days: [1, 2, 3, 4, 5] }, water: false, weighIn: false, fasting: true });
export function readReminders(): Reminders {
  try { return { ...defaultReminders(), ...JSON.parse(read(LS.reminders) || "{}") }; } catch { return defaultReminders(); }
}

// Fixed ids so each reminder replaces itself: 100–106 workout days, 200–206 water, 300 weigh-in, 400 fast.
const WORKOUT_LINES = ["Time to train. Your workout's ready in Arise Fit.", "Don't break the streak. Get your session in.", "The bar won't lift itself. Let's go.", "Ten minutes beats zero. Start a workout."];
export async function applyReminders(r: Reminders): Promise<void> {
  write(LS.reminders, JSON.stringify(r));
  if (!isNativeApp()) return;
  try {
    const perm = await notes("requestPermissions");
    if (perm?.display && perm.display !== "granted") throw new Error("Notifications are off for Arise Fit. Turn them on in Settings → Notifications → Arise Fit.");
    await notes("cancel", { notifications: [...[0, 1, 2, 3, 4, 5, 6].flatMap((d) => [{ id: 100 + d }, { id: 200 + d }]), { id: 300 }] });
    const list: any[] = [];
    // iOS weekday: 1 = Sunday … 7 = Saturday; ours: 0 = Sunday.
    if (r.workout.on) for (const d of r.workout.days) list.push({ id: 100 + d, title: "Arise Fit", body: WORKOUT_LINES[d % WORKOUT_LINES.length], schedule: { on: { weekday: d + 1, hour: r.workout.hour, minute: r.workout.minute }, allowWhileIdle: true } });
    if (r.water) [10, 13, 16, 19].forEach((h, i) => list.push({ id: 200 + i, title: "Hydrate", body: "Drink a glass of water and log it.", schedule: { on: { hour: h, minute: 0 }, allowWhileIdle: true } }));
    if (r.weighIn) list.push({ id: 300, title: "Weigh-in", body: "Step on the scale before breakfast and log it.", schedule: { on: { hour: 7, minute: 15 }, allowWhileIdle: true } });
    if (list.length) await notes("schedule", { notifications: list });
  } catch (e) { throw friendly(e, "Reminders"); }
}

/** A one-off "fast complete" alert at the goal time (replaced or cancelled with the fast). */
export function scheduleFastEnd(at: number | null) {
  if (!isNativeApp() || !readReminders().fasting) return;
  void (async () => {
    try {
      await notes("cancel", { notifications: [{ id: 400 }] });
      if (at && at > Date.now()) await notes("schedule", { notifications: [{ id: 400, title: "Fast complete", body: "You hit your fasting goal. Break it with protein and log your meal.", schedule: { at: new Date(at).toISOString(), allowWhileIdle: true } }] });
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
