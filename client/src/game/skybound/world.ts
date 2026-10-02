// Skybound Sprint — builds the 3D level (tiles, islands, decorations, backdrop) from a LevelDef.
import * as THREE from "three";
import { T, isSolidTile, type LevelDef } from "@shared/skybound/sim";
import type { Sim } from "@shared/skybound/sim";
import { THEMES, type Theme } from "./themes";
import { makeTileTextures } from "./textures";

export const DEPTH = 2.6;

function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler();

/** Collects transforms per (geometry, material) and turns them into InstancedMeshes. */
class Batch {
  items: { m: THREE.Matrix4; c?: THREE.Color }[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material | THREE.Material[], public shadow = true, public receive = true) { }
  add(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, color?: THREE.Color) {
    tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE); tmpS.set(sx, sy, sz); tmpP.set(x, y, z);
    this.items.push({ m: new THREE.Matrix4().compose(tmpP, tmpQ, tmpS), c: color }); return this.items.length - 1;
  }
  build(parent: THREE.Object3D) {
    if (!this.items.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.items.length);
    this.items.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = this.shadow; im.receiveShadow = this.receive; im.frustumCulled = false;
    parent.add(im); return im;
  }
}

type DynTile = { mesh: THREE.InstancedMesh; index: number; base: THREE.Matrix4 };

export class World {
  group = new THREE.Group();
  theme: Theme;
  private dyn = new Map<number, DynTile[]>(); // tile index → instances that represent it
  private usedFor = new Map<number, DynTile>();
  private last: Uint8Array;
  private animated: ((t: number, dt: number) => void)[] = [];
  private moved = new Set<number>();
  readonly sunTarget = new THREE.Object3D();
  updraftMats: THREE.ShaderMaterial[] = [];

  constructor(public level: LevelDef, private quality: "low" | "medium" | "high") {
    this.theme = THEMES[level.theme];
    this.last = level.tiles.slice();
    this.buildTiles();
    this.buildBackdrop();
  }

  private isGroundish(t: number) { return t === T.GROUND || t === T.STONE || t === T.METAL || t === T.ICE; }

  private buildTiles() {
    const L = this.level, th = this.theme, tx = makeTileTextures(th);
    const box = new THREE.BoxGeometry(1, 1, DEPTH);
    const M = (map: THREE.Texture, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, ...extra });
    const grassTopM = M(tx.grassTop), dirtLipM = M(tx.dirtLip), dirtM = M(tx.dirt);
    const stoneTex = L.theme === "fortress" || L.theme === "storm" ? tx.stone : tx.stone;
    const mats = {
      top: [dirtLipM, dirtLipM, grassTopM, dirtM, dirtLipM, dirtLipM],
      inner: dirtM, stone: M(stoneTex), brick: M(tx.brick, { roughness: 0.7 }), gift: M(tx.gift, { roughness: 0.4, emissive: 0x6b3a00, emissiveIntensity: 0.15 }),
      used: M(tx.used), metal: M(tx.metal, { roughness: 0.4, metalness: 0.5 }), crumble: M(tx.crumble),
      ice: new THREE.MeshStandardMaterial({ map: tx.ice, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92, emissive: 0x3fb0d8, emissiveIntensity: 0.12 }),
    };
    const batches: Record<string, Batch> = {
      top: new Batch(box, mats.top), inner: new Batch(box, mats.inner), stone: new Batch(box, mats.stone), brick: new Batch(box, mats.brick),
      gift: new Batch(box, mats.gift), used: new Batch(box, mats.used), metal: new Batch(box, mats.metal), crumble: new Batch(box, mats.crumble), ice: new Batch(box, mats.ice),
    };
    const cap = new Batch(new THREE.BoxGeometry(1.0, 0.22, DEPTH + 0.2), new THREE.MeshStandardMaterial({ map: tx.grassTop, roughness: 0.9 }));
    const plank = new Batch(new THREE.BoxGeometry(1, 0.28, DEPTH * 0.8), L.theme === "clouds" ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }) : new THREE.MeshStandardMaterial({ map: tx.plank, roughness: 0.75 }));
    const bounce = new Batch(new THREE.SphereGeometry(0.62, 18, 12), new THREE.MeshStandardMaterial({ color: 0xff8fd0, emissive: 0xff4fb0, emissiveIntensity: 0.25, roughness: 0.85 }));
    const spike = new Batch(new THREE.ConeGeometry(0.16, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x9ff3ff, emissive: 0x2fb8ff, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.2 }));
    const under = new Batch(new THREE.ConeGeometry(0.62, 1, 7), new THREE.MeshStandardMaterial({ color: new THREE.Color(th.sideDark), roughness: 1, flatShading: true }), false, false);
    const r = rng(L.w * 31 + L.h);
    const tileBatchIndex: { idx: number; batch: string; i: number; x?: number; y?: number }[] = [];
    const tile = (c: number, row: number) => (c < 0 || c >= L.w || row < 0 || row >= L.h) ? 0 : L.tiles[row * L.w + c];

    for (let row = 0; row < L.h; row++) for (let c = 0; c < L.w; c++) {
      const t = tile(c, row); if (!t) continue;
      const x = c + 0.5, y = row + 0.5, idx = row * L.w + c;
      const above = tile(c, row + 1);
      const open = !isSolidTile(above);
      switch (t) {
        case T.GROUND: {
          const b = open ? "top" : "inner"; tileBatchIndex.push({ idx, batch: b, i: batches[b].add(x, y, 0) });
          if (open && L.theme !== "caverns") cap.add(x, row + 0.93, 0);
          break;
        }
        case T.STONE: tileBatchIndex.push({ idx, batch: "stone", i: batches.stone.add(x, y, 0) }); break;
        case T.BRICK: tileBatchIndex.push({ idx, batch: "brick", i: batches.brick.add(x, y, 0) }); break;
        case T.GIFT: tileBatchIndex.push({ idx, batch: "gift", i: batches.gift.add(x, y, 0, 0.98, 0.98, 0.98) }); tileBatchIndex.push({ idx: -idx - 1, batch: "used", i: batches.used.add(x, y, 0, 0, 0, 0), x, y }); break;
        case T.USED: batches.used.add(x, y, 0); break;
        case T.METAL: tileBatchIndex.push({ idx, batch: "metal", i: batches.metal.add(x, y, 0) }); break;
        case T.CRUMBLE: tileBatchIndex.push({ idx, batch: "crumble", i: batches.crumble.add(x, y, 0, 0.98, 0.98, 0.98) }); break;
        case T.ICE: tileBatchIndex.push({ idx, batch: "ice", i: batches.ice.add(x, y, 0) }); break;
        case T.ONEWAY: plank.add(x, row + 0.86, 0); break;
        case T.BOUNCE: bounce.add(x, row + 0.7, 0, 1.05, 0.62, DEPTH * 0.55); break;
        case T.SPIKE: for (const [dx, dz] of [[-0.28, 0.6], [0, -0.3], [0.28, 0.4], [-0.15, -0.8], [0.2, 0.9]]) spike.add(x + dx, row + 0.27, dz, 1, 0.8 + r() * 0.4, 1); break;
      }
      // rocky underside for floating islands
      if (this.isGroundish(t) && !isSolidTile(tile(c, row - 1)) && L.theme !== "caverns") {
        const big = row === 0;
        const len = big ? 1.6 + r() * 3.2 : 0.4 + r() * 1.1;
        if (big || r() < 0.7) under.add(x + (r() - 0.5) * 0.3, row - len / 2, (r() - 0.5) * 0.6, big ? 1 + r() * 0.4 : 0.6, len, big ? 1.6 : 1, Math.PI, 0, 0);
        if (big && r() < 0.6) under.add(x + (r() - 0.5) * 0.4, row - len * 0.35, 0.7, 0.6, len * 0.6, 0.8, Math.PI, 0, 0);
      }
    }
    const built: Record<string, THREE.InstancedMesh | null> = {};
    for (const k in batches) built[k] = batches[k].build(this.group);
    cap.build(this.group); plank.build(this.group); bounce.build(this.group); spike.build(this.group); under.build(this.group);
    for (const e of tileBatchIndex) {
      const mesh = built[e.batch]; if (!mesh) continue;
      const base = new THREE.Matrix4(); mesh.getMatrixAt(e.i, base);
      const d: DynTile = { mesh, index: e.i, base };
      if (e.idx < 0) { // the hidden "used" twin of a gift block (stored at scale 0 until the gift is opened)
        d.base = new THREE.Matrix4().makeTranslation(e.x!, e.y!, 0); this.usedFor.set(-e.idx - 1, d);
      } else { const list = this.dyn.get(e.idx) || []; list.push(d); this.dyn.set(e.idx, list); }
    }
    this.buildDecor(r);
  }

  private buildDecor(r: () => number) {
    const L = this.level, th = this.theme;
    const surfaces: { c: number; row: number }[] = [];
    for (let row = 0; row < L.h - 1; row++) for (let c = 0; c < L.w; c++) {
      const t = L.tiles[row * L.w + c], a = L.tiles[(row + 1) * L.w + c];
      if ((t === T.GROUND || (t === T.STONE && L.theme !== "fortress")) && a === 0) surfaces.push({ c, row });
    }
    const tuft = new Batch(new THREE.ConeGeometry(0.07, 0.35, 4), new THREE.MeshStandardMaterial({ color: new THREE.Color(th.topDark), roughness: 1 }), false, false);
    const flowerStem = new Batch(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0x3f8f3a }), false, false);
    const flowerHead = new Batch(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), false, false);
    const trunk = new Batch(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 7), new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.9 }));
    const leaves = new Batch(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: L.theme === "sunset" ? 0xe08a3c : 0x4cae4c, roughness: 0.9, flatShading: true }));
    const pine = new Batch(new THREE.ConeGeometry(0.8, 2.2, 7), new THREE.MeshStandardMaterial({ color: L.theme === "frost" ? 0x2f6b55 : 0x2f7a45, roughness: 0.9, flatShading: true }));
    const snowcap = new Batch(new THREE.ConeGeometry(0.5, 0.8, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), false, false);
    const crystal = new Batch(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: 0xc8a2ff, emissive: 0x8a4dff, emissiveIntensity: 1.1, roughness: 0.2 }), false, false);
    const crystal2 = new Batch(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: 0x9ff3ff, emissive: 0x22b8ff, emissiveIntensity: 1.1, roughness: 0.2 }), false, false);
    const wheat = new Batch(new THREE.CylinderGeometry(0.03, 0.02, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0xf2c84b, roughness: 0.8 }), false, false);
    const puff = new Batch(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), false, false);
    const torchPost = new Batch(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }), false, false);
    const flame = new Batch(new THREE.ConeGeometry(0.12, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xffb02e, emissive: 0xff7a00, emissiveIntensity: 2.2 }), false, false);
    const colors = [0xff5a7a, 0xffd23f, 0xffffff, 0xb06bff, 0x5ab8ff];
    let lastTree = -20;
    for (const s of surfaces) {
      const x = s.c + 0.5, y = s.row + 1.02;
      if (th.decor === "flowers" || th.decor === "grass") {
        for (let i = 0; i < 2; i++) if (r() < 0.6) tuft.add(x + (r() - 0.5) * 0.9, y + 0.12, (r() - 0.5) * 2.2, 1, 0.7 + r() * 0.6, 1, (r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
        if (th.decor === "flowers" && r() < 0.35) { const fx = x + (r() - 0.5) * 0.8, fz = r() < 0.5 ? -0.9 - r() * 0.3 : 0.9 + r() * 0.3; flowerStem.add(fx, y + 0.15, fz); flowerHead.add(fx, y + 0.32, fz, 1, 1, 1, 0, 0, 0, new THREE.Color(colors[Math.floor(r() * colors.length)])); }
      }
      if (th.decor === "wheat") for (let i = 0; i < 3; i++) if (r() < 0.6) wheat.add(x + (r() - 0.5) * 0.9, y + 0.28, (r() < 0.5 ? -1 : 1) * (0.8 + r() * 0.4), 1, 0.8 + r() * 0.5, 1, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
      if (th.decor === "puffs" && r() < 0.45) puff.add(x + (r() - 0.5) * 0.6, y - 0.05, (r() < 0.5 ? -1.2 : 1.2), 1 + r() * 0.5, 0.7, 1);
      if (th.decor === "crystals" && r() < 0.18) { const b = r() < 0.5 ? crystal : crystal2; const z = -0.9 - r() * 0.3; b.add(x, y + 0.25, z, 0.8, 1.6 + r(), 0.8, 0, r(), (r() - 0.5) * 0.4); b.add(x + 0.25, y + 0.15, z + 0.2, 0.5, 1, 0.5, 0, r(), 0.4); }
      if (th.decor === "torches" && r() < 0.06) { torchPost.add(x, y + 0.45, -1.1); flame.add(x, y + 1.05, -1.1); }
      // trees behind the path
      if (s.c - lastTree > 6 && r() < 0.22 && (th.decor === "flowers" || th.decor === "grass" || th.decor === "wheat" || th.decor === "pines")) {
        lastTree = s.c; const z = -1.9 - r() * 0.4, sc = 0.8 + r() * 0.5;
        if (th.decor === "pines") { trunk.add(x, y + 0.5 * sc, z, sc, sc * 0.6, sc); pine.add(x, y + 1.7 * sc, z, sc, sc, sc); snowcap.add(x, y + 2.5 * sc, z, sc, sc, sc); }
        else { trunk.add(x, y + 0.8 * sc, z, sc, sc, sc); leaves.add(x, y + 2 * sc, z, sc * 1.1, sc, sc * 1.1); if (r() < 0.6) leaves.add(x + 0.5 * sc, y + 1.7 * sc, z + 0.3, sc * 0.7, sc * 0.7, sc * 0.7); }
      }
    }
    // cave ceiling crystals
    if (th.decor === "crystals") for (let c = 0; c < L.w; c++) for (let row = 1; row < L.h; row++) {
      if (L.tiles[row * L.w + c] && !L.tiles[(row - 1) * L.w + c] && row > 8 && r() < 0.16) crystal.add(c + 0.5, row - 0.2, -0.8 - r() * 0.4, 0.7, 1.4 + r(), 0.7, Math.PI, r(), 0);
    }
    for (const b of [tuft, flowerStem, flowerHead, trunk, leaves, pine, snowcap, crystal, crystal2, wheat, puff, torchPost, flame]) b.build(this.group);
  }

  private buildBackdrop() {
    const th = this.theme, L = this.level;
    const r = rng(L.w * 7 + 3);
    // sky dome
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(th.skyTop) }, bottom: { value: new THREE.Color(th.skyBottom) } },
      vertexShader: "varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h=clamp(normalize(vP - cameraPosition).y*1.4+0.25,0.,1.); gl_FragColor=vec4(mix(bottom,top,h),1.); }",
    }));
    sky.userData.followCamera = true; this.group.add(sky);
    if (!th.night || L.theme === "storm") {
      const sun = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: th.night ? 0xe9e4ff : L.theme === "sunset" ? 0xffd08a : 0xfff6d6, fog: false, transparent: true, opacity: 0.95 }));
      sun.position.set(L.w * 0.3, L.theme === "sunset" ? 12 : 60, -320); sun.userData.parallax = 0.9; this.group.add(sun);
    }
    if (th.night && L.theme !== "caverns") {
      const pts = new Float32Array(1200); for (let i = 0; i < 400; i++) { pts.set([(r() - 0.5) * 700 + L.w / 2, 20 + r() * 220, -300 - r() * 40], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, fog: false, sizeAttenuation: true })); stars.userData.parallax = 0.85; this.group.add(stars);
    }
    // sea far below
    if (th.sea) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 800), new THREE.MeshStandardMaterial({ color: L.theme === "sunset" ? 0x7a4a8a : th.night ? 0x1d2550 : 0x2b8fd6, roughness: 0.25, metalness: 0.2 }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(L.w / 2, -34, -200); this.group.add(sea);
    }
    // far scenery
    const far = new THREE.Group(); far.userData.parallax = 0.55; this.group.add(far);
    const farMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });
    const span = L.w + 120;
    if (th.far === "islands" || th.far === "sea" || th.far === "mesas") {
      for (let i = 0; i < 14; i++) {
        const x = -40 + (i / 14) * span + r() * 10, y = -4 + r() * 22, z = -70 - r() * 80, s = 3 + r() * 6;
        const isl = new THREE.Group(); isl.position.set(x, y, z); far.add(isl);
        const rock = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.8, 7), farMat(th.far === "mesas" ? 0xc98f5a : 0x9a7a62)); rock.rotation.x = Math.PI; rock.position.y = -s * 0.9; isl.add(rock);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.05, s, s * (th.far === "mesas" ? 1.2 : 0.35), 8), farMat(th.far === "mesas" ? 0xd9a066 : new THREE.Color(th.top).getHex())); isl.add(top);
        if (th.far !== "mesas" && r() < 0.7) { const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.4, 0), farMat(0x3f9a46)); tr.position.set(s * 0.3, s * 0.4, 0); isl.add(tr); }
      }
    } else if (th.far === "peaks") {
      for (let i = 0; i < 16; i++) {
        const x = -40 + (i / 16) * span + r() * 8, h = 30 + r() * 40, z = -90 - r() * 60;
        const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.55, h, 6), farMat(0x7f93b2)); m.position.set(x, h / 2 - 20, z); far.add(m);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.2, h * 0.36, 6), farMat(0xffffff)); cap.position.set(x, h - 20 - h * 0.18 + 0.5, z); far.add(cap);
      }
    } else if (th.far === "windmills") {
      for (let i = 0; i < 10; i++) {
        const x = -30 + (i / 10) * span + r() * 12, z = -60 - r() * 60, s = 2 + r() * 2;
        const hill = new THREE.Mesh(new THREE.SphereGeometry(s * 5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), farMat(0x8a5a6a)); hill.position.set(x, -12, z); far.add(hill);
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.9, s * 5, 8), farMat(0xf2e3c9)); tower.position.set(x, -12 + s * 5 + s * 2.5, z); far.add(tower);
        const hub = new THREE.Group(); hub.position.set(x, -12 + s * 5 + s * 5, z + s); far.add(hub);
        for (let b = 0; b < 4; b++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 4, 0.2), farMat(0x6a3d2a)); blade.position.y = s * 2; const arm = new THREE.Group(); arm.rotation.z = b * Math.PI / 2; arm.add(blade); hub.add(arm); }
        const speed = 0.4 + r() * 0.4; this.animated.push((t) => { hub.rotation.z = t * speed; });
      }
    } else if (th.far === "towers") {
      for (let i = 0; i < 12; i++) {
        const x = -30 + (i / 12) * span + r() * 10, z = -70 - r() * 60, h = 25 + r() * 35, w = 3 + r() * 3;
        const tw = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), farMat(0x3a3350)); tw.position.set(x, h / 2 - 15, z); far.add(tw);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, w * 1.4, 4), farMat(0x5a2f4a)); roof.position.set(x, h - 15 + w * 0.7, z); roof.rotation.y = Math.PI / 4; far.add(roof);
        for (let k = 0; k < 3; k++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({ color: 0xffc95a, fog: false })); win.position.set(x, h * (0.3 + k * 0.2) - 15, z + w / 2 + 0.01); far.add(win); }
      }
    } else if (th.far === "cave") {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(span + 100, 80), new THREE.MeshStandardMaterial({ color: 0x1b1533, roughness: 1 })); wall.position.set(L.w / 2, 8, -30); this.group.add(wall);
      for (let i = 0; i < 40; i++) {
        const big = new THREE.Mesh(new THREE.OctahedronGeometry(1 + r() * 2.5, 0), new THREE.MeshStandardMaterial({ color: r() < 0.5 ? 0xb388ff : 0x7fe7ff, emissive: r() < 0.5 ? 0x6a3dff : 0x1aa6c9, emissiveIntensity: 0.8 }));
        big.position.set(-20 + r() * (span), r() < 0.5 ? -2 + r() * 4 : 14 + r() * 6, -22 - r() * 7); big.scale.y = 1.6 + r(); big.rotation.z = (r() - 0.5) * 0.6; this.group.add(big);
      }
    }
    // mid clouds (sky themes)
    if (L.theme !== "caverns") {
      const cm = new THREE.MeshStandardMaterial({ color: th.night ? 0x5a5480 : 0xffffff, roughness: 1, emissive: th.night ? 0x1a1630 : 0xffffff, emissiveIntensity: th.night ? 0.2 : 0.35, transparent: true, opacity: th.night ? 0.8 : 0.95 });
      const clouds = new THREE.Group(); clouds.userData.parallax = 0.3; this.group.add(clouds);
      for (let i = 0; i < 26; i++) {
        const cl = new THREE.Group(); const n = 3 + Math.floor(r() * 3);
        for (let j = 0; j < n; j++) { const p = new THREE.Mesh(new THREE.SphereGeometry(1.4 + r() * 1.4, 10, 8), cm); p.position.set(j * 1.9 - n, r() * 0.8, r()); p.scale.y = 0.7; cl.add(p); }
        cl.position.set(-30 + r() * (span), (r() < 0.35 ? -10 - r() * 6 : 6 + r() * 18), -22 - r() * 30); clouds.add(cl);
        const sp = 0.2 + r() * 0.4; const base = cl.position.x; this.animated.push(t => { cl.position.x = base + Math.sin(t * 0.05 * sp) * 6 + t * sp * 0.2 % 30; });
      }
    }
  }

  /** a glowing wind column */
  addUpdraft(x: number, y: number, w: number, h: number) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0x9ff3ff) } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: "uniform float time; uniform vec3 color; varying vec2 vUv; void main(){ float stripe=smoothstep(.75,1.,sin((vUv.y*7.-time*3.)+vUv.x*3.)*.5+.5); float edge=smoothstep(0.,.25,vUv.x)*smoothstep(1.,.75,vUv.x); float fade=smoothstep(0.,.15,vUv.y)*smoothstep(1.,.7,vUv.y); gl_FragColor=vec4(color,(0.06+stripe*0.22)*edge*fade); }",
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x + w / 2, y + h / 2, 0.2); this.group.add(m);
    const m2 = m.clone(); m2.position.z = -0.6; this.group.add(m2);
    this.updraftMats.push(mat);
  }

  /** reflect tile changes from the simulation (broken bricks, used gift boxes, crumbles) + bump animation */
  sync(sim: Sim, time: number) {
    const tiles = sim.tiles;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === this.last[i]) continue;
      const prev = this.last[i]; this.last[i] = tiles[i];
      const list = this.dyn.get(i);
      if (prev === T.GIFT && tiles[i] === T.USED) {
        list?.forEach(d => { d.mesh.setMatrixAt(d.index, new THREE.Matrix4().makeScale(0, 0, 0)); d.mesh.instanceMatrix.needsUpdate = true; });
        const u = this.usedFor.get(i); if (u) { u.mesh.setMatrixAt(u.index, u.base); u.mesh.instanceMatrix.needsUpdate = true; this.dyn.set(i, [u]); }
      } else if (tiles[i] === T.EMPTY) {
        list?.forEach(d => { d.mesh.setMatrixAt(d.index, new THREE.Matrix4().makeScale(0, 0, 0)); d.mesh.instanceMatrix.needsUpdate = true; });
      } else if (prev === T.EMPTY && tiles[i] === T.CRUMBLE) {
        list?.forEach(d => { d.mesh.setMatrixAt(d.index, d.base); d.mesh.instanceMatrix.needsUpdate = true; });
      }
    }
    // bumps & shaking crumbles
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const b of sim.bumps) {
      const list = this.dyn.get(b.r * sim.w + b.c); if (!list) continue;
      const lift = Math.sin(Math.min(1, b.t / 0.25) * Math.PI) * 0.35;
      for (const d of list) { d.base.decompose(p, q, s); p.y += lift; d.mesh.setMatrixAt(d.index, new THREE.Matrix4().compose(p, q, s)); d.mesh.instanceMatrix.needsUpdate = true; }
      this.moved.add(b.r * sim.w + b.c);
    }
    for (const c of sim.crumbles) {
      if (c.fallen) continue; const list = this.dyn.get(c.idx); if (!list) continue;
      for (const d of list) { d.base.decompose(p, q, s); p.x += Math.sin(time * 70) * 0.05 * (c.t / 0.5); p.y -= c.t * 0.1; d.mesh.setMatrixAt(d.index, new THREE.Matrix4().compose(p, q, s)); d.mesh.instanceMatrix.needsUpdate = true; }
      this.moved.add(c.idx);
    }
  }
  /** restore bumped blocks to rest once their animation ends */
  settle(sim: Sim) {
    const done: number[] = [];
    this.moved.forEach(key => {
      if (sim.bumps.some(b => b.r * sim.w + b.c === key) || sim.crumbles.some(c => c.idx === key && !c.fallen)) return;
      done.push(key);
      if (sim.tiles[key] === T.EMPTY) return;
      for (const d of this.dyn.get(key) || []) { d.mesh.setMatrixAt(d.index, d.base); d.mesh.instanceMatrix.needsUpdate = true; }
    });
    for (const k of done) this.moved.delete(k);
  }

  update(t: number, dt: number, cam: THREE.Camera) {
    for (const a of this.animated) a(t, dt);
    for (const m of this.updraftMats) m.uniforms.time.value = t;
    for (const o of this.group.children) {
      if (o.userData.followCamera) o.position.copy(cam.position);
      if (o.userData.parallax) { o.position.x = cam.position.x * o.userData.parallax; o.position.y = (cam.position.y - 8) * o.userData.parallax * 0.5; }
    }
  }
  dispose() {
    this.group.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose(); });
  }
}
