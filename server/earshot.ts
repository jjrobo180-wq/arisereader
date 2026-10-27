// Earshot (LifeHub App Store podcast app): the server side.
//
// - Apple's podcast directory (the iTunes Search API) is asked for shows by genre, search results and
//   a show's episodes. Apple allows roughly 20 requests a minute from one address, and every Arise user
//   shares this server's address, so answers are cached and outgoing requests are paced (APPLE_PACE).
// - Likes, comments and share counts are shared between everyone (migrations/earshot.sql). Student
//   accounts only get clean podcasts and don't see or post comments (shared/earshot.ts canComment).
// Nothing about what someone listens to is stored here; that lives in their own LifeHub data.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import {
  GENRE, EARSHOT_LIMITS, appleSearchUrl, canComment, cleanComment, cleanPodId, commentAuthor, parseEpisode, parseShow, poolFromEpisodeSearch,
  type PodEpisode, type PodShow, type PoolShow, type TranscriptChunk,
} from "../shared/earshot";
import { createDirectory, type Directory, type Fetcher } from "./podcastDirectory";
import { TOPICS, genreSearchTerms, topicPlaylist } from "../shared/earshotTopics";
import { crowdFor, memoryAdStore, registerAdRoutes, type AdStore } from "./podcastAds";
import { copyTranscript, registerPlayRoutes, startOpenings, type Player } from "./podcastPlay";
import { registerSocialRoutes } from "./podcastSocial";
import { registerCreatorRoutes } from "./podcastCreators";
import { topShowsService } from "./podcastTop";
import { accountSessions, registerPodscrollAccountRoutes, SESSION } from "./podcastAccounts";

export type EarshotComment = { id: string; episodeId: string; author: string; body: string; at: string; mine: boolean };
export type EpisodeCounts = { likes: number; comments: number; shares: number; liked: boolean };

export interface EarshotStore {
  counts(episodeIds: string[], userId: string): Promise<Record<string, EpisodeCounts>>;
  setLike(userId: string, episodeId: string, on: boolean): Promise<void>;
  addShare(episodeId: string): Promise<void>;
  comments(episodeId: string, userId: string): Promise<EarshotComment[]>;
  addComment(c: { episodeId: string; showId: string; userId: string; author: string; body: string }): Promise<EarshotComment>;
  deleteComment(id: string, userId: string, admin: boolean): Promise<boolean>;
  reportComment(id: string, userId: string): Promise<void>;
}
export class EarshotUnavailable extends Error {}

/** Kept in memory: for tests, and so the app still works (unshared) before the tables exist. */
export function memoryEarshotStore(): EarshotStore {
  const likes = new Set<string>(); const shares = new Map<string, number>();
  const comments: (EarshotComment & { userId: string; hidden: boolean; reports: Set<string> })[] = [];
  let next = 1;
  return {
    async counts(ids, userId) {
      const out: Record<string, EpisodeCounts> = {};
      for (const id of ids) out[id] = {
        likes: Array.from(likes).filter((k) => k.endsWith(`:${id}`)).length,
        comments: comments.filter((c) => c.episodeId === id && !c.hidden).length,
        shares: shares.get(id) ?? 0, liked: likes.has(`${userId}:${id}`),
      };
      return out;
    },
    async setLike(userId, id, on) { const k = `${userId}:${id}`; if (on) likes.add(k); else likes.delete(k); },
    async addShare(id) { shares.set(id, (shares.get(id) ?? 0) + 1); },
    async comments(id, userId) { return comments.filter((c) => c.episodeId === id && !c.hidden).slice().reverse().slice(0, 100).map(({ userId: u, hidden, reports, ...c }) => ({ ...c, mine: u === userId })); },
    async addComment(c) { const row = { id: String(next++), episodeId: c.episodeId, author: c.author, body: c.body, at: new Date().toISOString(), mine: true, userId: c.userId, hidden: false, reports: new Set<string>() }; comments.push(row); const { userId, hidden, reports, ...shown } = row; return shown; },
    async deleteComment(id, userId, admin) { const i = comments.findIndex((c) => c.id === id && (admin || c.userId === userId)); if (i < 0) return false; comments.splice(i, 1); return true; },
    async reportComment(id, userId) { const c = comments.find((x) => x.id === id); if (!c) return; c.reports.add(userId); if (c.reports.size >= 3) c.hidden = true; },
  };
}

/** Supabase-backed store. "earshot" tables (migrations/earshot.sql) key people by their Arise user id;
 *  "podscroll" tables (migrations/podscroll.sql) key them by an anonymous device id from the
 *  separate Podscroll website, which has no accounts. */
export function supabaseEarshotStore(getDb: () => any, kind: "earshot" | "podscroll" = "earshot"): EarshotStore {
  const T = { likes: `${kind}_likes`, comments: `${kind}_comments`, counts: `${kind}_counts`, share: `${kind}_add_share`, report: `${kind}_report_comment` };
  const missing = (e: any) => e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" || (/(earshot|podscroll)_/.test(String(e.message || "")) && /not find|does not exist/i.test(String(e.message || ""))));
  const check = (error: any) => { if (error) { if (missing(error)) throw new EarshotUnavailable("earshot tables missing"); throw error; } };
  const uid = (id: string): string | number => (kind === "earshot" ? Number(id) : id);
  return {
    async counts(ids, userId) {
      const out: Record<string, EpisodeCounts> = {};
      if (!ids.length) return out;
      const db = getDb();
      const [{ data, error }, mine] = await Promise.all([
        db.rpc(T.counts, { p_episodes: ids }),
        db.from(T.likes).select("episode_id").eq("user_id", uid(userId)).in("episode_id", ids),
      ]);
      check(error); check(mine.error);
      const liked = new Set((mine.data || []).map((r: any) => String(r.episode_id)));
      for (const id of ids) out[id] = { likes: 0, comments: 0, shares: 0, liked: liked.has(id) };
      for (const r of data || []) { const id = String(r.episode_id); if (out[id]) Object.assign(out[id], { likes: Number(r.likes) || 0, comments: Number(r.comments) || 0, shares: Number(r.shares) || 0 }); }
      return out;
    },
    async setLike(userId, id, on) {
      const db = getDb();
      const { error } = on
        ? await db.from(T.likes).upsert({ user_id: uid(userId), episode_id: id }, { onConflict: "user_id,episode_id", ignoreDuplicates: true })
        : await db.from(T.likes).delete().eq("user_id", uid(userId)).eq("episode_id", id);
      check(error);
    },
    async addShare(id) { const { error } = await getDb().rpc(T.share, { p_episode: id }); check(error); },
    async comments(id, userId) {
      const { data, error } = await getDb().from(T.comments).select("id,episode_id,user_id,author,body,created_at").eq("episode_id", id).eq("hidden", false).order("created_at", { ascending: false }).limit(100);
      check(error);
      return (data || []).map((r: any) => ({ id: String(r.id), episodeId: String(r.episode_id), author: String(r.author), body: String(r.body), at: String(r.created_at), mine: String(r.user_id) === userId }));
    },
    async addComment(c) {
      const { data, error } = await getDb().from(T.comments).insert({ episode_id: c.episodeId, show_id: c.showId, user_id: uid(c.userId), author: c.author, body: c.body }).select("id,created_at").single();
      check(error);
      return { id: String(data.id), episodeId: c.episodeId, author: c.author, body: c.body, at: String(data.created_at), mine: true };
    },
    async deleteComment(id, userId, admin) {
      let q = getDb().from(T.comments).delete().eq("id", Number(id));
      if (!admin) q = q.eq("user_id", uid(userId));
      const { data, error } = await q.select("id");
      check(error);
      return !!(data && data.length);
    },
    async reportComment(id, userId) { const { error } = await getDb().rpc(T.report, { p_comment: Number(id), p_user: uid(userId) }); check(error); },
  };
}

// ---------------------------------------------------------------------------
// Routes (the podcast directory itself is server/podcastDirectory.ts)
// ---------------------------------------------------------------------------

export { pacedFetcher, APPLE_PACE, type Fetcher } from "./podcastDirectory";

let sharedDirectory: Directory | null = null;
export interface EarshotOptions {
  store: EarshotStore;
  /** The shared podcast directory (one for both apps, so Apple's limit and the caches are shared). */
  directory?: Directory;
  /** Tests: a fake Apple. */
  fetcher?: Fetcher;
  /** Where the routes live. LifeHub uses /api/earshot; the Podscroll website uses /api/podscroll. */
  prefix?: string;
  /** Listeners' ad marks, votes and skips (shared by both apps). Kept in memory when not given. */
  adStore?: AdStore;
  /** Playback through this server, so stitched-in ads are found in each listener's own copy (server/podcastPlay.ts). */
  player?: Player;
  /** The database for social (profiles, posts, uploads; server/podcastSocial.ts). */
  socialDb?: () => any;
}
let sharedAdStore: AdStore | null = null;
const openingsStarted = new WeakSet<object>();

export function registerEarshotRoutes(app: Express, authMiddleware: RequestHandler, options: EarshotOptions) {
  const store = options.store;
  const P = options.prefix ?? "/api/earshot";
  const dir = options.directory ?? (options.fetcher ? createDirectory({ fetcher: options.fetcher }) : (sharedDirectory ??= createDirectory()));
  const reads = createAttemptLimiter({ max: 300, windowMs: 10 * 60_000 });
  const writes = createAttemptLimiter({ max: 120, windowMs: 10 * 60_000 });
  const posts = createAttemptLimiter({ max: 15, windowMs: 10 * 60_000 });
  const reading = createAttemptLimiter({ max: 60, windowMs: 10 * 60_000 });

  const uid = (req: any) => String(req.user?.id ?? "");
  const isStudent = (req: any) => req.user?.role === "student";
  const isAdmin = (req: any) => !!(req.user?.isAdmin || req.user?.is_admin || req.user?.role === "admin");
  /** Explicit podcasts only for adults who switched them on. */
  const explicitFor = (req: any) => !isStudent(req) && req.query?.explicit === "1";
  const limited = (lim: ReturnType<typeof createAttemptLimiter>, req: any, res: any, what = "requests") => {
    const k = `u${uid(req)}`; const wait = lim.retryAfter(k);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `Too many ${what}. Try again in ${waitWords(wait)}.` }); return true; }
    lim.fail(k); return false;
  };
  const appleDown = (res: any, e: any) => {
    if (e?.message !== "busy") console.error("[earshot] Apple directory:", e?.message);
    res.status(503).json({ message: e?.message === "busy" ? "Lots of people are browsing right now. Try again in a few seconds." : "Apple Podcasts can't be reached right now. Try again in a minute." });
  };
  const storeDown = (res: any, e: any) => {
    if (e instanceof EarshotUnavailable) return res.status(503).json({ message: "Likes and comments aren't set up yet.", storage: "unavailable" });
    console.error("[earshot] store:", e?.message || e);
    res.status(500).json({ message: "That didn't save. Try again." });
  };
  const clean = <T extends { explicit: boolean }>(list: T[], explicit: boolean) => (explicit ? list : list.filter((x) => !x.explicit));
  const genreOk = (req: any, gid: string) => !!GENRE[gid] && (!isStudent(req) || !!GENRE[gid].kidSafe);

  /** Several genres at once, each with episodes attached: the feed starts and swipes without waiting. */
  app.get(`${P}/feed`, authMiddleware, async (req: any, res) => {
    const ids = Array.from(new Set(String(req.query?.genres || "").split(",").map((x) => x.trim()))).filter((g) => genreOk(req, g)).slice(0, 12);
    if (!ids.length) return res.json({ pools: {} });
    if (limited(reads, req, res)) return;
    const explicit = explicitFor(req);
    const pools: Record<string, PoolShow[]> = {};
    let failed: any = null;
    await Promise.all(ids.map(async (g) => { try { pools[g] = await dir.pool(g, explicit); } catch (e) { failed = e; pools[g] = []; } }));
    if (failed && Object.values(pools).every((p) => !p.length)) return appleDown(res, failed);
    res.set("Cache-Control", "private, max-age=600");
    res.json({ pools });
  });

  /** More shows for a genre once the feed has used up its first pool: page n searches the genre's
   *  nth term (its sub-genres and topics), so the feed keeps finding new shows. Each page is kept an hour. */
  app.get(`${P}/more`, authMiddleware, async (req: any, res) => {
    const gid = String(req.query?.genre || "");
    if (!GENRE[gid]) return res.status(404).json({ message: "That genre doesn't exist." });
    if (!genreOk(req, gid)) return res.json({ pool: [], next: null });
    const terms = genreSearchTerms(GENRE[gid]);
    const page = Math.max(0, Math.floor(Number(req.query?.page) || 0));
    if (page >= terms.length) return res.json({ pool: [], next: null });
    if (limited(reads, req, res)) return;
    const explicit = explicitFor(req);
    try {
      const out = await dir.searches.get(`more:${gid}:${terms[page]}`, async () => {
        const b = await dir.apple(appleSearchUrl(terms[page], "podcastEpisode", 120, true));
        return { shows: [], episodes: [], pool: poolFromEpisodeSearch(gid, Array.isArray(b?.results) ? b.results : [], true) } as any;
      });
      const pool = ((out as any).pool as PoolShow[] ?? [])
        .filter((p) => explicit || !p.show.explicit)
        .map((p) => ({ ...p, episodes: p.episodes.filter((e) => explicit || !e.explicit) }))
        .filter((p) => p.episodes.length);
      res.set("Cache-Control", "private, max-age=1800");
      res.json({ pool, next: page + 1 < terms.length ? page + 1 : null, term: terms[page] });
    } catch (e) { appleDown(res, e); }
  });

  /** Shows for one genre, Apple's most relevant first. */
  app.get(`${P}/genre/:id`, authMiddleware, async (req: any, res) => {
    const gid = String(req.params.id);
    if (!GENRE[gid]) return res.status(404).json({ message: "That genre doesn't exist." });
    if (!genreOk(req, gid)) return res.json({ shows: [] });
    if (limited(reads, req, res)) return;
    try { res.set("Cache-Control", "private, max-age=1800"); res.json({ shows: clean(await dir.loadGenreShows(gid), explicitFor(req)) }); }
    catch (e) { appleDown(res, e); }
  });

  /** A show and its newest episodes. */
  app.get(`${P}/show/:id`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a podcast." });
    if (limited(reads, req, res)) return;
    try {
      const out = await dir.loadShow(id);
      const explicit = explicitFor(req);
      if (out.show?.explicit && !explicit) return res.json({ show: out.show, episodes: [], blocked: true });
      res.set("Cache-Control", "private, max-age=900");
      res.json({ show: out.show, episodes: clean(out.episodes, explicit) });
    } catch (e) { appleDown(res, e); }
  });

  /** Top shows (the round row on Pod+): Apple's charts for All and each genre; for a topic, the
   *  biggest charting/established shows whose episodes cover it (server/podcastTop.ts). */
  const top = topShowsService((url) => dir.apple(url), (term, entity, limit) => appleSearchUrl(term, entity, limit, false));
  app.get(`${P}/top`, authMiddleware, async (req: any, res) => {
    const q = typeof req.query?.q === "string" ? req.query.q.replace(/\s+/g, " ").trim().slice(0, EARSHOT_LIMITS.search) : "";
    const gid = typeof req.query?.genre === "string" ? req.query.genre : "";
    if (gid && !GENRE[gid]) return res.status(404).json({ message: "That genre doesn't exist." });
    if (gid && !genreOk(req, gid)) return res.json({ shows: [] });
    if (q && q.length < 2) return res.json({ shows: [] });
    if (limited(reads, req, res)) return;
    try {
      const shows = q ? await top.topic(q) : await top.genre(gid || undefined);
      res.set("Cache-Control", "private, max-age=1800");
      res.json({ shows: isStudent(req) ? shows.filter((s) => GENRE[s.genre]?.kidSafe) : shows });
    } catch (e) { appleDown(res, e); }
  });

  /** Search shows and episodes by any words. */
  app.get(`${P}/search`, authMiddleware, async (req: any, res) => {
    const q = typeof req.query?.q === "string" ? req.query.q.replace(/\s+/g, " ").trim().slice(0, EARSHOT_LIMITS.search) : "";
    if (q.length < 2) return res.json({ shows: [], episodes: [] });
    if (limited(reads, req, res, "searches")) return;
    const explicit = explicitFor(req);
    try {
      const out = await dir.searches.get(q.toLowerCase(), async () => {
        const shows = await dir.apple(appleSearchUrl(q, "podcast", 25, true));
        let episodes: any = { results: [] };
        try { episodes = await dir.apple(appleSearchUrl(q, "podcastEpisode", 20, true)); } catch { /* shows alone are fine */ }
        return {
          shows: (Array.isArray(shows?.results) ? shows.results : []).map((r: unknown) => parseShow(r)).filter(Boolean) as PodShow[],
          episodes: (Array.isArray(episodes?.results) ? episodes.results : []).map((r: unknown) => parseEpisode(r)).filter(Boolean) as PodEpisode[],
        };
      });
      const kidOk = (genre: string) => !isStudent(req) || !!GENRE[genre]?.kidSafe;
      res.set("Cache-Control", "private, max-age=900");
      res.json({ shows: clean(out.shows, explicit).filter((s) => kidOk(s.genre)), episodes: clean(out.episodes, explicit) });
    } catch (e) { appleDown(res, e); }
  });

  /** Browse by subject: one topic (History → World War II) as a ready-made playlist of real episodes,
   *  plus the shows that cover it most. Kept for an hour, so Apple is asked at most once an hour per topic. */
  app.get(`${P}/topic/:id`, authMiddleware, async (req: any, res) => {
    const topic = TOPICS[String(req.params.id || "")];
    if (!topic) return res.status(404).json({ message: "That topic doesn't exist." });
    if (isStudent(req) && !topic.subject.kidSafe) return res.json({ topic: { id: topic.id, name: topic.name, subject: topic.subject.name }, episodes: [], shows: [] });
    if (limited(reads, req, res)) return;
    const explicit = explicitFor(req);
    try {
      const out = await dir.searches.get(`topic:${topic.id}:v1`, async () => {
        const toEpisodes = (b: any) => (Array.isArray(b?.results) ? b.results : []).map((r: unknown) => parseEpisode(r)).filter(Boolean) as PodEpisode[];
        const batches: PodEpisode[][] = [toEpisodes(await dir.apple(appleSearchUrl(topic.terms[0], "podcastEpisode", 100, true)))];
        let shows: PodShow[] = [];
        try { const b = await dir.apple(appleSearchUrl(topic.terms[0], "podcast", 20, true)); shows = (Array.isArray(b?.results) ? b.results : []).map((r: unknown) => parseShow(r)).filter(Boolean) as PodShow[]; } catch { /* episodes alone are fine */ }
        // a thin playlist is topped up from the next search term
        for (const term of topic.terms.slice(1, 3)) {
          if (topicPlaylist(batches, 40).length >= 25) break;
          try { batches.push(toEpisodes(await dir.apple(appleSearchUrl(term, "podcastEpisode", 60, true)))); } catch { break; }
        }
        return { shows, episodes: topicPlaylist(batches, 60) };
      });
      const kidOk = (genre: string) => !isStudent(req) || !!GENRE[genre]?.kidSafe;
      res.set("Cache-Control", "private, max-age=1800");
      res.json({
        topic: { id: topic.id, name: topic.name, subject: topic.subject.name },
        episodes: clean(out.episodes, explicit).slice(0, 40),
        shows: clean(out.shows, explicit).filter((s) => kidOk(s.genre)).slice(0, 12),
      });
    } catch (e) { appleDown(res, e); }
  });

  /** "Find me a podcast": describe what you want, AI picks real shows. */
  const finding = createAttemptLimiter({ max: 20, windowMs: 10 * 60_000 });
  app.post(`${P}/ai-find`, authMiddleware, async (req: any, res) => {
    const q = typeof req.body?.q === "string" ? req.body.q.replace(/\s+/g, " ").trim().slice(0, 400) : "";
    if (q.length < 3) return res.status(400).json({ message: "Tell me a bit more about what you'd like to hear." });
    if (limited(finding, req, res, "AI searches")) return;
    // aiFind answers with a plain search when no AI can, so this only fails if Apple is down too.
    try { res.set("Cache-Control", "no-store"); res.json(await dir.aiFind(q, { explicit: explicitFor(req), kidOnly: isStudent(req) })); }
    catch (e: any) { console.error("[earshot] ai-find:", e?.message); res.status(502).json({ message: "Couldn't search podcasts right now. Try again in a moment." }); }
  });

  /** Read along: one piece of an episode's transcript, with its ads and chapters. */
  app.get(`${P}/transcript/:episodeId`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.episodeId), show = cleanPodId(req.query?.show);
    const chunk = Math.max(0, Math.min(40, Math.floor(Number(req.query?.chunk) || 0)));
    if (!id || !show) return res.status(400).json({ message: "That isn't an episode." });
    if (limited(reading, req, res, "transcript requests")) return;
    try {
      // Playing through the server: made from (and placed in) this listener's own copy.
      const play = typeof req.query?.play === "string" ? req.query.play : "";
      if (play && options.player) {
        const mine = await copyTranscript(options.player, dir, play, show, id, chunk).catch(() => null);
        if (mine) { res.set("Cache-Control", "no-store"); return res.json(mine); }
      }
      const { words: _words, v: _v, ...piece } = (await dir.transcript(show, id, chunk)) as TranscriptChunk & { v?: number };
      res.set("Cache-Control", "private, max-age=3600");
      res.json(piece);
    }
    catch (e) { appleDown(res, e); }
  });

  /** Explore previews: an episode's best ~45 seconds (picked by AI from its transcript), with that
   *  stretch's audio cut once and kept in storage so every later play starts at once. */
  const previewing = createAttemptLimiter({ max: 150, windowMs: 10 * 60_000 });
  app.get(`${P}/moment/:episodeId`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.episodeId), show = cleanPodId(req.query?.show);
    if (!id || !show) return res.status(400).json({ message: "That isn't an episode." });
    if (limited(previewing, req, res, "previews")) return;
    try {
      let m = await dir.moment(show, id);
      if (!m.audio && !m.temp && options.socialDb) {
        const blob = await dir.cutRange(show, id, m.s, m.e);
        const bucket = options.socialDb().storage.from("podcast-uploads"), path = `moments/${id}.mp3`;
        const { error } = await bucket.upload(path, blob, { contentType: "audio/mpeg", upsert: true });
        if (error) throw new Error(`storage: ${error.message}`);
        m = await dir.keepMomentAudio(id, m, bucket.getPublicUrl(path).data.publicUrl);
      }
      res.set("Cache-Control", "private, max-age=3600");
      res.json(m);
    } catch (e: any) {
      if (e?.soft) return res.status(404).json({ message: "No preview for this episode." });
      console.error("[earshot] moment:", e?.message);
      res.status(502).json({ message: "The preview isn't ready. Try again in a moment." });
    }
  });

  // ---------------- smart ad skip: marks, votes, skips (server/podcastAds.ts) ----------------
  // Voters are "u<id>" on Arise (LifeHub) and "d<device>" on Podscroll, so both apps share one pool.
  const adStore = options.adStore ?? (sharedAdStore ??= memoryAdStore());
  const player = options.player;
  registerAdRoutes(app, authMiddleware, { prefix: P, dir, store: adStore, voterOf: (req: any) => `${P === "/api/podscroll" ? "d" : "u"}${uid(req)}`, toContent: player ? (sid, ep, x, side) => player.toContent(sid, ep, x, side) : undefined });
  // Publishing, Studio and LivePod need a creator: anyone signed in to Arise, or on Pod+ someone
  // signed in with their email (server/podcastAccounts.ts; the gate below marks req.creator).
  const isCreator = (req: any) => (P === "/api/podscroll" ? !!req.creator : !isStudent(req));
  if (options.socialDb) registerCreatorRoutes(app, authMiddleware, {
    prefix: P, getDb: options.socialDb, voterOf: (req: any) => `${P === "/api/podscroll" ? "d" : "u"}${uid(req)}`, allowed: (req: any) => !isStudent(req), isCreator,
    signIn: P === "/api/podscroll",
  });
  if (options.socialDb) registerSocialRoutes(app, authMiddleware, {
    prefix: P, getDb: options.socialDb, voterOf: (req: any) => `${P === "/api/podscroll" ? "d" : "u"}${uid(req)}`, allowed: (req: any) => !isStudent(req), isCreator,
    // A clip's audio: cut from the listener's own copy when they're playing through the server (exactly
    // what they heard), otherwise from the host's copy at the same times.
    cutClip: async (voter, c) => (c.sid && player ? await player.clipOf(c.sid, voter, c.episodeId, c.s, c.e).catch(() => null) : null)
      ?? (c.showId ? await dir.cutRange(c.showId, c.episodeId, c.s, c.e).catch(() => null) : null),
  });
  if (player) {
    if (!openingsStarted.has(player)) { openingsStarted.add(player); startOpenings(player, dir); }
    registerPlayRoutes(app, authMiddleware, {
      prefix: P, player, dir, crowd: (ep) => crowdFor(adStore, ep), cleanId: cleanPodId, clientIp,
      voterOf: (req: any) => `${P === "/api/podscroll" ? "d" : "u"}${uid(req)}`,
      audioFor: async (showId, episodeId) => (await dir.loadShow(showId)).episodes.find((e) => e.id === episodeId)?.audio ?? null,
    });
  }

  // ---------------- likes, shares, comments ----------------

  const episodeId = (v: unknown) => cleanPodId(v);

  app.get(`${P}/counts`, authMiddleware, async (req: any, res) => {
    const ids = Array.from(new Set(String(req.query?.ids || "").split(",").map(episodeId).filter(Boolean))).slice(0, 40);
    if (!ids.length) return res.json({ counts: {} });
    try { res.set("Cache-Control", "no-store"); res.json({ counts: await store.counts(ids, uid(req)), comments: canComment(req.user?.role) }); }
    catch (e) { storeDown(res, e); }
  });

  app.post(`${P}/like`, authMiddleware, async (req: any, res) => {
    const id = episodeId(req.body?.episodeId);
    if (!id) return res.status(400).json({ message: "That isn't an episode." });
    if (limited(writes, req, res)) return;
    try { await store.setLike(uid(req), id, req.body?.on !== false); res.json({ ok: true }); }
    catch (e) { storeDown(res, e); }
  });

  app.post(`${P}/share`, authMiddleware, async (req: any, res) => {
    const id = episodeId(req.body?.episodeId);
    if (!id) return res.status(400).json({ message: "That isn't an episode." });
    if (limited(writes, req, res)) return;
    try { await store.addShare(id); res.json({ ok: true }); }
    catch (e) { storeDown(res, e); }
  });

  app.get(`${P}/comments/:episodeId`, authMiddleware, async (req: any, res) => {
    if (!canComment(req.user?.role)) return res.status(403).json({ message: "Comments aren't available on student accounts." });
    const id = episodeId(req.params.episodeId);
    if (!id) return res.status(400).json({ message: "That isn't an episode." });
    try { res.set("Cache-Control", "no-store"); res.json({ comments: await store.comments(id, uid(req)), admin: isAdmin(req) }); }
    catch (e) { storeDown(res, e); }
  });

  app.post(`${P}/comments`, authMiddleware, async (req: any, res) => {
    if (!canComment(req.user?.role)) return res.status(403).json({ message: "Comments aren't available on student accounts." });
    const id = episodeId(req.body?.episodeId);
    const body = cleanComment(req.body?.body);
    if (!id) return res.status(400).json({ message: "That isn't an episode." });
    if (!body) return res.status(400).json({ message: "Write something first." });
    if (limited(posts, req, res, "comments")) return;
    try {
      const comment = await store.addComment({ episodeId: id, showId: cleanPodId(req.body?.showId), userId: uid(req), author: commentAuthor(req.user?.displayName ?? req.user?.display_name), body });
      res.json({ comment });
    } catch (e) { storeDown(res, e); }
  });

  app.delete(`${P}/comments/:id`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a comment." });
    try { const gone = await store.deleteComment(id, uid(req), isAdmin(req)); if (!gone) return res.status(404).json({ message: "That comment is already gone, or isn't yours." }); res.json({ ok: true }); }
    catch (e) { storeDown(res, e); }
  });

  app.post(`${P}/comments/:id/report`, authMiddleware, async (req: any, res) => {
    if (!canComment(req.user?.role)) return res.status(403).json({ message: "Comments aren't available on student accounts." });
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a comment." });
    if (limited(writes, req, res)) return;
    try { await store.reportComment(id, uid(req)); res.json({ ok: true }); }
    catch (e) { storeDown(res, e); }
  });
}

// ---------------------------------------------------------------------------
// Podscroll: the same app as its own website, with no Arise account
// ---------------------------------------------------------------------------

const DEVICE = /^[A-Za-z0-9_-]{16,40}$/;
const PODSCROLL_ORIGINS = ["https://podscroll.onrender.com", "https://podscroll.app", "https://www.podscroll.app"];
/** Sites allowed to call /api/podscroll from a browser: the Podscroll site, its Render previews,
 *  anything listed in PODSCROLL_ORIGINS (comma-separated), and localhost while working on it. */
export function podscrollAllowed(origin: string, extra: string[] = []): boolean {
  if (!origin) return false;
  if (PODSCROLL_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  return /^https:\/\/podscroll[a-z0-9-]*\.onrender\.com$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
/** The visitor's address as Render's proxy saw it (the last X-Forwarded-For entry is the one it added). */
const clientIp = (req: any) => { const f = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean); return f[f.length - 1] || String(req.socket?.remoteAddress || ""); };

export function registerPodscrollRoutes(app: Express, store: EarshotStore, fetcher?: Fetcher, directory?: Directory, adStore?: AdStore, player?: Player, socialDb?: () => any, more: { sendEmail?: (to: string, subject: string, html: string) => Promise<{ sent: boolean; error?: string }> } = {}) {
  const extra = String(process.env.PODSCROLL_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const perIp = createAttemptLimiter({ max: 900, windowMs: 10 * 60_000 });
  app.use("/api/podscroll", (req: any, res: any, next: any) => {
    const origin = String(req.headers.origin || "");
    if (podscrollAllowed(origin, extra)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Podscroll-Device, X-Podscroll-Session");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  /** Listening needs no account: each browser keeps a random device id, sent with every request.
   *  Creators who signed in with their email also send a session; their requests then act as the
   *  device their profile was made on, so it's the same profile on every phone. */
  const sessions = socialDb ? accountSessions(socialDb) : null;
  const gate: RequestHandler = (req: any, res, next) => {
    const device = String(req.headers["x-podscroll-device"] || "");
    if (!DEVICE.test(device)) { res.status(400).json({ message: "Reload Podscroll and try again." }); return; }
    const ip = clientIp(req); const wait = perIp.retryAfter(ip);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `Too many requests. Try again in ${waitWords(wait)}.` }); return; }
    perIp.fail(ip);
    req.user = { id: device, role: "public", displayName: typeof req.body?.name === "string" ? req.body.name : "" };
    const token = String(req.headers["x-podscroll-session"] || "");
    if (!sessions || !SESSION.test(token)) return next();
    sessions.lookup(token).then((account) => {
      if (account) { req.user.id = account.device; req.creator = { email: account.email, id: account.id }; }
      next();
    }, () => next());
  };
  if (socialDb && sessions) registerPodscrollAccountRoutes(app, gate, { getDb: socialDb, sendEmail: more.sendEmail, sessions });
  // A tiny copy of an Apple cover, readable by the page (Apple's image server doesn't allow that
  // directly). Podscroll reads its colors to tint the strip iOS paints below a home-screen app, which
  // takes the page's color and can't show the art itself. Apple artwork only, 32 px, cached a day.
  const artIp = createAttemptLimiter({ max: 600, windowMs: 10 * 60_000 });
  app.get("/api/podscroll/art", async (req: any, res) => {
    const ip = clientIp(req);
    if (artIp.retryAfter(ip) > 0) { res.status(429).end(); return; }
    artIp.fail(ip);
    let u: URL;
    try { u = new URL(String(req.query.u || "")); } catch { res.status(400).end(); return; }
    if (u.protocol !== "https:" || !/(^|\.)mzstatic\.com$/i.test(u.hostname) || !/\/\d{2,4}x\d{2,4}(bb|cc|sr)?\.(jpe?g|png|webp)$/i.test(u.pathname)) { res.status(400).end(); return; }
    u.pathname = u.pathname.replace(/\/\d{2,4}x\d{2,4}(bb|cc|sr)?\.(jpe?g|png|webp)$/i, "/32x32bb.$2");
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8_000) });
      const type = r.headers.get("content-type") || "";
      const buf = Buffer.from(await r.arrayBuffer());
      if (!r.ok || !/^image\//.test(type) || buf.length > 200_000) { res.status(502).end(); return; }
      res.set({ "Content-Type": type, "Cache-Control": "public, max-age=86400" }).send(buf);
    } catch { res.status(502).end(); }
  });
  // Screen measurements Podscroll sends once when opened from a phone's home screen (sizes and the
  // element at the bottom edge; nothing about the person), so layout on devices that can't be tested
  // here can be checked in the server log.
  app.post("/api/podscroll/screen", gate, (req: any, res) => {
    try { const s = JSON.stringify(req.body ?? {}); if (s.length < 4000) console.log("[podscroll] screen", s); } catch { /* unreadable */ }
    res.status(204).end();
  });
  registerEarshotRoutes(app, gate, { store, fetcher, directory, adStore, player, socialDb, prefix: "/api/podscroll" });
}
