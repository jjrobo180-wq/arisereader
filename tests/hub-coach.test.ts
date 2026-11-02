// The in-hub coach that carries on after the Arise To Duo app's full-screen tour
// (components/HubCoach.tsx): hold a widget, drag it, switch hubs, then Apps → App Gallery.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the coach walks through the real hub, one gesture at a time", () => {
  const c = read("client/src/components/HubCoach.tsx");
  assert.match(c, /if \(!isNativeApp\(\) \|\| isSampleMode\(\)/, "iPhone app only, never in a sample");
  assert.match(c, /arise-walkthrough-v1:/, "starts after the first tour is done");
  assert.match(c, /data-home-part/, "hold a widget on Home");
  assert.match(c, /hub-jiggle/, "moves on when Home wiggles");
  assert.match(c, /hub-todo-switch/, "switch between WorkHub and LifeHub");
  assert.match(c, /tab-apps/, "then Apps");
  assert.match(c, /hub-app-store|life-app-app-store/, "then the App Gallery");
  assert.match(c, /plugin-store/, "done when the App Gallery opens");
  assert.match(c, /data-testid="hub-coach-skip"/, "Skip is always there");
  assert.match(c, /prefers-reduced-motion/);
});

test("both hubs show the coach", () => {
  assert.match(read("client/src/pages/AriseTodo.tsx"), /<HubCoach userId=\{user\.id\} hub="life" \/>/);
  assert.match(read("client/src/pages/TeacherHub.tsx"), /<HubCoach userId=\{user\.id\} hub="work" \/>/);
});
