import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";

const LETTERS = [
  {
    letter: "A",
    word: "Advocating",
    color: "from-rose-500 to-pink-500",
    text: "Every child deserves to feel heard, seen, and worthy of success. A.R.I.S.E. encourages students to advocate for themselves, ask for help when they need it, and believe that their voice matters.",
  },
  {
    letter: "R",
    word: "Resilience",
    color: "from-amber-500 to-orange-500",
    text: "Not every book will be easy. Not every quiz will be passed on the first try. A.R.I.S.E. teaches students that struggling doesn't mean they're failing — it means they're growing. We celebrate the courage to keep turning the page.",
  },
  {
    letter: "I",
    word: "Inclusion",
    color: "from-emerald-500 to-teal-500",
    text: "Every student deserves a place in the world of reading. Whether a student reads far above grade level, struggles to decode a sentence, or needs additional support, A.R.I.S.E. is built on the belief that every reader belongs.",
  },
  {
    letter: "S",
    word: "Support",
    color: "from-sky-500 to-blue-500",
    text: "Sometimes students don't need someone to tell them they're behind. They need someone to tell them, \u201cI've got you. Let's figure this out together.\u201d A.R.I.S.E. surrounds students with encouragement, accessible books, meaningful support, and people who believe in them.",
  },
  {
    letter: "E",
    word: "Empowerment",
    color: "from-violet-500 to-purple-500",
    text: "The greatest reward isn't a prize — it's a student realizing, \u201cI did that.\u201d A.R.I.S.E. gives students opportunities to make choices, set goals, celebrate their accomplishments, and discover that they are capable of more than they thought.",
  },
];

export default function About() {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <ArrowLeft className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Back</span>
          </button>
          <h1 className="text-lg font-bold">
            <span className="text-primary">A.R.I.S.E</span> Reader
          </h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Heart className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Our Mission</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            What does <span className="text-primary">A.R.I.S.E.</span> mean?
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            We aren't just trying to get students to read more books. We're trying to help them believe in themselves.
          </p>
        </div>
      </div>

      {/* Letter cards */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 space-y-4">
        {LETTERS.map((item, i) => (
          <div
            key={item.letter}
            className="rounded-2xl border border-border bg-card overflow-hidden transition-all"
          >
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
            >
              <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}>
                <span className="text-2xl font-bold text-white">{item.letter}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold">{item.word}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {item.text.split(".")[0]}.
                </p>
              </div>
              <svg
                className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${expanded === i ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expanded === i && (
              <div className="px-5 pb-5 pt-0">
                <div className="pl-[72px]">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Closing statement */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-8 sm:p-12 text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">A.R.I.S.E. Reader</h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            We aren't just trying to get students to read more books. We're trying to help them believe in themselves.
          </p>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto mt-3">
            Because sometimes, the most important thing a child can discover in a book isn't the story on the page —
          </p>
          <p className="text-sm sm:text-base font-semibold text-primary mt-3">
            it's the story they begin to believe about themselves.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <Button onClick={() => navigate("/")} size="lg" className="px-8">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
