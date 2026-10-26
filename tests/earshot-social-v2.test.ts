// Social v2 for Earshot + Podscroll (server/podcastSocial.ts): text posts, clips with their audio,
// reposts, comments with replies, likes on both, notifications, people search, the ranked Clips feed,
// and everything from before still working until migrations/podcast_social_v2.sql has been run.
import test from "node:test";
import assert from "node:assert/strict";
import { registerSocialRoutes, cleanClip, clipScore, threadParent, searchTerm } from "../server/podcastSocial";
import { pickMoment } from "../server/podcastDirectory";
import { fakeApp, fakeSupabase, SOCIAL_TABLES } from "./fakeSupabase";

const EP = { id: "1000797952887", showId: "1551582052", show: "The Lincoln Project", title: "Rick's Made Hard-Hitting Ads", art: "https://is1-ssl.mzstatic.com/x/600x600bb.jpg", audio: "https://cdn.test/ep.mp3", secs: 1920, date: "2026-10-23" };

function setup(missing: string[] = []) {
  const db = fakeSupabase(SOCIAL_TABLES, { missing });
  const { app, call } = fakeApp();
  const cuts: any[] = [];
  registerSocialRoutes(app, (_req: any, _res: any, next: any) => next(), {
    prefix: "/api/podscroll", getDb: () => db.client, voterOf: (req: any) => req.voter,
    cutClip: async (voter, c) => { cuts.push({ voter, ...c }); return new Blob([new Uint8Array(48_000)], { type: "audio/mpeg" }); },
  });
  const as = (voter: string) => ({
    get: (u: string) => call("GET", `/api/podscroll/social${u}`, { voter }),
    post: (u: string, body: any = {}) => call("POST", `/api/podscroll/social${u}`, { voter, body }),
    del: (u: string) => call("DELETE", `/api/podscroll/social${u}`, { voter }),
  });
  return { db, as, cuts, alice: as("dalice"), bob: as("dbob"), cara: as("dcara") };
}
async function profiles(t: ReturnType<typeof setup>) {
  assert.equal((await t.alice.post("/me", { handle: "alice", name: "Alice", avatar: "🦊" })).statusCode, 200);
  assert.equal((await t.bob.post("/me", { handle: "bob_b", name: "Bob" })).statusCode, 200);
  assert.equal((await t.cara.post("/me", { handle: "cara", name: "Cara" })).statusCode, 200);
}

test("helpers: clips, ranking, threads, search terms and the AI's preview pick", () => {
  assert.deepEqual(cleanClip({ s: 12.345, e: 42.1, quote: "  It was   the ad  " }), { s: 12.35, e: 42.1, quote: "It was the ad" });
  assert.equal(cleanClip({ s: 10, e: 12 }), null, "under 5 seconds");
  assert.equal(cleanClip({ s: 10, e: 200 }), null, "over 90 seconds");
  assert.equal(cleanClip({ s: -1, e: 20 }), null);
  const at = new Date(Date.now() - 3600_000).toISOString(), old = new Date(Date.now() - 72 * 3600_000).toISOString();
  assert.ok(clipScore({ likes: 5, comments: 0, reposts: 0, at }) > clipScore({ likes: 0, comments: 0, reposts: 0, at }), "likes lift a clip");
  assert.ok(clipScore({ likes: 2, comments: 0, reposts: 0, at }) > clipScore({ likes: 2, comments: 0, reposts: 0, at: old }), "newer beats older");
  assert.equal(threadParent(null), null);
  assert.equal(threadParent({ id: "7", parentId: null }), "7");
  assert.equal(threadParent({ id: "9", parentId: "7" }), "7", "a reply to a reply joins the thread");
  assert.equal(searchTerm("  Bob, (or 1=1)%  "), "bob or 11");
  const segs = Array.from({ length: 12 }, (_, i) => ({ s: 600 + i * 10, e: 610 + i * 10, t: `Line ${i} and the moment it all changed.` }));
  assert.deepEqual(pickMoment(segs, '{"start":2,"end":6,"hook":"The day it changed","quote":"Line 3 and the moment it all changed."}'),
    { s: 620, e: 670, quote: "Line 3 and the moment it all changed.", hook: "The day it changed", best: true });
  assert.equal(pickMoment(segs, { start: 2, end: 2 })?.s ?? null, null, "too short");
  assert.equal(pickMoment(segs, { start: 3, end: 50 }), null, "past the transcript");
  assert.equal(pickMoment(segs, "not json"), null);
  assert.equal(pickMoment(segs, { start: 0, end: 11, quote: "made up words" })!.e, 660, "trimmed to 60 seconds");
  assert.equal(pickMoment(segs, { start: 0, end: 4, quote: "made up words" })!.quote, segs[0].t, "a quote that isn't in it is replaced");
});

test("before podcast_social_v2.sql: the old Social keeps working, the new parts say they're being set up", async () => {
  const t = setup(["podcast_comments", "podcast_comment_likes", "podcast_notifications"]);
  await profiles(t);
  assert.equal((await t.alice.get("/me")).body.v2, false);
  assert.equal((await t.alice.post("/posts", { episode: EP, caption: "Listen to this" })).statusCode, 200, "sharing still works");
  const feed = await t.bob.get("/feed");
  assert.equal(feed.statusCode, 200);
  assert.deepEqual(feed.body.posts.map((p: any) => [p.kind, p.caption, p.comments, p.reposts]), [["share", "Listen to this", 0, 0]]);
  assert.equal((await t.bob.post(`/posts/${feed.body.posts[0].id}/like`)).statusCode, 200, "likes still work");
  const clip = await t.alice.post("/posts", { kind: "clip", episode: EP, clip: { s: 30, e: 60, quote: "hi" } });
  assert.deepEqual([clip.statusCode, clip.body.setup], [503, true]);
  assert.deepEqual((await t.bob.get(`/posts/${feed.body.posts[0].id}/comments`)).body, { comments: [], setup: true });
  assert.deepEqual((await t.bob.get("/feed?tab=clips")).body, { posts: [], setup: true });
  assert.deepEqual((await t.bob.get("/notifications")).body, { notes: [], setup: true });
});

test("posts, comments, replies, reposts and notifications", async () => {
  const t = setup();
  await profiles(t);
  const tp = await t.alice.post("/posts", { kind: "text", caption: "What's everyone listening to this week?" });
  assert.equal(tp.statusCode, 200);
  assert.equal(tp.body.post.kind, "text"); assert.equal(tp.body.post.episode, null);
  assert.equal((await t.alice.post("/posts", { kind: "text", caption: "   " })).statusCode, 400, "an empty text post");
  const id = tp.body.id;

  // Bob likes and comments; Alice replies; Cara replies to Alice's reply (it joins Bob's thread).
  await t.bob.post(`/posts/${id}/like`);
  const c1 = await t.bob.post(`/posts/${id}/comments`, { body: "The Lincoln Project, every day." });
  assert.equal(c1.statusCode, 200);
  const c2 = await t.alice.post(`/posts/${id}/comments`, { body: "Same!", parent: c1.body.comment.id });
  const c3 = await t.cara.post(`/posts/${id}/comments`, { body: "Me too", parent: c2.body.comment.id });
  assert.equal(c3.body.comment.parentId, c1.body.comment.id, "threads stay one level deep");
  await t.alice.post(`/comments/${c1.body.comment.id}/like`);
  const list = await t.alice.get(`/posts/${id}/comments`);
  assert.deepEqual(list.body.comments.map((c: any) => [c.author.handle, c.parentId === null, c.likes]), [["bob_b", true, 1], ["alice", false, 0], ["cara", false, 0]]);

  // Bob reposts (twice is still once), Cara quotes it.
  assert.equal((await t.bob.post(`/posts/${id}/repost`)).statusCode, 200);
  assert.equal((await t.bob.post(`/posts/${id}/repost`)).statusCode, 200);
  assert.equal((await t.alice.post(`/posts/${id}/repost`)).statusCode, 400, "not your own");
  const q = await t.cara.post("/posts", { kind: "repost", repostOf: id, caption: "This thread 👇" });
  assert.equal(q.statusCode, 200);
  assert.equal(q.body.post.repost.id, id);

  const feed = (await t.alice.get("/feed")).body.posts;
  assert.deepEqual(feed.map((p: any) => [p.kind, p.author.handle, p.repost?.id ?? null]), [["repost", "cara", id], ["repost", "bob_b", id], ["text", "alice", null]]);
  const orig = feed.find((p: any) => p.id === id);
  assert.deepEqual([orig.likes, orig.comments, orig.reposts], [1, 3, 2]);
  assert.equal((await t.bob.get("/feed")).body.posts.find((p: any) => p.id === id).reposted, true);

  // Alice hears about all of it; Bob about Alice's reply and like.
  const notes = (await t.alice.get("/notifications")).body.notes;
  assert.deepEqual(notes.map((n: any) => [n.kind, n.actor.handle]).sort(), [["comment", "bob_b"], ["comment", "cara"], ["like", "bob_b"], ["repost", "bob_b"], ["repost", "cara"]].sort());
  assert.equal(notes.find((n: any) => n.kind === "comment" && n.actor.handle === "bob_b").comment, "The Lincoln Project, every day.");
  const bobNotes = (await t.bob.get("/notifications")).body.notes.map((n: any) => [n.kind, n.actor.handle]);
  // Cara answered Alice's reply, so that one went to Alice (as a comment on her post), not to Bob.
  assert.deepEqual(bobNotes.sort(), [["comment_like", "alice"], ["reply", "alice"]].sort());
  assert.equal((await t.alice.get("/me")).body.unread, 5);
  await t.alice.post("/notifications/read");
  assert.equal((await t.alice.get("/me")).body.unread, 0);

  // Undo the repost; Bob can delete his comment, Cara can't delete Bob's, Alice can (her post).
  await t.bob.post(`/posts/${id}/repost`, { on: false });
  assert.equal((await t.alice.get("/feed")).body.posts.filter((p: any) => p.kind === "repost").length, 1);
  assert.equal((await t.cara.del(`/comments/${c1.body.comment.id}`)).statusCode, 403);
  assert.equal((await t.alice.del(`/comments/${c1.body.comment.id}`)).statusCode, 200);
  assert.deepEqual((await t.alice.get(`/posts/${id}/comments`)).body.comments, [], "its replies go with it");

  // Deleting the post takes the quote repost with it.
  assert.equal((await t.alice.del(`/posts/${id}`)).statusCode, 200);
  assert.deepEqual((await t.bob.get("/feed")).body.posts, []);
});

test("clips: the audio is cut (from the clipper's copy) and kept, and the Clips feed ranks them", async () => {
  const t = setup();
  await profiles(t);
  const a = await t.alice.post("/posts", { kind: "clip", episode: EP, clip: { s: 610.5, e: 650, quote: "Nobody expected that call." }, sid: "Sess_1234567890", caption: "Wild" });
  assert.equal(a.statusCode, 200);
  assert.deepEqual(t.cuts[0], { voter: "dalice", sid: "Sess_1234567890", episodeId: EP.id, showId: EP.showId, s: 610.5, e: 650 });
  assert.match(a.body.post.clip.audio, /podcast-uploads\/clips\/dalice\/\d+\.mp3$/);
  assert.ok(t.db.files.has(`podcast-uploads/clips/dalice/${a.body.id}.mp3`));
  assert.equal((await t.alice.post("/posts", { kind: "clip", episode: EP, clip: { s: 10, e: 12 } })).statusCode, 400);
  const b = await t.bob.post("/posts", { kind: "clip", episode: EP, clip: { s: 100, e: 130, quote: "Second" } });
  await t.cara.post(`/posts/${a.body.id}/like`); await t.bob.post(`/posts/${a.body.id}/like`);
  const clips = (await t.cara.get("/feed?tab=clips")).body.posts;
  assert.deepEqual(clips.map((p: any) => p.id), [a.body.id, b.body.id], "the liked clip leads even though it's older");
  assert.equal(clips[0].clip.quote, "Nobody expected that call.");
  await t.alice.del(`/posts/${a.body.id}`);
  assert.ok(!t.db.files.has(`podcast-uploads/clips/dalice/${a.body.id}.mp3`), "its audio is deleted with it");
});

test("people: search, suggestions and follow notifications", async () => {
  const t = setup();
  await profiles(t);
  await t.bob.post("/follow", { handle: "alice" });
  await t.cara.post("/follow", { handle: "alice" });
  assert.deepEqual((await t.bob.get("/people?q=car")).body.people.map((p: any) => p.handle), ["cara"]);
  const sug = (await t.cara.get("/people")).body.people;
  assert.equal(sug[0].handle, "alice", "most-followed first");
  assert.equal(sug[0].followed, true);
  assert.ok(!sug.some((p: any) => p.handle === "cara"), "not yourself");
  // Unfollow and follow again: still one notification.
  await t.bob.post("/follow", { handle: "alice", on: false }); await t.bob.post("/follow", { handle: "alice" });
  const notes = (await t.alice.get("/notifications")).body.notes;
  assert.deepEqual(notes.map((n: any) => [n.kind, n.actor.handle]).sort(), [["follow", "bob_b"], ["follow", "cara"]]);
});
