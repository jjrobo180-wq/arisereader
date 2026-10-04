// The Build Zone: a block world you walk (or fly) around in first person,
// breaking and placing blocks. Chunks are meshed with only the visible faces,
// textures are drawn as pixel art at start-up, and the world saves itself.
import * as THREE from "three";
import { BLOCKS, PLACEABLE, SX, SY, SZ, World, blockDef, boxHitsBlocks, isSolid, raycast, spawnPoint } from "@shared/build/world";

const TILE = 16, ATLAS_COLS = 8, ATLAS_ROWS = 4;
const CHUNK = 16;

export type BuildHud = { slot: number; hotbar: number[]; flying: boolean; target: string | null; locked: boolean; inWater: boolean };

/** Pixel-art textures for every tile, drawn into one atlas. */
function makeAtlas() {
  const c = document.createElement("canvas"); c.width = TILE * ATLAS_COLS; c.height = TILE * ATLAS_ROWS;
  const g = c.getContext("2d")!;
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const tile = (i: number, draw: (px: (x: number, y: number, col: string) => void) => void) => {
    const ox = (i % ATLAS_COLS) * TILE, oy = Math.floor(i / ATLAS_COLS) * TILE;
    draw((x, y, col) => { g.fillStyle = col; g.fillRect(ox + x, oy + y, 1, 1); });
  };
  const noisy = (base: [number, number, number], spread = 18) => (px: (x: number, y: number, c: string) => void) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const v = (rnd() - 0.5) * spread; px(x, y, `rgb(${base[0] + v | 0},${base[1] + v | 0},${base[2] + v | 0})`); }
  };
  tile(0, noisy([92, 148, 52], 26)); // grass top
  tile(1, (px) => { noisy([134, 96, 67])(px); for (let x = 0; x < TILE; x++) { const d = 3 + Math.floor(rnd() * 3); for (let y = 0; y < d; y++) px(x, y, `rgb(${88 + rnd() * 20 | 0},${146 + rnd() * 20 | 0},${50 + rnd() * 14 | 0})`); } });
  tile(2, noisy([134, 96, 67]));
  tile(3, noisy([128, 130, 134], 26));
  tile(4, (px) => { noisy([110, 112, 116], 20)(px); for (let i = 0; i < 6; i++) { const cx = rnd() * 16, cy = rnd() * 16; for (let a = 0; a < 20; a++) px((cx + Math.cos(a) * 3) & 15, (cy + Math.sin(a) * 3) & 15, "#4a4d52"); } });
  tile(5, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const v = (rnd() - 0.5) * 16; px(x, y, y % 4 === 3 ? "#7a5130" : `rgb(${192 + v | 0},${133 + v | 0},${82 + v | 0})`); } });
  tile(6, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const v = (rnd() - 0.5) * 18 + (x % 4 === 0 ? -18 : 0); px(x, y, `rgb(${110 + v | 0},${80 + v | 0},${52 + v | 0})`); } });
  tile(7, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const r = Math.hypot(x - 7.5, y - 7.5); px(x, y, r > 7 ? "#6b4a2e" : Math.floor(r) % 3 === 0 ? "#a07850" : "#c49a6c"); } });
  tile(8, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, rnd() < 0.18 ? "rgba(0,0,0,0)" : `rgb(${40 + rnd() * 30 | 0},${120 + rnd() * 50 | 0},${40 + rnd() * 30 | 0})`); });
  tile(9, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, x === 0 || y === 0 || x === 15 || y === 15 ? "rgba(220,245,255,0.95)" : (x === y + 3 || x === y + 4) && x < 10 ? "rgba(255,255,255,0.6)" : "rgba(190,235,250,0.18)"); });
  tile(10, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const row = Math.floor(y / 4), off = row % 2 ? 4 : 0, mortar = y % 4 === 3 || (x + off) % 8 === 7; const v = (rnd() - 0.5) * 20; px(x, y, mortar ? "#cfc6b8" : `rgb(${168 + v | 0},${68 + v | 0},${48 + v | 0})`); } });
  tile(11, noisy([226, 210, 160], 16));
  tile(12, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, `rgba(${50 + rnd() * 20 | 0},${130 + rnd() * 30 | 0},${230},0.72)`); });
  tile(13, noisy([244, 246, 250], 8));
  tile(14, (px) => { noisy([250, 196, 30], 30)(px); for (let i = 0; i < 6; i++) px(rnd() * 16 | 0, rnd() * 16 | 0, "#fff3bf"); });
  tile(15, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const r = Math.hypot(x - 7.5, y - 7.5); px(x, y, x === 0 || y === 0 || x === 15 || y === 15 ? "#8a6d1f" : `rgb(255,${230 - r * 6 | 0},${120 - r * 6 | 0})`); } });
  const wool = ["#f1f3f5", "#e03131", "#f76707", "#fab005", "#74b816", "#1c7ed6", "#7048e8", "#e64980", "#2b2f33"];
  wool.forEach((col, k) => tile(16 + k, (px) => { const c0 = parseInt(col.slice(1), 16), r = c0 >> 16, gg = (c0 >> 8) & 255, b = c0 & 255; for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const v = ((x * 7 + y * 13) % 5 - 2) * 4 + (rnd() - 0.5) * 8; px(x, y, `rgb(${Math.max(0, Math.min(255, r + v)) | 0},${Math.max(0, Math.min(255, gg + v)) | 0},${Math.max(0, Math.min(255, b + v)) | 0})`); } }));
  tile(25, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, (x + y) % 9 === 0 ? "rgba(255,255,255,0.8)" : `rgba(${150 + rnd() * 20 | 0},${210 + rnd() * 20 | 0},255,0.75)`); });
  tile(26, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const shelf = y % 8 === 0 || y % 8 === 7 || x === 0 || x === 15; px(x, y, shelf ? "#7f5539" : ["#c92a2a", "#1c7ed6", "#2f9e44", "#f59f00", "#7048e8"][Math.floor(x / 3) % 5]); } });
  tile(27, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const mortar = y % 8 === 7 || (x + (Math.floor(y / 8) % 2 ? 8 : 0)) % 16 === 15; const v = (rnd() - 0.5) * 14; px(x, y, mortar ? "#5c5f66" : `rgb(${128 + v | 0},${130 + v | 0},${134 + v | 0})`); } });
  tile(28, (px) => { noisy([236, 110, 20], 20)(px); for (let i = 6; i < 10; i++) for (let j = 6; j < 10; j++) px(i, j, "#5c940d"); });
  tile(29, (px) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, x % 4 === 0 ? "#c2410c" : `rgb(${240 + rnd() * 10 | 0},${118 + rnd() * 16 | 0},20)`); for (const [x, y] of [[4, 5], [5, 5], [10, 5], [11, 5], [4, 10], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11], [11, 10]]) px(x, y, "#3b1d05"); });
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
  return tex;
}

// face data: normal, the 4 corners (unit cube), and shade
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8, t: 1 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8, t: 1 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1, t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5, t: 2 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9, t: 1 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.68, t: 1 },
] as const;

class BuildSound {
  ctx: AudioContext | null = null; muted = false;
  start() { if (this.ctx) { void this.ctx.resume(); return; } try { this.ctx = new AudioContext(); } catch { this.ctx = null; } }
  private blip(f: number, dur: number, type: OscillatorType, vol: number, to?: number) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  place() { this.blip(220, 0.08, "square", 0.05, 160); }
  dig() { this.blip(140, 0.12, "sawtooth", 0.05, 70); this.blip(600, 0.05, "square", 0.02, 300); }
  jump() { this.blip(300, 0.08, "sine", 0.03, 420); }
  dispose() { try { void this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; }
}

export class BuildGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.05, 260);
  private atlas = makeAtlas();
  private opaqueMat: THREE.MeshLambertMaterial;
  private clearMat: THREE.MeshLambertMaterial;
  private chunks = new Map<string, { opaque: THREE.Mesh | null; clear: THREE.Mesh | null }>();
  private dirty = new Set<string>();
  private highlight: THREE.LineSegments;
  private held: THREE.Mesh;
  private particles: { mesh: THREE.InstancedMesh; data: { p: THREE.Vector3; v: THREE.Vector3; life: number; color: THREE.Color }[] };
  private raf = 0; private disposed = false;
  private clock = new THREE.Clock();
  // the player
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private yaw = 0; private pitch = -0.15;
  private onGround = false; private flying = false; private lastJumpTap = 0;
  private keys = new Set<string>();
  private stick: { x: number; y: number } | null = null;
  private lookTouch: { id: number; x: number; y: number } | null = null;
  private slot = 0;
  hotbar = [1, 2, 3, 5, 6, 8, 9, 7, 14];
  private hudAt = 0;
  private savedAt = 0; private changedAt = 0;
  readonly sound = new BuildSound();
  private target: ReturnType<typeof raycast> = null;

  constructor(private container: HTMLElement, public world: World, private opts: { onHud: (h: BuildHud) => void; onChange: () => void; touch: boolean }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: !opts.touch });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.touch ? 1.25 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x8fd3ff);
    this.scene.fog = new THREE.Fog(0x8fd3ff, 50, 120);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.1); sun.position.set(40, 80, 20); this.scene.add(sun);
    this.opaqueMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.5 });
    this.clearMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    // sun and a few clouds
    const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false })); sunDisc.position.set(140, 120, -60); sunDisc.lookAt(0, 0, 0); this.scene.add(sunDisc);
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
    for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(8 + (i % 4) * 4, 1.2, 5 + (i % 3) * 3), cloudMat); c.position.set(-60 + (i * 37) % 180, 45 + (i % 3) * 3, -60 + (i * 53) % 180); this.scene.add(c); }
    // the world's edge: a grassy floor that goes on past the build area
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: 0x4f8f3a })); ground.rotation.x = -Math.PI / 2; ground.position.set(SX / 2, -0.01, SZ / 2); this.scene.add(ground);
    // the outline round the block you're pointing at
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x111111 }));
    this.highlight.visible = false; this.scene.add(this.highlight);
    // the block in your hand
    this.held = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshLambertMaterial({ map: this.atlas, alphaTest: 0.5, depthTest: false }));
    this.held.renderOrder = 10;
    this.held.position.set(0.4, -0.34, -0.62); this.held.rotation.set(0.3, 0.7, 0);
    this.camera.add(this.held); this.scene.add(this.camera);
    this.setHeldBlock();
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial(), 220);
    pm.count = 0; pm.frustumCulled = false; this.scene.add(pm);
    this.particles = { mesh: pm, data: [] };

    for (let cx = 0; cx < SX / CHUNK; cx++) for (let cz = 0; cz < SZ / CHUNK; cz++) this.dirty.add(`${cx},${cz}`);
    this.respawn();
    this.bind();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  respawn() { const s = spawnPoint(this.world); this.pos.set(s.x, s.y, s.z); this.vel.set(0, 0, 0); }

  /** Swap in a whole new world (a template, or one loaded from the server). */
  load(w: World) {
    this.world = w;
    for (let cx = 0; cx < SX / CHUNK; cx++) for (let cz = 0; cz < SZ / CHUNK; cz++) this.dirty.add(`${cx},${cz}`);
    this.respawn();
  }

  // ── meshing ───────────────────────────────────────────────────────────────
  private uvFor(tile: number) {
    const u0 = (tile % ATLAS_COLS) / ATLAS_COLS, v0 = 1 - (Math.floor(tile / ATLAS_COLS) + 1) / ATLAS_ROWS;
    const e = 0.0008;
    return [u0 + e, v0 + e, u0 + 1 / ATLAS_COLS - e, v0 + 1 / ATLAS_ROWS - e];
  }
  private buildChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const old = this.chunks.get(key);
    if (old) for (const m of [old.opaque, old.clear]) if (m) { this.scene.remove(m); m.geometry.dispose(); }
    const sets = { opaque: { p: [] as number[], uv: [] as number[], c: [] as number[], i: [] as number[] }, clear: { p: [] as number[], uv: [] as number[], c: [] as number[], i: [] as number[] } };
    const w = this.world;
    for (let y = 0; y < SY; y++) for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
      const x = cx * CHUNK + lx, z = cz * CHUNK + lz, id = w.get(x, y, z);
      if (!id) continue;
      const def = blockDef(id);
      const set = def.transparent ? sets.clear : sets.opaque;
      const useOpaque = id === 7; // leaves are cut-out, so they draw with the solid blocks
      const target = useOpaque ? sets.opaque : set;
      for (const f of FACES) {
        const nid = w.get(x + f.n[0], y + f.n[1], z + f.n[2]);
        const ndef = blockDef(nid);
        if (nid && !ndef.transparent) continue; // hidden behind a solid block
        if (nid === id && def.transparent) continue; // glass next to glass, water next to water
        if (y + f.n[1] < 0) continue;
        const [u0, v0, u1, v1] = this.uvFor(def.tiles[f.t]);
        const base = target.p.length / 3;
        const top = id === 11 && f.n[1] === 1 ? 0.88 : 1; // water sits a little low
        for (const [ax, ay, az] of f.c) target.p.push(x + ax, y + ay * (id === 11 ? top : 1), z + az);
        target.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        const s = def.glow ? 1.25 : f.shade;
        for (let k = 0; k < 4; k++) target.c.push(s, s, s);
        target.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const make = (d: typeof sets.opaque, mat: THREE.Material) => {
      if (!d.p.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(d.uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(d.c, 3));
      g.setIndex(d.i); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); this.scene.add(m); return m;
    };
    const opaque = make(sets.opaque, this.opaqueMat), clear = make(sets.clear, this.clearMat);
    if (clear) clear.renderOrder = 1;
    this.chunks.set(key, { opaque, clear });
  }
  private markDirty(x: number, z: number) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    this.dirty.add(`${cx},${cz}`);
    if (x % CHUNK === 0 && cx > 0) this.dirty.add(`${cx - 1},${cz}`);
    if (x % CHUNK === CHUNK - 1 && cx < SX / CHUNK - 1) this.dirty.add(`${cx + 1},${cz}`);
    if (z % CHUNK === 0 && cz > 0) this.dirty.add(`${cx},${cz - 1}`);
    if (z % CHUNK === CHUNK - 1 && cz < SZ / CHUNK - 1) this.dirty.add(`${cx},${cz + 1}`);
  }

  // ── building ──────────────────────────────────────────────────────────────
  breakBlock() {
    this.sound.start();
    const t = this.target; if (!t) return;
    const def = blockDef(t.id);
    this.world.set(t.x, t.y, t.z, 0);
    this.markDirty(t.x, t.z);
    this.burst(t.x + 0.5, t.y + 0.5, t.z + 0.5, def.color);
    this.sound.dig();
    this.changed();
  }
  placeBlock() {
    this.sound.start();
    const t = this.target; if (!t) return;
    const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
    if (!this.world.inside(x, y, z)) return;
    const cur = this.world.get(x, y, z); if (cur && cur !== 11) return;
    const id = this.hotbar[this.slot];
    // never build a block inside yourself
    if (isSolid(id)) {
      this.world.set(x, y, z, id);
      if (boxHitsBlocks(this.world, this.pos.x, this.pos.y, this.pos.z)) { this.world.set(x, y, z, cur); return; }
    } else this.world.set(x, y, z, id);
    this.markDirty(x, z);
    this.sound.place();
    this.changed();
  }
  /** Copies the block you're pointing at into your hand (like a middle click). */
  pickBlock() { const t = this.target; if (t) { this.hotbar[this.slot] = t.id; this.setHeldBlock(); } }
  private changed() { this.changedAt = performance.now(); this.opts.onChange(); }
  get unsavedSince() { return this.changedAt > this.savedAt ? this.changedAt : 0; }
  markSaved() { this.savedAt = performance.now(); }

  selectSlot(i: number) { this.slot = ((i % 9) + 9) % 9; this.setHeldBlock(); }
  setSlotBlock(id: number) { this.hotbar[this.slot] = id; this.setHeldBlock(); }
  private setHeldBlock() {
    const def = blockDef(this.hotbar[this.slot]);
    const g = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    // box faces: +x, -x, +y, -y, +z, -z
    const tiles = [def.tiles[1], def.tiles[1], def.tiles[0], def.tiles[2], def.tiles[1], def.tiles[1]];
    for (let f = 0; f < 6; f++) { const [u0, v0, u1, v1] = this.uvFor(tiles[f]); for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0); } }
    this.held.geometry.dispose(); this.held.geometry = g;
  }
  toggleFly() { this.flying = !this.flying; this.vel.y = 0; }
  jump() {
    this.sound.start();
    const now = performance.now();
    if (now - this.lastJumpTap < 300) { this.toggleFly(); this.lastJumpTap = 0; return; }
    this.lastJumpTap = now;
    if (this.onGround && !this.flying) { this.vel.y = 8.6; this.onGround = false; this.sound.jump(); }
  }

  private burst(x: number, y: number, z: number, color: string) {
    const c = new THREE.Color(color);
    for (let i = 0; i < 14; i++) {
      if (this.particles.data.length > 200) this.particles.data.shift();
      this.particles.data.push({ p: new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6), v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3), life: 0.6 + Math.random() * 0.4, color: c.clone().multiplyScalar(0.8 + Math.random() * 0.3) });
    }
  }

  // ── input ─────────────────────────────────────────────────────────────────
  setStick(v: { x: number; y: number } | null) { this.stick = v; }
  setKey(k: string, down: boolean) { if (down) this.keys.add(k); else this.keys.delete(k); }
  get pointerLocked() { return document.pointerLockElement === this.renderer.domElement; }
  lockPointer() { if (!this.opts.touch) this.renderer.domElement.requestPointerLock?.(); }

  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "shift", " "].includes(k) || e.code === "Space") { e.preventDefault(); this.keys.add(k === " " ? "space" : k); if (k === " " && !e.repeat) this.jump(); }
    else if (/^[1-9]$/.test(k)) this.selectSlot(Number(k) - 1);
    else if (k === "f" && !e.repeat) this.toggleFly();
    else if (k === "q" && !e.repeat) this.pickBlock();
  };
  private onKeyUp = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); this.keys.delete(k === " " ? "space" : k); };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.yaw -= e.movementX * 0.0024; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.0024));
  };
  private onMouseDown = (e: MouseEvent) => {
    if (this.opts.touch) return;
    if (!this.pointerLocked) { this.lockPointer(); return; }
    if (e.button === 0) this.breakBlock(); else if (e.button === 2) this.placeBlock(); else if (e.button === 1) this.pickBlock();
  };
  private onWheel = (e: WheelEvent) => { if (this.pointerLocked) { e.preventDefault(); this.selectSlot(this.slot + (e.deltaY > 0 ? 1 : -1)); } };
  // touch: drag anywhere on the view to look around (the stick and buttons are separate elements)
  private onTouchDown = (e: PointerEvent) => { if (e.pointerType === "mouse" || this.lookTouch) return; this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY }; this.sound.start(); };
  private onTouchMove = (e: PointerEvent) => {
    if (!this.lookTouch || e.pointerId !== this.lookTouch.id) return;
    const dx = e.clientX - this.lookTouch.x, dy = e.clientY - this.lookTouch.y; this.lookTouch.x = e.clientX; this.lookTouch.y = e.clientY;
    this.yaw -= dx * 0.006; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.006));
  };
  private onTouchUp = (e: PointerEvent) => { if (this.lookTouch?.id === e.pointerId) this.lookTouch = null; };
  private bind() {
    const el = this.renderer.domElement; el.style.touchAction = "none";
    window.addEventListener("keydown", this.onKeyDown); window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    el.addEventListener("mousedown", this.onMouseDown);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", this.onTouchDown); window.addEventListener("pointermove", this.onTouchMove); window.addEventListener("pointerup", this.onTouchUp); window.addEventListener("pointercancel", this.onTouchUp);
  }

  // ── loop ──────────────────────────────────────────────────────────────────
  private stepPlayer(dt: number) {
    const k = this.keys, st = this.stick;
    const fwd = st ? st.y : (k.has("w") ? 1 : 0) - (k.has("s") ? 1 : 0);
    const side = st ? st.x : (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    const feet = this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const inWater = feet === 11;
    const speed = this.flying ? 10 : inWater ? 2.6 : k.has("shift") || (st && Math.hypot(st.x, st.y) > 0.95) ? 6.4 : 4.4;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); // the camera looks down -z at yaw 0
    // right is (cos yaw, -sin yaw) = (-fz, fx)
    let mx = fx * fwd - fz * side, mz = fz * fwd + fx * side;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    this.vel.x = mx * speed; this.vel.z = mz * speed;
    if (this.flying) {
      this.vel.y = ((k.has("space") ? 1 : 0) - (k.has("shift") ? 1 : 0)) * 8;
    } else if (inWater) {
      this.vel.y = k.has("space") ? 3 : Math.max(this.vel.y - 6 * dt, -2.5);
    } else {
      this.vel.y -= 28 * dt; if (this.vel.y < -40) this.vel.y = -40;
    }
    // move one axis at a time, stopping at blocks
    const tryMove = (axis: "x" | "y" | "z", d: number) => {
      if (!d) return false;
      const before = this.pos[axis];
      this.pos[axis] += d;
      if (boxHitsBlocks(this.world, this.pos.x, this.pos.y, this.pos.z)) {
        // step up a single block when walking into it
        if (axis !== "y" && this.onGround && !this.flying) {
          this.pos.y += 1.01;
          if (!boxHitsBlocks(this.world, this.pos.x, this.pos.y, this.pos.z)) return false;
          this.pos.y -= 1.01;
        }
        this.pos[axis] = before; return true;
      }
      return false;
    };
    tryMove("x", this.vel.x * dt); tryMove("z", this.vel.z * dt);
    const hitY = tryMove("y", this.vel.y * dt);
    if (hitY) { if (this.vel.y < 0) this.onGround = true; this.vel.y = 0; }
    else this.onGround = boxHitsBlocks(this.world, this.pos.x, this.pos.y - 0.05, this.pos.z);
    if (this.pos.y < -10) this.respawn();
    if (this.pos.y > SY + 20) this.pos.y = SY + 20;
    return inWater;
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    // rebuild up to two changed chunks a frame
    let n = 0;
    for (const key of this.dirty) { const [cx, cz] = key.split(",").map(Number); this.buildChunk(cx, cz); this.dirty.delete(key); if (++n >= 2) break; }
    const inWater = this.stepPlayer(dt);
    this.camera.position.set(this.pos.x, this.pos.y + 1.62, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    // what you're pointing at
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    this.target = raycast(this.world, this.camera.position.x, this.camera.position.y, this.camera.position.z, dir.x, dir.y, dir.z, 7);
    if (this.target) { this.highlight.visible = true; this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5); } else this.highlight.visible = false;
    this.held.position.y = -0.34 + Math.sin(this.clock.elapsedTime * 8) * 0.008 * Math.min(1, Math.hypot(this.vel.x, this.vel.z));
    // break particles
    const m4 = new THREE.Matrix4(), pd = this.particles;
    pd.data = pd.data.filter((d) => (d.life -= dt) > 0);
    pd.data.forEach((d, i) => { d.v.y -= 12 * dt; d.p.addScaledVector(d.v, dt); m4.makeTranslation(d.p.x, d.p.y, d.p.z); pd.mesh.setMatrixAt(i, m4); pd.mesh.setColorAt(i, d.color); });
    pd.mesh.count = pd.data.length; pd.mesh.instanceMatrix.needsUpdate = true; if (pd.mesh.instanceColor) pd.mesh.instanceColor.needsUpdate = true;
    this.scene.fog!.color.set(inWater ? 0x1c5fa8 : 0x8fd3ff);
    (this.scene.fog as THREE.Fog).far = inWater ? 14 : 120;
    this.renderer.render(this.scene, this.camera);
    const now = performance.now();
    if (now - this.hudAt > 120) {
      this.hudAt = now;
      this.opts.onHud({ slot: this.slot, hotbar: [...this.hotbar], flying: this.flying, target: this.target ? blockDef(this.target.id).name : null, locked: this.pointerLocked, inWater });
    }
  };

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize); window.removeEventListener("keydown", this.onKeyDown); window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("pointermove", this.onTouchMove); window.removeEventListener("pointerup", this.onTouchUp); window.removeEventListener("pointercancel", this.onTouchUp);
    if (this.pointerLocked) document.exitPointerLock?.();
    this.sound.dispose();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []; mats.forEach((x) => x.dispose()); });
    this.atlas.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

export { BLOCKS, PLACEABLE };
