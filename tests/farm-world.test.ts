import test from "node:test";
import assert from "node:assert/strict";
import { HORSESHOES, OBSTACLES, ON_FOOT, PLACES, ROAM, areaName, horseshoesInReach, inBox, inPond, stepMover, walkable } from "../shared/farm/layout";

test("every horseshoe and place is somewhere you can actually walk to", () => {
  assert.equal(new Set(HORSESHOES.map(h => h.id)).size, HORSESHOES.length);
  for (const h of HORSESHOES) assert.ok(walkable(h.x, h.z), h.id);
  for (const p of PLACES) assert.ok(walkable(p.x, p.z), p.id);
});

test("buildings, the pond and the edge of the farm block your way", () => {
  for (const o of OBSTACLES) assert.equal(walkable((o.minX + o.maxX) / 2, (o.minZ + o.maxZ) / 2), false);
  assert.equal(walkable(33.5, 25.5), false);
  assert.equal(walkable(ROAM.maxX + 1, 0), false);
  assert.ok(walkable(0, 10));
  assert.ok(inPond(33.5, 25.5) && !inPond(0, 0));
  assert.ok(inBox(0, -19, OBSTACLES[1]));
});

test("walking forward moves you the way you face; turning turns you", () => {
  let m = { x: 0, z: 0, facing: 0, speed: 0 };
  for (let i = 0; i < 60; i++) m = stepMover(m, { forward: 1, turn: 0, run: false, target: null }, ON_FOOT, 1 / 30).m;
  assert.ok(m.z > 5 && Math.abs(m.x) < 1e-6, `z=${m.z}`);
  const before = m.facing; m = stepMover(m, { forward: 0, turn: 1, run: false, target: null }, ON_FOOT, 0.5).m;
  assert.ok(m.facing > before);
});

test("running is faster than walking", () => {
  const go = (run: boolean) => { let m = { x: 0, z: 0, facing: 0, speed: 0 }; for (let i = 0; i < 60; i++) m = stepMover(m, { forward: 1, turn: 0, run, target: null }, ON_FOOT, 1 / 30).m; return m.z; };
  assert.ok(go(true) > go(false) * 1.4);
});

test("look-to-walk: heading to a target arrives there", () => {
  let m = { x: 0, z: 0, facing: Math.PI, speed: 0 }; let arrived = false;
  for (let i = 0; i < 600 && !arrived; i++) { const r = stepMover(m, { forward: 0, turn: 0, run: false, target: { x: 8, z: 6 } }, ON_FOOT, 1 / 30); m = r.m; arrived = r.arrived; }
  assert.ok(arrived && Math.hypot(m.x - 8, m.z - 6) < 0.7);
});

test("you slide along a barn wall instead of getting stuck", () => {
  let m = { x: -0.5, z: -12, facing: -Math.PI + 0.4, speed: 0 };
  for (let i = 0; i < 120; i++) m = stepMover(m, { forward: 1, turn: 0, run: false, target: null }, ON_FOOT, 1 / 30).m;
  assert.ok(walkable(m.x, m.z));
  assert.ok(m.x < -2, `slid sideways x=${m.x}`);
});

test("horseshoes are picked up only when you're right next to them", () => {
  const h = HORSESHOES[0];
  assert.deepEqual(horseshoesInReach(h.x + 0.5, h.z, []), [h.id]);
  assert.deepEqual(horseshoesInReach(h.x + 5, h.z, []), []);
  assert.deepEqual(horseshoesInReach(h.x, h.z, [h.id]), []);
});

test("areas have friendly names", () => {
  assert.equal(areaName(33.5 - 9, 23), "Duck pond");
  assert.equal(areaName(-22, 14), "Cow & sheep field");
});
