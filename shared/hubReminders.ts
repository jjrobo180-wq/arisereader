// Arise WorkHub reminders: what is worth a phone notification right now.
//  - A morning summary (by default 7:00 to noon, once a day) of what is on today.
//  - A heads-up (by default 15 minutes) before an event, a to-do or a meeting that has a start time.
//  The teacher's choices are in workspace.notify (see shared/hubNotify.ts).
import { calendarEvents } from "./hubHidden";
import { clock12, type Workspace } from "./teacherHub";
import { HUB_MORNING_WINDOW_MINUTES, cleanHubNotify } from "./hubNotify";
import { iepReminders } from "./hubIep";

export type HubReminder = { key: string; title: string; body: string; url: string };

export const HUB_REMINDER_URL = "/#/workhub";
export const EVENT_HEADS_UP_MINUTES = 15;
export const MORNING_FROM_HOUR = 7;
export const MORNING_UNTIL_HOUR = 12;

/** The wall-clock date and time in a time zone ("America/Denver"), or in UTC when the name is not valid. */
// One formatter per time zone, kept: making one is slow, and the phone plans reminders for every five
// minutes of the next three days (864 times in a row), which froze the app for seconds.
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let f = FORMATTERS.get(timeZone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    }
    if (FORMATTERS.size > 50) FORMATTERS.clear();
    FORMATTERS.set(timeZone, f);
  }
  return f;
};
export function localParts(nowMs: number, timeZone: string): { date: string; minutes: number } {
  const parts = formatterFor(timeZone).formatToParts(new Date(nowMs));
  const part = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const toMinutes = (hm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Reminders due now that have not been sent (`sent` holds the keys already sent). */
/** The phone plans reminders for every five minutes of the next three days (864 checks in a row). Working out
 *  the whole calendar on each one took seconds on a big WorkHub; prepareHubReminders lets a run work out each
 *  day's calendar once and reuse it. */
const PREPARED = Symbol("prepared-hub-reminders");
type Prepared = Workspace & { [PREPARED]?: Map<string, ReturnType<typeof calendarEvents>> };
export function prepareHubReminders(workspace: Workspace): Workspace {
  if ((workspace as Prepared)[PREPARED]) return workspace;
  return { ...workspace, [PREPARED]: new Map() } as Prepared;
}
const daysEvents = (workspace: Workspace, date: string) => {
  const memo = (workspace as Prepared)[PREPARED];
  if (!memo) return calendarEvents(workspace, date, date);
  let list = memo.get(date);
  if (!list) { list = calendarEvents(workspace, date, date); memo.set(date, list); }
  return list;
};
export function dueHubReminders(workspace: Workspace, nowMs: number, timeZone: string, sent: Record<string, unknown> = {}): HubReminder[] {
  const { date, minutes } = localParts(nowMs, timeZone);
  const prefs = cleanHubNotify(workspace.notify);
  const ahead = prefs.headsUp.minutes;
  const out: HubReminder[] = [];
  const soon = (start: number | null) => start !== null && minutes < start && start - minutes <= ahead;

  // Repeating events count on the days they fall on; hidden ones do not count at all.
  const todays = daysEvents(workspace, date);
  if (prefs.headsUp.on && prefs.headsUp.events) {
    for (const event of todays) {
      if (event.date !== date || !event.start || event.done) continue;
      if (!soon(toMinutes(event.start))) continue;
      const key = `event:${event.id}:${event.date}:${event.start}`;
      if (sent[key]) continue;
      const where = event.location ? ` · ${event.location}` : "";
      out.push({ key, title: event.title || "Event", body: `Starts at ${clock12(event.start)}${where}`, url: HUB_REMINDER_URL });
    }
  }

  if (prefs.headsUp.on && prefs.headsUp.meetings) {
    for (const meeting of workspace.meetings || []) {
      if (meeting.done || (meeting.date || "").slice(0, 10) !== date || !meeting.time || !soon(toMinutes(meeting.time))) continue;
      const key = `meeting:${meeting.id}:${date}:${meeting.time}`;
      if (sent[key]) continue;
      const where = meeting.room ? ` · ${meeting.room}` : "";
      out.push({ key, title: `${meeting.type || "Meeting"}${meeting.student ? `: ${meeting.student}` : ""}`, body: `Starts at ${clock12(meeting.time)}${where}`, url: HUB_REMINDER_URL });
    }
  }

  if (prefs.headsUp.on && prefs.headsUp.tasks) {
    for (const task of workspace.tasks || []) {
      if (task.done || (task.dueDate || "").slice(0, 10) !== date || !task.dueTime || !soon(toMinutes(task.dueTime))) continue;
      const key = `task:${task.id}:${date}:${task.dueTime}`;
      if (sent[key]) continue;
      out.push({ key, title: task.title || "To-do", body: `Due at ${clock12(task.dueTime)}`, url: HUB_REMINDER_URL });
    }
  }

  const from = toMinutes(prefs.morning.time) ?? MORNING_FROM_HOUR * 60;
  if (prefs.morning.on && minutes >= from && minutes < Math.min(from + HUB_MORNING_WINDOW_MINUTES, 24 * 60)) {
    const key = `morning:${date}`;
    if (!sent[key]) {
      const events = todays.filter((e) => e.date === date);
      const meetings = (workspace.meetings || []).filter((m) => !m.done && (m.date || "").slice(0, 10) === date);
      const tasks = (workspace.tasks || []).filter((t) => !t.done && t.dueDate && t.dueDate.slice(0, 10) <= date);
      const overdue = tasks.filter((t) => t.dueDate.slice(0, 10) < date).length;
      const bits: string[] = [];
      if (events.length) bits.push(plural(events.length, "event"));
      if (meetings.length) bits.push(plural(meetings.length, "meeting"));
      if (tasks.length) bits.push(overdue ? `${plural(tasks.length, "task")} (${overdue} overdue)` : plural(tasks.length, "task"));
      if (bits.length) {
        const first = events.filter((e) => e.start).sort((a, b) => a.start.localeCompare(b.start))[0];
        const next = first ? ` First up: ${first.title} at ${clock12(first.start)}.` : "";
        out.push({ key, title: "Today in your Arise WorkHub", body: `${bits.join(", ")}.${next}`, url: HUB_REMINDER_URL });
      }
    }
  }
  // IEP: progress checks coming up or missed, and IEP and reevaluation dates getting close (shared/hubIep.ts).
  if (prefs.morning.on && minutes >= from) {
    for (const r of iepReminders(workspace, date)) if (!sent[r.key]) out.push({ ...r, url: HUB_REMINDER_URL });
  }
  return out;
}
