// "Finish your day" on Cooked's Today screen: a checklist built from the person's goals (shared/fitChecklist.ts).
// Items tick themselves when the food, workout, water and the rest were tracked; the circle can also be tapped
// to tick one by hand (a rest day, a workout done elsewhere). The row opens the screen where it gets tracked.
import { Check, ChevronRight, Droplets, Dumbbell, Flame, Footprints, Moon, Pill, Scale, Timer, Utensils } from "lucide-react";
import { checklistStreak, dayChecklist, toggleCheck, type CheckIcon } from "@shared/fitChecklist";
import { dayKey, type FitData } from "@shared/fit";
import type { FitAppId } from "@shared/fitApps";
import type { Update } from "./fitStore";
import { C, Card, display, haptic } from "./fitUi";

const ICONS: Record<CheckIcon, typeof Check> = { food: Utensils, workout: Dumbbell, water: Droplets, steps: Footprints, weight: Scale, sleep: Moon, fast: Timer, meds: Pill };

export default function FitChecklist({ data, update, steps, onApp }: { data: FitData; update: Update; steps: number | null; onApp: (id: FitAppId) => void }) {
  const today = dayKey();
  const list = dayChecklist(data, today, steps);
  if (!list.items.length) return null;
  const run = checklistStreak(data, today, list.complete);
  const pct = list.done / list.total;
  return (
    <Card className="mt-3 !p-0 overflow-hidden" testId="fit-checklist">
      <div className="px-4 pb-1 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em]" style={{ color: C.dim, fontFamily: "var(--fit-num)" }}>Your goals today</p>
            <h2 className="mt-0.5 text-[22px] leading-tight" style={display}>{list.complete ? "Day finished" : "Finish your day"}</h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[22px] leading-none tabular-nums" style={display} data-testid="fit-checklist-count">{list.done}<span style={{ color: C.dim }}>/{list.total}</span></p>
            {run > 0 && <p className="mt-1 flex items-center justify-end gap-1 text-[12px] font-semibold" style={{ color: C.orange }} data-testid="fit-checklist-streak"><Flame className="h-3.5 w-3.5" aria-hidden />{run} {run === 1 ? "day" : "days"}</p>}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: C.track }} role="progressbar" aria-valuemin={0} aria-valuemax={list.total} aria-valuenow={list.done} aria-label="Checklist progress">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(pct * 100)}%`, background: "var(--fit-accent)" }} />
        </div>
        {list.complete && <p className="mt-3 text-[13.5px]" style={{ color: C.steel }}>Everything tracked. Nice work today.</p>}
      </div>
      <ul className="px-2 pb-2 pt-1">
        {list.items.map((it) => {
          const Icon = ICONS[it.icon];
          return (
            <li key={it.id} className="flex items-center" data-testid={`fit-check-${it.id}`}>
              <button type="button" role="checkbox" aria-checked={it.done} aria-label={`${it.label}${it.auto ? " (ticked because it was tracked)" : ""}`} disabled={it.auto}
                onClick={() => { haptic(it.done ? "light" : "success"); update((d) => toggleCheck(d, today, it.id)); }}
                className="grid h-12 w-12 shrink-0 place-items-center disabled:cursor-default">
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 transition-colors" style={it.done ? { background: "var(--fit-accent)", borderColor: "var(--fit-accent)", color: "var(--fit-on-accent)" } : { borderColor: C.line }}>
                  {it.done && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                </span>
              </button>
              <button type="button" onClick={() => { haptic("light"); onApp(it.app); }} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-[12px] pr-2 text-left active:opacity-70">
                <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: it.done ? C.dim : C.lime }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug" style={{ color: it.done ? C.dim : C.text }}>{it.label}</span>
                  <span className="block truncate text-[12.5px]" style={{ color: C.dim }}>{it.detail}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.dim }} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
