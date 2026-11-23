// Cooked's "Finish your day" goals (food, water, sleep, workout…) on To Duo's Tasks screen, so they sit with
// the rest of the to-dos instead of crowding Cooked's Today. Ticks itself as things get tracked in Cooked;
// the circle ticks one by hand, and the row opens Cooked on the screen where it's tracked.
import { Check, ChevronRight, Dumbbell, Droplets, Footprints, Moon, Pill, Scale, Timer, Utensils } from "lucide-react";
import { dayChecklist, toggleCheck, type CheckIcon } from "@shared/fitChecklist";
import { dayKey } from "@shared/fit";
import type { FitAppId } from "@shared/fitApps";
import { useAuth } from "@/context/AuthContext";
import { useFitData } from "@/pages/fit/fitStore";

const ICONS: Record<CheckIcon, typeof Check> = { food: Utensils, workout: Dumbbell, water: Droplets, steps: Footprints, weight: Scale, sleep: Moon, fast: Timer, meds: Pill };

export default function CookedGoalsInTasks({ open }: { open: (app: FitAppId) => void }) {
  const { token } = useAuth();
  const { data, update } = useFitData(token);
  const today = dayKey();
  const list = dayChecklist(data, today, null);
  if (!list.items.length) return null;
  return <section className="rounded-2xl border border-slate-200 p-3" data-testid="cooked-goals-in-tasks">
    <p className="mb-1 flex items-center justify-between px-1 text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600"><span>Cooked goals today</span><span className="tabular-nums text-slate-500">{list.done}/{list.total}</span></p>
    <ul>{list.items.map((it) => {
      const Icon = ICONS[it.icon];
      return <li key={it.id} className="flex items-center" data-testid={`cooked-goal-${it.id}`}>
        <button type="button" onClick={() => update((d) => toggleCheck(d, today, it.id))} disabled={it.auto} aria-label={it.done ? `Untick ${it.label}` : `Tick ${it.label}`} aria-pressed={it.done} className="grid h-11 w-11 shrink-0 place-items-center disabled:cursor-default">
          <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${it.done ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300"}`}>{it.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
        </button>
        <button type="button" onClick={() => open(it.app)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
          <Icon className="h-4 w-4 shrink-0 text-violet-500" />
          <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-semibold ${it.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{it.label}</span>{it.detail && <span className="block truncate text-xs text-slate-500">{it.detail}</span>}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </li>;
    })}</ul>
  </section>;
}
