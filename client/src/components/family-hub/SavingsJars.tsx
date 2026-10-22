// Savings jars (a Plugin Store add-on): save toward things (a vacation, a new couch, the
// emergency fund) and watch each jar fill up.
import { useState, type FormEvent } from "react";
import { Minus, PiggyBank, Plus, Trash2 } from "lucide-react";
import { MEMBER_COLORS } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
const EMOJI = ["🏖️", "🚗", "🏠", "🎓", "🎁", "🛋️", "💍", "🆘", "✈️", "🎄"];

export default function SavingsJars({ family, setFamily, makeId, say }: SectionProps) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setFamily((f) => ({ ...f, jars: [...f.jars, { id: makeId(), name: name.trim(), emoji, color: MEMBER_COLORS[f.jars.length % MEMBER_COLORS.length], target: Math.max(0, Number(target) || 0), saved: 0 }] }));
    setName(""); setTarget("");
  };
  const change = (id: string, sign: 1 | -1) => {
    const n = Math.abs(Number(amounts[id]) || 0);
    if (!n) return;
    setFamily((f) => ({ ...f, jars: f.jars.map((j) => (j.id === id ? { ...j, saved: Math.round((j.saved + sign * n) * 100) / 100 } : j)) }));
    setAmounts((a) => ({ ...a, [id]: "" }));
    const jar = family.jars.find((j) => j.id === id);
    if (jar && sign > 0 && jar.target > 0 && jar.saved < jar.target && jar.saved + n >= jar.target) say(`🎉 You filled the ${jar.name} jar!`);
  };
  const total = family.jars.reduce((s, j) => s + j.saved, 0);

  return <div className="space-y-6">
    <PageHead eyebrow="Savings jars" title="Saving up" blurb="Give each goal its own jar. Add money as you save and watch it fill. This tracks your plan; it doesn't move real money." />
    {family.jars.length > 0 && <p className="text-sm font-bold text-slate-500">Saved across all jars: <span className="text-lg font-black text-emerald-700">{money(total)}</span></p>}
    {family.jars.length ? <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{family.jars.map((j) => { const pct = j.target > 0 ? Math.min(100, Math.max(0, (j.saved / j.target) * 100)) : 0; return <li key={j.id} className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08]">
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-b-2xl rounded-t-lg border-2 border-slate-200 bg-slate-50" aria-hidden>
          <div className="absolute inset-x-0 bottom-0 transition-all duration-700" style={{ height: `${pct}%`, background: j.color, opacity: 0.85 }} />
          <span className="absolute inset-0 flex items-center justify-center text-2xl">{j.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{j.name}</p>
          <p className="text-2xl font-black tracking-tight" style={{ color: j.color }}>{money(j.saved)}</p>
          {j.target > 0 && <p className="text-xs font-bold text-slate-500">of {money(j.target)} · {Math.round(pct)}%{j.saved >= j.target ? " 🎉" : ` · ${money(j.target - j.saved)} to go`}</p>}
        </div>
        <button type="button" onClick={() => { if (window.confirm(`Delete the ${j.name} jar?`)) setFamily((f) => ({ ...f, jars: f.jars.filter((x) => x.id !== j.id) })); }} className={danger + " px-2"} aria-label={`Delete ${j.name}`}><Trash2 size={14} /></button>
      </div>
      <div className="mt-4 flex gap-1.5">
        <input value={amounts[j.id] || ""} onChange={(e) => setAmounts((a) => ({ ...a, [j.id]: e.target.value }))} inputMode="decimal" placeholder="$ amount" className={inputClass} aria-label={`Amount for ${j.name}`} />
        <button type="button" onClick={() => change(j.id, 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-emerald-50 px-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100" aria-label="Add money"><Plus size={15} />Add</button>
        <button type="button" onClick={() => change(j.id, -1)} className="inline-flex min-h-11 items-center rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-500 hover:bg-slate-100" aria-label="Take money out"><Minus size={15} /></button>
      </div>
    </li>; })}</ul> : <Panel><Empty icon={<PiggyBank />} title="No jars yet.">Start one for something you're saving toward.</Empty></Panel>}
    <Panel title="New jar">
      <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="What are you saving for?" className={inputClass} aria-label="Jar name" />
        <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="Goal $" className={inputClass} aria-label="Goal amount" />
        <button type="submit" className={primary} disabled={!name.trim()}>Create</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">{EMOJI.map((m) => <button key={m} type="button" onClick={() => setEmoji(m)} aria-pressed={emoji === m} className={`h-10 w-10 rounded-xl text-xl ${emoji === m ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"}`}>{m}</button>)}</div>
    </Panel>
  </div>;
}
