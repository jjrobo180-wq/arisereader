// The Rise Score: how someone is doing with their checklist, food, exercise and money, as a percent and a letter
// grade for today, this week and this year. Arise To Duo shows it in a score card on its pages
// (client/src/components/RiseScoreCard.tsx) and sends it to the iPhone's Rise Score widgets
// (native/widget-extension/DuoScores.swift) as the "duo.scores" slot. Pure, so it's tested (tests/rise-score.test.ts).
//
// Each day gets a score per category:
//   Checklist  the share of that day's to-dos that are done (days with none due don't count)
//   Food       breakfast, lunch and dinner logged (from the first day anything was logged)
//   Move       active minutes against the goal (from the first workout logged)
//   Money      spending against the day's share of the monthly budget (from the first expense)
// A day's score is the average of the categories it has; a week or year is the average of its days.

export type RiseCategoryId = "checklist" | "food" | "move" | "money";
export type RiseInput = {
  tasks: { title: string; due: string; time?: string; done: boolean }[];
  food: { date: string; meal: string }[];
  exercise: { date: string; minutes: number }[];
  /** Active minutes a day that count as 100%. */
  activeMinutes: number;
  /** The monthly budget, all categories together (0: no Money score). */
  monthlyBudget: number;
  expenses: { date: string; amount: number }[];
};
export type RiseCategory = { id: RiseCategoryId; name: string; percent: number; color: string };
export type RiseScores = {
  today: number; week: number; year: number; overall: number;
  /** Today's score per category that has one, in a fixed order (Checklist, Food, Move, Money). */
  categories: RiseCategory[];
  /** Monday to Sunday; -1 is a day with nothing to score (or still ahead). */
  weekDays: number[]; todayIndex: number;
  /** January to December; -1 is a month with nothing to score (or still ahead). */
  months: number[]; monthIndex: number;
  /** Days in a row (to today, or to yesterday while today is still under) with a passing score (70+). */
  streak: number;
  /** The next to-do to finish today, if any. */
  next: string;
  /** What lifts the grade next. */
  tip: string;
  /** "Sun, Nov 22". */
  date: string;
  /** Whether there is anything to score at all. */
  started: boolean;
};

export const RISE_COLORS: Record<RiseCategoryId, string> = { checklist: "#ffb347", food: "#4fd1c5", move: "#ff7a6b", money: "#a99bff" };
const NAMES: Record<RiseCategoryId, string> = { checklist: "Checklist", food: "Food", move: "Move", money: "Money" };
const ORDER: RiseCategoryId[] = ["checklist", "food", "move", "money"];

/** A 90+, B+ 87, B 83, B- 80, C+ 77, C 73, C- 70, D below 70. */
export function riseGrade(p: number): string {
  return p >= 90 ? "A" : p >= 87 ? "B+" : p >= 83 ? "B" : p >= 80 ? "B-" : p >= 77 ? "C+" : p >= 73 ? "C" : p >= 70 ? "C-" : "D";
}

const at = (d: string) => new Date(`${d}T12:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (d: string, n: number) => { const x = at(d); x.setDate(x.getDate() + n); return iso(x); };
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : -1);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

function group<T>(rows: T[], day: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) { const d = day(r); if (!isDay(d)) continue; const list = m.get(d); if (list) list.push(r); else m.set(d, [r]); }
  return m;
}
const first = (m: Map<string, unknown>) => [...m.keys()].sort()[0] ?? "";

/** Scores one day, per category (null: nothing to score that day). */
function scorer(input: RiseInput) {
  const tasks = group(input.tasks, (t) => t.due);
  const food = group(input.food, (f) => f.date);
  const moves = group(input.exercise, (e) => e.date);
  const spend = group(input.expenses, (e) => e.date);
  const foodFrom = first(food), moveFrom = first(moves), moneyFrom = first(spend);
  const goal = input.activeMinutes > 0 ? input.activeMinutes : 30;
  return (d: string): Record<RiseCategoryId, number | null> => {
    const due = tasks.get(d) ?? [];
    const checklist = due.length ? clamp((due.filter((t) => t.done).length / due.length) * 100) : null;
    const meals = new Set((food.get(d) ?? []).map((f) => f.meal).filter((m) => m === "breakfast" || m === "lunch" || m === "dinner"));
    const foodScore = foodFrom && d >= foodFrom ? clamp((meals.size / 3) * 100) : null;
    const minutes = (moves.get(d) ?? []).reduce((a, e) => a + (Number(e.minutes) || 0), 0);
    const move = moveFrom && d >= moveFrom ? clamp((minutes / goal) * 100) : null;
    let money: number | null = null;
    if (input.monthlyBudget > 0 && moneyFrom && d >= moneyFrom) {
      const x = at(d), days = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
      const plan = input.monthlyBudget / days;
      const spent = (spend.get(d) ?? []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
      money = spent <= plan ? 100 : clamp(100 - ((spent - plan) / plan) * 100);
    }
    return { checklist, food: foodScore, move, money };
  };
}

const dayScore = (c: Record<RiseCategoryId, number | null>) => avg(ORDER.map((k) => c[k]).filter((v): v is number => v !== null));

export function riseScores(input: RiseInput, today: string): RiseScores {
  const score = scorer(input);
  const now = at(today);

  // Every day of the year so far.
  const jan1 = `${now.getFullYear()}-01-01`;
  const daily = new Map<string, number>();
  for (let d = jan1; d <= today; d = plus(d, 1)) { const s = dayScore(score(d)); if (s >= 0) daily.set(d, s); }

  const todayParts = score(today);
  const todayScore = daily.get(today) ?? -1;

  const todayIndex = (now.getDay() + 6) % 7; // Monday 0 ... Sunday 6
  const monday = plus(today, -todayIndex);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = plus(monday, i); return d <= today ? daily.get(d) ?? -1 : -1; });
  const week = avg(weekDays.filter((v) => v >= 0));

  const monthIndex = now.getMonth();
  const months = Array.from({ length: 12 }, (_, m) => (m > monthIndex ? -1 : avg([...daily].filter(([d]) => at(d).getMonth() === m).map(([, v]) => v))));
  const year = avg([...daily.values()]);

  const parts = [todayScore, week, year].filter((v) => v >= 0);
  const overall = avg(parts);

  let streak = 0;
  for (let d = (daily.get(today) ?? 0) >= 70 ? today : plus(today, -1); (daily.get(d) ?? -1) >= 70; d = plus(d, -1)) streak++;

  const categories: RiseCategory[] = ORDER.filter((k) => todayParts[k] !== null).map((k) => ({ id: k, name: NAMES[k], percent: todayParts[k] as number, color: RISE_COLORS[k] }));

  const open = input.tasks.filter((t) => !t.done && isDay(t.due) && t.due <= today).sort((a, b) => (a.due + (a.time || "99")).localeCompare(b.due + (b.time || "99")));
  const next = open[0]?.title ?? "";

  let tip: string;
  const lowest = [...categories].sort((a, b) => a.percent - b.percent)[0];
  if (!lowest) tip = "Check off a task to start your score";
  else if (lowest.percent >= 100) tip = "Perfect day! Everything is done";
  else if (todayScore >= 90) tip = "You're at an A today. Keep it!";
  else {
    const lifted = Math.round(todayScore + (100 - lowest.percent) / categories.length);
    tip = lifted >= 90 ? `Finish ${lowest.name} to reach an A today` : `${lowest.name} is lowest. Finish it to raise your grade`;
  }

  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const z = (v: number) => Math.max(0, v);
  return { today: z(todayScore), week: z(week), year: z(year), overall: z(overall), categories, weekDays, todayIndex, months, monthIndex, streak, next, tip, date, started: daily.size > 0 };
}

/** The Rise Score input from LifeHub's family data and to-dos (the first person with a food & fitness plan). */
export function riseInputFrom(
  family: { health: { profiles: Record<string, unknown>; goals: Record<string, { activeMinutes?: number }>; food: { memberId: string; date: string; meal: string }[]; exercise: { memberId: string; date: string; minutes: number }[] }; budget: { limit: number }[]; expenses: { date: string; amount: number }[] },
  tasks: { title: string; due: string; time?: string; done: boolean }[],
): RiseInput {
  const h = family.health;
  const member = Object.keys(h.profiles)[0] ?? h.food[0]?.memberId ?? h.exercise[0]?.memberId ?? "";
  const mine = <T extends { memberId: string }>(rows: T[]) => (member ? rows.filter((r) => r.memberId === member) : rows);
  return {
    tasks,
    food: mine(h.food),
    exercise: mine(h.exercise),
    activeMinutes: Number(h.goals[member]?.activeMinutes) || 30,
    monthlyBudget: family.budget.reduce((a, b) => a + (Number(b.limit) || 0), 0),
    expenses: family.expenses,
  };
}
