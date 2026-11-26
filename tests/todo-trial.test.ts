// To Do has one subscription (Arise All Access) with a 3-day free trial when it's bought in the iPhone
// app (App Store Connect's introductory offer). The website's pricing shows that one subscription.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

test("the store plugin reports the free trial and whether this Apple ID can still have it", () => {
  const swift = read("native/arise-store/ios/Sources/AriseStorePlugin/AriseStorePlugin.swift");
  assert.match(swift, /introductoryOffer/);
  assert.match(swift, /paymentMode == \.freeTrial/);
  assert.match(swift, /isEligibleForIntroOffer/);
  assert.match(swift, /"trialDays": trialDays, "trialEligible": trialEligible/);
});

test("the trial only counts when this Apple ID is eligible", () => {
  const lib = read("client/src/lib/appleStore.ts");
  assert.match(lib, /trialDays: p\.trialEligible === true \? days : 0/);
});

test("the paywall offers the trial and says what it costs after", () => {
  const offer = read("client/src/components/AllAccessOffer.tsx");
  assert.match(offer, /Start \$\{trialDays\}-day free trial/);
  assert.match(offer, /Free for \{trialDays\} days, then \{applePrice\} a month/);
  assert.match(offer, /cancel before the trial ends and you won't be charged/);
});

test("arisetodo.com pricing shows the one subscription and the trial", () => {
  // The full To Do pricing lives on the iPhone Duo page now; the home page is for teachers, schools and parents.
  const html = read("client/public/iphone-duo/index.html");
  assert.match(html, /The one Arise To Do subscription/);
  assert.match(html, /data-testid="pricing-trial"><strong>3-day free trial<\/strong> when you subscribe in the Arise To Do iPhone app/);
  assert.match(html, /One subscription, \$10\./);
});
