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
