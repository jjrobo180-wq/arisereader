import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("WorkHub opens Arise Notes (and premium apps) inside the hub with the menu beside it, in To Do's look", () => {
  const hub = read("../client/src/pages/TeacherHub.tsx");
  assert.ok(hub.includes('data-testid="hub-in-app-view"') && hub.includes("<NotesInWork "));
  // The desktop menu, the phone menu and the Plugin Gallery all open it in the hub.
  assert.equal((hub.match(/inHubOf\((a|p)\.target\.href\)/g) || []).length, 3);
  assert.ok(hub.includes('kitOpen.startsWith("in:")'), "the rest of the page hides while it's open, like a plugin");
  const notes = read("../client/src/components/super-apps/NotesInWork.tsx");
  assert.ok(notes.includes('<NotesApp mode="embedded" hub="work" duo={duo} />') && notes.includes('import "./notes-duo.css"'));
});
