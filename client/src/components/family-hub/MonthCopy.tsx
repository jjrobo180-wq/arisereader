// Money → Copy months: bring bills, income and spending limits over from last month, or send this month's
// to next month. One button brings everything; or tick just what you want. Only the month being copied
// into changes (shared/moneyPlan.ts copyMonth).
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CopyPlus } from "lucide-react";
import { fromDay, money } from "@shared/familyHub";
import { copyMonth, monthCopyItems, shiftMonth, type MonthCopyItem, type MonthCopyPick, type PlanBill } from "@shared/moneyPlan";
import type { Family } from "@shared/familyHub";
import { Modal, plain, primary } from "./ui";

const monthName = (m: string) => fromDay(`${m}-01`).toLocaleDateString(undefined, { month: "long" });
const THERE = { new: "New", same: "Already there", changes: "Updates it" } as const;
const THERE_STYLE = { new: "bg-violet-50 text-violet-700", same: "bg-slate-100 text-slate-500", changes: "bg-amber-50 text-amber-700" } as const;

export default function MonthCopy({ family, setFamily, month, now, makeId, say, onClose, onDone }: {
  family: Family; setFamily: (u: (f: Family) => Family) => void; month: string; now: string; makeId: () => string; say: (m: string) => void; onClose: () => void; onDone: (to: string) => void;
}) {
  const [dir, setDir] = useState<"in" | "out">("in");
  const from = dir === "in" ? shiftMonth(month, -1) : month;
  const to = dir === "in" ? month : shiftMonth(month, 1);
  const f = { money: family.money, bills: family.bills as PlanBill[], budget: family.budget };
  const { items, limitsDiffer } = useMemo(() => monthCopyItems(f, from, to, now), [family.money, family.bills, family.budget, from, to, now]); // eslint-disable-line react-hooks/exhaustive-deps
  // What's ticked: everything that isn't already there the same way.
  const fresh = (list: MonthCopyItem[]) => new Set(list.filter((i) => i.there !== "same").map((i) => `${i.kind}:${i.id}`));
  const [on, setOn] = useState<Set<string>>(() => fresh(items));
  const [limits, setLimits] = useState(limitsDiffer);
  const [lastKey, setLastKey] = useState(`${from}>${to}`);
  if (lastKey !== `${from}>${to}`) { setLastKey(`${from}>${to}`); setOn(fresh(items)); setLimits(limitsDiffer); }
  const toggle = (k: string) => setOn((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const pickOf = (all: boolean): MonthCopyPick => {
    const has = (kind: MonthCopyItem["kind"], i: MonthCopyItem) => i.kind === kind && (all || on.has(`${kind}:${i.id}`));
    return { bills: items.filter((i) => has("bill", i)).map((i) => i.id), sources: items.filter((i) => has("source", i)).map((i) => i.id), logged: items.filter((i) => has("logged", i) && (!all || i.there !== "same")).map((i) => i.id), held: items.filter((i) => has("held", i)).map((i) => i.id), limits: all ? limitsDiffer : limits };
  };
  const run = (all: boolean) => {
    const pick = pickOf(all);
    const n = pick.bills.length + pick.sources.length + pick.logged.length + (pick.held?.length ?? 0) + (pick.limits ? 1 : 0);
    if (!n) { say("Nothing picked to copy."); return; }
    setFamily((x) => ({ ...x, ...copyMonth({ money: x.money, bills: x.bills as PlanBill[], budget: x.budget }, from, to, pick, makeId, now) }));
    say(`Copied ${n} item${n === 1 ? "" : "s"} into ${monthName(to)}.`);
    onDone(to);
  };
  const group = (kind: MonthCopyItem["kind"], title: string) => {
    const list = items.filter((i) => i.kind === kind);
    if (!list.length) return null;
    const allOn = list.every((i) => on.has(`${kind}:${i.id}`));
    return <section className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <button type="button" onClick={() => setOn((s) => { const n = new Set(s); list.forEach((i) => (allOn ? n.delete(`${kind}:${i.id}`) : n.add(`${kind}:${i.id}`))); return n; })} className="text-xs font-bold text-violet-700">{allOn ? "None" : "All"}</button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">{list.map((i) => { const k = `${kind}:${i.id}`; const ticked = on.has(k); return <li key={k}>
        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2" data-testid={`month-copy-${kind}`}>
          <input type="checkbox" checked={ticked} onChange={() => toggle(k)} className="h-5 w-5 shrink-0 accent-[#6e5ae0]" />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{i.name}</span><span className="block truncate text-xs text-slate-500">{i.detail}</span></span>
          <span className={`hidden shrink-0 rounded-md px-1.5 py-px text-[11px] font-semibold sm:inline ${THERE_STYLE[i.there]}`}>{THERE[i.there]}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{money(i.amount)}</span>
        </label></li>; })}</ul>
    </section>;
  };
  const picked = pickOf(false);
  const count = picked.bills.length + picked.sources.length + picked.logged.length + (picked.held?.length ?? 0) + (picked.limits ? 1 : 0);
  return <Modal title="Copy months" eyebrow="Budget & bills" onClose={onClose}>
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Which way">
      <button type="button" aria-pressed={dir === "in"} onClick={() => setDir("in")} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold ${dir === "in" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`} data-testid="month-copy-in"><ArrowLeft size={15} />From {monthName(shiftMonth(month, -1))}</button>
      <button type="button" aria-pressed={dir === "out"} onClick={() => setDir("out")} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold ${dir === "out" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`} data-testid="month-copy-out">To {monthName(shiftMonth(month, 1))}<ArrowRight size={15} /></button>
    </div>
    <p className="mt-3 text-sm text-slate-500">{monthName(from)} → <b className="text-slate-800">{monthName(to)}</b>. Only {monthName(to)} changes. Bills keep what's already been paid there.</p>
    <button type="button" onClick={() => run(true)} className={`${primary} mt-3 min-h-12 w-full`} data-testid="month-copy-all"><CopyPlus size={17} />Bring all bills and money in {dir === "in" ? `into ${monthName(to)}` : `to ${monthName(to)}`}</button>
    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Or pick what to copy</p>
    {group("bill", "Bills")}
    {group("source", "Income")}
    {group("held", "Money in")}
    {group("logged", `Received in ${monthName(from)}`)}
    {limitsDiffer && <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 px-3">
      <input type="checkbox" checked={limits} onChange={(e) => setLimits(e.target.checked)} className="h-5 w-5 accent-[#6e5ae0]" />
      <span className="text-sm font-semibold text-slate-900">Spending limits</span><span className="text-xs text-slate-500">{monthName(from)}'s categories and limits</span>
    </label>}
    {!items.length && !limitsDiffer && <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">{monthName(from)} has no bills or income to copy yet.</p>}
    <div className="mt-5 flex gap-2">
      <button type="button" onClick={onClose} className={`${plain} flex-1`}>Cancel</button>
      <button type="button" disabled={!count} onClick={() => run(false)} className={`${primary} flex-1`} data-testid="month-copy-picked"><Check size={16} />Copy {count || ""} picked</button>
    </div>
  </Modal>;
}
