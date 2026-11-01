// Arise Fit matches its prototype: the blaze-orange look, five tabs with a sliding highlight, and motion.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(new URL(`../client/src/pages/fit/${f}`, import.meta.url), "utf8");

test("palette is the prototype's: near-black, charcoal cards, one orange accent", () => {
  const ui = read("fitUi.tsx");
  for (const c of ['bg: "#0a0a0b"', 'card: "#141518"', 'lime: "#ff5a1f"', 'pink: "#e8455a"', 'blue: "#4d9fff"', 'orange: "#ffb020"']) assert.ok(ui.includes(c), c);
  assert.ok(!ui.includes("#c7a477"), "the old champagne accent is gone");
});

test("motion: entrances, fills, shine, scan, rest sheet and route draw, off for Reduce Motion", () => {
  const ui = read("fitUi.tsx");
  for (const k of ["fitIn", "fitSlide", "fitSheet", "fitPop", "fitBar", "fitShine", "fitPulse", "fitScan", "fitUp", "fitRoute"]) assert.ok(ui.includes(`@keyframes ${k}`), k);
  assert.match(ui, /prefers-reduced-motion/);
  assert.match(ui, /arise-fit-motion/);
  assert.match(read("FitTrain.tsx"), /fit-up fixed/);
  assert.match(read("FitFood.tsx"), /fit-scan/);
  assert.match(read("FitRun.tsx"), /className: "fit-route"/);
});

test("tabs: Today, Train, Food, Fast, Run, with a sliding highlight; Progress opens from Today", () => {
  const app = read("FitApp.tsx");
  assert.match(app, /\["fast", "Fast", Timer\], \["run", "Run", Route\]/);
  assert.match(app, /transition: "left \.35s/);
  assert.match(app, /<FastingSheet inline/);
  assert.match(app, /<OutdoorHub inline/);
  assert.match(app, /fit-open-progress/);
  assert.match(app, /key=\{tab\} className="fit-in"/);
});

test("finishing a workout shows the trophy screen", () => {
  const t = read("FitTrain.tsx");
  assert.match(t, /fit-pop grid h-\[104px\]/);
  assert.match(t, />Done\.</);
  assert.match(t, /Back to today/);
});
