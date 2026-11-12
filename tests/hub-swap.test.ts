import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyWorkspace, type Workspace } from "../shared/teacherHub";
import { applyFamilyToWorkspace, applyWorkTasksToLife, familyFromWorkspace, lifeTasksFromWork, lifeTasksToWork, notesFromFamily, notesToFamily, workspaceFromLifeTasks, type LifeTaskShape } from "../shared/hubSwap";
import { HUB_GROUPS } from "../shared/hubTabGroups";
import { HUB_TABS, isTabOn } from "../shared/teacherHub";

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const TODAY = "2026-11-05";
const withNotes = (): Workspace => ({ ...emptyWorkspace(), notes: [
  { id: "n1", student: "Ava Lee", type: "Check-in", body: "Did well", date: "2026-10-01", links: [{ kind: "task", id: "t1", title: "x" } as any] },
  { id: "n2", student: "", type: "General note", title: "Plans", body: "Friday", date: "2026-10-02", pinned: true, color: "#fde68a" },
] as any });

test("work notes show on the Life screen and a no-title note is labelled, not renamed", () => {
  const w = withNotes();
  const fam = familyFromWorkspace(w);
  assert.equal(fam.notes[0].title, "Check-in · Ava Lee");
  assert.equal(fam.notes[1].title, "Plans");
  // editing the body of the unnamed note keeps its student/type/links and does not save the made-up label as a name
  const next = { ...fam, notes: fam.notes.map((n) => (n.id === "n1" ? { ...n, body: "Did great", updatedAt: `${TODAY}T10:00:00.000Z` } : n)) };
  const out = applyFamilyToWorkspace(w, fam, next, TODAY);
  const n1 = out.notes.find((n) => n.id === "n1")!;
  assert.equal(n1.body, "Did great");
  assert.equal(n1.student, "Ava Lee");
  assert.equal(n1.type, "Check-in");
  assert.ok(n1.links?.length);
  assert.equal(n1.title, undefined);
  assert.equal(n1.date, TODAY);
  // an untouched note keeps its date
  assert.equal(out.notes.find((n) => n.id === "n2")!.date, "2026-10-02");
});

test("a new Life note becomes a work note and deleting removes it", () => {
  const w = withNotes();
  const fam = familyFromWorkspace(w);
  const added = { ...fam, notes: [...fam.notes, { id: "n3", title: "New", body: "hi", color: "#fff", pinned: false, updatedAt: "" }] };
  const out = applyFamilyToWorkspace(w, fam, added, TODAY);
  assert.equal(out.notes.length, 3);
  assert.equal(out.notes[2].title, "New");
  const removed = applyFamilyToWorkspace(out, familyFromWorkspace(out), { ...familyFromWorkspace(out), notes: [] }, TODAY);
  assert.equal(removed.notes.length, 0);
  assert.deepEqual(notesFromFamily([], notesToFamily([]), TODAY), []);
});

test("journal is saved on the workspace and the other screens do not touch it", () => {
  const w = emptyWorkspace();
  const fam = familyFromWorkspace(w);
  const entry = { id: "j1", date: TODAY, mood: "😀", text: "Good day" } as any;
  const out = applyFamilyToWorkspace(w, fam, { ...fam, journal: [entry] }, TODAY);
  assert.equal(out.journal?.length, 1);
  assert.equal(out.notes, w.notes);
  assert.equal(out.events, w.events);
});

test("calendar: events round trip, repeats and meeting details are kept, other people's calendars stay", () => {
  const w = { ...emptyWorkspace(),
    calendars: [{ id: "mine", name: "School", url: "https://x/y.ics" }, { id: "theirs", name: "Coach", owner: "Sam" }],
    events: [
      { id: "e1", title: "IEP meeting", date: "2026-11-10", start: "09:00", end: "10:00", recurring: "", meetingId: "m1", students: ["Ava"] },
      { id: "e2", title: "PLC", date: "2026-11-11", start: "08:00", end: "", repeat: "Weekly" },
      { id: "e3", title: "Coach practice", date: "2026-11-12", start: "", end: "", calendarId: "theirs" },
    ] } as any as Workspace;
  const fam = familyFromWorkspace(w);
  assert.deepEqual(fam.events.map((e) => e.id).sort(), ["e1", "e2"]);
  assert.equal(fam.events.find((e) => e.id === "e2")!.repeat, "weekly");
  assert.ok(fam.calendars.some((c) => c.id === "work"));
  // move the first event a day: its meeting link stays; the other person's event is untouched
  const next = { ...fam, events: fam.events.map((e) => (e.id === "e1" ? { ...e, date: "2026-11-11" } : e)) };
  const out = applyFamilyToWorkspace(w, fam, next, TODAY);
  const e1 = out.events.find((e) => e.id === "e1") as any;
  assert.equal(e1.date, "2026-11-11");
  assert.equal(e1.meetingId, "m1");
  assert.deepEqual(e1.students, ["Ava"]);
  assert.equal((out.events.find((e) => e.id === "e2") as any).repeat, "Weekly");
  assert.ok(out.events.some((e) => e.id === "e3"));
  assert.ok(out.calendars.some((c) => c.id === "theirs"));
  assert.ok(out.calendars.some((c) => c.id === "mine"));
});

test("calendar: a new calendar made on the Life screen is kept, and a new event lands on it", () => {
  const w = emptyWorkspace();
  const fam = familyFromWorkspace(w);
  const next = { ...fam, calendars: [...fam.calendars, { id: "c9", name: "Family", color: "#111", show: true }],
    events: [{ id: "x1", title: "Dinner", date: TODAY, time: "18:00", endTime: "", calendarId: "c9", memberIds: [], location: "", notes: "", repeat: "none" } as any] };
  const out = applyFamilyToWorkspace(w, fam, next, TODAY);
  assert.equal(out.events.length, 1);
  assert.equal(out.extraCalendars?.[0].id, "c9");
  const again = familyFromWorkspace(out);
  assert.ok(again.calendars.some((c) => c.id === "c9"));
  assert.equal(again.events[0].calendarId, "c9");
});

const lifeTask = (over: Partial<LifeTaskShape> = {}): LifeTaskShape => ({ id: "a", title: "Buy milk", notes: "", listId: "personal", assignee: "kid1", due: "", time: "", priority: "normal", repeat: "none", done: false, createdAt: "2026-10-01T00:00:00.000Z", ...over });
const lists = [{ id: "personal", name: "Personal", color: "#7566e8" }, { id: "work", name: "Work", color: "#f59e72" }];

test("tasks: Life to-dos show on the Work screen with their lists, repeats and priority", () => {
  const w = workspaceFromLifeTasks({ tasks: [lifeTask({ repeat: "weekly", priority: "high", due: "2026-11-06", time: "09:00", notes: "2%" })], lists });
  assert.equal(w.taskLists?.length, 2);
  const t = w.tasks[0];
  assert.equal(t.recurring, "Weekly");
  assert.equal(t.priority, "high");
  assert.equal(t.dueDate, "2026-11-06");
  assert.equal(t.dueTime, "09:00");
  assert.equal(t.listId, "personal");
  assert.equal(t.notes, "2%");
});

test("tasks: edits on the Work screen come back to Life without losing the family member, low priority or created time", () => {
  const life = { tasks: [lifeTask({ priority: "low" })], lists };
  const was = workspaceFromLifeTasks(life);
  const next = { ...was, tasks: was.tasks.map((t) => ({ ...t, title: "Buy oat milk", dueDate: "2026-11-07" })) };
  const out = applyWorkTasksToLife(life, was, next, "2026-11-05T10:00:00.000Z");
  assert.equal(out.tasks[0].title, "Buy oat milk");
  assert.equal(out.tasks[0].due, "2026-11-07");
  assert.equal(out.tasks[0].assignee, "kid1");
  assert.equal(out.tasks[0].priority, "low");
  assert.equal(out.tasks[0].createdAt, "2026-10-01T00:00:00.000Z");
  assert.equal(out.lists, life.lists);
});

test("tasks: a new to-do, a finished repeat, and an unchanged screen", () => {
  const life = { tasks: [lifeTask()], lists };
  const was = workspaceFromLifeTasks(life);
  assert.equal(applyWorkTasksToLife(life, was, was, "now"), life);
  const added = { ...was, tasks: [...was.tasks, { id: "b", title: "New", dueDate: "", recurring: "", done: false, listId: "work" } as any] };
  const out = applyWorkTasksToLife(life, was, added, "2026-11-05T10:00:00.000Z");
  assert.equal(out.tasks.length, 2);
  assert.equal(out.tasks[1].listId, "work");
  assert.equal(out.tasks[1].assignee, "");
  assert.equal(out.tasks[1].repeat, "none");
  const done = { ...was, tasks: was.tasks.map((t) => ({ ...t, done: true, doneAt: "2026-11-05T09:00:00.000Z" })) };
  assert.equal(applyWorkTasksToLife(life, was, done, "n").tasks[0].completedAt, "2026-11-05T09:00:00.000Z");
});

test("tasks: lists can be added; deleting one moves its to-dos to the first list; the last list stays", () => {
  const life = { tasks: [lifeTask({ listId: "work" })], lists };
  const was = workspaceFromLifeTasks(life);
  const added = { ...was, taskLists: [...(was.taskLists || []), { id: "z", name: "Home", color: "#000" }] };
  assert.equal(applyWorkTasksToLife(life, was, added, "n").lists.length, 3);
  const removed = { ...was, taskLists: (was.taskLists || []).filter((l) => l.id !== "work"), tasks: was.tasks.map((t) => ({ ...t, listId: undefined })) };
  const out = applyWorkTasksToLife(life, was, removed, "n");
  assert.deepEqual(out.lists.map((l) => l.id), ["personal"]);
  assert.equal(out.tasks[0].listId, "personal");
  const none = { ...was, taskLists: [] };
  assert.equal(applyWorkTasksToLife(life, was, none, "n").lists.length, 2);
});

test("tasks: unknown repeats map to monthly and the mapping round trips ids", () => {
  const w = lifeTasksToWork([lifeTask({ id: "q", repeat: "daily" })]);
  const back = lifeTasksFromWork([lifeTask({ id: "q" })], [{ ...w[0], recurring: "Quarterly" }], "personal", "n");
  assert.equal(back[0].repeat, "monthly");
  assert.equal(back[0].id, "q");
});

test("Work Hub has a Journal tab, on for everyone, in the menu", () => {
  assert.ok((HUB_TABS as readonly string[]).includes("journal"));
  assert.equal(isTabOn("journal", {}, false), true);
  assert.ok(HUB_GROUPS.some((g) => g.id === "journal" && g.tabs.includes("journal")));
});

test("wiring: Work Hub uses the Life screens; Life Hub uses the Work Tasks screen; the chip row is no longer clipped", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /which="notes"/);
  assert.match(hub, /which="calendar"/);
  assert.match(hub, /which="journal"/);
  assert.doesNotMatch(hub, /<HubNotes /);
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /<LifeTasksScreen /);
  const tasks = read("client/src/components/teacher-hub/HubTasks.tsx");
  assert.match(tasks, /overflow-x-auto px-2 py-1 /);
});
