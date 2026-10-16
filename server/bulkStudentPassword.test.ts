import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createVerifiedStudentTemporaryHash, verifyStudentTemporaryHash } from "./bulkStudentPassword";

test("new bulk-import accounts use a login-compatible bcrypt format", () => {
  for (const studentNumber of ["123456", "000057", "AA-12345"]) {
    const saved = createVerifiedStudentTemporaryHash(studentNumber);
    assert.equal(saved.slice(0, 4), "$2a$");
    assert.equal(saved.length, 60);
    assert.equal(bcrypt.compareSync(studentNumber, saved), true);
    assert.equal(verifyStudentTemporaryHash(studentNumber, saved), true);
    assert.equal(verifyStudentTemporaryHash("wrong" + studentNumber, saved), false);
  }
});

test("bad student-number inputs and absent hashes are rejected", () => {
  assert.throws(() => createVerifiedStudentTemporaryHash("1"), /2–40/);
  assert.throws(() => createVerifiedStudentTemporaryHash("1".repeat(41)), /2–40/);
  assert.equal(verifyStudentTemporaryHash("123456", null), false);
});
