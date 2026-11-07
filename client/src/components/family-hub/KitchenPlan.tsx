// Kitchen > Plan: pick dishes (tap to choose, sort by what matters), match them to days, then get one editable
// shopping list with a total. Or start from a weekly budget and let it build the week. (shared/mealCatalog.ts)
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Minus, Plus, Sparkles, Wand2 } from "lucide-react";
import { guessAisle } from "@shared/lifePlugins";
import { DAY_NAME, SLOTS, SORTS, WEEK_DAYS, autoFill, cellKey, dishById, dishCost, dishesFor, planForBudget, round2, shoppingFrom, totalOf, type DishSlot, type ShopLine, type SortKey, type Week } from "@shared/mealCatalog";
import { apiRequest } from "@/lib/queryClient";
import { inputClass, primary, type SectionProps } from "./ui";

const KEY = "arise-kitchen-plan-v1";
type Draft = { picks: Record<DishSlot, string[]>; week: Week; people: number; edits: Record<string, Partial<ShopLine>>; budget: string };
const blank = (): Draft => ({ picks: { breakfast: [], lunch: [], dinner: [], snack: [], dessert: [] }, week: {}, people: 4, edits: {}, budget: "" });
const load = (): Draft => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return blank(); } };
const $ = (n: number) => `$${n.toFixed(2)}`;

export default function KitchenPlan({ setFamily, makeId, say }: SectionProps) {
  const [d, setD] = useState<Draft>(load);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [slot, setSlot] = useState<DishSlot>("dinner");
  const [sort, setSort] = useState<SortKey>("popular");
  const [checking, setChecking] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* not kept */ } }, [d]);
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const toggle = (id: string, s: DishSlot) => patch({ picks: { ...d.picks, [s]: d.picks[s].includes(id) ? d.picks[s].filter((x) => x !== id) : [...d.picks[s], id].slice(0, 7) } });
  const pickedCount = SLOTS.reduce((a, s) => a + d.picks[s.id].length, 0);
  const lines: ShopLine[] = useMemo(() => shoppingFrom(d.week, d.people).map((l) => ({ ...l, ...(d.edits[l.key] ?? {}) })), [d.week, d.people, d.edits]);
  const total = totalOf(lines);
  const edit = (key: string, p: Partial<ShopLine>) => patch({ edits: { ...d.edits, [key]: { ...(d.edits[key] ?? {}), ...p } } });

  const fromBudget = () => {
    const b = Number(d.budget);
    if (!Number.isFinite(b) || b < 10) { say("Type a weekly amount, like 120."); return; }
    const slots = SLOTS.filter((s) => s.id === "breakfast" || s.id === "lunch" || s.id === "dinner" || d.picks[s.id].length).map((s) => s.id);
    const week = planForBudget(b, slots, d.people, sort);
    const picks = blank().picks; for (const [k, id] of Object.entries(week)) { const s = k.split(":")[1] as DishSlot; if (!picks[s].includes(id)) picks[s].push(id); }
    patch({ week, picks, edits: {} });
    const cost = totalOf(shoppingFrom(week, d.people));
    say(cost > b ? `The cheapest week comes to ${$(cost)}, a little over ${$(b)}.` : `Built a week for about ${$(cost)}.`);
    setStep(3);
  };
  const askAi = async () => {
    setChecking(true);
    try {
      const res = await apiRequest("POST", "/api/arise-todo/meal/price", { items: lines.map((l) => ({ key: l.key, name: l.name, qty: l.qty, brand: l.brand })) });
      const { prices } = await res.json() as { prices: { key: string; price: number }[] };
      if (!prices?.length) throw new Error("none");
      const edits = { ...d.edits }; for (const p of prices) edits[p.key] = { ...(edits[p.key] ?? {}), price: p.price };
      patch({ edits }); say("Prices checked.");
    } catch { say("The price check isn't available right now. Your estimates are still here, and you can edit any price."); }
    setChecking(false);
  };
  const makeList = () => {
    const mine = lines.filter((l) => l.name.trim());
    setFamily((f) => {
      const have = new Set(f.groceries.filter((g) => !g.checked).map((g) => g.name.toLowerCase()));
      const fresh = mine.filter((l) => !have.has(`${l.brand ? l.brand + " " : ""}${l.name}`.toLowerCase()));
      return { ...f, groceries: [...f.groceries, ...fresh.map((l) => { const name = `${l.brand ? l.brand + " " : ""}${l.name}`.slice(0, 80); return { id: makeId(), name, qty: l.qty.slice(0, 20), aisle: guessAisle(l.name), checked: false, price: round2(l.price) }; })] };
    });
    say(`${mine.length} items added to Shop. Total ${$(total)}.`);
  };

  const chip = (on: boolean) => `shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`;
  const steps = ["Pick", "Days", "List"];
  return <div className="space-y-4" data-testid="kitchen-plan">
    <ol className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
      {steps.map((s, i) => <li key={s} className="flex flex-1 items-center gap-2"><button type="button" onClick={() => setStep((i + 1) as 1 | 2 | 3)} className={`flex w-full items-center justify-center gap-1.5 rounded-full py-2 ${step === i + 1 ? "bg-[#6e5ae0] text-white" : "bg-slate-100 text-slate-400"}`}><span>{i + 1}</span>{s}</button></li>)}
    </ol>

    {step === 1 && <>
      <div className="rounded-2xl bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3 ring-1 ring-violet-100">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-black text-violet-800"><Wand2 size={15} />Start from a budget</p>
        <div className="flex gap-2">
          <input value={d.budget} onChange={(e) => patch({ budget: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="Weekly food total, like 120" className={`${inputClass} flex-1`} aria-label="Weekly food budget" />
          <button type="button" onClick={fromBudget} className={primary}>Build my week</button>
        </div>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{SLOTS.map((s) => <button key={s.id} type="button" onClick={() => setSlot(s.id)} className={chip(slot === s.id)}>{s.emoji} {s.label}{d.picks[s.id].length ? ` · ${d.picks[s.id].length}` : ""}</button>)}</div>
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto"><span className="shrink-0 text-xs font-bold text-slate-400">Sort</span>{SORTS.map((s) => <button key={s.id} type="button" onClick={() => setSort(s.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${sort === s.id ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500"}`}>{s.label}</button>)}</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {dishesFor(slot, sort).map((x) => { const on = d.picks[slot].includes(x.id); return <button key={x.id} type="button" onClick={() => toggle(x.id, slot)} aria-pressed={on} className={`relative rounded-2xl border p-3 text-left transition ${on ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
          {on && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#6e5ae0] text-white"><Check size={12} /></span>}
          <span className="text-2xl">{x.emoji}</span>
          <span className="mt-1 block text-sm font-bold leading-tight text-slate-800">{x.name}</span>
          <span className="mt-1 block text-[11px] text-slate-500">{x.kcal} cal · {x.minutes} min · ~{$(dishCost(x))}</span>
        </button>; })}
        {dishesFor(slot, sort).length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-400">Nothing fits that sort. Try another.</p>}
      </div>
      <button type="button" disabled={!pickedCount} onClick={() => { patch({ week: autoFill(d.picks), edits: {} }); setStep(2); }} className={`${primary} w-full disabled:opacity-40`}>Next: match to days ({pickedCount} picked)</button>
    </>}

    {step === 2 && <>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm font-bold text-slate-500"><ChevronLeft size={16} />Back</button>
        <button type="button" onClick={() => patch({ week: autoFill(d.picks), edits: {} })} className="flex items-center gap-1 text-sm font-bold text-violet-700"><Sparkles size={14} />Fill the week for me</button>
      </div>
      {SLOTS.filter((s) => d.picks[s.id].length).map((s) => <section key={s.id}>
        <h3 className="mb-1 px-1 text-[11px] font-black uppercase tracking-[.14em] text-slate-400">{s.emoji} {s.label}</h3>
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200/70">{WEEK_DAYS.map((day) => <li key={day} className="flex items-center gap-3 px-3 py-2">
          <span className="w-20 shrink-0 text-sm font-bold text-slate-600">{DAY_NAME[day]}</span>
          <select value={d.week[cellKey(day, s.id)] ?? ""} onChange={(e) => { const week = { ...d.week }; if (e.target.value) week[cellKey(day, s.id)] = e.target.value; else delete week[cellKey(day, s.id)]; patch({ week, edits: {} }); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm" aria-label={`${s.label} on ${DAY_NAME[day]}`}>
            <option value="">Skip</option>
            {d.picks[s.id].map((id) => <option key={id} value={id}>{dishById(id)?.emoji} {dishById(id)?.name}</option>)}
          </select>
        </li>)}</ul>
      </section>)}
      <button type="button" onClick={() => setStep(3)} className={`${primary} w-full`}>Next: shopping list</button>
    </>}

    {step === 3 && <>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setStep(2)} className="flex items-center gap-1 text-sm font-bold text-slate-500"><ChevronLeft size={16} />Back</button>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">People
          <button type="button" aria-label="Fewer people" onClick={() => patch({ people: Math.max(1, d.people - 1) })} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><Minus size={14} /></button>
          <span className="w-4 text-center">{d.people}</span>
          <button type="button" aria-label="More people" onClick={() => patch({ people: Math.min(12, d.people + 1) })} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><Plus size={14} /></button>
        </div>
      </div>
      <div className="rounded-2xl bg-slate-900 p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-white/60">Estimated for the week</p><p className="text-3xl font-black" data-testid="plan-total">{$(total)}</p>
        {Number(d.budget) > 0 && <p className="mt-1 text-xs text-white/70">{total <= Number(d.budget) ? `${$(Number(d.budget) - total)} under your ${$(Number(d.budget))} budget` : `${$(total - Number(d.budget))} over your ${$(Number(d.budget))} budget`}</p>}
        <button type="button" onClick={askAi} disabled={checking || !lines.length} className="mt-3 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25 disabled:opacity-50"><Sparkles size={13} />{checking ? "Checking prices…" : "Check prices with AI"}</button>
      </div>
      <p className="px-1 text-xs text-slate-500">Change the item, brand, amount or price on any line (spaghetti, for example, can be your own brand).</p>
      <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200/70">{lines.map((l) => <li key={l.key} className="space-y-1.5 px-3 py-2.5">
        <div className="flex gap-2">
          <input value={l.name} onChange={(e) => edit(l.key, { name: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold" aria-label="Item" />
          <div className="flex w-24 shrink-0 items-center rounded-lg border border-slate-200 px-2"><span className="text-sm text-slate-400">$</span><input value={Number.isFinite(l.price) ? String(l.price) : ""} onChange={(e) => edit(l.key, { price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} inputMode="decimal" className="w-full min-w-0 py-1.5 pl-1 text-sm font-semibold outline-none" aria-label={`Price for ${l.name}`} /></div>
        </div>
        <div className="flex gap-2">
          <input value={l.brand} onChange={(e) => edit(l.key, { brand: e.target.value })} placeholder="Brand or add-ins" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" aria-label="Brand" />
          <input value={l.qty} onChange={(e) => edit(l.key, { qty: e.target.value })} className="w-28 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" aria-label="Amount" />
        </div>
        {l.meals > 1 && <p className="text-[11px] text-slate-400">Used in {l.meals} meals</p>}
      </li>)}</ul>
      {lines.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Nothing planned yet. Go back and pick some dishes.</p>}
      <button type="button" disabled={!lines.length} onClick={makeList} className={`${primary} w-full disabled:opacity-40`} data-testid="plan-make-list">Put it on my shopping list</button>
    </>}
  </div>;
}

