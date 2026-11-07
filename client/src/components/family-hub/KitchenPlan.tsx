// Kitchen > Plan, in three steps: 1 Dishes (tap round tiles; each dish opens its ingredients so you can add, take away,
// swap or pick a brand, or switch it to takeout), 2 Week (which dish on which day), 3 Ingredients (the editable list and total).
import { useEffect, useMemo, useState } from "react";
import { guessAisle } from "@shared/lifePlugins";
import { DAY_NAME, DISHES, SLOTS, SORTS, TAKEOUT_PLACES, WEEK_DAYS, autoFill, cellKey, countsOf, dishById, dishCost, dishesFor, itemsOf, planForBudget, round2, shoppingFrom, takeoutFrom, takeoutGuess, takeoutTotal, totalOf, type Custom, type Dish, type DishEdit, type DishSlot, type ShopLine, type SortKey, type Week } from "@shared/mealCatalog";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { Modal, type SectionProps } from "./ui";

const KEY = "arise-kitchen-plan-v3";
type Draft = { counts: Record<string, number>; week: Week; people: number; edits: Record<string, Partial<ShopLine>>; budget: string; custom: Custom; own: Dish[] };
const blank = (): Draft => ({ counts: {}, week: {}, people: 4, edits: {}, budget: "", custom: {}, own: [] });
const load = (): Draft => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return blank(); } };
const $ = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const btn = "inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-30";
const ghost = "inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-900";
const link = "text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline";
const label = "text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400";
const field = "min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-900";
const STEP_TITLE = ["Pick your dishes", "Put them on your week", "Your ingredients"];
const STEP_HELP = ["Tap a dish to choose it. Choose it for more than one day if you like. Tap Ingredients to change what goes in it or switch it to takeout.", "Choose a dish for each day, or leave a day empty.", "Change any item, brand, amount or price, then add it to your shopping list."];

export default function KitchenPlan({ setFamily, makeId, say }: SectionProps) {
  const { token } = useAuth();
  const [d, setD] = useState<Draft>(load);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [slot, setSlot] = useState<DishSlot>("dinner");
  const [sort, setSort] = useState<SortKey>("popular");
  const [search, setSearch] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* not kept */ } }, [d]);
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const ctx = { custom: d.custom, extra: d.own };
  const find = (id: string) => dishById(id, d.own);

  const listFor = (s: DishSlot, so: SortKey, q = "") => [...dishesFor(s, so, q), ...d.own.filter((x) => x.slot === s && (!q || x.name.toLowerCase().includes(q.toLowerCase())))];
  const slotCount = (s: DishSlot) => [...DISHES, ...d.own].filter((x) => x.slot === s).reduce((a, x) => a + (d.counts[x.id] ?? 0), 0);
  const meals = SLOTS.reduce((a, s) => a + slotCount(s.id), 0);
  const setCount = (id: string, n: number) => { const counts = { ...d.counts }; if (n <= 0) delete counts[id]; else counts[id] = Math.min(7, n); patch({ counts, week: {} }); };
  const lines: ShopLine[] = useMemo(() => shoppingFrom(d.week, d.people, ctx).map((l) => ({ ...l, ...(d.edits[l.key] ?? {}) })), [d.week, d.people, d.edits, d.custom, d.own]); // eslint-disable-line react-hooks/exhaustive-deps
  const takeouts = useMemo(() => takeoutFrom(d.week, ctx), [d.week, d.custom, d.own]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = round2(totalOf(lines) + takeoutTotal(takeouts));
  const edit = (key: string, p: Partial<ShopLine>) => patch({ edits: { ...d.edits, [key]: { ...(d.edits[key] ?? {}), ...p } } });
  const budget = Number(d.budget);
  const setEdit = (id: string, next: DishEdit | null) => { const custom = { ...d.custom }; if (!next || (!next.items && !next.takeout)) delete custom[id]; else custom[id] = next; patch({ custom, week: {}, edits: {} }); };
  const goWeek = () => { patch({ week: autoFill(d.counts), edits: {} }); setStep(2); };

  const fromBudget = () => {
    if (!Number.isFinite(budget) || budget < 10) { say("Enter a weekly amount, such as 120."); return; }
    const slots = SLOTS.filter((s) => s.id === "breakfast" || s.id === "lunch" || s.id === "dinner" || slotCount(s.id) > 0).map((s) => s.id);
    const week = planForBudget(budget, slots, d.people, sort);
    patch({ week, counts: countsOf(week), edits: {}, custom: {} });
    const cost = totalOf(shoppingFrom(week, d.people));
    say(cost > budget ? `The lowest-cost week is ${$(cost)}, a little over ${$(budget)}.` : `Planned a week for about ${$(cost)}.`);
    setStep(3);
  };
  const askAi = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE}/api/arise-todo/meal/price`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ items: lines.map((l) => ({ key: l.key, name: l.name, qty: l.qty, brand: l.brand })) }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "The price check can't be reached right now.");
      const prices = (body?.prices ?? []) as { key: string; price: number }[];
      if (!prices.length) throw new Error("No prices came back. Try again.");
      const edits = { ...d.edits }; for (const p of prices) edits[p.key] = { ...(edits[p.key] ?? {}), price: p.price };
      patch({ edits }); say("Prices updated.");
    } catch (e: any) { say(String(e?.message || "The price check failed.")); }
    setChecking(false);
  };
  const makeList = () => {
    const mine = lines.filter((l) => l.name.trim());
    setFamily((f) => {
      const have = new Set(f.groceries.filter((g) => !g.checked).map((g) => g.name.toLowerCase()));
      const fresh = mine.filter((l) => !have.has(`${l.brand ? l.brand + " " : ""}${l.name}`.toLowerCase()));
      return { ...f, groceries: [...f.groceries, ...fresh.map((l) => { const name = `${l.brand ? l.brand + " " : ""}${l.name}`.slice(0, 80); return { id: makeId(), name, qty: l.qty.slice(0, 20), aisle: guessAisle(l.name), checked: false, price: round2(l.price) }; })] };
    });
    say(`${mine.length} items added to your shopping list.`);
  };
  const addOwn = () => {
    const name = adding.trim(); if (!name) return;
    const dish: Dish = { id: `u-${makeId()}`, slot, name: name.slice(0, 60), kcal: 0, minutes: 0, tags: [], pop: 0, items: [] };
    patch({ own: [...d.own, dish], counts: { ...d.counts, [dish.id]: 1 }, week: {} }); setAdding(""); setEditing(dish.id);
  };

  const stepper = (n: number, set: (v: number) => void, name: string) => <div className="flex items-center gap-2.5">
    <button type="button" aria-label={`Fewer days of ${name}`} onClick={() => set(n - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-base text-slate-600 hover:border-slate-900">&minus;</button>
    <span className="w-14 text-center text-sm font-semibold tabular-nums text-slate-900">{n} {n === 1 ? "day" : "days"}</span>
    <button type="button" aria-label={`More days of ${name}`} onClick={() => set(n + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-base text-slate-600 hover:border-slate-900">+</button>
  </div>;

  const shownDishes = listFor(slot, sort, search.trim());
  const editDish = editing ? find(editing) : undefined;
  const editState = editing ? d.custom[editing] : undefined;

  return <div className="w-full max-w-3xl space-y-6" data-testid="kitchen-plan">
    <header className="space-y-2">
      <div className="flex gap-1.5" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map((n) => <button key={n} type="button" aria-label={`Go to step ${n}`} onClick={() => (n === 2 ? goWeek() : setStep(n as 1 | 3))} className={`h-1 flex-1 rounded-full ${n <= step ? "bg-slate-900" : "bg-slate-200"}`} />)}</div>
      <p className={label}>Step {step} of 3</p>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{STEP_TITLE[step - 1]}</h2>
      <p className="text-sm leading-relaxed text-slate-500">{STEP_HELP[step - 1]}</p>
    </header>

    {step === 1 && <>
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Meal">
        {SLOTS.map((s) => <button key={s.id} type="button" role="tab" aria-selected={slot === s.id} onClick={() => setSlot(s.id)} className={`rounded-lg px-1 py-2 text-xs font-semibold transition sm:text-sm ${slot === s.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{s.label}{slotCount(s.id) > 0 && <span className="ml-1 text-slate-900">{slotCount(s.id)}</span>}</button>)}
      </div>
      <div className="flex items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes" aria-label="Search dishes" className={`${field} flex-1`} />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort dishes" className={`${field} shrink-0`}>{SORTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {shownDishes.map((x) => { const n = d.counts[x.id] ?? 0; const cu = d.custom[x.id]; return <div key={x.id} className={`rounded-2xl border p-3.5 transition ${n ? "border-slate-900 bg-white ring-1 ring-slate-900" : "border-slate-200 bg-white hover:border-slate-400"}`}>
          <button type="button" onClick={() => setCount(x.id, n ? 0 : 1)} aria-pressed={n > 0} className="flex w-full items-start gap-3 text-left">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${n ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-transparent"}`}>&#10003;</span>
            <span className="min-w-0"><span className="block text-[15px] font-semibold leading-tight text-slate-900">{x.name}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{x.kcal ? `${x.kcal} cal · ${x.minutes} min · ` : ""}{x.items.length ? `about ${$(dishCost(x))}` : "your own dish"}</span></span>
          </button>
          {n > 0 && <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            {stepper(n, (v) => setCount(x.id, v), x.name)}
            <button type="button" onClick={() => setEditing(x.id)} className="text-sm font-semibold text-slate-900 underline underline-offset-4">{cu?.takeout ? "Takeout" : cu?.items ? "Edited" : "Ingredients"}</button>
          </div>}
        </div>; })}
        {shownDishes.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-400">No dishes match. Add your own below.</p>}
      </div>
      <div className="flex gap-2">
        <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addOwn(); }} placeholder={`Add your own ${SLOTS.find((s) => s.id === slot)!.label.toLowerCase().replace(/s$/, "")}`} aria-label="Your own dish" className={`${field} flex-1`} />
        <button type="button" onClick={addOwn} disabled={!adding.trim()} className={`${ghost} disabled:opacity-30`}>Add</button>
      </div>
      <button type="button" onClick={() => setBudgetOpen((o) => !o)} className={link} aria-expanded={budgetOpen}>Or plan from a weekly budget</button>
      {budgetOpen && <div className="flex gap-2 rounded-xl border border-slate-200 p-3">
        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 px-3"><span className="text-slate-400">$</span><input value={d.budget} onChange={(e) => patch({ budget: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="Weekly food total" aria-label="Weekly food budget" className="w-full min-w-0 bg-transparent py-2.5 pl-1.5 text-sm outline-none" /></div>
        <button type="button" onClick={fromBudget} className="shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Build week</button>
      </div>}
      <button type="button" disabled={!meals} onClick={goWeek} className={btn}>Continue &middot; {meals} {meals === 1 ? "meal" : "meals"}</button>
    </>}

    {step === 2 && <>
      {SLOTS.filter((s) => slotCount(s.id) > 0).map((s) => <section key={s.id}>
        <h3 className={`${label} mb-1`}>{s.label}</h3>
        <ul className="divide-y divide-slate-100 border-y border-slate-100">{WEEK_DAYS.map((day) => <li key={day} className="flex items-center gap-4 py-2.5">
          <span className="w-24 shrink-0 text-sm font-medium text-slate-500">{DAY_NAME[day]}</span>
          <select value={d.week[cellKey(day, s.id)] ?? ""} onChange={(e) => { const week = { ...d.week }; if (e.target.value) week[cellKey(day, s.id)] = e.target.value; else delete week[cellKey(day, s.id)]; patch({ week, edits: {} }); }} className={`${field} flex-1`} aria-label={`${s.label} on ${DAY_NAME[day]}`}>
            <option value="">None</option>
            {listFor(s.id, "popular").filter((x) => (d.counts[x.id] ?? 0) > 0).map((x) => <option key={x.id} value={x.id}>{x.name}{d.custom[x.id]?.takeout ? " (takeout)" : ""}</option>)}
          </select>
        </li>)}</ul>
      </section>)}
      <div className="grid grid-cols-[auto_1fr] gap-2"><button type="button" onClick={() => setStep(1)} className={ghost}>Back</button><button type="button" onClick={() => setStep(3)} className={btn}>Continue to ingredients</button></div>
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
      {takeouts.length > 0 && <section>
        <h3 className={`${label} mb-1`}>Takeout</h3>
        <ul className="divide-y divide-slate-100 border-y border-slate-100">{takeouts.map((t) => <li key={t.dishId} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate font-medium text-slate-900">{t.dish}<span className="font-normal text-slate-400"> &middot; {t.place || "takeout"}{t.meals > 1 ? `, ${t.meals} times` : ""}</span></span><span className="shrink-0 font-semibold tabular-nums">{$(t.price * t.meals)}</span></li>)}</ul>
      </section>}
      <div className="flex items-center justify-between">
        <h3 className={label}>Groceries</h3>
        <button type="button" onClick={askAi} disabled={checking || !lines.length} className={`${link} disabled:opacity-40`}>{checking ? "Checking prices" : "Check prices with AI"}</button>
      </div>
      <ul className="-mt-3 divide-y divide-slate-100 border-y border-slate-100">{lines.map((l) => <li key={l.key} className="space-y-1 py-3">
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
      {lines.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No groceries needed.</p>}
      <div className="grid grid-cols-[auto_1fr] gap-2"><button type="button" onClick={() => setStep(2)} className={ghost}>Back</button><button type="button" disabled={!lines.length} onClick={makeList} className={btn} data-testid="plan-make-list">Add to shopping list</button></div>
    </>}

    {editDish && <Modal title={editDish.name} eyebrow="Ingredients" onClose={() => setEditing(null)}>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        {(["Cook at home", "Takeout"] as const).map((m) => { const on = (m === "Takeout") === !!editState?.takeout; return <button key={m} type="button" role="tab" aria-selected={on} onClick={() => setEdit(editing!, m === "Takeout" ? { ...editState, takeout: editState?.takeout ?? { place: "", price: takeoutGuess(editDish.slot, d.people) } } : { ...editState, takeout: undefined })} className={`rounded-lg py-2 text-sm font-semibold ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{m}</button>; })}
      </div>
      {editState?.takeout ? <div className="mt-5 space-y-4">
        <label className="block"><span className={label}>Where from</span><input value={editState.takeout.place} onChange={(e) => setEdit(editing!, { ...editState, takeout: { ...editState.takeout!, place: e.target.value } })} placeholder="Restaurant name" className={`${field} mt-1.5 w-full`} /></label>
        <div className="flex flex-wrap gap-1.5">{TAKEOUT_PLACES.map((p) => <button key={p} type="button" onClick={() => setEdit(editing!, { ...editState, takeout: { ...editState.takeout!, place: p } })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${editState.takeout!.place === p ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>{p}</button>)}</div>
        <label className="block"><span className={label}>Price for the meal</span><div className="mt-1.5 flex items-center rounded-lg border border-slate-200 px-3"><span className="text-slate-400">$</span><input value={String(editState.takeout.price)} inputMode="decimal" onChange={(e) => setEdit(editing!, { ...editState, takeout: { ...editState.takeout!, price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } })} className="w-full bg-transparent py-2.5 pl-1.5 text-sm outline-none" /></div></label>
        <p className="text-xs text-slate-400">Takeout counts toward your weekly total but isn't added to your shopping list.</p>
      </div> : <div className="mt-5">
        <ul className="divide-y divide-slate-100 border-y border-slate-100">{itemsOf(editDish, editState).map((it, i) => { const rows = itemsOf(editDish, editState); const set = (n: [string, string, number, string?][]) => setEdit(editing!, { ...editState, items: n }); return <li key={i} className="space-y-1.5 py-3">
          <div className="flex items-center gap-2">
            <input value={it[0]} onChange={(e) => set(rows.map((r, j) => (j === i ? [e.target.value, r[1], r[2], r[3]] : r)))} placeholder="Ingredient" aria-label="Ingredient" className={`${field} flex-1`} />
            <button type="button" aria-label={`Remove ${it[0] || "ingredient"}`} onClick={() => set(rows.filter((_, j) => j !== i))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900">&times;</button>
          </div>
          <div className="flex gap-2">
            <input value={it[3] ?? ""} onChange={(e) => set(rows.map((r, j) => (j === i ? [r[0], r[1], r[2], e.target.value] : r)))} placeholder="Brand" aria-label="Brand" className={`${field} min-w-0 flex-1 py-2 text-xs`} />
            <input value={it[1]} onChange={(e) => set(rows.map((r, j) => (j === i ? [r[0], e.target.value, r[2], r[3]] : r)))} placeholder="Amount" aria-label="Amount" className={`${field} w-24 py-2 text-xs`} />
            <input value={String(it[2])} inputMode="decimal" onChange={(e) => set(rows.map((r, j) => (j === i ? [r[0], r[1], Number(e.target.value.replace(/[^\d.]/g, "")) || 0, r[3]] : r)))} aria-label="Price" className={`${field} w-20 py-2 text-xs`} />
          </div>
        </li>; })}</ul>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={() => setEdit(editing!, { ...editState, items: [...itemsOf(editDish, editState), ["", "1", 0]] })} className={ghost}>Add ingredient</button>
          {editState?.items && editDish.items.length > 0 && <button type="button" onClick={() => setEdit(editing!, { ...editState, items: undefined })} className={link}>Reset to standard</button>}
        </div>
      </div>}
      <button type="button" onClick={() => setEditing(null)} className={`${btn} mt-6`}>Done</button>
    </Modal>}
  </div>;
}
