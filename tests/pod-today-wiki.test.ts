// Pod+ "Podcast of the day" (shared/podToday.ts) and Wiki podcasts (shared/podWiki.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { easter, historyTheme, movingHolidays, nthWeekday, onThisDayUrl, parseOnThisDay, todayThemes } from "../shared/podToday";
import { listenMinutes, parseArticle, parseFeatured, parseSearch, parseSections, wikiArticleUrl, wikiIntro, wikiOutro } from "../shared/podWiki";

test("moving holidays land on the right days", () => {
  assert.equal(nthWeekday(2026, 11, 0, 1), 1, "first Sunday of November 2026 is the 1st");
  assert.equal(nthWeekday(2026, 3, 0, 2), 8, "second Sunday of March 2026");
  assert.equal(nthWeekday(2026, 11, 4, 4), 26, "Thanksgiving 2026");
  assert.equal(nthWeekday(2026, 5, 1, -1), 25, "Memorial Day 2026");
  assert.deepEqual(easter(2026), { month: 4, day: 5 }); assert.deepEqual(easter(2027), { month: 3, day: 28 });
  assert.ok(movingHolidays(2026)["11-3"]?.title.includes("Election"), "Election Day 2026 is November 3");
  assert.equal(movingHolidays(2027)["11-2"], undefined, "no Election Day theme in odd years");
});

test("today's theme: the day daylight saving time ends is about daylight saving time", () => {
  const t = todayThemes(new Date(2026, 10, 1, 9));
  assert.equal(t[0].title, "Daylight saving time ends"); assert.match(t[0].query, /daylight saving/);
  assert.equal(todayThemes(new Date(2026, 6, 4))[0].title, "Independence Day");
  assert.equal(todayThemes(new Date(2026, 9, 31))[0].title, "Halloween");
  assert.deepEqual(todayThemes(new Date(2026, 1, 17)), [], "an ordinary day has no holiday theme");
});

test("on this day: Wikipedia's feed becomes a history theme", () => {
  assert.equal(onThisDayUrl(new Date(2026, 10, 1)), "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/11/01");
  const ev = parseOnThisDay({ selected: [{ year: 1952, text: "The US tests the first hydrogen bomb.", pages: [{ normalizedtitle: "Ivy Mike" }] }, { year: 1755, text: "An earthquake destroys Lisbon.", pages: [{ title: "1755_Lisbon_earthquake" }] }, { text: "no year" }] });
  assert.deepEqual(ev.map((e) => e.year), [1952, 1755]); assert.equal(ev[1].topic, "1755 Lisbon earthquake");
  const th = historyTheme(ev, new Date(2026, 10, 1))!;
  assert.equal(th.title, "On this day in 1952"); assert.equal(th.query, "Ivy Mike");
  assert.equal(historyTheme([]), null);
});

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
  assert.match(home, /<PodcastOfTheDay /); assert.match(home, /navItem\("Wiki podcasts"/); assert.match(home, /a === "wiki"/);
});
