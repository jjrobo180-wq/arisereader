// Teachers find and approve their students' quiz requests, and can browse the book catalog.
// Run with: npx tsx --test tests/teacher-quiz-requests.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTeacherFeed, keyAction } from "../server/notificationFeed";
import { filterCatalog, type CatalogBook } from "../shared/bookCatalog";
import { HUB_TABS } from "../shared/teacherHub";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a teacher's bell lists their own students' quiz requests until someone approves them", () => {
  const feed = buildTeacherFeed({
    rows: [{ id: 5, title: "AI Quiz Pending Review", message: "old notice for every teacher", created_at: "2026-10-22T17:00:00Z" }],
    pendingStudents: [],
    pendingQuizzes: [{ id: 77, book_title: "Wings Of Fire The Lost Hair", quiz_type: "book", student_name: "Jordan", created_at: "2026-10-22T17:34:00Z" }],
  }, { dismissed: new Set(), clearBefore: 0 });
  assert.equal(feed.actionCount, 1);
  assert.equal(feed.items[0].key, "ai_quiz:77");
  assert.deepEqual(feed.items[0].target, { type: "ai_quiz", id: 77 });
  assert.match(feed.items[0].title, /Wings Of Fire/);
  assert.match(feed.items[0].body, /Jordan is waiting/);
  assert.ok(!feed.items.some((i) => /AI Quiz Pending Review/.test(i.title)), "the old all-teacher notices stay hidden");
  assert.equal(buildTeacherFeed({ rows: [], pendingStudents: [], pendingQuizzes: [{ id: 77, created_at: "2026-10-22T17:34:00Z" }] }, { dismissed: new Set(["ai_quiz:77"]), clearBefore: 0 }).actionCount, 0);
  assert.deepEqual(keyAction("ai_quiz:77"), { kind: "dismiss", key: "ai_quiz:77" });
});

test("quiz requests go only to the student's own teacher, not every teacher on the site", () => {
  const routes = read("server/routes.ts");
  assert.ok(!routes.includes("Review and approve it in the admin panel"), "no more all-teacher notices pointing at the admin panel");
  assert.equal((routes.match(/void tellTeacherQuizRequest\(req\.user, /g) || []).length, 3, "book, favorite-topic and iArise requests");
  assert.ok(routes.includes("mine: !!st && st.teacherId === me"), "the list marks the teacher's own students");
  assert.ok(routes.includes('app.get("/api/teacher/book-catalog", authMiddleware, teacherOrAdminMiddleware'), "the catalog is for teachers and admins");
});

test("Approvals: quiz requests come first, Approve is on the row, find-a-book requests say what they are", () => {
  const page = read("client/src/components/teacher-hub/HubReaderTools.tsx");
  assert.ok(page.indexOf('{ id: "quizzes", label: "Quiz requests"') < page.indexOf('{ id: "join", label: "Joining"'));
  assert.ok(page.includes("data-testid={`button-approve-quiz-${quiz.id}`}"), "Approve shows without opening the questions");
  assert.ok(page.includes('label="Quiz requests from your students"'), "the overview counts them");
  assert.ok(page.includes("There's nothing to approve here"), "find-a-book requests explain themselves");
  assert.ok(!page.includes(">Dismiss</button>} />)}</ul> : <Empty>No bo"), "Dismiss is now Done");
});

test("the Book catalog is a Reader tab everywhere teachers open the Reader", () => {
  assert.ok(read("client/src/components/teacher-hub/HubReaderTools.tsx").includes('"readerPrizes", "readerCatalog"] as const'));
  assert.ok((HUB_TABS as readonly string[]).includes("readerCatalog"));
  for (const p of ["client/src/pages/TeacherReader.tsx", "client/src/pages/TeacherHub.tsx", "shared/hubTabGroups.ts"]) assert.ok(read(p).includes("readerCatalog"), p);
});

test("the catalog search matches title or author words, and grade band includes overlaps", () => {
  const b = (id: number, title: string, author: string, band: string, points: number, alsoBands: string[] = []): CatalogBook => ({ id, title, author, band, points, alsoBands, coverUrl: null, readOnArise: false });
  const books = [b(1, "Holes", "Louis Sachar", "6-8", 15), b(2, "Wonder", "R. J. Palacio", "3-5", 10, ["6-8"]), b(3, "The Hunger Games", "Suzanne Collins", "9-12", 20)];
  assert.deepEqual(filterCatalog(books, "", "all", "all").map((x) => x.id), [1, 2, 3]);
  assert.deepEqual(filterCatalog(books, "sachar", "all", "all").map((x) => x.id), [1]);
  assert.deepEqual(filterCatalog(books, "hunger collins", "all", "all").map((x) => x.id), [3]);
  assert.deepEqual(filterCatalog(books, "", "6-8", "all").map((x) => x.id), [1, 2]);
  assert.deepEqual(filterCatalog(books, "", "all", "20").map((x) => x.id), [3]);
  assert.deepEqual(filterCatalog(books, "zzz", "all", "all"), []);
});
