// Arise WorkHub: goal progress monitoring and service-minute tracking.
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

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
export const DAY_NAMES: Record<WeekDay, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

const clockMinutes = (hm: unknown) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || "")); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null; };
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Minutes from a start time to an end time ("10:00" to "10:20" is 20). null unless both are times and the end is later. */
export function minutesBetween(start: unknown, end: unknown): number | null {
  const a = clockMinutes(start), b = clockMinutes(end);
  return a !== null && b !== null && b > a ? b - a : null;
}

/** A day guide made safe to use: known days with a whole number of minutes above zero, in week order. */
export function cleanDayGuide(days: unknown): Partial<Record<WeekDay, number>> {
  const out: Partial<Record<WeekDay, number>> = {};
  if (!days || typeof days !== "object" || Array.isArray(days)) return out;
  for (const day of WEEK_DAYS) {
    const minutes = Math.round(Number((days as Record<string, unknown>)[day]));
    if (Number.isFinite(minutes) && minutes > 0) out[day] = Math.min(minutes, 600);
  }
  return out;
}

// ─── Meeting days and optional days ─────────────────────────────────────────
//
// Some days of the school week are optional for a teacher: nothing is due on them, and they are only for
// extra minutes. An optional day is never offered when a student's days are picked, never asks for
// minutes, and is still on the calendar so minutes that were given on it can be added.

export const SCHOOL_DAYS: WeekDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
/** The optional days of a teacher who has not chosen their own: Wednesday. */
export const DEFAULT_OPTIONAL_DAYS: WeekDay[] = ["Wed"];

/** Saved optional days made safe to use: school days only, in week order. null when none were saved (an empty list is "no optional days"). */
export function cleanOptionalDays(raw: unknown): WeekDay[] | null {
  return Array.isArray(raw) ? SCHOOL_DAYS.filter((d) => raw.includes(d)) : null;
}

/** This teacher's optional days: the ones they chose, or Wednesday. */
export const optionalDays = (workspace: { minuteOptionalDays?: unknown }): WeekDay[] => cleanOptionalDays(workspace.minuteOptionalDays) ?? DEFAULT_OPTIONAL_DAYS;

/** The days students can be due on: the school days that are not optional. */
export const meetingDays = (optional: WeekDay[]): WeekDay[] => SCHOOL_DAYS.filter((d) => !optional.includes(d));

/** The day of the week a date falls on. null when it is not a date. */
export function weekDayOf(date: string): WeekDay | null {
  const at = daysBetween(weekStart(date), date);
  return at === null ? null : WEEK_DAYS[at] ?? null;
}

/**
 * A plan as it counts: its optional days ask for nothing. A plan that was only on optional days keeps
 * its minutes and is counted by the week, so the student does not drop out of sight. Nothing saved is
 * changed, and a plan with no optional day comes back as it is.
 */
export function countedPlan<T extends Pick<ServicePlan, "days" | "minutesPerWeek">>(plan: T, optional: WeekDay[]): T {
  const guide = cleanDayGuide(plan.days);
  if (!optional.some((d) => guide[d])) return plan;
  const kept = WEEK_DAYS.filter((d) => guide[d] && !optional.includes(d));
  const { days: _days, ...rest } = plan;
  if (!kept.length) return { ...rest, minutesPerWeek: WEEK_DAYS.reduce((n, d) => n + (guide[d] || 0), 0) } as T;
  return { ...rest, days: Object.fromEntries(kept.map((d) => [d, guide[d]!])), minutesPerWeek: kept.reduce((n, d) => n + guide[d]!, 0) } as T;
}

/** The days in a plan's guide, in week order. Empty when the plan is counted by the week only. */
export const guideDays = (plan: Pick<ServicePlan, "days">): WeekDay[] => WEEK_DAYS.filter((d) => cleanDayGuide(plan.days)[d]);

/** Minutes a plan asks for in a week: its day guide added up, or the weekly number when there is no guide. */
export function weeklyMinutes(plan: Pick<ServicePlan, "days" | "minutesPerWeek">): number {
  const guide = cleanDayGuide(plan.days);
  const days = WEEK_DAYS.filter((d) => guide[d]);
  return days.length ? days.reduce((n, d) => n + guide[d]!, 0) : Math.max(0, Number(plan.minutesPerWeek) || 0);
}

/** "Mon, Tue, Thu · 20 min each · Block 2" or "60 min a week": the plan in a few words. `block` is the name of its block, if it is in one. */
export function planText(plan: Pick<ServicePlan, "days" | "minutesPerWeek">, block = ""): string {
  const guide = cleanDayGuide(plan.days);
  const days = WEEK_DAYS.filter((d) => guide[d]);
  const where = block ? ` · ${block}` : "";
  if (!days.length) return `${weeklyMinutes(plan)} min a week${where}`;
  const amounts = days.map((d) => guide[d]!);
  const same = amounts.every((m) => m === amounts[0]);
  return (same ? `${days.join(", ")} · ${amounts[0]} min${days.length > 1 ? " each" : ""}` : `${days.map((d) => `${d} ${guide[d]}`).join(", ")} min`) + where;
}

/**
 * A session to log, tidied up, or null while it can't be logged (no student, or no minutes).
 * Minutes come from what was typed, or from the start and end time. With a start time the session keeps
 * its times, and the end follows the minutes (10:00 for 15 minutes ends at 10:15).
 */
export function sessionLog(input: { student: string; kind: string; date: string; minutes: unknown; start?: unknown; end?: unknown; note?: string }): Omit<ServiceLog, "id"> | null {
  const typed = String(input.minutes ?? "").trim() === "" ? null : Math.round(Number(input.minutes));
  const ranged = minutesBetween(input.start, input.end);
  const minutes = typed !== null && Number.isFinite(typed) ? typed : ranged;
  if (!input.student || minutes === null || minutes <= 0 || minutes > 600) return null;
  const from = clockMinutes(input.start);
  const times = from !== null ? { start: clock(from), end: clock(Math.min(from + minutes, 1439)) } : {};
  return { student: input.student, date: input.date, kind: input.kind, minutes, note: String(input.note || "").trim().slice(0, 200), ...times };
}

/**
 * One day of this week for a plan with a day guide.
 * done: the day's minutes were delivered. made up: the day came up short, but the week's total is covered.
 * short: the day has passed and its minutes are still missing. today / ahead: not over yet.
 * extra: minutes on a day the guide does not ask for. They count, and the day is never expected again.
 * not met: the teacher said the session did not happen (and why), so it is not waiting to be logged.
 */
export type DayStatus = { day: WeekDay; date: string; planned: number; done: number; state: "done" | "made up" | "short" | "today" | "ahead" | "extra" | "not met" };

export type ServiceStatus = {
  required: number; thisWeek: number; remaining: number; percent: number; owed: number;
  /** This week day by day, for a plan with a day guide: its days, and any other day with minutes. Empty without a guide. */
  days: DayStatus[];
  /** Minutes this week on days the guide does not ask for. */
  extra: number;
  /** What the guide asks for today (0 when today is not one of its days). */
  plannedToday: number;
};

/**
 * This week's minutes against the plan, and how many minutes were missed in the 4 weeks before (the make-up owed).
 * A week is judged by its total: minutes given on any day count, so a session on a day outside the guide
 * helps the week and is never held against a later week that does not have one.
 */
export function serviceStatus(plan: ServicePlan, logs: ServiceLog[], today: string): ServiceStatus {
  const start = weekStart(today);
  const required = weeklyMinutes(plan);
  const thisWeek = delivered(logs, plan, start, addDays(start, 6));
  let owed = 0;
  const first = plan.since ? weekStart(plan.since) : start; // an older plan with no start day owes nothing from before
  for (let w = 1; w <= 4; w++) {
    const from = addDays(start, -7 * w);
    if (from < first) break;
    owed += Math.max(0, required - delivered(logs, plan, from, addDays(from, 6)));
  }
  const guide = cleanDayGuide(plan.days);
  const guided = WEEK_DAYS.some((d) => guide[d]);
  const days: DayStatus[] = [];
  let extra = 0, plannedToday = 0;
  if (guided) {
    WEEK_DAYS.forEach((day, i) => {
      const date = addDays(start, i);
      const planned = guide[day] || 0;
      const done = delivered(logs, plan, date, date);
      if (date === today) plannedToday = planned;
      if (!planned) { if (done > 0) { extra += done; days.push({ day, date, planned: 0, done, state: "extra" }); } return; }
      const skipped = logs.some((l) => l.notMet && l.student === plan.student && l.kind === plan.kind && l.date === date);
      const state = done >= planned ? "done" : skipped ? "not met" : date > today ? "ahead" : date === today ? "today" : thisWeek >= required ? "made up" : "short";
      days.push({ day, date, planned, done, state });
    });
  }
  return { required, thisWeek, remaining: Math.max(0, required - thisWeek), percent: required ? Math.min(100, Math.round((thisWeek / required) * 100)) : 0, owed, days, extra, plannedToday };
}

/** The plan as it will be saved from the form. `days` empty means it is counted by the week. null while it can't be saved. */
export function planFields(input: { student: string; kind: string; perWeek: unknown; days: WeekDay[]; perDay: unknown; start?: unknown; end?: unknown }): Pick<ServicePlan, "student" | "kind" | "minutesPerWeek" | "days" | "start" | "end"> | null {
  if (!input.student) return null;
  const days = WEEK_DAYS.filter((d) => input.days.includes(d));
  if (!days.length) {
    const perWeek = Math.round(Number(input.perWeek));
    return Number.isFinite(perWeek) && perWeek > 0 && perWeek <= 3000 ? { student: input.student, kind: input.kind, minutesPerWeek: perWeek } : null;
  }
  const ranged = minutesBetween(input.start, input.end);
  const typed = String(input.perDay ?? "").trim() === "" ? null : Math.round(Number(input.perDay));
  const perDay = typed !== null && Number.isFinite(typed) ? typed : ranged;
  if (perDay === null || perDay <= 0 || perDay > 600) return null;
  const from = clockMinutes(input.start);
  const guide = Object.fromEntries(days.map((d) => [d, perDay]));
  return { student: input.student, kind: input.kind, minutesPerWeek: perDay * days.length, days: guide, ...(from !== null ? { start: clock(from), end: clock(Math.min(from + perDay, 1439)) } : {}) };
}
