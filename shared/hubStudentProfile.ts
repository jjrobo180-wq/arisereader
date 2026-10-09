// Arise WorkHub: one student's whole picture. Everything the Hub holds under a student's name
// (IEP dates, goals, service minutes, meetings, notes, parent contact, behavior, attendance,
// grades, schedule, reading records) gathered in one place, newest first.
import { daysBetween } from "./hubDates";
import { guideProgress } from "./hubGuide";
import { countedPlan, goalProgress, optionalDays, serviceStatus, type GoalStatus, type ServiceStatus } from "./hubProgress";
import type {
  AriseRecord, Assignment, AttendanceEntry, BehaviorEntry, Goal, IepGuide, Meeting, NoteItem, ParentLog, ScheduleEntry, ServiceLog, ServicePlan, Student, Workspace,
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
  meetings: { upcoming: Meeting[]; past: Meeting[] };
  guides: { guide: IepGuide; done: number; total: number }[];
  notes: NoteItem[];
  parentLogs: ParentLog[];
  behavior: { total: number; entries: BehaviorEntry[] };
  attendance: { counts: Record<AttendanceEntry["status"], number>; entries: AttendanceEntry[] };
  grades: { rows: ProfileGrade[]; /** Percent over the scored work (missing and excused left out, as in the gradebook). */ average: number | null; missing: number };
  schedule: ScheduleEntry[];
  reading: AriseRecord[];
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
  const notes = newest(mine(workspace.notes));
  const parentLogs = newest(mine(workspace.parentLogs));
  const reading = newest(mine(workspace.ariseRecords));

  return {
    student,
    iep: dated(student.iepDate, today),
    reeval: dated(student.reevalDate, today),
    goals, services, serviceLogs,
    meetings: {
      upcoming: meetings.filter(ahead).sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999"))),
      past: newest(meetings.filter((m) => !ahead(m))),
    },
    guides, notes, parentLogs,
    behavior: { total: behavior.reduce((sum, b) => sum + (Number(b.points) || 0), 0), entries: behavior },
    attendance: { counts, entries: attendance },
    grades: { rows, average: possible ? Math.round((earned / possible) * 100) : null, missing: rows.filter((r) => r.missing).length },
    schedule, reading,
    records: goals.length + services.length + serviceLogs.length + meetings.length + guides.length + notes.length + parentLogs.length + behavior.length + attendance.length + rows.length + schedule.length + reading.length,
  };
}

/** "in 12 days", "today", "5 days ago": how far off an IEP or reevaluation date is. */
export function dueWords(when: ProfileDate): string {
  if (when.days === null) return "";
  if (when.days === 0) return "today";
  const n = Math.abs(when.days);
  return when.days > 0 ? `in ${n} ${n === 1 ? "day" : "days"}` : `${n} ${n === 1 ? "day" : "days"} ago`;
}
