import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Settings2, ShoppingBag,
  SlidersHorizontal, Sparkles, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type TourRole = "teacher" | "parent";

type TourStep = {
  title: string;
  subtitle: string;
  icon: any;
  details: string[];
};

function tokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/(?:^|; )arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

// Short, practical first-time walkthrough of A.R.I.S.E. To-Do itself (the
// Work/Life hub app) — not the Reader's own reading/quiz tour, which is a
// separate, unrelated flow (RoleFeatureTour). This one is about finding your
// way around: switching hubs, finding the Reader, the App Store, and
// customizing the hub.
const TOUR_STEPS: Record<TourRole, TourStep[]> = {
  teacher: [
    {
      title: "Welcome to A.R.I.S.E. To-Do",
      subtitle: "Your Work Hub, in one place",
      icon: Sparkles,
      details: [
        "This is your Work Hub — your class to-dos, tools, and A.R.I.S.E. Reader all live here.",
        "A quick tour of where everything is, just this once.",
      ],
    },
    {
      title: "Switch between Work and Life",
      subtitle: "Two hubs, one account",
      icon: SlidersHorizontal,
      details: [
        "Use the Work / Life switch near the top to move between your Work Hub (class tools) and your Life Hub (personal to-dos).",
        "You can switch back and forth any time — nothing you do in one hub affects the other.",
      ],
    },
    {
      title: "Find A.R.I.S.E. Reader",
      subtitle: "Your reading program lives right in the menu",
      icon: BookOpen,
      details: [
        "Look for the violet \"A.R.I.S.E. Reader\" button in your menu — it's the big highlighted one.",
        "Tap it to jump straight to your Reader Overview: students, quizzes, live games, and more.",
      ],
    },
    {
      title: "Browse the App Store",
      subtitle: "Add more tools to your hub",
      icon: ShoppingBag,
      details: [
        "The App Store (the shopping-bag icon) lets you add extra tools and apps to your Work Hub.",
        "Everything there is optional — add only what helps your class.",
      ],
    },
    {
      title: "Make it yours",
      subtitle: "Customize your hub",
      icon: Settings2,
      details: [
        "Tap Customize to reorder or hide tabs, and to pick your own accent color.",
        "Set it up once the way you like, and it stays that way every time you come back.",
      ],
    },
  ],
  parent: [
    {
      title: "Welcome to A.R.I.S.E. To-Do",
      subtitle: "Your family's hub, in one place",
      icon: Sparkles,
      details: [
        "This is your hub — family to-dos, tools, and A.R.I.S.E. Reader all live here.",
        "A quick tour of where everything is, just this once.",
      ],
    },
    {
      title: "Switch between Work and Life",
      subtitle: "Two hubs, one account",
      icon: SlidersHorizontal,
      details: [
        "Use the Work / Life switch near the top to move between your Work Hub and your Life Hub (personal, family to-dos).",
        "You can switch back and forth any time — nothing you do in one hub affects the other.",
      ],
    },
    {
      title: "Find A.R.I.S.E. Reader",
      subtitle: "Your child's reading program is right in the menu",
      icon: BookOpen,
      details: [
        "Look for the violet \"A.R.I.S.E. Reader\" button in your menu — it's the big highlighted one.",
        "Tap it to see your linked child's reading progress, certificates, and more.",
      ],
    },
    {
      title: "Browse the App Store",
      subtitle: "Add more tools to your hub",
      icon: ShoppingBag,
      details: [
        "The App Store (the shopping-bag icon) lets you add extra tools and apps to your hub.",
        "Everything there is optional — add only what's useful for your family.",
      ],
    },
    {
      title: "Make it yours",
      subtitle: "Customize your hub",
      icon: Settings2,
      details: [
        "Tap Customize to reorder or hide tabs, and to pick your own accent color.",
        "Set it up once the way you like, and it stays that way every time you come back.",
      ],
    },
  ],
};

function roleForUser(user: any): TourRole | null {
  if (!user) return null;
  if (user.role === "parent") return "parent";
  if (user.role === "teacher" || user.isAdmin) return "teacher";
  return null;
}

export default function WorkHubTour() {
  const { user } = useAuth();
  const role = roleForUser(user);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const checked = useRef(false);

  const steps = useMemo(() => (role ? TOUR_STEPS[role] : []), [role]);
  const current = steps[step];

  useEffect(() => {
    if (!user || !role || checked.current) return;
    checked.current = true;

    const versionKey = `arise_todo_tour_seen_${user.id}_${role}`;
    if (localStorage.getItem(versionKey) === "true") return;

    // Also check the server flag, so a user who already dismissed this on
    // another device doesn't see it again here.
    (async () => {
      try {
        const token = tokenFromCookie();
        if (!token) {
          setTimeout(() => setShow(true), 600);
          return;
        }
        const res = await fetch(`${API_BASE}/api/todo-tour/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({ shown: false }));
        if (data?.shown) {
          localStorage.setItem(versionKey, "true");
          return;
        }
        setTimeout(() => setShow(true), 600);
      } catch {
        setTimeout(() => setShow(true), 600);
      }
    })();
  }, [user?.id, role]);

  const finish = async () => {
    if (user?.id && role) localStorage.setItem(`arise_todo_tour_seen_${user.id}_${role}`, "true");
    setShow(false);
    const token = tokenFromCookie();
    if (token) {
      try {
        await fetch(`${API_BASE}/api/todo-tour/dismiss`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
      } catch {}
    }
  };

  if (!show || !role || !current) return null;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const progress = ((step + 1) / steps.length) * 100;
  const Icon = current.icon;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="A.R.I.S.E. To-Do quick tour"
    >
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-[0_-20px_60px_rgba(30,34,80,.25)] sm:max-h-[85vh] sm:w-full sm:max-w-md sm:rounded-[1.75rem] sm:shadow-[0_30px_90px_rgba(30,34,80,.25)]">
        <div className="h-1.5 w-full bg-slate-100">
          <div
            className="h-full bg-violet-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          type="button"
          onClick={finish}
          aria-label="Close tour"
          className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex-1 overflow-y-auto px-6 pb-2 pt-7 sm:px-7">
          <div className="flex items-center gap-2 pr-10">
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">
              {role === "teacher" ? "Teacher" : "Parent"} quick tour
            </span>
            <span className="text-xs font-medium text-slate-400">
              Step {step + 1} of {steps.length}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-600">{current.subtitle}</p>
              <h2 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                {current.title}
              </h2>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            {current.details.map((detail) => (
              <div key={detail} className="flex gap-2.5 rounded-xl bg-slate-50 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <p className="text-sm font-medium leading-5 text-slate-700">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-6 bg-violet-600" : "w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 sm:px-7">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 disabled:opacity-0"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? void finish() : setStep((s) => Math.min(steps.length - 1, s + 1)))}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
          >
            {isLast ? "Got it, let's go" : "Next"}
            {!isLast && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
