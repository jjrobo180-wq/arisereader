import { sayAI } from "@/lib/aiVoice";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { QuizReadyBanner } from "@/components/QuizReadyBanner";
import { cachedParentControls, fetchFamilySettings, pathAllowed, type ParentControls } from "@/lib/parentControls";

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

type HomeAction = {
  title: string;
  subtitle: string;
  emoji: string;
  path: string;
  /** Soft background and a deeper ink for the label (calm, low-saturation colours). */
  bg: string;
  ink: string;
  primary: boolean;
};

// Few, large, always in the same place: children (autistic children especially) find their way by where things
// are, so the order never changes and each choice is one word with one picture.
const ACTIONS: HomeAction[] = [
  { title: "Talk", subtitle: "Say what I want", emoji: "🗣️", path: "/eye-gaze-talker", bg: "#ede9fe", ink: "#191b35", primary: true },
  { title: "Play", subtitle: "Fun games", emoji: "🎮", path: "/eye-gaze-games", bg: "#ffedd5", ink: "#191b35", primary: true },
  { title: "Learn", subtitle: "Lessons and books", emoji: "📚", path: "/eye-gaze-lessons", bg: "#e0f2fe", ink: "#191b35", primary: true },
  { title: "Life Skills", subtitle: "Every day steps", emoji: "🌟", path: "/eye-gaze-life-skills", bg: "#fef3c7", ink: "#191b35", primary: true },
  { title: "My World", subtitle: "My rooms and people", emoji: "🏠", path: "/my-world", bg: "#dcfce7", ink: "#191b35", primary: true },
  { title: "Wren", subtitle: "My AI voice", emoji: "🐦", path: "/eye-gaze-wren", bg: "#fce7f3", ink: "#191b35", primary: true },
  { title: "Shorts", subtitle: "Short videos", emoji: "📺", path: "/eye-gaze-tv", bg: "#f1f5f9", ink: "#191b35", primary: false },
  { title: "Flash Cards", subtitle: "See it, hear it", emoji: "🃏", path: "/eye-gaze-flashcards", bg: "#f1f5f9", ink: "#191b35", primary: false },
  { title: "My Buddy", subtitle: "My learning friend", emoji: "🐶", path: "/eye-gaze-buddy", bg: "#f1f5f9", ink: "#191b35", primary: false },
  { title: "My Stars", subtitle: "What I learned", emoji: "⭐", path: "/leaderboard", bg: "#f1f5f9", ink: "#191b35", primary: false },
];

/** Says the choice out loud with the app's natural AI voice (never the phone's robot voice), as it opens:
 *  children who don't read yet hear where they're going. Quietly does nothing when there's no voice. */
function sayIt(text: string) {
  void sayAI(text, { voice: "calm" }).catch(() => false);
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export default function EyeGazeHome() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState({ totalPoints: user?.totalPoints || 0, activities: 0, rank: null as number | null });
  const [controls, setControls] = useState<ParentControls>(cachedParentControls());

  useEffect(() => {
    let active = true;
    void fetchFamilySettings(token).then(result => {
      if (active && result?.settings) setControls(result.settings);
    }).catch(() => {});
    return () => { active = false; };
  }, [token, user?.id]);

  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    Promise.all([
      fetch(API_BASE + "/api/profile", { headers: { Authorization: "Bearer " + authToken }, cache: "no-store" }).then(r => r.ok ? r.json() : null),
      fetch(API_BASE + "/api/eye-gaze-band-rank", { headers: { Authorization: "Bearer " + authToken }, cache: "no-store" }).then(r => r.ok ? r.json() : null),
      fetch(API_BASE + "/api/eye-gaze/profile", { headers: { Authorization: "Bearer " + authToken }, cache: "no-store" }).then(r => r.ok ? r.json() : null),
    ]).then(([profile, rank, eye]) => setStats({
      totalPoints: profile?.totalPoints ?? user?.totalPoints ?? 0,
      activities: eye?.total_completed ?? (Array.isArray(profile?.quizResults) ? profile.quizResults.length : 0),
      rank: rank?.eyeGazeRank || rank?.overallRank || null,
    })).catch(() => {});
  }, [token, user?.id, user?.totalPoints]);

  const firstName = user?.displayName?.split(" ")[0] || user?.username || "Friend";
  const allowed = (path: string) => path === "/eye-gaze-games" ? (pathAllowed(path, controls) || pathAllowed("/library", controls))
    : path === "/eye-gaze-lessons" ? pathAllowed("/library", controls)
    : path === "/eye-gaze-wren" ? pathAllowed("/eye-gaze-talker", controls) : pathAllowed(path, controls);
  const visible = ACTIONS.filter(action => allowed(action.path));
  const primary = visible.filter(action => action.primary);
  const more = visible.filter(action => !action.primary);
  const open = (action: HomeAction) => { sayIt(action.title); navigate(action.path); };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-8 pt-5 sm:px-6">
      <QuizReadyBanner />
      <section className="flex items-center gap-4 rounded-[1.75rem] border border-[#e5e8f4] bg-white p-5 shadow-xl shadow-violet-100/60 sm:p-6">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-4xl sm:h-20 sm:w-20 sm:text-5xl" aria-hidden>😊</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[.22em] text-violet-700">Eye Gazer</p>
          <h1 className="mt-1 text-[26px] font-black leading-tight tracking-tight text-[#191b35] sm:text-4xl">{greeting()}, <span className="text-violet-700">{firstName}!</span></h1>
          <p className="mt-1 text-[17px] font-medium text-slate-600 sm:text-xl">What do you want to do?</p>
          {controls.enabled && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">👨‍👩‍👧 A grown-up set up my choices</p>}
        </div>
        <button type="button" onClick={() => navigate("/leaderboard")} className="eg-press hidden flex-shrink-0 flex-col items-center rounded-2xl bg-violet-700 px-4 py-2.5 text-white shadow-lg shadow-violet-200 sm:flex" aria-label={`${stats.totalPoints} stars`}>
          <span className="text-2xl font-extrabold">⭐ {stats.totalPoints}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-200">Stars</span>
        </button>
      </section>

      <section aria-label="Choices" className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {primary.map((action, i) => (
          <button key={action.path} type="button" onClick={() => open(action)}
            className={"eg-press flex min-h-[176px] flex-col items-center justify-center rounded-[1.75rem] border border-[#e5e8f4] bg-white p-4 text-center shadow-sm hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-600/40 sm:min-h-[210px] " + (primary.length % 2 === 1 && i === primary.length - 1 ? "col-span-2 " : "") + (primary.length === 5 ? (i < 3 ? "lg:col-span-2" : "lg:col-span-3") : "lg:col-span-2")}
            >
            <span className="flex h-20 w-20 items-center justify-center rounded-full text-[46px] sm:h-24 sm:w-24 sm:text-[54px]" style={{ background: action.bg }} aria-hidden>{action.emoji}</span>
            <span className="eg-title mt-3 text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px]" style={{ color: action.ink }}>{action.title}</span>
            <span className="mt-0.5 text-[14px] font-medium text-slate-500 sm:text-base">{action.subtitle}</span>
          </button>
        ))}
      </section>

      {!!more.length && (
        <section aria-label="More" className="rounded-[1.75rem] border border-[#e5e8f4] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 px-1 text-xs font-black uppercase tracking-[.22em] text-violet-700">More</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {more.map(action => (
              <button key={action.path} type="button" onClick={() => open(action)} className="eg-press flex min-h-[108px] flex-col items-center justify-center rounded-[1.25rem] border border-[#eef0f6] bg-[#fafaff] p-3 text-center hover:border-violet-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-600/40">
                <span className="text-[36px]" aria-hidden>{action.emoji}</span>
                <span className="mt-1 text-[17px] font-extrabold" style={{ color: action.ink }}>{action.title}</span>
                <span className="text-[12.5px] font-medium text-slate-500">{action.subtitle}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
