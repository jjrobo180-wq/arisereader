import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// "automatic" shrinks the page inside the notch and home-bar areas, and the native window shows
// through above and below it as light bars. The Cooked apps draw their own safe-area padding, so the
// page must fill the whole screen.
test("Cooked Fitness and Cooked PT fill the whole iPhone screen", () => {
  for (const app of ["fit", "trainer"]) {
    const c = JSON.parse(readFileSync(`${app}/ios-app/capacitor.config.json`, "utf8"));
    assert.equal(c.ios?.contentInset, "never", `${app}: contentInset`);
  }
  const trainer = readFileSync("client/src/pages/trainer/TrainerApp.tsx", "utf8");
  assert.match(trainer, /pt-\[max\(14px,env\(safe-area-inset-top\)\)\]/, "trainer pads for the notch");
  assert.match(trainer, /bottom: "max\(12px, env\(safe-area-inset-bottom\)\)"/, "trainer tab bar clears the home bar");
  assert.match(readFileSync("client/index.html", "utf8"), /viewport-fit=cover/);
});
