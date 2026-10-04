// Directions around Haven City: the shortest way along the streets from where
// you are to a place, as a list of points (start → road → … → road → place).
import { ROADS, isNS, type Road } from "./layout";

type P = [number, number];
type Graph = { nodes: P[]; edges: Map<number, { to: number; d: number }[]> };

const keyOf = (x: number, z: number) => `${Math.round(x * 10)},${Math.round(z * 10)}`;

/** Every road broken at its crossings, as a graph of points and straight edges. */
function buildGraph(roads: Road[]): Graph {
  const nodes: P[] = [], index = new Map<string, number>(), edges = new Map<number, { to: number; d: number }[]>();
  const node = (x: number, z: number) => {
    const k = keyOf(x, z);
    let i = index.get(k);
    if (i === undefined) { i = nodes.length; nodes.push([x, z]); index.set(k, i); edges.set(i, []); }
    return i;
  };
  const link = (a: number, b: number) => {
    if (a === b) return;
    const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
    edges.get(a)!.push({ to: b, d }); edges.get(b)!.push({ to: a, d });
  };
  for (const r of roads) {
    // the points along this road: its ends and wherever another road crosses or touches it
    const along: number[] = [];
    const ns = isNS(r);
    along.push(ns ? r.z1 : r.x1, ns ? r.z2 : r.x2);
    for (const o of roads) {
      if (o === r || isNS(o) === ns) continue;
      if (ns) { if (o.z1 >= r.z1 - 0.1 && o.z1 <= r.z2 + 0.1 && r.x1 >= o.x1 - 0.1 && r.x1 <= o.x2 + 0.1) along.push(o.z1); }
      else if (o.x1 >= r.x1 - 0.1 && o.x1 <= r.x2 + 0.1 && r.z1 >= o.z1 - 0.1 && r.z1 <= o.z2 + 0.1) along.push(o.x1);
    }
    const pts = [...new Set(along.map((a) => Math.round(a * 10) / 10))].sort((a, b) => a - b);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = ns ? node(r.x1, pts[i]) : node(pts[i], r.z1), b = ns ? node(r.x1, pts[i + 1]) : node(pts[i + 1], r.z1);
      link(a, b);
    }
  }
  return { nodes, edges };
}

let graph: Graph | null = null;
const getGraph = () => (graph ??= buildGraph(ROADS));

/** The closest point on any road, and which road edge it falls on. */
export function nearestRoadPoint(x: number, z: number) {
  const g = getGraph();
  let best = { x, z, d: Infinity, a: 0, b: 0 };
  for (const [a, list] of g.edges) for (const { to: b } of list) {
    if (b < a) continue;
    const [ax, az] = g.nodes[a], [bx, bz] = g.nodes[b];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { x: px, z: pz, d, a, b };
  }
  return best;
}

/**
 * Street directions from (fx, fz) to (tx, tz). Short hops (or places far from
 * any road) go straight; otherwise the route follows the roads.
 */
export function findRoute(fx: number, fz: number, tx: number, tz: number): P[] {
  const direct = Math.hypot(tx - fx, tz - fz);
  const s = nearestRoadPoint(fx, fz), e = nearestRoadPoint(tx, tz);
  if (direct < 45 || s.d + e.d > direct) return [[fx, fz], [tx, tz]];
  const g = getGraph();
  const S = -1, E = -2;
  const pos = (i: number): P => (i === S ? [s.x, s.z] : i === E ? [e.x, e.z] : g.nodes[i]);
  const neighbours = (i: number): { to: number; d: number }[] => {
    const out: { to: number; d: number }[] = [];
    const near = (p: { x: number; z: number; a: number; b: number }) => [p.a, p.b].map((n) => ({ to: n, d: Math.hypot(g.nodes[n][0] - p.x, g.nodes[n][1] - p.z) }));
    if (i === S) return near(s);
    if (i === E) return near(e);
    out.push(...g.edges.get(i)!);
    for (const [p, id] of [[s, S], [e, E]] as const) if (p.a === i || p.b === i) out.push({ to: id, d: Math.hypot(g.nodes[i][0] - p.x, g.nodes[i][1] - p.z) });
    // the start and end sit on the same edge: go straight along it
    return out;
  };
  // Dijkstra over a few hundred points
  const dist = new Map<number, number>([[S, 0]]), prev = new Map<number, number>(), done = new Set<number>();
  if (s.a === e.a && s.b === e.b) return [[fx, fz], [s.x, s.z], [e.x, e.z], [tx, tz]];
  while (true) {
    let cur: number | null = null, cd = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < cd) { cd = d; cur = n; }
    if (cur === null) return [[fx, fz], [tx, tz]];
    if (cur === E) break;
    done.add(cur);
    for (const { to, d } of neighbours(cur)) {
      const nd = cd + d;
      if (nd < (dist.get(to) ?? Infinity)) { dist.set(to, nd); prev.set(to, cur); }
    }
  }
  const path: P[] = [];
  for (let n: number | undefined = E; n !== undefined; n = prev.get(n)) path.unshift(pos(n));
  return simplify([[fx, fz], ...path, [tx, tz]]);
}

/** Drops points that sit on a straight line between their neighbours, and duplicates. */
function simplify(pts: P[]): P[] {
  const out: P[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.5) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = last;
      const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      if (Math.abs(cross) < 0.5) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
}

export const routeLength = (pts: P[]) => pts.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/** Where you are along a route: distance left, the next corner, and which way to turn there. */
export function routeProgress(pts: P[], x: number, z: number) {
  // the closest segment
  let bestI = 0, bestD = Infinity, bestT = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < bestD) { bestD = d; bestI = i; bestT = t; }
  }
  const [ax, az] = pts[bestI], [bx, bz] = pts[bestI + 1] ?? pts[bestI];
  const segLen = Math.hypot(bx - ax, bz - az);
  let left = segLen * (1 - bestT);
  for (let i = bestI + 1; i < pts.length - 1; i++) left += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  const toCorner = segLen * (1 - bestT);
  let turn: "left" | "right" | "straight" | "arrive" = "arrive";
  if (bestI + 2 < pts.length) {
    const [cx, cz] = pts[bestI + 2];
    // x east, z south: a positive cross product of (heading, next heading) is a left turn when seen from above
    const cross = (bx - ax) * (cz - bz) - (bz - az) * (cx - bx);
    turn = Math.abs(cross) < 1e-3 ? "straight" : cross > 0 ? "right" : "left";
  }
  return { left, offRoute: bestD, toCorner, turn, next: pts[bestI + 1] ?? pts[bestI] };
}
