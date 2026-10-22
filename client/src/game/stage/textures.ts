// Shared canvas textures for the stage games: picture/word cards, card backs, wooden blocks, wood and felt.
import * as THREE from "three";
import { EMOJI_FONT, canvasTex } from "@/game/runner/textures";

const cache = new Map<string, THREE.CanvasTexture>();
const memo = (k: string, f: () => THREE.CanvasTexture) => { let t = cache.get(k); if (!t) { t = f(); cache.set(k, t); } return t; };
const FONT = '"Nunito","Arial Rounded MT Bold",ui-rounded,system-ui,sans-serif';
const css = (n: number) => "#" + n.toString(16).padStart(6, "0");
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const fitFont = (c: CanvasRenderingContext2D, text: string, max: number, size: number) => { let s = size; c.font = `900 ${s}px ${FONT}`; while (c.measureText(text).width > max && s > 20) { s -= 4; c.font = `900 ${s}px ${FONT}`; } return s; };

/** Face of a memory card: a word or a picture. 320×420 (3:4 + a bit). */
export function cardFace(kind: "word" | "picture", word: string, emoji: string, accent: number) {
  return memo(`face|${kind}|${word}|${emoji}|${accent}`, () => canvasTex(320, 420, c => {
    rr(c, 0, 0, 320, 420, 34); c.fillStyle = "#ffffff"; c.fill();
    rr(c, 12, 12, 296, 396, 26); c.lineWidth = 6; c.strokeStyle = css(accent); c.stroke();
    c.textAlign = "center"; c.textBaseline = "middle";
    if (kind === "picture") { const g = c.createRadialGradient(160, 190, 10, 160, 210, 170); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#eef4fb"); rr(c, 24, 24, 272, 372, 22); c.fillStyle = g; c.fill(); c.font = `200px ${EMOJI_FONT}`; c.fillText(emoji, 160, 222); }
    else { c.fillStyle = css(accent); rr(c, 24, 24, 272, 70, 20); c.fill(); c.fillStyle = "#fff"; c.font = `900 30px ${FONT}`; c.fillText("WORD", 160, 60); c.fillStyle = "#14223f"; fitFont(c, word.toUpperCase(), 260, 96); c.fillText(word.toUpperCase(), 160, 250); }
  }, 81));
}
export function cardBack(accent: number) {
  return memo(`back|${accent}`, () => canvasTex(320, 420, c => {
    const g = c.createLinearGradient(0, 0, 320, 420); g.addColorStop(0, css(accent)); g.addColorStop(1, "#1e1b4b");
    rr(c, 0, 0, 320, 420, 34); c.fillStyle = g; c.fill();
    c.globalAlpha = 0.18; c.fillStyle = "#fff"; for (let y = 30; y < 420; y += 46) for (let x = (y / 46) % 2 ? 30 : 53; x < 320; x += 46) { c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill(); } c.globalAlpha = 1;
    rr(c, 14, 14, 292, 392, 26); c.lineWidth = 6; c.strokeStyle = "rgba(255,255,255,.8)"; c.stroke();
    c.fillStyle = "#ffe14a"; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 34 : 78, a = i / 10 * Math.PI * 2 - Math.PI / 2; c.lineTo(160 + Math.cos(a) * r, 210 + Math.sin(a) * r); } c.closePath(); c.fill();
    c.fillStyle = "#fff"; c.font = `900 66px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("?", 160, 214);
  }, 83));
}
/** A chunky word block (wooden toy block look). */
export function blockFace(word: string, color: number) {
  return memo(`block|${word}|${color}`, () => canvasTex(512, 256, c => {
    const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, css(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25).getHex())); g.addColorStop(1, css(color));
    rr(c, 0, 0, 512, 256, 40); c.fillStyle = g; c.fill(); rr(c, 14, 14, 484, 228, 30); c.lineWidth = 6; c.strokeStyle = "rgba(255,255,255,.75)"; c.stroke();
    c.fillStyle = "#ffffff"; c.textAlign = "center"; c.textBaseline = "middle"; c.shadowColor = "rgba(0,0,0,.25)"; c.shadowOffsetY = 5; c.shadowBlur = 6;
    fitFont(c, word, 450, 150); c.fillText(word, 256, 136);
  }, 87));
}
export function wordSprite(word: string) {
  return memo(`ws|${word}`, () => canvasTex(512, 256, c => {
    c.textAlign = "center"; c.textBaseline = "middle"; fitFont(c, word.toUpperCase(), 470, 150);
    c.lineWidth = 18; c.strokeStyle = "rgba(255,255,255,.95)"; c.strokeText(word.toUpperCase(), 256, 130); c.fillStyle = "#14223f"; c.fillText(word.toUpperCase(), 256, 130);
  }, 89));
}
export function signFace(top: string, big: string, accent: number) {
  return memo(`sign|${top}|${big}|${accent}`, () => canvasTex(768, 384, c => {
    rr(c, 0, 0, 768, 384, 48); c.fillStyle = "#ffffff"; c.fill(); rr(c, 14, 14, 740, 356, 38); c.lineWidth = 10; c.strokeStyle = css(accent); c.stroke();
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = css(accent); fitFont(c, top, 690, 46); c.fillText(top, 384, 70);
    c.font = `170px ${EMOJI_FONT}`; c.fillStyle = "#14223f";
    if (/\p{Extended_Pictographic}/u.test(big)) c.fillText(big, 384, 232); else { fitFont(c, big, 680, 170); c.fillText(big, 384, 236); }
  }, 91));
}
export function woodTexture() {
  return memo("wood", () => { const t = canvasTex(512, 512, (c, r) => {
    c.fillStyle = "#b07a4a"; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) { c.strokeStyle = `rgba(${90 + r() * 40},${50 + r() * 30},${20 + r() * 20},${0.15 + r() * 0.2})`; c.lineWidth = 1 + r() * 4; c.beginPath(); const y = r() * 512; c.moveTo(0, y); for (let x = 0; x <= 512; x += 32) c.lineTo(x, y + Math.sin(x / 60 + i) * 6 + (r() - 0.5) * 3); c.stroke(); }
    for (let k = 0; k < 4; k++) { c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = 3; c.beginPath(); c.moveTo(0, k * 128); c.lineTo(512, k * 128); c.stroke(); }
  }, 93, true); t.repeat.set(3, 3); return t; });
}
export function feltTexture(color: number) {
  return memo(`felt|${color}`, () => canvasTex(256, 256, (c, r) => {
    c.fillStyle = css(color); c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.05})`; c.fillRect(r() * 256, r() * 256, 2, 2); c.fillStyle = `rgba(0,0,0,${r() * 0.06})`; c.fillRect(r() * 256, r() * 256, 2, 2); }
  }, 95, true));
}
/** A round green badge with a white tick. */
export function checkBadge() {
  return memo("check", () => canvasTex(128, 128, c => {
    c.fillStyle = "#16a34a"; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.fillStyle = "#22c55e"; c.beginPath(); c.arc(64, 60, 52, 0, 7); c.fill();
    c.strokeStyle = "#fff"; c.lineWidth = 16; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); c.moveTo(36, 66); c.lineTo(56, 86); c.lineTo(94, 44); c.stroke();
  }, 97));
}
/** A picture board: a short caption over a big emoji scene. */
export function pictureFace(caption: string, emoji: string, accent: number) {
  return memo(`pic|${caption}|${emoji}|${accent}`, () => canvasTex(768, 420, c => {
    rr(c, 0, 0, 768, 420, 48); c.fillStyle = "#ffffff"; c.fill(); rr(c, 14, 14, 740, 392, 38); c.lineWidth = 10; c.strokeStyle = css(accent); c.stroke();
    rr(c, 34, 30, 700, 80, 26); c.fillStyle = css(accent); c.fill();
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; fitFont(c, caption, 660, 52); c.fillText(caption, 384, 72);
    let sz = 230; c.font = `${sz}px ${EMOJI_FONT}`; while (c.measureText(emoji).width > 680 && sz > 80) { sz -= 10; c.font = `${sz}px ${EMOJI_FONT}`; }
    c.fillText(emoji, 384, 262);
  }, 99));
}
