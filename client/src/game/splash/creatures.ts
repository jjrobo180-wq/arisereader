// Animal Splash — the sixteen 3D pond animals. Each one is built from smooth shapes in a friendly toy style,
// stands with its waterline at y = 0 (so the water hides what's under it), faces +z, and has its own
// idle life, swimming stroke, happy dance, "oops" head-shake and one special move (spray, spout, yawn…).
import * as THREE from "three";
import { bakeStatic } from "@/game/runner/models";

type V = [number, number, number];
export type Mood = { dt: number; t: number; swim: number; happy: number; oops: number };
export type Emit = (kind: "spray" | "spout" | "splash" | "bubbles", at: THREE.Vector3) => void;
export type Creature = {
  id: string; g: THREE.Group; body: THREE.Group;
  /** height of the top of the animal above the water (for the name tag) */ top: number;
  /** "leap" animals jump out of the water now and then; "deep" ones sit lower */ motion: "float" | "wade" | "leap";
  update: (m: Mood) => void; special: () => void; emit: Emit | null;
};

// ── materials & shape helpers ──
const mats = new Map<string, THREE.Material>();
function mat(color: number, rough = 0.5, o: { wet?: boolean; side?: THREE.Side; vc?: boolean; emissive?: number } = {}) {
  const k = [color, rough, o.wet, o.side, o.vc, o.emissive].join("|"); let m = mats.get(k);
  if (!m) {
    const base = { color: o.vc ? 0xffffff : color, roughness: rough, side: o.side ?? THREE.FrontSide, vertexColors: !!o.vc, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissive ? 0.6 : 0 };
    m = o.wet ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat: 0.75, clearcoatRoughness: 0.22 }) : new THREE.MeshStandardMaterial(base);
    mats.set(k, m);
  }
  return m;
}
const GLINT = () => mat(0xffffff, 0.2, { emissive: 0xffffff });
const UNIT = new THREE.SphereGeometry(1, 32, 22);
function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, p: V = [0, 0, 0], s: V = [1, 1, 1], r: V = [0, 0, 0]) {
  const o = new THREE.Mesh(geo, m); o.position.set(...p); o.scale.set(...s); o.rotation.set(...r); o.castShadow = true; parent.add(o); return o;
}
const ell = (parent: THREE.Object3D, s: V, m: THREE.Material, p: V, r: V = [0, 0, 0]) => part(parent, UNIT, m, p, s, r);
function pivot(parent: THREE.Object3D, p: V, r: V = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...r); g.userData.keep = true; parent.add(g); return g; }
/** glossy toy eye with a sparkle; yaw turns it outward */
function eye(parent: THREE.Object3D, p: V, r: number, yaw = 0, white = false, iris = 0x15171c) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = yaw; parent.add(g);
  const f = white ? r * 0.28 : 0;
  if (white) ell(g, [r * 1.3, r * 1.3, r * 1.05], mat(0xffffff, 0.25), [0, 0, -r * 0.25]);
  ell(g, [r, r, r * 0.8], mat(iris, 0.12), [0, 0, f]);
  ell(g, [r * 0.3, r * 0.3, r * 0.18], GLINT(), [r * 0.3, r * 0.36, f + r * 0.72]);
  ell(g, [r * 0.14, r * 0.14, r * 0.1], GLINT(), [-r * 0.28, -r * 0.3, f + r * 0.74]);
  return g;
}
function smile(parent: THREE.Object3D, p: V, w: number, m: THREE.Material, thick = 0.025, arc = 0.75) {
  const t = part(parent, new THREE.TorusGeometry(w, thick, 6, 20, Math.PI * arc), m, p); t.rotation.z = Math.PI + Math.PI * (1 - arc) / 2; return t;
}
/** smooth body of revolution along z (t = 0 tail … 1 nose), darker on top and pale underneath */
function torpedo(parent: THREE.Object3D, len: number, rad: number, prof: (t: number) => number, top: number, belly: number, p: V = [0, 0, 0], wet = true) {
  const pts: THREE.Vector2[] = []; const N = 54;
  for (let i = 0; i <= N; i++) { const t = i / N; const r = prof(t); pts.push(new THREE.Vector2(Math.max(0.003, Number.isFinite(r) ? r * rad : 0), (t - 0.5) * len)); }
  const geo = new THREE.LatheGeometry(pts, 40); geo.rotateX(Math.PI / 2); geo.computeVertexNormals();
  const n = geo.attributes.normal as THREE.BufferAttribute; const cols = new Float32Array(n.count * 3); const a = new THREE.Color(top), b = new THREE.Color(belly), c = new THREE.Color();
  for (let i = 0; i < n.count; i++) { const k = THREE.MathUtils.smoothstep(n.getY(i), -0.45, 0.2); c.copy(b).lerp(a, k); cols.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const m = part(parent, geo, mat(0xffffff, wet ? 0.35 : 0.55, { vc: true, wet }), p); m.userData.keep = true; return m;
}
/** a flat fin/fluke from an outline; plane: "side" = vertical (dorsal), "flat" = horizontal (flukes) */
function fin(parent: THREE.Object3D, pts: [number, number][], depth: number, m: THREE.Material, plane: "side" | "flat", p: V, r: V = [0, 0, 0]) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.6, bevelSize: depth * 0.7, bevelSegments: 3, curveSegments: 10 }); geo.translate(0, 0, -depth / 2);
  if (plane === "side") geo.rotateY(-Math.PI / 2); else geo.rotateX(Math.PI / 2);
  return part(parent, geo, m, p, [1, 1, 1], r);
}
function curve(pts: V[]) { return new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q))); }
function tube(parent: THREE.Object3D, pts: V[], r: number, m: THREE.Material, taper = 1) {
  const c = curve(pts); const geo = new THREE.TubeGeometry(c, 40, r, 12, false);
  if (taper !== 1) { const pos = geo.attributes.position as THREE.BufferAttribute; const v = new THREE.Vector3(); for (let i = 0; i < pos.count; i++) { const ring = Math.floor(i / 13), k = ring / 40; const ctr = c.getPointAt(Math.min(1, k)); v.fromBufferAttribute(pos, i).sub(ctr).multiplyScalar(1 + (taper - 1) * k).add(ctr); pos.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); }
  return part(parent, geo, m, [0, 0, 0]);
}
function texture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")!); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }

function shell(id: string, motion: Creature["motion"]) {
  const g = new THREE.Group(); const body = new THREE.Group(); body.userData.keep = true; g.add(body);
  const c: Creature = { id, g, body, top: 1.6, motion, update: () => {}, special: () => {}, emit: null };
  return c;
}
/** finish: merge the still parts into a few meshes (animated parts are kept live) */
function done(c: Creature, top: number, update: (m: Mood, sp: number) => void, special?: (c: Creature) => number) {
  // bake the static meshes directly under body (pivots/torpedoes are marked keep)
  const live = c.body.children.filter(o => o.userData.keep); live.forEach(o => c.body.remove(o));
  const stat = new THREE.Group(); while (c.body.children.length) stat.add(c.body.children[0]); bakeStatic(stat); c.body.add(stat); live.forEach(o => c.body.add(o));
  c.g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  c.top = top; let sp = 0, spLen = 1;
  c.special = () => { if (sp > 0) return; spLen = special ? special(c) : 1.2; sp = spLen; };
  c.update = m => {
    sp = Math.max(0, sp - m.dt); const k = sp > 0 ? 1 - sp / spLen : 0;
    // shared: happy bounce + spin, oops head-shake
    c.body.position.y = Math.abs(Math.sin(m.happy * Math.PI * 3)) * 0.55 * Math.min(1, m.happy * 2);
    c.body.rotation.y = m.happy > 0 ? (1 - m.happy) * Math.PI * 2 * (m.happy > 0.02 ? 1 : 0) : 0;
    c.body.rotation.z = Math.sin(m.t * 22) * 0.16 * m.oops;
    update(m, sp > 0 ? k : -1);
  };
  return c;
}
const wave = (t: number, f: number, a = 1, ph = 0) => Math.sin(t * f + ph) * a;

// ── the animals ──
function duck() {
  const c = shell("duck", "float"); const b = c.body;
  const yel = mat(0xffd23f, 0.42), org = mat(0xff8a1a, 0.4), wing = mat(0xf7c22a, 0.45);
  ell(b, [0.8, 0.55, 1.0], yel, [0, 0.28, 0]);
  ell(b, [0.42, 0.32, 0.45], yel, [0, 0.62, -0.78], [-0.7, 0, 0]);
  ell(b, [0.36, 0.44, 0.36], yel, [0, 0.78, 0.48]);
  const head = pivot(b, [0, 1.12, 0.58]);
  ell(head, [0.48, 0.46, 0.48], yel, [0, 0, 0]);
  ell(head, [0.27, 0.09, 0.32], org, [0, -0.07, 0.46]); ell(head, [0.23, 0.06, 0.26], mat(0xe26f0a, 0.45), [0, -0.15, 0.42]);
  for (const s of [-1, 1]) { eye(head, [s * 0.24, 0.1, 0.36], 0.085, s * 0.5); ell(head, [0.1, 0.06, 0.04], mat(0xffa3a3, 0.6), [s * 0.33, -0.08, 0.32]); }
  ell(head, [0.06, 0.12, 0.06], yel, [0, 0.47, -0.02], [0.4, 0, 0]);
  const wings = [-1, 1].map(s => { const w = pivot(b, [s * 0.66, 0.5, 0.05]); ell(w, [0.13, 0.36, 0.62], wing, [s * 0.06, -0.08, -0.12], [0.3, 0, s * 0.35]); return w; });
  return done(c, 1.7, (m, sp) => {
    head.rotation.x = wave(m.t, 2.2, 0.06) + (m.swim ? wave(m.t, 8, 0.08) : 0); head.rotation.y = wave(m.t, 0.7, 0.25);
    const flap = sp >= 0 ? Math.abs(Math.sin(sp * Math.PI * 8)) * 1.1 : m.happy > 0 ? Math.abs(Math.sin(m.t * 18)) : 0.05;
    wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * flap; });
    b.rotation.x = m.swim ? wave(m.t, 8, 0.05) : 0;
  }, () => 1.2);
}

function turtle() {
  const c = shell("turtle", "float"); const b = c.body;
  const skin = mat(0x8fd06a, 0.5), dark = mat(0x2f7a3a, 0.45), plate = mat(0x5cb85a, 0.4), rim = mat(0xe3c77a, 0.5);
  const dome = part(b, new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), dark, [0, 0.05, 0], [1.05, 0.62, 1.25]);
  void dome;
  const plates: [number, number][] = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [0.62, (i / 6) * Math.PI * 2] as [number, number])];
  for (const [th, ph] of plates) {
    const n = new THREE.Vector3(Math.sin(th) * Math.cos(ph) / 1.05, Math.cos(th) / 0.62, Math.sin(th) * Math.sin(ph) / 1.25).normalize();
    const p = new THREE.Vector3(Math.sin(th) * Math.cos(ph) * 1.05, Math.cos(th) * 0.62 + 0.05, Math.sin(th) * Math.sin(ph) * 1.25);
    const h = part(b, new THREE.CylinderGeometry(th ? 0.3 : 0.34, th ? 0.33 : 0.37, 0.08, 6), plate, [p.x, p.y, p.z]); h.lookAt(p.clone().add(n)); h.rotateX(Math.PI / 2);
  }
  const ring = part(b, new THREE.TorusGeometry(1, 0.09, 10, 56), rim, [0, 0.06, 0], [1.06, 1.27, 1], [Math.PI / 2, 0, 0]); void ring;
  ell(b, [1.0, 0.16, 1.2], rim, [0, -0.05, 0]);
  const neck = pivot(b, [0, 0.12, 1.15]);
  ell(neck, [0.24, 0.22, 0.38], skin, [0, 0, 0.1]); ell(neck, [0.34, 0.31, 0.38], skin, [0, 0.1, 0.45]);
  for (const s of [-1, 1]) eye(neck, [s * 0.17, 0.24, 0.7], 0.07, s * 0.55);
  smile(neck, [0, 0.03, 0.8], 0.12, mat(0x2f6a2a, 0.5), 0.018);
  const flips = ([[-1, 0.62, 0.55, 1], [1, 0.62, 0.55, 1], [-1, -0.8, 0.38, 0.7], [1, -0.8, 0.38, 0.7]] as const).map(([s, z, l, k]) => { const f = pivot(b, [s * 0.8 * (k < 1 ? 0.85 : 1), 0, z]); ell(f, [l, 0.07, 0.2 * k + 0.02], skin, [s * l * 0.85, 0, 0], [0, s * 0.3, 0]); return f; });
  ell(b, [0.1, 0.07, 0.25], skin, [0, 0, -1.3]);
  return done(c, 1.2, (m, sp) => {
    const f = m.swim ? 6 : 1.6, a = m.swim ? 0.55 : 0.18;
    flips.forEach((p, i) => { p.rotation.y = wave(m.t, f, a, i % 2 ? Math.PI : 0) * (i < 2 ? 1 : 0.6); });
    neck.position.z = 1.15 + wave(m.t, 1.1, 0.06) + (sp >= 0 ? Math.sin(sp * Math.PI) * 0.25 : 0); neck.rotation.y = wave(m.t, 0.5, 0.3);
  }, () => 1.4);
}

function frog() {
  const c = shell("frog", "float"); const b = c.body;
  const pad = new THREE.Group(); c.g.add(pad);
  part(pad, new THREE.CircleGeometry(1.35, 36, 0.3, Math.PI * 2 - 0.6), mat(0x3f9a3a, 0.65, { side: THREE.DoubleSide }), [0, 0.03, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  part(pad, new THREE.TorusGeometry(1.35, 0.05, 6, 36, Math.PI * 2 - 0.6), mat(0x2f7a2a, 0.6), [0, 0.04, 0], [1, 1, 1], [-Math.PI / 2, 0, 0.3]);
  const g1 = mat(0x6fd04f, 0.42, { wet: true }), pale = mat(0xe2f7a8, 0.5), pink = mat(0xff8fb1, 0.6);
  ell(b, [0.78, 0.62, 0.72], g1, [0, 0.6, -0.05]);
  ell(b, [0.58, 0.45, 0.32], pale, [0, 0.5, 0.42]);
  const throat = ell(b, [0.34, 0.2, 0.24], pale, [0, 0.74, 0.6]); throat.userData.keep = true;
  ell(b, [0.72, 0.46, 0.62], g1, [0, 1.0, 0.26]);
  for (const s of [-1, 1]) { ell(b, [0.27, 0.27, 0.27], g1, [s * 0.33, 1.34, 0.36]); eye(b, [s * 0.33, 1.38, 0.5], 0.16, s * 0.35, true); ell(b, [0.13, 0.08, 0.05], pink, [s * 0.47, 0.92, 0.75]); }
  smile(b, [0, 0.98, 0.78], 0.38, mat(0x2f6a2a, 0.5), 0.028, 0.7);
  for (const s of [-1, 1]) { ell(b, [0.12, 0.34, 0.13], g1, [s * 0.42, 0.32, 0.55], [0.2, 0, s * 0.15]); ell(b, [0.2, 0.05, 0.2], g1, [s * 0.46, 0.06, 0.7]); ell(b, [0.34, 0.26, 0.58], g1, [s * 0.62, 0.32, -0.15], [0, s * 0.3, 0]); ell(b, [0.24, 0.05, 0.3], g1, [s * 0.75, 0.06, 0.32]); }
  b.remove(throat);
  const th = pivot(b, [0, 0.74, 0.6]); th.add(throat); throat.position.set(0, 0, 0);
  return done(c, 1.7, (m, sp) => {
    const puff = sp >= 0 ? Math.sin(sp * Math.PI * 4) * 0.6 : Math.max(0, wave(m.t, 2.4, 1)) * 0.25; th.scale.set(1 + puff, 1 + puff * 1.3, 1 + puff);
    if (sp >= 0) b.position.y += Math.sin(sp * Math.PI) * 1.1;
    pad.rotation.y = wave(m.t, 0.3, 0.2);
  }, () => 1.1);
}

function hippo() {
  const c = shell("hippo", "wade"); const b = c.body;
  const skin = mat(0x9c86c8, 0.5, { wet: true }), snout = mat(0xc4add9, 0.5, { wet: true }), dark = mat(0x4b3a6a, 0.5), mouth = mat(0xf27aa0, 0.6), tooth = mat(0xfffbe8, 0.3);
  ell(b, [1.08, 0.85, 1.45], skin, [0, 0.05, -0.35]);
  ell(b, [0.78, 0.62, 0.72], skin, [0, 0.62, 0.85]);
  ell(b, [0.88, 0.48, 0.55], snout, [0, 0.5, 1.4]);
  for (const s of [-1, 1]) { ell(b, [0.09, 0.05, 0.06], dark, [s * 0.24, 0.92, 1.72]); ell(b, [0.22, 0.2, 0.2], skin, [s * 0.36, 1.12, 0.95]); eye(b, [s * 0.36, 1.18, 1.08], 0.1, s * 0.4); ell(b, [0.12, 0.16, 0.07], skin, [s * 0.5, 1.25, 0.66], [0, s * 0.4, 0]); }
  const ears = [-1, 1].map(s => { const e = pivot(b, [s * 0.5, 1.28, 0.62]); ell(e, [0.12, 0.17, 0.08], skin, [0, 0.08, 0]); ell(e, [0.07, 0.11, 0.04], mouth, [0, 0.09, 0.05]); return e; });
  const jaw = pivot(b, [0, 0.32, 1.1]);
  ell(jaw, [0.8, 0.26, 0.55], snout, [0, -0.06, 0.32]); ell(jaw, [0.62, 0.12, 0.42], mouth, [0, 0.12, 0.32]);
  for (const s of [-1, 1]) part(jaw, new THREE.ConeGeometry(0.07, 0.22, 10), tooth, [s * 0.42, 0.22, 0.6]);
  for (const [x, z] of [[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.9], [0.6, -0.9]] as const) ell(b, [0.28, 0.6, 0.28], skin, [x, -0.65, z]);
  return done(c, 1.5, (m, sp) => {
    ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * Math.max(0, wave(m.t, 9, 0.5)) * (Math.sin(m.t * 0.7) > 0.6 ? 1 : 0.15); });
    jaw.rotation.x = sp >= 0 ? Math.sin(sp * Math.PI) * 0.75 : m.happy > 0 ? 0.45 : wave(m.t, 0.5, 0.04) + 0.04;
  }, () => 1.8);
}

function penguin() {
  const c = shell("penguin", "float"); const b = c.body;
  const blk = mat(0x1f2633, 0.38, { wet: true }), wht = mat(0xf8fafc, 0.45), org = mat(0xff9a1f, 0.4), yel = mat(0xffcf3a, 0.5);
  ell(b, [0.64, 0.95, 0.6], blk, [0, 0.42, 0]);
  ell(b, [0.52, 0.8, 0.3], wht, [0, 0.36, 0.34]);
  const head = pivot(b, [0, 1.38, 0.05]);
  ell(head, [0.5, 0.46, 0.47], blk, [0, 0, 0]);
  ell(head, [0.36, 0.3, 0.2], wht, [0, -0.05, 0.3]);
  for (const s of [-1, 1]) { ell(head, [0.12, 0.2, 0.08], yel, [s * 0.36, -0.22, 0.15]); eye(head, [s * 0.15, 0.08, 0.43], 0.068, s * 0.4); ell(head, [0.08, 0.05, 0.03], mat(0xffa3b8, 0.6), [s * 0.24, -0.07, 0.43]); }
  part(head, new THREE.ConeGeometry(0.085, 0.32, 14), org, [0, -0.05, 0.6], [1, 1, 0.75], [Math.PI / 2, 0, 0]);
  const flips = [-1, 1].map(s => { const f = pivot(b, [s * 0.58, 0.9, 0]); ell(f, [0.1, 0.5, 0.22], blk, [s * 0.08, -0.42, 0], [0, 0, s * 0.25]); return f; });
  for (const s of [-1, 1]) ell(b, [0.16, 0.06, 0.24], org, [s * 0.22, -0.52, 0.18]);
  return done(c, 2.0, (m, sp) => {
    const flap = sp >= 0 || m.happy > 0 ? Math.abs(Math.sin(m.t * 14)) * 0.9 : 0.1 + Math.max(0, wave(m.t, 1.3, 0.15));
    flips.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * flap; });
    head.rotation.z = wave(m.t, 0.9, 0.12); head.rotation.x = m.swim ? -0.15 : 0;
    if (sp >= 0) { b.position.y -= Math.sin(sp * Math.PI) * 1.4; b.rotation.x = Math.sin(sp * Math.PI) * 0.6; }
  }, () => 1.4);
}

function seal() {
  const c = shell("seal", "float"); const b = c.body;
  const fur = mat(0x8a9bb0, 0.4, { wet: true }), pale = mat(0xc9d4e0, 0.45, { wet: true }), dk = mat(0x2a3140, 0.3);
  torpedo(b, 2.3, 0.56, t => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.03)), 0.7), 0x7f91a8, 0xd4dde7, [0, 0.0, -0.2]);
  ell(b, [0.48, 0.55, 0.5], fur, [0, 0.42, 0.72], [-0.5, 0, 0]);
  const head = pivot(b, [0, 0.85, 1.0]);
  ell(head, [0.46, 0.43, 0.48], fur, [0, 0, 0]);
  ell(head, [0.3, 0.2, 0.26], pale, [0, -0.1, 0.36]);
  ell(head, [0.1, 0.07, 0.06], dk, [0, -0.02, 0.6]);
  for (const s of [-1, 1]) { eye(head, [s * 0.22, 0.12, 0.34], 0.12, s * 0.45); for (let k = 0; k < 3; k++) part(head, new THREE.CylinderGeometry(0.008, 0.008, 0.34, 4), mat(0xffffff, 0.4), [s * 0.28, -0.1 + k * 0.04, 0.48], [1, 1, 1], [0, 0, Math.PI / 2 + s * (0.1 - k * 0.1)]); }
  for (const s of [-1, 1]) ell(b, [0.1, 0.36, 0.2], fur, [s * 0.52, 0.0, 0.5], [0.4, 0, s * 0.5]);
  for (const s of [-1, 1]) ell(b, [0.1, 0.18, 0.34], fur, [s * 0.18, 0.18, -1.32], [0.6, s * 0.3, 0]);
  const ballTex = texture(256, 128, x => { const cs = ["#ef4444", "#ffffff", "#3b82f6", "#ffffff", "#facc15", "#ffffff"]; cs.forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); }); });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 18), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.3 })); ball.castShadow = true; ball.userData.keep = true; b.add(ball);
  return done(c, 1.8, (m, sp) => {
    head.rotation.x = wave(m.t, 1.4, 0.08); head.rotation.y = wave(m.t, 0.6, 0.3);
    const onNose = sp >= 0 || m.happy > 0;
    if (onNose) { const hop = Math.abs(Math.sin(m.t * 6)) * 0.5; ball.position.set(0, 1.62 + hop, 1.55); head.rotation.x = -0.35; ball.rotation.y += m.dt * 6; }
    else { ball.position.set(0.95, 0.22 + wave(m.t, 2, 0.04), 0.55); ball.rotation.y += m.dt * 0.4; }
  }, () => 2.4);
}

function elephant() {
  const c = shell("elephant", "wade"); const b = c.body;
  const skin = mat(0x9aa6b4, 0.62), pink = mat(0xf2b8c6, 0.6), ivory = mat(0xfffbe8, 0.3);
  ell(b, [0.98, 0.85, 1.25], skin, [0, 0.62, -0.35]);
  for (const [x, z] of [[-0.55, 0.35], [0.55, 0.35], [-0.55, -1.0], [0.55, -1.0]] as const) part(b, new THREE.CylinderGeometry(0.27, 0.3, 1.5, 16), skin, [x, -0.2, z]);
  const head = pivot(b, [0, 1.3, 0.78]);
  ell(head, [0.68, 0.66, 0.62], skin, [0, 0, 0]);
  for (const s of [-1, 1]) { eye(head, [s * 0.36, 0.17, 0.45], 0.085, s * 0.55); part(head, new THREE.ConeGeometry(0.06, 0.38, 10), ivory, [s * 0.24, -0.42, 0.45], [1, 1, 1], [1.9, 0, s * 0.2]); ell(head, [0.1, 0.06, 0.04], mat(0xffa3b8, 0.6), [s * 0.42, -0.04, 0.42]); }
  const ears = [-1, 1].map(s => { const e = pivot(head, [s * 0.5, 0.08, -0.05], [0, s * 0.5, 0]); ell(e, [0.56, 0.66, 0.08], skin, [s * 0.45, -0.05, 0]); ell(e, [0.42, 0.5, 0.05], pink, [s * 0.45, -0.05, 0.05]); return e; });
  // trunk: a chain of joints so it can curl up and spray
  const segs: THREE.Group[] = []; let parent: THREE.Object3D = head; const N = 7;
  for (let i = 0; i < N; i++) { const j = pivot(parent, i === 0 ? [0, -0.18, 0.55] : [0, -0.21, 0]); const r = 0.21 - i * 0.017; part(j, new THREE.CylinderGeometry(r * 0.92, r, 0.24, 14), skin, [0, -0.1, 0]); if (i === N - 1) { ell(j, [r * 1.05, 0.05, r * 1.05], mat(0x7d8896, 0.6), [0, -0.23, 0]); } segs.push(j); parent = j; }
  part(b, new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6), skin, [0, 0.75, -1.58], [1, 1, 1], [-0.6, 0, 0]);
  const tip = new THREE.Object3D(); segs[N - 1].add(tip); tip.position.y = -0.25;
  let sprayT = 0;
  return done(c, 2.1, (m, sp) => {
    ears.forEach((e, i) => { e.rotation.y = (i ? 1 : -1) * (0.5 + wave(m.t, 2.6, 0.22) + (m.happy > 0 ? wave(m.t, 14, 0.4) : 0)); });
    const lift = sp >= 0 ? Math.sin(Math.min(1, sp * 2.2) * Math.PI / 2) * (sp > 0.85 ? (1 - sp) / 0.15 : 1) : m.happy > 0 ? 0.6 : 0;
    segs.forEach((s, i) => { s.rotation.x = (0.12 + wave(m.t, 1.3, 0.07, i * 0.6)) * (1 - lift) - lift * 0.4; });
    head.rotation.x = wave(m.t, 0.8, 0.04) - lift * 0.15;
    if (sp >= 0 && sp > 0.35 && sp < 0.85 && c.emit) { sprayT -= m.dt; if (sprayT <= 0) { sprayT = 0.05; c.emit("spray", tip.getWorldPosition(new THREE.Vector3())); } }
  }, () => 2.6);
}

function lion() {
  const c = shell("lion", "float"); const b = c.body;
  const fur = mat(0xe9a84c, 0.6), mane = mat(0xb4611f, 0.75), mane2 = mat(0x9a4e16, 0.75), cream = mat(0xf7e0b5, 0.6), dk = mat(0x3a2418, 0.4);
  ell(b, [0.62, 0.55, 1.15], fur, [0, -0.15, -0.45]);
  const legs = ([[-1, 0.25], [1, 0.25], [-1, -1.0], [1, -1.0]] as const).map(([s, z]) => { const l = pivot(b, [s * 0.42, -0.2, z]); ell(l, [0.17, 0.42, 0.17], fur, [0, -0.3, 0.05], [0.5, 0, 0]); ell(l, [0.17, 0.12, 0.2], cream, [0, -0.62, 0.25]); return l; });
  const tail = tube(b, [[0, -0.05, -1.5], [0, 0.0, -1.9], [0.1, 0.15, -2.2]], 0.05, fur); void tail; ell(b, [0.13, 0.13, 0.17], mane, [0.1, 0.17, -2.25]);
  const head = pivot(b, [0, 0.72, 0.62]);
  part(head, new THREE.TorusGeometry(0.58, 0.3, 14, 36), mane, [0, 0.02, -0.12]);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; ell(head, [0.24, 0.24, 0.22], i % 2 ? mane : mane2, [Math.cos(a) * 0.78, Math.sin(a) * 0.78 + 0.02, -0.18]); }
  ell(head, [0.6, 0.6, 0.45], mane, [0, 0.02, -0.35]);
  ell(head, [0.52, 0.5, 0.46], fur, [0, 0, 0]);
  ell(head, [0.3, 0.22, 0.24], cream, [0, -0.15, 0.36]); ell(head, [0.13, 0.08, 0.07], dk, [0, -0.04, 0.56]);
  for (const s of [-1, 1]) { eye(head, [s * 0.2, 0.12, 0.38], 0.08, s * 0.4, false, 0x3b2a12); ell(head, [0.14, 0.14, 0.08], fur, [s * 0.36, 0.42, 0.05]); ell(head, [0.08, 0.08, 0.05], dk, [s * 0.36, 0.42, 0.1]); }
  const jaw = pivot(head, [0, -0.24, 0.32]); ell(jaw, [0.2, 0.1, 0.16], cream, [0, -0.04, 0.06]); ell(jaw, [0.14, 0.05, 0.1], mat(0xd9506a, 0.6), [0, 0.02, 0.08]);
  return done(c, 1.9, (m, sp) => {
    const f = m.swim ? 6 : 2.2; legs.forEach((l, i) => { l.rotation.x = wave(m.t, f, m.swim ? 0.6 : 0.25, (i % 2) * Math.PI + (i > 1 ? 1 : 0)); });
    jaw.rotation.x = sp >= 0 ? Math.sin(sp * Math.PI) * 0.7 : m.happy > 0 ? 0.4 : 0.05;
    head.rotation.z = sp >= 0 ? Math.sin(sp * Math.PI * 6) * 0.15 : wave(m.t, 0.8, 0.06);
  }, () => 1.3);
}

function dolphin() {
  const c = shell("dolphin", "leap"); const b = c.body;
  const top = 0x3b8fd0, belly = 0xeaf6fd, finM = mat(0x3580bf, 0.35, { wet: true });
  const fish = pivot(b, [0, 0, 0]);
  torpedo(fish, 2.5, 0.5, t => t < 0.88 ? Math.pow(Math.sin(Math.PI * (t * 0.86 + 0.04)), 0.75) : 0.38 * (1 - (t - 0.88) / 0.12) + 0.17, top, belly, [0, 0, 0]);
  ell(fish, [0.16, 0.13, 0.3], mat(0x3b8fd0, 0.35, { wet: true }), [0, -0.06, 1.3]);
  fin(fish, [[0, 0], [0.5, 0], [0.3, 0.14], [0.08, 0.42], [-0.15, 0.6], [-0.12, 0.3], [-0.16, 0.06]], 0.035, finM, "side", [0, 0.42, -0.2]);
  for (const s of [-1, 1]) { ell(fish, [0.34, 0.045, 0.15], finM, [s * 0.52, -0.22, 0.35], [0, s * 0.5, s * -0.45]); eye(fish, [s * 0.27, 0.12, 0.98], 0.075, s * 0.9); }
  smile(fish, [0, -0.05, 1.27], 0.17, mat(0x2a5f8a, 0.4), 0.018, 0.6);
  const tail = pivot(fish, [0, 0, -1.25]);
  fin(tail, [[0, 0.05], [0.35, -0.3], [0.62, -0.42], [0.28, -0.12], [0, -0.18], [-0.28, -0.12], [-0.62, -0.42], [-0.35, -0.3], [0, 0.05]], 0.04, finM, "flat", [0, 0, 0]);
  return done(c, 1.9, (m) => {
    // sits up out of the water to chat, swims flat when moving
    const up = m.swim > 0.5 ? 0 : 1; fish.rotation.x = THREE.MathUtils.lerp(fish.rotation.x, -0.95 * up, Math.min(1, m.dt * 4)); fish.position.y = THREE.MathUtils.lerp(fish.position.y, 0.55 * up, Math.min(1, m.dt * 4));
    tail.rotation.x = wave(m.t, m.swim ? 7 : 3, m.swim ? 0.45 : 0.2); fish.rotation.z = wave(m.t, 1.6, 0.08);
  }, () => 1.6);
}

function otter() {
  const c = shell("otter", "float"); const b = c.body;
  const fur = mat(0x8b5a2b, 0.55, { wet: true }), belly = mat(0xc89b6a, 0.6), face = mat(0xe8cfa8, 0.6), dk = mat(0x2a1a10, 0.4), shellM = mat(0xffc2d4, 0.4);
  ell(b, [0.52, 0.4, 1.0], fur, [0, 0.05, -0.1]);
  ell(b, [0.42, 0.22, 0.78], belly, [0, 0.26, -0.05]);
  const head = pivot(b, [0, 0.45, 0.9], [-0.35, 0, 0]);
  ell(head, [0.43, 0.39, 0.42], fur, [0, 0, 0]);
  ell(head, [0.3, 0.22, 0.25], face, [0, -0.04, 0.27]); ell(head, [0.1, 0.07, 0.06], dk, [0, 0.06, 0.48]);
  for (const s of [-1, 1]) { eye(head, [s * 0.17, 0.15, 0.33], 0.075, s * 0.4); ell(head, [0.1, 0.1, 0.06], fur, [s * 0.33, 0.25, -0.05]); for (let k = 0; k < 2; k++) part(head, new THREE.CylinderGeometry(0.007, 0.007, 0.3, 4), mat(0xffffff, 0.4), [s * 0.25, -0.04 + k * 0.05, 0.4], [1, 1, 1], [0, 0, Math.PI / 2 + s * (0.15 - k * 0.15)]); }
  const hands = pivot(b, [0, 0.42, 0.42]);
  const sh = part(hands, new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI), shellM, [0, 0.12, 0.05], [1, 0.3, 1], [Math.PI / 2, 0, 0]); void sh;
  for (const s of [-1, 1]) ell(hands, [0.1, 0.09, 0.12], fur, [s * 0.16, 0.08, 0.05]);
  for (const s of [-1, 1]) ell(b, [0.13, 0.22, 0.12], fur, [s * 0.25, 0.3, -0.8], [0.6, 0, 0]);
  const tail = pivot(b, [0, 0.0, -1.05]); ell(tail, [0.14, 0.07, 0.55], fur, [0, 0, -0.45]);
  return done(c, 1.4, (m, sp) => {
    b.rotation.z = wave(m.t, 0.9, 0.08) + (sp >= 0 ? Math.sin(sp * Math.PI * 2) * 0.6 : 0);
    hands.rotation.x = sp >= 0 || m.happy > 0 ? Math.abs(Math.sin(m.t * 10)) * -0.3 : 0; head.rotation.y = wave(m.t, 0.7, 0.25);
    tail.rotation.y = wave(m.t, m.swim ? 6 : 1.5, m.swim ? 0.5 : 0.2);
  }, () => 1.4);
}

function crocodile() {
  const c = shell("crocodile", "float"); const b = c.body;
  const skin = mat(0x5f8f3a, 0.55, { wet: true }), belly = mat(0xc8d68a, 0.6), bump = mat(0x4a7a2a, 0.6), tooth = mat(0xfffbe8, 0.3);
  ell(b, [0.62, 0.3, 1.0], skin, [0, 0.0, -0.2]); ell(b, [0.52, 0.12, 0.85], belly, [0, -0.18, -0.2]);
  const tail = pivot(b, [0, 0, -1.1]);
  let tp: THREE.Object3D = tail; const tsegs: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) { const s = pivot(tp, i ? [0, 0, -0.42] : [0, 0, 0]); ell(s, [0.42 - i * 0.09, 0.22 - i * 0.04, 0.32], skin, [0, 0, -0.2]); part(s, new THREE.ConeGeometry(0.06, 0.16, 6), bump, [0, 0.2 - i * 0.04, -0.2]); tsegs.push(s); tp = s; }
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) part(b, new THREE.ConeGeometry(0.07, 0.16, 6), bump, [s * 0.2, 0.28, 0.5 - i * 0.35]);
  const head = pivot(b, [0, 0.06, 0.75]);
  ell(head, [0.44, 0.26, 0.42], skin, [0, 0.06, 0.05]);
  ell(head, [0.3, 0.14, 0.78], skin, [0, 0.06, 0.75]);
  for (const s of [-1, 1]) { ell(head, [0.16, 0.15, 0.16], skin, [s * 0.2, 0.26, 0.05]); eye(head, [s * 0.2, 0.32, 0.15], 0.1, s * 0.3, true, 0x2a2205); ell(head, [0.05, 0.05, 0.05], bump, [s * 0.1, 0.18, 1.45]); for (let k = 0; k < 5; k++) part(head, new THREE.ConeGeometry(0.035, 0.11, 6), tooth, [s * 0.24, -0.06, 0.45 + k * 0.18], [1, 1, 1], [Math.PI, 0, 0]); }
  const jaw = pivot(head, [0, -0.04, 0.25]); ell(jaw, [0.28, 0.08, 0.72], belly, [0, -0.04, 0.48]); ell(jaw, [0.22, 0.04, 0.6], mat(0xf27aa0, 0.6), [0, 0.03, 0.45]);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) part(jaw, new THREE.ConeGeometry(0.03, 0.1, 6), tooth, [s * 0.2, 0.06, 0.25 + k * 0.18]);
  for (const [x, z] of [[-0.6, 0.45], [0.6, 0.45], [-0.55, -0.8], [0.55, -0.8]] as const) ell(b, [0.2, 0.1, 0.26], skin, [x, -0.1, z], [0, 0, x > 0 ? -0.4 : 0.4]);
  return done(c, 0.95, (m, sp) => {
    tsegs.forEach((s, i) => { s.rotation.y = wave(m.t, m.swim ? 4 : 1.2, m.swim ? 0.3 : 0.12, i * 0.8); });
    jaw.rotation.x = sp >= 0 ? (sp < 0.7 ? Math.sin((sp / 0.7) * Math.PI / 2) * 0.6 : (1 - sp) / 0.3 * 0.6) : m.happy > 0 ? 0.3 : 0;
    head.rotation.x = sp >= 0 ? -jaw.rotation.x * 0.3 : 0;
  }, () => 1.4);
}

function flamingo() {
  const c = shell("flamingo", "wade"); const b = c.body;
  const pink = mat(0xff8fb8, 0.5), deep = mat(0xff5d9a, 0.5), leg = mat(0xf26a96, 0.45), beak = mat(0xfff1e0, 0.4), tip = mat(0x1f1f1f, 0.4);
  const k = 0.82; const fl = pivot(b, [0, 0, 0], [0, 0, 0]); fl.scale.setScalar(k);
  part(fl, new THREE.CylinderGeometry(0.045, 0.045, 2.3, 8), leg, [0.12, 0.25, 0]);
  const knee = pivot(fl, [-0.12, 1.0, 0]); part(knee, new THREE.CylinderGeometry(0.045, 0.045, 0.75, 8), leg, [0, 0.0, 0], [1, 1, 1], [0.0, 0, 0]); part(knee, new THREE.CylinderGeometry(0.045, 0.045, 0.7, 8), leg, [0, -0.3, -0.32], [1, 1, 1], [-1.9, 0, 0]);
  ell(fl, [0.48, 0.42, 0.78], pink, [0, 1.75, -0.15]);
  for (const s of [-1, 1]) ell(fl, [0.12, 0.34, 0.62], deep, [s * 0.4, 1.8, -0.25], [0.15, 0, s * 0.2]);
  ell(fl, [0.25, 0.14, 0.38], deep, [0, 1.85, -0.9], [-0.5, 0, 0]);
  const neckPts: V[] = [[0, 1.95, 0.4], [0, 2.45, 0.62], [0, 2.95, 0.35], [0, 3.35, 0.5]];
  tube(fl, neckPts, 0.1, pink, 0.85);
  const head = pivot(fl, [0, 3.45, 0.62]);
  ell(head, [0.2, 0.2, 0.22], pink, [0, 0, 0]);
  for (const s of [-1, 1]) eye(head, [s * 0.13, 0.06, 0.1], 0.05, s * 0.6, false, 0x2a1a05);
  const bk = pivot(head, [0, -0.02, 0.18], [0.5, 0, 0]); ell(bk, [0.08, 0.08, 0.2], beak, [0, 0, 0.12]); const tp = pivot(bk, [0, 0, 0.28], [0.8, 0, 0]); ell(tp, [0.06, 0.06, 0.14], tip, [0, 0, 0.08]);
  return done(c, 3.0 * k, (m, sp) => {
    head.rotation.x = wave(m.t, 1.2, 0.1); head.rotation.y = wave(m.t, 0.5, 0.35);
    knee.rotation.x = sp >= 0 ? -Math.sin(sp * Math.PI) * 0.6 : 0;
    if (sp >= 0) fl.rotation.y = Math.sin(sp * Math.PI * 2) * 0.4;
  }, () => 1.8);
}

function polarBear() {
  const c = shell("polar-bear", "float"); const b = c.body;
  const fur = mat(0xf4f1ea, 0.7), dk = mat(0x1f2937, 0.35), pink = mat(0xffb3c1, 0.6);
  ell(b, [0.75, 0.62, 1.25], fur, [0, -0.15, -0.4]);
  const legs = ([[-1, 0.35], [1, 0.35], [-1, -1.15], [1, -1.15]] as const).map(([s, z]) => { const l = pivot(b, [s * 0.5, -0.25, z]); ell(l, [0.2, 0.45, 0.22], fur, [0, -0.3, 0.05], [0.5, 0, 0]); return l; });
  ell(b, [0.12, 0.12, 0.1], fur, [0, 0.1, -1.6]);
  const head = pivot(b, [0, 0.58, 0.85]);
  ell(head, [0.52, 0.48, 0.55], fur, [0, 0, 0]);
  ell(head, [0.27, 0.22, 0.3], fur, [0, -0.1, 0.45]); ell(head, [0.11, 0.08, 0.07], dk, [0, 0.0, 0.73]);
  for (const s of [-1, 1]) { eye(head, [s * 0.2, 0.15, 0.4], 0.07, s * 0.45); ell(head, [0.14, 0.14, 0.1], fur, [s * 0.36, 0.38, 0.0]); ell(head, [0.08, 0.08, 0.05], pink, [s * 0.36, 0.38, 0.06]); ell(head, [0.1, 0.06, 0.04], pink, [s * 0.32, -0.08, 0.38]); }
  smile(head, [0, -0.17, 0.68], 0.08, dk, 0.016, 0.6);
  return done(c, 1.4, (m, sp) => {
    const f = m.swim ? 6 : 2; legs.forEach((l, i) => { l.rotation.x = wave(m.t, f, m.swim ? 0.65 : 0.25, (i % 2) * Math.PI + (i > 1 ? 1 : 0)); });
    head.rotation.z = wave(m.t, 0.8, 0.08); head.rotation.x = sp >= 0 ? -Math.sin(sp * Math.PI * 2) * 0.3 : 0;
    if (sp >= 0) b.position.y -= Math.sin(sp * Math.PI) * 0.9;
  }, () => 1.6);
}

function beaver() {
  const c = shell("beaver", "float"); const b = c.body;
  const fur = mat(0x8a5a2e, 0.65, { wet: true }), belly = mat(0xb98a5a, 0.65), face = mat(0xd8b48a, 0.6), dk = mat(0x2a1a10, 0.4), tooth = mat(0xffe0a3, 0.35), tailM = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.6, map: texture(128, 128, x => { x.fillStyle = "#6b4c38"; x.fillRect(0, 0, 128, 128); x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 3; for (let i = -128; i < 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i + 128, 0); x.lineTo(i, 128); x.stroke(); } }) });
  ell(b, [0.62, 0.52, 0.88], fur, [0, 0.12, -0.05]); ell(b, [0.48, 0.38, 0.5], belly, [0, 0.1, 0.35]);
  const head = pivot(b, [0, 0.66, 0.7]);
  ell(head, [0.46, 0.42, 0.44], fur, [0, 0, 0]);
  ell(head, [0.28, 0.2, 0.22], face, [0, -0.1, 0.34]); ell(head, [0.1, 0.07, 0.06], dk, [0, 0.0, 0.54]);
  for (const s of [-1, 1]) { eye(head, [s * 0.2, 0.14, 0.34], 0.07, s * 0.45); ell(head, [0.1, 0.1, 0.06], fur, [s * 0.34, 0.3, -0.05]); part(head, new THREE.BoxGeometry(0.08, 0.15, 0.04), tooth, [s * 0.045, -0.27, 0.48]); }
  const stick = pivot(head, [0, -0.2, 0.5]); part(stick, new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), mat(0x7a5232, 0.8), [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]); for (const s of [-1, 1]) ell(stick, [0.1, 0.03, 0.06], mat(0x4fa846, 0.6), [s * 0.45, 0.06, 0], [0, 0, s * 0.4]);
  for (const s of [-1, 1]) ell(b, [0.12, 0.22, 0.12], fur, [s * 0.4, 0.3, 0.55], [0.6, 0, 0]);
  const tail = pivot(b, [0, 0.05, -0.85]); part(tail, UNIT, tailM, [0, 0, -0.55], [0.4, 0.07, 0.62]);
  return done(c, 1.45, (m, sp) => {
    if (sp >= 0) { const up = sp < 0.6 ? Math.sin((sp / 0.6) * Math.PI / 2) : Math.max(0, 1 - (sp - 0.6) / 0.08); tail.rotation.x = -up * 1.3; if (sp > 0.66 && sp < 0.7 && c.emit) c.emit("splash", tail.localToWorld(new THREE.Vector3(0, 0, -0.9))); }
    else tail.rotation.x = wave(m.t, m.swim ? 6 : 1.2, m.swim ? 0.35 : 0.08);
    head.rotation.y = wave(m.t, 0.6, 0.2); stick.rotation.z = wave(m.t, 1.1, 0.05);
  }, () => 1.3);
}

function shark() {
  const c = shell("shark", "leap"); const b = c.body;
  const finM = mat(0x5f7894, 0.35, { wet: true }); const fish = pivot(b, [0, 0, 0]);
  torpedo(fish, 2.8, 0.52, t => t < 0.72 ? Math.pow(Math.sin(Math.PI * (t * 0.66 + 0.025)), 0.8) : Math.pow(Math.max(0, Math.cos(((t - 0.72) / 0.28) * Math.PI / 2)), 0.62), 0x6b84a0, 0xf1f5f9, [0, 0, 0]);
  fin(fish, [[0, 0], [0.6, 0], [0.4, 0.12], [0.18, 0.42], [-0.05, 0.72], [-0.2, 0.74], [-0.12, 0.42], [-0.18, 0.1]], 0.035, finM, "side", [0, 0.44, -0.1]);
  for (const s of [-1, 1]) { ell(fish, [0.42, 0.05, 0.18], finM, [s * 0.6, -0.24, 0.3], [0, s * 0.55, s * -0.5]); eye(fish, [s * 0.3, 0.13, 0.9], 0.075, s * 0.95); for (let k = 0; k < 3; k++) part(fish, new THREE.BoxGeometry(0.01, 0.22, 0.03), mat(0x46607c, 0.5), [s * 0.43, -0.02, 0.55 - k * 0.1], [1, 1, 1], [0, 0, 0]); }
  const grin = smile(fish, [0, -0.15, 1.12], 0.22, mat(0x24364a, 0.4), 0.02, 0.62); void grin;
  for (let k = -2; k <= 2; k++) part(fish, new THREE.ConeGeometry(0.025, 0.07, 5), mat(0xffffff, 0.3), [k * 0.06, -0.22 + Math.abs(k) * 0.025, 1.16 - Math.abs(k) * 0.03], [1, 1, 1], [Math.PI, 0, 0]);
  const tail = pivot(fish, [0, 0, -1.3]);
  fin(tail, [[-0.05, 0.08], [0.2, 0.25], [0.45, 0.55], [0.6, 0.72], [0.48, 0.38], [0.3, 0.05], [0.42, -0.25], [0.45, -0.42], [0.2, -0.2], [-0.05, -0.08]], 0.035, finM, "side", [0, 0, 0], [0, Math.PI, 0]);
  return done(c, 1.45, (m) => {
    const up = m.swim > 0.5 ? 0 : 1; fish.rotation.x = THREE.MathUtils.lerp(fish.rotation.x, -0.35 * up, Math.min(1, m.dt * 4)); fish.position.y = THREE.MathUtils.lerp(fish.position.y, 0.32 * up, Math.min(1, m.dt * 4));
    tail.rotation.y = wave(m.t, m.swim ? 7 : 2.5, m.swim ? 0.45 : 0.22); fish.rotation.y = wave(m.t, m.swim ? 7 : 2.5, 0.06, 1);
  }, () => 1.6);
}

function whale() {
  const c = shell("whale", "float"); const b = c.body;
  const finM = mat(0x3563a8, 0.35, { wet: true }); const fish = pivot(b, [0, 0, 0]);
  torpedo(fish, 3.0, 0.9, t => t < 0.7 ? 0.25 + 0.75 * Math.pow(t / 0.7, 0.55) : Math.pow(Math.cos(((t - 0.7) / 0.3) * Math.PI / 2), 0.45), 0x3d6fb8, 0xdde9f6, [0, 0.05, 0]);
  for (const s of [-1, 1]) { eye(fish, [s * 0.8, 0.12, 0.95], 0.11, s * 1.05); ell(fish, [0.55, 0.06, 0.24], finM, [s * 0.85, -0.42, 0.35], [0, s * 0.5, s * -0.55]); ell(fish, [0.12, 0.07, 0.04], mat(0xffa3b8, 0.6), [s * 0.8, -0.08, 1.05], [0, s * 1.0, 0]); }
  smile(fish, [0, 0.05, 1.3], 0.55, mat(0x22406e, 0.4), 0.025, 0.36);
  ell(fish, [0.07, 0.03, 0.12], mat(0x22406e, 0.4), [0, 0.9, 0.55]);
  const tail = pivot(fish, [0, 0.05, -1.45]);
  fin(tail, [[0, 0.1], [0.45, -0.2], [0.85, -0.45], [0.4, -0.05], [0, -0.15], [-0.4, -0.05], [-0.85, -0.45], [-0.45, -0.2], [0, 0.1]], 0.06, finM, "flat", [0, 0, 0]);
  const blow = new THREE.Object3D(); fish.add(blow); blow.position.set(0, 0.95, 0.55);
  let st = 0;
  return done(c, 1.4, (m, sp) => {
    tail.rotation.x = wave(m.t, m.swim ? 4 : 1.4, m.swim ? 0.45 : 0.3) - 0.15; fish.rotation.x = wave(m.t, 1.4, 0.04);
    if (sp >= 0 && sp < 0.6 && c.emit) { st -= m.dt; if (st <= 0) { st = 0.04; c.emit("spout", blow.getWorldPosition(new THREE.Vector3())); } }
  }, () => 1.8);
}

const BUILD: Record<string, () => Creature> = { duck, turtle, frog, hippo, penguin, seal, elephant, lion, dolphin, otter, crocodile, flamingo, "polar-bear": polarBear, beaver, shark, whale };
export const CREATURE_IDS = Object.keys(BUILD);
export function makeCreature(id: string): Creature { return (BUILD[id] ?? duck)(); }
