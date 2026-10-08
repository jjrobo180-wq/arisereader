// Teacher Hub: other people's calendars.
//
// A teacher plans meetings with people who keep their own calendars: a social worker, a psychologist,
// a speech teacher, another teacher. Any of them can share a link to their calendar, and the teacher
// connects it here as someone else's. Their events are kept apart from the teacher's own: they are
// never on the teacher's calendar, never count as the teacher being busy, and never send a reminder.
// They are there to plan around, so meeting times can be suggested when that person is not busy.
import { expandEvents } from "./hubRepeat";
import type { HubCalendar, HubEvent, Workspace } from "./teacherHub";

export const OWNER_NAME_MAX = 60;
/** What a busy time is called when only the times are kept, and not what the events are. */
export const BUSY_TITLE = "Busy";

/** Whose calendar it is, as it is kept: single spaces, not too long, and capitals on a name typed all in small letters. "" for the teacher's own. */
export const cleanOwner = (value: unknown): string => {
  const name = (typeof value === "string" ? value : "").replace(/\s+/g, " ").trim().slice(0, OWNER_NAME_MAX);
  return name === name.toLowerCase() ? name.replace(/(^|[\s-])(\p{L})/gu, (_all, before: string, letter: string) => before + letter.toUpperCase()) : name;
};

/** Is this connected calendar someone else's? */
export const isOthers = (calendar: Pick<HubCalendar, "owner">): boolean => !!cleanOwner(calendar.owner);

/** The calendars of other people the teacher follows. */
export const othersCalendars = (workspace: { calendars?: HubCalendar[] }): HubCalendar[] => (workspace.calendars || []).filter(isOthers);

/** An event on someone else's calendar, with whose it is. */
export type OthersEvent = HubEvent & { owner: string };

/**
 * What is on other people's calendars between two days, in order. `only` keeps it to some of the
 * calendars (by id); left out, it is all of them.
 */
export function othersEvents(workspace: Pick<Workspace, "events"> & { calendars?: HubCalendar[] }, from: string, to: string, only?: string[]): OthersEvent[] {
  const owners = new Map(othersCalendars(workspace).filter((c) => !only || only.includes(c.id)).map((c) => [c.id, cleanOwner(c.owner)]));
  if (!owners.size) return [];
  return expandEvents((workspace.events || []).filter((e) => e.calendarId && owners.has(e.calendarId)), from, to)
    .map((e) => ({ ...e, owner: owners.get(e.calendarId!)! }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || "") || a.owner.localeCompare(b.owner));
}

const minutes = (hm: string | undefined) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/**
 * Who is busy at a time: the people with something on their calendar that overlaps it. An event with no
 * end, and a time with no end, are taken as an hour long. An all-day event does not make anyone busy
 * (it is usually a note, like a day of the school cycle).
 */
export function busyPeople(events: OthersEvent[], time: { date: string; start: string; end?: string }): string[] {
  const from = minutes(time.start);
  if (from === null || !time.date) return [];
  const end = minutes(time.end);
  const to = end !== null && end > from ? end : from + 60;
  const busy = new Set<string>();
  for (const e of events) {
    if (e.date !== time.date) continue;
    const start = minutes(e.start);
    if (start === null) continue;
    const stop = minutes(e.end);
    if (start < to && (stop !== null && stop > start ? stop : start + 60) > from) busy.add(e.owner);
  }
  return [...busy].sort((a, b) => a.localeCompare(b));
}

// ─── Asking someone for their calendar ──────────────────────────────────────

/** How a person gets the link to their own calendar, for each kind of calendar. Written to that person. */
export const CALENDAR_LINK_STEPS: { app: string; steps: string; help?: string }[] = [
  {
    app: "Google Calendar",
    steps: 'On a computer, open Google Calendar. Click the gear at the top right, then Settings. On the left, under "Settings for my calendars", click your calendar\'s name. Click "Integrate calendar" and copy the link under "Secret address in iCal format".',
    help: "https://support.google.com/calendar/answer/37648",
  },
  {
    app: "Outlook",
    steps: 'Open your calendar\'s settings, then Calendar, then "Shared calendars". Under "Publish a calendar" pick your calendar, choose "Can view when I\'m busy", press Publish, and copy the ICS link.',
    help: "https://support.microsoft.com/office/share-an-outlook-calendar-with-other-people-353ed2c1-3ec5-449d-8c73-6931a0adab88",
  },
  {
    app: "Apple (iCloud)",
    steps: 'At icloud.com/calendar, press the share button next to your calendar, turn on "Public Calendar", and copy the link.',
  },
];

export const ASK_CALENDAR_SUBJECT = "Could you share your calendar link with me?";

/** A message to send to someone, asking for the link to their calendar, with the steps to find it. `sender` signs it. */
export function askForCalendarMessage(sender = ""): string {
  const name = cleanOwner(sender);
  return [
    "Hi,",
    "",
    "I am setting up IEP meetings and want to ask only for times that work for you. Could you send me the link to your calendar? It only lets me see when you are busy. I can't change anything on it.",
    "",
    "Here is where to find the link:",
    "",
    ...CALENDAR_LINK_STEPS.flatMap((s) => [`${s.app}: ${s.steps}${s.help ? ` Steps with pictures: ${s.help}` : ""}`, ""]),
    "Then paste the link in a reply to me. Thank you!",
    ...(name ? ["", name] : []),
  ].join("\n");
}
