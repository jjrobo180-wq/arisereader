// Friendly city traffic: computer cars loop around the road grid in their lane
// and wait politely when something is in front of them.

type P = [number, number];
export type TrafficCar = { id: number; loop: number; s: number; speed: number; color: number; x: number; z: number; heading: number };

/** Lane loops. Right-hand traffic: clockwise loops use the inner lane, counter-clockwise the outer one. */
export const LOOPS: P[][] = [
  [[-117, -117], [117, -117], [117, 117], [-117, 117]],
  [[-123, 123], [123, 123], [123, -123], [-123, -123]],
  [[-37, -37], [37, -37], [37, 37], [-37, 37]],
  [[-43, 43], [43, 43], [43, -43], [-43, -43]],
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

export function makeTraffic(perLoop = 3): TrafficCar[] {
  const out: TrafficCar[] = [];
  LOOPS.forEach((_, li) => {
    for (let i = 0; i < perLoop; i++) {
      const s = (LOOP_LENGTHS[li] / perLoop) * i + li * 17;
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
export function stepTraffic(cars: TrafficCar[], obstacles: { x: number; z: number }[], dt: number): TrafficCar[] {
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
    const target = blocked ? 0 : CRUISE;
    const speed = c.speed + (target - c.speed) * Math.min(1, dt * (blocked ? 6 : 1.2));
    const s = c.s + speed * dt;
    return { ...c, s, speed, ...loopPoint(c.loop, s) };
  });
}
