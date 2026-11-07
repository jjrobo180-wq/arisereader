// Kitchen > Plan (November 2026). Who's eating, what each person eats each day, and one exact grocery list:
// real products and package sizes, how much is left over, ways to share and save. Saved with the family, so
// everyone in the family sees the same plan. The math lives in shared/kitchen.ts.
import { useEffect, useMemo, useState } from "react";
import { DAY_LABEL, K_SLOTS, PORTIONS, WEEK, amountText, buyText, cell, dishOf, emptyKitchen, money, peopleIn, removeMeal, takeoutOf, tips, totals, type KDay, type Kitchen, type KMeal, type KSlot } from "@shared/kitchen";
import { useAuth } from "@/context/AuthContext";
import { findStores, storePrices, storeStatus, type StoreLocation } from "@/lib/kitchenStore";
import { guessAisle } from "@shared/lifePlugins";
import { Modal, type SectionProps } from "./ui";
import DishEditor from "./kitchen/DishEditor";
import DishPicker from "./kitchen/DishPicker";
import ProductChooser from "./kitchen/ProductChooser";
import { Card, Segmented, btn, chip, field, ghost, label, link } from "./kitchen/kit";

type View = "week" | "groceries" | "people";
const PLAN_TAG = "kp-";
const SLOT_ONE: Record<KSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", dessert: "Dessert" };

export default function KitchenPlan({ family, setFamily, makeId, say }: SectionProps) {
  const { token } = useAuth();
  const k: Kitchen = family.kitchen ?? emptyKitchen();
  const setK = (fn: (k: Kitchen) => Kitchen) => setFamily((f) => ({ ...f, kitchen: fn(f.kitchen ?? emptyKitchen()) }));
  const [view, setView] = useState<View>("week");
  const [picker, setPicker] = useState<{ day: KDay; slot: KSlot } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [product, setProduct] = useState<string | null>(null);
  const [meal, setMeal] = useState<{ key: string; meal: KMeal } | null>(null);
  const [connected, setConnected] = useState(false);
  const [allTips, setAllTips] = useState(false);
  useEffect(() => { void storeStatus(token).then(setConnected); }, [token]);

  const t = useMemo(() => totals(k), [k]);
  const ideas = useMemo(() => tips(k), [k]);
  const lineNeed = (group: string) => t.lines.find((l) => l.group.id === group)?.need ?? 0;

  if (!k.setup) return <Setup k={k} setK={setK} family={family} connected={connected} token={token} makeId={makeId} />;

  const planned = Object.values(k.week).reduce((a, m) => a + m.length, 0);
  return <div className="w-full max-w-3xl space-y-6" data-testid="kitchen-plan">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className={label}>This week</p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums text-slate-900" data-testid="plan-total">{money(t.total)}</p>
        <p className="mt-1 text-sm text-slate-500">{money(t.groceries)} groceries{t.takeout ? ` · ${money(t.takeout)} takeout` : ""}</p>
      </div>
      {k.people.length > 1 && <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{k.people.map((p) => <span key={p.id} className="text-slate-500">{p.name} <span className="font-semibold tabular-nums text-slate-900">{money(t.share[p.id] ?? 0)}</span></span>)}</div>}
    </div>
    <Segmented label="Kitchen plan" value={view} onChange={setView} options={[{ id: "week", label: "Week" }, { id: "groceries", label: `Groceries${t.lines.filter((l) => !l.have).length ? ` (${t.lines.filter((l) => !l.have).length})` : ""}` }, { id: "people", label: "People & store" }]} />

    {view === "week" && <>
      {ideas.length > 0 && <section className="space-y-2" aria-label="Ways to save">
        <p className={label}>Ways to save</p>
        {(allTips ? ideas : ideas.slice(0, 2)).map((x) => <Card key={x.id} className="p-4">
          <p className="text-sm leading-relaxed text-slate-700">{x.text}</p>
          {x.kind === "bulk" && <button type="button" onClick={() => setK((y) => { const choice = { ...y.choice }; if (x.product) choice[x.group] = x.product; else delete choice[x.group]; return { ...y, choice }; })} className={`${link} mt-2`}>{x.button}</button>}
          {x.kind === "leftover" && <button type="button" onClick={() => { setK((y) => ({ ...y, week: { ...y.week, [cell(x.day, x.slot)]: [...(y.week[cell(x.day, x.slot)] ?? []), { id: makeId(), dish: x.dish, people: x.people }] } })); say("Added."); }} className={`${link} mt-2`}>{x.button}</button>}
        </Card>)}
        {ideas.length > 2 && <button type="button" onClick={() => setAllTips((v) => !v)} className={link}>{allTips ? "Show fewer" : `${ideas.length - 2} more way${ideas.length - 2 === 1 ? "" : "s"} to save`}</button>}
      </section>}
      {planned === 0 && <Card className="p-6 text-center"><p className="text-sm text-slate-500">Nothing planned yet. Pick a day below and add a meal.</p></Card>}
      <div className="space-y-3">
        {WEEK.map((day) => { const meals = K_SLOTS.flatMap((s) => (k.week[cell(day, s.id)] ?? []).map((m) => ({ slot: s, m }))); return <Card key={day} className="p-4">
          <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-slate-900">{DAY_LABEL[day]}</h3><button type="button" onClick={() => setPicker({ day, slot: "dinner" })} className={link}>Add meal</button></div>
          {meals.length > 0 && <ul className="mt-2 divide-y divide-slate-100">{meals.map(({ slot, m }) => { const d = dishOf(k, m.dish); const who = peopleIn(k, m); const out = takeoutOf(k, m.dish); return <li key={m.id}>
            <button type="button" onClick={() => setMeal({ key: cell(day, slot.id), meal: m })} className="flex w-full items-center gap-3 py-2.5 text-left">
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">{SLOT_ONE[slot.id]}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium text-slate-900">{d?.name ?? "Removed dish"}</span>
                <span className="block truncate text-xs text-slate-500">{m.people.length && k.people.length > 1 ? who.map((p) => p.name).join(", ") : "Everyone"}{out ? ` · takeout${out.place ? ` from ${out.place}` : ""}` : ""}</span></span>
              <span className="shrink-0 text-xs text-slate-400">Edit</span>
            </button>
          </li>; })}</ul>}
        </Card>; })}
      </div>
      {planned > 0 && <button type="button" onClick={() => setView("groceries")} className={`${btn} w-full`}>See the grocery list &middot; {money(t.total)}</button>}
    </>}

    {view === "groceries" && <Groceries k={k} setK={setK} t={t} token={token} connected={connected} onProduct={setProduct} say={say} send={() => {
      const lines = t.lines.filter((l) => !l.have && l.packs > 0);
      setFamily((f) => ({ ...f, groceries: [...f.groceries.filter((g) => !g.id.startsWith(PLAN_TAG) || g.checked), ...lines.map((l) => ({ id: `${PLAN_TAG}${makeId()}`, name: `${l.group.name}: ${buyText(l.buy)}`.slice(0, 80), qty: `${l.packs} pk`.slice(0, 20), aisle: guessAisle(l.group.name), checked: false, price: l.cost }))] }));
      say(`${lines.length} items on your shopping list. Total ${money(t.groceries)}.`);
    }} />}

    {view === "people" && <People k={k} setK={setK} connected={connected} token={token} makeId={makeId} />}

    {picker && <DishPicker k={k} setK={setK} day={picker.day} slot={picker.slot} makeId={makeId} onClose={() => setPicker(null)} onEdit={setEditing} />}
    {meal && <MealSheet k={k} setK={setK} at={meal.key} meal={meal.meal} onClose={() => setMeal(null)} onEdit={(id) => setEditing(id)} />}
    {editing && <DishEditor k={k} setK={setK} dishId={editing} onClose={() => setEditing(null)} onProduct={setProduct} />}
    {product && <ProductChooser k={k} setK={setK} group={product} need={lineNeed(product)} token={token} connected={connected} makeId={makeId} onClose={() => setProduct(null)} />}
  </div>;
}

/** One planned meal: who eats it, its ingredients, or take it off the day. */
function MealSheet({ k, setK, at, meal, onClose, onEdit }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; at: string; meal: KMeal; onClose: () => void; onEdit: (id: string) => void }) {
  const d = dishOf(k, meal.dish);
  const live = (k.week[at] ?? []).find((m) => m.id === meal.id) ?? meal;
  const [day, slot] = at.split(":") as [KDay, KSlot];
  const setPeople = (people: string[]) => setK((x) => ({ ...x, week: { ...x.week, [at]: (x.week[at] ?? []).map((m) => (m.id === meal.id ? { ...m, people } : m)) } }));
  const toggle = (id: string) => { const base = live.people.length ? live.people : k.people.map((p) => p.id); const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id]; setPeople(next.length === k.people.length ? [] : next); };
  return <Modal title={d?.name ?? "Meal"} eyebrow={`${DAY_LABEL[day]} · ${K_SLOTS.find((s) => s.id === slot)?.label ?? ""}`} onClose={onClose}>
    {k.people.length > 1 && <div><p className={label}>Who's eating</p>
      <div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => setPeople([])} className={chip(!live.people.length)}>Everyone</button>
        {k.people.map((p) => <button key={p.id} type="button" onClick={() => toggle(p.id)} className={chip(!live.people.length || live.people.includes(p.id))}>{p.name}</button>)}</div>
      <p className="mt-2 text-xs text-slate-500">Someone eating something else? Take them off here and add their own meal to the same day.</p></div>}
    <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button type="button" onClick={() => { onClose(); onEdit(meal.dish); }} className={ghost}>Ingredients &amp; amounts</button>
      <button type="button" onClick={() => { setK((x) => removeMeal(x, at, meal.id)); onClose(); }} className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:border-rose-400">Remove from {DAY_LABEL[day]}</button>
    </div>
    <button type="button" onClick={onClose} className={`${btn} mt-4 w-full`}>Done</button>
  </Modal>;
}

function Groceries({ k, setK, t, token, connected, onProduct, send, say }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; t: ReturnType<typeof totals>; token: string | null; connected: boolean; onProduct: (g: string) => void; send: () => void; say: (m: string) => void }) {
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
    {connected && k.store && storeIds.length > 0 && <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Prices from {k.store.name}</span><button type="button" onClick={() => void refresh()} disabled={busy} className={link}>{busy ? "Updating" : "Update prices"}</button></div>}
    {!connected && <p className="text-sm text-slate-500">Prices are estimates until King Soopers is connected. Tap any item to pick its brand and size or set your own price, and it stays that way.</p>}
    {aisles.map((a) => <section key={a}>
      <p className={`${label} mb-1`}>{a}</p>
      <ul className="divide-y divide-slate-100 border-y border-slate-100">{buy.filter((l) => l.group.aisle === a).map((l) => <li key={l.group.id} className="flex items-start gap-3 py-3">
        <button type="button" onClick={() => onProduct(l.group.id)} className="min-w-0 flex-1 text-left">
          <span className="block text-[15px] font-semibold text-slate-900">{l.group.name}</span>
          <span className="block text-sm text-slate-600">{buyText(l.buy) === l.group.name ? `${l.packs} from produce` : buyText(l.buy)}</span>
          <span className="block text-xs text-slate-400">Need {amountText(l.need, l.group)}{l.left > 0.009 ? ` · ${amountText(l.left, l.group)} left over` : ""} &middot; {[...new Set(l.uses.map((u) => u.dish.name))].slice(0, 3).join(", ")}</span>
        </button>
        <div className="shrink-0 text-right"><span className="block text-[15px] font-semibold tabular-nums text-slate-900">{money(l.cost)}</span>
          <button type="button" onClick={() => setK((x) => ({ ...x, have: { ...x.have, [l.group.id]: true } }))} className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-900">Have it</button></div>
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

function People({ k, setK, connected, token, makeId }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; connected: boolean; token: string | null; makeId: () => string }) {
  return <div className="space-y-8">
    <section><p className={label}>Who's eating</p><p className="mb-3 mt-1 text-sm text-slate-500">Each person's portion sets how much of every dish they eat. Give someone their own amount of one thing (4 cookies, say) in that dish's ingredients.</p><PeopleRows k={k} setK={setK} makeId={makeId} /></section>
    <section><p className={label}>Your store</p><div className="mt-2"><StorePicker k={k} setK={setK} connected={connected} token={token} /></div></section>
    <section className="border-t border-slate-100 pt-4"><button type="button" onClick={() => setK((x) => ({ ...x, week: {} }))} className="text-sm font-semibold text-rose-600">Clear this week's meals</button></section>
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
