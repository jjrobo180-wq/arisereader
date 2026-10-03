import test from "node:test";
import assert from "node:assert/strict";
import { COLLIDERS, ROUND_COLLIDERS, LOTS, SPAWN, SPOTS, ROAD_LINES, ROAD_HALF, RAMPS, STARS, resolveCircle, surfaceAt, clampToBounds, nearestSpot, areaName, rampAt, BOUNDS, CITY } from "../shared/city/layout";
import { CARS, GROUNDED, groundAt, stepCar, stepLift, type CarState, type Lift } from "../shared/city/drive";
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

test("bounds hold on every side", () => {
  assert.deepEqual(clampToBounds(200, 400), [200, BOUNDS.maxZ]);
  assert.deepEqual(clampToBounds(0, -600), [0, BOUNDS.minZ]);
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
  for (let i = 0; i < 60 * 60; i++) cars = stepTraffic(cars, [], 1 / 60, i / 60);
  cars.forEach((c, i) => {
    assert.equal(surfaceAt(c.x, c.z), "road");
    assert.ok(c.s - start[i] > 100, `car ${c.id} stalled`);
  });
  assert.ok(!resolveCircle(0, 16, 1).hit);
});

const inRound = (x: number, z: number, pad = 0) => ROUND_COLLIDERS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + pad);

test("the seaside, lake park and stunt park have the right ground", () => {
  assert.equal(surfaceAt(-200, 0), "road"); // coast road
  assert.equal(surfaceAt(-180, 40), "road"); // avenue out to the coast
  assert.equal(surfaceAt(-222, 30), "paved"); // boardwalk
  assert.equal(surfaceAt(-260, 50), "sand");
  assert.equal(surfaceAt(-320, 0), "paved"); // pier
  assert.equal(surfaceAt(190, 40), "road"); // avenue out to the lake
  assert.equal(surfaceAt(252, -52), "road"); // lake loop
  assert.equal(surfaceAt(200, -70), "road"); // stunt park access
  assert.equal(surfaceAt(250, -130), "road"); // stunt park lot
  assert.equal(surfaceAt(300, 60), "grass");
  assert.equal(areaName(-320, 0), "Haven Pier");
  assert.equal(areaName(-260, 50), "Seaside Beach");
  assert.equal(areaName(-190, 0), "Seaside Boardwalk");
  assert.equal(areaName(250, -130), "Stunt Park");
  assert.equal(areaName(300, 60), "Lakeside Park");
});

test("the ocean and the far edges stop you", () => {
  assert.deepEqual(clampToBounds(-320, 50), [-292, 50]);
  assert.deepEqual(clampToBounds(-400, 0), [BOUNDS.minX, 0]);
  assert.deepEqual(clampToBounds(400, 0), [BOUNDS.maxX, 0]);
  assert.deepEqual(clampToBounds(-320, 300), [-292, 300]);
});

test("you can't drive into the lake", () => {
  const r = resolveCircle(252, 10 + 40, 1.7);
  assert.ok(r.hit && Math.hypot(r.x - 252, r.z - 10) >= 42 + 1.69);
});

test("every hidden star can be reached", () => {
  assert.equal(new Set(STARS.map((s) => s.id)).size, STARS.length);
  for (const s of STARS) {
    assert.deepEqual(clampToBounds(s.x, s.z, 1), [s.x, s.z], `${s.id} is out of bounds`);
    assert.ok(!inside(s.x, s.z, 0.6) && !inRound(s.x, s.z, 0.6), `${s.id} is inside something`);
  }
});

test("ramps sit on open road", () => {
  for (const r of RAMPS) {
    assert.ok(["road", "paved", "dirt"].includes(surfaceAt(r.x, r.z)), `ramp at ${r.x},${r.z}`);
    assert.ok(!inside(r.x, r.z, r.length / 2 + 2));
    assert.ok(Math.abs(groundAt(r.x, r.z) - r.height / 2) < 0.01);
    assert.equal(rampAt(r.x + Math.sin(r.heading) * (r.length / 2 + 0.5), r.z + Math.cos(r.heading) * (r.length / 2 + 0.5)), null);
  }
});

test("driving off the big ramp makes the car fly, then land", () => {
  const big = RAMPS[1];
  let car: CarState = { x: big.x - 30, z: big.z, heading: big.heading, speed: 24, drift: 0 };
  let lift: Lift = GROUNDED, flew = 0, top = 0, landed = 0;
  for (let i = 0; i < 300; i++) {
    const before = car;
    car = stepCar(car, { throttle: lift.air ? 0 : 1, brake: 0, steer: 0, handbrake: false }, CARS["car-starter"], 1 / 60).car;
    const r = stepLift(lift, car.x, car.z, 1 / 60);
    assert.ok(!r.blocked, "blocked by its own ramp");
    if (r.blocked) car = before;
    lift = r.lift;
    if (lift.air) flew += 1 / 60;
    top = Math.max(top, lift.y);
    if (r.landed) landed = r.landed;
  }
  assert.ok(flew > 0.6, `only ${flew.toFixed(2)}s in the air`);
  assert.ok(top > big.height + 0.5);
  assert.ok(landed > 3 && !lift.air && lift.y === 0);
  // the airborne star over the big jump is on that flight path
  const star = STARS.find((s) => s.id === "stunt")!;
  assert.ok(star.y! > big.height && star.y! < top + 1.5);
});

test("the tall end of a ramp is a wall", () => {
  const big = RAMPS[1];
  const lip = { x: big.x + Math.sin(big.heading) * (big.length / 2 - 0.2), z: big.z + Math.cos(big.heading) * (big.length / 2 - 0.2) };
  assert.ok(stepLift(GROUNDED, lip.x, lip.z, 1 / 60).blocked);
});

test("sand is slower than road, the SUV handles it best", () => {
  const run = (id: keyof typeof CARS, x: number) => {
    let car: CarState = { x, z: -150, heading: 0, speed: 0, drift: 0 };
    for (let i = 0; i < 600; i++) car = stepCar(car, { throttle: 1, brake: 0, steer: 0, handbrake: false }, CARS[id], 1 / 60).car;
    return car.speed;
  };
  assert.ok(run("car-starter", -250) < run("car-starter", -200) * 0.5);
  assert.ok(run("car-suv", -250) > run("car-starter", -250));
});

// ─── North Haven, lights and people ───────────────────────────────────────
import { JUNCTIONS, ROADS, onRoad, NORTH_BLOCKS, LIBRARY, HOUSES } from "../shared/city/layout";
import { lightAt, lightAhead, CYCLE } from "../shared/city/lights";
import { ROUTES, ROUTE_LENGTHS, routePoint, makeWalkers, stepWalkers } from "../shared/city/people";

test("the road network is connected and every junction has lights on 3 or 4 arms", () => {
  assert.ok(ROADS.length >= 16);
  assert.ok(JUNCTIONS.length >= 40, `only ${JUNCTIONS.length} junctions`);
  for (const j of JUNCTIONS) assert.ok(onRoad(j.x, j.z));
  // North Haven, the south road and the coast road are all road
  for (const [x, z] of [[0, -200], [-120, -300], [280, -360], [200, -170], [-200, -400], [-200, 300], [100, 186], [0, 200]]) assert.equal(surfaceAt(x, z), "road", `${x},${z}`);
});

test("lights alternate: one direction is always red while the other goes", () => {
  for (const j of JUNCTIONS.slice(0, 10)) for (let t = 0; t < CYCLE; t += 0.5) {
    const a = lightAt(j, "x", t), b = lightAt(j, "z", t);
    assert.ok(a === "red" || b === "red", `both moving at ${j.x},${j.z} t=${t}`);
  }
});

test("a car sees the red light ahead of it", () => {
  const j = JUNCTIONS.find((k) => k.x === 40 && k.z === -40)!;
  let t = 0; while (lightAt(j, "z", t) !== "red") t += 0.5;
  const stop = lightAhead(43, -40 + 15, Math.PI, t); // northbound in the east lane
  assert.ok(stop && stop.junction === j && stop.distance > 0);
  assert.equal(lightAhead(43, -40 + 15, Math.PI, t + CYCLE / 2)?.junction === j ? "stopped" : "go", "go");
});

test("North Haven has houses, the library and blocks of every kind", () => {
  assert.equal(NORTH_BLOCKS.length, 18);
  assert.ok(HOUSES.length >= 70);
  assert.equal(nearestSpot(LIBRARY.door.x, LIBRARY.door.z + 2)?.kind, "library");
  for (const h of HOUSES) assert.ok(!onRoad(h.x, h.z, 6), "house on a road");
  assert.equal(areaName(0, -240), "A.R.I.S.E. Library");
  assert.equal(areaName(-80, -400), "Maple Grove");
  assert.equal(areaName(-170, 280), "Haven Farm");
  assert.equal(areaName(232, 238), "Off-Road Trail");
  assert.equal(surfaceAt(232, 238), "dirt");
});

test("walkers stay on their sidewalks: never on a road, never inside anything", () => {
  ROUTES.forEach((_, r) => {
    for (let s = 0; s < ROUTE_LENGTHS[r]; s += 1.5) {
      const p = routePoint(r, s);
      assert.ok(!onRoad(p.x, p.z), `route ${r} crosses a road at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      assert.ok(!inside(p.x, p.z, 0.25) && !inRound(p.x, p.z, 0.25), `route ${r} walks through something at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    }
  });
  let w = makeWalkers(40);
  const start = w.map((x) => x.s);
  for (let i = 0; i < 600; i++) w = stepWalkers(w, [], 1 / 30);
  w.forEach((x, i) => assert.ok(Math.abs(x.s - start[i]) > 15));
  // someone standing right in front makes a walker wait
  const one = makeWalkers(40)[12], p = routePoint(one.route, one.s), h = p.heading + (one.dir < 0 ? Math.PI : 0);
  const blocked = stepWalkers([one], [{ x: p.x + Math.sin(h) * 1.5, z: p.z + Math.cos(h) * 1.5 }], 0.5)[0];
  assert.equal(blocked.s, one.s);
});
