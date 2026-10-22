import test from "node:test";
import assert from "node:assert/strict";
import { searchHub } from "../shared/hubSearch";
import { buildLifeBrief, buildWorkBrief, briefText } from "../shared/dailyBrief";
import { cleanLayout, foldMenu } from "../shared/hubLayout";
import { cleanLifeLayout } from "../shared/lifeLayout";
import { emptyWorkspace } from "../shared/teacherHub";
import { cleanFamily } from "../shared/familyHub";

test("search finds sections and saved things, forgiving small typos", () => {
  const entries = [
    { id: "1", kind: "Students", title: "Ava Martinez", sub: "Grade 3" },
    { id: "2", kind: "To-dos", title: "Email Ava's mom", sub: "Due Oct 12" },
    { id: "3", kind: "Section", title: "Calendar" },
    { id: "4", kind: "Notes", title: "Staff meeting", keywords: "fire drill schedule" },
  ];
  assert.deepEqual(searchHub(entries, "ava").map((e) => e.id), ["1", "2"]);
  assert.equal(searchHub(entries, "calender")[0].id, "3", "one letter off still finds it");
  assert.equal(searchHub(entries, "fire drill")[0].id, "4", "words in the details count");
  assert.equal(searchHub(entries, "zzz").length, 0);
  assert.equal(searchHub(entries, "  ").length, 0);
});

test("layouts keep a computer menu choice and clean folders; folders group the menu", () => {
  const l = cleanLayout({ deskSide: "right", folders: [{ id: "a", name: "Planning", items: ["calendar", "tasks"] }, { id: "b", name: "Dup", items: ["tasks", "notes"] }, { id: "c", name: "", items: ["x"] }] });
  assert.equal(l.deskSide, "right");
  assert.deepEqual(l.folders.map((f) => [f.name, f.items]), [["Planning", ["calendar", "tasks"]], ["Dup", ["notes"]]]);
  assert.equal(cleanLayout({ deskSide: "sideways" }).deskSide, "left");
  assert.equal(cleanLifeLayout({}).deskSide, "left");
  const menu = ["home", "calendar", "caseload", "tasks", "notes"].map((id) => ({ id }));
  const folded = foldMenu(menu, l.folders);
  assert.deepEqual(folded.map((e) => (e.kind === "item" ? e.item.id : `[${e.folder.name}:${e.items.map((i) => i.id).join(",")}]`)), ["home", "[Planning:calendar,tasks]", "caseload", "[Dup:notes]"]);
  // A folder just made in Customize has nothing in it yet, and no section to sit next to — it still shows,
  // at the end, rather than disappearing until something is dropped into it.
  const freshlyMade = [...l.folders, { id: "c", name: "Empty So Far", items: [] }];
  const foldedWithEmpty = foldMenu(menu, freshlyMade);
  assert.deepEqual(foldedWithEmpty.map((e) => (e.kind === "item" ? e.item.id : `[${e.folder.name}:${e.items.map((i) => i.id).join(",")}]`)), ["home", "[Planning:calendar,tasks]", "caseload", "[Dup:notes]", "[Empty So Far:]"]);
});

test("the daily brief gathers today's schedule, to-dos and deadlines", () => {
  const w = { ...emptyWorkspace(), students: [{ ...(emptyWorkspace().students[0] ?? {}), id: "s", name: "Ava M.", grade: "3", accommodations: "", iepDate: "2026-10-20", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" } as any],
    tasks: [{ id: "t", title: "Send progress report", dueDate: "2026-10-10", recurring: "", done: false }, { id: "u", title: "Later", dueDate: "2026-10-30", recurring: "", done: false }],
    events: [{ id: "e", title: "Staff meeting", date: "2026-10-12", start: "15:30", end: "16:30", location: "Library", notes: "" } as any] };
  const b = buildWorkBrief(w as any, "2026-10-12", 7, "Jo");
  assert.equal(b.greeting, "Good morning, Jo");
  assert.equal(b.sections.find((s) => s.id === "schedule")!.lines[0].when, "3:30 PM");
  assert.equal(b.sections.find((s) => s.id === "todo")!.lines.length, 1);
  assert.equal(b.sections.find((s) => s.id === "todo")!.lines[0].tone, "warn");
  assert.match(b.sections.find((s) => s.id === "deadlines")!.lines[0].text, /Ava M\.: annual IEP/);
  assert.match(briefText(b), /Staff meeting/);
  const f = cleanFamily({ bills: [{ id: "b", name: "Water", amount: 40, dueDay: 14, category: "", autopay: false, paid: [] }], birthdays: [{ id: "x", name: "Grandma", month: 10, day: 13, year: 0, kind: "birthday" }] } as any);
  const lb = buildLifeBrief(f, [{ title: "Dentist call", due: "2026-10-12", time: "09:00", done: false }], "2026-10-12", 18, "");
  assert.equal(lb.greeting, "Good evening");
  assert.equal(lb.sections.find((s) => s.id === "bills")!.lines[0].when, "2 days");
  assert.equal(lb.sections.find((s) => s.id === "birthdays")!.lines[0].when, "Tomorrow");
  assert.equal(lb.sections.find((s) => s.id === "tasks")!.lines[0].when, "9:00 AM");
});
