// The apps must never zoom in (tapping a text box, double tap, pinch). The owner asked for this
// many times; these checks keep the three guards from being undone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LOCK = /maximum-scale=1, user-scalable=no/;

test("app pages fix the viewport at scale 1", () => {
  for (const f of ["client/index.html", "podscroll/app/index.html", "podscroll/index.html"]) {
    const meta = read(f).match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? "";
    assert.match(meta, LOCK, f);
  }
});

test("phones write in text boxes at 16px or more", () => {
  assert.match(read("client/src/index.css"), /textarea, select \{ font-size: max\(16px, 1rem\) !important; \}/);
});

test("the iPhone apps hold the web view at zoom 1 natively", () => {
  const widgets = read("native/arise-widgets/ios/Sources/AriseWidgetsPlugin/AriseWidgetsPlugin.swift");
  const notes = read("notes/ios-app/plugins/arise-on-device/ios/Sources/AriseOnDevicePlugin/AriseOnDevicePlugin.swift");
  assert.match(widgets, /AriseZoomLock\.install\(on: bridge\?\.webView\)/);
  assert.match(notes, /NotesZoomLock\.install\(on: bridge\?\.webView\)/);
  for (const f of ["native/arise-widgets/ios/Sources/AriseWidgetsPlugin/AriseZoomLock.swift", "notes/ios-app/plugins/arise-on-device/ios/Sources/AriseOnDevicePlugin/NotesZoomLock.swift"]) {
    const s = read(f);
    assert.match(s, /maximumZoomScale = 1/);
    assert.match(s, /setZoomScale\(1, animated: false\)/);
  }
  for (const app of ["arisetodo", "fit", "podscroll"]) assert.match(read(`${app}/ios-app/package.json`), /"arise-widgets"/, app);
  assert.match(read("notes/ios-app/package.json"), /"arise-on-device"/);
});
