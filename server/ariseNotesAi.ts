// Arise Notes' AI: speech to text and the writing (summaries, emails, study tools, answers).
//
// Speech to text, behind one interface so a service can be swapped or added:
//   - Groq's Whisper (whisper-large-v3-turbo, about $0.04 an hour) when GROQ_API_KEY is set: the
//     cheapest, with times on every line. The site's first choice.
//   - OpenAI (when it's switched on with USE_OPENAI=1): whisper-1 for lines with times, and
//     gpt-4o-transcribe-diarize for speaker labels.
//   - Deepgram (nova-3, DEEPGRAM_API_KEY): the fallback, and speaker labels when asked for.
// Each service answers with lines (start, end, text, speaker) and the audio's real length, which is
// what minutes are charged on.
//
// Writing goes through the site's one AI route (server/aiProvider.ts sends OpenAI-style chat to
// whichever service the site uses), in JSON mode. Long transcripts are summarized part by part and
// then combined, so a two-hour meeting fits.
import {
  ONE_GO_CHARS, PART_CHARS, askAnswerPrompt, askPlanPrompt, cleanAskPlan, cleanMemo, cleanParentEmail, cleanStudy, cleanSummary, memoPrompt, parentPrompt,
  partPrompt, reducePrompt, splitLines, studyPrompt, summaryPrompt, translatePrompt, type AskPlan, type MemoIdea, type NoteSummary, type NotesTemplateId,
  type ParentEmail, type StudyTools,
} from "../shared/ariseNotes";
import { BACKUPS } from "./aiProvider";

export type HeardLine = { start: number; end: number; text: string; speaker: string | null };
export type Heard = { lines: HeardLine[]; duration: number; provider: string; diarized: boolean };
export type HearInput = { audio: Buffer; ext: string; mime: string; speakers: boolean; prompt?: string };
export type Hearer = {
  hear(input: HearInput): Promise<Heard>;
  /** Any speech-to-text service set up. */
  available(): boolean;
  /** A service that can tell speakers apart is set up. */
  speakersAvailable(): boolean;
};

class Busy extends Error { constructor(m = "busy") { super(m); } }
type Env = Record<string, string | undefined>;
const keyOf = (env: Env, names: readonly string[]) => names.map((n) => env[n]?.trim()).find(Boolean) || "";
const openAiOn = (env: Env) => !!env.OPENAI_API_KEY && env.OPENAI_API_KEY !== "routed-to-grok" && env.USE_OPENAI === "1";
const audioName = (ext: string) => `audio.${/^(webm|ogg|mp3|mp4|m4a|wav|mpeg|mpga|flac)$/.test(ext) ? ext : "webm"}`;
const typeFor = (ext: string, mime: string) => mime && mime !== "application/octet-stream" ? mime.split(";")[0] : ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : ext === "m4a" || ext === "mp4" ? "audio/mp4" : ext === "ogg" ? "audio/ogg" : "audio/webm";

async function failed(res: Response, who: string): Promise<never> {
  const body = await res.text().catch(() => "");
  console.error(`[notes] ${who} ${res.status}:`, body.slice(0, 240));
  if (res.status === 429 || res.status >= 500 || res.status === 401 || res.status === 402 || res.status === 403) throw new Busy(`${who} ${res.status}`);
  throw new Error(`${who} ${res.status}`);
}

/** Lines from a Whisper-style answer (Groq and OpenAI's whisper-1). */
export function fromWhisper(body: any): { lines: HeardLine[]; duration: number } {
  const lines = (Array.isArray(body?.segments) ? body.segments : [])
    .map((s: any) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "").trim(), speaker: null }))
    .filter((s: HeardLine) => s.text);
  const last = lines.length ? lines[lines.length - 1].end : 0;
  return { lines, duration: Math.max(Number(body?.duration) || 0, last) };
}
/** Lines from Deepgram, with speaker numbers when it was asked to tell them apart. */
export function fromDeepgramNotes(body: any, diarize: boolean): { lines: HeardLine[]; duration: number } {
  const utt = Array.isArray(body?.results?.utterances) ? body.results.utterances : [];
  let lines: HeardLine[] = utt.map((u: any) => ({ start: Number(u.start) || 0, end: Number(u.end) || 0, text: String(u.transcript || "").trim(), speaker: diarize && Number.isFinite(Number(u.speaker)) ? String(Number(u.speaker) + 1) : null })).filter((l: HeardLine) => l.text);
  if (!lines.length) {
    const alt = body?.results?.channels?.[0]?.alternatives?.[0];
    const text = String(alt?.transcript || "").trim();
    if (text) lines = [{ start: 0, end: Number(body?.metadata?.duration) || 0, text, speaker: null }];
  }
  const last = lines.length ? lines[lines.length - 1].end : 0;
  return { lines, duration: Math.max(Number(body?.metadata?.duration) || 0, last) };
}
/** Lines from OpenAI's gpt-4o-transcribe-diarize ("diarized_json"): speakers come as "A", "B"… */
export function fromOpenAiDiarized(body: any): { lines: HeardLine[]; duration: number } {
  const names = new Map<string, string>();
  const lines = (Array.isArray(body?.segments) ? body.segments : []).map((s: any) => {
    const raw = String(s.speaker ?? "");
    if (raw && !names.has(raw)) names.set(raw, String(names.size + 1));
    return { start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "").trim(), speaker: raw ? names.get(raw)! : null };
  }).filter((s: HeardLine) => s.text);
  const last = lines.length ? lines[lines.length - 1].end : 0;
  return { lines, duration: Math.max(Number(body?.duration) || Number(body?.usage?.seconds) || 0, last) };
}

export function createHearer(env: Env = process.env, doFetch: typeof fetch = (...a) => fetch(...a)): Hearer {
  const groqKey = () => keyOf(env, BACKUPS.groq.keys);
  const deepgramKey = () => keyOf(env, ["DEEPGRAM_API_KEY", "DEEPGRAM_KEY"]);

  const groq = async (i: HearInput): Promise<Heard> => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(i.audio)], { type: typeFor(i.ext, i.mime) }), audioName(i.ext));
    form.append("model", env.NOTES_GROQ_MODEL || "whisper-large-v3-turbo");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    if (i.prompt) form.append("prompt", i.prompt.slice(0, 400));
    const res = await doFetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${groqKey()}` }, body: form, signal: AbortSignal.timeout(240_000) });
    if (!res.ok) await failed(res, "groq");
    return { ...fromWhisper(await res.json()), provider: "groq", diarized: false };
  };
  const deepgram = async (i: HearInput, diarize: boolean): Promise<Heard> => {
    const q = new URLSearchParams({ model: env.DEEPGRAM_MODEL || "nova-3", smart_format: "true", punctuate: "true", utterances: "true", utt_split: "0.8" });
    if (diarize) q.set("diarize", "true");
    const res = await doFetch(`https://api.deepgram.com/v1/listen?${q}`, { method: "POST", headers: { Authorization: `Token ${deepgramKey()}`, "Content-Type": typeFor(i.ext, i.mime) }, body: new Uint8Array(i.audio), signal: AbortSignal.timeout(300_000) });
    if (!res.ok) await failed(res, "deepgram");
    return { ...fromDeepgramNotes(await res.json(), diarize), provider: diarize ? "deepgram-diarize" : "deepgram", diarized: diarize };
  };
  const openai = async (i: HearInput, diarize: boolean): Promise<Heard> => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(i.audio)], { type: typeFor(i.ext, i.mime) }), audioName(i.ext));
    if (diarize) {
      form.append("model", "gpt-4o-transcribe-diarize");
      form.append("response_format", "diarized_json");
      form.append("chunking_strategy", "auto");
    } else {
      // Only whisper-1 gives the time of every line (gpt-4o-mini-transcribe gives text alone).
      form.append("model", "whisper-1");
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "segment");
      if (i.prompt) form.append("prompt", i.prompt.slice(0, 800));
    }
    const res = await doFetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(300_000) });
    if (!res.ok) await failed(res, "openai");
    const body = await res.json();
    return diarize ? { ...fromOpenAiDiarized(body), provider: "openai-diarize", diarized: true } : { ...fromWhisper(body), provider: "openai-whisper", diarized: false };
  };

  const plain = () => [
    ...(groqKey() ? [(i: HearInput) => groq(i)] : []),
    ...(deepgramKey() ? [(i: HearInput) => deepgram(i, false)] : []),
    ...(openAiOn(env) ? [(i: HearInput) => openai(i, false)] : []),
  ];
  const withSpeakers = () => [
    ...(deepgramKey() ? [(i: HearInput) => deepgram(i, true)] : []),
    ...(openAiOn(env) ? [(i: HearInput) => openai(i, true)] : []),
  ];

  return {
    available: () => plain().length > 0,
    speakersAvailable: () => withSpeakers().length > 0,
    async hear(input) {
      const tries = [...(input.speakers ? withSpeakers() : []), ...plain()];
      if (!tries.length) throw new Error("Speech to text isn't set up on this site yet.");
      let last: unknown = null;
      for (const run of tries) {
        // A busy service is tried once more after a short wait, then the next one takes over.
        for (let attempt = 0; attempt < 2; attempt++) {
          try { return await run(input); }
          catch (e) { last = e; if (!(e instanceof Busy)) break; if (attempt === 0) await new Promise((r) => setTimeout(r, 2500)); }
        }
      }
      throw last instanceof Error ? last : new Error("Speech to text failed.");
    },
  };
}

// ─── Writing ─────────────────────────────────────────────────────────────────

/** Asks the site's AI for a JSON object. `chars` is how much went in and out, for the cost log. */
export type AskJson = (system: string, user: string, opts?: { maxTokens?: number; temperature?: number }) => Promise<{ json: any; chars: number }>;

/** The first JSON object in a reply (some services wrap it in ``` or add a sentence). */
export function parseJsonReply(text: string): any {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try { return JSON.parse(t); } catch { /* look for the object */ }
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start >= 0 && end > start) { try { return JSON.parse(t.slice(start, end + 1)); } catch { /* not JSON */ } }
  return null;
}

export const askSiteAi: AskJson = async (system, user, opts = {}) => {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.NOTES_AI_MODEL || "gpt-4.1-mini", temperature: opts.temperature ?? 0.2, max_tokens: opts.maxTokens ?? 3000, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) { lastErr = new Error(`ai ${res.status}`); if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 3000)); continue; } break; }
      const body: any = await res.json().catch(() => null);
      const text = String(body?.choices?.[0]?.message?.content || "");
      const json = parseJsonReply(text);
      if (json && typeof json === "object") return { json, chars: system.length + user.length + text.length };
      lastErr = new Error("ai answer was not JSON");
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI failed");
};
export const siteAiReady = () => !!process.env.OPENAI_API_KEY;

export type Written<T> = { value: T; chars: number };

/** The summary of a recording. Long ones are summarized in parts first, then combined. */
export async function writeSummary(ask: AskJson, o: { template: NotesTemplateId; meetingDay: string; lines: string[]; maxT: number }): Promise<Written<NoteSummary>> {
  const all = o.lines.join("\n");
  if (all.length <= ONE_GO_CHARS) {
    const r = await ask(summaryPrompt(o.template, o.meetingDay), all, { maxTokens: 3500 });
    return { value: cleanSummary(r.json, o.template, o.maxT), chars: r.chars };
  }
  const parts = splitLines(o.lines, PART_CHARS);
  let chars = 0;
  const notes: unknown[] = [];
  for (let i = 0; i < parts.length; i++) {
    const r = await ask(partPrompt(o.template, o.meetingDay, i + 1, parts.length), parts[i], { maxTokens: 2500 });
    chars += r.chars;
    notes.push({ part: i + 1, notes: Array.isArray(r.json?.notes) ? r.json.notes.slice(0, 40) : [] });
  }
  const r = await ask(reducePrompt(o.template, o.meetingDay), JSON.stringify(notes), { maxTokens: 3500 });
  return { value: cleanSummary(r.json, o.template, o.maxT), chars: chars + r.chars };
}

export async function writeParentEmail(ask: AskJson, summary: NoteSummary, language: string): Promise<Written<ParentEmail | null>> {
  const r = await ask(parentPrompt(language), JSON.stringify({ summary: summary.summary, keyPoints: summary.keyPoints.map((x) => x.text), decisions: summary.decisions.map((x) => x.text), actions: summary.actions, dates: summary.dates, sections: summary.sections, iep: summary.iep }), { maxTokens: 1800, temperature: 0.4 });
  return { value: cleanParentEmail(r.json, language), chars: r.chars };
}

export async function translateSummary(ask: AskJson, summary: NoteSummary, template: NotesTemplateId, maxT: number, language: string): Promise<Written<NoteSummary>> {
  const r = await ask(translatePrompt(language), JSON.stringify(summary), { maxTokens: 4000 });
  return { value: cleanSummary(r.json, template, maxT), chars: r.chars };
}

export async function writeStudyTools(ask: AskJson, summary: NoteSummary | null, lines: string[]): Promise<Written<StudyTools>> {
  const text = lines.join("\n");
  const body = JSON.stringify({ summary: summary ? { summary: summary.summary, keyPoints: summary.keyPoints.map((x) => x.text), sections: summary.sections } : null, transcript: text.length > ONE_GO_CHARS ? `${text.slice(0, ONE_GO_CHARS)}\n…` : text });
  const r = await ask(studyPrompt(), body, { maxTokens: 3500, temperature: 0.4 });
  return { value: cleanStudy(r.json), chars: r.chars };
}

export async function readMemo(ask: AskJson, text: string, today: string, weekday: string): Promise<Written<MemoIdea>> {
  const r = await ask(memoPrompt(today, weekday), text.slice(0, 4000), { maxTokens: 600 });
  return { value: cleanMemo(r.json, text), chars: r.chars };
}

export async function planSearch(ask: AskJson, question: string, today: string): Promise<Written<AskPlan>> {
  const r = await ask(askPlanPrompt(today), question.slice(0, 500), { maxTokens: 400 });
  return { value: cleanAskPlan(r.json), chars: r.chars };
}

export async function answerFromPassages(ask: AskJson, question: string, passages: string[]): Promise<Written<{ answer: string; found: boolean }>> {
  const r = await ask(askAnswerPrompt(), `Question: ${question.slice(0, 500)}\n\nPassages:\n${passages.map((p, i) => `[${i + 1}] ${p}`).join("\n")}`, { maxTokens: 900 });
  const answer = typeof r.json?.answer === "string" ? r.json.answer.trim().slice(0, 3000) : "";
  return { value: { answer, found: r.json?.found !== false && !!answer }, chars: r.chars };
}
