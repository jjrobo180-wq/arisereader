// WorkHub caseload cards: next review, days away, covers, sorting and search (shared/hubStudentCards.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COVERS, coverFor, daysUntil, daysWord, longDate, matchCard, nextReview, sortCards, urgency } from "../shared/hubStudentCards";

const today = "2026-11-28";
const s = (id: string, name: string, iepDate = "", reevalDate = "", more: object = {}) => ({ id, name, grade: "", iepDate, reevalDate, ...more });

test("the next review is the sooner of the IEP and the reevaluation", () => {
  assert.deepEqual(nextReview(s("a", "A", "2027-05-20"), today), { kind: "IEP Review", date: "2027-05-20", days: 173 });
  assert.deepEqual(nextReview(s("b", "B", "2027-04-01", "2026-12-11"), today), { kind: "REEVAL", date: "2026-12-11", days: 13 });
  assert.equal(nextReview(s("c", "C"), today), null);
  assert.equal(nextReview(s("d", "D", "2026-11-20"), today)!.days, -8, "an overdue review still shows");
  assert.equal(daysUntil("2027-03-15", today), 107);
});

test("words and dates read like the board", () => {
  assert.equal(daysWord(173), "173 days away");
  assert.equal(daysWord(1), "Tomorrow");
  assert.equal(daysWord(0), "Today");
  assert.equal(daysWord(-3), "3 days overdue");
  assert.equal(longDate("2027-05-20"), "May 20, 2027");
  assert.equal(longDate("2026-12-11"), "December 11, 2026");
  assert.deepEqual([-1, 13, 60, 120, null].map(urgency), ["overdue", "soon", "near", "later", "none"]);
});

test("each student keeps one cover, or the one picked", () => {
  assert.equal(coverFor({ id: "x1" }), coverFor({ id: "x1" }));
  assert.ok(coverFor({ id: "x1" }) < COVERS.length);
  assert.equal(coverFor({ id: "x1", cover: 3 }), 3);
  assert.equal(coverFor({ id: "x1", cover: 999 }), coverFor({ id: "x1" }));
});

test("sorting and search", () => {
  const list = [s("1", "Gallegos", "2027-05-20"), s("2", "Ramirez", "", "2026-12-11"), s("3", "Alber"), s("4", "Kha", "2027-01-08")];
  assert.deepEqual(sortCards(list, "soonest", today).map((x) => x.name), ["Ramirez", "Kha", "Gallegos", "Alber"]);
  assert.deepEqual(sortCards(list, "latest", today).map((x) => x.name), ["Gallegos", "Kha", "Ramirez", "Alber"]);
  assert.deepEqual(sortCards(list, "name", today).map((x) => x.name), ["Alber", "Gallegos", "Kha", "Ramirez"]);
  assert.ok(matchCard(list[1], "reeval", today));
  assert.ok(!matchCard(list[0], "reeval", today));
  assert.ok(matchCard(list[0], "gall", today));
  assert.ok(matchCard(s("5", "Z", "", "", { disability1: "Autism" }), "autism", today));
});

test("the caseload screen shows the cards", () => {
  const page = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  for (const part of ["nextReview(s, today)", "COVERS[coverFor(s)].css", 'data-testid="caseload-sort"', 'data-testid="caseload-search"']) assert.ok(page.includes(part), part);
});
