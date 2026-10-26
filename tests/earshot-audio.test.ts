// Finding stitched-in ads by comparing copies (Earshot + Podscroll): the MP3 frame reader, lining
// two copies up, the unmatched parts, and moving times between copies.
import test from "node:test";
import assert from "node:assert/strict";
import { Mp3Scanner, alignCopies, unmatched, coverage, anchorsFor, refToCopy, copyToRef, rangeToCopy } from "../shared/earshotAudio";
import { packCopy, unpackCopy } from "../server/podcastCopies";
const ok = (c: unknown, m: string) => assert.ok(c, m);

// 128 kbps / 44.1 kHz MPEG-1 Layer III frames: 417 bytes, 1152/44100 s each.
const FD = 1152 / 44100;
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; }; }
function frames(n: number, seed: number) {
  const r = rng(seed), out: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const f = new Uint8Array(417); f.set([0xff, 0xfb, 0x90, 0x00]);
    for (let k = 4; k < 417; k++) f[k] = r() >>> 24;
    out.push(f);
  }
  return out;
}
function id3(size: number) { const t = new Uint8Array(10 + size); t.set([0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]); for (let i = 10; i < t.length; i++) t[i] = 0xff; return t; }
function join(parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
function scan(bytes: Uint8Array, seed: number) { const sc = new Mp3Scanner(), r = rng(seed); let i = 0; while (i < bytes.length) { const n = 1 + (r() % 70000); sc.push(bytes.subarray(i, i + n)); i += n; } sc.end(); return sc; }

test("two copies with different stitched ads line up, and the ads fall out", () => {
  const show = frames(6000, 1); // ~157 s of show
  const a = join([id3(60000), ...frames(600, 2), ...show.slice(0, 3000), ...frames(400, 3), ...show.slice(3000)]);
  const b = join([id3(23000), ...frames(300, 4), ...show.slice(0, 3000), ...frames(800, 5), ...show.slice(3000), ...frames(200, 6)]);
  const A = scan(a, 7), B = scan(b, 8);
  assert.equal(A.count, 7000, "every frame of copy A read past a 60 KB tag");
  assert.equal(B.count, 7300, "every frame of copy B read");
  ok(Math.abs(A.time - 7000 * FD) < 1e-3, "copy A length");
  const runs = alignCopies(A.hashes, A.count, B.hashes, B.count);
  assert.equal(runs.length, 2, "two shared stretches");
  assert.deepEqual(runs.map((r) => [r.a, r.b, r.n]), [[600, 300, 3000], [4000, 4100, 3000]]);
  const adsA = unmatched(runs, "a", A.count, (i) => A.timeOf(i));
  const adsB = unmatched(runs, "b", B.count, (i) => B.timeOf(i));
  assert.equal(adsA.length, 2); assert.equal(adsB.length, 3);
  ok(Math.abs(adsA[0].s) < 1e-3 && Math.abs(adsA[0].e - 600 * FD) < 1e-3, "copy A's pre-roll exactly");
  ok(Math.abs(adsA[1].s - 3600 * FD) < 1e-3 && Math.abs(adsA[1].e - 4000 * FD) < 1e-3, "copy A's mid-roll exactly");
  ok(Math.abs(adsB[2].s - 7100 * FD) < 1e-3, "copy B's post-roll");
  ok(Math.abs(coverage(runs, "a", A.count, (i) => A.timeOf(i)) - 6000 / 7000) < 1e-3, "coverage");
  // Moving times between copies: B is the reference here.
  const anchors = anchorsFor(runs, (i) => A.timeOf(i), (i) => B.timeOf(i));
  ok(Math.abs(refToCopy(anchors, 300 * FD + 10)! - (600 * FD + 10)) < 1e-3, "a reference moment found in copy A");
  ok(Math.abs(copyToRef(anchors, 4000 * FD + 5)! - (4100 * FD + 5)) < 1e-3, "and back");
  assert.equal(refToCopy(anchors, 3500 * FD), null, "B's own ad isn't in copy A");
  const r = rangeToCopy(anchors, 3000 * FD, 3400 * FD)!; // a range in B covering the end of stretch 1 (B's ad sits after it)
  ok(r && Math.abs(r.e - 3600 * FD) < 1e-3, "range clipped to what A has");
  // Packing for storage.
  const p = unpackCopy(JSON.parse(JSON.stringify(packCopy(A))));
  assert.equal(p.n, A.count); ok(Math.abs(p.duration - A.time) < 1e-3, "packed duration");
  assert.deepEqual(Array.from(p.hashes.slice(0, 50)), Array.from(A.hashes.slice(0, 50)), "packed fingerprints");
  ok(Math.abs(p.timeOf(4000) - A.timeOf(4000)) < 1e-3, "packed frame times");
});

test("identical copies have nothing unmatched; junk bytes and stray sync words don't break the reader", () => {
  const show = frames(2000, 11);
  const junk = new Uint8Array(3000); for (let i = 0; i < junk.length; i++) junk[i] = i % 7 === 0 ? 0xff : 0xe3;
  const a = join([...show.slice(0, 1000), junk, ...show.slice(1000)]);
  const b = join([...show]);
  const A = scan(a, 12), B = scan(b, 13);
  assert.equal(A.count, 2000, "junk skipped, frames intact");
  const runs = alignCopies(A.hashes, A.count, B.hashes, B.count);
  assert.equal(unmatched(runs, "b", B.count, (i) => B.timeOf(i)).length, 0, "nothing unmatched");
  ok(coverage(runs, "b", B.count, (i) => B.timeOf(i)) > 0.999, "full coverage");
});

test("silence that repeats all through a show doesn't throw the line-up off", () => {
  const silent = () => { const f = new Uint8Array(417); f.set([0xff, 0xfb, 0x90, 0x00]); f.fill(0x55, 4); return f; };
  const quiet = (n: number) => Array.from({ length: n }, silent);
  const show = [...quiet(200), ...frames(2000, 21), ...quiet(150), ...frames(2000, 22), ...quiet(300), ...frames(1500, 23)];
  const adA = [...quiet(60), ...frames(700, 24), ...quiet(60)], adB = [...quiet(90), ...frames(500, 25), ...quiet(30)];
  const cut = 200 + 2000 + 75; // the ad goes in the middle of the second silence
  const A = scan(join([...adA, ...show.slice(0, cut), ...adA, ...show.slice(cut)]), 26);
  const B = scan(join([...adB, ...show.slice(0, cut), ...adB, ...show.slice(cut)]), 27);
  const runs = alignCopies(A.hashes, A.count, B.hashes, B.count);
  const adsA = unmatched(runs, "a", A.count, (i) => A.timeOf(i));
  assert.equal(adsA.length, 2, "two ads in copy A: " + JSON.stringify(adsA));
  // Silence on either side of an ad can't be told apart from the show's own silence, so the cut lands
  // within that silence — never inside speech.
  ok(adsA[0].s < 1 && adsA[0].e >= 760 * FD - 1e-3 && adsA[0].e <= (820 + 200) * FD + 1e-3, "pre-roll covers the ad's sound");
  const midStart = (820 + cut) * FD, midEnd = (820 + cut + 820) * FD;
  ok(adsA[1].s <= midStart + 60 * FD + 1e-3 && adsA[1].s >= (820 + 200 + 2000) * FD - 1e-3, "mid-roll starts in the silence");
  ok(adsA[1].e >= midEnd - 60 * FD - 1e-3 && adsA[1].e <= midEnd + 75 * FD + 1e-3, "mid-roll ends in the silence");
  ok(coverage(runs, "a", A.count, (i) => A.timeOf(i)) > 0.7, "most of copy A is shared");
});

test("the reader notes where a copy was stitched together", () => {
  const info = (count: number) => { const f = frames(1, 31)[0]; f.fill(0, 4); f.set([0x49, 0x6e, 0x66, 0x6f, 0, 0, 0, 1, (count >>> 24) & 255, (count >>> 16) & 255, (count >>> 8) & 255, count & 255], 36); f.set([0x4c, 0x41, 0x4d, 0x45, 0x33, 0x2e, 0x31, 0x30, 0x30], 156); return f; };
  const mono = (n: number, seed: number) => frames(n, seed).map((f) => { f[3] = 0xc0; return f; });
  const bytes = join([id3(5000), ...frames(500, 32), id3(1200), info(300), ...mono(300, 33), ...frames(400, 34)]);
  const sc = scan(bytes, 35);
  const kinds = sc.joins.map((j) => `${j.i}:${j.kind}`);
  assert.deepEqual(kinds, ["0:id3", "500:id3", "500:info", "501:shape", "801:shape"], kinds.join(","));
  assert.equal(sc.joins[2].frames, 300, "the info frame says how long its piece is");
  assert.equal(sc.joins[2].enc, "LAME3.100");
});
