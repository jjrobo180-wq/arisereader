// Inventory (optional): count what's in your kitchen, and the grocery list buys only what's missing. Check this
// week's ingredients in one list, keep a running count of anything else, and set "keep at least" for the things
// you never want to run out of (milk, eggs): the list tops them back up even with no meal planned.
// Leave it empty and nothing changes: the list works the way it always did.
import { useMemo, useState } from "react";
import { GROUPS_SORTED, amountText, groupOf, setKeep, setStock, shoppingLines, trackedIn, type KGroup, type Kitchen } from "@shared/kitchen";
import { Card, field, label, quiet } from "./kit";

type Unit = { word: string; factor: number };
const unitsFor = (g: KGroup): Unit[] => g.unit === "ct" ? [{ word: g.each ? `${g.each}s` : "pieces", factor: 1 }]
  : g.unit === "oz" ? [{ word: "oz", factor: 1 }, { word: "lb", factor: 16 }]
  : [{ word: "fl oz", factor: 1 }, { word: "cups", factor: 8 }, { word: "qt", factor: 32 }, { word: "gal", factor: 128 }];
const bestUnit = (g: KGroup, x: number) => { const us = unitsFor(g); return [...us].reverse().find((u) => x >= u.factor) ?? us[0]; };
const r2 = (x: number) => Math.round(x * 100) / 100;

/** An amount box in a friendly unit (lb, gal), saved in the ingredient's own unit. Empty means "not counted". */
function AmountBox({ g, value, onChange, hint, aria }: { g: KGroup; value: number | undefined; onChange: (v: number | null) => void; hint?: number; aria: string }) {
  const units = unitsFor(g);
  const [unit, setUnit] = useState<Unit>(() => bestUnit(g, value ?? hint ?? 0));
  // While typing, the box shows what you typed; otherwise it shows the saved amount (so "Have it all" fills it in).
  const [typing, setTyping] = useState<string | null>(null);
  const shown = typing ?? (value === undefined ? "" : String(r2(value / unit.factor)));
  const commit = (t: string, u = unit) => { if (t.trim() === "") onChange(null); else { const x = Number(t); if (Number.isFinite(x) && x >= 0) onChange(x * u.factor); } };
  return <span className="flex items-center gap-1">
    <input value={shown} onFocus={() => setTyping(shown)} onBlur={() => setTyping(null)} onChange={(e) => { const t = e.target.value.replace(/[^\d.]/g, "").slice(0, 7); setTyping(t); commit(t); }} inputMode="decimal" placeholder="-" aria-label={aria} className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm font-semibold text-slate-900 outline-none focus:border-slate-900" />
    {units.length > 1 ? <select value={unit.word} onChange={(e) => setUnit(units.find((x) => x.word === e.target.value)!)} aria-label={`${aria} unit`} className="rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-xs text-slate-600">{units.map((u) => <option key={u.word}>{u.word}</option>)}</select>
      : <span className="w-14 truncate text-xs text-slate-500">{units[0].word}</span>}
  </span>;
}

export default function Inventory({ k, setK, onShop }: { k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; onShop: () => void }) {
  const lines = useMemo(() => shoppingLines(k), [k]);
  const planned = lines.filter((l) => l.uses.length);
  const plannedIds = new Set(planned.map((l) => l.group.id));
  const other = Object.keys({ ...k.stock, ...k.keep }).filter((g) => !plannedIds.has(g) && groupOf(g)).map((g) => groupOf(g)!).sort((a, b) => a.name.localeCompare(b.name));
  const [search, setSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const matches = search.trim().length > 1 ? GROUPS_SORTED.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8) : [];
  const counted = Object.keys(k.stock).length + Object.keys(k.keep).length;
  const low = lines.filter((l) => l.keep > 0 && !l.have);
  const toBuy = planned.filter((l) => l.tracked && !l.have).length;

  return <div className="space-y-8" data-testid="kitchen-inventory">
    <p className="text-sm leading-relaxed text-slate-500">Optional. Type in what you have and the grocery list only buys what's missing. Leave a box empty and that item is bought the usual way.</p>
    {planned.length === 0 && <Card className="p-5 text-center text-sm text-slate-500">Plan a few meals and their ingredients show up here, ready to check against your kitchen.</Card>}

    {planned.length > 0 && <section>
      <div className="flex items-end justify-between gap-3"><p className={label}>This week's ingredients</p>{toBuy > 0 && <button type="button" onClick={onShop} className="text-xs font-semibold text-slate-900 underline underline-offset-2">See what to buy</button>}</div>
      <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-100">{planned.map((l) => { const g = l.group; return <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3" data-testid={`inv-${g.id}`}>
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-slate-900">{g.name}</span>
          <span className="block text-xs text-slate-500">Plan needs {amountText(l.need, g)}{l.tracked ? (l.have ? <span className="font-semibold text-emerald-700"> · covered</span> : <span className="font-semibold text-slate-900"> · buy {amountText(l.short, g)}</span>) : !trackedIn(k, g.id) && l.have ? " · counted as at home" : ""}</span></span>
        <span className="flex items-center gap-2">
          <AmountBox g={g} value={k.stock[g.id]} hint={l.need} onChange={(v) => setK((x) => setStock(x, g.id, v))} aria={`${g.name} on hand`} />
          <button type="button" onClick={() => setK((x) => setStock(x, g.id, l.need + l.keep))} className="text-[11px] font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900">Have it all</button>
        </span>
      </li>; })}</ul>
      <p className="mt-2 text-xs text-slate-400">Have some but not enough? Type the amount and the list buys the rest.</p>
    </section>}

    <section>
      <p className={label}>Everything else you keep</p>
      {low.length > 0 && <p className="mt-1.5 text-sm text-slate-600">{low.length} running low, already on your grocery list.</p>}
      {other.length > 0 ? <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-100">{other.map((g) => { const on = k.stock[g.id] ?? 0, keep = k.keep[g.id] ?? 0; return <li key={g.id} className="py-3" data-testid={`inv-${g.id}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-slate-900">{g.name}</span>
            {keep > 0 && <span className={`block text-xs ${on < keep ? "font-semibold text-amber-700" : "text-slate-500"}`}>{on < keep ? `Running low · buying ${amountText(keep - on, g)}` : `Keep at least ${amountText(keep, g)}`}</span>}</span>
          <AmountBox g={g} value={k.stock[g.id]} onChange={(v) => setK((x) => setStock(x, g.id, v ?? 0))} aria={`${g.name} on hand`} />
          <button type="button" aria-label={`Stop counting ${g.name}`} onClick={() => setK((x) => setStock(x, g.id, null))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900">&times;</button>
        </div>
        <label className="mt-1.5 flex items-center justify-end gap-2 text-xs text-slate-500">Keep at least <AmountBox g={g} value={k.keep[g.id]} onChange={(v) => setK((x) => setKeep(x, g.id, v ?? 0))} aria={`Keep at least this much ${g.name}`} /></label>
      </li>; })}</ul> : <p className="mt-1.5 text-sm text-slate-500">Add the things you always keep around. Set "keep at least" and the list tops you up when you run low.</p>}
      <div className="mt-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Add an item (milk, rice, eggs)" aria-label="Add to inventory" className={`${field} w-full`} />
        {matches.length > 0 && <ul className="mt-1 divide-y divide-slate-100 rounded-xl border border-slate-200">{matches.map((g) => <li key={g.id}><button type="button" onClick={() => { setK((x) => (trackedIn(x, g.id) ? x : setStock(x, g.id, 0))); setSearch(""); }} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50"><span className="font-medium text-slate-900">{g.name}</span><span className="text-xs text-slate-400">{trackedIn(k, g.id) ? "Already counted" : g.aisle}</span></button></li>)}</ul>}
        {search.trim().length > 1 && matches.length === 0 && <p className="mt-2 text-xs text-slate-400">Nothing by that name. Try a simpler word.</p>}
      </div>
    </section>

    {counted > 0 && <section className="border-t border-slate-100 pt-4">
      {!confirmReset ? <button type="button" onClick={() => setConfirmReset(true)} className={quiet}>Start the inventory over</button>
        : <div className="flex flex-wrap items-center gap-3 text-sm"><span className="text-slate-600">Forget every count and "keep at least"?</span><button type="button" onClick={() => { setK((x) => ({ ...x, stock: {}, keep: {} })); setConfirmReset(false); }} className="font-semibold text-rose-600">Start over</button><button type="button" onClick={() => setConfirmReset(false)} className={quiet}>Keep it</button></div>}
    </section>}
  </div>;
}
