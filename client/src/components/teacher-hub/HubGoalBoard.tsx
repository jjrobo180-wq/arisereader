// The Goals board in WorkHub: LifeHub's goal cards (steps or a number, a progress bar, a due date),
// with students attached, a filter by student and kind, and notes on every goal.
import { useMemo, useState, type FormEvent } from "react";
import { Check, CheckCircle2, MessageSquarePlus, Minus, Pencil, Plus, Target, Trash2, Trophy, X } from "lucide-react";
import type { Workspace } from "@shared/teacherHub";
import { GOAL_IDEAS, GOAL_KINDS, GOAL_KIND_INFO, boardGoals, filterGoals, goalProgress, setBoardGoals, type BoardGoal, type GoalKind } from "@shared/hubGoalBoard";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { HubModal } from "./HubModal";

const fmtNum = (n: number, unit: string) => (unit === "$" ? `$${Math.round(n).toLocaleString()}` : `${Math.round(n * 10) / 10}${unit ? ` ${unit}` : ""}`);
const daysLeft = (today: string, due: string) => Math.round((Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
const chip = (on: boolean) => `min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${on ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-600 ring-slate-200"}`;

export default function HubGoalBoard({ workspace, setWorkspace, makeId, today }: { workspace: Workspace; setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>; makeId: () => string; today: string }) {
  const goals = boardGoals(workspace);
  const students = workspace.students.map((s) => s.name);
  const [who, setWho] = useSavedChoice<string>("hub-goals-student", "");
  const [kind, setKind] = useSavedChoice<GoalKind | "">("hub-goals-kind", "", ["", ...GOAL_KINDS]);
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<BoardGoal | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const student = who && students.includes(who) ? who : "";
  const open = useMemo(() => filterGoals(goals, { student, kind, done: false }), [goals, student, kind]);
  const reached = useMemo(() => filterGoals(goals, { student, kind, done: true }), [goals, student, kind]);
  const set = (fn: (all: BoardGoal[]) => BoardGoal[]) => setWorkspace((w) => setBoardGoals(w, fn));
  const update = (id: string, fn: (g: BoardGoal) => BoardGoal) => set((all) => all.map((g) => (g.id === id ? fn(g) : g)));
  const blank = (idea: Partial<BoardGoal> = {}): BoardGoal => ({ id: makeId(), title: "", why: "", kind: "academic", students: student ? [student] : [], due: "", track: "steps", target: 0, current: 0, unit: "", done: false, doneAt: "", createdAt: new Date().toISOString(), notes: [], ...idea, steps: (idea.steps || []).map((m) => ({ ...m, id: makeId() })) });

  const card = (g: BoardGoal) => {
    const info = GOAL_KIND_INFO[g.kind];
    const p = goalProgress(g);
    const left = g.due ? daysLeft(today, g.due) : null;
    const notes = [...g.notes].reverse();
    return (
      <section key={g.id} className="flex flex-col rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 text-slate-900 shadow-[0_8px_28px_#17152b08]" data-testid="board-goal">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: info.color + "22" }} aria-hidden>{info.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: info.color }}>{info.label}{left !== null && !g.done ? ` · ${left < 0 ? `${-left} days past due` : left === 0 ? "due today" : `${left} days left`}` : ""}</p>
            <h3 className={`mt-0.5 text-base font-black leading-snug ${g.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{g.title}</h3>
            {g.why && <p className="mt-1 text-xs text-slate-500">{g.why}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {g.students.length ? g.students.map((n) => <button key={n} type="button" onClick={() => setWho(n)} className="rounded-full bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-600/20">{n}</button>)
                : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{g.kind === "teacher" ? "My goal" : "Whole class"}</span>}
            </div>
          </div>
          <button type="button" onClick={() => setEditing({ ...g, steps: g.steps.map((m) => ({ ...m })) })} className="rounded-lg p-1.5 text-slate-400 hover:text-violet-600" aria-label={`Edit ${g.title}`}><Pencil className="h-4 w-4" /></button>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-bold"><span className="text-slate-600">{g.track === "number" ? `${fmtNum(g.current, g.unit)} of ${fmtNum(g.target, g.unit)}` : `${g.steps.filter((m) => m.done).length} of ${g.steps.length} steps`}</span><span style={{ color: info.color }}>{Math.round(p * 100)}%</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${p * 100}%`, background: info.color }} /></div>
        </div>
        {!g.done && g.track === "number" && (
          <form onSubmit={(e) => { e.preventDefault(); const el = e.currentTarget.elements.namedItem("add") as HTMLInputElement; const v = Number(el.value); if (!Number.isFinite(v) || !v) return; update(g.id, (x) => ({ ...x, current: Math.round((x.current + v) * 100) / 100 })); el.value = ""; }} className="mt-3 flex gap-2">
            <button type="button" onClick={() => update(g.id, (x) => ({ ...x, current: Math.max(0, x.current - 1) }))} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-2.5 text-slate-600" aria-label="Minus one"><Minus className="h-4 w-4" /></button>
            <button type="button" onClick={() => update(g.id, (x) => ({ ...x, current: x.current + 1 }))} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-2.5 text-slate-600" aria-label="Plus one"><Plus className="h-4 w-4" /></button>
            <input name="add" type="number" step="any" placeholder={`Add ${g.unit || "amount"}`} aria-label="Add progress" className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900" />
            <button type="submit" className="min-h-10 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700">Add</button>
          </form>
        )}
        {g.track === "steps" && g.steps.length > 0 && (
          <ul className="mt-3 space-y-1">{g.steps.map((m) => (
            <li key={m.id}><button type="button" disabled={g.done} onClick={() => update(g.id, (x) => ({ ...x, steps: x.steps.map((y) => (y.id === m.id ? { ...y, done: !y.done } : y)) }))} aria-pressed={m.done} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-1 text-left text-sm hover:bg-slate-50">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${m.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check className="h-3 w-3" /></span>
              <span className={m.done ? "text-slate-400 line-through" : "font-medium text-slate-800"}>{m.title}</span>
            </button></li>
          ))}</ul>
        )}
        {/* Notes on the goal: what was tried, what worked, a parent's comment. */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          {notes.slice(0, 3).map((n) => (
            <div key={n.id} className="group mb-1.5 flex items-start gap-2 text-xs">
              <span className="shrink-0 text-slate-400">{n.date.slice(5).replace("-", "/")}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-slate-700">{n.student && <b className="text-teal-800">{n.student}: </b>}{n.text}</span>
              <button type="button" onClick={() => update(g.id, (x) => ({ ...x, notes: x.notes.filter((y) => y.id !== n.id) }))} aria-label="Delete note" className="shrink-0 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {notes.length > 3 && <p className="mb-1 text-[11px] text-slate-400">+{notes.length - 3} earlier notes (open Edit to see them all)</p>}
          {noteFor === g.id ? (
            <form className="mt-1 space-y-1.5" onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const text = (f.elements.namedItem("text") as HTMLTextAreaElement).value.trim();
              const st = (f.elements.namedItem("st") as HTMLSelectElement | null)?.value || "";
              if (!text) return;
              update(g.id, (x) => ({ ...x, notes: [...x.notes, { id: makeId(), date: today, text, ...(st ? { student: st } : {}) }] }));
              setNoteFor(null);
            }}>
              <textarea name="text" autoFocus rows={2} placeholder="What happened, what worked, what's next…" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
              <div className="flex flex-wrap gap-2">
                {g.students.length > 1 && <select name="st" className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900" aria-label="About"><option value="">Everyone on this goal</option>{g.students.map((n) => <option key={n}>{n}</option>)}</select>}
                <button type="submit" className="min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">Save note</button>
                <button type="button" onClick={() => setNoteFor(null)} className="min-h-9 rounded-lg px-2 text-xs text-slate-500">Cancel</button>
              </div>
            </form>
          ) : <button type="button" onClick={() => setNoteFor(g.id)} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900"><MessageSquarePlus className="h-3.5 w-3.5" /> Add a note</button>}
        </div>
        <div className="mt-auto pt-3">
          {g.done ? <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Reached {g.doneAt ? new Date(g.doneAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}</p>
            : p >= 1 ? <button type="button" onClick={() => update(g.id, (x) => ({ ...x, done: true, doneAt: new Date().toISOString() }))} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#6e5ae0] text-sm font-bold text-white"><Trophy className="h-4 w-4" /> Mark goal reached</button>
            : <button type="button" onClick={() => update(g.id, (x) => ({ ...x, done: true, doneAt: new Date().toISOString() }))} className="text-xs font-bold text-slate-400 hover:text-emerald-600">Mark reached</button>}
        </div>
      </section>
    );
  };

  function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || !editing.title.trim()) return;
    const clean = { ...editing, title: editing.title.trim().slice(0, 160), steps: editing.steps.filter((m) => m.title.trim()) };
    set((all) => (all.some((g) => g.id === clean.id) ? all.map((g) => (g.id === clean.id ? clean : g)) : [...all, clean]));
    setEditing(null);
  }
  const input = "w-full min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900";

  return (
    <div className="space-y-5" data-testid="goal-board">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Goals board</h2>
          <p className="text-sm text-slate-500">Goals for a student, a group or the whole class. Break them into steps or track a number, and keep notes as you go.</p>
        </div>
        <button type="button" onClick={() => setEditing(blank())} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6e5ae0] px-5 text-sm font-bold text-white hover:bg-[#5948c8]"><Plus className="h-4 w-4" /> New goal</button>
      </div>
      {goals.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {students.length > 0 && <select value={student} onChange={(e) => setWho(e.target.value)} aria-label="Goals for" className="min-h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700" data-testid="goal-student-filter"><option value="">Every student</option>{students.map((n) => <option key={n} value={n}>{n}</option>)}</select>}
          <button type="button" onClick={() => setKind("")} aria-pressed={!kind} className={chip(!kind)}>All</button>
          {GOAL_KINDS.filter((k) => goals.some((g) => g.kind === k)).map((k) => <button key={k} type="button" onClick={() => setKind(kind === k ? "" : k)} aria-pressed={kind === k} className={chip(kind === k)}>{GOAL_KIND_INFO[k].emoji} {GOAL_KIND_INFO[k].label}</button>)}
        </div>
      )}
      {open.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">{open.map(card)}</div> : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
          <span className="rounded-2xl bg-violet-50 p-4 text-violet-600"><Target className="h-6 w-6" /></span>
          <p className="mt-3 text-base font-extrabold text-slate-900">{goals.length ? (student ? `No open goals for ${student}` : "No open goals here") : "Set your first goal"}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">{GOAL_IDEAS.map((i) => <button key={i.title} type="button" onClick={() => setEditing(blank(i))} className="min-h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200">{GOAL_KIND_INFO[i.kind as GoalKind].emoji} {i.title}</button>)}</div>
        </div>
      )}
      {reached.length > 0 && <div><button type="button" onClick={() => setShowDone(!showDone)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><Trophy className="h-4 w-4" /> {showDone ? "Hide" : "Show"} reached goals ({reached.length})</button>
        {showDone && <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">{reached.map(card)}</div>}</div>}

      {editing && (
        <HubModal title={goals.some((g) => g.id === editing.id) ? "Edit goal" : "New goal"} onClose={() => setEditing(null)} size="lg" footer={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={(e) => save(e as any)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#6e5ae0] px-5 text-sm font-bold text-white"><Check className="h-4 w-4" /> Save goal</button>
            <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button>
            {goals.some((g) => g.id === editing.id) && <button type="button" onClick={() => { if (confirm(`Delete the goal "${editing.title}"?`)) { set((all) => all.filter((g) => g.id !== editing.id)); setEditing(null); } }} className="inline-flex min-h-11 items-center rounded-xl border border-rose-100 bg-rose-50 px-3 text-rose-600" aria-label="Delete goal"><Trash2 className="h-4 w-4" /></button>}
          </div>
        }>
          <form onSubmit={save} className="space-y-4 text-slate-900">
            <label className="block text-xs font-bold text-slate-600">Goal<input autoFocus required maxLength={160} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={input + " mt-1.5"} placeholder="Read 20 minutes every night" /></label>
            <label className="block text-xs font-bold text-slate-600">Why it matters (optional)<input maxLength={600} value={editing.why} onChange={(e) => setEditing({ ...editing, why: e.target.value })} className={input + " mt-1.5"} placeholder="Builds fluency for the spring reading test" /></label>
            <div><p className="mb-1.5 text-xs font-bold text-slate-600">Kind</p><div className="flex flex-wrap gap-1.5">{GOAL_KINDS.map((k) => <button type="button" key={k} onClick={() => setEditing({ ...editing, kind: k })} aria-pressed={editing.kind === k} className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${editing.kind === k ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>{GOAL_KIND_INFO[k].emoji} {GOAL_KIND_INFO[k].label}</button>)}</div></div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-600">Students on this goal <span className="font-normal text-slate-400">(none = whole class or your own goal)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {students.map((n) => { const on = editing.students.includes(n); return <button key={n} type="button" aria-pressed={on} onClick={() => setEditing({ ...editing, students: on ? editing.students.filter((x) => x !== n) : [...editing.students, n] })} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{n}</button>; })}
                {!students.length && <span className="text-xs text-slate-500">Add students to your caseload to attach them to goals.</span>}
              </div>
            </div>
            <label className="block text-xs font-bold text-slate-600 sm:w-1/2">Finish by (optional)<input type="date" value={editing.due} onChange={(e) => setEditing({ ...editing, due: e.target.value })} className={input + " mt-1.5"} /></label>
            <div><p className="mb-1.5 text-xs font-bold text-slate-600">Track it by</p>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">{([["steps", "Steps to check off"], ["number", "A number"]] as const).map(([k, l]) => <button type="button" key={k} onClick={() => setEditing({ ...editing, track: k })} aria-pressed={editing.track === k} className={`min-h-9 rounded-lg px-3 ${editing.track === k ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{l}</button>)}</div></div>
            {editing.track === "number" ? (
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs font-bold text-slate-600">Now<input type="number" step="any" value={editing.current || ""} onChange={(e) => setEditing({ ...editing, current: Number(e.target.value) || 0 })} className={input + " mt-1.5"} placeholder="0" /></label>
                <label className="text-xs font-bold text-slate-600">Target<input type="number" step="any" value={editing.target || ""} onChange={(e) => setEditing({ ...editing, target: Number(e.target.value) || 0 })} className={input + " mt-1.5"} placeholder="20" /></label>
                <label className="text-xs font-bold text-slate-600">Unit<input maxLength={24} value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className={input + " mt-1.5"} placeholder="books, %, days" /></label>
              </div>
            ) : (
              <div className="space-y-2">
                {editing.steps.map((m, i) => <div key={m.id} className="flex gap-2"><input value={m.title} maxLength={160} onChange={(e) => setEditing({ ...editing, steps: editing.steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder={`Step ${i + 1}`} className={input} /><button type="button" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_x, j) => j !== i) })} className="rounded-xl border border-slate-200 px-2.5 text-slate-500" aria-label={`Remove step ${i + 1}`}><X className="h-4 w-4" /></button></div>)}
                <button type="button" onClick={() => setEditing({ ...editing, steps: [...editing.steps, { id: makeId(), title: "", done: false }] })} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700"><Plus className="h-4 w-4" /> Add a step</button>
              </div>
            )}
            {editing.notes.length > 0 && (
              <div><p className="mb-1.5 text-xs font-bold text-slate-600">Notes ({editing.notes.length})</p>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl bg-slate-50 p-2.5 text-xs">{[...editing.notes].reverse().map((n) => <li key={n.id} className="flex gap-2"><span className="shrink-0 text-slate-400">{n.date}</span><span className="text-slate-700">{n.student && <b>{n.student}: </b>}{n.text}</span></li>)}</ul></div>
            )}
          </form>
        </HubModal>
      )}
    </div>
  );
}
