import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { ArrowLeft, CheckCircle2, Home, MapPin, Sparkles, Star, Volume2 } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type SceneId = "kitchen" | "bedroom" | "bathroom" | "zoo" | "park";
type PlayMode = "explore" | "find" | "phrase";
type BuddyPreset = "puppy" | "dino" | "robot" | "bunny";

type BuddyConfig = {
  type: "preset" | "upload";
  preset: BuddyPreset;
  name: string;
  imageData: string | null;
  voiceEnabled: boolean;
  calmMode?: boolean;
};

type LearningItem = {
  id: string;
  word: string;
  emoji: string;
  phrase: string;
  x: number;
  y: number;
  size?: number;
};

type Scene = {
  id: SceneId;
  name: string;
  icon: string;
  subtitle: string;
  items: LearningItem[];
};

const DEFAULT_BUDDY: BuddyConfig = {
  type: "preset",
  preset: "puppy",
  name: "Buddy",
  imageData: null,
  voiceEnabled: true,
  calmMode: false,
};

const BUDDY_EMOJI: Record<BuddyPreset, string> = {
  puppy: "🐶",
  dino: "🦖",
  robot: "🤖",
  bunny: "🐰",
};

const SCENES: Scene[] = [
  {
    id: "kitchen",
    name: "My Kitchen",
    icon: "🏠",
    subtitle: "Food, drinks, and things we use at home",
    items: [
      { id: "milk", word: "milk", emoji: "🥛", phrase: "I want milk.", x: 72, y: 43, size: 64 },
      { id: "apple", word: "apple", emoji: "🍎", phrase: "I want an apple.", x: 49, y: 54, size: 62 },
      { id: "cup", word: "cup", emoji: "🥤", phrase: "This is my cup.", x: 36, y: 55, size: 60 },
      { id: "spoon", word: "spoon", emoji: "🥄", phrase: "I have a spoon.", x: 58, y: 57, size: 58 },
      { id: "fridge", word: "fridge", emoji: "🧊", phrase: "Open the fridge.", x: 81, y: 42, size: 58 },
    ],
  },
  {
    id: "bedroom",
    name: "My Bedroom",
    icon: "🛏️",
    subtitle: "Things we see and use in a bedroom",
    items: [
      { id: "bed", word: "bed", emoji: "🛏️", phrase: "This is my bed.", x: 31, y: 58, size: 78 },
      { id: "book", word: "book", emoji: "📘", phrase: "Read my book.", x: 57, y: 51, size: 64 },
      { id: "shoes", word: "shoes", emoji: "👟", phrase: "Put on shoes.", x: 67, y: 70, size: 62 },
      { id: "shirt", word: "shirt", emoji: "👕", phrase: "This is my shirt.", x: 82, y: 43, size: 66 },
      { id: "lamp", word: "lamp", emoji: "💡", phrase: "Turn on the lamp.", x: 47, y: 38, size: 58 },
    ],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    icon: "🪥",
    subtitle: "Words for getting clean and ready",
    items: [
      { id: "toothbrush", word: "toothbrush", emoji: "🪥", phrase: "Brush my teeth.", x: 41, y: 50, size: 64 },
      { id: "soap", word: "soap", emoji: "🧼", phrase: "Wash with soap.", x: 54, y: 53, size: 62 },
      { id: "water", word: "water", emoji: "💧", phrase: "Turn on water.", x: 48, y: 43, size: 58 },
      { id: "towel", word: "towel", emoji: "🧺", phrase: "Get the towel.", x: 76, y: 45, size: 66 },
      { id: "toilet", word: "toilet", emoji: "🚽", phrase: "Use the toilet.", x: 77, y: 67, size: 76 },
    ],
  },
  {
    id: "zoo",
    name: "At the Zoo",
    icon: "🦁",
    subtitle: "Animal words and simple 'I see...' phrases",
    items: [
      { id: "lion", word: "lion", emoji: "🦁", phrase: "I see a lion.", x: 26, y: 54, size: 78 },
      { id: "elephant", word: "elephant", emoji: "🐘", phrase: "I see an elephant.", x: 50, y: 56, size: 82 },
      { id: "monkey", word: "monkey", emoji: "🐒", phrase: "I see a monkey.", x: 71, y: 43, size: 72 },
      { id: "giraffe", word: "giraffe", emoji: "🦒", phrase: "I see a giraffe.", x: 84, y: 53, size: 86 },
      { id: "zebra", word: "zebra", emoji: "🦓", phrase: "I see a zebra.", x: 40, y: 73, size: 76 },
    ],
  },
  {
    id: "park",
    name: "At the Park",
    icon: "🛝",
    subtitle: "Play words, people words, and action phrases",
    items: [
      { id: "ball", word: "ball", emoji: "⚽", phrase: "I want the ball.", x: 31, y: 69, size: 66 },
      { id: "slide", word: "slide", emoji: "🛝", phrase: "Go down the slide.", x: 53, y: 51, size: 80 },
      { id: "tree", word: "tree", emoji: "🌳", phrase: "I see a tree.", x: 78, y: 43, size: 92 },
      { id: "dog", word: "dog", emoji: "🐶", phrase: "I see a dog.", x: 72, y: 70, size: 72 },
      { id: "flower", word: "flower", emoji: "🌼", phrase: "I see a flower.", x: 19, y: 48, size: 64 },
    ],
  },
];

function cookieToken() {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

function DwellButton({
  children,
  onSelect,
  className = "",
  disabled,
  label,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  className?: string;
  disabled?: boolean;
  label: string;
}) {
  const timer = useRef<number | null>(null);
  const [dwelling, setDwelling] = useState(false);

  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setDwelling(false);
  };

  const start = () => {
    if (disabled) return;
    stop();
    setDwelling(true);
    timer.current = window.setTimeout(() => {
      stop();
      onSelect();
    }, 1100);
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        stop();
        onSelect();
      }}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      className={`dwell-button ${dwelling ? "dwelling" : ""} ${className}`}
    >
      {children}
      <span className="dwell-progress" />
    </button>
  );
}

function BuddyCharacter({
  buddy,
  x,
  y,
  talking,
  pointing,
}: {
  buddy: BuddyConfig;
  x: number;
  y: number;
  talking: boolean;
  pointing: boolean;
}) {
  return (
    <div
      className="absolute z-40 pointer-events-none buddy-mover"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="relative -translate-x-1/2 -translate-y-full">
        <div className={`buddy-body ${talking ? "talking" : ""}`}>
          {buddy.type === "upload" && buddy.imageData ? (
            <img src={buddy.imageData} alt={buddy.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-xl bg-white" />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-100 to-amber-300 border-4 border-white shadow-xl flex items-center justify-center text-5xl sm:text-6xl">
              {BUDDY_EMOJI[buddy.preset]}
            </div>
          )}
          <div className={`buddy-mouth ${talking ? "mouth-moving" : ""}`} />
        </div>
        {pointing && (
          <div className="absolute -right-14 top-7 flex items-center buddy-pointer">
            <div className="w-10 h-3 rounded-full bg-amber-300 rotate-[12deg]" />
            <span className="text-3xl -ml-1">👉</span>
          </div>
        )}
        <div className="mt-1 mx-auto w-max max-w-[120px] truncate rounded-full bg-white/95 px-3 py-1 text-[11px] font-black text-violet-700 shadow">
          {buddy.name}
        </div>
      </div>
    </div>
  );
}

function SceneBackground({ scene }: { scene: SceneId }) {
  if (scene === "kitchen") {
    return (
      <>
        <div className="absolute inset-0 bg-gradient-to-b from-[#fff6df] via-[#fffaf0] to-[#dec3a5]" />
        <div className="absolute inset-x-0 top-0 h-[18%] bg-[#f6d9a6] border-b-8 border-white/70" />
        <div className="absolute left-[7%] top-[18%] w-[24%] h-[18%] bg-[#b7794c] rounded-b-xl shadow-lg grid grid-cols-2 gap-1 p-2">
          <div className="bg-[#d4a574] rounded" /><div className="bg-[#d4a574] rounded" /><div className="bg-[#d4a574] rounded" /><div className="bg-[#d4a574] rounded" />
        </div>
        <div className="absolute left-[8%] right-[34%] top-[45%] h-[17%] rounded-t-2xl bg-[#b7794c] border-t-[10px] border-[#f1d5b5] shadow-xl" />
        <div className="absolute left-[31%] top-[28%] w-[18%] h-[16%] rounded-2xl bg-sky-100 border-[8px] border-white shadow-inner">
          <div className="absolute inset-x-2 top-1/2 border-t-4 border-white" />
          <div className="absolute inset-y-2 left-1/2 border-l-4 border-white" />
        </div>
        <div className="absolute right-[7%] top-[18%] w-[20%] h-[49%] rounded-2xl bg-gradient-to-br from-slate-100 to-slate-300 border-4 border-white shadow-xl">
          <div className="absolute left-1/2 top-0 bottom-0 border-l-2 border-slate-400/60" />
          <div className="absolute left-4 top-1/2 w-4 h-10 rounded-full bg-slate-500" />
          <div className="absolute right-4 top-1/2 w-4 h-10 rounded-full bg-slate-500" />
          <div className="absolute left-[15%] right-[15%] top-[18%] bottom-[48%] rounded-xl bg-cyan-50/80 border-2 border-cyan-100">
            <div className="absolute inset-x-2 top-1/2 border-t-2 border-cyan-200" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[35%] kitchen-floor" />
      </>
    );
  }

  if (scene === "bedroom") {
    return (
      <>
        <div className="absolute inset-0 bg-gradient-to-b from-[#e8e7ff] to-[#fdf7ff]" />
        <div className="absolute left-[8%] top-[25%] w-[34%] h-[35%] rounded-[2rem] bg-[#7c3aed] shadow-2xl">
          <div className="absolute left-4 right-4 top-4 h-[28%] rounded-2xl bg-white/90" />
          <div className="absolute left-4 right-4 bottom-4 top-[35%] rounded-xl bg-[#a78bfa]" />
        </div>
        <div className="absolute left-[46%] top-[20%] w-[18%] h-[23%] rounded-2xl bg-sky-100 border-[8px] border-white shadow-inner">
          <div className="absolute inset-x-2 top-1/2 border-t-4 border-white" />
          <div className="absolute inset-y-2 left-1/2 border-l-4 border-white" />
        </div>
        <div className="absolute right-[8%] top-[17%] w-[18%] h-[48%] rounded-2xl bg-[#8b5e3c] shadow-xl">
          <div className="grid grid-cols-2 gap-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 rounded bg-[#c69b78]" />)}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[33%] bedroom-floor" />
      </>
    );
  }

  if (scene === "bathroom") {
    return (
      <>
        <div className="absolute inset-0 bathroom-wall" />
        <div className="absolute left-[28%] top-[20%] w-[34%] h-[18%] rounded-3xl bg-cyan-100 border-[8px] border-white shadow-xl" />
        <div className="absolute left-[31%] top-[43%] w-[30%] h-[19%] rounded-b-[2rem] bg-white border-4 border-slate-200 shadow-xl">
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 w-16 h-11 rounded-t-full border-[8px] border-slate-400 border-b-0" />
        </div>
        <div className="absolute right-[8%] top-[24%] w-[22%] h-[20%] rounded-xl bg-[#60a5fa] shadow-xl">
          <div className="absolute inset-x-4 top-1/2 border-t-4 border-white/70" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[33%] bathroom-floor" />
      </>
    );
  }

  if (scene === "zoo") {
    return (
      <>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-200" />
        <div className="absolute top-[8%] left-[10%] text-7xl opacity-80">☁️</div>
        <div className="absolute top-[13%] right-[14%] text-6xl opacity-80">☁️</div>
        <div className="absolute left-0 right-0 bottom-0 h-[45%] bg-gradient-to-b from-emerald-300 to-emerald-500" />
        <div className="absolute left-[6%] right-[6%] top-[37%] h-[33%] rounded-[2rem] border-[8px] border-[#8b5e3c] bg-[#c7e9a6]/70 shadow-inner">
          <div className="absolute inset-0 zoo-fence opacity-45" />
        </div>
        <div className="absolute left-[44%] top-[18%] rounded-2xl bg-amber-100 border-4 border-amber-600 px-7 py-3 font-black text-amber-900 shadow-lg">WELCOME TO THE ZOO</div>
        <div className="absolute left-[4%] bottom-[8%] text-[110px]">🌳</div>
        <div className="absolute right-[3%] bottom-[6%] text-[120px]">🌳</div>
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-100 to-green-200" />
      <div className="absolute left-0 right-0 bottom-0 h-[48%] bg-gradient-to-b from-green-300 to-green-500" />
      <div className="absolute left-[4%] bottom-[18%] text-[110px]">🌳</div>
      <div className="absolute right-[5%] bottom-[15%] text-[120px]">🌳</div>
      <div className="absolute left-[38%] bottom-[18%] w-[30%] h-[22%] rounded-[2rem] bg-amber-200 border-[8px] border-amber-500 shadow-xl" />
      <div className="absolute left-[44%] bottom-[23%] text-7xl">🛝</div>
      <div className="absolute top-[10%] right-[18%] text-6xl opacity-75">☁️</div>
    </>
  );
}

export default function EyeGazeBuddyWorld() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [buddy, setBuddy] = useState<BuddyConfig>(DEFAULT_BUDDY);
  const [sceneId, setSceneId] = useState<SceneId>("kitchen");
  const [mode, setMode] = useState<PlayMode>("explore");
  const [targetId, setTargetId] = useState("milk");
  const [buddyPos, setBuddyPos] = useState({ x: 18, y: 78 });
  const [talking, setTalking] = useState(false);
  const [pointing, setPointing] = useState(false);
  const [message, setMessage] = useState("Pick something to learn!");
  const [phraseChoices, setPhraseChoices] = useState<string[]>([]);
  const [stars, setStars] = useState(0);
  const [learned, setLearned] = useState<Record<string, boolean>>({});
  const [sceneMenu, setSceneMenu] = useState(true);

  const scene = useMemo(() => SCENES.find(s => s.id === sceneId) || SCENES[0], [sceneId]);
  const target = scene.items.find(item => item.id === targetId) || scene.items[0];

  useEffect(() => {
    const key = `buddy-world-progress-${user?.id || user?.username || "student"}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      setStars(Number(saved.stars || 0));
      setLearned(saved.learned || {});
    } catch {}
  }, [user?.id, user?.username]);

  useEffect(() => {
    const key = `buddy-world-progress-${user?.id || user?.username || "student"}`;
    localStorage.setItem(key, JSON.stringify({ stars, learned }));
  }, [stars, learned, user?.id, user?.username]);

  useEffect(() => {
    const authToken = token || cookieToken();
    if (!authToken || !user?.is_eye_gaze_user) return;
    fetch(`${API_BASE}/api/eye-gaze/learning-buddy`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setBuddy({ ...DEFAULT_BUDDY, ...data });
      })
      .catch(() => {});
  }, [token, user?.is_eye_gaze_user]);

  useEffect(() => () => stopSpeaking(), []);

  const speak = (text: string) => {
    if (!buddy.voiceEnabled) return;
    setTalking(true);
    void speakCharacterAI(text, {
      calmMode: !!buddy.calmMode,
      onStart: () => setTalking(true),
      onEnd: () => setTalking(false),
      onFallback: () => setTalking(false),
    });
  };

  const makePhraseChoices = (item: LearningItem) => {
    const alternatives = scene.items
      .filter(other => other.id !== item.id)
      .map(other => other.phrase)
      .slice(0, 2);
    const mixed = [item.phrase, ...alternatives];
    return mixed.sort(() => .5 - Math.random());
  };

  const chooseNewTarget = (currentId?: string) => {
    const options = scene.items.filter(item => item.id !== currentId);
    const next = options[Math.floor(Math.random() * options.length)] || scene.items[0];
    setTargetId(next.id);
    setPhraseChoices(makePhraseChoices(next));
    setBuddyPos({ x: 18, y: 78 });
    setPointing(false);
    const prompt = mode === "phrase" ? `Find ${next.word}. Then choose the words.` : `Find ${next.word}.`;
    setMessage(prompt);
    speak(prompt);
  };

  const openScene = (id: SceneId) => {
    stopSpeaking();
    const nextScene = SCENES.find(s => s.id === id) || SCENES[0];
    setSceneId(id);
    setSceneMenu(false);
    setBuddyPos({ x: 18, y: 78 });
    setPointing(false);
    const first = nextScene.items[0];
    setTargetId(first.id);
    setPhraseChoices(makePhraseChoices(first));
    const hello = mode === "explore"
      ? `Welcome to ${nextScene.name}. Pick something to learn.`
      : mode === "find"
        ? `Welcome to ${nextScene.name}. Find ${first.word}.`
        : `Welcome to ${nextScene.name}. Find ${first.word}, then choose the words.`;
    setMessage(hello);
    window.setTimeout(() => speak(hello), 250);
  };

  const selectItem = (item: LearningItem) => {
    setBuddyPos({ x: Math.max(10, Math.min(90, item.x - 9)), y: Math.max(30, Math.min(82, item.y + 8)) });
    setPointing(true);

    if (mode === "explore") {
      setLearned(prev => ({ ...prev, [`${scene.id}:${item.id}`]: true }));
      setMessage(`${item.word}. ${item.phrase}`);
      speak(`${item.word}. ${item.phrase}`);
      return;
    }

    if (item.id !== target.id) {
      setMessage(`That is ${item.word}. Find ${target.word}.`);
      speak(`That is ${item.word}. Find ${target.word}.`);
      return;
    }

    setLearned(prev => ({ ...prev, [`${scene.id}:${item.id}`]: true }));
    setStars(value => value + 1);

    if (mode === "find") {
      setMessage(`Yes! ${item.word}. ${item.phrase}`);
      speak(`Yes! ${item.word}. ${item.phrase}`);
      window.setTimeout(() => chooseNewTarget(item.id), 1700);
      return;
    }

    const choices = makePhraseChoices(item);
    setPhraseChoices(choices);
    setMessage(`Yes! ${item.word}. Now choose: ${item.phrase}`);
    speak(`Yes! ${item.word}. Now choose the words: ${item.phrase}`);
  };

  const choosePhrase = (phrase: string) => {
    if (phrase !== target.phrase) {
      setMessage("Try another one.");
      speak("Try another one.");
      return;
    }
    setStars(value => value + 1);
    setMessage(`Great! ${phrase}`);
    speak(`Great! ${phrase}`);
    window.setTimeout(() => chooseNewTarget(target.id), 1800);
  };

  if (!user?.is_eye_gaze_user) return <Redirect to="/library" />;

  if (sceneMenu) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-violet-100 px-4 py-5 text-slate-900">
        <style>{styles}</style>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/eye-gaze-games")} className="min-h-[50px] rounded-2xl bg-white border border-slate-200 px-4 font-black flex items-center gap-2 shadow-sm">
              <ArrowLeft className="w-5 h-5" /> Games
            </button>
            <div className="ml-auto rounded-2xl bg-amber-100 border border-amber-200 px-4 py-2 font-black text-amber-700 flex items-center gap-2">
              <Star className="w-5 h-5 fill-current" /> {stars}
            </div>
          </div>

          <div className="mt-5 relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-violet-600 via-fuchsia-500 to-sky-500 p-6 sm:p-8 text-white shadow-2xl min-h-[240px]">
            <div className="absolute right-6 bottom-[-18px] text-[130px] opacity-20">🏠</div>
            <div className="relative max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest">
                <Sparkles className="w-4 h-4" /> Early Learning World
              </div>
              <h1 className="mt-4 text-4xl sm:text-5xl font-black">Buddy World</h1>
              <p className="mt-3 text-lg font-bold text-white/85">Explore familiar places, learn useful words, and build tiny phrases with {buddy.name}.</p>
            </div>
          </div>

          <section className="mt-5 rounded-[2rem] bg-white border-2 border-violet-100 p-5 shadow-lg">
            <div className="text-xs uppercase tracking-widest font-black text-violet-600">How do you want to play?</div>
            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              {([
                ["explore", "👆", "Explore", "Pick anything. Buddy says the word and phrase."],
                ["find", "👀", "Find It", "Buddy asks for a word. Find the right thing."],
                ["phrase", "💬", "Phrase Time", "Find the thing, then choose a useful phrase."],
              ] as const).map(([id, icon, title, sub]) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`min-h-[125px] rounded-3xl border-3 p-4 text-left transition-all ${mode === id ? "border-violet-500 bg-violet-50 shadow-md -translate-y-1" : "border-slate-200 bg-slate-50"}`}
                >
                  <div className="text-3xl">{icon}</div>
                  <div className="mt-2 text-xl font-black">{title}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-500">{sub}</div>
                </button>
              ))}
            </div>
          </section>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SCENES.map(sceneOption => {
              const learnedHere = sceneOption.items.filter(item => learned[`${sceneOption.id}:${item.id}`]).length;
              return (
                <DwellButton
                  key={sceneOption.id}
                  label={`Go to ${sceneOption.name}`}
                  onSelect={() => openScene(sceneOption.id)}
                  className="min-h-[175px] rounded-[1.7rem] border-3 border-white bg-white shadow-lg hover:-translate-y-1 transition-transform p-4 text-left"
                >
                  <div className="text-5xl">{sceneOption.icon}</div>
                  <div className="mt-3 text-xl font-black">{sceneOption.name}</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">{sceneOption.subtitle}</div>
                  <div className="mt-3 text-xs font-black text-violet-600">{learnedHere}/{sceneOption.items.length} words explored</div>
                </DwellButton>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900 overflow-hidden">
      <style>{styles}</style>
      <SceneBackground scene={scene.id} />

      <div className="absolute z-50 top-3 left-3 right-3 flex items-start gap-2 pointer-events-none">
        <button onClick={() => { stopSpeaking(); setSceneMenu(true); }} className="pointer-events-auto min-h-[48px] rounded-2xl bg-white/90 text-slate-900 px-4 font-black flex items-center gap-2 shadow-lg border border-white">
          <ArrowLeft className="w-5 h-5" /> Places
        </button>
        <div className="pointer-events-auto rounded-2xl bg-white/90 text-slate-900 px-4 py-2 shadow-lg border border-white">
          <div className="text-[10px] uppercase tracking-widest font-black text-violet-600">{mode === "explore" ? "Explore" : mode === "find" ? "Find It" : "Phrase Time"}</div>
          <div className="font-black">{scene.name}</div>
        </div>
        <div className="ml-auto pointer-events-auto rounded-2xl bg-amber-100 text-amber-800 border border-amber-200 px-4 py-3 font-black flex items-center gap-2 shadow-lg">
          <Star className="w-5 h-5 fill-current" /> {stars}
        </div>
      </div>

      <div className="absolute z-50 top-[82px] left-1/2 -translate-x-1/2 w-[min(92%,720px)]">
        <div className="rounded-[1.6rem] bg-white/95 border-2 border-white shadow-xl px-4 py-3 text-center">
          <div className="text-xl sm:text-3xl font-black text-slate-900">{message}</div>
          {mode !== "explore" && (
            <button onClick={() => speak(message)} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-violet-100 text-violet-700 px-3 py-1.5 text-sm font-black">
              <Volume2 className="w-4 h-4" /> Hear Again
            </button>
          )}
        </div>
      </div>

      <BuddyCharacter buddy={buddy} x={buddyPos.x} y={buddyPos.y} talking={talking} pointing={pointing} />

      <div className="absolute inset-0 z-30">
        {scene.items.map(item => (
          <DwellButton
            key={item.id}
            label={item.word}
            onSelect={() => selectItem(item)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 object-hotspot ${learned[`${scene.id}:${item.id}`] ? "learned" : ""}`}
            disabled={false}
          >
            <div className="relative flex flex-col items-center">
              <div
                className="object-emoji"
                style={{ fontSize: `${item.size || 64}px` }}
              >
                {item.emoji}
              </div>
              <div className="object-label">{item.word}</div>
              {learned[`${scene.id}:${item.id}`] && (
                <CheckCircle2 className="absolute -top-2 -right-2 w-6 h-6 text-emerald-500 bg-white rounded-full" />
              )}
            </div>
          </DwellButton>
        ))}
      </div>

      {mode === "phrase" && phraseChoices.length > 0 && target && learned[`${scene.id}:${target.id}`] && message.includes("choose") && (
        <div className="absolute z-60 left-3 right-3 bottom-3">
          <div className="max-w-4xl mx-auto rounded-[1.7rem] bg-white/95 border-2 border-white p-3 shadow-2xl">
            <div className="text-center text-xs font-black uppercase tracking-widest text-violet-600 mb-2">Choose the words</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {phraseChoices.map(phrase => (
                <DwellButton
                  key={phrase}
                  label={phrase}
                  onSelect={() => choosePhrase(phrase)}
                  className="min-h-[72px] rounded-2xl border-3 border-violet-200 bg-violet-50 px-3 text-lg sm:text-xl font-black text-slate-900"
                >
                  {phrase}
                </DwellButton>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
  .dwell-button{position:relative;overflow:hidden}
  .dwell-progress{position:absolute;left:0;bottom:0;height:7px;width:0;background:#7c3aed;z-index:20}
  .dwell-button.dwelling .dwell-progress{animation:dwellFill 1.1s linear forwards}
  @keyframes dwellFill{from{width:0}to{width:100%}}

  .buddy-mover{transition:left .7s cubic-bezier(.2,.8,.2,1),top .7s cubic-bezier(.2,.8,.2,1)}
  .buddy-body{animation:buddyFloat 2s ease-in-out infinite}
  .buddy-body.talking{animation:buddyTalk .3s ease-in-out infinite alternate}
  .buddy-mouth{position:absolute;left:50%;bottom:15px;transform:translateX(-50%);width:18px;height:4px;border-radius:999px;background:#111827aa}
  .buddy-mouth.mouth-moving{animation:mouthMove .17s ease-in-out infinite alternate}
  .buddy-pointer{animation:pointPulse .6s ease-in-out infinite alternate}
  @keyframes buddyFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
  @keyframes buddyTalk{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-5px) rotate(2deg)}}
  @keyframes mouthMove{from{height:4px;transform:translateX(-50%) scaleX(.8)}to{height:13px;transform:translateX(-50%) scaleX(1.2)}}
  @keyframes pointPulse{from{transform:translateX(0)}to{transform:translateX(7px)}}

  .object-hotspot{
    width:120px;min-height:115px;border-radius:28px;border:4px solid rgba(255,255,255,.78);
    background:rgba(255,255,255,.72);backdrop-filter:blur(5px);box-shadow:0 13px 25px rgba(15,23,42,.16);
    display:flex;align-items:center;justify-content:center;transition:.2s;
  }
  .object-hotspot:hover,.object-hotspot:focus-visible{transform:translate(-50%,-50%) scale(1.07);outline:none;border-color:#8b5cf6}
  .object-hotspot.learned{border-color:#34d399;background:rgba(236,253,245,.86)}
  .object-emoji{filter:drop-shadow(0 8px 5px rgba(15,23,42,.18));line-height:1}
  .object-label{margin-top:6px;border-radius:999px;background:white;padding:4px 11px;font-size:15px;font-weight:1000;color:#1e293b;text-transform:lowercase;box-shadow:0 4px 9px rgba(15,23,42,.1)}

  .kitchen-floor{background:repeating-linear-gradient(90deg,#d3b48f 0 55px,#c69f76 55px 58px)}
  .bedroom-floor{background:repeating-linear-gradient(90deg,#b78a63 0 60px,#a97b56 60px 64px)}
  .bathroom-wall{background-color:#e0f2fe;background-image:linear-gradient(#bae6fd 2px,transparent 2px),linear-gradient(90deg,#bae6fd 2px,transparent 2px);background-size:55px 55px}
  .bathroom-floor{background-color:#cbd5e1;background-image:linear-gradient(#94a3b8 2px,transparent 2px),linear-gradient(90deg,#94a3b8 2px,transparent 2px);background-size:60px 60px}
  .zoo-fence{background-image:linear-gradient(60deg,transparent 46%,#8b5e3c 47%,#8b5e3c 53%,transparent 54%),linear-gradient(-60deg,transparent 46%,#8b5e3c 47%,#8b5e3c 53%,transparent 54%);background-size:35px 55px}

  @media(max-width:640px){
    .object-hotspot{width:95px;min-height:92px;border-radius:22px}
    .object-label{font-size:12px;padding:3px 8px}
    .object-emoji{transform:scale(.82)}
  }

  @media(prefers-reduced-motion:reduce){
    .buddy-body,.buddy-body.talking,.buddy-pointer{animation-duration:3s!important}
  }
`;
