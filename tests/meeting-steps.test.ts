import test from "node:test";
import assert from "node:assert/strict";
import { MEETING_STEPS, STEP_COUNT, cleanPlan, emptyPlan, firstOpen, markDone, markSkipped, stepState, stepsDone } from "../shared/meetingSteps";

test("there are ten steps and step 2 is finding a time for everyone", () => {
  assert.equal(MEETING_STEPS.length, STEP_COUNT);
  assert.deepEqual(MEETING_STEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.match(MEETING_STEPS[1].title, /time that works for everyone/);
});

test("done and skipped steps are tracked, and doing a skipped step clears the skip", () => {
  let p = markDone(emptyPlan(), 1);
  p = markSkipped(p, 2);
  assert.deepEqual(p, { done: [1], skipped: [2] });
  assert.equal(stepState(p, 1, 3), "done"); assert.equal(stepState(p, 2, 3), "skipped"); assert.equal(stepState(p, 3, 3), "current"); assert.equal(stepState(p, 4, 3), "todo");
  assert.equal(firstOpen(p), 3);
  p = markDone(p, 2);
  assert.deepEqual(p, { done: [1, 2], skipped: [] });
  assert.equal(markSkipped(p, 2).skipped.length, 0);
  assert.equal(stepsDone(p), 2);
});

test("when everything is done or skipped, pick up at the first skipped step", () => {
  let p = emptyPlan();
  for (let n = 1; n <= STEP_COUNT; n++) p = n === 4 ? markSkipped(p, n) : markDone(p, n);
  assert.equal(firstOpen(p), 4);
  assert.equal(firstOpen(markDone(p, 4)), STEP_COUNT);
});

test("a saved plan is cleaned", () => {
  assert.deepEqual(cleanPlan({ done: [3, 3, 99, "x", 1], skipped: [1, 5] }), { done: [1, 3], skipped: [5] });
  assert.deepEqual(cleanPlan("bad"), { done: [], skipped: [] });
});

test("prep to-dos are dated back from the meeting, and never in the past", async () => {
  const { prepTodos } = await import("../shared/meetingSteps");
  const list = prepTodos("Ava M.", "2026-11-20", "2026-10-11");
  assert.deepEqual(list.map((t) => t.dueDate), ["2026-11-06", "2026-11-10", "2026-11-15", "2026-11-23"]);
  assert.match(list[0].title, /Ava M\./);
  assert.equal(prepTodos("Ava M.", "2026-10-15", "2026-10-11")[0].dueDate, "2026-10-11");
  assert.deepEqual(prepTodos("Ava", "", "2026-10-11"), []);
});

import { markOpen, resumeStep, withAt } from "../shared/meetingSteps";

test("the steps open on the step the teacher was last on, not the first one not done", () => {
  let p = markDone(markDone(markDone(emptyPlan(), 1), 2), 3);
  p = markSkipped(p, 4); // skipped by accident
  assert.equal(resumeStep(p), 5); // never been moved around: the old rule
  p = withAt(p, 4); // went back to step 4 and left it there
  assert.equal(resumeStep(p), 4);
  assert.equal(resumeStep(withAt(p, 5)), 5);
});

test("a step marked done or skipped by accident can be taken back", () => {
  let p = markSkipped(markDone(emptyPlan(), 1), 4);
  p = markDone(p, 5);
  p = markOpen(p, 5);
  p = markOpen(p, 4);
  assert.deepEqual(p, { done: [1], skipped: [] });
  assert.equal(firstOpen(p), 2);
});

test("marking steps never loses where the teacher is", () => {
  const p = markSkipped(markDone(withAt(emptyPlan(), 4), 4), 6);
  assert.equal(p.at, 4);
  assert.equal(markOpen(p, 4).at, 4);
});

test("once a time is booked, a meeting left on finding or booking opens at telling everyone", () => {
  assert.equal(resumeStep(withAt(emptyPlan(), 2), true), 4);
  assert.equal(resumeStep(withAt(emptyPlan(), 3), true), 4);
  assert.equal(resumeStep(withAt(emptyPlan(), 3), false), 3);
  assert.equal(resumeStep(withAt(emptyPlan(), 5), true), 5);
  assert.equal(resumeStep(withAt(emptyPlan(), 1), true), 1);
});

test("a saved plan keeps a good position and drops a bad one", () => {
  assert.equal(cleanPlan({ done: [], skipped: [], at: 7 }).at, 7);
  assert.equal("at" in cleanPlan({ at: 99 }), false);
  assert.equal("at" in cleanPlan({ at: "x" }), false);
});
