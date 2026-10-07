// Teacher Hub: service minutes sectioned off by the blocks (periods) of the school day.
// A row for each block and a column for each day; on a phone, one day at a time with its blocks stacked.
// It opens on today, and any earlier day can be opened to add or fix what was forgotten.
// The rules are in shared/hubMinutesWeek.ts and shared/hubBlocks.ts.
import { useMemo, useState, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Settings2, Trash2 } from "lucide-react";
import { addDays } from "@shared/hubDates";
import { BLOCKS_MAX, BLOCK_NAME_MAX, cleanBlocks, schoolBlocks, type SchoolBlock } from "@shared/hubBlocks";
import { DAY_NAMES } from "@shared/hubProgress";
import { minutesWeek, monthDay, openDay, type BlockState, type MinutesCell, type MinutesDay, type MinutesItem } from "@shared/hubMinutesWeek";
import type { Workspace } from "@shared/teacherHub";
import { Field, GhostButton, PrimaryButton } from "./ui";
import { HubModal } from "./HubModal";

/** What the log pop-up opens with when it is opened from the grid. */
export type LogStart = { student?: string; kind?: string; date: string; minutes?: number; block?: string };

const ITEM_LOOK: Record<BlockState, string> = {
  logged: "border-emerald-200 bg-emerald-50 text-emerald-900",
  extra: "border-sky-200 bg-sky-100 text-sky-800",
  today: "border-teal-300 bg-white text-slate-900",
  planned: "border-slate-200 bg-white text-slate-600",
  missed: "border-amber-200 bg-amber-50 text-amber-900",
  "made up": "border-slate-200 bg-slate-50 text-slate-600",
  "any day": "border-slate-200 bg-white text-slate-700",
};
const ITEM_WORD: Record<BlockState, string> = { logged: "Done", extra: "Extra", today: "Due today", planned: "Planned", missed: "Missed", "made up": "Made up", "any day": "Any day this week" };
const DOT: Record<MinutesDay["state"], string> = { done: "bg-emerald-600", short: "bg-amber-500", today: "bg-teal-600", ahead: "bg-slate-300", empty: "bg-transparent" };
const DAY_WORD: Record<MinutesDay["state"], string> = { done: "all given", short: "minutes missed", today: "due today", ahead: "planned", empty: "nothing planned" };
// A narrow first column for the block names, then one column for each day.
const COLS: Record<number, string> = { 5: "lg:grid-cols-[6.5rem_repeat(5,minmax(0,1fr))]", 6: "lg:grid-cols-[6.5rem_repeat(6,minmax(0,1fr))]", 7: "lg:grid-cols-[6.5rem_repeat(7,minmax(0,1fr))]" };
const navBtn = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
const smallBtn = "inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50";

type Handlers = {
  /** Log these items as given, with one tap. */
  onLog: (items: MinutesItem[]) => void;
  /** Open a logged session to change it. */
  onEdit: (logId: string) => void;
  /** Open the log pop-up, filled in with what is known. */
  onAdd: (start: LogStart) => void;
  /** Put a student's plan in a block. */
  onMove: (planId: string, block: string) => void;
};

function Item({ item, today, blocks, onLog, onEdit, onAdd, onMove }: { item: MinutesItem; today: string; blocks: SchoolBlock[] } & Handlers) {
  const given = !!item.logId;
  const body = (
    <>
      <span className="block break-words text-sm font-semibold leading-snug">{item.student}</span>
      <span className="block text-xs">{item.state === "any day" ? `${item.minutes} min left` : `${item.minutes} min`} · {item.kind}</span>
      <span className="mt-0.5 block text-xs font-semibold">{given && <Check className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />}{ITEM_WORD[item.state]}{item.note ? <span className="font-normal"> · {item.note}</span> : null}</span>
    </>
  );
  const box = `rounded-xl border px-2.5 py-2 text-left ${ITEM_LOOK[item.state]}`;
  // Someone with a plan who is in no block yet can be put in one right here.
  const move = !item.block && item.planId ? (
    <select aria-label={`Put ${item.student} in a block`} value="" onChange={(e) => { if (e.target.value) onMove(item.planId!, e.target.value); }} className="mt-1.5 min-h-9 w-full rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-semibold text-slate-700" data-testid="minutes-move">
      <option value="">Put in a block…</option>
      {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  ) : null;
  if (given) return <li data-testid="minutes-item" data-state={item.state}><button type="button" className={`${box} block w-full hover:brightness-95`} onClick={() => onEdit(item.logId!)} aria-label={`${item.student}, ${item.minutes} minutes, ${ITEM_WORD[item.state].toLowerCase()}. Change`}>{body}</button>{move}</li>;
  const oneTap = item.state === "today" || item.state === "missed";
  return (
    <li className={box} data-testid="minutes-item" data-state={item.state}>
      {body}
      {oneTap && <button type="button" className="mt-1.5 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-slate-950 px-2 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => onLog([item])} aria-label={`Log ${item.minutes} minutes for ${item.student}`}>Log {item.minutes} min</button>}
      {item.state === "any day" && item.date <= today && <button type="button" className={`${smallBtn} mt-1.5 w-full`} onClick={() => onAdd({ student: item.student, kind: item.kind, date: item.date, block: item.block })} aria-label={`Log minutes for ${item.student}`}>Log minutes</button>}
      {move}
    </li>
  );
}

function Cell({ cell, day, row, shown, today, blocks, ...handlers }: { cell: MinutesCell; day: MinutesDay; row: SchoolBlock; shown: boolean; today: string; blocks: SchoolBlock[] } & Handlers) {
  const where = `${row.name}, ${DAY_NAMES[day.day]}, ${monthDay(day.date)}`;
  return (
    <div className={`min-w-0 rounded-xl border p-1.5 ${day.date === today ? "border-teal-200 bg-teal-50/60" : "border-slate-200 bg-slate-50"} ${shown ? "" : "hidden lg:block"}`} role="group" aria-label={where} data-testid="minutes-cell" data-date={day.date} data-block={row.id}>
      {cell.todo > 1 && <button type="button" className={`${smallBtn} mb-1.5 w-full`} onClick={() => handlers.onLog(cell.items)} data-testid="minutes-log-all">Log all {cell.todo}</button>}
      {cell.items.length > 0 && <ul className="space-y-1.5">{cell.items.map((item) => <Item key={item.key} item={item} today={today} blocks={blocks} {...handlers} />)}</ul>}
      <button type="button" className={`inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 ${cell.items.length ? "mt-1" : ""}`} onClick={() => handlers.onAdd({ date: day.date, block: row.id })} aria-label={`Add minutes in ${where}`} data-testid="minutes-add"><Plus className="h-3.5 w-3.5" /> Add</button>
    </div>
  );
}

export function MinutesWeekView({ workspace, today, onBlocks, ...handlers }: { workspace: Workspace; today: string; /** Open "Set up blocks". */ onBlocks: () => void } & Handlers) {
  const [weekOf, setWeekOf] = useState(today);
  const blocks = useMemo(() => schoolBlocks(workspace), [workspace.minuteBlocks]);
  const week = useMemo(() => minutesWeek(workspace.services, workspace.serviceLogs, blocks, weekOf, today), [workspace.services, workspace.serviceLogs, blocks, weekOf, today]);
  const [picked, setPicked] = useState("");
  const selected = week.days.some((d) => d.date === picked) ? picked : openDay(week, today);
  const day = week.days.find((d) => d.date === selected)!;
  const thisWeek = today >= week.start && today <= week.end;
  const go = (days: number) => { setWeekOf(addDays(week.start, days)); setPicked(""); };
  // A session with no day of its own is logged on the day being looked at, or today when today is in view.
  const anyDate = thisWeek ? today : selected;
  const dayTotal = (d: MinutesDay) => (d.planned ? `${d.done} of ${d.planned} min` : d.done ? `${d.done} min` : "Nothing planned");

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Minutes by block" data-testid="minutes-week">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={navBtn} onClick={() => go(-7)} aria-label="Week before"><ChevronLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900" data-testid="minutes-week-title">Week of {monthDay(week.start)}</h2>
          <p className="text-xs text-slate-500" data-testid="minutes-week-total">{week.planned ? `${week.done} of ${week.planned} min` : `${week.done} min`}{thisWeek ? " this week" : ""}</p>
        </div>
        {!thisWeek && <button type="button" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setWeekOf(today); setPicked(""); }}>Today</button>}
        <button type="button" className={navBtn} onClick={() => go(7)} aria-label="Week after"><ChevronRight className="h-5 w-5" /></button>
        <button type="button" className={navBtn} onClick={onBlocks} aria-label="Set up blocks" data-testid="minutes-blocks-setup"><Settings2 className="h-5 w-5" /></button>
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
      <div className="mt-3 flex items-baseline justify-between gap-2 lg:hidden" data-testid="minutes-day-title">
        <h3 className="text-base font-bold text-slate-900">{DAY_NAMES[day.day]}, {monthDay(day.date)}{day.date === today && " "}{day.date === today && <span className="ml-1 rounded-full bg-teal-600 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-white">Today</span>}</h3>
        <span className="shrink-0 text-xs text-slate-500">{dayTotal(day)}</span>
      </div>

      <div className={`mt-2 grid gap-1.5 ${COLS[week.days.length] || COLS[5]}`} data-testid="minutes-grid">
        <div className="hidden lg:block" aria-hidden />
        {week.days.map((d) => (
          <div key={d.date} className="hidden min-w-0 px-1 lg:block" data-testid="minutes-day-head" data-date={d.date}>
            <h3 className="text-sm font-bold text-slate-900">{d.day} {monthDay(d.date)}{d.date === today && " "}{d.date === today && <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Today</span>}</h3>
            <p className="text-xs text-slate-500">{dayTotal(d)}</p>
          </div>
        ))}
        {week.rows.map((row, r) => (
          <div key={row.id || "none"} className="contents" data-testid="minutes-row" data-block={row.id}>
            <div className="mt-2 flex items-baseline justify-between gap-2 px-1 lg:mt-0 lg:block lg:pt-2" data-testid="minutes-row-head">
              <h4 className="text-sm font-bold text-slate-900">{row.name}</h4>
              <p className="text-xs text-slate-500">{row.id ? "" : "Not in a block yet"}<span className="lg:hidden">{day.cells[r].done ? `${row.id ? "" : " · "}${day.cells[r].done} min` : ""}</span></p>
            </div>
            {week.days.map((d) => <Cell key={d.date} cell={d.cells[r]} day={d} row={row} shown={d.date === selected} today={today} blocks={blocks} {...handlers} />)}
          </div>
        ))}
      </div>

      {week.anyDay.length > 0 && (
        <div className="mt-3 rounded-2xl border border-slate-200 p-2" data-testid="minutes-any-day">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">Any day this week, no block</h3>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {week.anyDay.map((p) => (
              <li key={p.planId} className={`flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2 ${p.remaining ? "border-slate-200 bg-white text-slate-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{p.student} · {p.kind}</span><span className="block text-xs">{p.done} of {p.required} min{p.remaining ? ` · ${p.remaining} left` : " · done"}</span></span>
                <select aria-label={`Put ${p.student} in a block`} value="" onChange={(e) => { if (e.target.value) handlers.onMove(p.planId, e.target.value); }} className="min-h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-semibold text-slate-700">
                  <option value="">Put in a block…</option>
                  {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button type="button" className={`${smallBtn} shrink-0 px-2.5`} onClick={() => handlers.onAdd({ student: p.student, kind: p.kind, date: anyDate })} aria-label={`Log minutes for ${p.student}, ${p.kind}`}>Log</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Each day starts fresh with the students due in each block. Forgot a day? Go back to it and add the minutes, or tap a finished session to change it.</p>
    </section>
  );
}

type BlockDraft = { id: string; name: string };

/** "Set up blocks": name the blocks of the day, add or take away. */
export function BlocksModal({ blocks, makeId, onSave, onClose }: { blocks: SchoolBlock[]; makeId: () => string; onSave: (blocks: SchoolBlock[]) => void; onClose: () => void }) {
  const [rows, setRows] = useState<BlockDraft[]>(() => blocks.map((b) => ({ id: b.id, name: b.name })));
  const ready = rows.every((r) => r.name.trim()) ? cleanBlocks(rows) : null;
  function save(e: FormEvent) { e.preventDefault(); if (ready) onSave(ready); }
  return (
    <HubModal title="Set up blocks" size="sm" onClose={onClose}
      footer={<div className="flex gap-2"><PrimaryButton onClick={() => (document.getElementById("blocks-form") as HTMLFormElement | null)?.requestSubmit()} disabled={!ready}>Save</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
      <form id="blocks-form" onSubmit={save} className="grid gap-3" data-testid="blocks-form">
        <p className="text-sm text-slate-600">These are the sections your minutes are sorted into each day. A block takes the place of a clock time.</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">Name them:
          {["Block", "Period"].map((word) => <button key={word} type="button" className={smallBtn} onClick={() => setRows((list) => list.map((r, i) => ({ ...r, name: `${word} ${i + 1}` })))}>{word} 1, 2, 3…</button>)}
        </div>
        <ul className="grid gap-2">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2" data-testid="blocks-row">
              <Field value={r.name} onChange={(e) => setRows((list) => list.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} maxLength={BLOCK_NAME_MAX} aria-label={`Name of block ${i + 1}`} />
              <button type="button" disabled={rows.length < 2} onClick={() => setRows((list) => list.filter((x) => x.id !== r.id))} aria-label={`Remove ${r.name || `block ${i + 1}`}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        {rows.length < BLOCKS_MAX && <div><GhostButton onClick={() => setRows((list) => [...list, { id: makeId(), name: `${/^Period /.test(list[0]?.name || "") ? "Period" : "Block"} ${list.length + 1}` }])}><Plus className="h-4 w-4" /> Add a block</GhostButton></div>}
        <p className="text-xs text-slate-500">Removing a block does not remove any minutes. Its students move to "No block" until you put them in another one.</p>
      </form>
    </HubModal>
  );
}
