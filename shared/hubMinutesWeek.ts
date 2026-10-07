// Teacher Hub: service minutes laid out as a week calendar.
// Each day holds time blocks (10:00 to 10:20), and each block holds the students seen, or due, in it.
// What a block holds comes from two places: the sessions that were logged, and each plan's day guide.
import { addDays } from "./hubDates";
import { WEEK_DAYS, cleanDayGuide, sessionLog, weekStart, weeklyMinutes, type WeekDay } from "./hubProgress";
import type { ServiceLog, ServicePlan } from "./teacherHub";

/**
 * logged: a session that was given. extra: given on a day the student's guide does not ask for (it counts, and is never expected).
 * today: due today. planned: due on a day still to come. missed: the day has passed and the minutes are still missing.
 * made up: the day came up short, but the week's total was covered on other days.
 */
export type BlockState = "logged" | "extra" | "today" | "planned" | "missed" | "made up";

/** One student in a block: a session that was logged, or minutes the guide asks for that are not logged yet. */
export type MinutesItem = {
  key: string; student: string; kind: string; date: string;
  /** "HH:MM", or "" when the session has no time. */
  start: string; end: string;
  minutes: number; state: BlockState;
  /** The logged session, for the ones that were given. */
  logId?: string; note?: string;
  /** The plan it comes from, for the ones still to give. */
  planId?: string;
};

/** A time block in a day. `start` is "" for the sessions with no time, which come last. */
export type MinutesBlock = { key: string; start: string; end: string; items: MinutesItem[]; /** How many of them can be logged with one tap (due today, or missed). */ todo: number };

export type MinutesDay = {
  day: WeekDay; date: string;
  /** Minutes the day guides ask for on this day, and minutes logged on it. */
  planned: number; done: number;
  blocks: MinutesBlock[];
  /** short: something was missed. today / ahead: something is still due. done: minutes were given and nothing is missing. empty: nothing here. */
  state: "done" | "short" | "today" | "ahead" | "empty";
};

/** A plan counted by the week only: it has no day of its own, so it is shown beside the days. */
export type AnyDayPlan = { planId: string; student: string; kind: string; required: number; done: number; remaining: number };

export type MinutesWeek = {
  /** The Monday and the Sunday of the week. */
  start: string; end: string;
  days: MinutesDay[];
  /** Minutes all plans ask for in the week, and minutes logged in it. */
  planned: number; done: number;
  anyDay: AnyDayPlan[];
};

const canLog = (state: BlockState) => state === "today" || state === "missed";
const mine = (log: ServiceLog, plan: ServicePlan) => log.student === plan.student && log.kind === plan.kind;
const total = (logs: ServiceLog[]) => logs.reduce((n, l) => n + (Number(l.minutes) || 0), 0);

/**
 * One week of service minutes as a calendar. `weekOf` is any day in the week to show.
 * Monday to Friday are always there; Saturday and Sunday only when something is on them.
 * A plan asks for nothing in the weeks before it started counting, the same as the make-up owed.
 */
export function minutesWeek(plans: ServicePlan[], logs: ServiceLog[], weekOf: string, today: string): MinutesWeek {
  const start = weekStart(weekOf), end = addDays(start, 6), thisWeek = weekStart(today);
  const inWeek = logs.filter((l) => l.date >= start && l.date <= end);
  const active = plans.filter((p) => start >= (p.since ? weekStart(p.since) : thisWeek));
  const guides = new Map(plans.map((p) => [p.id, cleanDayGuide(p.days)]));
  const guided = (p: ServicePlan) => WEEK_DAYS.some((d) => guides.get(p.id)![d]);

  const days: MinutesDay[] = [];
  WEEK_DAYS.forEach((day, i) => {
    const date = addDays(start, i);
    const dayLogs = inWeek.filter((l) => l.date === date);
    const items: MinutesItem[] = dayLogs.map((l) => {
      // Extra: the student has a day guide for this service, and this is not one of its days.
      const outside = plans.some((p) => mine(l, p) && guided(p) && !guides.get(p.id)![day]);
      return { key: `log:${l.id}`, student: l.student, kind: l.kind, date, start: l.start || "", end: l.start ? l.end || "" : "", minutes: Number(l.minutes) || 0, state: outside ? "extra" : "logged", logId: l.id, ...(l.note ? { note: l.note } : {}) };
    });
    let planned = 0;
    for (const p of active) {
      const ask = guides.get(p.id)![day] || 0;
      if (!ask) continue;
      planned += ask;
      const left = ask - total(dayLogs.filter((l) => mine(l, p)));
      if (left <= 0) continue;
      const covered = total(inWeek.filter((l) => mine(l, p))) >= weeklyMinutes(p);
      const state: BlockState = date > today ? "planned" : date === today ? "today" : covered ? "made up" : "missed";
      // The usual time is shown while the whole session is still to give. What is left of a part-given one has no time of its own.
      const whole = left === ask && !!p.start;
      items.push({ key: `plan:${p.id}:${date}`, student: p.student, kind: p.kind, date, start: whole ? p.start! : "", end: whole ? p.end || "" : "", minutes: left, state, planId: p.id });
    }
    const groups = new Map<string, MinutesItem[]>();
    for (const item of items) { const key = item.start ? `${item.start}-${item.end}` : ""; groups.set(key, [...(groups.get(key) || []), item]); }
    const blocks: MinutesBlock[] = [...groups.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
      .map(([key, list]) => {
        const sorted = [...list].sort((a, b) => a.student.localeCompare(b.student) || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
        return { key: `${date}:${key}`, start: sorted[0].start, end: sorted[0].end, items: sorted, todo: sorted.filter((x) => canLog(x.state)).length };
      });
    const has = (s: BlockState) => items.some((x) => x.state === s);
    const state: MinutesDay["state"] = has("missed") ? "short" : has("today") ? "today" : has("planned") ? "ahead" : items.length ? "done" : "empty";
    if (i < 5 || items.length) days.push({ day, date, planned, done: total(dayLogs), blocks, state });
  });

  const anyDay: AnyDayPlan[] = active.filter((p) => !guided(p)).map((p) => {
    const required = weeklyMinutes(p), done = total(inWeek.filter((l) => mine(l, p)));
    return { planId: p.id, student: p.student, kind: p.kind, required, done, remaining: Math.max(0, required - done) };
  }).sort((a, b) => a.student.localeCompare(b.student) || a.kind.localeCompare(b.kind));

  return { start, end, days, planned: active.reduce((n, p) => n + weeklyMinutes(p), 0), done: total(inWeek), anyDay };
}

/** The sessions to log for these block items with one tap: the ones due today or missed, each with its usual time. */
export function blockLogs(items: MinutesItem[]): Omit<ServiceLog, "id">[] {
  return items.filter((x) => canLog(x.state)).flatMap((x) => {
    const session = sessionLog({ student: x.student, kind: x.kind, date: x.date, minutes: x.minutes, ...(x.start ? { start: x.start } : {}) });
    return session ? [session] : [];
  });
}

/** The day of the week to open on: today when it is in the week, or else the first day with something on it, or else Monday. */
export function openDay(week: MinutesWeek, today: string): string {
  return week.days.find((d) => d.date === today)?.date || week.days.find((d) => d.blocks.length)?.date || week.start;
}

/** A logged session changed in place. The list handed in is not changed. Nothing changes while the new session can't be saved. */
export function updateLog(logs: ServiceLog[], id: string, session: Omit<ServiceLog, "id"> | null): ServiceLog[] {
  if (!session) return logs;
  // The old time is dropped first, so a session changed to "no time" does not keep it.
  return logs.map((l) => { if (l.id !== id) return l; const { start: _start, end: _end, ...rest } = l; return { ...rest, ...session }; });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 5" for 2026-10-05. */
export function monthDay(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m && MONTHS[Number(m[1]) - 1] ? `${MONTHS[Number(m[1]) - 1]} ${Number(m[2])}` : "";
}
