// Procedural textures for Prism Paintball (no external image assets needed).
import * as THREE from "three";
import { MAP, PB, type Collider } from "@shared/paintball";

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
/** Tileable value noise with period `per`. */
export function vnoise(x: number, y: number, per: number, seed = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const w = (v: number) => ((v % per) + per) % per;
  const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed), c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, per: number, oct = 4, seed = 1) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f, per * f, seed + i * 17) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return s / norm;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean; aniso?: number; mip?: boolean } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.anisotropy = opts.aniso ?? 4;
  t.needsUpdate = true;
  return t;
}

let rngState = 12345;
function rand() { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; }

// ---------------------------------------------------------------------------
// Grass detail (tileable, used as a multiply detail layer)
// ---------------------------------------------------------------------------

export function grassDetailTexture(aniso: number) {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x / 64, y / 64, 8, 4, 3), fine = vnoise(x / 3, y / 3, S / 3, 9);
    const v = 0.78 + n * 0.3 + (fine - 0.5) * 0.18;
    const i = (y * S + x) * 4;
    img.data[i] = clampByte(v * 228); img.data[i + 1] = clampByte(v * 242); img.data[i + 2] = clampByte(v * 220); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // blade strokes
  rngState = 77;
  for (let i = 0; i < 9000; i++) {
    const x = rand() * S, y = rand() * S, len = 3 + rand() * 7, a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
    const l = rand();
    ctx.strokeStyle = l > 0.5 ? `rgba(255,255,235,${0.08 + rand() * 0.12})` : `rgba(10,40,0,${0.08 + rand() * 0.14})`;
    ctx.lineWidth = 0.8 + rand();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  return finish(c, { repeat: [1, 1], srgb: true, aniso });
}

function clampByte(v: number) { return v < 0 ? 0 : v > 255 ? 255 : v; }

// ---------------------------------------------------------------------------
// Turf field layout (stripes, lines, team zones, wear around cover)
// ---------------------------------------------------------------------------

export const FIELD_W = PB.ARENA_X * 2 + 4; // metres covered by the turf texture
export const FIELD_D = PB.ARENA_Z * 2 + 4;

export function fieldTexture(aniso: number, big: boolean) {
  const PX = big ? 22 : 12; // pixels per metre
  const W = Math.round(FIELD_W * PX), H = Math.round(FIELD_D * PX);
  const { c, ctx } = canvas(W, H);
  const toPx = (x: number, z: number): [number, number] => [(x + FIELD_W / 2) * PX, (z + FIELD_D / 2) * PX];
  // base turf with mowing stripes along x
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const mx = x / PX - FIELD_W / 2, mz = y / PX - FIELD_D / 2;
    const stripe = Math.floor((mx + 200) / 4.2) % 2 === 0 ? 1 : 0;
    const n = fbm(x / (PX * 6), y / (PX * 6), 1000, 3, 5);
    let r = 70, g = 142, b = 62;
    if (stripe) { r += 10; g += 16; b += 6; }
    r += (n - 0.5) * 26; g += (n - 0.5) * 34; b += (n - 0.5) * 16;
    // team end-zone tint
    const ez = Math.max(0, (Math.abs(mx) - 30) / 10);
    if (ez > 0) {
      if (mx < 0) { r = r * (1 - ez * 0.12); g += ez * 6; b += ez * 26; }
      else { r += ez * 24; g = g * (1 - ez * 0.1); b += ez * 18; }
    }
    // outside the nets: darker trodden edge
    if (Math.abs(mx) > PB.ARENA_X || Math.abs(mz) > PB.ARENA_Z) { r *= 0.82; g *= 0.82; b *= 0.82; }
    const i = (y * W + x) * 4;
    img.data[i] = clampByte(r); img.data[i + 1] = clampByte(g); img.data[i + 2] = clampByte(b); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // worn dirt around cover pieces and spawns
  rngState = 4242;
  const wear = (x: number, z: number, radius: number, alpha: number) => {
    const [px, py] = toPx(x, z);
    for (let k = 0; k < 14; k++) {
      const ox = (rand() - 0.5) * radius * PX * 1.4, oy = (rand() - 0.5) * radius * PX * 1.4, rr = radius * PX * (0.3 + rand() * 0.6);
      const gr = ctx.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr);
      gr.addColorStop(0, `rgba(122,96,62,${alpha})`); gr.addColorStop(1, "rgba(122,96,62,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px + ox, py + oy, rr, 0, Math.PI * 2); ctx.fill();
    }
  };
  for (const col of MAP.colliders) {
    if (col.vis === "net" || col.vis === "post" || col.vis === "roof" || col.y > 0.1) continue;
    const size = col.kind === "cyl" ? col.r : Math.max(col.w, col.d) / 2;
    wear(col.x, col.z, size + 1.4, 0.12);
  }
  for (const team of MAP.spawns) for (const s of team) wear(s.x, s.z, 1.6, 0.1);
  wear(0, 0, 5.5, 0.12);

  // painted lines
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 0.14 * PX;
  const line = (x1: number, z1: number, x2: number, z2: number) => { const a = toPx(x1, z1), b = toPx(x2, z2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  const AX = PB.ARENA_X - 0.6, AZ = PB.ARENA_Z - 0.6;
  line(-AX, -AZ, AX, -AZ); line(AX, -AZ, AX, AZ); line(AX, AZ, -AX, AZ); line(-AX, AZ, -AX, -AZ);
  line(0, -AZ, 0, -4.2); line(0, 4.2, 0, AZ);
  for (const sx of [-1, 1]) {
    ctx.setLineDash([0.9 * PX, 0.6 * PX]);
    line(sx * 30, -AZ, sx * 30, AZ);
    ctx.setLineDash([]);
  }
  const [cx, cy] = toPx(0, 0);
  ctx.beginPath(); ctx.arc(cx, cy, 5.4 * PX, 0, Math.PI * 2); ctx.stroke();
  // centre prism logo ring (rainbow)
  const colors = ["#ff4d6d", "#ffb703", "#fff15c", "#52d273", "#22d3ee", "#7b6cff"];
  colors.forEach((col, i) => {
    ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.18 * PX;
    ctx.beginPath(); ctx.arc(cx, cy, (3.8 + i * 0.22) * PX, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  // team zone lettering
  ctx.font = `900 ${Math.round(3.4 * PX)}px system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [team, sx] of [[0, -1], [1, 1]] as [number, number][]) {
    const [tx, ty] = toPx(sx * 26.5, 0);
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(sx * -Math.PI / 2);
    ctx.fillStyle = team === 0 ? "rgba(140,240,255,0.32)" : "rgba(255,150,205,0.32)";
    ctx.fillText(team === 0 ? "CYAN" : "MAGENTA", 0, 0);
    ctx.restore();
  }
  return finish(c, { aniso });
}

// ---------------------------------------------------------------------------
// Wood (decks, rails, ramps, crates)
// ---------------------------------------------------------------------------

export function woodTexture(aniso: number, variant: "plank" | "crate" = "plank") {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const boards = variant === "crate" ? 5 : 6;
  const bh = S / boards;
  rngState = variant === "crate" ? 99 : 31;
  for (let b = 0; b < boards; b++) {
    const base = 150 + rand() * 40;
    const hue = [base * 1.0, base * 0.72, base * 0.46];
    const img = ctx.createImageData(S, Math.ceil(bh));
    const off = rand() * 100;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < S; x++) {
      const grain = Math.sin((x / S) * 40 + fbm(x / 90 + off, y / 18, 64, 3, b + 3) * 9) * 0.5 + 0.5;
      const v = 0.8 + grain * 0.2 - fbm(x / 30, (y + b * 50) / 6, 64, 2, 7) * 0.12;
      const i = (y * S + x) * 4;
      img.data[i] = clampByte(hue[0] * v); img.data[i + 1] = clampByte(hue[1] * v); img.data[i + 2] = clampByte(hue[2] * v); img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, Math.round(b * bh));
    ctx.fillStyle = "rgba(40,22,8,0.75)";
    ctx.fillRect(0, Math.round(b * bh), S, 3);
    // nails
    ctx.fillStyle = "rgba(60,60,64,0.9)";
    for (const nx of [18, S - 18]) { ctx.beginPath(); ctx.arc(nx, b * bh + bh * 0.3, 3, 0, 7); ctx.arc(nx, b * bh + bh * 0.7, 3, 0, 7); ctx.fill(); }
  }
  if (variant === "crate") {
    ctx.strokeStyle = "rgba(70,40,15,0.95)"; ctx.lineWidth = 34;
    ctx.strokeRect(17, 17, S - 34, S - 34);
    ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(S - 30, S - 30); ctx.stroke();
    ctx.strokeStyle = "rgba(255,220,170,0.15)"; ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, S - 12, S - 12);
  }
  return finish(c, { aniso });
}

// ---------------------------------------------------------------------------
// Inflatable vinyl (grayscale; tinted by material colour)
// ---------------------------------------------------------------------------

export function vinylTexture(aniso: number) {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#f2f2f2"); g.addColorStop(1, "#e6e6e6");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // panel seams
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 3;
  for (const x of [0, W / 4, W / 2, (3 * W) / 4]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, H * 0.18); ctx.lineTo(W, H * 0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H * 0.86); ctx.lineTo(W, H * 0.86); ctx.stroke();
  // stitching
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
  for (const y of [H * 0.18 + 5, H * 0.86 - 5]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.setLineDash([]);
  // white band with prism logo
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillRect(0, H * 0.42, W, H * 0.14);
  ctx.font = "900 26px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(20,24,40,0.55)";
  for (const x of [W / 8, (5 * W) / 8]) ctx.fillText("PRISM", x, H * 0.49);
  return finish(c, { aniso, repeat: [1, 1] });
}

// ---------------------------------------------------------------------------
// Hay, stone, fabric, metal
// ---------------------------------------------------------------------------

export function hayTexture(aniso: number) {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = "#c9a54a"; ctx.fillRect(0, 0, S, S);
  rngState = 555;
  for (let i = 0; i < 2600; i++) {
    const x = rand() * S, y = rand() * S, len = 6 + rand() * 18, a = (rand() - 0.5) * 0.7;
    const l = rand();
    ctx.strokeStyle = l > 0.6 ? `rgba(255,236,150,${0.35 + rand() * 0.4})` : l > 0.3 ? `rgba(150,110,30,${0.35 + rand() * 0.3})` : `rgba(220,180,80,0.5)`;
    ctx.lineWidth = 0.8 + rand() * 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  ctx.fillStyle = "rgba(120,70,30,0.85)";
  ctx.fillRect(0, S * 0.3, S, 6); ctx.fillRect(0, S * 0.68, S, 6);
  return finish(c, { aniso });
}

export function stoneTexture(aniso: number) {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x / 70, y / 70, 512 / 70, 5, 11);
    const tile = (Math.floor(x / 128) + Math.floor(y / 64)) % 2;
    const edge = Math.min(x % 128, 128 - (x % 128), y % 64, 64 - (y % 64)) < 3 ? 0.62 : 1;
    const v = (0.7 + n * 0.35 + tile * 0.04) * edge;
    const i = (y * S + x) * 4;
    img.data[i] = clampByte(212 * v); img.data[i + 1] = clampByte(208 * v); img.data[i + 2] = clampByte(200 * v); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { aniso, repeat: [1, 1] });
}

export function canopyTexture(team: number) {
  const W = 256, H = 64;
  const { c, ctx } = canvas(W, H);
  const colA = team === 0 ? "#0ea5c6" : team === 1 ? "#e0388b" : "#f5b72b";
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#f8fafc" : colA; ctx.fillRect((i * W) / 8, 0, W / 8, H); }
  return finish(c, {});
}

export function netTexture() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(25,30,36,0.95)"; ctx.lineWidth = 2.4;
  const step = 16;
  for (let i = -S; i <= S * 2; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, S); ctx.lineTo(i + S, 0); ctx.stroke();
  }
  return finish(c, { srgb: true });
}

// ---------------------------------------------------------------------------
// Paint splats (white RGBA, tinted per instance)
// ---------------------------------------------------------------------------

export function splatAtlas() {
  const S = 256, N = 2; // 2x2 atlas
  const { c, ctx } = canvas(S * N, S * N);
  rngState = 2024;
  for (let k = 0; k < 4; k++) {
    const ox = (k % N) * S + S / 2, oy = Math.floor(k / N) * S + S / 2;
    ctx.fillStyle = "#ffffff";
    // central blob with lumpy edge
    ctx.beginPath();
    const pts = 28, base = S * 0.22;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2, r = base * (0.78 + rand() * 0.45);
      const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    // streaks and droplets
    const streaks = 7 + Math.floor(rand() * 6);
    for (let i = 0; i < streaks; i++) {
      const a = rand() * Math.PI * 2, len = S * (0.18 + rand() * 0.24), w = 5 + rand() * 12;
      ctx.lineCap = "round"; ctx.strokeStyle = "#fff"; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(ox + Math.cos(a) * base * 0.6, oy + Math.sin(a) * base * 0.6); ctx.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox + Math.cos(a) * (len + 6), oy + Math.sin(a) * (len + 6), w * 0.7, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2, d = S * (0.2 + rand() * 0.27), r = 1.5 + rand() * 6;
      ctx.beginPath(); ctx.arc(ox + Math.cos(a) * d, oy + Math.sin(a) * d, r, 0, 7); ctx.fill();
    }
  }
  const t = finish(c, { srgb: true });
  return t;
}

/** Soft round glow sprite. */
export function glowTexture() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return finish(c, {});
}

/** Vertical rainbow beam gradient for the prism light rays. */
export function beamTexture() {
  const W = 8, H = 256;
  const { c, ctx } = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.25, "rgba(255,255,255,0.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return finish(c, {});
}

// ---------------------------------------------------------------------------
// Jersey (per team & number)
// ---------------------------------------------------------------------------

export function jerseyTexture(team: number, number: number) {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const main = team === 0 ? "#12b5d6" : "#e23a8f";
  const dark = team === 0 ? "#0b5f86" : "#8f1652";
  const light = team === 0 ? "#a5f3fc" : "#fbcfe8";
  ctx.fillStyle = main; ctx.fillRect(0, 0, W, H);
  // side panels (u≈0 and u≈0.5 are the sides)
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W * 0.08, H); ctx.fillRect(W * 0.92, 0, W * 0.08, H); ctx.fillRect(W * 0.42, 0, W * 0.16, H);
  // chevron across the chest (front centred at u=0.75)
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(W * 0.6, H * 0.18); ctx.lineTo(W * 0.75, H * 0.36); ctx.lineTo(W * 0.9, H * 0.18); ctx.lineTo(W * 0.9, H * 0.27); ctx.lineTo(W * 0.75, H * 0.45); ctx.lineTo(W * 0.6, H * 0.27);
  ctx.closePath(); ctx.fill();
  // prism emblem on chest
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.moveTo(W * 0.75, H * 0.52); ctx.lineTo(W * 0.725, H * 0.6); ctx.lineTo(W * 0.775, H * 0.6); ctx.closePath(); ctx.fill();
  // number on the back (u=0.25)
  ctx.font = "900 92px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 8; ctx.strokeStyle = dark; ctx.strokeText(String(number), W * 0.25, H * 0.5);
  ctx.fillStyle = "#ffffff"; ctx.fillText(String(number), W * 0.25, H * 0.5);
  // hem stripes
  ctx.fillStyle = dark; ctx.fillRect(0, H * 0.9, W, H * 0.1);
  ctx.fillStyle = light; ctx.fillRect(0, H * 0.88, W, H * 0.02);
  // fabric weave noise
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 2500; i++) { ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff"; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
  ctx.globalAlpha = 1;
  return finish(c, {});
}

/** Text label for name tags. */
export function nameTagTexture(name: string, team: number, isMate: boolean) {
  const W = 512, H = 112;
  const { c, ctx } = canvas(W, H);
  ctx.font = "800 46px system-ui, sans-serif";
  const tw = Math.min(W - 40, ctx.measureText(name).width + 56);
  const x0 = (W - tw) / 2;
  ctx.fillStyle = "rgba(6,10,22,0.72)";
  ctx.beginPath(); ctx.roundRect(x0, 16, tw, 68, 34); ctx.fill();
  ctx.fillStyle = team === 0 ? "#22d3ee" : "#f0479a";
  ctx.beginPath(); ctx.roundRect(x0, 16, 14 + (isMate ? 0 : 0), 68, [34, 0, 0, 34]); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name, W / 2 + 6, 52);
  return finish(c, {});
}

export function scoreboardCanvas() { return canvas(1024, 384); }

export function collidersOfKind(kind: Collider["vis"]) { return MAP.colliders.filter((c) => c.vis === kind); }
