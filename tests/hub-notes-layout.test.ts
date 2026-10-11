// WorkHub Notes tab: the layout cleanup. Adding a note now happens in a pop-up opened from a
// small header button (matching how every other WorkHub tab adds things), instead of a large,
// always-visible form that used to push the actual notes list down the page. The notes list is
// the first thing shown, and its filter chips + search toolbar is unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("adding a note opens a pop-up from a compact header button, not an always-visible form", () => {
  const notes = read("client/src/components/teacher-hub/HubNotes.tsx");
  // A small header with a title and an "Add note" button, in the same style as AddCard elsewhere in the hub.
  assert.match(notes, /data-testid="add-card-add-note"/);
  assert.match(notes, /<Plus className="h-4 w-4" \/> Add note/);
  // The old always-visible "Add a note" Card wrapping the form directly in the page is gone...
  assert.ok(!notes.includes('<Card title="Add a note">'), "the form is no longer an always-visible card");
  // ...replaced by a HubModal that only renders once the button has been clicked.
  assert.match(notes, /\{adding && \(\s*<HubModal title="New note" size="lg"/);
  assert.match(notes, /data-testid="note-add"/, "the same note-entry form is reused inside the pop-up");
});

test("the notes list is the first thing on the page, with its filter chips and search intact", () => {
  const notes = read("client/src/components/teacher-hub/HubNotes.tsx");
  // The list card comes right after the compact header, with no big form Card between them.
  const header = notes.indexOf('data-testid="add-card-add-note"');
  const list = notes.indexOf("<Card>");
  assert.ok(header > -1 && list > header, "the notes list card follows directly after the add-note header");
  for (const part of ["Students <span", "Meetings &amp; general <span", "Search notes"]) assert.ok(notes.includes(part), part);
  // Submitting the pop-up's form, or cancelling it, both close it again.
  assert.match(notes, /setAdding\(false\)/);
});

test("the note-entry form itself (fields, validation, save) is unchanged by the layout cleanup", () => {
  const notes = read("client/src/components/teacher-hub/HubNotes.tsx");
  for (const part of ['data-testid="note-scope"', '"Meeting or general"', 'data-testid="note-edit"', "Meetings &amp; general"]) assert.ok(notes.includes(part), part);
  // Saving still goes through the same saveNote helper and clears the form back to a blank student note.
  assert.match(notes, /setWorkspace\(\(p\) => saveNote\(p, null, form, makeId\)\)/);
});
