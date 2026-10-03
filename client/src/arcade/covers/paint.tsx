// Small painting kit for the game cover art: skies, glows, ridges, fog, light
// rays and particles on a 480×400 canvas. Everything is plain SVG (no filters),
// so a whole shelf of covers stays fast.
import type { ReactNode } from "react";

export const W = 480;
export const H = 400;

/** Makes gradient ids unique per cover on the page. */
export type Ids = (name: string) => string;
export type Stop = [offset: number, color: string, opacity?: number];

/** Deterministic random numbers, so each cover always looks the same. */
export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const stopsOf = (stops: Stop[]) => stops.map(([o, c, op], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />);

export const vgrad = (id: string, stops: Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1) => (
  <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>{stopsOf(stops)}</linearGradient>
);
export const hgrad = (id: string, stops: Stop[]) => vgrad(id, stops, 0, 0, 1, 0);
export const rgrad = (id: string, stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx?: number, fy?: number) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx ?? cx} fy={fy ?? cy}>{stopsOf(stops)}</radialGradient>
);

/** Full-canvas vertical sky. */
export function Sky({ k, stops, name = "sky" }: { k: Ids; stops: Stop[]; name?: string }) {
  return (
    <>
      <defs>{vgrad(k(name), stops)}</defs>
      <rect width={W} height={H} fill={`url(#${k(name)})`} />
    </>
  );
}

/** Soft round light. */
export function Glow({ k, name, cx, cy, r, color, opacity = 1, core = 0 }: { k: Ids; name: string; cx: number; cy: number; r: number; color: string; opacity?: number; core?: number }) {
  return (
    <>
      <defs>{rgrad(k(name), [[0, color, opacity], [core, color, opacity * 0.85], [1, color, 0]])}</defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${k(name)})`} />
    </>
  );
}

/** Soft ellipse light (for floors and horizons). */
export function GlowEllipse({ k, name, cx, cy, rx, ry, color, opacity = 1 }: { k: Ids; name: string; cx: number; cy: number; rx: number; ry: number; color: string; opacity?: number }) {
  return (
    <>
      <defs>{rgrad(k(name), [[0, color, opacity], [1, color, 0]])}</defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${k(name)})`} />
    </>
  );
}

export function Stars({ seed, n, x0 = 0, x1 = W, y0 = 0, y1 = H * 0.6, color = "#ffffff", size = 1.4 }: { seed: number; n: number; x0?: number; x1?: number; y0?: number; y1?: number; color?: string; size?: number }) {
  const r = rng(seed);
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const big = r() > 0.92;
    out.push(<circle key={i} cx={x0 + r() * (x1 - x0)} cy={y0 + r() * r() * (y1 - y0)} r={(big ? 1.6 : 0.5 + r() * 0.8) * size} fill={color} opacity={big ? 0.95 : 0.25 + r() * 0.6} />);
  }
  return <g>{out}</g>;
}

/** A mountain or rock ridgeline filled down to the bottom of the canvas. */
export function Ridge({ seed, y, amp, step = 26, color, rough = 0.6, peaks, fill, opacity = 1 }: { seed: number; y: number; amp: number; step?: number; color: string; rough?: number; peaks?: [number, number][]; fill?: string; opacity?: number }) {
  const r = rng(seed);
  const pts: string[] = [];
  let h = y;
  for (let x = -20; x <= W + 20; x += step) {
    let target = y - r() * amp;
    if (peaks) for (const [px, ph] of peaks) target -= Math.max(0, ph * (1 - Math.abs(x - px) / (ph * 1.6)));
    h = h + (target - h) * rough;
    pts.push(`${x.toFixed(1)},${h.toFixed(1)}`);
  }
  return <path d={`M-20,${H + 2} L${pts.join(" L")} L${W + 20},${H + 2} Z`} fill={fill || color} opacity={opacity} />;
}

/** Horizontal band of mist. */
export function Fog({ k, name, y, h, color, opacity = 0.5 }: { k: Ids; name: string; y: number; h: number; color: string; opacity?: number }) {
  return (
    <>
      <defs>{vgrad(k(name), [[0, color, 0], [0.5, color, opacity], [1, color, 0]])}</defs>
      <rect x={-10} y={y} width={W + 20} height={h} fill={`url(#${k(name)})`} />
    </>
  );
}

/** Light rays fanning out from a point. */
export function Rays({ k, name, cx, cy, n, spread, len, color, opacity = 0.12, seed = 1, width = 0.05, angle = 90 }: { k: Ids; name: string; cx: number; cy: number; n: number; spread: number; len: number; color: string; opacity?: number; seed?: number; width?: number; angle?: number }) {
  const r = rng(seed);
  const rays: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((angle - spread / 2 + (spread * (i + 0.5)) / n + (r() - 0.5) * (spread / n) * 0.6) * Math.PI) / 180;
    const w = width * (0.5 + r());
    const l = len * (0.7 + r() * 0.3);
    const x1 = cx + Math.cos(a - w) * l, y1 = cy + Math.sin(a - w) * l;
    const x2 = cx + Math.cos(a + w) * l, y2 = cy + Math.sin(a + w) * l;
    rays.push(<path key={i} d={`M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} Z`} fill={`url(#${k(name)})`} opacity={0.5 + r() * 0.5} />);
  }
  return (
    <>
      <defs>
        <radialGradient id={k(name)} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={len}>
          <stop offset={0} stopColor={color} stopOpacity={opacity} />
          <stop offset={1} stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g>{rays}</g>
    </>
  );
}

/** Floating sparks, embers or dust. */
export function Motes({ seed, n, x0 = 0, x1 = W, y0 = 0, y1 = H, color, size = 1.6, opacity = 0.8 }: { seed: number; n: number; x0?: number; x1?: number; y0?: number; y1?: number; color: string; size?: number; opacity?: number }) {
  const r = rng(seed);
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const s = size * (0.4 + r() * 1.2);
    out.push(<circle key={i} cx={x0 + r() * (x1 - x0)} cy={y0 + r() * (y1 - y0)} r={s} fill={color} opacity={opacity * (0.3 + r() * 0.7)} />);
  }
  return <g>{out}</g>;
}

/** Darkens the edges like a camera lens. */
export function Vignette({ k, strength = 0.65, color = "#000" }: { k: Ids; strength?: number; color?: string }) {
  return (
    <>
      <defs>{rgrad(k("vig"), [[0.55, color, 0], [1, color, strength]], 0.5, 0.45, 0.75)}</defs>
      <rect width={W} height={H} fill={`url(#${k("vig")})`} />
    </>
  );
}

/** Quads of a floor in perspective, for checkerboards and grids. */
export function floorCells(opts: { vpX: number; horizon: number; bottom?: number; rows: number; colW: number; cols: [number, number]; curve?: number }) {
  const { vpX, horizon, rows, colW, cols } = opts;
  const bottom = opts.bottom ?? H;
  const curve = opts.curve ?? 2.2;
  const ys = Array.from({ length: rows + 1 }, (_, j) => horizon + (bottom - horizon) * Math.pow(j / rows, curve));
  const xAt = (i: number, y: number) => vpX + i * colW * ((y - horizon) / (bottom - horizon));
  const cells: { i: number; j: number; d: string; depth: number }[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = cols[0]; i < cols[1]; i++) {
      const y0 = ys[j], y1 = ys[j + 1];
      if (y1 - y0 < 0.35) continue;
      const d = `M${xAt(i, y0).toFixed(1)},${y0.toFixed(1)} L${xAt(i + 1, y0).toFixed(1)},${y0.toFixed(1)} L${xAt(i + 1, y1).toFixed(1)},${y1.toFixed(1)} L${xAt(i, y1).toFixed(1)},${y1.toFixed(1)} Z`;
      cells.push({ i, j, d, depth: j / rows });
    }
  }
  return { cells, ys, xAt };
}

/** A die face as seen straight on (pips 1–6). */
export function pipsFor(n: number): [number, number][] {
  const c = 0.5, l = 0.24, r = 0.76;
  const map: Record<number, [number, number][]> = {
    1: [[c, c]],
    2: [[l, l], [r, r]],
    3: [[l, l], [c, c], [r, r]],
    4: [[l, l], [r, l], [l, r], [r, r]],
    5: [[l, l], [r, l], [c, c], [l, r], [r, r]],
    6: [[l, l], [r, l], [l, c], [r, c], [l, r], [r, r]],
  };
  return map[n] || map[1];
}
