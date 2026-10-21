// The student welcome show's voice: the premium AI voice (OpenAI gpt-4o-mini-tts, the same voice family as the
// Learning Buddy and English Explorer) reading the show's captions to a room.
// The show only ever says its own fixed script, so each line is made once and saved in a private Storage bucket;
// after that every showing gets it instantly and it costs nothing more. Anyone may ask for a line by number
// (there are only as many as the script has), and nothing else can be asked for.
import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import { FLAT, lineKey, spokenText } from "../shared/presentShow";

const BUCKET = "student-show-voice";
const VERSION = "v5";
const VOICE = "marin";
/** Which voice and settings made the clips; the page adds it to each clip's address so a new voice is never played from an old saved copy. */
export const VOICE_VERSION = `${VERSION}-${VOICE}`;
const INSTRUCTIONS =
  "You are a friendly, upbeat teacher presenting to a big room of students, from kindergarten to high school. Speak in clear, standard American English at an easy, steady pace with warm energy, and a short natural pause between sentences, so the people in the back of the room can follow every word. Never sound babyish, rushed, or robotic. Say exactly the input text and nothing else.";

export type ShowVoice = {
  /** Whether the AI voice is set up (an OpenAI key is present). */
  available(): boolean;
  /** The MP3 for line `index` of the show, or null when there is no such line. */
  line(index: number): Promise<Buffer | null>;
};

export function createShowVoice(opts: { apiKey?: string; storage?: () => any; fetchImpl?: typeof fetch; lines?: string[] } = {}): ShowVoice {
  const lines = opts.lines ?? FLAT.map((b) => b.say);
  const key = () => opts.apiKey ?? process.env.OPENAI_API_KEY;
  const memory = new Map<string, Buffer>();
  const inFlight = new Map<string, Promise<Buffer>>();
  let bucketReady: Promise<unknown> | null = null;
  const storage = async () => (opts.storage ? opts.storage() : (await import("./supabase")).getAdminSupabase().storage);
  const ensureBucket = async () => (bucketReady ??= (await storage()).createBucket(BUCKET, { public: false, fileSizeLimit: "2MB" }).catch(() => null));

  async function generate(text: string): Promise<Buffer> {
    const apiKey = key();
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    const response = await (opts.fetchImpl ?? fetch)("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: VOICE, input: spokenText(text), instructions: INSTRUCTIONS, response_format: "mp3" }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`speech failed: ${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}`);
    return Buffer.from(await response.arrayBuffer());
  }

  return {
    available: () => !!key(),
    async line(index) {
      if (!Number.isInteger(index) || index < 0 || index >= lines.length) return null;
      const text = lines[index];
      // The saved clip is named for the words, so changing a line in the script makes a fresh clip.
      const id = createHash("sha1").update(`${VERSION}|${VOICE}|${text}`).digest("hex");
      const hit = memory.get(id);
      if (hit) return hit;
      let pending = inFlight.get(id);
      if (!pending) {
        pending = (async () => {
          const path = `${id}.mp3`;
          try {
            const { data } = await (await storage()).from(BUCKET).download(path);
            if (data) return Buffer.from(await data.arrayBuffer());
          } catch { /* not saved yet */ }
          const audio = await generate(text);
          void (async () => { try { await ensureBucket(); await (await storage()).from(BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: true }); } catch { /* made again next time */ } })();
          return audio;
        })().finally(() => inFlight.delete(id));
        inFlight.set(id, pending);
      }
      const audio = await pending;
      memory.set(id, audio);
      return audio;
    },
  };
}

/** GET /api/student-show/voice/status and GET /api/student-show/voice/:index. Public: it only serves the show's own fixed lines. */
export function registerStudentShowVoice(app: Pick<Express, "get">, voice: ShowVoice = createShowVoice()) {
  app.get("/api/student-show/voice/status", (_req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    res.json({ ai: voice.available(), lines: FLAT.length, v: VOICE_VERSION });
  });
  app.get("/api/student-show/voice/:index", async (req: Request, res: Response) => {
    const raw = String(req.params.index || "");
    if (!/^\d{1,3}$/.test(raw)) return res.status(404).json({ message: "No such line" });
    if (!voice.available()) return res.status(503).json({ message: "The AI voice is not set up" });
    // The page says which words it is showing for this line. If they are not the words the server has (an older page, or an old saved copy), say nothing rather than read the wrong thing.
    const shown = FLAT[Number(raw)];
    if (!shown || String(req.query?.h ?? "") !== lineKey(shown.say)) return res.status(404).json({ message: "That line has changed. Reload the page." });
    try {
      const audio = await voice.line(Number(raw));
      if (!audio) return res.status(404).json({ message: "No such line" });
      res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400", "Content-Length": String(audio.length) });
      res.send(audio);
    } catch (e: any) {
      console.error("[student-show-voice]", e?.message || e);
      res.status(502).json({ message: "The AI voice is not available right now" });
    }
  });
}
