import { fetchFamilySettings, pathAllowed, type ParentControls } from "@/lib/parentControls";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import EyeGazeLessons from "@/pages/EyeGazeLessons";
import EyeGazeAccessGate from "@/components/EyeGazeAccessGate";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Gamepad2, Grid2X2, CircleDot, Type, RotateCcw, Star, Eye, CheckCircle2, Upload, Volume2, VolumeX, X, Zap, Flag, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { speakCharacterAI } from "@/lib/tts";
import ReadingRunnerPro from "@/pages/ReadingRunnerPro";
import ReadingNinja from "@/pages/ReadingNinja";

type GameId = "runner" | "ninja" | "match" | "pop" | "sentence" | null;

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
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
      className={`relative min-h-[88px] rounded-2xl border-4 border-slate-300 bg-white text-slate-950 shadow-lg p-4 text-xl font-black transition-all focus:outline-none focus:ring-4 focus:ring-sky-300 disabled:opacity-40 disabled:cursor-default hover:border-sky-500 hover:bg-sky-50 ${className}`}
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

function MatchPairs({ onBack }: { onBack: () => void }) {
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
      celebrateEyeGaze(false);
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(card => {
          const selected = first === card.id;
          return (
            <DwellButton
              key={card.id}
              onSelect={() => selectCard(card.id)}
              disabled={!!card.matched || locked}
              className={`${card.matched ? "bg-green-500/15 border-green-500/40" : selected ? "bg-primary/15 border-primary" : "bg-white text-slate-950 border-slate-300 shadow-md"}`}
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

function WordPop({ onBack }: { onBack: () => void }) {
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
      celebrateEyeGaze(false);
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
      <div className="rounded-2xl border-2 border-blue-200 bg-sky-50 text-slate-950 shadow-md p-5 text-center mb-5">
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

function SentenceBuilder({ onBack }: { onBack: () => void }) {
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
      celebrateEyeGaze(false);
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
      <div className="text-center mb-4">
        <div className="text-6xl mb-3" aria-label="Picture clue">{current.picture}</div>

      </div>

      <div className="min-h-[90px] rounded-2xl border-4 border-dashed border-sky-300 bg-sky-50 text-slate-950 shadow-inner p-4 mb-5 flex flex-wrap items-center justify-center gap-2">
        {built.length === 0 ? (
          <span className="text-sm text-muted-foreground">Your sentence will appear here</span>
        ) : (
          built.map((word, i) => (
            <span key={i} className="px-4 py-3 rounded-xl bg-white text-slate-950 border-2 border-slate-300 shadow-sm text-xl font-black">{word}</span>
          ))
        )}
      </div>

      {!complete && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {bank.map((word, i) => (
            <DwellButton key={`${word}-${i}`} onSelect={() => chooseWord(word)} className="bg-white text-slate-950 border-slate-300 shadow-md">
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
    <div className="min-h-[calc(100dvh-4rem)] bg-slate-100 text-slate-950 px-3 sm:px-4 py-4 sm:py-5">
      <div className="max-w-4xl mx-auto rounded-[2rem] bg-white border-2 border-slate-200 shadow-xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Games</Button>
        <div>
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
      </div>
    </div>
  );
}

export default function EyeGazeGames() {
  const { token, user } = useAuth();
  const [permissions,setPermissions]=useState<ParentControls|null>(null);
  const [permissionsFailed,setPermissionsFailed]=useState(false);
  const isChild=!!user?.is_eye_gaze_user && user.role === "student" && !user.isAdmin;
  useEffect(()=>{let active=true;if(isChild)void fetchFamilySettings(token).then(result=>{if(active)setPermissions(result.settings);}).catch(()=>{if(active)setPermissionsFailed(true);});return()=>{active=false;};},[token,isChild]);
  const canPlay=!isChild || (!!permissions && pathAllowed("/eye-gaze-games",permissions));
  const canLearn=!isChild || (!!permissions && pathAllowed("/library",permissions));
  const [, navigate] = useLocation();
  const [panel, setPanel] = useState<"games" | "lessons">(()=>new URLSearchParams(window.location.search).get("tab")==="lessons"?"lessons":"games");
  const [game, setGame] = useState<GameId>(null);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("eye-gaze-game-immersive", { detail: { active: !!game } }));
  }, [game]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("eye-gaze-game-immersive", { detail: { active: false } }));
    };
  }, []);

  if(isChild && !permissions)return <div className="p-8 font-bold">{permissionsFailed?"Could not load activity permissions. Please reopen Games.":"Loading activities…"}</div>;
  const activePanel = panel === "games" && !canPlay ? "lessons" : panel === "lessons" && !canLearn ? "games" : panel;
  if (canPlay && game === "runner") return <ReadingRunnerPro onBack={() => setGame(null)} />;
  if (canPlay && game === "ninja") return <ReadingNinja onBack={() => setGame(null)} />;
  if (canPlay && game === "match") return <MatchPairs onBack={() => setGame(null)} />;
  if (canPlay && game === "pop") return <WordPop onBack={() => setGame(null)} />;
  if (canPlay && game === "sentence") return <SentenceBuilder onBack={() => setGame(null)} />;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b-2 border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eye-gaze-home")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Home
          </Button>
          <div className="flex-1">
            <h1 className="font-black text-lg flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" /> Eye Gaze Reading Games
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Reading games with gaze, tap, and movement-based play. No quiz required.</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-5">
        <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-2 border-2 border-teal-200" role="tablist" aria-label="Games and lessons">
          <button role="tab" aria-selected={activePanel==="games"} disabled={!canPlay} onClick={()=>setPanel("games")} className={`min-h-16 rounded-2xl text-lg font-black disabled:opacity-40 ${activePanel==="games"?"bg-teal-800 text-white":"text-slate-700 bg-slate-100"}`}>🎮 Games</button>
          <button role="tab" aria-selected={activePanel==="lessons"} disabled={!canLearn} onClick={()=>setPanel("lessons")} className={`min-h-16 rounded-2xl text-lg font-black disabled:opacity-40 ${activePanel==="lessons"?"bg-teal-800 text-white":"text-slate-700 bg-slate-100"}`}>📚 Lessons & books</button>
        </div>
      </div>
      {activePanel === "lessons" ? <EyeGazeAccessGate path="/library"><EyeGazeLessons embedded /></EyeGazeAccessGate> : <main className="max-w-5xl mx-auto px-4 py-6">
        <section className="relative overflow-hidden w-full rounded-[2.2rem] border-2 border-slate-300 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 sm:p-8 text-white shadow-lg mb-5 min-h-[160px]" aria-label="A.R.I.S.E. City coming later">
          <div className="absolute right-4 bottom-[-22px] text-[120px] sm:text-[150px] opacity-20">🏙️</div>
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-300 text-slate-950 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">COMING LATER</div>
            <h2 className="text-3xl sm:text-4xl font-black">A.R.I.S.E. City</h2>
            <p className="mt-3 text-white/80 text-base sm:text-lg font-bold max-w-xl">City is parked for now while it is rebuilt and cleaned up. It will return when the experience is ready.</p>
          </div>
        </section>

        <button
          type="button"
          onClick={() => navigate("/eye-gaze-fidgets")}
          className="relative overflow-hidden w-full rounded-[2.2rem] border-4 border-cyan-300 bg-gradient-to-br from-slate-950 via-violet-950 to-cyan-950 p-6 sm:p-8 text-left text-white shadow-xl hover:-translate-y-1 transition-all mb-5 min-h-[210px]"
        >
          <div className="absolute right-[-8px] bottom-[-36px] text-[150px] opacity-25">🫧</div>
          <div className="absolute right-24 top-3 text-5xl opacity-80">🌀</div>
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300 text-slate-950 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4"><Sparkles className="w-4 h-4"/> SENSORY PLAY</div>
            <h2 className="text-3xl sm:text-4xl font-black">Fidget Lab</h2>
            <p className="mt-2 text-white/85 font-bold text-base sm:text-lg">A whole library of satisfying fidgets: pop-its, bubble wrap, slime, ripple water, spinners, glow tiles, switches, liquid orbs and more.</p>
            <div className="mt-4 inline-flex rounded-2xl bg-white text-violet-800 px-5 py-3 font-black">OPEN FIDGET LAB →</div>
          </div>
        </button>

        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <button
            type="button"
            onClick={() => setGame("runner")}
            className="relative overflow-hidden rounded-[2rem] border-2 border-violet-300 bg-gradient-to-br from-violet-600 via-fuchsia-500 to-sky-500 p-6 sm:p-8 text-left text-white shadow-xl hover:-translate-y-1 transition-all min-h-[280px]"
          >
            <div className="absolute -right-8 -bottom-10 text-[155px] opacity-20 rotate-[-8deg]">🏃</div>
            <div className="absolute right-7 top-5 flex gap-2 text-4xl"><span>🐱</span><span>🐶</span><span>🍎</span></div>
            <div className="relative max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
                <Zap className="w-4 h-4" /> SWIPE · DODGE · COLLECT
              </div>
              <h2 className="text-3xl sm:text-4xl font-black">Reading Runner</h2>
              <p className="mt-3 text-white/90 text-base sm:text-lg font-bold">Hear “Rescue all the cats,” then swipe between lanes to collect cats and swipe up to jump over dogs, rabbits, and other distractors.</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white text-violet-700 px-5 py-3 font-black">
                <Flag className="w-5 h-5" /> Run & Rescue
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setGame("ninja")}
            className="relative overflow-hidden rounded-[2rem] border-2 border-pink-300 bg-gradient-to-br from-fuchsia-700 via-violet-700 to-indigo-800 p-6 sm:p-8 text-left text-white shadow-xl hover:-translate-y-1 transition-all min-h-[280px]"
          >
            <div className="absolute -right-2 -bottom-8 text-[150px] opacity-20">🥷</div>
            <div className="absolute right-7 top-5 flex gap-2 text-4xl"><span>🍎</span><span>🍌</span><span>🐱</span></div>
            <div className="relative max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
                ✨ SWIPE · FIND · HIT
              </div>
              <h2 className="text-3xl sm:text-4xl font-black">Reading Ninja</h2>
              <p className="mt-3 text-white/90 text-base sm:text-lg font-bold">Fast arcade learning: hear the target, then swipe through only the matching pictures as everything flies by.</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white text-fuchsia-700 px-5 py-3 font-black">
                🥷 Start Game
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setGame("match")}
            className="rounded-2xl border-4 border-purple-300 bg-white text-slate-950 shadow-xl p-6 text-left hover:border-purple-500 hover:-translate-y-1 transition-all min-h-[230px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-100 border-2 border-purple-200 flex items-center justify-center mb-4">
              <Grid2X2 className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-xl font-black">Match Pairs</h2>
            <p className="text-sm text-slate-600 font-semibold mt-2">Match words like CAT, DOG, and BOOK with their pictures.</p>
            <p className="text-xs font-bold text-purple-700 mt-4">Matching · word recognition</p><div className="mt-4 rounded-xl bg-purple-600 text-white px-4 py-3 text-center font-black">PLAY MATCH PAIRS →</div>
          </button>

          <button
            type="button"
            onClick={() => setGame("pop")}
            className="rounded-2xl border-4 border-blue-300 bg-white text-slate-950 shadow-xl p-6 text-left hover:border-blue-500 hover:-translate-y-1 transition-all min-h-[230px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-100 border-2 border-blue-200 flex items-center justify-center mb-4">
              <CircleDot className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-black">Word Pop</h2>
            <p className="text-sm text-slate-600 font-semibold mt-2">Find the matching word from four big bubbles and pop it.</p>
            <p className="text-xs font-bold text-blue-700 mt-4">Sight words · discrimination</p><div className="mt-4 rounded-xl bg-blue-600 text-white px-4 py-3 text-center font-black">PLAY WORD POP →</div>
          </button>

          <button
            type="button"
            onClick={() => setGame("sentence")}
            className="rounded-2xl border-4 border-emerald-300 bg-white text-slate-950 shadow-xl p-6 text-left hover:border-emerald-500 hover:-translate-y-1 transition-all min-h-[230px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center mb-4">
              <Type className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-black">Sentence Builder</h2>
            <p className="text-sm text-slate-600 font-semibold mt-2">Use a picture clue and choose word tiles to build a sentence.</p>
            <p className="text-xs font-bold text-emerald-700 mt-4">Sentence order · comprehension</p><div className="mt-4 rounded-xl bg-emerald-600 text-white px-4 py-3 text-center font-black">PLAY SENTENCE BUILDER →</div>
          </button>
        </div>
      </main>}

    </div>
  );
}