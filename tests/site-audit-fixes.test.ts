// Fixes from the site audit: shuffled answer choices, limits on guessing, and school months.
// Run with: npx tsx --test tests/site-audit-fixes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { serveStatic } from "../server/static";
import { LETTERS, choiceOrder, filledLetters, shuffleChoices, storedLetter } from "../server/quizShuffle";
import { clientAddress, createAttemptLimiter, waitWords } from "../server/attemptLimiter";
import { monthStartMs, nextYearMonth } from "../server/schoolTime";

const question = (id: number, over: Record<string, string> = {}) => ({
  id, questionText: `Question ${id}`, optionA: `right ${id}`, optionB: `wrong b ${id}`, optionC: `wrong c ${id}`, optionD: `wrong d ${id}`, ...over,
});

test("each student sees the choices in their own order, the same every time", () => {
  const q = question(7);
  const first = shuffleChoices(q, 101);
  assert.deepEqual(shuffleChoices(q, 101), first, "same student, same order");
  const shown = [first.optionA, first.optionB, first.optionC, first.optionD];
  assert.deepEqual([...shown].sort(), [q.optionA, q.optionB, q.optionC, q.optionD].sort(), "every choice is still there once");
  assert.equal(first.questionText, q.questionText);
  // across many students the right answer isn't always in the first spot
  const spots = new Set<number>();
  for (let student = 1; student <= 40; student++) {
    const s = shuffleChoices(q, student);
    spots.add([s.optionA, s.optionB, s.optionC, s.optionD].indexOf(q.optionA));
  }
  assert.equal(spots.size, 4, "the right answer shows up in all four spots");
});

test("the letter a student picks is graded as the stored letter", () => {
  for (let student = 1; student <= 30; student++) {
    for (let id = 1; id <= 10; id++) {
      const q = question(id);
      const shown = shuffleChoices(q, student);
      const pickedLetter = LETTERS.find((l) => (shown as any)[`option${l}`] === q.optionA)!;
      assert.equal(storedLetter(q, student, pickedLetter), "A", `student ${student} question ${id}`);
      const wrongLetter = LETTERS.find((l) => (shown as any)[`option${l}`] === q.optionC)!;
      assert.equal(storedLetter(q, student, wrongLetter.toLowerCase()), "C", "lowercase works too");
    }
  }
  assert.equal(storedLetter(question(1), 5, ""), "");
  assert.equal(storedLetter(question(1), 5, "Z"), "Z", "anything else is left alone and won't match");
});

test("tapping the same letter every time no longer passes an all-A quiz", () => {
  // 72 quizzes have every answer stored as A. Before, tapping A scored 10/10 for everyone;
  // now it is as good as guessing: about 2.5 out of 10, and a pass (7+) only by rare luck.
  const questions = Array.from({ length: 10 }, (_, i) => question(1000 + i));
  let tries = 0, total = 0, passes = 0;
  for (let student = 1; student <= 500; student++) {
    for (const letter of LETTERS) {
      const score = questions.filter((q) => storedLetter(q, student, letter) === "A").length;
      tries++; total += score; if (score >= 7) passes++;
    }
  }
  const average = total / tries;
  assert.ok(average > 2 && average < 3, `average ${average}`);
  assert.ok(passes / tries < 0.01, `${passes} of ${tries} tries passed`);
});

test("questions with fewer choices keep the empty ones at the end", () => {
  const tf = question(9, { optionA: "True", optionB: "False", optionC: "", optionD: "" });
  assert.deepEqual(filledLetters(tf), ["A", "B"]);
  for (let student = 1; student <= 20; student++) {
    const shown = shuffleChoices(tf, student);
    assert.deepEqual([shown.optionC, shown.optionD], ["", ""]);
    assert.deepEqual([shown.optionA, shown.optionB].sort(), ["False", "True"]);
    const order = choiceOrder(student, 9, ["A", "B"]);
    assert.deepEqual(order.slice(2), ["C", "D"]);
  }
});

test("wrong passwords: 10 misses, then wait; a right password clears the count", () => {
  let now = 1_000_000;
  const limiter = createAttemptLimiter({ max: 3, windowMs: 60_000, now: () => now });
  assert.equal(limiter.retryAfter("ada"), 0);
  limiter.fail("ada"); limiter.fail("ada");
  assert.equal(limiter.retryAfter("ada"), 0);
  limiter.fail("ada");
  assert.ok(limiter.retryAfter("ada") > 0, "blocked after the limit");
  assert.equal(limiter.retryAfter("ben"), 0, "other people aren't affected");
  now += 61_000;
  assert.equal(limiter.retryAfter("ada"), 0, "old misses expire");
  limiter.fail("ada"); limiter.fail("ada"); limiter.reset("ada"); limiter.fail("ada");
  assert.equal(limiter.retryAfter("ada"), 0);
  assert.equal(waitWords(30_000), "a minute");
  assert.equal(waitWords(12 * 60_000), "12 minutes");
  assert.equal(clientAddress({ headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } }), "203.0.113.5");
  assert.equal(clientAddress({ headers: {}, ip: "10.1.1.1" }), "10.1.1.1");
});

test("missing files and API addresses get a real 404; app pages still open", async () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "arise-dist-"));
  fs.mkdirSync(path.join(dist, "assets"));
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>app</title>");
  fs.writeFileSync(path.join(dist, "assets", "app.js"), "console.log(1)");
  const app = express();
  serveStatic(app, dist);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  try {
    const port = (server.address() as any).port;
    const get = async (p: string) => {
      const res = await fetch(`http://127.0.0.1:${port}${p}`);
      return { status: res.status, type: res.headers.get("content-type") || "", body: await res.text() };
    };
    assert.equal((await get("/assets/app.js")).status, 200, "a file that exists");
    for (const p of ["/assets/does-not-exist.js", "/assets/old-build.css?v=2", "/favicon.ico", "/sitemap.xml"]) {
      const r = await get(p);
      assert.equal(r.status, 404, p);
      assert.ok(!r.body.includes("<title>app</title>"), `${p} must not answer with the app page`);
    }
    const api = await get("/api/this-route-does-not-exist");
    assert.equal(api.status, 404);
    assert.match(api.type, /json/);
    for (const p of ["/", "/library", "/quiz/36", "/parent-signup?code=a.b", "/fyp/share/0a1b2c", "/index.html"]) {
      const r = await get(p);
      assert.equal(r.status, 200, p);
      assert.ok(r.body.includes("<title>app</title>"), `${p} opens the app`);
    }
  } finally {
    server.close();
    server.closeAllConnections();
    fs.rmSync(dist, { recursive: true, force: true });
  }
});

test("monthly leaderboard months start at midnight Mountain Time", () => {
  assert.equal(new Date(monthStartMs("2026-10")).toISOString(), "2026-10-01T06:00:00.000Z", "daylight time");
  assert.equal(new Date(monthStartMs("2026-12")).toISOString(), "2026-12-01T07:00:00.000Z", "standard time");
  assert.equal(new Date(monthStartMs("2026-11")).toISOString(), "2026-11-01T06:00:00.000Z", "the clocks change later that day");
  assert.equal(nextYearMonth("2026-12"), "2027-01");
  assert.equal(nextYearMonth("2026-09"), "2026-10");
  // a quiz at 7pm on September 30 in Denver belongs to September
  const evening = Date.parse("2026-10-01T01:00:00Z");
  assert.ok(evening < monthStartMs("2026-10"));
});
