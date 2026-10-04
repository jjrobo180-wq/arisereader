// Traffic lights. Every junction runs the same 20-second cycle off the wall
// clock, so every reader sees the same colours. Neighbouring junctions are
// offset a little so a car cruising down an avenue meets a gentle green wave.
import { JUNCTIONS, ROAD_HALF, type Junction } from "./layout";

export type Light = "green" | "yellow" | "red";
export type Axis = "x" | "z"; // the direction traffic is moving: along x (east–west) or along z (north–south)
export const CYCLE = 20;
const GREEN = 8, YELLOW = 2; // per axis: 8 s green, 2 s yellow, then 10 s red

export const junctionOffset = (j: Junction) => (((j.x + j.z) / 80) % 4 + 4) % 4 * 2.5;

/** The light shown to traffic moving along `axis` at junction j, `t` seconds on the wall clock. */
export function lightAt(j: Junction, axis: Axis, t: number): Light {
  const c = (((t + junctionOffset(j)) % CYCLE) + CYCLE) % CYCLE;
  const local = axis === "z" ? c : (c + CYCLE / 2) % CYCLE; // east–west runs half a cycle after north–south
  return local < GREEN ? "green" : local < GREEN + YELLOW ? "yellow" : "red";
}

/** Distance from a junction's centre to its stop lines. */
export const STOP_LINE = ROAD_HALF + 2.5;

/**
 * The red or yellow light a car at (x, z) heading `heading` must stop for, and
 * how far it is from the stop line; null when the way ahead is clear.
 */
export function lightAhead(x: number, z: number, heading: number, t: number, lookAhead = 14): { junction: Junction; light: Light; distance: number } | null {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const axis: Axis = Math.abs(fx) > 0.7 ? "x" : "z";
  if (Math.abs(fx) < 0.7 && Math.abs(fz) < 0.7) return null; // mid-turn
  let best: { junction: Junction; light: Light; distance: number } | null = null;
  for (const j of JUNCTIONS) {
    const dx = j.x - x, dz = j.z - z;
    const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (side > ROAD_HALF + 1) continue;
    const distance = ahead - STOP_LINE;
    if (distance < -0.5 || distance > lookAhead) continue;
    const light = lightAt(j, axis, t);
    if (light === "green") continue;
    if (!best || distance < best.distance) best = { junction: j, light, distance };
  }
  return best;
}
