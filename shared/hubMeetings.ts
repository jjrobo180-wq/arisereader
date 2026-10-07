// Teacher Hub: booking a meeting time. A meeting owns exactly one calendar event, so booking
// again (a "Switch" to another time) moves it instead of adding a second one.
import { markDone } from "./meetingSteps";
import type { HubEvent, Workspace } from "./teacherHub";

export const POLL_EVENT_NOTE = "Time chosen with a meeting poll";

/** The name to put on a message by default: the account name without a trailing "(Admin)". */
export function cleanSenderName(name: string): string {
  return String(name || "").replace(/\s*\((?:admin|administrator)\)\s*$/i, "").replace(/\s+/g, " ").trim();
}

type Booked = { title: string; location?: string };
type Option = { date: string; start: string; end: string };

export function bookMeeting(ws: Workspace, meetingId: string, poll: Booked, option: Option, makeId: () => string): Workspace {
  const meeting = meetingId ? ws.meetings.find((m) => m.id === meetingId) : undefined;
  // Events made by older bookings of this same poll are replaced too (they had no link to the meeting).
  const keep = ws.events.filter((e) => !(meeting && e.meetingId === meeting.id) && !(e.notes === POLL_EVENT_NOTE && e.title === poll.title));
  const event: HubEvent = {
    id: makeId(), title: poll.title, date: option.date, start: option.start, end: option.end, location: poll.location || meeting?.room || "", notes: POLL_EVENT_NOTE,
    ...(meeting ? { meetingId: meeting.id } : {}),
  };
  const events = [...keep, event];
  if (!meeting) return { ...ws, events };
  const room = poll.location || meeting.room || "";
  const meetings = ws.meetings.map((m) => (m.id === meeting.id ? { ...m, date: option.date, time: option.start, end: option.end, room, plan: markDone(markDone(m.plan, 2), 3) } : m));
  const guides = ws.guides.map((g) => (g.student === meeting.student ? { ...g, meetingDate: option.date, meetingTime: option.start, room: room || g.room } : g));
  return { ...ws, events, meetings, guides };
}
