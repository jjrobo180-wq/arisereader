import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanGoalQuestions } from "../server/goalQuiz";

test("AI questions are kept only with four choices and a right answer", () => {
  const q = cleanGoalQuestions({ questions: [
    { question: "2 + 3 = ?", options: ["4", "5", "6", "7"], correct: "b" },
    { question: "Missing a choice", options: ["a", "b", "c"], correct: "A" },
    { question: "Bad answer", options: ["a", "b", "c", "d"], correct: "E" },
  ] });
  assert.deepEqual(q, [{ prompt: "2 + 3 = ?", option_a_text: "4", option_b_text: "5", option_c_text: "6", option_d_text: "7", correct_answer: "B" }]);
});

test("goal quizzes stay in WorkHub: nothing is made for students on the Reader", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const quiz = readFileSync(new URL("../server/goalQuiz.ts", import.meta.url), "utf8");
  assert.match(routes, /registerGoalQuizRoutes\(app, authMiddleware\)/);
  assert.doesNotMatch(quiz, /createQuiz|custom_eye_gaze|goal-quiz-results/);
  assert.doesNotMatch(readFileSync(new URL("../client/src/pages/Library.tsx", import.meta.url), "utf8"), /TeacherCheckIns/);
});

test("on touch screens fields write at 16px so iPhone never zooms while typing", () => {
  assert.match(readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8"), /@media \(pointer: coarse\)[\s\S]*?font-size: 16px !important/);
});

test("night mode reaches the Pro apps, Office and AI Apps, and dark written colours turn light", () => {
  for (const p of ["ProApps", "AriseOffice", "PremiumStudio"]) assert.match(readFileSync(new URL(`../client/src/pages/${p}.tsx`, import.meta.url), "utf8"), /\$\{hubNightClass\(\)\}/, p);
  const css = readFileSync(new URL("../client/src/pages/todoNight.css", import.meta.url), "utf8");
  assert.ok(css.includes('.todo-night [class*="text-[#2"]') && css.includes('.todo-night [class*="bg-[#f"]'));
});
