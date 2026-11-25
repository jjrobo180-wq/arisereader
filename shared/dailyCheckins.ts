// Daily check-ins: the things a person's plugins ask of them each day (log breakfast, lunch and dinner, train,
// drink water, weigh in, take each medicine, do each habit and routine, finish what an accountability partner
// asked for), shown as rows in LifeHub's task list next to the to-dos. Each row knows whether it's done from
// the plugin itself (a meal logged in Cooked ticks "Breakfast"), and doing it from the list writes to the plugin
// (logging a meal from the list adds it to Cooked's diary), so the two never disagree.
//
// Everything here is plain logic over the plugins' data (shared/fit.ts for Cooked, shared/familyHub.ts for
// habits, routines and pills, shared/accountability.ts), so it's the same on the website, the phone and in tests.
// The rows are drawn by client/src/components/daily/DailyCheckins.tsx. Settings: shared/dailySettings.ts.

import type { FitData, FoodEntry, Meal as FitMeal } from "./fit";
import { dosesOn as medDosesOn, markDose as markMedDose } from "./fitMeds";
import { choreDueOn, choreOwner, toggleChore, type Family } from "./familyHub";
import { dosesOn as pillDosesOn, markDose as markPillDose } from "./pills";
import type { AcctTask, Checkin as AcctCheckin } from "./accountability";
import { checkinFor, dueOn, isDone } from "./accountability";
import { emptyDaily, type CustomCheckin, type DailySettings } from "./dailySettings";

export type CheckinKind = "meal" | "workout" | "water" | "weight" | "sleep" | "fast" | "med" | "pill" | "habit" | "routine" | "acct" | "chore" | "custom";
export type CheckinSource = "cooked" | "habits" | "routines" | "pills" | "accountability" | "chores" | "mine" | "family";
export const SOURCE_NAMES: Record<CheckinSource, string> = { cooked: "Cooked", habits: "Habits", routines: "Routines", pills: "Pills", accountability: "Accountability", chores: "Chores", mine: "Check-in", family: "Family" };

export type Checkin = {
  id: string;
  kind: CheckinKind;
  source: CheckinSource;
  title: string;
  /** One line under the title: what's been done so far, or what to do. */
  detail: string;
  /** "HH:MM" when it has a time (its plugin's, or one picked in settings). */
  time: string;
  done: boolean;
  /** Ticked by hand (not logged in the plugin), so unticking takes the hand tick off. */
  byHand: boolean;
  /** For counts like water: where it is out of where it's going. */
  progress?: { now: number; goal: number; unit: string };
  meal?: FitMeal;
  /** The plugin's own id for the thing (a habit, routine, medicine or pill id; an accountability task id). */
  ref?: string;
  /** A medicine or pill dose's time slot. */
  slot?: string;
  /** Accountability: can be checked off right here (no photo, worksheet or quiz needed). */
  quick?: boolean;
  /** Who did it (a FamilyHub check-in or chore), when known. */
  by?: string;
  /** Where it's tracked in full: a LifeHub section and, for Cooked, the Cooked app inside it. */
  open: { section: string; app?: string; acctTask?: string };
  /** Hidden in settings: kept so the settings screen can list it. */
  hidden: boolean;
  /** Sends a reminder at its time. */
  reminds: boolean;
};

export type AcctInput = { me: number; tasks: AcctTask[]; checkins: AcctCheckin[]; names?: Record<number, string> };
export type CheckinInput = {
  date: string;
  settings?: DailySettings;
  /** Cooked's data, when Cooked is added. */
  fit?: FitData | null;
  /** LifeHub's data: habits, routines and pills are read when their plugins are on (`on`). */
  family?: (Pick<Family, "habits" | "routines" | "pills" | "pillDoses" | "members" | "notify"> & Partial<Pick<Family, "chores" | "choreDone">>) | null;
  on?: Partial<Record<"habits" | "routines" | "pills" | "chores", boolean>>;
  acct?: AcctInput | null;
  /** FamilyHub: the check-ins are the family's, shared by everyone in it. */
  shared?: boolean;
};

const MEALS: { meal: FitMeal; title: string; notify: "breakfast" | "lunch" | "dinner" | "snacks"; extra?: boolean }[] = [
  { meal: "breakfast", title: "Breakfast", notify: "breakfast" },
  { meal: "lunch", title: "Lunch", notify: "lunch" },
  { meal: "dinner", title: "Dinner", notify: "dinner" },
  { meal: "snack", title: "Snack", notify: "snacks", extra: true },
];
/** Times used when nothing else says (LifeHub's notification settings usually do). */
export const DEFAULT_TIMES = { breakfast: "08:00", lunch: "12:30", dinner: "18:30", snack: "15:30", workout: "17:30", weight: "07:30", sleep: "07:00" } as const;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localDay = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : keyOf(d); };
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return keyOf(d); };
const dow = (date: string) => new Date(`${date}T12:00:00`).getDay();
const isWorkout = (w: FitData["workouts"][number]) => w.programId !== "session-meditation";
export const clock12 = (hm: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); if (!m) return ""; const h = Number(m[1]); return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`; };

/** The check-ins for a day, in time order (ones without a time last). Hidden ones are included with `hidden`. */
export function buildCheckins(input: CheckinInput): Checkin[] {
  const s = input.settings ?? emptyDaily();
  const { date } = input;
  const out: Checkin[] = [];
  const off = new Set(s.off), extra = new Set(s.extra), mute = new Set(s.mute);
  const timeOf = (id: string, fallback: string) => s.times[id] || fallback;
  const push = (c: Omit<Checkin, "hidden" | "reminds">) => out.push({ ...c, hidden: off.has(c.id), reminds: s.remind && !!c.time && !mute.has(c.id) && c.kind !== "acct" && c.kind !== "water" });
  const notifyTimes = input.family?.notify?.meals?.times;

  const fit = input.fit;
  if (fit) {
    const hand = new Set(fit.checks?.[date] ?? []);
    const foods = fit.foods.filter((f) => f.date === date);
    for (const m of MEALS) {
      const id = `cooked:${m.meal}`;
      if (m.extra && !extra.has(id) && !foods.some((f) => f.meal === m.meal)) continue;
      const mine = foods.filter((f) => f.meal === m.meal);
      const kcal = mine.reduce((n, f) => n + f.kcal * f.servings, 0);
      const byHand = !mine.length && hand.has(m.meal);
      push({ id, kind: "meal", source: "cooked", meal: m.meal, title: m.title, time: timeOf(id, notifyTimes?.[m.notify] || DEFAULT_TIMES[m.meal]),
        detail: mine.length ? `${mine.map((f) => f.name).slice(0, 3).join(", ")}${mine.length > 3 ? ` + ${mine.length - 3} more` : ""} · ${fmt(kcal)} cal` : byHand ? "Ticked off, not logged" : "Not logged yet",
        done: mine.length > 0 || byHand, byHand, open: { section: "cooked", app: "food" } });
    }

    const workouts = fit.workouts.filter((w) => isWorkout(w) && localDay(w.date) === date);
    const runs = (fit.runs ?? []).filter((r) => localDay(r.date) === date);
    const moved = workouts.length + runs.length;
    const restDay = !moved && hand.has("workout");
    const mins = Math.round((workouts.reduce((n, w) => n + w.secs, 0) + runs.reduce((n, r) => n + r.secs, 0)) / 60);
    const wid = "cooked:workout";
    push({ id: wid, kind: "workout", source: "cooked", title: "Workout", time: timeOf(wid, input.family?.notify?.workout?.time || DEFAULT_TIMES.workout),
      detail: moved ? `${[...workouts.map((w) => w.name), ...runs.map((r) => r.kind === "walk" ? "Walk" : r.kind === "hike" ? "Hike" : "Run")].slice(0, 2).join(", ")}${mins ? ` · ${mins} min` : ""}` : restDay ? "Rest day" : "Log a workout, or tick it for a rest day",
      done: moved > 0 || restDay, byHand: restDay, open: { section: "cooked", app: "train" } });

    const water = fit.water[date] ?? 0, goal = fit.profile.waterGoalMl || 2500;
    push({ id: "cooked:water", kind: "water", source: "cooked", title: "Water", time: s.times["cooked:water"] || "",
      detail: `${fmt(water)} of ${fmt(goal)} ml`, progress: { now: water, goal, unit: "ml" },
      done: water >= goal || hand.has("water"), byHand: water < goal && hand.has("water"), open: { section: "cooked", app: "water" } });

    const wtId = "cooked:weight";
    const weighedToday = fit.weights.find((w) => w.date === date);
    if (fit.profile.goalKg || extra.has(wtId) || weighedToday) {
      const lb = fit.profile.units === "lb";
      push({ id: wtId, kind: "weight", source: "cooked", title: "Weigh in", time: timeOf(wtId, input.family?.notify?.weighIn?.time || DEFAULT_TIMES.weight),
        detail: weighedToday ? `${lb ? Math.round(weighedToday.kg * 2.20462 * 10) / 10 : weighedToday.kg} ${lb ? "lb" : "kg"}` : "Not weighed in today",
        done: !!weighedToday || hand.has("weight"), byHand: !weighedToday && hand.has("weight"), open: { section: "cooked", app: "food" } });
    }

    const slId = "cooked:sleep";
    if (fit.sleep || extra.has(slId)) {
      const night = fit.sleep?.nights.find((n) => n.date === date);
      const hrs = night ? Math.round(((night.asleepMin ?? (night.wake - night.bed) / 60_000) / 60) * 10) / 10 : 0;
      push({ id: slId, kind: "sleep", source: "cooked", title: "Log last night's sleep", time: timeOf(slId, DEFAULT_TIMES.sleep),
        detail: night ? `${hrs} hours` : "Not logged yet", done: !!night || hand.has("sleep"), byHand: !night && hand.has("sleep"), open: { section: "cooked", app: "sleep" } });
    }

    if (fit.fasting && (fit.fasting.start || fit.fasting.log.length)) {
      const finished = (fit.fasting.log ?? []).some((f) => localDay(f.end) === date && new Date(f.end).getTime() - new Date(f.start).getTime() >= f.goalH * 3_600_000 - 60_000);
      push({ id: "cooked:fast", kind: "fast", source: "cooked", title: "Finish your fast", time: s.times["cooked:fast"] || "",
        detail: finished ? "Fast completed" : fit.fasting.start ? "Fast in progress" : "No fast logged", done: finished || hand.has("fast"), byHand: !finished && hand.has("fast"), open: { section: "cooked", app: "fast" } });
    }

    for (const dose of medDosesOn(fit.meds, date)) {
      const id = `cooked:med:${dose.med.id}@${dose.time}`;
      push({ id, kind: "med", source: "cooked", title: dose.med.name, ref: dose.med.id, slot: dose.time, time: dose.time,
        detail: dose.status === "skipped" ? "Skipped" : dose.status === "taken" ? `Taken${dose.med.dose ? ` · ${dose.med.dose}` : ""}` : dose.med.dose || "Medicine",
        done: !!dose.status, byHand: false, open: { section: "cooked", app: "meds" } });
    }
  }

  const fam = input.family;
  if (fam && input.on?.pills) {
    const nameOf = (id: string) => fam.members.find((m) => m.id === id)?.name || "";
    for (const dose of pillDosesOn(fam, date)) {
      const id = `pill:${dose.pill.id}@${dose.time}`;
      const who = nameOf(dose.pill.memberId);
      push({ id, kind: "pill", source: "pills", title: dose.pill.name, ref: dose.pill.id, slot: dose.time, time: dose.time,
        detail: [dose.status === "skipped" ? "Skipped" : dose.status === "taken" ? "Taken" : dose.pill.dose, who ? `for ${who}` : ""].filter(Boolean).join(" · ") || "Dose",
        done: !!dose.status, byHand: false, open: { section: "pills" } });
    }
  }
  if (fam && input.on?.habits) {
    for (const h of fam.habits) {
      const id = `habit:${h.id}`;
      let streak = 0;
      for (let i = h.days.includes(date) ? 0 : 1; i < 400 && h.days.includes(addDays(date, -i)); i++) streak++;
      push({ id, kind: "habit", source: "habits", title: h.name, ref: h.id, time: s.times[id] || "",
        detail: streak > 1 ? `${streak} days in a row` : h.days.includes(date) ? "Done today" : "Habit", done: h.days.includes(date), byHand: false, open: { section: "habits" } });
    }
  }
  if (fam && input.on?.routines) {
    for (const r of fam.routines) {
      const id = `routine:${r.id}`;
      const doneSteps = r.doneDate === date ? r.doneSteps.filter((x) => r.steps.some((st) => st.id === x)) : [];
      const done = r.doneDate === date && (r.steps.length === 0 || doneSteps.length >= r.steps.length);
      push({ id, kind: "routine", source: "routines", title: r.name, ref: r.id, time: s.times[id] || "",
        detail: r.steps.length ? `${doneSteps.length} of ${r.steps.length} steps` : "Routine", progress: r.steps.length ? { now: doneSteps.length, goal: r.steps.length, unit: "steps" } : undefined,
        done, byHand: false, open: { section: "routines" } });
    }
  }

  if (fam && input.on?.chores && fam.chores) {
    const nameOf = (id: string) => fam.members.find((m) => m.id === id)?.name || "";
    for (const ch of fam.chores) {
      if (!choreDueOn(ch, date)) continue;
      const id = `chore:${ch.id}`;
      const doneRow = (fam.choreDone ?? []).find((x) => x.choreId === ch.id && x.date === date);
      const owner = nameOf(doneRow?.memberId || choreOwner(ch, date));
      push({ id, kind: "chore", source: "chores", title: ch.title, ref: ch.id, time: s.times[id] || "",
        detail: doneRow ? `Done${owner ? ` by ${owner}` : ""}${ch.points ? ` · +${ch.points}` : ""}` : [owner ? `${owner}'s turn` : "", ch.points ? `${ch.points} points` : ""].filter(Boolean).join(" · ") || "Chore",
        done: !!doneRow, byHand: false, by: doneRow ? owner : undefined, open: { section: "chores" } });
    }
  }

  // Check-ins made by hand: in FamilyHub, the family's, ticked by anyone (and it says who).
  const today = dow(date);
  for (const c of s.custom) {
    if (!c.days.includes(today)) continue;
    const id = `custom:${c.id}`;
    const ticked = s.log[date]?.[c.id];
    const done = ticked !== undefined;
    push({ id, kind: "custom", source: input.shared ? "family" : "mine", title: c.title, ref: c.id, time: c.time,
      detail: done ? (ticked ? `Done by ${ticked}` : "Done") : [daysWords(c.days), input.shared && c.by ? `added by ${c.by}` : ""].filter(Boolean).join(" · "),
      done, byHand: false, by: ticked || undefined, open: { section: "tasks" } });
  }

  const acct = input.acct;
  if (acct) {
    for (const t of acct.tasks) {
      if (t.assignee !== acct.me || !dueOn(t, date)) continue;
      const c = checkinFor(acct.checkins, t.id, date);
      const done = isDone(c);
      const asker = t.createdBy !== acct.me ? acct.names?.[t.createdBy] : "";
      const id = `acct:${t.id}`;
      push({ id, kind: "acct", source: "accountability", title: t.title, ref: t.id, time: t.due && t.due !== "23:59" ? t.due : "",
        detail: done ? (c?.status === "done" ? "Done · waiting for a look" : "Done") : c?.status === "redo" ? "Asked to redo it" : [asker ? `Asked by ${asker}` : "", t.proof !== "none" ? (t.proof === "video" ? "needs a video" : "needs a photo") : t.kind !== "task" ? `a ${t.kind}` : ""].filter(Boolean).join(" · ") || "Accountability",
        done, byHand: false, quick: t.kind === "task" && t.proof === "none", open: { section: "accountability", acctTask: t.id } });
    }
  }

  return out.sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || a.time.localeCompare(b.time));
}

/** The check-ins shown in the list (not hidden), with the counts the Tasks header uses. */
export function shownCheckins(all: Checkin[], settings?: DailySettings): { items: Checkin[]; done: number; total: number } {
  if (settings && !settings.on) return { items: [], done: 0, total: 0 };
  const items = all.filter((c) => !c.hidden);
  return { items, done: items.filter((c) => c.done).length, total: items.length };
}

/* ---------------- doing a check-in: each writes to the plugin, exactly as the plugin would ---------------- */

const uidNow = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
/** The ids Cooked's hand ticks use (shared/fitChecklist.ts keeps them short). */
const handId = (c: Checkin) => (c.kind === "meal" ? c.meal! : c.kind === "workout" ? "workout" : c.kind === "water" ? "water" : c.kind === "weight" ? "weight" : c.kind === "sleep" ? "sleep" : c.kind === "fast" ? "fast" : "");
function setHand(fit: FitData, date: string, id: string, on: boolean): FitData {
  if (!id) return fit;
  const mine = new Set(fit.checks?.[date] ?? []);
  if (on) mine.add(id); else mine.delete(id);
  const checks = { ...(fit.checks ?? {}) };
  if (mine.size) checks[date] = [...mine].slice(0, 12); else delete checks[date];
  return { ...fit, checks };
}

export type FoodIn = { name: string; kcal: number; p?: number; c?: number; f?: number; serving?: string; servings?: number };
/** Adds foods to a meal in Cooked's diary (and takes off a hand tick, since now it's really logged). */
export function logMeal(fit: FitData, date: string, meal: FitMeal, foods: FoodIn[], makeId: () => string = uidNow): FitData {
  const add: FoodEntry[] = foods.filter((f) => f.name.trim()).slice(0, 20).map((f) => ({
    id: makeId(), date, meal, name: f.name.trim().slice(0, 120), kcal: Math.max(0, Math.round(f.kcal || 0)), p: Math.max(0, f.p || 0), c: Math.max(0, f.c || 0), f: Math.max(0, f.f || 0),
    servings: f.servings && f.servings > 0 ? f.servings : 1, ...(f.serving ? { serving: f.serving.slice(0, 60) } : {}),
  }));
  if (!add.length) return fit;
  const recent = [...add.map(({ id: _i, date: _d, meal: _m, ...rest }) => rest), ...fit.recentFoods.filter((r) => !add.some((a) => a.name.toLowerCase() === r.name.toLowerCase()))].slice(0, 60);
  return setHand({ ...fit, foods: [...fit.foods, ...add], recentFoods: recent }, date, meal, false);
}
/** Takes one food back off the diary. */
export const removeFood = (fit: FitData, foodId: string): FitData => ({ ...fit, foods: fit.foods.filter((f) => f.id !== foodId) });

export const WORKOUT_TYPES = ["Walk", "Run", "Gym", "Bike", "Yoga", "Swim", "Sport", "Stretch", "Other"] as const;
/** Logs a quick workout (a name and minutes) the way Cooked keeps a timed session. `at` is when it was done. */
export function logWorkout(fit: FitData, name: string, minutes: number, at: Date = new Date(), makeId: () => string = uidNow): FitData {
  const secs = Math.max(60, Math.min(600, Math.round(minutes || 0)) * 60);
  const w = { id: makeId(), date: at.toISOString(), name: (name.trim() || "Workout").slice(0, 60), programId: "session-quick", secs, exercises: [] };
  return setHand({ ...fit, workouts: [...fit.workouts, w] }, keyOf(at), "workout", false);
}
/** Adds water for the day, in ml (a negative amount takes some off, never below zero). */
export const addWater = (fit: FitData, date: string, ml: number): FitData => ({ ...fit, water: { ...fit.water, [date]: Math.max(0, Math.min(20000, (fit.water[date] ?? 0) + Math.round(ml))) } });
/** Logs today's weight, given in the person's own units. */
export function logWeight(fit: FitData, date: string, value: number): FitData {
  if (!(value > 0)) return fit;
  const kg = fit.profile.units === "lb" ? Math.round((value / 2.20462) * 10) / 10 : Math.round(value * 10) / 10;
  if (kg < 20 || kg > 400) return fit;
  return setHand({ ...fit, weights: [...fit.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)) }, date, "weight", false);
}
/** A medicine dose taken, skipped or cleared (supply counts down as Cooked's own screen does). */
export const markMed = (fit: FitData, c: Checkin, date: string, status: "taken" | "skipped" | null): FitData => ({ ...fit, meds: markMedDose(fit.meds, c.ref!, date, c.slot!, status) });
/** Ticks or unticks a Cooked check-in by hand ("I ate but didn't log it", a rest day, water drunk elsewhere). */
export const tickCooked = (fit: FitData, c: Checkin, date: string, on: boolean): FitData => setHand(fit, date, handId(c), on);

/** A habit done (or not) today. */
export const markHabit = <F extends Pick<Family, "habits">>(f: F, habitId: string, date: string, on: boolean): F =>
  ({ ...f, habits: f.habits.map((h) => (h.id !== habitId ? h : { ...h, days: on ? [...new Set([...h.days, date])] : h.days.filter((d) => d !== date) })) });
/** A routine finished (every step) or cleared for today; or one step ticked. */
export function markRoutine<F extends Pick<Family, "routines">>(f: F, routineId: string, date: string, on: boolean, stepId?: string): F {
  return { ...f, routines: f.routines.map((r) => {
    if (r.id !== routineId) return r;
    const today = r.doneDate === date ? r.doneSteps : [];
    if (stepId) return { ...r, doneDate: date, doneSteps: on ? [...new Set([...today, stepId])] : today.filter((x) => x !== stepId) };
    return { ...r, doneDate: on ? date : r.doneDate === date ? "" : r.doneDate, doneSteps: on ? r.steps.map((st) => st.id) : r.doneDate === date ? [] : r.doneSteps };
  }) };
}
/** A pill dose taken, skipped or cleared. */
export const markPill = <F extends Pick<Family, "pills" | "pillDoses">>(f: F, c: Checkin, date: string, status: "taken" | "skipped" | null, at: string): F => markPillDose(f, c.ref!, date, c.slot!, status, at);

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Every day", "Weekdays", "Weekends", or the days. */
export function daysWords(days: number[]): string {
  const d = [...days].sort().join(",");
  return d === "0,1,2,3,4,5,6" ? "Every day" : d === "1,2,3,4,5" ? "Weekdays" : d === "0,6" ? "Weekends" : [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => DAY_SHORT[x]).join(", ");
}

/** A chore done or undone for today (its owner gets the points, as on the Chores screen). */
export const markChore = (f: Family, choreId: string, date: string, makeId: () => string = uidNow): Family => {
  const ch = f.chores.find((x) => x.id === choreId);
  return ch ? toggleChore(f, ch, date, makeId) : f;
};

/** A hand-made check-in ticked (by someone, in FamilyHub) or unticked for a day. Old days are let go after 60. */
export function tickCustom(s: DailySettings, customId: string, date: string, on: boolean, by = ""): DailySettings {
  const row = { ...(s.log[date] ?? {}) };
  if (on) row[customId] = by.slice(0, 60); else delete row[customId];
  const log = { ...s.log, [date]: row };
  if (!Object.keys(row).length) delete log[date];
  const keep = Object.keys(log).sort().slice(-60);
  return { ...s, log: Object.fromEntries(keep.map((k) => [k, log[k]])) };
}
/** Adds a hand-made check-in (or changes one, when `id` is one already there). */
export function saveCustom(s: DailySettings, c: { id?: string; title: string; time: string; days: number[] }, by = "", makeId: () => string = uidNow): DailySettings {
  const title = c.title.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!title) return s;
  const days = c.days.length ? [...new Set(c.days)].sort() : [0, 1, 2, 3, 4, 5, 6];
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(c.time) ? c.time : "";
  if (c.id && s.custom.some((x) => x.id === c.id)) return { ...s, custom: s.custom.map((x) => (x.id === c.id ? { ...x, title, time, days } : x)) };
  const made: CustomCheckin = { id: makeId().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || uidNow(), title, time, days, by: by.slice(0, 60) };
  return { ...s, custom: [...s.custom, made].slice(0, 60) };
}
/** Removes a hand-made check-in (and its ticks). */
export function removeCustom(s: DailySettings, id: string): DailySettings {
  const log: Record<string, Record<string, string>> = {};
  for (const [day, row] of Object.entries(s.log)) { const { [id]: _gone, ...rest } = row; if (Object.keys(rest).length) log[day] = rest; }
  return { ...s, custom: s.custom.filter((x) => x.id !== id), log, off: s.off.filter((x) => x !== `custom:${id}`), mute: s.mute.filter((x) => x !== `custom:${id}`) };
}

/* ---------------- reminders (shared/todoReminders.ts sends them; the phone writes `done`) ---------------- */

/** Today's done list to keep in the settings, so reminders skip what's already done. Unchanged when nothing changed. */
export function withDone(settings: DailySettings | undefined, date: string, all: Checkin[]): DailySettings {
  const s = settings ?? emptyDaily();
  const ids = all.filter((c) => c.done).map((c) => c.id).sort();
  if (s.done && s.done.date === date && s.done.ids.length === ids.length && s.done.ids.every((x, i) => x === ids[i])) return s;
  return { ...s, done: { date, ids } };
}

export type DailyReminder = { id: string; title: string; body: string; time: string; section: string };
/** The check-in reminders for a day that can be known without the plugins' data: Cooked's meals, workout,
 *  weigh-in and sleep (when Cooked is on), and habits and routines given a time. Medicines and pills remind
 *  through their own plugins, and accountability through its own nudges. */
export function dailyReminderPlan(input: { settings?: DailySettings; cooked: boolean; family: Pick<Family, "habits" | "routines" | "notify">; habits: boolean; routines: boolean }, date: string): DailyReminder[] {
  const s = input.settings ?? emptyDaily();
  if (!s.on || !s.remind) return [];
  const off = new Set([...s.off, ...s.mute]);
  const done = s.done?.date === date ? new Set(s.done.ids) : new Set<string>();
  const out: DailyReminder[] = [];
  const add = (r: DailyReminder) => { if (r.time && !off.has(r.id) && !done.has(r.id)) out.push(r); };
  if (input.cooked) {
    const t = input.family.notify?.meals?.times;
    for (const m of MEALS) {
      const id = `cooked:${m.meal}`;
      if (m.extra && !s.extra.includes(id)) continue;
      add({ id, title: `Log your ${m.title.toLowerCase()}`, body: "Tap to log it right from your list.", time: s.times[id] || t?.[m.notify] || DEFAULT_TIMES[m.meal], section: "tasks" });
    }
    add({ id: "cooked:workout", title: "Time to move", body: "Log a workout, or tick it off for a rest day.", time: s.times["cooked:workout"] || input.family.notify?.workout?.time || DEFAULT_TIMES.workout, section: "tasks" });
    if (s.extra.includes("cooked:weight") || s.times["cooked:weight"]) add({ id: "cooked:weight", title: "Weigh in", body: "Log today's weight from your list.", time: s.times["cooked:weight"] || DEFAULT_TIMES.weight, section: "tasks" });
    if (s.extra.includes("cooked:sleep") || s.times["cooked:sleep"]) add({ id: "cooked:sleep", title: "How did you sleep?", body: "Log last night's sleep.", time: s.times["cooked:sleep"] || DEFAULT_TIMES.sleep, section: "tasks" });
  }
  if (input.habits) for (const h of input.family.habits) if (s.times[`habit:${h.id}`] && !h.days.includes(date)) add({ id: `habit:${h.id}`, title: h.name, body: "Tick it off when it's done.", time: s.times[`habit:${h.id}`], section: "tasks" });
  for (const c of s.custom) if (c.time && c.days.includes(dow(date)) && s.log[date]?.[c.id] === undefined) add({ id: `custom:${c.id}`, title: c.title, body: "Tick it off in your list when it's done.", time: c.time, section: "tasks" });
  if (input.routines) for (const r of input.family.routines) if (s.times[`routine:${r.id}`] && r.doneDate !== date) add({ id: `routine:${r.id}`, title: r.name, body: r.steps.length ? `${r.steps.length} steps. Tap to start.` : "Tap to start.", time: s.times[`routine:${r.id}`], section: "tasks" });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** Days of the week, Sunday first, for "every day" style wording. */
export const weekdayOf = dow;
export { addDays as dailyAddDays, keyOf as dailyDayKey };
