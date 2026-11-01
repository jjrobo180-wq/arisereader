// Arise Fit: nutrition plans, Arise Points, fasting, guided sessions and the body map.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG, PROGRAMS, cleanFit, emptyFit, goals } from "../shared/fit";
import { DIET_PLANS, cleanFasting, fastingStage, fastingStatus, fastingStreak, pointsBudget, pointsOf } from "../shared/fitNutrition";
import { SESSIONS, nextC25K, sessionSecs, sessionsIn } from "../shared/fitSessions";

test("diet plans: every split adds to 100 and drives the macro goals", () => {
  assert.ok(DIET_PLANS.length >= 8);
  for (const d of DIET_PLANS) assert.equal(d.split.p + d.split.c + d.split.f, 100, d.id);
  const keto = DIET_PLANS.find((d) => d.id === "keto")!;
  const p = { ...emptyFit().profile, macroSplit: keto.split, dietPlan: "keto", kcalGoal: 2000 };
  const g = goals(p, 80);
  assert.ok(g.c < 30, `keto carbs ${g.c}`); assert.ok(g.f > 150, `keto fat ${g.f}`);
});

test("Arise Points: lean protein is cheap, fatty sweets are expensive, a day is about 20–40", () => {
  const chicken = pointsOf({ kcal: 165, p: 31, c: 0, f: 3.6 });
  const donut = pointsOf({ kcal: 250, p: 4, c: 30, f: 14 });
  assert.ok(chicken <= 2, String(chicken)); assert.ok(donut >= 4, String(donut));
  assert.equal(pointsOf({ kcal: 0, p: 40, c: 0, f: 0 }), 0, "never negative");
  const day = pointsBudget({ kcal: 2000, p: 150, c: 200, f: 67 });
  assert.ok(day >= 20 && day <= 40, String(day));
  assert.equal(pointsBudget({ kcal: 900, p: 100, c: 50, f: 20 }), 18, "a floor so small goals still work");
});

test("fasting: status, stages, streak and cleaning", () => {
  const start = "2026-11-01T00:00:00.000Z";
  const s = fastingStatus({ protocol: "16:8", start, log: [] }, Date.parse(start) + 8 * 3_600_000);
  assert.equal(s.active, true); assert.equal(s.goalH, 16); assert.equal(s.pct, 0.5); assert.equal(s.done, false);
  assert.equal(fastingStatus({ protocol: "16:8", start, log: [] }, Date.parse(start) + 17 * 3_600_000).done, true);
  assert.equal(fastingStatus(undefined).active, false);
  assert.equal(fastingStage(14).name, "Fat-burning");
  const log = [{ start: "2026-10-28T20:00:00Z", end: "2026-10-29T08:00:00Z", goalH: 16 }, { start: "2026-10-29T20:00:00Z", end: "2026-10-30T13:00:00Z", goalH: 16 }, { start: "2026-10-30T20:00:00Z", end: "2026-10-31T12:30:00Z", goalH: 16 }];
  assert.equal(fastingStreak({ protocol: "16:8", log }), 2, "the short fast broke the streak");
  const c = cleanFasting({ protocol: "nope", start: "garbage", log: [{ start: "x", end: "y" }, ...log], junk: 1 })!;
  assert.equal(c.protocol, "16:8"); assert.equal(c.start, undefined); assert.equal(c.log.length, 3); assert.equal((c as any).junk, undefined);
});

test("what's saved keeps the plan, the points mode and fasting, and drops junk", () => {
  const d = cleanFit({ profile: { dietPlan: "carnivore", trackMode: "points" }, fasting: { protocol: "18:6", log: [] } });
  assert.equal(d.profile.dietPlan, "carnivore"); assert.equal(d.profile.trackMode, "points"); assert.equal(d.fasting?.protocol, "18:6");
  const bad = cleanFit({ profile: { dietPlan: "pizza", trackMode: "vibes" } });
  assert.equal(bad.profile.dietPlan, undefined); assert.equal(bad.profile.trackMode, undefined); assert.equal(bad.fasting, undefined);
});

test("guided sessions: HIIT, the full Couch to 5K, yoga and meditation", () => {
  assert.ok(sessionsIn("hiit").length >= 5); assert.ok(sessionsIn("yoga").length >= 4); assert.ok(sessionsIn("meditation").length >= 4);
  const c25k = sessionsIn("c25k");
  assert.equal(c25k.length, 27, "9 weeks × 3 runs");
  const last = c25k[26];
  assert.equal(last.phases.filter((p) => p.kind === "work").reduce((t, p) => t + p.secs, 0), 30 * 60, "the last run is 30 minutes nonstop");
  assert.equal(nextC25K([])?.id, "c25k-w1d1"); assert.equal(nextC25K(["c25k-w1d1", "c25k-w1d2"])?.id, "c25k-w1d3");
  assert.equal(new Set(SESSIONS.map((s) => s.id)).size, SESSIONS.length, "ids are unique");
  for (const s of SESSIONS) { assert.ok(s.phases.length > 0 && s.phases.every((p) => p.secs > 0), s.id); assert.ok(sessionSecs(s) >= 180, s.id); }
  for (const s of sessionsIn("hiit")) assert.ok(s.phases.some((p) => p.speed), `${s.id} tells you the speed`);
});

test("the gradual-increase program and the body map", () => {
  const iron = PROGRAMS.find((p) => p.id === "iron-progression")!;
  assert.equal(iron.weeks, 12); assert.equal(iron.days.length, 4);
  assert.ok(iron.days.every((d) => d.items.some((i) => /-/.test(i.reps))), "rep ranges drive the weight increases");
  const body = readFileSync("client/src/pages/fit/FitBody.tsx", "utf8");
  for (const m of ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "abs", "quads", "hamstrings", "glutes", "calves"]) {
    assert.match(body, new RegExp(`part: "${m}"`), `${m} is on the figure`);
    assert.ok(CATALOG.some((e) => e.muscle === m || e.also.includes(m as never)), `${m} has exercises`);
  }
});
