// Teacher Hub: service minutes as a week calendar. Each day is a column of time blocks, and each block
// lists the students seen in it or due in it. The rules are in shared/hubMinutesWeek.ts.
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays } from "@shared/hubDates";
import { DAY_NAMES } from "@shared/hubProgress";
import { minutesWeek, monthDay, openDay, type BlockState, type MinutesBlock, type MinutesDay, type MinutesItem } from "@shared/hubMinutesWeek";
import { clock12, type Workspace } from "@shared/teacherHub";

/** What the log pop-up opens with when it is opened from the calendar. */
export type LogStart = { student?: string; kind?: string; date: string; minutes?: number; start?: string; end?: string };

const ITEM_LOOK: Record<BlockState, string> = {
  logged: "border-emerald-200 bg-emerald-50 text-emerald-900",
  extra: "border-sky-200 bg-sky-100 text-sky-800",
  today: "border-teal-300 bg-white text-slate-900",
  planned: "border-slate-200 bg-white text-slate-600",
  missed: "border-amber-200 bg-amber-50 text-amber-900",
  "made up": "border-slate-200 bg-slate-50 text-slate-600",
};
const ITEM_WORD: Record<BlockState, string> = { logged: "Done", extra: "Extra", today: "Due today", planned: "Planned", missed: "Missed", "made up": "Made up" };
const DOT: Record<MinutesDay["state"], string> = { done: "bg-emerald-600", short: "bg-amber-500", today: "bg-teal-600", ahead: "bg-slate-300", empty: "bg-transparent" };
const DAY_WORD: Record<MinutesDay["state"], string> = { done: "all given", short: "minutes missed", today: "due today", ahead: "planned", empty: "nothing planned" };
const COLS: Record<number, string> = { 5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 7: "lg:grid-cols-7" };
const blockTime = (b: Pick<MinutesBlock, "start" | "end">) => (b.start ? `${clock12(b.start)}${b.end ? ` – ${clock12(b.end)}` : ""}` : "No time set");
const navBtn = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

function Item({ item, onLog, onEdit }: { item: MinutesItem; onLog: (items: MinutesItem[]) => void; onEdit: (logId: string) => void }) {
  const given = !!item.logId;
  const body = (
    <>
      <span className="block break-words text-sm font-semibold leading-snug">{item.student}</span>
      <span className="block text-xs">{item.minutes} min · {item.kind}</span>
      <span className="mt-0.5 block text-xs font-semibold">{given && <Check className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />}{ITEM_WORD[item.state]}{item.note ? <span className="font-normal"> · {item.note}</span> : null}</span>
    </>
  );
  const box = `rounded-xl border px-2.5 py-2 text-left ${ITEM_LOOK[item.state]}`;
  if (given) return <li><button type="button" className={`${box} block w-full hover:brightness-95`} onClick={() => onEdit(item.logId!)} aria-label={`${item.student}, ${item.minutes} minutes, ${ITEM_WORD[item.state].toLowerCase()}. Change`} data-testid="minutes-item" data-state={item.state}>{body}</button></li>;
  const loggable = item.state === "today" || item.state === "missed";
  return (
    <li className={box} data-testid="minutes-item" data-state={item.state}>
      {body}
      {loggable && <button type="button" className="mt-1.5 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-slate-950 px-2 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => onLog([item])} aria-label={`Log ${item.minutes} minutes for ${item.student}`}>Log {item.minutes} min</button>}
    </li>
  );
}

function DayColumn({ day, today, shown, onLog, onEdit, onAdd }: { day: MinutesDay; today: string; shown: boolean; onLog: (items: MinutesItem[]) => void; onEdit: (logId: string) => void; onAdd: (start: LogStart) => void }) {
  const isToday = day.date === today;
  return (
    <section className={`min-w-0 rounded-2xl border p-2 ${isToday ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-slate-50"} ${shown ? "" : "hidden lg:block"}`} aria-label={`${DAY_NAMES[day.day]}, ${monthDay(day.date)}`} data-testid="minutes-day" data-date={day.date}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900"><span className="lg:hidden">{DAY_NAMES[day.day]}</span><span className="hidden lg:inline">{day.day}</span> {monthDay(day.date)}{isToday && <span className="ml-1.5 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Today</span>}</h3>
          <p className="text-xs text-slate-500" data-testid="minutes-day-total">{day.planned ? `${day.done} of ${day.planned} min` : day.done ? `${day.done} min` : "Nothing planned"}</p>
        </div>
        <button type="button" className="-m-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100" onClick={() => onAdd({ date: day.date })} aria-label={`Log minutes on ${DAY_NAMES[day.day]}, ${monthDay(day.date)}`}><Plus className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 space-y-2">
        {day.blocks.map((block) => (
          <div key={block.key} className="rounded-xl border border-slate-200 bg-white p-2" data-testid="minutes-block">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">{blockTime(block)}</h4>
              {block.todo > 1 && <button type="button" className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => onLog(block.items)} data-testid="minutes-log-all">Log all {block.todo}</button>}
            </div>
            <ul className="mt-1.5 space-y-1.5">{block.items.map((item) => <Item key={item.key} item={item} onLog={onLog} onEdit={onEdit} />)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MinutesWeekView({ workspace, today, onLog, onEdit, onAdd }: {
  workspace: Workspace; today: string;
  /** Log these block items as given, with one tap. */
  onLog: (items: MinutesItem[]) => void;
  /** Open a logged session to change it. */
  onEdit: (logId: string) => void;
  /** Open the log pop-up, filled in with what is known. */
  onAdd: (start: LogStart) => void;
}) {
  const [weekOf, setWeekOf] = useState(today);
  const week = useMemo(() => minutesWeek(workspace.services, workspace.serviceLogs, weekOf, today), [workspace.services, workspace.serviceLogs, weekOf, today]);
  const [picked, setPicked] = useState("");
  const selected = week.days.some((d) => d.date === picked) ? picked : openDay(week, today);
  const thisWeek = week.days.some((d) => d.date === today) || (today >= week.start && today <= week.end);
  const go = (days: number) => { setWeekOf(addDays(week.start, days)); setPicked(""); };
  // A session with no day of its own is logged on the day being looked at, or today when today is in view.
  const anyDate = thisWeek ? today : selected;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Minutes this week, by block" data-testid="minutes-week">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={navBtn} onClick={() => go(-7)} aria-label="Week before"><ChevronLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900" data-testid="minutes-week-title">Week of {monthDay(week.start)}</h2>
          <p className="text-xs text-slate-500" data-testid="minutes-week-total">{week.planned ? `${week.done} of ${week.planned} min` : `${week.done} min`}{thisWeek ? " this week" : ""}</p>
        </div>
        {!thisWeek && <button type="button" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setWeekOf(today); setPicked(""); }}>This week</button>}
        <button type="button" className={navBtn} onClick={() => go(7)} aria-label="Week after"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* On a phone one day shows at a time, picked from this strip. On a wide screen every day is a column. */}
      <div role="tablist" aria-label="Day" className="mt-3 flex gap-1 rounded-2xl bg-slate-100 p-1 lg:hidden" data-testid="minutes-day-strip">
        {week.days.map((d) => (
          <button key={d.date} type="button" role="tab" aria-selected={d.date === selected} aria-label={`${DAY_NAMES[d.day]}, ${monthDay(d.date)}: ${DAY_WORD[d.state]}`} onClick={() => setPicked(d.date)} className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-0.5 text-xs font-semibold ${d.date === selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
            <span>{d.day}</span>
            <span className="text-sm font-bold">{Number(d.date.slice(8))}</span>
            <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${DOT[d.state]}`} aria-hidden />
          </button>
        ))}
      </div>

      <div className={`mt-3 grid gap-2 ${COLS[week.days.length] || "lg:grid-cols-5"}`}>
        {week.days.map((d) => <DayColumn key={d.date} day={d} today={today} shown={d.date === selected} onLog={onLog} onEdit={onEdit} onAdd={onAdd} />)}
      </div>

      {week.anyDay.length > 0 && (
        <div className="mt-3 rounded-2xl border border-slate-200 p-2" data-testid="minutes-any-day">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">Any day this week</h3>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {week.anyDay.map((p) => (
              <li key={p.planId} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${p.remaining ? "border-slate-200 bg-white text-slate-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{p.student} · {p.kind}</span><span className="block text-xs">{p.done} of {p.required} min{p.remaining ? ` · ${p.remaining} left` : " · done"}</span></span>
                <button type="button" className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => onAdd({ student: p.student, kind: p.kind, date: anyDate })} aria-label={`Log minutes for ${p.student}, ${p.kind}`}>Log</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Students at the same time share a block. Tap a finished session to change it. Extra sessions count toward the week and are never expected again.</p>
    </section>
  );
}
