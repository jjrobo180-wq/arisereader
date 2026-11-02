import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

test("Pod+ without Membership: ads sat through are counted as time it could have saved, and shown", () => {
  const player = read("client/src/components/family-hub/earshot/EarshotPlayer.tsx");
  assert.match(player, /mode !== "auto" && delta > 0 && delta < 2[\s\S]{0,200}countCouldSave\(delta\)/);
  const extras = read("client/src/components/family-hub/earshot/listenExtras.ts");
  assert.match(extras, /const MISSED_KEY = "earshot\.couldSave"/);
  const card = read("client/src/components/family-hub/earshot/EarshotListen.tsx");
  assert.match(card, /of ads you could've skipped this week/);
  assert.match(card, /if \(notMember\) return <CouldSaveCard/);
  assert.match(read("podscroll/Home.tsx"), /<HoursBackCard light member=\{pro\} onJoin=\{onJoin\}/);
});

test("a new student's first password: the kept session is forgotten so the app moves on at once", () => {
  const storage = read("server/storage.ts");
  assert.match(storage, /async setPasswordAndClearMustChange[\s\S]{0,800}forgetUserSessions\(userId\)/);
  assert.match(storage, /export function forgetUserSessions\(userId: number\)/);
  const screen = read("client/src/components/ForcePasswordChange.tsx");
  assert.match(screen, /await refreshUser\(\);\n\s*setBusy\(false\);/);
  assert.match(screen, /AbortSignal\.timeout\(20_000\)/);
});
