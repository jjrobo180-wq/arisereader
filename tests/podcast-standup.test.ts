// Pod+ Stand-up (server/podcastStandup.ts): only stand-up, never interviews.
import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeSet, standupService } from "../server/podcastStandup";

const ep = (id: number, title: string, show: string, about = "") => ({
  kind: "podcast-episode", wrapperType: "podcastEpisode", trackId: id, collectionId: 900 + id, trackName: title, collectionName: show,
  description: about, episodeUrl: `https://cdn.example/${id}.mp3`, releaseDate: `2026-10-${String(10 + id).padStart(2, "0")}T00:00:00Z`, trackTimeMillis: 1800000, artworkUrl600: "https://a.example/x.jpg",
});

test("the first pass drops talk and things about someone else", () => {
  assert.equal(looksLikeSet({ title: "Ali Wong: Baby Cobra (full stand-up set)", show: "Comedy Specials", about: "" }, "Ali Wong"), true);
  assert.equal(looksLikeSet({ title: "Interview with Ali Wong", show: "Fresh Air", about: "stand-up comedian" }, "Ali Wong"), false);
  assert.equal(looksLikeSet({ title: "Live at the Cellar", show: "Comedy Store", about: "Dave Chappelle stand-up" }, "Ali Wong"), false);
});

test("a comedian's page keeps only what the AI says is a performance", async () => {
  const asked: string[] = [];
  const svc = standupService({
    apple: async () => ({ results: [ep(1, "Ali Wong stand-up set: Hard Knock Wife", "Laugh Factory Live"), ep(2, "Ali Wong talks about motherhood", "Some Podcast", "stand-up comedian"), ep(3, "Ali Wong live at the Comedy Store", "Comedy Store Sets", "her stand-up")] }),
    ask: async (_s, u) => { asked.push(u); return '{"keep":["' + "1" + '"]}'; },
  });
  const list = await svc.comic("Ali Wong");
  assert.deepEqual(list.map((e) => e.title), ["Ali Wong stand-up set: Hard Knock Wife"]);
  assert.ok(!asked.join().includes("talks about motherhood"), "clear talk never reaches the AI");
  await svc.comic("Ali Wong");
  assert.equal(asked.length, 1, "kept, not asked again");
});

test("suggestions are new, real names", async () => {
  const svc = standupService({ apple: async () => ({ results: [] }), ask: async () => ({ comics: [{ name: "Ali Wong", why: "x" }, { name: "Taylor Tomlinson", why: "Sharp, personal" }, { name: "taylor tomlinson", why: "dup" }] }) });
  assert.deepEqual((await svc.suggest(["Ali Wong"])).map((c) => c.name), ["Taylor Tomlinson"]);
});
