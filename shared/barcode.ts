// Reads the barcodes printed on food packages (EAN-13, UPC-A, EAN-8 and UPC-E) from camera
// pictures. Chrome on Android has a barcode reader built in (BarcodeDetector); Safari on iPhone
// and iPad doesn't, so the app reads the picture itself with this.
//
// How it works: brightness is read along many lines across the picture (and up and down, for a
// barcode held sideways), in both directions (for one held upside down). Each line becomes black
// and white runs, with every edge placed to a fraction of a pixel so a barcode held at a
// comfortable distance, with bars only a pixel or two wide, can still be read. The runs are
// matched against the standard patterns, the guard bars and the blank margins have to be there,
// and the check digit has to work out. A code counts when more than one line agrees.

export type BarcodeFormat = "ean_13" | "upc_a" | "ean_8" | "upc_e";
export type Barcode = { format: BarcodeFormat; text: string };
export type BarcodeRead = Barcode & { hits: number };

/** A picture: brightness (one byte a pixel) or RGBA (four bytes a pixel, as canvas gives it). */
export type Picture = { width: number; height: number; data: ArrayLike<number>; channels: 1 | 4 };

// ── The patterns ─────────────────────────────────────────────────────────────
// Each digit is 7 modules wide: two bars and two spaces. These are the widths of the four runs
// of each digit as the left half prints it (space first). The right half prints the same widths
// bar first, and the "G" set used for the first digit's code is the same widths reversed.

const L_WIDTHS: readonly (readonly number[])[] = [
  [3, 2, 1, 1], [2, 2, 2, 1], [2, 1, 2, 2], [1, 4, 1, 1], [1, 1, 3, 2],
  [1, 2, 3, 1], [1, 1, 1, 4], [1, 3, 1, 2], [1, 2, 1, 3], [3, 1, 1, 2],
];
const G_WIDTHS = L_WIDTHS.map((w) => [...w].reverse());

/** EAN-13's first digit isn't printed as bars: it's which of the six left digits use the G set
 *  (a 1 bit, first digit leftmost). UPC-A is EAN-13 starting with 0, all six in the L set. */
const FIRST_DIGIT = [0x00, 0x0b, 0x0d, 0x0e, 0x13, 0x19, 0x1c, 0x15, 0x16, 0x1a];
/** UPC-E hides its check digit the same way (number system 0, the only one in use). */
const UPCE_PARITY = [0x38, 0x34, 0x32, 0x31, 0x2c, 0x26, 0x23, 0x2a, 0x29, 0x25];

// How far a group of runs may be from a pattern: on average, and for any single run, as a share
// of one module. The same limits the ZXing barcode library uses.
const MAX_AVG_VARIANCE = 0.48;
const MAX_INDIVIDUAL_VARIANCE = 0.7;

// ── Check digits ─────────────────────────────────────────────────────────────

/** The check digit for the digits before it (EAN-13, UPC-A and EAN-8 all use this): from the
 *  right, digits are weighted 3, 1, 3, 1… */
export function checkDigit(data: string): number {
  let sum = 0;
  for (let i = data.length - 1, w = 3; i >= 0; i--, w = 4 - w) sum += Number(data[i]) * w;
  return (10 - (sum % 10)) % 10;
}
const checks = (code: string) => /^\d+$/.test(code) && checkDigit(code.slice(0, -1)) === Number(code[code.length - 1]);

/** A UPC-E code (8 digits: number system, six digits, check digit) as the full UPC-A code it
 *  stands for, or null if it isn't a valid UPC-E. Food databases mostly list the UPC-A.
 *  UPC-E is a shortened UPC-A for small packages, made by dropping zeros by fixed rules, and
 *  only for number system 0. A code that doesn't follow the rules isn't one that gets printed. */
export function expandUpcE(code: string): string | null {
  if (!/^0\d{7}$/.test(code)) return null;
  const d = code.slice(1, 7), last = d[5];
  // Each shape is only used when a shorter one wouldn't do (so the same UPC-A never shortens two ways).
  if ((last === "3" && d[2] <= "2") || (last === "4" && d[3] === "0") || (last >= "5" && d[4] === "0")) return null;
  const body = last <= "2" ? `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`
    : last === "3" ? `${d.slice(0, 3)}00000${d.slice(3, 5)}`
    : last === "4" ? `${d.slice(0, 4)}00000${d[4]}`
    : `${d.slice(0, 5)}0000${last}`;
  const upcA = `0${body}${code[7]}`;
  return checks(upcA) ? upcA : null;
}

// ── Matching runs to patterns ────────────────────────────────────────────────

/** How far `count` runs starting at `at` are from a pattern, as a share of their total width
 *  (0 is a perfect match), or Infinity when any one run is too far off. */
function variance(runs: readonly number[], at: number, pattern: readonly number[]): number {
  let total = 0, modules = 0;
  for (let i = 0; i < pattern.length; i++) { total += runs[at + i]; modules += pattern[i]; }
  if (!(total > 0)) return Infinity;
  const unit = total / modules, limit = MAX_INDIVIDUAL_VARIANCE * unit;
  let off = 0;
  for (let i = 0; i < pattern.length; i++) {
    const d = Math.abs(runs[at + i] - pattern[i] * unit);
    if (d > limit) return Infinity;
    off += d;
  }
  return off / total;
}

/** The digit printed by the four runs at `at`, and whether it's in the G set. */
function digitAt(runs: readonly number[], at: number, withG: boolean): { digit: number; g: number } | null {
  let best = MAX_AVG_VARIANCE, digit = -1, g = 0;
  for (let d = 0; d < 10; d++) {
    const v = variance(runs, at, L_WIDTHS[d]);
    if (v < best) { best = v; digit = d; g = 0; }
    if (withG) { const vg = variance(runs, at, G_WIDTHS[d]); if (vg < best) { best = vg; digit = d; g = 1; } }
  }
  return digit < 0 ? null : { digit, g };
}

const span = (runs: readonly number[], at: number, count: number) => { let t = 0; for (let i = 0; i < count; i++) t += runs[at + i]; return t; };
/** Guard bars and spaces are one module each; blur and ink spread let them stray a little. */
function guard(runs: readonly number[], at: number, count: number, module: number): boolean {
  for (let i = 0; i < count; i++) { const r = runs[at + i] / module; if (r < 0.35 || r > 2.1) return false; }
  return true;
}
/** Each digit is seven modules; perspective lets that stretch or squeeze across the code. */
const digitWidthOk = (runs: readonly number[], at: number, module: number) => { const w = span(runs, at, 4) / module; return w > 4.2 && w < 10.5; };

// Runs alternate white, black, white…, starting with white, so black runs sit at odd indexes.
// Each reader is given the index of the first black run (the start guard's first bar).

function readEan13(runs: readonly number[], s: number): Barcode | null {
  if (s + 59 >= runs.length) return null;
  const module = span(runs, s, 59) / 95;
  // Blank margins on both sides (the standard asks for 11 and 7 modules; allow for cropping).
  if (runs[s - 1] < 3 * module || runs[s + 59] < 3 * module) return null;
  if (!guard(runs, s, 3, module) || !guard(runs, s + 27, 5, module) || !guard(runs, s + 56, 3, module)) return null;
  let digits = "", parity = 0;
  for (let k = 0; k < 6; k++) {
    const at = s + 3 + 4 * k;
    if (!digitWidthOk(runs, at, module)) return null;
    const d = digitAt(runs, at, true);
    if (!d) return null;
    digits += d.digit;
    parity = (parity << 1) | d.g;
  }
  const first = FIRST_DIGIT.indexOf(parity);
  if (first < 0) return null;
  for (let k = 0; k < 6; k++) {
    const at = s + 32 + 4 * k;
    if (!digitWidthOk(runs, at, module)) return null;
    const d = digitAt(runs, at, false);
    if (!d) return null;
    digits += d.digit;
  }
  const code = `${first}${digits}`;
  if (!checks(code)) return null;
  return first === 0 ? { format: "upc_a", text: code.slice(1) } : { format: "ean_13", text: code };
}

function readEan8(runs: readonly number[], s: number): Barcode | null {
  if (s + 43 >= runs.length) return null;
  const module = span(runs, s, 43) / 67;
  if (runs[s - 1] < 4 * module || runs[s + 43] < 4 * module) return null;
  if (!guard(runs, s, 3, module) || !guard(runs, s + 19, 5, module) || !guard(runs, s + 40, 3, module)) return null;
  let code = "";
  for (const [from, count] of [[s + 3, 4], [s + 24, 4]] as const) {
    for (let k = 0; k < count; k++) {
      const at = from + 4 * k;
      if (!digitWidthOk(runs, at, module)) return null;
      const d = digitAt(runs, at, false);
      if (!d) return null;
      code += d.digit;
    }
  }
  return checks(code) ? { format: "ean_8", text: code } : null;
}

function readUpcE(runs: readonly number[], s: number): Barcode | null {
  if (s + 33 >= runs.length) return null;
  const module = span(runs, s, 33) / 51;
  // Wide margins: a narrower gap could be the inside of a longer barcode.
  if (runs[s - 1] < 5 * module || runs[s + 33] < 5 * module) return null;
  // UPC-E is small, so it's held about flat: its guards and digits must be closer to true size.
  for (const [at, count] of [[s, 3], [s + 27, 6]] as const) for (let i = 0; i < count; i++) { const r = runs[at + i] / module; if (r < 0.45 || r > 1.75) return null; }
  let digits = "", parity = 0;
  for (let k = 0; k < 6; k++) {
    const at = s + 3 + 4 * k, w = span(runs, at, 4) / module;
    if (w < 5.6 || w > 8.4) return null;
    const d = digitAt(runs, at, true);
    if (!d) return null;
    digits += d.digit;
    parity = (parity << 1) | d.g;
  }
  const check = UPCE_PARITY.indexOf(parity);
  if (check < 0) return null;
  const code = `0${digits}${check}`;
  return expandUpcE(code) ? { format: "upc_e", text: code } : null;
}

/** The first barcode found in a line's runs, read left to right. */
export function readRuns(runs: readonly number[]): Barcode | null {
  for (let s = 1; s < runs.length; s += 2) {
    const found = readEan13(runs, s) ?? readEan8(runs, s) ?? readUpcE(runs, s);
    if (found) return found;
  }
  return null;
}

// ── From brightness to runs ──────────────────────────────────────────────────

const BLOCK = 8;
/** Below this difference between the darkest and lightest nearby (out of 255) there's no
 *  barcode there, just paper or packaging, and the whole line's cut-off is used instead. */
const MIN_CONTRAST = 24;

/** Black and white runs along a line of brightness values (0 dark, 255 light), each edge found
 *  to a fraction of a pixel. Runs alternate white, black, white…, and the first one is white
 *  (empty when the line starts on black). `shift` moves the dark/light cut-off up or down by a
 *  share of the local contrast, for print that comes out bolder or fainter than it should. */
export function lineRuns(values: ArrayLike<number>, shift = 0): number[] {
  const n = values.length;
  if (n < 24) return [];
  const blocks = Math.ceil(n / BLOCK);
  const lo = new Float32Array(blocks), hi = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    let a = 255, z = 0;
    for (let x = b * BLOCK, end = Math.min(n, x + BLOCK); x < end; x++) { const v = values[x]; if (v < a) a = v; if (v > z) z = v; }
    lo[b] = a; hi[b] = z;
  }
  // The whole line's cut-off: halfway between its dark and light (ignoring the extremes).
  const sortedLo = Array.from(lo).sort((p, q) => p - q), sortedHi = Array.from(hi).sort((p, q) => p - q);
  const gLo = sortedLo[Math.floor(blocks * 0.1)], gHi = sortedHi[Math.min(blocks - 1, Math.floor(blocks * 0.9))];
  const globalCut = gLo + (gHi - gLo) * (0.5 + shift);
  // Each block's cut-off: halfway between the darkest and lightest nearby.
  const reach = Math.max(2, Math.round(Math.min(96, Math.max(24, n / 14)) / BLOCK));
  const cut = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    let a = 255, z = 0;
    for (let k = Math.max(0, b - reach), end = Math.min(blocks - 1, b + reach); k <= end; k++) { if (lo[k] < a) a = lo[k]; if (hi[k] > z) z = hi[k]; }
    cut[b] = z - a < MIN_CONTRAST || gHi - gLo < MIN_CONTRAST ? globalCut : a + (z - a) * (0.5 + shift);
  }
  // Cut-off at a pixel: blended between block centers, so it doesn't jump at block edges.
  const cutAt = (x: number) => {
    const f = (x - (BLOCK - 1) / 2) / BLOCK, b = Math.floor(f);
    if (b < 0) return cut[0];
    if (b >= blocks - 1) return cut[blocks - 1];
    const t = f - b;
    return cut[b] * (1 - t) + cut[b + 1] * t;
  };
  const runs: number[] = [];
  let dark = values[0] < cutAt(0), last = 0;
  if (dark) runs.push(0);
  let before = values[0] - cutAt(0);
  for (let x = 1; x < n; x++) {
    const now = values[x] - cutAt(x);
    if ((now < 0) !== dark) {
      // The edge is where the brightness crosses the cut-off, between pixel x-1 and x.
      const edge = x - 1 + (before === now ? 0.5 : Math.min(1, Math.max(0, before / (before - now))));
      runs.push(edge - last);
      last = edge;
      dark = !dark;
    }
    before = now;
  }
  runs.push(n - last);
  return runs;
}

/** The same runs read from the other end. */
function reversed(runs: readonly number[]): number[] {
  const out = [...runs].reverse();
  if (out.length % 2 === 0) out.unshift(0); // the line ended on black: keep white first
  return out;
}

/** A sharpened copy of a line, for a picture that's a little out of focus: each value is pushed
 *  away from the average around it, which brings thin bars back up to full contrast. */
function sharpen(values: Float32Array, radius: number, amount: number): Float32Array {
  const n = values.length, out = new Float32Array(n);
  for (let x = 0; x < n; x++) {
    let s = 0, c = 0;
    for (let k = -radius; k <= radius; k++) { const i = x + k; if (i >= 0 && i < n) { s += values[i]; c++; } }
    out[x] = Math.min(255, Math.max(0, values[x] + (values[x] - s / c) * amount));
  }
  return out;
}

/** Reads one line of brightness values, trying a few cut-offs, sharpening for blur, and both
 *  directions. */
export function readLine(values: Float32Array): Barcode | null {
  const tries: (() => [Float32Array, number])[] = [
    () => [values, 0], () => [values, -0.12], () => [values, 0.12],
    () => [sharpen(values, 2, 1.2), 0], () => [sharpen(values, 3, 2.4), 0],
  ];
  for (const make of tries) {
    const [line, shift] = make();
    const runs = lineRuns(line, shift);
    if (runs.length < 34) continue;
    const found = readRuns(runs) ?? readRuns(reversed(runs));
    if (found) return found;
  }
  return null;
}

// ── Reading a picture ────────────────────────────────────────────────────────

/** Where to put the lines across a span: the middle first, then spreading out. */
function positions(size: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const step = Math.ceil(i / 2) * (i % 2 ? -1 : 1);
    const at = Math.round(size * (0.5 + step * (0.6 / Math.max(1, count - 1))));
    if (at >= 1 && at < size - 1 && !out.includes(at)) out.push(at);
  }
  return out;
}

const luma = (p: Picture, i: number) => (p.channels === 1 ? p.data[i] : (p.data[i * 4] + 2 * p.data[i * 4 + 1] + p.data[i * 4 + 2]) / 4);

/** Brightness along a row, averaged with the rows above and below (bars run up and down, so
 *  this smooths out noise without blurring the edges). */
function row(p: Picture, y: number): Float32Array {
  const out = new Float32Array(p.width);
  for (let x = 0; x < p.width; x++) out[x] = (luma(p, (y - 1) * p.width + x) + luma(p, y * p.width + x) + luma(p, (y + 1) * p.width + x)) / 3;
  return out;
}
function column(p: Picture, x: number): Float32Array {
  const out = new Float32Array(p.height);
  for (let y = 0; y < p.height; y++) { const i = y * p.width + x; out[y] = (luma(p, i - 1) + luma(p, i) + luma(p, i + 1)) / 3; }
  return out;
}
/** Brightness along a slanted line through (cx, cy) heading (dx, dy), one pixel a step, for a
 *  barcode held at an angle. */
function slanted(p: Picture, cx: number, cy: number, dx: number, dy: number): Float32Array {
  const at = (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * p.width + x0;
    return (luma(p, i) * (1 - fx) + luma(p, i + 1) * fx) * (1 - fy) + (luma(p, i + p.width) * (1 - fx) + luma(p, i + p.width + 1) * fx) * fy;
  };
  // From where the line enters the picture to where it leaves (a pixel in from the edges).
  const range = (c: number, d: number, size: number) => { const a = (2 - c) / d, b = (size - 3 - c) / d; return a < b ? [a, b] : [b, a]; };
  const [ax, bx] = range(cx, dx, p.width), [ay, by] = range(cy, dy, p.height);
  const t0 = Math.max(ax, ay), n = Math.floor(Math.min(bx, by) - t0);
  if (n < 24) return new Float32Array(0);
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const x = cx + (t0 + k) * dx, y = cy + (t0 + k) * dy;
    // Averaged with the lines a pixel to either side, along the bars.
    out[k] = (at(x, y) + at(x - dy, y + dx) + at(x + dy, y - dx)) / 3;
  }
  return out;
}

/** Every barcode read in a picture, with how many lines read it, most first. `lines` is how many
 *  lines to read across and up and down (half as many each way on the slant); reading stops
 *  early once one code has been read `enough` times. */
export function readPicture(p: Picture, opts: { lines?: number; sideways?: boolean; enough?: number } = {}): BarcodeRead[] {
  const lines = opts.lines ?? 13, enough = opts.enough ?? 3;
  const found = new Map<string, BarcodeRead>();
  const take = (values: Float32Array) => {
    const r = readLine(values);
    if (!r) return false;
    const key = `${r.format}:${r.text}`;
    const seen = found.get(key);
    if (seen) seen.hits++; else found.set(key, { ...r, hits: 1 });
    return (found.get(key)?.hits ?? 0) >= enough;
  };
  let done = false;
  for (const y of positions(p.height, lines)) if (!done && take(row(p, y))) done = true;
  if (!done && opts.sideways !== false) {
    for (const x of positions(p.width, lines)) if (!done && take(column(p, x))) done = true;
    // Then slanted both ways, for a barcode held at an angle.
    const r = Math.SQRT1_2, short = Math.min(p.width, p.height);
    for (const [dx, dy] of [[r, r], [r, -r]]) {
      for (const off of positions(short, Math.ceil(lines / 2))) {
        if (done) break;
        const o = off - short / 2; // step across the lines, at right angles to them
        if (take(slanted(p, p.width / 2 - dy * o, p.height / 2 + dx * o, dx, dy))) done = true;
      }
    }
  }
  // Longer codes first when hits tie: a UPC-E can be a misread corner of a longer barcode.
  const rank = (r: BarcodeRead) => r.hits * 10 + (r.format === "ean_13" || r.format === "upc_a" ? 2 : r.format === "ean_8" ? 1 : 0);
  return [...found.values()].sort((a, b) => rank(b) - rank(a));
}

/** The code to look up for a read: UPC-E is looked up as the UPC-A it stands for. */
export const lookupCode = (r: Barcode) => (r.format === "upc_e" ? expandUpcE(r.text) ?? r.text : r.text);
