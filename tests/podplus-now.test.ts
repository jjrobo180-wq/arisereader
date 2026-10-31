import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feedEpisodeId, feedEpisodes, freshNews, mergeFeed, nowNewsService, sameShowName } from "../server/podcastNow";

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
  const svc = nowNewsService({ apple, idle: () => true, newsPool: async () => [], now: () => clock, sleep: async () => {}, feed: async () => { throw new Error("offline"); } });
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

const rss = (items: string) => `<?xml version="1.0"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>NPR News Now</title>${items}</channel></rss>`;
const item = (title: string, when: Date, url: string, guid = url) => `<item><title><![CDATA[${title}]]></title><description>&lt;p&gt;Top stories &amp;amp; more&lt;/p&gt;</description><pubDate>${when.toUTCString()}</pubDate><guid isPermaLink="false">${guid}</guid><enclosure url="${url}" type="audio/mpeg" length="1"/><itunes:duration>05:01</itunes:duration></item>`;
const npr = { id: "121493804", name: "NPR News Now", author: "NPR", art: "https://x/a.jpg", genre: "news", appleGenre: "", link: "", episodes: 0, explicit: false, latest: "" };

test("bulletins read straight from a show's RSS feed: newest few, https audio, numeric ids", () => {
  const now = Date.parse("2026-10-31T13:05:00Z");
  const xml = rss(item("News at 9am ET", new Date(now - 5 * 60_000), "http://play.podtrac.com/npr/9am.mp3?x=1&amp;y=2") + item("News at 8am ET", new Date(now - 65 * 60_000), "https://a/8.mp3") + item("No audio", new Date(now), ""));
  const eps = feedEpisodes(xml, npr);
  assert.deepEqual(eps.map((e) => e.title), ["News at 9am ET", "News at 8am ET"]);
  assert.equal(eps[0].audio, "https://play.podtrac.com/npr/9am.mp3?x=1&y=2");
  assert.equal(eps[0].secs, 301);
  assert.equal(eps[0].about, "Top stories & more");
  assert.equal(eps[0].showId, npr.id);
  assert.match(eps[0].id, /^9\d{18}$/);
  assert.equal(feedEpisodeId(npr.id, "g"), feedEpisodeId(npr.id, "g"));
  assert.notEqual(feedEpisodeId(npr.id, "g"), feedEpisodeId(npr.id, "h"));
});

test("Apple's copy wins once it catches up: no bulletin twice", () => {
  const a = { ...feedEpisodes(rss(item("News at 9am ET", new Date(), "https://a/9.mp3")), npr)[0], id: "1001" };
  const f = feedEpisodes(rss(item("News at 9am ET", new Date(), "https://a/9.mp3") + item("News at 10am ET", new Date(), "https://a/10.mp3")), npr);
  assert.deepEqual(mergeFeed([a], f).map((e) => e.title), ["News at 9am ET", "News at 10am ET"]);
  assert.equal(mergeFeed([a], f)[0].id, "1001");
});

test("a round picks up the newest bulletin from the feed when Apple is hours behind", async () => {
  const clock = Date.parse("2026-10-31T13:05:00Z");
  const apple = async (url: string) => {
    if (url.includes("/search")) return { results: [{ wrapperType: "track", kind: "podcast", collectionId: 121493804, collectionName: "NPR News Now", artistName: "NPR", artworkUrl600: "https://x/a.jpg", feedUrl: "https://feeds.npr.org/500005/podcast.xml", genres: ["News"] }] };
    // Apple still has yesterday's 4pm bulletin.
    return { results: [{ wrapperType: "podcastEpisode", kind: "podcast-episode", trackId: 1001, collectionId: 121493804, collectionName: "NPR News Now", trackName: "News at 4pm ET", episodeUrl: "https://a/4pm.mp3", releaseDate: new Date(clock - 21 * 3600_000).toISOString(), trackTimeMillis: 300000 }] };
  };
  const asked: string[] = [];
  const feed = async (url: string) => { asked.push(url); return rss(item("News at 9am ET", new Date(clock - 5 * 60_000), "https://a/9am.mp3") + item("News at 4pm ET", new Date(clock - 21 * 3600_000), "https://a/4pm.mp3")); };
  const svc = nowNewsService({ apple, idle: () => true, newsPool: async () => [], now: () => clock, sleep: async () => {}, feed });
  await svc.round();
  assert.deepEqual(asked, ["https://feeds.npr.org/500005/podcast.xml"]);
  assert.deepEqual(svc.list(6).episodes.map((e) => e.title), ["News at 9am ET"]);
  assert.deepEqual(svc.list(24).episodes.map((e) => e.title), ["News at 9am ET", "News at 4pm ET"]);
  assert.equal(svc.list(24).episodes[1].id, "1001");
});
