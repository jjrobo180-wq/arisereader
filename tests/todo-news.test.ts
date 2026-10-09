import test from "node:test";
import assert from "node:assert/strict";
import { newsFeedUrl, parseNewsRss } from "../shared/todoNews";

test("news feed addresses", () => {
  assert.equal(newsFeedUrl("top"), "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en");
  assert.equal(newsFeedUrl("WORLD"), "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en");
  assert.equal(newsFeedUrl("local", "Denver, CO"), "https://news.google.com/rss/search?q=Denver%2C%20CO&hl=en-US&gl=US&ceid=US:en");
  assert.equal(newsFeedUrl("local", ""), null);
  assert.equal(newsFeedUrl("NOPE"), null);
  assert.equal(newsFeedUrl("search", "<script>"), "https://news.google.com/rss/search?q=script&hl=en-US&gl=US&ceid=US:en");
});

test("RSS items become headlines without the source suffix, newest first, no repeats", () => {
  const xml = `<rss><channel><title>Top</title>
  <item><title>Storm hits coast &amp; more - The Weather Desk</title><link>https://news.google.com/rss/articles/a1</link><pubDate>Fri, 09 Oct 2026 14:00:00 GMT</pubDate><source url="https://w.example">The Weather Desk</source></item>
  <item><title><![CDATA[Markets rise after report - Daily Ledger]]></title><link>https://news.google.com/rss/articles/b2</link><pubDate>Fri, 09 Oct 2026 16:30:00 GMT</pubDate><source url="https://l.example">Daily Ledger</source></item>
  <item><title>Storm hits coast &amp; more - Other Paper</title><link>https://news.google.com/rss/articles/c3</link><pubDate>Fri, 09 Oct 2026 12:00:00 GMT</pubDate><source url="https://o.example">Other Paper</source></item>
  <item><title>No link</title><link>javascript:alert(1)</link></item>
  </channel></rss>`;
  assert.deepEqual(parseNewsRss(xml).map((h) => [h.title, h.source]), [["Markets rise after report", "Daily Ledger"], ["Storm hits coast & more", "The Weather Desk"]]);
});
