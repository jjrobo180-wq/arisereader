import test from "node:test";
import assert from "node:assert/strict";
import { merge3 } from "../shared/mergeJson";

test("each device's own changes are kept", () => {
  const base = { title: "Week", tasks: [{ id: "a", t: "Milk", done: false }, { id: "b", t: "Eggs", done: false }], theme: "classic" };
  const phone = { ...base, tasks: [{ id: "a", t: "Milk", done: true }, base.tasks[1], { id: "c", t: "Bread", done: false }] };
  const laptop = { ...base, theme: "zen", tasks: [base.tasks[0], { id: "b", t: "Eggs (12)", done: false }] };
  const m = merge3(base, phone, laptop);
  assert.equal(m.theme, "zen");
  assert.deepEqual(m.tasks.map((x) => x.id), ["a", "b", "c"]);
  assert.equal(m.tasks[0].done, true);
  assert.equal(m.tasks[1].t, "Eggs (12)");
});

test("deletes stick unless the other device edited the item", () => {
  const base = { list: [{ id: 1, n: "x" }, { id: 2, n: "y" }, { id: 3, n: "z" }] };
  const a = { list: [{ id: 1, n: "x" }, { id: 3, n: "z" }] };            // deleted 2
  const b = { list: [{ id: 1, n: "x" }, { id: 2, n: "y" }, { id: 3, n: "Z!" }] }; // edited 3
  assert.deepEqual(merge3(base, a, b).list, [{ id: 1, n: "x" }, { id: 3, n: "Z!" }]);
  const c = { list: [{ id: 2, n: "y edited" }, { id: 3, n: "z" }] };      // deleted 1, edited 2

  assert.ok(merge3(base, a, c).list.some((x) => x.id === 2), "edited on one device, deleted on the other: kept");
  assert.ok(!merge3(base, a, c).list.some((x) => x.id === 1), "deleted on one, untouched on the other: gone");
});

test("same field changed on both: this device wins; nested objects merge; no base unions safely", () => {
  assert.deepEqual(merge3({ a: 1, s: { x: 1, y: 1 } }, { a: 2, s: { x: 2, y: 1 } }, { a: 3, s: { x: 1, y: 3 } }), { a: 2, s: { x: 2, y: 3 } });
  const m = merge3(undefined, { items: [{ id: "p", v: 1 }] }, { items: [{ id: "q", v: 2 }] });
  assert.deepEqual(m.items.map((x) => x.id).sort(), ["p", "q"]);
  assert.deepEqual(merge3(["a", "b"], ["a", "b", "c"], ["b", "d"]), ["b", "c", "d"]);
});

test("dated entries without ids (weigh-ins) from both devices are all kept", () => {
  const base = { weights: [{ date: "2026-11-01", kg: 90 }] };
  const a = { weights: [...base.weights, { date: "2026-11-02", kg: 89.8 }] };
  const b = { weights: [...base.weights, { date: "2026-11-03", kg: 89.5 }] };
  assert.equal(merge3(base, a, b).weights.length, 3);
});
