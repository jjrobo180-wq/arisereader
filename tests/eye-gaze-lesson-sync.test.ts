import test from "node:test";
import assert from "node:assert/strict";
import { EYE_GAZE_LESSONS, lessonRows } from "../shared/eyegaze/lessons";
import { lessonsToHide, planQuestions, rowDiffers, stableJson } from "../server/eyeGazeLessonSync";

/** What the database hands back: ids, extra columns, and jsonb keys in its own order. */
function asSaved<T extends Record<string, any>>(row: T, id: number): T & { id: number; created_at: string } {
  const reorder = (value: any): any => Array.isArray(value) ? value.map(reorder)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reorder(v)])) : value;
  return { ...reorder(row), id, created_at: "2026-10-21T00:00:00Z" };
}

test("jsonb key order alone is not a change", () => {
  assert.equal(stableJson({ b: 1, a: { d: 2, c: [1, { f: 1, e: 2 }] } }), stableJson({ a: { c: [1, { e: 2, f: 1 }], d: 2 }, b: 1 }));
  assert.equal(rowDiffers({ id: 5, extras: { show: "both", say: "Hi" } }, { extras: { say: "Hi", show: "both" } }), false);
  assert.equal(rowDiffers({ extras: { say: "Hi" } }, { extras: { say: "Hello" } }), true);
  assert.equal(rowDiffers({ option_a_image: null }, { option_a_image: null }), false);
  assert.equal(rowDiffers({}, { option_a_image: null }), false, "a missing column reads as empty");
});

test("a lesson already saved needs no writes", () => {
  for (const [i, lesson] of EYE_GAZE_LESSONS.entries()) {
    const { quiz, questions } = lessonRows(lesson, i + 1);
    assert.equal(rowDiffers(asSaved(quiz, 40 + i), quiz), false, lesson.title);
    const saved = questions.map((q, n) => asSaved({ ...q, quiz_id: 40 + i }, 1000 + n));
    assert.deepEqual(planQuestions(40 + i, saved, questions), { insert: [], update: [], remove: [] }, lesson.title);
  }
});

test("new, changed and dropped questions", () => {
  const { questions } = lessonRows(EYE_GAZE_LESSONS[0], 1);
  // Nothing saved yet: every question is added to the quiz.
  const fresh = planQuestions(9, [], questions);
  assert.equal(fresh.insert.length, questions.length);
  assert.ok(fresh.insert.every(q => q.quiz_id === 9));
  // A reworded question is updated in place (same id, so finished quizzes keep their answers).
  const saved = questions.map((q, n) => asSaved({ ...q, quiz_id: 9 }, 500 + n));
  saved[2] = { ...saved[2], prompt: "Old words" };
  const reworded = planQuestions(9, saved, questions);
  assert.deepEqual(reworded.update.map(u => u.id), [502]);
  assert.equal(reworded.update[0].values.prompt, questions[2].prompt);
  // A lesson that got shorter loses its extra questions.
  const shorter = planQuestions(9, saved.map((q, n) => (n === 2 ? { ...q, prompt: questions[2].prompt } : q)), questions.slice(0, 3));
  assert.deepEqual(shorter.remove, [503, 504]);
  assert.equal(shorter.insert.length + shorter.update.length, 0);
});

test("only showing lessons that left the list are hidden", () => {
  const keys = new Set(["pet-pals", "zoo-crew"]);
  assert.deepEqual(lessonsToHide([
    { id: 1, lesson_key: "pet-pals", is_active: true },
    { id: 2, lesson_key: "gone-lesson", is_active: true },
    { id: 3, lesson_key: "older-gone", is_active: false },
  ], keys), [2]);
});
