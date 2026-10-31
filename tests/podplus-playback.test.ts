// Pod+ playback fixes: older episodes play through the server, a stalled or cut-short copy carries on
// from the show's host, AI picks open a series at its first episode, and the iPhone app keeps playing
// in the background.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sameHostAudio } from "../server/podcastPlay";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the app's own address for an older episode is only used on the show's own host", () => {
  const known = [{ audio: "https://traffic.megaphone.fm/ABC123.mp3?x=1" }, { audio: "https://dts.podtrac.com/redirect.mp3/x.mp3" }];
  assert.equal(sameHostAudio("https://traffic.megaphone.fm/OLD1.mp3", known), "https://traffic.megaphone.fm/OLD1.mp3");
  assert.equal(sameHostAudio("https://evil.example/x.mp3", known), null);
  assert.equal(sameHostAudio("http://169.254.169.254/latest", known), null);
  assert.equal(sameHostAudio("file:///etc/passwd", known), null);
  assert.equal(sameHostAudio("", known), null);
});

test("the server finds an older episode (a series' first) in the show's 200 newest, then the sent address", () => {
  const earshot = read("../server/earshot.ts");
  assert.match(earshot, /audioFor: async \(showId, episodeId, sent\) => \{/);
  assert.match(earshot, /const older = \(await archiveOf\(showId\)/);
  assert.match(earshot, /return sameHostAudio\(sent, \[\.\.\.recent, \.\.\.older\]\);/);
  assert.match(read("../server/podcastPlay.ts"), /d\.audioFor\(showId, episodeId, typeof req\.query\?\.u === "string"/);
  assert.match(read("../client/src/components/family-hub/earshot/EarshotPlayer.tsx"), /&u=\$\{encodeURIComponent\(ep\.audio \|\| ""\)\}/);
});

test("a stuck or cut-short server copy carries on from the host instead of skipping the episode", () => {
  const src = read("../client/src/components/family-hub/earshot/EarshotPlayer.tsx");
  assert.match(src, /if \(stall\.current\.n >= 5\) \{/);
  assert.match(src, /const cutShort = real >= 60/);
  assert.match(src, /goDirect\(ca, it0\.ep, ca\.currentTime, true\);/);
  // A show's page lists its 200 newest, so Oldest first starts near the beginning.
  assert.match(src, /<ShowPage show=\{sheet\.show\} load=\{loadArchive\}/);
});

test("an AI pick opens the show oldest first, and picking an episode plays the ones after it in order", () => {
  const search = read("../podscroll/Search.tsx");
  assert.match(search, /onClick=\{\(\) => \{ setSort\("old"\); searchShow\(p\.show, ""\); \}\}/);
  assert.match(search, /onOpen\(e, episodes\.slice\(episodes\.indexOf\(e\) \+ 1\)\)/);
  assert.match(read("../client/src/components/family-hub/earshot/EarshotPlayer.tsx"), /const after = \(start\.next \?\? \[\]\)/);
});

test("the iPhone app's sound keeps playing in the background", () => {
  const cfg = read("../podscroll/ios-app/configure-ios.py");
  assert.match(cfg, /setCategory\(\.playback, mode: \.spokenAudio, policy: \.longFormAudio\)/);
  assert.match(cfg, /"audio" not in modes/);
});

test("the iPhone apps hear their notification token (no JavaScript plugin package needed)", () => {
  const native = read("../client/src/lib/nativeApp.ts");
  assert.match(native, /export async function nativeListen\(/);
  assert.match(native, /cap\.nativeCallback\(pluginName, "addListener", \{ eventName: event \}, fn\)/);
  assert.match(read("../client/src/lib/applePush.ts"), /nativeListen\(NAME, event, fn\)/);
  assert.match(read("../podscroll/applePush.ts"), /nativeListen\(NAME, "registration"/);
});
