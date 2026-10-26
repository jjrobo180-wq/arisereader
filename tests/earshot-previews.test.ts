// Swipe previews pick a show's own trailer or opener (no AI), and the AI finder answers with a plain
// search when no AI can (OpenAI out of credit, Groq's request too big or used up).
import test from "node:test";
import assert from "node:assert/strict";
import { previewEpisode, previewKind } from "../shared/earshot";
import { createDirectory, findWords, memoryKV } from "../server/podcastDirectory";

const e = (title: string, secs: number, audio = "https://cdn/a.mp3") => ({ title, secs, audio });

test("previews: what kind of preview each episode makes", () => {
  assert.equal(previewKind(e("Official Trailer", 140)), "trailer");
  assert.equal(previewKind(e("Introducing: The Lake House", 1800)), "trailer");
  assert.equal(previewKind(e("A short one", 90)), "trailer", "anything under about three minutes is a teaser");
  assert.equal(previewKind(e("Season 3 Premiere: Back at it", 2400)), "opener");
  assert.equal(previewKind(e("Episode 1: How it started", 2400)), "opener");
  assert.equal(previewKind(e("Ep. 1 - Pilot", 2400)), "opener");
  assert.equal(previewKind(e("S2E1 The return", 2400)), "opener");
  assert.equal(previewKind(e("Episode 12: More news", 2400)), "top", "episode 12 isn't episode 1");
  assert.equal(previewKind(e("Episode 100", 2400)), "top");
  assert.equal(previewKind(e("Why cats purr", 2400)), "top");
});

test("previews: the show's trailer first, then an opener, then the newest full episode", () => {
  assert.equal(previewEpisode([e("Why cats purr", 2400), e("Season 2 premiere", 2400), e("Trailer", 120)])?.title, "Trailer");
  assert.equal(previewEpisode([e("Why cats purr", 2400), e("Episode 1: Hello", 2400)])?.title, "Episode 1: Hello");
  assert.equal(previewEpisode([e("Bonus clip", 60), e("Why cats purr", 2400)])?.title, "Bonus clip", "a short teaser the show put out is the preview");
  assert.equal(previewEpisode([e("Trailer", 10), e("Why cats purr", 2400)])?.title, "Why cats purr", "a 10-second stinger isn't a trailer to preview");
  assert.equal(previewEpisode([e("No audio trailer", 120, ""), e("Why cats purr", 2400)])?.title, "Why cats purr");
  assert.equal(previewEpisode([]), null);
});

test("AI finder: the words worth matching", () => {
  assert.deepEqual(findWords("A cozy mystery podcast for my commute"), ["cozy", "mystery", "commute"]);
  assert.deepEqual(findWords("I want something about the Roman empire!"), ["roman", "empire"]);
});

const show = (id: number, name: string) => ({ kind: "podcast", collectionId: id, collectionName: name, artistName: "Host", primaryGenreName: "History", genres: ["History"], artworkUrl600: "https://a/600x600bb.jpg", feedUrl: "https://feed/" + id, releaseDate: new Date().toISOString() });
const fetcher: any = async (url: string) => (/term=/.test(url) ? { results: [show(77, "Rome Unboxed"), show(78, "Empire Hour")] } : { results: [] });
fetcher.idle = () => true;
const web: any = async () => new Response("<rss></rss>");

test("AI finder: when every AI says no, a plain search still answers", async () => {
  const dir = createDirectory({ fetcher, kv: memoryKV(), web, aiOn: () => true, ask: async () => { throw new Error("busy"); } });
  const out = await dir.aiFind("the roman empire", { explicit: false, kidOnly: false });
  assert.equal(out.ai, false);
  assert.deepEqual(out.picks.map((p) => p.show.name), ["Rome Unboxed", "Empire Hour"]);
  assert.ok(out.summary.length > 0);
});

test("AI finder: with no AI switched on, it searches instead of failing", async () => {
  let asked = 0;
  const dir = createDirectory({ fetcher, kv: memoryKV(), web, aiOn: () => false, ask: async () => { asked++; return "{}"; } });
  const out = await dir.aiFind("roman history", { explicit: false, kidOnly: false });
  assert.equal(asked, 0);
  assert.equal(out.picks.length, 2);
});

test("AI finder: an AI answer that names nothing real falls back to the search", async () => {
  const dir = createDirectory({ fetcher, kv: memoryKV(), web, aiOn: () => true, ask: async () => JSON.stringify({ summary: "x", picks: [] }) });
  const out = await dir.aiFind("roman history", { explicit: false, kidOnly: false });
  assert.equal(out.ai, false);
  assert.equal(out.picks[0].show.name, "Rome Unboxed");
});
