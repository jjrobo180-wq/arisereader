// The board the 40 Arise To Duo iPhone widget designs draw (client/src/lib/duoBoard.ts, DuoDesigns.swift).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { duoBoard } from "../client/src/lib/duoBoard";
import { readFocusLink } from "../client/src/lib/duoFocus";

const T = (id: string, due: string, extra: Record<string, unknown> = {}) => ({ id, title: `Task ${id}`, due, time: "", done: false, ...extra });

test("counts, the tasks that matter now (late first) and their labels", () => {
  const b = duoBoard([
    T("a", "2026-11-16"), T("b", "2026-11-17", { time: "15:00" }), T("c", "2026-11-17", { done: true }), T("d", "2026-11-18"), T("e", "2026-11-10", { done: true }), T("f", ""),
  ], [{ name: "Routines", color: "#f07a3b", count: 2 }], "2026-11-17", 1);
  assert.equal(b.open, 4); assert.equal(b.overdue, 1); assert.equal(b.today, 2); assert.equal(b.todayDone, 1); assert.equal(b.upcoming, 1); assert.equal(b.done, 2); assert.equal(b.asks, 1);
  assert.deepEqual(b.tasks.map((t) => t.id), ["a", "b", "c", "d", "f"]);
  assert.equal(b.tasks[0].label, "Yesterday"); assert.equal(b.tasks[0].late, true);
  assert.equal(b.tasks[1].label, "3:00 PM"); assert.equal(b.tasks[1].today, true);
  assert.equal(b.tasks[2].label, "Done");
  assert.equal(b.date, "Tuesday, Nov 17");
});

test("this week (Mon to Fri) and this month's dots", () => {
  const b = duoBoard([T("a", "2026-11-16"), T("b", "2026-11-19"), T("c", "2026-11-19"), T("d", "2026-12-01")], [], "2026-11-17");
  assert.deepEqual(b.week.map((d) => `${d.label} ${d.day} ${d.count}${d.today ? "*" : ""}${d.late ? "!" : ""}`), ["Mon 16 1!", "Tue 17 0*", "Wed 18 0", "Thu 19 2", "Fri 20 0"]);
  assert.equal(b.monthFirst, 0); assert.equal(b.monthDays, 30); assert.equal(b.monthToday, 17);
  assert.deepEqual(b.dots, [16, 19]);
});

test("the widgets' Add and Tasks buttons open the app there", () => {
  assert.deepEqual(readFocusLink("arisetodo://focus/add"), { kind: "add" });
  assert.deepEqual(readFocusLink("arisetodo://focus/tasks"), { kind: "tasks" });
  const rb = readFileSync(new URL("../.github/scripts/add_widget.rb", import.meta.url), "utf8");
  assert.match(rb, /DuoSmallWidget\(\)\\n {8}DuoMediumWidget\(\)\\n {8}DuoLargeWidget\(\)\\n {8}DuoLockWidget\(\)/);
  const swift = readFileSync(new URL("../native/widget-extension/DuoDesigns.swift", import.meta.url), "utf8");
  for (const n of ["DuoSmallStyle", "DuoMediumStyle", "DuoLargeStyle", "DuoLockStyle"]) {
    const body = swift.slice(swift.indexOf(`enum ${n}`), swift.indexOf("}", swift.indexOf(`enum ${n}`)));
    assert.equal((body.match(/"\d+ · /g) || []).length, 10, `${n}: ten designs`);
  }
});
