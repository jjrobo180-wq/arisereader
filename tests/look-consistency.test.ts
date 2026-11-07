// Looks across Arise To Duo and Arise Notes (November 2026 audit): words on a look's accent use that look's
// own "on accent" color, Classic matches the other light looks, and Tide's warnings and amounts read on it.
// Run with: npx tsx --test tests/look-consistency.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTES_THEMES, themeVars } from "../shared/notesThemes";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("a picked chip in Arise Notes uses the look's own color for words on its accent (white failed on orange and pink looks)", () => {
  const css = read("client/src/components/arise-notes/notes.css");
  assert.match(css, /\.an-root \.an-chip\[aria-pressed="true"\] \{ background: var\(--an-violet\) !important; color: var\(--an-on-accent, #fff\) !important;/);
  for (const t of NOTES_THEMES) assert.ok(ratio(t.onAccent, t.accent) >= 4.5, `${t.id}: on accent`);
});

test("Classic has words for its accent too (the Menu's plan card was dark text on violet)", () => {
  const css = read("client/src/components/arise-notes/notes.css");
  assert.match(css, /\.an-root \{[^}]*--an-on-accent: #ffffff;/);
  assert.ok(ratio("#ffffff", "#6a55dc") >= 4.5);
  assert.match(read("client/src/components/arise-notes/SettingsScreen.tsx"), /background: "var\(--an-violet\)", color: "var\(--an-on-accent\)"/);
});

test("Classic's green is the same green as every light look's, and it reads on its tint", () => {
  const css = read("client/src/components/arise-notes/notes.css");
  const light = NOTES_THEMES.find((t) => t.id === "paper")!;
  const green = themeVars(light)["--an-green"];
  assert.match(css, new RegExp(`--an-green: ${green};`));
  assert.ok(ratio(green, "#e3f7ee") >= 4.5, `${green} on its tint`);
});

test("Tide (one mid-deep teal) gets lighter warning and money colors than the near-black looks", () => {
  const css = read("client/src/pages/hubLooks.css");
  const tide = NOTES_THEMES.find((t) => t.id === "tide")!;
  const red = /\.hub-theme-tide \.text-rose-800 \{ color: (#[0-9a-f]{6}) !important; \}/.exec(css)?.[1];
  const green = /\.hub-theme-tide \.text-green-700 \{ color: (#[0-9a-f]{6}) !important; \}/.exec(css)?.[1];
  assert.ok(red && green, "Tide's own red and green");
  assert.ok(ratio(red!, tide.card) >= 4.5, `red ${ratio(red!, tide.card).toFixed(2)}`);
  assert.ok(ratio(green!, tide.card) >= 4.5, `green ${ratio(green!, tide.card).toFixed(2)}`);
  // Its rules come after the dark looks' shared ones, so they win.
  assert.ok(css.indexOf(".hub-theme-tide .text-rose-800") > css.indexOf(".hub-look-dark .text-rose-800"));
});

test("Receipts' Print new button keeps white words readable on its red", () => {
  const css = read("client/src/components/arise-notes/protoLooks2.css");
  const bg = /\.stx \.stx-printbar \.stx-pin \{ background: (#[0-9a-f]{6}); color: #fff;/.exec(css)?.[1];
  assert.ok(bg && ratio("#ffffff", bg) >= 4.5, `${bg}`);
});
