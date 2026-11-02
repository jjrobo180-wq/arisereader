// The A.R.I.S.E. Reader iPhone apps have no browser Back: every screen past home gets one
// (components/NativeBack.tsx), unless the screen shows its own, and a left-edge swipe goes back.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// The component imports wouter (not installed for tests), so its home-screen rule is read from the file.
const src = read("client/src/components/NativeBack.tsx");
const HOMES: string[] = JSON.parse(src.match(/const HOMES = (\[[^\]]+\])/)![1]);
const isHomeScreen = (path: string) => HOMES.includes(path.split("?")[0].replace(/\/+$/, "") || "/");

test("home screens have no Back; everything else does", () => {
  for (const p of ["/", "/library", "/reader", "/signin", "/library?tab=x"]) assert.equal(isHomeScreen(p), true, p);
  for (const p of ["/games", "/read/12", "/quiz/3", "/profile", "/avatar-world"]) assert.equal(isHomeScreen(p), false, p);
});

test("Back is in both Reader apps, steps back inside the app, and swipes", () => {
  const c = read("client/src/components/NativeBack.tsx");
  assert.match(c, /isReaderApp\(\)/);
  assert.match(c, /hasOwnBack\(\)/, "stays out of the way of a screen's own Back");
  assert.match(c, /touchstart/, "edge swipe");
  assert.match(c, /navigate\(home\)/, "nothing behind: the home screen, never out of the app");
  assert.match(read("client/src/App.tsx"), /\{isReaderApp\(\) && user && <NativeBack \/>\}/);
});
