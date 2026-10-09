// Arise WorkHub reminders: what is worth a phone notification right now.
//  - A morning summary (7:00 to noon, once a day) of what is on today.
//  - A heads-up 15 minutes before an event that has a start time.
import { calendarEvents } from "./hubHidden";
import { clock12, type Workspace } from "./teacherHub";

export type HubReminder = { key: string; title: string; body: string; url: string };

export const HUB_REMINDER_URL = "/#/workhub";
export const EVENT_HEADS_UP_MINUTES = 15;
export const MORNING_FROM_HOUR = 7;
export const MORNING_UNTIL_HOUR = 12;

/** The wall-clock date and time in a time zone ("America/Denver"), or in UTC when the name is not valid. */
export function localParts(nowMs: number, timeZone: string): { date: string; minutes: number } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  const part = (type: string) => formatter.formatToParts(new Date(nowMs)).find((p) => p.type === type)?.value || "00";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const toMinutes = (hm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Reminders due now that have not been sent (`sent` holds the keys already sent). */
export function dueHubReminders(workspace: Workspace, nowMs: number, timeZone: string, sent: Record<string, unknown> = {}): HubReminder[] {
  const { date, minutes } = localParts(nowMs, timeZone);
  const out: HubReminder[] = [];

  // Repeating events count on the days they fall on; hidden ones do not count at all.
  const todays = calendarEvents(workspace, date, date);
  for (const event of todays) {
    if (event.date !== date || !event.start || event.done) continue;
    const start = toMinutes(event.start);
    if (start === null || minutes >= start || start - minutes > EVENT_HEADS_UP_MINUTES) continue;
    const key = `event:${event.id}:${event.date}:${event.start}`;
    if (sent[key]) continue;
    const where = event.location ? ` · ${event.location}` : "";
    out.push({ key, title: event.title || "Event", body: `Starts at ${clock12(event.start)}${where}`, url: HUB_REMINDER_URL });
  }

  if (minutes >= MORNING_FROM_HOUR * 60 && minutes < MORNING_UNTIL_HOUR * 60) {
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
  return out;
}
