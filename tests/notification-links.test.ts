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
