// Arise All Access: the price people see (shared/allAccess.ts) is the price charged (shared/plans.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { ALL_ACCESS } from "../shared/allAccess";
import { PLANS, priceOf } from "../shared/plans";

test("the All Access price shown in the apps is the one Stripe charges", () => {
  assert.equal(ALL_ACCESS.price, `$${PLANS.allAccess.monthlyCents / 100}`);
  assert.equal(priceOf("all_access").interval, "month");
  assert.match(ALL_ACCESS.url, /^https:\/\/arisetodo\.com\/app#\/all-access$/);
});
