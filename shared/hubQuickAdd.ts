// Teacher Hub: the quick "add" pop-up (the + button on every screen, and Add event on the calendar).
// One short form that adds a calendar event, a reminder in "Reminders & to-dos", or both.
import { isRepeat } from "./hubRepeat";
import { clock12, type HubEvent, type Task, type Workspace } from "./teacherHub";

export type QuickKind = "event" | "reminder";

export type QuickForm = {
  kind: QuickKind;
  title: string;
  /** YYYY-MM-DD: the day of the event, or the day a reminder is due ("" for a reminder with no date). */
  date: string;
  start: string;
  end: string;
  location: string;
  /** For an event: put it in Reminders & to-dos as well, due that day. */
  alsoRemind: boolean;
  /** For an event: how it repeats ("" for once), and the last day it can fall on ("" to go on). */
  repeat?: string;
  until?: string;
};

/** What the form adds: an event, a reminder (a to-do), or both. */
export type QuickItems = { event?: Omit<HubEvent, "id">; task?: Omit<Task, "id"> };

export const QUICK_TITLE_MAX = 200;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** What the form adds, or null while there is nothing to add yet (no name, or an event with no day). */
export function quickItems(form: QuickForm): QuickItems | null {
  const title = form.title.trim().slice(0, QUICK_TITLE_MAX).trim();
  if (!title) return null;
  const date = DAY.test(form.date) ? form.date : "";
  const reminder = (name: string): Omit<Task, "id"> => ({ title: name, dueDate: date, recurring: "", done: false });
  if (form.kind === "reminder") return { task: reminder(title) };
  if (!date) return null;
  const start = TIME.test(form.start) ? form.start : "";
  const end = start && TIME.test(form.end) ? form.end : "";
  const repeat = isRepeat(form.repeat) ? form.repeat : "";
  const until = repeat && DAY.test(form.until || "") && form.until! >= date ? form.until! : "";
  const event: Omit<HubEvent, "id"> = { title, date, start, end, location: form.location.trim(), notes: "", ...(repeat ? { repeat } : {}), ...(until ? { until } : {}) };
  // A to-do has a day but no time, so the reminder for a timed event carries the time in its name.
  return form.alsoRemind ? { event, task: reminder(start ? `${title} (${clock12(start)})` : title) } : { event };
}

/** The workspace with the event and the reminder added. The workspace handed in is not changed. */
export function addQuickItems(workspace: Workspace, items: QuickItems, makeId: () => string): Workspace {
  return {
    ...workspace,
    events: items.event ? [...workspace.events, { ...items.event, id: makeId() }] : workspace.events,
    tasks: items.task ? [...workspace.tasks, { ...items.task, id: makeId() }] : workspace.tasks,
  };
}

/** What to tell the teacher once it is added. */
export function quickAddedMessage(items: QuickItems): string {
  if (items.event && items.task) return "Added to your calendar and to Reminders & to-dos.";
  if (items.task) return "Added to Reminders & to-dos.";
  return items.event ? "Added to your calendar." : "";
}

/** The boxes of the "Edit event" pop-up. */
export type EventEdit = { title: string; date: string; start: string; end: string; location: string; notes: string; repeat?: string; until?: string };

/** An edited event tidied up, or null while it can't be saved (no name, or no day). */
export function eventEdit(form: EventEdit): Omit<HubEvent, "id"> | null {
  const event = quickItems({ kind: "event", alsoRemind: false, ...form })?.event;
  return event ? { ...event, notes: form.notes.trim() } : null;
}

/**
 * The workspace with one event changed in place: same event, same spot in the list, and a pin on it
 * follows along. An event from a connected calendar is read again from that calendar, so it is left as it is.
 */
export function updateEvent(workspace: Workspace, eventId: string, form: EventEdit): Workspace {
  const fields = eventEdit(form);
  const old = workspace.events.find((e) => e.id === eventId);
  if (!fields || !old || old.calendarId) return workspace;
  return {
    ...workspace,
    // Moved to another day or time, it has not happened yet, so its check mark comes off.
    events: workspace.events.map((e) => {
      if (e.id !== eventId) return e;
      // How it repeats is set fresh from the form. Its skipped and checked-off days only mean something while it still repeats from the same first day.
      const { done, repeat: _repeat, until: _until, skip, doneOn, ...rest } = e;
      const same = e.date === fields.date && e.start === fields.start;
      const keeps = !!fields.repeat && e.date === fields.date;
      return { ...rest, ...fields, ...(done && same && !fields.repeat ? { done } : {}), ...(keeps && skip?.length ? { skip } : {}), ...(keeps && doneOn?.length ? { doneOn } : {}) };
    }),
    pins: (workspace.pins || []).map((pin) => (pin.kind === "event" && pin.refId === eventId && pin.snap ? { ...pin, snap: { title: fields.title, date: fields.date, start: fields.start } } : pin)),
  };
}
