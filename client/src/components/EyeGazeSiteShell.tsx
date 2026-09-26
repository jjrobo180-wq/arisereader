import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, Gamepad2, Home, LogOut, Trophy, UserRound, Users } from "lucide-react";

export default function EyeGazeSiteShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  const isEyeGazer = !!user && !!user.is_eye_gaze_user && !user.isAdmin && user.role !== "teacher" && user.role !== "parent";
  const immersive = location.startsWith("/eye-gaze-quiz/") || location.startsWith("/custom-quiz/") || location.startsWith("/read/") || location.startsWith("/arise-city");

  if (!isEyeGazer || immersive) return <>{children}</>;

  const nav = [
    { label: "Home", icon: Home, path: "/eye-gaze-home" },
    { label: "Read", icon: BookOpen, path: "/library" },
    { label: "Games", icon: Gamepad2, path: "/eye-gaze-games" },
    { label: "Progress", icon: Trophy, path: "/leaderboard" },
    { label: "My Buddy", icon: Users, path: "/profile" },
    { label: "Profile", icon: UserRound, path: "/eye-gaze-account" },
  ];

  return (
    <div data-eye-gaze-shell className="min-h-screen bg-[#f7fbff] text-slate-900">
      <style>{`
        [data-eye-gaze-shell] {
          --background: 210 100% 98%;
          --foreground: 222 47% 11%;
          --card: 0 0% 100%;
          --card-foreground: 222 47% 11%;
          --muted: 210 40% 96%;
          --muted-foreground: 215 16% 47%;
          --border: 214 32% 91%;
        }
        [data-eye-gaze-shell] .eye-gaze-page {
          background: #f7fbff;
          color: #0f172a;
        }
        [data-eye-gaze-shell] .eye-gaze-page > div > header {
          display: none !important;
        }
        [data-eye-gaze-shell] .eye-gaze-page > div {
          min-height: 0 !important;
          background: transparent !important;
        }
        [data-eye-gaze-shell] .eye-gaze-page main {
          max-width: 100% !important;
        }
      `}</style>

      <header className="sticky top-0 z-[70] bg-white/95 backdrop-blur border-b border-sky-100">
        <div className="max-w-[1600px] mx-auto h-20 px-4 sm:px-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/eye-gaze-home")}
            className="flex items-center gap-3 mr-auto min-w-0"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-300 via-sky-300 to-violet-400 flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
              🌈
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-lg font-black tracking-wide text-blue-700">A.R.I.S.E.</div>
              <div className="text-xl font-black text-blue-950">Reader</div>
            </div>
          </button>



          <div className="hidden sm:flex items-center gap-2 pl-3">
            <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserRound className="w-6 h-6" />
            </div>
            <div className="font-black text-blue-950 truncate max-w-[140px]">Hi, {user.displayName?.split(" ")[0] || "Learner"}!</div>
          </div>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="ml-2 min-h-[46px] rounded-2xl border-2 border-rose-200 bg-rose-50 px-3 sm:px-4 flex items-center justify-center gap-2 font-black text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-200"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex min-w-0">
        <aside className="hidden xl:flex w-28 flex-shrink-0 flex-col items-center gap-4 py-6 px-3 border-r border-sky-100 bg-white/70 min-h-[calc(100vh-5rem)]">
          {nav.map(item => {
            const Icon = item.icon;
            const active = location === item.path || (item.path === "/profile" && location === "/eye-gaze-home");
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`w-full min-h-[88px] rounded-3xl flex flex-col items-center justify-center gap-2 font-black text-xs text-center px-1 transition-colors ${
                  active ? "bg-violet-500 text-white" : "text-slate-500 hover:bg-blue-50"
                }`}
              >
                <Icon className="w-7 h-7" />
                {item.label}
              </button>
            );
          })}
        </aside>

        <div className="eye-gaze-page flex-1 min-w-0">
          {children}
        </div>
      </div>

      <nav className="xl:hidden sticky bottom-0 z-[70] bg-white border-t border-sky-100 px-1 py-2 grid grid-cols-6 gap-1">
        {nav.map(item => {
          const Icon = item.icon;
          const active = location === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`min-h-[64px] rounded-2xl flex flex-col items-center justify-center text-[11px] font-black transition-colors ${
                active ? "bg-violet-100 text-violet-800" : "text-slate-500"
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
