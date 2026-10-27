// Pod+ account passwords: hashed with a salt, checked in constant time, never stored as typed.
import test from "node:test";
import assert from "node:assert/strict";
import { checkPassword, hashPassword } from "../server/podcastAccounts";

test("passwords: salted hashes that check the right password only", () => {
  const a = hashPassword("correct horse battery"), b = hashPassword("correct horse battery");
  assert.match(a, /^s1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b, "a fresh salt every time");
  assert.ok(!a.includes("correct horse"), "never the password itself");
  assert.equal(checkPassword("correct horse battery", a), true);
  assert.equal(checkPassword("correct horse batterY", a), false);
  assert.equal(checkPassword("anything", null), false);
  assert.equal(checkPassword("anything", "garbage"), false);
});
