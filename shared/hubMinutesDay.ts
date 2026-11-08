// Arise WorkHub: the Minutes screen's day page. What is on one day block by block, logging a whole day
// (or some of it) with notes in one go, adding notes to sessions just logged, how complete the minutes
// are, and the part of a workspace another case manager at the school may see.
import { addDays } from "./hubDates";
import { countedPlan, optionalDays, sessionLog, weekStart, weeklyMinutes } from "./hubProgress";
import { canSkip, type MinutesItem, type MinutesWeek } from "./hubMinutesWeek";
import type { ServiceLog, ServicePlan, Workspace } from "./teacherHub";

/** One block of a day with what is in it. Empty blocks are left out. */
export type DaySection = { id: string; name: string; items: MinutesItem[] };

/** The day's students, block by block, in the week's order. */
export function daySections(week: MinutesWeek, date: string): DaySection[] {
  const day = week.days.find((d) => d.date === date);
  if (!day) return [];
  return week.rows.map((row, i) => ({ id: row.id, name: row.name, items: day.cells[i]?.items ?? [] })).filter((s) => s.items.length);
}

/** Still waiting on this day: can be logged, or marked "did not meet". */
export const waiting = (item: Pick<MinutesItem, "state">) => canSkip(item.state);

export type Rate = { done: number; planned: number; percent: number };
const rate = (done: number, planned: number): Rate => ({ done, planned, percent: planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : done > 0 ? 100 : 0 });
const given = (logs: ServiceLog[], p: Pick<ServicePlan, "student" | "kind">, from: string, to: string) =>
  logs.filter((l) => !l.notMet && l.student === p.student && l.kind === p.kind && l.date >= from && l.date <= to).reduce((n, l) => n + (Number(l.minutes) || 0), 0);

/**
 * How complete the minutes are: the day (minutes given of the minutes due), the week, and the four whole
 * weeks before this one (each plan counted from the week it started, and capped at what it asks for, so
 * extra time for one student does not hide a gap for another). `answered` is the day's sessions that
 * were logged or marked "did not meet", of all the day's sessions.
 */
export function completion(week: MinutesWeek, date: string, plans: ServicePlan[], logs: ServiceLog[], today: string, optional = optionalDays({})): { day: Rate; week: Rate; month: Rate; answered: { done: number; total: number } } {
  const day = week.days.find((d) => d.date === date);
  const items = day ? day.cells.flatMap((c) => c.items) : [];
  const counted = plans.map((p) => countedPlan(p, optional));
  const start = weekStart(today);
  let need = 0, got = 0;
  for (const p of counted) {
    const first = p.since ? weekStart(p.since) : start;
    const ask = weeklyMinutes(p);
    for (let w = 1; w <= 4; w++) {
      const from = addDays(start, -7 * w);
      if (from < first) break;
      need += ask;
      got += Math.min(ask, given(logs, p, from, addDays(from, 6)));
    }
  }
  return {
    day: rate(day?.done ?? 0, day?.planned ?? 0),
    week: rate(Math.min(week.done, week.planned || week.done), week.planned),
    month: rate(got, need),
    answered: { done: items.filter((x) => x.logId).length, total: items.filter((x) => x.logId || (x.state !== "planned" && x.state !== "made up")).length },
  };
}

/** A row of the "Log the day" sheet. */
export type DayRow = {
  key: string; student: string; kind: string; date: string; block: string; part?: string; teacher?: string;
  /** Picked to be saved. */
  on: boolean;
  /** Met (minutes are logged) or not (a "did not meet" record with the reason). */
  met: boolean;
  minutes: string;
  /** This student's own note. When it is empty the note for everyone is used. */
  note: string;
};

/** The sheet's rows for a day: everyone still waiting on it, with their usual minutes. */
export function dayRows(sections: DaySection[]): DayRow[] {
  return sections.flatMap((s) => s.items.filter(waiting).map((x): DayRow => ({
    key: x.key, student: x.student, kind: x.kind, date: x.date, block: x.block, ...(x.part ? { part: x.part } : {}), ...(x.teacher ? { teacher: x.teacher } : {}),
    on: x.state === "today" || x.state === "missed", met: true, minutes: x.minutes > 0 ? String(x.minutes) : "", note: "",
  })));
}

const clean = (s: string) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 200);

/**
 * The sessions the sheet saves: a session for each picked row that was met (with its own note, or the note
 * for everyone), and a "did not meet" record for each picked row that was not (the reason, then the note).
 * Nobody is logged twice for the same student, service and day in one save. Rows that can't be saved
 * (no minutes) are left out.
 */
export function daySheetLogs(rows: DayRow[], shared: string, reason: string): Omit<ServiceLog, "id">[] {
  const seen = new Set<string>();
  const all = clean(shared), why = clean(reason);
  return rows.filter((r) => r.on && r.student).flatMap((r) => {
    const key = `${r.student}\n${r.kind}\n${r.date}`;
    if (seen.has(key)) return [];
    const note = clean(r.note) || all;
    const place = { ...(r.block ? { block: r.block } : {}), ...(r.part ? { part: r.part } : {}), ...(r.teacher ? { teacher: r.teacher } : {}) };
    if (!r.met) {
      seen.add(key);
      return [{ student: r.student, date: r.date, kind: r.kind, minutes: 0, note: clean([why, note].filter(Boolean).join(" · ")), notMet: true as const, ...place }];
    }
    const session = sessionLog({ student: r.student, kind: r.kind, date: r.date, minutes: r.minutes, note });
    if (!session) return [];
    seen.add(key);
    return [{ ...session, ...place }];
  });
}

/** Notes put on sessions just logged: one note for all of them, or each one's own (an empty one is left as it was). */
export function withNotes(logs: ServiceLog[], notes: Record<string, string>, shared = ""): ServiceLog[] {
  const all = clean(shared);
  return logs.map((l) => {
    if (!(l.id in notes)) return l;
    const note = clean(notes[l.id]) || all;
    if (!note) return l;
    return { ...l, note: l.notMet && l.note && !l.note.includes(note) ? clean(`${l.note} · ${note}`) : note };
  });
}

// ─── Other case managers ──────────────────────────────────────────────────────
//
// A case manager can let the others at their school see their minutes. Only what the Minutes screen
// needs is shared, view only: the plans, the blocks and optional days, and the last ten weeks of sessions.

export const SHARED_WEEKS = 10;
export type SharedMinutes = Pick<Workspace, "services" | "serviceLogs"> & { minuteBlocks?: Workspace["minuteBlocks"]; minuteOptionalDays?: string[] };
export type Colleague = { id: number; name: string; minutes: SharedMinutes };

/** Has this case manager chosen to let the others at their school see their minutes? */
export const sharesMinutes = (workspace: unknown) => (workspace as { minutesShared?: unknown } | null)?.minutesShared === true;

/** The part of a workspace another case manager sees. Nothing when it is not shared. */
export function sharedMinutes(workspace: unknown, today: string): SharedMinutes | null {
  if (!sharesMinutes(workspace)) return null;
  const w = workspace as Partial<Workspace>;
  const from = addDays(weekStart(today), -7 * (SHARED_WEEKS - 1));
  const services = (Array.isArray(w.services) ? w.services : []).filter((p) => p && typeof p.student === "string" && p.student);
  if (!services.length) return null;
  return {
    services,
    serviceLogs: (Array.isArray(w.serviceLogs) ? w.serviceLogs : []).filter((l) => l && typeof l.date === "string" && l.date >= from),
    ...(Array.isArray(w.minuteBlocks) ? { minuteBlocks: w.minuteBlocks } : {}),
    ...(Array.isArray(w.minuteOptionalDays) ? { minuteOptionalDays: w.minuteOptionalDays } : {}),
  };
}
