// TTS helper for Eye Gaze quizzes using Web Speech API
// Improved: better voices, subtitles, hover-to-read, correct animal sound logic

// Animal sound mapping - only used when the question asks "what animal is this?"
const SOUND_MAP: Record<string, string> = {
  cow: "mooo",
  dog: "woof woof",
  cat: "meow",
  duck: "quack quack",
  pig: "oink oink",
  horse: "neigh",
  sheep: "baa baa",
  goat: "maa maa",
  chicken: "cluck cluck",
  rooster: "cock a doodle doo",
  bird: "tweet tweet",
  frog: "ribbit ribbit",
  lion: "roar",
  tiger: "roar",
  bear: "grrr",
  monkey: "ooh ooh aah aah",
  elephant: "pawooo",
  snake: "hiss",
  bee: "buzz buzz",
  owl: "hoot hoot",
  mouse: "squeak squeak",
  rabbit: "squeak",
  fox: "ring ding ding",
  wolf: "awoooo",
  turkey: "gobble gobble",
  goose: "honk honk",
  donkey: "hee haw",
  fish: "blub blub",
  whale: "wooosh",
  dolphin: "click click click",
  bull: "mooo",
  calf: "mooo",
  hen: "cluck cluck",
  chick: "cheep cheep",
  lamb: "baa baa",
  car: "vroom vroom",
  truck: "honk honk",
  train: "choo choo",
  airplane: "whoosh",
  bus: "honk honk",
  boat: "toot toot",
  fire_truck: "wee oo wee oo",
  ambulance: "wee oo wee oo",
  police: "wee oo wee oo",
  rain: "pitter patter",
  thunder: "boom",
  wind: "whoosh whoosh",
  drum: "boom boom boom",
  guitar: "strum",
  piano: "ding dong",
  trumpet: "toot toot",
  clock: "tick tock tick tock",
  bell: "ding dong",
  phone: "ring ring",
  door: "knock knock",
};

// Emoji-to-sound mapping - used to play animal/vehicle sounds from the quiz visual
const EMOJI_SOUND_MAP: Record<string, string> = {
  "🐶": "woof woof", "🐕": "woof woof", "🐩": "woof woof",
  "🐱": "meow", "🐈": "meow",
  "🐰": "squeak squeak", "🐇": "squeak squeak",
  "🐮": "mooo", "🐂": "mooo", " calf": "mooo",
  "🐷": "oink oink", "🐖": "oink oink", "🐗": "oink oink",
  "🐴": "neigh", "🐎": "neigh",
  "🐑": "baa baa", "🐐": "maa maa", "🐏": "baa baa",
  "🦆": "quack quack",
  "🐔": "cluck cluck", "🐓": "cock a doodle doo", " henne": "cluck cluck", " chick": "cheep cheep",
  "🦃": "gobble gobble",
  "🦢": "honk honk", "🦉": "hoot hoot", "🦅": "screech",
  "🦇": "squeak",
  "🐺": "awoooo", "🦊": "ring ding ding",
  "🦝": "hiss",
  "🦁": "roar", "🐯": "roar", "🐅": "roar",
  "🐻": "grrr", "🐼": "grrr", "🐨": "grrr",
  "🐵": "ooh ooh aah aah", "🐒": "ooh ooh aah aah", "🦍": "ooh ooh aah aah",
  "🐘": "pawooo", "🦣": "pawooo", "🦏": "pawooo", "🦛": "grunt grunt",
  "🐭": "squeak squeak", "🐁": "squeak squeak", "🐀": "squeak squeak", "🐹": "squeak squeak",
  "🐿": "chatter chatter", "🦫": "slap slap", "🦔": "sniff sniff",
  "🦎": "hiss", "🐊": "snap snap", "🐢": "slow and steady",
  "🐍": "hiss",
  "🐲": "roar", "🐉": "roar", "🦕": "roar", "🦖": "roar",
  "🐳": "woooosh", "🐋": "woooosh", "🐬": "click click click",
  "🐟": "blub blub", "🐠": "blub blub", "🐡": "blub blub",
  "🦈": "dun dun dun dun",
  "🐙": "squish squish", "🦑": "squish squish",
  "🦐": "snap snap", "🦞": "snap snap", "🦀": "snap snap",
  "🐚": "whoosh", "🪼": "bloop bloop",
  "🐝": "buzz buzz", "🐛": "crunch crunch", "🦋": "flutter flutter",
  "🐌": "slime slime", "🐞": "tap tap", "🐜": "tap tap",
  "🪲": "click click", "🦟": "buzz buzz", "🪰": "buzz buzz",
  "🪱": "slither slither",
};

let selectedVoice: SpeechSynthesisVoice | null = null;
let currentSubtitle: string = "";

// Find the best available voice
function getBestVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Priority list - best voices first (most human-like)
  const voicePriority = [
    // Google voices (Chrome) - most natural
    (v: SpeechSynthesisVoice) => v.name.includes("Google US English"),
    // Mac natural voices
    (v: SpeechSynthesisVoice) => v.name === "Samantha" && v.lang === "en-US",
    (v: SpeechSynthesisVoice) => v.name === "Alex" && v.lang === "en-US",
    (v: SpeechSynthesisVoice) => v.name === "Daniel" && v.lang === "en-GB",
    // Any Google voice
    (v: SpeechSynthesisVoice) => v.name.includes("Google") && v.lang.startsWith("en"),
    // Microsoft natural voices (Edge)
    (v: SpeechSynthesisVoice) => v.name.includes("Natural") && v.lang.startsWith("en"),
    (v: SpeechSynthesisVoice) => v.name.includes("Aria") && v.lang.startsWith("en"),
    // Premium/enhanced voices
    (v: SpeechSynthesisVoice) => v.name.includes("Premium") && v.lang.startsWith("en"),
    (v: SpeechSynthesisVoice) => v.name.includes("Enhanced") && v.lang.startsWith("en"),
    // Any US English voice
    (v: SpeechSynthesisVoice) => v.lang === "en-US",
    // Any English voice
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en"),
  ];

  for (const check of voicePriority) {
    const found = voices.find(check);
    if (found) return found;
  }
  return voices[0];
}

// Initialize voices (call on component mount)
export function initVoices() {
  if (!("speechSynthesis" in window)) return;
  // Force voice loading
  window.speechSynthesis.getVoices();
  // Set selected voice
  selectedVoice = getBestVoice();
  // Chrome loads voices asynchronously
  window.speechSynthesis.onvoiceschanged = () => {
    selectedVoice = getBestVoice();
  };
}

// Get current subtitle text
export function getCurrentSubtitle(): string {
  return currentSubtitle;
}

// Speak text using Web Speech API with the best available voice
export function speak(
  text: string,
  options?: {
    onEnd?: () => void;
    onSubtitle?: (text: string) => void;
    rate?: number;
    pitch?: number;
    volume?: number;
  }
) {
  if (!("speechSynthesis" in window)) {
    options?.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 0.9;
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = options?.volume ?? 1;

  // Use the best voice
  const voice = selectedVoice || getBestVoice();
  if (voice) {
    utterance.voice = voice;
  }

  // Set subtitle
  currentSubtitle = text;
  options?.onSubtitle?.(text);

  utterance.onboundary = (event: SpeechSynthesisEvent) => {
    // Update subtitle with the word being spoken (for live subtitle effect)
    if (event.name === "word") {
      const spokenSoFar = text.substring(0, event.charIndex + event.charLength);
      options?.onSubtitle?.(spokenSoFar);
    }
  };

  utterance.onend = () => {
    currentSubtitle = "";
    options?.onSubtitle?.("");
    options?.onEnd?.();
  };

  utterance.onerror = () => {
    currentSubtitle = "";
    options?.onSubtitle?.("");
    options?.onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

// Check if the question is asking about an animal/vehicle/sound
function isSoundQuestion(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    lower.includes("what animal") ||
    lower.includes("what sound") ||
    lower.includes("what vehicle") ||
    lower.includes("which animal") ||
    lower.includes("which sound") ||
    lower.includes("what is this") ||
    lower.includes("who says") ||
    lower.includes("what goes")
  );
}

// Find the sound for the correct answer text
function findSoundForAnswer(answerText: string): string | null {
  const lower = answerText.toLowerCase().trim();
  // Direct match
  if (SOUND_MAP[lower]) return SOUND_MAP[lower];
  // Word match
  for (const [key, sound] of Object.entries(SOUND_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(lower)) {
      return sound;
    }
  }
  return null;
}

// Find sound from emoji visual
function findSoundFromEmoji(visual: string): string | null {
  if (!visual) return null;
  // Check each character in the visual string against the emoji map
  for (const char of visual) {
    if (EMOJI_SOUND_MAP[char]) {
      return EMOJI_SOUND_MAP[char];
    }
  }
  return null;
}

// Speak a question, then play the animal sound if the question is about animals
export function speakQuestion(
  prompt: string,
  visual: string,
  onSubtitle?: (text: string) => void,
  onDone?: () => void
) {
  if (!("speechSynthesis" in window)) {
    onDone?.();
    return;
  }

  // Speak the question prompt
  speak(prompt, {
    rate: 0.9,
    pitch: 1,
    onSubtitle,
    onEnd: () => {
      // Only play animal sound if the question is about animals/sounds
      if (isSoundQuestion(prompt)) {
        // Use the emoji visual to find the sound
        const sound = findSoundFromEmoji(visual);
        if (sound) {
          setTimeout(() => {
            speak(sound, {
              rate: 0.7,
              pitch: 1.3,
              onSubtitle,
              onEnd: () => onDone?.(),
            });
          }, 300);
        } else {
          // No emoji sound found, try text-based lookup
          const textSound = findSoundForAnswer(visual);
          if (textSound) {
            setTimeout(() => {
              speak(textSound, {
                rate: 0.7,
                pitch: 1.3,
                onSubtitle,
                onEnd: () => onDone?.(),
              });
            }, 300);
          } else {
            onDone?.();
          }
        }
      } else {
        onDone?.();
      }
    },
  });
}

// Speak a single option (for hover-to-read)
export function speakOption(text: string, onSubtitle?: (text: string) => void) {
  speak(text, {
    rate: 0.95,
    pitch: 1,
    onSubtitle,
  });
}

// Speak the question prompt again (replay)
export function replayQuestion(
  prompt: string,
  visual: string,
  onSubtitle?: (text: string) => void
) {
  speakQuestion(prompt, visual, onSubtitle);
}

// Stop any ongoing speech
export function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    currentSubtitle = "";
  }
}

// Speak all answer options sequentially
export function speakOptions(options: string[], onSubtitle?: (text: string) => void) {
  if (!("speechSynthesis" in window)) return;

  const text = options
    .map((opt, i) => `Option ${String.fromCharCode(65 + i)}: ${opt}`)
    .join(". ");
  speak(text, { rate: 0.9, onSubtitle });
}
