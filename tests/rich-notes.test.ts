import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanNoteHtml, noteStartHtml, noteTextOf, textToNoteHtml, NOTE_HTML_MAX } from "../shared/richNote";
import { cleanFamily } from "../shared/familyHub";
import { cleanNotesApp, saveNotesAppNote } from "../shared/notesApp";
import { cleanNote, noteFields } from "../shared/hubNotes";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("formatted notes keep fonts, colours, headings and checklists, and drop anything unsafe or pictures", () => {
  const html = cleanNoteHtml(`<h2>Trip</h2><p><span style="font-family: Georgia; color: #dc2626">Pack</span> <b>now</b></p><ul data-check=""><li data-checked="true">Hats</li></ul><img src="data:image/png;base64,AAAA"><script>alert(1)</script><p onclick="x()">ok</p>`);
  assert.match(html, /<h2>Trip<\/h2>/);
  assert.match(html, /font-family: Georgia/);
  assert.match(html, /data-checked="true"/);
  assert.doesNotMatch(html, /<img|script|onclick/);
  assert.equal(cleanNoteHtml("<p><br></p>"), "");
  assert.equal(cleanNoteHtml("<p>" + "a".repeat(NOTE_HTML_MAX) + "</p>"), "");
  assert.equal(noteTextOf("<h2>Trip</h2><p>Pack <b>now</b></p>"), "Trip\nPack now");
});

test("older plain notes and templates open in the editor line by line", () => {
  assert.equal(textToNoteHtml("Wi-Fi: Home\n\nCode <4821>"), "<p>Wi-Fi: Home</p><p><br></p><p>Code &lt;4821&gt;</p>");
  assert.equal(noteStartHtml({ body: "Hi" }), "<p>Hi</p>");
  assert.equal(noteStartHtml({ body: "Hi", html: "<p><b>Hi</b></p>" }), "<p><b>Hi</b></p>");
});

test("LifeHub, Notes app installs and WorkHub notes all save the formatted version next to the plain text", () => {
  const f = cleanFamily({ notes: [{ id: "n1", title: "A", body: "Pack now", html: "<p>Pack <b>now</b></p>", color: "#fef3c7" }], notesApps: { "notes-app": [{ id: "k1", title: "B", body: "x", html: "<p><i>x</i></p><script>bad()</script>" }] } } as any);
  assert.equal(f.notes[0].html, "<p>Pack <b>now</b></p>");
  assert.equal(f.notesApps["notes-app"][0].html, "<p><i>x</i></p>");
  const kit = saveNotesAppNote(cleanNotesApp([]), { id: "k2", title: "C", body: "y", html: "<p><u>y</u></p>", color: "#fef3c7", pinned: false, updatedAt: "" });
  assert.equal(kit[0].html, "<p><u>y</u></p>");
  const work = cleanNote({ scope: "general", student: "", type: "Staff meeting", title: "PLC", date: "2026-10-18", body: "Agenda", html: "<h2>Agenda</h2>" });
  assert.equal(work?.html, "<h2>Agenda</h2>");
  assert.equal(noteFields({ id: "w", ...work! }).html, "<h2>Agenda</h2>");
  // Removing the formatting removes it from the saved note too.
  assert.equal(cleanNote({ scope: "general", student: "", type: "Staff meeting", title: "", date: "", body: "Agenda" })?.html, undefined);
});

test("notes open full screen with the Docs-style toolbar in every hub", () => {
  const full = src("client/src/components/notes/FullNoteEditor.tsx");
  assert.match(full, /className="fixed inset-0 z-\[700\] flex flex-col"/);
  assert.match(full, /createPortal\(/);
  const rich = src("client/src/components/notes/useRichEditor.tsx");
  for (const t of ["Paragraph style", "Font", "Text size", "Bold", "Italic", "Underline", "Text color", "Highlight", "Checklist", "Numbered list", "Align center", "Link"]) assert.ok(rich.includes(`title="${t}"`), t);
  assert.match(src("client/src/components/family-hub/Notes.tsx"), /<FullNoteEditor note=\{editing\}/);
  assert.match(src("client/src/components/plugin-kit/NotesKitApp.tsx"), /<FullNoteEditor note=\{editing\}/);
  const hub = src("client/src/components/teacher-hub/HubNotes.tsx");
  // One full-screen note for new and saved notes alike; it saves as you type, Done closes it.
  assert.match(hub, /: "New note"\} size="full" onClose=\{done\}/);
  assert.match(hub, /\{adding && <NoteModal key=\{adding\} start=\{form\}/);
  assert.match(hub, /<RichNoteBox form=\{form\}/);
});
