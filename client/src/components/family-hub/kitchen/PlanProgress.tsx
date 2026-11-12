// How much of the week is planned: a bar for each person and one for the whole family. Counts breakfast, lunch and
// dinner on every day of the plan. Shown on the Week page, and in the week planner, where tapping a name shows that person's menu.
import { planProgress, type KMeal, type KPerson } from "@shared/kitchen";

type Row = { id: string | null; name: string; done: number; of: number; pct: number };

function Bar({ r }: { r: Row }) {
  return <>
    <span className="w-24 shrink-0 truncate text-left text-sm font-medium text-slate-900">{r.name}</span>
    <span role="progressbar" aria-label={`${r.name} planned`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.pct} className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
      <span className={`block h-full rounded-full transition-all ${r.pct === 100 ? "bg-emerald-600" : "bg-slate-900"}`} style={{ width: `${r.pct}%` }} />
    </span>
    <span className={`w-14 shrink-0 text-right text-sm font-semibold tabular-nums ${r.pct === 100 ? "text-emerald-700" : "text-slate-900"}`}>{r.pct === 100 ? "Done" : `${r.pct}%`}</span>
  </>;
}

export default function PlanProgress({ people, week, weeks = 1, who, onSelect }: {
  people: KPerson[]; week: Record<string, KMeal[]>; /** How many weeks the plan covers. */ weeks?: number; who?: string | null; onSelect?: (who: string | null) => void;
}) {
  const p = planProgress(people, week, weeks);
  const rows: Row[] = people.length > 1
    ? [{ id: null, name: "Whole family", ...p.all }, ...people.map((x) => ({ id: x.id, name: x.name, ...p.by[x.id] }))]
    : [{ id: null, name: "Week planned", ...p.all }];
  return <div className="space-y-0.5" data-testid="plan-progress">
    {rows.map((r) => {
      const tip = `${r.done} of ${r.of} meals planned`;
      return onSelect
        ? <button key={r.id ?? "all"} type="button" aria-pressed={(who ?? null) === r.id} onClick={() => onSelect(r.id)} title={tip} data-testid={`progress-${r.id ?? "all"}`} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 transition ${(who ?? null) === r.id ? "bg-slate-100 ring-1 ring-slate-900" : "hover:bg-slate-50"}`}><Bar r={r} /></button>
        : <div key={r.id ?? "all"} title={tip} data-testid={`progress-${r.id ?? "all"}`} className="flex items-center gap-3 px-1 py-1.5"><Bar r={r} /></div>;
    })}
  </div>;
}
