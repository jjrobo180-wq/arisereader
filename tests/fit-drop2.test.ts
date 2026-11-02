// Arise Fit outdoors (shared/fitRun.ts) and AI form check (shared/fitForm.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { cleanFit } from "../shared/fit";
import { MILE, acceptFix, cleanRuns, haversine, pace, parseGeometry, parseTrails, shrinkPath, splits, trailsQuery, type LatLng } from "../shared/fitRun";
import { LIFTS, RepCounter, angle, anglesOf, lean, plankOk, type Angles, type Pt } from "../shared/fitForm";

test("GPS math: distance, jitter and jumps, pace and splits", () => {
  const a: LatLng = [39.7392, -104.9903];
  const b: LatLng = [39.7392 + 1 / 69.05, -104.9903]; // about a mile north
  assert.ok(Math.abs(haversine(a, b) - MILE) < 20, String(haversine(a, b)));
  assert.equal(acceptFix(a, [a[0] + 0.00001, a[1]], 5, 1), false, "1 m of standing jitter is ignored");
  assert.equal(acceptFix(a, [a[0] + 0.0001, a[1]], 5, 3), true, "11 m in 3 s is a real step");
  assert.equal(acceptFix(a, [a[0] + 0.01, a[1]], 5, 1), false, "a 1 km jump in a second is GPS noise");
  assert.equal(acceptFix(undefined, a, 60, 0), false, "too inaccurate");
  assert.equal(pace(480, MILE, "mi"), "8:00");
  assert.equal(pace(5, 2, "mi"), "--:--");
  const pts = Array.from({ length: 201 }, (_, i) => ({ at: i * 3000, ll: [a[0] + (i * (2 / 69.05)) / 200, a[1]] as LatLng }));
  const sp = splits(pts, "mi");
  assert.equal(sp.length, 2); assert.ok(Math.abs(sp[0] - 300) < 5 && Math.abs(sp[1] - 300) < 5, sp.join(","));
});

test("routes are kept small, and saved runs are cleaned", () => {
  const long: LatLng[] = Array.from({ length: 5000 }, (_, i) => [39.7 + i * 0.0002, -104.9]);
  const small = shrinkPath(long, 600);
  assert.ok(small.length <= 601, String(small.length));
  assert.deepEqual(small[0], [39.7, -104.9]);
  const runs = cleanRuns([{ id: "a", date: "2026-10-31T10:00:00Z", kind: "jog", secs: 1800, meters: 5000, path: [[39, -104], [999, 0], "x"], trail: "Mesa Trail" }, { id: 5 }, { id: "b", date: "nope" }]);
  assert.equal(runs.length, 1); assert.equal(runs[0].kind, "run"); assert.deepEqual(runs[0].path, [[39, -104]]); assert.equal(runs[0].trail, "Mesa Trail");
  const d = cleanFit({ runs: [{ id: "a", date: "2026-10-31T10:00:00Z", kind: "hike", secs: 100, meters: 300, path: [] }] });
  assert.equal(d.runs?.[0].kind, "hike");
  assert.equal(cleanFit({}).runs, undefined);
});

test("trails: the query, results nearest first without duplicates, and geometry", () => {
  const q = trailsQuery(39.74, -104.99, 25);
  assert.match(q, /\[out:json\]/); assert.match(q, /\[bbox:39\.5148,-105\.2829,39\.9652,-104\.6971\]/); assert.match(q, /route"~"\^\(hiking\|foot\|running\|mtb\)\$"/); assert.match(q, /out tags center/); // a box around the point: faster than "around"
  const json = { elements: [
    { type: "relation", id: 1, center: { lat: 39.9, lon: -105.3 }, tags: { name: "Far Trail", route: "hiking", distance: "12.5" } },
    { type: "way", id: 2, center: { lat: 39.75, lon: -105.0 }, tags: { name: "Near Path", highway: "path", sac_scale: "mountain_hiking", surface: "dirt" } },
    { type: "way", id: 3, center: { lat: 39.76, lon: -105.0 }, tags: { name: "near path", highway: "path" } },
    { type: "node", id: 4, lat: 1, lon: 1, tags: { name: "Not a trail" } },
    { type: "way", id: 5, center: { lat: 39.7, lon: -105 }, tags: {} },
  ] };
  const t = parseTrails(json, [39.74, -104.99]);
  assert.deepEqual(t.map((x) => x.name), ["Near Path", "Far Trail"]);
  assert.equal(t[0].difficulty, "Moderate"); assert.equal(t[1].km, 12.5);
  const g = parseGeometry({ elements: [{ type: "relation", members: [{ geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }] }, { geometry: [{ lat: 5, lon: 5 }] }] }, { type: "way", geometry: [{ lat: 3, lon: 4 }, { lat: 3.1, lon: 4.1 }] }] });
  assert.equal(g.length, 2, "one-point pieces are dropped");
});

const P = (x: number, y: number): Pt => ({ x, y, visibility: 1 });
test("form check: angles from body points", () => {
  assert.equal(Math.round(angle(P(0, 0), P(0, 1), P(1, 1))), 90);
  assert.equal(Math.round(angle(P(0, 0), P(0, 1), P(0, 2))), 180);
  assert.equal(Math.round(lean(P(0.5, 0), P(0.5, 1))), 0);
  assert.equal(Math.round(lean(P(1, 1), P(0, 1))), 90);
  // Standing sideways: shoulder over hip over knee over ankle → straight knee and hip, upright.
  const lm: Pt[] = Array.from({ length: 33 }, () => P(0.5, 0.5));
  lm[11] = P(0.5, 0.2); lm[23] = P(0.5, 0.5); lm[25] = P(0.5, 0.7); lm[27] = P(0.5, 0.9); lm[13] = P(0.5, 0.35); lm[15] = P(0.5, 0.5);
  for (const i of [12, 24, 26, 28, 14, 16]) lm[i] = { ...lm[i], visibility: 0.1 };
  const a = anglesOf(lm);
  assert.ok(a.knee > 175 && a.hip > 175 && a.torsoLean < 1, JSON.stringify(a));
  assert.equal(plankOk({ ...a, body: 175 }), true); assert.equal(plankOk({ ...a, body: 140 }), false);
});

const frame = (o: Partial<Angles>): Angles => ({ knee: 175, hip: 175, elbow: 170, body: 178, torsoLean: 10, shinLean: 10, seen: 1, ...o });
test("form check: squats are counted and graded", () => {
  const c = new RepCounter("squat");
  const rep = (bottomKnee: number, lean = 20) => { const out = []; for (const k of [170, 140, 110, bottomKnee, 110, 140, 170]) out.push(c.push(frame({ knee: k, torsoLean: k === bottomKnee ? lean : 15 }))); return out.filter(Boolean); };
  assert.equal(rep(80).length, 1, "a deep rep counts once");
  assert.equal(c.reps[0].good, true);
  rep(98); assert.match(c.reps[1].faults[0], /deeper/);
  rep(80, 60); assert.ok(c.reps[2].faults.some((f) => /Chest up/.test(f)));
  rep(80); assert.equal(c.reps.length, 4); assert.equal(c.score, 50);
  assert.equal(c.push(frame({ knee: 80, seen: 0.2 })), null, "ignored when the body isn't in frame");
  // A half-rep that never reaches the bottom isn't counted.
  for (const k of [170, 130, 120, 130, 170]) c.push(frame({ knee: k }));
  assert.equal(c.reps.length, 4);
});

test("form check: push-ups catch sagging hips; every lift has setup and faults", () => {
  const c = new RepCounter("pushup");
  for (const e of [165, 120, 85, 120, 165]) c.push(frame({ elbow: e, body: e === 85 ? 145 : 175 }));
  assert.equal(c.reps.length, 1); assert.match(c.reps[0].faults.join(" "), /Hips/);
  for (const k of Object.keys(LIFTS)) { const l = (LIFTS as any)[k]; assert.ok(l.setup.length > 10 && typeof l.faults === "function", k); }
});
