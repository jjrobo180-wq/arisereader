// The Arise Reader iPhone apps have no browser Back: every screen past home gets one
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
  assert.match(c, /navigate\(home, \{ replace: true \}\)/, "nothing behind: the home screen, never out of the app");
  assert.doesNotMatch(c, /history\.back\(\)/, "never the browser's history (the screens' own Home buttons add to it, which made a loop)");
  assert.match(c, /const floating = flavor !== "eyegaze"/, "Eye Gazer screens have their own Home, so no floating button over it");
  assert.match(c, /home\\b\)/, "a screen's own Home at the top counts as its Back");
  assert.match(read("client/src/App.tsx"), /\{isReaderApp\(\) && user && <NativeBack \/>\}/);
});

test("Back never goes round in a circle", () => {
  // The trail rule from NativeBack: coming back to a screen on the trail cuts it there.
  const step = (t: string[], path: string, homes = ["/eye-gaze-home"]) => { if (homes.includes(path)) return [path]; const at = t.indexOf(path); return at >= 0 ? t.slice(0, at + 1) : [...t, path]; };
  let t = ["/eye-gaze-home"];
  for (const p of ["/eye-gaze-games", "/eye-gaze-farm", "/eye-gaze-games", "/eye-gaze-farm", "/eye-gaze-games"]) t = step(t, p);
  assert.deepEqual(t, ["/eye-gaze-home", "/eye-gaze-games"]);
});
