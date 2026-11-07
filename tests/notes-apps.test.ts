// Apps for Arise Notes (November 2026): an App Gallery with Sticky Notes, Checklists, Whiteboard,
// A.R.I.S.E. Sheets, Slides and Docs, Flashcards and a Focus Timer. Added apps show on Home and in the
// Menu; what's in them is saved to the account. Run with: npx tsx --test tests/notes-apps.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const catalog = () => read("client/src/components/arise-notes/notesAppsCatalog.tsx");
const apps = () => read("client/src/components/arise-notes/NotesApps.tsx");

test("the App Gallery offers sticky notes, Sheets, Slides, Docs and more", () => {
  const c = catalog();
  for (const [id, name] of [["stickies", "Sticky Notes"], ["sheets", "A.R.I.S.E. Sheets"], ["slides", "A.R.I.S.E. Slides"], ["docs", "A.R.I.S.E. Docs"], ["flashcards", "Flashcards"], ["lists", "Checklists"], ["focus", "Focus Timer"], ["whiteboard", "Whiteboard"]]) {
    assert.match(c, new RegExp(`\\{ id: "${id}", name: "${name.replace(/\./g, "\\.")}"`), `${name} is in the gallery`);
  }
});

test("every app in the gallery opens to something", () => {
  const a = apps();
  for (const id of ["stickies", "lists", "whiteboard", "flashcards", "focus"]) assert.match(a, new RegExp(`app\\.id === "${id}" && <`), `${id} has a screen`);
  // Sheets, Slides and Docs are A.R.I.S.E. Office, whose files live in the account.
  assert.match(a, /<OfficeApp config=\{OFFICE_KINDS\[app\.id === "sheets" \? "sheet" : app\.id === "slides" \? "slides" : "doc"\]\} \/>/);
});

test("what's in the apps, and which apps you added, is saved to the account under ids the server accepts", () => {
  const ids = [...(catalog() + apps()).matchAll(/useAppData\("([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(ids)].sort(), ["notes-apps", "notes-flashcards", "notes-focus", "notes-lists", "notes-stickies", "notes-whiteboard"]);
  const ok = /^[a-z0-9-]{2,60}$/; // server/userDocs.ts isAppId
  for (const id of ids) assert.ok(ok.test(id), id);
  assert.match(read("server/userDocs.ts"), /const isAppId = \(v: unknown\): v is string => typeof v === "string" && \/\^\[a-z0-9-\]\{2,60\}\$\/\.test\(v\);/);
});

test("the gallery and each app have their own address in Notes, and Home and the Menu lead to them", () => {
  const n = read("client/src/components/arise-notes/NotesApp.tsx");
  assert.match(n, /case "apps": return \{ name: "apps" \};/);
  assert.match(n, /case "app": return p\[1\] \? \{ name: "app", id: p\[1\] \} : \{ name: "apps" \};/);
  assert.match(n, /r\.name === "app" \? `#\/app\/\$\{r\.id\}`/);
  assert.equal((n.match(/<AppsStrip ctx=\{ctx\} \/>/g) ?? []).length, 2, "both versions of Home show your apps");
  assert.match(read("client/src/components/arise-notes/SettingsScreen.tsx"), /<AppsGroup ctx=\{ctx\} \/>/);
});

test("making flashcards from a note uses the note's own study cards, and is part of the Basic plan and up", () => {
  const a = apps();
  assert.match(a, /const \{ study \} = await notesApi\.study\(n\.id\);/);
  assert.match(a, /<NotePicker locked=\{!ctx\.me\.features\.study\}/);
});
