// What the Arise Fit widgets show (client/src/lib/widgets.ts sends it to the iPhone): a simple and a detailed
// widget for each slot below. Pure, so it's tested.
import { CATALOG_BY_ID, PROGRAM_BY_ID, fromKg, goals, nextProgramDay, streak, type FitData } from "@shared/fit";
import { fastingStatus } from "@shared/fitNutrition";
import { dayGoals, vacationPhase } from "@shared/fitVacation";
import { dayKey } from "@shared/fit";
import type { WidgetSlot, WidgetTap } from "./widgets";

// The widgets themselves (ids and names) are listed in widgets.json next to the app's iOS project; the build reads it.

type Foods = { kcal: number; p: number; c: number; f: number };
const sumFoods = (data: FitData, date: string): Foods => data.foods.filter((f) => f.date === date).reduce((t, f) => ({ kcal: t.kcal + f.kcal * f.servings, p: t.p + f.p * f.servings, c: t.c + f.c * f.servings, f: t.f + f.f * f.servings }), { kcal: 0, p: 0, c: 0, f: 0 });
const OZ = 29.5735;

export function fitWidgetSlots(data: FitData, kg: number | undefined, now = Date.now()): WidgetSlot[] {
  const d = new Date(now), today = dayKey(d);
  const t = sumFoods(data, today), g = dayGoals(data, kg, d), base = goals(data.profile, kg, d);
  const weekAgo = now - 7 * 864e5;
  const week = data.workouts.filter((w) => Date.parse(w.date) >= weekAgo);
  const s = streak(data, d);
  const oz = data.profile.units === "lb";
  const waterMl = data.water[today] ?? 0, waterGoal = data.profile.waterGoalMl;
  const waterNow = oz ? waterMl / OZ : waterMl, waterOf = oz ? waterGoal / OZ : waterGoal;
  const left = Math.round(g.kcal - t.kcal);
  const slots: WidgetSlot[] = [];

  slots.push({ id: "fit.calories", title: "Calories left", value: left >= 0 ? String(left) : `${-left} over`, detail: `${Math.round(t.kcal)} of ${g.kcal} eaten`, tint: "#ff5a1f", progress: g.kcal ? t.kcal / g.kcal : 0,
    lines: [`Protein ${Math.round(t.p)} / ${g.p} g`, `Carbs ${Math.round(t.c)} / ${g.c} g`, `Fat ${Math.round(t.f)} / ${g.f} g`, g.note || `Maintenance about ${base.tdee}`].filter(Boolean) });
  slots.push({ id: "fit.water", title: "Water", value: `${Math.round(waterNow)} ${oz ? "oz" : "ml"}`, detail: `Goal ${Math.round(waterOf)} ${oz ? "oz" : "ml"}`, tint: "#3b82f6", progress: waterGoal ? waterMl / waterGoal : 0,
    current: Math.round(waterNow), goal: Math.round(waterOf), unit: oz ? "oz" : "ml",
    actions: oz ? [{ label: "+8 oz", action: "water-oz", amount: 8 }, { label: "+16 oz", action: "water-oz", amount: 16 }] : [{ label: "+250 ml", action: "water-ml", amount: 250 }, { label: "+500 ml", action: "water-ml", amount: 500 }] });
  slots.push({ id: "fit.workouts", title: "Workouts this week", value: String(week.length), detail: s ? `${s} day streak` : "Start a streak today", tint: "#22c55e",
    lines: week.slice(-5).reverse().map((w) => `${w.name} · ${Math.max(1, Math.round(w.secs / 60))} min`) });
  slots.push({ id: "fit.protein", title: "Protein", value: `${Math.round(t.p)} g`, detail: `Goal ${g.p} g`, tint: "#3b82f6", progress: g.p ? t.p / g.p : 0, lines: [`${Math.max(0, g.p - Math.round(t.p))} g to go`, `${Math.round(t.kcal)} calories so far`] });
  slots.push({ id: "fit.streak", title: "Streak", value: `${s} day${s === 1 ? "" : "s"}`, detail: s ? "Keep it going" : "Log food or a workout", tint: "#f59e0b", lines: [`${week.length} workouts in 7 days`, `${data.foods.filter((f) => f.date === today).length} foods logged today`] });
  const ws = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = ws[ws.length - 1], first30 = ws.find((w) => Date.parse(w.date) >= now - 30 * 864e5);
  const wUnit = oz ? "lb" : "kg", conv = (k: number) => Math.round(fromKg(k, data.profile.units) * 10) / 10;
  slots.push({ id: "fit.weight", title: "Weight", value: last ? `${conv(last.kg)} ${wUnit}` : "No weigh-in", detail: last && first30 && first30 !== last ? `${conv(last.kg - first30.kg) > 0 ? "+" : ""}${conv(last.kg - first30.kg)} ${wUnit} in 30 days` : "Weigh in to see change", tint: "#a855f7",
    lines: ws.slice(-5).reverse().map((w) => `${w.date.slice(5)}  ${conv(w.kg)} ${wUnit}`) });
  const fast = fastingStatus(data.fasting, now);
  slots.push({ id: "fit.fast", title: "Fasting", value: fast.active ? (fast.done ? "Done" : `${Math.floor(fast.elapsedMs / 36e5)}h ${Math.floor(fast.elapsedMs / 6e4) % 60}m`) : "Not fasting", detail: fast.active ? (fast.done ? "Goal reached" : "Ends soon") : `${fast.goalH}h plan`, tint: "#14b8a6", progress: fast.active ? fast.pct : 0, until: fast.active && !fast.done ? fast.endsAt : undefined });
  const prog = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined;
  const next = prog && data.program ? nextProgramDay(prog, data.program.done) : null;
  slots.push({ id: "fit.next", title: "Next workout", value: next ? next.day.name.slice(0, 18) : "Rest day", detail: next && prog ? `${prog.name} · week ${next.week}` : "Pick a program in the app", tint: "#ef4444",
    lines: next ? next.day.items.slice(0, 8).map((i) => `${CATALOG_BY_ID.get(i.exId)?.name ?? i.exId} · ${i.sets}x${i.reps}`) : [] });
  slots.push({ id: "fit.macros", title: "Macros", value: `${Math.round(t.p)}P ${Math.round(t.c)}C ${Math.round(t.f)}F`, detail: `Goals ${g.p}P ${g.c}C ${g.f}F`, tint: "#06b6d4", progress: g.kcal ? t.kcal / g.kcal : 0, lines: [`Protein ${Math.round(t.p)} of ${g.p} g`, `Carbs ${Math.round(t.c)} of ${g.c} g`, `Fat ${Math.round(t.f)} of ${g.f} g`] });
  const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(now - (6 - i) * 864e5); const k = dayKey(x); return { k, cal: Math.round(sumFoods(data, k).kcal), label: x.toLocaleDateString(undefined, { weekday: "short" }) }; });
  const avg = Math.round(days.reduce((a, x) => a + x.cal, 0) / 7);
  slots.push({ id: "fit.week", title: "Week of eating", value: `${avg}`, detail: "Average calories a day", tint: "#f97316", lines: days.slice().reverse().map((x) => `${x.label}  ${x.cal} cal`) });
  const lw = data.workouts[data.workouts.length - 1];
  slots.push({ id: "fit.last", title: "Last workout", value: lw ? lw.name.slice(0, 16) : "None yet", detail: lw ? `${Math.max(1, Math.round(lw.secs / 60))} min · ${lw.date.slice(5, 10)}` : "Start one in the app", tint: "#84cc16",
    lines: lw ? lw.exercises.slice(0, 8).map((e) => `${e.name} · ${e.sets.length} sets`) : [] });
  const ph = vacationPhase(data.vacation, today);
  const trip = data.vacation;
  slots.push({ id: "fit.trip", title: "Vacation", value: !trip ? "None planned" : ph.phase === "before" ? `${ph.n} days` : ph.phase === "during" ? `Day ${ph.n}` : ph.phase === "after" ? "Back home" : `${Math.max(0, Math.round((Date.parse(trip.start) - now) / 864e5))} days`,
    detail: trip ? `${trip.place || "Trip"} · ${trip.start.slice(5)}` : "Plan one in Fit", tint: "#0ea5e9", lines: trip ? [`${trip.start} to ${trip.end}`, `${trip.mins} min workouts`] : [] });
  return slots;
}

/** Applies taps from a widget (a glass of water) to the data. */
export function applyFitTaps(data: FitData, taps: WidgetTap[], now = Date.now()): FitData {
  let water = { ...data.water };
  for (const tap of taps) {
    if (tap.action !== "water-oz" && tap.action !== "water-ml") continue;
    const ml = tap.action === "water-oz" ? tap.amount * OZ : tap.amount;
    const k = dayKey(new Date(tap.at || now));
    water = { ...water, [k]: Math.max(0, Math.min(20000, Math.round((water[k] ?? 0) + ml))) };
  }
  return water === data.water ? data : { ...data, water };
}

/** What was done on the Apple Watch (native/fit-watch): a glass of water ({ type: "tap", action, amount })
 *  or a workout tracked there ({ type: "workout", id, name, secs, kcal, bpm, start }). A workout already
 *  in the log (sent twice) is skipped. */
export function applyWatchActions(data: FitData, actions: { type: string; at: number; [k: string]: unknown }[], now = Date.now()): FitData {
  const taps = actions.filter((a) => a.type === "tap" && typeof a.action === "string").map((a) => ({ id: "fit.water", action: String(a.action), amount: Number(a.amount) || 0, at: a.at || now }));
  let next = taps.length ? applyFitTaps(data, taps, now) : data;
  for (const a of actions) {
    if (a.type !== "workout") continue;
    const id = typeof a.id === "string" && /^[\w-]{4,40}$/.test(a.id) ? a.id : `watch-${a.at}`;
    if (next.workouts.some((w) => w.id === id)) continue;
    const secs = Math.max(0, Math.min(86400, Math.round(Number(a.secs) || 0)));
    if (secs < 30) continue;
    const start = typeof a.start === "string" && !Number.isNaN(Date.parse(a.start)) ? a.start : new Date((a.at || now) - secs * 1000).toISOString();
    const kcal = Math.round(Number(a.kcal) || 0), bpm = Math.round(Number(a.bpm) || 0);
    const note = ["From Apple Watch", kcal ? `${kcal} active cal` : "", bpm ? `avg ${bpm} bpm` : ""].filter(Boolean).join(" · ");
    next = { ...next, workouts: [...next.workouts, { id, date: start, name: String(a.name || "Workout").slice(0, 80), secs, exercises: [], note }] };
  }
  return next;
}
