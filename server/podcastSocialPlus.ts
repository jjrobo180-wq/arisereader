// Pod+ Social, the rest of the app (registered by server/podcastSocial.ts, sharing its helpers):
//  - Explore (trending hashtags, people to follow, a grid of photo/video/episode posts) and Search
//    (people, posts and hashtags), hashtag pages
//  - Profiles: counts, "follows you", people you both know, followers/following lists, and tabs
//    (posts, media, clips, podcast, likes and saved for yourself)
//  - Saved posts, poll votes, blocking
//  - Direct messages: one conversation per pair; from someone you don't follow it waits in Requests
//    until you accept or reply (they can send 3 messages until then); blocked people can't message
//  - Stories: a photo, video or words on a color (or an episode), gone after 24 hours, with viewers
// Tables: migrations/podcast_social_v3.sql.
import type { RequestHandler, Express } from "express";
import { createAttemptLimiter } from "./attemptLimiter";
import type { Post, PostEpisode, Profile, NoteKind } from "./podcastSocial";
import { cleanColor, cleanMedia, forYouScore, hashtags, pairOf, type Media } from "../shared/socialKit";
import { moderateImages } from "./socialModeration";

type Limiter = ReturnType<typeof createAttemptLimiter>;
export type PlusDeps = {
  P: string; auth: RequestHandler; gate: RequestHandler; db: () => any; voterOf: (req: any) => string;
  check: (e: any) => void; fail: (res: any, e: any) => void; limited: (l: Limiter, req: any, res: any) => boolean; writes: Limiter; talk: Limiter;
  PROFILE_COLS: string; myProfile: (v: string) => Promise<Profile | null>; peopleById: (v: string[]) => Promise<Map<string, any>>; profileOf: (r: any) => Profile;
  shape: (rows: any[], viewer: string, deep?: boolean) => Promise<Post[]>; postCols: () => Promise<string>;
  notify: (voter: string, actor: string, kind: NoteKind, postId?: number, commentId?: number) => Promise<void>; hasV2: () => Promise<boolean>;
  blockSet: (v: string) => Promise<Set<string>>; publicPrefix: () => string; folderOf: (v: string) => string;
};
export type Person = Profile & { followed?: boolean; followers?: number; me?: boolean; followsYou?: boolean };
export type Thread = { id: string; with: Profile; lastText: string; lastAt: string; lastFromMe: boolean; unread: boolean; accepted: boolean; request: boolean };
export type Message = { id: string; mine: boolean; body: string; media: Media[]; post: Post | null; at: string };
export type Story = { id: string; media: Media | null; body: string; bg: string; episode: PostEpisode | null; at: string; seen: boolean; views?: number };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "");
const handleOf = (v: unknown) => { const h = text(v, 30).toLowerCase().replace(/^@/, ""); return /^[a-z0-9_]{3,20}$/.test(h) ? h : ""; };
const idOf = (v: unknown) => { const s = String(v ?? ""); return /^\d{1,15}$/.test(s) ? Number(s) : 0; };
const term = (v: unknown) => text(v, 40).toLowerCase().replace(/[^a-z0-9_ #]/g, "").trim();
const cursor = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
/** A request (not yet accepted) may hold this many messages from the person who started it. */
export const REQUEST_LIMIT = 3;

export function registerSocialPlus(app: Express, d: PlusDeps) {
  const { P, auth, gate, db, check, fail, limited } = d;
  const v = (req: any) => d.voterOf(req);
  const dms = createAttemptLimiter({ max: 80, windowMs: 10 * 60_000 });
  const storiesLim = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });

  async function profileRow(handle: string) {
    const { data, error } = await db().from("podcast_profiles").select(d.PROFILE_COLS).eq("handle", handle).maybeSingle();
    check(error);
    return data && !data.hidden ? data : null;
  }
  async function followCounts(voters: string[]) {
    const out = new Map<string, number>();
    if (!voters.length) return out;
    const { data } = await db().from("podcast_people_follows").select("followee").in("followee", voters).limit(20000);
    for (const r of data || []) out.set(r.followee, (out.get(r.followee) ?? 0) + 1);
    return out;
  }
  /** Profiles as people the viewer can follow (with counts and whether they already do). */
  async function people(rows: any[], viewer: string): Promise<Person[]> {
    const list = rows.filter((r) => r && !r.hidden);
    if (!list.length) return [];
    const voters = list.map((r) => r.voter);
    const [{ data: mine }, { data: theirs }, counts] = await Promise.all([
      db().from("podcast_people_follows").select("followee").eq("follower", viewer).in("followee", voters),
      db().from("podcast_people_follows").select("follower").eq("followee", viewer).in("follower", voters),
      followCounts(voters),
    ]);
    const followed = new Set((mine || []).map((x: any) => x.followee)), fans = new Set((theirs || []).map((x: any) => x.follower));
    return list.map((r) => ({ ...d.profileOf(r), followed: followed.has(r.voter), followsYou: fans.has(r.voter), followers: counts.get(r.voter) ?? 0, ...(r.voter === viewer ? { me: true } : {}) }));
  }
  const postsQuery = async () => db().from("podcast_posts").select(await d.postCols()).eq("hidden", false);

  // -------------------------------------------------------------------------
  // Badges: unread notifications, unread conversations, message requests (polled by the app).
  app.get(`${P}/counts`, auth, gate, async (req: any, res) => {
    try {
      const me = v(req);
      const [{ count: notes }, threads] = await Promise.all([
        db().from("podcast_notifications").select("id", { count: "exact", head: true }).eq("voter", me).eq("read", false),
        threadRows(me),
      ]);
      const shaped = threads.map((t) => threadState(t, me)).filter((t) => !t.hidden);
      res.set("Cache-Control", "no-store");
      res.json({ notes: notes ?? 0, dms: shaped.filter((t) => !t.request && t.unread).length, requests: shaped.filter((t) => t.request).length });
    } catch (e) { fail(res, e); }
  });

  // -------------------------------------------------------------------------
  // Explore and search
  app.get(`${P}/explore`, auth, gate, async (req: any, res) => {
    try {
      const me = v(req);
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [{ data: recent, error: e1 }, blocked, { data: f }] = await Promise.all([
        (await postsQuery()).gte("created_at", since).neq("kind", "bookmark").order("created_at", { ascending: false }).limit(400),
        d.blockSet(me),
        db().from("podcast_people_follows").select("follower,followee").limit(5000),
      ]);
      check(e1);
      // Trending: hashtags in the last week, most-used first.
      const tally = new Map<string, number>();
      for (const r of recent || []) for (const t of hashtags(r.caption || "")) tally.set(t, (tally.get(t) ?? 0) + 1);
      const tags = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, posts]) => ({ tag, posts }));
      // People to follow: the most-followed people you don't follow yet, then the newest.
      const mine = new Set((f || []).filter((x: any) => x.follower === me).map((x: any) => x.followee));
      const pop = new Map<string, number>(); for (const x of f || []) pop.set(x.followee, (pop.get(x.followee) ?? 0) + 1);
      const { data: fresh } = await db().from("podcast_profiles").select(d.PROFILE_COLS).order("created_at", { ascending: false }).limit(40);
      const topIds = [...pop.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => id !== me && !mine.has(id) && !blocked.has(id)).slice(0, 20);
      const top = topIds.length ? [...(await d.peopleById(topIds)).values()] : [];
      // Always suggest the official Pod+ account to people who don't follow it yet,
      // while respecting blocks, the current user, and hidden profiles.
      const { data: official } = await db().from("podcast_profiles").select(d.PROFILE_COLS).eq("handle", "jjrobo180").maybeSingle();
      const featured = official && official.verified && official.voter !== me && !mine.has(official.voter) && !blocked.has(official.voter) && !official.hidden ? [official] : [];
      const seen = new Set<string>();
      const sug = [...featured, ...top.sort((a, b) => (pop.get(b.voter) ?? 0) - (pop.get(a.voter) ?? 0)), ...(fresh || [])]
        .filter((r) => r.voter !== me && !mine.has(r.voter) && !blocked.has(r.voter) && !r.hidden && !seen.has(r.voter) && (seen.add(r.voter), true)).slice(0, 15);
      // The grid: photos, videos and episodes people are into this week.
      const all = await d.shape(recent || [], me);
      const now = Date.now();
      const grid = all.filter((p) => p.media?.length || p.episode || p.repost?.media?.length)
        .map((p) => ({ p, s: forYouScore({ likes: p.likes, comments: p.comments, reposts: p.reposts, at: p.at, media: true }, now) }))
        .sort((a, b) => b.s - a.s).slice(0, 30).map((x) => x.p);
      res.set("Cache-Control", "no-store");
      res.json({ tags, people: await people(sug, me), posts: grid });
    } catch (e) { fail(res, e); }
  });

  app.get(`${P}/search`, auth, gate, async (req: any, res) => {
    const q = term(req.query?.q);
    if (q.replace(/#/g, "").length < 2) return res.json({ people: [], posts: [], tags: [] });
    try {
      const me = v(req);
      const tagOnly = q.startsWith("#");
      const word = q.replace(/#/g, "").trim();
      const blocked = await d.blockSet(me);
      const [peopleRes, postsRes, tagRes] = await Promise.all([
        tagOnly ? Promise.resolve({ data: [] }) : db().from("podcast_profiles").select(d.PROFILE_COLS).or(`handle.ilike.%${word.replace(/ /g, "_")}%,name.ilike.%${word}%`).limit(40),
        tagOnly
          ? (await postsQuery()).contains("tags", [word.replace(/ /g, "")]).order("created_at", { ascending: false }).limit(40)
          : (await postsQuery()).neq("kind", "bookmark").ilike("caption", `%${word}%`).order("created_at", { ascending: false }).limit(40),
        db().from("podcast_posts").select("tags").eq("hidden", false).not("tags", "is", null).order("created_at", { ascending: false }).limit(600),
      ]);
      const ppl = (await people(((peopleRes as any).data || []).filter((r: any) => !blocked.has(r.voter)), me))
        .sort((a, b) => Number(b.handle === word) - Number(a.handle === word) || Number(b.handle.startsWith(word)) - Number(a.handle.startsWith(word)) || (b.followers ?? 0) - (a.followers ?? 0))
        .slice(0, 20);
      const tally = new Map<string, number>();
      for (const r of (tagRes as any).data || []) for (const t of r.tags || []) if (t.includes(word.replace(/ /g, ""))) tally.set(t, (tally.get(t) ?? 0) + 1);
      res.set("Cache-Control", "no-store");
      res.json({ people: ppl, posts: await d.shape((postsRes as any).data || [], me), tags: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, posts]) => ({ tag, posts })) });
    } catch (e) { fail(res, e); }
  });

  /** A hashtag's posts, newest first, 20 at a time (?before=). */
  app.get(`${P}/tags/:tag`, auth, gate, async (req: any, res) => {
    const tag = String(req.params.tag || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    if (tag.length < 2) return res.json({ posts: [], next: null });
    try {
      const me = v(req);
      let q = (await postsQuery()).contains("tags", [tag]).order("created_at", { ascending: false }).limit(20);
      const before = cursor(req.query?.before); if (before) q = q.lt("created_at", before);
      const { data, error } = await q;
      check(error);
      res.set("Cache-Control", "no-store");
      res.json({ posts: await d.shape(data || [], me), next: (data || []).length === 20 ? (data as any[])[19].created_at : null });
    } catch (e) { fail(res, e); }
  });

  // -------------------------------------------------------------------------
  // Profiles
  app.get(`${P}/profile/:handle`, auth, gate, async (req: any, res) => {
    const handle = handleOf(req.params.handle);
    if (!handle) return res.status(404).json({ message: "That profile doesn't exist." });
    try {
      const me = v(req);
      const p = await profileRow(handle);
      if (!p) return res.status(404).json({ message: "That profile doesn't exist." });
      const { data: blocks } = await db().from("podcast_blocks").select("blocker,blocked").in("blocker", [me, p.voter]).in("blocked", [me, p.voter]);
      const iBlocked = (blocks || []).some((b: any) => b.blocker === me && b.blocked === p.voter);
      const theyBlocked = (blocks || []).some((b: any) => b.blocker === p.voter && b.blocked === me);
      if (theyBlocked) return res.status(404).json({ message: "This profile isn't available." });
      const [{ count: followers }, { count: following }, { count: posts }, { data: f1 }, { data: f2 }, { data: theirFans }, { data: myFollows }] = await Promise.all([
        db().from("podcast_people_follows").select("follower", { count: "exact", head: true }).eq("followee", p.voter),
        db().from("podcast_people_follows").select("followee", { count: "exact", head: true }).eq("follower", p.voter),
        db().from("podcast_posts").select("id", { count: "exact", head: true }).eq("voter", p.voter).eq("hidden", false).neq("kind", "bookmark"),
        db().from("podcast_people_follows").select("followee").eq("follower", me).eq("followee", p.voter).maybeSingle(),
        db().from("podcast_people_follows").select("follower").eq("follower", p.voter).eq("followee", me).maybeSingle(),
        db().from("podcast_people_follows").select("follower").eq("followee", p.voter).limit(5000),
        db().from("podcast_people_follows").select("followee").eq("follower", me).limit(5000),
      ]);
      // People you follow who follow them ("Followed by Tes and 3 others").
      const iFollow = new Set((myFollows || []).map((x: any) => x.followee));
      const mutualIds = (theirFans || []).map((x: any) => x.follower).filter((id: string) => iFollow.has(id) && id !== me);
      const mutuals = mutualIds.length ? [...(await d.peopleById(mutualIds.slice(0, 3))).values()].filter((r) => !r.hidden).map(d.profileOf) : [];
      // Favorite podcasts (set in Edit profile; kept in their page data).
      const { data: pg } = await db().from("podcast_profiles").select("page").eq("voter", p.voter).maybeSingle();
      const favs = Array.isArray(pg?.page?.widgets) ? (pg.page.widgets.find((w: any) => w?.type === "top8")?.shows ?? []).slice(0, 8) : [];
      res.set("Cache-Control", "no-store");
      res.json({
        profile: d.profileOf(p), me: p.voter === me, followers: followers ?? 0, following: following ?? 0, posts: posts ?? 0,
        followed: !!f1, followsYou: !!f2 && p.voter !== me, blocked: iBlocked, mutuals, mutualCount: mutualIds.length, favorites: favs,
      });
    } catch (e) { fail(res, e); }
  });

  /** A profile's tab: posts, media, clips, podcast; likes and saved only for yourself. 20 at a time. */
  app.get(`${P}/profile/:handle/posts`, auth, gate, async (req: any, res) => {
    const handle = handleOf(req.params.handle);
    const tab = ["posts", "media", "clips", "podcast", "likes", "saved"].includes(req.query?.tab) ? req.query.tab : "posts";
    if (!handle) return res.json({ posts: [], next: null });
    try {
      const me = v(req);
      const p = await profileRow(handle);
      if (!p) return res.json({ posts: [], next: null });
      const before = cursor(req.query?.before);
      if (tab === "likes" || tab === "saved") {
        if (p.voter !== me) return res.json({ posts: [], next: null, private: true });
        let q = db().from(tab === "likes" ? "podcast_post_likes" : "podcast_post_saves").select("post_id,created_at").eq("voter", me).order("created_at", { ascending: false }).limit(20);
        if (before) q = q.lt("created_at", before);
        const { data: marks, error } = await q;
        check(error);
        const ids = (marks || []).map((m: any) => Number(m.post_id));
        const { data: rows } = ids.length ? await (await postsQuery()).in("id", ids) : { data: [] };
        const byId = new Map((rows || []).map((r: any) => [Number(r.id), r]));
        const posts = await d.shape(ids.map((id: number) => byId.get(id)).filter(Boolean), me);
        return res.json({ posts, next: (marks || []).length === 20 ? (marks as any[])[19].created_at : null });
      }
      let q = (await postsQuery()).eq("voter", p.voter).order("created_at", { ascending: false }).limit(20);
      if (tab === "posts") q = q.neq("kind", "bookmark");
      if (tab === "media") q = q.not("media", "is", null);
      if (tab === "clips") q = q.eq("kind", "clip");
      if (tab === "podcast") q = q.eq("kind", "own");
      if (before) q = q.lt("created_at", before);
      const { data, error } = await q;
      check(error);
      res.set("Cache-Control", "no-store");
      res.json({ posts: await d.shape(data || [], me), next: (data || []).length === 20 ? (data as any[])[19].created_at : null });
    } catch (e) { fail(res, e); }
  });

  /** Followers or following, as people you can follow back. */
  for (const which of ["followers", "following"] as const) {
    app.get(`${P}/profile/:handle/${which}`, auth, gate, async (req: any, res) => {
      const handle = handleOf(req.params.handle);
      if (!handle) return res.json({ people: [] });
      try {
        const me = v(req);
        const p = await profileRow(handle);
        if (!p) return res.json({ people: [] });
        const { data, error } = which === "followers"
          ? await db().from("podcast_people_follows").select("follower,created_at").eq("followee", p.voter).order("created_at", { ascending: false }).limit(300)
          : await db().from("podcast_people_follows").select("followee,created_at").eq("follower", p.voter).order("created_at", { ascending: false }).limit(300);
        check(error);
        const ids = (data || []).map((x: any) => (which === "followers" ? x.follower : x.followee));
        const blocked = await d.blockSet(me);
        const rows = ids.length ? await d.peopleById(ids.filter((id: string) => !blocked.has(id))) : new Map();
        const ordered = ids.map((id: string) => rows.get(id)).filter(Boolean);
        res.set("Cache-Control", "no-store");
        res.json({ people: await people(ordered, me) });
      } catch (e) { fail(res, e); }
    });
  }

  // -------------------------------------------------------------------------
  // Saved posts, polls, blocking
  app.post(`${P}/posts/:id/save`, auth, gate, async (req: any, res) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a post." });
    if (limited(d.writes, req, res)) return;
    try {
      const me = v(req);
      const r = req.body?.on === false
        ? await db().from("podcast_post_saves").delete().eq("post_id", id).eq("voter", me)
        : await db().from("podcast_post_saves").upsert({ post_id: id, voter: me }, { onConflict: "post_id,voter" });
      check(r.error);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  app.post(`${P}/posts/:id/vote`, auth, gate, async (req: any, res) => {
    const id = idOf(req.params.id), choice = Math.floor(Number(req.body?.choice));
    if (!id || !(choice >= 0 && choice <= 3)) return res.status(400).json({ message: "Pick one of the choices." });
    if (limited(d.writes, req, res)) return;
    try {
      const me = v(req);
      if (!(await d.myProfile(me))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const { data: row, error } = await (await postsQuery()).eq("id", id).maybeSingle();
      check(error);
      const poll = row?.poll;
      if (!row || !poll || !Array.isArray(poll.options)) return res.status(404).json({ message: "That poll is gone." });
      if (choice >= poll.options.length) return res.status(400).json({ message: "Pick one of the choices." });
      if (Date.parse(poll.ends) <= Date.now()) return res.status(400).json({ message: "This poll has ended." });
      const ins = await db().from("podcast_poll_votes").insert({ post_id: id, voter: me, choice });
      if (ins.error && ins.error.code !== "23505") check(ins.error);
      const [post] = await d.shape([row], me);
      res.json({ poll: post?.poll ?? null });
    } catch (e) { fail(res, e); }
  });

  app.post(`${P}/block`, auth, gate, async (req: any, res) => {
    const handle = handleOf(req.body?.handle);
    if (!handle) return res.status(400).json({ message: "That profile doesn't exist." });
    if (limited(d.writes, req, res)) return;
    try {
      const me = v(req);
      const p = await profileRow(handle);
      if (!p || p.voter === me) return res.status(400).json({ message: "That profile doesn't exist." });
      if (req.body?.on === false) {
        const { error } = await db().from("podcast_blocks").delete().eq("blocker", me).eq("blocked", p.voter);
        check(error);
      } else {
        const { error } = await db().from("podcast_blocks").upsert({ blocker: me, blocked: p.voter }, { onConflict: "blocker,blocked" });
        check(error);
        // Blocking also ends following, both ways.
        await db().from("podcast_people_follows").delete().eq("follower", me).eq("followee", p.voter);
        await db().from("podcast_people_follows").delete().eq("follower", p.voter).eq("followee", me);
      }
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });
  app.get(`${P}/blocked`, auth, gate, async (req: any, res) => {
    try {
      const me = v(req);
      const { data, error } = await db().from("podcast_blocks").select("blocked").eq("blocker", me).limit(500);
      check(error);
      const rows = await d.peopleById((data || []).map((x: any) => x.blocked));
      res.json({ people: [...rows.values()].map(d.profileOf) });
    } catch (e) { fail(res, e); }
  });

  // -------------------------------------------------------------------------
  // Direct messages
  async function threadRows(me: string): Promise<any[]> {
    const cols = "id,a,b,started_by,accepted,last_at,last_text,last_from,a_read_at,b_read_at,a_hidden,b_hidden,created_at";
    const [ra, rb] = await Promise.all([
      db().from("podcast_dm_threads").select(cols).eq("a", me).order("last_at", { ascending: false }).limit(200),
      db().from("podcast_dm_threads").select(cols).eq("b", me).order("last_at", { ascending: false }).limit(200),
    ]);
    if (ra.error && /podcast_dm/.test(String(ra.error.message))) return [];
    check(ra.error); check(rb.error);
    return [...(ra.data || []), ...(rb.data || [])].sort((x, y) => Date.parse(y.last_at) - Date.parse(x.last_at));
  }
  function threadState(t: any, me: string) {
    const side = t.a === me ? "a" : "b";
    const other = side === "a" ? t.b : t.a;
    const readAt = t[`${side}_read_at`];
    const request = !t.accepted && t.started_by !== me;
    const unread = !!t.last_from && t.last_from !== me && (!readAt || Date.parse(t.last_at) > Date.parse(readAt));
    return { other, side, request, unread, hidden: !!t[`${side}_hidden`] || (!t.last_from && t.started_by !== me) };
  }
  async function shapeThreads(rows: any[], me: string): Promise<Thread[]> {
    const states = rows.map((t) => ({ t, s: threadState(t, me) })).filter((x) => !x.s.hidden);
    const who = await d.peopleById([...new Set(states.map((x) => x.s.other))]);
    const blocked = await d.blockSet(me);
    return states.filter((x) => who.has(x.s.other) && !who.get(x.s.other).hidden && !blocked.has(x.s.other)).map(({ t, s }) => ({
      id: String(t.id), with: d.profileOf(who.get(s.other)), lastText: t.last_text || "", lastAt: t.last_at, lastFromMe: t.last_from === me,
      unread: s.unread, accepted: !!t.accepted, request: s.request,
    }));
  }
  async function myThread(req: any, res: any) {
    const id = idOf(req.params.id), me = v(req);
    if (!id) { res.status(404).json({ message: "That conversation is gone." }); return null; }
    const { data, error } = await db().from("podcast_dm_threads").select("*").eq("id", id).maybeSingle();
    check(error);
    if (!data || (data.a !== me && data.b !== me)) { res.status(404).json({ message: "That conversation is gone." }); return null; }
    return data;
  }

  app.get(`${P}/dm`, auth, gate, async (req: any, res) => {
    try {
      const me = v(req);
      const all = await shapeThreads(await threadRows(me), me);
      res.set("Cache-Control", "no-store");
      res.json({ threads: all.filter((t) => (req.query?.box === "requests" ? t.request : !t.request)), requests: all.filter((t) => t.request).length });
    } catch (e) { fail(res, e); }
  });

  /** Open (or start) a conversation with someone. */
  app.post(`${P}/dm/with`, auth, gate, async (req: any, res) => {
    const handle = handleOf(req.body?.handle);
    if (!handle) return res.status(400).json({ message: "That profile doesn't exist." });
    if (limited(d.writes, req, res)) return;
    try {
      const me = v(req);
      if (!(await d.myProfile(me))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const p = await profileRow(handle);
      if (!p) return res.status(404).json({ message: "That profile doesn't exist." });
      if (p.voter === me) return res.status(400).json({ message: "That's you!" });
      if ((await d.blockSet(me)).has(p.voter)) return res.status(403).json({ message: "You can't message this person." });
      const [a, b] = pairOf(me, p.voter);
      let { data: t, error } = await db().from("podcast_dm_threads").select("*").eq("a", a).eq("b", b).maybeSingle();
      check(error);
      if (!t) {
        // Someone who already follows you lands in your inbox; anyone else waits in Requests.
        const { data: theyFollow } = await db().from("podcast_people_follows").select("follower").eq("follower", p.voter).eq("followee", me).maybeSingle();
        const ins = await db().from("podcast_dm_threads").insert({ a, b, started_by: me, accepted: !!theyFollow, last_text: "", last_at: new Date().toISOString() }).select("*").single();
        if (ins.error?.code === "23505") ({ data: t } = await db().from("podcast_dm_threads").select("*").eq("a", a).eq("b", b).maybeSingle());
        else { check(ins.error); t = ins.data; }
      }
      const side = t.a === me ? "a" : "b";
      if (t[`${side}_hidden`]) await db().from("podcast_dm_threads").update({ [`${side}_hidden`]: false }).eq("id", t.id);
      res.json({ thread: { id: String(t.id), with: d.profileOf(p), lastText: t.last_text || "", lastAt: t.last_at, lastFromMe: t.last_from === me, unread: false, accepted: !!t.accepted, request: !t.accepted && t.started_by !== me } as Thread });
    } catch (e) { fail(res, e); }
  });

  app.get(`${P}/dm/:id/messages`, auth, gate, async (req: any, res) => {
    try {
      const t = await myThread(req, res); if (!t) return;
      const me = v(req);
      const after = idOf(req.query?.after);
      let q = db().from("podcast_dm_messages").select("id,sender,body,media,post_id,created_at").eq("thread_id", t.id);
      q = after ? q.gt("id", after).order("id", { ascending: true }).limit(100) : q.order("id", { ascending: false }).limit(80);
      const { data, error } = await q;
      check(error);
      const rows = after ? data || [] : (data || []).reverse();
      const postIds = [...new Set(rows.map((m: any) => m.post_id).filter(Boolean))];
      const { data: postRows } = postIds.length ? await (await postsQuery()).in("id", postIds) : { data: [] };
      const posts = new Map((await d.shape(postRows || [], me)).map((p) => [p.id, p] as [string, Post]));
      const side = t.a === me ? "a" : "b", other = side === "a" ? "b" : "a";
      const who = await d.peopleById([t[other]]);
      res.set("Cache-Control", "no-store");
      res.json({
        messages: rows.map((m: any): Message => ({ id: String(m.id), mine: m.sender === me, body: m.body || "", media: Array.isArray(m.media) ? m.media : [], post: m.post_id ? posts.get(String(m.post_id)) ?? null : null, at: m.created_at })),
        with: who.get(t[other]) ? d.profileOf(who.get(t[other])) : null,
        seenAt: t[`${other}_read_at`], accepted: !!t.accepted, request: !t.accepted && t.started_by !== me,
        waiting: !t.accepted && t.started_by === me,
      });
    } catch (e) { fail(res, e); }
  });

  app.post(`${P}/dm/:id/messages`, auth, gate, async (req: any, res) => {
    if (limited(dms, req, res)) return;
    try {
      const t = await myThread(req, res); if (!t) return;
      const me = v(req);
      const other = t.a === me ? t.b : t.a;
      if ((await d.blockSet(me)).has(other)) return res.status(403).json({ message: "You can't message this person." });
      const body = text(req.body?.body, 2000);
      const media = cleanMedia(req.body?.media, d.publicPrefix(), d.folderOf(me)).slice(0, 1);
      const postId = idOf(req.body?.postId);
      if (!body && !media.length && !postId) return res.status(400).json({ message: "Write something first." });
      if (media.length && media[0].type === "image") { const ok = await moderateImages([media[0].url]); if (!ok.ok) return res.status(400).json({ message: `That photo can't be sent (${ok.reason}).` }); }
      // A request holds a few messages until it's accepted; replying accepts it.
      let accepted = !!t.accepted;
      if (!accepted && t.started_by !== me) accepted = true;
      if (!accepted) {
        const { count } = await db().from("podcast_dm_messages").select("id", { count: "exact", head: true }).eq("thread_id", t.id).eq("sender", me);
        if ((count ?? 0) >= REQUEST_LIMIT) return res.status(403).json({ message: "Wait for them to accept your message request." });
      }
      const ins = await db().from("podcast_dm_messages").insert({ thread_id: t.id, sender: me, body, media: media.length ? media : null, post_id: postId || null }).select("id,created_at").single();
      check(ins.error);
      const preview = body ? body.slice(0, 120) : media.length ? (media[0].type === "video" ? "Sent a video" : "Sent a photo") : "Shared a post";
      const side = t.a === me ? "a" : "b";
      await db().from("podcast_dm_threads").update({ last_at: ins.data.created_at, last_text: preview, last_from: me, accepted, [`${side}_read_at`]: ins.data.created_at, a_hidden: false, b_hidden: false }).eq("id", t.id);
      let post: Post | null = null;
      if (postId) { const { data: pr } = await (await postsQuery()).eq("id", postId).maybeSingle(); if (pr) [post] = await d.shape([pr], me); }
      res.json({ message: { id: String(ins.data.id), mine: true, body, media, post, at: ins.data.created_at } as Message });
    } catch (e) { fail(res, e); }
  });

  app.post(`${P}/dm/:id/read`, auth, gate, async (req: any, res) => {
    try {
      const t = await myThread(req, res); if (!t) return;
      const side = t.a === v(req) ? "a" : "b";
      await db().from("podcast_dm_threads").update({ [`${side}_read_at`]: new Date().toISOString() }).eq("id", t.id);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });
  app.post(`${P}/dm/:id/accept`, auth, gate, async (req: any, res) => {
    try {
      const t = await myThread(req, res); if (!t) return;
      await db().from("podcast_dm_threads").update({ accepted: true }).eq("id", t.id);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });
  /** Delete a conversation for yourself (or decline a request). It comes back if they write again. */
  app.delete(`${P}/dm/:id`, auth, gate, async (req: any, res) => {
    try {
      const t = await myThread(req, res); if (!t) return;
      const side = t.a === v(req) ? "a" : "b";
      await db().from("podcast_dm_threads").update({ [`${side}_hidden`]: true, [`${side}_read_at`]: new Date().toISOString() }).eq("id", t.id);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  // -------------------------------------------------------------------------
  // Stories
  app.get(`${P}/stories`, auth, gate, async (req: any, res) => {
    try {
      const me = v(req);
      const { data: f } = await db().from("podcast_people_follows").select("followee").eq("follower", me).limit(1000);
      const blocked = await d.blockSet(me);
      const authors = [me, ...(f || []).map((x: any) => x.followee)].filter((a) => !blocked.has(a));
      const now = new Date().toISOString();
      const { data, error } = await db().from("podcast_stories").select("id,voter,media,body,bg,episode,created_at").in("voter", authors).eq("hidden", false).gt("expires_at", now).order("created_at", { ascending: true }).limit(500);
      if (error && /podcast_stor/.test(String(error.message))) return res.json({ tray: [] });
      check(error);
      const ids = (data || []).map((s: any) => s.id);
      const [{ data: views }, who] = await Promise.all([
        ids.length ? db().from("podcast_story_views").select("story_id,voter").in("story_id", ids) : Promise.resolve({ data: [] }),
        d.peopleById([...new Set((data || []).map((s: any) => s.voter))] as string[]),
      ]);
      const seenByMe = new Set((views || []).filter((x: any) => x.voter === me).map((x: any) => Number(x.story_id)));
      const viewCount = new Map<number, number>(); for (const x of views || []) viewCount.set(Number(x.story_id), (viewCount.get(Number(x.story_id)) ?? 0) + 1);
      const groups = new Map<string, Story[]>();
      for (const s of data || []) {
        if (!who.has(s.voter) || who.get(s.voter).hidden) continue;
        const st: Story = { id: String(s.id), media: Array.isArray(s.media) ? s.media[0] ?? null : null, body: s.body || "", bg: s.bg || "#7c3aed", episode: s.episode && s.episode.id ? s.episode : null, at: s.created_at, seen: s.voter === me || seenByMe.has(Number(s.id)) };
        if (s.voter === me) st.views = viewCount.get(Number(s.id)) ?? 0;
        groups.set(s.voter, [...(groups.get(s.voter) || []), st]);
      }
      const tray = [...groups.entries()].map(([voter, stories]) => ({ author: d.profileOf(who.get(voter)), me: voter === me, stories, unseen: stories.some((s) => !s.seen), last: stories[stories.length - 1].at }))
        .sort((a, b) => Number(b.me) - Number(a.me) || Number(b.unseen) - Number(a.unseen) || Date.parse(b.last) - Date.parse(a.last));
      res.set("Cache-Control", "no-store");
      res.json({ tray });
    } catch (e) { fail(res, e); }
  });

  app.post(`${P}/stories`, auth, gate, async (req: any, res) => {
    if (limited(storiesLim, req, res)) return;
    try {
      const me = v(req);
      if (!(await d.myProfile(me))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const media = cleanMedia(req.body?.media, d.publicPrefix(), d.folderOf(me)).slice(0, 1);
      const body = text(req.body?.body, 200), bg = cleanColor(req.body?.bg);
      const ep = req.body?.episode && typeof req.body.episode === "object" && /^\d{1,20}$/.test(String(req.body.episode.id || "")) && /^https:\/\//.test(String(req.body.episode.audio || ""))
        ? { id: String(req.body.episode.id), showId: String(req.body.episode.showId || ""), show: text(req.body.episode.show, 200), title: text(req.body.episode.title, 300), art: /^https:\/\//.test(String(req.body.episode.art || "")) ? String(req.body.episode.art).slice(0, 600) : "", audio: String(req.body.episode.audio).slice(0, 1200), secs: Math.max(0, Math.floor(Number(req.body.episode.secs) || 0)), date: text(req.body.episode.date, 40) }
        : null;
      if (!media.length && !body && !ep) return res.status(400).json({ message: "Add a photo, a video, some words or an episode." });
      if (Array.isArray(req.body?.media) && req.body.media.length && !media.length) return res.status(400).json({ message: "Upload your photo or video first." });
      if (media.length && media[0].type === "image") { const ok = await moderateImages([media[0].url]); if (!ok.ok) return res.status(400).json({ message: `That photo can't be posted (${ok.reason}).` }); }
      const { data, error } = await db().from("podcast_stories").insert({ voter: me, media: media.length ? media : null, body, bg, episode: ep }).select("id,created_at").single();
      check(error);
      res.json({ story: { id: String(data.id), media: media[0] ?? null, body, bg, episode: ep, at: data.created_at, seen: true, views: 0 } as Story });
    } catch (e) { fail(res, e); }
  });

  app.post(`${P}/stories/:id/view`, auth, gate, async (req: any, res) => {
    const id = idOf(req.params.id);
    if (!id) return res.json({ ok: true });
    try {
      const me = v(req);
      const { data: s } = await db().from("podcast_stories").select("voter").eq("id", id).maybeSingle();
      if (s && s.voter !== me) await db().from("podcast_story_views").upsert({ story_id: id, voter: me }, { onConflict: "story_id,voter" });
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });
  app.get(`${P}/stories/:id/viewers`, auth, gate, async (req: any, res) => {
    const id = idOf(req.params.id);
    try {
      const me = v(req);
      const { data: s } = await db().from("podcast_stories").select("voter").eq("id", id).maybeSingle();
      if (!s || s.voter !== me) return res.json({ people: [] });
      const { data } = await db().from("podcast_story_views").select("voter,created_at").eq("story_id", id).order("created_at", { ascending: false }).limit(300);
      const rows = await d.peopleById((data || []).map((x: any) => x.voter));
      res.json({ people: (data || []).map((x: any) => rows.get(x.voter)).filter((r: any) => r && !r.hidden).map(d.profileOf) });
    } catch (e) { fail(res, e); }
  });
  app.delete(`${P}/stories/:id`, auth, gate, async (req: any, res) => {
    const id = idOf(req.params.id);
    try {
      const { error } = await db().from("podcast_stories").delete().eq("id", id).eq("voter", v(req));
      check(error);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });
  app.post(`${P}/stories/:id/report`, auth, gate, async (req: any, res) => {
    const id = idOf(req.params.id);
    if (limited(d.writes, req, res)) return;
    try {
      const { data: s } = await db().from("podcast_stories").select("reports").eq("id", id).maybeSingle();
      if (s) await db().from("podcast_stories").update({ reports: (s.reports ?? 0) + 1, hidden: (s.reports ?? 0) + 1 >= 3 }).eq("id", id);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });
}
