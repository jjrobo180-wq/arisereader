import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appLocked, checkPasscode, cleanLock, makeLock, toggleApp, validPasscode } from "../shared/privacyLock";
import { cleanFamily } from "../shared/familyHub";
import { normalizeWorkspace } from "../shared/teacherHub";
import { cleanNote, noteFields } from "../shared/hubNotes";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("a passcode is kept only as a salted hash and checks right", async () => {
  const lock = await makeLock("4821", ["money"]);
  assert.equal(lock.digits, 4);
  assert.ok(!JSON.stringify(lock).includes("4821"));
  assert.equal(await checkPasscode(lock, "4821"), true);
  assert.equal(await checkPasscode(lock, "4822"), false);
  assert.equal(await checkPasscode(lock, "48211"), false);
  const again = await makeLock("4821");
  assert.notEqual(again.salt, lock.salt);
  assert.equal(validPasscode("123"), false);
  assert.equal(validPasscode("123456789"), false);
  await assert.rejects(makeLock("12ab"));
});

test("locking apps on and off", async () => {
  const lock = await makeLock("123456");
  const on = toggleApp(lock, "journal");
  assert.equal(appLocked(on, "journal"), true);
  assert.equal(appLocked(toggleApp(on, "journal"), "journal"), false);
  assert.equal(appLocked(null, "journal"), false);
});

test("saved locks survive cleaning; damaged ones are dropped", async () => {
  const lock = await makeLock("2468", ["medical", "money"]);
  assert.deepEqual(cleanLock(JSON.parse(JSON.stringify(lock))), lock);
  assert.equal(cleanLock({ ...lock, digits: 3 }), null);
  assert.equal(cleanLock({ ...lock, hash: "<script>" }), null);
  assert.equal(cleanLock("nope"), null);
});

test("LifeHub keeps the lock and locked notes", async () => {
  const lock = await makeLock("2468", ["money"]);
  const f = cleanFamily({ lock, notes: [{ id: "n1", title: "Bank", body: "PIN stuff", color: "#fff7d6", pinned: false, updatedAt: "", locked: true }, { id: "n2", title: "Open", body: "hi", color: "#fff7d6", pinned: false, updatedAt: "", locked: "yes" }] });
  assert.deepEqual(f.lock, lock);
  assert.equal(f.notes.find((n) => n.id === "n1")?.locked, true);
  assert.equal(f.notes.find((n) => n.id === "n2")?.locked, undefined);
  assert.equal(cleanFamily({}).lock, null);
});

test("WorkHub keeps the lock and locked notes", async () => {
  const lock = await makeLock("135790", ["notes"]);
  assert.deepEqual(normalizeWorkspace({ lock }).lock, lock);
  assert.equal(normalizeWorkspace({ lock: { bad: 1 } }).lock, null);
  const saved = cleanNote({ scope: "general", student: "", type: "Staff meeting", title: "Private", date: "", body: "x", locked: true });
  assert.equal(saved?.locked, true);
  assert.equal(noteFields({ id: "a", ...saved! }).locked, true);
});

test("both hubs wrap their screens in the lock and offer Passcode & locks", () => {
  for (const page of ["../client/src/pages/AriseTodo.tsx", "../client/src/pages/TeacherHub.tsx"]) {
    const src = read(page);
    assert.match(src, /<PrivacyLockProvider lock=/);
    assert.match(src, /<LockedApp locked=\{/);
    assert.match(src, /title: "Passcode & locks"/);
    assert.match(src, /<LockButton/);
  }
});

test("WorkHub notes save as you type: no Save or Add note button in the note", () => {
  const src = read("../client/src/components/teacher-hub/HubNotes.tsx");
  assert.doesNotMatch(src, /Save note|Save changes|> Add note<\/PrimaryButton>/);
  assert.match(src, /timer\.current = window\.setTimeout\(flush, 700\)/);
  assert.match(src, /useEffect\(\(\) => \(\) => \{ if \(timer\.current\) flushRef\.current\(\); \}, \[\]\)/);
});
