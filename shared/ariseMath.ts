// Arise Math (/math/): K–12 math practice built like A.R.I.S.E. Reader, with points, a class
// leaderboard, certificates and a game room. Shared by the server (which makes and grades every
// question, so points can't be faked) and the tests. Tables: migrations/arise_math.sql.

export type BandId = "k2" | "g35" | "g68" | "g912";
export type SkillId = "add20" | "sub20" | "tens" | "mult" | "div" | "frac" | "int" | "pct" | "eq2" | "slope" | "linear" | "quad"
  | "kcount" | "kadd10" | "kmake10" | "kcompare" | "g1add2d" | "g2addsub" | "g2oddeven" | "g2money" | "g2place"
  | "g3add1000" | "g3area" | "g3round" | "g4mult" | "g4div" | "g4perim" | "g5dec" | "g5mult" | "g5volume" | "g5order"
  | "g6exp" | "g6eval" | "g6gcf" | "g6rate" | "g7prop" | "g7muldiv" | "g8sqrt" | "g8pyth" | "hsfunc" | "hssystem"
  | "kaddsub5" | "kteens" | "g1compare" | "g1word" | "g1time" | "g2word" | "g2tens" | "g2length" | "g3eqfrac" | "g3twostep" | "g3elapsed"
  | "g4addfrac" | "g4prime" | "g4round" | "g4angle" | "g5fracwhole" | "g5pow10" | "g5coord" | "g6abs" | "g6onestep" | "g6tri" | "g6mean"
  | "g7percent" | "g7circle" | "g7prob" | "g8exp" | "g8sci" | "g8cyl" | "hsslope" | "hsmedian" | "hspoly";
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

/* ------------------------------------------------------------------ problems */

export type Choice = { v: string; label: string };
/** A full problem as the server keeps it. The answer and steps never go to the page before they're earned. */
export type Problem = {
  skill: SkillId | "custom"; ask: string; prompt: string; plain: string; viz: string; long: boolean;
  kind: "num" | "choice"; answer: number | string; choices: Choice[]; steps: string[];
};
type Gen = Omit<Problem, "skill" | "choices" | "long" | "kind" | "viz"> & { viz?: string; long?: boolean; kind?: "num" | "choice"; choices?: Choice[] };

export const SKILLS: Record<SkillId, { name: string; std: string; glyph: string; c: string; band: BandId; gen: (r: Rng) => Gen }> = {
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
    return { ask: `How many cents is ${words}?`, prompt: `<span class="blank">?</span> ¢`, plain: `${words}`, answer: cents,
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
    return { ask: `Round ${n} to the nearest ${to}.`, prompt: `${n} ≈ <span class="blank">?</span>`, plain: `round ${n} to the nearest ${to}`, answer: ans,
      steps: [`Look at the ${to === 10 ? "ones" : "tens"} digit: ${digit}.`, digit >= 5 ? "5 or more rounds up." : "4 or less rounds down.", `${n} rounds to ${ans}.`] };
  } },
  g4mult: { name: "Multiply multi-digit numbers", std: "4.NBT.B.5", glyph: "×", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r); const two = r() < 0.5, a = two ? rnd(11, 49) : rnd(102, 989), b = two ? rnd(11, 29) : rnd(2, 9), p = a * b;
    const T = Math.floor(b / 10) * 10, O = b % 10;
    return { ask: "Multiply. Break a number into parts if it helps.", prompt: `${a} × ${b} = <span class="blank">?</span>`, plain: `${a} × ${b}`, answer: p,
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
    if (findSide) return { ask: `A rectangle has a perimeter of ${P2} units. One side is ${l}. How long is the other side?`, prompt: `2 × (${l} + <span class="blank">?</span>) = ${P2}`, plain: `perimeter ${P2}, side ${l}`, answer: w,
      steps: [`Half the perimeter is one length plus one width: ${P2} ÷ 2 = ${l + w}.`, `${l + w} ${MINUS} ${l} = ${w}.`] };
    return { ask: `A rectangle is ${l} units long and ${w} units wide. What is its perimeter?`, prompt: `${l} + ${w} + ${l} + ${w} = <span class="blank">?</span>`, plain: `perimeter of ${l} by ${w}`, answer: P2,
      steps: ["Perimeter is the distance all the way around.", `${l} + ${w} = ${l + w}.`, `Two of those: 2 × ${l + w} = ${P2}.`] };
  } },
  g5dec: { name: "Add and subtract decimals", std: "5.NBT.B.7", glyph: ".5", c: "tech", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(105, 980) / 100, b = rnd(11, 499) / 100, add = r() < 0.5 || b >= a, ans = Math.round((add ? a + b : a - b) * 100) / 100;
    return { ask: "Line up the decimal points.", prompt: `${a.toFixed(2)} ${add ? "+" : MINUS} ${b.toFixed(2)} = <span class="blank">?</span>`, plain: `${a.toFixed(2)} ${add ? "+" : MINUS} ${b.toFixed(2)}`, answer: ans,
      steps: ["Line up the decimal points, one under the other.", add ? "Add the hundredths, then tenths, then ones." : "Subtract the hundredths, then tenths, then ones. Regroup if needed.", `${a.toFixed(2)} ${add ? "+" : MINUS} ${b.toFixed(2)} = ${ans.toFixed(2)}.`] };
  } },
  g5mult: { name: "Multi-digit multiplication", std: "5.NBT.B.5", glyph: "×", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r); const a = rnd(102, 899), b = rnd(12, 79), p = a * b, T = Math.floor(b / 10) * 10, O = b % 10;
    return { ask: "Multiply.", prompt: `${a} × ${b} = <span class="blank">?</span>`, plain: `${a} × ${b}`, long: true, answer: p,
      steps: [`Split ${b} into ${T} and ${O}.`, `${a} × ${O} = ${a * O}.`, `${a} × ${T} = ${a * T}.`, `${a * O} + ${a * T} = ${p}.`] };
  } },
  g5volume: { name: "Volume of boxes", std: "5.MD.C.5", glyph: "▣", c: "create", band: "g35", gen(r) {
    const rnd = rndWith(r); const l = rnd(2, 9), w = rnd(2, 6), h = rnd(2, 8), V = l * w * h;
    return { ask: `A box is ${l} cm long, ${w} cm wide and ${h} cm tall. What is its volume in cubic cm?`, prompt: `${l} × ${w} × ${h} = <span class="blank">?</span>`, plain: `volume of ${l} by ${w} by ${h}`, answer: V,
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
    if (leg) return { ask: `A right triangle has a hypotenuse of ${c} and one leg of ${a}. How long is the other leg?`, prompt: `${a}² + <span class="blank">?</span>² = ${c}²`, plain: `legs ${a} and ?, hypotenuse ${c}`, answer: b,
      steps: ["a² + b² = c².", `${c}² ${MINUS} ${a}² = ${c * c} ${MINUS} ${a * a} = ${b * b}.`, `√${b * b} = ${b}.`] };
    return { ask: `A right triangle has legs ${a} and ${b}. How long is the hypotenuse?`, prompt: `${a}² + ${b}² = <span class="blank">?</span>²`, plain: `legs ${a} and ${b}`, answer: c,
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
    if (kind === 0) return { ask: `${name} has ${a} ${thing}. ${name} gets ${b} more. How many ${thing} now?`, prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, answer: a + b, steps: ["Getting more means add.", `${a} + ${b} = ${a + b}.`] };
    if (kind === 1) { const t = a + b; return { ask: `${name} has ${t} ${thing}. ${name} gives away ${b}. How many are left?`, prompt: `${t} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${t} − ${b}`, answer: a, steps: ["Giving away means subtract.", `${t} ${MINUS} ${b} = ${a}.`] }; }
    const t = a + b; return { ask: `${name} has ${a} ${thing}. ${name} wants ${t}. How many more does ${name} need?`, prompt: `${a} + <span class="blank">?</span> = ${t}`, plain: `${a} + ? = ${t}`, answer: b, steps: [`Count up from ${a} to ${t}.`, `${t} ${MINUS} ${a} = ${b}.`] };
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
    return r() < 0.5 ? { ask: `${name} had ${a} ${thing} and got ${b} more. How many in all?`, prompt: `${a} + ${b} = <span class="blank">?</span>`, plain: `${a} + ${b}`, answer: t, steps: ["In all means add.", `${a} + ${b} = ${t}.`] }
      : { ask: `${name} had ${t} ${thing} and used ${b}. How many are left?`, prompt: `${t} ${MINUS} ${b} = <span class="blank">?</span>`, plain: `${t} − ${b}`, answer: a, steps: ["Left means subtract.", `${t} ${MINUS} ${b} = ${a}.`, `Check: ${a} + ${b} = ${t} ✓`] };
  } },
  g2tens: { name: "Add or take away 10 and 100", std: "2.NBT.B.8", glyph: "±10", c: "build", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const step = pick([10, 100]), add = r() < 0.5, n = add ? rnd(100, 899) : rnd(step + 100, 999), ans = add ? n + step : n - step;
    return { ask: "Use place value. Only one digit changes.", prompt: `${n} ${add ? "+" : MINUS} ${step} = <span class="blank">?</span>`, plain: `${n} ${add ? "+" : MINUS} ${step}`, answer: ans,
      steps: [`${step} is 1 ${step === 10 ? "ten" : "hundred"}.`, `The ${step === 10 ? "tens" : "hundreds"} digit goes ${add ? "up" : "down"} by 1.`, `${n} ${add ? "+" : MINUS} ${step} = ${ans}.`] };
  } },
  g2length: { name: "Length word problems", std: "2.MD.B.5", glyph: "📏", c: "nature", band: "k2", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const [obj, unit] = pick([["ribbon", "inches"], ["rope", "feet"], ["track", "meters"], ["string", "centimeters"]] as const), a = rnd(12, 60), b = rnd(5, 35), longer = r() < 0.5;
    return longer ? { ask: `A ${obj} is ${a} ${unit} long. Another is ${b} ${unit} longer. How long is the second ${obj}?`, prompt: `${a} + ${b} = <span class="blank">?</span> ${unit}`, plain: `${a} + ${b}`, answer: a + b, steps: ["Longer means add.", `${a} + ${b} = ${a + b} ${unit}.`] }
      : { ask: `A ${obj} is ${a + b} ${unit} long. ${b} ${unit} are cut off. How long is it now?`, prompt: `${a + b} ${MINUS} ${b} = <span class="blank">?</span> ${unit}`, plain: `${a + b} − ${b}`, answer: a, steps: ["Cut off means subtract.", `${a + b} ${MINUS} ${b} = ${a} ${unit}.`] };
  } },
  g3eqfrac: { name: "Equivalent fractions", std: "3.NF.A.3b", glyph: "=½", c: "teach", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([2, 3, 4, 6]), n = rnd(1, d - 1), k = pick([2, 3, 4].filter((x) => d * x <= 12)), D = d * k;
    return { ask: "Find the missing number.", prompt: `${frac(n, d)} = ${frac('<span class="blank">?</span>', D)}`, plain: `${n}/${d} = ?/${D}`, viz: fractionBars(n, d, n * k, D), answer: n * k,
      steps: [`${d} × ${k} = ${D}, so the pieces are ${k} times smaller.`, `Multiply the top by ${k} too: ${n} × ${k} = ${n * k}.`, `${n}/${d} = ${n * k}/${D}.`] };
  } },
  g3twostep: { name: "Two-step word problems", std: "3.OA.D.8", glyph: "2×", c: "help", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const name = pick(["Rosa", "Ben", "Kai", "Tess", "Ali"]), packs = rnd(2, 8), per = rnd(3, 9), extra = rnd(2, 15), total = packs * per;
    return r() < 0.5 ? { ask: `${name} buys ${packs} packs of ${per} pencils and already has ${extra}. How many pencils now?`, prompt: `${packs} × ${per} + ${extra} = <span class="blank">?</span>`, plain: `${packs} × ${per} + ${extra}`, answer: total + extra,
        steps: [`First the packs: ${packs} × ${per} = ${total}.`, `Then add the ${extra}: ${total} + ${extra} = ${total + extra}.`] }
      : { ask: `${name} has ${total + extra} cards, gives away ${extra}, and shares the rest equally with ${packs} friends. How many does each friend get?`, prompt: `(${total + extra} ${MINUS} ${extra}) ÷ ${packs} = <span class="blank">?</span>`, plain: `(${total + extra} − ${extra}) ÷ ${packs}`, answer: per,
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
    return { ask: "Find the top number of the answer. The bottom stays the same.", prompt: `${frac(x, d)} ${sub ? MINUS : "+"} ${frac(y, d)} = ${frac('<span class="blank">?</span>', d)}`, plain: `${x}/${d} ${sub ? "−" : "+"} ${y}/${d}`, answer: ans,
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
    return { ask: `Round ${n.toLocaleString("en-US")} to the nearest ${place}.`, prompt: `≈ <span class="blank">?</span>`, plain: `round ${n} to the nearest ${place}`, answer: ans,
      steps: [`Look at the digit to the right of the ${place}s place: ${digit}.`, digit >= 5 ? "5 or more rounds up." : "4 or less rounds down.", `${n.toLocaleString("en-US")} rounds to ${ans.toLocaleString("en-US")}.`] };
  } },
  g4angle: { name: "Missing angles", std: "4.MD.C.7", glyph: "∠", c: "coral", band: "g35", gen(r) {
    const rnd = rndWith(r); const whole = r() < 0.5 ? 90 : 180, a = rnd(2, whole / 5 - 2) * 5, b = whole - a;
    return { ask: `Two angles make a ${whole === 90 ? "right angle (90°)" : "straight line (180°)"}. One is ${a}°. What is the other?`, prompt: `${a}° + <span class="blank">?</span>° = ${whole}°`, plain: `${a} + ? = ${whole}`, answer: b,
      steps: [`Together they make ${whole}°.`, `${whole} ${MINUS} ${a} = ${b}.`, `The other angle is ${b}°.`] };
  } },
  g5fracwhole: { name: "Fraction of a whole number", std: "5.NF.B.4a", glyph: "⅔×", c: "serve", band: "g35", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const d = pick([2, 3, 4, 5, 6, 8]), n = rnd(1, d - 1), w = d * rnd(2, 12), ans = (w / d) * n;
    return { ask: "Multiply.", prompt: `${frac(n, d)} × ${w} = <span class="blank">?</span>`, plain: `${n}/${d} of ${w}`, answer: ans,
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
    return { ask: "Absolute value is the distance from 0.", prompt: two ? `|${N(a)}| + |${N(b)}| = <span class="blank">?</span>` : `|${N(a)}| = <span class="blank">?</span>`, plain: two ? `|${N(a)}| + |${N(b)}|` : `|${N(a)}|`, answer: ans,
      steps: two ? [`|${N(a)}| = ${Math.abs(a)}.`, `|${N(b)}| = ${Math.abs(b)}.`, `${Math.abs(a)} + ${Math.abs(b)} = ${ans}.`] : [`${N(a)} is ${Math.abs(a)} steps from 0.`, `|${N(a)}| = ${ans}.`] };
  } },
  g6onestep: { name: "One-step equations", std: "6.EE.B.7", glyph: "x", c: "serve", band: "g68", gen(r) {
    const rnd = rndWith(r); const x = rnd(2, 30), k = rnd(2, 12), mulEq = r() < 0.5;
    return mulEq ? { ask: "Solve for x.", prompt: `${k}x = ${k * x}`, plain: `${k}x = ${k * x}`, viz: balance(`${k}x`, String(k * x)), answer: x, steps: [`Undo times ${k}: divide both sides by ${k}.`, `x = ${k * x} ÷ ${k} = ${x}.`] }
      : { ask: "Solve for x.", prompt: `x + ${k} = ${x + k}`, plain: `x + ${k} = ${x + k}`, viz: balance(`x + ${k}`, String(x + k)), answer: x, steps: [`Undo plus ${k}: subtract ${k} from both sides.`, `x = ${x + k} ${MINUS} ${k} = ${x}.`] };
  } },
  g6tri: { name: "Area of triangles", std: "6.G.A.1", glyph: "△", c: "create", band: "g68", gen(r) {
    const rnd = rndWith(r); const b = rnd(2, 14) * 2, h = rnd(2, 15), A = (b * h) / 2;
    return { ask: `A triangle has a base of ${b} cm and a height of ${h} cm. What is its area in square cm?`, prompt: `½ × ${b} × ${h} = <span class="blank">?</span>`, plain: `area, base ${b}, height ${h}`, answer: A,
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
    return { ask: off ? `A $${price} jacket is ${p}% off. What is the sale price in dollars?` : `A $${price} bill gets a ${p}% tip. What is the total in dollars?`, prompt: `$<span class="blank">?</span>`, plain: off ? `${p}% off ${price}` : `${price} plus ${p}%`, answer: ans,
      steps: [`${p}% of ${price} = ${change}.`, off ? `${price} ${MINUS} ${change} = ${ans}.` : `${price} + ${change} = ${ans}.`] };
  } },
  g7circle: { name: "Circles: area and circumference", std: "7.G.B.4", glyph: "○", c: "coral", band: "g68", gen(r) {
    const rnd = rndWith(r); const rad = rnd(2, 12), area = r() < 0.5, exact = area ? 3.14 * rad * rad : 2 * 3.14 * rad, ans = Math.round(exact);
    return { ask: `A circle has a radius of ${rad} cm. Using π ≈ 3.14, find its ${area ? "area" : "circumference"}, rounded to the nearest whole number.`, prompt: area ? `3.14 × ${rad}² ≈ <span class="blank">?</span>` : `2 × 3.14 × ${rad} ≈ <span class="blank">?</span>`, plain: `${area ? "area" : "circumference"}, radius ${rad}`, long: true, answer: ans,
      steps: [area ? "Area = π × r × r." : "Circumference = 2 × π × r.", `${area ? `3.14 × ${rad * rad}` : `2 × 3.14 × ${rad}`} = ${Math.round(exact * 100) / 100}.`, `Rounded: ${ans}.`] };
  } },
  g7prob: { name: "Simple probability", std: "7.SP.C.5", glyph: "🎲", c: "fly", band: "g68", gen(r) {
    const rnd = rndWith(r), pick = pickWith(r); const red = rnd(1, 8), blue = rnd(1, 8), green = rnd(0, 6), total = red + blue + green, color = pick(["red", "blue"] as const), k = color === "red" ? red : blue;
    const opts = [...new Set([`${k}/${total}`, `${total - k}/${total}`, `${k}/${Math.max(1, total - k)}`, `${Math.min(total, k + 1)}/${total}`, `1/${total}`])].filter((o, i, all) => all.indexOf(o) === i).slice(0, 4);
    const shuffled = opts.map((v) => ({ v, k: r() })).sort((x, y) => x.k - y.k).map(({ v }) => ({ v, label: v }));
    return { ask: `A bag has ${red} red, ${blue} blue and ${green} green marbles. What is the chance of picking ${color}?`, prompt: `P(${color}) = <span class="blank">?</span>`, plain: `chance of ${color}`, long: true, kind: "choice", answer: `${k}/${total}`, choices: shuffled,
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
    const rnd = rndWith(r); const rad = rnd(1, 6), h = rnd(2, 12), exact = 3.14 * rad * rad * h, ans = Math.round(exact);
    return { ask: `A cylinder has a radius of ${rad} in and a height of ${h} in. Using π ≈ 3.14, find its volume to the nearest whole cubic inch.`, prompt: `3.14 × ${rad}² × ${h} ≈ <span class="blank">?</span>`, plain: `cylinder, radius ${rad}, height ${h}`, long: true, answer: ans,
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
};
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
export const GRADE_LESSONS: Record<Grade, StateLesson[]> = {
  K: [{ skill: "kcount", code: "K.CC.B.5" }, { skill: "kcompare", code: "K.CC.C.7" }, { skill: "kadd10", code: "K.OA.A.2" }, { skill: "kmake10", code: "K.OA.A.4" }, { skill: "kaddsub5", code: "K.OA.A.5" }, { skill: "kteens", code: "K.NBT.A.1" }],
  1: [{ skill: "g1word", code: "1.OA.A.1" }, { skill: "add20", code: "1.OA.C.6" }, { skill: "sub20", code: "1.OA.C.6" }, { skill: "tens", code: "1.NBT.B.2" }, { skill: "g1compare", code: "1.NBT.B.3" }, { skill: "g1add2d", code: "1.NBT.C.4" }, { skill: "g1time", code: "1.MD.B.3" }],
  2: [{ skill: "g2word", code: "2.OA.A.1" }, { skill: "g2oddeven", code: "2.OA.C.3" }, { skill: "g2place", code: "2.NBT.A.1" }, { skill: "g2addsub", code: "2.NBT.B.5" }, { skill: "g2tens", code: "2.NBT.B.8" }, { skill: "g2length", code: "2.MD.B.5" }, { skill: "g2money", code: "2.MD.C.8" }],
  3: [{ skill: "mult", code: "3.OA.C.7" }, { skill: "div", code: "3.OA.C.7" }, { skill: "g3twostep", code: "3.OA.D.8" }, { skill: "g3round", code: "3.NBT.A.1" }, { skill: "g3add1000", code: "3.NBT.A.2" }, { skill: "g3eqfrac", code: "3.NF.A.3b" }, { skill: "g3elapsed", code: "3.MD.A.1" }, { skill: "g3area", code: "3.MD.C.7" }],
  4: [{ skill: "g4prime", code: "4.OA.B.4" }, { skill: "g4round", code: "4.NBT.A.3" }, { skill: "g4mult", code: "4.NBT.B.5" }, { skill: "g4div", code: "4.NBT.B.6" }, { skill: "frac", code: "4.NF.A.2" }, { skill: "g4addfrac", code: "4.NF.B.3a" }, { skill: "g4perim", code: "4.MD.A.3" }, { skill: "g4angle", code: "4.MD.C.7" }],
  5: [{ skill: "g5order", code: "5.OA.A.1" }, { skill: "g5pow10", code: "5.NBT.A.2" }, { skill: "g5mult", code: "5.NBT.B.5" }, { skill: "g5dec", code: "5.NBT.B.7" }, { skill: "g5fracwhole", code: "5.NF.B.4a" }, { skill: "g5volume", code: "5.MD.C.5" }, { skill: "g5coord", code: "5.G.A.2" }],
  6: [{ skill: "g6rate", code: "6.RP.A.3b" }, { skill: "pct", code: "6.RP.A.3c" }, { skill: "g6gcf", code: "6.NS.B.4" }, { skill: "g6abs", code: "6.NS.C.7c" }, { skill: "g6exp", code: "6.EE.A.1" }, { skill: "g6eval", code: "6.EE.A.2c" }, { skill: "g6onestep", code: "6.EE.B.7" }, { skill: "g6tri", code: "6.G.A.1" }, { skill: "g6mean", code: "6.SP.B.5c" }],
  7: [{ skill: "g7prop", code: "7.RP.A.2" }, { skill: "g7percent", code: "7.RP.A.3" }, { skill: "int", code: "7.NS.A.1" }, { skill: "g7muldiv", code: "7.NS.A.2" }, { skill: "eq2", code: "7.EE.B.4a" }, { skill: "g7circle", code: "7.G.B.4" }, { skill: "g7prob", code: "7.SP.C.5" }],
  8: [{ skill: "g8exp", code: "8.EE.A.1" }, { skill: "g8sqrt", code: "8.EE.A.2" }, { skill: "g8sci", code: "8.EE.A.3" }, { skill: "linear", code: "8.EE.C.7" }, { skill: "slope", code: "8.F.B.4" }, { skill: "g8pyth", code: "8.G.B.7" }, { skill: "g8cyl", code: "8.G.C.9" }],
  HS: [{ skill: "linear", code: "HSA-REI.B.3" }, { skill: "quad", code: "HSA-REI.B.4b" }, { skill: "hssystem", code: "HSA-REI.C.6" }, { skill: "hspoly", code: "HSA-APR.A.1" }, { skill: "hsfunc", code: "HSF-IF.A.2" }, { skill: "hsslope", code: "HSF-LE.A.2" }, { skill: "hsmedian", code: "HSS-ID.A.2" }],
};

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
export function numberChoices(answer: number, allowNegative: boolean, r: Rng): Choice[] {
  const step = Number.isInteger(answer) ? 1 : 0.5;
  const pool = [...new Set([answer + step, answer - step, answer + 2 * step, answer - 2 * step, answer + 10, answer - 10, -answer, answer * 2])]
    .filter((v) => v !== answer && (allowNegative || v >= 0));
  const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  return shuffle([answer, ...shuffle(pool).slice(0, 3)]).map((v) => ({ v: String(v), label: fmtV(v) }));
}

export function makeProblem(skill: SkillId, r: Rng = Math.random): Problem {
  const s = SKILLS[skill], g = s.gen(r), kind = g.kind ?? "num";
  const choices = kind === "choice" ? g.choices! : numberChoices(Number(g.answer), s.band === "g68" || s.band === "g912", r);
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
