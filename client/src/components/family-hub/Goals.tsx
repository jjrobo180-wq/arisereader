// Goals: personal and family goals, tracked by steps (a checklist) or by a number (save $1,000, read 12 books).
import { useState, type FormEvent } from "react";
import { Check, CheckCircle2, Minus, Pencil, Plus, Target, Trash2, Trophy, X } from "lucide-react";
import { daysBetween, type Goal, type GoalCategory } from "@shared/familyHub";
import { Avatar, Bar, Empty, Label, MemberPicker, Modal, PageHead, Panel, confirmed, danger, inputClass, memberOf, plain, primary, shortDate, soft, type SectionProps } from "./ui";

const CATS: Record<GoalCategory, { label: string; emoji: string; color: string }> = {
  personal: { label: "Personal", emoji: "🌱", color: "#7566e8" }, health: { label: "Health", emoji: "💪", color: "#36b6a5" },
  money: { label: "Money", emoji: "💰", color: "#e5b04f" }, family: { label: "Family", emoji: "🏡", color: "#db77ac" },
  career: { label: "Career", emoji: "💼", color: "#619ee6" }, learning: { label: "Learning", emoji: "📚", color: "#f59e72" }, home: { label: "Home", emoji: "🛠️", color: "#5fb35b" },
};
const IDEAS: Partial<Goal>[] = [
  { title: "Save for an emergency fund", category: "money", kind: "number", target: 1000, current: 0, unit: "$" },
  { title: "Read 12 books this year", category: "learning", kind: "number", target: 12, current: 0, unit: "books" },
  { title: "Run a 5K", category: "health", kind: "steps", milestones: ["Walk 30 min 3x a week", "Run 1 mile without stopping", "Run 2 miles", "Sign up for a race", "Run the 5K"].map((t, i) => ({ id: `m${i}`, title: t, done: false })) },
  { title: "Family game night every week", category: "family", kind: "number", target: 12, current: 0, unit: "nights" },
  { title: "Clean out the garage", category: "home", kind: "steps", milestones: ["Sort into keep / donate / toss", "Drop off donations", "Put up shelves", "Organize what's left"].map((t, i) => ({ id: `m${i}`, title: t, done: false })) },
];
export const goalProgress = (g: Goal) => g.done ? 1 : g.kind === "steps" ? (g.milestones.length ? g.milestones.filter((m) => m.done).length / g.milestones.length : 0) : g.target > 0 ? Math.max(0, Math.min(1, g.current / g.target)) : 0;
const fmtNum = (n: number, unit: string) => unit === "$" ? `$${Math.round(n).toLocaleString()}` : `${Math.round(n * 10) / 10 === Math.round(n) ? Math.round(n).toLocaleString() : Math.round(n * 10) / 10}${unit ? ` ${unit}` : ""}`;

export default function Goals({ family, setFamily, today, makeId, say }: SectionProps) {
  const [editing, setEditing] = useState<Goal | null>(null);
  const [filter, setFilter] = useState<GoalCategory | "">("");
  const [showDone, setShowDone] = useState(false);
  const active = family.goals.filter((g) => !g.done && (!filter || g.category === filter));
  const done = family.goals.filter((g) => g.done);
  const update = (id: string, fn: (g: Goal) => Goal) => setFamily((f) => ({ ...f, goals: f.goals.map((g) => (g.id === id ? fn(g) : g)) }));
  const finish = (g: Goal) => { update(g.id, (x) => ({ ...x, done: true, doneAt: new Date().toISOString(), current: x.kind === "number" ? Math.max(x.current, x.target) : x.current })); say(`🎉 Goal reached: ${g.title}`); };
  const blank = (idea: Partial<Goal> = {}): Goal => ({ id: makeId(), title: "", why: "", category: "personal", memberId: "", due: "", kind: "steps", target: 0, current: 0, unit: "", done: false, createdAt: new Date().toISOString(), doneAt: "", ...idea, milestones: (idea.milestones || []).map((m) => ({ ...m, id: makeId() })) });
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.title.trim()) return;
    const clean = { ...editing, title: editing.title.trim().slice(0, 120), milestones: editing.milestones.filter((m) => m.title.trim()) };
    setFamily((f) => ({ ...f, goals: f.goals.some((g) => g.id === clean.id) ? f.goals.map((g) => (g.id === clean.id ? clean : g)) : [...f.goals, clean] }));
    setEditing(null);
    say("Goal saved");
  };

  const card = (g: Goal) => {
    const c = CATS[g.category];
    const p = goalProgress(g);
    const owner = memberOf(family, g.memberId);
    const left = g.due ? daysBetween(today, g.due) : null;
    return <section key={g.id} className="flex flex-col rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: c.color + "22" }} aria-hidden="true">{c.emoji}</span>
        <div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-wider" style={{ color: c.color }}>{c.label}{left !== null && !g.done ? ` · ${left < 0 ? `${-left} days past due` : left === 0 ? "due today" : `${left} days left`}` : ""}</p>
          <h3 className={`mt-0.5 text-base font-black leading-snug ${g.done ? "text-slate-400 line-through" : ""}`}>{g.title}</h3>
          {g.why && <p className="mt-1 text-xs text-slate-500">{g.why}</p>}</div>
        {owner && <Avatar member={owner} size="sm" />}
        <button onClick={() => setEditing({ ...g, milestones: g.milestones.map((m) => ({ ...m })) })} className="rounded-lg p-1.5 text-slate-300 hover:text-violet-600" aria-label={`Edit ${g.title}`}><Pencil size={15} /></button>
      </div>
      <div className="mt-4"><div className="mb-1.5 flex justify-between text-xs font-bold"><span className="text-slate-600">{g.kind === "number" ? `${fmtNum(g.current, g.unit)} of ${fmtNum(g.target, g.unit)}` : `${g.milestones.filter((m) => m.done).length} of ${g.milestones.length} steps`}</span><span style={{ color: c.color }}>{Math.round(p * 100)}%</span></div><Bar value={p} max={1} color={c.color} /></div>
      {!g.done && g.kind === "number" && <form onSubmit={(e) => { e.preventDefault(); const v = Number((e.currentTarget.elements.namedItem("add") as HTMLInputElement).value); if (!Number.isFinite(v) || !v) return; update(g.id, (x) => ({ ...x, current: Math.round((x.current + v) * 100) / 100 })); (e.currentTarget.elements.namedItem("add") as HTMLInputElement).value = ""; if (g.current + v >= g.target && g.target > 0) say(`You hit your target for “${g.title}”! Mark it done when you're ready.`); }} className="mt-3 flex gap-2">
        <button type="button" onClick={() => update(g.id, (x) => ({ ...x, current: Math.max(0, x.current - 1) }))} className={plain} aria-label="Minus one"><Minus size={15} /></button>
        <button type="button" onClick={() => update(g.id, (x) => ({ ...x, current: x.current + 1 }))} className={plain} aria-label="Plus one"><Plus size={15} /></button>
        <input name="add" type="number" step="any" placeholder={g.unit === "$" ? "Add $" : `Add ${g.unit || "amount"}`} aria-label="Add progress" className={inputClass + " min-h-10 min-w-0"} />
        <button type="submit" className={soft}>Add</button>
      </form>}
      {g.kind === "steps" && g.milestones.length > 0 && <ul className="mt-3 space-y-1">{g.milestones.map((m) => <li key={m.id}>
        <button disabled={g.done} onClick={() => update(g.id, (x) => ({ ...x, milestones: x.milestones.map((y) => (y.id === m.id ? { ...y, done: !y.done } : y)) }))} aria-pressed={m.done} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-1 text-left text-sm hover:bg-slate-50">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${m.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check size={13} /></span>
          <span className={m.done ? "text-slate-400 line-through" : "font-medium"}>{m.title}</span>
        </button></li>)}</ul>}
      <div className="mt-auto pt-4">{g.done ? <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600"><CheckCircle2 size={15} /> Done {g.doneAt ? shortDate(g.doneAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" }) : ""}</p>
        : p >= 1 ? <button onClick={() => finish(g)} className={primary + " w-full"}><Trophy size={16} /> Mark goal done</button>
        : <button onClick={() => finish(g)} className="text-xs font-bold text-slate-400 hover:text-emerald-600">Mark done</button>}</div>
    </section>;
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Goals" title="Goals" blurb="Big or small, yours or the whole family's. Break them into steps or track a number, and watch the bar fill up."
      action={<button onClick={() => setEditing(blank())} className={primary + " min-h-11 px-5"}><Plus size={18} /> New goal</button>} />
    {family.goals.length > 0 && <div className="flex flex-wrap gap-1.5">
      <button onClick={() => setFilter("")} aria-pressed={!filter} className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${!filter ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-500 ring-slate-200"}`}>All</button>
      {(Object.keys(CATS) as GoalCategory[]).filter((k) => family.goals.some((g) => g.category === k)).map((k) => <button key={k} onClick={() => setFilter(filter === k ? "" : k)} aria-pressed={filter === k} className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${filter === k ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-500 ring-slate-200"}`}>{CATS[k].emoji} {CATS[k].label}</button>)}
    </div>}
    {active.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{active.map(card)}</div>
      : <Panel><Empty icon={<Target size={26} />} title={family.goals.length ? "No open goals here" : "Set your first goal"} action={<div className="flex flex-wrap justify-center gap-2">{IDEAS.map((i) => <button key={i.title} onClick={() => setEditing(blank(i))} className={soft + " min-h-9 text-xs"}>{CATS[i.category as GoalCategory].emoji} {i.title}</button>)}</div>}>Start with one of these or tap “New goal”.</Empty></Panel>}
    {done.length > 0 && <div><button onClick={() => setShowDone(!showDone)} className={plain}><Trophy size={15} /> {showDone ? "Hide" : "Show"} reached goals ({done.length})</button>
      {showDone && <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{done.map(card)}</div>}</div>}

    {editing && <Modal title={family.goals.some((g) => g.id === editing.id) ? "Edit goal" : "New goal"} onClose={() => setEditing(null)} wide>
      <form onSubmit={save} className="space-y-4">
        <Label text="Goal"><input autoFocus required maxLength={120} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputClass} placeholder="Pay off the credit card" /></Label>
        <Label text="Why it matters (optional)"><input maxLength={500} value={editing.why} onChange={(e) => setEditing({ ...editing, why: e.target.value })} className={inputClass} placeholder="So we can take a real vacation next summer" /></Label>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Type</p><div className="flex flex-wrap gap-1.5">{(Object.keys(CATS) as GoalCategory[]).map((k) => <button type="button" key={k} onClick={() => setEditing({ ...editing, category: k })} aria-pressed={editing.category === k} className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${editing.category === k ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>{CATS[k].emoji} {CATS[k].label}</button>)}</div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="mb-1.5 text-xs font-bold text-slate-600">Whose goal</p><MemberPicker members={family.members} value={editing.memberId ? [editing.memberId] : []} onChange={(ids) => setEditing({ ...editing, memberId: ids[0] || "" })} allowNone noneLabel="Mine / everyone" /></div>
          <Label text="Finish by (optional)"><input type="date" value={editing.due} onChange={(e) => setEditing({ ...editing, due: e.target.value })} className={inputClass} /></Label>
        </div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Track it by</p>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">{([["steps", "Steps to check off"], ["number", "A number"]] as const).map(([k, l]) => <button type="button" key={k} onClick={() => setEditing({ ...editing, kind: k })} aria-pressed={editing.kind === k} className={`min-h-9 rounded-lg px-3 ${editing.kind === k ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{l}</button>)}</div></div>
        {editing.kind === "number" ? <div className="grid grid-cols-3 gap-3">
          <Label text="Start / now"><input type="number" step="any" value={editing.current || ""} onChange={(e) => setEditing({ ...editing, current: Number(e.target.value) || 0 })} className={inputClass} placeholder="0" /></Label>
          <Label text="Target"><input type="number" step="any" required min={0.01} value={editing.target || ""} onChange={(e) => setEditing({ ...editing, target: Number(e.target.value) || 0 })} className={inputClass} placeholder="1000" /></Label>
          <Label text="Unit"><input maxLength={20} value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className={inputClass} placeholder="$, books, lb" list="goal-units" /></Label>
          <datalist id="goal-units">{["$", "books", "lb", "miles", "days", "times", "hours"].map((u) => <option key={u} value={u} />)}</datalist>
        </div> : <div className="space-y-2">{editing.milestones.map((m, i) => <div key={m.id} className="flex gap-2">
          <input value={m.title} maxLength={120} onChange={(e) => setEditing({ ...editing, milestones: editing.milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder={`Step ${i + 1}`} aria-label={`Step ${i + 1}`} className={inputClass} />
          <button type="button" onClick={() => setEditing({ ...editing, milestones: editing.milestones.filter((_, j) => j !== i) })} className={plain} aria-label={`Remove step ${i + 1}`}><X size={15} /></button></div>)}
          <button type="button" onClick={() => setEditing({ ...editing, milestones: [...editing.milestones, { id: makeId(), title: "", done: false }] })} className={soft}><Plus size={15} /> Add a step</button></div>}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={primary + " flex-1 px-5"}><Check size={17} /> Save goal</button>
          <button type="button" onClick={() => setEditing(null)} className={plain}>Cancel</button>
          {family.goals.some((g) => g.id === editing.id) && <button type="button" onClick={() => { if (confirmed(`Delete the goal "${editing.title}"?`)) { setFamily((f) => ({ ...f, goals: f.goals.filter((g) => g.id !== editing.id) })); setEditing(null); } }} className={danger} aria-label="Delete goal"><Trash2 size={17} /></button>}
        </div>
      </form>
    </Modal>}
  </div>;
}
