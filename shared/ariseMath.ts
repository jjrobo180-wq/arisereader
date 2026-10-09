// Arise Math (/math/): K–12 math practice built like A.R.I.S.E. Reader, with points, a class
// leaderboard, certificates and a game room. Shared by the server (which makes and grades every
// question, so points can't be faked) and the tests. Tables: migrations/arise_math.sql.

export type BandId = "k2" | "g35" | "g68" | "g912";
export type SkillId = "add20" | "sub20" | "tens" | "mult" | "div" | "frac" | "int" | "pct" | "eq2" | "slope" | "linear" | "quad";
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
const frac = (n: number, d: number) => `<span class="fr"><span>${n}</span><span>${d}</span></span>`;
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
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const BANDS: Record<BandId, { label: string; skills: SkillId[] }> = {
  k2: { label: "K–2", skills: ["add20", "sub20", "tens"] },
  g35: { label: "3–5", skills: ["mult", "div", "frac"] },
  g68: { label: "6–8", skills: ["int", "pct", "eq2"] },
  g912: { label: "9–12", skills: ["slope", "linear", "quad"] },
};
export const BAND_IDS = Object.keys(BANDS) as BandId[];
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
