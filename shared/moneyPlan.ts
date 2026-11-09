// The Budget app's plan (LifeHub → Budget & bills). Made for how people really get paid: a paycheck every week,
// every two weeks, on the 1st and 15th or once a month; servers and others who get tips; shifts and gigs that
// change; bonuses and commission. Bills can be split (half the rent on the 1st, half on the 15th) and paid a bit
// at a time, and what's still owed carries into the next month. A plan by paycheck shows what each check has to
// cover and what's safe to spend until the next one. Saved in family.money; bills, spending and categories stay
// in family.bills, family.expenses and family.budget (so the calendar, alerts and widgets keep working).
import type { Bill, Expense, BudgetCategory } from "./familyHub";

/** Cleaned as you type: the start is trimmed but a space (or new line) just typed at the end stays, or the next word could never be typed. */
const typedEnd = (s: string) => s.replace(/^\s+/, "").replace(/ {2,}$/, "");

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly" | "irregular";
export type IncomeKind = "paycheck" | "tips" | "gig" | "other";
export type IncomeSource = {
  id: string; name: string; kind: IncomeKind; frequency: PayFrequency;
  /** Take-home for one paycheck (paycheck), or a usual week of tips (tips), or a usual month (gig, other). */
  amount: number;
  /** Days of the month it pays: twice a month ([1, 15]) or once a month ([day]). */
  days: number[];
  /** A payday you know (weekly and every-two-weeks pay count from it). */
  anchor: string;
};
export type IncomeEntry = { id: string; sourceId: string; date: string; amount: number; kind: "pay" | "tips" | "bonus" | "other"; note: string };
/** Money you already have on hand (cash, checking, a jar): counted in what's left to spend. */
export type OnHand = { id: string; name: string; amount: number };
export type BillPayment = { id: string; billId: string; month: string; amount: number; date: string };
export type GoalKind = "save" | "debt";
export type Goal = { id: string; name: string; kind: GoalKind; target: number; start: number; due: string; monthly: number; color: string };
export type GoalMove = { id: string; goalId: string; amount: number; date: string };
export type PlanStyle = "paycheck" | "monthly";
export type MoneyPlan = {
  setUp: boolean; who: "me" | "two" | "family"; style: PlanStyle;
  sources: IncomeSource[]; onHand: OnHand[]; incomeLog: IncomeEntry[]; payments: BillPayment[]; goals: Goal[]; goalMoves: GoalMove[];
  /** Kept aside each month before anything else, so a slow month doesn't break the plan. */
  cushion: number;
};
/** A bill can be paid in parts: each part a day of the month and an amount (they add up to the bill). */
export type BillPart = { day: number; amount: number };
export type PlanBill = Bill & { parts?: BillPart[] };

export const MONEY_LIMITS = { sources: 12, onHand: 12, incomeLog: 4000, payments: 6000, goals: 30, goalMoves: 4000 };
export const emptyMoney = (): MoneyPlan => ({ setUp: false, who: "me", style: "monthly", sources: [], onHand: [], incomeLog: [], payments: [], goals: [], goalMoves: [], cushion: 0 });

// ─── small helpers (own copies, so familyHub.ts can import this file) ───
const pad = (n: number) => String(n).padStart(2, "0");
const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDay = (s: string) => new Date(`${s}T12:00:00`);
export const addDaysTo = (s: string, n: number) => { const d = fromDay(s); d.setDate(d.getDate() + n); return toDay(d); };
const daysApart = (a: string, b: string) => Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / 86_400_000);
export const lastDayOf = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(y, m, 0).getDate(); };
export const shiftMonth = (month: string, n: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const onDay = (month: string, day: number) => `${month}-${pad(Math.min(Math.max(1, day), lastDayOf(month)))}`;
export const cents = (n: number) => Math.round(n * 100) / 100;
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const obj = (v: unknown): Record<string, any> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, min: number, max: number, fallback = 0) => { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
function rows<T>(v: unknown, max: number, clean: (r: Record<string, any>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const raw of v.slice(-max)) { const r = obj(raw); const row = r && clean(r); if (row) out.push(row); }
  return out;
}

/** Cleans a saved plan (anything missing or wrong is filled in or dropped). */
export function cleanMoney(raw: unknown): MoneyPlan {
  const r = obj(raw);
  if (!r) return emptyMoney();
  const FREQ = ["weekly", "biweekly", "semimonthly", "monthly", "irregular"] as const;
  return {
    setUp: r.setUp === true,
    who: oneOf(r.who, ["me", "two", "family"] as const, "me"),
    style: oneOf(r.style, ["paycheck", "monthly"] as const, "monthly"),
    cushion: num(r.cushion, 0, 10_000_000),
    sources: rows(r.sources, MONEY_LIMITS.sources, (s) => {
      const name = typedEnd(str(s.name, 60));
      if (!name) return null;
      const frequency = oneOf(s.frequency, FREQ, "monthly");
      const days = Array.isArray(s.days) ? [...new Set(s.days.map((d: unknown) => Math.round(num(d, 1, 31, 0))).filter((d: number) => d >= 1))].sort((a, b) => a - b).slice(0, 2) as number[] : [];
      return { id: str(s.id, 100), name, kind: oneOf(s.kind, ["paycheck", "tips", "gig", "other"] as const, "paycheck"), frequency, amount: num(s.amount, 0, 10_000_000), days, anchor: isDay(s.anchor) ? s.anchor : "" };
    }),
    onHand: rows(r.onHand, MONEY_LIMITS.onHand, (o) => {
      const name = typedEnd(str(o.name, 60));
      return name && num(o.amount, 0, 100_000_000) > 0 ? { id: str(o.id, 100), name, amount: cents(num(o.amount, 0, 100_000_000)) } : null;
    }),
    incomeLog: rows(r.incomeLog, MONEY_LIMITS.incomeLog, (e) => isDay(e.date) && num(e.amount, 0, 10_000_000) > 0
      ? { id: str(e.id, 100), sourceId: str(e.sourceId, 100), date: e.date, amount: cents(num(e.amount, 0, 10_000_000)), kind: oneOf(e.kind, ["pay", "tips", "bonus", "other"] as const, "pay"), note: str(e.note, 120) } : null),
    payments: rows(r.payments, MONEY_LIMITS.payments, (p) => isMonth(p.month) && isDay(p.date) && num(p.amount, 0, 10_000_000) > 0
      ? { id: str(p.id, 100), billId: str(p.billId, 100), month: p.month, amount: cents(num(p.amount, 0, 10_000_000)), date: p.date } : null),
    goals: rows(r.goals, MONEY_LIMITS.goals, (g) => {
      const name = typedEnd(str(g.name, 60));
      return name ? { id: str(g.id, 100), name, kind: oneOf(g.kind, ["save", "debt"] as const, "save"), target: num(g.target, 0, 100_000_000), start: num(g.start, 0, 100_000_000), due: isDay(g.due) ? g.due : "", monthly: num(g.monthly, 0, 10_000_000), color: /^#[0-9a-f]{6}$/i.test(String(g.color)) ? String(g.color) : "#6e5ae0" } : null;
    }),
    goalMoves: rows(r.goalMoves, MONEY_LIMITS.goalMoves, (m) => isDay(m.date) && Number.isFinite(Number(m.amount)) && Number(m.amount) !== 0
      ? { id: str(m.id, 100), goalId: str(m.goalId, 100), amount: cents(num(m.amount, -100_000_000, 100_000_000)), date: m.date } : null),
  };
}
/** Cleans a bill's parts: 1 to 4 parts, each on a day with an amount above zero. */
export function cleanParts(v: unknown): BillPart[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const parts = v.map(obj).filter(Boolean).map((p) => ({ day: Math.round(num(p!.day, 1, 31, 1)), amount: cents(num(p!.amount, 0, 10_000_000)) })).filter((p) => p.amount > 0).slice(0, 4);
  return parts.length > 1 ? parts.sort((a, b) => a.day - b.day) : undefined;
}

// ─── Income ───
export const FREQ_LABEL: Record<PayFrequency, string> = { weekly: "Every week", biweekly: "Every 2 weeks", semimonthly: "Twice a month", monthly: "Once a month", irregular: "It changes" };
/** The days a source pays in a month (none for income that comes whenever: tips, gigs). */
export function paydays(s: IncomeSource, month: string): string[] {
  const first = `${month}-01`, last = onDay(month, 31);
  if (s.kind === "tips" || s.frequency === "irregular") return [];
  if (s.frequency === "semimonthly") return (s.days.length ? s.days : [1, 15]).map((d) => onDay(month, d));
  if (s.frequency === "monthly") return [onDay(month, s.days[0] ?? 1)];
  const step = s.frequency === "weekly" ? 7 : 14;
  if (!s.anchor) return [];
  // Walk from the known payday to the first payday in the month, then step through it.
  let d = s.anchor;
  const gap = daysApart(d, first);
  d = addDaysTo(d, Math.ceil(gap / step) * step);
  const out: string[] = [];
  while (d <= last) { if (d >= first) out.push(d); d = addDaysTo(d, step); }
  return out;
}
/** What a source usually brings in a month (tips: a usual week, times 52 weeks over 12 months). */
export function expectedFrom(s: IncomeSource, month: string): number {
  if (s.kind === "tips") return cents((s.amount * 52) / 12);
  if (s.frequency === "irregular") return s.amount;
  return cents(paydays(s, month).length * s.amount);
}
export const expectedIncome = (plan: MoneyPlan, month: string) => cents(plan.sources.reduce((t, s) => t + expectedFrom(s, month), 0));
export const onHandTotal = (plan: MoneyPlan) => cents(plan.onHand.reduce((t, o) => t + o.amount, 0));
export const receivedIn = (plan: MoneyPlan, month: string) => cents(plan.incomeLog.filter((e) => e.date.startsWith(month)).reduce((t, e) => t + e.amount, 0));
/** A source's paycheck on a day, if it was logged (so it shows as received). */
export const loggedPay = (plan: MoneyPlan, sourceId: string, date: string) => plan.incomeLog.find((e) => e.sourceId === sourceId && e.date === date && e.kind === "pay");
/** Tips by week for the last few weeks, and the average (so a server sees what a normal week brings). */
export function tipWeeks(plan: MoneyPlan, today: string, weeks = 8) {
  const out: { start: string; total: number }[] = [];
  const dow = fromDay(today).getDay();
  let start = addDaysTo(today, -((dow + 6) % 7)); // Monday
  for (let i = 0; i < weeks; i++) {
    const end = addDaysTo(start, 6);
    out.unshift({ start, total: cents(plan.incomeLog.filter((e) => e.kind === "tips" && e.date >= start && e.date <= end).reduce((t, e) => t + e.amount, 0)) });
    start = addDaysTo(start, -7);
  }
  const done = out.slice(0, -1).filter((w) => w.total > 0);
  return { weeks: out, average: done.length ? cents(done.reduce((t, w) => t + w.total, 0) / done.length) : 0 };
}

// ─── Bills ───
/** A bill's parts in a month: its own parts if split, otherwise the whole bill on its due day. */
export const partsOf = (b: PlanBill): BillPart[] => (b.parts && b.parts.length > 1 ? b.parts : [{ day: b.dueDay, amount: b.amount }]);
export const paidToward = (plan: MoneyPlan, billId: string, month: string) => cents(plan.payments.filter((p) => p.billId === billId && p.month === month).reduce((t, p) => t + p.amount, 0));
/** Still owed from last month: only when some of it was paid then (a bill never touched isn't counted as debt). */
export function carriedIn(plan: MoneyPlan, b: PlanBill, month: string): number {
  const prev = shiftMonth(month, -1);
  if (b.paid.includes(prev)) return 0;
  const paid = paidToward(plan, b.id, prev);
  return paid > 0 && paid < b.amount ? cents(b.amount - paid) : 0;
}
export type BillStatus = { owed: number; paid: number; left: number; carried: number; state: "paid" | "partial" | "late" | "soon" | "later"; nextDue: string; nextAmount: number };
/** Where a bill stands in a month: what's owed (with anything carried in), paid, left, and the next part due. */
export function billStatus(plan: MoneyPlan, b: PlanBill, month: string, today: string): BillStatus {
  const carried = carriedIn(plan, b, month);
  const owed = cents(b.amount + carried);
  const paid = b.paid.includes(month) ? owed : Math.min(owed, paidToward(plan, b.id, month));
  const left = cents(Math.max(0, owed - paid));
  // The part that's due next: walk the parts in order, and the first one not covered by what's paid.
  // Anything carried in from last month is due with the first part.
  let pool = paid, nextDue = "", nextAmount = 0;
  for (const [i, part] of partsOf(b).entries()) {
    const need = part.amount + (i === 0 ? carried : 0);
    if (pool >= need - 0.005) { pool -= need; continue; }
    nextDue = onDay(month, part.day); nextAmount = cents(need - Math.max(0, pool)); break;
  }
  if (!nextDue && left > 0) { nextDue = onDay(month, partsOf(b)[0].day); nextAmount = left; }
  const state = left <= 0 ? "paid" : nextDue && nextDue < today ? "late" : paid > 0 ? "partial" : nextDue && daysApart(today, nextDue) <= 7 ? "soon" : "later";
  return { owed, paid: cents(paid), left, carried, state, nextDue, nextAmount };
}
/** Records a payment toward a bill; once it's all paid the month is marked paid (so alerts and widgets agree). */
export function payBill(plan: MoneyPlan, bills: PlanBill[], billId: string, month: string, amount: number, date: string, id: string): { plan: MoneyPlan; bills: PlanBill[] } {
  const b = bills.find((x) => x.id === billId);
  if (!b || !(amount > 0)) return { plan, bills };
  const next: MoneyPlan = { ...plan, payments: [...plan.payments, { id, billId, month, amount: cents(amount), date }].slice(-MONEY_LIMITS.payments) };
  const status = billStatus(next, b, month, date);
  const nextBills = status.left <= 0 && !b.paid.includes(month) ? bills.map((x) => (x.id === billId ? { ...x, paid: [...x.paid, month].slice(-120) } : x)) : bills;
  return { plan: next, bills: nextBills };
}
/** Takes back everything paid toward a bill in a month (the "undo" on a paid bill). */
export function unpayBill(plan: MoneyPlan, bills: PlanBill[], billId: string, month: string) {
  return {
    plan: { ...plan, payments: plan.payments.filter((p) => !(p.billId === billId && p.month === month)) },
    bills: bills.map((x) => (x.id === billId ? { ...x, paid: x.paid.filter((m) => m !== month) } : x)),
  };
}

// ─── Plan by paycheck ───
export type PayPeriod = { start: string; end: string; amount: number; sources: { id: string; name: string; date: string; amount: number; received: boolean }[];
  bills: { bill: PlanBill; due: string; amount: number; paid: boolean }[]; billTotal: number; goalTotal: number; left: number };
/**
 * Each payday in the month, and the bill parts due before the next payday (what that check has to cover).
 * Parts due before the month's first payday are covered by last month's final check: they're shown first.
 */
export function payPeriods(plan: MoneyPlan, bills: PlanBill[], month: string, today: string): { before: PayPeriod | null; periods: PayPeriod[] } {
  const checks = plan.sources.flatMap((s) => paydays(s, month).map((date) => ({ s, date }))).sort((a, b) => a.date.localeCompare(b.date));
  const days = [...new Set(checks.map((c) => c.date))];
  const end = onDay(month, 31);
  const parts = bills.flatMap((b) => {
    const st = billStatus(plan, b, month, today);
    let pool = st.paid;
    return partsOf(b).map((p, i) => {
      // Anything carried in from last month is due with the first part.
      const amount = cents(p.amount + (i === 0 ? st.carried : 0));
      const paid = pool >= amount - 0.005; pool -= amount;
      return { bill: b, due: onDay(month, p.day), amount, paid };
    });
  }).sort((a, b) => a.due.localeCompare(b.due));
  const goalMonthly = plan.goals.reduce((t, g) => t + g.monthly, 0);
  const make = (start: string, stop: string, cs: typeof checks): PayPeriod => {
    const inside = parts.filter((p) => p.due >= start && p.due <= stop);
    const amount = cents(cs.reduce((t, c) => t + c.s.amount, 0));
    const billTotal = cents(inside.reduce((t, p) => t + p.amount, 0));
    const goalTotal = cs.length && days.length ? cents(goalMonthly / days.length) : 0;
    return { start, end: stop, amount, sources: cs.map((c) => ({ id: c.s.id, name: c.s.name, date: c.date, amount: c.s.amount, received: !!loggedPay(plan, c.s.id, c.date) })), bills: inside, billTotal, goalTotal, left: cents(amount - billTotal - goalTotal) };
  };
  if (!days.length) return { before: null, periods: [] };
  const before = parts.some((p) => p.due < days[0]) ? make(`${month}-01`, addDaysTo(days[0], -1), []) : null;
  const periods = days.map((d, i) => make(d, i + 1 < days.length ? addDaysTo(days[i + 1], -1) : end, checks.filter((c) => c.date === d)));
  return { before, periods };
}

// ─── The month at a glance ───
export const spentInMonth = (expenses: Expense[], month: string) => cents(expenses.filter((e) => e.date.startsWith(month)).reduce((t, e) => t + e.amount, 0));
export function monthPicture(plan: MoneyPlan, bills: PlanBill[], expenses: Expense[], budget: BudgetCategory[], month: string, today: string) {
  const expected = expectedIncome(plan, month);
  const received = receivedIn(plan, month);
  const statuses = bills.map((b) => billStatus(plan, b, month, today));
  const billsOwed = cents(statuses.reduce((t, s) => t + s.owed, 0));
  const billsPaid = cents(statuses.reduce((t, s) => t + s.paid, 0));
  const billsLeft = cents(billsOwed - billsPaid);
  const spent = spentInMonth(expenses, month);
  const budgeted = cents(budget.reduce((t, c) => t + c.limit, 0));
  const goals = cents(plan.goals.reduce((t, g) => t + g.monthly, 0));
  // Income to plan with: what's expected, or what's come in if that's more (a big tip week, a bonus).
  const income = Math.max(expected, received);
  const planned = cents(billsOwed + budgeted + goals + plan.cushion);
  const onHand = onHandTotal(plan);
  return {
    expected, received, income, onHand, billsOwed, billsPaid, billsLeft, spent, budgeted, goals, planned,
    /** Not given a job yet: income minus bills, spending budgets, goals and the cushion. Negative means over-planned. */
    unplanned: cents(income + onHand - planned),
    /** What's actually left this month after bills and spending so far. */
    leftover: cents(income + onHand - billsOwed - spent - goals),
    late: statuses.filter((s) => s.state === "late").length,
  };
}
/** Safe to spend until the next payday: this check, less its bills still to pay, its goal share and what's been spent since it came. */
export function safeToSpend(plan: MoneyPlan, bills: PlanBill[], expenses: Expense[], month: string, today: string) {
  const { periods } = payPeriods(plan, bills, month, today);
  const now = [...periods].reverse().find((p) => p.start <= today) ?? null;
  if (!now) return null;
  const spent = cents(expenses.filter((e) => e.date >= now.start && e.date <= today).reduce((t, e) => t + e.amount, 0));
  // Tips, gig pay, bonuses and other money logged since this check came in add to what's safe to spend.
  const extra = cents(plan.incomeLog.filter((e) => e.kind !== "pay" && e.date >= now.start && e.date <= today).reduce((t, e) => t + e.amount, 0));
  const nextDay = addDaysTo(now.end, 1);
  return { amount: cents(now.amount + extra + onHandTotal(plan) - now.billTotal - now.goalTotal - spent), spent, extra, until: nextDay, days: Math.max(1, daysApart(today, nextDay)), period: now };
}

// ─── Goals ───
export const goalSaved = (plan: MoneyPlan, g: Goal) => cents(g.start + plan.goalMoves.filter((m) => m.goalId === g.id).reduce((t, m) => t + m.amount, 0));
export function goalProgress(plan: MoneyPlan, g: Goal, today: string) {
  const saved = goalSaved(plan, g);
  const left = cents(Math.max(0, g.target - saved));
  const percent = g.target > 0 ? Math.min(100, Math.round((saved / g.target) * 100)) : 0;
  const months = g.monthly > 0 ? Math.ceil(left / g.monthly) : 0;
  const finish = months ? shiftMonth(today.slice(0, 7), months) : "";
  // To make the date: how much a month it needs.
  const monthsToDue = g.due ? Math.max(1, (Number(g.due.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(g.due.slice(5, 7)) - Number(today.slice(5, 7))) : 0;
  const needed = monthsToDue ? cents(left / monthsToDue) : 0;
  return { saved, left, percent, finish, needed, onTrack: !g.due || !g.monthly || g.monthly >= needed - 0.5 };
}

// ─── Insights ───
export function monthsBack(plan: MoneyPlan, bills: PlanBill[], expenses: Expense[], month: string, count = 6) {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1)).map((m) => ({
    month: m,
    income: Math.max(receivedIn(plan, m), 0),
    spent: spentInMonth(expenses, m),
    bills: cents(plan.payments.filter((p) => p.month === m).reduce((t, p) => t + p.amount, 0) + bills.filter((b) => b.paid.includes(m) && !plan.payments.some((p) => p.billId === b.id && p.month === m)).reduce((t, b) => t + b.amount, 0)),
  }));
}
export function byCategory(expenses: Expense[], budget: BudgetCategory[], month: string) {
  const rowsOut = budget.map((c) => ({ id: c.id, name: c.name, limit: c.limit, spent: cents(expenses.filter((e) => e.categoryId === c.id && e.date.startsWith(month)).reduce((t, e) => t + e.amount, 0)) }));
  const other = cents(expenses.filter((e) => e.date.startsWith(month) && !budget.some((c) => c.id === e.categoryId)).reduce((t, e) => t + e.amount, 0));
  if (other > 0) rowsOut.push({ id: "", name: "Other", limit: 0, spent: other });
  return rowsOut.sort((a, b) => b.spent - a.spent);
}
/** A suggested split of what's left after bills (50/30/20 adjusted: needs first, then wants, then saving). */
export function suggestSpending(afterBills: number) {
  const base = Math.max(0, afterBills);
  const share = (p: number) => Math.round((base * p) / 5) * 5;
  return [
    { name: "Groceries", amount: share(0.3) }, { name: "Gas & transport", amount: share(0.15) }, { name: "Eating out", amount: share(0.1) },
    { name: "Kids & school", amount: share(0.08) }, { name: "Personal & household", amount: share(0.1) }, { name: "Fun", amount: share(0.07) },
  ];
}

/** A CSV of the month (spending, income and bill payments) for a spreadsheet. */
export function monthCsv(plan: MoneyPlan, bills: PlanBill[], expenses: Expense[], budget: BudgetCategory[], month: string) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ["Date,Type,What,Category,Amount"];
  for (const e of plan.incomeLog.filter((x) => x.date.startsWith(month))) lines.push([e.date, "Income", q(e.note || plan.sources.find((s) => s.id === e.sourceId)?.name || e.kind), q(e.kind), e.amount.toFixed(2)].join(","));
  for (const p of plan.payments.filter((x) => x.month === month)) lines.push([p.date, "Bill", q(bills.find((b) => b.id === p.billId)?.name || "Bill"), q(bills.find((b) => b.id === p.billId)?.category || ""), (-p.amount).toFixed(2)].join(","));
  for (const e of expenses.filter((x) => x.date.startsWith(month))) lines.push([e.date, "Spending", q(e.note), q(budget.find((c) => c.id === e.categoryId)?.name || "Other"), (-e.amount).toFixed(2)].join(","));
  return lines.sort((a, b) => (a.startsWith("Date") ? -1 : b.startsWith("Date") ? 1 : a.localeCompare(b))).join("\n");
}

/** Paydays this month that have come (on or before today) and aren't logged yet: "Did you get paid?". */
export function paydaysToConfirm(plan: MoneyPlan, month: string, today: string) {
  return plan.sources.flatMap((s) => paydays(s, month).filter((d) => d <= today && !loggedPay(plan, s.id, d)).map((date) => ({ source: s, date })))
    .sort((a, b) => a.date.localeCompare(b.date));
}
