// Pod+ "Top shows": Apple's chart feed read correctly, sub-genres filtered, and topics ranked by real
// size and chart position, so a one-episode show named after the topic never comes first.
import test from "node:test";
import assert from "node:assert/strict";
import { genreTop, parseChart, rankTopic } from "../server/podcastTop";
import type { PodShow } from "../shared/earshot";

const entry = (id: string, name: string, category = "News") => ({
  "im:name": { label: name }, "im:artist": { label: "Someone" },
  "im:image": [{ label: "https://is1.mzstatic.com/a/55x55bb.png" }, { label: "https://is1.mzstatic.com/a/170x170bb.png" }],
  id: { attributes: { "im:id": id } }, category: { attributes: { label: category, term: category } },
});

test("chart feed: shows in chart order, junk skipped", () => {
  const list = parseChart({ feed: { entry: [entry("101", "The Daily"), { nonsense: true }, entry("102", "Up First")] } });
  assert.deepEqual(list.map((s) => [s.id, s.chart]), [["101", 1], ["102", 3]]);
  assert.equal(list[0].art, "https://is1.mzstatic.com/a/170x170bb.png");
  assert.deepEqual(parseChart({ feed: { entry: entry("7", "Only one") } }).map((s) => s.id), ["7"], "a single entry isn't a list");
  assert.deepEqual(parseChart(null), []);
});

test("sub-genres use the parent chart's matching shows when there are enough", () => {
  const chart = parseChart({ feed: { entry: [
    ...Array.from({ length: 9 }, (_, i) => entry(String(200 + i), `Invest ${i}`, "Investing")),
    ...Array.from({ length: 5 }, (_, i) => entry(String(300 + i), `Biz ${i}`, "Business")),
  ] } });
  assert.ok(genreTop(chart, "money").every((s) => s.category === "Investing"));
  assert.equal(genreTop(chart, "business").length, 14, "a top-level genre takes its whole chart");
});

test("topics: charting and established shows first; tiny name matches don't make it", () => {
  const show = (id: string, name: string, episodes: number): PodShow => ({ id, name, author: "", art: "https://x/a.jpg", genre: "news", appleGenre: "News", link: "", episodes, explicit: false, latest: "" });
  const shows = [show("1", "Obama Talks", 1), show("2", "Pod Save America", 900), show("3", "The Daily", 2500), show("4", "Small Politics Pod", 40), show("5", "Obama Fan Pod", 12)];
  const mentions = new Map([["2", 9], ["3", 4], ["4", 2], ["1", 1]]);
  const charts = new Map([["3", 2], ["2", 40]]);
  const ranked = rankTopic({ mentions, shows, charts }).map((s) => s.id);
  assert.deepEqual(ranked, ["3", "2", "4"], "chart first, then size; the 1- and 12-episode shows are left out");
});
