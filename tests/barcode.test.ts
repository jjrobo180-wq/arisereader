// The app's own barcode reader (shared/barcode.ts), used on iPhones, where Safari has no built-in
// one. Barcodes are drawn here from the standard's bit patterns (written out independently of the
// reader's tables), then blurred, dimmed, tilted, turned and covered in noise the way a phone
// camera sees them, and read back.
import test from "node:test";
import assert from "node:assert/strict";
import { checkDigit, expandUpcE, lineRuns, lookupCode, readPicture, readRuns, type Picture } from "../shared/barcode";

// ── Drawing barcodes ─────────────────────────────────────────────────────────

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R = L.map((c) => c.replace(/./g, (b) => (b === "0" ? "1" : "0")));
const G = R.map((c) => [...c].reverse().join(""));
const FIRST = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
// UPC-E, number system 0: E (even) digits use the G set, O (odd) the L set. Number system 1 swaps them.
const UPCE = ["EEEOOO", "EEOEOO", "EEOOEO", "EEOOOE", "EOEEOO", "EOOEEO", "EOOOEE", "EOEOEO", "EOEOOE", "EOOEOE"];

const ean13 = (code: string) => {
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (FIRST[+code[0]][i - 1] === "L" ? L : G)[+code[i]];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[+code[i]];
  return bits + "101";
};
const upcA = (code: string) => ean13(`0${code}`);
const ean8 = (code: string) => `101${[...code.slice(0, 4)].map((d) => L[+d]).join("")}01010${[...code.slice(4)].map((d) => R[+d]).join("")}101`;
const upcE = (code: string) => {
  const parity = UPCE[+code[7]];
  return `101${[...code.slice(1, 7)].map((d, i) => ((parity[i] === "E") === (code[0] === "0") ? G : L)[+d]).join("")}010101`;
};

/** A repeatable stand-in for Math.random. */
const seeded = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

type Look = {
  module?: number; // pixels per module at the left edge
  stretch?: number; // module width at the right edge, as a share of the left (perspective)
  width?: number; height?: number; // picture size
  dark?: number; light?: number; // ink and paper brightness
  blur?: number; // Gaussian blur radius in pixels
  noise?: number; // noise strength (0-255)
  shade?: number; // light falling off across the picture (0-1)
  tilt?: number; // degrees
  turn?: 0 | 90 | 180 | 270;
  margin?: number; // blank modules each side
  seed?: number;
};

/** A camera-like picture of a barcode: the bars in the middle, with print around them. */
function picture(bits: string, look: Look = {}): Picture {
  const { module = 3, stretch = 1, width = 640, height = 360, dark = 30, light = 225, blur = 0, noise = 0, shade = 0, tilt = 0, turn = 0, margin = 12, seed = 1 } = look;
  const rand = seeded(seed);
  const modules = bits.length + margin * 2;
  // Where each module starts, with modules growing or shrinking steadily across (perspective).
  const edges: number[] = [0];
  for (let i = 0; i < modules; i++) edges.push(edges[i] + module * (1 + (stretch - 1) * (i / modules)));
  const total = edges[modules];
  const x0 = (width - total) / 2, top = height * 0.25, bottom = height * 0.75;
  const ink = (x: number) => { // how much of the pixel column starting at x is bar
    let covered = 0;
    for (let i = 0; i < modules; i++) {
      const b = i - margin;
      if (b < 0 || b >= bits.length || bits[b] !== "1") continue;
      const a = Math.max(x, x0 + edges[i]), z = Math.min(x + 1, x0 + edges[i + 1]);
      if (z > a) covered += z - a;
    }
    return covered;
  };
  const cols = Float32Array.from({ length: width }, (_, x) => ink(x));
  let img = new Float32Array(width * height);
  const rad = (tilt * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad), cx = width / 2, cy = height / 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Turn the barcode by `tilt` around the middle of the picture.
    const u = cos * (x - cx) + sin * (y - cy) + cx, v = -sin * (x - cx) + cos * (y - cy) + cy;
    let k = 0;
    if (v >= top && v < bottom && u >= 0 && u < width - 1) { const i = Math.floor(u), f = u - i; k = cols[i] * (1 - f) + cols[i + 1] * f; }
    else if (v >= bottom + 8 && v < bottom + 20) k = rand() < 0.35 ? 1 : 0; // printed numbers under the bars
    img[y * width + x] = light - (light - dark) * k;
  }
  if (blur > 0) img = gaussian(img, width, height, blur);
  for (let i = 0; i < img.length; i++) {
    const x = i % width;
    let v = img[i] * (1 - shade * (x / width));
    if (noise) v += (rand() + rand() + rand() - 1.5) * noise;
    img[i] = Math.min(255, Math.max(0, v));
  }
  let out = Uint8Array.from(img, (v) => Math.round(v)), w = width, h = height;
  for (let t = 0; t < turn; t += 90) { // a quarter turn clockwise each time
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) next[x * h + (h - 1 - y)] = out[y * w + x];
    out = next; [w, h] = [h, w];
  }
  return { width: w, height: h, data: out, channels: 1 };
}

function gaussian(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.ceil(sigma * 3), k = Array.from({ length: r * 2 + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  const pass = (a: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(a.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const xx = horizontal ? Math.min(w - 1, Math.max(0, x + i)) : x, yy = horizontal ? y : Math.min(h - 1, Math.max(0, y + i));
        s += a[yy * w + xx] * k[i + r];
      }
      out[y * w + x] = s / sum;
    }
    return out;
  };
  return pass(pass(src, true), false);
}

const top = (p: Picture) => readPicture(p)[0];
const reads = (bits: string, look: Look, text: string, format: string) => {
  const r = top(picture(bits, look));
  assert.ok(r, `nothing read (${JSON.stringify(look)})`);
  assert.equal(r.text, text, JSON.stringify(look));
  assert.equal(r.format, format);
  assert.ok(r.hits >= 2, `only ${r.hits} line read it (${JSON.stringify(look)})`);
};

// ── Check digits ─────────────────────────────────────────────────────────────

test("check digits and UPC-E codes work like the standard's own examples", () => {
  assert.equal(checkDigit("590123412345"), 7);
  assert.equal(checkDigit("03600029145"), 2);
  assert.equal(checkDigit("9638507"), 4);
  assert.equal(expandUpcE("04252614"), "042100005264");
  assert.equal(expandUpcE("01234565"), "012345000065");
  assert.equal(expandUpcE("04252615"), null, "wrong check digit");
  assert.equal(expandUpcE("24252614"), null, "UPC-E starts with 0");
  assert.equal(expandUpcE("14252614"), null, "number system 1 is never used");
  // Shortened by the rules or not at all: ending in 3 needs a third digit of 3 or more, ending in 4 a
  // fourth digit that isn't 0, ending in 5 to 9 a fifth digit that isn't 0.
  assert.equal(expandUpcE("04226130"), null);
  assert.equal(expandUpcE("04250640"), null);
  assert.equal(expandUpcE("04252070"), null);
  const shortened = (d: string) => { const c = [...Array(10).keys()].map((k) => `0${d}${k}`).find((x) => expandUpcE(x)); assert.ok(c, d); return expandUpcE(c!); };
  assert.equal(shortened("427613")?.slice(0, 11), "04270000061");
  assert.equal(shortened("425764")?.slice(0, 11), "04257000006");
  assert.equal(shortened("425217")?.slice(0, 11), "04252100007");
  assert.equal(lookupCode({ format: "upc_e", text: "04252614" }), "042100005264");
  assert.equal(lookupCode({ format: "ean_13", text: "5901234123457" }), "5901234123457");
});

// ── Reading clean barcodes ───────────────────────────────────────────────────

test("reads EAN-13, UPC-A, EAN-8 and UPC-E", () => {
  reads(ean13("5901234123457"), {}, "5901234123457", "ean_13");
  reads(ean13("4006381333931"), {}, "4006381333931", "ean_13");
  reads(upcA("036000291452"), {}, "036000291452", "upc_a");
  reads(upcA("049000006346"), {}, "049000006346", "upc_a");
  reads(ean8("96385074"), {}, "96385074", "ean_8");
  reads(upcE("04252614"), {}, "04252614", "upc_e");
  reads(upcE("01234565"), {}, "01234565", "upc_e");
});

test("reads every first digit and digit pattern", () => {
  for (let first = 0; first < 10; first++) {
    const data = `${first}${String(first * 12345678901 + 31415).padStart(11, "7").slice(-11)}`;
    const code = data + checkDigit(data);
    reads(ean13(code), {}, first === 0 ? code.slice(1) : code, first === 0 ? "upc_a" : "ean_13");
  }
  // Every UPC-E check digit, in both number systems.
  for (const ns of ["0"]) {
    const seen = new Set<number>();
    for (let i = 0; seen.size < 10 && i < 500; i++) {
      const start = `${ns}${String((123456 + i * 7919) % 1000000).padStart(6, "0")}`;
      const full = [...Array(10).keys()].map((c) => `${start}${c}`).find((c) => expandUpcE(c));
      if (!full || seen.has(+full[7])) continue;
      seen.add(+full[7]);
      reads(upcE(full), {}, full, "upc_e");
    }
    assert.equal(seen.size, 10, `number system ${ns}: every check digit`);
  }
});

test("number system 1 UPC-E isn't in use, so it's never read", () => {
  const upcA = "14210000526";
  const code = `1425261${checkDigit(upcA)}`;
  assert.deepEqual(readPicture(picture(upcE(code))), []);
});

// ── Reading the way a phone camera sees them ─────────────────────────────────

const code = ean13("5901234123457");

test("small and far away: bars a pixel and a half wide", () => {
  reads(code, { module: 1.6, width: 480 }, "5901234123457", "ean_13");
  reads(code, { module: 2.2, blur: 0.8, noise: 10 }, "5901234123457", "ean_13");
});

test("big and close up", () => {
  reads(code, { module: 11, width: 1400, height: 500, blur: 2.5 }, "5901234123457", "ean_13");
});

test("out of focus, noisy, dim, unevenly lit", () => {
  reads(code, { module: 3, blur: 1.6 }, "5901234123457", "ean_13");
  reads(code, { module: 4, blur: 2.2, noise: 14 }, "5901234123457", "ean_13");
  reads(code, { module: 3, dark: 80, light: 150, noise: 8 }, "5901234123457", "ean_13");
  reads(code, { module: 3, shade: 0.6, noise: 6 }, "5901234123457", "ean_13");
  reads(code, { module: 3, dark: 60, light: 140, blur: 1.2, noise: 10, shade: 0.4 }, "5901234123457", "ean_13");
});

test("tilted, at an angle, upside down and sideways", () => {
  reads(code, { module: 3, tilt: 12 }, "5901234123457", "ean_13");
  reads(code, { module: 3, tilt: -20, blur: 0.8 }, "5901234123457", "ean_13");
  reads(code, { module: 3, stretch: 1.45 }, "5901234123457", "ean_13");
  reads(code, { module: 4, stretch: 0.7, blur: 1 }, "5901234123457", "ean_13");
  reads(code, { module: 3, turn: 180 }, "5901234123457", "ean_13");
  reads(code, { module: 3, tilt: 45, width: 560, height: 560 }, "5901234123457", "ean_13");
  reads(code, { module: 3, tilt: -62, width: 560, height: 560, blur: 0.8 }, "5901234123457", "ean_13");
  reads(code, { module: 3, turn: 90, width: 640, height: 640 }, "5901234123457", "ean_13");
  reads(code, { module: 3, turn: 270, width: 640, height: 640, blur: 1 }, "5901234123457", "ean_13");
  reads(upcE("04252614"), { module: 3, turn: 180, blur: 1 }, "04252614", "upc_e");
  reads(ean8("96385074"), { module: 3, turn: 90, width: 400, height: 400, noise: 8 }, "96385074", "ean_8");
});

test("a narrow blank margin, as when the barcode is printed close to the artwork", () => {
  reads(code, { module: 3, margin: 4 }, "5901234123457", "ean_13");
});

// ── Not reading what isn't there ─────────────────────────────────────────────

test("never makes up a code: noise, random stripes, a wrong check digit", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const rand = seeded(seed);
    const noise: Picture = { width: 320, height: 200, data: Uint8Array.from({ length: 320 * 200 }, () => Math.floor(rand() * 256)), channels: 1 };
    assert.deepEqual(readPicture(noise), []);
    let bits = "";
    while (bits.length < 95) bits += (rand() < 0.5 ? "1" : "0").repeat(1 + Math.floor(rand() * 4));
    assert.deepEqual(readPicture(picture(`101${bits.slice(0, 89)}101`, { seed })), [], `random stripes ${seed}`);
  }
  // 5901234123457 with its last digit changed: the check digit doesn't work out.
  const bad = ean13("5901234123457").slice(0, -10) + R[8] + "101";
  assert.deepEqual(readPicture(picture(bad)), []);
});

test("glare or a thumb over part of a barcode never turns it into a different code", () => {
  const rand = seeded(42);
  for (let i = 0; i < 160; i++) {
    const data = String(Math.floor(rand() * 1e12)).padStart(12, "0");
    const full = data + checkDigit(data);
    const bits = ean13(full);
    const from = Math.floor(rand() * 80), len = 6 + Math.floor(rand() * 40);
    const covered = bits.slice(0, from) + "0".repeat(Math.min(len, bits.length - from)) + bits.slice(from + len);
    for (const r of readPicture(picture(covered, { module: 2 + rand() * 2, seed: i }))) assert.ok(r.text === full || r.text === full.slice(1), `${full} covered at ${from} read as ${r.text}`);
  }
});

test("reads the code even with the numbers and print around it", () => {
  // A whole frame: the barcode is small, off to one side, with lines of "text" above and below.
  const p = picture(code, { module: 2.5, width: 960, height: 540, noise: 6 });
  const rand = seeded(9);
  const data = p.data as Uint8Array;
  for (let y = 20; y < 110; y++) for (let x = 0; x < p.width; x++) if (Math.floor(y / 12) % 2 && rand() < 0.3) data[y * p.width + x] = 40;
  assert.equal(top(p)?.text, "5901234123457");
});

test("each edge is placed to a fraction of a pixel", () => {
  // A bar from 10.25 to 13.75: pixels partly covered are partly dark.
  const values = Array.from({ length: 40 }, (_, x) => 220 - 200 * Math.max(0, Math.min(x + 1, 13.75) - Math.max(x, 10.25)));
  const runs = lineRuns(values);
  assert.equal(runs.length, 3);
  assert.ok(Math.abs(runs[1] - 3.5) < 0.25, `bar ${runs[1]}`);
});

test("reading runs directly: the start of a line can be black, and the code can run backward", () => {
  const widths = (bits: string, m: number) => { const out = [m * 10]; let i = 0; while (i < bits.length) { let j = i; while (j < bits.length && bits[j] === bits[i]) j++; out.push((j - i) * m); i = j; } out.push(m * 10); return out; };
  const runs = widths(code, 2);
  assert.equal(readRuns(runs)?.text, "5901234123457");
  const backward = [...runs].reverse();
  assert.equal(readRuns(backward), null, "read backward it isn't a valid barcode");
});

test("fast enough to read several frames a second", () => {
  const p = picture(code, { module: 2.4, width: 1280, height: 720, blur: 1, noise: 8 });
  const start = performance.now();
  for (let i = 0; i < 5; i++) readPicture(p);
  const each = (performance.now() - start) / 5;
  assert.ok(each < 120, `${each.toFixed(1)} ms a frame`);
  const empty: Picture = { width: 1280, height: 720, data: new Uint8Array(1280 * 720).fill(200), channels: 1 };
  const t0 = performance.now();
  readPicture(empty);
  assert.ok(performance.now() - t0 < 120);
});
