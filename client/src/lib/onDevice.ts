// Arise Notes, Private and Strict modes, in the Notes iPhone app: speech to text that runs on the
// iPhone (the AriseOnDevice plugin, notes/ios-app/plugins/arise-on-device) and, for Strict mode, the
// summary written by Apple's on-device AI. Nothing here sends anything to a server.
import { cleanSummary, fmtClock, type NoteSummary, type NotesTemplateId, type Segment, templateOf } from "@shared/ariseNotes";
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

const PLUGIN = /arise.?on.?device/i;
const NAME = "AriseOnDevice";

export type PrivacyLevel = "standard" | "private" | "strict";
export type OnDeviceStatus = { speech: "granted" | "denied" | "restricted" | "prompt"; onDevice: boolean; ai: string; locale: string };

/** In an iPhone app build that has the on-device plugin. */
export const onDeviceAvailable = (): boolean => isNativeApp() && hasNativePlugin(PLUGIN);
const locale = () => { try { return navigator.language || "en-US"; } catch { return "en-US"; } };
const call = (method: string, options?: unknown) => nativeCall(PLUGIN, NAME, method, options);

export async function onDeviceStatus(): Promise<OnDeviceStatus | null> {
  if (!onDeviceAvailable()) return null;
  try { return await call("status", { locale: locale() }); } catch { return null; }
}

/** Asks iOS for speech recognition (its own prompt). Throws a sentence to show when it's not allowed. */
export async function allowOnDeviceSpeech(): Promise<void> {
  const now = await onDeviceStatus();
  if (!now) throw new Error("Private and Strict modes need the newest Arise Notes iPhone app.");
  const state = now.speech === "granted" ? "granted" : String((await call("requestSpeech"))?.speech ?? "");
  if (state !== "granted") throw new Error("Speech recognition is off for Arise Notes. Turn it on in Settings → Privacy & Security → Speech Recognition, then try again.");
  if (!now.onDevice) throw new Error("This iPhone can't write down speech on the device in your language. Use Standard mode for this recording.");
}

async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/** One piece of a recording, written down on the iPhone. Lines' times are from the piece's start. */
export async function transcribeOnDevice(blob: Blob, ext: string, hints: string[] = []): Promise<{ lines: { start: number; end: number; text: string }[]; duration: number }> {
  const r = await call("transcribe", { audio: await base64Of(blob), ext, locale: locale(), hints });
  const lines = (Array.isArray(r?.lines) ? r.lines : []).map((l: any) => ({ start: Number(l?.start) || 0, end: Number(l?.end) || 0, text: String(l?.text || "").slice(0, 2000) })).filter((l: { text: string }) => l.text.trim());
  return { lines, duration: Number(r?.duration) || 0 };
}

/** Words for the recognizer to listen for, by meeting type (IEP terms, medicine names…). */
export function hintsFor(template: NotesTemplateId): string[] {
  if (template === "iep") return ["IEP", "accommodations", "modifications", "present levels", "LRE", "FAPE", "speech therapy", "occupational therapy", "minutes per week", "progress monitoring", "504", "goals", "services"];
  if (template === "doctor") return ["milligrams", "prescription", "dose", "follow-up", "referral", "blood pressure"];
  return [];
}

// ─── Strict mode: the summary, written by the iPhone's own AI ─────────────────

/** Apple's on-device model reads about 4,000 tokens at a time, so long transcripts go in parts. */
export const STRICT_PART_CHARS = 6000;

/** Transcript lines in parts small enough for the on-device model, each with where it starts. */
export function strictParts(segments: Segment[], maxChars = STRICT_PART_CHARS): { start: number; text: string }[] {
  const parts: { start: number; text: string }[] = [];
  let cur: string[] = [], size = 0, start = 0;
  for (const s of segments) {
    const line = `[${fmtClock(s.start)}] ${s.text.trim()}`;
    if (!s.text.trim()) continue;
    if (cur.length && size + line.length + 1 > maxChars) { parts.push({ start, text: cur.join("\n") }); cur = []; size = 0; }
    if (!cur.length) start = s.start;
    cur.push(line.slice(0, maxChars));
    size += line.length + 1;
  }
  if (cur.length) parts.push({ start, text: cur.join("\n") });
  return parts;
}

/** The first JSON object in a reply (small models sometimes wrap it in ``` or add a sentence). */
export function jsonOf(text: string): any {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try { return JSON.parse(t); } catch { /* look inside */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* not JSON */ } }
  return null;
}

const PART_INSTRUCTIONS = (template: NotesTemplateId, today: string) => `You take meeting notes. Today is ${today}. This is a ${templateOf(template).label.toLowerCase()} transcript, or one part of it. ` +
  `Answer with only a JSON object, no other words: {"summary":"2-4 sentences","keyPoints":["..."],"decisions":["..."],"actions":[{"what":"...","who":"name or empty","due":"YYYY-MM-DD or empty"}],"questions":["..."],"dates":[{"title":"...","date":"YYYY-MM-DD","time":"HH:MM or empty"}]}. ` +
  `Use only what was said. Leave a list empty when there is nothing for it. Turn words like "next Tuesday" into dates from today.`;
const FINAL_INSTRUCTIONS = `You write the top of meeting notes. Answer with only a JSON object, no other words: {"title":"under 8 words","summary":"3-5 sentences"}. Use only the notes you are given.`;

type Generate = (instructions: string, prompt: string) => Promise<string>;
const iphoneAi: Generate = async (instructions, prompt) => String((await call("generate", { instructions, prompt }))?.text ?? "");

/** Puts the parts' answers together into one summary (lists merged, repeats dropped, each item at its part's time). */
export function mergeStrict(answers: { start: number; json: any; text: string }[], final: any, template: NotesTemplateId, highlights: number[], maxT: number): NoteSummary {
  const seen = new Set<string>();
  const once = <T,>(list: T[], key: (x: T) => string) => list.filter((x) => { const k = key(x).toLowerCase().replace(/\W+/g, " ").trim(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  const at = (start: number) => (x: any) => (typeof x === "string" ? { text: x, t: start } : { ...x, t: start });
  const all = (k: string) => answers.flatMap((a) => (Array.isArray(a.json?.[k]) ? a.json[k] : []).map(at(a.start)));
  const partSummaries = answers.map((a) => String(a.json?.summary ?? (a.json ? "" : a.text)).trim()).filter(Boolean);
  const raw = {
    title: final?.title ?? "",
    summary: String(final?.summary ?? "").trim() || partSummaries.join(" "),
    highlights: highlights.map((t) => ({ text: `Marked as important at ${fmtClock(t)}`, t })),
    keyPoints: once(all("keyPoints"), (x: any) => String(x.text ?? x)),
    decisions: once(all("decisions"), (x: any) => String(x.text ?? x)),
    actions: once(all("actions"), (x: any) => String(x.what ?? x.text ?? x)),
    questions: once(all("questions"), (x: any) => String(x.text ?? x)),
    dates: once(answers.flatMap((a) => (Array.isArray(a.json?.dates) ? a.json.dates : [])), (x: any) => `${x?.title} ${x?.date}`),
    sections: [],
  };
  return cleanSummary(raw, template, maxT);
}

/** Strict mode's summary: every part read by the iPhone's own AI, then one short overview. */
export async function summarizeOnDevice(o: { segments: Segment[]; template: NotesTemplateId; highlights: number[]; today: string; onStep?: (text: string) => void; generate?: Generate }): Promise<NoteSummary> {
  const generate = o.generate ?? iphoneAi;
  const parts = strictParts(o.segments);
  const maxT = o.segments.reduce((m, s) => Math.max(m, s.end), 0);
  const answers: { start: number; json: any; text: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    o.onStep?.(parts.length > 1 ? `Reading part ${i + 1} of ${parts.length} on this iPhone…` : "Writing your summary on this iPhone…");
    const text = await generate(PART_INSTRUCTIONS(o.template, o.today), parts[i].text);
    answers.push({ start: parts[i].start, json: jsonOf(text), text });
  }
  let final: any = null;
  if (answers.length > 1) {
    o.onStep?.("Putting the summary together…");
    const notes = answers.map((a, i) => `Part ${i + 1}: ${String(a.json?.summary ?? a.text).slice(0, 1200)}`).join("\n");
    final = jsonOf(await generate(FINAL_INSTRUCTIONS, notes.slice(0, STRICT_PART_CHARS)).catch(() => ""));
  } else if (answers[0]?.json) {
    final = { title: "", summary: answers[0].json.summary };
  }
  return mergeStrict(answers, final, o.template, o.highlights, maxT);
}
