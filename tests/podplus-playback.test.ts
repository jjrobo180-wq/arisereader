// Podster playback fixes: other apps' sound, Wiki podcasts that keep going, Apple-style scrubbing and
// skipping, and ads found by several methods agreeing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { combineAds, alignAds } from "../shared/earshotAds";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("opening Podster doesn't take the speaker from other apps", () => {
  const py = read("podscroll/ios-app/configure-ios.py");
  const setup = py.slice(py.indexOf('setup = """'), py.indexOf('src = src[:ret]'));
  assert.match(setup, /setCategory\(\.playback/);
  assert.doesNotMatch(setup, /setActive\(true\)/, "activating at launch interrupts music and podcasts in other apps");
  assert.match(py, /not activated at launch/, "older projects get the activation taken out too");
});

test("a Wiki podcast belongs to the player engine, so leaving the page doesn't stop it", () => {
  const screen = read("podscroll/Wiki.tsx"), engine = read("podscroll/wikiPlayer.ts");
  const player = screen.slice(screen.indexOf("function Player("), screen.indexOf("class WikiGuard"));
  assert.doesNotMatch(player, /return \(\) => \{[^}]*stopAiVoice/, "the screen no longer stops the voice when it closes");
  assert.doesNotMatch(player, /onClick=\{\(\) => \{ pause\(\); onBack\(\); \}\}/, "Back doesn't pause");
  assert.match(engine, /mediaSession/); assert.match(engine, /h\("pause"/);
  assert.match(read("podscroll/Home.tsx"), /<WikiMini /, "a mini bar shows it while you're elsewhere in Podster");
});

test("scrubbing seeks when the finger lifts, and the lock screen scrubs and skips like Apple's", () => {
  const bar = read("podscroll/SeekBar.tsx"), pl = read("client/src/components/family-hub/earshot/EarshotPlayer.tsx");
  assert.match(bar, /onPointerUp=\{\(e\) => end\(e, true\)\}/); assert.doesNotMatch(bar, /type="range"/);
  assert.doesNotMatch(read("podscroll/Audiobooks.tsx"), /aria-label="Position in chapter"\s*\n\s*onChange/);
  assert.doesNotMatch(pl, /<input type="range" min=\{0\} max=\{Math\.max\(1, Math\.floor\(p\.dur\)\)\}/, "no seek on every pixel of a native slider");
  assert.match(pl, /set\("seekto", live \? null/); assert.match(pl, /setPositionState/);
  assert.match(pl, /set\("nexttrack", null\)/);
});

test("ad methods that agree make an ad surer, and strong wording alone is still skipped", () => {
  const ai = [{ s: 100, e: 160, label: "X", conf: 0.7, kind: "ai" }];
  const phrase = [{ s: 110, e: 150, label: "Ad break", conf: 0.6, kind: "phrase" }, { s: 400, e: 440, label: "Ad break", conf: 0.8, kind: "phrase" }, { s: 700, e: 730, label: "Ad break", conf: 0.7, kind: "phrase" }];
  const out = combineAds(ai as any, phrase as any, null, []);
  assert.ok(out[0].conf! > 0.75, "AI and wording agreeing: skipped by itself");
  assert.equal(ai[0].conf, 0.7, "the caller's list is left alone");
  assert.equal(out.find((a) => a.s === 400)!.conf, 0.8, "three ad lines together are not downgraded");
  assert.ok(out.find((a) => a.s === 700)!.conf! <= 0.6, "weak wording alone is only offered");
  const list = [{ key: "a:1", s: 1, e: 30, label: "", kind: "splice", conf: 0.68, dur: 1000, durMode: "exact" }, { key: "a:3", s: 150, e: 190, label: "", kind: "ai", conf: 0.7, dur: 1000, durMode: "exact" }] as any;
  const aligned = alignAds(list, 1000);
  assert.equal(aligned[0].sure, true, "audio-based finds are skipped from a lower bar");
  assert.equal(aligned[1].sure, false);
});
