// Arise WorkHub: the Minutes screen's day page. One day at a time, block by block: tap the circle to log
// a student's usual minutes, tap a row to log it another way or change it. "Log the day" puts everyone
// waiting that day in one sheet with their minutes and notes. Notes can be added right after logging,
// for one student, some or all. The rules are in shared/hubMinutesDay.ts.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, NotebookPen, Plus } from "lucide-react";
import { addDays } from "@shared/hubDates";
import { DAY_NAMES, weekDayOf } from "@shared/hubProgress";
import { NOT_MET_REASONS, monthDay, type MinutesItem, type MinutesWeek } from "@shared/hubMinutesWeek";
import { daySections, daySheetLogs, dayRows, waiting, type DayRow, type Rate } from "@shared/hubMinutesDay";
import type { ServiceLog } from "@shared/teacherHub";
import { HubModal } from "./HubModal";
import { PrimaryButton, GhostButton } from "./ui";

const navBtn = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30";
const STATE_WORD: Record<MinutesItem["state"], string> = { logged: "Done", extra: "Extra", today: "Due", planned: "Planned", missed: "Missed", "made up": "Made up", "any day": "Any day", "not met": "Didn't meet" };
const STATE_TONE: Record<MinutesItem["state"], string> = { logged: "text-emerald-700", extra: "text-sky-700", today: "text-slate-900", planned: "text-slate-400", missed: "text-amber-700", "made up": "text-slate-400", "any day": "text-slate-500", "not met": "text-slate-500" };

/** "Thursday, Nov 5". */
export function dayTitle(date: string): string {
  const d = weekDayOf(date);
  return `${d ? DAY_NAMES[d] : ""}, ${monthDay(date)}`.replace(/^, /, "");
}

/** Back a day, the day, forward a day, and Today. The date itself opens a calendar to jump to any day. */
export function DayNav({ date, today, onDate }: { date: string; today: string; onDate: (date: string) => void }) {
  return (
    <div className="flex items-center gap-1" data-testid="minutes-day-nav">
      <button type="button" className={navBtn} onClick={() => onDate(addDays(date, -1))} aria-label="Day before"><ChevronLeft className="h-5 w-5" /></button>
      <label className="relative min-w-0 flex-1 cursor-pointer text-center">
        <span className="block truncate text-[15px] font-semibold text-slate-900">{date === today ? "Today" : dayTitle(date)}</span>
        <span className="block text-xs text-slate-500">{date === today ? dayTitle(date) : date < today ? "Past day" : "Upcoming"}</span>
        <input type="date" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} aria-label="Go to a day" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" data-testid="minutes-day-pick" />
      </label>
      <button type="button" className={navBtn} onClick={() => onDate(addDays(date, 1))} aria-label="Day after"><ChevronRight className="h-5 w-5" /></button>
      {date !== today && <button type="button" onClick={() => onDate(today)} className="ml-1 inline-flex min-h-9 items-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-testid="minutes-go-today">Today</button>}
    </div>
  );
}

/** How complete the minutes are: the day, the week and the four weeks before. */
export function MinutesStats({ day, week, month, answered }: { day: Rate; week: Rate; month: Rate; answered: { done: number; total: number } }) {
  const tile = (label: string, r: Rate, sub: string, id: string) => (
    <div className="min-w-0 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-200/70" data-testid={`minutes-rate-${id}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight text-slate-900">{r.planned || r.done ? `${r.percent}%` : "—"}</div>
      <div className="truncate text-[11px] text-slate-500">{sub}</div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${label} complete`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.percent}><div className={`h-full rounded-full ${r.percent >= 100 ? "bg-emerald-500" : r.percent >= 80 ? "bg-slate-900" : "bg-amber-500"}`} style={{ width: `${r.percent}%` }} /></div>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="minutes-rates">
      {tile("Day", day, answered.total ? `${answered.done} of ${answered.total} logged` : day.planned ? `${day.done} of ${day.planned} min` : "Nothing due", "day")}
      {tile("Week", week, week.planned ? `${week.done} of ${week.planned} min` : "Nothing due", "week")}
      {tile("4 weeks", month, month.planned ? `${month.done} of ${month.planned} min` : "No history yet", "month")}
    </div>
  );
}

function Mark({ item, onQuick, readOnly }: { item: MinutesItem; onQuick: () => void; readOnly: boolean }) {
  const base = "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
  if (item.state === "logged" || item.state === "extra") return <span className={`${base} bg-emerald-500 text-white`} aria-hidden><Check className="h-4 w-4" strokeWidth={3} /></span>;
  if (item.state === "not met") return <span className={`${base} bg-slate-200 text-slate-500`} aria-hidden><Minus className="h-4 w-4" strokeWidth={3} /></span>;
  const canTap = !readOnly && (item.state === "today" || item.state === "missed" || item.state === "any day");
  const ring = item.state === "missed" ? "border-amber-400" : item.state === "today" ? "border-slate-400" : "border-slate-200";
  if (!canTap) return <span className={`${base} border-2 ${ring}`} aria-hidden />;
  return <button type="button" onClick={onQuick} className={`${base} border-2 ${ring} hover:border-emerald-500 hover:bg-emerald-50`} aria-label={`Log ${item.minutes} minutes for ${item.student}`} data-testid="minutes-quick" />;
}

/**
 * The day, block by block. With `readOnly` (another case manager's minutes) nothing can be tapped.
 */
export function MinutesDayView({ week, date, readOnly = false, onQuick, onOpen, onEdit, onLogAll, footer }: {
  week: MinutesWeek; date: string; readOnly?: boolean;
  /** Log these with their usual minutes, with one tap. */
  onQuick: (items: MinutesItem[]) => void;
  /** Open the day sheet on this student (or on everyone, with none). */
  onOpen: (key?: string) => void;
  /** Open a logged session to change it. */
  onEdit: (logId: string) => void;
  onLogAll: () => void;
  footer?: ReactNode;
}) {
  const sections = useMemo(() => daySections(week, date), [week, date]);
  const day = week.days.find((d) => d.date === date);
  const waitingCount = sections.reduce((n, s) => n + s.items.filter(waiting).length, 0);
  const offWeek = !day;
  return (
    <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/70" aria-label={`Minutes on ${dayTitle(date)}`} data-testid="minutes-day">
      {day?.optional && <p className="border-b border-slate-100 bg-sky-50 px-4 py-2 text-xs text-sky-800">{DAY_NAMES[day.day]} is optional. Nothing is due; minutes you add count as extra.</p>}
      {sections.length ? sections.map((s) => {
        const due = s.items.filter((x) => x.state === "today" || x.state === "missed");
        return (
          <div key={s.id || "none"} data-testid="minutes-day-block">
            <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">{s.name}</h3>
              {!readOnly && due.length > 1 && <button type="button" onClick={() => onQuick(due)} className="min-h-8 rounded-full px-2 text-xs font-semibold text-slate-900 hover:bg-slate-100" data-testid="minutes-block-all">Log all {due.length}</button>}
            </div>
            <ul className="mx-2 divide-y divide-slate-100">
              {s.items.map((x) => {
                const sub = [x.state === "not met" ? "" : `${x.minutes} min`, x.kind, x.teacher].filter(Boolean).join(" · ");
                const open = () => (x.logId ? onEdit(x.logId) : onOpen(x.key));
                return (
                  <li key={x.key} className="flex items-center gap-3 px-2 py-2.5" data-testid="minutes-day-row" data-state={x.state}>
                    <Mark item={x} readOnly={readOnly} onQuick={() => onQuick([x])} />
                    <button type="button" disabled={readOnly} onClick={open} className="min-w-0 flex-1 text-left disabled:cursor-default" aria-label={readOnly ? undefined : x.logId ? `Change ${x.student}` : `Log ${x.student} another way`}>
                      <span className="block truncate text-[15px] font-medium text-slate-900">{x.student}</span>
                      <span className="block truncate text-xs text-slate-500">{sub}{x.note ? <span className="text-slate-600"> · {x.note}</span> : null}</span>
                    </button>
                    <span className={`shrink-0 text-xs font-semibold ${STATE_TONE[x.state]}`}>{STATE_WORD[x.state]}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }) : <p className="px-4 py-10 text-center text-sm text-slate-500">{offWeek ? "Nothing on this day." : day?.optional ? "Nothing is due on an optional day." : "Nobody is due on this day."}</p>}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
          <button type="button" onClick={onLogAll} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" data-testid="minutes-log-day">
            <NotebookPen className="h-4 w-4" /> {waitingCount ? `Log the day · ${waitingCount}` : "Log minutes and notes"}
          </button>
          {footer}
        </div>
      )}
    </section>
  );
}

/**
 * "Log the day": everyone still waiting on the day, each with their minutes and a note of their own,
 * a note for everyone picked, and "didn't meet" with a reason. A student can be added who is not listed.
 */
export function LogDaySheet({ week, date, today, names, focus, onDate, onSave, onClose }: {
  week: MinutesWeek; date: string; today: string; names: string[];
  /** Open with just this student picked. */
  focus?: string;
  onDate: (date: string) => void;
  onSave: (logs: Omit<ServiceLog, "id">[]) => void;
  onClose: () => void;
}) {
  const sections = useMemo(() => daySections(week, date), [week, date]);
  const blockName = useMemo(() => new Map(week.rows.map((r) => [r.id, r.name])), [week.rows]);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [shared, setShared] = useState("");
  const [reason, setReason] = useState<string>(NOT_MET_REASONS[0]);
  const [noteOpen, setNoteOpen] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState("");
  // A new day starts fresh; opened on one student, only that one is picked.
  useEffect(() => {
    const made = dayRows(sections);
    setRows(focus ? made.map((r) => ({ ...r, on: r.key === focus })) : made);
    setNoteOpen(new Set(focus ? [focus] : []));
  }, [sections, focus]);
  const set = (key: string, change: Partial<DayRow>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const picked = rows.filter((r) => r.on);
  const logs = daySheetLogs(rows, shared, reason);
  const anyMissed = picked.some((r) => !r.met);
  const blocks = [...new Set(rows.map((r) => r.block))];
  const extraNames = names.filter((n) => !rows.some((r) => r.student === n));
  function addStudent(name: string) {
    if (!name) return;
    const key = `added:${name}:${Date.now()}`;
    setRows((list) => [...list, { key, student: name, kind: "Push-in", date, block: "", on: true, met: true, minutes: "", note: "" }]);
    setNoteOpen((s) => new Set(s).add(key));
    setAdding("");
  }
  const chip = (on: boolean) => `inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`;

  return (
    <HubModal title="Log minutes" size="md" onClose={onClose}
      footer={<div className="flex gap-2"><PrimaryButton onClick={() => onSave(logs)} disabled={!logs.length}>{logs.length ? `Save ${logs.length}` : "Save"}</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4" data-testid="log-day-sheet">
        <div className="-mx-1 flex items-center gap-1">
          <button type="button" className={navBtn} onClick={() => onDate(addDays(date, -1))} aria-label="Day before"><ChevronLeft className="h-5 w-5" /></button>
          <label className="relative min-w-0 flex-1 cursor-pointer text-center">
            <span className="block text-base font-semibold text-slate-900">{dayTitle(date)}</span>
            <span className="block text-xs text-slate-500">{date === today ? "Today" : date < today ? "Catching up a past day" : "A day ahead"}</span>
            <input type="date" value={date} max={addDays(today, 7)} onChange={(e) => e.target.value && onDate(e.target.value)} aria-label="Day to log" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
          <button type="button" className={navBtn} onClick={() => onDate(addDays(date, 1))} aria-label="Day after"><ChevronRight className="h-5 w-5" /></button>
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Pick students" data-testid="log-day-pick">
            <button type="button" className={chip(picked.length === rows.length)} onClick={() => setRows((l) => l.map((r) => ({ ...r, on: true })))}>All {rows.length}</button>
            <button type="button" className={chip(!picked.length)} onClick={() => setRows((l) => l.map((r) => ({ ...r, on: false })))}>None</button>
            {blocks.length > 1 && blocks.map((b) => { const inIt = rows.filter((r) => r.block === b); const all = inIt.every((r) => r.on) && picked.length === inIt.length; return <button key={b || "none"} type="button" className={chip(all)} onClick={() => setRows((l) => l.map((r) => ({ ...r, on: r.block === b })))}>{blockName.get(b) || "No block"}</button>; })}
          </div>
        )}

        {rows.length ? (
          <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200" data-testid="log-day-rows">
            {rows.map((r) => (
              <li key={r.key} className={`px-3 py-2.5 ${r.on ? "" : "opacity-55"}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={r.on} onChange={(e) => set(r.key, { on: e.target.checked })} aria-label={`Log ${r.student}`} className="h-5 w-5 shrink-0 accent-slate-900" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium text-slate-900">{r.student}</div>
                    <div className="truncate text-xs text-slate-500">{[blockName.get(r.block), r.kind, r.teacher].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex shrink-0 rounded-full bg-slate-100 p-0.5 text-xs font-semibold" role="group" aria-label={`Did ${r.student} meet`}>
                    <button type="button" aria-pressed={r.met} onClick={() => set(r.key, { met: true, on: true })} className={`min-h-8 rounded-full px-2.5 ${r.met ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Met</button>
                    <button type="button" aria-pressed={!r.met} onClick={() => set(r.key, { met: false, on: true })} className={`min-h-8 rounded-full px-2.5 ${!r.met ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Didn't</button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 pl-8">
                  {r.met ? (
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      <input type="number" inputMode="numeric" min={1} max={600} value={r.minutes} onChange={(e) => set(r.key, { minutes: e.target.value, on: true })} aria-label={`Minutes for ${r.student}`} className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-center text-base font-semibold text-slate-900" /> min
                    </label>
                  ) : <span className="text-xs font-medium text-slate-500">No minutes · {reason}</span>}
                  <button type="button" onClick={() => setNoteOpen((s) => { const n = new Set(s); n.has(r.key) ? n.delete(r.key) : n.add(r.key); return n; })} className={`ml-auto inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${r.note ? "text-slate-900" : "text-slate-500"} hover:bg-slate-100`} data-testid="log-day-note-toggle">
                    <NotebookPen className="h-3.5 w-3.5" /> {r.note ? "Note" : "Add note"}
                  </button>
                </div>
                {noteOpen.has(r.key) && <textarea value={r.note} onChange={(e) => set(r.key, { note: e.target.value, on: true })} rows={2} maxLength={200} placeholder={shared ? `Uses the note for everyone unless you write one` : `Note for ${r.student.split(" ")[0]}`} aria-label={`Note for ${r.student}`} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 sm:text-sm" />}
              </li>
            ))}
          </ul>
        ) : <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Nobody is waiting on this day. Add a student below to log time you gave.</p>}

        {extraNames.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Plus className="h-4 w-4 shrink-0" />
            <select value={adding} onChange={(e) => addStudent(e.target.value)} aria-label="Add a student" className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-base sm:text-sm" data-testid="log-day-add">
              <option value="">Add a student…</option>
              {extraNames.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        )}

        <div>
          <label htmlFor="log-day-shared" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Note for everyone picked{picked.length ? ` (${picked.length})` : ""}</label>
          <textarea id="log-day-shared" value={shared} onChange={(e) => setShared(e.target.value)} rows={2} maxLength={200} placeholder="What you worked on, how it went…" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 sm:text-sm" data-testid="log-day-shared" />
          <p className="mt-1 text-xs text-slate-500">A student's own note is used instead when they have one.</p>
        </div>

        {anyMissed && (
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Why they didn't meet</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Why they didn't meet" data-testid="log-day-why">
              {NOT_MET_REASONS.map((x) => <button key={x} type="button" aria-pressed={reason === x} className={chip(reason === x)} onClick={() => setReason(x)}>{x}</button>)}
            </div>
          </div>
        )}
      </div>
    </HubModal>
  );
}

/** Right after logging: add a note to what was just logged, one for all of them or each their own. */
export function NotesAfterLog({ logs, onSave, onClose }: { logs: ServiceLog[]; onSave: (notes: Record<string, string>, shared: string) => void; onClose: () => void }) {
  const [each, setEach] = useState(logs.length === 1);
  const [shared, setShared] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(logs.map((l) => [l.id, l.note || ""])));
  const ready = each ? Object.values(notes).some((n) => n.trim()) : !!shared.trim();
  return (
    <HubModal title={logs.length === 1 ? `Note for ${logs[0].student}` : `Notes for ${logs.length} students`} size="sm" onClose={onClose}
      footer={<div className="flex gap-2"><PrimaryButton disabled={!ready} onClick={() => onSave(each ? notes : Object.fromEntries(logs.map((l) => [l.id, ""])), each ? "" : shared)}>Save note{logs.length > 1 ? "s" : ""}</PrimaryButton><GhostButton onClick={onClose}>Skip</GhostButton></div>}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="notes-after-log">
        {logs.length > 1 && (
          <div className="flex rounded-full bg-slate-100 p-0.5 text-sm font-semibold" role="tablist" aria-label="Who the note is for">
            <button type="button" role="tab" aria-selected={!each} onClick={() => setEach(false)} className={`min-h-10 flex-1 rounded-full ${!each ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>One note for all</button>
            <button type="button" role="tab" aria-selected={each} onClick={() => setEach(true)} className={`min-h-10 flex-1 rounded-full ${each ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Each student</button>
          </div>
        )}
        {each ? logs.map((l) => (
          <label key={l.id} className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">{l.student} <span className="font-normal text-slate-500">· {l.notMet ? "didn't meet" : `${l.minutes} min`}</span></span>
            <textarea data-autofocus={l === logs[0] || undefined} value={notes[l.id] || ""} onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })} rows={2} maxLength={200} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
          </label>
        )) : (
          <>
            <p className="text-sm text-slate-600">{logs.map((l) => l.student.split(" ")[0]).join(", ")}</p>
            <textarea data-autofocus value={shared} onChange={(e) => setShared(e.target.value)} rows={3} maxLength={200} placeholder="What you worked on, how it went…" aria-label="Note for all" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
          </>
        )}
      </div>
    </HubModal>
  );
}
