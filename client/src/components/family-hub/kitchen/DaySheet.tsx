// One day from the calendar: every meal on it, grouped by breakfast, lunch, dinner and the rest. Tap a meal to change who
// eats it, edit its ingredients, move it to another day or take it off. Add meals opens the planner on this day.
import { K_SLOTS, cell, dishName, nWeeks, peopleIn, dateOf, type KDay, type Kitchen, type KMeal } from "@shared/kitchen";
import { Modal } from "../ui";
import { btn, ghost, label } from "./kit";
import { fmtDate } from "./PlanCalendar";

export default function DaySheet({ k, day, wk, start, onClose, onMeal, onAdd, onClear }: {
  k: Kitchen; day: KDay; wk: number; start: string; onClose: () => void; onMeal: (key: string, meal: KMeal) => void; onAdd: () => void; onClear: () => void;
}) {
  const any = K_SLOTS.some((s) => (k.week[cell(day, s.id, wk)] ?? []).length > 0);
  return <Modal title={fmtDate(dateOf(start, wk, day))} eyebrow={nWeeks(k) > 1 ? `Week ${wk + 1}` : "Kitchen"} onClose={onClose}>
    <div className="divide-y divide-slate-100">
      {K_SLOTS.map((s) => { const key = cell(day, s.id, wk); const meals = k.week[key] ?? []; return <section key={s.id} className="py-3 first:pt-0" data-testid={`day-${s.id}`}>
        <p className={label}>{s.label}</p>
        {meals.length ? <ul className="mt-1">{meals.map((m) => <li key={m.id}>
          <button type="button" onClick={() => onMeal(key, m)} className="flex w-full items-center gap-3 py-2 text-left">
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium text-slate-900">{dishName(k, m.dish)}</span>
              <span className="block truncate text-xs text-slate-500">{m.people.length && k.people.length > 1 ? peopleIn(k, m).map((p) => p.name).join(", ") : "Everyone"}</span></span>
            <span className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Edit</span>
          </button>
        </li>)}</ul> : <p className="mt-1 text-sm text-slate-400">Nothing planned</p>}
      </section>; })}
    </div>
    <div className="mt-5 flex gap-2">
      <button type="button" onClick={onAdd} data-testid="day-add" className={`${btn} flex-1`}>Add meals</button>
      {any && <button type="button" onClick={onClear} className={ghost}>Clear day</button>}
    </div>
  </Modal>;
}
