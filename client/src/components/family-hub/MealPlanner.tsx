// Meal planner (a Plugin Store add-on), kept simple: one list of the week's days. Tap + on a day to
// add a meal (type it, pick a recipe, or tap a cheap idea), or let the planner fill every open dinner
// at once. Planned ideas put their groceries on the Grocery list with a price, so the week's cost
// shows at the top. The budget tool (plan meals from what you're buying) sits folded away below.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarCheck, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Search, ShoppingCart, Wand2, X } from "lucide-react";
import { addDaysTo, guessAisle } from "@shared/lifePlugins";
import type { Family, MealSlot } from "@shared/familyHub";
import { MEAL_IDEAS, SERVING_SIZES, defaultServing, dollars, emptyDays, ideaCost, mealsFrom, perMeal, round2, searchPrices, servingWord, type PriceItem } from "@shared/mealPrices";
import { addToGroceries } from "./Recipes";
import { PageHead, Panel, inputClass, plain, primary, soft, type SectionProps } from "./ui";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_NAME: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const SLOT_EMOJI: Record<MealSlot, string> = { breakfast: "🥣", lunch: "🥪", dinner: "🍽️" };
const EATERS_KEY = "arise-meal-eaters";
const at = (d: string) => new Date(`${d}T12:00:00`);
const dayName = (d: string) => at(d).toLocaleDateString(undefined, { weekday: "short" });
const monthDay = (d: string) => at(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Each person's serving size, remembered on this device. With no family members yet, a head count. */
function useEaters(family: Family) {
  const [saved, setSaved] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem(EATERS_KEY) || "{}"); } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem(EATERS_KEY, JSON.stringify(saved)); } catch { /* not kept */ } }, [saved]);
  const sizes = family.members.map((m) => (typeof saved[m.id] === "number" ? saved[m.id] : defaultServing(m.kind)));
  const people = typeof saved.__people === "number" ? saved.__people : 2;
  const servings = family.members.length ? perMeal(sizes) : people;
  return { sizes, people, servings, set: (key: string, v: number) => setSaved((s) => ({ ...s, [key]: v })) };
}

export default function MealPlanner({ family, setFamily, today, makeId, say }: SectionProps) {
  const monday = (() => { const d = new Date(`${today}T12:00:00Z`).getUTCDay(); return addDaysTo(today, -((d + 6) % 7)); })();
  const [start, setStart] = useState(monday);
  const days = Array.from({ length: 7 }, (_, i) => addDaysTo(start, i));
  const planDays = days.filter((d) => d >= today);
  const eaters = useEaters(family);
  const mealsOn = (d: string) => family.meals.filter((m) => m.date === d).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
  const recipeName = (id: string) => family.recipes.find((r) => r.id === id)?.title || "";

  const week = family.meals.filter((m) => days.includes(m.date));
  const weekCost = round2(week.reduce((a, m) => a + (m.cost || 0), 0));
  const dinners = days.filter((d) => family.meals.some((m) => m.date === d && m.slot === "dinner")).length;
  const openDinners = emptyDays(planDays, "dinner", family.meals);

  /* ---- cheap dinner ideas ---- */
  const ideas = useMemo(() => MEAL_IDEAS.map((idea) => ({ idea, ...ideaCost(idea, Math.max(1, eaters.servings)) })).sort((a, b) => a.cost - b.cost), [eaters.servings]);
  const usedTitles = new Set(week.map((m) => m.text));
  const fresh = ideas.filter((x) => !usedTitles.has(x.idea.title));
  const pool = fresh.length ? fresh : ideas;
  const fillCost = round2(openDinners.reduce((a, _, k) => a + pool[k % pool.length].cost, 0));
  const placeIdeas = (chosen: { d: string; s: MealSlot; x: (typeof ideas)[number] }[]) => {
    setFamily((f) => {
      let next: Family = { ...f, meals: [...f.meals, ...chosen.map(({ d, s, x }) => ({ id: makeId(), date: d, slot: s, text: x.idea.title, recipeId: "", cost: x.cost, serves: eaters.servings }))] };
      for (const { x } of chosen) next = { ...next, groceries: [...next.groceries, ...x.lines.filter((l) => !next.groceries.some((g) => !g.checked && g.name.toLowerCase() === l.item.name.toLowerCase())).map((l) => ({ id: makeId(), name: l.item.name, qty: `${l.qty} × ${l.item.unit}`.slice(0, 20), aisle: l.item.aisle, checked: false, price: l.cost }))] };
      return next;
    });
  };
  const fillWeek = () => {
    placeIdeas(openDinners.map((d, k) => ({ d, s: "dinner" as MealSlot, x: pool[k % pool.length] })));
    say(`Planned ${openDinners.length} ${openDinners.length === 1 ? "dinner" : "dinners"} and added the groceries to your list.`);
  };

  /* ---- adding to one day ---- */
  const [open, setOpen] = useState<string | null>(null);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [text, setText] = useState("");
  const openDay = (d: string) => { setOpen(open === d ? null : d); setText(""); setSlot(family.meals.some((m) => m.date === d && m.slot === "dinner") ? "lunch" : "dinner"); };
  const addTyped = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim(); if (!v || !open) return;
    const recipe = family.recipes.find((r) => r.title.toLowerCase() === v.toLowerCase());
    setFamily((f) => ({ ...f, meals: [...f.meals, { id: makeId(), date: open, slot, text: recipe ? "" : v.slice(0, 120), recipeId: recipe?.id || "", serves: eaters.servings }] }));
    setText(""); setOpen(null);
  };
  const addIdea = (x: (typeof ideas)[number]) => {
    if (!open) return;
    placeIdeas([{ d: open, s: slot, x }]);
    say(`${x.idea.title} planned for ${dayName(open)}. Groceries are on your list.`);
    setOpen(null);
  };

  const shopRecipes = () => {
    const lines = family.meals.filter((m) => days.includes(m.date) && m.recipeId).flatMap((m) => family.recipes.find((r) => r.id === m.recipeId)?.ingredients ?? []);
    if (!lines.length) { say("Plan a few meals from your Recipe box first. Their ingredients go on the list."); return; }
    let added = 0;
    setFamily((f) => { const out = addToGroceries(f, lines, makeId); added = out.added; return out.family; });
    window.setTimeout(() => say(added ? `Added ${added} item${added === 1 ? "" : "s"} to your Grocery list.` : "Everything's already on your Grocery list."), 0);
  };

  return <div className="space-y-5">
    <PageHead eyebrow="Meal planner" title="This week's meals" blurb="Tap + on a day to add a meal, or fill every open dinner in one tap. Groceries go on your list."
      action={family.recipes.length ? <button type="button" onClick={shopRecipes} className={plain}><ShoppingCart size={16} />Shop recipes</button> : undefined} />

    <Panel>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setStart(addDaysTo(start, -7))} className={plain + " px-2"} aria-label="Last week"><ChevronLeft size={17} /></button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-black text-slate-900">{monthDay(days[0])} – {monthDay(days[6])}</p>
          {start !== monday && <button type="button" onClick={() => setStart(monday)} className="text-xs font-semibold text-violet-700 hover:underline">Back to this week</button>}
        </div>
        <button type="button" onClick={() => setStart(addDaysTo(start, 7))} className={plain + " px-2"} aria-label="Next week"><ChevronRight size={17} /></button>
      </div>
      <div className="mt-4 flex gap-1" aria-hidden>{days.map((d) => <span key={d} className={`h-2 flex-1 rounded-full ${family.meals.some((m) => m.date === d && m.slot === "dinner") ? "bg-emerald-500" : d < today ? "bg-slate-100" : "bg-slate-200"}`} />)}</div>
      <p className="mt-2 text-sm text-slate-600"><b className="text-slate-900">{dinners} of 7</b> dinners planned{weekCost > 0 && <> · about <b className="text-slate-900">{dollars(weekCost)}</b> this week</>}</p>
      {openDinners.length > 0
        ? <><button type="button" onClick={fillWeek} className={primary + " mt-4 w-full"}><Wand2 size={16} className="shrink-0" />Fill {openDinners.length} open {openDinners.length === 1 ? "dinner" : "dinners"}</button><p className="mt-1.5 text-center text-xs text-slate-500">Cheap family dinners, about {dollars(fillCost)} in groceries</p></>
        : planDays.length > 0 && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Every dinner left this week is planned. Nice!</p>}
    </Panel>

    <datalist id="meal-recipes">{family.recipes.map((r) => <option key={r.id} value={r.title} />)}</datalist>
    <ul className="space-y-2">{days.map((d) => {
      const meals = mealsOn(d), past = d < today, isOpen = open === d;
      return <li key={d} className={`rounded-2xl border bg-white ${d === today ? "border-violet-300 ring-1 ring-violet-200" : "border-slate-200"} ${past && !meals.length ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3 p-3">
          <div className={`flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 ${d === today ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            <span className="text-[11px] font-bold uppercase">{dayName(d)}</span><span className="text-lg font-black leading-none">{at(d).getDate()}</span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            {meals.length ? meals.map((m) => <div key={m.id} className="flex items-start gap-2">
              <span aria-hidden className="pt-0.5">{SLOT_EMOJI[m.slot]}</span>
              <p className="min-w-0 flex-1 text-sm leading-snug"><span className="font-bold text-slate-900">{m.recipeId ? recipeName(m.recipeId) || "(deleted recipe)" : m.text}</span>{m.slot !== "dinner" && <span className="text-slate-500"> · {SLOT_NAME[m.slot].toLowerCase()}</span>}{!!m.cost && <span className="text-emerald-700"> · {dollars(m.cost)}</span>}</p>
              <button type="button" onClick={() => setFamily((f) => ({ ...f, meals: f.meals.filter((x) => x.id !== m.id) }))} className="-m-1 shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${m.text || "meal"}`}><X size={15} /></button>
            </div>) : <p className="pt-1.5 text-sm text-slate-400">{past ? "Nothing planned" : "No meals yet"}</p>}
          </div>
          <button type="button" onClick={() => openDay(d)} aria-expanded={isOpen} aria-label={`Add a meal on ${dayName(d)}`} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isOpen ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100"}`}>{isOpen ? <X size={18} /> : <Plus size={18} />}</button>
        </div>
        {isOpen && <div className="border-t border-slate-100 p-3">
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Which meal">{SLOTS.map((s) => <button key={s} type="button" onClick={() => setSlot(s)} aria-pressed={slot === s} className={`min-h-9 rounded-lg text-sm font-bold transition ${slot === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{SLOT_NAME[s]}</button>)}</div>
          <form onSubmit={addTyped} className="flex gap-2">
            <input autoFocus list="meal-recipes" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder={family.recipes.length ? "Type a meal or a recipe" : "Type a meal, e.g. Chicken and rice"} className={inputClass + " min-w-0 flex-1"} aria-label={`${SLOT_NAME[slot]} on ${dayName(d)}`} />
            <button type="submit" disabled={!text.trim()} className={primary + " shrink-0"}>Add</button>
          </form>
          {slot === "dinner" && <>
            <p className="mb-1.5 mt-3 text-xs font-bold text-slate-500">Or pick a cheap idea (groceries go on your list)</p>
            <div className="flex flex-wrap gap-1.5">{pool.slice(0, 6).map((x) => <button key={x.idea.title} type="button" onClick={() => addIdea(x)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-sm font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50">{x.idea.title} <span className="text-emerald-700">{dollars(x.cost)}</span></button>)}</div>
          </>}
        </div>}
      </li>;
    })}</ul>

    <BudgetPlanner family={family} setFamily={setFamily} today={today} makeId={makeId} say={say} planDays={planDays} eaters={eaters} />
  </div>;
}

/** Folded away: add what you're buying with a price, and it works out how many dinners that makes. */
function BudgetPlanner({ family, setFamily, makeId, say, planDays, eaters }: Pick<SectionProps, "family" | "setFamily" | "makeId" | "say" | "today"> & { planDays: string[]; eaters: ReturnType<typeof useEaters> }) {
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<PriceItem | null>(null);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [pickSlot, setPickSlot] = useState<MealSlot>("dinner");
  const [customServes, setCustomServes] = useState(4);
  const matches = useMemo(() => searchPrices(query), [query]);
  const choose = (p: PriceItem) => { setPick(p); setQty(1); setPrice(p.price.toFixed(2)); setPickSlot(p.slot); setQuery(""); };
  const custom = () => { const name = query.trim(); if (!name) return; choose({ id: "custom", name: name.slice(0, 60), unit: "1", price: 0, serves: 4, aisle: guessAisle(name), slot: "dinner", main: true }); };
  const item = pick ? { ...pick, serves: pick.id === "custom" ? customServes : pick.serves } : null;
  const totalPrice = round2(Math.max(0, Number(price) || 0) * qty);
  const plan = item ? mealsFrom(item, qty, eaters.servings) : null;
  const targets = item && plan ? emptyDays(planDays, pickSlot, family.meals).slice(0, plan.meals) : [];
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!item || !plan) return;
    const each = plan.meals ? round2(totalPrice / plan.meals) : totalPrice;
    setFamily((f) => ({ ...f, groceries: [...f.groceries, { id: makeId(), name: item.name, qty: `${qty} × ${item.unit}`.slice(0, 20), aisle: item.aisle || guessAisle(item.name), checked: false, price: totalPrice }],
      meals: [...f.meals, ...targets.map((d) => ({ id: makeId(), date: d, slot: pickSlot, text: item.name, recipeId: "", cost: each, serves: eaters.servings }))] }));
    say(targets.length ? `${item.name} added to your list and planned on ${targets.map(dayName).join(", ")}.` : `${item.name} added to your list.`);
    setPick(null);
  };
  return <details className="group rounded-2xl border border-slate-200 bg-white">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
      <span aria-hidden>💰</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">Plan on a budget</span><span className="block text-xs text-slate-500">Add what you're buying and see how many meals it makes · feeds {eaters.servings}</span></span>
      <ChevronDown size={16} className="shrink-0 text-slate-400 transition group-open:rotate-180" />
    </summary>
    <div className="space-y-4 border-t border-slate-100 p-4">
      <Servings family={family} eaters={eaters} />
      {!pick ? <div>
        <form onSubmit={(e) => { e.preventDefault(); if (matches[0]) choose(matches[0]); else custom(); }} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What are you buying? burger, chicken…" className={inputClass + " pl-9"} aria-label="Search groceries" />
        </form>
        {query.trim() ? <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {matches.map((p) => <li key={p.id}><button type="button" onClick={() => choose(p)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{p.name}</span><span className="text-xs text-slate-500">{p.unit} · serves {p.serves}</span></span>
            <span className="shrink-0 text-sm font-black text-emerald-700">≈ {dollars(p.price)}</span></button></li>)}
          <li><button type="button" onClick={custom} className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-violet-700 hover:bg-violet-50"><Plus size={15} className="shrink-0" />Add “{query.trim()}” with my own price</button></li>
        </ul> : <div className="mt-3 flex flex-wrap gap-2">{["beef", "chicken", "eggs", "pasta", "rice", "potatoes"].map((id) => { const p = searchPrices(id, 1)[0]; return p ? <button key={id} type="button" onClick={() => choose(p)} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-violet-300">{p.name} <span className="text-emerald-700">{dollars(p.price)}</span></button> : null; })}</div>}
      </div> : <form onSubmit={add} className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-lg font-black text-slate-900">{pick.name}</p><p className="text-sm text-slate-500">{pick.id === "custom" ? "Your own item" : `${pick.unit} · price is an estimate`}</p></div>
          <button type="button" onClick={() => setPick(null)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Pick something else"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="mb-1 text-xs font-bold text-slate-500">How many</p>
            <div className="flex items-center gap-2"><button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className={plain + " px-2"} aria-label="Fewer"><Minus size={15} /></button><span className="w-8 text-center text-lg font-black">{qty}</span><button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className={plain + " px-2"} aria-label="More"><Plus size={15} /></button></div></div>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Price each ($)</span><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))} inputMode="decimal" className={inputClass} /></label>
          {pick.id === "custom" && <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Servings in one</span><input type="number" min={1} max={40} value={customServes} onChange={(e) => setCustomServes(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className={inputClass} /></label>}
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">For</span><select value={pickSlot} onChange={(e) => setPickSlot(e.target.value as MealSlot)} className={inputClass}>{SLOTS.map((s) => <option key={s} value={s}>{SLOT_NAME[s]}</option>)}</select></label>
        </div>
        {plan && <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950">≈ <b>{dollars(totalPrice)}</b> makes <b>{plan.meals} {plan.meals === 1 ? "meal" : "meals"}</b> for your family{plan.meals ? ` (about ${dollars(totalPrice / plan.meals)} each)` : ""}.{targets.length ? <> Goes on <b>{targets.map(dayName).join(", ")}</b>.</> : " Those days are already planned, so it just goes on the Grocery list."}</p>}
        <button type="submit" className={soft + " w-full"}><CalendarCheck size={16} />{targets.length ? `Add and plan ${targets.length} ${targets.length === 1 ? "day" : "days"}` : "Add to the list"}</button>
      </form>}
    </div>
  </details>;
}

/** Who's eating and how much: a serving size for each family member (or a head count with no members yet). */
function Servings({ family, eaters }: { family: Family; eaters: ReturnType<typeof useEaters> }) {
  if (!family.members.length) return <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">How many people are eating?</span>
    <select value={eaters.people} onChange={(e) => eaters.set("__people", Number(e.target.value))} className={inputClass}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>;
  return <div><p className="mb-1 text-xs font-bold text-slate-500">How much each person eats</p>
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">{family.members.map((m, i) => <li key={m.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5">
      <span className="text-lg" aria-hidden>{m.emoji}</span><span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{m.name}</span>
      <select value={eaters.sizes[i]} onChange={(e) => eaters.set(m.id, Number(e.target.value))} className="shrink-0 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs" aria-label={`Serving size for ${m.name}`}>{SERVING_SIZES.map((n) => <option key={n} value={n}>{servingWord(n)}</option>)}</select>
    </li>)}</ul></div>;
}
