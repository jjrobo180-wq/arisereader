// Kitchen > Plan (November 2026). Who's eating, what each person eats each day, and one exact grocery list:
// real products and package sizes, how much is left over, ways to share and save. Saved with the family, so
// everyone in the family sees the same plan. The math lives in shared/kitchen.ts.
import { useEffect, useMemo, useState } from "react";
import { useUpPast, planToList, DAY_LABEL, K_SLOTS, PLAN_LENGTHS, PORTIONS, WEEK, addDays, amountText, buyText, cell, clearMeals, countMeals, dateOf, dishName, dishOf, duplicateCount, emptyKitchen, foodCount, hiddenMeals, mondayOf, money, moveMeal, nWeeks, parseCell, peopleIn, planStart, removeDuplicates, removeMeal, SKIP, setStock, stockUp, takeoutOf, tips, totals, useUp, type KDay, type Kitchen, type KMeal, type KSlot } from "@shared/kitchen";
import { useAuth } from "@/context/AuthContext";
import { findStores, storePrices, storeStatus, type StoreLocation } from "@/lib/kitchenStore";
import { guessAisle } from "@shared/lifePlugins";
import { Modal, type SectionProps } from "./ui";
import DishEditor from "./kitchen/DishEditor";
import ClearMeals from "./kitchen/ClearMeals";
import DaySheet from "./kitchen/DaySheet";
import PlanCalendar, { DatePick, fmtDate, fmtRange, fmtShort } from "./kitchen/PlanCalendar";
import PlanProgress from "./kitchen/PlanProgress";
import Inventory from "./kitchen/Inventory";
import WeekPlanner from "./kitchen/WeekPlanner";
import ProductChooser from "./kitchen/ProductChooser";
import { Card, Segmented, btn, chip, field, ghost, label, link } from "./kitchen/kit";

type View = "week" | "groceries" | "inventory" | "people";
/** What one bulk change replaced, so it can be put back. */
type Undo = { text: string; week: Kitchen["week"]; stock: Kitchen["stock"] };
const LAYOUT_KEY = "arise-kitchen-layout";
/** A small, clearly tappable button on a list row. */
const rowBtn = "inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900";
const SLOT_ONE: Record<KSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", dessert: "Dessert" };

export default function KitchenPlan({ family, setFamily, makeId, say, today }: SectionProps) {
  const { token } = useAuth();
  const k: Kitchen = family.kitchen ?? emptyKitchen();
  const setK = (fn: (k: Kitchen) => Kitchen) => setFamily((f) => ({ ...f, kitchen: fn(f.kitchen ?? emptyKitchen()) }));
  const [view, setView] = useState<View>("week");
  const [planner, setPlanner] = useState<{ day: KDay; wk: number } | null>(null);
  const [dayOpen, setDayOpen] = useState<{ day: KDay; wk: number } | null>(null);
  const [wk, setWk] = useState(0);
  const [layout, setLayoutState] = useState<"list" | "calendar">(() => { try { return localStorage.getItem(LAYOUT_KEY) === "calendar" ? "calendar" : "list"; } catch { return "list"; } });
  const setLayout = (v: "list" | "calendar") => { setLayoutState(v); try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* not kept */ } };
  const [clearing, setClearing] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [product, setProduct] = useState<string | null>(null);
  const [meal, setMeal] = useState<{ key: string; meal: KMeal } | null>(null);
  const [connected, setConnected] = useState(false);
  const [allTips, setAllTips] = useState(false);
  useEffect(() => { void storeStatus(token).then(setConnected); }, [token]);

  // Days that went by used up their meals' food, so the list and inventory never think eaten food is still at home.
  useEffect(() => { const next = useUpPast(k, today); if (next !== k && (next.usedThrough !== k.usedThrough || JSON.stringify(next.stock) !== JSON.stringify(k.stock))) setK(() => next); }, [today, k.usedThrough, k.start, k.weeks]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = useMemo(() => totals(useUpPast(k, today)), [k, today]);
  const ideas = useMemo(() => tips(k), [k]);
  const lineNeed = (group: string) => t.lines.find((l) => l.group.id === group)?.need ?? 0;

  // A bulk change: save what it replaces, make it, and offer Undo.
  const change = (text: string, fn: (k: Kitchen) => Kitchen) => { setUndo({ text, week: k.week, stock: k.stock }); setK(fn); };
  const undoIt = () => { if (!undo) return; const u = undo; setK((x) => ({ ...x, week: u.week, stock: u.stock })); setUndo(null); say("Put back."); };
  const dupes = duplicateCount(k);
  const n = nWeeks(k);
  const curWk = Math.min(wk, n - 1);
  const start = planStart(k, today);
  const moveTo = (fromKey: string, id: string, toKey: string, copy: boolean) => change(copy ? "Copied the meal." : "Moved the meal.", (x) => moveMeal(x, fromKey, id, toKey, copy, makeId()));
  // A longer plan pins its first Monday, so the dates stay put. Meals in weeks past the new length are kept, just hidden.
  const setLength = (w: number) => { setWk(0); setK((x) => ({ ...x, weeks: w, start: w > 1 ? x.start || mondayOf(today) : x.start })); };
  const shiftStart = (days: number) => setK((x) => ({ ...x, start: addDays(planStart(x, today), days) }));

  if (!k.setup) return <Setup k={k} setK={setK} family={family} connected={connected} token={token} makeId={makeId} />;

  const planned = foodCount(k.week, n);
  return <div className="w-full max-w-3xl space-y-6" data-testid="kitchen-plan">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className={label}>{PLAN_LENGTHS.find((x) => x.weeks === n)?.this ?? "This week"}</p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums text-slate-900" data-testid="plan-total">{money(t.total)}</p>
        <p className="mt-1 text-sm text-slate-500">{money(t.groceries)} groceries{t.takeout ? ` · ${money(t.takeout)} takeout` : ""}</p>
      </div>
      {k.people.length > 1 && <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{k.people.map((p) => <span key={p.id} className="text-slate-500">{p.name} <span className="font-semibold tabular-nums text-slate-900">{money(t.share[p.id] ?? 0)}</span></span>)}</div>}
    </div>
    {undo && <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" role="status" data-testid="undo-bar">
      <span className="min-w-0">{undo.text}</span>
      <span className="flex shrink-0 items-center gap-3"><button type="button" onClick={undoIt} className="font-semibold underline underline-offset-4" data-testid="undo">Undo</button><button type="button" onClick={() => setUndo(null)} aria-label="Dismiss" className="text-white/60 hover:text-white">&times;</button></span>
    </div>}
    <Segmented label="Kitchen plan" value={view} onChange={setView} options={[{ id: "week", label: "Plan" }, { id: "groceries", label: `Groceries${t.lines.filter((l) => !l.have).length ? ` (${t.lines.filter((l) => !l.have).length})` : ""}` }, { id: "inventory", label: "Inventory" }, { id: "people", label: "People" }]} />

    {view === "week" && <>
      <div className="space-y-3" data-testid="plan-controls">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[15rem] flex-1"><Segmented label="Plan length" value={String(n)} onChange={(v) => setLength(Number(v))} options={PLAN_LENGTHS.map((x) => ({ id: String(x.weeks), label: x.label }))} /></div>
          <div className="w-44 shrink-0"><Segmented label="Plan view" value={layout} onChange={setLayout} options={[{ id: "list", label: "List" }, { id: "calendar", label: "Calendar" }]} /></div>
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => shiftStart(-7)} aria-label="Earlier dates" className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-500 hover:bg-slate-100">&lsaquo;</button>
            <span className="text-sm font-medium text-slate-900" data-testid="plan-range">{fmtRange(start, n)}</span>
            <button type="button" onClick={() => shiftStart(7)} aria-label="Later dates" className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-500 hover:bg-slate-100">&rsaquo;</button>
          </span>
          {k.start && k.start !== mondayOf(today) && <button type="button" onClick={() => setK((x) => ({ ...x, start: "" }))} className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900">Back to this week</button>}
        </div>
        {hiddenMeals(k) > 0 && <p className="px-1 text-xs text-slate-400">{hiddenMeals(k)} meal{hiddenMeals(k) === 1 ? " is" : "s are"} in later weeks, kept but hidden. Pick a longer plan to see {hiddenMeals(k) === 1 ? "it" : "them"}.</p>}
      </div>
      {ideas.length > 0 && <section className="space-y-2" aria-label="Ways to save">
        <p className={label}>Ways to save</p>
        {(allTips ? ideas : ideas.slice(0, 2)).map((x) => <Card key={x.id} className="p-4">
          <p className="text-sm leading-relaxed text-slate-700">{x.text}</p>
          {x.kind === "bulk" && <button type="button" onClick={() => setK((y) => { const choice = { ...y.choice }; if (x.product) choice[x.group] = x.product; else delete choice[x.group]; return { ...y, choice }; })} className={`${link} mt-2`}>{x.button}</button>}
          {x.kind === "leftover" && <button type="button" onClick={() => { setK((y) => ({ ...y, week: { ...y.week, [cell(x.day, x.slot)]: [...(y.week[cell(x.day, x.slot)] ?? []), { id: makeId(), dish: x.dish, people: x.people }] } })); say("Added."); }} className={`${link} mt-2`}>{x.button}</button>}
        </Card>)}
        {ideas.length > 2 && <button type="button" onClick={() => setAllTips((v) => !v)} className={link}>{allTips ? "Show fewer" : `${ideas.length - 2} more way${ideas.length - 2 === 1 ? "" : "s"} to save`}</button>}
      </section>}
      <Card className="p-3"><p className={`${label} mb-1 px-1`}>Planned so far</p><PlanProgress people={k.people} week={k.week} weeks={n} />
        <p className="px-1 pt-1 text-[11px] text-slate-400">Breakfast, lunch and dinner on every day of the plan. Each person can have their own menu: tap Plan the week and pick a name.</p></Card>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPlanner({ day: "mon", wk: curWk })} className={`${btn} flex-1`} data-testid="plan-week">{n === 1 ? (planned ? "Edit the week" : "Plan the week") : planned ? "Edit the plan" : "Plan the weeks"}</button>
        {planned > 0 && <button type="button" onClick={() => setClearing(true)} className={ghost} data-testid="clear-meals">Clear meals</button>}
      </div>
      {dupes > 0 && <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4" data-testid="dupes-banner">
        <p className="min-w-0 flex-1 text-sm text-amber-950"><span className="font-semibold">{dupes} meal{dupes === 1 ? " was" : "s were"} added twice.</span> The same dish in the same meal more than once.</p>
        <button type="button" onClick={() => { change(`Removed ${dupes} extra meal${dupes === 1 ? "" : "s"}.`, removeDuplicates); }} className={ghost}>Remove extras</button>
      </Card>}
      {planned === 0 && <Card className="p-6 text-center"><p className="text-sm text-slate-500">Nothing planned yet. Tap the button above to set breakfast, lunch and dinner for every day in one place.</p></Card>}
      {layout === "calendar" ? <div className="space-y-3">
        <PlanCalendar k={k} start={start} today={today} onDay={(day, w) => setDayOpen({ day, wk: w })} onMove={moveTo} />
        <p className="px-1 text-xs text-slate-500">Tap a day to see or add its meals. On a computer or iPad, drag a meal onto another day to move it (hold Alt or Option to copy).</p>
      </div> : <div className="space-y-3">
        {n > 1 && <div className="space-y-1.5"><Segmented label="Week" value={String(curWk)} onChange={(v) => setWk(Number(v))} options={Array.from({ length: n }, (_, i) => ({ id: String(i), label: `Week ${i + 1}` }))} />
          <p className="px-1 text-xs text-slate-500">{fmtRange(addDays(start, curWk * 7), 1)}</p></div>}
        {WEEK.map((day) => { const meals = K_SLOTS.flatMap((s) => (k.week[cell(day, s.id, curWk)] ?? []).map((m) => ({ slot: s, m }))); return <Card key={day} className="p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold text-slate-900">{DAY_LABEL[day]} <span className="ml-1 text-sm font-normal text-slate-400">{fmtShort(dateOf(start, curWk, day))}</span></h3>
            <span className="flex items-center gap-4">{meals.length > 1 && <button type="button" onClick={() => change(`Cleared ${DAY_LABEL[day]}.`, (x) => clearMeals(x, { days: [day], wks: [curWk] }))} className="text-xs font-medium text-slate-400 hover:text-rose-600">Clear day</button>}
              <button type="button" onClick={() => setPlanner({ day, wk: curWk })} className={link}>{meals.length ? "Edit" : "Add meals"}</button></span></div>
          {meals.length > 0 && <ul className="mt-2 divide-y divide-slate-100">{meals.map(({ slot, m }) => { const d = dishOf(k, m.dish); const who = peopleIn(k, m); const out = takeoutOf(k, m.dish); return <li key={m.id}>
            <button type="button" onClick={() => setMeal({ key: cell(day, slot.id, curWk), meal: m })} className="flex w-full items-center gap-3 py-2.5 text-left">
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">{SLOT_ONE[slot.id]}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium text-slate-900">{dishName(k, m.dish)}</span>
                <span className="block truncate text-xs text-slate-500">{m.people.length && k.people.length > 1 ? who.map((p) => p.name).join(", ") : "Everyone"}{out ? ` · takeout${out.place ? ` from ${out.place}` : ""}` : ""}</span></span>
              <span className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Edit</span>
            </button>
          </li>; })}</ul>}
        </Card>; })}
      </div>}
      {planned > 0 && <button type="button" onClick={() => setView("groceries")} className={`${btn} w-full`}>See the grocery list &middot; {money(t.total)}</button>}
    </>}

    {view === "groceries" && <Groceries k={k} setK={setK} t={t} token={token} connected={connected} onProduct={setProduct} say={say} range={fmtRange(start, n)} weeks={n}
      onBought={() => { change("Added what you bought to your inventory.", (x) => stockUp(useUpPast(x, today), undefined, today)); say("Your inventory has it now, so the list is clear."); }} send={() => {
      const lines = t.lines.filter((l) => !l.have && l.packs > 0);
      setFamily((f) => ({ ...f, groceries: planToList(f.groceries, lines, makeId) }));
      say(`${lines.length} items on your shopping list. Total ${money(t.groceries)}.`);
    }} />}

    {view === "inventory" && <Inventory k={k} setK={setK} onShop={() => setView("groceries")} />}

    {view === "people" && <People k={k} setK={setK} connected={connected} token={token} makeId={makeId} onClear={() => setClearing(true)} />}

    {dayOpen && <DaySheet k={k} day={dayOpen.day} wk={dayOpen.wk} start={start} onClose={() => setDayOpen(null)} onMeal={(key, m) => setMeal({ key, meal: m })}
      onAdd={() => { setPlanner(dayOpen); setDayOpen(null); }}
      onClear={() => { const d = dayOpen; change(`Cleared ${fmtDate(dateOf(start, d.wk, d.day))}.`, (x) => clearMeals(x, { days: [d.day], wks: [d.wk] })); setDayOpen(null); }} />}
    {planner && <WeekPlanner k={k} setK={setK} startDay={planner.day} startWk={planner.wk} start={start} makeId={makeId} onClose={() => setPlanner(null)} onSaved={(count) => say(`Saved. ${count} meal${count === 1 ? "" : "s"} planned.`)} />}
    {clearing && <ClearMeals k={k} onClose={() => setClearing(false)}
      onDedupe={() => change(`Removed ${dupes} extra meal${dupes === 1 ? "" : "s"}.`, removeDuplicates)}
      onClear={(scope, cooked) => { const n = countMeals(k, scope); change(`Cleared ${n} meal${n === 1 ? "" : "s"}.`, (x) => clearMeals(cooked ? useUp(x, scope) : x, scope)); }} />}
    {meal && <MealSheet k={k} setK={setK} at={meal.key} meal={meal.meal} start={start} today={today} onClose={() => setMeal(null)} onEdit={(id) => setEditing(id)} onMove={(toDay, toWk, copy) => moveTo(meal.key, meal.meal.id, cell(toDay, parseCell(meal.key).slot, toWk), copy)} />}
    {editing && <DishEditor k={k} setK={setK} dishId={editing} onClose={() => setEditing(null)} onProduct={setProduct} />}
    {product && <ProductChooser k={k} setK={setK} group={product} need={lineNeed(product)} token={token} connected={connected} makeId={makeId} onClose={() => setProduct(null)}
      dishes={[...new Map((t.lines.find((l) => l.group.id === product)?.uses ?? []).map((u) => [u.dish.id, { id: u.dish.id, name: u.dish.name }])).values()]} onDish={(id) => { setProduct(null); setEditing(id); }} />}
  </div>;
}

/** One planned meal: who eats it, its ingredients, move or copy it to another day, or take it off. */
function MealSheet({ k, setK, at, meal, start, today, onClose, onEdit, onMove }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; at: string; meal: KMeal; start: string; today: string; onClose: () => void; onEdit: (id: string) => void; onMove: (toDay: KDay, toWk: number, copy: boolean) => void }) {
  const d = dishOf(k, meal.dish);
  const live = (k.week[at] ?? []).find((m) => m.id === meal.id) ?? meal;
  const { day, slot, wk } = parseCell(at);
  const slotLabel = K_SLOTS.find((s) => s.id === slot)?.label ?? "";
  const [pick, setPick] = useState<"move" | "copy" | null>(null);
  const setPeople = (people: string[]) => setK((x) => ({ ...x, week: { ...x.week, [at]: (x.week[at] ?? []).map((m) => (m.id === meal.id ? { ...m, people } : m)) } }));
  const toggle = (id: string) => { const base = live.people.length ? live.people : k.people.map((p) => p.id); const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id]; setPeople(next.length === k.people.length ? [] : next); };
  return <Modal title={d ? d.name : meal.dish === SKIP ? "Skipping" : "Meal"} eyebrow={`${fmtDate(dateOf(start, wk, day))} · ${slotLabel}`} onClose={onClose}>
    {k.people.length > 1 && <div><p className={label}>Who's eating</p>
      <div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => setPeople([])} className={chip(!live.people.length)}>Everyone</button>
        {k.people.map((p) => <button key={p.id} type="button" onClick={() => toggle(p.id)} className={chip(!live.people.length || live.people.includes(p.id))}>{p.name}</button>)}</div>
      <p className="mt-2 text-xs text-slate-500">Someone eating something else? Take them off here and add their own meal to the same day.</p></div>}
    {pick ? <div className="mt-6" data-testid="move-picker">
      <div className="flex items-center justify-between gap-3"><p className={label}>{pick === "move" ? "Move it to which day?" : "Copy it to which day?"}</p><button type="button" onClick={() => setPick(null)} className="text-xs font-medium text-slate-500 hover:text-slate-900">Cancel</button></div>
      <div className="mt-2"><DatePick start={start} weeks={nWeeks(k)} today={today} from={{ day, wk }} onPick={(toDay, toWk) => { onMove(toDay, toWk, pick === "copy"); onClose(); }} /></div>
      <p className="mt-2 text-xs text-slate-500">It stays {slotLabel.toLowerCase()} on the day you pick.</p>
    </div> : <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {meal.dish !== SKIP && <button type="button" onClick={() => { onClose(); onEdit(meal.dish); }} className={ghost}>Edit ingredients</button>}
      <button type="button" onClick={() => setPick("move")} data-testid="meal-move" className={ghost}>Move to another day</button>
      <button type="button" onClick={() => setPick("copy")} data-testid="meal-copy" className={ghost}>Copy to another day</button>
      <button type="button" onClick={() => { setK((x) => removeMeal(x, at, meal.id)); onClose(); }} className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:border-rose-400">Remove from {DAY_LABEL[day]}</button>
    </div>}
    <button type="button" onClick={onClose} className={`${btn} mt-4 w-full`}>Done</button>
  </Modal>;
}

function Groceries({ k, setK, t, token, connected, onProduct, send, onBought, say, range, weeks }: { range: string; weeks: number; k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; t: ReturnType<typeof totals>; token: string | null; connected: boolean; onProduct: (g: string) => void; send: () => void; onBought: () => void; say: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const buy = t.lines.filter((l) => !l.have), home = t.lines.filter((l) => l.have);
  const storeIds = [...new Set(t.lines.flatMap((l) => l.buy.map((b) => b.product.storeId)).filter(Boolean) as string[])];
  const refresh = async () => {
    if (!k.store) return;
    setBusy(true);
    try {
      const r = await storePrices(token, k.store.id, storeIds);
      setK((x) => ({ ...x, products: x.products.map((p) => { const hit = r.prices.find((q) => q.storeId === p.storeId); return hit ? { ...p, price: hit.price, at: r.at } : p; }) }));
      say(`Updated ${r.prices.length} price${r.prices.length === 1 ? "" : "s"} from King Soopers.`);
    } catch (e: any) { say(String(e?.message || "Couldn't reach the store.")); }
    setBusy(false);
  };
  const aisles = [...new Set(buy.map((l) => l.group.aisle))];
  return <div className="space-y-6">
    <p className="text-sm text-slate-700" data-testid="shopping-range">Shopping for <b className="font-semibold text-slate-900">{range}</b>{weeks > 1 ? ` · ${weeks} weeks in one trip, so bigger packs usually cost less` : ""}</p>
    {connected && k.store && storeIds.length > 0 && <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Prices from {k.store.name}</span><button type="button" onClick={() => void refresh()} disabled={busy} className={link}>{busy ? "Updating" : "Update prices"}</button></div>}
    <p className="text-sm text-slate-500">Tap <b className="font-semibold text-slate-700">Edit</b> on any item to change its brand, size, price or how much you need.{!connected && " Prices are estimates until King Soopers is connected."}</p>
    {aisles.map((a) => <section key={a}>
      <p className={`${label} mb-1`}>{a}</p>
      <ul className="divide-y divide-slate-100 border-y border-slate-100">{buy.filter((l) => l.group.aisle === a).map((l) => <li key={l.group.id} className="py-3" data-testid={`grocery-${l.group.id}`}>
        <div className="flex items-start gap-3">
        <button type="button" onClick={() => onProduct(l.group.id)} className="min-w-0 flex-1 text-left">
          <span className="block text-[15px] font-semibold text-slate-900">{l.group.name}</span>
          <span className="block text-sm text-slate-600">{buyText(l.buy) === l.group.name ? `${l.packs} from produce` : buyText(l.buy)}</span>
          <span className="block text-xs text-slate-400">{l.uses.length ? `Need ${amountText(l.need, l.group)}` : `Keep at least ${amountText(l.keep, l.group)}`}{l.tracked ? ` · have ${amountText(l.onHand, l.group)}, buying ${amountText(l.short, l.group)}` : ""}{l.left > 0.009 ? ` · ${amountText(l.left, l.group)} left over` : ""}{l.uses.length ? ` · ${[...new Set(l.uses.map((u) => u.dish.name))].slice(0, 3).join(", ")}` : " · running low"}</span>
        </button>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-slate-900">{money(l.cost)}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => onProduct(l.group.id)} aria-label={`Edit ${l.group.name}`} data-testid={`edit-${l.group.id}`} className={rowBtn}>Edit</button>
          <button type="button" onClick={() => setK((x) => (l.tracked ? setStock(x, l.group.id, l.need + l.keep) : { ...x, have: { ...x.have, [l.group.id]: true } }))} aria-label={`I already have ${l.group.name}`} className={rowBtn}>I have this</button>
        </div>
      </li>)}</ul>
    </section>)}
    {t.take.length > 0 && <section><p className={`${label} mb-1`}>Takeout</p>
      <ul className="divide-y divide-slate-100 border-y border-slate-100">{t.take.map((x) => <li key={x.dish.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0"><span className="block font-semibold text-slate-900">{x.dish.name}</span><span className="block text-xs text-slate-500">{x.place || "Takeout"} · {x.servings} serving{x.servings === 1 ? "" : "s"} at {money(x.perPerson)}</span></span><span className="font-semibold tabular-nums">{money(x.cost)}</span></li>)}</ul></section>}
    {home.length > 0 && <section><p className={`${label} mb-1`}>Already at home</p>
      <ul className="flex flex-wrap gap-1.5">{home.map((l) => <li key={l.group.id}><button type="button" onClick={() => setK((x) => ({ ...x, have: { ...x.have, [l.group.id]: false } }))} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-900" title="Tap if you need to buy it">{l.group.name} &middot; buy it</button></li>)}</ul>
      <p className="mt-2 text-xs text-slate-400">Basics like oil, butter and spices start here. Tap one to add it to the list.</p></section>}
    {buy.length === 0 && t.take.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Plan a few meals and the list builds itself.</p>}
    {buy.length > 0 && <div className="sticky bottom-3 rounded-2xl bg-slate-900 p-4 text-white shadow-lg">
      <div className="flex items-center justify-between gap-3"><span><span className="block text-xs text-white/60">Groceries</span><span className="text-2xl font-semibold tabular-nums">{money(t.groceries)}</span></span>
        <button type="button" onClick={send} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">Send to shopping list</button></div>
      <button type="button" onClick={onBought} className="mt-3 text-xs font-medium text-white/70 underline underline-offset-2 hover:text-white" data-testid="bought-all">Bought it all? Put it in your inventory</button>
    </div>}
  </div>;
}

function PeopleRows({ k, setK, makeId }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; makeId: () => string }) {
  return <div className="space-y-2">
    {k.people.map((p) => <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2.5">
      <input value={p.name} onChange={(e) => setK((x) => ({ ...x, people: x.people.map((q) => (q.id === p.id ? { ...q, name: e.target.value.slice(0, 40) } : q)) }))} aria-label="Name" className={`${field} min-w-[8rem] flex-1`} />
      <select value={String(PORTIONS.find((o) => o.value === p.portion)?.value ?? p.portion)} onChange={(e) => setK((x) => ({ ...x, people: x.people.map((q) => (q.id === p.id ? { ...q, portion: Number(e.target.value) } : q)) }))} aria-label={`${p.name}'s portion`} className={field}>
        {PORTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {!PORTIONS.some((o) => o.value === p.portion) && <option value={p.portion}>{p.portion}× portion</option>}
      </select>
      <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setK((x) => ({ ...x, people: x.people.filter((q) => q.id !== p.id), week: Object.fromEntries(Object.entries(x.week).map(([key, ms]) => [key, ms.map((m) => ({ ...m, people: m.people.filter((id) => id !== p.id) }))])) }))} className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900">&times;</button>
    </div>)}
    <button type="button" onClick={() => setK((x) => ({ ...x, people: [...x.people, { id: `p-${makeId()}`, name: `Person ${x.people.length + 1}`, portion: 1 }] }))} className={ghost}>Add a person</button>
  </div>;
}

function StorePicker({ k, setK, connected, token }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; connected: boolean; token: string | null }) {
  const [zip, setZip] = useState(k.store?.zip ?? "");
  const [stores, setStores] = useState<StoreLocation[] | null>(null);
  const [err, setErr] = useState("");
  if (!connected) return <p className="text-sm leading-relaxed text-slate-500">King Soopers isn't connected on the server yet, so prices are estimates for now. You can still pick any brand and set your own prices, and they'll stay put.</p>;
  return <div className="space-y-2">
    {k.store && <p className="text-sm text-slate-700">Your store: <span className="font-semibold">{k.store.name}</span></p>}
    <div className="flex gap-2"><input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="ZIP code" aria-label="ZIP code" className={`${field} w-32`} />
      <button type="button" onClick={async () => { setErr(""); try { setStores(await findStores(token, zip)); } catch (e: any) { setErr(String(e?.message || "Couldn't find stores.")); } }} disabled={zip.length !== 5} className={ghost}>Find stores</button></div>
    {err && <p className="text-sm text-rose-600">{err}</p>}
    {stores && <ul className="divide-y divide-slate-100 border-y border-slate-100">{stores.length === 0 && <li className="py-3 text-sm text-slate-400">No stores near that ZIP.</li>}{stores.map((s) => <li key={s.id}><button type="button" onClick={() => { setK((x) => ({ ...x, store: { id: s.id, name: s.name, zip } })); setStores(null); }} className="flex w-full items-center justify-between gap-3 py-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{s.name}</span><span className="block truncate text-xs text-slate-500">{s.address}</span></span><span className="text-xs font-semibold text-slate-500">{k.store?.id === s.id ? "Picked" : "Pick"}</span></button></li>)}</ul>}
  </div>;
}

function People({ k, setK, connected, token, makeId, onClear }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; connected: boolean; token: string | null; makeId: () => string; onClear: () => void }) {
  return <div className="space-y-8">
    <section><p className={label}>Who's eating</p><p className="mb-3 mt-1 text-sm text-slate-500">Each person's portion sets how much of every dish they eat. Give someone their own amount of one thing (4 cookies, say) in that dish's ingredients.</p><PeopleRows k={k} setK={setK} makeId={makeId} /></section>
    <section><p className={label}>Your store</p><div className="mt-2"><StorePicker k={k} setK={setK} connected={connected} token={token} /></div></section>
    <section className="border-t border-slate-100 pt-4"><button type="button" onClick={onClear} className="text-sm font-semibold text-rose-600">Clear meals</button></section>
  </div>;
}

function Setup({ k, setK, family, connected, token, makeId }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; family: SectionProps["family"]; connected: boolean; token: string | null; makeId: () => string }) {
  useEffect(() => {
    if (k.people.length) return;
    // One row per person: a name that appears twice in the family list (a linked profile and a member, say) is added once.
    const seen = new Set<string>();
    const fromFamily = family.members.filter((m) => { const key = m.name.trim().toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; }).map((m) => ({ id: `m-${m.id}`, name: m.name.trim(), portion: m.kind === "kid" ? 0.75 : 1 }));
    setK((x) => ({ ...x, people: fromFamily.length ? fromFamily : [{ id: `p-${makeId()}`, name: "Me", portion: 1 }] }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="w-full max-w-2xl space-y-8" data-testid="kitchen-setup">
    <header><p className={label}>Kitchen setup</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Who are you cooking for?</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">The planner works out exactly how much of each product to buy from everyone's portions, so a child's plate costs less than an adult's and nothing is bought twice.</p></header>
    <PeopleRows k={k} setK={setK} makeId={makeId} />
    <section><p className={label}>Your store</p><div className="mt-2"><StorePicker k={k} setK={setK} connected={connected} token={token} /></div></section>
    <button type="button" disabled={!k.people.length} onClick={() => setK((x) => ({ ...x, setup: true }))} className={`${btn} w-full`}>Start planning</button>
  </div>;
}
