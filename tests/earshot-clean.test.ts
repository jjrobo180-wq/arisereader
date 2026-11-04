// Ad-free copies (server/podcastClean.ts): a compared copy's show audio is written out frame for frame
// with the stitched-in ads cut, kept in storage, and read back as a shared session for read along.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Mp3Scanner } from "../shared/earshotAudio";
import { cleanSidOf, createPlayer, isCleanSid, registerPlayRoutes } from "../server/podcastPlay";
import { createCleaner, memoryCleanStore, registerCleanRoutes, writeCleanMp3, xingFrame } from "../server/podcastClean";
const ok = (c: unknown, m: string) => assert.ok(c, m);

const FD = 1152 / 44100;
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; }; }
function frames(n: number, seed: number) { const r = rng(seed), out: Uint8Array[] = []; for (let i = 0; i < n; i++) { const f = new Uint8Array(417); f.set([0xff, 0xfb, 0x90, 0x00]); for (let k = 4; k < 417; k++) f[k] = r() >>> 24; out.push(f); } return out; }
function id3(size: number) { const t = new Uint8Array(10 + size); t.set([0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]); return t; }
function join2(parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
/** An encoder's info frame like LAME writes at the start of a file. */
function lameInfo() { const f = new Uint8Array(417); f.set([0xff, 0xfb, 0x90, 0x00]); f.set([0x58, 0x69, 0x6e, 0x67], 36); f.set([0, 0, 0, 1, 0, 0, 0x30, 0x39], 40); return f; }
const scan = (b: Uint8Array) => { const sc = new Mp3Scanner(); sc.push(b); sc.end(); return sc; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A host that stitches ads into listeners' copies (not bots'), and storage that serves kept files. */
function fakeNet(listener: Uint8Array, bot: Uint8Array, files: Map<string, Buffer>, seen: string[] = []) {
  return async (url: string, o: any, scanner = new Mp3Scanner()) => {
    seen.push(`${o.ua} ${url}`);
    const m = /^https:\/\/storage\.example\/clean\/([^?]+)/.exec(url);
    const bytes = m ? files.get(m[1]) : String(o.ua).startsWith("bot") ? bot : listener;
    if (!bytes) { o.onHeaders?.(404, 0, "text/plain"); return { info: { ua: o.ua, status: 404, finalUrl: url, type: "", length: 0, bytes: 0, frames: 0, duration: 0, kbps: 0, rate: 0, junk: 0, ms: 1, err: "status 404" }, scanner }; }
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
function memoryKV() { const m = new Map<string, any>(); return { m, async get(k: string) { return m.has(k) ? { value: m.get(k), at: Date.now() } : null; }, async set(k: string, v: any) { m.set(k, JSON.parse(JSON.stringify(v))); } }; }
function fakeApp() {
  const routes = new Map<string, Function[]>();
  const app: any = {};
  for (const m of ["get", "head", "post", "delete"]) app[m] = (p: string, ...h: Function[]) => routes.set(`${m} ${p}`, h);
  const call = async (method: string, path: string, params: Record<string, string>, opts: { query?: any; headers?: any; user?: any } = {}) => {
    const h = routes.get(`${method} ${path}`)!;
    const req: any = Object.assign(new EventEmitter(), { method: method.toUpperCase(), params, query: opts.query ?? {}, headers: opts.headers ?? {}, user: opts.user ?? { id: "7" }, body: {}, socket: {} });
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

test("the ad-free MP3 keeps every audio frame in order, drops tags, junk and info frames, and describes itself", async () => {
  const a = frames(300, 1), b = frames(200, 2);
  // Two pieces of a copy: the first starts with a tag and LAME's info frame, the second has junk and a tag inside.
  const p1 = join2([id3(2000), lameInfo(), ...a]);
  // (A frame followed straight by junk isn't taken for one, as the scanner that timed the copy does.)
  const p2 = join2([...b.slice(0, 100), id3(500), new Uint8Array([1, 2, 3, 0xff, 0xfb]), ...b.slice(100)]);
  const copy = join2([p1, frames(50, 9).reduce((x, y) => join2([x, y]), new Uint8Array(0)), p2]);
  const r1: [number, number] = [0, p1.length], r2: [number, number] = [p1.length + 50 * 417, copy.length];
  const made = await writeCleanMp3(async (s, e) => copy.subarray(s, e), [r1, r2]);
  ok(made, "made");
  assert.equal(made!.frames, 500);
  ok(Math.abs(made!.secs - 500 * FD) < 1e-6, `secs ${made!.secs}`);
  const out = made!.data;
  // First frame: our own info frame, CBR ("Info"), counting 500 frames and the whole file.
  assert.deepEqual(Array.from(out.subarray(0, 2)), [0xff, 0xfb]);
  assert.equal(out.toString("latin1", 36, 40), "Info");
  assert.equal(out.readUInt32BE(44), 500);
  assert.equal(out.readUInt32BE(48), out.length);
  const sc = scan(out);
  assert.equal(sc.count, 501, "info frame + 500 audio frames");
  assert.equal(sc.junk, 0, "nothing between frames");
  const want = scan(join2([...a, ...b]));
  for (let i = 0; i < 500; i++) assert.equal(sc.hashes[i + 1], want.hashes[i], `frame ${i}`);
  // The seek table starts at 0 and climbs.
  const toc = Array.from(out.subarray(52, 152));
  assert.equal(toc[0], 0);
  for (let i = 1; i < 100; i++) ok(toc[i] >= toc[i - 1], "seek table climbs");
  ok(toc[50] > 120 && toc[50] < 136, `halfway is about halfway (${toc[50]})`);
  // Mixed bitrates: a Xing (VBR) header.
  const vbr = frames(10, 4).map((f, i) => { if (i % 2) { const g = new Uint8Array(626); g.set(f.subarray(0, 4)); g[2] = 0xb0; for (let k = 4; k < 626; k++) g[k] = (k * 7 + i) & 0xff; return g; } return f; });
  const mixed = await writeCleanMp3(async (s, e) => join2(vbr).subarray(s, e), [[0, join2(vbr).length]]);
  assert.equal(mixed!.data.toString("latin1", 36, 40), "Xing");
  assert.equal(await writeCleanMp3(async () => new Uint8Array(0), []), null);
  // A Xing frame for low sample rates (MPEG-2) still has room for the table.
  const x2 = xingFrame(new Uint8Array([0xff, 0xf3, 0x84, 0xc0]), 10, 1000, () => new Uint8Array(100), true);
  ok(x2.length >= 4 + 9 + 120, `mpeg-2 mono info frame ${x2.length}`);
});

test("a compared copy becomes the episode's ad-free copy, and its shared session reads it back from storage", async () => {
  const show = frames(6000, 1);
  const pre = frames(600, 2), mid = frames(400, 3);
  const listener = join2([id3(70_000), ...pre, ...show.slice(0, 3000), ...mid, ...show.slice(3000)]);
  const bot = join2([lameInfo(), ...show]);
  const dir = mkdtempSync(join(tmpdir(), "earshot-clean-test-"));
  const store = memoryCleanStore();
  const kv = memoryKV();
  const seen: string[] = [];
  const player = createPlayer({ dir, download: fakeNet(listener, bot, store.files, seen) as any, key: Buffer.alloc(32, 7) });
  const cleaner = createCleaner({ player, kv, store, quiet: true });
  const { app, call } = fakeApp();
  const auth = (_req: any, _res: any, next: any) => next();
  const deps = { prefix: "/api/earshot", player, audioFor: async (s: string, e: string) => (s === "11" && e === "22" ? "https://host.example/ep.mp3" : null), voterOf: (req: any) => `u${req.user.id}`, clientIp: () => "203.0.113.9", cleanId: (v: unknown) => String(v ?? "").replace(/\D/g, "") };
  registerPlayRoutes(app, auth, deps);
  registerCleanRoutes(app, auth, { prefix: "/api/earshot", cleaner, cleanId: deps.cleanId });
  try {
    assert.deepEqual((await call("get", "/api/earshot/clean/:episodeId", { episodeId: "22" })).res.body, { ready: false, building: false });
    const s = player.open({ sid: "abcdefghijklmnop1234", voter: "u7", episodeId: "22", showId: "11", url: "https://host.example/ep.mp3", ua: "AppleCoreMedia/1.0", ip: "" });
    for (let t = 0; t < 300 && !(kv.m.get("clean:22")?.stage); t++) await sleep(20);
    const info = kv.m.get("clean:22");
    ok(info?.stage === "ready", JSON.stringify(info));
    assert.equal(s.ads.how, "diff");
    assert.equal(info.from.cut, 2);
    ok(Math.abs(info.secs - 6000 * FD) < 0.05, `secs ${info.secs}`);
    // The kept file is the show itself, frame for frame (the bot's info frame and the ads gone).
    const kept = store.files.get(info.path)!;
    const sc = scan(kept), want = scan(join2(show));
    assert.equal(sc.count, 6001);
    for (let i = 0; i < 6000; i += 37) assert.equal(sc.hashes[i + 1], want.hashes[i], `frame ${i}`);
    // The route hands players the address and the shared session id.
    const r = (await call("get", "/api/earshot/clean/:episodeId", { episodeId: "22" })).res.body;
    ok(r.ready && r.sid === cleanSidOf("22") && /^https:\/\/storage\.example\/clean\/22\//.test(r.url) && Math.abs(r.secs - info.secs) < 0.01, JSON.stringify(r));
    ok(isCleanSid(r.sid, "22") && !isCleanSid(r.sid, "23") && !isCleanSid("abcdefghijklmnop1234"), "clean ids");
    // Not streamed through the server.
    assert.equal((await call("get", "/api/earshot/audio/:sid", { sid: r.sid }, { query: { e: "22", s: "11", k: "x" } })).res.statusCode, 404);
    // Its ads: the session is opened from storage on demand (as after a restart), never compared.
    let ads: any = null;
    for (let t = 0; t < 200 && !(ads?.final && !ads?.pending); t++) { ads = (await call("get", "/api/earshot/play/:sid/ads", { sid: r.sid }, { query: { e: "22", s: "11" } })).res.body; await sleep(20); }
    ok(ads.final && ads.clean && ads.how === "same" && !ads.gone, JSON.stringify(ads));
    assert.deepEqual(ads.ads, [], "no stitched-in ads left");
    const cs = player.sessions.get(r.sid)!;
    ok(cs.clean && cs.copy.done && Math.abs(cs.copy.scanner.time - (info.secs + FD)) < 0.05, "read back from storage");
    ok(!seen.some((x) => x.startsWith("bot") && /storage\.example/.test(x)), "never compared with bot copies");
    // Content time is its own time.
    assert.equal(player.toContent(r.sid, "22", 123.4, "start"), 123.4);
    // Another listener's copy of the same episode doesn't make a second one.
    const before = store.files.size;
    player.open({ sid: "qrstuvwxyzabcdef5678", voter: "u8", episodeId: "22", showId: "11", url: "https://host.example/ep.mp3", ua: "AppleCoreMedia/1.0", ip: "" });
    for (let t = 0; t < 150 && !player.sessions.get("qrstuvwxyzabcdef5678")?.ads.final; t++) await sleep(20);
    await sleep(100);
    assert.equal(store.files.size, before);
  } finally { player.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test("a lost session isn't silently swapped for a different copy partway through", async () => {
  const show = frames(2000, 5);
  const dir = mkdtempSync(join(tmpdir(), "earshot-clean-test-"));
  const player = createPlayer({ dir, download: fakeNet(join2(show), join2(show), new Map()) as any, key: Buffer.alloc(32, 7) });
  const { app, call } = fakeApp();
  const auth = (_req: any, _res: any, next: any) => next();
  registerPlayRoutes(app, auth, { prefix: "/api/earshot", player, audioFor: async () => "https://host.example/ep.mp3", voterOf: (req: any) => `u${req.user.id}`, clientIp: () => "", cleanId: (v: unknown) => String(v ?? "").replace(/\D/g, "") });
  try {
    const token = (await call("get", "/api/earshot/play-token", {})).res.body.token;
    const q = { e: "22", s: "11", k: token };
    assert.equal((await call("get", "/api/earshot/audio/:sid", { sid: "lostlostlostlost99" }, { query: q, headers: { range: "bytes=500000-" } })).res.statusCode, 410);
    ok(!player.sessions.has("lostlostlostlost99"), "not opened");
    // From the start it opens as before.
    const first = await call("get", "/api/earshot/audio/:sid", { sid: "lostlostlostlost99" }, { query: q, headers: { range: "bytes=0-1" } });
    assert.equal(first.res.statusCode, 206);
    // A session that's here carries on anywhere.
    assert.equal((await call("get", "/api/earshot/audio/:sid", { sid: "lostlostlostlost99" }, { query: q, headers: { range: "bytes=500000-500099" } })).res.statusCode, 206);
    // The ads of an ad-free copy nobody made: gone.
    assert.equal((await call("get", "/api/earshot/play/:sid/ads", { sid: cleanSidOf("22") }, { query: { e: "22" } })).res.body.gone, true);
  } finally { player.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test("only a copy whose stitched-in ads are known is made into the ad-free copy", async () => {
  const show = frames(3000, 6);
  const dir = mkdtempSync(join(tmpdir(), "earshot-clean-test-"));
  const store = memoryCleanStore(), kv = memoryKV();
  // The bot copy fails: nothing to compare with.
  const net = fakeNet(join2(show), new Uint8Array(0), store.files);
  const player = createPlayer({ dir, download: (async (url: string, o: any, sc?: Mp3Scanner) => (String(o.ua).startsWith("bot") ? { info: { ua: o.ua, status: 500, finalUrl: url, type: "", length: 0, bytes: 0, frames: 0, duration: 0, kbps: 0, rate: 0, junk: 0, ms: 1, err: "status 500" }, scanner: sc ?? new Mp3Scanner() } : net(url, o, sc))) as any, key: Buffer.alloc(32, 7) });
  createCleaner({ player, kv, store, quiet: true });
  try {
    const s = player.open({ sid: "noref0noref0noref0", voter: "u7", episodeId: "33", showId: "11", url: "https://host.example/ep.mp3", ua: "AppleCoreMedia/1.0", ip: "" });
    for (let t = 0; t < 200 && !s.ads.final; t++) await sleep(20);
    await sleep(100);
    assert.equal(s.ads.how, "noref");
    assert.equal(store.files.size, 0);
    assert.equal(kv.m.get("clean:33"), undefined);
  } finally { player.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test("moments move between a copy with stitched-in ads and show time (the ad-free copy's time)", async () => {
  const { copyToShow, showToCopy } = await import("../shared/earshotAds");
  const ads = [
    { key: "d:1:0:30", s: 0, e: 30, label: "Pre-roll", kind: "dai" as const, sure: true },
    { key: "d:1:600:690", s: 600, e: 690, label: "Ad break", kind: "dai" as const, sure: true },
    // Not cut from the ad-free copy (long or unsure, or read by the host): no effect on time.
    { key: "d:1:1200:1800", s: 1200, e: 1800, label: "Ad break", kind: "dai" as const, sure: false },
    { key: "t:1:0:300:330", s: 300, e: 330, label: "Sponsor", kind: "ai" as const, sure: true },
  ];
  assert.equal(copyToShow(10, ads), 0, "inside the pre-roll: where the show starts");
  assert.equal(copyToShow(30, ads), 0);
  assert.equal(copyToShow(100, ads), 70);
  assert.equal(copyToShow(650, ads), 570, "inside a break: where the show picks up");
  assert.equal(copyToShow(700, ads), 580);
  assert.equal(copyToShow(1500, ads), 1380);
  assert.equal(showToCopy(0, ads), 30, "the show's start is after the pre-roll");
  assert.equal(showToCopy(70, ads), 100);
  assert.equal(showToCopy(570, ads), 690, "right after the break");
  assert.equal(showToCopy(580, ads), 700);
  for (const x of [35, 100, 599, 700, 1000, 2500]) assert.equal(showToCopy(copyToShow(x, ads), ads), x, `round trip ${x}`);
  assert.equal(copyToShow(123, []), 123);
  assert.equal(showToCopy(123, []), 123);
});

test("with room to spare, the whole episode is read along ahead of the listener (pieces read before are skipped)", async () => {
  const { readWhole, roomToRead } = await import("../server/podcastPlay");
  const show = frames(60000, 7); // about 26 minutes: three 10-minute pieces
  const dir0 = mkdtempSync(join(tmpdir(), "earshot-clean-test-"));
  const player = createPlayer({ dir: dir0, download: fakeNet(join2(show), join2(show), new Map()) as any, key: Buffer.alloc(32, 7) });
  try {
    const s = player.open({ sid: "readreadreadread01", voter: "u7", episodeId: "44", showId: "11", url: "https://host.example/ep.mp3", ua: "AppleCoreMedia/1.0", ip: "" });
    for (let t = 0; t < 300 && !s.ads.final; t++) await sleep(20);
    ok(s.ads.final, "compared");
    const asked: number[] = [];
    let hour = 0;
    const dir: any = {
      contentChunks: async () => [{ chunk: -1, source: "ai" }, { chunk: 1, source: "ai" }],
      contentTranscript: async (_show: string, _ep: string, chunk: number, src: any) => { asked.push(chunk); const a = await src.extract(chunk * 600, chunk * 600 + 5); ok(a.audio.size > 0, "audio for the piece"); hour += 10; return { source: "ai", chunk, segments: [], ads: [], chapters: [], chunkSecs: 600, more: true }; },
      minutesLastHour: () => hour, budgetLeft: () => 800, perDay: 900, hourCap: () => 40, paid: () => false,
    };
    // Free plan: only the quiet half of the hour's allowance (20 of 40 minutes).
    assert.equal(await readWhole(player, dir, s), 2);
    assert.deepEqual(asked, [0, 2], "the pieces nobody read yet, in order");
    asked.length = 0; hour = 25;
    assert.equal(roomToRead(dir), false);
    assert.equal(await readWhole(player, dir, s), 0, "no room: nothing read");
    // A paid plan: the whole hour's allowance.
    dir.paid = () => true; dir.hourCap = () => 1200;
    ok(roomToRead(dir), "paid: room");
    // Out of the day's allowance (a quarter is kept for listeners): no.
    dir.budgetLeft = () => 100;
    assert.equal(roomToRead(dir), false);
  } finally { player.stop(); rmSync(dir0, { recursive: true, force: true }); }
});
