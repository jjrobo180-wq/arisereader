import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshNews, nowNewsService, sameShowName } from "../server/podcastNow";

const ep = (id: string, showId: string, minsAgo: number, now: number) => ({ id, showId, show: showId, author: "", title: id, about: "", audio: "https://a/x.mp3", date: new Date(now - minsAgo * 60_000).toISOString(), secs: 300, art: "", link: "", explicit: false });

test("only news from the last few hours, newest first, a few per show", () => {
  const now = Date.parse("2026-10-27T20:00:00Z");
  const list = [ep("a", "s1", 30, now), ep("b", "s1", 90, now), ep("c", "s2", 10, now), ep("old", "s3", 7 * 60, now), ep("d", "s1", 150, now), ep("e", "s1", 170, now)];
  assert.deepEqual(freshNews(list, 6, now).map((e) => e.id), ["c", "a", "b", "d"]);
  assert.deepEqual(freshNews(list, 1, now).map((e) => e.id), ["c", "a"]);
});

test("a show name only matches that show, not a lookalike", () => {
  assert.ok(sameShowName("NPR News Now", "NPR News Now"));
  assert.ok(sameShowName("The Daily", "The Daily"));
  assert.ok(!sameShowName("The Daily", "Daily Wire Backstage"));
});

test("a round gathers the newest episodes and the hub drops old ones as time passes", async () => {
  let clock = Date.parse("2026-10-27T20:00:00Z");
  const apple = async (url: string) => {
    if (url.includes("/search")) return { results: [{ wrapperType: "track", kind: "podcast", collectionId: 121493804, collectionName: "NPR News Now", artistName: "NPR", artworkUrl600: "https://x/a.jpg", feedUrl: "https://f", genres: ["News"] }] };
    return { results: [{ wrapperType: "podcastEpisode", kind: "podcast-episode", trackId: 1001, collectionId: 121493804, collectionName: "NPR News Now", trackName: "News at 3pm", episodeUrl: "https://a/1.mp3", releaseDate: new Date(clock - 20 * 60_000).toISOString(), trackTimeMillis: 300000 }] };
  };
  const svc = nowNewsService({ apple, idle: () => true, newsPool: async () => [], now: () => clock, sleep: async () => {} });
  await svc.round();
  const first = svc.list(6);
  assert.equal(first.warming, false);
  assert.equal(first.episodes.length, 1);
  clock += 7 * 3600_000;
  assert.equal(svc.list(6).episodes.length, 0);
});

test("Pod+ genre and topic tabs keep loading, and the news hub is on the home page", () => {
  const home = readFileSync(new URL("../podscroll/Home.tsx", import.meta.url), "utf8");
  assert.match(home, /<Endless key=\{chip\}/);
  assert.match(home, /more=\{moreFn\}/);
  assert.match(home, /onNews=\{\(\) => go\(\{ kind: "now" \}\)\}/);
  assert.match(readFileSync(new URL("../server/earshot.ts", import.meta.url), "utf8"), /app\.get\(`\$\{P\}\/now`/);
});
