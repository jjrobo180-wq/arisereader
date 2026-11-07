// Adding a meal: pick a dish from rounded tiles (or make your own), the days it's on, and who's eating it.
import { useMemo, useState } from "react";
import { DAY_SHORT, K_SLOTS, WEEK, allDishes, money, servingCost, takeoutOf, type KDay, type Kitchen, type KSlot } from "@shared/kitchen";
import { Modal } from "../ui";
import { Check, Segmented, btn, chip, field, ghost, label, link } from "./kit";

type Sort = "popular" | "healthy" | "calories" | "quick" | "cheap";
const SORTS: { id: Sort; label: string }[] = [{ id: "popular", label: "Popular" }, { id: "healthy", label: "Healthiest" }, { id: "calories", label: "Fewest calories" }, { id: "quick", label: "20 minutes or less" }, { id: "cheap", label: "Lowest cost" }];

export default function DishPicker({ k, setK, day, slot: startSlot, makeId, onClose, onEdit }: {
  k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; day: KDay; slot: KSlot; makeId: () => string; onClose: () => void; onEdit: (dishId: string) => void;
}) {
  const [slot, setSlot] = useState<KSlot>(startSlot);
  const [sort, setSort] = useState<Sort>("popular");
  const [search, setSearch] = useState("");
  const [dish, setDish] = useState<string | null>(null);
  const [days, setDays] = useState<KDay[]>([day]);
  const [people, setPeople] = useState<string[]>([]);
  const [making, setMaking] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let l = allDishes(k).filter((d) => d.slot === slot && (!q || d.name.toLowerCase().includes(q)));
    if (sort === "quick") l = l.filter((d) => d.own || d.minutes <= 20);
    const cost = new Map(l.map((d) => [d.id, servingCost(k, d)]));
    const score = (d: (typeof l)[number]) => sort === "healthy" ? (d.tags.includes("healthy") ? 0 : 10000) + d.kcal : sort === "calories" ? d.kcal : sort === "cheap" ? cost.get(d.id)! : sort === "quick" ? d.minutes : -d.pop;
    return { l: l.sort((a, b) => Number(!!b.own) - Number(!!a.own) || score(a) - score(b) || a.name.localeCompare(b.name)), cost };
  }, [k, slot, sort, search]);

  const add = () => {
    if (!dish || !days.length) return;
    setK((x) => {
      const week = { ...x.week };
      for (const d of days) { const key = `${d}:${slot}`; week[key] = [...(week[key] ?? []), { id: makeId(), dish, people }]; }
      return { ...x, week };
    });
    onClose();
  };
  const make = () => {
    const name = making.trim(); if (!name) return;
    const id = `own-${makeId()}`;
    setK((x) => ({ ...x, own: [...x.own, { id, slot, name: name.slice(0, 80), kcal: 0, minutes: 0, tags: [], pop: 0, parts: [], own: true }] }));
    setMaking(""); setDish(id); onEdit(id);
  };
  const togglePerson = (id: string) => setPeople((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return <Modal title="Add a meal" eyebrow="Plan" onClose={onClose} wide>
    <Segmented label="Meal" value={slot} onChange={(v) => { setSlot(v); setDish(null); }} options={K_SLOTS.map((s) => ({ id: s.id, label: s.label }))} />
    <div className="mt-3 flex gap-2">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes" aria-label="Search dishes" className={`${field} flex-1`} />
      <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className={`${field} shrink-0`}>{SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
    </div>
    <div className="mt-3 grid max-h-[42vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
      {list.l.map((d) => { const on = dish === d.id; const t = takeoutOf(k, d.id); return <button key={d.id} type="button" aria-pressed={on} onClick={() => setDish(on ? null : d.id)} className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${on ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-400"}`}>
        <span className="mt-0.5"><Check on={on} /></span>
        <span className="min-w-0"><span className="block text-[15px] font-semibold leading-tight text-slate-900">{d.name}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{t ? `Takeout${t.place ? `, ${t.place}` : ""} · ${money(t.perPerson)} a person` : `${d.own ? "Your dish" : `${d.kcal} cal · ${d.minutes} min`} · about ${money(list.cost.get(d.id) ?? 0)} a serving`}</span></span>
      </button>; })}
      {list.l.length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-400">No dishes match.</p>}
    </div>
    <div className="mt-3 flex gap-2">
      <input value={making} onChange={(e) => setMaking(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") make(); }} placeholder="Or make your own dish" aria-label="Your own dish" className={`${field} flex-1`} />
      <button type="button" onClick={make} disabled={!making.trim()} className={ghost}>Create</button>
    </div>

    <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
      <div><p className={label}>Days</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{WEEK.map((d) => <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))} className={chip(days.includes(d))}>{DAY_SHORT[d]}</button>)}
          <button type="button" onClick={() => setDays(days.length === 7 ? [day] : [...WEEK])} className="px-2 text-xs font-semibold text-slate-500 hover:text-slate-900">{days.length === 7 ? "Just one" : "Every day"}</button></div></div>
      {k.people.length > 1 && <div><p className={label}>Who's eating</p>
        <div className="mt-2 flex flex-wrap gap-1.5"><button type="button" aria-pressed={!people.length} onClick={() => setPeople([])} className={chip(!people.length)}>Everyone</button>
          {k.people.map((p) => <button key={p.id} type="button" aria-pressed={people.includes(p.id)} onClick={() => togglePerson(p.id)} className={chip(people.includes(p.id))}>{p.name}</button>)}</div></div>}
      <div className="flex items-center gap-3">
        {dish && <button type="button" onClick={() => onEdit(dish)} className={link}>Ingredients</button>}
        <button type="button" onClick={add} disabled={!dish || !days.length} className={`${btn} flex-1`}>{days.length > 1 ? `Add to ${days.length} days` : `Add to ${DAY_SHORT[days[0] ?? day]}`}</button>
      </div>
    </div>
  </Modal>;
}
