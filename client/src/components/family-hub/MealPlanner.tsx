// Grocery meal planner (a Plugin Store add-on). Add what you'll buy (1 lb of burger, a bag of chicken) with a
// price estimate, choose how much each person in the family eats, and the planner works out how many meals it
// makes and puts them on the next open days. The goal is to fill every day of the week. Everything also goes
// on the Grocery list with its price, so the week's cost shows up front. Recipes from the Recipe box still work.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Minus, Plus, Search, ShoppingCart, Sparkles, Wand2, X } from "lucide-react";
import { addDaysTo, guessAisle } from "@shared/lifePlugins";
import type { Family, MealSlot } from "@shared/familyHub";
import { MEAL_IDEAS, SERVING_SIZES, defaultServing, dollars, emptyDays, ideaCost, mealsFrom, perMeal, round2, searchPrices, servingWord, type PriceItem } from "@shared/mealPrices";
import { addToGroceries } from "./Recipes";
import { PageHead, Panel, inputClass, plain, primary, soft, type SectionProps } from "./ui";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_NAME: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const EATERS_KEY = "arise-meal-eaters";
const dayName = (d: string, long = false) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, long ? { weekday: "long", month: "short", day: "numeric" } : { weekday: "short" });

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
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const key = (d: string, s: MealSlot) => `${d}|${s}`;
  const mealsAt = (d: string, s: MealSlot) => family.meals.filter((m) => m.date === d && m.slot === s);
  const recipeName = (id: string) => family.recipes.find((r) => r.id === id)?.title || "";

  const week = family.meals.filter((m) => days.includes(m.date));
  const weekCost = round2(week.reduce((a, m) => a + (m.cost || 0), 0));
  const filled = days.filter((d) => mealsAt(d, slot).length).length;
  const open = emptyDays(planDays, slot, family.meals);

  /* ---- adding groceries ---- */
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<PriceItem | null>(null);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [pickSlot, setPickSlot] = useState<MealSlot>("dinner");
  const [mealName, setMealName] = useState("");
  const matches = useMemo(() => searchPrices(query), [query]);
  const choose = (p: PriceItem) => { setPick(p); setQty(1); setPrice(p.price.toFixed(2)); setPickSlot(p.slot); setMealName(""); setQuery(""); };
  const custom = () => { const name = query.trim(); if (!name) return; choose({ id: "custom", name: name.slice(0, 60), unit: "1", price: 0, serves: 4, aisle: guessAisle(name), slot: "dinner", main: true }); };
  const [customServes, setCustomServes] = useState(4);
  const item = pick ? { ...pick, serves: pick.id === "custom" ? customServes : pick.serves } : null;
  const unitPrice = Math.max(0, Number(price) || 0);
  const totalPrice = round2(unitPrice * qty);
  const plan = item ? mealsFrom(item, qty, eaters.servings) : null;
  const targets = item && plan && pickSlot === slot ? open.slice(0, plan.meals) : item && plan ? emptyDays(planDays, pickSlot, family.meals).slice(0, plan.meals) : [];

  const addPick = (e?: FormEvent) => {
    e?.preventDefault();
    if (!item || !plan) return;
    if (eaters.servings <= 0) { say("Pick at least one person who's eating."); return; }
    const title = (mealName.trim() || item.name).slice(0, 120);
    const each = plan.meals ? round2(totalPrice / plan.meals) : totalPrice;
    setFamily((f) => {
      const groceries = [...f.groceries, { id: makeId(), name: item.name, qty: `${qty} × ${item.unit}`.slice(0, 20), aisle: item.aisle || guessAisle(item.name), checked: false, price: totalPrice }];
      const meals = [...f.meals, ...targets.map((d) => ({ id: makeId(), date: d, slot: pickSlot, text: title, recipeId: "", cost: each, serves: eaters.servings }))];
      return { ...f, groceries, meals };
    });
    const where = targets.length ? `on ${targets.map((d) => dayName(d)).join(", ")}` : "";
    say(targets.length ? `${item.name} added to your list and planned ${where}.` : `${item.name} added to your list. No open ${SLOT_NAME[pickSlot].toLowerCase()} days left this week.`);
    setPick(null);
  };

  /* ---- fill the rest of the week with cheap ideas ---- */
  const ideas = useMemo(() => MEAL_IDEAS.map((idea) => ({ idea, ...ideaCost(idea, Math.max(1, eaters.servings)) })).sort((a, b) => a.cost - b.cost), [eaters.servings]);
  const usedTitles = new Set(week.map((m) => m.text));
  const placeIdea = (start: number | null, dates: string[], only?: (typeof ideas)[number]) => {
    const fresh = ideas.filter((x) => !usedTitles.has(x.idea.title)), pool = fresh.length ? fresh : ideas;
    const chosen = dates.map((d, k) => ({ d, x: only ?? pool[((start ?? 0) + k) % pool.length] }));
    setFamily((f) => {
      let next: Family = { ...f, meals: [...f.meals, ...chosen.map(({ d, x }) => ({ id: makeId(), date: d, slot, text: x.idea.title, recipeId: "", cost: x.cost, serves: eaters.servings }))] };
      for (const { x } of chosen) next = { ...next, groceries: [...next.groceries, ...x.lines.filter((l) => !next.groceries.some((g) => !g.checked && g.name.toLowerCase() === l.item.name.toLowerCase())).map((l) => ({ id: makeId(), name: l.item.name, qty: `${l.qty} × ${l.item.unit}`.slice(0, 20), aisle: l.item.aisle, checked: false, price: l.cost }))] };
      return next;
    });
    say(`Planned ${chosen.length} ${chosen.length === 1 ? "meal" : "meals"} and added the groceries to your list.`);
  };

  /* ---- typing a meal or recipe into a day, like before ---- */
  const addTyped = (d: string, s: MealSlot, value: string) => {
    const v = value.trim();
    if (!v) return;
    const recipe = family.recipes.find((r) => r.title.toLowerCase() === v.toLowerCase());
    setFamily((f) => ({ ...f, meals: [...f.meals, { id: makeId(), date: d, slot: s, text: recipe ? "" : v.slice(0, 120), recipeId: recipe?.id || "", serves: eaters.servings }] }));
    setDraft((x) => ({ ...x, [key(d, s)]: "" }));
  };
  const shopRecipes = () => {
    const lines = family.meals.filter((m) => days.includes(m.date) && m.recipeId).flatMap((m) => family.recipes.find((r) => r.id === m.recipeId)?.ingredients ?? []);
    if (!lines.length) { say("Plan a few meals from your Recipe box first. Their ingredients go on the list."); return; }
    let added = 0;
    setFamily((f) => { const out = addToGroceries(f, lines, makeId); added = out.added; return out.family; });
    window.setTimeout(() => say(added ? `Added ${added} item${added === 1 ? "" : "s"} to your Grocery list.` : "Everything's already on your Grocery list."), 0);
  };

  const listCost = round2(family.groceries.filter((g) => !g.checked).reduce((a, g) => a + (g.price || 0), 0));

  return <div className="space-y-6">
    <PageHead eyebrow="Grocery meal planner" title="Fill every day of the week" blurb="Add what you're buying with a price estimate, choose how much each person eats, and the planner puts the meals on open days."
      action={family.recipes.length ? <button type="button" onClick={shopRecipes} className={plain}><ShoppingCart size={16} />Shop recipes</button> : undefined} />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Panel><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{SLOT_NAME[slot]}s planned</p><p className="mt-1 text-2xl font-black">{filled}/7</p>
        <div className="mt-2 flex gap-1">{days.map((d) => <span key={d} title={dayName(d, true)} className={`h-2 flex-1 rounded-full ${mealsAt(d, slot).length ? "bg-emerald-500" : d < today ? "bg-slate-100" : "bg-slate-200"}`} />)}</div></Panel>
      <Panel><p className="text-xs font-bold uppercase tracking-wider text-slate-400">This week</p><p className="mt-1 text-2xl font-black">{dollars(weekCost)}</p><p className="text-xs text-slate-500">about {dollars(weekCost / 7)} a day</p></Panel>
      <Panel><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Grocery list</p><p className="mt-1 text-2xl font-black">{dollars(listCost)}</p><p className="text-xs text-slate-500">{family.groceries.filter((g) => !g.checked).length} items to get</p></Panel>
      <Panel><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Each meal feeds</p><p className="mt-1 text-2xl font-black">{eaters.servings}</p><p className="text-xs text-slate-500">servings</p></Panel>
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Panel title="Add groceries" eyebrow="Step 1">
        {!pick ? <div>
          <form onSubmit={(e) => { e.preventDefault(); if (matches[0]) choose(matches[0]); else custom(); }} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: burger, chicken, pasta…" className={inputClass + " pl-9"} aria-label="Search groceries" />
          </form>
          {query.trim() && <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {matches.map((p) => <li key={p.id}><button type="button" onClick={() => choose(p)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{p.name}</span><span className="text-xs text-slate-500">{p.unit} · serves {p.serves}</span></span>
              <span className="text-sm font-black text-emerald-700">≈ {dollars(p.price)}</span></button></li>)}
            <li><button type="button" onClick={custom} className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-violet-700 hover:bg-violet-50"><Plus size={15} />Add “{query.trim()}” with my own price</button></li>
          </ul>}
          {!query.trim() && <div className="mt-3 flex flex-wrap gap-2">{["beef", "chicken", "eggs", "pasta", "rice", "potatoes", "tortillas", "pizza"].map((id) => { const p = searchPrices(id, 1)[0]; return p ? <button key={id} type="button" onClick={() => choose(p)} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-violet-300">{p.name} <span className="text-emerald-700">{dollars(p.price)}</span></button> : null; })}</div>}
        </div> : <form onSubmit={addPick} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-lg font-black">{pick.name}</p><p className="text-sm text-slate-500">{pick.id === "custom" ? "Your own item" : `${pick.unit} · serves ${pick.serves} · price is an estimate`}</p></div>
            <button type="button" onClick={() => setPick(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Pick something else"><X size={18} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><p className="mb-1 text-xs font-bold text-slate-500">How many ({pick.unit})</p>
              <div className="flex items-center gap-2"><button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className={plain + " px-2"} aria-label="Fewer"><Minus size={15} /></button><span className="w-8 text-center text-lg font-black">{qty}</span><button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className={plain + " px-2"} aria-label="More"><Plus size={15} /></button></div></div>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Price each ($)</span><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))} inputMode="decimal" className={inputClass} /></label>
            {pick.id === "custom" ? <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Servings in one</span><input type="number" min={1} max={40} value={customServes} onChange={(e) => setCustomServes(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className={inputClass} /></label>
              : <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Meal</span><select value={pickSlot} onChange={(e) => setPickSlot(e.target.value as MealSlot)} className={inputClass}>{SLOTS.map((s) => <option key={s} value={s}>{SLOT_NAME[s]}</option>)}</select></label>}
          </div>
          <Servings family={family} eaters={eaters} />
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Call the meal (optional)</span><input value={mealName} onChange={(e) => setMealName(e.target.value)} maxLength={120} placeholder={`e.g. Burgers and fries`} className={inputClass} /></label>
          {plan && <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950">
            <p><b>{qty} × {pick.unit}</b> ≈ <b>{dollars(totalPrice)}</b> makes <b>{plan.total} servings</b>. Your family eats <b>{eaters.servings}</b> a meal, so that's <b>{plan.meals} {plan.meals === 1 ? "meal" : "meals"}</b>{plan.meals ? ` at about ${dollars(totalPrice / plan.meals)} each` : ""}.</p>
            {plan.short > 0 && <p className="mt-1 text-amber-800">That's {plan.short} servings short of a full meal. Try {Math.ceil((eaters.servings) / item!.serves)} or add a side.</p>}
            {plan.left > 0 && <p className="mt-1 text-emerald-800">{plan.left} servings left over for lunch.</p>}
            <p className="mt-1">{targets.length ? <>Goes on <b>{targets.map((d) => dayName(d)).join(", ")}</b> ({SLOT_NAME[pickSlot].toLowerCase()}).</> : `Every ${SLOT_NAME[pickSlot].toLowerCase()} this week is already planned, so it just goes on the Grocery list.`}</p>
          </div>}
          <button type="submit" className={primary + " w-full sm:w-auto"}><CalendarCheck size={16} />{targets.length ? `Add and plan ${targets.length} ${targets.length === 1 ? "day" : "days"}` : "Add to the list"}</button>
        </form>}
      </Panel>

      <Panel title={open.length ? `${open.length} open ${open.length === 1 ? "day" : "days"} left` : "Week filled!"} eyebrow="Step 2 · Fill the rest"
        right={<select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold" aria-label="Meal to plan">{SLOTS.map((s) => <option key={s} value={s}>{SLOT_NAME[s]}</option>)}</select>}>
        {slot !== "dinner" ? <p className="text-sm text-slate-500">Add breakfast or lunch groceries on the left and they fill these days. Meal ideas are for dinners.</p>
          : open.length ? <>
            <button type="button" onClick={() => placeIdea(0, open)} className={soft + " mb-3 w-full"}><Wand2 size={16} />Fill all {open.length} with cheap dinners</button>
            <ul className="space-y-2">{ideas.slice(0, 6).map((x) => <li key={x.idea.title} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
              <Sparkles size={16} className="shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{x.idea.title}</p><p className="truncate text-xs text-slate-500">{x.lines.map((l) => l.item.name).join(", ")}</p></div>
              <span className="shrink-0 text-sm font-black text-emerald-700">≈ {dollars(x.cost)}</span>
              <button type="button" onClick={() => placeIdea(null, [open[0]], x)} className={plain + " shrink-0"}>{dayName(open[0])}</button>
            </li>)}</ul></>
          : <p className="text-sm text-slate-500">Every {SLOT_NAME[slot].toLowerCase()} from today through Sunday is planned. Nice!</p>}
      </Panel>
    </div>

    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setStart(addDaysTo(start, -7))} className={plain + " px-2"} aria-label="Last week"><ChevronLeft size={17} /></button>
      <p className="min-w-0 flex-1 text-center text-sm font-black">{new Date(`${days[0]}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {new Date(`${days[6]}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
      {start !== monday && <button type="button" onClick={() => setStart(monday)} className={plain}>This week</button>}
      <button type="button" onClick={() => setStart(addDaysTo(start, 7))} className={plain + " px-2"} aria-label="Next week"><ChevronRight size={17} /></button>
    </div>
    <datalist id="meal-recipes">{family.recipes.map((r) => <option key={r.id} value={r.title} />)}</datalist>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{days.map((d) => {
      const cost = round2(family.meals.filter((m) => m.date === d).reduce((a, m) => a + (m.cost || 0), 0));
      return <Panel key={d} className={d === today ? "ring-2 ring-violet-300" : !mealsAt(d, slot).length && d >= today ? "border-dashed" : ""}>
        <div className="mb-3 flex items-baseline justify-between gap-2"><p className="text-sm font-black">{dayName(d, true)}{d === today && <span className="ml-2 text-xs text-violet-600">Today</span>}</p>{cost > 0 && <span className="text-xs font-bold text-emerald-700">{dollars(cost)}</span>}</div>
        <div className="space-y-3">{SLOTS.map((s) => <div key={s}>
          <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-400">{s}</p>
          {mealsAt(d, s).map((m) => <p key={m.id} className="mt-1 flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-sm font-bold text-orange-900"><span className="min-w-0 flex-1 truncate">{m.recipeId ? `🍳 ${recipeName(m.recipeId) || "(deleted recipe)"}` : m.text}</span>
            {!!m.cost && <span className="shrink-0 text-xs font-semibold text-orange-700">{dollars(m.cost)}</span>}
            <button type="button" onClick={() => setFamily((f) => ({ ...f, meals: f.meals.filter((x) => x.id !== m.id) }))} className="rounded p-0.5 text-orange-400 hover:text-rose-600" aria-label="Remove"><X size={13} /></button></p>)}
          <form onSubmit={(e) => { e.preventDefault(); addTyped(d, s, draft[key(d, s)] || ""); }}><input list="meal-recipes" value={draft[key(d, s)] || ""} onChange={(e) => setDraft((x) => ({ ...x, [key(d, s)]: e.target.value }))} onBlur={(e) => addTyped(d, s, e.target.value)} maxLength={120} placeholder="+ Add" className="mt-1 w-full rounded-lg border border-dashed border-slate-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-violet-300" aria-label={`${s} on ${d}`} /></form>
        </div>)}</div>
      </Panel>; })}</div>
    <p className="text-xs text-slate-500">Prices are rough store averages to plan with. Change any price when you add it.</p>
  </div>;
}

/** Who's eating and how much: a serving size for each family member (or a head count with no members yet). */
function Servings({ family, eaters }: { family: Family; eaters: ReturnType<typeof useEaters> }) {
  if (!family.members.length) return <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">How many people are eating?</span>
    <select value={eaters.people} onChange={(e) => eaters.set("__people", Number(e.target.value))} className={inputClass}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>;
  return <div><p className="mb-1 text-xs font-bold text-slate-500">Serving size for each person</p>
    <ul className="grid gap-2 sm:grid-cols-2">{family.members.map((m, i) => <li key={m.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5">
      <span className="text-lg" aria-hidden>{m.emoji}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.name}</span>
      <select value={eaters.sizes[i]} onChange={(e) => eaters.set(m.id, Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs" aria-label={`Serving size for ${m.name}`}>{SERVING_SIZES.map((n) => <option key={n} value={n}>{servingWord(n)}</option>)}</select>
    </li>)}</ul></div>;
}
