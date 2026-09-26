import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Gamepad2, Grid2X2, CircleDot, Type, RotateCcw, Star, Eye, CheckCircle2, Upload, Volume2, VolumeX, X, Zap, Flag, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { speakCharacterAI } from "@/lib/tts";
import ReadingRunnerPro from "@/pages/ReadingRunnerPro";

type GameId = "runner" | "match" | "pop" | "sentence" | null;

type BuddyPreset = "puppy" | "dino" | "robot" | "bunny";
type BuddyConfig = {
  type: "preset" | "upload";
  preset: BuddyPreset;
  name: string;
  imageData: string | null;
  voiceEnabled: boolean;
  calmMode?: boolean;
};

const BUDDY_PRESETS: Record<BuddyPreset, { emoji: string; label: string }> = {
  puppy: { emoji: "🐶", label: "Puppy" },
  dino: { emoji: "🦖", label: "Dino" },
  robot: { emoji: "🤖", label: "Robot" },
  bunny: { emoji: "🐰", label: "Bunny" },
};

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}


function BuddyAvatar({ buddy, size = "large" }: { buddy: BuddyConfig; size?: "small" | "large" }) {
  const box = size === "large" ? "w-36 h-36 sm:w-44 sm:h-44 text-7xl sm:text-8xl" : "w-14 h-14 text-3xl";
  if (buddy.type === "upload" && buddy.imageData) {
    return <img src={buddy.imageData} alt={buddy.name} className={`${box} rounded-2xl object-cover border-2 border-primary/30 bg-card`} />;
  }
  const preset = BUDDY_PRESETS[buddy.preset] || BUDDY_PRESETS.puppy;
  return (
    <div className={`${box} rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center`} aria-label={preset.label}>
      {preset.emoji}
    </div>
  );
}

function BuddyCoach({ buddy, message }: { buddy: BuddyConfig; message: string }) {
  const [talking, setTalking] = useState(false);
  const success = /yes|great|found|complete|match|built|nice reading|pop!/i.test(message);
  const retry = /try|does not|close|different/i.test(message);

  const say = () => {
    if (!buddy.voiceEnabled || !message) return;
    setTalking(true);
    speakCharacterAI(message, {
      calmMode: retry || !!buddy.calmMode,
      onStart: () => setTalking(true),
      onEnd: () => setTalking(false),
      onFallback: () => {
        setTalking(false);
        setBuddyMessage("Natural AI voice is unavailable. Check the server AI voice configuration.");
      },
    });
  };

  useEffect(() => {
    say();
  }, [message, buddy.voiceEnabled]);

  return (
    <div className={`relative overflow-hidden rounded-3xl border-2 p-5 sm:p-6 mb-6 transition-all ${
      success ? "border-green-500/40 bg-green-500/10" : retry ? "border-amber-500/40 bg-amber-500/10" : "border-primary/25 bg-primary/5"
    }`}>
      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-primary/10" />
      <div className="absolute -bottom-12 -left-10 w-32 h-32 rounded-full bg-amber-400/10" />

      <div className="relative flex flex-col sm:flex-row items-center gap-5">
        <button
          type="button"
          onClick={say}
          className={`relative flex-shrink-0 rounded-3xl transition-transform focus:outline-none focus:ring-4 focus:ring-primary/30 ${talking ? "scale-105" : "hover:scale-105"}`}
          aria-label={`Hear ${buddy.name}`}
        >
          <div className={talking ? "animate-bounce" : success ? "animate-pulse" : ""}>
            <BuddyAvatar buddy={buddy} />
          </div>
          <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-black whitespace-nowrap ${
            talking ? "bg-primary text-primary-foreground" : "bg-card border border-border"
          }`}>
            {talking ? "TALKING..." : "TAP TO HEAR"}
          </span>
        </button>

        <div className="min-w-0 flex-1 w-full">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-black uppercase tracking-wide text-primary">{buddy.name} is teaching</p>
            {success && <span className="text-xs font-black text-green-400">★ AWESOME!</span>}
            {retry && <span className="text-xs font-black text-amber-400">YOU'VE GOT THIS</span>}
          </div>

          <div className="relative rounded-3xl sm:rounded-tl-md bg-card border-2 border-border px-5 py-5 text-xl sm:text-2xl font-black leading-snug min-h-[110px] flex items-center">
            {message}
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">👀</span>
            <span>Your turn — gaze or tap a big choice below.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type MatchCard = {
  id: string;
  pair: string;
  kind: "word" | "picture";
  label: string;
  matched?: boolean;
};

const MATCH_SETS: MatchCard[][] = [
  [
    { id: "cat-word", pair: "cat", kind: "word", label: "CAT" },
    { id: "cat-pic", pair: "cat", kind: "picture", label: "🐱" },
    { id: "dog-word", pair: "dog", kind: "word", label: "DOG" },
    { id: "dog-pic", pair: "dog", kind: "picture", label: "🐶" },
    { id: "sun-word", pair: "sun", kind: "word", label: "SUN" },
    { id: "sun-pic", pair: "sun", kind: "picture", label: "☀️" },
  ],
  [
    { id: "book-word", pair: "book", kind: "word", label: "BOOK" },
    { id: "book-pic", pair: "book", kind: "picture", label: "📘" },
    { id: "ball-word", pair: "ball", kind: "word", label: "BALL" },
    { id: "ball-pic", pair: "ball", kind: "picture", label: "⚽" },
    { id: "apple-word", pair: "apple", kind: "word", label: "APPLE" },
    { id: "apple-pic", pair: "apple", kind: "picture", label: "🍎" },
  ],
];

const POP_ROUNDS = [
  { target: "BOOK", choices: ["BOOK", "LOOK", "COOK", "HOOK"] },
  { target: "CAT", choices: ["CAP", "CAT", "CAN", "CAR"] },
  { target: "SUN", choices: ["RUN", "SUN", "FUN", "BUN"] },
  { target: "DOG", choices: ["DOT", "DOG", "LOG", "DIG"] },
  { target: "RED", choices: ["BED", "RED", "RAN", "RID"] },
];

const SENTENCE_ROUNDS = [
  { picture: "🐶", words: ["THE", "DOG", "RUNS"], distractors: ["BLUE", "EATS"] },
  { picture: "🐱", words: ["THE", "CAT", "SLEEPS"], distractors: ["JUMPS", "GREEN"] },
  { picture: "👧📘", words: ["SHE", "READS", "A", "BOOK"], distractors: ["DOG", "FAST"] },
  { picture: "🐦🌳", words: ["THE", "BIRD", "IS", "IN", "THE", "TREE"], distractors: ["CAR", "SAD"] },
];

function useDwellSelect(action: () => void, disabled = false) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (disabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(action, 1100);
  };

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => cancel, []);

  return { onMouseEnter: start, onMouseLeave: cancel, onBlur: cancel };
}

function DwellButton({
  children,
  onSelect,
  disabled = false,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const dwell = useDwellSelect(onSelect, disabled);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label={ariaLabel}
      {...dwell}
      className={`relative min-h-[88px] rounded-2xl border-2 p-4 text-xl font-black transition-all focus:outline-none focus:ring-4 focus:ring-primary/30 disabled:opacity-40 disabled:cursor-default hover:border-primary ${className}`}
    >
      {children}
      {!disabled && (
        <span className="absolute bottom-2 right-3 text-[10px] font-medium text-muted-foreground">gaze or tap</span>
      )}
    </button>
  );
}

function Celebration({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-green-500/30 bg-green-500/10 p-4 text-center" aria-live="polite">
      <Star className="w-8 h-8 text-green-400 mx-auto mb-1 fill-current" />
      <p className="font-black text-lg">{text}</p>
    </div>
  );
}


type RunnerQuestion = {
  prompt: string;
  choices: string[];
  answer: string;
  skill: string;
};

const RUNNER_LEVELS: Array<{ name: string; world: string; speed: number; questions: RunnerQuestion[] }> = [
  {
    name: "City Start",
    world: "🌆",
    speed: 1,
    questions: [
      { prompt: "Jump over the barrier! Find CAT.", choices: ["CAT", "CAN", "CAP"], answer: "CAT", skill: "Word match" },
      { prompt: "Which word says DOG?", choices: ["DIG", "DOG", "DOT"], answer: "DOG", skill: "Word match" },
      { prompt: "Find the word SUN.", choices: ["RUN", "SUN", "FUN"], answer: "SUN", skill: "Word match" },
      { prompt: "Which one starts with B?", choices: ["BALL", "CAT", "SUN"], answer: "BALL", skill: "Beginning sound" },
    ],
  },
  {
    name: "Park Dash",
    world: "🌳",
    speed: 1.05,
    questions: [
      { prompt: "Which picture goes with BOOK?", choices: ["📘", "⚽", "🍎"], answer: "📘", skill: "Picture match" },
      { prompt: "Which picture goes with APPLE?", choices: ["🐶", "🍎", "🚗"], answer: "🍎", skill: "Picture match" },
      { prompt: "Find RED.", choices: ["BED", "RED", "RID"], answer: "RED", skill: "Word discrimination" },
      { prompt: "Which word starts with S?", choices: ["SUN", "DOG", "MAP"], answer: "SUN", skill: "Beginning sound" },
    ],
  },
  {
    name: "Tunnel Rush",
    world: "🚇",
    speed: 1.1,
    questions: [
      { prompt: "Finish it: The dog ___ .", choices: ["RUNS", "BLUE", "BOOK"], answer: "RUNS", skill: "Sentence meaning" },
      { prompt: "Which word means very fast movement?", choices: ["RUN", "SIT", "NAP"], answer: "RUN", skill: "Vocabulary" },
      { prompt: "Which word rhymes with CAT?", choices: ["HAT", "DOG", "SUN"], answer: "HAT", skill: "Rhyming" },
      { prompt: "Which word rhymes with BOOK?", choices: ["LOOK", "BALL", "TREE"], answer: "LOOK", skill: "Rhyming" },
    ],
  },
  {
    name: "Beach Boardwalk",
    world: "🏖️",
    speed: 1.15,
    questions: [
      { prompt: "Which sentence makes sense?", choices: ["I read a book.", "Book the run.", "Blue eats fast."], answer: "I read a book.", skill: "Sentence meaning" },
      { prompt: "Which word names a person?", choices: ["GIRL", "RUN", "RED"], answer: "GIRL", skill: "Nouns" },
      { prompt: "Which word is an action?", choices: ["JUMP", "BALL", "GREEN"], answer: "JUMP", skill: "Verbs" },
      { prompt: "Which sentence matches 🐱💤 ?", choices: ["The cat sleeps.", "The dog runs.", "The bird flies."], answer: "The cat sleeps.", skill: "Picture comprehension" },
    ],
  },
  {
    name: "Boss Bridge",
    world: "🌉",
    speed: 1.2,
    questions: [
      { prompt: "BOSS ROUND: Which word has the /sh/ sound?", choices: ["SHIP", "CAT", "DOG"], answer: "SHIP", skill: "Phonics" },
      { prompt: "BOSS ROUND: What comes first in 'SUN'?", choices: ["S", "U", "N"], answer: "S", skill: "Letter sounds" },
      { prompt: "BOSS ROUND: Which sentence is complete?", choices: ["The dog runs.", "Dog the.", "Runs blue."], answer: "The dog runs.", skill: "Sentences" },
      { prompt: "BOSS ROUND: Which word means happy?", choices: ["GLAD", "SAD", "MAD"], answer: "GLAD", skill: "Vocabulary" },
    ],
  },
  {
    name: "Neon Night",
    world: "🌃",
    speed: 1.25,
    questions: [
      { prompt: "Find the word with 2 syllables.", choices: ["APPLE", "DOG", "SUN"], answer: "APPLE", skill: "Syllables" },
      { prompt: "Which word is a place?", choices: ["SCHOOL", "RUN", "HAPPY"], answer: "SCHOOL", skill: "Vocabulary" },
      { prompt: "Which word means the opposite of HOT?", choices: ["COLD", "BIG", "FAST"], answer: "COLD", skill: "Opposites" },
      { prompt: "Choose the best ending: I wear shoes on my ___.", choices: ["FEET", "BOOK", "MILK"], answer: "FEET", skill: "Context clues" },
    ],
  },
  {
    name: "Space Sprint",
    world: "🚀",
    speed: 1.3,
    questions: [
      { prompt: "Which word means to look at words in a book?", choices: ["READ", "EAT", "SLEEP"], answer: "READ", skill: "Vocabulary" },
      { prompt: "Which one is a question?", choices: ["Where is the dog?", "The dog runs.", "I like books."], answer: "Where is the dog?", skill: "Sentence types" },
      { prompt: "Which word comes alphabetically first?", choices: ["BALL", "CAT", "DOG"], answer: "BALL", skill: "Alphabetical order" },
      { prompt: "Which word has the long A sound?", choices: ["CAKE", "CAT", "CAN"], answer: "CAKE", skill: "Phonics" },
    ],
  },
  {
    name: "Jungle Run",
    world: "🌴",
    speed: 1.35,
    questions: [
      { prompt: "Which sentence tells who did something?", choices: ["The boy jumped.", "Jumped fast.", "Very green."], answer: "The boy jumped.", skill: "Sentence structure" },
      { prompt: "Which word describes the dog?", choices: ["BIG", "RUN", "DOG"], answer: "BIG", skill: "Adjectives" },
      { prompt: "Which word has 3 letters?", choices: ["CAT", "BOOK", "APPLE"], answer: "CAT", skill: "Word length" },
      { prompt: "Which word rhymes with TREE?", choices: ["BEE", "CAT", "BOOK"], answer: "BEE", skill: "Rhyming" },
    ],
  },
  {
    name: "Skyline Challenge",
    world: "🏙️",
    speed: 1.4,
    questions: [
      { prompt: "Read: Mia has a red ball. What color is the ball?", choices: ["RED", "BLUE", "GREEN"], answer: "RED", skill: "Comprehension" },
      { prompt: "Read: Sam ran home. What did Sam do?", choices: ["RAN", "SLEPT", "ATE"], answer: "RAN", skill: "Comprehension" },
      { prompt: "Read: The bird is in the tree. Where is the bird?", choices: ["TREE", "CAR", "HOUSE"], answer: "TREE", skill: "Comprehension" },
      { prompt: "Which word best completes: She ___ a book.", choices: ["READS", "BLUE", "DOG"], answer: "READS", skill: "Grammar" },
    ],
  },
  {
    name: "Reading Champion",
    world: "🏆",
    speed: 1.45,
    questions: [
      { prompt: "FINAL: Which is the best title for a story about a dog at the park?", choices: ["Dog's Park Day", "How to Bake", "Space Rockets"], answer: "Dog's Park Day", skill: "Main idea" },
      { prompt: "FINAL: Which detail tells where a story happens?", choices: ["SETTING", "CHARACTER", "TITLE"], answer: "SETTING", skill: "Story elements" },
      { prompt: "FINAL: Who is a story about?", choices: ["CHARACTER", "SETTING", "PAGE"], answer: "CHARACTER", skill: "Story elements" },
      { prompt: "FINAL: What happens in a story?", choices: ["PLOT", "COLOR", "AUTHOR NAME"], answer: "PLOT", skill: "Story elements" },
    ],
  },
];

function RunnerBuddy({ buddy, talking, pointing }: { buddy: BuddyConfig; talking: boolean; pointing: boolean }) {
  const face = buddy.type === "upload" && buddy.imageData
    ? <img src={buddy.imageData} alt={buddy.name} className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg" />
    : <div className="w-16 h-16 rounded-full bg-white/95 shadow-lg border-4 border-white flex items-center justify-center text-4xl">{BUDDY_PRESETS[buddy.preset]?.emoji || "🐶"}</div>;

  return (
    <div className={`relative transition-all duration-500 ${pointing ? "translate-x-[-8px]" : ""}`}>
      <div className={talking ? "animate-[buddyBob_.35s_ease-in-out_infinite_alternate]" : "animate-[buddyFloat_2s_ease-in-out_infinite]"}>{face}</div>
      <div className={`absolute left-1/2 -translate-x-1/2 bottom-1 w-5 h-2 rounded-full bg-slate-900/70 transition-transform ${talking ? "scale-y-125 animate-pulse" : "scale-y-50"}`} />
      {pointing && (
        <div className="absolute -left-12 top-8 flex items-center">
          <div className="w-10 h-2 rounded-full bg-amber-300 rotate-[-12deg] origin-right shadow" />
          <div className="text-2xl -ml-1">👉</div>
        </div>
      )}
    </div>
  );
}

function ReadingRunner({ onBack, buddy }: { onBack: () => void; buddy: BuddyConfig }) {
  const { user } = useAuth();
  const storageKey = `arise-reading-runner-${user?.id || "student"}`;
  const [level, setLevel] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return Math.max(1, Math.min(10, Number(saved.level || 1)));
    } catch { return 1; }
  });
  const [unlockedLevel, setUnlockedLevel] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return Math.max(1, Math.min(10, Number(saved.unlockedLevel || 1)));
    } catch { return 1; }
  });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [coins, setCoins] = useState(() => {
    try { return Number(JSON.parse(localStorage.getItem(storageKey) || "{}").coins || 0); } catch { return 0; }
  });
  const [hearts, setHearts] = useState(3);
  const [runState, setRunState] = useState<"running" | "jump" | "hit" | "finish">("running");
  const [feedback, setFeedback] = useState("Ready? Read the sign and pick the right lane!");
  const [talking, setTalking] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showMap, setShowMap] = useState(true);

  const currentLevel = RUNNER_LEVELS[level - 1];
  const current = currentLevel.questions[questionIndex];

  const speakBuddy = (text: string, calm = false) => {
    if (!buddy.voiceEnabled) return;
    setTalking(true);
    void speakCharacterAI(text, {
      calmMode: calm || !!buddy.calmMode,
      onStart: () => setTalking(true),
      onEnd: () => setTalking(false),
      onFallback: () => setTalking(false),
    });
  };

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ level, unlockedLevel, coins }));
  }, [storageKey, level, unlockedLevel, coins]);

  useEffect(() => {
    if (!showMap) {
      const intro = `Level ${level}. ${currentLevel.name}. ${current.prompt}`;
      setFeedback(current.prompt);
      speakBuddy(intro);
    }
  }, [level, showMap]);

  const startLevel = (nextLevel: number) => {
    if (nextLevel > unlockedLevel) return;
    setLevel(nextLevel);
    setQuestionIndex(0);
    setHearts(3);
    setRunState("running");
    setLocked(false);
    setShowMap(false);
  };

  const choose = (choice: string) => {
    if (locked || runState === "finish") return;
    setLocked(true);

    if (choice === current.answer) {
      setRunState("jump");
      setCoins(v => v + 10);
      setFeedback(`YES! Jump! You got ${current.answer}!`);
      speakBuddy(`Yes! ${current.answer}! Jump!`);

      setTimeout(() => {
        const isLast = questionIndex >= currentLevel.questions.length - 1;
        if (isLast) {
          const nextUnlock = Math.min(10, Math.max(unlockedLevel, level + 1));
          setUnlockedLevel(nextUnlock);
          setRunState("finish");
          setFeedback(level === 10 ? "CHAMPION! You finished every Reading Runner world!" : `LEVEL ${level} COMPLETE! You unlocked the next world!`);
          speakBuddy(level === 10 ? "Reading Champion! You did it!" : "Level complete! You unlocked the next world!");
          setLocked(false);
        } else {
          setQuestionIndex(i => i + 1);
          setRunState("running");
          setFeedback(currentLevel.questions[questionIndex + 1].prompt);
          setLocked(false);
          speakBuddy(currentLevel.questions[questionIndex + 1].prompt);
        }
      }, 900);
    } else {
      setRunState("hit");
      setHearts(h => Math.max(0, h - 1));
      setFeedback("BUMP! Try another lane. Your runner is okay!");
      speakBuddy("Oops! Bump! Try another lane.", true);
      setTimeout(() => {
        setRunState("running");
        setLocked(false);
      }, 700);
    }
  };

  if (showMap) {
    return (
      <GameShell title="Reading Runner" subtitle="Run through 10 reading worlds. Answer correctly to jump obstacles and earn coins." onBack={onBack}>
        <style>{`
          @keyframes buddyFloat { from { transform: translateY(0) } 50% { transform: translateY(-8px) } to { transform: translateY(0) } }
          @keyframes buddyBob { from { transform: translateY(0) rotate(-2deg) } to { transform: translateY(-5px) rotate(2deg) } }
        `}</style>
        <div className="rounded-[2rem] overflow-hidden border-2 border-sky-200 bg-gradient-to-br from-sky-100 via-violet-100 to-amber-100 p-5 sm:p-7 mb-6">
          <div className="flex items-center gap-4">
            <RunnerBuddy buddy={buddy} talking={false} pointing={false} />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-violet-600">Adventure Map</p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Reading Runner</h2>
              <p className="font-bold text-slate-600 mt-1">⭐ {coins} coins · Level {unlockedLevel} unlocked</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {RUNNER_LEVELS.map((item, i) => {
            const n = i + 1;
            const unlocked = n <= unlockedLevel;
            return (
              <button
                key={n}
                type="button"
                onClick={() => startLevel(n)}
                disabled={!unlocked}
                className={`relative min-h-[150px] rounded-3xl border-2 p-4 text-center transition-all ${unlocked ? "bg-white border-violet-200 hover:-translate-y-1 hover:shadow-lg" : "bg-slate-100 border-slate-200 opacity-60"}`}
              >
                <div className="text-5xl mb-2">{item.world}</div>
                <div className="text-xs font-black uppercase tracking-widest text-violet-600">Level {n}</div>
                <div className="font-black text-slate-900 mt-1">{item.name}</div>
                {!unlocked && <LockKeyhole className="w-5 h-5 absolute top-3 right-3 text-slate-400" />}
                {unlocked && n < unlockedLevel && <CheckCircle2 className="w-5 h-5 absolute top-3 right-3 text-green-500" />}
              </button>
            );
          })}
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell title={`Reading Runner · Level ${level}`} subtitle={currentLevel.name} onBack={() => setShowMap(true)}>
      <style>{`
        @keyframes roadMove { from { background-position-y: 0 } to { background-position-y: 120px } }
        @keyframes skylineMove { from { transform: translateX(0) } to { transform: translateX(-80px) } }
        @keyframes runnerBounce { from { transform: translateY(0) scaleY(1) } to { transform: translateY(-5px) scaleY(.97) } }
        @keyframes runnerJump { 0% { transform: translateY(0) rotate(0deg) } 45% { transform: translateY(-95px) rotate(-8deg) } 100% { transform: translateY(0) rotate(0deg) } }
        @keyframes runnerHit { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-10px) rotate(-7deg) } 75% { transform: translateX(10px) rotate(7deg) } }
        @keyframes obstacleRush { from { transform: translateY(-10px) scale(.45); opacity:.45 } to { transform: translateY(180px) scale(1.15); opacity:1 } }
        @keyframes coinSpin { from { transform: rotateY(0deg) } to { transform: rotateY(360deg) } }
        @keyframes buddyFloat { from { transform: translateY(0) } 50% { transform: translateY(-8px) } to { transform: translateY(0) } }
        @keyframes buddyBob { from { transform: translateY(0) rotate(-2deg) } to { transform: translateY(-5px) rotate(2deg) } }
      `}</style>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 h-4 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500" style={{ width: `${((questionIndex + (runState === "finish" ? 1 : 0)) / currentLevel.questions.length) * 100}%` }} />
        </div>
        <div className="font-black text-slate-700 whitespace-nowrap">{questionIndex + 1}/{currentLevel.questions.length}</div>
      </div>

      <div className="relative rounded-[2rem] overflow-hidden border-4 border-sky-200 shadow-xl bg-gradient-to-b from-sky-300 via-sky-100 to-slate-200 min-h-[520px]">
        <div className="absolute inset-x-0 top-0 h-36 overflow-hidden">
          <div className="absolute inset-0 flex items-end gap-4 opacity-75 animate-[skylineMove_4s_linear_infinite]">
            {Array.from({length: 14}).map((_, i) => (
              <div key={i} className="w-14 rounded-t-lg bg-slate-500/60" style={{height: `${50 + (i % 4) * 20}px`}} />
            ))}
          </div>
        </div>

        <div className="absolute top-4 left-4 z-20 flex gap-2">
          <div className="rounded-2xl bg-white/90 px-3 py-2 font-black shadow">🪙 {coins}</div>
          <div className="rounded-2xl bg-white/90 px-3 py-2 font-black shadow">{Array.from({length: 3}).map((_, i) => <span key={i} className={i < hearts ? "" : "opacity-20"}>❤️</span>)}</div>
        </div>

        <div className="absolute top-4 right-5 z-20">
          <RunnerBuddy buddy={buddy} talking={talking} pointing={runState === "running"} />
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 top-24 w-[74%] h-[420px] bg-slate-700 [clip-path:polygon(32%_0,68%_0,100%_100%,0_100%)] overflow-hidden">
          <div className="absolute inset-0 opacity-60" style={{
            backgroundImage: "linear-gradient(to bottom, transparent 0 40px, rgba(255,255,255,.85) 40px 70px, transparent 70px 120px)",
            backgroundSize: "100% 120px",
            animation: `roadMove ${Math.max(.45, 1 / currentLevel.speed)}s linear infinite`
          }} />

          <div className="absolute left-1/3 top-0 bottom-0 border-l-4 border-dashed border-white/60" />
          <div className="absolute left-2/3 top-0 bottom-0 border-l-4 border-dashed border-white/60" />

          {runState !== "finish" && (
            <div className="absolute left-1/2 -translate-x-1/2 top-16 animate-[obstacleRush_1.25s_linear_infinite]">
              <div className="w-24 h-12 bg-orange-500 border-4 border-white rounded-lg shadow-xl flex items-center justify-center text-2xl">🚧</div>
            </div>
          )}

          <div className={`absolute left-1/2 -translate-x-1/2 bottom-16 transition-all ${runState === "jump" ? "animate-[runnerJump_.8s_ease-out]" : runState === "hit" ? "animate-[runnerHit_.5s_ease-in-out]" : "animate-[runnerBounce_.28s_ease-in-out_infinite_alternate]"}`}>
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-violet-500 border-4 border-white shadow-xl flex items-center justify-center text-4xl">🏃</div>
              <div className="absolute -right-4 top-0 text-2xl animate-[coinSpin_1s_linear_infinite]">{runState === "jump" ? "⚡" : ""}</div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-3 bottom-3 z-30">
          <div className="rounded-3xl bg-white/95 backdrop-blur p-4 shadow-2xl border-2 border-white">
            <div className="text-center mb-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-violet-600">{current.skill}</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{runState === "finish" ? feedback : current.prompt}</div>
            </div>

            {runState === "finish" ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <button onClick={() => setShowMap(true)} className="min-h-[64px] rounded-2xl bg-violet-600 text-white font-black text-lg">Back to Map</button>
                {level < 10 && (
                  <button onClick={() => startLevel(Math.min(10, level + 1))} className="min-h-[64px] rounded-2xl bg-green-500 text-white font-black text-lg">Next Level →</button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {current.choices.map((choice, i) => (
                  <DwellButton
                    key={choice}
                    onSelect={() => choose(choice)}
                    disabled={locked}
                    ariaLabel={`Lane ${i + 1}: ${choice}`}
                    className={`min-h-[92px] sm:min-h-[105px] p-2 sm:p-3 text-base sm:text-xl bg-gradient-to-b ${i === 0 ? "from-rose-50 to-rose-100 border-rose-300" : i === 1 ? "from-sky-50 to-sky-100 border-sky-300" : "from-amber-50 to-amber-100 border-amber-300"} text-slate-900`}
                  >
                    <div className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Lane {i + 1}</div>
                    <div className="font-black break-words">{choice}</div>
                  </DwellButton>
                ))}
              </div>
            )}

            <div className={`mt-3 text-center font-black text-sm ${runState === "hit" ? "text-amber-600" : runState === "jump" ? "text-green-600" : "text-slate-600"}`}>
              {feedback}
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  );
}

function MatchPairs({ onBack, buddy }: { onBack: () => void; buddy: BuddyConfig }) {
  const [setIndex, setSetIndex] = useState(0);
  const [cards, setCards] = useState(() => MATCH_SETS[0].map(c => ({ ...c })));
  const [first, setFirst] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("Hi! Let's play Match Pairs. First, choose any word or picture.");

  const selectCard = (id: string) => {
    if (locked) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.matched) return;

    if (!first) {
      setFirst(id);
      setMessage(`Great choice! Now find the picture or word that matches ${card.label}.`);
      return;
    }

    if (first === id) return;

    const firstCard = cards.find(c => c.id === first);
    if (!firstCard) return;

    setLocked(true);
    if (firstCard.pair === card.pair && firstCard.kind !== card.kind) {
      setCards(prev => prev.map(c => c.id === first || c.id === id ? { ...c, matched: true } : c));
      setMessage("Yes! Those match. Nice reading! Pick another card.");
      setFirst(null);
      setLocked(false);
    } else {
      setMessage("Good try. Those do not match yet. Choose a different card.");
      setTimeout(() => {
        setFirst(null);
        setLocked(false);
      }, 700);
    }
  };

  const complete = cards.every(c => c.matched);

  const nextSet = () => {
    const next = (setIndex + 1) % MATCH_SETS.length;
    setSetIndex(next);
    setCards(MATCH_SETS[next].map(c => ({ ...c })));
    setFirst(null);
    setMessage("New set! Choose a word or picture, then find its match.");
  };

  return (
    <GameShell title="Match Pairs" subtitle="Match each word with its picture." onBack={onBack}>
      <BuddyCoach buddy={buddy} message={message} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(card => {
          const selected = first === card.id;
          return (
            <DwellButton
              key={card.id}
              onSelect={() => selectCard(card.id)}
              disabled={!!card.matched || locked}
              className={`${card.matched ? "bg-green-500/15 border-green-500/40" : selected ? "bg-primary/15 border-primary" : "bg-card border-border"}`}
              ariaLabel={card.kind === "picture" ? `Picture for ${card.pair}` : card.label}
            >
              <div className={card.kind === "picture" ? "text-5xl" : "text-2xl tracking-wide"}>
                {card.matched ? <CheckCircle2 className="w-10 h-10 mx-auto text-green-400" /> : card.label}
              </div>
            </DwellButton>
          );
        })}
      </div>

      {complete && (
        <div className="mt-5 space-y-3">
          <Celebration text="You matched them all!" />
          <Button className="w-full h-14 text-lg" onClick={nextSet}>Play Another Set</Button>
        </div>
      )}
    </GameShell>
  );
}

function WordPop({ onBack, buddy }: { onBack: () => void; buddy: BuddyConfig }) {
  const [round, setRound] = useState(0);
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState("Look at the big word. Then find the exact same word in one of the bubbles.");
  const [locked, setLocked] = useState(false);

  const current = POP_ROUNDS[round];

  const choose = (word: string) => {
    if (locked) return;
    if (word === current.target) {
      setLocked(true);
      setStars(s => s + 1);
      setFeedback(`POP! You found ${current.target}! Great job!`);
      setTimeout(() => {
        setRound(r => (r + 1) % POP_ROUNDS.length);
        setFeedback("Here is a new word. Look carefully, then find the exact match.");
        setLocked(false);
      }, 850);
    } else {
      setFeedback("That one looks close. Look at the big word again and try another bubble.");
    }
  };

  return (
    <GameShell title="Word Pop" subtitle="Find the target word and pop it." onBack={onBack}>
      <BuddyCoach buddy={buddy} message={feedback} />
      <div className="rounded-2xl border border-border bg-card p-5 text-center mb-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Find this word</p>
        <div className="text-4xl sm:text-5xl font-black mt-2 tracking-wider">{current.target}</div>
        <div className="flex justify-center gap-1 mt-3">
          {Array.from({ length: Math.min(stars, 10) }).map((_, i) => <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {current.choices.map(word => (
          <DwellButton
            key={word}
            onSelect={() => choose(word)}
            disabled={locked}
            className="rounded-full min-h-[125px] bg-card border-border text-2xl sm:text-3xl"
          >
            {word}
          </DwellButton>
        ))}
      </div>


    </GameShell>
  );
}

function SentenceBuilder({ onBack, buddy }: { onBack: () => void; buddy: BuddyConfig }) {
  const [round, setRound] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const [message, setMessage] = useState("Look at the picture. We are going to build a sentence one word at a time. Choose the first word.");
  const current = SENTENCE_ROUNDS[round];

  const bank = [...current.words, ...current.distractors];

  const chooseWord = (word: string) => {
    const nextIndex = built.length;
    if (nextIndex >= current.words.length) return;

    if (word === current.words[nextIndex]) {
      const next = [...built, word];
      setBuilt(next);
      setMessage(next.length === current.words.length ? "You built the whole sentence! Read it with me." : `Yes! ${word} goes there. Now choose the next word.`);
    } else {
      setMessage("Good try. That word comes later or does not belong here. Choose another word.");
    }
  };

  const reset = () => {
    setBuilt([]);
    setMessage("Look at the picture. Choose the first word to start the sentence.");
  };

  const next = () => {
    setRound(r => (r + 1) % SENTENCE_ROUNDS.length);
    setBuilt([]);
    setMessage("Look at the picture. Choose the first word to start the sentence.");
  };

  const complete = built.length === current.words.length;

  return (
    <GameShell title="Sentence Builder" subtitle="Choose words in order to build a sentence." onBack={onBack}>
      <BuddyCoach buddy={buddy} message={message} />
      <div className="text-center mb-4">
        <div className="text-6xl mb-3" aria-label="Picture clue">{current.picture}</div>

      </div>

      <div className="min-h-[90px] rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 mb-5 flex flex-wrap items-center justify-center gap-2">
        {built.length === 0 ? (
          <span className="text-sm text-muted-foreground">Your sentence will appear here</span>
        ) : (
          built.map((word, i) => (
            <span key={i} className="px-4 py-3 rounded-xl bg-card border border-border text-xl font-black">{word}</span>
          ))
        )}
      </div>

      {!complete && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {bank.map((word, i) => (
            <DwellButton key={`${word}-${i}`} onSelect={() => chooseWord(word)} className="bg-card border-border">
              {word}
            </DwellButton>
          ))}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        {!complete && (
          <Button variant="outline" className="h-12 flex-1" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" /> Start Over
          </Button>
        )}
        {complete && (
          <>
            <div className="flex-1"><Celebration text="You built the sentence!" /></div>
            <Button className="h-auto px-6" onClick={next}>Next Sentence</Button>
          </>
        )}
      </div>
    </GameShell>
  );
}

function GameShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Games</Button>
        <div>
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function EyeGazeGames() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [game, setGame] = useState<GameId>(null);
  const [showBuddySetup, setShowBuddySetup] = useState(false);
  const [buddy, setBuddy] = useState<BuddyConfig>({ type: "preset", preset: "puppy", name: "Buddy", imageData: null, voiceEnabled: true, calmMode: false });
  const [buddyDraft, setBuddyDraft] = useState<BuddyConfig>({ type: "preset", preset: "puppy", name: "Buddy", imageData: null, voiceEnabled: true, calmMode: false });
  const [savingBuddy, setSavingBuddy] = useState(false);
  const [buddyMessage, setBuddyMessage] = useState("");

  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    fetch(`${API_BASE}/api/eye-gaze/learning-buddy`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: "no-store",
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setBuddy(data);
        setBuddyDraft(data);
      })
      .catch(() => {});
  }, [token]);

  const saveBuddy = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    setSavingBuddy(true);
    setBuddyMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/learning-buddy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(buddyDraft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save buddy.");
      setBuddy(data);
      setBuddyDraft(data);
      setBuddyMessage("Learning Buddy saved!");
      setShowBuddySetup(false);
      if (data.voiceEnabled) {
        speakCharacterAI(`Hi! I'm ${data.name}. Let's learn together!`, {
          calmMode: !!data.calmMode,
          onFallback: () => setBuddyMessage("Natural AI voice is unavailable. Check the server AI voice configuration."),
        });
      }
    } catch (e: any) {
      setBuddyMessage(e.message || "Could not save buddy.");
    } finally {
      setSavingBuddy(false);
    }
  };

  const handleBuddyUpload = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBuddyMessage("Please choose an image file.");
      return;
    }
    if (file.size > 1_500_000) {
      setBuddyMessage("Please choose a picture under 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBuddyDraft(prev => ({ ...prev, type: "upload", imageData: String(reader.result || "") }));
      setBuddyMessage("");
    };
    reader.readAsDataURL(file);
  };

  if (game === "runner") return <ReadingRunnerPro onBack={() => setGame(null)} buddy={buddy} />;
  if (game === "match") return <MatchPairs onBack={() => setGame(null)} buddy={buddy} />;
  if (game === "pop") return <WordPop onBack={() => setGame(null)} buddy={buddy} />;
  if (game === "sentence") return <SentenceBuilder onBack={() => setGame(null)} buddy={buddy} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Library
          </Button>
          <div className="flex-1">
            <h1 className="font-black text-lg flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" /> Eye Gaze Reading Games
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Real games built for large gaze targets. No quiz required.</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <BuddyAvatar buddy={buddy} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-primary">My Learning Buddy</p>
                <h2 className="text-xl font-black">{buddy.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">Your buddy teaches the games, gives directions, and helps you after each choice.</p>
              </div>
              <Button className="h-12" onClick={() => { setBuddyDraft(buddy); setShowBuddySetup(true); }}>
                Choose / Upload Buddy
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-6 flex items-start gap-3">
          <Eye className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Eye-gaze friendly</p>
            <p className="text-sm text-muted-foreground">Every game can be played by tapping or by holding the pointer over a large choice for about one second.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/arise-city")}
          className="relative overflow-hidden w-full rounded-[2.2rem] border-2 border-cyan-300/50 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 sm:p-8 text-left text-white shadow-2xl hover:-translate-y-1 transition-all mb-5 min-h-[280px]"
        >
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }} />
          <div className="absolute right-4 bottom-[-18px] text-[130px] sm:text-[175px] opacity-75">🏙️</div>
          <div className="absolute right-8 top-6 flex gap-2 text-3xl">
            <span>💼</span><span>🚙</span><span>🏡</span>
          </div>
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 border border-cyan-200/20 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4 text-cyan-200">
              <Sparkles className="w-4 h-4" /> FLAGSHIP GAME
            </div>
            <h2 className="text-3xl sm:text-5xl font-black leading-none">A.R.I.S.E. City</h2>
            <p className="mt-4 text-white/85 text-base sm:text-lg font-bold max-w-xl">
              Choose a career, explore a living city, interview for jobs, work shifts, earn money, shop, buy a car and build toward your first home.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-cyan-300 text-slate-950 px-5 py-3 font-black">
              Enter the City →
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setGame("runner")}
          className="relative overflow-hidden w-full rounded-[2rem] border-2 border-violet-300 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 p-6 sm:p-8 text-left text-white shadow-xl hover:-translate-y-1 transition-all mb-5 min-h-[240px]"
        >
          <div className="absolute -right-8 -bottom-10 text-[150px] opacity-20 rotate-[-8deg]">🏃</div>
          <div className="absolute right-8 top-5 flex gap-3 text-4xl">
            <span className="animate-bounce">🪙</span><span>🚧</span><span>⚡</span>
          </div>
          <div className="relative max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
              <Zap className="w-4 h-4" /> NEW · 10 LEVELS
            </div>
            <h2 className="text-3xl sm:text-4xl font-black">Reading Runner</h2>
            <p className="mt-3 text-white/90 text-base sm:text-lg font-bold">Run through cities, tunnels, beaches, space and more. Pick the right lane to jump obstacles, grab coins and unlock the next world.</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white text-violet-700 px-5 py-3 font-black">
              <Flag className="w-5 h-5" /> Start Adventure
            </div>
          </div>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setGame("match")}
            className="rounded-2xl border-2 border-purple-500/30 bg-card p-6 text-left hover:border-purple-400 transition-colors min-h-[230px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
              <Grid2X2 className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-xl font-black">Match Pairs</h2>
            <p className="text-sm text-muted-foreground mt-2">Match words like CAT, DOG, and BOOK with their pictures.</p>
            <p className="text-xs font-bold text-purple-400 mt-4">Matching · word recognition</p>
          </button>

          <button
            type="button"
            onClick={() => setGame("pop")}
            className="rounded-2xl border-2 border-blue-500/30 bg-card p-6 text-left hover:border-blue-400 transition-colors min-h-[230px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
              <CircleDot className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-black">Word Pop</h2>
            <p className="text-sm text-muted-foreground mt-2">Find the matching word from four big bubbles and pop it.</p>
            <p className="text-xs font-bold text-blue-400 mt-4">Sight words · discrimination</p>
          </button>

          <button
            type="button"
            onClick={() => setGame("sentence")}
            className="rounded-2xl border-2 border-green-500/30 bg-card p-6 text-left hover:border-green-400 transition-colors min-h-[230px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
              <Type className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-black">Sentence Builder</h2>
            <p className="text-sm text-muted-foreground mt-2">Use a picture clue and choose word tiles to build a sentence.</p>
            <p className="text-xs font-bold text-green-400 mt-4">Sentence order · comprehension</p>
          </button>
        </div>
      </main>

      {showBuddySetup && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <Card className="w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Choose Your Learning Buddy</h2>
                  <p className="text-sm text-muted-foreground mt-1">Pick a buddy or upload a favorite picture. This buddy will teach the reading games.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowBuddySetup(false)}><X className="w-5 h-5" /></Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(Object.keys(BUDDY_PRESETS) as BuddyPreset[]).map(key => {
                  const item = BUDDY_PRESETS[key];
                  const selected = buddyDraft.type === "preset" && buddyDraft.preset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBuddyDraft(prev => ({ ...prev, type: "preset", preset: key, imageData: null, name: prev.name === "Buddy" ? item.label : prev.name }))}
                      className={`rounded-2xl border-2 p-4 text-center min-h-[135px] ${selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                    >
                      <div className="text-5xl">{item.emoji}</div>
                      <div className="font-black mt-2">{item.label}</div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border-2 border-dashed border-border p-5">
                <label className="block font-black mb-2">Or upload a favorite picture</label>
                <p className="text-xs text-muted-foreground mb-3">PNG, JPG, or WEBP under 1.5 MB. The picture stays attached to this student's Learning Buddy setting.</p>
                <label className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-muted cursor-pointer font-bold">
                  <Upload className="w-4 h-4" /> Choose Picture
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleBuddyUpload(e.target.files?.[0])} />
                </label>
                {buddyDraft.type === "upload" && buddyDraft.imageData && (
                  <div className="mt-4 flex items-center gap-3">
                    <BuddyAvatar buddy={buddyDraft} />
                    <span className="text-sm font-semibold">Uploaded picture selected</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">What should your buddy be called?</label>
                <input
                  value={buddyDraft.name}
                  maxLength={30}
                  onChange={(e) => setBuddyDraft(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-12 rounded-xl bg-background border border-border px-4 text-base"
                  placeholder="Buddy"
                />
              </div>

              <button
                type="button"
                onClick={() => setBuddyDraft(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }))}
                className="w-full rounded-xl border border-border p-4 flex items-center justify-between gap-3"
              >
                <span className="font-bold flex items-center gap-2">
                  {buddyDraft.voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  Buddy Voice <span className="text-[10px] font-medium text-muted-foreground ml-1">(AI-generated)</span>
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-black ${buddyDraft.voiceEnabled ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {buddyDraft.voiceEnabled ? "ON" : "OFF"}
                </span>
              </button>

              {buddyMessage && <p className="text-sm font-semibold">{buddyMessage}</p>}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setShowBuddySetup(false)}>Cancel</Button>
                <Button className="flex-1 h-12" onClick={saveBuddy} disabled={savingBuddy || !buddyDraft.name.trim()}>
                  {savingBuddy ? "Saving..." : "Use This Buddy"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
