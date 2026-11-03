// Arise Math: curriculum lessons. Hand-written answers are checked here, because a wrong one reaches students.
// Run with: npx tsx --test tests/arise-math-curriculum.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { CURRICULUM_LESSONS, curriculumLesson, curriculumQuiz } from "../shared/ariseMathCurriculum";
import { isRight, parseAnswer } from "../shared/ariseMath";
import { wrongArithmetic } from "../shared/ariseMathVerify";

const lesson = curriculumLesson("cur-g7-u4-l1")!;

test("mixed numbers are read as mixed numbers", () => {
  assert.equal(parseAnswer("1 1/4"), 1.25); assert.equal(parseAnswer("4 1/2"), 4.5); assert.equal(parseAnswer("−1 1/2"), -1.5);
  assert.equal(parseAnswer("5/4"), 1.25); assert.equal(parseAnswer("1 / 2"), 0.5);
  assert.ok(isRight({ kind: "num", answer: 1.25 }, "1 1/4"));
});

test("every answer is what the math gives, worked out here on its own", () => {
  const worked: [RegExp, number][] = [[/enlarged to be 20/, 6 * (20 / 8)], [/banner/, 16 * (6 / 24)], [/mural/, 3 * (2 / 12)], [/school flag/, 12 * (15 / 30)], [/3 1\/2 ft long/, 3.5 * (16 / 8)], [/2 1\/4 ft tall/, 2.25 * (10 / 5)], [/3 3\/4 ft long/, 3.75 * (3 / 9)], [/1 : 1\.9/, 5 * 1.9], [/10 ft long and 5 ft tall/, ((4 * 2.5) / (10 * 5)) * 100], [/NOT/, 100 - ((2 * 3) / (8 * 5)) * 100], [/25%/, 25]];
  for (const [find, value] of worked) {
    const q = lesson.questions.find((x) => find.test(x.q));
    assert.ok(q, String(find));
    assert.ok(Math.abs(Number(q!.answer) - value) < 1e-9, `${q!.q}: ${q!.answer} vs ${value}`);
  }
  const ratio = (w: number, h: number) => w / h;
  assert.deepEqual([[9, 6], [8, 6], [10, 8], [12, 4]].filter(([w, h]) => ratio(w, h) === ratio(6, 4)), [[9, 6]]);
  assert.notEqual(ratio(4, 6), ratio(6, 8));
});

test("every lesson is complete and no step has false arithmetic", () => {
  for (const l of CURRICULUM_LESSONS) {
    assert.ok(l.questions.length >= 10); assert.ok(l.videos.length >= 1);
    for (const q of l.questions) {
      assert.ok(q.steps.length >= 2, q.q);
      assert.deepEqual(q.steps.flatMap(wrongArithmetic), [], q.q);
      if (q.choices) { assert.ok(q.choices.includes(String(q.answer)), q.q); assert.equal(new Set(q.choices).size, q.choices.length); }
      else assert.equal(typeof q.answer, "number", q.q);
      assert.doesNotMatch(q.q, /\b(chart|table|picture|figure|above|below)\b/i, "stands on its own");
    }
  }
});

test("the lesson's own example isn't reused: new numbers only", () => {
  for (const q of lesson.questions) assert.doesNotMatch(q.q, /19 (ft|feet) by 10|7 5\/8|5 3\/8|15 feet wide/, q.q);
});

test("a quiz has different questions, in a changing order, with video and steps", () => {
  const ten = curriculumQuiz(lesson, 10);
  assert.equal(ten.length, 10); assert.equal(new Set(ten.map((x) => x.plain)).size, 10);
  for (const p of ten) { assert.ok(p.steps.length); assert.equal(p.videos.length, 2); assert.equal(p.topic, "Lots of Flags"); assert.ok(p.choices.length >= 2); assert.ok(isRight(p, p.answer)); if (p.kind === "num") assert.ok(p.choices.some((c) => Number(c.v) === p.answer), p.plain); }
  assert.notDeepEqual(curriculumQuiz(lesson, 10, () => 0).map((x) => x.plain), curriculumQuiz(lesson, 10, () => 0.99).map((x) => x.plain));
});
