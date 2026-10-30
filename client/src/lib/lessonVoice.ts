// The voice of the Eye Gazer lessons: AI voices only (the Learning Buddy voice, then the general AI
// voice; never the device's robot voice), then a real animal sound if the line has one. Nothing here can hold a lesson up:
// every line always finishes (or is skipped), and the answer buttons never wait for the voice.
import { preloadCharacterAI, speakCharacterAI, stopSpeaking } from "@/lib/tts";

let line = 0;
let sound: HTMLAudioElement | null = null;

/** Stops whatever the lesson is saying or playing. */
export function stopLessonVoice() {
  line++;
  stopSpeaking();
  if (sound) { sound.pause(); sound = null; }
}

/** Plays a short sound (an animal) once; `done` runs when it ends, fails or after 8 seconds. */
export function playLessonSound(src: string, done?: () => void) {
  let finished = false;
  const finish = () => { if (!finished) { finished = true; done?.(); } };
  try {
    if (sound) sound.pause();
    const audio = new Audio(src);
    sound = audio;
    audio.onended = () => { if (sound === audio) sound = null; finish(); };
    audio.onerror = finish;
    void audio.play().catch(finish);
    window.setTimeout(finish, 8000);
  } catch {
    finish();
  }
}

/**
 * Says one line, then plays its sound. `onDone` runs once when both are over, or straight away
 * when the voice is off. A newer line (or stopLessonVoice) cancels this one and its `onDone`.
 */
export function sayLessonLine(text: string, options: { voice: boolean; sound?: string | null; onDone?: () => void }) {
  stopLessonVoice();
  const id = line;
  let spoken = false;
  const afterSpeech = () => {
    if (spoken || id !== line) return;
    spoken = true;
    if (options.sound) playLessonSound(options.sound, () => { if (id === line) options.onDone?.(); });
    else options.onDone?.();
  };
  if (!options.voice || !text.trim()) return afterSpeech();
  let fellBack = false;
  void speakCharacterAI(text, {
    calmMode: true,
    onEnd: () => { if (!fellBack) afterSpeech(); },
    onFallback: () => {
      if (fellBack || id !== line) return;
      fellBack = true;
      afterSpeech();
    },
  });
}

/** Starts making the next lines early so they play without a wait. */
export function warmLessonLines(lines: Array<string | null | undefined>) {
  for (const text of lines) if (text && text.trim()) void preloadCharacterAI(text, true).catch(() => {});
}

const VOICE_KEY = "arise-eye-gaze-lesson-voice";
export function savedLessonVoice(): boolean {
  try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; }
}
export function saveLessonVoice(on: boolean) {
  try { localStorage.setItem(VOICE_KEY, on ? "on" : "off"); } catch { /* private window */ }
}
