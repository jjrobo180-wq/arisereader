import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryScholarStore, registerScholarRoutes, type ScholarViewer } from "../server/scholar";
import { boardName, buildBoard, periodStartDay, schoolDay } from "../shared/scholar";

const people: Record<number, ScholarViewer> = {
  1: { id: 1, role: "teacher", displayName: "Ms. Chen", schoolId: 5 },
  2: { id: 2, role: "teacher", displayName: "Mr. Diaz", schoolId: 9 },
  11: { id: 11, role: "student", displayName: "Mateo Ramirez", schoolId: 5 },
  12: { id: 12, role: "student", displayName: "Aria Lopez", schoolId: 5 },
  13: { id: 13, role: "student", displayName: "Kenji Lee", schoolId: 9 },
};

function setup() {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST") };
  let clock = Date.parse("2026-11-12T17:00:00Z"); // Thursday, 10 am in Denver
  registerScholarRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    store: createMemoryScholarStore(), now: () => clock,
    viewer: async (id) => people[id] ?? null,
    schoolStudents: async (school) => Object.values(people).filter((p) => p.role === "student" && p.schoolId === school).map((p) => ({ id: p.id, name: p.displayName, group: "" })),
    schoolName: async (id) => (id === 5 ? "Green Middle" : "Other"),
  });
  const call = async (m: string, path: string, user: number, body: any = {}, query: any = {}) => {
    let out: any, code = 200;
    const res: any = { set: () => res, status: (c: number) => { code = c; return res; }, json: (b: any) => { out = b; return res; } };
    await routes[`${m} ${path}`]({ user: { id: user }, body, query }, res);
    return { code, out };
  };
  return { call, tick: (ms: number) => { clock += ms; } };
}

test("teachers give points to students at their own school; the board ranks them", async () => {
  const { call } = setup();
  const g = await call("POST", "/api/scholar/give", 1, { studentIds: [11, 12, 13], category: "work" });
  assert.equal(g.code, 200);
  assert.deepEqual(g.out.given.map((x: any) => x.studentId), [11, 12]);
  assert.deepEqual(g.out.skipped, [13], "a student at another school is skipped");
  await call("POST", "/api/scholar/give", 1, { studentIds: [11], category: "focused" });
  const b = await call("GET", "/api/scholar/board", 12, {}, { period: "week" });
  assert.equal(b.out.rows[0].name, "Mateo R.");
  assert.equal(b.out.rows[0].points, 2);
  assert.equal(b.out.rows[0].studentId, 0, "students don't see other students' ids");
  assert.equal(b.out.me.points, 1);
  assert.equal(b.out.me.rank, 2);
});

test("students can't give points, and nobody gives the same kind too many times a day", async () => {
  const { call } = setup();
  assert.equal((await call("POST", "/api/scholar/give", 11, { studentIds: [12], category: "work" })).code, 403);
  assert.equal((await call("POST", "/api/scholar/give", 1, { studentIds: [12], category: "behavior" })).code, 400);
  for (let i = 0; i < 5; i++) assert.equal((await call("POST", "/api/scholar/give", 1, { studentIds: [12], category: "participation" })).out.given.length, 1);
  assert.deepEqual((await call("POST", "/api/scholar/give", 1, { studentIds: [12], category: "participation" })).out.skipped, [12]);
});

test("a teacher can take back only their own tap, within a day", async () => {
  const { call, tick } = setup();
  const id = (await call("POST", "/api/scholar/give", 1, { studentIds: [11], category: "work" })).out.given[0].id;
  assert.equal((await call("POST", "/api/scholar/undo", 2, { id })).code, 404);
  const id2 = (await call("POST", "/api/scholar/give", 1, { studentIds: [11], category: "work" })).out.given[0].id;
  assert.equal((await call("POST", "/api/scholar/undo", 1, { id })).code, 200);
  tick(25 * 3_600_000);
  assert.equal((await call("POST", "/api/scholar/undo", 1, { id: id2 })).code, 400);
});

test("this week starts Monday and the school year August 1, in school time", () => {
  const thu = Date.parse("2026-11-12T17:00:00Z");
  assert.equal(schoolDay(thu), "2026-11-12");
  assert.equal(periodStartDay("week", thu), "2026-11-09");
  assert.equal(periodStartDay("month", thu), "2026-11-01");
  assert.equal(periodStartDay("year", thu), "2026-08-01");
  assert.equal(periodStartDay("year", Date.parse("2027-03-02T17:00:00Z")), "2026-08-01");
  assert.equal(periodStartDay("week", Date.parse("2026-11-09T05:00:00Z")), "2026-11-02", "Sunday night in Denver is still last week");
});

test("the board: first name and last initial, ties share a rank", () => {
  assert.equal(boardName("Mateo  Ramirez Soto"), "Mateo S.");
  const ev = (s: number, c = "work") => ({ id: String(Math.random()), teacher_id: 1, student_id: s, school_id: 5, category: c, points: 1, created_at: "" });
  const rows = buildBoard([ev(1), ev(2), ev(3), ev(3)], new Map([[1, "A One"], [2, "B Two"], [3, "C Three"]]));
  assert.deepEqual(rows.map((r) => [r.name, r.rank]), [["C T.", 1], ["A O.", 2], ["B T.", 2]]);
});

test("the AriseScholar page is its own entry, served at /scholar/", () => {
  assert.match(readFileSync("vite.config.ts", "utf8"), /scholar: path\.resolve\(import\.meta\.dirname, "client", "scholar", "index\.html"\)/);
  assert.match(readFileSync("client/scholar/index.html", "utf8"), /src\/scholar\/main\.tsx/);
  assert.match(readFileSync("server/routes.ts", "utf8"), /registerScholarRoutes\(app, authMiddleware/);
});
