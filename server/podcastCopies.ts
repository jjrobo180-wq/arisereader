// Copies of an episode, as the host stitches them (Earshot + Podscroll).
//
// fetchCopy() downloads one copy and reads its MP3 frames as they arrive (and can keep the bytes
// in a temp file for playback). The diagnostics below download a few copies of chosen episodes
// with different user agents and store how they line up, so the ad finder can be checked against
// real hosts: an operator puts a request in podcast_cache under "diag:copies:request" and the
// results appear under "diag:copies:<episode id>".
import { createWriteStream, type WriteStream } from "node:fs";
import { Mp3Scanner, alignCopies, coverage, unmatched } from "../shared/earshotAudio";
import type { KV } from "./podcastDirectory";

/** The user agents copies can be fetched with. Our own server copies say they're a bot, so hosts
 *  that follow podcast measurement rules don't count them as listens or charge advertisers. */
export const COPY_AGENTS: Record<string, string> = {
  bot: "Mozilla/5.0 (compatible; AriseEarshotBot/1.0; +https://arisetodo.com)",
  bot2: "AriseEarshotBot/1.1 (podcast ad finder; +https://arisetodo.com)",
  bot3: "Mozilla/5.0 (Linux; compatible; AriseEarshotBot/1.2; +https://arisetodo.com)",
  bot4: "AriseEarshotBot/1.3 (+https://arisetodo.com/bot)",
  real: "AppleCoreMedia/1.0.0.22A3354 (iPhone; U; CPU OS 18_0 like Mac OS X; en_us)",
  browser: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  app: "Arise-Earshot/1.0 (arisetodo.com)",
};

export type CopyInfo = {
  ua: string; status: number; finalUrl: string; type: string; length: number; bytes: number;
  frames: number; duration: number; kbps: number; rate: number; junk: number; ms: number; err?: string;
};

export type FetchCopyOptions = {
  ua: string;
  /** The listener's address, passed on so hosts can pick ads for where they are. */
  forwardedFor?: string;
  signal?: AbortSignal;
  maxBytes?: number;
  /** Keep the bytes here as they arrive. */
  file?: string;
  /** Called as bytes arrive (for playback that starts before the download ends). */
  onProgress?: (bytes: number, scanner: Mp3Scanner) => void;
  /** Called once the response headers are in. */
  onHeaders?: (status: number, length: number, type: string) => void;
  /** Called as bytes reach the file (so they can be read back). */
  onWritten?: (bytes: number) => void;
};

export async function fetchCopy(url: string, o: FetchCopyOptions, scanner = new Mp3Scanner()): Promise<{ info: CopyInfo; scanner: Mp3Scanner }> {
  const t0 = Date.now();
  const info: CopyInfo = { ua: o.ua, status: 0, finalUrl: "", type: "", length: 0, bytes: 0, frames: 0, duration: 0, kbps: 0, rate: 0, junk: 0, ms: 0 };
  let out: WriteStream | null = null;
  let written = 0;
  try {
    const headers: Record<string, string> = { "User-Agent": COPY_AGENTS[o.ua] || o.ua, Accept: "*/*" };
    if (o.forwardedFor) headers["X-Forwarded-For"] = o.forwardedFor;
    const res = await fetch(url, { headers, redirect: "follow", signal: o.signal });
    info.status = res.status; info.finalUrl = res.url; info.type = res.headers.get("content-type") || "";
    info.length = Number(res.headers.get("content-length")) || 0;
    o.onHeaders?.(res.status, info.length, info.type);
    if (!res.ok || !res.body) throw new Error(`status ${res.status}`);
    if (o.file) out = createWriteStream(o.file);
    const max = o.maxBytes ?? 400 * 1024 * 1024;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      info.bytes += value.length;
      if (info.bytes > max) { await reader.cancel().catch(() => {}); throw new Error("too big"); }
      if (out) {
        const n = value.length;
        const ok = out.write(value, (e?: Error | null) => { if (!e) { written += n; o.onWritten?.(written); } });
        if (!ok) await new Promise<void>((r) => out!.once("drain", () => r()));
      }
      scanner.push(value);
      o.onProgress?.(info.bytes, scanner);
    }
    scanner.end();
    if (out) { const w = out; await new Promise<void>((r, j) => w.end((e?: Error | null) => (e ? j(e) : r()))); out = null; }
  } catch (e: any) {
    info.err = String(e?.message || e).slice(0, 200);
    if (out) out.destroy();
  }
  info.frames = scanner.count; info.duration = round(scanner.time, 3); info.kbps = scanner.kbps; info.rate = scanner.rate;
  info.junk = scanner.junk; info.ms = Date.now() - t0;
  return { info, scanner };
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const shortUrl = (u: string) => { try { const x = new URL(u); return (x.host + x.pathname).slice(0, 160); } catch { return u.slice(0, 160); } };

/** How two copies line up: how much of each is shared, and the parts of each the other doesn't have. */
export function compareCopies(x: Mp3Scanner, y: Mp3Scanner) {
  const runs = alignCopies(x.hashes, x.count, y.hashes, y.count);
  const tx = (i: number) => x.timeOf(i), ty = (i: number) => y.timeOf(i);
  return {
    runs: runs.length,
    coverX: round(coverage(runs, "a", x.count, tx), 4), coverY: round(coverage(runs, "b", y.count, ty), 4),
    onlyX: unmatched(runs, "a", x.count, tx).map((s) => [round(s.s), round(s.e)]),
    onlyY: unmatched(runs, "b", y.count, ty).map((s) => [round(s.s), round(s.e)]),
    stretches: runs.slice(0, 40).map((r) => [round(tx(r.a)), round(ty(r.b)), round(tx(r.a + r.n) - tx(r.a))]),
  };
}

/** Diagnostics: where the padding rhythm of a steady-bitrate stretch breaks (an encoder restarting).
 *  Within one encoding, the gaps between unpadded frames take two neighbouring values; a gap outside
 *  them is noted with its time, plus how many frames start with an empty bit reservoir. */
function padBreaks(sc: Mp3Scanner) {
  const gaps = new Map<number, number>();
  let last = -1, lastRate = -1;
  const unpadded: number[] = [];
  for (let i = 0; i < sc.count; i++) {
    const f = sc.flags[i];
    if ((f & 0xf0) !== lastRate) { lastRate = f & 0xf0; last = -1; }
    if (!(f & 1)) { if (last >= 0) gaps.set(i - last, (gaps.get(i - last) || 0) + 1); unpadded.push(i); last = i; }
  }
  const common = [...gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
  const breaks: [number, number][] = [];
  for (let k = 1; k < unpadded.length && breaks.length < 300; k++) {
    const g = unpadded[k] - unpadded[k - 1];
    if (!common.includes(g)) breaks.push([round(sc.timeOf(unpadded[k])), g]);
  }
  let mdb0 = 0; for (let i = 0; i < sc.count; i++) if (sc.flags[i] & 2) mdb0++;
  return { common, unpadded: unpadded.length, mdb0, breaks };
}

type DiagRequest = { id: string; uas?: string[]; episodes: { id: string; url: string }[] };

/** Checks for a diagnostics request now and then; runs each request once. */
export function startCopyDiagnostics(kv: KV, everyMs = 30_000) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const req = (await kv.get("diag:copies:request"))?.value as DiagRequest | undefined;
      if (!req?.id || !Array.isArray(req.episodes)) return;
      const done = (await kv.get("diag:copies:done"))?.value as { id?: string } | undefined;
      if (done?.id === req.id) return;
      await kv.set("diag:copies:done", { id: req.id, started: new Date().toISOString() });
      const uas = (req.uas?.length ? req.uas : ["real", "real", "bot", "bot"]).slice(0, 6);
      for (const ep of req.episodes.slice(0, 12)) {
        const copies: { info: CopyInfo; scanner: Mp3Scanner }[] = [];
        for (const spec of uas) {
          const [ua, ...opts] = spec.split("|");
          const xff = opts.find((o) => o.startsWith("xff="))?.slice(4);
          const c = await fetchCopy(ep.url, { ua, forwardedFor: xff, signal: AbortSignal.timeout(6 * 60_000), maxBytes: 300 * 1024 * 1024 });
          c.info.ua = spec;
          copies.push(c);
        }
        const pairs: any[] = [];
        for (let a = 0; a < copies.length; a++) for (let b = a + 1; b < copies.length; b++) {
          if (!copies[a].scanner.count || !copies[b].scanner.count) continue;
          pairs.push({ x: a, y: b, ...compareCopies(copies[a].scanner, copies[b].scanner) });
        }
        await kv.set(`diag:copies:${ep.id}`, {
          request: req.id, at: new Date().toISOString(), url: shortUrl(ep.url),
          copies: copies.map((c) => ({
            ...c.info, finalUrl: shortUrl(c.info.finalUrl),
            joins: c.scanner.joins.slice(0, 250).map((j) => [round(j.t), j.kind, j.bytes ?? j.frames ?? (j.from !== undefined ? `${j.from}>${j.to}` : null), j.enc ?? null]),
            pads: padBreaks(c.scanner),
            joinCount: c.scanner.joins.length,
          })), pairs,
        });
      }
      await kv.set("diag:copies:done", { id: req.id, finished: new Date().toISOString() });
    } catch (e: any) {
      console.warn("[earshot] copy diagnostics:", e?.message || e);
    } finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, everyMs);
  timer.unref?.();
  setTimeout(() => { void tick(); }, 20_000).unref?.();
  return { tick, stop: () => clearInterval(timer) };
}

/** Compact storage for a copy's fingerprints and frame times (for the database). */
export function packCopy(sc: Mp3Scanner): { n: number; h: string; d: [number, number][] } {
  const h = Buffer.from(sc.hashes.buffer.slice(0, sc.count * 4)).toString("base64");
  // Frame lengths in time, run-length coded (almost always one value).
  const d: [number, number][] = [];
  for (let i = 0; i < sc.count; i++) {
    const dur = Math.round(((i + 1 < sc.count ? sc.starts[i + 1] : sc.time) - sc.starts[i]) * 1e9) / 1e9;
    const last = d[d.length - 1];
    if (last && Math.abs(last[0] - dur) < 2e-9) last[1]++; else d.push([dur, 1]);
  }
  return { n: sc.count, h, d };
}
/** A stored copy back as fingerprints and a frame-time function. */
export function unpackCopy(p: { n: number; h: string; d: [number, number][] }) {
  const raw = Buffer.from(p.h, "base64");
  const hashes = new Uint32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + p.n * 4));
  const starts = new Float64Array(p.n + 1);
  let i = 0, t = 0;
  for (const [dur, count] of p.d) for (let c = 0; c < count && i < p.n; c++) { starts[i++] = t; t += dur; }
  starts[p.n] = t;
  return { hashes, n: p.n, duration: t, timeOf: (k: number) => starts[Math.max(0, Math.min(p.n, k))] };
}
