// Arise Fit's numbers: every stat the Pro+ layout shows and the AI is given, worked out from a person's
// own data (shared/fit.ts). Pure functions, so the phone, the server and tests all get the same answers.
// Weights stay in the person's own units (lb or kg); distances are in km (the app shows miles when asked).
import { CATALOG_BY_ID, PROGRAM_BY_ID, dayKey, e1rm, fromKg, goals, type FitData, type Workout } from "./fit";
import { sleepStats } from "./fitSleep";
import { readiness } from "./fitReadiness";

const DAY = 864e5;
const parse = (k: string) => new Date(`${k.slice(0, 10)}T12:00:00`);
const keyOf = (v: string | Date) => (typeof v === "string" ? dayKey(new Date(v)) : dayKey(v));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const ago = (now: Date, n: number) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
/** Least-squares slope of ys against 0..n-1 (units per step). */
export function slope(ys: number[]): number {
  const n = ys.length; if (n < 2) return 0;
  const mx = (n - 1) / 2, my = avg(ys);
  let num = 0, den = 0;
  ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
  return den ? num / den : 0;
}

/** Strength sessions: everything saved as a workout except the yoga, meditation and mobility sessions. */
export const isSession = (w: Workout) => /^session-/.test(w.programId ?? "");
export const isLift = (w: Workout) => !isSession(w);
const doneSets = (w: Workout) => w.exercises.flatMap((e) => e.sets.filter((s) => s.done && !s.warm && s.reps > 0));
export const volumeOf = (w: Workout) => sum(doneSets(w).map((s) => s.reps * s.weight));

export type WeekPoint = { label: string; start: string; count: number; volume: number; sets: number; mins: number };
export type LiftStat = { exId: string; name: string; e1rm: number; weight: number; reps: number; date: string; sessions: number; series: number[]; change: number | null; in4w: number | null };
export type MuscleStat = { muscle: string; sets7: number; sets30: number; pct: number };
export type Insights = {
  units: "lb" | "kg";
  train: {
    total: number; week: number; month: number; year: number; last7: number; last30: number; perWeek: number;
    streak: number; longestStreak: number; restDays: number | null; lastDate: string | null; favDay: string | null;
    avgMins: number; longestMins: number; totalHours: number; avgSets: number; totalSets: number; totalReps: number;
    volume: number; volume30: number; avgVolume: number; bestVolume: number; consistency: number;
    weeks: WeekPoint[]; heat: number[]; byWeekday: number[]; sessionsTotal: number; sessionMins: number;
  };
  strength: { lifts: LiftStat[]; prs30: number; prsTotal: number; exercisesTried: number; heaviest: { name: string; weight: number; reps: number } | null };
  muscles: MuscleStat[];
  cardio: { runs: number; km: number; hours: number; paceSecPerKm: number | null; longestKm: number; weekKm: number; monthKm: number; climbM: number; byKind: Record<string, number>; kmSeries: number[] };
  body: { kg: number | null; startKg: number | null; change7: number | null; change30: number | null; change90: number | null; goalKg: number | null; toGoalKg: number | null; weeklyKg: number | null; bmi: number | null; series: number[]; etaDays: number | null; entries: number };
  food: { today: { kcal: number; p: number; c: number; f: number }; goal: { kcal: number; p: number; c: number; f: number; tdee: number }; avg7: { kcal: number; p: number; c: number; f: number }; daysLogged7: number; onTarget7: number; loggingStreak: number; topFoods: { name: string; times: number }[]; meals: Record<string, number>; kcalSeries: number[]; bestProteinDay: number };
  water: { todayMl: number; goalMl: number; avg7Ml: number; daysHit7: number; bestMl: number; series: number[] };
  sleep: { nights: number; avg7: number; avg30: number; debt7: number; hit7: number; bedSpread: number | null; best: number | null; worst: number | null; goal: number; series: number[] };
  fasting: { count: number; longestH: number; avgH: number; last7: number; active: boolean };
  program: { name: string; done: number; total: number; pct: number; weeksIn: number } | null;
  readiness: { score: number; word: string };
  forecast: { weightIn4w: number | null; goalDate: string | null; liftsIn4w: { name: string; now: number; then: number }[]; sessionsThisWeekLeft: number; onPace: boolean | null };
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function streaks(days: Set<string>, now: Date): { current: number; longest: number } {
  // Current: back from today (or yesterday, if today isn't trained yet). Longest: the best run ever.
  let cur = 0; const d = ago(now, 0);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { cur++; d.setDate(d.getDate() - 1); }
  const sorted = [...days].sort(); let longest = 0, run = 0, prev = 0;
  for (const k of sorted) { const t = parse(k).getTime(); run = prev && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = t; }
  return { current: cur, longest };
}

export function computeInsights(data: FitData, now = new Date()): Insights {
  const units = data.profile.units;
  const all = data.workouts;
  const lifts = all.filter(isLift);
  const sessions = all.filter(isSession);
  const today = dayKey(now);
  const monday = ago(now, (now.getDay() + 6) % 7);
  const within = (w: { date: string }, days: number) => new Date(w.date).getTime() >= ago(now, days - 1).getTime() - 12 * 3600_000;
  const liftDays = new Set(lifts.map((w) => keyOf(w.date)));
  const st = streaks(liftDays, now);
  const sets = lifts.flatMap(doneSets);

  // ── Training ──
  const weeks: WeekPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(monday); start.setDate(monday.getDate() - i * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const inWeek = lifts.filter((w) => { const t = new Date(w.date).getTime(); return t >= start.getTime() - 12 * 3600_000 && t < end.getTime() - 12 * 3600_000; });
    weeks.push({ label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), start: dayKey(start), count: new Set(inWeek.map((w) => keyOf(w.date))).size, volume: Math.round(sum(inWeek.map(volumeOf))), sets: sum(inWeek.map((w) => doneSets(w).length)), mins: Math.round(sum(inWeek.map((w) => w.secs)) / 60) });
  }
  const heat: number[] = [];
  for (let i = 83; i >= 0; i--) { const k = dayKey(ago(now, i)); heat.push(lifts.filter((w) => keyOf(w.date) === k).length); }
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const w of lifts) byWeekday[new Date(w.date).getDay()]++;
  const favIdx = byWeekday.indexOf(Math.max(...byWeekday));
  const last = [...lifts].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const secs = lifts.map((w) => w.secs).filter((n) => n > 0);
  const vols = lifts.map(volumeOf);
  const target = data.program ? PROGRAM_BY_ID.get(data.program.id)?.daysPerWeek ?? 3 : 3;

  // ── Strength ──
  const byEx = new Map<string, { name: string; pts: { t: number; est: number; weight: number; reps: number; date: string }[] }>();
  for (const w of [...lifts].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) for (const e of w.exercises) {
    const ds = e.sets.filter((s) => s.done && !s.warm && s.reps > 0); if (!ds.length) continue;
    const top = ds.reduce((b, s) => (e1rm(s.weight, s.reps) >= e1rm(b.weight, b.reps) ? s : b), ds[0]);
    const cur = byEx.get(e.exId) ?? { name: e.name, pts: [] };
    cur.pts.push({ t: Date.parse(w.date), est: e1rm(top.weight, top.reps) || top.weight, weight: top.weight, reps: top.reps, date: w.date });
    byEx.set(e.exId, cur);
  }
  const liftStats: LiftStat[] = [...byEx.entries()].map(([exId, v]) => {
    const best = v.pts.reduce((b, p) => (p.est > b.est ? p : b), v.pts[0]);
    const series = v.pts.slice(-10).map((p) => Math.round(p.est));
    const old = v.pts.filter((p) => p.t <= ago(now, 56).getTime()); const base = old.length ? old[old.length - 1].est : v.pts.length > 1 ? v.pts[0].est : 0;
    const perStep = slope(series), future = v.pts.length >= 3 ? Math.round(Math.max(best.est, series[series.length - 1] + perStep * 4)) : null;
    return { exId, name: CATALOG_BY_ID.get(exId)?.name ?? v.name, e1rm: Math.round(best.est), weight: best.weight, reps: best.reps, date: best.date, sessions: v.pts.length, series, change: base > 0 ? Math.round(((series[series.length - 1] - base) / base) * 100) : null, in4w: future };
  }).sort((a, b) => b.sessions - a.sessions || b.e1rm - a.e1rm);
  let prs30 = 0, prsTotal = 0;
  for (const v of byEx.values()) { let top = 0; for (const p of v.pts) { if (p.est > top) { if (top > 0) { prsTotal++; if (Date.now() - p.t < 30 * DAY) prs30++; } top = p.est; } } }
  const heaviest = sets.length ? sets.reduce((b, s) => (s.weight > b.weight ? s : b), sets[0]) : null;
  const heaviestName = heaviest ? lifts.flatMap((w) => w.exercises).find((e) => e.sets.includes(heaviest))?.name : undefined;

  // ── Muscles ──
  const mus = new Map<string, { s7: number; s30: number }>();
  for (const w of lifts) for (const e of w.exercises) {
    const m = CATALOG_BY_ID.get(e.exId)?.muscle ?? "other"; const n = e.sets.filter((s) => s.done && !s.warm).length;
    const c = mus.get(m) ?? { s7: 0, s30: 0 };
    if (within(w, 7)) c.s7 += n; if (within(w, 30)) c.s30 += n; mus.set(m, c);
  }
  const mTotal = Math.max(1, sum([...mus.values()].map((c) => c.s30)));
  const muscles: MuscleStat[] = [...mus.entries()].filter(([, c]) => c.s30 > 0).map(([muscle, c]) => ({ muscle, sets7: c.s7, sets30: c.s30, pct: Math.round((c.s30 / mTotal) * 100) })).sort((a, b) => b.sets30 - a.sets30);

  // ── Cardio ──
  const runs = data.runs ?? [];
  const km = sum(runs.map((r) => r.meters)) / 1000, rsecs = sum(runs.map((r) => r.secs));
  const runOnly = runs.filter((r) => r.kind === "run" && r.meters > 200);
  const kmSeries = weeks.map((w) => { const s = parse(w.start).getTime(); return Math.round(sum(runs.filter((r) => { const t = new Date(r.date).getTime(); return t >= s - 12 * 3600_000 && t < s + 7 * DAY - 12 * 3600_000; }).map((r) => r.meters)) / 100) / 10; });
  const byKind: Record<string, number> = {}; for (const r of runs) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;

  // ── Body ──
  const ws = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const kg = ws.length ? ws[ws.length - 1].kg : null;
  const onOrBefore = (days: number) => { const k = dayKey(ago(now, days)); const p = [...ws].reverse().find((x) => x.date.slice(0, 10) <= k); return p ? p.kg : null; };
  const diff = (days: number) => { const b = onOrBefore(days); return kg != null && b != null ? r1(fromKg(kg - b, units)) : null; };
  const recentW = ws.filter((x) => x.date.slice(0, 10) >= dayKey(ago(now, 42)));
  const perDay = recentW.length >= 3 ? slope(recentW.map((x) => x.kg)) * (recentW.length / Math.max(1, (parse(recentW[recentW.length - 1].date).getTime() - parse(recentW[0].date).getTime()) / DAY)) : 0;
  const weeklyKg = recentW.length >= 3 ? Math.round(perDay * 7 * 100) / 100 : null;
  const goalKg = data.profile.goalKg ?? null;
  const toGoal = kg != null && goalKg != null ? r1(goalKg - kg) : null;
  const etaDays = toGoal != null && perDay !== 0 && Math.sign(toGoal) === Math.sign(perDay) ? Math.round(Math.abs(toGoal / perDay)) : null;
  const h = data.profile.heightCm;

  // ── Food ──
  const g = goals(data.profile, kg ?? undefined, now);
  const dayFood = (k: string) => { const f = data.foods.filter((x) => x.date === k); return { kcal: sum(f.map((x) => x.kcal * x.servings)), p: sum(f.map((x) => x.p * x.servings)), c: sum(f.map((x) => x.c * x.servings)), f: sum(f.map((x) => x.f * x.servings)), n: f.length }; };
  const last7 = Array.from({ length: 7 }, (_, i) => dayKey(ago(now, 6 - i))).map(dayFood);
  const logged = last7.filter((d) => d.n > 0);
  let lstreak = 0; { const d = ago(now, 0); if (!dayFood(dayKey(d)).n) d.setDate(d.getDate() - 1); while (dayFood(dayKey(d)).n && lstreak < 400) { lstreak++; d.setDate(d.getDate() - 1); } }
  const counts = new Map<string, number>(); for (const f of data.foods) counts.set(f.name, (counts.get(f.name) ?? 0) + 1);
  const meals: Record<string, number> = {}; for (const f of data.foods) if (within(f, 30)) meals[f.meal] = (meals[f.meal] ?? 0) + f.kcal * f.servings;
  const allDays = new Set(data.foods.map((f) => f.date));
  const bestProtein = Math.max(0, ...[...allDays].map((k) => dayFood(k).p));

  // ── Water, sleep, fasting ──
  const wDays = Array.from({ length: 7 }, (_, i) => data.water[dayKey(ago(now, 6 - i))] ?? 0);
  const sl7 = sleepStats(data.sleep, 7), sl30 = sleepStats(data.sleep, 30);
  const nightH = (data.sleep?.nights ?? []).map((n) => n.asleepMin != null ? n.asleepMin / 60 : (((n.wake - n.bed) / 3_600_000)));
  const fasts = data.fasting?.log ?? [];
  const fastH = fasts.map((f) => (Date.parse(f.end) - Date.parse(f.start)) / 3_600_000).filter((n) => n > 0);

  // ── Program ──
  const prog = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined;
  const progTotal = prog ? prog.days.length * prog.weeks : 0;

  const ready = readiness(data, now);
  const weekCount = new Set(lifts.filter((w) => new Date(w.date).getTime() >= monday.getTime() - 12 * 3600_000).map((w) => keyOf(w.date))).size;

  return {
    units,
    train: {
      total: lifts.length, week: weekCount, month: new Set(lifts.filter((w) => within(w, 30)).map((w) => keyOf(w.date))).size,
      year: lifts.filter((w) => new Date(w.date).getFullYear() === now.getFullYear()).length, last7: lifts.filter((w) => within(w, 7)).length, last30: lifts.filter((w) => within(w, 30)).length,
      perWeek: r1(sum(weeks.slice(-8).map((w) => w.count)) / 8), streak: st.current, longestStreak: st.longest,
      restDays: last ? Math.max(0, Math.round((ago(now, 0).getTime() - parse(keyOf(last.date)).getTime()) / DAY)) : null, lastDate: last ? last.date : null,
      favDay: byWeekday[favIdx] > 0 ? WEEKDAYS[favIdx] : null, avgMins: Math.round(avg(secs) / 60), longestMins: Math.round(Math.max(0, ...secs) / 60), totalHours: r1(sum(secs) / 3600),
      avgSets: r1(lifts.length ? sets.length / lifts.length : 0), totalSets: sets.length, totalReps: sum(sets.map((s) => s.reps)),
      volume: Math.round(sum(vols)), volume30: Math.round(sum(lifts.filter((w) => within(w, 30)).map(volumeOf))), avgVolume: Math.round(avg(vols)), bestVolume: Math.round(Math.max(0, ...vols)),
      consistency: Math.round(Math.min(1, sum(weeks.slice(-8).map((w) => Math.min(w.count, target))) / (8 * target)) * 100),
      weeks, heat, byWeekday, sessionsTotal: sessions.length, sessionMins: Math.round(sum(sessions.map((w) => w.secs)) / 60),
    },
    strength: { lifts: liftStats, prs30, prsTotal, exercisesTried: byEx.size, heaviest: heaviest ? { name: heaviestName ?? "a lift", weight: heaviest.weight, reps: heaviest.reps } : null },
    muscles,
    cardio: { runs: runs.length, km: r1(km), hours: r1(rsecs / 3600), paceSecPerKm: runOnly.length ? Math.round(sum(runOnly.map((r) => r.secs)) / (sum(runOnly.map((r) => r.meters)) / 1000)) : null,
      longestKm: r1(Math.max(0, ...runs.map((r) => r.meters)) / 1000), weekKm: r1(sum(runs.filter((r) => new Date(r.date).getTime() >= monday.getTime() - 12 * 3600_000).map((r) => r.meters)) / 1000),
      monthKm: r1(sum(runs.filter((r) => within(r, 30)).map((r) => r.meters)) / 1000), climbM: Math.round(sum(runs.map((r) => r.climb ?? 0))), byKind, kmSeries },
    body: { kg, startKg: ws.length ? ws[0].kg : null, change7: diff(7), change30: diff(30), change90: diff(90), goalKg, toGoalKg: toGoal, weeklyKg, bmi: kg != null && h ? r1(kg / (h / 100) ** 2) : null, series: ws.slice(-30).map((x) => r1(fromKg(x.kg, units))), etaDays, entries: ws.length },
    food: { today: (({ kcal, p, c, f }) => ({ kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), f: Math.round(f) }))(dayFood(today)), goal: { kcal: Math.round(g.kcal), p: Math.round(g.p), c: Math.round(g.c), f: Math.round(g.f), tdee: Math.round(g.tdee) },
      avg7: { kcal: Math.round(avg(logged.map((d) => d.kcal))), p: Math.round(avg(logged.map((d) => d.p))), c: Math.round(avg(logged.map((d) => d.c))), f: Math.round(avg(logged.map((d) => d.f))) },
      daysLogged7: logged.length, onTarget7: logged.filter((d) => Math.abs(d.kcal - g.kcal) <= g.kcal * 0.1).length, loggingStreak: lstreak,
      topFoods: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, times]) => ({ name, times })), meals: Object.fromEntries(Object.entries(meals).map(([k, v]) => [k, Math.round(v)])),
      kcalSeries: last7.map((d) => Math.round(d.kcal)), bestProteinDay: Math.round(bestProtein) },
    water: { todayMl: data.water[today] ?? 0, goalMl: data.profile.waterGoalMl, avg7Ml: Math.round(avg(wDays)), daysHit7: wDays.filter((n) => n >= data.profile.waterGoalMl * 0.95).length, bestMl: Math.max(0, ...Object.values(data.water)), series: wDays },
    sleep: { nights: data.sleep?.nights.length ?? 0, avg7: r1(sl7.avg), avg30: r1(sl30.avg), debt7: r1(sl7.debt), hit7: sl7.hit, bedSpread: sl7.bedSpread ?? null, best: nightH.length ? r1(Math.max(...nightH)) : null, worst: nightH.length ? r1(Math.min(...nightH)) : null, goal: data.sleep?.goalH ?? 8,
      series: (data.sleep?.nights ?? []).slice(-14).map((n) => r1(n.asleepMin != null ? n.asleepMin / 60 : (n.wake - n.bed) / 3_600_000)) },
    fasting: { count: fasts.length, longestH: r1(Math.max(0, ...fastH)), avgH: r1(avg(fastH)), last7: fasts.filter((f) => Date.parse(f.end) > Date.now() - 7 * DAY).length, active: !!data.fasting?.start },
    program: prog && data.program ? { name: prog.name, done: data.program.done.length, total: progTotal, pct: progTotal ? Math.round((data.program.done.length / progTotal) * 100) : 0, weeksIn: Math.max(1, Math.ceil((Date.now() - Date.parse(data.program.started)) / (7 * DAY))) } : null,
    readiness: { score: ready.score, word: ready.word },
    forecast: {
      weightIn4w: kg != null && weeklyKg != null ? r1(fromKg(kg + weeklyKg * 4, units)) : null,
      goalDate: etaDays != null && etaDays < 900 ? dayKey(new Date(now.getTime() + etaDays * DAY)) : null,
      liftsIn4w: liftStats.filter((l) => l.in4w != null).slice(0, 4).map((l) => ({ name: l.name, now: l.e1rm, then: l.in4w as number })),
      sessionsThisWeekLeft: Math.max(0, target - weekCount),
      onPace: data.profile.goalKg != null && weeklyKg != null && toGoal != null ? Math.sign(weeklyKg) === Math.sign(toGoal) : null,
    },
  };
}

/** The person's numbers as plain text for the AI to answer from: compact, dated, in their own units. */
export function digestForAi(data: FitData, now = new Date()): string {
  const i = computeInsights(data, now), u = i.units;
  const L: string[] = [];
  const t = i.train;
  L.push(`Today is ${now.toDateString()}. Units: ${u}. Goal: ${data.profile.goal}${i.body.goalKg != null ? `, goal weight ${r1(fromKg(i.body.goalKg, u))} ${u}` : ""}.`);
  L.push(`TRAINING: ${t.total} strength workouts total, ${t.week} this week, ${t.last30} in the last 30 days, about ${t.perWeek}/week lately, streak ${t.streak} days (best ${t.longestStreak}). Last trained ${t.lastDate ? t.lastDate.slice(0, 10) : "never"}${t.restDays != null ? ` (${t.restDays} days ago)` : ""}. Usual day: ${t.favDay ?? "none"}. Avg ${t.avgMins} min, ${t.avgSets} sets. Total volume ${t.volume} ${u}; last 30 days ${t.volume30} ${u}. Consistency ${t.consistency}%.`);
  L.push(`WEEKLY (oldest to newest, workouts/volume): ${t.weeks.map((w) => `${w.start.slice(5)}: ${w.count}/${w.volume}`).join("; ")}.`);
  L.push(`LIFTS (best estimated 1-rep max, ${u}; sessions; change over 8 weeks; projected in 4 weeks): ${i.strength.lifts.slice(0, 15).map((l) => `${l.name}: ${l.e1rm} (best set ${l.weight}x${l.reps} on ${l.date.slice(0, 10)}), ${l.sessions} sessions${l.change != null ? `, ${l.change >= 0 ? "+" : ""}${l.change}%` : ""}${l.in4w != null ? `, projected ${l.in4w}` : ""}`).join("; ") || "none yet"}. PRs in last 30 days: ${i.strength.prs30}.`);
  L.push(`MUSCLES (sets in last 30 days): ${i.muscles.map((m) => `${m.muscle} ${m.sets30} (${m.sets7} this week)`).join(", ") || "none"}.`);
  const recent = [...data.workouts].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 8);
  L.push(`RECENT WORKOUTS: ${recent.map((w) => `${w.date.slice(0, 10)} ${w.name} (${Math.round(w.secs / 60)} min; ${w.exercises.map((e) => `${e.name} ${e.sets.filter((s) => s.done && !s.warm).map((s) => `${s.reps}x${s.weight}`).join(",")}`).join("; ")})`).join(" | ") || "none"}.`);
  if (i.cardio.runs) L.push(`CARDIO: ${i.cardio.runs} outings, ${i.cardio.km} km, ${i.cardio.hours} h, avg run pace ${i.cardio.paceSecPerKm ? `${Math.floor(i.cardio.paceSecPerKm / 60)}:${String(i.cardio.paceSecPerKm % 60).padStart(2, "0")}/km` : "n/a"}, longest ${i.cardio.longestKm} km, this week ${i.cardio.weekKm} km.`);
  const b = i.body;
  if (b.kg != null) L.push(`BODY: now ${r1(fromKg(b.kg, u))} ${u}; change 7d ${b.change7 ?? "n/a"}, 30d ${b.change30 ?? "n/a"}, 90d ${b.change90 ?? "n/a"} ${u}; trend ${b.weeklyKg != null ? r1(fromKg(b.weeklyKg, u)) : "n/a"} ${u}/week; BMI ${b.bmi ?? "n/a"}${b.etaDays != null ? `; at this pace the goal is ~${b.etaDays} days away` : ""}.`);
  const f = i.food;
  L.push(`FOOD: today ${f.today.kcal} kcal (goal ${f.goal.kcal}), protein ${f.today.p} g (goal ${f.goal.p}). 7-day average ${f.avg7.kcal} kcal, ${f.avg7.p} g protein, ${f.daysLogged7}/7 days logged, ${f.onTarget7} on target. Common foods: ${f.topFoods.map((x) => x.name).join(", ") || "none"}.`);
  L.push(`WATER: today ${i.water.todayMl} ml of ${i.water.goalMl}; 7-day average ${i.water.avg7Ml} ml; goal hit ${i.water.daysHit7}/7 days.`);
  L.push(`SLEEP: goal ${i.sleep.goal} h; 7-day average ${i.sleep.avg7} h, 30-day ${i.sleep.avg30} h, debt ${i.sleep.debt7} h this week; best ${i.sleep.best ?? "n/a"}, worst ${i.sleep.worst ?? "n/a"}.`);
  if (i.fasting.count) L.push(`FASTING: ${i.fasting.count} fasts, longest ${i.fasting.longestH} h, average ${i.fasting.avgH} h.`);
  if (i.program) L.push(`PROGRAM: ${i.program.name}, ${i.program.done} of ${i.program.total} days done (${i.program.pct}%), week ${i.program.weeksIn}.`);
  L.push(`READINESS today: ${i.readiness.score}/100 (${i.readiness.word}).`);
  const fc = i.forecast;
  L.push(`FORECAST (simple trend lines, not promises): weight in 4 weeks ${fc.weightIn4w ?? "n/a"} ${u}; goal date ${fc.goalDate ?? "n/a"}; sessions left this week to match plan ${fc.sessionsThisWeekLeft}.`);
  return L.join("\n").slice(0, 9000);
}

/** Plain-language things worth knowing, picked from the numbers (best first). Never invents: each line comes from a stat. */
export function findings(i: Insights): string[] {
  const out: string[] = [];
  const u = i.units, t = i.train;
  if (t.total === 0) return ["Log a workout and this page fills with what your training is doing."];
  const w = t.weeks;
  const recent = w.slice(-4), before = w.slice(-8, -4);
  const rv = sum(recent.map((x) => x.volume)), bv = sum(before.map((x) => x.volume));
  if (bv > 0 && rv > 0) { const p = Math.round(((rv - bv) / bv) * 100); out.push(Math.abs(p) < 4 ? "Your training volume is steady compared with the 4 weeks before." : `Your training volume is ${p > 0 ? "up" : "down"} ${Math.abs(p)}% on the 4 weeks before.`); }
  if (t.streak >= 3) out.push(`You've trained ${t.streak} days in a row${t.streak >= t.longestStreak ? ", your longest streak yet" : ` (your best is ${t.longestStreak})`}.`);
  if (t.restDays != null && t.restDays >= 5) out.push(`It's been ${t.restDays} days since your last workout.`);
  if (t.favDay) out.push(`${t.favDay} is the day you train most.`);
  if (i.strength.prs30 > 0) out.push(`${i.strength.prs30} personal record${i.strength.prs30 === 1 ? "" : "s"} in the last 30 days.`);
  const up = [...i.strength.lifts].filter((l) => l.change != null).sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  if (up && (up.change ?? 0) > 0) out.push(`${up.name} is your fastest riser: +${up.change}% in 8 weeks (best about ${up.e1rm} ${u}).`);
  const stuck = i.strength.lifts.find((l) => l.sessions >= 4 && l.change != null && l.change <= 0);
  if (stuck) out.push(`${stuck.name} hasn't moved in 8 weeks. A small deload, or one more rep on your last set, often breaks a plateau.`);
  if (i.muscles.length >= 3) { const top = i.muscles[0], low = i.muscles[i.muscles.length - 1]; if (top.pct >= 35) out.push(`${top.muscle[0].toUpperCase()}${top.muscle.slice(1)} gets ${top.pct}% of your sets; ${low.muscle} gets ${low.pct}%.`); }
  if (i.body.change30 != null && i.body.change30 !== 0) out.push(`Your weight is ${i.body.change30 < 0 ? "down" : "up"} ${Math.abs(i.body.change30)} ${u} over 30 days.`);
  if (i.forecast.goalDate) out.push(`At your recent pace you'd reach your goal weight around ${new Date(`${i.forecast.goalDate}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`);
  if (i.food.daysLogged7 >= 3 && i.food.avg7.p > 0 && i.food.goal.p > 0) { const p = Math.round((i.food.avg7.p / i.food.goal.p) * 100); if (p < 85) out.push(`You're averaging ${p}% of your protein goal this week.`); else if (p >= 100) out.push("You're hitting your protein goal on average this week.");  }
  if (i.sleep.nights >= 3) { if (i.sleep.avg7 > 0 && i.sleep.avg7 < i.sleep.goal - 0.5) out.push(`You're sleeping ${i.sleep.avg7} h on average, ${r1(i.sleep.goal - i.sleep.avg7)} h under your goal.`); else if (i.sleep.hit7 >= 5) out.push(`You hit your sleep goal on ${i.sleep.hit7} of the last 7 nights.`); }
  if (i.water.daysHit7 >= 5) out.push(`You hit your water goal ${i.water.daysHit7} days out of 7.`);
  return out.slice(0, 8);
}
