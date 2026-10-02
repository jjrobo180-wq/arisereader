// Skybound Sprint — characters and props, built from simple shapes with a soft "toy" look.
import * as THREE from "three";
import { textTexture } from "./textures";

const std = (color: number, rough = 0.55, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const glowMat = (color: number, i = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.35 });
function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D, pos?: [number, number, number]) {
  const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = false; if (pos) o.position.set(...pos); if (parent) parent.add(o); return o;
}
function eyes(parent: THREE.Object3D, y: number, z: number, spread: number, size: number, angry = false) {
  const white = std(0xffffff, 0.3), pupil = std(0x15121f, 0.2);
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(size, 14, 10), white, parent, [s * spread, y, z]); e.scale.set(0.85, 1.1, 0.6);
    mesh(new THREE.SphereGeometry(size * 0.55, 10, 8), pupil, parent, [s * spread * 0.95, y - size * 0.1, z + size * 0.42]);
    if (angry) { const brow = mesh(new THREE.BoxGeometry(size * 1.6, size * 0.35, size * 0.3), pupil, parent, [s * spread, y + size * 1.05, z + size * 0.2]); brow.rotation.z = s * -0.45; }
  }
}
export function starShape(outer = 0.5, inner = 0.22, points = 5) {
  const sh = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) { const r = i % 2 ? inner : outer; const a = i / (points * 2) * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
  sh.closePath(); return sh;
}
function heartShape(s = 0.5) {
  const sh = new THREE.Shape(); sh.moveTo(0, -0.45 * s);
  sh.bezierCurveTo(-0.1 * s, -0.25 * s, -0.95 * s, 0.05 * s, -0.5 * s, 0.45 * s);
  sh.bezierCurveTo(-0.2 * s, 0.7 * s, 0, 0.45 * s, 0, 0.3 * s);
  sh.bezierCurveTo(0, 0.45 * s, 0.2 * s, 0.7 * s, 0.5 * s, 0.45 * s);
  sh.bezierCurveTo(0.95 * s, 0.05 * s, 0.1 * s, -0.25 * s, 0, -0.45 * s);
  return sh;
}

// ── Hero: Skye the sky courier ──
export type HeroRig = {
  root: THREE.Group; body: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  cape: THREE.Group[]; capeMat: THREE.MeshStandardMaterial; jacketMat: THREE.MeshStandardMaterial; scarfTail: THREE.Group; featherPlume: THREE.Object3D;
  allMats: THREE.MeshStandardMaterial[];
};
export function makeHero(): HeroRig {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const skin = std(0xf2b68b, 0.6), jacketMat = std(0x1fb6d4, 0.5), pants = std(0x2b3a67, 0.6), boots = std(0x6b3f22, 0.5), leather = std(0x8a5530, 0.55), scarf = std(0xff4d5e, 0.5);
  const capeMat = std(0x7b4dff, 0.5, { side: THREE.DoubleSide });
  // legs
  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [g, x] of [[legL, -0.15], [legR, 0.15]] as const) {
    g.position.set(x, 0.55, 0); body.add(g);
    mesh(new THREE.CapsuleGeometry(0.11, 0.28, 4, 10), pants, g, [0, -0.2, 0]);
    const boot = mesh(new THREE.SphereGeometry(0.14, 12, 10), boots, g, [0, -0.47, 0.05]); boot.scale.set(1, 0.7, 1.4);
  }
  // torso
  const torso = mesh(new THREE.CapsuleGeometry(0.27, 0.22, 6, 14), jacketMat, body, [0, 0.82, 0]); torso.scale.set(1, 1, 0.85);
  mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 20), leather, body, [0, 0.63, 0]).rotation.x = Math.PI / 2;
  const buckle = mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), std(0xffd23f, 0.3, { metalness: 0.6 }), body, [0, 0.63, 0.27]); void buckle;
  // arms
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [g, x] of [[armL, -0.33], [armR, 0.33]] as const) {
    g.position.set(x, 0.98, 0); body.add(g);
    mesh(new THREE.CapsuleGeometry(0.08, 0.26, 4, 8), jacketMat, g, [0, -0.17, 0]);
    mesh(new THREE.SphereGeometry(0.09, 10, 8), skin, g, [0, -0.37, 0]);
  }
  // head
  const head = new THREE.Group(); head.position.set(0, 1.2, 0); body.add(head);
  mesh(new THREE.SphereGeometry(0.33, 22, 18), skin, head);
  const cap = mesh(new THREE.SphereGeometry(0.345, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), leather, head, [0, 0.02, -0.01]); cap.rotation.x = -0.12;
  for (const s of [-1, 1]) { const flap = mesh(new THREE.SphereGeometry(0.11, 10, 8), leather, head, [s * 0.3, -0.1, -0.02]); flap.scale.set(0.5, 1.2, 0.9); }
  // goggles on the forehead
  const gogMat = std(0x7fe7ff, 0.1, { metalness: 0.2, emissive: 0x1aa6c9, emissiveIntensity: 0.4 }), rim = std(0xd6a640, 0.3, { metalness: 0.7 });
  for (const s of [-1, 1]) { mesh(new THREE.TorusGeometry(0.085, 0.025, 8, 16), rim, head, [s * 0.11, 0.19, 0.27]).rotation.x = -0.5; mesh(new THREE.CircleGeometry(0.075, 16), gogMat, head, [s * 0.11, 0.195, 0.285]).rotation.x = -0.5; }
  eyes(head, -0.02, 0.27, 0.11, 0.075);
  const blush = std(0xff8f8f, 0.8); for (const s of [-1, 1]) { const b = mesh(new THREE.SphereGeometry(0.045, 8, 6), blush, head, [s * 0.2, -0.12, 0.25]); b.scale.set(1, 0.6, 0.4); }
  mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 10, Math.PI), std(0x7a3b2e), head, [0, -0.14, 0.31]).rotation.z = Math.PI;
  const featherPlume = mesh(new THREE.SphereGeometry(0.12, 10, 8), glowMat(0xffd23f, 1.2), head, [0.12, 0.38, -0.12]); featherPlume.scale.set(0.35, 1.6, 0.35); featherPlume.rotation.z = -0.5; featherPlume.visible = false;
  // scarf
  mesh(new THREE.TorusGeometry(0.2, 0.065, 8, 18), scarf, body, [0, 1.0, 0]).rotation.x = Math.PI / 2;
  const scarfTail = new THREE.Group(); scarfTail.position.set(0.05, 1.0, -0.18); body.add(scarfTail);
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.12, 0.05, 0.16), scarf, scarfTail, [0, -i * 0.02, -0.12 - i * 0.14]);
  // cape: three hinged panels hanging from the shoulders (spread wide while gliding)
  const cape: THREE.Group[] = [];
  let parent: THREE.Object3D = body; let y = 1.02;
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.position.set(0, i === 0 ? y : -0.24, i === 0 ? -0.22 : 0); parent.add(g);
    mesh(new THREE.BoxGeometry(0.56 + i * 0.1, 0.25, 0.03), capeMat, g, [0, -0.12, 0]);
    cape.push(g); parent = g; y = 0;
  }
  const allMats: THREE.MeshStandardMaterial[] = [];
  root.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && !allMats.includes(m)) allMats.push(m); });
  return { root, body, head, armL, armR, legL, legR, cape, capeMat, jacketMat, scarfTail, featherPlume, allMats };
}

// ── Enemies ──
export function makePuff() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const m = std(0xf2f0ff, 0.85);
  for (const [x, y, z, r] of [[0, 0.45, 0, 0.42], [-0.3, 0.35, 0, 0.3], [0.3, 0.35, 0, 0.3], [0, 0.72, -0.05, 0.3], [-0.15, 0.62, 0.15, 0.25]] as const) mesh(new THREE.SphereGeometry(r, 16, 12), m, body, [x, y, z]);
  eyes(body, 0.55, 0.36, 0.13, 0.08, true);
  const feet: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const f = mesh(new THREE.SphereGeometry(0.11, 10, 8), std(0xff9a3c, 0.5), g, [s * 0.18, 0.07, 0.05]); f.scale.set(1, 0.6, 1.4); feet.push(f); }
  g.userData = { body, feet };
  return g;
}
export function makeSpiky() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  mesh(new THREE.SphereGeometry(0.42, 18, 14), std(0x7b3fd1, 0.5), body, [0, 0.45, 0]);
  const spikeMat = glowMat(0x7ff6ff, 0.9);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 1.1 - 0.05; const sp = mesh(new THREE.ConeGeometry(0.1, 0.38, 6), spikeMat, body);
    const dir = new THREE.Vector3(Math.cos(a + Math.PI * -0.05), Math.sin(a), -0.25 + (i % 3) * 0.25).normalize();
    sp.position.copy(dir.clone().multiplyScalar(0.48)).add(new THREE.Vector3(0, 0.45, 0)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }
  eyes(body, 0.5, 0.36, 0.13, 0.075, true);
  const feet: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const f = mesh(new THREE.SphereGeometry(0.1, 10, 8), std(0x3b1f6b, 0.5), g, [s * 0.18, 0.07, 0.05]); f.scale.set(1, 0.6, 1.4); feet.push(f); }
  g.userData = { body, feet };
  return g;
}
export function makeBuzzer() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const b = mesh(new THREE.CapsuleGeometry(0.28, 0.32, 6, 14), std(0xffc93c, 0.4), body, [0, 0.38, 0]); b.rotation.z = Math.PI / 2;
  for (const x of [-0.12, 0.08]) { const ring = mesh(new THREE.TorusGeometry(0.285, 0.05, 8, 18), std(0x2a2238, 0.5), body, [x, 0.38, 0]); ring.rotation.y = Math.PI / 2; }
  const sting = mesh(new THREE.ConeGeometry(0.08, 0.25, 8), std(0x2a2238), body, [-0.5, 0.38, 0]); sting.rotation.z = Math.PI / 2;
  eyes(body, 0.47, 0.22, 0.1, 0.07, true);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe0f7ff, transparent: true, opacity: 0.65, roughness: 0.2, side: THREE.DoubleSide });
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const w = mesh(new THREE.CircleGeometry(0.28, 16), wingMat, body, [0, 0.7, s * 0.12]); w.scale.set(1.3, 0.6, 1); w.rotation.x = -Math.PI / 2 + s * 0.4; wings.push(w); }
  for (const s of [-1, 1]) { const ant = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), std(0x2a2238), body, [0.25, 0.7, s * 0.08]); ant.rotation.z = -0.5; mesh(new THREE.SphereGeometry(0.04, 8, 6), glowMat(0xff4d6d, 1), body, [0.32, 0.82, s * 0.08]); }
  g.userData = { body, wings };
  return g;
}

// ── Collectibles ──
export const gemGeometry = (() => { const g = new THREE.OctahedronGeometry(0.28, 0); g.scale(0.8, 1.15, 0.8); return g; })();
export function makeShard() {
  const g = new THREE.Group();
  const star = mesh(new THREE.ExtrudeGeometry(starShape(0.5, 0.22), { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffa800, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.25 }), g);
  star.geometry.center();
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 32), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  g.add(halo); g.userData = { star, halo };
  return g;
}
export function makeItem(k: "feather" | "star" | "heart") {
  const g = new THREE.Group();
  if (k === "feather") {
    const fm = new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffc93c, emissiveIntensity: 1.1, roughness: 0.4 });
    const f = mesh(new THREE.SphereGeometry(0.42, 18, 12), fm, g, [0, 0.5, 0]); f.scale.set(0.62, 1.3, 0.22); f.rotation.z = -0.45;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const barb = mesh(new THREE.SphereGeometry(0.16, 10, 8), fm, g, [s * 0.18 + 0.05 * i, 0.25 + i * 0.22, 0]); barb.scale.set(1.1, 0.45, 0.2); barb.rotation.z = -0.45 + s * 0.5; }
    const stem = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0), std(0xd6a640), g, [0.04, 0.45, 0.05]); stem.rotation.z = -0.45;
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 32), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); halo.position.y = 0.5; g.add(halo);
  } else if (k === "star") {
    const s = mesh(new THREE.ExtrudeGeometry(starShape(0.42, 0.2), { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff4dd8, emissiveIntensity: 1.2, roughness: 0.3 }), g);
    s.geometry.center(); s.position.y = 0.45; g.userData.rainbow = s.material;
    eyes(s, 0.05, 0.12, 0.09, 0.05);
  } else {
    const h = mesh(new THREE.ExtrudeGeometry(heartShape(0.7), { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xff3b6b, emissive: 0xff1a4d, emissiveIntensity: 0.6, roughness: 0.3 }), g);
    h.geometry.center(); h.position.y = 0.45;
  }
  return g;
}

// ── Props ──
export function makeCheckpoint() {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), std(0x7a4a24), g, [0, 1.1, -0.4]);
  mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), std(0x7a4a24), g, [0.2, 2.15, -0.4]);
  const lantern = new THREE.Group(); lantern.position.set(0.42, 1.8, -0.4); g.add(lantern);
  const frame = std(0x2d2a3a, 0.4, { metalness: 0.5 });
  mesh(new THREE.BoxGeometry(0.32, 0.06, 0.32), frame, lantern, [0, 0.2, 0]); mesh(new THREE.BoxGeometry(0.32, 0.06, 0.32), frame, lantern, [0, -0.2, 0]);
  const flameMat = new THREE.MeshStandardMaterial({ color: 0x6b6b80, emissive: 0x000000, emissiveIntensity: 0, transparent: true, opacity: 0.85, roughness: 0.2 });
  const glass = mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), flameMat, lantern);
  const flag = mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshStandardMaterial({ color: 0x8890a8, side: THREE.DoubleSide, roughness: 0.6 }), g, [-0.36, 1.85, -0.4]);
  g.userData = { lantern, glass, flameMat, flag, lit: false };
  return g;
}
export function makeGoal() {
  const g = new THREE.Group();
  const gold = std(0xffcf4a, 0.25, { metalness: 0.75 });
  for (const s of [-1, 1]) { mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.2, 12), std(0xf2ecdd, 0.5), g, [s * 2, 2.1, -0.3]); mesh(new THREE.SphereGeometry(0.34, 14, 10), gold, g, [s * 2, 4.35, -0.3]); }
  const ring = mesh(new THREE.TorusGeometry(1.75, 0.18, 14, 48), gold, g, [0, 2.4, -0.3]);
  const cv = document.createElement("canvas"); cv.width = cv.height = 256; const c = cv.getContext("2d")!;
  const gr = c.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, "#9ff3ff"); gr.addColorStop(0.75, "#7b5cff"); gr.addColorStop(1, "rgba(80,40,200,0)");
  c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 6; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(128, 128, 30 + i * 18, i, i + 2.4); c.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const portal = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide }));
  portal.position.set(0, 2.4, -0.32); g.add(portal);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: textTexture("SKY GATE", { w: 512, h: 128, bg: "#3b2a7a", fg: "#ffe9a3", font: "900 64px system-ui" }), transparent: true }));
  sign.position.set(0, 4.85, -0.25); g.add(sign);
  const light = new THREE.PointLight(0x9ff3ff, 6, 9, 2); light.position.set(0, 2.4, 0.6); g.add(light);
  g.userData = { ring, portal };
  return g;
}
export function makeSpring() {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.95, 0.15, 0.95), std(0x3c4252, 0.4, { metalness: 0.5 }), g, [0.5, 0.075, 0]);
  const coil = new THREE.Group(); coil.position.set(0.5, 0.15, 0); g.add(coil);
  for (let i = 0; i < 4; i++) { const t = mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 18), std(0xc9d1e0, 0.25, { metalness: 0.8 }), coil, [0, 0.08 + i * 0.11, 0]); t.rotation.x = Math.PI / 2; }
  const pad = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20), std(0xff4d5e, 0.4), g, [0.5, 0.65, 0]);
  g.userData = { coil, pad };
  return g;
}
export function makeMover(w: number, theme: string) {
  const g = new THREE.Group();
  const top = theme === "clouds" ? std(0xffffff, 0.9) : theme === "fortress" || theme === "storm" ? std(0x8a90a6, 0.4, { metalness: 0.5 }) : std(0xc48a52, 0.7);
  const deck = mesh(new THREE.BoxGeometry(w, 0.35, 2.2), top, g, [w / 2, 0.82, 0]); deck.receiveShadow = true;
  mesh(new THREE.BoxGeometry(w + 0.1, 0.1, 2.3), std(0xffd23f, 0.4), g, [w / 2, 0.62, 0]);
  const props: THREE.Object3D[] = [];
  for (const x of [0.5, w - 0.5]) {
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), std(0x3c4252), g, [x, 0.45, 0]);
    const p = new THREE.Group(); p.position.set(x, 0.3, 0); g.add(p); props.push(p);
    for (let i = 0; i < 2; i++) { const blade = mesh(new THREE.BoxGeometry(0.9, 0.03, 0.14), std(0xffffff, 0.4), p); blade.rotation.y = i * Math.PI / 2; }
  }
  g.userData = { props };
  return g;
}
export function makeSign(text: string) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.4, 8), std(0x7a4a24), g, [0, 0.7, -0.9]);
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.25, 0.1), [std(0x7a4a24), std(0x7a4a24), std(0x7a4a24), std(0x7a4a24), new THREE.MeshStandardMaterial({ map: textTexture(text), roughness: 0.8 }), std(0x7a4a24)]);
  board.position.set(0, 1.85, -0.9); board.castShadow = true; g.add(board);
  return g;
}

// ── Boss: the Storm King ──
export function makeBoss() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const cloud = std(0x4a4566, 0.85), cloudLight = std(0x6a6488, 0.85);
  for (const [x, y, z, r, m] of [[0, 1.2, 0, 1.2, cloud], [-1, 0.9, 0, 0.85, cloudLight], [1, 0.9, 0, 0.85, cloudLight], [-0.5, 1.9, -0.2, 0.75, cloudLight], [0.55, 1.9, -0.2, 0.7, cloud], [0, 0.55, 0.2, 0.8, cloud]] as const) mesh(new THREE.SphereGeometry(r, 18, 14), m, body, [x, y, z]);
  const eyeMat = glowMat(0xffe14a, 2);
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.22, 14, 10), eyeMat, body, [s * 0.38, 1.35, 1.05]); e.scale.set(1, 0.7, 0.5);
    const brow = mesh(new THREE.BoxGeometry(0.55, 0.12, 0.12), std(0x1a1628), body, [s * 0.38, 1.62, 1.08]); brow.rotation.z = s * -0.4;
  }
  const mouth = mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 16, Math.PI), std(0x1a1628), body, [0, 0.95, 1.1]); void mouth;
  const crown = new THREE.Group(); crown.position.set(0, 2.45, -0.1); body.add(crown);
  const gold = std(0xffcf4a, 0.25, { metalness: 0.8 });
  mesh(new THREE.CylinderGeometry(0.6, 0.65, 0.3, 16, 1, true), gold, crown);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; mesh(new THREE.ConeGeometry(0.12, 0.35, 6), gold, crown, [Math.cos(a) * 0.6, 0.3, Math.sin(a) * 0.6]); mesh(new THREE.SphereGeometry(0.07, 8, 6), glowMat([0xff4d6d, 0x4dd8ff, 0x7dff6b][i % 3], 1), crown, [Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.62]); }
  const hands: THREE.Mesh[] = [];
  for (const s of [-1, 1]) hands.push(mesh(new THREE.SphereGeometry(0.4, 12, 10), cloudLight, g, [s * 1.9, 1.1, 0.3]));
  const dizzy = new THREE.Group(); dizzy.position.set(0, 2.9, 0); g.add(dizzy); dizzy.visible = false;
  for (let i = 0; i < 4; i++) { const s = mesh(new THREE.ExtrudeGeometry(starShape(0.18, 0.08), { depth: 0.05, bevelEnabled: false }), glowMat(0xffe14a, 1.4), dizzy); const a = i / 4 * Math.PI * 2; s.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); }
  const mats: THREE.MeshStandardMaterial[] = []; g.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && !mats.includes(m)) mats.push(m); });
  g.userData = { body, crown, hands, dizzy, mats };
  return g;
}
