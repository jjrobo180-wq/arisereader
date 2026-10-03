// A.R.I.S.E. City map. Pure data and geometry helpers shared by the client game
// and the server (which uses the bounds to keep presence positions sane).
//
// Coordinates: x runs east, z runs south (screen-down on the minimap). One unit
// is roughly one metre. The city is a 4×4 grid of roads; the speedway sits
// south of the city at the end of a connector road.

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Surface = "road" | "paved" | "grass" | "track" | "sand";
export type SpotKind = "home" | "cinema" | "dealer" | "petshop" | "speedway" | "plaza";
export type Spot = { id: string; kind: SpotKind; x: number; z: number; radius: number; label: string; lot?: number };
export type Lot = { index: number; x: number; z: number; facing: number; doorX: number; doorZ: number };
export type Tower = Box & { height: number; color: number; seed: number };

export const ROAD_LINES = [-120, -40, 40, 120];
export const ROAD_HALF = 6; // two lanes, lane centres at ±3
export const CITY = 160; // the grid spans -160..160 on both axes
export const BLOCK_HALF = 34; // full blocks between roads: (80 - 12) / 2

/** Speedway: an oval south of the city. */
export const TRACK = { cx: 0, cz: 275, half: 70, radius: 48, width: 9 };
export const CONNECTOR = { x: 0, fromZ: CITY, toZ: TRACK.cz - TRACK.radius - TRACK.width };

export const SOUTH_FIELD_HALF_X = 130; // south of the city only the speedway fields are open

// ─── Districts outside the grid ─────────────────────────────────────────────
/** Seaside Boardwalk, west of the city: a coastal road, boardwalk, beach, ocean and a pier. */
export const SEASIDE = { minX: -292, road: -200, boardwalk: { minX: -232, maxX: -212 }, sandMinX: -290, ocean: -292, pier: { minX: -350, maxX: -290, minZ: -6, maxZ: 6 } };
/** Lakeside Park, east of the city: a lake inside a loop road, a lookout and the stunt park. */
export const PARK = { maxX: 322, lake: { x: 252, z: 10, r: 42 }, loop: { x: 252, z: 10, r: 62 }, stunt: { minX: 186, maxX: 316, minZ: -156, maxZ: -96 } };
/** Avenues that run out of the grid to the new districts (the z = ±40 roads). */
export const EXTENDED_ROADS = [-40, 40];
/** Where an extended avenue meets the lake loop on the east side. */
export const loopEntryX = (z: number) => PARK.loop.x - Math.sqrt(Math.max(0, PARK.loop.r ** 2 - (z - PARK.loop.z) ** 2));
/** A short road from the z = -40 avenue up to the stunt park lot. */
export const STUNT_ROAD = { x: 200, fromZ: PARK.stunt.maxZ, toZ: -40 };

/** Places a reader can stand: the city, the two districts, the pier and the speedway fields. */
export const REGIONS: Box[] = [
  { minX: SEASIDE.minX, maxX: PARK.maxX, minZ: -CITY, maxZ: CITY },
  SEASIDE.pier,
  { minX: -SOUTH_FIELD_HALF_X, maxX: SOUTH_FIELD_HALF_X, minZ: CITY - 1, maxZ: TRACK.cz + TRACK.radius + 26 },
];
export const BOUNDS = { minX: SEASIDE.pier.minX, maxX: PARK.maxX, minZ: -CITY, maxZ: TRACK.cz + TRACK.radius + 26 };

export const SPAWN = { x: 0, z: 16, facing: Math.PI };

/** Deterministic random numbers, so every reader sees the same city. */
export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const box = (cx: number, cz: number, w: number, d: number): Box => ({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });

// ─── Districts ──────────────────────────────────────────────────────────────
export const PLAZA = { x: 0, z: 0 };
export const CINEMA = { building: box(84, 0, 34, 30), door: { x: 63, z: 0 }, height: 15 };
export const DEALER = { building: box(-90, 0, 32, 26), door: { x: -70, z: 0 }, height: 9, showcase: [{ x: -60, z: -16 }, { x: -60, z: 0 }, { x: -60, z: 16 }] };
export const PETSHOP = { building: box(0, -98, 30, 16), door: { x: 0, z: -86 }, height: 8, park: box(0, -64, 56, 28) };
export const FOUNTAIN = box(0, 0, 9, 9);
export const STAGE = box(0, -24, 18, 8);

/** Haven Heights: three blocks south of the plaza, six lots each (18 homes). */
export const LOTS: Lot[] = (() => {
  const blocks = [0, -80, 80]; // the middle block first, so lot 0 sits closest to the plaza
  const out: Lot[] = [];
  for (const cx of blocks) {
    for (const side of [-1, 1]) {
      // side -1: north row facing the z=40 road; side 1: south row facing the z=120 road
      for (const dx of [0, -22, 22]) {
        const x = cx + dx, z = 80 + side * 18;
        const doorZ = z + side * 7.5;
        out.push({ index: out.length, x, z, facing: side < 0 ? Math.PI : 0, doorX: x, doorZ });
      }
    }
  }
  return out;
})();

/** Downtown towers fill the two blocks north of the plaza and the northern edge. */
export const TOWERS: Tower[] = (() => {
  const r = rng(777);
  const out: Tower[] = [];
  const fill = (cx: number, cz: number, halfX: number, halfZ: number, tall: number) => {
    const cols = halfX > 20 ? 3 : 1, rows = halfZ > 20 ? 3 : 1;
    const cw = (halfX * 2) / cols, cd = (halfZ * 2) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (cols === 3 && rows === 3 && i === 1 && j === 1 && r() < 0.5) continue; // a little courtyard
      const w = cw * (0.62 + r() * 0.26), d = cd * (0.62 + r() * 0.26);
      const x = cx - halfX + cw * (i + 0.5), z = cz - halfZ + cd * (j + 0.5);
      out.push({ ...box(x, z, w, d), height: 12 + r() * tall, color: Math.floor(r() * 6), seed: Math.floor(r() * 1e6) });
    }
  };
  fill(-80, -80, BLOCK_HALF, BLOCK_HALF, 46);
  fill(80, -80, BLOCK_HALF, BLOCK_HALF, 46);
  for (const cx of [-80, 0, 80]) fill(cx, -143, BLOCK_HALF, 13, 30);
  for (const cz of [-80, 0]) { fill(-143, cz, 13, BLOCK_HALF, 22); fill(143, cz, 13, BLOCK_HALF, 22); }
  return out;
})();

/** Trees along the edges of Haven Heights and around the speedway (each is also a small collider). */
export const TREES: { x: number; z: number; s: number }[] = (() => {
  const r = rng(4242);
  const out: { x: number; z: number; s: number }[] = [];
  for (const cx of [-80, 0, 80]) for (const x of [cx - 33, cx - 11, cx + 11, cx + 33]) out.push({ x, z: 80, s: 0.8 + r() * 0.5 });
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 240, z = 166 + r() * 20;
    if (Math.abs(x) < 14) continue;
    out.push({ x, z, s: 0.9 + r() * 0.7 });
  }
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2, d = 1 + r() * 0.25;
    const x = TRACK.cx + Math.cos(a) * (TRACK.half + TRACK.radius + 18) * d, z = TRACK.cz + Math.sin(a) * (TRACK.radius + 16) * d;
    if (Math.abs(x) < 14 && z < TRACK.cz) continue;
    if (Math.abs(x) > SOUTH_FIELD_HALF_X - 3 || z > BOUNDS.maxZ - 3) continue;
    out.push({ x, z, s: 1 + r() * 0.6 });
  }
  for (const cz of [126, 155]) for (const x of [-150, -128, 128, 150]) out.push({ x, z: cz, s: 1.1 });
  return out;
})();

// ─── Colliders ──────────────────────────────────────────────────────────────
/** Beach shops along the east side of the coastal road. */
export const BEACH_SHOPS = [
  { name: "Scoops", color: 0xff8fb0, x: -180, z: -110 },
  { name: "Surf Shack", color: 0x3ee6ff, x: -180, z: -70 },
  { name: "Snack Bar", color: 0xffd36b, x: -180, z: 70 },
  { name: "Arcade Pier", color: 0xa974ff, x: -180, z: 110 },
].map((b) => ({ ...b, box: box(b.x, b.z, 14, 16) }));
export const LIFEGUARD = { x: -262, z: -40 };
export const FERRIS = { x: -330, z: 0, r: 14 };
export const LOOKOUT = { x: 300, z: 120, r: 4 };
export const PICNIC = [{ x: 206, z: 100 }, { x: 222, z: 128 }, { x: 290, z: 80 }];

/** Palms along both edges of the boardwalk (each is a small collider). */
export const PALMS: { x: number; z: number; s: number }[] = (() => {
  const r = rng(3131);
  const out: { x: number; z: number; s: number }[] = [];
  for (const x of [SEASIDE.boardwalk.minX - 2, SEASIDE.boardwalk.maxX + 2]) {
    for (let z = -150; z <= 150; z += 20) {
      if (Math.abs(z) < 14) continue; // keep the pier entrance clear
      out.push({ x: x + (r() - 0.5) * 1.5, z: z + (r() - 0.5) * 4, s: 0.9 + r() * 0.35 });
    }
  }
  return out;
})();

/** Trees scattered around Lakeside Park, clear of the lake, its road, the stunt park and the picnic area. */
export const PARK_TREES: { x: number; z: number; s: number }[] = (() => {
  const r = rng(5151);
  const out: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < 140 && out.length < 46; i++) {
    const x = CITY + 12 + r() * (PARK.maxX - CITY - 16), z = -CITY + 6 + r() * (CITY * 2 - 12);
    const d = Math.hypot(x - PARK.loop.x, z - PARK.loop.z);
    if (Math.abs(d - PARK.loop.r) < ROAD_HALF + 4 || d < PARK.lake.r + 4) continue;
    if (x > PARK.stunt.minX - 6 && z < PARK.stunt.maxZ + 6) continue;
    if (EXTENDED_ROADS.some((rz) => Math.abs(z - rz) < ROAD_HALF + 4) || Math.abs(x - STUNT_ROAD.x) < ROAD_HALF + 4 && z < -30) continue;
    if (PICNIC.some((p) => Math.hypot(p.x - x, p.z - z) < 9) || Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 10) continue;
    out.push({ x, z, s: 1 + r() * 0.7 });
  }
  return out;
})();

export const HOUSE_SIZE = 10;
export const COLLIDERS: Box[] = [
  CINEMA.building,
  DEALER.building,
  PETSHOP.building,
  FOUNTAIN,
  STAGE,
  ...TOWERS.map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ })),
  ...LOTS.map((l) => box(l.x, l.z, HOUSE_SIZE, HOUSE_SIZE)),
  ...DEALER.showcase.map((p) => box(p.x, p.z, 5.4, 3.2)),
  ...TREES.map((t) => box(t.x, t.z, 1.4 * t.s, 1.4 * t.s)),
  ...PARK_TREES.map((t) => box(t.x, t.z, 1.4 * t.s, 1.4 * t.s)),
  ...PALMS.map((t) => box(t.x, t.z, 1, 1)),
  ...BEACH_SHOPS.map((b) => b.box),
  box(LIFEGUARD.x, LIFEGUARD.z, 3, 3),
  ...PICNIC.map((p) => box(p.x, p.z, 4, 2.2)),
];
export const ROUND_COLLIDERS: { x: number; z: number; r: number }[] = [
  { x: PARK.lake.x, z: PARK.lake.z, r: PARK.lake.r },
  { x: FERRIS.x, z: FERRIS.z, r: 3 },
  { x: LOOKOUT.x, z: LOOKOUT.z, r: LOOKOUT.r },
];

// ─── Stunt ramps and hidden stars ───────────────────────────────────────────
/** A ramp you drive up along `heading`; it is `length` long and lifts the car `height`. */
export type Ramp = { x: number; z: number; heading: number; width: number; length: number; height: number };
export const RAMPS: Ramp[] = [
  { x: 210, z: -126, heading: Math.PI / 2, width: 7, length: 9, height: 2.2 },
  { x: 250, z: -112, heading: Math.PI / 2, width: 7, length: 12, height: 3.4 },
  { x: 290, z: -140, heading: -Math.PI / 2, width: 7, length: 9, height: 2.2 },
  { x: -120, z: 140, heading: Math.PI, width: 7, length: 10, height: 2.6 },
];
/** Where (x, z) sits on a ramp: 0 at the bottom edge, 1 at the lip; null when off it. */
export function rampAt(x: number, z: number): { ramp: Ramp; t: number } | null {
  for (const ramp of RAMPS) {
    const fx = Math.sin(ramp.heading), fz = Math.cos(ramp.heading);
    const dx = x - ramp.x, dz = z - ramp.z;
    const along = dx * fx + dz * fz, side = dx * fz - dz * fx;
    if (Math.abs(side) <= ramp.width / 2 && Math.abs(along) <= ramp.length / 2) return { ramp, t: along / ramp.length + 0.5 };
  }
  return null;
}

/** Hidden stars to find around the city (saved on the reader's device). */
export const STARS: { id: string; x: number; z: number; y?: number; hint: string }[] = [
  { id: "plaza", x: 0, z: -30, hint: "on the Hangout Stage steps" },
  { id: "cinema", x: 102, z: 24, hint: "behind Starlight Cinema" },
  { id: "dealer", x: -108, z: -26, hint: "in the Velocity Motors lot" },
  { id: "dogpark", x: 24, z: -54, hint: "in the dog park" },
  { id: "towers", x: -80, z: -67, hint: "between the downtown towers" },
  { id: "heights", x: -80, z: 80, hint: "on a Haven Heights lawn" },
  { id: "northedge", x: 120, z: -150, hint: "at the north end of the east avenue" },
  { id: "speedway", x: 0, z: 275, hint: "in the speedway infield" },
  { id: "pier", x: -320, z: 0, hint: "at the end of the pier" },
  { id: "beach", x: -262, z: 120, hint: "on the beach" },
  { id: "boardwalk", x: -222, z: -140, hint: "at the end of the boardwalk" },
  { id: "lake", x: 252, z: -52, hint: "on the lake loop" },
  { id: "lookout", x: 306, z: 112, hint: "by the lookout tower" },
  { id: "stunt", x: 266, z: -112, y: 4.6, hint: "in the air over the big jump" },
  { id: "gap", x: -120, z: 128, hint: "past the Haven Heights jump" },
];

// ─── Interaction spots ──────────────────────────────────────────────────────
export const SPOTS: Spot[] = [
  { id: "cinema", kind: "cinema", x: CINEMA.door.x - 2.5, z: CINEMA.door.z, radius: 6, label: "Starlight Cinema" },
  { id: "dealer", kind: "dealer", x: DEALER.door.x + 3, z: DEALER.door.z, radius: 6, label: "Velocity Motors" },
  { id: "petshop", kind: "petshop", x: PETSHOP.door.x, z: PETSHOP.door.z + 2.5, radius: 6, label: "Paws & Pals Pet Shop" },
  { id: "speedway", kind: "speedway", x: CONNECTOR.x, z: CONNECTOR.toZ - 6, radius: 10, label: "Haven Speedway" },
  ...LOTS.map((l): Spot => ({ id: `home-${l.index}`, kind: "home", x: l.doorX, z: l.doorZ, radius: 3.4, label: "Home", lot: l.index })),
];

export function nearestSpot(x: number, z: number, kinds?: SpotKind[]): Spot | null {
  let best: Spot | null = null, bestD = Infinity;
  for (const s of SPOTS) {
    if (kinds && !kinds.includes(s.kind)) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= s.radius && d < bestD) { best = s; bestD = d; }
  }
  return best;
}

// ─── Surfaces ───────────────────────────────────────────────────────────────
/** Distance from a point to the speedway's centre line. */
export function trackDistance(x: number, z: number) {
  const { cx, cz, half, radius } = TRACK;
  const dx = x - cx, dz = z - cz;
  if (Math.abs(dx) <= half) return Math.abs(Math.abs(dz) - radius);
  const ex = dx > 0 ? half : -half;
  return Math.abs(Math.hypot(dx - ex, dz) - radius);
}

export function surfaceAt(x: number, z: number): Surface {
  if (x < -CITY) {
    if (z >= SEASIDE.pier.minZ && z <= SEASIDE.pier.maxZ && x < SEASIDE.boardwalk.minX) return "paved";
    if (Math.abs(x - SEASIDE.road) <= ROAD_HALF) return "road";
    for (const r of EXTENDED_ROADS) if (Math.abs(z - r) <= ROAD_HALF && x > SEASIDE.road) return "road";
    if (x >= SEASIDE.boardwalk.minX && x <= SEASIDE.boardwalk.maxX) return "paved";
    if (x < SEASIDE.boardwalk.minX) return "sand";
    return "paved";
  }
  if (x > CITY) {
    const d = Math.hypot(x - PARK.loop.x, z - PARK.loop.z);
    if (Math.abs(d - PARK.loop.r) <= ROAD_HALF) return "road";
    for (const r of EXTENDED_ROADS) if (Math.abs(z - r) <= ROAD_HALF && x < loopEntryX(r) + 2) return "road";
    if (Math.abs(x - STUNT_ROAD.x) <= ROAD_HALF && z >= STUNT_ROAD.fromZ - 1 && z <= STUNT_ROAD.toZ) return "road";
    if (x >= PARK.stunt.minX && x <= PARK.stunt.maxX && z >= PARK.stunt.minZ && z <= PARK.stunt.maxZ) return "road";
    return "grass";
  }
  if (z > CITY) {
    if (Math.abs(x - CONNECTOR.x) <= ROAD_HALF && z <= CONNECTOR.toZ + 2) return "road";
    return trackDistance(x, z) <= TRACK.width ? "track" : "grass";
  }
  for (const r of ROAD_LINES) if (Math.abs(x - r) <= ROAD_HALF || Math.abs(z - r) <= ROAD_HALF) return "road";
  if (Math.abs(x - CONNECTOR.x) <= ROAD_HALF && z > 120) return "road";
  if (Math.abs(x) <= BLOCK_HALF && z > 46 && z < 114) return "grass"; // Haven Heights lawns
  if (Math.abs(x) > 46 && Math.abs(x) < 114 && z > 46 && z < 114) return "grass";
  if (x > PETSHOP.park.minX && x < PETSHOP.park.maxX && z > PETSHOP.park.minZ && z < PETSHOP.park.maxZ) return "grass";
  return "paved";
}

/** Keeps a point inside the playable area (the nearest point of any region). */
export function clampToBounds(x: number, z: number, pad = 0): [number, number] {
  let best: [number, number] = [x, z], bestD = Infinity;
  for (const r of REGIONS) {
    const cx = Math.max(r.minX + pad, Math.min(r.maxX - pad, x));
    const cz = Math.max(r.minZ + pad, Math.min(r.maxZ - pad, z));
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d === 0) return [x, z];
    if (d < bestD) { bestD = d; best = [cx, cz]; }
  }
  return best;
}

/** Pushes a circle out of any collider it overlaps. Returns the corrected point and whether it hit. */
export function resolveCircle(x: number, z: number, r: number, boxes: Box[] = COLLIDERS): { x: number; z: number; hit: boolean; nx: number; nz: number } {
  let hit = false, nx = 0, nz = 0;
  for (const b of boxes) {
    if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r) continue;
    const cx = Math.max(b.minX, Math.min(b.maxX, x)), cz = Math.max(b.minZ, Math.min(b.maxZ, z));
    const dx = x - cx, dz = z - cz;
    const d = Math.hypot(dx, dz);
    if (d >= r) continue;
    hit = true;
    if (d > 1e-6) {
      x = cx + (dx / d) * r; z = cz + (dz / d) * r;
      nx = dx / d; nz = dz / d;
    } else {
      // centre inside the box: leave by the nearest side
      const pushes = [b.minX - r - x, b.maxX + r - x, b.minZ - r - z, b.maxZ + r - z];
      const i = pushes.map(Math.abs).indexOf(Math.min(...pushes.map(Math.abs)));
      if (i < 2) { x += pushes[i]; nx = i === 0 ? -1 : 1; nz = 0; } else { z += pushes[i]; nz = i === 2 ? -1 : 1; nx = 0; }
    }
  }
  for (const c of ROUND_COLLIDERS) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
    if (d >= min || d < 1e-6) continue;
    hit = true; nx = dx / d; nz = dz / d;
    x = c.x + nx * min; z = c.z + nz * min;
  }
  const [bx, bz] = clampToBounds(x, z, r);
  if (bx !== x || bz !== z) hit = true;
  return { x: bx, z: bz, hit, nx, nz };
}

/** Place names for the HUD. */
export function areaName(x: number, z: number) {
  if (x < -CITY) return x >= SEASIDE.boardwalk.minX ? "Seaside Boardwalk" : z >= SEASIDE.pier.minZ && z <= SEASIDE.pier.maxZ ? "Haven Pier" : "Seaside Beach";
  if (x > CITY) return z < PARK.stunt.maxZ + 6 ? "Stunt Park" : "Lakeside Park";
  if (z > CITY) return "Haven Speedway";
  if (Math.abs(x) < 40 && Math.abs(z) < 40) return "Central Plaza";
  if (x >= 40 && x < 120 && Math.abs(z) < 40) return "Starlight Cinema";
  if (x <= -40 && x > -120 && Math.abs(z) < 40) return "Velocity Motors";
  if (Math.abs(x) < 40 && z <= -40 && z > -120) return "Paws & Pals Park";
  if (z >= 40) return "Haven Heights";
  if (z <= -40) return "Downtown";
  return "Haven City";
}
