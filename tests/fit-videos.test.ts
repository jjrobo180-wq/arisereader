// Arise Fit's how-to videos (shared/fitVideos.ts, client/public/fit-video.html, client/src/pages/fit/FitVideo.tsx).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CATALOG, PROGRAMS } from "../shared/fit";
import { FIT_VIDEOS, videoFor, videoOfTheDay, videoPlayerUrl, videoThumb, videoWatchUrl } from "../shared/fitVideos";

test("every exercise in the catalog has its own real YouTube video", () => {
  for (const e of CATALOG) {
    const v = videoFor(e.id);
    assert.ok(v, `${e.id} has no video`);
    assert.match(v!.id, /^[A-Za-z0-9_-]{11}$/, `${e.id}: not a YouTube video id`);
    assert.ok(v!.title.length > 5, `${e.id}: a title to show`);
  }
  const ids = Object.values(FIT_VIDEOS).map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, "no video is used for two exercises");
  for (const k of Object.keys(FIT_VIDEOS)) assert.ok(CATALOG.some((e) => e.id === k), `${k} is not an exercise`);
  for (const p of PROGRAMS) for (const d of p.days) for (const it of d.items) assert.ok(videoFor(it.exId), `${p.id}: ${it.exId}`);
  assert.equal(videoFor("wger-123"), undefined, "wger exercises keep the YouTube search");
});

test("links: still, watch page and the player page on the right site", () => {
  assert.equal(videoThumb("4Y2ZdHCOXok"), "https://i.ytimg.com/vi/4Y2ZdHCOXok/mqdefault.jpg");
  assert.equal(videoThumb("4Y2ZdHCOXok", "hq"), "https://i.ytimg.com/vi/4Y2ZdHCOXok/hqdefault.jpg");
  assert.equal(videoWatchUrl("4Y2ZdHCOXok"), "https://www.youtube.com/watch?v=4Y2ZdHCOXok");
  assert.equal(videoPlayerUrl("4Y2ZdHCOXok", "https://arisetodo.com/"), "https://arisetodo.com/fit-video.html?v=4Y2ZdHCOXok&autoplay=1");
  assert.equal(videoPlayerUrl("4Y2ZdHCOXok", "https://arisetodo.com", false), "https://arisetodo.com/fit-video.html?v=4Y2ZdHCOXok");
  assert.equal(videoPlayerUrl("<script>", "https://arisetodo.com"), "", "only real ids make a link");
});

test("the form tip changes each day and stays the same all day", () => {
  const ids = CATALOG.map((e) => e.id);
  const a = videoOfTheDay(ids, new Date(2026, 9, 31, 7)), b = videoOfTheDay(ids, new Date(2026, 9, 31, 22)), c = videoOfTheDay(ids, new Date(2026, 10, 1, 7));
  assert.ok(a && videoFor(a)); assert.equal(a, b); assert.notEqual(a, c);
  assert.equal(videoOfTheDay(["wger-1"]), undefined);
});

test("the player page: YouTube's player on arisetodo.com, only real ids, and it never leaves the app", () => {
  assert.ok(existsSync("client/public/fit-video.html"));
  const page = readFileSync("client/public/fit-video.html", "utf8");
  assert.match(page, /\/\^\[A-Za-z0-9_-\]\{11\}\$\/\.test\(id\)/, "checks the id before using it");
  assert.match(page, /youtube-nocookie\.com/);
  assert.match(page, /playsinline: 1/, "plays inside the page on iPhone instead of jumping to full screen");
  assert.match(page, /onError: function \(\) \{ showFallback\(\); \}/);
  assert.doesNotMatch(page, /youtube\.com\/watch|Watch on YouTube|target="_blank"/, "no link out to YouTube");
  const ui = readFileSync("client/src/pages/fit/FitVideo.tsx", "utf8");
  assert.match(ui, /isNativeApp\(\) \? nativeAppInfo\(\)\.api : window\.location\.origin/, "the iPhone app plays through arisetodo.com");
  assert.match(ui, /allow="autoplay; encrypted-media; picture-in-picture; fullscreen"/);
  assert.match(ui, /sandbox="allow-scripts allow-same-origin allow-presentation"/, "no pop-ups or navigation: the YouTube app never opens");
  for (const f of ["FitVideo.tsx", "FitTrain.tsx", "FitApp.tsx"]) assert.doesNotMatch(readFileSync(`client/src/pages/fit/${f}`, "utf8"), /window\.open|Open in YouTube|howToVideo/, `${f} sends no one to YouTube`);
});
