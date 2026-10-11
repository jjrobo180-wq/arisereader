// The eight LifeHub plugins from the Plugin Store: off until added, data kept safely, feeds read right.
import test from "node:test";
import assert from "node:assert/strict";
import { ADD_ON_SECTIONS, TOGGLEABLE, cleanFamily, emptyFamily, isCurrentFamily, isOn } from "../shared/familyHub";
import { PLUGINS, lifeInstalled, setLifePlugin } from "../shared/pluginStore";
import { VERSES, QUOTES, cleanReference, daysUntil, forDay, guessAisle, parseMostRead, parseOnThisDay, parseTrendsRss, safeUrl } from "../shared/lifePlugins";

test("the new sections start off, and adding one from the store turns it on", () => {
  const f = emptyFamily();
  for (const s of ADD_ON_SECTIONS) {
    assert.ok(TOGGLEABLE.includes(s), s);
    assert.equal(isOn(s, f), false, `${s} starts off`);
    const p = PLUGINS.find((q) => q.target.kind === "section" && q.target.section === s);
    assert.ok(p, `${s} is in the store`);
    assert.equal(lifeInstalled(p!, f), false);
    assert.equal(isOn(s, setLifePlugin(f, p!, true)), true);
  }
  assert.equal(isOn("chores", f), true, "the usual sections still start on");
});

test("a saved family keeps journal, countdowns, groceries, verses, meditation and quotes, cleaned", () => {
  const raw = {
    ...emptyFamily(),
    sections: { journal: true, grocery: true, bogus: true },
    journal: [{ id: "j1", date: "2026-10-10", title: "Hi", body: "A good day.", mood: "😊", createdAt: "x" }, { id: "j2", date: "nope", body: "bad date" }, { id: "j3", date: "2026-10-09", body: "  " }],
    countdowns: [{ id: "c1", title: "Trip", date: "2026-12-20", emoji: "✈️", color: "#ff0000" }, { id: "c2", title: "", date: "2026-12-20" }],
    groceries: [{ id: "g1", name: "Milk", qty: "2", aisle: "Dairy & eggs", checked: false }, { id: "g2", name: "" }],
    savedVerses: [{ id: "v1", reference: "John 3:16", text: "For God so loved the world" }],
    meditations: [{ id: "m1", date: "2026-10-10", minutes: 5, kind: "calm" }, { id: "m2", date: "2026-10-10", minutes: 99999, kind: "x" }],
    savedQuotes: ["q1", "q1", 5, "q2"],
  };
  const f = cleanFamily(raw);
  assert.deepEqual(f.sections, { journal: true, grocery: true });
  assert.deepEqual(f.journal.map((e) => e.id), ["j1"]);
  assert.deepEqual(f.countdowns.map((c) => c.id), ["c1"]);
  assert.deepEqual(f.groceries.map((g) => g.id), ["g1"]);
  assert.equal(f.savedVerses.length, 1);
  assert.equal(f.meditations[1].minutes, 600, "minutes are capped");
  assert.deepEqual(f.savedQuotes, ["q1", "q2"]);
  assert.ok(isCurrentFamily(f));
  // An older saved family without the new lists is cleaned (and so gets empty ones) before use.
  const old: any = { ...emptyFamily() };
  delete old.journal;
  assert.equal(isCurrentFamily(old), false);
  assert.deepEqual(cleanFamily(old).journal, []);
});

test("the daily picks are the same all day and the content is well-formed", () => {
  assert.equal(forDay(VERSES, "2026-10-10"), forDay(VERSES, "2026-10-10"));
  assert.ok(new Set(["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"].map((d) => forDay(QUOTES, d).id)).size > 1);
  assert.equal(new Set(QUOTES.map((q) => q.id)).size, QUOTES.length);
  for (const v of VERSES) assert.ok(cleanReference(v.reference), v.reference);
  assert.equal(daysUntil("2026-12-25", "2026-10-10"), 76);
  assert.equal(daysUntil("2026-10-10", "2026-10-10"), 0);
});

test("Bible references are checked before they're looked up", () => {
  for (const ok of ["John 3:16", "Psalm 23", "1 Corinthians 13:4-7", "Song of Solomon 2", "Romans 8:28-39"]) assert.ok(cleanReference(ok), ok);
  for (const bad of ["", "javascript:alert(1)", "John", "<b>John 3</b>", "x".repeat(80) + " 1"]) assert.equal(cleanReference(bad), "", bad);
});

test("grocery items find their aisle", () => {
  assert.equal(guessAisle("Bananas"), "Produce");
  assert.equal(guessAisle("2% milk"), "Dairy & eggs");
  assert.equal(guessAisle("Chicken thighs"), "Meat & fish");
  assert.equal(guessAisle("Paper towels"), "Household");
  assert.equal(guessAisle("Mystery item"), "Other");
});

test("the trending and history feeds are read safely", () => {
  const rss = `<rss><channel><item><title>World Series</title><ht:approx_traffic>500K+</ht:approx_traffic><ht:picture>https://x.test/a.jpg</ht:picture>
    <ht:news_item><ht:news_item_title><![CDATA[Game 1 recap &amp; more]]></ht:news_item_title><ht:news_item_url>https://news.test/1</ht:news_item_url><ht:news_item_source>News</ht:news_item_source></ht:news_item>
    <ht:news_item><ht:news_item_title>Bad link</ht:news_item_title><ht:news_item_url>javascript:alert(1)</ht:news_item_url></ht:news_item></item></channel></rss>`;
  const t = parseTrendsRss(rss);
  assert.equal(t[0].title, "World Series");
  assert.equal(t[0].traffic, "500K+");
  assert.deepEqual(t[0].news, [{ title: "Game 1 recap & more", url: "https://news.test/1", source: "News" }]);
  const mr = parseMostRead({ mostread: { articles: [{ titles: { normalized: "Main Page" } }, { titles: { normalized: "Moon" }, views: 1000, content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Moon" } } }] } });
  assert.deepEqual(mr.map((a) => a.title), ["Moon"]);
  const h = parseOnThisDay([{ year: 1900, text: "Old", pages: [] }, { year: 2000, text: "New", pages: [{ titles: { normalized: "X" }, content_urls: { desktop: { page: "https://w.test/X" } } }] }, { text: "" }]);
  assert.deepEqual(h.map((e) => e.year), [2000, 1900]);
  assert.equal(safeUrl("javascript:alert(1)"), "");
});
