// Warranties (a Plugin Store add-on): what you bought, where, and when the warranty runs out.
import { useState, type FormEvent } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { daysUntil } from "@shared/lifePlugins";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const nice = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

export default function Warranties({ family, setFamily, today, makeId }: SectionProps) {
  const [item, setItem] = useState("");
  const [store, setStore] = useState("");
  const [bought, setBought] = useState(today);
  const [years, setYears] = useState(1);
  const [note, setNote] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!item.trim()) return;
    const [y, m, d] = bought.split("-").map(Number);
    const until = `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`;
    setFamily((f) => ({ ...f, warranties: [...f.warranties, { id: makeId(), item: item.trim(), store: store.trim(), bought, until, note: note.trim() }] }));
    setItem(""); setStore(""); setNote("");
  };
  const list = family.warranties.map((w) => ({ ...w, left: w.until ? daysUntil(w.until, today) : 99999 })).sort((a, b) => a.left - b.left);
  const active = list.filter((w) => w.left >= 0), ended = list.filter((w) => w.left < 0);

  return <div className="space-y-6">
    <PageHead eyebrow="Warranties" title="Covered or not?" blurb="Log big purchases and their warranties, so when something breaks you know right away if it's covered." />
    <Panel title="Add a purchase">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-2">
        <input value={item} onChange={(e) => setItem(e.target.value)} maxLength={100} placeholder="What (washer, laptop…)" className={inputClass} aria-label="Item" />
        <input value={store} onChange={(e) => setStore(e.target.value)} maxLength={60} placeholder="Where you bought it" className={inputClass} aria-label="Store" />
        <label className="text-xs font-bold text-slate-500">Bought on<input type="date" value={bought} max={today} onChange={(e) => setBought(e.target.value || today)} className={inputClass + " mt-1"} /></label>
        <label className="text-xs font-bold text-slate-500">Warranty<select value={years} onChange={(e) => setYears(Number(e.target.value))} className={inputClass + " mt-1"}>{[1, 2, 3, 4, 5, 7, 10].map((y) => <option key={y} value={y}>{y} year{y === 1 ? "" : "s"}</option>)}</select></label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (model, where the receipt is, phone number)" className={inputClass + " sm:col-span-2"} aria-label="Note" />
        <button type="submit" className={primary + " sm:col-span-2"} disabled={!item.trim()}>Add</button>
      </form>
    </Panel>
    <Panel title={`Covered · ${active.length}`}>
      {active.length ? <ul className="divide-y divide-slate-100">{active.map((w) => <li key={w.id} className="flex items-center gap-3 py-2.5">
        <ShieldCheck size={18} className={w.left <= 60 ? "text-amber-500" : "text-emerald-500"} />
        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{w.item}</span><span className="block text-xs text-slate-500">{[w.store, `bought ${nice(w.bought)}`, w.note].filter(Boolean).join(" · ")}</span></span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${w.left <= 60 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>until {nice(w.until)}</span>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, warranties: f.warranties.filter((x) => x.id !== w.id) }))} className={danger + " px-2"} aria-label={`Delete ${w.item}`}><Trash2 size={13} /></button>
      </li>)}</ul> : <Empty icon={<ShieldCheck />} title="Nothing covered yet.">Add your next big purchase.</Empty>}
    </Panel>
    {ended.length > 0 && <Panel title={`Expired · ${ended.length}`} collapseKey="warranties-ended"><ul className="divide-y divide-slate-100">{ended.map((w) => <li key={w.id} className="flex items-center gap-3 py-2 text-sm text-slate-500"><span className="flex-1">{w.item}</span><span className="text-xs">ended {nice(w.until)}</span><button type="button" onClick={() => setFamily((f) => ({ ...f, warranties: f.warranties.filter((x) => x.id !== w.id) }))} className={danger + " px-2"} aria-label={`Delete ${w.item}`}><Trash2 size={13} /></button></li>)}</ul></Panel>}
  </div>;
}
