// Run with: npx tsx --test tests/arise-math.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryMathStore, registerAriseMathRoutes, type MathUser } from "../server/ariseMath";
import { BANDS, SKILLS, SKILL_IDS, cleanMathProfile, isRight, makeProblem, mathWeek, numberChoices, parseAnswer, profileNow, emptyMathProfile } from "../shared/ariseMath";

const people: Record<number, MathUser & { grade?: string }> = {
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

/** A seeded random number generator, so every run makes the same questions. */
const seeded = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function setup() {
  const routes: Record<string, Function> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers[handlers.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  let clock = Date.parse("2026-10-08T18:00:00Z");
  const notes: { id: number; body: string }[] = [];
  const store = createMemoryMathStore(() => clock);
  registerAriseMathRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
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

/** Plays a whole quiz. `plan` says, per question, how to answer: "first", "hint" (hint then right), or "miss". */
async function play(call: ReturnType<ReturnType<typeof setup>["as"]>, session: any, store: any, plan: ("first" | "hint" | "miss")[]) {
  let s = session, last: any;
  for (let i = 0; i < s.n; i++) {
    const real = (await store.getSession(s.id)).items[s.i];
    const how = plan[i] ?? "first";
    const wrong = real.kind === "choice" ? real.choices.find((c: any) => c.v !== String(real.answer)).v : String(Number(real.answer) + 1);
    if (how === "hint") s = (await call("POST /api/math/quizzes/:id/hint", { params: { id: s.id } })).body.session;
    if (how === "miss") { await call("POST /api/math/quizzes/:id/answer", { params: { id: s.id }, body: { value: wrong } }); s = (await call("POST /api/math/quizzes/:id/answer", { params: { id: s.id }, body: { value: wrong } })).body.session; }
    else s = (await call("POST /api/math/quizzes/:id/answer", { params: { id: s.id }, body: { value: String(real.answer) } })).body.session;
    last = (await call("POST /api/math/quizzes/:id/next", { params: { id: s.id } })).body;
    s = last.session;
  }
  return last;
}

test("every generator makes a question whose stored answer checks as right", () => {
  const r = seeded(3);
  for (const id of SKILL_IDS) for (let i = 0; i < 300; i++) {
    const p = makeProblem(id, r);
    assert.ok(isRight(p, String(p.answer)), `${id}: ${p.plain}`);
    assert.ok(p.choices.some((c) => isRight(p, c.v)), `${id} choices include the answer`);
    assert.equal(new Set(p.choices.map((c) => c.v)).size, p.choices.length, `${id} choices are distinct`);
    assert.ok(p.steps.length > 0);
  }
  assert.equal(parseAnswer("3/4"), 0.75);
  assert.equal(parseAnswer("−3"), -3);
  assert.equal(parseAnswer("x = 4"), 4);
  assert.ok(Number.isNaN(parseAnswer("four")));
  assert.ok(numberChoices(2, false, r).every((c) => Number(c.v) >= 0), "no negative choices for young grades");
  assert.deepEqual(Object.values(BANDS).flatMap((b) => b.skills).sort(), [...SKILL_IDS].sort());
});

test("answers and steps stay on the server until earned, and points follow the rules", async () => {
  const t = setup();
  const mateo = t.as(11);
  const start = await mateo("POST /api/math/quizzes", { body: { type: "skill", skill: "mult" } });
  assert.equal(start.code, 201);
  const s = start.body.session;
  assert.equal(s.n, 5);
  assert.equal(s.item.answer, null);
  assert.deepEqual(s.item.steps, []);
  assert.ok(s.item.stepsTotal > 0);

  const hinted = (await mateo("POST /api/math/quizzes/:id/hint", { params: { id: s.id } })).body.session;
  assert.equal(hinted.item.steps.length, 1);
  assert.equal(hinted.item.answer, null);

  // Someone else can't see or answer this quiz.
  assert.equal((await t.as(12)("GET /api/math/quizzes/:id", { params: { id: s.id } })).code, 404);
  assert.equal((await mateo("POST /api/math/quizzes/:id/next", { params: { id: s.id } })).code, 400);
  assert.equal((await mateo("POST /api/math/quizzes/:id/answer", { params: { id: s.id }, body: { value: "lots" } })).code, 400);

  const done = await play(mateo, hinted, t.store, ["hint", "first", "first", "first", "miss"]);
  // 5 (hint) + 3 × 10 (first tries) + 0 (missed) and no perfect bonus.
  assert.equal(done.result.score, 4);
  assert.equal(done.result.points, 35);
  assert.equal(done.result.perfect, false);
  assert.equal(done.session.item.answer !== null, true, "a finished question shows its answer");
  const me = (await mateo("GET /api/math/me")).body;
  assert.equal(me.profile.points, 35);
  assert.equal(me.profile.week_points, 35);
  assert.equal(me.profile.quizzes, 1);
  assert.equal(me.profile.streak, 1);
  assert.equal(me.profile.mastery.mult.t, 5);
  assert.equal(me.profile.mastery.mult.r, 3.5);
  assert.ok(me.achievements.includes("first"));
  assert.equal(me.band, "g35");
});

test("a perfect quiz earns the bonus and a certificate", async () => {
  const t = setup();
  const aria = t.as(12);
  const s = (await aria("POST /api/math/quizzes", { body: { type: "skill", skill: "frac" } })).body.session;
  const done = await play(aria, s, t.store, ["first", "first", "first", "first", "first"]);
  assert.equal(done.result.points, 70);
  assert.equal(done.result.perfect, true);
  assert.equal(done.result.cert.t, "Perfect Score");
  assert.ok(done.result.newAchievements.includes("perfect"));
  assert.ok(done.result.newAchievements.includes("solo"));
  assert.equal(done.profile.certs.length, 1);
});

test("the leaderboard shows only your own class, by first name and last initial", async () => {
  const t = setup();
  const s1 = (await t.as(11)("POST /api/math/quizzes", { body: { type: "skill", skill: "mult" } })).body.session;
  await play(t.as(11), s1, t.store, ["first", "first", "first", "first", "first"]);
  const s2 = (await t.as(13)("POST /api/math/quizzes", { body: { type: "skill", skill: "int" } })).body.session;
  await play(t.as(13), s2, t.store, ["first"]);

  const board = (await t.as(12)("GET /api/math/board")).body;
  assert.deepEqual(board.board.map((r: any) => r.name), ["Mateo R.", "Aria L."]);
  assert.equal(board.board[0].points, 70);
  assert.equal(board.board[0].id, undefined, "students don't get classmates' account IDs");
  assert.ok(board.board.find((r: any) => r.name === "Aria L.").me);

  assert.ok((await t.as(1)("GET /api/math/board")).body.board[0].id, "teachers do");
  assert.equal((await t.as(14)("GET /api/math/board")).body.board, null, "no class, no board");
  assert.equal((await t.as(15)("GET /api/math/board")).body.board, null, "not yet approved, no board");
  assert.equal((await t.as(21)("GET /api/math/board")).code, 403);

  await t.as(1)("PUT /api/math/class/settings", { body: { boardShow: false } });
  const hidden = (await t.as(12)("GET /api/math/board")).body;
  assert.equal(hidden.board, null);
  assert.equal(hidden.hidden, true);
  assert.equal((await t.as(1)("GET /api/math/board")).body.board.length, 2, "the teacher still sees it");
});

test("weekly points start over on Monday; all-time points don't", async () => {
  const t = setup();
  const s = (await t.as(11)("POST /api/math/quizzes", { body: { type: "skill", skill: "mult" } })).body.session;
  await play(t.as(11), s, t.store, ["first"]);
  t.tick(5 * 86400_000);
  const me = (await t.as(11)("GET /api/math/me")).body;
  assert.equal(me.profile.week_points, 0);
  assert.equal(me.profile.points, 70);
  assert.equal(me.profile.streak, 0, "a missed day breaks the streak");
  assert.equal(mathWeek(Date.parse("2026-10-08T18:00:00Z")), "2026-10-05");
});

test("teachers see and reward only their own students", async () => {
  const t = setup();
  const cls = (await t.as(1)("GET /api/math/class")).body;
  assert.deepEqual(cls.students.map((s: any) => s.name).sort(), ["Aria L.", "Mateo R."]);
  assert.equal(cls.settings.band, "g35", "the band comes from the students' grades");
  assert.equal(cls.students[0].status, "new");
  assert.equal((await t.as(2)("GET /api/math/students/:id", { params: { id: "11" } })).code, 404);
  assert.equal((await t.as(2)("POST /api/math/students/:id/certificate", { params: { id: "11" }, body: { title: "Math Star" } })).code, 404);
  assert.equal((await t.as(11)("GET /api/math/class")).code, 403);
  assert.equal((await t.as(1)("POST /api/math/students/:id/certificate", { params: { id: "11" }, body: { title: "Math Star" } })).code, 200);
  assert.equal((await t.as(11)("GET /api/math/me")).body.profile.certs[0].by, "Ms. Chen");
  assert.ok(t.notes.some((n) => n.id === 11 && /certificate/.test(n.body)));
});

test("assignments reach the teacher's class only, and results come back", async () => {
  const t = setup();
  const bad = await t.as(1)("POST /api/math/assignments", { body: { skill: "custom", n: 5, due: "2026-10-10", questions: [{ q: "", a: "4" }, { q: "Seats?", a: "many" }] } });
  assert.equal(bad.code, 400);
  assert.equal((await t.as(1)("POST /api/math/assignments", { body: { skill: "mult", n: 5, due: "2026-10-01" } })).code, 400, "due date in the past");
  const made = await t.as(1)("POST /api/math/assignments", { body: { skill: "custom", n: 5, due: "2026-10-10", questions: [{ q: "A bus holds 48 kids. How many buses for 192?", a: "4", h: "Divide." }] } });
  assert.equal(made.code, 201);
  const id = made.body.assignment.id;
  assert.equal(t.notes.filter((n) => /New math assignment/.test(n.body)).length, 2);

  assert.equal((await t.as(11)("GET /api/math/assignments")).body.assignments.length, 1);
  assert.equal((await t.as(13)("GET /api/math/assignments")).body.assignments.length, 0);
  assert.equal((await t.as(13)("POST /api/math/quizzes", { body: { type: "assign", assignmentId: id } })).code, 404);

  const s = (await t.as(11)("POST /api/math/quizzes", { body: { type: "assign", assignmentId: id } })).body.session;
  assert.equal(s.item.skill, "custom");
  await play(t.as(11), s, t.store, ["first", "first", "first", "first", "miss"]);
  const mine = (await t.as(11)("GET /api/math/assignments")).body.assignments[0];
  assert.equal(mine.myScore, 4);
  assert.equal((await t.as(1)("GET /api/math/assignments")).body.assignments[0].done, 1);
  assert.equal((await t.as(2)("DELETE /api/math/assignments/:id", { params: { id } })).code, 404);
  assert.equal((await t.as(1)("DELETE /api/math/assignments/:id", { params: { id } })).code, 200);
});

test("parents see only their own linked child", async () => {
  const t = setup();
  const s = (await t.as(11)("POST /api/math/quizzes", { body: { type: "skill", skill: "div" } })).body.session;
  await play(t.as(11), s, t.store, ["first"]);
  const kids = (await t.as(21)("GET /api/math/children")).body.children;
  assert.equal(kids.length, 1);
  assert.equal(kids[0].name, "Mateo R.");
  assert.equal(kids[0].profile.points, 70);
  assert.equal(kids[0].rank, 1);
  assert.equal(kids[0].classSize, 2);
  assert.equal(kids[0].teacherName, "Ms. Chen");
  assert.equal((await t.as(11)("GET /api/math/children")).code, 403);
});

test("live review: only the teacher's class can join, answers stay hidden until the reveal, one answer each", async () => {
  const t = setup();
  const chen = t.as(1);
  const g = (await chen("POST /api/math/live")).body.game;
  assert.equal(g.phase, "lobby");
  assert.equal(g.code.length, 6);
  assert.equal((await chen("POST /api/math/live/:id/next", { params: { id: g.id } })).code, 400, "nobody has joined yet");

  assert.equal((await t.as(13)("POST /api/math/live/join", { body: { code: g.code } })).code, 404, "another class");
  assert.equal((await t.as(11)("POST /api/math/live/join", { body: { code: "000000" } })).code, 404);
  const joined = await t.as(11)("POST /api/math/live/join", { body: { code: g.code } });
  assert.equal(joined.body.gameId, g.id);
  await t.as(12)("POST /api/math/live/join", { body: { code: g.code } });

  const q = (await chen("POST /api/math/live/:id/next", { params: { id: g.id } })).body.game;
  assert.equal(q.phase, "q");
  assert.equal(q.question.answer, null, "not even the board shows the answer early");
  const play = (await t.as(11)("GET /api/math/live/:id/play", { params: { id: g.id } })).body.game;
  assert.equal(play.question.answer, null);

  const real = (await t.store.getLive(g.id))!.question!;
  const right = real.choices.find((c) => isRight(real, c.v))!.v;
  const wrong = real.choices.find((c) => !isRight(real, c.v))!.v;
  assert.equal((await t.as(11)("POST /api/math/live/:id/answer", { params: { id: g.id }, body: { value: right } })).code, 200);
  assert.equal((await t.as(11)("POST /api/math/live/:id/answer", { params: { id: g.id }, body: { value: right } })).code, 409);
  await t.as(12)("POST /api/math/live/:id/answer", { params: { id: g.id }, body: { value: wrong } });

  const board = (await chen("GET /api/math/live/:id", { params: { id: g.id } })).body.game;
  assert.equal(board.phase, "reveal", "everyone answered, so it reveals");
  assert.equal(board.question.answer, String(real.answer));
  assert.deepEqual(board.players.map((p: any) => [p.name, p.score]), [["Mateo R.", 1], ["Aria L.", 0]]);
  const mine = (await t.as(11)("GET /api/math/live/:id/play", { params: { id: g.id } })).body.game;
  assert.equal(mine.myRight, true);
  assert.equal((await t.as(2)("GET /api/math/live/:id", { params: { id: g.id } })).code, 404);
  assert.ok((await t.as(11)("GET /api/math/me")).body.achievements.includes("live"));

  // Time runs out on the next question without anyone answering.
  await chen("POST /api/math/live/:id/next", { params: { id: g.id } });
  t.tick(21_000);
  assert.equal((await t.as(12)("POST /api/math/live/:id/answer", { params: { id: g.id }, body: { value: right } })).code, 409);
});

test("students set their band and unlock avatar styles with points; bad stored data can't break a profile", async () => {
  const t = setup();
  const solo = t.as(14);
  assert.equal((await solo("GET /api/math/me")).body.band, "g912");
  assert.equal((await solo("PUT /api/math/me", { body: { band: "g68" } })).body.band, "g68");
  assert.equal((await solo("PUT /api/math/me", { body: { avatar: "gold" } })).code, 403);
  assert.equal((await solo("PUT /api/math/me", { body: { avatar: "coral" } })).code, 200);
  const mixed = (await solo("POST /api/math/quizzes", { body: { type: "mixed" } })).body.session;
  assert.ok(BANDS.g68.skills.includes(mixed.item.skill));
  assert.equal((await t.as(1)("POST /api/math/quizzes", { body: { type: "mixed" } })).code, 403, "teachers don't take quizzes");

  const junk = cleanMathProfile({ points: "lots", mastery: { mult: { r: 2, t: 3 }, hack: { r: 9, t: 9 } }, avatar: "x", band: "g99", certs: [{ t: "<b>" }] });
  assert.equal(junk.points, 0);
  assert.deepEqual(Object.keys(junk.mastery), ["mult"]);
  assert.equal(junk.avatar, "primary");
  assert.equal(junk.band, null);
  assert.equal(profileNow(emptyMathProfile(), Date.now()).week_points, 0);
  assert.ok(SKILLS.mult.name);
});
