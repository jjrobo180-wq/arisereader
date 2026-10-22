// After a teacher approves a quiz a student asked for, the student is told it's ready and can open it.
// Run with: npx tsx --test tests/ready-quizzes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { approvePendingQuiz, dismissReadyQuiz, readyQuizzesFor, registerReadyQuizRoutes, type ReadyQuizDeps } from "../server/readyQuizzes";
import { addReadyQuiz, cleanReadyQuizzes, parseReadyQuizType, readyQuizNotificationType, readyQuizPath } from "../shared/readyQuizzes";
import { buildMemberFeed } from "../server/notificationFeed";
import { describeStoredType } from "../shared/notifications";

function setup() {
  const settings = new Map<string, string>();
  const notes: any[] = [];
  const pushes: any[] = [];
  const takenBooks = new Set<number>();
  const takenCustom = new Set<number>();
  let nextBook = 500, nextCustom = 70, clock = Date.parse("2026-10-22T17:00:00Z");
  const deps: ReadyQuizDeps = {
    getSetting: async (k) => settings.get(k) ?? null,
    upsertSetting: async (k, v) => { settings.set(k, v); },
    createEyeGazeQuiz: async () => ++nextCustom,
    createBookQuiz: async () => ++nextBook,
    iariseLesson: async () => { throw new Error("AI is down"); },
    insertNotification: async (row) => { notes.push(row); },
    push: async (id, m) => { pushes.push({ id, ...m }); },
    takenBooks: async (_u, ids) => ids.filter((i) => takenBooks.has(i)),
    takenCustom: async (_u, ids) => ids.filter((i) => takenCustom.has(i)),
    now: () => clock,
  };
  const pending = (over: any = {}) => ({ id: 1, student_id: 11, book_title: "Holes", author: "Louis Sachar", questions: "[]", age_group: "6-8", quiz_type: "book", ...over });
  return { deps, settings, notes, pushes, takenBooks, takenCustom, pending, tick: (ms: number) => { clock += ms; } };
}

test("approving a book quiz tells the student three ways and links straight to the quiz", async () => {
  const t = setup();
  const ready = await approvePendingQuiz(t.deps, t.pending());
  assert.deepEqual({ kind: ready.kind, id: ready.id, title: ready.title }, { kind: "book", id: 501, title: "Holes" });
  assert.equal(t.notes.length, 1);
  assert.equal(t.notes[0].user_id, 11);
  assert.equal(t.notes[0].type, "quiz_ready:book:501");
  assert.equal(t.notes[0].title, "Your quiz is ready!");
  assert.match(t.notes[0].message, /Holes/);
  assert.deepEqual(t.pushes.map((p) => [p.id, p.url]), [[11, "/quiz/501"]]);
  assert.deepEqual((await readyQuizzesFor(t.deps, 11)).map((q) => q.id), [501]);
  assert.equal(JSON.parse(t.settings.get("book_grade_bands")!)["501"], "6-8");
});

test("eye gaze quizzes link to the custom quiz page", async () => {
  const t = setup();
  const ready = await approvePendingQuiz(t.deps, t.pending({ quiz_type: "eye_gaze" }));
  assert.equal(ready.kind, "custom");
  assert.equal(t.notes[0].type, "quiz_ready:custom:71");
  assert.equal(t.pushes[0].url, "/custom-quiz/71");
});

test("teacher approvals now put iArise and favorite-topic quizzes on the student's own lists too", async () => {
  const t = setup();
  await approvePendingQuiz(t.deps, t.pending({ quiz_type: "iarise" }));
  await approvePendingQuiz(t.deps, t.pending({ quiz_type: "favorite_topic", book_title: "Sharks" }));
  assert.deepEqual(JSON.parse(t.settings.get("student_iarise_books_11")!), [501]);
  assert.deepEqual(JSON.parse(t.settings.get("student_favorite_books_11")!), [502]);
});

test("the banner keeps a quiz until the student takes it or closes it", async () => {
  const t = setup();
  await approvePendingQuiz(t.deps, t.pending());
  t.tick(60_000);
  await approvePendingQuiz(t.deps, t.pending({ quiz_type: "eye_gaze", book_title: "Colors" }));
  t.tick(60_000);
  await approvePendingQuiz(t.deps, t.pending({ book_title: "Wonder" }));
  assert.deepEqual((await readyQuizzesFor(t.deps, 11)).map((q) => q.title), ["Wonder", "Colors", "Holes"]);
  t.takenBooks.add(501);
  assert.deepEqual((await readyQuizzesFor(t.deps, 11)).map((q) => q.title), ["Wonder", "Colors"]);
  // Taken quizzes are pruned from storage, so they don't come back.
  t.takenBooks.clear();
  assert.deepEqual((await readyQuizzesFor(t.deps, 11)).map((q) => q.title), ["Wonder", "Colors"]);
  await dismissReadyQuiz(t.deps, 11, "custom", 71);
  assert.deepEqual((await readyQuizzesFor(t.deps, 11)).map((q) => q.title), ["Wonder"]);
  assert.deepEqual(await readyQuizzesFor(t.deps, 99), []);
});

test("a push that fails doesn't stop the approval", async () => {
  const t = setup();
  t.deps.push = async () => { throw new Error("no devices"); };
  const ready = await approvePendingQuiz(t.deps, t.pending());
  assert.equal(ready.id, 501);
  assert.equal(t.notes.length, 1);
});

test("the bell item opens the quiz", () => {
  assert.deepEqual(describeStoredType("quiz_ready:book:501"), { category: "quiz_ready", target: { type: "quiz", id: 501 } });
  assert.deepEqual(describeStoredType("quiz_ready:custom:71"), { category: "quiz_ready", target: { type: "custom_quiz", id: 71 } });
  assert.deepEqual(describeStoredType("success"), { category: "success" });
  const feed = buildMemberFeed({ role: "student", unreadMessages: [], rows: [{ id: 9, type: "quiz_ready:book:501", title: "Your quiz is ready!", message: "Holes", created_at: "2026-10-22T17:00:00Z" }] });
  assert.deepEqual(feed.items[0].target, { type: "quiz", id: 501 });
  assert.equal(feed.items[0].category, "quiz_ready");
});

test("stored lists are cleaned and links are built safely", () => {
  assert.equal(readyQuizPath({ kind: "book", id: 5 }), "/quiz/5");
  assert.equal(readyQuizPath({ kind: "custom", id: 5 }), "/custom-quiz/5");
  assert.equal(readyQuizNotificationType({ kind: "book", id: 5 }), "quiz_ready:book:5");
  assert.equal(parseReadyQuizType("quiz_ready:book:abc"), null);
  assert.equal(parseReadyQuizType("quiz_ready:other:5"), null);
  const list = cleanReadyQuizzes([{ kind: "book", id: 1, title: "A", approvedAt: "2026-10-01" }, { kind: "book", id: 1, title: "dup" }, { kind: "nope", id: 2 }, { kind: "custom", id: -1 }, null, "x"]);
  assert.deepEqual(list.map((q) => q.title), ["A"]);
  assert.deepEqual(addReadyQuiz(list, { kind: "book", id: 1, title: "A again", approvedAt: "2026-10-05T00:00:00Z" }).map((q) => q.title), ["A again"]);
  assert.equal(cleanReadyQuizzes(Array.from({ length: 40 }, (_, i) => ({ kind: "book", id: i + 1, title: String(i), approvedAt: new Date(2026, 0, i + 1).toISOString() }))).length, 20);
});

test("routes: students see their ready quizzes with links; teachers and parents get none", async () => {
  const t = setup();
  await approvePendingQuiz(t.deps, t.pending());
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  registerReadyQuizRoutes({ get: add("GET"), post: add("POST") } as any, ((_q: any, _s: any, n: any) => n()) as any, t.deps);
  const call = async (key: string, user: any, params: any = {}) => {
    let code = 200, body: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { body = d; return res; } };
    await routes[key]({ user, params }, res);
    return { code, body };
  };
  const mine = await call("GET /api/student/ready-quizzes", { id: 11, role: "student" });
  assert.deepEqual(mine.body.quizzes.map((q: any) => q.path), ["/quiz/501"]);
  assert.deepEqual((await call("GET /api/student/ready-quizzes", { id: 11, role: "teacher" })).body.quizzes, []);
  assert.equal((await call("POST /api/student/ready-quizzes/:kind/:id/dismiss", { id: 11, role: "student" }, { kind: "x", id: "1" })).code, 400);
  const after = await call("POST /api/student/ready-quizzes/:kind/:id/dismiss", { id: 11, role: "student" }, { kind: "book", id: "501" });
  assert.deepEqual(after.body.quizzes, []);
});
