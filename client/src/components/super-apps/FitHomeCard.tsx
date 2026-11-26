// Arise To Do's Home widget for Health & Fitness (Nov 24, 2026): today's calories left as a ring, with water, protein,
// workouts this week and the streak. The same numbers as the iPhone widget (lib/fitWidgets.ts, fitDuoSlot).
// A tap opens Health & Fitness. FitHomeCard is the card on the normal Home; FitTileBody is the Tile theme's face.
import type { ReactNode } from "react";
import { Dumbbell, Droplets, Flame, Beef, ChevronRight } from "lucide-react";
import type { HomeSize } from "@shared/hubLayout";
import { useAuth } from "@/context/AuthContext";
import { useFitData } from "@/pages/fit/fitStore";
import { fitHomeStats } from "@/lib/fitWidgets";

function useStats() {
  const { token } = useAuth();
  const { data } = useFitData(token);
  const kg = data.weights.length ? data.weights[data.weights.length - 1].kg : undefined;
  return fitHomeStats(data, kg);
}

function Ring({ value, size = 64, stroke = 7, color = "#ff5a1f", track = "#ffe3d6", children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value || 0));
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

export default function FitHomeCard({ onOpen }: { onOpen: () => void }) {
  const s = useStats();
  const items = [
    { icon: <Droplets size={15} />, label: "Water", value: s.water?.value ?? "0", sub: s.water?.detail ?? "", color: "#1b8ef2" },
    { icon: <Beef size={15} />, label: "Protein", value: s.protein?.value ?? "0g", sub: s.protein?.detail ?? "", color: "#c2410c" },
    { icon: <Dumbbell size={15} />, label: "Workouts", value: s.workouts?.value ?? "0", sub: "this week", color: "#6e5ae0" },
    { icon: <Flame size={15} />, label: "Streak", value: s.streak?.value ?? "0", sub: s.streak?.detail ?? "", color: "#e11d48" },
  ];
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-[1.5rem] border border-black/5 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] dark:bg-slate-900" aria-label="Open Health & Fitness">
      <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#ff5a1f] text-white"><Flame size={15} /></span>
        Health &amp; Fitness <ChevronRight size={16} className="ml-auto text-slate-400" />
      </span>
      <span className="mt-3 flex items-center gap-4">
        <Ring value={s.calories?.progress ?? 0} size={76} stroke={8}>
          <span className="text-center leading-none"><span className="block text-base font-black tabular-nums text-slate-900 dark:text-white">{(s.calories?.value ?? "0").replace(" over", "")}</span><span className="text-[10px] font-semibold text-slate-500">{s.calories?.value.endsWith("over") ? "cal over" : "cal left"}</span></span>
        </Ring>
        <span className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          {items.map((it) => (
            <span key={it.label} className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-800">
              <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: it.color }}>{it.icon}{it.label}</span>
              <span className="block truncate text-sm font-black tabular-nums text-slate-900 dark:text-white">{it.value}</span>
              {it.sub && <span className="block truncate text-[10px] text-slate-500">{it.sub}</span>}
            </span>
          ))}
        </span>
      </span>
      {s.calories?.detail && <span className="mt-2 block text-xs text-slate-500">{s.calories.detail}</span>}
    </button>
  );
}

/** The Tile theme's live tile face (white text on the tile's color). */
export function FitTileBody({ size }: { size: HomeSize }): ReactNode {
  const s = useStats();
  const wide = size === "large";
  return (
    <span className={`flex h-full w-full ${wide ? "flex-row items-center gap-[4cqw] px-[4cqw]" : "flex-col justify-between p-2 sm:p-3"}`}>
      <span className="flex items-baseline gap-[1cqw] leading-none">
        <span className="font-light tabular-nums" style={{ fontSize: wide ? "18cqw" : "12cqw" }}>{(s.calories?.value ?? "0").replace(" over", "")}</span>
        <span className="font-semibold opacity-90" style={{ fontSize: wide ? "5cqw" : "4cqw" }}>{s.calories?.value.endsWith("over") ? "cal over" : "cal left"}</span>
      </span>
      <span className="block leading-tight opacity-95" style={{ fontSize: wide ? "5cqw" : "3.8cqw" }}>
        <span className="block">Water {s.water?.value ?? "0"}</span>
        <span className="block">Workouts {s.workouts?.value ?? "0"} · Streak {s.streak?.value ?? "0"}</span>
      </span>
    </span>
  );
}
