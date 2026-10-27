// Run with: npx tsx --test tests/connect-admin-invite.test.ts
// An admin adds students to A.R.I.S.E. Connect, picks their career path, and the student is told in
// their A.R.I.S.E. Reader bell; tapping it opens Connect (same sign-in) on that path.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryInviteStore, createMemorySocialStore, registerAriseSocialRoutes, type SocialUser } from "../server/ariseSocial";
import { LEARNING_PATHS } from "../shared/connectCourses";
import { CONNECT_INVITE_TYPE, CONNECT_INVITE_URL, describeStoredType } from "../shared/notifications";

const people: Record<number, SocialUser & { grade?: string; isAdmin?: boolean }> = {
  1: { id: 1, role: "teacher", displayName: "Ms. Rivera", teacherId: null, schoolId: 10, approvedByTeacher: true, archived: false },
  9: { id: 9, role: "admin", displayName: "Admin", teacherId: null, schoolId: null, approvedByTeacher: true, archived: false, isAdmin: true },
  11: { id: 11, role: "student", displayName: "Jaylen Williams", teacherId: 1, schoolId: 10, approvedByTeacher: true, archived: false, grade: "7" },
  12: { id: 12, role: "student", displayName: "Rosa Diaz", teacherId: null, schoolId: null, approvedByTeacher: true, archived: false, grade: "10" },
  13: { id: 13, role: "student", displayName: "Gone Kid", teacherId: null, schoolId: null, approvedByTeacher: true, archived: true, grade: "9" },
};

function setup() {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  const bell: { id: number; type: string; title: string; message: string }[] = [];
  const push: { id: number; url?: string }[] = [];
  registerAriseSocialRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    store: createMemorySocialStore(), invites: createMemoryInviteStore(),
    approvals: { get: async () => null, save: async () => {} },
    // Nobody has paid: an added student still gets in.
    access: { self: async () => false, user: async () => false },
    directory: {
      user: async (id) => people[id] ?? null,
      gradeOf: async (id) => people[id]?.grade ?? null,
      studentsOf: async () => [],
      childrenOf: async () => [],
      parentsOf: async () => [],
      notify: async (id, m) => { push.push({ id, url: m.url }); },
      allStudents: async () => Object.values(people).filter((p) => p.role === "student").map((p) => ({ ...p, username: p.displayName.split(" ")[0].toLowerCase(), teacherName: p.teacherId ? "Ms. Rivera" : null })),
      bell: async (id, n) => { bell.push({ id, ...n }); },
    },
  });
  const as = (userId: number, extra: any = {}) => async (key: string, req: any = {}) => {
    let code = 200; let body: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { body = d; return res; } };
    const u = people[userId];
    await routes[key]({ body: {}, params: {}, headers: {}, ...req, ...extra, user: { id: u.id, displayName: u.displayName, role: u.role === "admin" ? "teacher" : u.role, isAdmin: !!u.isAdmin, teacherId: u.teacherId, school_id: u.schoolId, approvedByTeacher: u.approvedByTeacher } }, res);
    return { code, body };
  };
  return { as, bell, push };
}

test("only a real admin can list and add students", async () => {
  const t = setup();
  assert.equal((await t.as(1)("GET /api/social/admin/students")).code, 403);
  assert.equal((await t.as(11)("POST /api/social/admin/invite", { body: { studentIds: [11] } })).code, 403);
  assert.equal((await t.as(9, { adminPreview: true })("GET /api/social/admin/students")).code, 403, "an admin previewing as a student is not an admin here");
  const list = await t.as(9)("GET /api/social/admin/students");
  assert.equal(list.code, 200);
  assert.deepEqual(list.body.students.map((s: any) => s.id).sort(), [11, 12], "archived students are left out");
  assert.ok(list.body.paths.some((p: any) => p.id === "lawyer"), "the new career paths can be picked");
});

test("an added student gets a bell notification that opens Connect, gets in without a teacher or a plan, and lands on the picked path", async () => {
  const t = setup();
  const rosa = t.as(12);
  const before = await rosa("GET /api/social/me");
  assert.notEqual(before.body.approvalStatus, "approved");
  assert.equal(before.body.access, false);

  const path = LEARNING_PATHS.find((p) => p.id === "doctor")!;
  const r = await t.as(9)("POST /api/social/admin/invite", { body: { studentIds: [12, 13, 999], pathId: "doctor" } });
  assert.equal(r.code, 200);
  assert.equal(r.body.added, 1);
  assert.deepEqual(r.body.skipped.sort(), [13, 999]);
  assert.equal(t.bell.length, 1);
  assert.equal(t.bell[0].id, 12);
  assert.equal(t.bell[0].type, CONNECT_INVITE_TYPE);
  assert.match(t.bell[0].message, new RegExp(path.title));
  assert.equal(t.push[0].url, CONNECT_INVITE_URL);
  // The bell item opens Connect.
  assert.deepEqual(describeStoredType(t.bell[0].type).target, { type: "connect", id: 1 });

  const me = await rosa("GET /api/social/me");
  assert.equal(me.body.approvalStatus, "approved");
  assert.equal(me.body.access, true);
  assert.equal(me.body.addedByAdmin, true);
  assert.deepEqual(me.body.assignedPath, { id: "doctor", title: path.title });
  // Paid, approval-gated routes work for her now.
  const c = path.courses[0];
  assert.equal((await rosa("POST /api/social/collect", { body: { careerId: "doctor" } })).code, 200);
  assert.ok(c);
  // She has no class, so she still can't post: posts always go to a student's own teacher first.
  assert.equal(me.body.user.canPost, false);
});

test("an admin can change a student's path (the student is told) and remove them", async () => {
  const t = setup();
  await t.as(9)("POST /api/social/admin/invite", { body: { studentIds: [11] } });
  assert.equal((await t.as(11)("GET /api/social/me")).body.assignedPath, null, "no path: they pick their own");
  await t.as(9)("POST /api/social/admin/invite", { body: { studentIds: [11], pathId: "mechanic" } });
  assert.equal(t.bell.length, 2);
  assert.match(t.bell[1].title, /changed/);
  assert.equal((await t.as(11)("GET /api/social/me")).body.assignedPath.id, "mechanic");
  assert.equal((await t.as(9)("POST /api/social/admin/invite", { body: { studentIds: [11], pathId: "nope" } })).code, 400);

  const list = await t.as(9)("GET /api/social/admin/students");
  assert.equal(list.body.students[0].id, 11, "added students are listed first");
  assert.equal(list.body.students[0].pathId, "mechanic");

  assert.equal((await t.as(9)("DELETE /api/social/admin/invite/:id", { params: { id: "11" } })).code, 200);
  assert.notEqual((await t.as(11)("GET /api/social/me")).body.approvalStatus, "approved", "back to needing their teacher");
});

test("the Connect page has the admin's Add students screen and the student's path banner; the bell opens Connect", () => {
  const page = readFileSync(new URL("../client/public/social/index.html", import.meta.url), "utf8");
  assert.match(page, /\['students','Add students','class'\]/);
  assert.match(page, /function viewAdminStudents\(\)/);
  assert.match(page, /api\('\/admin\/invite'/);
  assert.match(page, /function myPathHTML\(\)/);
  assert.match(page, /S\.lpath = ME\.assignedPath\.id/);
  const bell = readFileSync(new URL("../client/src/components/NotificationBell.tsx", import.meta.url), "utf8");
  assert.match(bell, /item\.target\?\.type === "connect"/);
  assert.match(bell, /window\.location\.assign\(CONNECT_INVITE_URL\)/);
});
