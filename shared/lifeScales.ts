// Life Score's validated measures (shared/lifeScore.ts keeps the answers): short questionnaires used in research
// and clinics, and published health scores worked out from labs and habits. Pure, so it's tested
// (tests/life-stats.test.ts). These are screens and estimates for the person's own tracking, never a diagnosis.

export type ScaleId = "who5" | "phq2" | "gad2" | "ucla3" | "pss4" | "ladder";
export type ScaleDef = {
  id: ScaleId; name: string; about: string; every: "week" | "month"; window: string;
  questions: string[]; choices: { label: string; value: number }[];
  /** Questions scored backwards (0-based). */ reverse?: number[];
  /** The total and what it means. */ read: (total: number) => { score: number; label: string; tone: "good" | "ok" | "watch" | "alert"; note: string };
  max: number; source: string;
};

export const SCALES: ScaleDef[] = [
  { id: "who5", name: "Well-being (WHO-5)", every: "week", window: "Over the last two weeks…", max: 100,
    about: "The World Health Organization's five-question well-being index, one of the most widely used measures of mental well-being in the world.",
    source: "Topp et al., Psychotherapy and Psychosomatics, 2015 (systematic review of the WHO-5)",
    questions: ["I have felt cheerful and in good spirits", "I have felt calm and relaxed", "I have felt active and vigorous", "I woke up feeling fresh and rested", "My daily life has been filled with things that interest me"],
    choices: [{ label: "At no time", value: 0 }, { label: "Some of the time", value: 1 }, { label: "Less than half the time", value: 2 }, { label: "More than half the time", value: 3 }, { label: "Most of the time", value: 4 }, { label: "All of the time", value: 5 }],
    read: (t) => { const s = t * 4; return s > 50 ? { score: s, label: "Good well-being", tone: "good", note: "Above 50 is healthy well-being." } : s > 28 ? { score: s, label: "Low well-being", tone: "watch", note: "50 or below suggests low well-being. Watch the trend, and look at sleep, people and movement." } : { score: s, label: "Very low well-being", tone: "alert", note: "28 or below is a common cut-off for further depression screening. Please talk with a doctor or counselor." }; } },
  { id: "phq2", name: "Mood screen (PHQ-2)", every: "week", window: "Over the last two weeks, how often have you been bothered by…", max: 6,
    about: "The first two questions of the Patient Health Questionnaire, used by doctors as a quick depression screen.",
    source: "Kroenke, Spitzer & Williams, Medical Care, 2003",
    questions: ["Little interest or pleasure in doing things", "Feeling down, depressed, or hopeless"],
    choices: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }],
    read: (t) => (t >= 3 ? { score: t, label: "Worth talking to someone", tone: "alert", note: "3 or more is a positive screen: not a diagnosis, but a reason to talk with a doctor or counselor. If you're struggling right now, call or text 988 (US)." } : { score: t, label: "No sign of depression", tone: "good", note: "Under 3 is a negative screen." }) },
  { id: "gad2", name: "Anxiety screen (GAD-2)", every: "week", window: "Over the last two weeks, how often have you been bothered by…", max: 6,
    about: "The first two questions of the Generalized Anxiety Disorder scale, a quick anxiety screen used in clinics.",
    source: "Kroenke et al., Annals of Internal Medicine, 2007",
    questions: ["Feeling nervous, anxious, or on edge", "Not being able to stop or control worrying"],
    choices: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }],
    read: (t) => (t >= 3 ? { score: t, label: "Worth talking to someone", tone: "alert", note: "3 or more is a positive screen for anxiety: a reason to talk with a doctor or counselor, not a diagnosis." } : { score: t, label: "Low anxiety", tone: "good", note: "Under 3 is a negative screen." }) },
  { id: "ucla3", name: "Loneliness (UCLA 3-item)", every: "month", window: "How often do you feel…", max: 9,
    about: "The short UCLA Loneliness Scale used in large population studies, including the US Health and Retirement Study.",
    source: "Hughes et al., Research on Aging, 2004",
    questions: ["That you lack companionship?", "Left out?", "Isolated from others?"],
    choices: [{ label: "Hardly ever", value: 1 }, { label: "Some of the time", value: 2 }, { label: "Often", value: 3 }],
    read: (t) => (t >= 6 ? { score: t, label: "Lonely", tone: "watch", note: "6 to 9 is commonly counted as lonely. Loneliness is linked to health risks on par with smoking; reaching out is the fix that works." } : { score: t, label: "Not lonely", tone: "good", note: "3 to 5 is not lonely." }) },
  { id: "pss4", name: "Stress (PSS-4)", every: "month", window: "In the last month, how often have you felt…", max: 16,
    about: "The four-question Perceived Stress Scale, the most widely used measure of how stressful life feels.",
    source: "Cohen, Kamarck & Mermelstein, Journal of Health and Social Behavior, 1983",
    questions: ["That you were unable to control the important things in your life?", "Confident about your ability to handle your personal problems?", "That things were going your way?", "That difficulties were piling up so high that you could not overcome them?"],
    reverse: [1, 2],
    choices: [{ label: "Never", value: 0 }, { label: "Almost never", value: 1 }, { label: "Sometimes", value: 2 }, { label: "Fairly often", value: 3 }, { label: "Very often", value: 4 }],
    read: (t) => (t >= 10 ? { score: t, label: "High stress", tone: "watch", note: "Higher scores mean more perceived stress. Sleep, exercise, slow breathing and talking it through all bring it down." } : t >= 6 ? { score: t, label: "Moderate stress", tone: "ok", note: "A typical range for busy adults." } : { score: t, label: "Low stress", tone: "good", note: "Life feels mostly manageable." }) },
  { id: "ladder", name: "Life satisfaction (Cantril Ladder)", every: "month", window: "Imagine a ladder from 0 at the bottom to 10 at the top…", max: 10,
    about: "Gallup's Cantril Ladder, the question behind the World Happiness Report: 0 is the worst possible life for you, 10 the best.",
    source: "Gallup World Poll; World Happiness Report",
    questions: ["On which step do you feel you stand right now?", "On which step do you think you'll stand about five years from now?"],
    choices: Array.from({ length: 11 }, (_, i) => ({ label: String(i), value: i })),
    read: (t) => { const now = t; return now >= 7 ? { score: now, label: "Thriving", tone: "good", note: "Gallup counts 7 now (and 8 in five years) as thriving." } : now >= 5 ? { score: now, label: "Struggling", tone: "ok", note: "Gallup's middle group: life is okay but uncertain." } : { score: now, label: "Suffering", tone: "watch", note: "4 or below: Gallup's suffering group. Small, steady changes add up; talk with someone you trust." }; } },
];

export type Assessment = { date: string; answers: number[] };

/** A questionnaire's total and reading. The ladder reads only today's step (the first answer). */
export function scoreScale(id: ScaleId, answers: number[]) {
  const def = SCALES.find((s) => s.id === id)!;
  const top = Math.max(...def.choices.map((c) => c.value)), bottom = Math.min(...def.choices.map((c) => c.value));
  const vals = def.questions.map((_, i) => { const a = answers[i]; if (a === undefined) return 0; return def.reverse?.includes(i) ? top + bottom - a : a; });
  const total = id === "ladder" ? (answers[0] ?? 0) : vals.reduce((a, b) => a + b, 0);
  return { total, ...def.read(total), max: def.max };
}

// ——— Labs and vitals —————————————————————————————————————————————————————————————————————————————————————————
export type Labs = {
  date: string;
  /** mmHg. */ sys?: number; dia?: number; bpMeds?: boolean;
  /** mg/dL. */ total?: number; hdl?: number; ldl?: number; trig?: number; lipidMeds?: boolean;
  /** % and mg/dL. */ a1c?: number; glucose?: number; diabetes?: boolean;
  /** Inches. */ waist?: number;
};

/** Life's Essential 8 (American Heart Association, Lloyd-Jones et al., Circulation 2022): each part 0–100, the
 *  score is their average. Diet here is an approximation from the check-in (the AHA uses a diet questionnaire). */
export type Le8Input = {
  dietApprox?: number; activityMin?: number;
  nicotine?: "never" | "quit5" | "quit1" | "quitRecent" | "current"; secondhand?: boolean;
  sleepH?: number; bmi?: number; nonHdl?: number; lipidMeds?: boolean;
  a1c?: number; glucose?: number; diabetes?: boolean; sys?: number; dia?: number; bpMeds?: boolean;
};
export function le8(x: Le8Input): { score: number | null; parts: { id: string; name: string; score: number | null; note: string }[] } {
  const pa = x.activityMin === undefined ? null : x.activityMin >= 150 ? 100 : x.activityMin >= 120 ? 90 : x.activityMin >= 90 ? 80 : x.activityMin >= 60 ? 60 : x.activityMin >= 30 ? 40 : x.activityMin >= 1 ? 20 : 0;
  const nic = x.nicotine === undefined ? null : Math.max(0, ({ never: 100, quit5: 75, quit1: 50, quitRecent: 25, current: 0 }[x.nicotine]) - (x.secondhand && x.nicotine !== "current" ? 20 : 0));
  const sl = x.sleepH === undefined ? null : x.sleepH >= 7 && x.sleepH < 9 ? 100 : x.sleepH >= 9 && x.sleepH < 10 ? 90 : x.sleepH >= 6 && x.sleepH < 7 ? 70 : (x.sleepH >= 5 && x.sleepH < 6) || x.sleepH >= 10 ? 40 : x.sleepH >= 4 ? 20 : 0;
  const bmi = x.bmi === undefined ? null : x.bmi < 25 ? 100 : x.bmi < 30 ? 70 : x.bmi < 35 ? 30 : x.bmi < 40 ? 15 : 0;
  const lip = x.nonHdl === undefined ? null : Math.max(0, (x.nonHdl < 130 ? 100 : x.nonHdl < 160 ? 60 : x.nonHdl < 190 ? 40 : x.nonHdl < 220 ? 20 : 0) - (x.lipidMeds ? 20 : 0));
  let glu: number | null = null;
  if (x.diabetes) glu = x.a1c === undefined ? null : x.a1c < 7 ? 40 : x.a1c < 8 ? 30 : x.a1c < 9 ? 20 : x.a1c < 10 ? 10 : 0;
  else if (x.a1c !== undefined) glu = x.a1c < 5.7 ? 100 : x.a1c < 6.5 ? 60 : 40;
  else if (x.glucose !== undefined) glu = x.glucose < 100 ? 100 : x.glucose < 126 ? 60 : 40;
  let bp: number | null = null;
  if (x.sys !== undefined && x.dia !== undefined) {
    const s = x.sys, d = x.dia;
    bp = s >= 160 || d >= 100 ? 0 : s >= 140 || d >= 90 ? 25 : s >= 130 || d >= 80 ? 50 : s >= 120 ? 75 : 100;
    if (x.bpMeds) bp = Math.max(0, bp - 20);
  }
  const parts = [
    { id: "diet", name: "Diet", score: x.dietApprox ?? null, note: "Approximated from fruit, vegetables, processed meat and sugary drinks in your check-ins" },
    { id: "activity", name: "Physical activity", score: pa, note: x.activityMin === undefined ? "" : `${Math.round(x.activityMin)} min a week` },
    { id: "nicotine", name: "Nicotine exposure", score: nic, note: "" },
    { id: "sleep", name: "Sleep", score: sl, note: x.sleepH === undefined ? "" : `${Math.round(x.sleepH * 10) / 10} h a night` },
    { id: "bmi", name: "Body mass index", score: bmi, note: x.bmi === undefined ? "Needs height and weight" : `BMI ${Math.round(x.bmi * 10) / 10}` },
    { id: "lipids", name: "Blood lipids", score: lip, note: x.nonHdl === undefined ? "Add total and HDL cholesterol in Labs" : `Non-HDL ${Math.round(x.nonHdl)} mg/dL` },
    { id: "glucose", name: "Blood sugar", score: glu, note: x.a1c === undefined && x.glucose === undefined ? "Add A1c or fasting glucose in Labs" : x.a1c !== undefined ? `A1c ${x.a1c}%` : `Fasting ${x.glucose} mg/dL` },
    { id: "bp", name: "Blood pressure", score: bp, note: x.sys === undefined ? "Add a blood pressure reading in Labs" : `${x.sys}/${x.dia} mmHg` },
  ];
  const have = parts.filter((p) => p.score !== null);
  return { score: have.length >= 4 ? Math.round(have.reduce((a, p) => a + (p.score ?? 0), 0) / have.length) : null, parts };
}

/** The American Diabetes Association's Type 2 diabetes risk test (Bang et al., Annals of Internal Medicine, 2009):
 *  5 or more points is high risk. BMI stands in for the test's weight chart. */
export function adaRisk(x: { age?: number; sex?: "female" | "male"; gestational?: boolean; family?: boolean; highBp?: boolean; active?: boolean; bmi?: number }): { points: number; high: boolean; parts: string[] } | null {
  if (!x.age || !x.sex || x.bmi === undefined || x.active === undefined) return null;
  const parts: string[] = [];
  let p = 0;
  const add = (n: number, why: string) => { if (n) { p += n; parts.push(`${why} +${n}`); } };
  add(x.age >= 60 ? 3 : x.age >= 50 ? 2 : x.age >= 40 ? 1 : 0, "Age");
  add(x.sex === "male" ? 1 : 0, "Male");
  add(x.sex === "female" && x.gestational ? 1 : 0, "Gestational diabetes");
  add(x.family ? 1 : 0, "Parent or sibling with diabetes");
  add(x.highBp ? 1 : 0, "High blood pressure");
  add(x.active ? 0 : 1, "Not physically active");
  add(x.bmi >= 40 ? 3 : x.bmi >= 30 ? 2 : x.bmi >= 25 ? 1 : 0, "Weight");
  return { points: p, high: p >= 5, parts };
}

/** VO2 max norms (ml/kg/min) by age and sex: the 50th percentile and rough cut-offs, from the FRIEND registry
 *  (Kaminsky et al., Mayo Clinic Proceedings, 2015). Returns a percentile band and a "fitness age". */
const VO2_50: Record<"female" | "male", [number, number][]> = {
  male: [[25, 48.0], [35, 42.4], [45, 37.8], [55, 32.6], [65, 28.2], [75, 24.4]],
  female: [[25, 37.6], [35, 30.9], [45, 27.6], [55, 23.8], [65, 20.8], [75, 18.3]],
};
export function vo2Read(vo2: number, age: number, sex: "female" | "male") {
  const table = VO2_50[sex];
  // The 50th percentile at this age (straight line between decades).
  const at = (a: number) => { if (a <= table[0][0]) return table[0][1]; for (let i = 1; i < table.length; i++) if (a <= table[i][0]) { const [a0, v0] = table[i - 1], [a1, v1] = table[i]; return v0 + ((a - a0) / (a1 - a0)) * (v1 - v0); } return table[table.length - 1][1]; };
  const median = at(age);
  const ratio = vo2 / median;
  const band = ratio >= 1.25 ? "Superior (top 10%)" : ratio >= 1.1 ? "Excellent (top 25%)" : ratio >= 0.95 ? "Good (about average)" : ratio >= 0.8 ? "Fair (below average)" : "Poor (bottom 25%)";
  // Fitness age: the age whose median matches this VO2 max.
  let fitAge = age;
  for (let a = 20; a <= 90; a++) { if (at(a) <= vo2) { fitAge = a; break; } fitAge = a; }
  return { median: Math.round(median * 10) / 10, band, fitAge: Math.max(20, Math.min(90, fitAge)) };
}
