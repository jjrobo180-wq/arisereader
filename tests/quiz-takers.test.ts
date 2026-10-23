// The "N readers took this quiz" note on library covers.
// Run: npx tsx --test tests/quiz-takers.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quizTakersText } from "../client/src/components/QuizTakersTag";

test("the cover says how many other readers took the quiz", () => {
  assert.equal(quizTakersText(0, false), "Be the first reader to take this quiz!");
  assert.equal(quizTakersText(1, true), "You're the first reader to take this quiz");
  assert.equal(quizTakersText(1, false), "1 reader took this quiz");
  assert.equal(quizTakersText(2, true), "1 other reader took this quiz");
  assert.equal(quizTakersText(13, true), "12 other readers took this quiz");
  assert.equal(quizTakersText(1200, false), "1,200 readers took this quiz");
});

test("the library shows the count on covers and the extra credit under section titles", () => {
  const page = readFileSync(new URL("../client/src/pages/Library.tsx", import.meta.url), "utf8");
  assert.ok(!page.includes("ExtraCreditTag"), "no extra-credit note on the covers");
  assert.equal(page.match(/<QuizTakersTag count=/g)?.length, 5, "every cover has the count");
  assert.ok(page.includes('<h2 className="text-lg font-bold mb-1 text-foreground">{pts} Point Books</h2>\n              <ExtraCreditNote'));
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.ok(routes.indexOf('app.get("/api/books/quiz-takers"') < routes.indexOf('app.get("/api/books/:id"'), "registered before /api/books/:id");
});
