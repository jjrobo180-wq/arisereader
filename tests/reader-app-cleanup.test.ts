// The Arise Reader iPhone app: no Study Squad, Beginners, Math, History or Connect; the leaderboard
// pop-up shows once per full restart.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Reader app menus leave out Study Squad, Beginners, Math, History and Connect", () => {
  const lib = readFileSync("client/src/pages/Library.tsx", "utf8");
  const at = lib.indexOf('navigate("/study")'); assert.ok(at > 0, "Study Squad");
  assert.match(lib.slice(Math.max(0, at - 160), at), /!isReaderApp\(\)/, "Study Squad is hidden in the Reader app");
  // Beginners, Math, History and Connect are gone for everyone (Nov 25, 2026).
  for (const needle of ['navigate("/beginners")', 'href="/math/"', 'href="/history/"', 'href="/social/" className="rounded-xl']) assert.ok(!lib.includes(needle), needle);
  assert.doesNotMatch(lib, /<BeginnersBanner/);
});

test("the leaderboard pop-up shows once per app launch, not on every return", () => {
  const src = readFileSync("client/src/components/LeaderboardPopup.tsx", "utf8");
  assert.match(src, /let shownThisLaunch = false/); assert.match(src, /if \(alreadyShown\(\)\) return;/); assert.match(src, /markShown\(\);/);
});
