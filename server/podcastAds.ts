// Smart ad skip, the listener side: ads marked by listeners, "not an ad" votes, and spots many
// listeners skip past, shared between everyone on Earshot (LifeHub) and Podscroll (its own site).
// Tables: migrations/podcast_ads.sql (service role only). The ads found automatically live with the
// transcripts in the podcast directory (server/podcastDirectory.ts); GET /ads combines both.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { cleanPodId } from "../shared/earshot";
import { clusterMarks, clusterSkips, type Mark, type ServerAd, type Skip } from "../shared/earshotAds";
import type { Directory } from "./podcastDirectory";

export type Vote = { key: string; voter: string; vote: 1 | -1 };
export interface AdStore {
  marks(episodeId: string): Promise<Mark[]>;
  addMark(m: { episodeId: string; showId: string; s: number; e: number; dur: number; label: string; voter: string }): Promise<string>;
  removeMark(id: string, voter: string): Promise<boolean>;
  skips(episodeId: string): Promise<Skip[]>;
  addSkip(k: { episodeId: string; from: number; to: number; dur: number; voter: string }): Promise<void>;
  votes(episodeId: string): Promise<Vote[]>;
  vote(v: { episodeId: string; key: string; voter: string; vote: 1 | -1 }): Promise<void>;
}
export class AdStoreUnavailable extends Error {}

export function memoryAdStore(): AdStore {
  const marks: (Mark & { episodeId: string })[] = []; const skips: (Skip & { episodeId: string })[] = []; const votes: (Vote & { episodeId: string })[] = [];
  let next = 1;
  return {
    async marks(ep) { return marks.filter((m) => m.episodeId === ep); },
    async addMark(m) { const id = String(next++); marks.push({ id, episodeId: m.episodeId, s: m.s, e: m.e, dur: m.dur, voter: m.voter, label: m.label }); return id; },
    async removeMark(id, voter) { const i = marks.findIndex((m) => m.id === id && m.voter === voter); if (i < 0) return false; marks.splice(i, 1); return true; },
    async skips(ep) { return skips.filter((k) => k.episodeId === ep); },
    async addSkip(k) { skips.push({ episodeId: k.episodeId, from: k.from, to: k.to, dur: k.dur, voter: k.voter }); },
    async votes(ep) { return votes.filter((v) => v.episodeId === ep); },
    async vote(v) { const i = votes.findIndex((x) => x.key === v.key && x.voter === v.voter); if (i >= 0) votes.splice(i, 1); votes.push({ ...v }); },
  };
}

export function supabaseAdStore(getDb: () => any): AdStore {
  const missing = (e: any) => e && (e.code === "42P01" || e.code === "PGRST205" || (/podcast_ad/.test(String(e.message || "")) && /not find|does not exist/i.test(String(e.message || ""))));
  const check = (error: any) => { if (error) { if (missing(error)) throw new AdStoreUnavailable("podcast_ad tables missing"); throw error; } };
  return {
    async marks(ep) {
      const { data, error } = await getDb().from("podcast_ad_marks").select("id,s,e,dur,voter,label").eq("episode_id", ep).order("id", { ascending: true }).limit(500);
      check(error);
      return (data || []).map((r: any) => ({ id: String(r.id), s: Number(r.s), e: Number(r.e), dur: Number(r.dur), voter: String(r.voter), label: r.label ? String(r.label) : "" }));
    },
    async addMark(m) {
      const { data, error } = await getDb().from("podcast_ad_marks").insert({ episode_id: m.episodeId, show_id: m.showId, s: m.s, e: m.e, dur: m.dur, label: m.label || null, voter: m.voter }).select("id").single();
      check(error);
      return String(data.id);
    },
    async removeMark(id, voter) {
      const { data, error } = await getDb().from("podcast_ad_marks").delete().eq("id", Number(id)).eq("voter", voter).select("id");
      check(error);
      return !!(data && data.length);
    },
    async skips(ep) {
      const { data, error } = await getDb().from("podcast_ad_skips").select("from_s,to_s,dur,voter").eq("episode_id", ep).order("created_at", { ascending: false }).limit(2000);
      check(error);
      return (data || []).map((r: any) => ({ from: Number(r.from_s), to: Number(r.to_s), dur: Number(r.dur), voter: String(r.voter) }));
    },
    async addSkip(k) {
      const { error } = await getDb().from("podcast_ad_skips").insert({ episode_id: k.episodeId, from_s: k.from, to_s: k.to, dur: k.dur, voter: k.voter });
      check(error);
    },
    async votes(ep) {
      const { data, error } = await getDb().from("podcast_ad_votes").select("ad_key,voter,vote").eq("episode_id", ep).limit(5000);
      check(error);
      return (data || []).map((r: any) => ({ key: String(r.ad_key), voter: String(r.voter), vote: Number(r.vote) === -1 ? -1 : 1 }));
    },
    async vote(v) {
      const { error } = await getDb().from("podcast_ad_votes").upsert({ ad_key: v.key, episode_id: v.episodeId, voter: v.voter, vote: v.vote, created_at: new Date().toISOString() }, { onConflict: "ad_key,voter" });
      check(error);
    },
  };
}

/** Everything known about one episode's ads, for a listener: found automatically, marked by
 *  listeners (grouped), and skipped by many listeners; votes applied, voted-down ones left out. */
export async function adsFor(dir: Directory, store: AdStore, episodeId: string, voter: string): Promise<{ ads: (ServerAd & { mine?: boolean; myVote?: number })[]; shared: boolean }> {
  const found = await dir.foundAds(episodeId);
  let marks: Mark[] = [], skips: Skip[] = [], votes: Vote[] = [], shared = true;
  try { [marks, skips, votes] = await Promise.all([store.marks(episodeId), store.skips(episodeId), store.votes(episodeId)]); }
  catch (e) { if (e instanceof AdStoreUnavailable) shared = false; else throw e; }
  const tally = new Map<string, { up: number; down: number; mine?: number }>();
  for (const v of votes) { const t = tally.get(v.key) ?? { up: 0, down: 0 }; if (v.vote > 0) t.up++; else t.down++; if (v.voter === voter) t.mine = v.vote; tally.set(v.key, t); }
  const out: (ServerAd & { mine?: boolean; myVote?: number })[] = [];
  const add = (a: ServerAd, base: number, mine = false) => {
    const t = tally.get(a.key) ?? { up: 0, down: 0 };
    const score = base + t.up - t.down;
    // Your own "not an ad" always hides it for you; otherwise it shows while the votes are for it.
    if (t.mine === -1 || score < 1) return;
    out.push({ ...a, score, mine, myVote: t.mine });
  };
  for (const a of found) add(a, 1);
  for (const c of clusterMarks(marks)) add({ key: c.key, s: c.s, e: c.e, label: c.label, kind: "user", conf: 1, dur: c.dur, durMode: "exact", support: c.support }, c.support, c.voters.includes(voter));
  for (const c of clusterSkips(skips)) add({ key: c.key, s: c.s, e: c.e, label: "Listeners skip this", kind: "crowd", conf: 0.6, dur: c.dur, durMode: "exact", support: c.support }, 1);
  out.sort((a, b) => a.s - b.s);
  return { ads: out, shared };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : NaN);

/** Listeners' marks and skips made while playing through the server are kept in content time (the
 *  show's own audio, stitched-in ads left out; stored with dur 0), so they fit every copy. These are
 *  grouped here, with the votes, for placing in a session's copy (server/podcastPlay.ts). */
export async function crowdFor(store: AdStore, episodeId: string) {
  try {
    const [marks, skips, votes] = await Promise.all([store.marks(episodeId), store.skips(episodeId), store.votes(episodeId)]);
    return { marks: clusterMarks(marks.filter((m) => m.dur === 0)), skips: clusterSkips(skips.filter((k) => k.dur === 0)), votes };
  } catch (e) {
    if (e instanceof AdStoreUnavailable) return { marks: [], skips: [], votes: [] as Vote[] };
    throw e;
  }
}

export function registerAdRoutes(app: Express, authMiddleware: RequestHandler, o: {
  prefix: string; dir: Directory; store: AdStore; voterOf: (req: any) => string;
  /** A time in a session's copy as content time (playback through the server), or null. */
  toContent?: (sid: string, episodeId: string, x: number, side: "start" | "end") => number | null;
}) {
  const P = o.prefix;
  const marking = createAttemptLimiter({ max: 30, windowMs: 60 * 60_000 });
  const voting = createAttemptLimiter({ max: 150, windowMs: 60 * 60_000 });
  const skipping = createAttemptLimiter({ max: 200, windowMs: 60 * 60_000 });
  const reads = createAttemptLimiter({ max: 400, windowMs: 10 * 60_000 });
  const limited = (lim: ReturnType<typeof createAttemptLimiter>, key: string, res: any, what: string) => {
    const wait = lim.retryAfter(key);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `Too many ${what}. Try again in ${waitWords(wait)}.` }); return true; }
    lim.fail(key); return false;
  };
  const down = (res: any, e: any) => {
    if (e instanceof AdStoreUnavailable) return res.status(503).json({ message: "Shared ad marks aren't set up yet." });
    console.error("[earshot] ads:", e?.message || e);
    res.status(500).json({ message: "That didn't save. Try again." });
  };

  /** All the ads known for an episode. */
  app.get(`${P}/ads/:episodeId`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.episodeId);
    if (!id) return res.status(400).json({ message: "That isn't an episode." });
    const voter = o.voterOf(req);
    if (limited(reads, voter, res, "requests")) return;
    try { res.set("Cache-Control", "no-store"); res.json(await adsFor(o.dir, o.store, id, voter)); }
    catch (e) { down(res, e); }
  });

  /** "Mark ad": a listener's own ad range in their copy of the episode (dur = its length). */
  app.post(`${P}/ads/:episodeId/mark`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.episodeId), show = cleanPodId(req.body?.showId);
    const s = num(req.body?.s), e = num(req.body?.e), dur = num(req.body?.dur);
    const label = typeof req.body?.label === "string" ? req.body.label.replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) : "";
    if (!id) return res.status(400).json({ message: "That isn't an episode." });
    if (![s, e, dur].every(Number.isFinite) || s < 0 || e <= s || dur <= 0 || e > dur + 2 || dur > 86_400) return res.status(400).json({ message: "That ad's times don't look right." });
    if (e - s < 3) return res.status(400).json({ message: "An ad has to be at least 3 seconds long." });
    if (e - s > 900) return res.status(400).json({ message: "That's longer than 15 minutes. Mark one ad break at a time." });
    const voter = o.voterOf(req);
    if (limited(marking, voter, res, "ad marks")) return;
    // Played through the server: kept in content time, so it fits everyone's copy.
    const play = typeof req.body?.play === "string" ? req.body.play : "";
    const cs = play && o.toContent ? o.toContent(play, id, s, "start") : null, ce = play && o.toContent ? o.toContent(play, id, e, "end") : null;
    const content = cs !== null && ce !== null && ce - cs >= 3 && ce - cs <= 900;
    try {
      const markId = await o.store.addMark(content
        ? { episodeId: id, showId: show, s: Math.round(cs! * 10) / 10, e: Math.round(ce! * 10) / 10, dur: 0, label, voter }
        : { episodeId: id, showId: show, s: Math.round(s * 10) / 10, e: Math.round(e * 10) / 10, dur: Math.round(dur * 10) / 10, label, voter });
      if (show) void o.dir.learnMark(show, id, { s, e, label, dur }).catch(() => {});
      res.json({ id: markId, ...(await adsFor(o.dir, o.store, id, voter)) });
    } catch (err) { down(res, err); }
  });

  /** Take back your own mark. */
  app.delete(`${P}/ads/:episodeId/mark/:markId`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.episodeId), markId = cleanPodId(req.params.markId);
    if (!id || !markId) return res.status(400).json({ message: "That isn't a mark." });
    try { const ok = await o.store.removeMark(markId, o.voterOf(req)); if (!ok) return res.status(404).json({ message: "That mark is already gone, or isn't yours." }); res.json(await adsFor(o.dir, o.store, id, o.voterOf(req))); }
    catch (e) { down(res, e); }
  });

  /** "Not an ad" (-1, from Undo) or "Yes, an ad" (+1). One vote per listener per ad; a new one replaces it. */
  app.post(`${P}/ads/:episodeId/vote`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.episodeId);
    const key = typeof req.body?.key === "string" ? req.body.key.trim() : "";
    const vote = req.body?.vote === -1 || req.body?.vote === "-1" ? -1 : req.body?.vote === 1 || req.body?.vote === "1" ? 1 : 0;
    if (!id || !/^[auctg]:[0-9a-z:.-]{1,100}$/i.test(key) || !vote) return res.status(400).json({ message: "That vote doesn't look right." });
    const voter = o.voterOf(req);
    if (limited(voting, voter, res, "votes")) return;
    try { await o.store.vote({ episodeId: id, key, voter, vote: vote as 1 | -1 }); res.json({ ok: true }); }
    catch (e) { down(res, e); }
  });

  /** A listener jumped forward (from -> to): when several do the same, it's offered as a likely ad. */
  app.post(`${P}/ads/:episodeId/skip`, authMiddleware, async (req: any, res) => {
    const id = cleanPodId(req.params.episodeId);
    const from = num(req.body?.from), to = num(req.body?.to), dur = num(req.body?.dur);
    if (!id || ![from, to, dur].every(Number.isFinite) || from < 0 || to - from < 10 || to - from > 300 || dur <= 0 || to > dur + 2) return res.json({ ok: true }); // quietly ignored
    const voter = o.voterOf(req);
    if (limited(skipping, voter, res, "skips")) return;
    const play = typeof req.body?.play === "string" ? req.body.play : "";
    const cf = play && o.toContent ? o.toContent(play, id, from, "start") : null, ct = play && o.toContent ? o.toContent(play, id, to, "end") : null;
    const content = cf !== null && ct !== null && ct - cf >= 10 && ct - cf <= 300;
    try {
      await o.store.addSkip(content ? { episodeId: id, from: Math.round(cf!), to: Math.round(ct!), dur: 0, voter } : { episodeId: id, from: Math.round(from), to: Math.round(to), dur: Math.round(dur * 10) / 10, voter });
      res.json({ ok: true });
    }
    catch (e) { if (e instanceof AdStoreUnavailable) return res.json({ ok: true }); down(res, e); }
  });
}
