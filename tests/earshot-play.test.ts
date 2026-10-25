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
  const listener = join2([...frames(600, 2), ...show.slice(0, 3000), ...frames(400, 3), ...show.slice(3000)]);
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
    assert.deepEqual(Array.from(first.bytes), [0xff, 0xfb]);
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
