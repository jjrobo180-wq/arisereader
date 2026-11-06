import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Arise To Duo draws edge to edge on the iPhone", () => {
  assert.equal(JSON.parse(read("arisetodo/ios-app/capacitor.config.json")).ios.contentInset, "never");
});
test("the page only shifts for the clock when it really fills the screen (older builds are left alone)", () => {
  const main = read("client/src/main.tsx");
  assert.match(main, /nativeFlavor\(\) === "todo"/);
  assert.match(main, /classList\.toggle\("todo-edge", window\.screen\.height - window\.innerHeight \* scale <= 40\)/);
  const css = read("client/src/todo-app.css");
  for (const line of css.split("\n").filter((l) => l.includes("{"))) assert.match(line, /^html\.todo-edge/, line);
  assert.match(css, /header\.sticky\.top-0[^{]*\{ box-sizing: content-box; padding-top: var\(--sat\); \}/);
});
test("the looks' own hub screens add the clock gap only once", () => {
  const os = read("client/src/components/look-os/LookOS.tsx");
  assert.match(os, /los-inset/);
  assert.match(read("client/src/components/look-os/lookOS.css"), /\.los\.los-inset \.los-topbar \{ padding-top: 0 !important; \}/);
  // Notes Home's hero reaches under the clock only in Arise Notes, never in the hubs.
  assert.match(read("client/src/components/arise-notes/protoLooks.css"), /\.stx\.an-root\.stx-s \.an-l-hero/);
});
