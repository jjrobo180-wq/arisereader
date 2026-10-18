// Animal Splash — the 3D pond: terrain, water, lily pads, reeds, trees, a dock, wildlife,
// and the 3D animals that leap in with a splash, get named, and swim off to join the pond.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Animal } from "@shared/splash/animals";
import { makeCreature, type Creature } from "./creatures";
import { Fx } from "@/game/skybound/fx";
import { bakeStatic, glowSprite } from "@/game/runner/models";
import { makeWater, heightAt, MAX_RIPPLES, type Ripple } from "./water";

export type Quality = "low" | "medium" | "high";
const R = 9.6; // pond radius
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const std = (color: number, rough = 0.7, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
function seeded(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const shoreAt = (a: number) => R + 0.9 * Math.sin(a * 3 + 0.6) + 0.55 * Math.sin(a * 5 + 2.1) + 0.3 * Math.sin(a * 9);

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function labelTexture(text: string, color: number) {
  const cv = document.createElement("canvas"); cv.width = 640; cv.height = 160; const c = cv.getContext("2d")!;
  roundRect(c, 8, 8, 624, 144, 64); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 10; c.strokeStyle = "#" + new THREE.Color(color).getHexString(); c.stroke();
  c.fillStyle = "#13233f"; c.textAlign = "center"; c.textBaseline = "middle"; const size = text.length > 9 ? 70 : 92;
  c.font = `900 ${size}px "Nunito","Arial Rounded MT Bold",ui-rounded,system-ui,sans-serif`; c.fillText(text.toUpperCase(), 320, 86, 580);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

type Raft = {
  animal: Animal; c: Creature; g: THREE.Group; label: THREE.Sprite | null;
  mode: "fly" | "float" | "dock" | "docked" | "parade"; t: number; from: THREE.Vector3; to: THREE.Vector3; scale: number; scaleFrom: number; scaleTo: number;
  bob: number; slot: number; plunge: number; happy: number; oops: number; heading: number; specialIn: number; leap: number; wakeT: number; spin: number;
};

export class PondScene {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900); renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null; private fx: Fx; private ripples: Ripple[] = []; private uRip: THREE.Vector4[];
  private water: THREE.Mesh; private waterMat: THREE.ShaderMaterial;
  private rafts: Raft[] = []; private active: Raft | null = null; private pads: { m: THREE.Object3D; x: number; z: number; r: number }[] = [];
  private fish: { g: THREE.Group; t: number; dur: number; a: THREE.Vector3; b: THREE.Vector3; splashed: boolean }[] = [];
  private flies: { g: THREE.Group; wings: THREE.Object3D[]; seed: number }[] = []; private clouds: THREE.Sprite[] = [];
  private crown: THREE.Mesh; private crownT = 9; private rainbow: THREE.Mesh; private rainbowT = -1; private fountainT = 0; private finaleT = -1;
  private raf = 0; private last = 0; t = 0; private disposed = false; private resizeObs: ResizeObserver; private rnd = seeded(5); private fishTimer = 4;
  private ray = new THREE.Raycaster(); private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  onSound: ((name: string) => void) | null = null;

  constructor(private host: HTMLElement, private quality: Quality) {
    const q = quality, phone = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "high" ? 2 : q === "medium" ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = q !== "low"; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
    host.appendChild(this.renderer.domElement);

    const sunDir = new THREE.Vector3(-0.55, 0.75, -0.4).normalize();
    this.scene.fog = new THREE.Fog(0xcdeefe, 70, 210);
    this.scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x5f8f4a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.3); sun.position.copy(sunDir).multiplyScalar(40); sun.castShadow = q !== "low";
    sun.shadow.mapSize.set(q === "high" ? 2048 : 1024, q === "high" ? 2048 : 1024); Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 100 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
    this.scene.add(sun);

    this.buildSky(sunDir);
    this.buildTerrain();
    const w = makeWater({ deep: 0x0e6aa8, shallow: 0x3fd0d8, sky: 0xbfe8ff, foam: 0xffffff, sun: sunDir, radius: R });
    this.waterMat = w.mat; this.uRip = w.uRip;
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2 * (R + 2.6), 2 * (R + 2.6), q === "low" ? 90 : 150, q === "low" ? 90 : 150), this.waterMat);
    this.water.rotation.x = -Math.PI / 2; this.water.position.y = 0; this.scene.add(this.water);
    this.buildShore(); this.buildLife();

    // splash crown (a quick white water sheet) and a rainbow for celebrations
    const crownTex = (() => { const cv = document.createElement("canvas"); cv.width = 16; cv.height = 128; const c = cv.getContext("2d")!; const g = c.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.7, "rgba(220,250,255,.6)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 16, 128); const t = new THREE.CanvasTexture(cv); return t; })();
    this.crown = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.55, 1, 32, 1, true), new THREE.MeshBasicMaterial({ map: crownTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
    this.crown.visible = false; this.scene.add(this.crown);
    const rbTex = (() => { const cv = document.createElement("canvas"); cv.width = 256; cv.height = 8; const c = cv.getContext("2d")!; const cols = ["#ff5b5b", "#ffa33a", "#ffe14a", "#58d85a", "#3fb6ff", "#6b6bff", "#b46bff"]; cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 256 / 7, 0, 256 / 7 + 1, 8); }); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const rbGeo = new THREE.RingGeometry(4.6, 5.8, 64, 1, 0, Math.PI);
    const uv = rbGeo.attributes.uv as THREE.BufferAttribute, pos = rbGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 4.6) / 1.2, 0.5); }
    this.rainbow = new THREE.Mesh(rbGeo, new THREE.MeshBasicMaterial({ map: rbTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.rainbow.visible = false; this.scene.add(this.rainbow);

    this.fx = new Fx(this.scene, this.renderer.getPixelRatio());
    if (q === "high" || (q === "medium" && !phone)) {
      const size = new THREE.Vector2(); this.renderer.getDrawingBufferSize(size);
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q === "high" ? 4 : 0 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.5, 0.9));
      this.composer.addPass(new OutputPass());
    }
    this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(host); this.resize();
    if (import.meta.env.DEV) (window as unknown as { __pond?: PondScene }).__pond = this;
    this.last = performance.now(); this.raf = requestAnimationFrame(this.frame);
  }

  // ── building the world ──
  private buildSky(sunDir: THREE.Vector3) {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3d9bff) }, mid: { value: new THREE.Color(0xc9ecff) }, bot: { value: new THREE.Color(0xeaf8ff) } },
      vertexShader: "varying vec3 vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vD = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vD; void main(){ float h = normalize(vD).y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.4, 0.0, 1.0), 0.75)) : bot; gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
    }));
    sky.renderOrder = -2; this.scene.add(sky);
    const sun = glowSprite(0xfff2c0, 120, 0.8); (sun.material as THREE.SpriteMaterial).fog = false; sun.position.copy(sunDir).multiplyScalar(330); this.scene.add(sun);
    const core = glowSprite(0xffffff, 26, 1); (core.material as THREE.SpriteMaterial).fog = false; core.position.copy(sun.position); this.scene.add(core);
    // soft clouds
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const c = cv.getContext("2d")!;
    for (const [x, y, r] of [[70, 80, 46], [120, 62, 58], [175, 78, 44], [140, 92, 40], [95, 96, 36]] as const) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.6, "rgba(255,255,255,.85)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.92 })); const a = -Math.PI * 0.15 - this.rnd() * Math.PI * 0.7; s.position.set(Math.cos(a) * 180, 40 + this.rnd() * 45, Math.sin(a) * 180); s.scale.set(70 + this.rnd() * 50, 35 + this.rnd() * 20, 1); this.clouds.push(s); this.scene.add(s); }
  }

  private buildTerrain() {
    const size = 260, seg = this.quality === "low" ? 120 : 180;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute, cols = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(0xe8d29a), wet = new THREE.Color(0x9a8a5a), deep = new THREE.Color(0x3a7a6a), grass = new THREE.Color(0x76c24e), grass2 = new THREE.Color(0x4f9e3a), hill = new THREE.Color(0x5aa848), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x), s = shoreAt(a);
      const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) + 0.5 * Math.sin(x * 0.5 + z * 0.3);
      let h: number;
      if (r < s) h = -2.4 * (1 - Math.pow(r / s, 2.2)) - 0.25;
      else h = Math.min(0.55, (r - s) * 0.28) + Math.max(0, (r - s - 8)) * 0.05 * (1.4 + n) + Math.max(0, r - 45) * 0.12 * (1 + 0.6 * n);
      if (r > s && r < s + 1.0) h = (r - s) * 0.32 - 0.05;
      pos.setY(i, h);
      if (h < -0.35) c.copy(deep).lerp(wet, Math.max(0, 1 + h / 2.6)); else if (h < 0.28) c.copy(sand); else c.copy(grass).lerp(grass2, Math.min(1, Math.max(0, n * 0.5 + 0.3))).lerp(hill, Math.min(1, Math.max(0, (h - 2) / 8)));
      c.offsetHSL(0, 0, (Math.sin(x * 2.3 + z * 1.7) * 0.5 + 0.5) * 0.03);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m.receiveShadow = this.quality !== "low"; this.scene.add(m);
  }

  private buildShore() {
    const g = new THREE.Group(); const rnd = this.rnd;
    const trunk = std(0x7a4a28, 0.85), leaves = [std(0x4caf50, 0.8), std(0x5cc85a, 0.8), std(0x3f9a45, 0.8)], pine = std(0x2f8a4a, 0.8), rock = std(0x9aa0a8, 0.9), rockDark = std(0x7f868f, 0.9);
    const ground = (x: number, z: number) => { const r = Math.hypot(x, z), s = shoreAt(Math.atan2(z, x)); return r > s ? Math.min(0.55, (r - s) * 0.28) : 0; };
    // trees in a ring behind the pond (keep the front open for the camera)
    for (let i = 0; i < 34; i++) {
      const a = -Math.PI * 0.02 - rnd() * Math.PI * 1.04 - (i % 3 === 0 ? Math.PI * (0.9 + rnd() * 0.2) : 0); const s = shoreAt(a), r = s + 3 + rnd() * 16;
      const x = Math.cos(a) * r, z = Math.sin(a) * r; if (z > 6) continue;
      const t = new THREE.Group(); t.position.set(x, ground(x, z), z); const k = 0.9 + rnd() * 0.9;
      if (rnd() < 0.35) { const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * k, 0.26 * k, 1.4 * k, 7), trunk); cy.position.y = 0.7 * k; t.add(cy); for (let j = 0; j < 3; j++) { const co = new THREE.Mesh(new THREE.ConeGeometry((1.7 - j * 0.42) * k, 2 * k, 9), pine); co.position.y = (2 + j * 1.15) * k; t.add(co); } }
      else { const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * k, 0.32 * k, 2.4 * k, 7), trunk); cy.position.y = 1.2 * k; t.add(cy); for (const [px, py, pz, pr] of [[0, 3, 0, 1.4], [0.8, 2.6, 0.3, 1], [-0.8, 2.7, -0.2, 1.05], [0.1, 3.8, 0.1, 0.95]] as const) { const sp = new THREE.Mesh(new THREE.SphereGeometry(pr * k, 12, 10), leaves[Math.floor(rnd() * 3)]); sp.position.set(px * k, py * k, pz * k); t.add(sp); } }
      g.add(t);
    }
    // rocks on the shoreline
    for (let i = 0; i < 18; i++) { const a = rnd() * Math.PI * 2, r = shoreAt(a) + 0.2 + rnd() * 0.6; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rnd() * 0.6, 0), rnd() < 0.5 ? rock : rockDark); m.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.scale.y = 0.6; g.add(m); }
    // reeds & cattails at the water's edge
    const reed = std(0x5a9a3a, 0.8), cat = std(0x6a3f22, 0.8);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2; if (Math.sin(a) > 0.55) continue; const r = shoreAt(a) - 0.3;
      for (let k = 0; k < 7; k++) {
        const x = Math.cos(a) * r + (rnd() - 0.5) * 1.1, z = Math.sin(a) * r + (rnd() - 0.5) * 1.1, h = 1.3 + rnd() * 1.4;
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, h, 5), reed); st.position.set(x, h / 2 - 0.2, z); st.rotation.set((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25); g.add(st);
        if (k % 2 === 0) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 4, 8), cat); c.position.set(x + st.rotation.z * -h * 0.5, h - 0.2, z + st.rotation.x * h * 0.5); g.add(c); }
      }
    }
    // a little wooden dock on the left
    const plank = std(0xb07a4a, 0.85), post = std(0x7a5232, 0.85), da = Math.PI * 0.93, ds = shoreAt(da);
    const dock = new THREE.Group(); dock.position.set(Math.cos(da) * (ds + 1.5), 0, Math.sin(da) * (ds + 1.5)); dock.rotation.y = -da + Math.PI / 2;
    for (let k = 0; k < 9; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.42), plank); p.position.set(0, 0.55, -k * 0.48); dock.add(p); }
    for (const zz of [0, -1.9, -3.8]) for (const xx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 7), post); p.position.set(xx, 0, zz); dock.add(p); }
    g.add(dock);
    g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = this.quality !== "low"; m.receiveShadow = false; } });
    this.scene.add(bakeStatic(g));

    // floating lily pads (some with flowers)
    const padMat = std(0x3f9a3a, 0.7, { side: THREE.DoubleSide }), padEdge = std(0x2f7a2a, 0.7), petal = std(0xffb6d2, 0.5), petalW = std(0xfff4f8, 0.5), mid = std(0xffd23f, 0.4);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, r = (0.55 + rnd() * 0.37) * shoreAt(a); const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z > 3 && Math.abs(x) < 4) continue; // keep the splash spot clear
      const p = new THREE.Group(); const pr = 0.45 + rnd() * 0.5;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(pr, 22, 0.25, Math.PI * 2 - 0.5), padMat); pad.rotation.x = -Math.PI / 2; p.add(pad);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(pr, 0.03, 4, 22, Math.PI * 2 - 0.5), padEdge); edge.rotation.x = -Math.PI / 2; edge.rotation.z = 0.25; p.add(edge);
      if (rnd() < 0.4) { for (let k = 0; k < 7; k++) { const pe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), k % 2 ? petal : petalW); pe.scale.set(0.5, 0.35, 1.2); const ang = (k / 7) * Math.PI * 2; pe.position.set(Math.cos(ang) * 0.13, 0.1, Math.sin(ang) * 0.13); pe.rotation.y = -ang + Math.PI / 2; pe.rotation.x = -0.6; p.add(pe); } const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mid); m2.position.y = 0.12; p.add(m2); }
      p.rotation.y = rnd() * 6; this.scene.add(p); this.pads.push({ m: p, x, z, r: pr });
    }
  }

  private buildLife() {
    // dragonflies
    const body = std(0x2fb6c9, 0.3, { metalness: 0.4, emissive: 0x1a6a8a, emissiveIntensity: 0.3 }), wing = new THREE.MeshStandardMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.42, 4, 8), body); b.rotation.x = Math.PI / 2; g.add(b);
      const wings: THREE.Object3D[] = [];
      for (const s of [-1, 1]) for (const zz of [0.05, -0.08]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.08), wing); w.position.set(s * 0.18, 0.02, zz); w.rotation.x = -Math.PI / 2; g.add(w); wings.push(w); }
      this.scene.add(g); this.flies.push({ g, wings, seed: i * 2.3 + 1 });
    }
    // fish for the occasional jump
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(); const col = [0xff8a2a, 0xffb02e, 0xff6a5a, 0xffd23f][i];
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), std(col, 0.35, { emissive: col, emissiveIntensity: 0.12 })); b.scale.set(0.6, 0.75, 1.5); g.add(b);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), std(col, 0.4)); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.42; tail.scale.x = 0.25; g.add(tail);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), std(0x111111, 0.2)); e.position.set(s * 0.1, 0.06, 0.2); g.add(e); }
      g.visible = false; this.scene.add(g); this.fish.push({ g, t: 9, dur: 1, a: new THREE.Vector3(), b: new THREE.Vector3(), splashed: true });
    }
  }

  // ── a live 3D animal ──
  private makeRaft(a: Animal): Raft {
    const c = makeCreature(a.id); c.emit = (kind, at) => this.emitFx(kind, at);
    c.g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = this.quality !== "low"; });
    this.scene.add(c.g);
    return { animal: a, c, g: c.g, label: null, mode: "fly", t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), scale: 1, scaleFrom: 1, scaleTo: 1, bob: this.rnd() * 6, slot: -1, plunge: 0, happy: 0, oops: 0, heading: 0, specialIn: 5 + this.rnd() * 8, leap: -1, wakeT: 0, spin: 0 };
  }
  private emitFx(kind: "spray" | "spout" | "splash" | "bubbles", at: THREE.Vector3) {
    if (kind === "spray") this.fx.one(at.x, at.y, at.z, (Math.random() - 0.5) * 0.8, 5.5 + Math.random() * 2, Math.random() < 0.5 ? 0xffffff : 0x9fe8ff, 1.0, 0.26, 9);
    else if (kind === "spout") { for (let i = 0; i < 2; i++) this.fx.one(at.x + (Math.random() - 0.5) * 0.2, at.y, at.z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.9, 6 + Math.random() * 2.5, Math.random() < 0.6 ? 0xffffff : 0xcff6ff, 1.1, 0.3, 8); }
    else if (kind === "splash") { this.ripples.push({ x: at.x, z: at.z, t0: this.t, power: 0.6 }); if (this.ripples.length > MAX_RIPPLES) this.ripples.shift(); this.fx.burst(at.x, 0.2, at.z, { color: [0xffffff, 0xd8f6ff], count: 40, speed: 3.5, up: 5, life: 0.8, size: 0.24, gravity: 13, spreadZ: 3 }); this.onSound?.("plop"); }
    else this.fx.burst(at.x, 0.1, at.z, { color: 0xffffff, count: 6, speed: 0.6, up: 1, life: 0.6, size: 0.14, gravity: -1 });
  }

  private slotPos(i: number) {
    // a horseshoe around the sides and back of the pond, leaving the front-centre splash spot clear
    const row = i % 2, k = Math.floor(i / 2); const r = row ? 5.4 : 7.4;
    const a = Math.PI * (0.84 + (k + (row ? 0.5 : 0.1)) / 7.6 * 1.32);
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }

  /** Leap an animal from a point on screen into the middle of the pond. Resolves once it has splashed and settled. */
  async launch(a: Animal, fromClient?: { x: number; y: number }) {
    const raft = this.makeRaft(a);
    const from = this.worldFromScreen(fromClient ?? { x: this.host.getBoundingClientRect().left + this.host.clientWidth / 2, y: this.host.getBoundingClientRect().bottom - 40 }, 7);
    raft.from.copy(from); raft.to.set(0, 0, 2.2); raft.mode = "fly"; raft.t = 0; raft.scale = 0.45; raft.scaleTo = 1.45;
    this.rafts.push(raft); this.active = raft;
    this.onSound?.("whoosh");
    return new Promise<void>(resolve => { raft.g.userData.landed = resolve; });
  }
  private splashAt(x: number, z: number, power = 1.3) {
    this.ripples.push({ x, z, t0: this.t, power }); if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
    this.fx.burst(x, 0.3, z, { color: [0xffffff, 0xd8f6ff, 0x9fe8ff], count: 110, speed: 6.5, up: 7, life: 1.1, size: 0.32, gravity: 15, spreadZ: 6, drag: 0.6 });
    this.fx.burst(x, 0.6, z, { color: [0xffffff, 0xeafcff], count: 40, speed: 2.5, up: 2, life: 0.9, size: 0.6, gravity: 2, spreadZ: 3 });
    this.crown.position.set(x, 0.05, z); this.crownT = 0; this.crown.visible = true;
  }
  celebrate() {
    const r = this.active; if (!r) return;
    this.label(r); r.happy = 1; window.setTimeout(() => r.c.special(), 1500);
    this.rainbowT = 0; this.rainbow.visible = true; this.rainbow.position.set(0, -0.6, r.to.z - 3.2);
    this.fountainT = 1.8; this.onSound?.("fountain");
    for (let i = 0; i < 3; i++) window.setTimeout(() => this.jumpFish(true), 250 + i * 380);
    this.fx.burst(0, 4, r.to.z, { color: [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b, 0xffffff], count: 90, speed: 7, up: 3, life: 1.4, size: 0.3, gravity: 5, spreadZ: 4 });
  }
  gentle() { const r = this.active; if (!r) return; r.oops = 1; this.label(r); for (let i = 0; i < 24; i++) this.fx.one(r.g.position.x + (Math.random() - 0.5) * 2.4, 0.2, r.g.position.z + (Math.random() - 0.5) * 1.5, 0, 1 + Math.random() * 1.5, 0xbff6ff, 1.6, 0.18); }
  private label(r: Raft) {
    if (r.label) return;
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(r.animal.name, r.animal.color), transparent: true, toneMapped: false, depthWrite: false }));
    m.center.set(0.5, 0); m.renderOrder = 20; m.scale.set(0.01, 0.01, 1); this.scene.add(m); r.label = m;
  }
  /** Send the active raft to its place in the pond collection. */
  dock(slot: number) {
    const r = this.active; if (!r) return; this.active = null;
    r.from.copy(r.g.position); r.to.copy(this.slotPos(slot)); r.mode = "dock"; r.t = 0; r.slot = slot; r.scaleFrom = r.scale; r.scaleTo = 0.78;
    this.onSound?.("dock");
  }
  /** Put an already-named animal straight into its pond spot (restoring a saved pond). */
  placeDocked(a: Animal, slot: number) {
    if (this.disposed) return;
    const r = this.makeRaft(a); r.mode = "docked"; r.slot = slot; r.to.copy(this.slotPos(slot)); r.scale = r.scaleTo = 0.78; r.heading = Math.atan2(this.camera.position.x - r.to.x, this.camera.position.z - r.to.z);
    this.label(r); r.g.position.copy(r.to);
    if (this.finaleT >= 0) r.mode = "parade";
    this.rafts.push(r);
  }
  finale() { this.finaleT = 0; this.rainbowT = 0; this.rainbow.visible = true; this.rainbow.position.set(0, -0.6, -4); for (const r of this.rafts) if (r.mode === "docked") r.mode = "parade"; }
  reset() { for (const r of this.rafts) { r.g.removeFromParent(); r.label?.removeFromParent(); (r.label?.material as THREE.SpriteMaterial | undefined)?.map?.dispose(); } this.rafts = []; this.active = null; this.finaleT = -1; this.rainbowT = -1; this.rainbow.visible = false; }

  /** Is a screen point over the pond's water? (for drag-and-drop) */
  isOverPond(clientX: number, clientY: number) { const p = this.groundHit(clientX, clientY); return !!p && Math.hypot(p.x, p.z) < R * 1.05; }
  private ndc(clientX: number, clientY: number) { const r = this.host.getBoundingClientRect(); return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1); }
  private groundHit(clientX: number, clientY: number) { this.ray.setFromCamera(this.ndc(clientX, clientY), this.camera); const out = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, out) ? out : null; }
  private worldFromScreen(p: { x: number; y: number }, dist: number) { this.ray.setFromCamera(this.ndc(p.x, p.y), this.camera); return this.ray.ray.at(dist, new THREE.Vector3()); }

  private jumpFish(near = false) {
    const f = this.fish.find(x => x.t >= x.dur); if (!f) return;
    const a = this.rnd() * Math.PI * 2, r = near ? 3 + this.rnd() * 2 : 2 + this.rnd() * (R - 4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * (near ? 0.6 : 1) - (near ? 1 : 0), dir = this.rnd() * Math.PI * 2, len = 1.6 + this.rnd();
    f.a.set(x, -0.3, z); f.b.set(x + Math.cos(dir) * len, -0.3, z + Math.sin(dir) * len); f.t = 0; f.dur = 0.9 + this.rnd() * 0.3; f.splashed = false; f.g.visible = true;
    this.ripples.push({ x, z, t0: this.t, power: 0.35 }); if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
    this.fx.burst(x, 0.1, z, { color: [0xffffff, 0xcff6ff], count: 14, speed: 2.4, up: 3, life: 0.6, size: 0.2, gravity: 10, spreadZ: 2 });
    this.onSound?.("fish");
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.fov = this.camera.aspect < 0.75 ? 62 : this.camera.aspect < 1.1 ? 52 : 44; this.camera.updateProjectionMatrix();
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt; const t = this.t;
    // camera: a gentle breathing sway above the near shore
    const tall = this.camera.aspect < 0.75;
    const cx = Math.sin(t * 0.13) * 0.7, cz = tall ? 21.5 : 18.5, cy = tall ? 14.5 : 10.2;
    this.camera.position.set(cx, cy + Math.sin(t * 0.21) * 0.15, cz); this.camera.lookAt(cx * 0.3, tall ? -0.4 : -1.6, tall ? -1.5 : 0);

    this.waterMat.uniforms.uTime.value = t;
    this.ripples = this.ripples.filter(r => t - r.t0 < 7);
    for (let i = 0; i < MAX_RIPPLES; i++) { const r = this.ripples[i]; if (r) this.uRip[i].set(r.x, r.z, r.t0, r.power); else this.uRip[i].set(0, 0, -99, 0); }
    for (const p of this.pads) { p.m.position.set(p.x, heightAt(p.x, p.z, t, this.ripples) + 0.02, p.z); p.m.rotation.x = Math.sin(t * 1.1 + p.x) * 0.04; }
    for (const c of this.clouds) { c.position.x += dt * 0.6; if (c.position.x > 200) c.position.x = -200; }
    this.flies.forEach((f, i) => {
      const s = f.seed, a = t * (0.35 + i * 0.08) + s;
      f.g.position.set(Math.cos(a) * (4 + i * 1.6) + Math.sin(t * 1.7 + s) * 0.8, 1.4 + Math.sin(t * 2.3 + s) * 0.4 + i * 0.3, Math.sin(a * 1.3) * (3 + i) - 1.5);
      f.g.rotation.y = -a + Math.PI / 2 + Math.sin(t * 5 + s) * 0.2;
      f.wings.forEach((w, k) => { w.rotation.z = Math.sin(t * 60 + k) * 0.5; });
    });
    this.fishTimer -= dt; if (this.fishTimer <= 0) { this.fishTimer = 5 + this.rnd() * 6; this.jumpFish(); }
    for (const f of this.fish) {
      if (f.t >= f.dur) continue; f.t += dt; const k = Math.min(1, f.t / f.dur);
      f.g.position.lerpVectors(f.a, f.b, k); f.g.position.y = -0.3 + Math.sin(k * Math.PI) * 1.6;
      f.g.lookAt(f.b.x, f.g.position.y + Math.cos(k * Math.PI) * 1.4, f.b.z);
      if (k > 0.92 && !f.splashed) { f.splashed = true; this.ripples.push({ x: f.b.x, z: f.b.z, t0: t, power: 0.35 }); this.fx.burst(f.b.x, 0.1, f.b.z, { color: [0xffffff, 0xcff6ff], count: 16, speed: 2.6, up: 3, life: 0.6, size: 0.2, gravity: 10, spreadZ: 2 }); }
      if (k >= 1) f.g.visible = false;
    }

    // animals
    const camYaw = (p: THREE.Vector3) => Math.atan2(this.camera.position.x - p.x, this.camera.position.z - p.z);
    const turn = (r: Raft, want: number, k: number) => { let d = want - r.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; r.heading += d * Math.min(1, k); };
    for (const r of this.rafts) {
      const g = r.g; r.t += dt; let swim = 0;
      r.happy = Math.max(0, r.happy - dt / 1.6); r.oops = Math.max(0, r.oops - dt / 1.2);
      if (r.mode === "fly") {
        const k = Math.min(1, r.t / 0.95);
        g.position.lerpVectors(r.from, r.to, k); g.position.y = THREE.MathUtils.lerp(r.from.y, 0, k) + Math.sin(k * Math.PI) * 4.2;
        r.scale = THREE.MathUtils.lerp(0.45, r.scaleTo, ease(k)); r.spin = (1 - ease(k)) * Math.PI * 2; turn(r, camYaw(r.to), 1);
        if (k >= 1) { r.mode = "float"; r.t = 0; r.plunge = 1; r.spin = 0; this.splashAt(r.to.x, r.to.z, 1.4); this.onSound?.("splash"); window.setTimeout(() => (g.userData.landed as (() => void) | undefined)?.(), 1100); }
      } else {
        let base = r.to;
        if (r.mode === "dock") {
          const dist = r.from.distanceTo(r.to), dur = Math.max(1.6, dist / 3.2), k = Math.min(1, r.t / dur), e = ease(k);
          base = new THREE.Vector3().lerpVectors(r.from, r.to, e); swim = 1;
          r.scale = THREE.MathUtils.lerp(r.scaleFrom, r.scaleTo, e); turn(r, k < 0.85 ? Math.atan2(r.to.x - r.from.x, r.to.z - r.from.z) : camYaw(r.to), dt * 5);
          if (k >= 1) { r.mode = "docked"; r.t = 0; this.ripples.push({ x: r.to.x, z: r.to.z, t0: t, power: 0.4 }); if (this.ripples.length > MAX_RIPPLES) this.ripples.shift(); this.onSound?.("plop"); }
        } else if (r.mode === "docked") {
          // potter about near its spot, mostly looking toward you; sometimes show off
          const a0 = t * 0.18 + r.bob; base = new THREE.Vector3(r.to.x + Math.cos(a0) * 0.45, 0, r.to.z + Math.sin(a0) * 0.3);
          turn(r, camYaw(base) + Math.sin(t * 0.3 + r.bob) * 0.7, dt * 1.5);
          r.specialIn -= dt;
          if (r.specialIn <= 0) { r.specialIn = 9 + this.rnd() * 12; if (r.c.motion === "leap") r.leap = 0; else r.c.special(); }
        } else if (r.mode === "parade") {
          const a0 = Math.atan2(r.to.z, r.to.x) + t * 0.35, rr = Math.hypot(r.to.x, r.to.z); base = new THREE.Vector3(Math.cos(a0) * rr, 0, Math.sin(a0) * rr);
          turn(r, Math.atan2(-Math.sin(a0), Math.cos(a0)), dt * 4); swim = 1;
          r.specialIn -= dt; if (r.specialIn <= 0) { r.specialIn = 4 + this.rnd() * 6; if (r.c.motion === "leap") r.leap = 0; else r.c.special(); }
        } else { turn(r, camYaw(r.to), dt * 3); }
        const wade = r.c.motion === "wade" ? 0.35 : 1;
        const wh = heightAt(base.x, base.z, t, this.ripples) * wade;
        r.plunge = Math.max(0, r.plunge - dt * 0.9);
        const dip = r.plunge > 0 ? -Math.sin((1 - r.plunge) * Math.PI * 2.2) * r.plunge * 1.1 : 0;
        let ly = 0, lx = 0;
        if (r.leap >= 0) { r.leap += dt / 1.3; const k = Math.min(1, r.leap); ly = Math.sin(k * Math.PI) * 2.6 - 0.2; lx = Math.cos(k * Math.PI) * 0.7; swim = 1; if (r.leap >= 1) { r.leap = -1; this.emitFx("splash", g.position); } if (k < 0.05) this.emitFx("splash", g.position); }
        g.position.set(base.x, (r.mode === "dock" ? Math.sin(Math.min(1, r.t / 1.6) * Math.PI) * 0.5 : 0) + wh + dip + ly, base.z);
        g.rotation.x = r.leap >= 0 ? -lx : Math.sin(t * 1.3 + r.bob) * 0.03 * wade;
        g.rotation.z = Math.sin(t * 1.1 + r.bob) * 0.04 * wade;
        if (swim) { r.wakeT -= dt; if (r.wakeT <= 0 && r.leap < 0) { r.wakeT = 0.18; this.fx.one(g.position.x + (Math.random() - 0.5) * 0.5 * r.scale, 0.12, g.position.z + (Math.random() - 0.5) * 0.5 * r.scale, 0, 0.4, 0xffffff, 0.7, 0.22 * r.scale, 0); } }
      }
      g.rotation.y = r.heading + r.spin; g.scale.setScalar(r.scale);
      r.c.update({ dt, t: t + r.bob, swim, happy: r.happy, oops: r.oops });
      if (r.label) {
        const want = r.mode === "docked" || r.mode === "parade" || r.mode === "dock" ? 0.56 : 1; const cur = r.label.scale.y / 0.65;
        const s2 = cur + (want - cur) * Math.min(1, dt * (cur < 0.1 ? 14 : 4)); r.label.scale.set(2.6 * s2, 0.65 * s2, 1);
        r.label.position.set(g.position.x, g.position.y + (r.c.top + 0.25) * r.scale, g.position.z);
      }
    }

    // crown, rainbow, fountains, finale
    if (this.crownT < 1) { this.crownT += dt / 0.75; const k = Math.min(1, this.crownT); this.crown.scale.set(0.5 + k * 2.4, Math.sin(k * Math.PI) * 2.2 + 0.01, 0.5 + k * 2.4); (this.crown.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85; if (k >= 1) this.crown.visible = false; }
    if (this.rainbowT >= 0) { this.rainbowT += dt; const op = this.finaleT >= 0 ? Math.min(0.75, this.rainbowT) : Math.min(0.75, this.rainbowT * 1.5) * Math.max(0, Math.min(1, 3.6 - this.rainbowT)); (this.rainbow.material as THREE.MeshBasicMaterial).opacity = op; this.rainbow.scale.setScalar(0.9 + Math.min(1, this.rainbowT) * 0.25); if (this.finaleT < 0 && this.rainbowT > 3.6) { this.rainbowT = -1; this.rainbow.visible = false; } }
    if (this.fountainT > 0 && this.active) {
      this.fountainT -= dt; const c = this.active.g.position;
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + t; this.fx.one(c.x + Math.cos(a) * 2.2, 0.2, c.z + Math.sin(a) * 1.4, Math.cos(a) * 0.6, 7 + Math.random() * 2, Math.random() < 0.5 ? 0xffffff : 0x9fe8ff, 1.1, 0.25, 9); }
    }
    if (this.finaleT >= 0) {
      this.finaleT += dt;
      if (Math.random() < dt * 3) { const a = Math.random() * Math.PI * 2, rr = Math.random() * 6; const x = Math.cos(a) * rr, z = Math.sin(a) * rr - 1; this.fx.burst(x, 3 + Math.random() * 4, z, { color: [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b, 0xffffff][Math.floor(Math.random() * 5)], count: 60, speed: 6, life: 1.3, size: 0.32, gravity: 4, spreadZ: 6 }); }
      if (Math.random() < dt * 0.8) this.jumpFish(true);
    }

    this.fx.update(dt);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.resizeObs.disconnect(); this.fx.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); } });
    this.composer?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
    const w = window as unknown as { __pond?: PondScene }; if (import.meta.env.DEV && w.__pond === this) delete w.__pond;
  }
}

