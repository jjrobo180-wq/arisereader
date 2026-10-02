// Hand-painted (procedural) canvas textures for Skybound Sprint tiles and props.
import * as THREE from "three";
import type { Theme } from "./themes";

function seeded(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function canvas(size: number, draw: (c: CanvasRenderingContext2D, s: number, rnd: () => number) => void, seed = 7) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c = cv.getContext("2d")!; draw(c, size, seeded(seed));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.magFilter = THREE.LinearFilter;
  return t;
}
function shade(hex: string, f: number) { const c = new THREE.Color(hex); c.multiplyScalar(f); return "#" + c.getHexString(); }
function speckle(c: CanvasRenderingContext2D, s: number, rnd: () => number, colors: string[], n: number, size = 3) {
  for (let i = 0; i < n; i++) { c.fillStyle = colors[i % colors.length]; const r = size * (0.5 + rnd()); c.beginPath(); c.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2); c.fill(); }
}
function bevel(c: CanvasRenderingContext2D, s: number, light: string, dark: string, w = 6) {
  c.fillStyle = light; c.fillRect(0, 0, s, w); c.fillRect(0, 0, w, s);
  c.fillStyle = dark; c.fillRect(0, s - w, s, w); c.fillRect(s - w, 0, w, s);
}

export type TileTextures = ReturnType<typeof makeTileTextures>;

export function makeTileTextures(th: Theme) {
  const grassTop = canvas(128, (c, s, rnd) => {
    c.fillStyle = th.top; c.fillRect(0, 0, s, s);
    speckle(c, s, rnd, [th.topDark, shade(th.top, 1.12), shade(th.top, 0.92)], 220, 3);
  }, 3);
  const dirtLip = canvas(128, (c, s, rnd) => {
    c.fillStyle = th.side; c.fillRect(0, 0, s, s);
    speckle(c, s, rnd, [th.sideDark, shade(th.side, 1.12), shade(th.side, 0.85)], 160, 4);
    for (let i = 0; i < 9; i++) { c.fillStyle = shade(th.sideDark, 0.9); c.beginPath(); c.ellipse(rnd() * s, 40 + rnd() * (s - 50), 7 + rnd() * 6, 4 + rnd() * 3, 0, 0, Math.PI * 2); c.fill(); }
    // grass lip with drips
    c.fillStyle = th.top; c.fillRect(0, 0, s, 26);
    for (let x = 0; x < s; x += 10) { const d = 6 + rnd() * 16; c.beginPath(); c.moveTo(x, 24); c.quadraticCurveTo(x + 5, 24 + d, x + 10, 24); c.fill(); }
    c.fillStyle = shade(th.top, 1.15); c.fillRect(0, 0, s, 6);
  }, 5);
  const dirt = canvas(128, (c, s, rnd) => {
    c.fillStyle = th.side; c.fillRect(0, 0, s, s);
    speckle(c, s, rnd, [th.sideDark, shade(th.side, 1.1), shade(th.side, 0.82)], 180, 4);
    for (let i = 0; i < 10; i++) { c.fillStyle = shade(th.sideDark, 0.9); c.beginPath(); c.ellipse(rnd() * s, rnd() * s, 7 + rnd() * 7, 4 + rnd() * 3, rnd(), 0, Math.PI * 2); c.fill(); }
  }, 9);
  const stone = canvas(128, (c, s, rnd) => {
    c.fillStyle = th.stone; c.fillRect(0, 0, s, s);
    speckle(c, s, rnd, [shade(th.stone, 0.9), shade(th.stone, 1.08)], 120, 4);
    bevel(c, s, shade(th.stone, 1.25), shade(th.stone, 0.68), 9);
    c.strokeStyle = shade(th.stone, 0.75); c.lineWidth = 2; c.beginPath(); c.moveTo(30, 40); c.lineTo(52, 58); c.lineTo(48, 80); c.stroke();
  }, 11);
  const brick = canvas(128, (c, s) => {
    c.fillStyle = "#7a3b1d"; c.fillRect(0, 0, s, s);
    const rows = 4, h = s / rows;
    for (let r = 0; r < rows; r++) for (let i = -1; i < 3; i++) {
      const off = r % 2 ? s / 4 : 0; const x = i * s / 2 + off;
      c.fillStyle = r % 2 ? "#d9733a" : "#e07f42"; c.fillRect(x + 3, r * h + 3, s / 2 - 6, h - 6);
      c.fillStyle = "rgba(255,255,255,.22)"; c.fillRect(x + 3, r * h + 3, s / 2 - 6, 5);
      c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(x + 3, r * h + h - 9, s / 2 - 6, 6);
    }
  });
  const gift = canvas(128, (c, s) => {
    const g = c.createLinearGradient(0, 0, s, s); g.addColorStop(0, "#ffd84a"); g.addColorStop(1, "#ff9f1c");
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    bevel(c, s, "#fff1a8", "#c96d00", 10);
    c.fillStyle = "#ffffff"; c.font = "900 84px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.shadowColor = "rgba(150,60,0,.6)"; c.shadowOffsetY = 5; c.fillText("?", s / 2, s / 2 + 6); c.shadowColor = "transparent";
    for (const [x, y] of [[16, 16], [s - 16, 16], [16, s - 16], [s - 16, s - 16]]) { c.fillStyle = "#c96d00"; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
  });
  const used = canvas(128, (c, s) => {
    c.fillStyle = "#a07850"; c.fillRect(0, 0, s, s); bevel(c, s, "#c49a6c", "#6b4a2c", 10);
    for (const [x, y] of [[16, 16], [s - 16, 16], [16, s - 16], [s - 16, s - 16]]) { c.fillStyle = "#6b4a2c"; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
  });
  const metal = canvas(128, (c, s) => {
    const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, "#9aa3b5"); g.addColorStop(1, "#5c6478");
    c.fillStyle = g; c.fillRect(0, 0, s, s); bevel(c, s, "#c9d1e0", "#3c4252", 8);
    for (const [x, y] of [[18, 18], [s - 18, 18], [18, s - 18], [s - 18, s - 18]]) { c.fillStyle = "#e5e9f2"; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = "#3c4252"; c.beginPath(); c.arc(x + 1.5, y + 1.5, 3, 0, Math.PI * 2); c.fill(); }
  });
  const crumble = canvas(128, (c, s, rnd) => {
    c.fillStyle = "#c2a27a"; c.fillRect(0, 0, s, s); speckle(c, s, rnd, ["#a8865e", "#d6b88f"], 80, 4); bevel(c, s, "#e0c49c", "#8a6a44", 7);
    c.strokeStyle = "#5e4428"; c.lineWidth = 4; c.lineJoin = "round";
    c.beginPath(); c.moveTo(20, 8); c.lineTo(46, 46); c.lineTo(34, 78); c.lineTo(58, 120); c.moveTo(46, 46); c.lineTo(92, 40); c.lineTo(118, 70); c.moveTo(92, 40); c.lineTo(84, 96); c.stroke();
  }, 13);
  const ice = canvas(128, (c, s) => {
    const g = c.createLinearGradient(0, 0, s, s); g.addColorStop(0, "#e9fbff"); g.addColorStop(1, "#8fdcf2");
    c.fillStyle = g; c.fillRect(0, 0, s, s); bevel(c, s, "#ffffff", "#5fb8d6", 7);
    c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 6; c.beginPath(); c.moveTo(24, 30); c.lineTo(52, 18); c.moveTo(30, 52); c.lineTo(80, 26); c.stroke();
  });
  const plank = canvas(128, (c, s) => {
    c.fillStyle = "#b07a45"; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#c48a52" : "#a76f3d"; c.fillRect(i * 32 + 2, 0, 28, s); c.fillStyle = "#5e3b1d"; c.beginPath(); c.arc(i * 32 + 16, s / 2, 3, 0, Math.PI * 2); c.fill(); }
  });
  return { grassTop, dirtLip, dirt, stone, brick, gift, used, metal, crumble, ice, plank };
}

export function textTexture(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string } = {}) {
  const w = opts.w || 512, h = opts.h || 256;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d")!;
  c.fillStyle = opts.bg || "#7a4a24"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
  c.fillStyle = opts.fg || "#fff7e0"; c.font = opts.font || "800 40px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  const words = text.split(" "); const lines: string[] = []; let line = "";
  for (const wd of words) { const t = line ? line + " " + wd : wd; if (c.measureText(t).width > w - 50 && line) { lines.push(line); line = wd; } else line = t; }
  if (line) lines.push(line);
  const lh = 48; lines.forEach((l, i) => c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function radialTexture(inner: string, outer: string) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
