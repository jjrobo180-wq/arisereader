// To Duo's own player for the Podster plugins (Radio and Audiobooks): one sound at a time, and it keeps
// playing while the person moves around To Duo. The bar that shows it is AudioDock.tsx, drawn once by
// To Duo above every page. Podcasts' swipe feed and Study Podster's voices have their own players; they
// all take turns through the sound bus, so starting one pauses the others.
import { useSyncExternalStore } from "react";
import { onOtherSound, soundStarted, type SoundSource } from "@/components/family-hub/earshot/soundBus";

export type DuoTrack = {
  /** Which plugin it's from, and the page to open when the bar is tapped. */
  kind: "radio" | "book";
  section: "podradio" | "audiobooks";
  /** The same key means the same thing playing (a station, a book's chapter). */
  key: string;
  title: string;
  sub: string;
  art?: string;
  src: string;
  /** A live stream: no position, no skipping. */
  live?: boolean;
  /** Start here (seconds). */
  at?: number;
  /** Called every few seconds while it plays, and when it pauses, with where it is. */
  onTime?: (t: number) => void;
  /** Called when it plays to the end (an audiobook's next chapter). */
  onEnd?: () => void;
  /** Previous and next (an audiobook's chapters). */
  onPrev?: () => void;
  onNext?: () => void;
};

export type DuoAudioState = { track: DuoTrack | null; playing: boolean; loading: boolean; t: number; d: number; rate: number; sleepAt: number | null; error: string };

const SOURCE: Record<DuoTrack["kind"], SoundSource> = { radio: "radio", book: "book" };
const RATE_KEY = "duo.audio.rate";
const readRate = () => { try { const n = Number(localStorage.getItem(RATE_KEY)); return n >= 0.5 && n <= 3 ? n : 1; } catch { return 1; } };

let state: DuoAudioState = { track: null, playing: false, loading: false, t: 0, d: 0, rate: readRate(), sleepAt: null, error: "" };
const listeners = new Set<() => void>();
const set = (patch: Partial<DuoAudioState>) => { state = { ...state, ...patch }; listeners.forEach((f) => f()); };
let el: HTMLAudioElement | null = null;
let lastTimeCall = 0;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
let unhush: (() => void) | null = null;

function audio(): HTMLAudioElement {
  if (el) return el;
  const a = new Audio();
  a.preload = "auto";
  a.addEventListener("playing", () => { set({ playing: true, loading: false, error: "" }); if (state.track) soundStarted(SOURCE[state.track.kind]); });
  a.addEventListener("pause", () => { set({ playing: false }); state.track?.onTime?.(a.currentTime); });
  a.addEventListener("waiting", () => set({ loading: true }));
  a.addEventListener("loadedmetadata", () => set({ d: Number.isFinite(a.duration) ? a.duration : 0 }));
  a.addEventListener("timeupdate", () => {
    set({ t: a.currentTime });
    if (state.track?.onTime && Date.now() - lastTimeCall > 5000) { lastTimeCall = Date.now(); state.track.onTime(a.currentTime); }
  });
  a.addEventListener("ended", () => { const tr = state.track; set({ playing: false }); tr?.onEnd?.(); });
  a.addEventListener("error", () => { if (state.track) set({ playing: false, loading: false, error: state.track.live ? "This station isn't playing right now. Try another one." : "This didn't load. Try again." }); });
  el = a;
  return a;
}

function keepPitch(a: HTMLAudioElement) { try { (a as any).preservesPitch = true; (a as any).webkitPreservesPitch = true; } catch { /* fine */ } }

function claimLockScreen(tr: DuoTrack) {
  try {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: tr.title, artist: tr.sub, album: tr.kind === "radio" ? "Radio" : "Audiobooks", artwork: tr.art ? [{ src: tr.art, sizes: "300x300" }] : [] });
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => { void audio().play().catch(() => {}); });
    ms.setActionHandler("pause", () => audio().pause());
    ms.setActionHandler("previoustrack", tr.onPrev ?? null);
    ms.setActionHandler("nexttrack", tr.onNext ?? null);
    ms.setActionHandler("seekbackward", tr.live ? null : () => skip(-15));
    ms.setActionHandler("seekforward", tr.live ? null : () => skip(30));
  } catch { /* older browsers */ }
}

export function play(tr: DuoTrack) {
  const a = audio();
  // The same thing again: carry on (or start over from where it's asked to).
  if (state.track?.key === tr.key && a.src) {
    set({ track: tr });
    if (tr.at !== undefined && Math.abs(a.currentTime - tr.at) > 2) a.currentTime = tr.at;
    void a.play().catch(() => set({ playing: false }));
    return;
  }
  if (state.track && !state.track.live) state.track.onTime?.(a.currentTime);
  unhush?.();
  unhush = onOtherSound(SOURCE[tr.kind], () => audio().pause());
  set({ track: tr, playing: false, loading: true, t: tr.at ?? 0, d: 0, error: "" });
  a.src = tr.src;
  keepPitch(a);
  a.playbackRate = tr.live ? 1 : state.rate;
  if (tr.at) a.addEventListener("loadedmetadata", () => { try { a.currentTime = tr.at!; } catch { /* starts at the top */ } }, { once: true });
  claimLockScreen(tr);
  void a.play().catch(() => set({ loading: false, playing: false }));
}

export function toggle() {
  const a = audio();
  if (!state.track) return;
  if (a.paused) void a.play().catch(() => {}); else a.pause();
}

export function stop() {
  const a = audio();
  if (state.track && !state.track.live) state.track.onTime?.(a.currentTime);
  a.pause(); a.removeAttribute("src"); a.load();
  unhush?.(); unhush = null;
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
  set({ track: null, playing: false, loading: false, t: 0, d: 0, sleepAt: null, error: "" });
}

export function seek(t: number) { const a = audio(); if (!state.track || state.track.live) return; a.currentTime = Math.max(0, Math.min(t, state.d || t)); }
export function skip(by: number) { seek(audio().currentTime + by); }

export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export function setRate(r: number) {
  set({ rate: r });
  try { localStorage.setItem(RATE_KEY, String(r)); } catch { /* private window */ }
  if (state.track && !state.track.live) audio().playbackRate = r;
}

/** Pause after this many minutes (null turns it off). */
export function sleepIn(minutes: number | null) {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
  if (minutes == null) { set({ sleepAt: null }); return; }
  const at = Date.now() + minutes * 60_000;
  sleepTimer = setTimeout(() => { audio().pause(); set({ sleepAt: null }); }, minutes * 60_000);
  set({ sleepAt: at });
}

export const duoAudio = { play, toggle, stop, seek, skip, setRate, sleepIn, get: () => state };

export function useDuoAudio(): DuoAudioState {
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => state, () => state);
}
