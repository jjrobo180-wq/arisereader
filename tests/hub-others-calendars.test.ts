// Teacher Hub: other people's calendars (a social worker's, another teacher's) that a teacher follows to
// plan meetings around, the message that asks someone for their calendar's link, and the IEP pages
// saying "availability" where they used to say "free times".
// Run with: npx tsx --test tests/hub-others-calendars.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIT_WORDS } from "../shared/availability";
import { calendarEvents } from "../shared/hubHidden";
import { ASK_CALENDAR_SUBJECT, BUSY_TITLE, CALENDAR_LINK_STEPS, askForCalendarMessage, busyPeople, cleanOwner, isOthers, othersCalendars, othersEvents } from "../shared/hubOthers";
import { dueHubReminders } from "../shared/hubReminders";
import { HUB_IMPORT_LIMITS, normalizeWorkspace, removeCalendar, replaceCalendarEvents, type HubCalendar } from "../shared/teacherHub";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
let n = 0;
const makeId = () => `id${++n}`;
const event = (title: string, date: string, start = "", end = "") => ({ title, date, start, end, location: "Room 4", notes: "With the Lopez family" });
const mine: HubCalendar = { id: "me", name: "School", url: "https://calendar.google.com/me.ics", syncedAt: "2026-10-07T15:00:00.000Z" };
const rivera: HubCalendar = { id: "r", name: "Ms. Rivera", url: "https://calendar.google.com/rivera.ics", syncedAt: "2026-10-07T15:00:00.000Z", owner: "Ms. Rivera", busyOnly: true };
const chen: HubCalendar = { id: "c", name: "Mr. Chen", url: "https://outlook.office365.com/chen.ics", syncedAt: "2026-10-07T15:00:00.000Z", owner: "Mr. Chen" };

/** A Hub with the teacher's own calendar and two people followed. */
function hub() {
  let w = normalizeWorkspace({ events: [{ id: "typed", ...event("Typed by hand", "2026-10-08", "13:00", "13:30") }] });
  w = replaceCalendarEvents(w, mine, [event("Staff meeting", "2026-10-08", "15:30", "16:30")], makeId);
  w = replaceCalendarEvents(w, rivera, [event("Home visit: Jordan L.", "2026-10-08", "09:00", "10:00"), event("Counseling group", "2026-10-09", "10:00", "10:45"), event("B day", "2026-10-08")], makeId);
  w = replaceCalendarEvents(w, chen, [event("Evaluation", "2026-10-08", "09:30"), event("Team meeting", "2026-10-12", "08:00", "08:30")], makeId);
  return w;
}

test("someone else's calendar is kept apart from the teacher's own", () => {
  const w = hub();
  assert.deepEqual([isOthers(mine), isOthers(rivera), isOthers({ owner: "   " }), cleanOwner("  Ms.   Rivera,  social worker "), cleanOwner(7), cleanOwner("x".repeat(200)).length], [false, true, false, "Ms. Rivera, social worker", "", 60]);
  assert.deepEqual([cleanOwner("ms. rivera, social worker"), cleanOwner("Dr. de la Cruz")], ["Ms. Rivera, Social Worker", "Dr. de la Cruz"], "a name typed all in small letters gets its capitals");
  assert.deepEqual(othersCalendars(w).map((c) => c.name), ["Ms. Rivera", "Mr. Chen"]);
  assert.deepEqual(othersCalendars({}), []);
  // The teacher's calendar has only the teacher's own events: nothing of theirs is drawn, counted as busy, or reminded about.
  assert.deepEqual(calendarEvents(w, "2026-10-01", "2026-10-31").map((e) => e.title).sort(), ["Staff meeting", "Typed by hand"]);
  assert.deepEqual(calendarEvents({ events: w.events }, "2026-10-01", "2026-10-31").length, 7, "with no list of calendars to go by, nothing can be told apart");
  // 8:50 on Thursday: Ms. Rivera's 9:00 and Mr. Chen's 9:30 are coming up, and neither is the teacher's to be told about.
  const morning = dueHubReminders(w, Date.parse("2026-10-08T14:50:00Z"), "America/Denver");
  assert.ok(morning.every((r) => !/Busy|Evaluation|Home visit/.test(`${r.title} ${r.body}`)), JSON.stringify(morning));
  assert.ok(!JSON.stringify(dueHubReminders(w, Date.parse("2026-10-08T13:30:00Z"), "America/Denver")).includes("4 events"), "the morning count is the teacher's own day");
  // Their events, in order, each with whose it is.
  assert.deepEqual(othersEvents(w, "2026-10-08", "2026-10-12").map((e) => `${e.date} ${e.start || "all day"} ${e.owner}: ${e.title}`), [
    "2026-10-08 all day Ms. Rivera: Busy",
    "2026-10-08 09:00 Ms. Rivera: Busy",
    "2026-10-08 09:30 Mr. Chen: Evaluation",
    "2026-10-09 10:00 Ms. Rivera: Busy",
    "2026-10-12 08:00 Mr. Chen: Team meeting",
  ]);
  assert.deepEqual(othersEvents(w, "2026-10-08", "2026-10-12", ["c"]).map((e) => e.owner), ["Mr. Chen", "Mr. Chen"]);
  assert.deepEqual([othersEvents(w, "2026-10-08", "2026-10-12", []), othersEvents(normalizeWorkspace({}), "2026-10-08", "2026-10-12")], [[], []]);
});

test("from a calendar followed for its busy times, only the times are kept", () => {
  const w = hub();
  const hers = w.events.filter((e) => e.calendarId === "r");
  assert.equal(BUSY_TITLE, "Busy");
  assert.deepEqual(hers.map((e) => [e.title, e.location, e.notes, e.date, e.start, e.end]), [["Busy", "", "", "2026-10-08", "09:00", "10:00"], ["Busy", "", "", "2026-10-09", "10:00", "10:45"], ["Busy", "", "", "2026-10-08", "", ""]], "what her events are, where and with whom is never saved");
  assert.ok(!JSON.stringify(hers).includes("Jordan") && !JSON.stringify(hers).includes("Lopez"));
  assert.deepEqual(w.events.filter((e) => e.calendarId === "c").map((e) => [e.title, e.location]), [["Evaluation", "Room 4"], ["Team meeting", "Room 4"]], "a calendar followed in full keeps what its events are");
  // Reading it again keeps whose it is and how it is kept.
  const again = replaceCalendarEvents(w, { ...rivera, syncedAt: "2026-10-08T15:00:00.000Z" }, [event("Parent call", "2026-10-13", "11:00", "11:15")], makeId);
  assert.deepEqual(again.calendars.find((c) => c.id === "r"), { ...rivera, syncedAt: "2026-10-08T15:00:00.000Z" });
  assert.deepEqual(again.events.filter((e) => e.calendarId === "r").map((e) => [e.title, e.date]), [["Busy", "2026-10-13"]]);
  // It is saved with the workspace, and disconnecting it takes its events away and leaves everyone else's.
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(w))).calendars, [mine, rivera, chen]);
  const gone = removeCalendar(w, "r");
  assert.deepEqual([othersCalendars(gone).map((c) => c.name), gone.events.some((e) => e.calendarId === "r"), gone.events.length], [["Mr. Chen"], false, 4]);
  assert.equal(HUB_IMPORT_LIMITS.calendars, 8, "room for the teacher's own calendars and the people they plan with");
});

test("who is busy at a time", () => {
  const theirs = othersEvents(hub(), "2026-10-08", "2026-10-12");
  const at = (date: string, start: string, end = "") => busyPeople(theirs, { date, start, end });
  assert.deepEqual(at("2026-10-08", "09:00", "10:00"), ["Mr. Chen", "Ms. Rivera"]);
  assert.deepEqual(at("2026-10-08", "08:00", "09:00"), [], "ending as theirs starts is not a clash");
  assert.deepEqual(at("2026-10-08", "10:00", "11:00"), ["Mr. Chen"], "an event with no end is taken as an hour (9:30 to 10:30)");
  assert.deepEqual(at("2026-10-08", "10:30", "11:30"), []);
  assert.deepEqual([at("2026-10-08", "08:15"), at("2026-10-08", "08:45")], [["Ms. Rivera"], ["Mr. Chen", "Ms. Rivera"]], "a time with no end is taken as an hour too");
  assert.deepEqual(at("2026-10-08", "13:00", "14:00"), [], "an all-day note (B day) does not make anyone busy");
  assert.deepEqual(at("2026-10-09", "10:30", "11:00"), ["Ms. Rivera"]);
  assert.deepEqual([at("2026-10-10", "09:00", "10:00"), at("", "09:00"), at("2026-10-08", ""), busyPeople([], { date: "2026-10-08", start: "09:00" })], [[], [], [], []]);
});

test("the message that asks someone for their calendar says where to find the link", () => {
  const message = askForCalendarMessage("  Mr.  Robinson ");
  assert.ok(message.startsWith("Hi,\n\nI am setting up IEP meetings"));
  for (const part of ["Could you send me the link to your calendar?", "It only lets me see when you are busy. I can't change anything on it.",
    'Google Calendar: On a computer, open Google Calendar.', '"Integrate calendar"', '"Secret address in iCal format"', "https://support.google.com/calendar/answer/37648",
    'Outlook: Open your calendar\'s settings', '"Publish a calendar"', '"Can view when I\'m busy"', "copy the ICS link",
    "Apple (iCloud): At icloud.com/calendar", '"Public Calendar"', "Then paste the link in a reply to me. Thank you!"]) assert.ok(message.includes(part), part);
  assert.ok(message.endsWith("Thank you!\n\nMr. Robinson"), "signed with the teacher's name");
  assert.ok(askForCalendarMessage().endsWith("Thank you!"), "and unsigned when there is no name");
  assert.deepEqual(CALENDAR_LINK_STEPS.map((s) => s.app), ["Google Calendar", "Outlook", "Apple (iCloud)"]);
  assert.ok(CALENDAR_LINK_STEPS.every((s) => !s.help || s.help.startsWith("https://support.")), "the help links are the calendar makers' own pages");
  assert.equal(ASK_CALENDAR_SUBJECT, "Could you share your calendar link with me?");
});

test("the Calendar tab follows someone else's calendar, and meeting times are suggested around it", () => {
  const cal = read("client/src/components/teacher-hub/HubCalendar.tsx"), others = read("client/src/components/teacher-hub/HubOthersCalendars.tsx"), poll = read("client/src/components/teacher-hub/HubMeetingPoll.tsx");
  for (const part of ['data-testid="calendar-whose"', '["mine", "My calendar"], ["other", "Someone else\'s"]', 'data-testid="calendar-owner"', 'data-testid="calendar-busy-only"', "Only keep when they are busy, not what their events are.",
    "owner: theirs, ...(busyOnly ? { busyOnly: true } : {})", "Type whose calendar it is", "Paste their calendar's link", "<OthersSchedule workspace={workspace} today={today} />", "<AskForCalendar sender={workspace.profile.senderName", "Someone else's</span>"]) assert.ok(cal.includes(part), part);
  for (const part of ['data-testid="ask-for-calendar"', "How do I get someone else's calendar link?", "askForCalendarMessage(sender)", "CALENDAR_LINK_STEPS.map(", "navigator.clipboard.writeText(text)", "Copy the message", "mailto:?subject=${encodeURIComponent(ASK_CALENDAR_SUBJECT)}", "sms:?&body=", "Email it", "Text it",
    'data-testid="others-schedule"', "othersEvents(workspace, today, addDays(today, 13))", "These are not on your calendar and send you no reminders."]) assert.ok(others.includes(part), part);
  for (const part of ['data-testid="poll-clear-of"', "Also keep clear of:", "othersEvents(workspace, today, addDays(today, 120)", "busyPeople(theirEvents, t)", 'data-testid="poll-busy-people"', "and on the calendars you follow"]) assert.ok(poll.includes(part), part);
  // Everywhere the teacher's own calendar is read, it is read through the one function that leaves other people's events out.
  assert.ok(read("shared/hubReminders.ts").includes("calendarEvents(workspace, date, date)") && cal.includes("calendarEvents(workspace, span.from, span.to)"));
  assert.ok(read("shared/hubHidden.ts").includes("filter(isOthers)"));
});

// ─── The IEP pages say "availability" ───────────────────────────────────────

test('the IEP pages say "availability", with a tip in small letters where it is added', () => {
  const editor = read("client/src/components/teacher-hub/HubAvailability.tsx"), poll = read("client/src/components/teacher-hub/HubMeetingPoll.tsx"), guide = read("client/src/components/teacher-hub/HubGuide.tsx");
  const page = read("client/src/pages/MeetingPoll.tsx"), server = read("server/meetingPoll.ts");
  // What the page shows: everything outside the comments.
  const shown = (source: string) => source.split("\n").filter((line) => !/^\s*(\/\/|\/\*\*|\*)/.test(line)).join("\n").replace(/\/\*\*.*?\*\/|\{\/\*.*?\*\/\}|\/\/ .*$/gm, "");
  for (const [name, source] of [["HubAvailability", editor], ["HubMeetingPoll", poll], ["HubGuide", guide], ["MeetingPoll page", page], ["meetingPoll server", server]] as const) {
    assert.ok(!/free times?|usually free|are free\b/i.test(shown(source)), `${name} still says free time`);
  }
  for (const part of ["My availability", "Save my availability", "Your availability is saved.", "No availability yet.", "Add a time", "Fill in from my availability", "usually available for each time offered"]) assert.ok(editor.includes(part), part);
  for (const part of ["Set your availability first.", "Your availability", "Edit my availability", "Suggested from your availability", "Looking at your availability…", "add more availability"]) assert.ok(poll.includes(part), part);
  assert.ok(guide.includes("Availability (used to suggest meeting times)"));
  assert.ok(page.includes("whether you're usually available for these times, if you saved your availability there"));
  assert.ok(server.includes('"Could not load your availability."') && server.includes('"Could not save your availability."'));
  assert.deepEqual(FIT_WORDS, { free: "Usually available", partly: "Partly available", busy: "Usually busy" });
  // The tip, in small letters, wherever availability is added.
  assert.ok(editor.includes('export const AVAILABILITY_TIP = "Choose your planning block, and avoid Wednesdays if possible.";'));
  assert.ok(editor.includes('<p className="text-xs text-slate-500" data-testid="availability-tip">{label === "you" ? AVAILABILITY_TIP : AVAILABILITY_TIP.replace("your", "their")}</p>'), "smaller than the words around it, and about their planning block when it is someone else's");
  assert.equal(editor.split("<WeeklyEditor").length - 1 + poll.split("<WeeklyEditor").length - 1 + guide.split("<WeeklyEditor").length - 1, 3, "the one editor is used for my own availability, in the meeting planner, and for a person on the team");
  // "you are usually available", and a person's name for someone else.
  assert.ok(editor.includes('{label === "you" ? "you are" : `${label} is`} usually available.'));
  assert.ok(!editor.includes('label="you are"') && !poll.includes('label="you are"'));
});
