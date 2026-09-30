import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, BookOpen, Eye, GraduationCap, Heart, PlayCircle, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FEATURE_TOURS, type TutorialRole } from "@/lib/featureTours";

const ROLE_INFO: Record<TutorialRole, { label: string; short: string; icon: any; accent: string }> = {
  student: {
    label: "Student",
    short: "Library, quizzes, iARISE, rewards, A.R.I.S.E. 2.0, games, avatars, pets, worlds, progress, and more.",
    icon: BookOpen,
    accent: "from-orange-500/20 to-amber-500/5",
  },
  teacher: {
    label: "Teacher",
    short: "Students, quiz review, live quizzes, rewards, progress, parent connections, and Club A.R.I.S.E. controls.",
    icon: UserCog,
    accent: "from-blue-500/20 to-cyan-500/5",
  },
  "eye-gaze": {
    label: "Eye Gazer",
    short: "My Talker, visual quizzes, games, Life Skills, My World, Shorts, Flash Cards, My Buddy, and progress.",
    icon: Eye,
    accent: "from-teal-500/20 to-emerald-500/5",
  },
  parent: {
    label: "Parent",
    short: "Linked-child progress, certificates, messaging, Eye Gazer family controls, AAC setup, My World, and Life Skills.",
    icon: Heart,
    accent: "from-purple-500/20 to-pink-500/5",
  },
};

function roleFromHash(): TutorialRole | "select" {
  if (typeof window === "undefined") return "select";
  const hash = window.location.hash || "";
  if (hash.includes("/tutorial/student")) return "student";
  if (hash.includes("/tutorial/teacher")) return "teacher";
  if (hash.includes("/tutorial/eye-gaze")) return "eye-gaze";
  if (hash.includes("/tutorial/parent")) return "parent";
  return "select";
}

export default function Tutorial() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<TutorialRole | "select">(roleFromHash);
  const [step, setStep] = useState(0);

  const steps = useMemo(() => mode === "select" ? [] : FEATURE_TOURS[mode], [mode]);
  const current = mode === "select" ? null : steps[step];
  const progress = steps.length ? ((step + 1) / steps.length) * 100 : 0;

  const selectMode = (role: TutorialRole) => {
    setMode(role);
    setStep(0);
    window.history.replaceState(null, "", `#/tutorial/${role}`);
  };

  if (mode === "select") {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-primary px-4 py-2 text-center text-xs font-black tracking-wide text-white">
          A.R.I.S.E. READER TUTORIALS — No login required. Nothing is saved.
        </div>

        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">A.R.I.S.E. Reader</p>
              <h1 className="text-xl font-black text-foreground">Choose a tutorial</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>Exit to Login</Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-3xl font-black text-foreground sm:text-4xl">See the current platform before you log in</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Each tutorial reflects the current A.R.I.S.E. experience and walks through the major tools available to that account type.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(ROLE_INFO) as TutorialRole[]).map((role) => {
              const info = ROLE_INFO[role];
              const Icon = info.icon;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectMode(role)}
                  className={`group rounded-3xl border-2 border-border bg-gradient-to-br ${info.accent} p-6 text-left transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl`}
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-sm">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-black text-foreground">{info.label} Tutorial</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{info.short}</p>
                  <div className="mt-5 flex items-center gap-2 text-sm font-black text-primary">
                    <PlayCircle className="h-4 w-4" /> Start {info.label} Tutorial
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-bold text-foreground">Tutorials and sample accounts are different.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tutorials explain the features without logging in. “Try Sample Account” on the login page opens a real sandbox experience for Student, Eye Gazer, or Parent.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const info = ROLE_INFO[mode];
  const Icon = info.icon;
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-slate-950 px-4 py-2 text-center text-xs font-black tracking-wide text-white">
        {info.label.toUpperCase()} TUTORIAL — CURRENT A.R.I.S.E. FEATURE GUIDE
      </div>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">{info.label} Tutorial</p>
              <h1 className="font-black text-foreground">{current?.title}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setMode("select"); setStep(0); window.history.replaceState(null, "", "#/tutorial"); }}>
              All Tutorials
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>Login</Button>
          </div>
        </div>
        <div className="h-1.5 bg-muted">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted-foreground">
          <span>Step {step + 1} of {steps.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>

        <Card className="overflow-hidden border-2 shadow-xl">
          <CardContent className="p-0">
            <div className={`bg-gradient-to-br ${info.accent} p-7 sm:p-10`}>
              <div className="mb-5 text-6xl">{current?.emoji}</div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{current?.subtitle}</p>
              <h2 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">{current?.title}</h2>
            </div>

            <div className="p-6 sm:p-8">
              <div className="space-y-3">
                {current?.details.map((detail, index) => (
                  <div key={detail} className="flex gap-3 rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                      {index + 1}
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground">{detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button variant="outline" disabled={isFirst} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>

                <div className="hidden gap-1.5 sm:flex">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to step ${i + 1}`}
                      onClick={() => setStep(i)}
                      className={`h-2.5 rounded-full transition-all ${i === step ? "w-7 bg-primary" : "w-2.5 bg-muted-foreground/25"}`}
                    />
                  ))}
                </div>

                {isLast ? (
                  <Button onClick={() => navigate("/")}>
                    Finish & Return to Login
                  </Button>
                ) : (
                  <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
