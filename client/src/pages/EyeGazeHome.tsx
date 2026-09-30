import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { cachedParentControls, fetchFamilySettings, pathAllowed, type ParentControls } from "@/lib/parentControls";
import { Arise2HomeAnnouncement } from "@/components/Arise2Update";

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
  tone: string;
  primary: boolean;
};

const ACTIONS: HomeAction[] = [
  { title: "My Talker", subtitle: "Talk, learn words, and communicate", emoji: "🗣️", path: "/eye-gaze-talker", tone: "from-teal-100 to-cyan-50 border-teal-200", primary: true },
  { title: "Games", subtitle: "Play reading games and open lessons & books", emoji: "🎮", path: "/eye-gaze-games", tone: "from-amber-100 to-orange-50 border-amber-200", primary: true },
  { title: "Life Skills", subtitle: "Practice everyday routines like potty training", emoji: "🌟", path: "/eye-gaze-life-skills", tone: "from-cyan-100 to-emerald-50 border-cyan-200", primary: true },
  { title: "My World", subtitle: "Learn with familiar rooms, pictures & videos", emoji: "🏠", path: "/my-world", tone: "from-emerald-100 to-lime-50 border-emerald-200", primary: true },
  { title: "A.R.I.S.E. Shorts", subtitle: "Learning Shorts picked for me", emoji: "📺", path: "/eye-gaze-tv", tone: "from-teal-50 to-emerald-50 border-teal-100", primary: false },
  { title: "Flash Cards", subtitle: "Swipe, see it & hear it", emoji: "🃏", path: "/eye-gaze-flashcards", tone: "from-cyan-50 to-sky-50 border-cyan-100", primary: false },
  { title: "My Buddy", subtitle: "Open my learning buddy", emoji: "🐶", path: "/eye-gaze-buddy", tone: "from-violet-50 to-fuchsia-50 border-violet-100", primary: false },
  { title: "My Progress", subtitle: "See what I learned", emoji: "⭐", path: "/leaderboard", tone: "from-yellow-50 to-amber-50 border-yellow-100", primary: false },
];

export default function EyeGazeHome() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState({ totalPoints: user?.totalPoints || 0, activities: 0, rank: null as number | null });
  const [controls, setControls] = useState<ParentControls>(cachedParentControls());

  useEffect(() => {
    let active = true;
    void fetchFamilySettings(token).then(result => {
      if (active) setControls(result.settings);
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

  const firstName = user?.displayName?.split(" ")[0] || user?.username || "Reader";
  const visible = ACTIONS.filter(action => pathAllowed(action.path, controls) || (action.path === "/eye-gaze-games" && pathAllowed("/library", controls)));
  const primary = visible.filter(action => action.primary);
  const more = visible.filter(action => !action.primary);

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <Arise2HomeAnnouncement />
      <section className="rounded-[2rem] bg-gradient-to-r from-teal-100 via-emerald-50 to-amber-50 border border-sky-100 p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-widest text-blue-600">My Learning Home</p>
            <h1 className="text-3xl sm:text-5xl font-black text-blue-950 mt-1">Hi, {firstName}! 👋</h1>
            <p className="text-lg font-bold text-slate-600 mt-2">Choose one place to start. The main choices are first.</p>
            {controls.enabled && <p className="mt-2 inline-block rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black">👨‍👩‍👧 Grown-up learning plan is on</p>}
          </div>
          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
            <div className="rounded-2xl bg-white px-4 py-3 text-center border border-sky-100"><div className="text-2xl font-black">{stats.totalPoints}</div><div className="text-[10px] font-black uppercase text-slate-400">Points</div></div>
            <div className="rounded-2xl bg-white px-4 py-3 text-center border border-sky-100"><div className="text-2xl font-black">{stats.activities}</div><div className="text-[10px] font-black uppercase text-slate-400">Activities</div></div>
            <div className="rounded-2xl bg-white px-4 py-3 text-center border border-sky-100"><div className="text-2xl font-black">{stats.rank ? "#" + stats.rank : "—"}</div><div className="text-[10px] font-black uppercase text-slate-400">Rank</div></div>
          </div>
        </div>
      </section>

      <section aria-label="Main choices">
        <h2 className="text-sm font-black tracking-widest text-slate-500 mb-3">START HERE</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {primary.map(action => (
            <button key={action.path} type="button" onClick={() => navigate(action.path)} className={"min-h-[185px] rounded-[2rem] border-2 bg-gradient-to-br " + action.tone + " p-5 text-left hover:-translate-y-1 hover:shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-blue-200"}>
              <div className="text-5xl mb-3">{action.emoji}</div>
              <div className="text-2xl sm:text-3xl font-black text-blue-950">{action.title}</div>
              <div className="text-sm sm:text-base font-bold text-slate-600 mt-1">{action.subtitle}</div>
            </button>
          ))}
        </div>
      </section>

      {!!more.length && (
        <section className="rounded-[2rem] bg-white/80 border border-slate-100 p-4 sm:p-5">
          <h2 className="text-sm font-black tracking-widest text-slate-500 mb-3">MORE</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {more.map(action => (
              <button key={action.path} type="button" onClick={() => navigate(action.path)} className={"min-h-[120px] rounded-3xl border-2 bg-gradient-to-br " + action.tone + " p-4 text-left hover:shadow-md transition-all focus:outline-none focus:ring-4 focus:ring-blue-200"}>
                <div className="text-3xl mb-2">{action.emoji}</div>
                <div className="text-lg font-black text-blue-950">{action.title}</div>
                <div className="text-xs sm:text-sm font-bold text-slate-600 mt-1">{action.subtitle}</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
