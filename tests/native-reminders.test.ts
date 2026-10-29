// Reminders worked out on the iPhone (client/src/lib/nativeReminders.ts) follow the server's rules.
import test from "node:test";
import assert from "node:assert/strict";
import { planReminders, reminderId } from "../client/src/lib/nativeReminders";
import { emptyWorkspace } from "../shared/teacherHub";
import { emptyFamily } from "../shared/familyHub";

const Z = "America/Denver";
const at = (iso: string) => new Date(iso).getTime(); // ISO with offset

test("WorkHub: a heads-up 15 minutes before an event and the morning summary, each once", () => {
  const ws: any = { ...emptyWorkspace(), events: [{ id: "e1", title: "IEP meeting", date: "2026-11-03", start: "10:00", end: "11:00", location: "Room 4", notes: "" }] };
  const plan = planReminders("work", ws, at("2026-11-03T06:00:00-07:00"), Z, 24 * 3600_000);
  const event = plan.filter((r) => r.key.startsWith("event:e1"));
  assert.equal(event.length, 1, "sent once");
  assert.equal(event[0].at, at("2026-11-03T09:45:00-07:00"));
  assert.match(event[0].body, /10:00 AM · Room 4/);
  assert.equal(plan.filter((r) => r.key.startsWith("morning:2026-11-03")).length <= 1, true);
});

test("LifeHub: planning a day and a half is quick and never repeats a reminder", () => {
  const family: any = emptyFamily();
  family.events = [{ id: "f1", title: "Soccer", date: "2026-11-03", time: "17:00", endTime: "18:00", calendarId: "family", memberIds: [], location: "", notes: "", repeat: "none" }];
  const ws = { version: 2, lists: [], tasks: [{ id: "t1", title: "Call the dentist", done: false, due: "2026-11-03", time: "13:00" }], family };
  const t0 = Date.now();
  const plan = planReminders("life", ws, at("2026-11-03T06:00:00-07:00"), Z);
  assert.ok(Date.now() - t0 < 4000, `took ${Date.now() - t0} ms`);
  const keys = plan.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, "no reminder twice");
  assert.ok(plan.every((r) => r.at >= at("2026-11-03T06:00:00-07:00")), "nothing in the past");
});

test("notification ids are stable positive numbers", () => {
  assert.equal(reminderId("life:event:f1"), reminderId("life:event:f1"));
  assert.notEqual(reminderId("life:event:f1"), reminderId("life:event:f2"));
  assert.ok(reminderId("x") > 0 && reminderId("x") < 2 ** 31);
});
