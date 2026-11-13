// Cooked and Cooked PT notifications: food and sleep reminders, Pause all, session reminders, and the
// switches for alerts from other people.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REPEATING_IDS, buildLocalReminders, cleanReminders, defaultReminders } from "../shared/fitReminders";
import { cleanFitPushPrefs, fitPushAllowed, fitPushKind } from "../shared/fitPush";
import { buildTrainerReminders, cleanTrainerReminders } from "../shared/trainerReminders";

test("meal and log-your-day reminders ring at the times picked and open food logging", () => {
  const r = defaultReminders();
  r.food.meals.breakfast = { on: true, time: "07:45" };
  r.food.meals.dinner = { on: true, time: "18:30" };
  r.food.recap = { on: true, time: "21:00" };
  const out = buildLocalReminders(r);
  assert.deepEqual(out.map((n) => [n.id, n.on.hour, n.on.minute]), [[700, 7, 45], [702, 18, 30], [704, 21, 0]]);
  assert.ok(out.every((n) => n.url === "arisefit://do/meal"));
  for (const n of out) assert.ok(REPEATING_IDS.includes(n.id), `id ${n.id} is cancelled before setting again`);
});

test("sleep: wind down 30 min before bed, bedtime, morning 15 min after waking (across midnight too)", () => {
  const out = buildLocalReminders(defaultReminders(), { bed: "00:15", wake: "06:30", windDown: true, bedtime: true, morning: true });
  assert.deepEqual(out.map((n) => [n.id, n.on.hour, n.on.minute]), [[600, 23, 45], [602, 0, 15], [601, 6, 45]]);
  assert.deepEqual(buildLocalReminders(defaultReminders(), { bed: "22:00", wake: "06:00", windDown: false, bedtime: false, morning: false }), []);
});

test("Pause all: nothing is set; old saves load with every new option off", () => {
  const r = { ...defaultReminders(), paused: true, water: true, weighIn: true };
  assert.deepEqual(buildLocalReminders(r, { bed: "22:00", wake: "06:00", windDown: true, bedtime: true, morning: true }), []);
  const old = cleanReminders({ workout: { on: true, hour: 6, minute: 30, days: [1, 3] }, water: true, weighIn: false, fasting: true });
  assert.equal(old.workout.on, true); assert.equal(old.water, true);
  assert.equal(old.food.meals.lunch.on, false); assert.equal(old.weighTime, "07:15"); assert.equal(old.paused, false);
  assert.equal(cleanReminders({ weighTime: "25:99" }).weighTime, "07:15");
  assert.deepEqual(buildLocalReminders({ ...defaultReminders(), weighIn: true, weighTime: "06:10" }).map((n) => [n.id, n.on.hour, n.on.minute]), [[300, 6, 10]]);
});

test("each server alert falls under a switch, and switched-off alerts are not sent", () => {
  const cases: [string, string, string, string | null][] = [
    ["Ana", "coach-5", "#/trainer", "messages"],
    ["New client request", "coach-5", "#/trainer", "requests"],
    ["Check-in submitted", "coach-5", "#/trainer", "checkins"],
    ["Session requested", "coach-5", "#/trainer", "sessions"],
    ["New workouts from your trainer", "coach-5", "#/fit", "plan"],
    ["Payment received", "pay-x", "#/trainer", "payments"],
    ["Form check", "fc-1", "#/trainer", "form"],
    ["New lead from your website", "lead-1", "#/trainer", "requests"],
    ["Run club", "gpost-3", "#/fit", "groups"],
    ["Sam just trained", "fit-done-4", "#/fit", "friends"],
    ["IEP due", "hub-1", "#/hub", null],
  ];
  for (const [title, tag, url, kind] of cases) assert.equal(fitPushKind({ title, tag, url }), kind, title);
  const prefs = cleanFitPushPrefs({ checkins: false });
  assert.equal(fitPushAllowed(prefs, { title: "Check-in submitted", tag: "coach-1", url: "#/trainer" }), false);
  assert.equal(fitPushAllowed(prefs, { title: "Ana", tag: "coach-1", url: "#/trainer" }), true);
  assert.equal(fitPushAllowed(cleanFitPushPrefs({ all: false }), { title: "Ana", tag: "coach-1", url: "#/fit" }), false, "Pause all");
  assert.equal(fitPushAllowed(cleanFitPushPrefs({ all: false }), { title: "IEP due", tag: "x", url: "#/hub" }), true, "other apps untouched");
  assert.equal(fitPushAllowed(null, { title: "Ana", tag: "coach-1", url: "#/fit" }), true, "no choice saved: on");
});

test("Cooked PT: a reminder before each upcoming session, and the daily plan", () => {
  const now = Date.parse("2026-11-13T15:00:00Z");
  const appts = [{ at: "2026-11-13T18:00:00Z", mins: 60, client: "Ana", place: "Gym" }, { at: "2026-11-13T15:10:00Z", mins: 30, client: "Too soon" }, { at: "2026-11-12T18:00:00Z", mins: 30, client: "Past" }];
  const out = buildTrainerReminders({ ...cleanTrainerReminders(null), before: 30, daily: { on: true, time: "06:30" } }, appts, now);
  assert.deepEqual(out.map((n) => [n.id, n.title, n.at ?? n.on]), [[20000, "Session in 30 min", "2026-11-13T17:30:00.000Z"], [20100, "Plan your day", { hour: 6, minute: 30 }]]);
  assert.match(out[0].body, /Ana · 60 min · Gym/);
  assert.deepEqual(buildTrainerReminders({ ...cleanTrainerReminders(null), paused: true }, appts, now), []);
  assert.deepEqual(buildTrainerReminders({ ...cleanTrainerReminders(null), before: 0 }, appts, now), []);
});

test("the server checks the switches, and both apps have a Notifications screen", () => {
  const push = readFileSync("server/pushNotifications.ts", "utf8");
  assert.match(push, /if \(fitPushKind\(message as any\)\)[\s\S]{0,300}fit_push_prefs_\$\{userId\}[\s\S]{0,200}if \(!fitPushAllowed\(prefs, message as any\)\) return 0;/);
  const coach = readFileSync("server/coach.ts", "utf8");
  assert.match(coach, /app\.get\("\/api\/coach\/push-prefs"/); assert.match(coach, /app\.put\("\/api\/coach\/push-prefs"/);
  const fit = readFileSync("client/src/pages/fit/FitHealth.tsx", "utf8");
  for (const t of ['title="Notifications"', "<Title>Food</Title>", "<Title>Sleep</Title>", "<Title>Training</Title>", "<Title>From other people</Title>", "fit-remind-pause", "fit-remind-bedtime"]) assert.ok(fit.includes(t), t);
  const tr = readFileSync("client/src/pages/trainer/TrainerApp.tsx", "utf8");
  assert.ok(tr.includes("<TrainerNotificationsSheet") && tr.includes("useSessionReminders(token, data?.clients)"));
});
