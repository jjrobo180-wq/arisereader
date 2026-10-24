import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BEGINNER_LESSONS, BEGINNER_PUBLIC_LESSONS, beginnerLesson } from "../shared/beginners";

test("Beginners ships original lessons with grade-neutral topics and real literacy practice", () => {
  assert.ok(BEGINNER_LESSONS.length >= 8);
  const ids = new Set<string>();
  for (const lesson of BEGINNER_LESSONS) {
    assert.ok(!ids.has(lesson.id), "duplicate lesson ID: " + lesson.id);
    ids.add(lesson.id);
    assert.ok(lesson.slides.length >= 2, lesson.title);
    assert.ok(lesson.slides.every(s=>s.focus.length >= 3 && s.text.length > 25), lesson.title);
    assert.equal(lesson.questions.length, 5, lesson.title + " should have five graded checks");
    assert.ok(lesson.questions.every(q=>q.choices.length===3&&q.correct>=0&&q.correct<3&&q.hint.length>5));
    assert.ok(lesson.points >= 20 && lesson.points <= 50);
  }
});
test("Public Beginners catalog never exposes correct answers or hints", () => {
  assert.equal(BEGINNER_PUBLIC_LESSONS.length, BEGINNER_LESSONS.length);
  for (const l of BEGINNER_PUBLIC_LESSONS) {
    assert.equal(l.questions.length,5);
    for (const question of l.questions) {
      assert.equal(Object.prototype.hasOwnProperty.call(question, "correct"),false);
      assert.equal(Object.prototype.hasOwnProperty.call(question, "hint"),false);
    }
  }
});
test("Lesson IDs resolve and have enough differing answer positions", () => {
  for (const l of BEGINNER_LESSONS) {
    assert.equal(beginnerLesson(l.id),l);
    const correct = l.questions.map(q=>q.correct);
    assert.ok(new Set(correct).size>=2,l.title+" should vary answer positions");
  }
  assert.equal(beginnerLesson("not-a-lesson"),undefined);
});
