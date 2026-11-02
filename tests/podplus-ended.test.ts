// Pod+: an episode that "ends" the moment it starts (a jump landed at its end) plays from the top
// instead of stopping on "That episode is over", and Play on a finished episode always plays.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeTo } from "../shared/earshot";

test("automatic jumps never land in the last seconds of the real audio", () => {
  assert.equal(safeTo({ duration: 300 }, 90), true);
  assert.equal(safeTo({ duration: 60 }, 90), false, "a 90 s intro skip on a 60 s file");
  assert.equal(safeTo({ duration: 300 }, 290), false);
  assert.equal(safeTo({ duration: NaN }, 90), true, "length not known yet");
});

test("the player recovers instead of getting stuck", () => {
  const p = readFileSync(new URL("../client/src/components/family-hub/earshot/EarshotPlayer.tsx", import.meta.url), "utf8");
  assert.match(p, /if \(listened\.current < 8 && ca && it\?\.ep && !plainPlay\.current\.has\(it\.ep\.id\)\)/);
  assert.match(p, /if \(a\.ended \|\| \(Number\.isFinite\(D\) && D > 0 && a\.currentTime >= D - 2\)\) \{ plainPlay\.current\.add\(it\.ep\.id\); try \{ a\.currentTime = 0;/);
  assert.match(p, /if \(plainPlay\.current\.has\(epId\) \|\| !safeTo\(a, ad\.e\)\) return;/);
  assert.match(p, /safeTo\(a!, to\)\) a!\.currentTime = to;/);
});
