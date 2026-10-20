// English Explorer's voice and ears: the premium AI voice (OpenAI gpt-4o-mini-tts, the same voice family as
// the Learning Buddy) and speech-to-text for "Say it" (gpt-4o-mini-transcribe).
// The program only ever says a fixed set of words and sentences, so each clip is made once and saved in a
// private Storage bucket; after that every student gets it instantly and it costs nothing more.
import { createHash } from "node:crypto";
import type { EnglishSpeech } from "./ariseEnglish";

const BUCKET = "english-voice";
const MEMORY_LIMIT = 600;
const VERSION = "v1";

const INSTRUCTIONS = {
  en: "You are a warm, patient English teacher speaking to a child who is just beginning to learn English. Say the text in clear, standard American English with careful, natural pronunciation, a little slower than normal conversation, with a friendly and encouraging tone. Never sound babyish, rushed or robotic.",
  enSlow: "You are a patient English teacher helping a beginner hear every sound. Say the text very slowly and clearly in standard American English, stretching each word a little and leaving a short pause between words, while still sounding natural and kind.",
  es: "Eres una maestra cálida y paciente que habla con un niño. Di el texto en español latinoamericano claro y natural, con buena pronunciación y un tono amable y alentador, un poco más despacio de lo normal.",
};

export function createEnglishSpeech(opts: { apiKey?: string; storage?: () => any } = {}): EnglishSpeech {
  const key = () => opts.apiKey ?? process.env.OPENAI_API_KEY;
  const memory = new Map<string, Buffer>();
  const inFlight = new Map<string, Promise<Buffer>>();
  let bucketReady: Promise<unknown> | null = null;
  const storage = async () => (opts.storage ? opts.storage() : (await import("./supabase")).getAdminSupabase().storage);
  const ensureBucket = async () => (bucketReady ??= (await storage()).createBucket(BUCKET, { public: false, fileSizeLimit: "2MB" }).catch(() => null));
  const remember = (k: string, audio: Buffer) => {
    memory.delete(k); memory.set(k, audio);
    while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value as string);
  };

  async function generate(text: string, lang: "en" | "es", slow: boolean): Promise<Buffer> {
    const apiKey = key();
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "marin",
        input: text,
        instructions: (lang === "es" ? INSTRUCTIONS.es : slow ? INSTRUCTIONS.enSlow : INSTRUCTIONS.en) + " Say exactly the input text and nothing else.",
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`speech failed: ${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}`);
    return Buffer.from(await response.arrayBuffer());
  }

  return {
    async say(text, lang, slow) {
      const id = createHash("sha1").update(`${VERSION}|${lang}|${slow ? 1 : 0}|${text}`).digest("hex");
      const hit = memory.get(id);
      if (hit) { remember(id, hit); return hit; }
      let pending = inFlight.get(id);
      if (!pending) {
        pending = (async () => {
          const path = `${id}.mp3`;
          try {
            const { data } = await (await storage()).from(BUCKET).download(path);
            if (data) return Buffer.from(await data.arrayBuffer());
          } catch { /* not saved yet */ }
          const audio = await generate(text, lang, slow);
          // Saved for everyone after; a failed save only means it's made again next time.
          void (async () => { try { await ensureBucket(); await (await storage()).from(BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: true }); } catch { /* next time */ } })();
          return audio;
        })().finally(() => inFlight.delete(id));
        inFlight.set(id, pending);
      }
      const audio = await pending;
      remember(id, audio);
      return audio;
    },
    async hear(audio, mime) {
      const apiKey = key();
      if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
      const ext = mime === "audio/mp4" ? "mp4" : mime === "audio/ogg" ? "ogg" : mime === "audio/mpeg" ? "mp3" : mime === "audio/wav" ? "wav" : "webm";
      const form = new FormData();
      form.append("model", "gpt-4o-mini-transcribe");
      form.append("language", "en");
      form.append("response_format", "json");
      form.append("file", new Blob([Uint8Array.from(audio)], { type: mime || "audio/webm" }), `say.${ext}`);
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`transcription failed: ${response.status}`);
      const result: any = await response.json();
      return String(result?.text || "").trim();
    },
  };
}
