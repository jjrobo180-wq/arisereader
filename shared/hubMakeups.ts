// Arise WorkHub: Makeup tests. A makeup is one test or quiz for one or more students: when it was missed and why,
// when and where it's made up (and who proctors), the students' accommodations, each student's score, notes, and
// attached files (photos, PDFs) and links. It goes on the calendar and the to-do list, saves its notes to Notes,
// and shows on each student's profile. The page is client/src/components/teacher-hub/HubMakeups.tsx.
import { LINK_KINDS as KINDS, type HubLink } from "./hubLinks";
import type { KitRecord } from "./pluginKit";

export const MAKEUP_STATUSES = ["to-schedule", "scheduled", "done", "excused"] as const;
export type MakeupStatus = (typeof MAKEUP_STATUSES)[number];
export const MAKEUP_STATUS_LABEL: Record<MakeupStatus, string> = { "to-schedule": "To schedule", scheduled: "Scheduled", done: "Done", excused: "Excused" };
export const MISSED_REASONS = ["Absent", "Excused absence", "Pulled for services", "Field trip", "Late arrival", "Needs extended time", "Retake", "Other"] as const;

export type Makeup = {
  id: string;
  students: string[];
  test: string;
  subject: string;
  /** The day the test was given (and missed). */
  missedOn: string;
  reason: string;
  date: string;
  start: string;
  end: string;
  where: string;
  proctor: string;
  /** Accommodations for the makeup (filled from the students' profiles, editable). */
  accommodations: string;
  status: MakeupStatus;
  /** Each student's score, by name. */
  scores: Record<string, string>;
  notes: string;
  /** Photos, PDFs and anything else linked (Drive files, notes, goals…). */
  links: HubLink[];
  /** The note in Notes these notes are saved to, the calendar event and the to-do made for it. */
  noteId?: string;
  eventId?: string;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");
const clock = (v: unknown) => (/^\d{2}:\d{2}$/.test(String(v)) ? String(v) : "");
const LINK_KINDS = new Set<string>(KINDS);

export function cleanMakeups(raw: unknown): Makeup[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const out: Makeup[] = [];
  for (const x of raw.slice(0, 3000) as any[]) {
    if (!x || typeof x !== "object") continue;
    const id = str(x.id, 80);
    const students = Array.isArray(x.students) ? [...new Set(x.students.map((s: unknown) => str(s, 80)).filter(Boolean))].slice(0, 60) as string[] : [];
    if (!id || ids.has(id) || !students.length) continue;
    ids.add(id);
    const scores: Record<string, string> = {};
    if (x.scores && typeof x.scores === "object") for (const [k, v] of Object.entries(x.scores)) { const n = str(k, 80), s = str(v, 20); if (n && s && students.includes(n)) scores[n] = s; }
    const links: HubLink[] = Array.isArray(x.links) ? x.links.filter((l: any) => l && LINK_KINDS.has(l.kind) && str(l.id, 120)).slice(0, 40).map((l: any) => ({ kind: l.kind, id: str(l.id, 120) })) : [];
    const status = (MAKEUP_STATUSES as readonly string[]).includes(x.status) ? x.status as MakeupStatus : "to-schedule";
    out.push({
      id, students, test: str(x.test, 160), subject: str(x.subject, 80), missedOn: DAY.test(String(x.missedOn)) ? String(x.missedOn) : "", reason: str(x.reason, 80),
      date: DAY.test(String(x.date)) ? String(x.date) : "", start: clock(x.start), end: clock(x.end), where: str(x.where, 120), proctor: str(x.proctor, 120),
      accommodations: str(x.accommodations, 2000), status, scores, notes: str(x.notes, 8000), links,
      ...(str(x.noteId, 80) ? { noteId: str(x.noteId, 80) } : {}), ...(str(x.eventId, 80) ? { eventId: str(x.eventId, 80) } : {}), ...(str(x.taskId, 80) ? { taskId: str(x.taskId, 80) } : {}),
      createdAt: str(x.createdAt, 40), updatedAt: str(x.updatedAt, 40),
    });
  }
  return out;
}

const has = (m: Makeup, student: string) => m.students.some((s) => s.trim().toLowerCase() === student.trim().toLowerCase());
/** A student's makeups, the open ones first, then newest. */
export const makeupsFor = (list: Makeup[], student: string) =>
  list.filter((m) => has(m, student)).sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)) || (b.date || b.missedOn).localeCompare(a.date || a.missedOn));
export const isClosed = (m: Makeup) => m.status === "done" || m.status === "excused";
/** Open makeups whose day has passed (or that have no day yet after a week): to chase. */
export function overdue(m: Makeup, today: string): boolean {
  if (isClosed(m)) return false;
  if (m.date) return m.date < today;
  return !!m.missedOn && m.missedOn <= addDaysTo(today, -7);
}
export function addDaysTo(date: string, n: number): string { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/** The students' accommodations from their profiles, one line each (to start the makeup's accommodations). */
export function accommodationsOf(students: string[], profiles: { name: string; accommodations?: string }[]): string {
  return students.map((n) => { const p = profiles.find((s) => s.name.trim().toLowerCase() === n.trim().toLowerCase()); return p?.accommodations?.trim() ? `${n}: ${p.accommodations.trim()}` : ""; }).filter(Boolean).join("\n");
}

/** What the to-do and calendar event say. */
export const makeupTitle = (m: Pick<Makeup, "test" | "students">) => `Makeup: ${m.test || "test"} (${m.students.length > 3 ? `${m.students.slice(0, 3).join(", ")} +${m.students.length - 3}` : m.students.join(", ")})`;

/** Rows from the old "Makeup tests" list (a Plugin Kit list) as makeups, so nothing typed there is lost. */
export function fromKitRecords(records: KitRecord[], makeId: () => string, now: string): Makeup[] {
  const statusOf: Record<string, MakeupStatus> = { "To schedule": "to-schedule", Scheduled: "scheduled", Done: "done" };
  return records.filter((r) => r.plugin === "makeup-tests" && String(r.data.student || "").trim()).map((r) => ({
    id: makeId(), students: [String(r.data.student).trim().slice(0, 80)], test: String(r.data.test || "").slice(0, 160), subject: "", missedOn: "", reason: "",
    date: DAY.test(String(r.data.date)) ? String(r.data.date) : "", start: "", end: "", where: String(r.data.where || "").slice(0, 120), proctor: "", accommodations: "",
    status: statusOf[String(r.data.status)] ?? (DAY.test(String(r.data.date)) ? "scheduled" : "to-schedule"), scores: {}, notes: "", links: [], createdAt: now, updatedAt: now,
  }));
}
