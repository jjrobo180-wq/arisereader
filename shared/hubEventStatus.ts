// Arise WorkHub calendar: keeping up with events. An event can be checked off as done, snoozed
// (pushed back an hour, a day or a week), or rescheduled; and the ones that are over and were
// never checked off are gathered up so the teacher can say what happened.
import { clockOf, isPast, shiftDay, type Now } from "./hubCalendar";
import { isRepeat, moveOccurrence, occurrenceOf, setOccurrenceDone } from "./hubRepeat";
import type { HubEvent, Workspace } from "./teacherHub";

export type Snooze = "hour" | "tomorrow" | "week";
export const SNOOZES: { id: Snooze; label: string }[] = [
  { id: "hour", label: "1 hour" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "Next week" },
];

/** How far back "Did these happen?" looks. Older events are left in peace. */
export const CHECK_BACK_DAYS = 14;

const mins = (hm: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** Events the teacher can move: their own. A connected calendar's events are changed in that calendar. */
export const canMove = (event: Pick<HubEvent, "calendarId">) => !event.calendarId;

/** The ways this event can be snoozed. An all-day event has no hour to push back. */
export const snoozesFor = (event: Pick<HubEvent, "start">) => SNOOZES.filter((s) => s.id !== "hour" || mins(event.start) !== null);

/**
 * When a snoozed event lands. It never lands in the past: an event that is already over is counted
 * from now ("1 hour" is an hour from now, "Tomorrow" is tomorrow). It keeps its length.
 */
export function snoozedTo(event: Pick<HubEvent, "date" | "start" | "end">, how: Snooze, now: Now): { date: string; start: string; end: string } | null {
  const from = event.date < now.date ? now.date : event.date;
  if (how === "tomorrow" || how === "week") return { date: shiftDay(from, how === "week" ? 7 : 1), start: event.start, end: event.end };
  const start = mins(event.start);
  if (start === null) return null;
  const end = mins(event.end);
  const length = end !== null && end > start ? end - start : null;
  const begun = event.date < now.date || (event.date === now.date && start <= now.minutes);
  let at = (begun ? Math.ceil(now.minutes / 5) * 5 : start) + 60;
  let date = from;
  if (at >= 1440) { at -= 1440; date = shiftDay(date, 1); }
  return { date, start: clockOf(at), end: length === null ? "" : clockOf(Math.min(at + length, 1439)) };
}

const change = (workspace: Workspace, eventId: string, to: (event: HubEvent) => HubEvent): Workspace => {
  if (!workspace.events.some((e) => e.id === eventId)) return workspace;
  return { ...workspace, events: workspace.events.map((e) => (e.id === eventId ? to(e) : e)) };
};
const withoutDone = (event: HubEvent): HubEvent => { const { done: _done, ...rest } = event; return rest; };

/** Checks an event off as done, or takes the check mark back. Works for connected calendars' events too, and for one day of a repeating event. */
export function setEventDone(workspace: Workspace, eventId: string, done: boolean): Workspace {
  const one = occurrenceOf(eventId);
  if (one.date) return setOccurrenceDone(workspace, one.eventId, one.date, done);
  return change(workspace, eventId, (e) => (done ? { ...e, done: true } : withoutDone(e)));
}

/** Checks off several at once ("Mark all done"). */
export function setEventsDone(workspace: Workspace, eventIds: string[]): Workspace {
  const ids = new Set(eventIds);
  return ids.size ? { ...workspace, events: workspace.events.map((e) => (ids.has(e.id) ? { ...e, done: true } : e)) } : workspace;
}

/**
 * Moves one of the teacher's own events later. It is not done any more, and a pin on it follows.
 * For one day of a repeating event (`occurrence`), only that day moves: see `moveOccurrence`.
 */
export function snoozeEvent(workspace: Workspace, eventId: string, how: Snooze, now: Now, occurrence?: { event: HubEvent; makeId: () => string }): Workspace {
  if (occurrence) {
    const one = occurrenceOf(eventId);
    const to = one.date && canMove(occurrence.event) ? snoozedTo(occurrence.event, how, now) : null;
    return to ? moveOccurrence(workspace, one.eventId, one.date, to, occurrence.makeId).workspace : workspace;
  }
  const event = workspace.events.find((e) => e.id === eventId);
  const to = event && canMove(event) ? snoozedTo(event, how, now) : null;
  if (!event || !to) return workspace;
  return {
    ...change(workspace, eventId, (e) => ({ ...withoutDone(e), ...to })),
    pins: (workspace.pins || []).map((pin) => (pin.kind === "event" && pin.refId === eventId && pin.snap ? { ...pin, snap: { title: event.title, date: to.date, start: to.start } } : pin)),
  };
}

/**
 * "Did these happen?": the teacher's own events from the last two weeks that are over and were never
 * checked off, oldest first. Connected calendars are left out, so a synced timetable does not turn
 * into a wall of questions; those events can still be checked off one by one. Repeating events are
 * left out for the same reason.
 */
export function needsCheck<T extends Pick<HubEvent, "date" | "start" | "end" | "done" | "calendarId" | "title">>(events: T[], now: Now, days = CHECK_BACK_DAYS): T[] {
  const since = shiftDay(now.date, -days);
  return events
    .filter((e) => !e.done && canMove(e) && !isRepeat((e as { repeat?: unknown }).repeat) && e.date >= since && isPast(e, now))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || "") || a.title.localeCompare(b.title));
}
