import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, normalizeWorkspace, type Workspace } from "../shared/teacherHub";
import { addLink, cleanLinks, connections, linksOf, mentionedStudents, resolveLink, setLinks, suggestLinks } from "../shared/hubLinks";
import { saveTask } from "../shared/hubTasks";
import { cleanNote, noteFields } from "../shared/hubNotes";

function hub(): Workspace {
  const w = emptyWorkspace();
  return {
    ...w,
    students: [{ id: "s1", name: "Julian Sikora", grade: "4", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" }, { id: "s2", name: "Maya Lee", grade: "3", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" }],
    goals: [{ id: "g1", student: "Julian Sikora", area: "Reading", text: "Read 90 wpm", baseline: 60, target: 90, unit: "wpm", direction: "up", startDate: "2026-09-01", targetDate: "", points: [] },
      { id: "g2", student: "Maya Lee", area: "Math", text: "Add to 20", baseline: 40, target: 80, unit: "%", direction: "up", startDate: "2026-09-01", targetDate: "", points: [] }],
    meetings: [{ id: "m1", student: "Julian Sikora", type: "Annual IEP", date: "2026-11-02", notes: "", done: false }],
    tasks: [{ id: "t1", title: "Progress monitoring for Julian", dueDate: "2026-10-20", recurring: "", done: false }, { id: "t2", title: "Copy worksheets", dueDate: "", recurring: "", done: false }],
    notes: [{ id: "n1", student: "Maya Lee", type: "Check-in", body: "Good day", date: "2026-10-01" }],
    drive: [{ id: "f1", path: "u/1/a.pdf", name: "Julian goals 2026.pdf", size: 1000, contentType: "application/pdf", uploadedAt: "" }],
  } as any;
}

test("links are cleaned, kept per item and point at real things", () => {
  assert.deepEqual(cleanLinks([{ kind: "file", id: "f1" }, { kind: "file", id: "f1" }, { kind: "nope", id: "x" }, null]), [{ kind: "file", id: "f1" }]);
  let w = addLink(hub(), "task", "t2", { kind: "file", id: "f1" });
  w = addLink(w, "task", "t2", { kind: "student", id: "s1" });
  assert.deepEqual(linksOf(w, "task", "t2"), [{ kind: "file", id: "f1" }, { kind: "student", id: "s1" }]);
  assert.equal(resolveLink(w, { kind: "file", id: "f1" })?.label, "Julian goals 2026.pdf");
  assert.equal(resolveLink(w, { kind: "goal", id: "gone" }), null);
  assert.deepEqual(linksOf(setLinks(w, "task", "t2", [{ kind: "task", id: "t2" }]), "task", "t2"), [], "never linked to itself");
  assert.ok(normalizeWorkspace(JSON.parse(JSON.stringify(w))).tasks.find((t) => t.id === "t2")!.links!.length === 2, "links survive saving");
});

test("students are found by full name, or a first name only one student has", () => {
  assert.deepEqual(mentionedStudents(hub(), "Progress monitoring for Julian"), ["Julian Sikora"]);
  assert.deepEqual(mentionedStudents(hub(), "call maya lee's mom"), ["Maya Lee"]);
  assert.deepEqual(mentionedStudents(hub(), "jules"), []);
});

test("an IEP meeting pulls in the student's goals, reminders and files", () => {
  let w = addLink(hub(), "goal", "g1", { kind: "file", id: "f1" });
  const c = connections(w, "meeting", "m1");
  const ids = c.map((x) => `${x.kind}:${x.id}`);
  assert.ok(ids.includes("student:s1") && ids.includes("goal:g1") && ids.includes("task:t1") && ids.includes("file:f1"), ids.join(","));
  assert.ok(!ids.includes("goal:g2") && !ids.includes("note:n1"), "nothing about other students");
  w = addLink(w, "task", "t2", { kind: "meeting", id: "m1" });
  assert.equal(connections(w, "meeting", "m1").find((x) => x.id === "t2")?.why, "linked from", "and what links to it");
  const s = connections(w, "student", "s2").map((x) => x.id);
  assert.deepEqual(s.sort(), ["g2", "n1"]);
});

test("suggestions: the student named, their goals for progress work, and matching files", () => {
  const s = suggestLinks(hub(), "Progress monitoring for Julian").map((x) => `${x.kind}:${x.id}`);
  assert.deepEqual(s, ["student:s1", "goal:g1", "file:f1"]);
  assert.deepEqual(suggestLinks(hub(), "Copy worksheets"), []);
});

test("reminders and notes keep their links when saved", () => {
  const [t] = saveTask([], null, { title: "Probe", dueDate: "", recurring: "", priority: false, links: [{ kind: "goal", id: "g1" }] }, () => "x");
  assert.deepEqual(t.links, [{ kind: "goal", id: "g1" }]);
  const kept = saveTask([{ ...t }], "x", { title: "Probe 2", dueDate: "", recurring: "", priority: false }, () => "y");
  assert.deepEqual(kept[0].links, [{ kind: "goal", id: "g1" }], "editing without links keeps them");
  const n = cleanNote({ scope: "student", student: "Maya Lee", type: "Check-in", title: "", date: "", body: "x", links: [{ kind: "file", id: "f1" }] });
  assert.deepEqual(noteFields({ id: "n", ...n! }).links, [{ kind: "file", id: "f1" }]);
});

test("AI-read goals land in Goals, linked to the file and the student", async () => {
  const { cleanHubImport, mergeHubImport, emptyHubImport } = await import("../shared/teacherHub");
  const items = cleanHubImport({ goals: [{ student: "Julian Sikora", area: "Reading", text: "Read 90 words per minute", baseline: "60", target: 90, unit: "wpm", targetDate: "2027-05-01" }], tasks: [{ title: "Progress monitoring Julian", dueDate: "2026-10-30" }] }, "2026-10-19");
  assert.equal(items.goals.length, 1);
  const r = mergeHubImport(hub(), items, (() => { let n = 0; return () => `new${++n}`; })(), null, [{ kind: "file", id: "f1" }]);
  const g = r.workspace.goals.find((x) => x.text === "Read 90 words per minute")!;
  assert.equal(g.baseline, 60); assert.equal(g.target, 90); assert.equal(g.direction, "up"); assert.deepEqual(g.points, []);
  assert.deepEqual(g.links, [{ kind: "file", id: "f1" }, { kind: "student", id: "s1" }]);
  assert.deepEqual(r.workspace.tasks.find((t) => t.title === "Progress monitoring Julian")!.links, [{ kind: "file", id: "f1" }]);
  assert.equal(r.added.goals, 1);
  assert.equal(mergeHubImport(r.workspace, items, () => "z", null).added.goals, undefined, "the same goal isn't added twice");
  void emptyHubImport;
});

test("quiz scores come back once, and fill in percent goals only", async () => {
  const { applyQuizResults } = await import("../shared/hubLinks");
  const w = { ...hub(), goals: [...hub().goals, { id: "g3", student: "Julian Sikora", area: "Reading", text: "Answer questions", baseline: 50, target: 80, unit: "% correct", direction: "up", startDate: "", targetDate: "", points: [] }],
    goalQuizzes: [{ id: "77", title: "Skill check · Julian", student: "Julian Sikora", readerUserId: 216, goalIds: ["g1", "g3"], createdAt: "", recorded: [], results: [] }] } as any;
  const rows = [{ attemptId: "a1", quizId: "77", userId: 216, score: 4, total: 5, completedAt: "2026-10-20T15:00:00Z" }, { attemptId: "a2", quizId: "77", userId: 999, score: 1, total: 5, completedAt: "2026-10-20T15:00:00Z" }];
  const once = applyQuizResults(w, rows, () => "p1");
  const g3 = once.goals.find((g: any) => g.id === "g3")!;
  assert.deepEqual(g3.points.map((p: any) => [p.date, p.value]), [["2026-10-20", 80]]);
  assert.equal(once.goals.find((g: any) => g.id === "g1")!.points.length, 0, "a wpm goal isn't given a percent");
  assert.equal((once as any).goalQuizzes[0].results.length, 1, "another student's attempt is ignored");
  const twice = applyQuizResults(once, rows, () => "p2");
  assert.equal(twice, once, "nothing changes the second time");
});
