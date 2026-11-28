import test from "node:test";
import assert from "node:assert/strict";
import { cleanProfile, dwellSignal, isMature, laneOdds, laneUrl, learn, markSeen, mergeProfiles, newProfile, pickLane, pickSeed, rng, toCards, toggleSave, trendTitles, weave, type WikiCard } from "../shared/wikiFeed";

const page = (title: string, o: any = {}) => ({ title, ns: 0, index: 1, extract: "x".repeat(200), description: "d", fullurl: `https://en.wikipedia.org/wiki/${title}`, ...o });

test("Wikipedia's answer becomes cards: no stubs, lists, disambiguation, repeats or mature topics", () => {
  const json = { query: { pages: [
    page("Black hole", { thumbnail: { source: "https://upload.wikimedia.org/a.jpg", width: 900, height: 600 }, index: 2 }),
    page("Mercury", { pageprops: { disambiguation: "" } }),
    page("List of comets"),
    page("Tiny stub", { extract: "Short." }),
    page("Saturn"),
    page("Pornography in Japan"),
  ] } };
  const cards = toCards(json, "seed", "Neutron star", { seen: ["Saturn"], nope: [] });
  assert.deepEqual(cards.map((c) => c.title), ["Black hole"]);
  assert.equal(cards[0].image, "https://upload.wikimedia.org/a.jpg");
  assert.equal(cards[0].from, "Neutron star");
  assert.equal(toCards(json, "seed", undefined, { seen: [], nope: [], matureOff: true }).length, 3);
  assert.ok(isMature({ title: "Erotic art", description: "", extract: "" }));
  assert.ok(!isMature({ title: "Sextant", description: "navigation instrument", extract: "" }));
});

test("it learns: what holds you becomes a seed, its lane and topic gain, skips and 'not for me' push away", () => {
  let p = newProfile(["space", "music"], 1000);
  assert.equal(p.topics.space, 3);
  const before = laneOdds(p);
  assert.equal(before.seed, 0, "no seeds yet");
  p = learn(p, { title: "Black hole", lane: "topic", from: "space" }, "like", 2000);
  assert.ok(p.topics.space > 3);
  assert.equal(p.seeds[0].title, "Black hole");
  for (let i = 0; i < 30; i++) p = learn(p, { title: `Star ${i}`, lane: "seed", from: "Black hole" }, "dwell", 3000 + i);
  for (let i = 0; i < 10; i++) p = learn(p, { title: `Song ${i}`, lane: "topic", from: "music" }, "skip", 5000 + i);
  assert.ok(p.topics.music < 3);
  const after = laneOdds(p);
  assert.ok(after.seed > 0.4, `seed lane leads once it works (${after.seed})`);
  assert.ok(after.explore >= 0.1 - 1e-9, "discovery never stops");
  p = learn(p, { title: "Celebrity gossip", lane: "explore" }, "nope", 9000);
  assert.ok(p.nope.includes("Celebrity gossip"));
  assert.equal(toCards({ query: { pages: [page("Celebrity gossip")] } }, "explore", undefined, p).length, 0);
  assert.equal(dwellSignal(1), "skip");
  assert.equal(dwellSignal(12), "dwell");
});

test("lanes and seeds are drawn in proportion, and the requests ask Wikipedia for the right things", () => {
  let p = newProfile(["history"]);
  p = learn(p, { title: "Roman Empire", lane: "topic", from: "history" }, "share");
  const r = rng(42);
  const counts: Record<string, number> = { seed: 0, topic: 0, trend: 0, explore: 0 };
  for (let i = 0; i < 2000; i++) counts[pickLane(p, r)]++;
  assert.ok(counts.explore > 150 && counts.topic > 300 && counts.seed > 100, JSON.stringify(counts));
  assert.equal(pickSeed(p, rng(1)), "Roman Empire");
  assert.match(laneUrl("seed", "Roman Empire", rng(1)), /gsrsearch=morelike%3ARoman%20Empire/);
  assert.match(laneUrl("topic", "history", rng(1)), /articletopic%3Ahistory/);
  for (let i = 1; i < 40; i++) assert.match(laneUrl("explore", null, rng(i)), /generator=random|articletopic%3A/);
  assert.match(laneUrl("seed", "x", rng(1)), /origin=\*/);
});

test("cards are woven so lanes don't clump, saves toggle, profiles merge across devices", () => {
  const c = (title: string, lane: any, image = false): WikiCard => ({ title, lane, description: "", extract: "", url: "", ...(image ? { image: "https://x/y.jpg" } : {}) });
  const { out } = weave([c("a", "seed"), c("b", "seed"), c("c", "seed"), c("d", "explore", true), c("e", "trend")], 5);
  for (let i = 2; i < out.length; i++) assert.ok(!(out[i].lane === out[i - 1].lane && out[i].lane === out[i - 2].lane), out.map((x) => x.lane).join());
  let p = toggleSave(newProfile(), { title: "Octopus", description: "Mollusc" });
  assert.equal(p.saved.length, 1);
  assert.equal(toggleSave(p, { title: "Octopus", description: "" }).saved.length, 0);
  const phone = markSeen({ ...p, updatedAt: 10 }, ["A", "B"]);
  const laptop = markSeen({ ...newProfile(), updatedAt: 20 }, ["C"]);
  const m = mergeProfiles(phone, laptop);
  assert.deepEqual([...m.seen].sort(), ["A", "B", "C"]);
  assert.equal(m.saved.length, 1, "a save the other device never saw is kept");
  assert.deepEqual(cleanProfile({ topics: { space: 99, bogus: 3 }, seen: ["x", "x", 5] }).topics, { space: 20 });
  assert.deepEqual(trendTitles({ tfa: { title: "Octopus" }, mostread: { articles: [{ title: "Main_Page" }, { title: "Taylor_Swift" }] } }), ["Octopus", "Taylor Swift"]);
});

test("searches and subtopics teach the feed, and a search feed is its results in order with related ones between", async () => {
  const { learnSearch, learnSubtopic, interleave, laneOdds, laneUrl, searchPageUrl, relatedUrl, SUBTOPICS, TOPICS, toCards, newProfile, rng, MIN_BYTES } = await import("../shared/wikiFeed");
  let p = newProfile(["history"], 1000, ["World War II"]);
  assert.equal(p.seeds[0].title, "World War II");
  p = learnSearch(p, "ww2", "World War II", 2000);
  p = learnSearch(p, "WW2", "World War II", 3000);
  assert.equal(p.searches.length, 1, "the same search, any case, is one term that grows");
  assert.equal(p.searches[0].w, 8);
  assert.ok(p.seeds.find((s) => s.title === "World War II")!.w > 4);
  assert.ok(laneOdds(p).search > 0, "searches get their own lane in For you");
  assert.match(laneUrl("search", "ww2", rng(3)), /gsrsearch=ww2/);
  p = learnSubtopic(p, "Ancient Rome", 4000);
  assert.ok(p.seeds.some((s) => s.title === "Ancient Rome"));
  for (const t of TOPICS) assert.ok((SUBTOPICS as any)[t.id]?.length >= 6, `${t.id} has subtopics`);
  assert.ok(SUBTOPICS.history.includes("World War II"));
  assert.match(searchPageUrl("ww2", 2), /gsroffset=40/);
  assert.match(relatedUrl("World War II", 0), /morelike%3AWorld%20War%20II/);
  const c = (title: string, lane: any) => ({ title, lane, description: "", extract: "", url: "" });
  assert.deepEqual(interleave([c("a", "search"), c("b", "search"), c("c", "search")], [c("x", "seed"), c("a", "seed")]).map((x) => x.title), ["a", "b", "x", "c"]);
  // Stubs are left out of For you, never out of a search.
  const stub = { query: { pages: [{ title: "Village hall", ns: 0, extract: "x".repeat(200), length: 1500 }] } };
  assert.equal(toCards(stub, "explore", undefined, { seen: [], nope: [] }).length, 0);
  assert.equal(toCards(stub, "search", "village", { seen: [], nope: [] }).length, 1);
  assert.equal(MIN_BYTES.search, 0);
});
