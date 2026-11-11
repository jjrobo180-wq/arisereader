import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_DONATE_URL, SUPPORT_BANNER_SNOOZE_DAYS, donateInfoFrom, isDonateUrl, isStripeUrl, supportBannerVisible } from "../shared/donate";

test("only real https links count, so a saved value can never become a script link", () => {
  assert.equal(isDonateUrl("https://donate.stripe.com/abc123"), true);
  assert.equal(isDonateUrl("https://buy.stripe.com/x"), true);
  assert.equal(isDonateUrl("http://donate.stripe.com/abc"), false);
  assert.equal(isDonateUrl("javascript:alert(1)"), false);
  assert.equal(isDonateUrl(""), false);
  assert.equal(isDonateUrl("donate.stripe.com/abc"), false);
  assert.equal(isDonateUrl(42), false);
  assert.equal(isStripeUrl("https://donate.stripe.com/abc"), true);
  assert.equal(isStripeUrl("https://paypal.me/someone"), false);
  assert.equal(isStripeUrl("https://notstripe.com/abc"), false);
});

test("the link shows even when the library's goal bar is switched off", () => {
  const off = donateInfoFrom(JSON.stringify({ donateUrl: "https://donate.stripe.com/abc", active: false, goalAmount: 1000, currentAmount: 200 }));
  assert.deepEqual(off, { url: "https://donate.stripe.com/abc", stripe: true, goal: null });
  const on = donateInfoFrom({ donateUrl: " https://donate.stripe.com/abc ", active: true, goalAmount: 1000, currentAmount: 250 });
  assert.deepEqual(on?.goal, { raised: 250, target: 1000 });
  assert.equal(on?.url, "https://donate.stripe.com/abc");
});

test("nothing saved, a bad link or broken JSON falls back to Mr. J's Stripe link", () => {
  for (const raw of [null, "", "{not json", { donateUrl: "", active: true }, { donateUrl: "javascript:alert(1)" }]) {
    assert.deepEqual(donateInfoFrom(raw), { url: DEFAULT_DONATE_URL, stripe: true, goal: null });
  }
  assert.equal(DEFAULT_DONATE_URL, "https://buy.stripe.com/7sY6oHbUD7qrfwf3UFcIE04");
  // With no usable link at all, there is no button.
  assert.equal(donateInfoFrom(null, ""), null);
});

test("closing the Home banner hides it for a month, then it comes back", () => {
  const closed = "2026-10-01T12:00:00.000Z";
  const day = 24 * 3600 * 1000;
  assert.equal(supportBannerVisible(null, Date.now()), true);
  assert.equal(supportBannerVisible("garbage", Date.now()), true);
  assert.equal(supportBannerVisible(closed, Date.parse(closed) + 5 * day), false);
  assert.equal(supportBannerVisible(closed, Date.parse(closed) + (SUPPORT_BANNER_SNOOZE_DAYS - 1) * day), false);
  assert.equal(supportBannerVisible(closed, Date.parse(closed) + SUPPORT_BANNER_SNOOZE_DAYS * day), true);
});

test("donations are off across the site (November 2026)", () => {
  const support = readFileSync(new URL("../client/src/components/SupportArise.tsx", import.meta.url), "utf8");
  for (const fn of ["SupportButton", "SupportBanner", "SupportMenuItem"]) assert.match(support.slice(support.indexOf(`export function ${fn}`)), /^[^\n]*\n  return null;/, fn);
  assert.match(readFileSync(new URL("../client/src/components/DonationGoal.tsx", import.meta.url), "utf8"), /export default function DonationGoal\(\)[^{]*\{\n  return null;/);
  const landing = readFileSync(new URL("../client/public/reader-landing.html", import.meta.url), "utf8");
  for (const piece of ['class="topbar support-strip"', 'id="support"', 'id="supportOverlay"', "fetch('/api/donate-link')", "data-support", "buy.stripe.com"]) assert.ok(!landing.includes(piece), piece);
  assert.doesNotMatch(readFileSync(new URL("../client/src/pages/Login.tsx", import.meta.url), "utf8"), /DonationGoal|Support Our Readers/);
});
