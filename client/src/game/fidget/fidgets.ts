// Fidget Lab — twelve 3D fidgets for eye gaze, mouse and touch. Each fidget builds into its own group on the
// shared Stage and reacts to where you look: hover to light or squish, dwell to pop or flip, sweep to spin.
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import type { Stage } from "@/game/stage/stage";
import { gradientSky } from "@/game/stage/stage";
import type { StageAudio } from "@/game/stage/audio";
import { makeWater, heightAt, MAX_RIPPLES, type Ripple } from "@/game/splash/water";
import { mesh, roundedBox, starShape, std } from "@/game/runner/models";
import { canvasTex, EMOJI_FONT } from "@/game/runner/textures";

export type FidgetId = "popit" | "bubbles" | "spinner" | "slime" | "ripple" | "stars" | "clicker" | "orbs" | "kaleido" | "switches" | "tiles" | "reveal";
export const FIDGETS: { id: FidgetId; name: string; emoji: string; hint: string; how: string }[] = [
  { id: "popit", name: "Mega Pop-It", emoji: "🌈", hint: "Pop every bubble, then flip it", how: "Look at a bubble to pop it!" },
  { id: "bubbles", name: "Bubble Wrap", emoji: "📦", hint: "Pop a whole sheet", how: "Look along the rows — pop, pop, pop!" },
  { id: "spinner", name: "Spinner", emoji: "🌀", hint: "Spin it with your eyes", how: "Look around the spinner in a circle to spin it." },
  { id: "slime", name: "Galaxy Slime", emoji: "🧪", hint: "Squish and jiggle", how: "Look at the slime to squish it." },
  { id: "ripple", name: "Ripple Pool", emoji: "💧", hint: "Make waves, splash the ducks", how: "Look across the water to make ripples." },
  { id: "stars", name: "Star Maker", emoji: "🌌", hint: "Draw with stardust", how: "Look around to draw. Hold still to make a star." },
  { id: "clicker", name: "Big Button", emoji: "🔴", hint: "Press it and count", how: "Look at the big button to press it." },
  { id: "orbs", name: "Lava Orbs", emoji: "🔮", hint: "Glowing blobs follow you", how: "The blobs follow your eyes." },
  { id: "kaleido", name: "Kaleidoscope", emoji: "✨", hint: "Patterns that move with you", how: "Look around to swirl. Hold still for new colours." },
  { id: "switches", name: "Switch Board", emoji: "🎛️", hint: "Flip every switch", how: "Look at a switch to flip it. Turn them all on!" },
  { id: "tiles", name: "Music Tiles", emoji: "🎹", hint: "Light and play the floor", how: "Look across the tiles to play music." },
  { id: "reveal", name: "Surprise Tiles", emoji: "🎁", hint: "Uncover a hidden picture", how: "Look at the tiles to find the surprise!" },
];
export type FidgetCtx = { stage: Stage; audio: StageAudio; say: (text: string) => void; toast: (text: string) => void };
export type Fidget = { root: THREE.Group; env?: number; update: (dt: number, t: number) => void; pointer?: (p: THREE.Vector3, kind: "move" | "down" | "up", touch: boolean) => void; reset?: () => void; dispose?: () => void };

const buzz = (ms = 8) => { try { if (window.matchMedia?.("(pointer: coarse)").matches) navigator.vibrate?.(ms); } catch { /* optional */ } };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
function baseLights(root: THREE.Group, key = 0xffffff, k = 2.2, hemi: [number, number, number] = [0xffffff, 0x8899aa, 1.1]) {
  root.add(new THREE.HemisphereLight(hemi[0], hemi[1], hemi[2]));
  const d = new THREE.DirectionalLight(key, k); d.position.set(-5, 8, 12); d.castShadow = true; d.shadow.mapSize.set(1024, 1024); Object.assign(d.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 40 }); d.shadow.normalBias = 0.03; root.add(d);
  return d;
}
function backdrop(root: THREE.Group, a: number, b: number, c: number) { const m = gradientSky(new THREE.Scene(), a, b, c); m.removeFromParent(); root.add(m); return m; }
const fit = (stage: Stage, w: number, h: number) => { const { hw, hh } = stage.view(); return Math.min((hw * 2 * 0.92) / w, (hh * 2 * 0.78) / h, 1.25); };
const RAINBOW = [0xff4d6d, 0xff8c42, 0xffd23f, 0x5ad26a, 0x3fb7ff, 0x8b5cf6, 0xf472b6];

// ── 1. Pop-It ──
function popit(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0xffd6e8, 0xfff4fa, 0xe9d8ff); baseLights(root); stage.setView([0, -4.5, 15.4], [0, 0, 0]);
  const board = new THREE.Group(); root.add(board); const cols = 7, rows = 6, sp = 1.18;
  const frame = mesh(roundedBox(cols * sp + 0.7, rows * sp + 0.7, 0.36, 0.9), std(0xffffff, 0.45), board, [0, 0, -0.22]); frame.receiveShadow = true;
  for (let r = 0; r < rows; r++) { const strip = mesh(roundedBox(cols * sp + 0.4, sp, 0.3, r === 0 || r === rows - 1 ? 0.5 : 0.02), std(RAINBOW[r % RAINBOW.length], 0.38), board, [0, ((rows - 1) / 2 - r) * sp, -0.05]); strip.receiveShadow = true; }
  const domeGeo = new THREE.SphereGeometry(0.47, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); domeGeo.rotateX(Math.PI / 2);
  type D = { m: THREE.Mesh; popped: boolean; k: number; v: number; base: THREE.Color; dark: THREE.Color };
  const domes: D[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const m = mesh(domeGeo, new THREE.MeshStandardMaterial({ color: RAINBOW[r % RAINBOW.length], roughness: 0.32 }), board, [(c - (cols - 1) / 2) * sp, ((rows - 1) / 2 - r) * sp, 0.1]);
    const base = new THREE.Color(RAINBOW[r % RAINBOW.length]); const d: D = { m, popped: false, k: 1, v: 0, base, dark: base.clone().multiplyScalar(0.62) }; domes.push(d);
    stage.pick(m, { id: `pop${r}-${c}`, dwellMs: 420, ringScale: 1.2, enabled: () => !d.popped && flip === 0, onDwell: () => pop(d) });
  }
  let flip = 0, count = 0;
  const pop = (d: D) => { if (d.popped) return; d.popped = true; d.v = -9; count++; audio.play("pop"); buzz(); const p = d.m.getWorldPosition(new THREE.Vector3()); stage.fx.burst(p.x, p.y, 0.4, { color: [0xffffff, (d.m.material as THREE.MeshStandardMaterial).color.getHex()], count: 8, speed: 2.4, life: 0.35, size: 0.18, gravity: 2 });
    if (domes.every(o => o.popped)) { audio.play("win"); ctx.toast("All popped! Flip it over!"); stage.fx.burst(0, 0, 1, { color: RAINBOW, count: 120, speed: 9, life: 1.2, size: 0.3, gravity: 6, spreadZ: 3 }); window.setTimeout(() => { flip = 0.0001; audio.play("whoosh", 4); }, 900); } };
  const reset = () => { for (const d of domes) { d.popped = false; d.k = 1; d.v = 0; } count = 0; };
  return { root, reset,
    pointer: (p, kind, touch) => { if (!(touch && stage.pointerDown) || flip) return; const lp = board.worldToLocal(p.clone()); for (const d of domes) if (!d.popped && Math.hypot(d.m.position.x - lp.x, d.m.position.y - lp.y) < 0.5) pop(d); void kind; },
    update: (dt) => {
      board.scale.setScalar(fit(stage, cols * sp + 0.8, rows * sp + 0.8));
      // a full turn: the fresh side comes round while the back faces you
      if (flip > 0) { flip = Math.min(1, flip + dt * 1.1); board.rotation.y = Math.PI * 2 * (flip * flip * (3 - 2 * flip)); if (flip >= 0.5 && count) reset(); if (flip >= 1) { flip = 0; board.rotation.y = 0; } }
      for (const d of domes) { const want = d.popped ? 0.16 : 1; const mm = d.m.material as THREE.MeshStandardMaterial; mm.color.lerp(d.popped ? d.dark : d.base, Math.min(1, dt * 10)); d.v += (want - d.k) * 260 * dt - d.v * 16 * dt; d.k += d.v * dt; d.m.scale.set(1, 1, d.k * 0.7); }
    } };
}

// ── 2. Bubble Wrap ──
function bubbleWrap(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0xbfe3ff, 0xeef8ff, 0xc7d2fe); baseLights(root, 0xffffff, 2.6); stage.setView([0, -4.5, 15.4], [0, 0, 0]);
  const box = mesh(roundedBox(14, 10, 0.6, 0.5), std(0x7dd3fc, 0.6), root, [0, 0, -0.8]); box.receiveShadow = true;
  mesh(roundedBox(10.4, 7, 0.2, 0.3), std(0x3b82f6, 0.7), root, [0, 0, -0.45]).receiveShadow = true;
  const sheet = new THREE.Group(); root.add(sheet); const cols = 9, rows = 6, sp = 1.05;
  mesh(new THREE.PlaneGeometry(cols * sp + 0.5, rows * sp + 0.5), new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.15, transparent: true, opacity: 0.38 }), sheet, [0, 0, -0.02], false);
  const geo = new THREE.SphereGeometry(0.42, 24, 16); const mat = new THREE.MeshPhysicalMaterial({ color: 0xe0f2ff, roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.68, envMapIntensity: 2 });
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.22 });
  type Bb = { m: THREE.Mesh; popped: boolean; t: number };
  let bs: Bb[] = []; let slide = 0, rebuilt = false;
  const build = () => {
    for (const b of bs) { stage.unpick(b.m); sheet.remove(b.m); } bs = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const m = mesh(geo, mat, sheet, [(c - (cols - 1) / 2) * sp + (r % 2) * 0.0, ((rows - 1) / 2 - r) * sp, 0.12]); m.scale.set(1, 1, 0.5);
      const b: Bb = { m, popped: false, t: 0 }; bs.push(b);
      stage.pick(m, { id: `bw${r}-${c}`, dwellMs: 340, ringScale: 1.25, enabled: () => !b.popped && slide === 0, onDwell: () => pop(b) });
    }
  };
  const pop = (b: Bb) => { if (b.popped) return; b.popped = true; b.t = 0; b.m.material = flat; audio.play("pop"); audio.play("click"); buzz(6);
    const p = b.m.getWorldPosition(new THREE.Vector3()); stage.fx.burst(p.x, p.y, 0.4, { color: 0xffffff, count: 6, speed: 2, life: 0.3, size: 0.14, gravity: 0 });
    if (bs.every(o => o.popped)) { ctx.toast("Whole sheet popped! Here's a fresh one."); audio.play("goal"); window.setTimeout(() => { slide = 0.0001; audio.play("whoosh", 2); }, 700); } };
  build();
  return { root, reset: () => { slide = 0.0001; },
    pointer: (p, _k, touch) => { if (!(touch && stage.pointerDown) || slide) return; const lp = sheet.worldToLocal(p.clone()); for (const b of bs) if (!b.popped && Math.hypot(b.m.position.x - lp.x, b.m.position.y - lp.y) < 0.46) pop(b); },
    update: (dt, t) => {
      const s = fit(stage, 14.4, 10.4); root.scale.setScalar(s);
      if (slide > 0) { slide = Math.min(1, slide + dt * 1.4); const e = (k: number) => k * k * (3 - 2 * k);
        if (slide < 0.5) sheet.position.x = -22 * e(slide * 2); else { if (!rebuilt) { build(); rebuilt = true; } sheet.position.x = 22 * (1 - e((slide - 0.5) * 2)); }
        if (slide >= 1) { slide = 0; rebuilt = false; sheet.position.x = 0; } }
      for (const b of bs) { if (b.popped) { b.t += dt; const k = Math.max(0.08, 0.5 - b.t * 6); b.m.scale.set(1.06, 1.06, k); b.m.rotation.z = 0.3; } else b.m.scale.z = 0.5 + Math.sin(t * 2 + b.m.position.x) * 0.01; }
    } };
}

// ── 3. Spinner ──
function spinner(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0x1e1b4b, 0x312e81, 0x0f172a); baseLights(root, 0xffffff, 2.6, [0xc7d2fe, 0x1e1b4b, 0.9]);
  const rim = new THREE.PointLight(0x22d3ee, 30, 30); rim.position.set(6, -4, 6); root.add(rim); const rim2 = new THREE.PointLight(0xf472b6, 30, 30); rim2.position.set(-6, 5, 5); root.add(rim2);
  const sp = new THREE.Group(); root.add(sp);
  const body = std(0x7c3aed, 0.25, { metalness: 0.6 }), chrome = std(0xe5e7eb, 0.15, { metalness: 1 }), gold = std(0xfacc15, 0.2, { metalness: 0.9 });
  const shape = new THREE.Shape(); const R = 2.5;
  for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2; const r = 1.15 + 1.4 * Math.pow(0.5 + 0.5 * Math.cos(3 * a), 2.2); const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); }
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4, curveSegments: 6 }); bodyGeo.center();
  mesh(bodyGeo, body, sp);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const ring = mesh(new THREE.TorusGeometry(0.62, 0.16, 14, 36), chrome, sp, [Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86, 0]); void ring; mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.62, 28), gold, sp, [Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86, 0]).rotation.x = Math.PI / 2; }
  const cap = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.9, 36), chrome, root, [0, 0, 0]); cap.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.95, 36), std(0xf472b6, 0.3, { metalness: 0.4 }), root).rotation.x = Math.PI / 2;
  let w = 0, ang = 0, lastA: number | null = null, lastT = 0, nextTick = 0;
  const hud = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); hud.position.set(0, -4.4, 0); hud.scale.set(4, 1, 1); root.add(hud);
  let shown = -1; const label = (rpm: number) => { const v = Math.round(rpm / 10) * 10; if (v === shown) return; shown = v; (hud.material as THREE.SpriteMaterial).map?.dispose(); (hud.material as THREE.SpriteMaterial).map = canvasTex(512, 128, c => { c.fillStyle = "rgba(255,255,255,.92)"; c.font = "900 64px ui-rounded,system-ui,sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(`${v} RPM`, 256, 64); }); (hud.material as THREE.SpriteMaterial).needsUpdate = true; };
  stage.pick(cap, { id: "spin", dwellMs: 700, ringScale: 1.6, onDwell: () => { w += 9; audio.play("whoosh", 6); stage.rearm(); } });
  return { root, reset: () => { w = 0; },
    pointer: (p, kind) => { if (kind === "up") { lastA = null; return; } const d = Math.hypot(p.x, p.y) / root.scale.x; if (d < 1 || d > 6) { lastA = null; return; } const a = Math.atan2(p.y, p.x), now = performance.now() / 1000;
      if (lastA !== null) { let da = a - lastA; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2; const dtt = Math.max(0.016, now - lastT); w += THREE.MathUtils.clamp(da / dtt, -30, 30) * 0.06; } lastA = a; lastT = now; },
    update: (dt) => {
      root.scale.setScalar(fit(stage, 7, 9));
      w *= Math.pow(0.82, dt); if (Math.abs(w) < 0.02) w = 0; w = THREE.MathUtils.clamp(w, -60, 60); ang += w * dt; sp.rotation.z = ang; sp.rotation.x = Math.sin(ang * 0.05) * 0.04;
      nextTick -= Math.abs(w) * dt; if (nextTick <= 0 && Math.abs(w) > 1.5) { nextTick = (Math.PI * 2) / 3; audio.play("spin", Math.min(30, Math.abs(w))); }
      if (Math.abs(w) > 8) for (let i = 0; i < 3; i++) { const a = ang + (i / 3) * Math.PI * 2; const s = root.scale.x; stage.fx.burst(Math.cos(a) * R * 0.86 * s, Math.sin(a) * R * 0.86 * s, 0.5, { color: [0x22d3ee, 0xf472b6, 0xfacc15][i], count: 1, speed: 0.2, life: 0.5, size: 0.35, gravity: 0 }); }
      label(Math.abs(w) * 60 / (Math.PI * 2));
    } };
}

// ── 4. Galaxy Slime ──
function galaxyTex() { return canvasTex(1024, 512, (c, r) => {
  const g = c.createLinearGradient(0, 0, 1024, 512); g.addColorStop(0, "#5b21b6"); g.addColorStop(0.5, "#db2777"); g.addColorStop(1, "#1d4ed8"); c.fillStyle = g; c.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 40; i++) { const x = r() * 1024, y = r() * 512, rad = 40 + r() * 140; const gg = c.createRadialGradient(x, y, 0, x, y, rad); gg.addColorStop(0, `hsla(${200 + r() * 140},90%,65%,.55)`); gg.addColorStop(1, "hsla(0,0%,0%,0)"); c.fillStyle = gg; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; const s = r() < 0.08 ? 3 : 1.4; c.fillRect(r() * 1024, r() * 512, s, s); }
}, 31); }
function slime(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0x0b1026, 0x1e1b4b, 0x050816); baseLights(root, 0xffffff, 2.4, [0xe9d5ff, 0x1e1b4b, 1.0]);
  const l1 = new THREE.PointLight(0x60a5fa, 40, 40); l1.position.set(6, 4, 8); root.add(l1);
  const geo = new THREE.IcosahedronGeometry(3, 20); const base = (geo.attributes.position.array as Float32Array).slice();
  const mat = new THREE.MeshPhysicalMaterial({ map: galaxyTex(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.6, sheenColor: new THREE.Color(0xf0abfc), emissive: 0x3b0764, emissiveIntensity: 0.35 });
  if (mat.map) { mat.map.wrapS = THREE.RepeatWrapping; mat.map.needsUpdate = true; }
  const blob = new THREE.Mesh(geo, mat); blob.castShadow = true; root.add(blob);
  const plate = mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.4, 48), std(0x1f2937, 0.3, { metalness: 0.6 }), root, [0, -3.1, 0]); plate.receiveShadow = true;
  let press = 0, pv = 0, wob = 0; const at = new THREE.Vector2(0, 0); let was = false;
  return { root,
    pointer: (_p, kind) => { if (kind === "down") { pv -= 2; audio.play("squish"); } },
    update: (dt, t) => {
      const s = fit(stage, 8, 8); root.scale.setScalar(s);
      const p = stage.pointer; let on = false;
      if (p && (stage.pointerHover || stage.pointerDown)) { const lx = p.x / s, ly = p.y / s; if (Math.hypot(lx, ly) < 3.4) { on = true; at.lerp(new THREE.Vector2(lx, ly), Math.min(1, dt * 10)); } }
      if (on && !was) audio.play("squish"); if (!on && was) { audio.play("bubble"); wob = 1; }
      was = on;
      const want = on ? (stage.pointerDown ? 1.5 : 0.95) : 0; pv += (want - press) * 90 * dt - pv * 7 * dt; press += pv * dt; wob = Math.max(0, wob - dt * 0.6);
      const pos = geo.attributes.position as THREE.BufferAttribute; const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2];
        const n = Math.sin(x * 1.3 + t * 1.7) * Math.sin(y * 1.1 + t * 1.3) * Math.sin(z * 1.2 + t * 1.1) * 0.08 + Math.sin(y * 3 + t * 9) * 0.05 * wob;
        const d2 = (x - at.x) ** 2 + (y - at.y) ** 2; const dent = z > 0 ? press * Math.exp(-d2 / 1.4) * (0.5 + z / 6) : 0;
        const bulge = press * 0.07 * (1 - Math.exp(-d2 / 6));
        const k = 1 + n - dent / 3 + bulge; arr[i] = x * k; arr[i + 1] = y * k * (1 - press * 0.03) - press * 0.08; arr[i + 2] = z * k;
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
      // the galaxy swirls across the surface (the blob itself stays put so the dent sits right under your eyes)
      if (mat.map) mat.map.offset.x = (t * 0.012) % 1;
    } };
}

// ── 5. Ripple Pool ──
function makeDuck() {
  const g = new THREE.Group(); const y = std(0xffd23f, 0.45), o = std(0xff8c1a, 0.5), k = std(0x111827, 0.3);
  const b = mesh(new THREE.SphereGeometry(0.55, 20, 14), y, g, [0, 0.25, 0]); b.scale.set(1.25, 0.8, 1);
  mesh(new THREE.SphereGeometry(0.34, 18, 12), y, g, [0.45, 0.8, 0]);
  const beak = mesh(new THREE.ConeGeometry(0.13, 0.3, 12), o, g, [0.82, 0.75, 0]); beak.rotation.z = -Math.PI / 2;
  for (const z of [0.18, -0.18]) mesh(new THREE.SphereGeometry(0.05, 8, 6), k, g, [0.66, 0.9, z]);
  const tail = mesh(new THREE.ConeGeometry(0.18, 0.35, 10), y, g, [-0.7, 0.45, 0]); tail.rotation.z = Math.PI / 2.6;
  return g;
}
function ripple(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0x7dd3fc, 0xe0f2fe, 0x65a30d);
  baseLights(root, 0xfff7e0, 2.2, [0xffffff, 0x3f6212, 1.0]);
  stage.setView([0, 15, 9.5], [0, 0, 0.5], 42);
  const R = 8.5; const { mat, uRip } = makeWater({ deep: 0x0e7490, shallow: 0x22d3ee, sky: 0xbae6fd, foam: 0xffffff, sun: new THREE.Vector3(-0.4, 0.8, 0.3), radius: R });
  const wgeo = new THREE.PlaneGeometry((R + 0.6) * 2, (R + 0.6) * 2, 150, 150); wgeo.rotateX(-Math.PI / 2); const water = new THREE.Mesh(wgeo, mat); root.add(water);
  const mask = new THREE.Mesh(new THREE.RingGeometry(R + 0.3, 40, 96), std(0x84cc16, 0.95)); mask.rotation.x = -Math.PI / 2; mask.position.y = 0.55; mask.receiveShadow = true; root.add(mask);
  const stoneM = [std(0x9ca3af, 0.85), std(0x78716c, 0.85), std(0xa8a29e, 0.85)];
  for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2; const st = mesh(new THREE.DodecahedronGeometry(0.62 + (i % 3) * 0.12, 0), stoneM[i % 3], root, [Math.cos(a) * (R + 0.35), 0.62, Math.sin(a) * (R + 0.35)]); st.scale.set(1.2, 0.55, 1); st.rotation.y = a * 3; }
  const pads: { g: THREE.Object3D; x: number; z: number; vx: number; vz: number; spin: number; duck: boolean }[] = [];
  const padM = std(0x4d7c0f, 0.7), flowerM = std(0xf9a8d4, 0.5);
  for (let i = 0; i < 6; i++) { const g = new THREE.Group(); const pad = mesh(new THREE.CircleGeometry(0.9, 24, 0.3, Math.PI * 2 - 0.6), padM, g); pad.rotation.x = -Math.PI / 2; if (i % 2 === 0) { const f = mesh(new THREE.SphereGeometry(0.22, 12, 8), flowerM, g, [0.2, 0.15, 0.1]); f.scale.y = 0.6; } const a = i * 1.1; pads.push({ g, x: Math.cos(a) * (3 + i * 0.7), z: Math.sin(a) * (3 + i * 0.7), vx: 0, vz: 0, spin: 0, duck: false }); root.add(g); }
  for (let i = 0; i < 3; i++) { const d = makeDuck(); d.scale.setScalar(0.9); root.add(d); const pd = { g: d, x: -3 + i * 3, z: -1 + (i % 2) * 2.5, vx: 0.3, vz: 0.2, spin: i, duck: true }; pads.push(pd);
    stage.pick(d, { id: `duck${i}`, dwellMs: 700, ringScale: 1.3, onDwell: () => { audio.play("quack"); pd.vx += (Math.random() - 0.5) * 3; pd.vz += (Math.random() - 0.5) * 3; addRipple(pd.x, pd.z, 0.7); stage.rearm(); } }); }
  const rips: Ripple[] = []; let ri = 0, lastAt = new THREE.Vector3(999, 0, 999), lastT = 0, t0 = 0, lastAsp = 0;
  const addRipple = (x: number, z: number, power: number) => { const r = { x, z, t0, power }; rips[ri % MAX_RIPPLES] = r; uRip[ri % MAX_RIPPLES].set(x, z, t0, power); ri++; };
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  return { root,
    dispose: () => { stage.setView([0, 0, 16], [0, 0, 0], 42); },
    pointer: (_p, kind) => { const q = stage.pointerOn(floor); if (!q || Math.hypot(q.x, q.z) > R) return;
      if (kind === "down") { addRipple(q.x, q.z, 1.4); audio.play("splash"); stage.fx.burst(q.x, 0.3, q.z, { color: [0xffffff, 0xbae6fd], count: 30, speed: 4, life: 0.7, size: 0.25, gravity: 9, up: 4 }); return; }
      if (q.distanceTo(lastAt) > 1.2 && t0 - lastT > 0.25) { addRipple(q.x, q.z, 0.6); lastAt.copy(q); lastT = t0; audio.play("drop"); } },
    update: (dt, t) => {
      t0 = t; (mat.uniforms.uTime as { value: number }).value = t;
      const asp = stage.camera.aspect; if (asp !== lastAsp) { lastAsp = asp; const k = Math.max(1, 1.45 / asp); stage.setView([0, 15 * k, 9.5 * k], [0, 0, 0.5], 42); }
      for (const p of pads) {
        // ripples push floating things outward
        for (const r of rips) { if (!r) continue; const age = t - r.t0; if (age < 0 || age > 3) continue; const dx = p.x - r.x, dz = p.z - r.z, d = Math.hypot(dx, dz) || 1; const front = Math.exp(-((d - age * 2.6) ** 2) * 0.6) * r.power * 1.6 * dt; p.vx += (dx / d) * front; p.vz += (dz / d) * front; p.spin += front * 2; }
        if (p.duck) { p.vx += Math.cos(t * 0.3 + p.spin) * 0.08 * dt; p.vz += Math.sin(t * 0.3 + p.spin) * 0.08 * dt; }
        p.vx *= Math.pow(0.5, dt); p.vz *= Math.pow(0.5, dt); p.x += p.vx * dt; p.z += p.vz * dt;
        const d = Math.hypot(p.x, p.z), lim = R - 1.2; if (d > lim) { p.x *= lim / d; p.z *= lim / d; p.vx *= -0.5; p.vz *= -0.5; }
        const h = heightAt(p.x, p.z, t, rips.filter(Boolean)); p.g.position.set(p.x, h + 0.02, p.z);
        p.g.rotation.y = p.duck ? -Math.atan2(p.vz, p.vx) : p.spin; if (p.duck) { p.g.rotation.z = Math.sin(t * 2 + p.spin) * 0.08; }
      }
      if (Math.random() < dt * 0.4) addRipple((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 0.25);
    } };
}

// ── 6. Star Maker ──
function stars(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0x020617, 0x1e1b4b, 0x0b1026);
  const N = 600, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 34, -8 - Math.random() * 10], i * 3);
  const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); const bgm = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.8 }); root.add(new THREE.Points(bg, bgm));
  const starGeo = new THREE.ShapeGeometry(starShape(0.6, 0.26, 5));
  const made: { m: THREE.Mesh; t: number; c: number }[] = []; const lineMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.55 });
  let line: THREE.Line | null = null; let still = 0; const lastP = new THREE.Vector3(999, 0, 0); let shoot = 3; let trailT = 0;
  const addStar = (x: number, y: number) => {
    const c = RAINBOW[made.length % RAINBOW.length]; const m = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true })); m.position.set(x, y, 0); m.scale.setScalar(0.01); root.add(m); made.push({ m, t: 0, c });
    const { hh } = stage.view(); audio.play("chime", PENTA[Math.max(0, Math.min(PENTA.length - 1, Math.floor(((y + hh) / (hh * 2)) * PENTA.length)))]);
    stage.fx.burst(x, y, 0.2, { color: [c, 0xffffff], count: 40, speed: 5, life: 0.8, size: 0.25, gravity: 0, drag: 2 });
    if (made.length > 24) { const o = made.shift()!; root.remove(o.m); (o.m.material as THREE.Material).dispose(); }
    if (line) { root.remove(line); line.geometry.dispose(); } const pts = made.map(s => s.m.position.clone()); line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat); root.add(line);
  };
  return { root, reset: () => { for (const s of made) root.remove(s.m); made.length = 0; if (line) { root.remove(line); line = null; } },
    pointer: (p, kind) => { if (kind === "down") addStar(p.x, p.y); },
    update: (dt, t) => {
      bgm.opacity = 0.65 + Math.sin(t * 2) * 0.15;
      const p = stage.pointer;
      if (p && (stage.pointerHover || stage.pointerDown)) {
        const moved = p.distanceTo(lastP); trailT -= dt;
        if (moved > 0.05 && trailT <= 0) { trailT = 0.02; stage.fx.burst(p.x, p.y, 0, { color: [0xfde68a, 0x93c5fd, 0xf0abfc, 0xffffff], count: 3, speed: 0.6, life: 1.1, size: 0.22, gravity: -0.3, drag: 1 }); if (Math.random() < 0.15) audio.play("sparkle"); }
        if (moved < 0.15) { still += dt; if (still > 0.75) { still = -0.6; addStar(p.x, p.y); } } else still = Math.min(still, 0);
        if (moved > 0.15) lastP.copy(p);
      }
      for (const s of made) { s.t += dt; const k = Math.min(1, s.t * 4); s.m.scale.setScalar((k < 1 ? k * 1.3 : 1 + Math.sin(t * 3 + s.c) * 0.08)); s.m.rotation.z = t * 0.4 + s.c; }
      shoot -= dt; if (shoot <= 0) { shoot = 4 + Math.random() * 5; const { hw, hh } = stage.view(); const y = hh * (0.3 + Math.random() * 0.5), x0 = -hw + Math.random() * hw; for (let i = 0; i < 14; i++) stage.fx.burst(x0 + i * 0.5, y - i * 0.22, -1, { color: 0xffffff, count: 2, speed: 0.3, life: 0.4 + i * 0.03, size: 0.3 - i * 0.015, gravity: 0 }); }
    } };
}

// ── 7. Big Button ──
function clicker(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0xfef3c7, 0xfffbeb, 0xfde68a); baseLights(root); stage.setView([0, -5, 15.2], [0, 0, 0]);
  const base = mesh(roundedBox(7, 4.2, 1.6, 0.5), std(0x1f2937, 0.4, { metalness: 0.3 }), root, [0, -1.6, -0.6]); base.receiveShadow = true;
  const bezel = mesh(new THREE.CylinderGeometry(1.9, 2.05, 0.5, 48), std(0xd1d5db, 0.2, { metalness: 0.9 }), root, [0, -1.6, 0.35]); bezel.rotation.x = Math.PI / 2;
  const capG = new THREE.Group(); capG.position.set(0, -1.6, 0.6); root.add(capG);
  const cap = mesh(new THREE.CylinderGeometry(1.55, 1.6, 0.8, 48), std(0xef4444, 0.3), capG); cap.rotation.x = Math.PI / 2; cap.position.z = 0.4;
  const dome = mesh(new THREE.SphereGeometry(1.55, 40, 16, 0, Math.PI * 2, 0, Math.PI / 5), std(0xf87171, 0.25), capG); dome.rotation.x = Math.PI / 2; dome.position.z = -0.45;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2), new THREE.MeshBasicMaterial({ toneMapped: false })); panel.position.set(0, 2.4, 0); root.add(panel);
  mesh(roundedBox(6, 2.4, 0.4, 0.3), std(0x111827, 0.4), root, [0, 2.4, -0.25]);
  let n = 0, press = 0;
  const draw = () => { (panel.material as THREE.MeshBasicMaterial).map?.dispose(); (panel.material as THREE.MeshBasicMaterial).map = canvasTex(560, 200, c => { c.fillStyle = "#0b1220"; c.fillRect(0, 0, 560, 200); c.font = "900 150px ui-monospace,monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "rgba(34,197,94,.14)"; c.fillText("8888", 280, 108); c.fillStyle = "#4ade80"; c.shadowColor = "#22c55e"; c.shadowBlur = 24; c.fillText(String(n).padStart(4, "0"), 280, 108); }); (panel.material as THREE.MeshBasicMaterial).needsUpdate = true; };
  draw();
  const hit = () => { n++; press = 1; draw(); audio.play("click"); audio.play("bump"); buzz(15);
    if (n % 10 === 0) { audio.play("goal"); ctx.say(String(n)); stage.fx.burst(0, 0, 1, { color: RAINBOW, count: 90, speed: 9, life: 1.1, size: 0.3, gravity: 6, spreadZ: 2 }); } stage.rearm(); };
  stage.pick(capG, { id: "button", dwellMs: 650, ringScale: 1.25, onDwell: hit });
  const rb = new THREE.Group(); rb.position.set(2.7, -1.6, 0.3); root.add(rb); const rcap = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 28), std(0x38bdf8, 0.35), rb); rcap.rotation.x = Math.PI / 2;
  const rl = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, c => { c.fillStyle = "#fff"; c.font = "900 80px system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("↺", 64, 70); }), transparent: true })); rl.position.z = 0.3; rl.scale.setScalar(0.6); rb.add(rl);
  stage.pick(rb, { id: "reset", dwellMs: 900, onDwell: () => { n = 0; draw(); audio.play("switch", 0); } });
  return { root, reset: () => { n = 0; draw(); },
    update: (dt) => { root.scale.setScalar(fit(stage, 7.2, 7.4)); press = Math.max(0, press - dt * 5); capG.position.z = 0.6 - Math.sin(press * Math.PI) * 0.45; } };
}

// ── 8. Lava Orbs ──
function orbs(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0x0f0720, 0x2e1065, 0x0f0720);
  root.add(new THREE.HemisphereLight(0xffffff, 0x220044, 0.6)); const pl = new THREE.PointLight(0xffffff, 60, 40); pl.position.set(0, 4, 10); root.add(pl);
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.12, clearcoat: 1, emissive: 0x2a0a40, emissiveIntensity: 0.5 });
  for (const [c, x, y] of [[0xff4fd8, -8, 4], [0x3fd0ff, 8, -3], [0xffd23f, 0, -8]] as const) { const l = new THREE.PointLight(c, 50, 40); l.position.set(x, y, 8); root.add(l); }
  const mc = new MarchingCubes(40, mat, false, true, 60000); mc.isolation = 70; root.add(mc);
  const balls = Array.from({ length: 7 }, (_, i) => ({ x: 0.5 + Math.cos(i) * 0.2, y: 0.5 + Math.sin(i * 1.7) * 0.2, z: 0.5, vx: 0, vy: 0, c: new THREE.Color().setHSL(i / 7, 0.85, 0.58), ph: i * 1.3 }));
  let bub = 0;
  return { root,
    update: (dt, t) => {
      const { hw, hh } = stage.view(); const S = Math.min(hw, hh) * 1.9; mc.scale.setScalar(S / 2);
      const p = stage.pointer; const on = !!p && (stage.pointerHover || stage.pointerDown);
      const tx = on ? THREE.MathUtils.clamp(p!.x / S + 0.5, 0.15, 0.85) : 0.5, ty = on ? THREE.MathUtils.clamp(p!.y / S + 0.5, 0.15, 0.85) : 0.5;
      mc.reset();
      for (const b of balls) {
        const hx = 0.5 + Math.sin(t * 0.35 + b.ph) * 0.26, hy = 0.5 + Math.cos(t * 0.27 + b.ph * 1.7) * 0.26;
        const orbit = 0.17 + 0.08 * Math.sin(t * 0.9 + b.ph * 2); const gx = on ? tx + Math.cos(b.ph * 2.3 + t * 1.3) * orbit : hx, gy = on ? ty + Math.sin(b.ph * 2.3 + t * 1.3) * orbit : hy;
        b.vx += (gx - b.x) * (on ? 2.2 : 0.6) * dt; b.vy += (gy - b.y) * (on ? 2.2 : 0.6) * dt; b.vx *= Math.pow(0.35, dt); b.vy *= Math.pow(0.35, dt); b.x += b.vx * dt * 3; b.y += b.vy * dt * 3;
        mc.addBall(b.x, b.y, 0.5 + Math.sin(t + b.ph) * 0.05, 0.3, 12, b.c);
      }
      mc.update();
      bub -= dt; if (on && bub <= 0) { bub = 0.35 + Math.random() * 0.5; audio.play("bubble"); }
    } };
}

// ── 9. Kaleidoscope ──
export function kaleido(ctx: FidgetCtx, ambient = false): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group();
  const uni = { uT: { value: 0 }, uC: { value: new THREE.Vector2() }, uSeg: { value: 8 }, uPal: { value: 0 }, uAspect: { value: 1 }, uDim: { value: ambient ? 0.55 : 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uT; uniform vec2 uC; uniform float uSeg; uniform float uPal; uniform float uAspect; uniform float uDim; varying vec2 vUv;
      vec3 pal(float t, float k){ vec3 a = vec3(.5), b = vec3(.5); vec3 c = vec3(1.0); vec3 d = k < .5 ? vec3(.0,.33,.67) : k < 1.5 ? vec3(.3,.2,.2) : k < 2.5 ? vec3(.8,.9,.3) : vec3(.0,.1,.2); return a + b * cos(6.2831 * (c * t + d)); }
      void main(){ vec2 p = (vUv - .5) * vec2(uAspect, 1.0) * 2.0 - uC * .35; float r = length(p); float a = atan(p.y, p.x) + uT * .08 + uC.x * .6;
        float seg = 6.2831 / uSeg; a = mod(a, seg); a = abs(a - seg * .5);
        vec2 q = vec2(cos(a), sin(a)) * r; float v = 0.0;
        for (int i = 0; i < 4; i++) { float fi = float(i); q = abs(q * 1.45 - vec2(.55 + .1 * sin(uT * .3 + fi), .35)); v += exp(-length(q) * 3.0) * (1.0 / (1.0 + fi)); }
        float rings = .5 + .5 * sin(r * 14.0 - uT * 1.6 + v * 6.0);
        vec3 col = pal(v * 1.4 + r * .4 + uT * .05, uPal) * (.28 + rings * .62) + pow(v, 3.0) * .35;
        col *= smoothstep(1.9, .2, r) * .85 + .15; gl_FragColor = vec4(clamp(col, 0.0, 0.97) * uDim, 1.0);
        #include <colorspace_fragment>
      }` });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); plane.position.z = -2; root.add(plane);
  let still = 0; const lastP = new THREE.Vector3(999, 0, 0); const c = new THREE.Vector2();
  const shuffle = () => { uni.uPal.value = (uni.uPal.value + 1) % 4; uni.uSeg.value = [6, 8, 10, 12, 5][Math.floor(Math.random() * 5)]; if (!ambient) { audio.play("sparkle"); audio.play("chime", PENTA[Math.floor(Math.random() * 6)]); } };
  return { root,
    pointer: (_p, kind) => { if (kind === "down" && !ambient) shuffle(); },
    update: (dt, t) => {
      const { hw, hh } = stage.view(); const d = stage.camera.position.z + 2, k = d / stage.camera.position.z; plane.scale.set(hw * 2 * k * 1.05, hh * 2 * k * 1.05, 1); uni.uAspect.value = hw / hh; uni.uT.value = t;
      const p = stage.pointer;
      if (!ambient && p && (stage.pointerHover || stage.pointerDown)) { c.lerp(new THREE.Vector2(p.x / hh, p.y / hh), Math.min(1, dt * 3)); const moved = p.distanceTo(lastP); if (moved < 0.12) { still += dt; if (still > 1.1) { still = -0.8; shuffle(); } } else { still = Math.min(0, still); lastP.copy(p); } }
      else c.lerp(new THREE.Vector2(Math.sin(t * 0.2) * 0.8, Math.cos(t * 0.17) * 0.5), Math.min(1, dt));
      uni.uC.value.copy(c);
    } };
}

// ── 10. Switch Board ──
function switches(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0x334155, 0x64748b, 0x1e293b); baseLights(root, 0xffffff, 2.4, [0xe2e8f0, 0x334155, 1.1]);
  const cols = 4, rows = 3, sx = 2.6, sy = 2.9; stage.setView([0, -3.5, 15.6], [0, 0, 0]);
  const panel = mesh(roundedBox(cols * sx + 0.8, rows * sy + 0.6, 0.4, 0.4), std(0x9ca3af, 0.35, { metalness: 0.8 }), root, [0, 0, -0.4]); panel.receiveShadow = true;
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16), std(0x4b5563, 0.3, { metalness: 0.9 }), root, [x * (cols * sx / 2 + 0.1), y * (rows * sy / 2 + 0.05), -0.15]).rotation.x = Math.PI / 2;
  type Sw = { lever: THREE.Group; led: THREE.Mesh; on: boolean; a: number };
  const sws: Sw[] = []; let show = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const g = new THREE.Group(); g.position.set((c - (cols - 1) / 2) * sx, ((rows - 1) / 2 - r) * sy - 0.3, 0); root.add(g);
    mesh(roundedBox(1.5, 2.1, 0.3, 0.2), std(0x1f2937, 0.5), g, [0, 0, -0.1]);
    mesh(roundedBox(0.7, 1.2, 0.2, 0.15), std(0x0b0f19, 0.6), g, [0, 0, 0.06]);
    const lever = new THREE.Group(); lever.position.z = 0.1; g.add(lever);
    mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.1, 14), std(0xe5e7eb, 0.2, { metalness: 1 }), lever, [0, 0.45, 0]);
    mesh(new THREE.SphereGeometry(0.24, 16, 12), std(RAINBOW[(r * cols + c) % RAINBOW.length], 0.3), lever, [0, 1.0, 0]);
    const led = mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: 0x3f3f46, emissive: 0x000000, roughness: 0.3 }), g, [0, 1.25, 0.05]);
    const s: Sw = { lever, led, on: false, a: 0.45 }; sws.push(s);
    stage.pick(g, { id: `sw${r}-${c}`, dwellMs: 650, ringScale: 0.9, onDwell: () => { s.on = !s.on; audio.play("switch", s.on ? 1 : 0); audio.play("click"); buzz(10); if (s.on && sws.every(o => o.on)) { show = 3; audio.play("win"); ctx.toast("All switches on — light show!"); } } });
  }
  return { root, reset: () => { for (const s of sws) s.on = false; },
    update: (dt, t) => {
      root.scale.setScalar(fit(stage, cols * sx + 1, rows * sy + 0.8)); show = Math.max(0, show - dt);
      sws.forEach((s, i) => { const want = s.on ? -0.45 : 0.45; s.a += (want - s.a) * Math.min(1, dt * 18); s.lever.rotation.x = s.a;
        const m = s.led.material as THREE.MeshStandardMaterial; if (show > 0) { m.emissive.setHSL((t * 0.8 + i / 12) % 1, 1, 0.5); m.emissiveIntensity = 2.2; } else if (s.on) { m.emissive.setHex(0x22c55e); m.emissiveIntensity = 2.4; } else { m.emissive.setHex(0x7f1d1d); m.emissiveIntensity = 0.5; } });
    } };
}

// ── 11. Music Tiles ──
function tiles(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0x020617, 0x111827, 0x020617);
  root.add(new THREE.HemisphereLight(0xffffff, 0x111827, 0.5));
  const cols = 8, rows = 5, sp = 1.5;
  const geo = roundedBox(1.32, 1.32, 0.3, 0.2);
  const ts: { m: THREE.Mesh; glow: number; c: number; r: number; col: THREE.Color }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const col = new THREE.Color().setHSL((c / cols) * 0.85, 0.9, 0.55);
    const m = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: col, emissiveIntensity: 0.05, roughness: 0.35, metalness: 0.2 }), root, [(c - (cols - 1) / 2) * sp, ((rows - 1) / 2 - r) * sp, 0]);
    ts.push({ m, glow: 0, c, r, col });
  }
  let cur = -1; const wave: { c: number; r: number; t: number }[] = [];
  const light = (i: number, note = true) => { const t = ts[i]; t.glow = 1; if (note) audio.play("chime", PENTA[(t.c + (rows - 1 - t.r) * 2) % PENTA.length] + (t.r < 2 ? 12 : 0)); };
  return { root,
    pointer: (p, kind) => { if (kind !== "down") return; const s = root.scale.x; const c = Math.round(p.x / s / sp + (cols - 1) / 2), r = Math.round((rows - 1) / 2 - p.y / s / sp); if (c >= 0 && c < cols && r >= 0 && r < rows) { wave.push({ c, r, t: 0 }); audio.play("sparkle"); } },
    update: (dt) => {
      const s = fit(stage, cols * sp, rows * sp); root.scale.setScalar(s);
      const p = stage.pointer;
      if (p && (stage.pointerHover || stage.pointerDown)) { const c = Math.round(p.x / s / sp + (cols - 1) / 2), r = Math.round((rows - 1) / 2 - p.y / s / sp); const i = c >= 0 && c < cols && r >= 0 && r < rows ? r * cols + c : -1; if (i !== cur && i >= 0) light(i); cur = i; }
      for (const w of wave) { w.t += dt * 6; for (const t of ts) { const d = Math.hypot(t.c - w.c, t.r - w.r); if (Math.abs(d - w.t) < 0.5) t.glow = Math.max(t.glow, 0.8); } }
      while (wave.length && wave[0].t > 12) wave.shift();
      for (const t of ts) { t.glow = Math.max(0, t.glow - dt * 1.2); const m = t.m.material as THREE.MeshStandardMaterial; m.emissiveIntensity = 0.06 + t.glow * 2.6; t.m.position.z = t.glow * 0.35; }
    } };
}

// ── 12. Surprise Tiles ──
const SURPRISES: [string, string][] = [["dog", "🐶"], ["cat", "🐱"], ["lion", "🦁"], ["elephant", "🐘"], ["monkey", "🐵"], ["panda", "🐼"], ["unicorn", "🦄"], ["dinosaur", "🦖"], ["rocket", "🚀"], ["rainbow", "🌈"], ["pizza", "🍕"], ["ice cream", "🍦"], ["cupcake", "🧁"], ["butterfly", "🦋"], ["fire truck", "🚒"], ["whale", "🐳"], ["owl", "🦉"], ["robot", "🤖"], ["star", "⭐"], ["guitar", "🎸"], ["balloon", "🎈"], ["frog", "🐸"], ["penguin", "🐧"], ["sunflower", "🌻"]];
function reveal(ctx: FidgetCtx): Fidget {
  const { stage, audio } = ctx; const root = new THREE.Group(); backdrop(root, 0xfde68a, 0xfff7ed, 0xfbcfe8); baseLights(root);
  const cols = 5, rows = 4, sz = 1.6; const W = cols * sz, H = rows * sz;
  const picMat = new THREE.MeshBasicMaterial({ toneMapped: false }); const pic = new THREE.Mesh(new THREE.PlaneGeometry(W, H), picMat); pic.position.z = -0.2; root.add(pic);
  mesh(roundedBox(W + 0.7, H + 0.7, 0.3, 0.4), std(0xffffff, 0.5), root, [0, 0, -0.45]);
  const coverTex = canvasTex(256, 256, c => { const g = c.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, "#8b5cf6"); g.addColorStop(1, "#ec4899"); c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.fillStyle = "rgba(255,255,255,.9)"; c.font = "900 150px ui-rounded,system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("?", 128, 140); c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 10; c.strokeRect(12, 12, 232, 232); });
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.5 });
  type T = { m: THREE.Mesh; off: boolean; t: number; vx: number; vr: number };
  let ts: T[] = []; let item = SURPRISES[Math.floor(Math.random() * SURPRISES.length)]; let doneT = -1;
  const paint = () => { picMat.map?.dispose(); picMat.map = canvasTex(640, 512, c => { const g = c.createRadialGradient(320, 256, 20, 320, 256, 400); g.addColorStop(0, "#ffffff"); g.addColorStop(1, `hsl(${Math.random() * 360},80%,82%)`); c.fillStyle = g; c.fillRect(0, 0, 640, 512); c.font = `340px ${EMOJI_FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(item[1], 320, 280); }); picMat.needsUpdate = true; };
  const build = () => {
    for (const t of ts) { stage.unpick(t.m); root.remove(t.m); } ts = []; doneT = -1;
    item = SURPRISES.filter(s => s !== item)[Math.floor(Math.random() * (SURPRISES.length - 1))]; paint();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const m = mesh(roundedBox(sz * 0.96, sz * 0.96, 0.2, 0.12), coverMat, root, [(c - (cols - 1) / 2) * sz, ((rows - 1) / 2 - r) * sz, 0]);
      const t: T = { m, off: false, t: 0, vx: 0, vr: 0 }; ts.push(t);
      stage.pick(m, { id: `rv${r}-${c}`, dwellMs: 320, ringScale: 0.9, enabled: () => !t.off, onDwell: () => off(t) });
    }
  };
  const off = (t: T) => { if (t.off) return; t.off = true; t.vx = (Math.random() - 0.5) * 4; t.vr = (Math.random() - 0.5) * 8; audio.play("flip"); stage.unpick(t.m); buzz(6);
    if (ts.every(o => o.off)) { doneT = 0; audio.play("win"); ctx.say(`It's ${/^[aeiou]/.test(item[0]) ? "an" : "a"} ${item[0]}!`); ctx.toast(`It's ${/^[aeiou]/.test(item[0]) ? "an" : "a"} ${item[0]}! ${item[1]}`); stage.fx.burst(0, 0, 1, { color: RAINBOW, count: 120, speed: 9, life: 1.2, size: 0.32, gravity: 6, spreadZ: 2 }); } };
  build();
  return { root, reset: build,
    pointer: (p, _k, touch) => { if (!(touch && stage.pointerDown)) return; const lp = root.worldToLocal(p.clone()); for (const t of ts) if (!t.off && Math.abs(t.m.position.x - lp.x) < sz / 2 && Math.abs(t.m.position.y - lp.y) < sz / 2) off(t); },
    update: (dt) => {
      root.scale.setScalar(fit(stage, W + 0.8, H + 0.8));
      for (const t of ts) if (t.off) { t.t += dt; t.m.position.x += t.vx * dt; t.m.position.y += (2.5 - t.t * 14) * dt; t.m.position.z += 3 * dt; t.m.rotation.x += t.vr * dt; t.m.rotation.y += t.vr * 0.7 * dt; t.m.visible = t.t < 1.6; }
      if (doneT >= 0) { doneT += dt; pic.scale.setScalar(1 + Math.sin(Math.min(1, doneT * 2) * Math.PI) * 0.06); if (doneT > 4.5) build(); }
    } };
}

const ENV: Partial<Record<FidgetId, number>> = { bubbles: 0.6, spinner: 0.7, clicker: 0.45, orbs: 0.5, switches: 0.6, slime: 0.35 };
const BUILDERS: Record<FidgetId, (ctx: FidgetCtx) => Fidget> = { popit, bubbles: bubbleWrap, spinner, slime, ripple, stars, clicker, orbs, kaleido: c => kaleido(c), switches, tiles, reveal };
export function buildFidget(id: FidgetId, ctx: FidgetCtx) { const f = BUILDERS[id](ctx); f.env = ENV[id]; ctx.stage.scene.add(f.root); ctx.stage.useEnvironment(f.env ?? 0); return f; }
export function disposeFidget(f: Fidget, stage: Stage) {
  f.dispose?.(); stage.clearPicks(); stage.scene.remove(f.root);
  // cached geometries (rounded boxes) are re-uploaded by three.js the next time they are drawn
  f.root.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
}
