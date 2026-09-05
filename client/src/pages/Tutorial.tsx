import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { API_BASE } from "@/lib/queryClient";
import {
  BookOpen, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Award, Trophy,
  Users, ClipboardList, GraduationCap, Bell, Inbox, Search, ChevronDown,
  Lock, MessageSquarePlus, BookPlus, UserPlus, X, ShieldCheck, Settings,
  Sparkles, ChevronLeft, BookUser, UserCog, PlayCircle, Eye
} from "lucide-react";
import { BrandText } from "@/components/BrandText";
import { generateCertificate } from "@/lib/certificate";

// ─── Types ──────────────────────────────────────────────────────────

type Book = {
  id: number;
  title: string;
  author: string;
  pointsValue: number;
  coverUrl?: string;
  epubUrl?: string;
};

type Question = {
  id: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  questionOrder?: number;
};

type QuizData = {
  book: Book;
  questions: Question[];
};

// ─── Sample data (for teacher tutorial & fallback) ────────────────────

const SAMPLE_LEADERBOARD = [
  { rank: 1, name: "Maya R.", points: 120, quizzes: 8 },
  { rank: 2, name: "Devon K.", points: 100, quizzes: 7 },
  { rank: 3, name: "Aaliyah J.", points: 90, quizzes: 6 },
  { rank: 4, name: "Marcus T.", points: 70, quizzes: 5 },
  { rank: 5, name: "Sophia L.", points: 60, quizzes: 4 },
];

const EASY_QUIZ = {
  book: { id: 1, title: "A.R.I.S.E Reader Demo Quiz", author: "Fun Knowledge", pointsValue: 10, coverUrl: "" },
  questions: [
    {
      id: 1,
      questionText: "What color is the sky on a clear day?",
      optionA: "Green",
      optionB: "Blue",
      optionC: "Purple",
      optionD: "Red",
      correct: "B",
    },
    {
      id: 2,
      questionText: "How many days are in a week?",
      optionA: "5",
      optionB: "10",
      optionC: "7",
      optionD: "12",
      correct: "C",
    },
    {
      id: 3,
      questionText: "What do you use to read a book?",
      optionA: "Your eyes",
      optionB: "Your ears",
      optionC: "Your nose",
      optionD: "Your toes",
      correct: "A",
    },
  ],
};

// ─── Student Steps ────────────────────────────────────────────────────

const STUDENT_STEPS = [
  "Welcome",
  "Library & Search",
  "Book Request",
  "Notifications",
  "Take a Quiz",
  "Certificate",
  "Profile & Leaderboard",
  "Progress Monitoring",
  "You're Ready!",
];

// ─── Teacher Steps ────────────────────────────────────────────────────

const TEACHER_STEPS = [
  "Welcome",
  "Admin Dashboard",
  "Student Management",
  "Create Quizzes",
  "Inbox & Messages",
  "Notifications",
  "Library Overview",
  "Progress Monitoring",
  "You're Ready!",
];

// ─── Eye Gaze / Non-Verbal Steps ─────────────────────────────────────

const EYE_GAZE_STEPS = [
  "Welcome",
  "Eye Gaze Library",
  "Taking Eye Gaze Quizzes",
  "Score & Results",
  "Progress Monitoring",
  "Leaderboard",
  "Settings & Toggle",
  "You're Ready!",
];

// ─── Main Component ──────────────────────────────────────────────────

export default function Tutorial() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"select" | "student" | "teacher" | "eye-gaze">(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      if (hash.includes("/tutorial/student")) return "student";
      if (hash.includes("/tutorial/teacher")) return "teacher";
      if (hash.includes("/tutorial/eye-gaze")) return "eye-gaze";
    }
    return "select";
  });
  const [step, setStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [libSearch, setLibSearch] = useState("");
  const [realBooks, setRealBooks] = useState<Book[]>([]);
  const [tutorialQuiz, setTutorialQuiz] = useState<QuizData | null>(null);
  const [booksLoading, setBooksLoading] = useState(true);

  const steps = mode === "student" ? STUDENT_STEPS : mode === "eye-gaze" ? EYE_GAZE_STEPS : TEACHER_STEPS;
  const totalSteps = steps.length;
  const progress = ((step + 1) / totalSteps) * 100;

  // Fetch real books from public API
  useEffect(() => {
    fetch(`${API_BASE}/api/tutorial/books`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setRealBooks(data);
        setBooksLoading(false);
      })
      .catch(() => setBooksLoading(false));
  }, []);

  const displayBooks = realBooks.length > 0 ? realBooks : [];

  const handleSelectMode = (selectedMode: "student" | "teacher" | "eye-gaze") => {
    setMode(selectedMode);
    setStep(0);
  };

  // ─── Selection Screen ──────────────────────────────────────────────

  if (mode === "select") {
    return (
      <div className="min-h-screen bg-background">
        {/* Demo banner */}
        <div className="bg-primary text-white text-center py-2 px-4 text-xs font-semibold sticky top-0 z-50">
          TUTORIAL MODE — No login required, nothing is saved. Choose your path below.
        </div>

        {/* Header */}
        <header className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold text-white tracking-wide">A.R.I.S.E<span className="text-primary"> Reader</span></h1>
            <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
              Exit to Login
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">Welcome to A.R.I.S.E Reader!</h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Choose the tutorial that fits you. Both walk through every feature with no login and nothing saved.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Student/Parent card */}
            <button
              onClick={() => handleSelectMode("student")}
              className="text-left p-6 rounded-2xl bg-card border-2 border-border hover:border-primary transition-all hover:shadow-lg group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BookUser className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Student & Parent</h2>
              <p className="text-sm text-muted-foreground mb-4">
                See how students browse books, search the library, take quizzes, earn certificates, and check the leaderboard.
              </p>
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <PlayCircle className="w-4 h-4" />
                Start Student Tutorial
              </div>
            </button>

            {/* Teacher card */}
            <button
              onClick={() => handleSelectMode("teacher")}
              className="text-left p-6 rounded-2xl bg-card border-2 border-border hover:border-primary transition-all hover:shadow-lg group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UserCog className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Teacher / Admin</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Explore the admin dashboard: create quizzes, manage students, view the full book library, send messages, and set passwords.
              </p>
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <PlayCircle className="w-4 h-4" />
                Start Teacher Tutorial
              </div>
            </button>

            {/* Eye Gaze / Non-Verbal card */}
            <button
              onClick={() => handleSelectMode("eye-gaze")}
              className="text-left p-6 rounded-2xl bg-card border-2 border-border hover:border-primary transition-all hover:shadow-lg group sm:col-span-2"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Eye className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Eye Gaze / Non-Verbal</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Learn how eye gaze users navigate the library, take visual quizzes, track progress, and use the eye gaze leaderboard.
              </p>
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <PlayCircle className="w-4 h-4" />
                Start Eye Gaze Tutorial
              </div>
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              Both tutorials are perfect for presentations to teachers, parents, or students.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ─── Tutorial content ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Demo banner */}
      <div className="bg-primary text-white text-center py-2 px-4 text-xs font-semibold sticky top-0 z-50">
        {mode === "student" ? "STUDENT" : mode === "eye-gaze" ? "EYE GAZE" : "TEACHER"} TUTORIAL — No login required, nothing is saved. Follow the steps to explore the platform.
      </div>

      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setMode("select"); setStep(0); }}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" /> Choose Path
            </button>
            <h1 className="text-xl font-bold text-white tracking-wide">A.R.I.S.E<span className="text-primary"> Reader</span></h1>
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => Math.max(0, s - 1))} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
            )}
            <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
              Exit to Login
            </button>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {steps.map((label, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  i === step
                    ? "bg-primary text-white"
                    : i < step
                    ? "bg-green-500/20 text-green-400"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted"
                }`}
              >
                {i < step && <CheckCircle2 className="w-3 h-3" />}
                {i + 1}. {label}
              </button>
            ))}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Step content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STUDENT TUTORIAL                                           */}
        {/* ═══════════════════════════════════════════════════════════ */}

        {mode === "student" && (
          <>
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <BookUser className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">Student & Parent Tutorial</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  This tutorial walks you through everything a student can do: browse the full quiz library, take a practice quiz, earn a certificate, and see the leaderboard — all without logging in.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <BookOpen className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Browse & Search</h3>
                    <p className="text-xs text-muted-foreground mt-1">Explore every book quiz in the library, organized by points</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <Trophy className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Earn & Compete</h3>
                    <p className="text-xs text-muted-foreground mt-1">Pass at 70% to earn points and certificates. Climb the leaderboard</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <GraduationCap className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Profile & Inbox</h3>
                    <p className="text-xs text-muted-foreground mt-1">Check your points, view history, and message your teacher</p>
                  </div>
                </div>
                <Button size="lg" onClick={() => setStep(1)} className="gap-2">
                  Start the Tour <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            )}

            {/* Step 1: Library & Search */}
            {step === 1 && (
              <StepContainer
                title="The Library — Browse & Search"
                icon={<BookOpen className="w-6 h-6 text-primary" />}
                onNext={() => setStep(2)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  When students log in, they see the Library with every available book quiz. Books are organized by point value — 10 (easy), 20 (medium), 30 (hard). Each book shows its cover, author, and points. Students can search by title or author. Try the search below — it shows all the real quizzes available on the platform!
                </p>
                {/* Live demo of library with real books */}
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="mb-3 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by title or author..."
                      value={libSearch}
                      onChange={(e) => setLibSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {booksLoading ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Loading quiz library...</p>
                    </div>
                  ) : displayBooks.filter(b =>
                    (b.title + " " + b.author).toLowerCase().includes(libSearch.toLowerCase())
                  ).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-2">No books found for "{libSearch}".</p>
                      <p className="text-xs text-primary">This is where a student can request the quiz be created!</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-3">
                        Showing {displayBooks.filter(b =>
                          (b.title + " " + b.author).toLowerCase().includes(libSearch.toLowerCase())
                        ).length} of {displayBooks.length} quizzes available
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {displayBooks.filter(b =>
                          (b.title + " " + b.author).toLowerCase().includes(libSearch.toLowerCase())
                        ).map((book) => (
                          <div key={book.id} className="rounded-lg overflow-hidden bg-card border border-border">
                            <div className="aspect-[2/3] overflow-hidden bg-muted">
                              {book.coverUrl ? (
                                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="p-2">
                              <p className="text-xs font-semibold truncate">{book.title}</p>
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                                book.pointsValue === 10 ? "bg-green-500/20 text-green-400" :
                                book.pointsValue === 20 ? "bg-primary/20 text-primary" :
                                "bg-red-500/20 text-red-400"
                              }`}>
                                <Trophy className="w-2.5 h-2.5" />
                                {book.pointsValue} pts
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <Callout icon={<Search className="w-4 h-4" />}>
                  The search bar filters books by title or author in real time. On the admin side, teachers can search books, quizzes, AND students separately.
                </Callout>
              </StepContainer>
            )}

            {/* Step 2: Book Request */}
            {step === 2 && (
              <StepContainer
                title="Request a Book Quiz"
                icon={<BookPlus className="w-6 h-6 text-primary" />}
                onNext={() => setStep(3)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  If a student searches for a book and no quiz exists, they can request it right there. They provide the book title, author (required), and an optional note. The request goes straight to the teacher's notifications.
                </p>
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center mb-3">
                    <p className="text-sm text-yellow-400">No quizzes found for "Harry Potter"</p>
                  </div>
                  <div className="space-y-2">
                    <input type="text" placeholder="Book title" disabled value="Harry Potter and the Sorcerer's Stone" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm opacity-70" />
                    <input type="text" placeholder="Author (required)" disabled value="J.K. Rowling" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm opacity-70" />
                    <textarea placeholder="Optional message to teacher..." disabled rows={2} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm opacity-70 resize-none" />
                    <Button size="sm" disabled className="w-full">Submit Request</Button>
                  </div>
                </div>
                <Callout icon={<MessageSquarePlus className="w-4 h-4" />}>
                  The student is told: "Your request will be created in 1-3 days. Keep an eye on your inbox or notifications!" The teacher sees it instantly on their bell icon.
                </Callout>
              </StepContainer>
            )}

            {/* Step 3: Notifications */}
            {step === 3 && (
              <StepContainer
                title="Notifications & Bell Icon"
                icon={<Bell className="w-6 h-6 text-primary" />}
                onNext={() => setStep(4)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  The bell icon shows notifications for book requests, new student sign-ups, and more. When you open the bell, the red badge clears automatically — just like iPhone notifications. Each item has an X to dismiss individually.
                </p>
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Bell className="w-5 h-5 text-foreground" />
                        </div>
                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">2</span>
                      </div>
                      <span className="text-sm font-medium">Notifications</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-stretch rounded-lg bg-primary/5 border border-primary/30 hover:bg-muted/50">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <BookPlus className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">Harry Potter and the Sorcerer's Stone</p>
                          <p className="text-[11px] text-muted-foreground truncate">by J.K. Rowling — requested by Maya R.</p>
                        </div>
                      </div>
                      <button className="px-2 flex items-center text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                    </div>
                    <div className="flex items-stretch rounded-lg bg-muted/30 hover:bg-muted/50">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">New student: Aaliyah J.</p>
                          <p className="text-[11px] text-muted-foreground truncate">@aaliyahj</p>
                        </div>
                      </div>
                      <button className="px-2 flex items-center text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <button className="text-xs text-primary hover:underline">Clear all</button>
                  </div>
                </div>
                <Callout icon={<Bell className="w-4 h-4" />}>
                  Clicking a book request notification takes the teacher straight to that request, with the Create Quiz dialog pre-filled with the book title and author.
                </Callout>
              </StepContainer>
            )}

            {/* Step 4: Take a Quiz */}
            {step === 4 && (
              <StepContainer
                title="Take a Quiz — Proctor Password"
                icon={<ClipboardList className="w-6 h-6 text-primary" />}
                onNext={() => { if (quizSubmitted) setStep(5); }}
                nextLabel={quizSubmitted ? "See Your Certificate" : undefined}
                nextDisabled={!quizSubmitted}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  All quizzes are locked with a proctor password. A teacher or proctor enters the password to unlock the quiz. Then the student answers 10 multiple-choice questions. They can only take each quiz once. Let's try a short 3-question practice quiz — these are simple questions anyone can get right!
                </p>

                {/* Proctor gate (already "unlocked" for demo) */}
                <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Proctor password entered (demo). Quiz unlocked!
                </div>

                {/* Quiz */}
                <Card className="shadow-lg overflow-hidden mb-4">
                  <div className="flex gap-4 p-4 items-center">
                    <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">{EASY_QUIZ.book.title}</h2>
                      <p className="text-sm text-muted-foreground">Practice Quiz — {EASY_QUIZ.book.author}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 mt-2">
                        <Trophy className="w-3 h-3" />
                        {EASY_QUIZ.book.pointsValue} points
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Questions */}
                {!quizSubmitted ? (
                  <div className="space-y-3">
                    {EASY_QUIZ.questions.map((q, i) => (
                      <Card key={q.id}>
                        <CardContent className="p-4">
                          <p className="font-semibold text-sm mb-3">{i + 1}. {q.questionText}</p>
                          <RadioGroup value={quizAnswers[q.id] || ""} onValueChange={(val) => setQuizAnswers(prev => ({ ...prev, [q.id]: val }))}>
                            {(["A", "B", "C", "D"] as const).map((letter) => (
                              <div key={letter} className="flex items-center gap-2 mb-2">
                                <RadioGroupItem id={`demo-q${q.id}-${letter}`} value={letter} />
                                <Label htmlFor={`demo-q${q.id}-${letter}`} className="text-sm font-normal cursor-pointer">
                                  {q[`option${letter}` as "optionA" | "optionB" | "optionC" | "optionD"]}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </CardContent>
                      </Card>
                    ))}
                    <Button
                      onClick={() => {
                        let correct = 0;
                        EASY_QUIZ.questions.forEach(q => { if (quizAnswers[q.id] === q.correct) correct++; });
                        setQuizScore(correct);
                        setQuizSubmitted(true);
                      }}
                      disabled={Object.keys(quizAnswers).length < EASY_QUIZ.questions.length}
                      className="w-full"
                    >
                      {Object.keys(quizAnswers).length < EASY_QUIZ.questions.length
                        ? `Answer all questions (${Object.keys(quizAnswers).length}/${EASY_QUIZ.questions.length})`
                        : "Submit Quiz"}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    {quizScore >= 2 ? (
                      <>
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold">You passed!</h2>
                        <p className="text-lg text-muted-foreground mt-2">
                          You scored {quizScore} out of {EASY_QUIZ.questions.length} ({Math.round(quizScore / EASY_QUIZ.questions.length * 100)}%)
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-bold">
                          <Trophy className="w-5 h-5" />
                          +{EASY_QUIZ.book.pointsValue} points earned!
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">In the real app, right/wrong answers are never shown — only the score and points.</p>
                        <p className="text-sm text-primary font-medium mt-2">Click "See Your Certificate" to continue →</p>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold">Almost there!</h2>
                        <p className="text-sm text-muted-foreground mt-2">You scored {quizScore}/{EASY_QUIZ.questions.length}. Try again — these are easy!</p>
                        <Button variant="outline" className="mt-4" onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); }}>
                          Retry Quiz
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </StepContainer>
            )}

            {/* Step 5: Certificate */}
            {step === 5 && (
              <StepContainer
                title="Your Certificate of Achievement"
                icon={<Award className="w-6 h-6 text-primary" />}
                onNext={() => setStep(6)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  When a student passes a quiz with 70% or higher, a certificate is generated with their name, the book title, and the points earned. They can print it or save it as a PDF. Click the button below to see a real certificate!
                </p>
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Award className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Certificate Ready!</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Student: Demo Student<br />
                    Quiz: "{EASY_QUIZ.book.title}"<br />
                    Points: {EASY_QUIZ.book.pointsValue}
                  </p>
                  <Button
                    size="lg"
                    onClick={() => generateCertificate("Demo Student", EASY_QUIZ.book.title, EASY_QUIZ.book.pointsValue, new Date().toLocaleDateString())}
                    className="gap-2"
                  >
                    <Award className="w-5 h-5" />
                    Generate & View Certificate
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    The certificate opens in a new window with a Print / Save as PDF button.
                  </p>
                </div>
                <Callout icon={<Award className="w-4 h-4" />}>
                  In the real app, the certificate uses the student's actual name and the exact book title. Each passed quiz generates one.
                </Callout>
              </StepContainer>
            )}

            {/* Step 6: Profile & Leaderboard */}
            {step === 6 && (
              <StepContainer
                title="Profile, Inbox & Leaderboard"
                icon={<Trophy className="w-6 h-6 text-primary" />}
                onNext={() => setStep(7)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Students can view their profile to check points, see quiz history, change their password, and message their teacher. The leaderboard shows all students ranked by points — everyone can see it from their profile.
                </p>

                {/* Profile demo */}
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">D</div>
                    <div>
                      <p className="font-bold text-sm">Demo Student</p>
                      <p className="text-xs text-muted-foreground">@demostudent</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div className="p-2 rounded-lg bg-muted/30"><Trophy className="w-4 h-4 text-primary mx-auto mb-1" /><p className="text-base font-bold">40</p><p className="text-[10px] text-muted-foreground">Points</p></div>
                    <div className="p-2 rounded-lg bg-muted/30"><ClipboardList className="w-4 h-4 text-primary mx-auto mb-1" /><p className="text-base font-bold">3</p><p className="text-[10px] text-muted-foreground">Passed</p></div>
                    <div className="p-2 rounded-lg bg-muted/30"><BookOpen className="w-4 h-4 text-primary mx-auto mb-1" /><p className="text-base font-bold">3</p><p className="text-[10px] text-muted-foreground">Books</p></div>
                  </div>
                  {/* Inbox demo */}
                  <div className="border-t border-border pt-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Inbox className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Inbox</span>
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">1</span>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/5 border border-primary/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">Teacher</span>
                        <span className="text-xs text-muted-foreground">Today</span>
                      </div>
                      <p className="text-xs">Great job on your quiz! Keep reading and earning points.</p>
                    </div>
                  </div>
                  {/* Leaderboard */}
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Leaderboard</span>
                    </div>
                    <div className="space-y-1">
                      {SAMPLE_LEADERBOARD.map((entry) => (
                        <div key={entry.rank} className={`flex items-center gap-2 p-2 rounded-lg ${entry.rank <= 3 ? "bg-primary/5" : ""}`}>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            entry.rank === 1 ? "bg-yellow-500/20 text-yellow-400" :
                            entry.rank === 2 ? "bg-gray-400/20 text-gray-300" :
                            entry.rank === 3 ? "bg-orange-700/20 text-orange-600" :
                            "bg-muted text-muted-foreground"
                          }`}>{entry.rank}</span>
                          <span className="text-xs font-medium flex-1">{entry.name}</span>
                          <span className="text-xs text-primary font-bold">{entry.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <Callout icon={<Inbox className="w-4 h-4" />}>
                  Students have a dedicated Inbox button in their header for messaging the teacher. The teacher's replies show up as conversation bubbles.
                </Callout>
              </StepContainer>
            )}

            {/* Step 7: Progress Monitoring */}
            {step === 7 && (
              <StepContainer
                title="Progress Monitoring"
                icon={<Users className="w-6 h-6 text-primary" />}
                onNext={() => setStep(8)}
                onBack={() => setStep(6)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Teachers and admins can monitor student progress from their dashboards. Here's what they can see:
                </p>
                <div className="space-y-2 mb-4">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold">Points Earned</p><p className="text-xs text-muted-foreground">Total points from all quizzes passed</p></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold">Quiz History</p><p className="text-xs text-muted-foreground">Which books were read and scores earned</p></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center gap-3">
                    <Award className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold">Certificates</p><p className="text-xs text-muted-foreground">Printable certificates for passed quizzes</p></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold">Reading Assessments</p><p className="text-xs text-muted-foreground">Round-based reading level assessments</p></div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-primary">Teachers:</strong> See progress for only your assigned students. <strong className="text-primary">Admins:</strong> See progress for all students across the platform.
                  </p>
                </div>
              </StepContainer>
            )}

            {/* Step 8: You're Ready */}
            {step === 8 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">You're Ready!</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  You've seen everything A.R.I.S.E Reader has to offer for students. When you're ready to start reading and earning points for real, create an account or log in.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" onClick={() => navigate("/")} className="gap-2">
                    <Sparkles className="w-5 h-5" />
                    Go to Login
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setStep(0)} className="gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Replay Tutorial
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* EYE GAZE / NON-VERBAL TUTORIAL                              */}
        {/* ═══════════════════════════════════════════════════════════ */}

        {mode === "eye-gaze" && (
          <>
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <Eye className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">Eye Gaze / Non-Verbal Tutorial</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  This tutorial is designed for eye gaze users and non-verbal students. Learn how to navigate the library, take visual quizzes, track progress, and use the eye gaze leaderboard.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <Eye className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Visual Quizzes</h3>
                    <p className="text-xs text-muted-foreground mt-1">Answer questions using images and visual prompts</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <Trophy className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Eye Gaze Leaderboard</h3>
                    <p className="text-xs text-muted-foreground mt-1">Compete with other eye gaze users on a separate leaderboard</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <Settings className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Profile Toggle</h3>
                    <p className="text-xs text-muted-foreground mt-1">Switch eye gaze mode on or off in settings anytime</p>
                  </div>
                </div>
                <Button size="lg" onClick={() => setStep(1)} className="gap-2">
                  Start the Tour <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            )}

            {/* Step 1: Eye Gaze Library */}
            {step === 1 && (
              <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Eye Gaze Library
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    When eye gaze mode is enabled, your library shows eye gaze quizzes with visual prompts. These quizzes use images instead of text-heavy questions, making them accessible for non-verbal students.
                  </p>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {["Animals", "Colors", "Shapes"].map((title, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border text-center">
                          <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-2">
                            <Eye className="w-8 h-8 text-primary" />
                          </div>
                          <p className="text-xs font-semibold">{title} Quiz</p>
                          <p className="text-xs text-muted-foreground">5 questions</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each quiz has 5 questions with image-based prompts and answer choices.
                  </p>
                  <div className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => setStep(0)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                    <Button size="sm" onClick={() => setStep(2)}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Taking Eye Gaze Quizzes */}
            {step === 2 && (
              <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    Taking Eye Gaze Quizzes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Eye gaze quizzes show one question at a time with large images for each answer option. Students select their answer by looking at or clicking the image.
                  </p>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <p className="text-sm font-semibold mb-3">Sample Question</p>
                    <div className="grid grid-cols-2 gap-3">
                      {["A", "B", "C", "D"].map((letter) => (
                        <div key={letter} className="p-3 rounded-lg bg-muted/30 border-2 border-border hover:border-primary transition-colors cursor-pointer text-center">
                          <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                            <Eye className="w-8 h-8 text-primary/50" />
                          </div>
                          <p className="text-xs font-semibold">Option {letter}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <Lock className="w-4 h-4 text-yellow-500" />
                    <p className="text-xs text-muted-foreground">A proctor password is required before starting any quiz.</p>
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                    <Button size="sm" onClick={() => setStep(3)}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Score & Results */}
            {step === 3 && (
              <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Award className="w-5 h-5 text-primary" />
                    Score & Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    After completing a quiz, students see their score immediately. Right and wrong answers are not shown — only the final score.
                  </p>
                  <div className="p-6 rounded-xl bg-card border border-border text-center">
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                      <Trophy className="w-10 h-10 text-green-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">4 / 5</p>
                    <p className="text-sm text-muted-foreground mt-1">Quiz Complete!</p>
                    <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                      <Award className="w-3 h-3" /> 4 points earned
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each quiz can only be taken once. Students earn points based on their score.
                  </p>
                  <div className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                    <Button size="sm" onClick={() => setStep(4)}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Progress Monitoring */}
            {step === 4 && (
              <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-primary" />
                    Progress Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Eye gaze student progress is tracked separately from regular students. Teachers and admins can monitor:
                  </p>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-primary" />
                      <div><p className="text-sm font-semibold">Total Points</p><p className="text-xs text-muted-foreground">Points earned from eye gaze quizzes</p></div>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-3">
                      <ClipboardList className="w-5 h-5 text-primary" />
                      <div><p className="text-sm font-semibold">Quizzes Completed</p><p className="text-xs text-muted-foreground">Number of eye gaze quizzes taken</p></div>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-3">
                      <Award className="w-5 h-5 text-primary" />
                      <div><p className="text-sm font-semibold">Eye Gaze Profile</p><p className="text-xs text-muted-foreground">Skill levels and assessment results</p></div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-primary">Teachers:</strong> See progress for only your assigned students. <strong className="text-primary">Admins:</strong> See progress for all students across the platform.
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                    <Button size="sm" onClick={() => setStep(5)}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Leaderboard */}
            {step === 5 && (
              <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="w-5 h-5 text-primary" />
                    Eye Gaze Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Eye gaze students have their own separate leaderboard. This keeps competition fair between eye gaze users and regular students.
                  </p>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="space-y-2">
                      {SAMPLE_LEADERBOARD.map((entry) => (
                        <div key={entry.rank} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${entry.rank === 1 ? "bg-yellow-500/20 text-yellow-400" : entry.rank === 2 ? "bg-gray-400/20 text-gray-300" : "bg-orange-600/20 text-orange-500"}`}>
                            {entry.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{entry.name}</p>
                            <p className="text-xs text-muted-foreground">{entry.quizzes} quizzes</p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm text-primary">{entry.points}</div>
                            <div className="text-xs text-muted-foreground">pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => setStep(4)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                    <Button size="sm" onClick={() => setStep(6)}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 6: Settings & Toggle */}
            {step === 6 && (
              <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="w-5 h-5 text-primary" />
                    Settings & Toggle
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Eye gaze mode can be toggled on or off in settings at any time. When on, the student sees only eye gaze books and quizzes. When off, they see the regular library.
                  </p>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">Eye Gaze Mode</p>
                          <p className="text-xs text-muted-foreground">Show eye gaze quizzes and books</p>
                        </div>
                      </div>
                      <div className="w-12 h-6 rounded-full bg-primary flex items-center justify-end pr-1">
                        <div className="w-4 h-4 rounded-full bg-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    During signup, students can check a box to enable eye gaze mode. This can be changed later in settings.
                  </p>
                  <div className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => setStep(5)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                    <Button size="sm" onClick={() => setStep(7)}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 7: You're Ready! */}
            {step === 7 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">You're Ready!</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  You now know how to navigate the eye gaze library, take visual quizzes, track progress, and use the eye gaze leaderboard. Create an account to get started!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" onClick={() => navigate("/register")} className="gap-2">
                    <UserPlus className="w-5 h-5" /> Create Account
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/leaderboard")} className="gap-2">
                    <Trophy className="w-5 h-5" /> View Eye Gaze Leaderboard
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TEACHER TUTORIAL                                            */}
        {/* ═══════════════════════════════════════════════════════════ */}

        {mode === "teacher" && (
          <>
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <UserCog className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">Teacher / Admin Tutorial</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  This tutorial walks you through the admin dashboard: student management, quiz creation, messaging, notifications, and the full book library — everything you need to run A.R.I.S.E Reader.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <Users className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Manage Students</h3>
                    <p className="text-xs text-muted-foreground mt-1">Search, reset passwords, send messages, view quiz history</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <ClipboardList className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Create Quizzes</h3>
                    <p className="text-xs text-muted-foreground mt-1">Paste AI-generated questions, add covers, set points</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <Inbox className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">DM-Style Inbox</h3>
                    <p className="text-xs text-muted-foreground mt-1">See all student conversations, reply, compose new</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-left">
                    <Lock className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Settings & Security</h3>
                    <p className="text-xs text-muted-foreground mt-1">Proctor password, announcement banner, name changes</p>
                  </div>
                </div>
                <Button size="lg" onClick={() => setStep(1)} className="gap-2">
                  Start the Tour <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            )}

            {/* Step 1: Admin Dashboard */}
            {step === 1 && (
              <StepContainer
                title="Admin Dashboard Overview"
                icon={<GraduationCap className="w-6 h-6 text-primary" />}
                onNext={() => setStep(2)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  The teacher dashboard shows stats, student management, quiz creation, book covers, quiz requests, inbox, proctor password, and announcement banner — all in one place. Here's what you see when you log in.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Students", value: "24", icon: Users, color: "text-blue-400" },
                    { label: "Quizzes Done", value: "87", icon: ClipboardList, color: "text-green-400" },
                    { label: "Quizzes Passed", value: "71", icon: CheckCircle2, color: "text-primary" },
                    { label: "Total Points", value: "1,420", icon: Trophy, color: "text-yellow-400" },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <Card key={stat.label}>
                        <CardContent className="p-3 text-center">
                          <Icon className={`w-5 h-5 ${stat.color} mx-auto mb-1`} />
                          <p className="text-xl font-bold">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  <FeatureRow icon={<ClipboardList className="w-4 h-4" />} title="Create Quizzes" desc="Paste AI-generated questions and the tool formats them into a 10-question quiz automatically. Set points, add cover image." />
                  <FeatureRow icon={<BookPlus className="w-4 h-4" />} title="Quiz Requests" desc="When students request books, they appear here. Click 'Create Quiz' to jump straight into building it." />
                  <FeatureRow icon={<Inbox className="w-4 h-4" />} title="DM-Style Inbox" desc="See all student conversations in one place. Click a student to open the thread. Reply, compose new, send links." />
                </div>
              </StepContainer>
            )}

            {/* Step 2: Student Management */}
            {step === 2 && (
              <StepContainer
                title="Student Management"
                icon={<Users className="w-6 h-6 text-primary" />}
                onNext={() => setStep(3)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Search students by name or username. For each student you can: reset their password (shown right there), send them a direct message, and view their full quiz history with scores and points. You can also see which books they've passed or attempted.
                </p>
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input type="text" placeholder="Search students..." disabled value="" className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm opacity-70" />
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Maya R.", username: "@mayar", points: 120, quizzes: 8, status: "Passed" },
                      { name: "Devon K.", username: "@devonk", points: 100, quizzes: 7, status: "Passed" },
                      { name: "Marcus T.", username: "@marcust", points: 70, quizzes: 5, status: "Attempted" },
                    ].map((student) => (
                      <div key={student.username} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {student.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.username} • {student.quizzes} quizzes • {student.points} pts</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            student.status === "Passed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                          }`}>{student.status}</span>
                          <button className="text-xs text-primary hover:underline">Reset Password</button>
                          <button className="text-xs text-primary hover:underline">Message</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Callout icon={<Users className="w-4 h-4" />}>
                  Clicking "Reset Password" generates a new temporary password shown immediately — share it with the student verbally or via message.
                </Callout>
              </StepContainer>
            )}

            {/* Step 3: Create Quizzes */}
            {step === 3 && (
              <StepContainer
                title="Create Quizzes with AI"
                icon={<ClipboardList className="w-6 h-6 text-primary" />}
                onNext={() => setStep(4)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Creating a quiz is simple: paste AI-generated questions (from ChatGPT, Claude, or any AI), and the tool formats them into a 10-question multiple-choice quiz automatically. Set the book title, author, points value, and cover image — all from one form.
                </p>
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Book Title</label>
                      <input type="text" placeholder="e.g. The Wild Robot" disabled value="The Wild Robot" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm opacity-70" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Author</label>
                      <input type="text" placeholder="Author name" disabled value="Peter Brown" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm opacity-70" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Points Value</label>
                      <div className="flex gap-2">
                        <button disabled className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">10 pts (Easy)</button>
                        <button disabled className="px-3 py-1.5 rounded-lg bg-muted/30 text-muted-foreground text-xs font-bold">20 pts (Medium)</button>
                        <button disabled className="px-3 py-1.5 rounded-lg bg-muted/30 text-muted-foreground text-xs font-bold">30 pts (Hard)</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Paste AI-Generated Questions</label>
                      <textarea disabled rows={4} placeholder="Paste 10 questions here from ChatGPT..." className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm opacity-70 resize-none" />
                    </div>
                    <Button size="sm" disabled className="w-full">Create Quiz</Button>
                  </div>
                </div>
                <Callout icon={<ClipboardList className="w-4 h-4" />}>
                  The tool parses questions in this format: "1. Question text? A) Option B) Option C) Option D) Option". It handles various formats automatically.
                </Callout>
              </StepContainer>
            )}

            {/* Step 4: Inbox & Messages */}
            {step === 4 && (
              <StepContainer
                title="DM-Style Inbox & Messages"
                icon={<Inbox className="w-6 h-6 text-primary" />}
                onNext={() => setStep(5)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  The inbox works like a DM page — a list of all your conversations with students. Click a student to open that conversation thread. You can reply, compose new messages, and send links. Students see your replies in their own inbox on the Library page.
                </p>
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="space-y-2">
                    {[
                      { name: "Maya R.", preview: "Thank you! I'll try that...", time: "10:30 AM" },
                      { name: "Devon K.", preview: "Can I retake the quiz?", time: "Yesterday" },
                      { name: "Aaliyah J.", preview: "I finished the book!", time: "Mon" },
                    ].map((msg) => (
                      <div key={msg.name} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {msg.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{msg.name}</p>
                            <span className="text-xs text-muted-foreground">{msg.time}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{msg.preview}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" disabled>Compose New Message</Button>
                  </div>
                </div>
                <Callout icon={<Inbox className="w-4 h-4" />}>
                  Clicking a conversation opens the full thread with chat bubbles. Students get a red badge on their inbox button when they have new messages.
                </Callout>
              </StepContainer>
            )}

            {/* Step 5: Notifications */}
            {step === 5 && (
              <StepContainer
                title="Notifications & Bell Icon"
                icon={<Bell className="w-6 h-6 text-primary" />}
                onNext={() => setStep(6)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  The bell icon shows notifications for book requests, new student sign-ups, and more. When you open the bell, the red badge clears automatically — just like iPhone notifications. Each item has an X to dismiss individually, or "Clear all" to dismiss everything.
                </p>
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Bell className="w-5 h-5 text-foreground" />
                        </div>
                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">2</span>
                      </div>
                      <span className="text-sm font-medium">Notifications</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-stretch rounded-lg bg-primary/5 border border-primary/30 hover:bg-muted/50">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <BookPlus className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">Harry Potter and the Sorcerer's Stone</p>
                          <p className="text-[11px] text-muted-foreground truncate">by J.K. Rowling — requested by Maya R.</p>
                        </div>
                      </div>
                      <button className="px-2 flex items-center text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                    </div>
                    <div className="flex items-stretch rounded-lg bg-muted/30 hover:bg-muted/50">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">New student: Aaliyah J.</p>
                          <p className="text-[11px] text-muted-foreground truncate">@aaliyahj</p>
                        </div>
                      </div>
                      <button className="px-2 flex items-center text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <button className="text-xs text-primary hover:underline">Clear all</button>
                  </div>
                </div>
                <Callout icon={<Bell className="w-4 h-4" />}>
                  Clicking a book request notification takes you straight to that request, with the Create Quiz dialog pre-filled with the book title and author.
                </Callout>
              </StepContainer>
            )}

            {/* Step 6: Library Overview */}
            {step === 6 && (
              <StepContainer
                title="The Full Quiz Library"
                icon={<BookOpen className="w-6 h-6 text-primary" />}
                onNext={() => setStep(7)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  This is the complete library of every quiz available on A.R.I.S.E Reader. Students see this when they log in. Books are organized by point value — 10 (easy), 20 (medium), 30 (hard). Search by title or author. Each book shows its cover, author, and points.
                </p>
                <div className="rounded-xl bg-muted/20 border border-border p-4 mb-4">
                  <div className="mb-3 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by title or author..."
                      value={libSearch}
                      onChange={(e) => setLibSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {booksLoading ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Loading quiz library...</p>
                    </div>
                  ) : displayBooks.filter(b =>
                    (b.title + " " + b.author).toLowerCase().includes(libSearch.toLowerCase())
                  ).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-2">No books found for "{libSearch}".</p>
                      <p className="text-xs text-primary">Students can request a quiz to be created!</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-3">
                        Showing {displayBooks.filter(b =>
                          (b.title + " " + b.author).toLowerCase().includes(libSearch.toLowerCase())
                        ).length} of {displayBooks.length} quizzes available
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {displayBooks.filter(b =>
                          (b.title + " " + b.author).toLowerCase().includes(libSearch.toLowerCase())
                        ).map((book) => (
                          <div key={book.id} className="rounded-lg overflow-hidden bg-card border border-border">
                            <div className="aspect-[2/3] overflow-hidden bg-muted">
                              {book.coverUrl ? (
                                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="p-2">
                              <p className="text-xs font-semibold truncate">{book.title}</p>
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                                book.pointsValue === 10 ? "bg-green-500/20 text-green-400" :
                                book.pointsValue === 20 ? "bg-primary/20 text-primary" :
                                "bg-red-500/20 text-red-400"
                              }`}>
                                <Trophy className="w-2.5 h-2.5" />
                                {book.pointsValue} pts
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <Callout icon={<BookOpen className="w-4 h-4" />}>
                  As an admin, you can add new books and quizzes anytime. Update covers, change points, and manage the full library from the admin dashboard.
                </Callout>
              </StepContainer>
            )}

            {/* Step 7: Progress Monitoring */}
            {step === 7 && (
              <StepContainer
                title="Progress Monitoring"
                icon={<Users className="w-6 h-6 text-primary" />}
                onNext={() => setStep(8)}
                onBack={() => setStep(6)}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Teachers and admins can monitor student progress from their dashboards. Here's what they can see:
                </p>
                <div className="space-y-2 mb-4">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold">Points Earned</p><p className="text-xs text-muted-foreground">Total points from all quizzes passed</p></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold">Quiz History</p><p className="text-xs text-muted-foreground">Which books were read and scores earned</p></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center gap-3">
                    <Award className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold">Certificates</p><p className="text-xs text-muted-foreground">Printable certificates for passed quizzes</p></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold">Reading Assessments</p><p className="text-xs text-muted-foreground">Round-based reading level assessments</p></div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-primary">Teachers:</strong> See progress for only your assigned students. <strong className="text-primary">Admins:</strong> See progress for all students across the platform.
                  </p>
                </div>
              </StepContainer>
            )}

            {/* Step 8: You're Ready */}
            {step === 8 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">You're Ready!</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  You've seen everything the admin dashboard has to offer. When you're ready to start managing students and quizzes for real, log in with your admin account.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" onClick={() => navigate("/")} className="gap-2">
                    <Sparkles className="w-5 h-5" />
                    Go to Login
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setStep(0)} className="gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Replay Tutorial
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => { setMode("select"); setStep(0); }} className="gap-2">
                    <BookUser className="w-5 h-5" />
                    Switch to Student Tutorial
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────

function StepContainer({
  title, icon, children, onNext, nextLabel, nextDisabled,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      {children}
      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={nextDisabled} className="gap-2">
          {nextLabel || "Next"} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function Callout({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
      <div className="text-primary flex-shrink-0 mt-0.5">{icon}</div>
      <p className="text-xs text-foreground">{children}</p>
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border">
      <div className="text-primary flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
