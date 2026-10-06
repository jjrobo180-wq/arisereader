import test from "node:test";
import assert from "node:assert/strict";
import { isSampleAccount, isSampleDisplayName, isSampleUsername } from "../shared/sampleAccounts";

test("sign-in names starting with 'sample' are sample accounts", () => {
  for (const u of ["sample", "Sample", "sample-eye", "sample-parent", "sample2", "SAMPLE_kid", "tutorial-eye"]) assert.equal(isSampleUsername(u), true, u);
  for (const u of ["samuel", "2jermainerobinson", "ample", "mysample", ""]) assert.equal(isSampleUsername(u), false, u);
});

test("display names starting with the word 'Sample' are sample accounts", () => {
  for (const n of ["Sample Student", "Sample User", "sample", " Sample", "Sample-1", "Sample2"]) assert.equal(isSampleDisplayName(n), true, n);
  for (const n of ["Samuel Ortiz", "Samples", "Sampler", "A Sample", "", null]) assert.equal(isSampleDisplayName(n), false, String(n));
});

test("either name makes an account a sample, in either field spelling", () => {
  assert.equal(isSampleAccount({ username: "2jermainerobinson", display_name: "Sample User" }), true);
  assert.equal(isSampleAccount({ username: "sample", displayName: "Sample Student" }), true);
  assert.equal(isSampleAccount({ username: "maya22", displayName: "Maya" }), false);
  assert.equal(isSampleAccount(null), false);
});
