// Social for Earshot (LifeHub) and Podscroll, shared by both: profiles, posts (episodes people share,
// text posts, audio clips of a moment, reposts, their bookmarks, and episodes they made and uploaded
// themselves), comments with replies, likes, follows, notifications and reports.
// Tables and the upload bucket: migrations/podcast_social.sql, then migrations/podcast_social_v2.sql
// (comments, notifications, clips and reposts; service role only). Until v2 is run, everything from
// the first file keeps working and the new parts answer "being set up". People are the same ids as
// everywhere else in the podcast apps: "u<Arise user id>" or "d<Podscroll device id>".
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { cleanPodId, cleanUrl } from "../shared/earshot";
import { cleanPage, type GuestEntry } from "../shared/earshotPage";
import { cleanMedia, cleanPoll, cleanWebsite, forYouScore, hashtags, mentions, pollView, type Media, type PollData, type PollView } from "../shared/socialKit";
import { moderateImages } from "./socialModeration";
import { registerSocialPlus } from "./podcastSocialPlus";

export class SocialUnavailable extends Error {}
export type Profile = { handle: string; name: string; bio: string; avatar: string; photo?: string; cover?: string; website?: string; location?: string; verified?: boolean; joined?: string };
/** What a post keeps about its episode, so it plays with no lookup. */
export type PostEpisode = { id: string; showId: string; show: string; title: string; art: string; audio: string; secs: number; date: string; about?: string };
/** A moment of an episode: where it is in the clipper's copy, what's said, and its audio (cut and kept). */
export type Clip = { s: number; e: number; quote: string; audio?: string };
export type PostKind = "share" | "bookmark" | "own" | "text" | "clip" | "repost";
export type Post = {
  id: string; kind: PostKind; caption: string; at: string; episode: PostEpisode | null; clip: Clip | null;
  /** For a repost: the post it passes on (one level deep). */
  repost: Post | null;
  author: Profile; likes: number; liked: boolean; comments: number; reposts: number; reposted: boolean; mine: boolean;
  /** Photos or a video, a poll, and whether the viewer saved it. */
  media?: Media[]; poll?: PollView | null; saved?: boolean;
};
export type Comment = { id: string; postId: string; parentId: string | null; body: string; at: string; author: Profile; likes: number; liked: boolean; mine: boolean };
export type NoteKind = "like" | "comment" | "reply" | "follow" | "repost" | "comment_like" | "episode" | "guestbook" | "mention";
export type Note = { id: string; kind: NoteKind; at: string; read: boolean; actor: Profile; post: { id: string; kind: PostKind; text: string; art: string } | null; comment: string };

const BUCKET = "podcast-uploads";
const PROFILE_COLS = "voter,handle,name,bio,avatar,hidden,photo,cover,website,location,verified,created_at";
const AVATARS = ["🎧", "🎙️", "🦊", "🐼", "🐸", "🦁", "🐙", "🦄", "🐝", "🌵", "🌙", "🔥", "⚡", "🌈", "🍕", "🎸", "🏀", "🚀", "👾", "🧠"];
export const SOCIAL_AVATARS = AVATARS;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "");
export function cleanHandle(v: unknown) { const h = text(v, 30).toLowerCase().replace(/^@/, ""); return /^[a-z0-9_]{3,20}$/.test(h) ? h : ""; }
export function cleanPostEpisode(v: unknown): PostEpisode | null {
  const r = v && typeof v === "object" ? (v as any) : null;
  const id = cleanPodId(r?.id), title = text(r?.title, 300), audio = cleanUrl(r?.audio);
  if (!id || !title || !audio) return null;
  return { id, showId: cleanPodId(r.showId), show: text(r.show, 200), title, art: cleanUrl(r.art), audio, secs: Math.max(0, Math.min(86_400, Math.floor(Number(r.secs) || 0))), date: text(r.date, 40), about: text(r.about, 600) || undefined };
}
/** A clip's times and words: 5-90 seconds, inside the episode. */
export function cleanClip(v: unknown, secs = 0): Clip | null {
  const r = v && typeof v === "object" ? (v as any) : null;
  const s = Math.round(Number(r?.s) * 100) / 100, e = Math.round(Number(r?.e) * 100) / 100;
  if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e - s < 5 || e - s > 90) return null;
  if (secs > 0 && s > secs + 600) return null;
  return { s, e, quote: text(r?.quote, 400) };
}
/** Episodes people make get ids no podcast directory uses: 77 then the post number. */
export const ownEpisodeId = (postId: number) => `77${String(postId).padStart(12, "0")}`;
/** The Clips feed's order: liked, talked-about and passed-on clips first, newer ones ahead of older. */
export function clipScore(p: { likes: number; comments: number; reposts: number; at: string }, now = Date.now()) {
  const hours = Math.max(0, (now - Date.parse(p.at)) / 3600_000) || 0;
  return (1 + p.likes * 3 + p.comments * 2 + p.reposts * 4) / Math.pow(hours + 2, 1.2);
}
/** Replies hang off a top-level comment: a reply to a reply joins its thread. */
export function threadParent(parent: { id: string; parentId: string | null } | null): string | null { return parent ? parent.parentId ?? parent.id : null; }
/** What people may search for: letters, numbers, spaces and _ (nothing that changes the query). */
export const searchTerm = (v: unknown) => text(v, 40).toLowerCase().replace(/[^a-z0-9_ ]/g, "").trim();

export type CutClip = (voter: string, c: { sid?: string; episodeId: string; showId: string; s: number; e: number }) => Promise<Blob | null>;

export function registerSocialRoutes(app: Express, auth: RequestHandler, o: {
  prefix: string; getDb: () => any; voterOf: (req: any) => string;
  /** Students can't use social (no strangers, no uploads). */
  allowed?: (req: any) => boolean;
  /** Cuts a clip's audio (server/earshot.ts: from the listener's own copy when it can). */
  cutClip?: CutClip;
  /** Publishing an episode needs a creator (on Pod+, someone signed in with their email). */
  isCreator?: (req: any) => boolean;
}) {
  const P = `${o.prefix}/social`;
  const db = () => o.getDb();
  const writes = createAttemptLimiter({ max: 60, windowMs: 10 * 60_000 });
  const talk = createAttemptLimiter({ max: 40, windowMs: 10 * 60_000 });
  const uploads = createAttemptLimiter({ max: 12, windowMs: 60 * 60_000 });
  const clips = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });
  const mediaUploads = createAttemptLimiter({ max: 60, windowMs: 60 * 60_000 });
  const missing = (e: any) => e && (e.code === "42P01" || e.code === "PGRST205" || /podcast_(profiles|posts|post_likes|people_follows|post_reports)/.test(String(e.message || "")) && /not find|does not exist/i.test(String(e.message || "")));
  const check = (error: any) => { if (error) { if (missing(error)) throw new SocialUnavailable(); throw error; } };
  const fail = (res: any, e: any) => {
    if (e instanceof SocialUnavailable) return res.status(503).json({ message: "Social is still being set up. Try again soon.", setup: true });
    console.error("[earshot] social:", e?.message || e);
    res.status(500).json({ message: "That didn't work. Try again." });
  };
  const gate: RequestHandler = (req: any, res, next) => {
    if (o.allowed && !o.allowed(req)) { res.status(403).json({ message: "Social isn't available on student accounts." }); return; }
    next();
  };
  const limited = (lim: ReturnType<typeof createAttemptLimiter>, req: any, res: any) => {
    const k = o.voterOf(req); const wait = lim.retryAfter(k);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `Slow down a little. Try again in ${waitWords(wait)}.` }); return true; }
    lim.fail(k); return false;
  };

  // Comments, notifications, clips and reposts need migrations/podcast_social_v2.sql. Checked once a
  // minute until it's there, so running it turns them on without a restart.
  let v2: { on: boolean; at: number } | null = null;
  async function hasV2(): Promise<boolean> {
    if (v2 && (v2.on || Date.now() - v2.at < 60_000)) return v2.on;
    const { error } = await db().from("podcast_notifications").select("id").limit(1);
    v2 = { on: !error, at: Date.now() };
    return v2.on;
  }
  const needV2 = async (res: any) => {
    if (await hasV2()) return false;
    res.status(503).json({ message: "This part of Social is still being set up. Try again soon.", setup: true });
    return true;
  };

  const profileOf = (r: any): Profile => ({
    handle: r.handle, name: r.name, bio: r.bio || "", avatar: r.avatar || "🎧",
    ...(r.photo ? { photo: r.photo } : {}), ...(r.cover ? { cover: r.cover } : {}), ...(r.website ? { website: r.website } : {}),
    ...(r.location ? { location: r.location } : {}), ...(r.verified ? { verified: true } : {}), ...(r.created_at ? { joined: r.created_at } : {}),
  });
  /** Where people's uploads live (posts only use files from here, from the poster's own folder). */
  const publicPrefix = () => { try { return db().storage.from(BUCKET).getPublicUrl("").data.publicUrl.replace(/\/?$/, "/"); } catch { return ""; } };
  const folderOf = (voter: string) => voter.replace(/[^A-Za-z0-9_-]/g, "");
  /** Everyone the viewer blocked or who blocked them (their posts and messages stay out of sight both ways). */
  async function blockSet(viewer: string): Promise<Set<string>> {
    const [mine, theirs] = await Promise.all([
      db().from("podcast_blocks").select("blocked").eq("blocker", viewer).limit(2000),
      db().from("podcast_blocks").select("blocker").eq("blocked", viewer).limit(2000),
    ]);
    if (mine.error || theirs.error) return new Set();
    return new Set([...(mine.data || []).map((b: any) => b.blocked), ...(theirs.data || []).map((b: any) => b.blocker)]);
  }
  async function myProfile(voter: string) {
    const { data, error } = await db().from("podcast_profiles").select(PROFILE_COLS).eq("voter", voter).maybeSingle();
    check(error);
    return data ? profileOf(data) : null;
  }
  /** A profile's own page design and guestbook (null/[] when the columns aren't there yet). */
  async function pageOf(voter: string): Promise<{ page: any; guestbook: GuestEntry[] }> {
    const { data, error } = await db().from("podcast_profiles").select("page,guestbook").eq("voter", voter).maybeSingle();
    if (error) return { page: null, guestbook: [] };
    return { page: data?.page ? cleanPage(data.page) : null, guestbook: Array.isArray(data?.guestbook) ? data.guestbook : [] };
  }
  async function peopleById(voters: string[]) {
    if (!voters.length) return new Map<string, any>();
    const { data, error } = await db().from("podcast_profiles").select(PROFILE_COLS).in("voter", voters);
    check(error);
    return new Map<string, any>((data || []).map((p: any) => [p.voter, p]));
  }
  const postCols = async () => ((await hasV2()) ? "id,voter,kind,episode,caption,created_at,clip,repost_of,hidden,media,poll" : "id,voter,kind,episode,caption,created_at,hidden");
  const episodeOf = (r: any): PostEpisode | null => (r.episode && typeof r.episode === "object" && r.episode.id ? r.episode : null);

  /** Posts with their authors, counts and the viewer's own likes and reposts (and, for reposts, the post they pass on). */
  async function shape(rows: any[], viewer: string, deep = true): Promise<Post[]> {
    if (!rows.length) return [];
    const on = await hasV2();
    const ids = rows.map((r) => Number(r.id));
    const originalIds = deep ? Array.from(new Set(rows.map((r) => r.repost_of).filter((x) => x != null).map(Number))) : [];
    const hasPoll = rows.some((r) => r.poll);
    const [blocked, savesRes, votesRes] = await Promise.all([
      blockSet(viewer),
      db().from("podcast_post_saves").select("post_id").eq("voter", viewer).in("post_id", ids).then((r: any) => r, () => ({ data: [] })),
      hasPoll ? db().from("podcast_poll_votes").select("post_id,voter,choice").in("post_id", ids).then((r: any) => r, () => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]);
    const savedIds = new Set(((savesRes as any).data || []).map((x: any) => Number(x.post_id)));
    const [who, likesRes, commentsRes, repostsRes, originalsRes] = await Promise.all([
      peopleById(Array.from(new Set(rows.map((r) => r.voter)))),
      db().from("podcast_post_likes").select("post_id,voter").in("post_id", ids),
      on ? db().from("podcast_comments").select("post_id").in("post_id", ids).eq("hidden", false) : Promise.resolve({ data: [], error: null }),
      on ? db().from("podcast_posts").select("repost_of,voter").in("repost_of", ids).eq("hidden", false) : Promise.resolve({ data: [], error: null }),
      originalIds.length ? db().from("podcast_posts").select(await postCols()).in("id", originalIds) : Promise.resolve({ data: [], error: null }),
    ]);
    check(likesRes.error); check(commentsRes.error); check(repostsRes.error); check(originalsRes.error);
    const originals = new Map<number, Post>();
    if (originalIds.length) for (const p of await shape((originalsRes.data || []).filter((r: any) => !r.hidden), viewer, false)) originals.set(Number(p.id), p);
    const count = (list: any[], key: string, id: number) => list.filter((x) => Number(x[key]) === id).length;
    return rows.filter((r) => who.has(r.voter) && !who.get(r.voter).hidden && !r.hidden && !blocked.has(r.voter)).flatMap((r): Post[] => {
      const id = Number(r.id), likes = (likesRes.data || []).filter((x: any) => Number(x.post_id) === id), reposts = (repostsRes.data || []).filter((x: any) => Number(x.repost_of) === id);
      const repost = r.repost_of != null ? originals.get(Number(r.repost_of)) ?? null : null;
      // A repost of something deleted or hidden goes with it.
      if (r.kind === "repost" && !repost) return [];
      return [{
        id: String(r.id), kind: r.kind, caption: r.caption || "", at: r.created_at, episode: episodeOf(r), clip: r.clip ?? null, repost,
        author: profileOf(who.get(r.voter)), likes: likes.length, liked: likes.some((x: any) => x.voter === viewer),
        comments: count(commentsRes.data || [], "post_id", id), reposts: reposts.length, reposted: reposts.some((x: any) => x.voter === viewer), mine: r.voter === viewer,
        media: Array.isArray(r.media) ? r.media : [], poll: r.poll ? pollView(r.poll as PollData, ((votesRes as any).data || []).filter((v: any) => Number(v.post_id) === id), viewer) : null, saved: savedIds.has(id),
      }];
    });
  }
  /** Tells someone what happened (never about their own doing). Likes and follows aren't repeated when toggled. */
  async function notify(voter: string, actor: string, kind: NoteKind, postId?: number, commentId?: number) {
    if (!voter || voter === actor || !(await hasV2())) return;
    try {
      if (kind === "like" || kind === "follow" || kind === "comment_like") {
        let q = db().from("podcast_notifications").delete().eq("voter", voter).eq("actor", actor).eq("kind", kind);
        if (postId) q = q.eq("post_id", postId);
        if (commentId) q = q.eq("comment_id", commentId);
        await q;
      }
      await db().from("podcast_notifications").insert({ voter, actor, kind, post_id: postId ?? null, comment_id: commentId ?? null });
    } catch { /* a missed notification isn't worth failing the action for */ }
  }
  /** @mentions: each person named gets a notification (not the writer, not people already told). */
  async function notifyMentions(body: string, actor: string, postId: number, commentId?: number, skip: string[] = []) {
    const handles = mentions(body);
    if (!handles.length) return;
    try {
      const { data } = await db().from("podcast_profiles").select("voter,handle").in("handle", handles);
      for (const p of data || []) if (p.voter !== actor && !skip.includes(p.voter)) await notify(p.voter, actor, "mention", postId, commentId);
    } catch { /* a missed mention isn't worth failing the post for */ }
  }
  async function postRow(id: number) {
    const { data, error } = await db().from("podcast_posts").select(await postCols()).eq("id", id).maybeSingle();
    check(error);
    return data && !data.hidden ? data : null;
  }

  /** Your profile (null until you make one), with your unread notifications. */
  app.get(`${P}/me`, auth, gate, async (req: any, res) => {
    try {
      const voter = o.voterOf(req);
      const me = await myProfile(voter);
      const v2on = await hasV2();
      if (!me) return res.json({ profile: null, avatars: AVATARS, v2: v2on });
      const [{ count: followers }, { count: following }, unread] = await Promise.all([
        db().from("podcast_people_follows").select("follower", { count: "exact", head: true }).eq("followee", voter),
        db().from("podcast_people_follows").select("followee", { count: "exact", head: true }).eq("follower", voter),
        v2on ? db().from("podcast_notifications").select("id", { count: "exact", head: true }).eq("voter", voter).eq("read", false) : Promise.resolve({ count: 0 }),
      ]);
      res.set("Cache-Control", "no-store");
      const { page } = await pageOf(voter);
      res.json({ profile: me, page, followers: followers ?? 0, following: following ?? 0, unread: (unread as any).count ?? 0, avatars: AVATARS, v2: v2on });
    } catch (e) { fail(res, e); }
  });

  /** Make or change your profile. */
  app.post(`${P}/me`, auth, gate, async (req: any, res) => {
    const handle = cleanHandle(req.body?.handle), name = text(req.body?.name, 40), bio = text(req.body?.bio, 160);
    const avatar = AVATARS.includes(req.body?.avatar) ? req.body.avatar : "🎧";
    const website = cleanWebsite(req.body?.website), location = text(req.body?.location, 40);
    if (!handle) return res.status(400).json({ message: "Pick a username: 3-20 letters, numbers or _." });
    if (!name) return res.status(400).json({ message: "Add your name (or a nickname)." });
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req);
      const { data: taken, error: e1 } = await db().from("podcast_profiles").select("voter").eq("handle", handle).maybeSingle();
      check(e1);
      if (taken && taken.voter !== voter) return res.status(409).json({ message: `@${handle} is taken. Try another.` });
      // A profile photo and cover: only files they uploaded themselves ("" removes one; left out keeps it).
      const pic = (v: unknown) => (typeof v === "string" ? (v === "" ? "" : cleanMedia([{ type: "image", url: v }], publicPrefix(), folderOf(voter))[0]?.url ?? null) : undefined);
      const photo = pic(req.body?.photo), cover = pic(req.body?.cover);
      if (photo === null || cover === null) return res.status(400).json({ message: "Upload that picture first." });
      const fresh = [photo, cover].filter((u): u is string => !!u);
      if (fresh.length) { const v = await moderateImages(fresh); if (!v.ok) return res.status(400).json({ message: `That picture can't be used (${v.reason}).` }); }
      const row: any = { voter, handle, name, bio, avatar, updated_at: new Date().toISOString() };
      if (req.body?.website !== undefined) row.website = website || null;
      if (req.body?.location !== undefined) row.location = location || null;
      if (photo !== undefined) row.photo = photo || null;
      if (cover !== undefined) row.cover = cover || null;
      const { error } = await db().from("podcast_profiles").upsert(row, { onConflict: "voter" });
      check(error);
      res.json({ profile: await myProfile(voter) });
    } catch (e) { fail(res, e); }
  });

  /** Save your page design (background, colors, font, widgets...). Cleaned so nothing unsafe is kept. */
  app.post(`${P}/me/page`, auth, gate, async (req: any, res) => {
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req);
      if (!(await myProfile(voter))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const page = cleanPage(req.body?.page);
      if (JSON.stringify(page).length > 40_000) return res.status(400).json({ message: "Your page is too big. Remove a few widgets." });
      const { error } = await db().from("podcast_profiles").update({ page, updated_at: new Date().toISOString() }).eq("voter", voter);
      if (error && /column|page/i.test(String(error.message))) return res.status(503).json({ message: "Page designs are still being set up. Try again soon.", setup: true });
      check(error);
      res.json({ page });
    } catch (e) { fail(res, e); }
  });

  /** Sign someone's guestbook (newest first, up to 60 kept). */
  app.post(`${P}/u/:handle/guestbook`, auth, gate, async (req: any, res) => {
    const handle = cleanHandle(req.params.handle), body = text(req.body?.body, 280);
    if (!handle) return res.status(404).json({ message: "That profile doesn't exist." });
    if (!body) return res.status(400).json({ message: "Write something first." });
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req);
      const me = await myProfile(voter);
      if (!me) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const { data: p, error } = await db().from("podcast_profiles").select("voter,hidden,guestbook").eq("handle", handle).maybeSingle();
      check(error);
      if (!p || p.hidden) return res.status(404).json({ message: "That profile doesn't exist." });
      const entry: GuestEntry = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, handle: me.handle, name: me.name, avatar: me.avatar, body, at: new Date().toISOString() };
      const list = [entry, ...(Array.isArray(p.guestbook) ? p.guestbook : [])].slice(0, 60);
      const { error: e2 } = await db().from("podcast_profiles").update({ guestbook: list }).eq("voter", p.voter);
      check(e2);
      if (p.voter !== voter) void notify(p.voter, voter, "guestbook");
      res.json({ entry, guestbook: list });
    } catch (e) { fail(res, e); }
  });

  /** Remove a guestbook note: the page's owner can remove any, a visitor their own. */
  app.delete(`${P}/u/:handle/guestbook/:id`, auth, gate, async (req: any, res) => {
    const handle = cleanHandle(req.params.handle), id = String(req.params.id || "").replace(/[^a-z0-9]/g, "").slice(0, 20);
    if (!handle || !id) return res.status(404).json({ message: "That note is gone." });
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req);
      const me = await myProfile(voter);
      const { data: p, error } = await db().from("podcast_profiles").select("voter,guestbook").eq("handle", handle).maybeSingle();
      check(error);
      if (!p) return res.status(404).json({ message: "That profile doesn't exist." });
      const list: GuestEntry[] = Array.isArray(p.guestbook) ? p.guestbook : [];
      const hit = list.find((g) => g.id === id);
      if (!hit) return res.json({ guestbook: list });
      if (p.voter !== voter && hit.handle !== me?.handle) return res.status(403).json({ message: "Only the page's owner or the note's writer can remove it." });
      const next = list.filter((g) => g.id !== id);
      const { error: e2 } = await db().from("podcast_profiles").update({ guestbook: next }).eq("voter", p.voter);
      check(e2);
      res.json({ guestbook: next });
    } catch (e) { fail(res, e); }
  });

  /** The feed: everyone's posts, the people you follow, or the Clips feed (ranked). */
  app.get(`${P}/feed`, auth, gate, async (req: any, res) => {
    try {
      const voter = o.voterOf(req);
      const tab = req.query?.tab === "following" ? "following" : req.query?.tab === "clips" ? "clips" : "all";
      const cols = await postCols();
      res.set("Cache-Control", "no-store");
      if (tab === "clips") {
        if (!(await hasV2())) return res.json({ posts: [], setup: true });
        const { data, error } = await db().from("podcast_posts").select(cols).eq("kind", "clip").eq("hidden", false).order("created_at", { ascending: false }).limit(150);
        check(error);
        const now = Date.now();
        const posts = (await shape(data || [], voter)).sort((a, b) => clipScore(b, now) - clipScore(a, now)).slice(0, 60);
        return res.json({ posts });
      }
      // Following: newest first, 20 at a time (?before=<time of the last one shown>).
      // For You: the last few hundred posts ranked (shared/socialKit forYouScore), 20 a page (?page=n).
      const before = typeof req.query?.before === "string" && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before).toISOString() : null;
      const page = Math.max(0, Math.min(30, Math.floor(Number(req.query?.page) || 0)));
      const { data: f, error: fe } = await db().from("podcast_people_follows").select("followee").eq("follower", voter).limit(1000);
      check(fe);
      const follows = new Set((f || []).map((x: any) => x.followee));
      if (tab === "following") {
        if (!follows.size) return res.json({ posts: [], next: null });
        let q = db().from("podcast_posts").select(cols).eq("hidden", false).neq("kind", "bookmark").in("voter", [...follows, voter]).order("created_at", { ascending: false }).limit(20);
        if (before) q = q.lt("created_at", before);
        const { data, error } = await q;
        check(error);
        const posts = await shape(data || [], voter);
        return res.json({ posts, next: (data || []).length === 20 ? (data as any[])[19].created_at : null });
      }
      const { data, error } = await db().from("podcast_posts").select(cols).eq("hidden", false).neq("kind", "bookmark").order("created_at", { ascending: false }).limit(400);
      check(error);
      const all = await shape(data || [], voter);
      const voterOfPost = new Map((data || []).map((r: any) => [String(r.id), r.voter] as [string, string]));
      const now = Date.now();
      const ranked = all.map((p) => ({ p, s: forYouScore({ likes: p.likes, comments: p.comments, reposts: p.reposts, at: p.at, followed: follows.has(voterOfPost.get(p.id) || ""), media: !!p.media?.length || !!p.episode, mine: p.mine }, now) }))
        .sort((a, b) => b.s - a.s).map((x) => x.p);
      const slice = ranked.slice(page * 20, page * 20 + 20);
      res.json({ posts: slice, next: ranked.length > (page + 1) * 20 ? page + 1 : null });
    } catch (e) { fail(res, e); }
  });

  /** One post (from a notification or a link). */
  app.get(`${P}/posts/:id`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(404).json({ message: "That post is gone." });
    try {
      const row = await postRow(Number(id));
      const [post] = row ? await shape([row], o.voterOf(req)) : [];
      if (!post) return res.status(404).json({ message: "That post is gone." });
      res.set("Cache-Control", "no-store");
      res.json({ post });
    } catch (e) { fail(res, e); }
  });

  /** Someone's page: their profile, posts, clips, podcast and bookmarks. */
  app.get(`${P}/u/:handle`, auth, gate, async (req: any, res) => {
    const handle = cleanHandle(req.params.handle);
    if (!handle) return res.status(404).json({ message: "That profile doesn't exist." });
    try {
      const voter = o.voterOf(req);
      const { data: p, error } = await db().from("podcast_profiles").select(PROFILE_COLS).eq("handle", handle).maybeSingle();
      check(error);
      if (!p || p.hidden) return res.status(404).json({ message: "That profile doesn't exist." });
      const [{ data: posts, error: e2 }, { count: followers }, { count: following }, { data: mine }] = await Promise.all([
        db().from("podcast_posts").select(await postCols()).eq("voter", p.voter).eq("hidden", false).order("created_at", { ascending: false }).limit(120),
        db().from("podcast_people_follows").select("follower", { count: "exact", head: true }).eq("followee", p.voter),
        db().from("podcast_people_follows").select("followee", { count: "exact", head: true }).eq("follower", p.voter),
        db().from("podcast_people_follows").select("followee").eq("follower", voter).eq("followee", p.voter).maybeSingle(),
      ]);
      check(e2);
      res.set("Cache-Control", "no-store");
      const { page, guestbook } = await pageOf(p.voter);
      // Top 8 friends: the people they picked, in their order (hidden or deleted profiles left out).
      const handles = (page?.widgets || []).find((w: any) => w.type === "friends")?.handles || [];
      let friends: Profile[] = [];
      if (handles.length) {
        const { data: fr } = await db().from("podcast_profiles").select("handle,name,bio,avatar,hidden").in("handle", handles);
        const by = new Map((fr || []).filter((x: any) => !x.hidden).map((x: any) => [x.handle, profileOf(x)] as [string, Profile]));
        friends = handles.map((h: string) => by.get(h)).filter(Boolean) as Profile[];
      }
      res.json({ profile: profileOf(p), page, guestbook: guestbook.slice(0, 60), friends, me: p.voter === voter, followers: followers ?? 0, following: following ?? 0, followed: !!mine, posts: await shape(posts || [], voter) });
    } catch (e) { fail(res, e); }
  });

  /** Find people by name or username; with nothing typed, people worth following. */
  app.get(`${P}/people`, auth, gate, async (req: any, res) => {
    try {
      const voter = o.voterOf(req), q = searchTerm(req.query?.q);
      let rows: any[];
      if (q.length >= 2) {
        const { data, error } = await db().from("podcast_profiles").select(PROFILE_COLS).or(`handle.ilike.%${q.replace(/ /g, "_")}%,name.ilike.%${q}%`).limit(30);
        check(error); rows = data || [];
      } else {
        // Suggestions: the most-followed people, then the newest.
        const [{ data: f, error: e1 }, { data: fresh, error: e2 }] = await Promise.all([
          db().from("podcast_people_follows").select("followee").limit(2000),
          db().from("podcast_profiles").select(PROFILE_COLS).order("created_at", { ascending: false }).limit(30),
        ]);
        check(e1); check(e2);
        const tally = new Map<string, number>(); for (const x of f || []) tally.set(x.followee, (tally.get(x.followee) ?? 0) + 1);
        const top = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([v]) => v);
        const topRows = top.length ? Array.from((await peopleById(top)).values()) : [];
        const seen = new Set<string>(); rows = [...topRows.sort((a, b) => (tally.get(b.voter) ?? 0) - (tally.get(a.voter) ?? 0)), ...(fresh || [])].filter((r) => !seen.has(r.voter) && (seen.add(r.voter), true));
      }
      rows = rows.filter((r) => !r.hidden && r.voter !== voter).slice(0, 20);
      const { data: mine, error } = rows.length ? await db().from("podcast_people_follows").select("followee").eq("follower", voter).in("followee", rows.map((r) => r.voter)) : { data: [], error: null };
      check(error);
      const followed = new Set((mine || []).map((x: any) => x.followee));
      res.set("Cache-Control", "no-store");
      res.json({ people: rows.map((r) => ({ ...profileOf(r), followed: followed.has(r.voter) })) });
    } catch (e) { fail(res, e); }
  });

  /** Follow or unfollow someone. */
  app.post(`${P}/follow`, auth, gate, async (req: any, res) => {
    const handle = cleanHandle(req.body?.handle);
    if (!handle) return res.status(400).json({ message: "That profile doesn't exist." });
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req);
      const { data: p, error } = await db().from("podcast_profiles").select("voter").eq("handle", handle).maybeSingle();
      check(error);
      if (!p) return res.status(404).json({ message: "That profile doesn't exist." });
      if (p.voter === voter) return res.status(400).json({ message: "That's you!" });
      const on = req.body?.on !== false;
      const r = on
        ? await db().from("podcast_people_follows").upsert({ follower: voter, followee: p.voter }, { onConflict: "follower,followee" })
        : await db().from("podcast_people_follows").delete().eq("follower", voter).eq("followee", p.voter);
      check(r.error);
      if (on && (await myProfile(voter))) await notify(p.voter, voter, "follow");
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  /** Post: share an episode, write something, post a clip of a moment, or quote someone's post. */
  app.post(`${P}/posts`, auth, gate, async (req: any, res) => {
    const kind: PostKind = ["text", "clip", "repost"].includes(req.body?.kind) ? req.body.kind : "share";
    const caption = text(req.body?.caption, 500);
    const voterNow = o.voterOf(req);
    const media = kind === "text" ? cleanMedia(req.body?.media, publicPrefix(), folderOf(voterNow)) : [];
    const poll = kind === "text" && req.body?.poll ? cleanPoll(req.body.poll) : null;
    if (kind === "text" && Array.isArray(req.body?.media) && req.body.media.length && !media.length) return res.status(400).json({ message: "Upload your photos or video first." });
    if (kind === "text" && req.body?.poll && !poll) return res.status(400).json({ message: "A poll needs 2 to 4 different choices." });
    const episode = req.body?.episode ? cleanPostEpisode(req.body.episode) : null;
    if ((kind === "share" || kind === "clip") && !episode) return res.status(400).json({ message: "That episode can't be shared." });
    if (kind === "text" && !caption && !media.length) return res.status(400).json({ message: "Write something or add a photo first." });
    const clip = kind === "clip" ? cleanClip(req.body?.clip, episode?.secs) : null;
    if (kind === "clip" && !clip) return res.status(400).json({ message: "A clip runs 5 to 90 seconds." });
    const repostOf = kind === "repost" ? cleanPodId(req.body?.repostOf) : "";
    if (kind === "repost" && !repostOf) return res.status(400).json({ message: "That post is gone." });
    if (limited(writes, req, res)) return;
    if (kind === "clip" && limited(clips, req, res)) return;
    try {
      const voter = o.voterOf(req);
      if (kind !== "share" && (await needV2(res))) return;
      if (!(await myProfile(voter))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      let original: any = null;
      if (kind === "repost") {
        original = await postRow(Number(repostOf));
        // Passing on a plain repost passes on what it reposted.
        if (original?.kind === "repost" && !original.caption && original.repost_of) original = await postRow(Number(original.repost_of));
        if (!original || original.kind === "bookmark") return res.status(404).json({ message: "That post is gone." });
      }
      const row: any = { voter, kind, episode_id: episode?.id ?? "0", episode: episode ?? {}, caption };
      if (clip) row.clip = clip;
      if (media.length) {
        const v = await moderateImages(media.filter((m) => m.type === "image").map((m) => m.url));
        if (!v.ok) return res.status(400).json({ message: `That photo can't be posted (${v.reason}).` });
        row.media = media;
      }
      if (poll) row.poll = poll;
      const tags = hashtags(caption); if (tags.length) row.tags = tags;
      if (original) row.repost_of = original.id;
      const { data, error } = await db().from("podcast_posts").insert(row).select("id").single();
      if (error?.code === "23505") return res.status(409).json({ message: "You've already reposted that." });
      check(error);
      const id = Number(data.id);
      // The clip's audio: cut (from the clipper's own copy when it can be) and kept with the post.
      if (clip && episode && o.cutClip) {
        const sid = typeof req.body?.sid === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(req.body.sid) ? req.body.sid : undefined;
        const blob = await o.cutClip(voter, { sid, episodeId: episode.id, showId: episode.showId, s: clip.s, e: clip.e }).catch(() => null);
        if (blob && blob.size > 2000) {
          const path = `clips/${voter.replace(/[^A-Za-z0-9_-]/g, "")}/${id}.mp3`;
          const up = await db().storage.from(BUCKET).upload(path, blob, { contentType: "audio/mpeg", upsert: true }).catch((e: any) => ({ error: e }));
          if (!up.error) { clip.audio = db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl; await db().from("podcast_posts").update({ clip }).eq("id", id); }
        }
      }
      if (original) await notify(original.voter, voter, "repost", Number(original.id));
      await notifyMentions(caption, voter, id);
      const [post] = await shape([{ ...row, id, created_at: new Date().toISOString(), hidden: false }], voter);
      res.json({ id: String(id), post: post ?? null });
    } catch (e) { fail(res, e); }
  });

  /** Repost (or undo a repost) with no words of your own. */
  app.post(`${P}/posts/:id/repost`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a post." });
    if (limited(writes, req, res)) return;
    try {
      if (await needV2(res)) return;
      const voter = o.voterOf(req);
      if (!(await myProfile(voter))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      if (req.body?.on === false) {
        const { error } = await db().from("podcast_posts").delete().eq("voter", voter).eq("kind", "repost").eq("repost_of", Number(id)).eq("caption", "");
        check(error);
        return res.json({ ok: true });
      }
      let original = await postRow(Number(id));
      if (original?.kind === "repost" && !original.caption && original.repost_of) original = await postRow(Number(original.repost_of));
      if (!original || original.kind === "bookmark") return res.status(404).json({ message: "That post is gone." });
      if (original.voter === voter) return res.status(400).json({ message: "You can't repost your own post." });
      const { error } = await db().from("podcast_posts").insert({ voter, kind: "repost", episode_id: "0", episode: {}, caption: "", repost_of: original.id });
      if (error?.code === "23505") return res.json({ ok: true });
      check(error);
      await notify(original.voter, voter, "repost", Number(original.id));
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  /** Saved episodes show on your profile as bookmarks (when you have one). */
  app.post(`${P}/bookmark`, auth, gate, async (req: any, res) => {
    const episode = cleanPostEpisode(req.body?.episode);
    if (!episode) return res.json({ ok: false });
    try {
      const voter = o.voterOf(req);
      if (!(await myProfile(voter))) return res.json({ ok: false, needProfile: true });
      const r = req.body?.on === false
        ? await db().from("podcast_posts").delete().eq("voter", voter).eq("kind", "bookmark").eq("episode_id", episode.id)
        : await db().from("podcast_posts").upsert({ voter, kind: "bookmark", episode_id: episode.id, episode, caption: "" }, { onConflict: "voter,episode_id", ignoreDuplicates: true });
      check(r.error);
      res.json({ ok: true });
    } catch (e) { if (e instanceof SocialUnavailable) return res.json({ ok: false }); fail(res, e); }
  });

  app.delete(`${P}/posts/:id`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a post." });
    try {
      const { data, error } = await db().from("podcast_posts").delete().eq("id", Number(id)).eq("voter", o.voterOf(req)).select(await postCols());
      check(error);
      if (!data?.length) return res.status(404).json({ message: "That post is already gone, or isn't yours." });
      // Your own episode's audio, or your clip's, goes too.
      const r = data[0], ep = r.kind === "own" ? r.episode : null;
      const paths = [ep?.audio, ep?.art, r.clip?.audio].map((u: string) => (typeof u === "string" && u.includes(`/${BUCKET}/`) ? u.split(`/${BUCKET}/`)[1] : "")).filter(Boolean);
      if (paths.length) void Promise.resolve(db().storage.from(BUCKET).remove(paths)).catch(() => {});
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  app.post(`${P}/posts/:id/like`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a post." });
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req), on = req.body?.on !== false;
      const r = on
        ? await db().from("podcast_post_likes").upsert({ post_id: Number(id), voter }, { onConflict: "post_id,voter", ignoreDuplicates: true })
        : await db().from("podcast_post_likes").delete().eq("post_id", Number(id)).eq("voter", voter);
      check(r.error);
      if (on) { const post = await postRow(Number(id)); if (post) await notify(post.voter, voter, "like", Number(id)); }
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  /** Report a post: hidden for you at once, and for everyone after three people report it. */
  app.post(`${P}/posts/:id/report`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a post." });
    if (limited(writes, req, res)) return;
    try {
      const { error } = await db().from("podcast_post_reports").upsert({ post_id: Number(id), voter: o.voterOf(req) }, { onConflict: "post_id,voter", ignoreDuplicates: true });
      check(error);
      const { count } = await db().from("podcast_post_reports").select("voter", { count: "exact", head: true }).eq("post_id", Number(id));
      await db().from("podcast_posts").update({ reports: count ?? 1, hidden: (count ?? 0) >= 3 }).eq("id", Number(id));
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  // ---------------- comments ----------------
  async function shapeComments(rows: any[], viewer: string): Promise<Comment[]> {
    if (!rows.length) return [];
    const [who, { data: likes, error }] = await Promise.all([
      peopleById(Array.from(new Set(rows.map((r) => r.voter)))),
      db().from("podcast_comment_likes").select("comment_id,voter").in("comment_id", rows.map((r) => Number(r.id))),
    ]);
    check(error);
    return rows.filter((r) => who.has(r.voter) && !who.get(r.voter).hidden).map((r) => {
      const l = (likes || []).filter((x: any) => Number(x.comment_id) === Number(r.id));
      return { id: String(r.id), postId: String(r.post_id), parentId: r.parent_id != null ? String(r.parent_id) : null, body: r.body, at: r.created_at, author: profileOf(who.get(r.voter)), likes: l.length, liked: l.some((x: any) => x.voter === viewer), mine: r.voter === viewer };
    });
  }
  app.get(`${P}/posts/:id/comments`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a post." });
    try {
      if (!(await hasV2())) return res.json({ comments: [], setup: true });
      const { data, error } = await db().from("podcast_comments").select("id,post_id,voter,parent_id,body,created_at").eq("post_id", Number(id)).eq("hidden", false).order("created_at", { ascending: true }).limit(400);
      check(error);
      res.set("Cache-Control", "no-store");
      res.json({ comments: await shapeComments(data || [], o.voterOf(req)) });
    } catch (e) { fail(res, e); }
  });
  app.post(`${P}/posts/:id/comments`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id), body = text(req.body?.body, 500), parent = cleanPodId(req.body?.parent);
    if (!id) return res.status(400).json({ message: "That isn't a post." });
    if (!body) return res.status(400).json({ message: "Write something first." });
    if (limited(talk, req, res)) return;
    try {
      if (await needV2(res)) return;
      const voter = o.voterOf(req);
      const me = await myProfile(voter);
      if (!me) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const post = await postRow(Number(id));
      if (!post) return res.status(404).json({ message: "That post is gone." });
      let parentRow: any = null;
      if (parent) {
        const { data, error } = await db().from("podcast_comments").select("id,post_id,voter,parent_id").eq("id", Number(parent)).maybeSingle();
        check(error);
        if (!data || Number(data.post_id) !== Number(id)) return res.status(404).json({ message: "That comment is gone." });
        parentRow = data;
      }
      const parentId = threadParent(parentRow ? { id: String(parentRow.id), parentId: parentRow.parent_id != null ? String(parentRow.parent_id) : null } : null);
      const { data, error } = await db().from("podcast_comments").insert({ post_id: Number(id), voter, parent_id: parentId ? Number(parentId) : null, body }).select("id,post_id,voter,parent_id,body,created_at").single();
      check(error);
      await notify(post.voter, voter, "comment", Number(id), Number(data.id));
      await notifyMentions(body, voter, Number(id), Number(data.id), [post.voter]);
      if (parentRow && parentRow.voter !== post.voter) await notify(parentRow.voter, voter, "reply", Number(id), Number(data.id));
      res.json({ comment: { id: String(data.id), postId: String(id), parentId, body, at: data.created_at, author: me, likes: 0, liked: false, mine: true } as Comment });
    } catch (e) { fail(res, e); }
  });
  app.delete(`${P}/comments/:id`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a comment." });
    try {
      if (await needV2(res)) return;
      const voter = o.voterOf(req);
      const { data: c, error } = await db().from("podcast_comments").select("id,voter,post_id").eq("id", Number(id)).maybeSingle();
      check(error);
      if (!c) return res.json({ ok: true });
      // Yours, or anyone's on your post.
      const post = c.voter === voter ? null : await postRow(Number(c.post_id));
      if (c.voter !== voter && post?.voter !== voter) return res.status(403).json({ message: "That isn't yours to delete." });
      const { error: e2 } = await db().from("podcast_comments").delete().eq("id", Number(id));
      check(e2);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });
  app.post(`${P}/comments/:id/like`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a comment." });
    if (limited(writes, req, res)) return;
    try {
      if (await needV2(res)) return;
      const voter = o.voterOf(req), on = req.body?.on !== false;
      const r = on
        ? await db().from("podcast_comment_likes").upsert({ comment_id: Number(id), voter }, { onConflict: "comment_id,voter", ignoreDuplicates: true })
        : await db().from("podcast_comment_likes").delete().eq("comment_id", Number(id)).eq("voter", voter);
      check(r.error);
      if (on) {
        const { data: c } = await db().from("podcast_comments").select("voter,post_id").eq("id", Number(id)).maybeSingle();
        if (c) await notify(c.voter, voter, "comment_like", Number(c.post_id), Number(id));
      }
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });
  /** Report a comment: hidden for everyone after three reports. */
  app.post(`${P}/comments/:id/report`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a comment." });
    if (limited(writes, req, res)) return;
    try {
      if (await needV2(res)) return;
      const { data: c, error } = await db().from("podcast_comments").select("reports").eq("id", Number(id)).maybeSingle();
      check(error);
      if (c) await db().from("podcast_comments").update({ reports: (c.reports ?? 0) + 1, hidden: (c.reports ?? 0) + 1 >= 3 }).eq("id", Number(id));
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  // ---------------- notifications ----------------
  app.get(`${P}/notifications`, auth, gate, async (req: any, res) => {
    try {
      if (!(await hasV2())) return res.json({ notes: [], setup: true });
      const voter = o.voterOf(req);
      const { data, error } = await db().from("podcast_notifications").select("id,actor,kind,post_id,comment_id,read,created_at").eq("voter", voter).order("created_at", { ascending: false }).limit(60);
      check(error);
      const rows = data || [];
      const postIds = Array.from(new Set(rows.map((r: any) => r.post_id).filter((x: any) => x != null)));
      const commentIds = Array.from(new Set(rows.map((r: any) => r.comment_id).filter((x: any) => x != null)));
      const [who, posts, comments] = await Promise.all([
        peopleById(Array.from(new Set(rows.map((r: any) => r.actor)))),
        postIds.length ? db().from("podcast_posts").select("id,kind,caption,episode,clip").in("id", postIds) : Promise.resolve({ data: [] }),
        commentIds.length ? db().from("podcast_comments").select("id,body").in("id", commentIds) : Promise.resolve({ data: [] }),
      ]);
      const postOf = new Map<number, any>((posts.data || []).map((p: any) => [Number(p.id), p]));
      const commentOf = new Map<number, string>((comments.data || []).map((c: any) => [Number(c.id), c.body]));
      const notes: Note[] = rows.filter((r: any) => who.has(r.actor) && !who.get(r.actor).hidden).map((r: any) => {
        const p = r.post_id != null ? postOf.get(Number(r.post_id)) : null;
        return {
          id: String(r.id), kind: r.kind, at: r.created_at, read: !!r.read, actor: profileOf(who.get(r.actor)),
          post: p ? { id: String(p.id), kind: p.kind, text: p.clip?.quote || p.caption || p.episode?.title || "", art: p.episode?.art || "" } : null,
          comment: r.comment_id != null ? commentOf.get(Number(r.comment_id)) ?? "" : "",
        };
      });
      res.set("Cache-Control", "no-store");
      res.json({ notes });
    } catch (e) { fail(res, e); }
  });
  app.post(`${P}/notifications/read`, auth, gate, async (req: any, res) => {
    try {
      if (!(await hasV2())) return res.json({ ok: true });
      const { error } = await db().from("podcast_notifications").update({ read: true }).eq("voter", o.voterOf(req)).eq("read", false);
      check(error);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  const notCreator = (req: any, res: any) => {
    if (!o.isCreator || o.isCreator(req)) return false;
    const pics = req.body?.kind === "image" || req.body?.kind === "video";
    res.status(401).json({ message: pics ? "Sign in with your email to post photos and videos." : "Sign in with your email to publish episodes.", needSignIn: true });
    return true;
  };

  /** A link to upload your episode's audio (or cover) straight to storage. */
  app.post(`${P}/upload-url`, auth, gate, async (req: any, res) => {
    if (notCreator(req, res)) return;
    const kind = req.body?.kind === "art" ? "art" : req.body?.kind === "image" ? "image" : req.body?.kind === "video" ? "video" : "audio";
    const type = text(req.body?.type, 60).toLowerCase(), size = Number(req.body?.size) || 0;
    // Photos and videos for posts, stories, messages and profile pictures.
    if (kind === "image" || kind === "video") {
      const ok = kind === "image" ? /^image\/(jpeg|png|webp|gif)$/.test(type) : /^video\/(mp4|webm|quicktime)$/.test(type);
      if (!ok) return res.status(400).json({ message: kind === "image" ? "Photos can be JPG, PNG, WebP or GIF." : "Videos can be MP4, WebM or MOV." });
      if (size <= 0 || size > (kind === "image" ? 15 : 100) * 1024 * 1024) return res.status(400).json({ message: kind === "image" ? "Photos can be up to 15 MB." : "Videos can be up to 100 MB." });
      if (limited(mediaUploads, req, res)) return;
      try {
        const voter = o.voterOf(req);
        if (!(await myProfile(voter))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
        const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } as Record<string, string>)[type];
        const path = `${folderOf(voter)}/m/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
        if (error) { if (/bucket/i.test(String(error.message))) throw new SocialUnavailable(); throw error; }
        return res.json({ url: data.signedUrl, path, publicUrl: db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
      } catch (e) { return fail(res, e); }
    }
    const okType = kind === "art" ? /^image\/(jpeg|png|webp)$/.test(type) : /^audio\/(mpeg|mp3|mp4|x-m4a|m4a|aac|webm|ogg|wav|x-wav)$/.test(type);
    if (!okType) return res.status(400).json({ message: kind === "art" ? "Covers can be JPG, PNG or WebP." : "Audio can be MP3, M4A, AAC, WebM, OGG or WAV." });
    if (size <= 0 || size > (kind === "art" ? 8 : 100) * 1024 * 1024) return res.status(400).json({ message: kind === "art" ? "Covers can be up to 8 MB." : "Episodes can be up to 100 MB." });
    if (limited(uploads, req, res)) return;
    try {
      const voter = o.voterOf(req);
      if (!(await myProfile(voter))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const ext = ({ "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "aac", "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[type];
      const path = `${voter.replace(/[^A-Za-z0-9_-]/g, "")}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) { if (/bucket/i.test(String(error.message))) throw new SocialUnavailable(); throw error; }
      res.json({ url: data.signedUrl, path, publicUrl: db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
    } catch (e) { fail(res, e); }
  });

  /** Publish an episode you made (after uploading its audio). */
  app.post(`${P}/episodes`, auth, gate, async (req: any, res) => {
    const title = text(req.body?.title, 120), about = text(req.body?.about, 1200), path = text(req.body?.path, 200), artPath = text(req.body?.artPath, 200);
    const secs = Math.max(0, Math.min(86_400, Math.floor(Number(req.body?.secs) || 0)));
    const voter = o.voterOf(req);
    const mineOnly = (p: string) => !p || p.startsWith(`${voter.replace(/[^A-Za-z0-9_-]/g, "")}/`);
    if (notCreator(req, res)) return;
    if (!title) return res.status(400).json({ message: "Give your episode a title." });
    if (!path || !mineOnly(path) || !mineOnly(artPath)) return res.status(400).json({ message: "Upload the audio first." });
    if (limited(writes, req, res)) return;
    try {
      const me = await myProfile(voter);
      if (!me) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const audio = db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const art = artPath ? db().storage.from(BUCKET).getPublicUrl(artPath).data.publicUrl : "";
      const { data, error } = await db().from("podcast_posts").insert({ voter, kind: "own", episode_id: "0", episode: {}, caption: text(req.body?.caption, 280) }).select("id").single();
      check(error);
      const id = ownEpisodeId(Number(data.id));
      const episode: PostEpisode = { id, showId: id, show: `${me.name}'s podcast`, title, art, audio, secs, date: new Date().toISOString(), about };
      const { error: e2 } = await db().from("podcast_posts").update({ episode_id: id, episode }).eq("id", data.id);
      check(e2);
      // Followers hear about it (notifications; Open Mic and For You pick it up on their own).
      if (await hasV2()) {
        try {
          const { data: fans } = await db().from("podcast_people_follows").select("follower").eq("followee", voter).limit(5000);
          const rows = (fans || []).filter((f: any) => f.follower !== voter).map((f: any) => ({ voter: f.follower, actor: voter, kind: "episode", post_id: data.id }));
          for (let i = 0; i < rows.length; i += 500) await db().from("podcast_notifications").insert(rows.slice(i, i + 500));
        } catch { /* a missed notification isn't worth failing the publish for */ }
      }
      res.json({ id: String(data.id), episode });
    } catch (e) { fail(res, e); }
  });

  // The rest of the social app: explore and search, profiles, saved posts, polls, blocks, direct
  // messages and stories (server/podcastSocialPlus.ts).
  registerSocialPlus(app, {
    P, auth, gate, db, voterOf: o.voterOf, check, fail, limited, writes, talk, PROFILE_COLS,
    myProfile, peopleById, profileOf, shape, postCols, notify, hasV2, blockSet, publicPrefix, folderOf,
  });
}
