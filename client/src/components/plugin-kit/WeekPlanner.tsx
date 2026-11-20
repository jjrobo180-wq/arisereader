// The Week Planner plugin's screen: Monday to Friday side by side, what needs doing each day.
// Type a task under a day, tick it off, drag it to another day (or another spot) when the day
// gets away from you. Each new week starts empty; carry the unfinished ones over, copy a whole
// week, or put in a saved template when you want them. The rules are in shared/weekPlanner.ts.
import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, CornerDownRight, LayoutTemplate, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import type { KitRecord } from "@shared/pluginKit";
import {
  WEEKDAYS, addDays, addTask, applyTemplate, carryOffer, carryUnfinished, clearWeek, copyWeek, deleteTemplate, editTask, mondayOf,
  moveTask, removeTask, saveTemplate, skipOffer, templates, weekCounts, weekDays, weekTasks,
} from "@shared/weekPlanner";
import type { KitProps } from "./KitPlugin";

const short = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, opts);
const weekLabel = (monday: string) => {
  const fri = addDays(monday, 4);
  const sameMonth = monday.slice(5, 7) === fri.slice(5, 7);
  return `${short(monday, { month: "short", day: "numeric" })} – ${sameMonth ? short(fri, { day: "numeric" }) : short(fri, { month: "short", day: "numeric" })}`;
};

const chip = "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500";
const ghost = chip + " text-slate-600 hover:bg-slate-100";

export default function WeekPlanner({ records, setRecords, today, makeId, say }: KitProps) {
  const thisWeek = mondayOf(today);
  const [monday, setMonday] = useState(thisWeek);
  const [menu, setMenu] = useState<"" | "week" | "templates">("");
  const [tplName, setTplName] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const days = weekDays(monday);
  const cols = useMemo(() => weekTasks(records, monday), [records, monday]);
  const counts = useMemo(() => weekCounts(records, monday), [records, monday]);
  const tpls = useMemo(() => templates(records), [records]);
  const offer = monday === thisWeek ? carryOffer(records, monday) : 0;
  const nextWeek = addDays(monday, 7);

  // Dragging: what is moving, and where it would land.
  const dragId = useRef<string | null>(null);
  const [over, setOver] = useState<{ day: string; before?: string } | null>(null);
  const drop = (day: string, before?: string) => {
    const id = dragId.current;
    dragId.current = null; setOver(null);
    if (id) setRecords((all) => moveTask(all, id, day, before));
  };
  const dragOver = (e: DragEvent, day: string, before?: string) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; if (over?.day !== day || over?.before !== before) setOver({ day, before }); };

  const act = (fn: (all: KitRecord[]) => KitRecord[], msg?: string) => { setRecords(fn); setMenu(""); if (msg) say(msg); };

  return <div className="space-y-4">
    {/* Week bar */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <button type="button" className={ghost + " w-9 justify-center px-0"} onClick={() => setMonday(addDays(monday, -7))} aria-label="Last week"><ChevronLeft size={18} /></button>
        <div className="min-w-[9.5rem] text-center">
          <div className="text-[17px] font-extrabold tracking-tight text-slate-900">{weekLabel(monday)}</div>
          <div className="text-[12px] font-medium text-slate-500">{monday === thisWeek ? "This week" : monday === addDays(thisWeek, 7) ? "Next week" : monday === addDays(thisWeek, -7) ? "Last week" : short(monday, { year: "numeric" })}{counts.total ? ` · ${counts.done} of ${counts.total} done` : ""}</div>
        </div>
        <button type="button" className={ghost + " w-9 justify-center px-0"} onClick={() => setMonday(nextWeek)} aria-label="Next week"><ChevronRight size={18} /></button>
        {monday !== thisWeek && <button type="button" className={ghost} onClick={() => setMonday(thisWeek)}>Today</button>}
      </div>
      <div className="relative flex items-center gap-1">
        <button type="button" className={ghost} onClick={() => setMenu(menu === "templates" ? "" : "templates")} aria-expanded={menu === "templates"}><LayoutTemplate size={15} /> Templates</button>
        <button type="button" className={ghost + " w-9 justify-center px-0"} onClick={() => { setMenu(menu === "week" ? "" : "week"); setConfirmClear(false); }} aria-label="Week options" aria-expanded={menu === "week"}><MoreHorizontal size={18} /></button>
        {menu && <div className="absolute right-0 top-11 z-20 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {menu === "week" ? <>
            <MenuItem icon={<CornerDownRight size={15} />} label="Carry unfinished to next week" hint={`${counts.total - counts.done} not done`} disabled={counts.total === counts.done}
              onClick={() => act((all) => carryUnfinished(all, monday, nextWeek).records, "Unfinished tasks moved to next week.")} />
            <MenuItem icon={<Copy size={15} />} label="Copy this whole week to next week" hint={`${counts.total} task${counts.total === 1 ? "" : "s"}`} disabled={!counts.total}
              onClick={() => act((all) => copyWeek(all, monday, nextWeek, makeId).records, "Copied to next week.")} />
            <div className="my-1 h-px bg-slate-100" />
            {confirmClear
              ? <MenuItem icon={<Trash2 size={15} />} label="Tap again to clear this week" danger onClick={() => act((all) => clearWeek(all, monday), "Week cleared.")} />
              : <MenuItem icon={<Trash2 size={15} />} label="Clear this week" danger disabled={!counts.total} onClick={() => setConfirmClear(true)} />}
          </> : <>
            <p className="px-2 pb-1 pt-1 text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-400">Put a template in {weekLabel(monday)}</p>
            {tpls.length ? tpls.map((t) => (
              <div key={t.name} className="group flex items-center gap-1">
                <MenuItem icon={<LayoutTemplate size={15} />} label={t.name} hint={`${t.count} task${t.count === 1 ? "" : "s"}`} onClick={() => act((all) => applyTemplate(all, t.name, monday, makeId).records, `“${t.name}” added to ${weekLabel(monday)}.`)} />
                <button type="button" className="h-8 w-8 shrink-0 rounded-full text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete template ${t.name}`} onClick={() => setRecords((all) => deleteTemplate(all, t.name))}><X size={14} className="mx-auto" /></button>
              </div>
            )) : <p className="px-2 py-2 text-[13px] text-slate-500">No templates yet. Plan a week, then save it here.</p>}
            <div className="my-2 h-px bg-slate-100" />
            <form className="flex gap-1.5 px-1 pb-1" onSubmit={(e) => { e.preventDefault(); if (!tplName.trim() || !counts.total) return; act((all) => saveTemplate(all, tplName, monday, makeId), `Saved “${tplName.trim()}”.`); setTplName(""); }}>
              <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={counts.total ? "Save this week as…" : "Add tasks to save a template"} disabled={!counts.total} maxLength={60}
                className="h-9 min-w-0 flex-1 rounded-full border border-slate-200 px-3 text-[13px] outline-none focus:border-violet-400 disabled:bg-slate-50" />
              <button type="submit" disabled={!tplName.trim() || !counts.total} className={chip + " bg-slate-900 text-white disabled:opacity-40"}>Save</button>
            </form>
          </>}
        </div>}
      </div>
    </div>

    {/* A new week, with unfinished work from last week */}
    {offer > 0 && <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
      <span className="flex-1 font-semibold">New week. {offer} task{offer === 1 ? " wasn't" : "s weren't"} finished last week.</span>
      <button type="button" className={chip + " bg-violet-600 text-white hover:bg-violet-700"} onClick={() => act((all) => carryUnfinished(all, addDays(monday, -7), monday).records, "Brought over.")}>Bring them over</button>
      <button type="button" className={chip + " bg-white text-violet-700 hover:bg-violet-100"} onClick={() => act((all) => copyWeek(all, addDays(monday, -7), monday, makeId).records, "Last week copied.")}>Copy all of last week</button>
      <button type="button" className={chip + " text-violet-700 hover:bg-violet-100"} onClick={() => setRecords((all) => skipOffer(all, monday, makeId))}>Start fresh</button>
    </div>}

    {/* The five days */}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {days.map((day, i) => {
        const list = cols[i];
        const isToday = day === today;
        const done = list.filter((r) => r.data.done === true).length;
        const landing = over?.day === day;
        return <section key={day}
          onDragOver={(e) => dragOver(e, day)} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }} onDrop={(e) => { e.preventDefault(); drop(day, over?.day === day ? over.before : undefined); }}
          className={`flex min-h-[14rem] min-w-0 flex-col rounded-[1.25rem] border p-3 transition ${isToday ? "border-violet-300 bg-violet-50/40 shadow-[0_6px_24px_#6e5ae014]" : "border-slate-200/80 bg-white"} ${landing ? "ring-2 ring-violet-300" : ""}`}
          aria-label={`${WEEKDAYS[i]}, ${short(day, { month: "long", day: "numeric" })}`}>
          <header className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <div>
              <div className={`text-[11px] font-extrabold uppercase tracking-[.16em] ${isToday ? "text-violet-600" : "text-slate-400"}`}>{WEEKDAYS[i].slice(0, 3)}{isToday ? " · Today" : ""}</div>
              <div className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-900">{short(day, { day: "numeric" })}</div>
            </div>
            {list.length > 0 && <Ring done={done} total={list.length} />}
          </header>
          <ul className="flex-1 space-y-1">
            {list.map((r) => <Task key={r.id} r={r} days={days} day={day} landing={over?.day === day && over.before === r.id}
              onDragStart={() => { dragId.current = r.id; }} onDragEnd={() => { dragId.current = null; setOver(null); }}
              onDragOver={(e) => dragOver(e, day, r.id)}
              onToggle={() => setRecords((all) => editTask(all, r.id, { done: r.data.done !== true }))}
              onRename={(t) => setRecords((all) => editTask(all, r.id, { t }))}
              onMove={(to) => setRecords((all) => moveTask(all, r.id, to))}
              onDelete={() => setRecords((all) => removeTask(all, r.id))} />)}
            {landing && !over?.before && list.length > 0 && <li className="h-1 rounded-full bg-violet-400" aria-hidden />}
          </ul>
          <AddTask onAdd={(t) => setRecords((all) => addTask(all, day, t, makeId))} />
        </section>;
      })}
    </div>
    <p className="text-center text-[12px] text-slate-400">Drag a task to another day, or use its ••• menu. Each week starts fresh.</p>
  </div>;
}

function MenuItem({ icon, label, hint, onClick, disabled, danger }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className={`flex min-h-10 w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-semibold transition disabled:opacity-40 ${danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"}`}>
    <span className="shrink-0 opacity-70">{icon}</span><span className="min-w-0 flex-1 truncate">{label}</span>{hint && <span className="shrink-0 text-[11px] font-medium text-slate-400">{hint}</span>}
  </button>;
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 9, c = 2 * Math.PI * r, all = done === total;
  return <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400" title={`${done} of ${total} done`}>
    {done}/{total}
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden><circle cx="11" cy="11" r={r} fill="none" stroke="#eef0f5" strokeWidth="3" />
      <circle cx="11" cy="11" r={r} fill="none" stroke={all ? "#10b981" : "#6e5ae0"} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / total)} transform="rotate(-90 11 11)" style={{ transition: "stroke-dashoffset .3s" }} /></svg>
  </span>;
}

function Task({ r, days, day, landing, onDragStart, onDragEnd, onDragOver, onToggle, onRename, onMove, onDelete }: {
  r: KitRecord; days: string[]; day: string; landing: boolean;
  onDragStart: () => void; onDragEnd: () => void; onDragOver: (e: DragEvent) => void;
  onToggle: () => void; onRename: (t: string) => void; onMove: (day: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(r.data.t));
  const [open, setOpen] = useState(false);
  const done = r.data.done === true;
  const save = () => { setEditing(false); if (text.trim() && text.trim() !== r.data.t) onRename(text); else setText(String(r.data.t)); };
  return <>
    {landing && <li className="h-1 rounded-full bg-violet-400" aria-hidden />}
    <li draggable={!editing} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.id); onDragStart(); }} onDragEnd={onDragEnd} onDragOver={onDragOver}
      className="group relative flex cursor-grab items-start gap-2 rounded-xl px-1.5 py-1.5 transition hover:bg-slate-50 active:cursor-grabbing">
      <button type="button" onClick={onToggle} aria-label={done ? "Mark not done" : "Mark done"}
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-violet-500"}`}>
        {done && <Check size={11} strokeWidth={3.5} />}
      </button>
      {editing
        ? <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setText(String(r.data.t)); setEditing(false); } }} maxLength={300}
            className="min-w-0 flex-1 rounded-md bg-white px-1 text-[14px] leading-snug text-slate-900 outline-none ring-2 ring-violet-200" />
        : <span onDoubleClick={() => setEditing(true)} className={`min-w-0 flex-1 break-words text-[14px] leading-snug ${done ? "text-slate-400 line-through decoration-slate-300" : "text-slate-800"}`}>{String(r.data.t)}</span>}
      <button type="button" onClick={() => setOpen(!open)} aria-label="Task options" aria-expanded={open}
        className="h-6 w-6 shrink-0 rounded-full text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"><MoreHorizontal size={15} className="mx-auto" /></button>
      {open && <div className="absolute right-1 top-8 z-10 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg" onMouseLeave={() => setOpen(false)}>
        <p className="px-2 pb-0.5 pt-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Move to</p>
        {days.map((d, i) => d !== day && <button key={d} type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { onMove(d); setOpen(false); }}>{WEEKDAYS[i]}</button>)}
        <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { onMove(addDays(day, 7)); setOpen(false); }}>Same day next week</button>
        <div className="my-1 h-px bg-slate-100" />
        <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setEditing(true); setOpen(false); }}>Rename</button>
        <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50" onClick={onDelete}>Delete</button>
      </div>}
    </li>
  </>;
}

function AddTask({ onAdd }: { onAdd: (t: string) => void }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!text.trim()) return; onAdd(text); setText(""); };
  return <form onSubmit={submit} className={`mt-2 flex items-center gap-1.5 rounded-xl px-1.5 transition ${focused ? "bg-slate-50" : ""}`}>
    <Plus size={15} className="shrink-0 text-slate-300" aria-hidden />
    <input value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="Add a task" maxLength={300}
      className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-slate-800 outline-none placeholder:text-slate-400" aria-label="Add a task" />
  </form>;
}
