// The Arise Reader iPhone app: no Study Squad, Beginners, Math, History or Connect; the leaderboard
// pop-up shows once per full restart.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Reader app menus leave out Study Squad, Beginners, Math, History and Connect", () => {
  const lib = readFileSync("client/src/pages/Library.tsx", "utf8");
  for (const [needle, name] of [['navigate("/study")', "Study Squad"], ['navigate("/beginners")', "Beginners"], ['href="/math/"', "Math"], ['href="/history/"', "History"], ['href="/social/" className="rounded-xl', "Connect tile"], ['href="/social/" className="block', "Connect link"]] as const) {
    const at = lib.indexOf(needle); assert.ok(at > 0, name);
    assert.match(lib.slice(Math.max(0, at - 160), at), /!isReaderApp\(\)/, `${name} is hidden in the Reader app`);
  }
  assert.match(lib, /!isReaderApp\(\) && <BeginnersBanner/);
});

test("the leaderboard pop-up shows once per app launch, not on every return", () => {
  const src = readFileSync("client/src/components/LeaderboardPopup.tsx", "utf8");
  assert.match(src, /let shownThisLaunch = false/); assert.match(src, /if \(alreadyShown\(\)\) return;/); assert.match(src, /markShown\(\);/);
});
