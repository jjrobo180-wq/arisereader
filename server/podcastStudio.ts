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
import type { Express, RequestHandler } from "express";
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
  const parts: Speech[] = new Array(lines.length);
  for (let i = 0; i < lines.length; i += 2) {
    await Promise.all(lines.slice(i, i + 2).map(async (l, k) => { parts[i + k] = await speak(l.text, VOICES[l.speaker]); }));
  }
  if (parts.every((p) => p.type === "audio/mpeg")) return { audio: Buffer.concat(parts.map((p) => p.audio)), type: "audio/mpeg" };
  if (parts.every((p) => p.type === "audio/wav")) return { audio: joinWavs(parts.map((p) => p.audio)), type: "audio/wav" };
  throw new Error("mixed audio");
}

const parse = (s: string) => { try { return JSON.parse(s); } catch { const m = s.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { /* not JSON */ } } return null; } };

export function registerStudioRoutes(app: Express, gate: RequestHandler, o: { ask: AskJson; speak?: (text: string, voice: string) => Promise<Speech>; blobs?: BlobStore }) {
  const P = "/api/podscroll/studio";
  const writes = createAttemptLimiter({ max: 15, windowMs: 60 * 60_000 });
  const voices = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });
  const memory = new Map<string, { audio: Buffer; type: string }>();
  const remember = (key: string, s: { audio: Buffer; type: string }) => {
    memory.set(key, s);
    let bytes = 0; for (const v of memory.values()) bytes += v.audio.length;
    for (const k of memory.keys()) { if (bytes <= 40e6 && memory.size <= 30) break; bytes -= memory.get(k)!.audio.length; memory.delete(k); }
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
      for (let tries = 0; tries < 2 && !made; tries++) {
        const raw = parse(await o.ask(system, `${title ? `Title the person gave: ${title}\n\n` : ""}${kind === "study" ? "Study notes" : "Meeting notes"}:\n${notes}`));
        made = kind === "study" ? cleanStudy(raw, solo) : cleanMeeting(raw);
      }
      if (!made) return res.status(502).json({ message: "The AI's answer didn't come out right. Try again.", busy: false });
      if (title) made.title = title;
      return res.json({ ...made, audio: audioKey(made.lines) });
    } catch (e: any) {
      console.error(`[studio] ${kind} failed:`, String(e?.message || e).slice(0, 200));
      return res.status(503).json({ message: "The AI is busy right now. Try again in a minute.", busy: false });
    }
  };
  app.post(`${P}/study`, gate, (req, res) => void write(req, res, "study"));
  app.post(`${P}/meeting`, gate, (req, res) => void write(req, res, "meeting"));

  /** Makes the sound for a pod's lines (or finds it already made). Returns the key to fetch it by. */
  app.post(`${P}/voice`, gate, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const lines = cleanLines(req.body?.lines, req.body?.solo === true);
    if (!lines.length) return res.status(400).json({ message: "Nothing to say." });
    const key = audioKey(lines);
    if (memory.has(key) || (o.blobs && await o.blobs.get(`studio:${key}`).then((b) => { if (b) remember(key, { audio: b.data, type: b.type }); return !!b; }))) return res.json({ id: key });
    if (!o.speak) return res.status(503).json({ message: "Voices aren't set up on this site yet.", noVoice: true, busy: false });
    if (limited(voices, String(req.user?.id || ""), res)) return;
    try {
      const made = await speakLines(lines, o.speak);
      remember(key, made);
      void o.blobs?.put(`studio:${key}`, made.audio, made.type);
      return res.json({ id: key });
    } catch (e: any) {
      console.error("[studio] voice failed:", String(e?.message || e).slice(0, 200));
      return res.status(503).json({ message: "The voices are busy right now.", noVoice: true, busy: false });
    }
  });
  /** The made sound itself. No device header (an audio element can't send one); the key is a hash of the words. */
  app.get(`${P}/audio/:id`, async (req, res) => {
    const id = String(req.params.id || "");
    if (!/^[a-f0-9]{64}$/.test(id)) return res.status(400).end();
    let hit = memory.get(id);
    if (!hit && o.blobs) { const b = await o.blobs.get(`studio:${id}`); if (b) { hit = { audio: b.data, type: b.type }; remember(id, hit); } }
    if (!hit) return res.status(404).end();
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
  });
}
