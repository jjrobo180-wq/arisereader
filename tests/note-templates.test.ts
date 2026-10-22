import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTE_TEMPLATES, NOTE_TEMPLATE_CATEGORIES, fillTemplate, findTemplates } from "../shared/noteTemplates";

test("there's a template for almost everything, each with a unique id, in every category", () => {
  assert.ok(NOTE_TEMPLATES.length >= 45, `only ${NOTE_TEMPLATES.length}`);
  assert.equal(new Set(NOTE_TEMPLATES.map((t) => t.id)).size, NOTE_TEMPLATES.length);
  for (const c of NOTE_TEMPLATE_CATEGORIES) assert.ok(NOTE_TEMPLATES.some((t) => t.category === c), `${c} has none`);
  for (const id of ["meeting", "quick", "food-diary", "iep-meeting", "grocery", "packing", "budget", "sermon", "itinerary", "workout"]) {
    assert.ok(NOTE_TEMPLATES.some((t) => t.id === id), `missing ${id}`);
  }
});

test("every filled template fits in a note (title 120, body 5000) and has no leftover {placeholders}", () => {
  const day = new Date("2026-10-18T12:00:00");
  for (const t of NOTE_TEMPLATES) {
    const title = fillTemplate(t.title, day), body = fillTemplate(t.body, day);
    assert.ok(title.length <= 120, `${t.id} title`);
    assert.ok(body.length > 0 && body.length <= 5000, `${t.id} body`);
    assert.doesNotMatch(title + body, /\{[a-z]+\}/, `${t.id} still has a placeholder`);
    assert.ok(t.emoji && t.blurb && t.name, `${t.id} needs a name, emoji and blurb`);
  }
  assert.match(fillTemplate("Meeting — {date}", day), /Oct 18, 2026/);
});

test("search and categories find the right templates, and each hub sees its own first", () => {
  assert.ok(findTemplates({ query: "food" }).some((t) => t.id === "food-diary"));
  assert.ok(findTemplates({ query: "MEETING" }).some((t) => t.id === "meeting"));
  assert.ok(findTemplates({ category: "Money" }).every((t) => t.category === "Money"));
  assert.deepEqual(findTemplates({ query: "zzzz-nothing" }), []);
  assert.equal(findTemplates({ hub: "work" })[0].hub, "work");
  assert.equal(findTemplates({ hub: "life" })[0].hub, "life");
  assert.equal(findTemplates({ hub: "work" }).length, NOTE_TEMPLATES.length);
});

test("all three notes screens offer templates", () => {
  for (const file of ["../client/src/components/family-hub/Notes.tsx", "../client/src/components/plugin-kit/NotesKitApp.tsx", "../client/src/components/teacher-hub/HubNotes.tsx"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(src, /<NoteTemplatesButton/, file);
  }
});
