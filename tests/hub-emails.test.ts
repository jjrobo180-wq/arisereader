// Teacher Hub: flagging a saved email and putting it on the to-do list.
// Run with: npx tsx --test tests/hub-emails.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace, type EmailItem, type Workspace } from "../shared/teacherHub";
import { addEmailToTasks, arrangeEmails, emailCounts, emailTask, emailTaskTitle, toggleEmailFlag } from "../shared/hubEmails";
import { saveTask, toggleTask, undoTask } from "../shared/hubTasks";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const mail = (id: string, more: Partial<EmailItem> = {}): EmailItem => ({ id, from: "", subject: "", body: "", action: "", draft: "", date: "2026-10-07", ...more });
const ids = () => { let n = 0; return () => `new${++n}`; };

function hub(): Workspace {
  return normalizeWorkspace({
    emails: [
      mail("e1", { from: "Principal Ortiz", subject: "Field trip forms", body: "Please send the forms by Friday.", action: "Send the field trip forms to the office\nby Friday" }),
      mail("e2", { from: "Ms. Lee", subject: "IEP date for Jordan" }),
      mail("e3", { subject: "Staff newsletter" }),
    ],
    tasks: [{ id: "t0", title: "Order markers", dueDate: "", recurring: "", done: false }],
  });
}

test("a to-do made from an email is named for what has to be done", () => {
  assert.equal(emailTaskTitle(hub().emails[0]), "Send the field trip forms to the office", "the action item's first line");
  assert.equal(emailTaskTitle(hub().emails[1]), "Reply to Ms. Lee: IEP date for Jordan");
  assert.equal(emailTaskTitle(hub().emails[2]), "Email: Staff newsletter");
  assert.equal(emailTaskTitle(mail("x", { from: " Coach  Kim " })), "Reply to Coach Kim");
  assert.equal(emailTaskTitle(mail("x")), "Follow up on an email");
  assert.equal(emailTaskTitle(mail("x", { action: "y".repeat(400) })).length, 200);
});

test("an email is put on the to-do list once, and shows where it stands", () => {
  const start = hub();
  const first = addEmailToTasks(start, "e1", ids());
  assert.equal(first.added, true);
  assert.deepEqual(first.workspace.tasks[1], { id: "new1", title: "Send the field trip forms to the office", dueDate: "", recurring: "", done: false, emailId: "e1", notes: "From Principal Ortiz · Field trip forms" });
  assert.equal(first.workspace.tasks[0], start.tasks[0], "the other to-dos are untouched");
  assert.equal(first.workspace.emails, start.emails, "the email itself is not changed");
  assert.equal(start.tasks.length, 1, "the workspace handed in is not changed");
  assert.equal(emailTask(first.workspace, "e1")?.id, "new1");
  assert.equal(emailTask(first.workspace, "e2"), undefined);
  // Tapping again adds nothing while it is still waiting.
  const again = addEmailToTasks(first.workspace, "e1", ids());
  assert.deepEqual([again.added, again.taskId], [false, "new1"]);
  assert.equal(again.workspace, first.workspace);
  // Checked off, the email shows it is done, and it can go on the list again.
  const done = { ...first.workspace, tasks: toggleTask(first.workspace.tasks, "new1", "2026-10-07", "2026-10-07T16:00:00.000Z").tasks };
  assert.equal(emailTask(done, "e1")?.done, true);
  const second = addEmailToTasks(done, "e1", () => "new2");
  assert.equal(second.added, true);
  assert.equal(emailTask(second.workspace, "e1")?.id, "new2", "the open one is the one that counts");
  // Un-checking it brings it back as waiting; editing it keeps the link to its email.
  assert.equal(emailTask({ tasks: undoTask(done.tasks, "new1", Date.parse("2026-10-07T17:00:00.000Z")) }, "e1")?.done, false);
  assert.equal(saveTask(first.workspace.tasks, "new1", { title: "Send the forms", dueDate: "2026-10-09", recurring: "", priority: true, notes: "Ask Ana" }, ids())[1].emailId, "e1");
  // A due day can be given, and an email that is gone adds nothing.
  assert.equal(addEmailToTasks(start, "e2", ids(), "2026-10-08").workspace.tasks[1].dueDate, "2026-10-08");
  assert.deepEqual(addEmailToTasks(start, "nope", ids()), { workspace: start, taskId: null, added: false });
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(first.workspace))).tasks, first.workspace.tasks, "the link survives a save and load");
});

test("a flagged email floats to the top, and the flag comes off again", () => {
  const start = hub();
  const flagged = toggleEmailFlag(start, "e3");
  assert.equal(flagged.emails[2].flagged, true);
  assert.equal(flagged.emails[0], start.emails[0]);
  assert.deepEqual(arrangeEmails(flagged).map((e) => e.id), ["e3", "e1", "e2"]);
  assert.deepEqual(arrangeEmails(flagged, "flagged").map((e) => e.id), ["e3"]);
  assert.deepEqual(arrangeEmails(start).map((e) => e.id), ["e1", "e2", "e3"], "unflagged emails keep their order");
  assert.equal("flagged" in toggleEmailFlag(flagged, "e3").emails[2], false);
  assert.equal(toggleEmailFlag(start, "nope"), start);
  const both = addEmailToTasks(toggleEmailFlag(flagged, "e1"), "e2", ids()).workspace;
  assert.deepEqual(arrangeEmails(both).map((e) => e.id), ["e1", "e3", "e2"]);
  assert.deepEqual(arrangeEmails(both, "todo").map((e) => e.id), ["e2"], "only the ones still waiting on the list");
  assert.deepEqual(emailCounts(both), { all: 3, flagged: 2, todo: 1 });
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(both))).emails, both.emails);
});

test("the email screen has the flag and the to-do button, and the to-do says where it came from", () => {
  const page = read("client/src/pages/TeacherHub.tsx");
  for (const part of ['data-testid="email-flag"', 'data-testid="email-to-todo"', 'data-testid="email-on-list"', 'data-testid="email-also-todo"', 'data-testid="email-also-flag"', 'data-testid="task-from-email"', "Add to my to-dos", "On your to-do list", "toggleEmailFlag(p, e.id)", 'onViewTasks={() => setTab("tasks")}']) assert.ok(page.includes(part), part);
});
