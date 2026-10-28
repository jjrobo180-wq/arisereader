// Pod+ ad skip: new episodes checked for ads before anyone presses play. Every 20 minutes, in the
// hours when the free AI allowance is left over (US night time, and the last hours before it resets
// at midnight UTC), the newest episode of a show people follow or play here (then the top shows) is
// fetched the way a listener's phone would, compared with other copies for stitched-in ads, and its
// opening plus the parts where that show's ad breaks usually are (server/podcastPlay.ts
// checkLikelyAds) are transcribed and read for ads. A show with no ad spots on record yet has the
// whole episode read once, which teaches the show memory where its breaks are.
// Everything found is kept, so the first listener gets the ads skipped from the first second.
import type { KV } from "./podcastDirectory";
import type { Directory } from "./podcastDirectory";
import type { Player } from "./podcastPlay";
import { aiStrained } from "./podcastDirectory";
import { TX_CHUNK_SECS } from "../shared/earshot";

const SHOWS_KEY = "pc:shows";
const doneKey = (episodeId: string) => `pc:done:${episodeId}`;
type Tally = Record<string, { n: number; at: number }>;

/** How much of the day's allowance pre-checks may use now (minutes), keeping the rest for listeners. */
export function spareMinutes(now: Date, perDay: number, left: number): number {
  const h = now.getUTCHours();
  // 1am-7am US Eastern: few people listening, and the day's allowance is barely touched.
  if (h >= 5 && h < 11) return Math.max(0, left - perDay * 0.5);
  // The last three hours before the allowance resets: whatever's left would be lost anyway.
  if (h >= 21) return Math.max(0, left - perDay * 0.1);
  return 0;
}

/** Shows worth checking, most wanted first: followed or played here recently, then the top shows. */
export function pickShows(tally: Tally, top: string[], now = Date.now(), max = 40): string[] {
  const fresh = Object.entries(tally).filter(([, v]) => now - v.at < 30 * 24 * 3600_000)
    .sort((a, b) => b[1].n - a[1].n || b[1].at - a[1].at).map(([id]) => id);
  return [...new Set([...fresh, ...top])].slice(0, max);
}

let noteImpl: ((ids: string[], weight: number) => void) | null = null;
/** A listener follows or plays these shows (weight: follows count more than one play). */
export function noteShows(ids: string[], weight = 1) { noteImpl?.(ids, weight); }

export function startPrechecks(o: {
  kv: KV; player: Player;
  dir: Pick<Directory, "loadShow" | "contentTranscript" | "budgetLeft" | "perDay" | "likelyAdChunks" | "idle">;
  topShows: () => Promise<string[]>;
  listenerUa?: string; everyMs?: number; perRun?: number; now?: () => Date;
}) {
  const ua = o.listenerUa ?? "AppleCoreMedia/1.0.0.22A3354 (iPhone; U; CPU OS 18_0 like Mac OS X; en_us)";
  const now = o.now ?? (() => new Date());
  let tally: Tally | null = null;
  let dirty = false;
  const load = async () => (tally ??= ((await o.kv.get(SHOWS_KEY).catch(() => null))?.value as Tally) || {});
  noteImpl = (ids, weight) => {
    void load().then((t) => {
      for (const id of ids.slice(0, 60)) if (/^\d{1,20}$/.test(id)) t[id] = { n: Math.min(1e6, (t[id]?.n ?? 0) + weight), at: Date.now() };
      // Keep the most wanted 1,000.
      const keys = Object.keys(t);
      if (keys.length > 1000) for (const [id] of Object.entries(t).sort((a, b) => a[1].n - b[1].n).slice(0, keys.length - 1000)) delete t[id];
      dirty = true;
    });
  };
  const save = async () => { if (dirty && tally) { dirty = false; await o.kv.set(SHOWS_KEY, tally).catch(() => {}); } };

  let busy = false, cursor = 0;
  const stats = { checked: 0, at: "" };
  async function checkEpisode(showId: string, ep: { id: string; audio: string }) {
    const sid = `pre${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const s: any = o.player.open({ sid, voter: "precheck", episodeId: ep.id, showId, url: ep.audio, ua, ip: "" });
    try {
      const t0 = Date.now();
      // Compare with other copies (stitched-in ads), then the opening and the likely ad spots run by themselves.
      while (Date.now() - t0 < 5 * 60_000 && !s.ads.final && !s.copy.err) { s.touched = Date.now(); await s.copy.wait(1000); }
      if (!s.ads.final || !s.copy.done) return;
      while (Date.now() - t0 < 15 * 60_000 && s.opening !== "done" && o.player.sessions.has(sid)) { s.touched = Date.now(); await new Promise((r) => setTimeout(r, 2000)); }
      // A show with no ad spots learned yet: read the whole episode once, so the next ones know where to look.
      const { total } = o.player.contentOf(s);
      if (!(await o.dir.likelyAdChunks(showId, total)).length) {
        const chunks = Math.min(8, Math.max(1, Math.ceil(total / TX_CHUNK_SECS - 0.01)));
        for (let c = 1; c < chunks; c++) {
          if (!o.player.sessions.has(sid) || aiStrained() || spareMinutes(now(), o.dir.perDay, o.dir.budgetLeft()) < TX_CHUNK_SECS / 60) break;
          s.touched = Date.now();
          await o.dir.contentTranscript(showId, ep.id, c, { secs: total, extract: (from, to) => o.player.extract(s, from, to) }).catch(() => null);
        }
      }
      stats.checked++;
    } finally { o.player.close(sid); }
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      await save();
      const perRun = o.perRun ?? 3;
      for (let n = 0; n < perRun; n++) {
        // Room for one episode's opening and a couple of its ad spots, and the AI isn't straining.
        if (spareMinutes(now(), o.dir.perDay, o.dir.budgetLeft()) < 25 || aiStrained() || !o.dir.idle()) return;
        const shows = pickShows(await load(), await o.topShows().catch(() => []));
        if (!shows.length) return;
        let did = false;
        for (let tries = 0; tries < shows.length && !did; tries++) {
          const showId = shows[cursor++ % shows.length];
          const { episodes } = await o.dir.loadShow(showId).catch(() => ({ episodes: [] as any[] }));
          // The newest episode, out in the last week, not checked yet.
          const ep = episodes.find((e: any) => e.audio && (!e.date || Date.now() - Date.parse(e.date) < 7 * 24 * 3600_000));
          if (!ep || (await o.kv.get(doneKey(ep.id)).catch(() => null))) continue;
          await o.kv.set(doneKey(ep.id), { at: new Date().toISOString() }).catch(() => {});
          await checkEpisode(showId, ep).catch((e: any) => console.warn("[earshot] pre-check:", e?.message || e));
          did = true;
        }
        if (!did) return;
        stats.at = new Date().toISOString();
      }
    } finally { busy = false; }
  }
  const timer = setInterval(() => { void tick(); }, o.everyMs ?? 20 * 60_000);
  (timer as any).unref?.();
  return { tick, stats, stop: () => { clearInterval(timer); noteImpl = null; } };
}
