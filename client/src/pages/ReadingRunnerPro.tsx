import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Flag, Heart, LockKeyhole, Pause, Play, RotateCcw, Star, Volume2, VolumeX, Zap } from "lucide-react";
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

type RunnerQuestion = {
  prompt: string;
  choices: string[];
  answer: string;
  skill: string;
};

type RunnerLevel = {
  name: string;
  world: string;
  theme: "city" | "park" | "tunnel" | "beach" | "night" | "space" | "jungle";
  questions: RunnerQuestion[];
};

const LEVELS: RunnerLevel[] = [
  {
    name: "City Start", world: "CITY", theme: "city",
    questions: [
      { prompt: "Find CAT to jump the barrier!", choices: ["CAT", "CAN", "CAP"], answer: "CAT", skill: "Word Match" },
      { prompt: "Which word says DOG?", choices: ["DIG", "DOG", "DOT"], answer: "DOG", skill: "Word Match" },
      { prompt: "Find SUN.", choices: ["RUN", "SUN", "FUN"], answer: "SUN", skill: "Word Match" },
      { prompt: "Which word starts with B?", choices: ["BALL", "CAT", "SUN"], answer: "BALL", skill: "Beginning Sound" },
    ],
  },
  {
    name: "Park Dash", world: "PARK", theme: "park",
    questions: [
      { prompt: "Which picture matches BOOK?", choices: ["📘", "⚽", "🍎"], answer: "📘", skill: "Picture Match" },
      { prompt: "Which picture matches APPLE?", choices: ["🐶", "🍎", "🚗"], answer: "🍎", skill: "Picture Match" },
      { prompt: "Find RED.", choices: ["BED", "RED", "RID"], answer: "RED", skill: "Word Discrimination" },
      { prompt: "Which word starts with S?", choices: ["SUN", "DOG", "MAP"], answer: "SUN", skill: "Beginning Sound" },
    ],
  },
  {
    name: "Tunnel Rush", world: "TUNNEL", theme: "tunnel",
    questions: [
      { prompt: "Finish it: The dog ___.", choices: ["RUNS", "BLUE", "BOOK"], answer: "RUNS", skill: "Sentence Meaning" },
      { prompt: "Which word means moving fast?", choices: ["RUN", "SIT", "NAP"], answer: "RUN", skill: "Vocabulary" },
      { prompt: "Which word rhymes with CAT?", choices: ["HAT", "DOG", "SUN"], answer: "HAT", skill: "Rhyming" },
      { prompt: "Which word rhymes with BOOK?", choices: ["LOOK", "BALL", "TREE"], answer: "LOOK", skill: "Rhyming" },
    ],
  },
  {
    name: "Beach Blast", world: "BEACH", theme: "beach",
    questions: [
      { prompt: "Which sentence makes sense?", choices: ["I read a book.", "Book the run.", "Blue eats fast."], answer: "I read a book.", skill: "Sentence Meaning" },
      { prompt: "Which word names a person?", choices: ["GIRL", "RUN", "RED"], answer: "GIRL", skill: "Nouns" },
      { prompt: "Which word is an action?", choices: ["JUMP", "BALL", "GREEN"], answer: "JUMP", skill: "Verbs" },
      { prompt: "Which sentence matches a sleeping cat?", choices: ["The cat sleeps.", "The dog runs.", "The bird flies."], answer: "The cat sleeps.", skill: "Comprehension" },
    ],
  },
  {
    name: "Neon Night", world: "NIGHT", theme: "night",
    questions: [
      { prompt: "Which word has two syllables?", choices: ["APPLE", "DOG", "SUN"], answer: "APPLE", skill: "Syllables" },
      { prompt: "Which word is a place?", choices: ["SCHOOL", "RUN", "HAPPY"], answer: "SCHOOL", skill: "Vocabulary" },
      { prompt: "What is the opposite of HOT?", choices: ["COLD", "BIG", "FAST"], answer: "COLD", skill: "Opposites" },
      { prompt: "Finish: I wear shoes on my ___.", choices: ["FEET", "BOOK", "MILK"], answer: "FEET", skill: "Context Clues" },
    ],
  },
  {
    name: "Space Sprint", world: "SPACE", theme: "space",
    questions: [
      { prompt: "Which word means looking at words in a book?", choices: ["READ", "EAT", "SLEEP"], answer: "READ", skill: "Vocabulary" },
      { prompt: "Which one is a question?", choices: ["Where is the dog?", "The dog runs.", "I like books."], answer: "Where is the dog?", skill: "Sentence Types" },
      { prompt: "Which word comes first alphabetically?", choices: ["BALL", "CAT", "DOG"], answer: "BALL", skill: "Alphabetical Order" },
      { prompt: "Which word has the long A sound?", choices: ["CAKE", "CAT", "CAN"], answer: "CAKE", skill: "Phonics" },
    ],
  },
  {
    name: "Jungle Run", world: "JUNGLE", theme: "jungle",
    questions: [
      { prompt: "Which sentence tells who did something?", choices: ["The boy jumped.", "Jumped fast.", "Very green."], answer: "The boy jumped.", skill: "Sentence Structure" },
      { prompt: "Which word describes the dog?", choices: ["BIG", "RUN", "DOG"], answer: "BIG", skill: "Adjectives" },
      { prompt: "Which word has three letters?", choices: ["CAT", "BOOK", "APPLE"], answer: "CAT", skill: "Word Length" },
      { prompt: "Which word rhymes with TREE?", choices: ["BEE", "CAT", "BOOK"], answer: "BEE", skill: "Rhyming" },
    ],
  },
  {
    name: "Reading Champion", world: "FINAL", theme: "city",
    questions: [
      { prompt: "Which is the best title for a story about a dog at the park?", choices: ["Dog's Park Day", "How to Bake", "Space Rockets"], answer: "Dog's Park Day", skill: "Main Idea" },
      { prompt: "What tells where a story happens?", choices: ["SETTING", "CHARACTER", "TITLE"], answer: "SETTING", skill: "Story Elements" },
      { prompt: "Who is a story about?", choices: ["CHARACTER", "SETTING", "PAGE"], answer: "CHARACTER", skill: "Story Elements" },
      { prompt: "What happens in a story?", choices: ["PLOT", "COLOR", "AUTHOR NAME"], answer: "PLOT", skill: "Story Elements" },
    ],
  },
];

const BUDDY_EMOJI: Record<BuddyPreset, string> = {
  puppy: "🐶",
  dino: "🦖",
  robot: "🤖",
  bunny: "🐰",
};

function playFx(type: "coin" | "jump" | "hit" | "win") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const freqs = type === "coin" ? [880, 1320] : type === "jump" ? [420, 680] : type === "hit" ? [150, 90] : [523, 659];
    osc.frequency.setValueAtTime(freqs[0], now);
    osc.frequency.exponentialRampToValueAtTime(freqs[1], now + 0.18);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.23);
    setTimeout(() => ctx.close(), 300);
  } catch {}
}

function RunnerKid({ action }: { action: "run" | "jump" | "hit" | "celebrate" }) {
  return (
    <div className={`runner-kid runner-${action}`} aria-label="Runner character">
      <svg viewBox="0 0 180 250" className="w-[105px] sm:w-[128px] drop-shadow-2xl overflow-visible">
        <defs>
          <linearGradient id="hoodie" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ef4444"/>
            <stop offset="100%" stopColor="#b91c1c"/>
          </linearGradient>
          <linearGradient id="pants" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb"/>
            <stop offset="100%" stopColor="#1e3a8a"/>
          </linearGradient>
          <radialGradient id="skin" cx="45%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#d79a71"/>
            <stop offset="100%" stopColor="#9a5e3b"/>
          </radialGradient>
        </defs>

        <g className="runner-shadow">
          <ellipse cx="90" cy="238" rx="45" ry="10" fill="rgba(15,23,42,.25)" />
        </g>

        <g className="runner-body">
          <g className="runner-back-arm" style={{ transformOrigin: "78px 120px" }}>
            <rect x="56" y="112" width="22" height="65" rx="11" fill="url(#hoodie)" transform="rotate(24 67 144)" />
            <circle cx="52" cy="174" r="11" fill="url(#skin)" />
          </g>

          <g className="runner-back-leg" style={{ transformOrigin: "82px 176px" }}>
            <rect x="70" y="165" width="25" height="65" rx="12" fill="url(#pants)" transform="rotate(18 82 197)" />
            <g transform="translate(55 211) rotate(-8)">
              <rect x="0" y="0" width="48" height="20" rx="10" fill="#f8fafc" />
              <rect x="6" y="7" width="32" height="5" rx="2" fill="#0ea5e9" />
            </g>
          </g>

          <path d="M48 103 Q90 82 132 104 L124 174 Q91 189 56 171 Z" fill="url(#hoodie)" />
          <path d="M72 105 L90 126 L108 105 L103 151 L77 151 Z" fill="#ffffff" opacity=".95" />
          <path d="M90 114 l7 14 15 2-11 10 3 15-14-7-14 7 3-15-11-10 15-2z" fill="#facc15" />

          <g className="runner-front-leg" style={{ transformOrigin: "102px 176px" }}>
            <rect x="92" y="166" width="26" height="68" rx="13" fill="url(#pants)" transform="rotate(-14 105 199)" />
            <g transform="translate(94 215) rotate(7)">
              <rect x="0" y="0" width="50" height="21" rx="10" fill="#f8fafc" />
              <rect x="8" y="7" width="31" height="5" rx="2" fill="#2563eb" />
            </g>
          </g>

          <g className="runner-front-arm" style={{ transformOrigin: "115px 118px" }}>
            <rect x="111" y="108" width="23" height="66" rx="11" fill="url(#hoodie)" transform="rotate(-34 122 141)" />
            <circle cx="143" cy="164" r="11" fill="url(#skin)" />
          </g>

          <circle cx="89" cy="72" r="47" fill="url(#skin)" />
          <path d="M48 61 Q48 19 91 20 Q132 20 136 61 Q121 44 104 42 Q84 54 55 49 Z" fill="#2f1a11" />
          <path d="M56 49 Q67 19 91 17 Q116 17 132 39 Q116 28 104 32 Q92 16 77 34 Q65 27 56 49 Z" fill="#4a2515" />
          <ellipse cx="73" cy="72" rx="5" ry="7" fill="#111827" />
          <ellipse cx="108" cy="72" rx="5" ry="7" fill="#111827" />
          <circle cx="74" cy="70" r="1.8" fill="white" />
          <circle cx="109" cy="70" r="1.8" fill="white" />
          <path d="M77 90 Q90 101 105 89" fill="none" stroke="#7f1d1d" strokeWidth="5" strokeLinecap="round"/>
          <circle cx="57" cy="85" r="7" fill="#ef9f84" opacity=".55" />
          <circle cx="122" cy="85" r="7" fill="#ef9f84" opacity=".55" />

          <path d="M48 119 Q29 130 26 159" fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
          <rect x="22" y="143" width="15" height="44" rx="7" fill="#0f172a" />
          <path d="M29 150 Q15 152 12 166" fill="none" stroke="#0ea5e9" strokeWidth="6" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

function AnimatedBuddy({
  buddy,
  talking,
  pointLane,
}: {
  buddy: BuddyConfig;
  talking: boolean;
  pointLane: number | null;
}) {
  const emoji = BUDDY_EMOJI[buddy.preset] || "🐶";
  const targetX = pointLane === null ? 0 : (pointLane - 1) * 18;

  return (
    <div className="buddy-float" style={{ transform: `translateX(${targetX}px)` }}>
      <div className="relative">
        {buddy.type === "upload" && buddy.imageData ? (
          <img src={buddy.imageData} alt={buddy.name} className="w-[78px] h-[78px] sm:w-[92px] sm:h-[92px] rounded-full object-cover border-4 border-white shadow-2xl bg-white" />
        ) : (
          <div className="w-[78px] h-[78px] sm:w-[92px] sm:h-[92px] rounded-full border-4 border-white shadow-2xl bg-gradient-to-br from-yellow-200 to-amber-300 flex items-center justify-center text-5xl sm:text-6xl">
            {emoji}
          </div>
        )}
        <div className={`buddy-mouth absolute left-1/2 -translate-x-1/2 bottom-[15px] w-5 rounded-full bg-slate-900/80 ${talking ? "talking" : ""}`} />
        {pointLane !== null && (
          <div className="absolute -left-14 top-7 flex items-center pointer-arm">
            <div className="h-3 w-12 rounded-full bg-amber-300 shadow-md origin-right rotate-[-8deg]" />
            <span className="text-3xl -ml-1">👉</span>
          </div>
        )}
      </div>
      <div className="mt-1 rounded-full bg-white/95 px-3 py-1 text-[10px] sm:text-xs font-black text-violet-700 shadow-md text-center max-w-[110px] truncate">
        {talking ? "TALKING" : buddy.name}
      </div>
    </div>
  );
}

function SceneDecor({ theme }: { theme: RunnerLevel["theme"] }) {
  const night = theme === "night" || theme === "space";
  return (
    <>
      <div className={`absolute inset-0 ${night ? "bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-800" : theme === "beach" ? "bg-gradient-to-b from-sky-300 via-cyan-100 to-amber-100" : theme === "jungle" ? "bg-gradient-to-b from-cyan-300 via-emerald-100 to-green-300" : "bg-gradient-to-b from-sky-300 via-cyan-100 to-emerald-100"}`} />
      <div className="absolute inset-x-0 top-0 h-40 overflow-hidden">
        {night ? (
          <div className="absolute inset-0">
            {Array.from({length: 34}).map((_, i) => (
              <span key={i} className="absolute w-1 h-1 bg-white rounded-full twinkle" style={{left: `${(i * 31) % 100}%`, top: `${(i * 17) % 70}%`, animationDelay: `${(i % 8) * .15}s`}} />
            ))}
          </div>
        ) : (
          <>
            <div className="cloud cloud-a" />
            <div className="cloud cloud-b" />
            <div className="cloud cloud-c" />
          </>
        )}
      </div>

      {theme === "space" ? (
        <>
          <div className="absolute top-20 right-12 text-7xl opacity-90">🪐</div>
          <div className="absolute top-36 left-10 text-5xl">🚀</div>
        </>
      ) : theme === "beach" ? (
        <>
          <div className="absolute bottom-[120px] left-4 text-7xl">🌴</div>
          <div className="absolute bottom-[145px] right-6 text-6xl">🏖️</div>
        </>
      ) : theme === "jungle" ? (
        <>
          <div className="absolute bottom-24 left-0 text-8xl">🌴</div>
          <div className="absolute bottom-20 right-0 text-8xl">🌿</div>
        </>
      ) : (
        <div className="absolute inset-x-0 top-28 h-32 flex items-end gap-2 city-scroll opacity-85">
          {Array.from({length: 20}).map((_, i) => (
            <div key={i} className={`rounded-t-md ${night ? "bg-indigo-600/80" : "bg-slate-500/70"}`} style={{width: 44 + (i % 3) * 8, height: 48 + (i % 5) * 18}}>
              <div className="grid grid-cols-2 gap-1 p-2 opacity-75">
                {Array.from({length: 6}).map((_, j) => <span key={j} className={`h-1.5 rounded-sm ${night ? "bg-yellow-200" : "bg-sky-100"}`} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LaneObstacle({ lane, moving, hit }: { lane: number; moving: boolean; hit: boolean }) {
  const left = lane === 0 ? "18%" : lane === 1 ? "50%" : "82%";
  return (
    <div
      className={`absolute z-20 obstacle ${moving ? "obstacle-rush" : ""} ${hit ? "obstacle-hit" : ""}`}
      style={{ left, top: "34%", transform: "translateX(-50%)" }}
    >
      <div className="relative">
        <div className="w-20 sm:w-24 h-14 sm:h-16 rounded-xl bg-gradient-to-b from-orange-400 to-orange-600 border-4 border-white shadow-2xl flex items-center justify-center">
          <div className="w-full border-t-[8px] border-white/95 rotate-[-14deg]" />
        </div>
        <div className="absolute -bottom-2 left-2 w-4 h-4 rounded-full bg-slate-900" />
        <div className="absolute -bottom-2 right-2 w-4 h-4 rounded-full bg-slate-900" />
      </div>
    </div>
  );
}

function CoinBurst() {
  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {[0,1,2,3,4,5].map(i => (
        <div key={i} className="coin-burst text-3xl absolute left-1/2 top-1/2" style={{"--i": i} as React.CSSProperties}>🪙</div>
      ))}
    </div>
  );
}

export default function ReadingRunnerPro({
  onBack,
  buddy,
}: {
  onBack: () => void;
  buddy: BuddyConfig;
}) {
  const key = "arise-reading-runner-pro";
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }, []);

  const [screen, setScreen] = useState<"map" | "game">("map");
  const [level, setLevel] = useState(Math.max(1, Math.min(LEVELS.length, Number(saved.level || 1))));
  const [unlocked, setUnlocked] = useState(Math.max(1, Math.min(LEVELS.length, Number(saved.unlocked || 1))));
  const [coins, setCoins] = useState(Number(saved.coins || 0));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [playerLane, setPlayerLane] = useState(1);
  const [obstacleLane, setObstacleLane] = useState(1);
  const [action, setAction] = useState<"run" | "jump" | "hit" | "celebrate">("run");
  const [locked, setLocked] = useState(false);
  const [talking, setTalking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(true);
  const [coinBurst, setCoinBurst] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLevel = LEVELS[level - 1];
  const question = currentLevel.questions[questionIndex];
  const correctLane = Math.max(0, question?.choices.indexOf(question.answer) ?? 1);
  const complete = questionIndex >= currentLevel.questions.length;

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify({ level, unlocked, coins }));
  }, [level, unlocked, coins]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    stopSpeaking();
  }, []);

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

  const announceQuestion = (index = questionIndex) => {
    const q = currentLevel.questions[index];
    if (!q) return;
    setFeedback(q.prompt);
    say(q.prompt);
  };

  const beginLevel = (n: number) => {
    if (n > unlocked) return;
    stopSpeaking();
    setLevel(n);
    setQuestionIndex(0);
    setHearts(3);
    setPlayerLane(1);
    setObstacleLane(1);
    setAction("run");
    setLocked(false);
    setPaused(false);
    setScreen("game");
    setTimeout(() => {
      const q = LEVELS[n - 1].questions[0];
      setFeedback(q.prompt);
      say(`Level ${n}. ${LEVELS[n - 1].name}. ${q.prompt}`);
    }, 250);
  };

  const answer = (choice: string, lane: number) => {
    if (locked || paused || complete) return;
    setLocked(true);
    setPlayerLane(lane);
    setObstacleLane(lane);

    if (choice === question.answer) {
      setAction("jump");
      setFeedback(`YES! ${question.answer}! Jump!`);
      setCoins(v => v + 10);
      setCoinBurst(v => v + 1);
      if (sound) {
        playFx("jump");
        setTimeout(() => playFx("coin"), 180);
      }
      say(`Yes! ${question.answer}! Jump!`);

      timeoutRef.current = setTimeout(() => {
        const last = questionIndex >= currentLevel.questions.length - 1;
        if (last) {
          const nextUnlocked = Math.min(LEVELS.length, Math.max(unlocked, level + 1));
          setUnlocked(nextUnlocked);
          setAction("celebrate");
          setFeedback(level === LEVELS.length ? "READING CHAMPION!" : "LEVEL COMPLETE!");
          if (sound) playFx("win");
          say(level === LEVELS.length ? "Reading Champion! You finished the whole adventure!" : "Level complete! You unlocked the next world!");
          setLocked(false);
        } else {
          const next = questionIndex + 1;
          setQuestionIndex(next);
          setObstacleLane((next + level) % 3);
          setAction("run");
          setLocked(false);
          announceQuestion(next);
        }
      }, 1050);
    } else {
      setAction("hit");
      setHearts(h => Math.max(0, h - 1));
      setFeedback("BUMP! Try another lane.");
      if (sound) playFx("hit");
      say("Oops! Bump! Try another lane.", true);
      timeoutRef.current = setTimeout(() => {
        setAction("run");
        setLocked(false);
      }, 800);
    }
  };

  if (screen === "map") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-violet-100 px-4 py-5">
        <GameStyles />
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={onBack} className="min-h-[48px] px-4 rounded-2xl bg-white shadow border border-slate-200 font-black text-slate-700 flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" /> Games
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Reading Runner</h1>
              <p className="text-sm font-bold text-slate-500">Pick a world and run!</p>
            </div>
            <div className="ml-auto rounded-2xl bg-amber-100 border border-amber-200 px-4 py-2 font-black text-amber-700">🪙 {coins}</div>
          </div>

          <div className="relative rounded-[2.25rem] overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 text-white shadow-2xl mb-6">
            <div className="absolute right-5 bottom-[-25px] opacity-95">
              <RunnerKid action="run" />
            </div>
            <div className="relative max-w-xl">
              <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest mb-3">Adventure Mode</div>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight">Run. Read. Jump. Win.</h2>
              <p className="mt-3 text-white/90 font-bold max-w-lg">Correct answers make your runner dodge obstacles, jump barriers and grab coins.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {LEVELS.map((item, i) => {
              const n = i + 1;
              const open = n <= unlocked;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!open}
                  onClick={() => beginLevel(n)}
                  className={`relative min-h-[170px] rounded-[1.75rem] border-2 p-4 text-left overflow-hidden transition-all ${open ? "bg-white border-white hover:-translate-y-1 hover:shadow-xl" : "bg-slate-100 border-slate-200 opacity-60"}`}
                >
                  <div className={`absolute inset-0 opacity-20 ${item.theme === "space" || item.theme === "night" ? "bg-gradient-to-br from-indigo-700 to-slate-950" : item.theme === "jungle" ? "bg-gradient-to-br from-emerald-400 to-green-700" : item.theme === "beach" ? "bg-gradient-to-br from-cyan-300 to-amber-300" : "bg-gradient-to-br from-sky-300 to-violet-300"}`} />
                  <div className="relative">
                    <div className="text-xs font-black uppercase tracking-widest text-violet-600">Level {n}</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{item.name}</div>
                    <div className="mt-3 text-4xl">{item.theme === "space" ? "🚀" : item.theme === "jungle" ? "🌴" : item.theme === "beach" ? "🏖️" : item.theme === "night" ? "🌃" : item.theme === "tunnel" ? "🚇" : item.theme === "park" ? "🌳" : "🏙️"}</div>
                    <div className="mt-3 text-sm font-bold text-slate-500">{item.questions.length} challenges</div>
                  </div>
                  {!open && <LockKeyhole className="absolute top-4 right-4 w-6 h-6 text-slate-400" />}
                  {open && n < unlocked && <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-green-500" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const isCelebrating = action === "celebrate";
  const progress = ((questionIndex + (isCelebrating ? 1 : 0)) / currentLevel.questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <GameStyles />
      <div className="max-w-[1500px] mx-auto">
        <div className="h-16 px-3 sm:px-5 flex items-center gap-3 bg-slate-950/95 border-b border-white/10">
          <button onClick={() => { stopSpeaking(); setScreen("map"); }} className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Map
          </button>

          <div className="hidden sm:block">
            <div className="text-xs uppercase tracking-widest text-cyan-300 font-black">Level {level}</div>
            <div className="font-black">{currentLevel.name}</div>
          </div>

          <div className="flex-1 max-w-xl mx-auto">
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-lime-400 via-yellow-300 to-amber-400 transition-all duration-500" style={{width: `${progress}%`}} />
            </div>
          </div>

          <div className="rounded-xl bg-amber-400/15 px-3 py-2 font-black text-amber-200">🪙 {coins}</div>
          <div className="hidden sm:flex items-center gap-1">{[0,1,2].map(i => <Heart key={i} className={`w-5 h-5 ${i < hearts ? "fill-rose-500 text-rose-500" : "text-white/20"}`} />)}</div>
          <button onClick={() => setSound(v => !v)} className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">{sound ? <Volume2 className="w-5 h-5"/> : <VolumeX className="w-5 h-5"/>}</button>
          <button onClick={() => setPaused(v => !v)} className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">{paused ? <Play className="w-5 h-5"/> : <Pause className="w-5 h-5"/>}</button>
        </div>

        <div className="relative h-[calc(100vh-4rem)] min-h-[650px] overflow-hidden">
          <SceneDecor theme={currentLevel.theme} />

          <div className="absolute inset-x-[8%] sm:inset-x-[14%] top-[20%] bottom-0 road-perspective overflow-hidden">
            <div className="absolute inset-0 road-lines" />
            <div className="absolute left-1/3 top-0 bottom-0 border-l-[3px] border-dashed border-white/70 lane-line" />
            <div className="absolute left-2/3 top-0 bottom-0 border-l-[3px] border-dashed border-white/70 lane-line" />

            {!isCelebrating && <LaneObstacle lane={obstacleLane} moving={locked} hit={action === "hit"} />}

            <div
              className="absolute z-30 bottom-[25%] transition-all duration-300"
              style={{
                left: playerLane === 0 ? "18%" : playerLane === 1 ? "50%" : "82%",
                transform: "translateX(-50%)",
              }}
            >
              <RunnerKid action={action} />
            </div>

            <div className="absolute bottom-[20%] left-0 right-0 h-8 bg-black/15 blur-md rounded-full" />
          </div>

          <div className="absolute z-40 top-5 right-4 sm:right-8">
            <AnimatedBuddy buddy={buddy} talking={talking} pointLane={isCelebrating ? null : correctLane} />
          </div>

          {coinBurst > 0 && action === "jump" && <CoinBurst />}

          {paused && (
            <div className="absolute inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center">
              <button onClick={() => setPaused(false)} className="rounded-[2rem] bg-white text-slate-900 px-8 py-6 font-black text-2xl shadow-2xl flex items-center gap-3">
                <Play className="w-8 h-8 fill-current"/> Keep Running
              </button>
            </div>
          )}

          <div className="absolute z-50 inset-x-3 sm:inset-x-[8%] bottom-3 sm:bottom-5">
            <div className="rounded-[2rem] bg-white/95 backdrop-blur-xl border-2 border-white shadow-2xl p-3 sm:p-5 text-slate-900">
              {isCelebrating ? (
                <div className="text-center py-3">
                  <div className="text-5xl mb-2">🏆</div>
                  <div className="text-3xl sm:text-4xl font-black">{level === LEVELS.length ? "READING CHAMPION!" : "LEVEL COMPLETE!"}</div>
                  <div className="mt-2 font-bold text-slate-500">You earned {currentLevel.questions.length * 10} coins.</div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-5">
                    <button onClick={() => setScreen("map")} className="min-h-[62px] rounded-2xl bg-violet-600 text-white font-black text-lg">Back to Map</button>
                    {level < LEVELS.length && (
                      <button onClick={() => beginLevel(level + 1)} className="min-h-[62px] rounded-2xl bg-green-500 text-white font-black text-lg">Next Level →</button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center mb-3">
                    <div className="text-[10px] sm:text-xs font-black uppercase tracking-[.2em] text-violet-600">{question.skill}</div>
                    <div className="text-xl sm:text-3xl font-black mt-1">{question.prompt}</div>
                    <div className="mt-1 text-xs sm:text-sm font-bold text-slate-500">Pick a lane. Correct answer = JUMP!</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {question.choices.map((choice, i) => (
                      <button
                        key={choice}
                        type="button"
                        disabled={locked || paused}
                        onClick={() => answer(choice, i)}
                        className={`choice-lane relative min-h-[88px] sm:min-h-[112px] rounded-[1.4rem] border-[3px] p-2 sm:p-4 font-black transition-all disabled:opacity-60 ${i === 0 ? "bg-gradient-to-b from-cyan-50 to-cyan-200 border-cyan-400" : i === 1 ? "bg-gradient-to-b from-yellow-50 to-yellow-200 border-yellow-400" : "bg-gradient-to-b from-fuchsia-50 to-fuchsia-200 border-fuchsia-400"}`}
                      >
                        <div className="text-[9px] sm:text-[11px] uppercase tracking-widest opacity-50">Lane {i + 1}</div>
                        <div className="text-base sm:text-2xl break-words leading-tight mt-1">{choice}</div>
                      </button>
                    ))}
                  </div>

                  <div className={`mt-2 text-center text-sm font-black ${action === "hit" ? "text-amber-600" : action === "jump" ? "text-green-600" : "text-slate-500"}`}>{feedback || question.prompt}</div>
                </>
              )}
            </div>
          </div>

          <div className="sm:hidden absolute top-3 left-3 z-40 flex gap-1">{[0,1,2].map(i => <Heart key={i} className={`w-5 h-5 ${i < hearts ? "fill-rose-500 text-rose-500" : "text-white/30"}`} />)}</div>
        </div>
      </div>
    </div>
  );
}

function GameStyles() {
  return (
    <style>{`
      .road-perspective {
        background: linear-gradient(90deg, #2b3444 0%, #414b5b 50%, #2b3444 100%);
        clip-path: polygon(34% 0, 66% 0, 100% 100%, 0 100%);
        box-shadow: 0 0 50px rgba(0,0,0,.25);
      }
      .road-lines {
        background-image:
          repeating-linear-gradient(180deg, rgba(255,255,255,.0) 0 55px, rgba(255,255,255,.7) 55px 76px, rgba(255,255,255,.0) 76px 125px);
        background-size: 100% 125px;
        animation: roadScroll .65s linear infinite;
        opacity: .24;
      }
      .lane-line { animation: lanePulse .65s linear infinite; }
      .runner-kid { transform-origin: 50% 100%; }
      .runner-run .runner-front-arm { animation: armFront .42s ease-in-out infinite alternate; }
      .runner-run .runner-back-arm { animation: armBack .42s ease-in-out infinite alternate; }
      .runner-run .runner-front-leg { animation: legFront .42s ease-in-out infinite alternate; }
      .runner-run .runner-back-leg { animation: legBack .42s ease-in-out infinite alternate; }
      .runner-run .runner-body { animation: bodyBob .22s ease-in-out infinite alternate; }
      .runner-run .runner-shadow { animation: shadowPulse .44s ease-in-out infinite alternate; }
      .runner-jump { animation: kidJump 1.02s cubic-bezier(.18,.78,.24,1); }
      .runner-jump .runner-front-arm { animation: jumpArm .5s ease-in-out both; }
      .runner-jump .runner-back-arm { animation: jumpArmBack .5s ease-in-out both; }
      .runner-jump .runner-front-leg { animation: jumpKnee .55s ease-out both; }
      .runner-jump .runner-back-leg { animation: jumpKneeBack .55s ease-out both; }
      .runner-hit { animation: kidHit .72s ease-in-out; }
      .runner-celebrate { animation: celebrateHop .85s ease-in-out infinite alternate; }
      .runner-celebrate .runner-front-arm { animation: celebrateArm .7s ease-in-out infinite alternate; }
      .runner-celebrate .runner-back-arm { animation: celebrateArmBack .7s ease-in-out infinite alternate; }

      .buddy-float { animation: buddyFloat 2.2s ease-in-out infinite; transition: transform .35s ease; }
      .buddy-mouth { height: 5px; transition: height .1s ease; }
      .buddy-mouth.talking { animation: mouthTalk .18s ease-in-out infinite alternate; }
      .pointer-arm { animation: pointPulse .7s ease-in-out infinite alternate; }

      .obstacle { transition: left .3s ease; }
      .obstacle-rush { animation: obstacleRush .9s cubic-bezier(.15,.7,.35,1); }
      .obstacle-hit { filter: saturate(1.5); }
      .city-scroll { animation: skyline 14s linear infinite; width: 140%; }
      .twinkle { animation: twinkle 1.5s ease-in-out infinite alternate; }
      .cloud { position:absolute; width:110px; height:36px; border-radius:999px; background:rgba(255,255,255,.82); filter:blur(.2px); }
      .cloud:before,.cloud:after { content:""; position:absolute; border-radius:999px; background:inherit; }
      .cloud:before { width:48px; height:48px; left:18px; top:-22px; }
      .cloud:after { width:58px; height:58px; right:12px; top:-30px; }
      .cloud-a { top:45px; left:-140px; animation: cloudMove 17s linear infinite; }
      .cloud-b { top:90px; left:-180px; transform:scale(.8); animation: cloudMove 22s linear infinite 5s; }
      .cloud-c { top:20px; left:-210px; transform:scale(1.15); animation: cloudMove 25s linear infinite 9s; }

      .choice-lane:hover:not(:disabled) { transform: translateY(-5px) scale(1.015); box-shadow: 0 14px 26px rgba(15,23,42,.16); }
      .coin-burst { animation: coinBurst .85s ease-out forwards; animation-delay: calc(var(--i) * .035s); }

      @keyframes roadScroll { from { background-position-y:0; } to { background-position-y:125px; } }
      @keyframes lanePulse { from { transform:translateY(-20px); } to { transform:translateY(70px); } }
      @keyframes bodyBob { from { transform:translateY(0); } to { transform:translateY(-4px); } }
      @keyframes shadowPulse { from { transform:scaleX(1); opacity:.7; } to { transform:scaleX(.82); opacity:.45; } }
      @keyframes armFront { from { transform:rotate(-24deg); } to { transform:rotate(34deg); } }
      @keyframes armBack { from { transform:rotate(28deg); } to { transform:rotate(-30deg); } }
      @keyframes legFront { from { transform:rotate(-22deg); } to { transform:rotate(26deg); } }
      @keyframes legBack { from { transform:rotate(22deg); } to { transform:rotate(-26deg); } }
      @keyframes kidJump {
        0% { transform:translateY(0) scale(1); }
        35% { transform:translateY(-165px) scale(1.04) rotate(-4deg); }
        62% { transform:translateY(-130px) scale(1.02) rotate(3deg); }
        100% { transform:translateY(0) scale(1); }
      }
      @keyframes jumpArm { to { transform:rotate(-65deg); } }
      @keyframes jumpArmBack { to { transform:rotate(55deg); } }
      @keyframes jumpKnee { to { transform:rotate(-48deg) translateY(-8px); } }
      @keyframes jumpKneeBack { to { transform:rotate(42deg) translateY(-8px); } }
      @keyframes kidHit {
        0%,100% { transform:translateX(0) rotate(0); }
        20% { transform:translateX(-18px) rotate(-8deg); }
        45% { transform:translateX(15px) rotate(7deg); }
        70% { transform:translateX(-8px) rotate(-4deg); }
      }
      @keyframes celebrateHop { from { transform:translateY(0) rotate(-2deg); } to { transform:translateY(-24px) rotate(2deg); } }
      @keyframes celebrateArm { to { transform:rotate(-75deg); } }
      @keyframes celebrateArmBack { to { transform:rotate(70deg); } }
      @keyframes buddyFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
      @keyframes mouthTalk { from { height:4px; transform:translateX(-50%) scaleX(.75); } to { height:14px; transform:translateX(-50%) scaleX(1.25); } }
      @keyframes pointPulse { from { transform:translateX(0); } to { transform:translateX(-6px); } }
      @keyframes obstacleRush {
        0% { top:24%; transform:translateX(-50%) scale(.45); opacity:.55; }
        100% { top:74%; transform:translateX(-50%) scale(1.18); opacity:1; }
      }
      @keyframes skyline { from { transform:translateX(0); } to { transform:translateX(-24%); } }
      @keyframes cloudMove { from { left:-220px; } to { left:110%; } }
      @keyframes twinkle { from { opacity:.25; transform:scale(.7); } to { opacity:1; transform:scale(1.3); } }
      @keyframes coinBurst {
        0% { transform:translate(-50%,-50%) scale(.4) rotate(0); opacity:1; }
        100% {
          transform:
            translate(
              calc(-50% + (var(--i) - 2.5) * 55px),
              calc(-50% - 110px - (var(--i) % 2) * 25px)
            )
            scale(1.15) rotate(360deg);
          opacity:0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .road-lines,.lane-line,.runner-run .runner-front-arm,.runner-run .runner-back-arm,.runner-run .runner-front-leg,.runner-run .runner-back-leg,.runner-run .runner-body,.buddy-float,.city-scroll,.twinkle,.cloud,.pointer-arm {
          animation-duration: 4s !important;
        }
      }
    `}</style>
  );
}
