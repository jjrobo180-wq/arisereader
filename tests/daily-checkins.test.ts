// Daily check-ins in LifeHub's task list (shared/dailyCheckins.ts): built from Cooked, habits, routines, pills and
// accountability; doing one from the list writes to the plugin; reminders come at each one's time until it's done.
// Run: npx tsx --test tests/daily-checkins.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFit, type FitData } from "../shared/fit";
import { emptyFamily, cleanFamily, isOn } from "../shared/familyHub";
import { defaultNotify } from "../shared/todoNotify";
import { dueTodoReminders } from "../shared/todoReminders";
import { dayChecklist } from "../shared/fitChecklist";
import { cleanDaily, emptyDaily } from "../shared/dailySettings";
import {
  addWater, buildCheckins, dailyReminderPlan, logMeal, logWeight, logWorkout, markHabit, markMed, markPill, markRoutine, removeFood, shownCheckins, tickCooked, withDone,
} from "../shared/dailyCheckins";

const DAY = "2026-11-24";
const ZONE = "America/Denver";
const at = (hm: string) => Date.parse(`${DAY}T${hm}:00-07:00`);
let n = 0;
const ids = () => `id${++n}`;
const fit = (): FitData => emptyFit();
const byId = (list: { id: string }[], id: string) => list.find((c) => c.id === id)!;

test("Cooked: breakfast, lunch, dinner, a workout and water, at LifeHub's meal times", () => {
  const fam = emptyFamily();
  const list = buildCheckins({ date: DAY, fit: fit(), family: fam });
  assert.deepEqual(list.map((c) => c.id), ["cooked:breakfast", "cooked:lunch", "cooked:workout", "cooked:dinner", "cooked:water"]);
  assert.equal(byId(list, "cooked:breakfast").time, fam.notify.meals.times.breakfast);
  assert.ok(list.every((c) => !c.done));
  assert.equal(byId(list, "cooked:water").reminds, false, "water has no time, so no reminder");
});

test("logging a meal from the list puts it in Cooked's diary and ticks the row; taking it off unticks it", () => {
  let d = logMeal(fit(), DAY, "lunch", [{ name: "Turkey sandwich", kcal: 430, p: 30 }, { name: "Apple", kcal: 95 }], ids);
  assert.equal(d.foods.length, 2);
  assert.equal(d.foods[0].meal, "lunch");
  assert.equal(d.foods[0].date, DAY);
  assert.equal(d.recentFoods[0].name, "Turkey sandwich", "added to Cooked's recent foods");
  const lunch = byId(buildCheckins({ date: DAY, fit: d }), "cooked:lunch");
  assert.equal(lunch.done, true);
  assert.match(lunch.detail, /Turkey sandwich, Apple · 525 cal/);
  for (const f of d.foods) d = removeFood(d, f.id);
  assert.equal(byId(buildCheckins({ date: DAY, fit: d }), "cooked:lunch").done, false);
});

test("a meal logged inside Cooked ticks the row too (they read the same diary)", () => {
  const d: FitData = { ...fit(), foods: [{ id: "f", date: DAY, meal: "breakfast", name: "Oatmeal", kcal: 300, p: 10, c: 50, f: 5, servings: 1 }] };
  assert.equal(byId(buildCheckins({ date: DAY, fit: d }), "cooked:breakfast").done, true);
});

test("ticking a meal without logging it counts as done in the list and in Cooked's own day checklist", () => {
  const c = byId(buildCheckins({ date: DAY, fit: fit() }), "cooked:dinner");
  const d = tickCooked(fit(), c, DAY, true);
  const after = byId(buildCheckins({ date: DAY, fit: d }), "cooked:dinner");
  assert.equal(after.done, true);
  assert.equal(after.byHand, true);
  assert.match(dayChecklist(d, DAY).items.find((i) => i.id === "food")!.detail, /^1 of 3 meals/);
  assert.equal(byId(buildCheckins({ date: DAY, fit: tickCooked(d, after, DAY, false) }), "cooked:dinner").done, false);
});

test("workouts: a quick log counts in Cooked, a tick is a rest day", () => {
  const d = logWorkout(fit(), "Walk", 30, new Date(`${DAY}T17:40:00`), ids);
  assert.equal(d.workouts[0].secs, 1800);
  const w = byId(buildCheckins({ date: DAY, fit: d }), "cooked:workout");
  assert.equal(w.done, true);
  assert.match(w.detail, /Walk · 30 min/);
  assert.equal(dayChecklist(d, DAY).items.find((i) => i.id === "workout")?.done, true, "Cooked's checklist sees it");
  const rest = tickCooked(fit(), byId(buildCheckins({ date: DAY, fit: fit() }), "cooked:workout"), DAY, true);
  assert.equal(byId(buildCheckins({ date: DAY, fit: rest }), "cooked:workout").detail, "Rest day");
});

test("water counts up to the goal; weight is kept in kg from the person's units", () => {
  let d = fit();
  for (let i = 0; i < 10; i++) d = addWater(d, DAY, 250);
  assert.equal(byId(buildCheckins({ date: DAY, fit: d }), "cooked:water").done, true);
  assert.equal(addWater(d, DAY, -99999).water[DAY], 0);
  const lb = { ...fit(), profile: { ...fit().profile, units: "lb" as const } };
  const w = logWeight(lb, DAY, 180);
  assert.equal(w.weights[0].kg, 81.6);
  assert.equal(byId(buildCheckins({ date: DAY, fit: w }), "cooked:weight").detail, "179.9 lb");
  assert.equal(logWeight(lb, DAY, 5).weights.length, 0, "nonsense weights are ignored");
});

test("medicines (Cooked) and pills (LifeHub) each dose a row; taking one uses up the supply", () => {
  const d: FitData = { ...fit(), meds: { list: [{ id: "m1", name: "Vitamin D", dose: "1 tab", times: ["08:00", "20:00"], days: [0, 1, 2, 3, 4, 5, 6], note: "", supply: 10, refillDays: 3, remind: true, color: "#000" }], log: {} } };
  const list = buildCheckins({ date: DAY, fit: d });
  const am = byId(list, "cooked:med:m1@08:00");
  assert.equal(am.time, "08:00");
  const taken = markMed(d, am, DAY, "taken");
  assert.equal(taken.meds!.list[0].supply, 9);
  assert.equal(byId(buildCheckins({ date: DAY, fit: taken }), "cooked:med:m1@08:00").done, true);

  const fam = { ...emptyFamily(), pills: [{ id: "p1", memberId: "", name: "Allergy", dose: "5 ml", times: ["19:00"], days: [0, 1, 2, 3, 4, 5, 6], start: "", end: "", supply: null, perDose: 1, refillAt: 0, notes: "", color: "#000", active: true }] } as any;
  const pills = buildCheckins({ date: DAY, family: fam, on: { pills: true } });
  const p = byId(pills, "pill:p1@19:00");
  const after = markPill(fam, p, DAY, "taken", `${DAY}T19:02:00Z`);
  assert.equal(byId(buildCheckins({ date: DAY, family: after, on: { pills: true } }), "pill:p1@19:00").done, true);
  assert.equal(buildCheckins({ date: DAY, family: fam }).length, 0, "nothing from Pills when Pills isn't added");
});

test("habits and routines tick from the list and keep their streak and steps", () => {
  let fam: any = { ...emptyFamily(), habits: [{ id: "h1", name: "Read 10 pages", emoji: "", color: "", days: ["2026-11-22", "2026-11-23"] }],
    routines: [{ id: "r1", name: "Morning", emoji: "", steps: [{ id: "s1", text: "Bed" }, { id: "s2", text: "Teeth" }], doneDate: "", doneSteps: [] }] };
  const on = { habits: true, routines: true };
  assert.equal(byId(buildCheckins({ date: DAY, family: fam, on }), "habit:h1").detail, "2 days in a row");
  fam = markHabit(fam, "h1", DAY, true);
  const h = byId(buildCheckins({ date: DAY, family: fam, on }), "habit:h1");
  assert.equal(h.done, true); assert.equal(h.detail, "3 days in a row");
  fam = markRoutine(fam, "r1", DAY, true, "s1");
  const r = byId(buildCheckins({ date: DAY, family: fam, on }), "routine:r1");
  assert.equal(r.done, false); assert.equal(r.detail, "1 of 2 steps");
  fam = markRoutine(fam, "r1", DAY, true);
  assert.equal(byId(buildCheckins({ date: DAY, family: fam, on }), "routine:r1").done, true);
});

test("accountability: only what's asked of me today, quick to check off when no photo is needed", () => {
  const base = { spaceId: "s", notes: "", kind: "task" as const, createdBy: 2, nag: 0, review: false, worksheet: null, quiz: null, archived: false, createdAt: "2026-11-01T00:00:00Z" };
  const tasks = [
    { ...base, id: "t1", title: "Empty the dishwasher", assignee: 1, repeat: { every: "daily" as const, days: [], date: "" }, due: "17:00", proof: "none" as const },
    { ...base, id: "t2", title: "Clean room", assignee: 1, repeat: { every: "daily" as const, days: [], date: "" }, due: "23:59", proof: "photo" as const },
    { ...base, id: "t3", title: "Not mine", assignee: 2, repeat: { every: "daily" as const, days: [], date: "" }, due: "09:00", proof: "none" as const },
  ];
  const list = buildCheckins({ date: DAY, acct: { me: 1, tasks, checkins: [], names: { 2: "Sam" } } });
  assert.deepEqual(list.map((c) => c.id), ["acct:t1", "acct:t2"]);
  assert.equal(list[0].quick, true); assert.equal(list[0].time, "17:00"); assert.match(list[0].detail, /Asked by Sam/);
  assert.equal(list[1].quick, false); assert.match(list[1].detail, /needs a photo/);
  const done = buildCheckins({ date: DAY, acct: { me: 1, tasks, checkins: [{ id: "c", taskId: "t1", spaceId: "s", day: DAY, by: 1, at: "", status: "approved", note: "", proof: [], answers: {}, score: null, feedback: "", reviewedBy: null, reviewedAt: null }] } });
  assert.equal(done[0].done, true);
});

test("settings hide rows, change times, add a snack; and they survive saving LifeHub", () => {
  const s = { ...emptyDaily(), off: ["cooked:water"], times: { "cooked:breakfast": "06:45" }, extra: ["cooked:snack"] };
  const all = buildCheckins({ date: DAY, fit: fit(), settings: s });
  assert.equal(byId(all, "cooked:breakfast").time, "06:45");
  assert.ok(byId(all, "cooked:snack"));
  const shown = shownCheckins(all, s);
  assert.ok(!shown.items.some((c) => c.id === "cooked:water"));
  assert.equal(shown.total, all.length - 1);
  assert.equal(shownCheckins(all, { ...s, on: false }).total, 0);
  const kept = cleanFamily({ ...emptyFamily(), daily: { ...s, times: { ...s.times, "bad": "25:00" }, off: [...s.off, "<script>"] } }).daily!;
  assert.deepEqual(kept.times, { "cooked:breakfast": "06:45" });
  assert.deepEqual(kept.off, ["cooked:water"]);
  assert.equal(cleanDaily(null), undefined);
});

test("reminders: each meal at its time, the workout, and nothing for what's already done", () => {
  const family: any = cleanFamily({ ...emptyFamily(), sections: { cooked: true }, notify: { ...defaultNotify() } });
  assert.ok(isOn("cooked", family));
  const keys = (hm: string, f = family) => dueTodoReminders({ family: f, tasks: [] }, at(hm), ZONE, {}).map((r) => r.key).filter((k) => k.startsWith("todo:daily"));
  assert.deepEqual(keys("08:01"), [`todo:daily:cooked:breakfast:${DAY}`]);
  assert.deepEqual(keys("17:31"), [`todo:daily:cooked:workout:${DAY}`]);
  // Logged (the phone writes today's done list as things are done, here or in Cooked).
  const all = buildCheckins({ date: DAY, fit: logMeal(fit(), DAY, "breakfast", [{ name: "Eggs", kcal: 150 }], ids) });
  const done = { ...family, daily: withDone(family.daily, DAY, all) };
  assert.deepEqual(keys("08:01", done), []);
  // Turned off, or muted.
  assert.deepEqual(keys("08:01", { ...family, daily: { ...emptyDaily(), remind: false } }), []);
  assert.deepEqual(keys("08:01", { ...family, daily: { ...emptyDaily(), mute: ["cooked:breakfast"] } }), []);
  // Quiet hours win.
  assert.deepEqual(keys("08:01", { ...family, notify: { ...family.notify, quiet: { on: true, from: "22:00", until: "09:00" } } }), []);
});

test("reminders keep after you when 'Keep after me' is on, and old food reminders don't double up", () => {
  const family: any = cleanFamily({ ...emptyFamily(), sections: { cooked: true, health: true }, notify: { ...defaultNotify(), level: "persistent", meals: { ...defaultNotify().meals, on: true } } });
  const all = dueTodoReminders({ family, tasks: [] }, at("08:01"), ZONE, {}).map((r) => r.key);
  assert.ok(all.includes(`todo:daily:cooked:breakfast:${DAY}`));
  assert.ok(!all.some((k) => k.startsWith("todo:meal:")), "the old LifeHub food diary reminder steps aside");
  const plan = dailyReminderPlan({ settings: emptyDaily(), cooked: true, family, habits: false, routines: false }, DAY);
  assert.deepEqual(plan.map((r) => r.id), ["cooked:breakfast", "cooked:lunch", "cooked:workout", "cooked:dinner"]);
});

test("the list draws check-ins as rows of Today, and a to-do's details are a native sheet", () => {
  const looks = readFileSync("client/src/components/teacher-hub/TaskLooks.tsx", "utf8");
  assert.match(looks, /section\("Today", merge\(g\.today, checksLeft\)/);
  assert.match(looks, /const done = prog\.done \+ checksDone\.length, total = prog\.total \+ \(daily \? daily\.total : 0\);/);
  const app = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.match(app, /daily=\{familySpace \? undefined : \{/, "LifeHub only; FamilyHub is shared, check-ins are yours");
  const edit = readFileSync("client/src/components/teacher-hub/HubTaskEdit.tsx", "utf8");
  assert.match(edit, /<NativeSheet title=\{task \? "Details" : "New To-do"\}/);
  assert.doesNotMatch(edit, /HubModal/);
  const sheet = readFileSync("client/src/components/NativeSheet.tsx", "utf8");
  assert.match(sheet, /arise-sheet relative/);
  assert.match(readFileSync("client/src/index.css", "utf8"), /@keyframes arise-sheet-up/);
});
