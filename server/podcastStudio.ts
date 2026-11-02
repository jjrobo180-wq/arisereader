// Pod+ Studio: two ways to turn a person's own writing into something to listen to.
//
//   Study Pod+   study notes → a short podcast episode (two hosts talking it through, or one teacher),
//                with the key points and a few quiz questions to check yourself.
//   Meeting Pod  meeting notes → a summary, the decisions, the action items (who and when) and the
//                open questions, plus a one-minute spoken recap.
//
// AI writes the script (the site's usual chat AI: OpenAI when it's on, else Groq; see
// podcastDirectory.openAiJson). The voices are Groq's Orpheus voices (groqVoice.ts). Nothing is
// posted or shared: the notes come in, the result goes back to the one person who asked, and the
// app keeps it on their device. Made audio is kept under a hash of its words (voice-cache bucket and
// a small memory cache), so playing the same pod again doesn't make it again.
import express, { type Express, type RequestHandler } from "express";
import { IMAGE_DATA, canSeePhotos, looksReadable, pdfText, readPhoto } from "./studioReading";
import { createHash } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { joinWavs } from "./audiobooks";
import type { BlobStore } from "./blobStore";
import type { AskJson } from "./podcastDirectory";
import type { Speech } from "./groqVoice";

export type Line = { speaker: "A" | "B"; text: string };
export type StudyPod = { title: string; summary: string; keyPoints: string[]; lines: Line[]; quiz: { q: string; a: string }[] };
export type MeetingPod = { title: string; summary: string; decisions: string[]; actions: { task: string; owner: string; due: string }[]; questions: string[]; lines: Line[] };

export const NOTES_MAX = 20_000;
const SPOKEN_MAX = 9_000;
/** The two hosts' voices (Groq Orpheus). */
export const VOICES = { A: "hannah", B: "austin" } as const;
export const HOSTS = { A: "Maya", B: "Leo" } as const;

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const list = (v: unknown, n: number, each: number) => (Array.isArray(v) ? v : []).map((x) => clip(x, each)).filter(Boolean).slice(0, n);
/** Notes as they were typed or pasted: line breaks kept, nothing else unusual. */
export const cleanNotes = (v: unknown) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, NOTES_MAX);

/** The AI's lines, made safe: two speakers only, plain words, not too long in all. */
export function cleanLines(raw: unknown, solo = false): Line[] {
  const out: Line[] = [];
  let total = 0;
  for (const l of Array.isArray(raw) ? raw : []) {
    const text = clip(l?.text ?? l?.line, 700).replace(/[*_#`]/g, "");
    if (!text) continue;
    const who = String(l?.speaker ?? l?.host ?? "A").trim();
    const speaker: "A" | "B" = solo ? "A" : /^(b|leo|2|host b|host 2)$/i.test(who) ? "B" : "A";
    if (total + text.length > SPOKEN_MAX) break;
    total += text.length;
    out.push({ speaker, text });
  }
  return out;
}

export function studyPrompt(length: "quick" | "full", style: "duo" | "solo"): string {
  const words = length === "full" ? "about 750 words (around 6 minutes)" : "about 380 words (around 3 minutes)";
  const cast = style === "duo"
    ? `Two friendly hosts, ${HOSTS.A} (speaker "A") and ${HOSTS.B} (speaker "B"), talk it through like a good study-buddy podcast: they take turns, ask each other questions, use simple examples, and repeat the most important ideas in a memorable way.`
    : `One warm teacher (speaker "A") explains it like a short podcast lesson, with simple examples, and repeats the most important ideas in a memorable way.`;
  return `You turn a student's study notes into a podcast episode they will listen to while studying.
${cast}
Write ${words} of spoken words. Start with a one-line hello that names the topic, cover every main idea in the notes in a sensible order, and end with a quick recap of the key points.
Stay true to the notes: explain and connect what is there, and only add widely known background that helps understanding. Never invent names, numbers, dates or facts that aren't in the notes. If the notes are thin, keep it short rather than padding.
Write for the ear: short sentences, no lists, no markdown, no stage directions, no sound effects, no emoji.
Also give: a title (under 60 characters), a one or two sentence summary, 3 to 7 key points, and 3 to 5 quiz questions with short answers, all from the notes.
Reply with JSON only: {"title": "...", "summary": "...", "keyPoints": ["..."], "lines": [{"speaker": "A", "text": "..."}], "quiz": [{"q": "...", "a": "..."}]}`;
}

export function meetingPrompt(): string {
  return `You summarize meeting notes for the person who took them. Use only what is in the notes; never invent people, dates, numbers or decisions. When something is unclear in the notes, leave it out or list it as an open question.
Give:
- title: a short name for the meeting (under 60 characters)
- summary: 2 to 4 plain sentences on what the meeting was about and where things stand
- decisions: what was decided (empty list if nothing was)
- actions: each to-do with its owner and due date as written in the notes ("" when the notes don't say)
- questions: things left open or to follow up on
- lines: a spoken recap of about 150 words, one narrator (speaker "A"), written for the ear: short sentences, no lists, no markdown, no emoji. It says the main points, the decisions, and who is doing what next.
Reply with JSON only: {"title": "...", "summary": "...", "decisions": ["..."], "actions": [{"task": "...", "owner": "...", "due": "..."}], "questions": ["..."], "lines": [{"speaker": "A", "text": "..."}]}`;
}

export function cleanStudy(raw: any, solo: boolean): StudyPod | null {
  const lines = cleanLines(raw?.lines, solo);
  if (lines.length < 2) return null;
  return {
    title: clip(raw?.title, 80) || "Study Pod",
    summary: clip(raw?.summary, 400),
    keyPoints: list(raw?.keyPoints ?? raw?.key_points, 8, 240),
    lines,
    quiz: (Array.isArray(raw?.quiz) ? raw.quiz : []).map((x: any) => ({ q: clip(x?.q ?? x?.question, 300), a: clip(x?.a ?? x?.answer, 300) })).filter((x: { q: string; a: string }) => x.q && x.a).slice(0, 6),
  };
}

export function cleanMeeting(raw: any): MeetingPod | null {
  const summary = clip(raw?.summary, 800);
  if (!summary) return null;
  return {
    title: clip(raw?.title, 80) || "Meeting",
    summary,
    decisions: list(raw?.decisions, 12, 300),
    actions: (Array.isArray(raw?.actions) ? raw.actions : []).map((x: any) => ({ task: clip(x?.task ?? x?.action, 300), owner: clip(x?.owner ?? x?.who, 60), due: clip(x?.due ?? x?.when, 40) })).filter((x: { task: string }) => x.task).slice(0, 20),
    questions: list(raw?.questions ?? raw?.open, 10, 300),
    lines: cleanLines(raw?.lines, true),
  };
}

/** The key the made sound is kept under: the words and the voices that say them. */
export const audioKey = (lines: Line[]) => createHash("sha256").update(`studio:v1:${JSON.stringify(lines.map((l) => [VOICES[l.speaker], l.text]))}`).digest("hex");

/** Every line in its host's voice, one after another, as one file. */
export async function speakLines(lines: Line[], speak: (text: string, voice: string) => Promise<Speech>): Promise<Speech> {
  const parts: Speech[] = [];
  for (const l of lines) parts.push(await speak(l.text, VOICES[l.speaker]));
  const whole = joinParts(parts);
  if (!whole) throw new Error("mixed audio");
  return whole;
}

/** The pieces as one file, when they are all the same kind of sound (else null: they're played one after another). */
export function joinParts(parts: { audio: Buffer; type: string }[]): Speech | null {
  if (parts.length && parts.every((p) => p.type === "audio/mpeg")) return { audio: Buffer.concat(parts.map((p) => p.audio)), type: "audio/mpeg" };
  if (parts.length && parts.every((p) => p.type === "audio/wav")) return { audio: joinWavs(parts.map((p) => p.audio)), type: "audio/wav" };
  return null;
}

const MP3_RATES = [[0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]];
/** About how many seconds a piece of sound lasts (for the position bar while the rest is still being made). */
export function soundSeconds(s: { audio: Buffer; type: string }): number {
  const b = s.audio;
  if (s.type === "audio/wav" && b.length > 44 && b.toString("ascii", 0, 4) === "RIFF") {
    let i = 12, rate = 0;
    while (i + 8 <= b.length) {
      const id = b.toString("ascii", i, i + 4), size = b.readUInt32LE(i + 4);
      if (id === "fmt ") rate = b.readUInt32LE(i + 16);
      if (id === "data") return rate ? Math.min(size, b.length - i - 8) / rate : 0;
      i += 8 + size + (size % 2);
    }
    return 0;
  }
  let i = 0;
  if (b.toString("ascii", 0, 3) === "ID3" && b.length > 10) i = 10 + ((b[6] & 127) << 21 | (b[7] & 127) << 14 | (b[8] & 127) << 7 | (b[9] & 127));
  for (; i + 4 < b.length && i < 64_000; i++) {
    if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) continue;
    const mpeg1 = (b[i + 1] & 0x18) === 0x18, kbps = MP3_RATES[mpeg1 ? 0 : 1][b[i + 2] >> 4];
    if (kbps) return ((b.length - i) * 8) / (kbps * 1000);
  }
  return b.length / 6000; // about 48 kbps
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Keeps asking the voices until a line is said: a busy voice service just means waiting a little.
 *  Gives up only after `patienceMs` (a site with no working voice at all). */
export async function speakPatiently(text: string, voice: string, speak: (text: string, voice: string) => Promise<Speech>, patienceMs = 8 * 60_000, wait = sleep): Promise<Speech> {
  const start = Date.now();
  for (let attempt = 0; ; attempt++) {
    try { return await speak(text, voice); }
    catch (e: any) {
      if (Date.now() - start > patienceMs) throw e;
      await wait(Math.min(20_000, 1500 * 2 ** Math.min(attempt, 4)));
    }
  }
}

const parse = (s: string) => { try { return JSON.parse(s); } catch { const m = s.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { /* not JSON */ } } return null; } };

export function registerStudioRoutes(app: Express, gate: RequestHandler, o: { ask: AskJson; speak?: (text: string, voice: string) => Promise<Speech>; blobs?: BlobStore; patienceMs?: number;
  /** Speech to text, for a recorded lecture or meeting. */
  transcribe?: (audio: Blob, name: string, prompt?: string) => Promise<{ segments: { text: string }[] }>;
  /** Reads the text in a photo of notes. */
  see?: (dataUrl: string) => Promise<string>; }) {
  const patienceMs = o.patienceMs ?? 8 * 60_000;
  const P = "/api/podscroll/studio";
  const writes = createAttemptLimiter({ max: 15, windowMs: 60 * 60_000 });
  const voices = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });
  const memory = new Map<string, { audio: Buffer; type: string }>();
  const remember = (key: string, s: { audio: Buffer; type: string }) => {
    memory.set(key, s);
    let bytes = 0; for (const v of memory.values()) bytes += v.audio.length;
    for (const k of memory.keys()) { if (bytes <= 60e6 && memory.size <= 400) break; bytes -= memory.get(k)!.audio.length; memory.delete(k); }
  };
  const limited = (lim: ReturnType<typeof createAttemptLimiter>, key: string, res: any) => {
    const wait = lim.retryAfter(key);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `You've made a lot in the last hour. Try again in ${waitWords(wait)}.`, busy: false }); return true; }
    lim.fail(key); return false;
  };
  const write = async (req: any, res: any, kind: "study" | "meeting") => {
    res.set("Cache-Control", "no-store");
    const notes = cleanNotes(req.body?.notes);
    if (notes.length < 40) return res.status(400).json({ message: kind === "study" ? "Add a few more lines of notes first." : "Add the meeting notes first (a few lines at least)." });
    if (limited(writes, String(req.user?.id || ""), res)) return;
    const solo = kind === "meeting" || req.body?.style === "solo";
    const system = kind === "study" ? studyPrompt(req.body?.length === "full" ? "full" : "quick", solo ? "solo" : "duo") : meetingPrompt();
    const title = clip(req.body?.title, 80);
    try {
      let made: StudyPod | MeetingPod | null = null;
      // A busy AI is asked again after a short wait; the person just sees "Writing your episode…" a little longer.
      for (let tries = 0; tries < 4 && !made; tries++) {
        let answer = "";
        try { answer = await o.ask(system, `${title ? `Title the person gave: ${title}\n\n` : ""}${kind === "study" ? "Study notes" : "Meeting notes"}:\n${notes}`); }
        catch (e) { if (tries === 3) throw e; await sleep(Math.min(o.patienceMs ?? 8000, 2000 * 2 ** tries)); continue; }
        const raw = parse(answer);
        made = kind === "study" ? cleanStudy(raw, solo) : cleanMeeting(raw);
      }
      if (!made) return res.status(502).json({ message: "The AI's answer didn't come out right. Try again.", busy: false });
      if (title) made.title = title;
      return res.json({ ...made, audio: audioKey(made.lines) });
    } catch (e: any) {
      console.error(`[studio] ${kind} failed:`, String(e?.message || e).slice(0, 200));
      return res.status(503).json({ message: "Couldn't reach the AI just now. Tap the button again.", busy: false });
    }
  };
  // Notes from a PDF or a photo: the text goes back into the notes box, where the person can check it.
  const reads = createAttemptLimiter({ max: 120, windowMs: 60 * 60_000 });
  app.post(`${P}/read`, express.json({ limit: "14mb" }), gate, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const kind = req.body?.kind;
    if (limited(reads, String(req.user?.id || ""), res)) return;
    try {
      if (kind === "pdf") {
        const data = Buffer.from(String(req.body?.data || ""), "base64");
        if (data.length < 50 || data.subarray(0, 5).toString("latin1") !== "%PDF-") return res.status(400).json({ message: "That isn't a PDF." });
        const text = pdfText(data);
        if (!looksReadable(text)) return res.status(422).json({ message: "This PDF is a scan (a picture of the pages), so there's no text in it to read. Take photos of the pages instead: tap Add photos.", scan: true });
        return res.json({ text });
      }
      if (kind === "image") {
        const image = String(req.body?.image || "");
        if (!IMAGE_DATA.test(image) || image.length > 12_000_000) return res.status(400).json({ message: "That photo couldn't be opened. Try another." });
        const see = o.see ?? (canSeePhotos() ? readPhoto : null);
        if (!see) return res.status(503).json({ message: "Reading photos isn't set up on this site yet. Paste or type the notes instead." });
        const text = (await see(image)).slice(0, 20_000);
        if (!text.trim()) return res.status(422).json({ message: "No writing was found in that photo. Try a closer, brighter photo." });
        return res.json({ text });
      }
      return res.status(400).json({ message: "Pick a PDF or a photo." });
    } catch (e: any) {
      console.error("[studio] read failed:", String(e?.message || e).slice(0, 200));
      return res.status(503).json({ message: "Couldn't read that just now. Try again." });
    }
  });
  // A recorded lecture or meeting, a few minutes at a time (the app sends each piece as it's recorded).
  const hears = createAttemptLimiter({ max: 200, windowMs: 60 * 60_000 });
  app.post(`${P}/transcribe`, express.raw({ type: () => true, limit: "26mb" }), gate, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const audio: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (audio.length < 1000) return res.json({ text: "" });
    if (!o.transcribe) return res.status(503).json({ message: "Recording isn't set up on this site yet." });
    if (limited(hears, String(req.user?.id || ""), res)) return;
    const type = String(req.headers["content-type"] || "audio/mp4").split(";")[0];
    const ext = /webm/.test(type) ? "webm" : /ogg/.test(type) ? "ogg" : /wav/.test(type) ? "wav" : /mpeg|mp3/.test(type) ? "mp3" : "m4a";
    for (let attempt = 0; ; attempt++) {
      try {
        const out = await o.transcribe(new Blob([audio], { type }), `recording.${ext}`);
        return res.json({ text: out.segments.map((x) => x.text.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim() });
      } catch (e: any) {
        // Busy: wait and try again (the recording is never lost: the app keeps it until this answers).
        if (attempt < 4) { await sleep(Math.min(o.patienceMs ?? 20_000, 3000 * 2 ** attempt)); continue; }
        console.error("[studio] transcribe failed:", String(e?.message || e).slice(0, 200));
        return res.status(503).json({ message: "Couldn't write down that part just now. It will be tried again." });
      }
    }
  });

  app.post(`${P}/study`, gate, (req, res) => void write(req, res, "study"));
  app.post(`${P}/meeting`, gate, (req, res) => void write(req, res, "meeting"));

  // Making the sound: one piece per line, in order, in the background. The app starts playing the
  // first line as soon as it's made and keeps asking how far along the rest is, so a long episode
  // starts in seconds and a busy voice service just means a short wait, never an error.
  type Job = { lines: Line[]; parts: ({ audio: Buffer; type: string } | null)[]; secs: number[]; failed: boolean; at: number; working?: Promise<void> };
  const jobs = new Map<string, Job>();
  const partKey = (key: string, n: number) => `${key}:${n}`;
  const run = async (key: string, job: Job) => {
    for (let n = 0; n < job.lines.length; n++) {
      if (job.parts[n]) continue;
      const kept = memory.get(partKey(key, n)) || (o.blobs ? await o.blobs.get(`studio:${partKey(key, n)}`).then((b) => (b ? { audio: b.data, type: b.type } : null)).catch(() => null) : null);
      const made = kept || await speakPatiently(job.lines[n].text, VOICES[job.lines[n].speaker], o.speak!, patienceMs);
      job.parts[n] = made; job.secs[n] = soundSeconds(made);
      if (!kept) { remember(partKey(key, n), made); void o.blobs?.put(`studio:${partKey(key, n)}`, made.audio, made.type); }
    }
    const whole = joinParts(job.parts as { audio: Buffer; type: string }[]);
    if (whole) { remember(key, whole); void o.blobs?.put(`studio:${key}`, whole.audio, whole.type); }
  };
  const status = (key: string, job: Job) => ({ id: key, parts: job.lines.length, made: job.parts.map((p) => !!p), secs: job.secs, done: job.parts.every(Boolean), failed: job.failed });
  const haveWhole = async (key: string) => memory.has(key) || (!!o.blobs && await o.blobs.get(`studio:${key}`).then((b) => { if (b) remember(key, { audio: b.data, type: b.type }); return !!b; }).catch(() => false));

  /** Starts making a pod's sound (or says how far along it is). Ask again to see progress. */
  app.post(`${P}/voice`, gate, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const lines = cleanLines(req.body?.lines, req.body?.solo === true);
    if (!lines.length) return res.status(400).json({ message: "Nothing to say." });
    const key = audioKey(lines);
    const job = jobs.get(key);
    if (job && !job.failed) {
      if (req.body?.progress === true) return res.json(status(key, job));
      await job.working?.catch(() => {});
      if (await haveWhole(key)) return res.json({ id: key });
      return res.status(503).json({ message: "Update Pod+ to hear this one.", noVoice: true, busy: false });
    }
    if (await haveWhole(key)) return res.json({ id: key, whole: true, done: true, parts: 0, made: [], secs: [] });
    if (!o.speak) return res.status(503).json({ message: "Voices aren't set up on this site yet.", noVoice: true, busy: false });
    if (!job && limited(voices, String(req.user?.id || ""), res)) return;
    const fresh: Job = { lines, parts: lines.map(() => null), secs: lines.map((l) => l.text.length / 15), failed: false, at: Date.now() };
    jobs.set(key, fresh);
    for (const [k, j] of jobs) if (Date.now() - j.at > 60 * 60_000) jobs.delete(k);
    const working = run(key, fresh);
    fresh.working = working;
    working.then(() => setTimeout(() => { if (jobs.get(key) === fresh) jobs.delete(key); }, 10 * 60_000).unref?.())
      .catch((e: any) => { fresh.failed = true; console.error("[studio] voice failed:", String(e?.message || e).slice(0, 200)); });
    // An app from before line-by-line playing waits for the whole file, as it always did.
    if (req.body?.progress !== true) {
      await working.catch(() => {});
      if (await haveWhole(key)) return res.json({ id: key });
      return res.status(503).json({ message: "Update Pod+ to hear this one.", noVoice: true, busy: false });
    }
    return res.json(status(key, fresh));
  });
  /** One line's sound, once it's made. */
  app.get(`${P}/audio/:id/:n`, async (req, res) => {
    const id = String(req.params.id || ""), n = Number(req.params.n);
    if (!/^[a-f0-9]{64}$/.test(id) || !Number.isInteger(n) || n < 0 || n > 500) return res.status(400).end();
    let hit = jobs.get(id)?.parts[n] || memory.get(partKey(id, n));
    if (!hit && o.blobs) { const b = await o.blobs.get(`studio:${partKey(id, n)}`).catch(() => null); if (b) hit = { audio: b.data, type: b.type }; }
    if (!hit) return res.status(404).end();
    sendSound(req, res, hit);
  });
  /** The made sound itself. No device header (an audio element can't send one); the key is a hash of the words. */
  app.get(`${P}/audio/:id`, async (req, res) => {
    const id = String(req.params.id || "");
    if (!/^[a-f0-9]{64}$/.test(id)) return res.status(400).end();
    let hit = memory.get(id);
    if (!hit && o.blobs) { const b = await o.blobs.get(`studio:${id}`); if (b) { hit = { audio: b.data, type: b.type }; remember(id, hit); } }
    if (!hit) return res.status(404).end();
    sendSound(req, res, hit);
  });
}

/** Sends sound, with byte ranges (iPhones ask for those). */
function sendSound(req: any, res: any, hit: { audio: Buffer; type: string }) {
  const size = hit.audio.length;
  res.set({ "Content-Type": hit.type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=604800" });
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    if (start >= size || start > end) { res.status(416).set("Content-Range", `bytes */${size}`).end(); return; }
    res.status(206).set({ "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) }).send(hit.audio.subarray(start, end + 1));
    return;
  }
  res.set("Content-Length", String(size)).send(hit.audio);
}
