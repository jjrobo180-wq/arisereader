// Plan the week in one popup: pick a day, then set its breakfast, lunch and dinner (snacks and desserts too, if you
// want them). Nothing changes until Save, and Save sets each meal rather than adding on top, so a meal can never be
// doubled. "Copy to every day" puts the same breakfast (say) on all seven days in one tap.
import { useMemo, useState } from "react";
import { DAY_LABEL, DAY_SHORT, K_SLOTS, WEEK, allDishes, cell, dishOf, money, servingCost, setCells, takeoutOf, type KDay, type Kitchen, type KMeal, type KSlot } from "@shared/kitchen";
import { Modal } from "../ui";
import { btn, field, ghost, label, quiet } from "./kit";

const MAIN: KSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_ONE: Record<KSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", dessert: "Dessert" };
type Draft = Record<string, KMeal[]>;

export default function WeekPlanner({ k, setK, startDay, makeId, onClose, onSaved }: {
  k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; startDay: KDay; makeId: () => string; onClose: () => void; onSaved: (meals: number) => void;
}) {
  const [day, setDay] = useState<KDay>(startDay);
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(WEEK.flatMap((d) => K_SLOTS.map((s) => [cell(d, s.id), [...(k.week[cell(d, s.id)] ?? [])]]))));
  const usesExtras = WEEK.some((d) => (k.week[cell(d, "snack")]?.length ?? 0) + (k.week[cell(d, "dessert")]?.length ?? 0) > 0);
  const [extras, setExtras] = useState(usesExtras);
  const [choosing, setChoosing] = useState<KSlot | null>(null);
  const slots: KSlot[] = extras ? K_SLOTS.map((s) => s.id) : MAIN;

  const changed = useMemo(() => Object.keys(draft).some((key) => (draft[key] ?? []).map((m) => m.id).join() !== (k.week[key] ?? []).map((m) => m.id).join()), [draft, k.week]);
  const total = Object.values(draft).reduce((a, ms) => a + ms.length, 0);
  const onDay = (d: KDay) => K_SLOTS.reduce((a, s) => a + (draft[cell(d, s.id)]?.length ?? 0), 0);

  const put = (key: string, dish: string) => setDraft((x) => (x[key] ?? []).some((m) => m.dish === dish) ? x : { ...x, [key]: [...(x[key] ?? []), { id: makeId(), dish, people: [] }] });
  const take = (key: string, id: string) => setDraft((x) => ({ ...x, [key]: (x[key] ?? []).filter((m) => m.id !== id) }));
  const copyToAll = (slot: KSlot) => {
    const from = draft[cell(day, slot)] ?? [];
    setDraft((x) => { const next = { ...x }; for (const d of WEEK) if (d !== day) next[cell(d, slot)] = from.map((m) => ({ id: makeId(), dish: m.dish, people: [...m.people] })); return next; });
  };
  const copyDayTo = (to: KDay) => setDraft((x) => { const next = { ...x }; for (const s of K_SLOTS) next[cell(to, s.id)] = (x[cell(day, s.id)] ?? []).map((m) => ({ id: makeId(), dish: m.dish, people: [...m.people] })); return next; });
  const save = () => {
    // Every meal is set, not added to, so Save can't double anything. Existing meals keep who they're for.
    setK((x) => setCells(x, draft));
    onSaved(total); onClose();
  };
  const close = () => { if (!changed || window.confirm("Close without saving your changes?")) onClose(); };
  const next = WEEK[WEEK.indexOf(day) + 1];

  return <Modal title="Plan your week" eyebrow="Kitchen" onClose={close} wide>
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Day">
      {WEEK.map((d) => { const n = onDay(d); return <button key={d} type="button" role="tab" aria-selected={d === day} onClick={() => { setDay(d); setChoosing(null); }} data-testid={`plan-day-${d}`}
        className={`flex min-w-[3.25rem] flex-1 flex-col items-center rounded-xl border px-1 py-2 transition ${d === day ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}>
        <span className="text-xs font-semibold">{DAY_SHORT[d]}</span>
        <span className={`mt-0.5 text-[11px] tabular-nums ${d === day ? "text-white/70" : n ? "text-slate-500" : "text-slate-300"}`}>{n ? `${n} meal${n === 1 ? "" : "s"}` : "empty"}</span>
      </button>; })}
    </div>

    <div className="mt-4 space-y-3">
      {slots.map((slot) => { const key = cell(day, slot); const meals = draft[key] ?? []; return <section key={slot} className="rounded-2xl border border-slate-200 p-3" data-testid={`plan-slot-${slot}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{SLOT_ONE[slot]}</p>
          {meals.length > 0 && <button type="button" onClick={() => copyToAll(slot)} className="text-xs font-medium text-slate-500 hover:text-slate-900">Copy to every day</button>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {meals.map((m) => <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-slate-900 py-1 pl-3 pr-1 text-sm font-medium text-white">
            {dishOf(k, m.dish)?.name ?? "Removed dish"}
            <button type="button" onClick={() => take(key, m.id)} aria-label={`Take ${dishOf(k, m.dish)?.name ?? "it"} off ${DAY_LABEL[day]}`} className="flex h-6 w-6 items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white">&times;</button>
          </span>)}
          <button type="button" onClick={() => setChoosing(choosing === slot ? null : slot)} aria-expanded={choosing === slot} data-testid={`plan-add-${slot}`} className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:border-slate-900 hover:text-slate-900">{choosing === slot ? "Close" : meals.length ? "Add another" : `Pick ${SLOT_ONE[slot].toLowerCase()}`}</button>
        </div>
        {choosing === slot && <Chooser k={k} setK={setK} slot={slot} makeId={makeId} taken={meals.map((m) => m.dish)} onPick={(dish) => { put(key, dish); setChoosing(null); }} />}
      </section>; })}
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={() => setExtras((v) => !v)} className={quiet}>{extras ? "Hide snacks & desserts" : "Add snacks & desserts"}</button>
      {onDay(day) > 0 && <CopyDay from={day} onCopy={copyDayTo} />}
    </div>

    <div className="sticky bottom-0 -mx-5 mt-5 flex gap-2 border-t border-slate-100 bg-white px-5 pt-4 sm:-mx-7 sm:px-7">
      {next ? <button type="button" onClick={() => { setDay(next); setChoosing(null); }} className={`${ghost} flex-1`}>Next: {DAY_SHORT[next]}</button> : <button type="button" onClick={close} className={`${ghost} flex-1`}>Cancel</button>}
      <button type="button" onClick={save} disabled={!changed} data-testid="plan-save" className={`${btn} flex-1`}>{changed ? `Save week · ${total} meal${total === 1 ? "" : "s"}` : "No changes"}</button>
    </div>
  </Modal>;
}

/** The dishes for one meal: search, the most popular first, your own dishes on top, or make a new one. */
function Chooser({ k, setK, slot, makeId, taken, onPick }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; slot: KSlot; makeId: () => string; taken: string[]; onPick: (dish: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allDishes(k).filter((d) => d.slot === slot && !taken.includes(d.id) && (!s || d.name.toLowerCase().includes(s)))
      .sort((a, b) => Number(!!b.own) - Number(!!a.own) || b.pop - a.pop || a.name.localeCompare(b.name));
  }, [k, slot, q, taken]);
  const shown = all || q.trim() ? list : list.slice(0, 8);
  const make = () => {
    const name = q.trim(); if (!name) return;
    const id = `own-${makeId()}`;
    setK((x) => ({ ...x, own: [...x.own, { id, slot, name: name.slice(0, 80), kcal: 0, minutes: 0, tags: [], pop: 0, parts: [], own: true }] }));
    onPick(id);
  };
  return <div className="mt-3 rounded-xl bg-slate-50 p-2.5">
    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (list[0] && q.trim()) onPick(list[0].id); else make(); } }} placeholder="Search, or type your own" aria-label={`Search ${SLOT_ONE[slot].toLowerCase()} dishes`} className={`${field} w-full`} />
    <ul className="mt-2 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
      {shown.map((d) => { const t = takeoutOf(k, d.id); return <li key={d.id}><button type="button" onClick={() => onPick(d.id)} data-testid={`choose-${d.id}`} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left ring-1 ring-slate-200 hover:ring-slate-900">
        <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{d.name}</span><span className="block truncate text-[11px] text-slate-500">{t ? `Takeout · ${money(t.perPerson)} a person` : d.own ? "Your dish" : `${d.minutes} min · ${d.kcal} cal`}</span></span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{money(servingCost(k, d))}</span>
      </button></li>; })}
    </ul>
    {!all && !q.trim() && list.length > 8 && <button type="button" onClick={() => setAll(true)} className={`${quiet} mt-2`}>Show all {list.length}</button>}
    {q.trim() && <button type="button" onClick={make} className={`${quiet} mt-2 block`}>Make "{q.trim().slice(0, 40)}" your own dish</button>}
    <p className="mt-1 text-[11px] text-slate-400">Prices are per serving. Tap a planned meal later to change who eats it or its ingredients.</p>
  </div>;
}

function CopyDay({ from, onCopy }: { from: KDay; onCopy: (to: KDay) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={quiet}>Copy {DAY_SHORT[from]} to another day</button>;
  return <div className="flex flex-wrap items-center gap-1.5"><span className={label}>Copy to</span>
    {WEEK.filter((d) => d !== from).map((d) => <button key={d} type="button" onClick={() => { onCopy(d); setOpen(false); }} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-900">{DAY_SHORT[d]}</button>)}
    <button type="button" onClick={() => setOpen(false)} className="px-1 text-xs text-slate-400">Cancel</button></div>;
}
