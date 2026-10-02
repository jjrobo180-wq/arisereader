// Prism Paintball — stylised paintball players with a procedural, foot-planted
// locomotion system (no sliding): the gait phase advances with distance
// travelled, planted feet stay fixed on the ground and legs/arms are solved
// with two-bone IK.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WEAPONS, clamp, wrapAngle } from "@shared/paintball";
import { jerseyTexture, nameTagTexture } from "./textures";

// ---------------------------------------------------------------------------
// Shared materials
// ---------------------------------------------------------------------------

let shared: {
  matte: THREE.MeshStandardMaterial;
  gloss: THREE.MeshStandardMaterial;
  lens: THREE.MeshPhysicalMaterial[];
  hopper: THREE.MeshPhysicalMaterial[];
  paint: THREE.MeshStandardMaterial[];
  blob: THREE.Texture;
  blobMat: THREE.MeshBasicMaterial;
  blobGeo: THREE.PlaneGeometry;
  paintGeo: THREE.SphereGeometry;
  bubbleMat: THREE.ShaderMaterial[];
  bubbleGeo: THREE.SphereGeometry;
} | null = null;

function sharedMats() {
  if (shared) return shared;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(0.55, "rgba(0,0,0,0.25)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const blob = new THREE.CanvasTexture(c);
  const bubble = (color: number) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float time; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float band = 0.5 + 0.5 * sin(vP.y * 14.0 - time * 5.0);
        gl_FragColor = vec4(color * (f * 1.4 + band * 0.08), f * 0.85 + 0.05); }`,
  });
  shared = {
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 }),
    gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.18 }),
    lens: [0x22d3ee, 0xf0479a].map((c) => new THREE.MeshPhysicalMaterial({ color: 0x0b1220, roughness: 0.06, metalness: 0.6, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 700], emissive: c, emissiveIntensity: 0.12 })),
    hopper: [0x22d3ee, 0xf0479a].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1 })),
    paint: [0x22d3ee, 0xf0479a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.22, metalness: 0, emissive: c, emissiveIntensity: 0.12 })),
    blob,
    blobMat: new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, toneMapped: false }),
    blobGeo: new THREE.PlaneGeometry(1.15, 1.15),
    paintGeo: new THREE.SphereGeometry(0.06, 8, 6),
    bubbleMat: [bubble(0x22d3ee), bubble(0xf0479a)],
    bubbleGeo: new THREE.SphereGeometry(1.05, 28, 18),
  };
  shared.blobGeo.rotateX(-Math.PI / 2);
  return shared;
}

// ---------------------------------------------------------------------------
// Geometry helpers (vertex coloured parts merged per bone)
// ---------------------------------------------------------------------------

type Part = { geo: THREE.BufferGeometry; color: number; gloss?: boolean };

function colorize(geo: THREE.BufferGeometry, color: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  const n = g.getAttribute("position").count;
  const c = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Tapered capsule hanging down from the origin along -Y. */
function limb(r1: number, r2: number, len: number, seg = 14) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(a) * r2, -len - Math.cos(a) * r2 * 0.9)); }
  for (let i = 1; i < 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(r2 + (r1 - r2) * t + Math.sin(t * Math.PI) * (r1 * 0.12), -len + len * t)); }
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r1, Math.sin(a) * r1 * 0.9)); }
  pts[0].x = 0.0001; pts[pts.length - 1].x = 0.0001;
  return new THREE.LatheGeometry(pts, seg);
}

function rbox(w: number, h: number, d: number, r: number, seg = 2) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)); }

function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  geo.applyMatrix4(m);
  return geo;
}

function buildMeshes(bone: THREE.Object3D, parts: Part[], castShadow: boolean) {
  const S = sharedMats();
  for (const gloss of [false, true]) {
    const list = parts.filter((p) => !!p.gloss === gloss).map((p) => colorize(p.geo, p.color));
    if (!list.length) continue;
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, gloss ? S.gloss : S.matte);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    bone.add(mesh);
  }
}

// ---------------------------------------------------------------------------
// Markers (guns)
// ---------------------------------------------------------------------------

export interface GunModel { group: THREE.Group; gripR: THREE.Vector3; gripL: THREE.Vector3; hopperL: THREE.Vector3; muzzle: THREE.Vector3; pump: THREE.Object3D | null }

const gunCache = new Map<string, { geo: THREE.BufferGeometry; hopper: THREE.BufferGeometry | null; pumpGeo: THREE.BufferGeometry | null }>();

export function buildGun(weapon: number, team: number, castShadow: boolean): GunModel {
  const key = weapon + ":" + team;
  const accent = team === 0 ? 0x22d3ee : 0xf0479a;
  const body = 0x1d2430, dark = 0x0d1117, metal = 0x9aa5b1, white = 0xe9eef5;
  let entry = gunCache.get(key);
  const W = weapon;
  if (!entry) {
    const parts: Part[] = [];
    let hopper: THREE.BufferGeometry | null = null, pumpGeo: THREE.BufferGeometry | null = null;
    if (W === 0) {
      parts.push({ geo: at(rbox(0.065, 0.11, 0.32, 0.02), 0, 0, 0.1), color: body, gloss: true });
      parts.push({ geo: at(rbox(0.07, 0.03, 0.3, 0.012), 0, 0.06, 0.1), color: accent, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 12), 0, 0.015, 0.48, Math.PI / 2), color: dark, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 12), 0, 0.015, 0.7, Math.PI / 2), color: accent, gloss: true });
      parts.push({ geo: at(rbox(0.04, 0.11, 0.05, 0.012), 0, -0.1, 0.38, 0.15), color: dark, gloss: true });
      parts.push({ geo: at(rbox(0.04, 0.12, 0.055, 0.014), 0, -0.1, 0.05, -0.25), color: dark, gloss: true });
      parts.push({ geo: at(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), 0, -0.06, 0.12, 0, Math.PI / 2, Math.PI), color: dark, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.046, 0.046, 0.3, 14), 0, -0.01, -0.21, Math.PI / 2), color: white, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), 0, -0.01, -0.06, Math.PI / 2), color: metal, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.022, 0.026, 0.06, 10), 0, 0.085, 0.13), color: dark, gloss: true });
      for (let i = 0; i < 7; i++) parts.push({ geo: at(new THREE.SphereGeometry(0.022, 8, 6), ((i % 3) - 1) * 0.04, 0.15 + Math.floor(i / 3) * 0.035, 0.1 + ((i * 37) % 5 - 2) * 0.02), color: accent });
      hopper = at(new THREE.SphereGeometry(1, 18, 12), 0, 0.165, 0.11, 0, 0, 0, 0.085, 0.07, 0.13);
    } else if (W === 1) {
      parts.push({ geo: at(rbox(0.075, 0.12, 0.3, 0.022), 0, 0, 0.08), color: body, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.03, 0.034, 0.36, 14), 0, 0.02, 0.4, Math.PI / 2), color: dark, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.045, 0.04, 0.06, 14), 0, 0.02, 0.6, Math.PI / 2), color: accent, gloss: true });
      parts.push({ geo: at(rbox(0.04, 0.12, 0.055, 0.014), 0, -0.1, 0.04, -0.25), color: dark, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 14), 0, -0.005, -0.18, Math.PI / 2), color: accent, gloss: true });
      parts.push({ geo: at(rbox(0.08, 0.05, 0.08, 0.02), 0, -0.01, -0.33), color: dark, gloss: true });
      for (let i = 0; i < 5; i++) parts.push({ geo: at(new THREE.SphereGeometry(0.024, 8, 6), ((i % 2) - 0.5) * 0.04, 0.14 + Math.floor(i / 2) * 0.03, 0.06), color: accent });
      hopper = at(new THREE.SphereGeometry(1, 16, 10), 0, 0.15, 0.07, 0, 0, 0, 0.07, 0.06, 0.1);
      pumpGeo = colorize(at(rbox(0.07, 0.07, 0.14, 0.025), 0, 0, 0), dark);
    } else {
      parts.push({ geo: at(rbox(0.06, 0.1, 0.36, 0.018), 0, 0, 0.12), color: body, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.017, 0.017, 0.7, 12), 0, 0.015, 0.65, Math.PI / 2), color: dark, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.024, 0.024, 0.08, 12), 0, 0.015, 1.0, Math.PI / 2), color: accent, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 14), 0, 0.105, 0.16, Math.PI / 2), color: dark, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.036, 0.03, 0.04, 14), 0, 0.105, 0.3, Math.PI / 2), color: accent, gloss: true });
      parts.push({ geo: at(rbox(0.02, 0.05, 0.02, 0.006), 0, 0.07, 0.12), color: dark, gloss: true });
      parts.push({ geo: at(rbox(0.04, 0.12, 0.055, 0.014), 0, -0.1, 0.05, -0.25), color: dark, gloss: true });
      parts.push({ geo: at(rbox(0.04, 0.09, 0.05, 0.012), 0, -0.09, 0.44, 0.1), color: dark, gloss: true });
      parts.push({ geo: at(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 14), 0, -0.01, -0.25, Math.PI / 2), color: white, gloss: true });
      parts.push({ geo: at(rbox(0.1, 0.12, 0.05, 0.02), 0, -0.02, -0.44), color: accent, gloss: true });
      for (let i = 0; i < 4; i++) parts.push({ geo: at(new THREE.SphereGeometry(0.02, 8, 6), -0.07, 0.07 + i * 0.012, 0.06 + i * 0.02), color: accent });
      hopper = at(new THREE.SphereGeometry(1, 14, 10), -0.075, 0.08, 0.08, 0, 0, 0, 0.045, 0.05, 0.07);
    }
    const list = parts.map((p) => colorize(p.geo, p.color));
    const geo = mergeGeometries(list) as THREE.BufferGeometry;
    list.forEach((g) => g.dispose());
    entry = { geo, hopper, pumpGeo };
    gunCache.set(key, entry);
  }
  const S = sharedMats();
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(entry.geo, S.gloss);
  mesh.castShadow = castShadow;
  group.add(mesh);
  if (entry.hopper) { const h = new THREE.Mesh(entry.hopper, S.hopper[team]); group.add(h); }
  let pump: THREE.Object3D | null = null;
  if (entry.pumpGeo) {
    pump = new THREE.Mesh(entry.pumpGeo, S.gloss);
    pump.position.set(0, -0.005, 0.38);
    (pump as THREE.Mesh).castShadow = castShadow;
    group.add(pump);
  }
  const grips: Record<number, [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]> = {
    0: [new THREE.Vector3(0, -0.1, 0.05), new THREE.Vector3(0, -0.11, 0.38), new THREE.Vector3(0.02, 0.19, 0.1), new THREE.Vector3(0, 0.015, 0.76)],
    1: [new THREE.Vector3(0, -0.1, 0.04), new THREE.Vector3(0, -0.04, 0.38), new THREE.Vector3(0.02, 0.17, 0.07), new THREE.Vector3(0, 0.02, 0.64)],
    2: [new THREE.Vector3(0, -0.1, 0.05), new THREE.Vector3(0, -0.1, 0.44), new THREE.Vector3(-0.06, 0.1, 0.08), new THREE.Vector3(0, 0.015, 1.05)],
  };
  const g = grips[W] || grips[0];
  return { group, gripR: g[0].clone(), gripL: g[1].clone(), hopperL: g[2].clone(), muzzle: g[3].clone(), pump };
}

// ---------------------------------------------------------------------------
// IK
// ---------------------------------------------------------------------------

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

/** World quaternion whose local -Y points along `down` and local +Z leans toward `front`. */
function basisQuat(down: THREE.Vector3, front: THREE.Vector3, out: THREE.Quaternion) {
  const y = _c.copy(down).negate().normalize();
  const z = _d.copy(front).addScaledVector(y, -front.dot(y));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
  z.normalize();
  const x = _e.crossVectors(y, z).normalize();
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

/**
 * Two-bone IK. `upper` and `lower` are bones whose child offset points along local -Y.
 * Sets their local quaternions so the end of `lower` reaches `target`, bending toward `pole`.
 */
function solveTwoBone(upper: THREE.Object3D, lower: THREE.Object3D, lenA: number, lenB: number, target: THREE.Vector3, pole: THREE.Vector3) {
  const parent = upper.parent!;
  parent.updateWorldMatrix(true, false);
  const a = upper.getWorldPosition(_a);
  const toT = _b.copy(target).sub(a);
  const dist = clamp(toT.length(), 0.02, (lenA + lenB) * 0.999);
  toT.normalize();
  const cosA = clamp((lenA * lenA + dist * dist - lenB * lenB) / (2 * lenA * dist), -1, 1);
  const angA = Math.acos(cosA);
  const bend = new THREE.Vector3().copy(pole).sub(a);
  bend.addScaledVector(toT, -bend.dot(toT));
  if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1);
  bend.normalize();
  const elbowDir = new THREE.Vector3().copy(toT).multiplyScalar(Math.cos(angA)).addScaledVector(bend, Math.sin(angA));
  const elbow = new THREE.Vector3().copy(a).addScaledVector(elbowDir, lenA);
  const endPos = new THREE.Vector3().copy(a).addScaledVector(toT, dist);
  const lowerDir = endPos.sub(elbow).normalize();
  // upper world rotation
  basisQuat(elbowDir, bend, _q1);
  parent.getWorldQuaternion(_q2);
  upper.quaternion.copy(_q2).invert().multiply(_q1);
  // lower world rotation (relative to the new upper)
  basisQuat(lowerDir, bend, _q3);
  lower.quaternion.copy(_q1).invert().multiply(_q3);
}

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

export interface AnimInput {
  vx: number; vz: number; vy: number;
  aimYaw: number; aimPitch: number;
  grounded: boolean; crouch: boolean; ads: boolean; sprint: boolean; reloading: boolean;
  alive: boolean; protected: boolean;
  weapon: number;
}

const SKIN = [0xf1c7a4, 0xe2ae88, 0xc98d62, 0xa06c45, 0x74503a, 0x4e3527];
const HAIR = [0x2b1b12, 0x5a3a1e, 0xc89b52, 0x151515, 0x8a3b1d, 0xe7d3a1];
const THIGH = 0.44, SHIN = 0.43, ANKLE = 0.085, UPPER = 0.29, FORE = 0.27;

export class Character {
  readonly root = new THREE.Group();
  readonly team: number;
  private pelvis = new THREE.Group();
  private spine = new THREE.Group();
  private chest = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private legs: { hip: THREE.Group; thigh: THREE.Group; shin: THREE.Group; foot: THREE.Group; side: number }[] = [];
  private arms: { shoulder: THREE.Group; upper: THREE.Group; fore: THREE.Group; hand: THREE.Group; side: number }[] = [];
  private gunPivot = new THREE.Group();
  private gun: GunModel | null = null;
  private gunWeapon = -1;
  private tag: THREE.Sprite | null = null;
  private tagMat: THREE.SpriteMaterial | null = null;
  private bubble: THREE.Mesh;
  private shadowBlob: THREE.Mesh;
  private jerseyMat: THREE.MeshStandardMaterial;
  private paintBlobs: THREE.Mesh[] = [];
  private castShadow: boolean;

  // animation state
  private phase = 0;
  private moveBlend = 0;
  private runBlend = 0;
  private crouchBlend = 0;
  private adsBlend = 0;
  private sprintBlend = 0;
  private airBlend = 0;
  private land = 0;
  private recoil = 0;
  private reloadT = 0;
  private reloadBlend = 0;
  private switchT = 1;
  private pendingWeapon = 0;
  private pelvisYaw = 0;
  private lastYaw = 0;
  private turnStep = 0;
  private deathT = -1;
  private spawnT = 1;
  private moveDir = new THREE.Vector2(0, 1);
  private wasGrounded = true;
  private lastStance = [true, true];
  private time = Math.random() * 10;
  private lastVy = 0;
  onStep: ((x: number, y: number, z: number, loud: number) => void) | null = null;
  onLand: ((x: number, y: number, z: number) => void) | null = null;
  /** World position of the muzzle after the last update. */
  readonly muzzleWorld = new THREE.Vector3();

  constructor(opts: { team: number; look: number; name: string; number: number; showTag: boolean; isMate: boolean; castShadow: boolean }) {
    this.team = opts.team;
    this.castShadow = opts.castShadow;
    const S = sharedMats();
    const look = Math.abs(opts.look | 0);
    const skin = SKIN[look % SKIN.length];
    const hair = HAIR[Math.floor(look / 7) % HAIR.length];
    const style = Math.floor(look / 3) % 5;
    const team = opts.team;
    const jersey = team === 0 ? 0x12b5d6 : 0xe23a8f;
    const jerseyDark = team === 0 ? 0x0b5f86 : 0x8f1652;
    const accent = team === 0 ? 0x67e8f9 : 0xf9a8d4;
    const pants = 0x2a3140, pantsDark = 0x1b202b, gear = 0x14181f, glove = 0x23272f;

    this.jerseyMat = new THREE.MeshStandardMaterial({ map: jerseyTexture(team, opts.number), roughness: 0.72, metalness: 0 });

    const R = this.root;
    R.add(this.pelvis);
    this.pelvis.position.y = 0.93;
    this.pelvis.add(this.spine);
    this.spine.position.y = 0.08;
    this.spine.add(this.chest);
    this.chest.position.y = 0.25;
    this.chest.add(this.neck);
    this.neck.position.y = 0.27;
    this.neck.add(this.head);
    this.head.position.y = 0.1;
    this.chest.add(this.gunPivot);

    // ---- pelvis: shorts, belt, pod pack ----
    const hipPts = [new THREE.Vector2(0.0001, -0.13), new THREE.Vector2(0.13, -0.12), new THREE.Vector2(0.168, -0.05), new THREE.Vector2(0.17, 0.05), new THREE.Vector2(0.158, 0.12), new THREE.Vector2(0.0001, 0.12)];
    buildMeshes(this.pelvis, [
      { geo: at(new THREE.LatheGeometry(hipPts, 16), 0, 0, 0, 0, 0, 0, 1, 1, 0.78), color: pants },
      { geo: at(new THREE.CylinderGeometry(0.168, 0.168, 0.045, 18, 1, true), 0, 0.09, 0, 0, 0, 0, 1, 1, 0.8), color: gear, gloss: true },
      { geo: at(rbox(0.06, 0.05, 0.02, 0.01), 0, 0.09, 0.14), color: 0xb8c2cc, gloss: true },
      { geo: at(rbox(0.07, 0.09, 0.06, 0.015), 0.15, 0.04, 0.02, 0, 0.3), color: jerseyDark },
      { geo: at(rbox(0.07, 0.09, 0.06, 0.015), -0.15, 0.04, 0.02, 0, -0.3), color: jerseyDark },
      { geo: at(rbox(0.26, 0.1, 0.06, 0.02), 0, 0.05, -0.15), color: gear, gloss: true },
      ...[-0.07, 0, 0.07].map((x) => ({ geo: at(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), x, 0.16, -0.18), color: 0x2f3542, gloss: true })),
      ...[-0.07, 0, 0.07].map((x) => ({ geo: at(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), x, 0.27, -0.18), color: accent, gloss: true })),
    ], this.castShadow);

    // ---- abdomen (spine) and chest with jersey texture ----
    const abdomen = new THREE.LatheGeometry([new THREE.Vector2(0.0001, -0.06), new THREE.Vector2(0.15, -0.06), new THREE.Vector2(0.158, 0.05), new THREE.Vector2(0.168, 0.16), new THREE.Vector2(0.172, 0.26), new THREE.Vector2(0.0001, 0.26)], 20, Math.PI / 2);
    remapV(abdomen, 0, 0.42);
    at(abdomen, 0, 0, 0, 0, 0, 0, 1, 1, 0.72);
    const abMesh = new THREE.Mesh(abdomen, this.jerseyMat);
    abMesh.castShadow = this.castShadow; abMesh.receiveShadow = true;
    this.spine.add(abMesh);
    const chestG = new THREE.LatheGeometry([new THREE.Vector2(0.0001, -0.05), new THREE.Vector2(0.172, -0.05), new THREE.Vector2(0.19, 0.06), new THREE.Vector2(0.205, 0.15), new THREE.Vector2(0.195, 0.22), new THREE.Vector2(0.15, 0.27), new THREE.Vector2(0.07, 0.3), new THREE.Vector2(0.0001, 0.3)], 22, Math.PI / 2);
    remapV(chestG, 0.38, 1);
    at(chestG, 0, 0, 0, 0, 0, 0, 1.06, 1, 0.7);
    const chMesh = new THREE.Mesh(chestG, this.jerseyMat);
    chMesh.castShadow = this.castShadow; chMesh.receiveShadow = true;
    this.chest.add(chMesh);
    buildMeshes(this.chest, [
      // harness straps
      { geo: at(rbox(0.045, 0.34, 0.03, 0.01), 0.09, 0.1, 0.13, -0.1), color: gear, gloss: true },
      { geo: at(rbox(0.045, 0.34, 0.03, 0.01), -0.09, 0.1, 0.13, -0.1), color: gear, gloss: true },
      { geo: at(rbox(0.045, 0.32, 0.03, 0.01), 0.09, 0.1, -0.13, 0.1), color: gear, gloss: true },
      { geo: at(rbox(0.045, 0.32, 0.03, 0.01), -0.09, 0.1, -0.13, 0.1), color: gear, gloss: true },
      { geo: at(new THREE.TorusGeometry(0.075, 0.018, 8, 18), 0, 0.28, 0, Math.PI / 2), color: jerseyDark },
    ], this.castShadow);

    // ---- neck & head ----
    buildMeshes(this.neck, [{ geo: at(new THREE.CylinderGeometry(0.052, 0.058, 0.12, 12), 0, 0.03, 0), color: skin }], this.castShadow);
    const headParts: Part[] = [
      { geo: at(new THREE.SphereGeometry(0.118, 22, 16), 0, 0.04, 0, 0, 0, 0, 0.94, 1.05, 1), color: skin },
      // goggle backing
      { geo: at(new THREE.CylinderGeometry(0.124, 0.124, 0.085, 22, 1, true, -1.35, 2.7), 0, 0.06, 0.004), color: gear, gloss: true },
      // goggle rims
      { geo: at(new THREE.TorusGeometry(0.131, 0.012, 6, 22, 2.75), 0, 0.104, 0.004, Math.PI / 2, 0, Math.PI / 2 + 1.375 + Math.PI), color: gear, gloss: true },
      { geo: at(new THREE.TorusGeometry(0.131, 0.012, 6, 22, 2.75), 0, 0.016, 0.004, Math.PI / 2, 0, Math.PI / 2 + 1.375 + Math.PI), color: gear, gloss: true },
      // lower mask
      { geo: at(new THREE.SphereGeometry(0.124, 20, 10, Math.PI / 2 - 1.15, 2.3, 1.62, 0.95), 0, 0.04, 0.012, 0, 0, 0, 1, 1, 1.12), color: jerseyDark, gloss: true },
      ...[-0.03, 0, 0.03].map((x) => ({ geo: at(rbox(0.016, 0.05, 0.02, 0.006), x, -0.035, 0.132), color: gear, gloss: true })),
      // ear pieces
      { geo: at(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14), 0.118, 0.05, 0, 0, 0, Math.PI / 2), color: gear, gloss: true },
      { geo: at(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14), -0.118, 0.05, 0, 0, 0, Math.PI / 2), color: gear, gloss: true },
      { geo: at(new THREE.CylinderGeometry(0.022, 0.022, 0.034, 10), 0.12, 0.05, 0, 0, 0, Math.PI / 2), color: accent, gloss: true },
      { geo: at(new THREE.CylinderGeometry(0.022, 0.022, 0.034, 10), -0.12, 0.05, 0, 0, 0, Math.PI / 2), color: accent, gloss: true },
      // strap
      { geo: at(new THREE.TorusGeometry(0.122, 0.011, 6, 26), 0, 0.07, -0.01, Math.PI / 2 - 0.12), color: accent },
    ];
    // headwear / hair variety
    if (style === 0) {
      headParts.push({ geo: at(new THREE.SphereGeometry(0.128, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.085, -0.008, -0.12, 0, 0, 1, 1.1, 1.04), color: accent });
      headParts.push({ geo: at(new THREE.TorusGeometry(0.124, 0.022, 8, 22), 0, 0.1, -0.01, Math.PI / 2 - 0.12), color: jerseyDark });
      headParts.push({ geo: at(new THREE.SphereGeometry(0.04, 10, 8), 0, 0.235, -0.04), color: 0xffffff });
    } else if (style === 1) {
      headParts.push({ geo: at(new THREE.SphereGeometry(0.126, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.09, -0.005, -0.08, 0, 0, 1, 0.95, 1.04), color: jerseyDark });
      headParts.push({ geo: at(new THREE.CylinderGeometry(0.1, 0.1, 0.014, 18, 1, false, Math.PI - 1, 2), 0, 0.1, -0.06, -0.1), color: jerseyDark });
      headParts.push({ geo: at(new THREE.SphereGeometry(0.018, 8, 6), 0, 0.215, 0), color: accent });
    } else if (style === 2) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 1.4 - 0.7 * Math.PI + Math.PI;
        headParts.push({ geo: at(new THREE.ConeGeometry(0.045, 0.13, 7), Math.sin(a) * 0.07, 0.17 + Math.cos(i) * 0.01, Math.cos(a) * 0.07 - 0.02, -0.5 + Math.cos(a) * 0.4, 0, Math.sin(a) * 0.6), color: hair });
      }
      headParts.push({ geo: at(new THREE.SphereGeometry(0.122, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.085, -0.01), color: hair });
    } else if (style === 3) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, r = 0.085;
        headParts.push({ geo: at(new THREE.SphereGeometry(0.05, 10, 8), Math.cos(a) * r, 0.15 + Math.sin(i * 1.7) * 0.025, Math.sin(a) * r - 0.025), color: hair });
      }
      headParts.push({ geo: at(new THREE.SphereGeometry(0.06, 10, 8), 0, 0.2, -0.02), color: hair });
    } else {
      headParts.push({ geo: at(new THREE.SphereGeometry(0.124, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.075, -0.012, 0, 0, 0, 1, 1.05, 1.03), color: hair });
      headParts.push({ geo: at(new THREE.TorusGeometry(0.124, 0.018, 8, 24), 0, 0.125, -0.012, Math.PI / 2 - 0.25), color: accent });
      headParts.push({ geo: at(limb(0.04, 0.025, 0.16, 10), 0, 0.13, -0.13, 0.5), color: hair });
    }
    buildMeshes(this.head, headParts, this.castShadow);
    const lens = new THREE.Mesh(at(new THREE.CylinderGeometry(0.131, 0.131, 0.078, 22, 1, true, -1.3, 2.6), 0, 0.06, 0.004), S.lens[team]);
    this.head.add(lens);

    // ---- legs ----
    for (const side of [1, -1]) {
      const hip = new THREE.Group(); hip.position.set(0.1 * side, -0.03, 0);
      const thigh = new THREE.Group(), shin = new THREE.Group(), foot = new THREE.Group();
      shin.position.y = -THIGH; foot.position.y = -SHIN;
      hip.add(thigh); thigh.add(shin); shin.add(foot);
      this.pelvis.add(hip);
      buildMeshes(thigh, [
        { geo: limb(0.088, 0.066, THIGH), color: pants },
        { geo: at(rbox(0.02, 0.32, 0.05, 0.008), 0.08 * side, -0.2, 0), color: jersey },
        { geo: at(rbox(0.07, 0.07, 0.03, 0.012), 0.07 * side, -0.16, 0.02, 0, side * 0.6), color: pantsDark },
      ], this.castShadow);
      buildMeshes(shin, [
        { geo: limb(0.066, 0.05, SHIN), color: pants },
        { geo: at(rbox(0.1, 0.14, 0.06, 0.03), 0, -0.04, 0.05), color: jerseyDark, gloss: true },
        { geo: at(new THREE.CylinderGeometry(0.058, 0.062, 0.08, 12), 0, -SHIN + 0.04, 0), color: pantsDark },
      ], this.castShadow);
      buildMeshes(foot, [
        { geo: at(rbox(0.11, 0.1, 0.25, 0.04), 0, -0.035, 0.055), color: 0x2a2f38, gloss: true },
        { geo: at(rbox(0.118, 0.03, 0.27, 0.012), 0, -0.077, 0.055), color: 0xe5e7eb },
        { geo: at(rbox(0.07, 0.02, 0.1, 0.008), 0, 0.012, 0.09), color: accent },
        { geo: at(rbox(0.112, 0.06, 0.06, 0.02), 0, -0.04, 0.155), color: gear, gloss: true },
      ], this.castShadow);
      this.legs.push({ hip, thigh, shin, foot, side });
    }

    // ---- arms ----
    for (const side of [1, -1]) {
      const shoulder = new THREE.Group(); shoulder.position.set(0.215 * side, 0.2, -0.005);
      const upper = new THREE.Group(), fore = new THREE.Group(), hand = new THREE.Group();
      fore.position.y = -UPPER; hand.position.y = -FORE;
      shoulder.add(upper); upper.add(fore); fore.add(hand);
      this.chest.add(shoulder);
      buildMeshes(shoulder, [{ geo: at(new THREE.SphereGeometry(0.078, 14, 10), 0, -0.01, 0, 0, 0, 0, 1, 0.9, 1), color: jersey }], this.castShadow);
      buildMeshes(upper, [
        { geo: limb(0.064, 0.054, UPPER), color: jersey },
        { geo: at(rbox(0.02, 0.16, 0.06, 0.008), 0.058 * side, -0.14, 0), color: accent },
      ], this.castShadow);
      buildMeshes(fore, [
        { geo: limb(0.054, 0.044, FORE), color: jersey },
        { geo: at(rbox(0.09, 0.1, 0.06, 0.025), 0, -0.02, -0.045), color: jerseyDark, gloss: true },
        { geo: at(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), 0, -FORE + 0.02, 0), color: accent },
      ], this.castShadow);
      buildMeshes(hand, [
        { geo: at(rbox(0.07, 0.1, 0.045, 0.02), 0, -0.05, 0.005), color: glove, gloss: true },
        { geo: at(limb(0.018, 0.016, 0.05, 8), 0.035 * side * -1, -0.02, 0.025, 0.6, 0, side * -0.5), color: glove, gloss: true },
        { geo: at(rbox(0.05, 0.035, 0.035, 0.01), 0, -0.02, 0.02), color: team === 0 ? 0x0e7490 : 0x9d174d, gloss: true },
      ], this.castShadow);
      this.arms.push({ shoulder, upper, fore, hand, side });
    }

    // ---- contact shadow, protection bubble, name tag ----
    this.shadowBlob = new THREE.Mesh(S.blobGeo, S.blobMat);
    this.shadowBlob.position.y = 0.02;
    this.shadowBlob.renderOrder = 1;
    R.add(this.shadowBlob);
    this.bubble = new THREE.Mesh(S.bubbleGeo, S.bubbleMat[team]);
    this.bubble.position.y = 0.92;
    this.bubble.scale.set(0.82, 1.02, 0.82);
    this.bubble.visible = false;
    R.add(this.bubble);
    if (opts.showTag) {
      this.tagMat = new THREE.SpriteMaterial({ map: nameTagTexture(opts.name, team, opts.isMate), depthTest: true, transparent: true, sizeAttenuation: false, toneMapped: false });
      this.tag = new THREE.Sprite(this.tagMat);
      this.tag.scale.set(0.2, 0.044, 1);
      this.tag.position.y = 2.18;
      this.tag.renderOrder = 10;
      R.add(this.tag);
    }
    this.setWeapon(0, true);
    this.root.traverse((o) => { o.matrixAutoUpdate = true; });
  }

  setTagVisible(v: boolean) { if (this.tag) this.tag.visible = v; }

  setWeapon(w: number, instant = false) {
    if ((w === this.pendingWeapon || w === this.gunWeapon && this.switchT >= 1) && !instant) return;
    this.pendingWeapon = w;
    if (instant || this.gunWeapon < 0) { this.attachGun(w); this.switchT = 1; return; }
    this.switchT = 0;
  }

  private attachGun(w: number) {
    if (this.gun) this.gunPivot.remove(this.gun.group);
    this.gun = buildGun(w, this.team, this.castShadow);
    this.gunPivot.add(this.gun.group);
    this.gunWeapon = w;
  }

  /** Call when this character fires. */
  kick(weapon: number) {
    this.recoil = Math.min(1.4, this.recoil + (weapon === 0 ? 0.55 : 1.1));
    if (weapon === 1 && this.gun?.pump) this.pumpT = 0;
  }
  private pumpT = 1;

  startReload() { this.reloadT = 0; }

  /** Paint splat stuck to the nearest body part. */
  addPaint(world: THREE.Vector3, team: number) {
    const S = sharedMats();
    const bones: THREE.Object3D[] = [this.pelvis, this.spine, this.chest, this.head, ...this.legs.flatMap((l) => [l.thigh, l.shin]), ...this.arms.flatMap((a) => [a.upper, a.fore])];
    let best = this.chest, bestD = Infinity;
    const p = new THREE.Vector3();
    for (const b of bones) {
      b.getWorldPosition(p);
      const d = p.distanceToSquared(world);
      if (d < bestD) { bestD = d; best = b as THREE.Group; }
    }
    const blob = new THREE.Mesh(S.paintGeo, S.paint[team]);
    const local = best.worldToLocal(world.clone());
    // pull onto the body surface a little (limbs hang along -Y from their joint)
    local.x *= 0.82; local.z *= 0.82;
    blob.position.copy(local);
    const s = 0.7 + Math.random() * 0.8;
    blob.scale.set(s * 1.3, s, s * 0.55);
    blob.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    best.add(blob);
    this.paintBlobs.push(blob);
    if (this.paintBlobs.length > 16) { const old = this.paintBlobs.shift()!; old.parent?.remove(old); }
  }

  clearPaint() {
    for (const b of this.paintBlobs) b.parent?.remove(b);
    this.paintBlobs = [];
  }

  /** Animate for this frame. `x,y,z` is the feet position in world space. */
  update(dt: number, x: number, y: number, z: number, s: AnimInput) {
    this.time += dt;
    const R = this.root;
    R.position.set(x, y, z);

    // ---- life cycle ----
    if (!s.alive) {
      if (this.deathT < 0) this.deathT = 0;
      this.deathT += dt;
    } else if (this.deathT >= 0) {
      this.deathT = -1; this.spawnT = 0; this.clearPaint();
    }
    this.spawnT = Math.min(1, this.spawnT + dt * 3.5);
    const dying = this.deathT >= 0;
    const popOut = dying ? clamp((this.deathT - 1.15) / 0.25, 0, 1) : 0;
    const scale = dying ? 1 - popOut * popOut : easeOutBack(this.spawnT);
    R.scale.setScalar(Math.max(0.0001, scale));
    R.visible = scale > 0.01;
    this.bubble.visible = s.protected && s.alive;
    if (this.bubble.visible) (this.bubble.material as THREE.ShaderMaterial).uniforms.time.value = this.time;

    // ---- facing ----
    const yaw = s.aimYaw;
    R.rotation.y = yaw;
    const yawRate = wrapAngle(yaw - this.lastYaw) / Math.max(dt, 1e-4);
    this.lastYaw = yaw;
    const co = Math.cos(yaw), si = Math.sin(yaw);
    const lvx = dying ? 0 : s.vx * co - s.vz * si, lvz = dying ? 0 : s.vx * si + s.vz * co;
    const speed = Math.hypot(lvx, lvz);

    // ---- blends ----
    const k = (rate: number) => 1 - Math.exp(-rate * dt);
    const grounded = s.grounded || dying;
    this.crouchBlend += ((s.crouch && !dying ? 1 : 0) - this.crouchBlend) * k(10);
    this.adsBlend += ((s.ads && !dying ? 1 : 0) - this.adsBlend) * k(14);
    this.sprintBlend += ((s.sprint && speed > 4 && !s.ads && !dying ? 1 : 0) - this.sprintBlend) * k(9);
    this.airBlend += ((grounded ? 0 : 1) - this.airBlend) * k(grounded ? 14 : 7);
    this.runBlend += (clamp((speed - 3.2) / 3.6, 0, 1) - this.runBlend) * k(6);
    const turning = speed < 0.4 && Math.abs(yawRate) > 1.2;
    const moving = speed > 0.25 || turning;
    this.moveBlend += ((moving && grounded ? 1 : 0) - this.moveBlend) * k(moving ? 10 : 7);
    if (speed > 0.25) this.moveDir.set(lvx / speed, lvz / speed);
    if (!this.wasGrounded && grounded && this.lastVy < -3) { this.land = Math.min(1, -this.lastVy / 12); this.onLand?.(x, y, z); }
    this.wasGrounded = grounded;
    this.lastVy = s.vy;
    this.land = Math.max(0, this.land - dt * 4.5);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.pumpT = Math.min(1, this.pumpT + dt * 2.2);
    if (s.reloading) this.reloadT = Math.min(1, this.reloadT + dt / (WEAPONS[s.weapon]?.reload / 1000 || 1.7));
    this.reloadBlend += ((s.reloading && !dying ? 1 : 0) - this.reloadBlend) * k(10);
    if (s.weapon !== this.pendingWeapon) this.setWeapon(s.weapon);
    if (this.switchT < 1) {
      const before = this.switchT;
      this.switchT = Math.min(1, this.switchT + dt * 3.2);
      if (before < 0.5 && this.switchT >= 0.5) this.attachGun(this.pendingWeapon);
    }

    // ---- gait ----
    const effSpeed = turning ? 1.1 : speed;
    const cycleLen = clamp(0.9 + effSpeed * 0.28, 1.1, 3.2) * (1 - this.crouchBlend * 0.25);
    const stanceFrac = 0.6 - this.runBlend * 0.26;
    if (grounded && !dying) this.phase = (this.phase + (effSpeed * dt) / cycleLen) % 1;
    const strideScale = turning && speed < 0.25 ? 0.12 : 1;
    const S = cycleLen * stanceFrac * strideScale;

    // lower body follows the move direction a bit (strafing / backpedal)
    let moveAng = Math.atan2(this.moveDir.x, this.moveDir.y);
    if (Math.abs(moveAng) > 1.9) moveAng = wrapAngle(moveAng - Math.PI);
    const wantPelvisYaw = speed > 0.5 && !dying ? clamp(moveAng * 0.55, -0.75, 0.75) * (1 - this.sprintBlend * 0.4) : 0;
    this.pelvisYaw += (wantPelvisYaw - this.pelvisYaw) * k(6);

    const bobAmp = this.moveBlend * (0.018 + this.runBlend * 0.035);
    const bob = bobAmp * (0.5 - 0.5 * Math.cos(this.phase * Math.PI * 4));
    const breathe = Math.sin(this.time * 1.8) * 0.006;
    let hipY = 0.93 - this.crouchBlend * 0.33 - bob - this.land * 0.16 - this.adsBlend * 0.02 + this.airBlend * 0.02;
    // drop the hips when the stride is long so the legs can always reach the ground
    const reach = (THIGH + SHIN) * 0.985, halfStride = (S / 2) * this.moveBlend;
    if (!this.airBlend || this.airBlend < 0.5) hipY = Math.min(hipY, Math.sqrt(Math.max(0.01, reach * reach - halfStride * halfStride)) + ANKLE + 0.03);
    this.pelvis.position.y = hipY;
    this.pelvis.rotation.set(
      this.runBlend * 0.1 + this.sprintBlend * 0.14 + this.crouchBlend * 0.18 + this.land * 0.15,
      this.pelvisYaw,
      Math.sin(this.phase * Math.PI * 2) * 0.05 * this.moveBlend,
    );

    // ---- upper body & aim ----
    const pitch = dying ? 0.35 : clamp(s.aimPitch, -1.2, 1.2);
    this.spine.rotation.set(-pitch * 0.22 + this.sprintBlend * 0.08 - this.crouchBlend * 0.1 + breathe, -this.pelvisYaw * 0.6, -Math.sin(this.phase * Math.PI * 2) * 0.03 * this.moveBlend);
    this.chest.rotation.set(-pitch * 0.22 + breathe * 0.5 - this.recoil * 0.035, -this.pelvisYaw * 0.4 - Math.sin(this.phase * Math.PI * 2) * 0.07 * this.moveBlend * (1 - this.adsBlend) - 0.15 * (1 - this.sprintBlend), 0);
    this.neck.rotation.set(-pitch * 0.18, 0.15 * (1 - this.sprintBlend), 0);
    this.head.rotation.set(-pitch * 0.12 + Math.sin(this.phase * Math.PI * 4) * 0.02 * this.moveBlend, Math.sin(this.time * 0.37) * 0.05 * (1 - this.moveBlend), 0);

    // gun pose
    const gp = this.gunPivot;
    const sw = this.switchT < 1 ? Math.sin(this.switchT * Math.PI) : 0;
    const rl = this.reloadBlend;
    if (dying) {
      const up = clamp(this.deathT * 4, 0, 1);
      gp.position.set(-0.02, 0.18 + up * 0.5, 0.12);
      gp.rotation.set(-0.15, -Math.PI / 2 * up, 0);
    } else {
      gp.position.set(-0.13 + this.adsBlend * 0.08 + this.sprintBlend * 0.08, 0.13 + this.adsBlend * 0.05 - this.sprintBlend * 0.06 - sw * 0.12, 0.17 - this.recoil * 0.05 + this.sprintBlend * 0.02);
      gp.rotation.set(
        -pitch * 0.56 + this.sprintBlend * 0.75 + sw * 1.1 - this.recoil * 0.12 + rl * 0.25,
        this.sprintBlend * 0.75 + 0.15 * (1 - this.sprintBlend) + rl * 0.15,
        this.sprintBlend * 0.35 + rl * (0.45 + Math.sin(this.reloadT * Math.PI * 6) * 0.06),
      );
    }
    if (this.gun?.pump) this.gun.pump.position.z = 0.38 - Math.sin(this.pumpT * Math.PI) * 0.09;

    R.updateMatrixWorld(true);
    const sc = Math.max(0.0001, R.scale.x);

    // ---- legs IK ----
    const rootQ = R.getWorldQuaternion(new THREE.Quaternion());
    const pelvisFwd = new THREE.Vector3(Math.sin(this.pelvisYaw), 0, Math.cos(this.pelvisYaw)).applyQuaternion(rootQ);
    for (let i = 0; i < 2; i++) {
      const L = this.legs[i];
      const p = (this.phase + (i === 0 ? 0 : 0.5)) % 1;
      let along = 0, lift = 0, toe = 0;
      const inStance = p < stanceFrac;
      if (inStance) {
        const u = p / stanceFrac;
        along = S / 2 - S * u;
        toe = u > 0.75 ? -(u - 0.75) * 1.6 : 0;
      } else {
        const u = (p - stanceFrac) / (1 - stanceFrac);
        const e = u * u * (3 - 2 * u);
        along = -S / 2 + S * e;
        lift = Math.sin(u * Math.PI) * (0.09 + this.runBlend * 0.17 + (turning ? 0.04 : 0)) * (1 - this.crouchBlend * 0.4);
        toe = Math.sin(u * Math.PI) * 0.5 - 0.2;
      }
      // footstep event at heel strike
      if (inStance && !this.lastStance[i] && this.moveBlend > 0.5 && grounded && !dying) {
        const fx = x + (this.moveDir.x * co + this.moveDir.y * si) * along, fz = z + (-this.moveDir.x * si + this.moveDir.y * co) * along;
        this.onStep?.(fx, y, fz, this.runBlend);
      }
      this.lastStance[i] = inStance;
      // rest stance (root local)
      const side = L.side;
      const restX = (0.115 + this.crouchBlend * 0.05) * side;
      const restZ = (side > 0 ? 0.03 : -0.03) + this.crouchBlend * (side > 0 ? 0.16 : -0.12) + this.adsBlend * (side > 0 ? 0.06 : -0.05);
      const mb = this.moveBlend;
      let fx = restX + this.moveDir.x * along * mb;
      let fz = restZ + this.moveDir.y * along * mb;
      let fy = lift * mb + ANKLE;
      // airborne tuck
      const air = this.airBlend;
      fy += air * (0.22 + (side > 0 ? 0.1 : 0) - Math.max(0, -s.vy) * 0.01);
      fz += air * (side > 0 ? 0.12 : -0.08);
      if (dying) { fz = restZ; fx = restX; fy = ANKLE; }
      const target = new THREE.Vector3(fx, fy, fz);
      R.localToWorld(target);
      // never put the ankle below the ground plane under it
      if (target.y < y + ANKLE * 0.9) target.y = y + ANKLE * 0.9;
      const hipW = L.thigh.getWorldPosition(new THREE.Vector3());
      const pole = hipW.clone().addScaledVector(pelvisFwd, 1).add(new THREE.Vector3(0, -0.2, 0)).addScaledVector(new THREE.Vector3(-pelvisFwd.z, 0, pelvisFwd.x), side * 0.15);
      solveTwoBone(L.thigh, L.shin, THIGH * sc, SHIN * sc, target, pole);
      // keep the boot level with the ground, pitched by the gait
      L.shin.updateWorldMatrix(true, false);
      const shinQ = L.shin.getWorldQuaternion(new THREE.Quaternion());
      const footYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + this.pelvisYaw * 0.7 + side * 0.08);
      const footPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -toe * mb * (1 - air) + air * 0.35);
      L.foot.quaternion.copy(shinQ.invert().multiply(footYaw.multiply(footPitch)));
    }

    // ---- arms IK to the marker grips ----
    if (this.gun) {
      this.gun.group.updateWorldMatrix(true, false);
      const gripR = this.gun.group.localToWorld(this.gun.gripR.clone());
      let gripL = this.gun.group.localToWorld(this.gun.gripL.clone());
      if (rl > 0.01 && !dying) {
        const hop = this.gun.group.localToWorld(this.gun.hopperL.clone());
        const shake = Math.sin(this.reloadT * Math.PI * 8) * 0.025;
        hop.y += 0.04 + shake;
        gripL = gripL.lerp(hop, rl * clamp(Math.sin(this.reloadT * Math.PI) * 1.6, 0, 1));
      }
      if (this.gun.pump) {
        const pumpW = this.gun.pump.getWorldPosition(new THREE.Vector3());
        pumpW.y -= 0.04;
        gripL = gripL.lerp(pumpW, 1 - rl);
      }
      const chestQ = this.chest.getWorldQuaternion(new THREE.Quaternion());
      const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(chestQ);
      const back = new THREE.Vector3(0, 0, -1).applyQuaternion(chestQ);
      const down = new THREE.Vector3(0, -1, 0);
      for (const A of this.arms) {
        const sh = A.upper.getWorldPosition(new THREE.Vector3());
        const target = A.side < 0 ? gripR : gripL;
        const pole = sh.clone().addScaledVector(down, 0.5).addScaledVector(back, A.side < 0 ? 0.25 : 0.05).addScaledVector(right, A.side < 0 ? 0.45 : -0.45);
        solveTwoBone(A.upper, A.fore, UPPER * sc, FORE * sc, target, pole);
        A.hand.rotation.set(-0.3, 0, A.side * 0.2);
      }
      R.updateMatrixWorld(true);
      this.gun.group.localToWorld(this.muzzleWorld.copy(this.gun.muzzle));
    }
    this.shadowBlob.position.y = 0.02 - (R.position.y - y);
    this.shadowBlob.scale.setScalar((1 - this.airBlend * 0.35) / Math.max(0.0001, scale));
  }

  dispose() {
    this.jerseyMat.map?.dispose();
    this.jerseyMat.dispose();
    this.tagMat?.map?.dispose();
    this.tagMat?.dispose();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      // per-character merged geometries (gun geometries are cached & shared)
      if (m.isMesh && m.geometry && m.material !== sharedMats().blobMat && !isSharedGeo(m.geometry)) m.geometry.dispose();
    });
    this.root.parent?.remove(this.root);
  }
}

function isSharedGeo(g: THREE.BufferGeometry) {
  const S = sharedMats();
  if (g === S.blobGeo || g === S.paintGeo || g === S.bubbleGeo) return true;
  let found = false;
  gunCache.forEach((e) => { if (e.geo === g || e.hopper === g || e.pumpGeo === g) found = true; });
  return found;
}

function remapV(geo: THREE.BufferGeometry, v0: number, v1: number) {
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
  uv.needsUpdate = true;
}

function easeOutBack(t: number) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

export function disposeCharacterShared() {
  if (!shared) return;
  const S = shared;
  [S.matte, S.gloss, ...S.lens, ...S.hopper, ...S.paint, S.blobMat, ...S.bubbleMat].forEach((m) => m.dispose());
  S.blob.dispose(); S.blobGeo.dispose(); S.paintGeo.dispose(); S.bubbleGeo.dispose();
  gunCache.forEach((e) => { e.geo.dispose(); e.hopper?.dispose(); e.pumpGeo?.dispose(); });
  gunCache.clear();
  shared = null;
}
