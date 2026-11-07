// One set of screens for both hubs. WorkHub's Notes, Calendar and Journal are LifeHub's screens, and
// LifeHub's Tasks screen is WorkHub's. Each screen reads and writes its own hub's data, so these
// functions translate between the two shapes. What the other screen has no place for (a note's student,
// an event's meeting, a to-do's family member) is kept exactly as it was and never lost.
import { emptyFamily, NOTE_COLORS, type Family, type FamilyCalendar, type FamilyEvent, type JournalEntry, type Note, type EventRepeat } from "./familyHub";
import { emptyWorkspace, type HubEvent, type NoteItem, type Task, type Workspace } from "./teacherHub";

export const WORK_CALENDAR_ID = "work";
const WORK_COLOR = "#0d9488";
const REPEAT_OUT: Record<string, EventRepeat> = { Weekly: "weekly", Monthly: "monthly", Yearly: "yearly", Annually: "yearly" };
const REPEAT_IN: Record<EventRepeat, string> = { none: "", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
const isOthers = (c: { owner?: string }) => !!c.owner;

// ─── Notes ───────────────────────────────────────────────────────────────────

/** What a work note is called on the LifeHub card when it was never given a name: "Check-in · Ava". */
const noteLabel = (n: Pick<NoteItem, "type" | "student" | "students">) => [n.type, (n.students?.length ? n.students.join(", ") : n.student)].filter(Boolean).join(" · ");

export function notesToFamily(notes: NoteItem[]): Note[] {
  return notes.map((n, i): Note => ({
    id: n.id, title: n.title || noteLabel(n), body: n.body || "", color: n.color || NOTE_COLORS[i % NOTE_COLORS.length], pinned: !!n.pinned,
    updatedAt: n.date ? `${n.date}T12:00:00.000Z` : "", ...(n.html ? { html: n.html } : {}), ...(n.locked ? { locked: true } : {}),
  } as Note));
}

/** The work notes after the LifeHub notes screen changed its list. Fields only a work note has stay on it. */
export function notesFromFamily(prev: NoteItem[], next: Note[], today: string): NoteItem[] {
  const before = new Map(prev.map((n) => [n.id, n]));
  return next.map((n): NoteItem => {
    const old = before.get(n.id);
    const day = (n.updatedAt || "").slice(0, 10) || today;
    // A title that is only the label made up for display is not saved as a name.
    const title = old && !old.title && n.title === noteLabel(old) ? undefined : n.title;
    const html = (n as Note & { html?: string }).html;
    const locked = (n as Note & { locked?: boolean }).locked;
    const base = old ?? { id: n.id, student: "", type: "General note", body: "", date: day } as NoteItem;
    const { title: _t, html: _h, locked: _l, ...rest } = base;
    return { ...rest, ...(title ? { title } : {}), body: n.body, color: n.color, pinned: n.pinned, date: old && old.body === n.body && old.date ? old.date : day, ...(html ? { html } : {}), ...(locked ? { locked: true } : {}) };
  });
}

// ─── Calendar ────────────────────────────────────────────────────────────────

/** Linked calendars and the teacher's own, as LifeHub calendars. Other people's calendars stay in their own screen. */
export function calendarsToFamily(w: Pick<Workspace, "calendars"> & { extraCalendars?: FamilyCalendar[]; hiddenCalendars?: string[] }): FamilyCalendar[] {
  // The Work calendar and linked ones keep their on/off in hiddenCalendars: they were always made "on" here,
  // so switching one off on the Calendar screen never stuck.
  const hidden = new Set(w.hiddenCalendars || []);
  return [
    { id: WORK_CALENDAR_ID, name: "Work", color: WORK_COLOR, show: !hidden.has(WORK_CALENDAR_ID) },
    ...(w.extraCalendars || []),
    ...(w.calendars || []).filter((c) => !isOthers(c)).map((c, i): FamilyCalendar => ({ id: c.id, name: c.name, color: ["#7566e8", "#619ee6", "#f59e72", "#db77ac", "#e5b04f"][i % 5], show: !hidden.has(c.id), url: c.url, syncedAt: c.syncedAt })),
  ];
}

/** The events the LifeHub calendar shows: the teacher's own, without other people's calendars or the ones they hid. */
export function eventsToFamily(w: Pick<Workspace, "events" | "calendars" | "hiddenEvents">): FamilyEvent[] {
  const theirs = new Set((w.calendars || []).filter(isOthers).map((c) => c.id));
  const hidden = w.hiddenEvents || [];
  return (w.events || []).filter((e) => !(e.calendarId && theirs.has(e.calendarId)))
    .filter((e) => !hidden.some((h) => h.title.trim().toLowerCase() === e.title.trim().toLowerCase() && (!h.date || (h.date === e.date && h.start === e.start))))
    .map((e): FamilyEvent => ({ id: e.id, title: e.title, date: e.date, time: e.start || "", endTime: e.end || "", calendarId: e.calendarId || WORK_CALENDAR_ID, memberIds: [], location: e.location || "", notes: e.notes || "", repeat: REPEAT_OUT[e.repeat || ""] ?? "none" }));
}

/**
 * The work calendar after the LifeHub calendar changed. Events the screen never showed (other people's,
 * hidden ones) stay. An event keeps what only a work event has (its meeting, students, repeat days).
 */
export function calendarFromFamily(w: Workspace & { extraCalendars?: FamilyCalendar[] }, next: Pick<Family, "calendars" | "events">): Workspace & { extraCalendars?: FamilyCalendar[] } {
  const shown = new Set(eventsToFamily(w).map((e) => e.id));
  const kept = (w.events || []).filter((e) => !shown.has(e.id));
  const old = new Map((w.events || []).map((e) => [e.id, e]));
  const events = next.events.map((e): HubEvent => {
    const was = old.get(e.id);
    const sameRepeat = was && (REPEAT_OUT[was.repeat || ""] ?? "none") === e.repeat;
    const { repeat: _r, until: _u, skip: _s, doneOn: _d, calendarId: _c, ...rest } = was ?? ({ id: e.id } as HubEvent);
    return {
      ...rest, id: e.id, title: e.title, date: e.date, start: e.time || "", end: e.endTime || "", location: e.location || "", notes: e.notes || "",
      ...(e.calendarId && e.calendarId !== WORK_CALENDAR_ID ? { calendarId: e.calendarId } : {}),
      ...(sameRepeat ? { ...(was!.repeat ? { repeat: was!.repeat } : {}), ...(was!.until ? { until: was!.until } : {}), ...(was!.skip ? { skip: was!.skip } : {}), ...(was!.doneOn ? { doneOn: was!.doneOn } : {}) } : REPEAT_IN[e.repeat] ? { repeat: REPEAT_IN[e.repeat] } : {}),
    };
  });
  const theirs = (w.calendars || []).filter(isOthers);
  const linkedOld = new Map((w.calendars || []).map((c) => [c.id, c]));
  const linked = next.calendars.filter((c) => c.url).map((c) => ({ ...(linkedOld.get(c.id) ?? {}), id: c.id, name: c.name, url: c.url!, syncedAt: c.syncedAt || linkedOld.get(c.id)?.syncedAt || "" }));
  const extra = next.calendars.filter((c) => !c.url && c.id !== WORK_CALENDAR_ID);
  // Which of the Work and linked calendars are switched off (the others keep their own "show").
  const hiddenCalendars = next.calendars.filter((c) => c.show === false && (!!c.url || c.id === WORK_CALENDAR_ID)).map((c) => c.id);
  return { ...w, events: [...kept, ...events], calendars: [...theirs, ...linked], extraCalendars: extra, hiddenCalendars };
}

// ─── Journal ─────────────────────────────────────────────────────────────────

export const journalToFamily = (w: Pick<Workspace, "journal">): JournalEntry[] => w.journal || [];

// ─── The LifeHub screens on WorkHub data ─────────────────────────────────────

/** A LifeHub `family` made from the work data, for the screens that were written for it. */
export function familyFromWorkspace(w: Workspace & { extraCalendars?: FamilyCalendar[] }): Family {
  const f = emptyFamily();
  return { ...f, notes: notesToFamily(w.notes || []), journal: journalToFamily(w), calendars: calendarsToFamily(w), events: eventsToFamily(w), layers: { ...f.layers, tasks: false, bills: false, trips: false, chores: false, hub: false } };
}

/** Puts what a LifeHub screen changed in `family` back into the work data. */
export function applyFamilyToWorkspace(w: Workspace & { extraCalendars?: FamilyCalendar[] }, was: Family, next: Family, today: string): Workspace {
  let out: Workspace & { extraCalendars?: FamilyCalendar[] } = w;
  if (next.notes !== was.notes) out = { ...out, notes: notesFromFamily(out.notes || [], next.notes, today) };
  if (next.journal !== was.journal) out = { ...out, journal: next.journal };
  if (next.events !== was.events || next.calendars !== was.calendars) out = calendarFromFamily(out, next);
  return out;
}

// ─── Tasks (WorkHub's screen on LifeHub's to-dos) ────────────────────────────

export type LifeTaskShape = {
  id: string; title: string; notes: string; listId: string; assignee: string; due: string; time: string;
  priority: "low" | "normal" | "high"; repeat: "none" | "daily" | "weekly" | "monthly"; done: boolean; createdAt: string; completedAt?: string; archived?: boolean;
};
const RECUR_OUT: Record<LifeTaskShape["repeat"], string> = { none: "", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const RECUR_IN: Record<string, LifeTaskShape["repeat"]> = { Daily: "daily", Weekly: "weekly", Monthly: "monthly" };

export function lifeTasksToWork(tasks: LifeTaskShape[]): Task[] {
  return tasks.map((t): Task => ({
    id: t.id, title: t.title, dueDate: t.due || "", ...(t.time ? { dueTime: t.time } : {}), recurring: RECUR_OUT[t.repeat] ?? "", done: t.done,
    ...(t.priority === "high" ? { priority: "high" as const } : {}), ...(t.listId ? { listId: t.listId } : {}), ...(t.archived ? { archived: true } : {}),
    ...(t.notes ? { notes: t.notes } : {}), ...(t.done && t.completedAt ? { doneAt: t.completedAt } : {}),
  }));
}

/** LifeHub's to-dos after the WorkHub Tasks screen changed its list: the family member, creation time and low priority stay. */
export function lifeTasksFromWork(prev: LifeTaskShape[], next: Task[], firstList: string, now: string): LifeTaskShape[] {
  const old = new Map(prev.map((t) => [t.id, t]));
  return next.map((t): LifeTaskShape => {
    const was = old.get(t.id);
    const repeat = RECUR_IN[t.recurring] ?? (t.recurring ? (was?.repeat && was.repeat !== "none" ? was.repeat : "monthly") : "none");
    const priority: LifeTaskShape["priority"] = t.priority === "high" ? "high" : was && was.priority === "low" ? "low" : "normal";
    return {
      id: t.id, title: t.title, notes: t.notes || "", listId: t.listId || was?.listId || firstList, assignee: was?.assignee ?? "", due: t.dueDate || "", time: t.dueTime || "",
      priority, repeat, done: t.done, createdAt: was?.createdAt ?? now, ...(t.done ? { completedAt: t.doneAt || was?.completedAt || now } : {}), ...(t.archived ? { archived: true } : {}),
    };
  });
}

// ─── LifeHub's Tasks screen is WorkHub's ─────────────────────────────────────

export type LifeListShape = { id: string; name: string; color: string };

/** The work-data shape WorkHub's Tasks screen reads, made from LifeHub's to-dos and lists. */
export function workspaceFromLifeTasks(life: { tasks: LifeTaskShape[]; lists: LifeListShape[] }): Workspace {
  return { ...emptyWorkspace(), tasks: lifeTasksToWork(life.tasks), taskLists: life.lists.map((l) => ({ id: l.id, name: l.name, color: l.color })) };
}

/**
 * LifeHub's to-dos and lists after the Tasks screen changed `was` into `next`. Only the tasks and lists are read.
 * The last list can't be removed (LifeHub always has one), and a to-do whose list was removed moves to the first.
 */
export function applyWorkTasksToLife<T extends { tasks: LifeTaskShape[]; lists: LifeListShape[] }>(life: T, was: Workspace, next: Workspace, now: string): T {
  let lists = life.lists;
  if (next.taskLists !== was.taskLists) {
    const wanted = (next.taskLists || []).map((l) => ({ id: l.id, name: l.name, color: l.color }));
    if (wanted.length) lists = wanted;
  }
  let tasks = life.tasks;
  if (next.tasks !== was.tasks || lists !== life.lists) {
    const first = lists[0]?.id ?? "";
    const known = new Set(lists.map((l) => l.id));
    tasks = lifeTasksFromWork(life.tasks, next.tasks, first, now).map((t) => (known.has(t.listId) ? t : { ...t, listId: first }));
  }
  return tasks === life.tasks && lists === life.lists ? life : { ...life, tasks, lists };
}
