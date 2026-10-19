import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanShortcut, shortcutTarget, shortcutUrl } from "../shared/hubShortcut";
import { cleanLayout } from "../shared/hubLayout";
import { cleanLifeLayout } from "../shared/lifeLayout";
import { cleanFamily } from "../shared/familyHub";
import { normalizeWorkspace } from "../shared/teacherHub";

test("a web address is made safe: https added to a bare address, anything else refused", () => {
  assert.equal(shortcutUrl("classroom.google.com"), "https://classroom.google.com/");
  assert.equal(shortcutUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(shortcutUrl("javascript:alert(1)"), "");
  assert.equal(shortcutUrl("not a link"), "");
  assert.equal(shortcutUrl(""), "");
});

test("saved shortcuts are cleaned, and junk is dropped rather than kept", () => {
  assert.deepEqual(cleanShortcut({ kind: "open", id: "calendar", label: "Calendar" }), { kind: "open", id: "calendar", label: "Calendar" });
  assert.deepEqual(cleanShortcut({ kind: "open", id: "tab:lessons" }), { kind: "open", id: "tab:lessons", label: "tab:lessons" });
  assert.deepEqual(cleanShortcut({ kind: "url", url: "docs.google.com" }), { kind: "url", url: "https://docs.google.com/", label: "docs.google.com" });
  assert.equal(cleanShortcut({ kind: "open", id: "<script>" }), undefined);
  assert.equal(cleanShortcut({ kind: "url", url: "javascript:alert(1)" }), undefined);
  assert.equal(cleanShortcut({ kind: "nope" }), undefined);
  assert.equal(cleanShortcut(null), undefined);
});

test("the button opens the menu item if it still exists, a website, or the chooser", () => {
  const items = [{ id: "calendar" }, { id: "notes" }];
  assert.deepEqual(shortcutTarget({ kind: "open", id: "notes", label: "Notes" }, items), { item: { id: "notes" } });
  assert.equal(shortcutTarget({ kind: "open", id: "gone", label: "Gone" }, items), null);
  assert.deepEqual(shortcutTarget({ kind: "url", url: "https://a.com/", label: "a" }, items), { url: "https://a.com/" });
  assert.equal(shortcutTarget(undefined, items), null);
});

test("the shortcut survives both hubs' save and load, and is absent until chosen", () => {
  const sc = { kind: "open", id: "calendar", label: "Calendar" } as const;
  assert.deepEqual(cleanLayout({ shortcut: sc }).shortcut, sc);
  assert.deepEqual(cleanLifeLayout({ shortcut: sc }).shortcut, sc);
  assert.equal("shortcut" in cleanLayout({}), false);
  assert.deepEqual(cleanFamily({ layout: { shortcut: sc } }).layout?.shortcut, sc);
  assert.deepEqual(normalizeWorkspace({ layout: { shortcut: { kind: "url", url: "https://a.com/", label: "A" } } }).layout?.shortcut, { kind: "url", url: "https://a.com/", label: "A" });
});

test("changing the shortcut never re-cleans the layout (which would drop pinned apps)", () => {
  for (const file of ["../client/src/pages/AriseTodo.tsx", "../client/src/pages/TeacherHub.tsx"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    const line = src.split("\n").find((l) => l.includes("const { shortcut: _old, ...rest }"));
    assert.ok(line, `${file} sets the shortcut`);
    assert.doesNotMatch(line!, /clean(Life)?Layout\(/, `${file} must not re-clean the layout when saving the shortcut`);
  }
});
