// Life Score's Stats (client/src/components/family-hub/LifeScoreApp.tsx): everything a person tracks in Arise To Do,
// turned into numbers, charts, records and insights. One section per part of life, each with stat tiles and charts
// (bars, lines, donuts, weekday patterns, heatmaps, ranked lists), and a catalog of daily series to compare any two
// (the Explorer). Reads the whole LifeHub, the to-dos from LifeHub, WorkHub and FamilyHub, WorkHub's records, the
// Health & Fitness (Cooked) diary, Apple Health and Life Score's own check-ins, questionnaires and labs.
// Pure, so it's tested (tests/life-stats.test.ts). Everything is tolerant: missing data just leaves things out.
import { lastDays, plusDays, screeningStatus, type LifeScoreData, type LifeScoreResult } from "./lifeScore";
import { SCALES, adaRisk, le8, scoreScale, vo2Read } from "./lifeScales";

// ——— Shapes ————————————————————————————————————————————————————————————————————————————————————————————————————
export type Stat = { label: string; value: string; sub?: string };
export type Chart =
  | { kind: "bars" | "line"; title: string; values: (number | null)[]; dates: string[]; unit: string; goal?: number; color?: string }
  | { kind: "donut"; title: string; parts: { label: string; value: number; color: string }[]; unit: string }
  | { kind: "hbars"; title: string; rows: { label: string; value: number; sub?: string; color?: string }[]; unit: string }
  | { kind: "weekday"; title: string; values: (number | null)[]; unit: string; color?: string }
  | { kind: "hours"; title: string; values: number[]; unit: string; color?: string }
  | { kind: "heat"; title: string; values: (number | null)[]; dates: string[]; color?: string }
  | { kind: "progress"; title: string; rows: { label: string; value: number; sub?: string; color?: string }[] }
  | { kind: "list"; title: string; rows: { label: string; sub?: string; right?: string }[] };
export type StatSection = { id: string; name: string; color: string; icon: string; blurb: string; stats: Stat[]; charts: Chart[]; insights: string[]; empty?: string };
export type Series = { id: string; name: string; unit: string; group: string; values: Record<string, number> };

export type AnyTask = { title: string; due: string; done: boolean; createdAt?: string; completedAt?: string; list?: string; priority?: string; hub: "LifeHub" | "WorkHub" | "FamilyHub"; repeat?: string };
export type StatsInput = {
  today: string;
  family: any;
  tasks: AnyTask[];
  /** WorkHub's workspace (students, meetings, lessons…), when it could be read. */ work?: any;
  /** The Health & Fitness (Cooked) diary, when it could be read. */ fit?: any;
  ls: LifeScoreData;
  score?: LifeScoreResult;
};

// ——— Helpers ———————————————————————————————————————————————————————————————————————————————————————————————————
const COLORS = ["#7c6cf0", "#ff5a5f", "#10b981", "#f59e0b", "#0ea5e9", "#ec4899", "#14b8a6", "#8b5cf6", "#f97316", "#64748b"];
const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-US");
const money = (v: number) => `${v < 0 ? "−" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d);
const day = (d: unknown) => (isDay(d) ? d.slice(0, 10) : "");
const at = (d: string) => new Date(`${d}T12:00:00`);
const weekdayOf = (d: string) => (at(d).getDay() + 6) % 7; // Monday 0
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const arr = <T = any>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const fmtDate = (d: string) => (d ? at(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.slice(0, 4) === String(new Date().getFullYear()) ? undefined : "numeric" }) : "");
const hm = (mins: number) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
const clock = (mins: number) => { const m = ((Math.round(mins) % 1440) + 1440) % 1440, h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const daysBetween = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / 864e5);

/** Values for each of the last n days (null where none). */
const lastN = (s: Record<string, number>, today: string, n: number) => lastDays(today, n).map((d) => (d in s ? s[d] : null));
const valuesIn = (s: Record<string, number>, today: string, n: number) => lastN(s, today, n).filter((v): v is number => v !== null);
/** Average for each weekday (Monday first) over the last n days. */
function byWeekday(s: Record<string, number>, today: string, n = 90): (number | null)[] {
  const b: number[][] = [[], [], [], [], [], [], []];
  for (const d of lastDays(today, n)) if (d in s) b[weekdayOf(d)].push(s[d]);
  return b.map((x) => (x.length ? Math.round(avg(x) * 10) / 10 : null));
}
/** Longest and current run of days meeting a test. */
function streaks(days: Set<string>, today: string): { current: number; best: number } {
  let current = 0;
  for (let i = days.has(today) ? 0 : 1; days.has(plusDays(today, -i)); i++) current++;
  let best = 0, run = 0, prev = "";
  for (const d of [...days].sort()) { run = prev && plusDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return { current, best };
}
function best(s: Record<string, number>): { d: string; v: number } | null {
  let b: { d: string; v: number } | null = null;
  for (const [d, v] of Object.entries(s)) if (!b || v > b.v) b = { d, v };
  return b;
}
function lowest(s: Record<string, number>): { d: string; v: number } | null {
  let b: { d: string; v: number } | null = null;
  for (const [d, v] of Object.entries(s)) if (!b || v < b.v) b = { d, v };
  return b;
}
const add = (s: Record<string, number>, d: string, v: number) => { if (d && Number.isFinite(v)) s[d] = (s[d] ?? 0) + v; };
const change = (s: Record<string, number>, today: string, n = 7) => {
  const a = valuesIn(s, today, n), b = lastDays(plusDays(today, -n), n).map((d) => s[d]).filter((v) => v !== undefined);
  return a.length && b.length ? avg(a) - avg(b) : null;
};
const wordsIn = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const STOP = new Set("the a an and or but of to in on for with my me i is was it at by from that this so we our be are have had has just very really".split(" "));
function topWords(texts: string[], k = 8) {
  const c = new Map<string, number>();
  for (const t of texts) for (const w of t.toLowerCase().match(/[a-z']{3,}/g) ?? []) if (!STOP.has(w)) c.set(w, (c.get(w) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
}
const age = (birthYear: number | undefined, today: string) => (birthYear ? Number(today.slice(0, 4)) - birthYear : 0);

// ——— Daily series: every number tracked by day ————————————————————————————————————————————————————————————————
export function buildSeries(x: StatsInput): Series[] {
  const f = x.family ?? {}, h = x.ls.health ?? {}, c = x.ls.days ?? {}, fit = x.fit ?? {};
  const S = (id: string, name: string, unit: string, group: string): Series => ({ id, name, unit, group, values: {} });
  const out: Record<string, Series> = {};
  const put = (s: Series) => (out[s.id] = s);
  const fromHealth = (id: string, name: string, unit: string, group: string, key: string, scale = 1) => {
    const s = put(S(id, name, unit, group));
    for (const [d, v] of Object.entries(h)) { const n = (v as any)[key]; if (typeof n === "number") s.values[d] = Math.round(n * scale * 100) / 100; }
  };
  fromHealth("steps", "Steps", "steps", "Activity", "steps");
  fromHealth("miles", "Distance walked or run", "mi", "Activity", "km", 0.621371);
  fromHealth("flights", "Floors climbed", "floors", "Activity", "flights");
  fromHealth("exmin", "Exercise minutes (Watch)", "min", "Activity", "exMin");
  fromHealth("stand", "Stand hours", "h", "Activity", "stand");
  fromHealth("active", "Active calories", "kcal", "Activity", "active");
  fromHealth("rhr", "Resting heart rate", "bpm", "Heart", "rhr");
  fromHealth("hrv", "Heart rate variability", "ms", "Heart", "hrv");
  fromHealth("hravg", "Average heart rate", "bpm", "Heart", "hrAvg");
  fromHealth("vo2", "VO2 max", "ml/kg/min", "Heart", "vo2");
  fromHealth("spo2", "Blood oxygen", "%", "Heart", "spo2");
  fromHealth("resp", "Respiratory rate", "breaths/min", "Heart", "resp");
  fromHealth("deep", "Deep sleep", "min", "Sleep", "deep");
  fromHealth("rem", "REM sleep", "min", "Sleep", "rem");
  // Burned: active + resting.
  const burn = put(S("burn", "Total calories burned", "kcal", "Activity"));
  for (const [d, v] of Object.entries(h)) if (v.active !== undefined || v.basal !== undefined) burn.values[d] = (v.active ?? 0) + (v.basal ?? 0);
  // Sleep: Health, then Cooked's sleep, then the LifeHub sleep log, then the check-in.
  const sleep = put(S("sleep", "Sleep", "h", "Sleep"));
  for (const n of arr(fit.sleep?.nights)) { const d = day(n.date); if (d && n.wake > n.bed) sleep.values[d] = Math.round(((n.asleepMin ?? (n.wake - n.bed) / 60000) / 60) * 100) / 100; }
  for (const e of arr(f.sleep)) { const d = day(e.date); const m = /^(\d+):(\d+)/.exec(e.bed || ""), w = /^(\d+):(\d+)/.exec(e.wake || ""); if (d && m && w && !(d in sleep.values)) { const mins = ((+w[1] * 60 + +w[2]) - (+m[1] * 60 + +m[2]) + 1440) % 1440; sleep.values[d] = Math.round((mins / 60) * 100) / 100; } }
  for (const [d, v] of Object.entries(c)) if (v.sleep !== undefined && !(d in sleep.values)) sleep.values[d] = v.sleep;
  for (const [d, v] of Object.entries(h)) if (v.sleep !== undefined) sleep.values[d] = v.sleep;
  const bed = put(S("bedtime", "Bedtime", "hour", "Sleep"));
  for (const [d, v] of Object.entries(h)) if (v.bed !== undefined) bed.values[d] = Math.round(((18 * 60 + v.bed) / 60) * 100) / 100; // hours after midnight of the day before, 18–42
  // Food: Cooked diary + LifeHub Food & fitness + Health.
  const kcal = put(S("kcal", "Calories eaten", "kcal", "Food")), prot = put(S("protein", "Protein", "g", "Food")), carb = put(S("carbs", "Carbs", "g", "Food")), fatS = put(S("fat", "Fat", "g", "Food"));
  for (const e of arr(fit.foods)) { const d = day(e.date), m = Number(e.servings) || 1; add(kcal.values, d, (Number(e.kcal) || 0) * m); add(prot.values, d, (Number(e.p) || 0) * m); add(carb.values, d, (Number(e.c) || 0) * m); add(fatS.values, d, (Number(e.f) || 0) * m); }
  for (const e of arr(f.health?.food)) { const d = day(e.date), m = Number(e.servings) || 1; add(kcal.values, d, (Number(e.calories) || 0) * m); add(prot.values, d, (Number(e.protein) || 0) * m); add(carb.values, d, (Number(e.carbs) || 0) * m); add(fatS.values, d, (Number(e.fat) || 0) * m); }
  for (const [d, v] of Object.entries(h)) if (v.eaten !== undefined && !(d in kcal.values)) kcal.values[d] = v.eaten;
  for (const s of [kcal, prot, carb, fatS]) for (const d of Object.keys(s.values)) s.values[d] = Math.round(s.values[d]);
  const water = put(S("water", "Water", "oz", "Food"));
  for (const [d, ml] of Object.entries(fit.water ?? {})) if (typeof ml === "number" && ml > 0) add(water.values, d, ml / 29.5735);
  for (const e of arr(f.health?.days)) if (e.water > 0 && !(day(e.date) in water.values)) add(water.values, day(e.date), e.water * 8);
  for (const [d, v] of Object.entries(h)) if (v.water !== undefined && !(d in water.values)) water.values[d] = v.water / 29.5735;
  for (const d of Object.keys(water.values)) water.values[d] = Math.round(water.values[d]);
  // Body.
  const weight = put(S("weight", "Weight", "lb", "Body"));
  for (const w of arr(fit.weights)) if (w.kg > 0) weight.values[day(w.date)] = Math.round(w.kg * 2.20462 * 10) / 10;
  for (const w of arr(f.health?.weights)) if (w.weight > 0) weight.values[day(w.date)] = w.weight;
  for (const [d, v] of Object.entries(h)) if (v.weight !== undefined) weight.values[d] = v.weight;
  // Mind.
  const mood = put(S("mood", "Mood (1–5)", "/5", "Mind"));
  const moodAcc: Record<string, number[]> = {};
  for (const m of arr(f.moods)) if (m.mood >= 1) (moodAcc[day(m.date)] ??= []).push(m.mood);
  for (const [d, v] of Object.entries(moodAcc)) mood.values[d] = Math.round(avg(v) * 10) / 10;
  for (const [id, name, key] of [["happy", "Happiness", "happy"], ["stress", "Stress", "stress"], ["energy", "Energy", "energy"], ["connect", "Connection", "connect"], ["faithfelt", "Closeness to God", "faithFelt"]] as const) {
    const s = put(S(id, name, "/10", id === "connect" || id === "faithfelt" ? "People & faith" : "Mind"));
    for (const [d, v] of Object.entries(c)) if (typeof (v as any)[key] === "number") s.values[d] = (v as any)[key];
  }
  for (const [id, name, key, unit, group] of [["screen", "Screen time", "screen", "h", "Time"], ["social", "Social media", "social", "min", "Time"], ["outdoors", "Time outside", "outdoors", "min", "Time"], ["produce", "Fruit & vegetables", "produce", "servings", "Food"], ["alcohol", "Alcoholic drinks", "alcohol", "drinks", "Food"]] as const) {
    const s = put(S(id, name, unit, group));
    for (const [d, v] of Object.entries(c)) if (typeof (v as any)[key] === "number") s.values[d] = (v as any)[key];
  }
  const mind = put(S("mindful", "Mindful minutes", "min", "Mind"));
  for (const m of arr(f.meditations)) add(mind.values, day(m.date), Number(m.minutes) || 0);
  for (const [d, v] of Object.entries(h)) if (v.mindful) add(mind.values, d, v.mindful);
  for (const [d, v] of Object.entries(c)) if (v.mindful) add(mind.values, d, v.mindful);
  const focus = put(S("focus", "Focus minutes", "min", "Time"));
  for (const l of arr(f.focusLog)) add(focus.values, day(l.date), Number(l.minutes) || 0);
  // Exercise minutes: check-in, LifeHub diary, Health workouts, Cooked workouts and runs.
  const ex = put(S("exercise", "Exercise", "min", "Activity"));
  for (const e of arr(f.health?.exercise)) add(ex.values, day(e.date), Number(e.minutes) || 0);
  for (const w of arr(fit.workouts)) add(ex.values, day(w.date), Math.round((Number(w.secs) || 0) / 60));
  for (const r of arr(fit.runs)) add(ex.values, day(r.date), Math.round((Number(r.secs) || 0) / 60));
  for (const [d, v] of Object.entries(h)) if (v.woMin && !(d in ex.values)) ex.values[d] = v.woMin;
  for (const [d, v] of Object.entries(c)) if (v.exercise !== undefined) ex.values[d] = Math.max(ex.values[d] ?? 0, v.exercise);
  // To-dos.
  const doneS = put(S("tasksdone", "To-dos done", "to-dos", "To-dos"));
  for (const t of x.tasks) if (t.done && t.completedAt) add(doneS.values, day(t.completedAt), 1);
  const madeS = put(S("tasksmade", "To-dos added", "to-dos", "To-dos"));
  for (const t of x.tasks) if (t.createdAt) add(madeS.values, day(t.createdAt), 1);
  // Money.
  const spend = put(S("spend", "Spending", "$", "Money"));
  for (const e of arr(f.expenses)) add(spend.values, day(e.date), Number(e.amount) || 0);
  // Writing.
  const words = put(S("words", "Journal words", "words", "Mind"));
  for (const j of arr(f.journal)) add(words.values, day(j.date), wordsIn(String(j.body ?? "")));
  const grat = put(S("gratitude", "Gratitude items", "items", "People & faith"));
  for (const g of arr(f.gratitude)) add(grat.values, day(g.date), arr(g.items).filter((i: any) => String(i).trim()).length);
  const habitsS = put(S("habits", "Habits done", "%", "Growth"));
  const habits = arr(f.habits);
  if (habits.length) { const first = habits.flatMap((hb: any) => arr<string>(hb.days)).sort()[0]; if (first) for (const d of lastDays(x.today, Math.min(400, daysBetween(first, x.today) + 1))) habitsS.values[d] = Math.round((habits.filter((hb: any) => arr(hb.days).includes(d)).length / habits.length) * 100); }
  // The Life Score itself (last 30 days).
  if (x.score) { const s = put(S("lifescore", "Life Score", "/100", "Life Score")); x.score.dates.forEach((d, i) => { const v = x.score!.series[i]; if (v !== null) s.values[d] = v; }); }
  return Object.values(out).filter((s) => Object.keys(s.values).length > 0);
}

// ——— Comparing two series (the Explorer) ——————————————————————————————————————————————————————————————————————
export function correlate(a: Series, b: Series, lag = 0): { r: number | null; n: number; points: [number, number][]; words: string } {
  const points: [number, number][] = [];
  for (const [d, va] of Object.entries(a.values)) { const vb = b.values[plusDays(d, lag)]; if (vb !== undefined) points.push([va, vb]); }
  const n = points.length;
  if (n < 5) return { r: null, n, points, words: `Needs at least 5 days with both (${n} so far).` };
  const mx = avg(points.map((p) => p[0])), my = avg(points.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [px, py] of points) { sxy += (px - mx) * (py - my); sxx += (px - mx) ** 2; syy += (py - my) ** 2; }
  if (!sxx || !syy) return { r: null, n, points, words: "One of them never changes, so there's nothing to compare yet." };
  const r = Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100;
  const strength = Math.abs(r) >= 0.7 ? "strongly" : Math.abs(r) >= 0.4 ? "clearly" : Math.abs(r) >= 0.2 ? "slightly" : "barely";
  const dir = r > 0 ? "rise together" : "move in opposite directions";
  return { r, n, points, words: Math.abs(r) < 0.2 ? `Across ${n} days, ${a.name.toLowerCase()} and ${b.name.toLowerCase()} don't move together.` : `Across ${n} days, ${a.name.toLowerCase()} and ${lag ? `the next day's ${b.name.toLowerCase()}` : b.name.toLowerCase()} ${strength} ${dir} (r = ${r}).` };
}

// ——— The sections ——————————————————————————————————————————————————————————————————————————————————————————————
export function lifeStats(x: StatsInput): { sections: StatSection[]; series: Series[]; records: { label: string; value: string; when: string }[]; insights: string[] } {
  const T = x.today, f = x.family ?? {}, ls = x.ls, h = ls.health ?? {}, c = ls.days ?? {}, fit = x.fit ?? {}, st = ls.settings ?? { screenings: {}, off: [] };
  const series = buildSeries(x);
  const S = (id: string) => series.find((s) => s.id === id)?.values ?? {};
  const sections: StatSection[] = [];
  const insights: string[] = [];
  const records: { label: string; value: string; when: string }[] = [];
  const rec = (label: string, s: Record<string, number>, fmt: (v: number) => string, low = false) => { const b = low ? lowest(s) : best(s); if (b) records.push({ label, value: fmt(b.v), when: fmtDate(b.d) }); };
  const days30 = lastDays(T, 30), days14 = lastDays(T, 14);
  const birth = st.birthYear ?? Object.values(f.health?.profiles ?? {}).map((p: any) => p?.birthYear).find(Boolean) ?? fit.profile?.birthYear;
  const sex: "female" | "male" | undefined = st.sex ?? (fit.profile?.sex === "f" ? "female" : fit.profile?.sex === "m" ? "male" : undefined);
  const myAge = age(birth, T);
  const heightIn = st.heightIn ?? Object.values(f.health?.profiles ?? {}).map((p: any) => p?.heightIn).find(Boolean) ?? (fit.profile?.heightCm ? fit.profile.heightCm / 2.54 : undefined);
  const latest = (s: Record<string, number>) => { const d = Object.keys(s).sort().pop(); return d ? { d, v: s[d] } : null; };

  // ——— You, in numbers
  {
    const stats: Stat[] = [];
    const charts: Chart[] = [];
    if (birth) {
      const born = `${birth}-07-01`;
      const daysAlive = daysBetween(born, T);
      const weeks = Math.floor(daysAlive / 7);
      stats.push({ label: "Age", value: `${myAge}`, sub: "From the year you were born" });
      stats.push({ label: "Days lived", value: n0(daysAlive), sub: "About" });
      stats.push({ label: "Weeks lived", value: n0(weeks), sub: `of about 4,160 (80 years) · ${pct(weeks / 4160)}` });
      const rhr = avg(valuesIn(S("rhr"), T, 30)) || 70;
      stats.push({ label: "Heartbeats so far", value: `${n1((daysAlive * 1440 * (rhr + 10)) / 1e9)} billion`, sub: "Estimated from your heart rate" });
      stats.push({ label: "Breaths so far", value: `${n0((daysAlive * 1440 * 15) / 1e6)} million`, sub: "At about 15 a minute" });
      stats.push({ label: "Nights slept", value: n0(daysAlive), sub: `about ${n0((daysAlive * 7.5) / 24 / 365)} years asleep` });
      stats.push({ label: "Weekends left to 80", value: n0(Math.max(0, (80 - myAge) * 52)), sub: "Make them count" });
      stats.push({ label: "Summers left to 80", value: n0(Math.max(0, 80 - myAge)) });
      charts.push({ kind: "progress", title: "Your life at a glance (to 80)", rows: [{ label: "Life so far", value: Math.min(1, weeks / 4160), sub: `${n0(weeks)} weeks`, color: "#0f172a" }] });
    }
    const yearDay = daysBetween(`${T.slice(0, 4)}-01-01`, T) + 1, yearLen = Number(T.slice(0, 4)) % 4 === 0 ? 366 : 365;
    stats.push({ label: "This year", value: pct(yearDay / yearLen), sub: `day ${yearDay} of ${yearLen}` });
    const dim = new Date(Number(T.slice(0, 4)), Number(T.slice(5, 7)), 0).getDate();
    stats.push({ label: "This month", value: pct(Number(T.slice(8, 10)) / dim), sub: `${dim - Number(T.slice(8, 10))} days left` });
    const tracked = new Set<string>([...Object.keys(c), ...Object.keys(h), ...arr(f.moods).map((m: any) => day(m.date)), ...arr(fit.foods).map((e: any) => day(e.date))].filter(Boolean));
    stats.push({ label: "Days tracked", value: n0(tracked.size), sub: "Any check-in, Health or diary" });
    const ci = streaks(new Set(Object.keys(c)), T);
    stats.push({ label: "Check-in streak", value: `${ci.current} days`, sub: `best ${ci.best}` });
    const cd = arr(f.countdowns).filter((k: any) => isDay(k.date) && k.date >= T).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const bdays = arr(f.birthdays).map((b: any) => { const y = Number(T.slice(0, 4)); let d = `${y}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`; if (d < T) d = `${y + 1}${d.slice(4)}`; return { name: b.name, d, kind: b.kind }; }).sort((a: any, b: any) => a.d.localeCompare(b.d));
    const soon = [...cd.map((k: any) => ({ label: `${k.emoji || ""} ${k.title}`.trim(), d: k.date })), ...bdays.slice(0, 5).map((b: any) => ({ label: `${b.name}'s ${b.kind === "anniversary" ? "anniversary" : b.kind === "birthday" ? "birthday" : "day"}`, d: b.d }))].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 8);
    if (soon.length) charts.push({ kind: "list", title: "Coming up", rows: soon.map((s) => ({ label: s.label, sub: fmtDate(s.d), right: `${daysBetween(T, s.d)} days` })) });
    if (x.score) charts.push({ kind: "line", title: "Life Score, 30 days", values: x.score.series, dates: x.score.dates, unit: "", color: "#0f172a" });
    sections.push({ id: "you", name: "You", color: "#0f172a", icon: "user", blurb: "Your life in numbers", stats, charts, insights: [], empty: birth ? undefined : "Add the year you were born in Life Score settings for your life in numbers." });
  }

  // ——— To-dos (every hub)
  {
    const all = x.tasks;
    const done = all.filter((t) => t.done), open = all.filter((t) => !t.done);
    const overdue = open.filter((t) => t.due && t.due < T);
    const withTimes = done.filter((t) => t.completedAt && t.createdAt);
    const onTime = done.filter((t) => t.due && t.completedAt).map((t) => day(t.completedAt) <= t.due);
    const doneDays = S("tasksdone");
    const stats: Stat[] = [
      { label: "Done today", value: n0(doneDays[T] ?? 0) },
      { label: "Done this week", value: n0(sum(valuesIn(doneDays, T, 7))) },
      { label: "Done in 30 days", value: n0(sum(valuesIn(doneDays, T, 30))) },
      { label: "Done all time", value: n0(done.length), sub: `${n0(all.length)} to-dos ever` },
      { label: "Open now", value: n0(open.length), sub: `${n0(overdue.length)} overdue` },
      { label: "Due today", value: n0(open.filter((t) => t.due === T).length) },
    ];
    if (onTime.length) stats.push({ label: "On time", value: pct(onTime.filter(Boolean).length / onTime.length), sub: "Done by the due date" });
    if (withTimes.length) { const hrs = withTimes.map((t) => (Date.parse(t.completedAt!) - Date.parse(t.createdAt!)) / 3.6e6).filter((v) => v >= 0).sort((a, b) => a - b); if (hrs.length) { const med = hrs[Math.floor(hrs.length / 2)]; stats.push({ label: "Typical time to finish", value: med < 24 ? `${n1(med)} h` : `${n1(med / 24)} days`, sub: "From added to done (median)" }); } }
    const sk = streaks(new Set(Object.keys(doneDays)), T);
    stats.push({ label: "Days in a row getting something done", value: n0(sk.current), sub: `best ${sk.best}` });
    if (overdue.length) { const old = [...overdue].sort((a, b) => a.due.localeCompare(b.due))[0]; stats.push({ label: "Most overdue", value: `${daysBetween(old.due, T)} days`, sub: old.title.slice(0, 40) }); }
    const charts: Chart[] = [
      { kind: "bars", title: "To-dos done, 30 days", values: lastN(doneDays, T, 30).map((v) => v ?? 0), dates: days30, unit: "", color: "#7c6cf0" },
      { kind: "line", title: "To-dos added, 30 days", values: lastN(S("tasksmade"), T, 30).map((v) => v ?? 0), dates: days30, unit: "", color: "#94a3b8" },
      { kind: "weekday", title: "Your most productive days", values: byWeekday(Object.fromEntries(lastDays(T, 90).map((d) => [d, doneDays[d] ?? 0])), T), unit: "done", color: "#7c6cf0" },
    ];
    const hours = Array(24).fill(0);
    for (const t of done) if (t.completedAt && /T\d{2}/.test(t.completedAt)) hours[new Date(t.completedAt).getHours()]++;
    if (sum(hours)) charts.push({ kind: "hours", title: "When you get things done", values: hours, unit: "done", color: "#7c6cf0" });
    const hubs = ["LifeHub", "WorkHub", "FamilyHub"].map((hb, i) => ({ label: hb, value: all.filter((t) => t.hub === hb).length, color: COLORS[i] })).filter((p) => p.value);
    if (hubs.length > 1) charts.push({ kind: "donut", title: "To-dos by hub", parts: hubs, unit: "to-dos" });
    const byList = new Map<string, { open: number; done: number }>();
    for (const t of all) { const k = `${t.list || "No list"}${t.hub !== "LifeHub" ? ` (${t.hub})` : ""}`; const e = byList.get(k) ?? { open: 0, done: 0 }; if (t.done) e.done++; else e.open++; byList.set(k, e); }
    if (byList.size) charts.push({ kind: "progress", title: "Lists: share done", rows: [...byList.entries()].sort((a, b) => b[1].open + b[1].done - a[1].open - a[1].done).slice(0, 10).map(([k, v], i) => ({ label: k, value: v.done / Math.max(1, v.open + v.done), sub: `${v.done} done · ${v.open} open`, color: COLORS[i % COLORS.length] })) });
    if (overdue.length) charts.push({ kind: "list", title: "Overdue", rows: [...overdue].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 10).map((t) => ({ label: t.title, sub: `${t.hub}${t.list ? ` · ${t.list}` : ""}`, right: `${daysBetween(t.due, T)}d late` })) });
    const wd = byWeekday(Object.fromEntries(lastDays(T, 90).map((d) => [d, doneDays[d] ?? 0])), T);
    const top = wd.reduce<number>((b, v, i) => ((v ?? -1) > (wd[b] ?? -1) ? i : b), 0);
    const ins: string[] = [];
    if (sum(wd.map((v) => v ?? 0)) > 0) ins.push(`${WEEKDAYS[top]} is your most productive day: ${n1(wd[top] ?? 0)} to-dos done on average.`);
    if (overdue.length >= 5) ins.push(`${overdue.length} to-dos are overdue. Moving the ones that won't happen to real dates makes the list honest again.`);
    rec("Most to-dos done in a day", doneDays, (v) => `${n0(v)} to-dos`);
    insights.push(...ins);
    sections.push({ id: "tasks", name: "To-dos", color: "#7c6cf0", icon: "list", blurb: "Every hub's to-dos: LifeHub, WorkHub and FamilyHub", stats, charts, insights: ins, empty: all.length ? undefined : "Add to-dos and check them off: this fills in." });
  }

  // ——— Food & nutrition
  {
    const kcal = S("kcal"), p = S("protein"), cb = S("carbs"), ft = S("fat"), water = S("water");
    const foods = [...arr(fit.foods).map((e: any) => ({ d: day(e.date), name: String(e.name || "Food"), meal: String(e.meal), kcal: (Number(e.kcal) || 0) * (Number(e.servings) || 1) })),
      ...arr(f.health?.food).map((e: any) => ({ d: day(e.date), name: String(e.name || "Food"), meal: String(e.meal), kcal: (Number(e.calories) || 0) * (Number(e.servings) || 1) }))];
    const k30 = valuesIn(kcal, T, 30), p30 = valuesIn(p, T, 30), c30 = valuesIn(cb, T, 30), f30 = valuesIn(ft, T, 30);
    const goal = Number(fit.profile?.kcalGoal) || Number(Object.values(f.health?.goals ?? {}).map((g: any) => g?.calories).find(Boolean)) || 0;
    const stats: Stat[] = [];
    if (k30.length) {
      stats.push({ label: "Calories today", value: n0(kcal[T] ?? 0), sub: goal ? `goal ${n0(goal)}` : undefined });
      stats.push({ label: "Average a day", value: n0(avg(k30)), sub: `${k30.length} days logged in 30` });
      stats.push({ label: "Protein", value: `${n0(avg(p30))} g`, sub: "a day" + (valuesIn(S("weight"), T, 90).length ? ` · ${n1(avg(p30) / (latest(S("weight"))!.v / 2.20462))} g/kg` : "") });
      stats.push({ label: "Carbs", value: `${n0(avg(c30))} g`, sub: "a day" });
      stats.push({ label: "Fat", value: `${n0(avg(f30))} g`, sub: "a day" });
      if (goal) { const within = k30.filter((v) => Math.abs(v - goal) <= goal * 0.1).length; stats.push({ label: "Days on target", value: `${within} of ${k30.length}`, sub: "Within 10% of your goal" }); }
      const burn = S("burn"); const bal = days30.filter((d) => kcal[d] !== undefined && burn[d] !== undefined).map((d) => kcal[d] - burn[d]);
      if (bal.length >= 3) stats.push({ label: "Energy balance", value: `${avg(bal) > 0 ? "+" : ""}${n0(avg(bal))} kcal`, sub: `a day vs burned · about ${n1((avg(bal) * 7) / 3500)} lb a week` });
      const ls7 = streaks(new Set(Object.keys(kcal)), T);
      stats.push({ label: "Logging streak", value: `${ls7.current} days`, sub: `best ${ls7.best}` });
      stats.push({ label: "Foods logged", value: n0(foods.length), sub: "all time" });
    }
    const w30 = valuesIn(water, T, 30);
    if (w30.length) stats.push({ label: "Water", value: `${n0(avg(w30))} oz`, sub: "a day" });
    const fasts = arr(fit.fasting?.log).map((l: any) => (Date.parse(l.end) - Date.parse(l.start)) / 3.6e6).filter((v: number) => v > 0 && v < 200);
    if (fasts.length) { stats.push({ label: "Fasts", value: n0(fasts.length), sub: `average ${n1(avg(fasts))} h · longest ${n1(Math.max(...fasts))} h` }); }
    const charts: Chart[] = [];
    if (k30.length) {
      charts.push({ kind: "bars", title: "Calories, 30 days", values: lastN(kcal, T, 30), dates: days30, unit: "kcal", goal: goal || undefined, color: "#f97316" });
      const P = avg(p30) * 4, C = avg(c30) * 4, F = avg(f30) * 9;
      if (P + C + F > 0) charts.push({ kind: "donut", title: "Where your calories come from", parts: [{ label: "Protein", value: Math.round(P), color: "#ef4444" }, { label: "Carbs", value: Math.round(C), color: "#f59e0b" }, { label: "Fat", value: Math.round(F), color: "#0ea5e9" }], unit: "kcal" });
      const meals = new Map<string, number>(); for (const e of foods) if (days30.includes(e.d)) meals.set(e.meal, (meals.get(e.meal) ?? 0) + e.kcal);
      if (meals.size) charts.push({ kind: "donut", title: "Calories by meal", parts: [...meals.entries()].map(([k, v], i) => ({ label: k[0].toUpperCase() + k.slice(1), value: Math.round(v), color: COLORS[i % COLORS.length] })), unit: "kcal" });
      charts.push({ kind: "line", title: "Protein, 30 days", values: lastN(p, T, 30), dates: days30, unit: "g", color: "#ef4444" });
      charts.push({ kind: "weekday", title: "Calories by day of the week", values: byWeekday(kcal, T), unit: "kcal", color: "#f97316" });
      const counts = new Map<string, { n: number; kcal: number }>(); for (const e of foods) { const k = e.name.trim(); const v = counts.get(k) ?? { n: 0, kcal: 0 }; v.n++; v.kcal += e.kcal; counts.set(k, v); }
      charts.push({ kind: "hbars", title: "Your most-logged foods", rows: [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([k, v]) => ({ label: k, value: v.n, sub: `${n0(v.kcal / v.n)} kcal each` })), unit: "times" });
      const big = [...foods].sort((a, b) => b.kcal - a.kcal).slice(0, 5);
      charts.push({ kind: "list", title: "Biggest single foods", rows: big.map((e) => ({ label: e.name, sub: fmtDate(e.d), right: `${n0(e.kcal)} kcal` })) });
    }
    if (w30.length) charts.push({ kind: "bars", title: "Water, 30 days", values: lastN(water, T, 30), dates: days30, unit: "oz", color: "#0ea5e9" });
    const ins: string[] = [];
    if (p30.length && valuesIn(S("weight"), T, 90).length) { const gkg = avg(p30) / (latest(S("weight"))!.v / 2.20462); ins.push(gkg < 0.8 ? `You average ${n1(gkg)} g of protein per kg of body weight, under the 0.8 g/kg adult minimum.` : `You average ${n1(gkg)} g of protein per kg, ${gkg >= 1.2 ? "in the range studies use for building and keeping muscle" : "above the 0.8 g/kg minimum"}.`); }
    if (k30.length >= 7) { const wd = byWeekday(kcal, T); const hi = wd.indexOf(Math.max(...wd.map((v) => v ?? 0))); ins.push(`You eat the most on ${WEEKDAYS[hi]}s (${n0(wd[hi] ?? 0)} kcal on average).`); }
    rec("Most calories in a day", kcal, (v) => `${n0(v)} kcal`); rec("Most protein in a day", p, (v) => `${n0(v)} g`);
    insights.push(...ins);
    sections.push({ id: "food", name: "Food & nutrition", color: "#f97316", icon: "food", blurb: "Your food diary, Health & Fitness and Apple Health", stats, charts, insights: ins, empty: stats.length ? undefined : "Log food in Health & Fitness (or the Food & fitness diary), or let a food app save to Apple Health." });
  }

  // ——— Activity
  {
    const steps = S("steps"), ex = S("exercise"), miles = S("miles"), flights = S("flights"), burn = S("burn"), active = S("active"), stand = S("stand");
    const stats: Stat[] = [];
    const s30 = valuesIn(steps, T, 30);
    if (s30.length) {
      stats.push({ label: "Steps today", value: n0(steps[T] ?? 0) });
      stats.push({ label: "Average a day", value: n0(avg(s30)), sub: "30 days" });
      stats.push({ label: "Steps in 30 days", value: n0(sum(s30)), sub: `about ${n0(sum(s30) / 2000)} miles` });
      const b = best(steps); if (b) stats.push({ label: "Best day ever", value: n0(b.v), sub: fmtDate(b.d) });
      const goal = st.stepGoal || Number(fit.profile?.stepsGoal) || 8000;
      const hit = streaks(new Set(Object.keys(steps).filter((d) => steps[d] >= goal)), T);
      stats.push({ label: `${n0(goal)}-step streak`, value: `${hit.current} days`, sub: `best ${hit.best}` });
    }
    const m30 = valuesIn(miles, T, 30); if (m30.length) stats.push({ label: "Distance", value: `${n1(sum(m30))} mi`, sub: "walked or run in 30 days" });
    const fl = valuesIn(flights, T, 30); if (fl.length) stats.push({ label: "Floors climbed", value: n0(sum(fl)), sub: `30 days · ${n0(sum(fl) * 3)} m up` });
    const e7 = sum(valuesIn(ex, T, 7)); if (Object.keys(ex).length) stats.push({ label: "Exercise this week", value: `${n0(e7)} min`, sub: `${pct(Math.min(1, e7 / 150))} of 150` });
    const a30 = valuesIn(active, T, 30); if (a30.length) stats.push({ label: "Active calories", value: n0(avg(a30)), sub: "a day" });
    const b30 = valuesIn(burn, T, 30); if (b30.length) stats.push({ label: "Total burned", value: n0(avg(b30)), sub: "a day, active + resting" });
    const sd = valuesIn(stand, T, 30); if (sd.length) stats.push({ label: "Stand hours", value: n1(avg(sd)), sub: "a day" });
    // Workouts: Health, Cooked lifting and runs.
    const lifts = arr(fit.workouts);
    let volume = 0, sets = 0;
    for (const w of lifts) for (const e of arr(w.exercises)) for (const s of arr(e.sets)) if (s.done) { sets++; volume += (Number(s.reps) || 0) * (Number(s.weight) || 0); }
    if (lifts.length) { stats.push({ label: "Workouts logged", value: n0(lifts.length), sub: `${n0(lifts.filter((w: any) => days30.includes(day(w.date))).length)} in 30 days` }); stats.push({ label: "Total lifted", value: `${n0(volume)} ${fit.profile?.units === "kg" ? "kg" : "lb"}`, sub: `${n0(sets)} sets` }); }
    const runs = arr(fit.runs); if (runs.length) { const mi = sum(runs.map((r: any) => (Number(r.meters) || 0) / 1609.344)); const secs = sum(runs.map((r: any) => Number(r.secs) || 0)); stats.push({ label: "Runs, walks & hikes", value: n0(runs.length), sub: `${n1(mi)} mi · ${mi ? `${Math.floor(secs / 60 / mi)}:${String(Math.round((secs / mi) % 60)).padStart(2, "0")}/mi` : ""}` }); }
    const charts: Chart[] = [];
    if (s30.length) {
      charts.push({ kind: "bars", title: "Steps, 30 days", values: lastN(steps, T, 30), dates: days30, unit: "steps", goal: st.stepGoal || 8000, color: "#ff5a5f" });
      charts.push({ kind: "weekday", title: "Steps by day of the week", values: byWeekday(steps, T), unit: "steps", color: "#ff5a5f" });
      charts.push({ kind: "heat", title: "Steps, 26 weeks", values: lastN(steps, T, 182), dates: lastDays(T, 182), color: "#ff5a5f" });
    }
    if (Object.keys(ex).length) charts.push({ kind: "bars", title: "Exercise minutes, 30 days", values: lastN(ex, T, 30), dates: days30, unit: "min", color: "#10b981" });
    const kinds = new Map<string, number>();
    for (const v of Object.values(h)) for (const k of v.woKinds ?? []) kinds.set(k, (kinds.get(k) ?? 0) + 1);
    for (const w of lifts) kinds.set("Strength", (kinds.get("Strength") ?? 0) + 1);
    for (const r of runs) kinds.set(r.kind ? String(r.kind)[0].toUpperCase() + String(r.kind).slice(1) : "Run", (kinds.get(r.kind) ?? 0) + 1);
    if (kinds.size) charts.push({ kind: "donut", title: "Workouts by kind", parts: [...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v], i) => ({ label: k, value: v, color: COLORS[i % COLORS.length] })), unit: "workouts" });
    const exBest = new Map<string, number>();
    for (const w of lifts) for (const e of arr(w.exercises)) for (const s of arr(e.sets)) if (s.done && s.reps > 0 && s.weight > 0) { const e1 = s.weight * (1 + s.reps / 30); if (e1 > (exBest.get(e.name) ?? 0)) exBest.set(e.name, e1); }
    if (exBest.size) charts.push({ kind: "hbars", title: "Estimated one-rep maxes", rows: [...exBest.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: k, value: Math.round(v) })), unit: fit.profile?.units === "kg" ? "kg" : "lb" });
    const ins: string[] = [];
    const ch = change(steps, T); if (ch !== null && Math.abs(ch) > 300) ins.push(`Your steps are ${ch > 0 ? "up" : "down"} ${n0(Math.abs(ch))} a day compared with the week before.`);
    if (s30.length >= 14) { const wd = byWeekday(steps, T); const lo = wd.indexOf(Math.min(...wd.filter((v): v is number => v !== null))); ins.push(`${WEEKDAYS[lo]} is your least active day (${n0(wd[lo] ?? 0)} steps). A walk that day lifts your whole week.`); }
    rec("Most steps in a day", steps, (v) => `${n0(v)} steps`); rec("Longest exercise day", ex, (v) => `${n0(v)} min`);
    insights.push(...ins);
    sections.push({ id: "activity", name: "Activity", color: "#ff5a5f", icon: "activity", blurb: "Steps, distance, workouts, lifting and runs", stats, charts, insights: ins, empty: stats.length ? undefined : "Connect Apple Health, or log workouts in Health & Fitness." });
  }

  // ——— Sleep
  {
    const sl = S("sleep"), deep = S("deep"), rem = S("rem");
    const s14 = valuesIn(sl, T, 14), s30 = valuesIn(sl, T, 30);
    const stats: Stat[] = [];
    if (s30.length) {
      stats.push({ label: "Last night", value: sl[T] !== undefined ? hm(sl[T] * 60) : "—" });
      stats.push({ label: "Average", value: hm(avg(s30) * 60), sub: "30 nights" });
      stats.push({ label: "Sleep debt", value: hm(Math.max(0, sum(s14.map((v) => 8 - v))) * 60), sub: "vs 8 hours, last 14 nights" });
      stats.push({ label: "7+ hour nights", value: pct(s30.filter((v) => v >= 7).length / s30.length) });
      const b = best(sl), l = lowest(sl); if (b) stats.push({ label: "Longest night", value: hm(b.v * 60), sub: fmtDate(b.d) }); if (l) stats.push({ label: "Shortest night", value: hm(l.v * 60), sub: fmtDate(l.d) });
    }
    const beds = days30.map((d) => h[d]?.bed).filter((v): v is number => v !== undefined), wakes = days30.map((d) => h[d]?.wake).filter((v): v is number => v !== undefined);
    if (beds.length) { const m = avg(beds); stats.push({ label: "Usual bedtime", value: clock(1080 + m), sub: `varies ±${n0(Math.sqrt(avg(beds.map((b) => (b - m) ** 2))))} min` }); }
    if (wakes.length) stats.push({ label: "Usual wake-up", value: clock(avg(wakes)) });
    const stg = days30.map((d) => h[d]).filter((v) => v && (v.deep || v.rem || v.core));
    if (stg.length) { stats.push({ label: "Deep sleep", value: hm(avg(stg.map((v) => v!.deep ?? 0))), sub: "a night" }); stats.push({ label: "REM sleep", value: hm(avg(stg.map((v) => v!.rem ?? 0))), sub: "a night" }); }
    const ql = arr(f.sleep).filter((e: any) => e.quality > 0).map((e: any) => e.quality); if (ql.length) stats.push({ label: "Sleep quality", value: `${n1(avg(ql))}/5`, sub: "from your sleep log" });
    const charts: Chart[] = [];
    if (s30.length) {
      charts.push({ kind: "bars", title: "Hours asleep, 30 nights", values: lastN(sl, T, 30), dates: days30, unit: "h", goal: 8, color: "#6366f1" });
      charts.push({ kind: "weekday", title: "Sleep by night of the week", values: byWeekday(sl, T), unit: "h", color: "#6366f1" });
      charts.push({ kind: "heat", title: "Sleep, 26 weeks", values: lastN(sl, T, 182), dates: lastDays(T, 182), color: "#6366f1" });
    }
    if (stg.length) charts.push({ kind: "donut", title: "Sleep stages (average night)", parts: [{ label: "Deep", value: Math.round(avg(stg.map((v) => v!.deep ?? 0))), color: "#312e81" }, { label: "Core", value: Math.round(avg(stg.map((v) => v!.core ?? 0))), color: "#6366f1" }, { label: "REM", value: Math.round(avg(stg.map((v) => v!.rem ?? 0))), color: "#a5b4fc" }, { label: "Awake", value: Math.round(avg(stg.map((v) => v!.awake ?? 0))), color: "#fda4af" }], unit: "min" });
    if (Object.keys(deep).length) charts.push({ kind: "line", title: "Deep sleep, 30 nights", values: lastN(deep, T, 30), dates: days30, unit: "min", color: "#312e81" });
    if (Object.keys(rem).length) charts.push({ kind: "line", title: "REM sleep, 30 nights", values: lastN(rem, T, 30), dates: days30, unit: "min", color: "#a5b4fc" });
    const ins: string[] = [];
    if (s30.length >= 7) { const wd = byWeekday(sl, T); const lo = wd.indexOf(Math.min(...wd.filter((v): v is number => v !== null))); ins.push(`Your shortest nights are ${WEEKDAYS[lo]}s (${hm((wd[lo] ?? 0) * 60)}).`); }
    if (s14.length >= 7 && sum(s14.map((v) => 8 - v)) > 7) ins.push(`You're ${hm(sum(s14.map((v) => 8 - v)) * 60)} short of 8 hours a night over two weeks: about ${n0(sum(s14.map((v) => 8 - v)) / 8)} full nights.`);
    rec("Longest sleep", sl, (v) => hm(v * 60));
    insights.push(...ins);
    sections.push({ id: "sleep", name: "Sleep", color: "#6366f1", icon: "moon", blurb: "Hours, stages, bedtimes and sleep debt", stats, charts, insights: ins, empty: stats.length ? undefined : "Wear your Apple Watch to bed or use the Sleep log." });
  }

  // ——— Heart & vitals
  {
    const rhr = S("rhr"), hrv = S("hrv"), vo2 = S("vo2"), spo2 = S("spo2"), resp = S("resp"), hravg = S("hravg");
    const stats: Stat[] = [];
    const r30 = valuesIn(rhr, T, 30); if (r30.length) { stats.push({ label: "Resting heart rate", value: `${n0(avg(valuesIn(rhr, T, 7)) || avg(r30))} bpm`, sub: `30-day ${n0(avg(r30))} · lowest ${n0(Math.min(...r30))}` }); }
    const v30 = valuesIn(hrv, T, 30); if (v30.length) { const base = avg(valuesIn(hrv, T, 60)); const wk = avg(valuesIn(hrv, T, 7)); stats.push({ label: "Heart rate variability", value: `${n0(wk || avg(v30))} ms`, sub: base ? `${wk >= base ? "above" : "below"} your 60-day normal of ${n0(base)}` : undefined }); }
    const a30 = valuesIn(hravg, T, 30); if (a30.length) stats.push({ label: "Average heart rate", value: `${n0(avg(a30))} bpm` });
    const maxes = days30.map((d) => h[d]?.hrMax).filter((v): v is number => !!v); if (maxes.length) stats.push({ label: "Highest heart rate", value: `${Math.max(...maxes)} bpm`, sub: "30 days" });
    const lv = latest(vo2);
    if (lv) { stats.push({ label: "VO2 max (cardio fitness)", value: n1(lv.v), sub: "ml/kg/min" }); if (myAge && sex) { const r = vo2Read(lv.v, myAge, sex); stats.push({ label: "Fitness level", value: r.band.split(" (")[0], sub: `${r.band.includes("(") ? r.band.slice(r.band.indexOf("(") + 1, -1) + " · " : ""}average for your age is ${r.median}` }); stats.push({ label: "Fitness age", value: `${r.fitAge}`, sub: `vs your age ${myAge}` }); } }
    const o30 = valuesIn(spo2, T, 30); if (o30.length) stats.push({ label: "Blood oxygen", value: `${n0(avg(o30))}%`, sub: `lowest ${n0(Math.min(...o30))}%` });
    const re30 = valuesIn(resp, T, 30); if (re30.length) stats.push({ label: "Breathing rate", value: n1(avg(re30)), sub: "breaths a minute asleep" });
    const wr = days30.map((d) => h[d]?.wrist).filter((v): v is number => v !== undefined); if (wr.length) stats.push({ label: "Wrist temperature", value: `${wr[wr.length - 1] >= 0 ? "+" : ""}${n1(wr[wr.length - 1])}°`, sub: "from your baseline" });
    const bps = [...Object.entries(h).filter(([, v]) => v.sys && v.dia).map(([d, v]) => ({ d, sys: v.sys!, dia: v.dia! })), ...arr(ls.labs).filter((l: any) => l.sys && l.dia).map((l: any) => ({ d: l.date, sys: l.sys, dia: l.dia }))].sort((a, b) => a.d.localeCompare(b.d));
    if (bps.length) { const b = bps[bps.length - 1]; const cat = b.sys >= 140 || b.dia >= 90 ? "High (stage 2)" : b.sys >= 130 || b.dia >= 80 ? "High (stage 1)" : b.sys >= 120 ? "Elevated" : "Normal"; stats.push({ label: "Blood pressure", value: `${b.sys}/${b.dia}`, sub: `${cat} · ${fmtDate(b.d)}` }); }
    const charts: Chart[] = [];
    if (r30.length) charts.push({ kind: "line", title: "Resting heart rate, 30 days", values: lastN(rhr, T, 30), dates: days30, unit: "bpm", color: "#ef4444" });
    if (v30.length) charts.push({ kind: "line", title: "Heart rate variability, 30 days", values: lastN(hrv, T, 30), dates: days30, unit: "ms", color: "#14b8a6" });
    if (Object.keys(vo2).length > 1) charts.push({ kind: "line", title: "VO2 max, 90 days", values: lastN(vo2, T, 90), dates: lastDays(T, 90), unit: "", color: "#ff5a5f" });
    if (o30.length) charts.push({ kind: "line", title: "Blood oxygen, 30 days", values: lastN(spo2, T, 30), dates: days30, unit: "%", color: "#0ea5e9" });
    if (bps.length > 1) charts.push({ kind: "list", title: "Blood pressure readings", rows: bps.slice(-8).reverse().map((b) => ({ label: `${b.sys}/${b.dia} mmHg`, right: fmtDate(b.d) })) });
    const ins: string[] = [];
    const ch = change(rhr, T); if (ch !== null && Math.abs(ch) >= 2) ins.push(`Your resting heart rate is ${ch > 0 ? "up" : "down"} ${n0(Math.abs(ch))} bpm from last week${ch > 0 ? ": often a sign of short sleep, stress, alcohol or getting sick" : ": a good sign of fitness and recovery"}.`);
    rec("Lowest resting heart rate", rhr, (v) => `${n0(v)} bpm`, true); rec("Highest HRV", hrv, (v) => `${n0(v)} ms`);
    insights.push(...ins);
    sections.push({ id: "heart", name: "Heart & vitals", color: "#ef4444", icon: "heart", blurb: "Resting heart rate, HRV, VO2 max, blood oxygen, blood pressure", stats, charts, insights: ins, empty: stats.length ? undefined : "An Apple Watch fills this in through Apple Health; add blood pressure in Labs." });
  }

  // ——— Body
  {
    const w = S("weight");
    const stats: Stat[] = [];
    const lw = latest(w);
    const charts: Chart[] = [];
    if (lw) {
      stats.push({ label: "Weight", value: `${n1(lw.v)} lb`, sub: fmtDate(lw.d) });
      for (const back of [30, 90, 365]) { const old = Object.entries(w).filter(([d]) => d <= plusDays(T, -back)).sort((a, b) => b[0].localeCompare(a[0]))[0]; if (old) stats.push({ label: `Change in ${back === 365 ? "a year" : `${back} days`}`, value: `${lw.v - old[1] >= 0 ? "+" : ""}${n1(lw.v - old[1])} lb` }); }
      if (heightIn) { const bmi = (lw.v / (heightIn * heightIn)) * 703; stats.push({ label: "BMI", value: n1(bmi), sub: bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy range" : bmi < 30 ? "Overweight" : "Obesity range" }); }
      const goalLb = (Number(fit.profile?.goalKg) || 0) * 2.20462 || Number(Object.values(f.health?.goals ?? {}).map((g: any) => g?.goalWeight).find(Boolean)) || 0;
      if (goalLb) { stats.push({ label: "To goal", value: `${n1(Math.abs(lw.v - goalLb))} lb`, sub: `goal ${n1(goalLb)} lb` }); const old = Object.entries(w).filter(([d]) => d <= plusDays(T, -28)).sort((a, b) => b[0].localeCompare(a[0]))[0]; if (old) { const rate = (lw.v - old[1]) / (daysBetween(old[0], lw.d) / 7); if (rate && Math.sign(goalLb - lw.v) === Math.sign(rate)) stats.push({ label: "At this pace", value: `${n0(Math.abs(goalLb - lw.v) / Math.abs(rate))} weeks`, sub: `${n1(Math.abs(rate))} lb a week` }); } }
      charts.push({ kind: "line", title: "Weight, 90 days", values: lastN(w, T, 90), dates: lastDays(T, 90), unit: "lb", color: "#64748b" });
    }
    const fat = days30.map((d) => h[d]?.fat).filter((v): v is number => v !== undefined); if (fat.length) stats.push({ label: "Body fat", value: `${n1(fat[fat.length - 1])}%` });
    const waist = arr(ls.labs).filter((l: any) => l.waist).pop(); if (waist) stats.push({ label: "Waist", value: `${waist.waist} in`, sub: sex === "male" ? (waist.waist > 40 ? "Above the 40 in risk line" : "Under the 40 in risk line") : sex === "female" ? (waist.waist > 35 ? "Above the 35 in risk line" : "Under the 35 in risk line") : undefined });
    sections.push({ id: "body", name: "Body", color: "#64748b", icon: "scale", blurb: "Weight, BMI, body fat and pace to your goal", stats, charts, insights: [], empty: stats.length ? undefined : "Weigh in through Apple Health, Health & Fitness or the Food & fitness diary." });
  }

  // ——— Mind & mood
  {
    const mood = S("mood"), happy = S("happy"), stress = S("stress"), energy = S("energy"), mind = S("mindful"), words = S("words");
    const stats: Stat[] = [];
    const moods = arr(f.moods);
    if (moods.length) {
      stats.push({ label: "Average mood", value: `${n1(avg(valuesIn(mood, T, 30)) || avg(moods.map((m: any) => m.mood)))}/5`, sub: `${moods.length} moods logged` });
      const great = moods.filter((m: any) => m.mood >= 4).length; stats.push({ label: "Good or great days", value: pct(great / moods.length) });
    }
    const h30 = valuesIn(happy, T, 30); if (h30.length) stats.push({ label: "Happiness", value: `${n1(avg(h30))}/10`, sub: "30 days" });
    const s30 = valuesIn(stress, T, 30); if (s30.length) stats.push({ label: "Stress", value: `${n1(avg(s30))}/10`, sub: "30 days" });
    const e30 = valuesIn(energy, T, 30); if (e30.length) stats.push({ label: "Energy", value: `${n1(avg(e30))}/10`, sub: "30 days" });
    const m30 = valuesIn(mind, T, 30); if (m30.length) stats.push({ label: "Mindful minutes", value: n0(sum(m30)), sub: `30 days · ${n0(sum(Object.values(mind)))} all time` });
    const j = arr(f.journal);
    if (j.length) { stats.push({ label: "Journal entries", value: n0(j.length), sub: `${n0(sum(Object.values(words)))} words written` }); const jsk = streaks(new Set(j.map((e: any) => day(e.date))), T); stats.push({ label: "Journaling streak", value: `${jsk.current} days`, sub: `best ${jsk.best}` }); }
    const charts: Chart[] = [];
    if (moods.length) {
      const dist = [1, 2, 3, 4, 5].map((v) => moods.filter((m: any) => m.mood === v).length);
      charts.push({ kind: "donut", title: "Your moods", parts: ["Awful", "Bad", "Okay", "Good", "Great"].map((l, i) => ({ label: l, value: dist[i], color: ["#e0645a", "#ef9a4a", "#e5c04f", "#7cc46b", "#36b6a5"][i] })).filter((p) => p.value), unit: "days" });
      charts.push({ kind: "line", title: "Mood, 30 days", values: lastN(mood, T, 30), dates: days30, unit: "/5", color: "#36b6a5" });
      charts.push({ kind: "weekday", title: "Mood by day of the week", values: byWeekday(mood, T, 180), unit: "/5", color: "#36b6a5" });
      const tagMood = new Map<string, number[]>(); for (const m of moods) for (const t of arr<string>(m.tags)) (tagMood.get(t) ?? tagMood.set(t, []).get(t)!).push(m.mood);
      const tags = [...tagMood.entries()].filter(([, v]) => v.length >= 2).map(([k, v]) => ({ label: k, value: Math.round(avg(v) * 10) / 10, sub: `${v.length} days` })).sort((a, b) => b.value - a.value);
      if (tags.length) charts.push({ kind: "hbars", title: "Mood when… (average)", rows: tags.slice(0, 12), unit: "/5" });
    }
    if (h30.length) charts.push({ kind: "line", title: "Happiness, 30 days", values: lastN(happy, T, 30), dates: days30, unit: "/10", color: "#7c6cf0" });
    if (s30.length) charts.push({ kind: "line", title: "Stress, 30 days", values: lastN(stress, T, 30), dates: days30, unit: "/10", color: "#f59e0b" });
    if (m30.length) charts.push({ kind: "bars", title: "Mindful minutes, 30 days", values: lastN(mind, T, 30), dates: days30, unit: "min", color: "#8b5cf6" });
    if (j.length) { const tw = topWords(j.map((e: any) => `${e.title} ${e.body}`)); if (tw.length) charts.push({ kind: "hbars", title: "Words you write most", rows: tw.map(([w, n]) => ({ label: w, value: n })), unit: "times" }); }
    const ins: string[] = [];
    if (moods.length >= 14) { const wd = byWeekday(mood, T, 180); const hi = wd.indexOf(Math.max(...wd.filter((v): v is number => v !== null))); ins.push(`Your best mood day is ${WEEKDAYS[hi]} (${n1(wd[hi] ?? 0)}/5).`); }
    insights.push(...ins);
    sections.push({ id: "mind", name: "Mind & mood", color: "#7c6cf0", icon: "brain", blurb: "Mood, happiness, stress, mindfulness and journaling", stats, charts, insights: ins, empty: stats.length ? undefined : "Check in daily, track your mood or keep a journal." });
  }

  // ——— Questionnaires (validated measures)
  {
    const stats: Stat[] = [];
    const charts: Chart[] = [];
    for (const def of SCALES) {
      const list = ls.scales?.[def.id] ?? [];
      if (!list.length) continue;
      const last = list[list.length - 1], r = scoreScale(def.id, last.answers);
      stats.push({ label: def.name, value: def.id === "who5" ? `${r.score}/100` : `${r.score}/${def.max}`, sub: `${r.label} · ${fmtDate(last.date)}` });
      if (list.length > 1) charts.push({ kind: "list", title: `${def.name} over time`, rows: list.slice(-8).reverse().map((a) => { const s = scoreScale(def.id, a.answers); return { label: `${s.score}${def.id === "who5" ? "/100" : `/${def.max}`} · ${s.label}`, right: fmtDate(a.date) }; }) });
    }
    sections.push({ id: "measures", name: "Well-being measures", color: "#0d9488", icon: "clipboard", blurb: "WHO-5, PHQ-2, GAD-2, loneliness, stress and life satisfaction", stats, charts, insights: [], empty: stats.length ? undefined : "Take the short questionnaires in Life Score → Check in → Measures." });
  }

  // ——— People & faith
  {
    const stats: Stat[] = [];
    const charts: Chart[] = [];
    const connect = S("connect"), faith = S("faithfelt"), grat = S("gratitude");
    const together = days30.filter((d) => c[d]?.together).length, togetherAsked = days30.filter((d) => c[d]?.together !== undefined).length;
    if (togetherAsked) stats.push({ label: "Days with real time together", value: `${together} of ${togetherAsked}`, sub: "30 days" });
    const c30 = valuesIn(connect, T, 30); if (c30.length) stats.push({ label: "Connection", value: `${n1(avg(c30))}/10` });
    const contacts = arr(f.contacts); if (contacts.length) stats.push({ label: "Contacts", value: n0(contacts.length), sub: `${contacts.filter((k: any) => k.emergency).length} emergency` });
    const bd = arr(f.birthdays); if (bd.length) stats.push({ label: "Birthdays & anniversaries", value: n0(bd.length) });
    const iou = arr(f.ious).filter((i: any) => !i.settled); if (iou.length) stats.push({ label: "Open IOUs", value: n0(iou.length), sub: `${money(sum(iou.filter((i: any) => i.amount > 0).map((i: any) => i.amount)))} owed to you` });
    const fd = days30.filter((d) => c[d]?.faith).length, fAsked = days30.filter((d) => c[d]?.faith !== undefined).length;
    if (fAsked) { stats.push({ label: "Days with prayer, scripture or worship", value: `${fd} of ${fAsked}` }); const fs = streaks(new Set(Object.keys(c).filter((d) => c[d].faith)), T); stats.push({ label: "Faith streak", value: `${fs.current} days`, sub: `best ${fs.best}` }); }
    const f30 = valuesIn(faith, T, 30); if (f30.length) stats.push({ label: "Closeness to God", value: `${n1(avg(f30))}/10` });
    const verses = arr(f.savedVerses); if (verses.length) stats.push({ label: "Verses saved", value: n0(verses.length) });
    const gr = arr(f.gratitude); if (gr.length) { const items = gr.flatMap((g: any) => arr<string>(g.items)).filter((i) => i.trim()); stats.push({ label: "Things you're grateful for", value: n0(items.length), sub: `on ${gr.length} days` }); const tw = topWords(items); if (tw.length) charts.push({ kind: "hbars", title: "What you're most grateful for", rows: tw.map(([w, n]) => ({ label: w, value: n })), unit: "times" }); }
    if (c30.length) charts.push({ kind: "line", title: "Connection, 30 days", values: lastN(connect, T, 30), dates: days30, unit: "/10", color: "#f59e0b" });
    if (f30.length) charts.push({ kind: "line", title: "Closeness to God, 30 days", values: lastN(faith, T, 30), dates: days30, unit: "/10", color: "#a855f7" });
    if (Object.keys(grat).length) charts.push({ kind: "bars", title: "Gratitude, 30 days", values: lastN(grat, T, 30), dates: days30, unit: "items", color: "#f43f5e" });
    const upcoming = bd.map((b: any) => { const y = Number(T.slice(0, 4)); let d = `${y}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`; if (d < T) d = `${y + 1}${d.slice(4)}`; return { b, d }; }).sort((a: any, b: any) => a.d.localeCompare(b.d)).slice(0, 8);
    if (upcoming.length) charts.push({ kind: "list", title: "Next birthdays & anniversaries", rows: upcoming.map(({ b, d }: any) => ({ label: b.name, sub: `${fmtDate(d)}${b.year ? ` · turns ${Number(d.slice(0, 4)) - b.year}` : ""}`, right: `${daysBetween(T, d)} days` })) });
    sections.push({ id: "people", name: "People & faith", color: "#f59e0b", icon: "people", blurb: "Relationships, faith, gratitude and the people in your life", stats, charts, insights: [], empty: stats.length ? undefined : "Check in daily, add contacts and birthdays, or keep a gratitude list." });
  }

  // ——— Habits, goals & growth
  {
    const stats: Stat[] = [];
    const charts: Chart[] = [];
    const habits = arr(f.habits);
    if (habits.length) {
      const rows = habits.map((hb: any) => { const ds = new Set(arr<string>(hb.days)); const sk = streaks(ds, T); const done30 = days30.filter((d) => ds.has(d)).length; return { hb, sk, done30 }; });
      stats.push({ label: "Habits", value: n0(habits.length), sub: `${n0(rows.filter((r) => r.hb.days?.includes?.(T)).length)} done today` });
      const topS = rows.sort((a, b) => b.sk.best - a.sk.best)[0]; if (topS) stats.push({ label: "Longest habit streak", value: `${topS.sk.best} days`, sub: topS.hb.name });
      charts.push({ kind: "progress", title: "Habits: last 30 days", rows: rows.map((r, i) => ({ label: `${r.hb.emoji || ""} ${r.hb.name}`.trim(), value: r.done30 / 30, sub: `${r.done30}/30 · streak ${r.sk.current}, best ${r.sk.best}`, color: r.hb.color || COLORS[i % COLORS.length] })) });
      charts.push({ kind: "heat", title: "Habits done, 26 weeks", values: lastN(S("habits"), T, 182), dates: lastDays(T, 182), color: "#10b981" });
      for (const r of rows) records.push({ label: `Best streak: ${r.hb.name}`, value: `${r.sk.best} days`, when: "" });
    }
    const goals = arr(f.goals);
    if (goals.length) {
      const open = goals.filter((g: any) => !g.done), done = goals.filter((g: any) => g.done);
      stats.push({ label: "Goals", value: `${open.length} open`, sub: `${done.length} reached` });
      charts.push({ kind: "progress", title: "Goals", rows: goals.slice(0, 12).map((g: any, i: number) => { const v = g.done ? 1 : g.kind === "number" ? (g.target > 0 ? Math.min(1, g.current / g.target) : 0) : arr(g.milestones).length ? arr(g.milestones).filter((m: any) => m.done).length / arr(g.milestones).length : 0; return { label: g.title, value: v, sub: `${g.done ? "Reached" : g.due ? `${daysBetween(T, g.due)} days left` : "No date"}${g.kind === "number" ? ` · ${g.current}/${g.target} ${g.unit || ""}` : ""}`, color: COLORS[i % COLORS.length] }; }) });
    }
    const coll = arr(f.collections);
    const kindNames: Record<string, string> = { reading: "Books", watchlist: "Watchlist", bucket: "Bucket list", learning: "Learning", projects: "Projects", wishlist: "Wishlist", restaurants: "Restaurants", gifts: "Gift ideas", loans: "Lent out" };
    const kinds = Object.keys(kindNames).map((k) => ({ k, items: coll.filter((it: any) => it.kind === k) })).filter((x2) => x2.items.length);
    for (const { k, items } of kinds) { const doneN = items.filter((it: any) => /done|read|watched|visited|finished|complete/i.test(String(it.status)) || it.doneOn).length; stats.push({ label: kindNames[k], value: `${doneN} of ${items.length}`, sub: k === "reading" ? `${items.filter((it: any) => isDay(it.doneOn) && it.doneOn.startsWith(T.slice(0, 4))).length} finished this year` : "done" }); }
    if (kinds.length) charts.push({ kind: "progress", title: "Lists you're working through", rows: kinds.map(({ k, items }, i) => { const d = items.filter((it: any) => /done|read|watched|visited|finished|complete/i.test(String(it.status)) || it.doneOn).length; return { label: kindNames[k], value: d / items.length, sub: `${d} of ${items.length}`, color: COLORS[i % COLORS.length] }; }) });
    const focus = S("focus"); const fo = valuesIn(focus, T, 30); if (fo.length) { stats.push({ label: "Focus time", value: hm(sum(fo)), sub: "30 days" }); charts.push({ kind: "bars", title: "Focus minutes, 30 days", values: lastN(focus, T, 30), dates: days30, unit: "min", color: "#10b981" }); }
    const routines = arr(f.routines); if (routines.length) stats.push({ label: "Routines", value: n0(routines.length), sub: `${routines.filter((r: any) => r.doneDate === T).length} done today` });
    sections.push({ id: "growth", name: "Habits, goals & growth", color: "#10b981", icon: "target", blurb: "Habits, goals, books, learning, projects and focus", stats, charts, insights: [], empty: stats.length ? undefined : "Add habits, goals or a reading list." });
  }

  // ——— Money
  {
    const stats: Stat[] = [];
    const charts: Chart[] = [];
    const exps = arr(f.expenses), cats = arr(f.budget);
    const month = T.slice(0, 7), prevMonth = (() => { const d = at(`${month}-15`); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
    const spentIn = (m: string) => sum(exps.filter((e: any) => String(e.date).startsWith(m)).map((e: any) => Number(e.amount) || 0));
    if (exps.length) {
      const now = spentIn(month), last = spentIn(prevMonth), budget = sum(cats.map((b: any) => Number(b.limit) || 0));
      stats.push({ label: "Spent this month", value: money(now), sub: budget ? `of ${money(budget)} budget` : undefined });
      stats.push({ label: "Last month", value: money(last), sub: last ? `${now >= last ? "+" : ""}${pct((now - last) / last)} so far` : undefined });
      const dayN = Number(T.slice(8, 10)); stats.push({ label: "A day this month", value: money(now / dayN), sub: `on pace for ${money((now / dayN) * new Date(Number(T.slice(0, 4)), Number(T.slice(5, 7)), 0).getDate())}` });
      const byCat = new Map<string, number>(); for (const e of exps) if (String(e.date).startsWith(month)) { const name = cats.find((b: any) => b.id === e.categoryId)?.name || "Other"; byCat.set(name, (byCat.get(name) ?? 0) + (Number(e.amount) || 0)); }
      if (byCat.size) charts.push({ kind: "hbars", title: "This month by category", rows: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v], i) => { const lim = cats.find((b: any) => b.name === k)?.limit; return { label: k, value: Math.round(v), sub: lim ? `of ${money(lim)}` : undefined, color: lim && v > lim ? "#ef4444" : COLORS[i % COLORS.length] }; }), unit: "$" });
      charts.push({ kind: "bars", title: "Spending, 30 days", values: lastN(S("spend"), T, 30).map((v) => v ?? 0), dates: days30, unit: "$", color: "#0ea5e9" });
      const months = Array.from({ length: 6 }, (_, i) => { const d = at(`${month}-15`); d.setMonth(d.getMonth() - (5 - i)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
      charts.push({ kind: "hbars", title: "Last six months", rows: months.map((m) => ({ label: new Date(`${m}-15T12:00:00`).toLocaleDateString("en-US", { month: "long" }), value: Math.round(spentIn(m)) })), unit: "$" });
      charts.push({ kind: "weekday", title: "Spending by day of the week", values: byWeekday(Object.fromEntries(lastDays(T, 90).map((d) => [d, S("spend")[d] ?? 0])), T), unit: "$", color: "#0ea5e9" });
      charts.push({ kind: "list", title: "Biggest expenses this month", rows: exps.filter((e: any) => String(e.date).startsWith(month)).sort((a: any, b: any) => b.amount - a.amount).slice(0, 8).map((e: any) => ({ label: e.note || cats.find((b: any) => b.id === e.categoryId)?.name || "Expense", sub: fmtDate(day(e.date)), right: money(e.amount) })) });
    }
    const bills = arr(f.bills); if (bills.length) { stats.push({ label: "Bills a month", value: money(sum(bills.map((b: any) => Number(b.amount) || 0))), sub: `${bills.length} bills · ${bills.filter((b: any) => b.autopay).length} on autopay` }); const nextB = bills.map((b: any) => ({ b, d: Number(b.dueDay) >= Number(T.slice(8, 10)) ? Number(b.dueDay) : Number(b.dueDay) + 31 })).sort((a, b) => a.d - b.d).slice(0, 6); charts.push({ kind: "list", title: "Bills coming up", rows: nextB.map(({ b }: any) => ({ label: b.name, sub: `due the ${b.dueDay}${["th", "st", "nd", "rd"][b.dueDay % 10 > 3 || [11, 12, 13].includes(b.dueDay) ? 0 : b.dueDay % 10]}`, right: money(b.amount) })) }); }
    const subs = arr(f.subscriptions); if (subs.length) { const monthly = sum(subs.map((s2: any) => (s2.cycle === "weekly" ? s2.amount * 4.33 : s2.cycle === "yearly" ? s2.amount / 12 : s2.amount))); stats.push({ label: "Subscriptions", value: `${money(monthly)}/mo`, sub: `${money(monthly * 12)} a year · ${subs.length} services` }); charts.push({ kind: "hbars", title: "Subscriptions (per month)", rows: subs.map((s2: any) => ({ label: s2.name, value: Math.round((s2.cycle === "weekly" ? s2.amount * 4.33 : s2.cycle === "yearly" ? s2.amount / 12 : s2.amount) * 100) / 100 })).sort((a, b) => b.value - a.value), unit: "$" }); }
    const jars = arr(f.jars); if (jars.length) { stats.push({ label: "Saved in jars", value: money(sum(jars.map((j: any) => Number(j.saved) || 0))), sub: `of ${money(sum(jars.map((j: any) => Number(j.target) || 0)))}` }); charts.push({ kind: "progress", title: "Savings jars", rows: jars.map((j: any) => ({ label: `${j.emoji || ""} ${j.name}`.trim(), value: j.target ? Math.min(1, j.saved / j.target) : 0, sub: `${money(j.saved)} of ${money(j.target)}`, color: j.color })) }); }
    if (st.assets !== undefined || st.debts !== undefined) stats.push({ label: "Net worth", value: money((st.assets ?? 0) - (st.debts ?? 0)), sub: `${money(st.assets ?? 0)} owned · ${money(st.debts ?? 0)} owed` });
    const income = st.income || Number(f.income) || 0; if (income && exps.length) { const rate = 1 - spentIn(prevMonth) / income; stats.push({ label: "Savings rate", value: pct(rate), sub: `last month, of ${money(income)} take-home` }); }
    if (st.cushion !== undefined) stats.push({ label: "Emergency fund", value: `${st.cushion} months`, sub: "of expenses" });
    const gc = arr(f.giftCards); if (gc.length) stats.push({ label: "Gift card balances", value: money(sum(gc.map((g: any) => Number(g.balance) || 0))), sub: `${gc.length} cards` });
    const mi = arr(f.mileage); if (mi.length) { const yr = mi.filter((m: any) => String(m.date).startsWith(T.slice(0, 4))); stats.push({ label: "Miles logged this year", value: n1(sum(yr.map((m: any) => Number(m.miles) || 0))), sub: `worth ${money(sum(yr.map((m: any) => Number(m.miles) || 0)) * (Number(f.mileageRate) || 0.7))}` }); }
    const ins: string[] = [];
    if (exps.length) { const now = spentIn(month), last = spentIn(prevMonth); if (last) ins.push(`You've spent ${money(now)} so far this month, ${now >= last ? "already" : ""} ${pct(now / last)} of all of last month.`); }
    insights.push(...ins);
    sections.push({ id: "money", name: "Money", color: "#0ea5e9", icon: "money", blurb: "Spending, budget, bills, subscriptions, savings and net worth", stats, charts, insights: ins, empty: stats.length ? undefined : "Add expenses in Budget, bills, subscriptions or savings jars." });
  }

  // ——— Time & attention
  {
    const stats: Stat[] = [];
    const charts: Chart[] = [];
    const screen = S("screen"), social = S("social"), out = S("outdoors");
    const s30 = valuesIn(screen, T, 30); if (s30.length) { stats.push({ label: "Screen time", value: `${n1(avg(s30))} h`, sub: `a day · ${n0(avg(s30) * 365 / 24)} full days a year` }); charts.push({ kind: "bars", title: "Screen time, 30 days", values: lastN(screen, T, 30), dates: days30, unit: "h", goal: 2, color: "#64748b" }); }
    const so = valuesIn(social, T, 30); if (so.length) stats.push({ label: "Social media", value: `${n0(avg(so))} min`, sub: `a day · ${n0((avg(so) * 365) / 60)} hours a year` });
    const o30 = valuesIn(out, T, 30); if (o30.length) { stats.push({ label: "Time outside", value: hm(sum(valuesIn(out, T, 7))), sub: "this week · goal 2 hours" }); charts.push({ kind: "bars", title: "Minutes outside, 30 days", values: lastN(out, T, 30), dates: days30, unit: "min", color: "#22c55e" }); }
    const ev = arr(f.events);
    const evIn = (d: string) => ev.filter((e: any) => e.date === d).length;
    if (ev.length) {
      const next7 = lastDays(plusDays(T, 6), 7);
      stats.push({ label: "Events this week", value: n0(sum(next7.map(evIn))), sub: "next 7 days" });
      charts.push({ kind: "bars", title: "Calendar, next 7 days", values: next7.map(evIn), dates: next7, unit: "events", color: "#0ea5e9" });
      charts.push({ kind: "list", title: "Coming up on your calendar", rows: ev.filter((e: any) => isDay(e.date) && e.date >= T).sort((a: any, b: any) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 8).map((e: any) => ({ label: e.title, sub: `${fmtDate(e.date)}${e.time ? ` · ${e.time}` : ""}`, right: e.date === T ? "Today" : `${daysBetween(T, e.date)}d` })) });
    }
    const trips = arr(f.trips).filter((t: any) => isDay(t.start) && t.end >= T); if (trips.length) charts.push({ kind: "list", title: "Trips", rows: trips.map((t: any) => ({ label: t.name || t.destination, sub: `${fmtDate(t.start)} – ${fmtDate(t.end)}${t.budget ? ` · ${money(t.budget)} budget` : ""}`, right: t.start <= T ? "Now" : `${daysBetween(T, t.start)} days` })) });
    if (s30.length || so.length) {
      const sleepH = avg(valuesIn(S("sleep"), T, 30)) || 8, screenH = avg(s30) || 0, workH = 8;
      charts.push({ kind: "donut", title: "A typical day", parts: [{ label: "Sleep", value: Math.round(sleepH * 10) / 10, color: "#6366f1" }, { label: "Work or school", value: workH, color: "#94a3b8" }, { label: "Screens", value: Math.round(screenH * 10) / 10, color: "#64748b" }, { label: "Outside", value: Math.round((avg(o30) / 60) * 10) / 10, color: "#22c55e" }, { label: "Everything else", value: Math.max(0, Math.round((24 - sleepH - workH - screenH - avg(o30) / 60) * 10) / 10), color: "#e2e8f0" }].filter((p) => p.value > 0), unit: "h" });
    }
    sections.push({ id: "time", name: "Time & attention", color: "#64748b", icon: "clock", blurb: "Screens, time outside, calendar and trips", stats, charts, insights: [], empty: stats.length ? undefined : "Add screen time and time outside in the check-in, or events to your calendar." });
  }

  // ——— Home & life admin
  {
    const stats: Stat[] = [];
    const charts: Chart[] = [];
    const care = arr(f.care); if (care.length) { const overdue = care.filter((k: any) => k.lastDone && plusDays(k.lastDone, k.everyDays) < T); stats.push({ label: "Upkeep, plants, car & pets", value: n0(care.length), sub: `${overdue.length} overdue` }); if (overdue.length) charts.push({ kind: "list", title: "Overdue upkeep", rows: overdue.map((k: any) => ({ label: k.name, sub: k.group, right: `${daysBetween(plusDays(k.lastDone, k.everyDays), T)}d late` })) }); }
    const chores = arr(f.choreDone); if (chores.length) stats.push({ label: "Chores done", value: n0(chores.length), sub: `${chores.filter((d: any) => days30.includes(day(d.date))).length} in 30 days` });
    const groc = arr(f.groceries); if (groc.length) stats.push({ label: "Grocery list", value: `${groc.filter((g: any) => !g.checked).length} to buy`, sub: groc.some((g: any) => g.price) ? `about ${money(sum(groc.filter((g: any) => !g.checked).map((g: any) => Number(g.price) || 0)))}` : undefined });
    const meals = arr(f.meals); if (meals.length) stats.push({ label: "Meals planned", value: n0(meals.filter((m: any) => m.date >= T && m.date <= plusDays(T, 6)).length), sub: "this week" });
    const recipes = arr(f.recipes); if (recipes.length) stats.push({ label: "Recipes saved", value: n0(recipes.length) });
    const war = arr(f.warranties).filter((w: any) => isDay(w.until) && w.until >= T); if (war.length) charts.push({ kind: "list", title: "Warranties", rows: war.sort((a: any, b: any) => a.until.localeCompare(b.until)).slice(0, 6).map((w: any) => ({ label: w.item, sub: w.store, right: `until ${fmtDate(w.until)}` })) });
    const notes = arr(f.notes); if (notes.length) stats.push({ label: "Notes", value: n0(notes.length), sub: `${n0(sum(notes.map((nn: any) => wordsIn(String(nn.body ?? "")))))} words` });
    const pills = arr(f.pills).filter((p2: any) => p2.active); const doses = arr(f.pillDoses).filter((d: any) => days30.includes(day(d.date)));
    if (pills.length) { stats.push({ label: "Medicines", value: n0(pills.length) }); if (doses.length) stats.push({ label: "Doses taken", value: pct(doses.filter((d: any) => d.status === "taken").length / doses.length), sub: "of doses marked in 30 days" }); }
    sections.push({ id: "home", name: "Home & life admin", color: "#a16207", icon: "home", blurb: "Upkeep, chores, groceries, meals, notes and medicines", stats, charts, insights: [], empty: stats.length ? undefined : "Use Upkeep, Chores, Grocery, Meals or Pills." });
  }

  // ——— Work (WorkHub)
  if (x.work) {
    const w = x.work, stats: Stat[] = [], charts: Chart[] = [];
    const count = (k: string, label: string, sub?: string) => { const a = arr(w[k]); if (a.length) stats.push({ label, value: n0(a.length), sub }); return a; };
    count("students", "Students");
    const meet = count("meetings", "Meetings");
    const lessons = count("lessons", "Lessons");
    count("notes", "Notes");
    const plogs = count("parentLogs", "Parent contacts logged");
    count("behavior", "Behavior entries");
    count("assignments", "Assignments");
    count("emails", "Emails tracked");
    count("goals", "Student goals");
    const dated = (a: any[]) => a.map((r) => day(r.date ?? r.createdAt ?? r.at ?? "")).filter(Boolean);
    const recent = (a: any[]) => dated(a).filter((d) => days30.includes(d)).length;
    if (meet.length) { const up = meet.filter((m: any) => isDay(m.date) && m.date >= T).length; stats.push({ label: "Meetings coming up", value: n0(up) }); }
    if (lessons.length) stats.push({ label: "Lessons in 30 days", value: n0(recent(lessons)) });
    if (plogs.length) stats.push({ label: "Parent contacts in 30 days", value: n0(recent(plogs)) });
    const act: Record<string, number> = {}; for (const k of ["meetings", "lessons", "notes", "parentLogs", "behavior"]) for (const d of dated(arr(w[k]))) add(act, d, 1);
    if (Object.keys(act).length) charts.push({ kind: "bars", title: "WorkHub records, 30 days", values: lastN(act, T, 30).map((v) => v ?? 0), dates: days30, unit: "records", color: "#334155" });
    sections.push({ id: "work", name: "Work", color: "#334155", icon: "work", blurb: "WorkHub: students, meetings, lessons, parent contacts and more", stats, charts, insights: [], empty: stats.length ? undefined : "Nothing in WorkHub yet." });
  }

  // ——— Health scores (LE8, diabetes risk, screenings)
  {
    const stats: Stat[] = [];
    const charts: Chart[] = [];
    const labs = arr(ls.labs).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const L = (k: string) => [...labs].reverse().find((l: any) => l[k] !== undefined)?.[k];
    const lw = latest(S("weight"));
    const bmi = lw && heightIn ? (lw.v / (heightIn * heightIn)) * 703 : undefined;
    const ex7 = sum(valuesIn(S("exercise"), T, 7));
    const produce = avg(valuesIn(S("produce"), T, 14));
    const dietApprox = valuesIn(S("produce"), T, 14).length ? Math.round(Math.min(100, (produce / 5) * 70 + (sum(lastDays(T, 14).map((d) => c[d]?.processed ?? 0)) <= 2 ? 15 : 0) + (sum(lastDays(T, 14).map((d) => c[d]?.sugary ?? 0)) <= 2 ? 15 : 0))) : undefined;
    const hpBp = [...Object.entries(h)].filter(([, v]) => v.sys && v.dia).sort((a, b) => a[0].localeCompare(b[0])).pop();
    const total = L("total"), hdl = L("hdl");
    const le = le8({ dietApprox, activityMin: Object.keys(S("exercise")).length ? ex7 : undefined, nicotine: st.nicotine, secondhand: st.secondhand, sleepH: valuesIn(S("sleep"), T, 14).length ? avg(valuesIn(S("sleep"), T, 14)) : undefined, bmi, nonHdl: total && hdl ? total - hdl : undefined, lipidMeds: L("lipidMeds"), a1c: L("a1c"), glucose: L("glucose"), diabetes: L("diabetes"), sys: L("sys") ?? hpBp?.[1].sys, dia: L("dia") ?? hpBp?.[1].dia, bpMeds: L("bpMeds") });
    stats.push({ label: "Heart health (Life's Essential 8)", value: le.score === null ? "—" : `${le.score}/100`, sub: le.score === null ? "Needs at least 4 of the 8" : le.score >= 80 ? "High" : le.score >= 50 ? "Moderate" : "Low" });
    charts.push({ kind: "progress", title: "Life's Essential 8 (American Heart Association)", rows: le.parts.map((p, i) => ({ label: p.name, value: (p.score ?? 0) / 100, sub: p.score === null ? (p.note || "No data yet") : `${p.score}/100${p.note ? ` · ${p.note}` : ""}`, color: p.score === null ? "#cbd5e1" : p.score >= 80 ? "#10b981" : p.score >= 50 ? "#f59e0b" : "#ef4444" })) });
    const ada = adaRisk({ age: myAge || undefined, sex, gestational: st.gestational, family: st.familyDiabetes, highBp: st.highBp, active: Object.keys(S("exercise")).length ? ex7 >= 150 : undefined, bmi });
    stats.push({ label: "Type 2 diabetes risk (ADA test)", value: ada ? `${ada.points} points` : "—", sub: ada ? (ada.high ? "High risk: ask your doctor about an A1c test" : "Lower risk (under 5)") : "Needs age, sex, height, weight and exercise" });
    if (ada) charts.push({ kind: "list", title: "Diabetes risk test", rows: ada.parts.map((p) => ({ label: p })) });
    const due = screeningStatus(st, T);
    if (due.length) charts.push({ kind: "list", title: "Cancer screenings", rows: due.map((s2) => ({ label: s2.name, sub: s2.who, right: s2.due ? "Due" : `Next ${fmtDate(s2.next)}` })) });
    if (labs.length) charts.push({ kind: "list", title: "Labs you've entered", rows: labs.slice(-8).reverse().map((l: any) => ({ label: [l.sys && `BP ${l.sys}/${l.dia}`, l.total && `Chol ${l.total}`, l.hdl && `HDL ${l.hdl}`, l.ldl && `LDL ${l.ldl}`, l.a1c && `A1c ${l.a1c}%`, l.glucose && `Glucose ${l.glucose}`, l.waist && `Waist ${l.waist} in`].filter(Boolean).join(" · ") || "Entry", right: fmtDate(l.date) })) });
    sections.push({ id: "scores", name: "Health scores", color: "#ec4899", icon: "shield", blurb: "Heart health (LE8), diabetes risk, screenings and labs", stats, charts, insights: [], empty: undefined });
  }

  // ——— Insights across everything (patterns between parts of life)
  const pairs: [string, string, number][] = [["sleep", "happy", 0], ["sleep", "mood", 0], ["sleep", "energy", 0], ["steps", "mood", 0], ["exercise", "stress", 0], ["screen", "happy", 0], ["outdoors", "happy", 0], ["tasksdone", "happy", 0], ["sleep", "tasksdone", 1], ["alcohol", "hrv", 1], ["alcohol", "sleep", 1], ["kcal", "energy", 0], ["mindful", "stress", 0], ["spend", "happy", 0], ["connect", "happy", 0], ["steps", "sleep", 1]];
  const find = (id: string) => series.find((s) => s.id === id);
  for (const [a, b, lag] of pairs) { const A = find(a), B = find(b); if (!A || !B) continue; const r = correlate(A, B, lag); if (r.r !== null && Math.abs(r.r) >= 0.3 && r.n >= 10) insights.push(r.words); }
  return { sections, series, records, insights };
}
