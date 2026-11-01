// Cuts an uploaded recording into pieces the speech-to-text services take (under 25 MB each, a few
// minutes long), right on the device, so a two-hour, 500 MB file never has to be sent whole.
//
//   MP3                → cut between MPEG frames (each piece is a normal MP3; nothing is re-encoded).
//   M4A, MP4, MOV, 3GP → the sound track is copied out into small M4A files (video is left behind).
//   WAV                → turned into 16 kHz mono WAV pieces (speech needs no more).
//   anything else      → sent whole when it's small enough; otherwise decoded here when the browser
//                         can, and sent as WAV pieces.
//
// Every piece knows where it starts in the recording, so the transcript's times line up.

export type AudioPiece = { blob: Blob; ext: "mp3" | "m4a" | "wav" | "webm" | "ogg" | "mp4" | "flac"; start: number; secs: number };
export type UploadPlan = { kind: "mp3" | "mp4" | "wav" | "whole" | "decoded"; total: number; count: number; pieces: () => AsyncGenerator<AudioPiece> };
export type SplitOptions = { pieceSecs: number; maxBytes: number; name?: string };

export class SplitError extends Error {}

const read = async (b: Blob, start: number, end: number) => new Uint8Array(await b.slice(start, end).arrayBuffer());
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const extOf = (name: string, type: string) => {
  const e = (name.split(".").pop() || "").toLowerCase();
  if (/mpeg|mp3/.test(type) || e === "mp3") return "mp3";
  if (e === "wav" || /wav|wave/.test(type)) return "wav";
  if (["m4a", "mp4", "mov", "3gp", "m4v", "aac"].includes(e) || /mp4|quicktime|3gpp|m4a|aac/.test(type)) return e === "aac" ? "aac" : "mp4";
  if (e === "webm" || /webm/.test(type)) return "webm";
  if (e === "ogg" || e === "oga" || e === "opus" || /ogg|opus/.test(type)) return "ogg";
  if (e === "flac" || /flac/.test(type)) return "flac";
  return e || "bin";
};

/** A last piece of a second or two isn't worth sending on its own: it joins the one before. */
function mergeTail(cuts: { from: number; to: number; start: number; secs: number }[], maxBytes: number, bytesOf: (c: { from: number; to: number }) => number) {
  if (cuts.length < 2) return;
  const last = cuts[cuts.length - 1], prev = cuts[cuts.length - 2];
  if (last.secs >= 3 || bytesOf({ from: prev.from, to: last.to }) > maxBytes) return;
  prev.to = last.to;
  prev.secs = r3(prev.secs + last.secs);
  cuts.pop();
}

// ─── MP3 ─────────────────────────────────────────────────────────────────────

const BITRATES: Record<string, number[]> = {
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const RATES = [[44100, 48000, 32000], [22050, 24000, 16000], [11025, 12000, 8000]];

/** One MPEG audio frame header at `i`: its length in bytes and how many seconds it holds. */
export function mp3Frame(b: Uint8Array, i: number): { len: number; secs: number } | null {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const ver = (b[i + 1] >> 3) & 3; // 3: MPEG1, 2: MPEG2, 0: MPEG2.5
  const layer = (b[i + 1] >> 1) & 3; // 3: I, 2: II, 1: III
  const bi = (b[i + 2] >> 4) & 15, si = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
  if (ver === 1 || layer === 0 || bi === 0 || bi === 15 || si === 3) return null;
  const v = ver === 3 ? 1 : 2;
  const l = 4 - layer; // 1, 2 or 3
  const table = v === 1 ? BITRATES[`1-${l}`] : BITRATES[l === 1 ? "2-1" : "2-2"];
  const kbps = table[bi];
  const sr = RATES[ver === 3 ? 0 : ver === 2 ? 1 : 2][si];
  if (!kbps || !sr) return null;
  const samples = l === 1 ? 384 : l === 2 ? 1152 : v === 1 ? 1152 : 576;
  const len = l === 1 ? (Math.floor((12 * kbps * 1000) / sr) + pad) * 4 : Math.floor(((samples / 8) * kbps * 1000) / sr) + pad;
  return len >= 24 ? { len, secs: samples / sr } : null;
}

/** Where to cut an MP3: byte ranges of whole frames, each under the time and size limits. */
async function planMp3(file: Blob, o: SplitOptions): Promise<{ cuts: { from: number; to: number; start: number; secs: number }[]; total: number }> {
  let pos = 0;
  const head = await read(file, 0, Math.min(file.size, 10));
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
    pos = 10 + ((head[6] & 0x7f) << 21 | (head[7] & 0x7f) << 14 | (head[8] & 0x7f) << 7 | (head[9] & 0x7f)) + (head[5] & 0x10 ? 10 : 0);
  }
  const cuts: { from: number; to: number; start: number; secs: number }[] = [];
  const CHUNK = 4 * 1024 * 1024;
  let buf = new Uint8Array(0), bufAt = pos;
  let time = 0, pieceFrom = -1, pieceStart = 0, frames = 0, first = true, synced = false;
  const close = (to: number) => { if (pieceFrom >= 0 && to > pieceFrom) cuts.push({ from: pieceFrom, to, start: r3(pieceStart), secs: r3(time - pieceStart) }); pieceFrom = -1; };
  while (pos + 4 <= file.size) {
    // Keep a few kilobytes ahead of where we are in memory (the rest of the file stays on disk).
    if (pos < bufAt || pos + 4096 > bufAt + buf.length) {
      if (bufAt + buf.length < file.size || pos < bufAt || pos + 4 > bufAt + buf.length) { buf = await read(file, pos, Math.min(file.size, pos + CHUNK)); bufAt = pos; }
    }
    const at = pos - bufAt;
    const f = mp3Frame(buf, at);
    // Out of step (a tag, or damage): a frame only counts when the one after it is a frame too.
    if (!f || (!synced && at + f.len + 4 <= buf.length && !mp3Frame(buf, at + f.len))) { synced = false; pos++; continue; }
    synced = true;
    // The first frame of many MP3s is an "Info"/"Xing" header that holds the whole file's length; it
    // would make each piece claim to be the whole file, so it isn't sent.
    if (first) {
      first = false;
      const window = String.fromCharCode(...buf.subarray(at + 4, Math.min(buf.length, at + 4 + 40)));
      if (/Xing|Info|VBRI/.test(window)) { pos += f.len; continue; }
    }
    if (pieceFrom < 0) { pieceFrom = pos; pieceStart = time; }
    if (time - pieceStart >= o.pieceSecs || pos + f.len - pieceFrom > o.maxBytes) { close(pos); pieceFrom = pos; pieceStart = time; }
    time += f.secs; frames++;
    pos += f.len;
  }
  close(Math.min(pos, file.size));
  mergeTail(cuts, o.maxBytes, (c) => c.to - c.from);
  if (!frames) throw new SplitError("This MP3 couldn't be read. It may be damaged.");
  return { cuts, total: r3(time) };
}

// ─── MP4 / M4A / MOV ─────────────────────────────────────────────────────────

type Box = { type: string; start: number; size: number; head: number };
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const str4 = (b: Uint8Array, i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
function boxesIn(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let i = from;
  while (i + 8 <= to) {
    let size = u32(b, i), head = 8;
    const type = str4(b, i + 4);
    if (size === 1) { size = u32(b, i + 8) * 2 ** 32 + u32(b, i + 12); head = 16; }
    else if (size === 0) size = to - i;
    if (size < head || i + size > to) break;
    out.push({ type, start: i, size, head });
    i += size;
  }
  return out;
}
const child = (b: Uint8Array, box: Box, type: string, skip = 0) => boxesIn(b, box.start + box.head + skip, box.start + box.size).find((x) => x.type === type);

/** The top-level boxes of the file, reading only their headers. */
async function topBoxes(file: Blob): Promise<Box[]> {
  const out: Box[] = [];
  let i = 0;
  while (i + 8 <= file.size && out.length < 1000) {
    const h = await read(file, i, Math.min(file.size, i + 16));
    let size = u32(h, 0), head = 8;
    const type = str4(h, 4);
    if (!/^[\x20-\x7e]{4}$/.test(type)) break;
    if (size === 1) { size = u32(h, 8) * 2 ** 32 + u32(h, 12); head = 16; }
    else if (size === 0) size = file.size - i;
    if (size < head) break;
    out.push({ type, start: i, size: Math.min(size, file.size - i), head });
    i += size;
  }
  return out;
}

export type SoundTrack = { timescale: number; stsd: Uint8Array; sizes: number[]; offsets: number[]; durations: number[]; total: number };

/** The first sound track's samples: where each one is in the file, how big and how long. */
export function readSoundTrack(moov: Uint8Array): SoundTrack | null {
  const root: Box = { type: "moov", start: 0, size: moov.length, head: 8 };
  for (const trak of boxesIn(moov, root.head, moov.length).filter((x) => x.type === "trak")) {
    const mdia = child(moov, trak, "mdia");
    const hdlr = mdia && child(moov, mdia, "hdlr");
    if (!mdia || !hdlr || str4(moov, hdlr.start + hdlr.head + 8) !== "soun") continue;
    const mdhd = child(moov, mdia, "mdhd")!;
    const v = moov[mdhd.start + mdhd.head];
    const timescale = v === 1 ? u32(moov, mdhd.start + mdhd.head + 20) : u32(moov, mdhd.start + mdhd.head + 12);
    const minf = child(moov, mdia, "minf");
    const stbl = minf && child(moov, minf, "stbl");
    if (!stbl || !timescale) continue;
    const get = (t: string) => child(moov, stbl, t);
    const stsd = get("stsd"), stts = get("stts"), stsc = get("stsc"), stsz = get("stsz"), stco = get("stco"), co64 = get("co64");
    if (!stsd || !stts || !stsc || !stsz || (!stco && !co64)) continue;
    // Sample sizes.
    const zb = stsz.start + stsz.head;
    const fixed = u32(moov, zb + 4), count = u32(moov, zb + 8);
    const sizes = new Array<number>(count);
    for (let k = 0; k < count; k++) sizes[k] = fixed || u32(moov, zb + 12 + k * 4);
    // Chunk offsets.
    const cb = (stco ?? co64)!.start + (stco ?? co64)!.head;
    const chunks = u32(moov, cb + 4);
    const chunkAt = new Array<number>(chunks);
    for (let k = 0; k < chunks; k++) chunkAt[k] = stco ? u32(moov, cb + 8 + k * 4) : u32(moov, cb + 8 + k * 8) * 2 ** 32 + u32(moov, cb + 12 + k * 8);
    // Samples in each chunk.
    const sb = stsc.start + stsc.head;
    const runs = u32(moov, sb + 4);
    const offsets = new Array<number>(count);
    let s = 0;
    for (let r = 0; r < runs; r++) {
      const firstChunk = u32(moov, sb + 8 + r * 12) - 1;
      const per = u32(moov, sb + 12 + r * 12);
      const lastChunk = r + 1 < runs ? u32(moov, sb + 8 + (r + 1) * 12) - 1 : chunks;
      for (let c = firstChunk; c < lastChunk && s < count; c++) {
        let at = chunkAt[c];
        for (let k = 0; k < per && s < count; k++) { offsets[s] = at; at += sizes[s]; s++; }
      }
    }
    if (s < count) return null;
    // Sample durations.
    const tb = stts.start + stts.head;
    const entries = u32(moov, tb + 4);
    const durations = new Array<number>(count);
    let d = 0, total = 0;
    for (let e = 0; e < entries; e++) {
      const n = u32(moov, tb + 8 + e * 8), delta = u32(moov, tb + 12 + e * 8);
      for (let k = 0; k < n && d < count; k++) { durations[d++] = delta; total += delta; }
    }
    while (d < count) { durations[d++] = 1024; total += 1024; }
    return { timescale, stsd: moov.slice(stsd.start, stsd.start + stsd.size), sizes, offsets, durations, total };
  }
  return null;
}

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const box = (type: string, ...parts: (Uint8Array | number[])[]) => {
  const body = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const len = 8 + body.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  out.set(be32(len), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  let at = 8;
  for (const p of body) { out.set(p, at); at += p.length; }
  return out;
};
const MATRIX = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0];
const zeros = (n: number) => new Array(n).fill(0);

/** A small M4A file holding samples [from, to) of the sound track, with their bytes in `data`. */
export function buildM4a(t: SoundTrack, from: number, to: number, data: Uint8Array): Uint8Array {
  const n = to - from;
  let dur = 0;
  const stts: number[] = [];
  let runCount = 0, runDelta = -1, runs = 0;
  for (let k = from; k < to; k++) {
    dur += t.durations[k];
    if (t.durations[k] === runDelta) runCount++;
    else { if (runDelta >= 0) { stts.push(...be32(runCount), ...be32(runDelta)); runs++; } runDelta = t.durations[k]; runCount = 1; }
  }
  if (runDelta >= 0) { stts.push(...be32(runCount), ...be32(runDelta)); runs++; }
  const sizes: number[] = [];
  for (let k = from; k < to; k++) sizes.push(...be32(t.sizes[k]));
  const ftyp = box("ftyp", [..."M4A ".split("").map((c) => c.charCodeAt(0)), 0, 0, 2, 0, ..."M4A isomiso2mp41".split("").map((c) => c.charCodeAt(0))]);
  const make = (chunkOffset: number) => box("moov",
    box("mvhd", [0, 0, 0, 0], zeros(8), be32(t.timescale), be32(dur), [0, 1, 0, 0, 1, 0], zeros(10), MATRIX, zeros(24), be32(2)),
    box("trak",
      box("tkhd", [0, 0, 0, 7], zeros(8), be32(1), zeros(4), be32(dur), zeros(8), [0, 0, 0, 0, 1, 0, 0, 0], MATRIX, zeros(8)),
      box("mdia",
        box("mdhd", [0, 0, 0, 0], zeros(8), be32(t.timescale), be32(dur), [0x55, 0xc4, 0, 0]),
        box("hdlr", zeros(8), [..."soun".split("").map((c) => c.charCodeAt(0))], zeros(12), [..."SoundHandler".split("").map((c) => c.charCodeAt(0)), 0]),
        box("minf",
          box("smhd", zeros(8)),
          box("dinf", box("dref", [0, 0, 0, 0], be32(1), box("url ", [0, 0, 0, 1]))),
          box("stbl",
            t.stsd,
            box("stts", [0, 0, 0, 0], be32(runs), stts),
            box("stsc", [0, 0, 0, 0], be32(1), be32(1), be32(n), be32(1)),
            box("stsz", [0, 0, 0, 0], be32(0), be32(n), sizes),
            box("stco", [0, 0, 0, 0], be32(1), be32(chunkOffset)),
          ),
        ),
      ),
    ),
  );
  // The chunk offset points into mdat, which comes after moov: work out moov's size first.
  const moov0 = make(0);
  const moov = make(ftyp.length + moov0.length + 8);
  const mdatHead = new Uint8Array(8);
  mdatHead.set(be32(8 + data.length), 0);
  mdatHead.set([0x6d, 0x64, 0x61, 0x74], 4);
  const out = new Uint8Array(ftyp.length + moov.length + 8 + data.length);
  out.set(ftyp, 0); out.set(moov, ftyp.length); out.set(mdatHead, ftyp.length + moov.length); out.set(data, ftyp.length + moov.length + 8);
  return out;
}

async function planMp4(file: Blob, o: SplitOptions) {
  const tops = await topBoxes(file);
  if (tops.some((b) => b.type === "moof")) return null; // a fragmented file: not this way
  const moovBox = tops.find((b) => b.type === "moov");
  if (!moovBox || moovBox.size > 64 * 1024 * 1024) return null;
  const moov = await read(file, moovBox.start, moovBox.start + moovBox.size);
  const track = readSoundTrack(moov);
  if (!track || !track.sizes.length) throw new SplitError("This video or audio file has no sound track that could be read.");
  const cuts: { from: number; to: number; start: number; secs: number }[] = [];
  const limit = o.maxBytes - 64 * 1024 - track.sizes.length * 0; // room for the small M4A header
  let from = 0, bytes = 0, t = 0, startT = 0;
  for (let k = 0; k < track.sizes.length; k++) {
    const secsSoFar = (t - startT) / track.timescale;
    if (k > from && (secsSoFar >= o.pieceSecs || bytes + track.sizes[k] + (k - from) * 4 > limit)) {
      cuts.push({ from, to: k, start: r3(startT / track.timescale), secs: r3(secsSoFar) });
      from = k; bytes = 0; startT = t;
    }
    bytes += track.sizes[k];
    t += track.durations[k];
  }
  cuts.push({ from, to: track.sizes.length, start: r3(startT / track.timescale), secs: r3((t - startT) / track.timescale) });
  mergeTail(cuts, o.maxBytes - 64 * 1024, (c) => track.sizes.slice(c.from, c.to).reduce((a, b) => a + b, 0));
  return { track, cuts, total: r3(track.total / track.timescale) };
}

/** The bytes of samples [from, to): read in runs where they sit next to each other in the file. */
async function samplesData(file: Blob, t: SoundTrack, from: number, to: number): Promise<Uint8Array> {
  const total = t.sizes.slice(from, to).reduce((a, b) => a + b, 0);
  const out = new Uint8Array(total);
  const runs: { at: number; len: number; into: number }[] = [];
  let into = 0;
  for (let k = from; k < to; k++) {
    const last = runs[runs.length - 1];
    if (last && last.at + last.len === t.offsets[k] && last.len < 8 * 1024 * 1024) last.len += t.sizes[k];
    else runs.push({ at: t.offsets[k], len: t.sizes[k], into });
    into += t.sizes[k];
  }
  for (let i = 0; i < runs.length; i += 24) {
    await Promise.all(runs.slice(i, i + 24).map(async (r) => { out.set(await read(file, r.at, r.at + r.len), r.into); }));
  }
  return out;
}

// ─── WAV ─────────────────────────────────────────────────────────────────────

type WavInfo = { format: number; channels: number; rate: number; bits: number; dataAt: number; dataLen: number };
export async function readWav(file: Blob): Promise<WavInfo | null> {
  const h = await read(file, 0, Math.min(file.size, 4096));
  if (str4(h, 0) !== "RIFF" || str4(h, 8) !== "WAVE") return null;
  const le16 = (i: number) => h[i] | (h[i + 1] << 8);
  const le32 = (i: number) => (h[i] | (h[i + 1] << 8) | (h[i + 2] << 16) | (h[i + 3] << 24)) >>> 0;
  let i = 12, fmt: Omit<WavInfo, "dataAt" | "dataLen"> | null = null;
  while (i + 8 <= h.length) {
    const id = str4(h, i), len = le32(i + 4);
    if (id === "fmt ") {
      let format = le16(i + 8);
      if (format === 0xfffe && len >= 26) format = le16(i + 8 + 24);
      fmt = { format, channels: le16(i + 10), rate: le32(i + 12), bits: le16(i + 22) };
    } else if (id === "data") {
      if (!fmt) return null;
      const dataAt = i + 8;
      const dataLen = len === 0 || len === 0xffffffff || dataAt + len > file.size ? file.size - dataAt : len;
      return { ...fmt, dataAt, dataLen };
    }
    i += 8 + len + (len & 1);
  }
  return null;
}

/** 16-bit mono WAV bytes from samples (-1..1) at `rate`. */
export function wavBytes(samples: Float32Array | Int16Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const w = (i: number, s: string) => { for (let k = 0; k < 4; k++) out[i + k] = s.charCodeAt(k); };
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples.length * 2, true);
  if (samples instanceof Int16Array) new Int16Array(out.buffer, 44, samples.length).set(samples);
  else for (let k = 0; k < samples.length; k++) v.setInt16(44 + k * 2, Math.max(-32768, Math.min(32767, Math.round(samples[k] * 32767))), true);
  return out;
}

const SPEECH_RATE = 16000;
/** Reads seconds [start, start + secs) of a PCM WAV as 16 kHz mono, a few megabytes at a time. */
async function wavPiece(file: Blob, w: WavInfo, start: number, secs: number): Promise<Uint8Array> {
  const bps = w.bits / 8, frame = bps * w.channels;
  const firstFrame = Math.floor(start * w.rate), frames = Math.min(Math.floor(secs * w.rate), Math.floor(w.dataLen / frame) - firstFrame);
  const outLen = Math.max(0, Math.floor((frames * SPEECH_RATE) / w.rate));
  const out = new Int16Array(outLen);
  const step = w.rate / SPEECH_RATE;
  const STEP_FRAMES = Math.floor((4 * 1024 * 1024) / frame);
  let o = 0;
  const sampleAt = (dv: DataView, at: number) => {
    let sum = 0;
    for (let c = 0; c < w.channels; c++) {
      const p = at + c * bps;
      sum += w.format === 3 ? (bps === 8 ? dv.getFloat64(p, true) : dv.getFloat32(p, true))
        : bps === 1 ? (dv.getUint8(p) - 128) / 128 : bps === 2 ? dv.getInt16(p, true) / 32768 : bps === 3 ? ((dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getInt8(p + 2) << 16)) / 8388608) : dv.getInt32(p, true) / 2147483648;
    }
    return sum / w.channels;
  };
  for (let f0 = 0; f0 < frames && o < outLen; f0 += STEP_FRAMES) {
    const f1 = Math.min(frames, f0 + STEP_FRAMES + 2);
    const bytes = await read(file, w.dataAt + (firstFrame + f0) * frame, w.dataAt + (firstFrame + f1) * frame);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const have = Math.floor(bytes.length / frame);
    while (o < outLen) {
      const pos = o * step - f0; // position in this block, in source frames
      if (pos >= STEP_FRAMES || pos + 1 >= have) break;
      const i0 = Math.floor(pos), frac = pos - i0;
      const a = sampleAt(dv, i0 * frame), b = sampleAt(dv, (i0 + 1) * frame);
      out[o++] = Math.max(-32768, Math.min(32767, Math.round((a + (b - a) * frac) * 32767)));
    }
  }
  return wavBytes(o === outLen ? out : out.subarray(0, o), SPEECH_RATE);
}

// ─── Anything else ───────────────────────────────────────────────────────────

/** How long a recording is, from the browser's own player (0 when it can't tell). */
export function mediaDuration(blob: Blob, timeoutMs = 8000): Promise<number> {
  if (typeof document === "undefined" || typeof URL === "undefined") return Promise.resolve(0);
  return new Promise((resolve) => {
    const el = document.createElement("audio");
    const url = URL.createObjectURL(blob);
    let done = false;
    const finish = (d: number) => { if (done) return; done = true; URL.revokeObjectURL(url); el.removeAttribute("src"); resolve(Number.isFinite(d) && d > 0 ? d : 0); };
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) return finish(el.duration);
      // Recordings made in a browser often don't say how long they are until the end is reached.
      el.ondurationchange = () => { if (Number.isFinite(el.duration) && el.duration > 0) finish(el.duration); };
      try { el.currentTime = 1e101; } catch { finish(0); }
    };
    el.onerror = () => finish(0);
    setTimeout(() => finish(0), timeoutMs);
    el.src = url;
  });
}

async function decodeToWav(file: Blob, o: SplitOptions): Promise<{ wav: Float32Array; total: number } | null> {
  const AC: any = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
  if (!AC || file.size > 160 * 1024 * 1024) return null;
  let ctx: any;
  try {
    ctx = new AC({ sampleRate: SPEECH_RATE });
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const mono = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let k = 0; k < d.length; k++) mono[k] += d[k] / buf.numberOfChannels; }
    // Some browsers decode at the file's own rate: bring it to 16 kHz.
    if (buf.sampleRate !== SPEECH_RATE) {
      const out = new Float32Array(Math.floor((mono.length * SPEECH_RATE) / buf.sampleRate));
      const step = buf.sampleRate / SPEECH_RATE;
      for (let k = 0; k < out.length; k++) { const p = k * step, i = Math.floor(p), f = p - i; out[k] = mono[i] + ((mono[i + 1] ?? mono[i]) - mono[i]) * f; }
      return { wav: out, total: out.length / SPEECH_RATE };
    }
    void o;
    return { wav: mono, total: mono.length / SPEECH_RATE };
  } catch { return null; }
  finally { try { await ctx?.close?.(); } catch { /* closed */ } }
}

/** Works out how to send a file, and hands its pieces over one at a time. */
export async function planUpload(file: Blob, o: SplitOptions): Promise<UploadPlan> {
  const name = o.name || (file as File).name || "";
  const kind = extOf(name, file.type || "");
  // WAV pieces are 16 kHz mono: 32,000 bytes a second.
  const wavSecs = Math.min(o.pieceSecs, Math.floor((o.maxBytes - 1024) / 32000));

  if (kind === "mp3") {
    const { cuts, total } = await planMp3(file, o);
    return { kind: "mp3", total, count: cuts.length, pieces: async function* () { for (const c of cuts) yield { blob: file.slice(c.from, c.to, "audio/mpeg"), ext: "mp3", start: c.start, secs: c.secs }; } };
  }
  if (kind === "mp4") {
    const p = await planMp4(file, o);
    if (p) {
      return {
        kind: "mp4", total: p.total, count: p.cuts.length,
        pieces: async function* () {
          for (const c of p.cuts) {
            const data = await samplesData(file, p.track, c.from, c.to);
            yield { blob: new Blob([buildM4a(p.track, c.from, c.to, data) as BlobPart], { type: "audio/mp4" }), ext: "m4a", start: c.start, secs: c.secs };
          }
        },
      };
    }
  }
  if (kind === "wav") {
    const w = await readWav(file);
    if (w && (w.format === 1 || w.format === 3) && [8, 16, 24, 32, 64].includes(w.bits) && w.channels > 0 && w.rate > 0) {
      const total = r3(w.dataLen / ((w.bits / 8) * w.channels) / w.rate);
      if (file.size <= o.maxBytes && total <= o.pieceSecs) return { kind: "whole", total, count: 1, pieces: async function* () { yield { blob: file, ext: "wav", start: 0, secs: total }; } };
      const starts: number[] = [];
      for (let s = 0; s < total; s += wavSecs) starts.push(s);
      return { kind: "wav", total, count: starts.length, pieces: async function* () { for (const s of starts) { const secs = Math.min(wavSecs, total - s); yield { blob: new Blob([await wavPiece(file, w, s, secs) as BlobPart], { type: "audio/wav" }), ext: "wav", start: r3(s), secs: r3(secs) }; } } };
    }
  }
  // Small enough to send as it is.
  const sendAs = (["webm", "ogg", "flac", "mp4"] as const).find((e) => e === kind) ?? (kind === "aac" ? "mp4" : null);
  if (file.size <= o.maxBytes && sendAs) {
    const total = r3(await mediaDuration(file));
    return { kind: "whole", total, count: 1, pieces: async function* () { yield { blob: file, ext: sendAs === "mp4" ? "m4a" : sendAs, start: 0, secs: total }; } };
  }
  const decoded = await decodeToWav(file, o);
  if (decoded) {
    const starts: number[] = [];
    for (let s = 0; s < decoded.total; s += wavSecs) starts.push(s);
    return {
      kind: "decoded", total: r3(decoded.total), count: starts.length,
      pieces: async function* () { for (const s of starts) { const a = Math.floor(s * SPEECH_RATE), b = Math.min(decoded.wav.length, Math.floor((s + wavSecs) * SPEECH_RATE)); yield { blob: new Blob([wavBytes(decoded.wav.subarray(a, b), SPEECH_RATE) as BlobPart], { type: "audio/wav" }), ext: "wav", start: r3(s), secs: r3((b - a) / SPEECH_RATE) }; } },
    };
  }
  throw new SplitError(kind === "bin" ? "That file type can't be read. Upload an MP3, M4A, WAV, WebM or MP4 file." : "This file is too big to read here. Save it as MP3 or M4A and upload it again.");
}
