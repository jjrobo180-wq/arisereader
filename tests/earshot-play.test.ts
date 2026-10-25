// Playback through the server (Earshot + Podscroll): a listener's copy is downloaded, streamed with
// byte ranges, compared with a bot's copy, and its stitched-in ads come back exactly.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Mp3Scanner } from "../shared/earshotAudio";
import { checkPlayToken, createPlayer, makePlayToken, mergeSpans, parseRange, registerPlayRoutes } from "../server/podcastPlay";
const ok = (c: unknown, m: string) => assert.ok(c, m);

const FD = 1152 / 44100;
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; }; }
function frames(n: number, seed: number) { const r = rng(seed), out: Uint8Array[] = []; for (let i = 0; i < n; i++) { const f = new Uint8Array(417); f.set([0xff, 0xfb, 0x90, 0x00]); for (let k = 4; k < 417; k++) f[k] = r() >>> 24; out.push(f); } return out; }
function id3(size: number) { const t = new Uint8Array(10 + size); t.set([0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]); return t; }
function join2(parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }

/** A podcast host that stitches ads into listeners' copies and leaves them out for bots. */
function fakeHost(listener: Uint8Array, bot: Uint8Array, seen: string[] = []) {
  return async (url: string, o: any, scanner = new Mp3Scanner()) => {
    seen.push(o.ua);
    const bytes = String(o.ua).startsWith("bot") ? bot : listener;
    o.onHeaders?.(200, bytes.length, "audio/mpeg");
    const out = o.file ? createWriteStream(o.file) : null;
    let written = 0;
    for (let i = 0; i < bytes.length; i += 64000) {
      const chunk = bytes.subarray(i, i + 64000);
      if (out) await new Promise<void>((r) => out.write(chunk, () => { written += chunk.length; o.onWritten?.(written); r(); }));
      scanner.push(chunk); o.onProgress?.(Math.min(bytes.length, i + 64000), scanner);
      await new Promise((r) => setImmediate(r));
    }
    scanner.end();
    if (out) await new Promise<void>((r) => out.end(() => r()));
    return { info: { ua: o.ua, status: 200, finalUrl: url, type: "audio/mpeg", length: bytes.length, bytes: bytes.length, frames: scanner.count, duration: scanner.time, kbps: 128, rate: 44100, junk: 0, ms: 1 }, scanner };
  };
}

function fakeApp() {
  const routes = new Map<string, Function[]>();
  const app: any = {};
  for (const m of ["get", "head", "post", "delete"]) app[m] = (p: string, ...h: Function[]) => routes.set(`${m} ${p}`, h);
  const call = async (method: string, path: string, params: Record<string, string>, opts: { query?: any; headers?: any; user?: any } = {}) => {
    const h = routes.get(`${method} ${path}`)!;
    const req: any = Object.assign(new EventEmitter(), { method: method.toUpperCase(), params, query: opts.query ?? {}, headers: opts.headers ?? {}, user: opts.user ?? { id: "7" }, socket: {} });
    const chunks: Buffer[] = [];
    const res: any = Object.assign(new EventEmitter(), {
      statusCode: 200, headers: {} as Record<string, string>, body: undefined as any, ended: false,
      status(c: number) { this.statusCode = c; return this; },
      set(k: any, v?: any) { if (typeof k === "string") this.headers[k] = v; else Object.assign(this.headers, k); return this; },
      json(b: any) { this.body = b; this.ended = true; return this; },
      write(b: Buffer) { chunks.push(Buffer.from(b)); return true; },
      end() { this.ended = true; return this; },
    });
    let i = 0;
    const next = async (): Promise<void> => { const f = h[i++]; if (f) await f(req, res, next); };
    await next();
    return { res, bytes: Buffer.concat(chunks) };
  };
  return { app, call };
}

test("a listener's copy streams through the server and its stitched-in ads are found exactly", async () => {
  const show = frames(6000, 1);
  // The listener's copy starts with big cover art (the frames only start after 700 KB).
  const listener = join2([id3(700_000), ...frames(600, 2), ...show.slice(0, 3000), ...frames(400, 3), ...show.slice(3000)]);
  const bot = join2(show);
  const dir = mkdtempSync(join(tmpdir(), "earshot-play-test-"));
  const agents: string[] = [];
  const player = createPlayer({ dir, download: fakeHost(listener, bot, agents) as any, key: Buffer.alloc(32, 7) });
  const { app, call } = fakeApp();
  const auth = (req: any, _res: any, next: any) => next();
  registerPlayRoutes(app, auth, { prefix: "/api/earshot", player, audioFor: async (s, e) => (s === "11" && e === "22" ? "https://host.example/ep.mp3" : null), voterOf: (req) => `u${req.user.id}`, clientIp: () => "203.0.113.9", cleanId: (v) => String(v ?? "").replace(/\D/g, "") });
  try {
    const { res: tok } = await call("get", "/api/earshot/play-token", {});
    const token = tok.body.token as string;
    ok(checkPlayToken(player.key, token) === "u7", "token names the listener");
    const sid = "abcdefghijklmnop1234";
    const q = { e: "22", s: "11", k: token };
    // A bad token, an unknown episode, and a fresh session asked for the middle of its file.
    assert.equal((await call("get", "/api/earshot/audio/:sid", { sid }, { query: { ...q, k: "nope" } })).res.statusCode, 403);
    assert.equal((await call("get", "/api/earshot/audio/:sid", { sid }, { query: { ...q, e: "99" } })).res.statusCode, 404);
    assert.equal((await call("get", "/api/earshot/audio/:sid", { sid }, { query: q, headers: { range: "bytes=5000-" } })).res.statusCode, 410);
    // The player's first probe.
    const first = await call("get", "/api/earshot/audio/:sid", { sid }, { query: q, headers: { range: "bytes=0-1", "user-agent": "AppleCoreMedia/1.0" } });
    assert.equal(first.res.statusCode, 206);
    assert.equal(first.res.headers["Content-Range"], `bytes 0-1/${listener.length}`);
    assert.deepEqual(Array.from(first.bytes), [0x49, 0x44]);
    // A later range comes from the same copy.
    const mid = await call("get", "/api/earshot/audio/:sid", { sid }, { query: q, headers: { range: "bytes=100000-100999" } });
    assert.deepEqual(Array.from(mid.bytes), Array.from(listener.subarray(100000, 101000)), "bytes match the listener's copy");
    // The listener's copy was fetched as them; the comparison copy as a bot.
    ok(agents.includes("AppleCoreMedia/1.0") && agents.includes("bot"), agents.join(","));
    // Ads, once both copies are in.
    let ads: any = null;
    for (let t = 0; t < 100 && !(ads?.final); t++) { await new Promise((r) => setTimeout(r, 30)); ads = (await call("get", "/api/earshot/play/:sid/ads", { sid })).res.body; }
    ok(ads.final && ads.how === "diff", JSON.stringify(ads));
    assert.equal(ads.ads.length, 2);
    ok(Math.abs(ads.ads[0].s) < 0.01 && Math.abs(ads.ads[0].e - 600 * FD) < 0.01 && ads.ads[0].sure, "pre-roll exactly");
    ok(Math.abs(ads.ads[1].s - 3600 * FD) < 0.01 && Math.abs(ads.ads[1].e - 4000 * FD) < 0.01, "mid-roll exactly");
    ok(Math.abs(ads.startAt - 600 * FD) < 0.01, "the show starts after the pre-roll");
    // Whole file without a range.
    const whole = await call("get", "/api/earshot/audio/:sid", { sid }, { query: q });
    assert.equal(whole.res.statusCode, 200); assert.equal(whole.bytes.length, listener.length);
  } finally { player.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test("play tokens, byte ranges and joining ranges", () => {
  const key = Buffer.alloc(32, 3);
  const { token } = makePlayToken(key, "dDevice_1234567890abc", 1_000_000_000_000);
  assert.equal(checkPlayToken(key, token, 1_000_000_000_000 + 3600_000), "dDevice_1234567890abc");
  assert.equal(checkPlayToken(key, token, 1_000_000_000_000 + 13 * 3600_000), null, "expired");
  assert.equal(checkPlayToken(Buffer.alloc(32, 4), token, 1_000_000_000_000), null, "wrong key");
  assert.equal(checkPlayToken(key, token.replace(/\.dDevice/, ".dDevicf"), 1_000_000_000_000), null, "someone else's");
  assert.deepEqual(parseRange("bytes=0-1", 100), { start: 0, end: 1 });
  assert.deepEqual(parseRange("bytes=10-", 100), { start: 10, end: 99 });
  assert.deepEqual(parseRange("bytes=-20", 100), { start: 80, end: 99 });
  assert.deepEqual(parseRange("bytes=90-500", 100), { start: 90, end: 99 });
  assert.equal(parseRange("bytes=100-", 100), "bad");
  assert.equal(parseRange(undefined, 100), null);
  assert.deepEqual(mergeSpans([{ s: 10, e: 20 }, { s: 0, e: 5 }, { s: 20.3, e: 30 }]), [{ s: 0, e: 5 }, { s: 10, e: 30 }]);
});

test("read along is made from the listener's copy in show time, and placed back in any copy", async () => {
  const { createDirectory, memoryKV } = await import("../server/podcastDirectory");
  const { copyTranscript } = await import("../server/podcastPlay");
  const show = frames(9000, 41);
  const listener = join2([...frames(600, 42), ...show.slice(0, 4500), ...frames(400, 43), ...show.slice(4500)]);
  const bot = join2(show);
  const dir0 = mkdtempSync(join(tmpdir(), "earshot-play-test-"));
  const player = createPlayer({ dir: dir0, download: fakeHost(listener, bot) as any, key: Buffer.alloc(32, 9) });
  const podShow = { kind: "podcast", collectionId: 11, collectionName: "Show 11", artistName: "H", primaryGenreName: "History", genres: ["History"], artworkUrl600: "https://a/600x600bb.jpg", feedUrl: "https://feed/11", releaseDate: new Date().toISOString() };
  const podEp = { wrapperType: "podcastEpisode", kind: "podcast-episode", trackId: 22, collectionId: 11, collectionName: "Show 11", trackName: "E22", episodeUrl: "https://host.example/ep.mp3", releaseDate: "2026-10-01T00:00:00Z", trackTimeMillis: 240_000 };
  const fetcher: any = async () => ({ results: [podShow, podEp] }); fetcher.idle = () => true;
  const web: any = async () => new Response("<rss></rss>");
  let heard = 0, prompt = "";
  const transcribe = async (audio: Blob, _n: string, p?: string) => {
    heard = audio.size; prompt = p || "";
    return {
      segments: [{ start: 0, end: 20, text: "This episode is brought to you by BetterHelp." }, { start: 20, end: 45, text: "Visit betterhelp dot com slash show for 10% off." }, { start: 130, end: 150, text: "Welcome back to the show." }],
      words: [{ start: 0, end: 0.4, word: "This" }, { start: 0.4, end: 0.8, word: "episode" }, { start: 0.8, end: 1.1, word: "is" }, { start: 1.1, end: 1.5, word: "brought" }, { start: 43, end: 43.5, word: "10%" }, { start: 43.5, end: 44.2, word: "off." }],
    };
  };
  const ask = async () => JSON.stringify({ ads: [{ from: 0, to: 1, start: "This episode is brought", end: "10% off", label: "BetterHelp", confidence: 0.95 }] });
  const dir = createDirectory({ fetcher, kv: memoryKV(), web, ask, transcribe, aiOn: () => true });
  const { app, call } = fakeApp();
  registerPlayRoutes(app, (_q: any, _s: any, n: any) => n(), { prefix: "/api/x", player, dir, audioFor: async () => "https://host.example/ep.mp3", voterOf: () => "u1", clientIp: () => "", cleanId: (v) => String(v ?? "").replace(/\D/g, "") });
  try {
    const token = (await call("get", "/api/x/play-token", {})).res.body.token;
    const sid = "readalongsession0001";
    await call("get", "/api/x/audio/:sid", { sid }, { query: { e: "22", s: "11", k: token }, headers: { range: "bytes=0-1", "user-agent": "Phone" } });
    const tx = await copyTranscript(player, dir, sid, "11", "22", 0);
    ok(tx && tx.source === "ai", `made from the copy: ${JSON.stringify(tx)?.slice(0, 200)}`);
    assert.equal(heard, 9000 * 417, "only the show was transcribed (stitched-in ads left out)");
    ok(prompt.includes("Show 11"), "the transcriber hears the show's name");
    const pre = 600 * FD, gap = 400 * FD;
    ok(Math.abs(tx!.segments[0].s - pre) < 0.05, `first line placed after the pre-roll: ${tx!.segments[0].s}`);
    ok(Math.abs(tx!.segments[2].s - (130 + pre + gap)) < 0.05, `a line after the mid-roll placed after it too: ${tx!.segments[2].s}`);
    ok(tx!.ads.length === 1 && Math.abs(tx!.ads[0].s - pre) < 0.05 && Math.abs(tx!.ads[0].e - (44.2 + pre)) < 0.05, `the host-read ad, placed: ${JSON.stringify(tx!.ads)}`);
    // The session's ads now include it, next to the stitched-in ones.
    const ads = (await call("get", "/api/x/play/:sid/ads", { sid })).res.body;
    const kinds = ads.ads.map((a: any) => a.kind).join(",");
    ok(ads.ads.length === 3 && kinds.includes("dai") && kinds.includes("ai"), `stitched-in and read ads together: ${JSON.stringify(ads.ads)}`);
  } finally { player.stop(); rmSync(dir0, { recursive: true, force: true }); }
});
