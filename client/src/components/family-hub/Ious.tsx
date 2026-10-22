// IOUs (a Plugin Store add-on): who owes you, who you owe, and settling up.
import { useState, type FormEvent } from "react";
import { Check, HandCoins, Trash2 } from "lucide-react";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const money = (n: number) => Math.abs(n).toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function Ious({ family, setFamily, today, makeId }: SectionProps) {
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [dir, setDir] = useState<"they" | "me">("they");
  const [note, setNote] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = Math.abs(Number(amount) || 0);
    if (!person.trim() || !n) return;
    setFamily((f) => ({ ...f, ious: [...f.ious, { id: makeId(), person: person.trim(), amount: dir === "they" ? n : -n, note: note.trim(), date: today, settled: false }] }));
    setAmount(""); setNote("");
  };
  const open = family.ious.filter((i) => !i.settled);
  const people = [...new Set(open.map((i) => i.person))].map((p) => ({ p, total: open.filter((i) => i.person === p).reduce((s, i) => s + i.amount, 0) })).sort((a, b) => b.total - a.total);
  const owedToMe = people.filter((x) => x.total > 0).reduce((s, x) => s + x.total, 0), iOwe = -people.filter((x) => x.total < 0).reduce((s, x) => s + x.total, 0);
  const settle = (p: string) => setFamily((f) => ({ ...f, ious: f.ious.map((i) => (i.person === p && !i.settled ? { ...i, settled: true } : i)) }));

  return <div className="space-y-6">
    <PageHead eyebrow="IOUs" title="Who owes who" blurb="Lunch, concert tickets, the gas money. Keep track so nobody has to remember." />
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-[1.5rem] bg-emerald-50 p-5"><p className="text-2xl font-black text-emerald-700">{money(owedToMe)}</p><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Owed to you</p></div>
      <div className="rounded-[1.5rem] bg-rose-50 p-5"><p className="text-2xl font-black text-rose-700">{money(iOwe)}</p><p className="text-xs font-bold uppercase tracking-wide text-rose-800">You owe</p></div>
    </div>
    <Panel title="Add an IOU">
      <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_auto]">
        <input value={person} onChange={(e) => setPerson(e.target.value)} list="iou-people" maxLength={60} placeholder="Who" className={inputClass} aria-label="Who" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$ amount" className={inputClass} aria-label="Amount" />
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="For what (optional)" className={inputClass} aria-label="For what" />
        <button type="submit" className={primary} disabled={!person.trim() || !Number(amount)}>Add</button>
        <datalist id="iou-people">{[...new Set(family.ious.map((i) => i.person))].map((p) => <option key={p} value={p} />)}</datalist>
      </form>
      <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1">{([["they", "They owe me"], ["me", "I owe them"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setDir(v)} aria-pressed={dir === v} className={`min-h-9 rounded-lg px-3 text-sm font-bold ${dir === v ? "bg-white shadow-sm" : "text-slate-500"}`}>{l}</button>)}</div>
    </Panel>
    {people.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{people.map(({ p, total }) => <Panel key={p} title={p} right={<button type="button" onClick={() => settle(p)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100"><Check size={15} />Settle up</button>}>
      <p className={`text-xl font-black ${total > 0 ? "text-emerald-700" : total < 0 ? "text-rose-700" : "text-slate-500"}`}>{total > 0 ? `Owes you ${money(total)}` : total < 0 ? `You owe ${money(total)}` : "Even"}</p>
      <ul className="mt-2 divide-y divide-slate-100">{open.filter((i) => i.person === p).map((i) => <li key={i.id} className="flex items-center gap-2 py-2 text-sm"><span className="min-w-0 flex-1 truncate text-slate-600">{i.note || "—"}</span><span className={`font-bold ${i.amount > 0 ? "text-emerald-700" : "text-rose-700"}`}>{i.amount > 0 ? "+" : "−"}{money(i.amount)}</span>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, ious: f.ious.filter((x) => x.id !== i.id) }))} className={danger + " px-2"} aria-label="Delete"><Trash2 size={13} /></button></li>)}</ul>
    </Panel>)}</div> : <Panel><Empty icon={<HandCoins />} title="All square.">Nobody owes anybody. Nice.</Empty></Panel>}
  </div>;
}
