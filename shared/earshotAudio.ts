// Finding stitched-in ads by comparing copies of the same episode (Earshot + Podscroll).
//
// Big podcast hosts stitch different ads into every download (dynamic ad insertion), but the show
// itself is the same audio in every copy, down to the byte. So if two copies are cut into MP3 frames
// and each frame is fingerprinted, the show lines up frame for frame between them, and whatever in
// one copy has no match in the other is an ad that was stitched in. No transcript or AI needed,
// and the cut is exact (to one frame, ~26 ms).
//
// Mp3Scanner reads a copy as it downloads; alignCopies() lines two copies up; the rest turns that
// into ad ranges and maps times between copies.

const BITRATES = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] } as const;
const RATES = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000] } as const;

type Header = { len: number; dur: number; kbps: number; rate: number; v: 1 | 2 | 25; mono: boolean; crc: boolean; shape: number };
/** An MP3 (Layer III) frame header at b[i], or null. shape: the header fields that stay the same
 *  through one encoding (version, sample rate, channel mode, copyright/original, emphasis, CRC). */
export function frameHeader(b: Uint8Array, i: number): Header | null {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const vb = (b[i + 1] >> 3) & 3, lb = (b[i + 1] >> 1) & 3, bi = b[i + 2] >> 4, si = (b[i + 2] >> 2) & 3;
  if (vb === 1 || lb !== 1 || bi === 0 || bi === 15 || si === 3) return null;
  const v = vb === 3 ? 1 : vb === 2 ? 2 : 25;
  const kbps = BITRATES[v === 1 ? 1 : 2][bi], rate = RATES[v][si], pad = (b[i + 2] >> 1) & 1;
  const spf = v === 1 ? 1152 : 576;
  const len = Math.floor(((v === 1 ? 144 : 72) * kbps * 1000) / rate) + pad;
  const mode = b[i + 3] >> 6;
  const shape = (vb << 12) | (si << 10) | (mode << 8) | ((b[i + 1] & 1) << 4) | (b[i + 3] & 0x0f);
  return len > 4 ? { len, dur: spf / rate, kbps, rate, v, mono: mode === 3, crc: (b[i + 1] & 1) === 0, shape } : null;
}

/** Signs that a copy was stitched together at a frame: a tag or stray bytes between frames, an
 *  encoder's info frame, a change of sample rate / channel mode / header flags, or of a steady bitrate. */
export type Join = { i: number; t: number; kind: "id3" | "junk" | "info" | "shape" | "kbps"; bytes?: number; frames?: number; enc?: string; from?: number; to?: number };
const ascii = (b: Uint8Array, at: number, n: number) => { let s = ""; for (let k = 0; k < n && at + k < b.length; k++) s += String.fromCharCode(b[at + k]); return s; };
/** An encoder info frame (Xing/Info/VBRI): its own frame count and encoder name, or null. */
function infoFrame(b: Uint8Array, i: number, h: Header, end: number): { frames?: number; enc?: string } | null {
  const side = h.v === 1 ? (h.mono ? 17 : 32) : (h.mono ? 9 : 17);
  const at = i + 4 + (h.crc ? 2 : 0) + side;
  const tag = ascii(b, at, 4);
  let frames: number | undefined;
  if (tag === "Xing" || tag === "Info") { if (b[at + 7] & 1) frames = ((b[at + 8] << 24) | (b[at + 9] << 16) | (b[at + 10] << 8) | b[at + 11]) >>> 0; }
  else if (ascii(b, i + 36, 4) === "VBRI") frames = ((b[i + 50] << 24) | (b[i + 51] << 16) | (b[i + 52] << 8) | b[i + 53]) >>> 0;
  else return null;
  let enc: string | undefined;
  for (let k = at; k + 4 <= end; k++) { const w = ascii(b, k, 4); if (w === "LAME" || w === "Lavc" || w === "Lavf" || w === "GOGO") { enc = ascii(b, k, 9).replace(/[^\x20-\x7e]/g, ""); break; } }
  return { frames, enc };
}
const isTag = (b: Uint8Array, i: number) => i + 3 <= b.length && ((b[i] === 0x54 && b[i + 1] === 0x41 && b[i + 2] === 0x47) || (b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x33) || (b[i] === 0x41 && b[i + 1] === 0x50 && b[i + 2] === 0x45));

/** FNV-1a over a frame's body (the header is left out: its padding/private bits can differ). */
function hashBytes(b: Uint8Array, from: number, to: number): number {
  let h = 0x811c9dc5;
  for (let k = from; k < to; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Reads an MP3 as it arrives, keeping each frame's fingerprint, byte offset and start time. */
export class Mp3Scanner {
  hashes = new Uint32Array(8192);
  offsets = new Float64Array(8192);
  starts = new Float64Array(8192);
  /** Per frame: bit 0 padded, bit 1 its bit reservoir starts empty (main_data_begin 0), bits 4-7 bitrate index. */
  flags = new Uint8Array(8192);
  count = 0;
  /** Seconds of audio scanned so far. */
  time = 0;
  /** Bytes that weren't part of a frame (tags, junk). */
  junk = 0;
  kbps = 0; rate = 0;
  /** Where the copy looks stitched together (first 3000). */
  joins: Join[] = [];
  private buf = new Uint8Array(0);
  private lastShape = -1;
  private runKbps = 0;
  private runLen = 0;
  private pendingJunk = 0;
  private pendingTag = 0;
  private bufStart = 0;
  private skipUntil = 0;
  private id3Checked = false;

  push(chunk: Uint8Array) {
    if (!chunk.length) return;
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf); merged.set(chunk, this.buf.length);
    this.buf = merged;
    this.parse(false);
  }
  end() { this.parse(true); }
  /** Total bytes handed in so far. */
  get bytes() { return this.bufStart + this.buf.length; }

  private join(j: Omit<Join, "i" | "t">) { if (this.joins.length < 3000) this.joins.push({ i: this.count, t: Math.round(this.time * 1000) / 1000, ...j }); }

  private add(hash: number, off: number, dur: number, flag: number) {
    if (this.count === this.hashes.length) {
      const n = this.hashes.length * 2;
      const h = new Uint32Array(n); h.set(this.hashes); this.hashes = h;
      const o = new Float64Array(n); o.set(this.offsets); this.offsets = o;
      const s = new Float64Array(n); s.set(this.starts); this.starts = s;
      const f = new Uint8Array(n); f.set(this.flags); this.flags = f;
    }
    this.hashes[this.count] = hash; this.offsets[this.count] = off; this.starts[this.count] = this.time; this.flags[this.count] = flag;
    this.count++; this.time += dur;
  }
  /** Trims the arrays to what's used (once a copy is complete). */
  compact() {
    const n = this.count;
    this.hashes = this.hashes.slice(0, n); this.offsets = this.offsets.slice(0, n); this.starts = this.starts.slice(0, n); this.flags = this.flags.slice(0, n);
    this.buf = new Uint8Array(0);
  }

  private parse(final: boolean) {
    const b = this.buf;
    let i = 0;
    if (!this.id3Checked) {
      if (b.length < 10 && !final) return;
      this.id3Checked = true;
      if (b.length >= 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
        this.skipUntil = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f)) + ((b[5] & 0x10) ? 10 : 0);
      }
    }
    for (;;) {
      const abs = this.bufStart + i;
      if (abs < this.skipUntil) {
        const n = Math.min(b.length - i, this.skipUntil - abs);
        i += n; this.junk += n; this.pendingTag += n;
        if (this.bufStart + i < this.skipUntil) break;
        continue;
      }
      if (i + 4 > b.length) break;
      const h = frameHeader(b, i);
      if (!h) {
        // An ID3 tag can also sit in the middle (some hosts stitch tagged ads): skip it whole.
        if (i + 10 <= b.length && b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x33 && b[i + 3] < 5) {
          this.skipUntil = this.bufStart + i + 10 + ((b[i + 6] & 0x7f) << 21 | (b[i + 7] & 0x7f) << 14 | (b[i + 8] & 0x7f) << 7 | (b[i + 9] & 0x7f));
          continue;
        }
        i++; this.junk++; this.pendingJunk++; continue;
      }
      if (i + h.len > b.length) { if (final) { this.junk += b.length - i; i = b.length; } break; }
      // Check that another frame (or a tag, or the end) follows, so stray 0xFF bytes aren't taken for frames.
      const next = i + h.len;
      if (next + 4 > b.length) { if (!final) break; }
      else if (!frameHeader(b, next) && !isTag(b, next)) { i++; this.junk++; this.pendingJunk++; continue; }
      if (!this.kbps) { this.kbps = h.kbps; this.rate = h.rate; }
      // Signs of a join, noted at this frame.
      if (this.pendingTag) { this.join({ kind: "id3", bytes: this.pendingTag }); this.pendingTag = 0; }
      if (this.pendingJunk) { this.join({ kind: "junk", bytes: this.pendingJunk }); this.pendingJunk = 0; }
      const info = infoFrame(b, i, h, next);
      if (info) this.join({ kind: "info", ...info });
      if (this.lastShape >= 0 && h.shape !== this.lastShape) this.join({ kind: "shape", from: this.lastShape, to: h.shape });
      this.lastShape = h.shape;
      if (h.kbps !== this.runKbps) { if (this.runLen >= 40) this.join({ kind: "kbps", from: this.runKbps, to: h.kbps }); this.runKbps = h.kbps; this.runLen = 1; } else this.runLen++;
      const si = i + 4 + (h.crc ? 2 : 0);
      const mdb = h.v === 1 ? ((b[si] << 1) | (b[si + 1] >> 7)) : b[si];
      this.add(hashBytes(b, i + 4, next), this.bufStart + i, h.dur, ((b[i + 2] >> 1) & 1) | (mdb === 0 ? 2 : 0) | (b[i + 2] & 0xf0));
      i = next;
    }
    this.buf = b.slice(i);
    this.bufStart += i;
  }

  /** Index of the frame playing at time t (seconds). */
  frameAt(t: number): number {
    let lo = 0, hi = this.count - 1;
    if (hi < 0) return -1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.starts[mid] <= t) lo = mid; else hi = mid - 1; }
    return lo;
  }
  /** Start time of frame i (the end of the audio for i === count). */
  timeOf(i: number): number { return i >= this.count ? this.time : i <= 0 ? 0 : this.starts[i]; }
}

/** A stretch that's the same in two copies: frames a.. in copy A match b.. in copy B, n frames long. */
export type Run = { a: number; b: number; n: number };

/** Lines copy A up against copy B: the stretches of identical frames, in order. Stretches are found
 *  from 8-frame pieces that occur once in each copy (silence repeats, speech doesn't), kept only if
 *  they run forward in both copies, then grown frame by frame in both directions, through any
 *  silence the copies share. minRun: shortest stretch kept (40 frames ≈ 1 second). */
export function alignCopies(A: Uint32Array, nA: number, B: Uint32Array, nB: number, k = 8, minRun = 40): Run[] {
  if (nA < k || nB < k) return [];
  const keyAt = (h: Uint32Array, i: number) => { let x = 0; for (let t = 0; t < k; t++) x = (Math.imul(x, 31) + h[i + t]) >>> 0; return x; };
  // Pieces seen once in B (-1: more than once), then the ones also seen once in A.
  const inB = new Map<number, number>();
  for (let j = 0; j + k <= nB; j++) { const x = keyAt(B, j); inB.set(x, inB.has(x) ? -1 : j); }
  const inA = new Map<number, number>();
  for (let i = 0; i + k <= nA; i++) { const x = keyAt(A, i); inA.set(x, inA.has(x) ? -1 : i); }
  const pa: number[] = [], pb: number[] = [];
  for (let i = 0; i + k <= nA; i++) {
    const x = keyAt(A, i);
    if (inA.get(x) !== i) continue;
    const j = inB.get(x);
    if (j === undefined || j < 0) continue;
    let same = true; for (let t = 0; t < k; t++) if (A[i + t] !== B[j + t]) { same = false; break; }
    if (same) { pa.push(i); pb.push(j); }
  }
  // Longest chain running forward in both copies (patience sorting).
  const tails: number[] = [], prev = new Int32Array(pa.length).fill(-1);
  for (let x = 0; x < pa.length; x++) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pb[tails[mid]] < pb[x]) lo = mid + 1; else hi = mid; }
    if (lo > 0) prev[x] = tails[lo - 1];
    tails[lo] = x;
  }
  const chain: number[] = [];
  for (let x = tails.length ? tails[tails.length - 1] : -1; x >= 0; x = prev[x]) chain.push(x);
  chain.reverse();
  // Grow each piece into a stretch; pieces already inside the last stretch are skipped.
  const runs: Run[] = [];
  let endA = 0, endB = 0;
  for (const x of chain) {
    let i = pa[x], j = pb[x];
    const last = runs[runs.length - 1];
    if (last && i - j === last.a - last.b && i < last.a + last.n) continue;
    if (i < endA || j < endB) continue;
    while (i > endA && j > endB && A[i - 1] === B[j - 1]) { i--; j--; }
    let n = 0;
    while (i + n < nA && j + n < nB && A[i + n] === B[j + n]) n++;
    runs.push({ a: i, b: j, n });
    endA = i + n; endB = j + n;
  }
  return runs.filter((r) => r.n >= minRun);
}

export type Span = { s: number; e: number };
/** The parts of a copy that matched nothing in the other copy, as time ranges (seconds), ignoring
 *  slivers under `minSecs` (frames re-cut at the joins). side: "a" or "b" of the runs. */
export function unmatched(runs: Run[], side: "a" | "b", frames: number, timeOf: (i: number) => number, minSecs = 4): Span[] {
  const out: Span[] = [];
  let at = 0;
  const sorted = runs.slice().sort((x, y) => x[side] - y[side]);
  for (const r of sorted) {
    const from = r[side];
    if (from > at && timeOf(from) - timeOf(at) >= minSecs) out.push({ s: timeOf(at), e: timeOf(from) });
    at = Math.max(at, from + r.n);
  }
  if (frames > at && timeOf(frames) - timeOf(at) >= minSecs) out.push({ s: timeOf(at), e: timeOf(frames) });
  return out;
}

/** How much of a copy (by time) is matched in the other. */
export function coverage(runs: Run[], side: "a" | "b", frames: number, timeOf: (i: number) => number): number {
  const total = timeOf(frames);
  if (!(total > 0)) return 0;
  return runs.reduce((s, r) => s + (timeOf(r[side] + r.n) - timeOf(r[side])), 0) / total;
}

/** Time anchors for moving times between copies: within each matched stretch, a time in one copy
 *  is the same moment in the other. x: this copy, r: the other (reference) copy, len: seconds. */
export type Anchor = { x: number; r: number; len: number };
export function anchorsFor(runs: Run[], timeA: (i: number) => number, timeB: (i: number) => number): Anchor[] {
  return runs.map((r) => ({ x: timeA(r.a), r: timeB(r.b), len: timeA(r.a + r.n) - timeA(r.a) }));
}
/** A reference time in this copy, or null when that moment isn't in this copy. */
export function refToCopy(anchors: Anchor[], t: number, slack = 0.5): number | null {
  for (const a of anchors) if (t >= a.r - slack && t <= a.r + a.len + slack) return a.x + Math.max(0, Math.min(a.len, t - a.r));
  return null;
}
/** A time in this copy as the reference time, or null when it's not shared with the reference. */
export function copyToRef(anchors: Anchor[], t: number, slack = 0.5): number | null {
  for (const a of anchors) if (t >= a.x - slack && t <= a.x + a.len + slack) return a.r + Math.max(0, Math.min(a.len, t - a.x));
  return null;
}
/** A reference range as it falls in this copy: the parts that exist here (an ad split by a cut stays one range). */
export function rangeToCopy(anchors: Anchor[], s: number, e: number): Span | null {
  const parts: Span[] = [];
  for (const a of anchors) {
    const lo = Math.max(s, a.r), hi = Math.min(e, a.r + a.len);
    if (hi - lo > 0.3) parts.push({ s: a.x + (lo - a.r), e: a.x + (hi - a.r) });
  }
  if (!parts.length) return null;
  return { s: Math.min(...parts.map((p) => p.s)), e: Math.max(...parts.map((p) => p.e)) };
}
