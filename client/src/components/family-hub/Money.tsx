// Budget & bills: a monthly bill checklist, spending against category budgets, and what's left over.
import { useState, type FormEvent } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, CircleDollarSign, Pencil, PiggyBank, Plus, Receipt, Repeat2, ShoppingCart, Trash2, Wallet } from "lucide-react";
import { billDue, billState, fromDay, money, monthSummary, spentIn, toDay, type Bill, type Expense } from "@shared/familyHub";
import { Bar, Empty, Label, Modal, PageHead, Panel, Stat, Toggle, confirmed, danger, inputClass, plain, primary, shortDate, soft, type SectionProps } from "./ui";

const blankBill = (id: string): Bill => ({ id, name: "", amount: 0, dueDay: 1, category: "", autopay: false, paid: [] });
const STATE_STYLE = { paid: "bg-emerald-50 text-emerald-700", late: "bg-rose-50 text-rose-600", soon: "bg-amber-50 text-amber-700", later: "bg-slate-50 text-slate-500" };

export default function Money({ family, setFamily, today, makeId, say }: SectionProps) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [bill, setBill] = useState<Bill | null>(null);
  const [expense, setExpense] = useState({ amount: "", categoryId: family.budget[0]?.id || "", note: "", date: today });
  const [newCat, setNewCat] = useState({ name: "", limit: "" });
  const [incomeDraft, setIncomeDraft] = useState<string | null>(null);
  const sum = monthSummary(family, month);
  const shift = (n: number) => { const d = fromDay(`${month}-01`); d.setMonth(d.getMonth() + n); setMonth(toDay(d).slice(0, 7)); };
  const label = fromDay(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const bills = [...family.bills].sort((a, b) => a.dueDay - b.dueDay);
  const isCurrent = month === today.slice(0, 7);
  const refDay = isCurrent ? today : month < today.slice(0, 7) ? `${month}-31` : `${month}-01`;
  const late = bills.filter((b) => billState(b, month, refDay) === "late");

  const togglePaid = (b: Bill) => {
    const paid = b.paid.includes(month);
    setFamily((f) => ({ ...f, bills: f.bills.map((x) => (x.id === b.id ? { ...x, paid: paid ? x.paid.filter((m) => m !== month) : [...x.paid, month].slice(-120) } : x)) }));
    if (!paid) say(`${b.name} marked paid for ${label}`);
  };
  const saveBill = (e: FormEvent) => {
    e.preventDefault();
    if (!bill || !bill.name.trim()) return;
    const clean = { ...bill, name: bill.name.trim().slice(0, 80), amount: Math.max(0, Number(bill.amount) || 0), dueDay: Math.min(31, Math.max(1, Math.round(Number(bill.dueDay)) || 1)) };
    setFamily((f) => ({ ...f, bills: f.bills.some((x) => x.id === clean.id) ? f.bills.map((x) => (x.id === clean.id ? clean : x)) : [...f.bills, clean] }));
    setBill(null);
    say("Bill saved");
  };
  const addExpense = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(expense.amount);
    if (!(amount > 0) || !expense.date) { say("Enter an amount above zero."); return; }
    const row: Expense = { id: makeId(), categoryId: expense.categoryId, amount: Math.round(amount * 100) / 100, date: expense.date, note: expense.note.trim().slice(0, 120) };
    setFamily((f) => ({ ...f, expenses: [...f.expenses, row].slice(-8000) }));
    setExpense({ ...expense, amount: "", note: "" });
    say(`${money(row.amount)} added`);
  };
  const addCategory = (e: FormEvent) => {
    e.preventDefault();
    const name = newCat.name.trim();
    if (!name) return;
    setFamily((f) => ({ ...f, budget: [...f.budget, { id: makeId(), name: name.slice(0, 40), limit: Math.max(0, Number(newCat.limit) || 0) }] }));
    setNewCat({ name: "", limit: "" });
  };
  const monthExpenses = family.expenses.filter((x) => x.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date));
  const uncategorized = monthExpenses.filter((x) => !family.budget.some((c) => c.id === x.categoryId)).reduce((s, x) => s + x.amount, 0);

  return <div className="space-y-6">
    <PageHead eyebrow="Budget & bills" title="Money hub" blurb="Check off bills as they're paid, log spending against your budget, and see what's left this month."
      action={<div className="flex items-center gap-2"><button onClick={() => shift(-1)} className={plain} aria-label="Previous month"><ChevronLeft size={17} /></button><span className="min-w-[130px] text-center text-sm font-black">{label}</span><button onClick={() => shift(1)} className={plain} aria-label="Next month"><ChevronRight size={17} /></button></div>} />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <button onClick={() => setIncomeDraft(String(family.income || ""))} className="text-left"><Stat label="Monthly income ✎" value={money(family.income)} icon={<CircleDollarSign size={17} />} tint="bg-emerald-50 text-emerald-600" /></button>
      <Stat label="Bills left to pay" value={money(sum.billsLeft)} icon={<Receipt size={17} />} tint="bg-rose-50 text-rose-600" />
      <Stat label="Spent this month" value={money(sum.spent)} icon={<ShoppingCart size={17} />} tint="bg-amber-50 text-amber-600" />
      <Stat label="Left over" value={<span className={sum.leftover < 0 ? "text-rose-600" : ""}>{money(sum.leftover)}</span>} icon={<PiggyBank size={17} />} tint="bg-violet-50 text-violet-600" />
    </div>
    {late.length > 0 && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700" role="alert"><AlertCircle size={17} /> {late.length === 1 ? `${late[0].name} is` : `${late.length} bills are`} past due and not marked paid.</div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel eyebrow={label} title="Bills" right={<button onClick={() => setBill(blankBill(makeId()))} className={soft}><Plus size={16} /> Add bill</button>}>
        {bills.length ? <><ul className="divide-y divide-slate-100">{bills.map((b) => {
          const state = billState(b, month, refDay);
          return <li key={b.id} className="flex items-center gap-3 py-3">
            <button onClick={() => togglePaid(b)} aria-pressed={state === "paid"} aria-label={`Mark ${b.name} ${state === "paid" ? "unpaid" : "paid"}`} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition ${state === "paid" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-violet-500"}`}><Check size={16} /></button>
            <button onClick={() => setBill({ ...b })} className="min-w-0 flex-1 text-left">
              <span className={`block truncate text-sm font-bold ${state === "paid" ? "text-slate-400 line-through" : ""}`}>{b.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                <span className={`rounded-md px-1.5 py-0.5 ${STATE_STYLE[state]}`}>{state === "paid" ? "Paid" : state === "late" ? "Past due" : "Due"} {shortDate(billDue(b, month), { month: "short", day: "numeric" })}</span>
                {b.autopay && <span className="inline-flex items-center gap-1 text-slate-400"><Repeat2 size={11} /> Autopay</span>}
                {b.category && <span className="text-slate-400">{b.category}</span>}
              </span>
            </button>
            <span className="text-sm font-black">{money(b.amount)}</span>
            <button onClick={() => setBill({ ...b })} className="rounded-lg p-1.5 text-slate-300 hover:text-violet-600" aria-label={`Edit ${b.name}`}><Pencil size={14} /></button>
          </li>;
        })}</ul>
          <div className="mt-3 border-t border-slate-100 pt-3"><div className="mb-1.5 flex justify-between text-xs font-bold text-slate-500"><span>{money(sum.billsPaid)} paid</span><span>{money(sum.billsTotal)} total</span></div><Bar value={sum.billsPaid} max={sum.billsTotal} color="#22c55e" /></div>
        </> : <Empty icon={<Receipt size={24} />} title="No bills yet" action={<button onClick={() => setBill(blankBill(makeId()))} className={soft}><Plus size={16} /> Add a bill</button>}>Rent, utilities, phone, insurance, subscriptions. They repeat every month automatically.</Empty>}
      </Panel>

      <Panel eyebrow={label} title="Budget" right={<Wallet size={18} className="text-violet-500" />}>
        <ul className="space-y-4">{family.budget.map((c) => {
          const spent = spentIn(family, c.id, month);
          return <li key={c.id}>
            <div className="mb-1.5 flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
              <span className={`text-xs font-bold ${c.limit && spent > c.limit ? "text-rose-600" : "text-slate-500"}`}>{money(spent)}{c.limit ? ` / ` : ""}</span>
              <input type="number" min={0} value={c.limit || ""} placeholder="Set limit" onChange={(e) => setFamily((f) => ({ ...f, budget: f.budget.map((x) => (x.id === c.id ? { ...x, limit: Math.max(0, Number(e.target.value) || 0) } : x)) }))} aria-label={`${c.name} monthly limit`} className="w-20 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-right text-xs font-bold text-slate-600 placeholder:text-violet-500 focus:border-violet-400 focus:outline-none" />
              {!family.expenses.some((x) => x.categoryId === c.id) && <button onClick={() => setFamily((f) => ({ ...f, budget: f.budget.filter((x) => x.id !== c.id) }))} className="text-slate-300 hover:text-rose-500" aria-label={`Remove ${c.name}`}><Trash2 size={13} /></button>}
            </div>
            <Bar value={spent} max={c.limit || Math.max(spent, 1)} warn={!!c.limit && spent > c.limit} color={c.limit ? "#6e5ae0" : "#cbd5e1"} />
          </li>;
        })}</ul>
        {uncategorized > 0 && <p className="mt-3 text-xs text-slate-500">{money(uncategorized)} in other spending</p>}
        <form onSubmit={addCategory} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          <input value={newCat.name} maxLength={40} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="New category" aria-label="New budget category" className={inputClass + " min-w-0"} />
          <input type="number" min={0} value={newCat.limit} onChange={(e) => setNewCat({ ...newCat, limit: e.target.value })} placeholder="$ / mo" aria-label="Monthly limit" className={inputClass + " w-24"} />
          <button type="submit" className={primary} aria-label="Add category"><Plus size={17} /></button>
        </form>
      </Panel>
    </div>

    <Panel eyebrow="Spending" title="Log what you spend">
      <form onSubmit={addExpense} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1.3fr)_150px_auto]">
        <input type="number" min={0} step="0.01" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} placeholder="$ 0.00" aria-label="Amount" className={inputClass} />
        <select value={expense.categoryId} onChange={(e) => setExpense({ ...expense, categoryId: e.target.value })} aria-label="Category" className={inputClass}>{family.budget.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="">Other</option></select>
        <input value={expense.note} maxLength={120} onChange={(e) => setExpense({ ...expense, note: e.target.value })} placeholder="What for? (optional)" aria-label="Note" className={inputClass} />
        <input type="date" value={expense.date} onChange={(e) => setExpense({ ...expense, date: e.target.value })} aria-label="Date" className={inputClass} />
        <button type="submit" className={primary}><Plus size={17} /> Add</button>
      </form>
      {monthExpenses.length ? <ul className="mt-4 divide-y divide-slate-100">{monthExpenses.slice(0, 40).map((x) => <li key={x.id} className="flex items-center gap-3 py-2.5 text-sm">
        <span className="w-16 shrink-0 text-xs font-bold text-slate-400">{shortDate(x.date, { month: "short", day: "numeric" })}</span>
        <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{x.note || family.budget.find((c) => c.id === x.categoryId)?.name || "Other"}</span>{x.note && <span className="text-xs text-slate-400"> · {family.budget.find((c) => c.id === x.categoryId)?.name || "Other"}</span>}</span>
        <span className="font-black">{money(x.amount)}</span>
        <button onClick={() => setFamily((f) => ({ ...f, expenses: f.expenses.filter((e) => e.id !== x.id) }))} className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500" aria-label="Remove expense"><Trash2 size={14} /></button>
      </li>)}</ul> : <p className="mt-4 text-sm text-slate-500">No spending logged for {label}.</p>}
    </Panel>

    {bill && <Modal title={family.bills.some((b) => b.id === bill.id) ? "Edit bill" : "Add a bill"} onClose={() => setBill(null)}>
      <form onSubmit={saveBill} className="space-y-4">
        <Label text="Bill"><input autoFocus required maxLength={80} value={bill.name} onChange={(e) => setBill({ ...bill, name: e.target.value })} className={inputClass} placeholder="Electric" /></Label>
        <div className="grid grid-cols-2 gap-4">
          <Label text="Amount"><input type="number" min={0} step="0.01" value={bill.amount || ""} onChange={(e) => setBill({ ...bill, amount: Number(e.target.value) })} className={inputClass} placeholder="$" /></Label>
          <Label text="Due on day"><input type="number" min={1} max={31} value={bill.dueDay} onChange={(e) => setBill({ ...bill, dueDay: Number(e.target.value) })} className={inputClass} /></Label>
        </div>
        <Label text="Type (optional)"><input maxLength={40} value={bill.category} onChange={(e) => setBill({ ...bill, category: e.target.value })} className={inputClass} placeholder="Utilities, housing, subscription…" list="bill-types" /></Label>
        <datalist id="bill-types">{["Housing", "Utilities", "Phone & internet", "Insurance", "Car", "Subscription", "Childcare", "Loan"].map((t) => <option key={t} value={t} />)}</datalist>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-sm font-semibold">Paid automatically (autopay)</span><Toggle on={bill.autopay} label="Autopay" onChange={(on) => setBill({ ...bill, autopay: on })} /></div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={primary + " flex-1 px-5"}><Check size={17} /> Save bill</button>
          <button type="button" onClick={() => setBill(null)} className={plain}>Cancel</button>
          {family.bills.some((b) => b.id === bill.id) && <button type="button" onClick={() => { if (confirmed(`Delete the bill "${bill.name}"?`)) { setFamily((f) => ({ ...f, bills: f.bills.filter((b) => b.id !== bill.id) })); setBill(null); } }} className={danger} aria-label="Delete bill"><Trash2 size={17} /></button>}
        </div>
      </form>
    </Modal>}

    {incomeDraft !== null && <Modal title="Monthly income" onClose={() => setIncomeDraft(null)}>
      <form onSubmit={(e) => { e.preventDefault(); setFamily((f) => ({ ...f, income: Math.max(0, Number(incomeDraft) || 0) })); setIncomeDraft(null); }} className="space-y-4">
        <Label text="Take-home pay for the whole household each month"><input autoFocus type="number" min={0} step="0.01" value={incomeDraft} onChange={(e) => setIncomeDraft(e.target.value)} className={inputClass} placeholder="$" /></Label>
        <button type="submit" className={primary + " w-full"}>Save</button>
      </form>
    </Modal>}
  </div>;
}
