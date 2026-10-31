// Reading Runner — hand-painted (procedural) canvas textures: track, ground, trains, cards, skylines.
import * as THREE from "three";
import { hex, type Thing, type WorldLook } from "@shared/runner/missions";

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
export type CardStyle = "both" | "words" | "pictures";
/** Draws a big emoji. Safari (iPad and iPhone) draws nothing for an emoji over about 250px on a
 *  canvas, so it's drawn at 200px on its own canvas and scaled up into place. */
export function bigEmoji(c: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
  const draw = Math.min(size, 200), box = Math.ceil(draw * 1.3);
  const cv = document.createElement("canvas"); cv.width = cv.height = box;
  const e = cv.getContext("2d")!; e.font = `${draw}px ${EMOJI_FONT}`; e.textAlign = "center"; e.textBaseline = "middle"; e.fillText(emoji, box / 2, box / 2);
  const k = size / draw; c.drawImage(cv, x - (box * k) / 2, y - (box * k) / 2, box * k, box * k);
}

function seeded(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, rnd: () => number) => void, seed = 7, repeat = false) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const c = cv.getContext("2d")!; draw(c, seeded(seed));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const shade = (n: number, k: number) => { const c = new THREE.Color(n); if (k > 0) c.lerp(new THREE.Color(0xffffff), k); else c.lerp(new THREE.Color(0x000000), -k); return "#" + c.getHexString(); };
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function speckle(c: CanvasRenderingContext2D, rnd: () => number, w: number, h: number, colors: string[], n: number, size: [number, number]) {
  for (let i = 0; i < n; i++) { c.fillStyle = colors[i % colors.length]; const s = size[0] + rnd() * (size[1] - size[0]); c.fillRect(rnd() * w, rnd() * h, s, s); }
}

/** Track bed for all three lanes: ballast stones with wooden sleepers under each lane. 512px = 8.6 wide × 8 long. */
export function trackTexture(look: WorldLook) {
  return canvasTex(512, 512, (c, rnd) => {
    c.fillStyle = hex(look.ballast); c.fillRect(0, 0, 512, 512);
    speckle(c, rnd, 512, 512, [shade(look.ballast, 0.25), shade(look.ballast, -0.25), shade(look.ballast, 0.1), shade(look.ballast, -0.4)], 5200, [2, 6]);
    const laneW = 512 / 8.6 * 2.6, centers = [-2.6, 0, 2.6].map(x => 256 + x / 8.6 * 512);
    for (const cx of centers) {
      for (let k = 0; k < 4; k++) {
        const y = k * 128 + 40;
        c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(cx - laneW * 0.46, y + 6, laneW * 0.92, 30);
        c.fillStyle = look.night ? shade(look.sleeper, 0.15) : hex(look.sleeper); c.fillRect(cx - laneW * 0.46, y, laneW * 0.92, 28);
        c.fillStyle = shade(look.sleeper, 0.18); c.fillRect(cx - laneW * 0.46, y, laneW * 0.92, 5);
        c.strokeStyle = shade(look.sleeper, -0.3); c.lineWidth = 2; for (let g = 0; g < 3; g++) { c.beginPath(); c.moveTo(cx - laneW * 0.4, y + 9 + g * 6 + rnd() * 3); c.lineTo(cx + laneW * 0.4, y + 9 + g * 6 + rnd() * 3); c.stroke(); }
      }
    }
    // soft dark edges between lanes
    for (const x of [256 - laneW * 0.5, 256 + laneW * 0.5]) { const g = c.createLinearGradient(x - 14, 0, x + 14, 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,.22)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - 14, 0, 28, 512); }
  }, 11, true);
}

/** Side ground, tiles every 8 world units. */
export function groundTexture(look: WorldLook) {
  const base = look.groundTint;
  return canvasTex(256, 256, (c, rnd) => {
    c.fillStyle = hex(base); c.fillRect(0, 0, 256, 256);
    switch (look.ground) {
      case "grass": case "dirt":
        speckle(c, rnd, 256, 256, [shade(base, 0.18), shade(base, -0.15), shade(base, 0.3), shade(base, -0.28)], 2600, [1, 4]);
        for (let i = 0; i < 30; i++) { c.fillStyle = ["#fff6a0", "#ffffff", "#ff9fd0", "#9fd8ff"][i % 4]; c.beginPath(); c.arc(rnd() * 256, rnd() * 256, 2 + rnd() * 1.6, 0, 7); c.fill(); }
        break;
      case "sand": case "seabed":
        speckle(c, rnd, 256, 256, [shade(base, 0.15), shade(base, -0.12), shade(base, 0.25)], 2400, [1, 3]);
        c.strokeStyle = shade(base, -0.12); c.lineWidth = 3; for (let y = 10; y < 256; y += 32) { c.beginPath(); for (let x = 0; x <= 256; x += 8) c.lineTo(x, y + Math.sin(x / 20 + y) * 5); c.stroke(); }
        if (look.ground === "seabed") for (let i = 0; i < 40; i++) { c.fillStyle = ["#d98a6a", "#f2f2f2", "#8ac6d0"][i % 3]; c.beginPath(); c.ellipse(rnd() * 256, rnd() * 256, 3 + rnd() * 4, 2 + rnd() * 3, rnd() * 3, 0, 7); c.fill(); }
        break;
      case "snow":
        speckle(c, rnd, 256, 256, ["#e6f2fb", "#ffffff", "#d6e8f6"], 1600, [2, 6]);
        break;
      case "rock": case "lava":
        speckle(c, rnd, 256, 256, [shade(base, 0.15), shade(base, -0.2), shade(base, 0.3)], 2200, [2, 5]);
        c.strokeStyle = look.ground === "lava" ? "#ff7a1a" : shade(base, -0.35); c.lineWidth = look.ground === "lava" ? 3 : 2;
        for (let i = 0; i < 9; i++) { c.beginPath(); let x = rnd() * 256, y = rnd() * 256; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; c.lineTo(x, y); } c.stroke(); }
        break;
      case "candy":
        for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? shade(base, 0.25) : hex(base); c.fillRect(0, i * 32, 256, 32); }
        for (let i = 0; i < 160; i++) { c.save(); c.translate(rnd() * 256, rnd() * 256); c.rotate(rnd() * 3); c.fillStyle = ["#ffffff", "#7fe0ff", "#fff27a", "#b98aff", "#7dff9b"][i % 5]; roundRect(c, -5, -1.6, 10, 3.2, 1.6); c.fill(); c.restore(); }
        break;
      case "metal": case "neon":
        c.strokeStyle = look.ground === "neon" ? hex(look.rail) : shade(base, 0.25); c.globalAlpha = look.ground === "neon" ? 0.55 : 1; c.lineWidth = 3;
        for (let k = 0; k <= 256; k += 64) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 256); c.stroke(); c.beginPath(); c.moveTo(0, k); c.lineTo(256, k); c.stroke(); }
        c.globalAlpha = 1;
        if (look.ground === "metal") { c.fillStyle = shade(base, 0.35); for (let x = 8; x < 256; x += 64) for (let y = 8; y < 256; y += 64) for (const [a, b] of [[0, 0], [48, 0], [0, 48], [48, 48]]) { c.beginPath(); c.arc(x + a, y + b, 2.5, 0, 7); c.fill(); } }
        break;
      case "tile":
        speckle(c, rnd, 256, 256, [shade(base, 0.08), shade(base, -0.08)], 1400, [1, 3]);
        c.strokeStyle = shade(base, -0.22); c.lineWidth = 3; for (let k = 0; k <= 256; k += 64) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 256); c.stroke(); c.beginPath(); c.moveTo(0, k); c.lineTo(256, k); c.stroke(); }
        break;
    }
  }, 23, true);
}

/** One train car side (11 long × 3 high): windows, a bold stripe, a door and a little logo. */
export function trainSideTexture(look: WorldLook) {
  const [body, stripe] = look.train;
  return canvasTex(1024, 288, (c, rnd) => {
    const g = c.createLinearGradient(0, 0, 0, 288); g.addColorStop(0, shade(body, 0.22)); g.addColorStop(0.55, hex(body)); g.addColorStop(1, shade(body, -0.25));
    c.fillStyle = g; c.fillRect(0, 0, 1024, 288);
    c.fillStyle = hex(stripe); c.fillRect(0, 186, 1024, 26); c.fillStyle = shade(stripe, -0.2); c.fillRect(0, 212, 1024, 6);
    const glass = look.night ? "#7ff3ff" : "#1d2b4a";
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 160; if (i === 3) continue;
      roundRect(c, x, 46, 120, 96, 18); c.fillStyle = "#e9eef5"; c.fill();
      roundRect(c, x + 6, 52, 108, 84, 14); const wg = c.createLinearGradient(x, 52, x + 108, 136); wg.addColorStop(0, glass); wg.addColorStop(1, look.night ? "#2a6aff" : "#3d5a8a"); c.fillStyle = wg; c.fill();
      c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.moveTo(x + 18, 58); c.lineTo(x + 52, 58); c.lineTo(x + 26, 128); c.lineTo(x + 12, 128); c.closePath(); c.fill();
    }
    // door
    roundRect(c, 520, 34, 112, 214, 12); c.fillStyle = shade(body, -0.12); c.fill(); c.strokeStyle = shade(body, -0.35); c.lineWidth = 5; c.stroke();
    for (const x of [532, 580]) { roundRect(c, x, 52, 40, 100, 8); c.fillStyle = glass; c.fill(); }
    c.fillStyle = "#ffe36a"; c.fillRect(522, 34, 108, 6);
    // logo
    c.fillStyle = "rgba(255,255,255,.9)"; c.font = "900 30px system-ui, sans-serif"; c.fillText("A.R.I.S.E. EXPRESS", 46, 252);
    // grime & rivets
    c.fillStyle = "rgba(0,0,0,.08)"; for (let i = 0; i < 60; i++) c.fillRect(rnd() * 1024, 240 + rnd() * 48, 10 + rnd() * 30, 2);
    c.fillStyle = shade(body, -0.3); for (let x = 12; x < 1024; x += 48) { c.beginPath(); c.arc(x, 20, 3, 0, 7); c.fill(); c.beginPath(); c.arc(x, 274, 3, 0, 7); c.fill(); }
  }, 31);
}
export function trainFrontTexture(look: WorldLook) {
  const [body, stripe] = look.train;
  return canvasTex(256, 288, c => {
    const g = c.createLinearGradient(0, 0, 0, 288); g.addColorStop(0, shade(body, 0.2)); g.addColorStop(1, shade(body, -0.25)); c.fillStyle = g; c.fillRect(0, 0, 256, 288);
    roundRect(c, 22, 34, 212, 108, 22); c.fillStyle = "#e9eef5"; c.fill();
    roundRect(c, 30, 42, 196, 92, 18); const wg = c.createLinearGradient(0, 42, 0, 134); wg.addColorStop(0, look.night ? "#7ff3ff" : "#2b3f66"); wg.addColorStop(1, "#0f1830"); c.fillStyle = wg; c.fill();
    c.fillStyle = "rgba(255,255,255,.3)"; c.beginPath(); c.moveTo(48, 50); c.lineTo(100, 50); c.lineTo(66, 126); c.lineTo(44, 126); c.closePath(); c.fill();
    c.fillStyle = hex(stripe); c.fillRect(0, 186, 256, 26);
    roundRect(c, 88, 154, 80, 26, 8); c.fillStyle = "#101828"; c.fill(); c.fillStyle = "#ffd84d"; c.font = "900 20px system-ui"; c.textAlign = "center"; c.fillText("RUN 1", 128, 174);
    c.fillStyle = "#22252e"; c.fillRect(0, 252, 256, 36);
  }, 37);
}

export function stripeTexture(a: number, b: number, n = 6) {
  return canvasTex(256, 64, c => {
    c.fillStyle = hex(a); c.fillRect(0, 0, 256, 64); c.fillStyle = hex(b);
    for (let i = -2; i < n + 2; i++) { c.beginPath(); const x = i * (256 / n); c.moveTo(x, 64); c.lineTo(x + 256 / n / 2, 64); c.lineTo(x + 256 / n, 0); c.lineTo(x + 256 / n / 2, 0); c.closePath(); c.fill(); }
    c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(0, 0, 256, 6); c.fillStyle = "rgba(0,0,0,.2)"; c.fillRect(0, 58, 256, 6);
  }, 41);
}
export function rampTexture() {
  return canvasTex(256, 512, c => {
    c.fillStyle = "#3a3f4a"; c.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 512; y += 24) { c.fillStyle = "#4a505d"; c.fillRect(10, y, 236, 10); }
    for (let i = -4; i < 12; i++) { c.fillStyle = i % 2 ? "#ffd23f" : "#1a1a1a"; c.beginPath(); c.moveTo(0, i * 44); c.lineTo(22, i * 44 - 22); c.lineTo(22, i * 44 + 22); c.lineTo(0, i * 44 + 44); c.closePath(); c.fill(); c.beginPath(); c.moveTo(256, i * 44); c.lineTo(234, i * 44 - 22); c.lineTo(234, i * 44 + 22); c.lineTo(256, i * 44 + 44); c.closePath(); c.fill(); }
    c.fillStyle = "#ffd23f"; c.beginPath(); for (let k = 0; k < 3; k++) { const y = 360 - k * 120; c.moveTo(128, y - 40); c.lineTo(178, y + 10); c.lineTo(78, y + 10); c.closePath(); } c.fill();
  }, 43);
}
export function coinFaceTexture() {
  return canvasTex(128, 128, c => {
    const g = c.createRadialGradient(52, 46, 6, 64, 64, 64); g.addColorStop(0, "#fff7c2"); g.addColorStop(0.55, "#ffcf3a"); g.addColorStop(1, "#e08a00");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = "#b86a00"; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.stroke();
    c.fillStyle = "#fff3a6"; c.strokeStyle = "#c27800"; c.lineWidth = 4; c.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 15 : 34, a = i / 10 * Math.PI * 2 - Math.PI / 2; c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    c.closePath(); c.fill(); c.stroke();
  }, 47);
}

/** A big friendly picture/word card. */
const cardCache = new Map<string, THREE.CanvasTexture>();
export function cardTexture(thing: Thing, style: CardStyle) {
  const key = thing.label + "|" + thing.emoji + "|" + style;
  const hit = cardCache.get(key); if (hit) return hit;
  const word = thing.label.toUpperCase();
  const t = canvasTex(400, 480, c => {
    c.shadowColor = "rgba(0,0,0,.25)"; c.shadowBlur = 16; c.shadowOffsetY = 6;
    roundRect(c, 14, 10, 372, 452, 44); c.fillStyle = "#ffffff"; c.fill(); c.shadowColor = "transparent";
    roundRect(c, 14, 10, 372, 452, 44); c.lineWidth = 10; c.strokeStyle = "#1b2a4a"; c.stroke();
    roundRect(c, 30, 26, 340, 420, 32); c.lineWidth = 3; c.strokeStyle = "#dfe7f3"; c.stroke();
    c.textAlign = "center"; c.textBaseline = "middle";
    if (style !== "words") { c.font = `${style === "pictures" ? 250 : 200}px ${EMOJI_FONT}`; c.fillText(thing.emoji, 200, style === "pictures" ? 236 : 186); }
    if (style !== "pictures") {
      const size = style === "words" ? (word.length > 8 ? 74 : word.length > 5 ? 96 : 128) : (word.length > 8 ? 48 : word.length > 5 ? 62 : 74);
      const y = style === "words" ? 236 : 382;
      if (style === "both") { roundRect(c, 44, 330, 312, 104, 24); c.fillStyle = "#1b2a4a"; c.fill(); }
      c.font = `900 ${size}px "Nunito","Arial Rounded MT Bold",ui-rounded,system-ui,sans-serif`; c.fillStyle = style === "both" ? "#ffffff" : "#1b2a4a";
      c.fillText(word, 200, y + 4, 300);
    }
  }, 51);
  cardCache.set(key, t);
  return t;
}

export function glowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  return canvasTex(128, 128, c => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, ".45)")); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }, 53);
}
export function laneGlowTexture() {
  return canvasTex(64, 256, c => {
    const g = c.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 256);
    const s = c.createLinearGradient(0, 0, 64, 0); s.addColorStop(0, "rgba(0,0,0,1)"); s.addColorStop(0.2, "rgba(0,0,0,0)"); s.addColorStop(0.8, "rgba(0,0,0,0)"); s.addColorStop(1, "rgba(0,0,0,1)");
    c.globalCompositeOperation = "destination-out"; c.fillStyle = s; c.fillRect(0, 0, 64, 256);
  }, 57);
}
export function bannerTexture(text: string, bg = "#1b2a4a", fg = "#ffffff") {
  return canvasTex(1024, 192, c => {
    for (let x = 0; x < 1024; x += 48) for (let y = 0; y < 192; y += 48) { c.fillStyle = ((x + y) / 48) % 2 ? "#ffffff" : "#111111"; c.fillRect(x, y, 48, 48); }
    roundRect(c, 120, 24, 784, 144, 30); c.fillStyle = bg; c.fill();
    c.fillStyle = fg; c.font = "900 104px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 512, 100);
  }, 59);
}

/** Far-away silhouettes wrapped around the world (transparent above the line). */
export function skylineTexture(look: WorldLook) {
  const col = hex(look.skylineColor), light = shade(look.skylineColor, 0.18), dark = shade(look.skylineColor, -0.15);
  return canvasTex(2048, 256, (c, rnd) => {
    const H = 256;
    const layer = (fill: string, base: number, fn: (x: number) => number) => { c.fillStyle = fill; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= 2048; x += 8) c.lineTo(x, H - base - fn(x)); c.lineTo(2048, H); c.closePath(); c.fill(); };
    const wave = (x: number, a: number, f: number, p: number) => Math.sin((x / 2048) * Math.PI * 2 * f + p) * a;
    switch (look.skyline) {
      case "city": case "arcade": {
        for (const [fill, hMax, w] of [[light, 150, 70], [col, 190, 90], [dark, 120, 60]] as const) {
          c.fillStyle = fill; for (let x = 0; x < 2048;) { const bw = w * (0.5 + rnd()), bh = 30 + rnd() * hMax; c.fillRect(x, H - bh, bw, bh); if (rnd() < 0.3) c.fillRect(x + bw * 0.4, H - bh - 24, 4, 24); x += bw + rnd() * 12; }
        }
        if (look.night) { for (let i = 0; i < 500; i++) { c.fillStyle = ["#ffe68a", "#7ff3ff", "#ff9ae0"][i % 3]; c.globalAlpha = 0.5 + rnd() * 0.5; c.fillRect(rnd() * 2048, H - rnd() * 170, 3, 4); } c.globalAlpha = 1; }
        break;
      }
      case "hills": layer(light, 40, x => 40 + wave(x, 30, 3, 1) + wave(x, 12, 9, 2)); layer(col, 10, x => 30 + wave(x, 22, 5, 3)); break;
      case "sea": c.fillStyle = col; c.fillRect(0, H - 40, 2048, 40); c.fillStyle = light; for (let i = 0; i < 40; i++) c.fillRect(rnd() * 2048, H - 40 + rnd() * 30, 30 + rnd() * 60, 3); layer(dark, 40, x => Math.max(0, wave(x, 60, 2, 0.5) - 20)); break;
      case "mountains": layer(light, 30, x => 120 + wave(x, 50, 4, 0.3) + Math.abs(wave(x, 60, 11, 1))); layer(col, 10, x => 60 + Math.abs(wave(x, 70, 7, 2))); c.fillStyle = "rgba(255,255,255,.85)"; break;
      case "jungle": for (let i = 0; i < 160; i++) { c.fillStyle = [col, light, dark][i % 3]; c.beginPath(); c.arc(rnd() * 2048, H - 30 - rnd() * 70, 26 + rnd() * 40, 0, 7); c.fill(); } c.fillStyle = dark; c.fillRect(0, H - 40, 2048, 40); break;
      case "space": for (let i = 0; i < 26; i++) { const x = rnd() * 2048, w = 30 + rnd() * 70, h = 30 + rnd() * 130; c.fillStyle = i % 2 ? col : light; c.fillRect(x, H - h, w, h); c.fillStyle = "#9be7ff"; c.fillRect(x + w / 2 - 2, H - h - 30, 4, 30); c.beginPath(); c.arc(x + w / 2, H - h - 32, 6, 0, 7); c.fill(); } break;
      case "dunes": layer(light, 20, x => 50 + wave(x, 30, 3, 0.2) + wave(x, 14, 7, 1.3)); layer(col, 0, x => 30 + wave(x, 22, 4, 2.1)); for (let i = 0; i < 3; i++) { const x = 300 + i * 700; c.fillStyle = dark; c.beginPath(); c.moveTo(x, H - 30); c.lineTo(x + 70, H - 140); c.lineTo(x + 140, H - 30); c.fill(); } break;
      case "castle": layer(light, 20, x => 40 + wave(x, 30, 3, 0.4)); for (let i = 0; i < 5; i++) { const x = 140 + i * 420 + rnd() * 80; c.fillStyle = col; c.fillRect(x, H - 140, 160, 140); for (let k = 0; k < 8; k++) c.fillRect(x + k * 20, H - 152, 12, 12); for (const tx of [x - 20, x + 150]) { c.fillRect(tx, H - 190, 34, 190); c.beginPath(); c.moveTo(tx - 6, H - 190); c.lineTo(tx + 17, H - 236); c.lineTo(tx + 40, H - 190); c.fill(); } } break;
      case "reef": for (let i = 0; i < 90; i++) { c.fillStyle = [col, light, dark][i % 3]; const x = rnd() * 2048, h = 40 + rnd() * 120; c.fillRect(x, H - h, 10 + rnd() * 14, h); c.beginPath(); c.arc(x + 10, H - h, 18 + rnd() * 16, 0, 7); c.fill(); } break;
      case "volcano": layer(col, 0, x => 40 + wave(x, 20, 5, 0.6)); for (let i = 0; i < 3; i++) { const x = 200 + i * 700; c.fillStyle = dark; c.beginPath(); c.moveTo(x, H); c.lineTo(x + 180, H - 200); c.lineTo(x + 240, H - 200); c.lineTo(x + 420, H); c.fill(); c.fillStyle = "#ff7a1a"; c.fillRect(x + 186, H - 204, 48, 8); } break;
      case "candy": for (let i = 0; i < 40; i++) { const x = rnd() * 2048, h = 60 + rnd() * 120; c.fillStyle = "#ffffff"; c.fillRect(x, H - h, 8, h); c.fillStyle = ["#ff7ab8", "#b98aff", "#7fe0ff", "#ffe27a"][i % 4]; c.beginPath(); c.arc(x + 4, H - h, 26 + rnd() * 18, 0, 7); c.fill(); } layer(light, 0, x => 26 + wave(x, 12, 6, 1)); break;
    }
  }, 61);
}
