// Arise WorkHub: the IEP deadline of a meeting. Step 1 of the meeting steps asks for the
// deadline (not a meeting time); step 2 then suggests times before it. The deadline is the
// same date as the student's "IEP deadline" (or "Reevaluation deadline") on the caseload,
// so entering it in either place fills in the other.
import type { Meeting, Student, Workspace } from "./teacherHub";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (value: unknown) => (typeof value === "string" && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? value : "");

/** Which of the student's dates a meeting type uses: a reevaluation has its own, everything else the IEP deadline. */
export function deadlineField(type: string): "iepDate" | "reevalDate" {
  return /re-?eval/i.test(String(type || "")) ? "reevalDate" : "iepDate";
}

/** What step 1 calls the date. */
export function deadlineLabel(type: string): string {
  return deadlineField(type) === "reevalDate" ? "Reevaluation deadline date" : "IEP deadline date";
}

/** Only an annual IEP or a reevaluation saves its deadline back to the student (a parent meeting's "deadline" is not the IEP's). */
export function savesToStudent(type: string): boolean {
  return /annual iep/i.test(String(type || "")) || deadlineField(type) === "reevalDate";
}

const findStudent = (students: Student[], name: string) => {
  const key = String(name || "").trim().toLowerCase();
  return key ? students.find((s) => s.name.trim().toLowerCase() === key) : undefined;
};

/** The deadline saved on the student in the caseload for this kind of meeting, or "". */
export function studentDeadline(workspace: Pick<Workspace, "students">, student: string, type: string): string {
  const s = findStudent(workspace.students || [], student);
  return s ? day(s[deadlineField(type)]) : "";
}

/**
 * A meeting's deadline. For an annual IEP or a reevaluation the caseload's date wins, so a
 * date changed later on the student's page is the one the scheduler uses.
 */
export function meetingDeadline(workspace: Pick<Workspace, "students">, meeting: Pick<Meeting, "student" | "type"> & { deadline?: string }): string {
  const saved = savesToStudent(meeting.type) ? studentDeadline(workspace, meeting.student, meeting.type) : "";
  return saved || day(meeting.deadline);
}

export type NewMeeting = { student: string; type: string; deadline: string; date: string; time: string; room: string; notes: string };

/** Adds the meeting from step 1 and, for an annual IEP or a reevaluation, puts the deadline on the student too. */
export function addMeetingWithDeadline(workspace: Workspace, form: NewMeeting, id: string, plan: Meeting["plan"]): Workspace {
  const deadline = day(form.deadline);
  const meeting: Meeting = {
    id, student: form.student, type: form.type, date: day(form.date), time: form.time || "", room: form.room, notes: form.notes, done: false, plan,
    ...(deadline ? { deadline } : {}),
  };
  const field = deadlineField(form.type);
  const target = deadline && savesToStudent(form.type) ? findStudent(workspace.students, form.student) : undefined;
  const students = target ? workspace.students.map((s) => (s.id === target.id ? { ...s, [field]: deadline } : s)) : workspace.students;
  return { ...workspace, students, meetings: [...workspace.meetings, meeting] };
}

/** "before the IEP deadline (Tue, Oct 20)" style words for a date. */
export function deadlineWords(date: string): string {
  const d = day(date);
  if (!d) return "";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
