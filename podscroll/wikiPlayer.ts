// The Wiki podcast player's engine. It lives outside the screen, so the reading carries on when you
// leave the Wiki page, switch to another part of Pod+, leave the app or lock the phone. The screen
// (Wiki.tsx) only shows its state and sends it taps; the lock screen and headphones control it too.
import { preloadAiVoice, sayAI, sayPieces, stopAiVoice, type AiVoiceName } from "../client/src/lib/aiVoice";
import { parseArticle, wikiArticleUrl, wikiIntro, wikiOutro, type WikiArticle } from "@shared/podWiki";

export type WikiState = {
  title: string; art: WikiArticle | null; err: string;
  /** -1 = the spoken credit before the article; sections.length = the credit after it. */ sec: number; piece: number;
  playing: boolean; loading: boolean; voice: AiVoiceName; rate: number; quick: boolean;
};

let state: WikiState = { title: "", art: null, err: "", sec: -1, piece: 0, playing: false, loading: false, voice: "daniel", rate: 1, quick: false };
const listeners = new Set<() => void>();
let run = 0;

const set = (patch: Partial<WikiState>) => { state = { ...state, ...patch }; syncSession(); for (const l of [...listeners]) l(); };
export const wikiState = () => state;
export function subscribeWiki(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const wikiSections = (s: WikiState = state) => (s.art ? (s.quick ? s.art.sections.slice(0, 1) : s.art.sections) : []);

const textOf = (s: WikiState, i: number) => {
  const sections = wikiSections(s);
  if (!s.art) return "";
  return i === -1 ? wikiIntro(s.art.title) : i === sections.length ? wikiOutro(s.art.title) : `${i > 0 ? `${sections[i].title}. ` : ""}${sections[i].text}`;
};

/** Opens an article (the one already open is left playing). */
export async function openWiki(title: string): Promise<void> {
  if (state.title === title && (state.art || !state.err)) return;
  closeWiki();
  set({ title, art: null, err: "", sec: -1, piece: 0, playing: false, loading: false });
  try {
    const r = await fetch(wikiArticleUrl(title));
    if (!r.ok) throw new Error("Wikipedia isn't reachable right now.");
    const a = parseArticle(await r.json());
    if (state.title !== title) return;
    if (a) set({ art: a }); else set({ err: "That article couldn't be read." });
  } catch (e: any) { if (state.title === title) set({ err: e?.message || "Wikipedia isn't reachable right now." }); }
}

/** Stops and forgets the article. */
export function closeWiki() {
  run++; stopAiVoice();
  state = { ...state, title: "", art: null, err: "", sec: -1, piece: 0, playing: false, loading: false };
  syncSession(); for (const l of [...listeners]) l();
}

/** Plays from a section and piece, then carries on to the end (the credit comes after the last section). */
/** Each section checks the account's AI minutes first (set by main.tsx); returns a message when it can't play. */
let meter: ((title: string, sec: number, chars: number) => Promise<string | null>) | null = null;
export function setWikiMeter(fn: typeof meter) { meter = fn; }

export function playWiki(from = state.sec, fromPiece = state.piece) {
  const s0 = state;
  if (!s0.art) return;
  const id = ++run; stopAiVoice();
  const last = () => wikiSections().length;
  set({ playing: true, sec: Math.max(-1, Math.min(last(), from)), piece: fromPiece });
  const step = (i: number, p: number) => {
    if (id !== run) return;
    const s = state;
    if (i > wikiSections(s).length) { set({ playing: false, sec: -1, piece: 0, loading: false }); return; }
    const pieces = sayPieces(textOf(s, i), { pieceMax: 900, fastStart: true });
    set({ sec: i, loading: true });
    if (meter && s.title && i >= 0 && i < wikiSections(s).length) {
      const m = meter;
      void m(s.title, i, textOf(s, i).length).then((problem) => {
        if (id !== run) return;
        if (problem) { set({ err: problem, playing: false, loading: false }); return; }
        speak(i, p, s, pieces);
      });
      return;
    }
    speak(i, p, s, pieces);
  };
  const speak = (i: number, p: number, s: WikiState, pieces: string[]) => {
    // The next sections' first words are fetched while this one plays, so nothing has to be fetched
    // in the gap between them (the phone may not let the app fetch anything while it's locked).
    for (const k of [1, 2]) if (i + k <= wikiSections(s).length) { const nx = sayPieces(textOf(s, i + k), { pieceMax: 900, fastStart: true }); for (const piece of nx.slice(0, k === 1 ? 2 : 1)) void preloadAiVoice(piece, s.voice).catch(() => {}); }
    void sayAI(pieces.slice(p).join(" "), {
      voice: s.voice, rate: s.rate, pieceMax: 900, fastStart: true,
      onStart: () => { if (id === run) set({ loading: false }); },
      onPart: (k) => { if (id === run) set({ piece: p + k }); },
      onEnd: () => step(i + 1, 0),
      onError: (m) => { if (id === run) set({ err: m, playing: false, loading: false }); },
    });
  };
  step(state.sec, fromPiece);
}
export function pauseWiki() { run++; stopAiVoice(); set({ playing: false, loading: false }); }
export const toggleWiki = () => (state.playing ? pauseWiki() : playWiki(state.sec, state.piece));
export const skipWiki = (d: 1 | -1) => { const n = wikiSections().length; if (state.art) playWiki(Math.max(-1, Math.min(n, state.sec + d))); };
export function setWikiVoice(v: AiVoiceName) { const was = state.playing; if (was) pauseWiki(); set({ voice: v }); }
export function setWikiRate(r: number) { const was = state.playing; if (was) pauseWiki(); set({ rate: r }); }
export function setWikiQuick(q: boolean) { pauseWiki(); set({ quick: q, sec: -1, piece: 0 }); }

// ---- the lock screen and headphones ----
let handlersOn = false;
function syncSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    const ms = navigator.mediaSession;
    if (!state.art) { ms.metadata = null; ms.playbackState = "none"; return; }
    const sections = wikiSections();
    const part = state.sec >= 0 && state.sec < sections.length ? sections[state.sec].title : "Wikipedia";
    ms.metadata = new MediaMetadata({ title: state.art.title, artist: `Wiki podcast · ${part}`, album: "Pod+", artwork: state.art.image ? [{ src: state.art.image, sizes: "512x512" }] : [] });
    ms.playbackState = state.playing ? "playing" : "paused";
    if (!handlersOn) {
      handlersOn = true;
      const h = (a: MediaSessionAction, f: () => void) => { try { ms.setActionHandler(a, f); } catch { /* not supported */ } };
      h("play", () => { if (!state.playing) playWiki(state.sec, state.piece); });
      h("pause", () => pauseWiki());
      h("nexttrack", () => skipWiki(1)); h("previoustrack", () => skipWiki(-1));
      h("seekforward", () => skipWiki(1)); h("seekbackward", () => skipWiki(-1));
    }
  } catch { /* the lock screen isn't available here */ }
}
