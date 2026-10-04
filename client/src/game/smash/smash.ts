// The Smash Room: a warehouse full of plates, bottles, TVs, watermelons and
// more, and a bat, a sledgehammer or a golf club to break them with. Everything
// shatters into pieces that fly, bounce and pile up. All objects, no people.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AvatarRig } from "@/lib/worldAvatar";

export type ToolId = "bat" | "hammer" | "club";
export const TOOLS: Record<ToolId, { name: string; damage: number; range: number; arc: number; time: number; slam: number }> = {
  bat: { name: "Bat", damage: 2, range: 2.1, arc: 1.9, time: 0.55, slam: 0 },
  hammer: { name: "Sledgehammer", damage: 4, range: 1.9, arc: 1.4, time: 0.9, slam: 2.6 },
  club: { name: "Golf club", damage: 1.5, range: 2.4, arc: 1.1, time: 0.4, slam: 0 },
};

type Kind = "plates" | "bottle" | "vase" | "tv" | "melon" | "pumpkin" | "crate" | "pane" | "printer" | "mug";
type Mat = "ceramic" | "glassG" | "glass" | "wood" | "rind" | "flesh" | "orange" | "grey" | "dark" | "paper" | "blue" | "red";
const KINDS: Record<Kind, { name: string; hp: number; value: number; radius: number; shards: [Mat, number][]; fx?: "juice" | "sparks" | "seeds" | "paper"; sound: "glass" | "ceramic" | "wood" | "splat" | "crash"; big?: boolean }> = {
  plates: { name: "plates", hp: 1, value: 15, radius: 0.45, shards: [["ceramic", 22]], sound: "ceramic" },
  bottle: { name: "a bottle", hp: 1, value: 8, radius: 0.25, shards: [["glassG", 16]], sound: "glass" },
  vase: { name: "a vase", hp: 2, value: 40, radius: 0.35, shards: [["blue", 18], ["ceramic", 6]], sound: "ceramic" },
  tv: { name: "an old TV", hp: 4, value: 120, radius: 0.75, shards: [["dark", 22], ["glass", 12]], fx: "sparks", sound: "crash", big: true },
  melon: { name: "a watermelon", hp: 2, value: 10, radius: 0.45, shards: [["rind", 12], ["flesh", 16]], fx: "juice", sound: "splat" },
  pumpkin: { name: "a pumpkin", hp: 3, value: 12, radius: 0.5, shards: [["orange", 22]], fx: "seeds", sound: "splat" },
  crate: { name: "a crate", hp: 3, value: 25, radius: 0.65, shards: [["wood", 14]], sound: "wood" },
  pane: { name: "a glass pane", hp: 1, value: 60, radius: 0.8, shards: [["glass", 34]], sound: "glass", big: true },
  printer: { name: "a printer", hp: 5, value: 200, radius: 0.6, shards: [["grey", 22], ["dark", 6]], fx: "paper", sound: "crash", big: true },
  mug: { name: "a mug", hp: 1, value: 5, radius: 0.2, shards: [["red", 10]], sound: "ceramic" },
};
const MATS: Record<Mat, THREE.MeshStandardMaterialParameters> = {
  ceramic: { color: 0xf8f9fa, roughness: 0.3 }, glassG: { color: 0x2f9e44, roughness: 0.1, transparent: true, opacity: 0.75 },
  glass: { color: 0xc5f6fa, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 }, wood: { color: 0xa47148, roughness: 0.9 },
  rind: { color: 0x2b8a3e, roughness: 0.6 }, flesh: { color: 0xf03e3e, roughness: 0.5 }, orange: { color: 0xf76707, roughness: 0.6 },
  grey: { color: 0xced4da, roughness: 0.5 }, dark: { color: 0x212529, roughness: 0.4 }, paper: { color: 0xffffff, roughness: 0.9 },
  blue: { color: 0x1c7ed6, roughness: 0.3 }, red: { color: 0xc92a2a, roughness: 0.35 },
};

type Item = { kind: Kind; mesh: THREE.Object3D; x: number; y: number; z: number; hp: number; wobble: number; alive: boolean };
type Box = { minX: number; maxX: number; minZ: number; maxZ: number; top: number };

export type SmashHud = { score: number; combo: number; best: number; rush: boolean; timeLeft: number | null; tool: ToolId; left: number; total: number; last: string | null; ended: { score: number; best: boolean } | null };

const ROOM = { w: 26, d: 20, h: 7 };
const MAX_SHARDS = 420;

class SmashSound {
  ctx: AudioContext | null = null; muted = false; private noise: AudioBuffer | null = null; private out: GainNode | null = null;
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      const comp = this.ctx.createDynamicsCompressor(); comp.connect(this.ctx.destination);
      this.out = this.ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(comp);
      const len = this.ctx.sampleRate, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    } catch { this.ctx = null; }
  }
  private burst(dur: number, type: BiquadFilterType, f: number, vol: number, q = 1, at = 0) {
    if (!this.ctx || !this.noise || this.muted) return;
    const t = this.ctx.currentTime + at, s = this.ctx.createBufferSource(); s.buffer = this.noise; s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.out!);
  }
  private ping(f: number, dur: number, vol: number, at = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + at, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out!); o.start(t); o.stop(t + dur + 0.05);
  }
  swing() { this.burst(0.22, "bandpass", 900, 0.12, 0.8); }
  hit() { this.burst(0.12, "lowpass", 400, 0.5); }
  play(kind: "glass" | "ceramic" | "wood" | "splat" | "crash", big = false) {
    const v = big ? 1 : 0.7;
    if (kind === "glass") { this.burst(0.5, "highpass", 3500, 0.5 * v); for (let i = 0; i < 7; i++) this.ping(2500 + Math.random() * 3500, 0.25 + Math.random() * 0.3, 0.05 * v, i * 0.03); }
    if (kind === "ceramic") { this.burst(0.35, "bandpass", 2200, 0.6 * v, 1.2); for (let i = 0; i < 4; i++) this.ping(1600 + Math.random() * 1800, 0.15, 0.04, i * 0.04); }
    if (kind === "wood") { this.burst(0.3, "lowpass", 900, 0.8 * v); this.burst(0.12, "bandpass", 1800, 0.4, 2, 0.05); }
    if (kind === "splat") { this.burst(0.35, "lowpass", 600, 0.9 * v); this.burst(0.2, "bandpass", 1200, 0.3, 0.6, 0.04); }
    if (kind === "crash") { this.burst(0.7, "lowpass", 700, 1); this.burst(0.5, "highpass", 3000, 0.4); this.ping(120, 0.4, 0.3); }
  }
  dispose() { try { void this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; }
}

export class SmashGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private rig: AvatarRig;
  private toolMeshes: Record<ToolId, THREE.Object3D>;
  private tool: ToolId = "bat";
  private pos = new THREE.Vector3(0, 0, ROOM.d / 2 - 3);
  private facing = Math.PI;
  private camYaw = 0;
  private camPitch = 0.35;
  private keys = new Set<string>();
  private stick: { x: number; y: number } | null = null;
  private swingUntil = 0;
  private impactAt = 0;
  private items: Item[] = [];
  private tables: Box[] = [];
  private shardMeshes = new Map<Mat, THREE.InstancedMesh>();
  private shards: { mat: Mat; p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; s: THREE.Vector3; rest: boolean; age: number }[] = [];
  private fx: { points: THREE.Points; data: { p: THREE.Vector3; v: THREE.Vector3; life: number }[]; max: number }[] = [];
  private fxByName: Record<string, number> = {};
  private projectiles: { mesh: THREE.Object3D; v: THREE.Vector3 }[] = [];
  private score = 0; private combo = 0; private comboUntil = 0; private last: string | null = null;
  private rushUntil: number | null = null; private ended: SmashHud["ended"] = null;
  private slowUntil = 0; private shake = 0;
  private hudAt = 0;
  readonly sound = new SmashSound();
  private dragging: { id: number; x: number; y: number } | null = null;

  constructor(private container: HTMLElement, characterId: string, private opts: { onHud: (h: SmashHud) => void; userId?: number }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    this.scene.environmentIntensity = 0.35;
    this.scene.background = new THREE.Color(0x111216);
    this.buildRoom();
    this.buildShardPools();
    this.restock();
    this.rig = new AvatarRig(characterId, 1.8, { noWeapons: true });
    this.scene.add(this.rig.root);
    this.toolMeshes = { bat: this.makeTool("bat"), hammer: this.makeTool("hammer"), club: this.makeTool("club") };
    for (const id of Object.keys(this.toolMeshes) as ToolId[]) { this.toolMeshes[id].visible = id === this.tool; this.rig.attach(this.toolMeshes[id]); }
    // safety first: a hard hat
    const hat = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfcc419, roughness: 0.4 }));
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20), dome.material); brim.position.y = 0.005;
    hat.add(dome, brim); hat.position.set(0, 0.16, 0.01);
    this.rig.attach(hat, /^Head$/i);
    this.bind();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  // ── building the room ─────────────────────────────────────────────────────
  private tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rx = 1, ry = 1) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
  }
  private buildRoom() {
    const { w, d, h } = ROOM;
    const concrete = this.tex(256, 256, (g) => { g.fillStyle = "#6c6f75"; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2500; i++) { const v = 90 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256); }, w / 4, d / 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    const blocks = this.tex(256, 128, (g) => { g.fillStyle = "#2a2d34"; g.fillRect(0, 0, 256, 128); g.fillStyle = "#33373f"; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.fillRect(c * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28); }, w / 6, h / 3);
    const wallMat = new THREE.MeshStandardMaterial({ map: blocks, roughness: 0.9 });
    const mk = (ww: number, x: number, z: number, ry: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, h), wallMat); m.position.set(x, h / 2, z); m.rotation.y = ry; m.receiveShadow = true; this.scene.add(m); };
    mk(w, 0, -d / 2, 0); mk(w, 0, d / 2, Math.PI); mk(d, -w / 2, 0, Math.PI / 2); mk(d, w / 2, 0, -Math.PI / 2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x15171c })); ceil.rotation.x = Math.PI / 2; ceil.position.y = h; this.scene.add(ceil);
    // hazard stripes round the bottom of the walls
    const stripes = this.tex(128, 32, (g) => { g.fillStyle = "#111"; g.fillRect(0, 0, 128, 32); g.fillStyle = "#fcc419"; for (let i = -2; i < 10; i++) { g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 8, 32); g.lineTo(i * 16 + 24, 0); g.lineTo(i * 16 + 16, 0); g.fill(); } });
    const band = (ww: number, x: number, z: number, ry: number) => { const t = stripes.clone(); t.needsUpdate = true; t.repeat.set(ww / 1.5, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, 0.6), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, 0.3, z); m.rotation.y = ry; this.scene.add(m); };
    band(w, 0, -d / 2 + 0.02, 0); band(w, 0, d / 2 - 0.02, Math.PI); band(d, -w / 2 + 0.02, 0, Math.PI / 2); band(d, w / 2 - 0.02, 0, -Math.PI / 2);
    // neon sign and the house rules
    const sign = this.tex(1024, 256, (g) => { g.fillStyle = "#0b0505"; g.fillRect(0, 0, 1024, 256); g.shadowColor = "#ff6b3d"; g.shadowBlur = 30; g.fillStyle = "#ff8a5c"; g.font = "900 150px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SMASH ROOM", 512, 128); });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: sign })); s.position.set(0, 4.6, -d / 2 + 0.05); this.scene.add(s);
    const rules = this.tex(512, 640, (g) => { g.fillStyle = "#f1f3f5"; g.fillRect(0, 0, 512, 640); g.fillStyle = "#c92a2a"; g.fillRect(0, 0, 512, 110); g.fillStyle = "#fff"; g.font = "900 64px system-ui"; g.textAlign = "center"; g.fillText("HOUSE RULES", 256, 78); g.fillStyle = "#212529"; g.font = "700 38px system-ui"; g.textAlign = "left"; ["Hard hat on", "Smash the stuff,", "  not the walls", "Have fun", "Breathe out"].forEach((l, i) => g.fillText(l, 40, 190 + i * 80)); });
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), new THREE.MeshBasicMaterial({ map: rules })); r.position.set(-w / 2 + 0.05, 2.6, -4); r.rotation.y = Math.PI / 2; this.scene.add(r);
    // caged work lights
    this.scene.add(new THREE.HemisphereLight(0xdde6ff, 0x30281e, 0.9));
    for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) {
      const l = new THREE.PointLight(0xffe2b0, 26, 22, 1.5); l.position.set(x, h - 0.6, z); this.scene.add(l);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1cc })); bulb.position.copy(l.position); this.scene.add(bulb);
    }
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, h + 3, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); const sc = key.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 12; sc.bottom = -12; this.scene.add(key, key.target);
    // tables and shelves
    const table = (cx: number, cz: number, tw: number, td: number, top = 0.9) => {
      const g = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.08, td), new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 })); slab.position.y = top; slab.castShadow = slab.receiveShadow = true; g.add(slab);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, top, 0.08), new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: 0.6 })); leg.position.set(lx * (tw / 2 - 0.1), top / 2, lz * (td / 2 - 0.1)); g.add(leg); }
      g.position.set(cx, 0, cz); this.scene.add(g);
      this.tables.push({ minX: cx - tw / 2, maxX: cx + tw / 2, minZ: cz - td / 2, maxZ: cz + td / 2, top: top + 0.04 });
    };
    table(-7, -6.5, 6, 1.4); table(7, -6.5, 6, 1.4); table(0, -7.5, 5, 1.2); table(-10.5, 1, 1.4, 5); table(10.5, 1, 1.4, 5); table(-3.5, 1.5, 2.6, 1.2); table(3.5, 1.5, 2.6, 1.2);
  }

  private makeTool(id: ToolId) {
    const g = new THREE.Group();
    if (id === "bat") {
      const pts = [new THREE.Vector2(0.018, 0), new THREE.Vector2(0.022, 0.35), new THREE.Vector2(0.05, 0.7), new THREE.Vector2(0.045, 0.82), new THREE.Vector2(0, 0.84)];
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshStandardMaterial({ color: 0xc8a165, roughness: 0.55 })); g.add(m);
      const tape = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0x212529 })); tape.position.y = 0.09; g.add(tape);
    } else if (id === "hammer") {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.85, 10), new THREE.MeshStandardMaterial({ color: 0x8b5e34, roughness: 0.7 })); handle.position.y = 0.42; g.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0x495057, metalness: 0.8, roughness: 0.35 })); head.position.y = 0.86; g.add(head);
    } else {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.95, 8), new THREE.MeshStandardMaterial({ color: 0xdee2e6, metalness: 0.9, roughness: 0.2 })); shaft.position.y = 0.47; g.add(shaft);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xadb5bd, metalness: 0.9, roughness: 0.2 })); head.position.set(0.04, 0.95, 0); g.add(head);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x212529 })); grip.position.y = 0.11; g.add(grip);
    }
    // the handle sits in the palm and the tool points along the forearm
    g.rotation.set(Math.PI / 2, 0, 0); g.position.set(0, 0.04, 0.02);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    return g;
  }

  private itemMesh(kind: Kind): THREE.Object3D {
    const M = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0, x = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    switch (kind) {
      case "plates": { const mat = M(MATS.ceramic); for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.32, 0.26, 0.035, 22), mat, 0.02 + i * 0.04); break; }
      case "bottle": { const mat = M({ ...MATS.glassG }); add(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 14), mat, 0.21); add(new THREE.CylinderGeometry(0.035, 0.09, 0.16, 12), mat, 0.5); break; }
      case "vase": { const pts = [0, 0.12, 0.22, 0.2, 0.12, 0.09, 0.13].map((r, i) => new THREE.Vector2(r, i * 0.11)); add(new THREE.LatheGeometry(pts, 20), M({ ...MATS.blue, side: THREE.DoubleSide })); break; }
      case "tv": {
        add(new THREE.BoxGeometry(1.1, 0.85, 0.8), M({ color: 0x3b3b3b, roughness: 0.5 }), 0.43);
        add(new THREE.PlaneGeometry(0.85, 0.62), M({ color: 0x1b4332, emissive: 0x2b8a3e, emissiveIntensity: 0.25, roughness: 0.1 }), 0.45, 0, 0.405);
        for (const s of [-1, 1]) { const a = add(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5), M({ color: 0x868e96, metalness: 0.8 }), 1.05, s * 0.12); a.rotation.z = s * 0.4; }
        break;
      }
      case "melon": { const m = add(new THREE.SphereGeometry(0.34, 20, 14), M({ color: 0x2b8a3e, roughness: 0.5 }), 0.3); m.scale.set(1.25, 0.9, 0.95); break; }
      case "pumpkin": {
        const pts: THREE.Vector2[] = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push(new THREE.Vector2(Math.sin(a) * 0.4, -Math.cos(a) * 0.3 + 0.3)); }
        const geo = new THREE.LatheGeometry(pts, 24), pos = geo.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x), k = 1 + Math.cos(a * 8) * 0.06; pos.setX(i, x * k); pos.setZ(i, z * k); }
        geo.computeVertexNormals(); add(geo, M(MATS.orange)); add(new THREE.CylinderGeometry(0.03, 0.05, 0.14, 8), M({ color: 0x5c940d }), 0.62);
        break;
      }
      case "crate": { const wood = this.tex(64, 64, (c) => { c.fillStyle = "#a47148"; c.fillRect(0, 0, 64, 64); c.fillStyle = "#7f5539"; for (let i = 0; i < 4; i++) c.fillRect(0, i * 16 + 14, 64, 2); c.fillRect(0, 0, 64, 4); c.fillRect(0, 60, 64, 4); }); add(new THREE.BoxGeometry(1, 1, 1), M({ map: wood, roughness: 0.9 }), 0.5); break; }
      case "pane": {
        add(new THREE.BoxGeometry(1.5, 1.6, 0.04), M({ ...MATS.glass }), 1.1);
        const frame = M({ color: 0x343a40, metalness: 0.6 });
        for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 1.95, 0.08), frame, 0.98, s * 0.78);
        add(new THREE.BoxGeometry(1.62, 0.06, 0.4), frame, 0.03);
        break;
      }
      case "printer": { add(new THREE.BoxGeometry(0.9, 0.5, 0.7), M({ color: 0xdee2e6, roughness: 0.5 }), 0.25); add(new THREE.BoxGeometry(0.6, 0.04, 0.3), M({ color: 0xffffff }), 0.52, 0, -0.2); add(new THREE.BoxGeometry(0.25, 0.06, 0.1), M({ color: 0x40c057, emissive: 0x2f9e44, emissiveIntensity: 0.6 }), 0.42, 0.25, 0.35); break; }
      case "mug": { add(new THREE.CylinderGeometry(0.09, 0.08, 0.18, 14), M(MATS.red), 0.09); const h = add(new THREE.TorusGeometry(0.05, 0.015, 6, 12), M(MATS.red), 0.1, 0.1); h.rotation.y = Math.PI / 2; break; }
    }
    return g;
  }

  /** Fills the room back up with things to smash. */
  restock() {
    for (const it of this.items) this.scene.remove(it.mesh);
    this.items = [];
    const put = (kind: Kind, x: number, z: number, onTable = true, rot = 0) => {
      const t = onTable ? this.tables.find((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) : undefined;
      const y = t ? t.top : 0;
      const mesh = this.itemMesh(kind); mesh.position.set(x, y, z); mesh.rotation.y = rot; this.scene.add(mesh);
      this.items.push({ kind, mesh, x, y, z, hp: KINDS[kind].hp, wobble: 0, alive: true });
    };
    // back tables: plates, bottles, vases, mugs
    for (let i = 0; i < 5; i++) put(i % 2 ? "bottle" : "plates", -9.4 + i * 1.2, -6.5);
    for (let i = 0; i < 5; i++) put(i % 2 ? "mug" : "vase", 4.6 + i * 1.2, -6.5);
    put("printer", -1.4, -7.5); put("tv", 1.2, -7.5, true, 0.1);
    // side shelves: melons and pumpkins
    for (let i = 0; i < 4; i++) put(i % 2 ? "pumpkin" : "melon", -10.5, -0.6 + i * 1.1);
    for (let i = 0; i < 4; i++) put(i % 2 ? "melon" : "bottle", 10.5, -0.6 + i * 1.1);
    // middle tables
    put("tv", -3.5, 1.5, true, -0.2); put("printer", 3.5, 1.5, true, 0.2);
    // on the floor: crates, panes, more TVs
    put("crate", -6, 5, false, 0.3); put("crate", -4.8, 5.4, false, -0.2); put("crate", 6, 5, false, 0.5);
    put("pane", -1.5, -3, false); put("pane", 1.5, -3, false);
    put("tv", 8, -2.5, false, -0.6); put("pumpkin", -8, -2.5, false); put("melon", 0, 4.5, false);
    this.last = null;
  }

  private buildShardPools() {
    for (const mat of Object.keys(MATS) as Mat[]) {
      const geo = mat === "glass" || mat === "glassG" ? new THREE.TetrahedronGeometry(1, 0) : mat === "paper" ? new THREE.PlaneGeometry(1.4, 1.8) : mat === "wood" ? new THREE.BoxGeometry(0.35, 0.18, 2.4) : new THREE.DodecahedronGeometry(1, 0);
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ ...MATS[mat], side: mat === "paper" ? THREE.DoubleSide : THREE.FrontSide }), MAX_SHARDS);
      im.count = 0; im.castShadow = true; im.frustumCulled = false;
      this.scene.add(im); this.shardMeshes.set(mat, im);
    }
    const pts = (color: number, size: number, max: number, additive = false) => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      p.frustumCulled = false; this.scene.add(p);
      this.fx.push({ points: p, data: [], max });
      return this.fx.length - 1;
    };
    this.fxByName = { juice: pts(0xe03131, 0.09, 400), sparks: pts(0xffd43b, 0.08, 300, true), seeds: pts(0xfff3bf, 0.05, 300), dust: pts(0xadb5bd, 0.06, 400), glint: pts(0xe7f5ff, 0.05, 300, true) };
  }

  private spawnShards(it: Item, from: THREE.Vector3, power: number) {
    const k = KINDS[it.kind];
    const center = new THREE.Vector3(it.x, it.y + k.radius * 0.8, it.z);
    const away = center.clone().sub(from).setY(0).normalize();
    for (const [mat, n] of k.shards) for (let i = 0; i < n; i++) {
      if (this.shards.length >= MAX_SHARDS) this.shards.shift();
      const size = (k.radius * (0.12 + Math.random() * 0.18)) * (mat === "wood" ? 0.9 : 1);
      const v = new THREE.Vector3((Math.random() - 0.5) * 4 + away.x * power * 3.2, 2 + Math.random() * 3.5 * power, (Math.random() - 0.5) * 4 + away.z * power * 3.2);
      this.shards.push({
        mat, p: center.clone().add(new THREE.Vector3((Math.random() - 0.5) * k.radius, (Math.random() - 0.5) * k.radius, (Math.random() - 0.5) * k.radius)),
        v, r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), w: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
        s: new THREE.Vector3(size, size * (mat === "glass" ? 0.25 : 0.8), size), rest: false, age: 0,
      });
    }
    const burst = (name: string, n: number, speed: number, up: number) => {
      const f = this.fx[this.fxByName[name]];
      for (let i = 0; i < n; i++) { if (f.data.length >= f.max) f.data.shift(); f.data.push({ p: center.clone(), v: new THREE.Vector3((Math.random() - 0.5) * speed + away.x * 2, Math.random() * up, (Math.random() - 0.5) * speed + away.z * 2), life: 1.2 + Math.random() }); }
    };
    burst("dust", 30, 3, 2);
    if (k.fx === "juice") burst("juice", 120, 6, 5);
    if (k.fx === "sparks") burst("sparks", 90, 8, 6);
    if (k.fx === "seeds") burst("seeds", 80, 5, 4);
    if (k.fx === "paper") for (let i = 0; i < 8; i++) { if (this.shards.length >= MAX_SHARDS) this.shards.shift(); this.shards.push({ mat: "paper", p: center.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3(Math.random() * 3, Math.random() * 3, 0), s: new THREE.Vector3(0.18, 0.18, 0.18), rest: false, age: 0 }); }
    if (k.shards.some(([m]) => m === "glass" || m === "glassG")) burst("glint", 60, 5, 4);
  }

  // ── smashing ──────────────────────────────────────────────────────────────
  private damage(it: Item, dmg: number, from: THREE.Vector3, power: number) {
    if (!it.alive) return;
    it.hp -= dmg;
    if (it.hp > 0) { it.wobble = 1; this.sound.hit(); return; }
    it.alive = false;
    this.scene.remove(it.mesh);
    const k = KINDS[it.kind];
    this.spawnShards(it, from, power);
    this.sound.play(k.sound, k.big);
    const now = performance.now();
    this.combo = now < this.comboUntil ? this.combo + 1 : 1;
    this.comboUntil = now + 1600;
    this.score += k.value * Math.min(5, this.combo);
    this.last = k.name;
    this.shake = Math.min(1, this.shake + (k.big ? 0.8 : 0.3));
    if (k.big || this.combo >= 4) this.slowUntil = now + 380;
  }

  swing() {
    const now = performance.now();
    if (now < this.swingUntil || this.ended) return;
    this.sound.start();
    const t = TOOLS[this.tool];
    this.swingUntil = now + t.time * 1000;
    this.impactAt = now + t.time * 1000 * 0.42;
    // turn toward the nearest thing in front, so swings land on touch screens too
    let best: Item | null = null, bd = t.range + 1.2;
    for (const it of this.items) {
      if (!it.alive) continue;
      const dx = it.x - this.pos.x, dz = it.z - this.pos.z, d = Math.hypot(dx, dz) - KINDS[it.kind].radius;
      const off = Math.abs(wrap(Math.atan2(dx, dz) - this.facing));
      if (d < bd && off < 1.4) { bd = d; best = it; }
    }
    if (best) this.facing = Math.atan2(best.x - this.pos.x, best.z - this.pos.z);
    this.rig.gesture("slash", this.rig.clipLength("slash") / t.time);
    this.sound.swing();
  }

  private impact() {
    const t = TOOLS[this.tool];
    const from = this.pos.clone().setY(1);
    let hit = 0;
    for (const it of this.items) {
      if (!it.alive) continue;
      const dx = it.x - this.pos.x, dz = it.z - this.pos.z, d = Math.hypot(dx, dz) - KINDS[it.kind].radius;
      const off = Math.abs(wrap(Math.atan2(dx, dz) - this.facing));
      if ((d < t.range && off < t.arc / 2) || (t.slam && d < t.slam && it.y < 0.5)) { this.damage(it, t.damage, from, this.tool === "hammer" ? 1.4 : 1); hit++; }
    }
    if (t.slam) { this.shake = Math.min(1, this.shake + 0.5); const f = this.fx[this.fxByName.dust]; for (let i = 0; i < 40; i++) f.data.push({ p: this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 1.2, 0.1, Math.cos(this.facing) * 1.2)), v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 2, (Math.random() - 0.5) * 6), life: 1 }); }
    if (!hit) this.sound.swing();
  }

  /** Throws a bottle in the direction you're facing. */
  throwBottle() {
    if (this.ended) return;
    this.sound.start();
    const now = performance.now();
    if (now < this.swingUntil - 200) return;
    this.swingUntil = now + 450;
    this.rig.gesture("punch", 1.4);
    const m = this.itemMesh("bottle"); m.scale.setScalar(0.8);
    const dir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    m.position.copy(this.pos).add(dir.clone().multiplyScalar(0.6)).setY(1.5);
    this.scene.add(m);
    this.projectiles.push({ mesh: m, v: dir.multiplyScalar(15).setY(3) });
  }

  setTool(id: ToolId) { this.tool = id; for (const k of Object.keys(this.toolMeshes) as ToolId[]) this.toolMeshes[k].visible = k === id; }
  get currentTool() { return this.tool; }

  startRush() { this.restock(); this.score = 0; this.combo = 0; this.ended = null; this.rushUntil = performance.now() + 60_000; this.sound.start(); }
  stopRush() { this.rushUntil = null; this.ended = null; }
  private bestKey() { return `smash_best_${this.opts.userId ?? "me"}`; }
  private best() { try { return Number(localStorage.getItem(this.bestKey())) || 0; } catch { return 0; } }

  setStick(v: { x: number; y: number } | null) { this.stick = v; if (v) this.sound.start(); }
  press(key: string, down: boolean) { if (down) this.keys.add(key); else this.keys.delete(key); }
  setMuted(m: boolean) { this.sound.muted = m; }

  // ── loop ──────────────────────────────────────────────────────────────────
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const raw = Math.min(0.05, this.clock.getDelta());
    const dt = now < this.slowUntil ? raw * 0.35 : raw;
    const t = this.clock.elapsedTime;
    if (this.impactAt && now >= this.impactAt) { this.impactAt = 0; this.impact(); }

    // walking (relative to the camera)
    const k = this.keys, st = this.stick;
    const fwd = st ? st.y : (k.has("w") ? 1 : 0) - (k.has("s") ? 1 : 0);
    const side = st ? st.x : (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    const yaw = this.camYaw + Math.PI;
    let dx = Math.sin(yaw) * fwd - Math.cos(yaw) * side, dz = Math.cos(yaw) * fwd + Math.sin(yaw) * side;
    const len = Math.hypot(dx, dz);
    let speed = 0;
    if (len > 0.15 && now > this.swingUntil - 150) {
      dx /= Math.max(1, len); dz /= Math.max(1, len);
      const sp = (k.has("shift") || (st && Math.hypot(st.x, st.y) > 0.92) ? 5.2 : 3.2) * raw;
      const nx = this.pos.x + dx * sp, nz = this.pos.z + dz * sp;
      const res = this.collide(nx, nz);
      speed = Math.hypot(res.x - this.pos.x, res.z - this.pos.z) / Math.max(raw, 1e-4);
      this.pos.x = res.x; this.pos.z = res.z;
      this.facing = this.facing + wrap(Math.atan2(dx, dz) - this.facing) * Math.min(1, raw * 12);
    }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.facing;
    this.rig.update(dt, speed);

    // wobbling items that took a hit
    for (const it of this.items) if (it.alive && it.wobble > 0) { it.wobble = Math.max(0, it.wobble - dt * 3); it.mesh.rotation.z = Math.sin(t * 40) * 0.12 * it.wobble; }

    this.stepShards(dt);
    this.stepProjectiles(dt);
    if (this.combo && now > this.comboUntil) this.combo = 0;

    // camera behind the shoulder
    const dist = 5.2, cx = this.pos.x + Math.sin(this.camYaw) * dist * Math.cos(this.camPitch), cz = this.pos.z + Math.cos(this.camYaw) * dist * Math.cos(this.camPitch);
    const desired = new THREE.Vector3(Math.max(-ROOM.w / 2 + 0.6, Math.min(ROOM.w / 2 - 0.6, cx)), 1.6 + Math.sin(this.camPitch) * dist, Math.max(-ROOM.d / 2 + 0.6, Math.min(ROOM.d / 2 - 0.6, cz)));
    this.camera.position.lerp(desired, Math.min(1, raw * 8));
    this.shake = Math.max(0, this.shake - raw * 2.5);
    const sh = this.shake * 0.12;
    this.camera.lookAt(this.pos.x + (Math.random() - 0.5) * sh, 1.3 + (Math.random() - 0.5) * sh, this.pos.z + (Math.random() - 0.5) * sh);
    this.renderer.render(this.scene, this.camera);

    // rush mode clock
    if (this.rushUntil && now > this.rushUntil) {
      const best = this.best(), isBest = this.score > best;
      if (isBest) try { localStorage.setItem(this.bestKey(), String(this.score)); } catch { /* fine */ }
      this.ended = { score: this.score, best: isBest };
      this.rushUntil = null;
    }
    if (now - this.hudAt > 100) {
      this.hudAt = now;
      const left = this.items.filter((i) => i.alive).length;
      this.opts.onHud({ score: this.score, combo: this.combo, best: this.best(), rush: !!this.rushUntil, timeLeft: this.rushUntil ? Math.max(0, Math.ceil((this.rushUntil - now) / 1000)) : null, tool: this.tool, left, total: this.items.length, last: this.last, ended: this.ended });
      if (this.rushUntil && left === 0) this.restock();
    }
  };

  private collide(x: number, z: number) {
    const r = 0.4;
    x = Math.max(-ROOM.w / 2 + r, Math.min(ROOM.w / 2 - r, x));
    z = Math.max(-ROOM.d / 2 + r, Math.min(ROOM.d / 2 - r, z));
    for (const b of this.tables) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) {
        const px = Math.min(x - (b.minX - r), b.maxX + r - x), pz = Math.min(z - (b.minZ - r), b.maxZ + r - z);
        if (px < pz) x = x < (b.minX + b.maxX) / 2 ? b.minX - r : b.maxX + r; else z = z < (b.minZ + b.maxZ) / 2 ? b.minZ - r : b.maxZ + r;
      }
    }
    for (const it of this.items) {
      if (!it.alive || it.y > 0.2) continue;
      const rr = KINDS[it.kind].radius + r, ddx = x - it.x, ddz = z - it.z, d = Math.hypot(ddx, ddz);
      if (d < rr && d > 0.001) { x = it.x + (ddx / d) * rr; z = it.z + (ddz / d) * rr; }
    }
    return { x, z };
  }

  private stepShards(dt: number) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const counts = new Map<Mat, number>();
    for (const s of this.shards) {
      s.age += dt;
      if (!s.rest) {
        s.v.y -= (s.mat === "paper" ? 3 : 18) * dt;
        if (s.mat === "paper") s.v.multiplyScalar(1 - dt * 1.5);
        const prevY = s.p.y;
        s.p.addScaledVector(s.v, dt);
        s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
        // walls
        if (Math.abs(s.p.x) > ROOM.w / 2 - 0.1) { s.p.x = Math.sign(s.p.x) * (ROOM.w / 2 - 0.1); s.v.x *= -0.4; }
        if (Math.abs(s.p.z) > ROOM.d / 2 - 0.1) { s.p.z = Math.sign(s.p.z) * (ROOM.d / 2 - 0.1); s.v.z *= -0.4; }
        // tables, then the floor
        let ground = 0;
        for (const b of this.tables) if (s.p.x > b.minX && s.p.x < b.maxX && s.p.z > b.minZ && s.p.z < b.maxZ && prevY >= b.top - 0.02) ground = Math.max(ground, b.top);
        const floor = ground + s.s.y * 0.5;
        if (s.p.y < floor) {
          s.p.y = floor;
          if (Math.abs(s.v.y) < 1.2) { s.rest = true; s.v.set(0, 0, 0); s.r.x = s.mat === "paper" ? -Math.PI / 2 : Math.round(s.r.x / (Math.PI / 2)) * (Math.PI / 2); }
          else { s.v.y *= -0.32; s.v.x *= 0.6; s.v.z *= 0.6; s.w.multiplyScalar(0.5); }
        }
      }
      const n = counts.get(s.mat) ?? 0; counts.set(s.mat, n + 1);
      q.setFromEuler(s.r); m4.compose(s.p, q, s.s);
      this.shardMeshes.get(s.mat)!.setMatrixAt(n, m4);
    }
    for (const [mat, im] of this.shardMeshes) { im.count = counts.get(mat) ?? 0; im.instanceMatrix.needsUpdate = true; }
    for (const f of this.fx) {
      const arr = (f.points.geometry.getAttribute("position") as THREE.BufferAttribute);
      let n = 0;
      f.data = f.data.filter((d) => (d.life -= dt) > 0);
      for (const d of f.data) {
        d.v.y -= 9 * dt; d.p.addScaledVector(d.v, dt);
        if (d.p.y < 0.02) { d.p.y = 0.02; d.v.multiplyScalar(0.3); }
        arr.setXYZ(n++, d.p.x, d.p.y, d.p.z);
      }
      f.points.geometry.setDrawRange(0, n); arr.needsUpdate = true;
    }
  }

  private stepProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter((pr) => {
      pr.v.y -= 9.8 * dt;
      pr.mesh.position.addScaledVector(pr.v, dt);
      pr.mesh.rotation.x += dt * 12;
      const p = pr.mesh.position;
      let smashed = false;
      for (const it of this.items) {
        if (!it.alive) continue;
        if (Math.hypot(p.x - it.x, p.z - it.z) < KINDS[it.kind].radius + 0.2 && p.y < it.y + KINDS[it.kind].radius * 2 + 0.3) { this.damage(it, 3, p.clone().sub(pr.v.clone().normalize()), 1.2); smashed = true; break; }
      }
      if (!smashed && (p.y < 0.1 || Math.abs(p.x) > ROOM.w / 2 - 0.2 || Math.abs(p.z) > ROOM.d / 2 - 0.2)) smashed = true;
      if (smashed) {
        this.scene.remove(pr.mesh);
        const fake: Item = { kind: "bottle", mesh: pr.mesh, x: p.x, y: Math.max(0, p.y - 0.2), z: p.z, hp: 0, wobble: 0, alive: false };
        this.spawnShards(fake, p.clone().sub(pr.v), 0.6);
        this.sound.play("glass");
        return false;
      }
      return true;
    });
  }

  // ── input ─────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    const key = ({ arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" } as Record<string, string>)[e.key.toLowerCase()] ?? e.key.toLowerCase();
    if (["w", "a", "s", "d", "shift"].includes(key)) { e.preventDefault(); this.press(key, true); this.sound.start(); }
    else if (key === " " && !e.repeat) { e.preventDefault(); this.swing(); }
    else if (key === "f" && !e.repeat) this.throwBottle();
    else if (key === "1") this.setTool("bat"); else if (key === "2") this.setTool("hammer"); else if (key === "3") this.setTool("club");
    else if (key === "r" && !e.repeat) this.restock();
  };
  private onKeyUp = (e: KeyboardEvent) => { const key = ({ arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" } as Record<string, string>)[e.key.toLowerCase()] ?? e.key.toLowerCase(); this.keys.delete(key); };
  private downAt = 0;
  private onPointerDown = (e: PointerEvent) => { this.sound.start(); if (this.dragging) return; this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY }; this.downAt = performance.now(); };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.dragging.id) return;
    const dx = e.clientX - this.dragging.x, dy = e.clientY - this.dragging.y; this.dragging.x = e.clientX; this.dragging.y = e.clientY;
    const k = e.pointerType === "touch" ? 1.5 : 1;
    this.camYaw -= dx * 0.006 * k; this.camPitch = Math.max(0.1, Math.min(0.9, this.camPitch + dy * 0.004 * k));
  };
  private onPointerUp = (e: PointerEvent) => {
    if (this.dragging?.id !== e.pointerId) return;
    // a quick click (not a drag) with the mouse swings
    if (e.pointerType === "mouse" && performance.now() - this.downAt < 220 && e.button === 0) this.swing();
    this.dragging = null;
  };
  private bind() {
    window.addEventListener("keydown", this.onKeyDown); window.addEventListener("keyup", this.onKeyUp);
    const el = this.renderer.domElement; el.style.touchAction = "none";
    el.addEventListener("pointerdown", this.onPointerDown); window.addEventListener("pointermove", this.onPointerMove); window.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); this.throwBottle(); });
  }
  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize); window.removeEventListener("keydown", this.onKeyDown); window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointermove", this.onPointerMove); window.removeEventListener("pointerup", this.onPointerUp);
    this.rig.dispose(); this.sound.dispose();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []; mats.forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); }); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
