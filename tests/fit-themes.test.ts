// Arise Fit's color themes: nine accents, each readable in Light and Dark, plus true black for Dark.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PALETTES, PALETTE_IDS, paletteTokens } from "../client/src/pages/fit/fitThemes";

const UI = readFileSync(new URL("../client/src/pages/fit/fitUi.tsx", import.meta.url), "utf8");

const lum = (h: string) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("ten color themes, Ember (the original orange) first", () => {
  assert.deepEqual(PALETTE_IDS, ["ember", "volt", "ocean", "aqua", "berry", "violet", "gold", "crimson", "tide", "mono"]);
  assert.equal(PALETTES.ember.light[0], "#ff5a1f");
  assert.equal(PALETTES.ember.dark[0], "#ff5a1f");
});

test("every theme's buttons are readable: text on the accent, and the accent on the cards", () => {
  for (const id of PALETTE_IDS) {
    const [la, lon] = PALETTES[id].light, [da, don] = PALETTES[id].dark;
    assert.ok(contrast(la, lon) >= 4.5, `${id} light button text`);
    assert.ok(contrast(da, don) >= 4.5, `${id} dark button text`);
    assert.ok(contrast(da, "#202329") >= 4.5, `${id} accent on dark cards`);
    assert.ok(contrast(la, "#ffffff") >= 2.9, `${id} accent on light cards`);
  }
});

test("each theme sets its accent, the text on it and its glow, in Light, Dark and true black", () => {
  for (const sel of ['[data-fit-theme="light"][data-fit-palette="${id}"]', '[data-fit-theme="dark"][data-fit-palette="${id}"]', '[data-fit-theme="dark"][data-fit-black="1"][data-fit-palette="${id}"]']) assert.ok(UI.includes(sel), sel);
  for (const id of PALETTE_IDS) {
    for (const mode of ["light", "dark"] as const) {
      const t = paletteTokens(id, mode);
      assert.equal(t.accent, PALETTES[id][mode][0]);
      assert.equal(t["on-accent"], PALETTES[id][mode][1]);
      assert.match(t["accent-rgb"], /^\d+,\d+,\d+$/);
      assert.match(t["accent-deep"], /^#[0-9a-f]{6}$/);
    }
  }
  assert.match(UI, /const BLACK = \{ bg: "#000000"/, "true black");
  // Ember keeps its original glow exactly.
  assert.match(paletteTokens("ember", "light").glow, /#ffe2d3/);
  assert.match(paletteTokens("ember", "dark").glow, /#3b2415/);
});

test("screens use the theme, not a fixed orange (pictures and the tour's art keep theirs)", () => {
  const dirs = ["fit", "trainer", "coach"];
  const keep = new Set(["fitUi.tsx", "fitArt.tsx", "FitCircle.tsx", "FitOnboard.tsx", "FitForm.tsx"]);
  for (const d of dirs) for (const f of readdirSync(new URL(`../client/src/pages/${d}/`, import.meta.url))) {
    if (!f.endsWith(".tsx") || keep.has(f)) continue;
    const src = readFileSync(new URL(`../client/src/pages/${d}/${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /#ff5a1f|#b8360a|rgba\(255, ?90, ?31/i, `${d}/${f}`);
    assert.doesNotMatch(src, /"#0b0b0c"/, `${d}/${f}: text on the accent follows the theme`);
  }
  const ui = UI;
  assert.match(ui, /ink: "var\(--fit-on-accent\)"/);
  assert.match(ui, /data-testid=\{`\$\{testId\}-colors`\}/);
  assert.match(ui, /True black in Dark/);
});
