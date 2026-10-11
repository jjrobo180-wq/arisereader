import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryBehaviorStore, registerClassBehaviorRoutes, type BUser } from "../server/classBehavior";
import { cleanSettings, minutesOut, overTime, positiveRate, totals } from "../shared/classBehavior";

const people: Record<number, BUser> = {
  1: { id: 1, role: "teacher", displayName: "Ms. Chen", teacherId: null, approvedByTeacher: true, archived: false },
  2: { id: 2, role: "teacher", displayName: "Mr. Diaz", teacherId: null, approvedByTeacher: true, archived: false },
  11: { id: 11, role: "student", displayName: "Mateo Ramirez", teacherId: 1, approvedByTeacher: true, archived: false },
  12: { id: 12, role: "student", displayName: "Aria Lopez", teacherId: 1, approvedByTeacher: true, archived: false },
  13: { id: 13, role: "student", displayName: "Kenji Lee", teacherId: 2, approvedByTeacher: true, archived: false },
  21: { id: 21, role: "parent", displayName: "Luis Ramirez", teacherId: null, approvedByTeacher: true, archived: false },
};

function setup() {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  let clock = Date.parse("2026-10-14T16:00:00Z");
  const notes: { id: number; body: string }[] = [];
  registerClassBehaviorRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    store: createMemoryBehaviorStore(), now: () => clock,
    directory: {
      user: async (id) => people[id] ?? null,
      studentsOf: async (t) => Object.values(people).filter((p) => p.role === "student" && p.teacherId === t),
      childrenOf: async (p) => (p === 21 ? [11] : []),
      parentsOf: async (s) => (s === 11 ? [21] : []),
      notify: async (id, m) => { notes.push({ id, body: m.body }); },
    },
  });
  const as = (uid: number) => async (key: string, req: any = {}) => {
    let code = 200, body: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { body = d; return res; } };
    await routes[key]({ body: {}, params: {}, query: {}, ...req, user: { id: uid } }, res);
    return { code, body };
  };
  return { as, notes, tick: (ms: number) => { clock += ms; } };
}

test("settings clean up, and totals count today, this week and all time", () => {
  const s = cleanSettings({ behaviors: [{ label: "Kind", points: 50 }, { label: "" }], places: [], maxOut: 99 });
  assert.equal(s.behaviors.length, 1);
  assert.equal(s.behaviors[0].points, 10);
  assert.ok(s.places.length > 0, "empty places fall back to the defaults");
  assert.equal(s.maxOut, 30);
  const now = Date.parse("2026-10-14T16:00:00Z");
  const t = totals([{ student_id: 1, points: 2, created_at: "2026-10-14T15:00:00Z" }, { student_id: 1, points: -1, created_at: "2026-10-12T15:00:00Z" }, { student_id: 1, points: 3, created_at: "2026-10-01T15:00:00Z" }], now);
  assert.deepEqual(t[1], { all: 4, week: 1, today: 2, pos: 5, neg: 1 });
  assert.equal(positiveRate(t[1]), 83);
  assert.equal(minutesOut({ out_at: "2026-10-14T15:50:00Z", back_at: null }, now), 10);
  assert.ok(overTime({ status: "out", limit_min: 5, out_at: "2026-10-14T15:50:00Z", back_at: null } as any, now));
});

test("teachers give points to their own students only; shared notes reach parents", async () => {
  const t = setup(), chen = t.as(1);
  const r = await chen("POST /api/behavior/points", { body: { studentIds: [11, 12, 13], behaviorId: "helping", note: "Helped a classmate read" } });
  assert.equal(r.body.added.length, 2, "Kenji isn't in Ms. Chen's class");
  assert.equal(r.body.added[0].points, 2);
  await new Promise((ok) => setTimeout(ok, 0));
  assert.ok(t.notes.some((n) => n.id === 21 && /Helping others: Helped a classmate read/.test(n.body)));
  await chen("POST /api/behavior/points", { body: { studentIds: [11], label: "Private note", points: 0, share: false } });
  const cls = (await chen("GET /api/behavior/class")).body;
  assert.equal(cls.students.find((s: any) => s.id === 11).today, 2);
  assert.equal((await t.as(2)("POST /api/behavior/points", { body: { studentIds: [11], behaviorId: "on-task" } })).code, 400);
  assert.equal((await t.as(11)("GET /api/behavior/class")).code, 403);
  const kids = (await t.as(21)("GET /api/behavior/children")).body.children;
  assert.equal(kids.length, 1);
  assert.equal(kids[0].recent.length, 1, "the private note stays with the teacher");
  const undo = (await chen("DELETE /api/behavior/events/:id", { params: { id: r.body.added[0].id } })).body;
  assert.equal(undo.removed, true);
});

test("hall passes: a student asks, the teacher approves within the limit, and the student comes back", async () => {
  const t = setup(), chen = t.as(1), mateo = t.as(11), aria = t.as(12);
  await chen("PUT /api/behavior/settings", { body: { maxOut: 1, places: [{ id: "restroom", label: "Restroom", minutes: 5 }] } });
  const ask = await mateo("POST /api/behavior/me/pass", { body: { place: "restroom" } });
  assert.equal(ask.body.pass.status, "asked");
  assert.ok(t.notes.some((n) => n.id === 1 && /Mateo R\. asked/.test(n.body)));
  assert.equal((await mateo("POST /api/behavior/me/pass", { body: { place: "restroom" } })).code, 409, "one at a time");
  const ok = await chen("POST /api/behavior/passes/:id/:act", { params: { id: ask.body.pass.id, act: "approve" } });
  assert.equal(ok.body.pass.status, "out");
  const second = await aria("POST /api/behavior/me/pass", { body: { place: "restroom" } });
  const full = await chen("POST /api/behavior/passes/:id/:act", { params: { id: second.body.pass.id, act: "approve" } });
  assert.equal(full.code, 409); assert.equal(full.body.full, true);
  assert.equal((await chen("POST /api/behavior/passes/:id/:act", { params: { id: second.body.pass.id, act: "approve" }, body: { force: true } })).body.pass.status, "out");
  t.tick(6 * 60_000);
  assert.equal((await mateo("POST /api/behavior/me/pass/:act", { params: { act: "back" } })).body.ok, true);
  assert.equal((await mateo("GET /api/behavior/me")).body.pass, null);
  const parent = (await t.as(21)("GET /api/behavior/children")).body.children[0];
  assert.equal(parent.passes[0].status, "back");
  assert.equal((await t.as(13)("POST /api/behavior/passes/:id/:act", { params: { id: second.body.pass.id, act: "back" } })).code, 403);
  assert.equal((await t.as(2)("POST /api/behavior/passes/:id/:act", { params: { id: second.body.pass.id, act: "back" } })).code, 404);
});
