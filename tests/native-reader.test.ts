import test from "node:test";
import assert from "node:assert/strict";
import { nativeAppFor } from "../client/src/lib/nativeApp";

test("Reader build identity applies only inside the native app", () => {
  assert.equal(nativeAppFor("capacitor:", "reader"), "reader");
  assert.equal(nativeAppFor("https:", "reader"), null);
  assert.equal(nativeAppFor("https:"), null);
});
test("Existing To-Do native builds keep their identity", () => {
  assert.equal(nativeAppFor("capacitor:"), "todo");
  assert.equal(nativeAppFor("capacitor:", "todo"), "todo");
});
