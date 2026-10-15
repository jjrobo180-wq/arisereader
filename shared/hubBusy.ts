// Arise WorkHub: what is already booked, so meeting times are never offered on top of it, and so a day
// that already has a meeting can say so. Reads the teacher's own calendar (repeating events worked out
// day by day, hidden ones left out) and the meetings that have a day and time even when no calendar event
// was made for them. Other people's calendars are in shared/hubOthers.ts.
import { calendarEvents } from "./hubHidden";
import type { Workspace } from "./teacherHub";

export type Booked = { date: string; start: string; end: string; title: string; meeting: boolean };

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const mins = (hm: string) => Number(hm.split(":")[0]) * 60 + Number(hm.split(":")[1]);
const MEETINGISH = /meeting|\biep\b|\bieep\b|annual review|re-?eval|conference|eligibility|staffing|\b504\b|\bcse\b/i;
const day = (value: string) => String(value || "").slice(0, 10);

/**
 * Everything with a time on the teacher's own calendar between two days, in order. `exceptMeetingId` leaves
 * out the meeting being scheduled (so moving it doesn't clash with itself). Events with no start time
 * (all-day notes) are left out: they don't make a time busy.
 */
export function bookedTimes(ws: Pick<Workspace, "events" | "hiddenEvents" | "meetings"> & { calendars?: Workspace["calendars"] }, from: string, to: string, exceptMeetingId = ""): Booked[] {
  const out: Booked[] = [];
  const covered = new Set<string>();
  for (const e of calendarEvents(ws, from, to)) {
    if (!e.start || !TIME.test(e.start) || (exceptMeetingId && e.meetingId === exceptMeetingId)) continue;
    if (e.meetingId) covered.add(e.meetingId);
    out.push({ date: e.date, start: e.start, end: e.end && TIME.test(e.end) && mins(e.end) > mins(e.start) ? e.end : "", title: e.title || "Event", meeting: !!e.meetingId || MEETINGISH.test(e.title || "") });
  }
  for (const m of ws.meetings || []) {
    const date = day(m.date);
    if (m.done || m.id === exceptMeetingId || covered.has(m.id) || !date || date < from || date > to || !m.time || !TIME.test(m.time)) continue;
    out.push({ date, start: m.time, end: m.end && TIME.test(m.end) && mins(m.end) > mins(m.time) ? m.end : "", title: [m.type || "Meeting", m.student ? `for ${m.student}` : ""].filter(Boolean).join(" "), meeting: true });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** What is booked on one day. */
export const bookedOn = (items: Booked[], date: string): Booked[] => items.filter((b) => b.date === date);

/** What a time would run into. A booking or time with no end is taken as an hour long. */
export function clashes(items: Booked[], time: { date: string; start: string; end?: string }): Booked[] {
  if (!time.date || !TIME.test(time.start || "")) return [];
  const from = mins(time.start);
  const to = time.end && TIME.test(time.end) && mins(time.end) > from ? mins(time.end) : from + 60;
  return bookedOn(items, time.date).filter((b) => mins(b.start) < to && (b.end ? mins(b.end) : mins(b.start) + 60) > from);
}
