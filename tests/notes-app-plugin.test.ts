// The Notes app offered through the App Store: "LifeHub Notes" (renamed from "Notes") installable
// into WorkHub, and "Work Notes" (renamed from "Notes") installable into LifeHub. Each install keeps
// its own separate notes, and neither shares data with the hub's own built-in notes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLUGINS, lifeInstalled, notesAppPlugin, setLifeNotesApp, setWorkNotesApp, workInstalled } from "../shared/pluginStore";
import { cleanNotesApp, pinNotesAppNote, removeNotesAppNote, saveNotesAppNote } from "../shared/notesApp";
import { emptyFamily, cleanFamily } from "../shared/familyHub";
import { emptyWorkspace } from "../shared/teacherHub";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the hubs' own built-in notes are renamed: LifeHub Notes and Work Notes", () => {
  const life = PLUGINS.find((p) => p.id === "life-notes")!;
  assert.equal(life.name, "LifeHub Notes");
  assert.equal(life.target.kind, "section");
  const work = PLUGINS.find((p) => p.id === "work-notes")!;
  assert.equal(work.name, "Work Notes");
  assert.equal(work.target.kind, "tab");
});

test("LifeHub Notes can be installed into WorkHub, and Work Notes into LifeHub, as separate apps", () => {
  const workSide = PLUGINS.find((p) => p.id === "work-lifehub-notes")!;
  assert.equal(workSide.hub, "work");
  assert.equal(workSide.name, "LifeHub Notes");
  assert.equal(workSide.target.kind, "notesApp");
  const lifeSide = PLUGINS.find((p) => p.id === "life-work-notes")!;
  assert.equal(lifeSide.hub, "life");
  assert.equal(lifeSide.name, "Work Notes");
  assert.equal(lifeSide.target.kind, "notesApp");
  // Neither is the same plugin as the hub's own built-in notes.
  assert.notEqual(workSide.id, "work-notes");
  assert.notEqual(lifeSide.id, "life-notes");
});

test("installing a Notes app in WorkHub only touches notesInstalled, and keeps saved notes when removed", () => {
  const p = PLUGINS.find((p) => p.id === "work-lifehub-notes")!;
  assert.equal(workInstalled(p, emptyWorkspace().visibleTabs), false);
  const on = setWorkNotesApp(undefined, p, true);
  assert.deepEqual(on, ["work-lifehub-notes"]);
  assert.equal(workInstalled(p, emptyWorkspace().visibleTabs, undefined, undefined, undefined, on), true);
  const off = setWorkNotesApp(on, p, false);
  assert.deepEqual(off, [], "removing un-installs it");
  assert.equal(workInstalled(p, emptyWorkspace().visibleTabs, undefined, undefined, undefined, off), false);
  // Adding a second, unrelated plugin's id first doesn't disturb this one.
  assert.deepEqual(setWorkNotesApp(["some-other-kit"], p, true), ["some-other-kit", "work-lifehub-notes"]);
});

test("installing a Notes app in LifeHub only touches family.notesInstalled, and keeps saved notes when removed", () => {
  const p = PLUGINS.find((p) => p.id === "life-work-notes")!;
  const family = emptyFamily();
  assert.equal(lifeInstalled(p, family, family.notesInstalled), false);
  const on = setLifeNotesApp(family.notesInstalled, p, true);
  assert.deepEqual(on, ["life-work-notes"]);
  assert.equal(lifeInstalled(p, family, on), true);
  const off = setLifeNotesApp(on, p, false);
  assert.deepEqual(off, []);
});

test("a Notes app's saved notes round-trip through cleanFamily untouched, separate from LifeHub's own notes", () => {
  const raw = {
    ...emptyFamily(),
    notesInstalled: ["life-work-notes"],
    notes: [{ id: "n1", title: "Built-in note", body: "lifehub's own", color: "#ffffff", pinned: false, updatedAt: "" }],
    notesApps: { "life-work-notes": [{ id: "n2", title: "Work thing", body: "separate app", color: "#ffffff", pinned: true, updatedAt: "" }] },
  };
  const clean = cleanFamily(raw);
  assert.deepEqual(clean.notesInstalled, ["life-work-notes"]);
  assert.equal(clean.notes.length, 1, "the built-in Notes list is untouched");
  assert.equal(clean.notes[0].title, "Built-in note");
  assert.equal(clean.notesApps["life-work-notes"]?.length, 1, "the installed app's own notes are kept, separately");
  assert.equal(clean.notesApps["life-work-notes"]![0].title, "Work thing");
  // A note with neither title nor body is dropped, same rule as the built-in Notes.
  const withBlank = cleanFamily({ ...raw, notesApps: { "life-work-notes": [...raw.notesApps["life-work-notes"], { id: "n3", title: "", body: "   ", color: "#ffffff", pinned: false, updatedAt: "" }] } });
  assert.equal(withBlank.notesApps["life-work-notes"]?.length, 1, "a blank note isn't kept");
});

test("notesAppPlugin only resolves a real notesApp target, in the right hub", () => {
  assert.equal(notesAppPlugin("work", "work-lifehub-notes")?.name, "LifeHub Notes");
  assert.equal(notesAppPlugin("life", "life-work-notes")?.name, "Work Notes");
  assert.equal(notesAppPlugin("life", "work-lifehub-notes"), undefined, "wrong hub");
  assert.equal(notesAppPlugin("work", "work-tasks"), undefined, "not a notesApp target");
  assert.equal(notesAppPlugin("work", "no-such-id"), undefined);
});

test("shared/notesApp.ts: saving, pinning and removing a note, and the list stays sane when loaded back", () => {
  let notes = saveNotesAppNote([], { id: "a", title: "First", body: "", color: "#fff7d6", pinned: false, updatedAt: "" });
  assert.equal(notes.length, 1);
  notes = saveNotesAppNote(notes, { id: "a", title: "First (edited)", body: "now with a body", color: "#fff7d6", pinned: false, updatedAt: "" });
  assert.equal(notes.length, 1, "saving the same id edits in place rather than duplicating");
  assert.equal(notes[0].title, "First (edited)");
  notes = pinNotesAppNote(notes, "a");
  assert.equal(notes[0].pinned, true);
  notes = pinNotesAppNote(notes, "a");
  assert.equal(notes[0].pinned, false, "pinning again unpins");
  notes = removeNotesAppNote(notes, "a");
  assert.equal(notes.length, 0);
  // cleanNotesApp drops a note with no id, or with neither title nor body, and clamps bad colors.
  const loaded = cleanNotesApp([
    { id: "b", title: "Keep me", body: "", color: "#not-a-real-color", pinned: true, updatedAt: "2026-01-01" },
    { id: "", title: "No id", body: "dropped" },
    { id: "c", title: "", body: "   " },
  ]);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "b");
  assert.match(loaded[0].color, /^#[0-9a-f]{6}$/i, "an unknown color falls back to a real one");
});

test("both hubs wire the Notes app into their menu, App Store and full-page view", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /notesApp=\{\{/, "WorkHub passes the notesApp prop to PluginStore");
  assert.match(hub, /setWorkNotesApp\(\(prev as any\)\.notesInstalled, p, on\)/);
  assert.match(hub, /<NotesKitApp key=\{notesAppOpen\}/);
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /notesApp=\{\{/, "LifeHub passes the notesApp prop to PluginStore");
  assert.match(life, /setLifeNotesApp\(f\.notesInstalled, p, on\)/);
  assert.match(life, /<NotesKitApp key=\{notesAppOpen\}/);
});
