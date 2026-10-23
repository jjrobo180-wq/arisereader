import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkBookContent, contentNotice } from "../shared/bookContent";
import { quizRiskFlags, type QuizVerification } from "../shared/bookMatch";

test("Rachel Reid and Kevin Hart's adult books are flagged; his kids' book and other Reids are not", () => {
  for (const [title, author] of [["Heated Rivalry", "Rachel Reid"], ["Common Goal", "Reid, Rachel"], ["The Decision: Overcoming Today's BS", "Kevin Hart"], ["I Can't Make This Up", "Kevin Hart"]]) {
    assert.equal(checkBookContent({ title, author }).level, "adult", title);
  }
  assert.equal(checkBookContent({ title: "Marcus Makes a Movie", author: "Kevin Hart" }).level, "ok");
  assert.equal(checkBookContent({ title: "Some Book", author: "Ruth Reid" }).level, "ok");
});

test("the AI's audience, its content note and library subjects are used too", () => {
  assert.equal(checkBookContent({ title: "X", author: "Y", aiAudience: "adult" }).level, "adult");
  assert.equal(checkBookContent({ title: "X", author: "Y", aiAudience: "teen", aiWarning: "strong language" }).level, "mature");
  assert.equal(checkBookContent({ title: "X", author: "Y", subjects: ["Fiction, romance, erotica"] }).level, "adult");
  assert.equal(checkBookContent({ title: "Wonder", author: "R. J. Palacio", aiAudience: "children", subjects: ["Juvenile fiction"] }).level, "ok");
});

test("an adult book still goes to the teacher, with a high-risk notice and a recommendation not to approve", () => {
  const content = checkBookContent({ title: "Heated Rivalry", author: "Rachel Reid" });
  const v: QuizVerification = { typed: { title: "Heated Rivalry", author: "Rachel Reid" }, match: "exact", book: null, sources: ["https://x.org"], questionsWithEvidence: 10, questionCount: 10, content, checkedAt: "" };
  const flags = quizRiskFlags(v);
  assert.equal(flags[0].level, "high");
  assert.match(flags[0].text, /recommend not approving/);
  assert.match(contentNotice(content), /recommend not approving/);
  assert.equal(contentNotice(checkBookContent({ title: "Wonder", author: "R. J. Palacio" })), "");
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(routes, /content: checkBookContent\(/);
  assert.match(routes, /tellTeacherQuizRequest\(req\.user, `"\$\{cleanTitle\}" by \$\{cleanAuthor\}`, contentNotice\(verification\.content\)\)/);
});

test("live games: a new question gets a fresh timer, and reveal/next name the question they mean", () => {
  const page = readFileSync(new URL("../client/src/pages/LiveQuiz.tsx", import.meta.url), "utf8");
  // The leftover 0 from the last question is replaced when the question changes.
  assert.match(page, /setTimeLeft\(next\.deadline \? secondsLeft\(next\.deadline, nextOffset\) : 30\)/);
  // Auto-reveal waits for this question's own deadline instead of the shared timeLeft value.
  assert.doesNotMatch(page, /timeLeft > 0 \|\| lastAuto\.current/);
  assert.match(page, /action: "reveal", question \}/);
  assert.match(page, /JSON\.stringify\(\{ action, question \}\)/);
  const server = readFileSync(new URL("../server/liveQuizzes.ts", import.meta.url), "utf8");
  assert.match(server, /p_question: question/);
  assert.match(server, /now\.current_question !== question/);
});
