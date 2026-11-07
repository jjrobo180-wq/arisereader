// Kitchen's Shop page: one box, one clean checklist. Same saved list as before (family.groceries).
import { useState, type FormEvent } from "react";
import { Check, Copy, X } from "lucide-react";
import { AISLES, guessAisle } from "@shared/lifePlugins";
import type { GroceryItem } from "@shared/familyHub";
import { inputClass, type SectionProps } from "./ui";

export default function KitchenShop({ family, setFamily, makeId, say }: SectionProps) {
  const [text, setText] = useState("");
  const items = family.groceries;
  const set = (update: (l: GroceryItem[]) => GroceryItem[]) => setFamily((f) => ({ ...f, groceries: update(f.groceries) }));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const names = text.split(/[,\n]/).map((n) => n.trim()).filter(Boolean).slice(0, 30);
    if (!names.length) return;
    set((l) => [...l, ...names.map((n) => ({ id: makeId(), name: n.slice(0, 80), qty: "", aisle: guessAisle(n), checked: false }))]);
    setText("");
  };
  const open = items.filter((i) => !i.checked), done = items.filter((i) => i.checked);
  const aisles = AISLES.filter((a) => open.some((i) => (i.aisle || "Other") === a));
  const copy = async () => {
    const t = aisles.map((a) => `${a}\n${open.filter((i) => (i.aisle || "Other") === a).map((i) => `- ${i.qty ? `${i.qty} ` : ""}${i.name}`).join("\n")}`).join("\n\n");
    try { await navigator.clipboard.writeText(t); say("List copied."); } catch { say("Couldn't copy on this device."); }
  };
  const total = Math.round(open.reduce((a, i) => a + (i.price || 0), 0) * 100) / 100;
  return <div className="space-y-5" data-testid="kitchen-shop">
    <form onSubmit={add} className="flex gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add to your list (milk, eggs, bread)" className={`${inputClass} flex-1`} aria-label="Add to your list" />
      <button type="submit" disabled={!text.trim()} className="shrink-0 rounded-xl bg-[#6e5ae0] px-4 text-sm font-bold text-white disabled:opacity-40">Add</button>
    </form>
    {total > 0 && <p className="px-1 text-sm font-bold text-slate-500">Estimated total <span className="text-slate-900">${total.toFixed(2)}</span></p>}
    {open.length === 0 && <p className="py-10 text-center text-sm text-slate-400">{done.length ? "All done. Enjoy!" : "Nothing on your list. Use Plan to pick meals and build it for you."}</p>}
    {aisles.map((a) => <section key={a}>
      <h3 className="mb-1 px-1 text-[11px] font-black uppercase tracking-[.14em] text-slate-400">{a}</h3>
      <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200/70">{open.filter((i) => (i.aisle || "Other") === a).map((i) => <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" onClick={() => set((l) => l.map((x) => (x.id === i.id ? { ...x, checked: true } : x)))} aria-label={`Got ${i.name}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-transparent hover:border-violet-500"><Check size={13} /></button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{i.qty && <span className="text-violet-700">{i.qty} </span>}{i.name}</span>
        <button type="button" onClick={() => set((l) => l.filter((x) => x.id !== i.id))} aria-label={`Remove ${i.name}`} className="p-1 text-slate-300 hover:text-rose-500"><X size={15} /></button>
      </li>)}</ul>
    </section>)}
    {done.length > 0 && <div className="flex items-center justify-between px-1 text-xs text-slate-400">
      <span>{done.length} in the cart</span>
      <button type="button" onClick={() => { set((l) => l.filter((x) => !x.checked)); say("Cleared."); }} className="font-bold text-violet-600">Clear</button>
    </div>}
    {open.length > 0 && <button type="button" onClick={copy} className="mx-auto flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600"><Copy size={13} />Copy list</button>}
  </div>;
}
