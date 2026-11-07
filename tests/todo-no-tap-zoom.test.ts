// Arise To Duo on the iPhone zoomed in whenever a text box was tapped (November 2026). The app shrank the page with
// initial-scale=0.93, so a 16px text box drew at about 15px and iPhone zoomed to 100% to make it readable; the native
// zoom guard only undid zoom above 1, so a zoom from 0.93 to exactly 1 stayed. Run with: npx tsx --test tests/todo-no-tap-zoom.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the To Duo page is never shrunk with the viewport; it's a touch smaller through the type size", () => {
  const src = read("client/src/lib/nativeBackdrop.ts");
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /initial-scale=0\.\d/);
  assert.match(read("client/src/todo-app.css"), /html\.todo-edge\.todo-compact \{ font-size: 93\.75%; \}/);
  // Text boxes stay at 16px or more on phones, whatever the root size.
  assert.match(read("client/src/index.css"), /textarea, select \{ font-size: max\(16px, 1rem\) !important; \}/);
  for (const f of ["client/src/main.tsx", "client/src/lib/nativeBackdrop.ts"]) assert.doesNotMatch(read(f).replace(/\/\/.*$/gm, ""), /initial-scale=0\.9[0-9]/, f);
});

test("the native zoom guard puts back any zoom above the page's own scale, not only above 1", () => {
  const swift = read("native/arise-widgets/ios/Sources/AriseWidgetsPlugin/AriseZoomLock.swift");
  assert.match(swift, /guard view\.zoomScale > own \+ 0\.001 else \{ return \}/);
  assert.doesNotMatch(swift, /guard view\.zoomScale > 1\.001/);
});
