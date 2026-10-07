// Teacher Hub calendar: events that repeat. A repeating event is saved once, with its rhythm; the
// days it falls on are worked out when the calendar is drawn. One of those days (an "occurrence")
// can be checked off, moved or removed on its own without touching the rest.
import { addDays, addMonths } from "./hubDates";
import type { HubEvent, Workspace } from "./teacherHub";

export const EVENT_REPEATS = ["Daily", "Weekdays", "Weekly", "Every 2 weeks", "Monthly", "Yearly"] as const;
export type EventRepeat = (typeof EVENT_REPEATS)[number];
export const REPEAT_LABELS: Record<EventRepeat, string> = {
  Daily: "Every day", Weekdays: "Every weekday (Mon to Fri)", Weekly: "Every week", "Every 2 weeks": "Every 2 weeks", Monthly: "Every month", Yearly: "Every year",
};
export const isRepeat = (value: unknown): value is EventRepeat => (EVENT_REPEATS as readonly string[]).includes(String(value));

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SEP = "~";
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
/** The most days one repeating event is worked out for at a time, so a slip can't freeze the page. */
const MOST = 800;

/** An occurrence's id is its event's id and its day. `date` is "" for a plain event id. */
export function occurrenceOf(id: string): { eventId: string; date: string } {
  const at = id.lastIndexOf(SEP);
  const date = at === -1 ? "" : id.slice(at + 1);
  return DAY.test(date) ? { eventId: id.slice(0, at), date } : { eventId: id, date: "" };
}
export const occurrenceId = (eventId: string, date: string) => `${eventId}${SEP}${date}`;

/** The days a repeating event falls on between `from` and `to` (both included), its skipped days left out. */
export function repeatDates(event: Pick<HubEvent, "date" | "repeat" | "until" | "skip">, from: string, to: string): string[] {
  if (!isRepeat(event.repeat) || !DAY.test(event.date)) return [];
  const last = event.until && DAY.test(event.until) && event.until < to ? event.until : to;
  const skip = new Set(event.skip || []);
  const out: string[] = [];
  const take = (date: string) => { if (date >= from && date <= last && !skip.has(date)) out.push(date); };
  if (event.repeat === "Monthly" || event.repeat === "Yearly") {
    // Counted from the first day each time, so the 31st stays the 31st in the months that have one.
    const step = event.repeat === "Yearly" ? 12 : 1;
    for (let n = 0; n < MOST; n++) { const date = addMonths(event.date, n * step); if (!date || date > last) break; take(date); }
    return out;
  }
  const step = event.repeat === "Weekly" ? 7 : event.repeat === "Every 2 weeks" ? 14 : 1;
  let date = event.date;
  if (date < from) {
    // Jump close to the window, staying on the rhythm.
    const gap = Math.floor((Date.parse(`${from}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000);
    date = addDays(date, Math.floor(gap / step) * step);
  }
  for (let n = 0; n < MOST && date && date <= last; n++, date = addDays(date, step)) {
    if (event.repeat === "Weekdays" && (weekday(date) === 0 || weekday(date) === 6)) continue;
    take(date);
  }
  return out;
}

/**
 * The events to draw between two days. A plain event is passed through as it is (whatever its day).
 * A repeating one becomes one event per day it falls on, each with its own id, its day, whether that
 * day was checked off, and `seriesId` pointing back at the saved event.
 */
export function expandEvents(events: HubEvent[], from: string, to: string): HubEvent[] {
  const out: HubEvent[] = [];
  for (const event of events) {
    if (!isRepeat(event.repeat)) { out.push(event); continue; }
    const { skip: _skip, doneOn, done: _done, ...rest } = event;
    const done = new Set(doneOn || []);
    for (const date of repeatDates(event, from, to)) out.push({ ...rest, id: occurrenceId(event.id, date), seriesId: event.id, date, ...(done.has(date) ? { done: true } : {}) });
  }
  return out;
}

/** The saved event behind something on the calendar: itself, or the repeating event an occurrence belongs to. */
export function savedEvent(workspace: Pick<Workspace, "events">, event: Pick<HubEvent, "id" | "seriesId">): HubEvent | undefined {
  const id = event.seriesId || occurrenceOf(event.id).eventId;
  return workspace.events.find((e) => e.id === id);
}

const uniq = (list: string[]) => [...new Set(list)].sort();
const edit = (workspace: Workspace, eventId: string, to: (event: HubEvent) => HubEvent): Workspace =>
  (workspace.events.some((e) => e.id === eventId) ? { ...workspace, events: workspace.events.map((e) => (e.id === eventId ? to(e) : e)) } : workspace);

/** Checks one day of a repeating event off, or takes the check mark back. */
export function setOccurrenceDone(workspace: Workspace, eventId: string, date: string, done: boolean): Workspace {
  return edit(workspace, eventId, (e) => {
    const { doneOn, ...rest } = e;
    const next = done ? uniq([...(doneOn || []), date]) : (doneOn || []).filter((d) => d !== date);
    return next.length ? { ...rest, doneOn: next } : rest;
  });
}

/** Takes one day out of a repeating event ("delete just this one"). The other days stay. */
export function skipOccurrence(workspace: Workspace, eventId: string, date: string): Workspace {
  return edit(workspace, eventId, (e) => ({ ...e, skip: uniq([...(e.skip || []), date]) }));
}

/** Puts a skipped day back. */
export function unskipOccurrence(workspace: Workspace, eventId: string, date: string): Workspace {
  return edit(workspace, eventId, (e) => {
    const { skip, ...rest } = e;
    const next = (skip || []).filter((d) => d !== date);
    return next.length ? { ...rest, skip: next } : rest;
  });
}

/**
 * Moves one day of a repeating event to another day or time: that day is taken out of the rhythm and
 * a plain, one-time event with the new day and time is added in its place. Returns the new event's id.
 */
export function moveOccurrence(workspace: Workspace, eventId: string, date: string, to: { date: string; start: string; end: string }, makeId: () => string): { workspace: Workspace; newId: string | null } {
  const event = workspace.events.find((e) => e.id === eventId);
  if (!event || !isRepeat(event.repeat) || event.calendarId) return { workspace, newId: null };
  const { repeat: _repeat, until: _until, skip: _skip, doneOn: _doneOn, done: _done, ...rest } = event;
  const newId = makeId();
  const skipped = skipOccurrence(workspace, eventId, date);
  return { workspace: { ...skipped, events: [...skipped.events, { ...rest, id: newId, ...to }] }, newId };
}

/** "Every week", "Every week until Dec 18": how a repeating event is described on its row. */
export function repeatText(event: Pick<HubEvent, "repeat" | "until">): string {
  if (!isRepeat(event.repeat)) return "";
  const label = event.repeat === "Weekdays" ? "Every weekday" : REPEAT_LABELS[event.repeat];
  if (!event.until || !DAY.test(event.until)) return label;
  const d = new Date(`${event.until}T12:00:00`);
  return `${label} until ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
