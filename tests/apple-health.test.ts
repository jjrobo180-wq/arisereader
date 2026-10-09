import test from "node:test";
import assert from "node:assert/strict";
import { applySync, appleExerciseId, cleanSyncBody } from "../shared/appleHealth";
import { cleanHealth } from "../shared/familyHub";

test("Shortcut posts are cleaned: text numbers, kg, bad values", () => {
  assert.deepEqual(cleanSyncBody({ date: "2026-10-09", steps: "8,421", activeCalories: 512.6, weight: "152.3 lb" }, "2026-01-01"),
    { date: "2026-10-09", steps: 8421, activeCalories: 513, weight: 152.3 });
  assert.equal(cleanSyncBody({ weight: 70, weightUnit: "kg" }, "2026-10-09")?.weight, 154.3);
  assert.equal(cleanSyncBody({ steps: 900 }, "2026-10-09")?.date, "2026-10-09");
  assert.equal(cleanSyncBody({ steps: -5, activeCalories: 99999 }, "2026-10-09"), null);
  assert.equal(cleanSyncBody("junk", "2026-10-09"), null);
});

test("synced days fill steps, active calories and weight, and nothing changes the second time", () => {
  let h = cleanHealth({ days: [{ id: "me:2026-10-09", memberId: "me", date: "2026-10-09", water: 3, steps: 100, fruitVeg: 0 }] });
  const day = { memberId: "me", date: "2026-10-09", steps: 8421, activeCalories: 513, weight: 152.3 };
  h = applySync(h, [day]);
  assert.deepEqual(h.days[0], { id: "me:2026-10-09", memberId: "me", date: "2026-10-09", water: 3, steps: 8421, fruitVeg: 0 });
  assert.equal(h.exercise.find((x) => x.id === appleExerciseId("me", "2026-10-09"))?.calories, 513);
  assert.equal(h.weights[0].weight, 152.3);
  assert.equal(applySync(h, [day]), h);
  const later = applySync(h, [{ ...day, steps: 9000, weight: null, activeCalories: null }]);
  assert.equal(later.days[0].steps, 9000);
  assert.equal(later.exercise.length, 1);
});

test("a weight typed in by hand that day is not overwritten", () => {
  const h = cleanHealth({ weights: [{ id: "w1", memberId: "me", date: "2026-10-09", weight: 150 }] });
  assert.equal(applySync(h, [{ memberId: "me", date: "2026-10-09", steps: null, activeCalories: null, weight: 152 }]), h);
});

test("Health Auto Export posts: hourly steps summed, kJ and kg converted, newest days kept", async () => {
  const { cleanAutoExport } = await import("../shared/appleHealth");
  const days = cleanAutoExport({ data: { metrics: [
    { name: "step_count", units: "count", data: [{ date: "2026-10-08 09:00:00 -0600", qty: 4000 }, { date: "2026-10-08 18:00:00 -0600", qty: 2500 }, { date: "2026-10-09 08:00:00 -0600", qty: 1200 }] },
    { name: "active_energy", units: "kJ", data: [{ date: "2026-10-09 00:00:00 -0600", qty: 2092 }] },
    { name: "weight_body_mass", units: "kg", data: [{ date: "2026-10-09 07:00:00 -0600", qty: 70 }] },
    { name: "heart_rate", units: "count/min", data: [{ date: "2026-10-09", qty: 60 }] },
  ] } });
  assert.deepEqual(days, [
    { date: "2026-10-08", steps: 6500, activeCalories: null, weight: null },
    { date: "2026-10-09", steps: 1200, activeCalories: 500, weight: 154.3 },
  ]);
  assert.deepEqual(cleanAutoExport({ nope: 1 }), []);
});
