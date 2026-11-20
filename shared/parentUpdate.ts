// Arise WorkHub: the weekly parent update. The teacher picks a student and a week, and the update is written
// from what is already saved: the Minutes page (push-in class notes: how each student did, participation,
// behavior and a note; the logged minutes and their notes) and the Lessons page (each lesson's student marks).
// It comes out as an email (with a subject) or a short text, ready to copy. Nothing here is sent anywhere.
// The page is client/src/components/teacher-hub/HubParentUpdate.tsx.
import {
  BEHAVIOR_MARKS, PARTICIPATION, cleanLessons, schoolWeek,
  type BehaviorMark, type LessonCheck, type Participation,
} from "./lessonPlanner";
import { cleanPushInNotes, fold } from "./pushIn";
import type { Assignment, AttendanceEntry, BehaviorEntry, GradeScore, ServiceLog } from "./teacherHub";
import { cleanGradePlans, retakeWords } from "./gradePlans";

export type UpdateFormat = "email" | "text";

/** The parts of the update a teacher can leave out. */
export const UPDATE_PARTS = [
  { id: "lessons", label: "What we worked on" },
  { id: "progress", label: "How it went" },
  { id: "participation", label: "Participation" },
  { id: "behavior", label: "Behavior" },
  { id: "notes", label: "My notes" },
  { id: "minutes", label: "Support minutes" },
  { id: "grades", label: "Grades: missing & failed" },
] as const;
export type UpdatePart = (typeof UPDATE_PARTS)[number]["id"];
export const DEFAULT_PARTS: Record<UpdatePart, boolean> = { lessons: true, progress: true, participation: true, behavior: true, notes: true, minutes: false, grades: true };

/** One lesson or class the student was in that week, with how they did. */
export type WeekEntry = {
  date: string;
  /** Where it came from: a lesson plan, or a push-in class note on the Minutes page. */
  source: "lesson" | "class";
  title: string;
  subject?: string;
  status?: LessonCheck;
  score?: string;
  participation?: Participation;
  behavior?: BehaviorMark;
  note?: string;
};

export type WeekFacts = {
  student: string;
  /** Monday and Friday of the week, "YYYY-MM-DD". */
  from: string;
  to: string;
  entries: WeekEntry[];
  /** Minutes of support logged, and in how many sessions. */
  minutes: number;
  sessions: number;
  /** Notes typed on the logged minutes. */
  logNotes: { date: string; note: string }[];
  /** Behavior points from the Behavior page, and attendance that was not "Present". */
  points: { date: string; points: number; reason: string }[];
  attendance: { date: string; status: AttendanceEntry["status"] }[];
  /** Grades: work missing or failed (from the Gradebook and Grade Plans), and a retake that is set. */
  grades: GradeFacts;
};
export type GradeItem = { title: string; subject?: string; score?: string };
export type GradeFacts = { missing: GradeItem[]; failed: GradeItem[]; retakes: string[] };

const inWeek = (d: string, from: string, to: string) => !!d && d >= from && d <= to;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

/** The Monday and Friday of the school week a day falls in. */
export function weekOf(day: string): { from: string; to: string } {
  const w = schoolWeek(day);
  return { from: w[0], to: w[4] };
}

/** Everything saved about one student in one week, oldest first. */
export function gatherWeek(student: string, from: string, to: string, src: { pushInNotes?: unknown; lessons?: unknown; serviceLogs?: ServiceLog[]; behavior?: BehaviorEntry[]; attendance?: AttendanceEntry[]; assignments?: Assignment[]; gradeScores?: GradeScore[]; gradePlans?: unknown }): WeekFacts {
  const who = fold(student);
  const entries: WeekEntry[] = [];
  for (const n of cleanPushInNotes(src.pushInNotes)) {
    if (!inWeek(n.date, from, to)) continue;
    const e = n.students.find((s) => fold(s.student) === who);
    if (!e) continue;
    entries.push({
      date: n.date, source: "class", title: n.title || n.subject || "Class", ...(n.subject ? { subject: n.subject } : {}),
      ...(e.status ? { status: e.status } : {}), ...(e.participation ? { participation: e.participation } : {}),
      ...(e.behavior ? { behavior: e.behavior } : {}), ...(e.note?.trim() ? { note: e.note.trim() } : {}),
    });
  }
  for (const l of cleanLessons(src.lessons)) {
    if (!inWeek(l.date, from, to)) continue;
    const key = Object.keys(l.marks || {}).find((k) => fold(k) === who);
    if (!key) continue;
    const m = l.marks![key];
    entries.push({
      date: l.date, source: "lesson", title: l.title || l.subject || "Lesson", ...(l.subject ? { subject: l.subject } : {}),
      ...(m.status ? { status: m.status } : {}), ...(m.score ? { score: m.score } : {}), ...(m.participation ? { participation: m.participation } : {}),
      ...(m.behavior ? { behavior: m.behavior } : {}), ...(m.note?.trim() ? { note: m.note.trim() } : {}),
    });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  let minutes = 0, sessions = 0;
  const logNotes: { date: string; note: string }[] = [];
  for (const g of src.serviceLogs || []) {
    if (fold(g.student) !== who || !inWeek(g.date, from, to)) continue;
    if (g.notMet) continue;
    minutes += Number(g.minutes) || 0;
    sessions += 1;
    if (g.note?.trim()) logNotes.push({ date: g.date, note: g.note.trim() });
  }
  logNotes.sort((a, b) => a.date.localeCompare(b.date));
  const points = (src.behavior || []).filter((b) => fold(b.student) === who && inWeek(b.date, from, to))
    .map((b) => ({ date: b.date, points: Number(b.points) || 0, reason: String(b.reason || "").trim() })).sort((a, b) => a.date.localeCompare(b.date));
  const attendance = (src.attendance || []).filter((a) => fold(a.student) === who && inWeek(a.date, from, to) && a.status !== "Present")
    .map((a) => ({ date: a.date, status: a.status })).sort((a, b) => a.date.localeCompare(b.date));
  return { student, from, to, entries, minutes, sessions, logNotes, points, attendance, grades: gatherGrades(student, from, to, src) };
}

/**
 * What a student has missing or failed: Gradebook work dated this week (missing, or under 60%), and
 * Grade Plans work that is still open or was planned this week, with the retake time when one is set.
 */
export function gatherGrades(student: string, from: string, to: string, src: { assignments?: Assignment[]; gradeScores?: GradeScore[]; gradePlans?: unknown }): GradeFacts {
  const who = fold(student);
  const out: GradeFacts = { missing: [], failed: [], retakes: [] };
  const seen = new Set<string>();
  const add = (kind: "missing" | "failed", item: GradeItem) => { const k = fold(item.title); if (!k || seen.has(k)) return; seen.add(k); out[kind].push(item); };
  const byId = new Map((src.assignments || []).map((a) => [a.id, a]));
  for (const g of src.gradeScores || []) {
    if (fold(g.student) !== who || g.excused) continue;
    const a = byId.get(g.assignmentId);
    if (!a || !inWeek(a.date, from, to)) continue;
    if (g.missing) add("missing", { title: a.title, ...(a.category ? { subject: a.category } : {}) });
    else if (g.score != null && a.points > 0 && g.score / a.points < 0.6) add("failed", { title: a.title, ...(a.category ? { subject: a.category } : {}), score: `${Math.round((g.score / a.points) * 100)}%` });
  }
  for (const p of cleanGradePlans(src.gradePlans)) {
    if (fold(p.student) !== who) continue;
    const made = p.createdAt.slice(0, 10);
    if (p.status === "done" && !inWeek(made, from, to)) continue;
    for (const c of p.concerns) add(c.kind === "missing" ? "missing" : "failed", { title: c.assignment, ...(c.subject ? { subject: c.subject } : {}), ...(c.score && c.kind !== "missing" ? { score: c.score } : {}) });
    if (p.retake && p.status !== "done") out.retakes.push(retakeWords(p.retake));
  }
  return out;
}

const gradeItem = (g: GradeItem) => `${g.title}${g.subject ? ` (${g.subject})` : ""}${g.score ? `: ${g.score}` : ""}`;
/** The grades part of the update, as bullet lines (email) or one sentence (text). */
function gradeLines(g: GradeFacts, name: string): string[] {
  return [
    g.missing.length ? `Missing: ${g.missing.map(gradeItem).join("; ")}` : "",
    g.failed.length ? `Below passing: ${g.failed.map(gradeItem).join("; ")}` : "",
    g.retakes.length ? `${name} will make it up with me on ${g.retakes.join(" and ")}.` : "",
  ].filter(Boolean);
}

/** How many things are saved for the week: class notes, lessons, logged sessions, behavior points and attendance. */
export const weekCount = (f: WeekFacts) => f.entries.length + f.sessions + f.points.length + f.attendance.length + (f.grades ? f.grades.missing.length + f.grades.failed.length : 0);

/** True when nothing at all was saved for the week. */
export const isEmptyWeek = (f: WeekFacts) => !f.entries.length && !f.sessions && !f.logNotes.length && !f.points.length && !f.attendance.length;

// ─── Words ──────────────────────────────────────────────────────────────────

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const monthDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** "A", "A and B", "A, B and C". */
export function listWords(items: string[]): string {
  const xs = [...new Set(items.map((x) => x.trim()).filter(Boolean))];
  if (xs.length <= 1) return xs[0] || "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}
const sentence = (s: string) => { const t = s.trim(); return t && !/[.!?]$/.test(t) ? `${t}.` : t; };

/**
 * The week's overall mark from a list: the most common, scored great = 2, middle = 1, low = 0 and averaged.
 * `all` is true when every mark is the same.
 */
function overall<T extends string>(marks: T[], order: readonly T[]): { level: T; all: boolean } | null {
  if (!marks.length) return null;
  const score = marks.reduce((n, m) => n + (2 - order.indexOf(m)), 0) / marks.length;
  const level = score >= 1.5 ? order[0] : score >= 0.75 ? order[1] : order[2];
  return { level, all: marks.every((m) => m === marks[0]) };
}

function participationLine(f: WeekFacts, name: string): string {
  const o = overall(f.entries.map((e) => e.participation).filter((x): x is Participation => !!x), PARTICIPATION);
  if (!o) return "";
  if (o.level === "great") return `${name} participated actively in class ${o.all ? "all week" : "most days"}, answering questions and joining in.`;
  if (o.level === "some") return `${name} participated some of the time this week. We're encouraging ${name} to join in even more.`;
  return `${name} was on the quiet side in class this week. We're working on helping ${name} join in and share answers more.`;
}

function pointsLine(f: WeekFacts, name: string): string {
  if (!f.points.length) return "";
  const earned = f.points.filter((p) => p.points > 0), lost = f.points.filter((p) => p.points < 0);
  const why = (xs: typeof f.points) => listWords(xs.map((p) => p.reason.toLowerCase()).filter(Boolean).slice(0, 4));
  const out: string[] = [];
  if (earned.length) { const n = earned.reduce((t, p) => t + p.points, 0); out.push(`${name} earned ${n} behavior ${n === 1 ? "point" : "points"} this week${why(earned) ? ` for ${why(earned)}` : ""}.`); }
  if (lost.length) out.push(`${name} also had ${lost.length === 1 ? "a moment" : "a few moments"} we're working on${why(lost) ? ` (${why(lost)})` : ""}.`);
  return out.join(" ");
}

function attendanceLine(f: WeekFacts, name: string): string {
  const n = (s: string) => f.attendance.filter((a) => a.status === s).length;
  const bits = [n("Absent") + n("Excused") ? `absent ${n("Absent") + n("Excused") === 1 ? "one day" : `${n("Absent") + n("Excused")} days`}` : "", n("Tardy") ? `late ${n("Tardy") === 1 ? "once" : `${n("Tardy")} times`}` : ""].filter(Boolean);
  return bits.length ? `${name} was ${bits.join(" and ")} this week.` : "";
}

function behaviorLine(f: WeekFacts, name: string): string {
  const o = overall(f.entries.map((e) => e.behavior).filter((x): x is BehaviorMark => !!x), BEHAVIOR_MARKS);
  if (!o) return pointsLine(f, name);
  const pts = pointsLine(f, name);
  if (pts) return `${behaviorWords(o, name)} ${pts}`;
  return behaviorWords(o, name);
}

function behaviorWords(o: { level: BehaviorMark; all: boolean }, name: string): string {
  if (o.level === "great") return `${name}'s behavior was great ${o.all ? "all week" : "on most days"}.`;
  if (o.level === "ok") return `${name}'s behavior was mostly good this week.`;
  return `${name} had some tough moments with behavior this week. We're working on it together, and your support at home helps a lot.`;
}

function progressLines(f: WeekFacts, name: string): string[] {
  const by = (s: LessonCheck) => f.entries.filter((e) => e.status === s).map((e) => e.title);
  const out: string[] = [];
  const mastered = by("mastered"), good = by("good"), reteach = by("reteach"), absent = by("absent");
  if (mastered.length) out.push(`${name} showed mastery on ${listWords(mastered)}.`);
  if (good.length) out.push(`${name} did well on ${listWords(good)}.`);
  if (reteach.length) out.push(`We'll be reviewing ${listWords(reteach)} with ${name} to make sure it sticks.`);
  const scores = f.entries.filter((e) => e.score).map((e) => `${e.title} (${e.score})`);
  if (scores.length) out.push(`Scores: ${listWords(scores)}.`);
  if (absent.length) out.push(`${name} was absent for ${absent.length === 1 ? "one class" : `${absent.length} classes`} this week.`);
  return out;
}

const minutesLine = (f: WeekFacts, name: string) =>
  f.sessions ? `${name} received ${f.minutes} minutes of support across ${f.sessions} ${f.sessions === 1 ? "session" : "sessions"} this week.` : "";

/** The teacher's own notes, as written, oldest first. */
function noteItems(f: WeekFacts): { date: string; title: string; note: string }[] {
  const seen = new Set<string>();
  const out: { date: string; title: string; note: string }[] = [];
  for (const e of f.entries) if (e.note && !seen.has(fold(e.note))) { seen.add(fold(e.note)); out.push({ date: e.date, title: e.title, note: e.note }); }
  for (const n of f.logNotes) if (!seen.has(fold(n.note))) { seen.add(fold(n.note)); out.push({ date: n.date, title: "", note: n.note }); }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type UpdateOptions = {
  format: UpdateFormat;
  parts: Record<UpdatePart, boolean>;
  /** How the teacher signs: "Mr. J". */
  teacher: string;
  /** The teacher's position: "special education math teacher". */
  role?: string;
  /** Who it is to: "Ms. Lopez". Blank says "Hi there". */
  guardian?: string;
};

/** The update, written. `subject` is empty for a text. */
export function writeUpdate(f: WeekFacts, o: UpdateOptions): { subject: string; body: string } {
  const name = firstName(f.student);
  const teacher = o.teacher.trim() || "[your name]";
  const role = o.role?.trim();
  const hi = `Hi ${o.guardian?.trim() || "there"},`;
  const week = f.from.slice(0, 7) === f.to.slice(0, 7) ? `${monthDay(f.from)}–${Number(f.to.slice(8))}` : `${monthDay(f.from)}–${monthDay(f.to)}`;
  const lessons = listWords(f.entries.filter((e) => e.status !== "absent").map((e) => e.title));
  const progress = o.parts.progress ? progressLines(f, name) : [];
  const participation = o.parts.participation ? participationLine(f, name) : "";
  const behavior = o.parts.behavior ? behaviorLine(f, name) : "";
  const attendance = o.parts.progress ? attendanceLine(f, name) : "";
  const minutes = o.parts.minutes ? minutesLine(f, name) : "";
  const notes = o.parts.notes ? noteItems(f) : [];
  const grades = o.parts.grades && f.grades ? gradeLines(f.grades, name) : [];
  const nothing = !(o.parts.lessons && lessons) && !progress.length && !attendance && !participation && !behavior && !minutes && !notes.length && !grades.length;

  if (o.format === "text") {
    const bits = [
      `${hi.replace(/,$/, "")}, this is ${teacher}${role ? `, ${name}'s ${role}` : ""}, with ${name}'s update for this week.`,
      o.parts.lessons && lessons ? `We worked on ${lessons}.` : "",
      ...progress, attendance, participation, behavior, minutes,
      ...notes.slice(0, 3).map((n) => sentence(n.note)),
      ...grades.map((l) => sentence(l)),
      nothing ? "[Add a highlight from this week.]" : "",
      "Thank you for your support at home!",
    ];
    return { subject: "", body: bits.filter(Boolean).join(" ") };
  }

  const how = [...progress, attendance, participation, behavior, minutes].filter(Boolean);
  const blocks = [
    hi,
    `This is ${teacher}${role ? `, ${name}'s ${role}` : ""}. Here's ${name}'s update for the week of ${week}.`,
    o.parts.lessons && lessons ? `This week we worked on: ${lessons}.` : "",
    how.length ? `How it went:\n${how.map((l) => `• ${l}`).join("\n")}` : "",
    notes.length ? `Notes from class:\n${notes.map((n) => `• ${shortDay(n.date)}${n.title ? ` (${n.title})` : ""}: ${sentence(n.note)}`).join("\n")}` : "",
    grades.length ? `Grades to know about:\n${grades.map((l) => `• ${l}`).join("\n")}` : "",
    nothing ? "[Add a highlight from this week.]" : "",
    "Thank you for your support at home. Please reach out anytime with questions.",
    teacher,
  ];
  return { subject: `${name}'s weekly update – week of ${monthDay(f.from)}`, body: blocks.filter(Boolean).join("\n\n") };
}

/** Everyone the teacher could write about: the caseload, the class notes, the lessons' marks and the logged minutes. */
export function updateStudents(ws: { students?: { name: string }[]; pushInNotes?: unknown; lessons?: unknown; serviceLogs?: ServiceLog[] }): string[] {
  const seen = new Map<string, string>();
  const add = (n: unknown) => { const s = typeof n === "string" ? n.trim() : ""; if (s && !seen.has(fold(s))) seen.set(fold(s), s); };
  for (const s of ws.students || []) add(s?.name);
  for (const n of cleanPushInNotes(ws.pushInNotes)) for (const s of n.students) add(s.student);
  for (const l of cleanLessons(ws.lessons)) for (const k of Object.keys(l.marks || {})) add(k);
  for (const g of ws.serviceLogs || []) add(g.student);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
