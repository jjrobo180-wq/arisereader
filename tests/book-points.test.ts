// Book points: A.R.I.S.E.'s own six-step points, the admin's number winning,
// students who already passed being corrected, and the one-time switch of the
// library away from Accelerated Reader values.
// Run with: npx tsx --test tests/book-points.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  ARISE_POINTS, BOOK_POINTS_BY_ADMIN_KEY, bandOf, cleanBookPoints, cleanPages, convertedPoints, movedTotal, planRescore, pointsForBook,
  readAdminBookPoints, type SavedAttempt,
} from "../shared/bookPoints";
import {
  BOOK_POINTS_SYSTEM_KEY, adminBookPoints, isSetByAdmin, keepSwitching, planSwitch, rememberAdminPoints, rescoreBook, setBookPointsByAdmin,
  switchLibraryToArisePoints, switchStatus, type BookForSwitch, type BookPointsStore,
} from "../server/bookPoints";
import { lookupPages, pagesFromSearch } from "../server/bookPages";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

type Row = BookForSwitch;
type Attempt = SavedAttempt & { book_id: number };

/** A stand-in for the database: the books, their quizzes, the students' totals and the settings. */
function memoryStore(start: { books: Row[]; attempts: Attempt[]; totals: Record<number, number>; settings?: Record<string, string> }) {
  const books = start.books.map((b) => ({ ...b })), totals = { ...start.totals }, settings = { ...(start.settings || {}) };
  const attempts = start.attempts.map((a) => ({ ...a }));
  const log: string[] = [];
  let failOn = "";
  const step = (name: string) => { log.push(name); if (failOn && name.startsWith(failOn)) { failOn = ""; throw new Error("database went away"); } };
  const book = (id: number) => books.find((b) => b.id === id);
  const store: BookPointsStore = {
    async bookPoints(id) { const b = book(id); return b ? Number(b.points_value ?? 0) : null; },
    async setBookPoints(id, points) { step(`book ${id}`); book(id)!.points_value = points; },
    async allBooks() { return books.map((b) => ({ ...b })); },
    async setManyBookPoints(ids, points) { step(`many ${points}`); for (const id of ids) book(id)!.points_value = points; },
    async booksWithPoints() { return new Set(attempts.filter((a) => Number(a.points_earned) > 0).map((a) => a.book_id)); },
    async attempts(id) { return attempts.filter((a) => a.book_id === id).map((a) => ({ ...a })); },
    async setAttemptPoints(id, points) { step(`attempt ${id}`); attempts.find((a) => a.id === id)!.points_earned = points; },
    async studentTotal(id) { return totals[id] || 0; },
    async setStudentTotal(id, total) { step(`total ${id}`); totals[id] = total; },
    async setting(key) { return settings[key] || ""; },
    async saveSetting(key, value) { settings[key] = value; },
  };
  return { store, totals, settings, attempts, log, points: (id: number) => Number(book(id)!.points_value), failAt: (name: string) => { failOn = name; } };
}

const ar = (id: number, points: number, status = "exact", now = points): Row => ({ id, points_value: now, ar_points: points, ar_match_status: status });

// A book Accelerated Reader listed at 3 points, which the teacher means to be worth 10.
const HARD_LUCK = 7;
function library() {
  return memoryStore({
    books: [ar(HARD_LUCK, 3), ar(8, 5)],
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

// ─── The point system ───────────────────────────────────────────────────────

test("a book is worth 5 to 30 points, from its length and its grade band", () => {
  assert.deepEqual([...ARISE_POINTS], [5, 10, 15, 20, 25, 30]);
  // length sets the points
  const byPages = (pages: number, band = "3-5") => pointsForBook({ band, pages });
  assert.deepEqual([1, 32, 60, 61, 150, 151, 260, 261, 340, 341, 480, 481, 900].map((p) => byPages(p)), [5, 5, 5, 10, 10, 15, 15, 20, 20, 25, 25, 30, 30]);
  // the grade band nudges it one step, and never past either end
  assert.equal(byPages(200, "K-2"), 10);
  assert.equal(byPages(200, "6-8"), 15);
  assert.equal(byPages(200, "9-12"), 20);
  assert.equal(byPages(30, "K-2"), 5);
  assert.equal(byPages(900, "9-12"), 30);
  // books a teacher would know: about where they should be
  assert.equal(pointsForBook({ band: "3-5", pages: 105 }), 10, "Frindle");
  assert.equal(pointsForBook({ band: "6-8", pages: 195 }), 15, "Hatchet");
  assert.equal(pointsForBook({ band: "6-8", pages: 315 }), 20, "Wonder");
  assert.equal(pointsForBook({ band: "6-8", pages: 374 }), 25, "The Hunger Games");
  assert.equal(pointsForBook({ band: "9-12", pages: 281 }), 25, "To Kill a Mockingbird");
  // no page count: the grade band decides alone
  assert.deepEqual(["K-2", "3-5", "6-8", "9-12"].map((band) => pointsForBook({ band })), [5, 10, 15, 20]);
  assert.equal(pointsForBook({ band: "Custom", pages: "" }), 10, "nothing known about the book");
  assert.equal(pointsForBook({ band: null, pages: "217" }), 15, "pages typed into a form arrive as text");
  for (const book of [{}, { band: "6-8", pages: -4 }, { band: "x", pages: "lots" }, { pages: 1e9 }]) assert.ok((ARISE_POINTS as readonly number[]).includes(pointsForBook(book)), JSON.stringify(book));
});

test("grade bands and page counts are read sensibly", () => {
  for (const band of ["K-2", "3-5", "6-8", "9-12"]) assert.equal(bandOf(band), band);
  assert.equal(bandOf(" k-2 "), "K-2");
  assert.equal(bandOf("9–12"), "9-12");
  // older book lists give an age range instead
  assert.deepEqual(["5-7", "7-10", "8-10", "8-12", "10-12", "12-14", "14-18"].map(bandOf), ["K-2", "3-5", "3-5", "3-5", "6-8", "6-8", "9-12"]);
  for (const nothing of ["", "Custom", "Teen", null, undefined, 7, "6 to 8"]) assert.equal(bandOf(nothing), null, String(nothing));
  assert.equal(cleanPages("217"), 217);
  assert.equal(cleanPages(217.4), 217);
  for (const bad of ["", "0", 0, -3, 5001, "12.5", "about 200", null, undefined, true, [200]]) assert.equal(cleanPages(bad), null, String(bad));
});

test("an admin can only give a book one of the six values", () => {
  for (const points of ARISE_POINTS) { assert.equal(cleanBookPoints(points), points); assert.equal(cleanBookPoints(String(points)), points); }
  assert.equal(cleanBookPoints(" 10 "), 10);
  assert.equal(cleanBookPoints("10.0"), 10);
  for (const bad of [0, 3, 7.5, 12, 35, 100, -5, "", "ten", "10pts", "1e1", null, undefined, true, NaN, Infinity, {}, [10]]) assert.equal(cleanBookPoints(bad), null, String(bad));
});

// ─── The admin's number wins ────────────────────────────────────────────────

test("the admin's number is what the book is worth, and students who already passed are corrected", async () => {
  const db = library();
  const result = await setBookPointsByAdmin(db.store, HARD_LUCK, 10);
  assert.deepEqual(result, { ok: true, pointsValue: 10, previous: 3, attempts: 2, students: 2 });
  assert.equal(db.points(HARD_LUCK), 10);
  assert.deepEqual(db.attempts.map((a) => [a.id, a.points_earned]), [[1, 10], [2, 0], [3, 0], [4, 10], [5, 5]], "passed quizzes move to 10; a failed one, a voided one and another book's are untouched");
  assert.deepEqual(db.totals, { 101: 15, 102: 0, 103: 12, 104: 10 }, "each total moves by the difference only, so points from other books and bonuses stay");
  assert.equal(await isSetByAdmin(db.store, HARD_LUCK), true);
  assert.equal(await isSetByAdmin(db.store, 8), false);

  // saving the same number again changes nothing
  assert.deepEqual(await setBookPointsByAdmin(db.store, HARD_LUCK, "10"), { ok: true, pointsValue: 10, previous: 10, attempts: 0, students: 0 });
  assert.deepEqual(db.totals, { 101: 15, 102: 0, 103: 12, 104: 10 });

  // and it can be lowered again; a total never drops below zero
  db.totals[104] = 4;
  assert.deepEqual(await setBookPointsByAdmin(db.store, HARD_LUCK, 5), { ok: true, pointsValue: 5, previous: 10, attempts: 2, students: 2 });
  assert.deepEqual(db.totals, { 101: 10, 102: 0, 103: 12, 104: 0 });
});

test("a value that can't be used, or a book that isn't there, changes nothing", async () => {
  const db = library();
  for (const bad of [0, 3, 12, 101, "lots", null, undefined]) {
    const result = await setBookPointsByAdmin(db.store, HARD_LUCK, bad);
    assert.equal(!result.ok && result.status, 400, String(bad));
  }
  for (const id of [999, 0, -3, NaN, 1.5]) {
    const result = await setBookPointsByAdmin(db.store, id, 10);
    assert.equal(!result.ok && result.status, 404, String(id));
  }
  assert.equal(db.points(HARD_LUCK), 3);
  assert.deepEqual(db.totals, { 101: 8, 102: 0, 103: 12, 104: 3 });
  assert.deepEqual(db.settings, {}, "nothing is remembered for a change that did not happen");
});

test("the books the admin set are remembered, whatever is in the saved setting", async () => {
  const db = library();
  await rememberAdminPoints(db.store, HARD_LUCK, 10);
  await rememberAdminPoints(db.store, 8, 20);
  assert.deepEqual(await adminBookPoints(db.store), { "7": 10, "8": 20 });
  assert.deepEqual(JSON.parse(db.settings[BOOK_POINTS_BY_ADMIN_KEY]), { "7": 10, "8": 20 });
  assert.deepEqual(readAdminBookPoints('{"7":10,"x":5,"9":0,"10":"abc","11":4.5}'), { "7": 10, "11": 4.5 });
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
  assert.deepEqual(library() && (async () => rescoreBook(library().store, HARD_LUCK, 10, 3))() instanceof Promise, true);
});

// ─── The one-time switch away from Accelerated Reader values ────────────────

test("an old Accelerated Reader value is rounded up into the six steps", () => {
  assert.deepEqual([0.5, 1, 1.5, 3, 4, 4.5, 7, 8, 9, 12, 13, 18, 19, 44].map(convertedPoints), [5, 5, 10, 10, 10, 15, 15, 15, 20, 20, 25, 25, 30, 30]);
  assert.equal(convertedPoints("3.0"), 10, "the value as the database hands it back");
  for (const nothing of [null, undefined, "", 0, -2, "n/a", NaN]) assert.equal(convertedPoints(nothing), null, String(nothing));
});

test("the switch changes only books still carrying an Accelerated Reader value", () => {
  const books: Row[] = [
    ar(1, 3),                                                          // AR said 3: becomes 10
    ar(2, 7, "formula"),                                               // worked out from AR's level and word count: becomes 15
    ar(3, 3, "exact", 10),                                             // already switched to 10: nothing to do
    ar(4, 44),                                                         // a very long book: 30 is the most a book is worth
    ar(5, 3),                                                          // the admin already set this one to 20
    { id: 6, points_value: 2, ar_points: null, ar_match_status: "unverified" },   // a site lesson with its own 2 points
    { id: 7, points_value: 5, ar_points: null, ar_match_status: null },           // a news article with its own 5 points
    { id: 8, points_value: 0, ar_points: 4, ar_match_status: "exact" },           // no quiz yet (0 points): stays hidden
    { id: 9, points_value: 12, ar_points: null, ar_match_status: "not_found" },   // never matched: keeps what it has
    { id: 10, points_value: 6, ar_points: "6.0", ar_match_status: null },         // not marked as matched, but still worth exactly the copied number: becomes 15
    { id: 11, points_value: 20, ar_points: 6, ar_match_status: "unverified" },    // has a value of its own that is not the copied one: kept
  ];
  books[4].points_value = 20;
  assert.deepEqual(planSwitch(books, { "5": 20 }), [{ id: 1, from: 3, to: 10 }, { id: 2, from: 7, to: 15 }, { id: 4, from: 44, to: 30 }, { id: 10, from: 6, to: 15 }]);
});

const AT = (clock: string) => () => Date.parse(`2026-10-07T${clock}Z`);

test("switching the library moves every book and every student who passed, once", async () => {
  const db = memoryStore({
    books: [ar(HARD_LUCK, 3), ar(8, 0.5), ar(9, 12), ar(10, 44), ar(11, 3, "exact", 20), { id: 12, points_value: 5, ar_points: null, ar_match_status: null }, ar(13, 7), ar(14, 2)],
    attempts: [
      { id: 1, book_id: HARD_LUCK, user_id: 101, score: 9, total: 10, points_earned: 3 },
      { id: 2, book_id: HARD_LUCK, user_id: 102, score: 4, total: 10, points_earned: 0 },
      { id: 3, book_id: 10, user_id: 101, score: 10, total: 10, points_earned: 44 },
      { id: 4, book_id: 11, user_id: 102, score: 10, total: 10, points_earned: 20 },
      { id: 5, book_id: 12, user_id: 102, score: 10, total: 10, points_earned: 5 },
      { id: 6, book_id: 9, user_id: 103, score: 8, total: 10, points_earned: 9.6 },   // an old part-credit score
    ],
    totals: { 101: 47, 102: 25, 103: 9.6 },
    settings: { [BOOK_POINTS_BY_ADMIN_KEY]: JSON.stringify({ "11": 20 }) },
  });
  assert.deepEqual(await switchStatus(db.store), { state: "waiting", at: null, left: 6, books: 0, attempts: 0, students: 0 });

  const summary = await switchLibraryToArisePoints(db.store, AT("04:00:00"));
  assert.deepEqual(summary, { system: "arise-2", state: "done", at: "2026-10-07T04:00:00.000Z", books: 6, attempts: 3, students: 2 });
  assert.deepEqual([HARD_LUCK, 8, 9, 10, 11, 12, 13, 14].map(db.points), [10, 5, 20, 30, 20, 5, 15, 10], "the admin's book and the site's own article are left alone");
  assert.deepEqual(db.attempts.map((a) => a.points_earned), [10, 0, 30, 20, 5, 20]);
  assert.deepEqual(db.totals, { 101: 40, 102: 25, 103: 20 }, "+7 for Hard Luck and -14 for the very long book; a full 20 in place of part credit");
  assert.ok(db.log.indexOf("attempt 1") < db.log.indexOf(`book ${HARD_LUCK}`), "students are corrected before the book is marked done");
  assert.deepEqual(db.log.filter((l) => l.startsWith("many")), ["many 5", "many 10", "many 15"], "books nobody has passed yet go in a few large steps");
  assert.deepEqual(await switchStatus(db.store), { state: "done", at: "2026-10-07T04:00:00.000Z", left: 0, books: 6, attempts: 3, students: 2 });

  // It only ever happens once.
  const before = JSON.stringify([db.totals, db.attempts]);
  assert.equal(await switchLibraryToArisePoints(db.store), null);
  assert.equal(JSON.stringify([db.totals, db.attempts]), before);
  assert.equal(JSON.parse(db.settings[BOOK_POINTS_SYSTEM_KEY]).state, "done");
});

test("a switch that hits a problem says so, and finishes on the next try without paying anyone twice", async () => {
  const db = library();
  db.failAt("book 7"); // the database drops just after Hard Luck's students were corrected
  await assert.rejects(switchLibraryToArisePoints(db.store, AT("04:00:00")), /database went away/);
  const stopped = await switchStatus(db.store, AT("04:00:05"));
  assert.deepEqual([stopped.state, stopped.error, stopped.left], ["stopped", "database went away", 2]);
  assert.equal(db.points(HARD_LUCK), 3, "the book is not marked done yet");
  assert.deepEqual(db.totals, { 101: 15, 102: 0, 103: 12, 104: 10 });

  const summary = await switchLibraryToArisePoints(db.store, AT("04:00:10"));
  assert.deepEqual([summary?.state, summary?.error], ["done", undefined]);
  assert.deepEqual([db.points(HARD_LUCK), db.points(8)], [10, 15]);
  assert.deepEqual(db.totals, { 101: 25, 102: 0, 103: 12, 104: 10 }, "Hard Luck's 7 is added once; the other book's 5 becomes 15");
});

test("a switch cut off by a restart is picked up again a few minutes later, not left for good", async () => {
  // The server restarted three times in a row while the first switch was at work:
  // it was left marked as running with one book done and one not.
  const db = library();
  db.settings[BOOK_POINTS_SYSTEM_KEY] = JSON.stringify({ system: "arise-2", state: "running", at: "2026-10-07T04:16:00.000Z", books: 1, attempts: 1, students: 1 });

  // Straight after the restart it could still be at work somewhere, so it is left alone...
  assert.equal(await switchLibraryToArisePoints(db.store, AT("04:17:00")), null);
  assert.equal(db.points(HARD_LUCK), 3);
  assert.equal((await switchStatus(db.store, AT("04:17:00"))).state, "running");
  // ...but once it has plainly gone quiet it is picked up, and counts on from where it was.
  assert.deepEqual(await switchStatus(db.store, AT("04:20:00")), { state: "waiting", at: "2026-10-07T04:16:00.000Z", left: 2, books: 1, attempts: 1, students: 1 });
  const summary = await switchLibraryToArisePoints(db.store, AT("04:20:00"));
  assert.deepEqual(summary, { system: "arise-2", state: "done", at: "2026-10-07T04:20:00.000Z", books: 3, attempts: 4, students: 3 });
  assert.equal(db.points(HARD_LUCK), 10);

  // A finished switch under the earlier rules does not stop this one from running once.
  const earlier = library();
  earlier.settings[BOOK_POINTS_SYSTEM_KEY] = JSON.stringify({ system: "arise-1", state: "done", at: "2026-10-07T04:00:00.000Z", books: 0, attempts: 0, students: 0 });
  assert.equal((await switchStatus(earlier.store)).state, "waiting");
  assert.equal((await switchLibraryToArisePoints(earlier.store))?.state, "done");
  assert.equal(earlier.points(HARD_LUCK), 10);
});

test("a long switch keeps checking in, so it is not mistaken for one that was cut off", async () => {
  const db = library();
  let clock = Date.parse("2026-10-07T04:00:00Z");
  const saves: string[] = [];
  const save = db.store.saveSetting;
  db.store.saveSetting = async (key, value) => { if (key === BOOK_POINTS_SYSTEM_KEY) saves.push(JSON.parse(value).at); return save(key, value); };
  const setBook = db.store.setBookPoints;
  db.store.setBookPoints = async (id, points) => { clock += 20_000; return setBook(id, points); }; // each book takes 20 seconds
  await switchLibraryToArisePoints(db.store, () => clock);
  assert.deepEqual(saves, ["2026-10-07T04:00:00.000Z", "2026-10-07T04:00:20.000Z", "2026-10-07T04:00:40.000Z", "2026-10-07T04:00:40.000Z"]);
});

test("the site keeps at the switch until it is finished", async () => {
  // at work somewhere else at first, then free
  const db = library();
  db.settings[BOOK_POINTS_SYSTEM_KEY] = JSON.stringify({ system: "arise-2", state: "running", at: new Date().toISOString() });
  const waits: number[] = [];
  let next: (() => void) | null = null;
  const done: any[] = [];
  const start = keepSwitching(db.store, (summary) => done.push(summary), { againMs: 120_000, later: (run, ms) => { waits.push(ms); next = run; }, log: () => {} });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  start();
  await settle();
  assert.deepEqual([done.length, waits], [0, [120_000]], "it could not start, so it looks again in two minutes");
  start(); // the admin presses "Switch them now" meanwhile
  await settle();
  assert.deepEqual(waits, [120_000], "one look ahead is enough");

  db.settings[BOOK_POINTS_SYSTEM_KEY] = JSON.stringify({ system: "arise-2", state: "running", at: "2026-10-07T04:00:00.000Z" }); // it went quiet
  next!();
  await settle();
  assert.equal(done.length, 1);
  assert.equal(done[0].state, "done");
  assert.equal(db.points(HARD_LUCK), 10);
  // once finished there is nothing more to look for
  start();
  await settle();
  assert.deepEqual([done.length, waits.length], [1, 1]);

  // a problem is tried again too, and it gives up after its tries rather than going round for ever
  const broken = library();
  broken.store.allBooks = async () => { throw new Error("no database"); };
  const again: (() => void)[] = [];
  const problems: string[] = [];
  keepSwitching(broken.store, () => {}, { tries: 3, later: (run) => { again.push(run); }, log: (m) => problems.push(m) })();
  await settle();
  again[0]();
  await settle();
  again[1]();
  await settle();
  assert.deepEqual([again.length, problems.length], [2, 3]);
  assert.ok(problems[0].includes("no database"));
});

// ─── Page counts ────────────────────────────────────────────────────────────

test("a book's page count is read from Open Library, and no answer is never a problem", async () => {
  const body = { docs: [
    { title: "Hatchet Job", number_of_pages_median: 400 },
    { title: "Hatchet: 30th Anniversary Edition", number_of_pages_median: 240 },
    { title: "Hatchet", number_of_pages_median: 195 },
    { title: "Hatchet", number_of_pages_median: 208 },
  ] };
  assert.equal(pagesFromSearch(body, "Hatchet"), 195, "the result with exactly this title, not one that only starts the same");
  assert.equal(pagesFromSearch({ docs: body.docs.slice(0, 2) }, "Hatchet"), 240, "failing that, the same title with a subtitle");
  assert.equal(pagesFromSearch({ docs: body.docs.slice(0, 1) }, "Hatchet"), null);
  assert.equal(pagesFromSearch({ docs: [{ title: "Diary of a Wimpy Kid: Hard Luck", number_of_pages_median: 217 }] }, "diary of a wimpy kid"), 217);
  assert.equal(pagesFromSearch({ docs: [{ title: "Hatchet" }, { title: "Hatchet", number_of_pages_median: 2 }] }, "Hatchet"), null, "no page count, or a silly one");
  for (const junk of [null, {}, { docs: "x" }, { docs: [null, 5] }]) assert.equal(pagesFromSearch(junk, "Hatchet"), null);

  const asked: string[] = [];
  const answer = (reply: any, ok = true) => async (url: string) => { asked.push(url); return { ok, json: async () => reply }; };
  assert.equal(await lookupPages("Hatchet", "Gary Paulsen", answer(body)), 195);
  assert.ok(asked[0].startsWith("https://openlibrary.org/search.json?") && asked[0].includes("title=Hatchet") && asked[0].includes("author=Gary+Paulsen"));
  assert.equal(await lookupPages("Hatchet", "", answer(body, false)), null);
  assert.equal(await lookupPages("Hatchet", "", async () => { throw new Error("offline"); }), null);
  assert.equal(await lookupPages("  ", "Gary Paulsen", answer(body)), null, "nothing is asked without a title");
});

// ─── How it is wired into the site ──────────────────────────────────────────

test("Accelerated Reader's BookFinder is gone from the site", () => {
  assert.equal(existsSync(new URL("../server/arBookfinder.ts", import.meta.url)), false);
  for (const file of ["server/routes.ts", "server/storage.ts", "server/bookPoints.ts", "server/bookPages.ts", "server/readsSyncCore.ts", "server/ariseNewsSync.ts", "client/src/pages/Admin.tsx", "client/src/components/admin/BookPointsDialog.tsx"]) {
    const source = read(file);
    for (const gone of [/arbookfind/i, /bookfinder/i, /lookupARBook|verifyAndSaveARBook|syncUnverifiedARBooks/, /ar-sync/, /skipAR/]) assert.ok(!gone.test(source), `${file} still has ${gone}`);
  }
  const storage = read("server/storage.ts");
  assert.ok(storage.includes("resolvedPoints = pointsForBook({ band: book.gradeBand || book.ageGroup, pages });"), "a new book's points come from the site's own rule");
  assert.ok(!/ar_(points|match_status|quiz_number|book_level|word_count)/.test(storage), "nothing AR is written for a new book");
});

test("points are set when a quiz is added, and the library is switched once at start-up", () => {
  const routes = read("server/routes.ts");
  assert.ok(routes.includes("pointsValue: chosenPoints ?? 0, pointsSetByAdmin: chosenPoints !== null"), "points picked on the add-quiz form are used");
  assert.ok(routes.includes("await rememberAdminPoints(bookPointsStore, book.id, chosenPoints)"));
  assert.ok(routes.includes("registerBookPointsRoutes(app, authMiddleware, adminMiddleware,"), "only an admin can set a book's points");
  assert.ok(routes.includes("const startBookPointsSwitch = keepSwitching(bookPointsStore,"), "the switch is kept going until it has finished");
  assert.ok(routes.includes("setTimeout(startBookPointsSwitch, 7000);"));
  assert.ok(routes.includes("startSwitch: startBookPointsSwitch,"), "and the admin can start it from the Library");
  assert.equal((routes.match(/keepPoints: pending\.quiz_type === 'iarise'/g) || []).length, 2, "an approved book quiz gets worked-out points; a site lesson keeps its own");
});

test("the Library lets the admin see and change each book's points", () => {
  const page = read("client/src/pages/Admin.tsx"), dialog = read("client/src/components/admin/BookPointsDialog.tsx");
  for (const part of ["<BookPointsDialog book={pointsBook}", 'data-testid="book-points-open"', "onSaved={fetchBooks}", "<option value={0}>Automatic</option>", 'id="q-pages"', "<BookPointsSwitch token="]) assert.ok(page.includes(part), part);
  const status = read("client/src/components/admin/BookPointsSwitch.tsx");
  for (const part of ["/api/admin/book-points/switch", 'data-testid="book-points-switch-start"', "still on old points"]) assert.ok(status.includes(part), part);
  for (const part of ["/api/admin/books/${book.id}/points", 'method: "PATCH"', 'data-testid="book-points-save"', "ARISE_POINTS.map("]) assert.ok(dialog.includes(part), part);
});
