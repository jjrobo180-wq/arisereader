// Every hub's check-ins remind (Nov 24, 2026): LifeHub, FamilyHub (shared check-ins and chores) and WorkHub.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFamily } from "../shared/familyHub";
import { emptyDaily } from "../shared/dailySettings";
import { dueFamilyReminders } from "../shared/todoReminders";
import { dueHubReminders } from "../shared/hubReminders";
import { emptyWorkspace } from "../shared/teacherHub";
import { ANYTIME_REMIND, dailyReminderPlan } from "../shared/dailyCheckins";

const DAY = "2026-11-24"; // a Tuesday
const at = (hm: string) => Date.parse(`${DAY}T${hm}:00Z`);
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function familyWs() {
  const f = emptyFamily() as any;
  f.sections = { ...f.sections, chores: true };
  f.chores = [{ id: "dish", title: "Dishes", memberId: "", rotation: [], days: ALL_DAYS, points: 1 }];
  f.daily = { ...emptyDaily(), custom: [{ id: "walk", title: "Walk the dog", time: "07:30", days: ALL_DAYS, by: "Mom" }, { id: "plants", title: "Water plants", time: "", days: ALL_DAYS, by: "" }] };
  f.notify = { ...f.notify, quiet: { ...(f.notify?.quiet ?? {}), on: false } };
  return { family: f, tasks: [] };
}

test("FamilyHub: a shared check-in reminds at its time, with a FamilyHub link", () => {
  const due = dueFamilyReminders(familyWs(), at("07:30"), "UTC");
  const walk = due.find((r) => r.key.startsWith("todo:fam:custom:walk"));
  assert.ok(walk, JSON.stringify(due));
  assert.equal(walk!.title, "Walk the dog");
  assert.match(walk!.url, /^\/#\/familyhub\?go=tasks/);
});

test("FamilyHub: chores and check-ins with no time remind in the early evening until someone does them", () => {
  const ws = familyWs();
  const keys = dueFamilyReminders(ws, at(ANYTIME_REMIND), "UTC").map((r) => r.key);
  assert.ok(keys.some((k) => k.startsWith("todo:fam:chore:dish")), keys.join());
  assert.ok(keys.some((k) => k.startsWith("todo:fam:custom:plants")), keys.join());
  ws.family.choreDone = [{ id: "d1", choreId: "dish", date: DAY, memberId: "", points: 1 }];
  ws.family.daily.log = { [DAY]: { plants: "Dad" } };
  assert.equal(dueFamilyReminders(ws, at(ANYTIME_REMIND), "UTC").length, 0);
});

test("FamilyHub: a reminder already sent isn't sent again", () => {
  const ws = familyWs();
  const first = dueFamilyReminders(ws, at("07:30"), "UTC");
  const sent = Object.fromEntries(first.map((r) => [r.key, 1]));
  assert.equal(dueFamilyReminders(ws, at("07:30"), "UTC", sent).length, 0);
});

test("WorkHub: its own check-ins remind too", () => {
  const ws = { ...emptyWorkspace(), daily: { ...emptyDaily(), custom: [{ id: "email", title: "Clear inbox", time: "09:00", days: ALL_DAYS, by: "" }] } } as any;
  const due = dueHubReminders(ws, at("09:00"), "UTC");
  assert.ok(due.some((r) => r.key === `daily:custom:email:${DAY}` && r.title === "Clear inbox"), JSON.stringify(due));
});

test("a check-in with no time still reminds (once, in the evening)", () => {
  const s = { ...emptyDaily(), custom: [{ id: "x", title: "Stretch", time: "", days: ALL_DAYS, by: "" }] };
  const plan = dailyReminderPlan({ settings: s, cooked: false, family: emptyFamily(), habits: false, routines: false }, DAY);
  assert.deepEqual(plan.map((r) => [r.id, r.time]), [["custom:x", ANYTIME_REMIND]]);
});

test("the iPhone app schedules FamilyHub's reminders and the server sends them", () => {
  const nr = readFileSync("client/src/lib/nativeReminders.ts", "utf8");
  assert.match(nr, /dueFamilyReminders\(life, t, timeZone, sent\)/);
  assert.match(nr, /cancelScheduled\("family"\)/);
  const duo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.match(duo, /scheduleNativeReminders\(familySpace \? "family" : "life", data\)/);
  assert.match(readFileSync("server/pushNotifications.ts", "utf8"), /dueFamilyReminders\(ws, nowMs/);
  assert.match(readFileSync("client/src/components/daily/DailyCheckins.tsx", "utf8"), /Remind the family/);
});
