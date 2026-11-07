import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTES_THEMES, nightLook } from "../shared/notesThemes";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("in the To Duo app the clock's space is never taken as zero: every top offset goes through --sat", () => {
  for (const f of ["client/src/components/look-os/lookOS.css", "client/src/components/arise-notes/notes-themes.css", "client/src/components/arise-notes/protoLooks.css", "client/src/components/arise-notes/notes.css"]) {
    const css = read(f).replace(/var\(--sat, env\(safe-area-inset-top, 0px\)\)/g, "");
    assert.ok(!css.includes("env(safe-area-inset-top"), `${f} uses the raw safe area`);
  }
});

test("a dock with its own solid color or gradient keeps it (the page-colored layer took Timeline's black away)", () => {
  const css = read("client/src/components/look-os/lookOS.css");
  for (const d of ["los-dock-timeline", "los-dock-chatline", "los-dock-studio", "sys-dock-millennium", "pl-dock-dial", "pl-dock-slots", "pl-dock-ferro"]) assert.match(css, new RegExp(`\\.${d}[^{]*::before \\{ background: inherit; \\}|\\.${d},[\\s\\S]{0,400}::before \\{ background: inherit; \\}`), d);
});

test("tall cards keep sane corners even in pill-shaped looks", () => {
  assert.match(read("client/src/pages/hubLooks.css"), /rounded-\\\[1\\\.75rem\\\] \{ border-radius: min\(var\(--an-radius\), 28px\)/);
  assert.match(read("client/src/components/arise-notes/notes-themes.css"), /\.an-themed \.an-paper \{[^}]*border-radius: min\(var\(--an-radius\), 28px\)/);
});

test("night: a black accent turns light (not a muddy grey) so buttons read", () => {
  for (const id of ["x-edit-serif", "x-edit-instrument", "x-index-paper"]) {
    const t = NOTES_THEMES.find((x) => x.id === id);
    if (!t) continue;
    const n = nightLook(t);
    const lum = parseInt(n.accent.slice(1, 3), 16);
    assert.ok(lum > 200, `${id} night accent ${n.accent}`);
  }
});

test("the side 'show menu' tab hides when a look's dock is on screen", () => {
  assert.match(read("client/src/components/family-hub/PhoneMenu.tsx"), /!open && !hideTab &&/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /<PhoneMenu [^>]*hideTab=\{osOn\}/);
});
