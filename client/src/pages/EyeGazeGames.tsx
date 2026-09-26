import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Gamepad2, Grid2X2, CircleDot, Type, RotateCcw, Star, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type GameId = "match" | "pop" | "sentence" | null;

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

function MatchPairs({ onBack }: { onBack: () => void }) {
  const [setIndex, setSetIndex] = useState(0);
  const [cards, setCards] = useState(() => MATCH_SETS[0].map(c => ({ ...c })));
  const [first, setFirst] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("Find a word and its matching picture.");

  const selectCard = (id: string) => {
    if (locked) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.matched) return;

    if (!first) {
      setFirst(id);
      setMessage("Now find its match.");
      return;
    }

    if (first === id) return;

    const firstCard = cards.find(c => c.id === first);
    if (!firstCard) return;

    setLocked(true);
    if (firstCard.pair === card.pair && firstCard.kind !== card.kind) {
      setCards(prev => prev.map(c => c.id === first || c.id === id ? { ...c, matched: true } : c));
      setMessage("Match!");
      setFirst(null);
      setLocked(false);
    } else {
      setMessage("Not a match. Try another pair.");
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
    setMessage("Find a word and its matching picture.");
  };

  return (
    <GameShell title="Match Pairs" subtitle="Match each word with its picture." onBack={onBack}>
      <div className="text-center mb-4">
        <p className="text-sm font-semibold" aria-live="polite">{message}</p>
      </div>

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

function WordPop({ onBack }: { onBack: () => void }) {
  const [round, setRound] = useState(0);
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState("Find the matching word.");
  const [locked, setLocked] = useState(false);

  const current = POP_ROUNDS[round];

  const choose = (word: string) => {
    if (locked) return;
    if (word === current.target) {
      setLocked(true);
      setStars(s => s + 1);
      setFeedback("POP! You found it!");
      setTimeout(() => {
        setRound(r => (r + 1) % POP_ROUNDS.length);
        setFeedback("Find the matching word.");
        setLocked(false);
      }, 850);
    } else {
      setFeedback("Try another bubble.");
    }
  };

  return (
    <GameShell title="Word Pop" subtitle="Find the target word and pop it." onBack={onBack}>
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

      <p className="mt-4 text-center font-bold" aria-live="polite">{feedback}</p>
    </GameShell>
  );
}

function SentenceBuilder({ onBack }: { onBack: () => void }) {
  const [round, setRound] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const [message, setMessage] = useState("Build the sentence from left to right.");
  const current = SENTENCE_ROUNDS[round];

  const bank = [...current.words, ...current.distractors];

  const chooseWord = (word: string) => {
    const nextIndex = built.length;
    if (nextIndex >= current.words.length) return;

    if (word === current.words[nextIndex]) {
      const next = [...built, word];
      setBuilt(next);
      setMessage(next.length === current.words.length ? "Sentence complete!" : "Great. Pick the next word.");
    } else {
      setMessage("That word does not go there. Try another.");
    }
  };

  const reset = () => {
    setBuilt([]);
    setMessage("Build the sentence from left to right.");
  };

  const next = () => {
    setRound(r => (r + 1) % SENTENCE_ROUNDS.length);
    setBuilt([]);
    setMessage("Build the sentence from left to right.");
  };

  const complete = built.length === current.words.length;

  return (
    <GameShell title="Sentence Builder" subtitle="Choose words in order to build a sentence." onBack={onBack}>
      <div className="text-center mb-4">
        <div className="text-6xl mb-3" aria-label="Picture clue">{current.picture}</div>
        <p className="font-semibold" aria-live="polite">{message}</p>
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
  const [, navigate] = useLocation();
  const [game, setGame] = useState<GameId>(null);

  if (game === "match") return <MatchPairs onBack={() => setGame(null)} />;
  if (game === "pop") return <WordPop onBack={() => setGame(null)} />;
  if (game === "sentence") return <SentenceBuilder onBack={() => setGame(null)} />;

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
    </div>
  );
}
