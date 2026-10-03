// Haven Speedway: the oval's centre line, lap counting and computer drivers.
// The race runs clockwise on the minimap: east along the top straight first.
import { TRACK } from "./layout";

const { cx, cz, half, radius } = TRACK;
export const LAP_LENGTH = 4 * half + 2 * Math.PI * radius;
/** The start/finish line crosses the top straight at x = 0. */
export const START_S = half;

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * A point on the oval `s` units along the centre line, `offset` units to the
 * right of the direction of travel, plus the heading there.
 */
export function trackPoint(s: number, offset = 0): { x: number; z: number; heading: number } {
  s = mod(s, LAP_LENGTH);
  let x: number, z: number, heading: number;
  const arc = Math.PI * radius;
  if (s < 2 * half) { x = cx - half + s; z = cz - radius; heading = Math.PI / 2; }
  else if (s < 2 * half + arc) {
    const a = -Math.PI / 2 + (s - 2 * half) / radius;
    x = cx + half + Math.cos(a) * radius; z = cz + Math.sin(a) * radius; heading = Math.PI / 2 - (a + Math.PI / 2);
  } else if (s < 4 * half + arc) { x = cx + half - (s - 2 * half - arc); z = cz + radius; heading = -Math.PI / 2; }
  else {
    const a = Math.PI / 2 + (s - 4 * half - arc) / radius;
    x = cx - half + Math.cos(a) * radius; z = cz + Math.sin(a) * radius; heading = Math.PI / 2 - (a + Math.PI / 2);
  }
  // right of travel = (-cos h, sin h)
  return { x: x - Math.cos(heading) * offset, z: z + Math.sin(heading) * offset, heading };
}

/** How far along the centre line the nearest point to (x, z) is. */
export function trackProgress(x: number, z: number): number {
  const dx = x - cx, dz = z - cz, arc = Math.PI * radius;
  if (dx > half) { const a = Math.atan2(dz, dx - half); return 2 * half + radius * (a + Math.PI / 2); }
  if (dx < -half) { let a = Math.atan2(dz, dx + half); if (a < 0) a += Math.PI * 2; return 4 * half + arc + radius * (a - Math.PI / 2); }
  return dz < 0 ? dx + half : 2 * half + arc + (half - dx);
}

export type LapTracker = { lastS: number; distance: number };

export function startTracker(x: number, z: number): LapTracker {
  const s = trackProgress(x, z);
  let d = s - START_S;
  if (d > LAP_LENGTH / 2) d -= LAP_LENGTH;
  return { lastS: s, distance: d };
}

/**
 * Adds the distance driven since the last update. Big jumps (cutting across the
 * infield) don't count, so shortcuts never help.
 */
export function updateTracker(t: LapTracker, x: number, z: number): LapTracker {
  const s = trackProgress(x, z);
  let delta = s - t.lastS;
  if (delta > LAP_LENGTH / 2) delta -= LAP_LENGTH;
  if (delta < -LAP_LENGTH / 2) delta += LAP_LENGTH;
  if (Math.abs(delta) > 12) delta = 0;
  return { lastS: s, distance: t.distance + delta };
}

export const lapsDone = (t: LapTracker) => Math.max(0, Math.floor(t.distance / LAP_LENGTH));

// ─── Computer drivers ───────────────────────────────────────────────────────
export type Rival = { name: string; color: number; base: number; offset: number; s: number; distance: number; finishedAt: number | null };

export const RIVAL_NAMES = ["Comet", "Blaze", "Nimbus"];

/** Three friendly rivals: one the free car can beat, one about even, one that needs a shop car. */
export function makeRivals(): Rival[] {
  const grid = [{ base: 22, offset: 3.5, back: 8 }, { base: 24, offset: -3.5, back: 16 }, { base: 26.5, offset: 3.5, back: 24 }];
  return grid.map((g, i) => ({ name: RIVAL_NAMES[i], color: [0x60a5fa, 0xf472b6, 0xfbbf24][i], base: g.base, offset: g.offset, s: START_S - g.back, distance: -g.back, finishedAt: null }));
}

/** Rivals ease off a little in the bends and wobble their speed so races feel alive. */
export function stepRival(r: Rival, dt: number, t: number): Rival {
  const s = mod(r.s, LAP_LENGTH);
  const inBend = s >= 2 * half && s < 2 * half + Math.PI * radius || s >= 4 * half + Math.PI * radius;
  const v = r.base * (inBend ? 0.9 : 1) * (1 + Math.sin(t * 0.7 + r.base) * 0.03);
  return { ...r, s: r.s + v * dt, distance: r.distance + v * dt };
}

export const GRID_PLAYER = (() => { const p = trackPoint(START_S - 4, 0); return { x: p.x, z: p.z, heading: p.heading }; })();

export function formatTime(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
}
