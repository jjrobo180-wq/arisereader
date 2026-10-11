// Routines (a Plugin Store add-on): morning, bedtime or any checklist that starts fresh each day.
// Great for kids getting ready for school.
import { useState } from "react";
import { Check, ListChecks, Plus, RotateCcw, Trash2, X } from "lucide-react";
import type { Routine } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, type SectionProps } from "./ui";

const TEMPLATES: { name: string; emoji: string; steps: string[] }[] = [
  { name: "Morning", emoji: "🌅", steps: ["Make the bed", "Brush teeth", "Get dressed", "Eat breakfast", "Pack backpack", "Shoes on"] },
  { name: "Bedtime", emoji: "🌙", steps: ["Pick up toys", "Bath or shower", "Pajamas on", "Brush teeth", "Read a story", "Lights out"] },
  { name: "After school", emoji: "🎒", steps: ["Unpack backpack", "Snack", "Homework", "Practice instrument", "Free time"] },
  { name: "Leaving the house", emoji: "🔑", steps: ["Keys", "Wallet", "Phone", "Lights off", "Lock the door"] },
];

export default function Routines({ family, setFamily, today, makeId, say }: SectionProps) {
  const [newStep, setNewStep] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const set = (update: (r: Routine[]) => Routine[]) => setFamily((f) => ({ ...f, routines: update(f.routines) }));
  const doneToday = (r: Routine) => (r.doneDate === today ? r.doneSteps : []);
  const toggle = (r: Routine, stepId: string) => {
    const cur = doneToday(r), next = cur.includes(stepId) ? cur.filter((x) => x !== stepId) : [...cur, stepId];
    set((all) => all.map((x) => (x.id === r.id ? { ...x, doneDate: today, doneSteps: next } : x)));
    if (!cur.includes(stepId) && next.length === r.steps.length && r.steps.length > 0) say(`${r.emoji} ${r.name} routine done! Great job!`);
  };
  const create = (t?: (typeof TEMPLATES)[number]) => {
    const n = (t?.name ?? name).trim();
    if (!n) return;
    set((all) => [...all, { id: makeId(), name: n, emoji: t?.emoji ?? "✅", steps: (t?.steps ?? []).map((text) => ({ id: makeId(), text })), doneDate: "", doneSteps: [] }]);
    setName("");
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Routines" title="Same steps, every day" blurb="Checklists that start fresh each morning. Perfect for getting kids out the door, or yourself." />
    {family.routines.length ? <div className="grid gap-4 lg:grid-cols-2">{family.routines.map((r) => { const done = doneToday(r); const pct = r.steps.length ? (done.length / r.steps.length) * 100 : 0; return <Panel key={r.id} title={`${r.emoji} ${r.name}`} right={<span className="flex gap-1">{done.length > 0 && <button type="button" onClick={() => set((all) => all.map((x) => (x.id === r.id ? { ...x, doneSteps: [] } : x)))} className={plain + " px-2"} aria-label="Start over"><RotateCcw size={14} /></button>}<button type="button" onClick={() => { if (window.confirm(`Delete the ${r.name} routine?`)) set((all) => all.filter((x) => x.id !== r.id)); }} className={danger + " px-2"} aria-label={`Delete ${r.name}`}><Trash2 size={14} /></button></span>}>
      <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
      <ul className="space-y-1.5">{r.steps.map((s) => { const on = done.includes(s.id); return <li key={s.id} className="flex items-center gap-2">
        <button type="button" onClick={() => toggle(r, s.id)} aria-pressed={on} className={`flex min-h-12 flex-1 items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold transition ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check size={15} /></span><span className={on ? "line-through" : ""}>{s.text}</span></button>
        <button type="button" onClick={() => set((all) => all.map((x) => (x.id === r.id ? { ...x, steps: x.steps.filter((y) => y.id !== s.id) } : x)))} className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500" aria-label={`Remove ${s.text}`}><X size={14} /></button>
      </li>; })}</ul>
      <form onSubmit={(e) => { e.preventDefault(); const t = (newStep[r.id] || "").trim(); if (!t) return; set((all) => all.map((x) => (x.id === r.id ? { ...x, steps: [...x.steps, { id: makeId(), text: t.slice(0, 100) }] } : x))); setNewStep((n) => ({ ...n, [r.id]: "" })); }} className="mt-3 flex gap-2">
        <input value={newStep[r.id] || ""} onChange={(e) => setNewStep((n) => ({ ...n, [r.id]: e.target.value }))} maxLength={100} placeholder="Add a step" className={inputClass} aria-label={`Add a step to ${r.name}`} /><button type="submit" className={plain} aria-label="Add step"><Plus size={16} /></button>
      </form>
    </Panel>; })}</div> : <Panel><Empty icon={<ListChecks />} title="No routines yet.">Start from one below, or make your own.</Empty></Panel>}
    <Panel title="New routine">
      <form onSubmit={(e) => { e.preventDefault(); create(); }} className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Routine name" className={inputClass} aria-label="Routine name" /><button type="submit" className={primary} disabled={!name.trim()}>Create</button></form>
      <div className="mt-3 flex flex-wrap gap-1.5">{TEMPLATES.map((t) => <button key={t.name} type="button" onClick={() => create(t)} className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700">+ {t.emoji} {t.name}</button>)}</div>
    </Panel>
  </div>;
}
