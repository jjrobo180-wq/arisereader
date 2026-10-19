import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GOAL_QUIZ_LEVEL, cleanGoalQuestions, goalQuizAllowed } from "../server/goalQuiz";

test("AI questions are kept only with four choices and a right answer", () => {
  const q = cleanGoalQuestions({ questions: [
    { question: "2 + 3 = ?", options: ["4", "5", "6", "7"], correct: "b" },
    { question: "Missing a choice", options: ["a", "b", "c"], correct: "A" },
    { question: "Bad answer", options: ["a", "b", "c", "d"], correct: "E" },
  ] });
  assert.deepEqual(q, [{ prompt: "2 + 3 = ?", option_a_text: "4", option_b_text: "5", option_c_text: "6", option_d_text: "7", correct_answer: "B" }]);
});

test("a goal check is only for the student it was made for", async () => {
  const get = async (k: string) => (k === "goal_quiz_for_9" ? "216" : "");
  assert.equal(await goalQuizAllowed({ id: 9, level: GOAL_QUIZ_LEVEL }, 216, get), true);
  assert.equal(await goalQuizAllowed({ id: 9, level: GOAL_QUIZ_LEVEL }, 217, get), false);
  assert.equal(await goalQuizAllowed({ id: 10, level: GOAL_QUIZ_LEVEL }, 216, get), false, "no target, nobody");
  assert.equal(await goalQuizAllowed({ id: 11, level: "Custom" }, 1, get), true, "other quizzes are unchanged");
});

test("the Reader enforces it and students find it in their Library", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(routes, /if \(!\(await goalQuizAllowed\(quiz, Number\(user\?\.id\)/);
  assert.match(routes, /registerGoalQuizRoutes\(app, authMiddleware/);
  assert.match(readFileSync(new URL("../client/src/pages/Library.tsx", import.meta.url), "utf8"), /<TeacherCheckIns token=/);
});
