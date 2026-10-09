// Run with: npx tsx --test tests/arise-history.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryHistoryStore, registerAriseHistoryRoutes, type HistoryUser } from "../server/ariseHistory";
import {
  BAND_IDS, READS, cleanCustom, cleanHistoryProfile, gradeQuiz, makeItems, pointsFor, profileNow, readsFor, emptyHistoryProfile,
} from "../shared/ariseHistory";

const people: Record<number, HistoryUser & { grade?: string }> = {
  1: { id: 1, role: "teacher", displayName: "Ms. Chen", teacherId: null, schoolId: 10, approvedByTeacher: true, archived: false },
  2: { id: 2, role: "teacher", displayName: "Mr. Delgado", teacherId: null, schoolId: 10, approvedByTeacher: true, archived: false },
  11: { id: 11, role: "student", displayName: "Mateo Ramirez", teacherId: 1, schoolId: 10, approvedByTeacher: true, archived: false, grade: "4" },
  12: { id: 12, role: "student", displayName: "Aria Lopez", teacherId: 1, schoolId: 10, approvedByTeacher: true, archived: false, grade: "4" },
  13: { id: 13, role: "student", displayName: "Kenji Lee", teacherId: 2, schoolId: 10, approvedByTeacher: true, archived: false, grade: "8" },
  14: { id: 14, role: "student", displayName: "Solo Kid", teacherId: null, schoolId: null, approvedByTeacher: true, archived: false, grade: "11" },
  15: { id: 15, role: "student", displayName: "New Kid", teacherId: 1, schoolId: 10, approvedByTeacher: false, archived: false, grade: "4" },
  21: { id: 21, role: "parent", displayName: "Luis Ramirez", teacherId: null, schoolId: null, approvedByTeacher: true, archived: false },
};
const links: Record<number, number[]> = { 21: [11] };

/** A seeded random number generator, so every run shuffles the same way. */
const seeded = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function setup() {
  const routes: Record<string, Function> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers[handlers.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  let clock = Date.parse("2026-10-08T18:00:00Z");
  const notes: { id: number; body: string }[] = [];
  const store = createMemoryHistoryStore(() => clock);
  registerAriseHistoryRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    store, now: () => clock, random: seeded(7),
    directory: {
      user: async (id) => people[id] ?? null,
      gradeOf: async (id) => people[id]?.grade ?? null,
      studentsOf: async (t) => Object.values(people).filter((p) => p.role === "student" && p.teacherId === t && p.approvedByTeacher),
      childrenOf: async (p) => links[p] ?? [],
      notify: async (id, m) => { notes.push({ id, body: m.body }); },
    },
  });
  const as = (userId: number) => async (key: string, req: any = {}) => {
    let code = 200; let payload: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { payload = d; return res; } };
    const u = people[userId];
    await routes[key]({ body: {}, params: {}, query: {}, headers: {}, ...req, user: { id: u.id, displayName: u.displayName, role: u.role, teacherId: u.teacherId, school_id: u.schoolId, approvedByTeacher: u.approvedByTeacher } }, res);
    return { code, body: payload };
  };
  return { as, routes, notes, store, tick: (ms: number) => { clock += ms; } };
}

/** Takes a whole quiz, getting `right` questions right (the first ones) and the rest wrong. */
async function take(call: ReturnType<ReturnType<typeof setup>["as"]>, store: any, start: any, right: number) {
  const s = start.body.session;
  const real = (await store.getSession(s.id)).items;
  const answers = real.map((it: any, i: number) => (i < right ? it.a : (it.a + 1) % it.o.length));
  return call("POST /api/history/quizzes/:id/submit", { params: { id: s.id }, body: { answers } });
}

test("every History Read has 5 well-formed questions, and shuffling keeps the right answer", () => {
  const r = seeded(3);
  assert.equal(new Set(READS.map((x) => x.id)).size, READS.length, "read ids are unique");
  for (const b of BAND_IDS) assert.ok(readsFor(b).length >= 3, `band ${b} has reads`);
  for (const read of READS) {
    assert.equal(read.qs.length, 5, read.id);
    assert.ok(read.p.length >= 3, `${read.id} has a passage`);
    for (const q of read.qs) {
      assert.ok(q.a >= 0 && q.a < q.o.length, `${read.id}: ${q.q}`);
      assert.equal(new Set(q.o).size, q.o.length, `${read.id} choices are distinct`);
      if (q.t === "Source") assert.ok(read.src, `${read.id} has the source its question refers to`);
    }
    for (let i = 0; i < 50; i++) {
      const items = makeItems(read.qs, r);
      items.forEach((it, k) => assert.equal(it.o[it.a], read.qs[k].o[read.qs[k].a]));
    }
  }
  const g = gradeQuiz(makeItems(READS[0].qs, r), [0, 1, "x", 9, null]);
  assert.equal(g.picks.filter((p) => p === null).length, 3, "bad answers don't count");
  assert.equal(pointsFor(5, 5, undefined), 70);
  assert.equal(pointsFor(3, 5, undefined), 30);
  assert.equal(pointsFor(5, 5, 3), 40, "a retake earns only the improvement, plus the perfect bonus once");
  assert.equal(pointsFor(5, 5, 5), 0);
  assert.equal(pointsFor(2, 5, 4), 0);
});

test("the answer key stays on the server until a quiz is turned in, and points follow the rules", async () => {
  const t = setup();
  const mateo = t.as(11);
  const start = await mateo("POST /api/history/quizzes", { body: { type: "read", readId: "decl" } });
  assert.equal(start.code, 201);
  const s = start.body.session;
  assert.equal(s.n, 5);
  assert.ok(s.items.every((it: any) => it.a === undefined && it.why === undefined), "no answers before turning in");

  // Someone else can't see or turn in this quiz; half-finished quizzes can't be turned in.
  assert.equal((await t.as(12)("GET /api/history/quizzes/:id", { params: { id: s.id } })).code, 404);
  assert.equal((await mateo("POST /api/history/quizzes/:id/submit", { params: { id: s.id }, body: { answers: [0, 1] } })).code, 400);

  const done = await take(mateo, t.store, start, 4);
  assert.equal(done.code, 200);
  assert.equal(done.body.result.score, 4);
  assert.equal(done.body.result.points, 40);
  assert.equal(done.body.result.passed, true);
  assert.ok(done.body.session.items.every((it: any) => Number.isInteger(it.a) && it.why), "answers come back after turning in");
  assert.equal((await mateo("POST /api/history/quizzes/:id/submit", { params: { id: s.id }, body: { answers: [0, 0, 0, 0, 0] } })).code, 409, "can't turn in twice");

  // A retake: same score earns nothing, a perfect score earns the improvement plus the bonus and a certificate.
  const again = await take(mateo, t.store, await mateo("POST /api/history/quizzes", { body: { type: "read", readId: "decl" } }), 4);
  assert.equal(again.body.result.points, 0);
  const perfect = await take(mateo, t.store, await mateo("POST /api/history/quizzes", { body: { type: "read", readId: "decl" } }), 5);
  assert.equal(perfect.body.result.points, 30);
  assert.ok(perfect.body.result.certs.some((c: any) => c.t === "Perfect Score"));
  const me = (await mateo("GET /api/history/me")).body;
  assert.equal(me.profile.points, 70);
  assert.equal(me.profile.quizzes, 3);
  assert.equal(me.band, "g35");
  assert.ok(me.achievements.includes("first") && me.achievements.includes("perfect") && me.achievements.includes("source"));

  // Teachers and parents can't take quizzes; unknown reads are refused.
  assert.equal((await t.as(1)("POST /api/history/quizzes", { body: { type: "read", readId: "decl" } })).code, 403);
  assert.equal((await mateo("POST /api/history/quizzes", { body: { type: "read", readId: "nope" } })).code, 400);
});

test("weekly goal, milestones and the week rollover", async () => {
  const t = setup();
  const solo = t.as(14);
  for (const id of ["newdeal", "dust", "brown"]) await take(solo, t.store, await solo("POST /api/history/quizzes", { body: { type: "read", readId: id } }), 5);
  let me = (await solo("GET /api/history/me")).body;
  assert.equal(me.profile.points, 210);
  assert.equal(me.profile.week_passed.length, 3);
  assert.ok(["goal", "travel", "perfect"].every((a) => me.achievements.includes(a)));
  assert.ok(me.profile.certs.some((c: any) => c.t === "250 History Points") === false);
  // Next week, this week's numbers start over but the Goal Getter achievement stays.
  t.tick(7 * 86400_000);
  me = (await solo("GET /api/history/me")).body;
  assert.equal(me.profile.week_points, 0);
  assert.equal(me.profile.week_passed.length, 0);
  assert.ok(me.achievements.includes("goal"));
  // No class: no leaderboard, no assignments.
  assert.equal((await solo("GET /api/history/board")).body.board, null);
  assert.deepEqual((await solo("GET /api/history/assignments")).body.assignments, []);
});

test("leaderboard shows only the class, with first names and last initials", async () => {
  const t = setup();
  await take(t.as(11), t.store, await t.as(11)("POST /api/history/quizzes", { body: { type: "read", readId: "tea" } }), 5);
  await take(t.as(12), t.store, await t.as(12)("POST /api/history/quizzes", { body: { type: "read", readId: "tea" } }), 3);
  await take(t.as(13), t.store, await t.as(13)("POST /api/history/quizzes", { body: { type: "read", readId: "nile" } }), 5);
  const b = (await t.as(12)("GET /api/history/board")).body;
  assert.deepEqual(b.board.map((r: any) => r.name), ["Mateo R.", "Aria L."]);
  assert.ok(b.board.every((r: any) => r.id === undefined), "students don't get ids");
  assert.equal(b.board.find((r: any) => r.me).name, "Aria L.");
  // A teacher can hide the board; points still count.
  await t.as(1)("PUT /api/history/class/settings", { body: { boardShow: false } });
  assert.equal((await t.as(12)("GET /api/history/board")).body.board, null);
  assert.equal((await t.as(1)("GET /api/history/board")).body.board.length, 2);
  assert.equal((await t.as(21)("GET /api/history/board")).code, 403);
});

test("teachers assign reads and their own questions; students see only their class's", async () => {
  const t = setup();
  const chen = t.as(1);
  assert.equal((await chen("POST /api/history/assignments", { body: { kind: "read", readId: "jamestown", due: "2026-10-01" } })).code, 400, "due date in the past");
  const a1 = await chen("POST /api/history/assignments", { body: { kind: "read", readId: "jamestown", due: "2026-10-12" } });
  assert.equal(a1.code, 201);
  assert.equal(a1.body.assignment.title, "Jamestown");
  assert.equal((await chen("POST /api/history/assignments", { body: { kind: "custom", due: "2026-10-12", questions: [{ q: "Same?", o: ["A", "a"], a: 0 }] } })).code, 400, "duplicate choices");
  const a2 = await chen("POST /api/history/assignments", { body: { kind: "custom", title: "Chapter 6 check", note: "Pages 112–118", due: "2026-10-12", questions: [
    { q: "What did the Stamp Act tax?", o: ["Printed paper", "Tea", "Horses"], a: 0 }, { q: "When was it passed?", o: ["1765", "1776"], a: 0, why: "Repealed in 1766." },
  ] } });
  assert.equal(a2.code, 201);
  assert.equal(a2.body.assignment.questions, 2);
  assert.ok(t.notes.some((n) => n.id === 11 && /Chapter 6 check/.test(n.body)));
  assert.ok(!t.notes.some((n) => n.id === 15), "unapproved students aren't notified");

  const mine = (await t.as(11)("GET /api/history/assignments")).body.assignments;
  assert.equal(mine.length, 2);
  assert.equal((await t.as(13)("GET /api/history/assignments")).body.assignments.length, 0);
  assert.equal((await t.as(13)("POST /api/history/quizzes", { body: { type: "assign", assignmentId: a2.body.assignment.id } })).code, 404, "other class");

  const st = await t.as(11)("POST /api/history/quizzes", { body: { type: "assign", assignmentId: a2.body.assignment.id } });
  assert.equal(st.body.session.n, 2);
  const r = await take(t.as(11), t.store, st, 2);
  assert.equal(r.body.result.points, 40);
  const list = (await chen("GET /api/history/assignments")).body.assignments;
  assert.equal(list.find((a: any) => a.id === a2.body.assignment.id).done, 1);
  assert.equal(list.find((a: any) => a.id === a2.body.assignment.id).avg, 100);

  // An assigned read the student already took earns points only for beating their best.
  await take(t.as(12), t.store, await t.as(12)("POST /api/history/quizzes", { body: { type: "read", readId: "jamestown" } }), 4);
  const asg = await take(t.as(12), t.store, await t.as(12)("POST /api/history/quizzes", { body: { type: "assign", assignmentId: a1.body.assignment.id } }), 4);
  assert.equal(asg.body.result.points, 0);

  assert.equal((await t.as(2)("DELETE /api/history/assignments/:id", { params: { id: a1.body.assignment.id } })).code, 404, "only the owner removes it");
  assert.equal((await chen("DELETE /api/history/assignments/:id", { params: { id: a1.body.assignment.id } })).code, 200);
});

test("teachers see their class and send certificates; parents see their own child", async () => {
  const t = setup();
  await take(t.as(11), t.store, await t.as(11)("POST /api/history/quizzes", { body: { type: "read", readId: "decl" } }), 3);
  const cls = (await t.as(1)("GET /api/history/class")).body;
  assert.equal(cls.students.length, 2);
  assert.equal(cls.settings.band, "g35");
  assert.equal(cls.students.find((s: any) => s.name === "Aria L.").status, "new");
  assert.equal((await t.as(1)("GET /api/history/students/:id", { params: { id: 13 } })).code, 404, "not in this class");
  assert.equal((await t.as(1)("POST /api/history/students/:id/certificate", { params: { id: 11 }, body: { title: "Made up" } })).code, 400);
  assert.equal((await t.as(1)("POST /api/history/students/:id/certificate", { params: { id: 11 }, body: { title: "History Star" } })).code, 200);
  assert.ok((await t.as(11)("GET /api/history/me")).body.profile.certs.some((c: any) => c.t === "History Star"));
  assert.equal((await t.as(11)("GET /api/history/class")).code, 403);

  const fam = (await t.as(21)("GET /api/history/children")).body.children;
  assert.equal(fam.length, 1);
  assert.equal(fam[0].firstName, "Mateo");
  assert.equal(fam[0].profile.points, 30);
  assert.equal(fam[0].teacherName, "Ms. Chen");
  assert.equal((await t.as(11)("GET /api/history/children")).code, 403);
});

test("live review: join by code, answer once, answers hidden until reveal", async () => {
  const t = setup();
  const chen = t.as(1);
  const g = (await chen("POST /api/history/live")).body.game;
  assert.equal(g.phase, "lobby");
  assert.equal((await chen("POST /api/history/live/:id/next", { params: { id: g.id } })).code, 400, "needs a player");
  assert.equal((await t.as(13)("POST /api/history/live/join", { body: { code: g.code } })).code, 404, "other class");
  const j = await t.as(11)("POST /api/history/live/join", { body: { code: g.code } });
  assert.equal(j.code, 200);
  const q1 = (await chen("POST /api/history/live/:id/next", { params: { id: g.id } })).body.game;
  assert.equal(q1.phase, "q");
  assert.equal(q1.question.a, null);
  const real = (await t.store.getLive(g.id))!.question!;
  assert.equal((await t.as(11)("POST /api/history/live/:id/answer", { params: { id: g.id }, body: { value: 9 } })).code, 400);
  assert.equal((await t.as(11)("POST /api/history/live/:id/answer", { params: { id: g.id }, body: { value: real.a } })).code, 200);
  assert.equal((await t.as(11)("POST /api/history/live/:id/answer", { params: { id: g.id }, body: { value: real.a } })).code, 409);
  const play = (await t.as(11)("GET /api/history/live/:id/play", { params: { id: g.id } })).body.game;
  assert.equal(play.phase, "reveal", "everyone answered");
  assert.equal(play.myRight, true);
  assert.equal(play.question.a, real.a);
  // Five questions, no repeats, then done.
  let cur = play;
  for (let i = 0; i < 9; i++) cur = (await chen("POST /api/history/live/:id/next", { params: { id: g.id } })).body.game;
  assert.equal(cur.phase, "done");
  assert.equal(new Set((await t.store.getLive(g.id))!.used).size, 5);
  assert.ok((await t.as(11)("GET /api/history/me")).body.achievements.includes("live"));
});

test("stored profiles and custom questions are cleaned", () => {
  const p = cleanHistoryProfile({ points: "12", best: { "read:decl": 4, "bad key": 3 }, certs: [{ t: "x".repeat(99) }], avatar: "nope", band: "zz", week_passed: ["read:decl", "read:decl"] });
  assert.equal(p.points, 12);
  assert.deepEqual(Object.keys(p.best), ["read:decl"]);
  assert.equal(p.certs[0].t.length, 40);
  assert.equal(p.avatar, "primary");
  assert.equal(p.band, null);
  assert.deepEqual(p.week_passed, ["read:decl"]);
  assert.deepEqual(cleanHistoryProfile(null), emptyHistoryProfile());
  assert.equal(cleanCustom({ q: "Q", o: ["only"], a: 0 }), null);
  assert.equal(cleanCustom({ q: "Q", o: ["a", "b"], a: 2 }), null);
  assert.equal(cleanCustom({ q: "Q", o: ["a", "b"], a: 1 })!.why, "The answer is b.");
  assert.equal(profileNow(emptyHistoryProfile(), Date.parse("2026-10-08T18:00:00Z")).week_key, "2026-10-05");
});
