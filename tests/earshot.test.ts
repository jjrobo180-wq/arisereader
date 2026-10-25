// LifeHub's Earshot podcast app: reading Apple's answers, the feed's ranking, saved-data cleaning,
// comments, the server routes (with a fake Apple and an in-memory store) and how it's wired in.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import { ADD_ON_SECTIONS, FAMILY_SECTIONS, cleanFamily, emptyFamily, isOn } from "../shared/familyHub";
import { PLUGINS } from "../shared/pluginStore";
import {
  GENRES, applySignal, appleSearchUrl, chooseEpisode, cleanComment, cleanEarshot, commentAuthor, emptyEarshot, introSkip, mergeGenreShows,
  parseEpisode, parseShow, pickNext, plainText, tasteOf, type Candidate, type PodShow,
} from "../shared/earshot";
import { memoryEarshotStore, pacedFetcher, podscrollAllowed, registerEarshotRoutes } from "../server/earshot";

const appleShow = (id: number, name: string, genres = ["Comedy", "Podcasts"], extra: Record<string, unknown> = {}) => ({
  wrapperType: "track", kind: "podcast", collectionId: id, trackId: id, collectionName: name, artistName: "Host", primaryGenreName: genres[0], genres,
  artworkUrl100: `https://is1-ssl.mzstatic.com/image/${id}/100x100bb.jpg`, artworkUrl600: `https://is1-ssl.mzstatic.com/image/${id}/600x600bb.jpg`,
  collectionViewUrl: `https://podcasts.apple.com/us/podcast/id${id}`, trackCount: 120, releaseDate: new Date().toISOString(), collectionExplicitness: "notExplicit", ...extra,
});
const appleEpisode = (id: number, showId: number, extra: Record<string, unknown> = {}) => ({
  wrapperType: "podcastEpisode", kind: "podcast-episode", trackId: id, collectionId: showId, collectionName: "Show", trackName: `Episode ${id}`,
  episodeUrl: `https://cdn.example.com/${id}.mp3`, description: "<p>Hello &amp; welcome</p>", releaseDate: "2026-10-20T10:00:00Z", trackTimeMillis: 1_800_000,
  artworkUrl600: "https://is1-ssl.mzstatic.com/image/e/600x600bb.jpg", trackViewUrl: `https://podcasts.apple.com/us/podcast/x?i=${id}`, ...extra,
});

test("genres are well-formed", () => {
  assert.equal(new Set(GENRES.map((g) => g.id)).size, GENRES.length);
  assert.ok(GENRES.length >= 28, "lots of genres");
  for (const g of GENRES) assert.ok(g.terms.length && /^#[0-9a-f]{6}$/i.test(g.color), g.id);
  assert.ok(GENRES.filter((g) => g.kidSafe).length >= 10, "plenty for student accounts");
});

test("Apple's answers are read safely", () => {
  const s = parseShow(appleShow(11, "Funny Hour"))!;
  assert.equal(s.id, "11"); assert.equal(s.genre, "comedy"); assert.equal(s.explicit, false);
  assert.equal(parseShow({ collectionId: 1, collectionName: "No art" }), null);
  assert.equal(parseShow({ ...appleShow(2, "Song"), kind: "song" }), null);
  const e = parseEpisode(appleEpisode(5, 11))!;
  assert.equal(e.id, "5"); assert.equal(e.secs, 1800); assert.equal(e.about, "Hello & welcome");
  assert.equal(parseEpisode({ ...appleEpisode(6, 11), episodeUrl: "javascript:alert(1)" }), null, "only web audio");
  assert.equal(parseEpisode(appleShow(3, "x")), null);
  assert.equal(plainText("<b>One</b><br>two&nbsp;&nbsp;three"), "One two three");
  assert.ok(appleSearchUrl("true crime", "podcast", 50, false).includes("explicit=No"));
});

test("genre results put shows that really fit first", () => {
  const merged = mergeGenreShows("truecrime", [[appleShow(1, "A", ["Comedy"]), ...Array.from({ length: 9 }, (_, i) => appleShow(10 + i, `TC ${i}`, ["True Crime"]))], [appleShow(10, "dupe", ["True Crime"])]]);
  assert.equal(merged.length, 9, "the off-genre show is dropped when enough fit, and repeats are gone");
  assert.ok(merged.every((s) => s.genre === "truecrime"));
});

test("the feed learns and explores", () => {
  let e = { ...emptyEarshot(), setupDone: true, genres: ["comedy", "history"] };
  assert.equal(tasteOf(e, "comedy"), 3); assert.ok(tasteOf(e, "sports") < 1);
  e = applySignal(e, "sports", "like"); e = applySignal(e, "sports", "follow");
  assert.ok(tasteOf(e, "sports") > tasteOf(e, "comedy"), "likes and follows lift a genre");
  const pool: Candidate[] = [
    ...Array.from({ length: 10 }, (_, i) => ({ rank: i, show: parseShow(appleShow(100 + i, `Sport ${i}`, ["Sports"]), "sports")! })),
    ...Array.from({ length: 10 }, (_, i) => ({ rank: i, show: parseShow(appleShow(200 + i, `Cook ${i}`, ["Food"]), "food")! })),
  ];
  let seq = 0.5; const rnd = () => { seq = (seq * 9301 + 49297) % 233280 / 233280; return seq; };
  const picks = pickNext(e, pool, { recentShows: [], shownShows: [], follows: [] }, 12, rnd);
  assert.equal(new Set(picks.map((p) => p.show.id)).size, picks.length, "no repeats");
  assert.ok(picks.filter((p) => p.show.genre === "sports").length > picks.filter((p) => p.show.genre === "food").length, "favours what they like");
  assert.ok(pickNext(e, pool, { recentShows: [], shownShows: pool.map((c) => c.show.id), follows: [] }, 3).length === 0, "stops when everything's shown");
});

test("episodes and intro skipping", () => {
  const eps = [parseEpisode(appleEpisode(1, 9, { trackTimeMillis: 3_600_000 }))!, parseEpisode(appleEpisode(2, 9, { trackTimeMillis: 600_000 }))!];
  assert.equal(chooseEpisode({ ...emptyEarshot(), pace: "short" }, eps)!.id, "2");
  assert.equal(chooseEpisode({ ...emptyEarshot(), heard: ["1"] }, eps)!.id, "2");
  assert.equal(introSkip(3600, true), 90); assert.equal(introSkip(300, true), 0); assert.equal(introSkip(3600, false), 0);
});

test("saved data is cleaned", () => {
  const c = cleanEarshot({ setupDone: true, genres: ["comedy", "nope", "comedy"], pace: "fast", taste: { comedy: 99, nope: 2 }, follows: [{ id: "12", name: "A", art: "https://x/a.jpg", genre: "zzz" }, { id: "12", name: "dupe", art: "https://x/a.jpg" }], heard: ["1", "1", "x"], settings: { speed: 3, explicit: "yes", advance: 60 } });
  assert.deepEqual(c.genres, ["comedy"]); assert.equal(c.pace, "mix"); assert.equal(c.taste.comedy, 14); assert.equal(c.taste.nope, undefined);
  assert.equal(c.follows.length, 1); assert.equal(c.follows[0].genre, "culture"); assert.deepEqual(c.heard, ["1"]);
  assert.equal(c.settings.speed, 1); assert.equal(c.settings.explicit, false); assert.equal(c.settings.advance, 60);
  assert.deepEqual(cleanEarshot(null), emptyEarshot());
});

test("comments: names and text", () => {
  assert.equal(commentAuthor("Lucy Ann Chase"), "Lucy C."); assert.equal(commentAuthor(""), "Listener"); assert.equal(commentAuthor("Prince"), "Prince");
  assert.equal(cleanComment("  hi\u0000  there  "), "hi there"); assert.equal(cleanComment("x".repeat(500)).length, 280);
});

test("Apple is paced", async () => {
  let t = 0; const waits: number[] = [];
  const f = pacedFetcher(async () => ({}), 1000, 2500, () => t, async (ms) => { waits.push(ms); });
  await f("a"); await f("b"); await f("c");
  assert.deepEqual(waits, [1000, 2000]);
  await assert.rejects(() => f("d"), /busy/);
});

async function withServer(role: string, run: (base: string) => Promise<void>) {
  const app = express(); app.use(express.json());
  const auth = (req: any, _res: any, next: any) => { req.user = { id: role === "student" ? 2 : 1, role, displayName: "Jane Doe" }; next(); };
  const fetcher = async (url: string) => {
    if (url.includes("/lookup")) return { results: [appleShow(11, "Funny Hour"), appleEpisode(5, 11), appleEpisode(6, 11, { trackExplicitness: "explicit" })] };
    return { results: [appleShow(11, "Funny Hour"), appleShow(12, "Rude Hour", ["Comedy"], { collectionExplicitness: "explicit" })] };
  };
  registerEarshotRoutes(app, auth, { store: memoryEarshotStore(), fetcher });
  const server = app.listen(0);
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); } finally { server.close(); }
}

test("server: real-podcast routes, clean by default", async () => {
  await withServer("todo", async (base) => {
    const g = await (await fetch(`${base}/api/earshot/genre/comedy`)).json();
    assert.deepEqual(g.shows.map((s: PodShow) => s.id), ["11"], "explicit shows are left out by default");
    const gx = await (await fetch(`${base}/api/earshot/genre/comedy?explicit=1`)).json();
    assert.equal(gx.shows.length, 2);
    const s = await (await fetch(`${base}/api/earshot/show/11`)).json();
    assert.deepEqual(s.episodes.map((e: any) => e.id), ["5"]);
    assert.equal((await fetch(`${base}/api/earshot/genre/nope`)).status, 404);
  });
});

test("server: likes, shares and comments are shared", async () => {
  await withServer("todo", async (base) => {
    const post = (p: string, body: unknown) => fetch(`${base}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await post("/api/earshot/like", { episodeId: "5", on: true });
    await post("/api/earshot/share", { episodeId: "5" });
    const c = await (await post("/api/earshot/comments", { episodeId: "5", showId: "11", body: "  Great one  " })).json();
    assert.equal(c.comment.body, "Great one"); assert.equal(c.comment.author, "Jane D.");
    assert.equal((await post("/api/earshot/comments", { episodeId: "5", body: "   " })).status, 400);
    const counts = await (await fetch(`${base}/api/earshot/counts?ids=5`)).json();
    assert.deepEqual(counts.counts["5"], { likes: 1, comments: 1, shares: 1, liked: true });
    const list = await (await fetch(`${base}/api/earshot/comments/5`)).json();
    assert.equal(list.comments.length, 1); assert.equal(list.comments[0].mine, true);
    assert.equal((await fetch(`${base}/api/earshot/comments/${c.comment.id}`, { method: "DELETE" })).status, 200);
  });
});

test("server: student accounts get clean podcasts and no comments", async () => {
  await withServer("student", async (base) => {
    const g = await (await fetch(`${base}/api/earshot/genre/comedy?explicit=1`)).json();
    assert.equal(g.shows.length, 0, "comedy isn't a kid-safe genre");
    assert.equal((await fetch(`${base}/api/earshot/comments/5`)).status, 403);
    assert.equal((await fetch(`${base}/api/earshot/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ episodeId: "5", body: "hi" }) })).status, 403);
  });
});

test("Earshot is wired into LifeHub and the App Store", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.ok(FAMILY_SECTIONS.includes("earshot")); assert.ok(ADD_ON_SECTIONS.includes("earshot"));
  const p = PLUGINS.find((q) => q.id === "life-earshot")!;
  assert.ok(p && p.target.kind === "section" && p.target.section === "earshot");
  const f = emptyFamily();
  assert.equal(isOn("earshot", f), false, "off until added");
  assert.deepEqual(cleanFamily({ ...f, earshot: { setupDone: true, genres: ["news"] } }).earshot.genres, ["news"]);
  assert.match(read("client/src/components/family-hub/lifeApps.tsx"), /earshot: \(p\) => <Earshot/);
  assert.match(read("client/src/components/family-hub/Members.tsx"), /earshot: \{ label: "Earshot"/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /earshot: PodcastNav3/);
  assert.match(read("client/src/components/plugin-store/PluginStore.tsx"), /Podcast: PodcastTile3/);
  assert.match(read("server/routes.ts"), /registerEarshotRoutes\(app, authMiddleware/);
});

test("Podscroll: its own site, calling the public routes", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.ok(podscrollAllowed("https://podscroll.onrender.com") && podscrollAllowed("http://localhost:5173"));
  assert.ok(!podscrollAllowed("https://evil.example") && !podscrollAllowed(""), "other sites can't call it");
  assert.match(read("server/routes.ts"), /registerPodscrollRoutes\(app, supabaseEarshotStore\(getAdminSupabase, "podscroll"\), undefined, podcasts, podcastAds\)/);
  assert.match(read("server/routes.ts"), /podcasts\.warm\(\)/, "the directory warms up in the background");
  assert.match(read("server/routes.ts"), /const podcastAds = supabaseAdStore\(getAdminSupabase\)/, "listeners' ad marks are kept in the database");
  assert.match(read("podscroll/main.tsx"), /\/api\/podscroll/);
  assert.match(read("podscroll/main.tsx"), /from "\.\.\/client\/src\/components\/family-hub\/earshot\/EarshotPlayer"/);
  assert.doesNotMatch(read("client/src/components/family-hub/earshot/EarshotPlayer.tsx"), /from "@\//, "the shared player imports nothing from the Arise app");
  const manifest = JSON.parse(read("podscroll/public/manifest.webmanifest"));
  assert.equal(manifest.name, "Podscroll"); assert.equal(manifest.display, "standalone");
});

// ---------------------------------------------------------------------------
// Instant feed, read along and ad skip
// ---------------------------------------------------------------------------
import { adAt, adsFromAi, adsFromChapters, bestTranscript, chunkPlan, parseClock, parseCues, parseTranscriptJson, rssExtrasFor, startAt } from "../shared/earshot";
import { createDirectory, memoryKV } from "../server/podcastDirectory";

test("transcripts, chapters and ads are read safely", () => {
  assert.equal(parseClock("01:02:03.5"), 3723.5); assert.equal(parseClock("02:03,5"), 123.5); assert.ok(Number.isNaN(parseClock("x")));
  const cues = parseCues("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Ann>Hello there.\n\n00:00:03.000 --> 00:00:05.000\nThis is a\n\n00:00:05.000 --> 00:00:07.000\ntest.");
  assert.deepEqual(cues, [{ s: 1, e: 3, t: "Ann: Hello there." }, { s: 3, e: 7, t: "This is a test." }]);
  assert.equal(parseTranscriptJson({ segments: [{ startTime: 0, endTime: 1, body: "One" }, { startTime: 1, endTime: 2, body: "two." }] })[0].t, "One two.");
  const xml = `<rss><item><title>Ep 1</title><enclosure url="https://cdn.x/ep1.mp3?a=1"/><podcast:transcript url="https://t/1.vtt" type="text/vtt"/><podcast:transcript url="https://t/1.json" type="application/json"/></item></rss>`;
  assert.equal(bestTranscript(rssExtrasFor(xml, { audio: "https://track.y/r/cdn.x/ep1.mp3", title: "x" }).transcripts)?.url, "https://t/1.json", "matched by file name, JSON preferred");
  const segs = [{ s: 0, e: 10, t: "a" }, { s: 10, e: 30, t: "b" }, { s: 30, e: 60, t: "c" }];
  assert.deepEqual(adsFromAi('{"ads":[{"from":1,"to":2,"label":"Acme"},{"from":5,"to":9}]}', segs), [{ s: 10, e: 60, label: "Acme" }], "bad line numbers are dropped");
  assert.deepEqual(adsFromAi("not json", segs), []);
  assert.deepEqual(adsFromChapters([{ s: 0, title: "Intro" }, { s: 60, title: "Sponsor: Acme" }, { s: 120, title: "Main" }], 600), [{ s: 60, e: 120, label: "Sponsor: Acme" }]);
  assert.equal(chunkPlan(57_600_000, 3600).chunks, 6); assert.ok(chunkPlan(144_000_000, 3600).chunkSecs < 600, "high-bitrate pieces stay under the upload limit");
  assert.equal(adAt([{ s: 10, e: 40, label: "x" }], 20)?.e, 40); assert.equal(adAt([{ s: 10, e: 40, label: "x" }], 39.5), null);
  assert.equal(startAt(3600, 600, true), 600); assert.equal(startAt(3600, 3590, true), 90); assert.equal(startAt(300, undefined, true), 0);
});

test("the directory: warm pools, transcripts, and the daily AI cap", async () => {
  const show = (id: number, extra: any = {}) => ({ kind: "podcast", collectionId: id, collectionName: "Show " + id, artistName: "H", primaryGenreName: "History", genres: ["History"], artworkUrl600: "https://a/600x600bb.jpg", feedUrl: "https://feed/" + id, releaseDate: new Date().toISOString(), ...extra });
  const ep = (id: number, sid: number) => ({ wrapperType: "podcastEpisode", kind: "podcast-episode", trackId: id, collectionId: sid, collectionName: "Show " + sid, trackName: "E" + id, episodeUrl: "https://cdn/e" + id + ".mp3", releaseDate: "2026-10-01T00:00:00Z", trackTimeMillis: 1_200_000, artworkUrl600: "https://a/e.jpg" });
  let calls = 0;
  const fetcher: any = async (url: string) => { calls++;
    if (url.includes("lookup")) { const id = Number(new URL(url).searchParams.get("id")); return { results: [show(id), ep(id * 10 + 1, id), ep(id * 10 + 2, id)] }; }
    if (url.includes("podcastEpisode")) return { results: [ep(901, 90), ep(902, 90), ep(903, 91)] };
    return { results: [show(1), show(2), show(3, { collectionExplicitness: "explicit" })] }; };
  fetcher.idle = () => true;
  const web: any = async (url: string, init: any) => {
    if (url.startsWith("https://feed/1")) return new Response(`<rss><item><title>E11</title><enclosure url="https://cdn/e11.mp3"/><podcast:transcript url="https://t/11.vtt" type="text/vtt"/></item></rss>`);
    if (url === "https://t/11.vtt") return new Response("WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nWelcome to the show.\n\n00:00:05.000 --> 00:00:40.000\nThis episode is brought to you by Acme.\n\n00:00:40.000 --> 00:01:00.000\nNow, the story.");
    if (url.startsWith("https://feed/")) return new Response("<rss></rss>");
    if (url.startsWith("https://cdn/")) return new Response(new Uint8Array(String(init?.headers?.Range) === "bytes=0-1" ? 2 : 1000), { status: 206, headers: { "content-range": "bytes 0-1/19200000", "content-type": "audio/mpeg" } });
    return new Response("nope", { status: 404 }); };
  const dir = createDirectory({ fetcher, kv: memoryKV(), web, ask: async () => '{"ads":[{"from":1,"to":1,"label":"Acme"}]}', transcribe: async () => ({ segments: [{ start: 0, end: 12, text: "Hello and welcome." }, { start: 12, end: 50, text: "Sponsored by Zed." }] }), aiOn: () => true, minutesPerDay: 15 });
  let p = await dir.pool("history", false);
  assert.deepEqual(p.map((x) => x.show.id).sort(), ["90", "91"], "cold: episode search fills in");
  await dir.warm(1, async () => {});
  p = await dir.pool("history", false);
  assert.deepEqual(p.slice(0, 2).map((x) => x.show.id), ["1", "2"]); assert.equal(p[0].episodes.length, 2);
  assert.ok(!p.some((x) => x.show.id === "3"), "explicit left out");
  const before = calls; await dir.pool("history", false); assert.equal(calls, before, "no Apple calls once warm");
  const pub = await dir.transcript("1", "11", 0);
  assert.equal(pub.source, "publisher"); assert.equal(pub.segments.length, 3); assert.deepEqual(pub.ads.map((a) => [a.s, a.e]), [[5, 40]]);
  const ai = await dir.transcript("2", "21", 0);
  assert.equal(ai.source, "ai"); assert.equal(ai.more, true); assert.equal(ai.ads.length, 1);
  const capped = await dir.transcript("2", "21", 1);
  assert.equal(capped.source, "none"); assert.match(capped.reason || "", /limit/);
});
