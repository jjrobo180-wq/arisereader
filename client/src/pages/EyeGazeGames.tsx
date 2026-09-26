import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Gamepad2, Grid2X2, CircleDot, Type, RotateCcw, Star, Eye, CheckCircle2, Upload, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { speakCharacter, speakCharacterAI } from "@/lib/tts";

type GameId = "match" | "pop" | "sentence" | null;

type BuddyPreset = "puppy" | "dino" | "robot" | "bunny";
type BuddyConfig = {
  type: "preset" | "upload";
  preset: BuddyPreset;
  name: string;
  imageData: string | null;
  voiceEnabled: boolean;
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
        speakCharacter(message, {
          excitement: success ? "excited" : retry ? "calm" : "normal",
          onEnd: () => setTalking(false),
        });
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
  const [buddy, setBuddy] = useState<BuddyConfig>({ type: "preset", preset: "puppy", name: "Buddy", imageData: null, voiceEnabled: true });
  const [buddyDraft, setBuddyDraft] = useState<BuddyConfig>({ type: "preset", preset: "puppy", name: "Buddy", imageData: null, voiceEnabled: true });
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
          onFallback: () => speakCharacter(`Hi! I'm ${data.name}. Let's learn together!`, { excitement: "excited" }),
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
