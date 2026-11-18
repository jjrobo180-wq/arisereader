// Arise WorkHub: 1-on-1 meetings with a student. Schedule one (or a run of them: every week, every 2 weeks, on
// certain days, until a date), keep an agenda and notes, how the student is feeling, and next steps. A next step
// can go on the to-do list (linked to the student). Last time's open next steps show when the next meeting starts.
// Every meeting shows on the student's profile. The page is client/src/components/teacher-hub/HubOneOnOne.tsx.

export const MEETING_FOCUS = ["Check-in", "Goals", "Grades & work", "Behavior plan", "Social & emotional", "Transition", "Other"] as const;
export type MeetingFocus = (typeof MEETING_FOCUS)[number];
/** Agenda starters for each focus (the teacher can change them). */
export const AGENDA_STARTERS: Record<MeetingFocus, string[]> = {
  "Check-in": ["How has your week been?", "What's going well?", "What's been hard?", "How can I help?"],
  Goals: ["Look at progress on each goal", "What helped this time?", "Pick one thing to work on next"],
  "Grades & work": ["Missing work", "Grades in each class", "A plan to catch up"],
  "Behavior plan": ["How the plan is going", "Points or rewards earned", "A tough moment and what to try next time"],
  "Social & emotional": ["How are you feeling?", "Friends and lunch", "Anything worrying you?"],
  Transition: ["Next year's classes", "Interests and strengths", "Questions about what's next"],
  Other: [],
};
export const FEELINGS = [1, 2, 3, 4, 5] as const;
export const FEELING_LABEL: Record<number, string> = { 1: "Really low", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };
export const FEELING_FACE: Record<number, string> = { 1: "😢", 2: "🙁", 3: "😐", 4: "🙂", 5: "😄" };
export const MEETING_STATUSES = ["scheduled", "done", "missed"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export type NextStep = { id: string; text: string; /** "student" or "teacher": whose step it is. */ who: "student" | "teacher"; due: string; done: boolean; /** The to-do made from it. */ taskId?: string };
export type OneOnOne = {
  id: string;
  student: string;
  date: string;
  time: string;
  minutes: number;
  where: string;
  focus: MeetingFocus;
  agenda: string[];
  notes: string;
  /** What the student said, in their words. */
  studentSaid: string;
  feeling: number;
  nextSteps: NextStep[];
  status: MeetingStatus;
  /** Meetings scheduled together share this; the run's calendar event is on the first. */
  seriesId?: string;
  eventId?: string;
  createdAt: string;
  updatedAt: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export function addDaysTo(date: string, n: number): string { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

export function cleanOneOnOnes(raw: unknown): OneOnOne[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const out: OneOnOne[] = [];
  for (const x of raw.slice(0, 3000) as any[]) {
    if (!x || typeof x !== "object") continue;
    const id = str(x.id, 80), student = str(x.student, 80), date = DAY.test(String(x.date)) ? String(x.date) : "";
    if (!id || ids.has(id) || !student || !date) continue;
    ids.add(id);
    const nextSteps: NextStep[] = Array.isArray(x.nextSteps) ? x.nextSteps.slice(0, 40).map((n: any) => ({
      id: str(n?.id, 80), text: str(n?.text, 300), who: n?.who === "teacher" ? "teacher" as const : "student" as const,
      due: DAY.test(String(n?.due)) ? String(n.due) : "", done: n?.done === true, ...(str(n?.taskId, 80) ? { taskId: str(n.taskId, 80) } : {}),
    })).filter((n: NextStep) => n.id && n.text) : [];
    const feeling = Number(x.feeling);
    out.push({
      id, student, date, time: /^\d{2}:\d{2}$/.test(String(x.time)) ? String(x.time) : "", minutes: Math.max(0, Math.min(240, Math.round(Number(x.minutes) || 0))),
      where: str(x.where, 120), focus: oneOf(x.focus, MEETING_FOCUS, "Check-in"),
      agenda: Array.isArray(x.agenda) ? x.agenda.map((a: unknown) => str(a, 200)).filter(Boolean).slice(0, 20) : [],
      notes: str(x.notes, 6000), studentSaid: str(x.studentSaid, 2000), feeling: Number.isInteger(feeling) && feeling >= 1 && feeling <= 5 ? feeling : 0,
      nextSteps, status: oneOf(x.status, MEETING_STATUSES, "scheduled"),
      ...(str(x.seriesId, 80) ? { seriesId: str(x.seriesId, 80) } : {}), ...(str(x.eventId, 80) ? { eventId: str(x.eventId, 80) } : {}),
      createdAt: str(x.createdAt, 40), updatedAt: str(x.updatedAt, 40),
    });
  }
  return out;
}

export type Repeat = { kind: "none" | "weekly" | "biweekly" | "days"; days: number[]; until: string };
/** The days a run of meetings falls on, from the first (included) to `until` (at most 40). */
export function runDates(first: string, repeat: Repeat): string[] {
  if (repeat.kind === "none" || !repeat.until || repeat.until < first) return [first];
  const out: string[] = [];
  const wanted = repeat.kind === "days" ? (repeat.days.length ? repeat.days : [weekdayOf(first)]) : [weekdayOf(first)];
  for (let n = 0, d = first; d <= repeat.until && out.length < 40 && n < 400; n++, d = addDaysTo(first, n)) {
    if (!wanted.includes(weekdayOf(d))) continue;
    if (repeat.kind === "biweekly" && Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86_400_000) % 14 !== 0) continue;
    out.push(d);
  }
  return out.length ? out : [first];
}

/** A student's meetings, newest first. */
export const meetingsFor = (list: OneOnOne[], student: string) =>
  list.filter((m) => m.student.trim().toLowerCase() === student.trim().toLowerCase()).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

/** Next steps still open from a student's earlier meetings (before `date`), to follow up on. */
export function openStepsBefore(list: OneOnOne[], student: string, date: string): { meeting: OneOnOne; step: NextStep }[] {
  return meetingsFor(list, student).filter((m) => m.date < date).flatMap((m) => m.nextSteps.filter((s) => !s.done).map((step) => ({ meeting: m, step })));
}

/** Meetings coming up from today (scheduled), soonest first. */
export const upcoming = (list: OneOnOne[], today: string) => list.filter((m) => m.status === "scheduled" && m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
/** Scheduled meetings whose day has passed without notes: to mark done or missed. */
export const needsWrapUp = (list: OneOnOne[], today: string) => list.filter((m) => m.status === "scheduled" && m.date < today).sort((a, b) => b.date.localeCompare(a.date));
