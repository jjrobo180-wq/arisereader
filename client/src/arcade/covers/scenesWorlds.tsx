// Cover art for the Worlds page: one scene per world, painted on the same
// 480×400 canvas as the arcade covers. Covers crop the middle (x 90–390) and
// the title sits over the bottom third, so each scene keeps its subject above
// y≈230. The wide view (spotlight and world page) shows the whole canvas.
import type { ReactNode } from "react";
import { Fog, Glow, GlowEllipse, H, type Ids, Motes, Rays, Ridge, Sky, Stars, Vignette, W, floorCells, hgrad, pipsFor, rgrad, rng, vgrad } from "./paint";
import { chessScene } from "./chessScene";
import type { Painter } from "./Scene";

const url = (k: Ids, name: string) => `url(#${k(name)})`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type Pt = [number, number];
const pts = (list: Pt[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/**
 * One-point perspective: a point `side` units right of the centre line and
 * `up` units above the ground, at depth z (1 = the picture plane). `eye` is the
 * camera height in pixels at depth 1.
 */
function perspective(vpX: number, horizon: number, eye: number) {
  return (side: number, up: number, z: number): Pt => [vpX + side / z, horizon + (eye - up) / z];
}

/** Points along a cubic Bézier, densely sampled. */
function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** A paint splat: a core, lumpy edges and a few flung drops. */
function Splat({ x, y, r, color, seed, flat = 1 }: { x: number; y: number; r: number; color: string; seed: number; flat?: number }) {
  const rand = rng(seed);
  const blobs: ReactNode[] = [<circle key="c" cx={0} cy={0} r={r} />];
  const n = 9 + Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.5;
    const d = r * (0.75 + rand() * 0.45);
    blobs.push(<circle key={`b${i}`} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={r * (0.32 + rand() * 0.3)} />);
    if (rand() > 0.45) {
      const d2 = r * (1.45 + rand() * 0.9);
      blobs.push(<circle key={`d${i}`} cx={Math.cos(a) * d2} cy={Math.sin(a) * d2} r={r * (0.08 + rand() * 0.12)} />);
    }
  }
  return <g transform={`translate(${x} ${y}) scale(1 ${flat})`} fill={color}>{blobs}</g>;
}

/** An isometric die. Faces are drawn in a 100×100 square mapped onto each side, so pips skew with the face. */
function Die({ cx, cy, a, top, left, right, rotate = 0 }: { cx: number; cy: number; a: number; top: number; left: number; right: number; rotate?: number }) {
  const s = a * 0.866;
  const face = (o: Pt, u: Pt, v: Pt, n: number, fill: string) => (
    <g transform={`matrix(${(u[0] - o[0]) / 100} ${(u[1] - o[1]) / 100} ${(v[0] - o[0]) / 100} ${(v[1] - o[1]) / 100} ${o[0]} ${o[1]})`}>
      <rect x={2} y={2} width={96} height={96} rx={16} fill={fill} />
      {pipsFor(n).map(([px, py], i) => <circle key={i} cx={px * 100} cy={py * 100} r={9} fill="#1b1d2a" />)}
    </g>
  );
  return (
    <g transform={`rotate(${rotate} ${cx} ${cy})`}>
      <path d={`M${cx},${cy - a} L${cx + s},${cy - a / 2} L${cx + s},${cy + a / 2} L${cx},${cy + a} L${cx - s},${cy + a / 2} L${cx - s},${cy - a / 2} Z`} fill="#8f94ad" />
      {face([cx - s, cy - a / 2], [cx, cy - a], [cx, cy], top, "#ffffff")}
      {face([cx - s, cy - a / 2], [cx, cy], [cx - s, cy + a / 2], left, "#dfe2ee")}
      {face([cx, cy], [cx + s, cy - a / 2], [cx, cy + a], right, "#bfc4d6")}
    </g>
  );
}

// ─── NEON ARCADE ─────────────────────────────────────────────────────────────
function neonArcade(k: Ids) {
  const P = perspective(240, 200, 110);
  const NEON = ["#ff4fd8", "#3ee6ff", "#ffd23f", "#a974ff"];
  const r = rng(901);
  const floor = floorCells({ vpX: 240, horizon: 200, rows: 13, colW: 64, cols: [-6, 6], curve: 2.3 });
  const tiles = floor.cells.map((c) => {
    const lit = r() < 0.3;
    const col = NEON[Math.floor(r() * NEON.length)];
    return <path key={`${c.i},${c.j}`} d={c.d} fill={lit ? col : (c.i + c.j) % 2 ? "#1a0d33" : "#100722"} opacity={lit ? 0.16 + c.depth * 0.5 : 1} />;
  });
  const walls: ReactNode[] = [];
  const cabinets: ReactNode[] = [];
  for (const s of [-1, 1]) {
    const side = 130 * s;
    walls.push(<polygon key={`w${s}`} points={pts([P(side, 0, 0.5), P(side, 0, 40), P(side, 240, 40), P(side, 240, 0.5)])} fill={url(k, "wall")} />);
    walls.push(<line key={`n${s}`} x1={P(side, 172, 0.5)[0]} y1={P(side, 172, 0.5)[1]} x2={P(side, 172, 40)[0]} y2={P(side, 172, 40)[1]} stroke={s < 0 ? "#3ee6ff" : "#ff4fd8"} strokeWidth={5} opacity={0.35} />);
    walls.push(<line key={`m${s}`} x1={P(side, 172, 0.5)[0]} y1={P(side, 172, 0.5)[1]} x2={P(side, 172, 40)[0]} y2={P(side, 172, 40)[1]} stroke="#ffffff" strokeWidth={1.4} opacity={0.85} />);
    let z = 0.56;
    for (let i = 0; i < 9; i++) {
      const grow = Math.pow(1.3, i);
      const z0 = z, z1 = z + 0.42 * grow;
      z = z1 + 0.07 * grow;
      const h = 124;
      const col = NEON[(i + (s > 0 ? 2 : 0)) % NEON.length];
      const at = (u: number, up: number) => P(side, up, lerp(z0, z1, u));
      cabinets.push(
        <g key={`${s}-${i}`}>
          <polygon points={pts([at(0, 0), at(1, 0), at(1, h), at(0, h)])} fill={url(k, "cab")} />
          <polygon points={pts([at(0, h), at(1, h), at(1, h * 0.88), at(0, h * 0.88)])} fill={col} />
          <polygon points={pts([at(0.14, h * 0.82), at(0.86, h * 0.82), at(0.86, h * 0.5), at(0.14, h * 0.5)])} fill={col} opacity={0.85} />
          <polygon points={pts([at(0.2, h * 0.76), at(0.8, h * 0.76), at(0.8, h * 0.56), at(0.2, h * 0.56)])} fill="#ffffff" opacity={0.28} />
          <polygon points={pts([at(0.06, h * 0.46), at(0.94, h * 0.46), at(0.94, h * 0.4), at(0.06, h * 0.4)])} fill={col} opacity={0.4} />
        </g>,
      );
    }
  }
  const ball: ReactNode[] = [];
  for (let y = 50; y <= 96; y += 6) ball.push(<line key={`h${y}`} x1={200} x2={280} y1={y} y2={y} stroke="#1f2240" strokeWidth={0.8} />);
  for (let i = -4; i <= 4; i++) ball.push(<ellipse key={`v${i}`} cx={240} cy={72} rx={Math.abs(i) * 6.2} ry={26} fill="none" stroke="#1f2240" strokeWidth={0.8} />);
  const rf = rng(907);
  for (let i = 0; i < 14; i++) ball.push(<rect key={`f${i}`} x={218 + rf() * 40} y={52 + rf() * 36} width={5} height={5} fill={rf() > 0.5 ? "#ffffff" : NEON[i % 4]} opacity={0.5 + rf() * 0.5} />);
  return (
    <>
      <Sky k={k} stops={[[0, "#07020f"], [0.5, "#150828"], [1, "#07020f"]]} />
      <defs>
        {vgrad(k("wall"), [[0, "#1b0f33"], [1, "#0b0518"]])}
        {vgrad(k("cab"), [[0, "#2a1650"], [0.6, "#160a2c"], [1, "#0c0618"]])}
        {rgrad(k("ball"), [[0, "#ffffff"], [0.35, "#d2d6ee"], [0.75, "#6a6f9a"], [1, "#25284a"]], 0.38, 0.32, 0.72)}
        <clipPath id={k("ballClip")}><circle cx={240} cy={72} r={26} /></clipPath>
      </defs>
      <polygon points={pts([P(-130, 240, 0.5), P(130, 240, 0.5), P(130, 240, 40), P(-130, 240, 40)])} fill="#0a0414" />
      {[-56, 56].map((sd) => (
        <g key={sd}>
          <line x1={P(sd, 240, 0.6)[0]} y1={P(sd, 240, 0.6)[1]} x2={P(sd, 240, 40)[0]} y2={P(sd, 240, 40)[1]} stroke={sd < 0 ? "#ff4fd8" : "#3ee6ff"} strokeWidth={7} opacity={0.3} />
          <line x1={P(sd, 240, 0.6)[0]} y1={P(sd, 240, 0.6)[1]} x2={P(sd, 240, 40)[0]} y2={P(sd, 240, 40)[1]} stroke="#ffffff" strokeWidth={1.6} opacity={0.9} />
        </g>
      ))}
      <g>{tiles}</g>
      {walls}
      <Glow k={k} name="portal" cx={240} cy={198} r={120} color="#ff6be6" opacity={0.6} core={0.05} />
      <Glow k={k} name="portal2" cx={240} cy={200} r={46} color="#bff8ff" opacity={0.95} core={0.1} />
      {cabinets}
      {/* neon game controller over the far door */}
      <g transform="translate(240 150)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-34,-12 Q-22,-20 0,-18 Q22,-20 34,-12 Q46,4 40,16 Q34,24 24,14 L-24,14 Q-34,24 -40,16 Q-46,4 -34,-12 Z" stroke="#ff4fd8" strokeWidth={7} opacity={0.35} />
        <path d="M-34,-12 Q-22,-20 0,-18 Q22,-20 34,-12 Q46,4 40,16 Q34,24 24,14 L-24,14 Q-34,24 -40,16 Q-46,4 -34,-12 Z" stroke="#ffd0f6" strokeWidth={2} />
        <path d="M-24,-4 L-24,6 M-29,1 L-19,1" stroke="#bff8ff" strokeWidth={2} />
        <circle cx={20} cy={-2} r={2.6} fill="#ffd23f" stroke="none" />
        <circle cx={27} cy={4} r={2.6} fill="#3ee6ff" stroke="none" />
      </g>
      <line x1={240} y1={-6} x2={240} y2={46} stroke="#8d92bd" strokeWidth={1.2} opacity={0.7} />
      <Rays k={k} name="ballRays" cx={240} cy={72} n={22} spread={360} len={300} color="#ffffff" opacity={0.09} seed={903} width={0.025} angle={90} />
      <circle cx={240} cy={72} r={26} fill={url(k, "ball")} />
      <g clipPath={url(k, "ballClip")}>{ball}</g>
      <Glow k={k} name="ballShine" cx={231} cy={63} r={12} color="#ffffff" opacity={0.9} core={0.2} />
      <Motes seed={911} n={26} y0={10} y1={300} color="#ff4fd8" size={1.5} opacity={0.75} />
      <Motes seed={912} n={26} y0={10} y1={300} color="#3ee6ff" size={1.5} opacity={0.75} />
      <Motes seed={913} n={16} y0={10} y1={300} color="#ffd23f" size={1.3} opacity={0.7} />
      <Vignette k={k} strength={0.62} />
    </>
  );
}

// ─── HAVEN HEIGHTS ───────────────────────────────────────────────────────────
function havenHeights(k: Ids) {
  const horizon = 214, eye = 42;
  const P = perspective(240, horizon, eye);
  const facades = ["#6b5876", "#526385", "#7c5d58", "#5b6d84", "#776654", "#585c80"];
  const roofs = ["#352039", "#222d47", "#452626", "#273746", "#382d22", "#2a2744"];
  const r = rng(1201);
  type Item = { z: number; node: ReactNode };
  const items: Item[] = [];
  for (const s of [-1, 1]) {
    let z = s < 0 ? 0.92 : 1.04;
    for (let i = 0; i < 6; i++) {
      const grow = Math.pow(1.45, i);
      const z0 = z, z1 = z + 0.62 * grow, zm = (z0 + z1) / 2;
      z = z1 + 0.27 * grow;
      const front = 120 * s, back = 232 * s;
      const wall = 116, ridge = 176;
      const ci = (i * 2 + (s > 0 ? 1 : 0)) % facades.length;
      const at = (u: number, up: number) => P(front, up, lerp(z0, z1, u));
      const win = (u0: number, u1: number, v0: number, v1: number, lit: boolean, key: string) => {
        const q = pts([at(u0, v1), at(u1, v1), at(u1, v0), at(u0, v0)]);
        const [gx, gy] = at((u0 + u1) / 2, (v0 + v1) / 2);
        const gr = 34 / lerp(z0, z1, (u0 + u1) / 2);
        return (
          <g key={key}>
            {lit && <ellipse cx={gx} cy={gy} rx={gr} ry={gr * 0.8} fill={url(k, "winGlow")} />}
            <polygon points={q} fill={lit ? "#ffd27a" : "#262238"} />
          </g>
        );
      };
      const sideX0 = P(back, 0, z0)[0], sideX1 = P(front, 0, z0)[0];
      const yWall0 = P(front, wall, z0)[1], yGround0 = P(front, 0, z0)[1];
      const sw = (a: number) => lerp(sideX0, sideX1, a);
      const sideLit = r() > 0.3;
      items.push({
        z: z0,
        node: (
          <g key={`h${s}${i}`}>
            {/* near side wall and roof */}
            <rect x={Math.min(sideX0, sideX1)} y={yWall0} width={Math.abs(sideX1 - sideX0)} height={yGround0 - yWall0} fill={facades[ci]} />
            <rect x={Math.min(sideX0, sideX1)} y={yWall0} width={Math.abs(sideX1 - sideX0)} height={yGround0 - yWall0} fill="#0b0716" opacity={0.38} />
            {sideLit && <rect x={Math.min(sw(0.38), sw(0.62))} y={lerp(yWall0, yGround0, 0.3)} width={Math.abs(sw(0.62) - sw(0.38))} height={(yGround0 - yWall0) * 0.24} fill="#ffcf6e" opacity={0.9} />}
            <polygon points={pts([P(back, wall, z0), P(front, wall, z0), P(front, ridge, zm), P(back, ridge, zm)])} fill={roofs[ci]} />
            {/* street-facing front with its gable */}
            <polygon points={pts([at(0, 0), at(1, 0), at(1, wall), at(0, wall)])} fill={facades[ci]} />
            <polygon points={pts([at(0, wall), at(1, wall), P(front, ridge, zm)])} fill={facades[ci]} />
            <polygon points={pts([at(0, wall), at(1, wall), P(front, ridge, zm)])} fill="#ffb27a" opacity={0.12} />
            <polyline points={pts([at(-0.04, wall - 4), P(front, ridge + 6, zm), at(1.04, wall - 4)])} fill="none" stroke={roofs[ci]} strokeWidth={Math.max(1, 9 / zm)} strokeLinejoin="round" />
            {win(0.12, 0.34, 46, 88, r() > 0.25, "w1")}
            {win(0.66, 0.88, 46, 88, r() > 0.25, "w2")}
            {win(0.44, 0.56, 126, 146, r() > 0.5, "w3")}
            <polygon points={pts([at(0.42, 62), at(0.58, 62), at(0.58, 0), at(0.42, 0)])} fill="#2a1b24" />
            <polygon points={pts([at(0.4, 66), at(0.6, 66), at(0.6, 62), at(0.4, 62)])} fill="#ffcf6e" opacity={0.55} />
          </g>
        ),
      });
      // a tree in the yard between this house and the next
      const tz = z1 + 0.135 * grow;
      const [tx, ty] = P(s * 150, 64, tz);
      const [, groundY] = P(s * 150, 0, tz);
      const tr = 38 / tz;
      items.push({
        z: tz,
        node: (
          <g key={`t${s}${i}`}>
            <rect x={tx - 3 / tz} y={ty} width={6 / tz} height={groundY - ty} fill="#1a1420" />
            <circle cx={tx} cy={ty - tr * 0.2} r={tr} fill="#1c2c35" />
            <circle cx={tx - tr * 0.55} cy={ty + tr * 0.15} r={tr * 0.7} fill="#1c2c35" />
            <circle cx={tx + tr * 0.6} cy={ty + tr * 0.1} r={tr * 0.72} fill="#1c2c35" />
            <circle cx={tx - s * tr * 0.35} cy={ty - tr * 0.5} r={tr * 0.55} fill="#2b4048" opacity={0.7} />
          </g>
        ),
      });
    }
  }
  items.sort((a, b) => b.z - a.z);
  const lamps: ReactNode[] = [];
  [[-1, 0.92], [1, 1.25], [-1, 2.1], [1, 3.1], [-1, 4.8], [1, 7.2]].forEach(([s, z], i) => {
    const [bx, by] = P(s * 84, 0, z);
    const [, ty] = P(s * 84, 92, z);
    const [hx] = P(s * 74, 92, z);
    lamps.push(
      <g key={`l${i}`}>
        <ellipse cx={bx} cy={by} rx={70 / z} ry={16 / z} fill={url(k, "pool")} />
        <line x1={bx} y1={by} x2={bx} y2={ty} stroke="#120d18" strokeWidth={Math.max(1, 4 / z)} />
        <line x1={bx} y1={ty} x2={hx} y2={ty} stroke="#120d18" strokeWidth={Math.max(1, 3 / z)} />
        <circle cx={hx} cy={ty + 4 / z} r={60 / z} fill={url(k, "lamp")} />
        <circle cx={hx} cy={ty + 4 / z} r={Math.max(1.2, 5 / z)} fill="#fff1c4" />
      </g>,
    );
  });
  const dashes: ReactNode[] = [];
  for (const z of [0.3, 0.45, 0.66, 0.95, 1.35, 1.95, 2.8, 4, 5.8, 8.4]) {
    dashes.push(<polygon key={z} points={pts([P(-2, 0, z), P(2, 0, z), P(2, 0, z * 1.22), P(-2, 0, z * 1.22)])} fill="#ffd56b" opacity={0.75} />);
  }
  return (
    <>
      <Sky k={k} stops={[[0, "#0a0f33"], [0.26, "#1d2462"], [0.42, "#4a3a80"], [0.5, "#c96d7e"], [0.535, "#ffc07a"], [0.536, "#1b1525"], [1, "#0f0b16"]]} />
      <defs>
        {rgrad(k("winGlow"), [[0, "#ffc966", 0.55], [1, "#ffc966", 0]])}
        {rgrad(k("lamp"), [[0, "#ffd88a", 0.55], [1, "#ffd88a", 0]])}
        {rgrad(k("pool"), [[0, "#ffcf7a", 0.35], [1, "#ffcf7a", 0]])}
        {vgrad(k("road"), [[0, "#2a2533"], [1, "#16131c"]])}
      </defs>
      <Stars seed={1203} n={46} y1={170} />
      <circle cx={336} cy={56} r={15} fill="#fff1cf" />
      <circle cx={343} cy={51} r={13} fill="#121848" />
      <Glow k={k} name="sun" cx={240} cy={214} r={170} color="#ff9b6b" opacity={0.55} />
      <Ridge seed={1205} y={215} amp={12} step={22} color="#2a2142" />
      <rect x={0} y={horizon} width={W} height={H - horizon} fill="#141019" />
      <polygon points={pts([P(-120, 0, 0.2), P(120, 0, 0.2), P(120, 0, 80), P(-120, 0, 80)])} fill="#1a2420" />
      <polygon points={pts([P(-84, 0, 0.2), P(84, 0, 0.2), P(84, 0, 80), P(-84, 0, 80)])} fill="#3b3442" />
      <polygon points={pts([P(-66, 0, 0.2), P(66, 0, 0.2), P(66, 0, 80), P(-66, 0, 80)])} fill={url(k, "road")} />
      {dashes}
      {items.map((it) => it.node)}
      {lamps}
      <Motes seed={1207} n={22} y0={150} y1={330} color="#ffe28a" size={1.2} opacity={0.85} />
      <Vignette k={k} strength={0.58} />
    </>
  );
}

// ─── STARLIGHT CINEMA ────────────────────────────────────────────────────────
function starlightCinema(k: Ids) {
  const sx = 112, sy = 54, sw = 256, sh = 142;
  const bulbs: ReactNode[] = [];
  for (let i = 0; i <= 16; i++) bulbs.push(<circle key={`t${i}`} cx={sx - 8 + (i * (sw + 16)) / 16} cy={sy - 15} r={2.4} fill="#ffeaa8" />);
  for (let i = 1; i <= 7; i++) {
    bulbs.push(<circle key={`l${i}`} cx={sx - 15} cy={sy - 15 + (i * (sh + 22)) / 7} r={2.4} fill="#ffeaa8" />);
    bulbs.push(<circle key={`r${i}`} cx={sx + sw + 15} cy={sy - 15 + (i * (sh + 22)) / 7} r={2.4} fill="#ffeaa8" />);
  }
  // Velvet drapes: strips with their own fold shading, gathered at a tie-back.
  const drape = (side: -1 | 1) => {
    const strips: ReactNode[] = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const xTop = (t: number) => (side < 0 ? lerp(-24, 132, t) : lerp(504, 348, t));
      const xTie = (t: number) => (side < 0 ? lerp(-24, 70, t) : lerp(504, 410, t));
      const xBot = (t: number) => (side < 0 ? lerp(-24, 104, t) : lerp(504, 376, t));
      strips.push(
        <path
          key={i}
          d={`M${xTop(t0)},-10 L${xTop(t1)},-10 C${xTop(t1)},120 ${xTie(t1)},200 ${xTie(t1)},250 C${xTie(t1)},300 ${xBot(t1)},360 ${xBot(t1)},410 L${xBot(t0)},410 C${xBot(t0)},360 ${xTie(t0)},300 ${xTie(t0)},250 C${xTie(t0)},200 ${xTop(t0)},120 ${xTop(t0)},-10 Z`}
          fill={url(k, "fold")}
        />,
      );
    }
    const tieX = side < 0 ? 76 : 404;
    return (
      <g>
        {strips}
        <path d={`M${side < 0 ? -24 : 504},236 Q${tieX},${244} ${tieX + side * -4},${262}`} stroke="#d9a84a" strokeWidth={6} fill="none" strokeLinecap="round" />
        <circle cx={tieX} cy={252} r={6} fill="#f2c860" />
      </g>
    );
  };
  const seats: ReactNode[] = [];
  [[300, 44, 30], [336, 56, 38], [384, 72, 50]].forEach(([y, w, h], row) => {
    for (let x = -w / 2 + ((row % 2) * w) / 2; x < W + w; x += w) {
      const dy = Math.pow((x - 240) / 240, 2) * 14;
      seats.push(
        <g key={`${row}-${x}`}>
          <rect x={x - w * 0.43} y={y - h + dy} width={w * 0.86} height={h + 20} rx={w * 0.22} fill={url(k, "seat")} />
          <rect x={x - w * 0.36} y={y - h + dy + 2} width={w * 0.72} height={3} rx={1.5} fill="#ff8a8a" opacity={0.35} />
        </g>,
      );
    }
  });
  return (
    <>
      <Sky k={k} stops={[[0, "#0b0206"], [0.55, "#1d0610"], [1, "#070205"]]} />
      <defs>
        {vgrad(k("film"), [[0, "#070b2a"], [0.55, "#2a1d66"], [0.85, "#c0657a"], [1, "#ffb27a"]])}
        {hgrad(k("fold"), [[0, "#3a0510"], [0.35, "#a3132e"], [0.55, "#d8344c"], [0.8, "#7a0a20"], [1, "#2a030b"]])}
        {vgrad(k("seat"), [[0, "#7a1626"], [0.5, "#3a0812"], [1, "#160307"]])}
        {vgrad(k("beam"), [[0, "#dfe9ff", 0.16], [1, "#dfe9ff", 0.02]])}
        {hgrad(k("tail"), [[0, "#ffffff", 0], [1, "#ffffff", 0.95]])}
        {rgrad(k("sheen"), [[0, "#ffffff", 0.22], [1, "#ffffff", 0]], 0.5, 0.4, 0.7)}
        <clipPath id={k("screen")}><rect x={sx} y={sy} width={sw} height={sh} rx={3} /></clipPath>
      </defs>
      <Glow k={k} name="screenLight" cx={240} cy={128} r={280} color="#8fb4ff" opacity={0.32} />
      <polygon points={pts([[196, -12], [284, -12], [sx + sw - 6, sy + 4], [sx + 6, sy + 4]])} fill={url(k, "beam")} />
      <rect x={sx - 22} y={sy - 24} width={sw + 44} height={sh + 46} rx={8} fill="#180508" stroke="#c9973f" strokeOpacity={0.55} strokeWidth={2} />
      {bulbs}
      <g clipPath={url(k, "screen")}>
        <rect x={sx} y={sy} width={sw} height={sh} fill={url(k, "film")} />
        <Stars seed={1301} n={60} x0={sx} x1={sx + sw} y0={sy} y1={sy + sh * 0.75} />
        <path d={`M${sx},${sy + sh} L${sx},${sy + sh - 24} L${sx + 40},${sy + sh - 44} L${sx + 74},${sy + sh - 30} L${sx + 118},${sy + sh - 62} L${sx + 160},${sy + sh - 34} L${sx + 200},${sy + sh - 52} L${sx + sw},${sy + sh - 26} L${sx + sw},${sy + sh} Z`} fill="#140c2c" />
        <polygon points={pts([[sx + 54, sy + 28], [sx + 168, sy + 66], [sx + 166, sy + 70]])} fill={url(k, "tail")} />
        <circle cx={sx + 168} cy={sy + 68} r={3.6} fill="#ffffff" />
        <Glow k={k} name="comet" cx={sx + 168} cy={sy + 68} r={20} color="#cfe2ff" opacity={0.9} core={0.1} />
        <path d={`M${sx + 204},${sy + 30} l3,9 l9,3 l-9,3 l-3,9 l-3,-9 l-9,-3 l9,-3 Z`} fill="#fff6d8" />
        <rect x={sx} y={sy} width={sw} height={sh} fill={url(k, "sheen")} />
      </g>
      {/* valance across the top */}
      <path d={`M-10,-10 L490,-10 L490,26 ${Array.from({ length: 10 }, (_, i) => `Q${490 - i * 50 - 25},${48} ${490 - (i + 1) * 50},26`).join(" ")} Z`} fill="#8a0f26" />
      <path d={`M490,26 ${Array.from({ length: 10 }, (_, i) => `Q${490 - i * 50 - 25},${48} ${490 - (i + 1) * 50},26`).join(" ")}`} fill="none" stroke="#e0ac4a" strokeWidth={3} />
      {drape(-1)}
      {drape(1)}
      <Motes seed={1303} n={46} x0={170} x1={310} y0={0} y1={60} color="#fff2d6" size={1} opacity={0.7} />
      <GlowEllipse k={k} name="aisle" cx={240} cy={300} rx={220} ry={50} color="#6f8cff" opacity={0.16} />
      {seats}
      {/* popcorn */}
      <g transform="translate(402 318)">
        <circle cx={-14} cy={-30} r={11} fill="#fff4d6" />
        <circle cx={2} cy={-36} r={12} fill="#fff8e6" />
        <circle cx={16} cy={-29} r={10} fill="#ffefc9" />
        <circle cx={-4} cy={-24} r={10} fill="#ffe8b8" />
        <path d="M-24,-24 L24,-24 L18,30 L-18,30 Z" fill="#f6f2ff" />
        {[-16, -4, 8].map((x) => <path key={x} d={`M${x},-24 L${x + 7},-24 L${x + 5.6},30 L${x - 1.4},30 Z`} fill="#e22b3c" />)}
      </g>
      <Vignette k={k} strength={0.6} />
    </>
  );
}

// ─── BOARD QUEST ─────────────────────────────────────────────────────────────
function boardQuest(k: Ids) {
  const COLORS = ["#2fe0ff", "#ffd23f", "#ff5fd8", "#5af08f", "#b48cff"];
  const curve = bezier([248, 440], [70, 330], [410, 252], [240, 172], 260);
  // Walk the curve, placing tiles closer together as they recede.
  const tiles: { x: number; y: number; s: number }[] = [];
  let last = curve[0];
  tiles.push({ x: last[0], y: last[1], s: 1.25 });
  for (const p of curve) {
    const t = (p[1] - 172) / (440 - 172);
    const s = lerp(0.2, 1.25, Math.pow(Math.max(0, t), 1.1));
    if (Math.hypot(p[0] - last[0], (p[1] - last[1]) * 1.6) >= 54 * s) {
      tiles.push({ x: p[0], y: p[1], s });
      last = p;
    }
  }
  tiles.reverse();
  return (
    <>
      <Sky k={k} stops={[[0, "#03131a"], [0.38, "#08303a"], [0.5, "#156770"], [0.56, "#0b2c35"], [1, "#04131a"]]} />
      <defs>
        {rgrad(k("moon"), [[0, "#f2ffff"], [0.6, "#b9f3f5"], [1, "#6fd3dc"]], 0.42, 0.38, 0.7)}
        {vgrad(k("tower"), [[0, "#1a5560"], [1, "#0a2a32"]])}
        {rgrad(k("gem"), [[0, "#ffffff"], [0.4, "#ff9bf0"], [1, "#b8189a"]], 0.4, 0.3, 0.8)}
        {rgrad(k("gem2"), [[0, "#ffffff"], [0.4, "#9ff3ff"], [1, "#1786b0"]], 0.4, 0.3, 0.8)}
      </defs>
      <Stars seed={1401} n={60} y1={180} />
      <Glow k={k} name="moonGlow" cx={240} cy={96} r={150} color="#7ff0ff" opacity={0.35} />
      <circle cx={240} cy={96} r={44} fill={url(k, "moon")} />
      <Ridge seed={1403} y={196} amp={26} step={24} color="#0d3741" />
      <Ridge seed={1404} y={204} amp={10} step={20} color="#082731" peaks={[[240, 34]]} />
      {/* castle */}
      <g fill={url(k, "tower")}>
        <rect x={198} y={126} width={84} height={50} />
        {[198, 210, 222, 234, 246, 258, 270].map((x) => <rect key={x} x={x} y={120} width={7} height={8} />)}
        <rect x={180} y={104} width={24} height={72} />
        <rect x={276} y={104} width={24} height={72} />
        <rect x={226} y={88} width={28} height={50} />
        <path d="M176,106 L192,70 L208,106 Z" />
        <path d="M272,106 L288,70 L304,106 Z" />
        <path d="M222,90 L240,48 L258,90 Z" />
      </g>
      <path d="M192,70 L192,58 L204,62 L192,66" fill="#ffd23f" />
      <path d="M288,70 L288,58 L300,62 L288,66" fill="#ff5fd8" />
      <path d="M240,48 L240,34 L254,39 L240,44" fill="#2fe0ff" />
      {[[188, 120], [188, 140], [284, 120], [284, 140], [235, 102], [209, 140], [262, 140]].map(([x, y], i) => <rect key={i} x={x} y={y} width={7} height={10} rx={3} fill="#ffd36b" />)}
      <path d="M228,176 L228,160 Q240,146 252,160 L252,176 Z" fill="#fff0b8" />
      <Glow k={k} name="gate" cx={240} cy={166} r={40} color="#ffe28a" opacity={0.8} core={0.1} />
      <Fog k={k} name="fog" y={160} h={60} color="#5fe3ee" opacity={0.28} />
      {/* the path of tiles */}
      {tiles.map((t, i) => {
        const c = COLORS[i % COLORS.length];
        const symbol = i % 4 === 1 ? "star" : i % 4 === 3 ? "q" : null;
        return (
          <g key={i} transform={`translate(${t.x.toFixed(1)} ${t.y.toFixed(1)}) scale(${t.s.toFixed(3)})`}>
            <ellipse cx={0} cy={6} rx={34} ry={14} fill={c} opacity={0.22} />
            <rect x={-24} y={-8} width={48} height={22} rx={8} fill="#04161c" opacity={0.75} />
            <rect x={-24} y={-13} width={48} height={22} rx={8} fill={c} />
            <rect x={-20} y={-11} width={40} height={5} rx={2.5} fill="#ffffff" opacity={0.35} />
            {symbol === "star" && <path d="M0,-9 L2.6,-3.4 L8.6,-3 L4,0.8 L5.4,6.6 L0,3.6 L-5.4,6.6 L-4,0.8 L-8.6,-3 L-2.6,-3.4 Z" fill="#ffffff" opacity={0.9} />}
            {symbol === "q" && <text x={0} y={5.5} textAnchor="middle" fontSize={15} fontWeight={900} fontFamily="Barlow, system-ui, sans-serif" fill="#ffffff" opacity={0.92}>?</text>}
          </g>
        );
      })}
      {/* gems */}
      {[[118, 120, "gem", 1], [372, 104, "gem2", 0.9], [328, 232, "gem", 0.7]].map(([x, y, g, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <circle cx={0} cy={0} r={24} fill={g === "gem" ? "#ff5fd8" : "#2fe0ff"} opacity={0.18} />
          <path d="M0,-16 L12,-4 L0,16 L-12,-4 Z" fill={url(k, String(g))} />
          <path d="M0,-16 L4,-4 L0,16 L-4,-4 Z" fill="#ffffff" opacity={0.35} />
        </g>
      ))}
      {/* tumbling dice */}
      <g opacity={0.4} stroke="#bff6ff" strokeWidth={2} strokeLinecap="round" fill="none">
        <path d="M94,196 Q110,186 120,190" />
        <path d="M98,212 Q112,206 122,208" />
        <path d="M300,128 Q312,118 320,120" />
      </g>
      <Die cx={150} cy={204} a={30} top={5} left={3} right={2} rotate={-14} />
      <Die cx={344} cy={148} a={24} top={6} left={1} right={4} rotate={12} />
      <Motes seed={1407} n={36} y0={40} y1={320} color="#9ff3ff" size={1.2} opacity={0.7} />
      <Vignette k={k} strength={0.6} />
    </>
  );
}

// ─── MIDNIGHT MYSTERY ────────────────────────────────────────────────────────
function midnightMystery(k: Ids) {
  const bat = "M0,0 Q-5,-6 -13,-4 Q-10,-1 -12,4 Q-7,1 -3,6 L0,3 L3,6 Q7,1 12,4 Q10,-1 13,-4 Q5,-6 0,0 Z";
  const pumpkin = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={6} rx={40} ry={8} fill="#000" opacity={0.5} />
      <ellipse cx={-14} cy={-14} rx={18} ry={20} fill={url(k, "pump")} />
      <ellipse cx={14} cy={-14} rx={18} ry={20} fill={url(k, "pump")} />
      <ellipse cx={0} cy={-15} rx={18} ry={22} fill={url(k, "pump")} />
      <path d="M-2,-36 Q0,-46 6,-48" stroke="#3b5a1c" strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M-15,-22 L-7,-22 L-11,-30 Z M7,-22 L15,-22 L11,-30 Z" fill="#ffd54a" />
      <path d="M-14,-10 L-8,-6 L-4,-11 L0,-6 L4,-11 L8,-6 L14,-10 Q8,0 0,1 Q-8,0 -14,-10 Z" fill="#ffd54a" />
    </g>
  );
  const windows: ReactNode[] = [];
  const r = rng(1501);
  const winAt = (x: number, y: number, key: string, eyes = false) => {
    const lit = !eyes && r() > 0.3;
    windows.push(<rect key={key} x={x} y={y} width={10} height={15} rx={5} fill={lit ? "#ffb347" : "#140a1e"} />);
    if (lit) windows.push(<rect key={`${key}g`} x={x - 5} y={y - 4} width={20} height={23} rx={9} fill="#ff9a2e" opacity={0.18} />);
    if (eyes) windows.push(<g key={`${key}e`}><circle cx={x + 3} cy={y + 7} r={1.6} fill="#fff27a" /><circle cx={x + 7.4} cy={y + 7} r={1.6} fill="#fff27a" /></g>);
  };
  for (const [x0, x1] of [[126, 200], [280, 354]]) {
    for (const y of [180, 206, 232]) {
      for (let x = x0 + 6; x + 10 <= x1 - 4; x += 18) winAt(x, y, `${x}-${y}`, x0 > 200 && y === 206 && x > 320);
    }
  }
  const fence: ReactNode[] = [];
  for (let x = -4; x < W + 10; x += 14) fence.push(<path key={x} d={`M${x},304 L${x},282 L${x - 3},282 L${x},274 L${x + 3},282 L${x},282`} stroke="#07030c" strokeWidth={2.4} fill="#07030c" />);
  return (
    <>
      <Sky k={k} stops={[[0, "#05020c"], [0.36, "#1b0a32"], [0.58, "#3d1752"], [0.7, "#25102f"], [1, "#07030b"]]} />
      <defs>
        {rgrad(k("moon"), [[0, "#fff4d4"], [0.55, "#ffd08a"], [1, "#f2953a"]], 0.4, 0.36, 0.7)}
        {rgrad(k("pump"), [[0, "#ffb15a"], [0.6, "#f2741c"], [1, "#9a3a08"]], 0.4, 0.35, 0.75)}
        {vgrad(k("cone"), [[0, "#ff4d4d", 0.22], [1, "#ff4d4d", 0]])}
      </defs>
      <Stars seed={1503} n={60} y1={230} />
      <Glow k={k} name="halo" cx={240} cy={104} r={200} color="#ff8f3a" opacity={0.38} />
      <circle cx={240} cy={104} r={72} fill={url(k, "moon")} />
      <circle cx={214} cy={84} r={11} fill="#e9a356" opacity={0.35} />
      <circle cx={268} cy={124} r={15} fill="#e9a356" opacity={0.3} />
      <circle cx={262} cy={78} r={6} fill="#e9a356" opacity={0.3} />
      {[[176, 62, 1.15], [306, 46, 0.95], [334, 92, 0.72], [156, 112, 0.62], [366, 134, 0.5], [206, 36, 0.55]].map(([x, y, s], i) => <path key={i} d={bat} transform={`translate(${x} ${y}) scale(${s})`} fill="#0a0410" />)}
      {/* the school after dark */}
      <g fill="#0c0614">
        <path d="M120,262 L120,168 L163,128 L206,168 L206,262 Z" />
        <path d="M274,262 L274,168 L317,128 L360,168 L360,262 Z" />
        <rect x={108} y={150} width={18} height={112} />
        <path d="M104,152 L117,118 L130,152 Z" />
        <rect x={354} y={150} width={18} height={112} />
        <path d="M350,152 L363,118 L376,152 Z" />
        <rect x={204} y={92} width={72} height={170} />
        <path d="M198,96 L240,22 L282,96 Z" />
      </g>
      <path d="M198,96 L240,22 L282,96" fill="none" stroke="#ff9a4a" strokeOpacity={0.35} strokeWidth={1.5} />
      <circle cx={240} cy={128} r={20} fill="#ffe7a6" />
      <Glow k={k} name="clock" cx={240} cy={128} r={44} color="#ffcf6e" opacity={0.55} core={0.3} />
      <circle cx={240} cy={128} r={20} fill="none" stroke="#3a1d0c" strokeWidth={2} />
      <line x1={240} y1={128} x2={240} y2={113} stroke="#2a1508" strokeWidth={2.4} strokeLinecap="round" />
      <line x1={240} y1={128} x2={240} y2={117} stroke="#2a1508" strokeWidth={3.4} strokeLinecap="round" />
      {windows}
      <path d="M228,262 L228,236 Q240,222 252,236 L252,262 Z" fill="#ff9f3a" opacity={0.85} />
      {/* security camera watching the school */}
      <path d="M40,64 L92,64" stroke="#16101e" strokeWidth={5} strokeLinecap="round" />
      <polygon points={pts([[128, 82], [244, 176], [196, 214]])} fill={url(k, "cone")} />
      <g transform="rotate(24 108 70)">
        <rect x={88} y={60} width={44} height={20} rx={5} fill="#241a2e" />
        <rect x={128} y={63} width={8} height={14} rx={2} fill="#3a2f46" />
        <circle cx={96} cy={66} r={2.4} fill="#ff4d4d" />
      </g>
      <Glow k={k} name="led" cx={95} cy={63} r={12} color="#ff3b3b" opacity={0.85} core={0.15} />
      <Ridge seed={1505} y={266} amp={6} step={30} color="#0a0510" />
      <Fog k={k} name="fog" y={236} h={80} color="#9b5bd6" opacity={0.3} />
      <path d="M-10,286 L490,286 M-10,296 L490,296" stroke="#07030c" strokeWidth={2.4} />
      {fence}
      {pumpkin(140, 330, 1, "p1")}
      {pumpkin(352, 340, 1.12, "p2")}
      {pumpkin(196, 278, 0.42, "p3")}
      <Glow k={k} name="p1g" cx={140} cy={316} r={46} color="#ffb347" opacity={0.3} />
      <Glow k={k} name="p2g" cx={352} cy={324} r={52} color="#ffb347" opacity={0.3} />
      <Vignette k={k} strength={0.66} />
    </>
  );
}

// ─── PRISM PAINTBALL ─────────────────────────────────────────────────────────
function prismPaintball(k: Ids) {
  const horizon = 236;
  // A glass crystal hovers over the arena: lamp light goes in, paint colours spray out onto the field.
  const A: Pt = [204, 60], B: Pt = [178, 122], C: Pt = [226, 128];
  const d: Pt = [66, -8];
  const add = (p: Pt): Pt => [p[0] + d[0], p[1] + d[1]];
  const A2 = add(A), B2 = add(B), C2 = add(C);
  const exit: Pt = [262, 124];
  const BANDS = ["#ff4d6d", "#ff9a3d", "#ffe14d", "#5af08f", "#3ee6ff", "#a974ff"];
  const fan = BANDS.map((c, i) => {
    const a0 = (24 + i * 9) * (Math.PI / 180), a1 = (24 + (i + 1) * 9) * (Math.PI / 180);
    const len = 360;
    return <polygon key={c} points={pts([exit, [exit[0] + Math.cos(a0) * len, exit[1] + Math.sin(a0) * len], [exit[0] + Math.cos(a1) * len, exit[1] + Math.sin(a1) * len]])} fill={c} opacity={0.34} />;
  });
  const net: ReactNode[] = [];
  for (let x = 0; x <= W; x += 12) net.push(<line key={`v${x}`} x1={x} y1={150} x2={x} y2={horizon} />);
  for (let y = 150; y <= horizon; y += 10) net.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} />);
  const lines: ReactNode[] = [];
  for (let x = -480; x <= 960; x += 80) lines.push(<line key={x} x1={240} y1={horizon} x2={x} y2={H} />);
  const ball = (x: number, y: number, dx: number, dy: number, color: string, key: string) => (
    <g key={key}>
      <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.35} />
      <line x1={x + dx * 0.4} y1={y + dy * 0.4} x2={x + dx} y2={y + dy} stroke="#ffffff" strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
      <circle cx={x} cy={y} r={6} fill={color} />
      <circle cx={x - 2} cy={y - 2} r={2} fill="#ffffff" opacity={0.8} />
    </g>
  );
  return (
    <>
      <Sky k={k} stops={[[0, "#02040c"], [0.45, "#081631"], [0.585, "#143766"], [0.59, "#0a1a2e"], [1, "#04080f"]]} />
      <defs>
        {vgrad(k("turf"), [[0, "#0f3f3c"], [1, "#04140f"]])}
        {hgrad(k("beamIn"), [[0, "#ffffff", 0.1], [1, "#ffffff", 0.9]])}
        {vgrad(k("glass"), [[0, "#ffffff", 0.5], [0.6, "#bff4ff", 0.18], [1, "#6fd3ff", 0.28]])}
        {vgrad(k("dorito"), [[0, "#7ff0ff"], [0.5, "#26b6e8"], [1, "#145aa8"]])}
        {hgrad(k("can"), [[0, "#7a0f68"], [0.35, "#ff5fd8"], [0.6, "#ff9aec"], [1, "#8c1478"]])}
        {vgrad(k("snake"), [[0, "#ffe680"], [1, "#e09a14"]])}
      </defs>
      <Stars seed={1601} n={30} y1={120} />
      {[64, 416].map((x) => (
        <g key={x}>
          <line x1={x} y1={40} x2={x} y2={horizon} stroke="#0c1424" strokeWidth={5} />
          <Rays k={k} name={`stadium${x}`} cx={x} cy={30} n={7} spread={60} len={320} color="#eaf4ff" opacity={0.14} seed={x} angle={x < 240 ? 60 : 120} width={0.05} />
          <rect x={x - 24} y={18} width={48} height={22} rx={4} fill="#eef6ff" />
          <Glow k={k} name={`lamp${x}`} cx={x} cy={29} r={80} color="#dbe9ff" opacity={0.55} core={0.1} />
        </g>
      ))}
      <g stroke="#a9c6ee" strokeWidth={0.8} opacity={0.14}>{net}</g>
      <rect x={0} y={horizon} width={W} height={H - horizon} fill={url(k, "turf")} />
      <g stroke="#ffffff" strokeWidth={1} opacity={0.07}>{lines}</g>
      <GlowEllipse k={k} name="field" cx={240} cy={290} rx={260} ry={60} color="#3ee6ff" opacity={0.14} />
      {/* lamp light into the crystal, paint colours out */}
      <polygon points={pts([[60, 34], [72, 26], [204, 98], [196, 110]])} fill={url(k, "beamIn")} />
      {fan}
      <Glow k={k} name="prismGlow" cx={236} cy={100} r={96} color="#cdf6ff" opacity={0.42} />
      <polygon points={pts([B, C, C2, B2])} fill="#5fb8e8" opacity={0.55} />
      <polygon points={pts([A, C, C2, A2])} fill={url(k, "glass")} />
      <polygon points={pts([A, B, C])} fill="#e9fbff" opacity={0.55} />
      <g fill="none" stroke="#ffffff" strokeLinejoin="round" strokeLinecap="round">
        <polygon points={pts([A, B, C])} strokeWidth={2} />
        <polyline points={pts([A, A2, C2, C])} strokeWidth={1.8} opacity={0.9} />
        <polyline points={pts([B, B2, C2])} strokeWidth={1.2} opacity={0.45} />
        <path d={`M${A[0] - 4},${A[1] + 14} L${B[0] + 8},${B[1] - 8}`} strokeWidth={2.4} opacity={0.7} />
      </g>
      {/* bunkers */}
      <g>
        <ellipse cx={240} cy={252} rx={84} ry={8} fill="#000" opacity={0.4} />
        <rect x={160} y={222} width={160} height={28} rx={14} fill={url(k, "snake")} />
        <rect x={168} y={226} width={144} height={5} rx={2.5} fill="#fff6c8" opacity={0.6} />
        <Splat x={196} y={236} r={7} color="#3ee6ff" seed={1611} />
        <Splat x={292} y={232} r={6} color="#ff4fd8" seed={1612} />
      </g>
      <g>
        <ellipse cx={346} cy={300} rx={44} ry={9} fill="#000" opacity={0.45} />
        <rect x={312} y={196} width={68} height={104} rx={30} fill={url(k, "can")} />
        <ellipse cx={346} cy={206} rx={26} ry={7} fill="#ffc2f4" opacity={0.6} />
        <Splat x={338} y={244} r={13} color="#ffe14d" seed={1613} />
      </g>
      <g>
        <ellipse cx={138} cy={304} rx={62} ry={10} fill="#000" opacity={0.45} />
        <path d="M78,302 L198,302 L142,190 Z" fill={url(k, "dorito")} />
        <path d="M198,302 L214,292 L150,192 L142,190 Z" fill="#0e3f7a" />
        <path d="M142,196 L138,300" stroke="#ffffff" strokeWidth={1.4} opacity={0.35} />
        <Splat x={128} y={262} r={14} color="#ff4fd8" seed={1614} />
      </g>
      {ball(420, 152, 46, -16, "#ff4fd8", "b1")}
      {ball(286, 176, 54, -6, "#ffe14d", "b2")}
      {ball(196, 150, -40, -14, "#3ee6ff", "b3")}
      <Splat x={268} y={322} r={22} color="#3ee6ff" seed={1615} flat={0.34} />
      <Splat x={60} y={348} r={18} color="#ffe14d" seed={1616} flat={0.34} />
      <Splat x={420} y={352} r={20} color="#ff4fd8" seed={1617} flat={0.34} />
      <Motes seed={1618} n={24} y0={60} y1={300} color="#ff9aec" size={1.2} opacity={0.6} />
      <Motes seed={1619} n={24} y0={60} y1={300} color="#9ff3ff" size={1.2} opacity={0.6} />
      <Vignette k={k} strength={0.6} />
    </>
  );
}

// ─── SKYBOUND SPRINT ─────────────────────────────────────────────────────────
function skyboundSprint(k: Ids) {
  const island = (cx: number, cy: number, rx: number, key: string, depth = 1.1) => (
    <g key={key}>
      <path d={`M${cx - rx},${cy} C${cx - rx * 0.8},${cy + rx * 0.55} ${cx - rx * 0.3},${cy + rx * depth} ${cx + rx * 0.08},${cy + rx * (depth + 0.18)} C${cx + rx * 0.45},${cy + rx * depth * 0.9} ${cx + rx * 0.85},${cy + rx * 0.5} ${cx + rx},${cy} Z`} fill={url(k, "rock")} />
      <path d={`M${cx - rx * 0.7},${cy + rx * 0.3} Q${cx},${cy + rx * 0.42} ${cx + rx * 0.72},${cy + rx * 0.28}`} stroke="#ffffff" strokeOpacity={0.12} strokeWidth={2} fill="none" />
      <path d={`M${cx - rx * 0.4},${cy + rx * 0.62} Q${cx + rx * 0.05},${cy + rx * 0.72} ${cx + rx * 0.42},${cy + rx * 0.58}`} stroke="#000000" strokeOpacity={0.18} strokeWidth={2} fill="none" />
      <ellipse cx={cx} cy={cy + rx * 0.05} rx={rx} ry={rx * 0.26} fill="#2f8a57" />
      <ellipse cx={cx} cy={cy - rx * 0.02} rx={rx * 0.98} ry={rx * 0.22} fill={url(k, "grass")} />
      <path d={`M${cx - rx * 0.6},${cy + rx * 0.2} q-4,${rx * 0.3} 2,${rx * 0.55} M${cx + rx * 0.5},${cy + rx * 0.2} q5,${rx * 0.25} -1,${rx * 0.5}`} stroke="#3fae6a" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8} />
    </g>
  );
  const shard = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx={0} cy={0} r={16} fill="#ffd36b" opacity={0.25} />
      <path d="M0,-12 L7,0 L0,12 L-7,0 Z" fill="#ffd36b" />
      <path d="M0,-12 L2.4,0 L0,12 L-2.4,0 Z" fill="#fffbe6" opacity={0.8} />
    </g>
  );
  const cloudBand = (y: number, color: string, seed: number, key: string) => {
    const rr = rng(seed);
    const puffs: ReactNode[] = [];
    for (let x = -40; x < W + 60; x += 34 + rr() * 26) puffs.push(<circle key={x} cx={x} cy={y + rr() * 14} r={30 + rr() * 30} />);
    return <g key={key} fill={color}>{puffs}<rect x={-20} y={y + 10} width={W + 40} height={H} /></g>;
  };
  return (
    <>
      <Sky k={k} stops={[[0, "#110a2e"], [0.3, "#2e1e72"], [0.55, "#8a4fc0"], [0.68, "#e79ac8"], [0.76, "#ffd6e4"], [1, "#b9a6ea"]]} />
      <defs>
        {vgrad(k("rock"), [[0, "#7a5aa0"], [0.5, "#4a3270"], [1, "#22163a"]])}
        {vgrad(k("grass"), [[0, "#b8ffc8"], [1, "#4cc27a"]])}
        {hgrad(k("spire"), [[0, "#a99ad0"], [0.45, "#fbf6ff"], [1, "#b8a8e0"]])}
        {vgrad(k("storm"), [[0, "#3a2c5c"], [1, "#1a1230"]])}
      </defs>
      <Stars seed={1701} n={40} y1={150} />
      <Glow k={k} name="sun" cx={240} cy={300} r={240} color="#ffc2d9" opacity={0.55} />
      {/* the Storm King's cloud */}
      <g fill={url(k, "storm")}>
        {[[392, 54, 34], [428, 44, 40], [462, 60, 36], [366, 70, 24], [414, 74, 30], [448, 84, 28], [484, 76, 30]].map(([x, y, rad], i) => <circle key={i} cx={x} cy={y} r={rad} />)}
      </g>
      <path d="M414,26 L420,12 L428,22 L436,8 L444,22 L452,12 L458,26 Z" fill="#1a1230" />
      <circle cx={430} cy={50} r={3} fill="#ffe066" />
      <circle cx={444} cy={50} r={3} fill="#ffe066" />
      <path d="M396,88 L384,116 L396,114 L380,150 L406,108 L394,110 L404,88 Z" fill="#fff6b0" />
      <Glow k={k} name="bolt" cx={392} cy={118} r={46} color="#fff2a0" opacity={0.5} />
      {/* wind */}
      <g fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.35}>
        <path d="M40,150 C80,128 120,160 162,140 C176,133 178,122 170,118" />
        <path d="M300,262 C340,244 380,270 430,252" />
        <path d="M70,232 C100,220 126,238 150,228" />
      </g>
      {island(108, 118, 44, "left", 0.9)}
      <g>
        <ellipse cx={100} cy={102} rx={12} ry={14} fill="#2f8a57" />
        <rect x={98.5} y={108} width={3} height={10} fill="#5a3a2a" />
      </g>
      {island(380, 206, 50, "right")}
      {[[170, 152, 16], [212, 132, 0], [318, 198, 14], [302, 150, 10]].filter(([, , rx]) => rx > 0).map(([x, y, rx], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y + 3} rx={rx} ry={rx * 0.32} fill="#4a3270" />
          <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.28} fill="#7ee0a0" />
        </g>
      ))}
      {island(240, 184, 94, "main", 1.05)}
      {/* the spire and its Star Shard */}
      <polygon points={pts([[228, 182], [233, 72], [247, 72], [252, 182]])} fill={url(k, "spire")} />
      {[96, 122, 150].map((y) => <rect key={y} x={231} y={y} width={18} height={3} fill="#8f80bd" opacity={0.6} />)}
      <polygon points={pts([[226, 74], [240, 58], [254, 74]])} fill="#7b6bb0" />
      <Glow k={k} name="shardGlow" cx={240} cy={40} r={60} color="#ffd36b" opacity={0.75} core={0.06} />
      <path d="M240,22 L251,40 L240,58 L229,40 Z" fill="#ffd36b" />
      <path d="M240,22 L244,40 L240,58 L236,40 Z" fill="#fffbe6" opacity={0.85} />
      {shard(150, 72, 0.9, "s1")}
      {shard(334, 116, 0.75, "s2")}
      {shard(192, 230, 0.7, "s3")}
      {shard(428, 160, 0.6, "s4")}
      {cloudBand(282, "#d9c6f5", 1703, "c1")}
      {cloudBand(306, "#ecdcfc", 1704, "c2")}
      {cloudBand(338, "#f8efff", 1705, "c3")}
      <Motes seed={1706} n={30} y0={20} y1={260} color="#ffffff" size={1.1} opacity={0.7} />
      <Vignette k={k} strength={0.45} color="#140a2e" />
    </>
  );
}

// ─── AURORA RACERS ───────────────────────────────────────────────────────────
function auroraRacers(k: Ids) {
  const horizon = 196;
  const curtain = (name: string, color: string, base: number, amp: number, freq: number, phase: number, height: number, opacity: number, seed: number) => {
    const top: Pt[] = [];
    for (let x = -20; x <= W + 20; x += 10) top.push([x, base + amp * Math.sin(x * freq + phase) + amp * 0.45 * Math.sin(x * freq * 2.3 + phase * 1.7)]);
    const bottom = top.map(([x, y]) => [x, y + height] as Pt).reverse();
    const rr = rng(seed);
    const rays = top.filter((_, i) => i % 2 === 0).map(([x, y], i) => <line key={i} x1={x} y1={y + 2} x2={x + 2} y2={y + height * (0.25 + rr() * 0.35)} stroke={color} strokeWidth={2 + rr() * 3} strokeLinecap="round" opacity={0.08 + rr() * 0.16} />);
    return (
      <g key={name}>
        <defs>{vgrad(k(name), [[0, color, opacity], [0.4, color, opacity * 0.45], [1, color, 0]])}</defs>
        <polygon points={pts([...top, ...bottom])} fill={url(k, name)} />
        {rays}
      </g>
    );
  };
  // The track: a centre line that sweeps away to the horizon, narrowing with distance.
  const centre = bezier([300, 430], [40, 310], [430, 250], [262, horizon + 2], 44);
  const width = (i: number) => lerp(420, 6, Math.pow(i / 44, 0.7));
  const left = centre.map(([x, y], i) => [x - width(i) / 2, y] as Pt);
  const right = centre.map(([x, y], i) => [x + width(i) / 2, y] as Pt);
  const curbs: ReactNode[] = [];
  for (let i = 0; i < centre.length - 1; i++) {
    for (const [edge, dir] of [[left, -1], [right, 1]] as const) {
      const a = edge[i], b = edge[i + 1];
      const wa = width(i) * 0.06 * dir, wb = width(i + 1) * 0.06 * dir;
      curbs.push(<polygon key={`${dir}-${i}`} points={pts([a, b, [b[0] + wb, b[1]], [a[0] + wa, a[1]]])} fill={i % 2 ? "#ff4d5e" : "#f2f5ff"} />);
    }
  }
  const trail = (offset: number, end: number, color: string, key: string) => {
    const segs: ReactNode[] = [];
    for (let i = 0; i < end; i++) {
      const [x0, y0] = centre[i], [x1, y1] = centre[i + 1];
      const w0 = width(i), w1 = width(i + 1);
      const fade = 0.25 + (i / end) * 0.75;
      segs.push(<line key={`g${i}`} x1={x0 + offset * w0} y1={y0} x2={x1 + offset * w1} y2={y1} stroke={color} strokeWidth={Math.max(1, w0 * 0.05)} strokeLinecap="round" opacity={0.22 * fade} />);
      segs.push(<line key={`c${i}`} x1={x0 + offset * w0} y1={y0} x2={x1 + offset * w1} y2={y1} stroke="#ffffff" strokeWidth={Math.max(0.6, w0 * 0.012)} strokeLinecap="round" opacity={0.85 * fade} />);
    }
    return <g key={key}>{segs}</g>;
  };
  const kart = (i: number, offset: number, body: string, key: string) => {
    const [x, y] = centre[i];
    const s = width(i) / 118;
    const cx = x + offset * width(i);
    return (
      <g key={key} transform={`translate(${cx.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`}>
        <ellipse cx={0} cy={2} rx={20} ry={4} fill="#000" opacity={0.5} />
        <rect x={-18} y={-12} width={9} height={13} rx={3} fill="#0b0e14" />
        <rect x={9} y={-12} width={9} height={13} rx={3} fill="#0b0e14" />
        <path d="M-12,-6 L12,-6 L9,-16 L-9,-16 Z" fill={body} />
        <circle cx={0} cy={-21} r={6} fill="#f2f5ff" />
        <rect x={-14} y={-20} width={28} height={3} rx={1.5} fill="#1a1f2b" />
        <circle cx={-8} cy={-8} r={2} fill="#ff3b4a" />
        <circle cx={8} cy={-8} r={2} fill="#ff3b4a" />
      </g>
    );
  };
  return (
    <>
      <Sky k={k} stops={[[0, "#01040c"], [0.35, "#03122a"], [0.49, "#0a2d40"], [0.492, "#0c1c2a"], [1, "#04090f"]]} />
      <defs>
        {vgrad(k("road"), [[0, "#0f1622"], [1, "#1c2433"]])}
        {vgrad(k("snow"), [[0, "#1c3448"], [1, "#081320"]])}
        {rgrad(k("postGlow"), [[0, "#cfeeff", 0.55], [1, "#cfeeff", 0]])}
      </defs>
      <Stars seed={1801} n={70} y1={200} />
      <Glow k={k} name="auroraGlow" cx={240} cy={90} r={260} color="#3dffb0" opacity={0.16} />
      {curtain("aurA", "#5dffb0", 86, 24, 0.018, 0.6, 120, 0.7, 1803)}
      {curtain("aurB", "#47d6ff", 50, 18, 0.024, 2.1, 90, 0.5, 1804)}
      {curtain("aurC", "#d06bff", 26, 12, 0.03, 4.0, 70, 0.32, 1805)}
      <Ridge seed={1806} y={196} amp={30} step={20} color="#6f8aa8" opacity={0.45} peaks={[[140, 46], [356, 62]]} />
      <Ridge seed={1807} y={198} amp={14} step={18} color="#0a1826" />
      <rect x={0} y={horizon} width={W} height={H - horizon} fill={url(k, "snow")} />
      <polygon points={pts([...left, ...right.slice().reverse()])} fill={url(k, "road")} />
      {curbs}
      {centre.slice(0, -1).map(([x, y], i) => (i % 3 === 0 ? <line key={`d${i}`} x1={x} y1={y} x2={centre[i + 1][0]} y2={centre[i + 1][1]} stroke="#e8eef8" strokeWidth={Math.max(0.6, width(i) * 0.012)} opacity={0.5} /> : null))}
      {trail(-0.18, 25, "#ff3b6b", "t1")}
      {trail(0.2, 33, "#3ee6ff", "t2")}
      {kart(25, -0.18, "#ff4d5e", "k1")}
      {kart(33, 0.2, "#3ee6ff", "k2")}
      {[0.06, 0.18, 0.3, 0.44, 0.6, 0.76].map((t, i) => {
        const j = Math.round(t * 44);
        const [x, y] = right[j];
        const s = width(j) / 420;
        const lx = x + 34 * s, ly = y - 70 * s;
        return (
          <g key={`p${i}`}>
            <line x1={lx} y1={y} x2={lx} y2={ly} stroke="#020509" strokeWidth={Math.max(1, 4 * s)} />
            <circle cx={lx} cy={ly} r={Math.max(5, 34 * s)} fill={url(k, "postGlow")} />
            <circle cx={lx} cy={ly} r={Math.max(1, 4.5 * s)} fill="#f2fbff" />
          </g>
        );
      })}
      <Motes seed={1808} n={40} y0={0} y1={400} color="#ffffff" size={1} opacity={0.6} />
      <Vignette k={k} strength={0.6} />
    </>
  );
}


// ─── HAVEN CITY ──────────────────────────────────────────────────────────────
function havenCity(k: Ids) {
  const horizon = 214;
  const P = perspective(240, horizon, 46);
  const r = rng(2201);
  const towers: ReactNode[] = [];
  // towers line both sides of the avenue, far ones first
  for (const s of [-1, 1]) {
    let z = 0.3;
    const list: ReactNode[] = [];
    for (let i = 0; i < 9; i++) {
      const grow = Math.pow(1.42, i);
      const z0 = z, z1 = z + 0.28 * grow; z = z1 + 0.06 * grow;
      const side = 78 * s, h = 120 + r() * 160;
      const at = (u: number, up: number) => P(side, up, lerp(z0, z1, u));
      const face = pts([at(0, 0), at(1, 0), at(1, h), at(0, h)]);
      const wins: ReactNode[] = [];
      for (let row = 0; row < 9; row++) for (let col = 0; col < 3; col++) {
        if (r() < 0.45) continue;
        const u0 = 0.12 + col * 0.28, v0 = 14 + row * (h - 24) / 9;
        wins.push(<polygon key={`${row}-${col}`} points={pts([at(u0, v0 + 9), at(u0 + 0.16, v0 + 9), at(u0 + 0.16, v0), at(u0, v0)])} fill={r() < 0.25 ? "#9fdcff" : "#ffd27a"} opacity={0.85} />);
      }
      list.push(<g key={`${s}-${i}`}><polygon points={face} fill={i % 2 ? "#2a2550" : "#332a5e"} />{wins}</g>);
    }
    towers.push(...list.reverse());
  }
  // the cinema marquee on the right, near the viewer
  const m = [P(76, 64, 1.05), P(76, 64, 1.7), P(76, 40, 1.7), P(76, 40, 1.05)];
  const bulbs: ReactNode[] = [];
  for (let i = 0; i <= 10; i++) { const [x, y] = P(76, 66, lerp(1.05, 1.7, i / 10)); bulbs.push(<circle key={i} cx={x} cy={y} r={2.2} fill="#ffe7a0" />); }
  const dashes: ReactNode[] = [];
  for (const z of [0.42, 0.62, 0.9, 1.3, 1.9, 2.8, 4.1, 6]) dashes.push(<polygon key={z} points={pts([P(-1.6, 0, z), P(1.6, 0, z), P(1.6, 0, z * 1.2), P(-1.6, 0, z * 1.2)])} fill="#ffd56b" opacity={0.8} />);
  const trail = (off: number, color: string, key: string) => {
    const a = P(off, 4, 0.36), b = P(off, 4, 6);
    return <g key={key}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={9} opacity={0.25} strokeLinecap="round" /><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={2} opacity={0.75} strokeLinecap="round" /></g>;
  };
  return (
    <>
      <Sky k={k} stops={[[0, "#0a0c2e"], [0.3, "#2a2468"], [0.47, "#8a3f86"], [0.53, "#ff8a6b"], [0.535, "#1b1530"], [1, "#0e0b1a"]]} />
      <Stars seed={2202} n={40} y1={150} />
      <Glow k={k} name="sun" cx={240} cy={214} r={150} color="#ff7ab0" opacity={0.6} />
      <rect x={0} y={horizon} width={W} height={H - horizon} fill="#15121f" />
      <polygon points={pts([P(-56, 0, 0.2), P(56, 0, 0.2), P(56, 0, 60), P(-56, 0, 60)])} fill="#24212f" />
      <polygon points={pts([P(-78, 0, 0.2), P(-56, 0, 0.2), P(-56, 0, 60), P(-78, 0, 60)])} fill="#3a3448" />
      <polygon points={pts([P(56, 0, 0.2), P(78, 0, 0.2), P(78, 0, 60), P(56, 0, 60)])} fill="#3a3448" />
      {dashes}
      {towers}
      {trail(-22, "#3ee6ff", "t1")}
      {trail(24, "#ff4f8b", "t2")}
      <polygon points={pts(m)} fill="#1a0610" stroke="#ffd36b" strokeWidth={2} />
      {bulbs}
      <Glow k={k} name="marquee" cx={(m[0][0] + m[2][0]) / 2} cy={(m[0][1] + m[2][1]) / 2} r={70} color="#ffb347" opacity={0.35} />
      {/* a car rolling toward us with its headlights on */}
      <g transform="translate(240 236)">
        <ellipse cx={0} cy={30} rx={70} ry={10} fill="#000" opacity={0.5} />
        <path d="M-58,24 L-54,-2 Q-50,-14 -36,-16 L-26,-40 Q-22,-48 -12,-48 L12,-48 Q22,-48 26,-40 L36,-16 Q50,-14 54,-2 L58,24 Z" fill="#2fd1c0" />
        <path d="M-22,-40 L22,-40 L30,-18 L-30,-18 Z" fill="#163a4a" />
        <rect x={-58} y={10} width={116} height={14} rx={5} fill="#1b2230" />
        <rect x={-56} y={24} width={18} height={14} rx={4} fill="#0b0e14" />
        <rect x={38} y={24} width={18} height={14} rx={4} fill="#0b0e14" />
        <circle cx={-40} cy={2} r={7} fill="#fff8d6" />
        <circle cx={40} cy={2} r={7} fill="#fff8d6" />
      </g>
      <Glow k={k} name="hlL" cx={200} cy={238} r={40} color="#fff2c4" opacity={0.75} core={0.1} />
      <Glow k={k} name="hlR" cx={280} cy={238} r={40} color="#fff2c4" opacity={0.75} core={0.1} />
      <Motes seed={2203} n={30} y0={60} y1={300} color="#ffd8f0" size={1.1} opacity={0.6} />
      <Vignette k={k} strength={0.6} />
    </>
  );
}

// ─── STUDY SQUAD ─────────────────────────────────────────────────────────────
// A chalkboard under a study lamp, and a hand of four answer cards fanned out
// over a wooden table: the colours and shapes readers tap in every study game.
function studySquad(k: Ids) {
  const cards: [number, string, ReactNode][] = [
    [-30, "#ff6b5e", <path d="M0,-13 L13,10 L-13,10 Z" />],
    [-10, "#7cc6fe", <path d="M0,-14 L13,0 L0,14 L-13,0 Z" />],
    [10, "#ffc53d", <circle r={12} />],
    [30, "#7be495", <rect x={-11} y={-11} width={22} height={22} rx={2} />],
  ];
  const books: [number, number, number, string][] = [[84, 262, 92, "#7c3aed"], [90, 246, 80, "#0891b2"], [86, 231, 86, "#e2574c"]];
  return (
    <>
      <Sky k={k} stops={[[0, "#081a16"], [0.62, "#143229"], [1, "#0a1713"]]} />
      <defs>
        {vgrad(k("board"), [[0, "#286152"], [1, "#173b33"]])}
        {vgrad(k("frame"), [[0, "#c58a4a"], [1, "#6b3f20"]])}
        {rgrad(k("table"), [[0, "#e0a868"], [0.55, "#a8672f"], [1, "#4f2c14"]], 0.5, 0.05, 0.95)}
        {vgrad(k("cone"), [[0, "#ffe9a8", 0.36], [1, "#ffe9a8", 0]])}
        {vgrad(k("shade"), [[0, "#1f6b57"], [1, "#0f3b30"]])}
      </defs>
      {/* the chalkboard */}
      <rect x={50} y={24} width={380} height={184} rx={9} fill={url(k, "frame")} />
      <rect x={61} y={35} width={358} height={162} rx={3} fill={url(k, "board")} />
      <g stroke="#f4f1e6" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.78}>
        <path d="M108,56 L92,92 L110,92 L96,128" />
        <path d="M338,150 L360,112 L372,130 L386,104 L404,150" />
        <path d="M386,104 L386,86 L400,92 L386,97" />
        <path d="M344,62 L352,72 L370,50" />
        <path d="M128,150 L128,168 M119,159 L137,159" />
        <path d="M148,150 L164,168 M164,150 L148,168" />
        <circle cx={186} cy={159} r={9} />
        <path d="M96,178 L180,178" strokeDasharray="2 9" />
      </g>
      <g fill="#f4f1e6" opacity={0.7}>
        {[[300, 64], [318, 150], [136, 70]].map(([x, y], i) => <path key={i} d={`M${x},${y - 9} L${x + 3},${y - 3} L${x + 9},${y - 2} L${x + 4},${y + 3} L${x + 6},${y + 9} L${x},${y + 5} L${x - 6},${y + 9} L${x - 4},${y + 3} L${x - 9},${y - 2} L${x - 3},${y - 3} Z`} />)}
      </g>
      <rect x={58} y={197} width={364} height={9} rx={2} fill="#8a5a2b" />
      <rect x={300} y={192} width={30} height={6} rx={2} fill="#f4f1e6" />
      <rect x={338} y={190} width={34} height={9} rx={2} fill="#ff8fa3" />
      {/* the study lamp */}
      <rect x={238} y={-4} width={4} height={30} fill="#0c1512" />
      <polygon points={pts([[218, 30], [262, 30], [336, 300], [144, 300]])} fill={url(k, "cone")} />
      <path d="M214,34 L224,14 L256,14 L266,34 Z" fill={url(k, "shade")} />
      <ellipse cx={240} cy={34} rx={26} ry={5} fill="#fff2c4" />
      <Glow k={k} name="lamp" cx={240} cy={150} r={210} color="#ffd98a" opacity={0.26} />
      {/* the table */}
      <ellipse cx={240} cy={382} rx={330} ry={128} fill={url(k, "table")} />
      <ellipse cx={240} cy={380} rx={330} ry={128} fill="none" stroke="#f0c48c" strokeOpacity={0.35} strokeWidth={2} />
      {books.map(([x, y, w, color], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={15} rx={2} fill={color} />
          <rect x={x + 5} y={y + 3} width={w - 10} height={9} rx={1} fill="#f8f1dc" />
          <rect x={x} y={y} width={9} height={15} rx={2} fill={color} />
        </g>
      ))}
      <g transform="translate(352 268) rotate(-16)">
        <rect x={0} y={-5} width={74} height={10} fill="#ffc53d" />
        <rect x={0} y={-5} width={74} height={3} fill="#ffe08a" />
        <rect x={-12} y={-5} width={12} height={10} rx={3} fill="#ff8fa3" />
        <path d="M74,-5 L90,0 L74,5 Z" fill="#e9cfa3" />
        <path d="M84,-2 L90,0 L84,2 Z" fill="#2b2b2b" />
      </g>
      {/* the hand of answer cards */}
      <GlowEllipse k={k} name="cardsGlow" cx={240} cy={214} rx={170} ry={90} color="#fff2c4" opacity={0.28} />
      {cards.map(([angle, color, shape], i) => (
        <g key={i} transform={`translate(240 352) rotate(${angle})`}>
          <rect x={-39} y={-210} width={78} height={112} rx={9} fill="#06110e" opacity={0.35} transform="translate(4 5)" />
          <rect x={-39} y={-210} width={78} height={112} rx={9} fill={color} />
          <rect x={-39} y={-210} width={78} height={40} rx={9} fill="#ffffff" opacity={0.16} />
          <g transform="translate(0 -160)" fill="#11231f" opacity={0.82}>{shape}</g>
          <rect x={-22} y={-128} width={44} height={6} rx={3} fill="#11231f" opacity={0.3} />
          <rect x={-15} y={-116} width={30} height={6} rx={3} fill="#11231f" opacity={0.2} />
        </g>
      ))}
      <Motes seed={3101} n={26} y0={40} y1={280} color="#fff2c4" size={1.2} opacity={0.5} />
      <Vignette k={k} strength={0.62} />
    </>
  );
}

// ─── TWINLIGHT RUN ───────────────────────────────────────────────────────────
// One sky road seen in two worlds at once: day on the left, night on the right,
// with the runner on the seam between them.
function twinlightRun(k: Ids) {
  const P = perspective(240, 170, 150);
  const strip = (s0: number, s1: number, z0: number, z1: number) => pts([P(s0, 0, z0), P(s1, 0, z0), P(s1, 0, z1), P(s0, 0, z1)]);
  const rail = (side: number) => (
    <g key={side}>
      <polygon points={strip(side * 138, side * 150, 0.55, 10)} fill="#a02a30" />
      <polyline points={pts([P(side * 146, 50, 0.55), P(side * 146, 50, 10)])} stroke="#e8483a" strokeWidth={3} fill="none" />
      {[0.8, 1.15, 1.7, 2.6, 4, 6.5].map((z) => {
        const a = P(side * 146, 0, z), b = P(side * 146, 66, z);
        return <line key={z} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#e8483a" strokeWidth={Math.max(1.2, 7 / z)} strokeLinecap="round" />;
      })}
    </g>
  );
  const island = (cx: number, cy: number, rx: number, rock: string, top: string) => (
    <g>
      <path d={`M${cx - rx},${cy} C${cx - rx * 0.7},${cy + rx * 0.7} ${cx - rx * 0.2},${cy + rx * 1.1} ${cx + rx * 0.1},${cy + rx * 1.3} C${cx + rx * 0.5},${cy + rx} ${cx + rx * 0.85},${cy + rx * 0.5} ${cx + rx},${cy} Z`} fill={rock} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.24} fill={top} />
    </g>
  );
  const [gx0, gy0] = P(-129, 0, 3), [gx1, gy1] = P(129, 200, 3);
  const torii = { l: P(-178, 0, 2.2), r: P(178, 0, 2.2), top: P(0, 262, 2.2)[1], mid: P(0, 212, 2.2)[1] };
  // the runner, drawn from behind with the feet at (0, 0)
  const [rx, ry] = P(0, 0, 1.45);
  return (
    <>
      <Sky k={k} stops={[[0, "#2a78e4"], [0.42, "#bfe7ff"], [0.6, "#eaf6ff"], [1, "#cfe6ff"]]} />
      <defs>
        {vgrad(k("night"), [[0, "#060926"], [0.42, "#3b2f8c"], [0.6, "#24206a"], [1, "#15154a"]])}
        {vgrad(k("road"), [[0, "#b8a892"], [1, "#e3d6c2"]])}
        {vgrad(k("gold"), [[0, "#fff4b8"], [1, "#ffb13d"]])}
        {vgrad(k("shirt"), [[0, "#fffaf0"], [1, "#d9d2e6"]])}
      </defs>
      <rect x={240} y={0} width={240} height={H} fill={url(k, "night")} />
      {/* day side */}
      <Glow k={k} name="sun" cx={132} cy={104} r={120} color="#fff3b0" opacity={0.8} />
      <circle cx={132} cy={104} r={22} fill="#fffbe0" />
      <g fill="#ffffff">{[[40, 62, 22], [66, 52, 26], [96, 64, 20], [176, 40, 16], [198, 34, 20], [220, 44, 14]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>
      {island(56, 168, 46, "#8f7d6e", "#8fdc6f")}
      <rect x={52} y={140} width={5} height={28} fill="#7c5a44" />
      <g fill="#ff9fc8">{[[54, 132, 17], [40, 142, 12], [70, 140, 13]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>
      <g fill="#ffd1e3">{[[50, 126, 9], [66, 134, 7]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>
      {/* night side */}
      <Stars seed={2101} n={46} x0={246} y1={170} />
      <GlowEllipse k={k} name="aurora" cx={380} cy={130} rx={130} ry={40} color="#5dffb0" opacity={0.22} />
      <Glow k={k} name="moon" cx={368} cy={84} r={70} color="#cfd8ff" opacity={0.5} />
      <circle cx={368} cy={84} r={23} fill="#eef2ff" />
      <circle cx={378} cy={77} r={21} fill="#1a1b5e" />
      {island(430, 172, 44, "#232055", "#2f3f86")}
      <g fill="#2b2a70">
        <rect x={420} y={142} width={22} height={30} />
        <polygon points="410,144 452,144 431,128" />
        <polygon points="414,158 448,158 431,146" />
      </g>
      <g fill="#ffe9a8"><rect x={426} y={150} width={4} height={5} /><rect x={433} y={150} width={4} height={5} /><rect x={429} y={163} width={5} height={6} /></g>
      {/* the seam between the two worlds */}
      <Glow k={k} name="seam" cx={240} cy={90} r={110} color="#ffffff" opacity={0.28} />
      <line x1={240} y1={0} x2={240} y2={176} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.5} />
      {/* clouds under the road */}
      <g fill="#ffffff">{[[20, 300, 46], [70, 318, 40], [-6, 340, 50], [120, 344, 34]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>
      <g fill="#4a4fb0">{[[462, 300, 46], [412, 320, 40], [486, 340, 50], [364, 346, 34]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>
      {/* the road */}
      <polygon points={strip(-140, 140, 0.55, 10)} fill={url(k, "road")} />
      <polygon points={strip(0, 140, 0.55, 10)} fill="#2b2f86" opacity={0.6} />
      {[-43, 43].map((sd) => <polyline key={sd} points={pts([P(sd, 0, 0.55), P(sd, 0, 10)])} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={2} strokeDasharray="14 10" fill="none" />)}
      {rail(-1)}
      {rail(1)}
      {/* a wall across the road: solid gold by day, a ghost at night */}
      <rect x={gx0} y={gy1} width={240 - gx0} height={gy0 - gy1} fill={url(k, "gold")} stroke="#e07a12" strokeWidth={2} />
      <circle cx={(gx0 + 240) / 2} cy={(gy0 + gy1) / 2} r={9} fill="#ffffff" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2, cx = (gx0 + 240) / 2, cy = (gy0 + gy1) / 2; return <line key={i} x1={cx + Math.cos(a) * 13} y1={cy + Math.sin(a) * 13} x2={cx + Math.cos(a) * 18} y2={cy + Math.sin(a) * 18} stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" />; })}
      <rect x={240} y={gy1} width={gx1 - 240} height={gy0 - gy1} fill="#ffd66b" fillOpacity={0.14} stroke="#ffe9a8" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="5 4" />
      {/* the gate */}
      <g>
        <rect x={torii.l[0] - 6} y={torii.top} width={12} height={torii.l[1] - torii.top} fill="#e8483a" />
        <rect x={torii.r[0] - 6} y={torii.top} width={12} height={torii.r[1] - torii.top} fill="#c63a36" />
        <rect x={torii.l[0] - 22} y={torii.top - 2} width={torii.r[0] - torii.l[0] + 44} height={11} fill="#e8483a" />
        <rect x={torii.l[0] - 30} y={torii.top - 9} width={torii.r[0] - torii.l[0] + 60} height={7} fill="#33263d" />
        <rect x={torii.l[0] - 8} y={torii.mid} width={torii.r[0] - torii.l[0] + 16} height={7} fill="#d9423a" />
      </g>
      {/* orbs: suns by day, moons by night */}
      {[1.15, 1.6, 2.3].map((z) => { const [x, y] = P(-86, 62, z), s = 12 / z; return <g key={z}><circle cx={x} cy={y} r={s * 1.9} fill="#ffd66b" opacity={0.3} /><circle cx={x} cy={y} r={s} fill="#ffcf4d" /><circle cx={x - s * 0.3} cy={y - s * 0.3} r={s * 0.4} fill="#fffbe0" /></g>; })}
      {[1.15, 1.6, 2.3].map((z) => { const [x, y] = P(86, 62, z), s = 12 / z; return <g key={z}><circle cx={x} cy={y} r={s * 1.9} fill="#9a97ff" opacity={0.35} /><circle cx={x} cy={y} r={s} fill="#dfe3ff" /><ellipse cx={x} cy={y} rx={s * 1.7} ry={s * 0.5} fill="none" stroke="#c9c6ff" strokeWidth={1.4} /></g>; })}
      {/* the runner */}
      <g transform={`translate(${rx} ${ry})`}>
        <ellipse cx={0} cy={3} rx={27} ry={6} fill="#1b1436" opacity={0.3} />
        <path d="M-58,-97 C-34,-106 -22,-90 -4,-94 L-3,-86 C-22,-80 -36,-94 -56,-88 Z" fill="#ff4f5e" />
        <path d="M-46,-82 C-30,-88 -18,-80 -4,-86 L-4,-80 C-18,-74 -30,-80 -44,-76 Z" fill="#d93a52" />
        <g stroke="#2b3470" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M-6,-50 L-12,-28 L-8,-6" />
          <path d="M7,-50 L11,-32 L24,-24" />
        </g>
        <rect x={-14} y={-8} width={12} height={8} rx={3} fill="#ff7a3c" />
        <rect x={19} y={-28} width={12} height={8} rx={3} fill="#ff7a3c" transform="rotate(-30 25 -24)" />
        <path d="M-13,-52 L13,-52 L11,-90 L-11,-90 Z" fill={url(k, "shirt")} />
        <rect x={-13} y={-56} width={26} height={5} fill="#ff7a3c" />
        <g stroke="#fffaf0" strokeWidth={7} strokeLinecap="round" fill="none"><path d="M-11,-85 L-27,-62" /><path d="M11,-85 L28,-64" /></g>
        <circle cx={-28} cy={-60} r={4.5} fill="#ffdcc6" />
        <circle cx={29} cy={-62} r={4.5} fill="#ffdcc6" />
        <circle cx={0} cy={-102} r={14} fill="#ffdcc6" />
        <polygon points="-16,-100 -24,-114 -14,-111 -13,-127 -4,-116 2,-131 7,-116 16,-125 14,-111 24,-112 16,-99 12,-90 -12,-90" fill="#2d3a8c" />
        <polygon points="-9,-108 -4,-116 2,-124 5,-114 -2,-106" fill="#4a59b8" opacity={0.7} />
      </g>
      <Motes seed={2102} n={16} x0={250} x1={470} y0={150} y1={280} color="#c9ffb0" size={1.2} opacity={0.7} />
      <Vignette k={k} strength={0.42} color="#0d0a24" />
    </>
  );
}

// ─── CHIME OF AOREN ──────────────────────────────────────────────────────────
// Rin and Pip under the cracked Chime at sunset, with the Hushed closing in.
function chimeOfAoren(k: Ids) {
  const tree = (x: number, y: number, s: number) => (
    <g>
      <path d={`M${x - 4 * s},${y} L${x - 2 * s},${y - 34 * s} L${x + 3 * s},${y - 34 * s} L${x + 5 * s},${y} Z`} fill="#6d4c3d" />
      <g fill="#ff8fbe">{[[0, -52, 22], [-18, -40, 15], [18, -42, 16]].map(([dx, dy, r], i) => <circle key={i} cx={x + dx * s} cy={y + dy * s} r={r * s} />)}</g>
      <g fill="#ffd6e6">{[[-4, -58, 13], [12, -50, 9], [-16, -46, 8]].map(([dx, dy, r], i) => <circle key={i} cx={x + dx * s} cy={y + dy * s} r={r * s} />)}</g>
    </g>
  );
  const hushed = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0,-34 C16,-34 20,-18 16,-6 C12,6 4,14 0,24 C-4,14 -12,6 -16,-6 C-20,-18 -16,-34 0,-34 Z" fill={url(k, "hush")} />
      <path d="M-9,-34 L-6,-44 L-2,-34 Z M3,-34 L7,-44 L10,-34 Z" fill="#241a52" />
      <ellipse cx={0} cy={-16} rx={10} ry={12} fill="#f4f1ff" />
      <ellipse cx={-4} cy={-17} rx={2.2} ry={3.4} fill="#0d0a22" />
      <ellipse cx={4} cy={-17} rx={2.2} ry={3.4} fill="#0d0a22" />
      <circle cx={-21} cy={-8} r={5} fill="#2e2266" />
      <circle cx={21} cy={-10} r={5} fill="#2e2266" />
    </g>
  );
  return (
    <>
      <Sky k={k} stops={[[0, "#262a72"], [0.32, "#74479a"], [0.55, "#ee866a"], [0.68, "#ffc78a"], [1, "#ffe6b8"]]} />
      <defs>
        {hgrad(k("bell"), [[0, "#b9772f"], [0.3, "#f6cc74"], [0.55, "#fff0b8"], [0.75, "#f2b84b"], [1, "#a8661f"]])}
        {vgrad(k("ground"), [[0, "#d9a878"], [1, "#a8744e"]])}
        {vgrad(k("hush"), [[0, "#4a3a86"], [1, "#120e2e"]])}
        {hgrad(k("pillar"), [[0, "#f05a48"], [1, "#b02e33"]])}
      </defs>
      <Stars seed={2201} n={26} y1={110} />
      <Glow k={k} name="sun" cx={240} cy={206} r={210} color="#ffe2a8" opacity={0.75} />
      <Ridge seed={2202} y={236} amp={30} color="#9a5a8c" opacity={0.55} peaks={[[70, 40], [420, 34]]} />
      <Ridge seed={2203} y={248} amp={16} color="#7a4078" opacity={0.6} />
      <rect x={0} y={246} width={W} height={H - 246} fill={url(k, "ground")} />
      <ellipse cx={240} cy={300} rx={250} ry={62} fill="#e9c398" opacity={0.75} />
      <ellipse cx={240} cy={296} rx={150} ry={34} fill="#f3d6ac" opacity={0.7} />
      {tree(78, 250, 1.15)}
      {tree(408, 248, 1.05)}
      {/* the frame of the Chime */}
      <polygon points="118,36 362,36 334,16 146,16" fill="#4f74c8" />
      <rect x={126} y={34} width={228} height={9} fill="#33263d" />
      <rect x={138} y={43} width={204} height={13} fill="#e8483a" />
      <rect x={154} y={56} width={17} height={196} fill={url(k, "pillar")} />
      <rect x={309} y={56} width={17} height={196} fill={url(k, "pillar")} />
      <rect x={148} y={246} width={29} height={8} fill="#33263d" />
      <rect x={303} y={246} width={29} height={8} fill="#33263d" />
      {/* the Chime, cracked */}
      <rect x={236} y={56} width={8} height={14} fill="#33263d" />
      <path d="M198,104 C198,58 282,58 282,104 L300,178 C300,188 180,188 180,178 Z" fill={url(k, "bell")} />
      <ellipse cx={240} cy={180} rx={61} ry={9} fill="#a8661f" />
      <ellipse cx={240} cy={178} rx={57} ry={6.5} fill="#f6cc74" opacity={0.7} />
      <circle cx={240} cy={194} r={8} fill="#33263d" />
      <polyline points="246,74 234,98 250,116 236,140 248,162 240,176" fill="none" stroke="#c9a2ff" strokeOpacity={0.45} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points="246,74 234,98 250,116 236,140 248,162 240,176" fill="none" stroke="#7a3fe0" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <g fill="none" stroke="#ffffff" strokeLinecap="round">
        <path d="M168,96 C150,120 150,150 166,174" strokeOpacity={0.4} strokeWidth={2.5} />
        <path d="M312,96 C330,120 330,150 314,174" strokeOpacity={0.4} strokeWidth={2.5} />
        <path d="M146,84 C120,118 120,156 144,188" strokeOpacity={0.22} strokeWidth={2} />
        <path d="M334,84 C360,118 360,156 336,188" strokeOpacity={0.22} strokeWidth={2} />
      </g>
      {/* the Hushed */}
      {hushed(116, 236, 0.95, "h1")}
      {hushed(160, 262, 1.15, "h2")}
      {hushed(376, 244, 0.85, "h3")}
      {/* Rin, seen from behind, with her bell-mallet */}
      <g transform="translate(278 284)">
        <ellipse cx={2} cy={2} rx={24} ry={5.5} fill="#33263d" opacity={0.35} />
        <g stroke="#fff3e0" strokeWidth={6.5} strokeLinecap="round"><line x1={-5} y1={-30} x2={-5} y2={-5} /><line x1={6} y1={-30} x2={6} y2={-5} /></g>
        <rect x={-10} y={-7} width={10} height={7} rx={2} fill="#7a4a3a" />
        <rect x={1} y={-7} width={10} height={7} rx={2} fill="#7a4a3a" />
        <polygon points="-17,-28 18,-28 11,-48 -10,-48" fill="#2a3a6e" />
        <polygon points="-10,-48 11,-48 10,-70 -9,-70" fill="#fff3e0" />
        <rect x={-10} y={-51} width={21} height={4} fill="#22a99a" />
        <g stroke="#fff3e0" strokeWidth={6} strokeLinecap="round"><line x1={-9} y1={-66} x2={-15} y2={-47} /><line x1={10} y1={-66} x2={21} y2={-54} /></g>
        <line x1={22} y1={-98} x2={22} y2={-2} stroke="#8d6648" strokeWidth={3.2} strokeLinecap="round" />
        <polygon points="15,-98 29,-98 26,-111 18,-111" fill="#f2b84b" />
        <rect x={13} y={-99} width={18} height={3} fill="#b9772f" />
        <circle cx={0} cy={-82} r={12.5} fill="#ffdcc6" />
        <path d="M-14,-80 C-15,-98 15,-98 14,-80 C13,-72 8,-70 0,-70 C-8,-70 -13,-72 -14,-80 Z" fill="#f0647e" />
        <path d="M6,-88 C20,-86 24,-72 17,-58 C15,-66 12,-72 6,-76 Z" fill="#d94f6c" />
        <path d="M0,-94 C2,-104 8,-106 12,-102" fill="none" stroke="#f0647e" strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* Pip */}
      <Glow k={k} name="pip" cx={320} cy={186} r={26} color="#fff2b8" opacity={0.8} />
      <path d="M313,190 C313,178 327,178 327,190 L330,196 L310,196 Z" fill="#ffc24a" />
      <path d="M310,188 C304,184 302,188 306,192 Z M330,188 C336,184 338,188 334,192 Z" fill="#ffffff" />
      <circle cx={317} cy={189} r={1.5} fill="#3a2a20" />
      <circle cx={323} cy={189} r={1.5} fill="#3a2a20" />
      <Motes seed={2204} n={34} y0={20} y1={280} color="#ffd1e3" size={1.5} opacity={0.8} />
      <Vignette k={k} strength={0.5} color="#2a1030" />
    </>
  );
}

export const WORLD_SCENES: Record<string, Painter> = {
  study: studySquad,
  city: havenCity,
  club: neonArcade,
  chess: chessScene,
  neighborhood: havenHeights,
  theater: starlightCinema,
  board: boardQuest,
  halloread: midnightMystery,
  laser: prismPaintball,
  space: skyboundSprint,
  racetrack: auroraRacers,
  twinlight: twinlightRun,
  aoren: chimeOfAoren,
};
