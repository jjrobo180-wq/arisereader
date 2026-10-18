// Farm World — the farm itself: rolling hills, painted barns, silo, windmill, stable, coop, fences, pond,
// orchards, crops, a tractor and lots of little props. Static parts are merged so the farm draws fast.
import * as THREE from "three";
import { gradientSky } from "@/game/stage/stage";
import { makeWater, MAX_RIPPLES, type Ripple } from "@/game/splash/water";
import { bakeStatic, mesh, roundedBox, std } from "@/game/runner/models";
import { canvasTex } from "@/game/runner/textures";

import { OBSTACLES, POND, groundY, inBox, inPond } from "@shared/farm/layout";
export { FIELD, OBSTACLES, POND, groundY, inBox, inPond, type Box } from "@shared/farm/layout";

const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
const vnoise = (x: number, z: number) => Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.09 + Math.sin(x * 0.05) * 1.6);

function grassTexture() { const t = canvasTex(512, 512, (c, r) => {
  c.fillStyle = "#6b9e48"; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const g = 120 + r() * 70; c.fillStyle = `rgba(${60 + r() * 50},${g},${40 + r() * 30},${0.25 + r() * 0.35})`; const x = r() * 512, y = r() * 512; c.fillRect(x, y, 1.5, 3 + r() * 4); }
  for (let i = 0; i < 40; i++) { const x = r() * 512, y = r() * 512, rad = 30 + r() * 60; const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, r() < 0.5 ? "rgba(140,200,90,.25)" : "rgba(60,110,40,.22)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
}, 41, true); t.repeat.set(36, 30); t.anisotropy = 4; return t; }
function dirtTexture() { const t = canvasTex(256, 256, (c, r) => {
  c.fillStyle = "#c19a6b"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(${110 + r() * 60},${80 + r() * 40},${50 + r() * 30},${0.3 + r() * 0.4})`; c.fillRect(r() * 256, r() * 256, 2, 2); }
  for (let i = 0; i < 60; i++) { c.fillStyle = "rgba(240,225,200,.35)"; c.beginPath(); c.arc(r() * 256, r() * 256, 1 + r() * 2, 0, 7); c.fill(); }
}, 43, true); t.repeat.set(1, 12); return t; }
function plankTexture(color: string, trim = "#f8fafc") { return canvasTex(256, 256, (c, r) => {
  c.fillStyle = color; c.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 22) { c.fillStyle = "rgba(0,0,0,.16)"; c.fillRect(x, 0, 2, 256); for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; c.fillRect(x + 3 + r() * 16, r() * 256, 1, 20 + r() * 60); } }
  void trim;
}, 47, true); }
function roofTexture(color: string) { return canvasTex(256, 256, c => {
  c.fillStyle = color; c.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) { const g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, "rgba(255,255,255,.12)"); g.addColorStop(0.5, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.2)"); c.fillStyle = g; c.fillRect(x, 0, 16, 256); }
}, 49, true); }
function baleTexture() { return canvasTex(256, 256, (c, r) => {
  c.fillStyle = "#d8b45a"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) { c.strokeStyle = `rgba(${150 + r() * 80},${110 + r() * 60},${30 + r() * 40},.55)`; c.lineWidth = 1; c.beginPath(); const x = r() * 256, y = r() * 256; c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 18, y + (r() - 0.5) * 6); c.stroke(); }
}, 53, true); }

/** A gambrel-roof barn (the classic red farm barn), door facing +z. */
function makeBarn(w: number, d: number, h: number, wall: number, roof: number, trim = 0xf8fafc) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: wall, map: plankTexture("#ffffff"), roughness: 0.85 }), roofMat = new THREE.MeshStandardMaterial({ color: roof, map: roofTexture("#ffffff"), roughness: 0.6, metalness: 0.15 });
  const trimM = std(trim, 0.6), dark = std(0x3b2418, 0.8);
  // walls: a gambrel outline extruded along z
  const prof = new THREE.Shape(); const hw = w / 2, eave = h, knee = h + h * 0.42, ridge = h + h * 0.72;
  prof.moveTo(-hw, 0); prof.lineTo(hw, 0); prof.lineTo(hw, eave); prof.lineTo(hw * 0.62, knee); prof.lineTo(0, ridge); prof.lineTo(-hw * 0.62, knee); prof.lineTo(-hw, eave); prof.closePath();
  const body = new THREE.ExtrudeGeometry(prof, { depth: d, bevelEnabled: false }); body.translate(0, 0, -d / 2);
  mesh(body, wallMat, g).receiveShadow = true;
  // roof panels (two slopes each side), overhanging
  const panel = (x1: number, y1: number, x2: number, y2: number) => { const len = Math.hypot(x2 - x1, y2 - y1); const p = mesh(new THREE.BoxGeometry(len + 0.25, 0.16, d + 0.7), roofMat, g, [(x1 + x2) / 2, (y1 + y2) / 2 + 0.08, 0]); p.rotation.z = Math.atan2(y2 - y1, x2 - x1); };
  panel(-hw - 0.15, eave - 0.1, -hw * 0.62, knee); panel(-hw * 0.62, knee, 0.02, ridge); panel(0, ridge, hw * 0.62, knee); panel(hw * 0.62, knee, hw + 0.15, eave - 0.1);
  // front: big doors with white X braces, hayloft door, trims
  const fz = d / 2 + 0.02;
  for (const s of [-1, 1]) {
    const door = new THREE.Group(); door.position.set(s * w * 0.13, 0, fz); g.add(door);
    mesh(new THREE.BoxGeometry(w * 0.26, h * 0.78, 0.08), new THREE.MeshStandardMaterial({ color: wall, map: plankTexture("#ffffff"), roughness: 0.85 }), door, [0, h * 0.39, 0]);
    for (const [x, y, ww, hh] of [[0, h * 0.78, w * 0.27, 0.16], [0, 0.08, w * 0.27, 0.16], [-w * 0.13, h * 0.39, 0.16, h * 0.78], [w * 0.13, h * 0.39, 0.16, h * 0.78]] as const) mesh(new THREE.BoxGeometry(ww, hh, 0.1), trimM, door, [x, y, 0.04]);
    const diag = Math.hypot(w * 0.26, h * 0.76); for (const a of [1, -1]) { const b = mesh(new THREE.BoxGeometry(diag, 0.14, 0.1), trimM, door, [0, h * 0.39, 0.05]); b.rotation.z = a * Math.atan2(h * 0.76, w * 0.26); }
  }
  mesh(new THREE.BoxGeometry(w * 0.24, h * 0.32, 0.1), dark, g, [0, h * 1.12, fz]);
  for (const [x, y, ww, hh] of [[0, h * 1.29, w * 0.27, 0.12], [0, h * 0.95, w * 0.27, 0.12], [-w * 0.13, h * 1.12, 0.12, h * 0.34], [w * 0.13, h * 1.12, 0.12, h * 0.34]] as const) mesh(new THREE.BoxGeometry(ww, hh, 0.12), trimM, g, [x, y, fz + 0.02]);
  for (const s of [-1, 1]) { mesh(new THREE.BoxGeometry(0.18, h, 0.18), trimM, g, [s * (hw - 0.05), h / 2, fz]); mesh(new THREE.BoxGeometry(0.18, h, 0.18), trimM, g, [s * (hw - 0.05), h / 2, -fz]); }
  // side windows
  for (const s of [-1, 1]) for (const zz of [-d * 0.25, d * 0.25]) { mesh(new THREE.BoxGeometry(0.1, 0.9, 0.9), std(0x1e293b, 0.3), g, [s * (hw + 0.02), h * 0.62, zz]); mesh(new THREE.BoxGeometry(0.12, 1.06, 0.12), trimM, g, [s * (hw + 0.04), h * 0.62, zz]); mesh(new THREE.BoxGeometry(0.12, 0.12, 1.06), trimM, g, [s * (hw + 0.04), h * 0.62, zz]); }
  // weathervane
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), std(0x334155, 0.4, { metalness: 0.7 }), g, [0, ridge + 0.6, d * 0.3]);
  const arrow = mesh(new THREE.ConeGeometry(0.14, 0.5, 6), std(0x334155, 0.4, { metalness: 0.7 }), g, [0.2, ridge + 1.1, d * 0.3]); arrow.rotation.z = -Math.PI / 2;
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeSilo(r: number, h: number) {
  const g = new THREE.Group(); const metal = std(0xcbd5e1, 0.35, { metalness: 0.75 }), band = std(0x94a3b8, 0.3, { metalness: 0.8 });
  mesh(new THREE.CylinderGeometry(r, r, h, 32, 1), metal, g, [0, h / 2, 0]);
  for (let y = 1; y < h; y += 1.4) mesh(new THREE.TorusGeometry(r + 0.02, 0.05, 6, 40), band, g, [0, y, 0]).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(r * 1.02, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xb91c1c, 0.45, { metalness: 0.3 }), g, [0, h, 0]);
  const ladder = std(0x475569, 0.4, { metalness: 0.7 }); for (const s of [-0.25, 0.25]) mesh(new THREE.BoxGeometry(0.06, h, 0.06), ladder, g, [s, h / 2, r + 0.12]); for (let y = 0.4; y < h; y += 0.5) mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), ladder, g, [0, y, r + 0.12]);
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
}
function makeWindmill() {
  const g = new THREE.Group(); const steel = std(0x9ca3af, 0.4, { metalness: 0.7 });
  const H = 11; for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = mesh(new THREE.CylinderGeometry(0.07, 0.1, H + 0.3, 6), steel, g, [x * 0.7, H / 2, z * 0.7]); leg.rotation.z = -x * 0.06; leg.rotation.x = z * 0.06; }
  for (let y = 1.5; y < H; y += 2) mesh(new THREE.TorusGeometry(0.95 - y * 0.035, 0.035, 4, 4), steel, g, [0, y, 0]).rotation.set(Math.PI / 2, 0, Math.PI / 4);
  const head = new THREE.Group(); head.position.set(0, H + 0.3, 0); g.add(head);
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 12), std(0xb91c1c, 0.5), head, [0, 0, 0.1]).rotation.x = Math.PI / 2;
  const tail = mesh(new THREE.BoxGeometry(0.06, 1.3, 2.2), std(0xf8fafc, 0.6), head, [0, 0.2, -1.6]); void tail;
  const rotor = new THREE.Group(); rotor.position.z = 0.75; head.add(rotor);
  for (let i = 0; i < 16; i++) { const b = mesh(new THREE.BoxGeometry(0.34, 2.1, 0.04), std(i % 2 ? 0xf8fafc : 0xdc2626, 0.5), rotor, [0, 0, 0]); b.geometry.translate(0, 1.25, 0); b.rotation.z = (i / 16) * Math.PI * 2; b.rotation.y = 0.35; }
  mesh(new THREE.TorusGeometry(2.25, 0.06, 6, 40), steel, rotor);
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return { g, rotor };
}
function makeCoop() {
  const g = new THREE.Group(); const wall = new THREE.MeshStandardMaterial({ color: 0xf3e3c3, map: plankTexture("#ffffff"), roughness: 0.85 });
  mesh(new THREE.BoxGeometry(4.2, 2.1, 3.6), wall, g, [0, 1.65, 0]);
  for (const [x, z] of [[-1.9, -1.6], [1.9, -1.6], [1.9, 1.6], [-1.9, 1.6]]) mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), std(0x6b4a2b), g, [x, 0.3, z]);
  const roofM = new THREE.MeshStandardMaterial({ color: 0x15803d, map: roofTexture("#ffffff"), roughness: 0.6 });
  for (const s of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(4.8, 0.14, 2.3), roofM, g, [0, 3.22, s * 0.92]); r.rotation.x = s * 0.52; }
  mesh(new THREE.BoxGeometry(0.9, 1.0, 0.08), std(0x7c2d12), g, [0, 1.3, 1.84]);
  const ramp = mesh(new THREE.BoxGeometry(0.8, 0.06, 1.8), std(0x8b5a2b), g, [0, 0.42, 2.6]); ramp.rotation.x = 0.5;
  for (let i = 0; i < 3; i++) mesh(new THREE.CircleGeometry(0.28, 16), std(0x1f2937, 0.5), g, [-1.4 + i * 1.4, 2.25, 1.81], false);
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
}
function makeHouse() {
  const g = new THREE.Group(); const wall = new THREE.MeshStandardMaterial({ color: 0xfefce8, map: plankTexture("#ffffff"), roughness: 0.85 });
  mesh(new THREE.BoxGeometry(8, 4.2, 6), wall, g, [0, 2.1, 0]);
  const roofM = new THREE.MeshStandardMaterial({ color: 0x334155, map: roofTexture("#ffffff"), roughness: 0.6 });
  for (const s of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(8.8, 0.2, 4.1), roofM, g, [0, 5.25, s * 1.6]); r.rotation.x = s * 0.62; }
  const gable = new THREE.Shape(); gable.moveTo(-3, 0); gable.lineTo(3, 0); gable.lineTo(0, 2.2); gable.closePath();
  for (const s of [-1, 1]) { const gg = mesh(new THREE.ShapeGeometry(gable), wall, g, [s * 4, 4.2, 0]); gg.rotation.y = s * Math.PI / 2; }
  mesh(new THREE.BoxGeometry(0.9, 2.5, 0.9), std(0x9a3412, 0.8), g, [2.4, 6, -1]);
  mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), std(0x1d4ed8, 0.5), g, [0, 1.1, 3.02]);
  for (const x of [-2.6, 2.6]) for (const y of [1.6, 3.2]) { mesh(new THREE.BoxGeometry(1.1, 0.9, 0.1), std(0x93c5fd, 0.15, { emissive: 0x1e3a8a, emissiveIntensity: 0.15 }), g, [x, y, 3.02]); mesh(new THREE.BoxGeometry(1.3, 0.12, 0.14), std(0xffffff), g, [x, y - 0.5, 3.05]); }
  mesh(new THREE.BoxGeometry(8.4, 0.2, 1.8), std(0xd6c3a5, 0.8), g, [0, 0.1, 3.9]);
  for (const x of [-3.9, -1.5, 1.5, 3.9]) mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 8), std(0xffffff), g, [x, 1.4, 4.6]);
  const porch = mesh(new THREE.BoxGeometry(8.6, 0.14, 2.2), roofM, g, [0, 2.8, 4.1]); porch.rotation.x = 0.2;
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
}
function makeTractor() {
  const g = new THREE.Group(); const red = std(0xdc2626, 0.35, { metalness: 0.3 }), black = std(0x111827, 0.7), hub = std(0xfacc15, 0.4, { metalness: 0.4 });
  mesh(roundedBox(2.6, 1.0, 1.3, 0.15), red, g, [0.3, 1.0, 0]);
  mesh(roundedBox(1.3, 0.8, 1.2, 0.12), red, g, [1.2, 1.15, 0]);
  mesh(new THREE.BoxGeometry(1.2, 1.3, 1.25), std(0x7dd3fc, 0.1, { transparent: true, opacity: 0.55 }), g, [-0.5, 2.1, 0]);
  mesh(roundedBox(1.4, 0.12, 1.45, 0.05), red, g, [-0.5, 2.8, 0]);
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 8), black, g, [1.3, 1.9, 0.3]);
  for (const s of [-1, 1]) {
    const big = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 24), black, g, [-0.6, 0.85, s * 0.85]); big.rotation.x = Math.PI / 2; const bh = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.52, 16), hub, g, [-0.6, 0.85, s * 0.86]); bh.rotation.x = Math.PI / 2;
    const sm = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.34, 18), black, g, [1.35, 0.45, s * 0.7]); sm.rotation.x = Math.PI / 2; const sh = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12), hub, g, [1.35, 0.45, s * 0.71]); sh.rotation.x = Math.PI / 2;
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; }); return g;
}
function deciduous(r: () => number, s: number, apples = false) {
  const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.18 * s, 0.3 * s, 2.4 * s, 8), std(0x7a4a26, 0.9), g, [0, 1.2 * s, 0]);
  const leaf = [std(0x3f8f3a, 0.9, { flatShading: true }), std(0x4fa846, 0.9, { flatShading: true }), std(0x2f7a32, 0.9, { flatShading: true })];
  for (let i = 0; i < 5; i++) { const b = mesh(new THREE.IcosahedronGeometry((0.9 + r() * 0.5) * s, 1), leaf[i % 3], g, [(r() - 0.5) * 1.4 * s, (2.7 + r() * 1.1) * s, (r() - 0.5) * 1.4 * s]); b.rotation.set(r() * 3, r() * 3, 0); }
  if (apples) for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, h = (2.4 + r() * 1.6) * s; mesh(new THREE.SphereGeometry(0.13 * s, 8, 6), std(0xdc2626, 0.5), g, [Math.cos(a) * 1.25 * s, h, Math.sin(a) * 1.25 * s]); }
  return g;
}
function pine(r: () => number, s: number) {
  const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 1.6 * s, 7), std(0x6b4423, 0.9), g, [0, 0.8 * s, 0]);
  const m = std(0x24613a, 0.9, { flatShading: true }); for (let i = 0; i < 3; i++) mesh(new THREE.ConeGeometry((1.5 - i * 0.38) * s, 2.0 * s, 8), m, g, [0, (2.0 + i * 1.15) * s, 0]).rotation.y = r() * 3;
  return g;
}
function fence(group: THREE.Group, pts: [number, number][], white = false) {
  const post = std(white ? 0xf8fafc : 0x7a5230, 0.8), rail = std(white ? 0xffffff : 0x8b5e34, 0.8);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1]; const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    const n = Math.max(1, Math.round(len / 2.4));
    for (let k = 0; k <= n; k++) { const t = k / n; mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), post, group, [x1 + dx * t, 0.75, z1 + dz * t]); }
    for (const y of [0.6, 1.15]) { const r = mesh(new THREE.BoxGeometry(len, 0.14, 0.08), rail, group, [(x1 + x2) / 2, y, (z1 + z2) / 2]); r.rotation.y = -ang; }
  }
}

export type FarmWorld = { update: (dt: number, t: number) => void; addRipple: (x: number, z: number, power: number) => void; ripples: Ripple[]; sun: THREE.DirectionalLight };

export function buildFarm(scene: THREE.Scene, quality: "low" | "medium" | "high"): FarmWorld {
  const r = rng(2024);
  gradientSky(scene, 0x4f9fe0, 0xd5ecf8, 0xa9cf86);
  scene.fog = new THREE.Fog(0xd5ecf8, 70, 190);
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x5b7a3a, 1.35));
  const sun = new THREE.DirectionalLight(0xfff1d6, 3.1); sun.position.set(-30, 45, 25); sun.castShadow = quality !== "low";
  sun.shadow.mapSize.set(quality === "high" ? 4096 : 2048, quality === "high" ? 4096 : 2048); Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 50, bottom: -50, near: 5, far: 140 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun); scene.add(sun.target);
  // sun disc
  const glowT = canvasTex(128, 128, c => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,250,225,1)"); g.addColorStop(0.25, "rgba(255,240,190,.75)"); g.addColorStop(1, "rgba(255,230,160,0)"); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, fog: false })); sunSprite.position.set(-120, 120, -160); sunSprite.scale.setScalar(70); scene.add(sunSprite);

  // ground with hills around the edges
  const gGeo = new THREE.PlaneGeometry(300, 260, 150, 130); gGeo.rotateX(-Math.PI / 2);
  const pos = gGeo.attributes.position as THREE.BufferAttribute; const cols: number[] = []; const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const y = groundY(x, z); pos.setY(i, y); const n = vnoise(x * 2.3, z * 2.1) * 0.5 + 0.5; c.setRGB(0.8 + n * 0.16, 0.86 + n * 0.1, 0.72 + n * 0.1).multiplyScalar(y > 2 ? 0.92 : 0.96); cols.push(c.r, c.g, c.b); }
  gGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: grassTexture(), vertexColors: true, roughness: 0.95 })); ground.receiveShadow = true; scene.add(ground);

  const statics = new THREE.Group();
  // dirt paths (flat ribbons along curves)
  const dirt = new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const ribbon = (pts: [number, number][], w: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))); const N = 80; const v: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) { const p = curve.getPointAt(i / N), tg = curve.getTangentAt(i / N); const nx = -tg.z, nz = tg.x; for (const s of [-1, 1]) { const ww = w * (0.85 + Math.sin(i * 1.7) * 0.08); v.push(p.x + nx * s * ww / 2, 0.035, p.z + nz * s * ww / 2); uv.push(s < 0 ? 0 : 1, (i / N) * curve.getLength() / 6); } if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, dirt); m.receiveShadow = true; statics.add(m);
  };
  ribbon([[0, 60], [1, 36], [-1, 18], [1, 2], [-0.5, -14]], 5.5);
  ribbon([[1, 8], [10, 10], [20, 14], [28, 20]], 3.2);
  ribbon([[1, 4], [12, 2], [22, 3], [29, 5]], 3);
  ribbon([[-1, 0], [-12, -6], [-22, -12], [-29, -15]], 3.4);
  ribbon([[1, -6], [12, -10], [22, -14], [26, -15]], 3.2);
  // mud wallow for the pigs
  const mud = mesh(new THREE.CircleGeometry(3.8, 40), std(0x6b4a2e, 0.28, { metalness: 0.05 }), statics, [15, 0.045, 23], false); mud.rotation.x = -Math.PI / 2; mud.scale.set(1.3, 1, 1); mud.receiveShadow = true;
  // buildings
  const barnA = makeBarn(7, 6.4, 4.2, 0xa52a2a, 0x334155); barnA.position.set(-29.3, 0, -19.5); barnA.rotation.y = 0.12; scene.add(barnA);
  const barnB = makeBarn(8, 7.2, 4.8, 0xb91c1c, 0x1f2937); barnB.position.set(-0.5, 0, -19.3); scene.add(barnB);
  const stable = makeBarn(7, 6.6, 3.6, 0xd4a64a, 0x7c2d12, 0xfffbeb); stable.position.set(26.3, 0, -18.5); stable.rotation.y = -0.15; scene.add(stable);
  const silo = makeSilo(1.8, 11); silo.position.set(6.5, 0, -20.5); scene.add(silo);
  const silo2 = makeSilo(1.3, 8); silo2.position.set(-35.5, 0, -22.5); scene.add(silo2);
  const coop = makeCoop(); coop.position.set(30.3, 0, 5.6); coop.rotation.y = -Math.PI / 2 + 0.2; scene.add(coop);
  const house = makeHouse(); house.position.set(-15, 0, -30); house.rotation.y = 0.25; scene.add(house);
  const mill = makeWindmill(); mill.g.position.set(14, 0, -28); mill.g.rotation.y = 0.5; scene.add(mill.g);
  const tractor = makeTractor(); tractor.position.set(10, 0, -13); tractor.rotation.y = 2.4; scene.add(tractor);
  // fences around the pastures (with gaps for paths)
  fence(statics, [[-42, -4], [-31, -4]], true); fence(statics, [[-26, -4], [-4, -4]], true); fence(statics, [[5, -4], [40, -4]], true);
  fence(statics, [[-42, -4], [-42, 33], [-4, 33]]); fence(statics, [[5, 33], [22, 33]]); fence(statics, [[43, -4], [43, 15]]);
  fence(statics, [[8, 17], [8, 29], [22, 29], [22, 17], [12, 17]]);
  // round hay bales, stacked square bales, troughs, pumpkins, crates
  const baleT = baleTexture(); const baleM = new THREE.MeshStandardMaterial({ map: baleT, roughness: 1 }), baleSide = new THREE.MeshStandardMaterial({ color: 0xcaa24c, roughness: 1 });
  for (const [x, z, rot] of [[-20, -11, 0.3], [-17.5, -11.6, 0.1], [9, -12, 0.2], [20, -9, -0.15], [-12, 20, 0.1], [-36, 10, 1.2], [38, -8, 0.4]] as const) { const b = mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 24), [baleM, baleSide, baleSide], statics, [x, 0.85, z]); b.rotation.set(0, rot, Math.PI / 2); }
  for (const [x, z] of [[-24, -14.5], [4, -14], [21, -13.5]] as const) for (let i = 0; i < 3; i++) { const sq = mesh(new THREE.BoxGeometry(1.4, 0.6, 0.75), baleM, statics, [x + (i % 2) * 1.45 - 0.7, 0.3 + Math.floor(i / 2) * 0.6, z]); sq.rotation.y = 0.05 * i; }
  const trough = (x: number, z: number, rot: number, water: boolean) => { const g = new THREE.Group(); mesh(roundedBox(3.2, 0.6, 1.0, 0.1), std(water ? 0x94a3b8 : 0x7a4a26, water ? 0.4 : 0.85, water ? { metalness: 0.6 } : {}), g, [0, 0.35, 0]); mesh(new THREE.BoxGeometry(2.9, 0.05, 0.75), water ? std(0x38bdf8, 0.1) : std(0xd9b95d, 1), g, [0, 0.6, 0]); g.position.set(x, 0, z); g.rotation.y = rot; statics.add(g); };
  trough(-25, 4, 0.1, true); trough(0, 23, 0, false); trough(26, 12, 0.3, true); trough(14, 24, 1.4, false);
  const pumpkinM = std(0xf97316, 0.6), stemM = std(0x3f6212, 0.8);
  for (let i = 0; i < 18; i++) { const x = -40 + (i % 6) * 1.6 + r() * 0.5, z = 24 + Math.floor(i / 6) * 1.7 + r() * 0.4; const p = mesh(new THREE.SphereGeometry(0.42 + r() * 0.15, 14, 10), pumpkinM, statics, [x, 0.36, z]); p.scale.y = 0.75; mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 6), stemM, statics, [x, 0.72, z]); }
  // corn rows behind the farmhouse
  const cornM = std(0x65a30d, 0.85, { flatShading: true }), cobM = std(0xfacc15, 0.7);
  for (let row = 0; row < 7; row++) for (let k = 0; k < 16; k++) { const x = -40 + k * 1.1 + r() * 0.3, z = -27 - row * 1.4; const h = 1.8 + r() * 0.6; mesh(new THREE.ConeGeometry(0.28, h, 5), cornM, statics, [x, h / 2, z]); if (r() < 0.4) mesh(new THREE.CapsuleGeometry(0.08, 0.25, 2, 6), cobM, statics, [x + 0.12, h * 0.55, z]); }
  // pond: banks, reeds, rocks, lily pads
  const bank = mesh(new THREE.CircleGeometry(POND.r + 1.6, 64), std(0x8a7a52, 0.95), statics, [POND.x, 0.03, POND.z], false); bank.rotation.x = -Math.PI / 2; bank.receiveShadow = true;
  const rockM = [std(0x9ca3af, 0.85, { flatShading: true }), std(0x78716c, 0.85, { flatShading: true })];
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2 + r() * 0.2, rr = POND.r + 0.8 + r() * 0.8; const s = mesh(new THREE.DodecahedronGeometry(0.35 + r() * 0.45, 0), rockM[i % 2], statics, [POND.x + Math.cos(a) * rr, 0.15, POND.z + Math.sin(a) * rr]); s.scale.y = 0.6; s.rotation.set(r() * 3, r() * 3, 0); }
  const reedM = std(0x4d7c0f, 0.8), tailM = std(0x713f12, 0.8);
  for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, rr = POND.r - 0.4 + r() * 1.4; if (Math.sin(a * 2) < -0.2) continue; const x = POND.x + Math.cos(a) * rr, z = POND.z + Math.sin(a) * rr, h = 1.1 + r() * 0.9; mesh(new THREE.CylinderGeometry(0.025, 0.04, h, 4), reedM, statics, [x, h / 2, z]); if (r() < 0.5) mesh(new THREE.CapsuleGeometry(0.06, 0.25, 2, 6), tailM, statics, [x, h, z]); }
  const { mat: waterMat, uRip } = makeWater({ deep: 0x0e7490, shallow: 0x2dd4bf, sky: 0xbfe6f7, foam: 0xffffff, sun: new THREE.Vector3(-0.5, 0.75, 0.3), radius: POND.r, center: [POND.x, POND.z] });
  const wGeo = new THREE.CircleGeometry(POND.r + 0.5, 96, 0, Math.PI * 2); wGeo.rotateX(-Math.PI / 2);
  const wTess = new THREE.PlaneGeometry((POND.r + 0.6) * 2, (POND.r + 0.6) * 2, 90, 90); wTess.rotateX(-Math.PI / 2);
  // keep only the round part of the dense grid so the water edge is a circle
  { const p = wTess.attributes.position as THREE.BufferAttribute; const idx = wTess.index!; const keep: number[] = []; for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i), b = idx.getX(i + 1), cc = idx.getX(i + 2); const cx = (p.getX(a) + p.getX(b) + p.getX(cc)) / 3, cz = (p.getZ(a) + p.getZ(b) + p.getZ(cc)) / 3; if (Math.hypot(cx, cz) < POND.r + 0.5) keep.push(a, b, cc); } wTess.setIndex(keep); }
  wGeo.dispose();
  const water = new THREE.Mesh(wTess, waterMat); water.position.set(POND.x, 0.08, POND.z); scene.add(water);
  const padM = std(0x4d7c0f, 0.7), lotus = std(0xf9a8d4, 0.5);
  const pads: THREE.Object3D[] = []; for (let i = 0; i < 9; i++) { const g = new THREE.Group(); const p = mesh(new THREE.CircleGeometry(0.5 + r() * 0.3, 18, 0.3, Math.PI * 2 - 0.5), padM, g, undefined, false); p.rotation.x = -Math.PI / 2; if (i % 3 === 0) mesh(new THREE.SphereGeometry(0.16, 10, 8), lotus, g, [0.1, 0.1, 0]).scale.y = 0.6; const a = r() * Math.PI * 2, rr = 1.5 + r() * (POND.r - 2.5); g.position.set(POND.x + Math.cos(a) * rr, 0.12, POND.z + Math.sin(a) * rr); g.rotation.y = r() * 6; scene.add(g); pads.push(g); }
  // trees: a ring of woods beyond the fields, an orchard by the yard
  const trees = new THREE.Group();
  for (let i = 0; i < 70; i++) { const a = (i / 70) * Math.PI * 2 + r() * 0.05; const rx = 62 + r() * 26, rz = 52 + r() * 22; const x = Math.cos(a) * rx, z = Math.sin(a) * rz; const t = r() < 0.45 ? pine(r, 1.2 + r() * 0.9) : deciduous(r, 1.1 + r() * 0.8); t.position.set(x, groundY(x, z) - 0.2, z); t.rotation.y = r() * 6; trees.add(t); }
  for (const [x, z] of [[-48, -30], [-48, -8], [-47, 18], [-46, 36], [47, -28], [48, -4], [47, 20], [46, 38], [20, 40], [-20, 42], [36, -30], [-38, -36]] as const) { const t = deciduous(r, 1.3 + r() * 0.5); t.position.set(x, 0, z); trees.add(t); }
  for (let i = 0; i < 6; i++) { const t = deciduous(r, 0.95, true); t.position.set(12 + (i % 3) * 5, 0, 36 + Math.floor(i / 3) * 4.5); trees.add(t); }
  trees.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  scene.add(bakeStatic(trees));
  // flowers + grass tufts (instanced)
  const tuftN = quality === "low" ? 0 : quality === "medium" ? 1200 : 2400;
  if (tuftN) {
    const tuft = new THREE.ConeGeometry(0.07, 0.5, 4); tuft.translate(0, 0.25, 0);
    const im = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: 0x6aa84f, roughness: 1 }), tuftN); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(); const col = new THREE.Color();
    let n = 0; while (n < tuftN) { const x = (r() - 0.5) * 100, z = (r() - 0.5) * 86; if (inPond(x, z, 1.5) || OBSTACLES.some(o => inBox(x, z, o))) continue; p.set(x, 0, z); q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5)); sc.setScalar(0.6 + r() * 0.9); m.compose(p, q, sc); im.setMatrixAt(n, m); im.setColorAt(n, col.setHSL(0.25 + r() * 0.06, 0.45, 0.42 + r() * 0.14)); n++; }
    scene.add(im);
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.14, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 500); const fc = [0xffffff, 0xfacc15, 0xf472b6, 0xa78bfa, 0xf87171];
    for (let i = 0; i < 500; i++) { let x = 0, z = 0; do { x = (r() - 0.5) * 100; z = (r() - 0.5) * 86; } while (inPond(x, z, 1.5) || OBSTACLES.some(o => inBox(x, z, o))); m.compose(p.set(x, 0.28, z), q.identity(), sc.setScalar(0.8 + r() * 0.6)); fl.setMatrixAt(i, m); fl.setColorAt(i, col.setHex(fc[i % fc.length])); }
    scene.add(fl);
  }
  const baked = bakeStatic(statics); baked.traverse(o => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; }); scene.add(baked);
  // drifting clouds
  const cloudM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, flatShading: true, fog: false });
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) { const g = new THREE.Group(); for (let k = 0; k < 5; k++) { const b = mesh(new THREE.IcosahedronGeometry(3 + r() * 2.5, 1), cloudM, g, [k * 4 - 8 + r() * 2, r() * 2, r() * 3], false); b.scale.y = 0.6; } g.position.set(-120 + i * 30 + r() * 10, 38 + r() * 14, -60 - r() * 60); clouds.push(g); scene.add(g); }
  // butterflies and birds
  const wingM = [0xfacc15, 0xf472b6, 0x60a5fa, 0xffffff].map(cc => new THREE.MeshStandardMaterial({ color: cc, side: THREE.DoubleSide, roughness: 0.6 }));
  const flies = Array.from({ length: 10 }, (_, i) => { const g = new THREE.Group(); const w1 = mesh(new THREE.PlaneGeometry(0.32, 0.24), wingM[i % 4], g, [0.16, 0, 0], false), w2 = mesh(new THREE.PlaneGeometry(0.32, 0.24), wingM[i % 4], g, [-0.16, 0, 0], false); w1.geometry.translate(0.0, 0, 0); scene.add(g); return { g, w1, w2, cx: (r() - 0.5) * 70, cz: (r() - 0.5) * 60, ph: r() * 9, rad: 2 + r() * 4 }; });
  const birdM = new THREE.MeshBasicMaterial({ color: 0x1f2937, side: THREE.DoubleSide, fog: false });
  const birds = Array.from({ length: 6 }, (_, i) => { const g = new THREE.Group(); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.18), birdM); w.position.x = s * 0.45; w.userData.s = s; g.add(w); } scene.add(g); return { g, ph: i * 0.6, rad: 34 + i * 2 }; });

  const ripples: Ripple[] = []; let ri = 0, now = 0;
  const addRipple = (x: number, z: number, power: number) => { const rr = { x, z, t0: now, power }; ripples[ri % MAX_RIPPLES] = rr; uRip[ri % MAX_RIPPLES].set(x, z, now, power); ri++; };
  return { sun, ripples, addRipple,
    update: (dt, t) => {
      now = t; (waterMat.uniforms.uTime as { value: number }).value = t;
      mill.rotor.rotation.z -= dt * 1.4;
      for (const cl of clouds) { cl.position.x += dt * 1.2; if (cl.position.x > 150) cl.position.x = -150; }
      for (const [i, p] of pads.entries()) { p.position.y = 0.12 + Math.sin(t * 1.3 + i) * 0.03; p.rotation.y += Math.sin(t * 0.3 + i) * 0.0008; }
      for (const f of flies) { const a = t * 0.5 + f.ph; f.g.position.set(f.cx + Math.cos(a) * f.rad, 1 + Math.sin(t * 1.7 + f.ph) * 0.5 + 0.4, f.cz + Math.sin(a * 1.3) * f.rad); f.g.rotation.y = -a; const fl = Math.sin(t * 22 + f.ph) * 1.1; f.w1.rotation.y = fl; f.w2.rotation.y = -fl; }
      for (const b of birds) { const a = t * 0.12 + b.ph; b.g.position.set(Math.cos(a) * b.rad, 30 + Math.sin(a * 2) * 2 + b.ph, Math.sin(a) * b.rad * 0.8 - 10); b.g.rotation.y = -a - Math.PI / 2; const fl = Math.sin(t * 7 + b.ph * 3) * 0.5; b.g.children.forEach(w => { w.rotation.z = fl * (w.userData.s as number); }); }
      if (Math.random() < dt * 0.35) addRipple(POND.x + (Math.random() - 0.5) * 8, POND.z + (Math.random() - 0.5) * 8, 0.18);
    } };
}
