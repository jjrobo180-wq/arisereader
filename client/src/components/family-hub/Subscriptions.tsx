// Subscriptions (a Plugin Store add-on): streaming, apps, gym and the rest, with what they cost
// each month and year, and which renew soon.
import { useState, type FormEvent } from "react";
import { CreditCard, Trash2 } from "lucide-react";
import { daysUntil, monthlyCost, nextRenewal } from "@shared/lifePlugins";
import type { Subscription } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const IDEAS = ["Netflix", "Spotify", "Disney+", "Amazon Prime", "YouTube Premium", "iCloud", "Gym", "Hulu", "Max"];

export default function Subscriptions({ family, setFamily, today, makeId }: SectionProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<Subscription["cycle"]>("monthly");
  const [next, setNext] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setFamily((f) => ({ ...f, subscriptions: [...f.subscriptions, { id: makeId(), name: name.trim(), amount: Math.max(0, Number(amount) || 0), cycle, nextDate: next, category: "" }] }));
    setName(""); setAmount(""); setNext("");
  };
  const list = family.subscriptions.map((s) => { const due = nextRenewal(s, today); return { ...s, due, days: due ? daysUntil(due, today) : 9999 }; }).sort((a, b) => a.days - b.days);
  const perMonth = list.reduce((s, x) => s + monthlyCost(x), 0);
  const soon = list.filter((s) => s.days <= 7);

  return <div className="space-y-6">
    <PageHead eyebrow="Subscriptions" title="Where the monthly money goes" blurb="Every subscription in one list, with the real monthly and yearly cost, and which ones renew soon." />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[["Each month", money(perMonth)], ["Each year", money(perMonth * 12)], ["Subscriptions", String(list.length)]].map(([k, v]) => <div key={k} className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08]"><p className="text-2xl font-black tracking-tight">{v}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{k}</p></div>)}
    </div>
    {soon.length > 0 && <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Renewing this week: {soon.map((s) => `${s.name} (${s.days === 0 ? "today" : `in ${s.days}d`}, ${money(s.amount)})`).join(", ")}</p>}
    <Panel title="Add a subscription">
      <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_7rem_8rem_minmax(0,1fr)_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} list="sub-ideas" maxLength={80} placeholder="Name" className={inputClass} aria-label="Name" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$ cost" className={inputClass} aria-label="Cost" />
        <select value={cycle} onChange={(e) => setCycle(e.target.value as Subscription["cycle"])} className={inputClass} aria-label="How often"><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="weekly">Weekly</option></select>
        <input type="date" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} aria-label="Next renewal date" title="Next renewal date" />
        <button type="submit" className={primary} disabled={!name.trim()}>Add</button>
        <datalist id="sub-ideas">{IDEAS.map((i) => <option key={i} value={i} />)}</datalist>
      </form>
    </Panel>
    <Panel title="All subscriptions">
      {list.length ? <ul className="divide-y divide-slate-100">{list.map((s) => <li key={s.id} className="flex items-center gap-3 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-black text-violet-700">{s.name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{s.name}</span><span className="block text-xs text-slate-500">{money(s.amount)} {s.cycle}{s.due ? ` · renews ${new Date(`${s.due}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</span></span>
        <span className="text-right text-xs font-bold text-slate-500">{money(monthlyCost(s))}<span className="block font-medium text-slate-400">a month</span></span>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, subscriptions: f.subscriptions.filter((x) => x.id !== s.id) }))} className={danger + " px-2"} aria-label={`Delete ${s.name}`}><Trash2 size={14} /></button>
      </li>)}</ul> : <Empty icon={<CreditCard />} title="No subscriptions yet.">Add them all. The total is often a surprise.</Empty>}
    </Panel>
  </div>;
}
