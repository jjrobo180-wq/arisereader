// Budget & bills. Built around how this person gets paid (see BudgetSetup and shared/moneyPlan.ts):
// a plan by paycheck or by month, bills that can be split and paid a bit at a time (what's still owed carries over),
// tips, gigs and bonuses logged as they come, spending against limits, goals, and insights.
//
// Look: the LifeHub's own page header and white cards, like every other section. One quiet summary card (no dark
// banner), sentence-case labels, one accent color, green and red only where they mean money in or a problem, and
// numbers in tabular figures so columns line up. Built from the class names the hub's looks and night mode recolor.
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, Wallet, Check, ChevronLeft, ChevronRight, CircleDollarSign, Download,
  HandCoins, Pencil, PiggyBank, Plus, Receipt, Repeat2, RotateCcw, Settings2, Target, Trash2, Undo2,
} from "lucide-react";
import { fromDay, money, toDay, type Expense } from "@shared/familyHub";
import {
  billStatus, byCategory, cents, editMonth, payBillInMonth, unpayBillInMonth, viewMonth, expectedFrom, expectedIncome, FREQ_LABEL, goalProgress, monthCsv, onHandTotal, monthPicture, monthsBack, payPeriods,
  paydays, paydaysToConfirm, receivedIn, safeToSpend, shiftMonth, tipWeeks, type Goal, type IncomeEntry, type IncomeSource, type OnHand, type PayFrequency, type PlanBill, type PlanStyle,
} from "@shared/moneyPlan";
import { Bar, Empty, Label, Modal, PageHead, Panel, Toggle, confirmed, danger, inputClass, plain, primary, shortDate, soft, type SectionProps } from "./ui";
import { ShareButton } from "./ShareLink";
import BudgetSetup, { type SetupResult } from "./BudgetSetup";

type Tab = "overview" | "paychecks" | "bills" | "spending" | "income" | "goals" | "insights";
const STATE_STYLE = { paid: "bg-emerald-50 text-emerald-700", partial: "bg-sky-50 text-sky-700", late: "bg-rose-50 text-rose-600", soon: "bg-amber-50 text-amber-700", later: "bg-slate-100 text-slate-600" };
const STATE_WORD = { paid: "Paid", partial: "Part paid", late: "Past due", soon: "Due", later: "Due" };
const KIND_WORD: Record<IncomeEntry["kind"], string> = { pay: "Paycheck", tips: "Tips", bonus: "Bonus", other: "Other" };
const day = (d: string) => shortDate(d, { month: "short", day: "numeric" });
const blankBill = (id: string): PlanBill => ({ id, name: "", amount: 0, dueDay: 1, category: "", autopay: false, paid: [] });

/** One figure in the summary card: a plain label, the amount, and a line under it. Two to a row on a phone, four on a
 *  computer, divided by hairlines; nothing is cut off (the line under it wraps). */
const Figure = ({ label, value, sub, tone = "text-[#232139]", i }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string; i: number }) =>
  <div className={`min-w-0 border-slate-100 py-3.5 ${i % 2 ? "border-l pl-4" : "pr-4"} ${i > 1 ? "border-t" : ""} lg:border-t-0 ${i ? "lg:border-l lg:pl-5" : "lg:pl-0"} lg:pr-5`} data-testid="budget-figure">
    <p className="text-[13px] font-medium text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-[22px] ${tone}`}>{value}</p>
    {sub && <div className="mt-0.5 text-xs leading-snug text-slate-500">{sub}</div>}
  </div>;
/** The tabs: one segmented control, like the ones in the budget's own dialogs. */
const tabClass = (on: boolean) => `inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg px-3.5 text-sm font-semibold transition ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`;

export default function Money({ family, setFamily, today, makeId, say }: SectionProps) {
  // Before setup, the monthly income typed into the old Budget page still counts (it showed $0 coming in).
  const [month, setMonth] = useState(() => today.slice(0, 7));
  // Each month has its own bills, income and spending limits once it has been changed (shared/moneyPlan.ts viewMonth),
  // so editing one month never touches another.
  const view = useMemo(() => viewMonth(family.money, family.bills as PlanBill[], family.budget, month), [family.money, family.bills, family.budget, month]);
  const plan = useMemo(() => view.plan.sources.length || !(family.income > 0) ? view.plan
    : { ...view.plan, sources: [{ id: "legacy-income", name: "Monthly income", kind: "other" as const, frequency: "irregular" as const, amount: family.income, days: [], anchor: "" }] }, [view.plan, family.income]);
  const bills = view.bills;
  const budget = view.budget;
  /** Changes this month's bills, income or limits only. */
  const editThisMonth = (edit: Parameters<typeof editMonth>[2], setUp?: boolean) => setFamily((f) => ({ ...f, ...editMonth({ money: f.money, bills: f.bills as PlanBill[], budget: f.budget }, month, edit, setUp) }));
  const [tab, setTab] = useState<Tab>(() => { try { return (sessionStorage.getItem("budget-tab") as Tab) || "overview"; } catch { return "overview"; } });
  const go = (t: Tab) => { setTab(t); try { sessionStorage.setItem("budget-tab", t); } catch { /* not kept */ } };
  const [setup, setSetup] = useState(false);
  /** What the budget was before the last setup, so it can be put back in one tap. */
  const [undo, setUndo] = useState<Pick<typeof family, "money" | "bills" | "budget" | "income"> | null>(null);
  const [editBill, setEditBill] = useState<PlanBill | null>(null);
  const [paying, setPaying] = useState<{ bill: PlanBill; amount: number } | null>(null);
  const [income, setIncome] = useState<Partial<IncomeEntry> | null>(null);
  const [source, setSource] = useState<IncomeSource | null>(null);
  const [held, setHeld] = useState<OnHand | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [settings, setSettings] = useState(false);
  const [notYet, setNotYet] = useState<string[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [moving, setMoving] = useState<{ goal: Goal; out: boolean } | null>(null);
  const [expense, setExpense] = useState({ amount: "", categoryId: family.budget[0]?.id || "", note: "", date: today });
  const [newCat, setNewCat] = useState({ name: "", limit: "" });

  const label = fromDay(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isNow = month === today.slice(0, 7);
  const ref = isNow ? today : month < today.slice(0, 7) ? `${month}-31` : `${month}-01`;
  const pic = useMemo(() => monthPicture(plan, bills, family.expenses, budget, month, ref), [plan, bills, family.expenses, budget, month, ref]);
  const safe = useMemo(() => (isNow && plan.style === "paycheck" ? safeToSpend(plan, bills, family.expenses, month, today) : null), [isNow, plan, bills, family.expenses, month, today]);
  const periods = useMemo(() => payPeriods(plan, bills, month, ref), [plan, bills, month, ref]);
  const cats = useMemo(() => byCategory(family.expenses, budget, month), [family.expenses, budget, month]);
  const billRows = useMemo(() => bills.map((b) => ({ b, st: billStatus(plan, b, month, ref) })).sort((a, z) => (a.st.state === "paid" ? 1 : 0) - (z.st.state === "paid" ? 1 : 0) || (a.st.nextDue || "9").localeCompare(z.st.nextDue || "9")), [bills, plan, month, ref]);
  const over = cats.filter((c) => c.limit > 0 && c.spent > c.limit);
  const daysLeft = isNow ? Math.max(1, Number(`${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}`.slice(8)) - Number(today.slice(8)) + 1) : 0;

  const shift = (n: number) => setMonth(shiftMonth(month, n));
  const setMoney = (f: (m: typeof plan) => typeof plan) => setFamily((fam) => ({ ...fam, money: f(fam.money) }));
  const pay = (b: PlanBill, amount: number, date = today) => {
    setFamily((f) => ({ ...f, ...payBillInMonth({ money: f.money, bills: f.bills as PlanBill[], budget: f.budget }, month, b.id, amount, date, makeId()) }));
    say(`${money(amount)} paid toward ${b.name}`);
  };
  const unpay = (b: PlanBill) => { setFamily((f) => ({ ...f, ...unpayBillInMonth({ money: f.money, bills: f.bills as PlanBill[], budget: f.budget }, month, b.id) })); say(`${b.name} marked unpaid for ${label}`); };
  const doneSetup = (r: SetupResult) => {
    setUndo({ money: family.money, bills: family.bills, budget: family.budget, income: family.income });
    setFamily((f) => ({ ...f, money: { ...r.money, months: undefined }, bills: r.bills, budget: r.budget, income: r.income })); setSetup(false); go("overview"); say("Your budget is ready");
  };
  const addExpense = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(expense.amount);
    if (!(amount > 0) || !expense.date) { say("Enter an amount above zero."); return; }
    const row: Expense = { id: makeId(), categoryId: expense.categoryId, amount: cents(amount), date: expense.date, note: expense.note.trim().slice(0, 120) };
    setFamily((f) => ({ ...f, expenses: [...f.expenses, row].slice(-8000) }));
    setExpense({ ...expense, amount: "", note: "" });
    say(`${money(row.amount)} added`);
  };
  const exportCsv = () => {
    const blob = new Blob([monthCsv(plan, bills, family.expenses, budget, month)], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `budget-${month}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // ───────── Summary ─────────
  const headline = safe
    ? { label: `Safe to spend until ${day(safe.until)}`, value: safe.amount, note: `${safe.days} day${safe.days === 1 ? "" : "s"} · about ${money(Math.max(0, Math.floor(safe.amount / safe.days)))} a day` }
    : { label: isNow ? "Left to spend this month" : `Left in ${label}`, value: pic.leftover, note: isNow ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · about ${money(Math.max(0, Math.floor(pic.leftover / Math.max(1, daysLeft))))} a day` : "" };
  // How much of the month's spending plan is used, for the thin bar under the headline.
  const usedPct = pic.budgeted > 0 ? Math.min(100, Math.round((pic.spent / pic.budgeted) * 100)) : 0;
  const summary = <section className="min-w-0 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08] sm:p-6" data-testid="budget-summary">
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{headline.label}</p>
        <p className={`mt-1.5 text-[2.5rem] font-bold leading-none tracking-tight tabular-nums sm:text-5xl ${headline.value < 0 ? "text-rose-600" : "text-[#232139]"}`} data-testid="budget-headline">{money(headline.value)}</p>
        {headline.note && <p className="mt-2 text-sm text-slate-500">{headline.note}</p>}
      </div>
      <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5" role="group" aria-label="Month">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-50"><ChevronLeft size={18} /></button>
        <button type="button" onClick={() => setMonth(today.slice(0, 7))} title={isNow ? undefined : "Back to this month"} className="min-w-[8.5rem] rounded-lg px-2 text-center text-sm font-semibold tabular-nums text-slate-900">{label}</button>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-50"><ChevronRight size={18} /></button>
      </div>
    </div>
    <div className="mt-5 grid grid-cols-2 border-t border-slate-100 lg:grid-cols-4">
      <Figure i={0} label="Coming in" value={money(pic.income)} sub={pic.expected || pic.received ? `${money(pic.received)} received so far` : "Add how you get paid"} tone="text-emerald-700" />
      <Figure i={1} label="Bills left" value={money(pic.billsLeft)} sub={`of ${money(pic.billsOwed)} this month`} />
      <Figure i={2} label="Spent" value={money(pic.spent)} sub={pic.budgeted ? <><span className="mb-1.5 mt-1 block max-w-[10rem]" role="img" aria-label={`${usedPct}% of planned spending used`}><Bar value={pic.spent} max={pic.budgeted} warn={pic.spent > pic.budgeted} /></span>{`of ${money(pic.budgeted)} planned`}</> : "this month"} tone={pic.budgeted && pic.spent > pic.budgeted ? "text-rose-600" : "text-[#232139]"} />
      <Figure i={3} label={pic.unplanned >= 0 ? "Not planned yet" : "Over-planned"} value={money(Math.abs(pic.unplanned))} sub={pic.goals ? `after ${money(pic.goals)} to goals` : "after bills and spending"} tone={pic.unplanned < 0 ? "text-rose-600" : "text-[#232139]"} />
    </div>
  </section>;

  const alerts = [
    ...(pic.late ? [<span key="late">{pic.late === 1 ? "1 bill is" : `${pic.late} bills are`} past due. <button type="button" className="underline" onClick={() => go("bills")}>See bills</button></span>] : []),
    ...(over.length ? [<span key="over">Over the limit: {over.map((c) => c.name).join(", ")}.</span>] : []),
  ];

  // Paydays that have come: did the money land? One tap logs it.
  const confirm = isNow ? paydaysToConfirm(plan, month, today).filter((c) => !notYet.includes(`${c.source.id}|${c.date}`)) : [];
  const logPay = (s: IncomeSource, date: string, amount: number) => {
    setMoney((m) => ({ ...m, incomeLog: [...m.incomeLog, { id: makeId(), sourceId: s.id, date, amount: cents(amount), kind: "pay" as const, note: "" }].slice(-4000) }));
    say(`${money(amount)} from ${s.name} logged`);
  };
  const checkIn = confirm.length > 0 && <section className="space-y-2" data-testid="budget-checkin">{confirm.slice(0, 3).map((c) => <div key={c.source.id + c.date} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e7e8f0] bg-white p-3.5">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Wallet size={18} /></span>
    <span className="min-w-0 flex-1 text-sm"><span className="block font-semibold text-slate-900">Did {c.source.name} pay you {money(c.source.amount)}?</span><span className="text-slate-500">Payday was {day(c.date)}</span></span>
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => logPay(c.source, c.date, c.source.amount)} className={primary + " !min-h-9"} data-testid="budget-checkin-yes"><Check size={15} /> Yes</button>
      <button type="button" onClick={() => setIncome({ kind: "pay", sourceId: c.source.id, amount: c.source.amount, date: c.date })} className={plain + " !min-h-9"}>Different amount</button>
      <button type="button" onClick={() => setNotYet((n) => [...n, `${c.source.id}|${c.date}`])} className="min-h-9 px-2 text-sm font-medium text-slate-500 hover:text-slate-700">Not yet</button>
    </span>
  </div>)}</section>;

  // ───────── Tabs ─────────
  const TABS: [Tab, string][] = [["overview", "Overview"], ...(plan.style === "paycheck" ? [["paychecks", "Paychecks"] as [Tab, string]] : []),
    ["bills", "Bills"], ["spending", "Spending"], ["income", "Income"], ["goals", "Goals"], ["insights", "Insights"]];
  const shown: Tab = tab === "paychecks" && plan.style !== "paycheck" ? "overview" : tab;

  const billRow = ({ b, st }: (typeof billRows)[number], compact = false) => <li key={b.id} className="flex items-center gap-3 py-3" data-testid="budget-bill">
    <button type="button" onClick={() => (st.state === "paid" ? unpay(b) : pay(b, st.nextAmount || st.left))} aria-label={st.state === "paid" ? `Mark ${b.name} unpaid` : `Pay ${money(st.nextAmount || st.left)} toward ${b.name}`} aria-pressed={st.state === "paid"}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${st.state === "paid" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent hover:border-[#6e5ae0] hover:text-[#6e5ae0]"}`}><Check size={15} strokeWidth={3} /></button>
    <button type="button" onClick={() => setEditBill({ ...b })} className="min-w-0 flex-1 text-left">
      <span className={`block truncate text-[15px] font-semibold ${st.state === "paid" ? "text-slate-400 line-through" : "text-slate-900"}`}>{b.name}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
        <span className={`rounded-md px-1.5 py-px text-xs font-semibold ${STATE_STYLE[st.state]}`}>{STATE_WORD[st.state]}{st.state !== "paid" && st.nextDue ? ` ${day(st.nextDue)}` : ""}</span>
        {b.parts && <span>{b.parts.map((p) => `${money(p.amount)} on the ${p.day}${["st", "nd", "rd"][((p.day + 90) % 100 - 10) % 10 - 1] || "th"}`).join(" + ")}</span>}
        {st.carried > 0 && <span className="rounded-md bg-rose-50 px-1.5 py-px text-xs font-semibold text-rose-600">+{money(st.carried)} from last month</span>}
        {b.autopay && <span className="inline-flex items-center gap-1"><Repeat2 size={12} /> Autopay</span>}
      </span>
      {st.state === "partial" || (st.paid > 0 && st.left > 0) ? <span className="mt-2 block max-w-xs"><Bar value={st.paid} max={st.owed} /></span> : null}
    </button>
    <span className="shrink-0 text-right">
      <span className="block text-[15px] font-semibold tabular-nums text-slate-900">{money(st.state === "paid" ? st.owed : st.left)}</span>
      {st.paid > 0 && st.left > 0 && <span className="block text-xs text-slate-500">{money(st.paid)} paid</span>}
    </span>
    {!compact && st.state !== "paid" && <button type="button" onClick={() => setPaying({ bill: b, amount: st.nextAmount || st.left })} className={soft + " !min-h-9 shrink-0 !px-3"}>Pay</button>}
  </li>;

  // Spending
  function catList(limit?: number) {
    const list = cats.filter((c) => c.limit > 0 || c.spent > 0).slice(0, limit ?? 99);
    if (!list.length) return <p className="text-sm text-slate-500">No limits set yet. <button type="button" className="font-semibold text-violet-700 hover:underline" onClick={() => go("spending")}>Set them</button></p>;
    return <ul className="space-y-4">{list.map((c) => {
      const pct = c.limit ? c.spent / c.limit : 0;
      return <li key={c.id || "other"}>
        <div className="mb-1.5 flex items-baseline gap-2 text-sm"><span className="min-w-0 flex-1 truncate font-medium text-slate-900">{c.name}</span>
          <span className={`font-semibold tabular-nums ${pct > 1 ? "text-rose-600" : "text-slate-900"}`}>{money(c.spent)}</span>{c.limit > 0 && <span className="text-[13px] tabular-nums text-slate-500">of {money(c.limit)}</span>}</div>
        <Bar value={c.spent} max={c.limit || Math.max(c.spent, 1)} warn={pct > 1} color={pct > 0.9 ? "#d97706" : "#6e5ae0"} />
        {c.limit > 0 && <p className={`mt-1 text-xs ${pct > 1 ? "font-medium text-rose-600" : "text-slate-500"}`}>{pct > 1 ? `${money(c.spent - c.limit)} over` : `${money(c.limit - c.spent)} left`}</p>}
      </li>;
    })}</ul>;
  }
  // One row when the panel has the room (a tablet, or a computer before the tab splits into two columns);
  // otherwise two to a row, so the category and note never squeeze down to nothing.
  const spendFormEl = (wide: boolean) => <form onSubmit={addExpense} className={`grid grid-cols-2 gap-2 ${wide ? "sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.2fr)_150px_auto] xl:grid-cols-2" : ""}`}>
    <input type="number" inputMode="decimal" min={0} step="0.01" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} placeholder="$ 0.00" aria-label="Amount" className={inputClass} />
    <select value={expense.categoryId} onChange={(e) => setExpense({ ...expense, categoryId: e.target.value })} aria-label="Category" className={inputClass}>{budget.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="">Other</option></select>
    <input value={expense.note} maxLength={120} onChange={(e) => setExpense({ ...expense, note: e.target.value })} placeholder="What for?" aria-label="Note" className={inputClass + ` col-span-2 ${wide ? "sm:col-span-1 xl:col-span-2" : ""}`} />
    <input type="date" value={expense.date} onChange={(e) => setExpense({ ...expense, date: e.target.value })} aria-label="Date" className={inputClass} />
    <button type="submit" className={primary}><Plus size={17} /> Add</button>
  </form>;
  const monthExpenses = family.expenses.filter((x) => x.date.startsWith(month)).sort((a, z) => z.date.localeCompare(a.date));
  const spending = <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <Panel title="Limits" right={<span className="text-sm font-semibold tabular-nums">{money(pic.spent)}<span className="font-semibold text-slate-500"> / {money(pic.budgeted)}</span></span>}>
      <ul className="space-y-4">{budget.map((c) => {
        const spent = cats.find((x) => x.id === c.id)?.spent || 0;
        return <li key={c.id}>
          <div className="mb-1.5 flex items-center gap-2 text-sm"><input value={c.name} maxLength={40} onChange={(e) => editThisMonth((v) => ({ ...v, budget: v.budget.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) }))} onBlur={(e) => { if (!e.target.value.trim()) editThisMonth((v) => ({ ...v, budget: v.budget.map((x) => (x.id === c.id ? { ...x, name: "Untitled" } : x)) })); }} aria-label={`Rename ${c.name}`} className="min-w-0 flex-1 truncate rounded-lg bg-transparent px-1 py-1 font-bold outline-none hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-200" />
            <span className={`text-xs font-bold tabular-nums ${c.limit && spent > c.limit ? "text-rose-600" : "text-slate-600"}`}>{money(spent)} of</span>
            <span className="relative w-24"><span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
              <input type="number" min={0} value={c.limit || ""} placeholder="limit" onChange={(e) => editThisMonth((v) => ({ ...v, budget: v.budget.map((x) => (x.id === c.id ? { ...x, limit: Math.max(0, Number(e.target.value) || 0) } : x)) }))} aria-label={`${c.name} monthly limit`} className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-5 pr-2 text-right text-xs font-bold text-slate-700 focus:border-violet-400 focus:outline-none" /></span>
            {!family.expenses.some((x) => x.categoryId === c.id) && <button type="button" onClick={() => editThisMonth((v) => ({ ...v, budget: v.budget.filter((x) => x.id !== c.id) }))} className="text-slate-400 hover:text-rose-500" aria-label={`Remove ${c.name}`}><Trash2 size={14} /></button>}
          </div>
          <Bar value={spent} max={c.limit || Math.max(spent, 1)} warn={!!c.limit && spent > c.limit} color={c.limit ? "#6e5ae0" : "#cbd5e1"} />
        </li>;
      })}</ul>
      <form onSubmit={(e) => { e.preventDefault(); const name = newCat.name.trim(); if (!name) return; editThisMonth((v) => ({ ...v, budget: [...v.budget, { id: makeId(), name: name.slice(0, 40), limit: Math.max(0, Number(newCat.limit) || 0) }] })); setNewCat({ name: "", limit: "" }); }} className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
        <input value={newCat.name} maxLength={40} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="New category" aria-label="New category" className={inputClass + " min-w-0"} />
        <input type="number" min={0} value={newCat.limit} onChange={(e) => setNewCat({ ...newCat, limit: e.target.value })} placeholder="$ / mo" aria-label="Monthly limit" className={inputClass + " w-24"} />
        <button type="submit" className={primary} aria-label="Add category"><Plus size={17} /></button>
      </form>
    </Panel>
    <Panel title={`Spending in ${label}`}>
      {spendFormEl(true)}
      {monthExpenses.length ? <ul className="mt-4 divide-y divide-slate-100">{monthExpenses.slice(0, 80).map((x) => <li key={x.id} className="flex items-center gap-3 py-2.5 text-sm">
        <button type="button" onClick={() => setEditExpense({ ...x })} aria-label={`Edit ${x.note || "spending"}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-14 shrink-0 text-xs font-bold text-slate-500">{day(x.date)}</span>
        <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{x.note || budget.find((c) => c.id === x.categoryId)?.name || "Other"}</span>{x.note && <span className="text-xs text-slate-500"> · {family.budget.find((c) => c.id === x.categoryId)?.name || "Other"}</span>}</span>
        <span className="font-semibold tabular-nums">{money(x.amount)}</span></button>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, expenses: f.expenses.filter((e) => e.id !== x.id) }))} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-500" aria-label="Remove"><Trash2 size={14} /></button>
      </li>)}</ul> : <p className="mt-4 text-sm text-slate-500">Nothing logged for {label} yet.</p>}
    </Panel>
  </div>;

  const nextBills = billRows.filter((r) => r.st.state !== "paid").slice(0, 5);
  const overview = <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
    <div className="space-y-5">
      {checkIn}
      <Panel title="Bills to pay" right={<button type="button" onClick={() => go("bills")} className={plain}>All bills</button>}>
        {nextBills.length ? <ul className="divide-y divide-slate-100">{nextBills.map((r) => billRow(r))}</ul> : <p className="text-sm text-slate-500">{bills.length ? `Every bill is paid for ${label}.` : "No bills yet."}</p>}
      </Panel>
      {plan.style === "paycheck" && periods.periods.length > 0 && <Panel title="Paychecks this month" right={<button type="button" onClick={() => go("paychecks")} className={plain}>Plan</button>}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">{periods.periods.map((p) => <li key={p.start} className="rounded-2xl bg-slate-50 p-3.5">
          <p className="text-[13px] text-slate-500">{day(p.start)}{p.sources.every((s) => s.received) ? " · received" : ""}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{money(p.amount)}</p>
          <p className="text-xs text-slate-500">{money(p.billTotal)} bills · <span className={`font-medium ${p.left < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(p.left)} left</span></p>
        </li>)}</ul>
      </Panel>}
    </div>
    <div className="space-y-5">
      <Panel title="Log spending">{spendFormEl(false)}</Panel>
      <Panel title="Spending limits" right={<button type="button" onClick={() => go("spending")} className={plain}>All</button>}>{catList(4)}</Panel>
    </div>
  </div>;

  // Bills
  const billsTab = <Panel title={`Bills for ${label}`} right={<div className="flex flex-wrap items-center gap-1.5"><ShareButton target="bills" title="Our bills" say={say} compact /><button type="button" onClick={() => setEditBill(blankBill(makeId()))} className={soft}><Plus size={16} /> Add bill</button></div>}>
    {bills.length ? <>
      <ul className="divide-y divide-slate-100">{billRows.map((r) => billRow(r))}</ul>
      <div className="mt-3 border-t border-slate-100 pt-3"><div className="mb-1.5 flex justify-between text-xs font-bold text-slate-600"><span>{money(pic.billsPaid)} paid</span><span>{money(pic.billsOwed)} this month</span></div><Bar value={pic.billsPaid} max={pic.billsOwed || 1} color="#22c55e" /></div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Tap the box to pay the next amount due. Use <b>Pay</b> to pay part of a bill; what's left stays due, and anything still owed at the end of the month carries into the next.</p>
    </> : <Empty icon={<Receipt size={24} />} title="No bills yet" action={<button type="button" onClick={() => setEditBill(blankBill(makeId()))} className={soft}><Plus size={16} /> Add a bill</button>}>Rent, utilities, phone, insurance. They repeat every month, and can be split into payments.</Empty>}
  </Panel>;

  // Paychecks
  const periodCard = (p: (typeof periods.periods)[number], before = false) => <section key={p.start} className="min-w-0 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-5" data-testid="budget-period">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[13px] font-medium text-slate-500">{before ? `Before ${day(addDay(p.end))}` : `${day(p.start)} – ${day(p.end)}`}</p>
        <h3 className="mt-0.5 text-lg font-semibold text-slate-900">{before ? "Paid from last month's check" : p.sources.map((s) => s.name).join(" + ")}</h3>
      </div>
      {!before && <div className="text-right"><p className="text-2xl font-semibold tabular-nums">{money(p.amount)}</p>
        {p.sources.map((s) => s.received ? <p key={s.id} className="text-xs font-medium text-emerald-700"><Check size={12} className="inline" /> {s.name} received</p>
          : <button key={s.id} type="button" onClick={() => setIncome({ kind: "pay", sourceId: s.id, amount: s.amount, date: s.date })} className="text-xs font-semibold text-violet-700 hover:underline">Mark as paid</button>)}</div>}
    </div>
    <ul className="mt-3 divide-y divide-slate-100">{p.bills.length ? p.bills.map((x, i) => <li key={x.bill.id + i} className="flex items-center gap-3 py-2.5 text-sm">
      <button type="button" disabled={x.paid} onClick={() => pay(x.bill, x.amount)} aria-label={x.paid ? `${x.bill.name} paid` : `Pay ${money(x.amount)} toward ${x.bill.name}`} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${x.paid ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent hover:border-[#6e5ae0]"}`}><Check size={14} strokeWidth={3} /></button>
      <span className={`min-w-0 flex-1 truncate font-medium ${x.paid ? "text-slate-400 line-through" : "text-slate-900"}`}>{x.bill.name}{x.bill.parts ? " (part)" : ""}</span>
      <span className="text-xs text-slate-500">{day(x.due)}</span>
      <span className="w-20 text-right font-semibold tabular-nums">{money(x.amount)}</span>
    </li>) : <li className="py-2 text-sm text-slate-500">No bills due in this stretch.</li>}</ul>
    {!before && <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs font-medium">
      <div><p className="text-slate-500">Bills</p><p className="text-base font-semibold tabular-nums">{money(p.billTotal)}</p></div>
      <div><p className="text-slate-500">Goals</p><p className="text-base font-semibold tabular-nums">{money(p.goalTotal)}</p></div>
      <div><p className="text-slate-500">To spend</p><p className={`text-base font-semibold tabular-nums ${p.left < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(p.left)}</p></div>
    </div>}
  </section>;
  const addDay = (d: string) => { const x = fromDay(d); x.setDate(x.getDate() + 1); return toDay(x); };
  const paychecks = periods.periods.length ? <div className="space-y-4">
    <p className="text-sm text-slate-600">Each check covers the bills due before the next one. Tap a bill when you pay it.</p>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{periods.before && periodCard(periods.before, true)}{periods.periods.map((p) => periodCard(p))}</div>
  </div> : <Empty icon={<Wallet size={24} />} title="No paydays set up" action={<button type="button" onClick={() => setSetup(true)} className={soft}><Settings2 size={16} /> Set up how you get paid</button>}>Tell us when you get paid and each check gets its own plan.</Empty>;

  // Income
  const tw = tipWeeks(plan, today);
  const hasTips = plan.sources.some((s) => s.kind === "tips") || plan.incomeLog.some((e) => e.kind === "tips");
  const monthIncome = plan.incomeLog.filter((e) => e.date.startsWith(month)).sort((a, z) => z.date.localeCompare(a.date));
  const maxTip = Math.max(1, ...tw.weeks.map((w) => w.total));
  const incomeTab = <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div className="space-y-5">
      {checkIn}
      <Panel title={`Income for ${label}`} right={<button type="button" onClick={() => setIncome({ kind: hasTips ? "tips" : "pay", date: today })} className={primary}><Plus size={16} /> Log income</button>}>
        <div className="mb-3 grid grid-cols-2 border-y border-slate-100">
          <Figure i={0} label="Received" value={money(receivedIn(plan, month))} tone="text-emerald-700" />
          <Figure i={1} label="Expected" value={money(expectedIncome(plan, month))} />
        </div>
        {monthIncome.length ? <ul className="divide-y divide-slate-100">{monthIncome.map((e) => <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm" data-testid="budget-income-row">
          <button type="button" onClick={() => setIncome({ ...e })} aria-label="Edit this income" className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="w-14 shrink-0 text-xs tabular-nums text-slate-500">{day(e.date)}</span>
          <span className="min-w-0 flex-1 truncate"><span className="font-medium text-slate-900">{e.note || plan.sources.find((s) => s.id === e.sourceId)?.name || KIND_WORD[e.kind]}</span><span className="text-xs text-slate-500"> · {KIND_WORD[e.kind]}</span></span>
          <span className="font-semibold tabular-nums text-emerald-700">+{money(e.amount)}</span></button>
          <button type="button" onClick={() => { setMoney((m) => ({ ...m, incomeLog: m.incomeLog.filter((x) => x.id !== e.id) })); say("Removed"); }} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${money(e.amount)} from ${day(e.date)}`} data-testid="budget-income-delete"><Trash2 size={15} /></button>
        </li>)}</ul> : <p className="text-sm text-slate-500">Nothing logged yet. Log paychecks, tips, gig pay and bonuses as they come in.</p>}
      </Panel>
    </div>
    <div className="space-y-5">
      {hasTips && <Panel title="Tips by week" right={<span className="text-right text-xs text-slate-500">This week <b className="text-base font-semibold tabular-nums text-slate-900">{money(tw.weeks[tw.weeks.length - 1]?.total || 0)}</b>{tw.average > 0 && <><br />Usual week {money(tw.average)}</>}</span>}>
        <div className="flex items-end gap-2" role="img" aria-label={`Tips for the last ${tw.weeks.length} weeks`}>{tw.weeks.map((w, i) => <div key={w.start} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-medium tabular-nums text-slate-500">{w.total ? `$${Math.round(w.total)}` : ""}</span>
          <span className="flex h-28 w-full items-end"><span className={`block w-full rounded-t-md ${i === tw.weeks.length - 1 ? "bg-[#6e5ae0]" : "bg-violet-200"}`} style={{ height: `${Math.max(3, (w.total / maxTip) * 100)}%` }} /></span>
          <span className="text-[10px] text-slate-500">{day(w.start)}</span>
        </div>)}</div>
        <button type="button" onClick={() => setIncome({ kind: "tips", date: today })} className={soft + " mt-4 w-full"}><Plus size={16} /> Log tonight's tips</button>
      </Panel>}
      <Panel title="Income sources" right={<button type="button" onClick={() => setSource({ id: makeId(), name: "", kind: "paycheck", frequency: "biweekly", amount: 0, days: [], anchor: today })} className={soft} data-testid="budget-source-add"><Plus size={15} /> Add</button>}>
        {view.plan.sources.length ? <ul className="divide-y divide-slate-100">{view.plan.sources.map((s) => <li key={s.id} className="flex items-center gap-3 py-3 text-sm" data-testid="budget-source">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700">{s.kind === "tips" ? <HandCoins size={16} /> : s.kind === "paycheck" ? <Wallet size={16} /> : <CircleDollarSign size={16} />}</span>
          <button type="button" onClick={() => setSource({ ...s })} className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold text-slate-900">{s.name}</span><span className="block text-xs text-slate-500">{sourceLine(s, month)}</span></button>
          <span className="font-semibold tabular-nums">{money(expectedFrom(s, month))}</span>
          <button type="button" onClick={() => setSource({ ...s })} aria-label={`Edit ${s.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-700"><Pencil size={15} /></button>
          <button type="button" onClick={() => { if (confirmed(`Remove "${s.name}" from your income? Money already logged from it stays.`)) { editThisMonth((v) => ({ ...v, sources: v.sources.filter((x) => x.id !== s.id) })); say(`${s.name} removed`); } }} aria-label={`Remove ${s.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" data-testid="budget-source-delete"><Trash2 size={15} /></button>
        </li>)}</ul> : <p className="text-sm text-slate-500">{family.income > 0 ? `Using ${money(family.income)} a month from before. Add how you get paid for a real plan.` : "Add how you get paid: a paycheck, tips, gig money or anything else."}</p>}
        <div className="mt-5 border-t border-slate-100 pt-4" data-testid="money-in">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-slate-900">Money in</h3><p className="text-xs text-slate-500">Money you already have: cash, checking, savings you can spend. It counts toward what's left.</p></div>
            <button type="button" onClick={() => setHeld({ id: makeId(), name: "", amount: 0 })} className={soft} data-testid="money-in-add"><Plus size={15} /> Add</button>
          </div>
          {plan.onHand.length > 0 && <ul className="mt-2 divide-y divide-slate-100">{plan.onHand.map((o) => <li key={o.id} className="flex items-center gap-3 py-2.5 text-sm" data-testid="money-in-row">
            <button type="button" onClick={() => setHeld({ ...o })} className="min-w-0 flex-1 truncate text-left font-semibold text-slate-900">{o.name}</button>
            <span className="font-semibold tabular-nums text-emerald-700">{money(o.amount)}</span>
            <button type="button" onClick={() => setHeld({ ...o })} aria-label={`Edit ${o.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-700"><Pencil size={15} /></button>
            <button type="button" onClick={() => { setMoney((m) => ({ ...m, onHand: m.onHand.filter((x) => x.id !== o.id) })); say(`${o.name} removed`); }} aria-label={`Remove ${o.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
          </li>)}</ul>}
          {plan.onHand.length > 0 && <p className="mt-2 flex justify-between text-sm font-semibold text-slate-900"><span>Total on hand</span><span className="tabular-nums" data-testid="money-in-total">{money(onHandTotal(plan))}</span></p>}
        </div>
      </Panel>
    </div>
  </div>;

  // Goals
  const goalsTab = <div className="space-y-4">
    <div className="flex justify-end"><button type="button" onClick={() => setGoal({ id: makeId(), name: "", kind: "save", target: 0, start: 0, due: "", monthly: 0, color: "#6e5ae0" })} className={primary}><Plus size={16} /> New goal</button></div>
    {plan.goals.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{plan.goals.map((g) => {
      const gp = goalProgress(plan, g, today);
      return <section key={g.id} className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08]" data-testid="budget-goal">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: g.color }}>{g.kind === "debt" ? <Receipt size={19} /> : <PiggyBank size={19} />}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-base font-semibold text-slate-900">{g.name}</p><p className="text-[13px] text-slate-500">{g.kind === "debt" ? "Paying off" : "Saving"}{g.monthly ? ` · ${money(g.monthly)} a month` : ""}</p></div>
          <button type="button" onClick={() => setGoal({ ...g })} aria-label={`Edit ${g.name}`} className="rounded-lg p-1.5 text-slate-400 hover:text-violet-600"><Pencil size={15} /></button>
        </div>
        <p className="mt-4 text-[28px] font-semibold leading-none tabular-nums tracking-tight text-slate-900">{money(gp.saved)}<span className="text-base font-medium text-slate-500"> of {money(g.target)}</span></p>
        <div className="mt-3"><Bar value={gp.saved} max={g.target || 1} color={g.color} /></div>
        <p className="mt-2 text-xs text-slate-500">{gp.percent}% · {gp.left ? `${money(gp.left)} to go` : "Reached"}{gp.finish && gp.left ? ` · done by ${fromDay(`${gp.finish}-01`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}</p>
        {g.due && gp.left > 0 && <p className={`mt-1 text-xs font-medium ${gp.onTrack ? "text-emerald-700" : "text-amber-700"}`}>{gp.onTrack ? "On track" : `Needs ${money(gp.needed)} a month`} for {day(g.due)}</p>}
        <div className="mt-4 flex gap-2"><button type="button" onClick={() => setMoving({ goal: g, out: false })} className={soft + " flex-1"}><ArrowUpRight size={15} /> {g.kind === "debt" ? "Pay" : "Add"}</button>
          <button type="button" onClick={() => setMoving({ goal: g, out: true })} className={plain}><ArrowDownRight size={15} /> {g.kind === "debt" ? "Undo" : "Take out"}</button></div>
      </section>;
    })}</div> : <Empty icon={<Target size={24} />} title="No goals yet" action={<button type="button" onClick={() => setGoal({ id: makeId(), name: "Emergency fund", kind: "save", target: 1000, start: 0, due: "", monthly: 0, color: "#6e5ae0" })} className={soft}><Plus size={16} /> Start an emergency fund</button>}>Save for something, or pay down a debt. Bonuses and big tip weeks are a great place to start.</Empty>}
  </div>;

  // Insights
  const hist = monthsBack(family.money, family.bills as PlanBill[], family.expenses, month);
  const top = Math.max(1, ...hist.flatMap((h) => [h.income, h.spent + h.bills]));
  const catsTotal = cats.reduce((t, c) => t + c.spent, 0) || 1;
  const PALETTE = ["#6e5ae0", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"];
  const insights = <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
    <Panel title={<>Money in and out <span className="text-sm font-normal text-slate-500">· last 6 months</span></>}>
      <div className="flex h-48 items-end gap-3" role="img" aria-label="Income and spending by month">{hist.map((h) => <div key={h.month} className="flex flex-1 flex-col items-center gap-1.5">
        <div className="flex h-40 w-full items-end justify-center gap-1">
          <span className="w-1/2 max-w-[18px] rounded-t-md bg-emerald-600" style={{ height: `${(h.income / top) * 100}%` }} title={`In ${money(h.income)}`} />
          <span className="w-1/2 max-w-[18px] rounded-t-md bg-[#6e5ae0]" style={{ height: `${((h.spent + h.bills) / top) * 100}%` }} title={`Out ${money(h.spent + h.bills)}`} />
        </div>
        <span className="text-[11px] text-slate-500">{fromDay(`${h.month}-01`).toLocaleDateString(undefined, { month: "short" })}</span>
      </div>)}</div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Money in (logged)</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#6e5ae0]" /> Bills + spending</span></div>
    </Panel>
    <Panel title={`Where it went in ${label}`}>
      {cats.some((c) => c.spent > 0) ? <>
        <div className="mb-4 flex h-3 gap-0.5 overflow-hidden rounded-full">{cats.filter((c) => c.spent > 0).map((c, i) => <span key={c.id || "o"} style={{ width: `${(c.spent / catsTotal) * 100}%`, background: PALETTE[i % PALETTE.length] }} title={c.name} />)}</div>
        <ul className="space-y-2">{cats.filter((c) => c.spent > 0).map((c, i) => <li key={c.id || "o"} className="flex items-center gap-2.5 text-sm"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="min-w-0 flex-1 truncate font-medium text-slate-900">{c.name}</span><span className="text-xs font-bold text-slate-500">{Math.round((c.spent / catsTotal) * 100)}%</span><span className="w-20 text-right font-semibold tabular-nums">{money(c.spent)}</span></li>)}</ul>
      </> : <p className="text-sm text-slate-500">Log some spending to see where your money goes.</p>}
    </Panel>
    <Panel title="How the plan adds up" className="xl:col-span-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Coming in", pic.income], ["Bills", pic.billsOwed], ["Spending limits", pic.budgeted], ["Goals", pic.goals], ["Cushion", plan.cushion]].map(([k, v]) =>
        <div key={k as string} className="rounded-2xl bg-slate-50 p-3.5"><p className="text-[13px] text-slate-500">{k}</p><p className="text-lg font-semibold tabular-nums">{money(v as number)}</p>{k !== "Coming in" && pic.income > 0 && <p className="text-[11px] font-semibold text-slate-500">{Math.round(((v as number) / pic.income) * 100)}% of income</p>}</div>)}</div>
      <button type="button" onClick={exportCsv} className={plain + " mt-4"}><Download size={15} /> Download {label} as a spreadsheet (CSV)</button>
    </Panel>
  </div>;

  return <div className="space-y-5" data-testid="budget-app">
    <PageHead eyebrow="Budget & bills" title="Your money" blurb={plan.setUp ? (plan.style === "paycheck" ? "Planned paycheck by paycheck: each check covers the bills due before the next one." : "Planned month by month: what's left after bills, spending limits and goals.") : "Bills, spending, income and goals in one place."}
      action={<div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setIncome({ kind: plan.sources.some((s) => s.kind === "tips") ? "tips" : "pay", date: today })} className={soft}><HandCoins size={16} /> Log income</button>
        {plan.setUp ? <button type="button" onClick={() => setSettings(true)} className={plain} data-testid="budget-settings"><Settings2 size={16} /> Settings</button>
          : <button type="button" onClick={() => setSetup(true)} className={plain} data-testid="budget-redo"><Settings2 size={16} /> Set up</button>}
      </div>} />

    {!plan.setUp && <section className="flex flex-wrap items-center gap-4 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08] sm:p-6" data-testid="budget-start">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700"><Wallet size={20} /></span>
      <div className="min-w-0 flex-1"><p className="text-base font-semibold text-slate-900">Set up a budget around how you get paid</p><p className="mt-0.5 text-sm text-slate-500">Paychecks, the 1st and 15th, tips, gigs, bonuses and rent paid in parts. A few questions, about two minutes.</p></div>
      <button type="button" onClick={() => setSetup(true)} className={primary + " px-5"} data-testid="budget-start-button">Start <ChevronRight size={16} /></button>
    </section>}

    {undo && <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900" data-testid="budget-undo">
      <Check size={18} /><span className="min-w-0 flex-1">Your budget is set up.{undo.bills.length > bills.length ? ` ${undo.bills.length - bills.length} bill${undo.bills.length - bills.length === 1 ? " was" : "s were"} turned off.` : ""}</span>
      <button type="button" onClick={() => { setFamily((f) => ({ ...f, ...undo })); setUndo(null); say("Put back the way it was"); }} className={plain}><Undo2 size={15} /> Undo setup</button>
      <button type="button" onClick={() => setUndo(null)} className="min-h-9 px-2 text-sm font-semibold text-emerald-800 hover:underline">OK</button>
    </div>}
    {summary}
    {alerts.length > 0 && <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 p-3.5 text-sm font-medium text-rose-800" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div className="space-y-0.5">{alerts.map((a, i) => <p key={i}>{a}</p>)}</div></div>}

    {/* One segmented control; on a phone it scrolls sideways inside itself, never the page. */}
    <nav className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Budget">
      <div className="inline-flex min-w-full gap-0.5 rounded-xl bg-slate-100 p-1 sm:min-w-0">
        {TABS.map(([id, name]) => <button key={id} type="button" role="tab" aria-selected={shown === id} onClick={() => go(id)} data-testid={`budget-tab-${id}`} className={`${tabClass(shown === id)} flex-1 sm:flex-none`}>{name}</button>)}
      </div>
    </nav>

    <div role="tabpanel">
      {shown === "overview" && overview}
      {shown === "paychecks" && paychecks}
      {shown === "bills" && billsTab}
      {shown === "spending" && spending}
      {shown === "income" && incomeTab}
      {shown === "goals" && goalsTab}
      {shown === "insights" && insights}
    </div>

    {setup && <BudgetSetup family={family} today={today} makeId={makeId} onDone={doneSetup} onClose={() => setSetup(false)} />}
    {editBill && <BillEditor bill={editBill} isNew={!bills.some((b) => b.id === editBill.id)} onClose={() => setEditBill(null)}
      onSave={(b) => { editThisMonth((v) => ({ ...v, bills: v.bills.some((x) => x.id === b.id) ? v.bills.map((x) => (x.id === b.id ? b : x)) : [...v.bills, b] })); setEditBill(null); say(`Bill saved for ${label}`); }}
      onDelete={(b) => { if (confirmed(`Remove the bill "${b.name}" from ${label}? Other months keep it.`)) { editThisMonth((v) => ({ ...v, bills: v.bills.filter((x) => x.id !== b.id) })); setEditBill(null); say(`Bill removed from ${label}`); } }} />}
    {paying && <PayDialog bill={paying.bill} status={billStatus(plan, paying.bill, month, ref)} month={label} today={today} onClose={() => setPaying(null)}
      onPay={(amount, date) => { pay(paying.bill, amount, date); setPaying(null); }} onUndo={() => { unpay(paying.bill); setPaying(null); }} />}
    {income && <IncomeDialog start={income} sources={view.plan.sources} goals={plan.goals} today={today} onClose={() => setIncome(null)}
      onDelete={income.id ? () => { setMoney((m) => ({ ...m, incomeLog: m.incomeLog.filter((x) => x.id !== income.id) })); setIncome(null); say("Removed"); } : undefined}
      onSave={(e, toGoal) => {
        const row = { id: income.id || makeId(), sourceId: e.sourceId || "", date: e.date, amount: cents(e.amount), kind: e.kind, note: e.note };
        setMoney((m) => ({ ...m, incomeLog: (m.incomeLog.some((x) => x.id === row.id) ? m.incomeLog.map((x) => (x.id === row.id ? row : x)) : [...m.incomeLog, row]).slice(-4000),
          goalMoves: toGoal ? [...m.goalMoves, { id: makeId(), goalId: toGoal.goalId, amount: cents(toGoal.amount), date: e.date }] : m.goalMoves }));
        setIncome(null); say(`${money(e.amount)} ${income.id ? "saved" : "logged"}${toGoal ? `, ${money(toGoal.amount)} to ${plan.goals.find((g) => g.id === toGoal.goalId)?.name}` : ""}`);
      }} />}
    {held && <OnHandDialog start={held} onClose={() => setHeld(null)}
      onSave={(o) => { setMoney((m) => ({ ...m, onHand: (m.onHand.some((x) => x.id === o.id) ? m.onHand.map((x) => (x.id === o.id ? o : x)) : [...m.onHand, o]).slice(0, 12) })); setHeld(null); say(`${o.name} saved`); }} />}
    {source && <SourceEditor start={source} isNew={!view.plan.sources.some((x) => x.id === source.id)} month={month} onClose={() => setSource(null)}
      onSave={(s2) => { editThisMonth((v) => ({ ...v, sources: v.sources.some((x) => x.id === s2.id) ? v.sources.map((x) => (x.id === s2.id ? s2 : x)) : [...v.sources, s2] }), true); setSource(null); say(`${s2.name} saved`); }}
      onDelete={(s2) => { if (confirmed(`Remove "${s2.name}" from your income? Money already logged from it stays.`)) { editThisMonth((v) => ({ ...v, sources: v.sources.filter((x) => x.id !== s2.id) })); setSource(null); } }} />}
    {editExpense && <ExpenseEditor start={editExpense} categories={budget} onClose={() => setEditExpense(null)}
      onSave={(x) => { setFamily((f) => ({ ...f, expenses: f.expenses.map((e) => (e.id === x.id ? x : e)) })); setEditExpense(null); say("Saved"); }}
      onDelete={(x) => { setFamily((f) => ({ ...f, expenses: f.expenses.filter((e) => e.id !== x.id) })); setEditExpense(null); say("Removed"); }} />}
    {settings && <SettingsDialog style={plan.style} cushion={plan.cushion} onClose={() => setSettings(false)} onRedo={() => { setSettings(false); setSetup(true); }}
      onSave={(style, cushion) => { setMoney((m) => ({ ...m, style, cushion })); setSettings(false); say("Settings saved"); }} />}
    {goal && <GoalEditor goal={goal} isNew={!plan.goals.some((g) => g.id === goal.id)} onClose={() => setGoal(null)}
      onSave={(g) => { setMoney((m) => ({ ...m, goals: m.goals.some((x) => x.id === g.id) ? m.goals.map((x) => (x.id === g.id ? g : x)) : [...m.goals, g] })); setGoal(null); say("Goal saved"); }}
      onDelete={(g) => { if (confirmed(`Delete the goal "${g.name}"?`)) { setMoney((m) => ({ ...m, goals: m.goals.filter((x) => x.id !== g.id), goalMoves: m.goalMoves.filter((x) => x.goalId !== g.id) })); setGoal(null); } }} />}
    {moving && <AmountDialog title={moving.out ? `${moving.goal.kind === "debt" ? "Undo a payment on" : "Take money out of"} ${moving.goal.name}` : `${moving.goal.kind === "debt" ? "Pay toward" : "Add to"} ${moving.goal.name}`}
      start={moving.out ? 0 : moving.goal.monthly} onClose={() => setMoving(null)}
      onSave={(amount) => { setMoney((m) => ({ ...m, goalMoves: [...m.goalMoves, { id: makeId(), goalId: moving.goal.id, amount: cents(moving.out ? -amount : amount), date: today }] })); setMoving(null); say("Goal updated"); }} />}
  </div>;
}

// ───────── Dialogs ─────────
function BillEditor({ bill, isNew, onSave, onDelete, onClose }: { bill: PlanBill; isNew: boolean; onSave: (b: PlanBill) => void; onDelete: (b: PlanBill) => void; onClose: () => void }) {
  const [b, setB] = useState(bill);
  const [split, setSplit] = useState(!!bill.parts);
  const [parts, setParts] = useState(() => bill.parts ?? [{ day: 1, amount: cents(bill.amount / 2) }, { day: 15, amount: cents(bill.amount - cents(bill.amount / 2)) }]);
  const partSum = cents(parts.reduce((t, p) => t + p.amount, 0));
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!b.name.trim()) return;
    const amount = split ? partSum : Math.max(0, Number(b.amount) || 0);
    const cleanParts = split ? parts.filter((p) => p.amount > 0).map((p) => ({ day: Math.min(31, Math.max(1, Math.round(p.day) || 1)), amount: cents(p.amount) })).sort((x, y) => x.day - y.day) : [];
    const { parts: _drop, ...rest } = b;
    onSave({ ...rest, name: b.name.trim().slice(0, 80), amount, dueDay: cleanParts.length > 1 ? cleanParts[cleanParts.length - 1].day : Math.min(31, Math.max(1, Math.round(Number(b.dueDay)) || 1)), ...(cleanParts.length > 1 ? { parts: cleanParts } : {}) });
  };
  return <Modal title={isNew ? "Add a bill" : "Edit bill"} eyebrow="Budget" onClose={onClose}>
    <form onSubmit={save} className="space-y-4">
      <Label text="Bill"><input autoFocus required maxLength={80} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} className={inputClass} placeholder="Rent" /></Label>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-sm font-semibold">Pay it in parts (like the 1st and 15th)</span><Toggle on={split} label="Pay in parts" onChange={setSplit} /></div>
      {split ? <div className="space-y-2">
        {parts.map((p, i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Label text={`Part ${i + 1}: day`}><input type="number" min={1} max={31} value={p.day} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)))} className={inputClass} /></Label>
          <Label text="Amount"><input type="number" min={0} step="0.01" value={p.amount || ""} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} className={inputClass} placeholder="$" /></Label>
          {parts.length > 2 ? <button type="button" onClick={() => setParts(parts.filter((_, j) => j !== i))} className="mb-1 rounded-lg p-2 text-slate-400 hover:text-rose-500" aria-label="Remove part"><Trash2 size={16} /></button> : <span className="w-8" />}
        </div>)}
        {parts.length < 4 && <button type="button" onClick={() => setParts([...parts, { day: 28, amount: 0 }])} className={plain}><Plus size={15} /> Add a part</button>}
        <p className="text-sm font-bold text-slate-700">Total: {money(partSum)} a month</p>
      </div> : <div className="grid grid-cols-2 gap-4">
        <Label text="Amount"><input type="number" min={0} step="0.01" value={b.amount || ""} onChange={(e) => setB({ ...b, amount: Number(e.target.value) })} className={inputClass} placeholder="$" /></Label>
        <Label text="Due on day"><input type="number" min={1} max={31} value={b.dueDay} onChange={(e) => setB({ ...b, dueDay: Number(e.target.value) })} className={inputClass} /></Label>
      </div>}
      <Label text="Type (optional)"><input maxLength={40} value={b.category} onChange={(e) => setB({ ...b, category: e.target.value })} className={inputClass} placeholder="Housing, utilities, subscription…" list="bill-types" /></Label>
      <datalist id="bill-types">{["Housing", "Utilities", "Phone & internet", "Insurance", "Car", "Subscription", "Childcare", "Loan"].map((t) => <option key={t} value={t} />)}</datalist>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-sm font-semibold">Paid automatically (autopay)</span><Toggle on={b.autopay} label="Autopay" onChange={(on) => setB({ ...b, autopay: on })} /></div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button type="submit" className={primary + " flex-1 px-5"}><Check size={17} /> Save bill</button>
        <button type="button" onClick={onClose} className={plain}>Cancel</button>
        {!isNew && <button type="button" onClick={() => onDelete(b)} className={danger} aria-label="Delete bill"><Trash2 size={17} /></button>}
      </div>
    </form>
  </Modal>;
}

function PayDialog({ bill, status, month, today, onPay, onUndo, onClose }: { bill: PlanBill; status: ReturnType<typeof billStatus>; month: string; today: string; onPay: (amount: number, date: string) => void; onUndo: () => void; onClose: () => void }) {
  const [amount, setAmount] = useState(String(status.nextAmount || status.left));
  const [date, setDate] = useState(today);
  const options = [...new Set([status.nextAmount, status.left].filter((x) => x > 0))];
  return <Modal title={`Pay ${bill.name}`} eyebrow={month} onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); const n = Number(amount); if (n > 0) onPay(n, date); }} className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs font-bold ring-1 ring-slate-200">
        <div><p className="text-slate-500">Owed</p><p className="text-base font-semibold tabular-nums">{money(status.owed)}</p></div>
        <div><p className="text-slate-500">Paid</p><p className="text-base font-semibold tabular-nums text-emerald-700">{money(status.paid)}</p></div>
        <div><p className="text-slate-500">Left</p><p className="text-base font-semibold tabular-nums">{money(status.left)}</p></div>
      </div>
      {status.carried > 0 && <p className="text-xs font-semibold text-rose-700">Includes {money(status.carried)} still owed from last month.</p>}
      <div className="flex flex-wrap gap-2">{options.map((o) => <button key={o} type="button" onClick={() => setAmount(String(o))} className={`min-h-10 rounded-xl px-3 text-sm font-bold ${Number(amount) === o ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700"}`}>{o === status.left ? "All of it" : "This part"} · {money(o)}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Label text="Amount paid"><input autoFocus type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></Label>
        <Label text="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Label>
      </div>
      <p className="text-xs leading-5 text-slate-500">Paying less is fine: the rest stays due, and if it isn't paid by the end of the month it carries into next month.</p>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button type="submit" className={primary + " flex-1"}><Check size={17} /> Record payment</button>
        {status.paid > 0 && <button type="button" onClick={onUndo} className={plain}><Undo2 size={15} /> Undo payments</button>}
      </div>
    </form>
  </Modal>;
}

function IncomeDialog({ start, sources, goals, today, onSave, onDelete, onClose }: { start: Partial<IncomeEntry>; sources: IncomeSource[]; goals: Goal[]; today: string;
  onSave: (e: { kind: IncomeEntry["kind"]; sourceId?: string; amount: number; date: string; note: string }, toGoal: { goalId: string; amount: number } | null) => void; onDelete?: () => void; onClose: () => void }) {
  const editing = !!start.id;
  const [kind, setKind] = useState<IncomeEntry["kind"]>(start.kind || "pay");
  const [sourceId, setSourceId] = useState(start.sourceId || sources.find((s) => s.kind === (kind === "pay" ? "paycheck" : kind))?.id || "");
  const [amount, setAmount] = useState(start.amount ? String(start.amount) : "");
  const [date, setDate] = useState(start.date || today);
  const [note, setNote] = useState(start.note || "");
  const [goalId, setGoalId] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const scheduled = sources.filter((s) => s.kind !== "tips");
  return <Modal title={editing ? "Edit income" : "Log income"} eyebrow="Budget" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); const n = Number(amount); if (!(n > 0)) return; onSave({ kind, sourceId, amount: n, date, note: note.trim().slice(0, 120) }, goalId && Number(goalAmount) > 0 ? { goalId, amount: Number(goalAmount) } : null); }} className="space-y-4">
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-100 p-1">{(["pay", "tips", "bonus", "other"] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setSourceId(sources.find((s) => s.kind === (k === "pay" ? "paycheck" : k))?.id || ""); }}
        className={`min-h-10 rounded-xl text-sm font-bold ${kind === k ? "bg-white text-slate-900 shadow" : "text-slate-600"}`}>{KIND_WORD[k]}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Label text="Amount"><input autoFocus type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="$" /></Label>
        <Label text="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Label>
      </div>
      {(kind === "pay" || kind === "other") && scheduled.length > 0 && <Label text="From"><select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={inputClass}>{scheduled.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="">Somewhere else</option></select></Label>}
      <Label text="Note (optional)"><input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder={kind === "tips" ? "Friday double" : kind === "bonus" ? "Holiday bonus" : ""} /></Label>
      {!editing && goals.length > 0 && (kind === "bonus" || kind === "tips" || kind === "other") && <div className="space-y-2 rounded-2xl bg-emerald-50 p-3">
        <p className="text-sm font-bold text-emerald-900">Put some toward a goal? (optional)</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)} aria-label="Goal" className={inputClass}><option value="">No</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <input type="number" min={0} step="0.01" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} aria-label="Amount to goal" placeholder="$" className={inputClass} disabled={!goalId} />
        </div>
      </div>}
      <div className="flex gap-2"><button type="submit" className={primary + " flex-1"}><Check size={17} /> Save</button>
        {onDelete && <button type="button" onClick={onDelete} className={danger} aria-label="Delete this income" data-testid="budget-income-dialog-delete"><Trash2 size={17} /> Delete</button>}</div>
    </form>
  </Modal>;
}

/** How a source pays, in words: "Every 2 weeks · $1,100 a check · Nov 6, Nov 20". */
function sourceLine(s: IncomeSource, month: string) {
  const days = paydays(s, month);
  if (s.kind === "tips") return `Tips · about ${money(s.amount)} a week`;
  if (s.frequency === "irregular") return `Changes · about ${money(s.amount)} a month`;
  return `${FREQ_LABEL[s.frequency]} · ${money(s.amount)} ${s.kind === "paycheck" ? "a check" : "each time"}${days.length ? ` · ${days.map(day).join(", ")}` : s.frequency === "weekly" || s.frequency === "biweekly" ? " · add a payday" : ""}`;
}

const SOURCE_KINDS: [IncomeSource["kind"], string][] = [["paycheck", "Paycheck"], ["tips", "Tips"], ["gig", "Gigs / shifts"], ["other", "Other money"]];
function SourceEditor({ start, isNew, month, onSave, onDelete, onClose }: { start: IncomeSource; isNew: boolean; month: string; onSave: (s: IncomeSource) => void; onDelete: (s: IncomeSource) => void; onClose: () => void }) {
  const [s, setS] = useState(start);
  const [amount, setAmount] = useState(start.amount ? String(start.amount) : "");
  const set = (p: Partial<IncomeSource>) => setS((x) => ({ ...x, ...p }));
  const freq = (f: PayFrequency) => set({ frequency: f, days: f === "semimonthly" ? (s.days.length === 2 ? s.days : [1, 15]) : f === "monthly" ? [s.days[0] || 1] : [] });
  const isTips = s.kind === "tips";
  const fixed = !isTips && s.frequency !== "irregular";
  const preview = { ...s, amount: Number(amount) || 0 };
  return <Modal title={isNew ? "Add income" : `Edit ${start.name || "income"}`} eyebrow="How you get paid" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); if (!s.name.trim()) return; onSave({ ...s, name: s.name.trim().slice(0, 60), amount: Math.max(0, Number(amount) || 0), anchor: s.anchor || "" }); }} className="space-y-4" data-testid="budget-source-editor">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1 sm:grid-cols-4">{SOURCE_KINDS.map(([k, w]) => <button key={k} type="button" aria-pressed={s.kind === k}
        onClick={() => set({ kind: k, frequency: k === "tips" || k === "gig" ? "irregular" : s.frequency === "irregular" ? (k === "paycheck" ? "biweekly" : "monthly") : s.frequency, days: k === "other" && s.frequency === "irregular" ? [1] : s.days })}
        className={`min-h-10 rounded-xl text-sm font-bold ${s.kind === k ? "bg-white text-slate-900 shadow" : "text-slate-600"}`}>{w}</button>)}</div>
      <Label text="Name"><input autoFocus required maxLength={60} value={s.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} placeholder={isTips ? "Tips" : s.kind === "paycheck" ? "My job" : s.kind === "gig" ? "DoorDash" : "Child support"} /></Label>
      {!isTips && <Label text="How often does it come?">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(["weekly", "biweekly", "semimonthly", "monthly", "irregular"] as PayFrequency[]).map((f) =>
          <button key={f} type="button" aria-pressed={s.frequency === f} onClick={() => freq(f)} className={`min-h-10 rounded-xl px-2 text-sm font-bold ${s.frequency === f ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{f === "semimonthly" ? "Twice a month" : FREQ_LABEL[f]}</button>)}</div>
      </Label>}
      <div className="grid grid-cols-2 gap-3">
        <Label text={isTips ? "A normal week of tips" : fixed ? (s.kind === "paycheck" ? "Take-home each check" : "Each time") : "A usual (slow) month"}><input type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="$" /></Label>
        {(s.frequency === "weekly" || s.frequency === "biweekly") && !isTips && <Label text="A payday (any one)"><input type="date" value={s.anchor} onChange={(e) => set({ anchor: e.target.value })} className={inputClass} /></Label>}
        {s.frequency === "monthly" && !isTips && <Label text="Day of the month"><input type="number" min={1} max={31} value={s.days[0] ?? 1} onChange={(e) => set({ days: [Math.min(31, Math.max(1, Math.round(Number(e.target.value)) || 1))] })} className={inputClass} /></Label>}
        {s.frequency === "semimonthly" && !isTips && <Label text="Which days?"><div className="flex items-center gap-2">
          <input type="number" min={1} max={31} value={s.days[0] ?? 1} onChange={(e) => set({ days: [Math.round(Number(e.target.value)) || 1, s.days[1] ?? 15] })} className={inputClass} aria-label="First day" /><span className="text-slate-400">&</span>
          <input type="number" min={1} max={31} value={s.days[1] ?? 15} onChange={(e) => set({ days: [s.days[0] ?? 1, Math.round(Number(e.target.value)) || 15] })} className={inputClass} aria-label="Second day" /></div></Label>}
      </div>
      {Number(amount) > 0 && <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-900">About {money(expectedFrom(preview, month))} this month{paydays(preview, month).length ? ` · ${paydays(preview, month).map(day).join(", ")}` : ""}</p>}
      <div className="flex gap-2 border-t border-slate-100 pt-4">
        <button type="submit" className={primary + " flex-1"}><Check size={17} /> Save</button>
        {!isNew && <button type="button" onClick={() => onDelete(s)} className={danger} aria-label={`Remove ${s.name}`}><Trash2 size={17} /> Remove</button>}
      </div>
    </form>
  </Modal>;
}

function ExpenseEditor({ start, categories, onSave, onDelete, onClose }: { start: Expense; categories: { id: string; name: string }[]; onSave: (x: Expense) => void; onDelete: (x: Expense) => void; onClose: () => void }) {
  const [x, setX] = useState(start);
  const [amount, setAmount] = useState(String(start.amount));
  return <Modal title="Edit spending" eyebrow="Budget" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); const n = Number(amount); if (n > 0 && x.date) onSave({ ...x, amount: cents(n), note: x.note.trim().slice(0, 120) }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Label text="Amount"><input autoFocus type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></Label>
        <Label text="Date"><input type="date" value={x.date} onChange={(e) => setX({ ...x, date: e.target.value })} className={inputClass} /></Label>
      </div>
      <Label text="Category"><select value={x.categoryId} onChange={(e) => setX({ ...x, categoryId: e.target.value })} className={inputClass}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="">Other</option></select></Label>
      <Label text="What for?"><input value={x.note} maxLength={120} onChange={(e) => setX({ ...x, note: e.target.value })} className={inputClass} /></Label>
      <div className="flex gap-2"><button type="submit" className={primary + " flex-1"}><Check size={17} /> Save</button><button type="button" onClick={() => onDelete(x)} className={danger}><Trash2 size={17} /> Delete</button></div>
    </form>
  </Modal>;
}

function SettingsDialog({ style, cushion, onSave, onRedo, onClose }: { style: PlanStyle; cushion: number; onSave: (style: PlanStyle, cushion: number) => void; onRedo: () => void; onClose: () => void }) {
  const [st, setSt] = useState(style);
  const [c, setC] = useState(cushion ? String(cushion) : "");
  return <Modal title="Budget settings" eyebrow="Budget" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); onSave(st, Math.max(0, Number(c) || 0)); }} className="space-y-4" data-testid="budget-settings-dialog">
      <Label text="Plan">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1">{(["paycheck", "monthly"] as PlanStyle[]).map((k) => <button key={k} type="button" aria-pressed={st === k} onClick={() => setSt(k)} className={`min-h-10 rounded-xl text-sm font-bold ${st === k ? "bg-white text-slate-900 shadow" : "text-slate-600"}`}>{k === "paycheck" ? "By paycheck" : "By month"}</button>)}</div>
      </Label>
      <p className="-mt-2 text-xs leading-5 text-slate-500">{st === "paycheck" ? "Each check pays the bills due before the next one, and the top shows what's safe to spend until payday." : "One plan for the month: what's left to spend after bills, limits and goals."}</p>
      <Label text="Cushion each month (kept aside for surprises)"><input type="number" min={0} step="0.01" value={c} onChange={(e) => setC(e.target.value)} className={inputClass} placeholder="$0" /></Label>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button type="submit" className={primary + " flex-1"}><Check size={17} /> Save</button>
        <button type="button" onClick={onRedo} className={plain}><RotateCcw size={15} /> Redo setup questions</button>
      </div>
    </form>
  </Modal>;
}

function GoalEditor({ goal, isNew, onSave, onDelete, onClose }: { goal: Goal; isNew: boolean; onSave: (g: Goal) => void; onDelete: (g: Goal) => void; onClose: () => void }) {
  const [g, setG] = useState(goal);
  const COLORS = ["#6e5ae0", "#0f9f6e", "#e5793b", "#2f7de1", "#d6457a", "#0e7490"];
  return <Modal title={isNew ? "New goal" : "Edit goal"} eyebrow="Budget" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); if (g.name.trim()) onSave({ ...g, name: g.name.trim().slice(0, 60) }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1">{(["save", "debt"] as const).map((k) => <button key={k} type="button" aria-pressed={g.kind === k} onClick={() => setG({ ...g, kind: k })} className={`min-h-10 rounded-xl text-sm font-bold ${g.kind === k ? "bg-white shadow" : "text-slate-600"}`}>{k === "save" ? "Save up" : "Pay off a debt"}</button>)}</div>
      <Label text="Name"><input autoFocus required maxLength={60} value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} className={inputClass} placeholder={g.kind === "debt" ? "Credit card" : "Emergency fund"} /></Label>
      <div className="grid grid-cols-2 gap-3">
        <Label text={g.kind === "debt" ? "Total owed" : "Goal"}><input type="number" min={0} step="0.01" value={g.target || ""} onChange={(e) => setG({ ...g, target: Number(e.target.value) || 0 })} className={inputClass} placeholder="$" /></Label>
        <Label text={g.kind === "debt" ? "Paid so far" : "Saved so far"}><input type="number" min={0} step="0.01" value={g.start || ""} onChange={(e) => setG({ ...g, start: Number(e.target.value) || 0 })} className={inputClass} placeholder="$" /></Label>
        <Label text="Each month"><input type="number" min={0} step="0.01" value={g.monthly || ""} onChange={(e) => setG({ ...g, monthly: Number(e.target.value) || 0 })} className={inputClass} placeholder="$" /></Label>
        <Label text="By (optional)"><input type="date" value={g.due} onChange={(e) => setG({ ...g, due: e.target.value })} className={inputClass} /></Label>
      </div>
      <div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" onClick={() => setG({ ...g, color: c })} aria-label="Colour" aria-pressed={g.color === c} className={`h-8 w-8 rounded-full ring-offset-2 ${g.color === c ? "ring-2 ring-slate-900" : ""}`} style={{ background: c }} />)}</div>
      <div className="flex gap-2 border-t border-slate-100 pt-4">
        <button type="submit" className={primary + " flex-1"}><Check size={17} /> Save goal</button>
        {!isNew && <button type="button" onClick={() => onDelete(g)} className={danger} aria-label="Delete goal"><Trash2 size={17} /></button>}
      </div>
    </form>
  </Modal>;
}

function OnHandDialog({ start, onSave, onClose }: { start: OnHand; onSave: (o: OnHand) => void; onClose: () => void }) {
  const [name, setName] = useState(start.name);
  const [v, setV] = useState(start.amount ? String(start.amount) : "");
  const n = Number(v);
  return <Modal title="Money in" eyebrow="Income" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && n > 0) onSave({ id: start.id, name: name.trim(), amount: cents(n) }); }} className="space-y-4">
      <Label text="Where is it?"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} placeholder="Cash, checking, jar" data-testid="money-in-name" /></Label>
      <Label text="How much"><input type="number" inputMode="decimal" min={0} step="0.01" value={v} onChange={(e) => setV(e.target.value)} className={inputClass} placeholder="$" data-testid="money-in-amount" /></Label>
      <button type="submit" disabled={!name.trim() || !(n > 0)} className={primary + " w-full disabled:opacity-40"} data-testid="money-in-save"><Check size={17} /> Save</button>
    </form>
  </Modal>;
}
function AmountDialog({ title, start, onSave, onClose }: { title: string; start: number; onSave: (n: number) => void; onClose: () => void }) {
  const [v, setV] = useState(start ? String(start) : "");
  return <Modal title={title} eyebrow="Goals" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); const n = Number(v); if (n > 0) onSave(n); }} className="space-y-4">
      <Label text="Amount"><input autoFocus type="number" inputMode="decimal" min={0} step="0.01" value={v} onChange={(e) => setV(e.target.value)} className={inputClass} placeholder="$" /></Label>
      <button type="submit" className={primary + " w-full"}><Check size={17} /> Save</button>
    </form>
  </Modal>;
}
