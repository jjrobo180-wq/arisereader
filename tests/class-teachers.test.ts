// Students' Advisory and Literature teachers: the sign-in pop-up's rules and the school's list.
// Run with: npx tsx --test tests/class-teachers.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  ClassTeachersError, buildRoster, checkTypedName, exactTeacher, groupBy, listsTeacher, resolveClassTeachers,
  rosterCsv, schoolYearOf, suggestTeachers, type PickRow, type SchoolTeacher,
} from "../shared/classTeachers";
import { registerClassTeacherRoutes } from "../server/classTeachers";

const TEACHERS: SchoolTeacher[] = [
  { id: 10, displayName: "Ms. Maria Garcia" },
  { id: 11, displayName: "Mr. Jordan Lee" },
  { id: 12, displayName: "Mrs. Lee-Hart" },
  { id: 13, displayName: "Dr. Sam Okafor" },
];

test("the school year turns over on July 1 in Denver, not in London", () => {
  assert.equal(schoolYearOf(new Date("2026-10-13T16:00:00Z")), "2026-27");
  assert.equal(schoolYearOf(new Date("2027-06-30T12:00:00Z")), "2026-27");
  assert.equal(schoolYearOf(new Date("2027-07-01T12:00:00Z")), "2027-28");
  // 11pm June 30 in Denver is already July 1 in UTC: still last year at the school
  assert.equal(schoolYearOf(new Date("2027-07-01T05:00:00Z")), "2026-27");
  assert.equal(schoolYearOf(new Date("2099-08-01T12:00:00Z")), "2099-00");
});

test("typing part of a name finds the teacher, ignoring titles and case", () => {
  assert.deepEqual(suggestTeachers("gar", TEACHERS).map((t) => t.id), [10]);
  assert.deepEqual(suggestTeachers("ms garcia", TEACHERS).map((t) => t.id), [10]);
  assert.deepEqual(suggestTeachers("maria g", TEACHERS).map((t) => t.id), [10]);
  assert.deepEqual(suggestTeachers("LEE", TEACHERS).map((t) => t.id).sort(), [11, 12]);
  assert.deepEqual(suggestTeachers("hart", TEACHERS).map((t) => t.id), [12]);
  assert.deepEqual(suggestTeachers("mr", TEACHERS), []); // a title alone matches no one
  assert.deepEqual(suggestTeachers("zzz", TEACHERS), []);
  assert.deepEqual(suggestTeachers("", TEACHERS), []);
});

test("a typed name that means exactly one teacher is linked to them", () => {
  assert.equal(exactTeacher("garcia", TEACHERS), null); // not the whole name
  assert.equal(exactTeacher("maria garcia", TEACHERS)?.id, 10);
  assert.equal(exactTeacher("Ms.  Maria   GARCIA", TEACHERS)?.id, 10);
  assert.equal(exactTeacher("Sam Okafor", TEACHERS)?.id, 13);
  const twins = [...TEACHERS, { id: 20, displayName: "Mrs. Maria Garcia" }];
  assert.equal(exactTeacher("maria garcia", twins), null); // two people: do not guess
});

test("typed names are tidied and checked", () => {
  assert.equal(checkTypedName("  Ms.   O’Brien ", "advisory"), "Ms. O'Brien");
  assert.equal(checkTypedName("José Núñez", "lit"), "José Núñez");
  for (const bad of ["", " ", "x", "Ms. 5", "<b>Lee</b>", "https://x.com", "a".repeat(61), 42, null]) {
    assert.throws(() => checkTypedName(bad, "lit"), ClassTeachersError, String(bad));
  }
});

test("a picked teacher must be at the student's school; a typed one is kept as typed", () => {
  const both = resolveClassTeachers({ advisory: { teacherId: 11 }, lit: { name: "Mr. Patel" } }, TEACHERS);
  assert.deepEqual(both, { advisory: { teacherId: 11, name: "Mr. Jordan Lee" }, lit: { teacherId: null, name: "Mr. Patel" } });
  const linked = resolveClassTeachers({ advisory: { name: "jordan lee" }, lit: { name: "Dr Sam Okafor" } }, TEACHERS);
  assert.deepEqual([linked.advisory.teacherId, linked.lit.teacherId], [11, 13]);
  assert.throws(() => resolveClassTeachers({ advisory: { teacherId: 99 }, lit: { teacherId: 10 } }, TEACHERS), /isn't at your school/);
  assert.throws(() => resolveClassTeachers({ advisory: { teacherId: "10; drop" }, lit: { teacherId: 10 } }, TEACHERS), /isn't at your school/);
  assert.throws(() => resolveClassTeachers({ advisory: { teacherId: 10 } }, TEACHERS), /ELA/);
  assert.throws(() => resolveClassTeachers(null, TEACHERS), /Advisory/);
});

const pick = (student: number, adv: [number | null, string], lit: [number | null, string], extra: Partial<PickRow> = {}): PickRow => ({
  student_id: student, school_year: "2026-27", school_id: 4,
  advisory_teacher_id: adv[0], advisory_teacher_name: adv[1], lit_teacher_id: lit[0], lit_teacher_name: lit[1], updated_at: "2026-10-13T16:00:00Z", ...extra,
});
const STUDENTS = [
  { id: 1, displayName: "Zoe Adams", username: "zadams" },
  { id: 2, displayName: "ava brown", username: "abrown" },
  { id: 3, displayName: "", username: "noname" },
  { id: 4, displayName: "Ben Cruz", username: "bcruz" },
];

test("the list has every student at the school, answered or not, in name order", () => {
  const roster = buildRoster(STUDENTS, [
    pick(1, [10, "Ms. Maria Garcia"], [null, "Mr. Patel"]),
    pick(2, [99, "Mr. Gone"], [11, "old name"]), // 99 left the school; 11 was renamed
    pick(4, [10, "x"], [10, "x"], { school_year: "2025-26" }), // last year: asked again
    pick(3, [10, "x"], [10, "x"], { school_id: 8 }), // answered at another school
  ], TEACHERS, 4, "2026-27");
  assert.deepEqual(roster.map((e) => e.name), ["ava brown", "Ben Cruz", "noname", "Zoe Adams"]);
  const ava = roster[0];
  assert.deepEqual(ava.advisory, { teacherId: null, name: "Mr. Gone", onSite: false });
  assert.deepEqual(ava.lit, { teacherId: 11, name: "Mr. Jordan Lee", onSite: true });
  assert.equal(roster.find((e) => e.studentId === 4)!.answered, false);
  assert.equal(roster.find((e) => e.studentId === 3)!.answered, false);
  assert.equal(roster.find((e) => e.studentId === 1)!.lit!.name, "Mr. Patel");
  assert.equal(listsTeacher(roster.find((e) => e.studentId === 1)!, 10), true);
  assert.equal(listsTeacher(ava, 10), false);
});

test("students group under one teacher however each one spelled the name", () => {
  const roster = buildRoster(STUDENTS, [
    pick(1, [null, "Mr. Patel"], [10, ""]),
    pick(2, [null, "mr patel"], [10, ""]),
    pick(4, [11, ""], [null, "Ms. Ruiz"]),
  ], TEACHERS, 4, "2026-27");
  const adv = groupBy(roster, "advisory");
  assert.deepEqual(adv.map((g) => [g.teacher, g.students.length]), [["Mr. Jordan Lee", 1], ["Mr. Patel", 2]]);
  const lit = groupBy(roster, "lit");
  assert.deepEqual(lit.map((g) => [g.teacher, g.onSite, g.students.map((s) => s.studentId)]), [["Ms. Maria Garcia", true, [2, 1]], ["Ms. Ruiz", false, [4]]]);
});

test("the CSV opens safely in a spreadsheet", () => {
  const roster = buildRoster([{ id: 1, displayName: "=HYPERLINK(\"x\")", username: "a,b" }], [pick(1, [null, "Ms. O'Neil"], [10, ""])], TEACHERS, 4, "2026-27");
  const csv = rosterCsv(roster);
  assert.equal(csv.split("\r\n")[0], "Student,Username,Advisory,ELA teacher");
  assert.equal(csv.split("\r\n")[1], `"'=HYPERLINK(""x"")","a,b",Ms. O'Neil,Ms. Maria Garcia`);
});

/* ---------------------------------------------------------------------- the routes ---- */

function setup(now = new Date("2026-10-13T16:00:00Z")) {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST") };
  const schools = [{ id: 4, name: "Conservatory Green Middle School (Denver, CO)" }, { id: 6, name: "Independent Reader" }, { id: 8, name: "Test (Denver, CO)" }];
  const picks: PickRow[] = [];
  const teachersAt: Record<number, SchoolTeacher[]> = { 4: TEACHERS, 8: [{ id: 30, displayName: "Ms. Other" }] };
  const studentsAt: Record<number, typeof STUDENTS> = { 4: STUDENTS, 8: [{ id: 50, displayName: "Other Kid", username: "ok" }] };
  registerClassTeacherRoutes(app, {
    auth: ((_q: any, _s: any, n: any) => n()) as any,
    now: () => now,
    getSchool: async (id) => schools.find((s) => s.id === id) || null,
    allSchools: async () => schools,
    schoolTeachers: async (id) => teachersAt[id] || [],
    schoolStudents: async (id) => studentsAt[id] || [],
    getPick: async (sid, y) => picks.find((p) => p.student_id === sid && p.school_year === y) || null,
    schoolPicks: async (id, y) => picks.filter((p) => p.school_id === id && p.school_year === y),
    savePick: async (row) => {
      const i = picks.findIndex((p) => p.student_id === row.student_id && p.school_year === row.school_year);
      const saved = { ...row, updated_at: now.toISOString() };
      if (i >= 0) picks[i] = saved; else picks.push(saved);
      return saved;
    },
  });
  const call = async (k: string, req: any = {}) => {
    let code = 200; let body: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { body = d; return res; } };
    await routes[k]({ body: {}, params: {}, query: {}, headers: {}, ...req }, res);
    return { code, body };
  };
  return { call, picks };
}
const student = (extra: any = {}) => ({ id: 1, username: "zadams", displayName: "Zoe Adams", role: "student", school_id: 4, ...extra });
const teacher = (extra: any = {}) => ({ id: 10, username: "garcia", displayName: "Ms. Maria Garcia", role: "teacher", school_id: 4, accountApproved: true, ...extra });

test("a student at a school is asked once a year, and can pick from their school's teachers", async () => {
  const t = setup();
  const first = await t.call("GET /api/student/class-teachers", { user: student() });
  assert.equal(first.body.needed, true);
  assert.equal(first.body.schoolYear, "2026-27");
  assert.deepEqual(first.body.teachers.map((x: any) => x.id), [10, 11, 12, 13]);
  const saved = await t.call("POST /api/student/class-teachers", { user: student(), body: { advisory: { teacherId: 12 }, lit: { name: "Mr. Patel" } } });
  assert.equal(saved.code, 200);
  assert.deepEqual(saved.body.current, { advisory: { teacherId: 12, name: "Mrs. Lee-Hart" }, lit: { teacherId: null, name: "Mr. Patel" } });
  assert.equal((await t.call("GET /api/student/class-teachers", { user: student() })).body.needed, false);
  // a change of mind replaces the ELA answer rather than adding a second one; the advisory, once
  // set, stays (it comes from the school's advisory list when accounts are uploaded)
  await t.call("POST /api/student/class-teachers", { user: student(), body: { advisory: { teacherId: 10 }, lit: { teacherId: 11 } } });
  assert.equal(t.picks.length, 1);
  assert.equal(t.picks[0].advisory_teacher_id, 12);
  assert.equal(t.picks[0].lit_teacher_id, 11);
  // the pop-up now sends only the ELA teacher
  const elaOnly = await t.call("POST /api/student/class-teachers", { user: student(), body: { lit: { teacherId: 13 } } });
  assert.equal(elaOnly.code, 200);
  assert.deepEqual([t.picks[0].advisory_teacher_id, t.picks[0].lit_teacher_id], [12, 13]);
  // moving to another school asks again
  assert.equal((await t.call("GET /api/student/class-teachers", { user: student({ school_id: 8 }) })).body.needed, true);
});

test("next school year the pop-up asks again", async () => {
  const t = setup();
  await t.call("POST /api/student/class-teachers", { user: student(), body: { advisory: { teacherId: 10 }, lit: { teacherId: 11 } } });
  const later = setup(new Date("2027-08-15T16:00:00Z"));
  later.picks.push(...t.picks);
  assert.equal((await later.call("GET /api/student/class-teachers", { user: student() })).body.needed, true);
});

test("teachers, parents, eye-gaze, samples, previews and students without a school are never asked", async () => {
  const t = setup();
  for (const user of [teacher(), student({ role: "parent" }), student({ is_eye_gaze_user: true }), student({ username: "sample2" }), student({ school_id: null }), student({ school_id: 6 }), student({ isAdmin: true })]) {
    assert.equal((await t.call("GET /api/student/class-teachers", { user })).body.needed, false, JSON.stringify(user));
  }
  assert.equal((await t.call("GET /api/student/class-teachers", { user: student(), adminPreview: "regular" })).body.needed, false);
  assert.equal((await t.call("POST /api/student/class-teachers", { user: teacher(), body: { advisory: { teacherId: 10 }, lit: { teacherId: 10 } } })).code, 403);
  assert.equal((await t.call("POST /api/student/class-teachers", { user: student({ school_id: null }), body: { advisory: { teacherId: 10 }, lit: { teacherId: 10 } } })).code, 400);
});

test("a student cannot pick a teacher from another school", async () => {
  const t = setup();
  const r = await t.call("POST /api/student/class-teachers", { user: student(), body: { advisory: { teacherId: 30 }, lit: { teacherId: 10 } } });
  assert.equal(r.code, 400);
  assert.match(r.body.message, /isn't at your school/);
  assert.equal(t.picks.length, 0);
  assert.equal((await t.call("POST /api/student/class-teachers", { user: student(), body: { advisory: { name: "" }, lit: { teacherId: 10 } } })).code, 400);
});

test("every teacher at the school sees the whole school's list, and only their school's", async () => {
  const t = setup();
  await t.call("POST /api/student/class-teachers", { user: student(), body: { advisory: { teacherId: 11 }, lit: { teacherId: 12 } } });
  await t.call("POST /api/student/class-teachers", { user: student({ id: 50, school_id: 8 }), body: { advisory: { teacherId: 30 }, lit: { teacherId: 30 } } });
  // Ms. Garcia is neither of Zoe's teachers but is at the school, so she sees Zoe too
  const r = await t.call("GET /api/teacher/class-teachers", { user: teacher() });
  assert.equal(r.code, 200);
  assert.equal(r.body.school.id, 4);
  assert.equal(r.body.me, 10);
  assert.deepEqual(r.body.entries.map((e: any) => e.studentId).sort(), [1, 2, 3, 4]);
  const zoe = r.body.entries.find((e: any) => e.studentId === 1);
  assert.equal(zoe.advisory.name, "Mr. Jordan Lee");
  assert.equal(r.body.entries.filter((e: any) => e.answered).length, 1);
  assert.ok(!r.body.entries.some((e: any) => e.studentId === 50));
  // a teacher without a school, one waiting for approval, and a student
  assert.equal((await t.call("GET /api/teacher/class-teachers", { user: teacher({ school_id: null }) })).body.noSchool, true);
  assert.equal((await t.call("GET /api/teacher/class-teachers", { user: teacher({ accountApproved: false }) })).code, 403);
  assert.equal((await t.call("GET /api/teacher/class-teachers", { user: student() })).code, 403);
  // a teacher cannot ask for another school
  assert.equal((await t.call("GET /api/teacher/class-teachers", { user: teacher(), query: { schoolId: "8" } })).body.school.id, 4);
});

test("the administrator chooses which school to look at", async () => {
  const t = setup();
  const admin = { id: 1000, username: "admin", role: "admin", isAdmin: true };
  const none = await t.call("GET /api/teacher/class-teachers", { user: admin });
  assert.equal(none.body.school, null);
  assert.deepEqual(none.body.schools.map((s: any) => s.id), [4, 8]); // the Independent entry is not a school
  const four = await t.call("GET /api/teacher/class-teachers", { user: admin, query: { schoolId: "4" } });
  assert.equal(four.body.entries.length, 4);
  assert.equal(four.body.me, null);
});

test("a student placed in an advisory at upload is still asked for their ELA teacher, and only that", async () => {
  const t = setup();
  t.picks.push({ student_id: 1, school_year: "2026-27", school_id: 4, advisory_teacher_id: null, advisory_teacher_name: "Chase & Shuster", lit_teacher_id: null, lit_teacher_name: "", updated_at: "" });
  const asked = await t.call("GET /api/student/class-teachers", { user: student() });
  assert.equal(asked.body.needed, true);
  const saved = await t.call("POST /api/student/class-teachers", { user: student(), body: { lit: { name: "Ms. Garcia" } } });
  assert.deepEqual(saved.body.current, { advisory: { teacherId: null, name: "Chase & Shuster" }, lit: { teacherId: null, name: "Ms. Garcia" } });
  assert.equal((await t.call("GET /api/student/class-teachers", { user: student() })).body.needed, false);
});

test("Conservatory Green's advisories come grouped by their two advisors", async () => {
  const m = await import("../shared/advisories");
  const list = m.advisoriesForSchool("DSST: Conservatory Green Middle School (Denver, CO)");
  assert.equal(list.length, 15);
  assert.deepEqual(list.map(m.advisoryName), ["Boucher & Groussman", "Mullaney & Muniz", "Charfauros & Miller", "Garcia & Micou", "Balestrini & Tsui",
    "Chase & Shuster", "Isaac & Ross", "Altunel & Padilla", "King & Ruos", "Hines-Brazell & Kast",
    "Pochette & Vohlers", "Kettle & Penas", "Callamaras & Lescano", "Brown & Maggard", "Garner & Smith"]);
  assert.equal(m.advisoryLabel(list[5]), "Lucy Chase & Jeffrey Shuster · Grade 7 · Room 212");
  assert.equal(m.advisoryLabel(list[0]), "Anne-Marie Boucher & Jennifer Groussman · Grade 6 · Room 241");
  assert.equal(list.flatMap((a) => a.teachers).length, 30);
  assert.equal(new Set(list.map((a) => a.id)).size, 15);
  assert.deepEqual(m.advisoriesForSchool("Conservatory Green High School"), []);
  assert.deepEqual(m.advisoriesForSchool("Test (Denver, CO)"), []);
  assert.equal(m.advisorAccount(list[5], [{ id: 7, displayName: "Mr. Jeffrey Shuster" }])?.id, 7);
  // A co-advisor sees their advisory's students as their own.
  const entry = { studentId: 1, name: "A", username: "a", answered: true, advisory: { teacherId: null, name: "Chase & Shuster", onSite: false }, lit: null, updatedAt: null };
  assert.equal(listsTeacher(entry, 7, "Jeffrey Shuster"), true);
  assert.equal(listsTeacher(entry, 8, "Sandra Ross"), false);
});
