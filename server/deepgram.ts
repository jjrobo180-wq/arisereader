// Backup speech-to-text: Deepgram (nova-3). Used when Groq's free speech-to-text is out for the
// hour, so Pod+ keeps reading episodes for ads and audiobooks keep their transcripts. Needs
// DEEPGRAM_API_KEY on the server (deepgram.com gives a starting credit; then about $0.0043 a minute).
// Answers in the same shape as Whisper: segments (sentences with times) and word timings.
export type Transcript = { segments: { start: number; end: number; text: string }[]; words: { start: number; end: number; word: string }[] };

export const hasDeepgram = () => !!(process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_KEY);

/** Deepgram's answer as Whisper-style segments and words. */
export function fromDeepgram(body: any): Transcript {
  const alt = body?.results?.channels?.[0]?.alternatives?.[0] ?? {};
  const words = (Array.isArray(alt.words) ? alt.words : []).map((w: any) => ({ start: Number(w.start) || 0, end: Number(w.end) || 0, word: String(w.punctuated_word || w.word || "") })).filter((w: any) => w.word);
  let segments: Transcript["segments"] = (Array.isArray(body?.results?.utterances) ? body.results.utterances : [])
    .map((u: any) => ({ start: Number(u.start) || 0, end: Number(u.end) || 0, text: String(u.transcript || "").trim() })).filter((s: any) => s.text);
  // No utterances: sentences from the words (a new one after . ? ! or a pause of a second).
  if (!segments.length && words.length) {
    let cur: { start: number; end: number; text: string } | null = null;
    for (const w of words) {
      if (!cur) cur = { start: w.start, end: w.end, text: w.word };
      else { cur.text += ` ${w.word}`; cur.end = w.end; }
      const next = words[words.indexOf(w) + 1];
      if (/[.?!]$/.test(w.word) || !next || next.start - w.end > 1) { segments.push(cur); cur = null; }
    }
  }
  return { segments, words };
}

export async function deepgramTranscribe(audio: Blob, prompt?: string): Promise<Transcript> {
  const key = process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_KEY;
  if (!key) throw new Error("busy");
  const q = new URLSearchParams({ model: process.env.DEEPGRAM_MODEL || "nova-3", smart_format: "true", punctuate: "true", utterances: "true", utt_split: "0.8", language: "en" });
  // Names that help it spell the show and its sponsors.
  for (const t of String(prompt || "").split(/[,.]/).map((x) => x.trim()).filter((x) => x && x.length <= 40).slice(0, 20)) q.append("keyterm", t);
  const res = await fetch(`https://api.deepgram.com/v1/listen?${q}`, {
    method: "POST", headers: { Authorization: `Token ${key}`, "Content-Type": audio.type || "audio/mpeg" }, body: audio, signal: AbortSignal.timeout(180_000),
  }).catch(() => null);
  if (!res) throw new Error("busy");
  if (!res.ok) {
    console.error("[stt] backup failed:", res.status, (await res.text().catch(() => "")).slice(0, 200));
    throw new Error(res.status === 429 || res.status >= 500 ? "busy" : `stt ${res.status}`);
  }
  return fromDeepgram(await res.json());
}
