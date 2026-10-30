// Spoken lines for the stage games: AI voices only (the character voice, then the general AI voice),
// and a guaranteed "finished" callback so a game never waits forever for speech.
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

export function say(text: string, voice: boolean, onEnd?: () => void, calm = false) {
  if (!voice) { if (onEnd) window.setTimeout(onEnd, 400 + text.length * 30); return; }
  stopSpeaking();
  let fell = false, ended = false; const end = () => { if (ended) return; ended = true; window.clearTimeout(guard); onEnd?.(); };
  const guard = window.setTimeout(end, 3500 + text.length * 90);
  void speakCharacterAI(text, { calmMode: calm, onEnd: () => { if (!fell) end(); }, onFallback: () => { fell = true; end(); } });
}
export { stopSpeaking };
