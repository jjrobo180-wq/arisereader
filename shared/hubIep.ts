// Arise WorkHub: the IEP page. Everything a case manager keeps for an IEP in one place: meeting notes
// (IEP, reevaluation, annual review…), accommodations, progress monitoring on a schedule (with
// reminders when a check is close), files and worksheets for each check, and the dates that are coming up.
import { addDays, daysBetween } from "./hubDates";
import type { Goal, Student, Workspace } from "./teacherHub";

// ─── Meeting notes ───────────────────────────────────────────────────────────

export const IEP_NOTE_KINDS = ["IEP meeting", "Annual review", "Reevaluation", "Amendment", "Eligibility", "Parent conference", "Push-in class", "Pull-out class", "Other"] as const;
export type IepNoteKind = (typeof IEP_NOTE_KINDS)[number];

/** The sections each kind of note starts with. Anything can be left blank. */
export const NOTE_SECTIONS: Record<IepNoteKind, string[]> = {
  "IEP meeting": ["Who attended", "Strengths and present levels", "Parent and student input", "Goals reviewed or added", "Accommodations and modifications", "Services and minutes", "Decisions", "Next steps"],
  "Annual review": ["Who attended", "Progress on last year's goals", "Present levels", "Parent and student input", "New goals", "Accommodations", "Services and minutes", "Next steps"],
  Reevaluation: ["Who attended", "Reason for reevaluation", "Assessments given", "Results", "Eligibility decision", "Parent input", "Next steps"],
  Amendment: ["Who attended", "What is changing", "Why", "Parent agreement", "Next steps"],
  Eligibility: ["Who attended", "Data reviewed", "Eligibility category", "Decision", "Next steps"],
  "Parent conference": ["Who attended", "Concerns raised", "What was shared", "Agreed next steps"],
  "Push-in class": ["Class and teacher", "What we worked on", "How the students did", "Supports given", "Next time"],
  "Pull-out class": ["Group", "Skill worked on", "How the students did", "Data collected", "Next time"],
  Other: ["Notes"],
};

export type IepNote = {
  id: string; student: string; kind: IepNoteKind; date: string;
  /** The answer under each section heading. */
  sections: Record<string, string>;
  /** The meeting on the timeline it belongs to, if any. */
  meetingId?: string;
  updatedAt: string;
};

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function cleanIepNotes(raw: unknown): IepNote[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n) => n && typeof n === "object" && typeof n.id === "string" && n.id).slice(0, 2000).map((n: any): IepNote => {
    const kind: IepNoteKind = (IEP_NOTE_KINDS as readonly string[]).includes(n.kind) ? n.kind : "Other";
    const sections: Record<string, string> = {};
    if (n.sections && typeof n.sections === "object") for (const [k, v] of Object.entries(n.sections).slice(0, 30)) sections[str(k, 80)] = str(v, 6000);
    return { id: str(n.id, 60), student: str(n.student, 80), kind, date: isDate(n.date) ? n.date : "", sections, ...(typeof n.meetingId === "string" && n.meetingId ? { meetingId: str(n.meetingId, 60) } : {}), updatedAt: str(n.updatedAt, 40) };
  });
}

/** A new note of this kind, with its sections empty. */
export const newIepNote = (id: string, student: string, kind: IepNoteKind, date: string, meetingId?: string): IepNote =>
  ({ id, student, kind, date, sections: Object.fromEntries(NOTE_SECTIONS[kind].map((s) => [s, ""])), ...(meetingId ? { meetingId } : {}), updatedAt: new Date().toISOString() });

/** The note as plain text, to copy into the IEP system or an email. */
export function noteText(n: IepNote): string {
  const head = `${n.kind}${n.student ? ` · ${n.student}` : ""}${n.date ? ` · ${n.date}` : ""}`;
  const body = Object.entries(n.sections).filter(([, v]) => v.trim()).map(([k, v]) => `${k}\n${v.trim()}`);
  return [head, ...body].join("\n\n");
}

// ─── Accommodations ──────────────────────────────────────────────────────────

/** Common accommodations to add with one tap. */
export const COMMON_ACCOMMODATIONS = [
  "Extended time (1.5x)", "Small group testing", "Preferential seating", "Read aloud (tests and directions)", "Directions repeated or clarified",
  "Chunked assignments", "Reduced number of problems", "Graphic organizers", "Calculator", "Multiplication chart", "Word bank", "Notes or study guide provided",
  "Breaks as needed", "Check for understanding", "Speech-to-text", "Text-to-speech", "Copy of class notes", "Frequent feedback", "Visual schedule", "Alternate setting",
] as const;

/** A student's accommodations as a list (they are saved as one piece of text, one per line). */
export function accommodationList(text: unknown): string[] {
  return String(text ?? "").split(/\r?\n|;|•/).map((s) => s.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean).filter((s, i, all) => all.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);
}
export const accommodationText = (list: string[]) => accommodationList(list.join("\n")).join("\n");

// ─── Progress monitoring ─────────────────────────────────────────────────────

/** How often a goal is checked, in days, when the teacher has not said: every two weeks. */
export const DEFAULT_CHECK_DAYS = 14;
export const CHECK_CHOICES = [7, 14, 21, 30, 45] as const;
/** A check this many days away (or less) is "due soon", and gets a reminder. */
export const DUE_SOON_DAYS = 3;

export type PmState = "overdue" | "due soon" | "on schedule" | "met";
export type PmStatus = { state: PmState; next: string; last: string; every: number; daysLeft: number };

export const checkEvery = (g: Pick<Goal, "checkEvery">) => (CHECK_CHOICES as readonly number[]).includes(Number(g.checkEvery)) ? Number(g.checkEvery) : DEFAULT_CHECK_DAYS;

/** When the goal is next checked: its last data point (or its start) plus how often it is checked. */
export function pmStatus(g: Goal, today: string): PmStatus {
  const every = checkEvery(g);
  const last = [...(g.points || [])].map((p) => p.date).filter(isDate).sort().pop() || "";
  const from = last || (isDate(g.startDate) ? g.startDate : today);
  const next = addDays(from, every);
  const daysLeft = daysBetween(today, next) ?? 0;
  const met = (g.points || []).length > 0 && (g.direction === "down" ? g.points[g.points.length - 1].value <= g.target : g.points[g.points.length - 1].value >= g.target);
  const state: PmState = met ? "met" : daysLeft < 0 ? "overdue" : daysLeft <= DUE_SOON_DAYS ? "due soon" : "on schedule";
  return { state, next, last, every, daysLeft };
}

/** The checks waiting, soonest first: overdue, then due soon. */
export function pmDue(goals: Goal[], today: string): { goal: Goal; status: PmStatus }[] {
  return goals.map((goal) => ({ goal, status: pmStatus(goal, today) })).filter((x) => x.status.state === "overdue" || x.status.state === "due soon").sort((a, b) => a.status.next.localeCompare(b.status.next));
}

/** A file kept with a progress check: a scanned worksheet, a probe, a work sample. */
export type PmFile = { id: string; goalId: string; student: string; date: string; name: string; path: string; size: number; contentType: string };
export function cleanPmFiles(raw: unknown): PmFile[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f) => f && typeof f.id === "string" && typeof f.path === "string" && f.path).slice(0, 2000)
    .map((f: any) => ({ id: str(f.id, 60), goalId: str(f.goalId, 60), student: str(f.student, 80), date: isDate(f.date) ? f.date : "", name: str(f.name, 160), path: str(f.path, 300), size: Math.max(0, Number(f.size) || 0), contentType: str(f.contentType, 100) }));
}

/** A printable progress-monitoring data sheet for one goal: the goal, the scale, and rows for each check. */
export function pmSheetHtml(g: Goal, student: Pick<Student, "name" | "grade"> | null, rows = 10): string {
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const pts = [...(g.points || [])].sort((a, b) => a.date.localeCompare(b.date));
  const filled = pts.map((p) => `<tr><td>${esc(p.date)}</td><td>${esc(p.value)} ${esc(g.unit)}</td><td></td><td>${esc(p.note)}</td></tr>`).join("");
  const blank = Array.from({ length: Math.max(0, rows - pts.length) }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>").join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Progress monitoring · ${esc(student?.name || g.student)}</title><style>
body{font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;color:#111;margin:32px}h1{font-size:20px;margin:0 0 4px}small{color:#555}
.goal{margin:16px 0;padding:12px 14px;border:1px solid #ccc;border-radius:8px}.row{display:flex;gap:24px;margin-top:8px}
table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #bbb;padding:8px;text-align:left}th{background:#f3f3f3;font-size:12px;text-transform:uppercase;letter-spacing:.04em}td{height:22px}
</style></head><body><h1>Progress monitoring</h1><small>${esc(student?.name || g.student)}${student?.grade ? ` · Grade ${esc(student.grade)}` : ""} · ${esc(g.area)}</small>
<div class="goal"><b>Goal</b><div>${esc(g.text)}</div><div class="row"><span><b>Baseline:</b> ${esc(g.baseline)} ${esc(g.unit)}</span><span><b>Target:</b> ${esc(g.target)} ${esc(g.unit)}</span>${g.targetDate ? `<span><b>By:</b> ${esc(g.targetDate)}</span>` : ""}<span><b>Check every:</b> ${checkEvery(g)} days</span></div></div>
<table><thead><tr><th style="width:18%">Date</th><th style="width:20%">Score</th><th style="width:20%">Trials / items</th><th>Notes</th></tr></thead><tbody>${filled}${blank}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
}

// ─── What is coming up ───────────────────────────────────────────────────────

export type IepDue = { key: string; student: string; what: string; date: string; daysLeft: number; kind: "iep" | "reeval" | "check" | "meeting" };

/** IEP and reevaluation dates within `days`, progress checks overdue or due soon, and meetings coming up. Soonest first. */
export function iepComingUp(w: Pick<Workspace, "students" | "goals" | "meetings">, today: string, days = 45): IepDue[] {
  const out: IepDue[] = [];
  const left = (d: string) => daysBetween(today, d) ?? 9999;
  for (const s of w.students || []) {
    if (isDate(s.iepDate) && left(s.iepDate) <= days && left(s.iepDate) >= -30) out.push({ key: `iep:${s.id}`, student: s.name, what: "Annual IEP due", date: s.iepDate, daysLeft: left(s.iepDate), kind: "iep" });
    if (isDate(s.reevalDate) && left(s.reevalDate) <= days && left(s.reevalDate) >= -30) out.push({ key: `reeval:${s.id}`, student: s.name, what: "Reevaluation due", date: s.reevalDate, daysLeft: left(s.reevalDate), kind: "reeval" });
  }
  for (const { goal, status } of pmDue(w.goals || [], today)) out.push({ key: `check:${goal.id}`, student: goal.student, what: `${goal.area} progress check`, date: status.next, daysLeft: status.daysLeft, kind: "check" });
  for (const m of w.meetings || []) if (!m.done && isDate((m.date || "").slice(0, 10)) && left(m.date.slice(0, 10)) >= 0 && left(m.date.slice(0, 10)) <= days) out.push({ key: `meeting:${m.id}`, student: m.student, what: m.type || "Meeting", date: m.date.slice(0, 10), daysLeft: left(m.date.slice(0, 10)), kind: "meeting" });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.student.localeCompare(b.student));
}

/**
 * The phone reminders for the IEP page, checked once each morning: a progress check that is due in
 * three days, tomorrow or today (or was missed yesterday), and an IEP or reevaluation date 30, 14, 7
 * and 1 days away. Each is sent once (its key names the day it is for).
 */
export function iepReminders(w: Pick<Workspace, "students" | "goals">, today: string): { key: string; title: string; body: string }[] {
  const out: { key: string; title: string; body: string }[] = [];
  for (const g of w.goals || []) {
    const s = pmStatus(g, today);
    if (s.state === "met" || ![DUE_SOON_DAYS, 1, 0, -1].includes(s.daysLeft)) continue;
    const when = s.daysLeft === 0 ? "today" : s.daysLeft === 1 ? "tomorrow" : s.daysLeft < 0 ? "was due yesterday" : `in ${s.daysLeft} days`;
    out.push({ key: `pm:${g.id}:${s.next}:${s.daysLeft}`, title: `Progress check ${s.daysLeft < 0 ? "missed" : "coming up"}: ${g.student}`, body: `${g.area} goal check ${s.daysLeft < 0 ? when : `is due ${when}`}. Open IEP → Progress to add the score or print a data sheet.` });
  }
  for (const st of w.students || []) for (const [date, what] of [[st.iepDate, "Annual IEP"], [st.reevalDate, "Reevaluation"]] as const) {
    if (!isDate(date)) continue;
    const d = daysBetween(today, date);
    if (d === null || ![30, 14, 7, 1].includes(d)) continue;
    out.push({ key: `iepdate:${st.id}:${what}:${date}:${d}`, title: `${what} for ${st.name} in ${d} day${d === 1 ? "" : "s"}`, body: `Due ${date}. Open IEP to plan the meeting and notes.` });
  }
  return out;
}

// ─── Goal quizzes sent to students as a link ─────────────────────────────────
//
// A teacher sends a goal quiz as a link. The student opens it on any device without signing in,
// answers it, and the score goes into the teacher's WorkHub (the quiz's results and the goals
// measured in %). The link holds the teacher's id and a random code kept on the quiz; turning the
// link off removes the code, so an old link stops working.

export const QUIZ_LINK_ORIGIN = "https://arisetodo.com";
const CODE = /^[A-Za-z0-9]{20,40}$/;
export const isQuizShare = (v: unknown): v is string => typeof v === "string" && CODE.test(v);

/** A new random code for a quiz link. */
export function newQuizShare(random: (n: number) => Uint8Array): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(random(24), (b) => abc[b % abc.length]).join("");
}
/** The link to send: /#/goal-quiz/<teacher id>-<code>. */
export const quizLink = (origin: string, teacherId: number, share: string) => `${/^https?:\/\//.test(origin) ? origin : QUIZ_LINK_ORIGIN}/#/goal-quiz/${teacherId}-${share}`;
export function parseQuizCode(code: string): { teacherId: number; share: string } | null {
  const m = /^(\d{1,12})-([A-Za-z0-9]{20,40})$/.exec(String(code || ""));
  return m ? { teacherId: Number(m[1]), share: m[2] } : null;
}

type QuizLike = { id: string; title: string; student: string; share?: string; questions?: { prompt: string; options: string[]; correct: number }[] };
/** What the student sees: the questions without the answers, and only the student's first name. */
export function publicQuiz(q: QuizLike) {
  return { title: q.title, student: q.student.split(" ")[0] || "", questions: (q.questions || []).map((x) => ({ prompt: x.prompt, options: x.options })) };
}
/** The score for the student's answers (one option number per question). */
export function scoreQuiz(q: QuizLike, answers: unknown): { score: number; total: number } | null {
  const list = q.questions || [];
  if (!Array.isArray(answers) || answers.length !== list.length || !list.length) return null;
  if (!answers.every((a) => Number.isInteger(a) && a >= 0 && a < 4)) return null;
  return { score: list.reduce((n, x, i) => n + (answers[i] === x.correct ? 1 : 0), 0), total: list.length };
}
