// Spoken words with Groq's Orpheus voices, for the site's read-aloud voices (the eye-gaze Learning
// Buddy, the game announcer, Sleep stories) now that OpenAI's voices are off. Orpheus takes about
// 200 characters at a time, so longer text is spoken in pieces and joined. MP3 when Groq gives it
// (small, about a tenth of WAV), else WAV.
import { joinWavs, speechChunks } from "./audiobooks";
import { hasDeepgram } from "./deepgram";

export type Speech = { audio: Buffer; type: "audio/mpeg" | "audio/wav" };
let wavOnly = false;

async function piece(text: string, voice: string, format: "mp3" | "wav"): Promise<Response> {
  return fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.BOOK_TTS_MODEL || "canopylabs/orpheus-v1-english", input: text, voice, response_format: format }),
    signal: AbortSignal.timeout(45_000),
  });
}

/** The voice for each kind of reading: friendly, calm, the announcer, bedtime (warm or deep). */
export function voiceFor(style: "buddy" | "announcer" | "sleep", calm: boolean, sleepVoice: "warm" | "deep"): string {
  if (style === "announcer") return "troy";
  if (style === "sleep") return sleepVoice === "deep" ? "daniel" : "autumn";
  return calm ? "autumn" : "hannah";
}

export const hasGroqVoice = () => !!process.env.GROQ_API_KEY;

export async function groqSpeech(text: string, voice: string): Promise<Speech> {
  if (!process.env.GROQ_API_KEY) throw new Error("no voice key");
  const chunks = speechChunks(text);
  if (!chunks.length) throw new Error("nothing to say");
  const say = async (format: "mp3" | "wav") => {
    const out: Buffer[] = new Array(chunks.length);
    for (let i = 0; i < chunks.length; i += 3) {
      await Promise.all(chunks.slice(i, i + 3).map(async (c, k) => {
        let r = await piece(c, voice, format);
        // Too many at once: wait the few seconds Groq asks for and try that piece again.
        for (let again = 0; again < 2 && (r.status === 429 || r.status >= 500); again++) {
          const wait = Math.min(8, Math.max(1, Number(r.headers.get("retry-after")) || 2));
          await new Promise((ok) => setTimeout(ok, wait * 1000));
          r = await piece(c, voice, format);
        }
        if (!r.ok) throw Object.assign(new Error(`speech ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`), { status: r.status });
        out[i + k] = Buffer.from(await r.arrayBuffer());
      }));
    }
    return out;
  };
  if (!wavOnly) {
    try {
      const parts = await say("mp3");
      // MP3 is made of frames, so pieces play back to back when simply put together.
      return { audio: Buffer.concat(parts), type: "audio/mpeg" };
    } catch (e: any) {
      // This voice model only gives WAV: remember that and ask for WAV from now on.
      if (e?.status === 400 && /format|mp3|response_format/i.test(String(e?.message))) wavOnly = true;
      else throw e;
    }
  }
  return { audio: joinWavs(await say("wav")), type: "audio/wav" };
}

// ---- Backup AI voices ----
// Every spoken line in the apps is a real AI voice, never the phone's built-in one. When Groq's
// Orpheus voices can't answer (busy, used up for the hour, down), Deepgram's Aura voices say it
// (DEEPGRAM_API_KEY, the same key used for listening), then OpenAI's when that is on.
const AURA: Record<string, string> = { hannah: "aura-2-thalia-en", autumn: "aura-2-luna-en", diana: "aura-2-asteria-en", austin: "aura-2-apollo-en", daniel: "aura-2-orion-en", troy: "aura-2-zeus-en" };
const OPENAI_VOICE: Record<string, string> = { hannah: "marin", autumn: "marin", diana: "coral", austin: "cedar", daniel: "cedar", troy: "ash" };
const openAiVoiceOn = () => !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "routed-to-grok";

async function deepgramSpeech(text: string, voice: string): Promise<Speech> {
  const key = process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_KEY;
  if (!key) throw new Error("no deepgram key");
  // Aura takes up to 2,000 characters a request.
  const parts: string[] = [];
  for (const c of speechChunks(text, 1800)) parts.push(c);
  const out: Buffer[] = [];
  for (const part of parts) {
    const r = await fetch(`https://api.deepgram.com/v1/speak?model=${AURA[voice] || AURA.hannah}&encoding=mp3`, {
      method: "POST", headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: part }), signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) throw Object.assign(new Error(`deepgram speech ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`), { status: r.status });
    out.push(Buffer.from(await r.arrayBuffer()));
  }
  return { audio: Buffer.concat(out), type: "audio/mpeg" };
}

async function openAiSpeech(text: string, voice: string): Promise<Speech> {
  const out: Buffer[] = [];
  for (const part of speechChunks(text, 3800)) {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: OPENAI_VOICE[voice] || "marin", input: part, response_format: "mp3" }), signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw Object.assign(new Error(`openai speech ${r.status}`), { status: r.status });
    out.push(Buffer.from(await r.arrayBuffer()));
  }
  return { audio: Buffer.concat(out), type: "audio/mpeg" };
}

/** Is any AI voice set up on this server? */
export const hasAiVoice = () => hasGroqVoice() || hasDeepgram() || openAiVoiceOn();

/** A real AI voice saying `text`: Groq's Orpheus first, then Deepgram's Aura, then OpenAI's. */
export async function aiSpeech(text: string, voice: string): Promise<Speech> {
  const tries: [string, () => Promise<Speech>][] = [];
  if (hasGroqVoice()) tries.push(["groq", () => groqSpeech(text, voice)]);
  if (hasDeepgram()) tries.push(["deepgram", () => deepgramSpeech(text, voice)]);
  if (openAiVoiceOn()) tries.push(["openai", () => openAiSpeech(text, voice)]);
  if (!tries.length) throw new Error("no voice key");
  let last: any;
  for (const [name, run] of tries) {
    try { return await run(); }
    catch (e: any) { last = e; console.warn(`[ai-voice] ${name} failed:`, String(e?.message || e).slice(0, 160)); }
  }
  throw last;
}
