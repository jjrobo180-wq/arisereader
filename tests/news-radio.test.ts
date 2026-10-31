// Pod+ Live News Radio (client/src/components/family-hub/earshot/newsRadio.ts) and Live news
// stations (podscroll/Radio.tsx), the separate all-news radio feed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { justIn, newestOf, newsLineup, refill } from "../client/src/components/family-hub/earshot/newsRadio";
import type { PodEpisode } from "../shared/earshot";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = Date.parse("2026-10-31T06:00:00Z");
const ep = (id: string, showId: string, minsAgo: number, secs = 300, audio = `https://cdn.example/${id}.mp3`): PodEpisode => ({
  id, showId, show: showId, author: "", title: id, about: "", audio, date: new Date(NOW - minsAgo * 60_000).toISOString(), secs, art: "", link: "", explicit: false,
});

test("the lineup: newest bulletin of each show, newest first, news-length, https only", () => {
  const list = [ep("npr-1", "npr", 5), ep("npr-0", "npr", 65), ep("cbs-1", "cbs", 20), ep("bbc-1", "bbc", 90),
    ep("long", "pod", 10, 3 * 3600), ep("old", "abc", 13 * 60), ep("future", "fox", -60), ep("http", "ap", 3, 60, "http://x/a.mp3")];
  assert.deepEqual(newsLineup(list, NOW).map((e) => e.id), ["npr-1", "cbs-1", "bbc-1"]);
});

test("a bulletin that comes out while it plays goes in next; nothing twice", () => {
  const first = newsLineup([ep("npr-1", "npr", 30), ep("cbs-1", "cbs", 40)], NOW);
  const queued = new Set(first.map((e) => e.id));
  const later = [ep("npr-2", "npr", 1), ep("npr-1", "npr", 30), ep("cbs-1", "cbs", 40)];
  assert.deepEqual(justIn(later, queued, newestOf(first), NOW).map((e) => e.id), ["npr-2"]);
  assert.deepEqual(justIn(first, queued, newestOf(first), NOW), []);
});

test("it never runs dry: new episodes first, else the latest headlines again", () => {
  const all = [ep("a", "npr", 5), ep("b", "cbs", 10)];
  assert.deepEqual(refill(all, new Set(["a"]), NOW).map((e) => e.id), ["b"]);
  assert.deepEqual(refill(all, new Set(["a", "b"]), NOW).map((e) => e.id), ["a", "b"]);
});

test("Pod+ Home, the menu and Up to the Minute News start it; the player plays it live", () => {
  const home = read("podscroll/Home.tsx"), hubs = read("podscroll/Hubs.tsx"), player = read("client/src/components/family-hub/earshot/EarshotPlayer.tsx");
  assert.match(home, /onNewsRadio=\{\(\) => onOpenFeed\(undefined, undefined, \{ id: NEWS_RADIO_ID, index: 0 \}\)\}/);
  assert.match(home, /navItem\(NEWS_RADIO_NAME/);
  assert.match(hubs, /Pod\+ Live News Radio/);
  assert.match(read("podscroll/Endless.tsx"), /Listen to Pod\+ Live News Radio/);
  assert.match(player, /playMode\.id === NEWS_RADIO_ID\) \{ void startNewsRadio\(\)/);
  assert.match(player, /Just in · \$\{NEWS_RADIO_NAME\}/);
  assert.match(player, /\/api\/earshot\/now\?hours=/);
});

test("Live news stations: a separate feed of stations that are news all day", () => {
  const radio = read("podscroll/Radio.tsx");
  const body = radio.slice(radio.indexOf("const NOT_NEWS"), radio.indexOf("/** Live news stations"));
  // eslint-disable-next-line no-new-func
  const fullTimeNews = new Function(`${body.replace(/export function/, "function").replace(/: Pick<Station, "name" \| "tags">/, "").replace(/\): boolean/, ")")}; return fullTimeNews;`)() as (s: { name: string; tags: string }) => boolean;
  assert.equal(fullTimeNews({ name: "1010 WINS", tags: "news,new york,am" }), true);
  assert.equal(fullTimeNews({ name: "KNX News 97.1", tags: "news talk" }), true, "called news");
  assert.equal(fullTimeNews({ name: "Hits 101", tags: "pop,hits,news" }), false);
  assert.equal(fullTimeNews({ name: "Sports Talk 1500", tags: "sports,news,talk" }), false);
  assert.equal(fullTimeNews({ name: "Morning Show FM", tags: "talk,news" }), false);
  assert.match(read("podscroll/Home.tsx"), /<NewsStationsView onPlay=\{playStation\}/);
});

test("national networks' streams aren't played in Pod+ Radio; local stations are", () => {
  const radio = read("podscroll/Radio.tsx");
  const re = new RegExp(radio.match(/const NETWORKS = \/(.+)\/i;/)![1], "i");
  for (const n of ["CNN", "CNN International", "Fox News Radio", "MSNBC", "BBC World Service", "Bloomberg Radio", "C-SPAN Radio", "NPR News"]) assert.ok(re.test(n), n);
  for (const n of ["1010 WINS", "KQED", "WNYC 93.9 FM", "KEXP", "News Radio 1190"]) assert.ok(!re.test(n), n);
  assert.match(radio, /&& !isNetwork\(s\);/, "left out of every Radio list, Live news stations too");
});
