// November 2026: Arise Notes uses Arise To Duo's floating bottom bar in every look, its menu is calmer, and the
// readability check that froze scrolling in the hubs only runs when the page is still, in idle time, on what's on screen.
// Run with: npx tsx --test tests/notes-dock-and-guard.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Notes' bar is To Duo's floating pill with a + menu, in every look", () => {
  const app = read("client/src/components/arise-notes/NotesApp.tsx");
  assert.match(app, /return <NotesDock on=\{on\}/);
  assert.doesNotMatch(app, /LookTabBar/);
  const dock = read("client/src/components/arise-notes/NotesDock.tsx");
  assert.match(dock, /rounded-full bg-\[#1d1a33\]/);
  for (const id of ["notes-tab-ai", "notes-tab-pages", "notes-tab-record", "notes-tab-ask", "notes-tab-menu"]) assert.match(dock, new RegExp(id));
  assert.match(read("client/src/components/arise-notes/SettingsScreen.tsx"), /<TabBar ctx=\{ctx\} on="menu" \/>/);
});

test("the readability check never runs while scrolling, waits two seconds between runs, and checks only what's on screen", () => {
  const g = read("client/src/lib/contrastGuard.ts");
  assert.match(g, /now - lastScroll < 450 \|\| now - lastRun < 2000/);
  assert.match(g, /requestIdleCallback/);
  assert.match(g, /onScreenOnly && \(r\.bottom < -window\.innerHeight/);
  assert.match(g, /const blendCache = new WeakMap/);
});

test("Notes' apps are minimal: thin line icons in the look's color, hairline rows, no colored squares or big banner", () => {
  const cat = read("client/src/components/arise-notes/notesAppsCatalog.tsx");
  assert.match(cat, /color: "var\(--an-violet\)" \}\}>\{app\.icon\}/);
  assert.doesNotMatch(cat, /linear-gradient/);
  const all = read("client/src/components/arise-notes/NotesApps.tsx");
  const gallery = all.slice(all.indexOf("export function AppsScreen"), all.indexOf("// ─── One app ───"));
  assert.doesNotMatch(gallery, /Apps for your notes|na-hero/);
  assert.match(gallery, /border-b border-\[var\(--an-line\)\]/);
});
