// Arise Fit, the Fitbod-style rebuild: muscle recovery from the sets you log, today's workout built
// for you from your freshest muscles, the body map, designed cover art and the Light/Dark themes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG_BY_ID, emptyFit, type Workout } from "../shared/fit";
import { BODY_PARTS, FOCUS_MUSCLES, alternatives, chooseFocus, generateWorkout, recovery, recoveryLevel } from "../shared/fitRecovery";

const NOW = new Date("2026-11-01T18:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const sets = (n: number, extra: Partial<{ warm: boolean; done: boolean }> = {}) => Array.from({ length: n }, () => ({ reps: 8, weight: 100, done: true, ...extra }));
const workout = (hoursAgo: number, ex: [string, number][]): Workout => ({ id: `w${hoursAgo}`, date: ago(hoursAgo), name: "W", secs: 0, exercises: ex.map(([exId, n]) => ({ exId, name: exId, sets: sets(n) })) } as Workout);
const read = (f: string) => readFileSync(f, "utf8");

test("recovery: a hard session tires its muscles, the helpers less, and wears off over a few days", () => {
  const fresh = recovery([], NOW);
  assert.ok(BODY_PARTS.every((p) => fresh[p].pct === 100), "nothing logged: everything is fresh");
  const bench = CATALOG_BY_ID.get("bench-press")!;
  assert.equal(bench.muscle, "chest");
  const r = recovery([workout(1, [["bench-press", 5]])], NOW);
  assert.equal(recoveryLevel(r.chest.pct), "sore", `chest right after 5 hard sets: ${r.chest.pct}%`);
  for (const helper of bench.also.filter((m) => (BODY_PARTS as string[]).includes(m)) as typeof BODY_PARTS) assert.ok(r[helper].pct > r.chest.pct, `${helper} is less tired than the chest`);
  assert.equal(r.chest.sets7, 5); assert.equal(r.chest.last, ago(1));
  assert.ok(recovery([workout(96, [["bench-press", 5]])], NOW).chest.pct >= 85, "four days later the chest is fresh again");
  assert.equal(recovery([workout(24 * 8, [["bench-press", 5]])], NOW).chest.pct, 100, "older than a week doesn't count");
  const warm = { ...workout(1, []), exercises: [{ exId: "bench-press", name: "Bench", sets: [...sets(3, { warm: true }), ...sets(2, { done: false })] }] } as Workout;
  assert.equal(recovery([warm], NOW).chest.pct, 100, "warm-ups and sets not done don't tire anything");
});

test("today's workout trains the freshest group: push yesterday and legs two days ago means pull", () => {
  const history = [workout(26, [["bench-press", 4], ["ohp", 4], ["triceps-pushdown", 3]]), workout(50, [["back-squat", 5], ["rdl", 4], ["leg-press", 3]])];
  const r = recovery(history, NOW);
  assert.equal(chooseFocus(r, NOW), "pull");
  const w = generateWorkout({ workouts: history, profile: emptyFit().profile }, { equip: "gym", mins: 45, goal: "gain", seed: 7 }, NOW);
  assert.equal(w.focus, "pull"); assert.equal(w.title, "Pull day");
  assert.match(w.why, /^Your pull muscles are the most recovered: back \d+%/);
  const pull = new Set([...FOCUS_MUSCLES.pull, "abs"]);
  assert.ok(w.items.every((i) => pull.has(i.muscle)), w.items.map((i) => i.muscle).join());
  assert.ok(!w.items.some((i) => i.exId === "ohp" || i.exId === "bench-press"), "no pressing the day after push");
});

test("the workout fits the time and the equipment you have, and the same day gives the same plan", () => {
  const data = { workouts: [], profile: emptyFit().profile };
  for (const mins of [30, 45, 60, 75]) {
    const w = generateWorkout(data, { equip: "gym", mins, goal: "gain", focus: "legs", seed: 3 }, NOW);
    assert.ok(w.items.length >= 3 && w.items.length <= 8, `${mins} min: ${w.items.length} exercises`);
    assert.ok(w.mins <= mins + 12 && w.mins >= mins - 20, `${mins} min asked, about ${w.mins} planned`);
    assert.equal(new Set(w.items.map((i) => i.exId)).size, w.items.length, "no exercise twice");
    assert.equal(w.items.some((i) => i.muscle === "abs"), mins >= 40, "a core finisher on longer days");
  }
  const kinds = { dumbbells: ["dumbbell", "bodyweight", "bench", "kettlebell", "band"], bodyweight: ["bodyweight"] } as const;
  for (const equip of ["dumbbells", "bodyweight"] as const) for (const focus of ["push", "pull", "legs", "full"] as const) {
    const w = generateWorkout(data, { equip, mins: 45, goal: "maintain", focus, seed: 11 }, NOW);
    assert.ok(w.items.length >= 2, `${equip} ${focus}`);
    for (const i of w.items) {
      const e = CATALOG_BY_ID.get(i.exId)!;
      assert.ok((kinds[equip] as readonly string[]).includes(e.equipment) || (equip === "bodyweight" && ["lunge", "bulgarian-split-squat", "step-up", "jump-squat"].includes(e.id)), `${equip} ${focus}: ${e.id} needs ${e.equipment}`);
    }
  }
  const a = generateWorkout(data, { equip: "gym", mins: 45, goal: "gain", focus: "push", seed: 5 }, NOW);
  assert.deepEqual(generateWorkout(data, { equip: "gym", mins: 45, goal: "gain", focus: "push", seed: 5 }, NOW), a, "same seed, same workout");
  const first = CATALOG_BY_ID.get(a.items[0].exId)!;
  assert.ok(first.also.length >= 1, `push day starts with a compound lift, not ${first.id}`);
  assert.deepEqual([a.items[0].sets, a.items[0].reps], [4, "6-10"], "building muscle: heavy first lift");
  const shuffled = [1, 2, 3, 4, 5, 6].map((seed) => generateWorkout(data, { equip: "gym", mins: 45, goal: "gain", focus: "push", seed }, NOW).items.map((i) => i.exId).join());
  assert.ok(new Set(shuffled).size > 1, "shuffling gives different workouts");
});

test("swapping an exercise offers the same muscle with your equipment", () => {
  const alts = alternatives("bench-press", "dumbbells", ["db-bench"]);
  assert.ok(alts.length > 0);
  for (const e of alts) {
    assert.equal(e.muscle, "chest", e.id);
    assert.ok(["dumbbell", "bodyweight", "bench", "kettlebell", "band"].includes(e.equipment), e.id);
    assert.ok(e.id !== "bench-press" && e.id !== "db-bench", "not the lift itself or one already in the workout");
  }
});

test("the rebuilt Today and Train: built-for-you workout, recovery card, week strip, body map", () => {
  const app = read("client/src/pages/fit/FitApp.tsx"), train = read("client/src/pages/fit/FitTrain.tsx"), smart = read("client/src/pages/fit/FitSmart.tsx");
  assert.match(app, /<SmartWorkoutCard data=\{data\} list=\{list\} onStart=\{onStart\} testId="fit-today-smart" \/>/);
  assert.match(app, /testId="fit-today-recovery"/);
  assert.match(app, /<WeekStrip /);
  assert.match(train, /<SmartWorkoutCard data=\{data\} list=\{list\} onStart=\{onStart\} testId="fit-train-smart" \/>/);
  for (const k of ["-options", "-shuffle", "-swap-", "-start"]) assert.ok(smart.includes(`\${testId}${k}`), k);
  assert.match(smart, /programId: "smart", dayId: dayKey\(\)/, "a finished built-for-you workout counts for today");
  const body = read("client/src/pages/fit/FitBody.tsx");
  assert.match(body, /<BodyFigure side="front"/); assert.match(body, /<BodyFigure side="back"/);
  assert.match(body, /fresh: "#30c75a", recovering: "#ff9f0a", sore: "#ff453a"/);
});

test("designed cover art instead of video stills, words under the art, never on top of a photo", () => {
  const art = read("client/src/pages/fit/fitArt.tsx"), video = read("client/src/pages/fit/FitVideo.tsx"), train = read("client/src/pages/fit/FitTrain.tsx");
  for (const k of ["strength", "push", "pull", "legs", "core", "hiit", "run", "trails", "yoga", "meditation", "body", "form"]) assert.match(art, new RegExp(`\\b${k}: \\{ from: "#`), k);
  assert.match(video, /<span aria-hidden className="absolute inset-x-0 top-0" style=\{\{ height: h \}\}><Art kind=\{kind\} className="h-full w-full" \/><\/span>/);
  assert.match(train, /<CoverCard art=\{programArt\(p\)\}/);
  assert.doesNotMatch(train, /videoThumb\(/, "no YouTube stills as covers");
});

test("themes: Light, Dark and Auto in Settings (and in Arise Trainer); the iPhone clock follows", () => {
  const ui = read("client/src/pages/fit/fitUi.tsx");
  assert.match(ui, /export function ThemePicker/);
  assert.match(read("client/src/pages/fit/FitApp.tsx"), /<ThemePicker \/>/);
  assert.match(read("client/src/pages/trainer/TrainerApp.tsx"), /<ThemePicker testId="tr-theme" \/>/);
  assert.match(ui, /nativeCall\(\/statusbar\/i, "StatusBar", "setStyle", \{ style: t === "light" \? "LIGHT" : "DARK" \}\)/);
  assert.match(ui, /if \(--themeUsers === 0\) document\.documentElement\.removeAttribute\("data-fit-theme"\)/, "leaving Fit on the website gives the page back");
  for (const app of ["fit", "trainer"]) {
    assert.equal(JSON.parse(read(`${app}/ios-app/package.json`)).dependencies["@capacitor/status-bar"], "8.0.0", app);
    const cfg = JSON.parse(read(`${app}/ios-app/capacitor.config.json`));
    assert.equal(cfg.backgroundColor, "#f2f2f4", `${app} opens on the Light background`);
  }
  const plist = read(".github/scripts/configure_fit_app.py");
  assert.match(plist, /"UIViewControllerBasedStatusBarAppearance": True/);
  assert.match(plist, /DROP = \["UIUserInterfaceStyle"\]/, "no forced dark look");
  assert.match(read("client/src/App.tsx"), /fallback=\{<div className="fixed inset-0" style=\{\{ background: fitBootBg\(\) \}\} \/>\}/);
});
