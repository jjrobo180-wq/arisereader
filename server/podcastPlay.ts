// Playback through this server (Earshot + Podscroll), so ads can be found in each listener's own copy.
//
// Podcast hosts stitch different ads into every download. So the listener's audio comes through
// here: the server downloads their copy (with their user agent and address, so the host picks ads
// as it normally would), keeps it in a temp file and streams it to their player, reading its MP3
// frames as it goes. It also downloads comparison copies as a bot (bots aren't counted as listens,
// and many hosts leave the ads out for them) and uses other listeners' copies of the same episode.
// The show is the same bytes in every copy, so lining the copies up frame by frame shows exactly
// which parts of this listener's copy were stitched in (to ~26 ms), and the player skips them.
//
// Audio URLs carry a signed play token instead of a login (an audio element can't send headers):
// GET <prefix>/audio/<session>?e=<episode>&s=<show>&k=<token>. The ads for a session come from
// GET <prefix>/play/<session>/ads.
import { mkdirSync, promises as fsp, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { Mp3Scanner, alignCopies, contentPieces, copyToCt, coverage, ctToCopy, findKeys, keyAt, unmatched, type ContentPiece, type Span } from "../shared/earshotAudio";
import type { PlayAd } from "../shared/earshotAds";
import type { AdRange, TranscriptChunk } from "../shared/earshot";
import { fetchCopy } from "./podcastCopies";
import type { AnchorPiece, ContentChunk, Directory } from "./podcastDirectory";

// ---------------------------------------------------------------------------
// Copies being downloaded
// ---------------------------------------------------------------------------

/** A copy arriving from the host, with its frames read as it comes in. */
export class LiveCopy {
  scanner = new Mp3Scanner();
  bytes = 0; written = 0; total = 0; type = ""; status = 0;
  headers = false; done = false; err = "";
  finalHost = "";
  private waiters = new Set<() => void>();
  wake() { if (!this.waiters.size) return; const w = Array.from(this.waiters); this.waiters.clear(); for (const f of w) f(); }
  /** Resolves on the next change (more bytes, headers, done) or after ms. */
  wait(ms: number) {
    return new Promise<void>((resolve) => {
      const f = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(() => { this.waiters.delete(f); resolve(); }, ms);
      this.waiters.add(f);
    });
  }
  async until(test: () => boolean, ms: number) {
    const end = Date.now() + ms;
    while (!test() && Date.now() < end) await this.wait(Math.min(1000, end - Date.now()));
    return test();
  }
}

export type Downloader = typeof fetchCopy;

function startCopy(download: Downloader, url: string, o: { ua: string; forwardedFor?: string; file?: string; signal: AbortSignal; maxBytes: number }, copy: LiveCopy, onChange: () => void) {
  void download(url, {
    ua: o.ua, forwardedFor: o.forwardedFor, file: o.file, signal: o.signal, maxBytes: o.maxBytes,
    onHeaders: (status, length, type) => { copy.status = status; copy.total = status >= 200 && status < 300 ? length : 0; copy.type = type; copy.headers = true; copy.wake(); },
    onProgress: (bytes) => { copy.bytes = bytes; if (!o.file) copy.written = bytes; copy.wake(); onChange(); },
    onWritten: (bytes) => { copy.written = bytes; copy.wake(); },
  }, copy.scanner).then(({ info }) => {
    copy.err = info.err || (info.status && (info.status < 200 || info.status >= 300) ? `status ${info.status}` : "");
    copy.status = info.status; copy.bytes = info.bytes; if (!o.file) copy.written = info.bytes;
    try { copy.finalHost = new URL(info.finalUrl).host; } catch { /* none */ }
    if (!copy.total && !copy.err) copy.total = info.bytes;
    copy.done = true; copy.headers = true;
    copy.scanner.compact();
    copy.wake(); onChange();
  });
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const PLAY_TOKEN_HOURS = 12;
function playKey(): Buffer {
  const source = process.env.EARSHOT_PLAY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MAILBOX_ENCRYPTION_KEY || "";
  // Without a configured secret, tokens last until the server restarts (players then fall back to direct play).
  return Buffer.from(hkdfSync("sha256", source || `${process.pid}:${Date.now()}:${Math.random()}`, "arise-earshot", "earshot-play-v1", 32));
}
const VOTER = /^[A-Za-z0-9_-]{1,48}$/;
export function makePlayToken(key: Buffer, voter: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + PLAY_TOKEN_HOURS * 3600;
  const sig = createHmac("sha256", key).update(`play:${exp}:${voter}`).digest("base64url").slice(0, 27);
  return { token: `${exp}.${voter}.${sig}`, exp };
}
export function checkPlayToken(key: Buffer, token: string, now = Date.now()): string | null {
  const m = /^(\d{9,11})\.([A-Za-z0-9_-]{1,48})\.([A-Za-z0-9_-]{27})$/.exec(token || "");
  if (!m || Number(m[1]) * 1000 < now) return null;
  const want = Buffer.from(createHmac("sha256", key).update(`play:${m[1]}:${m[2]}`).digest("base64url").slice(0, 27));
  const got = Buffer.from(m[3]);
  return want.length === got.length && timingSafeEqual(want, got) ? m[2] : null;
}

// ---------------------------------------------------------------------------
// Sessions and comparison copies
// ---------------------------------------------------------------------------

export type SessionAds = {
  /** Ads are known for the start of the copy at least. */
  ready: boolean;
  /** The whole copy has been compared; nothing more will be found by comparing. */
  final: boolean;
  /** Where the show starts (after a pre-roll), when the copy starts with an ad. */
  startAt?: number;
  ads: PlayAd[];
  how: "pending" | "diff" | "same" | "noref" | "mismatch" | "notmp3" | "failed";
  /** Copies this one was compared with. */
  compared: number;
  dur?: number;
};

type Session = {
  id: string; voter: string; episodeId: string; showId: string; url: string;
  created: number; touched: number; streams: number;
  file: string; copy: LiveCopy; abort: AbortController;
  ads: SessionAds;
  headTried: number;
  analyzedWith: string;
  /** The copy's show audio with its stitched-in ads left out (content time), once it's compared. */
  content?: { tag: string; pieces: ContentPiece[]; total: number };
  /** Ads from read-along pieces, placed in this copy (redone when new pieces arrive). */
  mapped?: { tag: string; ads: PlayAd[] };
  /** The opening's read along (and its ads) being made right after comparing. */
  opening?: "running" | "done";
  /** Stretches of this copy's show audio no read-along piece covers (an ad the host gave this copy and
   *  the comparison copies alike, where the piece's copy had another), read on their own for ads. */
  gaps?: { running: boolean; done: Set<string>; secs: number; ads: PlayAd[] };
};
/** Reads one stretch of a copy (transcribed and checked for ads, kept for everyone by its fingerprint);
 *  its ads in seconds from the stretch's start. */
export type GapReader = (fp: string, audio: Blob, secs: number) => Promise<AdRange[] | null>;
type Ref = { agent: string; copy: LiveCopy; abort: AbortController };
type EpisodeRefs = { episodeId: string; url: string; refs: Ref[]; used: number; extra: boolean };

export interface PlayOptions {
  dir?: string;
  maxDiskBytes?: number;
  maxSessions?: number;
  maxPerVoter?: number;
  maxCopyBytes?: number;
  /** Bot agents for the first comparison copy, and the extras fetched when the first wasn't enough. */
  firstAgents?: string[];
  extraAgents?: string[];
  download?: Downloader;
  key?: Buffer;
  now?: () => number;
}

const SID = /^[A-Za-z0-9_-]{16,48}$/;
const round2 = (x: number) => Math.round(x * 100) / 100;
/** Ad breaks found by comparing longer than this are offered, not skipped by themselves. */
const MAX_SURE_AD = 8 * 60;

export function createPlayer(o: PlayOptions = {}) {
  const dir = o.dir ?? join(tmpdir(), "earshot-play");
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* fresh start */ }
  mkdirSync(dir, { recursive: true });
  const maxDisk = o.maxDiskBytes ?? 1.2 * 1024 ** 3;
  const maxSessions = o.maxSessions ?? 24;
  const maxPerVoter = o.maxPerVoter ?? 12;
  const maxCopy = o.maxCopyBytes ?? 400 * 1024 * 1024;
  const firstAgents = o.firstAgents ?? ["bot"];
  const extraAgents = o.extraAgents ?? ["bot2", "bot3"];
  const download = o.download ?? fetchCopy;
  const key = o.key ?? playKey();
  const now = o.now ?? Date.now;

  const sessions = new Map<string, Session>();
  let onFinal: ((s: Session) => void) | null = null;
  const episodes = new Map<string, EpisodeRefs>();

  // ---- disk and memory ----
  function dropSession(s: Session) {
    sessions.delete(s.id);
    s.abort.abort();
    void fsp.rm(s.file, { force: true }).catch(() => {});
  }
  function dropEpisode(e: EpisodeRefs) { episodes.delete(e.episodeId); for (const r of e.refs) r.abort.abort(); }
  function diskUsed() { let n = 0; sessions.forEach((s) => { n += s.copy.bytes; }); return n; }
  function tidy() {
    const t = now();
    sessions.forEach((s) => { if (!s.streams && t - s.touched > 30 * 60_000) dropSession(s); });
    episodes.forEach((e) => { if (t - e.used > 40 * 60_000 && !Array.from(sessions.values()).some((s) => s.episodeId === e.episodeId)) dropEpisode(e); });
    // Over the disk budget or the session cap: the least recently used idle sessions go first.
    const idle = () => Array.from(sessions.values()).filter((s) => !s.streams).sort((a, b) => a.touched - b.touched);
    for (const s of idle()) { if (diskUsed() <= maxDisk && sessions.size <= maxSessions) break; dropSession(s); }
    if (episodes.size > 10) Array.from(episodes.values()).sort((a, b) => a.used - b.used).slice(0, episodes.size - 10).forEach((e) => { if (!Array.from(sessions.values()).some((s) => s.episodeId === e.episodeId)) dropEpisode(e); });
  }
  const timer = setInterval(tidy, 60_000); (timer as any).unref?.();

  // ---- comparison copies ----
  function refsFor(episodeId: string, url: string) {
    let e = episodes.get(episodeId);
    if (!e || e.url !== url) {
      if (e) dropEpisode(e);
      e = { episodeId, url, refs: [], used: now(), extra: false };
      episodes.set(episodeId, e);
      for (const agent of firstAgents) addRef(e, agent);
    }
    e.used = now();
    return e;
  }
  function addRef(e: EpisodeRefs, agent: string) {
    const ref: Ref = { agent, copy: new LiveCopy(), abort: new AbortController() };
    e.refs.push(ref);
    startCopy(download, e.url, { ua: agent, signal: ref.abort.signal, maxBytes: maxCopy }, ref.copy, () => {
      if (ref.copy.done) sessions.forEach((s) => { if (s.episodeId === e.episodeId) schedule(s); });
      else sessions.forEach((s) => { if (s.episodeId === e.episodeId && !s.ads.ready) schedule(s); });
    });
  }

  // ---- finding the ads ----
  const pending = new Set<Session>();
  let running = false;
  function schedule(s: Session) {
    pending.add(s);
    if (running) return;
    running = true;
    setImmediate(async () => {
      try {
        while (pending.size) {
          const next = pending.values().next().value as Session;
          pending.delete(next);
          if (sessions.has(next.id)) await analyze(next);
          if (next.ads.final && next.copy.scanner.count && !next.opening && onFinal) { next.opening = "running"; onFinal(next); }
        }
      } finally { running = false; }
    });
  }
  const yieldNow = () => new Promise<void>((r) => setImmediate(r));

  /** Other copies of this episode that are complete and good for comparing with. */
  function comparisons(s: Session) {
    const e = episodes.get(s.episodeId);
    const out: { id: string; sc: Mp3Scanner; done: boolean }[] = [];
    for (const r of e?.refs ?? []) if (!r.copy.err && r.copy.scanner.count) out.push({ id: `r:${r.agent}`, sc: r.copy.scanner, done: r.copy.done });
    sessions.forEach((o) => { if (o !== s && o.episodeId === s.episodeId && o.copy.done && !o.copy.err && o.copy.scanner.count) out.push({ id: `s:${o.id}`, sc: o.copy.scanner, done: true }); });
    return out.slice(0, 5);
  }

  async function analyze(s: Session) {
    const X = s.copy.scanner;
    const e = episodes.get(s.episodeId);
    if (!X.count) {
      // No MP3 frames: not an MP3 (once well past any cover art at the start), or it didn't download.
      if (s.copy.done || s.copy.bytes > X.tagEnd + 512 * 1024) s.ads = { ...s.ads, ready: true, final: true, how: s.copy.err ? "failed" : "notmp3" };
      return;
    }
    const comps = comparisons(s);
    const refsDone = (e?.refs ?? []).every((r) => r.copy.done);

    // The start first: a pre-roll found here is skipped before it plays.
    if (!s.ads.ready && comps.length && X.count) {
      const xEnough = s.copy.done || X.time >= 240;
      const ready = comps.filter((c) => c.done || c.sc.time >= 150);
      // Tried again once a minute more of either copy is in (each try lines up both starts).
      const grown = X.time + ready.reduce((a, c) => a + c.sc.time, 0);
      if (xEnough && ready.length && (s.copy.done || grown - s.headTried >= 60)) {
        s.headTried = grown;
        let start = 0, found = false;
        for (const c of ready) {
          const runs = alignCopies(X.hashes, X.count, c.sc.hashes, c.sc.count);
          if (!runs.length) continue;
          found = true;
          const first = X.timeOf(runs[0].a);
          if (first >= 4) start = Math.max(start, first);
          await yieldNow();
        }
        if (found || s.copy.done || X.time > 600) {
          s.ads = { ...s.ads, ready: true, startAt: start >= 4 && start <= 600 ? round2(start) : undefined, ads: start >= 4 && start <= 600 ? [daiAd(s, { s: 0, e: start })] : [], compared: ready.length, dur: s.copy.done ? round2(X.time) : undefined };
        }
      }
    }

    // The whole copy, once it and the comparison copies are in.
    if (!s.copy.done || !comps.length) {
      if (s.copy.done && refsDone && !comps.length) s.ads = { ...s.ads, ready: true, final: true, how: "noref", dur: round2(X.time) };
      return;
    }
    const doneComps = comps.filter((c) => c.done);
    const tag = doneComps.map((c) => c.id).join(",");
    if (!doneComps.length || tag === s.analyzedWith) return;
    s.analyzedWith = tag;
    const regions: Span[] = [];
    let usable = 0, identical = 0, refHasOwn = false;
    for (const c of doneComps) {
      const runs = alignCopies(X.hashes, X.count, c.sc.hashes, c.sc.count);
      const tx = (i: number) => X.timeOf(i), tc = (i: number) => c.sc.timeOf(i);
      const covC = coverage(runs, "b", c.sc.count, tc), covX = coverage(runs, "a", X.count, tx);
      await yieldNow();
      if (covC < 0.6 || covX < 0.35) continue; // a different version of the episode, or a broken copy
      usable++;
      const mine = unmatched(runs, "a", X.count, tx);
      if (!mine.length) identical++;
      if (c.id.startsWith("r:") && unmatched(runs, "b", c.sc.count, tc).length) refHasOwn = true;
      regions.push(...mine);
    }
    const merged = mergeSpans(regions);
    const ads = merged.map((r) => daiAd(s, r));
    s.ads = {
      ready: true,
      final: refsDone && (!!e?.extra || !needExtra(identical, usable, refHasOwn)),
      startAt: merged.length && merged[0].s < 0.5 && merged[0].e - merged[0].s <= MAX_SURE_AD ? round2(merged[0].e) : undefined,
      ads, how: !usable ? "mismatch" : merged.length ? "diff" : "same", compared: usable, dur: round2(X.time),
    };
    // Bots got ads too, or every copy was the same: a few more comparison copies (other bot agents).
    if (e && refsDone && !e.extra && needExtra(identical, usable, refHasOwn)) { e.extra = true; for (const a of extraAgents) addRef(e, a); }
  }
  const needExtra = (identical: number, usable: number, refHasOwn: boolean) => usable > 0 && (refHasOwn || identical === usable);
  function daiAd(s: Session, r: Span): PlayAd {
    const long = r.e - r.s > MAX_SURE_AD;
    return { key: `d:${s.episodeId}:${Math.round(r.s)}:${Math.round(r.e)}`, s: round2(r.s), e: round2(r.e), label: r.s < 0.5 ? "Pre-roll" : "Ad break", kind: "dai", sure: !long };
  }

  // ---- content time: this copy's show audio with its stitched-in ads left out ----
  function contentOf(s: Session) {
    const X = s.copy.scanner;
    const cuts = s.ads.ads.filter((a) => a.kind === "dai" && a.sure).map((a) => ({ s: a.s, e: a.e }));
    const tag = `${X.count}|${cuts.map((c) => `${c.s}-${c.e}`).join(",")}`;
    if (s.content?.tag !== tag) s.content = { tag, ...contentPieces(X.count, (i) => X.timeOf(i), (t) => X.frameAt(t), cuts) };
    return s.content;
  }
  /** The audio for content time [from, to) of this copy as one MP3, with keys that find each piece in other copies. */
  async function extract(s: Session, from: number, to: number): Promise<{ audio: Blob; pieces: AnchorPiece[] }> {
    const X = s.copy.scanner, { pieces } = contentOf(s);
    const ranges: [number, number][] = [], out: AnchorPiece[] = [];
    const step = Math.max(1, Math.round(20 / ((X.timeOf(X.count) / Math.max(1, X.count)) || 0.026)));
    for (const p of pieces) {
      const lo = Math.max(from, p.ct), hi = Math.min(to, p.ct + p.len);
      if (hi - lo < 0.05) continue;
      const f0 = Math.max(p.f0, X.frameAt(p.x + (lo - p.ct))), f1 = Math.min(p.f1, X.frameAt(p.x + (hi - p.ct) - 1e-4) + 1);
      if (f1 <= f0) continue;
      ranges.push([X.offsets[f0], f1 < X.count ? X.offsets[f1] : s.copy.written]);
      const keys: [number, number][] = [];
      for (let i = f0; i + 8 <= f1; i += step) keys.push([Math.round((p.ct + X.timeOf(i) - p.x) * 1000) / 1000, keyAt(X.hashes, i)]);
      if (f1 - 8 > f0 + step / 2) keys.push([Math.round((p.ct + X.timeOf(f1 - 8) - p.x) * 1000) / 1000, keyAt(X.hashes, f1 - 8)]);
      out.push({ ct: Math.round((p.ct + X.timeOf(f0) - p.x) * 1000) / 1000, len: Math.round((X.timeOf(f1) - X.timeOf(f0)) * 1000) / 1000, keys });
    }
    const size = ranges.reduce((a, r) => a + (r[1] - r[0]), 0);
    const buf = Buffer.allocUnsafe(size);
    const fh = await fsp.open(s.file, "r");
    try { let at = 0; for (const [a, b] of ranges) { const { bytesRead } = await fh.read(buf, at, b - a, a); at += bytesRead; } }
    finally { await fh.close().catch(() => {}); }
    return { audio: new Blob([buf], { type: "audio/mpeg" }), pieces: out };
  }
  /** Moves content times (from a read-along piece) into this copy, using the piece's frame keys
   *  (exact in any copy) or else this copy's own content time. */
  function placer(s: Session, chunks: { pieces: AnchorPiece[] }[]) {
    const X = s.copy.scanner, { pieces: mine } = contentOf(s);
    const all = chunks.flatMap((c) => c.pieces);
    const found = findKeys(X.hashes, X.count, new Set(all.flatMap((p) => p.keys.map((k) => k[1]))));
    const placed = all.map((p) => ({ p, at: p.keys.filter((k) => found.has(k[1])).map((k) => ({ ct: k[0], x: X.timeOf(found.get(k[1])!) })) }));
    const at = (ct: number): number | null => {
      const hit = placed.find((q) => ct >= q.p.ct - 0.05 && ct <= q.p.ct + q.p.len + 0.05);
      if (hit && hit.at.length) {
        let best = hit.at[0];
        for (const a of hit.at) if (a.ct <= ct && (best.ct > ct || a.ct > best.ct)) best = a;
        return Math.max(0, best.x + (ct - best.ct));
      }
      return ctToCopy(mine, ct);
    };
    // For ad edges: counted forward from the nearest moment found before, and back from the nearest
    // found after. Where they disagree, this copy lacks some of what's in between (another copy's
    // stitched-in promo, say), and the edge that keeps more of the show wins.
    const sorted = placed.flatMap((q) => q.at).sort((a, b) => a.ct - b.ct);
    const edges = (ct: number) => {
      let prev: { ct: number; x: number } | null = null, next: { ct: number; x: number } | null = null;
      for (const a of sorted) { if (a.ct <= ct) prev = a; else { next = a; break; } }
      return { fwd: prev ? prev.x + (ct - prev.ct) : null, bwd: next ? next.x - (next.ct - ct) : null };
    };
    const adStart = (ct: number) => { const { fwd, bwd } = edges(ct); const v = fwd !== null && bwd !== null ? Math.max(fwd, bwd) : fwd ?? bwd ?? at(ct); return v === null ? null : Math.max(0, v); };
    const adEnd = (ct: number) => { const { fwd, bwd } = edges(ct); const v = fwd !== null && bwd !== null ? Math.min(fwd, bwd) : fwd ?? bwd ?? at(ct); return v === null ? null : Math.max(0, v); };
    return Object.assign(at, { adStart, adEnd });
  }
  /** Show audio in this copy (stitched-in ads aside) inside the span the read-along pieces cover, that
   *  none of them has: another listener's copy had a different ad there (or none). Each stretch comes
   *  with a fingerprint, so a stretch already read for someone else is used again. */
  function uncovered(s: Session, chunks: { pieces: AnchorPiece[]; more?: boolean }[]): (Span & { fp: string })[] {
    const X = s.copy.scanner;
    const all = chunks.flatMap((c) => c.pieces ?? []);
    if (!all.length || !X.count) return [];
    const found = findKeys(X.hashes, X.count, new Set(all.flatMap((p) => p.keys.map((k) => k[1]))));
    type Iv = { x0: number; x1: number; c0: number; c1: number };
    const ivs: Iv[] = [];
    for (const p of all) {
      const hits = p.keys.map((k) => (found.has(k[1]) ? { ct: k[0], x: X.timeOf(found.get(k[1])!) } : null));
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i]; if (!h) continue;
        const n = hits[i + 1];
        // Two neighbouring keys the same distance apart here as in the piece: everything between is the piece's audio.
        if (n && n.x > h.x && Math.abs((n.x - h.x) - (n.ct - h.ct)) < 0.5) ivs.push({ x0: h.x, x1: n.x + 0.2, c0: h.ct, c1: n.ct + 0.2 });
        else ivs.push({ x0: h.x, x1: h.x + 0.2, c0: h.ct, c1: h.ct + 0.2 });
      }
    }
    if (!ivs.length) return [];
    ivs.sort((a, b) => a.x0 - b.x0);
    const cov: Iv[] = [];
    for (const v of ivs) { const l = cov[cov.length - 1]; if (l && v.x0 <= l.x1 + 0.5) { l.x1 = Math.max(l.x1, v.x1); l.c0 = Math.min(l.c0, v.c0); l.c1 = Math.max(l.c1, v.c1); } else cov.push({ ...v }); }
    // The content time the pieces span.
    const spans = mergeSpans(all.map((p) => ({ s: p.ct, e: p.ct + p.len })));
    const inPieces = (a: number, b: number) => spans.some((r) => r.s - 1 <= a && b <= r.e + 1);
    const { total } = contentOf(s);
    const raw: Span[] = [];
    // Before the first covered moment, when the pieces start at the show's start.
    if (spans[0].s < 1 && cov[0].c0 < 600) raw.push({ s: 0, e: cov[0].x0 });
    for (let i = 0; i + 1 < cov.length; i++) {
      const a = cov[i], b = cov[i + 1];
      if (b.x0 - a.x1 < 6) continue;
      if (inPieces(Math.min(a.c1, b.c0), Math.max(a.c1, b.c0))) raw.push({ s: a.x1, e: b.x0 });
    }
    const last = cov[cov.length - 1];
    if (spans[spans.length - 1].e >= total - 1 && chunks.some((c) => c.more === false)) raw.push({ s: last.x1, e: X.time });
    // Stitched-in ads are known already.
    const cuts = mergeSpans(s.ads.ads.filter((a) => a.kind === "dai").map((a) => ({ s: a.s, e: a.e })));
    const out: (Span & { fp: string })[] = [];
    for (const r of raw) {
      let pieces: Span[] = [{ ...r }];
      for (const c of cuts) pieces = pieces.flatMap((p) => (c.e <= p.s || c.s >= p.e ? [p] : [{ s: p.s, e: c.s }, { s: c.e, e: p.e }]));
      for (const p of pieces) {
        if (p.e - p.s < 6 || p.e - p.s > 600) continue;
        const f = Math.min(X.frameAt(p.s), Math.max(0, X.count - 8));
        out.push({ s: round2(p.s), e: round2(p.e), fp: `${keyAt(X.hashes, f).toString(36)}${Math.round(p.e - p.s)}` });
      }
    }
    return out;
  }
  /** Copy time [a, b) as one MP3. */
  async function extractCopy(s: Session, a: number, b: number): Promise<Blob> {
    const X = s.copy.scanner;
    const f0 = X.frameAt(a), f1 = Math.min(X.count, X.frameAt(b) + 1);
    const lo = X.offsets[f0], hi = f1 < X.count ? X.offsets[f1] : s.copy.written;
    const buf = Buffer.allocUnsafe(Math.max(0, hi - lo));
    const fh = await fsp.open(s.file, "r");
    try { await fh.read(buf, 0, buf.length, lo); } finally { await fh.close().catch(() => {}); }
    return new Blob([buf], { type: "audio/mpeg" });
  }
  /** Reads the stretches no piece covers (at most 20 minutes a copy) and keeps the ads found in them. */
  async function readGaps(s: Session, chunks: { pieces: AnchorPiece[]; more?: boolean }[], read: GapReader) {
    if (!s.copy.done || !s.ads.final || !s.copy.scanner.count) return;
    const g = (s.gaps ??= { running: false, done: new Set(), secs: 0, ads: [] });
    if (g.running) return;
    g.running = true;
    try {
      for (const sp of uncovered(s, chunks)) {
        const id = `${Math.round(sp.s)}-${Math.round(sp.e)}`, len = sp.e - sp.s;
        if (g.done.has(id) || g.secs + len > 1200 || !sessions.has(s.id)) continue;
        g.done.add(id); g.secs += len;
        const ads = await read(sp.fp, await extractCopy(s, sp.s, sp.e), len).catch(() => null);
        for (const r of ads ?? []) {
          // Edges near the stretch's own edges are its edges (the show, or a known ad, is right there).
          let a = sp.s + r.s, b = sp.s + r.e;
          if (a - sp.s < 4) a = sp.s;
          if (sp.e - b < 4) b = sp.e;
          if (b - a < 3) continue;
          g.ads.push({ key: `g:${s.episodeId}:${Math.round(a)}:${Math.round(b)}`, s: round2(a), e: round2(b), label: r.label || "Ad break", kind: (r.kind as PlayAd["kind"]) || "ai", sure: (r.conf ?? 0.8) >= 0.75 });
        }
      }
    } finally { g.running = false; }
  }
  /** A read-along piece in this copy's time. */
  function inCopy(s: Session, c: ContentChunk): TranscriptChunk {
    const at = placer(s, [c]);
    const segments = c.segments.map((g) => { const a = at(g.s), b = at(g.e); return a === null || b === null ? null : { s: Math.round(a * 100) / 100, e: Math.round(Math.max(a, b) * 100) / 100, t: g.t }; }).filter((g): g is NonNullable<typeof g> => !!g);
    const ads = c.ads.map((r) => placeAd(at, r)).filter((r): r is AdRange => !!r);
    const chapters = c.chapters.map((h) => { const a = at(h.s); return a === null ? null : { s: Math.round(a), title: h.title }; }).filter((h): h is NonNullable<typeof h> => !!h);
    const { pieces: _p, words: _w, v: _v, ...rest } = c as any;
    return { ...rest, segments, ads: [...ads, ...(s.gaps?.ads ?? [])].sort((x, y) => x.s - y.s), chapters, dur: Math.round(s.copy.scanner.time * 100) / 100, durMode: "exact" };
  }
  const placeAd = (at: ReturnType<typeof placer>, r: AdRange): AdRange | null => {
    const a = at.adStart(r.s), b = at.adEnd(r.e);
    if (a === null || b === null || b - a < 1 || b - a > (r.e - r.s) + 600) return null;
    return { ...r, s: Math.round(a * 100) / 100, e: Math.round(b * 100) / 100 };
  };
  /** Ads found in the episode's read-along pieces, placed in this copy (sure ones skip by themselves). */
  async function transcriptAds(s: Session, dir: Pick<Directory, "contentChunks"> & Partial<Pick<Directory, "copyPieceAds">>): Promise<PlayAd[]> {
    if (!s.copy.done || !s.ads.final) return [];
    const every = await dir.contentChunks(s.episodeId);
    // Pieces made since (read along): what they don't cover in this copy is read too.
    if (dir.copyPieceAds && s.opening === "done" && !s.gaps?.running) {
      const reader = dir.copyPieceAds;
      void readGaps(s, every, (fp, audio, secs) => reader(s.showId, s.episodeId, fp, audio, secs)).catch(() => {});
    }
    const gapAds = s.gaps?.ads ?? [];
    const chunks = every.filter((c) => c.ads.length);
    const tag = `${contentOf(s).tag}#${chunks.map((c) => `${c.chunk}:${c.source}:${c.ads.length}`).join(",")}`;
    if (s.mapped?.tag === tag) return [...s.mapped.ads, ...gapAds];
    const ads: PlayAd[] = [];
    for (const c of chunks) {
      const at = placer(s, [c]);
      for (const r of c.ads) {
        const p = placeAd(at, r); if (!p) continue;
        ads.push({ key: `t:${s.episodeId}:${c.chunk}:${Math.round(r.s)}:${Math.round(r.e)}`, s: p.s, e: p.e, label: r.label || "Ad break", kind: (r.kind as PlayAd["kind"]) || "ai", sure: (r.conf ?? 0.8) >= 0.75 });
      }
    }
    s.mapped = { tag, ads };
    return [...ads, ...gapAds];
  }

  // ---- sessions ----
  function open(o: { sid: string; voter: string; episodeId: string; showId: string; url: string; ua: string; ip: string }) {
    let s = sessions.get(o.sid);
    if (s) { s.touched = now(); return s; }
    // A listener's oldest copies make room for new ones (never one used in the last few minutes: it may be
    // the episode they paused, and its player still holds that copy).
    const mine = Array.from(sessions.values()).filter((x) => x.voter === o.voter && !x.streams && now() - x.touched > 3 * 60_000).sort((a, b) => a.touched - b.touched);
    const count = Array.from(sessions.values()).filter((x) => x.voter === o.voter).length;
    for (const x of mine.slice(0, Math.max(0, count - maxPerVoter + 1))) dropSession(x);
    s = {
      id: o.sid, voter: o.voter, episodeId: o.episodeId, showId: o.showId, url: o.url,
      created: now(), touched: now(), streams: 0, file: join(dir, `${o.sid}.mp3`), copy: new LiveCopy(), abort: new AbortController(),
      ads: { ready: false, final: false, ads: [], how: "pending", compared: 0 }, headTried: -1e9, analyzedWith: "",
    };
    sessions.set(o.sid, s);
    const sess = s;
    refsFor(o.episodeId, o.url);
    startCopy(download, o.url, { ua: o.ua || "Mozilla/5.0", forwardedFor: o.ip || undefined, file: s.file, signal: s.abort.signal, maxBytes: maxCopy }, s.copy, () => schedule(sess));
    tidy();
    return s;
  }

  /** Streams bytes [start, end] of the session's file to res as they arrive. */
  async function pipe(s: Session, start: number, end: number, res: any, closed: () => boolean) {
    // The file exists once its first bytes are written.
    await s.copy.until(() => s.copy.written > start || s.copy.done || closed(), 30_000);
    if (s.copy.written <= start) return;
    const fh = await fsp.open(s.file, "r");
    const buf = Buffer.allocUnsafe(256 * 1024);
    try {
      let pos = start;
      while (pos <= end && !closed()) {
        if (pos >= s.copy.written) {
          if (s.copy.done) break;
          await s.copy.wait(30_000);
          if (pos >= s.copy.written && (s.copy.done || !sessions.has(s.id))) break;
          continue;
        }
        const n = Math.min(buf.length, s.copy.written - pos, end - pos + 1);
        const { bytesRead } = await fh.read(buf, 0, n, pos);
        if (!bytesRead) break;
        pos += bytesRead;
        s.touched = now();
        if (!res.write(Buffer.from(buf.subarray(0, bytesRead)))) await drained(res);
      }
    } finally { await fh.close().catch(() => {}); }
  }

  const close = (sid: string) => { const s = sessions.get(sid); if (s) dropSession(s); };
  /** A time in a session's copy as content time; inside a stitched-in ad, the show's edge next to it. */
  function toContent(sid: string, episodeId: string, x: number, side: "start" | "end"): number | null {
    const s = sessions.get(sid);
    if (!s || s.episodeId !== episodeId || !s.copy.done || !s.ads.final) return null;
    const { pieces } = contentOf(s);
    const ct = copyToCt(pieces, x);
    if (ct !== null) return ct;
    if (side === "start") { const p = pieces.find((q) => q.x >= x); return p ? p.ct : null; }
    const before = pieces.filter((q) => q.x + q.len <= x + 1e-6).pop();
    return before ? before.ct + before.len : null;
  }
  /** Content time placed in a session's copy. */
  const fromContent = (s: Session, ct: number) => ctToCopy(contentOf(s).pieces, ct);
  return { setOnFinal: (f: (s: Session) => void) => { onFinal = f; }, sessions, episodes, open, close, pipe, schedule, tidy, key, contentOf, extract, inCopy, transcriptAds, readGaps, uncovered, toContent, fromContent, checkToken: (t: string) => checkPlayToken(key, t, now()), token: (voter: string) => makePlayToken(key, voter, now()), stop: () => { clearInterval(timer); sessions.forEach(dropSession); episodes.forEach(dropEpisode); } };
}
export type Player = ReturnType<typeof createPlayer>;

/** Waits until a response can take more (or the listener left). */
function drained(res: any) {
  return new Promise<void>((resolve) => {
    const done = () => { res.off("drain", done); res.off("close", done); resolve(); };
    res.on("drain", done); res.on("close", done);
  });
}

/** Overlapping or touching ranges joined (gaps under half a second closed). */
export function mergeSpans(list: Span[]): Span[] {
  const sorted = list.slice().sort((a, b) => a.s - b.s);
  const out: Span[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.s <= last.e + 0.5) last.e = Math.max(last.e, r.e);
    else out.push({ s: r.s, e: r.e });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** bytes=a-b / bytes=a- / bytes=-n, for a file of `total` bytes. */
export function parseRange(header: string | undefined, total: number): { start: number; end: number } | null | "bad" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return "bad";
  let start: number, end: number;
  if (!m[1]) { const n = Number(m[2]); start = Math.max(0, total - n); end = total - 1; }
  else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1; }
  if (start >= total || end < start) return "bad";
  return { start, end };
}

/** Read along for a session's copy: made from (and placed in) this listener's copy, in content time
 *  shared by every copy. null when the session can't be used (the caller uses the old way). */
/** Right after a copy is compared, its opening (first 2.5 minutes) is transcribed and read for ads
 *  (host-read sponsors, the show's own pitches) so they're skipped before they play. Two at a time;
 *  made once per episode for everyone. */
export function startOpenings(player: Player, dir: Pick<Directory, "contentTranscript"> & Partial<Pick<Directory, "contentChunks" | "copyPieceAds">>) {
  const queue: any[] = [];
  let running = 0;
  const pump = () => {
    while (running < 2 && queue.length) {
      const s = queue.shift();
      if (!player.sessions.has(s.id)) { s.opening = "done"; continue; }
      running++;
      const { total } = player.contentOf(s);
      dir.contentTranscript(s.showId, s.episodeId, -1, { secs: total, extract: (from, to) => player.extract(s, from, to) })
        .then(async () => {
          // Then whatever in this copy the pieces don't have (its own ads at the start, mostly).
          if (!dir.contentChunks || !dir.copyPieceAds || !player.sessions.has(s.id)) return;
          const reader = dir.copyPieceAds;
          await player.readGaps(s, await dir.contentChunks(s.episodeId), (fp, audio, secs) => reader(s.showId, s.episodeId, fp, audio, secs));
        })
        .catch((e: any) => console.warn("[earshot] opening:", e?.message || e))
        .finally(() => { s.opening = "done"; running--; pump(); });
    }
  };
  player.setOnFinal((s) => { queue.push(s); pump(); });
}

export async function copyTranscript(player: Player, dir: Pick<Directory, "contentTranscript">, sid: string, showId: string, episodeId: string, chunk: number): Promise<TranscriptChunk | null> {
  const s = player.sessions.get(sid);
  if (!s || s.episodeId !== episodeId || s.copy.err) return null;
  // Its ads must be known first (they're left out of the show audio); comparing takes seconds.
  await s.copy.until(() => s.copy.done && s.ads.final, 25_000);
  if (!s.copy.done || !s.ads.final || !s.copy.scanner.count) return null;
  s.touched = Date.now();
  const { total } = player.contentOf(s);
  const c = await dir.contentTranscript(showId, episodeId, chunk, { secs: total, extract: (from, to) => player.extract(s, from, to) });
  return player.inCopy(s, c);
}

export type PlayRouteDeps = {
  prefix: string;
  player: Player;
  /** Read-along pieces already made (their ads are placed in each copy). */
  dir?: Pick<Directory, "contentChunks"> & Partial<Pick<Directory, "copyPieceAds">>;
  /** Listeners' marks and skips in content time, and everyone's votes (server/podcastAds.ts crowdFor). */
  crowd?: (episodeId: string) => Promise<{ marks: { key: string; s: number; e: number; label: string; support: number; voters: string[] }[]; skips: { key: string; s: number; e: number; support: number }[]; votes: { key: string; voter: string; vote: number }[] }>;
  /** The episode's audio address (from the directory). */
  audioFor: (showId: string, episodeId: string) => Promise<string | null>;
  voterOf: (req: any) => string;
  clientIp: (req: any) => string;
  cleanId: (v: unknown) => string;
};

export function registerPlayRoutes(app: any, auth: any, d: PlayRouteDeps) {
  const P = d.prefix, player = d.player;
  const opened = new Map<string, number[]>();
  const tooMany = (voter: string) => {
    const t = Date.now(), list = (opened.get(voter) || []).filter((x) => t - x < 3600_000);
    opened.set(voter, list);
    if (opened.size > 5000) opened.clear();
    if (list.length >= 300) return true;
    list.push(t); return false;
  };

  /** A play token for this listener's audio addresses (an audio element can't send a login). */
  app.get(`${P}/play-token`, auth, (req: any, res: any) => {
    const voter = d.voterOf(req);
    if (!VOTER.test(voter)) return res.status(400).json({ message: "Reload and try again." });
    res.set("Cache-Control", "no-store");
    res.json({ ...player.token(voter), audio: `${P}/audio/` });
  });

  const audio = async (req: any, res: any) => {
    const sid = String(req.params.sid || "");
    if (!SID.test(sid)) return res.status(404).end();
    let s = player.sessions.get(sid);
    if (!s) {
      const voter = player.checkToken(String(req.query?.k || ""));
      const episodeId = d.cleanId(req.query?.e), showId = d.cleanId(req.query?.s);
      if (!voter || !episodeId || !showId) return res.status(403).end();
      // A session the server let go (or lost in a restart) is made again with the same id; the player
      // keeps going (its copy may differ a little if the host stitched in different ads).
      if (tooMany(voter)) return res.status(429).end();
      let url: string | null = null;
      try { url = await d.audioFor(showId, episodeId); } catch { url = null; }
      if (!url) return res.status(404).end();
      s = player.open({ sid, voter, episodeId, showId, url, ua: String(req.headers["user-agent"] || "").slice(0, 300), ip: d.clientIp(req) });
    }
    s.touched = Date.now();
    const copy = s.copy;
    await copy.until(() => copy.headers || copy.done, 20_000);
    if (!copy.headers || (copy.err && !copy.written) || (copy.status && (copy.status < 200 || copy.status >= 300))) return res.status(502).end();
    // Without a length from the host, wait for the whole copy (players need the size to seek).
    if (!copy.total) await copy.until(() => copy.done, 60_000);
    const total = copy.total || copy.written;
    if (!total) return res.status(502).end();
    const range = parseRange(req.headers.range, total);
    const type = copy.scanner.count || !/^(audio|video)\//i.test(copy.type) ? "audio/mpeg" : copy.type;
    res.set({ "Accept-Ranges": "bytes", "Content-Type": type, "Cache-Control": "no-store" });
    if (range === "bad") { res.set("Content-Range", `bytes */${total}`); return res.status(416).end(); }
    const start = range ? range.start : 0, end = range ? range.end : total - 1;
    if (range) { res.status(206); res.set("Content-Range", `bytes ${start}-${end}/${total}`); }
    res.set("Content-Length", String(end - start + 1));
    if (req.method === "HEAD") return res.end();
    let closed = false;
    req.on("close", () => { closed = true; });
    s.streams++;
    try { await player.pipe(s, start, end, res, () => closed); }
    catch { /* client went away */ }
    finally { s.streams--; s.touched = Date.now(); res.end(); }
  };
  app.get(`${P}/audio/:sid`, audio);
  app.head(`${P}/audio/:sid`, audio);

  /** What's known about the ads in this session's copy (polled while it's compared). */
  app.get(`${P}/play/:sid/ads`, auth, async (req: any, res: any) => {
    const s = player.sessions.get(String(req.params.sid || ""));
    res.set("Cache-Control", "no-store");
    if (!s) return res.json({ ready: true, final: true, gone: true, ads: [], how: "failed", compared: 0 });
    s.touched = Date.now();
    let extra: PlayAd[] = [];
    if (d.dir) { try { extra = await player.transcriptAds(s, d.dir); } catch { extra = []; } }
    // Listeners' marks and skip spots (content time) placed in this copy, and votes applied.
    if (d.crowd && s.copy.done && s.ads.final) {
      try {
        const c = await d.crowd(s.episodeId);
        const voter = d.voterOf(req);
        const tally = new Map<string, { score: number; mine?: number }>();
        for (const v of c.votes) { const t = tally.get(v.key) ?? { score: 0 }; t.score += v.vote > 0 ? 1 : -1; if (v.voter === voter) t.mine = v.vote; tally.set(v.key, t); }
        const keep = (key: string, base: number) => { const t = tally.get(key); return !(t?.mine === -1 || base + (t?.score ?? 0) < 1); };
        const place = (a: { s: number; e: number }) => { const x = player.fromContent(s, a.s), y = player.fromContent(s, a.e); return x === null || y === null || y <= x ? null : { s: Math.round(x * 100) / 100, e: Math.round(y * 100) / 100 }; };
        extra = extra.filter((a) => keep(a.key, 1));
        for (const m of c.marks) { const p = place(m); if (p && keep(m.key, m.support)) extra.push({ key: m.key, ...p, label: m.label || "Ad break", kind: "user", sure: true }); }
        for (const k of c.skips) { const p = place(k); if (p && keep(k.key, 1)) extra.push({ key: k.key, ...p, label: "Listeners skip this", kind: "crowd", sure: false }); }
      } catch { /* the shared marks can't be read right now */ }
    }
    // Ads another finder already covers are left out (stitched-in ones first).
    const out: PlayAd[] = [];
    const covered = (a: PlayAd) => out.some((o) => Math.min(o.e, a.e) - Math.max(o.s, a.s) > 0.5 * (a.e - a.s));
    for (const a of [...s.ads.ads, ...extra.filter((x) => x.kind === "user"), ...extra.filter((x) => x.kind !== "user")]) if (!covered(a)) out.push(a);
    res.json({ ...s.ads, pending: s.opening === "running" || !!s.gaps?.running, ads: out.sort((x, y) => x.s - y.s) });
  });
}

// ---------------------------------------------------------------------------
// Diagnostics: plays chosen episodes through the server as a listener would and stores what was
// found, so the whole path can be checked against real hosts. An operator puts
// {"id", "episodes": [{"id", "show", "url"}]} in podcast_cache under "diag:play:request"; results
// appear under "diag:play:<episode id>".
// ---------------------------------------------------------------------------

type KVLike = { get(key: string): Promise<{ value: any; at: number } | null>; set(key: string, value: any): Promise<void> };
export function startPlayDiagnostics(kv: KVLike, player: Player, dir?: Pick<Directory, "contentTranscript" | "contentChunks">, listenerUa = "AppleCoreMedia/1.0.0.22A3354 (iPhone; U; CPU OS 18_0 like Mac OS X; en_us)", everyMs = 30_000) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const req = (await kv.get("diag:play:request"))?.value as { id?: string; episodes?: { id: string; show: string; url: string; transcript?: boolean }[] } | undefined;
      if (!req?.id || !Array.isArray(req.episodes)) return;
      if (((await kv.get("diag:play:done"))?.value as any)?.id === req.id) return;
      await kv.set("diag:play:done", { id: req.id, started: new Date().toISOString() });
      for (const ep of req.episodes.slice(0, 10)) {
        const t0 = Date.now();
        const sid = `diag${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        const s = player.open({ sid, voter: "diag", episodeId: String(ep.id), showId: String(ep.show), url: String(ep.url), ua: listenerUa, ip: "" });
        const marks: Record<string, number> = {};
        while (Date.now() - t0 < 240_000 && !s.ads.final) {
          await s.copy.wait(1000);
          if (s.copy.headers && !marks.headers) marks.headers = Date.now() - t0;
          if (s.ads.ready && !marks.ready) marks.ready = Date.now() - t0;
          if (s.copy.done && !marks.done) marks.done = Date.now() - t0;
        }
        marks.final = Date.now() - t0;
        let tx: any = null;
        if (ep.transcript && dir) {
          const c = await copyTranscript(player, dir, sid, String(ep.show), String(ep.id), 0).catch((x: any) => ({ error: String(x?.message || x) }) as any);
          marks.transcript = Date.now() - t0;
          tx = c && !c.error ? { source: c.source, reason: c.reason, segments: c.segments.length, first: c.segments.slice(0, 4), ads: c.ads, more: c.more } : c;
        }
        const e = player.episodes.get(String(ep.id));
        await kv.set(`diag:play:${ep.id}`, {
          request: req.id, at: new Date().toISOString(), ms: marks, ads: s.ads, tx,
          copy: { bytes: s.copy.bytes, total: s.copy.total, frames: s.copy.scanner.count, secs: Math.round(s.copy.scanner.time * 100) / 100, err: s.copy.err, host: s.copy.finalHost },
          refs: (e?.refs ?? []).map((r) => ({ agent: r.agent, secs: Math.round(r.copy.scanner.time * 100) / 100, err: r.copy.err, done: r.copy.done })),
        });
        player.close(sid);
      }
      await kv.set("diag:play:done", { id: req.id, finished: new Date().toISOString() });
    } catch (e: any) { console.warn("[earshot] play diagnostics:", e?.message || e); }
    finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, everyMs); (timer as any).unref?.();
  return { tick, stop: () => clearInterval(timer) };
}
