// A.R.I.S.E. Beginners on the server: lessons open in order, the answer key and the read-aloud score are worked out
// here, points go to the Reader leaderboards within the daily cap, previews save nothing, and it's wired into Reader.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beginnersPassTimes, cleanProgress, createMemoryBeginnersStore, registerBeginnersRoutes, type BeginnersPerson } from "../server/ariseBeginners";
import { LESSONS, POINTS, UNITS, lessonById } from "../shared/beginners";

const people: Record<number, BeginnersPerson> = {
  1: { id: 1, role: "teacher", displayName: "Ms. Chen", teacherId: null, schoolId: 10 },
  2: { id: 2, role: "teacher", displayName: "Mr. Far", teacherId: null, schoolId: 20 },
  9: { id: 9, role: "admin", displayName: "Admin", teacherId: null, schoolId: null },
  11: { id: 11, role: "student", displayName: "Ari Lopez", teacherId: 1, schoolId: 10 },
  12: { id: 12, role: "student", displayName: "Ben Cho", teacherId: 1, schoolId: 10 },
  13: { id: 13, role: "student", displayName: "Cy Far", teacherId: 2, schoolId: 20 },
  21: { id: 21, role: "parent", displayName: "Luis Lopez", teacherId: null, schoolId: null },
};

function setup(opts: { heard?: () => string } = {}) {
  const routes: Record<string, Function> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers[handlers.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), use: () => {} };
  let clock = Date.parse("2026-10-20T16:00:00Z");
  const store = createMemoryBeginnersStore();
  let changed = 0;
  registerBeginnersRoutes(app, (_req: any, _res: any, next: any) => next(), {
    store, now: () => clock, random: () => 0.5,
    directory: {
      user: async (id) => people[id] ?? null,
      studentsOf: async (tid) => Object.values(people).filter((p) => p.role === "student" && p.teacherId === tid),
      childrenOf: async (pid) => (pid === 21 ? [11] : []),
      gradeOf: async () => "1",
      pointsChanged: () => { changed++; },
    },
    speech: { say: async (text) => Buffer.from(`mp3:${text}`), hear: async () => (opts.heard ? opts.heard() : "") },
  });
  async function call(method: string, path: string, userId: number, body: any = {}, params: Record<string, string> = {}, query: Record<string, string> = {}) {
    const p = people[userId];
    const req: any = { user: { id: p.id, displayName: p.displayName, role: p.role === "admin" ? "teacher" : p.role, isAdmin: p.role === "admin", teacherId: p.teacherId, school_id: p.schoolId }, body, params, query, headers: { "content-type": "audio/webm" } };
    let status = 200, json: any = null, sent: any = null;
    const res: any = { set() { return res; }, type() { return res; }, status(c: number) { status = c; return res; }, json(v: any) { json = v; return res; }, send(v: any) { sent = v; return res; } };
    const handler = routes[`${method} ${path}`];
    assert.ok(handler, `no route ${method} ${path}`);
    await handler(req, res);
    return { status, json, sent };
  }
  return { call, store, tick: (ms: number) => { clock += ms; }, changed: () => changed };
}
const audio = Buffer.alloc(2000, 1);

/** Plays a lesson: answers right except the question numbers in `miss`, optionally reads the story out loud. */
async function play(t: ReturnType<typeof setup>, userId: number, lessonId: string, o: { miss?: number[]; read?: boolean; ms?: number } = {}) {
  const start = await t.call("POST", "/api/beginners/lessons/:id/start", userId, {}, { id: lessonId });
  assert.equal(start.status, 200, JSON.stringify(start.json));
  const lesson = lessonById(lessonId)!;
  for (let i = 0; i < start.json.questions.length; i++) {
    const right = lesson.questions[i].right;
    const answer = o.miss?.includes(i) ? start.json.questions[i].choices.find((c: string) => c !== right) : right;
    const r = await t.call("POST", "/api/beginners/sessions/:id/answer", userId, { index: i, answer }, { id: start.json.id });
    assert.equal(r.json.correct, !o.miss?.includes(i));
  }
  if (o.read) {
    const r = await t.call("POST", "/api/beginners/sessions/:id/read", userId, audio, { id: start.json.id }, { seconds: "30" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  t.tick(o.ms ?? 5 * 60_000);
  const fin = await t.call("POST", "/api/beginners/sessions/:id/finish", userId, {}, { id: start.json.id });
  assert.equal(fin.status, 200, JSON.stringify(fin.json));
  return fin.json;
}

test("a first pass earns the lesson's Reader points, a replay earns a practice point", async () => {
  const t = setup();
  const me = await t.call("GET", "/api/beginners/me", 11);
  assert.equal(me.json.next, "u1l1");
  assert.deepEqual(me.json.open, [1]);
  const first = await play(t, 11, "u1l1");
  assert.equal(first.stars, 2, "all questions right, no reading");
  assert.equal(first.points, 5);
  assert.equal(first.firstPass, true);
  assert.equal(first.next, "u1l2");
  assert.deepEqual(t.store.awards.map((a) => [a.student_id, a.points, a.reason]), [[11, 5, "Beginners: I Am Sam"]]);
  assert.equal(t.changed(), 1, "the leaderboards are worked out again");
  const again = await play(t, 11, "u1l1");
  assert.equal(again.points, POINTS.replay);
  assert.equal(again.firstPass, false);
  const me2 = await t.call("GET", "/api/beginners/me", 11);
  assert.equal(me2.json.total, 5 + POINTS.replay);
  assert.equal(me2.json.today.points, 5 + POINTS.replay);
  assert.equal(me2.json.lessons.u1l1.plays, 2);
});

test("reading the story out loud is scored on the server and earns the third star and a bonus", async () => {
  const lesson = lessonById("u1l2")!;
  const t = setup({ heard: () => lesson.text.replace(/[^A-Za-z ]/g, " ") });
  await play(t, 11, "u1l1");
  const r = await play(t, 11, "u1l2", { read: true });
  assert.equal(r.readAccuracy, 100);
  assert.equal(r.stars, 3);
  assert.equal(r.points, lesson.points + POINTS.readBonus);
  const me = await t.call("GET", "/api/beginners/me", 11);
  assert.equal(me.json.readings[0].lesson, "u1l2");
  assert.equal(me.json.readings[0].accuracy, 100);
});

test("missed words from a reading become practice words", async () => {
  const t = setup({ heard: () => "I am Pam I sit I sit at a mat" });
  const r = await play(t, 11, "u1l1", { read: true });
  assert.ok(r.readAccuracy !== null && r.readAccuracy < 100);
  const me = await t.call("GET", "/api/beginners/me", 11);
  assert.ok(me.json.practice.includes("sam") && me.json.practice.includes("sat"), JSON.stringify(me.json.practice));
});

test("one question right doesn't pass; too fast earns nothing", async () => {
  const t = setup();
  const fail = await play(t, 11, "u1l1", { miss: [0, 1] });
  assert.equal(fail.stars, 0);
  assert.equal(fail.points, 0);
  const fast = await play(t, 11, "u1l1", { ms: 10_000 });
  assert.equal(fast.tooFast, true);
  assert.equal(fast.points, 0);
  assert.equal(t.store.awards.length, 0);
  assert.equal(fast.next, "u1l1", "a too-fast lesson doesn't count as passed");
  const real = await play(t, 11, "u1l1");
  assert.equal(real.firstPass, true, "so its points can still be earned");
  assert.equal(real.points, 5);
});

test("units open in order; a teacher or parent can set where a child starts", async () => {
  const t = setup();
  const locked = await t.call("POST", "/api/beginners/lessons/:id/start", 11, {}, { id: "u2l1" });
  assert.equal(locked.status, 403);
  for (const l of UNITS[0].lessons) await play(t, 11, l.id);
  const open = await t.call("POST", "/api/beginners/lessons/:id/start", 11, {}, { id: "u2l1" });
  assert.equal(open.status, 200);
  assert.equal((await t.call("POST", "/api/beginners/students/:id/start-unit", 2, { unit: 5 }, { id: "12" })).status, 403, "not their student");
  assert.equal((await t.call("POST", "/api/beginners/students/:id/start-unit", 11, { unit: 5 }, { id: "12" })).status, 403, "students can't");
  assert.equal((await t.call("POST", "/api/beginners/students/:id/start-unit", 1, { unit: 5 }, { id: "12" })).status, 200);
  assert.equal((await t.call("POST", "/api/beginners/lessons/:id/start", 12, {}, { id: "u5l1" })).status, 200);
  assert.equal((await t.call("POST", "/api/beginners/students/:id/start-unit", 21, { unit: 3 }, { id: "11" })).status, 200, "a parent, for their child");
  assert.equal((await t.call("GET", "/api/beginners/me", 11)).json.startUnit, 3);
});

test("the daily cap holds", async () => {
  const t = setup();
  await t.call("POST", "/api/beginners/students/:id/start-unit", 1, { unit: 18 }, { id: "11" });
  let got = 0;
  for (const l of LESSONS.filter((x) => x.unit >= 10).slice(0, 8)) got += (await play(t, 11, l.id)).points;
  assert.equal(got, POINTS.dailyCap);
  assert.equal(t.store.awards.reduce((s, a) => s + a.points, 0), POINTS.dailyCap);
});

test("teachers, parents and the administrator preview without saving or scoring", async () => {
  const t = setup();
  const me = await t.call("GET", "/api/beginners/me", 1);
  assert.equal(me.json.preview, true);
  assert.equal(me.json.open.length, UNITS.length);
  const r = await play(t, 1, "u12l1");
  assert.equal(r.preview, true);
  assert.equal(r.points, 0);
  assert.equal(t.store.rows.size, 0);
  assert.equal(t.store.awards.length, 0);
});

test("the voice says only the program", async () => {
  const t = setup();
  const ok = await t.call("POST", "/api/beginners/voice", 11, { text: "I am Sam." });
  assert.equal(ok.status, 200);
  assert.equal(String(ok.sent), "mp3:I am Sam.");
  assert.equal((await t.call("POST", "/api/beginners/voice", 11, { text: "Say anything I type" })).status, 400);
});

test("Say It Studio: words said right add up to points, voice-bar-only sets aren't checked", async () => {
  let said = "cat";
  const t = setup({ heard: () => said });
  const words = ["cat", "dog", "cow", "pig", "duck"];
  let points = 0;
  for (const w of words) { said = w; const r = await t.call("POST", "/api/beginners/say", 11, audio, {}, { word: w, set: "animals" }); assert.equal(r.json.correct, true); points += r.json.points; }
  assert.equal(points, 1);
  said = "dog";
  assert.equal((await t.call("POST", "/api/beginners/say", 11, audio, {}, { word: "cat", set: "animals" })).json.correct, false);
  said = "mama";
  assert.equal((await t.call("POST", "/api/beginners/say", 11, audio, {}, { word: "mom", set: "hello-me" })).json.correct, true, "other ways of saying it count");
  assert.equal((await t.call("POST", "/api/beginners/say", 11, audio, {}, { word: "moo", set: "fun-sounds" })).status, 400);
  assert.equal((await t.call("POST", "/api/beginners/say", 11, audio, {}, { word: "unicorn", set: "animals" })).status, 400);
  said = "sat";
  assert.equal((await t.call("POST", "/api/beginners/say", 11, audio, {}, { word: "sat" })).json.correct, true, "a lesson word");
});

test("the class view: teachers see their class, parents their children", async () => {
  const t = setup();
  await play(t, 11, "u1l1");
  const teacher = await t.call("GET", "/api/beginners/students", 1);
  assert.deepEqual(teacher.json.students.map((s: any) => s.id), [11, 12]);
  assert.equal(teacher.json.students[0].passed, 1);
  assert.equal(teacher.json.students[0].next.id, "u1l2");
  const parent = await t.call("GET", "/api/beginners/students", 21);
  assert.deepEqual(parent.json.students.map((s: any) => s.id), [11]);
  assert.equal((await t.call("GET", "/api/beginners/students", 11)).status, 403);
  const admin = await t.call("GET", "/api/beginners/students", 9);
  assert.deepEqual(admin.json.students.map((s: any) => s.id), [11]);
});

test("first passes count as passed quizzes toward prize goals", async () => {
  const t = setup();
  await play(t, 11, "u1l1");
  await play(t, 11, "u1l1");
  await play(t, 11, "u1l2");
  const times = await beginnersPassTimes(11, t.store);
  assert.equal(times.length, 2);
  assert.ok(times.every((x) => Number.isFinite(x)));
});

test("saved progress is cleaned", () => {
  const p = cleanProgress({ startUnit: 99, lessons: { u1l1: { stars: 9, best: 300, first: "nope", plays: -2 }, fake: { stars: 3 } }, practice: ["ok", "<script>"], days: { "2026-10-20": 5, bad: 3 } });
  assert.equal(p.startUnit, UNITS.length);
  assert.deepEqual(Object.keys(p.lessons), ["u1l1"]);
  assert.equal(p.lessons.u1l1.stars, 3);
  assert.equal(p.lessons.u1l1.best, 100);
  assert.equal(p.lessons.u1l1.first, null);
  assert.deepEqual(p.practice, ["ok"]);
  assert.deepEqual(p.days, { "2026-10-20": 5 });
});

test("it's wired into Reader: routes, prizes, the page and the library", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(routes, /registerBeginnersRoutes\(app, authMiddleware/);
  assert.match(routes, /\.\.\.\(await beginnersPassTimes\(studentId\)\)/);
  const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /<Route path="\/beginners">/);
  const library = readFileSync(new URL("../client/src/pages/Library.tsx", import.meta.url), "utf8");
  assert.match(library, /navigate\("\/beginners"\)/);
});
