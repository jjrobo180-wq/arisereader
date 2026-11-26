// Apple Health for Life Score (shared/lifeScore.ts), read in the iPhone app through @capgo/capacitor-health
// (plugin "Health"): daily steps and active calories, sleep (hours asleep and bedtime), resting heart rate,
// heart rate variability and mindful minutes for the last 30 days. Read only; nothing is written to Health.
// The website can't reach Apple Health, so there the days already saved in the LifeHub are shown instead.
import { isNativeApp, nativeCall } from "@/lib/nativeApp";
import type { LifeHealthDay } from "@shared/lifeScore";

const health = (method: string, options?: unknown) => nativeCall(/^Health$|CapacitorHealth/i, "Health", method, options);
const READ = ["steps", "calories", "sleep", "restingHeartRate", "heartRateVariability", "mindfulness", "heartRate"];
const ON = "arise-lifescore-health";

const get = () => { try { return localStorage.getItem(ON) === "1"; } catch { return false; } };
const set = (v: boolean) => { try { if (v) localStorage.setItem(ON, "1"); else localStorage.removeItem(ON); } catch { /* asked again next time */ } };

export const lifeHealthPossible = () => isNativeApp();
export const lifeHealthOn = () => isNativeApp() && get();
export const lifeHealthOff = () => set(false);

const friendly = (e: any) => {
  const m = String(e?.message || e || "");
  if (/not implemented|unimplemented|plugin|not available/i.test(m)) return new Error("Apple Health needs the newest version of the app.");
  if (/entitlement|healthkit/i.test(m)) return new Error("Apple Health isn't switched on for this build yet. Update the app.");
  return new Error(m || "Apple Health didn't answer. Try again.");
};

/** Asks iOS to share the data (iOS never says what was refused, so reading just finds less). */
export async function connectLifeHealth(): Promise<void> {
  if (!isNativeApp()) throw new Error("Apple Health works in the Arise To Do iPhone app.");
  const ok = await health("isAvailable").catch(() => null);
  if (ok && ok.available === false) throw new Error(ok.reason || "Apple Health isn't available on this device.");
  try { await health("requestAuthorization", { read: READ, write: [] }); } catch (e) { throw friendly(e); }
  set(true);
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const range = (days: number) => { const end = new Date(); end.setHours(24, 0, 0, 0); const start = new Date(end); start.setDate(start.getDate() - days); return { startDate: start.toISOString(), endDate: end.toISOString() }; };

async function samples(dataType: string, days: number): Promise<any[]> {
  try { const r = await health("readSamples", { dataType, ...range(days), limit: 20000, ascending: true }); return Array.isArray(r?.samples) ? r.samples : []; }
  catch { return []; }
}
/** Day totals (steps, calories): HealthKit's own day sums, or the raw samples added up. */
async function dailySum(dataType: string, days: number): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const r = await health("queryAggregated", { dataType, ...range(days), bucket: "day", aggregation: "sum" });
    for (const s of r?.samples ?? []) { const v = Number(s?.value); if (v > 0) out[localDay(Date.parse(s.startDate))] = Math.round(v); }
    if (Object.keys(out).length) return out;
  } catch { /* add up the samples */ }
  for (const s of await samples(dataType, days)) { const v = Number(s?.value); if (v > 0) { const d = localDay(Date.parse(s.startDate)); out[d] = Math.round((out[d] ?? 0) + v); } }
  return out;
}
/** Day averages (heart rate variability, resting heart rate). */
async function dailyMean(dataType: string, days: number): Promise<Record<string, number>> {
  const acc: Record<string, number[]> = {};
  for (const s of await samples(dataType, days)) { const v = Number(s?.value); if (v > 0) (acc[localDay(Date.parse(s.startDate))] ??= []).push(v); }
  return Object.fromEntries(Object.entries(acc).map(([d, v]) => [d, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]));
}

/** A night belongs to the day you woke up: a piece starting after 6 PM counts toward the next day. */
const nightOf = (start: number) => localDay(start + 6 * 3600_000);
const ASLEEP = /asleep|core|deep|rem|light|sleeping/i;
const NOT = /awake|in_?bed/i;

/** The last `days` days from Apple Health, by day. */
export async function readLifeHealth(days = 30): Promise<Record<string, LifeHealthDay>> {
  if (!isNativeApp()) return {};
  const [steps, active, rhr, hrv, sleepRaw, mindRaw] = await Promise.all([
    dailySum("steps", days), dailySum("calories", days), dailyMean("restingHeartRate", days), dailyMean("heartRateVariability", days),
    samples("sleep", days + 1), samples("mindfulness", days),
  ]);
  // Sleep: every asleep piece (a night's stages, or a night as one piece), summed per night, bedtime the earliest.
  const pieces: { state: string; start: number; end: number }[] = [];
  for (const s of sleepRaw) {
    if (Array.isArray(s?.stages) && s.stages.length) for (const g of s.stages) pieces.push({ state: String(g?.stage || "asleep"), start: Date.parse(g?.startDate), end: Date.parse(g?.endDate) });
    else pieces.push({ state: String(s?.sleepState || s?.value || "asleep"), start: Date.parse(s?.startDate), end: Date.parse(s?.endDate) });
  }
  const sleep: Record<string, { min: number; bed: number }> = {};
  for (const p of pieces) {
    if (!Number.isFinite(p.start) || !Number.isFinite(p.end) || p.end <= p.start || NOT.test(p.state) || !ASLEEP.test(p.state)) continue;
    const d = nightOf(p.start), n = (sleep[d] ??= { min: 0, bed: Infinity });
    n.min += (p.end - p.start) / 60_000;
    n.bed = Math.min(n.bed, p.start);
  }
  const mindful: Record<string, number> = {};
  for (const s of mindRaw) { const a = Date.parse(s?.startDate), b = Date.parse(s?.endDate); if (b > a) { const d = localDay(a); mindful[d] = (mindful[d] ?? 0) + Math.round((b - a) / 60_000); } }

  const out: Record<string, LifeHealthDay> = {};
  const put = (d: string, k: keyof LifeHealthDay, v: number) => { (out[d] ??= {})[k] = v; };
  for (const [d, v] of Object.entries(steps)) put(d, "steps", v);
  for (const [d, v] of Object.entries(active)) put(d, "active", v);
  for (const [d, v] of Object.entries(rhr)) put(d, "rhr", v);
  for (const [d, v] of Object.entries(hrv)) put(d, "hrv", v);
  for (const [d, v] of Object.entries(mindful)) if (v > 0) put(d, "mindful", v);
  for (const [d, n] of Object.entries(sleep)) {
    if (n.min < 60) continue; // a nap
    put(d, "sleep", Math.round((n.min / 60) * 20) / 20);
    const b = new Date(n.bed);
    put(d, "bed", (b.getHours() * 60 + b.getMinutes() - 1080 + 1440) % 1440);
  }
  return out;
}
