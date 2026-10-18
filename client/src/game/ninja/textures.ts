// Reading Ninja — round token faces (picture + word), juice splats and the blade glow.
import * as THREE from "three";
import type { Thing } from "@shared/runner/missions";
import { EMOJI_FONT, canvasTex, type CardStyle } from "@/game/runner/textures";


const faces = new Map<string, THREE.CanvasTexture>();
export function tokenTexture(thing: Thing, style: CardStyle, accent: number) {
  const key = thing.label + "|" + style + "|" + accent; const hit = faces.get(key); if (hit) return hit;
  const col = new THREE.Color(accent), hue = Math.round(col.getHSL({ h: 0, s: 0, l: 0 }).h * 360), word = thing.label.toUpperCase();
  const t = canvasTex(512, 512, c => {
    const g = c.createRadialGradient(200, 170, 20, 256, 256, 256); g.addColorStop(0, "#ffffff"); g.addColorStop(0.72, "#f4f7fb"); g.addColorStop(1, `hsl(${hue} 70% 86%)`);
    c.fillStyle = g; c.beginPath(); c.arc(256, 256, 256, 0, 7); c.fill();
    c.lineWidth = 22; c.strokeStyle = `hsl(${hue} 72% 52%)`; c.beginPath(); c.arc(256, 256, 242, 0, 7); c.stroke();
    c.lineWidth = 4; c.strokeStyle = "rgba(255,255,255,.9)"; c.beginPath(); c.arc(256, 256, 226, 0, 7); c.stroke();
    c.textAlign = "center"; c.textBaseline = "middle";
    if (style !== "words") { c.font = `${style === "pictures" ? 270 : 220}px ${EMOJI_FONT}`; c.fillText(thing.emoji, 256, style === "pictures" ? 270 : 220); }
    if (style !== "pictures") {
      const size = style === "words" ? (word.length > 8 ? 70 : word.length > 5 ? 92 : 124) : (word.length > 9 ? 44 : word.length > 6 ? 54 : 66);
      if (style === "both") { c.fillStyle = "#14223f"; const w = Math.min(380, 80 + word.length * size * 0.62); c.beginPath(); c.roundRect(256 - w / 2, 340, w, 86, 43); c.fill(); }
      c.font = `900 ${size}px "Nunito","Arial Rounded MT Bold",ui-rounded,system-ui,sans-serif`; c.fillStyle = style === "both" ? "#ffffff" : "#14223f";
      c.fillText(word, 256, style === "both" ? 386 : 262, 360);
    }
    // glossy highlight
    const hl = c.createLinearGradient(0, 30, 0, 230); hl.addColorStop(0, "rgba(255,255,255,.55)"); hl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = hl; c.beginPath(); c.ellipse(256, 120, 170, 90, 0, 0, 7); c.fill();
  }, 71);
  faces.set(key, t); return t;
}

let splats: THREE.CanvasTexture[] | null = null;
export function splatTextures() {
  if (splats) return splats;
  splats = [1, 2, 3, 4].map(seed => canvasTex(256, 256, (c, rnd) => {
    c.fillStyle = "#ffffff";
    c.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2, r = 62 + rnd() * 26 + (i % 7 === 0 ? 24 : 0); c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } c.closePath(); c.fill();
    for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, d = 90 + rnd() * 30, r = 4 + rnd() * 12; c.beginPath(); c.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, 0, 7); c.fill(); }
    for (let i = 0; i < 5; i++) { const x = 70 + rnd() * 116; c.fillRect(x, 150, 6 + rnd() * 6, 40 + rnd() * 60); c.beginPath(); c.arc(x + 5, 200 + rnd() * 40, 7, 0, 7); c.fill(); }
  }, seed * 101));
  return splats;
}
