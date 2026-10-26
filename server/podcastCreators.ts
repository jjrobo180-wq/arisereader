// Creators on Pod+ and Earshot: Open Mic (where episodes people make get found, new and small
// creators first), play counting for those episodes, Studio (a creator's numbers), the Pod+ Rise
// waitlist, and starting or joining a LivePod (server/podcastLive.ts runs the rooms).
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { liveByHost, liveNow, liveTicket, startLive, liveOf } from "./podcastLive";
import {
  LISTEN_SOURCES, MAX_LISTEN_STEP, PLAY_SECS, completed, isNewVoice, micScore, postIdOfEpisode, riseProgress, spreadCreators, trend,
  type ListenSource, type MicTab,
} from "../shared/earshotCreators";

type Profile = { handle: string; name: string; bio: string; avatar: string };
const DAY = 86_400_000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export function registerCreatorRoutes(app: Express, auth: RequestHandler, o: {
  prefix: string; getDb: () => any; voterOf: (req: any) => string; allowed?: (req: any) => boolean;
  isCreator: (req: any) => boolean;
  /** Pod+ signs creators in with email; on Arise everyone is already signed in. */
  signIn: boolean;
}) {
  const P = `${o.prefix}/creators`;
  const db = () => o.getDb();
  const listens = createAttemptLimiter({ max: 400, windowMs: 10 * 60_000 });
  const starts = createAttemptLimiter({ max: 10, windowMs: 60 * 60_000 });
  const gate: RequestHandler = (req: any, res, next) => {
    if (o.allowed && !o.allowed(req)) { res.status(403).json({ message: "This isn't available on student accounts." }); return; }
    next();
  };
  const fail = (res: any, e: any, what: string) => { console.error(`[creators] ${what}:`, e?.message || e); res.status(500).json({ message: "That didn't work. Try again." }); };
  const needCreator = (req: any, res: any) => {
    if (o.isCreator(req)) return false;
    res.status(401).json({ message: "Sign in with your email to do this.", needSignIn: true });
    return true;
  };
  const profileOf = (r: any): Profile => ({ handle: r.handle, name: r.name, bio: r.bio || "", avatar: r.avatar || "🎧" });
  async function myProfile(voter: string): Promise<Profile | null> {
    const { data, error } = await db().from("podcast_profiles").select("handle,name,bio,avatar,hidden").eq("voter", voter).maybeSingle();
    if (error) throw error;
    return data && !data.hidden ? profileOf(data) : null;
  }
  const countBy = (rows: any[], key: string) => { const m = new Map<string, number>(); for (const r of rows) { const k = String(r[key]); m.set(k, (m.get(k) ?? 0) + 1); } return m; };

  /** What this person can do as a creator. */
  app.get(`${P}/me`, auth, gate, async (req: any, res) => {
    try {
      const voter = o.voterOf(req);
      const creator = o.isCreator(req);
      const profile = await myProfile(voter);
      res.set("Cache-Control", "no-store");
      res.json({ creator, signIn: o.signIn, email: req.creator?.email ?? null, profile, live: liveByHost(voter) ? { id: liveByHost(voter)!.id } : null });
    } catch (e) { fail(res, e, "me"); }
  });

  // ---------------- Open Mic ----------------
  type MicItem = { post: string; episode: any; caption: string; at: string; creator: Profile; voter: string; followers: number; episodes: number; newVoice: boolean; plays: number; likes: number; comments: number; score: number };
  const micCache = new Map<MicTab, { at: number; items: MicItem[] }>();
  async function micItems(tab: MicTab): Promise<MicItem[]> {
    const hit = micCache.get(tab);
    if (hit && Date.now() - hit.at < 60_000) return hit.items;
    const since = new Date(Date.now() - (tab === "rising" ? 14 : 60) * DAY).toISOString();
    const { data: rows, error } = await db().from("podcast_posts").select("id,voter,episode,caption,created_at").eq("kind", "own").eq("hidden", false).gte("created_at", since).order("created_at", { ascending: false }).limit(400);
    if (error) throw error;
    const posts = (rows || []).filter((r: any) => r.episode?.audio);
    if (!posts.length) { micCache.set(tab, { at: Date.now(), items: [] }); return []; }
    const voters = Array.from(new Set(posts.map((r: any) => r.voter as string)));
    const ids = posts.map((r: any) => Number(r.id));
    const recent = dayKey(Date.now() - 2 * DAY);
    const [who, fans, all, likes, comments, reposts, plays] = await Promise.all([
      db().from("podcast_profiles").select("voter,handle,name,bio,avatar,hidden").in("voter", voters),
      db().from("podcast_people_follows").select("followee").in("followee", voters).limit(50_000),
      db().from("podcast_posts").select("voter").eq("kind", "own").eq("hidden", false).in("voter", voters).limit(20_000),
      db().from("podcast_post_likes").select("post_id").in("post_id", ids).limit(50_000),
      db().from("podcast_comments").select("post_id").in("post_id", ids).eq("hidden", false).limit(50_000),
      db().from("podcast_posts").select("repost_of").in("repost_of", ids).eq("hidden", false).limit(50_000),
      db().from("podcast_listens").select("post_id,day").in("post_id", ids).gte("secs", PLAY_SECS).limit(100_000),
    ]);
    for (const r of [who, fans, all, likes, plays]) if (r.error) throw r.error;
    const people = new Map<string, any>((who.data || []).map((p: any) => [p.voter, p]));
    const followers = countBy(fans.data || [], "followee"), episodes = countBy(all.data || [], "voter");
    const likeN = countBy(likes.data || [], "post_id"), commentN = countBy(comments.error ? [] : comments.data || [], "post_id"), repostN = countBy(reposts.error ? [] : reposts.data || [], "repost_of");
    const playN = countBy(plays.data || [], "post_id"), recentN = countBy((plays.data || []).filter((p: any) => p.day >= recent), "post_id");
    const items: MicItem[] = posts.filter((r: any) => people.has(r.voter) && !people.get(r.voter).hidden).map((r: any) => {
      const k = String(r.id), f = followers.get(r.voter) ?? 0, eps = episodes.get(r.voter) ?? 1;
      const stats = { plays: playN.get(k) ?? 0, likes: likeN.get(k) ?? 0, comments: commentN.get(k) ?? 0, reposts: repostN.get(k) ?? 0, followers: f, episodes: eps, ageHours: (Date.now() - Date.parse(r.created_at)) / 3600_000, playsRecent: recentN.get(k) ?? 0 };
      return {
        post: k, episode: r.episode, caption: r.caption || "", at: r.created_at, creator: profileOf(people.get(r.voter)), voter: r.voter,
        followers: f, episodes: eps, newVoice: isNewVoice(stats), plays: stats.plays, likes: stats.likes, comments: stats.comments, score: micScore(tab, stats),
      };
    });
    const out = spreadCreators(items, (x) => x.voter, 2);
    micCache.set(tab, { at: Date.now(), items: out });
    return out;
  }

  /** Open Mic: episodes people made (fresh, rising, or from creators you follow) and who's live. */
  app.get(`${P}/openmic`, auth, gate, async (req: any, res) => {
    const tab: MicTab = req.query?.tab === "rising" ? "rising" : req.query?.tab === "following" ? "following" : "fresh";
    try {
      const voter = o.voterOf(req);
      const { data: mine } = await db().from("podcast_people_follows").select("followee").eq("follower", voter).limit(2000);
      const follows = new Set<string>((mine || []).map((x: any) => x.followee));
      let list = await micItems(tab === "following" ? "fresh" : tab);
      if (tab === "following") list = list.filter((x) => follows.has(x.voter)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      res.set("Cache-Control", "no-store");
      res.json({
        episodes: list.slice(0, 60).map(({ voter: v, score: _s, ...x }) => ({ ...x, followed: follows.has(v), mine: v === voter })),
        live: liveNow(),
      });
    } catch (e) { fail(res, e, "openmic"); }
  });

  // ---------------- Plays ----------------
  const owners = new Map<number, { voter: string; secs: number } | null>();
  async function ownerOf(postId: number) {
    if (owners.has(postId)) return owners.get(postId)!;
    const { data } = await db().from("podcast_posts").select("voter,kind,episode").eq("id", postId).maybeSingle();
    const v = data && data.kind === "own" ? { voter: data.voter as string, secs: Number(data.episode?.secs) || 0 } : null;
    if (owners.size > 20_000) owners.clear();
    owners.set(postId, v);
    return v;
  }
  /** Listening to an episode someone made, reported a little at a time while it plays. */
  app.post(`${P}/listen`, auth, gate, async (req: any, res) => {
    const postId = postIdOfEpisode(String(req.body?.episode || ""));
    const step = Math.max(0, Math.min(MAX_LISTEN_STEP, Math.floor(Number(req.body?.secs) || 0)));
    const source: ListenSource = LISTEN_SOURCES.includes(req.body?.source) ? req.body.source : "other";
    if (!postId || !step) return res.status(204).end();
    const voter = o.voterOf(req);
    if (listens.retryAfter(voter) > 0) return res.status(204).end();
    listens.fail(voter);
    try {
      const owner = await ownerOf(postId);
      if (!owner || owner.voter === voter) return res.status(204).end(); // creators' own listens don't count
      const day = dayKey(Date.now());
      const { data: row } = await db().from("podcast_listens").select("secs").eq("post_id", postId).eq("voter", voter).eq("day", day).maybeSingle();
      const cap = owner.secs > 0 ? Math.ceil(owner.secs * 1.5) : 6 * 3600;
      const secs = Math.min(cap, (row?.secs ?? 0) + step);
      const { error } = await db().from("podcast_listens").upsert({ post_id: postId, voter, day, secs, ...(row ? {} : { source }), updated_at: new Date().toISOString() }, { onConflict: "post_id,voter,day" });
      if (error) throw error;
      res.status(204).end();
    } catch (e) { fail(res, e, "listen"); }
  });

  // ---------------- Studio ----------------
  app.get(`${P}/studio`, auth, gate, async (req: any, res) => {
    if (needCreator(req, res)) return;
    try {
      const voter = o.voterOf(req);
      const profile = await myProfile(voter);
      if (!profile) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const now = Date.now(), from28 = dayKey(now - 27 * DAY), from56 = dayKey(now - 55 * DAY), from30 = dayKey(now - 29 * DAY);
      const { data: posts, error } = await db().from("podcast_posts").select("id,episode,created_at").eq("voter", voter).eq("kind", "own").eq("hidden", false).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      const ids = (posts || []).map((p: any) => Number(p.id));
      const none = Promise.resolve({ data: [], error: null });
      const [ls, likes, comments, reposts, fans, lives, wait] = await Promise.all([
        ids.length ? db().from("podcast_listens").select("post_id,voter,day,secs,source").in("post_id", ids).gte("day", from56).limit(100_000) : none,
        ids.length ? db().from("podcast_post_likes").select("post_id").in("post_id", ids).limit(100_000) : none,
        ids.length ? db().from("podcast_comments").select("post_id").in("post_id", ids).eq("hidden", false).limit(100_000) : none,
        ids.length ? db().from("podcast_posts").select("repost_of").in("repost_of", ids).eq("hidden", false).limit(100_000) : none,
        db().from("podcast_people_follows").select("created_at").eq("followee", voter).limit(100_000),
        db().from("podcast_live_sessions").select("title,started_at,ended_at,peak,listeners,comments,cheers,cheer_points,likes,shares").eq("voter", voter).order("started_at", { ascending: false }).limit(20),
        db().from("podcast_rise_waitlist").select("voter").eq("voter", voter).maybeSingle(),
      ]);
      for (const r of [ls, likes, fans, lives]) if (r.error) throw r.error;
      const rows = (ls.data || []) as { post_id: number; voter: string; day: string; secs: number; source: ListenSource }[];
      const plays = rows.filter((r) => r.secs >= PLAY_SECS);
      const in28 = plays.filter((r) => r.day >= from28), prev = plays.filter((r) => r.day < from28);
      const mins = (list: typeof rows) => Math.round(list.reduce((a, r) => a + r.secs, 0) / 60);
      const lenOf = new Map<number, number>((posts || []).map((p: any) => [Number(p.id), Number(p.episode?.secs) || 0]));
      const followerDays = (fans.data || []).map((f: any) => dayKey(Date.parse(f.created_at)));
      const daily = Array.from({ length: 28 }, (_, i) => {
        const d = dayKey(now - (27 - i) * DAY);
        const today = plays.filter((r) => r.day === d);
        return { day: d, plays: today.length, minutes: mins(rows.filter((r) => r.day === d)), followers: followerDays.filter((x) => x === d).length };
      });
      const sources: Record<string, number> = {}; for (const r of in28) sources[r.source] = (sources[r.source] ?? 0) + 1;
      const likeN = countBy(likes.data || [], "post_id"), commentN = countBy(comments.error ? [] : comments.data || [], "post_id"), repostN = countBy(reposts.error ? [] : reposts.data || [], "repost_of");
      const episodes = (posts || []).map((p: any) => {
        const k = Number(p.id), mine = plays.filter((r) => r.post_id === k), len = lenOf.get(k) ?? 0;
        return {
          post: String(k), title: p.episode?.title || "", art: p.episode?.art || "", at: p.created_at, secs: len,
          plays: mine.length, listeners: new Set(mine.map((r) => r.voter)).size, minutes: mins(rows.filter((r) => r.post_id === k)),
          completion: mine.length ? Math.round((mine.filter((r) => completed(r.secs, len)).length / mine.length) * 100) : 0,
          likes: likeN.get(String(k)) ?? 0, comments: commentN.get(String(k)) ?? 0, reposts: repostN.get(String(k)) ?? 0,
        };
      });
      const followersNew = followerDays.filter((d) => d >= from28).length, followersPrev = followerDays.filter((d) => d < from28 && d >= from56).length;
      const firstAt = posts?.length ? Date.parse(posts[posts.length - 1].created_at) : now;
      const allLikes = (likes.data || []).length;
      const completedPlays = in28.filter((r) => completed(r.secs, lenOf.get(r.post_id) ?? 0)).length;
      res.set("Cache-Control", "no-store");
      res.json({
        profile,
        totals: {
          plays: in28.length, playsTrend: trend(in28.length, prev.length),
          listeners: new Set(in28.map((r) => r.voter)).size,
          minutes: mins(rows.filter((r) => r.day >= from28)), minutesTrend: trend(mins(rows.filter((r) => r.day >= from28)), mins(rows.filter((r) => r.day < from28))),
          followers: (fans.data || []).length, followersNew, followersTrend: trend(followersNew, followersPrev),
          likes: allLikes, completion: in28.length ? Math.round((completedPlays / in28.length) * 100) : 0, episodes: episodes.length,
        },
        daily, sources, episodes,
        live: (lives.data || []).map((l: any) => ({ title: l.title, at: l.started_at, minutes: Math.round((Date.parse(l.ended_at) - Date.parse(l.started_at)) / 60000), peak: l.peak, listeners: l.listeners, comments: l.comments, cheers: l.cheers, cheerPoints: l.cheer_points, likes: l.likes, shares: l.shares })),
        rise: {
          ...riseProgress({ episodes: episodes.length, followers: (fans.data || []).length, plays30: plays.filter((r) => r.day >= from30).length, daysSinceFirst: posts?.length ? (now - firstAt) / DAY : 0, livePods: (lives.data || []).length }),
          joined: !!(wait as any).data,
        },
      });
    } catch (e) { fail(res, e, "studio"); }
  });

  /** Joins the Pod+ Rise waitlist: first in line when supporter memberships and payouts open. */
  app.post(`${P}/rise`, auth, gate, async (req: any, res) => {
    if (needCreator(req, res)) return;
    try {
      const voter = o.voterOf(req);
      if (!(await myProfile(voter))) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      const { error } = await db().from("podcast_rise_waitlist").upsert({ voter }, { onConflict: "voter" });
      if (error) throw error;
      res.json({ joined: true });
    } catch (e) { fail(res, e, "rise"); }
  });

  // ---------------- LivePod ----------------
  app.get(`${P}/live`, auth, gate, (_req, res) => { res.set("Cache-Control", "no-store"); res.json({ live: liveNow() }); });

  /** Go live. Returns the LivePod and a pass to open it as its host. */
  app.post(`${P}/live`, auth, gate, async (req: any, res) => {
    if (needCreator(req, res)) return;
    const voter = o.voterOf(req);
    const wait = starts.retryAfter(voter);
    if (wait > 0) return res.status(429).json({ message: `You've started a lot of LivePods. Try again in ${waitWords(wait)}.` });
    try {
      const profile = await myProfile(voter);
      if (!profile) return res.status(400).json({ message: "Make your profile first.", needProfile: true });
      starts.fail(voter);
      const room = startLive({ voter, profile }, String(req.body?.title ?? ""), String(req.body?.topic ?? ""));
      res.json({ room: room.id, ticket: liveTicket({ voter, profile }, room.id, "host") });
    } catch (e) { fail(res, e, "live start"); }
  });

  /** A pass to join a LivePod (as its host again, or to listen). Listening needs no profile; chatting does. */
  app.post(`${P}/live/:id/ticket`, auth, gate, async (req: any, res) => {
    const roomId = String(req.params.id || "").slice(0, 20);
    try {
      const voter = o.voterOf(req);
      const room = liveOf(roomId);
      if (!room) return res.status(404).json({ message: "This LivePod has ended." });
      const profile = await myProfile(voter);
      const host = liveByHost(voter)?.id === roomId;
      const ticket = liveTicket({ voter, profile }, roomId, host ? "host" : "listener");
      if (!ticket) return res.status(404).json({ message: "This LivePod has ended." });
      res.json({ ticket, room, host });
    } catch (e) { fail(res, e, "live ticket"); }
  });
}
