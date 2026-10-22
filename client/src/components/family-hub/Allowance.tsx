// Allowance (a Plugin Store add-on): each kid's balance, money in (allowance, chores, gifts)
// and money out (spending), so they can see their savings grow.
import { useState } from "react";
import { Coins, Minus, Plus, Trash2 } from "lucide-react";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, type SectionProps } from "./ui";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function Allowance({ family, setFamily, today, makeId, say }: SectionProps) {
  const kids = [...new Set([...family.members.filter((m) => m.kind === "kid").map((m) => m.name), ...family.allowance.map((a) => a.who)])];
  const [newKid, setNewKid] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const all = [...new Set([...kids, ...extra])];
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const add = (who: string, sign: 1 | -1) => {
    const n = Math.abs(Number(amount[who]) || 0);
    if (!n) return;
    setFamily((f) => ({ ...f, allowance: [...f.allowance, { id: makeId(), who, amount: sign * n, note: (note[who] || "").trim() || (sign > 0 ? "Allowance" : "Spent"), date: today }] }));
    setAmount((a) => ({ ...a, [who]: "" })); setNote((x) => ({ ...x, [who]: "" }));
    say(sign > 0 ? `${money(n)} added for ${who}.` : `${money(n)} spent by ${who}.`);
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Allowance" title="Kids' money" blurb="Track each kid's allowance, chore money and spending. A simple way to learn about saving." />
    {all.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{all.map((k) => { const rows = family.allowance.filter((a) => a.who === k); const bal = rows.reduce((s, a) => s + a.amount, 0); return <Panel key={k} title={k}>
      <p className={`text-4xl font-black tracking-tight ${bal < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(bal)}</p>
      <div className="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
        <input value={amount[k] || ""} onChange={(e) => setAmount((a) => ({ ...a, [k]: e.target.value }))} inputMode="decimal" placeholder="$" className={inputClass} aria-label={`Amount for ${k}`} />
        <input value={note[k] || ""} onChange={(e) => setNote((x) => ({ ...x, [k]: e.target.value }))} maxLength={120} placeholder="For what (optional)" className={inputClass} aria-label={`Note for ${k}`} />
      </div>
      <div className="mt-2 flex gap-2"><button type="button" onClick={() => add(k, 1)} className={primary + " flex-1"}><Plus size={15} />Money in</button><button type="button" onClick={() => add(k, -1)} className={plain + " flex-1"}><Minus size={15} />Spent</button></div>
      {rows.length > 0 && <ul className="mt-4 divide-y divide-slate-100">{[...rows].reverse().slice(0, 8).map((a) => <li key={a.id} className="flex items-center gap-2 py-1.5 text-sm"><span className="w-16 text-xs text-slate-400">{a.date ? new Date(`${a.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span><span className="min-w-0 flex-1 truncate">{a.note}</span><span className={`font-bold ${a.amount < 0 ? "text-rose-600" : "text-emerald-700"}`}>{a.amount < 0 ? "−" : "+"}{money(Math.abs(a.amount))}</span>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, allowance: f.allowance.filter((x) => x.id !== a.id) }))} className={danger + " px-1.5"} aria-label="Delete"><Trash2 size={12} /></button></li>)}</ul>}
    </Panel>; })}</div> : <Panel><Empty icon={<Coins />} title="No kids added yet.">Add a kid below, or add kids in Family & settings.</Empty></Panel>}
    <Panel title="Add a kid"><form onSubmit={(e) => { e.preventDefault(); if (newKid.trim()) { setExtra((x) => [...x, newKid.trim()]); setNewKid(""); } }} className="flex gap-2"><input value={newKid} onChange={(e) => setNewKid(e.target.value)} maxLength={60} placeholder="Name" className={inputClass} aria-label="Kid's name" /><button type="submit" className={primary} disabled={!newKid.trim()}>Add</button></form></Panel>
  </div>;
}
