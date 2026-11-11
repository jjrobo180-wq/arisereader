// Tapping a notification on the iPhone opens the screen it's about, not "We can't find that page".
// Run with: npx tsx --test tests/notification-links.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { notificationHash } from "../client/src/lib/nativeApp";

test("links become the right hash", () => {
  assert.equal(notificationHash("/#/lifehub?go=tasks&view=today"), "/lifehub?go=tasks&view=today");
  assert.equal(notificationHash("#/lifehub"), "/lifehub");
  assert.equal(notificationHash("/lifehub"), "/lifehub");
  assert.equal(notificationHash("https://example.com"), null);
});

import fs from "node:fs";
import { dueTodoReminders, goUrl } from "../shared/todoReminders";
import { dosesOn } from "../shared/pills";

test("a pill reminder opens Pills, and the link becomes the right hash", () => {
  const ws = { family: { sections: { pills: true }, pills: [{ id: "p1", name: "Vitamin D", dose: "1 tablet", memberId: "m1", times: ["09:00"], days: [0, 1, 2, 3, 4, 5, 6], active: true, start: "", end: "", supply: 30, perDose: 1, refillAt: 5, notes: "" }], pillDoses: [] }, tasks: [] };
  const now = Date.parse("2026-11-09T16:02:00Z"); // 9:02 AM in Denver
  const due = dueTodoReminders(ws, now, "America/Denver", {});
  const pill = due.find((r) => r.key.startsWith("todo:pill:"));
  assert.ok(pill, `a pill reminder should be due, got: ${JSON.stringify(due.map((r) => r.key))}; doses: ${JSON.stringify(ws.family)}`);
  assert.equal(pill!.url, goUrl("pills"));
  assert.equal(notificationHash(pill!.url), "/lifehub?go=pills");
});

test("every LifeHub reminder link names a screen the hub can open", () => {
  const src = fs.readFileSync("shared/todoReminders.ts", "utf8");
  const urls = [...src.matchAll(/url: ([^,}]+)[,}]/g)].map((m) => m[1].trim());
  assert.ok(urls.length > 10);
  for (const u of urls) assert.match(u, /^goUrl\(|TODO_REMINDER_URL|url$|^r\.url/, `reminder link without a screen: ${u}`);
});

test("a tapped reminder closes whatever is open on top of the screen", () => {
  const hub = fs.readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  const fn = /const dismissOverlays = \(\) => \{([\s\S]*?)\n  \};/.exec(hub)?.[1] || "";
  for (const part of ["closeApps()", "setEditing(null)", "setOpenTaskId(null)", "reopened.current = true", "setStore(false)", "setCustomizing(false)", "setSearching(false)"]) assert.ok(fn.includes(part), `dismissOverlays should ${part}`);
  const go = /\(FAMILY_SECTIONS as readonly string\[\]\)\.includes\(go\)\) \{\s*dismissOverlays\(\)/.test(hub);
  assert.ok(go, "the go= handler should call dismissOverlays first");
  assert.match(hub, /dismissOverlays\(\);\s*setSection\("lifeplan"\)/);
});

test("the test notification looks like a pill reminder and opens Pills", () => {
  const nr = fs.readFileSync("client/src/lib/nativeReminders.ts", "utf8");
  assert.match(nr, /url: goUrl\("pills"\)/);
  assert.match(nr, /extra: \{ url: TEST_REMINDER\.url \}/);
  assert.match(fs.readFileSync("server/pushNotifications.ts", "utf8"), /Test reminder[^}]*url: goUrl\("pills"\), tag: "todo-test"/);
});
