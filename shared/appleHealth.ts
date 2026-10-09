// Apple Health sync for the Family Hub food diary: checks what the iPhone Shortcut sends,
// and turns synced days into diary entries. Pure functions, tested without the network.
import type { Health } from "./familyHub";

export type SyncDay = { memberId: string; date: string; steps: number | null; activeCalories: number | null; weight: number | null };

/** Numbers from Shortcuts can arrive as text ("8,421", "152.3 lb"). */
const toNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T12:00:00Z"));

/** Cleans one post from the Shortcut. Returns null when there is nothing usable in it. */
export function cleanSyncBody(body: unknown, fallbackDate: string): Omit<SyncDay, "memberId"> | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const date = isDay(b.date) ? b.date : fallbackDate;
  const steps = toNumber(b.steps);
  const active = toNumber(b.activeCalories ?? b.activeEnergy);
  let weight = toNumber(b.weight);
  const unit = String(b.weightUnit ?? (typeof b.weight === "string" ? b.weight : "")).toLowerCase();
  if (weight !== null && /kg|kilo/.test(unit)) weight = weight * 2.20462;
  const out = {
    date,
    steps: steps !== null && steps >= 0 && steps <= 200000 ? Math.round(steps) : null,
    activeCalories: active !== null && active >= 0 && active <= 20000 ? Math.round(active) : null,
    weight: weight !== null && weight >= 20 && weight <= 1500 ? Math.round(weight * 10) / 10 : null,
  };
  return out.steps === null && out.activeCalories === null && out.weight === null ? null : out;
}

export const appleExerciseId = (memberId: string, date: string) => `apple:${memberId}:${date}`;
export const appleWeightId = (memberId: string, date: string) => `apple-w:${memberId}:${date}`;
export const APPLE_ACTIVITY = "Apple Health activity";

/** Puts synced days into the diary: steps, active calories as one exercise entry, and weigh-ins.
 *  Returns the same object when nothing changes, so the page doesn't save for nothing. */
export function applySync(health: Health, days: SyncDay[]): Health {
  let next = health;
  let changed = false;
  for (const d of days) {
    if (d.steps !== null) {
      const key = `${d.memberId}:${d.date}`;
      const day = next.days.find((x) => x.id === key);
      if (!day || day.steps !== d.steps) {
        const row = { id: key, memberId: d.memberId, date: d.date, water: day?.water ?? 0, fruitVeg: day?.fruitVeg ?? 0, steps: d.steps };
        next = { ...next, days: day ? next.days.map((x) => (x.id === key ? row : x)) : [...next.days, row].slice(-8000) };
        changed = true;
      }
    }
    if (d.activeCalories !== null) {
      const id = appleExerciseId(d.memberId, d.date);
      const ex = next.exercise.find((x) => x.id === id);
      if (!ex || ex.calories !== d.activeCalories) {
        const row = { id, memberId: d.memberId, date: d.date, name: APPLE_ACTIVITY, minutes: 0, calories: d.activeCalories };
        next = { ...next, exercise: ex ? next.exercise.map((x) => (x.id === id ? row : x)) : [...next.exercise, row].slice(-6000) };
        changed = true;
      }
    }
    if (d.weight !== null) {
      const id = appleWeightId(d.memberId, d.date);
      const w = next.weights.find((x) => x.id === id);
      const typedSameDay = next.weights.some((x) => x.memberId === d.memberId && x.date === d.date && x.id !== id);
      if (!typedSameDay && (!w || w.weight !== d.weight)) {
        const row = { id, memberId: d.memberId, date: d.date, weight: d.weight };
        next = { ...next, weights: w ? next.weights.map((x) => (x.id === id ? row : x)) : [...next.weights, row].slice(-3000) };
        changed = true;
      }
    }
  }
  return changed ? next : health;
}

/** The Health Auto Export app's REST format: {"data":{"metrics":[{"name":"step_count","units":"count","data":[{"date":"2026-10-09 00:00:00 -0600","qty":8421}]}]}}.
 *  Adds up steps and active energy per day, keeps the last weight of each day, and converts kJ and kg. Newest 60 days at most. */
export function cleanAutoExport(body: unknown): Omit<SyncDay, "memberId">[] {
  const metrics = (body as any)?.data?.metrics;
  if (!Array.isArray(metrics)) return [];
  const days = new Map<string, { steps: number | null; activeCalories: number | null; weight: number | null }>();
  const day = (d: string) => { let x = days.get(d); if (!x) { x = { steps: null, activeCalories: null, weight: null }; days.set(d, x); } return x; };
  for (const m of metrics.slice(0, 20)) {
    const name = String(m?.name || "").toLowerCase();
    const units = String(m?.units || "").toLowerCase();
    const kind = name === "step_count" || name === "steps" ? "steps" : name === "active_energy" || name === "active_energy_burned" ? "active" : name === "weight_body_mass" || name === "body_mass" || name === "weight" ? "weight" : null;
    if (!kind || !Array.isArray(m?.data)) continue;
    for (const point of m.data.slice(-2000)) {
      const date = String(point?.date || "").slice(0, 10);
      const qty = toNumber(point?.qty ?? point?.Avg ?? point?.avg);
      if (!isDay(date) || qty === null || qty < 0) continue;
      const d = day(date);
      if (kind === "steps") d.steps = (d.steps ?? 0) + qty;
      if (kind === "active") d.activeCalories = (d.activeCalories ?? 0) + (units === "kj" ? qty / 4.184 : qty);
      if (kind === "weight") d.weight = /kg/.test(units) ? qty * 2.20462 : qty;
    }
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-60)
    .map(([date, d]) => cleanSyncBody({ date, steps: d.steps, activeCalories: d.activeCalories, weight: d.weight }, date))
    .filter((d): d is Omit<SyncDay, "memberId"> => !!d);
}
