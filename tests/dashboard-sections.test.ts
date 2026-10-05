// The admin, teacher and parent pages are divided into sections. These check
// that every "waiting on you" item points at a part of the page that exists,
// and that the names other pages still use for the old teacher tabs keep working.
// Run with: npx tsx --test tests/dashboard-sections.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ADMIN_SECTIONS, PARENT_SECTIONS, TEACHER_SECTIONS,
  adminWaitingRows, isAdminSection, isParentSection, teacherSectionFor, waitingBySection,
  type AdminWaiting,
} from "../client/src/lib/dashboardSections";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const everything: AdminWaiting = { teachers: 1, students: 2, parents: 1, unlisted: 3, gradeChanges: 1, eyeGazeChanges: 4, aiQuizzes: 1, quizReviews: 2, quizRequests: 5, clubSignups: 1 };

test("section ids are unique, and every section but Home says what is in it", () => {
  for (const list of [ADMIN_SECTIONS, TEACHER_SECTIONS, PARENT_SECTIONS]) {
    const ids = list.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const s of list) assert.ok(s.label.trim().length > 2, s.id);
  }
  for (const s of ADMIN_SECTIONS.filter((x) => x.id !== "home")) {
    assert.ok(s.about.length > 20, `${s.id} needs a line under its name`);
    assert.ok(s.holds.length > 10, `${s.id} needs a line for the map on Home`);
  }
  assert.equal(ADMIN_SECTIONS[0].id, "home");
  assert.equal(isAdminSection("books"), true);
  assert.equal(isAdminSection("nope"), false);
  assert.equal(isAdminSection(null), false);
  assert.equal(isParentSection("progress"), true);
  assert.equal(isParentSection("games"), false);
});

test("only kinds with something waiting are listed, worded for one or for many", () => {
  assert.deepEqual(adminWaitingRows({}), []);
  assert.deepEqual(adminWaitingRows({ teachers: 0, students: -2, parents: Number.NaN, quizRequests: undefined }), []);

  const one = adminWaitingRows({ teachers: 1 });
  assert.equal(one.length, 1);
  assert.equal(`${one[0].count} ${one[0].label}`, "1 teacher is waiting to be approved");
  const many = adminWaitingRows({ teachers: 3 });
  assert.equal(`${many[0].count} ${many[0].label}`, "3 teachers are waiting to be approved");

  const all = adminWaitingRows(everything);
  assert.equal(all.length, Object.keys(everything).length);
  for (const row of all) {
    assert.equal(row.count, everything[row.key]);
    assert.ok(isAdminSection(row.section) && row.section !== "home", row.key);
    assert.ok(!/^\d/.test(row.label) && !/[.!]$/.test(row.label), row.label);
  }
});

test("the numbers on the section list add up to the rows", () => {
  const rows = adminWaitingRows(everything);
  const by = waitingBySection(rows);
  assert.deepEqual(by, { teachers: 1, students: 2 + 3 + 1 + 4, parents: 1, books: 1 + 2 + 5, programs: 1 });
  assert.equal(Object.values(by).reduce((a, b) => a + (b || 0), 0), rows.reduce((a, r) => a + r.count, 0));
  assert.deepEqual(waitingBySection([]), {});
});

test("every waiting row points at a part that is on the admin page, inside the section it names", () => {
  const admin = source("client/src/pages/Admin.tsx");
  // the last place a section's test appears is where its contents begin (the page title checks one earlier)
  const sectionStart = (id: string) => admin.lastIndexOf(`{adminTab === "${id}" && (`);
  const starts = ADMIN_SECTIONS.map((s) => ({ id: s.id, at: sectionStart(s.id) })).sort((a, b) => a.at - b.at);
  for (const s of starts) assert.ok(s.at > 0, `the admin page has no "${s.id}" section`);

  for (const row of adminWaitingRows(everything)) {
    const at = admin.indexOf(`data-section="${row.part}"`);
    assert.ok(at > 0, `nothing on the admin page is marked "${row.part}"`);
    // the section a part sits in is the last one that starts before it
    const inside = starts.filter((s) => s.at < at).pop();
    assert.equal(inside?.id, row.section, `"${row.part}" is in ${inside?.id}, but its row opens ${row.section}`);
  }
});

test("the old teacher tab names still land on the right section and part", () => {
  const teacher = source("client/src/pages/TeacherDashboard.tsx");
  const ids = TEACHER_SECTIONS.map((s) => s.id);
  const old = ["students", "all-students", "pending", "book-requests", "parents", "proctor", "camera-quizzes", "grade-changes", "growth-check", "club-controls", "prizes"];
  for (const name of old) {
    const where = teacherSectionFor(name);
    assert.ok(ids.includes(where.section), name);
    assert.ok(teacher.includes(`section === "${where.section}" &&`), `the teacher page has no "${where.section}" section`);
    if (where.part) assert.ok(teacher.includes(`data-section="${where.part}"`), `nothing on the teacher page is marked "${where.part}"`);
  }
  // TeacherArise2 sends teachers to the game controls by the old name
  assert.deepEqual(teacherSectionFor("club-controls"), { section: "games", part: "club-controls" });
  assert.deepEqual(teacherSectionFor("pending"), { section: "requests", part: "pending-students" });
  // the new names work too, and anything unknown opens the first section
  for (const id of ids) assert.equal(teacherSectionFor(id).section, id);
  for (const junk of [null, undefined, "", "constructor", "__proto__", "toString", "nope"]) assert.deepEqual(teacherSectionFor(junk), { section: "students" });
});

test("each page shows every one of its sections", () => {
  const admin = source("client/src/pages/Admin.tsx"), teacher = source("client/src/pages/TeacherDashboard.tsx"), parent = source("client/src/pages/ParentDashboard.tsx");
  for (const s of ADMIN_SECTIONS) assert.ok(admin.includes(`{adminTab === "${s.id}" && (`), `admin: ${s.id}`);
  for (const s of TEACHER_SECTIONS) assert.ok(teacher.includes(`{section === "${s.id}" &&`), `teacher: ${s.id}`);
  for (const s of PARENT_SECTIONS) assert.ok(parent.includes(`{section === "${s.id}" &&`), `parent: ${s.id}`);
});
