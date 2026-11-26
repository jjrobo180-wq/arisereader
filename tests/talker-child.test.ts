// Arise AAC pages (Shorts, My World, Flash Cards, the talker...) open for whoever is signed in:
// a child, a parent's linked child, or anyone else as themselves (server/talkerChild.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseTalkerChild } from "../server/talkerChild";

test("a child uses their own, a parent their linked child, anyone else themselves", () => {
  assert.deepEqual(chooseTalkerChild({ id: 5, role: "student", is_eye_gaze_user: true }, false, [], null), { kind: "self" });
  const parent = { id: 9, role: "parent" };
  assert.deepEqual(chooseTalkerChild(parent, false, [{ id: 3, eyeGaze: false }, { id: 4, eyeGaze: true }], null), { kind: "child", id: 4 });
  assert.deepEqual(chooseTalkerChild(parent, false, [{ id: 4, eyeGaze: true }], 4), { kind: "child", id: 4 });
  assert.deepEqual(chooseTalkerChild(parent, false, [{ id: 4, eyeGaze: true }], 77), { kind: "none" }, "never a child that isn't theirs");
  assert.deepEqual(chooseTalkerChild(parent, false, [], null), { kind: "self" }, "a parent with no child linked yet");
  assert.deepEqual(chooseTalkerChild({ id: 1, role: "student", is_eye_gaze_user: false }, true, [], null), { kind: "self" }, "the site owner in a preview");
  assert.deepEqual(chooseTalkerChild({ id: 2, role: "todo" }, false, [], null), { kind: "self" }, "a To Do account");
});

test("every Arise AAC page uses it", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(routes, /const choice = chooseTalkerChild\(req\.user, !!req\.realUser\?\.isAdmin, linked, requestedParentStudentId\(req\)\)/);
});
