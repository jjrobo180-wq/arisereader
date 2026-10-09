// Run with: npx tsx --test tests/hub-banner.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BANNER, MAX_BANNER_IMAGE, cleanBanner } from "../shared/hubBanner";
import { normalizeWorkspace } from "../shared/teacherHub";

test("a saved banner is made safe", () => {
  assert.deepEqual(cleanBanner(undefined), DEFAULT_BANNER);
  assert.equal(cleanBanner({ color: "red" }).color, DEFAULT_BANNER.color);
  assert.equal(cleanBanner({ color: "#0F766E" }).color.toLowerCase(), "#0f766e");
  assert.equal(cleanBanner({ size: "huge" }).size, "normal");
  assert.equal(cleanBanner({ size: "tall" }).size, "tall");
  const ok = "data:image/jpeg;base64,/9j/4AAQ";
  assert.equal(cleanBanner({ image: ok }).image, ok);
  assert.equal(cleanBanner({ image: "https://evil.example/x.png" }).image, "");
  assert.equal(cleanBanner({ image: "data:text/html;base64,PGI+" }).image, "");
  assert.equal(cleanBanner({ image: "data:image/png;base64," + "A".repeat(MAX_BANNER_IMAGE) }).image, "");
});

test("the look is kept with the profile, and an old Hub without one still opens", () => {
  assert.equal(normalizeWorkspace({ profile: { school: "Oak" } }).profile.banner, undefined);
  const w = normalizeWorkspace({ profile: { banner: { color: "#1d4ed8", size: "tall", image: "javascript:alert(1)" } } });
  assert.deepEqual(w.profile.banner, { color: "#1d4ed8", image: "", size: "tall" });
});
