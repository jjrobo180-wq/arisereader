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
import { memoryEarshotStore, pacedFetcher, registerEarshotRoutes } from "../server/earshot";

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
  assert.equal(commentAuthor("Lucy Ann Chase"), "Lucy C."); assert.equal(commentAuthor(""), "Arise listener"); assert.equal(commentAuthor("Prince"), "Prince");
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
