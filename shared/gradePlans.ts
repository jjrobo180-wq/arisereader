// Arise WorkHub: Grade Plans (a Plugin Gallery plugin). The teacher uploads grades (a gradebook export,
// a photo, a PDF, pasted text); the AI finds missing work and failed tests or worksheets; the teacher
// picks which to act on, and the AI writes a plan for each student: the steps, an email to each class
// teacher asking for a retake and where to find it, an email to the parents and one to the advisor.
// The teacher picks a free time from their calendar to pull the student for the retake: it goes on the
// calendar and Makeup tests, and the plan's to-dos go on Tasks. Emails are copied and sent by the
// teacher. The screen is client/src/components/teacher-hub/HubGradePlans.tsx; the AI route is
// server/gradePlans.ts.
import type { HubContact, HubEvent, IepGuide } from "./teacherHub";

export type ConcernKind = "missing" | "failed" | "low";
export const CONCERN_LABEL: Record<ConcernKind, string> = { missing: "Missing", failed: "Failed", low: "Low" };

/** One assignment a student needs to fix, as read from the grades. */
export type Concern = { id: string; student: string; assignment: string; subject: string; teacher: string; score: string; kind: ConcernKind; due: string };
export type PlanEmail = { to: string; name: string; subject: string; body: string };
export type Retake = { date: string; start: string; end: string; where: string; eventId?: string; makeupId?: string };

export type GradePlan = {
  id: string;
  student: string;
  concerns: Concern[];
  summary: string;
  steps: string[];
  /** One for each class teacher whose work is involved. */
  teacherEmails: PlanEmail[];
  parentEmail: PlanEmail;
  advisorEmail: PlanEmail;
  /** To-dos for the teacher; `taskId` once added to Tasks. */
  todos: { text: string; taskId?: string }[];
  retake?: Retake;
  status: "open" | "scheduled" | "done";
  createdAt: string;
};
export type GradePlanSettings = { dayStart: string; dayEnd: string; minutes: number; where: string; advisorName: string; advisorEmail: string };
export const DEFAULT_SETTINGS: GradePlanSettings = { dayStart: "08:00", dayEnd: "15:30", minutes: 45, where: "", advisorName: "", advisorEmail: "" };

/** Where the retake time goes in the emails until one is picked. */
export const RETAKE_SLOT = "[RETAKE TIME]";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const kindOf = (v: unknown): ConcernKind => (v === "missing" || v === "failed" || v === "low" ? v : "failed");

export function cleanConcern(raw: any, id: string): Concern | null {
  const student = str(raw?.student, 80), assignment = str(raw?.assignment, 160);
  if (!student || !assignment) return null;
  return { id: str(raw?.id, 60) || id, student, assignment, subject: str(raw?.subject, 60), teacher: str(raw?.teacher, 80), score: str(raw?.score, 30), kind: kindOf(raw?.kind), due: isDay(raw?.due) ? raw.due : "" };
}
const cleanEmail = (raw: any): PlanEmail => ({ to: str(raw?.to, 200), name: str(raw?.name, 80), subject: str(raw?.subject, 200), body: str(raw?.body, 4000) });

export function cleanGradePlans(raw: unknown): GradePlan[] {
  if (!Array.isArray(raw)) return [];
  const out: GradePlan[] = [];
  for (const p of raw.slice(0, 500)) {
    if (!p || typeof p !== "object") continue;
    const id = str((p as any).id, 60), student = str((p as any).student, 80);
    if (!id || !student) continue;
    const r = (p as any).retake;
    out.push({
      id, student,
      concerns: (Array.isArray((p as any).concerns) ? (p as any).concerns : []).slice(0, 40).map((c: any, i: number) => cleanConcern(c, `${id}-${i}`)).filter(Boolean) as Concern[],
      summary: str((p as any).summary, 1200),
      steps: (Array.isArray((p as any).steps) ? (p as any).steps : []).map((s: unknown) => str(s, 400)).filter(Boolean).slice(0, 12),
      teacherEmails: (Array.isArray((p as any).teacherEmails) ? (p as any).teacherEmails : []).slice(0, 8).map(cleanEmail),
      parentEmail: cleanEmail((p as any).parentEmail), advisorEmail: cleanEmail((p as any).advisorEmail),
      todos: (Array.isArray((p as any).todos) ? (p as any).todos : []).slice(0, 12).map((t: any) => ({ text: str(t?.text, 300), ...(str(t?.taskId, 60) ? { taskId: str(t?.taskId, 60) } : {}) })).filter((t: { text: string }) => t.text),
      retake: r && isDay(r.date) && isTime(r.start) ? { date: r.date, start: r.start, end: isTime(r.end) ? r.end : r.start, where: str(r.where, 120), ...(str(r.eventId, 60) ? { eventId: str(r.eventId, 60) } : {}), ...(str(r.makeupId, 60) ? { makeupId: str(r.makeupId, 60) } : {}) } : undefined,
      status: (p as any).status === "scheduled" || (p as any).status === "done" ? (p as any).status : "open",
      createdAt: str((p as any).createdAt, 40),
    });
  }
  return out;
}
export function cleanSettings(raw: any): GradePlanSettings {
  const m = Number(raw?.minutes);
  return {
    dayStart: isTime(raw?.dayStart) ? raw.dayStart : DEFAULT_SETTINGS.dayStart,
    dayEnd: isTime(raw?.dayEnd) ? raw.dayEnd : DEFAULT_SETTINGS.dayEnd,
    minutes: [20, 30, 45, 60, 90].includes(m) ? m : DEFAULT_SETTINGS.minutes,
    where: str(raw?.where, 120), advisorName: str(raw?.advisorName, 80), advisorEmail: str(raw?.advisorEmail, 200),
  };
}

// ── Names ───────────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
/** "Martinez, Ulysses A." and "Ulysses Andrew Martinez" are the same student: match a name from the grades to the roster. */
export function matchStudent(name: string, roster: string[]): string {
  const n = norm(name.includes(",") ? name.split(",").reverse().join(" ") : name);
  if (!n) return "";
  const exact = roster.find((r) => norm(r) === n);
  if (exact) return exact;
  const words = n.split(" ").filter((w) => w.length > 1);
  let best = "", bestScore = 0;
  for (const r of roster) {
    const rw = norm(r).split(" ");
    const hits = words.filter((w) => rw.includes(w)).length;
    // First and last name both there, or a rare single match on a long last name.
    const score = hits >= 2 ? hits + 1 : hits === 1 && words.length === 1 && words[0].length >= 4 ? 1 : 0;
    if (score > bestScore) { best = r; bestScore = score; }
  }
  return best;
}

/** The parents' emails for a student, from their IEP checklist. */
export function parentEmailsFor(student: string, guides: IepGuide[]): { names: string; emails: string[] } {
  const g = guides.find((x) => x.student === student);
  if (!g) return { names: "", emails: [] };
  return { names: [g.parent1, g.parent2].filter(Boolean).join(" and "), emails: [g.parent1Email, g.parent2Email].filter((e): e is string => !!e) };
}
/** A class teacher's email from the teacher's saved contacts, by name ("Ms. Rivera" finds "Ana Rivera"). */
export function contactEmail(name: string, contacts: HubContact[]): string {
  const n = norm(name.replace(/\b(mr|mrs|ms|miss|dr|mx)\b\.?/gi, ""));
  if (!n) return "";
  const words = n.split(" ").filter((w) => w.length > 1);
  const hit = contacts.find((c) => { const cw = norm(c.name).split(" "); return words.length > 0 && words.every((w) => cw.includes(w)); });
  return hit?.email || "";
}

/** Concerns grouped by student, students in name order. */
export function byStudent(concerns: Concern[]): { student: string; concerns: Concern[] }[] {
  const m = new Map<string, Concern[]>();
  for (const c of concerns) m.set(c.student, [...(m.get(c.student) || []), c]);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([student, list]) => ({ student, concerns: list }));
}

// ── Times ───────────────────────────────────────────────────────────────────

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

export type Slot = { date: string; start: string; end: string };
/**
 * Open times on the teacher's calendar over the next school days: weekdays, inside the school day, not
 * overlapping any timed event (all-day events don't block). Starts on the hour or half hour; today's
 * slots only after `nowTime`. Up to `perDay` a day.
 */
export function freeSlots(events: Pick<HubEvent, "date" | "start" | "end">[], from: string, settings: Pick<GradePlanSettings, "dayStart" | "dayEnd" | "minutes">, opts: { days?: number; perDay?: number; nowTime?: string } = {}): Slot[] {
  const out: Slot[] = [];
  const len = settings.minutes;
  let day = from, schoolDays = 0;
  for (let guard = 0; schoolDays < (opts.days ?? 10) && guard < 40; guard++, day = addDays(day, 1)) {
    const w = weekday(day);
    if (w === 0 || w === 6) continue;
    schoolDays++;
    const busy = events.filter((e) => e.date === day && isTime(e.start)).map((e) => [toMin(e.start), isTime(e.end) && toMin(e.end) > toMin(e.start) ? toMin(e.end) : toMin(e.start) + 30]);
    let t = Math.ceil(toMin(settings.dayStart) / 30) * 30;
    if (day === from && opts.nowTime && isTime(opts.nowTime)) t = Math.max(t, Math.ceil((toMin(opts.nowTime) + 15) / 30) * 30);
    let found = 0;
    for (; t + len <= toMin(settings.dayEnd) && found < (opts.perDay ?? 4); t += 30) {
      if (busy.some(([s, e]) => t < e && t + len > s)) continue;
      out.push({ date: day, start: toTime(t), end: toTime(t + len) });
      found++;
      t += len - 30; // the next one starts after this one ends
    }
  }
  return out;
}

export const niceDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
export const niceTime = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
/** "Tuesday, November 24, 10:00 AM – 10:45 AM in Room 12" */
export const retakeWords = (r: Pick<Retake, "date" | "start" | "end" | "where">) => `${niceDay(r.date)}, ${niceTime(r.start)} – ${niceTime(r.end)}${r.where ? ` in ${r.where}` : ""}`;
/** An email with the retake time written in (or left as "a time I'll confirm" when none is picked yet). */
export const fillRetake = (text: string, retake?: Retake) => text.split(RETAKE_SLOT).join(retake ? retakeWords(retake) : "a time I'll confirm soon");
/** A mailto: link that opens the email ready to send. */
export const mailto = (e: PlanEmail, retake?: Retake) => `mailto:${encodeURIComponent(e.to).replace(/%40/g, "@").replace(/%2C/g, ",")}?subject=${encodeURIComponent(fillRetake(e.subject, retake))}&body=${encodeURIComponent(fillRetake(e.body, retake))}`;
