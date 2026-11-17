// Arise WorkHub: one student's whole picture. Everything the Hub holds under a student's name
// (IEP dates, goals, service minutes, meetings, notes, parent contact, behavior, attendance,
// grades, schedule, reading records, Minutes class notes, lessons and their marks, worksheets and files,
// IEP drafts, and the to-dos, calendar events and emails that name the student) gathered in one place, newest first.
import { daysBetween } from "./hubDates";
import { cleanClasses, cleanLessons, rosterOf, type LessonMaterial, type LessonPlan, type StudentMark } from "./lessonPlanner";
import { cleanPushInNotes, type PushInNote, type PushInStudent } from "./pushIn";
import type { IepDraft } from "./iepWriter";
import { guideProgress } from "./hubGuide";
import { countedPlan, goalProgress, optionalDays, serviceStatus, type GoalStatus, type ServiceStatus } from "./hubProgress";
import { subjectMinutes, type SubjectMinutes } from "./hubSubjects";
import type {
  AriseRecord, Assignment, AttendanceEntry, BehaviorEntry, EmailItem, Goal, HubEvent, IepGuide, Meeting, NoteItem, ParentLog, ScheduleEntry, ServiceLog, ServicePlan, Student, Task, Workspace,
} from "./teacherHub";

/** Names are matched the way the rest of the Hub matches them: capitals and extra spaces don't matter. */
const fold = (name: unknown) => String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const newest = <T extends { date?: string }>(rows: T[]) => [...rows].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type ProfileDate = { date: string; /** Days from today; negative when it has passed. null when there is no date. */ days: number | null };
export type ProfileGrade = { id: string; assignment: Assignment | null; score: number | null; missing: boolean; excused: boolean };

export type StudentProfile = {
  student: Student;
  iep: ProfileDate;
  reeval: ProfileDate;
  goals: { goal: Goal; latest: number | null; percent: number; status: GoalStatus }[];
  services: { plan: ServicePlan; status: ServiceStatus }[];
  serviceLogs: ServiceLog[];
  /** The service minutes added up by subject (Reading, Math…). */
  subjects: SubjectMinutes[];
  meetings: { upcoming: Meeting[]; past: Meeting[] };
  guides: { guide: IepGuide; done: number; total: number }[];
  notes: NoteItem[];
  parentLogs: ParentLog[];
  behavior: { total: number; entries: BehaviorEntry[] };
  attendance: { counts: Record<AttendanceEntry["status"], number>; entries: AttendanceEntry[] };
  grades: { rows: ProfileGrade[]; /** Percent over the scored work (missing and excused left out, as in the gradebook). */ average: number | null; missing: number };
  schedule: ScheduleEntry[];
  reading: AriseRecord[];
  /** Push-in class notes from the Minutes page that have something for this student, newest first. */
  classNotes: { note: PushInNote; entry: PushInStudent }[];
  /** Lessons this student is in (marked, on the lesson's list, or in the lesson's class), newest first. */
  lessons: { lesson: LessonPlan; mark: StudentMark | null; className: string }[];
  /** Worksheets and files: those given to the student in a class note, and those on the student's lessons. */
  files: { material: LessonMaterial; from: string; date: string; source: "class" | "lesson"; given: boolean }[];
  iepDrafts: IepDraft[];
  /** To-dos, calendar events and emails linked to the student or naming them. */
  tasks: Task[];
  events: HubEvent[];
  emails: EmailItem[];
  /** How many records there are in all, outside the student's own card. */
  records: number;
};

const dated = (date: string, today: string): ProfileDate => ({ date: date || "", days: date ? daysBetween(today, date) : null });

/** Everything the Hub holds for one student, or null if the student is not on the caseload. */
export function studentProfile(workspace: Workspace, studentId: string, today: string): StudentProfile | null {
  const student = workspace.students.find((s) => s.id === studentId);
  if (!student) return null;
  const name = fold(student.name);
  const mine = <T extends { student: string }>(rows: T[] | undefined): T[] => (rows || []).filter((r) => fold(r.student) === name);

  const meetings = mine(workspace.meetings);
  const ahead = (m: Meeting) => !m.done && (!m.date || m.date.slice(0, 10) >= today);
  const serviceLogs = newest(mine(workspace.serviceLogs));
  const behavior = newest(mine(workspace.behavior));
  const attendance = newest(mine(workspace.attendance));
  const counts: Record<AttendanceEntry["status"], number> = { Present: 0, Absent: 0, Tardy: 0, Excused: 0 };
  for (const a of attendance) if (a.status in counts) counts[a.status]++;

  const assignments = new Map((workspace.assignments || []).map((a) => [a.id, a]));
  const rows: ProfileGrade[] = mine(workspace.gradeScores)
    .map((g) => ({ id: g.id, assignment: assignments.get(g.assignmentId) || null, score: g.score, missing: !!g.missing, excused: !!g.excused }))
    .sort((a, b) => String(b.assignment?.date || "").localeCompare(String(a.assignment?.date || "")));
  let earned = 0, possible = 0;
  for (const r of rows) if (r.assignment && !r.excused && !r.missing && r.score != null) { earned += Number(r.score) || 0; possible += Number(r.assignment.points) || 0; }

  const schedule = [...mine(workspace.schedules)].sort((a, b) => (DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)) || String(a.start).localeCompare(String(b.start)));
  const goals = mine(workspace.goals).map((goal) => { const p = goalProgress(goal, today); return { goal, latest: p.latest, percent: p.percent, status: p.status }; });
  // Each plan as it counts: an optional day asks for nothing.
  const optional = optionalDays(workspace);
  const services = mine(workspace.services).map((saved) => countedPlan(saved, optional)).map((plan) => ({ plan, status: serviceStatus(plan, workspace.serviceLogs || [], today) }));
  const guides = mine(workspace.guides).map((guide) => ({ guide, ...guideProgress(guide) }));
  // A note about several students shows for each of them.
  const notes = newest((workspace.notes || []).filter((n) => fold(n.student) === name || (n.students || []).some((s) => fold(s) === name)));
  const parentLogs = newest(mine(workspace.parentLogs));
  const reading = newest(mine(workspace.ariseRecords));

  // The Minutes page's class notes and the Lessons page.
  const classNotes = cleanPushInNotes(workspace.pushInNotes)
    .map((note) => ({ note, entry: note.students.find((x) => fold(x.student) === name) }))
    .filter((x): x is { note: PushInNote; entry: PushInStudent } => !!x.entry)
    .sort((a, b) => b.note.date.localeCompare(a.note.date));
  const classes = cleanClasses((workspace as any).lessonClasses);
  const lessons = cleanLessons(workspace.lessons)
    .filter((l) => rosterOf(l, classes).some((n) => fold(n) === name) || Object.keys(l.marks || {}).some((n) => fold(n) === name))
    .map((lesson) => {
      const key = Object.keys(lesson.marks || {}).find((n) => fold(n) === name);
      return { lesson, mark: key ? lesson.marks![key] : null, className: classes.find((c) => c.id === lesson.classId)?.name || lesson.group || "" };
    })
    .sort((a, b) => String(b.lesson.date || "").localeCompare(String(a.lesson.date || "")));
  const files: StudentProfile["files"] = [];
  const seenFile = new Set<string>();
  for (const { note, entry } of classNotes) for (const id of entry.materialIds || []) {
    const material = note.materials.find((m) => m.id === id);
    if (material && !seenFile.has(material.id)) { seenFile.add(material.id); files.push({ material, from: note.title || "Class note", date: note.date, source: "class", given: true }); }
  }
  for (const { lesson } of lessons) for (const material of lesson.files || []) {
    if (!seenFile.has(material.id)) { seenFile.add(material.id); files.push({ material, from: lesson.title || "Lesson", date: lesson.date || "", source: "lesson", given: false }); }
  }
  files.sort((a, b) => Number(b.given) - Number(a.given) || b.date.localeCompare(a.date));
  const iepDrafts = [...(workspace.iepDrafts || [])].filter((d) => fold(d.student) === name).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  // Anything that names the student by their full name, or is linked to them.
  const full = student.name.trim().toLowerCase().replace(/\s+/g, " ");
  const names = (text: unknown) => full.length > 2 && fold(text).includes(full);
  const linked = (links: { kind: string; id: string }[] | undefined) => (links || []).some((l) => l.kind === "student" && l.id === student.id);
  const tasks = (workspace.tasks || []).filter((t) => linked(t.links) || names(t.title) || names(t.notes)).sort((a, b) => Number(a.done) - Number(b.done) || String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")));
  const events = newest((workspace.events || []).filter((e) => (e.students || []).some((x) => fold(x) === name) || names(e.title) || names(e.notes)));
  const emails = newest((workspace.emails || []).filter((e) => names(e.subject) || names(e.body)));

  return {
    student,
    iep: dated(student.iepDate, today),
    reeval: dated(student.reevalDate, today),
    goals, services, serviceLogs,
    subjects: subjectMinutes(services.map((x) => x.plan), serviceLogs, today, workspace.services || []),
    meetings: {
      upcoming: meetings.filter(ahead).sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999"))),
      past: newest(meetings.filter((m) => !ahead(m))),
    },
    guides, notes, parentLogs,
    behavior: { total: behavior.reduce((sum, b) => sum + (Number(b.points) || 0), 0), entries: behavior },
    attendance: { counts, entries: attendance },
    grades: { rows, average: possible ? Math.round((earned / possible) * 100) : null, missing: rows.filter((r) => r.missing).length },
    schedule, reading, classNotes, lessons, files, iepDrafts, tasks, events, emails,
    records: goals.length + services.length + serviceLogs.length + meetings.length + guides.length + notes.length + parentLogs.length + behavior.length + attendance.length + rows.length + schedule.length + reading.length
      + classNotes.length + lessons.length + files.length + iepDrafts.length + tasks.length + events.length + emails.length,
  };
}

/** "in 12 days", "today", "5 days ago": how far off an IEP or reevaluation date is. */
export function dueWords(when: ProfileDate): string {
  if (when.days === null) return "";
  if (when.days === 0) return "today";
  const n = Math.abs(when.days);
  return when.days > 0 ? `in ${n} ${n === 1 ? "day" : "days"}` : `${n} ${n === 1 ? "day" : "days"} ago`;
}
