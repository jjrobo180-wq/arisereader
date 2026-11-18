// Arise WorkHub: incident reports. A report says what happened to (or with) a student, what was done, and how
// to follow up: who to check in with (the student, a class, the parents, the counselor), on which days of the
// week, and until when. The check-ins due each day are listed to log, and everything shows on the student's
// profile. The page is client/src/components/teacher-hub/HubIncidents.tsx; the data is workspace.incidents.

export const INCIDENT_TYPES = ["Bullying", "Peer conflict", "Behavior", "Safety concern", "Harassment", "Injury", "Attendance", "Other"] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export const SEVERITIES = ["low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_LABEL: Record<Severity, string> = { low: "Low", medium: "Medium", high: "High" };
export const INCIDENT_STATUSES = ["open", "monitoring", "closed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export const STATUS_LABEL: Record<IncidentStatus, string> = { open: "Open", monitoring: "Monitoring", closed: "Closed" };
/** How a check-in went. */
export const CHECK_RESULTS = ["good", "okay", "concern"] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];
export const CHECK_RESULT_LABEL: Record<CheckResult, string> = { good: "Doing well", okay: "Okay", concern: "Concern" };
/** Who a teacher usually checks in with, offered as quick picks (the student's classes are offered too). */
export const CHECK_WITH_PRESETS = ["Student", "Parent/guardian", "Counselor", "Admin"] as const;
export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type CheckIn = { id: string; date: string; with: string; result: CheckResult; note: string };
export type Incident = {
  id: string;
  student: string;
  date: string;
  time: string;
  type: IncidentType;
  severity: Severity;
  where: string;
  /** What happened, in the teacher's words. */
  summary: string;
  /** Other people involved or who saw it. */
  others: string;
  /** What was done about it. */
  actions: string;
  /** Who it was reported to (admin, counselor). */
  reportedTo: string;
  parentContacted: boolean;
  status: IncidentStatus;
  /** The check-in plan: who to check in with, on which days of the week (0 Sunday … 6 Saturday), until when. */
  checkWith: string[];
  checkDays: number[];
  checkUntil: string;
  checkIns: CheckIn[];
  /** The repeating calendar event made for the check-ins, when the teacher asked for one. */
  eventId?: string;
  createdAt: string;
  updatedAt: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export function addDaysTo(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

/** Incident reports made safe (from saved data or an old copy): bad rows dropped, text capped. */
export function cleanIncidents(raw: unknown): Incident[] {
  if (!Array.isArray(raw)) return [];
  const out: Incident[] = [];
  const ids = new Set<string>();
  for (const r of raw.slice(0, 2000)) {
    if (!r || typeof r !== "object") continue;
    const x = r as any;
    const id = str(x.id, 80), student = str(x.student, 80), date = DAY.test(String(x.date)) ? String(x.date) : "";
    if (!id || ids.has(id) || !student || !date) continue;
    ids.add(id);
    const checkWith = Array.isArray(x.checkWith) ? [...new Set(x.checkWith.map((w: unknown) => str(w, 80)).filter(Boolean))].slice(0, 20) as string[] : [];
    const checkDays = Array.isArray(x.checkDays) ? [...new Set(x.checkDays.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() as number[] : [];
    const checkIns: CheckIn[] = Array.isArray(x.checkIns) ? x.checkIns.slice(0, 1000).map((c: any) => ({
      id: str(c?.id, 80), date: DAY.test(String(c?.date)) ? String(c.date) : "", with: str(c?.with, 80), result: oneOf(c?.result, CHECK_RESULTS, "okay"), note: str(c?.note, 1000),
    })).filter((c: CheckIn) => c.id && c.date) : [];
    out.push({
      id, student, date, time: /^\d{2}:\d{2}$/.test(String(x.time)) ? String(x.time) : "",
      type: oneOf(x.type, INCIDENT_TYPES, "Other"), severity: oneOf(x.severity, SEVERITIES, "medium"),
      where: str(x.where, 120), summary: str(x.summary, 4000), others: str(x.others, 600), actions: str(x.actions, 2000), reportedTo: str(x.reportedTo, 200),
      parentContacted: x.parentContacted === true, status: oneOf(x.status, INCIDENT_STATUSES, "open"),
      checkWith, checkDays, checkUntil: DAY.test(String(x.checkUntil)) ? String(x.checkUntil) : "", checkIns,
      ...(str(x.eventId, 80) ? { eventId: str(x.eventId, 80) } : {}),
      createdAt: str(x.createdAt, 40), updatedAt: str(x.updatedAt, 40),
    });
  }
  return out;
}

/** Whether a report's check-ins fall on a day: not closed, a plan with people and days, from the report's day to its end. */
export function checksOn(i: Incident, day: string): boolean {
  if (i.status === "closed" || !i.checkWith.length || !i.checkDays.length) return false;
  if (day < i.date || (i.checkUntil && day > i.checkUntil)) return false;
  return i.checkDays.includes(weekdayOf(day));
}

export type DueCheck = { incident: Incident; with: string; done: CheckIn | null };
/** The check-ins due on a day, each with the one logged for it (if any). */
export function checksDue(incidents: Incident[], day: string): DueCheck[] {
  const out: DueCheck[] = [];
  for (const i of incidents) {
    if (!checksOn(i, day)) continue;
    for (const w of i.checkWith) out.push({ incident: i, with: w, done: i.checkIns.find((c) => c.date === day && c.with.toLowerCase() === w.toLowerCase()) ?? null });
  }
  return out.sort((a, b) => Number(!!a.done) - Number(!!b.done) || (b.incident.severity === "high" ? 1 : 0) - (a.incident.severity === "high" ? 1 : 0) || a.incident.student.localeCompare(b.incident.student));
}

/** Check-in days in the past two weeks with nothing logged for someone on the plan (up to today, not including it). */
export function missedChecks(i: Incident, today: string): { date: string; with: string }[] {
  const out: { date: string; with: string }[] = [];
  for (let n = 14; n >= 1; n--) {
    const d = addDaysTo(today, -n);
    if (!checksOn(i, d)) continue;
    for (const w of i.checkWith) if (!i.checkIns.some((c) => c.date === d && c.with.toLowerCase() === w.toLowerCase())) out.push({ date: d, with: w });
  }
  return out;
}

/** The next day with check-ins, from today on (within 60 days). */
export function nextCheckDay(i: Incident, today: string): string {
  for (let n = 0; n <= 60; n++) { const d = addDaysTo(today, n); if (checksOn(i, d)) return d; if (i.checkUntil && d > i.checkUntil) break; }
  return "";
}

/** A student's reports, newest first. */
export const incidentsFor = (incidents: Incident[], student: string) =>
  incidents.filter((i) => i.student.trim().toLowerCase() === student.trim().toLowerCase()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

/** The check-in plan in words: "Student, Math 7 and Parent/guardian on Mon, Wed, Fri until Dec 5". */
export function planWords(i: Pick<Incident, "checkWith" | "checkDays" | "checkUntil">): string {
  if (!i.checkWith.length || !i.checkDays.length) return "";
  const who = i.checkWith.length === 1 ? i.checkWith[0] : `${i.checkWith.slice(0, -1).join(", ")} and ${i.checkWith[i.checkWith.length - 1]}`;
  const days = i.checkDays.length === 5 && [1, 2, 3, 4, 5].every((d) => i.checkDays.includes(d)) ? "every school day" : `on ${i.checkDays.map((d) => WEEKDAY_NAMES[d]).join(", ")}`;
  const until = i.checkUntil ? ` until ${new Date(`${i.checkUntil}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : "";
  return `Check in with ${who} ${days}${until}`;
}
