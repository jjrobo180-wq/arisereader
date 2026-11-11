// Bulk delete: take meals off the plan in one go. The whole week, some days, or one kind of meal (every dinner, say).
// Meals added twice by mistake can be fixed on their own, keeping one of each. Everything here can be undone.
import { useState } from "react";
import { DAY_SHORT, K_SLOTS, WEEK, countMeals, duplicateCount, nWeeks, trackedIn, uses, type KDay, type KScope, type Kitchen, type KSlot } from "@shared/kitchen";
import { Modal } from "../ui";
import { Check, chip, ghost, label } from "./kit";

export default function ClearMeals({ k, onClear, onDedupe, onClose }: {
  k: Kitchen; onClear: (scope: KScope, cooked: boolean) => void; onDedupe: () => void; onClose: () => void;
}) {
  const [days, setDays] = useState<KDay[]>([]);
  const [slots, setSlots] = useState<KSlot[]>([]);
  const [wks, setWks] = useState<number[]>([]);
  const weeks = nWeeks(k);
  const [cooked, setCooked] = useState(false);
  const scope: KScope = { ...(days.length ? { days } : {}), ...(slots.length ? { slots } : {}), ...(wks.length ? { wks } : {}) };
  const n = countMeals(k, scope);
  const dupes = duplicateCount(k);
  const counted = uses(k).some((u) => trackedIn(k, u.key));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const what = `${slots.length ? slots.map((s) => K_SLOTS.find((x) => x.id === s)!.label.toLowerCase()).join(", ") : "meals"} on ${days.length ? days.map((d) => DAY_SHORT[d]).join(", ") : "every day"}${weeks > 1 ? ` in ${wks.length ? wks.map((w) => `week ${w + 1}`).join(", ") : "every week"}` : ""}`;

  return <Modal title="Clear meals" eyebrow="Kitchen" onClose={onClose}>
    {dupes > 0 && <div className="mb-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200" data-testid="dupes-card">
      <p className="text-sm font-semibold text-amber-950">{dupes} meal{dupes === 1 ? " is" : "s are"} on the plan twice</p>
      <p className="mt-1 text-sm text-amber-900">The same dish in the same meal, more than once. Keep one of each and leave the rest of the week alone.</p>
      <button type="button" onClick={() => { onDedupe(); onClose(); }} className={`${ghost} mt-3`} data-testid="dedupe">Remove the {dupes} extra{dupes === 1 ? "" : "s"}</button>
    </div>}

    {weeks > 1 && <>
      <p className={label}>Weeks</p>
      <div className="mb-5 mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setWks([])} className={chip(!wks.length)}>Every week</button>
        {Array.from({ length: weeks }, (_, w) => <button key={w} type="button" aria-pressed={wks.includes(w)} onClick={() => setWks((x) => toggle(x, w))} className={chip(wks.includes(w))}>Week {w + 1}</button>)}
      </div>
    </>}
    <p className={label}>Days</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <button type="button" onClick={() => setDays([])} className={chip(!days.length)}>Every day</button>
      {WEEK.map((d) => <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((x) => toggle(x, d))} className={chip(days.includes(d))}>{DAY_SHORT[d]}</button>)}
    </div>
    <p className={`${label} mt-5`}>Meals</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <button type="button" onClick={() => setSlots([])} className={chip(!slots.length)}>All meals</button>
      {K_SLOTS.map((s) => <button key={s.id} type="button" aria-pressed={slots.includes(s.id)} onClick={() => setSlots((x) => toggle(x, s.id))} className={chip(slots.includes(s.id))}>{s.label}</button>)}
    </div>

    {counted && <button type="button" onClick={() => setCooked((v) => !v)} aria-pressed={cooked} className="mt-5 flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left">
      <span className="mt-0.5"><Check on={cooked} /></span>
      <span className="text-sm"><span className="block font-semibold text-slate-900">We cooked these</span><span className="block text-slate-500">Take what they used out of your inventory too.</span></span>
    </button>}

    <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600" data-testid="clear-summary">{n ? <>Takes <b className="text-slate-900">{n} meal{n === 1 ? "" : "s"}</b> off: {what}. You can undo it.</> : <>Nothing planned for {what}.</>}</div>
    <div className="mt-4 flex gap-2">
      <button type="button" onClick={onClose} className={`${ghost} flex-1`}>Cancel</button>
      <button type="button" disabled={!n} data-testid="clear-confirm" onClick={() => { onClear(scope, cooked); onClose(); }} className="inline-flex flex-1 items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-30">Clear {n || ""} meal{n === 1 ? "" : "s"}</button>
    </div>
  </Modal>;
}
