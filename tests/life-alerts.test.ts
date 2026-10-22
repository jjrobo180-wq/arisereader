import test from "node:test";
import assert from "node:assert/strict";
import { emptyFamily } from "../shared/familyHub";
import { lifeAlerts } from "../shared/lifeAlerts";

const TODAY = "2026-10-15";
const NOW = new Date(2026, 9, 15, 9, 0).getTime();

test("overdue and due-today tasks are listed, done ones are not", () => {
  const items = lifeAlerts(emptyFamily(), [
    { id: "a", title: "Pay rent", due: "2026-10-10", time: "", done: false },
    { id: "b", title: "Call mom", due: TODAY, time: "17:00", done: false },
    { id: "c", title: "Done", due: TODAY, time: "", done: true },
    { id: "d", title: "Next week", due: "2026-10-22", time: "", done: false },
  ], TODAY, NOW);
  assert.deepEqual(items.map((i) => i.title), ["Pay rent", "Call mom"]);
  assert.equal(items[0].category, "report"); assert.match(items[0].body, /Overdue/);
  assert.match(items[1].body, /5 PM/);
  assert.ok(items.every((i) => i.key.startsWith("life:") && i.kind === "action" && i.target?.type.startsWith("life:")));
});

test("bills, chores and an event in the next hours show up; far-off ones do not", () => {
  const f = emptyFamily();
  f.sections = { money: true, chores: true };
  f.bills = [{ id: "g", name: "Gas", amount: 95, dueDay: 15, category: "", autopay: false, paid: [] }, { id: "r", name: "Rent", amount: 1200, dueDay: 28, category: "", autopay: false, paid: [] }];
  f.chores = [{ id: "c1", title: "Dishes", memberId: "", rotation: [], days: [], points: 1 }];
  f.events = [{ id: "e1", title: "Dentist", date: TODAY, time: "10:30", endTime: "", calendarId: "", memberIds: [], location: "Main St", notes: "", repeat: "none" }, { id: "e2", title: "Late show", date: TODAY, time: "21:00", endTime: "", calendarId: "", memberIds: [], location: "", notes: "", repeat: "none" }];
  const t = lifeAlerts(f, [], TODAY, NOW).map((i) => i.title);
  assert.ok(t.includes("Gas: $95.00")); assert.ok(!t.some((x) => x.startsWith("Rent")));
  assert.ok(t.includes("1 chore left today"));
  assert.ok(t.includes("Dentist at 10:30 AM")); assert.ok(!t.some((x) => x.startsWith("Late show")));
  assert.equal(lifeAlerts(emptyFamily(), [], TODAY, NOW).length, 0);
});
