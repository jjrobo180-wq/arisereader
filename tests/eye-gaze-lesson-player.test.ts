import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EYE_GAZE_LESSONS, lessonRows } from "../shared/eyegaze/lessons";
import { answerWords, builtInQuestion, customQuestion, isPictureFile, lessonInfo, nextLessonId, resultWords, starsFor } from "../client/src/lib/eyeGazeLesson";

test("a saved lesson question comes back as the player needs it", () => {
  for (const [i, lesson] of EYE_GAZE_LESSONS.entries()) {
    const { quiz, questions } = lessonRows(lesson, i + 1);
    questions.forEach((row, n) => {
      const { correct_answer: _answer, ...shown } = row; // the answer key never goes to the browser
      const q = builtInQuestion({ ...shown, id: 100 + n });
      const def = lesson.quiz[n];
      assert.equal(q.id, 100 + n);
      assert.equal(q.prompt, def.ask);
      assert.equal(q.say, def.say || def.ask);
      assert.equal(q.choices.length, def.choices.length, `${lesson.title} Q${n + 1}`);
      assert.equal(q.show, def.show, `${lesson.title} Q${n + 1}`);
      assert.equal(q.word, def.word || null);
      assert.equal(q.count, def.count || 1);
      assert.equal(!!q.sound, !!def.sound);
      assert.equal(!!q.picture, !!def.pic);
      if (def.show !== "words") assert.ok(q.choices.every(c => isPictureFile(c.picture)));
      assert.deepEqual(q.choices.map(c => c.letter), ["A", "B", "C", "D"].slice(0, def.choices.length));
    });
    const info = lessonInfo({ ...quiz, id: 7, hasCompleted: true, score: 4, total: 5 });
    assert.equal(info.learn.length, lesson.learn.length);
    assert.ok(info.learn.every(card => isPictureFile(card.picture) && card.word && card.say));
    assert.equal(info.hasCompleted, true);
    assert.equal(info.score, 4);
  }
});

test("older emoji quizzes and teacher quizzes still play", () => {
  const old = builtInQuestion({ id: 1, prompt: "What animal is this?", visual: "🐶", visual_type: "emoji", option_a: "Dog", option_b: "Cat", option_c: "Rabbit", option_d: "Fish" });
  assert.equal(old.picture, "🐶");
  assert.equal(old.show, "words");
  assert.equal(old.choices.length, 4);

  const teacher = customQuestion({ id: 2, prompt: "Which one is red?", question_image: "🍎", option_a_text: "Red", option_a_image: "https://x.test/red.png", option_b_text: "Blue", option_b_image: "https://x.test/blue.png", option_c_text: "", option_c_image: null, option_d_text: null, option_d_image: null });
  assert.equal(teacher.choices.length, 2);
  assert.equal(teacher.show, "both");
  assert.equal(teacher.picture, "🍎");

  const words = customQuestion({ id: 3, prompt: "Pick one", option_a_text: "Yes", option_a_image: "", option_b_text: "No", option_b_image: "" });
  assert.equal(words.show, "words");
  // A built-in question that asks for pictures it doesn't have shows words instead.
  assert.equal(builtInQuestion({ id: 4, prompt: "Find it.", option_a: "a", option_b: "b", extras: { show: "pictures" } }).show, "words");
});

test("stars, result words and the answer voice", () => {
  assert.equal(starsFor(5, 5), 5);
  assert.equal(starsFor(4, 5), 4);
  assert.equal(starsFor(0, 5), 0);
  assert.equal(starsFor(3, 0), 0);
  assert.deepEqual(
    { ...resultWords({ score: 5, total: 5, passed: true, pointsEarned: 10 }), say: undefined },
    { passed: true, headline: "Perfect!", line: "You got 5 out of 5 right.", note: "You earned 10 points!", say: undefined },
  );
  assert.equal(resultWords({ score: 4, total: 5 }).passed, true);
  assert.equal(resultWords({ score: 3, total: 5 }).passed, false);
  assert.match(resultWords({ score: 3, total: 5 }).note, /practice/i);
  assert.match(resultWords({ score: 5, total: 5, practice: true }).note, /No points/);
  assert.match(resultWords({ score: 2, total: 5, preview: true }).note, /nothing was saved/);
  assert.equal(answerWords(true, null), "Yes! That's right!");
  assert.equal(answerWords(false, { letter: "B", text: "dog", picture: null }), "Nice try. The answer is dog.");
  assert.equal(answerWords(null, null), "Nice try!");
});

test("the next lesson is the next one not done yet", () => {
  const list = [{ id: 1, hasCompleted: true }, { id: 2 }, { id: 3, hasCompleted: true }, { id: 4 }];
  assert.equal(nextLessonId(list, 1), 2);
  assert.equal(nextLessonId(list, 2), 4);
  assert.equal(nextLessonId(list, 4), 2);
  assert.equal(nextLessonId([{ id: 1, hasCompleted: true }, { id: 2, hasCompleted: true }], 1), 2);
  assert.equal(nextLessonId([{ id: 1, hasCompleted: true }], 1), null);
});

test("the quiz never waits on the voice and stays readable on any background", () => {
  const player = readFileSync("client/src/components/eye-gaze/LessonPlayer.tsx", "utf8");
  // Answer buttons are only held for the short settle time and while an answer is shown.
  assert.match(player, /disabled=\{settling \|\| !!feedback \|\| phase !== "quiz"\}/);
  assert.doesNotMatch(player, /answersRead/);
  // No white text drawn straight on the page background (the old quiz's invisible questions).
  assert.doesNotMatch(player, /hsl\(0 0% 100%\)/);
  const voice = readFileSync("client/src/lib/lessonVoice.ts", "utf8");
  assert.match(voice, /onFallback/);
  // AI voices only: the robot voice is never a fallback.
  assert.doesNotMatch(voice, /SpeechSynthesisUtterance/);
});
