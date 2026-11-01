// Eye Gazer on iPad (found by tests/ipad: the games in WebKit as an iPad, with finger taps).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");

test("Sentence Train's picture board stays hidden behind the trip menu", () => {
  const src = read("client/src/pages/eye-gaze/SentenceTrainGame.tsx");
  assert.doesNotMatch(src, /line\.setPicture\("ALL ABOARD!"/);
  assert.match(src, /lineRef\.current\?\.hidePicture\(\); setView\("pick"\)/);
});

test("Eye Gazer home keeps its plan when the server sends none", () => {
  assert.match(read("client/src/pages/EyeGazeHome.tsx"), /if \(active && result\?\.settings\) setControls\(result\.settings\);/);
});

test("Surprise Tiles draws its big picture the way Safari can", () => {
  assert.match(read("client/src/game/fidget/fidgets.ts"), /bigEmoji\(c, item\[1\], 320, 280, 340\)/);
  assert.match(read("client/src/game/runner/textures.ts"), /const draw = Math\.min\(size, 200\)/);
});
