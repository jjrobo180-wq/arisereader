// Money: copy bills, income and limits from last month or to next month, all at once or just what's picked.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanMoney, copyMonth, editMonth, emptyMoney, monthCopyItems, onHandIn, viewMonth, type MoneyPlan, type PlanBill } from "../shared/moneyPlan";

const bill = (id: string, name: string, amount: number, dueDay = 1): PlanBill => ({ id, name, amount, dueDay, category: "", autopay: false, paid: [] });
let n = 0; const makeId = () => `id${++n}`;
function base() {
  const money: MoneyPlan = { ...emptyMoney(), setUp: true, sources: [{ id: "job", name: "Job", kind: "paycheck", frequency: "biweekly", amount: 1500, days: [], anchor: "2026-01-02" }],
    incomeLog: [{ id: "bonus", sourceId: "", date: "2026-10-31", amount: 500, kind: "bonus", note: "Bonus" }] };
  return { money, bills: [bill("rent", "Rent", 1200), bill("phone", "Phone", 60, 15)], budget: [{ id: "food", name: "Food", limit: 400 }] };
}

test("October's changes can be brought into November in one go, and only November changes", () => {
  let f = base();
  // October: rent went up, a new gym bill, a side gig, a bigger food limit.
  f = { ...f, ...editMonth(f, "2026-10", (v) => ({ bills: [...v.bills.map((b) => (b.id === "rent" ? { ...b, amount: 1300 } : b)), bill("gym", "Gym", 40, 5)], sources: [...v.sources, { id: "gig", name: "Gig", kind: "gig", frequency: "irregular", amount: 300, days: [], anchor: "" }], budget: [{ id: "food", name: "Food", limit: 500 }] })) };
  // Rent is already paid in November.
  f = { ...f, bills: f.bills.map((b) => (b.id === "rent" ? { ...b, paid: ["2026-11"] } : b)) };
  const { items, limitsDiffer } = monthCopyItems(f, "2026-10", "2026-11");
  assert.equal(items.find((i) => i.id === "rent")!.there, "changes");
  assert.equal(items.find((i) => i.id === "gym")!.there, "new");
  assert.equal(items.find((i) => i.id === "phone")!.there, "same");
  assert.equal(items.find((i) => i.id === "gig")!.there, "new");
  assert.equal(items.find((i) => i.kind === "logged")!.detail.includes("11/30"), true, "Oct 31 lands on Nov 30");
  assert.ok(limitsDiffer);
  const r = copyMonth(f, "2026-10", "2026-11", { bills: items.filter((i) => i.kind === "bill").map((i) => i.id), sources: ["job", "gig"], logged: ["bonus"], limits: true }, makeId);
  const after = { ...f, money: r.money };
  const nov = viewMonth(after.money, after.bills, after.budget, "2026-11");
  assert.equal(nov.bills.find((b) => b.id === "rent")!.amount, 1300);
  assert.deepEqual(nov.bills.find((b) => b.id === "rent")!.paid, ["2026-11"], "what was paid stays paid");
  assert.ok(nov.bills.some((b) => b.id === "gym"));
  assert.deepEqual(nov.plan.sources.map((s) => s.id), ["job", "gig"]);
  assert.equal(nov.budget[0].limit, 500);
  assert.ok(after.money.incomeLog.some((e) => e.date === "2026-11-30" && e.amount === 500));
  // December and September are untouched.
  assert.equal(viewMonth(after.money, after.bills, after.budget, "2026-12").bills.find((b) => b.id === "rent")!.amount, 1200);
  assert.equal(after.money.months?.["2026-09"], undefined);
  // Copying again doesn't log the bonus twice.
  const again = copyMonth(after, "2026-10", "2026-11", { bills: [], sources: [], logged: ["bonus"], limits: false }, makeId);
  assert.equal(again.money.incomeLog.filter((e) => e.date === "2026-11-30").length, 1);
});

test("picking only some items copies only those", () => {
  let f = base();
  f = { ...f, ...editMonth(f, "2026-11", (v) => ({ ...v, bills: [...v.bills, bill("car", "Car", 350, 20)] })) };
  const r = copyMonth(f, "2026-11", "2026-12", { bills: ["car"], sources: [], logged: [], limits: false }, makeId);
  const dec = viewMonth(r.money, f.bills, f.budget, "2026-12");
  assert.deepEqual(dec.bills.map((b) => b.id), ["rent", "phone", "car"]);
  assert.equal(copyMonth(f, "2026-11", "2026-11", { bills: ["car"], sources: [], logged: [], limits: false }, makeId).money, f.money, "a month onto itself does nothing");
});

test("the Money screen has a Copy button with one-tap bring-everything", () => {
  const ui = read("client/src/components/family-hub/MonthCopy.tsx");
  assert.match(ui, /data-testid="month-copy-all"/);
  assert.match(ui, /Bring all bills and money in/);
  assert.match(read("client/src/components/family-hub/Money.tsx"), /data-testid="budget-copy-months"/);
});
test("each month is its own: money in, spending, income and bill payments stay in the month they're added to", () => {
  const m = { ...emptyMoney(), onHand: [{ id: "a", name: "Cash", amount: 200, month: "2026-11" }, { id: "b", name: "Old jar", amount: 50 }] };
  assert.deepEqual(onHandIn(m, "2026-11", "2026-11").map((o) => o.id), ["a", "b"], "an older entry counts in this month only");
  assert.deepEqual(onHandIn(m, "2026-12", "2026-11").map((o) => o.id), [], "December starts with no money in");
  assert.equal(cleanMoney(JSON.parse(JSON.stringify(m))).onHand[0].month, "2026-11");
  // Copying money in brings it over only when asked.
  const f = { money: m, bills: [] as PlanBill[], budget: [] };
  const r = copyMonth(f, "2026-11", "2026-12", { bills: [], sources: [], logged: [], limits: false, held: ["a"] }, makeId, "2026-11");
  assert.deepEqual(onHandIn(r.money, "2026-12", "2026-11").map((o) => [o.name, o.amount]), [["Cash", 200]]);
  const ui = read("client/src/components/family-hub/Money.tsx");
  assert.match(ui, /const inMonth = month === today\.slice\(0, 7\) \? today : sameDayIn\(today, month\);/);
  assert.match(ui, /const pay = \(b: PlanBill, amount: number, date = inMonth\) =>/);
  assert.doesNotMatch(ui, /setIncome\(\{[^}]*date: today \}\)/, "new income is dated in the month being looked at");
  assert.match(ui, /setExpense\(\(x\) => \(\{ \.\.\.x, date: month === today\.slice\(0, 7\) \? today : sameDayIn\(today, month\) \}\)\)/);
  assert.match(ui, /onHand: onHandIn\(view\.plan, month, today\.slice\(0, 7\)\)/);
});
function read(p: string) { return readFileSync(new URL(`../${p}`, import.meta.url), "utf8"); }
