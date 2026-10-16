// WorkHub notifications: the bell's list, the reminder choices, and the phone reminders that follow them.
// Run with: npx tsx --test tests/hub-notify.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace, type Workspace } from "../shared/teacherHub";
import { cleanHubNotify, defaultHubNotify } from "../shared/hubNotify";
import { dueHubReminders } from "../shared/hubReminders";
import { workAlerts } from "../shared/hubAlerts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const at = (utc: string) => Date.parse(utc);
const ZONE = "America/Denver";
// Wednesday Oct 7, 2026. 15:00Z is 9:00 in Denver.
const ws = (extra: Record<string, unknown> = {}): Workspace => normalizeWorkspace({
  events: [{ id: "e1", title: "Staff meeting", date: "2026-10-07", start: "14:30", end: "15:15", location: "Room 4", notes: "" }],
  meetings: [{ id: "m1", student: "Sam", type: "IEP", date: "2026-10-07", time: "14:00", room: "Library", notes: "", done: false }],
  tasks: [
    { id: "t1", title: "Call home", dueDate: "2026-10-07", dueTime: "13:20", recurring: "", done: false },
    { id: "t2", title: "Grade quizzes", dueDate: "2026-10-05", recurring: "", done: false },
    { id: "t3", title: "Done already", dueDate: "2026-10-06", recurring: "", done: true },
  ],
  ...extra,
});

test("reminder choices start as what WorkHub always sent, and odd saved values are made safe", () => {
  const d = defaultHubNotify();
  assert.deepEqual(cleanHubNotify(undefined), d);
  assert.deepEqual(cleanHubNotify("nope"), d);
  assert.equal(d.morning.time, "07:00");
  assert.equal(d.headsUp.minutes, 15);
  const odd = cleanHubNotify({ morning: { on: "yes", time: "25:99" }, headsUp: { on: false, minutes: 7, events: false } });
  assert.equal(odd.morning.on, true, "not a true/false value: back to the default");
  assert.equal(odd.morning.time, "07:00");
  assert.equal(odd.headsUp.on, false);
  assert.equal(odd.headsUp.minutes, 15, "only the offered choices count");
  assert.equal(odd.headsUp.events, false);
  assert.equal(odd.headsUp.tasks, true);
  assert.equal(cleanHubNotify({ headsUp: { minutes: 30 } }).headsUp.minutes, 30);
});

test("the choices are kept with the workspace and cleaned when it is read back", () => {
  assert.equal(ws().notify, undefined, "nothing saved means the defaults");
  const saved = ws({ notify: { morning: { on: false, time: "06:30" }, headsUp: { on: true, minutes: 60, events: true, tasks: false, meetings: true } } });
  assert.deepEqual(saved.notify, { morning: { on: false, time: "06:30" }, headsUp: { on: true, minutes: 60, events: true, tasks: false, meetings: true } });
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(saved))).notify, saved.notify, "stays the same after saving and loading");
  assert.deepEqual(ws({ notify: { morning: { time: "bad" } } }).notify?.morning, { on: true, time: "07:00" });
});

test("with no choices saved, the morning summary and the 15-minute event heads-up work as before", () => {
  const morning = dueHubReminders(ws(), at("2026-10-07T13:30:00Z"), ZONE); // 7:30
  assert.deepEqual(morning.map((r) => r.key), ["morning:2026-10-07"]);
  assert.match(morning[0].body, /1 event, 1 meeting, 2 tasks \(1 overdue\)/);
  assert.deepEqual(dueHubReminders(ws(), at("2026-10-07T13:30:00Z"), ZONE, { "morning:2026-10-07": 1 }), [], "once a day");
  assert.deepEqual(dueHubReminders(ws(), at("2026-10-07T18:00:00Z"), ZONE).map((r) => r.title), [], "noon is too late for the morning summary");
  const heads = dueHubReminders(ws(), at("2026-10-07T20:20:00Z"), ZONE, { "morning:2026-10-07": 1 }); // 14:20, event at 14:30
  assert.deepEqual(heads.map((r) => r.title), ["Staff meeting"]);
});

test("meetings and to-dos with a start time get a heads-up too, once each", () => {
  const sent: Record<string, unknown> = { "morning:2026-10-07": 1 };
  const meeting = dueHubReminders(ws(), at("2026-10-07T19:50:00Z"), ZONE, sent); // 13:50, meeting at 14:00
  assert.deepEqual(meeting.map((r) => r.title), ["IEP: Sam"]);
  assert.match(meeting[0].body, /Starts at 2:00 PM · Library/);
  const task = dueHubReminders(ws(), at("2026-10-07T19:10:00Z"), ZONE, sent); // 13:10, to-do at 13:20
  assert.deepEqual(task.map((r) => r.title), ["Call home"]);
  assert.match(task[0].body, /Due at 1:20 PM/);
  assert.deepEqual(dueHubReminders(ws(), at("2026-10-07T19:50:00Z"), ZONE, { ...sent, [meeting[0].key]: 1 }), [], "not sent twice");
  assert.deepEqual(dueHubReminders(ws({ meetings: [{ id: "m2", student: "Al", type: "IEP", date: "2026-10-07", time: "14:00", room: "", notes: "", done: true }] }), at("2026-10-07T19:50:00Z"), ZONE, sent), [], "a finished meeting is left alone");
});

test("the choices decide what is sent: the morning time, how early, and which kinds", () => {
  const sent = { "morning:2026-10-07": 1 };
  const late = ws({ notify: { morning: { on: true, time: "08:30" } } });
  assert.deepEqual(dueHubReminders(late, at("2026-10-07T13:30:00Z"), ZONE), [], "7:30 is before the chosen 8:30");
  assert.deepEqual(dueHubReminders(late, at("2026-10-07T15:00:00Z"), ZONE).map((r) => r.key), ["morning:2026-10-07"], "9:00 is after it");
  assert.deepEqual(dueHubReminders(late, at("2026-10-07T20:00:00Z"), ZONE).map((r) => r.key), [], "five hours after 8:30 is over: 14:00 is too late");
  const off = ws({ notify: { morning: { on: false, time: "07:00" } } });
  assert.deepEqual(dueHubReminders(off, at("2026-10-07T13:30:00Z"), ZONE), []);
  const early = ws({ notify: { headsUp: { on: true, minutes: 60, events: true, tasks: true, meetings: true } } });
  assert.deepEqual(dueHubReminders(early, at("2026-10-07T19:15:00Z"), ZONE, sent).map((r) => r.title).sort(), ["Call home", "IEP: Sam"], "an hour ahead: the to-do at 1:20 and the meeting at 2:00, not yet the 2:30 event");
  assert.deepEqual(dueHubReminders(early, at("2026-10-07T19:35:00Z"), ZONE, sent).map((r) => r.title).sort(), ["IEP: Sam", "Staff meeting"], "later, the event comes in range and the to-do has passed");
  const only = ws({ notify: { headsUp: { on: true, minutes: 60, events: false, tasks: false, meetings: true } } });
  assert.deepEqual(dueHubReminders(only, at("2026-10-07T19:35:00Z"), ZONE, sent).map((r) => r.title), ["IEP: Sam"]);
  const none = ws({ notify: { headsUp: { on: false, minutes: 60, events: true, tasks: true, meetings: true } } });
  assert.deepEqual(dueHubReminders(none, at("2026-10-07T19:35:00Z"), ZONE, sent), []);
});

test("the bell lists what needs doing today, with poll answers on top", () => {
  const now = new Date(2026, 9, 7, 13, 0).getTime(); // 1:00 PM on the computer's clock
  const items = workAlerts(ws(), "2026-10-07", now, 2);
  assert.equal(items[0].key, "work:polls:2:0");
  assert.equal(workAlerts(ws(), "2026-10-07", now, 2, "2026-10-07T15:00:00Z")[0].key, "work:polls:2:" + Date.parse("2026-10-07T15:00:00Z"), "a new batch of answers gets a new key, so an earlier clear does not hide it");
  assert.equal(items[0].title, "2 new meeting poll answers");
  assert.equal(items[0].target?.type, "work:polls");
  assert.equal(workAlerts(ws(), "2026-10-07", now, 1)[0].title, "1 new meeting poll answer");
  const titles = items.map((i) => i.title);
  assert.ok(titles.includes("Grade quizzes") && titles.includes("Call home") && titles.includes("IEP: Sam"));
  assert.ok(titles.includes("Staff meeting at 2:30 PM"), "an event in the next three hours");
  assert.ok(!titles.includes("Done already"), "finished to-dos are not listed");
  assert.ok(items.every((i) => i.key.startsWith("work:") && i.kind === "action"), "kept on this device, cleared by doing the thing");
  const overdue = items.find((i) => i.title === "Grade quizzes")!;
  assert.match(overdue.body, /^Overdue since/);
  assert.equal(overdue.category, "report");
  assert.equal(overdue.target?.type, "work:tasks");
  assert.equal(items.find((i) => i.title === "IEP: Sam")?.target?.type, "work:iep");
  assert.deepEqual(workAlerts(normalizeWorkspace({}), "2026-10-07", now), [], "an empty day lists nothing");
  assert.ok(!workAlerts(ws({ events: [{ id: "e9", title: "Tomorrow", date: "2026-10-08", start: "14:30", end: "", location: "", notes: "" }] }), "2026-10-07", now).some((i) => i.title.startsWith("Tomorrow")));
});

test("the Hub shows the full bell and settings, and the bell keeps this device's items", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /<NotificationBell[\s\S]*?extraItems=\{hubReady \? workAlerts\(/, "the header bell lists today's work");
  assert.match(hub, /onSettings=\{\(\) => setNotifyOpen\(true\)\}/);
  assert.match(hub, /<HubNotifySettings token=\{token\} workspace=\{workspace\} setWorkspace=\{setWorkspace\} \/>/, "Home's notifications card carries the choices");
  assert.ok(!hub.includes("<HubPollBell"), "the poll-only bell is gone");
  assert.match(hub, /usePollAnswers\(token, user\?\.id, hubReady\)/);
  const hookAt = hub.indexOf("usePollAnswers(token"), returnAt = hub.indexOf('if (!user) return <Redirect to="/signin" replace />;');
  assert.ok(hookAt > 0 && hookAt < returnAt, "the hook runs before any early return, so hooks keep their order");
  const bell = read("client/src/components/NotificationBell.tsx");
  assert.match(read("shared/notificationDismiss.ts"), /key\.startsWith\("work:"\)/);
  assert.match(bell, /isLocalKey/);
});
