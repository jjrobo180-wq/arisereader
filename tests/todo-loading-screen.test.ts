// Arise To Duo's iPhone app opens on its own loading screen, not Capacitor's gray placeholder "X" and a black screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the To Duo build adds the loading screen; the websites don't", () => {
  const cfg = readFileSync("vite.todo.config.ts", "utf8");
  assert.match(cfg, /todoLoadingScreen\(\)/);
  assert.match(cfg, /todo-loading\.html/);
  assert.doesNotMatch(readFileSync("vite.config.ts", "utf8"), /todo-loading/);
  assert.doesNotMatch(readFileSync("client/index.html", "utf8"), /todo-boot/);
});

test("the loading screen: navy, the app icon, Work, Life and Family tick off, then it leaves", () => {
  const html = readFileSync("client/todo-loading.html", "utf8");
  assert.match(html, /id="todo-boot"/);
  assert.match(html, /#211c55/);
  for (const w of ["Work", "Life", "Family"]) assert.ok(html.includes(`</span>${w}</div>`), w);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /> 12000\) hide\(\)/, "never stays more than 12 seconds");
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/, "nothing downloaded (no live updates)");
});

test("the iPhone launch screen is navy with the icon, not the placeholder", () => {
  const cap = JSON.parse(readFileSync("arisetodo/ios-app/capacitor.config.json", "utf8"));
  assert.equal(cap.plugins.SplashScreen.backgroundColor, "#211c55");
  assert.equal(cap.ios.backgroundColor, "#211c55");
  assert.match(readFileSync("arisetodo/ios-app/configure-ios.py", "utf8"), /splash-2732\.png/);
  assert.ok(readFileSync("arisetodo/ios-app/splash-2732.png").length > 1000);
});
