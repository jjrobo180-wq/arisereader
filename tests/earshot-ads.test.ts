// Smart ad skip (Earshot + Podscroll): the ad finder, show memory, exact cuts, MP3 length,
// lining ads up with a listener's copy, and listeners' shared marks, votes and skips.
import test from "node:test";
import assert from "node:assert/strict";
import { mp3Duration, lineAdScore, phraseAds, quoteTime, adsFromAiV2, alignAds, clusterMarks, clusterSkips, learnProfile, profileHints, learnedPreroll, emptyProfile, combineAds } from "../shared/earshotAds";
import { cleanEarshot } from "../shared/earshot";
import { createDirectory, memoryKV } from "../server/podcastDirectory";
import { memoryAdStore, registerAdRoutes } from "../server/podcastAds";
const ok = (c: unknown, m: string) => assert.ok(c, m);

test("the ad finder: phrases, AI cuts, show memory, copies, MP3 length", async () => {
// MP3: ID3 (no body) + CBR frames 128k/44.1k
const frame = () => { const f = new Uint8Array(417); f.set([0xff, 0xfb, 0x90, 0x00]); return f; };
const build = (n: number, xing?: number) => { const parts: Uint8Array[] = [new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0])]; for (let i = 0; i < n; i++) { const f = frame(); if (i === 0 && xing) { f.set([0x49, 0x6e, 0x66, 0x6f, 0, 0, 0, 1, (xing >>> 24) & 255, (xing >>> 16) & 255, (xing >>> 8) & 255, xing & 255], 4 + 32); } parts.push(f); } const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const cbr = build(40); const total = 10 + 417 * 100000;
ok(Math.abs(mp3Duration(cbr, total)! - (417 * 100000 * 8) / 128000) < 0.01, "CBR duration");
const x = build(40, 1000); ok(Math.abs(mp3Duration(x, 999999)! - (1000 * 1152) / 44100) < 0.001, "Xing frame-count duration");
ok(mp3Duration(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 100) === null, "not mp3");
// phrases
ok(lineAdScore("This episode is brought to you by Squarespace. Go to squarespace dot com slash daily for 10% off.") >= 9, "strong ad line");
ok(lineAdScore("We talked about Netflix and the history of streaming.") <= 1, "content mentioning a brand stays low");
const segs = [
  { s: 0, e: 10, t: "Welcome back to the show, today we talk about bees." },
  { s: 10, e: 20, t: "Bees are incredible pollinators." },
  { s: 20, e: 30, t: "This episode is brought to you by BetterHelp." },
  { s: 30, e: 45, t: "Therapy can help with anything, and it's online." },
  { s: 45, e: 60, t: "Visit betterhelp dot com slash bees today to get 10% off your first month." },
  { s: 60, e: 70, t: "And we're back. So, the queen bee." },
];
const ph = phraseAds(segs); ok(ph.length === 1 && ph[0].s === 20 && ph[0].e >= 60, `phrase block ${JSON.stringify(ph)}`);
// quote refinement
const words = [{ s: 58, e: 59, w: "Visit" }, { s: 59, e: 60, w: "today." }, { s: 60.2, e: 60.6, w: "And" }, { s: 60.6, e: 60.9, w: "we're" }, { s: 60.9, e: 61.2, w: "back." }, { s: 61.5, e: 62, w: "So," }];
ok(quoteTime(words, "and we're back", { s: 60, e: 70 }, "end") === 61.2, "quote end time");
const ai = adsFromAiV2('{"ads":[{"from":2,"to":5,"start":"This episode is brought","end":"and we\'re back","label":"BetterHelp","confidence":0.95}]}', segs, words);
ok(ai.length === 1 && ai[0].s === 20 && ai[0].e === 61.2 && ai[0].label === "BetterHelp", `AI v2 refine ${JSON.stringify(ai)}`);
// combine
const comb = combineAds(ai, ph, null, []); ok(comb.length === 1 && comb[0].kind === "ai", "combine dedupes phrase under AI");
// alignment
const sv = [{ key: "a1", s: 0, e: 60, label: "Pre-roll", kind: "ai" as const, conf: 0.9, dur: 3000, durMode: "exact" as const }, { key: "a2", s: 900, e: 960, label: "X", kind: "ai" as const, conf: 0.9, dur: 3000, durMode: "exact" as const }];
let al = alignAds(sv, 3000.8); ok(al.length === 2 && al.every((a) => a.sure), "same copy: both sure");
al = alignAds(sv, 3045); ok(al.length === 1 && al[0].key === "a1" && !al[0].sure, "other copy: only the first, as ask");
al = alignAds([{ key: "u:1", s: 100, e: 160, label: "Ad", kind: "user", conf: 1, dur: 3045, durMode: "exact" }, ...sv], 3045); ok(al.some((a) => a.key === "u:1" && a.sure), "a listener's mark for my copy is sure");
al = alignAds([{ ...sv[0], score: 0 }], 3000); ok(al.length === 0, "voted down: hidden");
// clusters
const cm = clusterMarks([{ id: "5", s: 100, e: 160, dur: 3000, voter: "a" }, { id: "7", s: 102, e: 158, dur: 3000.5, voter: "b" }, { id: "9", s: 100, e: 160, dur: 3100, voter: "c" }]);
ok(cm.length === 2 && cm.find((c) => c.key === "u:5")?.support === 2, "marks group by copy and overlap");
const cs = clusterSkips([{ from: 100, to: 130, dur: 3000, voter: "a" }, { from: 103, to: 133, dur: 3000, voter: "b" }, { from: 98, to: 128, dur: 3000, voter: "c" }, { from: 500, to: 530, dur: 3000, voter: "a" }]);
ok(cs.length === 1 && cs[0].support === 3, "skips need 3 listeners");
// profile
let p = emptyProfile();
const ep = (intro: string, sponsor: string) => [{ s: 0, e: 15, t: `This show is brought to you by ${sponsor}.` }, { s: 15, e: 40, t: `Go to ${sponsor.toLowerCase()} dot com slash show.` }, { s: 41, e: 50, t: intro }, { s: 50, e: 60, t: "Today we talk about something." }];
p = learnProfile(p, "e1", ep("From the studio, this is Deep Dive.", "Acme"), [{ s: 0, e: 41, label: "Acme", conf: 0.9 }]);
p = learnProfile(p, "e2", ep("From the studio, this is Deep Dive.", "Acme"), [{ s: 0, e: 41, label: "Acme", conf: 0.9 }]);
const h = profileHints(p, "Deep Dive"); ok(h.sponsors?.includes("acme") && h.intro === "from the studio this is deep" && h.preroll === 41, `profile ${JSON.stringify(h)}`);
const pre = learnedPreroll([{ s: 0, e: 20, t: "Our partner today makes great shoes." }, { s: 20, e: 55, t: "Find them online." }, { s: 55, e: 60, t: "From the studio, this is Deep Dive." }], [], h);
ok(pre?.s === 0 && pre?.e === 55, `learned pre-roll ${JSON.stringify(pre)}`);

});

test("ads end to end: found by AI, voted down, marked by listeners, skipped by many", async () => {
const show = (id: number) => ({ kind: "podcast", collectionId: id, collectionName: "Show " + id, artistName: "H", primaryGenreName: "History", genres: ["History"], artworkUrl600: "https://a/600x600bb.jpg", feedUrl: "https://feed/" + id, releaseDate: new Date().toISOString() });
const ep = (id: number, sid: number) => ({ wrapperType: "podcastEpisode", kind: "podcast-episode", trackId: id, collectionId: sid, collectionName: "Show " + sid, trackName: "E" + id, episodeUrl: "https://cdn/e" + id + ".mp3", releaseDate: "2026-10-01T00:00:00Z", trackTimeMillis: 1_200_000 });
const fetcher: any = async (url: string) => { const id = Number(new URL(url).searchParams.get("id")); return { results: [show(id), ep(id * 10 + 1, id)] }; }; fetcher.idle = () => true;
// A real-looking MP3 head: CBR 128k frames, so the server measures the copy's exact length.
const head = (() => { const out = new Uint8Array(16384); for (let o = 0; o + 417 <= out.length; o += 417) out.set([0xff, 0xfb, 0x90, 0x00], o); return out; })();
const TOTAL = 417 * 46000; // ~1199.7s
const web: any = async (url: string, init: any) => {
  if (url.startsWith("https://feed/")) return new Response("<rss></rss>");
  const r = String(init?.headers?.Range || "");
  if (r === "bytes=0-16383") return new Response(head, { status: 206, headers: { "content-range": `bytes 0-16383/${TOTAL}`, "content-type": "audio/mpeg" } });
  return new Response(new Uint8Array(1000), { status: 206, headers: { "content-type": "audio/mpeg" } });
};
const transcribe = async () => ({
  segments: [{ start: 0, end: 20, text: "This episode is brought to you by BetterHelp." }, { start: 20, end: 45, text: "Visit betterhelp dot com slash show for 10% off." }, { start: 45, end: 60, text: "Welcome to the show, I'm your host." }, { start: 60, end: 120, text: "Today we talk about the Roman empire." }],
  words: [{ start: 0, end: 0.4, word: "This" }, { start: 0.4, end: 0.8, word: "episode" }, { start: 0.8, end: 1.1, word: "is" }, { start: 1.1, end: 1.5, word: "brought" }, { start: 43, end: 43.5, word: "10%" }, { start: 43.5, end: 44.2, word: "off." }, { start: 45.1, end: 45.5, word: "Welcome" }],
});
const ask = async () => JSON.stringify({ ads: [{ from: 0, to: 1, start: "This episode is brought", end: "10% off", label: "BetterHelp", confidence: 0.95 }] });
const dir = createDirectory({ fetcher, kv: memoryKV(), web, ask, transcribe, aiOn: () => true });
const store = memoryAdStore();
const routes: Record<string, Function[]> = {};
const app: any = {}; for (const m of ["get", "post", "delete"]) app[m] = (p: string, ...h: Function[]) => { routes[`${m} ${p}`] = h; };
registerAdRoutes(app, (_q: any, _s: any, n: any) => n(), { prefix: "/api/x", dir, store, voterOf: (req: any) => req.who });
async function call(key: string, req: any) { const h = routes[key]; const out: any = { status: 200 }; const res: any = { set() { return res; }, status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } }; await h[h.length - 1]({ query: {}, params: {}, body: {}, ...req }, res); return out; }
await (async () => {
  const piece = await dir.transcript("1", "11", 0);
  ok(piece.dur && Math.abs(piece.dur - (TOTAL * 8) / 128000) < 0.01, `server measured its copy: ${piece.dur}`);
  ok(piece.ads.length === 1 && piece.ads[0].s === 0 && piece.ads[0].e === 44.2 && piece.ads[0].kind === "ai", `AI ad cut at exact words ${JSON.stringify(piece.ads)}`);
  let r = await call("get /api/x/ads/:episodeId", { who: "u1", params: { episodeId: "11" } });
  const auto = r.body.ads.find((a: any) => a.kind === "ai");
  ok(auto && auto.dur === piece.dur, "ads endpoint returns found ads with the copy length");
  ok(alignAds(r.body.ads, piece.dur!)[0]?.sure === true, "same copy: auto-skip");
  // Listener says it's not an ad: hidden for them; the next listener still sees it until it's voted down overall
  await call("post /api/x/ads/:episodeId/vote", { who: "u1", params: { episodeId: "11" }, body: { key: auto.key, vote: -1 } });
  r = await call("get /api/x/ads/:episodeId", { who: "u1", params: { episodeId: "11" } }); ok(!r.body.ads.some((a: any) => a.key === auto.key), "my 'not an ad' hides it for me");
  r = await call("get /api/x/ads/:episodeId", { who: "u2", params: { episodeId: "11" } }); ok(!r.body.ads.some((a: any) => a.key === auto.key), "one 'not an ad' with no support hides an automatic find");
  // Marks from two listeners on a different copy (stitched ads): grouped, sure for that copy
  r = await call("post /api/x/ads/:episodeId/mark", { who: "d9", params: { episodeId: "11" }, body: { showId: "1", s: 300, e: 361, dur: 1260.4, label: "Squarespace" } });
  ok(r.status === 200 && r.body.id, "mark saved");
  await call("post /api/x/ads/:episodeId/mark", { who: "u3", params: { episodeId: "11" }, body: { showId: "1", s: 302, e: 359, dur: 1260.9 } });
  r = await call("get /api/x/ads/:episodeId", { who: "u4", params: { episodeId: "11" } });
  const user = r.body.ads.find((a: any) => a.kind === "user"); ok(user && user.support === 2 && user.label === "Squarespace", "two listeners' marks become one shared ad");
  ok(alignAds(r.body.ads, 1260.6).some((a) => a.kind === "user" && a.sure), "it's skipped for a listener with that copy");
  ok(!alignAds(r.body.ads, 1199.7).some((a) => a.kind === "user"), "but not on a different copy");
  ok((await call("post /api/x/ads/:episodeId/mark", { who: "u4", params: { episodeId: "11" }, body: { s: 10, e: 11, dur: 100 } })).status === 400, "too-short mark refused");
  // Three listeners skip the same spot -> offered as 'Listeners skip this'
  for (const who of ["a", "b", "c"]) await call("post /api/x/ads/:episodeId/skip", { who, params: { episodeId: "11" }, body: { from: 600 + who.charCodeAt(0) % 3, to: 650, dur: 1199.7 } });
  r = await call("get /api/x/ads/:episodeId", { who: "z", params: { episodeId: "11" } });
  const crowd = r.body.ads.find((a: any) => a.kind === "crowd"); ok(crowd && crowd.support === 3, "skip spots shared");
  ok(alignAds(r.body.ads, 1199.7).some((a) => a.kind === "crowd" && !a.sure), "offered as a Skip button, not auto");
  ok((await call("post /api/x/ads/:episodeId/vote", { who: "z", params: { episodeId: "11" }, body: { key: "bad key!", vote: 1 } })).status === 400, "bad vote refused");
})();

});

test("old settings carry over to the new ad modes", () => {
  assert.equal(cleanEarshot({ settings: { adSkip: false } }).settings.adMode, "off");
  assert.equal(cleanEarshot({ settings: { adSkip: true } }).settings.adMode, "auto");
  assert.equal(cleanEarshot({ settings: { adMode: "ask" } }).settings.adMode, "ask");
  assert.equal(cleanEarshot({ settings: { adMode: "nope" } }).settings.adMode, "auto");
  assert.deepEqual(cleanEarshot({ adFree: ["123", "abc", "123"] }).adFree, ["123"]);
});
