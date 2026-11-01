import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dueTodoReminders } from "../shared/todoReminders";
import { cleanNotify, defaultNotify } from "../shared/todoNotify";
import { emptyFamily } from "../shared/familyHub";
import { snoozeSig } from "../server/snoozeSig";

const ZONE = "America/Denver";
const DAY = "2026-10-20";
// 2026-10-20 in Denver is UTC-6.
const at = (hm: string) => Date.parse(`${DAY}T${hm}:00-06:00`);

function ws(notify: any, extra: { tasks?: any[]; food?: any[] } = {}) {
  const family: any = emptyFamily();
  family.sections = { ...family.sections, health: true };
  family.notify = { ...defaultNotify(), ...notify };
  family.health = { ...family.health, food: extra.food || [] };
  return { family, tasks: extra.tasks || [] };
}
const keys = (list: { key: string }[]) => list.map((r) => r.key);

test("settings: level, to-do nudge and food nudge are kept and cleaned", () => {
  const c = cleanNotify({ level: "persistent", todoNudge: { on: true, times: ["17:30", "12:30", "nope", "17:30"] }, foodNudge: { on: false, time: "21:00" } });
  assert.equal(c.level, "persistent");
  assert.deepEqual(c.todoNudge.times, ["12:30", "17:30"]);
  assert.deepEqual(c.foodNudge, { on: false, time: "21:00" });
  assert.equal(cleanNotify({ level: "loud" }).level, "standard");
  assert.equal(cleanNotify({}).todoNudge.on, true, "on out of the box");
});

test("to-dos still to do: one notification per to-do, only when something's due, and it opens the list", () => {
  const due = ws({}, { tasks: [{ id: "a", title: "Call dentist", due: DAY }, { id: "b", title: "Laundry", due: "2026-10-18" }, { id: "c", title: "Later", due: "2026-10-25" }] });
  const list = dueTodoReminders(due, at("12:31"), ZONE, {}).filter((x) => x.key.startsWith("todo:nudge:tasks"));
  assert.equal(list.length, 2, "one each, not one bundle");
  const dentist = list.find((r) => r.title.startsWith("Call dentist"))!, laundry = list.find((r) => r.title.startsWith("Laundry"))!;
  assert.match(dentist.body, /^Due today/);
  assert.match(laundry.body, /^Overdue since Oct 18/);
  assert.match(dentist.url, /\?go=tasks&view=today$/);
  assert.notEqual(dentist.key, laundry.key);
  // Once sent, the same time doesn't send them again.
  const sent = Object.fromEntries(list.map((r) => [r.key, 1]));
  assert.equal(dueTodoReminders(due, at("12:36"), ZONE, sent).filter((x) => x.key.startsWith("todo:nudge:tasks")).length, 0);
  assert.equal(dueTodoReminders(ws({}, { tasks: [{ id: "c", title: "Later", due: "2026-10-25" }] }), at("12:31"), ZONE, {}).filter((x) => x.key.startsWith("todo:nudge:tasks")).length, 0);
});

test("to-dos still to do: a long list sends the first few on their own and one for the rest", () => {
  const tasks = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, due: DAY }));
  const list = dueTodoReminders(ws({}, { tasks }), at("12:31"), ZONE, {}).filter((x) => x.key.startsWith("todo:nudge:tasks"));
  assert.equal(list.length, 9);
  assert.match(list[list.length - 1].title, /^\+ 4 more to-dos still to do/);
});

test("food not tracked: nothing logged, a missing meal, and nothing once it's all logged", () => {
  const none = dueTodoReminders(ws({}), at("19:31"), ZONE, {}).find((x) => x.key.startsWith("todo:nudge:food"));
  assert.match(none!.title, /haven't tracked your food today/);
  assert.match(none!.url, /go=health/);
  const lunchOnly = ws({}, { food: [{ id: "f", memberId: "me", date: DAY, meal: "lunch", name: "Soup", calories: 200 }, { id: "g", memberId: "me", date: DAY, meal: "breakfast", name: "Eggs", calories: 200 }] });
  const missing = dueTodoReminders(lunchOnly, at("19:31"), ZONE, {}).find((x) => x.key.startsWith("todo:nudge:food"));
  assert.match(missing!.title, /Dinner isn't tracked yet/);
  const all = ws({}, { food: ["breakfast", "lunch", "dinner"].map((meal, i) => ({ id: `x${i}`, memberId: "me", date: DAY, meal, name: "Food", calories: 100 })) });
  assert.equal(dueTodoReminders(all, at("19:31"), ZONE, {}).find((x) => x.key.startsWith("todo:nudge:food")), undefined);
});

test("only important leaves out the nudges; keep after me follows up until it's done", () => {
  const important = dueTodoReminders(ws({ level: "important" }, { tasks: [{ id: "a", title: "T", due: DAY }] }), at("12:31"), ZONE, {});
  assert.equal(important.filter((x) => x.key.includes("nudge")).length, 0);
  const meals = { on: true, which: ["dinner"], times: { ...defaultNotify().meals.times, dinner: "18:00" }, skipIfLogged: true };
  const first = dueTodoReminders(ws({ level: "persistent", meals }), at("18:01"), ZONE, {});
  assert.ok(keys(first).includes(`todo:meal:dinner:${DAY}`));
  const sent = { [`todo:meal:dinner:${DAY}`]: 1 };
  const again = dueTodoReminders(ws({ level: "persistent", meals }), at("18:46"), ZONE, sent);
  assert.ok(keys(again).includes(`todo:meal:dinner:${DAY}:f1`), "follows up 45 minutes later");
  assert.match(again.find((x) => x.key.endsWith(":f1"))!.title, /Still need to log dinner/);
  const logged = ws({ level: "persistent", meals }, { food: [{ id: "f", memberId: "me", date: DAY, meal: "dinner", name: "Pasta", calories: 500 }] });
  assert.ok(!keys(dueTodoReminders(logged, at("18:46"), ZONE, sent)).some((k) => k.endsWith(":f1")), "no follow-up once it's logged");
  const standard = dueTodoReminders(ws({ meals }), at("18:46"), ZONE, sent);
  assert.ok(!keys(standard).some((k) => k.endsWith(":f1")), "standard sends it once");
});

test("snooze: signed per person and reminder; buttons on the notification; tap opens the app, not the welcome page", () => {
  const a = snoozeSig("secret", 7, "todo:meal:dinner:x"), b = snoozeSig("secret", 8, "todo:meal:dinner:x");
  assert.notEqual(a, b);
  assert.equal(a, snoozeSig("secret", 7, "todo:meal:dinner:x"));
  const sw = readFileSync(new URL("../client/public/sw.js", import.meta.url), "utf8");
  assert.match(sw, /action: "snooze", title: "Snooze 30 min"/);
  assert.match(sw, /fetch\("\/api\/push\/snooze"/);
  assert.match(sw, /u\.pathname = "\/app"/);
  assert.match(readFileSync(new URL("../client/public/educator.html", import.meta.url), "utf8"), /location\.replace\("\/app" \+ location\.hash\)/);
  for (const page of ["AriseTodo", "TeacherHub"]) assert.match(readFileSync(new URL(`../client/src/pages/${page}.tsx`, import.meta.url), "utf8"), /<SnoozeBar \/>/);
  const server = readFileSync(new URL("../server/pushNotifications.ts", import.meta.url), "utf8");
  assert.match(server, /app\.post\("\/api\/push\/snooze"/);
  assert.match(server, /sendDueSnoozes\(now\)/);
});
