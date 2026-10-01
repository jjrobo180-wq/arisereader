import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Eye, Gamepad2, GraduationCap,
  Heart, Home, MessageCircle, ShieldCheck, Sparkles, Trophy, Users, X, Zap
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { FEATURE_TOURS, type TutorialRole } from "@/lib/featureTours";

function roleForUser(user: any): TutorialRole | null {
  if (!user) return null;
  if (user.role === "parent") return "parent";
  if (user.role === "teacher" || user.isAdmin) return "teacher";
  if (user.is_eye_gaze_user) return "eye-gaze";
  if (user.role === "student" || !user.role) return "student";
  return null;
}

function tokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/(?:^|; )arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

const roleTheme: Record<TutorialRole, {
  label: string;
  icon: any;
  accent: string;
  soft: string;
  gradient: string;
}> = {
  student: {
    label: "Student",
    icon: BookOpen,
    accent: "text-orange-300",
    soft: "bg-orange-400/15 border-orange-300/25",
    gradient: "from-orange-500/25 via-fuchsia-500/10 to-cyan-400/10",
  },
  teacher: {
    label: "Teacher",
    icon: GraduationCap,
    accent: "text-blue-300",
    soft: "bg-blue-400/15 border-blue-300/25",
    gradient: "from-blue-500/25 via-violet-500/10 to-cyan-400/10",
  },
  "eye-gaze": {
    label: "Eye Gazer",
    icon: Eye,
    accent: "text-cyan-300",
    soft: "bg-cyan-400/15 border-cyan-300/25",
    gradient: "from-cyan-500/25 via-violet-500/10 to-emerald-400/10",
  },
  parent: {
    label: "Parent",
    icon: Heart,
    accent: "text-violet-300",
    soft: "bg-violet-400/15 border-violet-300/25",
    gradient: "from-violet-500/25 via-fuchsia-500/10 to-orange-400/10",
  },
};

function miniCards(role: TutorialRole, step: number) {
  const sets: Record<TutorialRole, Array<Array<{ icon: string; title: string; sub: string }>>> = {
    teacher: [
      [
        { icon: "👥", title: "Students", sub: "Manage assigned readers" },
        { icon: "✅", title: "Quiz Review", sub: "Approve AI quizzes" },
        { icon: "⚡", title: "A.R.I.S.E. Live", sub: "Launch live games" },
      ],
      [
        { icon: "📊", title: "Progress", sub: "Points + quiz growth" },
        { icon: "🎁", title: "Rewards", sub: "Create incentives" },
        { icon: "🎮", title: "Game Rules", sub: "Control access" },
      ],
      [
        { icon: "👨‍👩‍👧", title: "Family", sub: "Parent connections" },
        { icon: "🔔", title: "Alerts", sub: "Pending work" },
        { icon: "👁️", title: "Eye Gazer", sub: "Accessible learning" },
      ],
    ],
    parent: [
      [
        { icon: "👧", title: "Ariana", sub: "Eye Gazer" },
        { icon: "📚", title: "Jordan", sub: "Reader" },
        { icon: "➕", title: "Add Child", sub: "One parent account" },
      ],
      [
        { icon: "📊", title: "Progress", sub: "Quiz history + growth" },
        { icon: "🏅", title: "Certificates", sub: "Celebrate wins" },
        { icon: "💬", title: "Messages", sub: "Stay connected" },
      ],
      [
        { icon: "🎮", title: "Game Time", sub: "Set daily limits" },
        { icon: "📺", title: "Shorts", sub: "Media controls" },
        { icon: "🗣️", title: "My Talker", sub: "AAC setup" },
      ],
    ],
    "eye-gaze": [
      [
        { icon: "🗣️", title: "My Talker", sub: "AAC communication" },
        { icon: "🎮", title: "Games", sub: "Large-target play" },
        { icon: "🌟", title: "Life Skills", sub: "Everyday routines" },
      ],
      [
        { icon: "🏠", title: "My World", sub: "Familiar spaces" },
        { icon: "📺", title: "A.R.I.S.E. Shorts", sub: "Learning videos" },
        { icon: "🃏", title: "Flash Cards", sub: "Picture + audio" },
      ],
      [
        { icon: "⭐", title: "My Progress", sub: "See growth" },
        { icon: "🤖", title: "My Buddy", sub: "Learning companion" },
        { icon: "🎨", title: "My Account", sub: "Personal choices" },
      ],
    ],
    student: [
      [
        { icon: "📚", title: "Library", sub: "Find books" },
        { icon: "🧠", title: "Quizzes", sub: "Show what you know" },
        { icon: "🏆", title: "Rewards", sub: "Earn + celebrate" },
      ],
    ],
  };
  const choices = sets[role];
  return choices[step % choices.length];
}

function VisualStage({ role, step }: { role: TutorialRole; step: number }) {
  const current = FEATURE_TOURS[role][step];
  const cards = miniCards(role, step);
  const theme = roleTheme[role];

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${theme.gradient} p-4 shadow-[0_25px_70px_rgba(0,0,0,.3)] sm:p-5`}>
      <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-white/[.05]" />
      <div className="absolute -right-2 top-4 h-24 w-24 rounded-full border border-white/[.05]" />

      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0a0d14]/95 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
          <div className="ml-2 flex-1 rounded-full bg-white/[.05] px-3 py-1 text-center text-[8px] font-black uppercase tracking-[.2em] text-white/25">
            A.R.I.S.E. {theme.label} Experience
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${theme.soft}`}>
              <span className="text-2xl">{current.emoji}</span>
            </div>
            <div className="min-w-0">
              <p className={`text-[9px] font-black uppercase tracking-[.2em] ${theme.accent}`}>{current.subtitle}</p>
              <h3 className="mt-1 text-lg font-black leading-tight text-white">{current.title}</h3>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {cards.map((card, index) => (
              <button
                key={card.title}
                type="button"
                className={`min-h-[112px] rounded-2xl border p-3 text-left transition hover:-translate-y-1 hover:border-white/25 ${index === step % 3 ? "border-white/20 bg-white/[.08] shadow-lg" : "border-white/8 bg-white/[.035]"}`}
              >
                <div className="text-2xl">{card.icon}</div>
                <div className="mt-3 text-xs font-black text-white">{card.title}</div>
                <div className="mt-1 text-[9px] font-semibold leading-4 text-white/35">{card.sub}</div>
              </button>
            ))}
          </div>

          {role === "parent" && (
            <div className="mt-3 flex gap-2 rounded-2xl border border-white/8 bg-white/[.025] p-2">
              <button className="flex-1 rounded-xl bg-violet-500/15 px-3 py-2 text-[10px] font-black text-violet-200">← Previous child</button>
              <div className="grid place-items-center rounded-xl border border-white/8 px-3 text-[9px] font-black text-white/40">Quick Switch</div>
              <button className="flex-1 rounded-xl bg-cyan-500/15 px-3 py-2 text-[10px] font-black text-cyan-200">Next child →</button>
            </div>
          )}

          {role === "teacher" && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["17", "Students"],
                ["4", "Pending"],
                ["82%", "Growth"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-black/20 p-2 text-center">
                  <div className="text-base font-black text-white">{value}</div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-white/30">{label}</div>
                </div>
              ))}
            </div>
          )}

          {role === "eye-gaze" && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {["YES", "MORE", "HELP", "STOP"].map(word => (
                <button key={word} className="min-h-12 rounded-xl border-2 border-cyan-300/20 bg-cyan-500/10 text-[10px] font-black text-cyan-100">
                  {word}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RoleFeatureTour() {
  const { user } = useAuth();
  const role = roleForUser(user);
  const isSample = !!user?.username?.startsWith("sample");
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const checked = useRef(false);

  const steps = useMemo(() => role ? FEATURE_TOURS[role] : [], [role]);
  const current = steps[step];
  const theme = role ? roleTheme[role] : null;
  const ThemeIcon = theme?.icon || Sparkles;

  useEffect(() => {
    if (!user || !role || checked.current) return;
    checked.current = true;

    const sampleKey = `arise_sample_tour_seen_${user.username}`;
    const versionKey = `arise_feature_tour_2026_10_${user.id}_${role}`;
    const alreadySeen = isSample
      ? sessionStorage.getItem(sampleKey) === "true"
      : localStorage.getItem(versionKey) === "true";
    if (alreadySeen) return;

    const open = () => setTimeout(() => setShow(true), 700);
    open();
  }, [user?.id, role, isSample]);

  const finish = async () => {
    if (isSample) {
      sessionStorage.setItem(`arise_sample_tour_seen_${user?.username}`, "true");
    } else {
      if (user?.id && role) localStorage.setItem(`arise_feature_tour_2026_10_${user.id}_${role}`, "true");
      const token = tokenFromCookie();
      if (token) {
        try {
          await fetch(`${API_BASE}/api/tutorial/dismiss`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
        } catch {}
      }
    }
    setShow(false);
  };

  if (!show || !role || !current || !theme) return null;

  const progress = ((step + 1) / steps.length) * 100;
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-black/85 p-3 backdrop-blur-md sm:p-5">
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center py-4">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#080b11] text-white shadow-[0_35px_120px_rgba(0,0,0,.6)]">
          <div className="h-1.5 bg-white/[.05]">
            <div className="h-full bg-gradient-to-r from-orange-400 via-violet-400 to-cyan-300 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          <button
            type="button"
            onClick={finish}
            className="absolute right-4 top-5 z-20 rounded-full border border-white/10 bg-black/30 p-2.5 text-white/55 backdrop-blur hover:bg-white/10 hover:text-white"
            aria-label="Close tour"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.75fr)]">
            <div className="border-b border-white/8 p-5 sm:p-7 lg:border-b-0 lg:border-r lg:p-8">
              <VisualStage role={role} step={step} />
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className={`grid h-9 w-9 place-items-center rounded-xl border ${theme.soft}`}><ThemeIcon className={`h-4 w-4 ${theme.accent}`} /></div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.22em] text-white/30">{theme.label} tour</p>
                    <p className="text-xs font-bold text-white/65">Interactive preview · Step {step + 1} of {steps.length}</p>
                  </div>
                </div>
                <div className="hidden gap-1.5 sm:flex">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Tour step ${i + 1}`}
                      onClick={() => setStep(i)}
                      className={`h-2 rounded-full transition-all ${i === step ? "w-7 bg-amber-300" : "w-2 bg-white/15 hover:bg-white/30"}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col p-6 sm:p-8 lg:p-9">
              <div className="pr-10">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.18em] ${theme.soft} ${theme.accent}`}>{theme.label}</span>
                  <span className="text-[9px] font-black uppercase tracking-[.18em] text-white/25">Updated for A.R.I.S.E. 2.0</span>
                </div>
                <div className="mt-5 text-5xl">{current.emoji}</div>
                <p className={`mt-4 text-xs font-black uppercase tracking-[.2em] ${theme.accent}`}>{current.subtitle}</p>
                <h2 className="mt-2 text-3xl font-black leading-[1.02] tracking-[-.04em] sm:text-4xl">{current.title}</h2>
              </div>

              <div className="mt-6 space-y-3">
                {current.details.map((detail, index) => (
                  <div key={detail} className="group flex gap-3 rounded-2xl border border-white/8 bg-white/[.035] p-4 transition hover:border-white/15 hover:bg-white/[.055]">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[.06]">
                      <CheckCircle2 className={`h-4 w-4 ${theme.accent}`} />
                    </div>
                    <p className="text-sm font-semibold leading-6 text-white/65">{detail}</p>
                  </div>
                ))}
              </div>

              {isSample && (
                <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/8 p-4">
                  <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Sample sandbox</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-emerald-50/65">Explore the full experience without entering real leaderboards, competition totals, or student game-time limits.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-auto pt-7">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-black text-white/55 hover:bg-white/5 hover:text-white disabled:opacity-20"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>

                  <button
                    type="button"
                    onClick={() => isLast ? void finish() : setStep(s => Math.min(steps.length - 1, s + 1))}
                    className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-slate-950 shadow-lg hover:bg-white/90"
                  >
                    {isLast ? "Start Exploring" : "Next"}
                    {!isLast && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>

                {!isFirst && !isLast && (
                  <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-white/20">Tap the preview cards too — the tour is meant to feel like the real product.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
