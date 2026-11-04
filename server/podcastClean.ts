// Ad-free copies of podcast episodes (Earshot + Pod+), kept in storage and played straight from there.
//
// Playback through the server finds the ads a host stitched into a listener's copy by comparing it
// with other copies (server/podcastPlay.ts). Once a copy has been compared, its show audio (content
// time: the copy with those ads left out) is written out as an MP3 of its own, frame by frame (the
// same bytes the host sent, nothing re-encoded), with a fresh Xing header so players know its length
// and can seek in it. It goes to a private storage bucket, and from then on every listener of that
// episode plays the file straight from storage: there are no stitched-in ads in it to skip, seeking
// is instant, and a server restart (every deploy) can't interrupt it.
//
// The copy is content time exactly, so everything already kept in content time fits it as it is:
// read-along pieces and the ads found in them (host-read sponsors, which are part of the show itself
// and are skipped where they are), listeners' marks and skips. Its session (podcastPlay's clean
// session, the same id for everyone: cleanSidOf) reads the stored file back when one of those has to
// be placed in it, so nothing here depends on the listener's own copy still being on this server.
import { promises as fsp } from "node:fs";
import { copyToCt, frameHeader, type ContentPiece } from "../shared/earshotAudio";
import type { PlayAd } from "../shared/earshotAds";
import { cleanSidOf, readWhole, type Player } from "./podcastPlay";

// ---------------------------------------------------------------------------
// Writing the MP3
// ---------------------------------------------------------------------------

/** Bytes [start, end) of a copy. */
export type ByteReader = (start: number, end: number) => Promise<Uint8Array>;

const BITRATES = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] } as const;
const RATES: Record<number, readonly number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const ascii = (b: Uint8Array, at: number, n: number) => { let s = ""; for (let k = 0; k < n && at + k < b.length; k++) s += String.fromCharCode(b[at + k]); return s; };
const sideInfo = (v: number, mono: boolean) => (v === 1 ? (mono ? 17 : 32) : (mono ? 9 : 17));
/** An encoder's info frame (Xing / Info / VBRI): no sound, and its length and seek table describe the whole original file. */
function isInfoFrame(b: Uint8Array, i: number, h: NonNullable<ReturnType<typeof frameHeader>>): boolean {
  const at = i + 4 + (h.crc ? 2 : 0) + sideInfo(h.v, h.mono);
  const tag = ascii(b, at, 4);
  return tag === "Xing" || tag === "Info" || ascii(b, i + 36, 4) === "VBRI";
}
const isTagAt = (b: Uint8Array, i: number) => i + 3 <= b.length && ((b[i] === 0x54 && b[i + 1] === 0x41 && b[i + 2] === 0x47) || (b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x33) || (b[i] === 0x41 && b[i + 1] === 0x50 && b[i + 2] === 0x45));

/** The info frame that goes first: frame count, byte count and a 100-point seek table, so players
 *  show the right length and land in the right place when seeking (iPhones read it too). */
export function xingFrame(first: Uint8Array, frames: number, audioBytes: number, toc: (bytes: number, len: number) => Uint8Array, cbr: boolean): Buffer {
  const vb = (first[1] >> 3) & 3, si = (first[2] >> 2) & 3, mono = first[3] >> 6 === 3;
  const v = vb === 3 ? 1 : 2;
  const rate = RATES[vb][si];
  const side = sideInfo(v, mono);
  const need = 4 + side + 4 + 4 + 4 + 4 + 100 + 4;
  const table = BITRATES[v === 1 ? 1 : 2];
  let len = 0, bi = 1;
  for (; bi <= 14; bi++) { len = Math.floor(((v === 1 ? 144 : 72) * table[bi] * 1000) / rate); if (len >= need) break; }
  if (bi > 14) { bi = 14; len = Math.floor(((v === 1 ? 144 : 72) * table[14] * 1000) / rate); }
  const f = Buffer.alloc(len);
  // The first frame's version, sample rate and channel mode; no CRC, no padding.
  f[0] = 0xff; f[1] = first[1] | 0x01; f[2] = (bi << 4) | (si << 2) | (first[2] & 0x01); f[3] = first[3];
  let at = 4 + side;
  f.write(cbr ? "Info" : "Xing", at, "latin1"); at += 4;
  f.writeUInt32BE(0x0f, at); at += 4; // frames, bytes, seek table, quality
  f.writeUInt32BE(frames >>> 0, at); at += 4;
  const bytes = len + audioBytes;
  f.writeUInt32BE(bytes >>> 0, at); at += 4;
  f.set(toc(bytes, len), at); at += 100;
  f.writeUInt32BE(cbr ? 0 : 50, at);
  return f;
}

/** One MP3 of the given byte ranges of a copy (each starts and ends on a frame): only whole audio
 *  frames, in order. Tags, stray bytes and encoder info frames between them are left out, and a Xing
 *  frame describing this file goes first. null when there's no audio or it's too big. */
// 200 MB is over three hours at 128 kbps. Bigger copies aren't made (the server holds the file while
// writing it, and stays well inside its memory); they play through the server as before.
export async function writeCleanMp3(read: ByteReader, ranges: [number, number][], maxBytes = 200 * 1024 * 1024): Promise<{ data: Buffer; frames: number; secs: number } | null> {
  const total = ranges.reduce((a, r) => a + Math.max(0, r[1] - r[0]), 0);
  if (!total || total > maxBytes) return null;
  // The info frame is written in front of the audio at the end (its size is known only then).
  const ROOM = 2048;
  const out = Buffer.allocUnsafe(ROOM + total);
  let w = 0, t = 0, n = 0;
  let starts = new Float64Array(65536), offs = new Uint32Array(65536);
  let first: Uint8Array | null = null;
  let kbps = -1, cbr = true;
  for (const [a, b] of ranges) {
    if (b <= a) continue;
    const buf = await read(a, b);
    let i = 0;
    while (i + 4 <= buf.length) {
      const h = frameHeader(buf, i);
      if (!h || i + h.len > buf.length) {
        // An ID3 tag between frames: skipped whole.
        if (i + 10 <= buf.length && buf[i] === 0x49 && buf[i + 1] === 0x44 && buf[i + 2] === 0x33 && buf[i + 3] < 5) { i += 10 + (((buf[i + 6] & 0x7f) << 21) | ((buf[i + 7] & 0x7f) << 14) | ((buf[i + 8] & 0x7f) << 7) | (buf[i + 9] & 0x7f)); continue; }
        i++; continue;
      }
      const next = i + h.len;
      // A frame is followed by another, a tag, or the end of the range (so stray 0xFF bytes aren't taken for one).
      if (next + 4 <= buf.length && !frameHeader(buf, next) && !isTagAt(buf, next)) { i++; continue; }
      if (isInfoFrame(buf, i, h)) { i = next; continue; }
      if (!first) first = Uint8Array.from(buf.subarray(i, i + 4));
      if (kbps < 0) kbps = h.kbps; else if (h.kbps !== kbps) cbr = false;
      if (n === starts.length) { const s2 = new Float64Array(n * 2); s2.set(starts); starts = s2; const o2 = new Uint32Array(n * 2); o2.set(offs); offs = o2; }
      starts[n] = t; offs[n] = w; n++;
      out.set(buf.subarray(i, next), ROOM + w);
      w += h.len; t += h.dur;
      i = next;
    }
  }
  if (!n || !first) return null;
  const secs = t;
  const frameAt = (x: number) => { let lo = 0, hi = n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= x) lo = mid; else hi = mid - 1; } return lo; };
  const toc = (bytes: number, len: number) => {
    const table = new Uint8Array(100);
    for (let p = 0; p < 100; p++) table[p] = Math.min(255, Math.floor((256 * (len + offs[frameAt((secs * p) / 100)])) / bytes));
    return table;
  };
  const x = xingFrame(first, n, w, toc, cbr);
  x.copy(out, ROOM - x.length);
  return { data: out.subarray(ROOM - x.length, ROOM + w), frames: n, secs };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface CleanStore {
  /** Keeps the file (throws when it can't). */
  put(path: string, data: Buffer): Promise<void>;
  /** A signed address players can stream (and seek in) for `secs` seconds. */
  sign(path: string, secs: number): Promise<string>;
}
export const CLEAN_BUCKET = "podcast-clean";

export function supabaseCleanStore(getDb: () => any, bucket = CLEAN_BUCKET): CleanStore {
  let made: Promise<unknown> | null = null;
  const ensure = () => (made ??= Promise.resolve(getDb().storage.createBucket?.(bucket, { public: false, fileSizeLimit: "500MB", allowedMimeTypes: ["audio/mpeg"] })).catch(() => null));
  return {
    async put(path, data) {
      const up = () => getDb().storage.from(bucket).upload(path, data, { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
      let { error } = await up();
      if (error && /bucket not found|not found/i.test(String(error.message || error))) { made = null; await ensure(); ({ error } = await up()); }
      if (error) throw new Error(`storage: ${String(error.message || error).slice(0, 160)}`);
    },
    async sign(path, secs) {
      const { data, error } = await getDb().storage.from(bucket).createSignedUrl(path, secs);
      if (error || !data?.signedUrl) throw new Error(`storage: ${String(error?.message || "no address").slice(0, 160)}`);
      return String(data.signedUrl);
    },
  };
}

export function memoryCleanStore(base = "https://storage.example/clean/"): CleanStore & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return { files, async put(path, data) { files.set(path, Buffer.from(data)); }, async sign(path, secs) { if (!files.has(path)) throw new Error("not found"); return `${base}${path}?exp=${secs}`; } };
}

// ---------------------------------------------------------------------------
// Making and finding ad-free copies
// ---------------------------------------------------------------------------

export type CleanInfo = {
  v: 1;
  stage: "ready" | "failed";
  episodeId: string; showId: string;
  path?: string; bytes?: number; secs?: number; frames?: number;
  /** Ads still in the show audio when it was made (content time = this file's time): ad breaks too long
   *  to be sure of, the file's own ad chapters, ads known from other episodes, seams. Skipped by the player. */
  ads?: PlayAd[];
  /** The copy it was made from: how its ads were found, and how many stitched-in ads (seconds) were cut. */
  from?: { how: string; compared: number; cut: number; cutSecs: number; copySecs: number };
  at: number; err?: string; retryAt?: number;
};
type KVLike = { get(key: string): Promise<{ value: any; at: number } | null>; set(key: string, value: any): Promise<void> };
type Sess = any;

const round2 = (x: number) => Math.round(x * 100) / 100;
const SIGN_SECS = 12 * 3600;

/** A copy time as content time; inside a stitched-in ad, the show's edge next to it. */
function toCt(pieces: ContentPiece[], x: number, side: "start" | "end"): number | null {
  const ct = copyToCt(pieces, x);
  if (ct !== null) return ct;
  if (side === "start") { const p = pieces.find((q) => q.x >= x); return p ? p.ct : null; }
  const before = pieces.filter((q) => q.x + q.len <= x + 1e-6).pop();
  return before ? before.ct + before.len : null;
}

export type Cleaner = ReturnType<typeof createCleaner>;
const attached = new WeakMap<object, Cleaner>();
/** The cleaner working with this player (set up once in server/routes.ts). */
export const cleanerOf = (player: object | undefined | null): Cleaner | undefined => (player ? attached.get(player) : undefined);

export function createCleaner(o: { player: Player; kv: KVLike; store: CleanStore; now?: () => number; minSecs?: number; quiet?: boolean }) {
  const now = o.now ?? Date.now;
  const minSecs = o.minSecs ?? 45;
  const mem = new Map<string, { info: CleanInfo | null; at: number }>();
  const signed = new Map<string, { url: string; exp: number }>();
  const queue: Sess[] = [];
  const building = new Set<string>();
  let running = false;
  const log = (...a: any[]) => { if (!o.quiet) console.log(...a); };

  const remember = (id: string, info: CleanInfo | null) => {
    mem.set(id, { info, at: now() });
    if (mem.size > 4000) mem.delete(mem.keys().next().value as string);
  };
  /** What's known about an episode's ad-free copy (null: none yet). */
  async function info(episodeId: string): Promise<CleanInfo | null> {
    const m = mem.get(episodeId);
    if (m && now() - m.at < (m.info?.stage === "ready" ? 30 * 60_000 : 20_000)) return m.info;
    const v = (await o.kv.get(`clean:${episodeId}`).catch(() => null))?.value as CleanInfo | undefined;
    const got = v && v.v === 1 && (v.stage === "ready" || v.stage === "failed") ? v : null;
    remember(episodeId, got);
    return got;
  }
  /** A signed address for the file, good for at least 6 more hours. */
  async function url(i: CleanInfo): Promise<{ url: string; exp: number } | null> {
    if (i.stage !== "ready" || !i.path) return null;
    const c = signed.get(i.path);
    if (c && c.exp - now() > 6 * 3600_000) return c;
    try {
      const r = { url: await o.store.sign(i.path, SIGN_SECS), exp: now() + SIGN_SECS * 1000 };
      signed.set(i.path, r);
      if (signed.size > 4000) signed.delete(signed.keys().next().value as string);
      return r;
    } catch { return null; }
  }
  /** The ready copy as players need it: its session id, address and the ads still in it. */
  async function ready(episodeId: string): Promise<{ sid: string; url: string; exp: number; secs: number; ads: PlayAd[] } | null> {
    const i = await info(episodeId);
    if (!i || i.stage !== "ready") return null;
    const u = await url(i);
    return u ? { sid: cleanSidOf(episodeId), url: u.url, exp: u.exp, secs: i.secs ?? 0, ads: i.ads ?? [] } : null;
  }

  /** A copy that was just compared: made into the episode's ad-free copy, unless it has one. */
  function offer(s: Sess) {
    if (!s || s.clean) return;
    if (!s.copy?.done || s.copy.err || !s.copy.scanner?.count) return;
    // Only from a copy whose stitched-in ads are known for sure.
    if ((s.ads?.how !== "diff" && s.ads?.how !== "same") || !(s.ads?.compared >= 1)) return;
    if (building.has(s.episodeId) || queue.some((q) => q.episodeId === s.episodeId)) return;
    queue.push(s);
    void pump();
  }
  async function pump() {
    if (running) return;
    running = true;
    try { while (queue.length) await build(queue.shift()); }
    finally { running = false; }
  }

  /** Ads found in the copy that stay in the show audio, moved to content time (this file's time). */
  function carried(s: Sess, pieces: ContentPiece[]): PlayAd[] {
    const out: PlayAd[] = [];
    for (const a of (s.ads?.ads ?? []) as PlayAd[]) {
      if (a.kind === "dai" && a.sure) continue; // cut out
      if (a.kind === "intro") continue;
      const x = toCt(pieces, a.s, "start"), y = toCt(pieces, a.e, "end");
      if (x === null || y === null || y - x < 1) continue;
      out.push({ ...a, s: round2(x), e: round2(y) });
    }
    return out.sort((p, q) => p.s - q.s).slice(0, 100);
  }

  async function build(s: Sess) {
    const id = String(s.episodeId || "");
    if (!id || building.has(id)) return;
    const have = await info(id);
    if (have?.stage === "ready") return;
    if (have?.stage === "failed" && now() < (have.retryAt ?? have.at + 6 * 3600_000)) return;
    if (!o.player.sessions.has(s.id)) return;
    building.add(id);
    s.streams++; // kept while it's read (an idle copy could be let go meanwhile)
    const t0 = now();
    try {
      const { file, scanner: X, written, pieces, total } = o.player.contentFrames(s);
      if (total < minSecs) return;
      const ranges: [number, number][] = pieces.map((p: ContentPiece) => [X.offsets[p.f0], p.f1 < X.count ? X.offsets[p.f1] : written]);
      const fh = await fsp.open(file, "r");
      let made: Awaited<ReturnType<typeof writeCleanMp3>> = null;
      try {
        made = await writeCleanMp3(async (a, b) => { const buf = Buffer.allocUnsafe(Math.max(0, b - a)); const { bytesRead } = await fh.read(buf, 0, buf.length, a); return buf.subarray(0, bytesRead); }, ranges);
      } finally { await fh.close().catch(() => {}); }
      if (!made) throw Object.assign(new Error("no audio, or too big"), { lasting: true });
      // Its length must be the show's length (a copy that changed under us, or frames lost, isn't kept).
      if (Math.abs(made.secs - total) > Math.max(3, total * 0.005)) throw Object.assign(new Error(`length ${round2(made.secs)} s, expected ${round2(total)} s`), { lasting: true });
      const path = `${id}/${now().toString(36)}.mp3`;
      await o.store.put(path, made.data);
      const dai = ((s.ads?.ads ?? []) as PlayAd[]).filter((a) => a.kind === "dai" && a.sure);
      const inf: CleanInfo = {
        v: 1, stage: "ready", episodeId: id, showId: String(s.showId || ""), path, bytes: made.data.length, secs: round2(made.secs), frames: made.frames,
        ads: carried(s, pieces),
        from: { how: String(s.ads?.how || ""), compared: Number(s.ads?.compared) || 0, cut: dai.length, cutSecs: round2(dai.reduce((a, d) => a + (d.e - d.s), 0)), copySecs: round2(X.time) },
        at: now(),
      };
      await o.kv.set(`clean:${id}`, inf);
      remember(id, inf);
      log(`[earshot] ad-free copy ${id}: ${Math.round(made.secs)} s, ${(made.data.length / 1048576).toFixed(1)} MB, ${dai.length} stitched-in ads cut (${Math.round(inf.from!.cutSecs)} s), ${inf.ads!.length} left to skip, ${now() - t0} ms`);
    } catch (e: any) {
      const err = String(e?.message || e).slice(0, 200);
      // A lasting problem (no audio, a wrong length, bigger than storage takes) waits 6 hours before
      // another try; storage being down, half an hour.
      const lasting = !!e?.lasting || /maximum allowed size|too large|payload|413/i.test(err);
      const inf: CleanInfo = { v: 1, stage: "failed", episodeId: id, showId: String(s.showId || ""), at: now(), err, retryAt: now() + (lasting ? 6 * 3600_000 : 30 * 60_000) };
      remember(id, inf);
      await o.kv.set(`clean:${id}`, inf).catch(() => {});
      console.warn(`[earshot] ad-free copy ${id} not made: ${err}`);
    } finally { s.streams--; building.delete(id); }
  }

  const cleaner = { info, url, ready, offer, isBuilding: (id: string) => building.has(id) || queue.some((q) => q.episodeId === id), idle: () => !running && !queue.length };
  o.player.setOnFinal((s) => offer(s));
  o.player.setCleanSource(async (episodeId) => {
    const i = await info(episodeId);
    if (!i || i.stage !== "ready") return null;
    const u = await url(i);
    return u ? { url: u.url, showId: i.showId, ads: i.ads ?? [] } : null;
  });
  attached.set(o.player, cleaner);
  return cleaner;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/** GET <prefix>/clean/<episode>: the episode's ad-free copy, when it has one (the player then plays
 *  it straight from storage, with its session id for read along and the ads still in it). */
export function registerCleanRoutes(app: any, auth: any, d: { prefix: string; cleaner: Cleaner; cleanId: (v: unknown) => string }) {
  app.get(`${d.prefix}/clean/:episodeId`, auth, async (req: any, res: any) => {
    const id = d.cleanId(req.params.episodeId);
    res.set("Cache-Control", "no-store");
    if (!id) return res.status(400).json({ message: "That isn't an episode." });
    try {
      const r = await d.cleaner.ready(id);
      if (!r) return res.json({ ready: false, building: d.cleaner.isBuilding(id) });
      res.json({ ready: true, ...r });
    } catch { res.json({ ready: false }); }
  });
}

// ---------------------------------------------------------------------------
// Made before anyone presses play
// ---------------------------------------------------------------------------

/** Episodes about to be seen (the next ones in the swipe feed, the home page's lists) are fetched the
 *  way a listener's phone would, compared, made into ad-free copies and read along in full, so even the
 *  first listener hears no ads. Two at a time; each episode once (a copy made already is skipped). */
export function createPrecleaner(o: {
  player: Player; cleaner: Cleaner; dir?: any;
  listenerUa?: string; atOnce?: number; maxQueue?: number;
  /** How long one episode may take (download, compare, read along). */
  maxMs?: number;
}) {
  const ua = o.listenerUa ?? "AppleCoreMedia/1.0.0.22A3354 (iPhone; U; CPU OS 18_0 like Mac OS X; en_us)";
  const atOnce = o.atOnce ?? 2, maxQueue = o.maxQueue ?? 40, maxMs = o.maxMs ?? 6 * 60_000;
  const queue: { episodeId: string; showId: string; url: string }[] = [];
  const seen = new Map<string, number>();
  let running = 0;
  const stats = { made: 0, skipped: 0 };
  const pump = () => {
    while (running < atOnce && queue.length) {
      const job = queue.shift()!;
      running++;
      void run(job).catch((e: any) => console.warn("[earshot] pre-clean:", e?.message || e)).finally(() => { running--; pump(); });
    }
  };
  async function run(job: { episodeId: string; showId: string; url: string }) {
    if ((await o.cleaner.info(job.episodeId))?.stage === "ready" || o.cleaner.isBuilding(job.episodeId)) { stats.skipped++; return; }
    // A listener already has it open: their copy is made into the ad-free one.
    if (Array.from(o.player.sessions.values()).some((x: any) => x.episodeId === job.episodeId && !x.clean)) { stats.skipped++; return; }
    const sid = `prep${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const s: any = o.player.open({ sid, voter: "prep", episodeId: job.episodeId, showId: job.showId, url: job.url, ua, ip: "" });
    const t0 = Date.now();
    try {
      while (Date.now() - t0 < maxMs && !s.ads.final && !s.copy.err && o.player.sessions.has(sid)) { s.touched = Date.now(); await s.copy.wait(1000); }
      if (!s.ads.final || !s.copy.done) return;
      // The opening is read right after comparing (and the ad-free copy made); then the rest of it.
      while (Date.now() - t0 < maxMs && s.opening !== "done" && o.player.sessions.has(sid)) { s.touched = Date.now(); await new Promise((r) => setTimeout(r, 1000)); }
      if (o.dir && o.player.sessions.has(sid)) await readWhole(o.player, o.dir, s).catch(() => 0);
      for (let i = 0; i < 30 && o.cleaner.isBuilding(job.episodeId); i++) await new Promise((r) => setTimeout(r, 1000));
      stats.made++;
    } finally { o.player.close(sid); }
  }
  /** Asks for these episodes to be made ready; returns how many were queued. */
  function want(list: { episodeId: string; showId: string; url: string }[]): number {
    let n = 0;
    const now = Date.now();
    for (const j of list) {
      if (!j.episodeId || !j.url || queue.length >= maxQueue) continue;
      if (now - (seen.get(j.episodeId) ?? 0) < 6 * 3600_000) continue;
      seen.set(j.episodeId, now);
      if (seen.size > 5000) seen.delete(seen.keys().next().value as string);
      queue.push(j); n++;
    }
    pump();
    return n;
  }
  return { want, stats, busy: () => running + queue.length };
}
export type Precleaner = ReturnType<typeof createPrecleaner>;

/** POST <prefix>/clean/prepare {episodes: [{id, showId, audio}]}: up to 8 episodes about to be seen,
 *  made ready before anyone plays them (their addresses are checked against the show's own lists). */
export function registerPrepareRoute(app: any, auth: any, d: { prefix: string; pre: Precleaner; cleanId: (v: unknown) => string; voterOf: (req: any) => string;
  audioFor: (showId: string, episodeId: string, sent?: string) => Promise<string | null> }) {
  const asked = new Map<string, number[]>();
  app.post(`${d.prefix}/clean/prepare`, auth, async (req: any, res: any) => {
    const voter = d.voterOf(req), t = Date.now();
    const list = (asked.get(voter) ?? []).filter((x) => t - x < 3600_000);
    if (list.length >= 120) return res.json({ queued: 0 });
    list.push(t); asked.set(voter, list);
    if (asked.size > 5000) asked.clear();
    const items = (Array.isArray(req.body?.episodes) ? req.body.episodes : []).slice(0, 8);
    const jobs: { episodeId: string; showId: string; url: string }[] = [];
    for (const it of items) {
      const episodeId = d.cleanId(it?.id), showId = d.cleanId(it?.showId);
      if (!episodeId || !showId) continue;
      const url = await d.audioFor(showId, episodeId, typeof it?.audio === "string" ? it.audio.slice(0, 1500) : "").catch(() => null);
      if (url && !/\.(m4a|mp4|aac|m4b|ogg|opus|wav|flac|webm)(\?|$)/i.test(url)) jobs.push({ episodeId, showId, url });
    }
    res.json({ queued: d.pre.want(jobs) });
  });
}
