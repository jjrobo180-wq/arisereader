import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
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

export default function RoleFeatureTour() {
  const { user } = useAuth();
  const role = roleForUser(user);
  const isSample = !!user?.username?.startsWith("sample");
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const checked = useRef(false);

  const steps = useMemo(() => role ? FEATURE_TOURS[role] : [], [role]);
  const current = steps[step];

  useEffect(() => {
    if (!user || !role || checked.current) return;
    checked.current = true;

    const sampleKey = `arise_sample_tour_seen_${user.username}`;
    const versionKey = `arise_feature_tour_2026_09_${user.id}_${role}`;
    const alreadySeen = isSample
      ? sessionStorage.getItem(sampleKey) === "true"
      : localStorage.getItem(versionKey) === "true";
    if (alreadySeen) return;

    const open = () => setTimeout(() => setShow(true), 700);
    if (role === "student" && sessionStorage.getItem("show_profile_setup") === "true") {
      const poll = window.setInterval(() => {
        if (sessionStorage.getItem("show_profile_setup") !== "true") {
          window.clearInterval(poll);
          open();
        }
      }, 400);
      window.setTimeout(() => { window.clearInterval(poll); open(); }, 12000);
    } else {
      open();
    }
  }, [user?.id, role, isSample]);

  const finish = async () => {
    if (isSample) {
      sessionStorage.setItem(`arise_sample_tour_seen_${user?.username}`, "true");
    } else {
      if (user?.id && role) localStorage.setItem(`arise_feature_tour_2026_09_${user.id}_${role}`, "true");
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

  if (!show || !role || !current) return null;

  const progress = ((step + 1) / steps.length) * 100;
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl">
        <button
          type="button"
          onClick={finish}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white"
          aria-label="Close tour"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="h-2 overflow-hidden rounded-t-[2rem] bg-white/10">
          <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-6 sm:p-8">
          <div className="pr-10">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">
              {role === "eye-gaze" ? "Eye Gazer" : role.charAt(0).toUpperCase() + role.slice(1)} Tour · {step + 1}/{steps.length}
            </p>
            <div className="mt-4 text-6xl">{current.emoji}</div>
            <p className="mt-4 text-sm font-black uppercase tracking-widest text-cyan-300">{current.subtitle}</p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">{current.title}</h2>
          </div>

          <div className="mt-6 space-y-3">
            {current.details.map((detail, index) => (
              <div key={detail} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-slate-950">
                  {index + 1}
                </div>
                <p className="text-sm font-medium leading-relaxed text-slate-200">{detail}</p>
              </div>
            ))}
          </div>

          {isSample && (
            <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              <strong className="text-emerald-300">Sample mode:</strong> explore freely. Demo activity is kept out of student leaderboards and competitions.
            </div>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={isFirst}
              onClick={() => setStep(s => Math.max(0, s - 1))}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10 disabled:opacity-25"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="hidden gap-1 sm:flex">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Tour step ${i + 1}`}
                  onClick={() => setStep(i)}
                  className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-amber-400" : "w-2 bg-white/20"}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => isLast ? void finish() : setStep(s => Math.min(steps.length - 1, s + 1))}
              className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300"
            >
              {isLast ? "Start Exploring" : "Next"}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
