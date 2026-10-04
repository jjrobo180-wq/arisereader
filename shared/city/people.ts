// People out for a walk: they stroll the sidewalks round the blocks, along the
// boardwalk and round the lake. Routes are closed loops (or out-and-back lines)
// that never cross a road, so walkers and traffic never meet.
import { FAIR, NORTH_BLOCKS, PARK, ROAD_HALF, SEASIDE, NORTH, rng } from "./layout";

type P = [number, number];
export type Walker = { id: number; route: number; s: number; speed: number; dir: 1 | -1; character: string; pet: string | null; scale: number };

/** Sidewalk distance from a block's centre (the sidewalk sits just off the road edge). */
export const SIDEWALK = 40 - (ROAD_HALF + 0.8);
const square = (cx: number, cz: number, h = SIDEWALK): P[] => [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];

export const ROUTES: P[][] = [
  // downtown, the plaza, Haven Heights
  ...[[-80, -80], [0, -80], [80, -80], [-80, 0], [0, 0], [80, 0], [-80, 80], [0, 80], [80, 80]].map(([x, z]) => square(x, z)),
  // North Haven
  ...NORTH_BLOCKS.map((b) => square(b.x, b.z)),
  // the boardwalk, end to end and back
  [[(SEASIDE.boardwalk.minX + SEASIDE.boardwalk.maxX) / 2 - 3, NORTH.minZ + 20], [(SEASIDE.boardwalk.minX + SEASIDE.boardwalk.maxX) / 2 - 3, 320], [(SEASIDE.boardwalk.minX + SEASIDE.boardwalk.maxX) / 2 + 3, 320], [(SEASIDE.boardwalk.minX + SEASIDE.boardwalk.maxX) / 2 + 3, NORTH.minZ + 20]],
  // round the lake shore
  Array.from({ length: 32 }, (_, i): P => { const a = (i / 32) * Math.PI * 2, r = PARK.lake.r + 5.5; return [PARK.lake.x + Math.cos(a) * r, PARK.lake.z + Math.sin(a) * r]; }),
  // inside the Central Plaza, past the restaurant doors
  square(0, 0, 18),
  // the fairground midway, and up and down the middle path
  [[FAIR.minX + 23, -255], [FAIR.maxX - 12, -255], [FAIR.maxX - 12, -150], [FAIR.minX + 23, -150]],
  [[427, -262], [427, -140], [433, -140], [433, -262]],
  // round the carousel
  Array.from({ length: 24 }, (_, i): P => { const a = (i / 24) * Math.PI * 2; return [404 + Math.cos(a) * 14, -196 + Math.sin(a) * 14]; }),
];
/** Named routes, so the crowd can be spread on purpose. */
export const ROUTE = { blocks: 9, north: NORTH_BLOCKS.length, boardwalk: 9 + NORTH_BLOCKS.length, lake: 10 + NORTH_BLOCKS.length, plaza: 11 + NORTH_BLOCKS.length, midway: 12 + NORTH_BLOCKS.length, fairPath: 13 + NORTH_BLOCKS.length, carousel: 14 + NORTH_BLOCKS.length };
export const ROUTE_LENGTHS = ROUTES.map((loop) => loop.reduce((n, p, i) => { const q = loop[(i + 1) % loop.length]; return n + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0));

export function routePoint(route: number, s: number): { x: number; z: number; heading: number } {
  const loop = ROUTES[route], len = ROUTE_LENGTHS[route];
  let d = ((s % len) + len) % len;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l) { const t = d / l; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, heading: Math.atan2(b[0] - a[0], b[1] - a[1]) }; }
    d -= l;
  }
  return { x: loop[0][0], z: loop[0][1], heading: 0 };
}

const CHARACTERS = ["alice", "robin-hood", "sinbad", "musketeer", "king-arthur", "odysseus", "hercules", "sherlock-holmes", "dracula", "frankenstein"];
const PETS = ["pet-dog", "pet-cat", "pet-bunny", "pet-penguin", "pet-fox"];

/** Where walker i goes: busy downtown and plaza sidewalks, the boardwalk, the fair, then the quieter streets. */
function routeFor(i: number) {
  const plan: [number, number][] = [[ROUTE.boardwalk, 7], [ROUTE.lake, 4], [ROUTE.plaza, 6], [ROUTE.midway, 11], [ROUTE.fairPath, 5], [ROUTE.carousel, 6]];
  let k = i;
  for (const [route, n] of plan) { if (k < n) return route; k -= n; }
  // downtown blocks get two of every three of the rest
  return k % 3 < 2 ? (k * 5) % ROUTE.blocks : ROUTE.blocks + ((k * 7) % ROUTE.north);
}

/** Everyone out walking today. The same seed gives every reader the same crowd. */
export function makeWalkers(count = 80): Walker[] {
  const r = rng(2468);
  const out: Walker[] = [];
  for (let i = 0; i < count; i++) {
    const route = routeFor(i);
    out.push({
      id: i, route, s: r() * ROUTE_LENGTHS[route], speed: 1.2 + r() * 0.7, dir: r() < 0.5 ? 1 : -1,
      character: CHARACTERS[Math.floor(r() * CHARACTERS.length)], pet: r() < 0.25 ? PETS[Math.floor(r() * PETS.length)] : null, scale: 0.92 + r() * 0.16,
    });
  }
  return out;
}

/** Moves walkers along; anyone with something right in front of them waits. */
export function stepWalkers(list: Walker[], blockers: { x: number; z: number }[], dt: number): Walker[] {
  return list.map((w) => {
    const p = routePoint(w.route, w.s), h = p.heading + (w.dir < 0 ? Math.PI : 0);
    const fx = Math.sin(h), fz = Math.cos(h);
    const waiting = blockers.some((b) => { const dx = b.x - p.x, dz = b.z - p.z, ahead = dx * fx + dz * fz; return ahead > 0 && ahead < 2.4 && Math.abs(dx * fz - dz * fx) < 1.2; });
    return waiting ? w : { ...w, s: w.s + w.speed * w.dir * dt };
  });
}
