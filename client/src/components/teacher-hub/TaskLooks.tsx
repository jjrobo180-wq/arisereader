// The Tasks page's looks (shared/taskLooks.ts): the same to-dos, lists, check-offs and edit pop-up as the
// Original page (HubTasks.tsx), laid out six ways. The row of looks at the top of Tasks switches between
// them in one tap, and the pick is remembered on this device.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, Columns3, LayoutGrid, ListTodo, Minus, Plus, Search, Sparkles, StickyNote, Sun, ListOrdered, History, SlidersHorizontal } from "lucide-react";
import { friendlyDate, dueState } from "@shared/hubDates";
import { clock12, type Task } from "@shared/teacherHub";
import { TASK_SORTS, type TaskSort, type TaskView } from "@shared/hubTasks";
import { TASK_LOOKS, TASK_LOOK_INFO, boardColumns, dayGroups, listTiles, noteTilt, textOn, tint, todayProgress, type TaskLook } from "@shared/taskLooks";
import { CheckinRow, DailySettingsButton } from "@/components/daily/DailyCheckins";
import type { DailyApi } from "@/components/daily/useDailyCheckins";
import type { Checkin } from "@shared/dailyCheckins";

const LOOK_ICON: Record<TaskLook, ReactNode> = {
  calm: <ListTodo className="h-4 w-4" />, today: <Sun className="h-4 w-4" />, tiles: <LayoutGrid className="h-4 w-4" />,
  minimal: <Minus className="h-4 w-4" />, board: <Columns3 className="h-4 w-4" />, notes: <StickyNote className="h-4 w-4" />, classic: <History className="h-4 w-4" />,
};

/** "Customize": one small button that opens the looks in a menu, so the page stays uncluttered. */
export function LookMenu({ look, setLook, dark = false }: { look: TaskLook; setLook: (l: TaskLook) => void; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative shrink-0" data-testid="task-look-switcher">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" data-testid="task-look-customize"
        className={`inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-bold ${dark ? "bg-white/10 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:text-slate-900"}`}>
        <SlidersHorizontal className="h-4 w-4" /><span>Customize</span>
      </button>
      {open && (
        <div role="menu" aria-label="How Tasks looks" className="absolute right-0 top-12 z-40 w-[min(19rem,calc(100vw-2rem))] rounded-2xl bg-white p-1.5 text-slate-900 shadow-[0_16px_40px_#1d1b3333] ring-1 ring-slate-200">
          <p className="px-3 pb-1 pt-2 text-[12px] font-extrabold uppercase tracking-[.12em] text-slate-500">Look</p>
          {TASK_LOOKS.map((l) => (
            <button key={l} type="button" role="menuitemradio" aria-checked={look === l} onClick={() => { setLook(l); setOpen(false); }} data-testid={`task-look-${l}`}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${look === l ? "bg-[#f4f2ff]" : "hover:bg-slate-50"}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${look === l ? "bg-[#6e5ae0] text-white" : "bg-slate-100 text-slate-600"}`}>{LOOK_ICON[l]}</span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{TASK_LOOK_INFO[l].name}</span><span className="block text-[12px] leading-snug text-slate-500">{TASK_LOOK_INFO[l].blurb}</span></span>
              {look === l && <Check className="h-4 w-4 shrink-0 text-[#6e5ae0]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type List = { id: string; name: string; color: string };
export type LookProps = {
  look: Exclude<TaskLook, "classic">;
  tasks: Task[]; shown: Task[]; lists: List[]; today: string;
  view: TaskView; setView: (v: TaskView) => void; views: Record<TaskView, number>;
  listId: string; setList: (id: string) => void; listName: string;
  toggle: (task: Task) => void; edit: (id: string) => void;
  /** A new to-do in the pop-up, on this list ("" for none, undefined for the list picked now). */
  add: (listId?: string) => void;
  quick: string; setQuick: (s: string) => void; onQuickAdd: (e: FormEvent) => void; quickPlaceholder: string;
  newAsks: number; onArise?: () => void;
  search: string; setSearch: (s: string) => void; sort: TaskSort; setSort: (s: TaskSort) => void;
  /** What shows when a view has nothing in it. */
  empty: string;
  /** The Customize button (LookMenu), shown with each look's own buttons. */
  customize: (dark?: boolean) => ReactNode;
  /** LifeHub's daily check-ins (components/daily/): the Today look mixes them into its own sections. */
  daily?: DailyApi;
};

const listOf = (p: LookProps, t: Task) => p.lists.find((l) => l.id === t.listId);
const when = (t: Task, today: string) => (t.dueDate ? `${friendlyDate(t.dueDate, today)}${t.dueTime ? ` · ${clock12(t.dueTime)}` : ""}` : "");

/** The round check box every look uses: a real checkbox, so it works with a keyboard and a screen reader. */
function Tick({ task, toggle, color = "#c9c5dc", dark = false, square = false }: { task: Task; toggle: (t: Task) => void; color?: string; dark?: boolean; square?: boolean }) {
  return (
    <label className={`relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center ${square ? "rounded-md" : "rounded-full"} border-2 transition`}
      style={task.done ? { background: "#6e5ae0", borderColor: "#6e5ae0", color: "#fff" } : { borderColor: color, color: "transparent" }}>
      <input type="checkbox" className="absolute inset-0 cursor-pointer opacity-0" aria-label={`Done: ${task.title}`} checked={task.done} onChange={() => toggle(task)} />
      <Check className={`h-[14px] w-[14px] ${dark && !task.done ? "text-transparent" : ""}`} />
    </label>
  );
}

function Row({ p, task, bar = false, dark = false }: { p: LookProps; task: Task; bar?: boolean; dark?: boolean }) {
  const list = listOf(p, task);
  const late = !task.done && dueState(task.dueDate, p.today) === "overdue";
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${dark ? "border-t border-white/10" : "border-t border-slate-100"} first:border-t-0`} data-testid="task-row" data-task-id={task.id}>
      {bar && <span aria-hidden="true" className="w-1 self-stretch rounded-full" style={{ background: list?.color || "#cbd5e1" }} />}
      <Tick task={task} toggle={p.toggle} color={late ? "#e0a3a3" : dark ? "#5b587a" : "#c9c5dc"} dark={dark} />
      <button type="button" onClick={() => p.edit(task.id)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${task.title}`}>
        <span className={`block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere] ${task.done ? "text-slate-400 line-through" : dark ? "text-white" : "text-slate-900 dark:text-white"}`}>{task.title}</span>
        {!bar && (list || task.dueDate) && <span className={`mt-0.5 block text-[13px] ${dark ? "text-white/60" : "text-slate-500"}`}>
          {list && <><span style={{ color: list.color }}>●</span> {list.name}</>}{list && task.dueDate ? " · " : ""}<span className={late ? "font-semibold text-red-600" : ""}>{late ? "Late · " : ""}{when(task, p.today)}</span>
        </span>}
      </button>
      {bar && task.dueDate && <span className={`shrink-0 text-[13px] ${late ? "font-bold text-red-600" : "text-slate-500"}`}>{late ? "Late" : when(task, p.today)}</span>}
      {task.priority === "high" && !task.done && <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-[12px] font-bold text-red-700">High</span>}
    </li>
  );
}

function AddBar({ p, dark = false }: { p: LookProps; dark?: boolean }) {
  return (
    <form onSubmit={p.onQuickAdd} className={`flex gap-2 rounded-2xl p-1.5 ${dark ? "bg-white/10" : "bg-white shadow-[0_4px_16px_#1d1b3314] ring-1 ring-slate-100"}`}>
      <input value={p.quick} onChange={(e) => p.setQuick(e.target.value)} placeholder={p.quickPlaceholder} aria-label="Quick add a to-do" data-testid="tasks-quick-add"
        className={`min-h-11 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none ${dark ? "text-white placeholder:text-white/50" : "text-slate-900 placeholder:text-slate-400"}`} />
      <button type="button" onClick={() => p.add()} className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold ${dark ? "text-white/80 hover:bg-white/10" : "text-slate-600 hover:bg-slate-50"}`} aria-label="More: due date, time, notes, repeat">More</button>
      <button type="submit" aria-label="Add" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${dark ? "bg-[#ffd75e] text-[#2a1a00]" : "bg-[#6e5ae0] text-white"}`}><Plus className="h-5 w-5" /></button>
    </form>
  );
}

function AriseChip({ p, dark = false }: { p: LookProps; dark?: boolean }) {
  return <span className="inline-flex shrink-0 items-center gap-2">{p.customize(dark)}{p.onArise && <AriseButton p={p} dark={dark} />}</span>;
}
function AriseButton({ p, dark }: { p: LookProps; dark: boolean }) {
  return (
    <button type="button" onClick={p.onArise} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-bold ${dark ? "bg-white/10 text-[#d9d3ff]" : "bg-[#ece9fd] text-[#3f2fb0]"}`} data-testid="task-look-arise">
      <Sparkles className="h-4 w-4" />Arise{p.newAsks > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-black text-white">{p.newAsks}</span>}
    </button>
  );
}

function ListChips({ p }: { p: LookProps }) {
  const chip = (on: boolean) => `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-[14px] font-semibold ring-1 ${on ? "bg-[#f4f2ff] text-[#5b47d6] ring-[#d9d2fb]" : "bg-white text-slate-700 ring-slate-200"}`;
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <button type="button" onClick={() => p.setList("all")} aria-pressed={p.listId === "all"} className={chip(p.listId === "all")}>Everything</button>
      {p.lists.map((l) => <button key={l.id} type="button" onClick={() => p.setList(l.id)} aria-pressed={p.listId === l.id} className={chip(p.listId === l.id)}><span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.name}</button>)}
    </div>
  );
}

function Empty({ text, dark = false }: { text: string; dark?: boolean }) {
  return <p className={`px-4 py-8 text-center text-[15px] ${dark ? "text-white/60" : "text-slate-500"}`}>{text}</p>;
}

/** 1 · List: Today, Upcoming or All in one row; the to-dos in one card; the lists under it. */
function Calm({ p }: { p: LookProps }) {
  const [more, setMore] = useState(p.view === "completed" || p.view === "archived");
  const pill = (v: TaskView, label: string) => (
    <button key={v} type="button" onClick={() => p.setView(v)} aria-pressed={p.view === v} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold ${p.view === v ? "bg-[#1d1b33] text-white" : "bg-white text-slate-800 ring-1 ring-slate-200"}`}>
      {label}<span className={p.view === v ? "opacity-70" : "text-slate-500"}>{p.views[v]}</span>
    </button>
  );
  return (
    <div className="space-y-4" data-testid="look-calm">
      <div className="flex flex-wrap items-center gap-2">
        {pill("today", "Today")}{pill("upcoming", "Upcoming")}{pill("all", "All")}
        {more ? <>{pill("completed", "Done")}{pill("archived", "Archived")}</> : <button type="button" onClick={() => setMore(true)} className="min-h-10 rounded-full bg-white px-3 text-[15px] font-bold text-slate-600 ring-1 ring-slate-200" aria-label="Show Done and Archived">···</button>}
        <span className="ml-auto"><AriseChip p={p} /></span>
      </div>
      {p.view !== "completed" && p.view !== "archived" && <AddBar p={p} />}
      <section className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_3px_#1d1b330f] ring-1 ring-slate-100" aria-label={p.listName}>
        {p.shown.length ? <ul>{p.shown.map((t) => <Row key={t.id} p={p} task={t} />)}</ul> : <Empty text={p.empty} />}
      </section>
      <div><p className="mb-2 text-[13px] font-bold text-slate-500">Lists</p><ListChips p={p} /></div>
    </div>
  );
}

/** 2 · Today: the date big, how far along today is, then late, today, the coming week and no date. */
function TodayLook({ p }: { p: LookProps }) {
  const g = dayGroups(p.tasks, p.today, p.listId);
  const prog = todayProgress(p.tasks, p.today, p.listId);
  const d = new Date(`${p.today}T12:00:00`);
  // Daily check-ins (meals, workouts, water, doses, habits…) are rows of Today and Done today like the to-dos,
  // in time order with them, and count toward how far along today is. Only on the "All lists" view of today.
  const daily = p.daily && p.daily.settings.on && p.listId === "all" ? p.daily : undefined;
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [dailySettings, setDailySettings] = useState(false);
  const checksLeft = daily ? daily.items.filter((c) => !c.done) : [];
  const checksDone = daily ? daily.items.filter((c) => c.done) : [];
  const done = prog.done + checksDone.length, total = prog.total + (daily ? daily.total : 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  type Entry = { t: Task } | { c: Checkin };
  const timed = (e: Entry) => ("t" in e ? e.t.dueTime || "" : e.c.time);
  const merge = (tasks: Task[], checks: Checkin[]): Entry[] => [...tasks.map((t) => ({ t })), ...checks.map((c) => ({ c }))]
    .map((e, i) => ({ e, i })).sort((a, b) => (timed(a.e) || "99:99").localeCompare(timed(b.e) || "99:99") || a.i - b.i).map((x) => x.e);
  const row = (e: Entry) => ("t" in e ? <Row key={e.t.id} p={p} task={e.t} /> : <CheckinRow key={e.c.id} c={e.c} d={daily!} open={openCheck} setOpen={setOpenCheck} />);
  const section = (title: string, rows: Entry[], tone = "text-slate-500", extra?: ReactNode) => (rows.length > 0 || extra) && (
    <section aria-label={title}><div className="flex items-center px-4 pt-4"><h3 className={`text-[13px] font-extrabold ${tone}`}>{title}</h3>{extra}</div>{rows.length > 0 && <ul>{rows.map(row)}</ul>}</section>
  );
  const plainRows = (rows: Task[]) => rows.map((t) => ({ t }));
  const nothing = !g.overdue.length && !g.today.length && !g.soon.length && !g.someday.length && !g.doneToday.length && !daily?.items.length;
  return (
    <div className="rounded-[28px] bg-[#4f3cc9]" data-testid="look-today">
      <header className="px-5 pb-6 pt-5 text-white">
        {/* The controls on one row, then the day and date (Nov 23, 2026: with the day on this row too, a
            phone ran out of room and "Arise · 1" broke onto two lines). */}
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 max-w-[11rem] shrink"><span className="sr-only">List</span>
            <select value={p.listId} onChange={(e) => p.setList(e.target.value)} className="min-h-10 w-full appearance-none truncate rounded-full bg-white/15 pl-3 pr-8 text-[13px] font-bold text-white outline-none">
              <option value="all" className="text-slate-900">All lists</option>{p.lists.map((l) => <option key={l.id} value={l.id} className="text-slate-900">{l.name}</option>)}
            </select><ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4" /></label>
          {p.customize(true)}
          {p.onArise && <button type="button" onClick={p.onArise} aria-label={p.newAsks ? `Arise, ${p.newAsks} new` : "Arise"} className="ml-auto inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 text-[13px] font-extrabold text-[#3f2fb0]" data-testid="task-look-arise">
            <Sparkles className="h-4 w-4" />Arise{p.newAsks > 0 && <span className="min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[11px] font-black leading-5 text-white">{p.newAsks}</span>}
          </button>}
        </div>
        <p className="mt-5 text-[15px] font-bold text-[#d9d3ff]">{d.toLocaleDateString("en-US", { weekday: "long" })}</p>
        <h2 className="mt-1 text-[56px] font-black leading-[.95] tracking-[-0.04em]">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</h2>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Today's to-dos done"><div className="h-full rounded-full bg-[#ffd75e]" style={{ width: `${pct}%` }} /></div>
          <p className="text-[15px] font-extrabold">{total ? `${done} of ${total} done` : "Nothing due today"}</p>
        </div>
      </header>
      <div className="rounded-[28px] bg-white pb-4 dark:bg-[#151325]">
        <div className="px-4 pt-4"><AddBar p={p} /></div>
        {section("Late", plainRows(g.overdue), "text-red-700")}
        {section("Today", merge(g.today, checksLeft), "text-slate-500", p.daily && p.listId === "all" ? <DailySettingsButton d={p.daily} open={dailySettings} setOpen={setDailySettings} /> : undefined)}
        {section("This week", plainRows(g.soon))}{section("No date", plainRows(g.someday))}
        {section("Done today", [...plainRows(g.doneToday), ...checksDone.map((c) => ({ c }))])}
        {nothing && <Empty text="Nothing to do. Enjoy the breathing room." />}
      </div>
    </div>
  );
}

/** 3 · Lists: dark, a big tile for Today and each list; tap one to see its to-dos under the tiles. */
function Tiles({ p }: { p: LookProps }) {
  const tiles = listTiles(p.tasks, p.lists, p.today);
  const picked = (id: string) => (id === "today" ? p.view === "today" && p.listId === "all" : p.listId === id && p.view === "all");
  const pick = (id: string) => { if (id === "today") { p.setList("all"); p.setView("today"); } else { p.setList(id || "all"); p.setView("all"); } };
  return (
    <div className="space-y-4 rounded-[28px] bg-[#12111c] p-4 text-[#f3f2fa]" data-testid="look-tiles">
      <div className="flex items-center justify-between"><h2 className="text-[28px] font-black tracking-[-0.03em]">My lists</h2><AriseChip p={p} dark /></div>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t, i) => {
          const bg = t.id === "today" ? "#ffd75e" : t.color; const fg = textOn(bg);
          return <button key={t.id || `none-${i}`} type="button" onClick={() => pick(t.id)} aria-pressed={picked(t.id)}
            className={`flex h-36 flex-col justify-between rounded-3xl p-4 text-left transition ${picked(t.id) ? "ring-4 ring-white/80" : ""}`} style={{ background: bg, color: fg }}>
            <span className="text-[15px] font-extrabold">{t.name}</span>
            <span><span className="block text-[44px] font-black leading-none">{t.count}</span><span className="line-clamp-1 text-[13px] font-bold opacity-90">{t.late ? `${t.late} late` : t.next ? t.next.title : "All clear"}</span></span>
          </button>;
        })}
      </div>
      <AddBar p={p} dark />
      <section className="overflow-hidden rounded-2xl bg-white/5" aria-label={p.listName}>
        <h3 className="px-4 pt-3 text-[13px] font-extrabold text-white/60">{p.view === "today" ? "Today" : p.listName}</h3>
        {p.shown.length ? <ul>{p.shown.map((t) => <Row key={t.id} p={p} task={t} dark />)}</ul> : <Empty text={p.empty} dark />}
      </section>
      <div className="flex gap-2"><button type="button" onClick={() => p.setView("completed")} className="min-h-11 flex-1 rounded-2xl bg-white/10 text-[14px] font-bold">Done · {p.views.completed}</button><button type="button" onClick={() => p.setView("archived")} className="min-h-11 flex-1 rounded-2xl bg-white/10 text-[14px] font-bold">Archived</button></div>
    </div>
  );
}

/** 4 · Minimal: the list's name as the title, search and sort as icons, tabs, and a plain list. */
function Minimal({ p }: { p: LookProps }) {
  const [searching, setSearching] = useState(!!p.search);
  const tab = (v: TaskView, label: string) => <button key={v} type="button" onClick={() => p.setView(v)} aria-pressed={p.view === v} className={`min-h-11 shrink-0 border-b-[3px] text-[15px] ${p.view === v ? "border-[#6e5ae0] font-bold text-slate-900 dark:text-white" : "border-transparent font-semibold text-slate-500"}`}>{label} {v !== "completed" && v !== "archived" ? p.views[v] : ""}</button>;
  return (
    <div className="rounded-3xl bg-white dark:bg-[#151325]" data-testid="look-minimal">
      <div className="flex items-center gap-1 px-4 pt-3">
        <label className="relative min-w-0 flex-1"><span className="sr-only">List</span>
          <select value={p.listId} onChange={(e) => p.setList(e.target.value)} className="min-h-11 w-full appearance-none truncate bg-transparent pr-7 text-[26px] font-extrabold tracking-[-0.02em] text-slate-900 outline-none dark:text-white">
            <option value="all">Everything</option>{p.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select><ChevronDown className="pointer-events-none absolute right-1 top-3.5 h-5 w-5 text-slate-500" /></label>
        <AriseChip p={p} />
        <button type="button" onClick={() => { setSearching((s) => !s); if (searching) p.setSearch(""); }} aria-pressed={searching} aria-label="Search" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-50 dark:text-white"><Search className="h-5 w-5" /></button>
        <label className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-50 dark:text-white"><ListOrdered className="h-5 w-5" /><span className="sr-only">Sort</span>
          <select value={p.sort} onChange={(e) => p.setSort(e.target.value as TaskSort)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Sort to-dos">{TASK_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      </div>
      {searching && <div className="px-4 pt-2"><input type="search" autoFocus value={p.search} onChange={(e) => p.setSearch(e.target.value)} placeholder="Search tasks and notes" aria-label="Search to-dos" className="min-h-11 w-full rounded-xl bg-slate-50 px-3 text-[16px] outline-none dark:bg-white/10 dark:text-white" /></div>}
      <div className="flex gap-5 overflow-x-auto border-b border-slate-100 px-4 [scrollbar-width:none] dark:border-white/10">{tab("today", "Today")}{tab("upcoming", "Upcoming")}{tab("all", "All")}{tab("completed", "Done")}{tab("archived", "Archived")}</div>
      {p.view !== "completed" && p.view !== "archived" && (
        <form onSubmit={p.onQuickAdd} className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/10">
          <Plus className="h-5 w-5 text-[#6e5ae0]" aria-hidden="true" />
          <input value={p.quick} onChange={(e) => p.setQuick(e.target.value)} placeholder={p.quickPlaceholder} aria-label="Quick add a to-do" data-testid="tasks-quick-add" className="min-h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none dark:text-white" />
          {p.quick.trim() && <button type="submit" className="min-h-9 rounded-lg bg-[#6e5ae0] px-3 text-sm font-bold text-white">Add</button>}
        </form>
      )}
      {p.shown.length ? <ul>{p.shown.map((t) => <Row key={t.id} p={p} task={t} bar />)}</ul> : <Empty text={p.empty} />}
    </div>
  );
}

/** 6 · Board: a column for each list, side by side; scroll sideways. */
function Board({ p }: { p: LookProps }) {
  const cols = boardColumns(p.tasks, p.lists);
  return (
    <div className="space-y-3" data-testid="look-board">
      <div className="flex items-center justify-between gap-2"><p className="text-[14px] text-slate-500">Scroll sideways for each list. Tap a card to change it or move it to another list.</p><AriseChip p={p} /></div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scroll-snap-type:x_mandatory]">
        {cols.map((c) => (
          <section key={c.id || "none"} aria-label={c.name} className="flex w-[250px] shrink-0 flex-col gap-2 rounded-3xl p-3 [scroll-snap-align:start]" style={{ background: tint(c.color, 0.86) }}>
            <h3 className="flex items-center justify-between px-1 text-[16px] font-extrabold text-slate-900">{c.name}<span className="text-slate-600">{c.tasks.length}</span></h3>
            {c.tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2.5 rounded-2xl bg-white p-3 shadow-[0_1px_2px_#0000000f]" data-testid="task-row" data-task-id={t.id}>
                <Tick task={t} toggle={p.toggle} color={c.color} />
                <button type="button" onClick={() => p.edit(t.id)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${t.title}`}>
                  <span className="block text-[15px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]">{t.title}</span>
                  {t.dueDate && <span className={`mt-1 block text-[12px] font-semibold ${dueState(t.dueDate, p.today) === "overdue" ? "text-red-700" : "text-slate-500"}`}>{when(t, p.today)}</span>}
                </button>
              </div>
            ))}
            <button type="button" onClick={() => p.add(c.id)} className="min-h-11 rounded-2xl border-2 border-dashed text-[14px] font-bold" style={{ borderColor: c.color, color: "#1d1b33" }}>+ Add to {c.name}</button>
          </section>
        ))}
        {!cols.length && <Empty text="Make a list to start your board." />}
      </div>
    </div>
  );
}

/** 10 · Notes: each to-do as a sticky note in its list's color. */
function Notes({ p }: { p: LookProps }) {
  const notes = p.shown.filter((t) => !t.archived);
  return (
    <div className="space-y-4" data-testid="look-notes">
      <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><ListChips p={p} /></div><AriseChip p={p} /></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {notes.map((t) => {
          const l = listOf(p, t);
          return (
            <div key={t.id} className="relative flex h-36 flex-col justify-between rounded-md p-3.5 shadow-[0_6px_14px_#1d1b331f]" style={{ background: t.done ? "#eceaf2" : tint(l?.color || "#7566e8", 0.72), transform: `rotate(${noteTilt(t.id)}deg)` }} data-testid="task-row" data-task-id={t.id}>
              <button type="button" onClick={() => p.edit(t.id)} className="min-w-0 text-left" aria-label={`Edit ${t.title}`}>
                <span className={`line-clamp-3 text-[18px] font-extrabold leading-tight text-[#1d1b33] ${t.done ? "text-slate-500 line-through" : ""}`}>{t.title}</span>
              </button>
              <div className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-bold text-[#3a3650]">{t.dueDate ? when(t, p.today) : l?.name || ""}</span><Tick task={t} toggle={p.toggle} color="#1d1b3366" square /></div>
            </div>
          );
        })}
        {p.view !== "completed" && p.view !== "archived" && <button type="button" onClick={() => p.add()} className="flex h-36 items-center justify-center rounded-md border-2 border-dashed border-[#c9c5dc] text-[17px] font-extrabold text-[#5b47d6]">+ New note</button>}
      </div>
      {!notes.length && <Empty text={p.empty} />}
      <div className="flex gap-2 text-[14px] font-bold">{(["today", "all", "completed"] as TaskView[]).map((v) => <button key={v} type="button" onClick={() => p.setView(v)} aria-pressed={p.view === v} className={`min-h-10 rounded-full px-4 ${p.view === v ? "bg-[#1d1b33] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{v === "today" ? "Today" : v === "all" ? "All" : "Done"}</button>)}</div>
    </div>
  );
}

export function TaskLookView(p: LookProps) {
  if (p.look === "today") return <TodayLook p={p} />;
  if (p.look === "tiles") return <Tiles p={p} />;
  if (p.look === "minimal") return <Minimal p={p} />;
  if (p.look === "board") return <Board p={p} />;
  if (p.look === "notes") return <Notes p={p} />;
  return <Calm p={p} />;
}
