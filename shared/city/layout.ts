// A.R.I.S.E. City map. Pure data and geometry helpers shared by the client game
// and the server (which uses the bounds to keep presence positions sane).
//
// Coordinates: x runs east, z runs south (screen-down on the minimap). One unit
// is roughly one metre. The city is a 4×4 grid of roads; the speedway sits
// south of the city at the end of a connector road.

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Surface = "road" | "paved" | "grass" | "track" | "sand" | "dirt";
export type SpotKind = "home" | "cinema" | "dealer" | "petshop" | "speedway" | "plaza" | "library" | "venue" | "exit" | "order" | "seat" | "cabinet" | "ride" | "bumper" | "booth" | "treat" | "smash" | "build";
export type Spot = { id: string; kind: SpotKind; x: number; z: number; radius: number; label: string; lot?: number; venue?: string; game?: string; ride?: RideId; booth?: number };
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
/** The road from North Haven down through the stunt park to the z = -40 avenue. */
export const STUNT_ROAD = { x: 200, fromZ: PARK.stunt.maxZ, toZ: -40 };

// ─── North Haven and the south side ─────────────────────────────────────────
/** North Haven: four more east–west streets and two more avenues north of downtown. */
export const NORTH = { minZ: -460, roadsZ: [-200, -280, -360, -440], roadsX: [-200, -120, -40, 40, 120, 200, 280] };
/** The south road runs past the speedway from the coast to the off-road trail. */
export const SOUTH_ROAD = 186;
/** Haven Farm (south-west) and the Off-Road Trail (south-east). */
export const FARM = { minX: SEASIDE.road + ROAD_HALF + 2, maxX: -136, minZ: SOUTH_ROAD + ROAD_HALF + 2, maxZ: 345 };
export const TRAIL = { cx: 232, cz: 276, half: 44, radius: 38, width: 6, entryX: 200 };

/** Haven Fairgrounds: rides, game booths and food stands east of the park. */
export const FAIR = { minX: PARK.maxX, maxX: 512, minZ: -300, maxZ: -62, gate: { x: 340, z: -280 } };
export type RideId = "wheel" | "carousel" | "drop";
export const RIDES: { id: RideId; name: string; x: number; z: number; r: number; spot: { x: number; z: number } }[] = [
  { id: "wheel", name: "the Big Wheel", x: 474, z: -240, r: 4.5, spot: { x: 458, z: -240 } },
  { id: "carousel", name: "the Carousel", x: 404, z: -196, r: 9, spot: { x: 404, z: -184.5 } },
  { id: "drop", name: "the Sky Drop", x: 474, z: -124, r: 5.5, spot: { x: 474, z: -114 } },
];
export const BUMPER = { x: 392, z: -112, w: 34, d: 22 };
const BOOTH_COLORS = [0xe03131, 0x1c7ed6, 0xf59f00, 0x2f9e44, 0xae3ec9];
/** Two rows of game booths: along the north fence, and facing the midway. */
export const BOOTHS = [
  ...["Ring Toss", "Hoop Shot", "Duck Pond", "Ball Throw", "Spin Art"].map((name, i) => ({ x: 366 + i * 18, z: -292, name, color: BOOTH_COLORS[i] })),
  ...["Skee Ball", "Frog Hop", "Basket Toss", "Fishing Game", "Milk Bottles"].map((name, i) => ({ x: [362, 380, 398, 452, 470][i], z: -172, name, color: BOOTH_COLORS[(i + 2) % 5] })),
];
export const FOOD_STANDS = [
  { x: 352, z: -160, name: "Cotton Candy", color: 0xf783ac }, { x: 352, z: -130, name: "Lemonade", color: 0xfcc419 }, { x: 352, z: -100, name: "Pretzels", color: 0xd9480f },
  { x: 372, z: -232, name: "Popcorn", color: 0xe03131 }, { x: 392, z: -232, name: "Funnel Cake", color: 0xf08c00 }, { x: 452, z: -158, name: "Snow Cones", color: 0x339af0 },
];
/** The striped circus tent in the south-east corner. */
export const BIG_TOP = { x: 452, z: -86, r: 13 };

/** Indoor rooms (restaurants and the arcade) sit off the map; doors teleport in and out. */
export type Interior = { id: string; kind: "restaurant" | "arcade"; name: string; x: number; z: number; w: number; d: number };
export const INTERIOR_ORIGIN = 1200;

/** Places a reader can stand: the main map, the pier, the fairgrounds and the indoor rooms. */
export const REGIONS: Box[] = [
  { minX: SEASIDE.minX, maxX: PARK.maxX, minZ: NORTH.minZ, maxZ: TRACK.cz + TRACK.radius + 26 },
  SEASIDE.pier,
  { minX: FAIR.minX - 1, maxX: FAIR.maxX, minZ: FAIR.minZ, maxZ: FAIR.maxZ },
];
export const BOUNDS = { minX: SEASIDE.pier.minX, maxX: FAIR.maxX, minZ: NORTH.minZ, maxZ: TRACK.cz + TRACK.radius + 26 };

// ─── Road network ───────────────────────────────────────────────────────────
/** A straight two-lane road; either x1 === x2 (north–south) or z1 === z2 (east–west), listed min → max. */
export type Road = { x1: number; z1: number; x2: number; z2: number };
const V = (x: number, z1: number, z2: number): Road => ({ x1: x, x2: x, z1, z2 });
const H = (z: number, x1: number, x2: number): Road => ({ z1: z, z2: z, x1, x2 });
export const ROADS: Road[] = [
  ...ROAD_LINES.map((x) => V(x, NORTH.roadsZ[3], CITY)), // downtown avenues run all the way north
  H(-120, -CITY, CITY), H(120, -CITY, CITY),
  ...EXTENDED_ROADS.map((z) => H(z, SEASIDE.road, loopEntryX(z) + 2)),
  V(SEASIDE.road, NORTH.roadsZ[3], 330), // the coast road
  V(0, 120, TRACK.cz - TRACK.radius - TRACK.width), // to the speedway
  ...NORTH.roadsZ.map((z) => H(z, SEASIDE.road, z === -280 ? FAIR.gate.x - 2 : 280)),
  V(200, NORTH.roadsZ[3], STUNT_ROAD.toZ), V(280, NORTH.roadsZ[3], NORTH.roadsZ[0]),
  H(SOUTH_ROAD, SEASIDE.road, TRAIL.entryX),
];
export const isNS = (r: Road) => r.x1 === r.x2;

export function onRoad(x: number, z: number, pad = 0) {
  const h = ROAD_HALF + pad;
  for (const r of ROADS) {
    if (r.x1 === r.x2) { if (Math.abs(x - r.x1) <= h && z >= r.z1 - h && z <= r.z2 + h) return true; }
    else if (Math.abs(z - r.z1) <= h && x >= r.x1 - h && x <= r.x2 + h) return true;
  }
  return false;
}

/** Junctions where three or four roads meet; these get traffic lights. Arms: n = toward -z. */
export type Junction = { id: number; x: number; z: number; arms: { n: boolean; s: boolean; e: boolean; w: boolean } };
export const JUNCTIONS: Junction[] = (() => {
  const out: Junction[] = [];
  for (const v of ROADS.filter(isNS)) for (const h of ROADS.filter((r) => !isNS(r))) {
    if (v.x1 < h.x1 - 0.1 || v.x1 > h.x2 + 0.1 || h.z1 < v.z1 - 0.1 || h.z1 > v.z2 + 0.1) continue;
    const arms = { n: v.z1 < h.z1 - 1, s: v.z2 > h.z1 + 1, w: h.x1 < v.x1 - 1, e: h.x2 > v.x1 + 1 };
    if (Object.values(arms).filter(Boolean).length >= 3) out.push({ id: out.length, x: v.x1, z: h.z1, arms });
  }
  return out;
})();

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

/** The 18 blocks of North Haven (between its streets) and what's on each. */
export type NorthKind = "mall" | "towers" | "library" | "skate" | "houses" | "field" | "garden" | "watertower" | "play";
export const NORTH_BLOCKS: { x: number; z: number; kind: NorthKind }[] = (() => {
  const rows: NorthKind[][] = [
    ["mall", "towers", "library", "play", "towers", "skate"],
    ["houses", "field", "garden", "houses", "houses", "houses"],
    ["houses", "houses", "watertower", "houses", "houses", "houses"],
  ];
  return rows.flatMap((row, j) => row.map((kind, i) => ({ x: -160 + i * 80, z: -240 - j * 80, kind })));
})();
export const LIBRARY = { building: box(0, -238, 40, 28), door: { x: 0, z: -221 }, height: 13 };
export const MALL = { building: box(-160, -246, 52, 34), height: 11 };
/** The Play Block in North Haven: the Smash Room and the Build Zone, doors facing the z = -200 street. */
export const SMASH = { building: box(62, -245, 28, 26), door: { x: 62, z: -231 }, height: 11 };
export const BUILD = { building: box(98, -245, 28, 26), door: { x: 98, z: -231 }, height: 13 };
export const SKATE = { x: 240, z: -240 };
export const FIELD = { x: -80, z: -320, w: 58, d: 38 };
export const GARDEN = { x: 0, z: -320, pond: 10 };
export const WATER_TOWER = { x: 0, z: -400, r: 4 };
/** Maple Grove: eight little houses round each house block, facing the streets. */
export const HOUSES: { x: number; z: number; facing: number; color: number }[] = (() => {
  const r = rng(1313), out: { x: number; z: number; facing: number; color: number }[] = [];
  for (const b of NORTH_BLOCKS) {
    if (b.kind !== "houses" && b.kind !== "watertower") continue;
    for (const o of [-14, 14]) {
      out.push({ x: b.x + o, z: b.z - 22, facing: Math.PI, color: Math.floor(r() * 8) });
      out.push({ x: b.x + o, z: b.z + 22, facing: 0, color: Math.floor(r() * 8) });
      out.push({ x: b.x - 22, z: b.z + o, facing: -Math.PI / 2, color: Math.floor(r() * 8) });
      out.push({ x: b.x + 22, z: b.z + o, facing: Math.PI / 2, color: Math.floor(r() * 8) });
    }
  }
  return out;
})();
export const NORTH_HOUSE = 9;
/** Yard trees on the corners of the house blocks, and trees round the Reading Garden. */
export const NORTH_TREES: { x: number; z: number; s: number }[] = (() => {
  const r = rng(717), out: { x: number; z: number; s: number }[] = [];
  for (const b of NORTH_BLOCKS) {
    if (b.kind === "houses" || b.kind === "watertower") for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push({ x: b.x + sx * 25, z: b.z + sz * 25, s: 0.9 + r() * 0.5 });
    if (b.kind === "garden") for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.2; out.push({ x: b.x + Math.cos(a) * 26, z: b.z + Math.sin(a) * 26, s: 1 + r() * 0.5 }); }
  }
  return out;
})();
/** Quarter pipes along two sides of the skate park. */
export const SKATE_PIPES = [{ x: 240, z: -240 - 27, rot: 0 }, { x: 240, z: -240 + 27, rot: Math.PI }];
/** Haven Farm buildings. */
export const BARN = box(-165, 228, 18, 13);
export const SILO = { x: -146, z: 222, r: 3.2 };

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
  fill(-80, -80, BLOCK_HALF, BLOCK_HALF, 92);
  fill(80, -80, BLOCK_HALF, BLOCK_HALF, 92);
  for (const cx of [-80, 0, 80]) fill(cx, -143, BLOCK_HALF, 13, 64);
  for (const cz of [-80, 0]) { fill(-143, cz, 13, BLOCK_HALF, 22); fill(143, cz, 13, BLOCK_HALF, 22); }
  // North Haven: a second row of downtown towers and the uptown blocks
  for (const cx of [-80, 0, 80]) fill(cx, -180, BLOCK_HALF, 10, 24);
  fill(-160, -160, 30, 30, 22); fill(153, -160, 24, 30, 22);
  for (const b of NORTH_BLOCKS) if (b.kind === "towers") fill(b.x, b.z, BLOCK_HALF, BLOCK_HALF, 48);
  return out;
})();

/** Trees along the edges of Haven Heights and around the speedway (each is also a small collider). */
export const TREES: { x: number; z: number; s: number }[] = (() => {
  const r = rng(4242);
  const out: { x: number; z: number; s: number }[] = [];
  for (const cx of [-80, 0, 80]) for (const x of [cx - 29, cx - 11, cx + 11, cx + 29]) out.push({ x, z: 80, s: 0.8 + r() * 0.5 });
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 240, z = 166 + r() * 20;
    if (Math.abs(x) < 14 || Math.abs(z - SOUTH_ROAD) < ROAD_HALF + 2) continue;
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
    for (let z = NORTH.minZ + 14; z <= 336; z += 20) {
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
    if (Math.abs(d - PARK.loop.r) < ROAD_HALF + 4 || d < PARK.lake.r + 9) continue;
    if (x > PARK.stunt.minX - 6 && z < PARK.stunt.maxZ + 6) continue;
    if (EXTENDED_ROADS.some((rz) => Math.abs(z - rz) < ROAD_HALF + 4) || Math.abs(x - STUNT_ROAD.x) < ROAD_HALF + 4 && z < -30) continue;
    if (PICNIC.some((p) => Math.hypot(p.x - x, p.z - z) < 9) || Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 10) continue;
    out.push({ x, z, s: 1 + r() * 0.7 });
  }
  return out;
})();

// ─── Restaurants, the arcade and the elevated train ─────────────────────────
/** Four restaurants line the Central Plaza; their doors open onto the square. */
export const RESTAURANTS = [
  { id: "pizza", name: "Slice of Haven", sign: "PIZZA", x: -27.7, z: -14, side: -1, color: 0xc92a2a, menu: ["Cheese Slice", "Pepperoni Slice", "Veggie Slice", "Garlic Knots"] },
  { id: "noodles", name: "Noodle House", sign: "NOODLES", x: -27.7, z: 14, side: -1, color: 0x2f9e44, menu: ["Ramen Bowl", "Dumplings", "Fried Rice", "Spring Rolls"] },
  { id: "tacos", name: "Taco Loco", sign: "TACOS", x: 27.7, z: -14, side: 1, color: 0xf08c00, menu: ["Street Tacos", "Burrito", "Nachos", "Churros"] },
  { id: "diner", name: "Sunny Side Diner", sign: "DINER", x: 27.7, z: 14, side: 1, color: 0x1971c2, menu: ["Pancake Stack", "Burger & Fries", "Grilled Cheese", "Milkshake"] },
].map((r) => ({ ...r, box: box(r.x, r.z, 9.4, 12), door: { x: r.x - r.side * 6.2, z: r.z } }));
const arcadeShop = BEACH_SHOPS.find((b) => b.name === "Arcade Pier")!;
export const ARCADE = { id: "arcade", name: "Neon Arcade", door: { x: arcadeShop.box.minX - 1.6, z: arcadeShop.z } };

export const INTERIORS: Interior[] = [
  ...RESTAURANTS.map((r, i): Interior => ({ id: r.id, kind: "restaurant", name: r.name, x: INTERIOR_ORIGIN + i * 60, z: 0, w: 22, d: 18 })),
  { id: "arcade", kind: "arcade", name: ARCADE.name, x: INTERIOR_ORIGIN + 4 * 60, z: 0, w: 26, d: 22 },
];
REGIONS.push(...INTERIORS.map((r) => box(r.x, r.z, r.w - 1, r.d - 1)));
/** Where you stand just inside the door, and the tables and machines in each room. */
export const interiorEntry = (r: Interior) => ({ x: r.x, z: r.z + r.d / 2 - 3, facing: Math.PI });
export const TABLES = (r: Interior) => [[-6, 1], [6, 1], [-6, 6], [6, 6]].map(([dx, dz]) => ({ x: r.x + dx, z: r.z + dz }));
export const COUNTER = (r: Interior) => box(r.x, r.z - r.d / 2 + 2.4, 12, 1.4);
export const CABINETS: { game: string; title: string }[] = [
  { game: "four", title: "Fourfall" }, { game: "seabattle", title: "Iron Tide" }, { game: "math_duel", title: "Number Storm" }, { game: "memory", title: "Mindvault" },
  { game: "word_rescue", title: "Lifeline" }, { game: "checkers", title: "Kingmaker" }, { game: "geography", title: "Atlas" }, { game: "codebreaker", title: "Cipher" },
];
export const cabinetPos = (r: Interior, i: number) => {
  const side = i < 4 ? -1 : 1, k = i % 4;
  return { x: r.x + side * (r.w / 2 - 1.6), z: r.z - r.d / 2 + 4 + k * 4.2, facing: side < 0 ? Math.PI / 2 : -Math.PI / 2 };
};
const interiorColliders: Box[] = INTERIORS.flatMap((r) => {
  const walls = [box(r.x, r.z - r.d / 2, r.w, 0.6), box(r.x, r.z + r.d / 2, r.w, 0.6), box(r.x - r.w / 2, r.z, 0.6, r.d), box(r.x + r.w / 2, r.z, 0.6, r.d)];
  if (r.kind === "restaurant") return [...walls, COUNTER(r), ...TABLES(r).map((t) => box(t.x, t.z, 2.4, 2.4)), ...[-1, 1].map((sx) => box(r.x + sx * (r.w / 2 - 1.2), r.z + r.d / 2 - 1.2, 1, 1))];
  // cabinets round the walls, an air hockey table and two claw machines in the middle
  return [...walls, ...CABINETS.map((_, i) => { const c = cabinetPos(r, i); return box(c.x, c.z, 1.4, 1.4); }), box(r.x, r.z + 1.5, 2.6, 4.4), box(r.x - 5, r.z - 3.5, 1.8, 1.8), box(r.x + 5, r.z - 3.5, 1.8, 1.8)];
});

/** The Haven Loop: an elevated train circling North Downtown above the streets. */
export const TRAIN = { y: 9, loop: [[-120, -200], [120, -200], [120, -120], [-120, -120]] as [number, number][] };
export const TRAIN_PILLARS: { x: number; z: number }[] = (() => {
  const out: { x: number; z: number }[] = [];
  const pts = TRAIN.loop;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 8; d < len - 4; d += 16) {
      const x = ax + ((bx - ax) * d) / len, z = az + ((bz - az) * d) / len;
      if (JUNCTIONS.some((j) => Math.hypot(j.x - x, j.z - z) < 11)) continue;
      out.push({ x, z });
    }
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
  LIBRARY.building, MALL.building, BARN, SMASH.building, BUILD.building,
  ...HOUSES.map((h) => box(h.x, h.z, NORTH_HOUSE, NORTH_HOUSE)),
  box(FIELD.x - FIELD.w / 2, FIELD.z, 1.2, 7.4), box(FIELD.x + FIELD.w / 2, FIELD.z, 1.2, 7.4), // goals
  box(FIELD.x, FIELD.z - 27, 40, 5), // bleachers
  box(SKATE.x, SKATE.z + 4, 9, 4), // fun box
  ...SKATE_PIPES.map((p) => box(p.x, p.z, 40, 4)),
  ...NORTH_TREES.map((t) => box(t.x, t.z, 1.4 * t.s, 1.4 * t.s)),
  ...PICNIC.map((p) => box(p.x, p.z, 4, 2.2)),
  ...RESTAURANTS.map((r) => r.box),
  ...interiorColliders,
  ...BOOTHS.map((b) => box(b.x, b.z, 12, 5)),
  ...FOOD_STANDS.map((f) => box(f.x, f.z, 5, 5)),
  box(BUMPER.x, BUMPER.z - BUMPER.d / 2, BUMPER.w, 0.6), box(BUMPER.x, BUMPER.z + BUMPER.d / 2, BUMPER.w, 0.6),
  box(BUMPER.x - BUMPER.w / 2, BUMPER.z, 0.6, BUMPER.d), box(BUMPER.x + BUMPER.w / 2, BUMPER.z, 0.6, BUMPER.d),
];
export const ROUND_COLLIDERS: { x: number; z: number; r: number }[] = [
  { x: PARK.lake.x, z: PARK.lake.z, r: PARK.lake.r },
  { x: FERRIS.x, z: FERRIS.z, r: 3 },
  { x: LOOKOUT.x, z: LOOKOUT.z, r: LOOKOUT.r },
  { x: GARDEN.x, z: GARDEN.z, r: GARDEN.pond },
  { x: WATER_TOWER.x, z: WATER_TOWER.z, r: WATER_TOWER.r },
  { x: SILO.x, z: SILO.z, r: SILO.r },
  ...RIDES.map((r) => ({ x: r.x, z: r.z, r: r.r })),
  { x: BIG_TOP.x, z: BIG_TOP.z, r: BIG_TOP.r },
  ...TRAIN_PILLARS.map((p) => ({ x: p.x, z: p.z, r: 0.6 })),
];

// ─── Stunt ramps and hidden stars ───────────────────────────────────────────
/** A ramp you drive up along `heading`; it is `length` long and lifts the car `height`. */
export type Ramp = { x: number; z: number; heading: number; width: number; length: number; height: number };
export const RAMPS: Ramp[] = [
  { x: 222, z: -126, heading: Math.PI / 2, width: 7, length: 9, height: 2.2 },
  { x: 250, z: -112, heading: Math.PI / 2, width: 7, length: 12, height: 3.4 },
  { x: 290, z: -140, heading: -Math.PI / 2, width: 7, length: 9, height: 2.2 },
  { x: -120, z: 140, heading: Math.PI, width: 7, length: 10, height: 2.6 },
  // skate park kickers
  { x: 226, z: -228, heading: Math.PI / 2, width: 5, length: 5, height: 1.2 },
  { x: 256, z: -252, heading: -Math.PI / 2, width: 5, length: 5, height: 1.2 },
  // dirt jumps on the off-road trail
  { x: TRAIL.cx + 10, z: TRAIL.cz - TRAIL.radius, heading: Math.PI / 2, width: 7, length: 8, height: 1.8 },
  { x: TRAIL.cx - 10, z: TRAIL.cz + TRAIL.radius, heading: -Math.PI / 2, width: 7, length: 8, height: 1.8 },
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
  { id: "library", x: 14, z: -214, hint: "on the library steps" },
  { id: "mall", x: -176, z: -214, hint: "in the Haven Mall parking lot" },
  { id: "skate", x: 240, z: -226, hint: "at the skate park" },
  { id: "goal", x: -80, z: -320, hint: "in the middle of the sports field" },
  { id: "garden", x: 0, z: -302, hint: "in the Reading Garden" },
  { id: "watertower", x: 7, z: -400, hint: "under the water tower" },
  { id: "northbeach", x: -262, z: -420, hint: "at the far north end of the beach" },
  { id: "pumpkins", x: -170, z: 280, hint: "in the pumpkin patch" },
  { id: "trail", x: TRAIL.cx, z: TRAIL.cz + TRAIL.radius, y: 3.8, hint: "in the air over the trail's back jump" },
  { id: "fair", x: 430, z: -150, hint: "in the middle of the fairgrounds" },
  { id: "plazafood", x: 0, z: 26, hint: "between the plaza restaurants" },
];

// ─── Interaction spots ──────────────────────────────────────────────────────
export const SPOTS: Spot[] = [
  { id: "cinema", kind: "cinema", x: CINEMA.door.x - 2.5, z: CINEMA.door.z, radius: 6, label: "Starlight Cinema" },
  { id: "dealer", kind: "dealer", x: DEALER.door.x + 3, z: DEALER.door.z, radius: 6, label: "Velocity Motors" },
  { id: "petshop", kind: "petshop", x: PETSHOP.door.x, z: PETSHOP.door.z + 2.5, radius: 6, label: "Paws & Pals Pet Shop" },
  { id: "library", kind: "library", x: LIBRARY.door.x, z: LIBRARY.door.z + 2, radius: 6, label: "A.R.I.S.E. Library" },
  { id: "speedway", kind: "speedway", x: CONNECTOR.x, z: CONNECTOR.toZ - 6, radius: 10, label: "Haven Speedway" },
  ...LOTS.map((l): Spot => ({ id: `home-${l.index}`, kind: "home", x: l.doorX, z: l.doorZ, radius: 3.4, label: "Home", lot: l.index })),
  ...RESTAURANTS.map((r): Spot => ({ id: `door-${r.id}`, kind: "venue", venue: r.id, x: r.door.x, z: r.door.z, radius: 3.6, label: r.name })),
  { id: "door-arcade", kind: "venue", venue: "arcade", x: ARCADE.door.x, z: ARCADE.door.z, radius: 4, label: ARCADE.name },
  ...INTERIORS.map((r): Spot => ({ id: `exit-${r.id}`, kind: "exit", venue: r.id, x: r.x, z: r.z + r.d / 2 - 1.6, radius: 2.2, label: `Leave ${r.name}` })),
  ...INTERIORS.filter((r) => r.kind === "restaurant").flatMap((r): Spot[] => [
    { id: `order-${r.id}`, kind: "order", venue: r.id, x: r.x, z: COUNTER(r).maxZ + 1.6, radius: 2.6, label: "Order food" },
    ...TABLES(r).map((t, i): Spot => ({ id: `seat-${r.id}-${i}`, kind: "seat", venue: r.id, x: t.x, z: t.z + 2.2, radius: 1.9, label: "Sit down and eat" })),
  ]),
  ...INTERIORS.filter((r) => r.kind === "arcade").flatMap((r) => CABINETS.map((c, i): Spot => {
    const p = cabinetPos(r, i);
    return { id: `cab-${c.game}`, kind: "cabinet", venue: r.id, game: c.game, x: p.x + Math.sin(p.facing) * 1.8, z: p.z, radius: 1.6, label: `Play ${c.title}` };
  })),
  ...RIDES.map((r): Spot => ({ id: `ride-${r.id}`, kind: "ride", ride: r.id, x: r.spot.x, z: r.spot.z, radius: 3.2, label: `Ride ${r.name}` })),
  { id: "bumper", kind: "bumper", x: BUMPER.x, z: BUMPER.z + BUMPER.d / 2 + 2.2, radius: 3.4, label: "Drive a bumper car" },
  ...BOOTHS.map((b, i): Spot => ({ id: `booth-${i}`, kind: "booth", booth: i, x: b.x, z: b.z + 4.6, radius: 3, label: `Play ${b.name}` })),
  ...FOOD_STANDS.map((f, i): Spot => ({ id: `treat-${i}`, kind: "treat", x: f.x + 4.4, z: f.z, radius: 2.8, label: `Get ${f.name}` })),
  { id: "smash", kind: "smash", x: SMASH.door.x, z: SMASH.door.z + 1.5, radius: 4, label: "Smash Room" },
  { id: "build", kind: "build", x: BUILD.door.x, z: BUILD.door.z + 1.5, radius: 4, label: "Build Zone" },
];
export const interiorAt = (x: number, z: number) => INTERIORS.find((r) => Math.abs(x - r.x) < r.w / 2 + 1 && Math.abs(z - r.z) < r.d / 2 + 1) ?? null;

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

/** Distance from a point to the off-road trail's centre line. */
export function trailDistance(x: number, z: number) {
  const { cx, cz, half, radius } = TRAIL;
  const dx = x - cx, dz = z - cz;
  if (Math.abs(dx) <= half) return Math.abs(Math.abs(dz) - radius);
  return Math.abs(Math.hypot(dx - (dx > 0 ? half : -half), dz) - radius);
}

const inBlock = (x: number, z: number, b: { x: number; z: number }, half = BLOCK_HALF) => Math.abs(x - b.x) <= half && Math.abs(z - b.z) <= half;
const northBlockAt = (x: number, z: number) => NORTH_BLOCKS.find((b) => inBlock(x, z, b));

export function surfaceAt(x: number, z: number): Surface {
  if (onRoad(x, z)) return "road";
  if (x > PARK.maxX) return "paved"; // fairgrounds and indoor rooms
  if (x > CITY && z > -CITY && Math.abs(Math.hypot(x - PARK.loop.x, z - PARK.loop.z) - PARK.loop.r) <= ROAD_HALF) return "road";
  if (x >= PARK.stunt.minX && x <= PARK.stunt.maxX && z >= PARK.stunt.minZ && z <= PARK.stunt.maxZ) return "road";
  // the coast: pier, beach and boardwalk west of the coast road
  if (x < SEASIDE.road - ROAD_HALF) {
    if (z >= SEASIDE.pier.minZ && z <= SEASIDE.pier.maxZ && x < SEASIDE.boardwalk.minX) return "paved";
    if (x >= SEASIDE.boardwalk.minX && x <= SEASIDE.boardwalk.maxX) return "paved";
    return x < SEASIDE.boardwalk.minX ? "sand" : "paved";
  }
  if (z > CITY) {
    if (trackDistance(x, z) <= TRACK.width) return "track";
    if (x > CITY - 30 && (trailDistance(x, z) <= TRAIL.width || Math.abs(x - TRAIL.entryX) <= 4 && z > SOUTH_ROAD && z < TRAIL.cz - TRAIL.radius)) return "dirt";
    return "grass";
  }
  if (z < -CITY) {
    const b = northBlockAt(x, z);
    if (!b) return "paved";
    return b.kind === "houses" || b.kind === "watertower" || b.kind === "field" || b.kind === "garden" ? "grass" : "paved";
  }
  if (x > CITY) return "grass";
  if (x < -CITY) return "paved"; // the promenade
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
  const room = interiorAt(x, z);
  if (room) return room.name;
  if (x > PARK.maxX) return "Haven Fairgrounds";
  if (x < SEASIDE.road + ROAD_HALF || x < -CITY && z > -CITY && z < CITY) return x >= SEASIDE.boardwalk.minX ? "Seaside Boardwalk" : z >= SEASIDE.pier.minZ && z <= SEASIDE.pier.maxZ ? "Haven Pier" : "Seaside Beach";
  if (z < -CITY - 34) {
    const b = northBlockAt(x, z);
    const names: Record<NorthKind, string> = { mall: "Haven Mall", towers: "Uptown", library: "A.R.I.S.E. Library", skate: "Skate Park", houses: "Maple Grove", field: "Sports Field", garden: "Reading Garden", watertower: "Maple Grove", play: "Smash & Build" };
    return b ? names[b.kind] : z < -280 ? "Maple Grove" : "North Haven";
  }
  if (z > CITY && x < FARM.maxX + 4) return "Haven Farm";
  if (z > CITY && x > CITY - 30) return "Off-Road Trail";
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

// ─── Places you can get directions to ───────────────────────────────────────
export type Destination = { id: string; name: string; group: "Food & fun" | "Fair" | "Shops & places" | "Outdoors"; x: number; z: number };
export const DESTINATIONS: Destination[] = [
  ...RESTAURANTS.map((r): Destination => ({ id: `food-${r.id}`, name: r.name, group: "Food & fun", x: r.door.x, z: r.door.z })),
  { id: "arcade", name: "Neon Arcade", group: "Food & fun", x: ARCADE.door.x - 2, z: ARCADE.door.z },
  { id: "smash", name: "Smash Room", group: "Food & fun", x: SMASH.door.x, z: SMASH.door.z + 2 },
  { id: "build", name: "Build Zone", group: "Food & fun", x: BUILD.door.x, z: BUILD.door.z + 2 },
  { id: "cinema", name: "Starlight Cinema", group: "Food & fun", x: CINEMA.door.x - 3, z: CINEMA.door.z },
  { id: "fair", name: "Haven Fair (gate)", group: "Fair", x: FAIR.gate.x + 8, z: FAIR.gate.z },
  ...RIDES.map((r): Destination => ({ id: `ride-${r.id}`, name: r.name.replace(/^the /, "The "), group: "Fair", x: r.spot.x, z: r.spot.z })),
  { id: "bumper", name: "Bumper Cars", group: "Fair", x: BUMPER.x, z: BUMPER.z + BUMPER.d / 2 + 2.5 },
  { id: "booths", name: "Game Booths", group: "Fair", x: BOOTHS[2].x, z: BOOTHS[2].z + 5 },
  { id: "library", name: "A.R.I.S.E. Library", group: "Shops & places", x: LIBRARY.door.x, z: LIBRARY.door.z + 2 },
  { id: "dealer", name: "Velocity Motors", group: "Shops & places", x: DEALER.door.x + 3, z: DEALER.door.z },
  { id: "petshop", name: "Paws & Pals Pet Shop", group: "Shops & places", x: PETSHOP.door.x, z: PETSHOP.door.z + 3 },
  { id: "mall", name: "Haven Mall", group: "Shops & places", x: -160, z: -226 },
  { id: "plaza", name: "Central Plaza", group: "Shops & places", x: 0, z: 18 },
  { id: "speedway", name: "Haven Speedway", group: "Shops & places", x: CONNECTOR.x, z: CONNECTOR.toZ - 6 },
  { id: "beach", name: "The Beach & Boardwalk", group: "Outdoors", x: -222, z: 20 },
  { id: "pier", name: "Haven Pier", group: "Outdoors", x: -300, z: 0 },
  { id: "lake", name: "Lakeside Park", group: "Outdoors", x: PARK.lake.x - PARK.lake.r - 8, z: PARK.lake.z },
  { id: "stunt", name: "Stunt Park", group: "Outdoors", x: 230, z: -100 },
  { id: "skate", name: "Skate Park", group: "Outdoors", x: SKATE.x, z: SKATE.z + 30 },
  { id: "garden", name: "Reading Garden", group: "Outdoors", x: GARDEN.x, z: GARDEN.z + 24 },
  { id: "farm", name: "Haven Farm", group: "Outdoors", x: (FARM.minX + FARM.maxX) / 2, z: FARM.minZ + 4 },
  { id: "trail", name: "Off-Road Trail", group: "Outdoors", x: TRAIL.entryX + 6, z: SOUTH_ROAD + 10 },
];
