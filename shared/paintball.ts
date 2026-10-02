// Prism Paintball — shared rules, map, physics and network protocol.
// Used by the authoritative server (bots, validation) and the browser client
// (prediction, projectiles, rendering) so both always agree on the world.

export type Team = 0 | 1;
export const TEAM_NAMES = ["Cyan", "Magenta"] as const;
export const TEAM_HEX = [0x22d3ee, 0xf0479a] as const;
export const TEAM_CSS = ["#22d3ee", "#f0479a"] as const;

export const PB = {
  TICK_HZ: 20,
  MAX_PLAYERS: 10,
  MATCH_MS: 5 * 60 * 1000,
  COUNTDOWN_MS: 4000,
  RESULTS_MS: 25000,
  SCORE_TO_WIN: 50,
  RESPAWN_MS: 3200,
  SPAWN_PROTECT_MS: 1800,
  MAX_HP: 100,
  REGEN_DELAY_MS: 4500,
  REGEN_PER_S: 30,
  GRAVITY: 24,
  JUMP_V: 8.4,
  WALK_SPEED: 5.4,
  SPRINT_SPEED: 7.9,
  CROUCH_SPEED: 2.9,
  ADS_SPEED: 3.6,
  GROUND_ACCEL: 62,
  AIR_ACCEL: 16,
  RADIUS: 0.42,
  HEIGHT: 1.8,
  CROUCH_HEIGHT: 1.25,
  STEP: 0.45,
  ARENA_X: 42,
  ARENA_Z: 30,
  NET_HEIGHT: 7,
} as const;

// Player state flags (bit field in snapshots).
export const F = {
  ALIVE: 1,
  GROUNDED: 2,
  SPRINT: 4,
  ADS: 8,
  CROUCH: 16,
  RELOAD: 32,
  PROTECTED: 64,
  FIRING: 128,
} as const;

export interface WeaponDef {
  id: string;
  name: string;
  short: string;
  dmg: number;
  head: number;
  interval: number; // ms between shots
  speed: number; // m/s
  grav: number; // m/s^2
  spread: number; // hip spread radius (radians)
  adsSpread: number;
  moveSpread: number; // added while moving fast
  pellets: number;
  mag: number;
  reload: number; // ms
  life: number; // projectile lifetime (s)
  zoom: number; // ADS fov divisor
  auto: boolean;
  recoil: number; // camera kick (radians)
  ballSize: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: "rifle", name: "Prism Rifle", short: "RIFLE", dmg: 20, head: 34, interval: 128, speed: 78, grav: 7, spread: 0.02, adsSpread: 0.005, moveSpread: 0.022, pellets: 1, mag: 30, reload: 1650, life: 1.6, zoom: 1.45, auto: true, recoil: 0.011, ballSize: 1 },
  { id: "splatter", name: "Splatter", short: "SPLATTER", dmg: 12, head: 18, interval: 760, speed: 60, grav: 10, spread: 0.085, adsSpread: 0.062, moveSpread: 0.01, pellets: 8, mag: 6, reload: 2000, life: 0.5, zoom: 1.18, auto: false, recoil: 0.05, ballSize: 0.85 },
  { id: "longshot", name: "Longshot", short: "LONGSHOT", dmg: 70, head: 120, interval: 1100, speed: 165, grav: 3, spread: 0.045, adsSpread: 0, moveSpread: 0.03, pellets: 1, mag: 5, reload: 2350, life: 2.2, zoom: 3.4, auto: false, recoil: 0.06, ballSize: 1.25 },
];

export type BotLevel = "easy" | "normal" | "hard";

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

export type Vis =
  | "inflBrick" | "inflCan" | "inflSnake" | "inflTemple"
  | "crate" | "deck" | "rail" | "ramp" | "post" | "roof"
  | "plinth" | "prism" | "tires" | "hay" | "barrel" | "net";

export interface BoxC { kind: "box"; x: number; z: number; y: number; w: number; d: number; h: number; rot: number; vis: Vis; team: 0 | 1 | 2 }
export interface CylC { kind: "cyl"; x: number; z: number; y: number; r: number; h: number; vis: Vis; team: 0 | 1 | 2 }
/** Ramp: rectangular footprint, surface rises from y (local -z edge) to y+h (local +z edge). */
export interface RampC { kind: "ramp"; x: number; z: number; y: number; w: number; d: number; h: number; rot: number; vis: Vis; team: 0 | 1 | 2 }
export type Collider = BoxC | CylC | RampC;

export interface SpawnPoint { x: number; z: number; yaw: number }

export interface ArenaMap {
  colliders: Collider[];
  spawns: [SpawnPoint[], SpawnPoint[]];
  /** Bot tactical points (cover spots) per side, in world space. */
  cover: { x: number; z: number }[];
}

function buildMap(): ArenaMap {
  const half: Collider[] = [];
  const box = (x: number, z: number, y: number, w: number, d: number, h: number, rot: number, vis: Vis, team: 0 | 1 | 2 = 2) =>
    half.push({ kind: "box", x, z, y, w, d, h, rot, vis, team });
  const cyl = (x: number, z: number, y: number, r: number, h: number, vis: Vis, team: 0 | 1 | 2 = 2) =>
    half.push({ kind: "cyl", x, z, y, r, h, vis, team });
  const ramp = (x: number, z: number, y: number, w: number, d: number, h: number, rot: number, vis: Vis = "ramp", team: 0 | 1 | 2 = 0) =>
    half.push({ kind: "ramp", x, z, y, w, d, h, rot, vis, team });

  // --- Cyan base fort (mirrored for magenta) -------------------------------
  const fx = -34;
  box(fx, 0, 2.2, 6, 12, 0.3, 0, "deck", 0);
  for (const px of [fx - 2.8, fx + 2.8]) for (const pz of [-5.8, 0, 5.8]) cyl(px, pz, 0, 0.17, 2.2, "post", 0);
  // ramps up to the deck at both ends
  ramp(fx, 9.1, 0, 3, 6.2, 2.5, Math.PI, "ramp", 0);
  ramp(fx, -9.1, 0, 3, 6.2, 2.5, 0, "ramp", 0);
  // railings (front facing the field is the main cover)
  box(fx + 2.85, -3.4, 2.5, 0.3, 5.2, 1.05, 0, "rail", 0);
  box(fx + 2.85, 3.4, 2.5, 0.3, 5.2, 1.05, 0, "rail", 0);
  box(fx - 2.85, 0, 2.5, 0.3, 12, 1.05, 0, "rail", 0);
  for (const sz of [-5.85, 5.85]) {
    box(fx - 2.25, sz, 2.5, 1.5, 0.3, 1.05, 0, "rail", 0);
    box(fx + 2.25, sz, 2.5, 1.5, 0.3, 1.05, 0, "rail", 0);
  }
  // canopy roof and its posts
  for (const px of [fx - 2.8, fx + 2.8]) for (const pz of [-5.8, 5.8]) cyl(px, pz, 2.5, 0.14, 2.7, "post", 0);
  box(fx, 0, 5.2, 7, 13, 0.18, 0, "roof", 0);

  // --- Cyan-side field cover ----------------------------------------------
  cyl(-26, -10.5, 0, 1.05, 2.5, "inflCan", 0);
  cyl(-26, 10.5, 0, 1.05, 2.5, "inflCan", 0);
  box(-23, 0, 0, 1.5, 4.6, 1.75, 0, "inflBrick", 0);
  box(-17, -17.5, 0, 8, 1.35, 1.05, 0, "inflSnake", 2);
  // crate stack (climbable)
  box(-18.5, 7.5, 0, 2.2, 2.2, 1.2, 0.12, "crate", 2);
  box(-18.9, 7.2, 1.2, 1.3, 1.3, 1.2, 0.4, "crate", 2);
  box(-17.2, 9.1, 0, 1.3, 1.3, 1.2, -0.3, "crate", 2);
  cyl(-12.5, -10.5, 0, 0.68, 1.35, "tires", 2);
  cyl(-11.6, -11.6, 0, 0.68, 0.9, "tires", 2);
  box(-11, 3.8, 0, 1.4, 4.2, 1.8, 0.45, "inflBrick", 0);
  box(-6.5, 9, 0, 3.2, 1.5, 2.1, 0.35, "inflTemple", 2);
  cyl(-5.5, -8.5, 0, 0.9, 2.3, "inflCan", 2);
  // hay bales along the side lines
  box(-24, -26.2, 0, 3.2, 1.3, 1.15, 0, "hay", 2);
  box(-9, 25.8, 0, 3.2, 1.3, 1.15, 0.08, "hay", 2);
  box(-30, 23.5, 0, 1.4, 1.4, 1.2, 0.2, "crate", 2);
  cyl(-29.4, -22.5, 0, 0.45, 1.15, "barrel", 2);
  cyl(-28.6, -23.4, 0, 0.45, 1.15, "barrel", 2);

  // --- Mid tower (one per side, point-symmetric) --------------------------
  box(-1, 21, 2.0, 5, 4, 0.3, 0, "deck", 2);
  for (const px of [-3.3, 1.3]) for (const pz of [19.2, 22.8]) cyl(px, pz, 0, 0.17, 2.0, "post", 2);
  ramp(4.8, 21, 0, 2.6, 6.6, 2.3, -Math.PI / 2, "ramp", 2);
  box(-3.35, 21, 2.3, 0.3, 4, 1.0, 0, "rail", 2);
  box(-1, 19.15, 2.3, 4.4, 0.3, 1.0, 0, "rail", 2);
  box(-1.6, 22.85, 2.3, 3.2, 0.3, 1.0, 0, "rail", 2);

  // Mirror half → full map (point symmetry through the origin).
  const colliders: Collider[] = [];
  for (const c of half) {
    colliders.push(c);
    const mirrorTeam = (c.team === 0 ? 1 : c.team === 1 ? 0 : 2) as 0 | 1 | 2;
    if (c.kind === "cyl") colliders.push({ ...c, x: -c.x, z: -c.z, team: mirrorTeam });
    else colliders.push({ ...c, x: -c.x, z: -c.z, rot: c.rot + Math.PI, team: mirrorTeam });
  }

  // --- Centrepiece: the Prism -----------------------------------------------
  colliders.push({ kind: "cyl", x: 0, z: 0, y: 0, r: 3.3, h: 0.38, vis: "plinth", team: 2 });
  colliders.push({ kind: "cyl", x: 0, z: 0, y: 0.38, r: 1.25, h: 4.6, vis: "prism", team: 2 });

  // --- Perimeter netting ------------------------------------------------------
  const { ARENA_X: AX, ARENA_Z: AZ, NET_HEIGHT: NH } = PB;
  colliders.push({ kind: "box", x: -AX - 0.25, z: 0, y: 0, w: 0.5, d: AZ * 2 + 1, h: NH, rot: 0, vis: "net", team: 2 });
  colliders.push({ kind: "box", x: AX + 0.25, z: 0, y: 0, w: 0.5, d: AZ * 2 + 1, h: NH, rot: 0, vis: "net", team: 2 });
  colliders.push({ kind: "box", x: 0, z: -AZ - 0.25, y: 0, w: AX * 2 + 1, d: 0.5, h: NH, rot: 0, vis: "net", team: 2 });
  colliders.push({ kind: "box", x: 0, z: AZ + 0.25, y: 0, w: AX * 2 + 1, d: 0.5, h: NH, rot: 0, vis: "net", team: 2 });

  const cyanSpawns: SpawnPoint[] = [];
  for (const z of [-10, -5, 0, 5, 10]) cyanSpawns.push({ x: -39.6, z, yaw: Math.PI / 2 });
  for (const z of [-15, 15]) cyanSpawns.push({ x: -37.5, z, yaw: Math.PI / 2 });
  cyanSpawns.push({ x: -34, z: -2.8, yaw: Math.PI / 2 }, { x: -34, z: 2.8, yaw: Math.PI / 2 });
  const magentaSpawns = cyanSpawns.map((s) => ({ x: -s.x, z: -s.z, yaw: -Math.PI / 2 }));

  const coverHalf = [
    { x: -27.8, z: -10.5 }, { x: -27.8, z: 10.5 }, { x: -24.6, z: -1.5 }, { x: -24.6, z: 1.5 },
    { x: -17, z: -19 }, { x: -20.3, z: 7.5 }, { x: -14, z: -10.5 }, { x: -12.6, z: 3 },
    { x: -7.6, z: 10.2 }, { x: -7.2, z: -8.6 }, { x: -1, z: 21 }, { x: -24, z: -24.6 }, { x: -9, z: 24.2 },
  ];
  const cover = [...coverHalf, ...coverHalf.map((p) => ({ x: -p.x, z: -p.z }))];
  return { colliders, spawns: [cyanSpawns, magentaSpawns], cover };
}

export const MAP: ArenaMap = buildMap();

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** world → collider-local (x,z) */
function toLocal(c: BoxC | RampC, x: number, z: number): [number, number] {
  const dx = x - c.x, dz = z - c.z, co = Math.cos(c.rot), si = Math.sin(c.rot);
  return [dx * co - dz * si, dx * si + dz * co];
}
/** collider-local direction → world */
function toWorldDir(c: BoxC | RampC, lx: number, lz: number): [number, number] {
  const co = Math.cos(c.rot), si = Math.sin(c.rot);
  return [lx * co + lz * si, -lx * si + lz * co];
}

/** Height of the walkable surface at (x,z) for this collider, or null if the point is outside its footprint. */
export function topAt(c: Collider, x: number, z: number, pad = 0): number | null {
  if (c.kind === "cyl") {
    const dx = x - c.x, dz = z - c.z;
    return dx * dx + dz * dz <= (c.r + pad) * (c.r + pad) ? c.y + c.h : null;
  }
  const [lx, lz] = toLocal(c, x, z);
  if (Math.abs(lx) > c.w / 2 + pad || Math.abs(lz) > c.d / 2 + pad) return null;
  if (c.kind === "box") return c.y + c.h;
  return c.y + c.h * clamp((lz + c.d / 2) / c.d, 0, 1);
}

/** Highest surface the body can stand on at (x,z) given its current feet height. */
export function groundAt(x: number, z: number, feetY: number, pad = PB.RADIUS * 0.55): number {
  let g = 0;
  for (const c of MAP.colliders) {
    if (c.vis === "net") continue;
    const t = topAt(c, x, z, pad);
    if (t !== null && t <= feetY + PB.STEP + 1e-4 && t > g) g = t;
  }
  return g;
}

/** Push a vertical capsule (circle in XZ) out of all colliders that block it. Mutates pos. */
export function resolveHorizontal(pos: { x: number; y: number; z: number }, radius: number, height: number): boolean {
  let hitAny = false;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const c of MAP.colliders) {
      if (c.y >= pos.y + height - 0.02) continue; // entirely above us
      if (c.kind === "cyl") {
        if (c.y + c.h <= pos.y + PB.STEP) continue;
        const dx = pos.x - c.x, dz = pos.z - c.z, rr = c.r + radius, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-4, push = rr - d;
        pos.x += (dx / d) * push; pos.z += (dz / d) * push;
        moved = hitAny = true;
        continue;
      }
      const [lx, lz] = toLocal(c, pos.x, pos.z);
      const hw = c.w / 2, hd = c.d / 2;
      if (Math.abs(lx) > hw + radius || Math.abs(lz) > hd + radius) continue;
      // effective top at the closest point of the footprint
      const cx = clamp(lx, -hw, hw), cz = clamp(lz, -hd, hd);
      const top = c.kind === "box" ? c.y + c.h : c.y + c.h * clamp((cz + hd) / c.d, 0, 1);
      if (top <= pos.y + PB.STEP) continue;
      let nx = lx - cx, nz = lz - cz;
      const d2 = nx * nx + nz * nz;
      let px: number, pz: number;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        if (d >= radius) continue;
        const push = radius - d;
        px = (nx / d) * push; pz = (nz / d) * push;
      } else {
        // centre inside the footprint: push out through the nearest edge
        const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz);
        if (ex < ez) { px = (Math.sign(lx) || 1) * (ex + radius); pz = 0; }
        else { px = 0; pz = (Math.sign(lz) || 1) * (ez + radius); }
      }
      const [wx, wz] = toWorldDir(c, px, pz);
      pos.x += wx; pos.z += wz;
      moved = hitAny = true;
    }
    if (!moved) break;
  }
  const lim = PB.ARENA_X - radius, limZ = PB.ARENA_Z - radius;
  if (pos.x < -lim) { pos.x = -lim; hitAny = true; }
  if (pos.x > lim) { pos.x = lim; hitAny = true; }
  if (pos.z < -limZ) { pos.z = -limZ; hitAny = true; }
  if (pos.z > limZ) { pos.z = limZ; hitAny = true; }
  return hitAny;
}

/** Lowest ceiling (collider bottom) above feetY within the body's column, or Infinity. */
function ceilingAt(x: number, z: number, feetY: number): number {
  let best = Infinity;
  for (const c of MAP.colliders) {
    if (c.vis === "net" || c.y <= feetY + 0.05) continue;
    if (topAt(c, x, z, 0) !== null && c.y < best) best = c.y;
  }
  return best;
}

export interface Body { x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean; crouch: boolean }

export interface MoveInput {
  /** desired horizontal direction in world space (length 0..1) */
  wx: number;
  wz: number;
  speed: number;
  jump: boolean;
}

/** Advance a character body by dt seconds. Shared by client prediction and server bots. */
export function stepBody(b: Body, input: MoveInput, dt: number): { landed: boolean; jumped: boolean } {
  let landed = false, jumped = false;
  const tx = input.wx * input.speed, tz = input.wz * input.speed;
  const accel = b.grounded ? PB.GROUND_ACCEL : PB.AIR_ACCEL;
  const dvx = tx - b.vx, dvz = tz - b.vz, dv = Math.hypot(dvx, dvz), maxDv = accel * dt;
  if (dv <= maxDv) { b.vx = tx; b.vz = tz; } else { b.vx += (dvx / dv) * maxDv; b.vz += (dvz / dv) * maxDv; }
  if (b.grounded && input.jump && !b.crouch) { b.vy = PB.JUMP_V; b.grounded = false; jumped = true; }
  b.vy -= PB.GRAVITY * dt;
  if (b.vy < -40) b.vy = -40;

  const height = b.crouch ? PB.CROUCH_HEIGHT : PB.HEIGHT;
  const pos = { x: b.x + b.vx * dt, y: b.y, z: b.z + b.vz * dt };
  resolveHorizontal(pos, PB.RADIUS, height);
  // kill velocity into walls so we slide along them
  const realVx = (pos.x - b.x) / dt, realVz = (pos.z - b.z) / dt;
  if (Math.abs(realVx) < Math.abs(b.vx)) b.vx = realVx;
  if (Math.abs(realVz) < Math.abs(b.vz)) b.vz = realVz;

  let ny = b.y + b.vy * dt;
  if (b.vy > 0) {
    const ceil = ceilingAt(pos.x, pos.z, b.y);
    if (ny + height > ceil) { ny = ceil - height; b.vy = 0; }
  }
  const ground = groundAt(pos.x, pos.z, Math.max(b.y, ny));
  const wasGrounded = b.grounded;
  if (ny <= ground) {
    if (!wasGrounded && b.vy < -2) landed = true;
    ny = ground; b.vy = 0; b.grounded = true;
  } else if (wasGrounded && b.vy <= 0 && ny - ground <= PB.STEP + 0.05) {
    // stick to slopes / small drops while walking
    ny = ground; b.vy = 0; b.grounded = true;
  } else {
    b.grounded = false;
  }
  b.x = pos.x; b.y = ny; b.z = pos.z;
  return { landed, jumped };
}

// ---------------------------------------------------------------------------
// Ray casting (unnormalised direction; t is in units of the direction vector)
// ---------------------------------------------------------------------------

export interface RayHit { t: number; nx: number; ny: number; nz: number; collider: number }

type Plane = [number, number, number, number]; // inside: n·p <= k

function convexRay(planes: Plane[], ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number) {
  let tEnter = -Infinity, tExit = Infinity, en: Plane | null = null;
  for (const p of planes) {
    const denom = p[0] * dx + p[1] * dy + p[2] * dz;
    const num = p[3] - (p[0] * ox + p[1] * oy + p[2] * oz);
    if (Math.abs(denom) < 1e-12) { if (num < 0) return null; continue; }
    const t = num / denom;
    if (denom < 0) { if (t > tEnter) { tEnter = t; en = p; } }
    else if (t < tExit) tExit = t;
    if (tEnter > tExit) return null;
  }
  if (tEnter > maxT || tExit < 0 || !en) return null;
  if (tEnter < 0) return { t: 0, n: en };
  return { t: tEnter, n: en };
}

const planeCache = new Map<Collider, Plane[]>();
function localPlanes(c: BoxC | RampC): Plane[] {
  let p = planeCache.get(c);
  if (p) return p;
  const hw = c.w / 2, hd = c.d / 2;
  p = [
    [1, 0, 0, hw], [-1, 0, 0, hw],
    [0, 0, 1, hd], [0, 0, -1, hd],
    [0, 1, 0, c.y + c.h], [0, -1, 0, -c.y],
  ];
  if (c.kind === "ramp") {
    // surface: y = c.y + h*(lz+hd)/d  → (y - c.y)*d - h*lz - h*hd <= 0
    const len = Math.hypot(c.d, c.h);
    const nY = c.d / len, nZ = -c.h / len;
    p.push([0, nY, nZ, (c.y * c.d + c.h * hd) / len]);
  }
  planeCache.set(c, p);
  return p;
}

export function rayCollider(c: Collider, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): { t: number; nx: number; ny: number; nz: number } | null {
  if (c.kind === "cyl") {
    let best: { t: number; nx: number; ny: number; nz: number } | null = null;
    const fx = ox - c.x, fz = oz - c.z;
    const a = dx * dx + dz * dz;
    if (a > 1e-12) {
      const b = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - c.r * c.r;
      const disc = b * b - 4 * a * cc;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        const t = (-b - s) / (2 * a);
        if (t >= 0 && t <= maxT) {
          const y = oy + dy * t;
          if (y >= c.y && y <= c.y + c.h) best = { t, nx: (fx + dx * t) / c.r, ny: 0, nz: (fz + dz * t) / c.r };
        }
        if (cc < 0) { // origin inside the infinite cylinder
          const y = oy;
          if (y >= c.y && y <= c.y + c.h) return { t: 0, nx: 0, ny: 1, nz: 0 };
        }
      }
    }
    if (Math.abs(dy) > 1e-12) {
      for (const [py, ny] of [[c.y + c.h, 1], [c.y, -1]] as [number, number][]) {
        const t = (py - oy) / dy;
        if (t < 0 || t > maxT || (best && t >= best.t)) continue;
        if ((ny > 0 && dy > 0) || (ny < 0 && dy < 0)) continue;
        const x = fx + dx * t, z = fz + dz * t;
        if (x * x + z * z <= c.r * c.r) best = { t, nx: 0, ny, nz: 0 };
      }
    }
    return best;
  }
  const co = Math.cos(c.rot), si = Math.sin(c.rot);
  const rx = ox - c.x, rz = oz - c.z;
  const lox = rx * co - rz * si, loz = rx * si + rz * co;
  const ldx = dx * co - dz * si, ldz = dx * si + dz * co;
  const hit = convexRay(localPlanes(c), lox, oy, loz, ldx, dy, ldz, maxT);
  if (!hit) return null;
  const [wnx, wnz] = toWorldDir(c, hit.n[0], hit.n[2]);
  return { t: hit.t, nx: wnx, ny: hit.n[1], nz: wnz };
}

/** Ray against map + ground plane. */
export function raycastWorld(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): RayHit | null {
  let best: RayHit | null = null;
  if (dy < 0) {
    const t = -oy / dy;
    if (t >= 0 && t <= maxT) best = { t, nx: 0, ny: 1, nz: 0, collider: -1 };
  }
  const cs = MAP.colliders;
  for (let i = 0; i < cs.length; i++) {
    const lim = best ? best.t : maxT;
    const h = rayCollider(cs[i], ox, oy, oz, dx, dy, dz, lim);
    if (h && h.t <= lim) best = { t: h.t, nx: h.nx, ny: h.ny, nz: h.nz, collider: i };
  }
  return best;
}

export function lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  return !raycastWorld(ax, ay, az, bx - ax, by - ay, bz - az, 0.999);
}

// ---------------------------------------------------------------------------
// Player hit boxes
// ---------------------------------------------------------------------------

export function hitboxDims(crouch: boolean) {
  return crouch ? { bodyTop: 0.98, headY: 1.13, headR: 0.25 } : { bodyTop: 1.42, headY: 1.6, headR: 0.25 };
}
export const BODY_RADIUS = 0.4;

/** Ray (unnormalised dir) vs player hit volume at feet position (px,py,pz). */
export function rayPlayer(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number, px: number, py: number, pz: number, crouch: boolean): { t: number; head: boolean } | null {
  const hb = hitboxDims(crouch);
  let best: { t: number; head: boolean } | null = null;
  // head sphere
  {
    const fx = ox - px, fy = oy - (py + hb.headY), fz = oz - pz;
    const a = dx * dx + dy * dy + dz * dz, b = 2 * (fx * dx + fy * dy + fz * dz), c = fx * fx + fy * fy + fz * fz - hb.headR * hb.headR;
    const disc = b * b - 4 * a * c;
    if (disc >= 0 && a > 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t <= maxT) best = { t, head: true };
      else if (c < 0) best = { t: 0, head: true };
    }
  }
  const body: CylC = { kind: "cyl", x: px, z: pz, y: py, r: BODY_RADIUS, h: hb.bodyTop, vis: "post", team: 2 };
  const h = rayCollider(body, ox, oy, oz, dx, dy, dz, best ? best.t : maxT);
  if (h && (!best || h.t < best.t)) best = { t: h.t, head: false };
  return best;
}

// ---------------------------------------------------------------------------
// Ballistics
// ---------------------------------------------------------------------------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type V3 = [number, number, number];

/** Deterministic pellet directions from a base aim direction, cone radius and seed. */
export function pelletDirs(base: V3, spread: number, count: number, seed: number): V3[] {
  const len = Math.hypot(base[0], base[1], base[2]) || 1;
  const fx = base[0] / len, fy = base[1] / len, fz = base[2] / len;
  // orthonormal basis
  let ux = 0, uy = 1, uz = 0;
  if (Math.abs(fy) > 0.95) { ux = 1; uy = 0; uz = 0; }
  let rx = uy * fz - uz * fy, ry = uz * fx - ux * fz, rz = ux * fy - uy * fx;
  const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
  const vx = fy * rz - fz * ry, vy = fz * rx - fx * rz, vz = fx * ry - fy * rx;
  const rnd = mulberry32(seed);
  const out: V3[] = [];
  for (let i = 0; i < count; i++) {
    const r = spread * Math.sqrt(rnd()), a = rnd() * Math.PI * 2;
    const ox = Math.cos(a) * r, oy = Math.sin(a) * r;
    const dx = fx + rx * ox + vx * oy, dy = fy + ry * ox + vy * oy, dz = fz + rz * ox + vz * oy;
    const l = Math.hypot(dx, dy, dz);
    out.push([dx / l, dy / l, dz / l]);
  }
  return out;
}

export function ballisticPos(o: V3, d: V3, speed: number, grav: number, t: number): V3 {
  return [o[0] + d[0] * speed * t, o[1] + d[1] * speed * t - 0.5 * grav * t * t, o[2] + d[2] * speed * t];
}

/** Time at which a projectile hits the world (or its lifetime ends). */
export function projectileWorldHit(o: V3, d: V3, w: WeaponDef, step = 1 / 90): { t: number; p: V3; n: V3 } | null {
  let prev = o;
  for (let t = step; t <= w.life + 1e-6; t += step) {
    const cur = ballisticPos(o, d, w.speed, w.grav, t);
    const h = raycastWorld(prev[0], prev[1], prev[2], cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2], 1);
    if (h) {
      const tt = t - step + h.t * step;
      return { t: tt, p: ballisticPos(o, d, w.speed, w.grav, tt), n: [h.nx, h.ny, h.nz] };
    }
    prev = cur;
  }
  return null;
}

/** Camera / aim direction from yaw & pitch. */
export function aimDir(yaw: number, pitch: number): V3 {
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
}

/** Where a character's marker muzzle roughly sits (used by server for bots and validation). */
export function muzzlePos(x: number, y: number, z: number, yaw: number, pitch: number, crouch: boolean): V3 {
  const d = aimDir(yaw, pitch);
  const sh = crouch ? 1.0 : 1.42;
  // character's right-hand side when facing (sin yaw, cos yaw)
  const rx = -Math.cos(yaw), rz = Math.sin(yaw);
  return [x + d[0] * 0.75 + rx * 0.18, y + sh + d[1] * 0.75, z + d[2] * 0.75 + rz * 0.18];
}

// ---------------------------------------------------------------------------
// Network protocol
// ---------------------------------------------------------------------------

export type Phase = "lobby" | "countdown" | "playing" | "finished";

export interface PlayerMeta {
  id: number;
  name: string;
  team: Team;
  bot: boolean;
  look: number;
  tags: number;
  downs: number;
  streak: number;
  best: number;
  connected: boolean;
}

export interface RoomMeta {
  v: number;
  code: string;
  hostId: number;
  publicLobby: boolean;
  practice: boolean;
  quick: boolean;
  botLevel: BotLevel;
  players: PlayerMeta[];
  winner: Team | -1 | null;
}

/** [id, x, y, z, yaw, pitch, flags, weapon, hp, vx, vy, vz] */
export type PlayerState = number[];

export type GameEvent =
  | { s: number; k: "shot"; by: number; w: number; o: V3; d: V3; sp: number; seed: number }
  | { s: number; k: "hit"; by: number; tg: number; dmg: number; hp: number; head: 0 | 1; p: V3 }
  | { s: number; k: "ko"; by: number; tg: number; w: number; head: 0 | 1; streak: number }
  | { s: number; k: "spawn"; id: number }
  | { s: number; k: "info"; text: string };

export interface Snapshot {
  t: "snap";
  now: number;
  seq: number;
  phase: Phase;
  phaseEnds: number;
  scores: [number, number];
  ps: PlayerState[];
  ev?: GameEvent[];
  meta?: RoomMeta;
  you?: { life: number; x: number; y: number; z: number; yaw: number; fix?: 1 };
  echo?: number;
}

export type ClientEvent =
  | { k: "fire"; id: number; w: number; o: V3; d: V3; sp: number; seed: number }
  | { k: "hit"; id: number; i: number; tg: number; head: 0 | 1; p: V3 };

export interface ClientSync {
  ack: number;
  mv: number;
  life: number;
  /** [x, y, z, yaw, pitch, flags, weapon, vx, vy, vz] */
  st?: number[];
  ev?: ClientEvent[];
  echo?: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round3 = (n: number) => Math.round(n * 1000) / 1000;
