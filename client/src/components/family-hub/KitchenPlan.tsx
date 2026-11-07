// Kitchen > Plan: choose dishes (a dish can be on as many days as you like), schedule them, then shop.
// Quiet, typographic design: no icons or colour fills beyond one dark accent. (shared/mealCatalog.ts)
import { useEffect, useMemo, useState } from "react";
import { guessAisle } from "@shared/lifePlugins";
import { DAY_NAME, SLOTS, SORTS, WEEK_DAYS, autoFill, cellKey, countsOf, dishById, dishCost, dishesFor, planForBudget, round2, shoppingFrom, totalOf, type DishSlot, type ShopLine, type SortKey, type Week } from "@shared/mealCatalog";
import { apiRequest } from "@/lib/queryClient";
import type { SectionProps } from "./ui";

const KEY = "arise-kitchen-plan-v2";
type Draft = { counts: Record<string, number>; week: Week; people: number; edits: Record<string, Partial<ShopLine>>; budget: string };
const blank = (): Draft => ({ counts: {}, week: {}, people: 4, edits: {}, budget: "" });
const load = (): Draft => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return blank(); } };
const $ = (n: number) => `$${n.toFixed(2)}`;
const btn = "inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-30";
const link = "text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline";
const label = "text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400";

export default function KitchenPlan({ setFamily, makeId, say }: SectionProps) {
  const [d, setD] = useState<Draft>(load);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [slot, setSlot] = useState<DishSlot>("dinner");
  const [sort, setSort] = useState<SortKey>("popular");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* not kept */ } }, [d]);
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const slotCount = (s: DishSlot) => dishesFor(s, "popular").reduce((a, x) => a + (d.counts[x.id] ?? 0), 0);
  const meals = SLOTS.reduce((a, s) => a + slotCount(s.id), 0);
  const setCount = (id: string, n: number) => { const counts = { ...d.counts }; if (n <= 0) delete counts[id]; else counts[id] = Math.min(7, n); patch({ counts }); };
  const lines: ShopLine[] = useMemo(() => shoppingFrom(d.week, d.people).map((l) => ({ ...l, ...(d.edits[l.key] ?? {}) })), [d.week, d.people, d.edits]);
  const total = totalOf(lines);
  const edit = (key: string, p: Partial<ShopLine>) => patch({ edits: { ...d.edits, [key]: { ...(d.edits[key] ?? {}), ...p } } });
  const budget = Number(d.budget);

  const fromBudget = () => {
    if (!Number.isFinite(budget) || budget < 10) { say("Enter a weekly amount, such as 120."); return; }
    const slots = SLOTS.filter((s) => s.id === "breakfast" || s.id === "lunch" || s.id === "dinner" || slotCount(s.id) > 0).map((s) => s.id);
    const week = planForBudget(budget, slots, d.people, sort);
    patch({ week, counts: countsOf(week), edits: {} });
    const cost = totalOf(shoppingFrom(week, d.people));
    say(cost > budget ? `The lowest-cost week is ${$(cost)}, a little over ${$(budget)}.` : `Planned a week for about ${$(cost)}.`);
    setStep(3);
  };
  const askAi = async () => {
    setChecking(true);
    try {
      const res = await apiRequest("POST", "/api/arise-todo/meal/price", { items: lines.map((l) => ({ key: l.key, name: l.name, qty: l.qty, brand: l.brand })) });
      const { prices } = await res.json() as { prices: { key: string; price: number }[] };
      if (!prices?.length) throw new Error("none");
      const edits = { ...d.edits }; for (const p of prices) edits[p.key] = { ...(edits[p.key] ?? {}), price: p.price };
      patch({ edits }); say("Prices updated.");
    } catch { say("Price check is unavailable right now. Your estimates are unchanged and every price can be edited."); }
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

  const steps = ["Choose", "Schedule", "Shop"];
  const tab = (on: boolean) => `relative pb-2.5 text-sm font-semibold transition ${on ? "text-slate-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-slate-900" : "text-slate-400 hover:text-slate-600"}`;
  const stepper = (n: number, set: (v: number) => void, name: string) => <div className="flex items-center gap-3">
    <button type="button" aria-label={`Fewer days of ${name}`} onClick={() => set(n - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-base text-slate-600 hover:border-slate-900">&minus;</button>
    <span className="w-14 text-center text-sm font-semibold tabular-nums text-slate-900">{n} {n === 1 ? "day" : "days"}</span>
    <button type="button" aria-label={`More days of ${name}`} onClick={() => set(n + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-base text-slate-600 hover:border-slate-900">+</button>
  </div>;

  return <div className="mx-auto max-w-2xl space-y-6" data-testid="kitchen-plan">
    <nav className="flex gap-7 border-b border-slate-200" aria-label="Plan steps">
      {steps.map((s, i) => <button key={s} type="button" onClick={() => setStep((i + 1) as 1 | 2 | 3)} aria-current={step === i + 1} className={tab(step === i + 1)}><span className="mr-1.5 text-slate-300">{i + 1}</span>{s}</button>)}
    </nav>

    {step === 1 && <>
      <div className="flex gap-6 overflow-x-auto border-b border-slate-100" role="tablist">
        {SLOTS.map((s) => <button key={s.id} type="button" role="tab" aria-selected={slot === s.id} onClick={() => setSlot(s.id)} className={`shrink-0 ${tab(slot === s.id)}`}>{s.label}{slotCount(s.id) > 0 && <sup className="ml-1 text-[10px] font-bold text-slate-900">{slotCount(s.id)}</sup>}</button>)}
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-500">Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-sm font-medium text-slate-900">{SORTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        </label>
        <button type="button" onClick={() => setBudgetOpen((o) => !o)} className={link} aria-expanded={budgetOpen}>Plan from a budget</button>
      </div>
      {budgetOpen && <div className="flex gap-2 rounded-xl border border-slate-200 p-3">
        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 px-3"><span className="text-slate-400">$</span><input value={d.budget} onChange={(e) => patch({ budget: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="Weekly food total" aria-label="Weekly food budget" className="w-full min-w-0 bg-transparent py-2.5 pl-1.5 text-sm outline-none" /></div>
        <button type="button" onClick={fromBudget} className="shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Build week</button>
      </div>}
      <ul className="divide-y divide-slate-100">
        {dishesFor(slot, sort).map((x) => { const n = d.counts[x.id] ?? 0; return <li key={x.id} className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0"><p className={`truncate text-[15px] ${n ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>{x.name}</p><p className="mt-0.5 text-xs text-slate-400">{x.kcal} cal &middot; {x.minutes} min &middot; about {$(dishCost(x))}</p></div>
          {n ? stepper(n, (v) => setCount(x.id, v), x.name) : <button type="button" onClick={() => setCount(x.id, 1)} className="shrink-0 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900">Add</button>}
        </li>; })}
        {dishesFor(slot, sort).length === 0 && <li className="py-10 text-center text-sm text-slate-400">Nothing matches that sort.</li>}
      </ul>
      <button type="button" disabled={!meals} onClick={() => { patch({ week: autoFill(d.counts), edits: {} }); setStep(2); }} className={btn}>Continue &middot; {meals} {meals === 1 ? "meal" : "meals"}</button>
    </>}

    {step === 2 && <>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-slate-500">Choose a dish for each day, or leave a day empty.</p>
        <button type="button" onClick={() => patch({ week: autoFill(d.counts), edits: {} })} className={link}>Reset</button>
      </div>
      {SLOTS.filter((s) => slotCount(s.id) > 0).map((s) => <section key={s.id}>
        <h3 className={`${label} mb-1`}>{s.label}</h3>
        <ul className="divide-y divide-slate-100 border-y border-slate-100">{WEEK_DAYS.map((day) => <li key={day} className="flex items-center gap-4 py-2.5">
          <span className="w-24 shrink-0 text-sm font-medium text-slate-500">{DAY_NAME[day]}</span>
          <select value={d.week[cellKey(day, s.id)] ?? ""} onChange={(e) => { const week = { ...d.week }; if (e.target.value) week[cellKey(day, s.id)] = e.target.value; else delete week[cellKey(day, s.id)]; patch({ week, edits: {} }); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900" aria-label={`${s.label} on ${DAY_NAME[day]}`}>
            <option value="">None</option>
            {dishesFor(s.id, "popular").filter((x) => (d.counts[x.id] ?? 0) > 0).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </li>)}</ul>
      </section>)}
      <button type="button" onClick={() => setStep(3)} className={btn}>Continue to shopping list</button>
    </>}

    {step === 3 && <>
      <div className="flex items-end justify-between border-b border-slate-200 pb-5">
        <div>
          <p className={label}>Estimated for the week</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-slate-900" data-testid="plan-total">{$(total)}</p>
          {budget > 0 && <p className="mt-1 text-xs text-slate-500">{total <= budget ? `${$(budget - total)} under your ${$(budget)} budget` : `${$(total - budget)} over your ${$(budget)} budget`}</p>}
        </div>
        <div className="text-right">
          <p className={label}>People</p>
          <div className="mt-1 flex items-center gap-3">
            <button type="button" aria-label="Fewer people" onClick={() => patch({ people: Math.max(1, d.people - 1) })} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-slate-900">&minus;</button>
            <span className="w-4 text-center text-sm font-semibold tabular-nums">{d.people}</span>
            <button type="button" aria-label="More people" onClick={() => patch({ people: Math.min(12, d.people + 1) })} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-slate-900">+</button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Edit any item, brand, amount or price.</p>
        <button type="button" onClick={askAi} disabled={checking || !lines.length} className={`${link} disabled:opacity-40`}>{checking ? "Checking prices" : "Check prices with AI"}</button>
      </div>
      <ul className="divide-y divide-slate-100 border-y border-slate-100">{lines.map((l) => <li key={l.key} className="space-y-1 py-3">
        <div className="flex items-center gap-3">
          <input value={l.name} onChange={(e) => edit(l.key, { name: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-900 outline-none focus:underline" aria-label="Item" />
          <div className="flex w-20 shrink-0 items-center justify-end text-sm font-semibold tabular-nums text-slate-900"><span className="text-slate-400">$</span><input value={Number.isFinite(l.price) ? String(l.price) : ""} onChange={(e) => edit(l.key, { price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} inputMode="decimal" className="w-14 bg-transparent text-right outline-none focus:underline" aria-label={`Price for ${l.name}`} /></div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <input value={l.brand} onChange={(e) => edit(l.key, { brand: e.target.value })} placeholder="Brand or add-ins" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-300 focus:underline" aria-label="Brand" />
          <input value={l.qty} onChange={(e) => edit(l.key, { qty: e.target.value })} className="w-28 shrink-0 bg-transparent text-right outline-none focus:underline" aria-label="Amount" />
        </div>
        {l.meals > 1 && <p className="text-[11px] text-slate-400">Used in {l.meals} meals</p>}
      </li>)}</ul>
      {lines.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nothing scheduled yet.</p>}
      <button type="button" disabled={!lines.length} onClick={makeList} className={btn} data-testid="plan-make-list">Add to shopping list</button>
    </>}
  </div>;
}
