import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function EyeGazeLifeSkills() {
  const [, navigate] = useLocation();

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-emerald-100 via-white to-amber-50 border-2 border-emerald-100 p-5 sm:p-8">
        <p className="text-sm font-black uppercase tracking-widest text-emerald-700">Life Skills</p>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-950 mt-1">Learn everyday skills 🌟</h1>
        <p className="text-base sm:text-lg font-bold text-slate-600 mt-2 max-w-3xl">
          Simple tools for real-life routines, independence, and growing confidence.
        </p>
      </section>

      <section aria-label="Life skills">
        <button
          type="button"
          onClick={() => navigate("/eye-gaze-potty")}
          className="w-full min-h-[260px] rounded-[2.2rem] border-4 border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-6 sm:p-8 text-left shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all focus:outline-none focus:ring-4 focus:ring-cyan-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-[2rem] bg-white border-2 border-cyan-100 shadow-sm grid place-items-center text-7xl sm:text-8xl flex-shrink-0">
              🚽
            </div>
            <div className="flex-1">
              <p className="text-xs font-black tracking-widest text-cyan-700">LIFE SKILL</p>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-950 mt-1">Potty Training</h2>
              <p className="font-bold text-slate-600 mt-2 max-w-2xl">
                Visual potty steps, practice timers, parent coaching, progress tracking, patterns, songs, and videos.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Visual routine", "Timers", "Tracker", "Parent coach"].map(item => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    <CheckCircle2 className="w-4 h-4" /> {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-h-14 rounded-2xl bg-emerald-700 text-white px-5 font-black inline-flex items-center justify-center gap-2 flex-shrink-0">
              OPEN <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </button>
      </section>
    </main>
  );
}
