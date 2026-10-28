import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("profile pages are laid out like a social profile: cover, picture, stats, Follow, Top 8 circles, tabs", () => {
  const src = readFileSync(new URL("../client/src/components/family-hub/earshot/EarshotProfilePage.tsx", import.meta.url), "utf8");
  assert.match(src, /aspect-\[3\/1\]/, "a cover photo");
  assert.match(src, /aria-label="Top 8 shows"/);
  assert.match(src, /aria-label="Profile sections"/);
  assert.match(src, /\["posts", "Posts", true\]/);
  assert.match(src, /row \? feed\.map/, "posts look exactly like the main feed");
  assert.doesNotMatch(src, /No profile song\./, "no empty boxes for visitors");
});
