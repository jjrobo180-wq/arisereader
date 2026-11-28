// Rise: the one daily habit that holds LifeHub's tracking together (client/src/components/daily/Rise.tsx).
// - A 60-second check-in that swipes through today's check-ins (shared/dailyCheckins.ts), one tap each.
// - One streak and one ring for everything: a day counts when at least half of its check-ins are done (or three),
//   a day with nothing to do is skipped, and one missed day a week is forgiven (a freeze), so a single slip
//   doesn't wipe weeks of work.
// - Your why, a vision board and your goal weight, worked into the reminders so they say why it matters.
// - A morning nudge, a streak saver at night, and a weekly recap with what your own numbers say.
// Saved on the LifeHub family as `rise`.
import { QUOTES } from "./mindsetContent";

export type RiseVision = { id: string; emoji: string; text: string };
export type RiseDay = { date: string; done: number; total: number };
export type RiseData = {
  why: string;
  vision: RiseVision[];
  /** Quotes in the morning nudge. */
  quotes: boolean;
  /** The morning nudge and the streak saver ("HH:MM"); "" turns one off. */
  morning: string;
  evening: string;
  /** The weight you started from when you set a goal, in kg (the goal itself is Health & Fitness's). */
  startKg?: number;
  /** A copy of where the weight stands, for reminders (which can't see Health & Fitness). */
  kg?: { now: number; goal: number; units: "lb" | "kg" };
  /** Who you send your progress to (a name only; it goes by the share sheet). */
  buddy: string;
  days: RiseDay[];
};

export const RISE_LIMITS = { vision: 12, days: 800 };
export const emptyRise = (): RiseData => ({ why: "", vision: [], quotes: true, morning: "07:30", evening: "20:30", buddy: "", days: [] });

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHm = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 10) / 10 : undefined);

export function cleanRise(raw: unknown): RiseData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as any;
  const out: RiseData = {
    why: str(r.why, 400), quotes: r.quotes !== false, buddy: str(r.buddy, 40),
    morning: r.morning === "" ? "" : isHm(r.morning) ? r.morning : "07:30", evening: r.evening === "" ? "" : isHm(r.evening) ? r.evening : "20:30",
    vision: (Array.isArray(r.vision) ? r.vision : []).slice(0, RISE_LIMITS.vision).map((v: any) => ({ id: str(v?.id, 60), emoji: str(v?.emoji, 16) || "⭐", text: str(v?.text, 120).trim() })).filter((v: RiseVision) => v.id && v.text),
    days: (Array.isArray(r.days) ? r.days : []).filter((d: any) => isDay(d?.date)).slice(-RISE_LIMITS.days)
      .map((d: any) => ({ date: d.date, done: Math.max(0, Math.min(200, Math.round(Number(d.done) || 0))), total: Math.max(0, Math.min(200, Math.round(Number(d.total) || 0))) })),
  };
  const start = num(r.startKg, 20, 400);
  if (start) out.startKg = start;
  const now = num(r.kg?.now, 20, 400), goal = num(r.kg?.goal, 20, 400);
  if (now && goal) out.kg = { now, goal, units: r.kg.units === "kg" ? "kg" : "lb" };
  return out;
}

/** Today's numbers, kept (only when they changed). */
export function recordDay(rise: RiseData, date: string, done: number, total: number): RiseData {
  const was = rise.days.find((d) => d.date === date);
  if (was && was.done === done && was.total === total) return rise;
  return { ...rise, days: [...rise.days.filter((d) => d.date !== date), { date, done, total }].sort((a, b) => a.date.localeCompare(b.date)).slice(-RISE_LIMITS.days) };
}

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dow = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** A day counts once half its check-ins are done, or three of them. */
export const counts = (d: RiseDay | undefined) => !!d && d.total > 0 && (d.done * 2 >= d.total || d.done >= 3);
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The streak: days in a row that counted. Today joins once it counts (until then yesterday's streak is still
 * alive). A day with nothing to do is skipped. One missed day in any seven is forgiven (a freeze).
 */
export function riseStreak(rise: Pick<RiseData, "days">, today: string): { days: number; today: boolean; frozen: string[]; best: number; freezeReady: boolean } {
  const by = new Map(rise.days.map((d) => [d.date, d]));
  const first = rise.days[0]?.date;
  const todayCounts = counts(by.get(today));
  let days = todayCounts ? 1 : 0;
  const frozen: string[] = [];
  if (first) for (let i = 1; i < 2000; i++) {
    const date = addDays(today, -i);
    if (date < first) break;
    const d = by.get(date);
    if (counts(d)) { days += 1; continue; }
    if (d && d.total === 0) continue;
    // Missed: forgiven if no other day in the 7 before it was.
    const last = frozen[frozen.length - 1];
    if (!last || Math.abs((Date.parse(last) - Date.parse(date)) / 86_400_000) >= 7) {
      // Only if the day before it counted, so two misses in a row still end it.
      if (counts(by.get(addDays(date, -1)))) { frozen.push(date); continue; }
    }
    break;
  }
  let best = 0, run = 0;
  for (const d of rise.days) { if (counts(d)) { run += 1; best = Math.max(best, run); } else if (d.total > 0) run = 0; }
  const lastFreeze = frozen[0];
  return { days, today: todayCounts, frozen, best: Math.max(best, days), freezeReady: !lastFreeze || (Date.parse(today) - Date.parse(lastFreeze)) / 86_400_000 >= 7 };
}

const unitsOf = (kg: number, units: "lb" | "kg") => (units === "lb" ? kg * 2.20462 : kg);
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US");
/** Where the weight goal stands: how far to go and how much of the way is done. */
export function weightGoal(nowKg: number | undefined, goalKg: number | undefined, startKg: number | undefined, units: "lb" | "kg"): { left: number; goal: number; now: number; pct: number; text: string } | null {
  if (!nowKg || !goalKg) return null;
  const now = unitsOf(nowKg, units), goal = unitsOf(goalKg, units), start = unitsOf(startKg || nowKg, units);
  const left = Math.abs(now - goal), total = Math.abs(start - goal);
  const reached = (start >= goal && now <= goal) || (start < goal && now >= goal);
  const pct = reached ? 1 : total > 0 ? Math.max(0, Math.min(1, 1 - left / total)) : 0;
  return { left, goal, now, pct, text: reached ? `Goal reached: ${fmt1(goal)} ${units} 🎉` : `${fmt1(left)} ${units} to go to ${fmt1(goal)} ${units}` };
}

const MOTIVE_QUOTES = QUOTES.filter((q) => q.topics.some((t) => t === "discipline" || t === "health" || t === "resilience") && q.text.length <= 110);
const pick = <T,>(list: T[], n: number) => (list.length ? list[((n % list.length) + list.length) % list.length] : undefined);
const seedOf = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);

/** One line of why-it-matters for a reminder: your why, a goal-weight line, something from your vision board, or a quote. */
export function motivation(rise: RiseData | undefined, date: string, salt: string): string {
  if (!rise) return "";
  const n = Math.abs(seedOf(`${date}:${salt}`));
  const options: string[] = [];
  if (rise.why) options.push(`Remember why: ${rise.why}`);
  const w = rise.kg && weightGoal(rise.kg.now, rise.kg.goal, rise.startKg, rise.kg.units);
  if (w) options.push(w.text.includes("reached") ? w.text : `${w.text}. Every log counts.`);
  const v = pick(rise.vision, n);
  if (v) options.push(`Picture it: ${v.emoji} ${v.text}`);
  if (rise.quotes) { const q = pick(MOTIVE_QUOTES, n); if (q) options.push(`"${q.text}" — ${q.by}`); }
  return pick(options, n >> 3) ?? "";
}

export type RiseReminder = { id: string; title: string; body: string; time: string; section: string; url?: string };
/** The morning nudge and the evening streak saver (only while today doesn't count yet). */
export function riseReminders(rise: RiseData | undefined, date: string, today: { done: number; total: number } | null, url: string): RiseReminder[] {
  if (!rise) return [];
  const out: RiseReminder[] = [];
  const st = riseStreak(rise, date);
  const isToday = !!today;
  const doneNow = isToday && counts({ date, done: today!.done, total: today!.total });
  if (rise.morning) {
    const line = motivation(rise, date, "morning");
    out.push({ id: "rise:morning", title: st.days ? `Day ${st.days + 1} starts now 🔥` : "Your 60-second check-in is ready", body: line || "One minute, one tap each. Start your day on purpose.", time: rise.morning, section: "tasks", url });
  }
  if (rise.evening && !doneNow) {
    const line = motivation(rise, date, "evening");
    out.push({ id: "rise:evening", title: st.days ? `Keep your ${st.days}-day streak 🔥` : "60 seconds before bed", body: `${st.days ? "It ends at midnight. " : ""}A quick check-in keeps it going.${line ? ` ${line}` : ""}`, time: rise.evening, section: "tasks", url });
  }
  return out;
}

/* ─── The weekly recap ─── */
export type RecapInput = {
  rise: RiseData; today: string;
  foods?: { date: string; meal: string; kcal: number; servings: number }[];
  weights?: { date: string; kg: number }[];
  water?: Record<string, number>; waterGoal?: number; units?: "lb" | "kg";
  workouts?: { date: string }[];
};
export type Recap = { from: string; to: string; daysCounted: number; lastWeek: number; checkins: number; meals: number; avgKcal: number; weightChange: number | null; workouts: number; waterDays: number; insights: string[] };

/** The last seven days, and what your own numbers say (only things there's enough data to back up). */
export function weekRecap(x: RecapInput): Recap {
  const to = x.today, from = addDays(to, -6), lastFrom = addDays(from, -7);
  const by = new Map(x.rise.days.map((d) => [d.date, d]));
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const daysCounted = days.filter((d) => counts(by.get(d))).length;
  const lastWeek = Array.from({ length: 7 }, (_, i) => addDays(lastFrom, i)).filter((d) => counts(by.get(d))).length;
  const checkins = days.reduce((s, d) => s + (by.get(d)?.done || 0), 0);
  const foods = (x.foods || []).filter((f) => inRange(f.date, from, to));
  const mealKeys = new Set(foods.map((f) => `${f.date}:${f.meal}`));
  const kcalByDay = new Map<string, number>();
  for (const f of foods) kcalByDay.set(f.date, (kcalByDay.get(f.date) || 0) + f.kcal * (f.servings || 1));
  const logged = [...kcalByDay.values()].filter((k) => k > 0);
  const avgKcal = logged.length ? Math.round(logged.reduce((s, k) => s + k, 0) / logged.length) : 0;
  const ws = (x.weights || []).filter((w) => inRange(w.date, addDays(from, -3), to)).sort((a, b) => a.date.localeCompare(b.date));
  const weightChange = ws.length >= 2 ? unitsOf(ws[ws.length - 1].kg - ws[0].kg, x.units || "lb") : null;
  const workouts = (x.workouts || []).filter((w) => inRange(w.date.slice(0, 10), from, to)).length;
  const waterDays = x.water && x.waterGoal ? days.filter((d) => (x.water![d] || 0) >= x.waterGoal!).length : 0;

  const insights: string[] = [];
  if (daysCounted > lastWeek) insights.push(`You showed up ${daysCounted - lastWeek} more day${daysCounted - lastWeek === 1 ? "" : "s"} than last week. That's momentum.`);
  else if (daysCounted < lastWeek && lastWeek) insights.push(`${lastWeek - daysCounted} fewer days than last week. No guilt — just start tomorrow's check-in.`);
  // Your best weekday, over the last 8 weeks.
  const hist = x.rise.days.filter((d) => d.total > 0 && d.date >= addDays(to, -56));
  if (hist.length >= 14) {
    const rate = Array.from({ length: 7 }, (_, w) => { const ds = hist.filter((d) => dow(d.date) === w); return ds.length >= 2 ? ds.reduce((s, d) => s + d.done / d.total, 0) / ds.length : -1; });
    const best = rate.indexOf(Math.max(...rate)), worst = rate.indexOf(Math.min(...rate.map((r) => (r < 0 ? 9 : r))));
    if (best >= 0 && rate[best] > 0) insights.push(`${DAY_NAMES[best]}s are your strongest day${worst >= 0 && worst !== best && rate[worst] < rate[best] - 0.2 ? `; ${DAY_NAMES[worst]}s need a plan` : ""}.`);
  }
  // Breakfast logged vs the rest of the day.
  const allFoods = x.foods || [];
  if (hist.length >= 10 && allFoods.length) {
    const bfast = new Set(allFoods.filter((f) => f.meal === "breakfast").map((f) => f.date));
    const withB = hist.filter((d) => bfast.has(d.date)), without = hist.filter((d) => !bfast.has(d.date));
    if (withB.length >= 4 && without.length >= 4) {
      const a = withB.reduce((s, d) => s + d.done / d.total, 0) / withB.length, b = without.reduce((s, d) => s + d.done / d.total, 0) / without.length;
      if (a - b >= 0.15) insights.push(`On days you log breakfast you finish ${Math.round(a * 100)}% of your day, vs ${Math.round(b * 100)}% when you don't. Breakfast is your domino.`);
    }
  }
  if (weightChange !== null && Math.abs(weightChange) >= 0.2) insights.push(`Weight ${weightChange < 0 ? "down" : "up"} ${fmt1(Math.abs(weightChange))} ${x.units || "lb"} this week.`);
  if (logged.length >= 3) insights.push(`You logged food on ${logged.length} of 7 days, averaging ${avgKcal.toLocaleString("en-US")} calories.`);
  if (x.waterGoal && waterDays) insights.push(`Water goal hit on ${waterDays} day${waterDays === 1 ? "" : "s"}.`);
  if (!insights.length) insights.push("Keep checking in. Once there's a couple of weeks of days, this is where your patterns show up.");
  return { from, to, daysCounted, lastWeek, checkins, meals: mealKeys.size, avgKcal, weightChange, workouts, waterDays, insights };
}

/** The text sent to your buddy. */
export function progressText(rise: RiseData, today: string, done: number, total: number, name = ""): string {
  const st = riseStreak(rise, today);
  const w = rise.kg ? weightGoal(rise.kg.now, rise.kg.goal, rise.startKg, rise.kg.units) : null;
  return [`${name ? `${name}'s` : "My"} check-in: ${done} of ${total} today${st.days ? ` · 🔥 ${st.days}-day streak` : ""}.`, w ? w.text + "." : "", rise.why ? `Why I'm doing this: ${rise.why}` : "", "Keep me honest 💪"].filter(Boolean).join("\n");
}

/** A meal check-in's reminder ("todo:daily:cooked:lunch:2026-11-27"), which gets the meal buttons on the phone. */
export const isMealReminder = (key: string) => /:cooked:(breakfast|lunch|dinner|snack|snacks)(:|$)/.test(key);
/** The check-in a meal reminder is for ("cooked:lunch"). */
export const mealCheckin = (key: string) => /:(cooked:(?:breakfast|lunch|dinner|snacks?))(:|$)/.exec(key)?.[1] ?? "";
