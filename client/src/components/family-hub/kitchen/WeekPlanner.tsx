// Plan the week in one popup: all seven days on one screen, each with Breakfast, Lunch and Dinner (plus snacks and
// desserts). A 2-week or month plan has a tab for each week, and Copy this week to every week fills them all.. With more than one person, every person can have their own menu: tap a name to see and plan
// just their meals, and pick who's eating when you add a dish (two people picking the same dish share one meal). The bars
// show how much of each person's week is planned. Nothing changes until Save, and Save sets each meal rather than adding
// on top, so a meal can never be doubled. "Copy to every day" puts the same meal on all seven days.
import { useEffect, useMemo, useState } from "react";
import DidYouMean from "@/components/family-hub/DidYouMean";
import { GROUPS_SORTED, SERVING_UNITS, chosen, groupForName, groupOf, plural, productText, servingIn, servingsPer, typicalServing, DAY_LABEL, K_SLOTS, MAIN_SLOTS, MAX_WEEKS, SKIP, WEEK, allDishes, cell, dateOf, dayProgress, dishName, dropPerson, eats, foodCount, money, nWeeks, planDish, servingCost, setCells, takeoutOf, type KDay, type Kitchen, type KMeal, type KSlot } from "@shared/kitchen";
import { Modal } from "../ui";
import PlanProgress from "./PlanProgress";
import { btn, chip, field, ghost, label, quiet, Segmented } from "./kit";
import { fmtRange, fmtShort } from "./PlanCalendar";

const SLOT_ONE: Record<KSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", dessert: "Dessert" };
type Draft = Record<string, KMeal[]>;

export default function WeekPlanner({ k, setK, startDay, startWk, start, makeId, onClose, onSaved }: {
  k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; startDay: KDay; /** Which week to open on (0 is the first). */ startWk: number; /** The Monday the plan starts on. */ start: string; makeId: () => string; onClose: () => void; onSaved: (meals: number) => void;
}) {
  const ids = useMemo(() => k.people.map((p) => p.id), [k.people]);
  const several = k.people.length > 1;
  const n = nWeeks(k);
  const [wk, setWk] = useState(Math.min(startWk, n - 1));
  /** Whose menu is showing: one person, or null for the whole family. */
  const [who, setWho] = useState<string | null>(null);
  const person = k.people.find((p) => p.id === who);
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(Array.from({ length: MAX_WEEKS }, (_, w) => w).flatMap((w) => WEEK.flatMap((d) => K_SLOTS.map((s) => [cell(d, s.id, w), [...(k.week[cell(d, s.id, w)] ?? [])]])))));
  const [choosing, setChoosing] = useState<string | null>(null);
  const slots: KSlot[] = K_SLOTS.map((s) => s.id);
  useEffect(() => { if (startDay !== "mon") document.getElementById(`plan-${startDay}`)?.scrollIntoView({ block: "start" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = useMemo(() => Object.keys(draft).some((key) => JSON.stringify(draft[key] ?? []) !== JSON.stringify(k.week[key] ?? [])), [draft, k.week]);
  const total = foodCount(draft, n);
  const shownIn = (key: string) => (who ? (draft[key] ?? []).filter((m) => eats(m, who)) : draft[key] ?? []);

  const put = (key: string, dish: string, people: string[]) => setDraft((x) => ({ ...x, [key]: planDish(x[key] ?? [], dish, people, ids, makeId()) }));
  const take = (key: string, m: KMeal) => setDraft((x) => ({ ...x, [key]: who ? dropPerson(x[key] ?? [], who, ids, m.id) : (x[key] ?? []).filter((y) => y.id !== m.id) }));
  const copyToAll = (from: string, slot: KSlot) => setDraft((x) => {
    const src = (x[from] ?? []).filter((m) => !who || eats(m, who));
    const next = { ...x };
    for (const d of WEEK) {
      const to = cell(d, slot, wk); if (to === from) continue;
      let list = who ? dropPerson(x[to] ?? [], who, ids) : [];
      for (const m of src) list = planDish(list, m.dish, who ? [who] : m.people, ids, makeId());
      next[to] = list;
    }
    return next;
  });
  const copyWeek = () => {
    if (!window.confirm(`Replace the other ${n === 2 ? "week" : "weeks"} with Week ${wk + 1}?`)) return;
    setDraft((x) => { const next = { ...x }; for (let w = 0; w < n; w++) { if (w === wk) continue; for (const d of WEEK) for (const s of K_SLOTS) next[cell(d, s.id, w)] = (x[cell(d, s.id, wk)] ?? []).map((m) => ({ id: makeId(), dish: m.dish, people: [...m.people] })); } return next; });
  };
  const save = () => {
    // Every meal is set, not added to, so Save can't double anything. Meals keep who they're for.
    setK((x) => setCells(x, draft));
    onSaved(total); onClose();
  };
  const close = () => { if (!changed || window.confirm("Close without saving your changes?")) onClose(); };
  /** Who else is on a meal, in words. */
  const note = (m: KMeal) => {
    if (!several) return "";
    if (who) { const others = k.people.filter((p) => p.id !== who && eats(m, p.id)).map((p) => p.name); return !others.length ? "" : others.length === k.people.length - 1 && k.people.length > 2 ? "with everyone" : `with ${others.join(", ")}`; }
    return m.people.length ? k.people.filter((p) => m.people.includes(p.id)).map((p) => p.name).join(", ") : "";
  };

  return <Modal title="Plan your week" eyebrow="Kitchen" onClose={close} wide>
    {several ? <div className="mb-4">
      <PlanProgress people={k.people} week={draft} weeks={n} who={who} onSelect={(id) => { setWho(id); setChoosing(null); }} />
      <p className="mt-2 px-1 text-xs text-slate-500">{person ? <>Showing <b className="font-semibold text-slate-700">{person.name}</b>'s menu. Meals shared with someone else show on both menus.</> : "Tap a name to plan just their meals. Everyone can have a different menu."} The bars count breakfast, lunch and dinner on every day of the plan (snacks and desserts are a bonus).</p>
    </div> : <div className="mb-4"><PlanProgress people={k.people} week={draft} weeks={n} /></div>}
    <p className="mb-3 text-sm text-slate-500">Tap <b className="font-semibold text-slate-700">+ Add</b> next to a meal to pick it. Nothing is saved until you press Save.</p>
      {n > 1 && <div className="mb-3 space-y-1.5" data-testid="planner-weeks">
      <Segmented label="Week" value={String(wk)} onChange={(v) => { setWk(Number(v)); setChoosing(null); }} options={Array.from({ length: n }, (_, i) => ({ id: String(i), label: `Week ${i + 1}` }))} />
      <div className="flex items-center justify-between gap-3 px-1"><p className="text-xs text-slate-500">{fmtRange(dateOf(start, wk, "mon"), 1)}</p>
        <button type="button" onClick={copyWeek} data-testid="copy-week" className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900">Copy this week to every week</button></div>
    </div>}
    <div className="space-y-3">
      {WEEK.map((day) => { const dp = dayProgress(k.people, draft, day, who, wk); return <section key={day} id={`plan-${day}`} className="rounded-2xl border border-slate-200 p-4" data-testid={`plan-day-${day}`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{DAY_LABEL[day]} <span className="ml-1 text-sm font-normal text-slate-400">{fmtShort(dateOf(start, wk, day))}</span></h3>
          <span className={`text-xs tabular-nums ${dp.done === dp.of ? "font-semibold text-emerald-700" : "text-slate-400"}`}>{dp.done === dp.of ? "Planned" : `${dp.done} of ${dp.of} set`}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {slots.map((slot) => { const key = cell(day, slot, wk); const meals = shownIn(key); const open = choosing === key; return <div key={slot} className="py-2.5 first:pt-0 last:pb-0" data-testid={`plan-slot-${day}-${slot}`}>
            <div className="flex items-start gap-3">
              <span className="w-20 shrink-0 pt-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{SLOT_ONE[slot]}</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {meals.map((m) => { const name = dishName(k, m.dish); const n = note(m); const skip = m.dish === SKIP; return <span key={m.id} className={`inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm font-medium ${skip ? "bg-slate-100 text-slate-700 ring-1 ring-slate-300" : "bg-slate-900 text-white"}`}>
                  <span className="truncate">{name}{n && <span className={`font-normal ${skip ? "text-slate-500" : "text-white/60"}`}> · {n}</span>}</span>
                  <button type="button" onClick={() => take(key, m)} aria-label={person ? `Take ${name} off ${person.name}'s ${SLOT_ONE[slot].toLowerCase()} on ${DAY_LABEL[day]}` : `Take ${name} off ${DAY_LABEL[day]} ${SLOT_ONE[slot].toLowerCase()}`} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${skip ? "text-slate-500 hover:bg-slate-200 hover:text-slate-900" : "text-white/70 hover:bg-white/20 hover:text-white"}`}>&times;</button>
                </span>; })}
                <button type="button" onClick={() => setChoosing(open ? null : key)} aria-expanded={open} data-testid={`plan-add-${day}-${slot}`} className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:border-slate-900 hover:text-slate-900">{open ? "Close" : meals.length ? "+ Another" : "+ Add"}</button>
                {meals.length > 0 && !open && <button type="button" onClick={() => copyToAll(key, slot)} className="text-xs font-medium text-slate-400 underline underline-offset-2 hover:text-slate-900">Copy to every day</button>}
              </div>
            </div>
            {open && <Chooser k={k} slot={slot} canSkip={MAIN_SLOTS.includes(slot)} makeId={makeId} setK={setK} taken={meals.map((m) => m.dish)} initial={who ? [who] : []} onPick={(dish, people) => { put(key, dish, people); setChoosing(null); }} />}
          </div>; })}
        </div>
      </section>; })}
    </div>

    <div className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-100 bg-white px-5 pt-3 sm:-mx-7 sm:px-7">
      <p className="mb-2 text-center text-xs text-slate-500">{total ? `${total} meal${total === 1 ? "" : "s"} planned this week` : "No meals planned yet"}</p>
      <div className="flex gap-2">
        <button type="button" onClick={close} className={`${ghost} flex-1`}>Cancel</button>
        <button type="button" onClick={save} disabled={!changed} data-testid="plan-save" className={`${btn} flex-1`}>{changed ? "Save" : "No changes"}</button>
      </div>
    </div>
  </Modal>;
}

/** The dishes for one meal: search, the most popular first, your own dishes on top, or make a new one. */
function Chooser({ k, setK, slot, canSkip, makeId, taken, initial, onPick }: { k: Kitchen; canSkip: boolean; setK: (fn: (k: Kitchen) => Kitchen) => void; slot: KSlot; makeId: () => string; taken: string[]; /** Who's picked to start with (empty: everyone). */ initial: string[]; onPick: (dish: string, people: string[]) => void }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<string[]>(initial);
  const toggle = (id: string) => { const next = people.includes(id) ? people.filter((x) => x !== id) : [...people, id]; if (next.length) setPeople(next.length >= k.people.length ? [] : next); };
  const [all, setAll] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allDishes(k).filter((d) => d.slot === slot && !taken.includes(d.id) && (!s || d.name.toLowerCase().includes(s)))
      .sort((a, b) => Number(!!b.own) - Number(!!a.own) || b.pop - a.pop || a.name.localeCompare(b.name));
  }, [k, slot, q, taken]);
  const shown = all || q.trim() ? list : list.slice(0, 8);
  // A new dish of your own: first, what one serving is, so the list buys the right number of bags and boxes.
  const [sizing, setSizing] = useState<{ name: string; group: string; amount: string; unit: string } | null>(null);
  const make = () => {
    const name = q.trim(); if (!name) return;
    const g = groupForName(name);
    setSizing({ name: name.slice(0, 80), group: g?.id ?? "", amount: g ? String(typicalServing(g)) : "1", unit: g ? (SERVING_UNITS[g.unit]?.[0]?.id ?? "ct") : "ct" });
  };
  const finish = () => {
    if (!sizing) return;
    const g = sizing.group ? groupOf(sizing.group) : undefined;
    const per = g ? servingIn(g, Number(sizing.amount) || 0, sizing.unit) : 0;
    const id = `own-${makeId()}`;
    setK((x) => ({ ...x, own: [...x.own, { id, slot, name: sizing.name, kcal: 0, minutes: 0, tags: [], pop: 0, parts: g && per > 0 ? [{ group: g.id, per }] : [], own: true }] }));
    setSizing(null); setQ("");
    onPick(id, people);
  };
  if (sizing) {
    const g = sizing.group ? groupOf(sizing.group) : undefined;
    const per = g ? servingIn(g, Number(sizing.amount) || 0, sizing.unit) : 0;
    const pack = g ? chosen(k, g.id, per) : undefined;
    const matches = GROUPS_SORTED.filter((x) => x.name.toLowerCase().includes(sizing.name.toLowerCase().split(" ").pop() || "")).slice(0, 6);
    return <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3" data-testid="serving-size">
      <p className="text-sm font-semibold text-slate-900">How much is one serving of {sizing.name}?</p>
      <label className="block text-xs text-slate-500">What you buy
        <select value={sizing.group} onChange={(e) => { const ng = groupOf(e.target.value); setSizing({ ...sizing, group: e.target.value, amount: ng ? String(typicalServing(ng)) : sizing.amount, unit: ng ? SERVING_UNITS[ng.unit][0].id : sizing.unit }); }} className={`${field} mt-1 w-full`} aria-label="What you buy">
          <option value="">Not in the list</option>
          {[...new Map([...(g ? [g] : []), ...matches, ...GROUPS_SORTED].map((x) => [x.id, x])).values()].map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select></label>
      {g && <div className="flex gap-2">
        <input value={sizing.amount} onChange={(e) => setSizing({ ...sizing, amount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" aria-label="Serving amount" className={`${field} w-24`} data-testid="serving-amount" />
        <select value={sizing.unit} onChange={(e) => setSizing({ ...sizing, unit: e.target.value })} aria-label="Serving unit" className={`${field} flex-1`}>
          {SERVING_UNITS[g.unit].map((u) => <option key={u.id} value={u.id}>{g.unit === "ct" ? plural(g.each ?? "piece") : u.label}</option>)}
        </select></div>}
      {g && pack && per > 0 && <p className="text-xs text-slate-600" data-testid="servings-per">{productText(pack)} is about <b>{servingsPer(pack, per)} servings</b>. The list buys only as many as your plan eats.</p>}
      {g && <p className="text-[11px] text-slate-400">Check the nutrition label: "Serving size" is one serving.</p>}
      {!g && <p className="text-xs text-slate-500">Not in the list: it goes on your shopping list by name, one per serving planned.</p>}
      <div className="flex gap-2"><button type="button" onClick={() => setSizing(null)} className={`${ghost} flex-1`}>Back</button><button type="button" onClick={finish} disabled={!!g && per <= 0} className={`${btn} flex-1`} data-testid="serving-save">Add {sizing.name}</button></div>
    </div>;
  }
  return <div className="mt-3 rounded-xl bg-slate-50 p-2.5">
    {k.people.length > 1 && <div className="mb-3"><p className={label}>Who's eating</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5"><button type="button" aria-pressed={!people.length} onClick={() => setPeople([])} className={chip(!people.length)}>Everyone</button>
        {k.people.map((p) => <button key={p.id} type="button" aria-pressed={people.includes(p.id)} onClick={() => toggle(p.id)} className={chip(people.includes(p.id))}>{p.name}</button>)}</div></div>}
    {canSkip && <button type="button" onClick={() => onPick(SKIP, people)} data-testid="skip-meal" className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-left hover:border-slate-900"><span className="text-sm font-medium text-slate-900">Skipping this meal</span><span className="text-[11px] text-slate-500">counts as planned, buys nothing</span></button>}
    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (list[0] && q.trim()) onPick(list[0].id, people); else make(); } }} placeholder="Search, or type your own" aria-label={`Search ${SLOT_ONE[slot].toLowerCase()} dishes`} className={`${field} w-full`} />
    <DidYouMean text={q} onPick={setQ} extra={allDishes(k).map((d) => d.name)} className="mt-1.5" />
    <ul className="mt-2 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
      {shown.map((d) => { const t = takeoutOf(k, d.id); return <li key={d.id}><button type="button" onClick={() => onPick(d.id, people)} data-testid={`choose-${d.id}`} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left ring-1 ring-slate-200 hover:ring-slate-900">
        <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{d.name}</span><span className="block truncate text-[11px] text-slate-500">{t ? `Takeout · ${money(t.perPerson)} a person` : d.own ? "Your dish" : `${d.minutes} min · ${d.kcal} cal`}</span></span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{money(servingCost(k, d))}</span>
      </button></li>; })}
    </ul>
    {!all && !q.trim() && list.length > 8 && <button type="button" onClick={() => setAll(true)} className={`${quiet} mt-2`}>Show all {list.length}</button>}
    {q.trim() && <button type="button" onClick={make} className={`${quiet} mt-2 block`}>Make "{q.trim().slice(0, 40)}" your own dish</button>}
    <p className="mt-1 text-[11px] text-slate-400">Prices are per serving. Tap a planned meal later to change who eats it or its ingredients.</p>
  </div>;
}
