// Arise Notes looks: every look stays readable, and a bad saved value falls back to Classic.
// Run with: npx tsx --test tests/notes-themes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTES_THEMES, cleanSettings, themeOf } from "../shared/ariseNotes";
import { nightLook } from "../shared/notesThemes";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("there are 13 looks plus Classic", () => assert.equal(NOTES_THEMES.length, 14));
for (const t of NOTES_THEMES) test(`${t.label} text is readable`, () => {
  for (const [name, fg, bg] of [["ink/bg", t.ink, t.bg], ["ink/card", t.ink, t.card], ["muted/bg", t.muted, t.bg], ["muted/card", t.muted, t.card], ["faint/card", t.faint, t.card], ["accent ink/card", t.accentInk, t.card], ["accent ink/soft", t.accentInk, t.accentSoft], ["on accent", t.onAccent, t.accent], ["on record", t.onRecord, t.record]] as const)
    assert.ok(ratio(fg, bg) >= 4.5, `${t.id} ${name}: ${ratio(fg, bg).toFixed(2)}`);
});
test("a saved look is kept, and anything else means Classic", () => {
  assert.equal(cleanSettings({ theme: "deck" }).theme, "deck");
  assert.equal(cleanSettings({ theme: "nope" }).theme, "classic");
  assert.equal(cleanSettings({}).theme, "classic");
  assert.equal(themeOf("nope").id, "classic");
});
test("the areas around the page follow the look on the iPhone", () => {
  const app = readFileSync(new URL("../client/src/components/arise-notes/NotesApp.tsx", import.meta.url), "utf8");
  assert.match(app, /"setBackdrop", \{ color: backdrop \}/);
  assert.match(app, /"StatusBar", "setStyle"/);
  const swift = readFileSync(new URL("../notes/ios-app/plugins/arise-on-device/ios/Sources/AriseOnDevicePlugin/AriseOnDevicePlugin.swift", import.meta.url), "utf8");
  assert.match(swift, /CAPPluginMethod\(name: "setBackdrop"/);
});
test("the iPhone app draws edge to edge, so the header stays put and covers the status bar", () => {
  const config = JSON.parse(readFileSync(new URL("../notes/ios-app/capacitor.config.json", import.meta.url), "utf8"));
  assert.equal(config.ios.contentInset, "never");
  const css = readFileSync(new URL("../client/src/components/arise-notes/notes.css", import.meta.url), "utf8");
  assert.match(css, /\.an-root::before \{[^}]*height: env\(safe-area-inset-top\)/);
});
test("the iPhone app's page reaches the screen edges, so headers sit below the clock", () => {
  const main = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
  assert.match(main, /isNotesApp\(\)\) \{\s*const vp/);
});

test("every look has a readable night mode", () => {
  const lum = (hex: string) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  for (const t of NOTES_THEMES) {
    const n = nightLook(t);
    assert.ok(n.dark, `${t.id} is dark at night`);
    for (const [fg, bg, min] of [[n.ink, n.bg, 7], [n.ink, n.card, 7], [n.muted, n.card, 4.5], [n.faint, n.card, 4.5], [n.onAccent, n.accent, 4.5], [n.accentInk, n.card, 4.5]] as const)
      assert.ok(ratio(fg, bg) >= min, `${t.id}: ${fg} on ${bg} is ${ratio(fg, bg).toFixed(2)}`);
  }
});
