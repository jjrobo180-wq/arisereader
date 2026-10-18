// Farm World — where everything is on the farm, and the rules for walking and riding around it.
// Pure TypeScript (no three.js) so the game and the tests share it.

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number; pad?: number };
export const FIELD = { minX: -45, maxX: 45, minZ: -34, maxZ: 36 };
/** how far people (and ridden animals) may roam: the fields plus the yard behind the barns */
export const ROAM = { minX: -47, maxX: 47, minZ: -40, maxZ: 38 };
export const POND = { x: 33.5, z: 25.5, r: 7.2 };
export const BARN_A: Box = { minX: -33, maxX: -25.6, minZ: -23, maxZ: -16, pad: 1.3 };
export const BARN_B: Box = { minX: -4.6, maxX: 3.6, minZ: -23, maxZ: -15.6, pad: 1.3 };
export const SILO: Box = { minX: 4.6, maxX: 8.4, minZ: -22.4, maxZ: -18.6, pad: 0.8 };
export const STABLE: Box = { minX: 22.6, maxX: 30, minZ: -22, maxZ: -15, pad: 1.3 };
export const COOP: Box = { minX: 27.6, maxX: 33, minZ: 3, maxZ: 8.2, pad: 0.9 };
export const HOUSE: Box = { minX: -20, maxX: -10, minZ: -34.5, maxZ: -25, pad: 0.8 };
export const MILL: Box = { minX: 12.6, maxX: 15.4, minZ: -29.4, maxZ: -26.6, pad: 0.4 };
export const SILO2: Box = { minX: -37, maxX: -34, minZ: -24, maxZ: -21, pad: 0.5 };
export const OBSTACLES: Box[] = [BARN_A, BARN_B, SILO, STABLE, COOP, HOUSE, MILL, SILO2];
export const inBox = (x: number, z: number, b: Box) => { const p = b.pad ?? 0; return x > b.minX - p && x < b.maxX + p && z > b.minZ - p && z < b.maxZ + p; };
export const inPond = (x: number, z: number, pad = 1) => Math.hypot(x - POND.x, z - POND.z) < POND.r + pad;

/** Can a person (or a ridden animal) stand here? Ducks and swimmers are handled by the animals themselves. */
export function walkable(x: number, z: number) {
  if (x < ROAM.minX || x > ROAM.maxX || z < ROAM.minZ || z > ROAM.maxZ) return false;
  if (OBSTACLES.some(o => inBox(x, z, o))) return false;
  return !inPond(x, z, 0.4);
}

const vnoise = (x: number, z: number) => Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.09 + Math.sin(x * 0.05) * 1.6);
/** ground height: flat where the animals live, rolling hills all around */
export function groundY(x: number, z: number) {
  const dx = Math.max(0, Math.abs(x) - 50), dz = Math.max(0, z < 0 ? -z - 40 : z - 42); const d = Math.hypot(dx, dz);
  return d <= 0 ? 0 : Math.min(1, d / 30) ** 1.6 * (9 + vnoise(x, z) * 6) + d * 0.04;
}

export type Place = { id: string; label: string; emoji: string; x: number; z: number };
export const PLACES: Place[] = [
  { id: "gate", label: "Farm gate", emoji: "🏡", x: 0, z: 30 },
  { id: "field", label: "Cow & sheep field", emoji: "🐄", x: -22, z: 14 },
  { id: "horses", label: "Horse paddock", emoji: "🐴", x: 4, z: 12 },
  { id: "pigs", label: "Pig pen", emoji: "🐷", x: 15, z: 20 },
  { id: "pond", label: "Duck pond", emoji: "🦆", x: POND.x - 9, z: POND.z - 2 },
  { id: "coop", label: "Hen house", emoji: "🐔", x: 30, z: 11 },
  { id: "barn", label: "Big red barn", emoji: "🛖", x: -0.5, z: -12 },
  { id: "house", label: "Farmhouse", emoji: "🏠", x: -15, z: -22 },
  { id: "orchard", label: "Apple orchard", emoji: "🍎", x: 17, z: 33 },
];
/** Which part of the farm is this? (for the little area label) */
export function areaName(x: number, z: number) {
  let best = PLACES[0], bd = Infinity;
  for (const p of PLACES) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
  return bd < 14 ? best.label : "Open fields";
}

/** Golden horseshoes hidden around the farm: find them on foot or on horseback. */
export const HORSESHOES: { id: string; x: number; z: number; hint: string }[] = [
  { id: "hs-gate", x: 6, z: 34, hint: "by the farm gate" },
  { id: "hs-pumpkins", x: -36, z: 27, hint: "in the pumpkin patch" },
  { id: "hs-field", x: -30, z: 6, hint: "in the cow field" },
  { id: "hs-paddock", x: 10, z: 4, hint: "in the horse paddock" },
  { id: "hs-mud", x: 18, z: 26, hint: "next to the mud puddle" },
  { id: "hs-pond", x: 24, z: 30, hint: "on the pond's bank" },
  { id: "hs-coop", x: 35, z: 1, hint: "behind the hen house" },
  { id: "hs-stable", x: 33, z: -16, hint: "beside the stable" },
  { id: "hs-barn", x: -6, z: -13, hint: "at the big barn door" },
  { id: "hs-mill", x: 17, z: -30, hint: "under the windmill" },
  { id: "hs-house", x: -23, z: -30, hint: "behind the farmhouse" },
  { id: "hs-corn", x: -42, z: -34, hint: "in the corn rows" },
];
export const PICKUP_RADIUS = 1.6;
/** Ids of horseshoes close enough to pick up that aren't found yet. */
export function horseshoesInReach(x: number, z: number, found: readonly string[], r = PICKUP_RADIUS) {
  return HORSESHOES.filter(h => !found.includes(h.id) && Math.hypot(h.x - x, h.z - z) <= r).map(h => h.id);
}

// ── moving around ──
export type Mover = { x: number; z: number; facing: number; speed: number };
export type MoveInput = { forward: number; turn: number; run: boolean; target: { x: number; z: number } | null };
export type MoveParams = { walk: number; run: number; turnRate: number; accel: number };
export const ON_FOOT: MoveParams = { walk: 4, run: 7.5, turnRate: 2.6, accel: 10 };
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
/**
 * One movement step. Steering comes from the keys/buttons (forward + turn) or, when there is a target,
 * by turning toward it and walking until close. Blocked steps slide along walls instead of stopping dead.
 * Returns the new state and whether a target was reached this step.
 */
export function stepMover(m: Mover, inp: MoveInput, p: MoveParams, dt: number, ok: (x: number, z: number) => boolean = walkable) {
  let { x, z, facing, speed } = m; let forward = inp.forward, turn = inp.turn, arrived = false;
  if (inp.target) {
    const dx = inp.target.x - x, dz = inp.target.z - z, d = Math.hypot(dx, dz);
    if (d < 0.6) { arrived = true; forward = 0; }
    else { const want = Math.atan2(dx, dz), diff = wrap(want - facing); turn = Math.max(-1, Math.min(1, diff * 2.5)); forward = Math.abs(diff) > 1.4 ? 0.15 : Math.min(1, d / 2 + 0.3); }
  }
  facing = wrap(facing + turn * p.turnRate * dt);
  const top = (inp.run ? p.run : p.walk) * Math.max(-0.5, Math.min(1, forward));
  speed += (top - speed) * Math.min(1, p.accel * dt);
  if (Math.abs(speed) < 0.01 && forward === 0) speed = 0;
  const sx = Math.sin(facing) * speed * dt, sz = Math.cos(facing) * speed * dt;
  if (ok(x + sx, z + sz)) { x += sx; z += sz; }
  else if (ok(x + sx, z)) { x += sx; speed *= 0.7; }
  else if (ok(x, z + sz)) { z += sz; speed *= 0.7; }
  else speed = 0;
  return { m: { x, z, facing, speed }, arrived };
}
