// Spoken words with Groq's Orpheus voices, for the site's read-aloud voices (the eye-gaze Learning
// Buddy, the game announcer, Sleep stories) now that OpenAI's voices are off. Orpheus takes about
// 200 characters at a time, so longer text is spoken in pieces and joined. MP3 when Groq gives it
// (small, about a tenth of WAV), else WAV.
import { joinWavs, speechChunks } from "./audiobooks";

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
        const r = await piece(c, voice, format);
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
