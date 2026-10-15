// Work & productivity apps: focus timer, kanban boards, time tracker, habits, goals with key
// results, priority matrix, invoices, mind map, decision helper, countdowns, world clock and
// meeting planner, password generator, QR code maker and bill splitter.
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Download, Pause, Pencil, Play, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { qrSvg, wifiPayload, type Ecc } from "@shared/pro/qr";
import { Bar, Btn, Card, Chart, Empty, Field, Heatmap, Modal, NumIn, Stat, Tabs, addDays, chime, daysBetween, downloadCsv, downloadText, esc, fmtDay, fmtDuration, fmtNum, fit, inputCls, lastDays, money, parseDay, printPage, randInt, streak, today, uid, usePro, useTick, useWakeLock } from "../kit";

const BLUE = "#2563eb";

// ─── Focus timer ───
type FTask = { id: string; title: string; est: number; done: number; finished: boolean };
function Pomodoro() {
  const { data, setData } = usePro<{ work: number; short: number; long: number; every: number; tasks: FTask[]; log: Record<string, number>; current: string }>("pomodoro", { work: 25, short: 5, long: 15, every: 4, tasks: [], log: {}, current: "" });
  const [mode, setMode] = useState<"work" | "short" | "long">("work");
  const [endAt, setEndAt] = useState<number | null>(null); const [pausedMs, setPausedMs] = useState<number | null>(null);
  const [count, setCount] = useState(0); const [title, setTitle] = useState("");
  useTick(endAt !== null && pausedMs === null, 250); useWakeLock(endAt !== null);
  const len = (m: typeof mode) => (m === "work" ? data.work : m === "short" ? data.short : data.long) * 60_000;
  const left = pausedMs ?? (endAt ? Math.max(0, endAt - Date.now()) : len(mode));
  useEffect(() => {
    if (!endAt || pausedMs !== null || left > 0) return;
    chime(); setEndAt(null);
    try { if (Notification.permission === "granted") new Notification(mode === "work" ? "Focus session done — take a break" : "Break's over — back to it"); } catch { /* none */ }
    if (mode === "work") { const n = count + 1; setCount(n); setData((d) => ({ ...d, log: { ...d.log, [today()]: (d.log[today()] || 0) + 1 }, tasks: d.tasks.map((t) => (t.id === d.current ? { ...t, done: t.done + 1 } : t)) })); setMode(n % data.every === 0 ? "long" : "short"); }
    else setMode("work");
  });
  const C = 2 * Math.PI * 110, color = mode === "work" ? "#dc2626" : mode === "short" ? "#16a34a" : "#2563eb";
  const cur = data.tasks.find((t) => t.id === data.current);
  return <div className="space-y-4">
    <Card className="flex flex-col items-center py-6" tint={`linear-gradient(180deg, ${color}12, #fff)`}>
      <Tabs value={mode} onChange={(m) => { setMode(m); setEndAt(null); setPausedMs(null); }} color={color} items={[{ id: "work", label: "Focus" }, { id: "short", label: "Short break" }, { id: "long", label: "Long break" }]} />
      <div className="relative mt-4" style={{ width: 250, height: 250 }}><svg width="250" height="250" className="-rotate-90"><circle cx="125" cy="125" r="110" fill="none" stroke={`${color}22`} strokeWidth="12" /><circle cx="125" cy="125" r="110" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / len(mode))} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-6xl font-black" style={{ color }}>{fmtDuration(left / 1000)}</span>{cur && mode === "work" && <span className="mt-1 max-w-[180px] truncate text-sm font-semibold text-slate-600">{cur.title}</span>}</div></div>
      <div className="mt-4 flex gap-2">{!endAt ? <Btn kind="primary" color={color} big onClick={() => { try { void Notification.requestPermission?.(); } catch { /* none */ } setEndAt(Date.now() + left); setPausedMs(null); }}><Play size={18} />Start</Btn> : pausedMs !== null ? <Btn kind="primary" color={color} big onClick={() => { setEndAt(Date.now() + pausedMs); setPausedMs(null); }}><Play size={18} />Resume</Btn> : <Btn big onClick={() => setPausedMs(left)}><Pause size={18} />Pause</Btn>}{endAt && <Btn onClick={() => { setEndAt(null); setPausedMs(null); }}>Reset</Btn>}</div>
      <p className="mt-3 text-xs text-slate-500">Session {count + 1} · long break after every {data.every}</p>
    </Card>
    <Card title="Tasks">
      <div className="flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { const t = { id: uid(), title: title.trim(), est: 2, done: 0, finished: false }; setData((d) => ({ ...d, tasks: [...d.tasks, t], current: d.current || t.id })); setTitle(""); } }} placeholder="What are you working on?" className={inputCls} /><Btn onClick={() => { if (!title.trim()) return; const t = { id: uid(), title: title.trim(), est: 2, done: 0, finished: false }; setData((d) => ({ ...d, tasks: [...d.tasks, t], current: d.current || t.id })); setTitle(""); }}><Plus size={15} /></Btn></div>
      <ul className="mt-2 space-y-1">{data.tasks.filter((t) => !t.finished).map((t) => <li key={t.id} className={`flex items-center gap-2 rounded-xl px-2 py-2 ${data.current === t.id ? "bg-rose-50 ring-1 ring-rose-200" : ""}`}>
        <button type="button" aria-label="Done" onClick={() => setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, finished: true } : x)) }))} className="inline-flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-slate-300 text-transparent hover:text-emerald-500"><Check size={14} /></button>
        <button type="button" onClick={() => setData((d) => ({ ...d, current: t.id }))} className="flex-1 text-left text-sm font-semibold">{t.title}</button>
        <span className="text-xs text-slate-500">{"🍅".repeat(Math.min(t.done, 8))} {t.done}/<input type="number" value={t.est} onChange={(e) => setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, est: Number(e.target.value) || 1 } : x)) }))} className="w-10 rounded border border-slate-200 px-1" aria-label="Estimated sessions" /></span>
      </li>)}</ul>
      {data.tasks.some((t) => t.finished) && <button type="button" onClick={() => setData((d) => ({ ...d, tasks: d.tasks.filter((t) => !t.finished) }))} className="mt-2 text-xs font-bold text-slate-500">Clear {data.tasks.filter((t) => t.finished).length} finished</button>}
    </Card>
    <div className="grid grid-cols-3 gap-2"><Stat label="Today" value={`${data.log[today()] || 0} 🍅`} sub={`${(data.log[today()] || 0) * data.work} min focused`} color="#dc2626" /><Stat label="This week" value={lastDays(7).reduce((a, d) => a + (data.log[d] || 0), 0)} /><Stat label="Streak" value={`${streak((d) => !!data.log[d])} days`} /></div>
    <Card title="Settings"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["work", "short", "long", "every"] as const).map((k) => <Field key={k} label={{ work: "Focus (min)", short: "Short break", long: "Long break", every: "Long break every" }[k]}><NumIn value={data[k]} onChange={(n) => setData((d) => ({ ...d, [k]: Math.max(1, Number(n) || 1) }))} /></Field>)}</div></Card>
  </div>;
}

// ─── Kanban ───
type KCard = { id: string; title: string; notes: string; label: string; due: string; checklist: { t: string; done: boolean }[] };
type KBoard = { id: string; name: string; columns: { id: string; name: string; cards: KCard[] }[] };
const LABELS: Record<string, string> = { "": "#e2e8f0", red: "#ef4444", orange: "#f97316", yellow: "#eab308", green: "#22c55e", blue: "#3b82f6", purple: "#a855f7" };
const newBoard = (name = "My board"): KBoard => ({ id: uid(), name, columns: ["To do", "Doing", "Done"].map((n) => ({ id: uid(), name: n, cards: [] })) });
function Kanban() {
  const { data, setData } = usePro<{ boards: KBoard[]; active: string }>("kanban", { boards: [], active: "" });
  useEffect(() => { if (!data.boards.length) { const b = newBoard(); setData({ boards: [b], active: b.id }); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const board = data.boards.find((b) => b.id === data.active) || data.boards[0];
  const [edit, setEdit] = useState<{ col: string; card: KCard } | null>(null);
  const [drag, setDrag] = useState<{ card: string; from: string } | null>(null);
  if (!board) return null;
  const upd = (fn: (b: KBoard) => KBoard) => setData((d) => ({ ...d, boards: d.boards.map((b) => (b.id === board.id ? fn(b) : b)) }));
  const move = (cardId: string, from: string, to: string, index?: number) => upd((b) => { const card = b.columns.find((c) => c.id === from)?.cards.find((c) => c.id === cardId); if (!card) return b; return { ...b, columns: b.columns.map((c) => { let cards = c.cards.filter((x) => x.id !== cardId); if (c.id === to) { cards = [...cards]; cards.splice(index ?? cards.length, 0, card); } return { ...c, cards }; }) }; });
  const saveCard = (col: string, card: KCard) => upd((b) => ({ ...b, columns: b.columns.map((c) => (c.id === col ? { ...c, cards: c.cards.some((x) => x.id === card.id) ? c.cards.map((x) => (x.id === card.id ? card : x)) : [...c.cards, card] } : c)) }));
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <select value={board.id} onChange={(e) => setData((d) => ({ ...d, active: e.target.value }))} className={`${fit("w-auto")} font-bold`}>{data.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <Btn onClick={() => { const n = window.prompt("Board name", "New board"); if (n) { const b = newBoard(n); setData((d) => ({ boards: [...d.boards, b], active: b.id })); } }}><Plus size={14} />Board</Btn>
      <Btn onClick={() => { const n = window.prompt("Rename board", board.name); if (n) upd((b) => ({ ...b, name: n })); }}><Pencil size={14} /></Btn>
      <Btn onClick={() => upd((b) => ({ ...b, columns: [...b.columns, { id: uid(), name: "New column", cards: [] }] }))}><Plus size={14} />Column</Btn>
      {data.boards.length > 1 && <Btn kind="danger" onClick={() => { if (window.confirm(`Delete "${board.name}"?`)) setData((d) => ({ boards: d.boards.filter((b) => b.id !== board.id), active: d.boards.find((b) => b.id !== board.id)!.id })); }}><Trash2 size={14} /></Btn>}
    </div>
    <div className="flex gap-3 overflow-x-auto pb-2">{board.columns.map((col, ci) => <div key={col.id} className="flex w-72 shrink-0 flex-col rounded-2xl bg-slate-100 p-2" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) move(drag.card, drag.from, col.id); setDrag(null); }}>
      <div className="mb-2 flex items-center gap-1 px-1"><input value={col.name} onChange={(e) => upd((b) => ({ ...b, columns: b.columns.map((c) => (c.id === col.id ? { ...c, name: e.target.value } : c)) }))} className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-black focus:bg-white focus:outline-none" /><span className="rounded-full bg-white px-2 text-xs font-bold text-slate-500">{col.cards.length}</span>{col.cards.length === 0 && board.columns.length > 1 && <button type="button" aria-label="Delete column" onClick={() => upd((b) => ({ ...b, columns: b.columns.filter((c) => c.id !== col.id) }))} className="text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>}</div>
      <div className="flex min-h-[40px] flex-col gap-2">{col.cards.map((card, i) => { const doneN = card.checklist.filter((c) => c.done).length; const overdue = card.due && card.due < today(); return <div key={card.id} draggable onDragStart={() => setDrag({ card: card.id, from: col.id })} onDrop={(e) => { e.stopPropagation(); if (drag) move(drag.card, drag.from, col.id, i); setDrag(null); }} onClick={() => setEdit({ col: col.id, card })} className="cursor-pointer rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200 hover:ring-blue-300">
        {card.label && <span className="mb-1 block h-1.5 w-10 rounded-full" style={{ background: LABELS[card.label] }} />}
        <p className="text-sm font-semibold">{card.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">{card.due && <span className={overdue ? "font-bold text-rose-600" : ""}>📅 {fmtDay(card.due, { month: "short", day: "numeric" })}</span>}{card.checklist.length > 0 && <span className={doneN === card.checklist.length ? "text-emerald-600" : ""}>☑ {doneN}/{card.checklist.length}</span>}{card.notes && <span>📝</span>}
          <span className="ml-auto flex gap-0.5 sm:hidden">{ci > 0 && <button type="button" aria-label="Move left" onClick={(e) => { e.stopPropagation(); move(card.id, col.id, board.columns[ci - 1].id); }}><ArrowLeft size={14} /></button>}{ci < board.columns.length - 1 && <button type="button" aria-label="Move right" onClick={(e) => { e.stopPropagation(); move(card.id, col.id, board.columns[ci + 1].id); }}><ArrowRight size={14} /></button>}</span></div>
      </div>; })}</div>
      <button type="button" onClick={() => setEdit({ col: col.id, card: { id: uid(), title: "", notes: "", label: "", due: "", checklist: [] } })} className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-slate-500 hover:bg-white">+ Add a card</button>
    </div>)}</div>
    {edit && <Modal title={edit.card.title || "New card"} onClose={() => setEdit(null)} footer={<>{board.columns.some((c) => c.cards.some((x) => x.id === edit.card.id)) && <Btn kind="danger" onClick={() => { upd((b) => ({ ...b, columns: b.columns.map((c) => ({ ...c, cards: c.cards.filter((x) => x.id !== edit.card.id) })) })); setEdit(null); }}>Delete</Btn>}<Btn kind="primary" color={BLUE} disabled={!edit.card.title.trim()} onClick={() => { saveCard(edit.col, edit.card); setEdit(null); }}>Save</Btn></>}>
      <div className="space-y-3">
        <input autoFocus value={edit.card.title} onChange={(e) => setEdit({ ...edit, card: { ...edit.card, title: e.target.value } })} placeholder="Card title" className={`${inputCls} font-bold`} />
        <div className="flex flex-wrap items-center gap-1.5">{Object.entries(LABELS).map(([k, c]) => <button key={k} type="button" aria-label={k || "No label"} onClick={() => setEdit({ ...edit, card: { ...edit.card, label: k } })} className={`h-6 w-10 rounded-md ${edit.card.label === k ? "ring-2 ring-slate-900 ring-offset-1" : ""}`} style={{ background: c }} />)}</div>
        <Field label="Due date"><input type="date" value={edit.card.due} onChange={(e) => setEdit({ ...edit, card: { ...edit.card, due: e.target.value } })} className={inputCls} /></Field>
        <Field label="Notes"><textarea value={edit.card.notes} onChange={(e) => setEdit({ ...edit, card: { ...edit.card, notes: e.target.value } })} rows={3} className={`${inputCls} h-auto py-2`} /></Field>
        <div><p className="mb-1 text-xs font-bold text-slate-600">Checklist</p>{edit.card.checklist.map((c, i) => <div key={i} className="flex items-center gap-2 py-0.5"><input type="checkbox" checked={c.done} onChange={(e) => setEdit({ ...edit, card: { ...edit.card, checklist: edit.card.checklist.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) } })} /><input value={c.t} onChange={(e) => setEdit({ ...edit, card: { ...edit.card, checklist: edit.card.checklist.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)) } })} className="flex-1 rounded border border-transparent px-1 text-sm hover:border-slate-200" /><button type="button" aria-label="Remove" onClick={() => setEdit({ ...edit, card: { ...edit.card, checklist: edit.card.checklist.filter((_, j) => j !== i) } })} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button></div>)}<Btn className="mt-1" onClick={() => setEdit({ ...edit, card: { ...edit.card, checklist: [...edit.card.checklist, { t: "", done: false }] } })}><Plus size={13} />Item</Btn></div>
      </div>
    </Modal>}
  </div>;
}

// ─── Time tracker ───
type TEntry = { id: string; project: string; task: string; start: number; end: number | null };
const PROJ_COLORS = ["#2563eb", "#16a34a", "#f97316", "#a855f7", "#e11d48", "#0891b2", "#ca8a04", "#64748b"];
function TimeTracker() {
  const { data, setData } = usePro<{ entries: TEntry[]; projects: { name: string; color: string; rate: number }[] }>("time-tracker", { entries: [], projects: [{ name: "General", color: PROJ_COLORS[0], rate: 0 }] });
  const running = data.entries.find((e) => e.end === null);
  useTick(!!running, 1000);
  const [task, setTask] = useState(""); const [project, setProject] = useState(data.projects[0]?.name || "General");
  const [week, setWeek] = useState(0);
  const start = () => setData((d) => ({ ...d, entries: [{ id: uid(), project, task: task.trim(), start: Date.now(), end: null }, ...d.entries.map((e) => (e.end === null ? { ...e, end: Date.now() } : e))] }));
  const stop = () => setData((d) => ({ ...d, entries: d.entries.map((e) => (e.end === null ? { ...e, end: Date.now() } : e)) }));
  const dur = (e: TEntry) => ((e.end ?? Date.now()) - e.start) / 1000;
  const monday = addDays(today(), -((new Date().getDay() + 6) % 7) + week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const inWeek = data.entries.filter((e) => days.includes(dayOf(e.start)));
  const byProject = data.projects.map((p) => ({ ...p, sec: inWeek.filter((e) => e.project === p.name).reduce((a, e) => a + dur(e), 0) }));
  const color = (n: string) => data.projects.find((p) => p.name === n)?.color || "#64748b";
  return <div className="space-y-4">
    <Card>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]"><input value={task} onChange={(e) => setTask(e.target.value)} placeholder="What are you working on?" className={inputCls} /><select value={project} onChange={(e) => setProject(e.target.value)} className={inputCls}>{data.projects.map((p) => <option key={p.name}>{p.name}</option>)}</select>{running ? <Btn kind="danger" onClick={stop}><Pause size={15} />Stop {fmtDuration(dur(running))}</Btn> : <Btn kind="primary" color="#0891b2" onClick={start}><Play size={15} />Start</Btn>}</div>
      {running && <p className="mt-2 text-sm"><span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />Tracking <b>{running.task || "(no description)"}</b> · {running.project}</p>}
    </Card>
    <Card title={`Week of ${fmtDay(monday, { month: "short", day: "numeric" })}`} right={<div className="flex gap-1"><Btn onClick={() => setWeek(week - 1)}><ArrowLeft size={14} /></Btn><Btn disabled={week >= 0} onClick={() => setWeek(week + 1)}><ArrowRight size={14} /></Btn><Btn onClick={() => downloadCsv("timesheet", [["Date", "Project", "Task", "Start", "End", "Hours"], ...inWeek.map((e) => [dayOf(e.start), e.project, e.task, new Date(e.start).toLocaleTimeString(), e.end ? new Date(e.end).toLocaleTimeString() : "", (dur(e) / 3600).toFixed(2)])])}><Download size={14} />CSV</Btn></div>}>
      <Chart kind="column" stacked labels={days.map((d) => fmtDay(d, { weekday: "short" }))} series={data.projects.map((p) => ({ name: p.name, values: days.map((d) => Number((inWeek.filter((e) => e.project === p.name && dayOf(e.start) === d).reduce((a, e) => a + dur(e), 0) / 3600).toFixed(2))) }))} colors={data.projects.map((p) => p.color)} height={200} />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{byProject.filter((p) => p.sec > 0).map((p) => <Stat key={p.name} label={p.name} value={fmtDuration(p.sec)} sub={p.rate ? money((p.sec / 3600) * p.rate) : undefined} color={p.color} />)}<Stat label="Total" value={fmtDuration(byProject.reduce((a, p) => a + p.sec, 0))} /></div>
    </Card>
    <Card title="Entries"><ul className="divide-y divide-slate-100">{inWeek.slice(0, 80).map((e) => <li key={e.id} className="flex items-center gap-3 py-2 text-sm"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color(e.project) }} /><span className="min-w-0 flex-1"><b>{e.task || "(no description)"}</b> <span className="text-slate-500">· {e.project} · {fmtDay(dayOf(e.start))} {new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span><span className="font-mono">{fmtDuration(dur(e))}</span><button type="button" aria-label="Delete" onClick={() => setData((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== e.id) }))} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button></li>)}</ul>{!inWeek.length && <Empty>No time tracked this week.</Empty>}</Card>
    <Card title="Projects"><div className="space-y-2">{data.projects.map((p, i) => <div key={i} className="flex items-center gap-2"><input type="color" value={p.color} onChange={(e) => setData((d) => ({ ...d, projects: d.projects.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) }))} className="h-9 w-10" /><input value={p.name} onChange={(e) => setData((d) => ({ ...d, projects: d.projects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))} className={inputCls} /><label className="flex items-center gap-1 text-xs">$/hr<NumIn value={p.rate || ""} onChange={(n) => setData((d) => ({ ...d, projects: d.projects.map((x, j) => (j === i ? { ...x, rate: Number(n) || 0 } : x)) }))} className="w-24" /></label></div>)}</div><Btn className="mt-2" onClick={() => setData((d) => ({ ...d, projects: [...d.projects, { name: `Project ${d.projects.length + 1}`, color: PROJ_COLORS[d.projects.length % PROJ_COLORS.length], rate: 0 }] }))}><Plus size={14} />Project</Btn></Card>
  </div>;
}

// ─── Habit tracker ───
type Habit = { id: string; name: string; emoji: string; color: string; days: number[]; log: string[] };
function Habits() {
  const { data, setData } = usePro<{ habits: Habit[] }>("habits", { habits: [] });
  const [edit, setEdit] = useState<Habit | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const week = lastDays(7);
  const due = (h: Habit, d: string) => h.days.includes(parseDay(d).getDay());
  const toggle = (h: Habit, d: string) => setData((x) => ({ habits: x.habits.map((y) => (y.id === h.id ? { ...y, log: y.log.includes(d) ? y.log.filter((k) => k !== d) : [...y.log, d] } : y)) }));
  const rate = (h: Habit) => { const ds = lastDays(30).filter((d) => due(h, d)); return ds.length ? Math.round((ds.filter((d) => h.log.includes(d)).length / ds.length) * 100) : 0; };
  const hStreak = (h: Habit) => { let n = 0, d = today(); if (!h.log.includes(d) && due(h, d)) d = addDays(d, -1); for (let i = 0; i < 400; i++) { if (due(h, d)) { if (h.log.includes(d)) n++; else break; } d = addDays(d, -1); } return n; };
  const selected = data.habits.find((h) => h.id === sel);
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#16a34a" onClick={() => setEdit({ id: uid(), name: "", emoji: "✅", color: "#16a34a", days: [0, 1, 2, 3, 4, 5, 6], log: [] })}><Plus size={16} />New habit</Btn></div>
    {data.habits.length ? <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left" />{week.map((d) => <th key={d} className="px-1 text-center text-xs font-bold text-slate-500">{fmtDay(d, { weekday: "narrow" })}<br />{d.slice(8)}</th>)}<th className="px-2 text-xs text-slate-500">Streak</th></tr></thead>
      <tbody>{data.habits.map((h) => <tr key={h.id} className="border-t border-slate-100"><td className="py-2"><button type="button" onClick={() => setSel(sel === h.id ? null : h.id)} className="text-left font-bold">{h.emoji} {h.name}</button></td>{week.map((d) => <td key={d} className="px-1 text-center">{due(h, d) ? <button type="button" onClick={() => toggle(h, d)} aria-label={`${h.name} ${d}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-slate-200" style={h.log.includes(d) ? { background: h.color, color: "#fff" } : undefined}>{h.log.includes(d) ? <Check size={16} /> : ""}</button> : <span className="text-slate-300">–</span>}</td>)}<td className="px-2 text-center font-black" style={{ color: h.color }}>{hStreak(h)}🔥</td></tr>)}</tbody></table></div></Card> : <Empty>Add a habit to start: drink water, read, walk, practice piano…</Empty>}
    {selected && <Card title={<>{selected.emoji} {selected.name}</>} right={<div className="flex gap-1"><Btn onClick={() => setEdit(selected)}><Pencil size={14} /></Btn></div>}><div className="mb-3 grid grid-cols-3 gap-2"><Stat label="Current streak" value={hStreak(selected)} color={selected.color} /><Stat label="Last 30 days" value={`${rate(selected)}%`} /><Stat label="Total" value={selected.log.length} /></div><Heatmap values={Object.fromEntries(selected.log.map((d) => [d, 1]))} color={selected.color} weeks={26} max={1} /></Card>}
    {edit && <Modal title={edit.name ? "Edit habit" : "New habit"} onClose={() => setEdit(null)} footer={<>{data.habits.some((h) => h.id === edit.id) && <Btn kind="danger" onClick={() => { setData((d) => ({ habits: d.habits.filter((h) => h.id !== edit.id) })); setEdit(null); setSel(null); }}>Delete</Btn>}<Btn kind="primary" color="#16a34a" disabled={!edit.name.trim() || !edit.days.length} onClick={() => { setData((d) => ({ habits: d.habits.some((h) => h.id === edit.id) ? d.habits.map((h) => (h.id === edit.id ? edit : h)) : [...d.habits, edit] })); setEdit(null); }}>Save</Btn></>}>
      <div className="space-y-3"><div className="flex gap-2"><input value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value.slice(0, 4) })} className={`${fit("w-16")} text-center text-xl`} aria-label="Emoji" /><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Read 20 minutes" className={inputCls} /><input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-10 w-12" /></div>
        <div><p className="mb-1 text-xs font-bold text-slate-600">Which days?</p><div className="flex gap-1">{["S", "M", "T", "W", "T", "F", "S"].map((l, i) => <button key={i} type="button" onClick={() => setEdit({ ...edit, days: edit.days.includes(i) ? edit.days.filter((x) => x !== i) : [...edit.days, i] })} className={`h-9 w-9 rounded-full text-sm font-bold ${edit.days.includes(i) ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>{l}</button>)}</div></div></div>
    </Modal>}
  </div>;
}

// ─── Goals & key results ───
type KR = { id: string; title: string; start: number; target: number; current: number; unit: string };
type Goal = { id: string; title: string; why: string; due: string; color: string; krs: KR[] };
function Goals() {
  const { data, setData } = usePro<{ goals: Goal[] }>("goals", { goals: [] });
  const [edit, setEdit] = useState<Goal | null>(null);
  const prog = (k: KR) => (k.target === k.start ? (k.current >= k.target ? 1 : 0) : Math.max(0, Math.min(1, (k.current - k.start) / (k.target - k.start))));
  const gProg = (g: Goal) => (g.krs.length ? g.krs.reduce((a, k) => a + prog(k), 0) / g.krs.length : 0);
  const expected = (g: Goal) => { if (!g.due) return null; const total = Math.max(1, daysBetween(addDays(g.due, -90), g.due)); return Math.max(0, Math.min(1, 1 - daysBetween(today(), g.due) / total)); };
  const setKr = (g: Goal, k: KR, current: number) => setData((d) => ({ goals: d.goals.map((x) => (x.id === g.id ? { ...x, krs: x.krs.map((y) => (y.id === k.id ? { ...y, current } : y)) } : x)) }));
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#7c3aed" onClick={() => setEdit({ id: uid(), title: "", why: "", due: addDays(today(), 90), color: "#7c3aed", krs: [{ id: uid(), title: "", start: 0, target: 10, current: 0, unit: "" }] })}><Plus size={16} />New goal</Btn></div>
    {data.goals.length ? data.goals.map((g) => { const p = gProg(g), ex = expected(g), status = p >= 1 ? ["Done 🎉", "#16a34a"] : ex === null || p >= ex - 0.1 ? ["On track", "#16a34a"] : p >= ex - 0.25 ? ["At risk", "#f59e0b"] : ["Behind", "#ef4444"]; return <Card key={g.id} title={g.title} right={<div className="flex items-center gap-2"><span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: status[1] }}>{status[0]}</span><Btn onClick={() => setEdit(g)}><Pencil size={14} /></Btn></div>}>
      {g.why && <p className="-mt-1 mb-2 text-sm text-slate-500">{g.why}</p>}
      <div className="mb-3 flex items-center gap-3"><Bar value={p} max={1} color={g.color} className="flex-1" /><span className="text-sm font-black">{Math.round(p * 100)}%</span>{g.due && <span className="text-xs text-slate-500">due {fmtDay(g.due, { month: "short", day: "numeric" })}</span>}</div>
      <ul className="space-y-2">{g.krs.map((k) => <li key={k.id} className="rounded-xl bg-slate-50 p-2.5"><div className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold">{k.title}</span><span className="flex items-center gap-1"><NumIn value={k.current} onChange={(n) => setKr(g, k, Number(n) || 0)} className="h-8 w-20" /><span className="text-xs text-slate-500">/ {k.target} {k.unit}</span></span></div><Bar value={prog(k)} max={1} color={g.color} className="mt-1.5" /></li>)}</ul>
    </Card>; }) : <Empty>Set a goal and 2–4 measurable key results. Update them weekly.</Empty>}
    {edit && <Modal title="Goal" wide onClose={() => setEdit(null)} footer={<>{data.goals.some((x) => x.id === edit.id) && <Btn kind="danger" onClick={() => { setData((d) => ({ goals: d.goals.filter((x) => x.id !== edit.id) })); setEdit(null); }}>Delete</Btn>}<Btn kind="primary" color="#7c3aed" disabled={!edit.title.trim()} onClick={() => { setData((d) => ({ goals: d.goals.some((x) => x.id === edit.id) ? d.goals.map((x) => (x.id === edit.id ? edit : x)) : [...d.goals, edit] })); setEdit(null); }}>Save</Btn></>}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Goal" className="sm:col-span-2"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Every student reads on grade level" className={inputCls} /></Field><Field label="Why it matters" className="sm:col-span-2"><input value={edit.why} onChange={(e) => setEdit({ ...edit, why: e.target.value })} className={inputCls} /></Field><Field label="Due"><input type="date" value={edit.due} onChange={(e) => setEdit({ ...edit, due: e.target.value })} className={inputCls} /></Field><Field label="Colour"><input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-10 w-16" /></Field></div>
      <p className="mb-1 mt-4 text-xs font-bold text-slate-600">Key results (measurable)</p>
      {edit.krs.map((k, i) => <div key={k.id} className="mb-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-6"><input value={k.title} onChange={(e) => setEdit({ ...edit, krs: edit.krs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Raise average reading level" className={`${inputCls} col-span-2 sm:col-span-3`} /><NumIn value={k.start} onChange={(n) => setEdit({ ...edit, krs: edit.krs.map((x, j) => (j === i ? { ...x, start: Number(n) || 0 } : x)) })} placeholder="from" /><NumIn value={k.target} onChange={(n) => setEdit({ ...edit, krs: edit.krs.map((x, j) => (j === i ? { ...x, target: Number(n) || 0 } : x)) })} placeholder="to" /><div className="flex gap-1"><input value={k.unit} onChange={(e) => setEdit({ ...edit, krs: edit.krs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })} placeholder="unit" className={inputCls} /><button type="button" aria-label="Remove" onClick={() => setEdit({ ...edit, krs: edit.krs.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div></div>)}
      <Btn onClick={() => setEdit({ ...edit, krs: [...edit.krs, { id: uid(), title: "", start: 0, target: 100, current: 0, unit: "%" }] })}><Plus size={14} />Key result</Btn>
    </Modal>}
  </div>;
}

// ─── Priority matrix ───
const QUADS = [{ k: "do", t: "Do now", s: "Urgent & important", c: "#dc2626" }, { k: "plan", t: "Schedule", s: "Important, not urgent", c: "#2563eb" }, { k: "delegate", t: "Delegate", s: "Urgent, not important", c: "#f59e0b" }, { k: "drop", t: "Drop", s: "Neither", c: "#64748b" }] as const;
type QK = (typeof QUADS)[number]["k"];
function Matrix() {
  const { data, setData } = usePro<{ items: { id: string; t: string; q: QK; done: boolean }[] }>("matrix", { items: [] });
  const [drag, setDrag] = useState<string | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  return <div className="grid gap-3 sm:grid-cols-2">{QUADS.map((q) => <div key={q.k} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) setData((d) => ({ items: d.items.map((x) => (x.id === drag ? { ...x, q: q.k } : x)) })); setDrag(null); }} className="min-h-[220px] rounded-2xl p-3 ring-2" style={{ background: `${q.c}0d`, boxShadow: `inset 0 0 0 2px ${q.c}33` }}>
    <p className="font-black" style={{ color: q.c }}>{q.t}</p><p className="mb-2 text-xs text-slate-500">{q.s}</p>
    <ul className="space-y-1.5">{data.items.filter((x) => x.q === q.k).map((x) => <li key={x.id} draggable onDragStart={() => setDrag(x.id)} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-sm shadow-sm">
      <input type="checkbox" checked={x.done} onChange={(e) => setData((d) => ({ items: d.items.map((y) => (y.id === x.id ? { ...y, done: e.target.checked } : y)) }))} />
      <span className={`flex-1 ${x.done ? "text-slate-400 line-through" : ""}`}>{x.t}</span>
      <select value={x.q} onChange={(e) => setData((d) => ({ items: d.items.map((y) => (y.id === x.id ? { ...y, q: e.target.value as QK } : y)) }))} className="h-7 rounded border border-slate-200 text-xs" aria-label="Move to">{QUADS.map((o) => <option key={o.k} value={o.k}>{o.t}</option>)}</select>
      <button type="button" aria-label="Delete" onClick={() => setData((d) => ({ items: d.items.filter((y) => y.id !== x.id) }))} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>
    </li>)}</ul>
    <input value={text[q.k] || ""} onChange={(e) => setText({ ...text, [q.k]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && (text[q.k] || "").trim()) { setData((d) => ({ items: [...d.items, { id: uid(), t: text[q.k].trim(), q: q.k, done: false }] })); setText({ ...text, [q.k]: "" }); } }} placeholder="+ Add a task (Enter)" className="mt-2 w-full rounded-lg border border-dashed border-slate-300 bg-transparent px-2 py-1.5 text-sm focus:bg-white focus:outline-none" />
    {data.items.some((x) => x.q === q.k && x.done) && <button type="button" onClick={() => setData((d) => ({ items: d.items.filter((x) => !(x.q === q.k && x.done)) }))} className="mt-1 text-xs font-bold text-slate-500">Clear done</button>}
  </div>)}</div>;
}

// ─── Invoice maker ───
type Line = { d: string; qty: number; price: number };
type Invoice = { id: string; num: string; date: string; due: string; client: string; clientAddr: string; lines: Line[]; tax: number; discount: number; notes: string; paid: boolean };
function Invoices() {
  const { data, setData } = usePro<{ me: { name: string; addr: string; email: string; phone: string; currency: string }; invoices: Invoice[]; next: number }>("invoice", { me: { name: "", addr: "", email: "", phone: "", currency: "USD" }, invoices: [], next: 1001 });
  const [edit, setEdit] = useState<Invoice | null>(null);
  const cur = data.me.currency || "USD";
  const totals = (v: Invoice) => { const sub = v.lines.reduce((a, l) => a + l.qty * l.price, 0); const disc = sub * (v.discount / 100); const tax = (sub - disc) * (v.tax / 100); return { sub, disc, tax, total: sub - disc + tax }; };
  const print = (v: Invoice) => { const t = totals(v); printPage(`Invoice ${v.num}`, `<div style="display:flex;justify-content:space-between"><div><h1 style="font-size:30px;color:#0f766e">INVOICE</h1><p><b>${esc(data.me.name)}</b><br>${esc(data.me.addr).replace(/\n/g, "<br>")}<br>${esc(data.me.email)} ${esc(data.me.phone)}</p></div><div style="text-align:right"><p>Invoice <b>#${esc(v.num)}</b><br>Date ${esc(fmtDay(v.date, { month: "long", day: "numeric", year: "numeric" }))}<br>Due ${esc(fmtDay(v.due, { month: "long", day: "numeric", year: "numeric" }))}</p></div></div><h2>Bill to</h2><p><b>${esc(v.client)}</b><br>${esc(v.clientAddr).replace(/\n/g, "<br>")}</p><table><tr><th>Description</th><th style="width:60px">Qty</th><th style="width:100px">Price</th><th style="width:110px">Amount</th></tr>${v.lines.map((l) => `<tr><td>${esc(l.d)}</td><td>${l.qty}</td><td>${money(l.price, cur)}</td><td>${money(l.qty * l.price, cur)}</td></tr>`).join("")}</table><table style="width:280px;margin-left:auto;margin-top:12px"><tr><td>Subtotal</td><td style="text-align:right">${money(t.sub, cur)}</td></tr>${v.discount ? `<tr><td>Discount ${v.discount}%</td><td style="text-align:right">−${money(t.disc, cur)}</td></tr>` : ""}${v.tax ? `<tr><td>Tax ${v.tax}%</td><td style="text-align:right">${money(t.tax, cur)}</td></tr>` : ""}<tr><th>Total due</th><th style="text-align:right">${money(t.total, cur)}</th></tr></table>${v.notes ? `<p style="margin-top:24px">${esc(v.notes).replace(/\n/g, "<br>")}</p>` : ""}`); };
  const unpaid = data.invoices.filter((v) => !v.paid);
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2"><Stat label="Unpaid" value={money(unpaid.reduce((a, v) => a + totals(v).total, 0), cur)} sub={`${unpaid.length} invoices`} color="#dc2626" /><Stat label="Overdue" value={unpaid.filter((v) => v.due < today()).length} /><Stat label="Paid this year" value={money(data.invoices.filter((v) => v.paid && v.date.slice(0, 4) === today().slice(0, 4)).reduce((a, v) => a + totals(v).total, 0), cur)} /></div>
    <div className="flex justify-end"><Btn kind="primary" color="#0f766e" onClick={() => setEdit({ id: uid(), num: String(data.next), date: today(), due: addDays(today(), 30), client: "", clientAddr: "", lines: [{ d: "", qty: 1, price: 0 }], tax: 0, discount: 0, notes: "Thank you for your business!", paid: false })}><Plus size={16} />New invoice</Btn></div>
    <Card title="Invoices">{data.invoices.length ? <ul className="divide-y divide-slate-100">{data.invoices.map((v) => <li key={v.id} className="flex items-center gap-3 py-2 text-sm"><button type="button" onClick={() => setEdit(v)} className="flex-1 text-left"><b>#{v.num} · {v.client || "No client"}</b><span className="block text-xs text-slate-500">{fmtDay(v.date)} · due {fmtDay(v.due)}</span></button><span className="font-bold">{money(totals(v).total, cur)}</span><button type="button" onClick={() => setData((d) => ({ ...d, invoices: d.invoices.map((x) => (x.id === v.id ? { ...x, paid: !x.paid } : x)) }))} className={`rounded-full px-2 py-0.5 text-xs font-bold ${v.paid ? "bg-emerald-100 text-emerald-800" : v.due < today() ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{v.paid ? "Paid" : v.due < today() ? "Overdue" : "Unpaid"}</button><Btn onClick={() => print(v)} title="Print or PDF"><Printer size={14} /></Btn></li>)}</ul> : <Empty>No invoices yet.</Empty>}</Card>
    <Card title="Your business details"><div className="grid gap-2 sm:grid-cols-2"><input value={data.me.name} onChange={(e) => setData((d) => ({ ...d, me: { ...d.me, name: e.target.value } }))} placeholder="Business or your name" className={inputCls} /><input value={data.me.email} onChange={(e) => setData((d) => ({ ...d, me: { ...d.me, email: e.target.value } }))} placeholder="Email" className={inputCls} /><textarea value={data.me.addr} onChange={(e) => setData((d) => ({ ...d, me: { ...d.me, addr: e.target.value } }))} placeholder="Address" rows={2} className={`${inputCls} h-auto py-2`} /><div className="grid grid-cols-2 gap-2"><input value={data.me.phone} onChange={(e) => setData((d) => ({ ...d, me: { ...d.me, phone: e.target.value } }))} placeholder="Phone" className={inputCls} /><select value={cur} onChange={(e) => setData((d) => ({ ...d, me: { ...d.me, currency: e.target.value } }))} className={inputCls}>{["USD", "CAD", "EUR", "GBP", "AUD", "MXN", "INR"].map((c) => <option key={c}>{c}</option>)}</select></div></div></Card>
    {edit && <Modal title={`Invoice #${edit.num}`} wide onClose={() => setEdit(null)} footer={<>{data.invoices.some((v) => v.id === edit.id) && <Btn kind="danger" onClick={() => { setData((d) => ({ ...d, invoices: d.invoices.filter((v) => v.id !== edit.id) })); setEdit(null); }}>Delete</Btn>}<Btn onClick={() => print(edit)}><Printer size={14} />Print / PDF</Btn><Btn kind="primary" color="#0f766e" onClick={() => { setData((d) => { const exists = d.invoices.some((v) => v.id === edit.id); return { ...d, invoices: exists ? d.invoices.map((v) => (v.id === edit.id ? edit : v)) : [edit, ...d.invoices], next: exists ? d.next : Math.max(d.next, Number(edit.num) || d.next) + 1 }; }); setEdit(null); }}>Save</Btn></>}>
      <div className="grid gap-2 sm:grid-cols-3"><Field label="Invoice #"><input value={edit.num} onChange={(e) => setEdit({ ...edit, num: e.target.value })} className={inputCls} /></Field><Field label="Date"><input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} className={inputCls} /></Field><Field label="Due"><input type="date" value={edit.due} onChange={(e) => setEdit({ ...edit, due: e.target.value })} className={inputCls} /></Field><Field label="Client" className="sm:col-span-3"><input value={edit.client} onChange={(e) => setEdit({ ...edit, client: e.target.value })} className={inputCls} /></Field><Field label="Client address" className="sm:col-span-3"><textarea value={edit.clientAddr} onChange={(e) => setEdit({ ...edit, clientAddr: e.target.value })} rows={2} className={`${inputCls} h-auto py-2`} /></Field></div>
      <p className="mb-1 mt-3 text-xs font-bold text-slate-600">Items</p>
      {edit.lines.map((l, i) => <div key={i} className="mb-1.5 grid grid-cols-[1fr_70px_100px_auto] gap-1.5"><input value={l.d} onChange={(e) => setEdit({ ...edit, lines: edit.lines.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)) })} placeholder="Description" className={inputCls} /><NumIn value={l.qty} onChange={(n) => setEdit({ ...edit, lines: edit.lines.map((x, j) => (j === i ? { ...x, qty: Number(n) || 0 } : x)) })} /><NumIn value={l.price} onChange={(n) => setEdit({ ...edit, lines: edit.lines.map((x, j) => (j === i ? { ...x, price: Number(n) || 0 } : x)) })} /><button type="button" aria-label="Remove" onClick={() => setEdit({ ...edit, lines: edit.lines.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div>)}
      <Btn onClick={() => setEdit({ ...edit, lines: [...edit.lines, { d: "", qty: 1, price: 0 }] })}><Plus size={14} />Item</Btn>
      <div className="mt-3 grid grid-cols-2 gap-2"><Field label="Discount %"><NumIn value={edit.discount} onChange={(n) => setEdit({ ...edit, discount: Number(n) || 0 })} /></Field><Field label="Tax %"><NumIn value={edit.tax} onChange={(n) => setEdit({ ...edit, tax: Number(n) || 0 })} /></Field></div>
      <p className="mt-3 text-right text-lg font-black">Total {money(totals(edit).total, cur)}</p>
      <Field label="Notes / payment instructions"><textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} className={`${inputCls} h-auto py-2`} /></Field>
    </Modal>}
  </div>;
}

// ─── Mind map ───
type MNode = { id: string; text: string; x: number; y: number; parent: string | null; color: string };
const MM_COLORS = ["#f97316", "#2563eb", "#16a34a", "#a855f7", "#e11d48", "#0891b2", "#ca8a04"];
function MindMap() {
  const { data, setData } = usePro<{ maps: { id: string; name: string; nodes: MNode[] }[]; active: string }>("mind-map", { maps: [], active: "" });
  useEffect(() => { if (!data.maps.length) { const id = uid(); setData({ maps: [{ id, name: "My ideas", nodes: [{ id: "root", text: "Big idea", x: 400, y: 250, parent: null, color: "#0f172a" }] }], active: id }); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const map = data.maps.find((m) => m.id === data.active) || data.maps[0];
  const [sel, setSel] = useState<string>("root");
  const [editing, setEditing] = useState<string | null>(null);
  const drag = useRef<{ id: string; x0: number; y0: number; nx: number; ny: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  if (!map) return null;
  const upd = (fn: (n: MNode[]) => MNode[]) => setData((d) => ({ ...d, maps: d.maps.map((m) => (m.id === map.id ? { ...m, nodes: fn(m.nodes) } : m)) }));
  const add = (parentId: string) => { const p = map.nodes.find((n) => n.id === parentId)!; const kids = map.nodes.filter((n) => n.parent === parentId).length; const ang = (kids * 55 - 30) * (Math.PI / 180) + (p.parent ? Math.atan2(p.y - (map.nodes.find((n) => n.id === p.parent)?.y ?? p.y), p.x - (map.nodes.find((n) => n.id === p.parent)?.x ?? p.x - 1)) : 0); const id = uid(); upd((ns) => [...ns, { id, text: "New idea", x: Math.round(p.x + Math.cos(ang) * 180), y: Math.round(p.y + Math.sin(ang) * 120), parent: parentId, color: p.parent ? p.color : MM_COLORS[kids % MM_COLORS.length] }]); setSel(id); setEditing(id); };
  const remove = (id: string) => { if (id === "root") return; const gone = new Set([id]); let grew = true; while (grew) { grew = false; for (const n of map.nodes) if (n.parent && gone.has(n.parent) && !gone.has(n.id)) { gone.add(n.id); grew = true; } } upd((ns) => ns.filter((n) => !gone.has(n.id))); setSel("root"); };
  const outline = () => { const lines: string[] = []; const walk = (id: string, depth: number) => { const n = map.nodes.find((x) => x.id === id)!; lines.push(`${"  ".repeat(depth)}${depth ? "- " : ""}${n.text}`); map.nodes.filter((x) => x.parent === id).forEach((c) => walk(c.id, depth + 1)); }; walk("root", 0); return lines.join("\n"); };
  const xs = map.nodes.map((n) => n.x), ys = map.nodes.map((n) => n.y);
  const vb = { x: Math.min(...xs) - 120, y: Math.min(...ys) - 60, w: Math.max(...xs) - Math.min(...xs) + 240, h: Math.max(...ys) - Math.min(...ys) + 120 };
  const toSvg = (e: React.PointerEvent) => { const r = svg.current!.getBoundingClientRect(); const s = Math.max(vb.w / r.width, vb.h / r.height); return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <select value={map.id} onChange={(e) => setData((d) => ({ ...d, active: e.target.value }))} className={`${fit("w-auto")} font-bold`}>{data.maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <Btn onClick={() => { const n = window.prompt("Name", "New map"); if (n) { const id = uid(); setData((d) => ({ maps: [...d.maps, { id, name: n, nodes: [{ id: "root", text: n, x: 400, y: 250, parent: null, color: "#0f172a" }] }], active: id })); setSel("root"); } }}><Plus size={14} />Map</Btn>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <Btn kind="primary" color="#f97316" onClick={() => add(sel)}><Plus size={14} />Add idea</Btn>
      <Btn onClick={() => setEditing(sel)}><Pencil size={14} />Rename</Btn>
      <Btn disabled={sel === "root"} onClick={() => remove(sel)}><Trash2 size={14} /></Btn>
      <span className="flex gap-1">{MM_COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => upd((ns) => ns.map((n) => (n.id === sel ? { ...n, color: c } : n)))} className="h-6 w-6 rounded-full" style={{ background: c }} />)}</span>
      <Btn onClick={() => { void navigator.clipboard?.writeText(outline()); }}><Copy size={14} />Copy outline</Btn>
      <Btn onClick={() => { const s = svg.current; if (s) downloadText(`${map.name}.svg`, new XMLSerializer().serializeToString(s), "image/svg+xml"); }}><Download size={14} />Image</Btn>
    </div>
    <div className="overflow-hidden rounded-2xl bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] bg-white ring-1 ring-slate-200" style={{ backgroundSize: "20px 20px" }}>
      <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="h-[520px] w-full touch-none select-none" onPointerMove={(e) => { const d = drag.current; if (!d) return; const p = toSvg(e); upd((ns) => ns.map((n) => (n.id === d.id ? { ...n, x: Math.round(d.nx + p.x - d.x0), y: Math.round(d.ny + p.y - d.y0) } : n))); }} onPointerUp={() => { drag.current = null; }}>
        {map.nodes.filter((n) => n.parent).map((n) => { const p = map.nodes.find((x) => x.id === n.parent)!; const mx = (p.x + n.x) / 2; return <path key={`l${n.id}`} d={`M${p.x} ${p.y} C${mx} ${p.y} ${mx} ${n.y} ${n.x} ${n.y}`} fill="none" stroke={n.color} strokeWidth={p.parent ? 2 : 3.5} opacity={0.7} />; })}
        {map.nodes.map((n) => { const w = Math.max(80, n.text.length * 8.5 + 28), root = !n.parent; return <g key={n.id} transform={`translate(${n.x - w / 2} ${n.y - 18})`} onPointerDown={(e) => { e.stopPropagation(); setSel(n.id); const p = toSvg(e); drag.current = { id: n.id, x0: p.x, y0: p.y, nx: n.x, ny: n.y }; }} onDoubleClick={() => setEditing(n.id)} style={{ cursor: "grab" }}>
          <rect width={w} height={36} rx={18} fill={root ? n.color : "#fff"} stroke={n.color} strokeWidth={sel === n.id ? 4 : 2} />
          <text x={w / 2} y={23} textAnchor="middle" fontSize={root ? 15 : 14} fontWeight={root ? 800 : 600} fill={root ? "#fff" : "#0f172a"} fontFamily="Inter, Arial">{n.text}</text>
        </g>; })}
      </svg>
    </div>
    <p className="text-xs text-slate-500">Drag ideas to move them. Double-click to rename. Select one and press “Add idea” to branch from it.</p>
    {editing && <Modal title="Rename idea" onClose={() => setEditing(null)} footer={<Btn kind="primary" color="#f97316" onClick={() => setEditing(null)}>Done</Btn>}><input autoFocus value={map.nodes.find((n) => n.id === editing)?.text || ""} onChange={(e) => upd((ns) => ns.map((n) => (n.id === editing ? { ...n, text: e.target.value.slice(0, 60) } : n)))} onKeyDown={(e) => { if (e.key === "Enter") setEditing(null); }} className={inputCls} /></Modal>}
  </div>;
}

// ─── Decision helper ───
function Decision() {
  const { data, setData } = usePro<{ question: string; options: string[]; criteria: { name: string; weight: number }[]; scores: Record<string, number> }>("decision", { question: "Which should I choose?", options: ["Option A", "Option B"], criteria: [{ name: "Cost", weight: 3 }, { name: "Quality", weight: 4 }, { name: "Time", weight: 2 }], scores: {} });
  const score = (o: number) => data.criteria.reduce((a, c, ci) => a + c.weight * (data.scores[`${o}|${ci}`] ?? 3), 0);
  const max = data.criteria.reduce((a, c) => a + c.weight * 5, 0) || 1;
  const ranked = data.options.map((o, i) => ({ o, i, s: score(i) })).sort((a, b) => b.s - a.s);
  return <div className="space-y-4">
    <input value={data.question} onChange={(e) => setData((d) => ({ ...d, question: e.target.value }))} className={`${inputCls} text-lg font-black`} />
    <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-1 text-left">Criteria <span className="font-normal text-slate-400">(importance 1–5)</span></th>{data.options.map((o, i) => <th key={i} className="p-1"><input value={o} onChange={(e) => setData((d) => ({ ...d, options: d.options.map((x, j) => (j === i ? e.target.value : x)) }))} className="w-28 rounded border border-slate-200 px-1 text-center font-bold" /></th>)}<th><button type="button" onClick={() => setData((d) => ({ ...d, options: [...d.options, `Option ${String.fromCharCode(65 + d.options.length)}`] }))} className="text-xs font-bold text-sky-700">+ option</button></th></tr></thead>
      <tbody>{data.criteria.map((c, ci) => <tr key={ci} className="border-t border-slate-100"><td className="p-1"><div className="flex items-center gap-1"><input value={c.name} onChange={(e) => setData((d) => ({ ...d, criteria: d.criteria.map((x, j) => (j === ci ? { ...x, name: e.target.value } : x)) }))} className="w-28 rounded border border-slate-200 px-1" /><select value={c.weight} onChange={(e) => setData((d) => ({ ...d, criteria: d.criteria.map((x, j) => (j === ci ? { ...x, weight: Number(e.target.value) } : x)) }))} className="rounded border border-slate-200 text-xs">{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></div></td>
        {data.options.map((_, oi) => <td key={oi} className="p-1 text-center"><div className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setData((d) => ({ ...d, scores: { ...d.scores, [`${oi}|${ci}`]: n } }))} className={`h-6 w-6 rounded text-xs font-bold ${(data.scores[`${oi}|${ci}`] ?? 3) >= n ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-400"}`}>{n}</button>)}</div></td>)}</tr>)}</tbody></table></div>
      <Btn className="mt-2" onClick={() => setData((d) => ({ ...d, criteria: [...d.criteria, { name: "New criterion", weight: 3 }] }))}><Plus size={14} />Criterion</Btn></Card>
    <Card title="Result">{ranked.map((r, i) => <div key={r.i} className="mb-2"><div className="flex justify-between text-sm"><span className="font-black">{i === 0 ? "🏆 " : ""}{r.o}</span><span>{Math.round((r.s / max) * 100)}%</span></div><Bar value={r.s} max={max} color={i === 0 ? "#0ea5e9" : "#94a3b8"} /></div>)}<p className="mt-2 text-xs text-slate-500">Scores are weighted by how important each criterion is. Surprised by the result? That's useful information too.</p></Card>
  </div>;
}

// ─── Countdowns ───
type CD = { id: string; name: string; date: string; time: string; emoji: string; color: string };
function Countdowns() {
  const { data, setData } = usePro<{ list: CD[] }>("countdowns", { list: [] });
  const [edit, setEdit] = useState<CD | null>(null);
  useTick(true, 1000);
  const ms = (c: CD) => new Date(`${c.date}T${c.time || "00:00"}`).getTime() - Date.now();
  const parts = (m: number) => { const a = Math.abs(m) / 1000; return { d: Math.floor(a / 86400), h: Math.floor((a % 86400) / 3600), m: Math.floor((a % 3600) / 60), s: Math.floor(a % 60) }; };
  const sorted = [...data.list].sort((a, b) => (ms(a) < 0 ? 1 : 0) - (ms(b) < 0 ? 1 : 0) || Math.abs(ms(a)) - Math.abs(ms(b)));
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#db2777" onClick={() => setEdit({ id: uid(), name: "", date: addDays(today(), 30), time: "", emoji: "🎉", color: "#db2777" })}><Plus size={16} />New countdown</Btn></div>
    {sorted.length ? <div className="grid gap-3 sm:grid-cols-2">{sorted.map((c) => { const m = ms(c), p = parts(m); return <button key={c.id} type="button" onClick={() => setEdit(c)} className="rounded-3xl p-5 text-left text-white shadow-md" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}bb)`, opacity: m < 0 ? 0.75 : 1 }}>
      <p className="text-3xl">{c.emoji}</p><p className="mt-1 text-lg font-black">{c.name}</p><p className="text-xs opacity-80">{fmtDay(c.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      <p className="mt-3 font-mono text-4xl font-black">{p.d}<span className="text-base"> days</span></p><p className="font-mono text-sm opacity-90">{String(p.h).padStart(2, "0")}:{String(p.m).padStart(2, "0")}:{String(p.s).padStart(2, "0")} {m < 0 ? "ago" : "to go"} · {fmtNum(p.d / 7, 1)} weeks</p>
    </button>; })}</div> : <Empty>Count down to a trip, birthday, the last day of school or a deadline.</Empty>}
    {edit && <Modal title="Countdown" onClose={() => setEdit(null)} footer={<>{data.list.some((c) => c.id === edit.id) && <Btn kind="danger" onClick={() => { setData((d) => ({ list: d.list.filter((c) => c.id !== edit.id) })); setEdit(null); }}>Delete</Btn>}<Btn kind="primary" color="#db2777" disabled={!edit.name.trim()} onClick={() => { setData((d) => ({ list: d.list.some((c) => c.id === edit.id) ? d.list.map((c) => (c.id === edit.id ? edit : c)) : [...d.list, edit] })); setEdit(null); }}>Save</Btn></>}>
      <div className="grid grid-cols-2 gap-3"><Field label="What" className="col-span-2"><div className="flex gap-2"><input value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value.slice(0, 4) })} className={`${fit("w-16")} text-center text-xl`} aria-label="Emoji" /><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Summer vacation" className={inputCls} /></div></Field><Field label="Date"><input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} className={inputCls} /></Field><Field label="Time (optional)"><input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} className={inputCls} /></Field><Field label="Colour"><input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-10 w-16" /></Field></div>
    </Modal>}
  </div>;
}

// ─── World clock & meeting planner ───
const ZONES = ["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Africa/Lagos", "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "Pacific/Honolulu", "America/Anchorage", "America/Mexico_City", "America/Toronto", "Asia/Manila", "Asia/Seoul", "Europe/Madrid", "Europe/Rome"];
const city = (z: string) => z.split("/").pop()!.replace(/_/g, " ");
const hourIn = (z: string, t: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: z, hour: "numeric", hour12: false }).format(t)) % 24;
function WorldClock() {
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, setData } = usePro<{ zones: string[]; start: number; end: number }>("world-clock", { zones: [here, "America/New_York", "Europe/London", "Asia/Kolkata"], start: 9, end: 17 });
  useTick(true, 1000);
  const [add, setAdd] = useState(ZONES[0]);
  const base = new Date(); base.setMinutes(0, 0, 0);
  const hours = Array.from({ length: 24 }, (_, i) => new Date(base.getTime() + i * 3_600_000));
  const ok = (h: number) => h >= data.start && h < data.end;
  const good = hours.filter((t) => data.zones.every((z) => ok(hourIn(z, t))));
  const [pick, setPick] = useState<number | null>(null);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.zones.map((z) => { const now = new Date(); return <Card key={z}><div className="flex items-start justify-between"><p className="text-sm font-bold text-slate-500">{city(z)}{z === here ? " · you" : ""}</p><button type="button" aria-label="Remove" onClick={() => setData((d) => ({ ...d, zones: d.zones.filter((x) => x !== z) }))} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button></div><p className="font-mono text-3xl font-black">{now.toLocaleTimeString([], { timeZone: z, hour: "numeric", minute: "2-digit" })}</p><p className="text-xs text-slate-500">{now.toLocaleDateString([], { timeZone: z, weekday: "short", month: "short", day: "numeric" })}</p></Card>; })}</div>
    <div className="flex flex-wrap gap-2"><select value={add} onChange={(e) => setAdd(e.target.value)} className={`${fit("w-auto")}`}>{ZONES.map((z) => <option key={z} value={z}>{city(z)}</option>)}</select><Btn onClick={() => setData((d) => ({ ...d, zones: d.zones.includes(add) ? d.zones : [...d.zones, add] }))}><Plus size={14} />Add city</Btn><span className="ml-auto flex items-center gap-1 text-sm">Working hours <NumIn value={data.start} onChange={(n) => setData((d) => ({ ...d, start: Number(n) || 0 }))} className="w-16" /> to <NumIn value={data.end} onChange={(n) => setData((d) => ({ ...d, end: Number(n) || 0 }))} className="w-16" /></span></div>
    <Card title="Find a meeting time (next 24 hours)">
      <div className="overflow-x-auto"><table className="text-xs"><tbody>{data.zones.map((z) => <tr key={z}><td className="pr-2 font-bold">{city(z)}</td>{hours.map((t, i) => { const h = hourIn(z, t); return <td key={i} onClick={() => setPick(i)} className={`h-8 min-w-[30px] cursor-pointer border border-white text-center ${pick === i ? "ring-2 ring-sky-600" : ""}`} style={{ background: ok(h) ? "#bbf7d0" : h >= 7 && h < 22 ? "#fef9c3" : "#e2e8f0" }}>{h % 12 || 12}{h < 12 ? "a" : "p"}</td>; })}</tr>)}</tbody></table></div>
      <p className="mt-2 text-sm">{good.length ? <>Times that work for everyone: <b>{good.map((t) => t.toLocaleTimeString([], { hour: "numeric" })).join(", ")}</b> (your time)</> : "No hour is inside everyone's working hours — yellow cells are early or late but awake."}</p>
      {pick !== null && <div className="mt-2 rounded-xl bg-sky-50 p-3 text-sm">{data.zones.map((z) => <p key={z}><b>{city(z)}:</b> {hours[pick].toLocaleString([], { timeZone: z, weekday: "short", hour: "numeric", minute: "2-digit" })}</p>)}<Btn className="mt-2" onClick={() => void navigator.clipboard?.writeText(data.zones.map((z) => `${city(z)}: ${hours[pick].toLocaleString([], { timeZone: z, weekday: "short", hour: "numeric", minute: "2-digit" })}`).join("\n"))}><Copy size={14} />Copy times</Btn></div>}
    </Card>
  </div>;
}

// ─── Password generator ───
const WORDS = "apple river tiger cloud piano maple rocket candle forest silver orange garden ocean thunder pencil castle dragon meadow violet harbor jungle summit lantern breeze copper falcon marble nectar orbit pepper quartz saddle tulip velvet walnut yellow zebra anchor bamboo cactus dolphin ember feather glacier hammock island jasmine koala lemon mango nutmeg olive pebble quill radish sparrow tango umbrella vortex willow oyster bridge cookie dune echo fable galaxy honey igloo jelly kettle lagoon mosaic noodle opal parade quiver ribbon sunset timber unicorn valley wander yodel zephyr acorn blossom canyon daisy eagle fossil gecko hazel ivory jigsaw kayak llama mitten nugget orchid puffin quokka raven salsa tundra".split(" ");
const pick = (s: string) => s[randInt(s.length)];
function Passwords() {
  const [mode, setMode] = useState<"password" | "phrase" | "pin">("password");
  const [len, setLen] = useState(16); const [words, setWords] = useState(4);
  const [opt, setOpt] = useState({ upper: true, lower: true, digits: true, symbols: true, ambiguous: false, sep: "-", cap: true, num: true });
  const [pw, setPw] = useState(""); const [copied, setCopied] = useState(false);
  const make = () => {
    if (mode === "pin") return Array.from({ length: Math.max(4, Math.min(12, len)) }, () => pick("0123456789")).join("");
    if (mode === "phrase") { const ws = Array.from({ length: words }, () => { const w = WORDS[randInt(WORDS.length)]; return opt.cap ? w[0].toUpperCase() + w.slice(1) : w; }); if (opt.num) ws.push(String(randInt(90) + 10)); return ws.join(opt.sep); }
    let sets = [opt.lower && "abcdefghijkmnopqrstuvwxyz", opt.upper && "ABCDEFGHJKLMNPQRSTUVWXYZ", opt.digits && "23456789", opt.symbols && "!@#$%^&*-_=+?"].filter(Boolean) as string[];
    if (opt.ambiguous) sets = sets.map((s) => s + (s.includes("a") ? "l" : s.includes("A") ? "IO" : s.includes("2") ? "01" : ""));
    if (!sets.length) return "";
    const all = sets.join(""); const out = sets.map(pick); while (out.length < len) out.push(pick(all));
    return shuffleStr(out).join("");
  };
  const shuffleStr = (a: string[]) => { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  useEffect(() => { setPw(make()); setCopied(false); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, len, words, opt]);
  const pool = mode === "pin" ? 10 : mode === "phrase" ? WORDS.length : [opt.lower && 25, opt.upper && 24, opt.digits && 8, opt.symbols && 13].reduce((a: number, b) => a + (b || 0), 0);
  const bits = mode === "phrase" ? words * Math.log2(pool) + (opt.num ? Math.log2(90) : 0) : pw.length * Math.log2(Math.max(2, pool));
  const crack = (() => { const sec = Math.pow(2, bits) / 2 / 1e10; if (sec < 1) return "instantly"; if (sec < 3600) return `${Math.round(sec / 60)} minutes`; if (sec < 86400 * 365) return `${Math.round(sec / 86400)} days`; const y = sec / (86400 * 365); return y > 1e9 ? "billions of years" : y > 1e6 ? `${Math.round(y / 1e6)} million years` : `${Math.round(y).toLocaleString()} years`; })();
  const strength = bits < 40 ? ["Weak", "#ef4444"] : bits < 60 ? ["Okay", "#f59e0b"] : bits < 80 ? ["Strong", "#22c55e"] : ["Very strong", "#15803d"];
  return <div className="space-y-4">
    <Tabs value={mode} onChange={setMode} color="#334155" items={[{ id: "password", label: "Password" }, { id: "phrase", label: "Passphrase" }, { id: "pin", label: "PIN" }]} />
    <Card><div className="flex items-center gap-2"><p className="min-w-0 flex-1 break-all rounded-xl bg-slate-900 px-4 py-4 font-mono text-xl font-bold text-emerald-300">{pw}</p><div className="flex flex-col gap-1"><Btn onClick={() => { void navigator.clipboard?.writeText(pw); setCopied(true); }}>{copied ? <Check size={15} /> : <Copy size={15} />}</Btn><Btn onClick={() => { setPw(make()); setCopied(false); }}><RefreshCw size={15} /></Btn></div></div>
      <div className="mt-3 flex items-center gap-3"><Bar value={Math.min(bits, 100)} max={100} color={strength[1]} className="flex-1" /><span className="text-sm font-black" style={{ color: strength[1] }}>{strength[0]}</span></div>
      <p className="mt-1 text-xs text-slate-500">{Math.round(bits)} bits · a fast computer guessing 10 billion a second would need about <b>{crack}</b>.</p></Card>
    <Card title="Options">{mode === "phrase" ? <div className="grid grid-cols-2 gap-3"><Field label={`Words: ${words}`}><input type="range" min={3} max={8} value={words} onChange={(e) => setWords(Number(e.target.value))} className="w-full" /></Field><Field label="Separator"><select value={opt.sep} onChange={(e) => setOpt({ ...opt, sep: e.target.value })} className={inputCls}>{["-", ".", "_", " ", ""].map((s) => <option key={s} value={s}>{s === " " ? "space" : s || "none"}</option>)}</select></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={opt.cap} onChange={(e) => setOpt({ ...opt, cap: e.target.checked })} />Capitalize</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={opt.num} onChange={(e) => setOpt({ ...opt, num: e.target.checked })} />Add a number</label></div>
      : <><Field label={`Length: ${len}`}><input type="range" min={mode === "pin" ? 4 : 8} max={mode === "pin" ? 12 : 64} value={len} onChange={(e) => setLen(Number(e.target.value))} className="w-full" /></Field>{mode === "password" && <div className="mt-2 grid grid-cols-2 gap-2 text-sm">{([["upper", "A–Z"], ["lower", "a–z"], ["digits", "0–9"], ["symbols", "!@#$"], ["ambiguous", "Allow look-alikes (l, 1, O, 0)"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={opt[k]} onChange={(e) => setOpt({ ...opt, [k]: e.target.checked })} />{l}</label>)}</div>}</>}</Card>
    <p className="text-xs text-slate-500">Made on your device with the browser's secure random numbers. Nothing is saved or sent anywhere.</p>
  </div>;
}

// ─── QR codes ───
function QrMaker() {
  const [kind, setKind] = useState<"url" | "text" | "wifi" | "email" | "phone">("url");
  const [v, setV] = useState({ url: "https://", text: "", ssid: "", pass: "", sec: "WPA" as "WPA" | "WEP" | "nopass", email: "", subject: "", phone: "", label: "" });
  const [ecc, setEcc] = useState<Ecc>("M"); const [dark, setDark] = useState("#000000");
  const payload = kind === "url" ? v.url : kind === "text" ? v.text : kind === "wifi" ? wifiPayload(v.ssid, v.pass, v.sec) : kind === "email" ? `mailto:${v.email}${v.subject ? `?subject=${encodeURIComponent(v.subject)}` : ""}` : `tel:${v.phone}`;
  const svg = useMemo(() => { try { return payload && payload !== "https://" ? qrSvg(payload, ecc, { dark, px: 10 }) : ""; } catch (e: any) { return `ERR${e.message}`; } }, [payload, ecc, dark]);
  const png = () => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = img.width * 2; c.height = img.height * 2; const g = c.getContext("2d")!; g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "qr-code.png"; a.click(); }); }; img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; };
  return <div className="grid gap-4 md:grid-cols-2">
    <Card><Tabs value={kind} onChange={setKind} color="#0f172a" items={[{ id: "url", label: "Link" }, { id: "text", label: "Text" }, { id: "wifi", label: "Wi-Fi" }, { id: "email", label: "Email" }, { id: "phone", label: "Phone" }]} />
      <div className="mt-3 space-y-3">
        {kind === "url" && <Field label="Web address"><input value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} className={inputCls} /></Field>}
        {kind === "text" && <Field label="Text"><textarea value={v.text} onChange={(e) => setV({ ...v, text: e.target.value.slice(0, 900) })} rows={4} className={`${inputCls} h-auto py-2`} /></Field>}
        {kind === "wifi" && <><Field label="Network name"><input value={v.ssid} onChange={(e) => setV({ ...v, ssid: e.target.value })} className={inputCls} /></Field><Field label="Password"><input value={v.pass} onChange={(e) => setV({ ...v, pass: e.target.value })} className={inputCls} /></Field><Field label="Security"><select value={v.sec} onChange={(e) => setV({ ...v, sec: e.target.value as typeof v.sec })} className={inputCls}><option value="WPA">WPA/WPA2/WPA3</option><option value="WEP">WEP</option><option value="nopass">None</option></select></Field></>}
        {kind === "email" && <><Field label="Email"><input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={inputCls} /></Field><Field label="Subject"><input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} className={inputCls} /></Field></>}
        {kind === "phone" && <Field label="Phone number"><input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} className={inputCls} /></Field>}
        <div className="grid grid-cols-2 gap-2"><Field label="Error correction"><select value={ecc} onChange={(e) => setEcc(e.target.value as Ecc)} className={inputCls}><option value="L">Low (smallest)</option><option value="M">Medium</option><option value="Q">High</option><option value="H">Highest (survives damage)</option></select></Field><Field label="Colour"><input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="h-10 w-16" /></Field></div>
        <Field label="Caption for printing (optional)"><input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="Scan to join our Wi-Fi" className={inputCls} /></Field>
      </div></Card>
    <Card className="flex flex-col items-center justify-center gap-3">{svg.startsWith("ERR") ? <p className="text-rose-600">{svg.slice(3)}</p> : svg ? <><div className="w-full max-w-[300px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /><div className="flex gap-2"><Btn kind="primary" color="#0f172a" onClick={png}><Download size={15} />PNG</Btn><Btn onClick={() => downloadText("qr-code.svg", svg, "image/svg+xml")}>SVG</Btn><Btn onClick={() => printPage("QR code", `<div style="text-align:center;margin-top:40px">${svg.replace(/width="\d+" height="\d+"/, 'width="360" height="360"')}<h1 style="font-size:28px;margin-top:16px">${esc(v.label)}</h1>${kind === "wifi" ? `<p>Network: <b>${esc(v.ssid)}</b>${v.pass ? `<br>Password: <b>${esc(v.pass)}</b>` : ""}</p>` : ""}</div>`)}><Printer size={15} />Print</Btn></div></> : <p className="text-sm text-slate-500">Type something to make a QR code.</p>}</Card>
  </div>;
}

// ─── Bill splitter ───
type Exp = { id: string; what: string; amount: number; paidBy: string; split: string[] };
export function settle(people: string[], expenses: Exp[]): { from: string; to: string; amount: number }[] {
  const bal: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]));
  for (const e of expenses) { const who = e.split.length ? e.split : people; const share = e.amount / who.length; bal[e.paidBy] = (bal[e.paidBy] || 0) + e.amount; for (const p of who) bal[p] = (bal[p] || 0) - share; }
  const debt = Object.entries(bal).filter(([, v]) => v < -0.005).map(([p, v]) => ({ p, v: -v })).sort((a, b) => b.v - a.v);
  const cred = Object.entries(bal).filter(([, v]) => v > 0.005).map(([p, v]) => ({ p, v })).sort((a, b) => b.v - a.v);
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) { const amt = Math.min(debt[i].v, cred[j].v); out.push({ from: debt[i].p, to: cred[j].p, amount: Math.round(amt * 100) / 100 }); debt[i].v -= amt; cred[j].v -= amt; if (debt[i].v < 0.005) i++; if (cred[j].v < 0.005) j++; }
  return out;
}
function Split() {
  const { data, setData } = usePro<{ groups: { id: string; name: string; people: string[]; expenses: Exp[] }[]; active: string }>("split", { groups: [], active: "" });
  useEffect(() => { if (!data.groups.length) { const id = uid(); setData({ groups: [{ id, name: "Weekend trip", people: ["Me", "Sam"], expenses: [] }], active: id }); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const g = data.groups.find((x) => x.id === data.active) || data.groups[0];
  const [e, setE] = useState<Exp | null>(null); const [person, setPerson] = useState("");
  if (!g) return null;
  const upd = (fn: (x: typeof g) => typeof g) => setData((d) => ({ ...d, groups: d.groups.map((x) => (x.id === g.id ? fn(x) : x)) }));
  const plan = settle(g.people, g.expenses);
  const total = g.expenses.reduce((a, x) => a + x.amount, 0);
  const summary = `${g.name}\nTotal: ${money(total)}\n${plan.map((p) => `${p.from} pays ${p.to} ${money(p.amount)}`).join("\n") || "All settled!"}`;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><select value={g.id} onChange={(ev) => setData((d) => ({ ...d, active: ev.target.value }))} className={`${fit("w-auto")} font-bold`}>{data.groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><Btn onClick={() => { const n = window.prompt("Group name", "Dinner"); if (n) { const id = uid(); setData((d) => ({ groups: [...d.groups, { id, name: n, people: ["Me"], expenses: [] }], active: id })); } }}><Plus size={14} />Group</Btn></div>
    <Card title="People"><div className="flex flex-wrap gap-2">{g.people.map((p) => <span key={p} className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold">{p}<button type="button" aria-label={`Remove ${p}`} onClick={() => upd((x) => ({ ...x, people: x.people.filter((y) => y !== p) }))} className="text-emerald-300 hover:text-rose-600">×</button></span>)}<input value={person} onChange={(ev) => setPerson(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter" && person.trim() && !g.people.includes(person.trim())) { upd((x) => ({ ...x, people: [...x.people, person.trim()] })); setPerson(""); } }} placeholder="+ Add (Enter)" className="h-8 rounded-full border border-dashed border-slate-300 px-3 text-sm" /></div></Card>
    <Card title={`Expenses · ${money(total)}`} right={<Btn kind="primary" color="#16a34a" disabled={g.people.length < 2} onClick={() => setE({ id: uid(), what: "", amount: 0, paidBy: g.people[0], split: [] })}><Plus size={14} />Expense</Btn>}>{g.expenses.length ? <ul className="divide-y divide-slate-100 text-sm">{g.expenses.map((x) => <li key={x.id} className="flex items-center justify-between py-2"><button type="button" onClick={() => setE(x)} className="text-left"><b>{x.what}</b><span className="block text-xs text-slate-500">{x.paidBy} paid · split {x.split.length ? x.split.join(", ") : "everyone"}</span></button><span className="font-bold">{money(x.amount)}</span></li>)}</ul> : <Empty>Add who paid for what.</Empty>}</Card>
    <Card title="Settle up" right={<Btn onClick={() => void navigator.clipboard?.writeText(summary)}><Copy size={14} />Copy</Btn>}>{plan.length ? <ul className="space-y-2">{plan.map((p, i) => <li key={i} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm"><b>{p.from}</b> pays <b>{p.to}</b><span className="ml-auto text-lg font-black text-emerald-700">{money(p.amount)}</span></li>)}</ul> : <p className="text-sm font-bold text-emerald-700">Everyone is even. ✨</p>}</Card>
    {e && <Modal title="Expense" onClose={() => setE(null)} footer={<>{g.expenses.some((x) => x.id === e.id) && <Btn kind="danger" onClick={() => { upd((x) => ({ ...x, expenses: x.expenses.filter((y) => y.id !== e.id) })); setE(null); }}>Delete</Btn>}<Btn kind="primary" color="#16a34a" disabled={!e.what.trim() || !e.amount} onClick={() => { upd((x) => ({ ...x, expenses: x.expenses.some((y) => y.id === e.id) ? x.expenses.map((y) => (y.id === e.id ? e : y)) : [...x.expenses, e] })); setE(null); }}>Save</Btn></>}>
      <div className="space-y-3"><Field label="What for"><input value={e.what} onChange={(ev) => setE({ ...e, what: ev.target.value })} placeholder="Dinner, gas, tickets…" className={inputCls} /></Field><Field label="Amount"><NumIn value={e.amount || ""} onChange={(n) => setE({ ...e, amount: Number(n) || 0 })} /></Field><Field label="Paid by"><select value={e.paidBy} onChange={(ev) => setE({ ...e, paidBy: ev.target.value })} className={inputCls}>{g.people.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <div><p className="mb-1 text-xs font-bold text-slate-600">Split between (none ticked = everyone)</p><div className="flex flex-wrap gap-2">{g.people.map((p) => <label key={p} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={e.split.includes(p)} onChange={(ev) => setE({ ...e, split: ev.target.checked ? [...e.split, p] : e.split.filter((x) => x !== p) })} />{p}</label>)}</div></div></div>
    </Modal>}
  </div>;
}

export const WORK: Record<string, ComponentType> = {
  pomodoro: Pomodoro, kanban: Kanban, "time-tracker": TimeTracker, habits: Habits, goals: Goals, matrix: Matrix, invoice: Invoices,
  "mind-map": MindMap, decision: Decision, countdowns: Countdowns, "world-clock": WorldClock, passwords: Passwords, qr: QrMaker, split: Split,
};
