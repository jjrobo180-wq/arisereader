// Class records (shared/classRecords.ts, server/classRecords.ts): Behavior, Hall passes, Attendance,
// Gradebook and the Student wall, and what families (signed in or by private link), staff and admins see.
// Run with: npx tsx --test tests/class-records.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceSummary, assignmentAverage, cleanAudience, cleanMark, cleanScore, cleanShare, defaultShare, emptyGradebook, letterFor, seesPost, studentGrade, unreadFor,
  type Gradebook,
} from "../shared/classRecords";
import { registerClassRecordsRoutes, type RUser } from "../server/classRecords";
import { createMemoryKv } from "../server/fitKv";
import { createMemoryBehaviorStore } from "../server/classBehavior";

/* ---------------------------------------------------------------- rules */

test("sharing: families see nothing until the teacher turns it on; staff see it unless turned off", () => {
  const d = defaultShare();
  assert.ok(Object.values(d.parents).every((v) => v === false));
  assert.ok(Object.values(d.staff).every((v) => v === true));
  assert.deepEqual(cleanShare({ parents: { grades: true, wall: "yes" }, staff: { behavior: false } }).parents, { behavior: false, passes: false, attendance: false, grades: true, wall: false });
  assert.equal(cleanShare(null).staff.behavior, true);
});

test("attendance: marks are cleaned and the rate leaves out excused days", () => {
  assert.deepEqual(cleanMark({ status: "tardy", minutesLate: "7", note: "  bus  " }), { status: "tardy", note: "bus", minutesLate: 7 });
  assert.equal(cleanMark({ status: "late" }), null);
  assert.deepEqual(cleanMark({ status: "present", minutesLate: 5 }), { status: "present" });
  const s = attendanceSummary([{ "2026-11-02": { 1: { status: "present" }, 2: { status: "absent" } }, "2026-11-03": { 1: { status: "tardy" }, 2: { status: "excused" } }, "2026-11-04": { 1: { status: "absent" } } }], [1, 2, 3]);
  assert.deepEqual([s[1].present, s[1].tardy, s[1].absent, s[1].rate], [1, 1, 1, 66.7]);
  assert.deepEqual([s[2].rate, s[2].excused], [0, 1]);
  assert.equal(s[3].rate, null, "no marks: no rate");
  assert.deepEqual(s[1].last.map((x) => x.day), ["2026-11-04", "2026-11-03"]);
});

test("gradebook: weighted categories, missing counts as zero, excused and unpublished don't count", () => {
  const b: Gradebook = { ...emptyGradebook(), assignments: [
    { id: "a", title: "Worksheet", categoryId: "classwork", points: 10, due: "2026-11-02", published: true, createdAt: "" },
    { id: "b", title: "Reading log", categoryId: "homework", points: 20, due: "2026-11-03", published: true, createdAt: "" },
    { id: "c", title: "Unit test", categoryId: "tests", points: 50, due: "2026-11-05", published: true, createdAt: "" },
    { id: "d", title: "Draft quiz", categoryId: "tests", points: 10, due: "", published: false, createdAt: "" },
  ], scores: { a: { 1: { score: 9 } }, b: { 1: { missing: true } }, c: { 1: { score: 40 } }, d: { 1: { score: 0 } } } };
  const all = studentGrade(b, 1);
  // classwork 90 (w40), homework 0 (w20), tests (40+0)/60 = 66.7 (w40) → (3600 + 0 + 2666.7)/100 = 62.7
  assert.equal(all.percent, 62.7);
  const pub = studentGrade(b, 1, { publishedOnly: true });
  // tests 80 → (3600 + 0 + 3200)/100 = 68
  assert.equal(pub.percent, 68);
  assert.equal(pub.letter, "D");
  assert.deepEqual(pub.missing.map((a) => a.id), ["b"]);
  b.scores.b[1] = { excused: true };
  assert.equal(studentGrade(b, 1, { publishedOnly: true }).percent, 85, "excused leaves homework out: (90×40 + 80×40)/80");
  assert.equal(studentGrade(b, 2).percent, null, "nothing scored");
  assert.equal(assignmentAverage(b, "a"), 90);
  assert.equal(letterFor(89.9), "B");
  assert.deepEqual(cleanScore({ score: "12", missing: true }, 10), { score: 12 }, "a score turned in is no longer missing");
  assert.deepEqual(cleanScore({ excused: true, missing: true }, 10), { excused: true });
  assert.equal(cleanScore({}, 10), null);
});

test("wall: a post is for the whole class or chosen students (only the teacher's own)", () => {
  assert.deepEqual(cleanAudience({ kind: "students", ids: [1, 9, 1] }, [1, 2]), { kind: "students", ids: [1] });
  assert.equal(cleanAudience({ kind: "students", ids: [9] }, [1, 2]), null);
  assert.ok(seesPost({ audience: { kind: "class" } }, 5));
  assert.ok(!seesPost({ audience: { kind: "students", ids: [1] } }, 2));
  assert.equal(unreadFor({ studentId: 1, teacherId: 2, teacherRead: "2026-11-02", familyRead: "", messages: [
    { id: "1", from: "family", authorId: 9, authorName: "Mom", body: "hi", at: "2026-11-03" }, { id: "2", from: "teacher", authorId: 2, authorName: "T", body: "hey", at: "2026-11-04" }] }, "teacher"), 1);
});

/* ---------------------------------------------------------------- the server */

const users: Record<number, RUser> = {
  10: { id: 10, role: "teacher", displayName: "Ms. Rivera", teacherId: null, schoolId: 1, approvedByTeacher: true, archived: false },
  11: { id: 11, role: "teacher", displayName: "Mr. Chen", teacherId: null, schoolId: 1, approvedByTeacher: true, archived: false },
  12: { id: 12, role: "teacher", displayName: "Other School", teacherId: null, schoolId: 2, approvedByTeacher: true, archived: false },
  13: { id: 13, role: "admin", displayName: "Principal", teacherId: null, schoolId: 1, approvedByTeacher: true, archived: false },
  1: { id: 1, role: "student", displayName: "Maya Lopez", teacherId: 10, schoolId: 1, approvedByTeacher: true, archived: false },
  2: { id: 2, role: "student", displayName: "Leo Park", teacherId: 10, schoolId: 1, approvedByTeacher: true, archived: false },
  3: { id: 3, role: "student", displayName: "Zoe Kim", teacherId: 11, schoolId: 1, approvedByTeacher: true, archived: false },
  20: { id: 20, role: "parent", displayName: "Ana Lopez", teacherId: null, schoolId: null, approvedByTeacher: true, archived: false },
  21: { id: 21, role: "parent", displayName: "Other Parent", teacherId: null, schoolId: null, approvedByTeacher: true, archived: false },
};

function server(now = Date.parse("2026-11-23T17:00:00Z")) {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (p: string, ...h: Function[]) => { routes[`${m} ${p}`] = h[h.length - 1]; routes[`${m} ${p}:mw`] = h[h.length - 2]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  const notes: Array<{ to: number; title: string }> = [];
  const files = new Map<string, { data: Buffer; type: string }>();
  const behavior = createMemoryBehaviorStore();
  let n = 0;
  registerClassRecordsRoutes(app, (req: any, _res: any, next: any) => { if (!req.user) throw Object.assign(new Error("no"), { code: 401 }); next(); }, {
    directory: {
      user: async (id) => users[id] ?? null,
      studentsOf: async (t) => Object.values(users).filter((u) => u.role === "student" && u.teacherId === t),
      childrenOf: async (p) => (p === 20 ? [1] : p === 21 ? [3] : []),
      parentsOf: async (s) => (s === 1 ? [20] : s === 3 ? [21] : []),
      staffOf: async (sc) => Object.values(users).filter((u) => (u.role === "teacher" || u.role === "admin") && u.schoolId === sc),
      notify: async (to, m) => { notes.push({ to, title: m.title }); },
    },
    kv: createMemoryKv(),
    files: { async put(p, data, type) { files.set(p, { data, type }); }, async get(p) { return files.get(p) ?? null; }, async del(ps) { for (const p of ps) files.delete(p); } },
    behavior, now: () => (now += 1000), token: () => `tok${String(++n).padStart(45, "x")}`,
  });
  async function call(method: string, path: string, opts: { as?: number; body?: any; query?: any; headers?: any } = {}) {
    const key = Object.keys(routes).find((k) => {
      if (k.endsWith(":mw")) return false;
      const [m, p] = k.split(" ");
      return m === method && new RegExp(`^${p.replace(/:[a-z]+/g, "[^/]+")}$`).test(path);
    });
    if (!key) throw new Error(`no route ${method} ${path}`);
    const pattern = key.split(" ")[1];
    const names = [...pattern.matchAll(/:([a-z]+)/g)].map((m) => m[1]);
    const vals = new RegExp(`^${pattern.replace(/:[a-z]+/g, "([^/]+)")}$`).exec(path)!.slice(1);
    const req: any = { params: Object.fromEntries(names.map((x, i) => [x, vals[i]])), query: opts.query ?? {}, body: opts.body ?? {}, headers: opts.headers ?? {}, user: opts.as ? { id: opts.as } : undefined };
    let status = 200, body: any, sent: any;
    const res: any = { status(s: number) { status = s; return res; }, json(b: any) { body = b; return res; }, setHeader() {}, end(d: any) { sent = d; } };
    const mw = routes[`${key}:mw`];
    try { await new Promise<void>((resolve) => { mw(req, res, () => resolve()); }); }
    catch (e: any) { return { status: 401, body: { message: "Sign in again." } }; }
    await routes[key](req, res);
    return { status, body, sent };
  }
  return { call, notes, files, behavior };
}

test("a teacher works only with their own students; families see nothing until shared", async () => {
  const s = server();
  assert.equal((await s.call("PUT", "/api/records/attendance", { as: 1, body: { day: "2026-11-23", marks: {} } })).status, 403, "students can't");
  await s.call("PUT", "/api/records/attendance", { as: 10, body: { day: "2026-11-23", marks: { 1: { status: "absent" }, 2: { status: "present" }, 3: { status: "absent" } } } });
  const att = await s.call("GET", "/api/records/attendance", { as: 10, query: { day: "2026-11-23" } });
  assert.deepEqual(Object.keys(att.body.marks).sort(), ["1", "2"], "Zoe isn't Ms. Rivera's student");
  assert.equal(s.notes.length, 0, "families aren't told while attendance isn't shared");
  const fam = await s.call("GET", "/api/family/child/1", { as: 20 });
  assert.equal(fam.body.teachers[0].shown.attendance, false);
  assert.equal(fam.body.teachers[0].attendance, undefined);
  assert.equal((await s.call("GET", "/api/family/child/3", { as: 20 })).status, 404, "not her child");
});

test("shared with families: attendance, published grades, the wall and messages", async () => {
  const s = server();
  await s.call("PUT", "/api/records/share", { as: 10, body: { parents: { attendance: true, grades: true, wall: true, behavior: true, passes: true } } });
  await s.call("PUT", "/api/records/attendance", { as: 10, body: { day: "2026-11-23", marks: { 1: { status: "absent" } } } });
  assert.deepEqual(s.notes.map((x) => [x.to, x.title]), [[20, "Maya: absent today"]]);
  const a1 = (await s.call("POST", "/api/records/grades/assignments", { as: 10, body: { title: "Essay", points: 20, categoryId: "classwork" } })).body.assignment;
  await s.call("POST", "/api/records/grades/assignments", { as: 10, body: { title: "Secret draft", points: 10, published: false } });
  await s.call("PUT", "/api/records/grades/scores", { as: 10, body: { assignmentId: a1.id, scores: { 1: { score: 18, comment: "Great voice" }, 3: { score: 1 } } } });
  await s.call("POST", "/api/records/wall", { as: 10, body: { kind: "announcement", title: "Field trip Friday", body: "Bring a lunch.", audience: { kind: "class" } } });
  await s.call("POST", "/api/records/wall", { as: 10, body: { kind: "post", body: "Leo read 3 books!", audience: { kind: "students", ids: [2] } } });
  const v = (await s.call("GET", "/api/family/child/1", { as: 20 })).body;
  const t = v.teachers.find((x: any) => x.teacher.id === 10);
  assert.equal(t.attendance.absent, 1);
  assert.equal(t.grades.percent, 90);
  assert.deepEqual(t.grades.work.map((w: any) => [w.title, w.score, w.comment]), [["Essay", 18, "Great voice"]], "the unpublished draft stays hidden");
  assert.deepEqual(t.wall.map((p: any) => p.title || p.body), ["Field trip Friday"], "Leo's post isn't Maya's");
  assert.equal(t.wall[0].audience, undefined, "families don't see who else a post went to");
  // Messages both ways.
  const sent = await s.call("POST", "/api/family/child/1/messages/10", { as: 20, body: { body: "Maya was sick today." } });
  assert.equal(sent.body.messages[0].authorName, "Ana Lopez (Maya's family)");
  const wall = (await s.call("GET", "/api/records/wall", { as: 10 })).body;
  assert.deepEqual(wall.inbox.map((i: any) => [i.studentId, i.unread]), [[1, 1]]);
  await s.call("POST", "/api/records/messages/1", { as: 10, body: { body: "Thanks, feel better!" } });
  assert.ok(s.notes.some((x) => x.to === 20 && x.title === "Message from Ms. Rivera"));
  const after = (await s.call("GET", "/api/family/child/1", { as: 20 })).body.teachers[0];
  assert.equal(after.messages.unread, 1);
  assert.equal((await s.call("POST", "/api/family/child/1/messages/11", { as: 20, body: { body: "hi" } })).status, 404, "not Maya's teacher");
});

test("the private family link: no sign-in, sees what a parent sees, and can be turned off", async () => {
  const s = server();
  await s.call("PUT", "/api/records/share", { as: 10, body: { parents: { grades: true, wall: true } } });
  const made = (await s.call("POST", "/api/records/links/1", { as: 10 })).body;
  assert.match(made.token, /^[A-Za-z0-9_-]{40,64}$/);
  assert.equal((await s.call("POST", "/api/records/links/3", { as: 10 })).status, 404, "only for your own students");
  const h = { "x-family-link": made.token };
  const kids = await s.call("GET", "/api/family/children", { headers: h });
  assert.deepEqual(kids.body, { children: [{ id: 1, name: "Maya Lopez", first: "Maya" }], viaLink: true });
  const v = await s.call("GET", "/api/family/child/0", { headers: h });
  assert.equal(v.body.child.first, "Maya");
  assert.equal(v.body.teachers[0].shown.grades, true);
  assert.equal((await s.call("POST", "/api/family/child/0/messages/10", { headers: h, body: { body: "hello" } })).status, 400, "a name is needed without an account");
  const m = await s.call("POST", "/api/family/child/0/messages/10", { headers: h, body: { body: "hello", name: "Grandma Rosa" } });
  assert.equal(m.body.messages[0].authorName, "Grandma Rosa (Maya's family)");
  // A new link turns the old one off; turning it off ends it.
  const again = (await s.call("POST", "/api/records/links/1", { as: 10 })).body;
  assert.equal((await s.call("GET", "/api/family/child/0", { headers: h })).status, 404);
  assert.equal((await s.call("GET", "/api/family/child/0", { headers: { "x-family-link": again.token } })).status, 200);
  await s.call("DELETE", "/api/records/links/1", { as: 10 });
  assert.equal((await s.call("GET", "/api/family/child/0", { headers: { "x-family-link": again.token } })).status, 404);
  assert.equal((await s.call("GET", "/api/family/child/0", { headers: { "x-family-link": "short" } })).status, 404);
  assert.equal((await s.call("GET", "/api/family/children")).status, 401, "no link and no sign-in");
});

test("staff see what's shared with staff at their school; admins see everything and the school overview", async () => {
  const s = server();
  await s.call("PUT", "/api/records/share", { as: 10, body: { staff: { grades: false } } });
  const a = (await s.call("POST", "/api/records/grades/assignments", { as: 10, body: { title: "Quiz", points: 10 } })).body.assignment;
  await s.call("PUT", "/api/records/grades/scores", { as: 10, body: { assignmentId: a.id, scores: { 1: { missing: true } } } });
  await s.call("PUT", "/api/records/attendance", { as: 10, body: { day: "2026-11-23", marks: { 1: { status: "tardy", minutesLate: 5 }, 2: { status: "present" } } } });
  const staff = (await s.call("GET", "/api/records/student/1", { as: 11 })).body;
  assert.equal(staff.teachers[0].shown.grades, false);
  assert.equal(staff.teachers[0].attendance.tardy, 1);
  assert.equal(staff.teachers[0].messages, undefined, "family messages stay private from other staff");
  assert.equal((await s.call("GET", "/api/records/student/1", { as: 12 })).status, 404, "another school");
  const admin = (await s.call("GET", "/api/records/student/1", { as: 13 })).body;
  assert.equal(admin.teachers[0].grades.missing.length, 1);
  const o = (await s.call("GET", "/api/records/admin/overview", { as: 13 })).body;
  assert.deepEqual(o.teachers.map((t: any) => [t.teacher.name, t.students, t.missing, t.attendanceRate]), [["Mr. Chen", 1, 0, null], ["Ms. Rivera", 2, 1, 100]]);
  assert.equal((await s.call("GET", "/api/records/admin/overview", { as: 10 })).status, 403);
});

test("wall photos: only people who may see the post get the picture", async () => {
  const s = server();
  await s.call("PUT", "/api/records/share", { as: 10, body: { parents: { wall: true } } });
  const up = await s.call("POST", "/api/records/photos", { as: 10, body: Buffer.from("jpgdata"), headers: { "content-type": "image/jpeg" } });
  const photo = up.body.photo;
  assert.match(photo, /^[0-9a-f-]{36}\.jpg$/);
  assert.equal((await s.call("POST", "/api/records/photos", { as: 10, body: Buffer.from("x"), headers: { "content-type": "text/html" } })).status, 400);
  await s.call("POST", "/api/records/wall", { as: 10, body: { kind: "post", body: "Science fair!", audience: { kind: "students", ids: [1] }, photos: [photo] } });
  assert.equal((await s.call("GET", `/api/records/photo/10/${photo}`, { as: 20 })).status, 200, "Maya's parent");
  assert.equal((await s.call("GET", `/api/records/photo/10/${photo}`, { as: 21 })).status, 404, "another family");
  assert.equal((await s.call("GET", `/api/records/photo/10/${photo}`, { as: 13 })).status, 200, "the admin");
  const posts = (await s.call("GET", "/api/records/wall", { as: 10 })).body.posts;
  await s.call("DELETE", `/api/records/wall/${posts[0].id}`, { as: 10 });
  assert.equal(s.files.size, 0, "deleting the post deletes its photos");
});

test("behavior points and hall passes reach families only when shared, and only notes marked to share", async () => {
  const s = server();
  await s.behavior.addEvents([
    { id: "e1", teacher_id: 10, student_id: 1, points: 2, label: "Helping others", note: "", share: true, created_at: "2026-11-23T15:00:00Z" },
    { id: "e2", teacher_id: 10, student_id: 1, points: -1, label: "Off task", note: "private", share: false, created_at: "2026-11-23T15:10:00Z" },
  ]);
  await s.behavior.addPass({ id: "p1", teacher_id: 10, student_id: 1, place: "Restroom", status: "back", limit_min: 5, asked_at: "2026-11-23T15:00:00Z", out_at: "2026-11-23T15:00:00Z", back_at: "2026-11-23T15:04:00Z" });
  let v = (await s.call("GET", "/api/family/child/1", { as: 20 })).body;
  assert.equal(v.behavior, null); assert.equal(v.passes, null);
  await s.call("PUT", "/api/records/share", { as: 10, body: { parents: { behavior: true, passes: true } } });
  v = (await s.call("GET", "/api/family/child/1", { as: 20 })).body;
  assert.deepEqual(v.behavior.recent.map((e: any) => e.label), ["Helping others"]);
  assert.deepEqual(v.passes.map((p: any) => [p.place, p.status]), [["Restroom", "back"]]);
  const staff = (await s.call("GET", "/api/records/student/1", { as: 11 })).body;
  assert.equal(staff.behavior.recent.length, 2, "staff see every point, not only the shared notes");
});

test("staff can look up any student at their school (and only their school)", async () => {
  const s = server();
  const r = (await s.call("GET", "/api/records/school/students", { as: 11 })).body;
  assert.deepEqual(r.students.map((x: any) => [x.name, x.teachers]), [["Leo Park", ["Ms. Rivera"]], ["Maya Lopez", ["Ms. Rivera"]], ["Zoe Kim", ["Mr. Chen"]]]);
  assert.deepEqual((await s.call("GET", "/api/records/school/students", { as: 12 })).body.students, []);
  assert.equal((await s.call("GET", "/api/records/school/students", { as: 20 })).status, 403, "not for families");
});
