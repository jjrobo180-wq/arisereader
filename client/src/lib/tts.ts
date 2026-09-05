// TTS helper for Eye Gaze quizzes using Web Speech API

// Animal sound mapping - onomatopoeia for common animals/objects
const SOUND_MAP: Record<string, string> = {
  // Animals
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
  rooster: "cock a doodle doo",
  fish: "blub blub",
  whale: "wooosh",
  dolphin: "click click click",
  // Farm animals
  bull: "mooo",
  calf: "mooo",
  hen: "cluck cluck",
  chick: "cheep cheep",
  lamb: "baa baa",
  // Vehicles (for matching quizzes)
  car: "vroom vroom",
  truck: "honk honk",
  train: "choo choo",
  airplane: "whoosh",
  bus: "honk honk",
  boat: "toot toot",
  fire_truck: "wee oo wee oo",
  ambulance: "wee oo wee oo",
  police: "wee oo wee oo",
  // Nature
  rain: "pitter patter",
  thunder: "boom",
  wind: "whoosh whoosh",
  // Body sounds
  heartbeat: "thump thump thump",
  // Music
  drum: "boom boom boom",
  guitar: "strum",
  piano: "ding dong",
  trumpet: "toot toot",
  // Misc
  clock: "tick tock tick tock",
  bell: "ding dong",
  phone: "ring ring",
  door: "knock knock",
};

// Check if text contains a keyword from the sound map
function findSoundKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [key, sound] of Object.entries(SOUND_MAP)) {
    // Match whole words only
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(lower)) {
      return sound;
    }
  }
  return null;
}

// Speak text using Web Speech API
export function speak(text: string, options?: { onEnd?: () => void; rate?: number; pitch?: number }) {
  if (!("speechSynthesis" in window)) {
    options?.onEnd?.();
    return;
  }
  
  window.speechSynthesis.cancel(); // Cancel any ongoing speech
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 0.85;
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = 1;
  
  // Try to find a good voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Natural") || v.name.includes("Premium"))
  ) || voices.find(v => v.lang.startsWith("en"));
  
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  
  utterance.onend = () => {
    options?.onEnd?.();
  };
  
  utterance.onerror = () => {
    options?.onEnd?.();
  };
  
  window.speechSynthesis.speak(utterance);
}

// Speak a question prompt, then play the associated sound effect if any
export function speakQuestion(prompt: string, correctAnswer: string, onDone?: () => void) {
  if (!("speechSynthesis" in window)) {
    onDone?.();
    return;
  }
  
  // First, speak the question prompt
  speak(prompt, {
    onEnd: () => {
      // After speaking the question, check if the answer has a sound effect
      const sound = findSoundKeyword(correctAnswer);
      if (sound) {
        // Speak the sound effect in a fun voice
        setTimeout(() => {
          speak(sound, {
            rate: 0.7,
            pitch: 1.3,
            onEnd: () => onDone?.(),
          });
        }, 300);
      } else {
        onDone?.();
      }
    }
  });
}

// Speak all answer options
export function speakOptions(options: string[]) {
  if (!("speechSynthesis" in window)) return;
  
  const text = options.map((opt, i) => `Option ${String.fromCharCode(65 + i)}: ${opt}`).join(". ");
  speak(text);
}

// Stop any ongoing speech
export function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// Initialize voices (some browsers need this)
export function initVoices() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
  }
}
