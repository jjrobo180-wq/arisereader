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

test("there are 53 older looks plus Classic, and the Studio series on top", () => assert.equal(NOTES_THEMES.filter((t) => !t.id.startsWith("x-")).length, 54));
for (const t of NOTES_THEMES) test(`${t.label} text is readable`, () => {
  for (const [name, fg, bg] of [["ink/bg", t.ink, t.bg], ["ink/card", t.ink, t.card], ["muted/bg", t.muted, t.bg], ["muted/card", t.muted, t.card], ["faint/card", t.faint, t.card], ["accent ink/card", t.accentInk, t.card], ["accent ink/soft", t.accentInk, t.accentSoft], ["on accent", t.onAccent, t.accent], ["on record", t.onRecord, t.record]] as const)
    assert.ok(ratio(fg, bg) >= 4.5, `${t.id} ${name}: ${ratio(fg, bg).toFixed(2)}`);
});
test("the four professional looks appear alongside existing choices", () => {
  for (const id of ["editorial", "slatepro", "graphitepro", "linenpro"]) {
    assert.ok(NOTES_THEMES.some((t) => t.id === id));
    assert.equal(cleanSettings({ theme: id, themeRev: 1 }).theme, id);
  }
});
test("a saved look is kept, and anything else means Classic", () => {
  assert.equal(cleanSettings({ theme: "deck", themeRev: 1 }).theme, "deck");
  assert.equal(cleanSettings({ theme: "nope", themeRev: 1 }).theme, "x-billboard");
  assert.equal(cleanSettings({}).theme, "x-billboard");
  // Everyone moves to Billboard once, old accounts included; after that their own pick is kept.
  assert.equal(cleanSettings({ theme: "deck" }).theme, "x-billboard");
  assert.equal(cleanSettings({ theme: "classic" }).theme, "x-billboard");
  assert.equal(themeOf("nope").id, "classic");
});
test("the areas around the page follow the look on the iPhone", () => {
  const app = readFileSync(new URL("../client/src/components/arise-notes/NotesApp.tsx", import.meta.url), "utf8");
  assert.match(app, /"setBackdrop", \{ color: paint \}/);
  assert.match(app, /"StatusBar", "setStyle"/);
  const swift = readFileSync(new URL("../notes/ios-app/plugins/arise-on-device/ios/Sources/AriseOnDevicePlugin/AriseOnDevicePlugin.swift", import.meta.url), "utf8");
  assert.match(swift, /CAPPluginMethod\(name: "setBackdrop"/);
});
test("the iPhone app draws edge to edge, so the header stays put and covers the status bar", () => {
  const config = JSON.parse(readFileSync(new URL("../notes/ios-app/capacitor.config.json", import.meta.url), "utf8"));
  assert.equal(config.ios.contentInset, "never");
  const css = readFileSync(new URL("../client/src/components/arise-notes/notes.css", import.meta.url), "utf8");
  assert.match(css, /\.an-root::before \{[^}]*height: var\(--sat, env\(safe-area-inset-top, 0px\)\)/);
});
test("the iPhone app's page reaches the screen edges, so headers sit below the clock", () => {
  const main = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
  assert.match(main, /isNotesApp\(\)( \|\| isUndercoverApp\(\))?\) \{\s*const vp/);
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

test("the ten system looks are whole systems in Duo and Notes: Home, calendar, getting around, windows, recording", () => {
  const ids = ["pocket", "glass", "desktop", "millennium", "workstation", "retro", "monolith", "ink", "neon", "orbit"];
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  const sys = read("client/src/components/look-os/systems.tsx"), css = read("client/src/components/look-os/systems.css");
  const notes = read("client/src/components/arise-notes/looks.tsx"), ncss = read("client/src/components/arise-notes/notes-systems.css");
  const os = read("client/src/components/look-os/LookOS.tsx");
  assert.match(os, /SYSTEM_LOOKS\.has\(look\.id\)\) return <SystemDock/);
  assert.match(os, /SYSTEM_LOOKS\.has\(p\.look\.id\)\) return <SystemHome/);
  assert.match(os, /DESKTOP_LOOKS\.has\(p\.look\.id\) \? <div className="sys-desk"><SystemWindow/);
  for (const id of ids) {
    assert.ok(NOTES_THEMES.some((t) => t.id === id), `${id} is a look`);
    assert.match(sys, new RegExp(`case "${id}"`), `${id} has its own Duo Home and calendar`);
    assert.match(css, new RegExp(`sys-dock-${id}`), `${id} has its own way of getting around`);
    assert.match(notes, new RegExp(`case "${id}"`), `${id} has its own Notes Home`);
    assert.match(ncss, new RegExp(`an-l-hero-${id}`), `${id} styles the Notes Home`);
    assert.match(ncss, new RegExp(`an-theme-${id} \\.an-l-bar`), `${id} has its own Notes tab bar`);
  }
  // Taskbars open a start menu; the desktop looks open screens in windows.
  assert.match(sys, /aria-haspopup="menu" onClick=\{\(\) => setMenu\(!menu\)\} data-testid="sys-start"/);
  for (const id of ["desktop", "millennium", "workstation", "retro"]) assert.match(css, new RegExp(`sys-win-${id}`), `${id} windows`);
  // Original designs: no company names in what people see.
  for (const word of ["Windows", "Microsoft", "Apple", "iPhone", "macOS", "Luna", "Aero"]) {
    for (const t of NOTES_THEMES.filter((x) => ids.includes(x.id))) assert.ok(!`${t.label} ${t.blurb}`.includes(word), `${t.id} doesn't say ${word}`);
  }
  // E-Ink holds still.
  assert.match(css, /\.los-ink, \.los-ink \* \{ animation: none !important; transition: none !important; \}/);
});

test("the ten interactive looks move, sound and buzz, in Duo and Notes", () => {
  const ids = ["spinner", "bubbles", "lava", "marbles", "synth", "jelly", "orrery", "dial", "ferro", "slots"];
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  const playTsx = read("client/src/components/look-os/play.tsx"), css = read("client/src/components/look-os/play.css");
  const toys = read("client/src/components/look-os/toys.tsx"), feel = read("client/src/components/look-os/feel.ts");
  const notes = read("client/src/components/arise-notes/looks.tsx"), ncss = read("client/src/components/arise-notes/notes-play.css");
  const os = read("client/src/components/look-os/LookOS.tsx");
  assert.match(os, /PLAY_LOOKS\.has\(look\.id\)\) return <PlayDock/);
  assert.match(os, /PLAY_LOOKS\.has\(p\.look\.id\)\) return <PlayHome/);
  assert.match(os, /PLAY_LOOKS\.has\(look\.id\)\) return <button type="button" className=\{`los-cal[^>]*><PlayCal/);
  for (const id of ids) {
    assert.ok(NOTES_THEMES.some((t) => t.id === id), `${id} is a look`);
    assert.match(playTsx, new RegExp(`case "${id}"`), `${id} has its own Duo Home`);
    assert.match(css, new RegExp(`pl-dock-${id}`), `${id} has its own dock`);
    assert.match(css, new RegExp(`\\.los-${id} \\.los-body`), `${id} has its own surface`);
    assert.match(notes, new RegExp(`case "${id}"`), `${id} has its own Notes Home and recording`);
    assert.match(ncss, new RegExp(`an-theme-${id} \\.an-l-bar`), `${id} has its own Notes tab bar`);
    assert.match(ncss, new RegExp(`an-l-list-${id}`), `${id} has its own notes list`);
  }
  // Taps you can feel on the iPhone, sounds made on the spot, and both can be turned off.
  assert.match(feel, /nativeCall\(\/haptics\/i, "Haptics", "impact"/);
  assert.match(feel, /navigator\.vibrate/);
  assert.match(feel, /createOscillator/);
  assert.match(feel, /arise-play-sound/);
  assert.match(feel, /arise-play-haptics/);
  assert.match(playTsx, /<FeelToggle \/>/);
  for (const toy of ["Spinner", "BubbleWrap", "LavaLamp", "MarbleJar", "SynthKeys", "Jelly", "Orrery", "RadioDial", "Ferro", "Slots"]) assert.match(toys, new RegExp(`export function ${toy}\\(`), `${toy} exists`);
  assert.equal((toys.match(/buzz\(/g) ?? []).length >= 20, true, "toys buzz");
  // The haptics plugin is in both iPhone apps.
  for (const f of ["arisetodo/ios-app/package.json", "notes/ios-app/package.json"]) assert.match(read(f), /@capacitor\/haptics/, f);
  // Original designs: no company names in what people see; motion stops when asked.
  for (const t of NOTES_THEMES.filter((x) => ids.includes(x.id))) for (const word of ["Windows", "Microsoft", "Apple", "iPhone"]) assert.ok(!`${t.label} ${t.blurb}`.includes(word), `${t.id} doesn't say ${word}`);
  assert.match(read("client/src/components/look-os/toys.css"), /prefers-reduced-motion: reduce/);
});

test("the Notes tab looks serious and professional in every look, with real folders", () => {
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  const app = read("client/src/components/arise-notes/NotesApp.tsx"), view = read("client/src/components/arise-notes/pages/PagesView.tsx"), css = read("client/src/components/arise-notes/pages/pages-pro.css");
  // The look's colors, fonts and shapes stay out of the Notes tab; it's neutral light or dark.
  assert.match(app, /const pro = route\.name !== "ask" && route\.name !== "undercover" && !s\?\.contrast;/);
  assert.match(app, /const themed = !pro && /);
  assert.match(css, /\.an-root\.an-pro \{[^}]*--an-bg: #f2f2f7 !important/);
  assert.match(css, /\.an-root\.an-pro\.an-pro-dark \{/);
  assert.match(css, /\.an-pro \.an-l-bar \{/);
  // A folder list first on a phone, with your own folders, edit, counts and a way back.
  assert.match(view, /data-testid="pages-folder-screen"/);
  assert.match(view, /<h3>Folders<\/h3>/);
  assert.match(view, /data-testid="pages-back-folders"/);
  assert.match(view, /data-testid="pages-folder-edit"/);
  assert.match(view, /className="pp-row"/);
});

test("the five Suite looks restyle Home, the list, recording, the Notes tab and the writing page", () => {
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  const looks = read("client/src/components/arise-notes/looks.tsx"), css = read("client/src/components/arise-notes/notes-suite.css"), app = read("client/src/components/arise-notes/NotesApp.tsx");
  for (const id of ["paper", "midnight", "folio", "nordic", "carbon"]) {
    assert.ok(NOTES_THEMES.some((t) => t.id === id), `${id} is a look`);
    assert.equal(cleanSettings({ theme: id, themeRev: 1 }).theme, id);
    assert.match(looks, new RegExp(`case "${id}"`), `${id} has its own Home and recording`);
  }
  assert.match(looks, /if \(SUITE_LOOKS\.has\(look\.id\)\) return <SuiteList/);
  assert.match(looks, /an-x-notetitle/);
  assert.match(app, /suite && "an-suite"/);
  assert.match(app, /suite \|\| proLook \? suiteVars\(look\)/, "Suite looks and every other look color the Notes tab");
  assert.match(css, /\.an-root\.an-root\.an-pro:is\(\.an-suite, \.an-prolook\) \{/);
  assert.match(css, /\[data-paper="paper"\]/);
  for (const t of NOTES_THEMES.filter((x) => ["paper", "midnight", "folio", "nordic", "carbon"].includes(x.id)))
    for (const word of ["Apple", "iPhone", "iCloud"]) assert.ok(!`${t.label} ${t.blurb}`.includes(word), `${t.id} doesn't say ${word}`);
});

test("the Suite looks have their own To Duo home, calendar and bottom bar", () => {
  const os = readFileSync("client/src/components/look-os/LookOS.tsx", "utf8");
  const suite = readFileSync("client/src/components/look-os/suite.tsx", "utf8");
  for (const id of ["paper", "midnight", "folio", "nordic", "carbon"]) assert.ok(suite.includes(`"${id}"`), id);
  assert.ok(os.includes("<SuiteHome") && os.includes("<SuiteCal") && os.includes("los-dock-suite") && os.includes("los-suite"));
});
