import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync("client/src/components/arise-notes/pages/PagesView.tsx", "utf8");
const css = readFileSync("client/src/components/arise-notes/pages/pages-pro.css", "utf8");

test("the Notes page is minimal: no big banner, no empty folders, no illustration", () => {
  assert.match(view, /className=\{?`?"?pp-min /);
  assert.doesNotMatch(view, /Make your first folder/);
  assert.doesNotMatch(view, /an-empty-stack"><i \/><i \/><i><PenLine className="h-7 w-7" strokeWidth=\{1\.8\} \/><\/i><\/div><p className="an-display text-\[24px\]/);
  assert.doesNotMatch(view, /pp-trust/);
  assert.doesNotMatch(view, /pages-upload-list/, "Upload lives once, in the side list");
  assert.match(view, /className="pp-record"/);
  assert.match(view, /count\(\(m\) => m\.pinned\) > 0 \|\| filter\.kind === "pinned"/, "Pinned only shows when it has notes");
  assert.match(view, /className="pp-blank"/);
});

test("minimal styles: flat rows, no icon tiles, white only in light mode", () => {
  assert.match(css, /\.pp-min \.pp-row-icon \{ display: none; \}/);
  assert.match(css, /\.pp-min \.pp-group, \.pp-min \.pp-rows \{ background: transparent !important; box-shadow: none !important;/);
  assert.match(css, /\.an-root\.an-pro:not\(\.an-pro-dark\) \.pp-min \{ --an-bg: #ffffff;/);
  assert.match(css, /\.pp-min \.pp-swipe-top \{ background: var\(--an-bg\); \}/, "rows stay solid so swipe actions don't show through");
});

test("inside To Do, Notes follows To Do: its Day/Night (not the computer's dark mode), its colors, one box beside the menu, no buttons twice", () => {
  const app = readFileSync(new URL("../client/src/components/arise-notes/NotesApp.tsx", import.meta.url), "utf8");
  assert.ok(app.includes("<ForcedDark.Provider value={props.duo ? !!props.duo.night : null}>"));
  assert.ok(app.includes("const proDark = pro && (duo ? !!duo.night :"));
  const appearance = readFileSync(new URL("../client/src/components/arise-notes/appearance.ts", import.meta.url), "utf8");
  assert.ok(appearance.includes('if (forced !== null) return { mode: forced ? "dark" : "light", dark: forced'));
  const view = readFileSync(new URL("../client/src/components/arise-notes/pages/PagesView.tsx", import.meta.url), "utf8");
  assert.ok(view.includes("{!ctx.duo && <>") && view.includes("pp-in-duo") && view.includes("boxRef.current.clientWidth >= 860"));
  const css = readFileSync(new URL("../client/src/components/super-apps/notes-duo.css", import.meta.url), "utf8");
  assert.ok(css.includes(".super-arisenotes { min-width: 0; max-width: 100%; overflow-x: clip; }"));
  assert.ok(css.includes(".an-root.an-in-duo.an-pro {") && css.includes("--pp-accent: #6e5ae0"));
});
