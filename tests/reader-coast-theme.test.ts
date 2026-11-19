import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("client/src/pages/TeacherReader.tsx", "utf8");
const css = readFileSync("client/src/pages/readerCoast.css", "utf8");
const scene = readFileSync("client/src/components/reader/CoastScene.tsx", "utf8");

test("the Reader has a Theme button with Classic and Neon Coast, remembered on the device", () => {
  assert.match(page, /<ThemeButton theme=\{theme\} setTheme=\{setTheme\} \/>/);
  assert.match(page, /id: "coast", name: "Neon Coast"/);
  assert.match(page, /readTheme = \(v: string \| null \| undefined\): ReaderTheme => \(v === "coast" \? "coast" : "classic"\)/);
  assert.match(page, /reader-coast/);
  assert.match(page, /\{coast && <CoastScene \/>\}/);
});

test("Neon Coast changes the whole look, not just colors", () => {
  for (const part of ["--coast-display", "clip-path", "nav[aria-label=\"Reader menu\"] button[aria-current=\"page\"]", ".coast-hud", "[data-r=\"objective\"]", ".reader-coast.hub-night .bg-white"]) assert.ok(css.includes(part), part);
});

test("it is our own art and names: nothing from the game it nods to", () => {
  for (const src of [page, css, scene]) assert.doesNotMatch(src, /\b(gta|grand theft|rockstar|pricedown|vice city|leonida|los santos)\b/i);
});
