// Budget & bills: the setup interview. It asks how this person really lives (who's in the budget, how and when
// they get paid, tips, gigs, bonuses, which bills and whether any are split, what they spend on, what they're
// saving for) and builds the budget from the answers. It can be run again any time; what's there is filled in.
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Wallet, Briefcase, Check, Coins, Gift, HandCoins, Home, PiggyBank, Plus, Receipt, Sparkles, Target, Trash2, User, Users } from "lucide-react";
import { money, type BudgetCategory, type Family } from "@shared/familyHub";
import { cents, expectedFrom, FREQ_LABEL, suggestSpending, type Goal, type IncomeSource, type MoneyPlan, type PayFrequency, type PlanBill, type PlanStyle } from "@shared/moneyPlan";
import { Modal, inputClass, plain, primary } from "./ui";

type Earn = "paycheck" | "tips" | "gig" | "bonus" | "other";
type DraftBill = { id: string; name: string; on: boolean; amount: string; day: string; split: boolean; day2: string; amount2: string; category: string; autopay: boolean; paid: string[] };
type DraftCat = { id: string; name: string; on: boolean; amount: string };
type DraftGoal = { id: string; name: string; kind: Goal["kind"]; on: boolean; target: string; monthly: string; start: string };
export type SetupResult = { money: MoneyPlan; bills: PlanBill[]; budget: BudgetCategory[]; income: number };

const COMMON_BILLS: [string, string][] = [["Rent or mortgage", "Housing"], ["Electric", "Utilities"], ["Water & trash", "Utilities"], ["Gas (home)", "Utilities"], ["Internet", "Phone & internet"], ["Phone", "Phone & internet"],
  ["Car payment", "Car"], ["Car insurance", "Insurance"], ["Health insurance", "Insurance"], ["Childcare", "Childcare"], ["Credit card", "Loan"], ["Student loan", "Loan"], ["Streaming & apps", "Subscription"]];
const n = (v: string) => Math.max(0, Number(v) || 0);
const STEPS = ["Who", "How you get paid", "Your pay", "Bills", "Spending", "Goals", "Your plan", "Review"] as const;

function Choice({ on, onClick, icon, title, text }: { on: boolean; onClick: () => void; icon: ReactNode; title: string; text?: string }) {
  return <button type="button" onClick={onClick} aria-pressed={on}
    className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${on ? "border-violet-600 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}>
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${on ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-[15px] font-extrabold text-slate-900">{title}</span>{text && <span className="mt-0.5 block text-[13px] leading-5 text-slate-500">{text}</span>}</span>
    <span className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 text-transparent"}`}><Check size={14} /></span>
  </button>;
}
const Money$ = ({ value, onChange, label, placeholder = "0" }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) =>
  <span className="relative block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
    <input type="number" inputMode="decimal" min={0} step="0.01" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={placeholder} className={inputClass + " pl-7"} /></span>;
const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) =>
  <label className="block min-w-0"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}</label>;

export default function BudgetSetup({ family, today, makeId, onDone, onClose }: { family: Family; today: string; makeId: () => string; onDone: (r: SetupResult) => void; onClose: () => void }) {
  const old = family.money;
  const [step, setStep] = useState(0);
  const [who, setWho] = useState<MoneyPlan["who"]>(old.who);
  const [earn, setEarn] = useState<Set<Earn>>(() => {
    const s = new Set<Earn>(old.sources.map((x) => x.kind as Earn));
    if (old.incomeLog.some((e) => e.kind === "bonus")) s.add("bonus");
    if (!s.size) s.add("paycheck");
    return s;
  });
  const [jobs, setJobs] = useState<IncomeSource[]>(() => {
    const had = old.sources.filter((s) => s.kind === "paycheck");
    return had.length ? had : [{ id: makeId(), name: "My job", kind: "paycheck", frequency: "semimonthly", amount: 0, days: [1, 15], anchor: today }];
  });
  const [tips, setTips] = useState(() => String(old.sources.find((s) => s.kind === "tips")?.amount || ""));
  const [gig, setGig] = useState(() => { const g = old.sources.find((s) => s.kind === "gig"); return { name: g?.name || "Shifts & gigs", amount: String(g?.amount || "") }; });
  const [other, setOther] = useState(() => { const o = old.sources.find((s) => s.kind === "other"); return { name: o?.name || "Other income", amount: String(o?.amount || "") }; });
  const [bills, setBills] = useState<DraftBill[]>(() => {
    const mine: DraftBill[] = (family.bills as PlanBill[]).map((b) => ({ id: b.id, name: b.name, on: true, amount: String(b.amount || ""), day: String(b.parts?.[0]?.day ?? b.dueDay), split: !!b.parts, day2: String(b.parts?.[1]?.day ?? 15), amount2: String(b.parts?.[1]?.amount ?? ""), category: b.category, autopay: b.autopay, paid: b.paid }));
    const extra = COMMON_BILLS.filter(([name]) => !mine.some((b) => b.name.toLowerCase().startsWith(name.split(" ")[0].toLowerCase()))).map(([name, category]) => ({ id: makeId(), name, on: false, amount: "", day: "1", split: false, day2: "15", amount2: "", category, autopay: false, paid: [] }));
    return [...mine, ...extra];
  });
  const [cats, setCats] = useState<DraftCat[]>(() => family.budget.map((c) => ({ id: c.id, name: c.name, on: c.limit > 0 || family.budget.length <= 6, amount: c.limit ? String(c.limit) : "" })));
  const [goals, setGoals] = useState<DraftGoal[]>(() => {
    const had = old.goals.map((g) => ({ id: g.id, name: g.name, kind: g.kind, on: true, target: String(g.target || ""), monthly: String(g.monthly || ""), start: String(g.start || "") }));
    const add: DraftGoal[] = [];
    if (!had.some((g) => /emergency/i.test(g.name))) add.push({ id: makeId(), name: "Emergency fund", kind: "save", on: false, target: "1000", monthly: "", start: "" });
    if (!had.some((g) => g.kind === "debt")) add.push({ id: makeId(), name: "Pay off a debt", kind: "debt", on: false, target: "", monthly: "", start: "" });
    add.push({ id: makeId(), name: "Save for something", kind: "save", on: false, target: "", monthly: "", start: "" });
    return [...had, ...add];
  });
  const [cushion, setCushion] = useState(String(old.cushion || ""));
  const [style, setStyle] = useState<PlanStyle | "">(old.setUp ? old.style : "");

  const month = today.slice(0, 7);
  const sources = useMemo<IncomeSource[]>(() => [
    ...(earn.has("paycheck") ? jobs.filter((j) => j.name.trim()) : []),
    ...(earn.has("tips") && n(tips) ? [{ id: old.sources.find((s) => s.kind === "tips")?.id || "tips", name: "Tips", kind: "tips" as const, frequency: "irregular" as PayFrequency, amount: n(tips), days: [], anchor: "" }] : []),
    ...(earn.has("gig") && n(gig.amount) ? [{ id: old.sources.find((s) => s.kind === "gig")?.id || "gig", name: gig.name.trim() || "Shifts & gigs", kind: "gig" as const, frequency: "irregular" as PayFrequency, amount: n(gig.amount), days: [], anchor: "" }] : []),
    ...(earn.has("other") && n(other.amount) ? [{ id: old.sources.find((s) => s.kind === "other")?.id || "other", name: other.name.trim() || "Other income", kind: "other" as const, frequency: "irregular" as PayFrequency, amount: n(other.amount), days: [], anchor: "" }] : []),
  ], [earn, jobs, tips, gig, other, old.sources]);
  const monthly = cents(sources.reduce((t, s) => t + expectedFrom(s, month), 0));
  const billTotal = cents(bills.filter((b) => b.on).reduce((t, b) => t + n(b.amount), 0));
  const catTotal = cents(cats.filter((c) => c.on).reduce((t, c) => t + n(c.amount), 0));
  const goalTotal = cents(goals.filter((g) => g.on).reduce((t, g) => t + n(g.monthly), 0));
  const left = cents(monthly - billTotal - catTotal - goalTotal - n(cushion));
  const byCheck = earn.has("paycheck") && jobs.some((j) => j.frequency !== "monthly");
  const chosenStyle: PlanStyle = style || (byCheck ? "paycheck" : "monthly");

  const toggleEarn = (k: Earn) => setEarn((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const setJob = (id: string, p: Partial<IncomeSource>) => setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...p } : j)));
  const setBill = (id: string, p: Partial<DraftBill>) => setBills((all) => all.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const setCat = (id: string, p: Partial<DraftCat>) => setCats((all) => all.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const setGoal = (id: string, p: Partial<DraftGoal>) => setGoals((all) => all.map((g) => (g.id === id ? { ...g, ...p } : g)));
  const fillSpending = () => {
    const ideas = suggestSpending(monthly - billTotal - goalTotal - n(cushion));
    setCats((all) => {
      const next = [...all];
      for (const idea of ideas) {
        const at = next.findIndex((c) => c.name.toLowerCase().split(" ")[0] === idea.name.toLowerCase().split(" ")[0]);
        if (at >= 0) next[at] = { ...next[at], on: true, amount: String(idea.amount) };
        else next.push({ id: makeId(), name: idea.name, on: true, amount: String(idea.amount) });
      }
      return next;
    });
  };

  const finish = () => {
    const keptBills: PlanBill[] = bills.filter((b) => b.on && b.name.trim() && n(b.amount) > 0).map((b) => {
      const amount = cents(n(b.amount));
      const d1 = Math.min(31, Math.max(1, Math.round(n(b.day)) || 1));
      if (!b.split) return { id: b.id, name: b.name.trim().slice(0, 80), amount, dueDay: d1, category: b.category, autopay: b.autopay, paid: b.paid };
      const d2 = Math.min(31, Math.max(1, Math.round(n(b.day2)) || 15));
      const second = cents(Math.min(amount, n(b.amount2) || amount / 2));
      const parts = [{ day: d1, amount: cents(amount - second) }, { day: d2, amount: second }].sort((a, c) => a.day - c.day).filter((p) => p.amount > 0);
      return { id: b.id, name: b.name.trim().slice(0, 80), amount, dueDay: parts[parts.length - 1].day, category: b.category, autopay: b.autopay, paid: b.paid, ...(parts.length > 1 ? { parts } : {}) };
    });
    // Categories: the chosen ones with their amounts; any with spending already logged stay (so nothing is lost).
    const budget: BudgetCategory[] = cats.filter((c) => c.name.trim() && (c.on || family.expenses.some((e) => e.categoryId === c.id)))
      .map((c) => ({ id: c.id, name: c.name.trim().slice(0, 40), limit: c.on ? cents(n(c.amount)) : 0 }));
    const keptGoals: Goal[] = goals.filter((g) => g.on && g.name.trim()).map((g, i) => {
      const was = old.goals.find((x) => x.id === g.id);
      return { id: g.id, name: g.name.trim().slice(0, 60), kind: g.kind, target: cents(n(g.target)), start: cents(n(g.start)), monthly: cents(n(g.monthly)), due: was?.due || "", color: was?.color || ["#6e5ae0", "#0f9f6e", "#e5793b", "#2f7de1", "#d6457a"][i % 5] };
    });
    onDone({
      money: { ...old, setUp: true, who, style: chosenStyle, sources, goals: keptGoals, goalMoves: old.goalMoves.filter((m) => keptGoals.some((g) => g.id === m.goalId)), cushion: cents(n(cushion)) },
      bills: keptBills, budget, income: monthly,
    });
  };

  const canNext = step !== 1 || earn.size > 0;
  const body = (() => {
    switch (STEPS[step]) {
      case "Who": return <div className="space-y-3">
        <p className="text-sm leading-6 text-slate-600">A few quick questions and your budget is built for you. You can change anything later, or come back and run this again.</p>
        <p className="pt-2 text-base font-extrabold text-slate-900">Who is this budget for?</p>
        <Choice on={who === "me"} onClick={() => setWho("me")} icon={<User size={19} />} title="Just me" />
        <Choice on={who === "two"} onClick={() => setWho("two")} icon={<Users size={19} />} title="Me and my partner" text="Both incomes and shared bills in one place." />
        <Choice on={who === "family"} onClick={() => setWho("family")} icon={<Home size={19} />} title="My family" text="The whole household, kids' costs included." />
      </div>;
      case "How you get paid": return <div className="space-y-3">
        <p className="text-base font-extrabold text-slate-900">How do you get money coming in?</p>
        <p className="-mt-1 text-sm text-slate-500">Pick all that fit.</p>
        <Choice on={earn.has("paycheck")} onClick={() => toggleEarn("paycheck")} icon={<Briefcase size={19} />} title="A regular paycheck" text="Every week, every two weeks, the 1st and 15th, or once a month." />
        <Choice on={earn.has("tips")} onClick={() => toggleEarn("tips")} icon={<HandCoins size={19} />} title="Tips" text="Servers, bartenders, drivers, salons. Log them as you go." />
        <Choice on={earn.has("gig")} onClick={() => toggleEarn("gig")} icon={<Coins size={19} />} title="Shifts or gigs that change" text="Hours that vary, DoorDash, Uber, freelance, side jobs." />
        <Choice on={earn.has("bonus")} onClick={() => toggleEarn("bonus")} icon={<Gift size={19} />} title="Bonuses or commission" text="Extra money that comes now and then." />
        <Choice on={earn.has("other")} onClick={() => toggleEarn("other")} icon={<Wallet size={19} />} title="Something else" text="Benefits, child support, Social Security, a pension." />
      </div>;
      case "Your pay": return <div className="space-y-5">
        {earn.has("paycheck") && <div className="space-y-3">
          <p className="text-base font-extrabold text-slate-900">Your paycheck{jobs.length > 1 ? "s" : ""}</p>
          {jobs.map((j) => <div key={j.id} className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex items-end gap-2">
              <Field label="Job"><input value={j.name} maxLength={60} onChange={(e) => setJob(j.id, { name: e.target.value })} className={inputClass} placeholder="My job" /></Field>
              {jobs.length > 1 && <button type="button" onClick={() => setJobs((all) => all.filter((x) => x.id !== j.id))} aria-label={`Remove ${j.name}`} className="mb-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>}
            </div>
            <Field label="How often are you paid?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(["weekly", "biweekly", "semimonthly", "monthly"] as PayFrequency[]).map((f) =>
                <button key={f} type="button" aria-pressed={j.frequency === f} onClick={() => setJob(j.id, { frequency: f, days: f === "semimonthly" ? [1, 15] : f === "monthly" ? [j.days[0] || 1] : [] })}
                  className={`min-h-11 rounded-xl px-3 text-sm font-bold ${j.frequency === f ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{f === "semimonthly" ? "1st & 15th / twice a month" : FREQ_LABEL[f]}</button>)}</div>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Take-home each paycheck" hint="After taxes, what lands in your account."><Money$ value={j.amount ? String(j.amount) : ""} onChange={(v) => setJob(j.id, { amount: n(v) })} label="Take-home each paycheck" /></Field>
              {(j.frequency === "weekly" || j.frequency === "biweekly") && <Field label="Your next (or last) payday"><input type="date" value={j.anchor} onChange={(e) => setJob(j.id, { anchor: e.target.value })} className={inputClass} /></Field>}
              {j.frequency === "semimonthly" && <Field label="Which days?" hint="Most people: the 1st and 15th. Use 31 for the last day.">
                <div className="flex items-center gap-2"><input type="number" min={1} max={31} value={j.days[0] ?? 1} onChange={(e) => setJob(j.id, { days: [Math.round(n(e.target.value)) || 1, j.days[1] ?? 15] })} className={inputClass} aria-label="First payday" /><span className="text-sm font-bold text-slate-400">&</span>
                  <input type="number" min={1} max={31} value={j.days[1] ?? 15} onChange={(e) => setJob(j.id, { days: [j.days[0] ?? 1, Math.round(n(e.target.value)) || 15] })} className={inputClass} aria-label="Second payday" /></div></Field>}
              {j.frequency === "monthly" && <Field label="Payday (day of the month)"><input type="number" min={1} max={31} value={j.days[0] ?? 1} onChange={(e) => setJob(j.id, { days: [Math.round(n(e.target.value)) || 1] })} className={inputClass} /></Field>}
            </div>
            {j.amount > 0 && <p className="text-xs font-semibold text-emerald-700">About {money(expectedFrom(j, month))} this month</p>}
          </div>)}
          <button type="button" onClick={() => setJobs((all) => [...all, { id: makeId(), name: who === "me" ? "Second job" : "Partner's job", kind: "paycheck", frequency: "biweekly", amount: 0, days: [], anchor: today }])} className={plain}><Plus size={16} /> Add another paycheck</button>
        </div>}
        {earn.has("tips") && <div className="space-y-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-base font-extrabold text-slate-900">Tips</p>
          <Field label="About how much in tips in a normal week?" hint="Go low: you plan with this, and every tip you log counts for real."><Money$ value={tips} onChange={setTips} label="Tips in a normal week" /></Field>
        </div>}
        {earn.has("gig") && <div className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-base font-extrabold text-slate-900">Shifts & gigs</p>
          <Field label="What is it?"><input value={gig.name} maxLength={60} onChange={(e) => setGig({ ...gig, name: e.target.value })} className={inputClass} placeholder="DoorDash, extra shifts…" /></Field>
          <Field label="About how much in a slow month?" hint="Planning on a slow month means a good month is extra, not a surprise shortfall."><Money$ value={gig.amount} onChange={(v) => setGig({ ...gig, amount: v })} label="Gig income in a slow month" /></Field>
        </div>}
        {earn.has("other") && <div className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-base font-extrabold text-slate-900">Other money</p>
          <Field label="What is it?"><input value={other.name} maxLength={60} onChange={(e) => setOther({ ...other, name: e.target.value })} className={inputClass} placeholder="Child support, benefits…" /></Field>
          <Field label="About how much a month?"><Money$ value={other.amount} onChange={(v) => setOther({ ...other, amount: v })} label="Other income a month" /></Field>
        </div>}
        {earn.has("bonus") && <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><b>Bonuses and commission</b> aren't counted on ahead of time. When one comes, log it on the Income tab and put it toward a goal or this month.</p>}
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Coming in: about {money(monthly)} a month</p>
      </div>;
      case "Bills": return <div className="space-y-3">
        <p className="text-base font-extrabold text-slate-900">Which bills do you pay?</p>
        <p className="-mt-1 text-sm text-slate-500">Turn on the ones you have. If you pay something in two parts (like rent on the 1st and 15th), tap <b>Split</b>.</p>
        <ul className="space-y-2">{bills.map((b) => <li key={b.id} className={`rounded-2xl p-3 ring-1 ${b.on ? "bg-white ring-violet-300" : "bg-slate-50 ring-slate-200"}`}>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setBill(b.id, { on: !b.on })} aria-pressed={b.on} aria-label={`${b.on ? "Remove" : "Add"} ${b.name}`} className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 ${b.on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 text-transparent"}`}><Check size={15} /></button>
            <input value={b.name} maxLength={80} onChange={(e) => setBill(b.id, { name: e.target.value, on: true })} aria-label="Bill name" className="min-w-0 flex-1 bg-transparent text-[15px] font-bold text-slate-900 outline-none" />
          </div>
          {b.on && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field label={b.split ? "Total a month" : "Amount"}><Money$ value={b.amount} onChange={(v) => setBill(b.id, { amount: v })} label={`${b.name} amount`} /></Field>
            <Field label={b.split ? "1st payment day" : "Due day"}><input type="number" min={1} max={31} value={b.day} onChange={(e) => setBill(b.id, { day: e.target.value })} className={inputClass} aria-label={`${b.name} due day`} /></Field>
            <button type="button" aria-pressed={b.split} onClick={() => setBill(b.id, { split: !b.split, amount2: b.amount2 || (n(b.amount) ? String(cents(n(b.amount) / 2)) : "") })}
              className={`col-span-2 min-h-11 self-end rounded-xl px-3 text-sm font-bold sm:col-span-1 ${b.split ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700"}`}>{b.split ? "Split ✓" : "Split"}</button>
            {b.split && <>
              <Field label="2nd payment day"><input type="number" min={1} max={31} value={b.day2} onChange={(e) => setBill(b.id, { day2: e.target.value })} className={inputClass} aria-label={`${b.name} second payment day`} /></Field>
              <Field label="2nd payment amount" hint={n(b.amount) ? `1st payment: ${money(Math.max(0, n(b.amount) - n(b.amount2)))}` : undefined}><Money$ value={b.amount2} onChange={(v) => setBill(b.id, { amount2: v })} label={`${b.name} second payment`} /></Field>
            </>}
          </div>}
        </li>)}</ul>
        <button type="button" onClick={() => setBills((all) => [...all, { id: makeId(), name: "New bill", on: true, amount: "", day: "1", split: false, day2: "15", amount2: "", category: "", autopay: false, paid: [] }])} className={plain}><Plus size={16} /> Add another bill</button>
        <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-900">Bills: {money(billTotal)} a month · leaves {money(monthly - billTotal)}</p>
      </div>;
      case "Spending": return <div className="space-y-3">
        <p className="text-base font-extrabold text-slate-900">What do you spend on each month?</p>
        <p className="-mt-1 text-sm text-slate-500">After bills you have about <b>{money(Math.max(0, monthly - billTotal))}</b>. Set a limit for each, or let us suggest amounts.</p>
        <button type="button" onClick={fillSpending} className={plain}><Sparkles size={16} /> Suggest amounts for me</button>
        <ul className="space-y-2">{cats.map((c) => <li key={c.id} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${c.on ? "bg-white ring-violet-300" : "bg-slate-50 ring-slate-200"}`}>
          <button type="button" onClick={() => setCat(c.id, { on: !c.on })} aria-pressed={c.on} aria-label={`${c.on ? "Remove" : "Add"} ${c.name}`} className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 ${c.on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 text-transparent"}`}><Check size={15} /></button>
          <input value={c.name} maxLength={40} onChange={(e) => setCat(c.id, { name: e.target.value, on: true })} aria-label="Category name" className="min-w-0 flex-1 bg-transparent text-[15px] font-bold text-slate-900 outline-none" />
          <span className="w-32 shrink-0"><Money$ value={c.amount} onChange={(v) => setCat(c.id, { amount: v, on: true })} label={`${c.name} a month`} /></span>
        </li>)}</ul>
        <button type="button" onClick={() => setCats((all) => [...all, { id: makeId(), name: "New category", on: true, amount: "" }])} className={plain}><Plus size={16} /> Add a category</button>
      </div>;
      case "Goals": return <div className="space-y-3">
        <p className="text-base font-extrabold text-slate-900">Anything you're saving for or paying off?</p>
        <p className="-mt-1 text-sm text-slate-500">Optional. Even $20 a check adds up.</p>
        <ul className="space-y-2">{goals.map((g) => <li key={g.id} className={`rounded-2xl p-3 ring-1 ${g.on ? "bg-white ring-violet-300" : "bg-slate-50 ring-slate-200"}`}>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setGoal(g.id, { on: !g.on })} aria-pressed={g.on} aria-label={`${g.on ? "Remove" : "Add"} ${g.name}`} className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 ${g.on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 text-transparent"}`}><Check size={15} /></button>
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${g.kind === "debt" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>{g.kind === "debt" ? <Receipt size={16} /> : <PiggyBank size={16} />}</span>
            <input value={g.name} maxLength={60} onChange={(e) => setGoal(g.id, { name: e.target.value, on: true })} aria-label="Goal name" className="min-w-0 flex-1 bg-transparent text-[15px] font-bold text-slate-900 outline-none" />
          </div>
          {g.on && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label={g.kind === "debt" ? "Owed now" : "Goal"}><Money$ value={g.target} onChange={(v) => setGoal(g.id, { target: v })} label={`${g.name} target`} /></Field>
            <Field label={g.kind === "debt" ? "Paid off so far" : "Saved so far"}><Money$ value={g.start} onChange={(v) => setGoal(g.id, { start: v })} label={`${g.name} so far`} /></Field>
            <Field label="Put in each month"><Money$ value={g.monthly} onChange={(v) => setGoal(g.id, { monthly: v })} label={`${g.name} each month`} /></Field>
          </div>}
        </li>)}</ul>
        <button type="button" onClick={() => setGoals((all) => [...all, { id: makeId(), name: "New goal", kind: "save", on: true, target: "", monthly: "", start: "" }])} className={plain}><Plus size={16} /> Add a goal</button>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><Field label="A cushion each month (optional)" hint="Money set aside for surprises, so one slow week or a late paycheck doesn't break the plan."><Money$ value={cushion} onChange={setCushion} label="Cushion each month" /></Field></div>
      </div>;
      case "Your plan": return <div className="space-y-3">
        <p className="text-base font-extrabold text-slate-900">How do you want to plan?</p>
        <Choice on={chosenStyle === "paycheck"} onClick={() => setStyle("paycheck")} icon={<Wallet size={19} />} title={`By paycheck${byCheck ? " (best for you)" : ""}`} text="Each check pays the bills due before the next one. You'll see what's safe to spend until payday. Great for the 1st & 15th or every two weeks." />
        <Choice on={chosenStyle === "monthly"} onClick={() => setStyle("monthly")} icon={<Target size={19} />} title={`By month${!byCheck ? " (best for you)" : ""}`} text="One plan for the whole month. Good for one paycheck a month, or income that changes a lot." />
      </div>;
      case "Review": return <div className="space-y-3">
        <p className="text-base font-extrabold text-slate-900">Here's your budget</p>
        <dl className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200 text-sm">
          {[["Coming in each month", monthly, "text-emerald-700"], ["Bills", -billTotal, ""], ["Spending", -catTotal, ""], ["Goals", -goalTotal, ""], ["Cushion", -n(cushion), ""]].map(([k, v, c]) =>
            <div key={k as string} className="flex justify-between px-4 py-3"><dt className="font-semibold text-slate-600">{k}</dt><dd className={`font-black ${c}`}>{(v as number) < 0 ? `−${money(-(v as number))}` : money(v as number)}</dd></div>)}
          <div className="flex justify-between bg-white px-4 py-3.5"><dt className="font-extrabold text-slate-900">{left >= 0 ? "Left to give a job" : "Over by"}</dt><dd className={`text-lg font-black ${left >= 0 ? "text-violet-700" : "text-rose-600"}`}>{money(Math.abs(left))}</dd></div>
        </dl>
        <p className="text-sm leading-6 text-slate-600">{left < 0 ? "Your plan spends more than comes in. Lower a spending limit or a goal, or build it anyway and adjust as you go." : left > 0 ? "Nice. You can put what's left toward a goal later, or keep it as breathing room." : "Every dollar has a job."} You'll plan {chosenStyle === "paycheck" ? "check by check" : "month by month"}.</p>
      </div>;
    }
  })();

  return <Modal title={STEPS[step] === "Who" ? "Let's build your budget" : STEPS[step]} eyebrow={`Step ${step + 1} of ${STEPS.length}`} onClose={onClose} wide>
    <div className="mb-5 flex gap-1" aria-hidden>{STEPS.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-violet-600" : "bg-slate-200"}`} />)}</div>
    <div data-testid="budget-setup" data-step={STEPS[step]}>{body}</div>
    <div className="sticky bottom-0 -mx-5 mt-6 flex items-center gap-2 border-t border-slate-100 bg-white px-5 pt-4 sm:-mx-7 sm:px-7">
      {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className={plain}><ArrowLeft size={16} /> Back</button>}
      <span className="flex-1" />
      {step < STEPS.length - 1
        ? <button type="button" disabled={!canNext} onClick={() => setStep(step === 1 && !(["paycheck", "tips", "gig", "other"] as Earn[]).some((k) => earn.has(k)) ? 3 : step + 1)} className={primary + " px-5 disabled:opacity-50"} data-testid="budget-setup-next">Next <ArrowRight size={16} /></button>
        : <button type="button" onClick={finish} className={primary + " px-5"} data-testid="budget-setup-done"><Check size={16} /> Build my budget</button>}
    </div>
  </Modal>;
}
