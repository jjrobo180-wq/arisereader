import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the look picker sets its own colors, so no look can turn its names white on white", () => {
  const s = read("client/src/components/looks/LookPicker.tsx");
  assert.doesNotMatch(s, /text-slate-|bg-white|bg-violet-50/);
});
test("the Studio bottom bar carries its own look, so it shows on the Notes tab too", () => {
  assert.match(read("client/src/components/arise-notes/looks.tsx"), /stx-barscope\$\{archClass\(look\)\}/);
});
test("Studio styles outrank the older look rules whatever order the CSS loads in", () => {
  for (const f of ["protoLooks.css", "protoLooks2.css"]) {
    const css = read(`client/src/components/arise-notes/${f}`).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const sel of css.split("}").map((r) => r.split("{")[0].trim()).filter(Boolean))
      for (const one of sel.split(",")) assert.match(one.trim(), /^\.stx(\.|\s|$)/, `${f}: ${one.trim()}`);
  }
});
test("the floating bar's words use the look's ink, not white on the card", () => {
  assert.match(read("client/src/components/arise-notes/notes-themes.css"), /background: #121212; color: var\(--an-ink, #fff\)/);
});
test("Notes and the hubs run the readability safety net", () => {
  assert.match(read("client/src/components/arise-notes/NotesApp.tsx"), /useContrastGuard\(true/);
  assert.match(read("client/src/components/HubLook.tsx"), /useContrastGuard\(true/);
  const g = read("client/src/lib/contrastGuard.ts");
  assert.match(g, /min = 3/); assert.match(g, /color\(srgb/);
});

test("the Studio class names never collide with the playful looks' own classes (look-os/play)", () => {
  const play = read("client/src/components/look-os/play.css") + read("client/src/components/look-os/play.tsx");
  for (const f of ["protoLooks.css", "protoLooks2.css", "protoPages.css"]) {
    const mine = new Set(read(`client/src/components/arise-notes/${f}`).match(/\.stx-[a-z0-9-]+/g) ?? []);
    for (const c of mine) assert.ok(!play.includes(c.slice(1)), `${c} is also used by the playful looks`);
  }
  assert.doesNotMatch(read("client/src/components/arise-notes/protoLooks.tsx"), /` pl /);
});
