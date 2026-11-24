import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../shared/plans.ts";
import { readFileSync } from "node:fs";

test("Arise To Duo WorkHub: $2,000 a school, $10,000 a district", () => {
  assert.equal(PLANS.hub.schoolYearlyCents, 200000);
  assert.equal(PLANS.hub.districtYearlyCents, 1000000);
  assert.equal(PLANS.hub.districtStudentCap, 8000);
});

test("the district price is shown on the billing and hub pages", () => {
  for (const f of ["client/src/pages/Billing.tsx", "client/src/pages/TeacherHub.tsx"]) {
    assert.match(readFileSync(f, "utf8"), /H\.districtYearlyCents/);
  }
});
