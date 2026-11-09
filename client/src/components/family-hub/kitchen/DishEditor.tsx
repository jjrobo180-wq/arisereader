// One dish: what goes in it and how much each person eats. Add or take away ingredients, pick the brand for each,
// give someone their own amount ("Mia has 4 cookies"), switch it to takeout, or delete a dish you made.
import { useState } from "react";
import DidYouMean from "@/components/family-hub/DidYouMean";
import { GROUPS_SORTED, K_SLOTS, TAKEOUT_PLACES, amountFor, atHome, defaultPer, deleteOwnDish, dishOf, groupOf, money, partsOf, productText, servingCost, shoppingLines, takeoutOf, unitWord, chosen, type Kitchen, type KPart, type KSlot } from "@shared/kitchen";
import { Modal } from "../ui";
import { Segmented, btn, field, label, quiet } from "./kit";

const num = (v: string) => { const x = Number(v.replace(/[^\d.]/g, "")); return Number.isFinite(x) ? x : 0; };

export default function DishEditor({ k, setK, dishId, onClose, onProduct }: {
  k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; dishId: string; onClose: () => void; onProduct: (group: string) => void;
}) {
  const dish = dishOf(k, dishId);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!dish) return null;
  const parts = partsOf(k, dish);
  const takeout = takeoutOf(k, dish.id);
  const edited = !dish.own && !!k.edits[dish.id]?.parts;
  const lines = new Map(shoppingLines(k).map((l) => [l.group.id, l]));

  const setParts = (next: KPart[]) => setK((x) => dish.own
    ? { ...x, own: x.own.map((d) => (d.id === dish.id ? { ...d, parts: next } : d)) }
    : { ...x, edits: { ...x.edits, [dish.id]: { ...x.edits[dish.id], parts: next } } });
  const setTakeout = (t: { place: string; perPerson: number } | undefined) => setK((x) => {
    const e = { ...x.edits[dish.id] }; if (t) e.takeout = t; else delete e.takeout;
    const edits = { ...x.edits }; if (Object.keys(e).length) edits[dish.id] = e; else delete edits[dish.id];
    return { ...x, edits };
  });
  const setOwnAmount = (personId: string, group: string, v: string) => setK((x) => {
    const mine = { ...(x.servings[personId] ?? {}) }; const key = `${dish.id}:${group}`;
    if (v.trim() === "") delete mine[key]; else mine[key] = num(v);
    return { ...x, servings: { ...x.servings, [personId]: mine } };
  });
  const rename = (name: string) => setK((x) => ({ ...x, own: x.own.map((d) => (d.id === dish.id ? { ...d, name: name.slice(0, 80) } : d)) }));
  const setSlot = (slot: KSlot) => setK((x) => ({ ...x, own: x.own.map((d) => (d.id === dish.id ? { ...d, slot } : d)) }));
  const matches = search.trim().length > 1 ? GROUPS_SORTED.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()) && !parts.some((p) => p.group === g.id)).slice(0, 8) : [];

  return <Modal title={dish.name} eyebrow={dish.own ? "Your dish" : "Dish"} onClose={onClose}>
    {dish.own && <div className="mb-5 space-y-3">
      <input value={dish.name} onChange={(e) => rename(e.target.value)} aria-label="Dish name" className={`${field} w-full text-base font-semibold`} />
      <DidYouMean text={dish.name} onPick={rename} />
      <Segmented label="Meal" value={dish.slot} onChange={setSlot} options={K_SLOTS.map((s) => ({ id: s.id, label: s.label }))} />
    </div>}
    <Segmented label="How you get it" value={takeout ? "out" : "home"} onChange={(v) => setTakeout(v === "out" ? { place: "", perPerson: 12 } : undefined)} options={[{ id: "home", label: "Cook at home" }, { id: "out", label: "Takeout" }]} />

    {takeout ? <div className="mt-5 space-y-4">
      <label className="block"><span className={label}>Where from</span><input value={takeout.place} onChange={(e) => setTakeout({ ...takeout, place: e.target.value.slice(0, 60) })} placeholder="Restaurant" className={`${field} mt-1.5 w-full`} /></label>
      <div className="flex flex-wrap gap-1.5">{TAKEOUT_PLACES.map((p) => <button key={p} type="button" onClick={() => setTakeout({ ...takeout, place: p })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${takeout.place === p ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>{p}</button>)}</div>
      <label className="block"><span className={label}>Price per person</span>
        <div className="mt-1.5 flex items-center rounded-lg border border-slate-200 px-3"><span className="text-slate-400">$</span><input value={String(takeout.perPerson)} onChange={(e) => setTakeout({ ...takeout, perPerson: num(e.target.value) })} inputMode="decimal" className="w-full bg-transparent py-2.5 pl-1 text-sm outline-none" aria-label="Price per person" /></div></label>
      <p className="text-xs text-slate-500">Counts toward the week's total. Nothing goes on the grocery list.</p>
    </div> : <div className="mt-5">
      <div className="flex items-baseline justify-between"><p className={label}>Per person, one serving</p><p className="text-xs text-slate-500">about {money(servingCost(k, dish))} a serving</p></div>
      <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
        {parts.map((p, i) => { const g = groupOf(p.group)!; const line = lines.get(p.group); const prod = line?.product ?? chosen(k, p.group); const home = atHome(k, p.group); return <li key={p.group} className="py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-slate-900">{g.name}</p>
              <button type="button" onClick={() => onProduct(p.group)} className="block max-w-full truncate text-left text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900">{home ? "At home" : prod ? productText(prod) : "Pick a product"}</button>
            </div>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500"><input value={String(p.per)} onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, per: num(e.target.value) } : q)))} inputMode="decimal" aria-label={`${g.name} per serving`} className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm font-semibold text-slate-900 outline-none focus:border-slate-900" /><span className="w-14">{unitWord(g, p.per)}</span></label>
            <button type="button" aria-label={`Take out ${g.name}`} onClick={() => setParts(parts.filter((_, j) => j !== i))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900">&times;</button>
          </div>
          {k.people.length > 1 && <button type="button" onClick={() => setOpen(open === p.group ? null : p.group)} className="mt-1 text-xs font-medium text-slate-500 hover:text-slate-900">{open === p.group ? "Hide amounts per person" : "Different amount for someone?"}</button>}
          {open === p.group && <div className="mt-2 grid grid-cols-1 gap-1.5 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
            {k.people.map((person) => { const own = k.servings[person.id]?.[`${dish.id}:${p.group}`]; return <label key={person.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-slate-700">{person.name}</span>
              <span className="flex items-center gap-1.5"><input value={own === undefined ? "" : String(own)} placeholder={String(Math.round(amountFor(k, { ...person, id: "" }, dish, p) * 100) / 100)} onChange={(e) => setOwnAmount(person.id, p.group, e.target.value)} inputMode="decimal" aria-label={`${person.name}'s ${g.name}`} className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm outline-none focus:border-slate-900" /><span className="w-14 text-xs text-slate-500">{unitWord(g)}</span></span>
            </label>; })}
            <p className="col-span-full text-[11px] text-slate-400">Leave a box empty to use their usual portion.</p>
          </div>}
        </li>; })}
        {parts.length === 0 && <li className="py-4 text-sm text-slate-400">No ingredients yet. Add some below.</li>}
      </ul>
      <div className="mt-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Add an ingredient (cheese, rice, cookie dough)" aria-label="Add an ingredient" className={`${field} w-full`} />
        <DidYouMean text={search} onPick={setSearch} className="mt-1.5" />
        {matches.length > 0 && <ul className="mt-1 divide-y divide-slate-100 rounded-xl border border-slate-200">{matches.map((g) => <li key={g.id}><button type="button" onClick={() => { setParts([...parts, { group: g.id, per: defaultPer(g) }]); setSearch(""); }} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50"><span className="font-medium text-slate-900">{g.name}</span><span className="text-xs text-slate-400">{g.aisle}</span></button></li>)}</ul>}
        {search.trim().length > 1 && matches.length === 0 && <p className="mt-2 text-xs text-slate-400">No match on the shelf. Try a simpler word.</p>}
      </div>
      {edited && <button type="button" onClick={() => setK((x) => { const e = { ...x.edits[dish.id] }; delete e.parts; const edits = { ...x.edits }; if (Object.keys(e).length) edits[dish.id] = e; else delete edits[dish.id]; return { ...x, edits }; })} className={`${quiet} mt-3`}>Reset to the standard recipe</button>}
    </div>}

    {dish.own && <div className="mt-6 border-t border-slate-100 pt-4">
      {!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-semibold text-rose-600">Delete this dish</button>
        : <div className="flex items-center gap-3 text-sm"><span className="text-slate-600">Delete it and take it off every day?</span><button type="button" onClick={() => { setK((x) => deleteOwnDish(x, dish.id)); onClose(); }} className="font-semibold text-rose-600">Delete</button><button type="button" onClick={() => setConfirmDelete(false)} className={quiet}>Keep</button></div>}
    </div>}
    <button type="button" onClick={onClose} className={`${btn} mt-6 w-full`}>Done</button>
  </Modal>;
}
