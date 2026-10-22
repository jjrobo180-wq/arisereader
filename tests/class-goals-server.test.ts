import test from "node:test";
import assert from "node:assert/strict";
import { createClassGoalsStore, registerClassGoalRoutes, mayUseClassGoals, classGoalsKey, READ_CACHE_MS } from "../server/classGoals";
import { totalsOf, type Op } from "../shared/classGoals";

function setup(opts: { failRead?: () => boolean; slow?: boolean } = {}) {
  const db = new Map<string, string>();
  const routes: Record<string, Function> = {};
  const reg = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: reg("GET"), post: reg("POST") };
  let clock = Date.parse("2026-10-14T16:00:00Z");
  let writes = 0;
  registerClassGoalRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    now: () => clock,
    readSetting: async (k) => {
      if (opts.failRead?.()) throw new Error("db down");
      if (opts.slow) await new Promise((r) => setTimeout(r, 5));
      return db.get(k) ?? "";
    },
    upsertSetting: async (k, v) => { writes++; db.set(k, v); },
  });
  const call = async (key: string, user: any, req: any = {}) => {
    let code = 200, body: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { body = d; return res; } };
    await routes[key]({ body: {}, params: {}, query: {}, ...req, user }, res);
    return { code, body };
  };
  return { db, call, writes: () => writes, tick: (ms: number) => { clock += ms; } };
}
const teacher = { id: 7, role: "teacher" };
const addGoal = (gid = "goal1", extra: any = {}): Op => ({ opId: `add-${gid}`, at: "2026-10-14T16:00:00Z", type: "goal.add", id: gid, goal: { title: "Quiet halls", target: 20, ...extra } });
const addPts = (n: string, amount: number, goalId = "goal1"): Op => ({ opId: `op-${n}`, at: "2026-10-14T16:00:00Z", type: "points.add", goalId, entryId: `en-${n}`, amount, categoryId: "c1", reason: "" });

test("a teacher starts empty, adds a goal and points, and reads them back", async () => {
  const s = setup();
  assert.deepEqual((await s.call("GET /api/class-goals", teacher)).body.state.goals, []);
  const r = await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addGoal(), addPts("a1", 5), addPts("a2", 3)] } });
  assert.equal(r.code, 200);
  assert.equal(r.body.changed, 3);
  assert.equal(s.writes(), 1, "one save for the whole batch");
  const got = (await s.call("GET /api/class-goals", teacher)).body.state;
  assert.equal(totalsOf(got.goals[0]).points, 8);
  assert.ok(s.db.has(classGoalsKey(7)));
});

test("sending the same changes again (a retry) changes and saves nothing", async () => {
  const s = setup();
  const body = { ops: [addGoal(), addPts("b1", 5)] };
  await s.call("POST /api/class-goals/ops", teacher, { body });
  const again = await s.call("POST /api/class-goals/ops", teacher, { body });
  assert.equal(again.body.changed, 0);
  assert.equal(s.writes(), 1);
  assert.equal(totalsOf(again.body.state.goals[0]).points, 5);
});

test("the rev check skips the download when nothing changed", async () => {
  const s = setup();
  await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addGoal()] } });
  const state = (await s.call("GET /api/class-goals", teacher)).body.state;
  assert.deepEqual((await s.call("GET /api/class-goals", teacher, { query: { rev: String(state.rev) } })).body, { unchanged: true, rev: state.rev });
  assert.ok((await s.call("GET /api/class-goals", teacher, { query: { rev: "0" } })).body.state);
  assert.ok((await s.call("GET /api/class-goals", teacher, { query: { rev: "junk" } })).body.state);
});

test("two devices adding points at once both count", async () => {
  const s = setup({ slow: true });
  await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addGoal()] } });
  await Promise.all(Array.from({ length: 12 }, (_, i) => s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addPts(`p${i}`, 2)] } })));
  const got = (await s.call("GET /api/class-goals", teacher)).body.state;
  assert.equal(totalsOf(got.goals[0]).points, 24, "no change lost to a race");
});

test("each account has its own goals", async () => {
  const s = setup();
  await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addGoal()] } });
  assert.deepEqual((await s.call("GET /api/class-goals", { id: 8, role: "teacher" })).body.state.goals, []);
});

test("students and the admin's student preview are turned away; adults are let in", async () => {
  const s = setup();
  for (const u of [{ id: 1, role: "student" }, { id: 2, role: "student", isAdmin: false }, undefined]) {
    assert.equal((await s.call("GET /api/class-goals", u)).code, 403);
    assert.equal((await s.call("POST /api/class-goals/ops", u, { body: { ops: [addGoal()] } })).code, 403);
  }
  for (const u of [{ id: 3, role: "teacher" }, { id: 4, role: "parent" }, { id: 5, role: "todo" }, { id: 6, role: "student", isAdmin: true }]) assert.equal(mayUseClassGoals(u), true);
  assert.equal(s.writes(), 0);
});

test("a database error is reported and never saved over the real copy", async () => {
  let fail = false;
  const s = setup({ failRead: () => fail });
  await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addGoal(), addPts("c1", 9)] } });
  const before = s.db.get(classGoalsKey(7));
  fail = true;
  const r = await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addPts("c2", 4)] } });
  assert.equal(r.code, 500);
  s.tick(10_000);
  assert.equal((await s.call("GET /api/class-goals", teacher)).code, 500);
  assert.equal(s.db.get(classGoalsKey(7)), before);
  fail = false;
  assert.equal(totalsOf((await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addPts("c3", 1)] } })).body.state.goals[0]).points, 10, "the queue recovers after an error");
});

test("bad requests are refused", async () => {
  const s = setup();
  for (const body of [{}, { ops: [] }, { ops: "x" }, { ops: Array.from({ length: 61 }, (_, i) => addPts(String(i), 1)) }]) assert.equal((await s.call("POST /api/class-goals/ops", teacher, { body })).code, 400);
  const junk = await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [null, 5, { type: "goal.add" }, { opId: "x", type: "boom" }, { opId: "longenough1", type: "boom" }, addGoal()] } });
  assert.equal(junk.body.changed, 1, "only the good change applies");
});

test("a phone with the wrong clock can't put changes in the future", async () => {
  const s = setup();
  const future: Op = { ...addPts("f1", 3), at: "2031-01-01T00:00:00Z" };
  await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addGoal(), future] } });
  const e = (await s.call("GET /api/class-goals", teacher)).body.state.goals[0].entries[0];
  assert.equal(e.at, "2026-10-14T16:00:00.000Z");
});

test("the store reads empty for a missing or damaged copy", async () => {
  const store = createClassGoalsStore({ readSetting: async () => "{broken", upsertSetting: async () => {} });
  assert.deepEqual((await store.read(1)).goals, []);
});

test("a board polling every few seconds is answered from memory, and always sees the latest change", async () => {
  let reads = 0, clock = 1_000_000;
  const db = new Map<string, string>();
  const store = createClassGoalsStore({ now: () => clock, readSetting: async (k) => { reads++; return db.get(k) ?? ""; }, upsertSetting: async (k, v) => { db.set(k, v); } });
  await store.read(7); await store.read(7); await store.read(7);
  assert.equal(reads, 1, "three polls, one database read");
  await store.apply(7, [addGoal() as Op], () => clock);
  const after = reads;
  assert.equal((await store.read(7)).goals.length, 1, "a change is visible to the very next poll");
  assert.equal(reads, after, "and that read needed no database read");
  clock += READ_CACHE_MS + 1;
  await store.read(7);
  assert.equal(reads, after + 1, "after a few seconds it checks the database again");
  db.set(classGoalsKey(7), JSON.stringify({ v: 1, rev: 99, goals: [], boardId: "", applied: [] }));
  clock += READ_CACHE_MS + 1;
  assert.equal((await store.read(7)).rev, 99, "a change made elsewhere shows up on the next check");
  assert.equal((await store.read(8)).rev, 0, "other accounts are separate");
});

test("the saved categories come back with their points", async () => {
  const s = setup();
  await s.call("POST /api/class-goals/ops", teacher, { body: { ops: [addGoal(), addPts("k1", 4)] } });
  const got = (await s.call("GET /api/class-goals", teacher, { query: { rev: "0" } })).body.state.goals[0];
  assert.deepEqual(totalsOf(got).byCategory.map((c: any) => [c.name, c.points]), [["Behavior", 4], ["Academics", 0]]);
});
