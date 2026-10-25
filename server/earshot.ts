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
  GENRE, EARSHOT_LIMITS, appleLookupUrl, appleSearchUrl, canComment, cleanComment, cleanPodId, commentAuthor, mergeGenreShows, parseEpisode, parseShow,
  type PodEpisode, type PodShow,
} from "../shared/earshot";

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
// Apple's directory: paced, cached
// ---------------------------------------------------------------------------

export type Fetcher = (url: string) => Promise<any>;
const USER_AGENT = "Arise-Earshot/1.0 (arisetodo.com)";
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 403 || res.status === 429) throw new Error("busy");
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
};

/** One request to Apple every APPLE_PACE ms at most; a request that would wait too long is refused. */
export const APPLE_PACE = 3_200;
export function pacedFetcher(inner: Fetcher, pace = APPLE_PACE, maxWait = 12_000, now = () => Date.now(), sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Fetcher {
  let nextAt = 0;
  return async (url) => {
    const t = now();
    const at = Math.max(t, nextAt);
    if (at - t > maxWait) throw new Error("busy");
    nextAt = at + pace;
    if (at > t) await sleep(at - t);
    return inner(url);
  };
}

/** One pacer for every caller: Apple's limit is per server address, whichever site asks. */
const sharedApple = pacedFetcher(defaultFetcher);

type Cached<T> = { at: number; value: T };
export function ttlCache<T>(ms: number, max = 500) {
  const map = new Map<string, Cached<T>>();
  const inflight = new Map<string, Promise<T>>();
  return {
    peek(key: string) { const c = map.get(key); return c ? { value: c.value, fresh: Date.now() - c.at < ms } : null; },
    async get(key: string, load: () => Promise<T>): Promise<T> {
      const c = map.get(key);
      if (c && Date.now() - c.at < ms) return c.value;
      const running = inflight.get(key);
      if (running) return running;
      const p = load().then((value) => {
        map.set(key, { at: Date.now(), value });
        if (map.size > max) map.delete(map.keys().next().value as string);
        return value;
      }).catch((e) => { if (c) return c.value; throw e; }).finally(() => inflight.delete(key)); // stale beats nothing
      inflight.set(key, p);
      return p;
    },
  };
}

export interface EarshotOptions {
  store: EarshotStore; fetcher?: Fetcher;
  /** Where the routes live. LifeHub uses /api/earshot; the Podscroll website uses /api/podscroll. */
  prefix?: string;
}

export function registerEarshotRoutes(app: Express, authMiddleware: RequestHandler, options: EarshotOptions) {
  const store = options.store;
  const P = options.prefix ?? "/api/earshot";
  const apple = options.fetcher ?? sharedApple;
  const genreCache = ttlCache<PodShow[]>(12 * 60 * 60_000, 200);
  const showCache = ttlCache<{ show: PodShow | null; episodes: PodEpisode[] }>(90 * 60_000, 800);
  const searchCache = ttlCache<{ shows: PodShow[]; episodes: PodEpisode[] }>(60 * 60_000, 400);
  const reads = createAttemptLimiter({ max: 240, windowMs: 10 * 60_000 });
  const writes = createAttemptLimiter({ max: 120, windowMs: 10 * 60_000 });
  const posts = createAttemptLimiter({ max: 15, windowMs: 10 * 60_000 });

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
  const clean = (list: PodShow[] | PodEpisode[], explicit: boolean) => (explicit ? list : list.filter((x) => !x.explicit));

  /** Shows for one genre, Apple's most relevant first. */
  app.get(`${P}/genre/:id`, authMiddleware, async (req: any, res) => {
    const g = GENRE[String(req.params.id)];
    if (!g) return res.status(404).json({ message: "That genre doesn't exist." });
    if (isStudent(req) && !g.kidSafe) return res.json({ shows: [] });
    if (limited(reads, req, res)) return;
    const explicit = explicitFor(req);
    try {
      const shows = await genreCache.get(`${g.id}:${explicit}`, async () => {
        const batches: unknown[][] = [];
        for (const term of g.terms.slice(0, 2)) {
          try { const body = await apple(appleSearchUrl(term, "podcast", 50, explicit)); batches.push(Array.isArray(body?.results) ? body.results : []); }
          catch (e) { if (!batches.length) throw e; }
        }
        return mergeGenreShows(g.id, batches);
      });
      res.set("Cache-Control", "private, max-age=1800");
      res.json({ shows: clean(shows, explicit) });
    } catch (e) { appleDown(res, e); }
  });

  /** A show and its newest episodes. */
  app.get(`${P}/show/:id`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.id);
    if (!id) return res.status(400).json({ message: "That isn't a podcast." });
    if (limited(reads, req, res)) return;
    try {
      const out = await showCache.get(id, async () => {
        const body = await apple(appleLookupUrl(id, 25));
        const results: unknown[] = Array.isArray(body?.results) ? body.results : [];
        const show = results.map((r) => parseShow(r)).find((s) => s && s.id === id) ?? null;
        const episodes = results.map((r) => parseEpisode(r, show)).filter((e): e is PodEpisode => !!e).sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0"));
        return { show, episodes };
      });
      const explicit = !isStudent(req) && req.query?.explicit === "1";
      if (out.show?.explicit && !explicit) return res.json({ show: out.show, episodes: [], blocked: true });
      res.set("Cache-Control", "private, max-age=900");
      res.json({ show: out.show, episodes: clean(out.episodes, explicit) });
    } catch (e) { appleDown(res, e); }
  });

  /** Search shows and episodes by any words. */
  app.get(`${P}/search`, authMiddleware, async (req: any, res) => {
    const q = typeof req.query?.q === "string" ? req.query.q.replace(/\s+/g, " ").trim().slice(0, EARSHOT_LIMITS.search) : "";
    if (q.length < 2) return res.json({ shows: [], episodes: [] });
    if (limited(reads, req, res, "searches")) return;
    const explicit = explicitFor(req);
    try {
      const out = await searchCache.get(`${q.toLowerCase()}:${explicit}`, async () => {
        const shows = await apple(appleSearchUrl(q, "podcast", 25, explicit));
        let episodes: any = { results: [] };
        try { episodes = await apple(appleSearchUrl(q, "podcastEpisode", 20, explicit)); } catch { /* shows alone are fine */ }
        return {
          shows: (Array.isArray(shows?.results) ? shows.results : []).map((r: unknown) => parseShow(r)).filter(Boolean) as PodShow[],
          episodes: (Array.isArray(episodes?.results) ? episodes.results : []).map((r: unknown) => parseEpisode(r)).filter(Boolean) as PodEpisode[],
        };
      });
      const kidOk = (genre: string) => !isStudent(req) || !!GENRE[genre]?.kidSafe;
      res.set("Cache-Control", "private, max-age=900");
      res.json({ shows: clean(out.shows, explicit).filter((s) => kidOk((s as PodShow).genre)), episodes: clean(out.episodes, explicit) });
    } catch (e) { appleDown(res, e); }
  });

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

export function registerPodscrollRoutes(app: Express, store: EarshotStore, fetcher?: Fetcher) {
  const extra = String(process.env.PODSCROLL_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const perIp = createAttemptLimiter({ max: 900, windowMs: 10 * 60_000 });
  app.use("/api/podscroll", (req: any, res: any, next: any) => {
    const origin = String(req.headers.origin || "");
    if (podscrollAllowed(origin, extra)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Podscroll-Device");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  /** No accounts: each browser keeps a random device id, sent with every request. */
  const gate: RequestHandler = (req: any, res, next) => {
    const device = String(req.headers["x-podscroll-device"] || "");
    if (!DEVICE.test(device)) { res.status(400).json({ message: "Reload Podscroll and try again." }); return; }
    const ip = clientIp(req); const wait = perIp.retryAfter(ip);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `Too many requests. Try again in ${waitWords(wait)}.` }); return; }
    perIp.fail(ip);
    req.user = { id: device, role: "public", displayName: typeof req.body?.name === "string" ? req.body.name : "" };
    next();
  };
  registerEarshotRoutes(app, gate, { store, fetcher, prefix: "/api/podscroll" });
}
