// Sound on tablets and phones. iPad and iPhone Safari (and, more loosely, Android) only let sound
// start inside a tap. Eye Gazer's games and lessons start their sounds later — after a voice line
// has been fetched, or when a look-to-press timer runs out — so on a tablet they stayed silent, and
// a reading game whose instructions are spoken seemed not to work at all. Desktop browsers let any
// earlier click count, which is why it only went wrong on tablets.
//
// So, on every tap (and key press):
//  - every game sound engine (AudioContext) that is still waiting gets started;
//  - on the first one, the one shared voice player (voiceElement) is started with a moment of
//    silence and the device voice says nothing quietly — after that both may play at any time.
// The voice lines (lib/tts.ts) all play through voiceElement for that reason.

const SILENT = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

let voice: HTMLAudioElement | null = null;
let unlocked = false;
const engines = new Set<AudioContext>();

/** The one audio player the voice lines use, so it only has to be unlocked once. */
export function voiceElement(): HTMLAudioElement {
  if (!voice) {
    voice = new Audio();
    voice.preload = "auto";
    voice.setAttribute("playsinline", "");
  }
  return voice;
}

function track(ctx: AudioContext) {
  engines.add(ctx);
  ctx.addEventListener?.("statechange", () => { if (ctx.state === "closed") engines.delete(ctx); });
}

function onGesture() {
  for (const ctx of engines) {
    if (ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => {});
  }
  if (unlocked) return;
  unlocked = true;
  const el = voiceElement();
  if (!el.src) {
    el.src = SILENT;
    void el.play().then(() => { if (el.src === SILENT) el.pause(); }).catch(() => { unlocked = false; });
  }
  try {
    if ("speechSynthesis" in window && !window.speechSynthesis.speaking) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch { /* no device voice */ }
}

/** Called once at start-up (main.tsx). */
export function installMediaUnlock(): void {
  if (typeof window === "undefined") return;
  // Every sound engine any game makes is remembered, so a tap can start it.
  const w = window as unknown as Record<string, unknown>;
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const Original = w[name] as (new (...args: any[]) => AudioContext) | undefined;
    if (typeof Original !== "function") continue;
    const Tracked = class extends Original {
      constructor(...args: any[]) { super(...args); track(this); }
    };
    try { w[name] = Tracked; } catch { /* read-only here: sounds still play after a tap inside the game */ }
  }
  for (const type of ["pointerup", "touchend", "click", "keydown"]) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }
}
