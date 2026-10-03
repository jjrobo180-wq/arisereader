import test from "node:test";
import assert from "node:assert/strict";
import { COLLIDERS, LOTS, SPAWN, SPOTS, ROAD_LINES, ROAD_HALF, resolveCircle, surfaceAt, clampToBounds, nearestSpot, BOUNDS, CITY } from "../shared/city/layout";
import { CARS, stepCar, type CarState } from "../shared/city/drive";
import { LAP_LENGTH, START_S, trackPoint, trackProgress, startTracker, updateTracker, lapsDone, makeRivals, stepRival, GRID_PLAYER } from "../shared/city/race";
import { makeTraffic, stepTraffic, LOOPS } from "../shared/city/traffic";

const inside = (x: number, z: number, pad = 0) => COLLIDERS.some((b) => x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad);

test("there are 18 home lots, all off the roads", () => {
  assert.equal(LOTS.length, 18);
  for (const l of LOTS) {
    for (const r of ROAD_LINES) {
      assert.ok(Math.abs(l.x - r) > ROAD_HALF + 5, `lot ${l.index} x`);
      assert.ok(Math.abs(l.z - r) > ROAD_HALF + 5, `lot ${l.index} z`);
    }
  }
});

test("spawn, doors and shop spots are reachable (not inside a building)", () => {
  assert.ok(!inside(SPAWN.x, SPAWN.z, 1));
  for (const s of SPOTS) assert.ok(!inside(s.x, s.z, 0.4), `${s.id} is blocked`);
});

test("every door can be walked to from the road", () => {
  for (const l of LOTS) assert.equal(nearestSpot(l.doorX, l.doorZ, ["home"])?.lot, l.index);
});

test("roads are road, the speedway is track", () => {
  assert.equal(surfaceAt(40, 10), "road");
  assert.equal(surfaceAt(0, 130), "road");
  const p = trackPoint(100);
  assert.equal(surfaceAt(p.x, p.z), "track");
});

test("bounds hold, including the corners south of the city", () => {
  const [x, z] = clampToBounds(200, 400);
  assert.ok(x <= CITY && z <= BOUNDS.maxZ);
  const [x2, z2] = clampToBounds(150, 165, 1);
  assert.ok(!(z2 > CITY - 1 && Math.abs(x2) > 129));
});

test("track progress inverts track points", () => {
  for (let s = 0; s < LAP_LENGTH; s += 37) {
    const p = trackPoint(s);
    assert.ok(Math.abs(trackProgress(p.x, p.z) - s) < 0.01, `s=${s}`);
  }
});

test("a full lap counts once; cutting across the infield doesn't help", () => {
  let t = startTracker(GRID_PLAYER.x, GRID_PLAYER.z);
  for (let s = START_S - 4; s <= START_S + LAP_LENGTH + 2; s += 1) { const p = trackPoint(s); t = updateTracker(t, p.x, p.z); }
  assert.equal(lapsDone(t), 1);
  let c = startTracker(GRID_PLAYER.x, GRID_PLAYER.z);
  const a = trackPoint(START_S + 20), b = trackPoint(START_S + 20 + LAP_LENGTH / 2);
  c = updateTracker(c, a.x, a.z);
  c = updateTracker(c, b.x, b.z); // teleport straight across
  assert.ok(c.distance < 40);
});

test("cars speed up, respect their top speed and bounce off walls", () => {
  let car: CarState = { x: 43, z: -150, heading: 0, speed: 0, drift: 0 }; // south down the x=40 road
  for (let i = 0; i < 600; i++) car = stepCar(car, { throttle: 1, brake: 0, steer: 0, handbrake: false }, CARS["car-super"], 1 / 60).car;
  assert.ok(car.speed > 20 && car.speed <= CARS["car-super"].top);
  // drive at the cinema wall
  let c2: CarState = { x: 55, z: 0, heading: Math.PI / 2, speed: 20, drift: 0 };
  let bumped = false;
  for (let i = 0; i < 120; i++) { const r = stepCar(c2, { throttle: 1, brake: 0, steer: 0, handbrake: false }, CARS["car-starter"], 1 / 60); c2 = r.car; bumped ||= r.bumped; }
  assert.ok(bumped);
  assert.ok(c2.x < 67);
});

test("the free starter is the slowest car", () => {
  for (const c of Object.values(CARS)) if (c.id !== "car-starter") assert.ok(c.top > CARS["car-starter"].top);
});

test("rivals finish laps at different paces", () => {
  let rivals = makeRivals();
  for (let i = 0; i < 60 * 30; i++) rivals = rivals.map((r) => stepRival(r, 1 / 60, i / 60));
  assert.ok(rivals[2].distance > rivals[1].distance && rivals[1].distance > rivals[0].distance);
});

test("traffic stays on the roads and keeps moving", () => {
  let cars = makeTraffic(3);
  assert.equal(cars.length, LOOPS.length * 3);
  const start = cars.map((c) => c.s);
  for (let i = 0; i < 60 * 60; i++) cars = stepTraffic(cars, [], 1 / 60);
  cars.forEach((c, i) => {
    assert.equal(surfaceAt(c.x, c.z), "road");
    assert.ok(c.s - start[i] > 100, `car ${c.id} stalled`);
  });
  assert.ok(!resolveCircle(0, 16, 1).hit);
});
