// The Build Zone's block world: a 64 × 32 × 64 grid of blocks, what each block
// looks like, starter worlds, a compact save format and block raycasting.
// Pure data and math, shared by the game and the server (and tested).

export const SX = 64, SY = 32, SZ = 64;

export type BlockDef = { id: number; name: string; tiles: [number, number, number]; solid: boolean; transparent?: boolean; glow?: boolean; color: string };
// tiles: [top, sides, bottom] indexes into the texture atlas
export const BLOCKS: BlockDef[] = [
  { id: 0, name: "Air", tiles: [0, 0, 0], solid: false, transparent: true, color: "#000" },
  { id: 1, name: "Grass", tiles: [0, 1, 2], solid: true, color: "#5c940d" },
  { id: 2, name: "Dirt", tiles: [2, 2, 2], solid: true, color: "#8d6e4f" },
  { id: 3, name: "Stone", tiles: [3, 3, 3], solid: true, color: "#868e96" },
  { id: 4, name: "Cobblestone", tiles: [4, 4, 4], solid: true, color: "#6c757d" },
  { id: 5, name: "Planks", tiles: [5, 5, 5], solid: true, color: "#c08552" },
  { id: 6, name: "Log", tiles: [7, 6, 7], solid: true, color: "#7f5539" },
  { id: 7, name: "Leaves", tiles: [8, 8, 8], solid: true, transparent: true, color: "#2f9e44" },
  { id: 8, name: "Glass", tiles: [9, 9, 9], solid: true, transparent: true, color: "#c5f6fa" },
  { id: 9, name: "Brick", tiles: [10, 10, 10], solid: true, color: "#b5462e" },
  { id: 10, name: "Sand", tiles: [11, 11, 11], solid: true, color: "#e9d8a6" },
  { id: 11, name: "Water", tiles: [12, 12, 12], solid: false, transparent: true, color: "#339af0" },
  { id: 12, name: "Snow", tiles: [13, 13, 13], solid: true, color: "#f8f9fa" },
  { id: 13, name: "Gold", tiles: [14, 14, 14], solid: true, color: "#fcc419" },
  { id: 14, name: "Lamp", tiles: [15, 15, 15], solid: true, glow: true, color: "#ffe066" },
  { id: 15, name: "White Wool", tiles: [16, 16, 16], solid: true, color: "#f1f3f5" },
  { id: 16, name: "Red Wool", tiles: [17, 17, 17], solid: true, color: "#e03131" },
  { id: 17, name: "Orange Wool", tiles: [18, 18, 18], solid: true, color: "#f76707" },
  { id: 18, name: "Yellow Wool", tiles: [19, 19, 19], solid: true, color: "#fab005" },
  { id: 19, name: "Lime Wool", tiles: [20, 20, 20], solid: true, color: "#74b816" },
  { id: 20, name: "Blue Wool", tiles: [21, 21, 21], solid: true, color: "#1c7ed6" },
  { id: 21, name: "Purple Wool", tiles: [22, 22, 22], solid: true, color: "#7048e8" },
  { id: 22, name: "Pink Wool", tiles: [23, 23, 23], solid: true, color: "#e64980" },
  { id: 23, name: "Black Wool", tiles: [24, 24, 24], solid: true, color: "#212529" },
  { id: 24, name: "Ice", tiles: [25, 25, 25], solid: true, transparent: true, color: "#a5d8ff" },
  { id: 25, name: "Bookshelf", tiles: [5, 26, 5], solid: true, color: "#7f5539" },
  { id: 26, name: "Stone Brick", tiles: [27, 27, 27], solid: true, color: "#868e96" },
  { id: 27, name: "Pumpkin", tiles: [28, 29, 28], solid: true, color: "#f76707" },
];
export const PLACEABLE = BLOCKS.filter((b) => b.id !== 0);
export const blockDef = (id: number) => BLOCKS[id] ?? BLOCKS[0];
export const isSolid = (id: number) => !!BLOCKS[id]?.solid;

export class World {
  readonly data: Uint8Array;
  constructor(data?: Uint8Array) { this.data = data && data.length === SX * SY * SZ ? data : new Uint8Array(SX * SY * SZ); }
  static index(x: number, y: number, z: number) { return (y * SZ + z) * SX + x; }
  inside(x: number, y: number, z: number) { return x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ; }
  get(x: number, y: number, z: number) { return this.inside(x, y, z) ? this.data[World.index(x, y, z)] : (y < 0 ? 3 : 0); }
  set(x: number, y: number, z: number, id: number) { if (this.inside(x, y, z)) this.data[World.index(x, y, z)] = id; }
  /** Height of the top solid block in a column (-1 if empty). */
  top(x: number, z: number) { for (let y = SY - 1; y >= 0; y--) if (isSolid(this.get(x, y, z))) return y; return -1; }
}

// ─── starter worlds ─────────────────────────────────────────────────────────
function noise2(seed: number) {
  const rnd = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, z: number) => {
    const xi = Math.floor(x), zi = Math.floor(z), xf = smooth(x - xi), zf = smooth(z - zi);
    const a = rnd(xi, zi), b = rnd(xi + 1, zi), c = rnd(xi, zi + 1), d = rnd(xi + 1, zi + 1);
    return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
  };
}
function tree(w: World, x: number, y: number, z: number, h = 4) {
  for (let i = 0; i < h; i++) w.set(x, y + i, z, 6);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = h - 2; dy <= h + 1; dy++) {
    const r = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - h);
    if (r <= 3 && !(dx === 0 && dz === 0 && dy < h) && w.get(x + dx, y + dy, z + dz) === 0) w.set(x + dx, y + dy, z + dz, 7);
  }
}

export type Template = "meadow" | "flat" | "island";
export const TEMPLATES: { id: Template; name: string; blurb: string }[] = [
  { id: "meadow", name: "Meadow", blurb: "Rolling hills, trees and a pond" },
  { id: "flat", name: "Flat land", blurb: "A big flat field to build on" },
  { id: "island", name: "Island", blurb: "A sandy island in the sea" },
];

export function makeWorld(t: Template = "meadow", seed = 7): World {
  const w = new World();
  if (t === "flat") {
    for (let x = 0; x < SX; x++) for (let z = 0; z < SZ; z++) { for (let y = 0; y < 5; y++) w.set(x, y, z, y < 2 ? 3 : 2); w.set(x, 5, z, 1); }
    return w;
  }
  const n = noise2(seed);
  const sea = 6;
  for (let x = 0; x < SX; x++) for (let z = 0; z < SZ; z++) {
    let h: number;
    if (t === "island") {
      const d = Math.hypot(x - SX / 2, z - SZ / 2) / (SX / 2);
      h = Math.round(sea + 5 * (1 - d * 1.25) + n(x / 9, z / 9) * 3 - 1);
    } else h = Math.round(7 + n(x / 14, z / 14) * 5 + n(x / 5, z / 5) * 1.2);
    h = Math.max(1, Math.min(SY - 8, h));
    for (let y = 0; y <= h; y++) w.set(x, y, z, y < h - 3 ? 3 : y < h ? 2 : h <= sea + (t === "island" ? 1 : 0) ? 10 : 1);
    for (let y = h + 1; y <= sea; y++) w.set(x, y, z, 11);
  }
  // trees on the grass
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < (t === "island" ? 7 : 22); i++) {
    const x = 3 + Math.floor(rand() * (SX - 6)), z = 3 + Math.floor(rand() * (SZ - 6)), y = w.top(x, z);
    if (y > 0 && w.get(x, y, z) === 1 && Math.hypot(x - SX / 2, z - SZ / 2) > 6) tree(w, x, y + 1, z, 4 + Math.floor(rand() * 2));
  }
  return w;
}

/** Where to start: the middle of the world, standing on top. */
export function spawnPoint(w: World) {
  const x = SX / 2, z = SZ / 2;
  let y = w.top(x, z) + 1;
  while (y < SY - 2 && (isSolid(w.get(x, y, z)) || isSolid(w.get(x, y + 1, z)))) y++;
  return { x: x + 0.5, y, z: z + 0.5 };
}

// ─── saving: run-length pairs, then base64 ─────────────────────────────────
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toB64(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0, n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
  }
  return out;
}
function fromB64(s: string) {
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (clean[i + k] === "=" || clean[i + k] === undefined ? -1 : B64.indexOf(clean[i + k])));
    const n = ((v[0] & 63) << 18) | ((v[1] & 63) << 12) | ((Math.max(0, v[2]) & 63) << 6) | (Math.max(0, v[3]) & 63);
    out.push((n >> 16) & 255); if (v[2] >= 0) out.push((n >> 8) & 255); if (v[3] >= 0) out.push(n & 255);
  }
  return new Uint8Array(out);
}
export const SAVE_PREFIX = "B1:";
export function encodeWorld(w: World) {
  const pairs: number[] = [];
  let cur = w.data[0], run = 0;
  for (let i = 0; i < w.data.length; i++) {
    const v = w.data[i];
    if (v === cur && run < 255) run++;
    else { pairs.push(run, cur); cur = v; run = 1; }
  }
  pairs.push(run, cur);
  return SAVE_PREFIX + toB64(new Uint8Array(pairs));
}
export function decodeWorld(s: string | null | undefined): World | null {
  if (!s || !s.startsWith(SAVE_PREFIX)) return null;
  const bytes = fromB64(s.slice(SAVE_PREFIX.length));
  const data = new Uint8Array(SX * SY * SZ);
  let o = 0;
  for (let i = 0; i + 1 < bytes.length && o < data.length; i += 2) {
    const run = bytes[i], id = bytes[i + 1] < BLOCKS.length ? bytes[i + 1] : 0;
    data.fill(id, o, Math.min(data.length, o + run)); o += run;
  }
  return o === data.length ? new World(data) : null;
}

// ─── pointing at blocks ─────────────────────────────────────────────────────
/** Steps through the grid along a ray; returns the first non-air (non-water) block and the face it entered through. */
export function raycast(w: World, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max = 7) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
  let tx = dx ? ((sx > 0 ? x + 1 - ox : ox - x) * tdx) : Infinity;
  let ty = dy ? ((sy > 0 ? y + 1 - oy : oy - y) * tdy) : Infinity;
  let tz = dz ? ((sz > 0 ? z + 1 - oz : oz - z) * tdz) : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  while (t <= max) {
    const id = w.get(x, y, z);
    if (id !== 0 && id !== 11 && w.inside(x, y, z)) return { x, y, z, id, nx, ny, nz };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
    else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    if (y < -1 || y > SY + 1) break;
  }
  return null;
}

/** Does a box (feet at y, width w, height h, centred on x/z) overlap any solid block? */
export function boxHitsBlocks(world: World, x: number, y: number, z: number, w = 0.6, h = 1.8) {
  const r = w / 2;
  for (let bx = Math.floor(x - r); bx <= Math.floor(x + r - 1e-6); bx++)
    for (let by = Math.floor(y); by <= Math.floor(y + h - 1e-6); by++)
      for (let bz = Math.floor(z - r); bz <= Math.floor(z + r - 1e-6); bz++)
        if (isSolid(world.get(bx, by, bz)) || bx < 0 || bz < 0 || bx >= SX || bz >= SZ) return true;
  return false;
}
