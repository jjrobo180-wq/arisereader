import test from "node:test";
import assert from "node:assert/strict";
import { onHandTotal, billStatus, cleanMoney, cleanParts, emptyMoney, expectedIncome, goalProgress, monthPicture, payBill, payPeriods, paydays, safeToSpend, tipWeeks, unpayBill, type MoneyPlan, type PlanBill } from "../shared/moneyPlan";
import { cleanFamily, emptyFamily } from "../shared/familyHub";

const plan = (over: Partial<MoneyPlan> = {}): MoneyPlan => ({ ...emptyMoney(), setUp: true, ...over });
const rent: PlanBill = { id: "rent", name: "Rent", amount: 1500, dueDay: 15, category: "Housing", autopay: false, paid: [], parts: [{ day: 1, amount: 750 }, { day: 15, amount: 750 }] };
const phone: PlanBill = { id: "phone", name: "Phone", amount: 60, dueDay: 20, category: "", autopay: true, paid: [] };

test("paydays: 1st & 15th, every 2 weeks from a known payday, weekly, monthly; tips and gigs have none", () => {
  const src = (o: any) => ({ id: "s", name: "Job", kind: "paycheck", frequency: "monthly", amount: 1000, days: [], anchor: "", ...o });
  assert.deepEqual(paydays(src({ frequency: "semimonthly", days: [1, 15] }), "2026-11"), ["2026-11-01", "2026-11-15"]);
  assert.deepEqual(paydays(src({ frequency: "semimonthly", days: [15, 31] }), "2026-02"), ["2026-02-15", "2026-02-28"]);
  assert.deepEqual(paydays(src({ frequency: "biweekly", anchor: "2026-10-23" }), "2026-11"), ["2026-11-06", "2026-11-20"]);
  assert.deepEqual(paydays(src({ frequency: "biweekly", anchor: "2026-12-04" }), "2026-11"), ["2026-11-06", "2026-11-20"], "a payday in the future works too");
  assert.equal(paydays(src({ frequency: "weekly", anchor: "2026-11-06" }), "2026-10").length, 5);
  assert.deepEqual(paydays(src({ frequency: "monthly", days: [31] }), "2026-11"), ["2026-11-30"]);
  assert.deepEqual(paydays(src({ kind: "tips", frequency: "irregular" }), "2026-11"), []);
  assert.deepEqual(paydays(src({ kind: "other", frequency: "monthly", days: [5] }), "2026-11"), ["2026-11-05"], "other money on a set day (child support, a school check)");
  assert.deepEqual(paydays(src({ kind: "gig", frequency: "irregular" }), "2026-11"), []);
});

test("expected income: checks in the month, tips by the week, gigs by the month", () => {
  const p = plan({ sources: [
    { id: "a", name: "Job", kind: "paycheck", frequency: "biweekly", amount: 1100, days: [], anchor: "2026-10-02" },
    { id: "b", name: "Tips", kind: "tips", frequency: "irregular", amount: 300, days: [], anchor: "" },
    { id: "c", name: "DoorDash", kind: "gig", frequency: "irregular", amount: 400, days: [], anchor: "" },
  ] });
  // October 2026 has three Fridays two weeks apart from the 2nd (2, 16, 30).
  assert.equal(expectedIncome(p, "2026-10"), 3 * 1100 + 1300 + 400);
});

test("a split bill: half the rent on the 1st, half on the 15th, paid a bit at a time, the rest carried to next month", () => {
  let p = plan(), bills = [rent];
  assert.equal(billStatus(p, rent, "2026-11", "2026-11-03").state, "late", "the first half was due on the 1st");
  ({ plan: p, bills } = payBill(p, bills, "rent", "2026-11", 750, "2026-11-03", "p1"));
  let st = billStatus(p, bills[0], "2026-11", "2026-11-05");
  assert.equal(st.paid, 750); assert.equal(st.left, 750); assert.equal(st.nextDue, "2026-11-15"); assert.equal(st.state, "partial");
  ({ plan: p, bills } = payBill(p, bills, "rent", "2026-11", 400, "2026-11-15", "p2"));
  st = billStatus(p, bills[0], "2026-11", "2026-11-20");
  assert.equal(st.left, 350); assert.equal(st.state, "late");
  // December: the $350 still owed comes along with December's rent.
  const dec = billStatus(p, bills[0], "2026-12", "2026-12-01");
  assert.equal(dec.carried, 350); assert.equal(dec.owed, 1850); assert.equal(dec.nextAmount, 1100);
  // Paying it all marks the month paid (so alerts and widgets agree), and undo takes it back.
  ({ plan: p, bills } = payBill(p, bills, "rent", "2026-11", 350, "2026-11-25", "p3"));
  assert.ok(bills[0].paid.includes("2026-11"));
  assert.equal(billStatus(p, bills[0], "2026-12", "2026-12-01").carried, 0);
  ({ plan: p, bills } = unpayBill(p, bills, "rent", "2026-11"));
  assert.equal(billStatus(p, bills[0], "2026-11", "2026-11-25").paid, 0);
  // A bill never touched last month isn't counted as debt.
  assert.equal(billStatus(plan(), phone, "2026-12", "2026-12-01").carried, 0);
});

test("plan by paycheck (1st & 15th): each check covers the bills due before the next one, and safe to spend", () => {
  const p = plan({ style: "paycheck", sources: [{ id: "job", name: "Job", kind: "paycheck", frequency: "semimonthly", amount: 1400, days: [1, 15], anchor: "" }] });
  const { before, periods } = payPeriods(p, [rent, phone], "2026-11", "2026-11-03");
  assert.equal(before, null);
  assert.equal(periods.length, 2);
  assert.deepEqual(periods[0].bills.map((b) => `${b.bill.name} ${b.amount}`), ["Rent 750"]);
  assert.deepEqual(periods[1].bills.map((b) => `${b.bill.name} ${b.amount}`), ["Rent 750", "Phone 60"]);
  assert.equal(periods[0].left, 650); assert.equal(periods[1].left, 590);
  const safe = safeToSpend(p, [rent, phone], [{ id: "e", categoryId: "", amount: 50, date: "2026-11-02", note: "" }], "2026-11", "2026-11-03");
  assert.equal(safe!.amount, 600); assert.equal(safe!.until, "2026-11-15");
  const withTips = safeToSpend({ ...p, incomeLog: [{ id: "t", sourceId: "", date: "2026-11-02", amount: 80, kind: "tips", note: "" }] }, [rent, phone], [], "2026-11", "2026-11-03");
  assert.equal(withTips!.amount, 730, "tips logged since payday count");
});

test("the month: income to plan with, bills, spending, goals and what has no job yet", () => {
  const p = plan({ cushion: 100, sources: [{ id: "job", name: "Job", kind: "paycheck", frequency: "semimonthly", amount: 1400, days: [1, 15], anchor: "" }],
    goals: [{ id: "g", name: "Emergency fund", kind: "save", target: 1000, start: 0, due: "", monthly: 100, color: "#6e5ae0" }],
    incomeLog: [{ id: "x", sourceId: "", date: "2026-11-09", amount: 500, kind: "bonus", note: "" }] });
  const pic = monthPicture(p, [rent, phone], [], [{ id: "c", name: "Groceries", limit: 400 }], "2026-11", "2026-11-03");
  assert.equal(pic.expected, 2800); assert.equal(pic.billsOwed, 1560); assert.equal(pic.planned, 1560 + 400 + 100 + 100);
  assert.equal(pic.unplanned, 2800 - 2160);
});

test("tips by week with an average, and goals", () => {
  const p = plan({ incomeLog: [
    { id: "1", sourceId: "", date: "2026-10-27", amount: 200, kind: "tips", note: "" },
    { id: "2", sourceId: "", date: "2026-10-28", amount: 100, kind: "tips", note: "" },
    { id: "3", sourceId: "", date: "2026-11-03", amount: 250, kind: "tips", note: "" },
  ] });
  const t = tipWeeks(p, "2026-11-06");
  assert.equal(t.weeks.at(-1)!.total, 250); assert.equal(t.weeks.at(-2)!.total, 300); assert.equal(t.average, 300);
  const g = { id: "g", name: "Car", kind: "save" as const, target: 1200, start: 200, due: "2027-05-01", monthly: 100, color: "#6e5ae0" };
  const gp = goalProgress({ ...p, goalMoves: [{ id: "m", goalId: "g", amount: 100, date: "2026-11-01" }] }, g, "2026-11-06");
  assert.equal(gp.saved, 300); assert.equal(gp.left, 900); assert.equal(gp.needed, 150); assert.equal(gp.onTrack, false);
});

test("saved data: the plan and split bills survive cleaning, junk is dropped, old families get an empty plan", () => {
  const f = cleanFamily({ ...emptyFamily(), bills: [{ ...rent }], money: { setUp: true, style: "paycheck", sources: [{ id: "s", name: "Job", kind: "paycheck", frequency: "semimonthly", amount: 1400, days: [15, 1, 1] }, { name: "" }], payments: [{ id: "p", billId: "rent", month: "2026-11", amount: 100, date: "2026-11-02" }, { amount: -5 }] } });
  assert.equal(f.money.setUp, true); assert.equal(f.money.style, "paycheck");
  assert.deepEqual(f.money.sources.map((s) => s.days), [[1, 15]]);
  assert.equal(f.money.payments.length, 1);
  assert.deepEqual(f.bills[0].parts, rent.parts);
  const old = cleanFamily({ ...emptyFamily(), money: undefined });
  assert.equal(old.money.setUp, false);
  assert.equal(cleanParts([{ day: 1, amount: 10 }]), undefined, "one part is just the bill");
  assert.equal(cleanMoney("junk").sources.length, 0);
});

test("paydays that have come and aren't logged ask to be confirmed", async () => {
  const { paydaysToConfirm } = await import("../shared/moneyPlan");
  const p = plan({ sources: [{ id: "job", name: "Job", kind: "paycheck", frequency: "semimonthly", amount: 1400, days: [1, 15], anchor: "" }],
    incomeLog: [] });
  assert.deepEqual(paydaysToConfirm(p, "2026-11", "2026-11-16").map((x) => x.date), ["2026-11-01", "2026-11-15"]);
  const logged = { ...p, incomeLog: [{ id: "x", sourceId: "job", date: "2026-11-01", amount: 1400, kind: "pay" as const, note: "" }] };
  assert.deepEqual(paydaysToConfirm(logged, "2026-11", "2026-11-16").map((x) => x.date), ["2026-11-15"]);
  assert.deepEqual(paydaysToConfirm(logged, "2026-11", "2026-11-10").length, 0);
});

test("money in: what you already have is cleaned, totaled, and counts toward what's left", () => {
  const base = monthPicture(plan({ sources: [] }), [], [], [], "2026-11", "2026-11-08");
  const p = plan({ onHand: [{ id: "a", name: "Cash", amount: 200 }, { id: "b", name: "Checking", amount: 450.5 }] });
  const withHand = monthPicture(p, [], [], [], "2026-11", "2026-11-08");
  assert.equal(onHandTotal(p), 650.5);
  assert.equal(withHand.onHand, 650.5);
  assert.equal(withHand.leftover - base.leftover, 650.5);
  const c = cleanMoney(JSON.parse(JSON.stringify({ ...p, onHand: [...p.onHand, { id: "x", name: "", amount: 5 }, { id: "y", name: "Zero", amount: 0 }] })));
  assert.equal(c.onHand.length, 2);
  assert.deepEqual(cleanMoney(null).onHand, []);
  assert.deepEqual(cleanMoney({ setUp: true }).onHand, []);
});
