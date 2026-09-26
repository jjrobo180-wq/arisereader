import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Gauge, Heart, RotateCcw, Star, Volume2 } from "lucide-react";
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
  action: string;
  target: Thing;
  distractors: Thing[];
  goal: number;
};

type FallingThing = Thing & {
  id: number;
  lane: number;
  y: number;
  isTarget: boolean;
  handled: boolean;
};

const MISSIONS: Mission[] = [
  {
    action: "Rescue all the cats",
    target: { label: "cat", emoji: "🐱" },
    distractors: [
      { label: "dog", emoji: "🐶" },
      { label: "rabbit", emoji: "🐰" },
      { label: "lion", emoji: "🦁" },
      { label: "frog", emoji: "🐸" },
      { label: "pig", emoji: "🐷" },
    ],
    goal: 7,
  },
  {
    action: "Catch all the apples",
    target: { label: "apple", emoji: "🍎" },
    distractors: [
      { label: "banana", emoji: "🍌" },
      { label: "orange", emoji: "🍊" },
      { label: "grapes", emoji: "🍇" },
      { label: "strawberry", emoji: "🍓" },
      { label: "watermelon", emoji: "🍉" },
    ],
    goal: 7,
  },
  {
    action: "Rescue all the dogs",
    target: { label: "dog", emoji: "🐶" },
    distractors: [
      { label: "cat", emoji: "🐱" },
      { label: "bear", emoji: "🐻" },
      { label: "monkey", emoji: "🐵" },
      { label: "cow", emoji: "🐮" },
      { label: "fox", emoji: "🦊" },
    ],
    goal: 7,
  },
  {
    action: "Catch all the stars",
    target: { label: "star", emoji: "⭐" },
    distractors: [
      { label: "heart", emoji: "❤️" },
      { label: "moon", emoji: "🌙" },
      { label: "sun", emoji: "☀️" },
      { label: "cloud", emoji: "☁️" },
      { label: "rainbow", emoji: "🌈" },
    ],
    goal: 7,
  },
  {
    action: "Catch all the books",
    target: { label: "book", emoji: "📘" },
    distractors: [
      { label: "pencil", emoji: "✏️" },
      { label: "backpack", emoji: "🎒" },
      { label: "scissors", emoji: "✂️" },
      { label: "ruler", emoji: "📏" },
      { label: "paint", emoji: "🎨" },
    ],
    goal: 7,
  },
  {
    action: "Catch all the soccer balls",
    target: { label: "soccer ball", emoji: "⚽" },
    distractors: [
      { label: "basketball", emoji: "🏀" },
      { label: "football", emoji: "🏈" },
      { label: "baseball", emoji: "⚾" },
      { label: "tennis ball", emoji: "🎾" },
      { label: "balloon", emoji: "🎈" },
    ],
    goal: 7,
  },
];

const SPEED = {
  easy: { fall: 0.72, spawn: 930, label: "Easy", description: "Slower movement · more response time" },
  medium: { fall: 1.05, spawn: 690, label: "Medium", description: "Steady speed" },
  hard: { fall: 1.52, spawn: 460, label: "Hard", description: "Fast movement · quick response" },
} as const;

const BUDDY_EMOJI: Record<BuddyPreset, string> = {
  puppy: "🐶",
  dino: "🦕",
  robot: "🤖",
  bunny: "🐰",
};

function celebrationLine(label: string) {
  const options = [
    `Got a ${label}!`,
    `Yes! ${label}!`,
    `You got the ${label}!`,
    `Great catch! ${label}!`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

export default function ReadingRunnerPro({
  onBack,
  buddy,
}: {
  onBack: () => void;
  buddy: BuddyConfig;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [started, setStarted] = useState(false);
  const [missionIndex, setMissionIndex] = useState(0);
  const [lane, setLane] = useState(1);
  const [jumping, setJumping] = useState(false);
  const [things, setThings] = useState<FallingThing[]>([]);
  const [caught, setCaught] = useState(0);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [message, setMessage] = useState("Swipe to move. Swipe up to jump.");
  const [flash, setFlash] = useState<"good" | "wrong" | null>(null);
  const [missionComplete, setMissionComplete] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const nextId = useRef(1);
  const laneRef = useRef(lane);
  const jumpingRef = useRef(jumping);
  const heartsRef = useRef(hearts);
  const caughtRef = useRef(caught);
  const startedRef = useRef(started);
  const missionCompleteRef = useRef(missionComplete);
  const gameOverRef = useRef(gameOver);
  const mission = MISSIONS[missionIndex % MISSIONS.length];
  const speed = SPEED[difficulty];

  useEffect(() => { laneRef.current = lane; }, [lane]);
  useEffect(() => { jumpingRef.current = jumping; }, [jumping]);
  useEffect(() => { heartsRef.current = hearts; }, [hearts]);
  useEffect(() => { caughtRef.current = caught; }, [caught]);
  useEffect(() => { startedRef.current = started; }, [started]);
  useEffect(() => { missionCompleteRef.current = missionComplete; }, [missionComplete]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);

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
    const text = `${mission.action}. Swipe left or right to move. Swipe up to jump over things you do not want.`;
    setMessage(mission.action + "!");
    say(text, difficulty === "easy");
  }, [mission, say, difficulty]);

  const jump = useCallback(() => {
    if (!startedRef.current || gameOverRef.current || missionCompleteRef.current || jumpingRef.current) return;
    setJumping(true);
    jumpingRef.current = true;
    window.setTimeout(() => {
      setJumping(false);
      jumpingRef.current = false;
    }, difficulty === "hard" ? 520 : 650);
  }, [difficulty]);

  const moveLane = useCallback((direction: -1 | 1) => {
    if (!startedRef.current || gameOverRef.current || missionCompleteRef.current) return;
    setLane(current => Math.max(0, Math.min(2, current + direction)));
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") moveLane(-1);
      if (event.key === "ArrowRight") moveLane(1);
      if (event.key === "ArrowUp" || event.key === " ") {
        event.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [moveLane, jump]);

  useEffect(() => {
    if (!started || gameOver || missionComplete) return;
    announceMission();
  }, [started, gameOver, missionComplete, missionIndex, announceMission]);

  useEffect(() => {
    if (!started || gameOver || missionComplete) return;
    const timer = window.setInterval(() => {
      const isTarget = Math.random() < 0.48;
      const source = isTarget
        ? mission.target
        : mission.distractors[Math.floor(Math.random() * mission.distractors.length)];
      setThings(current => [
        ...current.filter(item => item.y < 105),
        {
          ...source,
          id: nextId.current++,
          lane: Math.floor(Math.random() * 3),
          y: -10,
          isTarget,
          handled: false,
        },
      ]);
    }, speed.spawn);
    return () => window.clearInterval(timer);
  }, [started, gameOver, missionComplete, mission, speed.spawn]);

  useEffect(() => {
    if (!started || gameOver || missionComplete) return;
    const timer = window.setInterval(() => {
      let caughtThisTick: FallingThing | null = null;
      let wrongThisTick: FallingThing | null = null;

      setThings(current => current
        .map(item => {
          const nextY = item.y + speed.fall;
          if (
            !item.handled &&
            nextY >= 78 &&
            nextY <= 94 &&
            item.lane === laneRef.current &&
            !jumpingRef.current
          ) {
            if (item.isTarget) caughtThisTick = item;
            else wrongThisTick = item;
            return { ...item, y: nextY, handled: true };
          }
          return { ...item, y: nextY };
        })
        .filter(item => item.y < 108 && !(item.handled && item.y > 96)));

      if (caughtThisTick) {
        const item = caughtThisTick as FallingThing;
        const nextCaught = caughtRef.current + 1;
        caughtRef.current = nextCaught;
        setCaught(nextCaught);
        setScore(value => value + (difficulty === "hard" ? 30 : difficulty === "medium" ? 20 : 10));
        setFlash("good");
        const line = celebrationLine(item.label);
        setMessage(line);
        say(line);
        window.setTimeout(() => setFlash(null), 320);

        if (nextCaught >= mission.goal) {
          missionCompleteRef.current = true;
          setMissionComplete(true);
          setThings([]);
          setMessage(`Mission complete! You found all the ${mission.target.label}s!`);
          say(`Mission complete! You found all the ${mission.target.label}s! Great job!`);
        }
      }

      if (wrongThisTick) {
        const item = wrongThisTick as FallingThing;
        const nextHearts = Math.max(0, heartsRef.current - 1);
        heartsRef.current = nextHearts;
        setHearts(nextHearts);
        setFlash("wrong");
        setMessage(`That is a ${item.label}. Find the ${mission.target.label}s!`);
        say(`That is a ${item.label}. Keep looking for ${mission.target.label}s.`, true);
        window.setTimeout(() => setFlash(null), 350);
        if (nextHearts <= 0) {
          gameOverRef.current = true;
          setGameOver(true);
          setStarted(false);
          setThings([]);
          say("Nice try! Let's play again and find only the target.");
        }
      }
    }, 32);

    return () => window.clearInterval(timer);
  }, [started, gameOver, missionComplete, speed.fall, difficulty, mission, say]);

  useEffect(() => () => stopSpeaking(), []);

  const startGame = () => {
    stopSpeaking();
    setStarted(true);
    startedRef.current = true;
    setGameOver(false);
    gameOverRef.current = false;
    setMissionComplete(false);
    missionCompleteRef.current = false;
    setMissionIndex(0);
    setCaught(0);
    caughtRef.current = 0;
    setScore(0);
    setHearts(3);
    heartsRef.current = 3;
    setLane(1);
    setThings([]);
    setMessage("Get ready!");
  };

  const nextMission = () => {
    const next = (missionIndex + 1) % MISSIONS.length;
    setMissionIndex(next);
    setCaught(0);
    caughtRef.current = 0;
    setHearts(3);
    heartsRef.current = 3;
    setLane(1);
    setThings([]);
    setMissionComplete(false);
    missionCompleteRef.current = false;
    setMessage("New mission!");
  };

  const swipeEnd = (x: number, y: number) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 24) return;
    if (absY > absX && dy < 0) jump();
    else if (absX >= absY && dx < 0) moveLane(-1);
    else if (absX >= absY && dx > 0) moveLane(1);
  };

  const playerLeft = ["16.66%", "50%", "83.33%"][lane];
  const buddyVisual = buddy.type === "upload" && buddy.imageData
    ? <img src={buddy.imageData} alt={buddy.name} className="w-full h-full object-cover rounded-full" />
    : <span>{BUDDY_EMOJI[buddy.preset] || "🐶"}</span>;

  const progress = Math.min(100, (caught / mission.goal) * 100);

  if (!started && !gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-950 via-violet-950 to-slate-950 text-white px-4 py-5">
        <div className="max-w-5xl mx-auto">
          <button type="button" onClick={onBack} className="min-h-12 px-4 rounded-2xl bg-white/10 font-black flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Games
          </button>

          <div className="mt-6 rounded-[2.2rem] border border-white/15 bg-white/10 p-6 sm:p-9 overflow-hidden relative">
            <div className="absolute right-4 bottom-[-30px] text-[160px] opacity-15">🏃</div>
            <div className="relative max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 border border-cyan-200/30 px-3 py-1 text-xs font-black uppercase tracking-widest text-cyan-200">
                Swipe runner · no answer buttons
              </div>
              <h1 className="text-4xl sm:text-6xl font-black mt-4">Reading Runner</h1>
              <p className="text-lg sm:text-xl font-bold text-white/75 mt-3">
                Listen to the mission, move into the right objects, and jump over the wrong ones.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mt-7">
                {(Object.keys(SPEED) as Difficulty[]).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`rounded-2xl border-2 p-4 text-left min-h-24 ${difficulty === level ? "border-cyan-300 bg-cyan-300/15" : "border-white/15 bg-white/5"}`}
                  >
                    <div className="font-black text-xl">{SPEED[level].label}</div>
                    <div className="text-sm text-white/65 mt-1">{SPEED[level].description}</div>
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mt-5 text-center font-black">
                <div className="rounded-2xl bg-white/8 p-4">👈 Swipe left/right<br/><span className="text-xs text-white/60">Change lanes</span></div>
                <div className="rounded-2xl bg-white/8 p-4">👆 Swipe up<br/><span className="text-xs text-white/60">Jump over wrong items</span></div>
                <div className="rounded-2xl bg-white/8 p-4">🎯 Run into targets<br/><span className="text-xs text-white/60">Collect what the voice asks for</span></div>
              </div>

              <button type="button" onClick={startGame} className="mt-6 w-full min-h-16 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 text-xl font-black">
                Start Runner
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
          <div className="text-7xl">🏁</div>
          <h1 className="text-4xl font-black mt-3">Great running!</h1>
          <p className="text-xl font-bold text-white/70 mt-2">Score: {score}</p>
          <button type="button" onClick={startGame} className="mt-6 w-full min-h-14 rounded-2xl bg-cyan-400 text-slate-950 font-black flex items-center justify-center gap-2">
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
            <div className="text-xs uppercase tracking-widest font-black text-cyan-300">{SPEED[difficulty].label} · swipe controls</div>
            <div className="text-xl sm:text-2xl font-black">{mission.action}</div>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-rose-500/15 px-3 py-2">{Array.from({length:3}).map((_,i)=><Heart key={i} className={`w-5 h-5 ${i < hearts ? "fill-rose-400 text-rose-400" : "text-white/20"}`} />)}</div>
          <div className="rounded-xl bg-amber-400/15 text-amber-300 px-3 py-2 font-black"><Star className="w-4 h-4 inline fill-current mr-1" />{score}</div>
        </div>

        <div className="rounded-2xl bg-white/10 border border-white/10 p-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/10 grid place-items-center text-3xl overflow-hidden flex-shrink-0">{buddyVisual}</div>
            <div className="flex-1 min-w-0">
              <div className="font-black truncate">{message}</div>
              <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full bg-cyan-400 transition-all" style={{width:`${progress}%`}} /></div>
              <div className="text-xs font-bold text-white/55 mt-1">{caught} / {mission.goal} {mission.target.label}{mission.goal === 1 ? "" : "s"}</div>
            </div>
            <button type="button" onClick={announceMission} className="w-11 h-11 rounded-xl bg-white/10 grid place-items-center" aria-label="Repeat mission"><Volume2 className="w-5 h-5" /></button>
          </div>
        </div>

        <div
          className={`relative overflow-hidden rounded-[2rem] border-4 ${flash === "good" ? "border-emerald-400" : flash === "wrong" ? "border-rose-400" : "border-white/10"} bg-gradient-to-b from-sky-500 via-sky-300 to-emerald-200 touch-none`}
          style={{ height: "min(68vh, 720px)", minHeight: 520 }}
          onPointerDown={event => { touchStart.current = { x: event.clientX, y: event.clientY }; }}
          onPointerUp={event => swipeEnd(event.clientX, event.clientY)}
          onPointerCancel={() => { touchStart.current = null; }}
        >
          <div className="absolute inset-x-0 top-0 h-[45%] opacity-70" style={{background:"linear-gradient(to bottom, rgba(255,255,255,.25), transparent)"}} />
          <div className="absolute left-[33.33%] top-0 bottom-0 w-[2px] bg-white/30" />
          <div className="absolute left-[66.66%] top-0 bottom-0 w-[2px] bg-white/30" />
          <div className="absolute inset-x-0 bottom-0 h-[20%] bg-gradient-to-t from-emerald-700/50 to-transparent" />

          {things.map(item => (
            <div
              key={item.id}
              className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-75 ${item.handled ? "opacity-30 scale-75" : ""}`}
              style={{
                left: [ "16.66%", "50%", "83.33%" ][item.lane],
                top: `${item.y}%`,
              }}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/90 border-4 border-white shadow-xl grid place-items-center text-4xl sm:text-5xl">
                {item.emoji}
              </div>
              <div className="mt-1 rounded-full bg-slate-950/80 px-2 py-0.5 text-center text-xs font-black uppercase">{item.label}</div>
            </div>
          ))}

          <div
            className="absolute z-30 -translate-x-1/2 transition-[left] duration-150 ease-out"
            style={{ left: playerLeft, bottom: "6%" }}
          >
            <div className={`w-20 h-24 sm:w-24 sm:h-28 transition-transform duration-200 ${jumping ? "-translate-y-32 rotate-[-8deg]" : ""}`}>
              <div className="text-6xl sm:text-7xl drop-shadow-xl">🏃</div>
            </div>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/65 px-4 py-2 font-black text-sm sm:text-base whitespace-nowrap">
            {mission.target.emoji} {mission.action}
          </div>

          {missionComplete && (
            <div className="absolute inset-0 z-50 bg-slate-950/70 grid place-items-center p-5">
              <div className="w-full max-w-md rounded-[2rem] bg-white text-slate-950 p-6 text-center shadow-2xl">
                <div className="text-7xl">🎉</div>
                <h2 className="text-3xl font-black mt-2">Mission Complete!</h2>
                <p className="font-bold text-slate-600 mt-2">You found all the {mission.target.label}s.</p>
                <button type="button" onClick={nextMission} className="mt-5 w-full min-h-14 rounded-2xl bg-violet-600 text-white font-black">Next Mission →</button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm font-black text-white/65">
          <div className="rounded-xl bg-white/5 p-2">← Swipe left</div>
          <div className="rounded-xl bg-white/5 p-2">↑ Swipe up to jump</div>
          <div className="rounded-xl bg-white/5 p-2">Swipe right →</div>
        </div>
      </div>
    </div>
  );
}
