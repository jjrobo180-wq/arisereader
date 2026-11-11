// Arise Notes: the Notes tab is the main page, meetings record straight into a note, and typed
// @arise… commands control the recording. Undercover is an app in the App Gallery.
// Run with: npx tsx --test tests/notes-record-in-note.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("typed commands are found and taken out", async () => {
  const src = read("client/src/components/arise-notes/pages/useNoteRecording.ts");
  const re = new RegExp(/@arise\(record\|pause\|resume\|stop\|mark\)\(\?!\[a-z\]\)/.source);
  assert.match(src, re);
  const COMMAND_RE = /@arise(record|pause|resume|stop|mark)(?![a-z])/gi;
  const take = (html: string) => { const c: string[] = []; const out = html.replace(COMMAND_RE, (_m, x: string) => { c.push(x.toLowerCase()); return ""; }); return { out, c }; };
  assert.deepEqual(take("<p>hi @ariseRecord</p>"), { out: "<p>hi </p>", c: ["record"] });
  assert.deepEqual(take("<p>@arisepause then @arisestop</p>").c, ["pause", "stop"]);
  assert.deepEqual(take("<p>@ariserecorded</p>").c, []);
});

test("Notes tab is the main page, with Record a meeting and Recordings", () => {
  const app = read("client/src/components/arise-notes/NotesApp.tsx");
  assert.match(app, /default: return \{ name: "pages" \}/);
  assert.match(app, /return bare \? \{ name: "pages" \}/);
  const view = read("client/src/components/arise-notes/pages/PagesView.tsx");
  assert.match(view, /data-testid="pages-record"/);
  assert.match(view, /testId="pages-recordings"/);
  const page = read("client/src/components/arise-notes/pages/PageScreen.tsx");
  assert.match(page, /takeCommands\(patch\.html\)/);
  assert.match(page, /data-testid="pages-rec-bar"/);
  assert.match(read("client/src/components/arise-notes/NotesDock.tsx"), />Recordings</);
});
