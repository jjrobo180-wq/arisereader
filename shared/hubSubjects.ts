// Arise WorkHub: service minutes by subject (Reading, Math, Writing and the rest).
// A service can say which subject it is for, and a session follows its service unless it says its own.
// A student's profile adds the minutes up by subject: what is due this week, what was given, and all logged.
import { GOAL_AREAS, serviceStatus } from "./hubProgress";
import type { ServiceLog, ServicePlan } from "./teacherHub";

/** The subjects minutes can be for: the same areas IEP goals are written in. */
export const MINUTE_SUBJECTS: readonly string[] = GOAL_AREAS;
/** What minutes with no subject are shown under. */
export const NO_SUBJECT = "No subject";

/** A saved subject made safe to use: one of the subjects (in its own capitals), or "" for none. */
export function cleanSubject(value: unknown): string {
  const said = typeof value === "string" ? value.replace(/\s+/g, " ").trim().toLowerCase() : "";
  return (said && MINUTE_SUBJECTS.find((s) => s.toLowerCase() === said)) || "";
}

const fold = (name: unknown) => String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** The service a session counts toward: the same student and the same kind. */
export const planOf = (log: Pick<ServiceLog, "student" | "kind">, plans: ServicePlan[]): ServicePlan | undefined =>
  plans.find((p) => fold(p.student) === fold(log.student) && p.kind === log.kind);

/** The subject a session is for: its own, or else its service's. "" when neither says. */
export const logSubject = (log: Pick<ServiceLog, "student" | "kind" | "subject">, plans: ServicePlan[]): string =>
  cleanSubject(log.subject) || cleanSubject(planOf(log, plans)?.subject);

export type SubjectMinutes = {
  /** The subject, or NO_SUBJECT. */
  subject: string;
  /** Minutes due this week, and given this week, over the services for this subject. */
  required: number; thisWeek: number;
  /** Every minute logged for this subject, and how many sessions. */
  total: number; sessions: number;
  /** Sessions that did not happen. */
  notMet: number;
  /** Make-up owed over the last 4 weeks. */
  owed: number;
};

/**
 * One student's minutes added up by subject, in the order of MINUTE_SUBJECTS, with "No subject" last.
 * `plans` and `logs` are the student's own (a plan as it counts, optional days taken out).
 * Only subjects that have a service or a session are listed.
 */
export function subjectMinutes(plans: ServicePlan[], logs: ServiceLog[], today: string, allPlans: ServicePlan[] = plans): SubjectMinutes[] {
  const by = new Map<string, SubjectMinutes>();
  const get = (subject: string) => {
    const key = subject || NO_SUBJECT;
    if (!by.has(key)) by.set(key, { subject: key, required: 0, thisWeek: 0, total: 0, sessions: 0, notMet: 0, owed: 0 });
    return by.get(key)!;
  };
  for (const plan of plans) {
    const s = serviceStatus(plan, logs, today);
    const row = get(cleanSubject(plan.subject));
    row.required += s.required; row.thisWeek += s.thisWeek; row.owed += s.owed;
  }
  for (const log of logs) {
    const row = get(logSubject(log, allPlans));
    if (log.notMet) { row.notMet++; continue; }
    row.total += Number(log.minutes) || 0;
    row.sessions++;
  }
  const rank = (s: string) => { const i = MINUTE_SUBJECTS.indexOf(s); return i < 0 ? MINUTE_SUBJECTS.length + (s === NO_SUBJECT ? 1 : 0) : i; };
  return [...by.values()].sort((a, b) => rank(a.subject) - rank(b.subject));
}
