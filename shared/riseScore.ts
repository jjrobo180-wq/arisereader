// The Rise Score: how someone is doing with their checklist, food, exercise and money, as a percent and a letter
// grade for today, this week and this year. Arise To Do shows it in a score card on its pages
// (client/src/components/RiseScoreCard.tsx) and sends it to the iPhone's Rise Score widgets
// (native/widget-extension/DuoScores.swift) as the "duo.scores" slot. Pure, so it's tested (tests/rise-score.test.ts).
//
// Each day gets a score per category:
//   Checklist  the share of that day's to-dos that are done (days with none due don't count)
//   Food       breakfast, lunch and dinner logged (from the first day anything was logged)
//   Move       active minutes against the goal (from the first workout logged)
//   Money      spending against the day's share of the monthly budget (from the first expense)
//   Water      cups logged against the water goal (from the first day any was logged)
//   Sleep      hours slept against 8 (from the first night logged)
//   Habits     the share of habits done that day (from the first habit checked off)
// Workouts logged on the Workouts page count for Move too (a day with one is a full Move day).
// Each category can be switched off (input.off): it then counts nowhere, on the card or the widgets.
// A day's score is the average of the categories it has; a week or year is the average of its days.

export type RiseCategoryId = "checklist" | "food" | "move" | "money" | "water" | "sleep" | "habits";
export type RiseInput = {
  tasks: { title: string; due: string; time?: string; done: boolean }[];
  food: { date: string; meal: string }[];
  exercise: { date: string; minutes: number }[];
  /** Active minutes a day that count as 100%. */
  activeMinutes: number;
  /** The monthly budget, all categories together (0: no Money score). */
  monthlyBudget: number;
  expenses: { date: string; amount: number }[];
  /** Workouts page entries: any on a day makes it a full Move day. */
  workouts?: { date: string }[];
  /** Cups of water a day. */
  water?: { date: string; amount: number }[];
  waterGoal?: number;
  /** Nights slept: bed and wake as "HH:MM". */
  sleep?: { date: string; bed: string; wake: string }[];
  /** Each habit and the days it was done. */
  habits?: { name?: string; days: string[] }[];
  /** Categories switched off. */
  off?: RiseCategoryId[];
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
  /** What's still left to do today, biggest lift first. */
  left: RiseLeft[];
  /** How many things are left today (the red badge until it's 0). */
  leftCount: number;
  /** What each grade takes today. */
  ladder: RiseRung[];
  /** How to improve, most useful first. */
  improve: string[];
  /** A sentence each on today, this week and this year. */
  summary: { today: string; week: string; year: string };
  /** Each category today, this week, last week and this year. */
  analysis: RiseAnalysis[];
};
export type RiseLeft = {
  id: RiseCategoryId; name: string; color: string;
  /** What to do: "Call the dentist, Do laundry", "Log dinner", "6 more minutes". */
  what: string;
  /** How many things (the badge counts these). */
  count: number;
  /** How many points today's score goes up when it's done. */
  gain: number;
};
export type RiseRung = { grade: string; min: number; reached: boolean; need: number; how: string };
export type RiseAnalysis = {
  id: RiseCategoryId; name: string; color: string;
  today: number | null; week: number | null; lastWeek: number | null; year: number | null;
  /** Days this week at 90% or more, of the days tracked. */
  goodDays: number; trackedDays: number;
};

export const RISE_COLORS: Record<RiseCategoryId, string> = { checklist: "#ffb347", food: "#4fd1c5", move: "#ff7a6b", money: "#a99bff", water: "#7dd3fc", sleep: "#f0abfc", habits: "#86efac" };
const NAMES: Record<RiseCategoryId, string> = { checklist: "Checklist", food: "Food", move: "Move", money: "Money", water: "Water", sleep: "Sleep", habits: "Habits" };
export const RISE_CATEGORIES: { id: RiseCategoryId; name: string; from: string }[] = [
  { id: "checklist", name: "Checklist", from: "To-dos due today, checked off in Tasks" },
  { id: "food", name: "Food", from: "Breakfast, lunch and dinner logged in Food & fitness" },
  { id: "move", name: "Move", from: "Exercise minutes in Food & fitness, or a workout in Workouts" },
  { id: "money", name: "Money", from: "Spending against your budget in Money" },
  { id: "water", name: "Water", from: "Cups of water logged in Food & fitness" },
  { id: "sleep", name: "Sleep", from: "Hours slept, logged in Sleep" },
  { id: "habits", name: "Habits", from: "Habits checked off in Habits" },
];
const ORDER: RiseCategoryId[] = RISE_CATEGORIES.map((c) => c.id);

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
  const lifts = group(input.workouts ?? [], (w) => w.date);
  const drinks = group((input.water ?? []).filter((w) => Number(w.amount) > 0), (w) => w.date);
  const nights = group(input.sleep ?? [], (n) => n.date);
  const habits = input.habits ?? [];
  const habitDays = group(habits.flatMap((h) => h.days.map((d) => ({ d }))), (x) => x.d);
  const off = new Set(input.off ?? []);
  const foodFrom = first(food), moneyFrom = first(spend), waterFrom = first(drinks), sleepFrom = first(nights), habitFrom = first(habitDays);
  const moveFrom = [first(moves), first(lifts)].filter(Boolean).sort()[0] ?? "";
  const goal = input.activeMinutes > 0 ? input.activeMinutes : 30;
  const waterGoal = (input.waterGoal ?? 0) > 0 ? (input.waterGoal as number) : 8;
  const hours = (bed: string, wake: string) => {
    const m = (t: string) => { const [h, mm] = t.split(":").map(Number); return (h || 0) * 60 + (mm || 0); };
    let span = m(wake) - m(bed);
    if (span <= 0) span += 24 * 60;
    return span / 60;
  };
  const score = (d: string): Record<RiseCategoryId, number | null> => {
    const all = scoreDay(d);
    for (const k of ORDER) if (off.has(k)) all[k] = null;
    return all;
  };
  /** What's left in each category on day d, and how many things that is. */
  const leftOn = (d: string): Partial<Record<RiseCategoryId, { what: string; count: number }>> => {
    const out: Partial<Record<RiseCategoryId, { what: string; count: number }>> = {};
    const open = (tasks.get(d) ?? []).filter((t) => !t.done).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    if (open.length) out.checklist = { what: listOf(open.map((t) => t.title)), count: open.length };
    const meals = new Set((food.get(d) ?? []).map((f) => f.meal));
    const missing = (["breakfast", "lunch", "dinner"] as const).filter((m) => !meals.has(m));
    if (missing.length) out.food = { what: `Log ${listOf(missing)}`, count: missing.length };
    const minutes = (moves.get(d) ?? []).reduce((a, e) => a + (Number(e.minutes) || 0), 0);
    if (!lifts.has(d) && minutes < goal) out.move = { what: `${Math.ceil(goal - minutes)} more active minutes, or log a workout`, count: 1 };
    const cups = (drinks.get(d) ?? []).reduce((a, w) => a + (Number(w.amount) || 0), 0);
    if (cups < waterGoal) { const n = Math.ceil(waterGoal - cups); out.water = { what: `${n} more cup${n === 1 ? "" : "s"} of water`, count: 1 }; }
    if (!nights.has(d)) out.sleep = { what: "Log last night's sleep", count: 1 };
    const notDone = habits.filter((h) => !h.days.includes(d));
    if (notDone.length && habits.length) out.habits = { what: listOf(notDone.map((h) => h.name || "a habit")), count: notDone.length };
    for (const k of ORDER) if (off.has(k)) delete out[k];
    return out;
  };
  return { score, leftOn };
  function scoreDay(d: string): Record<RiseCategoryId, number | null> {
    const due = tasks.get(d) ?? [];
    const checklist = due.length ? clamp((due.filter((t) => t.done).length / due.length) * 100) : null;
    const meals = new Set((food.get(d) ?? []).map((f) => f.meal).filter((m) => m === "breakfast" || m === "lunch" || m === "dinner"));
    const foodScore = foodFrom && d >= foodFrom ? clamp((meals.size / 3) * 100) : null;
    const minutes = (moves.get(d) ?? []).reduce((a, e) => a + (Number(e.minutes) || 0), 0);
    const move = moveFrom && d >= moveFrom ? (lifts.has(d) ? 100 : clamp((minutes / goal) * 100)) : null;
    let money: number | null = null;
    if (input.monthlyBudget > 0 && moneyFrom && d >= moneyFrom) {
      const x = at(d), days = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
      const plan = input.monthlyBudget / days;
      const spent = (spend.get(d) ?? []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
      money = spent <= plan ? 100 : clamp(100 - ((spent - plan) / plan) * 100);
    }
    const cups = (drinks.get(d) ?? []).reduce((a, w) => a + (Number(w.amount) || 0), 0);
    const water = waterFrom && d >= waterFrom ? clamp((cups / waterGoal) * 100) : null;
    const slept = (nights.get(d) ?? []).reduce((a, n) => a + hours(n.bed, n.wake), 0);
    const sleep = sleepFrom && d >= sleepFrom ? clamp((slept / 8) * 100) : null;
    const habitsScore = habitFrom && d >= habitFrom && habits.length ? clamp((habits.filter((h) => h.days.includes(d)).length / habits.length) * 100) : null;
    return { checklist, food: foodScore, move, money, water, sleep, habits: habitsScore };
  }
}

function listOf(xs: string[]): string {
  const ys = xs.map((x) => String(x).trim()).filter(Boolean);
  if (ys.length <= 3) return ys.length < 2 ? ys.join("") : `${ys.slice(0, -1).join(", ")} and ${ys[ys.length - 1]}`;
  return `${ys.slice(0, 3).join(", ")} and ${ys.length - 3} more`;
}
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const GRADES: [string, number][] = [["A", 90], ["B", 83], ["C", 73]];
/** What helps most in each category. */
const ADVICE: Record<RiseCategoryId, string> = {
  checklist: "Put fewer to-dos on each day, and do the hardest one first",
  food: "Log each meal right after you eat; breakfast is the one most often missed",
  move: "A 10-minute walk after lunch and dinner adds up fast",
  money: "Check today's spending before you buy, and plan big costs for days you spend little",
  water: "Keep a bottle in sight and log a cup with each meal",
  sleep: "Log your sleep each morning, and aim for the same bedtime every night",
  habits: "Tie each habit to something you already do every day",
};

const dayScore = (c: Record<RiseCategoryId, number | null>) => avg(ORDER.map((k) => c[k]).filter((v): v is number => v !== null));

export function riseScores(input: RiseInput, today: string): RiseScores {
  const { score, leftOn } = scorer(input);
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

  // What's left today, and how much each lifts today's score (each category is an equal share of the day).
  const n = categories.length || 1;
  const leftParts = leftOn(today);
  const left: RiseLeft[] = categories
    .filter((c) => c.percent < 100 && leftParts[c.id])
    .map((c) => ({ id: c.id, name: c.name, color: c.color, what: leftParts[c.id]!.what, count: leftParts[c.id]!.count, gain: Math.round((100 - c.percent) / n) }))
    .sort((a, b) => b.gain - a.gain || a.count - b.count);
  const leftCount = left.reduce((a, l) => a + l.count, 0);

  // What each grade takes: the fewest categories, biggest lift first, that get today there.
  const ladder: RiseRung[] = GRADES.map(([grade, min]) => {
    const now = z(todayScore);
    if (!categories.length) return { grade, min, reached: false, need: min, how: "Log something to start today's score" };
    if (now >= min) return { grade, min, reached: true, need: 0, how: now >= 100 ? "Done: everything is finished" : `Reached. Keep it by finishing ${listOf(left.map((l) => l.name)) || "what's left"}` };
    let s = now; const steps: string[] = [];
    for (const l of left) { if (s >= min) break; s += l.gain; steps.push(l.name === "Checklist" ? `your ${l.count} to-do${l.count === 1 ? "" : "s"}` : l.name); }
    return s >= min
      ? { grade, min, reached: false, need: min - now, how: `Finish ${listOf(steps)}` }
      : { grade, min, reached: false, need: min - now, how: `Out of reach today (best you can get is ${Math.min(100, s)}%); aim for it tomorrow` };
  });

  // Each category this week, last week and this year.
  const lastMonday = plus(monday, -7);
  const per = (from: string, to: string, k: RiseCategoryId) => {
    const xs: number[] = [];
    for (let d = from; d <= to && d <= today; d = plus(d, 1)) { const v = score(d)[k]; if (v !== null) xs.push(v); }
    return xs;
  };
  const analysis: RiseAnalysis[] = ORDER.filter((k) => !(input.off ?? []).includes(k)).map((k) => {
    const wk = per(monday, today, k), lw = per(lastMonday, plus(monday, -1), k), yr = per(jan1, today, k);
    return {
      id: k, name: NAMES[k], color: RISE_COLORS[k], today: todayParts[k],
      week: wk.length ? avg(wk) : null, lastWeek: lw.length ? avg(lw) : null, year: yr.length ? avg(yr) : null,
      goodDays: wk.filter((v) => v >= 90).length, trackedDays: wk.length,
    };
  }).filter((a) => a.year !== null || a.today !== null);

  // How to improve: the weakest this week first, then whatever slipped since last week.
  const improve: string[] = [];
  const ranked = analysis.filter((a) => a.week !== null).sort((a, b) => (a.week as number) - (b.week as number));
  const weakest = ranked[0];
  if (left[0] && todayScore < 100) improve.push(`Today: ${left[0].what} (+${left[0].gain} points).`);
  if (weakest && (weakest.week as number) < 90) improve.push(`${weakest.name} is your weakest this week at ${weakest.week}%, ${weakest.goodDays} of ${weakest.trackedDays} days at 90% or more. ${ADVICE[weakest.id]}.`);
  for (const a of analysis) {
    if (a.week !== null && a.lastWeek !== null && a.lastWeek - a.week >= 10 && a !== weakest) improve.push(`${a.name} slipped from ${a.lastWeek}% last week to ${a.week}%. ${ADVICE[a.id]}.`);
  }
  const missed = weekDays.slice(0, todayIndex).filter((v) => v < 0).length;
  if (missed >= 2) improve.push(`Nothing was tracked on ${missed} days this week. Open To Do each evening to log the day.`);
  if (!improve.length && categories.length) improve.push("You're doing great. Keep the streak going tomorrow.");

  // Summaries.
  const tracked = weekDays.map((v, i) => [v, i] as const).filter(([v]) => v >= 0);
  const best = [...tracked].sort((a, b) => b[0] - a[0])[0], worst = [...tracked].sort((a, b) => a[0] - b[0])[0];
  const lastWeekDays = Array.from({ length: 7 }, (_, i) => daily.get(plus(lastMonday, i)) ?? -1).filter((v) => v >= 0);
  const lastWeekAvg = avg(lastWeekDays);
  const strongest = ranked[ranked.length - 1];
  /** The best grade still in reach today. */
  const nextRung = ladder.find((r) => !r.reached && r.how.startsWith("Finish"));
  const summary = {
    today: !categories.length ? "Nothing tracked yet today."
      : todayScore >= 100 ? "A perfect day: everything is done."
      : `${todayScore}% (${riseGrade(todayScore)}) with ${leftCount} thing${leftCount === 1 ? "" : "s"} left.${nextRung ? ` ${nextRung.how} for ${nextRung.grade === "A" ? "an" : "a"} ${nextRung.grade}.` : ""}`,
    week: week < 0 ? "Nothing tracked this week yet."
      : [`${week}% (${riseGrade(week)})${lastWeekAvg >= 0 ? `, ${week === lastWeekAvg ? "the same as" : week > lastWeekAvg ? `up ${week - lastWeekAvg} from` : `down ${lastWeekAvg - week} from`} last week` : ""}.`,
         tracked.length > 1 && best && worst ? `Best day ${WEEKDAYS[best[1]]} (${best[0]}%), toughest ${WEEKDAYS[worst[1]]} (${worst[0]}%).` : "",
         strongest && weakest && strongest !== weakest ? `Strongest: ${strongest.name} ${strongest.week}%. Needs work: ${weakest.name} ${weakest.week}%.` : "",
        ].filter(Boolean).join(" "),
    year: year < 0 ? "Nothing tracked this year yet."
      : (() => { const done = months.filter((v) => v >= 0); const bestM = months.indexOf(Math.max(...done));
          const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          return `${year}% (${riseGrade(year)}) across ${daily.size} tracked day${daily.size === 1 ? "" : "s"}. Best month ${names[bestM]} (${months[bestM]}%).${done.length > 1 ? ` ${done[done.length - 1] >= done[0] ? `Up ${done[done.length - 1] - done[0]}` : `Down ${done[0] - done[done.length - 1]}`} points since ${names[months.findIndex((v) => v >= 0)]}.` : ""}`; })(),
  };

  return { today: z(todayScore), week: z(week), year: z(year), overall: z(overall), categories, weekDays, todayIndex, months, monthIndex, streak, next, tip, date, started: daily.size > 0,
    left, leftCount, ladder, improve: improve.slice(0, 4), summary, analysis };
}

/** The Rise Score input from LifeHub's family data and to-dos (the first person with a food & fitness plan). */
export function riseInputFrom(
  family: {
    health: { profiles: Record<string, unknown>; goals: Record<string, { activeMinutes?: number; water?: number }>; food: { memberId: string; date: string; meal: string }[]; exercise: { memberId: string; date: string; minutes: number }[]; days?: { memberId: string; date: string; water: number }[] };
    budget: { limit: number }[]; expenses: { date: string; amount: number }[];
    workouts?: { date: string }[]; sleep?: { date: string; bed: string; wake: string }[]; habits?: { name?: string; days: string[] }[];
  },
  tasks: { title: string; due: string; time?: string; done: boolean }[],
  off: RiseCategoryId[] = [],
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
    workouts: family.workouts ?? [],
    water: mine(h.days ?? []).map((x) => ({ date: x.date, amount: x.water })),
    waterGoal: Number(h.goals[member]?.water) || 8,
    sleep: family.sleep ?? [],
    habits: family.habits ?? [],
    off,
  };
}
