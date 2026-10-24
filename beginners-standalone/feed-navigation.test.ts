import { strict as assert } from "node:assert";
import { test } from "node:test";
import { moveFeedIndex, wrapFeedIndex } from "./feed-navigation";
import { BEGINNER_LESSONS } from "./lessons";

test("Swipe navigation moves forward and backward with wraparound", () => {
  assert.equal(moveFeedIndex(0, 1, 12), 1);
  assert.equal(moveFeedIndex(11, 1, 12), 0);
  assert.equal(moveFeedIndex(0, -1, 12), 11);
  assert.equal(moveFeedIndex(2, -1, 12), 1);
});
test("Filtering never produces out-of-bounds swipe indexes", () => {
  assert.equal(wrapFeedIndex(7, 2), 1);
  assert.equal(moveFeedIndex(7, 1, 2), 0);
  assert.equal(wrapFeedIndex(3, 0), 0);
  assert.equal(moveFeedIndex(3, 1, 0), 0);
  assert.equal(moveFeedIndex(0, 1, 1), 0);
  assert.equal(wrapFeedIndex(-1, 4), 3);
});
test("Both browse views share the same lesson IDs and Easy/Medium/Hard points", () => {
  assert.equal(new Set(BEGINNER_LESSONS.map(l=>l.id)).size, BEGINNER_LESSONS.length);
  for (const lesson of BEGINNER_LESSONS) {
    assert.equal(lesson.points, lesson.level * 10);
    assert.equal(lesson.questions.length, 5);
  }
});
