import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { EYE_GAZE_LESSONS, RETIRED_LESSON_TITLES, answerSpots, lessonPictureKeys, lessonRows } from "../shared/eyegaze/lessons";
import { LESSON_STEPS } from "../shared/eyegaze/lessonSteps";

const rows = EYE_GAZE_LESSONS.map((lesson, i) => ({ lesson, ...lessonRows(lesson, i + 1) }));

test("24 lessons, each with a new name and its own key, in step order", () => {
  assert.equal(EYE_GAZE_LESSONS.length, 24);
  assert.equal(new Set(EYE_GAZE_LESSONS.map(l => l.key)).size, 24);
  assert.equal(new Set(EYE_GAZE_LESSONS.map(l => l.title.toLowerCase())).size, 24);
  const retired = new Set(RETIRED_LESSON_TITLES.map(t => t.toLowerCase()));
  for (const lesson of EYE_GAZE_LESSONS) {
    assert.ok(!retired.has(lesson.title.toLowerCase()), `${lesson.title} reuses an old lesson name`);
    assert.match(lesson.key, /^[a-z0-9-]+$/);
    assert.ok(lesson.blurb.length > 10 && lesson.blurb.length <= 70, `${lesson.title}: blurb length`);
  }
  const steps = EYE_GAZE_LESSONS.map(l => l.step);
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b));
  for (const step of [1, 2, 3, 4] as const) {
    assert.ok(LESSON_STEPS[step].name);
    assert.equal(EYE_GAZE_LESSONS.filter(l => l.step === step).length, 6);
  }
});

test("every lesson teaches 3 to 6 words, then asks 5 questions", () => {
  for (const lesson of EYE_GAZE_LESSONS) {
    assert.ok(lesson.learn.length >= 3 && lesson.learn.length <= 6, `${lesson.title}: learn cards`);
    assert.equal(lesson.quiz.length, 5, `${lesson.title}: questions`);
    for (const card of lesson.learn) assert.ok(card.word && card.say.length > 4, `${lesson.title}: learn card ${card.word}`);
  }
});

test("Look & Find gives 3 pictures; the other steps give 4 choices, all different", () => {
  for (const lesson of EYE_GAZE_LESSONS) {
    for (const q of lesson.quiz) {
      assert.equal(q.choices.length, lesson.step === 1 ? 3 : 4, `${lesson.title}: ${q.ask}`);
      assert.equal(new Set(q.choices.map(ch => ch.text.toLowerCase())).size, q.choices.length, `${lesson.title}: ${q.ask} repeats a choice`);
      if (q.show !== "words") {
        assert.ok(q.choices.every(ch => ch.pic), `${lesson.title}: ${q.ask} needs a picture for each choice`);
        assert.equal(new Set(q.choices.map(ch => ch.pic)).size, q.choices.length, `${lesson.title}: ${q.ask} repeats a picture`);
      }
    }
  }
});

test("the question never shows the answer's own picture (unless the answer is a word to pick)", () => {
  for (const lesson of EYE_GAZE_LESSONS) {
    for (const q of lesson.quiz) {
      if (q.pic && q.show !== "words") assert.notEqual(q.pic, q.choices[0].pic, `${lesson.title}: ${q.ask}`);
    }
  }
});

test("a word to read is never said by the voice", () => {
  for (const lesson of EYE_GAZE_LESSONS) {
    for (const q of lesson.quiz) {
      if (!q.word) continue;
      assert.ok(!new RegExp(`\\b${q.word}\\b`, "i").test(q.say || q.ask), `${lesson.title}: the voice says "${q.word}"`);
      assert.ok(!new RegExp(`\\b${q.word}\\b`, "i").test(q.ask), `${lesson.title}: the question prints "${q.word}"`);
    }
  }
});

test("every right answer was taught in the lesson's learn cards", () => {
  for (const lesson of EYE_GAZE_LESSONS) {
    const pictures = new Set(lesson.learn.flatMap(card => [card.pic, card.pic2].filter(Boolean)));
    const words = new Set(lesson.learn.map(card => card.word.toLowerCase()));
    for (const q of lesson.quiz) {
      const right = q.choices[0];
      if (right.pic) assert.ok(pictures.has(right.pic), `${lesson.title}: "${right.text}" is never shown before the quiz`);
      else assert.ok(words.has(right.text.toLowerCase()), `${lesson.title}: "${right.text}" is never taught`);
    }
  }
});

test("saved answers point at the right choice, spread out and never in an A, B, C, D pattern", () => {
  for (const { lesson, questions } of rows) {
    const letters = questions.map(q => q.correct_answer);
    questions.forEach((saved, i) => {
      const right = lesson.quiz[i].choices[0];
      const key = `option_${saved.correct_answer.toLowerCase()}` as "option_a";
      assert.equal(saved[key], right.text, `${lesson.title} Q${i + 1}`);
      assert.equal(saved[`${key}_image` as "option_a_image"], right.pic ? `/eyegaze/pictures/${right.pic}.svg` : null);
      const used = [saved.option_a, saved.option_b, saved.option_c, saved.option_d].filter(Boolean);
      assert.equal(used.length, lesson.quiz[i].choices.length);
      assert.deepEqual([...used].sort(), lesson.quiz[i].choices.map(ch => ch.text).sort());
      if (lesson.step === 1) assert.equal(saved.option_d, "");
    });
    for (const letter of new Set(letters)) assert.ok(letters.filter(l => l === letter).length <= 2, `${lesson.title}: ${letters.join("")}`);
    assert.ok(letters.every((l, i) => i === 0 || l !== letters[i - 1]), `${lesson.title}: same spot twice in a row (${letters.join("")})`);
    for (const run of ["ABC", "BCD", "CBA", "DCB"]) assert.ok(!letters.join("").includes(run), `${lesson.title}: ${letters.join("")}`);
    assert.deepEqual(answerSpots(lesson), answerSpots(lesson));
  }
  // Across all lessons every spot is used.
  const all = rows.flatMap(r => r.questions.map(q => q.correct_answer));
  for (const letter of ["A", "B", "C"]) assert.ok(all.filter(l => l === letter).length >= 25, `${letter} is rarely right`);
  assert.ok(all.filter(l => l === "D").length >= 15);
});

test("saving is repeatable and fills every column", () => {
  for (const [i, lesson] of EYE_GAZE_LESSONS.entries()) {
    assert.deepEqual(lessonRows(lesson, i + 1), rows[i] && { quiz: rows[i].quiz, questions: rows[i].questions });
    const { quiz, questions } = rows[i];
    assert.equal(quiz.lesson_key, lesson.key);
    assert.equal(quiz.level, lesson.step);
    assert.equal(quiz.sort_order, i + 1);
    assert.match(quiz.cover_visual, /^\/eyegaze\/pictures\/[a-z_]+\.svg$/);
    assert.equal(quiz.learn_cards.length, lesson.learn.length);
    for (const q of questions) {
      assert.ok(q.extras.say.trim(), `${lesson.title}: voice line`);
      assert.ok(["pictures", "both", "words"].includes(q.extras.show));
      assert.ok(q.visual_type === "" || q.visual, `${lesson.title}: picture missing`);
      if (q.visual_type === "word") assert.equal(q.visual, q.extras.word);
    }
  }
});

test("every picture and sound the lessons use is in the site's public folder", () => {
  const keys = lessonPictureKeys();
  assert.ok(keys.length > 100);
  for (const key of keys) assert.ok(existsSync(`client/public/eyegaze/pictures/${key}.svg`), `missing picture ${key}.svg`);
  for (const { quiz, questions } of rows) {
    for (const card of quiz.learn_cards) if (card.sound) assert.ok(existsSync(`client/public${card.sound}`), card.sound);
    for (const q of questions) if (q.extras.sound) assert.ok(existsSync(`client/public${q.extras.sound}`), q.extras.sound);
  }
});

test("questions stay short enough to read on one screen", () => {
  const most = { 1: 4, 2: 9, 3: 10, 4: 13 } as const;
  for (const lesson of EYE_GAZE_LESSONS) {
    for (const q of lesson.quiz) {
      const words = q.ask.split(/\s+/).length;
      assert.ok(words <= most[lesson.step], `${lesson.title}: "${q.ask}" is ${words} words`);
      for (const ch of q.choices) assert.ok(ch.text.length <= 16, `${lesson.title}: choice "${ch.text}" is long`);
    }
  }
});
