// The apps must never zoom in (tapping a text box, double tap, pinch). The owner asked for this
// many times; these checks keep the three guards from being undone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LOCK = /minimum-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no/;

test("app pages fix the viewport at scale 1", () => {
  for (const f of ["client/index.html", "podscroll/app/index.html", "podscroll/index.html"]) {
    const meta = read(f).match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? "";
    assert.match(meta, LOCK, f);
  }
});

test("the page can never be widened past the screen", () => {
  assert.match(read("client/src/index.css"), /html, body, #root \{\s*max-width: 100%;\s*overflow-x: clip;/);
  assert.match(read("client/src/components/arise-notes/notes-suite.css"), /\.an-x-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
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
    // Any zoom above the page's own resting scale is undone, not just a zoom above 1 (a jump from a smaller
    // page scale up to exactly 1 is what slipped through before).
    assert.match(s, /let own = view\.minimumZoomScale > 0\.5 && view\.minimumZoomScale <= 1 \? view\.minimumZoomScale : 1/);
    assert.match(s, /view\.zoomScale > own \+ 0\.001/);
    assert.match(s, /setZoomScale\(/);
    assert.ok(!/minimumZoomScale = 1/.test(s), "the page's own fit-to-screen scale is left alone");
  }
  for (const app of ["arisetodo", "fit", "podscroll"]) assert.match(read(`${app}/ios-app/package.json`), /"arise-widgets"/, app);
  assert.match(read("notes/ios-app/package.json"), /"arise-on-device"/);
});

test("if iPhone lays the page out wider than the screen, the viewport is pinned to the screen's width", () => {
  const main = read("client/src/main.tsx");
  assert.match(main, /window\.location\.protocol === "capacitor:" && !isFitApp\(\)\) \{/);
  assert.match(main, /m\.content = `width=\$\{wide\}, initial-scale=1, minimum-scale=1, maximum-scale=1/);
  assert.match(main, /Math\.abs\(window\.innerWidth - wide\) < 2/);
});

test("Arise To Duo is smaller through its type size, never the viewport, so a tapped text box can't zoom it", () => {
  // A viewport below 100% (even locked at 93%) draws a 16px text box at about 15px, and iPhone zooms in when it's tapped.
  const main = read("client/src/main.tsx");
  assert.doesNotMatch(main.replace(/\/\/.*$/gm, ""), /TODO_SCALE|initial-scale=0\.93/);
  assert.match(main, /if \(todoCompact\) document\.documentElement\.classList\.add\("todo-compact"\);/);
  assert.match(read("client/src/todo-app.css"), /html\.todo-edge\.todo-compact \{ font-size: 93\.75%; \}/);
});

test("only main.tsx sets the viewport: nothing changes it while the app runs", () => {
  // nativeBackdrop.ts once set To Duo to 93% each time a hub opened, while main.tsx set it back to 100%
  // whenever the screen changed size (the keyboard counts): the page jumped in every time a text box was tapped.
  const src = new URL("../client/src/", import.meta.url);
  const touching = (readdirSync(src, { recursive: true }) as string[])
    .filter((f) => /\.(tsx?|jsx?)$/.test(f))
    .filter((f) => /meta\[name=["\\]*viewport/.test(readFileSync(new URL(f, src), "utf8")))
    .map((f) => f.replace(/\\/g, "/"));
  assert.deepEqual(touching, ["main.tsx"]);
});

test("the IEP page is never wider than the phone", () => {
  // A plain one-column grid is as wide as its longest line, so one long student line made the whole IEP page
  // about 40px wider than an iPhone: the cards ran off the right edge and the page looked zoomed in.
  const iep = read("client/src/components/teacher-hub/HubIep.tsx");
  assert.match(iep, /className="grid grid-cols-\[minmax\(0,1fr\)\] gap-3" data-testid="iep-page"/);
  assert.ok(!/className="grid gap-\d"/.test(iep), "every one-column grid on the IEP page fits the screen");
});
