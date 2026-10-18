// Spoken lines for the stage games: the character voice when available, the browser voice as a fallback,
// and a guaranteed "finished" callback so a game never waits forever for speech.
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

export function say(text: string, voice: boolean, onEnd?: () => void, calm = false) {
  if (!voice) { if (onEnd) window.setTimeout(onEnd, 400 + text.length * 30); return; }
  stopSpeaking();
  let fell = false, ended = false; const end = () => { if (ended) return; ended = true; window.clearTimeout(guard); onEnd?.(); };
  const guard = window.setTimeout(end, 3500 + text.length * 90);
  void speakCharacterAI(text, { calmMode: calm, onEnd: () => { if (!fell) end(); }, onFallback: () => {
    fell = true;
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.92; u.pitch = 1.08; u.onend = end; window.speechSynthesis.speak(u); } catch { end(); }
  } });
}
export { stopSpeaking };
