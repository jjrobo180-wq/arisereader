// Finding stitched-in ads from the seams in one copy (Earshot + Podscroll), with no other copy, no
// transcript and no AI.
//
// When a host stitches an ad into an episode, the ad is its own MP3 file glued between pieces of the
// show, and the glue shows:
//  - Header shape: the ad was encoded with other settings, so its frame headers differ (Simplecast's ads
//    carry other header flags than the show, start to end).
//  - Padding rhythm: at 44.1 kHz an encoder pads frames in a steady pattern; a new file restarts it, so
//    the pattern breaks exactly at each join (Megaphone).
//  - An encoder info frame (Xing/Info/LAME), an ID3 tag or stray bytes in the middle of the audio, or
//    a steady bitrate that changes.
// The show itself is one encoding, so it's long; the stretches between joins that are short are ads.
//
// Also here: chapters written into the file's own ID3 tag (CHAP frames), which some hosts title "Ad".
import type { Join } from "./earshotAudio";

export type ScanLike = { count: number; time: number; flags: Uint8Array; joins: Join[]; timeOf(i: number): number };
export type SpliceAd = { s: number; e: number; sure: boolean; why: "shape" | "seam" };
type Point = { t: number; w: "strong" | "seam" | "blip" };

/** Where the padding rhythm breaks: frame times at which a new encoding seems to start. Only for a
 *  steady bitrate (one bitrate for 95% of frames); otherwise there's no rhythm to read. */
export function paddingBreaks(sc: Pick<ScanLike, "count" | "flags" | "timeOf">): number[] {
  if (sc.count < 400) return [];
  const byRate = new Map<number, number>();
  for (let i = 0; i < sc.count; i++) { const r = sc.flags[i] & 0xf0; byRate.set(r, (byRate.get(r) || 0) + 1); }
  const [rate, n] = [...byRate.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n < sc.count * 0.95) return [];
  const gaps = new Map<number, number>();
  const unpadded: number[] = [];
  for (let i = 0; i < sc.count; i++) {
    const f = sc.flags[i];
    if ((f & 0xf0) !== rate || (f & 1)) continue;
    if (unpadded.length) { const g = i - unpadded[unpadded.length - 1]; gaps.set(g, (gaps.get(g) || 0) + 1); }
    unpadded.push(i);
  }
  // No padding at all (48 kHz) or padding on every frame: nothing to read.
  if (unpadded.length < 50 || unpadded.length > sc.count * 0.9) return [];
  const common = [...gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  // The rhythm must really be steady: the two usual gaps are almost all of them.
  const usual = common.reduce((a, x) => a + x[1], 0);
  if (usual < (unpadded.length - 1) * 0.97) return [];
  const ok = new Set(common.map((x) => x[0]));
  const out: number[] = [];
  for (let k = 1; k < unpadded.length; k++) if (!ok.has(unpadded[k] - unpadded[k - 1])) out.push(sc.timeOf(unpadded[k]));
  return out;
}

/** Frames whose bit reservoir starts empty: every encoding's first frame is one. Where they're rare
 *  (no more than one in five minutes, after the first), each is taken for the start of a new file:
 *  the way to see seams in 48 kHz audio, which has no padding rhythm. */
export function reservoirStarts(sc: Pick<ScanLike, "count" | "flags" | "timeOf" | "time">): number[] {
  if (sc.count < 400) return [];
  const out: number[] = [];
  const cap = Math.max(12, sc.time / 300);
  for (let i = 1; i < sc.count; i++) if (sc.flags[i] & 2) { out.push(sc.timeOf(i)); if (out.length > cap) return []; }
  return out;
}

/** The copy's joins as points in time, close ones merged (a seam often shows several ways at once). */
function points(sc: Pick<ScanLike, "joins">, pads: number[]): Point[] {
  const raw: Point[] = [];
  const shapes = sc.joins.filter((j) => j.kind === "shape");
  for (let k = 0; k < shapes.length; k++) {
    const j = shapes[k], n = shapes[k + 1];
    // One odd frame and back (a boundary frame): a seam, not a change of encoding.
    if (n && n.t - j.t < 0.1 && n.to === j.from) { raw.push({ t: j.t, w: "seam" }); k++; continue; }
    raw.push({ t: j.t, w: "strong" });
  }
  for (const j of sc.joins) {
    if (j.t < 1) continue;
    if (j.kind === "info" || j.kind === "id3") raw.push({ t: j.t, w: "strong" });
    else if (j.kind === "junk" && (j.bytes ?? 0) >= 64) raw.push({ t: j.t, w: "seam" });
    else if (j.kind === "kbps") raw.push({ t: j.t, w: "seam" });
  }
  for (const t of pads) raw.push({ t, w: "seam" });
  raw.sort((a, b) => a.t - b.t);
  const out: Point[] = [];
  const rank = { strong: 2, seam: 1, blip: 0 } as const;
  for (const p of raw) {
    const last = out[out.length - 1];
    if (last && p.t - last.t < 1.2) { if (rank[p.w] > rank[last.w]) last.w = p.w; continue; }
    out.push({ ...p });
  }
  return out;
}

/** Times where this copy looks stitched together (for cutting a break into its separate ads). */
export function seamTimes(sc: ScanLike): number[] { return points(sc, [...paddingBreaks(sc), ...reservoirStarts(sc)].sort((a, b) => a - b)).map((p) => p.t); }

/** Shape changes as a timeline: which header shape each stretch has (none when it never changes). */
function shapeStretches(sc: Pick<ScanLike, "joins">, end: number): { s: number; e: number; shape: number }[] {
  const changes = sc.joins.filter((j) => j.kind === "shape" && typeof j.from === "number" && typeof j.to === "number");
  if (!changes.length) return [];
  const out: { s: number; e: number; shape: number }[] = [];
  let t = 0, shape = changes[0].from!;
  for (const c of changes) { if (c.t > t) out.push({ s: t, e: c.t, shape }); t = c.t; shape = c.to!; }
  if (end > t) out.push({ s: t, e: end, shape });
  return out;
}

const AD_MIN = 6, AD_MAX = 150, BREAK_MAX = 8 * 60;

/** Ads in one copy from its seams. done: the whole copy has been read (so its last stretch is whole). */
export function spliceAds(sc: ScanLike, done: boolean): SpliceAd[] {
  if (sc.count < 400) return [];
  // Empty reservoirs are only counted once the whole copy is in (how rare they are decides).
  return adsFromSeams(sc.joins, [...paddingBreaks(sc), ...(done ? reservoirStarts(sc) : [])].sort((a, b) => a - b), sc.time, done);
}
/** The same from a copy's joins and padding breaks (as kept by the copy diagnostics). */
export function adsFromSeams(joins: Join[], pads: number[], end: number, done: boolean): SpliceAd[] {
  const sc = { joins };
  const out: SpliceAd[] = [];

  // 1. Header shape: the shape that covers most of the audio is the show; stretches in another shape
  //    are what was stitched in (they can hold several ads, so up to a whole break long).
  const stretches = shapeStretches(sc, end).filter((x) => x.e - x.s >= 0.5);
  if (stretches.length >= 2) {
    const total = new Map<number, number>();
    for (const x of stretches) total.set(x.shape, (total.get(x.shape) || 0) + (x.e - x.s));
    const [main, mainSecs] = [...total.entries()].sort((a, b) => b[1] - a[1])[0];
    const others = stretches.filter((x) => x.shape !== main && x.e - x.s >= AD_MIN && x.e - x.s <= BREAK_MAX && (done || x.e < end - 0.5));
    const otherSecs = others.reduce((a, x) => a + (x.e - x.s), 0);
    // Before the copy is all in, the show must already have had a long stretch to be told apart.
    if ((done || mainSecs >= 300) && mainSecs >= end * 0.55 && otherSecs <= end * 0.4) for (const x of others) out.push({ s: x.s, e: x.e, sure: true, why: "shape" });
  }

  // 2. Seams: short stretches between joins are ads; the show is the long ones.
  const pts = points(sc, pads);
  // Seams everywhere means the rhythm or headers just vary in this file: nothing to learn from them.
  if (pts.length <= Math.max(8, end / 90)) {
    const cuts = [0, ...pts.map((p) => p.t), ...(done ? [end] : [])];
    const kind = (t: number) => (t === 0 || t === end ? "edge" : pts.find((p) => p.t === t)!.w);
    const short: { s: number; e: number; a: string; b: string }[] = [];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const s = cuts[k], e = cuts[k + 1];
      if (e - s >= AD_MIN && e - s <= AD_MAX) short.push({ s, e, a: kind(s), b: kind(e) });
    }
    // Neighbouring short stretches are one break.
    const breaks: { s: number; e: number; parts: typeof short }[] = [];
    for (const x of short) {
      const last = breaks[breaks.length - 1];
      if (last && x.s - last.e < 1.5 && x.e - last.s <= BREAK_MAX) { last.e = x.e; last.parts.push(x); }
      else breaks.push({ s: x.s, e: x.e, parts: [x] });
    }
    const adSecs = breaks.reduce((a, b) => a + (b.e - b.s), 0);
    // (Early in a copy the pre-roll is a big share of what's in: judged against at least 15 minutes.)
    if (adSecs <= (done ? end : Math.max(end, 900)) * 0.35) for (const b of breaks) {
      // Sure when both ends are real joins (or the very start / end of the episode).
      const sure = b.parts[0].a !== "blip" && b.parts[b.parts.length - 1].b !== "blip" && b.e - b.s >= 10;
      out.push({ s: Math.round(b.s * 100) / 100, e: Math.round(b.e * 100) / 100, sure, why: "seam" });
    }
  }

  // Overlaps between the two ways: one range, sure if either is.
  out.sort((a, b) => a.s - b.s);
  const merged: SpliceAd[] = [];
  for (const a of out) {
    const l = merged[merged.length - 1];
    if (l && a.s <= l.e + 1) { l.e = Math.max(l.e, a.e); l.sure = l.sure || a.sure; if (a.why === "shape") l.why = "shape"; }
    else merged.push({ ...a });
  }
  return merged.filter((a) => a.e - a.s >= AD_MIN && a.e - a.s <= BREAK_MAX);
}

// ---------------------------------------------------------------------------
// Chapters in the file's own ID3 tag
// ---------------------------------------------------------------------------

export type FileChapter = { s: number; e: number; title: string };
const syncsafe = (b: Uint8Array, i: number) => ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f);
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
function text(b: Uint8Array): string {
  if (!b.length) return "";
  const enc = b[0], body = b.subarray(1);
  try {
    if (enc === 1 || enc === 2) return new TextDecoder(enc === 2 ? "utf-16be" : body[0] === 0xfe ? "utf-16be" : "utf-16le").decode(body[0] === 0xff || body[0] === 0xfe ? body.subarray(2) : body).replace(/\0+$/, "");
    if (enc === 3) return new TextDecoder("utf-8").decode(body).replace(/\0+$/, "");
    return Array.from(body, (c) => String.fromCharCode(c)).join("").replace(/\0+$/, "");
  } catch { return ""; }
}
/** Frames in an ID3v2.3/2.4 frame area: id, body. */
function* frames(b: Uint8Array, from: number, to: number, v: number): Generator<[string, Uint8Array]> {
  let i = from;
  while (i + 10 <= to) {
    const id = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) return;
    const size = v >= 4 ? syncsafe(b, i + 4) : u32(b, i + 4);
    if (size <= 0 || i + 10 + size > to) return;
    yield [id, b.subarray(i + 10, i + 10 + size)];
    i += 10 + size;
  }
}
/** Chapters (CHAP frames, with their titles) from the ID3 tag at the start of a file. */
export function id3Chapters(b: Uint8Array): FileChapter[] {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return [];
  const v = b[3], flags = b[5];
  if (v < 3 || v > 4 || (flags & 0x80)) return []; // unsynchronised tags are rare: skipped
  const size = syncsafe(b, 6), end = Math.min(b.length, 10 + size);
  let from = 10;
  if (flags & 0x40) from += v >= 4 ? syncsafe(b, 10) : u32(b, 10) + 4;
  const out: FileChapter[] = [];
  for (const [id, body] of frames(b, from, end, v)) {
    if (id !== "CHAP") continue;
    const z = body.indexOf(0);
    if (z < 0 || z + 17 > body.length) continue;
    const s = u32(body, z + 1) / 1000, e = u32(body, z + 5) / 1000;
    let title = "";
    for (const [sid, sb] of frames(body, z + 17, body.length, v)) if (sid === "TIT2") { title = text(sb).trim(); break; }
    if (e > s && s >= 0 && e < 24 * 3600) out.push({ s, e, title });
  }
  return out.sort((a, b2) => a.s - b2.s);
}
/** File chapters titled as ads. */
export function chapterAdsIn(chapters: FileChapter[]): { s: number; e: number; label: string }[] {
  return chapters
    .filter((c) => /\b(ads?|sponsors?|sponsored|advert(isement)?s?|commercials?|ad break|promo(tion)?s?|midroll|preroll|postroll)\b/i.test(c.title) && c.e - c.s >= 5 && c.e - c.s <= 420)
    .map((c) => ({ s: c.s, e: c.e, label: c.title.slice(0, 60) || "Ad" }));
}
