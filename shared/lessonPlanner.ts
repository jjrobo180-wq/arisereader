// Arise WorkHub: the Lesson Planner (the "Lessons" screen).
//
// A teacher sets up the classes (periods/blocks) they teach, each with its own roster, and plans
// lessons for each one as far ahead as they like. A lesson holds a full plan (objective, hook,
// I do / we do / you do, closure, differentiation…), the state standards it covers, its files
// (worksheets, PowerPoints, answer keys — uploaded, linked, or made with AI), and how each student
// did once it was taught, so the ones who need a reteach can be found again.
//
// Everything is kept in the teacher's one Hub workspace (server/teacherHub.ts): lessons stay in
// `workspace.lessons` (older lessons, made before this, still open), classes in `workspace.lessonClasses`.

import type { Lesson } from "./teacherHub";
import { cleanVisual, type WsVisual } from "./worksheetVisuals";

// ─── Kinds ──────────────────────────────────────────────────────────────────

export const LESSON_STATUSES = ["idea", "draft", "ready", "taught"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];
export const STATUS_LABEL: Record<LessonStatus, string> = { idea: "Idea", draft: "Draft", ready: "Ready to teach", taught: "Taught" };

/** How a student did on a lesson. */
export const CHECKS = ["mastered", "good", "reteach", "absent"] as const;
export type LessonCheck = (typeof CHECKS)[number];
export const CHECK_LABEL: Record<LessonCheck, string> = { mastered: "Mastered", good: "Did good", reteach: "Needs reteach", absent: "Absent" };

export type StudentMark = { status?: LessonCheck; /** A score as typed ("8/10", "85%"). */ score?: string; note?: string };

export const MATERIAL_KINDS = ["worksheet", "slides", "answerKey", "other"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];
export const MATERIAL_LABEL: Record<MaterialKind, string> = { worksheet: "Worksheets", slides: "PowerPoints & slides", answerKey: "Answer keys", other: "Other files" };

/** How a question is answered on paper. */
export type ItemKind = "choice" | "short" | "work" | "blank" | "truefalse" | "graph" | "match";
export type WorksheetItem = {
  /** The question. Maths goes between $ signs in LaTeX: $\frac{3}{4}+\frac{1}{8}$, $2\frac{1}{3}$, $x^2$. */
  prompt: string;
  kind?: ItemKind;
  choices?: string[];
  /** The answer (or a model answer), shown only on the answer key. Can hold $maths$ too. */
  answer: string;
  /** Lines to leave for writing. */
  lines?: number;
  /** Room to show work: none, small, medium or large. */
  space?: "small" | "medium" | "large";
  /** A picture with the question: a graph, number line, fraction bar, clock, shape… (shared/worksheetVisuals.ts). */
  visual?: WsVisual;
  /** The same picture as it should look when answered, for the answer key (points plotted, bars drawn). */
  keyVisual?: WsVisual;
  /** For matching: the right-hand column, in the order shown. */
  matches?: string[];
};
export type WorksheetSection = { heading: string; directions?: string; items: WorksheetItem[];
  /** A reading passage the questions are about. */
  passage?: string;
  /** Lay the problems out in 1 to 4 columns (handy for computation practice). */
  columns?: number;
  /** A word bank shown above the questions. */
  wordBank?: string[];
};
/** A worksheet made with AI. Its answer key is the same worksheet shown with the answers. */
export type GenWorksheet = { title: string; instructions: string; sections: WorksheetSection[];
  /** Bigger print for young students. */
  large?: boolean;
  /** Print a score line in the header. */
  score?: boolean;
  grade?: string;
  subject?: string;
};
export type GenSlide = { title: string; bullets: string[]; notes?: string };

/** One file in a lesson's slots: uploaded (kept in the Hub's Drive storage), a link, or made with AI. */
export type LessonMaterial = {
  id: string;
  kind: MaterialKind;
  name: string;
  /** Uploaded: where it is kept (the Drive bucket), its size and type. */
  path?: string;
  size?: number;
  contentType?: string;
  /** A link (Google Slides, Canva, a website). */
  url?: string;
  /** Made with AI. */
  worksheet?: GenWorksheet;
  slides?: GenSlide[];
  addedAt?: string;
  /** A worksheet and its answer key share this, so editing one updates the other. */
  pair?: string;
};

/** The full plan: every part of a lesson a teacher fills in. All are optional so older lessons still open. */
export type LessonPlan = Lesson & {
  classId?: string;
  unit?: string;
  /** A short overview of what happens (filled in when a unit is planned ahead with AI). */
  summary?: string;
  status?: LessonStatus;
  /** How long it runs, in minutes. */
  minutes?: number;
  standards?: string[];
  hook?: string;
  iDo?: string;
  weDo?: string;
  youDo?: string;
  closure?: string;
  vocabulary?: string;
  differentiation?: string;
  assessment?: string;
  homework?: string;
  reflection?: string;
  files?: LessonMaterial[];
  /** How each student did: their name to a mark. */
  marks?: Record<string, StudentMark>;
  /** A reteach lesson: the lesson it reteaches. */
  reteachOf?: string;
  /** Students this lesson is for (a reteach group). Empty means the whole class. */
  forStudents?: string[];
};

export const CLASS_COLORS = ["teal", "sky", "violet", "rose", "amber", "emerald", "indigo", "orange", "slate"] as const;
export type ClassColor = (typeof CLASS_COLORS)[number];

/** A class the teacher teaches: a period or block, with its own roster. */
export type LessonClass = {
  id: string;
  name: string;
  /** The block (period) of the day: one of the teacher's blocks' ids, or "". */
  block: string;
  subject: string;
  grade: string;
  color: ClassColor;
  /** The days it meets ("Mon".."Fri"). Empty means every school day. */
  days: string[];
  room: string;
  students: string[];
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export const LIMITS = {
  classes: 30,
  rosterPerClass: 80,
  lessons: 3000,
  filesPerLesson: 30,
  standardsPerLesson: 20,
  text: 6000,
  short: 200,
  worksheetSections: 8,
  worksheetItems: 40,
  slides: 30,
} as const;

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

export const LESSON_SUBJECTS = ["Reading", "ELA", "Writing", "Math", "Science", "Social Studies", "Push-in", "Pull-out", "Social skills", "Life skills", "Other"] as const;
export const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

// ─── Cleaning what was saved ────────────────────────────────────────────────

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const line = (v: unknown, max: number): string => str(v, max).replace(/\s+/g, " ").trim();
const day = (v: unknown): string => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const strings = (v: unknown, max: number, each: number): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    const s = line(x, each);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};

export function cleanClass(raw: any): LessonClass | null {
  if (!raw || typeof raw !== "object") return null;
  const id = line(raw.id, 60), name = line(raw.name, 80);
  if (!id || !name) return null;
  return {
    id, name,
    block: line(raw.block, 40),
    subject: line(raw.subject, 60),
    grade: line(raw.grade, 20),
    color: oneOf(raw.color, CLASS_COLORS, "teal"),
    days: strings(raw.days, 5, 3).filter((d) => (WEEKDAYS as readonly string[]).includes(d)),
    room: line(raw.room, 40),
    students: strings(raw.students, LIMITS.rosterPerClass, 80),
  };
}

export function cleanClasses(raw: unknown): LessonClass[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: LessonClass[] = [];
  for (const r of raw) {
    const c = cleanClass(r);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= LIMITS.classes) break;
  }
  return out;
}

export function cleanWorksheet(raw: any): GenWorksheet | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const KINDS: ItemKind[] = ["choice", "short", "work", "blank", "truefalse", "graph", "match"];
  const sections: WorksheetSection[] = [];
  for (const s of Array.isArray(raw.sections) ? raw.sections : []) {
    if (!s || typeof s !== "object") continue;
    const items: WorksheetItem[] = [];
    for (const it of Array.isArray(s.items) ? s.items : []) {
      if (!it || typeof it !== "object") continue;
      const prompt = str(it.prompt, 1500).trim();
      const visual = cleanVisual(it.visual);
      if (!prompt && !visual) continue;
      const choices = strings(it.choices, 6, 300);
      const lines = Math.max(0, Math.min(12, Math.round(Number(it.lines) || 0)));
      const kind = KINDS.includes(it.kind) ? it.kind as ItemKind : choices.length >= 2 ? "choice" : undefined;
      const keyVisual = cleanVisual(it.keyVisual);
      const matches = strings(it.matches, 12, 200);
      const space = ["small", "medium", "large"].includes(it.space) ? it.space : undefined;
      items.push({ prompt, answer: str(it.answer, 1500).trim(), ...(kind ? { kind } : {}), ...(choices.length >= 2 ? { choices } : {}), ...(lines ? { lines } : {}), ...(space ? { space } : {}), ...(visual ? { visual } : {}), ...(keyVisual ? { keyVisual } : {}), ...(matches.length ? { matches } : {}) });
      if (items.length >= LIMITS.worksheetItems) break;
    }
    if (!items.length) continue;
    const passage = str(s.passage, 6000).trim();
    const wordBank = strings(s.wordBank, 30, 60);
    const columns = Math.max(1, Math.min(4, Math.round(Number(s.columns) || 1)));
    sections.push({ heading: line(s.heading, 160) || `Part ${sections.length + 1}`, ...(line(s.directions, 600) ? { directions: line(s.directions, 600) } : {}), items,
      ...(passage ? { passage } : {}), ...(wordBank.length ? { wordBank } : {}), ...(columns > 1 ? { columns } : {}) });
    if (sections.length >= LIMITS.worksheetSections) break;
  }
  if (!sections.length) return undefined;
  return { title: line(raw.title, 160) || "Worksheet", instructions: str(raw.instructions, 800).trim(), sections,
    ...(raw.large ? { large: true } : {}), ...(raw.score === false ? { score: false } : {}), ...(line(raw.grade, 20) ? { grade: line(raw.grade, 20) } : {}), ...(line(raw.subject, 60) ? { subject: line(raw.subject, 60) } : {}) };
}

export function cleanSlides(raw: unknown): GenSlide[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: GenSlide[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const title = line((s as any).title, 160);
    const bullets = strings((s as any).bullets, 8, 300);
    if (!title && !bullets.length) continue;
    const notes = str((s as any).notes, 1500).trim();
    out.push({ title: title || `Slide ${out.length + 1}`, bullets, ...(notes ? { notes } : {}) });
    if (out.length >= LIMITS.slides) break;
  }
  return out.length ? out : undefined;
}

export function cleanMaterial(raw: any): LessonMaterial | null {
  if (!raw || typeof raw !== "object") return null;
  const id = line(raw.id, 60);
  if (!id) return null;
  const kind = oneOf(raw.kind, MATERIAL_KINDS, "other");
  const path = line(raw.path, 300);
  const url = /^https?:\/\//i.test(String(raw.url || "")) ? line(raw.url, 1000) : "";
  const worksheet = cleanWorksheet(raw.worksheet);
  const slides = cleanSlides(raw.slides);
  if (!path && !url && !worksheet && !slides) return null;
  const size = Number(raw.size);
  return {
    id, kind, name: line(raw.name, 160) || MATERIAL_LABEL[kind],
    ...(path ? { path, size: Number.isFinite(size) && size > 0 ? Math.floor(size) : 0, contentType: line(raw.contentType, 100) || "application/octet-stream" } : {}),
    ...(url ? { url } : {}),
    ...(worksheet ? { worksheet } : {}),
    ...(slides ? { slides } : {}),
    ...(line(raw.addedAt, 40) ? { addedAt: line(raw.addedAt, 40) } : {}),
    ...(line(raw.pair, 60) ? { pair: line(raw.pair, 60) } : {}),
  };
}

function cleanMarks(raw: unknown): Record<string, StudentMark> {
  const out: Record<string, StudentMark> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let n = 0;
  for (const [name, m] of Object.entries(raw as Record<string, any>)) {
    const who = line(name, 80);
    if (!who || !m || typeof m !== "object") continue;
    const mark: StudentMark = {};
    if ((CHECKS as readonly string[]).includes(m.status)) mark.status = m.status;
    if (line(m.score, 20)) mark.score = line(m.score, 20);
    if (str(m.note, 500).trim()) mark.note = str(m.note, 500).trim();
    if (!mark.status && !mark.score && !mark.note) continue;
    out[who] = mark;
    if (++n >= LIMITS.rosterPerClass * 2) break;
  }
  return out;
}

/** A saved lesson made safe to use. Older lessons (title, subject, group, date, objective, materials) come through as they were. */
export function cleanLesson(raw: any): LessonPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const id = line(raw.id, 60);
  if (!id) return null;
  const long = (k: string) => str(raw[k], LIMITS.text);
  const files: LessonMaterial[] = [];
  for (const f of Array.isArray(raw.files) ? raw.files : []) {
    const m = cleanMaterial(f);
    if (m && !files.some((x) => x.id === m.id)) files.push(m);
    if (files.length >= LIMITS.filesPerLesson) break;
  }
  const minutes = Math.round(Number(raw.minutes));
  const out: LessonPlan = {
    id,
    title: line(raw.title, 160) || "Untitled lesson",
    subject: line(raw.subject, 60),
    group: line(raw.group, 80),
    date: day(raw.date),
    objective: long("objective"),
    materials: long("materials"),
    status: oneOf(raw.status, LESSON_STATUSES, "draft"),
    standards: strings(raw.standards, LIMITS.standardsPerLesson, 400),
    files,
    marks: cleanMarks(raw.marks),
  };
  if (line(raw.classId, 60)) out.classId = line(raw.classId, 60);
  if (line(raw.unit, 120)) out.unit = line(raw.unit, 120);
  if (Number.isFinite(minutes) && minutes > 0) out.minutes = Math.min(minutes, 600);
  for (const k of ["summary", "hook", "iDo", "weDo", "youDo", "closure", "vocabulary", "differentiation", "assessment", "homework", "reflection"] as const) {
    const v = long(k);
    if (v.trim()) out[k] = v;
  }
  if (line(raw.reteachOf, 60)) out.reteachOf = line(raw.reteachOf, 60);
  const forStudents = strings(raw.forStudents, LIMITS.rosterPerClass, 80);
  if (forStudents.length) out.forStudents = forStudents;
  return out;
}

export function cleanLessons(raw: unknown): LessonPlan[] {
  if (!Array.isArray(raw)) return [];
  const out: LessonPlan[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const l = cleanLesson(r);
    if (!l || seen.has(l.id)) continue;
    seen.add(l.id);
    out.push(l);
    if (out.length >= LIMITS.lessons) break;
  }
  return out;
}

// ─── Dates ──────────────────────────────────────────────────────────────────

const utc = (d: string) => new Date(`${d}T12:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (d: string, n: number): string => { const x = utc(d); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
/** "Mon".."Sun" for a day. */
export const weekdayOf = (d: string): string => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][utc(d).getUTCDay()];
/** The Monday of the week a day is in. */
export const mondayOf = (d: string): string => { const dow = utc(d).getUTCDay(); return addDays(d, dow === 0 ? -6 : 1 - dow); };
/** Monday to Friday of the week a day is in. */
export const schoolWeek = (d: string): string[] => { const m = mondayOf(d); return [0, 1, 2, 3, 4].map((i) => addDays(m, i)); };
/** Every day shown on a month calendar (Mon-start weeks, school days only), the month being the one `d` is in. */
export function monthWeeks(d: string): string[][] {
  const first = `${d.slice(0, 7)}-01`;
  const weeks: string[][] = [];
  let monday = mondayOf(first);
  while (true) {
    const week = schoolWeek(monday);
    if (week[0].slice(0, 7) > d.slice(0, 7)) break;
    if (week.some((x) => x.slice(0, 7) === d.slice(0, 7))) weeks.push(week);
    monday = addDays(monday, 7);
    if (weeks.length > 6) break;
  }
  return weeks;
}
export const addMonths = (d: string, n: number): string => {
  const x = utc(`${d.slice(0, 7)}-01`);
  x.setUTCMonth(x.getUTCMonth() + n);
  return iso(x);
};

/** Does a class meet on this day? */
export const meetsOn = (c: Pick<LessonClass, "days">, d: string): boolean => {
  const w = weekdayOf(d);
  if (w === "Sat" || w === "Sun") return false;
  return !c.days.length || c.days.includes(w);
};

/** The next `count` days a class meets, starting on `from` (included), skipping days in `skip`. */
export function nextMeetings(c: Pick<LessonClass, "days">, from: string, count: number, skip: Set<string> = new Set()): string[] {
  const out: string[] = [];
  let d = from;
  for (let guard = 0; out.length < count && guard < 800; guard++) {
    if (meetsOn(c, d) && !skip.has(d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

// ─── Reading the plan ───────────────────────────────────────────────────────

/** The class a lesson belongs to, matched by id, or by its older free-typed group name. */
export function classOf(lesson: Pick<LessonPlan, "classId" | "group">, classes: LessonClass[]): LessonClass | undefined {
  if (lesson.classId) { const c = classes.find((x) => x.id === lesson.classId); if (c) return c; }
  const g = (lesson.group || "").trim().toLowerCase();
  return g ? classes.find((x) => x.name.trim().toLowerCase() === g) : undefined;
}

/** The roster for a lesson: its reteach group, else its class's students. */
export const rosterOf = (lesson: LessonPlan, classes: LessonClass[]): string[] =>
  lesson.forStudents?.length ? lesson.forStudents : classOf(lesson, classes)?.students ?? Object.keys(lesson.marks || {});

/** How many parts of the plan are filled in, out of how many — shown as a little progress ring. */
export function planFullness(l: LessonPlan): { done: number; of: number } {
  const parts = [l.objective, l.hook, l.iDo, l.weDo, l.youDo, l.closure, l.assessment, l.differentiation, l.materials || (l.files?.length ? "x" : ""), l.standards?.length ? "x" : ""];
  return { done: parts.filter((p) => (p || "").trim()).length, of: parts.length };
}

export type StudentRecord = {
  name: string;
  counts: Record<LessonCheck, number>;
  /** Lessons where they need a reteach and no reteach lesson for them has been taught since. */
  openReteach: { lessonId: string; title: string; date: string; standards: string[]; note?: string }[];
  /** Recent marks, newest first. */
  history: { lessonId: string; title: string; date: string; mark: StudentMark }[];
};

/**
 * Every student's record across a class's lessons (or all lessons when classId is ""):
 * how often they mastered, did good, needed a reteach or were absent, and which reteaches are still open.
 * A reteach is closed once a later lesson reteaching it marks the student mastered or did good.
 */
export function studentRecords(lessons: LessonPlan[], classes: LessonClass[], classId: string): StudentRecord[] {
  const scoped = lessons.filter((l) => !classId || classOf(l, classes)?.id === classId);
  const names = new Set<string>();
  if (classId) for (const n of classes.find((c) => c.id === classId)?.students ?? []) names.add(n);
  else for (const c of classes) for (const n of c.students) names.add(n);
  for (const l of scoped) for (const n of Object.keys(l.marks || {})) names.add(n);
  const closed = new Set<string>();
  for (const l of scoped) {
    if (!l.reteachOf) continue;
    for (const [n, m] of Object.entries(l.marks || {})) if (m.status === "mastered" || m.status === "good") closed.add(`${l.reteachOf}|${n}`);
  }
  const byDate = [...scoped].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => {
    const counts: Record<LessonCheck, number> = { mastered: 0, good: 0, reteach: 0, absent: 0 };
    const history: StudentRecord["history"] = [];
    const openReteach: StudentRecord["openReteach"] = [];
    for (const l of byDate) {
      const mark = l.marks?.[name];
      if (!mark) continue;
      if (mark.status) counts[mark.status]++;
      history.push({ lessonId: l.id, title: l.title, date: l.date, mark });
      if (mark.status === "reteach" && !closed.has(`${l.id}|${name}`)) openReteach.push({ lessonId: l.id, title: l.title, date: l.date, standards: l.standards || [], ...(mark.note ? { note: mark.note } : {}) });
    }
    return { name, counts, openReteach, history };
  });
}

/** The students who still need a reteach of one lesson. */
export function needsReteach(lesson: LessonPlan, lessons: LessonPlan[]): string[] {
  const closed = new Set<string>();
  for (const l of lessons) if (l.reteachOf === lesson.id) for (const [n, m] of Object.entries(l.marks || {})) if (m.status === "mastered" || m.status === "good") closed.add(n);
  return Object.entries(lesson.marks || {}).filter(([n, m]) => m.status === "reteach" && !closed.has(n)).map(([n]) => n);
}

/** A copy of a lesson for another day (or class), without the student marks or reflection. */
export function copyLesson(l: LessonPlan, id: string, changes: Partial<LessonPlan> = {}): LessonPlan {
  const { marks: _m, reflection: _r, ...rest } = l;
  return { ...rest, id, status: l.status === "taught" ? "ready" : l.status, marks: {}, files: (l.files || []).map((f) => ({ ...f })), ...changes };
}

/**
 * Moves every lesson of a class on or after `from` later by `by` meeting days (a snow day, an assembly).
 * Lessons keep their order and land only on days the class meets.
 */
export function bumpLessons(lessons: LessonPlan[], classes: LessonClass[], classId: string, from: string, by: number): LessonPlan[] {
  const c = classes.find((x) => x.id === classId);
  if (!c || !by) return lessons;
  const moving = lessons.filter((l) => classOf(l, classes)?.id === classId && l.date && l.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  if (!moving.length) return lessons;
  const span = nextMeetings(c, from, moving.length + Math.abs(by) + 200);
  const index = (d: string) => span.indexOf(d);
  const moved = new Map<string, string>();
  for (const l of moving) {
    let i = index(l.date);
    if (i < 0) i = span.findIndex((d) => d >= l.date);
    const j = Math.max(0, i + by);
    if (j < span.length) moved.set(l.id, span[j]);
  }
  return lessons.map((l) => (moved.has(l.id) ? { ...l, date: moved.get(l.id)! } : l));
}

// ─── What the AI answers ────────────────────────────────────────────────────

export const AI_MODES = ["ideas", "build", "standards", "worksheet", "slides", "unit", "reteach"] as const;
export type AiMode = (typeof AI_MODES)[number];

export type LessonIdea = { title: string; summary: string; activity: string };
export type FoundStandard = { code: string; text: string };
export type UnitLesson = { title: string; objective: string; standards: string[]; summary: string };

/** The plan parts the AI may fill in on "build" and "reteach". */
export const PLAN_FIELDS = ["title", "objective", "hook", "iDo", "weDo", "youDo", "closure", "vocabulary", "differentiation", "assessment", "homework", "materials"] as const;
export type PlanFields = Partial<Record<(typeof PLAN_FIELDS)[number], string>> & { standards?: string[]; minutes?: number };

export const PLAN_LABEL: Record<(typeof PLAN_FIELDS)[number], string> = {
  title: "Title", objective: "Objective (students will be able to…)", hook: "Warm-up / hook", iDo: "I do (teach and model)", weDo: "We do (guided practice)",
  youDo: "You do (independent practice)", closure: "Closure / exit ticket", vocabulary: "Key vocabulary", differentiation: "Differentiation & accommodations",
  assessment: "Assessment / checking for understanding", homework: "Homework / extension", materials: "Materials & prep",
};

export function cleanPlanFields(raw: any): PlanFields {
  const out: PlanFields = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of PLAN_FIELDS) {
    const v = raw[k];
    const text = Array.isArray(v) ? v.map((x) => `• ${line(x, 600)}`).filter((x) => x.length > 2).join("\n") : str(v, LIMITS.text).trim();
    if (text) out[k] = k === "title" ? line(text, 160) : text;
  }
  const standards = strings(raw.standards, LIMITS.standardsPerLesson, 400);
  if (standards.length) out.standards = standards;
  const minutes = Math.round(Number(raw.minutes));
  if (Number.isFinite(minutes) && minutes > 0 && minutes <= 600) out.minutes = minutes;
  return out;
}

export function cleanIdeas(raw: any): LessonIdea[] {
  const list = Array.isArray(raw?.ideas) ? raw.ideas : [];
  return list.map((i: any) => ({ title: line(i?.title, 160), summary: str(i?.summary, 800).trim(), activity: str(i?.activity, 800).trim() }))
    .filter((i: LessonIdea) => i.title).slice(0, 8);
}

export function cleanFoundStandards(raw: any): FoundStandard[] {
  const list = Array.isArray(raw?.standards) ? raw.standards : [];
  const seen = new Set<string>();
  const out: FoundStandard[] = [];
  for (const s of list) {
    const code = line(s?.code, 60), text = line(s?.text, 600);
    if (!code || !text || seen.has(code.toLowerCase())) continue;
    seen.add(code.toLowerCase());
    out.push({ code, text });
    if (out.length >= 15) break;
  }
  return out;
}

export function cleanUnit(raw: any): { unit: string; lessons: UnitLesson[] } {
  const lessons = (Array.isArray(raw?.lessons) ? raw.lessons : []).map((l: any) => ({
    title: line(l?.title, 160), objective: str(l?.objective, 1000).trim(), standards: strings(l?.standards, 6, 400), summary: str(l?.summary, 1500).trim(),
  })).filter((l: UnitLesson) => l.title).slice(0, 40);
  return { unit: line(raw?.unit, 120), lessons };
}

/** How a standard is shown and saved: "CODE — text", or just what was typed. */
export const standardLine = (s: FoundStandard): string => `${s.code} — ${s.text}`;
/** The code part of a saved standard ("RL.5.2"), for a chip. */
export const standardCode = (s: string): string => (s.includes(" — ") ? s.split(" — ")[0] : s.length > 18 ? `${s.slice(0, 16)}…` : s);
