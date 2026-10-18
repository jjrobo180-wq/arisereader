// Reading Runner — characters, trains, cards and scenery, built from simple shapes with a soft "toy" look.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CAR_LEN, RAMP_LEN, TRAIN_H } from "@shared/runner/sim";
import type { ArchKind, PropKind, Thing, WorldLook } from "@shared/runner/missions";
import { bannerTexture, cardTexture, coinFaceTexture, glowTexture, rampTexture, stripeTexture, trainFrontTexture, trainSideTexture, type CardStyle } from "./textures";

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export const std = (color: number, rough = 0.55, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
  const key = color + "|" + rough + "|" + JSON.stringify(extra, (_k, v) => (v && typeof v === "object" && "isTexture" in v ? (v as THREE.Texture).uuid : v));
  let m = matCache.get(key); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); matCache.set(key, m); } return m;
};
export const glow = (color: number, i = 1.6) => std(color, 0.35, { emissive: color, emissiveIntensity: i });
export function mesh(g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], parent?: THREE.Object3D, pos?: [number, number, number], shadow = true) {
  const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = false; if (pos) o.position.set(...pos); if (parent) parent.add(o); return o;
}
const sph = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 6, 14);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const cyl = (a: number, b: number, h: number, s = 14) => new THREE.CylinderGeometry(a, b, h, s);
let glowTex: THREE.Texture | null = null;
export function glowSprite(color: number, size: number, opacity = 0.8) {
  if (!glowTex) glowTex = glowTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}

/** Merge every static mesh under root into one mesh per material (far fewer draw calls). Subtrees with userData.keep stay live. */
export function bakeStatic<T extends THREE.Object3D>(root: T): T {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; shadow: boolean }>();
  const remove: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o !== root && o.userData.keep) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !Array.isArray(m.material)) {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.clearGroups(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const b = buckets.get(m.material) || { geos: [], shadow: false }; b.geos.push(g); b.shadow ||= m.castShadow; buckets.set(m.material, b); remove.push(m);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  for (const m of remove) m.removeFromParent();
  for (const [mat, b] of buckets) {
    const merged = mergeGeometries(b.geos, false); for (const g of b.geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = b.shadow; root.add(mesh);
  }
  return root;
}

// ── Hero: Riley the runner ──
export type Limb = { root: THREE.Group; joint: THREE.Group };
export type HeroRig = {
  root: THREE.Group; body: THREE.Group; torso: THREE.Group; head: THREE.Group; pack: THREE.Group;
  armL: Limb; armR: Limb; legL: Limb; legR: Limb; mats: THREE.MeshStandardMaterial[]; shield: THREE.Mesh; magnet: THREE.Group;
};
export function makeHero(): HeroRig {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0b48a, roughness: 0.6 }), hoodie = new THREE.MeshStandardMaterial({ color: 0x18b8c9, roughness: 0.55 }),
    shorts = new THREE.MeshStandardMaterial({ color: 0x27325c, roughness: 0.6 }), shoe = new THREE.MeshStandardMaterial({ color: 0xff4f6d, roughness: 0.45 }), sole = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    capM = new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.5 }), hair = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.7 }), packM = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5 }),
    strap = new THREE.MeshStandardMaterial({ color: 0x2b2f45, roughness: 0.6 }), sock = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const mk = (x: number, y: number, z: number, parent: THREE.Object3D) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  // legs: hip → knee
  const leg = (x: number): Limb => {
    const r = mk(x, 0.8, 0, body);
    mesh(cap(0.1, 0.22), shorts, r, [0, -0.17, 0]);
    const knee = mk(0, -0.38, 0, r);
    mesh(cap(0.085, 0.24), skin, knee, [0, -0.17, 0]);
    mesh(cyl(0.09, 0.09, 0.08, 12), sock, knee, [0, -0.3, 0]);
    const s = mk(0, -0.38, 0.05, knee);
    const sh = mesh(sph(0.13, 14, 10), shoe, s, [0, 0.02, 0.02]); sh.scale.set(0.95, 0.72, 1.55);
    const so = mesh(sph(0.13, 14, 8), sole, s, [0, -0.05, 0.04]); so.scale.set(0.9, 0.26, 1.45);
    return { root: r, joint: knee };
  };
  const legL = leg(-0.15), legR = leg(0.15);
  // torso
  const torso = mk(0, 0.8, 0, body);
  const t = mesh(cap(0.28, 0.3), hoodie, torso, [0, 0.3, 0]); t.scale.set(1, 1, 0.82);
  mesh(cyl(0.29, 0.27, 0.12, 18), shorts, torso, [0, 0.0, 0]);
  const pocket = mesh(box(0.34, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x129aa8, roughness: 0.6 }), torso, [0, 0.2, 0.22]); void pocket;
  const hood = mesh(new THREE.TorusGeometry(0.2, 0.08, 10, 20), hoodie, torso, [0, 0.62, -0.06]); hood.rotation.x = Math.PI / 2 + 0.3;
  // backpack (what you mostly see while running)
  const pack = mk(0, 0.36, -0.26, torso);
  mesh(roundedBox(0.44, 0.48, 0.22, 0.08), packM, pack);
  const flap = mesh(roundedBox(0.4, 0.2, 0.08, 0.04), new THREE.MeshStandardMaterial({ color: 0xffb21a, roughness: 0.5 }), pack, [0, 0.1, -0.12]); void flap;
  mesh(roundedBox(0.3, 0.14, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.5 }), pack, [0, -0.12, -0.12]);
  const star = mesh(new THREE.ExtrudeGeometry(starShape(0.07, 0.03), { depth: 0.02, bevelEnabled: false }), glow(0x6ff3ff, 0.9), pack, [0.12, 0.12, -0.17]); star.rotation.y = Math.PI;
  for (const x of [-0.16, 0.16]) mesh(box(0.06, 0.5, 0.04), strap, torso, [x, 0.36, 0.2]);
  // arms: shoulder → elbow
  const arm = (x: number): Limb => {
    const r = mk(x, 0.52, 0, torso);
    mesh(cap(0.075, 0.18), hoodie, r, [0, -0.13, 0]);
    const elbow = mk(0, -0.3, 0, r);
    mesh(cap(0.068, 0.16), hoodie, elbow, [0, -0.1, 0]);
    mesh(cyl(0.075, 0.075, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x129aa8, roughness: 0.6 }), elbow, [0, -0.2, 0]);
    mesh(sph(0.075, 12, 10), skin, elbow, [0, -0.28, 0]);
    return { root: r, joint: elbow };
  };
  const armL = arm(-0.36), armR = arm(0.36);
  // head
  const head = mk(0, 1.62, 0, body);
  mesh(sph(0.32, 24, 18), skin, head);
  mesh(new THREE.SphereGeometry(0.335, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, head, [0, 0.03, -0.02]).scale.set(1, 0.9, 1);
  for (const s of [-1, 1]) mesh(sph(0.07, 10, 8), skin, head, [s * 0.31, -0.02, 0]);
  // cap worn backwards: the brim points at the camera while running
  const capTop = mesh(new THREE.SphereGeometry(0.345, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), capM, head, [0, 0.05, 0]); void capTop;
  const brim = mesh(cyl(0.2, 0.2, 0.035, 20), capM, head, [0, 0.12, -0.33]); brim.scale.set(1, 1, 1.3); brim.rotation.x = -0.18;
  mesh(sph(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), head, [0, 0.37, 0]);
  // face (seen when Riley turns around to cheer)
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }), pupil = new THREE.MeshStandardMaterial({ color: 0x1b1a2e, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const e = mesh(sph(0.075, 14, 10), white, head, [s * 0.11, 0.0, 0.27]); e.scale.set(0.85, 1.1, 0.55);
    mesh(sph(0.045, 10, 8), pupil, head, [s * 0.105, -0.01, 0.305]);
    mesh(sph(0.015, 6, 4), white, head, [s * 0.09, 0.015, 0.33]);
    const b = mesh(sph(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff8f8f, roughness: 0.8 }), head, [s * 0.2, -0.1, 0.25]); b.scale.set(1, 0.55, 0.4);
  }
  const smile = mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x7a2b2b }), head, [0, -0.12, 0.29]); smile.rotation.z = Math.PI;
  // power-up looks
  const shield = new THREE.Mesh(sph(1.15, 28, 20), new THREE.MeshStandardMaterial({ color: 0x7fe9ff, emissive: 0x2ab8ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false }));
  shield.position.y = 1.0; shield.visible = false; root.add(shield);
  const magnet = new THREE.Group(); magnet.position.set(0, 2.25, 0); magnet.visible = false; root.add(magnet);
  const mag = mesh(new THREE.TorusGeometry(0.16, 0.06, 10, 20, Math.PI), std(0xff3b4f, 0.4), magnet); mag.rotation.z = Math.PI;
  for (const s of [-1, 1]) mesh(cyl(0.06, 0.06, 0.1, 10), std(0xd8dee8, 0.25, { metalness: 0.8 }), magnet, [s * 0.16, -0.05, 0]);
  body.rotation.y = Math.PI; // face away from the camera (down the track)
  const mats: THREE.MeshStandardMaterial[] = [];
  root.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && m.isMeshStandardMaterial && !mats.includes(m) && o !== shield) mats.push(m); });
  return { root, body, torso, head, pack, armL, armR, legL, legR, mats, shield, magnet };
}

// ── Buddy the puppy: runs beside Riley ──
export type DogRig = { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Group[]; tail: THREE.Group; ears: THREE.Mesh[] };
export function makeDog(): DogRig {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const fur = std(0xe8923a, 0.7), cream = std(0xfff1dc, 0.7), dark = std(0x2a1d16, 0.4);
  const torso = mesh(cap(0.2, 0.42), fur, body, [0, 0.42, 0]); torso.rotation.x = Math.PI / 2;
  const belly = mesh(cap(0.16, 0.36), cream, body, [0, 0.36, 0.02]); belly.rotation.x = Math.PI / 2;
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.12, 0.26], [0.12, 0.26], [-0.12, -0.24], [0.12, -0.24]] as const) {
    const g = new THREE.Group(); g.position.set(x, 0.32, z); body.add(g); legs.push(g);
    mesh(cap(0.055, 0.14), fur, g, [0, -0.12, 0]); mesh(sph(0.065, 10, 8), cream, g, [0, -0.24, 0.02]);
  }
  const head = new THREE.Group(); head.position.set(0, 0.68, 0.36); body.add(head);
  mesh(sph(0.2, 18, 14), fur, head);
  const snout = mesh(sph(0.11, 14, 10), cream, head, [0, -0.05, 0.16]); snout.scale.set(1, 0.8, 1.2);
  mesh(sph(0.04, 8, 6), dark, head, [0, -0.01, 0.29]);
  for (const s of [-1, 1]) mesh(sph(0.035, 8, 6), dark, head, [s * 0.08, 0.05, 0.16]);
  const tongue = mesh(sph(0.04, 8, 6), std(0xff6b8a, 0.5), head, [0, -0.13, 0.2]); tongue.scale.set(1, 0.4, 1.4);
  const ears: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.08, 0.2, 8), fur, head, [s * 0.12, 0.2, -0.02]); e.rotation.z = s * -0.35; ears.push(e); }
  const collar = mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 16), std(0x2f7bff, 0.4), body, [0, 0.58, 0.28]); collar.rotation.x = Math.PI / 2 - 0.5;
  mesh(sph(0.04, 8, 6), std(0xffd23f, 0.3, { metalness: 0.6 }), body, [0, 0.5, 0.39]);
  const tail = new THREE.Group(); tail.position.set(0, 0.5, -0.32); body.add(tail);
  const tm = mesh(cap(0.04, 0.16), fur, tail, [0, 0.1, -0.04]); tm.rotation.x = -0.6;
  root.rotation.y = Math.PI;
  return { root, body, head, legs, tail, ears };
}

// ── Trains, ramps, barriers ──
const trainMats = new Map<string, { side: THREE.Material; front: THREE.Material; roof: THREE.Material; under: THREE.Material; plain: THREE.Material }>();
function trainMaterials(look: WorldLook) {
  let m = trainMats.get(look.key);
  if (!m) {
    const side = new THREE.MeshStandardMaterial({ map: trainSideTexture(look), roughness: 0.42, metalness: 0.15 });
    const front = new THREE.MeshStandardMaterial({ map: trainFrontTexture(look), roughness: 0.4, metalness: 0.15, emissive: look.night ? 0xffffff : 0x000000, emissiveMap: look.night ? trainFrontTexture(look) : null, emissiveIntensity: look.night ? 0.25 : 0 });
    m = { side, front, roof: std(look.train[2], 0.45, { metalness: 0.3 }), under: std(0x2a2d36, 0.7), plain: std(look.train[0], 0.45) };
    trainMats.set(look.key, m);
  }
  return m;
}
export function makeTrain(look: WorldLook, cars: number) {
  const g = new THREE.Group(); const m = trainMats.get(look.key) ?? trainMaterials(look);
  const bodyH = TRAIN_H - 0.25 - 0.3; // roof bulge brings the top to TRAIN_H
  const roofGeo = new THREE.CylinderGeometry(1.05, 1.05, CAR_LEN, 20, 1, true, Math.PI / 2, Math.PI); roofGeo.rotateX(Math.PI / 2); roofGeo.scale(1, 0.25 / 1.05, 1);
  for (let i = 0; i < cars; i++) {
    const z0 = -i * (CAR_LEN + 0.6), zc = z0 - CAR_LEN / 2;
    const b = mesh(box(2.1, bodyH, CAR_LEN), [m.side, m.side, m.roof, m.under, i === 0 ? m.front : m.plain, m.plain], g, [0, 0.3 + bodyH / 2, zc]); b.receiveShadow = true;
    mesh(roofGeo, m.roof, g, [0, 0.3 + bodyH, zc]);
    mesh(box(1.7, 0.4, CAR_LEN - 1), m.under, g, [0, 0.25, zc], false);
    for (const wz of [zc + CAR_LEN / 2 - 1.6, zc + CAR_LEN / 2 - 2.6, zc - CAR_LEN / 2 + 1.6, zc - CAR_LEN / 2 + 2.6]) for (const s of [-1, 1]) { const w = mesh(cyl(0.3, 0.3, 0.16, 16), std(0x1c1e24, 0.5, { metalness: 0.6 }), g, [s * 0.78, 0.3, wz], false); w.rotation.z = Math.PI / 2; }
    // roof vents
    for (const vz of [zc - 2.5, zc + 2.5]) mesh(roundedBox(0.9, 0.18, 1.4, 0.06), std(0x9aa3b5, 0.4, { metalness: 0.5 }), g, [0, TRAIN_H - 0.08, vz]);
    if (i > 0) mesh(box(1.2, 1.6, 0.7), m.under, g, [0, 1.5, z0 + 0.3]);
  }
  // front details
  mesh(roundedBox(2.0, 0.34, 0.3, 0.1), std(0x2a2d36, 0.5, { metalness: 0.5 }), g, [0, 0.55, 0.12]);
  for (const s of [-1, 1]) { mesh(cyl(0.16, 0.16, 0.08, 18), glow(0xfff2c4, 2.6), g, [s * 0.68, 0.98, 0.04]).rotation.x = Math.PI / 2; }
  mesh(box(0.8, 0.14, 0.06), glow(look.train[1], 1.4), g, [0, 2.75, 0.03]);
  return bakeStatic(g);
}
export function makeRamp(look: WorldLook) {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(RAMP_LEN, 0); sh.lineTo(RAMP_LEN, TRAIN_H - 0.02); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 2.0, bevelEnabled: false }); geo.rotateY(Math.PI / 2); geo.translate(-1.0, 0, 0);
  const solid = mesh(geo, std(0x4a505d, 0.6, { metalness: 0.4 }), g); solid.receiveShadow = true;
  const len = Math.hypot(RAMP_LEN, TRAIN_H), a = Math.atan2(TRAIN_H, RAMP_LEN);
  const top = mesh(new THREE.PlaneGeometry(2.04, len), new THREE.MeshStandardMaterial({ map: rampTexture(), roughness: 0.6 }), g, [0, TRAIN_H / 2 + 0.03, -RAMP_LEN / 2], false);
  top.rotation.x = -Math.PI / 2 + a; top.receiveShadow = true;
  for (const s of [-1, 1]) mesh(box(0.08, 0.08, len), std(look.train[1], 0.4), g, [s * 1.02, TRAIN_H / 2 + 0.06, -RAMP_LEN / 2]).rotation.x = a;
  return g;
}
const barrierBoards = new Map<string, THREE.Material>();
export function makeBarrier(look: WorldLook) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  let board = barrierBoards.get(look.key); if (!board) { board = new THREE.MeshStandardMaterial({ map: stripeTexture(look.barrier[0], look.barrier[1]), roughness: 0.5 }); barrierBoards.set(look.key, board); }
  const post = std(0xd8dee8, 0.35, { metalness: 0.6 }), foot = std(0x2a2d36, 0.6);
  for (const s of [-1, 1]) { mesh(box(0.12, 1.15, 0.12), post, body, [s * 0.9, 0.58, 0]); mesh(roundedBox(0.5, 0.12, 0.6, 0.04), foot, body, [s * 0.9, 0.06, 0]); }
  mesh(roundedBox(2.15, 0.34, 0.1, 0.04), board, body, [0, 0.95, 0]);
  mesh(roundedBox(2.15, 0.26, 0.1, 0.04), board, body, [0, 0.5, 0]);
  const lamp = mesh(sph(0.09, 12, 10), glow(0xff8a1f, 2.2), body, [-0.9, 1.22, 0]);
  g.userData = { body, lamp };
  return g;
}

// ── Collectibles ──
export const coinGeometry = (() => { const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.09, 30); geo.rotateX(Math.PI / 2); return geo; })();
let coinMatsCache: THREE.Material[] | null = null;
export function coinMaterials() {
  if (!coinMatsCache) { const face = new THREE.MeshStandardMaterial({ map: coinFaceTexture(), roughness: 0.25, metalness: 0.65, emissive: 0xffa800, emissiveIntensity: 0.28 }); coinMatsCache = [std(0xffb000, 0.25, { metalness: 0.8, emissive: 0xff9a00, emissiveIntensity: 0.25 }), face, face]; }
  return coinMatsCache;
}
export function makeCard(thing: Thing, style: CardStyle, target: boolean) {
  const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
  const tex = cardTexture(thing, style);
  const face = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const edge = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.4, transparent: true });
  const card = mesh(new THREE.BoxGeometry(1.95, 2.34, 0.07), [edge, edge, edge, edge, face, face], inner, [0, 0, 0]);
  const halo = glowSprite(target ? 0xffe066 : 0xffffff, 4.1, 0.45); halo.position.z = -0.12; inner.add(halo);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; g.add(shadow);
  g.userData = { inner, card, halo, shadow, face, edge, target };
  return g;
}
export function makePower(kind: "magnet" | "shield") {
  const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
  if (kind === "magnet") {
    const t = mesh(new THREE.TorusGeometry(0.34, 0.13, 14, 28, Math.PI), std(0xff3b4f, 0.35, { emissive: 0xff1a35, emissiveIntensity: 0.35 }), inner); t.rotation.z = Math.PI;
    for (const s of [-1, 1]) mesh(cyl(0.13, 0.13, 0.22, 16), std(0xe8eef6, 0.2, { metalness: 0.85 }), inner, [s * 0.34, 0.1, 0]);
  } else {
    mesh(sph(0.48, 24, 18), new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x2ab8ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.45, roughness: 0.05 }), inner);
    const s = mesh(new THREE.ExtrudeGeometry(starShape(0.26, 0.12), { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), glow(0xffe14a, 1.1), inner); s.geometry.center();
  }
  const h = glowSprite(kind === "magnet" ? 0xff7a8a : 0x7fe9ff, 2.4, 0.6); inner.add(h);
  g.userData = { inner };
  return g;
}
export function makeFinishGate() {
  const g = new THREE.Group();
  const white = std(0xffffff, 0.45), gold = std(0xffcf4a, 0.25, { metalness: 0.7 });
  for (const s of [-1, 1]) {
    mesh(cyl(0.32, 0.4, 7.2, 16), white, g, [s * 5.3, 3.6, 0]);
    for (let k = 0; k < 6; k++) mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 18), k % 2 ? gold : std(0xff4f6d, 0.4), g, [s * 5.3, 0.8 + k * 1.1, 0]).rotation.x = Math.PI / 2;
    for (let b = 0; b < 5; b++) {
      const col = [0xff4f6d, 0xffd23f, 0x4dc9ff, 0x7dff6b, 0xb98aff][b];
      const bl = mesh(sph(0.45, 18, 14), std(col, 0.25, { emissive: col, emissiveIntensity: 0.15 }), g, [s * 5.3 + (b - 2) * 0.35, 7.8 + Math.sin(b * 2) * 0.4, (b % 2) * 0.3]); bl.scale.y = 1.18;
    }
  }
  const banner = mesh(box(10.2, 1.6, 0.2), [white, white, white, white, new THREE.MeshStandardMaterial({ map: bannerTexture("FINISH!"), roughness: 0.6 }), white], g, [0, 6.4, 0]);
  void banner;
  const light = new THREE.PointLight(0xffe6a0, 8, 18, 1.6); light.position.set(0, 5.5, 2); g.add(light);
  return g;
}

// ── shapes ──
export function starShape(outer = 0.5, inner = 0.22, points = 5) {
  const sh = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) { const r = i % 2 ? inner : outer; const a = i / (points * 2) * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
  sh.closePath(); return sh;
}
const rbCache = new Map<string, THREE.BufferGeometry>();
export function roundedBox(w: number, h: number, d: number, r: number) {
  const key = [w, h, d, r].join(",");
  const hit = rbCache.get(key); if (hit) return hit;
  const sh = new THREE.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  const bev = Math.min(r * 0.6, d / 2 - 0.001);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - bev * 2), bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 4 });
  geo.center(); rbCache.set(key, geo); return geo;
}

// ── Scenery props (one builder per kind, randomized a little) ──
export function makeProp(kind: PropKind, look: WorldLook, rnd: () => number): THREE.Group {
  const g = new THREE.Group(); const r = (a: number, b: number) => a + rnd() * (b - a);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const night = look.night;
  switch (kind) {
    case "tower": case "school": {
      const w = r(4, 7), d = r(4, 7), h = kind === "school" ? r(5, 7) : r(8, 22);
      const col = kind === "school" ? pick([0xd8664a, 0xe0b26a, 0xc94f3a]) : night ? pick([0x2a2f5c, 0x3a2f6b, 0x1f2a4a]) : pick([0xf2c6a0, 0xa8d8f0, 0xf7e2a6, 0xd6b8f0, 0xbfe6c8, 0xf4a7a7]);
      mesh(box(w, h, d), std(col, 0.7), g, [0, h / 2, 0]).receiveShadow = true;
      const win = night ? glow(pick([0xffe68a, 0x7ff3ff, 0xff9ae0]), 1.3) : std(pick([0x8fc9f0, 0x9fd6f6, 0x7ab8e6]), 0.12, { metalness: 0.25, emissive: 0x2a5a8a, emissiveIntensity: 0.25 });
      const rows = Math.floor(h / 1.6), cols = Math.max(2, Math.floor(w / 1.3));
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!night || rnd() < 0.7) for (const sd of [-1, 1]) mesh(box(0.55, 0.7, 0.05), win, g, [-w / 2 + (x + 0.5) * (w / cols), 1.2 + y * 1.6, sd * (d / 2 + 0.02)], false);
      for (let y = 0; y < rows; y++) for (let z = 0; z < 2; z++) for (const sd of [-1, 1]) mesh(box(0.05, 0.7, 0.55), win, g, [sd * (w / 2 + 0.02), 1.2 + y * 1.6, -d / 4 + z * d / 2], false);
      mesh(box(w + 0.3, 0.3, d + 0.3), std(0xffffff, 0.6), g, [0, h + 0.15, 0]);
      if (kind === "school") { mesh(new THREE.ConeGeometry(1.2, 1.6, 4), std(0x8a3a2a, 0.6), g, [0, h + 1.1, 0]).rotation.y = Math.PI / 4; mesh(cyl(0.05, 0.05, 2.4), std(0xcccccc), g, [w / 2 - 0.5, h + 1.2, 0]); mesh(box(0.9, 0.55, 0.04), std(0x2f7bff), g, [w / 2 - 0.05, h + 2.0, 0]); }
      else if (rnd() < 0.5) mesh(cyl(0.6, 0.6, 1.2, 12), std(0x9aa3b5, 0.5), g, [r(-1, 1), h + 0.9, r(-1, 1)]);
      break;
    }
    case "shop": {
      const w = r(4, 5.5), h = r(3.4, 4.2), col = pick([0xffb3c7, 0xb3e5ff, 0xfff0a8, 0xc8f2b8]);
      mesh(box(w, h, 3.2), std(col, 0.7), g, [0, h / 2, 0]);
      const aw = mesh(box(w + 0.4, 0.18, 1.4), std(pick([0xff4f6d, 0x2f9bff, 0x27c26b]), 0.5), g, [0, h - 0.6, 1.9]); aw.rotation.x = 0.35;
      mesh(box(w * 0.7, 1.6, 0.06), std(0x9fd8ff, 0.1, { metalness: 0.3, emissive: night ? 0xffe0a0 : 0x000000, emissiveIntensity: night ? 0.8 : 0 }), g, [0, 1.3, 1.62]);
      break;
    }
    case "tree": case "bush": {
      const s = kind === "bush" ? r(0.6, 1) : r(0.9, 1.4);
      if (kind === "tree") mesh(cyl(0.18 * s, 0.26 * s, 2.2 * s, 8), std(0x7a4a28, 0.8), g, [0, 1.1 * s, 0]);
      const leaf = std(pick([0x4caf50, 0x5cc85a, 0x3f9a45, 0x7cd45a]), 0.75);
      for (const [x, y, z, rr] of [[0, 2.6, 0, 1.1], [0.6, 2.2, 0.2, 0.8], [-0.6, 2.3, -0.1, 0.85], [0.1, 3.2, 0.1, 0.75]] as const) mesh(sph(rr * s, 12, 10), leaf, g, [x * s, (kind === "bush" ? y - 2 : y) * s, z * s]);
      break;
    }
    case "pine": case "snowpine": {
      const s = r(0.9, 1.6);
      mesh(cyl(0.15 * s, 0.22 * s, 1.2 * s, 8), std(0x6a4426, 0.8), g, [0, 0.6 * s, 0]);
      for (let k = 0; k < 3; k++) {
        mesh(new THREE.ConeGeometry((1.5 - k * 0.38) * s, 1.7 * s, 10), std(kind === "snowpine" ? 0x2f7a55 : 0x2f8a4a, 0.8), g, [0, (1.6 + k * 1.0) * s, 0]);
        if (kind === "snowpine") mesh(new THREE.ConeGeometry((1.0 - k * 0.27) * s, 0.7 * s, 10), std(0xffffff, 0.9), g, [0, (2.2 + k * 1.0) * s, 0]);
      }
      break;
    }
    case "palm": {
      const s = r(1, 1.4); const lean = r(-0.25, 0.25);
      const trunk = new THREE.Group(); trunk.rotation.z = lean; g.add(trunk);
      for (let k = 0; k < 7; k++) mesh(cyl(0.2 * s, 0.24 * s, 0.75 * s, 8), std(k % 2 ? 0x9a6a3a : 0x8a5a2a, 0.8), trunk, [0, (0.35 + k * 0.7) * s, 0]);
      for (let k = 0; k < 7; k++) { const f = mesh(sph(0.5 * s, 10, 6), std(0x3fae4a, 0.7), trunk, [0, 5.0 * s, 0]); f.scale.set(0.35, 0.12, 2.6); f.rotation.y = k / 7 * Math.PI * 2; f.rotation.x = 0.35; f.position.add(new THREE.Vector3(Math.sin(f.rotation.y) * 1.1 * s, -0.25 * s, Math.cos(f.rotation.y) * 1.1 * s)); }
      for (let k = 0; k < 3; k++) mesh(sph(0.18 * s, 8, 6), std(0x6a4426, 0.6), trunk, [Math.cos(k * 2) * 0.25 * s, 4.75 * s, Math.sin(k * 2) * 0.25 * s]);
      break;
    }
    case "jungletree": {
      const s = r(1.2, 1.8);
      mesh(cyl(0.3 * s, 0.5 * s, 5 * s, 9), std(0x6a4a2a, 0.85), g, [0, 2.5 * s, 0]);
      for (let k = 0; k < 6; k++) mesh(sph(r(1.1, 1.6) * s, 12, 10), std(pick([0x2f8a3a, 0x3fa14a, 0x267a35]), 0.8), g, [r(-1.4, 1.4) * s, r(4.6, 6.2) * s, r(-1.4, 1.4) * s]);
      for (let k = 0; k < 3; k++) { const v = mesh(cyl(0.04, 0.04, r(2, 3.5) * s, 5), std(0x3a8a3a, 0.8), g, [r(-1.4, 1.4) * s, 3.6 * s, r(-1, 1) * s]); v.rotation.z = r(-0.1, 0.1); }
      break;
    }
    case "fern": { for (let k = 0; k < 7; k++) { const f = mesh(sph(0.5, 8, 6), std(0x3fa14a, 0.8), g, [0, 0.45, 0]); f.scale.set(0.3, 0.12, 1.8); f.rotation.y = k / 7 * Math.PI * 2; f.rotation.x = -0.5; f.position.set(Math.sin(f.rotation.y) * 0.6, 0.4, Math.cos(f.rotation.y) * 0.6); } break; }
    case "lamp": {
      mesh(cyl(0.08, 0.12, 4.2, 8), std(night ? 0x3a3f5a : 0x4a5568, 0.4, { metalness: 0.6 }), g, [0, 2.1, 0]);
      const arm = mesh(box(1.2, 0.1, 0.1), std(0x4a5568, 0.4, { metalness: 0.6 }), g, [-0.55, 4.15, 0]); void arm;
      mesh(sph(0.22, 12, 10), glow(night ? 0xffe6a0 : 0xfff6d8, night ? 2.6 : 0.8), g, [-1.1, 4.0, 0]);
      if (night) { const s = glowSprite(0xffd48a, 2.6, 0.55); s.position.set(-1.1, 4.0, 0); g.add(s); }
      break;
    }
    case "barn": {
      mesh(box(5, 3.6, 4.4), std(0xc8352f, 0.7), g, [0, 1.8, 0]);
      const roof = new THREE.Shape(); roof.moveTo(-2.8, 0); roof.lineTo(0, 1.9); roof.lineTo(2.8, 0); roof.closePath();
      const rg = new THREE.ExtrudeGeometry(roof, { depth: 4.8, bevelEnabled: false }); rg.translate(0, 0, -2.4);
      mesh(rg, std(0x5a3a2a, 0.7), g, [0, 3.6, 0]);
      mesh(box(1.8, 2.2, 0.08), std(0xffffff, 0.6), g, [0, 1.1, 2.22]); mesh(box(1.6, 0.12, 0.1), std(0xc8352f, 0.7), g, [0, 1.1, 2.26]).rotation.z = 0.9;
      break;
    }
    case "hay": { for (let k = 0; k < 3; k++) { const h = mesh(cyl(0.7, 0.7, 1.2, 16), std(0xf2c65a, 0.9), g, [k * 1.2 - 1.2, 0.7, r(-0.3, 0.3)]); h.rotation.z = Math.PI / 2; h.rotation.y = r(-0.3, 0.3); } break; }
    case "fence": { const m = std(0xf5ecd8, 0.7); for (let k = 0; k < 5; k++) mesh(box(0.14, 1.1, 0.14), m, g, [0, 0.55, k * 1.4 - 2.8]); for (const y of [0.45, 0.85]) mesh(box(0.08, 0.14, 6), m, g, [0, y, 0]); break; }
    case "windmill": {
      mesh(cyl(0.6, 1.2, 7, 8), std(0xf2ecdd, 0.6), g, [0, 3.5, 0]); mesh(new THREE.ConeGeometry(1.1, 1.4, 8), std(0xc8352f, 0.6), g, [0, 7.6, 0]);
      const hub = new THREE.Group(); hub.position.set(0, 6.5, 1.0); g.add(hub);
      for (let k = 0; k < 4; k++) { const b = mesh(box(0.5, 3.2, 0.08), std(0xffffff, 0.6), hub, [0, 1.6, 0]); const p = new THREE.Group(); p.rotation.z = k * Math.PI / 2; hub.add(p); p.add(b); }
      hub.userData.keep = true; g.userData.spin = hub; break;
    }
    case "umbrella": {
      mesh(cyl(0.05, 0.05, 2.6, 6), std(0xffffff), g, [0, 1.3, 0]);
      const top = mesh(new THREE.ConeGeometry(1.5, 0.6, 12, 1, true), std(pick([0xff4f6d, 0x2fb6ff, 0xffd23f]), 0.6, { side: THREE.DoubleSide }), g, [0, 2.6, 0]); void top;
      const towel = mesh(box(1, 0.04, 1.8), std(pick([0xff9ad0, 0x7fe0ff, 0xfff27a]), 0.8), g, [1.2, 0.03, 0]); void towel;
      break;
    }
    case "hut": { mesh(box(2.6, 2.2, 2.6), std(0xd9a66a, 0.8), g, [0, 1.1, 0]); mesh(new THREE.ConeGeometry(2.4, 1.6, 4), std(0xc9b26a, 0.9), g, [0, 3.0, 0]).rotation.y = Math.PI / 4; break; }
    case "rock": { const col = look.key === "snow" ? 0xb8c4d0 : look.key === "volcano" ? 0x3a2f30 : look.key === "space" ? 0x6a6aa0 : 0x8a8a90; for (let k = 0; k < 3; k++) { const m = mesh(new THREE.DodecahedronGeometry(r(0.5, 1.3), 0), std(col, 0.9), g, [r(-1, 1), 0.4, r(-1, 1)]); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); } break; }
    case "crystal": { const col = pick([0x7fe9ff, 0xb98aff, 0xff7ad9, 0x7dff9b]); for (let k = 0; k < 4; k++) { const c = mesh(new THREE.OctahedronGeometry(r(0.4, 0.9), 0), std(col, 0.15, { emissive: col, emissiveIntensity: 0.7, transparent: true, opacity: 0.9 }), g, [r(-0.8, 0.8), r(0.6, 1.4), r(-0.8, 0.8)]); c.scale.y = 1.8; c.rotation.z = r(-0.4, 0.4); } break; }
    case "planet": { const p = mesh(sph(r(1.2, 2), 24, 16), std(pick([0xff9a5a, 0x7fb8ff, 0xd08aff]), 0.6), g, [0, r(7, 11), 0]); const ring = mesh(new THREE.TorusGeometry(2.6, 0.12, 8, 40), std(0xfff0c0, 0.4), p); ring.rotation.x = 1.2; mesh(cyl(0.1, 0.1, 6, 6), std(0x6a72b8, 0.4, { metalness: 0.6 }), g, [0, 3, 0]); break; }
    case "antenna": { mesh(cyl(0.12, 0.3, 6, 8), std(0x9aa3c8, 0.4, { metalness: 0.7 }), g, [0, 3, 0]); const d = mesh(new THREE.SphereGeometry(0.85, 18, 10, 0, Math.PI * 2, 0, Math.PI / 3), std(0xdfe4ff, 0.35, { metalness: 0.2, side: THREE.DoubleSide, emissive: 0x6a72c8, emissiveIntensity: 0.35 }), g, [0, 6.2, 0]); d.rotation.x = 2.5; mesh(sph(0.15, 8, 6), glow(0xff4d6d, 2), g, [0, 6.4, 0.9]); break; }
    case "snowman": { mesh(sph(0.75, 16, 12), std(0xffffff, 0.9), g, [0, 0.7, 0]); mesh(sph(0.55, 16, 12), std(0xffffff, 0.9), g, [0, 1.75, 0]); mesh(sph(0.4, 16, 12), std(0xffffff, 0.9), g, [0, 2.55, 0]); const n = mesh(new THREE.ConeGeometry(0.08, 0.4, 8), std(0xff8a1f), g, [0, 2.55, 0.5]); n.rotation.x = Math.PI / 2; mesh(cyl(0.3, 0.3, 0.45, 14), std(0x222222), g, [0, 3.05, 0]); mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 18), std(0xff4f6d), g, [0, 2.2, 0]).rotation.x = Math.PI / 2; break; }
    case "bus": { mesh(roundedBox(2.4, 2.4, 6, 0.3), std(0xffc81e, 0.5), g, [0, 1.5, 0]); for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) mesh(box(0.04, 0.7, 0.8), std(0x2b3f66, 0.2), g, [sd * 1.21, 2.0, -2.2 + k * 1.1], false); for (const z of [-2, 2]) for (const sd of [-1, 1]) { const w = mesh(cyl(0.45, 0.45, 0.3, 14), std(0x1c1e24), g, [sd * 1.1, 0.45, z]); w.rotation.z = Math.PI / 2; } mesh(box(2.42, 0.18, 6.02), std(0x1a1a1a), g, [0, 1.2, 0]); break; }
    case "candycane": { const col = pick([0xff3f6d, 0x3fd06d, 0x3f8aff]); for (let k = 0; k < 9; k++) mesh(cyl(0.22, 0.22, 0.5, 12), std(k % 2 ? 0xffffff : col, 0.4), g, [0, 0.25 + k * 0.5, 0]); const hook = mesh(new THREE.TorusGeometry(0.6, 0.22, 10, 18, Math.PI), std(col, 0.4), g, [0.6, 4.5, 0]); void hook; break; }
    case "lolly": { mesh(cyl(0.09, 0.09, 4, 8), std(0xffffff, 0.5), g, [0, 2, 0]); const l = mesh(cyl(1.0, 1.0, 0.25, 28), std(pick([0xff5fae, 0x7fe0ff, 0xffe27a, 0xb98aff]), 0.3), g, [0, 4.6, 0]); l.rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(0.6, 0.08, 8, 24), std(0xffffff, 0.3), g, [0, 4.6, 0.14]); break; }
    case "cupcake": { mesh(cyl(1.0, 0.75, 1.2, 16), std(pick([0xff9ad0, 0x9fd8ff]), 0.6), g, [0, 0.6, 0]); mesh(sph(1.05, 16, 12), std(0xfff3f8, 0.7), g, [0, 1.4, 0]).scale.y = 0.7; mesh(sph(0.25, 10, 8), std(0xff2f4f, 0.3), g, [0, 2.2, 0]); break; }
    case "neon": { const col = pick([0xff3fb4, 0x37f3ff, 0xffe14a, 0x7dff6b]); mesh(cyl(0.08, 0.08, 5, 6), std(0x2a2f4a, 0.5), g, [0, 2.5, 0]); mesh(roundedBox(2.4, 1.3, 0.2, 0.15), std(0x15122e, 0.5), g, [0, 5, 0]); mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 24), glow(col, 2.4), g, [-0.5, 5, 0.12], false); mesh(box(0.9, 0.1, 0.06), glow(col, 2.4), g, [0.5, 5.3, 0.12], false); mesh(box(0.9, 0.1, 0.06), glow(col, 2.4), g, [0.5, 4.7, 0.12], false); break; }
    case "castle": { const stone = std(0xb8b0a4, 0.85); mesh(box(5, 5, 5), stone, g, [0, 2.5, 0]); for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) { mesh(cyl(1, 1, 7.5, 12), stone, g, [x, 3.75, z]); mesh(new THREE.ConeGeometry(1.25, 2.2, 12), std(pick([0x5a3ab8, 0x2f6bd8, 0xc8322f]), 0.6), g, [x, 8.6, z]); } for (let k = 0; k < 4; k++) mesh(box(0.8, 0.8, 0.8), stone, g, [-1.8 + k * 1.2, 5.4, 2.5]); break; }
    case "banner": { mesh(cyl(0.07, 0.07, 4.5, 8), std(0x7a4a24), g, [0, 2.25, 0]); const f = mesh(new THREE.PlaneGeometry(1.2, 1.8), std(pick([0xc8322f, 0x5a3ab8, 0x2f6bd8]), 0.6, { side: THREE.DoubleSide }), g, [0.62, 3.5, 0]); f.userData.keep = true; g.userData.flag = f; mesh(sph(0.12, 8, 6), std(0xffcf4a, 0.3, { metalness: 0.7 }), g, [0, 4.55, 0]); break; }
    case "coral": { const col = pick([0xff7a8a, 0xffa84a, 0xb98aff, 0xff5fae]); for (let k = 0; k < 6; k++) { const b = mesh(cap(0.16, r(0.8, 1.8)), std(col, 0.7), g, [r(-0.6, 0.6), 0.8, r(-0.6, 0.6)]); b.rotation.set(r(-0.5, 0.5), 0, r(-0.6, 0.6)); } mesh(sph(0.7, 12, 8), std(0xffd6a0, 0.9), g, [1.2, 0.3, 0]).scale.y = 0.5; break; }
    case "kelp": { for (let k = 0; k < 4; k++) { const st = new THREE.Group(); st.position.set(r(-0.6, 0.6), 0, r(-0.6, 0.6)); g.add(st); for (let s = 0; s < 6; s++) { const l = mesh(sph(0.25, 8, 6), std(0x3faa6a, 0.8), st, [Math.sin(s) * 0.15, 0.4 + s * 0.7, 0]); l.scale.set(0.6, 1.6, 0.3); } } g.userData.sway = true; g.userData.keep = true; break; }
    case "volcano": { mesh(new THREE.ConeGeometry(5, 7, 14, 1, true), std(0x3a2a2a, 0.9), g, [0, 3.5, 0]); mesh(cyl(1.3, 1.3, 0.2, 14), glow(0xff5a1a, 2.6), g, [0, 6.6, 0], false); const s = glowSprite(0xff7a2a, 7, 0.6); s.position.y = 7.2; g.add(s); break; }
    case "lava": { const p = mesh(new THREE.CircleGeometry(r(1.2, 2.2), 18), glow(0xff5a1a, 2.2), g, [0, 0.05, 0], false); p.rotation.x = -Math.PI / 2; break; }
    case "slide": { mesh(box(0.15, 3, 0.15), std(0x2f7bff, 0.5), g, [-0.8, 1.5, -1]); mesh(box(0.15, 3, 0.15), std(0x2f7bff, 0.5), g, [0.8, 1.5, -1]); mesh(box(1.8, 0.15, 1.6), std(0xffd23f, 0.5), g, [0, 3, -1]); const s = mesh(box(1.2, 0.1, 4), std(0xff4f6d, 0.4), g, [0, 1.6, 1.4]); s.rotation.x = 0.62; break; }
    case "swing": { const m = std(0x2fb36b, 0.5); for (const x of [-1.6, 1.6]) for (const z of [-0.6, 0.6]) { const l = mesh(cyl(0.07, 0.07, 3.2, 6), m, g, [x, 1.5, z]); l.rotation.x = z > 0 ? -0.2 : 0.2; } mesh(cyl(0.08, 0.08, 3.4, 6), m, g, [0, 3.0, 0]).rotation.z = Math.PI / 2; for (const x of [-0.7, 0.7]) { mesh(cyl(0.02, 0.02, 2, 4), std(0x888888), g, [x, 2.0, 0]); mesh(box(0.6, 0.06, 0.3), std(0xff8a1f), g, [x, 1.0, 0]); } break; }
    case "cactus": { const c = std(0x4f9a4a, 0.8); mesh(cap(0.35, 2.6), c, g, [0, 1.6, 0]); for (const s of [-1, 1]) { mesh(cap(0.2, 0.7), c, g, [s * 0.65, 1.8 + s * 0.3, 0]); mesh(cap(0.2, 0.3), c, g, [s * 0.4, 1.4 + s * 0.3, 0]).rotation.z = Math.PI / 2; } if (rnd() < 0.5) mesh(sph(0.15, 8, 6), std(0xff6b9a), g, [0, 3.2, 0]); break; }
    case "dune": { const d = mesh(sph(3, 16, 8), std(0xe0a855, 0.95), g, [0, -1.2, 0]); d.scale.set(1.6, 0.6, 1); break; }
    case "pillar": { const c = look.key === "arcade" ? 0x00f6ff : 0xe8d0a0; mesh(cyl(0.5, 0.6, 5, look.key === "arcade" ? 6 : 12), look.key === "arcade" ? glow(c, 1.2) : std(c, 0.8), g, [0, 2.5, 0]); mesh(box(1.4, 0.4, 1.4), std(look.key === "arcade" ? 0xff3fb4 : 0xd8c090, 0.6), g, [0, 5.2, 0]); break; }
    case "cube": { const col = pick([0xff3fb4, 0x00f6ff, 0xffe14a, 0x7dff6b, 0xb98aff]); for (let k = 0; k < 3; k++) { const s = r(0.8, 1.8); const c = mesh(box(s, s, s), std(0x15102a, 0.4, { emissive: col, emissiveIntensity: 0.55 }), g, [r(-1, 1), s / 2 + k * 1.4, r(-1, 1)]); c.rotation.y = rnd() * 3; } break; }
  }
  return g;
}

export function makeArch(kind: Exclude<ArchKind, null>, look: WorldLook) {
  const g = new THREE.Group();
  switch (kind) {
    case "gantry": {
      const m = std(0x5a6478, 0.45, { metalness: 0.6 });
      for (const s of [-1, 1]) mesh(box(0.35, 7.5, 0.35), m, g, [s * 5.6, 3.75, 0]);
      mesh(box(11.6, 0.45, 0.5), m, g, [0, 7.4, 0]); mesh(box(11.6, 0.15, 0.15), m, g, [0, 6.9, 0.2]);
      for (const x of [-2.6, 0, 2.6]) { mesh(roundedBox(0.7, 1.1, 0.4, 0.1), std(0x1c1e24, 0.5), g, [x, 6.55, 0.2]); mesh(sph(0.13, 10, 8), glow([0x4dff7a, 0xffd23f, 0x4dff7a][(x / 2.6 + 1) | 0], 2.4), g, [x, 6.75, 0.42], false); }
      break;
    }
    case "glass": {
      const t = mesh(new THREE.TorusGeometry(6.2, 0.22, 10, 40, Math.PI), std(0xbfeaff, 0.2, { metalness: 0.5 }), g, [0, 0, 0]); void t;
      const pane = mesh(new THREE.CylinderGeometry(6.1, 6.1, 4, 32, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.13, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }), g, [0, 0, -2], false);
      pane.rotation.x = Math.PI / 2;
      break;
    }
    case "stone": {
      const m = std(0xb8b0a4, 0.85);
      for (const s of [-1, 1]) mesh(box(1.2, 6, 1.4), m, g, [s * 5.8, 3, 0]);
      mesh(new THREE.TorusGeometry(5.8, 0.65, 8, 24, Math.PI), m, g, [0, 6, 0]);
      for (let k = 0; k < 7; k++) mesh(box(0.8, 0.8, 1.4), m, g, [-4.8 + k * 1.6, 12.1, 0]);
      break;
    }
    case "candy": {
      for (let k = 0; k < 14; k++) { const seg = mesh(new THREE.TorusGeometry(5.9, 0.4, 10, 6, Math.PI / 14), std(k % 2 ? 0xffffff : 0xff3f8e, 0.35), g, [0, 0.5, 0]); seg.rotation.z = (k / 14) * Math.PI; }
      break;
    }
    case "ring": { mesh(new THREE.TorusGeometry(6.4, 0.18, 10, 48), glow(look.rail, 2.2), g, [0, 2.4, 0], false); mesh(new THREE.TorusGeometry(6.8, 0.08, 8, 48), glow(0xff7ad9, 1.6), g, [0, 2.4, 0], false); break; }
    case "vine": {
      const wood = std(0x6a4a2a, 0.85);
      for (const s of [-1, 1]) mesh(cyl(0.3, 0.4, 7, 8), wood, g, [s * 5.8, 3.5, 0]);
      mesh(cyl(0.25, 0.25, 12, 8), wood, g, [0, 7, 0]).rotation.z = Math.PI / 2;
      for (let k = 0; k < 10; k++) { const x = -5 + k * 1.1, l = 0.8 + Math.abs(Math.sin(k * 1.7)) * 1.6; mesh(cyl(0.05, 0.05, l, 5), std(0x3f9a45, 0.8), g, [x, 7 - l / 2, 0.1]); mesh(sph(0.16, 8, 6), std([0xff6b9a, 0xffd23f, 0xffffff][k % 3], 0.6), g, [x, 7 - l, 0.1]); }
      break;
    }
    case "neon": {
      const c1 = glow(look.rail, 2.6), c2 = glow(0xff3fb4, 2.4);
      for (const s of [-1, 1]) { mesh(box(0.22, 7, 0.22), c1, g, [s * 5.7, 3.5, 0], false); mesh(box(0.12, 6.4, 0.12), c2, g, [s * 5.3, 3.2, 0], false); }
      mesh(box(11.6, 0.22, 0.22), c1, g, [0, 7, 0], false); mesh(box(10.6, 0.12, 0.12), c2, g, [0, 6.4, 0], false);
      break;
    }
  }
  return g;
}
