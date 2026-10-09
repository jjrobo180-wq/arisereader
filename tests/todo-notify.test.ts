import test from "node:test";
import assert from "node:assert/strict";
import { cleanFamily, emptyFamily } from "../shared/familyHub";
import { cleanNotify, dailyEstimate, defaultNotify, inQuiet, spreadTimes } from "../shared/todoNotify";
import { dueTodoReminders } from "../shared/todoReminders";
import { healthSeries, weeklySeries } from "../shared/familyHealth";

const TODAY = "2026-10-09"; // a Friday
const ZONE = "America/Denver"; // UTC-6 in October
const at = (hm: string) => Date.parse(`${TODAY}T${hm}:00-06:00`);

function space(edit: (f: ReturnType<typeof emptyFamily>) => void = () => {}) {
  const family = emptyFamily();
  edit(family);
  return { version: 2, lists: [{ id: "personal", name: "Personal", color: "#7566e8" }], tasks: [], family };
}

test("notification settings: old workspaces get the defaults, junk is cleaned", () => {
  assert.deepEqual(cleanFamily({}).notify, defaultNotify());
  const p = cleanNotify({ water: { on: true, perDay: 99, from: "25:00" }, headsUp: { minutes: 7 }, news: { topic: "<script>" }, workout: { days: [1, 1, 9, 3] } });
  assert.equal(p.water.on, true);
  assert.equal(p.water.perDay, 16);
  assert.equal(p.water.from, "08:00");
  assert.equal(p.headsUp.minutes, 15);
  assert.equal(p.news.topic, "top");
  assert.deepEqual(p.workout.days, [1, 3]);
});

test("reminders spread evenly and quiet hours can run past midnight", () => {
  assert.deepEqual(spreadTimes("08:00", "20:00", 4), ["08:00", "12:00", "16:00", "20:00"]);
  assert.deepEqual(spreadTimes("09:00", "17:00", 1), ["09:00"]);
  const p = { ...defaultNotify(), quiet: { on: true, from: "22:00", until: "07:00" } };
  assert.equal(inQuiet(p, 23 * 60), true);
  assert.equal(inQuiet(p, 6 * 60), true);
  assert.equal(inQuiet(p, 12 * 60), false);
  assert.equal(dailyEstimate({ ...defaultNotify(), water: { ...defaultNotify().water, on: true, perDay: 6 } }, 5), 7);
});

test("water reminders: as many as chosen, each once, and they stop at the goal", () => {
  const ws = space((f) => { f.notify.water = { ...f.notify.water, on: true, perDay: 4, from: "08:00", until: "20:00" }; f.notify.morning.on = false; });
  const noon = dueTodoReminders(ws, at("12:05"), ZONE, {});
  assert.deepEqual(noon.map((r) => r.key), ["todo:water:2026-10-09:1"]); // the 8:00 one is too old by now
  assert.deepEqual(dueTodoReminders(ws, at("12:10"), ZONE, { "todo:water:2026-10-09:1": 1 }), []);
  ws.family.health.days = [{ id: "me:2026-10-09", memberId: "me", date: TODAY, water: 8, steps: 0, fruitVeg: 0 }];
  assert.deepEqual(dueTodoReminders(ws, at("16:00"), ZONE, {}), []);
});

test("meal, workout and weigh-in reminders skip what is already logged", () => {
  const ws = space((f) => {
    f.notify.morning.on = false;
    f.notify.meals = { ...f.notify.meals, on: true };
    f.notify.workout = { ...f.notify.workout, on: true, time: "12:30", days: [5] };
    f.notify.weighIn = { ...f.notify.weighIn, on: true, time: "12:30", days: [5] };
  });
  assert.deepEqual(dueTodoReminders(ws, at("12:31"), ZONE, {}).map((r) => r.key).sort(), ["todo:meal:lunch:2026-10-09", "todo:weigh:2026-10-09", "todo:workout:2026-10-09"]);
  ws.family.health.food = [{ id: "f", memberId: "me", date: TODAY, meal: "lunch", name: "Salad", servings: 1, calories: 300, protein: 5, carbs: 10, fat: 5 }];
  ws.family.health.exercise = [{ id: "x", memberId: "me", date: TODAY, name: "Walk", minutes: 30, calories: 120 }];
  ws.family.health.weights = [{ id: "w", memberId: "me", date: TODAY, weight: 170 }];
  assert.deepEqual(dueTodoReminders(ws, at("12:31"), ZONE, {}), []);
});

test("news reminders are marked for the server to fill in; quiet hours hold everything back", () => {
  const ws = space((f) => { f.notify.morning.on = false; f.notify.news = { ...f.notify.news, on: true, perDay: 2, from: "08:00", until: "18:00", topic: "SPORTS" }; });
  const due = dueTodoReminders(ws, at("18:00"), ZONE, {});
  assert.equal(due.length, 1);
  assert.deepEqual(due[0].news, { topic: "SPORTS", place: "", index: 1 });
  ws.family.notify.quiet = { on: true, from: "17:00", until: "07:00" };
  assert.deepEqual(dueTodoReminders(ws, at("18:00"), ZONE, {}), []);
});

test("the morning summary follows the chosen time and can be turned off", () => {
  const ws = space((f) => { f.notify.morning.time = "09:30"; });
  ws.tasks = [{ id: "t", title: "Call dentist", due: TODAY, done: false } as any];
  assert.deepEqual(dueTodoReminders(ws, at("09:00"), ZONE, {}), []);
  assert.ok(dueTodoReminders(ws, at("09:31"), ZONE, {}).some((r) => r.key === "todo:morning:2026-10-09"));
  ws.family.notify.morning.on = false;
  assert.deepEqual(dueTodoReminders(ws, at("09:31"), ZONE, {}), []);
});

test("chart series: daily totals and weekly averages", () => {
  const h = emptyFamily().health;
  h.food = [
    { id: "1", memberId: "a", date: "2026-10-01", meal: "lunch", name: "x", servings: 2, calories: 500, protein: 10, carbs: 50, fat: 20 },
    { id: "2", memberId: "a", date: "2026-10-02", meal: "lunch", name: "y", servings: 1, calories: 1500, protein: 10, carbs: 50, fat: 20 },
    { id: "3", memberId: "b", date: "2026-10-02", meal: "lunch", name: "z", servings: 1, calories: 900, protein: 1, carbs: 1, fat: 1 },
  ];
  h.exercise = [{ id: "e", memberId: "a", date: "2026-10-02", name: "Run", minutes: 30, calories: 300 }];
  const dates = Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`);
  const days = healthSeries(h, "a", dates);
  assert.equal(days[0].calories, 1000);
  assert.equal(days[0].protein, 20);
  assert.equal(days[1].calories, 1500);
  assert.equal(days[1].burned, 300);
  assert.equal(days[2].logged, false);
  const [week] = weeklySeries(days);
  assert.equal(week.calories, 1250); // average of the two logged days
  assert.equal(week.minutes, 30); // exercise is the week's total
});
