// One sound at a time across Pod+: the swipe player, audiobooks and the radio tell each other when
// they start, and the others pause. (They all keep running when you move between pages.)
export type SoundSource = "pod" | "book" | "radio" | "music";
const EVENT = "podplus:sound";

export function soundStarted(source: SoundSource) {
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: source })); } catch { /* old browser */ }
}
/** Calls `pause` whenever a different source starts. Returns the clean-up. */
export function onOtherSound(mine: SoundSource, pause: () => void): () => void {
  const f = (e: Event) => { if ((e as CustomEvent).detail !== mine) pause(); };
  window.addEventListener(EVENT, f);
  return () => window.removeEventListener(EVENT, f);
}
