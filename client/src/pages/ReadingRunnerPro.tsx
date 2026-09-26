import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  Heart,
  LockKeyhole,
  Pause,
  Play,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type BuddyPreset = "puppy" | "dino" | "robot" | "bunny";

type BuddyConfig = {
  type: "preset" | "upload";
  preset: BuddyPreset;
  name: string;
  imageData: string | null;
  voiceEnabled: boolean;
  calmMode?: boolean;
};

type QuestionMode =
  | "mixed"
  | "sight"
  | "phonics"
  | "rhyming"
  | "vocabulary"
  | "sentences"
  | "comprehension";

type Difficulty = "starter" | "growing" | "challenge";

type RunnerQuestion = {
  prompt: string;
  choices: string[];
  answer: string;
  skill: string;
  mode: Exclude<QuestionMode, "mixed">;
  difficulty: 1 | 2 | 3;
};

type RunnerWorld = {
  name: string;
  theme: "city" | "park" | "tunnel" | "beach" | "night" | "space" | "jungle" | "snow";
  icon: string;
};

const WORLDS: RunnerWorld[] = [
  { name: "City Start", theme: "city", icon: "🏙️" },
  { name: "Park Dash", theme: "park", icon: "🌳" },
  { name: "Tunnel Rush", theme: "tunnel", icon: "🚇" },
  { name: "Beach Blast", theme: "beach", icon: "🏖️" },
  { name: "Neon Night", theme: "night", icon: "🌃" },
  { name: "Space Sprint", theme: "space", icon: "🚀" },
  { name: "Jungle Run", theme: "jungle", icon: "🌴" },
  { name: "Snowy Summit", theme: "snow", icon: "🏔️" },
  { name: "Skyline Challenge", theme: "city", icon: "🌇" },
  { name: "Reading Champion", theme: "night", icon: "🏆" },
];

const QUESTION_BANK: RunnerQuestion[] = [
  { prompt: "Find CAT.", choices: ["CAT", "CAN", "CAP"], answer: "CAT", skill: "Sight Word", mode: "sight", difficulty: 1 },
  { prompt: "Find DOG.", choices: ["DOT", "DOG", "DIG"], answer: "DOG", skill: "Sight Word", mode: "sight", difficulty: 1 },
  { prompt: "Find SUN.", choices: ["FUN", "SUN", "RUN"], answer: "SUN", skill: "Sight Word", mode: "sight", difficulty: 1 },
  { prompt: "Find BOOK.", choices: ["LOOK", "BOOK", "HOOK"], answer: "BOOK", skill: "Sight Word", mode: "sight", difficulty: 1 },
  { prompt: "Which word says PLAY?", choices: ["PLAY", "PLAN", "PLUG"], answer: "PLAY", skill: "Sight Word", mode: "sight", difficulty: 2 },
  { prompt: "Which word says FRIEND?", choices: ["FRONT", "FRIEND", "FIND"], answer: "FRIEND", skill: "Sight Word", mode: "sight", difficulty: 2 },
  { prompt: "Find BECAUSE.", choices: ["BEFORE", "BECAUSE", "BECOME"], answer: "BECAUSE", skill: "Sight Word", mode: "sight", difficulty: 3 },
  { prompt: "Find DIFFERENT.", choices: ["DIFFERENT", "DIFFICULT", "DISTANT"], answer: "DIFFERENT", skill: "Sight Word", mode: "sight", difficulty: 3 },

  { prompt: "Which word starts with B?", choices: ["BALL", "CAT", "SUN"], answer: "BALL", skill: "Beginning Sound", mode: "phonics", difficulty: 1 },
  { prompt: "Which word starts with M?", choices: ["DOG", "MAP", "SUN"], answer: "MAP", skill: "Beginning Sound", mode: "phonics", difficulty: 1 },
  { prompt: "Which word ends with T?", choices: ["CAT", "DOG", "SUN"], answer: "CAT", skill: "Ending Sound", mode: "phonics", difficulty: 1 },
  { prompt: "Which word has the long A sound?", choices: ["CAKE", "CAT", "CAN"], answer: "CAKE", skill: "Long Vowel", mode: "phonics", difficulty: 2 },
  { prompt: "Which word has the SH sound?", choices: ["SHIP", "SIP", "TIP"], answer: "SHIP", skill: "Digraph", mode: "phonics", difficulty: 2 },
  { prompt: "Which word has the CH sound?", choices: ["CHAIR", "SHARE", "CARE"], answer: "CHAIR", skill: "Digraph", mode: "phonics", difficulty: 2 },
  { prompt: "Which word has a silent E?", choices: ["BIKE", "BIG", "BIN"], answer: "BIKE", skill: "Silent E", mode: "phonics", difficulty: 3 },
  { prompt: "Which word begins with the blend STR?", choices: ["STREET", "SEAT", "TREE"], answer: "STREET", skill: "Consonant Blend", mode: "phonics", difficulty: 3 },

  { prompt: "Which word rhymes with CAT?", choices: ["HAT", "DOG", "SUN"], answer: "HAT", skill: "Rhyming", mode: "rhyming", difficulty: 1 },
  { prompt: "Which word rhymes with BOOK?", choices: ["LOOK", "BALL", "TREE"], answer: "LOOK", skill: "Rhyming", mode: "rhyming", difficulty: 1 },
  { prompt: "Which word rhymes with STAR?", choices: ["CAR", "SUN", "BED"], answer: "CAR", skill: "Rhyming", mode: "rhyming", difficulty: 1 },
  { prompt: "Which word rhymes with LIGHT?", choices: ["NIGHT", "LATE", "LIT"], answer: "NIGHT", skill: "Rhyming", mode: "rhyming", difficulty: 2 },
  { prompt: "Which word rhymes with TRAIN?", choices: ["RAIN", "TREE", "RUN"], answer: "RAIN", skill: "Rhyming", mode: "rhyming", difficulty: 2 },
  { prompt: "Which pair rhymes?", choices: ["BLUE / SHOE", "CAT / DOG", "SUN / BED"], answer: "BLUE / SHOE", skill: "Rhyming Pair", mode: "rhyming", difficulty: 3 },

  { prompt: "Which word means happy?", choices: ["GLAD", "MAD", "SAD"], answer: "GLAD", skill: "Vocabulary", mode: "vocabulary", difficulty: 1 },
  { prompt: "What is the opposite of HOT?", choices: ["COLD", "BIG", "FAST"], answer: "COLD", skill: "Opposites", mode: "vocabulary", difficulty: 1 },
  { prompt: "Which word means very big?", choices: ["HUGE", "TINY", "SLOW"], answer: "HUGE", skill: "Vocabulary", mode: "vocabulary", difficulty: 2 },
  { prompt: "Which word means to look closely?", choices: ["EXAMINE", "IGNORE", "HIDE"], answer: "EXAMINE", skill: "Vocabulary", mode: "vocabulary", difficulty: 2 },
  { prompt: "Which word means very tired?", choices: ["EXHAUSTED", "EXCITED", "CURIOUS"], answer: "EXHAUSTED", skill: "Vocabulary", mode: "vocabulary", difficulty: 3 },
  { prompt: "Which word is closest to enormous?", choices: ["GIANT", "QUIET", "QUICK"], answer: "GIANT", skill: "Synonyms", mode: "vocabulary", difficulty: 3 },

  { prompt: "Finish: The dog ___.", choices: ["RUNS", "BLUE", "BOOK"], answer: "RUNS", skill: "Sentence Meaning", mode: "sentences", difficulty: 1 },
  { prompt: "Finish: I wear shoes on my ___.", choices: ["FEET", "BOOK", "MILK"], answer: "FEET", skill: "Sentence Meaning", mode: "sentences", difficulty: 1 },
  { prompt: "Which sentence makes sense?", choices: ["I read a book.", "Book the run.", "Blue eats fast."], answer: "I read a book.", skill: "Sentence Meaning", mode: "sentences", difficulty: 2 },
  { prompt: "Which sentence is complete?", choices: ["The dog runs.", "Dog the.", "Runs blue."], answer: "The dog runs.", skill: "Complete Sentence", mode: "sentences", difficulty: 2 },
  { prompt: "Choose the best word: Maya ___ to school every day.", choices: ["WALKS", "BLUE", "BOOK"], answer: "WALKS", skill: "Grammar", mode: "sentences", difficulty: 2 },
  { prompt: "Which sentence uses punctuation correctly?", choices: ["Where are you?", "Where are you.", "Where are you!"], answer: "Where are you?", skill: "Punctuation", mode: "sentences", difficulty: 3 },
  { prompt: "Which sentence has the best word order?", choices: ["The bird flew away.", "Away bird the flew.", "Flew the away bird."], answer: "The bird flew away.", skill: "Syntax", mode: "sentences", difficulty: 3 },

  { prompt: "Mia has a red ball. What color is the ball?", choices: ["RED", "BLUE", "GREEN"], answer: "RED", skill: "Comprehension", mode: "comprehension", difficulty: 1 },
  { prompt: "Sam ran home. What did Sam do?", choices: ["RAN", "SLEPT", "ATE"], answer: "RAN", skill: "Comprehension", mode: "comprehension", difficulty: 1 },
  { prompt: "The bird is in the tree. Where is the bird?", choices: ["TREE", "CAR", "HOUSE"], answer: "TREE", skill: "Comprehension", mode: "comprehension", difficulty: 1 },
  { prompt: "Lena packed an umbrella because dark clouds filled the sky. Why did she pack it?", choices: ["IT MIGHT RAIN", "SHE WAS HUNGRY", "IT WAS BEDTIME"], answer: "IT MIGHT RAIN", skill: "Inference", mode: "comprehension", difficulty: 2 },
  { prompt: "Ben practiced every day. On Friday he played the song perfectly. What helped Ben improve?", choices: ["PRACTICE", "SLEEP", "LUCK"], answer: "PRACTICE", skill: "Cause and Effect", mode: "comprehension", difficulty: 2 },
  { prompt: "A story is mostly about a puppy learning to swim. What is the best main idea?", choices: ["A PUPPY LEARNS TO SWIM", "A CAT EATS DINNER", "A BOY RIDES A BUS"], answer: "A PUPPY LEARNS TO SWIM", skill: "Main Idea", mode: "comprehension", difficulty: 3 },
  { prompt: "Jordan forgot his coat and shivered outside. What can you infer?", choices: ["IT WAS COLD", "IT WAS HOT", "HE WAS SWIMMING"], answer: "IT WAS COLD", skill: "Inference", mode: "comprehension", difficulty: 3 },
];

const MODE_OPTIONS: Array<{ id: QuestionMode; label: string; icon: string; description: string }> = [
  { id: "mixed", label: "Mixed", icon: "🎯", description: "A little of everything" },
  { id: "sight", label: "Sight Words", icon: "👀", description: "Recognize common words" },
  { id: "phonics", label: "Phonics", icon: "🔤", description: "Letters and sounds" },
  { id: "rhyming", label: "Rhyming", icon: "🎵", description: "Words that sound alike" },
  { id: "vocabulary", label: "Vocabulary", icon: "💡", description: "Word meanings" },
  { id: "sentences", label: "Sentences", icon: "✏️", description: "Build and understand sentences" },
  { id: "comprehension", label: "Comprehension", icon: "📖", description: "Read and understand" },
];

const DIFFICULTY_OPTIONS: Array<{ id: Difficulty; label: string; value: 1 | 2 | 3; description: string }> = [
  { id: "starter", label: "Starter", value: 1, description: "Short and simple" },
  { id: "growing", label: "Growing", value: 2, description: "A little harder" },
  { id: "challenge", label: "Challenge", value: 3, description: "Bigger reading challenge" },
];

function difficultyNumber(value: Difficulty): 1 | 2 | 3 {
  return value === "starter" ? 1 : value === "growing" ? 2 : 3;
}

function buildQuestionSet(mode: QuestionMode, difficulty: Difficulty, level: number): RunnerQuestion[] {
  const maxDifficulty = difficultyNumber(difficulty);
  let pool = QUESTION_BANK.filter(q => q.difficulty <= maxDifficulty);
  if (mode !== "mixed") pool = pool.filter(q => q.mode === mode);
  if (!pool.length) pool = QUESTION_BANK.filter(q => q.difficulty <= maxDifficulty);

  const start = ((level - 1) * 3) % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  const result: RunnerQuestion[] = [];
  for (const q of rotated) {
    if (!result.some(x => x.prompt === q.prompt)) result.push(q);
    if (result.length >= 5) break;
  }
  while (result.length < 5 && pool.length) {
    result.push(pool[result.length % pool.length]);
  }
  return result;
}

function createAudioContext(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    return new Ctx();
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function noise(ctx: AudioContext, start: number, duration: number, volume: number) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1100;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.start(start);
  source.stop(start + duration);
}

function playFx(type: "tap" | "jump" | "coin" | "correct" | "wrong" | "win") {
  const ctx = createAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (type === "tap") {
    tone(ctx, 520, now, .08, .05, "triangle");
  } else if (type === "jump") {
    tone(ctx, 260, now, .18, .08, "triangle");
    tone(ctx, 620, now + .08, .2, .07, "sine");
    noise(ctx, now, .12, .015);
  } else if (type === "coin") {
    tone(ctx, 880, now, .12, .08, "sine");
    tone(ctx, 1320, now + .07, .17, .075, "sine");
  } else if (type === "correct") {
    tone(ctx, 523, now, .16, .075, "triangle");
    tone(ctx, 659, now + .08, .16, .075, "triangle");
    tone(ctx, 784, now + .16, .22, .075, "triangle");
  } else if (type === "wrong") {
    noise(ctx, now, .18, .045);
    tone(ctx, 180, now, .23, .08, "sawtooth");
    tone(ctx, 105, now + .08, .2, .06, "triangle");
  } else {
    [523, 659, 784, 1046].forEach((f, i) => tone(ctx, f, now + i * .1, .3, .08, "triangle"));
    noise(ctx, now + .28, .2, .018);
  }

  window.setTimeout(() => ctx.close().catch(() => {}), 900);
}

function BuddyRunner({
  buddy,
  action,
  talking,
}: {
  buddy: BuddyConfig;
  action: "run" | "jump" | "hit" | "celebrate";
  talking: boolean;
}) {
  if (buddy.type === "upload" && buddy.imageData) {
    return (
      <div className={`buddy-runner runner-${action}`} aria-label={buddy.name}>
        <div className="upload-runner">
          <div className="runner-arm runner-arm-left" />
          <div className="runner-arm runner-arm-right" />
          <div className="upload-body">
            <img src={buddy.imageData} alt={buddy.name} className="upload-face" />
            <div className={`upload-mouth ${talking ? "is-talking" : ""}`} />
          </div>
          <div className="runner-leg runner-leg-left" />
          <div className="runner-leg runner-leg-right" />
          <div className="runner-shoe runner-shoe-left" />
          <div className="runner-shoe runner-shoe-right" />
        </div>
      </div>
    );
  }

  const common = {
    actionClass: `buddy-runner runner-${action}`,
    mouthClass: `buddy-svg-mouth ${talking ? "is-talking" : ""}`,
  };

  if (buddy.preset === "robot") {
    return (
      <div className={common.actionClass} aria-label={buddy.name}>
        <svg viewBox="0 0 180 230" className="buddy-svg">
          <defs>
            <linearGradient id="robotBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="55%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
          </defs>
          <ellipse className="runner-shadow" cx="90" cy="218" rx="47" ry="10" fill="rgba(15,23,42,.25)" />
          <g className="runner-body">
            <g className="runner-back-arm" style={{ transformOrigin: "54px 112px" }}>
              <rect x="28" y="103" width="52" height="20" rx="10" fill="#60a5fa" />
              <circle cx="27" cy="113" r="13" fill="#c4b5fd" />
            </g>
            <g className="runner-back-leg" style={{ transformOrigin: "72px 164px" }}>
              <rect x="59" y="153" width="25" height="59" rx="12" fill="#1d4ed8" />
              <rect x="48" y="198" width="43" height="18" rx="9" fill="#e0f2fe" />
            </g>
            <rect x="48" y="92" width="84" height="80" rx="25" fill="url(#robotBody)" stroke="#e0f2fe" strokeWidth="5" />
            <circle cx="90" cy="131" r="16" fill="#0f172a" />
            <path d="M90 118 l7 10 12 2-9 8 3 12-13-6-12 6 3-12-9-8 12-2z" fill="#facc15" />
            <g className="runner-front-leg" style={{ transformOrigin: "110px 164px" }}>
              <rect x="99" y="153" width="25" height="59" rx="12" fill="#2563eb" />
              <rect x="94" y="198" width="44" height="18" rx="9" fill="#e0f2fe" />
            </g>
            <g className="runner-front-arm" style={{ transformOrigin: "127px 112px" }}>
              <rect x="115" y="102" width="53" height="20" rx="10" fill="#3b82f6" />
              <circle cx="166" cy="112" r="13" fill="#c4b5fd" />
            </g>
            <rect x="42" y="25" width="96" height="78" rx="28" fill="#dbeafe" stroke="#60a5fa" strokeWidth="6" />
            <rect x="55" y="39" width="70" height="47" rx="19" fill="#0f172a" />
            <circle cx="75" cy="59" r="8" fill="#22d3ee" />
            <circle cx="105" cy="59" r="8" fill="#22d3ee" />
            <rect x="82" y="9" width="16" height="22" rx="8" fill="#60a5fa" />
            <circle cx="90" cy="8" r="7" fill="#f472b6" />
            <rect className={common.mouthClass} x="76" y="73" width="28" height="6" rx="3" fill="#22d3ee" />
          </g>
        </svg>
      </div>
    );
  }

  if (buddy.preset === "dino") {
    return (
      <div className={common.actionClass} aria-label={buddy.name}>
        <svg viewBox="0 0 190 230" className="buddy-svg">
          <defs>
            <linearGradient id="dinoBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          <ellipse className="runner-shadow" cx="95" cy="217" rx="50" ry="10" fill="rgba(15,23,42,.25)" />
          <g className="runner-body">
            <path d="M46 131 Q15 127 7 104 Q35 114 58 101" fill="url(#dinoBody)" />
            <g className="runner-back-leg" style={{ transformOrigin: "79px 170px" }}>
              <rect x="65" y="157" width="29" height="58" rx="14" fill="#22c55e" />
              <ellipse cx="73" cy="211" rx="26" ry="11" fill="#14532d" />
            </g>
            <ellipse cx="101" cy="132" rx="58" ry="57" fill="url(#dinoBody)" />
            <path d="M61 91 l-15 -16 24 4-5-23 20 13 7-24 13 22 18-18 0 27 24-4-16 21z" fill="#facc15" opacity=".9" />
            <g className="runner-front-leg" style={{ transformOrigin: "119px 169px" }}>
              <rect x="108" y="156" width="29" height="59" rx="14" fill="#16a34a" />
              <ellipse cx="127" cy="211" rx="26" ry="11" fill="#14532d" />
            </g>
            <g className="runner-back-arm" style={{ transformOrigin: "64px 128px" }}>
              <rect x="36" y="122" width="47" height="17" rx="8" fill="#4ade80" transform="rotate(18 58 130)" />
            </g>
            <g className="runner-front-arm" style={{ transformOrigin: "137px 128px" }}>
              <rect x="124" y="119" width="44" height="17" rx="8" fill="#22c55e" transform="rotate(-22 145 127)" />
            </g>
            <ellipse cx="108" cy="70" rx="54" ry="47" fill="url(#dinoBody)" />
            <ellipse cx="79" cy="57" rx="9" ry="11" fill="white" />
            <ellipse cx="79" cy="59" rx="4" ry="6" fill="#111827" />
            <ellipse cx="116" cy="57" rx="9" ry="11" fill="white" />
            <ellipse cx="116" cy="59" rx="4" ry="6" fill="#111827" />
            <circle cx="145" cy="76" r="4" fill="#14532d" />
            <path d="M73 84 Q108 106 148 84 Q135 117 103 115 Q82 111 73 84z" fill="#14532d" />
            <path d="M87 91 l8 13 7-11 8 13 8-13 7 9" fill="white" />
            <ellipse className={common.mouthClass} cx="109" cy="101" rx="13" ry="5" fill="#ef4444" />
          </g>
        </svg>
      </div>
    );
  }

  if (buddy.preset === "bunny") {
    return (
      <div className={common.actionClass} aria-label={buddy.name}>
        <svg viewBox="0 0 180 235" className="buddy-svg">
          <defs>
            <linearGradient id="bunnyBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f5f3ff" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          </defs>
          <ellipse className="runner-shadow" cx="90" cy="222" rx="47" ry="10" fill="rgba(15,23,42,.25)" />
          <g className="runner-body">
            <g className="runner-back-leg" style={{ transformOrigin: "72px 174px" }}>
              <rect x="60" y="157" width="25" height="62" rx="13" fill="#ddd6fe" />
              <ellipse cx="64" cy="216" rx="28" ry="12" fill="#ede9fe" />
            </g>
            <ellipse cx="90" cy="141" rx="48" ry="50" fill="url(#bunnyBody)" />
            <g className="runner-front-leg" style={{ transformOrigin: "109px 174px" }}>
              <rect x="99" y="157" width="25" height="62" rx="13" fill="#c4b5fd" />
              <ellipse cx="120" cy="216" rx="28" ry="12" fill="#ede9fe" />
            </g>
            <g className="runner-back-arm" style={{ transformOrigin: "53px 135px" }}>
              <rect x="25" y="128" width="48" height="18" rx="9" fill="#ddd6fe" />
            </g>
            <g className="runner-front-arm" style={{ transformOrigin: "127px 135px" }}>
              <rect x="112" y="126" width="46" height="18" rx="9" fill="#c4b5fd" />
            </g>
            <ellipse cx="72" cy="32" rx="16" ry="42" fill="#ede9fe" transform="rotate(-8 72 32)" />
            <ellipse cx="113" cy="32" rx="16" ry="42" fill="#ede9fe" transform="rotate(8 113 32)" />
            <ellipse cx="72" cy="31" rx="7" ry="31" fill="#f9a8d4" transform="rotate(-8 72 31)" />
            <ellipse cx="113" cy="31" rx="7" ry="31" fill="#f9a8d4" transform="rotate(8 113 31)" />
            <circle cx="91" cy="82" r="50" fill="url(#bunnyBody)" />
            <ellipse cx="73" cy="77" rx="7" ry="9" fill="#111827" />
            <ellipse cx="109" cy="77" rx="7" ry="9" fill="#111827" />
            <circle cx="75" cy="74" r="2" fill="white" />
            <circle cx="111" cy="74" r="2" fill="white" />
            <path d="M84 91 Q91 83 98 91 Q91 100 84 91" fill="#f472b6" />
            <ellipse className={common.mouthClass} cx="91" cy="106" rx="12" ry="5" fill="#7f1d1d" />
            <circle cx="58" cy="94" r="7" fill="#f9a8d4" opacity=".45" />
            <circle cx="124" cy="94" r="7" fill="#f9a8d4" opacity=".45" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className={common.actionClass} aria-label={buddy.name}>
      <svg viewBox="0 0 190 230" className="buddy-svg">
        <defs>
          <linearGradient id="puppyBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <ellipse className="runner-shadow" cx="95" cy="218" rx="50" ry="10" fill="rgba(15,23,42,.25)" />
        <g className="runner-body">
          <path d="M51 119 Q22 105 24 78 Q41 88 61 92" fill="#92400e" />
          <g className="runner-back-leg" style={{ transformOrigin: "76px 170px" }}>
            <rect x="63" y="153" width="28" height="63" rx="14" fill="#d97706" />
            <ellipse cx="63" cy="212" rx="27" ry="11" fill="#78350f" />
          </g>
          <ellipse cx="99" cy="137" rx="53" ry="54" fill="url(#puppyBody)" />
          <path d="M71 109 Q99 88 127 109 L119 139 Q99 151 78 139z" fill="#fef3c7" opacity=".9" />
          <g className="runner-front-leg" style={{ transformOrigin: "119px 170px" }}>
            <rect x="108" y="154" width="28" height="62" rx="14" fill="#b45309" />
            <ellipse cx="132" cy="212" rx="27" ry="11" fill="#78350f" />
          </g>
          <g className="runner-back-arm" style={{ transformOrigin: "57px 133px" }}>
            <rect x="28" y="126" width="50" height="19" rx="10" fill="#d97706" />
          </g>
          <g className="runner-front-arm" style={{ transformOrigin: "139px 132px" }}>
            <rect x="124" y="124" width="47" height="19" rx="10" fill="#b45309" />
          </g>
          <path d="M52 55 Q36 24 18 36 Q22 71 57 82z" fill="#78350f" />
          <path d="M139 55 Q155 24 173 36 Q169 71 134 82z" fill="#78350f" />
          <circle cx="96" cy="75" r="53" fill="url(#puppyBody)" />
          <ellipse cx="75" cy="68" rx="8" ry="10" fill="#111827" />
          <ellipse cx="116" cy="68" rx="8" ry="10" fill="#111827" />
          <circle cx="77" cy="65" r="2" fill="white" />
          <circle cx="118" cy="65" r="2" fill="white" />
          <ellipse cx="96" cy="87" rx="12" ry="9" fill="#3f2a1e" />
          <path d="M85 98 Q96 111 108 98" fill="none" stroke="#7c2d12" strokeWidth="5" strokeLinecap="round" />
          <ellipse className={common.mouthClass} cx="96" cy="107" rx="11" ry="5" fill="#ef4444" />
          <circle cx="61" cy="91" r="7" fill="#fb7185" opacity=".35" />
          <circle cx="132" cy="91" r="7" fill="#fb7185" opacity=".35" />
        </g>
      </svg>
    </div>
  );
}

function SceneDecor({ theme }: { theme: RunnerWorld["theme"] }) {
  const dark = theme === "night" || theme === "space" || theme === "tunnel";
  const sky =
    theme === "space"
      ? "from-[#050816] via-[#151b4d] to-[#312e81]"
      : theme === "night"
        ? "from-[#10172d] via-[#202c61] to-[#5b4b8a]"
        : theme === "tunnel"
          ? "from-[#111827] via-[#263044] to-[#374151]"
          : theme === "beach"
            ? "from-[#60d5ff] via-[#b9f3ff] to-[#ffdf9a]"
            : theme === "jungle"
              ? "from-[#52d7df] via-[#9ff3c9] to-[#39a96b]"
              : theme === "snow"
                ? "from-[#8fd7ff] via-[#eaf8ff] to-[#c6dcf1]"
                : "from-[#65c9ff] via-[#c4f2ff] to-[#b7e4b1]";

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-b ${sky}`} />

      <div className="absolute inset-x-0 top-0 h-[42%] overflow-hidden">
        {dark ? (
          <div className="absolute inset-0">
            {Array.from({ length: 42 }).map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white runner-star"
                style={{
                  width: i % 5 === 0 ? 3 : 2,
                  height: i % 5 === 0 ? 3 : 2,
                  left: `${(i * 29) % 100}%`,
                  top: `${(i * 17) % 82}%`,
                  animationDelay: `${(i % 9) * .12}s`,
                }}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="cloud cloud-one" />
            <div className="cloud cloud-two" />
            <div className="cloud cloud-three" />
          </>
        )}
      </div>

      {theme === "space" && (
        <>
          <div className="absolute top-[15%] right-[8%] w-28 h-28 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-fuchsia-300 via-violet-500 to-indigo-900 shadow-[0_0_60px_rgba(167,139,250,.45)]">
            <div className="absolute -inset-x-8 top-1/2 h-5 rounded-full border-[7px] border-amber-200/80 rotate-[-16deg]" />
          </div>
          <div className="absolute top-[31%] left-[8%] text-5xl sm:text-7xl rocket-float">🚀</div>
        </>
      )}

      {theme === "beach" && (
        <>
          <div className="absolute bottom-[21%] left-[2%] text-[90px] sm:text-[130px] scenery-near">🌴</div>
          <div className="absolute bottom-[23%] right-[3%] text-[72px] sm:text-[110px] scenery-mid">🏖️</div>
          <div className="absolute bottom-[18%] inset-x-0 h-10 bg-cyan-400/40 blur-sm" />
        </>
      )}

      {theme === "jungle" && (
        <>
          <div className="absolute bottom-[18%] left-[-30px] text-[130px] sm:text-[180px] scenery-near">🌿</div>
          <div className="absolute bottom-[20%] right-[-30px] text-[120px] sm:text-[170px] scenery-near">🌴</div>
          <div className="absolute bottom-[29%] left-[12%] text-5xl scenery-mid">🦜</div>
        </>
      )}

      {theme === "snow" && (
        <>
          <div className="absolute bottom-[24%] inset-x-0 h-36 bg-white/80 [clip-path:polygon(0_100%,15%_28%,26%_75%,40%_8%,55%_68%,70%_20%,100%_100%)] scenery-far" />
          <div className="absolute bottom-[17%] left-[3%] text-7xl scenery-near">🌲</div>
          <div className="absolute bottom-[18%] right-[4%] text-7xl scenery-near">🌲</div>
        </>
      )}

      {(theme === "city" || theme === "park" || theme === "night") && (
        <>
          <div className="absolute inset-x-0 bottom-[30%] h-36 flex items-end gap-2 skyline-far opacity-75">
            {Array.from({ length: 22 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-t-md border-t border-white/20 ${dark ? "bg-indigo-700/80" : "bg-slate-500/60"}`}
                style={{ width: 42 + (i % 3) * 8, height: 50 + (i % 5) * 22 }}
              >
                <div className="grid grid-cols-2 gap-1 p-2 opacity-70">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <span key={j} className={`h-1.5 rounded-sm ${dark ? "bg-yellow-200" : "bg-cyan-50"}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {theme === "park" && (
            <>
              <div className="absolute bottom-[21%] left-[2%] text-[90px] scenery-near">🌳</div>
              <div className="absolute bottom-[21%] right-[2%] text-[90px] scenery-near">🌳</div>
              <div className="absolute bottom-[22%] left-[16%] text-5xl scenery-mid">🌲</div>
              <div className="absolute bottom-[22%] right-[18%] text-5xl scenery-mid">🌲</div>
            </>
          )}
        </>
      )}

      {theme === "tunnel" && (
        <>
          <div className="absolute left-[4%] top-[16%] bottom-[14%] w-[12%] rounded-t-[60px] bg-slate-900/70 shadow-[inset_-10px_0_30px_rgba(0,0,0,.55)]" />
          <div className="absolute right-[4%] top-[16%] bottom-[14%] w-[12%] rounded-t-[60px] bg-slate-900/70 shadow-[inset_10px_0_30px_rgba(0,0,0,.55)]" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="absolute top-[24%] w-12 h-3 rounded-full bg-amber-200/80 tunnel-light" style={{ left: `${12 + i * 15}%`, animationDelay: `${i * .12}s` }} />
          ))}
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-b from-transparent to-black/15 pointer-events-none" />
    </div>
  );
}

function LaneObstacle({ lane, active, hit }: { lane: number; active: boolean; hit: boolean }) {
  const left = lane === 0 ? "20%" : lane === 1 ? "50%" : "80%";
  return (
    <div
      className={`absolute z-20 obstacle-wrap ${active ? "obstacle-approach" : ""} ${hit ? "obstacle-impact" : ""}`}
      style={{ left }}
    >
      <div className="barrier">
        <div className="barrier-board">
          <div className="barrier-stripe stripe-one" />
          <div className="barrier-stripe stripe-two" />
          <div className="barrier-stripe stripe-three" />
        </div>
        <div className="barrier-leg barrier-leg-left" />
        <div className="barrier-leg barrier-leg-right" />
      </div>
    </div>
  );
}

function TrackCoin({ lane, index }: { lane: number; index: number }) {
  const left = lane === 0 ? "20%" : lane === 1 ? "50%" : "80%";
  return (
    <div
      className="absolute z-10 track-coin"
      style={{
        left,
        animationDelay: `${index * .42}s`,
      }}
    >
      <div className="coin-face">$</div>
    </div>
  );
}

function DwellChoice({
  children,
  onSelect,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  className: string;
}) {
  const timer = useRef<number | null>(null);
  const [dwelling, setDwelling] = useState(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setDwelling(false);
  };

  const start = () => {
    if (disabled) return;
    clear();
    setDwelling(true);
    timer.current = window.setTimeout(() => {
      clear();
      onSelect();
    }, 1050);
  };

  useEffect(() => clear, []);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        clear();
        onSelect();
      }}
      onMouseEnter={start}
      onMouseLeave={clear}
      onFocus={start}
      onBlur={clear}
      className={`answer-lane ${className} ${dwelling ? "is-dwelling" : ""}`}
    >
      {children}
      <span className="dwell-fill" />
    </button>
  );
}

export default function ReadingRunnerPro({
  onBack,
  buddy,
}: {
  onBack: () => void;
  buddy: BuddyConfig;
}) {
  const storageKey = "arise-reading-runner-v3";
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }, []);

  const [screen, setScreen] = useState<"setup" | "map" | "game">("setup");
  const [mode, setMode] = useState<QuestionMode>((saved.mode as QuestionMode) || "mixed");
  const [difficulty, setDifficulty] = useState<Difficulty>((saved.difficulty as Difficulty) || "starter");
  const [level, setLevel] = useState(Math.max(1, Math.min(WORLDS.length, Number(saved.level || 1))));
  const [unlocked, setUnlocked] = useState(Math.max(1, Math.min(WORLDS.length, Number(saved.unlocked || 1))));
  const [coins, setCoins] = useState(Number(saved.coins || 0));
  const [sound, setSound] = useState(saved.sound !== false);
  const [questions, setQuestions] = useState<RunnerQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [playerLane, setPlayerLane] = useState(1);
  const [obstacleLane, setObstacleLane] = useState(1);
  const [action, setAction] = useState<"run" | "jump" | "hit" | "celebrate">("run");
  const [locked, setLocked] = useState(false);
  const [talking, setTalking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [coinBurst, setCoinBurst] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  const currentWorld = WORLDS[level - 1];
  const question = questions[questionIndex];
  const isCelebrating = action === "celebrate";
  const correctLane = question ? Math.max(0, question.choices.indexOf(question.answer)) : 1;

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ mode, difficulty, level, unlocked, coins, sound }),
    );
  }, [mode, difficulty, level, unlocked, coins, sound]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      stopSpeaking();
    };
  }, []);

  const fx = (name: Parameters<typeof playFx>[0]) => {
    if (sound) playFx(name);
  };

  const say = (text: string, calm = false) => {
    if (!buddy.voiceEnabled) return;
    setTalking(true);
    void speakCharacterAI(text, {
      calmMode: calm || !!buddy.calmMode,
      onStart: () => setTalking(true),
      onEnd: () => setTalking(false),
      onFallback: () => setTalking(false),
    });
  };

  const announce = (q: RunnerQuestion) => {
    setFeedback(q.prompt);
    say(q.prompt);
  };

  const startWorld = (worldNumber: number) => {
    if (worldNumber > unlocked) return;
    fx("tap");
    stopSpeaking();
    const nextQuestions = buildQuestionSet(mode, difficulty, worldNumber);
    setQuestions(nextQuestions);
    setLevel(worldNumber);
    setQuestionIndex(0);
    setHearts(3);
    setPlayerLane(1);
    setObstacleLane(1);
    setAction("run");
    setLocked(false);
    setPaused(false);
    setScreen("game");
    window.setTimeout(() => {
      const q = nextQuestions[0];
      if (!q) return;
      setFeedback(q.prompt);
      say(`Level ${worldNumber}. ${WORLDS[worldNumber - 1].name}. ${q.prompt}`);
    }, 300);
  };

  const answer = (choice: string, lane: number) => {
    if (!question || locked || paused || isCelebrating) return;
    fx("tap");
    setLocked(true);
    setPlayerLane(lane);
    setObstacleLane(lane);

    if (choice === question.answer) {
      setAction("jump");
      setFeedback(`YES! ${question.answer}! Jump!`);
      setCoins(value => value + 10);
      setCoinBurst(value => value + 1);
      fx("correct");
      window.setTimeout(() => fx("jump"), 70);
      window.setTimeout(() => fx("coin"), 300);
      say(`Yes! ${question.answer}! Jump!`);

      timeoutRef.current = window.setTimeout(() => {
        const last = questionIndex >= questions.length - 1;
        if (last) {
          const nextUnlocked = Math.min(WORLDS.length, Math.max(unlocked, level + 1));
          setUnlocked(nextUnlocked);
          setAction("celebrate");
          setFeedback(level === WORLDS.length ? "READING CHAMPION!" : "LEVEL COMPLETE!");
          fx("win");
          say(level === WORLDS.length ? "Reading Champion! You finished every world!" : "Level complete! You unlocked the next world!");
          setLocked(false);
          return;
        }

        const nextIndex = questionIndex + 1;
        const nextQuestion = questions[nextIndex];
        setQuestionIndex(nextIndex);
        setObstacleLane((nextIndex + level) % 3);
        setAction("run");
        setLocked(false);
        announce(nextQuestion);
      }, 1150);
      return;
    }

    setAction("hit");
    setHearts(value => Math.max(0, value - 1));
    setFeedback("BUMP! Try another lane.");
    fx("wrong");
    say("Oops! Bump! Try another lane.", true);

    timeoutRef.current = window.setTimeout(() => {
      setAction("run");
      setLocked(false);
      setHearts(value => (value <= 0 ? 3 : value));
    }, 850);
  };

  if (screen === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-violet-100 px-4 py-5 text-slate-900">
        <GameStyles />
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[50px] px-4 rounded-2xl bg-white border border-slate-200 shadow-sm font-black flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" /> Games
            </button>
            <div>
              <div className="text-xs uppercase tracking-[.2em] font-black text-violet-600">Reading Runner</div>
              <h1 className="text-2xl sm:text-3xl font-black">Choose Your Adventure</h1>
            </div>
          </div>

          <div className="setup-hero relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-[#14213d] via-[#274690] to-[#6a4c93] text-white p-6 sm:p-8 shadow-2xl mb-6">
            <div className="absolute inset-0 setup-grid opacity-20" />
            <div className="absolute right-2 sm:right-8 bottom-[-35px] scale-[.82] sm:scale-100 origin-bottom-right">
              <BuddyRunner buddy={buddy} action="run" talking={false} />
            </div>
            <div className="relative max-w-2xl pr-24 sm:pr-48">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 font-black text-xs uppercase tracking-widest">
                <Zap className="w-4 h-4" /> {buddy.name} is your runner
              </div>
              <h2 className="text-3xl sm:text-5xl font-black mt-4 leading-tight">Run. Read. Jump. Win.</h2>
              <p className="mt-3 text-white/85 font-bold text-sm sm:text-lg">
                Pick exactly what you want to practice. Correct answers make {buddy.name} jump obstacles and collect coins.
              </p>
            </div>
          </div>

          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-lg p-5 sm:p-7 mb-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black">What do you want to practice?</h3>
                <p className="text-sm font-semibold text-slate-500">Choose one. You can change it anytime.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {MODE_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    fx("tap");
                    setMode(option.id);
                  }}
                  className={`min-h-[118px] rounded-3xl border-2 p-4 text-left transition-all ${mode === option.id ? "border-violet-500 bg-violet-50 shadow-md -translate-y-1" : "border-slate-200 bg-slate-50 hover:border-violet-300"}`}
                >
                  <div className="text-3xl mb-2">{option.icon}</div>
                  <div className="font-black text-base sm:text-lg">{option.label}</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">{option.description}</div>
                  {mode === option.id && <CheckCircle2 className="w-5 h-5 text-violet-600 absolute" />}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-lg p-5 sm:p-7 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black">Difficulty</h3>
                <p className="text-sm font-semibold text-slate-500">Pick the reading challenge that feels right.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {DIFFICULTY_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    fx("tap");
                    setDifficulty(option.id);
                  }}
                  className={`min-h-[92px] rounded-3xl border-2 p-4 text-left transition-all ${difficulty === option.id ? "border-sky-500 bg-sky-50 shadow-md -translate-y-1" : "border-slate-200 bg-slate-50 hover:border-sky-300"}`}
                >
                  <div className="font-black text-lg">{option.label}</div>
                  <div className="text-sm font-semibold text-slate-500 mt-1">{option.description}</div>
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={() => {
              fx("correct");
              setScreen("map");
            }}
            className="w-full min-h-[72px] rounded-[1.6rem] bg-gradient-to-r from-violet-600 to-sky-500 text-white text-xl sm:text-2xl font-black shadow-xl hover:-translate-y-1 transition-transform"
          >
            Choose a World →
          </button>
        </div>
      </div>
    );
  }

  if (screen === "map") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-violet-100 px-4 py-5 text-slate-900">
        <GameStyles />
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <button
              type="button"
              onClick={() => setScreen("setup")}
              className="min-h-[48px] px-4 rounded-2xl bg-white shadow border border-slate-200 font-black flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" /> Setup
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">Reading Runner</h1>
              <p className="text-sm font-bold text-slate-500">
                {MODE_OPTIONS.find(x => x.id === mode)?.label} · {DIFFICULTY_OPTIONS.find(x => x.id === difficulty)?.label}
              </p>
            </div>
            <div className="ml-auto rounded-2xl bg-amber-100 border border-amber-200 px-4 py-2 font-black text-amber-700">🪙 {coins}</div>
          </div>

          <div className="relative rounded-[2.25rem] overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-violet-700 via-fuchsia-600 to-sky-500 text-white shadow-2xl mb-6 min-h-[210px]">
            <div className="absolute right-2 sm:right-8 bottom-[-40px] scale-[.78] sm:scale-100 origin-bottom-right">
              <BuddyRunner buddy={buddy} action="run" talking={false} />
            </div>
            <div className="relative max-w-xl pr-24 sm:pr-48">
              <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest mb-3">
                {buddy.name}'s Adventure
              </div>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight">Pick a world.</h2>
              <p className="mt-3 text-white/90 font-bold">Each world has five reading challenges and unlocks the next adventure.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {WORLDS.map((world, i) => {
              const worldNumber = i + 1;
              const open = worldNumber <= unlocked;
              return (
                <button
                  key={world.name}
                  type="button"
                  disabled={!open}
                  onClick={() => startWorld(worldNumber)}
                  className={`relative min-h-[165px] rounded-[1.7rem] border-2 p-4 text-left overflow-hidden transition-all ${open ? "bg-white border-white hover:-translate-y-1 hover:shadow-xl" : "bg-slate-100 border-slate-200 opacity-55"}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-300/25 via-violet-300/10 to-amber-200/20" />
                  <div className="relative">
                    <div className="text-xs font-black uppercase tracking-widest text-violet-600">Level {worldNumber}</div>
                    <div className="text-4xl my-3">{world.icon}</div>
                    <div className="font-black text-lg leading-tight">{world.name}</div>
                    <div className="text-xs font-bold text-slate-500 mt-2">5 challenges</div>
                  </div>
                  {!open && <LockKeyhole className="absolute top-4 right-4 w-6 h-6 text-slate-400" />}
                  {open && worldNumber < unlocked && <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-green-500" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const progress = questions.length
    ? ((questionIndex + (isCelebrating ? 1 : 0)) / questions.length) * 100
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <GameStyles />
      <div className="max-w-[1600px] mx-auto">
        <div className="h-16 px-2 sm:px-5 flex items-center gap-2 sm:gap-3 bg-slate-950/95 border-b border-white/10 relative z-[90]">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setScreen("map");
            }}
            className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Map</span>
          </button>

          <div className="hidden md:block min-w-[150px]">
            <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">Level {level}</div>
            <div className="font-black text-sm">{currentWorld.name}</div>
          </div>

          <div className="flex-1 max-w-xl mx-auto">
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lime-400 via-yellow-300 to-amber-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl bg-amber-400/15 px-3 py-2 font-black text-amber-200 whitespace-nowrap">🪙 {coins}</div>
          <div className="hidden sm:flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <Heart key={i} className={`w-5 h-5 ${i < hearts ? "fill-rose-500 text-rose-500" : "text-white/20"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSound(value => !value)}
            className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center"
          >
            {sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setPaused(value => !value)}
            className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center"
          >
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>

        <div className="relative h-[calc(100vh-4rem)] min-h-[690px] overflow-hidden">
          <SceneDecor theme={currentWorld.theme} />

          {!isCelebrating && question && (
            <div className="absolute z-50 top-3 sm:top-5 left-1/2 -translate-x-1/2 w-[min(92%,920px)] pointer-events-none">
              <div className="question-banner rounded-[1.6rem] bg-white/95 backdrop-blur-xl border-2 border-white shadow-2xl px-4 py-3 sm:px-6 sm:py-4 text-slate-900 text-center">
                <div className="text-[9px] sm:text-[11px] uppercase tracking-[.22em] font-black text-violet-600">{question.skill}</div>
                <div className="text-lg sm:text-2xl lg:text-3xl font-black mt-1 leading-tight">{question.prompt}</div>
              </div>
            </div>
          )}

          <div className="absolute inset-x-[3%] sm:inset-x-[12%] top-[16%] bottom-[130px] sm:bottom-[145px] track-perspective overflow-hidden">
            <div className="absolute inset-0 track-surface" />
            <div className="absolute left-1/3 top-0 bottom-0 border-l-[4px] border-dashed border-white/75 lane-marker" />
            <div className="absolute left-2/3 top-0 bottom-0 border-l-[4px] border-dashed border-white/75 lane-marker" />

            {[0, 1, 2, 3].map(i => (
              <TrackCoin key={i} lane={(i + questionIndex + level) % 3} index={i} />
            ))}

            {!isCelebrating && (
              <LaneObstacle lane={obstacleLane} active={locked} hit={action === "hit"} />
            )}

            <div
              className="absolute z-30 bottom-[10%] transition-[left] duration-300"
              style={{
                left: playerLane === 0 ? "20%" : playerLane === 1 ? "50%" : "80%",
                transform: "translateX(-50%)",
              }}
            >
              <BuddyRunner buddy={buddy} action={action} talking={talking} />
              <div className="runner-nameplate">{buddy.name}</div>
            </div>

            <div className="absolute bottom-[7%] left-[12%] right-[12%] h-6 bg-black/20 blur-lg rounded-full" />
          </div>

          {coinBurst > 0 && action === "jump" && (
            <div className="absolute inset-0 z-40 pointer-events-none">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={`${coinBurst}-${i}`}
                  className="coin-pop absolute left-1/2 top-[52%]"
                  style={{ animationDelay: `${i * .04}s` }}
                >
                  <div className="coin-face">$</div>
                </div>
              ))}
            </div>
          )}

          {paused && (
            <div className="absolute inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center">
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="rounded-[2rem] bg-white text-slate-900 px-8 py-6 font-black text-2xl shadow-2xl flex items-center gap-3"
              >
                <Play className="w-8 h-8 fill-current" /> Keep Running
              </button>
            </div>
          )}

          {isCelebrating ? (
            <div className="absolute z-60 inset-x-4 sm:inset-x-[18%] bottom-5">
              <div className="rounded-[2rem] bg-white/95 backdrop-blur-xl border-2 border-white shadow-2xl p-5 text-slate-900 text-center">
                <Sparkles className="w-9 h-9 text-amber-500 mx-auto mb-2" />
                <div className="text-3xl sm:text-4xl font-black">
                  {level === WORLDS.length ? "READING CHAMPION!" : "LEVEL COMPLETE!"}
                </div>
                <div className="mt-2 font-bold text-slate-500">You earned {questions.length * 10} coins.</div>
                <div className="grid sm:grid-cols-2 gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => setScreen("map")}
                    className="min-h-[62px] rounded-2xl bg-violet-600 text-white font-black text-lg"
                  >
                    Back to Map
                  </button>
                  {level < WORLDS.length && (
                    <button
                      type="button"
                      onClick={() => startWorld(level + 1)}
                      className="min-h-[62px] rounded-2xl bg-green-500 text-white font-black text-lg"
                    >
                      Next Level →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : question ? (
            <div className="absolute z-60 inset-x-2 sm:inset-x-[7%] bottom-2 sm:bottom-4">
              <div className="answer-dock rounded-[1.7rem] bg-slate-950/80 backdrop-blur-xl border border-white/15 shadow-2xl p-2 sm:p-3">
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {question.choices.map((choice, lane) => (
                    <DwellChoice
                      key={choice}
                      disabled={locked || paused}
                      onSelect={() => answer(choice, lane)}
                      className={
                        lane === 0
                          ? "from-cyan-50 to-cyan-200 border-cyan-400"
                          : lane === 1
                            ? "from-yellow-50 to-yellow-200 border-yellow-400"
                            : "from-fuchsia-50 to-fuchsia-200 border-fuchsia-400"
                      }
                    >
                      <div className="relative z-10">
                        <div className="text-[9px] sm:text-[11px] uppercase tracking-widest text-slate-500 font-black">Lane {lane + 1}</div>
                        <div className="text-sm sm:text-xl lg:text-2xl text-slate-900 font-black break-words leading-tight mt-1">{choice}</div>
                      </div>
                    </DwellChoice>
                  ))}
                </div>
                <div className={`mt-1.5 text-center text-xs sm:text-sm font-black ${action === "hit" ? "text-amber-300" : action === "jump" ? "text-green-300" : "text-white/70"}`}>
                  {feedback || "Pick a lane. Correct answer = jump!"}
                </div>
              </div>
            </div>
          ) : null}

          <div className="sm:hidden absolute top-[90px] left-3 z-40 flex gap-1">
            {[0, 1, 2].map(i => (
              <Heart key={i} className={`w-5 h-5 ${i < hearts ? "fill-rose-500 text-rose-500" : "text-white/30"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameStyles() {
  return (
    <style>{`
      .setup-grid {
        background-image:
          linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px);
        background-size: 34px 34px;
        transform: perspective(500px) rotateX(58deg) scale(1.4);
        transform-origin: bottom;
      }

      .track-perspective {
        clip-path: polygon(36% 0, 64% 0, 100% 100%, 0 100%);
        perspective: 900px;
        filter: drop-shadow(0 15px 25px rgba(15,23,42,.28));
      }
      .track-surface {
        background:
          linear-gradient(90deg, rgba(0,0,0,.13), transparent 12%, transparent 88%, rgba(0,0,0,.13)),
          linear-gradient(#5b6470, #2c3440);
        position:absolute;
        inset:0;
      }
      .track-surface:after {
        content:"";
        position:absolute;
        inset:0;
        background-image: repeating-linear-gradient(180deg, transparent 0 72px, rgba(255,255,255,.11) 72px 76px, transparent 76px 145px);
        background-size:100% 145px;
        animation:roadFlow .62s linear infinite;
      }
      .lane-marker {
        animation:laneFlow .62s linear infinite;
        opacity:.8;
      }

      .buddy-svg {
        width: 118px;
        height: auto;
        overflow: visible;
        filter: drop-shadow(0 13px 9px rgba(15,23,42,.22));
      }
      .buddy-runner {
        transform-origin:50% 100%;
        position:relative;
      }
      .runner-nameplate {
        margin-top:-9px;
        margin-left:auto;
        margin-right:auto;
        width:max-content;
        max-width:130px;
        border-radius:999px;
        padding:3px 10px;
        background:rgba(255,255,255,.94);
        color:#5b21b6;
        font-size:11px;
        font-weight:900;
        box-shadow:0 5px 15px rgba(15,23,42,.18);
      }

      .runner-run .runner-body { animation:bodyBounce .24s ease-in-out infinite alternate; }
      .runner-run .runner-front-arm { animation:frontArm .36s ease-in-out infinite alternate; }
      .runner-run .runner-back-arm { animation:backArm .36s ease-in-out infinite alternate; }
      .runner-run .runner-front-leg { animation:frontLeg .36s ease-in-out infinite alternate; }
      .runner-run .runner-back-leg { animation:backLeg .36s ease-in-out infinite alternate; }
      .runner-run .runner-shadow { animation:shadowRun .36s ease-in-out infinite alternate; }

      .runner-jump { animation:realJump 1.08s cubic-bezier(.16,.82,.25,1); }
      .runner-jump .runner-front-arm { animation:jumpFrontArm .45s ease-out both; }
      .runner-jump .runner-back-arm { animation:jumpBackArm .45s ease-out both; }
      .runner-jump .runner-front-leg { animation:jumpFrontLeg .58s ease-out both; }
      .runner-jump .runner-back-leg { animation:jumpBackLeg .58s ease-out both; }

      .runner-hit { animation:runnerHit .72s ease-in-out; }
      .runner-celebrate { animation:celebrate .8s ease-in-out infinite alternate; }
      .runner-celebrate .runner-front-arm { animation:celebrateFrontArm .55s ease-in-out infinite alternate; }
      .runner-celebrate .runner-back-arm { animation:celebrateBackArm .55s ease-in-out infinite alternate; }

      .buddy-svg-mouth { transform-origin:center; }
      .buddy-svg-mouth.is-talking { animation:svgMouth .17s ease-in-out infinite alternate; }

      .upload-runner {
        width:118px;
        height:198px;
        position:relative;
        filter:drop-shadow(0 13px 9px rgba(15,23,42,.22));
      }
      .upload-body {
        position:absolute;
        left:19px;
        top:25px;
        width:80px;
        height:102px;
        border-radius:38px 38px 28px 28px;
        background:linear-gradient(145deg,#7c3aed,#2563eb);
        border:5px solid white;
        box-shadow:inset 0 -12px 20px rgba(15,23,42,.18);
      }
      .upload-face {
        position:absolute;
        left:8px;
        top:7px;
        width:54px;
        height:54px;
        border-radius:50%;
        object-fit:cover;
        border:3px solid white;
      }
      .upload-mouth {
        position:absolute;
        left:29px;
        top:66px;
        width:22px;
        height:5px;
        border-radius:999px;
        background:#111827;
      }
      .upload-mouth.is-talking { animation:uploadMouth .17s ease-in-out infinite alternate; }
      .runner-arm {
        position:absolute;
        top:73px;
        width:18px;
        height:72px;
        border-radius:999px;
        background:#6d28d9;
        transform-origin:50% 8px;
      }
      .runner-arm-left { left:14px; }
      .runner-arm-right { right:14px; }
      .runner-leg {
        position:absolute;
        top:116px;
        width:21px;
        height:68px;
        border-radius:999px;
        background:#1d4ed8;
        transform-origin:50% 8px;
      }
      .runner-leg-left { left:36px; }
      .runner-leg-right { right:36px; }
      .runner-shoe {
        position:absolute;
        top:177px;
        width:39px;
        height:17px;
        border-radius:999px;
        background:white;
        border:3px solid #60a5fa;
      }
      .runner-shoe-left { left:25px; }
      .runner-shoe-right { right:25px; }

      .runner-run .runner-arm-left { animation:frontArm .36s ease-in-out infinite alternate; }
      .runner-run .runner-arm-right { animation:backArm .36s ease-in-out infinite alternate; }
      .runner-run .runner-leg-left { animation:frontLeg .36s ease-in-out infinite alternate; }
      .runner-run .runner-leg-right { animation:backLeg .36s ease-in-out infinite alternate; }

      .obstacle-wrap {
        top:34%;
        transform:translateX(-50%) scale(.58);
        opacity:.78;
      }
      .obstacle-approach { animation:obstacleApproach .92s cubic-bezier(.2,.72,.3,1); }
      .obstacle-impact { filter:saturate(1.4) brightness(.95); }
      .barrier { width:110px; height:82px; position:relative; }
      .barrier-board {
        position:absolute;
        left:5px;
        right:5px;
        top:8px;
        height:50px;
        overflow:hidden;
        border-radius:8px;
        background:#f97316;
        border:5px solid #f8fafc;
        box-shadow:0 9px 14px rgba(15,23,42,.28);
      }
      .barrier-stripe {
        position:absolute;
        width:17px;
        height:80px;
        top:-15px;
        background:white;
        transform:rotate(32deg);
      }
      .stripe-one{left:12px}.stripe-two{left:46px}.stripe-three{left:80px}
      .barrier-leg {
        position:absolute;
        bottom:3px;
        width:16px;
        height:33px;
        border-radius:4px;
        background:#334155;
      }
      .barrier-leg-left{left:23px}.barrier-leg-right{right:23px}

      .track-coin {
        top:28%;
        transform:translateX(-50%) scale(.55);
        animation:coinApproach 2s linear infinite;
      }
      .coin-face {
        width:34px;
        height:34px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#92400e;
        font-weight:1000;
        font-size:18px;
        background:radial-gradient(circle at 35% 30%,#fff7ae,#facc15 40%,#d97706 82%);
        border:3px solid #fef08a;
        box-shadow:0 0 18px rgba(250,204,21,.6),inset 0 -4px 5px rgba(146,64,14,.25);
        animation:coinSpin .7s linear infinite;
      }
      .coin-pop { animation:coinPop .9s ease-out forwards; }
      .coin-pop .coin-face { width:42px;height:42px; }

      .answer-dock { max-height:145px; }
      .answer-lane {
        position:relative;
        overflow:hidden;
        min-height:78px;
        border-width:3px;
        border-style:solid;
        border-radius:1.35rem;
        padding:.5rem;
        background-image:linear-gradient(to bottom,var(--tw-gradient-stops));
        transition:transform .15s ease,box-shadow .15s ease;
      }
      .answer-lane:hover:not(:disabled),
      .answer-lane:focus-visible:not(:disabled) {
        transform:translateY(-4px);
        box-shadow:0 11px 24px rgba(15,23,42,.23);
        outline:none;
      }
      .answer-lane.is-dwelling .dwell-fill { animation:dwellProgress 1.05s linear forwards; }
      .dwell-fill {
        position:absolute;
        left:0;
        bottom:0;
        height:6px;
        width:0%;
        background:#7c3aed;
      }

      .cloud {
        position:absolute;
        width:120px;
        height:38px;
        border-radius:999px;
        background:rgba(255,255,255,.82);
        filter:blur(.2px);
      }
      .cloud:before,.cloud:after {
        content:"";
        position:absolute;
        border-radius:999px;
        background:inherit;
      }
      .cloud:before { width:54px;height:54px;left:20px;top:-25px; }
      .cloud:after { width:66px;height:66px;right:13px;top:-35px; }
      .cloud-one { top:55px;left:-180px;animation:cloudMove 18s linear infinite; }
      .cloud-two { top:110px;left:-220px;transform:scale(.8);animation:cloudMove 24s linear 5s infinite; }
      .cloud-three { top:25px;left:-260px;transform:scale(1.12);animation:cloudMove 29s linear 10s infinite; }

      .skyline-far { width:150%; animation:farParallax 18s linear infinite; }
      .scenery-mid { animation:midParallax 10s linear infinite; }
      .scenery-near { animation:nearParallax 6s linear infinite; }
      .rocket-float { animation:rocketFloat 3s ease-in-out infinite; }
      .runner-star { animation:twinkle 1.4s ease-in-out infinite alternate; }
      .tunnel-light { animation:tunnelPulse .85s linear infinite; }

      @keyframes roadFlow {
        from { background-position-y:0; }
        to { background-position-y:145px; }
      }
      @keyframes laneFlow {
        from { transform:translateY(-30px); }
        to { transform:translateY(85px); }
      }
      @keyframes bodyBounce {
        from { transform:translateY(0) rotate(-1deg); }
        to { transform:translateY(-4px) rotate(1deg); }
      }
      @keyframes frontArm {
        from { transform:rotate(-34deg); }
        to { transform:rotate(42deg); }
      }
      @keyframes backArm {
        from { transform:rotate(35deg); }
        to { transform:rotate(-42deg); }
      }
      @keyframes frontLeg {
        from { transform:rotate(-25deg); }
        to { transform:rotate(28deg); }
      }
      @keyframes backLeg {
        from { transform:rotate(26deg); }
        to { transform:rotate(-29deg); }
      }
      @keyframes shadowRun {
        from { transform:scaleX(1);opacity:.6; }
        to { transform:scaleX(.78);opacity:.35; }
      }
      @keyframes realJump {
        0% { transform:translateY(0) scale(1) rotate(0); }
        28% { transform:translateY(-135px) scale(1.04) rotate(-5deg); }
        52% { transform:translateY(-178px) scale(1.06) rotate(1deg); }
        74% { transform:translateY(-110px) scale(1.03) rotate(4deg); }
        100% { transform:translateY(0) scale(1) rotate(0); }
      }
      @keyframes jumpFrontArm { to { transform:rotate(-72deg); } }
      @keyframes jumpBackArm { to { transform:rotate(68deg); } }
      @keyframes jumpFrontLeg { to { transform:rotate(-52deg) translateY(-8px); } }
      @keyframes jumpBackLeg { to { transform:rotate(46deg) translateY(-9px); } }
      @keyframes runnerHit {
        0%,100% { transform:translateX(0) rotate(0); }
        20% { transform:translateX(-19px) rotate(-8deg); }
        43% { transform:translateX(16px) rotate(8deg); }
        67% { transform:translateX(-10px) rotate(-5deg); }
        83% { transform:translateX(7px) rotate(3deg); }
      }
      @keyframes celebrate {
        from { transform:translateY(0) rotate(-2deg) scale(1); }
        to { transform:translateY(-26px) rotate(2deg) scale(1.04); }
      }
      @keyframes celebrateFrontArm { to { transform:rotate(-78deg); } }
      @keyframes celebrateBackArm { to { transform:rotate(76deg); } }
      @keyframes svgMouth {
        from { transform:scaleY(.6); }
        to { transform:scaleY(2.1); }
      }
      @keyframes uploadMouth {
        from { height:5px;transform:scaleX(.8); }
        to { height:14px;transform:scaleX(1.15); }
      }
      @keyframes obstacleApproach {
        0% { top:24%;transform:translateX(-50%) scale(.42);opacity:.5; }
        100% { top:73%;transform:translateX(-50%) scale(1.22);opacity:1; }
      }
      @keyframes coinApproach {
        0% { top:20%;transform:translateX(-50%) scale(.35);opacity:.3; }
        100% { top:86%;transform:translateX(-50%) scale(1.15);opacity:1; }
      }
      @keyframes coinSpin {
        from { transform:rotateY(0); }
        to { transform:rotateY(360deg); }
      }
      @keyframes coinPop {
        0% { transform:translate(-50%,-50%) scale(.25);opacity:1; }
        100% { transform:translate(calc(-50% + 110px),calc(-50% - 170px)) scale(1.2) rotate(360deg);opacity:0; }
      }
      @keyframes dwellProgress { from { width:0%; } to { width:100%; } }
      @keyframes cloudMove { from { left:-260px; } to { left:112%; } }
      @keyframes farParallax { from { transform:translateX(0); } to { transform:translateX(-23%); } }
      @keyframes midParallax { from { transform:translateX(28px); } to { transform:translateX(-28px); } }
      @keyframes nearParallax { from { transform:translateX(42px); } to { transform:translateX(-42px); } }
      @keyframes rocketFloat { 0%,100% { transform:translateY(0) rotate(-10deg); } 50% { transform:translateY(-18px) rotate(-4deg); } }
      @keyframes twinkle { from { opacity:.25;transform:scale(.75); } to { opacity:1;transform:scale(1.35); } }
      @keyframes tunnelPulse { 0% { opacity:.25;transform:scale(.65); } 100% { opacity:1;transform:scale(1.15); } }

      @media (min-width:640px) {
        .buddy-svg { width:145px; }
        .upload-runner { transform:scale(1.15); transform-origin:bottom center; }
        .answer-lane { min-height:92px; padding:.75rem; }
      }

      @media (max-height:760px) {
        .question-banner { padding-top:.45rem!important;padding-bottom:.45rem!important; }
        .answer-dock { max-height:125px; }
        .answer-lane { min-height:68px; }
        .buddy-svg { width:100px; }
      }

      @media (prefers-reduced-motion:reduce) {
        .track-surface:after,
        .lane-marker,
        .runner-run .runner-body,
        .runner-run .runner-front-arm,
        .runner-run .runner-back-arm,
        .runner-run .runner-front-leg,
        .runner-run .runner-back-leg,
        .cloud,
        .skyline-far,
        .scenery-mid,
        .scenery-near,
        .track-coin {
          animation-duration:4s!important;
        }
      }
    `}</style>
  );
}
