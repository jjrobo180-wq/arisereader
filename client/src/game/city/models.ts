// Realistic-looking cars, built from code (no model files): a rounded body
// extruded from a side profile, a glass cabin, chrome trim, detailed wheels with
// tyres and rims, and working head and tail lights. Physically based paint with
// a clear coat picks up the city's environment reflections.
import * as THREE from "three";
import type { CarId } from "@shared/city/drive";

export type CarRig = { root: THREE.Group; setMotion: (speed: number, steer: number, dt: number) => void; dispose: () => void };

type Shape = "sedan" | "coupe" | "suv" | "muscle" | "super" | "taxi";
type Spec = { shape: Shape; color: number; metal?: boolean };

/** Which body and default paint each car uses. */
export const CAR_LOOKS: Record<CarId, Spec> = {
  "car-starter": { shape: "sedan", color: 0x1f6f78, metal: true },
  "car-street": { shape: "coupe", color: 0xc1121f, metal: true },
  "car-electric": { shape: "sedan", color: 0xe9ecef },
  "car-suv": { shape: "suv", color: 0x1d2b3a, metal: true },
  "car-super": { shape: "super", color: 0xf59f00, metal: true },
};

// Side profiles (x = along the car from rear to front, y = height), for a car 1 unit long.
// Body: the lower shell. Cabin: the glass house on top, inset from the sides.
type Profile = { body: [number, number][]; cabin: [number, number][]; width: number; wheelR: number; axles: [number, number]; headY: number; tailY: number; roof: [number, number, number] };
const SEDAN: Profile = {
  body: [[0, 0.075], [0, 0.15], [0.02, 0.185], [0.2, 0.192], [0.66, 0.19], [0.95, 0.158], [1, 0.13], [1, 0.07], [0.9, 0.045], [0.1, 0.045]],
  cabin: [[0.2, 0.19], [0.31, 0.288], [0.36, 0.302], [0.56, 0.302], [0.6, 0.29], [0.69, 0.19]],
  width: 0.4, wheelR: 0.074, axles: [0.17, 0.8], headY: 0.135, tailY: 0.16, roof: [0.36, 0.56, 0.302],
};
const PROFILES: Record<Shape, Profile> = {
  sedan: SEDAN,
  taxi: SEDAN,
  coupe: {
    body: [[0, 0.08], [0, 0.15], [0.03, 0.172], [0.62, 0.17], [0.95, 0.135], [1, 0.11], [1, 0.065], [0.9, 0.04], [0.1, 0.04]],
    cabin: [[0.1, 0.17], [0.32, 0.262], [0.38, 0.272], [0.5, 0.27], [0.54, 0.258], [0.64, 0.17]],
    width: 0.41, wheelR: 0.076, axles: [0.17, 0.8], headY: 0.115, tailY: 0.145, roof: [0.38, 0.5, 0.272],
  },
  muscle: {
    body: [[0, 0.08], [0, 0.16], [0.02, 0.195], [0.24, 0.198], [0.3, 0.2], [0.97, 0.185], [1, 0.155], [1, 0.07], [0.9, 0.045], [0.1, 0.045]],
    cabin: [[0.25, 0.2], [0.32, 0.288], [0.37, 0.298], [0.52, 0.298], [0.57, 0.285], [0.65, 0.2]],
    width: 0.42, wheelR: 0.078, axles: [0.17, 0.79], headY: 0.16, tailY: 0.17, roof: [0.37, 0.52, 0.298],
  },
  super: {
    body: [[0, 0.075], [0, 0.155], [0.04, 0.17], [0.3, 0.165], [0.48, 0.155], [0.85, 0.11], [1, 0.085], [1, 0.05], [0.9, 0.03], [0.1, 0.03]],
    cabin: [[0.24, 0.165], [0.36, 0.232], [0.42, 0.24], [0.5, 0.238], [0.56, 0.22], [0.7, 0.135], [0.62, 0.14]],
    width: 0.43, wheelR: 0.078, axles: [0.18, 0.79], headY: 0.09, tailY: 0.14, roof: [0.4, 0.5, 0.24],
  },
  suv: {
    body: [[0, 0.1], [0, 0.22], [0.02, 0.245], [0.72, 0.245], [0.96, 0.215], [1, 0.18], [1, 0.1], [0.9, 0.065], [0.1, 0.065]],
    cabin: [[0.03, 0.245], [0.06, 0.37], [0.6, 0.375], [0.64, 0.36], [0.74, 0.245]],
    width: 0.4, wheelR: 0.088, axles: [0.17, 0.8], headY: 0.19, tailY: 0.21, roof: [0.07, 0.6, 0.375],
  },
};

// Shared materials (one per paint colour) so dozens of cars stay cheap.
const paints = new Map<string, THREE.MeshPhysicalMaterial>();
function paint(color: number, metal = false) {
  const k = color + (metal ? "m" : "");
  let m = paints.get(k);
  if (!m) { m = new THREE.MeshPhysicalMaterial({ color, metalness: metal ? 0.55 : 0.1, roughness: metal ? 0.32 : 0.38, clearcoat: 1, clearcoatRoughness: 0.08 }); paints.set(k, m); }
  return m;
}
const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1622, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
const darkTrim = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.3, roughness: 0.55, side: THREE.DoubleSide });
const rubber = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9bfc8, metalness: 0.95, roughness: 0.25 });
// head and tail lights share one unlit material, coloured per vertex
const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const taxiSign = new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffd43b, emissiveIntensity: 0.9 });

const geoCache = new Map<string, THREE.BufferGeometry>();
function extrudeProfile(pts: [number, number][], length: number, width: number, bevel: number, smooth = false) {
  const s = new THREE.Shape();
  const v = pts.map(([x, y]) => new THREE.Vector2(x * length, y * length));
  s.moveTo(v[0].x, v[0].y);
  if (smooth) s.splineThru([...v.slice(1), v[0]]); else { v.slice(1).forEach((p) => s.lineTo(p.x, p.y)); s.closePath(); }
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.05, width - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: smooth ? 40 : 4 });
  g.translate(-length / 2, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2); // profile x → forward (+z), extrusion → sideways
  g.computeVertexNormals();
  return g;
}

function wheelGeometry(r: number, w: number) {
  const k = `w${r.toFixed(3)}:${w.toFixed(3)}`;
  if (geoCache.has(k)) return geoCache.get(k)!;
  const tyre = new THREE.CylinderGeometry(r, r, w, 24, 1); tyre.rotateZ(Math.PI / 2);
  geoCache.set(k, tyre);
  return tyre;
}
function rimGeometry(r: number, w: number) {
  const k = `r${r.toFixed(3)}:${w.toFixed(3)}`;
  if (geoCache.has(k)) return geoCache.get(k)!;
  const parts: THREE.BufferGeometry[] = [];
  const lip = new THREE.TorusGeometry(r * 0.66, r * 0.05, 6, 28); lip.rotateY(Math.PI / 2); lip.translate(w * 0.52, 0, 0); parts.push(lip);
  const lip2 = lip.clone(); lip2.translate(-w * 1.04, 0, 0); parts.push(lip2);
  const hub = new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.1, 10); hub.rotateZ(Math.PI / 2); parts.push(hub);
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.BoxGeometry(w * 1.08, r * 0.56, r * 0.13);
    sp.translate(0, r * 0.36, 0); sp.rotateX((i / 5) * Math.PI * 2); parts.push(sp);
  }
  // merge by hand (all share attributes)
  const merged = mergeSimple(parts);
  geoCache.set(k, merged);
  return merged;
}
/** Merges position + normal (and an optional flat colour per part) into one non-indexed geometry. */
function mergeSimple(list: THREE.BufferGeometry[], colors?: number[]) {
  const nonIdx = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = nonIdx.reduce((n, g) => n + g.getAttribute("position").count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = colors ? new Float32Array(total * 3) : null;
  let o = 0;
  const c = new THREE.Color();
  nonIdx.forEach((g, i) => {
    const p = g.getAttribute("position"), n = g.getAttribute("normal");
    pos.set(p.array as Float32Array, o * 3); nor.set(n.array as Float32Array, o * 3);
    if (col && colors) { c.set(colors[i]); for (let k = 0; k < p.count; k++) col.set([c.r, c.g, c.b], (o + k) * 3); }
    o += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

/** Everything about a body shape at a given length, merged by material and shared by every car like it. */
type Kit = {
  paint: THREE.BufferGeometry; glass: THREE.BufferGeometry; trim: THREE.BufferGeometry; lights: THREE.BufferGeometry; sign: THREE.BufferGeometry | null; shadow: THREE.BufferGeometry;
  tyre: THREE.BufferGeometry; rim: THREE.BufferGeometry; r: number; wheels: { x: number; y: number; z: number; front: boolean }[];
  /** For background traffic: the trim with all four tyres built in, and the four rims as one mesh. */
  trimWithTyres: THREE.BufferGeometry; rims: THREE.BufferGeometry;
};
const kits = new Map<string, Kit>();

function buildKit(shape: Shape, L: number): Kit {
  const P = PROFILES[shape];
  const W = L * P.width;
  const paintG: THREE.BufferGeometry[] = [], trimG: THREE.BufferGeometry[] = [], lightG: THREE.BufferGeometry[] = [], lightC: number[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, list: THREE.BufferGeometry[]) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g); return g; };

  const shell = extrudeProfile(P.body, L, W, 0.14, true); paintG.push(shell);
  const cab = extrudeProfile(P.cabin, L, W * 0.86, 0.09); cab.translate(0, -0.01, 0);
  // roof panel in body colour over the glass, a dark pillar between the windows
  { const [r0, r1, ry] = P.roof; box(W * 0.8, 0.04, (r1 - r0) * L, 0, ry * L + 0.055, (((r0 + r1) / 2) - 0.5) * L, paintG); }
  box(W * 0.87, (P.roof[2] - P.cabin[0][1]) * L * 0.95, 0.07, 0, ((P.roof[2] + P.cabin[0][1]) / 2) * L, ((P.roof[0] + P.roof[1]) / 2 - 0.5) * L, trimG);
  // lower trim, grille, bumpers
  const floorY = P.body[P.body.length - 1][1] * L;
  box(W * 1.01, 0.07, L * 0.5, 0, floorY + 0.09, 0, trimG);
  shell.computeBoundingBox();
  const frontZ = shell.boundingBox!.max.z - 0.02, rearZ = shell.boundingBox!.min.z + 0.02;
  box(W * 0.42, L * 0.03, 0.05, 0, P.headY * L - 0.05, frontZ - 0.01, trimG);
  for (const s of [-1, 1]) {
    box(W * 0.2, L * 0.03, 0.06, s * W * 0.33, P.headY * L, frontZ + 0.01, lightG); lightC.push(0xfff6e0);
    box(W * 0.26, L * 0.03, 0.06, s * W * 0.32, P.tailY * L, rearZ - 0.02, lightG); lightC.push(0xff2233);
    box(0.22, 0.12, 0.16, s * (W / 2 + 0.07), P.cabin[0][1] * L + 0.12, (P.cabin[P.cabin.length - 1][0] - 0.56) * L, paintG); // mirror
    box(0.03, 0.03, 0.18, s * (W / 2 + 0.005), P.cabin[0][1] * L - 0.12, L * 0.02, trimG); // door handle
  }
  box(W * 0.86, L * 0.022, 0.08, 0, floorY + 0.12, frontZ - 0.01, trimG);
  box(W * 0.86, L * 0.022, 0.08, 0, floorY + 0.12, rearZ + 0.01, trimG);
  let sign: THREE.BufferGeometry | null = null;
  if (shape === "taxi") {
    sign = new THREE.BoxGeometry(W * 0.36, 0.22, 0.4); sign.translate(0, P.roof[2] * L + 0.2, 0);
    box(W * 1.01, 0.1, L * 0.5, 0, P.cabin[0][1] * L - 0.25, 0, trimG);
  }
  if (shape === "super") {
    box(W * 0.9, 0.05, 0.32, 0, P.body[2][1] * L + 0.22, rearZ + 0.25, trimG);
    for (const s of [-1, 1]) box(0.05, L * 0.05, 0.1, s * W * 0.3, P.body[2][1] * L + 0.11, rearZ + 0.25, trimG);
  }
  // wheels: the tyre and rim spin; the dark inner disc and the arch around each wheel stay put
  const r = P.wheelR * L, tw = W * 0.24;
  const wheels: Kit["wheels"] = [];
  for (const [i, ax] of P.axles.entries()) for (const s of [-1, 1]) {
    const x = s * (W / 2 - tw * 0.32), z = (ax - 0.5) * L;
    wheels.push({ x, y: r, z, front: i === 1 });
    const inner = new THREE.CylinderGeometry(r * 0.64, r * 0.64, tw * 1.01, 20); inner.rotateZ(Math.PI / 2); inner.translate(x, r, z); trimG.push(inner);
    const arch = new THREE.CylinderGeometry(r * 1.2, r * 1.2, tw * 1.06, 18, 1, true, 0, Math.PI); arch.rotateZ(Math.PI / 2); arch.translate(x, r, z); trimG.push(arch);
  }
  const tyre = wheelGeometry(r, tw), rim = rimGeometry(r, tw);
  const at = (g: THREE.BufferGeometry, w: { x: number; y: number; z: number }) => { const c = g.clone(); c.translate(w.x, w.y, w.z); return c; };
  const shadow = new THREE.PlaneGeometry(W * 1.15, L * 1.05); shadow.rotateX(-Math.PI / 2); shadow.translate(0, 0.02, 0);
  const trimWithTyres = mergeSimple([...trimG, ...wheels.map((w) => at(tyre, w))]);
  const rims = mergeSimple(wheels.map((w) => at(rim, w)));
  const m = (list: THREE.BufferGeometry[]) => { const g = mergeSimple(list); list.forEach((x) => x.dispose()); return g; };
  return {
    paint: m(paintG), glass: mergeSimple([cab]), trim: m(trimG), lights: mergeSimple(lightG, lightC), sign: sign ? mergeSimple([sign]) : null,
    shadow, tyre, rim, r, wheels, trimWithTyres, rims,
  };
}

/**
 * A car `length` units long, sitting on y = 0 and facing +z. `tint` repaints it;
 * `shape` overrides the body (traffic uses taxis and other shapes). Geometry is
 * shared between cars of the same shape, so a street full of traffic stays cheap.
 */
export function makeCar(id: CarId | string, opts: { length?: number; tint?: number; shape?: Shape; lite?: boolean } = {}): CarRig {
  const look = CAR_LOOKS[id as CarId] ?? CAR_LOOKS["car-starter"];
  const shape: Shape = opts.shape ?? look.shape;
  const L = opts.length ?? 4.5;
  const key = `${shape}:${L.toFixed(2)}`;
  let k = kits.get(key);
  if (!k) { k = buildKit(shape, L); kits.set(key, k); }
  const root = new THREE.Group();
  const color = shape === "taxi" ? 0xf5c518 : opts.tint ?? look.color;
  const paintMat = paint(color, shape === "taxi" ? false : look.metal ?? true);
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = root, shadow = true) => { const mesh = new THREE.Mesh(g, mat); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  add(k.paint, paintMat); add(k.glass, glass); add(opts.lite ? k.trimWithTyres : k.trim, darkTrim);
  add(k.lights, lightMat, root, false);
  if (k.sign) add(k.sign, taxiSign);
  const shadow = new THREE.Mesh(k.shadow, shadowMat()); shadow.renderOrder = -1; root.add(shadow);

  // background traffic gets fixed wheels (two draw calls instead of eight)
  const wheels: THREE.Object3D[] = [], fronts: THREE.Object3D[] = [];
  if (opts.lite) add(k.rims, rimMat, root, false);
  else for (const w of k.wheels) {
    const pivot = new THREE.Group(); pivot.position.set(w.x, w.y, w.z); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    add(k.tyre, rubber, spin); add(k.rim, rimMat, spin, false);
    wheels.push(spin); if (w.front) fronts.push(pivot);
  }
  const r = k.r;
  let spinA = 0;
  return {
    root,
    setMotion(speed, steer, dt) {
      spinA += (speed / Math.max(0.1, r)) * dt;
      for (const w of wheels) w.rotation.x = spinA;
      for (const f of fronts) f.rotation.y = steer * 0.45;
    },
    dispose() { /* geometry and materials are shared between cars */ },
  };
}

let _shadow: THREE.MeshBasicMaterial | null = null;
function shadowMat() {
  if (_shadow) return _shadow;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, "rgba(0,0,0,.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  _shadow = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  return _shadow;
}
