// Life Score, in depth (client/src/components/family-hub/LifeScoreApp.tsx): what's still left to track today (shown
// in red, with a count on the menu, the widgets and the app icon, until it's all done), what each rating needs
// today, how to improve, a summary of today, the week and the month, and each area and measure side by side.
// Worked out from lifeScore()'s result and the same day facts (shared/lifeScore.ts). Pure, so it's tested
// (tests/life-insights.test.ts).
import { AREAS, METRICS, factsFor, labelFor, lastDays, plusDays, type AreaId, type LifeInput, type LifeScoreResult, type MetricId } from "./lifeScore";

export type LifeLeft = {
  id: string; name: string; color: string;
  /** What to do: "Log last night's sleep", "2,400 more steps". */
  what: string;
  /** How many things (the red count adds these up). */
  count: number;
  /** About how many points today's Life Score goes up when it's done. */
  gain: number;
  /** The measure it raises, to open it. */
  metric: MetricId;
};
export type LifeRung = { label: string; min: number; reached: boolean; need: number; how: string };
export type LifeAreaRow = { id: AreaId; name: string; color: string; today: number | null; week: number | null; lastWeek: number | null; month: number | null; best: number | null };
export type LifeMover = { id: MetricId; name: string; color: string; score: number; change: number };
export type LifeInsights = {
  left: LifeLeft[];
  /** Things left to track today: the red count until it's 0. */
  leftCount: number;
  /** What Excellent, Good and Fair take today. */
  ladder: LifeRung[];
  /** How to improve, most useful first. */
  improve: string[];
  summary: { today: string; week: string; month: string };
  areas: LifeAreaRow[];
  /** The measures that moved most in the last 7 days, up and down. */
  risers: LifeMover[]; fallers: LifeMover[];
};

export const RATINGS: [string, number][] = [["Excellent", 85], ["Good", 70], ["Fair", 50]];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const color = (area: AreaId) => AREAS.find((a) => a.id === area)?.color ?? "#64748b";
const meanOf = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : xs.length <= 3 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : `${xs.slice(0, 3).join(", ")} and ${xs.length - 3} more`);
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const dayName = (d: string) => WEEKDAYS[new Date(`${d}T12:00:00`).getDay()];

export function lifeInsights(input: LifeInput, r: LifeScoreResult, today: string): LifeInsights {
  const off = new Set(input.data.settings.off ?? []);
  const on = (id: MetricId) => !off.has(id) && r.metrics.some((m) => m.id === id);
  const f = factsFor(input, today);
  const checkIn = input.data.days[today];
  const byId = new Map(r.metrics.map((m) => [m.id, m] as const));

  // How much raising one measure to 100 lifts today's Life Score: its share of its area, the area's share of the score.
  const areasWithData = r.areas.filter((a) => a.score !== null).length || 1;
  const inArea = (area: AreaId) => r.metrics.filter((m) => m.area === area && m.score !== null).length || 1;
  const lift = (id: MetricId) => {
    const m = byId.get(id);
    if (!m) return 0;
    const has = m.score !== null;
    return ((100 - (m.score ?? 0)) / (has ? inArea(m.area) : inArea(m.area) + 1)) / (r.areas.find((a) => a.id === m.area)?.score === null ? areasWithData + 1 : areasWithData);
  };

  // ——— What's left today ———
  const left: LifeLeft[] = [];
  const add = (metric: MetricId, id: string, name: string, what: string, count = 1, extra: MetricId[] = []) => {
    if (!on(metric)) return;
    const gain = Math.max(1, Math.round([metric, ...extra].filter(on).reduce((a, m) => a + lift(m), 0)));
    left.push({ id, name, color: color(byId.get(metric)!.area), what, count, gain, metric });
  };
  const CHECKIN: [keyof NonNullable<typeof checkIn>, string, MetricId][] = [["happy", "how happy", "happy"], ["stress", "stress", "calm"], ["energy", "energy", "energy"], ["connect", "how connected", "connect"], ["screen", "screen time", "screen"], ["outdoors", "time outside", "outdoors"]];
  if (!checkIn) add("happy", "checkin", "Daily check-in", "How you feel, people, faith, screens and food (one minute)", 1, ["calm", "energy", "connect", "faith", "screen", "outdoors"]);
  else {
    const missing = CHECKIN.filter(([k, , m]) => on(m) && checkIn[k] === undefined);
    if (missing.length) add(missing[0][2], "checkin", "Finish your check-in", `Add ${listOf(missing.map(([, w]) => w))}`, 1, missing.slice(1).map(([, , m]) => m));
  }
  if (f.sleep === undefined) add("sleep", "sleep", "Sleep", "Log last night's sleep");
  const goal = input.data.settings.stepGoal || 8000;
  if (f.steps !== undefined && f.steps < goal) add("steps", "steps", "Steps", `${n(goal - f.steps)} more steps`);
  if ((f.exercise ?? 0) < 30) add("exercise", "exercise", "Exercise", f.exercise ? `${30 - f.exercise} more minutes of exercise` : "Log some exercise (30 minutes is a full day)");
  if (f.kcal === undefined) add("food", "food", "Food", "Log what you've eaten today");
  if (!f.grateful) add("gratitude", "gratitude", "Gratitude", "Write down 3 things you're grateful for");
  if (f.habits !== undefined && f.habits < 1 && input.habits.length) { const k = input.habits.length - Math.round(f.habits * input.habits.length); add("habits", "habits", "Habits", `${k} habit${k === 1 ? "" : "s"} left today`, k); }
  const open = input.tasks.filter((t) => t.due === today && !t.done).length;
  if (open) add("checklist", "checklist", "To-dos", `${open} to-do${open === 1 ? "" : "s"} left today`, open);
  if (!f.mindful && byId.get("mindful")?.score !== null && byId.has("mindful")) add("mindful", "mindful", "Mindful", "A few quiet minutes: breathe, pray or meditate");
  left.sort((a, b) => b.gain - a.gain || a.count - b.count);
  const leftCount = left.reduce((a, l) => a + l.count, 0);

  // ——— What each rating needs ———
  const now = r.score;
  const raisable = r.metrics.filter((m) => m.score !== null && m.score < 100).map((m) => ({ m, gain: lift(m.id) })).sort((a, b) => b.gain - a.gain);
  const ladder: LifeRung[] = RATINGS.map(([label, min]) => {
    if (now === null) return { label, min, reached: false, need: min, how: "Check in or log something to get a Life Score" };
    if (now >= min) return { label, min, reached: true, need: 0, how: "Reached" };
    let s = now; const names: string[] = [];
    for (const x of raisable) { if (s >= min) break; s += x.gain; names.push(x.m.name); }
    return s >= min
      ? { label, min, reached: false, need: min - now, how: `Raise ${listOf(names)}` }
      : { label, min, reached: false, need: min - now, how: "More than one day can do: keep raising your lowest measures this week" };
  });

  // ——— Each area: today, this week, last week, the month ———
  const len = r.series.length;
  const slice = (s: (number | null)[], from: number, to: number) => s.slice(Math.max(0, len + from), len + to || undefined);
  const areas: LifeAreaRow[] = r.areas.map((a) => ({
    id: a.id, name: a.name, color: a.color, today: a.score,
    week: meanOf(slice(a.series, -7, 0)), lastWeek: meanOf(slice(a.series, -14, -7)), month: meanOf(a.series),
    best: a.series.reduce<number | null>((b, v) => (v !== null && (b === null || v > b) ? v : b), null),
  }));
  const movers = r.metrics.filter((m) => m.score !== null && m.change !== null && m.change !== 0).map((m) => ({ id: m.id, name: m.name, color: color(m.area), score: m.score as number, change: m.change as number }));
  const risers = movers.filter((m) => m.change > 0).sort((a, b) => b.change - a.change).slice(0, 3);
  const fallers = movers.filter((m) => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 3);

  // ——— How to improve ———
  const improve: string[] = [];
  if (left[0]) improve.push(`Today: ${left[0].what.charAt(0).toLowerCase()}${left[0].what.slice(1)} (about +${left[0].gain}).`);
  if (r.focus && r.focus.score !== null) {
    const def = METRICS.find((m) => m.id === r.focus!.id);
    improve.push(`${r.focus.name} is your lowest at ${r.focus.score}.${def?.improve[0] ? ` ${def.improve[0]}` : ""}`);
  }
  const weakArea = [...areas].filter((a) => a.week !== null).sort((a, b) => (a.week as number) - (b.week as number))[0];
  if (weakArea && (weakArea.week as number) < 70 && weakArea.id !== byId.get(r.focus?.id as MetricId)?.area) improve.push(`${weakArea.name} is your weakest area this week (${weakArea.week}): ${AREAS.find((a) => a.id === weakArea.id)?.blurb.toLowerCase()}.`);
  for (const m of fallers.slice(0, 2)) if (m.change <= -10) improve.push(`${m.name} dropped ${-m.change} points this week. ${METRICS.find((d) => d.id === m.id)?.improve[0] ?? ""}`.trim());
  if (r.streak === 0 && !checkIn) improve.push("Check in each day: half your score comes from how you feel, people, faith and screens.");
  if (!improve.length && now !== null) improve.push("You're in great shape. Keep your streak going tomorrow.");

  // ——— Summaries ———
  const week = meanOf(slice(r.series, -7, 0)), lastWeek = meanOf(slice(r.series, -14, -7)), month = meanOf(r.series);
  const yesterday = r.series[len - 2] ?? null;
  const days7 = r.dates.slice(-7).map((d, i) => [d, r.series[len - 7 + i]] as const).filter(([, v]) => v !== null) as [string, number][];
  const best7 = [...days7].sort((a, b) => b[1] - a[1])[0], worst7 = [...days7].sort((a, b) => a[1] - b[1])[0];
  const ranked = areas.filter((a) => a.week !== null).sort((a, b) => (b.week as number) - (a.week as number));
  const days30 = r.dates.map((d, i) => [d, r.series[i]] as const).filter(([, v]) => v !== null) as [string, number][];
  const bestDay = [...days30].sort((a, b) => b[1] - a[1])[0];
  const firstWeek = meanOf(r.series.slice(0, 7)), lastWk = meanOf(r.series.slice(-7));
  const summary = {
    today: now === null ? "No Life Score yet today. Check in or sync your health data to start."
      : `${now} (${labelFor(now)})${yesterday !== null ? `, ${now === yesterday ? "the same as" : now > yesterday ? `up ${now - yesterday} from` : `down ${yesterday - now} from`} yesterday` : ""}. ${leftCount ? `${leftCount} thing${leftCount === 1 ? "" : "s"} left to track.` : "Everything's tracked for today."}`,
    week: week === null ? "Nothing scored this week yet."
      : [`Averaging ${week} (${labelFor(week)})${lastWeek !== null ? `, ${week === lastWeek ? "the same as" : week > lastWeek ? `up ${week - lastWeek} from` : `down ${lastWeek - week} from`} last week` : ""}.`,
         days7.length > 1 ? `Best day ${dayName(best7[0])} (${best7[1]}), toughest ${dayName(worst7[0])} (${worst7[1]}).` : "",
         ranked.length > 1 ? `Strongest area: ${ranked[0].name} (${ranked[0].week}). Needs the most care: ${ranked[ranked.length - 1].name} (${ranked[ranked.length - 1].week}).` : ""].filter(Boolean).join(" "),
    month: month === null ? "Nothing scored in the last 30 days yet."
      : [`30-day average ${month} (${labelFor(month)}) across ${days30.length} scored day${days30.length === 1 ? "" : "s"}.`,
         bestDay ? `Best day ${new Date(`${bestDay[0]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${bestDay[1]}).` : "",
         firstWeek !== null && lastWk !== null && days30.length >= 14 ? `${lastWk >= firstWeek ? `Up ${lastWk - firstWeek}` : `Down ${firstWeek - lastWk}`} points since the start of the month.` : "",
         r.streak ? `${r.streak}-day check-in streak.` : ""].filter(Boolean).join(" "),
  };

  return { left, leftCount, ladder, improve: improve.slice(0, 5), summary, areas, risers, fallers };
}

/** Life Score for the home-screen widgets (native/widget-extension/DuoScores.swift reads the "duo.scores" slot):
 *  today, this week, this year (by month) and each area, with what's left in red. `year` is lifeScore() over the
 *  days of this year so far. */
export function lifeWidgetData(r: LifeScoreResult, year: LifeScoreResult, ins: LifeInsights, today: string) {
  const d = new Date(`${today}T12:00:00`);
  const todayIndex = (d.getDay() + 6) % 7, monthIndex = d.getMonth();
  const monday = plusDays(today, -todayIndex);
  const at = new Map(year.dates.map((x, i) => [x, year.series[i]] as const));
  const weekDays = Array.from({ length: 7 }, (_, i) => { const x = plusDays(monday, i); return x <= today ? at.get(x) ?? -1 : -1; });
  const months = Array.from({ length: 12 }, (_, m) => (m > monthIndex ? -1 : meanOf(year.dates.filter((x) => new Date(`${x}T12:00:00`).getMonth() === m).map((x) => at.get(x) ?? null)) ?? -1));
  const z = (v: number | null) => Math.max(0, v ?? 0);
  /** The best rating still in reach today. */
  const rung = ins.ladder.find((x) => !x.reached && x.how.startsWith("Raise"));
  const week = meanOf(weekDays.map((v) => (v < 0 ? null : v)));
  const yearAvg = meanOf(year.series);
  let streak = 0;
  for (const x of lastDays(today, 400).reverse()) { const v = at.get(x); if (v !== undefined && v !== null && v >= 70) streak++; else if (x !== today) break; }
  return {
    today: z(r.score), week: z(week), year: z(yearAvg), overall: z(meanOf([r.score, week, yearAvg])),
    categories: r.areas.filter((a) => a.score !== null).map((a) => ({ name: a.name, percent: a.score as number, color: a.color })),
    weekDays, todayIndex, months, monthIndex, streak,
    next: ins.left[0] ? `${ins.left[0].name}: ${ins.left[0].what}` : "",
    tip: rung ? `${rung.how} for ${rung.label}` : ins.improve[0] ?? "",
    date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    leftCount: ins.leftCount,
    left: ins.left.slice(0, 4).map(({ name, what, color, gain }) => ({ name, what, color, gain })),
  };
}
