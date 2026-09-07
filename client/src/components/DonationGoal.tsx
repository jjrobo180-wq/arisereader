import { useState, useEffect } from "react";
import { Heart, TrendingUp, Target } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

interface Milestone {
  amount: number;
  label: string;
}

interface DonationData {
  goalAmount: number;
  currentAmount: number;
  title: string;
  description: string;
  donateUrl: string;
  milestones: Milestone[];
  active: boolean;
}

export default function DonationGoal() {
  const [data, setData] = useState<DonationData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/donation-settings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.active) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const pct = Math.min(100, (data.currentAmount / data.goalAmount) * 100);
  const formatted = (n: number) => `$${n.toLocaleString()}`;

  return (
    <div
      data-tour="donation-goal"
      className="mb-6 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(10 80% 55%), hsl(345 75% 50%))",
        boxShadow: "0 4px 20px hsl(345 75% 50% / 0.25)",
      }}
    >
      <div className="p-5 sm:p-6 text-white">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <Heart className="w-5 h-5" fill="white" />
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">{data.title || "Support Our Readers"}</h3>
            <p className="text-xs text-white/80 leading-tight">{data.description || "Help us keep A.R.I.S.E Reader free for students"}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 relative">
          <div className="h-5 rounded-full bg-white/20 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-white transition-all duration-1000 ease-out flex items-center justify-end pr-2"
              style={{ width: `${pct}%` }}
            >
              {pct > 15 && (
                <span className="text-[10px] font-bold text-red-600">{Math.round(pct)}%</span>
              )}
            </div>

            {/* Milestone markers */}
            {(data.milestones || []).map((m, i) => {
              const mPct = Math.min(100, (m.amount / data.goalAmount) * 100);
              const reached = data.currentAmount >= m.amount;
              return (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${mPct}%`, transform: `translate(-50%, -50%)` }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center"
                    style={{ background: reached ? "white" : "rgba(255,255,255,0.3)" }}
                  >
                    {reached && <Target className="w-2.5 h-2.5 text-red-600" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Milestone labels */}
          <div className="relative h-6 mt-1">
            {(data.milestones || []).map((m, i) => {
              const mPct = Math.min(98, (m.amount / data.goalAmount) * 100);
              const reached = data.currentAmount >= m.amount;
              return (
                <div
                  key={i}
                  className="absolute text-[10px] font-semibold whitespace-nowrap"
                  style={{
                    left: `${mPct}%`,
                    transform: "translateX(-50%)",
                    color: reached ? "white" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {m.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Amounts + Donate button */}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-black">{formatted(data.currentAmount)}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wide">Raised</div>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div>
              <div className="text-2xl font-black text-white/80">{formatted(data.goalAmount)}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wide">Goal</div>
            </div>
          </div>
          {data.donateUrl && (
            <a
              href={data.donateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-red-600 text-sm font-bold hover:bg-white/90 transition-colors"
              style={{ animation: "donatePulse 2s ease-in-out infinite" }}
            >
              <Heart className="w-4 h-4" fill="currentColor" />
              Donate Now
            </a>
          )}
        </div>
      </div>
      <style>{`
        @keyframes donatePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}</style>
    </div>
  );
}
