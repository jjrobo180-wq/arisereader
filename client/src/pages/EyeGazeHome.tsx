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
  { title: "Talk", subtitle: "Say what I want", emoji: "🗣️", path: "/eye-gaze-talker", bg: "#e3f3ef", ink: "#1f6f65", primary: true },
  { title: "Play", subtitle: "Fun games", emoji: "🎮", path: "/eye-gaze-games", bg: "#fdeedd", ink: "#a85d17", primary: true },
  { title: "Learn", subtitle: "Lessons and books", emoji: "📚", path: "/eye-gaze-lessons", bg: "#e5edfb", ink: "#2f5fae", primary: true },
  { title: "Life Skills", subtitle: "Every day steps", emoji: "🌟", path: "/eye-gaze-life-skills", bg: "#fbf3d6", ink: "#8a6a10", primary: true },
  { title: "My World", subtitle: "My rooms and people", emoji: "🏠", path: "/my-world", bg: "#e6f4e2", ink: "#3c7a32", primary: true },
  { title: "Shorts", subtitle: "Short videos", emoji: "📺", path: "/eye-gaze-tv", bg: "#eef0f4", ink: "#46506a", primary: false },
  { title: "Flash Cards", subtitle: "See it, hear it", emoji: "🃏", path: "/eye-gaze-flashcards", bg: "#eef0f4", ink: "#46506a", primary: false },
  { title: "My Buddy", subtitle: "My learning friend", emoji: "🐶", path: "/eye-gaze-buddy", bg: "#eef0f4", ink: "#46506a", primary: false },
  { title: "My Stars", subtitle: "What I learned", emoji: "⭐", path: "/leaderboard", bg: "#eef0f4", ink: "#46506a", primary: false },
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
    : path === "/eye-gaze-lessons" ? pathAllowed("/library", controls) : pathAllowed(path, controls);
  const visible = ACTIONS.filter(action => allowed(action.path));
  const primary = visible.filter(action => action.primary);
  const more = visible.filter(action => !action.primary);
  const open = (action: HomeAction) => { sayIt(action.title); navigate(action.path); };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-8 pt-5 sm:px-6">
      <QuizReadyBanner />
      <section className="flex items-center gap-4 rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(31,38,51,.06)] sm:p-6">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[#fff4d6] text-4xl sm:h-20 sm:w-20 sm:text-5xl" aria-hidden>😊</div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.015em] text-[#1f2633] sm:text-4xl">{greeting()}, {firstName}!</h1>
          <p className="mt-1 text-[17px] font-semibold text-[#6b7180] sm:text-xl">What do you want to do?</p>
          {controls.enabled && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#e3f3ef] px-3 py-1 text-xs font-bold text-[#1f6f65]">👨‍👩‍👧 A grown-up set up my choices</p>}
        </div>
        <button type="button" onClick={() => navigate("/leaderboard")} className="eg-press hidden flex-shrink-0 flex-col items-center rounded-2xl bg-[#fbf3d6] px-4 py-2.5 sm:flex" aria-label={`${stats.totalPoints} stars`}>
          <span className="text-2xl font-extrabold text-[#8a6a10]">⭐ {stats.totalPoints}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#a88a35]">Stars</span>
        </button>
      </section>

      <section aria-label="Choices" className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {primary.map((action, i) => (
          <button key={action.path} type="button" onClick={() => open(action)}
            className={"eg-press flex min-h-[176px] flex-col items-center justify-center rounded-[28px] p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,.04)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8f83]/40 sm:min-h-[210px] " + (primary.length % 2 === 1 && i === primary.length - 1 ? "col-span-2 " : "") + (primary.length === 5 ? (i < 3 ? "lg:col-span-2" : "lg:col-span-3") : "lg:col-span-2")}
            style={{ background: action.bg }}>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/80 text-[46px] sm:h-24 sm:w-24 sm:text-[54px]" aria-hidden>{action.emoji}</span>
            <span className="mt-3 text-[24px] font-extrabold leading-tight sm:text-[28px]" style={{ color: action.ink }}>{action.title}</span>
            <span className="mt-0.5 text-[14px] font-semibold text-[#6b7180] sm:text-base">{action.subtitle}</span>
          </button>
        ))}
      </section>

      {!!more.length && (
        <section aria-label="More" className="rounded-[28px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(31,38,51,.05)] sm:p-5">
          <h2 className="mb-3 px-1 text-[15px] font-bold text-[#7a8090]">More</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {more.map(action => (
              <button key={action.path} type="button" onClick={() => open(action)} className="eg-press flex min-h-[108px] flex-col items-center justify-center rounded-[22px] p-3 text-center focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8f83]/40" style={{ background: action.bg }}>
                <span className="text-[36px]" aria-hidden>{action.emoji}</span>
                <span className="mt-1 text-[17px] font-extrabold" style={{ color: action.ink }}>{action.title}</span>
                <span className="text-[12.5px] font-semibold text-[#7a8090]">{action.subtitle}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
