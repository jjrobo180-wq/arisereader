// Arise WorkHub IEP Writer. A teacher starts with the student's name and basic info, then works
// through steps of drop boxes. What they pick changes what later steps offer (areas of need follow
// the disability, goals and objectives follow the area, accommodations and services follow the
// needs, transition only shows for grade 9+ or age 15+). From the picks it writes the full IEP in
// the order of the school's IEP template, and checks it against the IEP Quality Rubric (Parts 1-6).
//
// The page is client/src/components/teacher-hub/HubIepWriter.tsx. Drafts live in workspace.iepDrafts.
import {
  ACCOMMODATIONS, AGENCIES, CMAS_LEVELS, COURSES_9_12, DATA_SOURCES, DISABILITIES, GOAL_STATUS, INTERESTS, INTERVENTIONS, IREADY_MATH, IREADY_READING,
  LEARNS_BEST, MEASURE_FREQ, NEED_AREAS, PARENT_CONCERNS, POST_ED, POST_JOB, SLD_AREAS, STRENGTHS, TRANSITION_ACTIVITIES, TRANSITION_ASSESSMENTS,
  accById, bandOf, disabilityTag, needById, serviceById, suggestedAreas,
} from "./catalog";

export * from "./catalog";

export type IepNeed = {
  id: string; area: string; goal: string; condition: string; baseline: string; target: string;
  method: string; freq: string; obj1: string; obj2: string; minutes: string; where: "" | "gen" | "sped";
};
export type PriorGoal = { id: string; area: string; status: string; data: string };
export type IepDraft = {
  id: string; student: string; meetingId?: string; createdAt: string; updatedAt: string;
  /** One-answer drop boxes and typed boxes. */
  a: Record<string, string>;
  /** Pick-several drop boxes. */
  m: Record<string, string[]>;
  needs: IepNeed[];
  prior: PriorGoal[];
};

export const IEP_LIMITS = { drafts: 40, needs: 8, prior: 8, text: 1500 } as const;

// ───────────────────────── small helpers
export const gradeNum = (d: IepDraft) => { const g = (d.a.grade || "").trim(); return /^k/i.test(g) ? 0 : Number.parseInt(g, 10) || 0; };
export const ageNum = (d: IepDraft) => Number.parseInt(d.a.age || "", 10) || 0;
export const isInitial = (d: IepDraft) => d.a.type === "Initial IEP";
/** Colorado plans transition no later than 9th grade or age 15. */
export const isTransition = (d: IepDraft) => gradeNum(d) >= 9 || ageNum(d) >= 15;
export const first = (d: IepDraft) => (d.a.name || d.student || "The student").trim().split(/\s+/)[0];
const yes = (v?: string) => v === "Yes";
const filled = (v?: string) => !!(v && v.trim());
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const many = (d: IepDraft, k: string) => (Array.isArray(d.m[k]) ? d.m[k] : []);

type Pro = { sub: string; obj: string; pos: string; be: string; has: string };
export function pronouns(d: IepDraft): Pro {
  if (d.a.pronouns === "she/her") return { sub: "she", obj: "her", pos: "her", be: "is", has: "has" };
  if (d.a.pronouns === "they/them") return { sub: "they", obj: "them", pos: "their", be: "are", has: "have" };
  return { sub: "he", obj: "him", pos: "his", be: "is", has: "has" };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A date a number of days/years after an ISO date, as "October 1, 2027". */
function shift(iso: string, years: number, days = 0): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const [y, m, dd] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y + years, m - 1, dd + days));
  return t.toISOString().slice(0, 10);
}
export const longDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "____");
export const goalEnd = (d: IepDraft) => shift(d.a.meetingDate, 1, -1);
const midYear = (d: IepDraft) => shift(d.a.meetingDate, 0, 182);

/** Fill a catalog phrase for this student. */
function fill(text: string, d: IepDraft): string {
  const p = pronouns(d);
  return text.replace(/\{name\}/g, first(d)).replace(/his or her/g, p.pos).replace(/\bthey\b(?= (lead|explain|request))/g, p.sub);
}

/** "with 80% accuracy", "in 80% of opportunities", "at 110 words correct per minute", "with a score of 3 rubric points out of 4". */
export function measure(target: string, unit: string): string {
  const t = filled(target) ? target.trim() : "____";
  if (unit.startsWith("% of")) return `in ${t}${unit}`;
  if (unit.startsWith("%")) return `with ${t}${unit}`;
  if (unit.startsWith("rubric") || unit === "points") return `with a score of ${t} ${unit}`;
  return `at ${t} ${unit}`;
}
const isPercent = (unit: string) => unit.startsWith("%");

// ───────────────────────── a fresh draft
export function newIepDraft(student: string, makeId: () => string, from: Partial<Record<string, string>> = {}): IepDraft {
  const now = new Date().toISOString();
  const name = student.replace(/\s+/g, " ").trim();
  return {
    id: makeId(), student: name, createdAt: now, updatedAt: now,
    a: { name, type: "Annual IEP", pronouns: "he/him", language: "English", city: "Denver, CO", weekMinutes: "2100", reportFreq: "each grading period (with report cards)", reportMethod: "a written IEP progress report sent home and shared in Enrich", ...Object.fromEntries(Object.entries(from).filter(([, v]) => typeof v === "string" && v)) as Record<string, string> },
    m: {}, needs: [], prior: [],
  };
}

export function newNeed(area: string, makeId: () => string): IepNeed {
  const n = needById(area);
  return { id: makeId(), area, goal: n?.goals[0]?.id || "", condition: n?.conditions[0] || "", baseline: "", target: "", method: n?.methods[0] || "", freq: "every two weeks",
    obj1: n?.objectives[0]?.id || "", obj2: n?.objectives[1]?.id || "", minutes: "", where: "" };
}

/** A saved draft made safe: strings stay strings, lists stay lists, sizes stay small. */
export function cleanIepDrafts(raw: unknown): IepDraft[] {
  if (!Array.isArray(raw)) return [];
  const s = (v: unknown, n: number = IEP_LIMITS.text) => (typeof v === "string" ? v.slice(0, n) : "");
  const rec = (v: any) => Object.fromEntries(Object.entries(v && typeof v === "object" && !Array.isArray(v) ? v : {}).filter(([k, x]) => typeof x === "string" && k.length < 40).map(([k, x]) => [k, (x as string).slice(0, IEP_LIMITS.text)]));
  const recs = (v: any) => Object.fromEntries(Object.entries(v && typeof v === "object" && !Array.isArray(v) ? v : {}).filter(([k, x]) => Array.isArray(x) && k.length < 40).map(([k, x]) => [k, (x as unknown[]).filter((y) => typeof y === "string").map((y) => (y as string).slice(0, 300)).slice(0, 40)]));
  return raw.filter((d: any) => d && typeof d === "object" && typeof d.id === "string" && d.id).slice(0, IEP_LIMITS.drafts).map((d: any): IepDraft => ({
    id: s(d.id, 60), student: s(d.student, 80), ...(typeof d.meetingId === "string" ? { meetingId: d.meetingId.slice(0, 60) } : {}),
    createdAt: s(d.createdAt, 40), updatedAt: s(d.updatedAt, 40), a: rec(d.a), m: recs(d.m),
    needs: (Array.isArray(d.needs) ? d.needs : []).filter((n: any) => n && typeof n.id === "string").slice(0, IEP_LIMITS.needs).map((n: any): IepNeed => ({
      id: s(n.id, 60), area: s(n.area, 40), goal: s(n.goal, 40), condition: s(n.condition, 300), baseline: s(n.baseline, 40), target: s(n.target, 40),
      method: s(n.method, 200), freq: s(n.freq, 40), obj1: s(n.obj1, 40), obj2: s(n.obj2, 40), minutes: s(n.minutes, 10), where: n.where === "gen" || n.where === "sped" ? n.where : "" })),
    prior: (Array.isArray(d.prior) ? d.prior : []).filter((p: any) => p && typeof p.id === "string").slice(0, IEP_LIMITS.prior).map((p: any): PriorGoal => ({ id: s(p.id, 60), area: s(p.area, 80), status: s(p.status, 60), data: s(p.data, 400) })),
  }));
}

// ───────────────────────── the drop boxes, step by step
export type FieldKind = "select" | "multi" | "text" | "long" | "number" | "date" | "yesno";
export type IepField = {
  id: string; label: string; kind: FieldKind; options?: string[] | ((d: IepDraft) => string[]);
  show?: (d: IepDraft) => boolean; help?: string; placeholder?: string;
};
export type IepStep = { id: string; title: string; part: string; intro: string; fields: IepField[]; custom?: "needs" | "prior"; show?: (d: IepDraft) => boolean };

const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const AGES = Array.from({ length: 18 }, (_, i) => String(i + 4));
const YN = ["Yes", "No"];
const sourcesHas = (s: string) => (d: IepDraft) => many(d, "sources").includes(s);

export const IEP_STEPS: IepStep[] = [
  { id: "student", title: "Student info", part: "Part 0 & Part 1", intro: "Start here. Everything after this adjusts to the student: grade, disabilities, language and IEP type.",
    fields: [
      { id: "name", label: "Student's full name", kind: "text" },
      { id: "pronouns", label: "Pronouns used in the IEP", kind: "select", options: ["he/him", "she/her", "they/them"] },
      { id: "age", label: "Age", kind: "select", options: AGES },
      { id: "grade", label: "Grade", kind: "select", options: GRADES },
      { id: "school", label: "School / campus", kind: "text", placeholder: "e.g. DSST: Cole Middle School" },
      { id: "city", label: "City", kind: "select", options: ["Denver, CO", "Aurora, CO"] },
      { id: "language", label: "Primary language", kind: "select", options: ["English", "Spanish", "Arabic", "Vietnamese", "Amharic", "Somali", "Nepali", "French", "Russian", "Other"] },
      { id: "type", label: "Kind of IEP", kind: "select", options: ["Annual IEP", "Initial IEP", "Triennial (after re-evaluation)"] },
      { id: "meetingDate", label: "IEP meeting date", kind: "date" },
      { id: "prevIep", label: "Date of last year's IEP", kind: "date", show: (d) => !isInitial(d) },
      { id: "caseManager", label: "Case manager", kind: "text" },
    ] },
  { id: "eligibility", title: "Evaluation & eligibility", part: "Part 1 (required)", intro: "The most recent evaluation, the disabilities found and how the student was referred.",
    fields: [
      { id: "evalDate", label: "Date of the most recent eligibility determination", kind: "date" },
      { id: "dis1", label: "Primary disability", kind: "select", options: [...DISABILITIES] },
      { id: "dis2", label: "Secondary disability (if any)", kind: "select", options: ["None", ...DISABILITIES] },
      { id: "sldAreas", label: "Specific Learning Disability areas found eligible", kind: "multi", options: [...SLD_AREAS], show: (d) => d.a.dis1 === "Specific Learning Disability" || d.a.dis2 === "Specific Learning Disability" },
      { id: "referral", label: "How the student was referred", kind: "select", options: ["the MTSS / student support team after interventions", "a parent request for evaluation", "a teacher referral after interventions", "an IEP transferred from another district", "early childhood (Child Find)"] },
      { id: "interventions", label: "Interventions and supports already tried", kind: "multi", options: INTERVENTIONS },
      { id: "eligNotes", label: "Anything else about the evaluation (optional)", kind: "long", placeholder: "Changes in eligibility, outside reports…" },
    ] },
  { id: "strengths", title: "Strengths & student voice", part: "Part 1", intro: "The rubric wants strengths and interests that clearly came from the student.",
    fields: [
      { id: "strengths", label: "Strengths", kind: "multi", options: STRENGTHS },
      { id: "interests", label: "Interests", kind: "multi", options: INTERESTS },
      { id: "learns", label: "Learns best…", kind: "multi", options: LEARNS_BEST },
      { id: "studentInput", label: "How the student gave input", kind: "select", options: ["a student interview with the case manager", "a student interest survey", "a conversation during class", "the student attending the IEP meeting"] },
      { id: "studentQuote", label: "Something the student said (optional)", kind: "text", placeholder: "e.g. I like when teachers show an example first." },
    ] },
  { id: "data", title: "Data sources", part: "Part 1 (required)", intro: "Pick every source you used. Each one you pick opens its own boxes below.",
    fields: [
      { id: "sources", label: "Data sources used", kind: "multi", options: DATA_SOURCES },
      { id: "irDate", label: "i-Ready Reading date", kind: "date", show: sourcesHas("i-Ready Reading") },
      { id: "irScore", label: "i-Ready Reading scale score", kind: "number", show: sourcesHas("i-Ready Reading") },
      { id: "irPct", label: "i-Ready Reading percentile", kind: "number", show: sourcesHas("i-Ready Reading") },
      { id: "irLevel", label: "i-Ready Reading placement", kind: "select", options: ["3 or more grade levels below", "2 grade levels below", "1 grade level below", "Early on grade level", "Mid or above grade level"], show: sourcesHas("i-Ready Reading") },
      { id: "irStrong", label: "Reading domains that are strengths", kind: "multi", options: IREADY_READING, show: sourcesHas("i-Ready Reading") },
      { id: "irWeak", label: "Reading domains that need work", kind: "multi", options: IREADY_READING, show: sourcesHas("i-Ready Reading") },
      { id: "imDate", label: "i-Ready Math date", kind: "date", show: sourcesHas("i-Ready Math") },
      { id: "imScore", label: "i-Ready Math scale score", kind: "number", show: sourcesHas("i-Ready Math") },
      { id: "imPct", label: "i-Ready Math percentile", kind: "number", show: sourcesHas("i-Ready Math") },
      { id: "imLevel", label: "i-Ready Math placement", kind: "select", options: ["3 or more grade levels below", "2 grade levels below", "1 grade level below", "Early on grade level", "Mid or above grade level"], show: sourcesHas("i-Ready Math") },
      { id: "imStrong", label: "Math domains that are strengths", kind: "multi", options: IREADY_MATH, show: sourcesHas("i-Ready Math") },
      { id: "imWeak", label: "Math domains that need work", kind: "multi", options: IREADY_MATH, show: sourcesHas("i-Ready Math") },
      { id: "rgrBds", label: "Beginning Decoding Survey (% correct)", kind: "number", show: sourcesHas("Really Great Reading") },
      { id: "rgrAds", label: "Advanced Decoding Survey (% correct)", kind: "number", show: sourcesHas("Really Great Reading") },
      { id: "rgrOrf", label: "Oral reading fluency (words correct per minute)", kind: "number", show: sourcesHas("Really Great Reading") },
      { id: "cmasEla", label: "Most recent CMAS ELA result", kind: "select", options: CMAS_LEVELS, show: sourcesHas("CMAS") },
      { id: "cmasMath", label: "Most recent CMAS Math result", kind: "select", options: CMAS_LEVELS, show: sourcesHas("CMAS") },
      { id: "gradesImpact", label: "Grades are most affected by", kind: "select", options: ["missing work", "summative assessments", "formative assessments", "practice and participation"], show: sourcesHas("Current grades") },
      { id: "gradesNote", label: "Grades summary (optional)", kind: "text", placeholder: "e.g. passing 4 of 6 classes, lowest in Math (58%)", show: sourcesHas("Current grades") },
      { id: "absences", label: "Full days missed this year", kind: "number", show: sourcesHas("Attendance") },
      { id: "chronic", label: "Chronically absent (10%+ of days)?", kind: "yesno", show: sourcesHas("Attendance") },
      { id: "lsPos", label: "Liveschool positive points", kind: "number", show: sourcesHas("Liveschool behavior data") },
      { id: "lsNeg", label: "Liveschool deductions", kind: "number", show: sourcesHas("Liveschool behavior data") },
      { id: "lsTopPos", label: "Most positive points for", kind: "select", options: ["participation", "being prepared", "kindness", "on-task work", "following directions"], show: sourcesHas("Liveschool behavior data") },
      { id: "lsTopNeg", label: "Most deductions for", kind: "select", options: ["off task", "talking out", "late to class", "phone use", "not following directions", "disrespect", "out of area"], show: sourcesHas("Liveschool behavior data") },
      { id: "genEdStrengths", label: "Gen ed teachers report these strengths", kind: "multi", options: ["participates in class", "positive with peers", "asks for help", "turns in work", "works hard", "respectful", "creative ideas"], show: sourcesHas("Gen ed teacher surveys") },
      { id: "genEdConcerns", label: "Gen ed teachers report these concerns", kind: "multi", options: ["missing work", "reading grade-level texts", "writing", "math", "staying on task", "following directions", "behavior", "attendance", "social skills"], show: sourcesHas("Gen ed teacher surveys") },
      { id: "obs1Class", label: "Observation 1: class", kind: "select", options: ["ELA", "Math", "Science", "Social Studies", "Elective"], show: sourcesHas("Classroom observations") },
      { id: "obs1On", label: "Observation 1: student on task (%)", kind: "number", show: sourcesHas("Classroom observations") },
      { id: "obs1Peer", label: "Observation 1: peer on task (%)", kind: "number", show: sourcesHas("Classroom observations") },
      { id: "obs1Type", label: "Observation 1: type of instruction", kind: "select", options: ["whole-group direct instruction", "independent work", "small-group work", "partner work", "a lab or hands-on activity"], show: sourcesHas("Classroom observations") },
      { id: "obs2Class", label: "Observation 2: class", kind: "select", options: ["ELA", "Math", "Science", "Social Studies", "Elective"], show: sourcesHas("Classroom observations") },
      { id: "obs2On", label: "Observation 2: student on task (%)", kind: "number", show: sourcesHas("Classroom observations") },
      { id: "obs2Peer", label: "Observation 2: peer on task (%)", kind: "number", show: sourcesHas("Classroom observations") },
      { id: "obs2Type", label: "Observation 2: type of instruction", kind: "select", options: ["whole-group direct instruction", "independent work", "small-group work", "partner work", "a lab or hands-on activity"], show: sourcesHas("Classroom observations") },
    ] },
  { id: "services-now", title: "Current services", part: "Part 1", intro: "What support looks like right now, before the new IEP.", show: (d) => !isInitial(d),
    fields: [
      { id: "curServices", label: "Current IEP services", kind: "multi", options: ["Literacy push-in (ELA)", "Literacy pull-out", "Math push-in", "Math pull-out", "Writing support", "Social/emotional with the social worker", "Speech-language", "Occupational therapy", "Executive functioning / learning lab"] },
      { id: "curMinutes", label: "Total current minutes per week", kind: "number" },
      { id: "curLooks", label: "What the support looks like in class", kind: "select", options: ["co-teaching and small-group reteaching in the gen ed class", "a separate small group with targeted intervention", "check-ins during independent work", "a mix of push-in and pull-out support"] },
    ] },
  { id: "prior", title: "Last year's goals", part: "Part 1 & Part 2", intro: "Progress on each goal from the last IEP, with data. The rubric needs a narrative and data for each one.", custom: "prior", show: (d) => !isInitial(d), fields: [] },
  { id: "parent", title: "Parent input", part: "Part 1", intro: "Parent concerns, parent-reported strengths and how they gave input.",
    fields: [
      { id: "parentMethod", label: "How the parent/guardian gave input", kind: "select", options: ["a phone call with the case manager", "an in-person meeting", "a parent input survey", "email", "the IEP meeting", "Did not respond after 3 or more contact attempts"] },
      { id: "parentConcerns", label: "Parent concerns", kind: "multi", options: PARENT_CONCERNS, show: (d) => !/^Did not/.test(d.a.parentMethod || "") },
      { id: "parentConcernsText", label: "In the parent's words (optional)", kind: "long", show: (d) => !/^Did not/.test(d.a.parentMethod || "") },
      { id: "parentStrengths", label: "Strengths the parent shared", kind: "text", placeholder: "e.g. helpful at home, loves soccer, very caring", show: (d) => !/^Did not/.test(d.a.parentMethod || "") },
      { id: "parentAttend", label: "Will a parent/guardian attend?", kind: "yesno" },
      { id: "contactLog", label: "Parent contact attempts (dates and how)", kind: "long", show: (d) => d.a.parentAttend === "No" || /^Did not/.test(d.a.parentMethod || "") },
    ] },
  { id: "needs", title: "Needs, impact & goals", part: "Part 1 impact & Part 2", intro: "Areas of need are suggested from the disabilities. Each one you add gets its own goal, two objectives, measurement and the service that matches it.", custom: "needs", fields: [
      { id: "functionalNone", label: "No other functional needs (organization, self-care, motor) beyond the areas above", kind: "yesno", help: "Pick Yes only if the team found none." },
    ] },
  { id: "special", title: "Special considerations", part: "Part 1 (each must be Yes or No)", intro: "Every factor needs a Yes or No. A Yes opens a box for how the IEP addresses it.",
    fields: [
      { id: "behaviorImpedes", label: "Does behavior impede learning (self or others)?", kind: "yesno" },
      { id: "bip", label: "Behavior intervention plan (BIP)?", kind: "yesno" },
      { id: "bipNote", label: "How behavior needs are addressed", kind: "select", options: ["through the self-regulation goal and social/emotional services in this IEP", "through the attached FBA and BIP", "through the BIP, the self-regulation goal and services"], show: (d) => yes(d.a.behaviorImpedes) || yes(d.a.bip) },
      { id: "vision", label: "Blind or visually impaired?", kind: "yesno" },
      { id: "visionNote", label: "Braille / vision needs", kind: "text", show: (d) => yes(d.a.vision) },
      { id: "hearing", label: "Deaf or hard of hearing?", kind: "yesno" },
      { id: "hearingNote", label: "Language and communication needs", kind: "text", show: (d) => yes(d.a.hearing) },
      { id: "deafblind", label: "Deaf-blind?", kind: "yesno" },
      { id: "communication", label: "Unique communication needs?", kind: "yesno" },
      { id: "communicationNote", label: "How communication needs are addressed", kind: "text", show: (d) => yes(d.a.communication) },
      { id: "mll", label: "Multilingual learner?", kind: "yesno" },
      { id: "mllNote", label: "How language needs are addressed", kind: "select", options: ["ELD instruction and language supports are provided alongside IEP services; WIDA ACCESS scores are reviewed each year", "language needs are addressed through accommodations and ELD services"], show: (d) => yes(d.a.mll) },
      { id: "at", label: "Assistive technology needs?", kind: "yesno" },
      { id: "atNote", label: "Assistive technology", kind: "select", options: ["text-to-speech and speech-to-text on the school device", "an FM system", "a communication device", "a laptop for written work"], show: (d) => yes(d.a.at) },
      { id: "transport", label: "Special transportation?", kind: "yesno" },
      { id: "transportNote", label: "Transportation needs", kind: "text", show: (d) => yes(d.a.transport) },
      { id: "health", label: "Health care plan?", kind: "yesno" },
      { id: "healthNote", label: "How health needs are addressed", kind: "text", show: (d) => yes(d.a.health) },
    ] },
  { id: "accs", title: "Accommodations & assessments", part: "Part 3", intro: "Suggested accommodations come from the needs you picked. Each is written out with when, where and who.",
    fields: [
      { id: "accs", label: "Classroom accommodations", kind: "multi", options: (d) => accOptions(d) },
      { id: "extraAcc", label: "Extracurricular and non-academic activities", kind: "select", options: ["No accommodations are needed for extracurricular or non-academic activities.", "The same accommodations are provided in extracurricular and non-academic activities when they apply.", "An adult check-in is provided during unstructured times (lunch, recess, clubs)."] },
      { id: "eeo", label: "Taught and assessed on Extended Evidence Outcomes (EEOs)?", kind: "yesno" },
      { id: "eeoEvidence", label: "Evidence of a significant cognitive disability", kind: "long", show: (d) => yes(d.a.eeo) },
      { id: "assessments", label: "State and district assessments during this IEP", kind: "multi", options: (d) => assessmentOptions(d) },
      { id: "testAccs", label: "Test accommodations (from the classroom ones)", kind: "multi", options: (d) => many(d, "accs").map((id) => accById(id)?.label || id), show: (d) => !yes(d.a.eeo) },
      { id: "altInformed", label: "Parent informed about the differences between regular and alternate assessments?", kind: "yesno", show: (d) => yes(d.a.eeo) },
    ] },
  { id: "services", title: "Services & LRE", part: "Part 4", intro: "Minutes come from each need (step Needs). Here you set indirect time, the school week and the settings the team considered.",
    fields: [
      { id: "weekMinutes", label: "Minutes in the school week (bell to bell, Mon-Fri)", kind: "number" },
      { id: "indirect", label: "Indirect time per provider (case management, progress monitoring, consulting)", kind: "select", options: ["15 minutes per month", "30 minutes per month", "60 minutes per month", "90 minutes per month"] },
      { id: "participants", label: "Team members at the placement decision", kind: "multi", options: ["Parent/guardian", "Student", "General education teacher", "Special education teacher / case manager", "School psychologist", "Social worker", "Speech-language pathologist", "Occupational therapist", "Administrator / designee", "Interpreter"] },
      { id: "lreConsidered", label: "Settings the team considered (pick at least 2)", kind: "multi", options: ["General education with accommodations only", "General education with push-in support", "General education with some pull-out support", "Special education classroom for core subjects", "Separate school or program"] },
      { id: "nonacademic", label: "Participation with peers in non-academic activities", kind: "select", options: ["will take part fully with non-disabled peers in lunch, recess, clubs, athletics and all non-academic activities", "will take part with non-disabled peers in non-academic activities with an adult check-in during unstructured times"] },
    ] },
  { id: "esy", title: "Extended School Year", part: "Part 4 (required)", intro: "Must be completed even if the student does not need ESY.",
    fields: [
      { id: "esyRegression", label: "Significant regression after breaks with slow recoupment?", kind: "yesno" },
      { id: "esyEmerging", label: "A critical skill is emerging and would be lost without ESY?", kind: "yesno" },
      { id: "esyPredictive", label: "Predictive factors (nature/severity of disability) show a need?", kind: "yesno" },
      { id: "esyEligible", label: "Eligible for ESY?", kind: "yesno" },
      { id: "esyGoals", label: "ESY goals", kind: "multi", options: (d) => d.needs.map((n) => needById(n.area)?.label || n.area), show: (d) => yes(d.a.esyEligible) },
      { id: "esyMinutes", label: "ESY minutes per week (summer)", kind: "select", options: ["60", "90", "120", "180", "240"], show: (d) => yes(d.a.esyEligible) },
    ] },
  { id: "pwn", title: "Prior Written Notice", part: "Part 5", intro: "The rubric scores 0 if these say N/A or none.",
    fields: [
      { id: "optionsRejected", label: "Other options the team considered and rejected", kind: "multi", options: ["More time in the general education class", "More time in a special education setting", "Dismissal from special education", "Fewer service minutes", "A different service delivery model (push-in only)"] },
      { id: "otherFactors", label: "Other factors relevant to this IEP", kind: "multi", options: ["Attendance affects access to instruction", "The student is a multilingual learner", "Recent change in schools or schedule", "Medical or health information", "Outside therapy or counseling", "The student's own goals for the future", "Family input on homework and routines"] },
    ] },
  { id: "transition", title: "Transition", part: "Part 6", intro: "Shown because the student is in grade 9+ or age 15+.", show: isTransition,
    fields: [
      { id: "studentInvited", label: "Student attended or was invited to the meeting", kind: "select", options: ["The student attended the IEP meeting.", "The student was invited to the IEP meeting (invitation on file)."] },
      { id: "taTool", label: "Age-appropriate transition assessment (this school year)", kind: "select", options: TRANSITION_ASSESSMENTS },
      { id: "taDate", label: "Transition assessment date", kind: "date" },
      { id: "taResults", label: "What the assessment showed (career interests, strengths)", kind: "long", placeholder: "e.g. high interest in building and fixing things; prefers hands-on work outdoors" },
      { id: "psEd", label: "Post-secondary education/training goal", kind: "select", options: POST_ED },
      { id: "psEdField", label: "In which field?", kind: "text", placeholder: "e.g. automotive technology" },
      { id: "psJob", label: "Post-secondary employment goal", kind: "select", options: POST_JOB },
      { id: "psJobField", label: "As a / in…", kind: "text", placeholder: "e.g. an automotive technician" },
      { id: "psLiving", label: "Independent living", kind: "select", options: ["will live independently, managing a budget, transportation and appointments", "will live with family while managing personal finances and transportation independently", "No independent living goal is needed: assessments show the student already manages daily living skills"] },
      { id: "courses", label: "Course of study (specific courses)", kind: "multi", options: COURSES_9_12 },
      { id: "trActivities", label: "Transition activities and services", kind: "multi", options: TRANSITION_ACTIVITIES },
      { id: "agencies", label: "Agencies / post-school services to link to", kind: "multi", options: AGENCIES },
    ] },
  { id: "reporting", title: "Progress reporting", part: "Part 2 (required)", intro: "How and how often parents hear about progress.",
    fields: [
      { id: "reportFreq", label: "How often", kind: "select", options: ["each grading period (with report cards)", "every quarter", "every trimester", "monthly"] },
      { id: "reportMethod", label: "How", kind: "select", options: ["a written IEP progress report sent home and shared in Enrich", "a written progress report emailed to the family", "a progress report reviewed at parent-teacher conferences"] },
    ] },
  { id: "finish", title: "Finish & compliance", part: "Part 5 (required)", intro: "After the meeting. These can't be checked from the draft, so the rubric counts them when you check them off.",
    fields: [
      { id: "chkProof", label: "Proofread: correct name everywhere; service statement matches the service grid", kind: "yesno" },
      { id: "chkSignatures", label: "Signature page and parent safeguards receipt uploaded", kind: "yesno" },
      { id: "chkNotice", label: "Meeting held on the date in the Meeting Notice", kind: "yesno" },
      { id: "chkFinal", label: "Finalized within one week of the meeting", kind: "yesno" },
      { id: "chkReports", label: "Last year's progress reports went home on schedule", kind: "yesno", show: (d) => !isInitial(d) },
    ] },
];

export const visibleSteps = (d: IepDraft) => IEP_STEPS.filter((s) => !s.show || s.show(d));
export const fieldOptions = (f: IepField, d: IepDraft) => (typeof f.options === "function" ? f.options(d) : f.options || []);
export const fieldShown = (f: IepField, d: IepDraft) => !f.show || f.show(d);

/** Accommodations suggested by the needs come first, then the rest. */
export function accOptions(d: IepDraft): string[] {
  const suggested = new Set(d.needs.flatMap((n) => needById(n.area)?.accs || []));
  return [...ACCOMMODATIONS.filter((a) => suggested.has(a.id)), ...ACCOMMODATIONS.filter((a) => !suggested.has(a.id))].map((a) => a.id);
}
export const accLabel = (id: string) => accById(id)?.label || id;
export const suggestedAcc = (d: IepDraft, id: string) => d.needs.some((n) => needById(n.area)?.accs.includes(id));

export function assessmentOptions(d: IepDraft): string[] {
  const n = gradeNum(d), alt = yes(d.a.eeo);
  const out: string[] = [];
  if (n >= 2 && n <= 8) out.push(alt ? "CoAlt ELA" : "CMAS ELA", alt ? "CoAlt Math" : "CMAS Math");
  if ([5, 8, 11].includes(n) || [4, 7, 10].includes(n)) out.push(alt ? "CoAlt Science" : "CMAS Science (grades 5, 8, 11)");
  if (n >= 9 && n <= 10) out.push(alt ? "CoAlt ELA and Math (high school)" : "PSAT");
  if (n >= 10 && n <= 11) out.push(alt ? "CoAlt (grade 11)" : "SAT (grade 11)");
  if (yes(d.a.mll)) out.push(alt ? "Alternate ACCESS for ELLs" : "WIDA ACCESS for ELLs");
  out.push("i-Ready Diagnostic (district, 3 times a year)");
  return out;
}

/** Areas the drop box offers: suggested ones first. */
export function areaOptions(d: IepDraft): { id: string; label: string; suggested: boolean }[] {
  const sug = suggestedAreas(d.a.dis1 || "", d.a.dis2 || "", many(d, "sldAreas"));
  const ids = new Set(sug.map((n) => n.id));
  return [...sug.map((n) => ({ id: n.id, label: n.label, suggested: true })), ...NEED_AREAS.filter((n) => !ids.has(n.id)).map((n) => ({ id: n.id, label: n.label, suggested: false }))];
}

// ───────────────────────── services, LRE
export type ServiceRow = { type: string; provider: string; minutes: number; where: "gen" | "sped"; skills: string[] };
export function servicesOf(d: IepDraft): ServiceRow[] {
  const rows: ServiceRow[] = [];
  for (const n of d.needs) {
    const area = needById(n.area); if (!area) continue;
    const svc = serviceById(area.service);
    const where = n.where || "gen";
    const mins = Number.parseInt(n.minutes, 10) || 0;
    const row = rows.find((r) => r.type === svc.label && r.where === where);
    if (row) { row.minutes += mins; row.skills.push(area.label.toLowerCase()); }
    else rows.push({ type: svc.label, provider: svc.provider, minutes: mins, where, skills: [area.label.toLowerCase()] });
  }
  return rows;
}
export function lreOf(d: IepDraft) {
  const week = Number.parseInt(d.a.weekMinutes || "2100", 10) || 2100;
  const outside = servicesOf(d).filter((r) => r.where === "sped").reduce((n, r) => n + r.minutes, 0);
  const pct = Math.max(0, Math.round(((week - outside) / week) * 1000) / 10);
  const category = pct >= 80 ? "1 (in the general education classroom 80% or more of the day)" : pct >= 40 ? "2 (in the general education classroom 40% to 79% of the day)" : "3 (in the general education classroom less than 40% of the day)";
  return { week, outside, pct, category };
}

// ───────────────────────── writing the IEP
export type IepSection = { id: string; title: string; paragraphs: string[]; bullets?: string[]; table?: string[][] };

export function writeIep(d: IepDraft): IepSection[] {
  const p = pronouns(d), N = first(d), full = (d.a.name || d.student || "").trim() || N;
  const grade = gradeNum(d), band = bandOf(grade);
  const out: IepSection[] = [];
  const sources = many(d, "sources");
  const dis = [d.a.dis1, d.a.dis2 && d.a.dis2 !== "None" ? d.a.dis2 : ""].filter(Boolean) as string[];
  const gradeWord = d.a.grade === "K" ? "kindergarten" : d.a.grade ? `${d.a.grade}${["1", "2", "3"].includes(d.a.grade) ? ["st", "nd", "rd"][Number(d.a.grade) - 1] : "th"} grade` : "____ grade";

  // Strengths and interests
  const strengths = many(d, "strengths"), interests = many(d, "interests"), learns = many(d, "learns");
  out.push({ id: "strengths", title: "Student Strengths, Interests and How They Learn Best", paragraphs: [
    `${N} shared ${p.pos} strengths and interests through ${d.a.studentInput || "____"}. ${N} ${p.be} ${strengths.length ? list(strengths) : "____"}. Outside of class, ${p.sub} ${p.sub === "they" ? "enjoy" : "enjoys"} ${interests.length ? list(interests) : "____"}.`,
    `${N} learns best ${learns.length ? list(learns) : "____"}.${filled(d.a.studentQuote) ? ` In ${p.pos} own words: "${d.a.studentQuote.trim()}"` : ""}`,
    ...(filled(d.a.parentStrengths) ? [`${N}'s family describes ${p.obj} as ${d.a.parentStrengths.trim()}.`] : []),
  ] });

  // Evaluation summary (template)
  const sld = many(d, "sldAreas");
  out.push({ id: "eval", title: "Present Levels of Educational Performance: Evaluation Summary", paragraphs: [
    `${full} is a ${d.a.age || "____"}-year-old ${gradeWord} student who attends ${d.a.school || "____"} in ${d.a.city || "Denver, CO"}. ${cap(p.pos)} primary language is ${d.a.language || "____"}.`,
    `${N} was referred for special education through ${d.a.referral || "____"}.${many(d, "interventions").length ? ` Before and during the referral, ${N} received ${list(many(d, "interventions"))}.` : ""}${filled(d.a.eligNotes) ? ` ${d.a.eligNotes.trim()}` : ""}`,
    `${cap(p.pos)} most recent evaluation for the purpose of determining eligibility under IDEA was ${longDate(d.a.evalDate)}. The team determined that ${N} qualifies as a student with ${dis.length ? list(dis.map((x, i) => `${x} (${i === 0 ? "primary" : "secondary"})`)) : "____"}${sld.length ? ` in the areas of ${list(sld)}` : ""}.`,
  ] });

  // Current services
  if (!isInitial(d)) out.push({ id: "current", title: "Current IEP Services Provided", paragraphs: [
    `Currently ${N} receives ${many(d, "curServices").length ? list(many(d, "curServices")) : "____"} for a total of ${d.a.curMinutes || "____"} minutes a week. Support looks like ${d.a.curLooks || "____"}.${many(d, "accs").length ? ` Teachers also provide accommodations such as ${list(many(d, "accs").slice(0, 3).map((id) => accLabel(id).toLowerCase()))}.` : ""}`,
  ] });

  // Progress on last year's goals
  if (!isInitial(d)) out.push({ id: "progress", title: "Annual Goal(s) Progress Update", paragraphs: [
    d.prior.length ? `Since the last IEP meeting${d.a.prevIep ? ` on ${longDate(d.a.prevIep)}` : ""}, ${N} has made the following progress toward ${p.pos} goals and objectives:` : `Since the last IEP meeting, ${N} has made the following progress: ____ (add each goal from last year's IEP).`,
  ], bullets: d.prior.map((g) => `${g.area || "Goal"}: ${N} ${g.status || "____"}. ${g.data ? g.data.trim() : "Progress monitoring data: ____"}`) });

  // Data
  const data: string[] = [];
  if (sources.includes("i-Ready Reading")) data.push(`i-Ready Reading Diagnostic (${longDate(d.a.irDate)}): ${N} scored ${d.a.irScore || "____"} on the scale score, in the ${d.a.irPct ? ordinal(d.a.irPct) : "____"} percentile, placing ${p.obj} ${(d.a.irLevel || "____").toLowerCase()}. Overall strengths were in ${many(d, "irStrong").length ? list(many(d, "irStrong")) : "____"}; areas needing improvement are ${many(d, "irWeak").length ? list(many(d, "irWeak")) : "____"}.`);
  if (sources.includes("i-Ready Math")) data.push(`i-Ready Math Diagnostic (${longDate(d.a.imDate)}): ${N} scored ${d.a.imScore || "____"} on the scale score, in the ${d.a.imPct ? ordinal(d.a.imPct) : "____"} percentile, placing ${p.obj} ${(d.a.imLevel || "____").toLowerCase()}. Overall strengths were in ${many(d, "imStrong").length ? list(many(d, "imStrong")) : "____"}; areas needing improvement are ${many(d, "imWeak").length ? list(many(d, "imWeak")) : "____"}.`);
  if (sources.includes("Really Great Reading")) data.push(`Really Great Reading: on the Beginning Decoding Survey ${N} read ${d.a.rgrBds || "____"}% of words correctly and on the Advanced Decoding Survey ${d.a.rgrAds || "____"}%. On the oral reading fluency benchmark ${p.sub} read ${d.a.rgrOrf || "____"} words correct per minute.`);
  if (sources.includes("CMAS")) data.push(`CMAS: on the most recent CMAS, ${N} ${(d.a.cmasEla || "____").toLowerCase()} in English Language Arts and ${(d.a.cmasMath || "____").toLowerCase()} in Mathematics.`);
  if (sources.includes("Current grades")) data.push(`Current grades: a review of the gradebook shows ${N}'s grades are most affected by ${d.a.gradesImpact || "____"}.${filled(d.a.gradesNote) ? ` ${cap(d.a.gradesNote.trim())}.` : ""}`);
  if (sources.includes("Attendance")) data.push(`Attendance: ${N} has missed ${d.a.absences || "____"} full days of school this year${yes(d.a.chronic) ? " and is chronically absent, which limits access to instruction" : ""}.`);
  if (sources.includes("Liveschool behavior data")) {
    const pos = Number(d.a.lsPos) || 0, neg = Number(d.a.lsNeg) || 0;
    data.push(`Liveschool: ${N} has earned ${d.a.lsPos || "____"} positive points and ${d.a.lsNeg || "____"} deductions${pos && neg ? ` (a ratio of about ${Math.round((pos / neg) * 10) / 10}:1)` : ""}. ${cap(p.sub)} earns the most positive points for ${d.a.lsTopPos || "____"} and the most deductions for ${d.a.lsTopNeg || "____"}.`);
  }
  if (sources.includes("Gen ed teacher surveys")) data.push(`General education teacher reports: teachers describe ${N} as someone who ${many(d, "genEdStrengths").length ? list(many(d, "genEdStrengths")) : "____"}. Their main concerns are ${many(d, "genEdConcerns").length ? list(many(d, "genEdConcerns")) : "____"}.`);
  if (sources.includes("Classroom observations")) {
    for (const k of ["obs1", "obs2"]) if (d.a[`${k}Class`]) data.push(`Observation (${d.a[`${k}Class`]}, ${d.a[`${k}Type`] || "____"}): using 15-second interval recording over 12 minutes, ${N} was on task ${d.a[`${k}On`] || "____"}% of intervals compared to a same-gender peer at ${d.a[`${k}Peer`] || "____"}%.`);
  }
  for (const s of sources.filter((x) => ["Progress monitoring data", "Most recent evaluation report", "Medical history", "Speech-language report", "OT report", "Transition assessment"].includes(x))) data.push(`${s} was also reviewed for this IEP.`);
  out.push({ id: "data", title: "Assessment Data and Current Performance", paragraphs: [`This IEP uses multiple sources of data: ${sources.length ? list(sources) : "____"}.`], bullets: data });

  // Parent input
  out.push({ id: "parent", title: "Parent/Guardian Input", paragraphs: [/^Did not/.test(d.a.parentMethod || "")
    ? `${N}'s parent/guardian did not respond after three or more contact attempts, so input was not obtained. Attempts: ${d.a.contactLog || "____"}.`
    : `${N}'s parent/guardian gave input through ${d.a.parentMethod || "____"}. Their concerns are ${many(d, "parentConcerns").length ? list(many(d, "parentConcerns")) : "____"}.${filled(d.a.parentConcernsText) ? ` In their words: "${d.a.parentConcernsText.trim()}"` : ""} They shared that ${N}'s strengths are ${d.a.parentStrengths || "____"}.`] });

  // Needs and impact
  const impacts = d.needs.map((n) => {
    const area = needById(n.area); if (!area) return "";
    const tag = area.for.find((t) => dis.some((x) => disabilityTag(x) === t));
    const which = dis.find((x) => disabilityTag(x) === tag) || dis[0] || "disability";
    return `${area.label}: because of ${fill(area.cause, d)}, ${N}'s ${which} affects ${p.pos} ability to ${fill(area.impact, d)}. Typically, students in ${gradeWord} are expected to ${area.expect(band)}. ${N} needs specially designed instruction in this area to access grade-level expectations.`;
  }).filter(Boolean);
  out.push({ id: "impact", title: "Student Needs and Impact of Disability", paragraphs: [
    `${N} was identified with ${dis.length ? list(dis.map((x, i) => `a ${i === 0 ? "primary" : "secondary"} disability of ${x}`)) : "____"}${sld.length ? ` in the areas of ${list(sld)}` : ""}. ${cap(p.pos)} disability affects ${p.pos} involvement and progress in the general education curriculum in the following ways:`,
    ...(yes(d.a.functionalNone) ? [`The team found no other functional needs (organization, self-care, motor) beyond the areas below.`] : []),
  ], bullets: impacts });

  // Goals
  const end = longDate(goalEnd(d)), mid = longDate(midYear(d));
  out.push({ id: "goals", title: "Measurable Annual Goals and Objectives", paragraphs: [
    `Progress toward each goal will be reported to ${N}'s family ${d.a.reportFreq || "____"} through ${d.a.reportMethod || "____"}.`,
  ], bullets: d.needs.flatMap((n, i) => {
    const area = needById(n.area); if (!area) return [];
    const gl = area.goals.find((x) => x.id === n.goal) || area.goals[0];
    const o1 = area.objectives.find((x) => x.id === n.obj1), o2 = area.objectives.find((x) => x.id === n.obj2);
    const objT = (o: typeof o1, half: boolean) => !o ? "" : isPercent(o.unit) && isPercent(gl.unit) && filled(n.target) && filled(n.baseline)
      ? String(half ? Math.round(((Number(n.baseline) + Number(n.target)) / 2) / 5) * 5 : n.target) : isPercent(o.unit) ? (half ? "70" : "80") : "____";
    return [
      `Goal ${i + 1} (${area.label}). Baseline: when asked to ${fill(gl.text, d)}, ${N} currently does this ${measure(n.baseline, gl.unit)}. Standard: ${area.standard(grade)}.`,
      `Annual goal: By ${end}, when given ${n.condition || "____"}, ${N} will ${fill(gl.text, d)} ${measure(n.target, gl.unit)}, as measured by ${n.method || "____"} collected ${n.freq || "____"}.`,
      ...(o1 ? [`Objective ${i + 1}a: By ${mid}, when given ${n.condition || "____"}, ${N} will ${fill(o1.text, d)} ${measure(objT(o1, true), o1.unit)}.`] : []),
      ...(o2 ? [`Objective ${i + 1}b: By ${end}, when given ${n.condition || "____"}, ${N} will ${fill(o2.text, d)} ${measure(objT(o2, false), o2.unit)}.`] : []),
    ];
  }) });

  // Special considerations
  const sc: [string, string, string?][] = [
    ["Behavior impedes learning", d.a.behaviorImpedes, d.a.bipNote], ["Behavior intervention plan", d.a.bip], ["Blind or visually impaired", d.a.vision, d.a.visionNote],
    ["Deaf or hard of hearing", d.a.hearing, d.a.hearingNote], ["Deaf-blind", d.a.deafblind], ["Unique communication needs", d.a.communication, d.a.communicationNote],
    ["Multilingual learner", d.a.mll, d.a.mllNote], ["Assistive technology", d.a.at, d.a.atNote], ["Special transportation", d.a.transport, d.a.transportNote], ["Health care plan", d.a.health, d.a.healthNote],
  ];
  out.push({ id: "special", title: "Special Considerations", paragraphs: [], table: [["Factor", "Yes/No", "How it is addressed"], ...sc.map(([f, v, note]) => [f, v || "____", yes(v) ? (note || "____") : "Not applicable"])] });

  // Accommodations
  const accs = many(d, "accs");
  const alt = yes(d.a.eeo);
  out.push({ id: "accs", title: "Accommodations and Modifications", paragraphs: [
    `The following accommodations are linked to ${N}'s areas of need and are provided in ${p.pos} classes:`,
  ], bullets: [...accs.map((id) => { const a = accById(id); return a ? `${a.label} (${a.cat}): ${fill(a.text, d)}` : id; }),
    `Extracurricular and non-academic activities: ${d.a.extraAcc || "____"}`,
    ...(alt ? [`Modified instruction: ${N} is taught on the Colorado Academic Standards Extended Evidence Outcomes. Evidence of a significant cognitive disability: ${d.a.eeoEvidence || "____"}`] : [])] });
  out.push({ id: "assess", title: "State and District Assessments", paragraphs: [
    `${N} will take ${alt ? "alternate" : "regular"} state and district assessments during this IEP: ${many(d, "assessments").length ? list(many(d, "assessments")) : "____"}.`,
    alt ? `${N} meets the Alternate Assessment Participation Eligibility Criteria, and ${p.pos} parent/guardian ${yes(d.a.altInformed) ? "has been" : "____ been"} informed of the differences between regular and alternate assessments.`
      : `Assessment accommodations (the same ones used in class): ${many(d, "testAccs").length ? list(many(d, "testAccs")) : "none needed"}.`,
  ] });

  // Services
  const rows = servicesOf(d), lre = lreOf(d);
  const start = longDate(d.a.meetingDate), stop = longDate(goalEnd(d));
  out.push({ id: "services", title: "Service Delivery", paragraphs: [
    ...rows.map((r) => `${N} will receive ${r.minutes || "____"} minutes per week of ${r.type} ${r.where === "gen" ? "in the general education classroom" : "in a special education setting outside the general education classroom"} from the ${r.provider}, to address ${list(r.skills)}. Services begin ${start} and end ${stop}. To be delivered for the school year only excluding school breaks, summers, holidays and non-student contact days.`),
    `Indirect services: each provider has ${d.a.indirect || "____"} of indirect time for case management, progress monitoring, co-planning, consultation with general education teachers and paraprofessionals, and assessment.`,
  ], table: [["Service", "Provider", "Minutes/week", "Location", "Start", "End"], ...rows.map((r) => [r.type, r.provider, String(r.minutes || "____"), r.where === "gen" ? "General education" : "Special education setting", start, stop])] });

  // ESY
  const esyWhy = yes(d.a.esyEligible)
    ? `${N} is eligible for ESY because ${[yes(d.a.esyRegression) && "data show significant regression after breaks with slow recoupment", yes(d.a.esyEmerging) && "a critical skill is emerging and would likely be lost without services", yes(d.a.esyPredictive) && "predictive factors related to the nature and severity of the disability show a need"].filter(Boolean).join(", and ") || "____"}.`
    : `${N} is not eligible for ESY: data do not show significant regression and recoupment problems, no critical emerging skill would be lost over breaks, and predictive factors do not show a need.`;
  out.push({ id: "esy", title: "Extended School Year (ESY)", paragraphs: [
    `Regression and recoupment: ${d.a.esyRegression || "____"}. Critical emerging skill: ${d.a.esyEmerging || "____"}. Predictive factors: ${d.a.esyPredictive || "____"}. Eligible for ESY: ${d.a.esyEligible || "____"}.`, esyWhy,
    ...(yes(d.a.esyEligible) ? [`ESY services will address ${many(d, "esyGoals").length ? list(many(d, "esyGoals")) : "____"} for ${d.a.esyMinutes || "____"} minutes per week during the summer, in a special education setting, from the Special Education Teacher.`] : []),
  ] });

  // LRE
  const considered = many(d, "lreConsidered");
  out.push({ id: "lre", title: "Least Restrictive Environment", paragraphs: [
    `The IEP team (${many(d, "participants").length ? list(many(d, "participants")) : "____"}) made the placement decision. Based on a ${lre.week}-minute school week, ${N} is outside the general education classroom ${lre.outside} minutes per week and inside it ${lre.pct}% of the time, which is LRE category ${lre.category}.`,
    lre.outside ? `${N} will not take part with non-disabled peers in the general education classroom for ${lre.outside} minutes per week, when ${p.sub} ${p.sub === "they" ? "receive" : "receives"} specialized instruction in a small-group setting that cannot be delivered with fidelity in the general education class.` : `${N} will take part with non-disabled peers in the general education classroom for the whole school day.`,
    `Non-academic activities: ${N} ${d.a.nonacademic || "____"}.`,
  ], bullets: considered.map((s) => lreDiscussion(s, d)) });

  // PWN
  out.push({ id: "pwn", title: "Prior Written Notice", paragraphs: [
    `Action proposed: the team proposes the ${(d.a.type || "IEP").replace(" IEP", "").toLowerCase()} IEP described here, with the goals, services and accommodations above, based on ${sources.length ? list(sources.slice(0, 5)) : "the data reviewed"}.`,
    `ESY: ${esyWhy}`,
  ], bullets: [...many(d, "optionsRejected").map((o) => `Option considered: ${o}. Rejected because ${rejectReason(o, d)}`), ...many(d, "otherFactors").map((f) => `Other factor: ${f}.`)] });

  // Transition
  if (isTransition(d)) out.push({ id: "transition", title: "Transition Plan", paragraphs: [
    d.a.studentInvited || "____",
    `Transition assessment: ${d.a.taTool || "____"} (${longDate(d.a.taDate)}). Results: ${d.a.taResults || "____"}.`,
    `Post-secondary education/training goal: After high school, ${N} ${d.a.psEd || "____"}${filled(d.a.psEdField) ? ` in ${d.a.psEdField.trim()}` : ""}.`,
    `Post-secondary employment goal: After high school, ${N} ${d.a.psJob || "____"}${filled(d.a.psJobField) ? ` as ${d.a.psJobField.trim()}` : ""}.`,
    /^No independent/.test(d.a.psLiving || "") ? `Independent living: ${d.a.psLiving}.` : `Independent living goal: After high school, ${N} ${d.a.psLiving || "____"}.`,
    `Course of study: ${many(d, "courses").length ? list(many(d, "courses")) : "____"}. These courses build the skills ${N} needs for ${p.pos} post-secondary goals${filled(d.a.psEdField) ? ` in ${d.a.psEdField.trim()}` : ""}.`,
    `${N}'s annual goals (${d.needs.map((n) => needById(n.area)?.label.toLowerCase()).filter(Boolean).join("; ") || "____"}) support these post-secondary goals.`,
  ], bullets: [...many(d, "trActivities"), ...many(d, "agencies").map((a) => `Before leaving school, ${N} will be linked to ${a}.`)] });

  return out;
}

function ordinal(v: string): string { const n = Number(v); if (!n) return v; const s = ["th", "st", "nd", "rd"], m = n % 100; return n + (s[(m - 20) % 10] || s[m] || s[0]); }

function lreDiscussion(setting: string, d: IepDraft): string {
  const N = first(d);
  const map: Record<string, [string, string, string]> = {
    "General education with accommodations only": ["full access to grade-level instruction and peers", `${N} would not get the specialized instruction needed to close gaps`, "accommodations and teacher check-ins"],
    "General education with push-in support": ["grade-level instruction with support in the moment, with peers", "targeted skill instruction is harder to deliver in a full class", "co-teaching, small-group reteaching and accommodations"],
    "General education with some pull-out support": ["targeted, explicit instruction in a small group while most of the day stays with peers", "missed time in the general education class", "scheduling pull-out during the least disruptive times and pre-teaching"],
    "Special education classroom for core subjects": ["intensive small-group instruction", "much less access to grade-level content and non-disabled peers", "modifications and paraprofessional support in general education"],
    "Separate school or program": ["a highly structured setting", "removal from the neighborhood school and peers", "related services and a behavior plan in the current school"],
  };
  const [adv, dis, reduce] = map[setting] || ["____", "____", "____"];
  return `${setting}: advantages: ${adv}. Disadvantages: ${dis}. Supports considered to reduce the disadvantages: ${reduce}.`;
}

function rejectReason(option: string, d: IepDraft): string {
  const N = first(d);
  if (/More time in the general/.test(option)) return `${N}'s data show a need for specialized instruction that cannot be fully delivered in the general education class.`;
  if (/More time in a special/.test(option)) return `${N} can make progress with the services in this IEP while staying with non-disabled peers for most of the day.`;
  if (/Dismissal/.test(option)) return `${N} still has needs that require specially designed instruction, as shown in the present levels.`;
  if (/Fewer/.test(option)) return `the present levels show ${N} needs the minutes proposed to make progress on the goals.`;
  return `the team agreed the proposed services better meet ${N}'s needs.`;
}

/** The whole IEP as plain text, for copying into Enrich. */
export function iepText(d: IepDraft): string {
  return writeIep(d).map((s) => [s.title.toUpperCase(), ...s.paragraphs, ...(s.bullets || []).map((b) => `• ${b}`), ...(s.table || []).map((r) => r.join(" | "))].join("\n")).join("\n\n");
}

// ───────────────────────── the rubric check
export type RubricItem = { part: string; id: string; text: string; required: boolean; step: string; result: boolean | null; fix: string };
export type RubricResult = { items: RubricItem[]; passed: number; applicable: number; score: number; band: string; bandText: string; byPart: { part: string; passed: number; applicable: number }[] };

export const RUBRIC_PARTS = ["Part 1: Present Levels", "Part 2: Goals & Progress", "Part 3: Accommodations & Modifications", "Part 4: Services, ESY & LRE", "Part 5: IEP as a PWN", "Part 6: Transition"];

export function checkRubric(d: IepDraft): RubricItem[] {
  const P1 = RUBRIC_PARTS[0], P2 = RUBRIC_PARTS[1], P3 = RUBRIC_PARTS[2], P4 = RUBRIC_PARTS[3], P5 = RUBRIC_PARTS[4], P6 = RUBRIC_PARTS[5];
  const items: RubricItem[] = [];
  const add = (part: string, id: string, text: string, required: boolean, step: string, result: boolean | null, fix: string) => items.push({ part, id, text, required, step, result, fix });
  const needs = d.needs.filter((n) => needById(n.area));
  const hasNeeds = needs.length > 0;
  const initial = isInitial(d), tr = isTransition(d), alt = yes(d.a.eeo);
  const yn = (v?: string) => v === "Yes" || v === "No";
  const accUnion = new Set(needs.flatMap((n) => needById(n.area)!.accs));
  const sources = many(d, "sources");
  const noParent = /^Did not/.test(d.a.parentMethod || "");
  const svc = servicesOf(d);

  // Part 1
  add(P1, "strengths", "Strengths, interests and how the student learns best, with clear student input", false, "strengths", !!(many(d, "strengths").length && many(d, "interests").length && many(d, "learns").length && d.a.studentInput), "Pick strengths, interests, learns best and how the student gave input.");
  add(P1, "summary", "Summary of the student: age, grade, school and primary language", true, "student", !!(d.a.age && d.a.grade && filled(d.a.school) && d.a.language), "Fill in age, grade, school and language.");
  add(P1, "eval", "Most recent evaluation: date and eligibility outcome", true, "eligibility", !!(d.a.evalDate && d.a.dis1), "Add the evaluation date and primary disability.");
  add(P1, "needsum", "A simple-sentence summary of each need from the evaluation", true, "needs", hasNeeds, "Add at least one area of need.");
  add(P1, "sources", "Multiple data sources used", true, "data", sources.length >= 2, "Pick at least 2 data sources (3 or more is stronger).");
  add(P1, "plop", "Interventions tried, and a present level (with data) in every area", true, "needs", !!(many(d, "interventions").length && hasNeeds && needs.every((n) => filled(n.baseline))), "Pick interventions tried and enter a baseline for every need.");
  add(P1, "behavior", "Behavior that impedes learning is addressed (goal/services or BIP)", true, "special", d.a.behaviorImpedes !== "Yes" ? (yn(d.a.behaviorImpedes) ? null : false) : (needs.some((n) => ["behavior", "attention", "social"].includes(n.area)) || yes(d.a.bip)), "Answer whether behavior impedes learning; if Yes add a self-regulation need or a BIP.");
  add(P1, "priorgoals", "Narrative and data on each goal from the last IEP", false, "prior", initial ? null : d.prior.length > 0 && d.prior.every((g) => g.status && filled(g.data)), "Add each of last year's goals with a status and data.");
  add(P1, "impact", "How the disability affects involvement and progress in the general curriculum", false, "needs", hasNeeds && !!d.a.dis1, "Pick a disability and add areas of need.");
  add(P1, "otherneeds", "Other educational needs (organization, self-care, motor) addressed", false, "needs", needs.some((n) => needById(n.area)!.kind === "functional") || yes(d.a.functionalNone), "Add a functional need or confirm there are none.");
  add(P1, "category", "Eligibility category and areas of need from the eligibility checklist", false, "eligibility", !!d.a.dis1 && (![d.a.dis1, d.a.dis2].includes("Specific Learning Disability") || many(d, "sldAreas").length > 0), "Pick the disability (and SLD areas if SLD).");
  add(P1, "impacteach", "An impact statement for each area of need and disability", false, "needs", hasNeeds && many(d, "sldAreas").every((a) => needs.some((n) => needById(n.area)!.sld === a)), "Add a need for every SLD area found eligible.");
  add(P1, "rootcause", "Root cause and rationale for each need are clear", false, "needs", hasNeeds, "Add areas of need (each comes with its root cause).");
  add(P1, "pconcerns", "Parent/guardian concerns, or why input wasn't obtained", false, "parent", noParent || many(d, "parentConcerns").length > 0 || filled(d.a.parentConcernsText), "Pick parent concerns.");
  add(P1, "pstrengths", "Strengths shared by the parent/guardian, or why input wasn't obtained", false, "parent", noParent || filled(d.a.parentStrengths), "Add the strengths the parent shared.");
  add(P1, "pmethod", "How the parent/guardian gave input", false, "parent", !!d.a.parentMethod, "Pick how the parent gave input.");
  const factors: [string, string, string, string?][] = [["bip", "Behavior intervention plan: Yes/No", "bip"], ["vision", "Blind/visually impaired: Yes/No and needs addressed", "vision", "visionNote"], ["hearing", "Deaf/hard of hearing: Yes/No and needs addressed", "hearing", "hearingNote"], ["deafblind", "Deaf-blind: Yes/No", "deafblind"], ["communication", "Communication needs: Yes/No and addressed", "communication", "communicationNote"], ["mll", "Multilingual learner: Yes/No and language needs addressed", "mll", "mllNote"], ["at", "Assistive technology: Yes/No and addressed", "at", "atNote"], ["transport", "Special transportation: Yes/No and addressed", "transport", "transportNote"], ["health", "Health care plan: Yes/No and addressed", "health", "healthNote"]];
  for (const [id, text, key, note] of factors) add(P1, `sc-${id}`, text, false, "special", yn(d.a[key]) && (!yes(d.a[key]) || !note || filled(d.a[note])), "Answer Yes or No (and how it's addressed if Yes).");

  // Part 2
  add(P2, "goalperneed", "Every area of need has a goal with a baseline from the present levels", false, "needs", hasNeeds && needs.every((n) => n.goal && filled(n.baseline)), "Give every need a goal and a baseline.");
  add(P2, "measurable", "Each goal is measurable: condition, behavior and unit of measurement", true, "needs", hasNeeds && needs.every((n) => filled(n.condition) && n.goal && filled(n.target)), "Pick a condition and a target for every goal.");
  add(P2, "objectives", "Each goal has at least 2 aligned objectives", true, "needs", hasNeeds && needs.every((n) => n.obj1 && n.obj2 && n.obj1 !== n.obj2), "Pick two different objectives for every goal.");
  add(P2, "leverage", "Goals are high-leverage and support progress in the general curriculum", true, "needs", hasNeeds, "Add goals.");
  add(P2, "howmeasured", "How progress is measured: unit, how often and the method", true, "needs", hasNeeds && needs.every((n) => filled(n.method) && filled(n.freq)), "Pick a measurement method and frequency for every goal.");
  add(P2, "reporting", "How and how often progress is reported to parents", true, "reporting", !!(d.a.reportFreq && d.a.reportMethod), "Pick how and how often progress is reported.");
  add(P2, "standards", "Each goal is aligned to grade-level standards (or EEOs)", true, "needs", hasNeeds && !!d.a.grade, "Pick the grade so goals align to the right standards.");
  add(P2, "eeocore", "A student on EEOs has core-content goals as well as functional ones", true, "needs", !alt ? null : needs.some((n) => needById(n.area)!.kind === "academic"), "Add an academic (core content) goal.");
  add(P2, "pmrecord", "Progress has been measured and reported on schedule", false, "finish", initial ? null : yes(d.a.chkReports), "Check off that last year's progress reports went home on schedule.");
  add(P2, "pmreports", "Progress reports show method, level of progress and whether the goal will be met", false, "prior", initial ? null : d.prior.length > 0 && d.prior.every((g) => g.status && filled(g.data)), "Add a status and data for each of last year's goals.");
  add(P2, "pmnarrative", "Progress reports include a narrative of progress", false, "prior", initial ? null : d.prior.length > 0 && d.prior.every((g) => filled(g.data)), "Write the progress data for each goal.");

  // Part 3
  add(P3, "extra", "Accommodations for extracurricular/non-academic activities (or a statement that none are needed)", true, "accs", !!d.a.extraAcc, "Pick the extracurricular statement.");
  add(P3, "eeoqual", "Present levels show evidence of a significant cognitive disability (EEO students)", true, "accs", !alt ? (yn(d.a.eeo) ? null : false) : filled(d.a.eeoEvidence), "Answer the EEO question (and add evidence if Yes).");
  add(P3, "linked", "Each accommodation is linked to a need", true, "accs", many(d, "accs").length > 0 && many(d, "accs").every((id) => accUnion.has(id)), "Keep to the accommodations suggested by the needs (marked Suggested), or add the need it supports.");
  add(P3, "descriptive", "Each accommodation is descriptive (how, when, where, who)", true, "accs", many(d, "accs").length > 0, "Pick accommodations; each one is written out fully.");
  add(P3, "assessconsidered", "Participation in state/district assessments considered (and alternate assessment explained)", false, "accs", many(d, "assessments").length > 0 && (!alt || yes(d.a.altInformed)), "Pick the assessments (and confirm the parent was informed if alternate).");
  add(P3, "testlinked", "Test accommodations match classroom accommodations", false, "accs", alt ? null : many(d, "assessments").length > 0, "Pick the assessments and test accommodations.");
  add(P3, "allassess", "All assessments during the IEP are listed; regular or alternate, not both", false, "accs", many(d, "assessments").length > 0, "Pick every assessment during this IEP.");
  add(P3, "altcriteria", "Alternate assessment criteria match need and EEO instruction", false, "accs", alt ? filled(d.a.eeoEvidence) : null, "Add evidence for alternate assessment.");

  // Part 4
  add(P4, "svcdates", "Start date, frequency, duration and location of services (with the school-year statement)", false, "needs", !!d.a.meetingDate && hasNeeds && needs.every((n) => filled(n.minutes) && n.where), "Set the meeting date and minutes and location for every need.");
  add(P4, "svcstatement", "Service statement names amount, location, provider and skills", false, "needs", svc.length > 0 && svc.every((r) => r.minutes > 0), "Set minutes for every need.");
  add(P4, "svcaligned", "Each service has a goal and each goal has a service", false, "needs", hasNeeds && needs.every((n) => filled(n.minutes)), "Every need gets minutes, so goals and services line up.");
  add(P4, "svcproportional", "Services are proportional to need", false, "needs", hasNeeds && needs.every((n) => (Number(n.minutes) || 0) >= 30), "Give each need at least 30 minutes a week (or explain).");
  add(P4, "indirect", "Each provider has indirect service time", false, "services", !!d.a.indirect, "Pick indirect time per provider.");
  add(P4, "nonacad", "Participation with non-disabled peers in non-academic activities", false, "services", !!d.a.nonacademic, "Pick the non-academic participation statement.");
  add(P4, "esydata", "ESY: regression/recoupment data or predictive factors", true, "esy", yn(d.a.esyRegression) && yn(d.a.esyEmerging) && yn(d.a.esyPredictive), "Answer all three ESY questions.");
  add(P4, "esyconsidered", "ESY: each criterion and eligibility marked Yes or No", true, "esy", yn(d.a.esyEligible), "Answer whether the student is eligible for ESY.");
  add(P4, "esyservices", "ESY goals and services (if eligible)", false, "esy", !yes(d.a.esyEligible) ? null : many(d, "esyGoals").length > 0 && !!d.a.esyMinutes, "Pick ESY goals and minutes.");
  add(P4, "esyrationale", "ESY rationale in the Prior Written Notice", true, "esy", yn(d.a.esyEligible), "Answer the ESY questions (the rationale is written for you).");
  add(P4, "lreteam", "Required participants, and at least two placements considered", false, "services", ["Parent/guardian", "General education teacher", "Special education teacher / case manager"].every((r) => many(d, "participants").includes(r)) && many(d, "lreConsidered").length >= 2, "Pick parent, gen ed and sped teacher as participants and 2+ settings.");
  add(P4, "lrenot", "Explanation of time not with non-disabled peers", false, "needs", hasNeeds, "Add needs with minutes and location.");
  add(P4, "lreadv", "Advantages, disadvantages and supports for each setting considered", false, "services", many(d, "lreConsidered").length >= 2, "Pick at least 2 settings considered.");
  add(P4, "lrepct", "% of time in gen ed (from the school week) matches the LRE category", false, "services", !!d.a.weekMinutes && hasNeeds && needs.every((n) => n.where), "Set the school week minutes and each need's location.");

  // Part 5
  add(P5, "rejected", "Other options considered and why they were rejected", false, "pwn", many(d, "optionsRejected").length > 0, "Pick at least one option considered and rejected.");
  add(P5, "factors", "Other factors relevant to the IEP", false, "pwn", many(d, "otherFactors").length > 0, "Pick at least one other factor.");
  add(P5, "errors", "Free of major errors (name, service statement matches the grid)", true, "finish", yes(d.a.chkProof), "Proofread and check it off.");
  add(P5, "signatures", "Signature page and parent safeguards receipt uploaded", true, "finish", yes(d.a.chkSignatures), "Upload and check it off.");
  add(P5, "oneyear", "Held within one year of the previous IEP", false, "student", initial ? null : !!(d.a.prevIep && d.a.meetingDate) && d.a.meetingDate <= shift(d.a.prevIep, 1), "Enter last year's IEP date and this meeting date (within a year).");
  add(P5, "final", "Finalized within one week of the meeting", false, "finish", yes(d.a.chkFinal), "Check it off after finalizing.");
  add(P5, "delay", "Parent contact attempts recorded if the parent wasn't present", false, "parent", d.a.parentAttend !== "No" && !noParent ? null : filled(d.a.contactLog), "Record every contact attempt.");
  add(P5, "notice", "Held on the date in the Meeting Notice", true, "finish", yes(d.a.chkNotice), "Check it off once the meeting happens.");

  // Part 6
  const T = (v: boolean) => (tr ? v : null);
  add(P6, "invited", "Student attended or was invited", false, "transition", T(!!d.a.studentInvited), "Pick whether the student attended or was invited.");
  add(P6, "ta", "Age-appropriate transition assessment from this school year", false, "transition", T(!!(d.a.taTool && d.a.taDate && filled(d.a.taResults))), "Add the assessment, date and results.");
  add(P6, "psedjob", "Post-secondary goals in education/training and employment", false, "transition", T(!!(d.a.psEd && d.a.psJob)), "Pick both post-secondary goals.");
  add(P6, "psliving", "Independent living goal, or why it isn't needed", false, "transition", T(!!d.a.psLiving), "Pick the independent living goal.");
  add(P6, "psmeasurable", "Post-secondary goals are measurable", false, "transition", T(!!(d.a.psEd && d.a.psJob && filled(d.a.psEdField) && filled(d.a.psJobField))), "Add the field and job for the goals.");
  add(P6, "psaligned", "Post-secondary goals match the transition assessment", false, "transition", T(!!(filled(d.a.taResults) && d.a.psEd)), "Add assessment results that match the goals.");
  add(P6, "psterms", "Results-oriented terms (will enroll, will work, will live)", false, "transition", T(!!(d.a.psEd && d.a.psJob)), "Pick the post-secondary goals.");
  add(P6, "cos", "Course of study linked to post-secondary goals", false, "transition", T(many(d, "courses").length > 0 && filled(d.a.psEdField)), "Pick courses and the field of study.");
  add(P6, "cosspecific", "Specific courses listed (not just 'core academic')", false, "transition", T(many(d, "courses").length >= 3), "Pick at least 3 specific courses.");
  add(P6, "activities", "Transition activities and services by adults", false, "transition", T(many(d, "trActivities").length > 0), "Pick transition activities.");
  add(P6, "agencies", "Linked to post-school services before leaving school", false, "transition", T(many(d, "agencies").length > 0), "Pick at least one agency.");
  add(P6, "pslinked", "Post-secondary goals link to annual goals", false, "needs", T(hasNeeds && !!d.a.psEd), "Add annual goals and post-secondary goals.");
  add(P6, "timeline", "Goals support a timeline toward post-secondary readiness", false, "needs", T(hasNeeds), "Add annual goals.");
  return items;
}

const BANDS: [number, string, string][] = [
  [9, "9 – 10: Exceptional", "Consistently high across all areas."],
  [8, "8 – 8.9: Strong", "Above target with minor inconsistencies."],
  [7, "7 – 7.9: Acceptable but below target", "Inconsistencies affect overall quality."],
  [5, "5 – 6.9: Weak", "Well below expectations; needs significant improvement."],
  [0, "Below 5: Seriously deficient", "Not meeting minimum standards."],
];

export function scoreRubric(d: IepDraft): RubricResult {
  const items = checkRubric(d);
  const app = items.filter((i) => i.result !== null);
  const passed = app.filter((i) => i.result).length;
  const score = app.length ? Math.round((passed / app.length) * 100) / 10 : 0;
  const [, band, bandText] = BANDS.find(([min]) => score >= min) || BANDS[BANDS.length - 1];
  return { items, passed, applicable: app.length, score, band, bandText,
    byPart: RUBRIC_PARTS.map((part) => { const ps = app.filter((i) => i.part === part); return { part, passed: ps.filter((i) => i.result).length, applicable: ps.length }; }) };
}
