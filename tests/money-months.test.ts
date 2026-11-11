// Your Money: each month has its own bills, income and spending limits once it is changed, and a change in one
// month never reaches another (shared/moneyPlan.ts viewMonth / editMonth / payBillInMonth).
import test from "node:test";
import assert from "node:assert/strict";
import { cleanMoney, editMonth, emptyMoney, expectedIncome, monthsBack, payBillInMonth, unpayBillInMonth, viewMonth, type MoneyPlan, type PlanBill } from "../shared/moneyPlan";
import { cleanFamily, emptyFamily } from "../shared/familyHub";

const rent: PlanBill = { id: "rent", name: "Rent", amount: 1500, dueDay: 1, category: "", autopay: false, paid: [] };
const food = { id: "food", name: "Food", limit: 400 };
const job = { id: "job", name: "Job", kind: "paycheck" as const, frequency: "monthly" as const, amount: 3000, days: [1], anchor: "" };
const base = () => ({ money: { ...emptyMoney(), setUp: true, sources: [job] } as MoneyPlan, bills: [rent], budget: [food] });

test("a month nobody changed shows the plan as it was set up", () => {
  const f = base();
  const v = viewMonth(f.money, f.bills, f.budget, "2026-12");
  assert.equal(v.bills[0].amount, 1500);
  assert.equal(v.budget[0].limit, 400);
  assert.equal(expectedIncome(v.plan, "2026-12"), 3000);
});

test("changing the rent in one month leaves every other month alone", () => {
  const f = base();
  const { money } = editMonth(f, "2026-11", (v) => ({ ...v, bills: v.bills.map((b) => ({ ...b, amount: 1800 })) }));
  assert.equal(viewMonth(money, f.bills, f.budget, "2026-11").bills[0].amount, 1800);
  assert.equal(viewMonth(money, f.bills, f.budget, "2026-10").bills[0].amount, 1500, "last month");
  assert.equal(viewMonth(money, f.bills, f.budget, "2026-12").bills[0].amount, 1500, "next month");
  assert.equal(f.bills[0].amount, 1500, "the plan itself is not touched");
});

test("income and spending limits are per month too", () => {
  const f = base();
  let { money } = editMonth(f, "2026-11", (v) => ({ ...v, sources: v.sources.map((s) => ({ ...s, amount: 4000 })) }));
  ({ money } = editMonth({ ...f, money }, "2026-11", (v) => ({ ...v, budget: v.budget.map((c) => ({ ...c, limit: 250 })) })));
  assert.equal(expectedIncome(viewMonth(money, f.bills, f.budget, "2026-11").plan, "2026-11"), 4000);
  assert.equal(viewMonth(money, f.bills, f.budget, "2026-11").budget[0].limit, 250);
  assert.equal(expectedIncome(viewMonth(money, f.bills, f.budget, "2026-12").plan, "2026-12"), 3000);
  assert.equal(viewMonth(money, f.bills, f.budget, "2026-12").budget[0].limit, 400);
});

test("a bill added or removed in one month only exists there", () => {
  const f = base();
  const gym: PlanBill = { id: "gym", name: "Gym", amount: 30, dueDay: 5, category: "", autopay: false, paid: [] };
  let { money } = editMonth(f, "2026-11", (v) => ({ ...v, bills: [...v.bills, gym] }));
  assert.equal(viewMonth(money, f.bills, f.budget, "2026-11").bills.length, 2);
  assert.equal(viewMonth(money, f.bills, f.budget, "2026-12").bills.length, 1);
  ({ money } = editMonth({ ...f, money }, "2026-12", (v) => ({ ...v, bills: v.bills.filter((b) => b.id !== "rent") })));
  assert.equal(viewMonth(money, f.bills, f.budget, "2026-12").bills.length, 0);
  assert.equal(viewMonth(money, f.bills, f.budget, "2027-01").bills.length, 1, "other months keep it");
});

test("paying a bill still marks the plan's bill paid, in a changed month or not", () => {
  const f = base();
  const { money } = editMonth(f, "2026-11", (v) => ({ ...v, bills: v.bills.map((b) => ({ ...b, amount: 1800 })) }));
  const r = payBillInMonth({ money, bills: f.bills, budget: f.budget }, "2026-11", "rent", 1800, "2026-11-01", "p1");
  assert.deepEqual(r.bills[0].paid, ["2026-11"], "the calendar and alerts read this list");
  assert.equal(viewMonth(r.money, r.bills, f.budget, "2026-11").bills[0].paid.includes("2026-11"), true);
  assert.equal(r.money.sources[0].id, "job", "the plan's own income is kept");
  const undone = unpayBillInMonth({ money: r.money, bills: r.bills, budget: f.budget }, "2026-11", "rent");
  assert.deepEqual(undone.bills[0].paid, []);
  // An unchanged month works the way it always did.
  const plain = payBillInMonth(f, "2026-12", "rent", 1500, "2026-12-01", "p2");
  assert.deepEqual(plain.bills[0].paid, ["2026-12"]);
});

test("a bill that only exists in one month keeps its paid state in that month", () => {
  const f = base();
  const gym: PlanBill = { id: "gym", name: "Gym", amount: 30, dueDay: 5, category: "", autopay: false, paid: [] };
  const { money } = editMonth(f, "2026-11", (v) => ({ ...v, bills: [...v.bills, gym] }));
  const r = payBillInMonth({ money, bills: f.bills, budget: f.budget }, "2026-11", "gym", 30, "2026-11-05", "p3");
  assert.equal(r.bills.length, 1, "the plan did not gain the bill");
  assert.deepEqual(viewMonth(r.money, r.bills, f.budget, "2026-11").bills.find((b) => b.id === "gym")!.paid, ["2026-11"]);
});

test("the six-month history uses each month's own bills", () => {
  const f = base();
  const paid: PlanBill = { ...rent, paid: ["2026-10", "2026-11"] };
  const { money } = editMonth({ ...f, bills: [paid] }, "2026-11", (v) => ({ ...v, bills: v.bills.map((b) => ({ ...b, amount: 1800 })) }));
  const h = monthsBack(money, [paid], [], "2026-11");
  assert.equal(h.find((x) => x.month === "2026-10")!.bills, 1500);
  assert.equal(h.find((x) => x.month === "2026-11")!.bills, 1800);
});

test("saved months survive cleaning, and a family keeps them", () => {
  const f = base();
  const { money } = editMonth(f, "2026-11", (v) => ({ ...v, bills: v.bills.map((b) => ({ ...b, amount: 1800 })) }));
  const back = cleanMoney(JSON.parse(JSON.stringify(money)));
  assert.equal(back.months!["2026-11"].bills[0].amount, 1800);
  assert.equal(back.months!["2026-11"].sources[0].name, "Job");
  assert.equal(back.months!["2026-11"].budget[0].limit, 400);
  const fam = cleanFamily({ ...emptyFamily(), money });
  assert.equal(fam.money.months!["2026-11"].bills[0].amount, 1800);
  assert.equal(cleanMoney({ months: { "not-a-month": { bills: [] } } }).months, undefined);
});
