// Pod+ Wiki podcasts (shared/podWiki.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listenMinutes, parseArticle, parseFeatured, parseSearch, parseSections, wikiArticleUrl, wikiIntro, wikiOutro } from "../shared/podWiki";

test("Wikipedia: search, article sections without reference lists, featured", () => {
  assert.match(wikiArticleUrl("Daylight saving time"), /explaintext=1/); assert.match(wikiArticleUrl("x"), /origin=\*/);
  assert.deepEqual(parseSearch({ query: { search: [{ title: "Daylight saving time", snippet: "<span>clocks</span> &amp; time", wordcount: 9000 }] } }), [{ title: "Daylight saving time", snippet: "clocks & time", words: 9000 }]);
  const text = "Daylight saving time is the practice of advancing clocks during warmer months.\n\n== History ==\nAncient civilizations adjusted daily schedules to the sun, long before clocks.\n=== Benjamin Franklin ===\nFranklin joked about it in a 1784 letter to the Journal of Paris readers.\n== See also ==\nTime zone and other related pages here.\n== References ==\nSome references listed here at length.";
  const s = parseSections(text);
  assert.deepEqual(s.map((x) => x.title), ["Introduction", "History", "History · Benjamin Franklin"]);
  const a = parseArticle({ query: { pages: { 1: { title: "Daylight saving time", fullurl: "https://en.wikipedia.org/wiki/Daylight_saving_time", extract: text, thumbnail: { source: "https://upload.wikimedia.org/x.jpg" } } } } })!;
  assert.equal(a.sections.length, 3); assert.equal(a.image, "https://upload.wikimedia.org/x.jpg");
  assert.equal(parseArticle({ query: { pages: { "-1": { title: "Nope", missing: "" } } } }), null);
  assert.equal(listenMinutes(1500), 10); assert.equal(listenMinutes(1500, 1.5), 7);
  const f = parseFeatured({ tfa: { titles: { normalized: "Ivy Mike" }, extract: "A test." }, mostread: { articles: [{ titles: { normalized: "Main Page" } }, { titles: { normalized: "Halloween" } }] } });
  assert.equal(f.today?.title, "Ivy Mike"); assert.deepEqual(f.popular.map((x) => x.title), ["Halloween"]);
});

test("every Wiki podcast credits Wikipedia and its license, and uses the AI voice", () => {
  assert.match(wikiIntro("X"), /From Wikipedia/); assert.match(wikiOutro("X"), /Creative Commons Attribution Share-Alike/);
  const ui = readFileSync("podscroll/Wiki.tsx", "utf8");
  assert.match(ui, /CC BY-SA|WIKI_LICENSE/); assert.match(ui, /art\.url/); assert.match(ui, /sayAI\(/);
  assert.doesNotMatch(ui, /speechSynthesis/);
  // Dark mode flips dark cards to light unless they're marked ps-keep (Home.tsx DARK_CSS); unmarked, the white text vanished.
  for (const m of ui.matchAll(/className=["{`]+([^"`]*bg-\[#0f0f0f\][^"`]*)/g)) assert.match(m[1], /\bps-keep\b/, m[1]);
  const home = readFileSync("podscroll/Home.tsx", "utf8");
  assert.doesNotMatch(home, /PodcastOfTheDay/, "the Podcast of the day spot was taken out"); assert.match(home, /navItem\("Wiki podcasts"/); assert.match(home, /a === "wiki"/);
});
