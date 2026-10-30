import test from "node:test";
import assert from "node:assert/strict";
import { parseLines, parseOpml, showMatch, importItem } from "../shared/podImport";
import { findShow } from "../server/podcastImport";

const OPML = `<?xml version="1.0" encoding="utf-8"?>
<opml version="1.0"><head><title>Overcast Podcast Subscriptions</title></head><body>
<outline text="feeds">
  <outline type="rss" text="The Daily" title="The Daily" xmlUrl="https://feeds.simplecast.com/54nAGcIl" htmlUrl="https://www.nytimes.com"/>
  <outline type="rss" text="Radiolab" xmlUrl="http://feeds.wnyc.org/radiolab"/>
  <outline type="rss" text="Tom &amp; Jerry&apos;s Show" xmlUrl="https://example.com/feed.xml?x=1"/>
  <outline type="rss" text="Radiolab (dup)" xmlUrl="https://feeds.wnyc.org/radiolab/"/>
</outline></body></opml>`;

test("an OPML export: every show with its feed, folders skipped, entities decoded, no doubles", () => {
  const items = parseOpml(OPML);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], { feed: "https://feeds.simplecast.com/54nAGcIl", title: "The Daily" });
  assert.equal(items[2].title, "Tom & Jerry's Show");
});

test("pasted lines: names, Apple and Spotify links, feeds, list markers", () => {
  const items = parseLines("1. The Daily\n- https://podcasts.apple.com/us/podcast/radiolab/id152249110\nhttps://open.spotify.com/show/2MAi0BvDc6GTFvKFPXnkCL?si=abc\nhttps://feeds.example.com/show.rss\n\n• Hidden Brain");
  assert.deepEqual(items, [{ title: "The Daily" }, { appleId: "152249110" }, { spotify: "https://open.spotify.com/show/2MAi0BvDc6GTFvKFPXnkCL" }, { feed: "https://feeds.example.com/show.rss" }, { title: "Hidden Brain" }]);
  assert.equal(parseLines(OPML).length, 3);
  assert.equal(importItem({ title: "x" }), null);
  assert.equal(importItem({ spotify: "https://evil.example/show/x" }), null);
});

test("matching a show by name: exact, small differences, and no wrong guesses", () => {
  const shows = [{ name: "The Daily" }, { name: "Daily Wire Podcast" }];
  assert.equal(showMatch("the daily", shows)?.name, "The Daily");
  assert.equal(showMatch("Hidden Brain", [{ name: "Hidden Brain with Shankar Vedantam" }])?.name, "Hidden Brain with Shankar Vedantam");
  assert.equal(showMatch("Cooking Weekly", [{ name: "Sports Talk" }]), null);
});

test("finding: by Apple id, by feed address before the name, and not found", async () => {
  const urls: string[] = [];
  const result = (id: string, name: string, feed = "") => ({ kind: "podcast", collectionId: Number(id), collectionName: name, artistName: "A", artworkUrl600: "https://is1-ssl.mzstatic.com/a/600x600bb.jpg", feedUrl: feed, primaryGenreName: "News" });
  const apple = async (url: string) => {
    urls.push(url);
    if (url.includes("lookup")) return { results: [result("152249110", "Radiolab")] };
    if (url.includes("term=The+Daily")) return { results: [result("1", "The Daily Show"), result("1200361736", "The Daily", "https://feeds.simplecast.com/54nAGcIl")] };
    return { results: [] };
  };
  const d = { apple, cached: (_k: string, make: () => Promise<any>) => make(), web: (async () => new Response("", { status: 404 })) as any };
  assert.equal((await findShow({ appleId: "152249110" }, d))?.name, "Radiolab");
  assert.equal((await findShow({ title: "The Daily", feed: "http://feeds.simplecast.com/54nAGcIl/" }, d))?.id, "1200361736");
  assert.equal(await findShow({ title: "Nothing Like This" }, d), null);
});

test("Pod+ has a Bring your shows page in its menus", async () => {
  const { readFileSync } = await import("node:fs");
  const home = readFileSync("podscroll/Home.tsx", "utf8");
  assert.match(home, /navItem\("Bring your shows"/);
  assert.match(home, /view\.kind === "import"/);
  assert.match(readFileSync("server/earshot.ts", "utf8"), /registerImportRoutes\(app, authMiddleware, P/);
});
