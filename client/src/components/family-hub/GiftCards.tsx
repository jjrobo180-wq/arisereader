// Gift cards (a Plugin Store add-on): what's left on each card and when it runs out, so none go to waste.
import { useState, type FormEvent } from "react";
import { CreditCard, Trash2 } from "lucide-react";
import { daysUntil } from "@shared/lifePlugins";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function GiftCards({ family, setFamily, today, makeId }: SectionProps) {
  const [store, setStore] = useState("");
  const [balance, setBalance] = useState("");
  const [expires, setExpires] = useState("");
  const [spend, setSpend] = useState<Record<string, string>>({});
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!store.trim()) return;
    setFamily((f) => ({ ...f, giftCards: [...f.giftCards, { id: makeId(), store: store.trim(), balance: Math.max(0, Number(balance) || 0), expires, note: "" }] }));
    setStore(""); setBalance(""); setExpires("");
  };
  const use = (id: string) => { const n = Math.abs(Number(spend[id]) || 0); if (!n) return; setFamily((f) => ({ ...f, giftCards: f.giftCards.map((g) => (g.id === id ? { ...g, balance: Math.max(0, Math.round((g.balance - n) * 100) / 100) } : g)) })); setSpend((s) => ({ ...s, [id]: "" })); };
  const list = [...family.giftCards].sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999"));
  const total = list.reduce((s, g) => s + g.balance, 0);

  return <div className="space-y-6">
    <PageHead eyebrow="Gift cards" title="Money you forgot you had" blurb="Track the balance on each gift card and when it expires, so none go to waste. Keep card numbers on the card itself." />
    {list.length > 0 && <p className="text-sm font-bold text-slate-500">Total on all cards: <span className="text-lg font-black text-emerald-700">{money(total)}</span></p>}
    <Panel title="Add a card">
      <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_auto]">
        <input value={store} onChange={(e) => setStore(e.target.value)} maxLength={60} placeholder="Store" className={inputClass} aria-label="Store" />
        <input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" placeholder="$ balance" className={inputClass} aria-label="Balance" />
        <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={inputClass} aria-label="Expires (optional)" title="Expires (optional)" />
        <button type="submit" className={primary} disabled={!store.trim()}>Add</button>
      </form>
    </Panel>
    {list.length ? <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((g) => { const left = g.expires ? daysUntil(g.expires, today) : null; return <li key={g.id} className={`rounded-[1.5rem] bg-gradient-to-br p-5 text-white shadow-[0_12px_28px_#17152b22] ${g.balance <= 0 ? "from-slate-400 to-slate-500" : "from-[#4b3fa0] to-[#7c6be6]"}`}>
      <div className="flex items-start justify-between"><p className="text-lg font-black">{g.store}</p><button type="button" onClick={() => setFamily((f) => ({ ...f, giftCards: f.giftCards.filter((x) => x.id !== g.id) }))} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label={`Delete ${g.store}`}><Trash2 size={14} /></button></div>
      <p className="mt-3 text-3xl font-black">{money(g.balance)}</p>
      {left !== null && <p className={`text-xs font-bold ${left < 0 ? "text-rose-200" : left <= 30 ? "text-amber-200" : "text-violet-100"}`}>{left < 0 ? "Expired" : left === 0 ? "Expires today" : `Expires in ${left} day${left === 1 ? "" : "s"}`}</p>}
      <div className="mt-3 flex gap-1.5"><input value={spend[g.id] || ""} onChange={(e) => setSpend((s) => ({ ...s, [g.id]: e.target.value }))} inputMode="decimal" placeholder="$ spent" className="min-h-10 w-full rounded-xl border-0 bg-white/15 px-3 text-sm text-white placeholder:text-white/50 outline-none" aria-label={`Spent from ${g.store}`} /><button type="button" onClick={() => use(g.id)} className="rounded-xl bg-white/20 px-3 text-sm font-bold hover:bg-white/30">Use</button></div>
    </li>; })}</ul> : <Panel><Empty icon={<CreditCard />} title="No gift cards yet.">Add the ones hiding in your wallet or drawer.</Empty></Panel>}
  </div>;
}
