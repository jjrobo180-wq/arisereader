import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

export default function ARISECityComingLater() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const gamesPath = user?.is_eye_gaze_user ? "/eye-gaze-games" : "/library";
  const homePath = user?.is_eye_gaze_user ? "/eye-gaze-home" : "/library";

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white px-4 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <button type="button" onClick={() => navigate(gamesPath)} className="min-h-12 rounded-2xl bg-white/10 border border-white/15 px-4 font-black">← Back to Games</button>
        <section className="mt-8 rounded-[2.5rem] border-2 border-white/15 bg-gradient-to-br from-slate-900 via-blue-950 to-violet-950 p-7 sm:p-10 text-center shadow-2xl">
          <div className="text-7xl sm:text-8xl" aria-hidden="true">🏙️</div>
          <div className="mt-5 inline-flex rounded-full bg-amber-300 text-slate-950 px-4 py-2 text-sm font-black uppercase tracking-widest">Coming Later</div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black">A.R.I.S.E. City</h1>
          <p className="mt-4 text-lg sm:text-xl font-bold text-white/75">The city is taking a break while it is rebuilt and polished. Come back when the new version is ready.</p>
          <button type="button" onClick={() => navigate(homePath)} className="mt-7 min-h-14 rounded-2xl bg-cyan-300 text-slate-950 px-6 font-black">⌂ Go Home</button>
        </section>
      </div>
    </main>
  );
}
