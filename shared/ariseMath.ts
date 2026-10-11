// Arise Math (/math/): K–12 math practice built like A.R.I.S.E. Reader, with points, a class
// leaderboard, certificates and a game room. Shared by the server (which makes and grades every
// question, so points can't be faked) and the tests. Tables: migrations/arise_math.sql.

export type BandId = "k2" | "g35" | "g68" | "g912";
/** Every skill's id: the keys of SKILLS. */
export type SkillId = keyof typeof SKILLS;
export type Rng = () => number;

/* ------------------------------------------------------------------ numbers */

const MINUS = "−";
const rndWith = (r: Rng) => (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pickWith = (r: Rng) => <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length];
export const N = (n: number) => (n < 0 ? MINUS + Math.abs(n) : String(n));
const P = (n: number) => (n < 0 ? "(" + N(n) + ")" : String(n));
const sgn = (n: number) => (n < 0 ? MINUS + " " + Math.abs(n) : "+ " + n);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const frac = (n: number | string, d: number | string) => `<span class="fr"><span>${n}</span><span>${d}</span></span>`;
const coefX = (a: number) => (a === 1 ? "x" : a === -1 ? MINUS + "x" : N(a) + "x");
const range = (a: number, b: number) => { const out: number[] = []; for (let i = a; i <= b; i++) out.push(i); return out; };
/** 0.5 → "1/2", −1.5 → "−3/2", 7 → "7". */
export const fmtV = (v: number) => (Number.isInteger(v) ? N(v) : Number.isInteger(v * 2) ? (v < 0 ? MINUS : "") + Math.abs(v * 2) + "/2" : N(v));

/** Reads a typed answer: "12", "−3", "3/4", ".5", "x = 4". NaN when it isn't a number. */
export function parseAnswer(raw: unknown): number {
  const s = String(raw ?? "").trim().replace(/[−–—]/g, "-").replace(/\s+/g, "").replace(/^x=/i, "");
  if (!s || s.length > 24) return NaN;
  if (/^-?\d+(\.\d+)?\/-?\d+(\.\d+)?$/.test(s)) { const [a, b] = s.split("/").map(Number); return b ? a / b : NaN; }
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  return NaN;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/* ------------------------------------------------------------------ visual models (SVG strings) */

function tenFrames(groups: { n: number; cls: string }[], cross = 0) {
  const c = 32, gap = 18, W = c * 10 + gap, H = c * 2;
  let s = `<svg class="viz" viewBox="-2 -2 ${W + 4} ${H + 4}" style="width:${W * 1.1}px" role="img" aria-label="Two ten frames">`;
  for (let f = 0; f < 2; f++) { const ox = f * (c * 5 + gap); for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) s += `<rect class="cell" x="${ox + k * c}" y="${r * c}" width="${c}" height="${c}"/>`; }
  const dots: string[] = []; groups.forEach((g) => { for (let i = 0; i < g.n; i++) dots.push(g.cls); });
  dots.forEach((cls, i) => {
    const f = Math.floor(i / 10), k = i % 10, r = Math.floor(k / 5), col = k % 5, cx = f * (c * 5 + gap) + col * c + c / 2, cy = r * c + c / 2, gone = i >= dots.length - cross;
    s += `<circle class="dot ${gone ? "gone" : cls}" cx="${cx}" cy="${cy}" r="${c * 0.32}"/>`;
    if (gone) s += `<path class="vx" d="M${cx - 7} ${cy - 7}L${cx + 7} ${cy + 7}M${cx + 7} ${cy - 7}L${cx - 7} ${cy + 7}"/>`;
  });
  return s + "</svg>";
}
function dotArray(r: number, c: number) {
  const sp = 24, W = c * sp, H = r * sp;
  let s = `<svg class="viz" viewBox="0 0 ${W} ${H}" style="width:${W * 1.15}px" role="img" aria-label="${r} rows of ${c} dots">`;
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) s += `<circle class="dot ${i % 2 ? "d2" : "d1"}" cx="${j * sp + 12}" cy="${i * sp + 12}" r="8"/>`;
  return s + "</svg>";
}
function baseTen(n: number) {
  const T = Math.floor(n / 10), O = n % 10, u = 14, g = 22, H = u * 10, ox = T * g + 16, W = ox + 2 * (u + 4);
  let s = `<svg class="viz" viewBox="0 0 ${W} ${H}" style="width:${W * 1.1}px" role="img" aria-label="Base ten blocks">`;
  for (let i = 0; i < T; i++) { const x = i * g; s += `<rect class="rod" x="${x}" y="0" width="${u}" height="${H}" rx="2"/>`; for (let k = 1; k < 10; k++) s += `<line class="rodline" x1="${x}" x2="${x + u}" y1="${k * u}" y2="${k * u}"/>`; }
  for (let i = 0; i < O; i++) { const col = i % 2, row = Math.floor(i / 2); s += `<rect class="unit" x="${ox + col * (u + 4)}" y="${H - u - row * (u + 4)}" width="${u}" height="${u}" rx="2"/>`; }
  return s + "</svg>";
}
function fractionBars(n1: number, d1: number, n2: number, d2: number) {
  const x0 = 56, w = 300;
  let s = `<svg class="viz" viewBox="0 0 ${x0 + w + 4} 96" style="width:420px" role="img" aria-label="Fraction bars">`;
  for (const [n, d, y] of [[n1, d1, 8], [n2, d2, 54]]) {
    s += `<text class="lab" x="0" y="${y + 22}">${n}/${d}</text>`;
    for (let i = 0; i < d; i++) s += `<rect class="seg-r ${i < n ? "fill" : ""}" x="${x0 + (i * w) / d}" y="${y}" width="${w / d}" height="34"/>`;
  }
  return s + "</svg>";
}
function numberLine(a: number, lo: number, hi: number) {
  const W = 380, pad = 14, span = hi - lo, px = (W - 2 * pad) / span, X = (v: number) => pad + (v - lo) * px;
  let s = `<svg class="viz" viewBox="0 0 ${W} 74" style="width:520px" role="img" aria-label="Number line">`;
  s += `<line class="axis" x1="4" x2="${W - 4}" y1="38" y2="38"/>`;
  for (let v = lo; v <= hi; v++) {
    const major = v === 0 || v % 5 === 0;
    s += `<line class="tick" x1="${X(v)}" x2="${X(v)}" y1="${major ? 30 : 33}" y2="${major ? 46 : 43}"/>`;
    if (span <= 20 || major) s += `<text class="lab sm" x="${X(v)}" y="62" text-anchor="middle">${N(v)}</text>`;
  }
  s += `<circle class="pt" cx="${X(a)}" cy="38" r="7"/><text class="lab sm" x="${X(a)}" y="18" text-anchor="middle">start</text>`;
  return s + "</svg>";
}
function coordPlane(x1: number, y1: number, x2: number, y2: number) {
  const s0 = 18, R = 6, M = 30, size = 2 * R * s0, X = (v: number) => M + (v + R) * s0, Y = (v: number) => M + (R - v) * s0, W = size + 2 * M;
  let s = `<svg class="viz" viewBox="0 0 ${W} ${W}" style="width:${W * 1.15}px" role="img" aria-label="Coordinate plane">`;
  s += `<defs><clipPath id="cp"><rect x="${X(-R)}" y="${Y(R)}" width="${size}" height="${size}"/></clipPath></defs>`;
  for (let v = -R; v <= R; v++) s += `<line class="gridl" x1="${X(v)}" x2="${X(v)}" y1="${Y(R)}" y2="${Y(-R)}"/><line class="gridl" y1="${Y(v)}" y2="${Y(v)}" x1="${X(-R)}" x2="${X(R)}"/>`;
  s += `<line class="axis" x1="${X(0)}" x2="${X(0)}" y1="${Y(R)}" y2="${Y(-R)}"/><line class="axis" y1="${Y(0)}" y2="${Y(0)}" x1="${X(-R)}" x2="${X(R)}"/>`;
  const m = (y2 - y1) / (x2 - x1);
  s += `<line class="ln" clip-path="url(#cp)" x1="${X(-R - 1)}" y1="${Y(y1 + m * (-R - 1 - x1))}" x2="${X(R + 1)}" y2="${Y(y1 + m * (R + 1 - x1))}"/>`;
  for (const [x, y] of [[x1, y1], [x2, y2]]) {
    const rt = x < 3;
    s += `<circle class="pt" cx="${X(x)}" cy="${Y(y)}" r="6"/><text class="lab sm" style="font-size:11px;fill:var(--fg)" x="${X(x) + (rt ? 10 : -10)}" y="${Y(y) - 9}" text-anchor="${rt ? "start" : "end"}">(${N(x)}, ${N(y)})</text>`;
  }
  return s + "</svg>";
}
function balance(left: string, right: string) {
  return `<svg class="viz" viewBox="0 0 360 150" style="width:440px" role="img" aria-label="Balance scale"><path class="fulcrum" d="M180 50 L158 136 H202 Z"/><line class="beam" x1="40" x2="320" y1="46" y2="46"/><path d="M40 46 L24 78 M40 46 L156 78 M320 46 L204 78 M320 46 L336 78" stroke="var(--muted)" stroke-width="1.5"/><rect class="pan" x="14" y="78" width="152" height="46" rx="10"/><rect class="pan" x="194" y="78" width="152" height="46" rx="10"/><text class="lab" style="font-size:20px" x="90" y="108" text-anchor="middle">${left}</text><text class="lab" style="font-size:20px" x="270" y="108" text-anchor="middle">${right}</text></svg>`;
}
function hundredGrid(p: number) {
  const c = 15, W = c * 10;
  let s = `<svg class="viz" viewBox="0 0 ${W} ${W}" style="width:${W * 1.2}px" role="img" aria-label="${p} of 100 squares shaded">`;
  for (let i = 0; i < 100; i++) s += `<rect class="hund ${i < p ? "fill" : ""}" x="${(i % 10) * c}" y="${Math.floor(i / 10) * c}" width="${c}" height="${c}"/>`;
  return s + "</svg>";
}

/** A first-quadrant grid from 0 to 6 with one point on it. */
function pointGrid(px: number, py: number) {
  const c = 22, o = 18, W = o + 6 * c + 10;
  let g = `<svg class="viz" viewBox="0 0 ${W} ${W}" style="width:${W * 1.1}px" role="img" aria-label="A grid with a point">`;
  for (let i = 0; i <= 6; i++) g += `<line class="gridl" x1="${o + i * c}" y1="${10}" x2="${o + i * c}" y2="${10 + 6 * c}"/><line class="gridl" x1="${o}" y1="${10 + i * c}" x2="${o + 6 * c}" y2="${10 + i * c}"/>`
    + `<text x="${o + i * c}" y="${10 + 6 * c + 12}" text-anchor="middle" font-size="10" fill="currentColor">${i}</text>` + (i ? `<text x="${o - 8}" y="${10 + (6 - i) * c + 4}" text-anchor="middle" font-size="10" fill="currentColor">${i}</text>` : "");
  g += `<line class="axis" x1="${o}" y1="${10 + 6 * c}" x2="${o + 6 * c}" y2="${10 + 6 * c}"/><line class="axis" x1="${o}" y1="10" x2="${o}" y2="${10 + 6 * c}"/>`;
  return g + `<circle class="pt" cx="${o + px * c}" cy="${10 + (6 - py) * c}" r="5"/></svg>`;
}

/** How many sides a named flat shape has. */
const sidesOf = (name: string) => ({ triangle: 3, square: 4, rectangle: 4, quadrilateral: 4, rhombus: 4, trapezoid: 4, pentagon: 5, hexagon: 6, octagon: 8 } as Record<string, number>)[name] ?? 0;
/** A flat shape drawn plainly. */
function shapeSvg(name: string) {
  const open = `<svg class="viz" viewBox="0 0 120 100" style="width:150px" role="img" aria-label="A ${name}">`;
  if (name === "circle") return open + `<circle cx="60" cy="50" r="38" class="cell" style="stroke-width:3"/></svg>`;
  if (name === "rectangle") return open + `<rect x="12" y="25" width="96" height="50" class="cell" style="stroke-width:3"/></svg>`;
  if (name === "square") return open + `<rect x="27" y="17" width="66" height="66" class="cell" style="stroke-width:3"/></svg>`;
  const n = sidesOf(name) || 3, pts = Array.from({ length: n }, (_, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return `${(60 + 40 * Math.cos(a)).toFixed(1)},${(52 + 40 * Math.sin(a)).toFixed(1)}`; }).join(" ");
  return open + `<polygon points="${pts}" class="cell" style="stroke-width:3"/></svg>`;
}
/** A rectangle split into rows and columns of squares. */
function gridRect(rows: number, cols: number) {
  const c = 24, W = cols * c, H = rows * c;
  let g = `<svg class="viz" viewBox="-2 -2 ${W + 4} ${H + 4}" style="width:${W * 1.2}px" role="img" aria-label="${rows} rows of ${cols} squares">`;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) g += `<rect class="cell" x="${j * c}" y="${i * c}" width="${c}" height="${c}"/>`;
  return g + "</svg>";
}

/* ------------------------------------------------------------------ more visual models */

/** A tape (bar) diagram: one or more rows of parts side by side, each part labelled, and a brace over the row with its total. */
type TapePart = { label: string; size: number; fill?: boolean };
function tape(rows: { name?: string; parts: TapePart[]; whole?: string }[]) {
  const W = 360, x0 = rows.some((r) => r.name) ? 70 : 6, rowH = 66, H = rows.length * rowH + 6;
  const max = Math.max(...rows.map((r) => r.parts.reduce((s, p) => s + p.size, 0)));
  let s = `<svg class="viz" viewBox="0 0 ${W + 10} ${H}" style="width:${(W + 10) * 1.2}px" role="img" aria-label="Bar model">`;
  rows.forEach((row, i) => {
    const y = i * rowH + 26, scale = (W - x0) / max;
    let x = x0;
    if (row.name) s += `<text class="lab" x="${x0 - 8}" y="${y + 22}" text-anchor="end">${row.name}</text>`;
    for (const p of row.parts) {
      const w = p.size * scale;
      s += `<rect class="seg-r ${p.fill ? "fill" : ""}" x="${x}" y="${y}" width="${w}" height="34" rx="3"/>`;
      if (w > 14) s += `<text class="lab" x="${x + w / 2}" y="${y + 22}" text-anchor="middle" ${p.fill ? 'style="fill:var(--primary-ink,#fff)"' : ""}>${p.label}</text>`;
      x += w;
    }
    if (row.whole) s += `<path d="M${x0} ${y - 6} V${y - 12} H${x} V${y - 6}" fill="none" stroke="currentColor" stroke-width="1.5"/><text class="lab" x="${(x0 + x) / 2}" y="${y - 16}" text-anchor="middle">${row.whole}</text>`;
  });
  return s + "</svg>";
}

/** An area model for multiplying: each number split into place-value parts, with the partial products inside. */
function areaModel(a: number, b: number) {
  const split = (n: number) => String(n).split("").map((d, i, all) => Number(d) * 10 ** (all.length - 1 - i)).filter((v) => v > 0);
  const cols = split(a), rows = split(b), W = 330, H = Math.min(200, 70 * rows.length + 20), x0 = 50, y0 = 26;
  const cw = cols.map((v) => Math.max(0.18, v / a)), ch = rows.map((v) => Math.max(0.22, v / b));
  const sw = cw.reduce((s, v) => s + v, 0), sh = ch.reduce((s, v) => s + v, 0);
  let s = `<svg class="viz" viewBox="0 0 ${x0 + W + 6} ${y0 + H + 6}" style="width:${(x0 + W) * 1.25}px" role="img" aria-label="Area model for ${a} times ${b}">`;
  let y = y0;
  rows.forEach((rv, ri) => {
    const h = (ch[ri] / sh) * H; let x = x0;
    s += `<text class="lab" x="${x0 - 8}" y="${y + h / 2 + 5}" text-anchor="end">${rv}</text>`;
    cols.forEach((cv, ci) => {
      const w = (cw[ci] / sw) * W;
      if (ri === 0) s += `<text class="lab" x="${x + w / 2}" y="${y0 - 8}" text-anchor="middle">${cv}</text>`;
      s += `<rect class="cell" x="${x}" y="${y}" width="${w}" height="${h}"/><text class="lab sm" style="font-size:12px;fill:currentColor" x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle">${cv * rv}</text>`;
      x += w;
    });
    y += h;
  });
  return s + "</svg>";
}

/** A place-value chart with each digit in its column. `heads` name the columns; "." is the decimal point. */
function placeChart(digits: (number | string)[], heads: string[]) {
  const cw = 64, W = heads.length * cw;
  let s = `<svg class="viz" viewBox="0 0 ${W + 4} 82" style="width:${Math.min(520, W * 1.15)}px" role="img" aria-label="Place value chart">`;
  heads.forEach((h, i) => {
    const x = 2 + i * cw, dot = h === ".";
    if (dot) { s += `<text class="lab" style="font-size:30px" x="${x + cw / 2}" y="68" text-anchor="middle">.</text>`; return; }
    s += `<rect class="cell" x="${x}" y="2" width="${cw}" height="28"/><text class="lab sm" style="fill:currentColor" x="${x + cw / 2}" y="20" text-anchor="middle">${h}</text>`;
    s += `<rect class="cell" x="${x}" y="30" width="${cw}" height="48"/><text class="lab" style="font-size:24px" x="${x + cw / 2}" y="63" text-anchor="middle">${digits[i] ?? ""}</text>`;
  });
  return s + "</svg>";
}
const PLACE_HEADS = ["Ten thousands", "Thousands", "Hundreds", "Tens", "Ones"].map((h) => h.replace("Ten thousands", "10 thous."));
/** A whole number's place-value chart. */
const wholeChart = (n: number) => { const d = String(n).split(""); return placeChart(d, PLACE_HEADS.slice(PLACE_HEADS.length - d.length)); };

/** A number line from one benchmark to the next, with the halfway mark, showing where a number sits (for rounding). */
function roundLine(n: number, lo: number, hi: number, fmt = (v: number) => String(v)) {
  const W = 380, x = (v: number) => 20 + ((v - lo) / (hi - lo)) * (W - 40), mid = (lo + hi) / 2;
  let s = `<svg class="viz" viewBox="0 0 ${W} 80" style="width:500px" role="img" aria-label="Number line from ${fmt(lo)} to ${fmt(hi)}">`;
  s += `<line class="axis" x1="10" x2="${W - 10}" y1="44" y2="44"/>`;
  for (const [v, big] of [[lo, 1], [mid, 0], [hi, 1]] as const) s += `<line class="tick" x1="${x(v)}" x2="${x(v)}" y1="${big ? 34 : 38}" y2="${big ? 54 : 50}"/><text class="lab sm" x="${x(v)}" y="70" text-anchor="middle">${fmt(v)}</text>`;
  s += `<circle class="pt" cx="${x(n)}" cy="44" r="7"/><text class="lab" x="${x(n)}" y="22" text-anchor="middle">${fmt(n)}</text>`;
  return s + "</svg>";
}

/** A number line with jumps of the same size, for skip counting and patterns. The last jump lands on "?". */
function jumpLine(start: number, step: number, jumps: number) {
  const W = 400, end = start + step * jumps, lo = Math.min(start, end), hi = Math.max(start, end), x = (v: number) => 24 + ((v - lo) / (hi - lo || 1)) * (W - 48);
  let s = `<svg class="viz" viewBox="0 0 ${W} 96" style="width:520px" role="img" aria-label="Jumps on a number line">`;
  s += `<line class="axis" x1="8" x2="${W - 8}" y1="70" y2="70"/>`;
  for (let i = 0; i <= jumps; i++) {
    const v = start + i * step, last = i === jumps;
    s += `<line class="tick" x1="${x(v)}" x2="${x(v)}" y1="62" y2="78"/><text class="lab sm" style="${last ? "fill:currentColor;font-size:13px" : ""}" x="${x(v)}" y="92" text-anchor="middle">${last ? "?" : N(v)}</text>`;
    if (i) { const a = x(v - step), b = x(v); s += `<path class="ln" style="stroke-dasharray:none" d="M${a} 66 Q${(a + b) / 2} 22 ${b} 66"/><text class="lab sm" x="${(a + b) / 2}" y="36" text-anchor="middle">${step > 0 ? "+" : MINUS}${Math.abs(step)}</text>`; }
  }
  return s + "</svg>";
}

/** A rectangle drawn to shape, with its sides labelled. */
function labeledRect(w: number, h: number, wl: string, hl: string) {
  const k = Math.min(220 / w, 120 / h), W = Math.max(60, w * k), H = Math.max(44, h * k);
  return `<svg class="viz" viewBox="0 0 ${W + 70} ${H + 50}" style="width:${(W + 70) * 1.2}px" role="img" aria-label="Rectangle ${wl} by ${hl}"><rect class="cell" style="stroke-width:2.5" x="10" y="10" width="${W}" height="${H}"/><text class="lab" x="${10 + W / 2}" y="${H + 34}" text-anchor="middle">${wl}</text><text class="lab" x="${W + 18}" y="${10 + H / 2 + 5}">${hl}</text></svg>`;
}
/** A triangle with its base and dashed height labelled. */
function triangleBH(b: string, h: string) {
  return `<svg class="viz" viewBox="0 0 260 150" style="width:300px" role="img" aria-label="Triangle with base ${b} and height ${h}"><polygon class="cell" style="stroke-width:2.5" points="20,120 230,120 150,20"/><line class="ln" x1="150" y1="20" x2="150" y2="120"/><rect class="cell" x="150" y="108" width="12" height="12"/><text class="lab" x="125" y="142" text-anchor="middle">${b}</text><text class="lab" x="142" y="80" text-anchor="end">${h}</text></svg>`;
}
/** A right triangle with its sides labelled; `mark` puts angle A at the bottom left. */
function rightTriangle(a: string, b: string, c: string, mark = false) {
  return `<svg class="viz" viewBox="0 0 280 170" style="width:320px" role="img" aria-label="Right triangle"><polygon class="cell" style="stroke-width:2.5" points="30,140 240,140 240,30"/><rect class="cell" x="226" y="126" width="14" height="14"/><text class="lab" x="135" y="162" text-anchor="middle">${b}</text><text class="lab" x="250" y="90">${a}</text><text class="lab" x="118" y="76" text-anchor="end">${c}</text>${mark ? `<path d="M64 140 A34 34 0 0 0 60 125" fill="none" stroke="currentColor" stroke-width="2"/><text class="lab" x="70" y="132">A</text>` : ""}</svg>`;
}
/** A box (rectangular prism) with its length, width and height labelled. */
function boxSvg(l: string, w: string, h: string) {
  return `<svg class="viz" viewBox="0 0 270 170" style="width:310px" role="img" aria-label="Box ${l} by ${w} by ${h}"><path class="cell" style="stroke-width:2" d="M30 60 L160 60 L160 140 L30 140 Z"/><path class="cell" style="stroke-width:2" d="M30 60 L80 25 L210 25 L160 60 Z"/><path class="cell" style="stroke-width:2" d="M160 60 L210 25 L210 105 L160 140 Z"/><text class="lab" x="95" y="160" text-anchor="middle">${l}</text><text class="lab" x="196" y="135">${w}</text><text class="lab" x="22" y="105" text-anchor="end">${h}</text></svg>`;
}
/** A circle with its radius drawn and labelled. */
function circleSvg(r: string) {
  return `<svg class="viz" viewBox="0 0 200 170" style="width:240px" role="img" aria-label="Circle with radius ${r}"><circle class="cell" style="stroke-width:2.5" cx="100" cy="85" r="70"/><line class="axis" x1="100" y1="85" x2="170" y2="85"/><circle class="fulcrum" cx="100" cy="85" r="4"/><text class="lab" x="135" y="78" text-anchor="middle">${r}</text></svg>`;
}
/** A cylinder, cone or sphere with its radius and height labelled. */
function solidSvg(kind: "cylinder" | "cone" | "sphere", r: string, h = "") {
  const open = `<svg class="viz" viewBox="0 0 220 195" style="width:250px" role="img" aria-label="${kind}">`;
  if (kind === "sphere") return open + `<circle class="cell" style="stroke-width:2.5" cx="110" cy="95" r="75"/><ellipse cx="110" cy="95" rx="75" ry="18" fill="none" stroke="currentColor" stroke-dasharray="5 4"/><line class="axis" x1="110" y1="95" x2="185" y2="95"/><text class="lab" x="148" y="88" text-anchor="middle">${r}</text></svg>`;
  if (kind === "cone") return open + `<path class="cell" style="stroke-width:2.5" d="M40 150 L110 20 L180 150"/><ellipse class="cell" style="stroke-width:2.5" cx="110" cy="150" rx="70" ry="16"/><line class="ln" x1="110" y1="20" x2="110" y2="150"/><line class="axis" x1="110" y1="150" x2="180" y2="150"/><text class="lab" x="145" y="184" text-anchor="middle">${r}</text><text class="lab" x="116" y="124">${h}</text></svg>`;
  return open + `<path class="cell" style="stroke-width:2.5" d="M40 40 V150 A70 16 0 0 0 180 150 V40"/><ellipse class="cell" style="stroke-width:2.5" cx="110" cy="40" rx="70" ry="16"/><line class="axis" x1="110" y1="40" x2="180" y2="40"/><circle class="fulcrum" cx="110" cy="40" r="3"/><text class="lab" style="font-size:11px" x="146" y="35" text-anchor="middle">${r}</text><text class="lab" x="188" y="100">${h}</text></svg>`;
}
/** Two angles that make a right angle or a straight line; the known one is labelled, the other shows "?". */
function angleSplit(a: number, whole: 90 | 180, unknownLabel = "?") {
  const cx = 150, cy = 140, R = 110, p = (deg: number) => [cx + R * Math.cos((deg * Math.PI) / 180), cy - R * Math.sin((deg * Math.PI) / 180)].map((v) => Math.round(v));
  const [ax, ay] = p(a), [ex, ey] = p(whole), [mx1, my1] = p(a / 2).map((v, i) => (i ? cy - (cy - v) * 0.45 : cx + (v - cx) * 0.45)), [mx2, my2] = p((a + whole) / 2).map((v, i) => (i ? cy - (cy - v) * 0.45 : cx + (v - cx) * 0.45));
  return `<svg class="viz" viewBox="${whole === 180 ? "20 20 260 140" : "130 20 150 140"}" style="width:${whole === 180 ? 320 : 220}px" role="img" aria-label="Angles"><line class="axis" x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}"/><line class="axis" x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}"/><line class="ln" style="stroke-dasharray:none;stroke-width:2.5" x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}"/>${whole === 90 ? `<rect class="cell" x="${cx}" y="${cy - 12}" width="12" height="12"/>` : ""}<text class="lab" x="${mx1}" y="${my1}" text-anchor="middle">${a}°</text><text class="lab" x="${mx2}" y="${my2}" text-anchor="middle">${unknownLabel}</text></svg>`;
}
/** A triangle with its three angles labelled (one may be "?"). */
function triangleAngles(a: string, b: string, c: string) {
  return `<svg class="viz" viewBox="0 0 280 170" style="width:320px" role="img" aria-label="Triangle angles"><polygon class="cell" style="stroke-width:2.5" points="25,150 260,150 170,25"/><text class="lab" x="58" y="142">${a}</text><text class="lab" x="226" y="142" text-anchor="end">${b}</text><text class="lab" x="170" y="56" text-anchor="middle">${c}</text></svg>`;
}
/** Coins, each a circle with its value. */
function coinsSvg(coins: number[]) {
  const r = (v: number) => (v === 25 ? 24 : v === 5 ? 21 : v === 10 ? 17 : 18);
  let x = 6, s = "";
  for (const v of coins) { const rr = r(v); s += `<circle cx="${x + rr}" cy="30" r="${rr}" style="fill:${v === 1 ? "#d58a52" : "#c9ccd6"};stroke:currentColor;stroke-width:1.5"/><text class="lab" style="fill:#1a1828;font-size:12px" x="${x + rr}" y="34" text-anchor="middle">${v}¢</text>`; x += rr * 2 + 6; }
  return `<svg class="viz" viewBox="0 0 ${x + 4} 60" style="width:${Math.min(520, (x + 4) * 1.1)}px" role="img" aria-label="Coins">${s}</svg>`;
}
/** Marbles of up to three colours, as dots. */
function marblesSvg(counts: [number, string][]) {
  let s = "", i = 0;
  for (const [n, color] of counts) for (let k = 0; k < n; k++, i++) s += `<circle cx="${16 + (i % 10) * 26}" cy="${16 + Math.floor(i / 10) * 26}" r="10" style="fill:${color};stroke:currentColor;stroke-width:1"/>`;
  const rows = Math.ceil(i / 10);
  return `<svg class="viz" viewBox="0 0 270 ${rows * 26 + 8}" style="width:300px" role="img" aria-label="Marbles">${s}</svg>`;
}
/** Whole bars plus a part of one, for mixed numbers. */
function wholesSvg(w: number, n: number, d: number) {
  const bw = 150, bh = 26, gap = 8, per = 2, rows = Math.ceil((w + (n ? 1 : 0)) / per);
  let s = `<svg class="viz" viewBox="0 0 ${per * (bw + gap)} ${rows * (bh + gap)}" style="width:340px" role="img" aria-label="${w} wholes and ${n} ${d}ths">`;
  for (let b = 0; b < w + (n ? 1 : 0); b++) {
    const x = (b % per) * (bw + gap), y = Math.floor(b / per) * (bh + gap), full = b < w;
    for (let k = 0; k < d; k++) s += `<rect class="seg-r ${full || k < n ? "fill" : ""}" x="${x + (k * bw) / d}" y="${y}" width="${bw / d}" height="${bh}"/>`;
  }
  return s + "</svg>";
}

/** A coordinate plane from −6 to 6 with labelled points; `arrow` draws an arrow from the first point to the second. Nothing if a point is off the grid. */
function pointsPlane(pts: [number, number, string?][], arrow = false) {
  if (pts.some(([x, y]) => Math.abs(x) > 6 || Math.abs(y) > 6)) return undefined;
  const s0 = 18, R = 6, M = 30, size = 2 * R * s0, X = (v: number) => M + (v + R) * s0, Y = (v: number) => M + (R - v) * s0, W = size + 2 * M;
  let s = `<svg class="viz" viewBox="0 0 ${W} ${W}" style="width:${W * 1.15}px" role="img" aria-label="Coordinate plane">`;
  for (let v = -R; v <= R; v++) s += `<line class="gridl" x1="${X(v)}" x2="${X(v)}" y1="${Y(R)}" y2="${Y(-R)}"/><line class="gridl" y1="${Y(v)}" y2="${Y(v)}" x1="${X(-R)}" x2="${X(R)}"/>`;
  s += `<line class="axis" x1="${X(0)}" x2="${X(0)}" y1="${Y(R)}" y2="${Y(-R)}"/><line class="axis" y1="${Y(0)}" y2="${Y(0)}" x1="${X(-R)}" x2="${X(R)}"/>`;
  if (arrow && pts.length > 1) s += `<line class="ln" x1="${X(pts[0][0])}" y1="${Y(pts[0][1])}" x2="${X(pts[1][0])}" y2="${Y(pts[1][1])}"/>`;
  for (const [x, y, label] of pts) { const rt = x < 3; s += `<circle class="pt" cx="${X(x)}" cy="${Y(y)}" r="6"/><text class="lab sm" style="font-size:11px;fill:currentColor" x="${X(x) + (rt ? 10 : -10)}" y="${Y(y) - 9}" text-anchor="${rt ? "start" : "end"}">${label ?? `(${N(x)}, ${N(y)})`}</text>`; }
  return s + "</svg>";
}

/* ------------------------------------------------------------------ problems */

export type Choice = { v: string; label: string };
/** A full problem as the server keeps it. The answer and steps never go to the page before they're earned. */
export type Problem = {
  skill: SkillId | "custom"; ask: string; prompt: string; plain: string; viz: string; long: boolean;
  kind: "num" | "choice"; answer: number | string; choices: Choice[]; steps: string[];
};
type Gen = Omit<Problem, "skill" | "choices" | "long" | "kind" | "viz"> & { viz?: string; long?: boolean; kind?: "num" | "choice"; choices?: Choice[] };

type SkillDef = { name: string; std: string; glyph: string; c: string; band: BandId; gen: (r: Rng) => Gen };
export const SKILLS = {
  add20: { name: "Add within 20", std: "1.OA.C.6", glyph: "+", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(3, 9), b = rnd(2, 9), s = a + b, need = 10 - a;
    return { ask: "How many dots in all?", prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, viz: tenFrames([{ n: a, cls: "d1" }, { n: b, cls: "d2" }]), answer: s,
      steps: s > 10 ? [`${a} needs ${need} more to make 10.`, `Split ${b} into ${need} and ${b - need}.`, `${a} + ${need} = 10.`, `10 + ${b - need} = ${s}.`] : [`Start at ${a}.`, `Count on ${b}: ${range(a + 1, s).join(", ")}.`, `You land on ${s}.`] };
  } },
  sub20: { name: "Subtract within 20", std: "1.OA.C.6", glyph: MINUS, c: "heal", band: "k2", gen(r) {
    const rnd = rndWith(r); const b = rnd(3, 9), s = rnd(11, 18), a = s - b;
    return { ask: "Cross out the dots that are taken away. How many are left?", prompt: `${s} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${s} ${MINUS} ${b}`, viz: tenFrames([{ n: s, cls: "d1" }], b), answer: a,
      steps: [`Think addition: ${b} + ? = ${s}.`, `${b} + ${10 - b} = 10.`, `10 + ${s - 10} = ${s}.`, `${10 - b} + ${s - 10} = ${a}, so ${s} ${MINUS} ${b} = ${a}.`] };
  } },
  tens: { name: "Tens and ones", std: "1.NBT.B.2", glyph: "10", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); const n = rnd(21, 98), T = Math.floor(n / 10), O = n % 10;
    return { ask: `How many tens are in ${n}?`, prompt: `${n} = <span class="blank">?</span> tens + ${O} ones`, plain: `${n} = ? tens`, long: true, viz: baseTen(n), answer: T,
      steps: [`Each tall rod is 1 ten. Count the rods: ${T}.`, `The ${O} small cubes are ones.`, `${n} = ${T} tens and ${O} ones.`] };
  } },
  mult: { name: "Multiplication facts", std: "3.OA.C.7", glyph: "×", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), b = rnd(3, 10), p = a * b;
    return { ask: `${a} rows of ${b}. How many in all?`, prompt: `${a} × ${b} = <span class="blank">?</span>`, plain: `${a} × ${b}`, viz: dotArray(a, b), answer: p,
      steps: b > 5 ? [`Split ${b} into 5 and ${b - 5}.`, `${a} × 5 = ${a * 5}.`, `${a} × ${b - 5} = ${a * (b - 5)}.`, `${a * 5} + ${a * (b - 5)} = ${p}.`] : [`Skip count by ${a}, ${b} times.`, `${range(1, b).map((i) => i * a).join(", ")}.`, `${a} × ${b} = ${p}.`] };
  } },
  div: { name: "Division facts", std: "3.OA.C.7", glyph: "÷", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), q = rnd(2, 10), n = a * q;
    return { ask: `Share ${n} equally into ${a} rows. How many in each row?`, prompt: `${n} ÷ ${a} = <span class="blank">?</span>`, plain: `${n} ÷ ${a}`, viz: dotArray(a, q), answer: q,
      steps: [`Think multiplication: ${a} × ? = ${n}.`, `Skip count by ${a}: ${range(1, q).map((i) => i * a).join(", ")}.`, `That took ${q} jumps, so ${n} ÷ ${a} = ${q}.`] };
  } },
  frac: { name: "Compare fractions", std: "4.NF.A.2", glyph: "½", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const D = [2, 3, 4, 5, 6, 8, 10, 12];
    let n1: number, d1: number, n2: number, d2: number;
    if (r() < 0.18) { d1 = pick([2, 3, 4, 6]); const k = pick([2, 3].filter((k) => d1 * k <= 12)); n1 = rnd(1, d1 - 1); d2 = d1 * k; n2 = n1 * k; }
    else { do { d1 = pick(D); d2 = pick(D); n1 = rnd(1, d1 - 1); n2 = rnd(1, d2 - 1); } while (n1 * d2 === n2 * d1); }
    if (r() < 0.5) [n1, d1, n2, d2] = [n2, d2, n1, d1];
    const L = lcm(d1, d2), a1 = (n1 * L) / d1, a2 = (n2 * L) / d2, sym = a1 > a2 ? ">" : a1 < a2 ? "<" : "=";
    return { ask: "Which symbol makes this true?", prompt: `${frac(n1, d1)} <span class="blank">?</span> ${frac(n2, d2)}`, plain: `${n1}/${d1} ? ${n2}/${d2}`, viz: fractionBars(n1, d1, n2, d2), kind: "choice", answer: sym,
      choices: ["<", "=", ">"].map((v) => ({ v, label: v })),
      steps: [`Rename both with a common denominator: ${L}.`, `${frac(n1, d1)} = ${frac(a1, L)}`, `${frac(n2, d2)} = ${frac(a2, L)}`, `${a1} ${sym} ${a2}, so ${frac(n1, d1)} ${sym} ${frac(n2, d2)}.`] };
  } },
  int: { name: "Add and subtract integers", std: "7.NS.A.1", glyph: "±", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); let a: number, b: number; do { a = rnd(-12, 12); b = rnd(-9, 9); } while (!a || !b);
    const op = pick(["+", MINUS]), res = op === "+" ? a + b : a - b, eff = op === "+" ? b : -b, steps: string[] = [];
    if (op !== "+") steps.push(`Subtracting ${P(b)} is the same as adding ${P(-b)}.`);
    steps.push(`Start at ${N(a)} on the number line.`, `Adding ${P(eff)} moves ${Math.abs(eff)} to the ${eff > 0 ? "right" : "left"}.`, `You land on ${N(res)}.`);
    return { ask: "Use the number line if it helps.", prompt: `${N(a)} ${op} ${P(b)} = <span class="blank">?</span>`, plain: `${N(a)} ${op} ${P(b)}`, viz: numberLine(a, Math.min(a, res, 0) - 1, Math.max(a, res, 0) + 1), answer: res, steps };
  } },
  pct: { name: "Percent of a number", std: "6.RP.A.3c", glyph: "%", c: "help", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const p = pick([10, 20, 25, 30, 40, 50, 60, 75, 5, 15]), W = 20 * rnd(1, 10), res = (p * W) / 100;
    let steps: string[];
    if (p % 10 === 0) steps = [`10% of ${W} is ${W / 10}.`, `${p}% is ${p / 10} groups of 10%.`, `${p / 10} × ${W / 10} = ${res}.`];
    else if (p === 25 || p === 75) steps = [`${p}% is the same as ${p === 25 ? frac(1, 4) : frac(3, 4)}.`, `${W} ÷ 4 = ${W / 4}.`, p === 75 ? `3 × ${W / 4} = ${res}.` : `So 25% of ${W} is ${res}.`];
    else steps = [`10% of ${W} is ${W / 10}.`, `5% is half of that: ${W / 20}.`, p === 15 ? `10% + 5% = ${W / 10} + ${W / 20} = ${res}.` : `So 5% of ${W} is ${res}.`];
    return { ask: `The grid shows ${p} out of 100.`, prompt: `${p}% of ${W} = <span class="blank">?</span>`, plain: `${p}% of ${W}`, viz: hundredGrid(p), answer: res, steps };
  } },
  eq2: { name: "Two-step equations", std: "7.EE.B.4a", glyph: "x", c: "serve", band: "g68", gen(r) {
    const rnd = rndWith(r); const x = rnd(-5, 12), a = rnd(2, 9); let b: number; do { b = rnd(-15, 20); } while (!b);
    const c = a * x + b, left = `${a}x ${sgn(b)}`;
    return { ask: "Solve for x. Keep both sides balanced.", prompt: `${left} = ${N(c)}`, plain: `${left} = ${N(c)}`, viz: balance(left, N(c)), answer: x,
      steps: [`Undo the ${sgn(b)}: ${b > 0 ? "subtract" : "add"} ${Math.abs(b)} on both sides.`, `${a}x = ${N(c - b)}`, `Divide both sides by ${a}.`, `x = ${N(x)}`, `Check: ${a} · ${P(x)} ${sgn(b)} = ${N(c)} ✓`] };
  } },
  slope: { name: "Slope from two points", std: "8.F.B.4", glyph: "m", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); let m: number, dx: number, x1: number, y1: number, y2: number;
    do { m = pick([-3, -2, -1, 1, 2, 3, 0.5, -0.5]); dx = Number.isInteger(m) ? rnd(1, 3) : pick([2, 4]); x1 = rnd(-5, 5 - dx); y1 = rnd(-5, 5); y2 = y1 + m * dx; } while (Math.abs(y2) > 5);
    let A = [x1, y1], B = [x1 + dx, y2]; if (r() < 0.5) [A, B] = [B, A];
    const dy = B[1] - A[1], ddx = B[0] - A[0];
    return { ask: "Find the slope of the line through these points. Fractions like 1/2 are fine.", long: true, prompt: `(${N(A[0])}, ${N(A[1])}) and (${N(B[0])}, ${N(B[1])})`, plain: `slope through (${N(A[0])}, ${N(A[1])}) and (${N(B[0])}, ${N(B[1])})`, viz: coordPlane(A[0], A[1], B[0], B[1]), answer: m,
      steps: ["Slope = change in y ÷ change in x.", `Change in y: ${N(B[1])} ${MINUS} ${P(A[1])} = ${N(dy)}.`, `Change in x: ${N(B[0])} ${MINUS} ${P(A[0])} = ${N(ddx)}.`, `${N(dy)} ÷ ${N(ddx)} = ${fmtV(m)}.`] };
  } },
  linear: { name: "Multi-step equations", std: "HSA-REI.B.3", glyph: "=", c: "nature", band: "g912", gen(r) {
    const rnd = rndWith(r); const x = rnd(-5, 9), a = rnd(2, 6), b = rnd(1, 6); let d: number; do { d = rnd(1, a + 3); } while (d === a);
    const e = a * (x - b) - d * x, right = coefX(d) + (e ? " " + sgn(e) : ""), k = a - d;
    return { ask: "Solve for x.", long: true, prompt: `${a}(x ${MINUS} ${b}) = ${right}`, plain: `${a}(x ${MINUS} ${b}) = ${right}`, answer: x,
      steps: [`Distribute the ${a}: ${a}x ${MINUS} ${a * b} = ${right}.`, `Subtract ${coefX(d)} from both sides: ${coefX(k)} ${MINUS} ${a * b} = ${N(e)}.`, `Add ${a * b} to both sides: ${coefX(k)} = ${N(e + a * b)}.`, k !== 1 ? `Divide both sides by ${N(k)}: x = ${N(x)}.` : `So x = ${N(x)}.`] };
  } },
  quad: { name: "Quadratics by factoring", std: "HSA-REI.B.4b", glyph: "x²", c: "coral", band: "g912", gen(r) {
    const rnd = rndWith(r); let r1: number, r2: number; do { r1 = rnd(-7, 7); r2 = rnd(-7, 7); } while (!r1 || !r2 || r1 === r2);
    const B = -(r1 + r2), C = r1 * r2, p = -r1, q = -r2, big = Math.max(r1, r2);
    const eq = `x²${B === 0 ? "" : ` ${B < 0 ? MINUS : "+"} ${Math.abs(B) === 1 ? "" : Math.abs(B)}x`} ${sgn(C)} = 0`;
    return { ask: "Solve by factoring. Enter the larger solution.", long: true, prompt: eq, plain: eq, answer: big,
      steps: [`Find two numbers that multiply to ${N(C)} and add to ${N(B)}.`, `${N(p)} and ${N(q)} work: ${N(p)} × ${P(q)} = ${N(C)} and ${N(p)} + ${P(q)} = ${N(B)}.`, `Factor: (x ${sgn(p)})(x ${sgn(q)}) = 0.`, `So x = ${N(r1)} or x = ${N(r2)}.`, `The larger solution is ${N(big)}.`] };
  } },
  // ─── Colorado Academic Standards (2020) lessons, kindergarten to high school. The codes match Colorado's. ───
  kcount: { name: "Count how many", std: "K.CC.B.5", glyph: "123", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r); const n = rnd(3, 20);
    return { ask: "Count the dots. How many are there?", prompt: `<span class="blank">?</span> dots`, plain: "How many dots?", viz: tenFrames([{ n, cls: "d1" }]), answer: n,
      steps: [n > 10 ? "The first frame is full: that is 10." : "Point to each dot as you count.", n > 10 ? `Count on the rest: ${range(11, n).join(", ")}.` : `Count: ${range(1, n).join(", ")}.`, `There are ${n} dots.`] };
  } },
  kadd10: { name: "Add within 10", std: "K.OA.A.2", glyph: "+", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const a = rnd(1, 7), b = rnd(1, 10 - a), s = a + b, thing = pick(["apples", "ducks", "blocks", "stars", "balls"]);
    return { ask: `You have ${a} ${thing}. You get ${b} more. How many now?`, prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, viz: tenFrames([{ n: a, cls: "d1" }, { n: b, cls: "d2" }]), answer: s,
      steps: [`Start at ${a}.`, `Count on ${b}: ${range(a + 1, s).join(", ")}.`, `${a} + ${b} = ${s}.`] };
  } },
  kmake10: { name: "Make 10", std: "K.OA.A.4", glyph: "10", c: "heal", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(1, 9), b = 10 - a;
    return { ask: "How many more make 10?", prompt: `${a} + <span class="blank">?</span> = 10`, plain: `${a} + ? = 10`, viz: tenFrames([{ n: a, cls: "d1" }]), answer: b,
      steps: [`A ten frame holds 10.`, `${a} spaces are filled. Count the empty ones.`, `${a} + ${b} = 10.`] };
  } },
  kcompare: { name: "Compare numbers to 10", std: "K.CC.C.7", glyph: "<>", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(1, 10); b = rnd(1, 10); } while (a === b && r() < 0.8);
    const sym = a > b ? ">" : a < b ? "<" : "=";
    return { ask: "Which symbol makes this true?", prompt: `${a} <span class="blank">?</span> ${b}`, plain: `${a} ? ${b}`, kind: "choice", answer: sym, choices: ["<", "=", ">"].map((v) => ({ v, label: v })),
      steps: [`Count up: which comes later, ${a} or ${b}?`, a === b ? `They are the same number.` : `${Math.max(a, b)} is more than ${Math.min(a, b)}.`, `${a} ${sym} ${b}.`] };
  } },
  g1add2d: { name: "Add tens and ones", std: "1.NBT.C.4", glyph: "+", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 8) * 10 + rnd(0, 9), tensOnly = r() < 0.5, b = tensOnly ? rnd(1, 9 - Math.floor(a / 10)) * 10 : rnd(1, 9), s = a + b;
    return { ask: "Add. Think about tens and ones.", prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, answer: s,
      steps: tensOnly ? [`${b} is ${b / 10} tens.`, `${a} has ${Math.floor(a / 10)} tens. Add ${b / 10} more tens: ${Math.floor(s / 10)} tens.`, `The ones stay ${a % 10}. So ${s}.`]
        : [`Add the ones: ${a % 10} + ${b} = ${(a % 10) + b}.`, (a % 10) + b >= 10 ? `That makes a new ten.` : `The tens stay ${Math.floor(a / 10)}.`, `${a} + ${b} = ${s}.`] };
  } },
  g2addsub: { name: "Add and subtract within 100", std: "2.NBT.B.5", glyph: "±", c: "heal", band: "k2", gen(r) {
    const rnd = rndWith(r); const add = r() < 0.5;
    if (add) { const a = rnd(12, 68), b = rnd(11, 99 - a), s = a + b; return { ask: "Add.", prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, answer: s,
      steps: [`Add the tens: ${Math.floor(a / 10) * 10} + ${Math.floor(b / 10) * 10} = ${(Math.floor(a / 10) + Math.floor(b / 10)) * 10}.`, `Add the ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}.`, `Put them together: ${s}.`] }; }
    const a = rnd(30, 99), b = rnd(11, a - 5), d = a - b;
    return { ask: "Subtract.", prompt: `${a} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${a} ${MINUS} ${b}`, answer: d,
      steps: [`Take away the tens first: ${a} ${MINUS} ${Math.floor(b / 10) * 10} = ${a - Math.floor(b / 10) * 10}.`, `Then the ones: ${a - Math.floor(b / 10) * 10} ${MINUS} ${b % 10} = ${d}.`, `Check: ${d} + ${b} = ${a} ✓`] };
  } },
  g2oddeven: { name: "Odd or even", std: "2.OA.C.3", glyph: "2n", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); const n = rnd(2, 20), even = n % 2 === 0;
    return { ask: "Can the dots be put in pairs with none left over?", prompt: `${n} is <span class="blank">?</span>`, plain: `Is ${n} odd or even?`, viz: dotArray(2, Math.ceil(n / 2)).replace(/(<circle[^>]*>)(?![\s\S]*<circle)/, even ? "$1" : ""), kind: "choice", answer: even ? "even" : "odd",
      choices: [{ v: "odd", label: "odd" }, { v: "even", label: "even" }],
      steps: [`Make pairs: ${Math.floor(n / 2)} pairs.`, even ? "None are left over." : "One is left over.", `So ${n} is ${even ? "even" : "odd"}.`] };
  } },
  g2money: { name: "Count coins", std: "2.MD.C.8", glyph: "¢", c: "serve", band: "k2", gen(r) {
    const rnd = rndWith(r); const q = rnd(0, 3), d = rnd(0, 4), n = rnd(0, 3), p = rnd(0, 4), cents = q * 25 + d * 10 + n * 5 + p || 1;
    const parts = [[q, "quarter", 25], [d, "dime", 10], [n, "nickel", 5], [p || (cents === 1 ? 1 : 0), "penny", 1]].filter(([k]) => Number(k) > 0) as [number, string, number][];
    const words = parts.map(([k, w]) => `${k} ${k === 1 ? w : w === "penny" ? "pennies" : w + "s"}`).join(", ");
    return { ask: `How many cents is ${words}?`, prompt: `<span class="blank">?</span> ¢`, plain: `${words}`, viz: coinsSvg([...Array(q).fill(25), ...Array(d).fill(10), ...Array(n).fill(5), ...Array(p || (cents === 1 ? 1 : 0)).fill(1)]), answer: cents,
      steps: [...parts.map(([k, w, v]) => `${k} ${k === 1 ? w : w === "penny" ? "pennies" : w + "s"} = ${k * v}¢.`), `Add them: ${parts.map(([k, , v]) => k * v).join(" + ")} = ${cents}¢.`] };
  } },
  g2place: { name: "Hundreds, tens and ones", std: "2.NBT.A.1", glyph: "100", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const n = rnd(101, 999), H = Math.floor(n / 100), T = Math.floor(n / 10) % 10, O = n % 10, which = pick(["hundreds", "tens", "ones"] as const);
    const ans = which === "hundreds" ? H : which === "tens" ? T : O;
    return { ask: `How many ${which} are in ${n}?`, prompt: `${n} = ${which === "hundreds" ? '<span class="blank">?</span>' : H} hundreds + ${which === "tens" ? '<span class="blank">?</span>' : T} tens + ${which === "ones" ? '<span class="blank">?</span>' : O} ones`, plain: `${which} in ${n}`, long: true, answer: ans,
      steps: [`The first digit is hundreds: ${H}.`, `The middle digit is tens: ${T}.`, `The last digit is ones: ${O}.`, `So there are ${ans} ${which}.`] };
  } },
  g3add1000: { name: "Add and subtract within 1000", std: "3.NBT.A.2", glyph: "±", c: "build", band: "g35", gen(r) {
    const rnd = rndWith(r); const add = r() < 0.5;
    if (add) { const a = rnd(120, 650), b = rnd(105, 999 - a), s = a + b; return { ask: "Add. Line up the places.", prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, answer: s,
      steps: [`Ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}.`, `Tens: ${Math.floor(a / 10) % 10} + ${Math.floor(b / 10) % 10}${(a % 10) + (b % 10) >= 10 ? " + 1 carried" : ""}.`, `Hundreds, then put it together: ${s}.`] }; }
    const a = rnd(300, 999), b = rnd(101, a - 50), d = a - b;
    return { ask: "Subtract. Line up the places.", prompt: `${a} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${a} ${MINUS} ${b}`, answer: d,
      steps: [`Start with the ones. Regroup a ten if you need more ones.`, `Then the tens, then the hundreds.`, `${a} ${MINUS} ${b} = ${d}. Check: ${d} + ${b} = ${a} ✓`] };
  } },
  g3area: { name: "Area of rectangles", std: "3.MD.C.7", glyph: "▭", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r); const w = rnd(2, 9), h = rnd(2, 8), A = w * h;
    return { ask: `A rectangle is ${w} units long and ${h} units wide. What is its area in square units?`, prompt: `${w} × ${h} = <span class="blank">?</span> square units`, plain: `area of ${w} by ${h}`, viz: dotArray(h, w), answer: A,
      steps: ["Area = length × width.", `${w} × ${h} = ${A}.`, `The area is ${A} square units.`] };
  } },
  g3round: { name: "Round to 10 or 100", std: "3.NBT.A.1", glyph: "≈", c: "help", band: "g35", gen(r) {
    const rnd = rndWith(r); const to = r() < 0.5 ? 10 : 100, n = to === 10 ? rnd(11, 989) : rnd(110, 989), ans = Math.round(n / to) * to, digit = to === 10 ? n % 10 : Math.floor(n / 10) % 10;
    return { ask: `Round ${n} to the nearest ${to}.`, prompt: `${n} ≈ <span class="blank">?</span>`, plain: `round ${n} to the nearest ${to}`, viz: roundLine(n, Math.floor(n / to) * to, Math.floor(n / to) * to + to), answer: ans,
      steps: [`Look at the ${to === 10 ? "ones" : "tens"} digit: ${digit}.`, digit >= 5 ? "5 or more rounds up." : "4 or less rounds down.", `${n} rounds to ${ans}.`] };
  } },
  g4mult: { name: "Multiply multi-digit numbers", std: "4.NBT.B.5", glyph: "×", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r); const two = r() < 0.5, a = two ? rnd(11, 49) : rnd(102, 989), b = two ? rnd(11, 29) : rnd(2, 9), p = a * b;
    const T = Math.floor(b / 10) * 10, O = b % 10;
    return { ask: "Multiply. Break a number into parts if it helps.", prompt: `${a} × ${b} = <span class="blank">?</span>`, plain: `${a} × ${b}`, viz: areaModel(a, b), answer: p,
      steps: two ? [`Split ${b} into ${T} and ${O}.`, `${a} × ${T} = ${a * T}.`, `${a} × ${O} = ${a * O}.`, `${a * T} + ${a * O} = ${p}.`]
        : [`Split ${a} into ${Math.floor(a / 100) * 100}, ${Math.floor(a / 10) % 10 * 10} and ${a % 10}.`, `Multiply each by ${b}: ${Math.floor(a / 100) * 100 * b}, ${Math.floor(a / 10) % 10 * 10 * b}, ${a % 10 * b}.`, `Add them: ${p}.`] };
  } },
  g4div: { name: "Divide multi-digit numbers", std: "4.NBT.B.6", glyph: "÷", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r); const d = rnd(2, 9), q = rnd(12, 250), n = d * q;
    return { ask: "Divide.", prompt: `${n} ÷ ${d} = <span class="blank">?</span>`, plain: `${n} ÷ ${d}`, answer: q,
      steps: [`Think: ${d} × ? = ${n}.`, `Try ${Math.floor(q / 10) * 10}: ${d} × ${Math.floor(q / 10) * 10} = ${d * Math.floor(q / 10) * 10}. ${n - d * Math.floor(q / 10) * 10} is left.`, `${d} × ${q % 10} = ${d * (q % 10)}.`, `${Math.floor(q / 10) * 10} + ${q % 10} = ${q}.`] };
  } },
  g4perim: { name: "Perimeter", std: "4.MD.A.3", glyph: "▢", c: "nature", band: "g35", gen(r) {
    const rnd = rndWith(r); const l = rnd(3, 25), w = rnd(2, 20), P2 = 2 * (l + w), findSide = r() < 0.35;
    if (findSide) return { ask: `A rectangle has a perimeter of ${P2} units. One side is ${l}. How long is the other side?`, prompt: `2 × (${l} + <span class="blank">?</span>) = ${P2}`, plain: `perimeter ${P2}, side ${l}`, viz: labeledRect(l, w, `${l}`, "?"), answer: w,
      steps: [`Half the perimeter is one length plus one width: ${P2} ÷ 2 = ${l + w}.`, `${l + w} ${MINUS} ${l} = ${w}.`] };
    return { ask: `A rectangle is ${l} units long and ${w} units wide. What is its perimeter?`, prompt: `${l} + ${w} + ${l} + ${w} = <span class="blank">?</span>`, plain: `perimeter of ${l} by ${w}`, viz: labeledRect(l, w, `${l}`, `${w}`), answer: P2,
      steps: ["Perimeter is the distance all the way around.", `${l} + ${w} = ${l + w}.`, `Two of those: 2 × ${l + w} = ${P2}.`] };
  } },
  g5dec: { name: "Add and subtract decimals", std: "5.NBT.B.7", glyph: ".5", c: "tech", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(105, 980) / 100, b = rnd(11, 499) / 100, add = r() < 0.5 || b >= a, ans = Math.round((add ? a + b : a - b) * 100) / 100;
    return { ask: "Line up the decimal points.", prompt: `${a.toFixed(2)} ${add ? "+" : MINUS} ${b.toFixed(2)} = <span class="blank">?</span>`, plain: `${a.toFixed(2)} ${add ? "+" : MINUS} ${b.toFixed(2)}`, answer: ans,
      steps: ["Line up the decimal points, one under the other.", add ? "Add the hundredths, then tenths, then ones." : "Subtract the hundredths, then tenths, then ones. Regroup if needed.", `${a.toFixed(2)} ${add ? "+" : MINUS} ${b.toFixed(2)} = ${ans.toFixed(2)}.`] };
  } },
  g5mult: { name: "Multi-digit multiplication", std: "5.NBT.B.5", glyph: "×", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(102, 899), b = rnd(12, 79), p = a * b, T = Math.floor(b / 10) * 10, O = b % 10;
    return { ask: "Multiply.", prompt: `${a} × ${b} = <span class="blank">?</span>`, plain: `${a} × ${b}`, long: true, viz: areaModel(a, b), answer: p,
      steps: [`Split ${b} into ${T} and ${O}.`, `${a} × ${O} = ${a * O}.`, `${a} × ${T} = ${a * T}.`, `${a * O} + ${a * T} = ${p}.`] };
  } },
  g5volume: { name: "Volume of boxes", std: "5.MD.C.5", glyph: "▣", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r); const l = rnd(2, 9), w = rnd(2, 6), h = rnd(2, 8), V = l * w * h;
    return { ask: `A box is ${l} cm long, ${w} cm wide and ${h} cm tall. What is its volume in cubic cm?`, prompt: `${l} × ${w} × ${h} = <span class="blank">?</span>`, plain: `volume of ${l} by ${w} by ${h}`, viz: boxSvg(`${l} cm`, `${w} cm`, `${h} cm`), answer: V,
      steps: ["Volume = length × width × height.", `${l} × ${w} = ${l * w} (the bottom layer).`, `${l * w} × ${h} = ${V} cubic cm.`] };
  } },
  g5order: { name: "Order of operations", std: "5.OA.A.1", glyph: "( )", c: "fly", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 6), paren = r() < 0.5;
    const ans = paren ? (a + b) * c : a + b * c;
    return { ask: "Use the order of operations.", prompt: paren ? `(${a} + ${b}) × ${c} = <span class="blank">?</span>` : `${a} + ${b} × ${c} = <span class="blank">?</span>`, plain: paren ? `(${a} + ${b}) × ${c}` : `${a} + ${b} × ${c}`, answer: ans,
      steps: paren ? [`Parentheses first: ${a} + ${b} = ${a + b}.`, `Then multiply: ${a + b} × ${c} = ${ans}.`] : [`Multiply before adding: ${b} × ${c} = ${b * c}.`, `Then add: ${a} + ${b * c} = ${ans}.`] };
  } },
  g6exp: { name: "Exponents", std: "6.EE.A.1", glyph: "x²", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); const e = rnd(2, 4), b = e === 2 ? rnd(2, 15) : e === 3 ? rnd(2, 6) : rnd(2, 4), v = b ** e;
    return { ask: "Find the value.", prompt: `${b}<sup>${e}</sup> = <span class="blank">?</span>`, plain: `${b} to the power ${e}`, answer: v,
      steps: [`${b}<sup>${e}</sup> means ${b} multiplied ${e} times.`, `${Array(e).fill(b).join(" × ")}.`, `= ${v}.`] };
  } },
  g6eval: { name: "Evaluate expressions", std: "6.EE.A.2c", glyph: "x", c: "serve", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), b = rnd(1, 20), x = rnd(2, 12), v = a * x + b;
    return { ask: `Find the value when x = ${x}.`, prompt: `${a}x + ${b} = <span class="blank">?</span>`, plain: `${a}x + ${b} when x = ${x}`, answer: v,
      steps: [`Put ${x} in for x: ${a} · ${x} + ${b}.`, `Multiply first: ${a} · ${x} = ${a * x}.`, `${a * x} + ${b} = ${v}.`] };
  } },
  g6gcf: { name: "Greatest common factor", std: "6.NS.B.4", glyph: "GCF", c: "teach", band: "g68", gen(r) {
    const rnd = rndWith(r); let g: number, a: number, b: number; do { g = rnd(2, 12); a = g * rnd(2, 8); b = g * rnd(2, 8); } while (a === b || a > 100 || b > 100);
    const G = gcd(a, b);
    return { ask: `What is the greatest common factor of ${a} and ${b}?`, prompt: `GCF(${a}, ${b}) = <span class="blank">?</span>`, plain: `GCF of ${a} and ${b}`, answer: G,
      steps: [`List factors of ${a} and ${b}, or divide both by the same number.`, `${a} = ${G} × ${a / G} and ${b} = ${G} × ${b / G}.`, `${a / G} and ${b / G} share no factor but 1, so the GCF is ${G}.`] };
  } },
  g6rate: { name: "Unit rates", std: "6.RP.A.3b", glyph: "/1", c: "help", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const unit = rnd(2, 15), n = rnd(2, 9), total = unit * n, [what, per] = pick([["miles", "hour"], ["dollars", "ticket"], ["words", "minute"], ["pages", "day"]] as const);
    return { ask: `${total} ${what} in ${n} ${per}s. How many ${what} per ${per}?`, prompt: `${total} ÷ ${n} = <span class="blank">?</span> ${what} per ${per}`, plain: `${total} ${what} in ${n} ${per}s`, answer: unit,
      steps: ["A unit rate is the amount for 1.", `Divide: ${total} ÷ ${n} = ${unit}.`, `${unit} ${what} per ${per}.`] };
  } },
  g7prop: { name: "Solve proportions", std: "7.RP.A.2", glyph: "a:b", c: "nature", band: "g68", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(1, 9); b = rnd(2, 12); } while (a >= b && r() < 0.5);
    const k = rnd(2, 8), d = b * k, x = a * k;
    return { ask: "Solve for x.", prompt: `${frac(a, b)} = ${frac("x", d)}`, plain: `${a}/${b} = x/${d}`, answer: x,
      steps: [`${b} times what is ${d}? ${d} ÷ ${b} = ${k}.`, `Do the same to the top: ${a} × ${k} = ${x}.`, `x = ${x}.`] };
  } },
  g7muldiv: { name: "Multiply and divide integers", std: "7.NS.A.2", glyph: "±×", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(-12, 12); b = rnd(-9, 9); } while (!a || !b || (a > 0 && b > 0));
    const mul = r() < 0.5, ans = mul ? a * b : a, top = mul ? a : a * b;
    const same = (mul ? a : top) < 0 === b < 0;
    return { ask: mul ? "Multiply." : "Divide.", prompt: mul ? `${N(a)} × ${P(b)} = <span class="blank">?</span>` : `${N(top)} ÷ ${P(b)} = <span class="blank">?</span>`, plain: mul ? `${N(a)} × ${P(b)}` : `${N(top)} ÷ ${P(b)}`, answer: ans,
      steps: [mul ? `${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(a * b)}.` : `${Math.abs(top)} ÷ ${Math.abs(b)} = ${Math.abs(a)}.`, same ? "Same signs give a positive answer." : "Different signs give a negative answer.", `= ${N(ans)}.`] };
  } },
  g8sqrt: { name: "Square roots", std: "8.EE.A.2", glyph: "√", c: "fly", band: "g68", gen(r) {
    const rnd = rndWith(r); const n = rnd(2, 15), sq = n * n;
    return { ask: "Find the square root.", prompt: `√${sq} = <span class="blank">?</span>`, plain: `square root of ${sq}`, answer: n,
      steps: [`Which number times itself is ${sq}?`, `${n} × ${n} = ${sq}.`, `So √${sq} = ${n}.`] };
  } },
  g8pyth: { name: "Pythagorean theorem", std: "8.G.B.7", glyph: "a²", c: "coral", band: "g68", gen(r) {
    const pick = pickWith(r); const [a0, b0, c0] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]] as const), k = pick([1, 1, 2, 3]), a = a0 * k, b = b0 * k, c = c0 * k, leg = r() < 0.35;
    if (leg) return { ask: `A right triangle has a hypotenuse of ${c} and one leg of ${a}. How long is the other leg?`, prompt: `${a}² + <span class="blank">?</span>² = ${c}²`, plain: `legs ${a} and ?, hypotenuse ${c}`, viz: rightTriangle(`${a}`, "?", `${c}`), answer: b,
      steps: ["a² + b² = c².", `${c}² ${MINUS} ${a}² = ${c * c} ${MINUS} ${a * a} = ${b * b}.`, `√${b * b} = ${b}.`] };
    return { ask: `A right triangle has legs ${a} and ${b}. How long is the hypotenuse?`, prompt: `${a}² + ${b}² = <span class="blank">?</span>²`, plain: `legs ${a} and ${b}`, viz: rightTriangle(`${a}`, `${b}`, "?"), answer: c,
      steps: ["a² + b² = c².", `${a * a} + ${b * b} = ${c * c}.`, `√${c * c} = ${c}.`] };
  } },
  hsfunc: { name: "Evaluate functions", std: "HSF-IF.A.2", glyph: "f(x)", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r); const a = rnd(1, 4), b = rnd(-6, 6), c = rnd(-9, 9), x = rnd(-4, 5), v = a * x * x + b * x + c;
    const f = `${a === 1 ? "" : a}x²${b ? ` ${b < 0 ? MINUS : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x` : ""}${c ? ` ${sgn(c)}` : ""}`;
    return { ask: `Find f(${N(x)}).`, prompt: `f(x) = ${f}`, plain: `f(x) = ${f}, find f(${N(x)})`, long: true, answer: v,
      steps: [`Put ${N(x)} in for every x.`, `${a === 1 ? "" : a + " · "}${P(x)}² = ${a * x * x}${b ? `, ${N(b)} · ${P(x)} = ${N(b * x)}` : ""}.`, `${a * x * x}${b ? ` ${sgn(b * x)}` : ""}${c ? ` ${sgn(c)}` : ""} = ${N(v)}.`] };
  } },
  hssystem: { name: "Systems of equations", std: "HSA-REI.C.6", glyph: "{ }", c: "nature", band: "g912", gen(r) {
    const rnd = rndWith(r); const x = rnd(-5, 8), y = rnd(-5, 8), s = x + y, d = x - y;
    return { ask: "Solve the system. Enter the value of x.", long: true, prompt: `x + y = ${N(s)}<br>x ${MINUS} y = ${N(d)}`, plain: `x + y = ${N(s)} and x − y = ${N(d)}`, answer: x,
      steps: ["Add the two equations: the y's cancel.", `2x = ${N(s)} + ${P(d)} = ${N(s + d)}.`, `x = ${N(x)}.`, `Then y = ${N(s)} ${MINUS} ${P(x)} = ${N(y)}.`] };
  } },
  // ─── More grade-level lessons (Common Core codes, which many states use as their own). ───
  kaddsub5: { name: "Add and subtract within 5", std: "K.OA.A.5", glyph: "±", c: "heal", band: "k2", gen(r) {
    const rnd = rndWith(r); const add = r() < 0.5, a = rnd(1, 4), b = add ? rnd(1, 5 - a) : rnd(1, a), ans = add ? a + b : a - b;
    return { ask: add ? "Add." : "Take away.", prompt: `${a} ${add ? "+" : MINUS} ${b} = <span class="blank">?</span>`, plain: `${a} ${add ? "+" : MINUS} ${b}`, viz: tenFrames([{ n: add ? a : a, cls: "d1" }, ...(add ? [{ n: b, cls: "d2" }] : [])], add ? 0 : b), answer: ans,
      steps: add ? [`Start with ${a}.`, `Count on ${b}.`, `${a} + ${b} = ${ans}.`] : [`Start with ${a}.`, `Take away ${b}.`, `${ans} ${ans === 1 ? "is" : "are"} left.`] };
  } },
  kteens: { name: "Ten and some more", std: "K.NBT.A.1", glyph: "10+", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); const o = rnd(1, 9), n = 10 + o;
    return { ask: `${n} is 10 and how many more?`, prompt: `${n} = 10 + <span class="blank">?</span>`, plain: `${n} = 10 + ?`, viz: tenFrames([{ n: 10, cls: "d1" }, { n: o, cls: "d2" }]), answer: o,
      steps: ["The first frame is full: that is 10.", `Count the dots in the second frame: ${o}.`, `${n} = 10 + ${o}.`] };
  } },
  g1compare: { name: "Compare two-digit numbers", std: "1.NBT.B.3", glyph: "<>", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(10, 99); b = rnd(10, 99); } while (a === b && r() < 0.85);
    const sym = a > b ? ">" : a < b ? "<" : "=";
    return { ask: "Which symbol makes this true?", prompt: `${a} <span class="blank">?</span> ${b}`, plain: `${a} ? ${b}`, kind: "choice", answer: sym, choices: ["<", "=", ">"].map((v) => ({ v, label: v })),
      steps: [`Compare the tens first: ${Math.floor(a / 10)} tens and ${Math.floor(b / 10)} tens.`, Math.floor(a / 10) === Math.floor(b / 10) ? `The tens are the same, so compare the ones: ${a % 10} and ${b % 10}.` : "The number with more tens is bigger.", `${a} ${sym} ${b}.`] };
  } },
  g1word: { name: "Word problems within 20", std: "1.OA.A.1", glyph: "?", c: "help", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const name = pick(["Mia", "Leo", "Ava", "Sam", "Zoe", "Eli"]), thing = pick(["stickers", "shells", "marbles", "crayons", "cards"]);
    const kind = rnd(0, 2), a = rnd(5, 12), b = rnd(2, 8);
    if (kind === 0) return { ask: `${name} has ${a} ${thing}. ${name} gets ${b} more. How many ${thing} now?`, prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, viz: tape([{ parts: [{ label: `${a}`, size: a, fill: true }, { label: `${b}`, size: b }], whole: "?" }]), answer: a + b, steps: ["Getting more means add.", `${a} + ${b} = ${a + b}.`] };
    if (kind === 1) { const t = a + b; return { ask: `${name} has ${t} ${thing}. ${name} gives away ${b}. How many are left?`, prompt: `${t} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${t} − ${b}`, viz: tape([{ parts: [{ label: "?", size: a }, { label: `${b}`, size: b, fill: true }], whole: `${t}` }]), answer: a, steps: ["Giving away means subtract.", `${t} ${MINUS} ${b} = ${a}.`] }; }
    const t = a + b; return { ask: `${name} has ${a} ${thing}. ${name} wants ${t}. How many more does ${name} need?`, prompt: `${a} + <span class="blank">?</span> = ${t}`, plain: `${a} + ? = ${t}`, viz: tape([{ parts: [{ label: `${a}`, size: a, fill: true }, { label: "?", size: b }], whole: `${t}` }]), answer: b, steps: [`Count up from ${a} to ${t}.`, `${t} ${MINUS} ${a} = ${b}.`] };
  } },
  g1time: { name: "Tell time to the hour", std: "1.MD.B.3", glyph: "🕒", c: "nature", band: "k2", gen(r) {
    const rnd = rndWith(r); const h = rnd(1, 12), half = r() < 0.5;
    const at = (deg: number, len: number) => [50 + len * Math.sin((deg * Math.PI) / 180), 50 - len * Math.cos((deg * Math.PI) / 180)].map((v) => Math.round(v * 10) / 10);
    const [hx, hy] = at(((h % 12) + (half ? 0.5 : 0)) * 30, 22), [mx, my] = at(half ? 180 : 0, 34);
    const nums = Array.from({ length: 12 }, (_, i) => { const [x, y] = at((i + 1) * 30, 38); return `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="9" fill="currentColor">${i + 1}</text>`; }).join("");
    const viz = `<svg class="viz" viewBox="0 0 100 100" style="width:150px" role="img" aria-label="A clock"><circle cx="50" cy="50" r="47" class="cell"/>${nums}<line x1="50" y1="50" x2="${mx}" y2="${my}" class="axis" style="stroke-width:2.5"/><line x1="50" y1="50" x2="${hx}" y2="${hy}" class="beam"/><circle cx="50" cy="50" r="3" class="fulcrum"/></svg>`;
    return { ask: half ? "What time is it? The long hand is on the 6, so it is half past. Type the hour." : "What time is it? Type the hour.", prompt: `<span class="blank">?</span>:${half ? "30" : "00"}`, plain: half ? "half past ?" : "? o'clock", viz, answer: h,
      steps: ["The short hand shows the hour.", half ? `It is halfway past the ${h}.` : `It points to the ${h}.`, `The time is ${h}:${half ? "30" : "00"}.`] };
  } },
  g2word: { name: "Word problems within 100", std: "2.OA.A.1", glyph: "?", c: "help", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const name = pick(["Nora", "Jay", "Lily", "Max", "Ivy", "Omar"]), thing = pick(["pages", "beads", "points", "seeds", "blocks"]);
    const a = rnd(15, 60), b = rnd(8, 99 - a), t = a + b;
    return r() < 0.5 ? { ask: `${name} had ${a} ${thing} and got ${b} more. How many in all?`, prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, viz: tape([{ parts: [{ label: `${a}`, size: a, fill: true }, { label: `${b}`, size: b }], whole: "?" }]), answer: t, steps: ["In all means add.", `${a} + ${b} = ${t}.`] }
      : { ask: `${name} had ${t} ${thing} and used ${b}. How many are left?`, prompt: `${t} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${t} − ${b}`, viz: tape([{ parts: [{ label: "?", size: a }, { label: `${b}`, size: b, fill: true }], whole: `${t}` }]), answer: a, steps: ["Left means subtract.", `${t} ${MINUS} ${b} = ${a}.`, `Check: ${a} + ${b} = ${t} ✓`] };
  } },
  g2tens: { name: "Add or take away 10 and 100", std: "2.NBT.B.8", glyph: "±10", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const step = pick([10, 100]), add = r() < 0.5, n = add ? rnd(100, 899) : rnd(step + 100, 999), ans = add ? n + step : n - step;
    return { ask: "Use place value. Only one digit changes.", prompt: `${n} ${add ? "+" : MINUS} ${step} = <span class="blank">?</span>`, plain: `${n} ${add ? "+" : MINUS} ${step}`, viz: wholeChart(n), answer: ans,
      steps: [`${step} is 1 ${step === 10 ? "ten" : "hundred"}.`, `The ${step === 10 ? "tens" : "hundreds"} digit goes ${add ? "up" : "down"} by 1.`, `${n} ${add ? "+" : MINUS} ${step} = ${ans}.`] };
  } },
  g2length: { name: "Length word problems", std: "2.MD.B.5", glyph: "📏", c: "nature", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const [obj, unit] = pick([["ribbon", "inches"], ["rope", "feet"], ["track", "meters"], ["string", "centimeters"]] as const), a = rnd(12, 60), b = rnd(5, 35), longer = r() < 0.5;
    return longer ? { ask: `A ${obj} is ${a} ${unit} long. Another is ${b} ${unit} longer. How long is the second ${obj}?`, prompt: `${a} + ${b} = <span class="blank">?</span> ${unit}`, plain: `${a} + ${b}`, viz: tape([{ name: "First", parts: [{ label: `${a}`, size: a, fill: true }] }, { name: "Second", parts: [{ label: `${a}`, size: a, fill: true }, { label: `${b}`, size: b }], whole: "?" }]), answer: a + b, steps: ["Longer means add.", `${a} + ${b} = ${a + b} ${unit}.`] }
      : { ask: `A ${obj} is ${a + b} ${unit} long. ${b} ${unit} are cut off. How long is it now?`, prompt: `${a + b} ${MINUS} ${b} = <span class="blank">?</span> ${unit}`, plain: `${a + b} − ${b}`, viz: tape([{ parts: [{ label: "?", size: a }, { label: `${b} cut`, size: b, fill: true }], whole: `${a + b}` }]), answer: a, steps: ["Cut off means subtract.", `${a + b} ${MINUS} ${b} = ${a} ${unit}.`] };
  } },
  g3eqfrac: { name: "Equivalent fractions", std: "3.NF.A.3b", glyph: "=½", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([2, 3, 4, 6]), n = rnd(1, d - 1), k = pick([2, 3, 4].filter((x) => d * x <= 12)), D = d * k;
    return { ask: "Find the missing number.", prompt: `${frac(n, d)} = ${frac('<span class="blank">?</span>', D)}`, plain: `${n}/${d} = ?/${D}`, viz: fractionBars(n, d, n * k, D), answer: n * k,
      steps: [`${d} × ${k} = ${D}, so the pieces are ${k} times smaller.`, `Multiply the top by ${k} too: ${n} × ${k} = ${n * k}.`, `${n}/${d} = ${n * k}/${D}.`] };
  } },
  g3twostep: { name: "Two-step word problems", std: "3.OA.D.8", glyph: "2×", c: "help", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const name = pick(["Rosa", "Ben", "Kai", "Tess", "Ali"]), packs = rnd(2, 8), per = rnd(3, 9), extra = rnd(2, 15), total = packs * per;
    return r() < 0.5 ? { ask: `${name} buys ${packs} packs of ${per} pencils and already has ${extra}. How many pencils now?`, prompt: `${packs} × ${per} + ${extra} = <span class="blank">?</span>`, plain: `${packs} × ${per} + ${extra}`, viz: tape([{ parts: [...Array.from({ length: packs }, () => ({ label: `${per}`, size: per, fill: true })), { label: `${extra}`, size: extra }], whole: "?" }]), answer: total + extra,
        steps: [`First the packs: ${packs} × ${per} = ${total}.`, `Then add the ${extra}: ${total} + ${extra} = ${total + extra}.`] }
      : { ask: `${name} has ${total + extra} cards, gives away ${extra}, and shares the rest equally with ${packs} friends. How many does each friend get?`, prompt: `(${total + extra} ${MINUS} ${extra}) ÷ ${packs} = <span class="blank">?</span>`, plain: `(${total + extra} − ${extra}) ÷ ${packs}`, viz: tape([{ parts: [{ label: `${extra}`, size: extra, fill: true }, ...Array.from({ length: packs }, () => ({ label: "?", size: per }))], whole: `${total + extra}` }]), answer: per,
        steps: [`First take away: ${total + extra} ${MINUS} ${extra} = ${total}.`, `Then share: ${total} ÷ ${packs} = ${per}.`] };
  } },
  g3elapsed: { name: "Elapsed time", std: "3.MD.A.1", glyph: "⏱", c: "nature", band: "g35", gen(r) {
    const rnd = rndWith(r); const h = rnd(1, 11), m = rnd(0, 11) * 5, add = rnd(2, 11) * 5, end = h * 60 + m + add, eh = Math.floor(end / 60), em = end % 60;
    const t = (hh: number, mm: number) => `${((hh - 1) % 12) + 1}:${String(mm).padStart(2, "0")}`;
    return { ask: `Practice starts at ${t(h, m)} and ends at ${t(eh, em)}. How many minutes long is it?`, prompt: `<span class="blank">?</span> minutes`, plain: `${t(h, m)} to ${t(eh, em)}`, answer: add,
      steps: [m + add >= 60 ? `From ${t(h, m)} to ${t(h + 1, 0)} is ${60 - m} minutes.` : `Count on from ${t(h, m)} by fives.`, m + add >= 60 ? `From ${t(h + 1, 0)} to ${t(eh, em)} is ${em} minutes.` : `You reach ${t(eh, em)}.`, `${add} minutes in all.`] };
  } },
  g4addfrac: { name: "Add fractions, like denominators", std: "4.NF.B.3a", glyph: "+⅓", c: "build", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([4, 5, 6, 8, 10, 12]), a = rnd(1, d - 2), b = rnd(1, d - a - 1), sub = r() < 0.4;
    const [x, y] = sub ? [a + b, b] : [a, b], ans = sub ? a : a + b;
    return { ask: "Find the top number of the answer. The bottom stays the same.", prompt: `${frac(x, d)} ${sub ? MINUS : "+"} ${frac(y, d)} = ${frac('<span class="blank">?</span>', d)}`, plain: `${x}/${d} ${sub ? "−" : "+"} ${y}/${d}`, viz: fractionBars(x, d, y, d), answer: ans,
      steps: ["The pieces are the same size, so the denominator stays the same.", `${sub ? "Subtract" : "Add"} the tops: ${x} ${sub ? MINUS : "+"} ${y} = ${ans}.`, `${x}/${d} ${sub ? MINUS : "+"} ${y}/${d} = ${ans}/${d}.`] };
  } },
  g4prime: { name: "Prime or composite", std: "4.OA.B.4", glyph: "P", c: "fly", band: "g35", gen(r) {
    const rnd = rndWith(r); const n = rnd(2, 99); let f = 0; for (let i = 2; i * i <= n; i++) if (n % i === 0) { f = i; break; }
    const prime = !f;
    return { ask: `Is ${n} prime or composite?`, prompt: `${n} is <span class="blank">?</span>`, plain: `Is ${n} prime or composite?`, kind: "choice", answer: prime ? "prime" : "composite", choices: [{ v: "prime", label: "prime" }, { v: "composite", label: "composite" }],
      steps: ["A prime number has exactly two factors: 1 and itself.", prime ? `No number from 2 up to ${Math.floor(Math.sqrt(n))} divides ${n} evenly.` : `${n} = ${f} × ${n / f}, so it has more factors.`, `${n} is ${prime ? "prime" : "composite"}.`] };
  } },
  g4round: { name: "Round multi-digit numbers", std: "4.NBT.A.3", glyph: "≈", c: "help", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const to = pick([100, 1000, 10000]), n = rnd(to + 1, Math.min(99999, to * 90)), ans = Math.round(n / to) * to, digit = Math.floor(n / (to / 10)) % 10;
    const place = to === 100 ? "hundred" : to === 1000 ? "thousand" : "ten thousand";
    return { ask: `Round ${n.toLocaleString("en-US")} to the nearest ${place}.`, prompt: `≈ <span class="blank">?</span>`, plain: `round ${n} to the nearest ${place}`, viz: roundLine(n, Math.floor(n / to) * to, Math.floor(n / to) * to + to, (v) => v.toLocaleString("en-US")), answer: ans,
      steps: [`Look at the digit to the right of the ${place}s place: ${digit}.`, digit >= 5 ? "5 or more rounds up." : "4 or less rounds down.", `${n.toLocaleString("en-US")} rounds to ${ans.toLocaleString("en-US")}.`] };
  } },
  g4angle: { name: "Missing angles", std: "4.MD.C.7", glyph: "∠", c: "coral", band: "g35", gen(r) {
    const rnd = rndWith(r); const whole = r() < 0.5 ? 90 : 180, a = rnd(2, whole / 5 - 2) * 5, b = whole - a;
    return { ask: `Two angles make a ${whole === 90 ? "right angle (90°)" : "straight line (180°)"}. One is ${a}°. What is the other?`, prompt: `${a}° + <span class="blank">?</span>° = ${whole}°`, plain: `${a} + ? = ${whole}`, viz: angleSplit(a, whole), answer: b,
      steps: [`Together they make ${whole}°.`, `${whole} ${MINUS} ${a} = ${b}.`, `The other angle is ${b}°.`] };
  } },
  g5fracwhole: { name: "Fraction of a whole number", std: "5.NF.B.4a", glyph: "⅔×", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([2, 3, 4, 5, 6, 8]), n = rnd(1, d - 1), w = d * rnd(2, 12), ans = (w / d) * n;
    return { ask: "Multiply.", prompt: `${frac(n, d)} × ${w} = <span class="blank">?</span>`, plain: `${n}/${d} of ${w}`, viz: tape([{ parts: Array.from({ length: d }, (_, i) => ({ label: "", size: 1, fill: i < n })), whole: `${w}` }]), answer: ans,
      steps: [`Find ${frac(1, d)} of ${w}: ${w} ÷ ${d} = ${w / d}.`, `Then ${n} of those: ${n} × ${w / d} = ${ans}.`] };
  } },
  g5pow10: { name: "Multiply and divide by 10, 100, 1000", std: "5.NBT.A.2", glyph: "×10", c: "tech", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const p = pick([10, 100, 1000]), mul = r() < 0.5, x = rnd(12, 9999) / 100, ans = Math.round((mul ? x * p : x / p) * 1e6) / 1e6;
    const zeros = String(p).length - 1;
    return { ask: `Move the decimal point ${zeros} place${zeros > 1 ? "s" : ""} to the ${mul ? "right" : "left"}.`, prompt: `${x} ${mul ? "×" : "÷"} ${p} = <span class="blank">?</span>`, plain: `${x} ${mul ? "×" : "÷"} ${p}`, answer: ans,
      steps: [`${p} has ${zeros} zero${zeros > 1 ? "s" : ""}.`, `${mul ? "Multiplying" : "Dividing"} moves every digit ${zeros} place${zeros > 1 ? "s" : ""} ${mul ? "left (bigger)" : "right (smaller)"}.`, `${x} ${mul ? "×" : "÷"} ${p} = ${ans}.`] };
  } },
  g5coord: { name: "Read a coordinate point", std: "5.G.A.2", glyph: "(x,y)", c: "fly", band: "g35", gen(r) {
    const rnd = rndWith(r); const x = rnd(1, 5), y = rnd(1, 5), askX = r() < 0.5;
    return { ask: `What is the ${askX ? "x" : "y"}-coordinate of the point?`, prompt: askX ? `(<span class="blank">?</span>, ${y})` : `(${x}, <span class="blank">?</span>)`, plain: `the ${askX ? "x" : "y"}-coordinate`, viz: pointGrid(x, y), answer: askX ? x : y,
      steps: ["The x-coordinate is how far right you go.", "The y-coordinate is how far up you go.", `The point is (${x}, ${y}).`] };
  } },
  g6abs: { name: "Absolute value", std: "6.NS.C.7c", glyph: "|x|", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(-30, 30) || 7, b = rnd(-20, 20), two = r() < 0.4, ans = two ? Math.abs(a) + Math.abs(b) : Math.abs(a);
    return { ask: "Absolute value is the distance from 0.", prompt: two ? `|${N(a)}| + |${N(b)}| = <span class="blank">?</span>` : `|${N(a)}| = <span class="blank">?</span>`, plain: two ? `|${N(a)}| + |${N(b)}|` : `|${N(a)}|`, viz: two ? undefined : numberLine(a, Math.min(a, 0) - 1, Math.max(a, 0) + 1), answer: ans,
      steps: two ? [`|${N(a)}| = ${Math.abs(a)}.`, `|${N(b)}| = ${Math.abs(b)}.`, `${Math.abs(a)} + ${Math.abs(b)} = ${ans}.`] : [`${N(a)} is ${Math.abs(a)} steps from 0.`, `|${N(a)}| = ${ans}.`] };
  } },
  g6onestep: { name: "One-step equations", std: "6.EE.B.7", glyph: "x", c: "serve", band: "g68", gen(r) {
    const rnd = rndWith(r); const x = rnd(2, 30), k = rnd(2, 12), mulEq = r() < 0.5;
    return mulEq ? { ask: "Solve for x.", prompt: `${k}x = ${k * x}`, plain: `${k}x = ${k * x}`, viz: balance(`${k}x`, String(k * x)), answer: x, steps: [`Undo times ${k}: divide both sides by ${k}.`, `x = ${k * x} ÷ ${k} = ${x}.`] }
      : { ask: "Solve for x.", prompt: `x + ${k} = ${x + k}`, plain: `x + ${k} = ${x + k}`, viz: balance(`x + ${k}`, String(x + k)), answer: x, steps: [`Undo plus ${k}: subtract ${k} from both sides.`, `x = ${x + k} ${MINUS} ${k} = ${x}.`] };
  } },
  g6tri: { name: "Area of triangles", std: "6.G.A.1", glyph: "△", c: "create", band: "g68", gen(r) {
    const rnd = rndWith(r); const b = rnd(2, 14) * 2, h = rnd(2, 15), A = (b * h) / 2;
    return { ask: `A triangle has a base of ${b} cm and a height of ${h} cm. What is its area in square cm?`, prompt: `½ × ${b} × ${h} = <span class="blank">?</span>`, plain: `area, base ${b}, height ${h}`, viz: triangleBH(`${b} cm`, `${h} cm`), answer: A,
      steps: ["A triangle is half of a rectangle.", `${b} × ${h} = ${b * h}.`, `Half of ${b * h} is ${A}.`] };
  } },
  g6mean: { name: "Find the mean", std: "6.SP.B.5c", glyph: "x̄", c: "nature", band: "g68", gen(r) {
    const rnd = rndWith(r); const n = rnd(3, 6), mean = rnd(4, 40); const vals = Array.from({ length: n - 1 }, () => mean + rnd(-6, 6)); vals.push(mean * n - vals.reduce((s, v) => s + v, 0));
    if (vals.some((v) => v < 0)) vals.splice(0, vals.length, ...Array(n).fill(mean));
    return { ask: `Find the mean of these ${n} numbers.`, prompt: `${vals.join(", ")}`, plain: `mean of ${vals.join(", ")}`, long: true, answer: mean,
      steps: [`Add them: ${vals.join(" + ")} = ${mean * n}.`, `Divide by how many there are: ${mean * n} ÷ ${n} = ${mean}.`] };
  } },
  g7percent: { name: "Percent increase and discount", std: "7.RP.A.3", glyph: "%", c: "help", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const p = pick([10, 20, 25, 30, 40, 50, 15]), price = rnd(2, 20) * 20, off = r() < 0.6, change = (price * p) / 100, ans = off ? price - change : price + change;
    return { ask: off ? `A $${price} jacket is ${p}% off. What is the sale price in dollars?` : `A $${price} bill gets a ${p}% tip. What is the total in dollars?`, prompt: `$<span class="blank">?</span>`, plain: off ? `${p}% off ${price}` : `${price} plus ${p}%`, viz: tape([{ parts: [{ label: `${p}%`, size: p, fill: true }, { label: `${100 - p}%`, size: 100 - p }], whole: `$${price}` }]), answer: ans,
      steps: [`${p}% of ${price} = ${change}.`, off ? `${price} ${MINUS} ${change} = ${ans}.` : `${price} + ${change} = ${ans}.`] };
  } },
  g7circle: { name: "Circles: area and circumference", std: "7.G.B.4", glyph: "○", c: "coral", band: "g68", gen(r) {
    const rnd = rndWith(r); const rad = rnd(2, 12), area = r() < 0.5, hundredths = area ? 314 * rad * rad : 628 * rad, exact = hundredths / 100, ans = Math.round(hundredths / 100);
    return { ask: `A circle has a radius of ${rad} cm. Using π ≈ 3.14, find its ${area ? "area" : "circumference"}, rounded to the nearest whole number.`, prompt: area ? `3.14 × ${rad}² ≈ <span class="blank">?</span>` : `2 × 3.14 × ${rad} ≈ <span class="blank">?</span>`, plain: `${area ? "area" : "circumference"}, radius ${rad}`, long: true, viz: circleSvg(`r = ${rad} cm`), answer: ans,
      steps: [area ? "Area = π × r × r." : "Circumference = 2 × π × r.", `${area ? `3.14 × ${rad * rad}` : `2 × 3.14 × ${rad}`} = ${Math.round(exact * 100) / 100}.`, `Rounded: ${ans}.`] };
  } },
  g7prob: { name: "Simple probability", std: "7.SP.C.5", glyph: "🎲", c: "fly", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const red = rnd(1, 8), blue = rnd(1, 8), green = rnd(0, 6), total = red + blue + green, color = pick(["red", "blue"] as const), k = color === "red" ? red : blue;
    const opts = [...new Set([`${k}/${total}`, `${total - k}/${total}`, `${k}/${Math.max(1, total - k)}`, `${Math.min(total, k + 1)}/${total}`, `1/${total}`])].filter((o, i, all) => all.indexOf(o) === i).slice(0, 4);
    const shuffled = opts.map((v) => ({ v, k: r() })).sort((x, y) => x.k - y.k).map(({ v }) => ({ v, label: v }));
    return { ask: `A bag has ${red} red, ${blue} blue and ${green} green marbles. What is the chance of picking ${color}?`, prompt: `P(${color}) = <span class="blank">?</span>`, plain: `chance of ${color}`, long: true, kind: "choice", viz: marblesSvg([[red, "#ef5a45"], [blue, "#1f8fd6"], [green, "#2f9e57"]]), answer: `${k}/${total}`, choices: shuffled,
      steps: [`There are ${total} marbles in all.`, `${k} are ${color}.`, `P(${color}) = ${k}/${total}.`] };
  } },
  g8exp: { name: "Rules of exponents", std: "8.EE.A.1", glyph: "xⁿ", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const b = pick([2, 3, 5, 7, 10]), m = rnd(2, 9), n = rnd(2, 6), kind = rnd(0, 2);
    const [prompt, ans, step] = kind === 0 ? [`${b}<sup>${m}</sup> × ${b}<sup>${n}</sup> = ${b}<sup>?</sup>`, m + n, `Multiplying: add the exponents, ${m} + ${n} = ${m + n}.`]
      : kind === 1 ? [`${b}<sup>${m + n}</sup> ÷ ${b}<sup>${n}</sup> = ${b}<sup>?</sup>`, m, `Dividing: subtract the exponents, ${m + n} ${MINUS} ${n} = ${m}.`]
      : [`(${b}<sup>${m}</sup>)<sup>${n}</sup> = ${b}<sup>?</sup>`, m * n, `A power of a power: multiply the exponents, ${m} × ${n} = ${m * n}.`];
    return { ask: "Find the missing exponent.", prompt: String(prompt).replace("<sup>?</sup>", '<sup><span class="blank">?</span></sup>'), plain: String(prompt).replace(/<sup>(.*?)<\/sup>/g, "^$1"), answer: ans as number, steps: [step as string] };
  } },
  g8sci: { name: "Scientific notation", std: "8.EE.A.3", glyph: "×10ⁿ", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); const e = rnd(3, 8), lead = rnd(11, 99) / 10, n = Math.round(lead * 10 ** e);
    return { ask: `Write ${n.toLocaleString("en-US")} in scientific notation. What is the power of 10?`, prompt: `${n.toLocaleString("en-US")} = ${lead} × 10<sup><span class="blank">?</span></sup>`, plain: `${n} = ${lead} × 10^?`, long: true, answer: e,
      steps: [`Move the decimal point to make a number between 1 and 10: ${lead}.`, `It moved ${e} places.`, `${n.toLocaleString("en-US")} = ${lead} × 10<sup>${e}</sup>.`] };
  } },
  g8cyl: { name: "Volume of cylinders", std: "8.G.C.9", glyph: "⌭", c: "create", band: "g68", gen(r) {
    const rnd = rndWith(r); const rad = rnd(1, 6), h = rnd(2, 12), exact = (314 * rad * rad * h) / 100, ans = Math.round((314 * rad * rad * h) / 100);
    return { ask: `A cylinder has a radius of ${rad} in and a height of ${h} in. Using π ≈ 3.14, find its volume to the nearest whole cubic inch.`, prompt: `3.14 × ${rad}² × ${h} ≈ <span class="blank">?</span>`, plain: `cylinder, radius ${rad}, height ${h}`, long: true, viz: solidSvg("cylinder", `r = ${rad}`, `h = ${h}`), answer: ans,
      steps: ["Volume = π × r² × h.", `3.14 × ${rad * rad} × ${h} = ${Math.round(exact * 100) / 100}.`, `Rounded: ${ans}.`] };
  } },
  hsslope: { name: "Linear functions from a table", std: "HSF-LE.A.2", glyph: "Δ", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r); const m = rnd(-5, 6) || 2, b = rnd(-10, 10), xs = [0, 1, 2, 3], askB = r() < 0.4;
    const rows = xs.map((x) => `(${x}, ${N(m * x + b)})`).join(", ");
    return { ask: `These points are on a line y = mx + b: ${rows}. What is ${askB ? "b, the y-intercept" : "m, the slope"}?`, prompt: askB ? `b = <span class="blank">?</span>` : `m = <span class="blank">?</span>`, plain: `points ${rows}`, long: true, answer: askB ? b : m,
      steps: askB ? ["The y-intercept is y when x = 0.", `At x = 0, y = ${N(b)}.`] : ["Slope is how much y changes when x goes up by 1.", `${N(m * 1 + b)} ${MINUS} ${P(b)} = ${N(m)}.`] };
  } },
  hsmedian: { name: "Median of a data set", std: "HSS-ID.A.2", glyph: "M", c: "nature", band: "g912", gen(r) {
    const rnd = rndWith(r); const n = rnd(2, 4) * 2 + 1, vals = Array.from({ length: n }, () => rnd(1, 60)), sorted = [...vals].sort((a, b) => a - b), med = sorted[(n - 1) / 2];
    return { ask: `Find the median of these ${n} numbers.`, prompt: vals.join(", "), plain: `median of ${vals.join(", ")}`, long: true, answer: med,
      steps: [`Put them in order: ${sorted.join(", ")}.`, `The middle one (number ${(n + 1) / 2}) is ${med}.`] };
  } },
  hspoly: { name: "Add and subtract polynomials", std: "HSA-APR.A.1", glyph: "x²+", c: "serve", band: "g912", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const a = [rnd(1, 6), rnd(-8, 8), rnd(-9, 9)], b = [rnd(1, 6), rnd(-8, 8), rnd(-9, 9)], sub = r() < 0.5, which = pick([0, 1, 2]);
    const term = (c: number[]) => `${c[0] === 1 ? "" : c[0]}x² ${c[1] < 0 ? MINUS : "+"} ${Math.abs(c[1])}x ${c[2] < 0 ? MINUS : "+"} ${Math.abs(c[2])}`;
    const res = a.map((v, i) => (sub ? v - b[i] : v + b[i])), name = ["x²", "x", "constant"][which];
    return { ask: `Simplify. What is the ${name === "constant" ? "constant term" : `coefficient of ${name}`}?`, prompt: `(${term(a)}) ${sub ? MINUS : "+"} (${term(b)})`, plain: `(${term(a)}) ${sub ? "−" : "+"} (${term(b)})`, long: true, answer: res[which],
      steps: [sub ? "Subtracting: change every sign in the second part, then add." : "Add the like terms.", `${name === "constant" ? "Constants" : `${name} terms`}: ${N(a[which])} ${sub ? MINUS : "+"} ${P(b[which])} = ${N(res[which])}.`] };
  } },
  // ─── Batch: K–2, the rest of the standards ───
  kcount100: { name: "Count by ones and tens", std: "K.CC.A.1", glyph: "→", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r); const tens = r() < 0.5, start = tens ? rnd(1, 7) * 10 : rnd(1, 96), seq = tens ? [start, start + 10, start + 20] : [start, start + 1, start + 2], next = seq[2] + (tens ? 10 : 1);
    return { ask: `Count by ${tens ? "tens" : "ones"}. What comes next?`, prompt: `${seq.join(", ")}, <span class="blank">?</span>`, plain: `${seq.join(", ")}, ?`, viz: jumpLine(start, tens ? 10 : 1, 3), answer: next, steps: [`Each number is ${tens ? 10 : 1} more.`, `${seq[2]} + ${tens ? 10 : 1} = ${next}.`] };
  } },
  kcounton: { name: "Count on from a number", std: "K.CC.A.2", glyph: "+1", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r); const n = rnd(3, 18), k = rnd(1, 3), ans = n + k;
    return { ask: `Start at ${n}. Count on ${k}. Where do you land?`, prompt: `${n}, ${range(n + 1, ans - 1).map(() => "…").join(", ")}${k > 1 ? ", " : ""}<span class="blank">?</span>`, plain: `${n} and count on ${k}`, answer: ans, steps: [`Start at ${n}.`, `Count: ${range(n + 1, ans).join(", ")}.`, `You land on ${ans}.`] };
  } },
  kmore: { name: "Which group has more?", std: "K.CC.C.6", glyph: "≥", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(1, 10); b = rnd(1, 10); } while (a === b);
    return { ask: "Which group has more dots: the top or the bottom?", prompt: `<span class="blank">?</span> has more`, plain: "top or bottom", viz: dotArray(1, a) + dotArray(1, b), kind: "choice", answer: a > b ? "top" : "bottom",
      choices: [{ v: "top", label: "top" }, { v: "bottom", label: "bottom" }], steps: [`Count the top: ${a}.`, `Count the bottom: ${b}.`, `${Math.max(a, b)} is more, so the ${a > b ? "top" : "bottom"} has more.`] };
  } },
  kdecompose: { name: "Break apart numbers to 10", std: "K.OA.A.3", glyph: "◐", c: "heal", band: "k2", gen(r) {
    const rnd = rndWith(r); const n = rnd(3, 10), a = rnd(1, n - 1);
    return { ask: `${n} is ${a} and how many more?`, prompt: `${n} = ${a} + <span class="blank">?</span>`, plain: `${n} = ${a} + ?`, viz: tenFrames([{ n: a, cls: "d1" }, { n: n - a, cls: "d2" }]), answer: n - a, steps: [`Start at ${a} and count up to ${n}.`, `${n} = ${a} + ${n - a}.`] };
  } },
  kshape: { name: "Name the shape", std: "K.G.A.2", glyph: "△", c: "create", band: "k2", gen(r) {
    const pick = pickWith(r); const shapes = [["triangle", 3], ["square", 4], ["rectangle", 4], ["pentagon", 5], ["hexagon", 6], ["circle", 0]] as const, [nm] = pick(shapes);
    const others = shapes.map(([x]) => x).filter((x) => x !== nm); const opts = [nm, ...others.sort(() => r() - 0.5).slice(0, 3)].sort(() => r() - 0.5);
    return { ask: "What is this shape called?", prompt: `This is a <span class="blank">?</span>.`, plain: "name the shape", viz: shapeSvg(nm), kind: "choice", answer: nm, choices: opts.map((v) => ({ v, label: v })),
      steps: nm === "circle" ? ["It is round, with no sides or corners.", "It is a circle."] : [`Count the sides: ${sidesOf(nm)}.`, nm === "rectangle" ? "Two long sides and two short sides." : nm === "square" ? "All four sides are the same length." : "", `It is a ${nm}.`].filter(Boolean) };
  } },
  kflat: { name: "Flat or solid?", std: "K.G.A.3", glyph: "▢", c: "create", band: "k2", gen(r) {
    const pick = pickWith(r); const [nm, solid] = pick([["cube", 1], ["sphere", 1], ["cone", 1], ["cylinder", 1], ["square", 0], ["circle", 0], ["triangle", 0], ["rectangle", 0]] as const);
    return { ask: `Is a ${nm} flat (2-D) or solid (3-D)?`, prompt: `A ${nm} is <span class="blank">?</span>`, plain: `is a ${nm} flat or solid`, kind: "choice", answer: solid ? "solid" : "flat",
      choices: [{ v: "flat", label: "flat" }, { v: "solid", label: "solid" }], steps: [solid ? `A ${nm} takes up space; you can hold it.` : `A ${nm} lies flat, like a drawing.`, `It is ${solid ? "solid" : "flat"}.`] };
  } },
  ksides: { name: "Count sides and corners", std: "K.G.B.4", glyph: "⬠", c: "create", band: "k2", gen(r) {
    const pick = pickWith(r); const nm = pick(["triangle", "square", "rectangle", "pentagon", "hexagon"] as const), what = pick(["sides", "corners"] as const), n = sidesOf(nm);
    return { ask: `How many ${what} does this ${nm} have?`, prompt: `<span class="blank">?</span> ${what}`, plain: `${what} of a ${nm}`, viz: shapeSvg(nm), answer: n, steps: [`Point to each ${what === "sides" ? "side" : "corner"} as you count.`, `A ${nm} has ${n} ${what}.`] };
  } },
  g1three: { name: "Add three numbers", std: "1.OA.A.2", glyph: "+++", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(1, 9), b = rnd(1, 9), c = rnd(1, Math.max(1, 20 - a - b)), s = a + b + c, ten = a + b === 10 ? "a + b" : b + c === 10 ? "b + c" : a + c === 10 ? "a + c" : "";
    return { ask: "Add all three. Look for a 10 first.", prompt: `${a} + ${b} + ${c} = <span class="blank">?</span>`, plain: `${a} + ${b} + ${c}`, viz: tenFrames([{ n: a, cls: "d1" }, { n: b, cls: "d2" }, { n: c, cls: "d1" }]), answer: s,
      steps: ten ? [`Make a ten first: ${ten === "a + b" ? `${a} + ${b}` : ten === "b + c" ? `${b} + ${c}` : `${a} + ${c}`} = 10.`, `10 + ${ten === "a + b" ? c : ten === "b + c" ? a : b} = ${s}.`] : [`${a} + ${b} = ${a + b}.`, `${a + b} + ${c} = ${s}.`] };
  } },
  g1turn: { name: "Turnaround facts", std: "1.OA.B.3", glyph: "⇄", c: "heal", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), b = rnd(2, 9);
    return { ask: `${a} + ${b} = ${a + b}. Use that to fill in the blank.`, prompt: `${b} + <span class="blank">?</span> = ${a + b}`, plain: `${b} + ? = ${a + b}`, answer: a, steps: ["You can add in any order and get the same total.", `${a} + ${b} = ${b} + ${a} = ${a + b}.`] };
  } },
  g1unknown: { name: "Find the missing number", std: "1.OA.D.8", glyph: "□", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 10), b = rnd(2, 10), s = a + b, k = rnd(0, 2);
    const [prompt, ans] = k === 0 ? [`<span class="blank">?</span> + ${b} = ${s}`, a] : k === 1 ? [`${s} ${MINUS} <span class="blank">?</span> = ${a}`, b] : [`${s} = ${a} + <span class="blank">?</span>`, b];
    return { ask: "What number makes it true?", prompt, plain: prompt.replace(/<[^>]+>\?<\/span>/, "?"), answer: ans, steps: [`Think of the fact family: ${a} + ${b} = ${s}.`, `The missing number is ${ans}.`] };
  } },
  g1truefalse: { name: "True or false equations", std: "1.OA.D.7", glyph: "=?", c: "fly", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(1, 9), b = rnd(1, 9), c = rnd(1, Math.min(9, a + b - 1)), truth = r() < 0.5, near = a + b - c, d = truth ? near : near === 0 || r() < 0.5 ? near + 1 : near - 1;
    return { ask: "Is this equation true or false?", prompt: `${a} + ${b} = ${c} + ${d}`, plain: `${a} + ${b} = ${c} + ${d}`, kind: "choice", answer: truth ? "true" : "false",
      choices: [{ v: "true", label: "true" }, { v: "false", label: "false" }], steps: [`Left side: ${a} + ${b} = ${a + b}.`, `Right side: ${c} + ${d} = ${c + d}.`, `${a + b} ${a + b === c + d ? "=" : "≠"} ${c + d}, so it is ${truth ? "true" : "false"}.`] };
  } },
  g1tenmore: { name: "10 more and 10 less", std: "1.NBT.C.5", glyph: "±10", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r); const more = r() < 0.5, n = rnd(more ? 10 : 20, more ? 89 : 99), ans = more ? n + 10 : n - 10;
    return { ask: `What is 10 ${more ? "more" : "less"} than ${n}?`, prompt: `${n} ${more ? "+" : MINUS} 10 = <span class="blank">?</span>`, plain: `10 ${more ? "more" : "less"} than ${n}`, viz: baseTen(n), answer: ans, steps: [`Only the tens change: ${Math.floor(n / 10)} tens become ${Math.floor(ans / 10)} tens.`, `The ones stay ${n % 10}. So ${ans}.`] };
  } },
  g1sub10s: { name: "Subtract tens", std: "1.NBT.C.6", glyph: "−10s", c: "heal", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9) * 10, b = rnd(1, a / 10 - 1) * 10;
    return { ask: "Subtract. Think in tens.", prompt: `${a} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${a} − ${b}`, answer: a - b, steps: [`${a / 10} tens ${MINUS} ${b / 10} tens = ${(a - b) / 10} tens.`, `${(a - b) / 10} tens = ${a - b}.`] };
  } },
  g1count120: { name: "Count to 120", std: "1.NBT.A.1", glyph: "120", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); const n = rnd(95, 117);
    return { ask: "What number comes next?", prompt: `${n}, ${n + 1}, ${n + 2}, <span class="blank">?</span>`, plain: `${n}, ${n + 1}, ${n + 2}, ?`, answer: n + 3, steps: ["Count on by ones.", n + 3 === 100 ? "After 99 comes 100." : `After ${n + 2} comes ${n + 3}.`] };
  } },
  g1parts: { name: "Halves and fourths", std: "1.G.A.3", glyph: "◑", c: "create", band: "k2", gen(r) {
    const pick = pickWith(r); const [word, n] = pick([["halves", 2], ["fourths", 4], ["quarters", 4]] as const);
    return { ask: `A pizza is cut into ${word}. How many equal parts are there?`, prompt: `<span class="blank">?</span> equal parts`, plain: `how many ${word}`, viz: fractionBars(0, n, 0, n).replace(/<svg[^>]*>/, (m) => m.replace("96", "50")), answer: n, steps: [`${word === "halves" ? "Halves" : word === "fourths" ? "Fourths" : "Quarters"} means ${n} equal parts.`] };
  } },
  g2facts: { name: "Add and subtract within 20, fast", std: "2.OA.B.2", glyph: "⚡", c: "heal", band: "k2", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 10), b = rnd(2, 10), add = r() < 0.5;
    return add ? { ask: "Quick! Add.", prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, answer: a + b, steps: [`${a} + ${b} = ${a + b}.`] }
      : { ask: "Quick! Subtract.", prompt: `${a + b} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${a + b} − ${b}`, answer: a, steps: [`Think ${b} + ? = ${a + b}.`, `${a + b} ${MINUS} ${b} = ${a}.`] };
  } },
  g2array: { name: "Arrays and repeated addition", std: "2.OA.C.4", glyph: "⋮⋮", c: "serve", band: "k2", gen(r) {
    const rnd = rndWith(r); const rows = rnd(2, 5), cols = rnd(2, 5);
    return { ask: `${rows} rows of ${cols}. How many in all?`, prompt: `${Array(rows).fill(cols).join(" + ")} = <span class="blank">?</span>`, plain: `${rows} rows of ${cols}`, viz: dotArray(rows, cols), answer: rows * cols, steps: [`Add ${cols}, ${rows} times.`, `${Array(rows).fill(cols).join(" + ")} = ${rows * cols}.`] };
  } },
  g2skip: { name: "Skip count by 5s, 10s and 100s", std: "2.NBT.A.2", glyph: "+5", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const by = pick([5, 10, 100]), start = by === 100 ? rnd(1, 6) * 100 : by * rnd(1, 15), seq = [start, start + by, start + 2 * by];
    return { ask: `Skip count by ${by}s.`, prompt: `${seq.join(", ")}, <span class="blank">?</span>`, plain: `${seq.join(", ")}, ?`, viz: jumpLine(start, by, 3), answer: start + 3 * by, steps: [`Each jump is ${by}.`, `${seq[2]} + ${by} = ${start + 3 * by}.`] };
  } },
  g2expanded: { name: "Expanded form", std: "2.NBT.A.3", glyph: "+++", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); const h = rnd(1, 9), t = rnd(0, 9), o = rnd(0, 9), n = h * 100 + t * 10 + o;
    return r() < 0.5 ? { ask: "Write the number.", prompt: `${h * 100} + ${t * 10} + ${o} = <span class="blank">?</span>`, plain: `${h * 100} + ${t * 10} + ${o}`, answer: n, steps: [`${h} hundreds, ${t} tens, ${o} ones.`, `That is ${n}.`] }
      : { ask: `Write ${n} in expanded form. What goes in the tens spot?`, prompt: `${n} = ${h * 100} + <span class="blank">?</span> + ${o}`, plain: `${n} = ${h * 100} + ? + ${o}`, answer: t * 10, steps: [`The tens digit is ${t}.`, `${t} tens = ${t * 10}.`] };
  } },
  g2compare3: { name: "Compare three-digit numbers", std: "2.NBT.A.4", glyph: "<>", c: "teach", band: "k2", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(100, 999); b = r() < 0.5 ? Math.floor(a / 100) * 100 + rnd(0, 99) : rnd(100, 999); } while (a === b && r() < 0.85);
    const sym = a > b ? ">" : a < b ? "<" : "=";
    return { ask: "Which symbol makes this true?", prompt: `${a} <span class="blank">?</span> ${b}`, plain: `${a} ? ${b}`, kind: "choice", answer: sym, choices: ["<", "=", ">"].map((v) => ({ v, label: v })),
      steps: ["Compare hundreds first, then tens, then ones.", `${a} ${sym} ${b}.`] };
  } },
  g2four: { name: "Add up to four two-digit numbers", std: "2.NBT.B.6", glyph: "∑", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r); const k = rnd(3, 4), ns = Array.from({ length: k }, () => rnd(10, 30)), s = ns.reduce((x, y) => x + y, 0);
    return { ask: "Add them all.", prompt: `${ns.join(" + ")} = <span class="blank">?</span>`, plain: ns.join(" + "), answer: s, steps: [`Tens: ${ns.map((n) => Math.floor(n / 10) * 10).join(" + ")} = ${ns.reduce((x, n) => x + Math.floor(n / 10) * 10, 0)}.`, `Ones: ${ns.map((n) => n % 10).join(" + ")} = ${ns.reduce((x, n) => x + (n % 10), 0)}.`, `Together: ${s}.`] };
  } },
  g2time5: { name: "Time to five minutes", std: "2.MD.C.7", glyph: "🕓", c: "nature", band: "k2", gen(r) {
    const rnd = rndWith(r); const h = rnd(1, 12), m5 = rnd(1, 11), m = m5 * 5;
    const at = (deg: number, len: number) => [50 + len * Math.sin((deg * Math.PI) / 180), 50 - len * Math.cos((deg * Math.PI) / 180)].map((v) => Math.round(v * 10) / 10);
    const [hx, hy] = at(((h % 12) + m / 60) * 30, 22), [mx, my] = at(m5 * 30, 34);
    const nums = Array.from({ length: 12 }, (_, i) => { const [x, y] = at((i + 1) * 30, 38); return `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="9" fill="currentColor">${i + 1}</text>`; }).join("");
    const viz = `<svg class="viz" viewBox="0 0 100 100" style="width:150px" role="img" aria-label="A clock"><circle cx="50" cy="50" r="47" class="cell"/>${nums}<line x1="50" y1="50" x2="${mx}" y2="${my}" class="axis" style="stroke-width:2.5"/><line x1="50" y1="50" x2="${hx}" y2="${hy}" class="beam"/><circle cx="50" cy="50" r="3" class="fulcrum"/></svg>`;
    return { ask: `The short hand is just past the ${h}. How many minutes past ${h} is it?`, prompt: `${h}:<span class="blank">?</span>`, plain: `minutes past ${h}`, viz, answer: m, steps: [`The long hand points to the ${m5}.`, `Count by fives ${m5} times: ${range(1, m5).map((i) => i * 5).join(", ")}.`, `It is ${h}:${String(m).padStart(2, "0")}.`] };
  } },
  g2bar: { name: "Read a bar graph", std: "2.MD.D.10", glyph: "▥", c: "help", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const cats = ["Dogs", "Cats", "Fish", "Birds"], vals = cats.map(() => rnd(1, 9)), [i, j] = [rnd(0, 3), rnd(0, 3)], diff = i !== j && r() < 0.6;
    const W = 220, bar = 36, viz = `<svg class="viz" viewBox="0 0 ${W} 130" style="width:280px" role="img" aria-label="Bar graph">${cats.map((c, k) => `<rect class="rod" x="${20 + k * 50}" y="${110 - vals[k] * 10}" width="${bar}" height="${vals[k] * 10}"/><text x="${38 + k * 50}" y="124" font-size="9" text-anchor="middle" fill="currentColor">${c}</text><text x="${38 + k * 50}" y="${105 - vals[k] * 10}" font-size="9" text-anchor="middle" fill="currentColor">${vals[k]}</text>`).join("")}<line class="axis" x1="14" y1="110" x2="${W - 4}" y2="110"/></svg>`;
    const ans = diff ? Math.abs(vals[i] - vals[j]) : vals[i];
    return { ask: diff ? `How many more ${vals[i] >= vals[j] ? cats[i] : cats[j]} than ${vals[i] >= vals[j] ? cats[j] : cats[i]}?` : `How many ${cats[i]}?`, prompt: `<span class="blank">?</span>`, plain: "read the bar graph", viz, answer: ans,
      steps: diff ? [`${cats[i]}: ${vals[i]}. ${cats[j]}: ${vals[j]}.`, `${Math.max(vals[i], vals[j])} ${MINUS} ${Math.min(vals[i], vals[j])} = ${ans}.`] : [`Find the ${cats[i]} bar. It reaches ${vals[i]}.`] };
  } },
  g2polygon: { name: "Name shapes by their sides", std: "2.G.A.1", glyph: "⬡", c: "create", band: "k2", gen(r) {
    const pick = pickWith(r); const [nm, n] = pick([["triangle", 3], ["quadrilateral", 4], ["pentagon", 5], ["hexagon", 6]] as const);
    return { ask: `A shape has ${n} sides and ${n} corners. What is it called?`, prompt: `A <span class="blank">?</span>`, plain: `${n} sides`, viz: shapeSvg(n === 4 ? "square" : nm), kind: "choice", answer: nm,
      choices: ["triangle", "quadrilateral", "pentagon", "hexagon"].map((v) => ({ v, label: v })), steps: ["tri = 3, quad = 4, penta = 5, hexa = 6.", `${n} sides: ${nm}.`] };
  } },
  g2rowscols: { name: "Rows and columns of squares", std: "2.G.A.2", glyph: "▦", c: "create", band: "k2", gen(r) {
    const rnd = rndWith(r); const rows = rnd(2, 5), cols = rnd(2, 6);
    return { ask: `A rectangle is split into ${rows} rows and ${cols} columns of same-size squares. How many squares?`, prompt: `<span class="blank">?</span> squares`, plain: `${rows} rows, ${cols} columns`, viz: gridRect(rows, cols), answer: rows * cols, steps: [`Count one row: ${cols}.`, `${rows} rows of ${cols} = ${rows * cols}.`] };
  } },
  // ─── Batch: grades 3–5 ───
  g3groups: { name: "Equal groups", std: "3.OA.A.1", glyph: "⊞", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const g = rnd(2, 9), n = rnd(2, 9), thing = pick(["bags with", "boxes with", "plates with", "vases with"]), item = pick(["apples", "crayons", "cookies", "flowers"]);
    return { ask: `${g} ${thing} ${n} ${item} each. How many ${item} in all?`, prompt: `${g} × ${n} = <span class="blank">?</span>`, plain: `${g} groups of ${n}`, viz: dotArray(g, n), answer: g * n, steps: [`${g} groups of ${n} is ${g} × ${n}.`, `${g} × ${n} = ${g * n}.`] };
  } },
  g3share: { name: "Share equally", std: "3.OA.A.2", glyph: "÷", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const k = rnd(2, 9), each = rnd(2, 9), total = k * each, item = pick(["stickers", "marbles", "grapes", "pencils"]);
    return { ask: `${total} ${item} are shared equally by ${k} kids. How many does each kid get?`, prompt: `${total} ÷ ${k} = <span class="blank">?</span>`, plain: `${total} shared by ${k}`, viz: dotArray(k, each), answer: each, steps: [`Think: ${k} × ? = ${total}.`, `${k} × ${each} = ${total}, so each gets ${each}.`] };
  } },
  g3multword: { name: "Multiply and divide word problems", std: "3.OA.A.3", glyph: "?×", c: "help", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const a = rnd(3, 9), b = rnd(3, 9), name = pick(["Jo", "Amir", "Lena", "Theo"]);
    return r() < 0.5 ? { ask: `${name} reads ${a} pages a day for ${b} days. How many pages?`, prompt: `${a} × ${b} = <span class="blank">?</span>`, plain: `${a} × ${b}`, viz: dotArray(b, a), answer: a * b, steps: [`${b} days of ${a} pages: multiply.`, `${a} × ${b} = ${a * b}.`] }
      : { ask: `${name} puts ${a * b} chairs in rows of ${a}. How many rows?`, prompt: `${a * b} ÷ ${a} = <span class="blank">?</span>`, plain: `${a * b} ÷ ${a}`, answer: b, steps: ["Rows of the same size: divide.", `${a * b} ÷ ${a} = ${b}.`] };
  } },
  g3unknownfactor: { name: "Unknown factor", std: "3.OA.A.4", glyph: "?×", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 10), b = rnd(2, 10), p = a * b, k = rnd(0, 2);
    const prompt = k === 0 ? `<span class="blank">?</span> × ${b} = ${p}` : k === 1 ? `${a} × <span class="blank">?</span> = ${p}` : `${p} ÷ <span class="blank">?</span> = ${b}`;
    return { ask: "Find the missing number.", prompt, plain: prompt.replace(/<[^>]+>\?<\/span>/, "?"), answer: k === 1 ? b : a, steps: [`Think of the fact family: ${a} × ${b} = ${p}.`, `The missing number is ${k === 1 ? b : a}.`] };
  } },
  g3mult10: { name: "Multiply by multiples of 10", std: "3.NBT.A.3", glyph: "×10", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), t = rnd(2, 9) * 10;
    return { ask: "Multiply.", prompt: `${a} × ${t} = <span class="blank">?</span>`, plain: `${a} × ${t}`, answer: a * t, steps: [`${a} × ${t / 10} = ${a * (t / 10)}.`, `${a} × ${t / 10} tens = ${a * (t / 10)} tens = ${a * t}.`] };
  } },
  g3pattern: { name: "Number patterns", std: "3.OA.D.9", glyph: "…", c: "fly", band: "g35", gen(r) {
    const rnd = rndWith(r); const step = rnd(2, 9), start = rnd(1, 20), seq = [0, 1, 2, 3].map((i) => start + i * step);
    return { ask: "What number comes next in the pattern?", prompt: `${seq.join(", ")}, <span class="blank">?</span>`, plain: `${seq.join(", ")}, ?`, viz: jumpLine(start, step, 4), answer: start + 4 * step, steps: [`Each number is ${step} more than the one before.`, `${seq[3]} + ${step} = ${start + 4 * step}.`] };
  } },
  g3fracshade: { name: "What fraction is shaded?", std: "3.NF.A.1", glyph: "▰▱", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([2, 3, 4, 6, 8]), n = rnd(1, d - 1);
    return { ask: "What fraction of the bar is shaded? Enter the top number.", prompt: `${frac('<span class="blank">?</span>', d)}`, plain: `?/${d} shaded`, viz: fractionBars(n, d, n, d).replace(/<text[^>]*>[^<]*<\/text>/g, "").replace(/<rect[^>]* y="54"[^>]*\/>/g, ""), answer: n,
      steps: [`The bar has ${d} equal parts, so the bottom number is ${d}.`, `${n} parts are shaded, so it is ${n}/${d}.`] };
  } },
  g3fraccompare: { name: "Compare fractions, same top or bottom", std: "3.NF.A.3d", glyph: "⅓<⅔", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const sameD = r() < 0.5; let n1: number, d1: number, n2: number, d2: number;
    if (sameD) { d1 = d2 = pick([3, 4, 6, 8]); n1 = rnd(1, d1 - 1); n2 = rnd(1, d1 - 1); } else { n1 = n2 = rnd(1, 3); d1 = pick([2, 3, 4, 6, 8].filter((d) => d > n1)); d2 = pick([2, 3, 4, 6, 8].filter((d) => d > n1)); }
    const sym = n1 * d2 > n2 * d1 ? ">" : n1 * d2 < n2 * d1 ? "<" : "=";
    return { ask: "Which symbol makes this true?", prompt: `${frac(n1, d1)} <span class="blank">?</span> ${frac(n2, d2)}`, plain: `${n1}/${d1} ? ${n2}/${d2}`, viz: fractionBars(n1, d1, n2, d2), kind: "choice", answer: sym, choices: ["<", "=", ">"].map((v) => ({ v, label: v })),
      steps: [sameD ? "Same-size pieces: more pieces is more." : "Same number of pieces: bigger pieces (smaller bottom number) is more.", `${n1}/${d1} ${sym} ${n2}/${d2}.`] };
  } },
  g3massword: { name: "Mass and liquid word problems", std: "3.MD.A.2", glyph: "kg", c: "nature", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const [obj, unit] = pick([["bags of flour", "kilograms"], ["jugs of water", "liters"], ["boxes", "kilograms"]] as const), n = rnd(2, 9), each = rnd(2, 9);
    return { ask: `There are ${n} ${obj}, each ${each} ${unit}. How many ${unit} in all?`, prompt: `${n} × ${each} = <span class="blank">?</span> ${unit}`, plain: `${n} × ${each}`, answer: n * each, steps: [`${n} of them, ${each} ${unit} each: multiply.`, `${n} × ${each} = ${n * each} ${unit}.`] };
  } },
  g3perimeter: { name: "Perimeter of polygons", std: "3.MD.D.8", glyph: "⬠", c: "nature", band: "g35", gen(r) {
    const rnd = rndWith(r); const k = rnd(3, 6), sides = Array.from({ length: k }, () => rnd(2, 15)), p = sides.reduce((a, b) => a + b, 0), missing = r() < 0.4;
    if (missing) { const shown = sides.slice(0, -1); return { ask: `A ${k}-sided shape has a perimeter of ${p} cm. The sides are ${shown.join(", ")} and one more. How long is the last side?`, prompt: `<span class="blank">?</span> cm`, plain: `perimeter ${p}`, answer: sides[k - 1], steps: [`The shown sides add to ${shown.reduce((a, b) => a + b, 0)}.`, `${p} ${MINUS} ${shown.reduce((a, b) => a + b, 0)} = ${sides[k - 1]}.`] }; }
    return { ask: `A shape has sides ${sides.join(", ")} cm. What is its perimeter?`, prompt: `${sides.join(" + ")} = <span class="blank">?</span>`, plain: sides.join(" + "), viz: shapeSvg(["", "", "", "triangle", "quadrilateral", "pentagon", "hexagon"][k]), answer: p, steps: ["Perimeter is all the sides added up.", `${sides.join(" + ")} = ${p} cm.`] };
  } },
  g3quad: { name: "Kinds of quadrilaterals", std: "3.G.A.1", glyph: "▱", c: "create", band: "g35", gen(r) {
    const pick = pickWith(r); const [desc, ans] = pick([["4 equal sides and 4 right angles", "square"], ["4 right angles, opposite sides equal", "rectangle"], ["4 equal sides, no right angles", "rhombus"], ["exactly one pair of parallel sides", "trapezoid"]] as const);
    return { ask: `A quadrilateral has ${desc}. What is the best name for it?`, prompt: `a <span class="blank">?</span>`, plain: desc, kind: "choice", answer: ans, choices: ["square", "rectangle", "rhombus", "trapezoid"].map((v) => ({ v, label: v })), steps: ["All of these have 4 sides; their sides and angles tell them apart.", `${desc}: ${ans}.`] };
  } },
  g4times: { name: "Times as many", std: "4.OA.A.1", glyph: "×n", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const a = rnd(2, 12), k = rnd(2, 9), [x, y] = pick([["Maya", "her brother"], ["The oak", "the pine"], ["Team A", "Team B"]] as const);
    return { ask: `${y[0].toUpperCase() + y.slice(1)} has ${a}. ${x} has ${k} times as many. How many does ${x} have?`, prompt: `${k} × ${a} = <span class="blank">?</span>`, plain: `${k} times as many as ${a}`, viz: tape([{ name: "1×", parts: [{ label: `${a}`, size: a, fill: true }] }, { name: `${k}×`, parts: Array.from({ length: k }, () => ({ label: `${a}`, size: a, fill: true })), whole: "?" }]), answer: k * a, steps: [`"${k} times as many" means multiply by ${k}.`, `${k} × ${a} = ${k * a}.`] };
  } },
  g4remainder: { name: "Division with remainders", std: "4.OA.A.3", glyph: "R", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r); const d = rnd(3, 9), q = rnd(4, 15), rem = rnd(1, d - 1), n = d * q + rem, askRem = r() < 0.5;
    return askRem ? { ask: `${n} ÷ ${d}. What is the remainder?`, prompt: `${n} ÷ ${d} = ${q} R <span class="blank">?</span>`, plain: `remainder of ${n} ÷ ${d}`, answer: rem, steps: [`${d} × ${q} = ${d * q}.`, `${n} ${MINUS} ${d * q} = ${rem} left over.`] }
      : { ask: `${n} kids ride in vans that hold ${d} each. How many vans are needed so everyone rides?`, prompt: `<span class="blank">?</span> vans`, plain: `${n} kids, ${d} per van`, answer: q + 1, steps: [`${n} ÷ ${d} = ${q} R ${rem}.`, `${q} vans are full and ${rem} kid${rem > 1 ? "s" : ""} still need${rem > 1 ? "" : "s"} a seat, so ${q + 1} vans.`] };
  } },
  g4factor: { name: "Factors and multiples", std: "4.OA.B.4", glyph: "f", c: "fly", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), n = r() < 0.5 ? a * rnd(2, 11) : rnd(20, 99), yes = n % a === 0;
    return { ask: `Is ${a} a factor of ${n}?`, prompt: `${n} ÷ ${a}`, plain: `is ${a} a factor of ${n}`, kind: "choice", answer: yes ? "yes" : "no", choices: [{ v: "yes", label: "yes" }, { v: "no", label: "no" }],
      steps: [yes ? `${a} × ${n / a} = ${n}, with nothing left over.` : `${n} ÷ ${a} = ${Math.floor(n / a)} R ${n % a}: something is left over.`, `So ${a} ${yes ? "is" : "is not"} a factor of ${n}.`] };
  } },
  g4rule: { name: "Patterns with a rule", std: "4.OA.C.5", glyph: "↦", c: "fly", band: "g35", gen(r) {
    const rnd = rndWith(r); const mul = r() < 0.5, k = rnd(2, 5), start = rnd(1, 6), seq = [start]; for (let i = 0; i < 3; i++) seq.push(mul ? seq[i] * k : seq[i] + k * 3);
    const next = mul ? seq[3] * k : seq[3] + k * 3;
    return { ask: `The rule is ${mul ? `multiply by ${k}` : `add ${k * 3}`}. What comes next?`, prompt: `${seq.join(", ")}, <span class="blank">?</span>`, plain: `${seq.join(", ")}, ?`, viz: mul ? undefined : jumpLine(start, k * 3, 4), answer: next, steps: [`${seq[3]} ${mul ? "×" : "+"} ${mul ? k : k * 3} = ${next}.`] };
  } },
  g4addsub: { name: "Add and subtract big numbers", std: "4.NBT.B.4", glyph: "±", c: "build", band: "g35", gen(r) {
    const rnd = rndWith(r); const add = r() < 0.5, a = rnd(10000, 89999), b = rnd(1000, add ? 99999 - a : a - 100), ans = add ? a + b : a - b;
    return { ask: "Line up the places.", prompt: `${a.toLocaleString("en-US")} ${add ? "+" : MINUS} ${b.toLocaleString("en-US")} = <span class="blank">?</span>`, plain: `${a} ${add ? "+" : "−"} ${b}`, long: true, answer: ans,
      steps: ["Start with the ones and work left.", add ? "Carry a 1 when a column makes 10 or more." : "Regroup when the top digit is smaller.", `= ${ans.toLocaleString("en-US")}.`] };
  } },
  g4placevalue: { name: "Place value: ten times", std: "4.NBT.A.1", glyph: "×10", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r); const d = rnd(1, 9), p = rnd(1, 3), n = d * 10 ** (p + 1), m = d * 10 ** p;
    return { ask: `In ${n.toLocaleString("en-US")}, the ${d} is worth how many times the ${d} in ${m.toLocaleString("en-US")}?`, prompt: `<span class="blank">?</span> times`, plain: "ten times", answer: 10, steps: ["Each place is worth 10 times the place to its right.", `${n.toLocaleString("en-US")} ÷ ${m.toLocaleString("en-US")} = 10.`] };
  } },
  g4compare: { name: "Compare multi-digit numbers", std: "4.NBT.A.2", glyph: "<>", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(1000, 999999); b = r() < 0.5 ? a + rnd(-999, 999) : rnd(1000, 999999); } while (a === b || b < 0);
    const sym = a > b ? ">" : "<";
    return { ask: "Which symbol makes this true?", prompt: `${a.toLocaleString("en-US")} <span class="blank">?</span> ${b.toLocaleString("en-US")}`, plain: `${a} ? ${b}`, kind: "choice", answer: sym, choices: ["<", "=", ">"].map((v) => ({ v, label: v })), steps: ["Compare from the biggest place.", `${a.toLocaleString("en-US")} ${sym} ${b.toLocaleString("en-US")}.`] };
  } },
  g4mixed: { name: "Mixed numbers", std: "4.NF.B.3c", glyph: "1½", c: "build", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([2, 3, 4, 5, 6, 8]), w = rnd(1, 5), n = rnd(1, d - 1), top = w * d + n;
    return { ask: "Write the mixed number as a fraction. Enter the top number.", prompt: `${w} ${frac(n, d)} = ${frac('<span class="blank">?</span>', d)}`, plain: `${w} ${n}/${d} = ?/${d}`, viz: wholesSvg(w, n, d), answer: top, steps: [`${w} whole${w > 1 ? "s" : ""} = ${w * d}/${d}.`, `${w * d} + ${n} = ${top}, so ${top}/${d}.`] };
  } },
  g4fracmul: { name: "Multiply a fraction by a whole number", std: "4.NF.B.4", glyph: "n×⅓", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([3, 4, 5, 6, 8, 10, 12]), n = rnd(1, d - 1), k = rnd(2, 6);
    return { ask: "Multiply. Enter the top number; the bottom stays the same.", prompt: `${k} × ${frac(n, d)} = ${frac('<span class="blank">?</span>', d)}`, plain: `${k} × ${n}/${d}`, answer: k * n, steps: [`${k} groups of ${n}/${d}.`, `${k} × ${n} = ${k * n}, so ${k * n}/${d}.`] };
  } },
  g4decimal: { name: "Fractions as decimals", std: "4.NF.C.6", glyph: ".1", c: "tech", band: "g35", gen(r) {
    const rnd = rndWith(r); const tenths = r() < 0.4, n = tenths ? rnd(1, 9) : rnd(1, 99), d = tenths ? 10 : 100, ans = n / d;
    return { ask: "Write as a decimal.", prompt: `${frac(n, d)} = <span class="blank">?</span>`, plain: `${n}/${d} as a decimal`, viz: d === 100 ? hundredGrid(n) : undefined, answer: ans, steps: [`${d === 10 ? "Tenths" : "Hundredths"}: ${d === 10 ? "one" : "two"} place${d === 10 ? "" : "s"} after the point.`, `${n}/${d} = ${ans}.`] };
  } },
  g4deccompare: { name: "Compare decimals", std: "4.NF.C.7", glyph: ".<.", c: "tech", band: "g35", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(1, 99) / 100; b = r() < 0.5 ? rnd(1, 9) / 10 : rnd(1, 99) / 100; } while (a === b);
    const sym = a > b ? ">" : "<";
    return { ask: "Which symbol makes this true?", prompt: `${a} <span class="blank">?</span> ${b}`, plain: `${a} ? ${b}`, kind: "choice", answer: sym, choices: ["<", "=", ">"].map((v) => ({ v, label: v })),
      steps: [`Write both as hundredths: ${Math.round(a * 100)} and ${Math.round(b * 100)}.`, `${a} ${sym} ${b}.`] };
  } },
  g4convert: { name: "Convert units", std: "4.MD.A.1", glyph: "ft", c: "nature", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const [big, small, k] = pick([["feet", "inches", 12], ["yards", "feet", 3], ["meters", "centimeters", 100], ["kilograms", "grams", 1000], ["hours", "minutes", 60], ["minutes", "seconds", 60], ["pounds", "ounces", 16], ["gallons", "quarts", 4]] as const), n = rnd(2, 9);
    return { ask: `How many ${small} are in ${n} ${big}?`, prompt: `${n} ${big} = <span class="blank">?</span> ${small}`, plain: `${n} ${big} in ${small}`, answer: n * k, steps: [`1 ${big.replace(/s$/, "")} = ${k} ${small}.`, `${n} × ${k} = ${n * k}.`] };
  } },
  g4triangle: { name: "Classify triangles by angles", std: "4.G.A.2", glyph: "◺", c: "coral", band: "g35", gen(r) {
    const rnd = rndWith(r); const kind = rnd(0, 2), big = kind === 0 ? 90 : kind === 1 ? rnd(19, 30) * 5 : rnd(13, 17) * 5, other = rnd(5, Math.min(big === 90 ? 17 : 13, Math.floor((180 - big) / 5) - 1)) * 5, third = 180 - big - other;
    const ans = Math.max(big, other, third) === 90 ? "right" : Math.max(big, other, third) > 90 ? "obtuse" : "acute";
    return { ask: `A triangle has angles of ${big}°, ${other}° and ${third}°. What kind of triangle is it?`, prompt: `a <span class="blank">?</span> triangle`, plain: `${big}, ${other}, ${third}`, kind: "choice", viz: triangleAngles(`${big}°`, `${other}°`, `${third}°`), answer: ans,
      choices: ["acute", "right", "obtuse"].map((v) => ({ v, label: v })), steps: ["Right: one angle is 90°. Obtuse: one is more than 90°. Acute: all are less than 90°.", `The biggest angle is ${Math.max(big, other, third)}°, so it is ${ans}.`] };
  } },
  g5placevalue: { name: "Decimal place value", std: "5.NBT.A.1", glyph: ".0", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const n = rnd(1000, 9999) / 1000, digits = n.toFixed(3), place = pick(["tenths", "hundredths", "thousandths"] as const), idx = { tenths: 2, hundredths: 3, thousandths: 4 }[place];
    return { ask: `What digit is in the ${place} place of ${digits}?`, prompt: `<span class="blank">?</span>`, plain: `${place} digit of ${digits}`, answer: Number(digits[idx]), steps: ["After the point: tenths, hundredths, thousandths.", `The ${place} digit is ${digits[idx]}.`] };
  } },
  g5deccomp: { name: "Compare decimals to thousandths", std: "5.NBT.A.3b", glyph: ".<.", c: "tech", band: "g35", gen(r) {
    const rnd = rndWith(r); let a: number, b: number; do { a = rnd(1, 999) / 1000; b = rnd(1, 99) / 100; } while (a === b);
    const sym = a > b ? ">" : "<";
    return { ask: "Which symbol makes this true?", prompt: `${a} <span class="blank">?</span> ${b}`, plain: `${a} ? ${b}`, kind: "choice", answer: sym, choices: ["<", "=", ">"].map((v) => ({ v, label: v })), steps: [`As thousandths: ${Math.round(a * 1000)} and ${Math.round(b * 1000)}.`, `${a} ${sym} ${b}.`] };
  } },
  g5decround: { name: "Round decimals", std: "5.NBT.A.4", glyph: "≈", c: "help", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const m = rnd(1001, 99999), n = m / 1000, to = pick(["whole number", "tenth", "hundredth"] as const), f = { "whole number": 1, tenth: 10, hundredth: 100 }[to], ans = Math.round(m / (1000 / f)) / f; // whole-number math, so 60.255 rounds up
    return { ask: `Round ${n} to the nearest ${to}.`, prompt: `≈ <span class="blank">?</span>`, plain: `round ${n} to the nearest ${to}`, viz: roundLine(n, Math.floor(n * f) / f, Math.floor(n * f) / f + 1 / f, (v) => String(Math.round(v * 10000) / 10000)), answer: ans, steps: ["Look at the digit just to the right of where you round.", "5 or more rounds up; 4 or less rounds down.", `${n} ≈ ${ans}.`] };
  } },
  g5div2: { name: "Divide by two-digit numbers", std: "5.NBT.B.6", glyph: "÷", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r); const d = rnd(11, 49), q = rnd(12, 199), n = d * q;
    return { ask: "Divide.", prompt: `${n.toLocaleString("en-US")} ÷ ${d} = <span class="blank">?</span>`, plain: `${n} ÷ ${d}`, long: true, answer: q, steps: [`Estimate: ${d} is about ${Math.round(d / 10) * 10}.`, `Check: ${d} × ${q} = ${n}.`, `${n} ÷ ${d} = ${q}.`] };
  } },
  g5decmul: { name: "Multiply and divide decimals", std: "5.NBT.B.7", glyph: ".×", c: "tech", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(11, 99) / 10, b = rnd(2, 9), mul = r() < 0.6, ans = mul ? Math.round(a * b * 100) / 100 : a, top = Math.round(a * b * 100) / 100;
    return mul ? { ask: "Multiply.", prompt: `${a} × ${b} = <span class="blank">?</span>`, plain: `${a} × ${b}`, answer: ans, steps: [`${Math.round(a * 10)} × ${b} = ${Math.round(a * 10) * b}.`, `There is 1 decimal place, so ${ans}.`] }
      : { ask: "Divide.", prompt: `${top} ÷ ${b} = <span class="blank">?</span>`, plain: `${top} ÷ ${b}`, answer: a, steps: [`Divide as if whole numbers, then place the point.`, `${top} ÷ ${b} = ${a}.`] };
  } },
  g5unlike: { name: "Add fractions, unlike denominators", std: "5.NF.A.1", glyph: "½+⅓", c: "build", band: "g35", gen(r) {
    const pick = pickWith(r), rnd = rndWith(r); let d1: number, d2: number; do { d1 = pick([2, 3, 4, 5, 6]); d2 = pick([2, 3, 4, 6, 8, 10]); } while (d1 === d2);
    const L = lcm(d1, d2), n1 = rnd(1, d1 - 1), n2 = rnd(1, d2 - 1), top = n1 * (L / d1) + n2 * (L / d2);
    return { ask: `Add. Use ${L} as the common denominator and enter the top number.`, prompt: `${frac(n1, d1)} + ${frac(n2, d2)} = ${frac('<span class="blank">?</span>', L)}`, plain: `${n1}/${d1} + ${n2}/${d2} = ?/${L}`, viz: fractionBars(n1, d1, n2, d2), answer: top,
      steps: [`${n1}/${d1} = ${n1 * (L / d1)}/${L}.`, `${n2}/${d2} = ${n2 * (L / d2)}/${L}.`, `${n1 * (L / d1)} + ${n2 * (L / d2)} = ${top}, so ${top}/${L}.`] };
  } },
  g5fracdiv: { name: "Divide with unit fractions", std: "5.NF.B.7", glyph: "÷⅓", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r); const d = rnd(2, 8), w = rnd(2, 9), wholeByUnit = r() < 0.6;
    return wholeByUnit ? { ask: `How many ${frac(1, d)}s are in ${w}?`, prompt: `${w} ÷ ${frac(1, d)} = <span class="blank">?</span>`, plain: `${w} ÷ 1/${d}`, answer: w * d, steps: [`Each whole has ${d} pieces of size 1/${d}.`, `${w} × ${d} = ${w * d}.`] }
      : { ask: `${frac(1, d)} shared equally by ${w}. What fraction does each get? Enter the bottom number.`, prompt: `${frac(1, d)} ÷ ${w} = ${frac(1, '<span class="blank">?</span>')}`, plain: `1/${d} ÷ ${w}`, answer: d * w, steps: [`Splitting 1/${d} into ${w} parts makes each part 1/${d * w}.`] };
  } },
  g5metric: { name: "Convert metric units", std: "5.MD.A.1", glyph: "m", c: "nature", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const [big, small, k] = pick([["meters", "centimeters", 100], ["kilometers", "meters", 1000], ["liters", "milliliters", 1000], ["kilograms", "grams", 1000]] as const), toSmall = r() < 0.5;
    const n = toSmall ? rnd(2, 95) / 10 : rnd(2, 95) * k / 10, ans = Math.round((toSmall ? n * k : n / k) * 1000) / 1000;
    return { ask: toSmall ? `How many ${small} are in ${n} ${big}?` : `How many ${big} are ${n} ${small}?`, prompt: `<span class="blank">?</span> ${toSmall ? small : big}`, plain: `${n} ${toSmall ? big : small}`, answer: ans, steps: [`1 ${big.replace(/s$/, "")} = ${k} ${small}.`, toSmall ? `${n} × ${k} = ${ans}.` : `${n} ÷ ${k} = ${ans}.`] };
  } },
  g5shapes: { name: "Classify two-dimensional shapes", std: "5.G.B.4", glyph: "⊂", c: "create", band: "g35", gen(r) {
    const pick = pickWith(r); const [q, a] = pick([["Is every square a rectangle?", "yes"], ["Is every rectangle a square?", "no"], ["Is every square a rhombus?", "yes"], ["Is every rhombus a square?", "no"], ["Is every rectangle a parallelogram?", "yes"], ["Is every trapezoid a parallelogram?", "no"]] as const);
    return { ask: q, prompt: q, plain: q, kind: "choice", answer: a, choices: [{ v: "yes", label: "yes" }, { v: "no", label: "no" }], steps: ["Think about what each shape must have.", a === "yes" ? "The first shape always has everything the second needs." : "The first shape doesn't always have what the second needs.", `So: ${a}.`] };
  } },
  // ─── Batch: grades 6–8 ───
  g6ratio: { name: "Ratios", std: "6.RP.A.1", glyph: "a:b", c: "nature", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const a = rnd(1, 9), b = rnd(1, 9), k = rnd(2, 6), [x, y] = pick([["red", "blue"], ["cats", "dogs"], ["boys", "girls"]] as const);
    return { ask: `The ratio of ${x} to ${y} is ${a}:${b}. If there are ${a * k} ${x}, how many ${y}?`, prompt: `${a}:${b} = ${a * k}:<span class="blank">?</span>`, plain: `${a}:${b} = ${a * k}:?`, viz: tape([{ name: x, parts: Array.from({ length: a }, () => ({ label: "", size: 1, fill: true })), whole: `${a * k}` }, { name: y, parts: Array.from({ length: b }, () => ({ label: "", size: 1 })), whole: "?" }]), answer: b * k, steps: [`${a} × ${k} = ${a * k}, so scale by ${k}.`, `${b} × ${k} = ${b * k}.`] };
  } },
  g6ratiotable: { name: "Ratio tables", std: "6.RP.A.3a", glyph: "⊞", c: "nature", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 6), b = rnd(3, 12), ks = [1, 2, 3, rnd(4, 10)];
    return { ask: "Fill in the ratio table.", prompt: `${ks.slice(0, 3).map((k) => `${a * k} → ${b * k}`).join(" · ")} · ${a * ks[3]} → <span class="blank">?</span>`, plain: `ratio table ${a}:${b}`, long: true, answer: b * ks[3], steps: [`Each row is ${a}:${b} times a number.`, `${a * ks[3]} = ${a} × ${ks[3]}, so ${b} × ${ks[3]} = ${b * ks[3]}.`] };
  } },
  g6unitconv: { name: "Convert units with ratios", std: "6.RP.A.3d", glyph: "in→ft", c: "nature", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const [small, big, k] = pick([["inches", "feet", 12], ["feet", "yards", 3], ["ounces", "pounds", 16], ["minutes", "hours", 60], ["centimeters", "meters", 100]] as const), n = rnd(2, 12);
    return { ask: `How many ${big} are ${n * k} ${small}?`, prompt: `${n * k} ${small} = <span class="blank">?</span> ${big}`, plain: `${n * k} ${small} in ${big}`, answer: n, steps: [`${k} ${small} = 1 ${big.replace(/s$/, "")}.`, `${n * k} ÷ ${k} = ${n}.`] };
  } },
  g6divfrac: { name: "Divide fractions", std: "6.NS.A.1", glyph: "÷", c: "create", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([2, 3, 4, 6, 8]), n = rnd(1, d - 1), q = rnd(2, 8), top = n * q;
    return { ask: `How many ${frac(n, d)}s fit in ${frac(top, d)}?`, prompt: `${frac(top, d)} ÷ ${frac(n, d)} = <span class="blank">?</span>`, plain: `${top}/${d} ÷ ${n}/${d}`, answer: q, steps: ["Multiply by the flip of the second fraction.", `${top}/${d} × ${d}/${n} = ${top}/${n} = ${q}.`] };
  } },
  g6longdiv: { name: "Long division", std: "6.NS.B.2", glyph: "⟌", c: "create", band: "g68", gen(r) {
    const rnd = rndWith(r); const d = rnd(12, 98), q = rnd(102, 999), n = d * q;
    return { ask: "Divide.", prompt: `${n.toLocaleString("en-US")} ÷ ${d} = <span class="blank">?</span>`, plain: `${n} ÷ ${d}`, long: true, answer: q, steps: [`Estimate, multiply, subtract, bring down.`, `Check: ${d} × ${q} = ${n.toLocaleString("en-US")}.`] };
  } },
  g6decops: { name: "Decimal operations", std: "6.NS.B.3", glyph: ".±", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); const k = rnd(0, 3), a = rnd(105, 999) / 100, b = rnd(11, 99) / 10;
    const [op, ans] = k === 0 ? ["+", a + b] : k === 1 ? [MINUS, Math.abs(a - b)] : k === 2 ? ["×", a * b] : ["÷", 0];
    if (k === 3) { const q = rnd(11, 99) / 10, dd = rnd(2, 9) / 10, t = Math.round(q * dd * 100) / 100; return { ask: "Divide.", prompt: `${t} ÷ ${dd} = <span class="blank">?</span>`, plain: `${t} ÷ ${dd}`, answer: q, steps: [`Move both points one place: ${Math.round(t * 1000) / 100} ÷ ${Math.round(dd * 10)}.`, `= ${q}.`] }; }
    const [x, y] = k === 1 && b > a ? [b, a] : [a, b], res = Math.round(ans * 10000) / 10000;
    return { ask: "Compute.", prompt: `${x} ${op} ${y} = <span class="blank">?</span>`, plain: `${x} ${op} ${y}`, answer: res, steps: [k === 2 ? "Multiply as whole numbers, then count decimal places." : "Line up the decimal points.", `= ${res}.`] };
  } },
  g6negative: { name: "Positive and negative numbers", std: "6.NS.C.5", glyph: "±", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(-15, -1), b = rnd(1, 20);
    return { ask: `It was ${N(a)}°F in the morning and ${b}°F at noon. How many degrees did it warm up?`, prompt: `${b} ${MINUS} ${P(a)} = <span class="blank">?</span>`, plain: `${N(a)} to ${b}`, viz: numberLine(a, a - 1, b + 1), answer: b - a, steps: [`From ${N(a)} up to 0 is ${-a}.`, `From 0 up to ${b} is ${b}.`, `${-a} + ${b} = ${b - a}.`] };
  } },
  g6coorddist: { name: "Distance on the coordinate plane", std: "6.NS.C.8", glyph: "↔", c: "fly", band: "g68", gen(r) {
    const rnd = rndWith(r); const x = rnd(-8, 8), y1 = rnd(-9, 9); let y2: number; do { y2 = rnd(-9, 9); } while (y2 === y1);
    const sameX = r() < 0.5, A = sameX ? [x, y1] : [y1, x], B = sameX ? [x, y2] : [y2, x];
    return { ask: "How far apart are these points?", prompt: `(${N(A[0])}, ${N(A[1])}) and (${N(B[0])}, ${N(B[1])})`, plain: `distance from (${N(A[0])}, ${N(A[1])}) to (${N(B[0])}, ${N(B[1])})`, long: true, viz: pointsPlane([[A[0], A[1]], [B[0], B[1]]], true), answer: Math.abs(y2 - y1), steps: [`They share ${sameX ? "an x" : "a y"}-coordinate, so count along the other.`, `|${N(y2)} ${MINUS} ${P(y1)}| = ${Math.abs(y2 - y1)}.`] };
  } },
  g6distribute: { name: "The distributive property", std: "6.EE.A.3", glyph: "a(b+c)", c: "serve", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), b = rnd(1, 12);
    return { ask: "Use the distributive property.", prompt: `${a}(x + ${b}) = ${a}x + <span class="blank">?</span>`, plain: `${a}(x + ${b})`, answer: a * b, steps: [`Multiply ${a} by each part inside.`, `${a} · x = ${a}x and ${a} · ${b} = ${a * b}.`] };
  } },
  g6ineq: { name: "Does it make the inequality true?", std: "6.EE.B.5", glyph: ">", c: "fly", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const a = rnd(2, 6), b = rnd(1, 15), x = rnd(0, 10), sym = pick([">", "<", "≥", "≤"] as const), left = a * x + b, right = a * rnd(0, 10) + b;
    const truth = sym === ">" ? left > right : sym === "<" ? left < right : sym === "≥" ? left >= right : left <= right;
    return { ask: `Is x = ${x} a solution?`, prompt: `${a}x + ${b} ${sym} ${right}`, plain: `${a}x + ${b} ${sym} ${right}, x = ${x}`, kind: "choice", answer: truth ? "yes" : "no", choices: [{ v: "yes", label: "yes" }, { v: "no", label: "no" }],
      steps: [`Put in ${x}: ${a} · ${x} + ${b} = ${left}.`, `Is ${left} ${sym} ${right}? ${truth ? "Yes" : "No"}.`] };
  } },
  g6surface: { name: "Surface area of boxes", std: "6.G.A.4", glyph: "⧉", c: "create", band: "g68", gen(r) {
    const rnd = rndWith(r); const l = rnd(2, 9), w = rnd(2, 8), h = rnd(2, 7), sa = 2 * (l * w + l * h + w * h);
    return { ask: `A box is ${l} by ${w} by ${h} cm. What is its surface area in square cm?`, prompt: `2(${l}·${w} + ${l}·${h} + ${w}·${h}) = <span class="blank">?</span>`, plain: `surface area ${l}×${w}×${h}`, long: true, viz: boxSvg(`${l} cm`, `${w} cm`, `${h} cm`), answer: sa, steps: [`Faces come in pairs: ${l * w}, ${l * h}, ${w * h}.`, `${l * w} + ${l * h} + ${w * h} = ${l * w + l * h + w * h}.`, `Double it: ${sa}.`] };
  } },
  g6median: { name: "Median and range", std: "6.SP.B.5c", glyph: "M", c: "nature", band: "g68", gen(r) {
    const rnd = rndWith(r); const n = rnd(2, 3) * 2 + 1, vals = Array.from({ length: n }, () => rnd(1, 50)), s = [...vals].sort((a, b) => a - b), rangeQ = r() < 0.4;
    return rangeQ ? { ask: `Find the range of: ${vals.join(", ")}.`, prompt: `range = <span class="blank">?</span>`, plain: `range of ${vals.join(", ")}`, long: true, answer: s[n - 1] - s[0], steps: [`Biggest ${s[n - 1]}, smallest ${s[0]}.`, `${s[n - 1]} ${MINUS} ${s[0]} = ${s[n - 1] - s[0]}.`] }
      : { ask: `Find the median of: ${vals.join(", ")}.`, prompt: `median = <span class="blank">?</span>`, plain: `median of ${vals.join(", ")}`, long: true, answer: s[(n - 1) / 2], steps: [`In order: ${s.join(", ")}.`, `The middle is ${s[(n - 1) / 2]}.`] };
  } },
  g7combine: { name: "Combine like terms", std: "7.EE.A.1", glyph: "x+x", c: "serve", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), b = rnd(-8, 8) || 3, c = rnd(1, 9), d = rnd(-9, 9) || 2, coef = r() < 0.5;
    const e = `${a}x ${b < 0 ? MINUS : "+"} ${Math.abs(b)} + ${c === 1 ? "" : c}x ${d < 0 ? MINUS : "+"} ${Math.abs(d)}`;
    return { ask: `Simplify. What is the ${coef ? "coefficient of x" : "constant"}?`, prompt: e, plain: e, answer: coef ? a + c : b + d, steps: [`x terms: ${a}x + ${c}x = ${a + c}x.`, `Numbers: ${N(b)} + ${P(d)} = ${N(b + d)}.`, `${a + c}x ${b + d < 0 ? MINUS : "+"} ${Math.abs(b + d)}.`] };
  } },
  g7ineq: { name: "Solve two-step inequalities", std: "7.EE.B.4b", glyph: "x>", c: "fly", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 9), x = rnd(-5, 12), b = rnd(-15, 20), c = a * x + b, gt = r() < 0.5;
    return { ask: `Solve. Enter the number x is ${gt ? "greater" : "less"} than.`, prompt: `${a}x ${b < 0 ? MINUS : "+"} ${Math.abs(b)} ${gt ? ">" : "<"} ${N(c)}`, plain: `${a}x + ${b} ${gt ? ">" : "<"} ${c}`, answer: x, steps: [`${b < 0 ? "Add" : "Subtract"} ${Math.abs(b)}: ${a}x ${gt ? ">" : "<"} ${N(c - b)}.`, `Divide by ${a}: x ${gt ? ">" : "<"} ${N(x)}.`] };
  } },
  g7rational: { name: "Word problems with rational numbers", std: "7.NS.A.3", glyph: "±.", c: "help", band: "g68", gen(r) {
    const rnd = rndWith(r); const start = rnd(-12, 5), drops = rnd(2, 5), each = rnd(2, 6), ans = start - drops * each;
    return { ask: `A diver is at ${N(start)} m. She goes down ${each} m, ${drops} times. Where is she now?`, prompt: `${N(start)} ${MINUS} ${drops} × ${each} = <span class="blank">?</span>`, plain: `${start} − ${drops} × ${each}`, answer: ans, steps: [`${drops} × ${each} = ${drops * each} m down.`, `${N(start)} ${MINUS} ${drops * each} = ${N(ans)}.`] };
  } },
  g7scale: { name: "Scale drawings", std: "7.G.A.1", glyph: "1:n", c: "nature", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const s = pick([2, 5, 10, 20, 50]), d = rnd(2, 15);
    return { ask: `On a map, 1 cm stands for ${s} km. Two towns are ${d} cm apart on the map. How far apart are they really?`, prompt: `${d} × ${s} = <span class="blank">?</span> km`, plain: `${d} cm at 1:${s}`, answer: d * s, steps: [`Each cm is ${s} km.`, `${d} × ${s} = ${d * s} km.`] };
  } },
  g7angles: { name: "Angle relationships", std: "7.G.B.5", glyph: "∠", c: "coral", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const kind = pick(["supplementary", "complementary", "vertical"] as const), a = kind === "complementary" ? rnd(10, 80) : rnd(20, 160);
    const ans = kind === "supplementary" ? 180 - a : kind === "complementary" ? 90 - a : a;
    return { ask: `Two angles are ${kind}. One is ${a}°. What is the other?`, prompt: `<span class="blank">?</span>°`, plain: `${kind}, ${a}`, viz: kind === "vertical" ? undefined : angleSplit(a, kind === "supplementary" ? 180 : 90), answer: ans, steps: [kind === "vertical" ? "Vertical angles are equal." : `${kind[0].toUpperCase() + kind.slice(1)} angles add to ${kind === "supplementary" ? 180 : 90}°.`, `The other angle is ${ans}°.`] };
  } },
  g7prism: { name: "Volume of prisms", std: "7.G.B.6", glyph: "◭", c: "create", band: "g68", gen(r) {
    const rnd = rndWith(r); const b = rnd(2, 10) * 2, h = rnd(2, 9), L = rnd(3, 12), V = (b * h / 2) * L;
    return { ask: `A triangular prism has a triangle base ${b} cm wide and ${h} cm tall, and is ${L} cm long. What is its volume in cubic cm?`, prompt: `½ × ${b} × ${h} × ${L} = <span class="blank">?</span>`, plain: `prism, triangle ${b}×${h}, length ${L}`, long: true, answer: V, steps: [`Base area: ½ × ${b} × ${h} = ${b * h / 2}.`, `× length: ${b * h / 2} × ${L} = ${V}.`] };
  } },
  g7compound: { name: "Compound probability", std: "7.SP.C.8", glyph: "🎲🎲", c: "fly", band: "g68", gen(r) {
    const pick = pickWith(r); const [desc, ans, wrong] = pick([["flipping two coins and getting two heads", "1/4", ["1/2", "1/3", "3/4"]], ["rolling a 6 on one die and heads on a coin", "1/12", ["1/6", "1/8", "7/12"]], ["rolling two dice and getting two sixes", "1/36", ["1/6", "1/12", "2/36"]], ["flipping three coins and getting all tails", "1/8", ["1/6", "1/3", "3/8"]]] as const);
    const choices = [ans, ...wrong].map((v) => ({ v, k: r() })).sort((x, y) => x.k - y.k).map(({ v }) => ({ v, label: v }));
    return { ask: `What is the probability of ${desc}?`, prompt: `P = <span class="blank">?</span>`, plain: desc, kind: "choice", answer: ans, choices, steps: ["For independent events, multiply the chances.", `The answer is ${ans}.`] };
  } },
  g8irrational: { name: "Rational or irrational?", std: "8.NS.A.1", glyph: "√2", c: "tech", band: "g68", gen(r) {
    const pick = pickWith(r); const [x, rat] = pick([["√2", 0], ["√16", 1], ["π", 0], ["0.75", 1], ["1/3", 1], ["√10", 0], ["0.333…", 1], ["√49", 1], ["√7", 0], ["−4", 1]] as const);
    return { ask: `Is ${x} rational or irrational?`, prompt: x, plain: `is ${x} rational`, kind: "choice", answer: rat ? "rational" : "irrational", choices: [{ v: "rational", label: "rational" }, { v: "irrational", label: "irrational" }],
      steps: ["Rational numbers can be written as a fraction of whole numbers; their decimals end or repeat.", `${x} is ${rat ? "rational" : "irrational"}.`] };
  } },
  g8estroot: { name: "Estimate square roots", std: "8.NS.A.2", glyph: "≈√", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); const k = rnd(2, 11), n = rnd(k * k + 1, (k + 1) * (k + 1) - 1);
    return { ask: `√${n} is between two whole numbers. Enter the smaller one.`, prompt: `<span class="blank">?</span> < √${n} < ${k + 1}`, plain: `√${n} between ? and ${k + 1}`, answer: k, steps: [`${k}² = ${k * k} and ${k + 1}² = ${(k + 1) * (k + 1)}.`, `${n} is between them, so √${n} is between ${k} and ${k + 1}.`] };
  } },
  g8cube: { name: "Cube roots", std: "8.EE.A.2", glyph: "∛", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); const n = rnd(1, 10);
    return { ask: "Find the cube root.", prompt: `∛${n ** 3} = <span class="blank">?</span>`, plain: `cube root of ${n ** 3}`, answer: n, steps: [`Which number times itself three times is ${n ** 3}?`, `${n} × ${n} × ${n} = ${n ** 3}.`] };
  } },
  g8scimul: { name: "Operations in scientific notation", std: "8.EE.A.4", glyph: "×10ⁿ", c: "tech", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(2, 4), b = rnd(2, 2), m = rnd(2, 7), n = rnd(2, 7);
    return { ask: `Multiply. What is the power of 10 in the answer?`, prompt: `(${a} × 10<sup>${m}</sup>)(${b} × 10<sup>${n}</sup>) = ${a * b} × 10<sup><span class="blank">?</span></sup>`, plain: `(${a}×10^${m})(${b}×10^${n})`, long: true, answer: m + n, steps: [`Multiply the numbers: ${a} × ${b} = ${a * b}.`, `Add the exponents: ${m} + ${n} = ${m + n}.`] };
  } },
  g8system: { name: "Systems of equations", std: "8.EE.C.8", glyph: "{ }", c: "nature", band: "g68", gen(r) {
    const rnd = rndWith(r); const x = rnd(-4, 8), m = rnd(1, 4), b1 = rnd(-6, 6), b2 = b1 + rnd(1, 9) * (r() < 0.5 ? 1 : -1), m2 = m + (b1 - b2) / x || 0;
    if (!x || !Number.isInteger(m2)) { const y = rnd(-5, 8), s = x + y; return { ask: "Solve the system. Enter x.", long: true, prompt: `x + y = ${N(s)}<br>x ${MINUS} y = ${N(x - y)}`, plain: `x + y = ${s}, x − y = ${x - y}`, answer: x, steps: ["Add the equations: the y's cancel.", `2x = ${N(2 * x)}, so x = ${N(x)}.`] }; }
    return { ask: "Where do these lines cross? Enter x.", long: true, prompt: `y = ${m}x ${b1 < 0 ? MINUS : "+"} ${Math.abs(b1)}<br>y = ${m2}x ${b2 < 0 ? MINUS : "+"} ${Math.abs(b2)}`, plain: `y = ${m}x ${sgn(b1)}, y = ${m2}x ${sgn(b2)}`, answer: x, steps: ["Set them equal.", `${m}x ${sgn(b1)} = ${m2}x ${sgn(b2)}.`, `${m - m2 === 1 ? "x" : `${N(m - m2)}x`} = ${N(b2 - b1)}, so x = ${N(x)}.`] };
  } },
  g8function: { name: "Is it a function?", std: "8.F.A.1", glyph: "f", c: "fly", band: "g68", gen(r) {
    const rnd = rndWith(r); const xs = [rnd(-3, 0), rnd(1, 3), rnd(4, 6), rnd(7, 9)], isF = r() < 0.5; const pairs = xs.map((x) => [x, rnd(-5, 9)]);
    if (!isF) pairs[3] = [pairs[1][0], pairs[1][1] + rnd(1, 4)];
    const txt = pairs.map(([x, y]) => `(${N(x)}, ${N(y)})`).join(", ");
    return { ask: "Is this set of points a function?", prompt: `{ ${txt} }`, plain: txt, long: true, kind: "choice", answer: isF ? "yes" : "no", choices: [{ v: "yes", label: "yes" }, { v: "no", label: "no" }],
      steps: ["A function gives each input exactly one output.", isF ? "No x repeats with a different y." : `x = ${N(pairs[1][0])} has two different outputs.`, isF ? "So it is a function." : "So it is not a function."] };
  } },
  g8translate: { name: "Translations", std: "8.G.A.3", glyph: "→", c: "fly", band: "g68", gen(r) {
    const rnd = rndWith(r); const x = rnd(-6, 6), y = rnd(-6, 6), dx = rnd(-5, 5) || 3, dy = rnd(-5, 5) || -2, askX = r() < 0.5;
    return { ask: `Point (${N(x)}, ${N(y)}) moves ${Math.abs(dx)} ${dx > 0 ? "right" : "left"} and ${Math.abs(dy)} ${dy > 0 ? "up" : "down"}. What is its new ${askX ? "x" : "y"}-coordinate?`, prompt: askX ? `(<span class="blank">?</span>, ${N(y + dy)})` : `(${N(x + dx)}, <span class="blank">?</span>)`, plain: `move (${x}, ${y}) by (${dx}, ${dy})`, viz: pointsPlane([[x, y, "start"], [x + dx, y + dy, "?"]], true), answer: askX ? x + dx : y + dy,
      steps: [`Right/left changes x: ${N(x)} ${dx > 0 ? "+" : MINUS} ${Math.abs(dx)} = ${N(x + dx)}.`, `Up/down changes y: ${N(y)} ${dy > 0 ? "+" : MINUS} ${Math.abs(dy)} = ${N(y + dy)}.`] };
  } },
  g8anglesum: { name: "Angles in a triangle", std: "8.G.A.5", glyph: "△", c: "coral", band: "g68", gen(r) {
    const rnd = rndWith(r); const a = rnd(20, 100), b = rnd(20, 160 - a - 0);
    if (a + b >= 175) return { ask: "Two angles of a triangle are 50° and 60°. What is the third?", prompt: `50° + 60° + <span class="blank">?</span>° = 180°`, plain: "50, 60", viz: triangleAngles("50°", "60°", "?"), answer: 70, steps: ["The angles of a triangle add to 180°.", "180 − 110 = 70."] };
    return { ask: `Two angles of a triangle are ${a}° and ${b}°. What is the third?`, prompt: `${a}° + ${b}° + <span class="blank">?</span>° = 180°`, plain: `${a}, ${b}`, viz: triangleAngles(`${a}°`, `${b}°`, "?"), answer: 180 - a - b, steps: ["The angles of a triangle add to 180°.", `180 ${MINUS} ${a + b} = ${180 - a - b}.`] };
  } },
  g8conesphere: { name: "Volume of cones and spheres", std: "8.G.C.9", glyph: "◬", c: "create", band: "g68", gen(r) {
    const rnd = rndWith(r); const cone = r() < 0.5, rad = rnd(1, 6), h = rnd(3, 12), exact = cone ? (314 * rad * rad * h) / 300 : (1256 * rad ** 3) / 300, ans = Math.round(exact);
    return { ask: cone ? `A cone has radius ${rad} and height ${h}. Using π ≈ 3.14, find its volume to the nearest whole number.` : `A sphere has radius ${rad}. Using π ≈ 3.14, find its volume to the nearest whole number.`,
      prompt: cone ? `⅓ × 3.14 × ${rad}² × ${h} ≈ <span class="blank">?</span>` : `4/3 × 3.14 × ${rad}³ ≈ <span class="blank">?</span>`, plain: cone ? `cone r ${rad} h ${h}` : `sphere r ${rad}`, long: true, viz: solidSvg(cone ? "cone" : "sphere", `r = ${rad}`, `h = ${h}`), answer: ans,
      steps: [cone ? "Cone: V = ⅓ × π × r² × h." : "Sphere: V = 4/3 × π × r³.", `≈ ${Math.round(exact * 100) / 100}, rounded to ${ans}.`] };
  } },
  // ─── Batch: high school ───
  hsradical: { name: "Rational exponents", std: "HSN-RN.A.2", glyph: "x^½", c: "tech", band: "g912", gen(r) {
    const pick = pickWith(r); const [b, n, m] = pick([[8, 3, 2], [27, 3, 2], [16, 4, 3], [4, 2, 3], [9, 2, 3], [32, 5, 2], [64, 3, 2], [25, 2, 3], [81, 4, 3]] as const), root = Math.round(b ** (1 / n)), ans = root ** m;
    return { ask: "Evaluate.", prompt: `${b}<sup>${m}/${n}</sup> = <span class="blank">?</span>`, plain: `${b}^(${m}/${n})`, answer: ans, steps: [`The bottom (${n}) is the root: ${n === 2 ? "√" : n + "th root of "}${b} = ${root}.`, `The top (${m}) is the power: ${root}<sup>${m}</sup> = ${ans}.`] };
  } },
  hsfactor: { name: "Factor out the GCF", std: "HSA-SSE.A.2", glyph: "a(…)", c: "serve", band: "g912", gen(r) {
    const rnd = rndWith(r); const g = rnd(2, 9), a = rnd(1, 7), b = rnd(1, 9); if (gcd(a, b) !== 1) return { ask: "Factor out the greatest common factor. What is it?", prompt: `${g * 3}x + ${g * 2}`, plain: `${g * 3}x + ${g * 2}`, answer: g, steps: [`${g * 3} and ${g * 2} share ${g}.`, `${g}(3x + 2).`] };
    return { ask: "Factor out the greatest common factor. What is it?", prompt: `${g * a}x² + ${g * b}x`, plain: `${g * a}x² + ${g * b}x`, answer: g, steps: [`The numbers ${g * a} and ${g * b} share ${g}.`, `So ${g * a}x² + ${g * b}x = ${g}x(${a === 1 ? "" : a}x + ${b}); the number part is ${g}.`] };
  } },
  hsbinomial: { name: "Multiply binomials", std: "HSA-APR.A.1b", glyph: "(x+a)(x+b)", c: "serve", band: "g912", gen(r) {
    const rnd = rndWith(r); const a = rnd(-9, 9) || 2, b = rnd(-9, 9) || -3, which = r() < 0.5;
    return { ask: `Multiply. What is the ${which ? "coefficient of x" : "constant term"}?`, prompt: `(x ${a < 0 ? MINUS : "+"} ${Math.abs(a)})(x ${b < 0 ? MINUS : "+"} ${Math.abs(b)})`, plain: `(x ${sgn(a)})(x ${sgn(b)})`, long: true, answer: which ? a + b : a * b,
      steps: ["FOIL: x·x + x·b + a·x + a·b.", `x terms: ${N(a)} + ${P(b)} = ${N(a + b)}.`, `Constant: ${N(a)} × ${P(b)} = ${N(a * b)}.`] };
  } },
  hsdiscriminant: { name: "How many real solutions?", std: "HSA-REI.B.4b", glyph: "b²−4ac", c: "coral", band: "g912", gen(r) {
    const rnd = rndWith(r); const a = rnd(1, 3), b = rnd(-8, 8), c = rnd(-9, 9), D = b * b - 4 * a * c, ans = D > 0 ? "2" : D === 0 ? "1" : "0";
    return { ask: "How many real solutions does this equation have?", prompt: `${a === 1 ? "" : a}x² ${b < 0 ? MINUS : "+"} ${Math.abs(b)}x ${c < 0 ? MINUS : "+"} ${Math.abs(c)} = 0`, plain: `${a}x² ${sgn(b)}x ${sgn(c)} = 0`, long: true, kind: "choice", answer: ans, choices: ["0", "1", "2"].map((v) => ({ v, label: v })),
      steps: ["Use the discriminant b² − 4ac.", `${P(b)}² − 4(${a})(${P(c)}) = ${N(D)}.`, D > 0 ? "Positive: 2 solutions." : D === 0 ? "Zero: 1 solution." : "Negative: no real solutions."] };
  } },
  hsarith: { name: "Arithmetic sequences", std: "HSF-BF.A.2", glyph: "aₙ", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r); const a1 = rnd(-10, 15), d = rnd(-6, 9) || 4, n = rnd(8, 30), an = a1 + (n - 1) * d;
    return { ask: `Find term number ${n}.`, prompt: `${[0, 1, 2, 3].map((i) => N(a1 + i * d)).join(", ")}, …`, plain: `term ${n} of ${a1}, ${a1 + d}, …`, long: true, answer: an, steps: [`It goes up by ${N(d)} each time.`, `aₙ = a₁ + (n − 1)d = ${N(a1)} + ${n - 1} × ${P(d)} = ${N(an)}.`] };
  } },
  hsgeo: { name: "Geometric sequences", std: "HSF-LE.A.2", glyph: "×r", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r); const a1 = rnd(1, 5), q = rnd(2, 3), n = rnd(5, 7), an = a1 * q ** (n - 1);
    return { ask: `Find term number ${n}.`, prompt: `${[0, 1, 2, 3].map((i) => a1 * q ** i).join(", ")}, …`, plain: `term ${n}`, long: true, answer: an, steps: [`Each term is ${q} times the last.`, `aₙ = ${a1} × ${q}<sup>${n - 1}</sup> = ${an}.`] };
  } },
  hsexpgrowth: { name: "Exponential growth", std: "HSF-LE.A.1c", glyph: "eˣ", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r); const start = rnd(2, 20) * 10, k = rnd(2, 3), t = rnd(2, 4);
    return { ask: `A population of ${start} ${k === 2 ? "doubles" : "triples"} every year. How big is it after ${t} years?`, prompt: `${start} × ${k}<sup>${t}</sup> = <span class="blank">?</span>`, plain: `${start} × ${k}^${t}`, answer: start * k ** t, steps: [`${k === 2 ? "Doubling" : "Tripling"} ${t} times multiplies by ${k ** t}.`, `${start} × ${k ** t} = ${start * k ** t}.`] };
  } },
  hstrig: { name: "Trig ratios", std: "HSG-SRT.C.6", glyph: "sin", c: "coral", band: "g912", gen(r) {
    const pick = pickWith(r); const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]] as const), fn = pick(["sin", "cos", "tan"] as const);
    const ans = fn === "sin" ? `${a}/${c}` : fn === "cos" ? `${b}/${c}` : `${a}/${b}`;
    const opts = [...new Set([ans, `${a}/${c}`, `${b}/${c}`, `${a}/${b}`, `${b}/${a}`])].slice(0, 4);
    return { ask: `In a right triangle, angle A has opposite side ${a}, adjacent side ${b}, and hypotenuse ${c}. What is ${fn} A?`, prompt: `${fn} A = <span class="blank">?</span>`, plain: `${fn} A`, kind: "choice", viz: rightTriangle(`${a}`, `${b}`, `${c}`, true), answer: ans, choices: opts.map((v) => ({ v, k: r() })).sort((x, y) => x.k - y.k).map(({ v }) => ({ v, label: v })),
      steps: ["SOH CAH TOA: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.", `${fn} A = ${ans}.`] };
  } },
  hsdistance: { name: "Distance between two points", std: "HSG-GPE.B.7", glyph: "d", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]] as const), x = rnd(-6, 6), y = rnd(-6, 6), sx = r() < 0.5 ? 1 : -1, sy = r() < 0.5 ? 1 : -1;
    return { ask: "How far apart are these points?", prompt: `(${N(x)}, ${N(y)}) and (${N(x + sx * a)}, ${N(y + sy * b)})`, plain: "distance", long: true, answer: c, steps: [`Across: ${a}. Up or down: ${b}.`, `d = √(${a}² + ${b}²) = √${c * c} = ${c}.`] };
  } },
  hsmidpoint: { name: "Midpoints", std: "HSG-GPE.B.6", glyph: "M", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r); const x1 = rnd(-9, 9), y1 = rnd(-9, 9), mx = rnd(-8, 8), my = rnd(-8, 8), x2 = 2 * mx - x1, y2 = 2 * my - y1, askX = r() < 0.5;
    return { ask: `Find the ${askX ? "x" : "y"}-coordinate of the midpoint.`, prompt: `(${N(x1)}, ${N(y1)}) and (${N(x2)}, ${N(y2)})`, plain: "midpoint", long: true, viz: pointsPlane([[x1, y1], [x2, y2]], true), answer: askX ? mx : my, steps: ["Average the coordinates.", `x: (${N(x1)} + ${P(x2)}) ÷ 2 = ${N(mx)}. y: (${N(y1)} + ${P(y2)}) ÷ 2 = ${N(my)}.`] };
  } },
  hsarc: { name: "Circle arcs and angles", std: "HSG-C.A.2", glyph: "◔", c: "coral", band: "g912", gen(r) {
    const rnd = rndWith(r); const central = rnd(2, 17) * 10, inscribed = r() < 0.5;
    return inscribed ? { ask: `A central angle is ${central}°. What is an inscribed angle on the same arc?`, prompt: `<span class="blank">?</span>°`, plain: `inscribed angle for ${central}`, answer: central / 2, steps: ["An inscribed angle is half the central angle on the same arc.", `${central} ÷ 2 = ${central / 2}°.`] }
      : { ask: `A central angle is ${central}°. What is the measure of its arc?`, prompt: `<span class="blank">?</span>°`, plain: `arc for ${central}`, answer: central, steps: ["An arc measures the same as its central angle.", `${central}°.`] };
  } },
  hscond: { name: "Conditional probability", std: "HSS-CP.A.3", glyph: "P(A|B)", c: "fly", band: "g912", gen(r) {
    const rnd = rndWith(r); const ab = rnd(2, 12), b = ab + rnd(2, 15);
    const opts = [...new Set([`${ab}/${b}`, `${b - ab}/${b}`, `${ab}/${b + rnd(3, 9)}`, `${b}/${ab + b}`])].slice(0, 4);
    return { ask: `In a class, ${b} students play soccer, and ${ab} of them also play piano. A soccer player is picked. What is the chance they play piano?`, prompt: `P(piano | soccer) = <span class="blank">?</span>`, plain: "conditional probability", long: true, kind: "choice", answer: `${ab}/${b}`, choices: opts.map((v) => ({ v, k: r() })).sort((x, y) => x.k - y.k).map(({ v }) => ({ v, label: v })),
      steps: ["Only look at the soccer players.", `${ab} of the ${b} play piano: ${ab}/${b}.`] };
  } },
  hsabsval: { name: "Absolute value equations", std: "HSA-REI.B.3", glyph: "|x|", c: "tech", band: "g912", gen(r) {
    const rnd = rndWith(r); const a = rnd(-9, 9), k = rnd(1, 12);
    return { ask: "Solve. Enter the larger solution.", prompt: `|x ${a < 0 ? "+" : MINUS} ${Math.abs(a)}| = ${k}`, plain: `|x − ${a}| = ${k}`, answer: a + k, steps: [`x ${a < 0 ? "+" : MINUS} ${Math.abs(a)} = ${k} or ${N(-k)}.`, `x = ${N(a + k)} or x = ${N(a - k)}.`, `The larger is ${N(a + k)}.`] };
  } },
  // @@MORE@@
} satisfies Record<string, SkillDef>;
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const BANDS: Record<BandId, { label: string; skills: SkillId[] }> = {
  k2: { label: "K–2", skills: ["add20", "sub20", "tens"] },
  g35: { label: "3–5", skills: ["mult", "div", "frac"] },
  g68: { label: "6–8", skills: ["int", "pct", "eq2"] },
  g912: { label: "9–12", skills: ["slope", "linear", "quad"] },
};
export const BAND_IDS = Object.keys(BANDS) as BandId[];

/* ------------------------------------------------------------------ state standards */

/** The grades lessons are listed by. */
export const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "HS"] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_LABELS: Record<Grade, string> = { K: "Kindergarten", 1: "Grade 1", 2: "Grade 2", 3: "Grade 3", 4: "Grade 4", 5: "Grade 5", 6: "Grade 6", 7: "Grade 7", 8: "Grade 8", HS: "High school" };
/** One lesson: a skill to practice, with its Common Core code. */
export type StateLesson = { skill: SkillId; code: string };
/**
 * Lessons by grade, each with its Common Core code. Every state's grade-level math covers these topics; states that
 * use the Common Core codes (Colorado among them) show the code as their own, and the rest show it as a Common Core match.
 */
/** The domains of the standards, in the order they are taught, with names teachers know. */
export const DOMAINS: { id: string; name: string }[] = [
  { id: "CC", name: "Counting & cardinality" }, { id: "OA", name: "Operations & algebraic thinking" }, { id: "NBT", name: "Number & operations in base ten" },
  { id: "NF", name: "Fractions" }, { id: "RP", name: "Ratios & proportional relationships" }, { id: "NS", name: "The number system" }, { id: "EE", name: "Expressions & equations" },
  { id: "F", name: "Functions" }, { id: "MD", name: "Measurement & data" }, { id: "G", name: "Geometry" }, { id: "SP", name: "Statistics & probability" },
  { id: "HSN", name: "Number & quantity" }, { id: "HSA", name: "Algebra" }, { id: "HSF", name: "Functions" }, { id: "HSG", name: "Geometry" }, { id: "HSS", name: "Statistics & probability" },
];
/** A code's domain ("3.NF.A.3b" is NF, "HSA-REI.B.3" is HSA). */
export const domainOf = (code: string) => (code.startsWith("HS") ? code.slice(0, 3) : code.split(".")[1] || "");
const gradeOfCode = (code: string): Grade => (code.startsWith("HS") ? "HS" : (code.split(".")[0] as Grade));
/** Skills that also practice a standard in another grade. */
const ALSO: StateLesson[] = [{ skill: "g3add1000", code: "2.NBT.B.7" }, { skill: "linear", code: "8.EE.C.7" }, { skill: "g6median", code: "6.SP.B.5c" }];
const codeOrder = (a: string, b: string) => {
  const da = DOMAINS.findIndex((d) => d.id === domainOf(a)), db = DOMAINS.findIndex((d) => d.id === domainOf(b));
  return da - db || a.localeCompare(b, "en", { numeric: true });
};
/**
 * Lessons by grade, each with its Common Core code, built from every skill's standard (so a new skill files itself),
 * in domain order. Every state's grade-level math covers these topics; states that use the Common Core codes
 * (Colorado among them) show the code as their own, and the rest show it as a Common Core match.
 */
export const GRADE_LESSONS: Record<Grade, StateLesson[]> = Object.fromEntries(GRADES.map((g) => {
  const seen = new Set<string>();
  const list = [...(Object.entries(SKILLS) as [SkillId, SkillDef][]).map(([skill, d]) => ({ skill, code: d.std })), ...ALSO]
    .filter((l) => gradeOfCode(l.code) === g && !seen.has(l.skill + l.code) && seen.add(l.skill + l.code));
  return [g, list.sort((a, b) => codeOrder(a.code, b.code))];
})) as Record<Grade, StateLesson[]>;

/**
 * Every state and DC. `ccss`: the state's math standards use the Common Core codes, so a lesson's code is the
 * state's own (Colorado checked against its 2020 standards). Otherwise the state numbers its standards its own way
 * (Texas TEKS, Virginia SOL…), and the code shown is labelled as the Common Core match for the same topic.
 */
export type StateInfo = { id: string; name: string; standards: string; ccss: boolean };
export const STATES: StateInfo[] = ([
  ["AL", "Alabama", "Alabama Course of Study: Mathematics", 0], ["AK", "Alaska", "Alaska Mathematics Standards", 0], ["AZ", "Arizona", "Arizona Mathematics Standards", 0],
  ["AR", "Arkansas", "Arkansas Mathematics Standards", 0], ["CA", "California", "California Common Core State Standards: Mathematics", 1], ["CO", "Colorado", "2020 Colorado Academic Standards, Mathematics", 1],
  ["CT", "Connecticut", "Connecticut Core Standards", 1], ["DE", "Delaware", "Common Core State Standards", 1], ["DC", "District of Columbia", "Common Core State Standards", 1],
  ["FL", "Florida", "Florida B.E.S.T. Standards", 0], ["GA", "Georgia", "Georgia's K-12 Mathematics Standards", 0], ["HI", "Hawaii", "Common Core State Standards", 1],
  ["ID", "Idaho", "Idaho Content Standards, Mathematics", 1], ["IL", "Illinois", "Illinois Learning Standards, Mathematics", 1], ["IN", "Indiana", "Indiana Academic Standards", 0],
  ["IA", "Iowa", "Iowa Core Mathematics", 1], ["KS", "Kansas", "Kansas Mathematics Standards", 0], ["KY", "Kentucky", "Kentucky Academic Standards", 0],
  ["LA", "Louisiana", "Louisiana Student Standards", 0], ["ME", "Maine", "Maine Learning Results", 0], ["MD", "Maryland", "Maryland College and Career Ready Standards", 1],
  ["MA", "Massachusetts", "Massachusetts Curriculum Framework for Mathematics", 1], ["MI", "Michigan", "Michigan K-12 Standards, Mathematics", 1], ["MN", "Minnesota", "Minnesota K-12 Academic Standards", 0],
  ["MS", "Mississippi", "Mississippi College- and Career-Readiness Standards", 0], ["MO", "Missouri", "Missouri Learning Standards", 0], ["MT", "Montana", "Montana Common Core Standards", 1],
  ["NE", "Nebraska", "Nebraska's College and Career Ready Standards", 0], ["NV", "Nevada", "Nevada Academic Content Standards", 1], ["NH", "New Hampshire", "New Hampshire College and Career Ready Standards", 1],
  ["NJ", "New Jersey", "New Jersey Student Learning Standards", 1], ["NM", "New Mexico", "Common Core State Standards", 1], ["NY", "New York", "New York State Next Generation Mathematics Learning Standards", 0],
  ["NC", "North Carolina", "North Carolina Standard Course of Study", 0], ["ND", "North Dakota", "North Dakota Mathematics Content Standards", 0], ["OH", "Ohio", "Ohio's Learning Standards", 0],
  ["OK", "Oklahoma", "Oklahoma Academic Standards", 0], ["OR", "Oregon", "Oregon Mathematics Standards", 1], ["PA", "Pennsylvania", "Pennsylvania Core Standards", 0],
  ["RI", "Rhode Island", "Common Core State Standards", 1], ["SC", "South Carolina", "South Carolina College- and Career-Ready Standards", 0], ["SD", "South Dakota", "South Dakota Mathematics Standards", 0],
  ["TN", "Tennessee", "Tennessee Academic Standards", 0], ["TX", "Texas", "Texas Essential Knowledge and Skills (TEKS)", 0], ["UT", "Utah", "Utah Core Standards", 0],
  ["VT", "Vermont", "Common Core State Standards", 1], ["VA", "Virginia", "Virginia Standards of Learning", 0], ["WA", "Washington", "Washington K-12 Learning Standards", 1],
  ["WV", "West Virginia", "West Virginia College- and Career-Readiness Standards", 0], ["WI", "Wisconsin", "Wisconsin Standards for Mathematics", 1], ["WY", "Wyoming", "Wyoming Mathematics Content and Performance Standards", 1],
] as const).map(([id, name, standards, ccss]) => ({ id, name, standards, ccss: !!ccss }));
export const stateById = (id: unknown): StateInfo | undefined => STATES.find((s) => s.id === id);
/** How a lesson's code is labelled in a state: the state's own code, or the Common Core match. */
export const codeLabel = (state: StateInfo | undefined, code: string) => (state?.ccss ? `${state.id} ${code}` : `Common Core ${code}`);
export const isBand = (v: unknown): v is BandId => typeof v === "string" && (BAND_IDS as string[]).includes(v);
export const isSkill = (v: unknown): v is SkillId => typeof v === "string" && Object.prototype.hasOwnProperty.call(SKILLS, v);

/** Three wrong answers near the right one, plus the right one, in random order. */
/** Four answer choices: the answer and three near misses. `dec` shows halves as decimals (3.5, not 7/2). */
export function numberChoices(answer: number, allowNegative: boolean, r: Rng, dec = false): Choice[] {
  const step = Number.isInteger(answer) ? 1 : 0.5;
  const places = Math.min(6, (String(answer).split(".")[1] || "").length), fix = (v: number) => Number(v.toFixed(places));
  const pool = [...new Set([answer + step, answer - step, answer + 2 * step, answer - 2 * step, answer + 10, answer - 10, -answer, answer * 2].map(fix))]
    .filter((v) => v !== answer && (allowNegative || v >= 0));
  const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  return shuffle([answer, ...shuffle(pool).slice(0, 3)]).map((v) => ({ v: String(v), label: dec ? N(v) : fmtV(v) }));
}
/** Lessons whose answers are decimals even when they come out to a half. */
const DEC_SKILLS = new Set(["g4decimal", "g5metric", "g5dec", "g5decmul", "g5decround", "g5pow10", "g6decops"]);

export function makeProblem(skill: SkillId, r: Rng = Math.random): Problem {
  const s: SkillDef = SKILLS[skill], g = s.gen(r), kind = g.kind ?? "num";
  const dec = DEC_SKILLS.has(skill) || /\d\.\d/.test(g.plain);
  const choices = kind === "choice" ? g.choices! : numberChoices(Number(g.answer), s.band === "g68" || s.band === "g912", r, dec);
  return { skill, ask: g.ask, prompt: g.prompt, plain: g.plain, viz: g.viz ?? "", long: !!g.long, kind, answer: g.answer, choices, steps: g.steps };
}

export type CustomQuestion = { q: string; a: number; h: string };
export const cleanText = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
/** A teacher's own question, checked before it is saved. */
export function cleanCustom(raw: any): CustomQuestion | null {
  const q = cleanText(raw?.q, 140), a = typeof raw?.a === "number" ? raw.a : parseAnswer(raw?.a), h = cleanText(raw?.h, 160);
  if (!q || !Number.isFinite(a) || Math.abs(a) > 1e9) return null;
  return { q, a, h };
}
export function customProblem(c: CustomQuestion, r: Rng = Math.random): Problem {
  return { skill: "custom", ask: "Your teacher wrote this question.", prompt: esc(c.q), plain: c.q, viz: "", long: c.q.length > 14, kind: "num", answer: c.a,
    choices: numberChoices(c.a, c.a < 0, r), steps: [...(c.h ? [esc(c.h)] : []), `The answer is ${fmtV(c.a)}.`] };
}
/** How the answer is written for people: the matching choice's label (3.5, 7/18, rhombus). */
export const answerLabel = (p: Pick<Problem, "kind" | "answer" | "choices">) =>
  p.kind === "choice" ? String(p.choices.find((c) => c.v === String(p.answer))?.label ?? p.answer) : p.choices.find((c) => Number(c.v) === Number(p.answer))?.label ?? fmtV(Number(p.answer));
export function isRight(p: Pick<Problem, "kind" | "answer">, value: unknown): boolean {
  if (p.kind === "choice") return String(value) === String(p.answer);
  const v = parseAnswer(value);
  return Number.isFinite(v) && Math.abs(v - Number(p.answer)) < 1e-9;
}

/* ------------------------------------------------------------------ points, levels, profiles */

export const POINTS = { firstTry: 10, withHelp: 5, perfectBonus: 20 } as const;
export const LIMITS = { quizzesPerDay: 40, quizLength: [5, 10] as const, customPerAssignment: 20, history: 30, certs: 60 } as const;
export const LEVELS = ["First Light", "Sunrise", "Morning", "Climbing", "High Sun", "Summit", "Skyward"];
export const LEVEL_POINTS = 150;
export const DAILY_GOAL = 15;
export const STYLES = [
  { id: "primary", label: "Indigo", at: 0 }, { id: "coral", label: "Coral", at: 0 }, { id: "create", label: "Teal", at: 0 },
  { id: "sunrise", label: "Sunrise", at: 300 }, { id: "galaxy", label: "Galaxy", at: 600 }, { id: "gold", label: "Gold", at: 1000 },
] as const;
export const MILESTONES = [25, 50, 100, 250, 500, 1000];
export const CERT_TITLES = ["Math Star", "Most Improved", "Hard Worker"] as const;

export type Mastery = Record<string, { r: number; t: number }>;
export type Cert = { t: string; r: string; d: string; by: string };
export type HistoryRow = { d: string; title: string; score: number; of: number; pts: number };
export type MathProfile = {
  points: number; week_key: string | null; week_points: number; week_quizzes: number; week_first: number;
  quizzes: number; solved: number; streak: number; last_active: string | null; day_key: string | null; day_solved: number; day_quizzes: number;
  mastery: Mastery; best: Record<string, number>; certs: Cert[]; history: HistoryRow[];
  flags: { solo?: boolean; live?: boolean }; avatar: string; band: BandId | null; a11y: { choices?: boolean; read?: boolean; big?: boolean };
};
export const emptyMathProfile = (): MathProfile => ({
  points: 0, week_key: null, week_points: 0, week_quizzes: 0, week_first: 0, quizzes: 0, solved: 0, streak: 0, last_active: null, day_key: null, day_solved: 0, day_quizzes: 0,
  mastery: {}, best: {}, certs: [], history: [], flags: {}, avatar: "primary", band: null, a11y: {},
});
const int = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Cleans a stored profile so a bad row can never break the page. */
export function cleanMathProfile(raw: any): MathProfile {
  const p = emptyMathProfile();
  if (!raw || typeof raw !== "object") return p;
  for (const k of ["points", "week_points", "week_quizzes", "week_first", "quizzes", "solved", "streak", "day_solved", "day_quizzes"] as const) p[k] = int(raw[k]);
  for (const k of ["week_key", "last_active", "day_key"] as const) p[k] = isDay(raw[k]) ? raw[k] : null;
  if (raw.mastery && typeof raw.mastery === "object") for (const [k, v] of Object.entries<any>(raw.mastery)) if (isSkill(k) && v) p.mastery[k] = { r: Math.max(0, Number(v.r) || 0), t: int(v.t) };
  if (raw.best && typeof raw.best === "object") for (const [k, v] of Object.entries(raw.best)) if (isSkill(k)) p.best[k] = int(v);
  if (Array.isArray(raw.certs)) p.certs = raw.certs.filter((c: any) => c && c.t).slice(0, LIMITS.certs).map((c: any) => ({ t: cleanText(c.t, 40), r: cleanText(c.r, 120), d: cleanText(c.d, 20), by: cleanText(c.by, 60) }));
  if (Array.isArray(raw.history)) p.history = raw.history.filter((h: any) => h && h.title).slice(0, LIMITS.history).map((h: any) => ({ d: cleanText(h.d, 12), title: cleanText(h.title, 60), score: int(h.score), of: int(h.of), pts: int(h.pts) }));
  if (raw.flags && typeof raw.flags === "object") p.flags = { solo: !!raw.flags.solo, live: !!raw.flags.live };
  if (STYLES.some((s) => s.id === raw.avatar)) p.avatar = raw.avatar;
  if (isBand(raw.band)) p.band = raw.band;
  if (raw.a11y && typeof raw.a11y === "object") p.a11y = { choices: !!raw.a11y.choices, read: !!raw.a11y.read, big: !!raw.a11y.big };
  return p;
}

export function mathDay(at: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}
/** Monday of this week, Mountain Time (the site's school week). */
export function mathWeek(at: number): string {
  const [y, m, d] = mathDay(at).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
const previousDay = (day: string) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

/** Today's and this week's numbers start over on a new day or week; a broken streak shows as 0. */
export function profileNow(p: MathProfile, at: number): MathProfile {
  const out = structuredClone(p), day = mathDay(at), week = mathWeek(at);
  if (out.week_key !== week) { out.week_key = week; out.week_points = 0; out.week_quizzes = 0; out.week_first = 0; }
  if (out.day_key !== day) { out.day_key = day; out.day_solved = 0; out.day_quizzes = 0; }
  if (out.last_active && out.last_active !== day && out.last_active !== previousDay(day)) out.streak = 0;
  return out;
}
/** Marks today as a practice day for the streak. */
export function touchStreak(p: MathProfile, at: number): MathProfile {
  const day = mathDay(at);
  if (p.last_active === day) return p;
  return { ...p, streak: p.last_active === previousDay(day) ? p.streak + 1 : 1, last_active: day };
}
export function addPoints(p: MathProfile, n: number, first: boolean, at: number): MathProfile {
  const out = profileNow(p, at);
  out.points += n; out.week_points += n; out.solved += 1; out.day_solved += 1; if (first) out.week_first += 1;
  return out;
}
export const levelOf = (points: number) => Math.floor(points / LEVEL_POINTS);
export function accuracy(m: Mastery, skills?: string[]): number | null {
  let r = 0, t = 0;
  for (const [k, v] of Object.entries(m)) if (!skills || skills.includes(k)) { r += v.r; t += v.t; }
  return t ? Math.round((100 * r) / t) : null;
}
export const strength = (m: Mastery, skill: string) => (m[skill]?.t ? Math.round((100 * m[skill].r) / m[skill].t) : null);

export const ACHIEVEMENTS = [
  { id: "first", name: "First Quiz", d: "Finish a quiz", ic: "check", c: "leaf" },
  { id: "perfect", name: "Perfect Score", d: "Every answer right", ic: "star", c: "sun" },
  { id: "solo", name: "Solo Climber", d: "A quiz with no hints", ic: "up", c: "primary" },
  { id: "hundred", name: "100 Problems", d: "Solve 100 problems", ic: "target", c: "teach" },
  { id: "streak5", name: "5-Day Streak", d: "Practice 5 days in a row", ic: "flame", c: "coral" },
  { id: "rounded", name: "Well Rounded", d: "Try every skill in your band", ic: "bolt", c: "create" },
  { id: "podium", name: "On the Podium", d: "Top 3 in your class this week", ic: "trophy", c: "fly" },
  { id: "live", name: "Live Player", d: "Play a live review game", ic: "live", c: "sky" },
] as const;
export function earnedAchievements(p: MathProfile, band: BandId, weekRank: number | null): string[] {
  const has: Record<string, boolean> = {
    first: p.quizzes >= 1, perfect: p.certs.some((c) => c.t === "Perfect Score"), solo: !!p.flags.solo, hundred: p.solved >= 100,
    streak5: p.streak >= 5, rounded: BANDS[band].skills.every((s) => (p.mastery[s]?.t ?? 0) > 0), podium: weekRank != null && weekRank <= 3, live: !!p.flags.live,
  };
  return ACHIEVEMENTS.filter((a) => has[a.id]).map((a) => a.id);
}
