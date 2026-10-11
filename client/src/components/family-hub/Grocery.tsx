// Grocery list (a Plugin Store add-on): a shopping list that sorts itself by aisle.
import { useState, type FormEvent } from "react";
import { Check, Copy, ShoppingCart, Trash2, X } from "lucide-react";
import { AISLES, guessAisle } from "@shared/lifePlugins";
import type { GroceryItem } from "@shared/familyHub";
import { Empty, PageHead, Panel, inputClass, plain, primary, type SectionProps } from "./ui";

export default function Grocery({ family, setFamily, makeId, say }: SectionProps) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const items = family.groceries;
  const set = (update: (list: GroceryItem[]) => GroceryItem[]) => setFamily((f) => ({ ...f, groceries: update(f.groceries) }));

  const add = (e: FormEvent) => {
    e.preventDefault();
    // Several at once: "milk, eggs, bread".
    const names = name.split(/[,\n]/).map((n) => n.trim()).filter(Boolean).slice(0, 30);
    if (!names.length) return;
    set((list) => [...list, ...names.map((n) => ({ id: makeId(), name: n.slice(0, 80), qty: names.length === 1 ? qty.trim().slice(0, 20) : "", aisle: guessAisle(n), checked: false }))]);
    setName(""); setQty("");
  };
  const toggle = (id: string) => set((list) => list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const remove = (id: string) => set((list) => list.filter((i) => i.id !== id));
  const move = (id: string, aisle: string) => set((list) => list.map((i) => (i.id === id ? { ...i, aisle } : i)));
  const clearChecked = () => { const n = items.filter((i) => i.checked).length; set((list) => list.filter((i) => !i.checked)); say(`${n} item${n === 1 ? "" : "s"} cleared.`); };
  const copy = async () => {
    const text = AISLES.map((a) => { const rows = items.filter((i) => !i.checked && (i.aisle || "Other") === a); return rows.length ? `${a}\n${rows.map((i) => `- ${i.qty ? `${i.qty} ` : ""}${i.name}`).join("\n")}` : ""; }).filter(Boolean).join("\n\n");
    try { await navigator.clipboard.writeText(text); say("Grocery list copied. Paste it into a text or email."); } catch { say("Couldn't copy on this device."); }
  };

  const open = items.filter((i) => !i.checked), done = items.filter((i) => i.checked);
  const aisles = AISLES.filter((a) => open.some((i) => (i.aisle || "Other") === a));

  return <div className="space-y-6">
    <PageHead eyebrow="Grocery list" title="Shopping, sorted" blurb="Add what you need and it sorts itself by aisle. Check things off as they go in the cart."
      action={open.length > 0 ? <button type="button" onClick={copy} className={plain}><Copy size={16} />Copy list</button> : undefined} />
    <Panel>
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add items (milk, eggs, bread…)" className={inputClass} aria-label="Items to add" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} maxLength={20} placeholder="How many" className={inputClass} aria-label="How many" />
        <button type="submit" className={primary} disabled={!name.trim()}>Add</button>
      </form>
    </Panel>
    {open.length ? <div className="grid gap-4 lg:grid-cols-2">{aisles.map((a) => <Panel key={a} title={a} eyebrow={`${open.filter((i) => (i.aisle || "Other") === a).length} to get`}>
      <ul className="divide-y divide-slate-100">{open.filter((i) => (i.aisle || "Other") === a).map((i) => <li key={i.id} className="flex items-center gap-3 py-2">
        <button type="button" onClick={() => toggle(i.id)} aria-label={`Got ${i.name}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-slate-300 text-transparent hover:border-violet-500"><Check size={15} /></button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{i.qty && <span className="text-violet-700">{i.qty} </span>}{i.name}</span>
        <select value={i.aisle || "Other"} onChange={(e) => move(i.id, e.target.value)} className="max-w-28 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-500" aria-label={`Aisle for ${i.name}`}>{AISLES.map((x) => <option key={x}>{x}</option>)}</select>
        <button type="button" onClick={() => remove(i.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${i.name}`}><X size={15} /></button>
      </li>)}</ul>
    </Panel>)}</div> : <Panel><Empty icon={<ShoppingCart />} title={done.length ? "All done. Nice shopping!" : "Your list is empty."}>{done.length ? "Clear the checked items when you're home." : "Add a few things above. Separate them with commas to add many at once."}</Empty></Panel>}
    {done.length > 0 && <Panel title={`In the cart · ${done.length}`} right={<button type="button" onClick={clearChecked} className={plain}><Trash2 size={15} />Clear</button>}>
      <ul className="flex flex-wrap gap-2">{done.map((i) => <li key={i.id}><button type="button" onClick={() => toggle(i.id)} className="rounded-xl bg-slate-50 px-3 py-1.5 text-sm text-slate-400 line-through hover:bg-slate-100" title="Put back on the list">{i.name}</button></li>)}</ul>
    </Panel>}
  </div>;
}
