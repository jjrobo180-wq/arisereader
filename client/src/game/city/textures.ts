import * as THREE from "three";
import { rng } from "@shared/city/layout";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function toTexture(c: HTMLCanvasElement, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

/**
 * Tower facades: a 4×4 grid of window cells (one cell = 5 units wide, 4 tall).
 * Returns the colour map and an emissive map where only lit windows glow.
 */
export function windowTextures(seed = 7) {
  const r = rng(seed);
  const [c, g] = canvas(256, 256);
  const [e, ge] = canvas(256, 256);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 256);
  ge.fillStyle = "#000000"; ge.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * 64 + 10, y = j * 64 + 12, w = 44, h = 36;
    const lit = r() < 0.38;
    g.fillStyle = lit ? "#ffe2a8" : "#2a3550"; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x, y, w, 5);
    if (lit) { ge.fillStyle = r() < 0.3 ? "#9fd8ff" : "#ffcf7a"; ge.fillRect(x, y, w, h); }
  }
  return { map: toTexture(c), emissive: toTexture(e) };
}

/** A big neon-style sign. */
export function signTexture(lines: { text: string; size: number; color: string }[], opts: { w?: number; h?: number; bg?: string; border?: string } = {}) {
  const w = opts.w ?? 1024, h = opts.h ?? 256;
  const [c, g] = canvas(w, h);
  g.fillStyle = opts.bg ?? "#120a24"; g.fillRect(0, 0, w, h);
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); }
  const total = lines.reduce((n, l) => n + l.size * 1.15, 0);
  let y = (h - total) / 2;
  for (const l of lines) {
    g.font = `900 ${l.size}px "Teko", "Barlow", system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "top";
    g.shadowColor = l.color; g.shadowBlur = l.size * 0.35;
    g.fillStyle = l.color; g.fillText(l.text, w / 2, y);
    g.shadowBlur = 0; g.fillStyle = "rgba(255,255,255,.85)"; g.fillText(l.text, w / 2, y);
    g.fillStyle = l.color; g.globalAlpha = 0.55; g.fillText(l.text, w / 2, y); g.globalAlpha = 1;
    y += l.size * 1.15;
  }
  return toTexture(c, false);
}

/** Checkered start line. */
export function checkerTexture() {
  const [c, g] = canvas(64, 64);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? "#111" : "#f5f5f5"; g.fillRect(i * 8, j * 8, 8, 8); }
  const t = toTexture(c); t.magFilter = THREE.NearestFilter;
  return t;
}

/** Soft sky gradient for the background. */
export function skyTexture() {
  const [c, g] = canvas(16, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#0b1033");
  grad.addColorStop(0.42, "#33307a");
  grad.addColorStop(0.62, "#a4527e");
  grad.addColorStop(0.75, "#ff9a6b");
  grad.addColorStop(0.8, "#ffc98a");
  grad.addColorStop(1, "#2a2236");
  g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  const t = toTexture(c, false);
  return t;
}

/** Three glowing glass doors under a warm lobby light. */
export function doorTexture() {
  const [c, g] = canvas(512, 300);
  g.fillStyle = "#2a0b14"; g.fillRect(0, 0, 512, 300);
  for (let i = 0; i < 3; i++) {
    const x = 24 + i * 160;
    const grad = g.createLinearGradient(0, 30, 0, 300);
    grad.addColorStop(0, "#ffe7b0"); grad.addColorStop(1, "#ff9f4a");
    g.fillStyle = grad; g.fillRect(x, 30, 144, 270);
    g.fillStyle = "rgba(42,11,20,.85)"; g.fillRect(x + 70, 30, 4, 270);
    g.fillStyle = "#d9a84a"; g.fillRect(x + 56, 150, 10, 40); g.fillRect(x + 78, 150, 10, 40);
  }
  return toTexture(c, false);
}

/** A colourful movie poster (made-up films for the cinema wall). */
export function posterTexture(title: string, a: string, b: string) {
  const [c, g] = canvas(300, 440);
  const grad = g.createLinearGradient(0, 0, 300, 440);
  grad.addColorStop(0, a); grad.addColorStop(1, b);
  g.fillStyle = grad; g.fillRect(0, 0, 300, 440);
  g.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 40; i++) g.fillRect((i * 73) % 300, (i * 131) % 300, 2, 2);
  g.beginPath(); g.arc(150, 180, 70, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,.25)"; g.fill();
  g.fillStyle = "#fff"; g.font = '900 44px "Teko", "Barlow", system-ui, sans-serif'; g.textAlign = "center";
  g.fillText(title, 150, 340);
  g.font = '700 22px "Barlow", system-ui, sans-serif'; g.fillText("NOW SHOWING", 150, 380);
  g.strokeStyle = "#ffd36b"; g.lineWidth = 10; g.strokeRect(5, 5, 290, 430);
  return toTexture(c, false);
}
