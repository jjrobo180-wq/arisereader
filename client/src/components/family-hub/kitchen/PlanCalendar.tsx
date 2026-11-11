// The plan as a calendar: one row per week, seven days across. Tap a day to see, add or change its meals. On a computer
// or iPad, drag a meal onto another day to move it (hold Alt or Option to copy it instead). On a phone, the day's meals
// have a Move button that opens DatePick below, so nothing needs dragging.
import { useState } from "react";
import { DAY_SHORT, K_SLOTS, MAIN_SLOTS, SKIP, WEEK, addDays, cell, dateOf, dishName, nWeeks, parseCell, type KDay, type Kitchen } from "@shared/kitchen";

const MIME = "application/x-kitchen-meal";
const at = (d: string) => new Date(`${d}T12:00:00`);
export const fmtDate = (d: string) => at(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
export const fmtShort = (d: string) => at(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const fmtRange = (start: string, weeks: number) => `${fmtShort(start)} to ${fmtShort(addDays(start, weeks * 7 - 1))}`;
const dayNum = (d: string) => at(d).getDate();
/** "Nov 9" on the first cell and on the 1st of a month, just the number otherwise. */
const cellLabel = (d: string, first: boolean) => (first || dayNum(d) === 1 ? fmtShort(d) : String(dayNum(d)));

export default function PlanCalendar({ k, start, today, onDay, onMove }: {
  k: Kitchen; start: string; today: string; onDay: (day: KDay, wk: number) => void; onMove: (fromKey: string, mealId: string, toKey: string, copy: boolean) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  return <div data-testid="plan-calendar">
    <div className="grid grid-cols-7 gap-1 pb-1">{WEEK.map((d) => <span key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">{DAY_SHORT[d]}</span>)}</div>
    <div className="space-y-1">
      {Array.from({ length: nWeeks(k) }, (_, wk) => <div key={wk} className="grid grid-cols-7 gap-1">
        {WEEK.map((day) => {
          const date = dateOf(start, wk, day);
          const items = K_SLOTS.flatMap((s) => (k.week[cell(day, s.id, wk)] ?? []).map((m) => ({ key: cell(day, s.id, wk), slot: s.id, m })));
          const food = items.filter((x) => x.m.dish !== SKIP);
          const has = (slot: string) => items.some((x) => x.slot === slot);
          const isOver = over === date;
          return <div key={day} role="button" tabIndex={0} data-testid={`cal-${date}`}
            aria-label={`${fmtDate(date)}, ${food.length} meal${food.length === 1 ? "" : "s"} planned. Open this day.`}
            onClick={() => onDay(day, wk)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDay(day, wk); } }}
            onDragOver={(e) => { if (Array.from(e.dataTransfer.types).includes(MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = e.altKey ? "copy" : "move"; setOver(date); } }}
            onDragLeave={() => setOver((o) => (o === date ? null : o))}
            onDrop={(e) => {
              e.preventDefault(); setOver(null);
              try { const { key, id } = JSON.parse(e.dataTransfer.getData(MIME)); onMove(key, id, cell(day, parseCell(key).slot, wk), e.altKey); } catch { /* not one of ours */ }
            }}
            className={`flex min-h-[4.5rem] min-w-0 cursor-pointer flex-col rounded-xl border p-1.5 text-left transition sm:min-h-[6.75rem] ${isOver ? "border-slate-900 bg-slate-100" : date === today ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:border-slate-400"}`}>
            <span className={`text-xs font-semibold tabular-nums ${date === today ? "text-slate-900" : "text-slate-500"}`}>{cellLabel(date, wk === 0 && day === "mon")}</span>
            <span className="mt-auto flex items-center gap-1 pt-1 sm:hidden" aria-hidden>{MAIN_SLOTS.map((s) => <span key={s} className={`h-1.5 w-1.5 rounded-full ${has(s) ? "bg-slate-900" : "bg-slate-200"}`} />)}</span>
            <span className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex">
              {food.slice(0, 3).map(({ key, m }) => <span key={m.id} draggable
                onDragStart={(e) => { e.dataTransfer.setData(MIME, JSON.stringify({ key, id: m.id })); e.dataTransfer.effectAllowed = "copyMove"; }}
                title="Drag to another day. Hold Alt or Option to copy." className="block cursor-grab truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 active:cursor-grabbing">{dishName(k, m.dish)}</span>)}
              {food.length > 3 && <span className="px-1 text-[11px] text-slate-400">+{food.length - 3} more</span>}
            </span>
          </div>;
        })}
      </div>)}
    </div>
  </div>;
}

/** Pick a day from the plan's weeks (used to move or copy a meal). The meal's own day is greyed out. */
export function DatePick({ start, weeks, today, from, onPick }: { start: string; weeks: number; today: string; from?: { day: KDay; wk: number }; onPick: (day: KDay, wk: number) => void }) {
  return <div data-testid="date-pick">
    <div className="grid grid-cols-7 gap-1 pb-1">{WEEK.map((d) => <span key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">{DAY_SHORT[d].slice(0, 2)}</span>)}</div>
    <div className="space-y-1">{Array.from({ length: weeks }, (_, wk) => <div key={wk} className="grid grid-cols-7 gap-1">
      {WEEK.map((day) => {
        const date = dateOf(start, wk, day); const here = !!from && from.day === day && from.wk === wk;
        const month = wk === 0 && day === "mon" || dayNum(date) === 1;
        return <button key={day} type="button" disabled={here} onClick={() => onPick(day, wk)} aria-label={fmtDate(date)} data-testid={`pick-${date}`}
          className={`flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition ${here ? "border-slate-100 bg-slate-50 text-slate-300" : date === today ? "border-slate-900 text-slate-900 hover:bg-slate-100" : "border-slate-200 text-slate-700 hover:border-slate-900"}`}>
          <span className="tabular-nums">{dayNum(date)}</span>
          {month && <span className="text-[10px] font-medium leading-none text-slate-400">{at(date).toLocaleDateString(undefined, { month: "short" })}</span>}
        </button>;
      })}
    </div>)}</div>
  </div>;
}
