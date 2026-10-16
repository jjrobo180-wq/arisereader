// Printing parent letters in batches by teacher. Run with: npx tsx --test tests/parent-letters.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { batchSummary, cleanTeacherChoices, escapeHtml, letterHtml, sortInvites, studentsToPrint } from "../shared/parentLetters";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const users = [
  { id: 1, role: "teacher", displayName: "Ms. Adams" },
  { id: 2, role: "teacher", displayName: "Mr. Brown" },
  { id: 3, role: "student", teacherId: 1, displayName: "Zed" },
  { id: 4, role: "student", teacherId: 1, displayName: "Amy" },
  { id: 5, role: "student", teacherId: 2, displayName: "Ben" },
  { id: 6, role: "student", teacherId: null, displayName: "Cy" },
  { id: 7, role: "parent", teacherId: 1, displayName: "A parent" },
];
const ids = (list: Array<{ id: number }>) => list.map((u) => u.id).sort((a, b) => a - b);

test("the teacher list in a request is checked", () => {
  assert.deepEqual(cleanTeacherChoices([1, 2, 2, "none"]), [1, 2, "none"]);
  for (const bad of [undefined, null, [], "1", [0], [-3], [1.5], ["1"], [null], [1, "x"], Array.from({ length: 300 }, (_, i) => i + 1)]) {
    assert.equal(cleanTeacherChoices(bad), null, JSON.stringify(bad)?.slice(0, 30));
  }
});

test("who a print covers", () => {
  const admin = { id: 99, isAdmin: true };
  assert.deepEqual(ids(studentsToPrint(users, admin)), [3, 4, 5, 6], "the administrator with no choice: every student, never parents or teachers");
  assert.deepEqual(ids(studentsToPrint(users, admin, { choices: [1] })), [3, 4], "one teacher's class");
  assert.deepEqual(ids(studentsToPrint(users, admin, { choices: [1, 2] })), [3, 4, 5], "two teachers");
  assert.deepEqual(ids(studentsToPrint(users, admin, { choices: ["none"] })), [6], "students with no teacher");
  assert.deepEqual(ids(studentsToPrint(users, admin, { choices: [2, "none"] })), [5, 6]);
  assert.deepEqual(ids(studentsToPrint(users, admin, { choices: [404] })), [], "a teacher with no students gives nothing");
  assert.deepEqual(ids(studentsToPrint(users, admin, { studentId: 5 })), [5], "one student");
  assert.deepEqual(ids(studentsToPrint(users, admin, { studentId: 5, choices: [1] })), [5], "a student asked for by name wins");
  // A teacher only ever gets their own class, whatever the request says.
  const teacher = { id: 1, isAdmin: false };
  assert.deepEqual(ids(studentsToPrint(users, teacher)), [3, 4]);
  assert.deepEqual(ids(studentsToPrint(users, teacher, { choices: [2, "none"] })), [3, 4], "picking other teachers does nothing for a teacher");
  assert.deepEqual(ids(studentsToPrint(users, teacher, { studentId: 5 })), [], "and another class's student is not theirs to print");
  assert.deepEqual(ids(studentsToPrint(users, { id: 2, isAdmin: false })), [5]);
});

test("a batch is grouped by teacher and ordered by name; no-teacher last", () => {
  const sorted = sortInvites([
    { studentName: "Ben", teacherName: "Mr. Brown", code: "b" },
    { studentName: "Cy", code: "c" },
    { studentName: "Zed", teacherName: "Ms. Adams", code: "z" },
    { studentName: "amy", teacherName: "Ms. Adams", code: "a" },
    { studentName: "Al", teacherName: "mr. brown", code: "x" },
  ]);
  assert.deepEqual(sorted.map((i) => i.studentName), ["amy", "Zed", "Al", "Ben", "Cy"], "Adams's class, then Brown's (titles ignored), then no teacher");
  assert.deepEqual(sortInvites([{ studentName: "x", teacherName: "Mr. Zimmer" }, { studentName: "y", teacherName: "Ms. Adams" }, { studentName: "w", teacherName: "Dr. Moss" }]).map((i) => i.teacherName), ["Ms. Adams", "Dr. Moss", "Mr. Zimmer"]);
});

test("the letter carries the child, the teacher and the code, and is safe to print", () => {
  const html = letterHtml({ studentName: "<b>Amy</b> & Co", teacherName: 'Ms. "A"', code: "AB12-CD34" });
  assert.ok(html.includes("&lt;b&gt;Amy&lt;/b&gt; &amp; Co") && !html.includes("<b>Amy"), "names are escaped");
  assert.ok(html.includes("Teacher: <strong>Ms. &quot;A&quot;</strong>"));
  assert.ok(html.includes("AB12-CD34") && html.includes("www.arisereader.com/parent-signup"));
  assert.ok(!letterHtml({ studentName: "Amy", code: "X" }).includes("Teacher:"), "no class line when the teacher is unknown");
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("the bar above a batch says how much is there", () => {
  assert.equal(batchSummary([{ teacherName: "A" }]), "1 letter");
  assert.equal(batchSummary([{ teacherName: "A" }, { teacherName: "A" }]), "2 letters");
  assert.equal(batchSummary([{ teacherName: "A" }, { teacherName: "B" }, {}]), "3 letters for 2 teachers, sorted by teacher");
});

test("the server, the print page and the admin screen are wired together", () => {
  const routes = read("server/routes.ts");
  assert.match(routes, /cleanTeacherChoices\(req\.body\.teacherIds\)/);
  assert.match(routes, /studentsToPrint\(users as any\[\], \{ id: Number\(req\.user\.id\), isAdmin: !!req\.user\.isAdmin \}, \{ studentId, choices \}\)/);
  assert.match(routes, /\.in\('student_id'/, "codes are read in groups, not one student at a time");
  assert.match(routes, /sortInvites\(rows\)/);
  const lib = read("client/src/lib/parentInvites.ts");
  assert.match(lib, /teacherIds: options\.teacherIds/);
  assert.match(lib, /letterHtml/);
  const admin = read("client/src/pages/Admin.tsx");
  assert.match(admin, /<PrintLettersByTeacher open=\{lettersByTeacherOpen\}/);
  assert.match(admin, /Print all parent letters/, "the old button stays");
  const dialog = read("client/src/components/admin/PrintLettersByTeacher.tsx");
  assert.match(dialog, /printParentInvites\(undefined, \{ teacherIds: ids \}\)/);
});
