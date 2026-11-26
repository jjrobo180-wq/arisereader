// Life Score (LifeHub section "lifescore", client/src/components/family-hub/LifeScoreApp.tsx): every part of a life
// scored 0 to 100 from what the person logs and what Apple Health knows, grouped into six areas (Body, Mind,
// Connection, Growth, Money, Prevention), with an overall Life Score, 30 days of history, patterns in their own
// data, and for every score the research behind it and how to raise it. Pure, so it's tested
// (tests/life-score.test.ts).
//
// Where the numbers come from:
//   Apple Health (iPhone app only, client/src/lib/lifeScoreHealth.ts): steps, active calories, sleep and bedtime,
//     resting heart rate, heart rate variability, mindful minutes. Saved per day in lifeScore.health so the
//     website shows them too.
//   The daily check-in (lifeScore.days): happiness, stress, energy, connection, faith, screen time (iPhone apps
//     can't read Screen Time, so it's typed in), time outside, exercise, food, alcohol, tobacco, sunscreen.
//   The rest of LifeHub: Mood, Sleep log, Meditate, Gratitude, Focus, Habits, Goals, to-dos, Budget, workouts.
// A score with nothing behind it is null and counts nowhere. Nothing here is a diagnosis: Prevention scores the
// habits that cancer-prevention guidelines recommend, not anyone's personal risk.

export type LifeCheckIn = {
  /** 0 to 10. */ happy?: number; stress?: number; energy?: number; connect?: number; faithFelt?: number;
  /** Quality time with someone who matters (no phones). */ together?: boolean;
  /** Prayer, scripture, worship or another faith practice today. */ faith?: boolean;
  /** Hours on screens outside work or school; minutes on social media. */ screen?: number; social?: number;
  /** Minutes. */ outdoors?: number; exercise?: number; mindful?: number;
  /** Muscle-strengthening today. */ strength?: boolean;
  /** Servings of fruit and vegetables. */ produce?: number;
  /** Drinks of alcohol; servings of processed meat, red meat; sugary drinks. */ alcohol?: number; processed?: number; red?: number; sugary?: number;
  smoked?: boolean;
  /** Sunscreen or shade when outside. */ sunscreen?: boolean;
  /** Hours slept (when Apple Health has none). */ sleep?: number;
  /** One line about the day. */ note?: string;
};
export type LifeHealthDay = {
  steps?: number; active?: number;
  /** Hours asleep the night before; bedtime as minutes after 6 PM (for how regular it is). */ sleep?: number; bed?: number;
  /** Beats a minute; heart rate variability in ms; mindful minutes. */ rhr?: number; hrv?: number; mindful?: number;
  /** Minutes of each sleep stage, and awake in the night. */ deep?: number; rem?: number; core?: number; awake?: number;
  /** Wake-up time as minutes after midnight. */ wake?: number;
  /** Kilometers walked or run; kilometers cycled; floors climbed; exercise minutes; hours with standing. */ km?: number; bikeKm?: number; flights?: number; exMin?: number; stand?: number;
  /** Resting (basal) calories burned; calories eaten (food apps that save to Health); water drunk in ml. */ basal?: number; eaten?: number; water?: number;
  /** Heart rate over the day: average, lowest and highest. */ hrAvg?: number; hrMin?: number; hrMax?: number;
  /** VO2 max (ml/kg/min), breaths a minute, blood oxygen %, body temperature °F, wrist temperature °F. */ vo2?: number; resp?: number; spo2?: number; temp?: number; wrist?: number;
  /** Weight in lb, body fat %, blood pressure, blood glucose mg/dL. */ weight?: number; fat?: number; sys?: number; dia?: number; glucose?: number;
  /** Workouts recorded in Health: how many, minutes, calories, and their kinds. */ wo?: number; woMin?: number; woCal?: number; woKinds?: string[];
};
export type ScreeningId = "breast" | "cervical" | "colorectal" | "lung";
export type LifeScoreSettings = {
  birthYear?: number; sex?: "female" | "male";
  /** Height in inches (for BMI when Health has none). */ heightIn?: number;
  /** Nicotine for Life's Essential 8. */ nicotine?: "never" | "quit5" | "quit1" | "quitRecent" | "current"; secondhand?: boolean;
  /** For the diabetes risk test. */ familyDiabetes?: boolean; gestational?: boolean; highBp?: boolean;
  /** Money in dollars: what you own and owe; monthly take-home pay. */ assets?: number; debts?: number; income?: number;
  /** 20 pack-years or more, and smoked within the last 15 years (lung screening). */ heavySmoker?: boolean;
  /** Months of expenses saved. */ cushion?: number;
  stepGoal?: number;
  /** The date each screening was last done, and how many years it lasts. */
  screenings: Partial<Record<ScreeningId, { date: string; years: number }>>;
  /** Scores switched off. */ off: MetricId[];
};
export type LifeScoreData = {
  days: Record<string, LifeCheckIn>; health: Record<string, LifeHealthDay>; settings: LifeScoreSettings; healthAt?: string;
  /** Questionnaire answers over time (shared/lifeScales.ts). */ scales?: Partial<Record<ScaleId, Assessment[]>>;
  /** Labs and vitals typed in (blood pressure, cholesterol, A1c…). */ labs?: Labs[];
};

export const emptyLifeScore = (): LifeScoreData => ({ days: {}, health: {}, settings: { screenings: {}, off: [] } });

import { SCALES, type Assessment, type Labs, type ScaleId } from "./lifeScales";

// ——— Cleaning (saved in the LifeHub, shared/familyHub.ts) ————————————————————————————————————————————————————
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown, lo: number, hi: number, step = 1): number | undefined => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return undefined;
  return Math.round(Math.round(Math.min(hi, Math.max(lo, n)) / step) * step * 1e6) / 1e6;
};
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const KEEP_DAYS = 400;

export function cleanCheckIn(r: any): LifeCheckIn {
  if (!r || typeof r !== "object") return {};
  return compact({
    happy: num(r.happy, 0, 10), stress: num(r.stress, 0, 10), energy: num(r.energy, 0, 10), connect: num(r.connect, 0, 10), faithFelt: num(r.faithFelt, 0, 10),
    together: bool(r.together), faith: bool(r.faith), screen: num(r.screen, 0, 24, 0.5), social: num(r.social, 0, 1440, 5),
    outdoors: num(r.outdoors, 0, 1440, 5), exercise: num(r.exercise, 0, 1440, 5), mindful: num(r.mindful, 0, 1440), strength: bool(r.strength),
    produce: num(r.produce, 0, 30), alcohol: num(r.alcohol, 0, 40), processed: num(r.processed, 0, 20), red: num(r.red, 0, 20), sugary: num(r.sugary, 0, 30),
    smoked: bool(r.smoked), sunscreen: bool(r.sunscreen), sleep: num(r.sleep, 0, 16, 0.25),
    note: typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 280) : undefined,
  });
}
function cleanHealthDay(r: any): LifeHealthDay {
  if (!r || typeof r !== "object") return {};
  return compact({
    steps: num(r.steps, 0, 200000), active: num(r.active, 0, 20000), sleep: num(r.sleep, 0, 16, 0.05), bed: num(r.bed, 0, 1439), rhr: num(r.rhr, 20, 220), hrv: num(r.hrv, 1, 400), mindful: num(r.mindful, 0, 1440),
    deep: num(r.deep, 0, 1000), rem: num(r.rem, 0, 1000), core: num(r.core, 0, 1200), awake: num(r.awake, 0, 1000), wake: num(r.wake, 0, 1439),
    km: num(r.km, 0, 500, 0.01), bikeKm: num(r.bikeKm, 0, 1000, 0.01), flights: num(r.flights, 0, 1000), exMin: num(r.exMin, 0, 1440), stand: num(r.stand, 0, 24),
    basal: num(r.basal, 0, 10000), eaten: num(r.eaten, 0, 20000), water: num(r.water, 0, 20000),
    hrAvg: num(r.hrAvg, 20, 250), hrMin: num(r.hrMin, 20, 250), hrMax: num(r.hrMax, 20, 250),
    vo2: num(r.vo2, 5, 100, 0.1), resp: num(r.resp, 4, 60, 0.1), spo2: num(r.spo2, 50, 100, 0.1), temp: num(r.temp, 80, 110, 0.1), wrist: num(r.wrist, -10, 10, 0.01),
    weight: num(r.weight, 20, 1000, 0.1), fat: num(r.fat, 1, 80, 0.1), sys: num(r.sys, 50, 260), dia: num(r.dia, 30, 180), glucose: num(r.glucose, 20, 700),
    wo: num(r.wo, 0, 50), woMin: num(r.woMin, 0, 1440), woCal: num(r.woCal, 0, 20000),
    woKinds: Array.isArray(r.woKinds) ? r.woKinds.filter((k: unknown) => typeof k === "string").slice(0, 10).map((k: string) => k.slice(0, 40)) : undefined,
  });
}
const keepRecent = <T>(rec: unknown, clean: (r: any) => T, empty: (t: T) => boolean): Record<string, T> => {
  if (!rec || typeof rec !== "object") return {};
  const days = Object.keys(rec as object).filter((d) => DAY.test(d)).sort().slice(-KEEP_DAYS);
  const out: Record<string, T> = {};
  for (const d of days) { const v = clean((rec as any)[d]); if (!empty(v)) out[d] = v; }
  return out;
};
export function cleanLifeScore(raw: unknown): LifeScoreData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as any, s = r.settings && typeof r.settings === "object" ? r.settings : {};
  const screenings: LifeScoreSettings["screenings"] = {};
  for (const id of Object.keys(SCREENINGS) as ScreeningId[]) {
    const x = s.screenings?.[id];
    if (x && DAY.test(String(x.date))) screenings[id] = { date: String(x.date), years: num(x.years, 1, 10) ?? SCREENINGS[id].years };
  }
  const ids = new Set(METRICS.map((m) => m.id));
  return {
    days: keepRecent(r.days, cleanCheckIn, (v) => !Object.keys(v).length),
    health: keepRecent(r.health, cleanHealthDay, (v) => !Object.keys(v).length),
    settings: compact({
      birthYear: num(s.birthYear, 1900, 2030), sex: s.sex === "female" || s.sex === "male" ? s.sex : undefined, heavySmoker: bool(s.heavySmoker),
      heightIn: num(s.heightIn, 30, 100, 0.5), nicotine: ["never", "quit5", "quit1", "quitRecent", "current"].includes(s.nicotine) ? s.nicotine : undefined, secondhand: bool(s.secondhand),
      familyDiabetes: bool(s.familyDiabetes), gestational: bool(s.gestational), highBp: bool(s.highBp),
      assets: num(s.assets, 0, 1e10), debts: num(s.debts, 0, 1e10), income: num(s.income, 0, 1e8),
      cushion: num(s.cushion, 0, 120, 0.5), stepGoal: num(s.stepGoal, 2000, 30000, 500), screenings,
      off: Array.isArray(s.off) ? [...new Set(s.off.filter((x: unknown) => ids.has(x as MetricId)))] as MetricId[] : [],
    }),
    ...(typeof r.healthAt === "string" && r.healthAt ? { healthAt: r.healthAt.slice(0, 40) } : {}),
    ...(() => {
      const scales: Partial<Record<ScaleId, Assessment[]>> = {};
      for (const def of SCALES) {
        const list = Array.isArray(r.scales?.[def.id]) ? r.scales[def.id] : [];
        const top = Math.max(...def.choices.map((c) => c.value)), bottom = Math.min(...def.choices.map((c) => c.value));
        const clean = list.filter((a: any) => a && DAY.test(String(a.date)) && Array.isArray(a.answers)).slice(-200)
          .map((a: any) => ({ date: String(a.date), answers: def.questions.map((_, i) => num(a.answers[i], bottom, top) ?? bottom) }));
        if (clean.length) scales[def.id] = clean;
      }
      return Object.keys(scales).length ? { scales } : {};
    })(),
    ...(() => {
      const labs = (Array.isArray(r.labs) ? r.labs : []).filter((l: any) => l && DAY.test(String(l.date))).slice(-200).map((l: any): Labs => compact({
        date: String(l.date), sys: num(l.sys, 50, 260), dia: num(l.dia, 30, 180), bpMeds: bool(l.bpMeds), total: num(l.total, 50, 600), hdl: num(l.hdl, 5, 200), ldl: num(l.ldl, 10, 500),
        trig: num(l.trig, 10, 3000), lipidMeds: bool(l.lipidMeds), a1c: num(l.a1c, 3, 20, 0.1), glucose: num(l.glucose, 20, 700), diabetes: bool(l.diabetes), waist: num(l.waist, 15, 90, 0.5),
      }));
      return labs.length ? { labs } : {};
    })(),
  };
}

// ——— Screenings (USPSTF, people at average risk) —————————————————————————————————————————————————————————————
export const SCREENINGS: Record<ScreeningId, { name: string; who: string; years: number; options: { years: number; label: string }[]; applies: (age: number, s: LifeScoreSettings) => boolean }> = {
  breast: { name: "Mammogram", who: "Women 40 to 74, every 2 years", years: 2, options: [{ years: 2, label: "Every 2 years" }, { years: 1, label: "Every year" }], applies: (a, s) => s.sex === "female" && a >= 40 && a <= 74 },
  cervical: { name: "Cervical screening", who: "Women 21 to 65: Pap test every 3 years, or HPV test every 5 years from 30", years: 3, options: [{ years: 3, label: "Pap test (3 years)" }, { years: 5, label: "HPV test (5 years)" }], applies: (a, s) => s.sex === "female" && a >= 21 && a <= 65 },
  colorectal: { name: "Colorectal screening", who: "Everyone 45 to 75: colonoscopy every 10 years, or a stool test every year", years: 10, options: [{ years: 10, label: "Colonoscopy (10 years)" }, { years: 1, label: "Stool test (every year)" }, { years: 3, label: "Stool DNA test (3 years)" }], applies: (a) => a >= 45 && a <= 75 },
  lung: { name: "Lung CT scan", who: "50 to 80 with a 20 pack-year smoking history who smoke or quit within 15 years, every year", years: 1, options: [{ years: 1, label: "Every year" }], applies: (a, s) => !!s.heavySmoker && a >= 50 && a <= 80 },
};
const addYears = (d: string, y: number) => `${Number(d.slice(0, 4)) + y}${d.slice(4)}`;
export function screeningStatus(settings: LifeScoreSettings, today: string): { id: ScreeningId; name: string; who: string; due: boolean; next: string }[] {
  const age = settings.birthYear ? Number(today.slice(0, 4)) - settings.birthYear : 0;
  if (!age) return [];
  return (Object.keys(SCREENINGS) as ScreeningId[]).filter((id) => SCREENINGS[id].applies(age, settings)).map((id) => {
    const done = settings.screenings[id];
    const next = done ? addYears(done.date, done.years) : "";
    return { id, name: SCREENINGS[id].name, who: SCREENINGS[id].who, due: !done || next <= today, next };
  });
}

// ——— What the scores are worked out from ———————————————————————————————————————————————————————————————————
export type LifeInput = {
  data: LifeScoreData;
  moods: { date: string; mood: number }[];
  sleepLog: { date: string; bed: string; wake: string }[];
  meditations: { date: string; minutes: number }[];
  gratitude: { date: string; items: string[] }[];
  focus: { date: string; minutes: number }[];
  habits: { days: string[] }[];
  goals: { done: boolean; kind: string; target: number; current: number; milestones: { done: boolean }[] }[];
  tasks: { due: string; done: boolean }[];
  exercise: { date: string; minutes: number }[];
  workouts: { date: string }[];
  monthlyBudget: number;
  expenses: { date: string; amount: number }[];
  /** The LifeHub Food & fitness diary, and its calorie goal and latest weight. */
  food?: { date: string; calories: number; protein: number; servings: number }[];
  kcalGoal?: number; weightLb?: number;
  /** The Health & Fitness (Cooked) data, when it could be read: its diary counts too. */
  fit?: any;
  /** To-dos checked off, any hub, with the day (YYYY-MM-DD): a measure's own "How to raise it" to-dos raise it. */
  doneTodos?: { title: string; date: string }[];
};

/** Life Score's input from the LifeHub (the first person's own logs). */
export function lifeInputFrom(family: any, tasks: { due: string; done: boolean }[]): LifeInput {
  const member = Object.keys(family?.health?.profiles ?? {})[0] ?? "";
  const mine = <T extends { memberId?: string }>(rows: T[] = []) => rows.filter((r) => !member || !r.memberId || r.memberId === member);
  return {
    data: family?.lifeScore ?? emptyLifeScore(),
    moods: mine(family?.moods),
    sleepLog: family?.sleep ?? [],
    meditations: family?.meditations ?? [],
    gratitude: family?.gratitude ?? [],
    focus: family?.focusLog ?? [],
    habits: family?.habits ?? [],
    goals: (family?.goals ?? []).filter((g: any) => !member || !g.memberId || g.memberId === member),
    tasks,
    exercise: mine(family?.health?.exercise),
    workouts: family?.workouts ?? [],
    monthlyBudget: (family?.budget ?? []).reduce((a: number, b: any) => a + (Number(b.limit) || 0), 0),
    expenses: family?.expenses ?? [],
    food: mine(family?.health?.food),
    kcalGoal: Number(family?.health?.goals?.[member]?.calories) || undefined,
    weightLb: [...(family?.health?.weights ?? [])].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))).pop()?.weight,
  };
}

// ——— Dates and numbers ———————————————————————————————————————————————————————————————————————————————————
const at = (d: string) => new Date(`${d}T12:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const plusDays = (d: string, n: number) => { const x = at(d); x.setDate(x.getDate() + n); return iso(x); };
export const lastDays = (today: string, n: number) => Array.from({ length: n }, (_, i) => plusDays(today, i - n + 1));
const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
const mean = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const sd = (xs: number[]) => { const m = mean(xs) ?? 0; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length); };
const hm = (t: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const sumBy = (rows: { date: string; minutes: number }[], d: string) => rows.filter((r) => r.date === d).reduce((a, r) => a + (Number(r.minutes) || 0), 0);

/** Everything known about one day, from every source. */
export type DayFacts = {
  steps?: number; active?: number; sleep?: number; bed?: number; rhr?: number; hrv?: number; mindful?: number; exercise?: number;
  happy?: number; stress?: number; energy?: number; connect?: number; together?: boolean; faith?: boolean; faithFelt?: number;
  screen?: number; social?: number; outdoors?: number; produce?: number; alcohol?: number; processed?: number; red?: number; sugary?: number;
  smoked?: boolean; sunscreen?: boolean; strength?: boolean; grateful?: boolean; focus?: number; habits?: number; checklist?: number;
  /** Calories and protein logged (Health & Fitness diary, Food & fitness diary, or Apple Health). */ kcal?: number; protein?: number;
};
export function factsFor(input: LifeInput, d: string): DayFacts {
  const c = input.data.days[d] ?? {}, h = input.data.health[d] ?? {};
  const mood = input.moods.filter((m) => m.date === d).map((m) => Number(m.mood)).filter((m) => m >= 1 && m <= 5);
  const log = input.sleepLog.find((s) => s.date === d);
  let logSleep: number | undefined, logBed: number | undefined;
  if (log) { const b = hm(log.bed), w = hm(log.wake); if (Number.isFinite(b) && Number.isFinite(w)) { logSleep = Math.round((((w - b + 1440) % 1440) / 60) * 4) / 4; logBed = (b - 1080 + 1440) % 1440; } }
  const med = sumBy(input.meditations, d);
  const mindful = h.mindful !== undefined || c.mindful !== undefined || med ? (h.mindful ?? 0) + (c.mindful ?? 0) + med : undefined;
  // Exercise: the check-in, else the most any source has (Apple Watch exercise minutes, Health workouts, the
  // Health & Fitness workouts and runs, the LifeHub diary and Workouts page).
  const fitMin = (Array.isArray(input.fit?.workouts) ? input.fit.workouts : []).filter((w: any) => w?.date === d).reduce((a: number, w: any) => a + Math.round((Number(w.secs) || 0) / 60), 0)
    + (Array.isArray(input.fit?.runs) ? input.fit.runs : []).filter((r: any) => r?.date === d).reduce((a: number, r: any) => a + Math.round((Number(r.secs) || 0) / 60), 0);
  const logged = Math.max(sumBy(input.exercise, d) + (input.workouts.some((w) => w.date === d) ? 30 : 0), fitMin, h.exMin ?? 0, h.woMin ?? 0);
  const exercise = c.exercise !== undefined ? Math.max(c.exercise, logged) : logged ? logged : h.exMin !== undefined ? 0 : undefined;
  const gr = input.gratitude.find((g) => g.date === d);
  const focusMin = sumBy(input.focus, d);
  let kcal = 0, protein = 0, logged2 = false;
  for (const e of input.food ?? []) if (e.date === d) { const m = Number(e.servings) || 1; kcal += (Number(e.calories) || 0) * m; protein += (Number((e as any).protein) || 0) * m; logged2 = true; }
  for (const e of Array.isArray(input.fit?.foods) ? input.fit.foods : []) if (e?.date === d) { const m = Number(e.servings) || 1; kcal += (Number(e.kcal) || 0) * m; protein += (Number(e.p) || 0) * m; logged2 = true; }
  if (!logged2 && h.eaten) { kcal = h.eaten; logged2 = true; }
  const due = input.tasks.filter((t) => t.due === d);
  const habitsOn = input.habits.length && input.habits.some((x) => x.days.some((y) => y <= d)) ? input.habits.filter((x) => x.days.includes(d)).length / input.habits.length : undefined;
  return compact({
    steps: h.steps, active: h.active, sleep: h.sleep ?? c.sleep ?? logSleep, bed: h.bed ?? logBed, rhr: h.rhr, hrv: h.hrv, mindful, exercise,
    happy: c.happy ?? (mood.length ? Math.round(((mean(mood)! - 1) / 4) * 100) / 10 : undefined),
    stress: c.stress, energy: c.energy, connect: c.connect, together: c.together, faith: c.faith, faithFelt: c.faithFelt,
    screen: c.screen, social: c.social, outdoors: c.outdoors, produce: c.produce, alcohol: c.alcohol, processed: c.processed, red: c.red, sugary: c.sugary,
    smoked: c.smoked, sunscreen: c.sunscreen, strength: c.strength,
    grateful: gr && gr.items.some((x) => x.trim()) ? true : undefined,
    focus: focusMin || undefined, habits: habitsOn, checklist: due.length ? due.filter((t) => t.done).length / due.length : undefined,
    kcal: logged2 ? Math.round(kcal) : undefined, protein: logged2 && protein ? Math.round(protein) : undefined,
  });
}

// ——— The scores ——————————————————————————————————————————————————————————————————————————————————————————————
export type AreaId = "body" | "mind" | "connection" | "growth" | "money" | "prevention";
export type MetricId =
  | "steps" | "exercise" | "sleep" | "rhythm" | "heart" | "food" | "nutrition"
  | "happy" | "calm" | "energy" | "mindful" | "screen" | "outdoors"
  | "connect" | "faith" | "gratitude"
  | "goals" | "habits" | "checklist" | "focus"
  | "budget" | "cushion"
  | "prevention";

export const AREAS: { id: AreaId; name: string; color: string; blurb: string }[] = [
  { id: "body", name: "Body", color: "#ff5a5f", blurb: "Movement, sleep, heart and food" },
  { id: "mind", name: "Mind", color: "#7c6cf0", blurb: "Happiness, stress, energy and attention" },
  { id: "connection", name: "Connection", color: "#f59e0b", blurb: "People, faith and gratitude" },
  { id: "growth", name: "Growth", color: "#10b981", blurb: "Goals, habits and focus" },
  { id: "money", name: "Money", color: "#0ea5e9", blurb: "Spending and savings" },
  { id: "prevention", name: "Prevention", color: "#ec4899", blurb: "Cancer-prevention habits and screenings" },
];

export type Ctx = { input: LifeInput; facts: (d: string) => DayFacts; today: string };
type Source = { title: string; finding: string };
export type MetricDef = {
  id: MetricId; area: AreaId; name: string;
  /** What it measures and what counts as 100. */ measures: string;
  /** Where its numbers come from. */ from: string;
  /** The research, in plain words. */ why: string; sources: Source[];
  /** How to raise it, in depth. */ improve: string[];
  /** To-dos it can add. */ todos: string[];
  /** The day's score (0 to 100), or null with nothing behind it. */ score: (d: string, x: Ctx) => number | null;
  /** The number behind today's score, in words. */ value: (d: string, x: Ctx) => string;
  /** Scored on a rolling 7 days (a weekly target) rather than day by day. */ weekly?: boolean;
};

const win = (x: Ctx, d: string, n = 7) => lastDays(d, n).map((day) => x.facts(day));
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const avgOf = (x: Ctx, d: string, key: keyof DayFacts, n = 7) => mean(win(x, d, n).map((f) => f[key] as number | undefined));
const weekSum = (x: Ctx, d: string, key: keyof DayFacts) => { const w = win(x, d).map((f) => f[key] as number | undefined); return w.some((v) => v !== undefined) ? w.reduce<number>((a, v) => a + (v ?? 0), 0) : null; };
/** Logged at all, ever, up to this day (a habit not tracked yet isn't a zero). */
const started = (x: Ctx, d: string, key: keyof DayFacts) => lastDays(d, 60).some((day) => x.facts(day)[key] !== undefined);

export const sleepScore = (h: number) => (h >= 7 && h <= 9 ? 100 : h < 7 ? clamp(100 - (7 - h) * 25) : clamp(Math.max(60, 100 - (h - 9) * 20)));
export const rhrScore = (b: number) => clamp(b <= 55 ? 100 : 100 - (b - 55) * (80 / 35));
export const screenScore = (hours?: number, social?: number) => mean([hours === undefined ? null : clamp(hours <= 2 ? 100 : 100 - (hours - 2) * 15), social === undefined ? null : clamp(social <= 30 ? 100 : 100 - (social - 30) * (80 / 150))]);
export const alcoholScore = (drinks: number) => (drinks <= 0 ? 100 : drinks <= 3 ? 85 : drinks <= 7 ? 65 : drinks <= 14 ? 35 : 10);

export const METRICS: MetricDef[] = [
  // ——— Body
  { id: "steps", area: "body", name: "Steps", measures: "Your daily steps against your goal (8,000 unless you set one).", from: "Apple Health (iPhone and Apple Watch).",
    why: "Walking more is one of the most consistent predictors of living longer. In a pooled analysis of 15 studies and nearly 50,000 adults, more daily steps meant steadily lower risk of death, with the benefit leveling off around 6,000 to 8,000 steps a day for people over 60 and 8,000 to 10,000 for younger adults. Pace mattered less than the total.",
    sources: [{ title: "Paluch et al., The Lancet Public Health, 2022", finding: "More steps a day, lower all-cause mortality, leveling off at 6,000–10,000 depending on age." }],
    improve: ["Add one 10-minute walk after a meal: about 1,000 to 1,300 steps, and it blunts the blood-sugar rise after eating.", "Take calls and meetings on your feet or walking.", "Park farther away and take stairs: small additions stack up over a day.", "Raise your goal by 500 steps once you hit it 5 days in a row, not before."],
    todos: ["Walk 10 minutes after lunch", "Take one phone call walking", "Evening walk around the block"],
    score: (d, x) => { const v = avgOf(x, d, "steps"); return v === null ? null : clamp((v / (x.input.data.settings.stepGoal || 8000)) * 100); },
    value: (d, x) => { const v = avgOf(x, d, "steps"); return v === null ? "No steps yet" : `${fmt(v)} a day (7-day average)`; } },
  { id: "exercise", area: "body", name: "Exercise", weekly: true, measures: "Minutes of exercise in the last 7 days against 150 (the World Health Organization's minimum for adults).", from: "Your check-ins, workouts and the Health & fitness diary.",
    why: "The WHO recommends 150 to 300 minutes of moderate activity (or 75 to 150 vigorous) every week, plus muscle-strengthening on 2 or more days. Meeting it lowers the risk of heart disease, type 2 diabetes, several cancers, depression and early death. An umbrella review of 97 reviews found exercise reduced symptoms of depression and anxiety about as well as therapy or medication.",
    sources: [{ title: "World Health Organization guidelines on physical activity, 2020", finding: "150–300 min moderate or 75–150 min vigorous a week, plus strength 2+ days." }, { title: "Singh et al., British Journal of Sports Medicine, 2023", finding: "Physical activity clearly reduced depression, anxiety and distress." }],
    improve: ["Split it: 30 minutes on 5 days, or 3 × 10-minute brisk walks on busy days. Every bout counts.", "Moderate means you can talk but not sing. Brisk walking, cycling and swimming all count.", "Add strength twice a week: push-ups, squats, lunges, bands. Strength protects muscle and bone as you age.", "Schedule it like a meeting: a set time makes it about twice as likely to happen."],
    todos: ["30-minute brisk walk", "Strength workout (push-ups, squats, lunges)", "Plan this week's workouts"],
    score: (d, x) => { const s = weekSum(x, d, "exercise"); return s === null ? null : clamp((s / 150) * 100); },
    value: (d, x) => { const s = weekSum(x, d, "exercise"); return s === null ? "No exercise logged yet" : `${fmt(s)} of 150 minutes this week`; } },
  { id: "sleep", area: "body", name: "Sleep", measures: "Hours asleep (7-night average); 7 to 9 hours scores 100.", from: "Apple Health sleep (Apple Watch or the iPhone's Sleep schedule), the Sleep log, or your check-in.",
    why: "Adults need 7 or more hours a night. Regularly sleeping less is linked to weight gain, diabetes, high blood pressure, heart disease, depression, weaker immunity and more accidents, and it lowers mood and focus the next day.",
    sources: [{ title: "American Academy of Sleep Medicine and Sleep Research Society consensus, 2015", finding: "Adults should sleep 7 or more hours a night on a regular basis." }],
    improve: ["Set a fixed wake-up time, even on weekends, and count back 8 hours for bedtime.", "Get bright light, outdoors if you can, in the first hour after waking: it sets your body clock.", "No caffeine after about 2 PM: half of it is still in you 5 to 6 hours later.", "Keep the bedroom cool (around 65–68°F), dark and quiet; phone outside the bedroom.", "If you can't sleep after about 20 minutes, get up and do something calm in dim light until sleepy."],
    todos: ["Phone out of the bedroom tonight", "Set a fixed wake-up time", "No caffeine after 2 PM"],
    score: (d, x) => { const v = avgOf(x, d, "sleep"); return v === null ? null : sleepScore(v); },
    value: (d, x) => { const v = avgOf(x, d, "sleep"); return v === null ? "No sleep yet" : `${Math.floor(v)} h ${Math.round((v % 1) * 60)} min a night`; } },
  { id: "rhythm", area: "body", name: "Sleep regularity", measures: "How much your bedtime moves around over 2 weeks: within 30 minutes scores 100.", from: "Apple Health sleep or the Sleep log.",
    why: "Going to bed at about the same time matters as much as how long you sleep. In a UK Biobank study of about 60,000 people with sleep trackers, those with the most regular sleep had 20 to 48% lower risk of death than the least regular, and regularity predicted mortality better than sleep duration did.",
    sources: [{ title: "Windred et al., SLEEP, 2024", finding: "Sleep regularity was a stronger predictor of mortality than sleep duration." }],
    improve: ["Pick a bedtime window of 30 minutes and protect it, weekends included.", "Set a wind-down alarm 45 minutes before bed: dim lights, screens away.", "Avoid sleeping in more than an hour on weekends: it's jet lag you give yourself.", "If you nap, keep it under 30 minutes and before 3 PM."],
    todos: ["Set a wind-down alarm", "Same bedtime all week"],
    score: (d, x) => { const beds = win(x, d, 14).map((f) => f.bed).filter((b): b is number => b !== undefined); if (beds.length < 4) return null; const s = sd(beds); return clamp(s <= 30 ? 100 : 100 - (s - 30) * (80 / 90)); },
    value: (d, x) => { const beds = win(x, d, 14).map((f) => f.bed).filter((b): b is number => b !== undefined); return beds.length < 4 ? "Needs 4 nights with a bedtime" : `Bedtime varies by about ${Math.round(sd(beds))} minutes`; } },
  { id: "heart", area: "body", name: "Heart", measures: "Resting heart rate (7-day average): 55 or lower scores 100.", from: "Apple Health (Apple Watch).",
    why: "A lower resting heart rate usually means a fitter heart. A meta-analysis of 46 studies and 1.2 million people found every 10 beats a minute higher resting heart rate came with about 9% higher risk of death. Heart rate variability (shown beside it) is best read against your own normal: a drop often means poor sleep, illness, stress or overtraining.",
    sources: [{ title: "Zhang, Shen & Qi, CMAJ, 2016", finding: "Each 10 bpm higher resting heart rate: about 9% higher all-cause mortality." }],
    improve: ["Regular aerobic exercise is the main lever: resting heart rate often drops several beats after a few months.", "Sleep 7 or more hours: short sleep raises it the next day.", "Alcohol raises resting heart rate and lowers heart rate variability that night: compare drinking and non-drinking days below.", "Slow breathing (about 6 breaths a minute) for 5 minutes calms the nervous system."],
    todos: ["5 minutes of slow breathing", "Alcohol-free week"],
    score: (d, x) => { const v = avgOf(x, d, "rhr"); return v === null ? null : rhrScore(v); },
    value: (d, x) => { const v = avgOf(x, d, "rhr"), h = avgOf(x, d, "hrv"); return v === null ? "No resting heart rate yet" : `${Math.round(v)} bpm resting${h ? ` · HRV ${Math.round(h)} ms` : ""}`; } },
  { id: "food", area: "body", name: "Food", measures: "Servings of fruit and vegetables a day: 5 scores 100.", from: "Your check-ins.",
    why: "In data from over 2 million people, eating about 5 servings of fruit and vegetables a day (2 fruit, 3 vegetables) was linked to the lowest risk of death, about 13% lower than 2 servings; more than 5 added little. Leafy greens, citrus and berries showed the most benefit; starchy vegetables and juice didn't.",
    sources: [{ title: "Wang et al., Circulation, 2021", finding: "About 5 servings a day of fruit and vegetables linked to the lowest mortality." }],
    improve: ["One serving is about a cup of raw leafy greens, half a cup of other vegetables, or one medium fruit.", "Add a vegetable to breakfast (spinach in eggs, tomatoes, peppers).", "Keep washed fruit where you can see it: what's visible gets eaten.", "Fill half your plate with vegetables at dinner first."],
    todos: ["Buy fruit and vegetables for the week", "Vegetable with every meal today"],
    score: (d, x) => { const v = avgOf(x, d, "produce"); return v === null ? null : clamp((v / 5) * 100); },
    value: (d, x) => { const v = avgOf(x, d, "produce"); return v === null ? "Log servings in a check-in" : `${Math.round(v * 10) / 10} servings a day`; } },
  { id: "nutrition", area: "body", name: "Nutrition", measures: "Calories against your goal (within 10% scores 100) and protein against 1 g per kg of body weight, from your food diary, 7-day average.", from: "Health & Fitness food diary, the Food & fitness diary, or a food app that saves to Apple Health.",
    why: "Eating close to your energy needs is how weight changes, or stays put. Protein matters most for keeping muscle as you age and while losing weight: the adult minimum is 0.8 g per kg of body weight, and studies of people who exercise or are losing weight find benefits around 1.2 to 1.6 g/kg. Logging food itself works: in a weight-loss trial, people who kept daily food records lost about twice as much as those who didn't.",
    sources: [{ title: "Morton et al., British Journal of Sports Medicine, 2018", finding: "Protein supplementation increased muscle gains with training, leveling off around 1.6 g/kg/day." }, { title: "Hollis et al., American Journal of Preventive Medicine, 2008", finding: "Keeping daily food records doubled weight loss." }],
    improve: ["Log as you eat, not at night: memory undercounts by hundreds of calories.", "Build each meal around a protein: eggs, Greek yogurt, chicken, fish, beans, tofu.", "Aim for 25–40 g of protein per meal rather than one big serving at dinner.", "Use your most-logged foods (Stats → Food) to make logging two taps.", "If you're often over, look at drinks and snacks first: they're the easiest calories to cut."],
    todos: ["Log every meal today", "Protein at breakfast", "Prep protein for the week"],
    score: (d, x) => {
      const days = win(x, d).filter((f) => f.kcal !== undefined);
      if (!days.length) return null;
      const goal = x.input.kcalGoal || Number(x.input.fit?.profile?.kcalGoal) || 0;
      const kg = x.input.weightLb ? x.input.weightLb / 2.20462 : (Array.isArray(x.input.fit?.weights) && x.input.fit.weights.length ? Number(x.input.fit.weights[x.input.fit.weights.length - 1].kg) : 0);
      const cal = goal ? mean(days.map((f) => clamp(100 - (Math.max(0, Math.abs(f.kcal! - goal) - goal * 0.1) / goal) * 300))) : null;
      const pro = kg ? mean(days.map((f) => clamp(((f.protein ?? 0) / kg) * 100))) : null;
      const m = mean([cal, pro]);
      return m === null ? clamp(Math.min(100, (days.length / 7) * 100)) : clamp(m);
    },
    value: (d, x) => { const days = win(x, d).filter((f) => f.kcal !== undefined); return days.length ? `${fmt(mean(days.map((f) => f.kcal!))!)} kcal · ${fmt(mean(days.map((f) => f.protein ?? 0))!)} g protein a day` : "Log food in Health & Fitness"; } },
  // ——— Mind
  { id: "happy", area: "mind", name: "Happiness", measures: "How happy you felt (0 to 10), averaged over 7 days.", from: "Your check-ins, or the Mood tracker.",
    why: "Happiness isn't only a feeling: people with higher well-being tend to have better health and longer lives. Tracking it daily shows what actually moves yours (see Patterns), which is more useful than general advice. The biggest drivers in large studies are relationships, health, meaningful work and time spent on things you value.",
    sources: [{ title: "Harvard Study of Adult Development (Waldinger & Schulz, 2023)", finding: "Warm relationships were the strongest predictor of happiness and health across 80+ years." }],
    improve: ["Look at your Patterns: what your best days have in common is your own evidence.", "Plan one thing a day you look forward to: anticipation itself lifts mood.", "Do something kind for someone: acts of kindness reliably raise the giver's mood.", "Spend money on experiences and time with people rather than things."],
    todos: ["Plan something to look forward to", "Do one kind thing for someone"],
    score: (d, x) => { const v = avgOf(x, d, "happy"); return v === null ? null : clamp(v * 10); },
    value: (d, x) => { const v = avgOf(x, d, "happy"); return v === null ? "Rate your day in a check-in" : `${Math.round(v * 10) / 10} out of 10`; } },
  { id: "calm", area: "mind", name: "Calm", measures: "How low your stress was (stress 0 scores 100).", from: "Your check-ins.",
    why: "Short bursts of stress are normal and even useful. Stress that stays high keeps stress hormones up, which disturbs sleep, raises blood pressure and is linked to heart disease, depression and weaker immunity. Exercise, sleep, slow breathing, time outside and talking with someone are the best-supported ways down.",
    sources: [{ title: "Singh et al., British Journal of Sports Medicine, 2023", finding: "Physical activity reduced psychological distress across populations." }],
    improve: ["Breathe slowly: in for 4, out for 6, for 5 minutes. A longer out-breath calms the nervous system.", "Write the worry down with one next step: it moves it out of your head.", "Move: even a 10-minute walk lowers stress for hours.", "Name what you can control and what you can't; act only on the first list today."],
    todos: ["5 minutes of slow breathing", "Write down what's worrying me and one next step"],
    score: (d, x) => { const v = avgOf(x, d, "stress"); return v === null ? null : clamp(100 - v * 10); },
    value: (d, x) => { const v = avgOf(x, d, "stress"); return v === null ? "Rate your stress in a check-in" : `Stress ${Math.round(v * 10) / 10} out of 10`; } },
  { id: "energy", area: "mind", name: "Energy", measures: "How energetic you felt (0 to 10).", from: "Your check-ins.",
    why: "Daytime energy is a sum of sleep, movement, food, light and mood. Tracking it next to those shows which one is your bottleneck: Patterns compares your energy on days with and without each.",
    sources: [{ title: "Your own Patterns, below", finding: "Compares your energy on days you slept, moved and ate well with days you didn't." }],
    improve: ["Get morning daylight within an hour of waking.", "Move every hour: 2 minutes of walking beats a coffee for the afternoon slump.", "Eat protein and fiber at breakfast instead of sugar alone.", "Drink water: mild dehydration lowers alertness."],
    todos: ["Morning walk in daylight", "Stand and move every hour"],
    score: (d, x) => { const v = avgOf(x, d, "energy"); return v === null ? null : clamp(v * 10); },
    value: (d, x) => { const v = avgOf(x, d, "energy"); return v === null ? "Rate your energy in a check-in" : `${Math.round(v * 10) / 10} out of 10`; } },
  { id: "mindful", area: "mind", name: "Mindfulness", weekly: true, measures: "Mindful minutes in 7 days: 70 (10 a day) scores 100.", from: "Apple Health mindful minutes, Meditate and your check-ins.",
    why: "A review of 47 trials with over 3,500 people found mindfulness meditation programs gave moderate improvements in anxiety, depression and pain. Benefits build with regular practice; a few minutes a day is enough to start.",
    sources: [{ title: "Goyal et al., JAMA Internal Medicine, 2014", finding: "Mindfulness meditation: moderate evidence of improved anxiety, depression and pain." }],
    improve: ["Start with 5 minutes at the same time each day: after coffee, or before bed.", "Focus on the breath; when the mind wanders, notice it and come back. That noticing is the exercise.", "Use Meditate in LifeHub or the Breathe app on Apple Watch so the minutes count here.", "Walk without your phone for 10 minutes, paying attention to what you see and hear."],
    todos: ["5-minute meditation", "Phone-free walk"],
    score: (d, x) => { const s = weekSum(x, d, "mindful"); return s === null ? null : clamp((s / 70) * 100); },
    value: (d, x) => { const s = weekSum(x, d, "mindful"); return s === null ? "No mindful minutes yet" : `${fmt(s)} minutes this week`; } },
  { id: "screen", area: "mind", name: "Screen time", measures: "Hours on screens outside work (2 or less scores 100) and minutes on social media (30 or less scores 100).", from: "Your check-ins. iPhone apps can't read Screen Time, so copy it from Settings → Screen Time.",
    why: "In a randomized trial, students who limited social media to 30 minutes a day for 3 weeks had significantly less loneliness and depression than those who used it as usual. Heavy recreational screen use also crowds out sleep, movement and time with people, the things that raise every other score here.",
    sources: [{ title: "Hunt, Marx, Lipson & Young, Journal of Social and Clinical Psychology, 2018", finding: "Limiting social media to 30 min/day reduced loneliness and depression." }],
    improve: ["Set App Limits in Settings → Screen Time → App Limits for social apps (30 minutes a day).", "Turn on grayscale (Settings → Accessibility → Display & Text Size → Color Filters): a gray phone is much less pulling.", "Move social apps off the Home Screen into the App Library.", "Replace the scroll: when you reach for the phone out of boredom, open Life Score and do one improvement instead.", "Charge your phone outside the bedroom."],
    todos: ["Set a 30-minute social media limit", "Move social apps off the Home Screen", "Charge phone outside the bedroom"],
    score: (d, x) => mean(win(x, d).map((f) => screenScore(f.screen, f.social))) === null ? null : clamp(mean(win(x, d).map((f) => screenScore(f.screen, f.social)))!),
    value: (d, x) => { const h = avgOf(x, d, "screen"), s = avgOf(x, d, "social"); return h === null && s === null ? "Add screen time in a check-in" : [h !== null ? `${Math.round(h * 10) / 10} h a day` : "", s !== null ? `${Math.round(s)} min social` : ""].filter(Boolean).join(" · "); } },
  { id: "outdoors", area: "mind", name: "Nature", weekly: true, measures: "Minutes outside in nature in 7 days: 120 scores 100.", from: "Your check-ins.",
    why: "In a study of nearly 20,000 people, those who spent at least 120 minutes a week in nature were significantly more likely to report good health and high well-being than those who spent none. It didn't matter whether it came in one visit or several short ones.",
    sources: [{ title: "White et al., Scientific Reports, 2019", finding: "120+ minutes a week in nature linked to better health and well-being." }],
    improve: ["Two hours a week is about 20 minutes a day: a park at lunch counts.", "Walk outside for calls.", "Eat a meal outdoors when the weather allows.", "Plan one longer outing on the weekend: a trail, beach or lake."],
    todos: ["20 minutes in a park", "Plan a weekend hike"],
    score: (d, x) => { const s = weekSum(x, d, "outdoors"); return s === null ? null : clamp((s / 120) * 100); },
    value: (d, x) => { const s = weekSum(x, d, "outdoors"); return s === null ? "Log time outside in a check-in" : `${fmt(s)} minutes this week`; } },
  // ——— Connection
  { id: "connect", area: "connection", name: "Relationships", measures: "How connected you felt (0 to 10) and the days you had real time with someone who matters.", from: "Your check-ins.",
    why: "A review of 148 studies with over 300,000 people found that people with stronger social relationships had a 50% greater likelihood of survival over the study periods, an effect comparable to quitting smoking. In the Harvard Study of Adult Development, how satisfied people were with their relationships at 50 predicted their health at 80 better than their cholesterol did.",
    sources: [{ title: "Holt-Lunstad, Smith & Layton, PLoS Medicine, 2010", finding: "Strong social relationships: 50% greater likelihood of survival." }, { title: "Harvard Study of Adult Development", finding: "Relationship satisfaction at 50 predicted health at 80." }],
    improve: ["Put one phone-free hour with someone on the calendar each week.", "Reach out first: a two-line text to someone you miss.", "Ask a deeper question than \"How was your day?\" (what was the best part, what's on your mind).", "Show up for small moments: when someone shares something, turn toward it."],
    todos: ["Text someone I miss", "Phone-free dinner with family", "Plan time with a friend"],
    score: (d, x) => { const w = win(x, d); const felt = mean(w.map((f) => f.connect)); const days = w.filter((f) => f.together !== undefined); const parts = [felt === null ? null : felt * 10, days.length ? (days.filter((f) => f.together).length / days.length) * 100 : null]; const m = mean(parts); return m === null ? null : clamp(m); },
    value: (d, x) => { const w = win(x, d); const felt = mean(w.map((f) => f.connect)); const t = w.filter((f) => f.together).length; return felt === null && !w.some((f) => f.together !== undefined) ? "Add connection in a check-in" : `${felt !== null ? `${Math.round(felt * 10) / 10} out of 10 · ` : ""}${t} day${t === 1 ? "" : "s"} together`; } },
  { id: "faith", area: "connection", name: "Faith", measures: "Days with prayer, scripture or worship, and how connected to God or something greater you felt.", from: "Your check-ins.",
    why: "In the Nurses' Health Study, which followed about 75,000 women for 16 years, those who attended religious services more than once a week had about 33% lower risk of death than those who never attended, along with lower rates of depression. Researchers point to community, purpose, hope and healthier habits as likely reasons.",
    sources: [{ title: "Li, Stampfer, Williams & VanderWeele, JAMA Internal Medicine, 2016", finding: "Weekly-plus service attendance: about 33% lower mortality among women." }],
    improve: ["Set a daily time for prayer or reading: the same time each day makes it a habit.", "Join a small group or service each week: the community is part of the benefit.", "Keep a short list of answered prayers or things you're thankful for.", "Serve someone: volunteering through a faith community combines purpose and connection."],
    todos: ["Morning prayer or reading", "Plan to attend a service this week"],
    score: (d, x) => { const w = win(x, d); const days = w.filter((f) => f.faith !== undefined); const felt = mean(w.map((f) => f.faithFelt)); const m = mean([days.length ? (days.filter((f) => f.faith).length / days.length) * 100 : null, felt === null ? null : felt * 10]); return m === null ? null : clamp(m); },
    value: (d, x) => { const w = win(x, d); const n = w.filter((f) => f.faith).length; return w.every((f) => f.faith === undefined && f.faithFelt === undefined) ? "Add faith in a check-in" : `${n} of 7 days`; } },
  { id: "gratitude", area: "connection", name: "Gratitude", measures: "Days in the last week you wrote down something you're grateful for.", from: "Gratitude in LifeHub.",
    why: "In a classic set of experiments, people who wrote down things they were grateful for each week felt better about their lives, were more optimistic and exercised more than those who wrote about hassles or neutral events.",
    sources: [{ title: "Emmons & McCullough, Journal of Personality and Social Psychology, 2003", finding: "Gratitude journaling improved well-being and optimism." }],
    improve: ["Write 3 specific things each night: \"the way my son laughed at dinner\", not \"family\".", "Include why it happened: it trains you to notice the good.", "Once a month, tell someone directly what you're grateful for in them."],
    todos: ["Write 3 things I'm grateful for", "Thank someone in person"],
    score: (d, x) => (started(x, d, "grateful") ? clamp((win(x, d).filter((f) => f.grateful).length / 7) * 100) : null),
    value: (d, x) => `${win(x, d).filter((f) => f.grateful).length} of 7 days` },
  // ——— Growth
  { id: "goals", area: "growth", name: "Goals", measures: "How far along your open goals are.", from: "Goals in LifeHub.",
    why: "Goals work best with a plan for exactly when and where you'll act. A meta-analysis of 94 studies found these \"if-then\" plans (\"If it's 7 AM Monday, then I run\") had a medium-to-large effect on actually reaching goals. Having a sense of purpose is itself linked to lower mortality.",
    sources: [{ title: "Gollwitzer & Sheeran, Advances in Experimental Social Psychology, 2006", finding: "Implementation intentions had a medium-to-large effect on goal attainment." }, { title: "Alimujiang et al., JAMA Network Open, 2019", finding: "Stronger life purpose linked to lower all-cause mortality." }],
    improve: ["Turn each goal into a when-where-what plan: \"After I drop the kids off, I'll walk 20 minutes at the park.\"", "Break big goals into milestones you can finish in a week.", "Review goals every Sunday: what moved, what's next.", "Track progress visibly: it's one of the most reliable ways to keep going."],
    todos: ["Write if-then plans for my goals", "Sunday goals review"],
    score: (d, x) => { if (d !== x.today) return null; const open = x.input.goals.filter((g) => !g.done); const done = x.input.goals.filter((g) => g.done).length; if (!open.length && !done) return null; const prog = open.map((g) => (g.kind === "number" ? (g.target > 0 ? Math.min(1, g.current / g.target) : 0) : g.milestones.length ? g.milestones.filter((m) => m.done).length / g.milestones.length : 0)); return clamp(((prog.reduce((a, b) => a + b, 0) + done) / (open.length + done)) * 100); },
    value: (_d, x) => { const open = x.input.goals.filter((g) => !g.done).length, done = x.input.goals.filter((g) => g.done).length; return open + done ? `${open} open · ${done} reached` : "Set a goal in Goals"; } },
  { id: "habits", area: "growth", name: "Habits", measures: "The share of your habits done each day.", from: "Habits in LifeHub.",
    why: "Habits form through repetition in a stable context. In a study of people building a new daily habit, it took a median of 66 days to become automatic (ranging from 18 to 254), and missing one day didn't hurt the process.",
    sources: [{ title: "Lally et al., European Journal of Social Psychology, 2010", finding: "New habits took a median of 66 days to become automatic; one missed day didn't matter." }],
    improve: ["Attach each habit to something you already do (\"after I pour coffee, I read one page\").", "Make it tiny at first: 2 minutes counts.", "Never miss twice: one miss is noise, two starts a new pattern."],
    todos: ["Pick one tiny habit to stack on my morning"],
    score: (d, x) => { const v = mean(win(x, d).map((f) => f.habits)); return v === null ? null : clamp(v * 100); },
    value: (d, x) => { const v = mean(win(x, d).map((f) => f.habits)); return v === null ? "Track habits in Habits" : `${Math.round(v * 100)}% of habits done`; } },
  { id: "checklist", area: "growth", name: "Follow-through", measures: "The share of to-dos due each day that got done.", from: "Your to-dos.",
    why: "Finishing what you plan builds self-trust, and small completed tasks feed motivation for bigger ones. Too many to-dos a day is the most common reason this score drops: a shorter list finished beats a long one half-done.",
    sources: [{ title: "Amabile & Kramer, The Progress Principle, 2011", finding: "Making progress on meaningful work was the strongest daily booster of motivation." }],
    improve: ["Give each day 3 must-dos and treat the rest as bonus.", "Move what won't happen today to a real date instead of leaving it overdue.", "Do the hardest one first, before email and messages."],
    todos: ["Pick tomorrow's 3 must-dos"],
    score: (d, x) => { const v = mean(win(x, d).map((f) => f.checklist)); return v === null ? null : clamp(v * 100); },
    value: (d, x) => { const v = mean(win(x, d).map((f) => f.checklist)); return v === null ? "No to-dos due this week" : `${Math.round(v * 100)}% done on time`; } },
  { id: "focus", area: "growth", name: "Deep focus", measures: "Focused minutes a day: 60 scores 100.", from: "Focus in LifeHub.",
    why: "Switching between tasks has a real cost: people are slower and make more errors right after a switch. Protected, single-task blocks get more done in less time and are more satisfying.",
    sources: [{ title: "Rubinstein, Meyer & Evans, Journal of Experimental Psychology, 2001", finding: "Task switching costs time, more so for complex tasks." }],
    improve: ["Block 25 to 50 minutes for one task, phone in another room.", "Close every tab and app that isn't the task.", "Start focus sessions at the same time each day."],
    todos: ["One 50-minute focus block"],
    score: (d, x) => (started(x, d, "focus") ? clamp(((avgOf(x, d, "focus") ?? 0) / 60) * 100) : null),
    value: (d, x) => { const v = mean(win(x, d).map((f) => f.focus ?? 0)); return `${Math.round(v ?? 0)} minutes a day`; } },
  // ——— Money
  { id: "budget", area: "money", name: "Spending", measures: "Spending this month against your budget so far (on or under scores 100).", from: "Budget in LifeHub.",
    why: "Money worries are one of the most common sources of stress. Spending within a plan you chose lowers that stress, and tracking spending is the most reliable first step: people who track spend less on what they don't value.",
    sources: [{ title: "American Psychological Association, Stress in America", finding: "Money is consistently among the top reported sources of stress." }],
    improve: ["Check spending once a week, not once a month: small corrections are easier.", "Name the 3 things you most want money for; cut spending that isn't on the list.", "Automate savings on payday so it never sits in checking.", "Cancel one subscription you haven't used in a month."],
    todos: ["Weekly spending check", "Cancel an unused subscription"],
    score: (d, x) => { const b = x.input.monthlyBudget; if (!(b > 0)) return null; const m = d.slice(0, 7); const spent = x.input.expenses.filter((e) => e.date.startsWith(m) && e.date <= d).reduce((a, e) => a + (Number(e.amount) || 0), 0); if (!x.input.expenses.some((e) => e.date <= d)) return null; const days = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate(); const share = (b * Number(d.slice(8, 10))) / days; return spent <= share ? 100 : clamp(100 - ((spent - share) / share) * 200); },
    value: (d, x) => { const b = x.input.monthlyBudget; const spent = x.input.expenses.filter((e) => e.date.startsWith(d.slice(0, 7)) && e.date <= d).reduce((a, e) => a + (Number(e.amount) || 0), 0); return b > 0 ? `$${fmt(spent)} of $${fmt(b)} this month` : "Set a budget in Budget"; } },
  { id: "cushion", area: "money", name: "Savings cushion", measures: "Months of expenses you have saved: 6 scores 100, 3 scores 80.", from: "Life Score settings.",
    why: "An emergency fund of 3 to 6 months of expenses is the standard advice from the Consumer Financial Protection Bureau and most financial planners. Having savings to fall back on is linked to less financial stress regardless of income.",
    sources: [{ title: "Consumer Financial Protection Bureau", finding: "An emergency fund is a cornerstone of financial well-being." }],
    improve: ["Start with $500 to $1,000, then build to one month of expenses.", "Keep it in a separate high-yield savings account you don't see daily.", "Send part of every raise, refund or bonus to it."],
    todos: ["Open a separate savings account", "Set up an automatic transfer"],
    score: (d, x) => { const c = x.input.data.settings.cushion; if (c === undefined || d !== x.today) return null; return c >= 6 ? 100 : c >= 3 ? clamp(80 + ((c - 3) / 3) * 20) : clamp((c / 3) * 80); },
    value: (_d, x) => { const c = x.input.data.settings.cushion; return c === undefined ? "Add it in settings" : `${c} month${c === 1 ? "" : "s"} saved`; } },
  // ——— Prevention
  { id: "prevention", area: "prevention", name: "Cancer prevention", measures: "How closely the last 7 days followed cancer-prevention guidelines, and whether your screenings are up to date. It scores habits, not your personal risk.", from: "Your check-ins, exercise and Life Score settings (age and screenings).",
    why: "Experts estimate that around 40% of cancers in the US are linked to things people can change: not smoking, limiting alcohol, being active, eating plenty of plants, limiting processed and red meat and sugary drinks, protecting skin from the sun and keeping a healthy weight. Screenings catch some cancers early, or prevent them by removing precancerous growths.",
    sources: [{ title: "Islami et al., CA: A Cancer Journal for Clinicians, 2018 (American Cancer Society)", finding: "About 42% of cancer cases in the US were linked to modifiable risk factors." }, { title: "World Cancer Research Fund / AICR, Cancer Prevention Recommendations", finding: "Be active, eat plants, limit red and processed meat, sugary drinks and alcohol; don't smoke." }, { title: "International Agency for Research on Cancer, 2015", finding: "Processed meat is a Group 1 carcinogen; red meat Group 2A." }, { title: "US Preventive Services Task Force", finding: "Screening ages and intervals for breast, cervical, colorectal and lung cancer." }],
    improve: ["Don't smoke or vape. Quitting at any age lowers risk; free help at 1-800-QUIT-NOW or smokefree.gov.", "Less alcohol is better: alcohol causes at least 7 kinds of cancer, and no amount is risk-free.", "Keep processed meat (bacon, ham, hot dogs, deli meat) rare, and red meat to about 3 portions a week.", "Fill half your plate with vegetables, fruit, whole grains and beans; aim for 25–30 g of fiber a day.", "Swap sugary drinks for water or unsweetened drinks.", "Use SPF 30+ sunscreen and shade between 10 AM and 4 PM; never use tanning beds.", "Keep screenings on schedule; ask your doctor which ones fit your history. This score is not medical advice."],
    todos: ["Book my next screening", "Swap soda for water this week", "Meatless day this week"],
    score: (d, x) => { const p = preventionParts(d, x); const m = mean(p.map((q) => q.score)); return m === null ? null : clamp(m); },
    value: (d, x) => { const p = preventionParts(d, x).filter((q) => q.score !== null); return p.length ? `${p.filter((q) => (q.score ?? 0) >= 80).length} of ${p.length} on track` : "Add a check-in and your age"; } },
];

/** The pieces of the Prevention score, each 0 to 100 (null without data). */
export function preventionParts(d: string, x: Ctx): { id: string; name: string; score: number | null; note: string }[] {
  const w = win(x, d);
  const has = (k: keyof DayFacts) => w.some((f) => f[k] !== undefined);
  const sum = (k: keyof DayFacts) => w.reduce((a, f) => a + ((f[k] as number) ?? 0), 0);
  const sunDays = w.filter((f) => (f.outdoors ?? 0) >= 30 && f.sunscreen !== undefined);
  const screen = d === x.today ? screeningStatus(x.input.data.settings, d) : [];
  const ex = METRICS.find((m) => m.id === "exercise")!.score(d, x);
  const produce = avgOf(x, d, "produce");
  return [
    { id: "tobacco", name: "No tobacco", score: has("smoked") ? (w.some((f) => f.smoked) ? 0 : 100) : null, note: w.some((f) => f.smoked) ? "Smoked this week" : "Smoke-free" },
    { id: "alcohol", name: "Alcohol", score: has("alcohol") ? alcoholScore(sum("alcohol")) : null, note: `${sum("alcohol")} drinks this week` },
    { id: "active", name: "Active 150 min/week", score: ex, note: "From Exercise" },
    { id: "plants", name: "5 servings of plants", score: produce === null ? null : clamp((produce / 5) * 100), note: produce === null ? "" : `${Math.round(produce * 10) / 10} a day` },
    { id: "processed", name: "Little processed meat", score: has("processed") ? (sum("processed") <= 0 ? 100 : sum("processed") <= 1 ? 85 : sum("processed") <= 3 ? 60 : 25) : null, note: `${sum("processed")} servings this week` },
    { id: "red", name: "Red meat ≤ 3 a week", score: has("red") ? (sum("red") <= 3 ? 100 : sum("red") <= 5 ? 70 : 40) : null, note: `${sum("red")} servings this week` },
    { id: "sugary", name: "Few sugary drinks", score: has("sugary") ? (sum("sugary") <= 0 ? 100 : sum("sugary") <= 2 ? 80 : sum("sugary") <= 5 ? 50 : 20) : null, note: `${sum("sugary")} this week` },
    { id: "sun", name: "Sun protection", score: sunDays.length ? clamp((sunDays.filter((f) => f.sunscreen).length / sunDays.length) * 100) : null, note: sunDays.length ? `Protected ${sunDays.filter((f) => f.sunscreen).length} of ${sunDays.length} days outside` : "" },
    { id: "screenings", name: "Screenings up to date", score: screen.length ? clamp((screen.filter((s) => !s.due).length / screen.length) * 100) : null, note: screen.length ? screen.map((s) => `${s.name}: ${s.due ? "due" : "up to date"}`).join(" · ") : "" },
  ];
}

// ——— Putting it together ——————————————————————————————————————————————————————————————————————————————————————
export type MetricResult = { id: MetricId; area: AreaId; name: string; score: number | null; value: string; series: (number | null)[]; change: number | null;
  /** Its to-dos checked off in the last 7 days, and the points they add today. */ todosDone: string[]; todoPoints: number };

// ——— To-dos from Life Score count ——————————————————————————————————————————————————————————————————————————————
/** Each of a measure's own to-dos checked off in the last 7 days adds this much, up to TODO_MAX. */
export const TODO_POINTS = 10;
export const TODO_MAX = 20;
/** A measure with no numbers yet gets a score from its to-dos alone: 60 for one, 70 for two, 80 for three or more. */
export const TODO_START = 60;
const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** The measure's to-dos done in the 7 days up to d (each counted once). */
export function todosDoneFor(m: Pick<MetricDef, "todos">, done: readonly { title: string; date: string }[], d: string): string[] {
  const from = plusDays(d, -6);
  return m.todos.filter((t) => done.some((x) => sameTitle(x.title, t) && x.date >= from && x.date <= d));
}
/** The day's score with its to-dos counted. */
export function withTodos(base: number | null, n: number): number | null {
  if (n <= 0) return base;
  if (base === null) return Math.min(TODO_START + (n - 1) * TODO_POINTS, 80);
  return clamp(base + Math.min(n * TODO_POINTS, TODO_MAX));
}
export type AreaResult = { id: AreaId; name: string; color: string; score: number | null; series: (number | null)[] };
export type Pattern = { text: string; diff: number; days: number };
export type LifeScoreResult = {
  score: number | null; label: string; series: (number | null)[]; dates: string[]; areas: AreaResult[]; metrics: MetricResult[];
  /** The lowest score with data: today's best place to improve. */ focus: MetricResult | null;
  /** Check-ins in a row up to today (or yesterday, before today's). */ streak: number;
  /** The best Life Score in the last 30 days. */ best: number | null;
  patterns: Pattern[];
  /** Today's numbers straight from Apple Health. */ today: DayFacts;
};

export const labelFor = (s: number | null) => (s === null ? "No data yet" : s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 50 ? "Fair" : "Needs care");

export function lifeScore(input: LifeInput, today: string, days = 30): LifeScoreResult {
  const cache = new Map<string, DayFacts>();
  const facts = (d: string) => { let f = cache.get(d); if (!f) { f = factsFor(input, d); cache.set(d, f); } return f; };
  const x: Ctx = { input, facts, today };
  const off = new Set(input.data.settings.off ?? []);
  const dates = lastDays(today, days);
  const done = (input.doneTodos ?? []).filter((t) => t && typeof t.title === "string" && DAY.test(t.date));
  const metrics: MetricResult[] = METRICS.filter((m) => !off.has(m.id)).map((m) => {
    const series = dates.map((d) => withTodos(m.score(d, x), todosDoneFor(m, done, d).length));
    const score = series[series.length - 1];
    const before = series[series.length - 8] ?? null;
    const todosDone = todosDoneFor(m, done, today);
    const base = m.score(today, x);
    const todoPoints = todosDone.length ? (score ?? 0) - (base ?? 0) : 0;
    const value = m.value(today, x);
    return { id: m.id, area: m.area, name: m.name, score, value: todosDone.length && base === null ? `${todosDone.length} to-do${todosDone.length > 1 ? "s" : ""} done this week` : value,
      series, change: score !== null && before !== null ? score - before : null, todosDone, todoPoints };
  });
  const areas: AreaResult[] = AREAS.map((a) => {
    const mine = metrics.filter((m) => m.area === a.id);
    const series = dates.map((_, i) => { const v = mean(mine.map((m) => m.series[i])); return v === null ? null : Math.round(v); });
    return { id: a.id, name: a.name, color: a.color, score: series[series.length - 1], series };
  });
  const series = dates.map((_, i) => { const v = mean(areas.map((a) => a.series[i])); return v === null ? null : Math.round(v); });
  const score = series[series.length - 1];
  const withData = metrics.filter((m) => m.score !== null);
  const focus = withData.length ? [...withData].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0] : null;
  let streak = 0;
  for (let i = input.data.days[today] ? 0 : 1; ; i++) { if (input.data.days[plusDays(today, -i)]) streak++; else break; }
  const best = series.reduce<number | null>((b, v) => (v !== null && (b === null || v > b) ? v : b), null);
  return { score, label: labelFor(score), series, dates, areas, metrics, focus, streak, best, patterns: patterns(input, today, facts), today: facts(today) };
}

// ——— Patterns in their own data (what goes with their better days) —————————————————————————————————————————
const RULES: { when: string; test: (f: DayFacts) => boolean | null; then: "happy" | "energy" | "stress"; }[] = [
  { when: "slept 7 hours or more", test: (f) => (f.sleep === undefined ? null : f.sleep >= 7), then: "happy" },
  { when: "slept 7 hours or more", test: (f) => (f.sleep === undefined ? null : f.sleep >= 7), then: "energy" },
  { when: "exercised 20 minutes or more", test: (f) => (f.exercise === undefined ? null : f.exercise >= 20), then: "happy" },
  { when: "exercised 20 minutes or more", test: (f) => (f.exercise === undefined ? null : f.exercise >= 20), then: "stress" },
  { when: "walked 8,000 steps or more", test: (f) => (f.steps === undefined ? null : f.steps >= 8000), then: "happy" },
  { when: "spent 2 hours or less on screens", test: (f) => (f.screen === undefined ? null : f.screen <= 2), then: "happy" },
  { when: "spent 20 minutes or more outside", test: (f) => (f.outdoors === undefined ? null : f.outdoors >= 20), then: "happy" },
  { when: "had real time with someone", test: (f) => (f.together === undefined ? null : f.together), then: "happy" },
  { when: "prayed, read or worshipped", test: (f) => (f.faith === undefined ? null : f.faith), then: "stress" },
  { when: "had no alcohol", test: (f) => (f.alcohol === undefined ? null : f.alcohol === 0), then: "energy" },
  { when: "meditated", test: (f) => (f.mindful === undefined ? null : f.mindful > 0), then: "stress" },
];
const WORD = { happy: "happiness", energy: "energy", stress: "stress" } as const;
function patterns(input: LifeInput, today: string, facts: (d: string) => DayFacts): Pattern[] {
  const days = lastDays(today, 90).map(facts);
  const out: Pattern[] = [];
  for (const r of RULES) {
    const yes: number[] = [], no: number[] = [];
    for (const f of days) { const t = r.test(f), v = f[r.then]; if (t === null || v === undefined) continue; (t ? yes : no).push(v); }
    if (yes.length < 4 || no.length < 4) continue;
    const diff = Math.round(((mean(yes)! - mean(no)!) * 10)) / 10;
    if (Math.abs(diff) < 0.5) continue;
    const better = r.then === "stress" ? diff < 0 : diff > 0;
    out.push({ diff, days: yes.length + no.length, text: `On days you ${r.when}, your ${WORD[r.then]} was ${Math.abs(diff)} point${Math.abs(diff) === 1 ? "" : "s"} ${diff > 0 ? "higher" : "lower"}${better ? "" : " (not what most people see)"}.` });
  }
  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 6);
}
