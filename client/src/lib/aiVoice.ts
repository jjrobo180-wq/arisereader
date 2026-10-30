// Every spoken line in the apps, in a real AI voice: never the phone's built-in robot voice.
// The words go to the server (POST /api/voice/say, server/routes.ts), which makes them with Groq's
// Orpheus voices, or Deepgram's Aura voices when Groq is busy (server/groqVoice.ts aiSpeech), and
// keeps what it made. Long text is said in pieces, the next one fetched while this one plays.
// When no AI voice can be reached, nothing is said and `onError` explains; there is no robot fallback.
//
// No "@/" imports here: Pod+ (podscroll/) uses this file too.

export type AiVoiceName = "hannah" | "autumn" | "diana" | "austin" | "daniel" | "troy";
export type SayOptions = {
  voice?: AiVoiceName;
  /** Playback speed (1 = normal). */ rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
  /** Called as each piece of a long text starts, with its index. */ onPart?: (index: number, text: string) => void;
};

let base = "";
let element: () => HTMLAudioElement = (() => { let a: HTMLAudioElement | null = null; return () => { if (!a) { a = new Audio(); a.preload = "auto"; a.setAttribute("playsinline", ""); } return a; }; })();
/** Where the server is, and the one (already unlocked) audio player to use. */
export function configureAiVoice(o: { base?: string; element?: () => HTMLAudioElement }) {
  if (o.base !== undefined) base = o.base.replace(/\/$/, "");
  if (o.element) element = o.element;
}

const made = new Map<string, Promise<Blob>>();
const remember = (key: string, p: Promise<Blob>) => {
  made.set(key, p);
  while (made.size > 80) made.delete(made.keys().next().value as string);
  p.catch(() => { if (made.get(key) === p) made.delete(key); });
  return p;
};

/** Splits text into pieces the voice can say in one go, at sentence ends where it can. */
export function voicePieces(text: string, max = 1400): string[] {
  const out: string[] = [];
  for (const para of String(text || "").split(/\n{2,}/)) {
    let rest = para.replace(/\s+/g, " ").trim();
    while (rest.length > max) {
      const head = rest.slice(0, max);
      const cut = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
      const at = cut > max * 0.4 ? cut + 1 : head.lastIndexOf(" ") > 0 ? head.lastIndexOf(" ") : max;
      out.push(rest.slice(0, at).trim()); rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

async function fetchVoice(text: string, voice: AiVoiceName): Promise<Blob> {
  let lastMessage = "The AI voice couldn't be reached. Check your connection and try again.";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
    try {
      const r = await fetch(`${base}/api/voice/say`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
      if (r.ok) { const b = await r.blob(); if (b.size > 100) return b; continue; }
      const body = await r.json().catch(() => ({} as any));
      lastMessage = body?.message || lastMessage;
      if (r.status !== 429 && r.status < 500) break;
    } catch { /* offline for a moment: try again */ }
  }
  throw new Error(lastMessage);
}

/** The AI voice saying `text`, fetched now (and kept), so it can start at once later. */
export function preloadAiVoice(text: string, voice: AiVoiceName = "hannah"): Promise<Blob> {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  const key = `${voice}|${t}`;
  return made.get(key) || remember(key, fetchVoice(t, voice));
}

let playing = 0;
let stopCurrent: (() => void) | null = null;

/** Stops whatever is being said. */
export function stopAiVoice() {
  playing++;
  const s = stopCurrent; stopCurrent = null;
  s?.();
}
export const isAiVoiceSpeaking = () => !!stopCurrent;

/** Says `text` in an AI voice. Resolves true once it has all been said, false if stopped or it failed. */
export async function sayAI(text: string, opts: SayOptions = {}): Promise<boolean> {
  stopAiVoice();
  const id = ++playing;
  const voice = opts.voice || "hannah";
  const pieces = voicePieces(text);
  if (!pieces.length) { opts.onEnd?.(); return true; }
  const a = element();
  let url = "";
  let finish: ((ok: boolean) => void) | null = null;
  stopCurrent = () => { a.pause(); if (url) URL.revokeObjectURL(url); url = ""; finish?.(false); };
  let started = false;
  try {
    for (let i = 0; i < pieces.length; i++) {
      const blob = await preloadAiVoice(pieces[i], voice);
      if (id !== playing) return false;
      if (i + 1 < pieces.length) void preloadAiVoice(pieces[i + 1], voice).catch(() => {});
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      const ok = await new Promise<boolean>((resolve) => {
        finish = resolve;
        a.onended = () => resolve(true);
        a.onerror = () => resolve(false);
        a.pause();
        a.src = url;
        a.playbackRate = opts.rate || 1;
        a.play().then(() => { if (!started) { started = true; opts.onStart?.(); } opts.onPart?.(i, pieces[i]); }, () => resolve(false));
      });
      finish = null;
      if (id !== playing) return false;
      if (!ok) throw new Error("This device didn't let the voice play. Tap and try again.");
    }
    if (id === playing) { stopCurrent = null; if (url) URL.revokeObjectURL(url); }
    opts.onEnd?.();
    return true;
  } catch (e: any) {
    if (id === playing) { stopCurrent = null; opts.onError?.(e?.message || "The AI voice couldn't play right now."); opts.onEnd?.(); }
    return false;
  }
}

/** The AI voices people can pick from (the server's Orpheus names; Aura and OpenAI have matches). */
export const AI_VOICES: { id: AiVoiceName; label: string }[] = [
  { id: "hannah", label: "Hannah" }, { id: "autumn", label: "Autumn (calm)" }, { id: "diana", label: "Diana" },
  { id: "austin", label: "Austin" }, { id: "daniel", label: "Daniel (deep)" }, { id: "troy", label: "Troy" },
];
export const aiVoiceOr = (v: unknown, fallback: AiVoiceName = "hannah"): AiVoiceName => (AI_VOICES.some((x) => x.id === v) ? (v as AiVoiceName) : fallback);
