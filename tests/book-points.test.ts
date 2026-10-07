// Book points: the admin's number wins, and students who already passed are corrected.
// Run with: npx tsx --test tests/book-points.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOOK_POINTS_BY_ADMIN_KEY, cleanBookPoints, movedTotal, planRescore, readAdminBookPoints, type SavedAttempt } from "../shared/bookPoints";
import { adminBookPoints, isSetByAdmin, rememberAdminPoints, rescoreBook, setBookPointsByAdmin, type BookPointsStore } from "../server/bookPoints";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

/** A stand-in for the database: one book's quizzes, the students' totals and the settings. */
function memoryStore(start: { books: Record<number, number>; attempts: (SavedAttempt & { book_id: number })[]; totals: Record<number, number>; settings?: Record<string, string> }) {
  const books = { ...start.books }, totals = { ...start.totals }, settings = { ...(start.settings || {}) };
  const attempts = start.attempts.map((a) => ({ ...a }));
  const store: BookPointsStore = {
    async bookPoints(id) { return id in books ? books[id] : null; },
    async setBookPoints(id, points) { books[id] = points; },
    async attempts(id) { return attempts.filter((a) => a.book_id === id).map((a) => ({ ...a })); },
    async setAttemptPoints(id, points) { attempts.find((a) => a.id === id)!.points_earned = points; },
    async studentTotal(id) { return totals[id] || 0; },
    async setStudentTotal(id, total) { totals[id] = total; },
    async setting(key) { return settings[key] || ""; },
    async saveSetting(key, value) { settings[key] = value; },
  };
  return { store, books, totals, settings, attempts };
}

// A book AR lists at 3 points that the admin means to be worth 10.
const HARD_LUCK = 7;
function library() {
  return memoryStore({
    books: { [HARD_LUCK]: 3, 8: 5 },
    attempts: [
      { id: 1, book_id: HARD_LUCK, user_id: 101, score: 9, total: 10, points_earned: 3 },   // passed, holds 3
      { id: 2, book_id: HARD_LUCK, user_id: 102, score: 5, total: 10, points_earned: 0 },   // did not pass
      { id: 3, book_id: HARD_LUCK, user_id: 103, score: 10, total: 10, points_earned: 0 },  // passed, but a reviewer took the points away
      { id: 4, book_id: HARD_LUCK, user_id: 104, score: 7, total: 10, points_earned: "3" }, // passed; the database hands numbers back as text
      { id: 5, book_id: 8, user_id: 101, score: 10, total: 10, points_earned: 5 },          // another book
    ],
    totals: { 101: 8, 102: 0, 103: 12, 104: 3 },
  });
}

test("a book's points must be a real number above 0 and no more than 100", () => {
  assert.equal(cleanBookPoints(10), 10);
  assert.equal(cleanBookPoints("10"), 10);
  assert.equal(cleanBookPoints(" 3.5 "), 3.5);
  assert.equal(cleanBookPoints(3.14159), 3.1, "kept to one decimal");
  assert.equal(cleanBookPoints(100), 100);
  for (const bad of [0, "0", -5, 100.1, 1000, "", "  ", "ten", "10pts", "1e2", null, undefined, true, false, NaN, Infinity, {}, [10]]) assert.equal(cleanBookPoints(bad), null, String(bad));
});

test("the admin's number is what the book is worth, and students who already passed are corrected", async () => {
  const db = library();
  const result = await setBookPointsByAdmin(db.store, HARD_LUCK, 10);
  assert.deepEqual(result, { ok: true, pointsValue: 10, previous: 3, attempts: 2, students: 2 });
  assert.equal(db.books[HARD_LUCK], 10);
  assert.deepEqual(db.attempts.map((a) => [a.id, a.points_earned]), [[1, 10], [2, 0], [3, 0], [4, 10], [5, 5]], "passed quizzes move to 10; a failed one, a voided one and another book's are untouched");
  assert.deepEqual(db.totals, { 101: 15, 102: 0, 103: 12, 104: 10 }, "each total moves by the difference only, so points from other books and bonuses stay");
  assert.equal(await isSetByAdmin(db.store, HARD_LUCK), true);
  assert.equal(await isSetByAdmin(db.store, 8), false);

  // saving the same number again changes nothing
  assert.deepEqual(await setBookPointsByAdmin(db.store, HARD_LUCK, "10"), { ok: true, pointsValue: 10, previous: 10, attempts: 0, students: 0 });
  assert.deepEqual(db.totals, { 101: 15, 102: 0, 103: 12, 104: 10 });

  // and it can be lowered again; a total never drops below zero
  db.totals[104] = 4;
  assert.deepEqual(await setBookPointsByAdmin(db.store, HARD_LUCK, 2.5), { ok: true, pointsValue: 2.5, previous: 10, attempts: 2, students: 2 });
  assert.deepEqual(db.totals, { 101: 7.5, 102: 0, 103: 12, 104: 0 });
});

test("a value that can't be used, or a book that isn't there, changes nothing", async () => {
  const db = library();
  for (const bad of [0, -1, 101, "lots", null, undefined]) {
    const result = await setBookPointsByAdmin(db.store, HARD_LUCK, bad);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 400, String(bad));
  }
  for (const id of [999, 0, -3, NaN, 1.5]) {
    const result = await setBookPointsByAdmin(db.store, id, 10);
    assert.equal(!result.ok && result.status, 404, String(id));
  }
  assert.equal(db.books[HARD_LUCK], 3);
  assert.deepEqual(db.totals, { 101: 8, 102: 0, 103: 12, 104: 3 });
  assert.deepEqual(db.settings, {}, "nothing is remembered for a change that did not happen");
});

test("the books the admin set are remembered, whatever is in the saved setting", async () => {
  const db = library();
  await rememberAdminPoints(db.store, HARD_LUCK, 10);
  await rememberAdminPoints(db.store, 8, 20);
  assert.deepEqual(await adminBookPoints(db.store), { "7": 10, "8": 20 });
  assert.deepEqual(JSON.parse(db.settings[BOOK_POINTS_BY_ADMIN_KEY]), { "7": 10, "8": 20 });
  assert.deepEqual(readAdminBookPoints('{"7":10,"x":5,"9":0,"10":"abc","11":"4.5"}'), { "7": 10, "11": 4.5 });
  for (const junk of ["", "not json", "[1,2]", "null", "7", undefined, null, 12]) assert.deepEqual(readAdminBookPoints(junk), {}, String(junk));
});

test("when a book's value changes, only students who earned it are moved", () => {
  const attempts: SavedAttempt[] = [
    { id: 1, user_id: 1, score: 8, total: 10, points_earned: 2.4 },  // an old part-credit score: they passed, so they get the full value
    { id: 2, user_id: 2, score: 6, total: 10, points_earned: 1.8 },  // passed under an older, easier rule: they keep their pass
    { id: 3, user_id: 3, score: 6, total: 10, points_earned: 0 },    // below 70% and no points: stays at none
    { id: 4, user_id: 4, score: 10, total: 10, points_earned: 3 },   // already right
    { id: 5, user_id: 5, score: 9, total: 10, points_earned: 0 },    // points were taken away by a reviewer
    { id: 6, user_id: 1, score: 7, total: 10, points_earned: null },
  ];
  const plan = planRescore(attempts, 3, 3);
  assert.deepEqual(plan.attempts, [{ id: 1, points: 3 }, { id: 2, points: 3 }]);
  assert.deepEqual([...plan.students], [[1, 0.6], [2, 1.2]]);

  // A book that was worth nothing when it was passed: now that it has a value, those students get it.
  const first = planRescore(attempts, 3, 0);
  assert.deepEqual(first.attempts.map((a) => a.id), [1, 2, 5, 6], "everyone who passed, but still not the student who didn't");
  assert.deepEqual([...first.students], [[1, 3.6], [2, 1.2], [5, 3]]);

  assert.deepEqual(planRescore([], 10, 3), { attempts: [], students: new Map() });
  assert.equal(movedTotal("8", 7), 15);
  assert.equal(movedTotal(2, -7.5), 0);
  assert.equal(movedTotal(null, 0.6), 0.6);
});

test("re-scoring a book reports how many quizzes and students changed", async () => {
  const db = library();
  assert.deepEqual(await rescoreBook(db.store, HARD_LUCK, 10, 3), { attempts: 2, students: 2 });
  assert.deepEqual(await rescoreBook(db.store, HARD_LUCK, 10, 10), { attempts: 0, students: 0 });
});

test("the points picked when adding a quiz are used, and AR BookFinder never replaces the admin's number", () => {
  const routes = read("server/routes.ts"), storage = read("server/storage.ts"), ar = read("server/arBookfinder.ts");
  assert.ok(routes.includes("pointsValue: chosenPoints ?? 0, pointsSetByAdmin: chosenPoints !== null"), "the add-quiz form's points reach the new book");
  assert.ok(!routes.includes("coverUrl, description, pointsValue: 0, readUrl: readUrl || null }"), "they are no longer thrown away");
  assert.ok(routes.includes("await rememberAdminPoints(bookPointsStore, book.id, chosenPoints)"));
  assert.ok(routes.includes("registerBookPointsRoutes(app, authMiddleware, adminMiddleware,"), "only an admin can set a book's points");
  assert.ok(storage.includes("const resolvedPoints = book.skipAR || book.pointsSetByAdmin"));
  assert.ok(/&&!\(await isSetByAdmin\(store,bookId\)\)/.test(ar), "a book the admin set keeps its points when BookFinder is checked");
  assert.ok(ar.includes("if(verified)await rescoreBook(store,bookId,Number(metadata.points),previousPoints??0);"));
  assert.ok(!/score\/total/.test(ar), "no part-credit: a pass is worth the book's full value everywhere");
});

test("the Library lets the admin see and change each book's points", () => {
  const page = read("client/src/pages/Admin.tsx"), dialog = read("client/src/components/admin/BookPointsDialog.tsx");
  for (const part of ["<BookPointsDialog book={pointsBook}", 'data-testid="book-points-open"', "onSaved={fetchBooks}"]) assert.ok(page.includes(part), part);
  for (const part of ["/api/admin/books/${book.id}/points", 'method: "PATCH"', 'data-testid="book-points-save"']) assert.ok(dialog.includes(part), part);
});
