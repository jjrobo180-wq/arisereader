// Teacher Hub: goal progress monitoring and service-minute tracking.
import { addDays, daysBetween } from "./hubDates";
import type { Goal, ServiceLog, ServicePlan } from "./teacherHub";

export const GOAL_AREAS = ["Reading", "Math", "Writing", "Communication", "Behavior", "Social skills", "Self-help", "Other"] as const;
export const SERVICE_KINDS = ["Push-in", "Pull-out", "Consult", "Other"] as const;

export type GoalStatus = "met" | "on track" | "close" | "behind" | "no data";

const sorted = (goal: Goal) => [...goal.points].sort((a, b) => a.date.localeCompare(b.date));

/** Share of the way from baseline to target (0 to 1; can be below 0 when a student slips back). */
function share(goal: Goal, value: number): number {
  const span = goal.target - goal.baseline;
  return span === 0 ? (value === goal.target ? 1 : 0) : (value - goal.baseline) / span;
}

export function goalProgress(goal: Goal, today: string): { latest: number | null; percent: number; status: GoalStatus; expected: number | null } {
  const points = sorted(goal);
  if (!points.length) return { latest: null, percent: 0, status: "no data", expected: null };
  const latest = points[points.length - 1].value;
  const done = share(goal, latest);
  const percent = Math.max(0, Math.min(100, Math.round(done * 100)));
  if (done >= 1) return { latest, percent: 100, status: "met", expected: 1 };
  // Where a straight line from the start date to the target date says the student should be today.
  const total = daysBetween(goal.startDate, goal.targetDate);
  const gone = daysBetween(goal.startDate, today);
  const expected = total && total > 0 && gone !== null ? Math.max(0, Math.min(1, gone / total)) : null;
  if (expected === null || expected === 0) return { latest, percent, status: done > 0 ? "on track" : "close", expected };
  const ratio = done / expected;
  return { latest, percent, status: ratio >= 1 ? "on track" : ratio >= 0.7 ? "close" : "behind", expected };
}

/** A goal with one more reading, kept in date order. */
export function withPoint(goal: Goal, point: { id: string; date: string; value: number; note?: string }): Goal {
  return { ...goal, points: sorted({ ...goal, points: [...goal.points, { id: point.id, date: point.date, value: point.value, note: point.note || "" }] }) };
}

// ─── Service minutes ───────────────────────────────────────────────────────

/** The Monday of the week a day falls in. */
export function weekStart(date: string): string {
  const d = daysBetween("1970-01-05", date); // 1970-01-05 was a Monday
  return d === null ? "" : addDays(date, -(((d % 7) + 7) % 7));
}

const delivered = (logs: ServiceLog[], plan: Pick<ServicePlan, "student" | "kind">, from: string, to: string) =>
  logs.filter((l) => l.student === plan.student && l.kind === plan.kind && l.date >= from && l.date <= to).reduce((n, l) => n + (Number(l.minutes) || 0), 0);

export type ServiceStatus = { required: number; thisWeek: number; remaining: number; percent: number; owed: number };

/** This week's minutes against the plan, and how many minutes were missed in the 4 weeks before (the make-up owed). */
export function serviceStatus(plan: ServicePlan, logs: ServiceLog[], today: string): ServiceStatus {
  const start = weekStart(today);
  const required = Math.max(0, Number(plan.minutesPerWeek) || 0);
  const thisWeek = delivered(logs, plan, start, addDays(start, 6));
  let owed = 0;
  const first = plan.since ? weekStart(plan.since) : start; // an older plan with no start day owes nothing from before
  for (let w = 1; w <= 4; w++) {
    const from = addDays(start, -7 * w);
    if (from < first) break;
    owed += Math.max(0, required - delivered(logs, plan, from, addDays(from, 6)));
  }
  return { required, thisWeek, remaining: Math.max(0, required - thisWeek), percent: required ? Math.min(100, Math.round((thisWeek / required) * 100)) : 0, owed };
}
