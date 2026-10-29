import test from "node:test";
import assert from "node:assert/strict";
import { adSpotChunks, emptyProfile, guessAdAround, learnProfile, phraseAds } from "../shared/earshotAds";
import { adsFromChapters } from "../shared/earshot";
import { pickShows, spareMinutes } from "../server/podcastPrecheck";

const seg = (s: number, t: string) => ({ s, e: s + 8, t });

test("show memory learns where mid-roll ads sit, and which pieces to check first", () => {
  let p = emptyProfile();
  for (let i = 0; i < 3; i++) {
    p = learnProfile(p, `ep${i}#c1`, [seg(900, "This episode is brought to you by Squarespace")], [{ s: 900, e: 960, label: "Squarespace", conf: 0.9, kind: "ai" }], false, 3600);
  }
  assert.equal(p.spots?.length, 3);
  assert.deepEqual(adSpotChunks(p, 3000, 600), [1]);
  // An end-roll is matched from the end, so a shorter episode still finds its last piece.
  let q = emptyProfile();
  for (let i = 0; i < 2; i++) q = learnProfile(q, `e${i}#c5`, [seg(3500, "x")], [{ s: 3500, e: 3580, label: "ad", conf: 0.9, kind: "ai" }], false, 3600);
  assert.deepEqual(adSpotChunks(q, 2400, 600), [3]);
  // Pieces without a length (copy time) don't teach spots.
  const r = learnProfile(emptyProfile(), "x#3", [seg(900, "x")], [{ s: 900, e: 960, label: "ad", conf: 0.9 }], false);
  assert.equal(r.spots?.length, 0);
});

test("sponsor phrases find ads without AI", () => {
  const segs = [seg(0, "So that's the story."), seg(10, "Let's take a quick break."), seg(18, "Use code SHOW at checkout for 20 percent off."), seg(26, "The link is in the show notes."), seg(34, "And now back to the show."), seg(42, "Where were we?")];
  const ads = phraseAds(segs);
  assert.ok(ads.length >= 1);
  assert.ok(ads[0].s <= 18 && ads[0].e >= 34);
});

test("chapter titles mark ads, but not chapters about advertising", () => {
  const ch = [{ s: 0, title: "Intro" }, { s: 100, title: "A word from our sponsors" }, { s: 160, title: "Midroll" }, { s: 200, title: "How ads work" }, { s: 400, title: "Outro" }];
  const ads = adsFromChapters(ch, 600);
  assert.deepEqual(ads.map((a) => a.s), [100, 160]);
});

test("one tap: the ad around now from the transcript, or the next 30 seconds", () => {
  const segs = [seg(0, "Great point."), seg(10, "This episode is sponsored by BetterHelp."), seg(18, "Visit betterhelp.com/show for 10 percent off."), seg(26, "So anyway, back to Rome."), seg(34, "The emperor was angry."), seg(42, "He left the city.")];
  const g = guessAdAround(segs, 15);
  assert.ok(g.sure);
  assert.ok(g.s <= 10 && g.e >= 26 && g.e <= 42, JSON.stringify(g));
  const blind = guessAdAround([], 100);
  assert.deepEqual(blind, { s: 97, e: 130, sure: false });
});

test("pre-checks only spend spare allowance, most-wanted shows first", () => {
  assert.equal(spareMinutes(new Date("2026-10-27T15:00:00Z"), 900, 900), 0);
  assert.equal(spareMinutes(new Date("2026-10-27T07:00:00Z"), 900, 900), 450);
  assert.equal(spareMinutes(new Date("2026-10-27T22:00:00Z"), 900, 300), 210);
  const now = Date.now();
  assert.deepEqual(pickShows({ a: { n: 1, at: now }, b: { n: 5, at: now }, old: { n: 9, at: now - 40 * 864e5 } }, ["c", "a"], now), ["b", "a", "c"]);
});
