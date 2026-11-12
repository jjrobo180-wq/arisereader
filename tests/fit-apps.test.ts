// Cooked apps (shared/fitApps.ts), the new sleep tracking (shared/fitSleep.ts), readiness, interval
// timers and the new guided sessions.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIT_APPS, FIT_APP_BY_ID, TAB_MAX, addApp, appsOf, cleanApps, defaultApps, moveTab, removeApp, toggleTab } from "../shared/fitApps";
import { cleanFit, emptyFit } from "../shared/fit";
import { addNight, cleanSleep, healthNight, nightHours, phoneNight, scheduleNight, sleepScore, sleepStats, clockOf } from "../shared/fitSleep";
import { readiness } from "../shared/fitReadiness";
import { TIMER_PRESETS, cleanTimers, timerSecs, timerSession } from "../shared/fitTimers";
import { SESSIONS, SESSION_BY_ID, sessionSecs, sessionsIn } from "../shared/fitSessions";
import { SIRI_ACTIONS, readLink } from "../shared/fitLinks";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("apps: a full catalog with unique ids, every icon drawn, tabs only for apps with a screen", () => {
  assert.equal(new Set(FIT_APPS.map((a) => a.id)).size, FIT_APPS.length);
  const ui = read("client/src/pages/fit/FitApps.tsx");
  for (const a of FIT_APPS) {
    assert.match(ui, new RegExp(`\\b${a.icon}\\b`), `${a.id} icon ${a.icon} is mapped`);
    assert.ok(a.tile.every((c) => /^#[0-9a-f]{6}$/.test(c)), a.id);
  }
  for (const id of ["yoga", "mind", "mobility", "hiit", "c25k", "sleep", "water", "steps", "recovery", "friends"]) assert.ok(FIT_APP_BY_ID.get(id as any)?.tab, `${id} can be a tab`);
  // Every tab-capable app has a screen in FitApp.tsx.
  const app = read("client/src/pages/fit/FitApp.tsx");
  for (const a of FIT_APPS.filter((x) => x.tab)) assert.ok(app.includes(`case "${a.id}"`), `${a.id} has a screen`);
  for (const a of FIT_APPS.filter((x) => !x.tab)) assert.match(app, new RegExp(`id === "${a.id}"`), `${a.id} opens`);
});

test("apps: start with Train, Food and Run on the tab bar; add, remove, pin, swap and move", () => {
  const d = defaultApps();
  assert.deepEqual(d.tabs, ["train", "food", "run"]);
  assert.ok(d.added.includes("yoga") && d.added.includes("sleep"));
  let a = removeApp(d, "food");
  assert.ok(!a.added.includes("food") && !a.tabs.includes("food"), "removing takes it off the tab bar too");
  a = toggleTab(a, "yoga");
  assert.deepEqual(a.tabs, ["train", "run", "yoga"]);
  a = toggleTab(a, "mind");
  assert.equal(a.tabs.length, TAB_MAX);
  assert.deepEqual(a.tabs, ["train", "run", "mind"], "a full tab bar swaps out its last tab");
  assert.ok(toggleTab(appsOf(undefined), "gyms").tabs.every((t) => t !== "gyms"), "map-only apps never become tabs");
  assert.deepEqual(moveTab(a, "mind", -1).tabs, ["train", "mind", "run"]);
  assert.deepEqual(moveTab(a, "train", -1).tabs, a.tabs);
  assert.ok(addApp(undefined, "c25k").added.includes("c25k"));
  assert.ok(toggleTab({ added: [], tabs: [] }, "sleep").added.includes("sleep"), "pinning adds it");
});

test("apps: saved with Cooked data, cleaned (unknown apps, repeats, too many tabs, tabs not added)", () => {
  const c = cleanApps({ added: ["yoga", "yoga", "bogus", "sleep", "gyms"], tabs: ["yoga", "sleep", "gyms", "water", "yoga"] })!;
  assert.deepEqual(c.added, ["yoga", "sleep", "gyms"]);
  assert.deepEqual(c.tabs, ["yoga", "sleep"]);
  const d = cleanFit({ ...emptyFit(), apps: { added: ["mind"], tabs: ["mind"] }, timers: [{ id: "t1", name: "Rope", work: 45, rest: 15, rounds: 10 }, { name: "no id" }] });
  assert.deepEqual(d.apps, { added: ["mind"], tabs: ["mind"] });
  assert.equal(d.timers?.length, 1);
  assert.equal(cleanFit(emptyFit()).apps, undefined, "no apps saved means the defaults");
});

const H = 3_600_000;
const at = (h: number, m = 0, dayOffset = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.getTime(); };

test("sleep: old nights still load; sources, stages, naps, schedule and reminders are kept", () => {
  const old = cleanSleep({ goalH: 7.5, nights: [{ bed: at(23, 0, -1), wake: at(7) }] })!;
  assert.equal(old.nights.length, 1);
  assert.equal(nightHours(old.nights[0]), 8);
  const s = cleanSleep({ goalH: 8, nights: [{ bed: at(23, 0, -1), wake: at(7), src: "health", stages: { deep: 70, rem: 95, core: 250, awake: 25 }, asleepMin: 415 }, { bed: at(23, 0, -2), wake: at(7, 0, -1), src: "nope" }],
    naps: [{ start: at(14), end: at(14, 25) }, { start: at(14), end: at(14, 2) }], schedule: { bed: "22:30", wake: "06:30" }, remind: { windDown: true, morning: false }, skipped: ["2026-11-01", "x"] })!;
  assert.equal(s.nights[1].src, "health");
  assert.equal(s.nights[0].src, undefined, "an unknown source is dropped");
  assert.equal(nightHours(s.nights[1]), 415 / 60, "hours asleep, not in bed, when Health knows");
  assert.equal(s.naps?.length, 1, "a 2-minute nap isn't one");
  assert.deepEqual(s.schedule, { bed: "22:30", wake: "06:30" });
  assert.deepEqual(s.skipped, ["2026-11-01"]);
  assert.equal(cleanSleep({ schedule: { bed: "25:00", wake: "06:30" } }), undefined);
});

test("sleep: Apple Health stage pieces become one night with deep, REM, core and awake", () => {
  const p = (state: string, h1: number, m1: number, h2: number, m2: number, d1 = -1, d2 = -1) => ({ state, start: at(h1, m1, d1), end: at(h2, m2, d2) });
  const samples = [p("core", 23, 0, 23, 50), p("deep", 23, 50, 0, 40, -1, 0), p("core", 0, 40, 2, 0, 0, 0), p("rem", 2, 0, 2, 45, 0, 0), p("awake", 2, 45, 2, 55, 0, 0), p("core", 2, 55, 5, 0, 0, 0), p("rem", 5, 0, 6, 0, 0, 0),
    // a nap the afternoon before, far from the night: ignored
    { state: "asleep", start: at(15, 0, -1), end: at(15, 30, -1) }];
  const n = healthNight(samples)!;
  assert.equal(n.bed, at(23, 0, -1));
  assert.equal(n.wake, at(6));
  assert.deepEqual(n.stages, { deep: 50, rem: 105, core: 255, awake: 10 });
  assert.equal(n.asleepMin, 410);
  const inBed = healthNight([{ state: "inBed", start: at(22, 30, -1), end: at(6, 30) }])!;
  assert.equal(inBed.asleepMin, 480, "only time in bed: that's the night");
  assert.equal(healthNight([]), null);
});

test("sleep: phone down and up, and the schedule, give last night's times", () => {
  const n = phoneNight(at(23, 10, -1), at(6, 45))!;
  assert.equal(n.bed, at(23, 25, -1), "asleep 15 minutes after the phone went down");
  assert.equal(n.wake, at(6, 45));
  assert.equal(phoneNight(at(13), at(15)), null, "an afternoon break isn't a night");
  assert.equal(phoneNight(at(23, 0, -1), at(23, 30, -1)), null, "too short");
  const sc = scheduleNight({ bed: "22:30", wake: "06:30" });
  assert.equal(sc.wake, at(6, 30)); assert.equal(sc.bed, at(22, 30, -1));
  const late = scheduleNight({ bed: "01:00", wake: "09:00" });
  assert.equal(late.bed, at(1)); assert.equal(late.wake, at(9));
});

test("sleep score: hours, deep and REM (or how rested), and a steady bedtime", () => {
  let s = addNight(undefined, at(23, 0, -2), at(7, 0, -1));
  s = addNight(s, at(23, 0, -1), at(7), 5, { src: "health", stages: { deep: 75, rem: 100, core: 270, awake: 15 }, asleepMin: 445 });
  const great = sleepScore(s.nights[1], s);
  assert.ok(great.score >= 85, `a full night with good stages scores high (${great.score})`);
  const short = sleepScore({ date: "x", bed: at(2), wake: at(6) }, s);
  assert.ok(short.score < 50, `four hours at a late bedtime scores low (${short.score})`);
  assert.deepEqual(great.parts.map((p) => p.of), [60, 25, 15]);
  const st = sleepStats(s, 7);
  assert.equal(st.n, 2);
  assert.equal(clockOf(st.avgBed!), "11:00 PM");
  assert.equal(st.bedSpread, 0);
  assert.equal(clockOf(23 * 60 + 70), "12:10 AM", "past midnight wraps");
});

test("readiness: well slept and recovered is ready to push; short sleep and hard days say ease off", () => {
  const rested = { ...emptyFit(), sleep: addNight(undefined, at(22, 30, -1), at(6, 45), 5, { src: "health", stages: { deep: 80, rem: 105, core: 280, awake: 10 }, asleepMin: 465 }) };
  const r = readiness(rested);
  assert.ok(r.score >= 80, `rested ${r.score}`);
  assert.equal(r.parts.length, 4);
  const hard = { ...emptyFit(), sleep: addNight(undefined, at(2), at(6)),
    workouts: [0, 1, 2].map((d) => ({ id: `w${d}`, date: new Date(Date.now() - d * 864e5 - H).toISOString(), name: "Legs", secs: 3600, exercises: [{ exId: "back-squat", name: "Squat", sets: Array.from({ length: 6 }, () => ({ reps: 8, weight: 225, done: true })) }] })) };
  const t = readiness(hard);
  assert.ok(t.score < 60, `tired ${t.score}`);
  assert.match(t.word, /easier|Rest/);
});

test("interval timers: presets, saved timers and the session they make", () => {
  const tabata = TIMER_PRESETS.find((t) => t.id === "preset-tabata")!;
  assert.equal(timerSecs(tabata), 120 + 8 * 20 + 7 * 10 + 60);
  const s = timerSession(tabata);
  assert.equal(sessionSecs(s), timerSecs(tabata));
  assert.equal(s.phases.filter((p) => p.kind === "work").length, 8);
  const circuit = timerSession(TIMER_PRESETS.find((t) => t.id === "preset-40-20")!);
  assert.equal(circuit.phases.filter((p) => p.name === "Rest between sets").length, 2);
  assert.deepEqual(cleanTimers([{ id: "a", work: 1, rounds: 999 }])[0], { id: "a", name: "My timer", warm: 0, work: 5, rest: 30, rounds: 100, sets: 1, setRest: 60, cool: 0 });
});

test("guided sessions: yoga, breathing and the new mobility routines, every phase timed and cued", () => {
  assert.ok(sessionsIn("yoga").length >= 9, "yoga flows");
  assert.ok(sessionsIn("meditation").length >= 10, "breathing and meditation");
  assert.ok(sessionsIn("mobility").length >= 7, "mobility routines");
  assert.equal(new Set(SESSIONS.map((s) => s.id)).size, SESSIONS.length);
  for (const s of SESSIONS) {
    assert.ok(s.phases.length > 0 && s.phases.every((p) => p.secs > 0 && p.name), s.id);
    if (s.category === "yoga" || s.category === "mobility") assert.ok(s.phases.every((p) => p.cue), `${s.id}: every pose says how`);
  }
  for (const id of ["yoga-morning", "yoga-bedtime", "yoga-lifter", "yoga-flex", "med-478", "med-focus", "med-sigh", "mob-postlift", "mob-desk", "mob-full"]) assert.ok(SESSION_BY_ID.has(id), `${id} is picked by an app`);
  const m = SESSION_BY_ID.get("med-478")!;
  assert.deepEqual(m.phases.slice(1, 4).map((p) => p.secs), [4, 7, 8]);
});

test("Siri and reminders: going to sleep, I'm awake, sleep, yoga and breathe", () => {
  for (const id of ["sleep-start", "sleep-end", "sleep", "yoga", "breathe"]) {
    assert.ok(SIRI_ACTIONS.some((a) => a.id === id), id);
    assert.equal(readLink(`arisefit://do/${id}`).action, id);
  }
  const app = read("client/src/pages/fit/FitApp.tsx");
  assert.match(app, /a === "sleep-start"/); assert.match(app, /a === "sleep-end"/);
  const nat = read("client/src/pages/fit/fitNative.ts");
  assert.match(nat, /dataType: "sleep"/);
  assert.match(nat, /"sleep", "restingHeartRate", "heartRateVariability", "mindfulness"/);
  assert.match(nat, /id: 600, title: "Time to wind down"/);
  assert.match(read("client/src/pages/fit/FitSiri.tsx"), /localNotificationActionPerformed/);
});

test("the website keeps the site's side tabs and pop-ups off Cooked", () => {
  const fs = /const FULLSCREEN_GAME_ROUTES = \[([^\]]+)\]/.exec(read("client/src/App.tsx"))![1];
  for (const r of ["/fit", "/trainer", "/talk"]) assert.ok(fs.includes(`"${r}"`), r);
});
