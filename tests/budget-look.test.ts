// Budget & bills looks like the rest of the LifeHub (November 2026): the LifeHub's own page header and
// white cards, one quiet summary card instead of a dark banner, sentence-case labels, one segmented
// control for the tabs, and only the class names the hub's looks and night mode know how to recolor.
// Run with: npx tsx --test tests/budget-look.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const money = readFileSync(new URL("../client/src/components/family-hub/Money.tsx", import.meta.url), "utf8");
const main = money.slice(0, money.indexOf("// ───────── Dialogs ─────────"));

test("the budget uses the LifeHub's own page header, like every other section", () => {
  assert.match(main, /<PageHead eyebrow="Budget & bills" title="Your money"/);
  assert.doesNotMatch(main, /<h1 /, "no hand-made header of its own");
});

test("no dashboard-template decoration: no gradients, glass, sparkles or emoji", () => {
  assert.doesNotMatch(money, /bg-gradient-to|from-\[#1d1838\]|bg-white\/10|ring-white\/15|Sparkles/);
  assert.doesNotMatch(money, /[\u{1F300}-\u{1FAFF}]/u, "no emoji");
});

test("the summary is a white card whose figures never get cut off", () => {
  assert.match(main, /const summary = <section className="min-w-0 rounded-\[1\.5rem\] border border-\[#e7e8f0\] bg-white/);
  const figure = money.slice(money.indexOf("const Figure"), money.indexOf("const tabClass"));
  assert.doesNotMatch(figure, /truncate/, "amounts and the line under them wrap instead of being cut off");
  assert.match(figure, /tabular-nums/, "numbers line up");
});

test("labels are sentence case: the budget's cards carry no shouting eyebrows", () => {
  assert.doesNotMatch(main, /<Panel eyebrow=/);
  assert.doesNotMatch(main, /uppercase/);
});

test("the tabs are one segmented control that scrolls inside itself on a phone", () => {
  assert.match(main, /role="tablist" aria-label="Budget">\s*<div className="inline-flex min-w-full gap-0\.5 rounded-xl bg-slate-100 p-1 sm:min-w-0">/);
  assert.match(money, /const tabClass = \(on: boolean\) => `[^`]*\$\{on \? "bg-white text-slate-900 shadow-sm"/);
});

test("the spending form never squeezes the category to nothing in the two-column layout", () => {
  assert.match(main, /sm:grid-cols-\[110px_minmax\(0,1fr\)_minmax\(0,1\.2fr\)_150px_auto\] xl:grid-cols-2/);
});

test("only colors the hub's looks and night mode recolor", () => {
  const hex = [...main.matchAll(/(?:bg|text|border)-\[(#[0-9a-f]{3,6})\]/gi)].map((m) => m[1].toLowerCase());
  for (const h of hex) assert.ok(["#e7e8f0", "#232139", "#6e5ae0"].includes(h), `${h} isn't one the looks know`);
});
