// Apple Health for Life Score (shared/lifeScore.ts, shared/lifeStats.ts), read in the iPhone app through
// @capgo/capacitor-health (plugin "Health"). Everything it can read, for the last 30 days, by day: steps,
// distance, cycling, floors, exercise and stand time, active and resting calories, calories and water taken in,
// sleep with its stages, bedtime and wake time, heart rate (average, low, high), resting heart rate, HRV,
// VO2 max, breathing rate, blood oxygen, body and wrist temperature, weight, body fat, blood pressure,
// blood glucose, mindful minutes and workouts. Read only: nothing is written to Health.
// The website can't reach Apple Health; there the days already saved in the LifeHub show instead.
import { isNativeApp, nativeCall } from "@/lib/nativeApp";
import type { LifeHealthDay } from "@shared/lifeScore";

const health = (method: string, options?: unknown) => nativeCall(/^Health$|CapacitorHealth/i, "Health", method, options);
export const LIFE_HEALTH_READ = [
  "steps", "distance", "distanceCycling", "flightsClimbed", "exerciseTime", "appleStandHour", "calories", "basalCalories",
  "dietaryEnergyConsumed", "dietaryWater", "sleep", "heartRate", "restingHeartRate", "heartRateVariability", "vo2Max", "respiratoryRate",
  "oxygenSaturation", "bodyTemperature", "appleSleepingWristTemperature", "weight", "bodyFat", "bloodPressure", "bloodGlucose",
  "mindfulness", "workouts",
];
const CORE = ["steps", "distance", "calories", "heartRate", "weight", "sleep", "restingHeartRate", "heartRateVariability", "mindfulness"];
const ON = "arise-lifescore-health";
const ASKED = "arise-lifescore-health-v2";

const get = (k: string) => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const set = (k: string, v: boolean) => { try { if (v) localStorage.setItem(k, "1"); else localStorage.removeItem(k); } catch { /* asked again next time */ } };

export const lifeHealthPossible = () => isNativeApp();
export const lifeHealthOn = () => isNativeApp() && get(ON);
export const lifeHealthOff = () => set(ON, false);

const friendly = (e: any) => {
  const m = String(e?.message || e || "");
  if (/not implemented|unimplemented|plugin|not available/i.test(m)) return new Error("Apple Health needs the newest version of the app.");
  if (/entitlement|healthkit/i.test(m)) return new Error("Apple Health isn't switched on for this build yet. Update the app.");
  return new Error(m || "Apple Health didn't answer. Try again.");
};

/** Asks iOS to share everything (iOS never says what was refused, so reading just finds less). */
export async function connectLifeHealth(): Promise<void> {
  if (!isNativeApp()) throw new Error("Apple Health works in the Arise To Do iPhone app.");
  const ok = await health("isAvailable").catch(() => null);
  if (ok && ok.available === false) throw new Error(ok.reason || "Apple Health isn't available on this device.");
  try { await health("requestAuthorization", { read: LIFE_HEALTH_READ, write: [] }); }
  catch (e) {
    // A build of the plugin that doesn't know one of the kinds refuses the whole list: ask for the core ones.
    try { await health("requestAuthorization", { read: CORE, write: [] }); } catch { throw friendly(e); }
  }
  set(ON, true); set(ASKED, true);
}
/** Anyone connected before the full list was read is asked once more (iOS shows only the new kinds). */
async function askNewKinds() {
  if (get(ASKED)) return;
  try { await health("requestAuthorization", { read: LIFE_HEALTH_READ, write: [] }); set(ASKED, true); } catch { /* next time */ }
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const range = (days: number) => { const end = new Date(); end.setHours(24, 0, 0, 0); const start = new Date(end); start.setDate(start.getDate() - days); return { startDate: start.toISOString(), endDate: end.toISOString() }; };
const when = (s: any) => Date.parse(s?.startDate ?? s?.date ?? "");

async function samples(dataType: string, days: number, limit = 20000): Promise<any[]> {
  try { const r = await health("readSamples", { dataType, ...range(days), limit, ascending: true }); return Array.isArray(r?.samples) ? r.samples : []; }
  catch { return []; }
}
async function aggregated(dataType: string, days: number, aggregation: "sum" | "average" | "min" | "max"): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const r = await health("queryAggregated", { dataType, ...range(days), bucket: "day", aggregation });
    for (const s of r?.samples ?? []) { const v = Number(s?.value); if (Number.isFinite(v) && v > 0) out[localDay(when(s))] = v; }
  } catch { /* none */ }
  return out;
}
/** Day totals: HealthKit's own day sums, or the raw samples added up. */
async function dailySum(dataType: string, days: number, scale = (v: number, _u: string) => v): Promise<Record<string, number>> {
  const agg = await aggregated(dataType, days, "sum");
  if (Object.keys(agg).length) return agg;
  const out: Record<string, number> = {};
  for (const s of await samples(dataType, days)) { const v = scale(Number(s?.value), String(s?.unit ?? "")); if (v > 0) { const d = localDay(when(s)); out[d] = (out[d] ?? 0) + v; } }
  return out;
}
/** Day averages, lows and highs from the raw samples. */
async function dailyStats(dataType: string, days: number, scale = (v: number, _u: string) => v, limit = 20000): Promise<Record<string, { avg: number; min: number; max: number; last: number }>> {
  const acc: Record<string, number[]> = {};
  for (const s of await samples(dataType, days, limit)) { const v = scale(Number(s?.value), String(s?.unit ?? "")); if (Number.isFinite(v) && v > 0) (acc[localDay(when(s))] ??= []).push(v); }
  return Object.fromEntries(Object.entries(acc).map(([d, v]) => [d, { avg: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v), last: v[v.length - 1] }]));
}

// Units: Health answers in its own units; turned into the ones Life Score keeps.
const toKm = (v: number, u: string) => (/mile/i.test(u) ? v * 1.609344 : /^m$|meter/i.test(u) && !/kilo/i.test(u) ? v / 1000 : v);
const toLb = (v: number, u: string) => (/pound|lb/i.test(u) ? v : v * 2.20462);
const toPct = (v: number) => (v <= 1 ? v * 100 : v);
const toF = (v: number, u: string) => (/fahrenheit|°F|degF/i.test(u) ? v : v * 1.8 + 32);
const toMl = (v: number, u: string) => (/^l$|liter|litre/i.test(u) && !/milli/i.test(u) ? v * 1000 : /fl|ounce|oz/i.test(u) ? v * 29.5735 : v);
const toMgDl = (v: number, u: string) => (/mmol/i.test(u) ? v * 18 : v);

/** A night belongs to the day you woke up: a piece starting after 6 PM counts toward the next day. */
const nightOf = (start: number) => localDay(start + 6 * 3600_000);

/** The last `days` days from Apple Health, by day. */
export async function readLifeHealth(days = 30): Promise<Record<string, LifeHealthDay>> {
  if (!isNativeApp()) return {};
  await askNewKinds();
  const [steps, km, bike, flights, exMin, active, basal, eaten, water, rhr, hrv, hr, vo2, resp, spo2, temp, wristRaw, weight, fat, glucose, mindRaw, sleepRaw, bpRaw] = await Promise.all([
    dailySum("steps", days), dailySum("distance", days, toKm), dailySum("distanceCycling", days, toKm), dailySum("flightsClimbed", days), dailySum("exerciseTime", days),
    dailySum("calories", days), dailySum("basalCalories", days), dailySum("dietaryEnergyConsumed", days), dailySum("dietaryWater", days, toMl),
    dailyStats("restingHeartRate", days), dailyStats("heartRateVariability", days), dailyStats("heartRate", days, undefined, 40000), dailyStats("vo2Max", days + 60),
    dailyStats("respiratoryRate", days), dailyStats("oxygenSaturation", days, toPct), dailyStats("bodyTemperature", days, toF), samples("appleSleepingWristTemperature", days),
    dailyStats("weight", days + 60, toLb), dailyStats("bodyFat", days + 60, toPct), dailyStats("bloodGlucose", days, toMgDl),
    samples("mindfulness", days), samples("sleep", days + 1, 5000), samples("bloodPressure", days + 60, 500),
  ]);
  // Distance comes in meters from some phones even when summed by HealthKit.
  for (const d of Object.keys(km)) if (km[d] > 200) km[d] = km[d] / 1000;
  for (const d of Object.keys(bike)) if (bike[d] > 500) bike[d] = bike[d] / 1000;

  // Stand hours: each sample is one hour stood.
  const stand: Record<string, number> = {};
  for (const s of await samples("appleStandHour", days, 2000)) if (Number(s?.value) > 0) { const d = localDay(when(s)); stand[d] = (stand[d] ?? 0) + 1; }

  // Sleep: each asleep piece (a night's stages, or a night as one piece), summed per night, by stage.
  const pieces: { state: string; start: number; end: number }[] = [];
  for (const s of sleepRaw) {
    if (Array.isArray(s?.stages) && s.stages.length) for (const g of s.stages) pieces.push({ state: String(g?.stage || "asleep"), start: Date.parse(g?.startDate), end: Date.parse(g?.endDate) });
    else pieces.push({ state: String(s?.sleepState || s?.value || "asleep"), start: Date.parse(s?.startDate), end: Date.parse(s?.endDate) });
  }
  const nights: Record<string, { min: number; bed: number; wake: number; deep: number; rem: number; core: number; awake: number }> = {};
  for (const p of pieces) {
    if (!Number.isFinite(p.start) || !Number.isFinite(p.end) || p.end <= p.start || /in_?bed/i.test(p.state)) continue;
    const d = nightOf(p.start), n = (nights[d] ??= { min: 0, bed: Infinity, wake: 0, deep: 0, rem: 0, core: 0, awake: 0 });
    const mins = (p.end - p.start) / 60_000;
    if (/awake/i.test(p.state)) { n.awake += mins; continue; }
    n.min += mins; n.bed = Math.min(n.bed, p.start); n.wake = Math.max(n.wake, p.end);
    if (/deep/i.test(p.state)) n.deep += mins; else if (/rem/i.test(p.state)) n.rem += mins; else if (/core|light/i.test(p.state)) n.core += mins;
  }
  const mindful: Record<string, number> = {};
  for (const s of mindRaw) { const a = Date.parse(s?.startDate), b = Date.parse(s?.endDate); if (b > a) { const d = localDay(a); mindful[d] = (mindful[d] ?? 0) + Math.round((b - a) / 60_000); } }
  const wrist: Record<string, number> = {};
  for (const s of wristRaw) { const v = Number(s?.value); if (Number.isFinite(v)) wrist[localDay(when(s))] = /fahrenheit|°F/i.test(String(s?.unit)) ? v : v * 1.8; }
  const bp: Record<string, { sys: number; dia: number }> = {};
  for (const s of bpRaw) { const sys = Number(s?.systolic ?? s?.value?.systolic), dia = Number(s?.diastolic ?? s?.value?.diastolic); if (sys > 0 && dia > 0) bp[localDay(when(s))] = { sys: Math.round(sys), dia: Math.round(dia) }; }

  // Workouts.
  const wo: Record<string, { n: number; min: number; cal: number; kinds: string[] }> = {};
  try {
    const r = await health("queryWorkouts", { ...range(days), limit: 500, ascending: true });
    for (const w of r?.workouts ?? []) {
      const a = Date.parse(w?.startDate), b = Date.parse(w?.endDate);
      const d = localDay(a), e = (wo[d] ??= { n: 0, min: 0, cal: 0, kinds: [] });
      e.n++;
      e.min += Math.round((Number(w?.duration) > 0 ? Number(w.duration) / 60 : b > a ? (b - a) / 60_000 : 0));
      e.cal += Math.round(Number(w?.totalEnergyBurned ?? w?.calories ?? 0) || 0);
      const kind = String(w?.workoutType ?? w?.activityType ?? "Workout").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
      if (!e.kinds.includes(kind)) e.kinds.push(kind);
    }
  } catch { /* no workouts shared */ }

  const out: Record<string, LifeHealthDay> = {};
  const put = <K extends keyof LifeHealthDay>(d: string, k: K, v: LifeHealthDay[K]) => { (out[d] ??= {})[k] = v; };
  const r1 = (v: number) => Math.round(v * 10) / 10;
  for (const [d, v] of Object.entries(steps)) put(d, "steps", Math.round(v));
  for (const [d, v] of Object.entries(km)) put(d, "km", Math.round(v * 100) / 100);
  for (const [d, v] of Object.entries(bike)) put(d, "bikeKm", Math.round(v * 100) / 100);
  for (const [d, v] of Object.entries(flights)) put(d, "flights", Math.round(v));
  for (const [d, v] of Object.entries(exMin)) put(d, "exMin", Math.round(v));
  for (const [d, v] of Object.entries(stand)) put(d, "stand", v);
  for (const [d, v] of Object.entries(active)) put(d, "active", Math.round(v));
  for (const [d, v] of Object.entries(basal)) put(d, "basal", Math.round(v));
  for (const [d, v] of Object.entries(eaten)) put(d, "eaten", Math.round(v));
  for (const [d, v] of Object.entries(water)) put(d, "water", Math.round(v));
  for (const [d, v] of Object.entries(rhr)) put(d, "rhr", Math.round(v.avg));
  for (const [d, v] of Object.entries(hrv)) put(d, "hrv", Math.round(v.avg));
  for (const [d, v] of Object.entries(hr)) { put(d, "hrAvg", Math.round(v.avg)); put(d, "hrMin", Math.round(v.min)); put(d, "hrMax", Math.round(v.max)); }
  for (const [d, v] of Object.entries(vo2)) put(d, "vo2", r1(v.last));
  for (const [d, v] of Object.entries(resp)) put(d, "resp", r1(v.avg));
  for (const [d, v] of Object.entries(spo2)) put(d, "spo2", r1(v.avg));
  for (const [d, v] of Object.entries(temp)) put(d, "temp", r1(v.avg));
  for (const [d, v] of Object.entries(wrist)) put(d, "wrist", Math.round(v * 100) / 100);
  for (const [d, v] of Object.entries(weight)) put(d, "weight", r1(v.last));
  for (const [d, v] of Object.entries(fat)) put(d, "fat", r1(v.last));
  for (const [d, v] of Object.entries(glucose)) put(d, "glucose", Math.round(v.avg));
  for (const [d, v] of Object.entries(bp)) { put(d, "sys", v.sys); put(d, "dia", v.dia); }
  for (const [d, v] of Object.entries(mindful)) if (v > 0) put(d, "mindful", v);
  for (const [d, v] of Object.entries(wo)) { put(d, "wo", v.n); put(d, "woMin", v.min); if (v.cal) put(d, "woCal", v.cal); put(d, "woKinds", v.kinds.slice(0, 10)); }
  for (const [d, n] of Object.entries(nights)) {
    if (n.min < 60) continue; // a nap
    put(d, "sleep", Math.round((n.min / 60) * 20) / 20);
    const b = new Date(n.bed), w = new Date(n.wake);
    put(d, "bed", (b.getHours() * 60 + b.getMinutes() - 1080 + 1440) % 1440);
    put(d, "wake", w.getHours() * 60 + w.getMinutes());
    if (n.deep) put(d, "deep", Math.round(n.deep));
    if (n.rem) put(d, "rem", Math.round(n.rem));
    if (n.core) put(d, "core", Math.round(n.core));
    if (n.awake) put(d, "awake", Math.round(n.awake));
  }
  return out;
}
