import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync("client/src/components/arise-notes/pages/PagesView.tsx", "utf8");
const css = readFileSync("client/src/components/arise-notes/pages/pages-pro.css", "utf8");

test("the Notes page is minimal: no big banner, no empty folders, no illustration", () => {
  assert.match(view, /className="pp-min /);
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
