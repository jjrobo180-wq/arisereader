// Teacher Hub: service minutes sectioned off by the blocks (periods) of the school day.
// A week is a grid: a row for each block, a column for each day. A cell holds the students seen in that
// block on that day, and the ones due in it. What a cell holds comes from the sessions that were logged
// and from each plan's block and day guide.
import { addDays } from "./hubDates";
import type { SchoolBlock } from "./hubBlocks";
import { WEEK_DAYS, cleanDayGuide, sessionLog, weekStart, weeklyMinutes, type WeekDay } from "./hubProgress";
import type { ServiceLog, ServicePlan } from "./teacherHub";

/**
 * logged: a session that was given. extra: given on a day the student's guide does not ask for (it counts, and is never expected).
 * today: due today. planned: due on a day still to come. missed: the day has passed and the minutes are still missing.
 * made up: the day came up short, but the week's total was covered on other days.
 * any day: a plan counted by the week, with minutes still to give this week. It can be given on any day.
 */
export type BlockState = "logged" | "extra" | "today" | "planned" | "missed" | "made up" | "any day";

/** One student in a cell: a session that was logged, or minutes a plan asks for that are not logged yet. */
export type MinutesItem = {
  key: string; student: string; kind: string; date: string;
  /** The block it is in ("" for none). */
  block: string;
  minutes: number; state: BlockState;
  /** The logged session, for the ones that were given. */
  logId?: string; note?: string;
  /** The plan it belongs to, when the student has one for this service. */
  planId?: string;
};

/** One block on one day. `id` is "" for the students that are in no block. */
export type MinutesCell = { key: string; id: string; items: MinutesItem[]; /** How many can be logged with one tap (due today, or missed). */ todo: number; done: number };

export type MinutesDay = {
  day: WeekDay; date: string;
  /** Minutes the day guides ask for on this day, and minutes logged on it. */
  planned: number; done: number;
  /** One cell for each row of the week, in the same order. */
  cells: MinutesCell[];
  /** short: something was missed. today / ahead: something is still due. done: minutes were given and nothing is missing. empty: nothing here. */
  state: "done" | "short" | "today" | "ahead" | "empty";
};

/** A plan counted by the week that is in no block: it has no place in the grid, so it is shown under it. */
export type AnyDayPlan = { planId: string; student: string; kind: string; required: number; done: number; remaining: number };

export type MinutesWeek = {
  /** The Monday and the Sunday of the week. */
  start: string; end: string;
  /** The rows: the teacher's blocks in order, then a "no block" row (id "") when something is in none. */
  rows: SchoolBlock[];
  days: MinutesDay[];
  /** Minutes all plans ask for in the week, and minutes logged in it. */
  planned: number; done: number;
  anyDay: AnyDayPlan[];
};

const canLog = (state: BlockState) => state === "today" || state === "missed";
const mine = (log: ServiceLog, plan: ServicePlan) => log.student === plan.student && log.kind === plan.kind;
const total = (logs: ServiceLog[]) => logs.reduce((n, l) => n + (Number(l.minutes) || 0), 0);

/**
 * One week of service minutes by block. `weekOf` is any day in the week to show.
 * Monday to Friday are always there; Saturday and Sunday only when something is on them.
 * A plan asks for nothing in the weeks before it started counting, the same as the make-up owed.
 */
export function minutesWeek(plans: ServicePlan[], logs: ServiceLog[], blocks: SchoolBlock[], weekOf: string, today: string): MinutesWeek {
  const start = weekStart(weekOf), end = addDays(start, 6), thisWeek = weekStart(today);
  const inWeek = logs.filter((l) => l.date >= start && l.date <= end);
  const active = plans.filter((p) => start >= (p.since ? weekStart(p.since) : thisWeek));
  const guides = new Map(plans.map((p) => [p.id, cleanDayGuide(p.days)]));
  const guided = (p: ServicePlan) => WEEK_DAYS.some((d) => guides.get(p.id)![d]);
  const known = new Set(blocks.map((b) => b.id));
  /** A plan's block: the one it was put in ("" when that block is gone, or it was never in one). */
  const planBlock = (p: ServicePlan | undefined) => (p?.block && known.has(p.block) ? p.block : "");
  /** A session's block: the one it was logged in, or else its plan's. */
  const logBlock = (l: ServiceLog, p: ServicePlan | undefined) => (l.block && known.has(l.block) ? l.block : planBlock(p));

  const built = WEEK_DAYS.map((day, i) => {
    const date = addDays(start, i);
    const dayLogs = inWeek.filter((l) => l.date === date);
    const items: MinutesItem[] = dayLogs.map((l) => {
      const plan = plans.find((p) => mine(l, p));
      // Extra: the student has a day guide for this service, and this is not one of its days.
      const outside = !!plan && guided(plan) && !guides.get(plan.id)![day];
      return { key: `log:${l.id}`, student: l.student, kind: l.kind, date, block: logBlock(l, plan), minutes: Number(l.minutes) || 0, state: outside ? "extra" : "logged", logId: l.id, ...(l.note ? { note: l.note } : {}), ...(plan ? { planId: plan.id } : {}) };
    });
    let planned = 0;
    for (const p of active) {
      const block = planBlock(p);
      const given = total(inWeek.filter((l) => mine(l, p)));
      if (!guided(p)) {
        // Counted by the week: it sits in its block every school day until the week's minutes are given.
        const left = weeklyMinutes(p) - given;
        if (block && i < 5 && left > 0 && !dayLogs.some((l) => mine(l, p))) items.push({ key: `plan:${p.id}:${date}`, student: p.student, kind: p.kind, date, block, minutes: left, state: "any day", planId: p.id });
        continue;
      }
      const ask = guides.get(p.id)![day] || 0;
      if (!ask) continue;
      planned += ask;
      const left = ask - total(dayLogs.filter((l) => mine(l, p)));
      if (left <= 0) continue;
      const state: BlockState = date > today ? "planned" : date === today ? "today" : given >= weeklyMinutes(p) ? "made up" : "missed";
      items.push({ key: `plan:${p.id}:${date}`, student: p.student, kind: p.kind, date, block, minutes: left, state, planId: p.id });
    }
    return { day, date, planned, done: total(dayLogs), items, show: i < 5 || items.length > 0 };
  }).filter((d) => d.show);

  const rows: SchoolBlock[] = [...blocks, ...(built.some((d) => d.items.some((x) => !x.block)) ? [{ id: "", name: "No block" }] : [])];
  const order = (a: MinutesItem, b: MinutesItem) => a.student.localeCompare(b.student) || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key);
  const days: MinutesDay[] = built.map(({ day, date, planned, done, items }) => {
    const cells = rows.map((row): MinutesCell => {
      const list = items.filter((x) => x.block === row.id).sort(order);
      return { key: `${date}:${row.id}`, id: row.id, items: list, todo: list.filter((x) => canLog(x.state)).length, done: list.filter((x) => x.logId).reduce((n, x) => n + x.minutes, 0) };
    });
    const has = (s: BlockState) => items.some((x) => x.state === s);
    const state: MinutesDay["state"] = has("missed") ? "short" : has("today") ? "today" : has("planned") ? "ahead" : items.some((x) => x.logId || x.state === "made up") ? "done" : "empty";
    return { day, date, planned, done, cells, state };
  });

  const anyDay: AnyDayPlan[] = active.filter((p) => !guided(p) && !planBlock(p)).map((p) => {
    const required = weeklyMinutes(p), done = total(inWeek.filter((l) => mine(l, p)));
    return { planId: p.id, student: p.student, kind: p.kind, required, done, remaining: Math.max(0, required - done) };
  }).sort((a, b) => a.student.localeCompare(b.student) || a.kind.localeCompare(b.kind));

  return { start, end, rows, days, planned: active.reduce((n, p) => n + weeklyMinutes(p), 0), done: total(inWeek), anyDay };
}

/** The sessions to log for these items with one tap: the ones due today or missed, each in its block. */
export function blockLogs(items: MinutesItem[]): Omit<ServiceLog, "id">[] {
  return items.filter((x) => canLog(x.state)).flatMap((x) => {
    const session = sessionLog({ student: x.student, kind: x.kind, date: x.date, minutes: x.minutes });
    return session ? [{ ...session, ...(x.block ? { block: x.block } : {}) }] : [];
  });
}

/** The name of the block a logged session is in: the one it was logged in, or else its plan's. "" when it is in none. */
export function sessionBlockName(log: ServiceLog, plans: ServicePlan[], blocks: SchoolBlock[]): string {
  const name = (id: string | undefined) => (id && blocks.find((b) => b.id === id)?.name) || "";
  return name(log.block) || name(plans.find((p) => mine(log, p))?.block);
}

/** The day of the week to open on: today when it is in the week, or else the first day with something on it, or else Monday. */
export function openDay(week: MinutesWeek, today: string): string {
  return week.days.find((d) => d.date === today)?.date || week.days.find((d) => d.cells.some((c) => c.items.length))?.date || week.start;
}

/** A logged session changed in place. The list handed in is not changed. Nothing changes while the new session can't be saved. */
export function updateLog(logs: ServiceLog[], id: string, session: Omit<ServiceLog, "id"> | null): ServiceLog[] {
  if (!session) return logs;
  // The old block is dropped first, so a session changed to "no block" does not keep it. So is a clock time from before blocks took its place.
  return logs.map((l) => { if (l.id !== id) return l; const { start: _start, end: _end, block: _block, ...rest } = l; return { ...rest, ...session }; });
}

/** The plans with one of them moved to a block ("" takes it out of its block). The list handed in is not changed. */
export function setPlanBlock(plans: ServicePlan[], planId: string, block: string): ServicePlan[] {
  return plans.map((p) => { if (p.id !== planId) return p; const { block: _block, ...rest } = p; return block ? { ...rest, block } : rest; });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 5" for 2026-10-05. */
export function monthDay(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m && MONTHS[Number(m[1]) - 1] ? `${MONTHS[Number(m[1]) - 1]} ${Number(m[2])}` : "";
}
