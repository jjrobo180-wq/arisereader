// Arise LifeHub: which phone notifications someone wants, when, and how many of each.
// Saved with the family workspace (so it follows the account to every device) and read by the
// server's reminder pass in shared/todoReminders.ts.
import type { Meal } from "./familyHub";

export type Clock = string; // "HH:MM", 24-hour
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday = 0

export type NotifyPrefs = {
  /** Whose food & fitness diary the health reminders follow ("" = the first adult, or "me"). */
  memberId: string;
  quiet: { on: boolean; from: Clock; until: Clock };
  morning: { on: boolean; time: Clock };
  headsUp: { on: boolean; minutes: number };
  bills: { on: boolean };
  evening: { on: boolean; time: Clock };
  water: { on: boolean; perDay: number; from: Clock; until: Clock; skipWhenMet: boolean };
  meals: { on: boolean; times: Record<Meal, Clock>; which: Meal[]; skipIfLogged: boolean };
  workout: { on: boolean; time: Clock; days: Weekday[]; skipIfLogged: boolean };
  weighIn: { on: boolean; time: Clock; days: Weekday[] };
  news: { on: boolean; perDay: number; from: Clock; until: Clock; topic: string };
  mood: { on: boolean; time: Clock };
};

export const HEADS_UP_CHOICES = [5, 10, 15, 30, 60];
export const WATER_MAX = 16;
export const NEWS_MAX = 6;

/** Out of the box: the reminders the LifeHub always sent (morning summary, 15-minute heads-up, bills).
 *  Everything new starts off, so nobody is surprised by extra notifications. */
export const defaultNotify = (): NotifyPrefs => ({
  memberId: "",
  quiet: { on: false, from: "21:30", until: "07:00" },
  morning: { on: true, time: "07:00" },
  headsUp: { on: true, minutes: 15 },
  bills: { on: true },
  evening: { on: false, time: "20:00" },
  water: { on: false, perDay: 8, from: "08:00", until: "20:00", skipWhenMet: true },
  meals: { on: false, times: { breakfast: "08:00", lunch: "12:30", dinner: "18:30", snacks: "15:30" }, which: ["breakfast", "lunch", "dinner"], skipIfLogged: true },
  workout: { on: false, time: "17:30", days: [1, 2, 3, 4, 5], skipIfLogged: true },
  weighIn: { on: false, time: "07:00", days: [1] },
  news: { on: false, perDay: 2, from: "08:00", until: "18:00", topic: "top" },
  mood: { on: false, time: "20:30" },
});

/* ---------------- sanitizing ---------------- */
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const clock = (v: unknown, fallback: Clock): Clock => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const count = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
const days = (v: unknown, fallback: Weekday[]): Weekday[] => (Array.isArray(v)
  ? [...new Set(v.filter((d): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6))].sort() as Weekday[]
  : fallback);
const MEAL_IDS: Meal[] = ["breakfast", "lunch", "dinner", "snacks"];

export function cleanNotify(input: unknown): NotifyPrefs {
  const d = defaultNotify();
  const r = obj(input);
  const q = obj(r.quiet), m = obj(r.morning), h = obj(r.headsUp), b = obj(r.bills), e = obj(r.evening);
  const w = obj(r.water), ml = obj(r.meals), mt = obj(ml.times), wo = obj(r.workout), wi = obj(r.weighIn), n = obj(r.news), mo = obj(r.mood);
  return {
    memberId: typeof r.memberId === "string" ? r.memberId.slice(0, 100) : "",
    quiet: { on: bool(q.on, d.quiet.on), from: clock(q.from, d.quiet.from), until: clock(q.until, d.quiet.until) },
    morning: { on: bool(m.on, d.morning.on), time: clock(m.time, d.morning.time) },
    headsUp: { on: bool(h.on, d.headsUp.on), minutes: HEADS_UP_CHOICES.includes(h.minutes) ? h.minutes : d.headsUp.minutes },
    bills: { on: bool(b.on, d.bills.on) },
    evening: { on: bool(e.on, d.evening.on), time: clock(e.time, d.evening.time) },
    water: { on: bool(w.on, d.water.on), perDay: count(w.perDay, 1, WATER_MAX, d.water.perDay), from: clock(w.from, d.water.from), until: clock(w.until, d.water.until), skipWhenMet: bool(w.skipWhenMet, d.water.skipWhenMet) },
    meals: {
      on: bool(ml.on, d.meals.on),
      times: Object.fromEntries(MEAL_IDS.map((k) => [k, clock(mt[k], d.meals.times[k])])) as Record<Meal, Clock>,
      which: Array.isArray(ml.which) ? MEAL_IDS.filter((k) => ml.which.includes(k)) : d.meals.which,
      skipIfLogged: bool(ml.skipIfLogged, d.meals.skipIfLogged),
    },
    workout: { on: bool(wo.on, d.workout.on), time: clock(wo.time, d.workout.time), days: days(wo.days, d.workout.days), skipIfLogged: bool(wo.skipIfLogged, d.workout.skipIfLogged) },
    weighIn: { on: bool(wi.on, d.weighIn.on), time: clock(wi.time, d.weighIn.time), days: days(wi.days, d.weighIn.days) },
    news: { on: bool(n.on, d.news.on), perDay: count(n.perDay, 1, NEWS_MAX, d.news.perDay), from: clock(n.from, d.news.from), until: clock(n.until, d.news.until), topic: typeof n.topic === "string" && /^[A-Za-z]{2,20}$/.test(n.topic) ? n.topic : d.news.topic },
    mood: { on: bool(mo.on, d.mood.on), time: clock(mo.time, d.mood.time) },
  };
}

/* ---------------- timing ---------------- */
export const toMinutes = (hm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
export const fromMinutes = (n: number): Clock => {
  const v = ((Math.round(n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

/** `count` times spread evenly from `from` to `until` (both included). One reminder goes at `from`. */
export function spreadTimes(from: Clock, until: Clock, count: number): Clock[] {
  const a = toMinutes(from);
  let b = toMinutes(until);
  if (b < a) b += 1440; // a window that runs past midnight
  if (count <= 1) return [fromMinutes(a)];
  return Array.from({ length: count }, (_, i) => fromMinutes(a + ((b - a) * i) / (count - 1)));
}

/** Whether a clock time falls in quiet hours (which may run past midnight). */
export function inQuiet(prefs: NotifyPrefs, minutes: number): boolean {
  if (!prefs.quiet.on) return false;
  const a = toMinutes(prefs.quiet.from), b = toMinutes(prefs.quiet.until);
  if (a === b) return false;
  return a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}

/** About how many notifications a day these settings send (not counting tasks, events and bills). */
export function dailyEstimate(p: NotifyPrefs, weekday: number): number {
  let n = 0;
  if (p.morning.on) n++;
  if (p.evening.on) n++;
  if (p.water.on) n += p.water.perDay;
  if (p.meals.on) n += p.meals.which.length;
  if (p.workout.on && p.workout.days.includes(weekday as Weekday)) n++;
  if (p.weighIn.on && p.weighIn.days.includes(weekday as Weekday)) n++;
  if (p.news.on) n += p.news.perDay;
  if (p.mood.on) n++;
  return n;
}

/** A scheduled reminder may go out from its time until this many minutes later (covers a missed tick),
 *  and never after that, so a phone that was off doesn't get a pile of old water reminders. */
export const SEND_WINDOW_MINUTES = 45;
