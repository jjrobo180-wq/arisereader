// Ads found from one copy alone: its seams (header shape, padding rhythm), chapters in its tag, ads
// known from other episodes, and sponsors named in the notes (shared/earshotSplice.ts,
// server/podcastAdLibrary.ts, shared/earshotAds.ts sponsorsFromNotes, server/podcastPlay.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Mp3Scanner } from "../shared/earshotAudio";
import { chapterAdsIn, id3Chapters, paddingBreaks, reservoirStarts, spliceAds } from "../shared/earshotSplice";
import { sponsorsFromNotes } from "../shared/earshotAds";
import { createAdLibrary } from "../server/podcastAdLibrary";
import { createPlayer } from "../server/podcastPlay";

const FD = 1152 / 44100;
const near = (a: number, b: number, tol = 0.6) => Math.abs(a - b) <= tol;
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; }; }
/** n frames of one "encoding": 128 kbps, 44.1 kHz; mode 0x40 joint stereo, 0x00 stereo; padded like an encoder does. */
function encode(n: number, seed: number, o: { mode?: number; phase?: number } = {}) {
  const r = rng(seed), out: Uint8Array[] = [];
  let acc = o.phase ?? 0;
  for (let i = 0; i < n; i++) {
    acc += 0.9591836; // 144*128000/44100 = 417.959...: the fraction decides padding
    const pad = acc >= 1 ? 1 : 0; if (pad) acc -= 1;
    const f = new Uint8Array(417 + pad);
    f.set([0xff, 0xfb, 0x90 | (pad << 1), o.mode ?? 0x40]);
    for (let k = 4; k < f.length; k++) f[k] = r() >>> 24;
    out.push(f);
  }
  return out;
}
const join2 = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
function scan(bytes: Uint8Array) { const sc = new Mp3Scanner(); for (let i = 0; i < bytes.length; i += 50_000) sc.push(bytes.subarray(i, i + 50_000)); sc.end(); return sc; }

test("ads in another header shape than the show are found from the copy alone (Simplecast)", () => {
  const copy = join2([...encode(300, 1, { mode: 0 }), ...encode(3000, 2), ...encode(400, 3, { mode: 0 }), ...encode(3000, 4)]);
  const ads = spliceAds(scan(copy), true);
  assert.equal(ads.length, 2, JSON.stringify(ads));
  assert.ok(near(ads[0].s, 0) && near(ads[0].e, 300 * FD, 0.05) && ads[0].sure, "pre-roll");
  assert.ok(near(ads[1].s, 3300 * FD, 0.05) && near(ads[1].e, 3700 * FD, 0.05) && ads[1].sure, "mid-roll");
});

test("a padding rhythm that restarts marks each stitched-in file (Megaphone)", () => {
  // Pre-roll (2 ads), show, a break of 2 ads, show, post-roll: each its own encoding.
  const parts = [encode(1200, 1, { phase: 0.3 }), encode(1150, 2, { phase: 0.7 }), encode(30000, 3, { phase: 0.1 }), encode(1150, 4, { phase: 0.55 }), encode(1500, 5, { phase: 0.2 }), encode(30000, 6, { phase: 0.9 }), encode(1150, 7, { phase: 0.45 })];
  const sc = scan(join2(parts.flat()));
  const at = (k: number) => parts.slice(0, k).reduce((a, p) => a + p.length, 0) * FD;
  const breaks = paddingBreaks(sc);
  assert.ok(breaks.length >= 4 && breaks.length <= 8, `breaks ${breaks.map((x) => x.toFixed(1))}`);
  const ads = spliceAds(sc, true);
  assert.equal(ads.length, 3, JSON.stringify(ads));
  assert.ok(near(ads[0].s, 0) && near(ads[0].e, at(2)), `pre-roll ${JSON.stringify(ads[0])} want 0-${at(2).toFixed(1)}`);
  assert.ok(near(ads[1].s, at(3)) && near(ads[1].e, at(5)), `mid-roll ${JSON.stringify(ads[1])} want ${at(3).toFixed(1)}-${at(5).toFixed(1)}`);
  assert.ok(near(ads[2].s, at(6)) && near(ads[2].e, at(7)), "post-roll");
  assert.ok(ads.every((a) => a.sure));
  // Before the copy is complete, its last stretch (still arriving) isn't taken for an ad.
  const part = scan(join2(parts.slice(0, 3).flat().slice(0, 2350 + 2000)));
  assert.deepEqual(spliceAds(part, false).map((a) => [Math.round(a.s), Math.round(a.e)]), [[0, Math.round(at(2))]]);
});

/** 48 kHz frames (no padding): only the first frame of each file starts with an empty bit reservoir. */
function encode48(n: number, seed: number) {
  const r = rng(seed), out: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const f = new Uint8Array(384);
    f.set([0xff, 0xfb, 0x94, 0x40]);
    for (let k = 4; k < f.length; k++) f[k] = r() >>> 24;
    if (i === 0) { f[4] = 0; f[5] &= 0x7f; } else f[4] = 1 + (f[4] % 255);
    out.push(f);
  }
  return out;
}
const FD48 = 1152 / 48000;

test("in 48 kHz audio, each stitched-in file shows where its bit reservoir starts empty", () => {
  const parts = [encode48(1900, 1), encode48(90000, 2), encode48(2500, 3), encode48(90000, 4)];
  const sc = scan(join2(parts.flat()));
  assert.equal(paddingBreaks(sc).length, 0, "no padding rhythm at 48 kHz");
  assert.equal(reservoirStarts(sc).length, 3);
  const ads = spliceAds(sc, true);
  assert.deepEqual(ads.map((a) => [Math.round(a.s), Math.round(a.e)]), [[0, Math.round(1900 * FD48)], [Math.round(91900 * FD48), Math.round(94400 * FD48)]]);
});

test("one steady encoding (the show alone) has no seams and no ads", () => {
  const sc = scan(join2(encode(40000, 9)));
  assert.deepEqual(paddingBreaks(sc), []);
  assert.deepEqual(spliceAds(sc, true), []);
});

test("chapters in the file's own tag titled as ads", () => {
  const enc = new TextEncoder();
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const ss = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
  const frame = (id: string, body: number[]) => [...enc.encode(id), ...ss(body.length), 0, 0, ...body];
  const chap = (el: string, s: number, e: number, title: string) => frame("CHAP", [...enc.encode(el), 0, ...be(s), ...be(e), 255, 255, 255, 255, 255, 255, 255, 255, ...frame("TIT2", [3, ...enc.encode(title)])]);
  const body = [...chap("c0", 0, 60_000, "Intro"), ...chap("c1", 60_000, 120_500, "Sponsor: Acme"), ...chap("c2", 120_500, 900_000, "The interview")];
  const tag = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, ...ss(body.length), ...body]);
  const ch = id3Chapters(tag);
  assert.deepEqual(ch.map((c) => c.title), ["Intro", "Sponsor: Acme", "The interview"]);
  assert.deepEqual(chapterAdsIn(ch), [{ s: 60, e: 120.5, label: "Sponsor: Acme" }]);
  // The scanner keeps the tag for this.
  const sc = scan(join2([tag, ...encode(500, 1)]));
  assert.equal(id3Chapters(sc.tagHead!).length, 3);
});

test("an ad found once is recognised in another episode, wherever it plays", () => {
  const ad = encode(1200, 77, { mode: 0 });
  const a = scan(join2([...encode(2000, 1), ...ad, ...encode(2000, 2)]));
  const lib = createAdLibrary(undefined, { saveEveryMs: 3_600_000 });
  try {
    assert.equal(lib.learn(a, [{ s: 2000 * FD, e: 3200 * FD }]), 1);
    assert.equal(lib.learn(a, [{ s: 2000 * FD, e: 3200 * FD }]), 0, "not kept twice");
    const b = scan(join2([...encode(500, 3), ...ad, ...encode(3000, 4)]));
    const found = lib.match(b);
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.ok(near(found[0].s, 500 * FD, 0.1) && near(found[0].e, 1700 * FD, 0.1), JSON.stringify(found[0]));
    assert.deepEqual(lib.match(scan(join2(encode(5000, 5)))), [], "nothing in an episode without it");
  } finally { lib.stop(); }
});

test("sponsors named in episode notes", () => {
  const notes = `<p>This week: the fall of Rome.</p><p>Sponsors: BetterHelp, Rocket Money and Quince.</p><p>Go to shopify.com/ancients for a free trial. Follow us on instagram.com/theshow. Visit our site theancients.com</p>`;
  const got = sponsorsFromNotes(notes);
  for (const want of ["betterhelp", "rocket money", "quince", "shopify"]) assert.ok(got.includes(want), `${want} in ${got}`);
  assert.ok(!got.includes("instagram") && !got.includes("theancients"), String(got));
});

test("a listener's copy has its seam ads (and known ads) before any other copy is compared", async () => {
  const dir = mkdtempSync(join(tmpdir(), "earshot-splice-"));
  const ad = encode(700, 55, { mode: 0 });
  const show = encode(9000, 56);
  const copy = join2([...ad, ...show]);
  // The bot's copy never finishes arriving here, so only this copy's own seams can tell.
  const host = async (url: string, o: any, scanner = new Mp3Scanner()) => {
    const bytes = String(o.ua).startsWith("bot") ? new Uint8Array(0) : copy;
    o.onHeaders?.(200, bytes.length, "audio/mpeg");
    const out = o.file ? createWriteStream(o.file) : null;
    for (let i = 0; i < bytes.length; i += 64000) {
      const chunk = bytes.subarray(i, i + 64000);
      if (out) await new Promise<void>((r) => out.write(chunk, () => r()));
      scanner.push(chunk); o.onWritten?.(i + chunk.length); o.onProgress?.(i + chunk.length, scanner);
      await new Promise((r) => setImmediate(r));
    }
    scanner.end();
    if (out) await new Promise<void>((r) => out.end(() => r()));
    if (String(o.ua).startsWith("bot")) await new Promise((r) => setTimeout(r, 5000));
    return { info: { ua: o.ua, status: 200, finalUrl: url, type: "audio/mpeg", length: bytes.length, bytes: bytes.length, frames: scanner.count, duration: scanner.time, kbps: 128, rate: 44100, junk: 0, ms: 1 }, scanner };
  };
  const library = createAdLibrary(undefined, { saveEveryMs: 3_600_000 });
  const player = createPlayer({ dir, download: host as any, key: Buffer.alloc(32, 3), library });
  try {
    const s = player.open({ sid: "splice-session-0001", voter: "u1", episodeId: "e1", showId: "s1", url: "https://host.example/a.mp3", ua: "AppleCoreMedia", ip: "" });
    for (let t = 0; t < 100 && !s.ads.ready; t++) await new Promise((r) => setTimeout(r, 30));
    assert.ok(s.ads.ready, "ready without a comparison copy");
    const pre = s.ads.ads.find((a) => a.kind === "splice");
    assert.ok(pre && near(pre.s, 0) && near(pre.e, 700 * FD, 0.05) && pre.sure, JSON.stringify(s.ads));
    assert.ok(near(s.ads.startAt ?? 0, 700 * FD, 0.05), `the show starts after the pre-roll: ${JSON.stringify(s.ads)}`);
  } finally { player.stop(); library.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test("an ad learned from one episode is skipped in another, even where every copy has it", async () => {
  const dirs = [mkdtempSync(join(tmpdir(), "earshot-lib-a-")), mkdtempSync(join(tmpdir(), "earshot-lib-b-"))];
  const host = (listener: Uint8Array, bot: Uint8Array) => async (url: string, o: any, scanner = new Mp3Scanner()) => {
    const bytes = String(o.ua).startsWith("bot") ? bot : listener;
    o.onHeaders?.(200, bytes.length, "audio/mpeg");
    const out = o.file ? createWriteStream(o.file) : null;
    for (let i = 0; i < bytes.length; i += 64000) {
      const chunk = bytes.subarray(i, i + 64000);
      if (out) await new Promise<void>((r) => out.write(chunk, () => r()));
      scanner.push(chunk); o.onWritten?.(i + chunk.length); o.onProgress?.(i + chunk.length, scanner);
      await new Promise((r) => setImmediate(r));
    }
    scanner.end();
    if (out) await new Promise<void>((r) => out.end(() => r()));
    return { info: { ua: o.ua, status: 200, finalUrl: url, type: "audio/mpeg", length: bytes.length, bytes: bytes.length, frames: scanner.count, duration: scanner.time, kbps: 128, rate: 44100, junk: 0, ms: 1 }, scanner };
  };
  // The same ad, encoded like the show (no seams to see), in two episodes.
  const ad = encode(1500, 99);
  const showA = encode(8000, 100), showB = encode(8000, 200);
  const library = createAdLibrary(undefined, { saveEveryMs: 3_600_000 });
  // Episode A: the bot's copy has no ad, so comparing finds it, and the library learns it.
  const pa = createPlayer({ dir: dirs[0], download: host(join2([...showA.slice(0, 4000), ...ad, ...showA.slice(4000)]), join2(showA)) as any, key: Buffer.alloc(32, 1), library });
  // Episode B: every copy has it (comparing sees nothing), but it's known.
  const pb = createPlayer({ dir: dirs[1], download: host(join2([...showB.slice(0, 2000), ...ad, ...showB.slice(2000)]), join2([...showB.slice(0, 2000), ...ad, ...showB.slice(2000)])) as any, key: Buffer.alloc(32, 2), library });
  try {
    const a = pa.open({ sid: "library-session-aaaa", voter: "u1", episodeId: "ea", showId: "s1", url: "https://h/a.mp3", ua: "App", ip: "" });
    for (let t = 0; t < 200 && !a.learned; t++) await new Promise((r) => setTimeout(r, 30));
    assert.equal(library.size(), 1, JSON.stringify(a.ads));
    const b = pb.open({ sid: "library-session-bbbb", voter: "u1", episodeId: "eb", showId: "s2", url: "https://h/b.mp3", ua: "App", ip: "" });
    for (let t = 0; t < 200 && !(b.ads.final && b.ads.ads.some((x) => x.kind === "known")); t++) await new Promise((r) => setTimeout(r, 30));
    const k = b.ads.ads.find((x) => x.kind === "known");
    assert.ok(b.ads.how === "same", `comparing alone finds nothing: ${b.ads.how}`);
    assert.ok(k && near(k.s, 2000 * FD, 0.1) && near(k.e, 3500 * FD, 0.1) && k.sure, JSON.stringify(b.ads));
  } finally { pa.stop(); pb.stop(); library.stop(); dirs.forEach((d) => rmSync(d, { recursive: true, force: true })); }
});
