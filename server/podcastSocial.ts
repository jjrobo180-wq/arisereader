// Social for Earshot (LifeHub) and Podscroll, shared by both: profiles, posts (episodes people share,
// their bookmarks, and episodes they made and uploaded themselves), likes, follows and reports.
// Tables and the upload bucket: migrations/podcast_social.sql (service role only). People are the
// same ids as everywhere else in the podcast apps: "u<Arise user id>" or "d<Podscroll device id>".
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { cleanPodId, cleanUrl } from "../shared/earshot";

export class SocialUnavailable extends Error {}
export type Profile = { handle: string; name: string; bio: string; avatar: string };
/** What a post keeps about its episode, so it plays with no lookup. */
export type PostEpisode = { id: string; showId: string; show: string; title: string; art: string; audio: string; secs: number; date: string; about?: string };
export type Post = {
  id: string; kind: "share" | "bookmark" | "own"; caption: string; at: string; episode: PostEpisode;
  author: Profile; likes: number; liked: boolean; mine: boolean;
};

const BUCKET = "podcast-uploads";
const AVATARS = ["🎧", "🎙️", "🦊", "🐼", "🐸", "🦁", "🐙", "🦄", "🐝", "🌵", "🌙", "🔥", "⚡", "🌈", "🍕", "🎸", "🏀", "🚀", "👾", "🧠"];
export const SOCIAL_AVATARS = AVATARS;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max) : "");
export function cleanHandle(v: unknown) { const h = text(v, 30).toLowerCase().replace(/^@/, ""); return /^[a-z0-9_]{3,20}$/.test(h) ? h : ""; }
export function cleanPostEpisode(v: unknown): PostEpisode | null {
  const r = v && typeof v === "object" ? (v as any) : null;
  const id = cleanPodId(r?.id), title = text(r?.title, 300), audio = cleanUrl(r?.audio);
  if (!id || !title || !audio) return null;
  return { id, showId: cleanPodId(r.showId), show: text(r.show, 200), title, art: cleanUrl(r.art), audio, secs: Math.max(0, Math.min(86_400, Math.floor(Number(r.secs) || 0))), date: text(r.date, 40), about: text(r.about, 600) || undefined };
}
/** Episodes people make get ids no podcast directory uses: 77 then the post number. */
export const ownEpisodeId = (postId: number) => `77${String(postId).padStart(12, "0")}`;

export function registerSocialRoutes(app: Express, auth: RequestHandler, o: {
  prefix: string; getDb: () => any; voterOf: (req: any) => string;
  /** Students can't use social (no strangers, no uploads). */
  allowed?: (req: any) => boolean;
}) {
  const P = `${o.prefix}/social`;
  const db = () => o.getDb();
  const writes = createAttemptLimiter({ max: 60, windowMs: 10 * 60_000 });
  const uploads = createAttemptLimiter({ max: 12, windowMs: 60 * 60_000 });
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
  const profileOf = (r: any): Profile => ({ handle: r.handle, name: r.name, bio: r.bio || "", avatar: r.avatar || "🎧" });
  async function myProfile(voter: string) {
    const { data, error } = await db().from("podcast_profiles").select("handle,name,bio,avatar").eq("voter", voter).maybeSingle();
    check(error);
    return data ? profileOf(data) : null;
  }
  /** Posts with their authors, like counts and the viewer's likes. */
  async function shape(rows: any[], viewer: string): Promise<Post[]> {
    if (!rows.length) return [];
    const voters = Array.from(new Set(rows.map((r) => r.voter)));
    const ids = rows.map((r) => r.id);
    const [{ data: people, error: e1 }, { data: likes, error: e2 }] = await Promise.all([
      db().from("podcast_profiles").select("voter,handle,name,bio,avatar,hidden").in("voter", voters),
      db().from("podcast_post_likes").select("post_id,voter").in("post_id", ids),
    ]);
    check(e1); check(e2);
    const who = new Map<string, any>((people || []).map((p: any) => [p.voter, p]));
    return rows.filter((r) => who.has(r.voter) && !who.get(r.voter).hidden).map((r) => {
      const l = (likes || []).filter((x: any) => x.post_id === r.id);
      return { id: String(r.id), kind: r.kind, caption: r.caption || "", at: r.created_at, episode: r.episode, author: profileOf(who.get(r.voter)), likes: l.length, liked: l.some((x: any) => x.voter === viewer), mine: r.voter === viewer };
    });
  }
  const POST_COLS = "id,voter,kind,episode,caption,created_at";

  /** Your profile (null until you make one). */
  app.get(`${P}/me`, auth, gate, async (req: any, res) => {
    try {
      const voter = o.voterOf(req);
      const me = await myProfile(voter);
      if (!me) return res.json({ profile: null, avatars: AVATARS });
      const [{ count: followers }, { count: following }] = await Promise.all([
        db().from("podcast_people_follows").select("follower", { count: "exact", head: true }).eq("followee", voter),
        db().from("podcast_people_follows").select("followee", { count: "exact", head: true }).eq("follower", voter),
      ]);
      res.json({ profile: me, followers: followers ?? 0, following: following ?? 0, avatars: AVATARS });
    } catch (e) { fail(res, e); }
  });

  /** Make or change your profile. */
  app.post(`${P}/me`, auth, gate, async (req: any, res) => {
    const handle = cleanHandle(req.body?.handle), name = text(req.body?.name, 40), bio = text(req.body?.bio, 160);
    const avatar = AVATARS.includes(req.body?.avatar) ? req.body.avatar : "🎧";
    if (!handle) return res.status(400).json({ message: "Pick a username: 3-20 letters, numbers or _." });
    if (!name) return res.status(400).json({ message: "Add your name (or a nickname)." });
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req);
      const { data: taken, error: e1 } = await db().from("podcast_profiles").select("voter").eq("handle", handle).maybeSingle();
      check(e1);
      if (taken && taken.voter !== voter) return res.status(409).json({ message: `@${handle} is taken. Try another.` });
      const { error } = await db().from("podcast_profiles").upsert({ voter, handle, name, bio, avatar, updated_at: new Date().toISOString() }, { onConflict: "voter" });
      check(error);
      res.json({ profile: { handle, name, bio, avatar } });
    } catch (e) { fail(res, e); }
  });

  /** The feed: everyone's posts, or the people you follow. */
  app.get(`${P}/feed`, auth, gate, async (req: any, res) => {
    try {
      const voter = o.voterOf(req);
      let q = db().from("podcast_posts").select(POST_COLS).eq("hidden", false).neq("kind", "bookmark").order("created_at", { ascending: false }).limit(60);
      if (req.query?.tab === "following") {
        const { data: f, error } = await db().from("podcast_people_follows").select("followee").eq("follower", voter).limit(500);
        check(error);
        const ids = (f || []).map((x: any) => x.followee);
        if (!ids.length) return res.json({ posts: [] });
        q = db().from("podcast_posts").select(POST_COLS).eq("hidden", false).in("voter", ids).order("created_at", { ascending: false }).limit(60);
      }
      const { data, error } = await q;
      check(error);
      res.set("Cache-Control", "no-store");
      res.json({ posts: await shape(data || [], voter) });
    } catch (e) { fail(res, e); }
  });

  /** Someone's page: their profile, their podcast, what they shared and bookmarked. */
  app.get(`${P}/u/:handle`, auth, gate, async (req: any, res) => {
    const handle = cleanHandle(req.params.handle);
    if (!handle) return res.status(404).json({ message: "That profile doesn't exist." });
    try {
      const voter = o.voterOf(req);
      const { data: p, error } = await db().from("podcast_profiles").select("voter,handle,name,bio,avatar,hidden").eq("handle", handle).maybeSingle();
      check(error);
      if (!p || p.hidden) return res.status(404).json({ message: "That profile doesn't exist." });
      const [{ data: posts, error: e2 }, { count: followers }, { count: following }, { data: mine }] = await Promise.all([
        db().from("podcast_posts").select(POST_COLS).eq("voter", p.voter).eq("hidden", false).order("created_at", { ascending: false }).limit(120),
        db().from("podcast_people_follows").select("follower", { count: "exact", head: true }).eq("followee", p.voter),
        db().from("podcast_people_follows").select("followee", { count: "exact", head: true }).eq("follower", p.voter),
        db().from("podcast_people_follows").select("followee").eq("follower", voter).eq("followee", p.voter).maybeSingle(),
      ]);
      check(e2);
      res.set("Cache-Control", "no-store");
      res.json({ profile: profileOf(p), me: p.voter === voter, followers: followers ?? 0, following: following ?? 0, followed: !!mine, posts: await shape(posts || [], voter) });
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
      const r = req.body?.on === false
        ? await db().from("podcast_people_follows").delete().eq("follower", voter).eq("followee", p.voter)
        : await db().from("podcast_people_follows").upsert({ follower: voter, followee: p.voter }, { onConflict: "follower,followee" });
      check(r.error);
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  /** Share an episode to your profile (with a caption). */
  app.post(`${P}/posts`, auth, gate, async (req: any, res) => {
    const episode = cleanPostEpisode(req.body?.episode), caption = text(req.body?.caption, 280);
    if (!episode) return res.status(400).json({ message: "That episode can't be shared." });
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req);
      if (!(await myProfile(voter))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const { data, error } = await db().from("podcast_posts").insert({ voter, kind: "share", episode_id: episode.id, episode, caption }).select("id").single();
      check(error);
      res.json({ id: String(data.id) });
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
      const { data, error } = await db().from("podcast_posts").delete().eq("id", Number(id)).eq("voter", o.voterOf(req)).select("id,kind,episode");
      check(error);
      if (!data?.length) return res.status(404).json({ message: "That post is already gone, or isn't yours." });
      // Your own episode's audio goes too.
      const ep = data[0].kind === "own" ? data[0].episode : null;
      const paths = [ep?.audio, ep?.art].map((u: string) => (typeof u === "string" && u.includes(`/${BUCKET}/`) ? u.split(`/${BUCKET}/`)[1] : "")).filter(Boolean);
      if (paths.length) void db().storage.from(BUCKET).remove(paths).catch(() => {});
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  app.post(`${P}/posts/:id/like`, auth, gate, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a post." });
    if (limited(writes, req, res)) return;
    try {
      const voter = o.voterOf(req);
      const r = req.body?.on === false
        ? await db().from("podcast_post_likes").delete().eq("post_id", Number(id)).eq("voter", voter)
        : await db().from("podcast_post_likes").upsert({ post_id: Number(id), voter }, { onConflict: "post_id,voter", ignoreDuplicates: true });
      check(r.error);
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

  /** A link to upload your episode's audio (or cover) straight to storage. */
  app.post(`${P}/upload-url`, auth, gate, async (req: any, res) => {
    const kind = req.body?.kind === "art" ? "art" : "audio";
    const type = text(req.body?.type, 60).toLowerCase(), size = Number(req.body?.size) || 0;
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
      res.json({ id: String(data.id), episode });
    } catch (e) { fail(res, e); }
  });
}
