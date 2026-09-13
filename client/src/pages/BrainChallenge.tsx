import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Eye, EyeOff, Trophy, RotateCcw, ChevronRight, Brain, Sparkles } from "lucide-react";
import { BrandText } from "@/components/BrandText";

// Helper: reverse each word in a sentence, keeping punctuation attached
function reverseWords(text: string): string {
  return text.split(" ").map(word => {
    // Keep trailing punctuation outside the reversal
    const match = word.match(/^([a-zA-Z']+)([^a-zA-Z']*)$/);
    if (!match) return word;
    return match[1].split("").reverse().join("") + match[2];
  }).join(" ");
}

// Helper: split text into word tokens for rendering
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter(w => w.length > 0);
}

interface Challenge {
  reversed: string;
  normal: string;
}

// Challenge sentences - progressive difficulty
const CHALLENGES: Challenge[] = [
  {
    normal: "Reading is fun!",
    reversed: "gnidaeR si nuf!"
  },
  {
    normal: "Books open minds.",
    reversed: "skooB nepo sdnim."
  },
  {
    normal: "If you can read this you are very smart.",
    reversed: "fI uoy nac daer siht uoy era yrev trams."
  },
  {
    normal: "The more you read the more you know.",
    reversed: "ehT erom uoy daer eht erom uoy wonk."
  },
  {
    normal: "A good reader today becomes a great leader tomorrow.",
    reversed: "A doog daeror yadot semoceb a taerg daedel worromot."
  },
  {
    normal: "If you can read this you should join A.R.I.S.E Reading Club!",
    reversed: "fI uoy nac daer siht uoy dluohs nioj A.R.I.S.E gnidaeR bulC!"
  },
];

export default function BrainChallenge() {
  const [, navigate] = useLocation();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [solved, setSolved] = useState<boolean[]>(new Array(CHALLENGES.length).fill(false));
  const [showFinish, setShowFinish] = useState(false);

  const challenge = CHALLENGES[currentIdx];
  const isLast = currentIdx === CHALLENGES.length - 1;
  const progress = solved.filter(Boolean).length;

  const handleReveal = () => {
    setRevealed(!revealed);
  };

  const handleNext = () => {
    // Mark as solved
    const newSolved = [...solved];
    newSolved[currentIdx] = true;
    setSolved(newSolved);

    if (isLast) {
      setShowFinish(true);
    } else {
      setCurrentIdx(currentIdx + 1);
      setRevealed(false);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setRevealed(false);
    setSolved(new Array(CHALLENGES.length).fill(false));
    setShowFinish(false);
  };

  const reversedTokens = tokenize(challenge.reversed);
  const normalTokens = tokenize(challenge.normal);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <BrandText />
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Brain Challenge</h1>
          <p className="text-sm text-muted-foreground">Each word is written backwards. Can you read it?</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {CHALLENGES.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                solved[idx]
                  ? "bg-primary w-8"
                  : idx === currentIdx
                  ? "bg-primary/50 w-8"
                  : "bg-muted w-4"
              }`}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">{progress}/{CHALLENGES.length}</span>
        </div>

        {showFinish ? (
          /* Finish Screen */
          <Card className="shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">You did it!</h2>
              <p className="text-muted-foreground mb-2">
                You read all {CHALLENGES.length} backwards-word challenges.
              </p>
              <p className="text-lg text-primary font-semibold mb-6">
                If you can read this, you should join A.R.I.S.E Reading Club!
              </p>
              <div className="flex flex-col gap-3 items-center">
                <Button
                  onClick={() => navigate("/reading-club")}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Join the Reading Club
                </Button>
                <Button
                  onClick={handleRestart}
                  variant="outline"
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Play Again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Challenge Card */
          <Card className="shadow-lg mb-6">
            <CardContent className="p-8">
              {/* Challenge number */}
              <div className="text-center mb-6">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  Challenge {currentIdx + 1} of {CHALLENGES.length}
                </span>
              </div>

              {/* Text display */}
              <div
                className="text-center leading-relaxed text-foreground mb-8 select-none"
                style={{ fontSize: "24px", lineHeight: 2 }}
              >
                {revealed
                  ? normalTokens.map((token, idx) => {
                      const isSpace = /^\s+$/.test(token);
                      if (isSpace) return <span key={idx}>{token}</span>;
                      return (
                        <span
                          key={idx}
                          className="text-primary font-semibold transition-colors duration-300"
                        >
                          {token}
                        </span>
                      );
                    })
                  : reversedTokens.map((token, idx) => {
                      const isSpace = /^\s+$/.test(token);
                      if (isSpace) return <span key={idx}>{token}</span>;
                      return (
                        <span
                          key={idx}
                          className="transition-colors duration-300"
                        >
                          {token}
                        </span>
                      );
                    })
                }
              </div>

              {/* Reveal toggle */}
              <div className="flex justify-center mb-4">
                <Button
                  onClick={handleReveal}
                  variant="outline"
                  className="gap-2"
                >
                  {revealed ? (
                    <>
                      <EyeOff className="w-4 h-4" /> Hide Answer
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" /> Show Answer
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        {!showFinish && (
          <div className="flex justify-center">
            <Button onClick={handleNext} className="gap-2">
              {isLast ? "Finish Challenge" : "Next Challenge"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            Reading backwards strengthens your brain. It builds focus, pattern recognition, and flexible thinking — skills that make you a better reader.
          </p>
        </div>
      </main>
    </div>
  );
}
