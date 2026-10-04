// Friendly city traffic: computer cars loop around the road grid in their lane
// and wait politely when something is in front of them.
import { NORTH, PARK, SEASIDE, SOUTH_ROAD } from "./layout";
import { lightAhead } from "./lights";

type P = [number, number];
export type TrafficCar = { id: number; loop: number; s: number; speed: number; color: number; x: number; z: number; heading: number };

/** Lane loops. Right-hand traffic: clockwise loops use the inner lane, counter-clockwise the outer one. */
export const LOOPS: P[][] = [
  [[-117, -117], [117, -117], [117, 117], [-117, 117]],
  [[-123, 123], [123, 123], [123, -123], [-123, -123]],
  [[-37, -37], [37, -37], [37, 37], [-37, 37]],
  [[-43, 43], [43, 43], [43, -43], [-43, -43]],
  // the coast road: south in the west lane, a U-turn at each end, north in the east lane
  [[SEASIDE.road - 3, NORTH.roadsZ[3] + 10], [SEASIDE.road - 3, 320], [SEASIDE.road + 3, 320], [SEASIDE.road + 3, NORTH.roadsZ[3] + 10]],
  // round the lake (angle increasing, so the inner lane is on the right)
  Array.from({ length: 28 }, (_, i): P => {
    const a = (i / 28) * Math.PI * 2, r = PARK.loop.r - 3;
    return [PARK.loop.x + Math.cos(a) * r, PARK.loop.z + Math.sin(a) * r];
  }),
  // North Haven blocks (clockwise, inner lanes)
  [[-117, -437], [117, -437], [117, -203], [-117, -203]],
  [[-37, -357], [37, -357], [37, -283], [-37, -283]],
  [[123, -437], [277, -437], [277, -203], [123, -203]],
  [[-197, -437], [-123, -437], [-123, -203], [-197, -203]],
  // the south road, out and back
  [[-190, SOUTH_ROAD + 3], [190, SOUTH_ROAD + 3], [190, SOUTH_ROAD - 3], [-190, SOUTH_ROAD - 3]],
];

const loopLength = (loop: P[]) => loop.reduce((n, p, i) => { const q = loop[(i + 1) % loop.length]; return n + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
export const LOOP_LENGTHS = LOOPS.map(loopLength);

export function loopPoint(loopIndex: number, s: number): { x: number; z: number; heading: number } {
  const loop = LOOPS[loopIndex];
  let d = ((s % LOOP_LENGTHS[loopIndex]) + LOOP_LENGTHS[loopIndex]) % LOOP_LENGTHS[loopIndex];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= len) {
      const t = d / len;
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    d -= len;
  }
  return { x: loop[0][0], z: loop[0][1], heading: 0 };
}

const COLORS = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xf97316, 0xa855f7, 0xe5e7eb, 0x14b8a6];

/** perLoop cars on each loop; the four downtown loops get `downtown` cars for a busier rush hour. */
export function makeTraffic(perLoop = 3, downtown = perLoop): TrafficCar[] {
  const out: TrafficCar[] = [];
  LOOPS.forEach((_, li) => {
    const n = li < 4 ? downtown : perLoop;
    for (let i = 0; i < n; i++) {
      const s = (LOOP_LENGTHS[li] / n) * i + li * 17;
      const p = loopPoint(li, s);
      out.push({ id: out.length, loop: li, s, speed: 9, color: COLORS[out.length % COLORS.length], ...p });
    }
  });
  return out;
}

const CRUISE = 10;

/**
 * Moves every car along its loop. A car brakes for anything in a narrow cone
 * ahead of it (other traffic or a reader); at very close range the lower id
 * goes first so two cars meeting at a crossing never both wait forever.
 */
export function stepTraffic(cars: TrafficCar[], obstacles: { x: number; z: number }[], dt: number, clock?: number): TrafficCar[] {
  return cars.map((c) => {
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    let blocked = false;
    const check = (ox: number, oz: number, otherId?: number) => {
      const dx = ox - c.x, dz = oz - c.z;
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0.5 || ahead > 9) return;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 2.6) {
        if (otherId === undefined || ahead > 3.5 || otherId < c.id) blocked = true;
      }
    };
    for (const o of cars) if (o.id !== c.id) check(o.x, o.z, o.id);
    for (const o of obstacles) check(o.x, o.z);
    // red and yellow lights: ease to a stop at the line (a car already at the line on yellow keeps going)
    let limit = CRUISE;
    if (clock !== undefined) {
      const stop = lightAhead(c.x, c.z, c.heading, clock);
      if (stop && !(stop.light === "yellow" && stop.distance < 3)) limit = Math.max(0, Math.min(CRUISE, stop.distance * 1.1));
    }
    const target = blocked ? 0 : limit;
    const speed = c.speed + (target - c.speed) * Math.min(1, dt * (blocked || target < c.speed ? 6 : 1.2));
    const s = c.s + speed * dt;
    return { ...c, s, speed, ...loopPoint(c.loop, s) };
  });
}
