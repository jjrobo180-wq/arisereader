// Regression for real-world Pod+ Social reads: Supabase's query builders are
// PromiseLike, and must not be unwrapped before filters are chained.
import test from "node:test";
import assert from "node:assert/strict";
import { registerSocialPlus } from "../server/podcastSocialPlus";
import { fakeApp, fakeSupabase, SOCIAL_TABLES } from "./fakeSupabase";

test("official Pod+ posts load on profile and Explore instead of returning 500", async () => {
  const db = fakeSupabase({
    ...SOCIAL_TABLES,
    podcast_blocks: {},
    podcast_post_saves: {},
  });
  await db.client.from("podcast_profiles").insert({
    voter: "d-owner", handle: "jjrobo180", name: "Pod+", avatar: "🎙️",
    verified: true, hidden: false, bio: "The official Pod+ account.",
  });
  await db.client.from("podcast_posts").insert({
    voter: "d-owner", kind: "share", episode_id: "42",
    episode: { id: "42", showId: "123", title: "Podcast recommendation", art: "https://example.test/cover.jpg" },
    caption: "Worth a listen", hidden: false, created_at: new Date().toISOString(),
  });
  const { app, call } = fakeApp();
  const noGate = (_req: any, _res: any, next: () => void) => next();
  registerSocialPlus(app, {
    P: "/api/podscroll/social", auth: noGate, gate: noGate,
    db: () => db.client, voterOf: (req: any) => req.voter,
    check: (error: any) => { if (error) throw error; },
    fail: (res: any, error: any) => res.status(500).json({ message: String(error?.message || error) }),
    limited: () => false, writes: {} as any, talk: {} as any,
    PROFILE_COLS: "voter,handle,name,bio,avatar,hidden,verified,created_at",
    myProfile: async () => null,
    peopleById: async () => new Map(),
    profileOf: (p: any) => ({ handle: p.handle, name: p.name, bio: p.bio ?? "", avatar: p.avatar ?? "🎧", verified: !!p.verified }),
    shape: async (rows: any[]) => rows.map((r) => ({ id: String(r.id), kind: r.kind, at: r.created_at, caption: r.caption, episode: r.episode, media: [], author: { handle: "jjrobo180", name: "Pod+", verified: true } })),
    postCols: async () => "id,voter,kind,episode,caption,created_at,hidden",
    notify: async () => {}, hasV2: async () => true, blockSet: async () => new Set<string>(),
    publicPrefix: () => "", folderOf: (id: string) => id,
  } as any);

  const owner = { voter: "d-owner" };
  const profile = await call("GET", "/api/podscroll/social/profile/jjrobo180", owner);
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.body.posts, 1);

  const posts = await call("GET", "/api/podscroll/social/profile/jjrobo180/posts?tab=posts", owner);
  assert.equal(posts.statusCode, 200, JSON.stringify(posts.body));
  assert.deepEqual(posts.body.posts.map((p: any) => p.id), ["1"]);

  const explore = await call("GET", "/api/podscroll/social/explore", owner);
  assert.equal(explore.statusCode, 200, JSON.stringify(explore.body));
  assert.ok(explore.body.posts.some((p: any) => p.id === "1"), "the podcast share appears in Explore");
});
