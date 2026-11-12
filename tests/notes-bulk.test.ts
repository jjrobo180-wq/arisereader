import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync("client/src/components/arise-notes/pages/PagesView.tsx", "utf8");
const css = readFileSync("client/src/components/arise-notes/pages/pages-pro.css", "utf8");

test("Select mode picks many notes, then deletes, pins or moves them together", () => {
  assert.match(view, /data-testid="pages-select"/);
  assert.match(view, /data-testid="pages-select-all"/);
  for (const id of ["pages-bulk-delete", "pages-bulk-pin", "pages-bulk-move", "pages-bulk-restore", "pages-bulk-forever"]) assert.match(view, new RegExp(`data-testid="${id}"`), id);
  assert.match(view, /for \(const id of ids\) sync\.remove\(id\);/, "bulk delete goes to Recently Deleted");
  assert.match(view, /sync\.save\(\{ \.\.\.p, pinned: pin \}\)/);
  assert.match(view, /sync\.save\(\{ \.\.\.p, folderId \}\)/);
  assert.match(view, /e\?\.shiftKey && lastPick\.current/, "Shift picks a run of notes");
  assert.match(view, /e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey\)\) \{ startWith\(m\.id\)/, "⌘/Ctrl/Shift-click starts selecting");
  assert.match(view, /e\.key === "Escape"/);
});

test("single notes: one-click Pin, Move and Delete on hover, and a right-click menu", () => {
  assert.match(view, /data-testid="pages-quick-actions"/);
  assert.match(view, /data-testid="pages-quick-delete"/);
  assert.match(view, /onContextMenu=\{context\}/);
  assert.match(view, /data-testid="pages-menu"/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{ \.pp-li:hover \.pp-quickacts/, "hover actions only with a mouse; phones keep swipe");
});

test("Move to folder lists every folder, No folder, and can make a new folder and move into it", () => {
  assert.match(view, /data-testid="pages-move-list"/);
  assert.match(view, /No folder \(All notes\)/);
  assert.match(view, /data-testid="pages-move-new-folder"/);
  assert.match(view, /if \(moveAfterFolder\) \{/);
});
