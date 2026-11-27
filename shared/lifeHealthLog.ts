// Life Score's health log (client/src/components/family-hub/LifeHealthViews.tsx): symptoms and vitals (blood
// pressure, heart rate, blood sugar, weight, temperature, blood oxygen), each logged as often as wanted, with what's
// worth knowing about them: how often and how bad a symptom is, when it comes, what goes with it, the standard
// category a reading falls in, averages and trends, and the warning signs that need care now. Saved in
// lifeScore.symptoms and lifeScore.vitals (shared/lifeScore.ts cleans them). Pure, so it's tested
// (tests/life-health-log.test.ts). Nothing here is a diagnosis.

// ——— Symptoms ———————————————————————————————————————————————————————————————————————————————————————————————
export type SymptomGroup = "head" | "pain" | "digestive" | "breathing" | "skin" | "sleep" | "mood" | "body" | "women";
export const SYMPTOM_GROUPS: { id: SymptomGroup; name: string }[] = [
  { id: "head", name: "Head and senses" }, { id: "pain", name: "Pain" }, { id: "digestive", name: "Stomach and digestion" },
  { id: "breathing", name: "Breathing, heart and colds" }, { id: "skin", name: "Skin" }, { id: "sleep", name: "Sleep and energy" },
  { id: "mood", name: "Mood and mind" }, { id: "body", name: "Whole body" }, { id: "women", name: "Periods and hormones" },
];
/** Urgent: a warning sign that needs care now. */
export type SymptomDef = { id: string; name: string; group: SymptomGroup; urgent?: string };
const CALL = "Call 911 or get emergency care now.";
export const SYMPTOMS: SymptomDef[] = [
  { id: "headache", name: "Headache", group: "head" }, { id: "migraine", name: "Migraine", group: "head" },
  { id: "dizzy", name: "Dizziness", group: "head" }, { id: "fog", name: "Brain fog", group: "head" },
  { id: "eyes", name: "Eye strain or blurry vision", group: "head" }, { id: "ears", name: "Ringing in the ears", group: "head" },
  { id: "sinus", name: "Sinus pressure", group: "head" },
  { id: "worst-headache", name: "Sudden, severe headache (worst ever)", group: "head", urgent: CALL },
  { id: "stroke", name: "Face drooping, arm weakness or slurred speech", group: "head", urgent: "These can be signs of a stroke. Call 911 now; note the time it started." },
  { id: "back", name: "Back pain", group: "pain" }, { id: "neck", name: "Neck or shoulder pain", group: "pain" },
  { id: "joint", name: "Joint pain", group: "pain" }, { id: "muscle", name: "Muscle aches", group: "pain" },
  { id: "knee", name: "Knee pain", group: "pain" }, { id: "cramps", name: "Muscle cramps", group: "pain" },
  { id: "tooth", name: "Toothache", group: "pain" },
  { id: "nausea", name: "Nausea", group: "digestive" }, { id: "heartburn", name: "Heartburn or reflux", group: "digestive" },
  { id: "bloating", name: "Bloating or gas", group: "digestive" }, { id: "stomach", name: "Stomach pain", group: "digestive" },
  { id: "constipation", name: "Constipation", group: "digestive" }, { id: "diarrhea", name: "Diarrhea", group: "digestive" },
  { id: "appetite", name: "Low appetite", group: "digestive" },
  { id: "blood-gi", name: "Blood in stool or vomit", group: "digestive", urgent: "Get medical care today; call 911 if there's a lot of blood or you feel faint." },
  { id: "cough", name: "Cough", group: "breathing" }, { id: "throat", name: "Sore throat", group: "breathing" },
  { id: "congestion", name: "Stuffy or runny nose", group: "breathing" }, { id: "allergies", name: "Allergies or sneezing", group: "breathing" },
  { id: "wheeze", name: "Wheezing", group: "breathing" }, { id: "palpitations", name: "Racing or pounding heart", group: "breathing" },
  { id: "chest", name: "Chest pain or pressure", group: "breathing", urgent: CALL },
  { id: "breath", name: "Hard to breathe", group: "breathing", urgent: CALL },
  { id: "rash", name: "Rash", group: "skin" }, { id: "itch", name: "Itching", group: "skin" }, { id: "acne", name: "Breakouts", group: "skin" },
  { id: "hives", name: "Hives", group: "skin" }, { id: "dry-skin", name: "Dry skin", group: "skin" },
  { id: "tired", name: "Tiredness", group: "sleep" }, { id: "insomnia", name: "Trouble sleeping", group: "sleep" },
  { id: "low-energy", name: "Low energy", group: "sleep" }, { id: "restless", name: "Restless legs", group: "sleep" },
  { id: "anxious", name: "Anxiety or worry", group: "mood" }, { id: "low-mood", name: "Low mood", group: "mood" },
  { id: "irritable", name: "Irritability", group: "mood" }, { id: "panic", name: "Panic attack", group: "mood" },
  { id: "overwhelm", name: "Feeling overwhelmed", group: "mood" }, { id: "focus", name: "Can't focus", group: "mood" },
  { id: "self-harm", name: "Thoughts of hurting myself", group: "mood", urgent: "You deserve support right now. Call or text 988 (Suicide & Crisis Lifeline, US) any time, or call 911 if you're in danger." },
  { id: "fever", name: "Fever or chills", group: "body" }, { id: "sweats", name: "Night sweats", group: "body" },
  { id: "swelling", name: "Swelling", group: "body" }, { id: "numb", name: "Numbness or tingling", group: "body" },
  { id: "thirst", name: "Very thirsty", group: "body" }, { id: "weak", name: "Weakness", group: "body" },
  { id: "faint", name: "Fainting", group: "body", urgent: "Get medical care today, and call 911 if it comes with chest pain, a racing heart or trouble breathing." },
  { id: "period-pain", name: "Period cramps", group: "women" }, { id: "pms", name: "PMS", group: "women" },
  { id: "hot-flash", name: "Hot flashes", group: "women" }, { id: "spotting", name: "Spotting", group: "women" },
];
export const TRIGGERS = ["Poor sleep", "Stress", "Skipped a meal", "Certain food", "Alcohol", "Caffeine", "Not enough water", "Screens", "Weather", "Hard workout", "Sitting a long time", "Period", "Allergens", "Medicine change", "Travel", "Loud or bright place"];
export const BODY_AREAS = ["Head", "Face", "Neck", "Shoulders", "Chest", "Upper back", "Lower back", "Stomach", "Arms", "Hands", "Hips", "Legs", "Knees", "Feet", "Whole body"];

export type SymptomEntry = {
  id: string;
  /** "YYYY-MM-DDTHH:MM" local time it started. */ at: string;
  /** A SYMPTOMS id, or the person's own name for it. */ symptom: string;
  /** 1 (barely) to 10 (worst). */ severity: number;
  /** How long it lasted, in minutes. */ minutes?: number;
  where?: string; triggers?: string[];
  /** What they took or did for it ("Ibuprofen 200 mg"), and whether it helped. */ relief?: string; helped?: boolean;
  note?: string;
};

// ——— Vitals —————————————————————————————————————————————————————————————————————————————————————————————————
export type VitalKind = "bp" | "hr" | "glucose" | "weight" | "temp" | "spo2";
export const VITALS: Record<VitalKind, { name: string; unit: string; lo: number; hi: number; step: number }> = {
  bp: { name: "Blood pressure", unit: "mmHg", lo: 50, hi: 260, step: 1 },
  hr: { name: "Heart rate", unit: "bpm", lo: 20, hi: 250, step: 1 },
  glucose: { name: "Blood sugar", unit: "mg/dL", lo: 20, hi: 700, step: 1 },
  weight: { name: "Weight", unit: "lb", lo: 20, hi: 1000, step: 0.1 },
  temp: { name: "Temperature", unit: "°F", lo: 85, hi: 110, step: 0.1 },
  spo2: { name: "Blood oxygen", unit: "%", lo: 50, hi: 100, step: 1 },
};
export type VitalContext = "resting" | "morning" | "evening" | "after-exercise" | "fasting" | "after-meal";
export const CONTEXTS: { id: VitalContext; name: string }[] = [
  { id: "resting", name: "Resting" }, { id: "morning", name: "Morning" }, { id: "evening", name: "Evening" },
  { id: "after-exercise", name: "After exercise" }, { id: "fasting", name: "Fasting" }, { id: "after-meal", name: "After a meal" },
];
export type VitalEntry = {
  id: string; at: string; kind: VitalKind;
  /** The reading (bp: systolic). */ value: number;
  /** bp only: diastolic, and pulse if the cuff gave one. */ dia?: number; pulse?: number;
  context?: VitalContext; note?: string;
};

// ——— Cleaning ———————————————————————————————————————————————————————————————————————————————————————————————
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const n = (v: unknown, lo: number, hi: number, step = 1) => {
  const x = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(x)) return undefined;
  return Math.round(Math.round(Math.min(hi, Math.max(lo, x)) / step) * step * 100) / 100;
};
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const KEEP = 3000;

export function cleanSymptoms(raw: unknown): SymptomEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && AT.test(String(e.at)) && str(e.symptom, 60) && n(e.severity, 1, 10) !== undefined).slice(-KEEP).map((e: any): SymptomEntry => compact({
    id: str(e.id, 40) ?? `s${Math.random().toString(36).slice(2, 10)}`, at: String(e.at), symptom: str(e.symptom, 60)!, severity: n(e.severity, 1, 10)!,
    minutes: n(e.minutes, 1, 60 * 24 * 14), where: str(e.where, 40),
    triggers: Array.isArray(e.triggers) ? [...new Set(e.triggers.map((t: unknown) => str(t, 40)).filter(Boolean) as string[])].slice(0, 12) : undefined,
    relief: str(e.relief, 120), helped: typeof e.helped === "boolean" ? e.helped : undefined, note: str(e.note, 500),
  }));
}
export function cleanVitals(raw: unknown): VitalEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && AT.test(String(e.at)) && e.kind in VITALS).slice(-KEEP).flatMap((e: any): VitalEntry[] => {
    const k = e.kind as VitalKind, d = VITALS[k];
    const value = n(e.value, d.lo, d.hi, d.step);
    if (value === undefined) return [];
    return [compact({
      id: str(e.id, 40) ?? `v${Math.random().toString(36).slice(2, 10)}`, at: String(e.at), kind: k, value,
      dia: k === "bp" ? n(e.dia, 30, 180) : undefined, pulse: k === "bp" ? n(e.pulse, 20, 250) : undefined,
      context: CONTEXTS.some((c) => c.id === e.context) ? e.context : undefined, note: str(e.note, 280),
    })];
  });
}

// ——— What a reading means (standard adult categories) —————————————————————————————————————————————————————————
export type Level = "good" | "watch" | "high" | "urgent";
export type Category = { label: string; level: Level; advice: string };
/** American Heart Association / ACC 2017 blood pressure categories. */
export function bpCategory(sys: number, dia: number): Category {
  if (sys > 180 || dia > 120) return { label: "Severe (hypertensive crisis)", level: "urgent", advice: "Wait a few minutes and measure again. If it's still this high, call your doctor now; with chest pain, shortness of breath, back pain, numbness, weakness, vision changes or trouble speaking, call 911." };
  if (sys >= 140 || dia >= 90) return { label: "High: stage 2", level: "high", advice: "Talk with your doctor soon; this usually needs treatment as well as habits." };
  if (sys >= 130 || dia >= 80) return { label: "High: stage 1", level: "high", advice: "Talk with your doctor about it; habits (less salt, more movement, less alcohol, weight) often bring it down." };
  if (sys >= 120) return { label: "Elevated", level: "watch", advice: "Above normal: less salt, more movement and less alcohol help keep it from rising." };
  if (sys < 90 || dia < 60) return { label: "Low", level: "watch", advice: "Low is often fine; talk with a doctor if you feel dizzy or faint." };
  return { label: "Normal", level: "good", advice: "Normal. Keep it up." };
}
export function vitalCategory(e: Pick<VitalEntry, "kind" | "value" | "dia" | "context">): Category {
  const v = e.value;
  switch (e.kind) {
    case "bp": return bpCategory(v, e.dia ?? 0);
    case "hr":
      if (e.context === "after-exercise") return { label: "After exercise", level: "good", advice: "Heart rate is meant to be higher after exercise; resting readings are the ones to compare." };
      if (v > 120) return { label: "Very fast at rest", level: "high", advice: "Rest and measure again. A fast heart rate with chest pain, fainting or shortness of breath needs care now (911)." };
      if (v > 100) return { label: "Fast (over 100)", level: "watch", advice: "Caffeine, stress, fever or dehydration can raise it. If it's often over 100 at rest, talk with your doctor." };
      if (v < 50) return { label: "Slow (under 50)", level: "watch", advice: "Common in fit people. Talk with a doctor if you feel dizzy, faint or short of breath." };
      return { label: "Normal (60 to 100)", level: "good", advice: v <= 70 ? "A lower resting heart rate usually means a fitter heart." : "Normal. Regular exercise tends to lower it over time." };
    case "glucose":
      if (e.context === "after-meal") return v >= 200 ? { label: "High after a meal", level: "high", advice: "Over 200 after a meal is high; talk with your doctor." } : v >= 140 ? { label: "Above target after a meal", level: "watch", advice: "Under 140 two hours after eating is the usual target." } : { label: "In range after a meal", level: "good", advice: "In range." };
      if (v < 70) return { label: "Low (under 70)", level: "urgent", advice: "Eat or drink 15 grams of fast sugar (juice, glucose tablets) and check again in 15 minutes. Get help if you feel confused or faint." };
      if (v >= 126 && e.context === "fasting") return { label: "Diabetes range (fasting 126+)", level: "high", advice: "Talk with your doctor; a lab test confirms it." };
      if (v >= 100 && e.context === "fasting") return { label: "Prediabetes range (fasting 100 to 125)", level: "watch", advice: "Movement, weight loss and fewer sugary drinks can bring it back to normal." };
      if (v >= 200) return { label: "High", level: "high", advice: "Over 200 is high at any time; talk with your doctor." };
      return { label: e.context === "fasting" ? "Normal fasting (under 100)" : "In range", level: "good", advice: "In range." };
    case "temp":
      if (v >= 103) return { label: "High fever", level: "high", advice: "Rest and drink fluids, and call a doctor; get care now with a stiff neck, confusion, a rash or trouble breathing." };
      if (v >= 100.4) return { label: "Fever", level: "watch", advice: "Rest and drink fluids. Call a doctor if it lasts more than 3 days." };
      if (v < 95) return { label: "Very low", level: "urgent", advice: "Below 95 °F can be hypothermia; warm up and get care now." };
      return { label: "Normal", level: "good", advice: "Normal." };
    case "spo2":
      if (v < 90) return { label: "Low (under 90%)", level: "urgent", advice: "Get medical care now, especially if you're short of breath." };
      if (v < 95) return { label: "Below normal (90 to 94%)", level: "watch", advice: "Measure again with warm hands, sitting still. If it stays low or you feel short of breath, call your doctor." };
      return { label: "Normal (95% or more)", level: "good", advice: "Normal." };
    case "weight": return { label: "Logged", level: "good", advice: "Weigh at the same time each day (morning, before eating) to see the real trend." };
  }
}

// ——— Analysis ———————————————————————————————————————————————————————————————————————————————————————————————
const dayOf = (at: string) => at.slice(0, 10);
const plus = (d: string, k: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + k); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
export const symptomName = (id: string) => SYMPTOMS.find((s) => s.id === id)?.name ?? id;
export const symptomDef = (id: string) => SYMPTOMS.find((s) => s.id === id);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const PARTS_OF_DAY = ["Night (12 to 6 AM)", "Morning (6 AM to noon)", "Afternoon (noon to 6 PM)", "Evening (6 PM to midnight)"];
const partOf = (at: string) => Math.floor(Number(at.slice(11, 13)) / 6);

/** A day's facts that symptom days are compared on (from shared/lifeScore.ts factsFor). */
export type CompareFacts = { sleep?: number; stress?: number; alcohol?: number; caffeine?: number; screen?: number; exercise?: number; water?: number; steps?: number };
const COMPARE: { key: keyof CompareFacts; name: string; unit: string; worse: "more" | "less" }[] = [
  { key: "sleep", name: "slept", unit: "hours", worse: "less" }, { key: "stress", name: "stress", unit: "points", worse: "more" },
  { key: "alcohol", name: "alcohol", unit: "drinks", worse: "more" }, { key: "caffeine", name: "caffeine", unit: "cups", worse: "more" },
  { key: "screen", name: "screen time", unit: "hours", worse: "more" }, { key: "exercise", name: "exercise", unit: "minutes", worse: "less" },
  { key: "water", name: "water", unit: "cups", worse: "less" }, { key: "steps", name: "steps", unit: "steps", worse: "less" },
];

export type SymptomStats = {
  symptom: string; name: string; urgent?: string;
  last30: number; last90: number; prev30: number; avgSeverity: number | null; worst: number; avgMinutes: number | null;
  last: string;
  /** Times in each part of the day, and on each weekday (Sunday first). */ byPart: number[]; byWeekday: number[];
  topTriggers: { name: string; times: number }[]; whereMost: string | null;
  /** What helped: the reliefs marked as helping, most first. */ helped: { name: string; times: number }[];
  /** How its days differ from days without it. */ differences: string[];
  /** Days in a row without it, up to today. */ freeStreak: number;
  /** Each of the last 30 days: the worst severity (0: none). */ days: number[];
};

export function symptomStats(entries: SymptomEntry[], symptom: string, today: string, facts?: (d: string) => CompareFacts): SymptomStats {
  const mine = entries.filter((e) => e.symptom === symptom).sort((a, b) => a.at.localeCompare(b.at));
  const since = (k: number) => plus(today, -k + 1);
  const in30 = mine.filter((e) => dayOf(e.at) >= since(30) && dayOf(e.at) <= today);
  const in90 = mine.filter((e) => dayOf(e.at) >= since(90) && dayOf(e.at) <= today);
  const prev30 = mine.filter((e) => dayOf(e.at) >= since(60) && dayOf(e.at) < since(30)).length;
  const byPart = [0, 0, 0, 0], byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const trig = new Map<string, number>(), where = new Map<string, number>(), help = new Map<string, number>();
  for (const e of in90) {
    byPart[partOf(e.at)]++;
    byWeekday[new Date(`${dayOf(e.at)}T12:00:00`).getDay()]++;
    for (const t of e.triggers ?? []) trig.set(t, (trig.get(t) ?? 0) + 1);
    if (e.where) where.set(e.where, (where.get(e.where) ?? 0) + 1);
    if (e.relief && e.helped) help.set(e.relief, (help.get(e.relief) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([name, times]) => ({ name, times }));
  const symDays = new Set(in90.map((e) => dayOf(e.at)));
  const differences: string[] = [];
  if (facts && symDays.size >= 3) {
    const all = Array.from({ length: 90 }, (_, i) => plus(today, -i));
    for (const c of COMPARE) {
      const yes: number[] = [], no: number[] = [];
      for (const d of all) {
        // Sleep and the night before count for the day the symptom showed up.
        const v = facts(d)[c.key];
        if (v === undefined) continue;
        (symDays.has(d) ? yes : no).push(v);
      }
      if (yes.length < 3 || no.length < 3) continue;
      const a = mean(yes)!, b = mean(no)!, diff = a - b;
      const big = c.key === "steps" ? Math.abs(diff) >= 1000 : c.key === "exercise" ? Math.abs(diff) >= 10 : Math.abs(diff) >= (c.key === "sleep" ? 0.5 : 1);
      if (!big) continue;
      const amount = c.key === "steps" ? Math.round(Math.abs(diff)).toLocaleString("en-US") : String(Math.round(Math.abs(diff) * 10) / 10);
      const worse = (c.worse === "more" && diff > 0) || (c.worse === "less" && diff < 0);
      differences.push(c.key === "sleep"
        ? `On days with it you'd slept ${amount} hours ${diff < 0 ? "less" : "more"} the night before${worse ? "" : " (not what most people see)"}.`
        : `On days with it you had ${amount} ${c.unit} ${diff > 0 ? "more" : "less"} ${c.name}${worse ? "" : " (not what most people see)"}.`);
    }
  }
  let freeStreak = 0;
  const has = new Set(mine.map((e) => dayOf(e.at)));
  for (let i = 0; i < 365; i++) { if (has.has(plus(today, -i))) break; freeStreak++; }
  const days = Array.from({ length: 30 }, (_, i) => { const d = plus(today, i - 29); return Math.max(0, ...mine.filter((e) => dayOf(e.at) === d).map((e) => e.severity)); });
  const def = symptomDef(symptom);
  return {
    symptom, name: symptomName(symptom), ...(def?.urgent ? { urgent: def.urgent } : {}),
    last30: in30.length, last90: in90.length, prev30,
    avgSeverity: r1(mean(in90.map((e) => e.severity))), worst: Math.max(0, ...in90.map((e) => e.severity)),
    avgMinutes: (() => { const m = mean(in90.filter((e) => e.minutes).map((e) => e.minutes!)); return m === null ? null : Math.round(m); })(),
    last: mine.length ? mine[mine.length - 1].at : "",
    byPart, byWeekday, topTriggers: top(trig).slice(0, 5), whereMost: top(where)[0]?.name ?? null, helped: top(help).slice(0, 3),
    differences: differences.slice(0, 4), freeStreak, days,
  };
}

/** Plain-words findings for one symptom. */
export function symptomFindings(s: SymptomStats): string[] {
  const out: string[] = [];
  if (!s.last90) return ["Not logged in the last 90 days."];
  out.push(`${s.last30} time${s.last30 === 1 ? "" : "s"} in the last 30 days${s.prev30 || s.last30 ? `, ${s.last30 === s.prev30 ? "the same as" : s.last30 > s.prev30 ? `up from ${s.prev30}` : `down from ${s.prev30}`} the 30 days before` : ""}.`);
  if (s.avgSeverity !== null) out.push(`Average severity ${s.avgSeverity} of 10, worst ${s.worst}.`);
  const part = s.byPart.indexOf(Math.max(...s.byPart));
  if (s.last90 >= 3 && s.byPart[part] / s.last90 >= 0.5) out.push(`Mostly in the ${PARTS_OF_DAY[part].split(" (")[0].toLowerCase()} (${s.byPart[part]} of ${s.last90}).`);
  const wd = s.byWeekday.indexOf(Math.max(...s.byWeekday));
  if (s.last90 >= 5 && s.byWeekday[wd] / s.last90 >= 0.3) out.push(`Most often on ${WEEKDAYS[wd]}s.`);
  if (s.topTriggers[0]) out.push(`Top trigger you noted: ${s.topTriggers[0].name.toLowerCase()} (${s.topTriggers[0].times} time${s.topTriggers[0].times === 1 ? "" : "s"}).`);
  if (s.helped[0]) out.push(`What helped most: ${s.helped[0].name}.`);
  out.push(...s.differences);
  if (s.freeStreak >= 2) out.push(`${s.freeStreak} days without it.`);
  if (s.last30 >= 8 || (s.avgSeverity ?? 0) >= 7) out.push("This is frequent or strong: worth bringing your log to your doctor.");
  return out;
}

/** Each symptom logged in the last 90 days, most frequent first. */
export function symptomList(entries: SymptomEntry[], today: string): { symptom: string; name: string; last30: number; avg: number; last: string }[] {
  const from = plus(today, -89);
  const by = new Map<string, SymptomEntry[]>();
  for (const e of entries) if (dayOf(e.at) >= from && dayOf(e.at) <= today) by.set(e.symptom, [...(by.get(e.symptom) ?? []), e]);
  const from30 = plus(today, -29);
  return [...by].map(([symptom, es]) => ({ symptom, name: symptomName(symptom), last30: es.filter((e) => dayOf(e.at) >= from30).length, avg: r1(mean(es.map((e) => e.severity)))!, last: es.map((e) => e.at).sort().pop()! }))
    .sort((a, b) => b.last30 - a.last30 || b.last.localeCompare(a.last));
}

/** A day's symptom burden: the worst severity and how many logged. */
export function symptomDay(entries: SymptomEntry[], d: string): { worst: number; count: number } | undefined {
  const es = entries.filter((e) => dayOf(e.at) === d);
  return es.length ? { worst: Math.max(...es.map((e) => e.severity)), count: es.length } : undefined;
}

export type VitalStats = {
  kind: VitalKind; name: string; unit: string; count30: number;
  latest: VitalEntry | null; latestCategory: Category | null;
  avg7: number | null; avg30: number | null; prev30: number | null; min30: number | null; max30: number | null;
  /** bp: the bottom number's averages. */ dia7?: number | null; dia30?: number | null;
  /** bp and hr: morning vs evening averages over 30 days. */ morning?: number | null; evening?: number | null;
  /** Share of the last 30 days' readings in each level. */ levels: Record<Level, number>;
  /** Each of the last 30 days' average (null: none). */ days: (number | null)[];
  findings: string[];
};
export function vitalStats(entries: VitalEntry[], kind: VitalKind, today: string): VitalStats {
  const mine = entries.filter((e) => e.kind === kind).sort((a, b) => a.at.localeCompare(b.at));
  const since = (k: number) => plus(today, -k + 1);
  const range = (from: string, to: string) => mine.filter((e) => dayOf(e.at) >= from && dayOf(e.at) <= to);
  const r30 = range(since(30), today), r7 = range(since(7), today), p30 = range(since(60), plus(since(30), -1));
  const avg = (es: VitalEntry[], f: (e: VitalEntry) => number | undefined = (e) => e.value) => r1(mean(es.map(f).filter((v): v is number => v !== undefined)));
  const latest = mine[mine.length - 1] ?? null;
  const levels: Record<Level, number> = { good: 0, watch: 0, high: 0, urgent: 0 };
  for (const e of r30) levels[vitalCategory(e).level]++;
  const hour = (e: VitalEntry) => Number(e.at.slice(11, 13));
  const isMorning = (e: VitalEntry) => e.context === "morning" || (e.context !== "evening" && hour(e) >= 4 && hour(e) < 12);
  const isEvening = (e: VitalEntry) => e.context === "evening" || (e.context !== "morning" && hour(e) >= 17);
  const days = Array.from({ length: 30 }, (_, i) => { const d = plus(today, i - 29); return avg(mine.filter((e) => dayOf(e.at) === d)); });
  const d = VITALS[kind];
  const s: VitalStats = {
    kind, name: d.name, unit: d.unit, count30: r30.length, latest, latestCategory: latest ? vitalCategory(latest) : null,
    avg7: avg(r7), avg30: avg(r30), prev30: avg(p30), min30: r30.length ? Math.min(...r30.map((e) => e.value)) : null, max30: r30.length ? Math.max(...r30.map((e) => e.value)) : null,
    levels, days, findings: [],
  };
  if (kind === "bp") { s.dia7 = avg(r7, (e) => e.dia); s.dia30 = avg(r30, (e) => e.dia); }
  if (kind === "bp" || kind === "hr") { s.morning = avg(r30.filter(isMorning)); s.evening = avg(r30.filter(isEvening)); }
  // Findings in plain words.
  const f = s.findings, fmt = (v: number) => (kind === "weight" || kind === "temp" ? String(r1(v)) : String(Math.round(v)));
  if (!r30.length) f.push(latest ? `No readings in the last 30 days; the last was ${latest.at.slice(0, 10)}.` : "No readings yet.");
  else {
    if (kind === "bp" && s.avg30 !== null && s.dia30 !== null && s.dia30 !== undefined) f.push(`30-day average ${Math.round(s.avg30)}/${Math.round(s.dia30)}: ${bpCategory(s.avg30, s.dia30).label.toLowerCase()}. Averages matter more than any one reading.`);
    else if (s.avg30 !== null) f.push(`30-day average ${fmt(s.avg30)} ${d.unit}, from ${fmt(s.min30!)} to ${fmt(s.max30!)}.`);
    if (s.avg30 !== null && s.prev30 !== null) { const diff = s.avg30 - s.prev30; if (Math.abs(diff) >= (kind === "temp" ? 0.5 : kind === "weight" ? 1 : 3)) f.push(`${diff > 0 ? "Up" : "Down"} ${fmt(Math.abs(diff))} ${d.unit} from the 30 days before.`); }
    if ((kind === "bp" || kind === "hr") && s.morning && s.evening && Math.abs(s.morning - s.evening) >= 5) f.push(`Mornings average ${Math.round(s.morning)}, evenings ${Math.round(s.evening)}.`);
    const flagged = levels.high + levels.urgent;
    if (flagged) f.push(`${flagged} of ${r30.length} readings were high or urgent.`);
    if (kind === "bp" && r30.length < 7) f.push("For a true picture, measure twice a morning and twice an evening for a week (seated, after 5 quiet minutes).");
  }
  return s;
}

/** The day's average blood pressure, resting heart rate and other readings from the vitals log. */
export function vitalsDay(entries: VitalEntry[], d: string): { sys?: number; dia?: number; hr?: number; glucose?: number; weight?: number; spo2?: number; temp?: number } {
  const es = entries.filter((e) => dayOf(e.at) === d);
  if (!es.length) return {};
  const avgOf = (k: VitalKind, f: (e: VitalEntry) => number | undefined = (e) => e.value) => { const v = mean(es.filter((e) => e.kind === k).map(f).filter((x): x is number => x !== undefined)); return v === null ? undefined : Math.round(v * 10) / 10; };
  const restHr = mean(es.filter((e) => e.kind === "hr" && e.context !== "after-exercise").map((e) => e.value));
  return compact({ sys: avgOf("bp"), dia: avgOf("bp", (e) => e.dia), hr: restHr === null ? undefined : Math.round(restHr), glucose: avgOf("glucose"), weight: avgOf("weight"), spo2: avgOf("spo2"), temp: avgOf("temp") });
}
