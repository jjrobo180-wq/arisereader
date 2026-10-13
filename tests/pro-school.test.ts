import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENTS, allFacts, blankSource, cite, electronConfig, fracOp, gpa, makeCrossword, makeWordSearch, mixed, neededOnFinal, review, spreadSessions, toLetter, typingScore, weightedGrade } from "../shared/pro/school";

test("leitner boxes move up on a hit and back to 1 on a miss", () => {
  assert.deepEqual(review({ box: 1, due: "" }, true, "2026-01-01"), { box: 2, due: "2026-01-02" });
  assert.deepEqual(review({ box: 3, due: "" }, true, "2026-01-01"), { box: 4, due: "2026-01-08" });
  assert.deepEqual(review({ box: 5, due: "" }, false, "2026-01-01"), { box: 1, due: "2026-01-01" });
});

test("gpa and grades", () => {
  assert.equal(toLetter("88"), "B+"); assert.equal(toLetter("a-"), "A-"); assert.equal(toLetter("x"), null);
  const g = gpa([{ credits: 1, grade: "A", level: "ap" }, { credits: 1, grade: "B", level: "regular" }]);
  assert.equal(g.unweighted, 3.5); assert.equal(g.weighted, 4);
  assert.equal(Math.round(neededOnFinal(85, 20, 90)), 110);
  assert.equal(neededOnFinal(80, 50, 80), 80);
  assert.equal(weightedGrade([{ weight: 40, score: 90 }, { weight: 60, score: 80 }, { weight: 10, score: "" }]), 84);
});

test("citations", () => {
  const book = { ...blankSource("book"), authors: "Jane A. Smith; John Doe", title: "Learning Together", publisher: "Acme Press", city: "Boston", date: "2020" };
  assert.equal(cite(book, "apa"), "Smith, J. A., & Doe, J. (2020). *Learning Together*. Acme Press.");
  assert.equal(cite(book, "mla"), "Smith, Jane A., and John Doe. *Learning Together*. Acme Press, 2020.");
  assert.equal(cite(book, "chicago"), "Smith, Jane A., and John Doe. *Learning Together*. Boston: Acme Press, 2020.");
  const art = { ...blankSource("article"), authors: "Lee, Ann", title: "Sleep and memory", container: "Journal of Study", volume: "12", issue: "3", pages: "45-60", date: "2019" };
  assert.equal(cite(art, "apa"), "Lee, A. (2019). Sleep and memory. *Journal of Study*, *12*(3), 45–60.");
  assert.equal(cite(art, "mla"), "Lee, Ann. “Sleep and memory.” *Journal of Study*, vol. 12, no. 3, 2019, pp. 45–60.");
  const web = { ...blankSource("website"), authors: "NASA", title: "Mars facts", container: "NASA Science", date: "2023-05-04", url: "https://science.nasa.gov/mars", accessed: "2024-02-01" };
  assert.match(cite(web, "apa"), /^NASA\. \(2023, May 4\)\. \*Mars facts\*\. NASA Science\. https/);
  assert.match(cite(web, "mla"), /Accessed 1 Feb\. 2024\.$/);
});

test("word search places words in the grid", () => {
  const ws = makeWordSearch(["apple", "banana", "cherry", "kiwi"], 10, "hard", 7);
  assert.equal(ws.missed.length, 0);
  for (const p of ws.placed) assert.equal([...p.word].map((_, i) => ws.grid[p.r + p.dr * i][p.c + p.dc * i]).join(""), p.word);
  assert.ok(ws.grid.every((r) => r.every((ch) => /^[A-Z]$/.test(ch))));
  assert.deepEqual(makeWordSearch(["apple"], 8, "easy", 3).grid, makeWordSearch(["apple"], 8, "easy", 3).grid);
});

test("crossword interlocks every word and numbers clues", () => {
  const cw = makeCrossword([{ word: "planet", clue: "Earth is one" }, { word: "moon", clue: "Orbits Earth" }, { word: "sun", clue: "Our star" }, { word: "comet", clue: "Icy visitor" }, { word: "orbit", clue: "Path around" }], 1);
  assert.equal(cw.missed.length, 0);
  for (const w of cw.words) {
    const got = [...w.word].map((_, i) => cw.cells[w.r + (w.across ? 0 : i)][w.c + (w.across ? i : 0)]).join("");
    assert.equal(got, w.word);
    assert.equal(cw.numbers[w.r][w.c], w.num);
  }
});

test("fractions with steps", () => {
  const r = fracOp({ n: 1, d: 2 }, { n: 1, d: 3 }, "+")!; assert.deepEqual(r.result, { n: 5, d: 6 });
  assert.deepEqual(fracOp({ n: 3, d: 4 }, { n: 1, d: 2 }, "÷")!.result, { n: 3, d: 2 });
  assert.equal(mixed({ n: 7, d: 3 }), "2 1/3");
  assert.deepEqual(fracOp({ n: 2, d: 4 }, { n: 1, d: 4 }, "−")!.result, { n: 1, d: 4 });
});

test("typing, sessions, facts, elements", () => {
  const s = typingScore("hello world", "hellp world", 60); assert.equal(s.accuracy, 91); assert.equal(s.wpm, 2); assert.equal(s.misses.o, 1);
  const days = spreadSessions("2026-01-01", "2026-01-11", 4); assert.equal(days.length, 4); assert.equal(days[days.length - 1], "2026-01-10"); assert.ok(days[0] >= "2026-01-01");
  assert.deepEqual(spreadSessions("2026-01-01", "2026-01-02", 3), ["2026-01-01"]);
  assert.equal(allFacts(["×"], 12).length, 169); assert.ok(allFacts(["÷"], 10).every((f) => f.a / f.b === f.answer));
  assert.equal(ELEMENTS.length, 118); assert.equal(ELEMENTS[25].sym, "Fe");
  assert.equal(electronConfig(26), "[Ar] 4s² 3d⁶"); assert.equal(electronConfig(8), "[He] 2s² 2p⁴"); assert.equal(electronConfig(1), "1s¹");
  const pos = new Set(ELEMENTS.map((e) => `${e.row},${e.col}`)); assert.equal(pos.size, 118);
  assert.deepEqual([ELEMENTS[79].row, ELEMENTS[79].col], [6, 12]); assert.deepEqual([ELEMENTS[56].row, ELEMENTS[56].col], [9, 3]);
});
