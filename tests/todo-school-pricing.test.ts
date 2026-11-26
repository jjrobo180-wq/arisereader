import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../shared/plans.ts";
import { readFileSync } from "node:fs";

test("Arise To Do WorkHub: $2,000 a school, $10,000 a district", () => {
  assert.equal(PLANS.hub.schoolYearlyCents, 200000);
  assert.equal(PLANS.hub.districtYearlyCents, 1000000);
  assert.equal(PLANS.hub.districtStudentCap, 8000);
});

test("the district price is shown on the billing and hub pages", () => {
  for (const f of ["client/src/pages/Billing.tsx", "client/src/pages/TeacherHub.tsx"]) {
    assert.match(readFileSync(f, "utf8"), /H\.districtYearlyCents/);
  }
});

test("the To Do website's Pricing section shows the school and district prices", () => {
  const home = readFileSync("client/public/educator.html", "utf8");
  const pricing = home.slice(home.indexOf('id="pricing"'), home.indexOf('id="faq"'));
  assert.match(pricing, /\$2,000 <span>\/ year/);
  assert.match(pricing, /\$10,000 <span>\/ year/);
});

test("arisetodo.com uses the Arise Reader look", () => {
  const home = readFileSync("client/public/educator.html", "utf8");
  assert.match(home, /<style id="reader-theme">/);
  assert.match(home, /Plus\+Jakarta\+Sans/);
  assert.doesNotMatch(home, /Manrope/);
  assert.match(home, /--purple:#5b53df/);
});
