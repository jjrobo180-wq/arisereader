import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, RotateCcw, Star, Volume2 } from "lucide-react";
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

type Difficulty = "easy" | "medium" | "hard";
type Thing = { label: string; emoji: string };
type Mission = {
  prompt: string;
  target: Thing;
  distractors: Thing[];
  goal: number;
};

type FlyingThing = Thing & {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isTarget: boolean;
  sliced: boolean;
  rotation: number;
};

const MISSIONS: Mission[] = [
  {
    prompt: "Slice all the apples",
    target: { label: "apple", emoji: "🍎" },
    distractors: [
      { label: "banana", emoji: "🍌" },
      { label: "orange", emoji: "🍊" },
      { label: "grapes", emoji: "🍇" },
      { label: "strawberry", emoji: "🍓" },
      { label: "watermelon", emoji: "🍉" },
    ],
    goal: 8,
  },
  {
    prompt: "Slice all the cats",
    target: { label: "cat", emoji: "🐱" },
    distractors: [
      { label: "dog", emoji: "🐶" },
      { label: "rabbit", emoji: "🐰" },
      { label: "frog", emoji: "🐸" },
      { label: "bear", emoji: "🐻" },
      { label: "lion", emoji: "🦁" },
    ],
    goal: 8,
  },
  {
    prompt: "Slice all the stars",
    target: { label: "star", emoji: "⭐" },
    distractors: [
      { label: "moon", emoji: "🌙" },
      { label: "sun", emoji: "☀️" },
      { label: "cloud", emoji: "☁️" },
      { label: "heart", emoji: "❤️" },
      { label: "rainbow", emoji: "🌈" },
    ],
    goal: 8,
  },
  {
    prompt: "Slice all the dogs",
    target: { label: "dog", emoji: "🐶" },
    distractors: [
      { label: "cat", emoji: "🐱" },
      { label: "cow", emoji: "🐮" },
      { label: "pig", emoji: "🐷" },
      { label: "fox", emoji: "🦊" },
      { label: "monkey", emoji: "🐵" },
    ],
    goal: 8,
  },
  {
    prompt: "Slice all the books",
    target: { label: "book", emoji: "📘" },
    distractors: [
      { label: "pencil", emoji: "✏️" },
      { label: "backpack", emoji: "🎒" },
      { label: "scissors", emoji: "✂️" },
      { label: "ruler", emoji: "📏" },
      { label: "paint", emoji: "🎨" },
    ],
    goal: 8,
  },
];

const SPEED = {
  easy: { launch: -2.05, gravity: 0.038, spawn: 1050, label: "Easy", description: "Slower flight · more time to find the target" },
  medium: { launch: -2.45, gravity: 0.048, spawn: 780, label: "Medium", description: "Steady speed" },
  hard: { launch: -2.9, gravity: 0.06, spawn: 540, label: "Hard", description: "Fast flight · quicker response" },
} as const;

const BUDDY_EMOJI: Record<BuddyPreset, string> = {
  puppy: "🐶",
  dino: "🦕",
  robot: "🤖",
  bunny: "🐰",
};

function cheer(label: string) {
  const lines = [
    `Got an ${label}!`,
    `Yes! ${label}!`,
    `Great slice! ${label}!`,
    `You got the ${label}!`,
  ];
  const line = lines[Math.floor(Math.random() * lines.length)];
  return label.match(/^[aeiou]/i) ? line : line.replace("Got an ", "Got a ");
}

export default function ReadingNinja({
  onBack,
  buddy,
}: {
  onBack: () => void;
  buddy: BuddyConfig;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [started, setStarted] = useState(false);
  const [missionIndex, setMissionIndex] = useState(0);
  const [things, setThings] = useState<FlyingThing[]>([]);
  const thingsRef = useRef<FlyingThing[]>([]);
  const [slicedCount, setSlicedCount] = useState(0);
  const slicedRef = useRef(0);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const heartsRef = useRef(3);
  const [message, setMessage] = useState("Swipe across only the target.");
  const [missionComplete, setMissionComplete] = useState(false);
  const missionCompleteRef = useRef(false);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  const [slicing, setSlicing] = useState(false);
  const [trail, setTrail] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);
  const trailId = useRef(1);

  const mission = MISSIONS[missionIndex % MISSIONS.length];
  const speed = SPEED[difficulty];

  const updateThings = useCallback((next: FlyingThing[] | ((current: FlyingThing[]) => FlyingThing[])) => {
    const value = typeof next === "function" ? next(thingsRef.current) : next;
    thingsRef.current = value;
    setThings(value);
  }, []);

  const say = useCallback((text: string, calm = false) => {
    if (!buddy.voiceEnabled) return;
    stopSpeaking();
    void speakCharacterAI(text, {
      calmMode: calm || !!buddy.calmMode,
      onFallback: () => {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        window.speechSynthesis.speak(utterance);
      },
    });
  }, [buddy.voiceEnabled, buddy.calmMode]);

  const announceMission = useCallback(() => {
    setMessage(mission.prompt + "!");
    say(`${mission.prompt}. Swipe across only the ${mission.target.label}s.`, difficulty === "easy");
  }, [mission, say, difficulty]);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!started || missionComplete || gameOver) return;
    announceMission();
  }, [started, missionComplete, gameOver, missionIndex, announceMission]);

  useEffect(() => {
    if (!started || missionComplete || gameOver) return;
    const timer = window.setInterval(() => {
      const isTarget = Math.random() < 0.47;
      const source = isTarget
        ? mission.target
        : mission.distractors[Math.floor(Math.random() * mission.distractors.length)];
      const x = 12 + Math.random() * 76;
      const towardCenter = (50 - x) * 0.0025;
      const item: FlyingThing = {
        ...source,
        id: nextId.current++,
        x,
        y: 106,
        vx: towardCenter + (Math.random() - 0.5) * 0.13,
        vy: speed.launch * (0.9 + Math.random() * 0.2),
        isTarget,
        sliced: false,
        rotation: Math.random() * 25 - 12,
      };
      updateThings(current => [...current, item]);
    }, speed.spawn);
    return () => window.clearInterval(timer);
  }, [started, missionComplete, gameOver, mission, speed.launch, speed.spawn, updateThings]);

  useEffect(() => {
    if (!started || missionComplete || gameOver) return;
    const timer = window.setInterval(() => {
      updateThings(current => current
        .map(item => ({
          ...item,
          x: item.x + item.vx,
          y: item.y + item.vy,
          vy: item.vy + speed.gravity,
          rotation: item.rotation + (item.sliced ? 7 : 2.1),
        }))
        .filter(item => item.y < 116 && item.x > -12 && item.x < 112));
    }, 32);
    return () => window.clearInterval(timer);
  }, [started, missionComplete, gameOver, speed.gravity, updateThings]);

  const handleHit = useCallback((item: FlyingThing) => {
    if (item.sliced || gameOverRef.current || missionCompleteRef.current) return;
    updateThings(current => current.map(candidate => candidate.id === item.id ? { ...candidate, sliced: true } : candidate));

    if (item.isTarget) {
      const nextCount = slicedRef.current + 1;
      slicedRef.current = nextCount;
      setSlicedCount(nextCount);
      setScore(value => value + (difficulty === "hard" ? 35 : difficulty === "medium" ? 25 : 15));
      const line = cheer(item.label);
      setMessage(line);
      say(line);
      if (nextCount >= mission.goal) {
        missionCompleteRef.current = true;
        setMissionComplete(true);
        updateThings([]);
        setMessage(`You got all the ${mission.target.label}s!`);
        say(`Mission complete! You got all the ${mission.target.label}s. Great job!`);
      }
    } else {
      const nextHearts = Math.max(0, heartsRef.current - 1);
      heartsRef.current = nextHearts;
      setHearts(nextHearts);
      setMessage(`That is a ${item.label}. Slice only the ${mission.target.label}s!`);
      say(`That is a ${item.label}. Keep looking for ${mission.target.label}s.`, true);
      if (nextHearts <= 0) {
        gameOverRef.current = true;
        setGameOver(true);
        setStarted(false);
        updateThings([]);
        say("Nice try! Let's play again and slice only the target.");
      }
    }
  }, [difficulty, mission, say, updateThings]);

  const sliceAt = useCallback((clientX: number, clientY: number) => {
    const arena = arenaRef.current;
    if (!arena || gameOverRef.current || missionCompleteRef.current) return;
    const rect = arena.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    const point = { x, y, id: trailId.current++ };
    setTrail(current => [...current.slice(-10), point]);
    window.setTimeout(() => setTrail(current => current.filter(p => p.id !== point.id)), 190);

    const hit = [...thingsRef.current]
      .filter(item => !item.sliced)
      .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))
      .find(item => Math.abs(item.x - x) <= 7.5 && Math.abs(item.y - y) <= 9.5);
    if (hit) handleHit(hit);
  }, [handleHit]);

  const startGame = () => {
    stopSpeaking();
    setStarted(true);
    setGameOver(false);
    gameOverRef.current = false;
    setMissionComplete(false);
    missionCompleteRef.current = false;
    setMissionIndex(0);
    setSlicedCount(0);
    slicedRef.current = 0;
    setScore(0);
    setHearts(3);
    heartsRef.current = 3;
    updateThings([]);
    setTrail([]);
    setMessage("Get ready!");
  };

  const nextMission = () => {
    setMissionIndex(index => (index + 1) % MISSIONS.length);
    setSlicedCount(0);
    slicedRef.current = 0;
    setHearts(3);
    heartsRef.current = 3;
    setMissionComplete(false);
    missionCompleteRef.current = false;
    updateThings([]);
    setTrail([]);
    setMessage("New mission!");
  };

  const buddyVisual = buddy.type === "upload" && buddy.imageData
    ? <img src={buddy.imageData} alt={buddy.name} className="w-full h-full object-cover rounded-full" />
    : <span>{BUDDY_EMOJI[buddy.preset] || "🐶"}</span>;

  const progress = Math.min(100, (slicedCount / mission.goal) * 100);

  if (!started && !gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-fuchsia-950 via-violet-950 to-slate-950 text-white px-4 py-5">
        <div className="max-w-5xl mx-auto">
          <button type="button" onClick={onBack} className="min-h-12 px-4 rounded-2xl bg-white/10 font-black flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Games
          </button>

          <div className="mt-6 rounded-[2.2rem] border border-white/15 bg-white/10 p-6 sm:p-9 overflow-hidden relative">
            <div className="absolute right-4 bottom-[-20px] text-[150px] opacity-15">🥷</div>
            <div className="relative max-w-2xl">
              <div className="inline-flex items-center rounded-full bg-pink-300/15 border border-pink-200/30 px-3 py-1 text-xs font-black uppercase tracking-widest text-pink-200">
                Swipe-to-slice learning game
              </div>
              <h1 className="text-4xl sm:text-6xl font-black mt-4">Reading Ninja</h1>
              <p className="text-lg sm:text-xl font-bold text-white/75 mt-3">
                Listen for the target, then swipe through only the right animals, foods, or objects.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mt-7">
                {(Object.keys(SPEED) as Difficulty[]).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`rounded-2xl border-2 p-4 text-left min-h-24 ${difficulty === level ? "border-pink-300 bg-pink-300/15" : "border-white/15 bg-white/5"}`}
                  >
                    <div className="font-black text-xl">{SPEED[level].label}</div>
                    <div className="text-sm text-white/65 mt-1">{SPEED[level].description}</div>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-white/8 p-4 text-center font-black">
                👆 Drag your finger across the screen to slice. The voice might say “Slice all the apples” while bananas, oranges, apples, and grapes fly past.
              </div>

              <button type="button" onClick={startGame} className="mt-6 w-full min-h-16 rounded-2xl bg-gradient-to-r from-pink-400 to-violet-500 text-slate-950 text-xl font-black">
                Start Reading Ninja
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-slate-950 text-white grid place-items-center p-5">
        <div className="w-full max-w-lg rounded-[2rem] bg-white/10 border border-white/15 p-7 text-center">
          <div className="text-7xl">🥷</div>
          <h1 className="text-4xl font-black mt-3">Great slicing!</h1>
          <p className="text-xl font-bold text-white/70 mt-2">Score: {score}</p>
          <button type="button" onClick={startGame} className="mt-6 w-full min-h-14 rounded-2xl bg-pink-400 text-slate-950 font-black flex items-center justify-center gap-2">
            <RotateCcw className="w-5 h-5" /> Play again
          </button>
          <button type="button" onClick={onBack} className="mt-2 w-full min-h-12 rounded-2xl bg-white/10 font-black">Back to games</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 sm:p-5 select-none">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button type="button" onClick={onBack} className="min-h-11 px-3 rounded-xl bg-white/10 font-black flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Games</button>
          <div className="flex-1 min-w-[180px]">
            <div className="text-xs uppercase tracking-widest font-black text-pink-300">{SPEED[difficulty].label} · swipe to slice</div>
            <div className="text-xl sm:text-2xl font-black">{mission.prompt}</div>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-rose-500/15 px-3 py-2">{Array.from({length:3}).map((_,i)=><Heart key={i} className={`w-5 h-5 ${i < hearts ? "fill-rose-400 text-rose-400" : "text-white/20"}`} />)}</div>
          <div className="rounded-xl bg-amber-400/15 text-amber-300 px-3 py-2 font-black"><Star className="w-4 h-4 inline fill-current mr-1" />{score}</div>
        </div>

        <div className="rounded-2xl bg-white/10 border border-white/10 p-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/10 grid place-items-center text-3xl overflow-hidden flex-shrink-0">{buddyVisual}</div>
            <div className="flex-1 min-w-0">
              <div className="font-black truncate">{message}</div>
              <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full bg-pink-400 transition-all" style={{width:`${progress}%`}} /></div>
              <div className="text-xs font-bold text-white/55 mt-1">{slicedCount} / {mission.goal} {mission.target.label}s</div>
            </div>
            <button type="button" onClick={announceMission} className="w-11 h-11 rounded-xl bg-white/10 grid place-items-center" aria-label="Repeat mission"><Volume2 className="w-5 h-5" /></button>
          </div>
        </div>

        <div
          ref={arenaRef}
          className="relative overflow-hidden rounded-[2rem] border-4 border-white/10 bg-gradient-to-b from-violet-800 via-fuchsia-700 to-rose-500 touch-none cursor-crosshair"
          style={{ height: "min(70vh, 720px)", minHeight: 520 }}
          onPointerDown={event => {
            setSlicing(true);
            event.currentTarget.setPointerCapture?.(event.pointerId);
            sliceAt(event.clientX, event.clientY);
          }}
          onPointerMove={event => {
            if (!slicing) return;
            sliceAt(event.clientX, event.clientY);
          }}
          onPointerUp={event => {
            if (slicing) sliceAt(event.clientX, event.clientY);
            setSlicing(false);
          }}
          onPointerCancel={() => setSlicing(false)}
        >
          <div className="absolute inset-0 opacity-20" style={{backgroundImage:"radial-gradient(circle at 20% 20%, white 0 2px, transparent 3px), radial-gradient(circle at 80% 35%, white 0 2px, transparent 3px)", backgroundSize:"80px 80px"}} />

          {things.map(item => (
            <div
              key={item.id}
              className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150 pointer-events-none ${item.sliced ? "opacity-20 scale-125" : ""}`}
              style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg) ${item.sliced ? "scale(1.2)" : "scale(1)"}` }}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 border-4 border-white shadow-2xl grid place-items-center text-4xl sm:text-5xl">{item.emoji}</div>
              <div className="mt-1 rounded-full bg-slate-950/80 px-2 py-0.5 text-center text-xs font-black uppercase">{item.label}</div>
            </div>
          ))}

          {trail.map(point => (
            <div
              key={point.id}
              className="absolute z-40 w-6 h-6 rounded-full bg-white/75 blur-[1px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{left:`${point.x}%`, top:`${point.y}%`}}
            />
          ))}

          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/65 px-4 py-2 font-black text-sm sm:text-base whitespace-nowrap">
            {mission.target.emoji} {mission.prompt}
          </div>

          {missionComplete && (
            <div className="absolute inset-0 z-50 bg-slate-950/70 grid place-items-center p-5">
              <div className="w-full max-w-md rounded-[2rem] bg-white text-slate-950 p-6 text-center shadow-2xl">
                <div className="text-7xl">🎉</div>
                <h2 className="text-3xl font-black mt-2">Mission Complete!</h2>
                <p className="font-bold text-slate-600 mt-2">You sliced all the {mission.target.label}s.</p>
                <button type="button" onClick={nextMission} className="mt-5 w-full min-h-14 rounded-2xl bg-violet-600 text-white font-black">Next Mission →</button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-xl bg-white/5 p-3 text-center text-sm font-black text-white/65">
          Swipe through only {mission.target.emoji} {mission.target.label}s. Wrong objects cost a heart.
        </div>
      </div>
    </div>
  );
}
