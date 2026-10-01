import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { addGameUsage, cachedParentControls, fetchFamilySettings, getGameUsage, pathAllowed, type ParentControls } from "@/lib/parentControls";

export default function EyeGazeAccessGate({ path, anyOf, children }: { path: string; anyOf?: string[]; children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [controls, setControls] = useState<ParentControls | null>(null);
  const [gameMinutes, setGameMinutes] = useState(0);
  const [gameLimitReached, setGameLimitReached] = useState(false);

  const isGameArea = path === "/eye-gaze-games";
  const isChild = !!user && !!user.is_eye_gaze_user && user.role === "student" && !user.isAdmin;
  useEffect(() => {
    let active = true;
    if (!isChild) {
      setControls(cachedParentControls());
      return;
    }
    void fetchFamilySettings(token)
      .then(result => { if (active) setControls(result.settings); })
      .catch(() => { if (active) setControls(cachedParentControls()); });
    return () => { active = false; };
  }, [isChild, token, user?.id]);

  useEffect(() => {
    if (!isChild || !isGameArea || !controls || controls.gameDailyMinutes <= 0) {
      setGameLimitReached(false);
      return;
    }
    let active = true;
    let interval: number | null = null;

    const refresh = async () => {
      try {
        const usage = await getGameUsage(token);
        if (!active) return;
        setGameMinutes(usage.minutes);
        setGameLimitReached(usage.minutes >= controls.gameDailyMinutes);
      } catch {}
    };

    void refresh().then(() => {
      if (!active) return;
      interval = window.setInterval(async () => {
        try {
          const usage = await addGameUsage(token, 15);
          if (!active) return;
          setGameMinutes(usage.minutes);
          if (usage.minutes >= controls.gameDailyMinutes) setGameLimitReached(true);
        } catch {}
      }, 15000);
    });

    return () => {
      active = false;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [isChild, isGameArea, token, controls?.gameDailyMinutes]);

  if (!isChild) return <>{children}</>;
  if (!controls) return <div className="min-h-screen grid place-items-center bg-slate-50 font-black text-slate-700">Loading your learning plan…</div>;
  if (!(anyOf || [path]).some(item => pathAllowed(item, controls))) return <Redirect to="/eye-gaze-home" />;
  if (isGameArea && controls.gameDailyMinutes > 0 && gameLimitReached) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6 text-slate-950">
        <div className="max-w-lg rounded-[2rem] border-2 border-amber-200 bg-white p-7 text-center shadow-xl">
          <div className="text-5xl">⏰</div>
          <h1 className="mt-4 text-2xl font-black">Game time is finished for today</h1>
          <p className="mt-2 font-bold text-slate-600">
            You used about {Math.ceil(gameMinutes)} of {controls.gameDailyMinutes} game minutes today. Your grown-up can change this limit.
          </p>
          <a href="#/eye-gaze-home" className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-violet-700 px-5 font-black text-white">Back Home</a>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
