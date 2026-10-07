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
