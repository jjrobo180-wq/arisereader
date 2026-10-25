// Reading Ninja — renders the arena, glossy word tokens that split in two when sliced, juice, the blade, and the gaze ring.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { NinjaSim, FLOOR, type Difficulty, type NinjaEvent, type NinjaInput, type NinjaResult, type Segment } from "@shared/ninja/sim";
import type { NinjaLevel } from "@shared/ninja/missions";
import { Fx } from "@/game/skybound/fx";
import { bakeStatic, glowSprite, makeProp } from "@/game/runner/models";
import { groundTexture, skylineTexture, type CardStyle } from "@/game/runner/textures";
import { splatTextures, tokenTexture } from "./textures";
import type { NinjaAudio } from "./audio";
import { touchOnly } from "@/lib/gazeDefaults";

export type Quality = "low" | "medium" | "high";
export type Steer = "look" | "touch";
export type NinjaGameOptions = { difficulty: Difficulty; dwellMs: number; slowLook: boolean; glow: boolean; quality: Quality; cardStyle: CardStyle; steer: Steer; demo?: boolean; seed?: number; music?: boolean };
export type NinjaHud = { caught: number; goal: number; hearts: number; hasHearts: boolean; score: number; state: NinjaSim["state"] };
export type NinjaCallbacks = { onHud?: (h: NinjaHud) => void; onEvent?: (e: NinjaEvent) => void; onEnd?: (r: NinjaResult) => void };

const STEP = 1 / 120, TRAIL = 48, CAM_Z = 15, CAM_Y = 3.1;
function seeded(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
type View = { g: THREE.Group; disc: THREE.Group; halo: THREE.Sprite; ring: THREE.Mesh; rim: THREE.MeshStandardMaterial; face: THREE.MeshBasicMaterial };
type Half = { g: THREE.Group; vx: number; vy: number; vr: number; t: number };
type Splat = { m: THREE.Mesh; t: number };

export class NinjaGame {
  sim: NinjaSim; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900); renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null; private fx: Fx;
  private views = new Map<number, View>(); private halves: Half[] = []; private splats: Splat[] = [];
  private trail: { x: number; y: number; t: number }[] = []; private ribbon: THREE.Mesh; private tip: THREE.Sprite; private pressing = false; private swipeId = 0; private swipes: Segment[] = []; private last: { x: number; y: number } | null = null; private gaze: { x: number; y: number } | null = null; private pointerType = "mouse";
  private raf = 0; private lastT = 0; private acc = 0; t = 0; private paused = false; private disposed = false; private ended = false; private shakeT = 0; private hudT = 0;
  private resizeObs: ResizeObserver; private ray = new THREE.Raycaster(); private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private shared: { rim: THREE.CylinderGeometry; face: THREE.CircleGeometry; ring: THREE.RingGeometry; back: THREE.MeshStandardMaterial };

  constructor(private host: HTMLElement, public level: NinjaLevel, public opts: NinjaGameOptions, private audio: NinjaAudio, private cb: NinjaCallbacks = {}) {
    this.sim = new NinjaSim(level, { difficulty: opts.difficulty, dwellMs: opts.dwellMs, slowLook: opts.slowLook, seed: opts.seed, demo: opts.demo });
    const q = opts.quality, phone = (Math.min(window.innerWidth, window.innerHeight) < 600 || touchOnly() /* tablets too: the full-screen glow pass is too heavy for them */), L = level.look;
    this.renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "high" ? 2 : q === "medium" ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = q !== "low"; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
    host.appendChild(this.renderer.domElement);

    // lights & atmosphere
    this.scene.fog = new THREE.Fog(L.fog, 40, 140);
    this.scene.add(new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemi * 1.05));
    const sun = new THREE.DirectionalLight(L.sun, L.sunI); sun.position.set(-8, 14, 12); sun.castShadow = q !== "low"; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 20, bottom: -10, near: 1, far: 80 }); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(6, 4, -10); this.scene.add(rim);
    this.buildArena(q);

    // blade ribbon + tip
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3)); rg.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(TRAIL * 2), 1));
    const idx: number[] = []; for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } rg.setIndex(idx);
    this.ribbon = new THREE.Mesh(rg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { color: { value: new THREE.Color(L.night ? 0x7ff3ff : 0xffffff) } },
      vertexShader: "attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(mix(color, vec3(1.0), 0.5) * 1.6, vA); }" }));
    this.ribbon.frustumCulled = false; this.ribbon.renderOrder = 10; this.scene.add(this.ribbon);
    this.tip = glowSprite(L.night ? 0x7ff3ff : 0xfff6c0, 1.1, 0.0); (this.tip.material as THREE.SpriteMaterial).depthTest = false; this.tip.renderOrder = 11; this.scene.add(this.tip);

    const rimGeo = new THREE.CylinderGeometry(1, 1, 0.42, 48, 1, true); rimGeo.rotateX(Math.PI / 2);
    this.shared = { rim: rimGeo, face: new THREE.CircleGeometry(1, 48), ring: new THREE.RingGeometry(1.18, 1.36, 64, 1), back: new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.5 }) };
    this.fx = new Fx(this.scene, this.renderer.getPixelRatio());

    if (q === "high" || (q === "medium" && !phone)) {
      const size = new THREE.Vector2(); this.renderer.getDrawingBufferSize(size);
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q === "high" ? 4 : 0 });
      this.composer = new EffectComposer(this.renderer, rt); this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), L.night ? 0.65 : 0.35, 0.5, L.night ? 0.75 : 0.85)); this.composer.addPass(new OutputPass());
    }
    if (!opts.demo) { host.addEventListener("pointerdown", this.pd); window.addEventListener("pointermove", this.pm, { passive: true }); window.addEventListener("pointerup", this.pu); window.addEventListener("pointercancel", this.pu); }
    this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(host); this.resize();
    if (opts.music !== false) { this.audio.startMusic(L.music.root, L.music.tempo, L.music.mode, level.goal * 613 + level.name.length * 71); this.audio.setEnergy(0); }
    if (opts.demo) this.sim.start();
    if (import.meta.env.DEV && !opts.demo) (window as unknown as { __ninja?: unknown }).__ninja = { game: this, sim: this.sim };
    this.lastT = performance.now(); this.raf = requestAnimationFrame(this.frame);
  }

  start() { this.sim.start(); this.audio.setEnergy(1); }
  setPaused(p: boolean) { if (this.paused === p) return; this.paused = p; if (p) this.audio.stopMusic(); else { const m = this.level.look.music; if (this.opts.music !== false) { this.audio.startMusic(m.root, m.tempo, m.mode, this.level.goal * 613 + this.level.name.length * 71); this.audio.setEnergy(1); } this.lastT = performance.now(); } }
  isPaused() { return this.paused; }

  // ── the arena: sky, skyline, ground and themed props in a half-circle behind the play area ──
  private buildArena(q: Quality) {
    const L = this.level.look, rnd = seeded(this.level.goal * 31 + this.level.name.length);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(L.sky[0]) }, mid: { value: new THREE.Color(L.sky[1]) }, bot: { value: new THREE.Color(L.sky[2]) } },
      vertexShader: "varying vec3 vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vD = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vD; void main(){ float h = normalize(vD).y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.3, 0.0, 1.0), 0.7)) : mix(mid, bot, clamp(-h * 4.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}" }));
    sky.renderOrder = -3; this.scene.add(sky);
    if (L.stars) { const n = 500, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, y = 0.05 + rnd() * 0.9, k = Math.sqrt(1 - y * y); pos.set([Math.cos(a) * k * 380, y * 380, Math.sin(a) * k * 380], i * 3); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); const st = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })); this.scene.add(st); }
    if (L.sunDisc !== "none") { const s = glowSprite(L.sunDisc === "moon" ? 0xeef2ff : 0xfff3c4, 90, 0.7); (s.material as THREE.SpriteMaterial).fog = false; s.position.set(-120, 120, -260); this.scene.add(s); }
    const sk = skylineTexture(L); sk.wrapS = THREE.RepeatWrapping; sk.repeat.set(3, 1);
    const skyline = new THREE.Mesh(new THREE.CylinderGeometry(220, 220, 60, 64, 1, true), new THREE.MeshBasicMaterial({ map: sk, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, color: new THREE.Color(0xffffff).lerp(new THREE.Color(L.fog), 0.3) }));
    skyline.position.set(0, 22 + FLOOR, 0); skyline.renderOrder = -1; this.scene.add(skyline);
    const gt = groundTexture(L); gt.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(480, 480), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.y = FLOOR - 0.6; ground.receiveShadow = q !== "low"; this.scene.add(ground);
    const props = new THREE.Group();
    const n = q === "low" ? 12 : 26;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.04 + 0.92 * (i / (n - 1))) + (rnd() - 0.5) * 0.12; const r = (i % 2 ? 14 : 22) + rnd() * 10;
      const p = makeProp(L.props[Math.floor(rnd() * L.props.length)], L, rnd); p.position.set(Math.cos(a) * r, FLOOR - 0.6, -Math.sin(a) * r * 0.9 - 4); p.rotation.y = rnd() * Math.PI * 2; props.add(p);
    }
    props.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = q === "high"; });
    this.scene.add(bakeStatic(props));
    // a soft glowing floor line where tokens launch from
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.6), new THREE.MeshBasicMaterial({ color: L.night ? L.rail : 0xffffff, transparent: true, opacity: L.night ? 0.25 : 0.12, depthWrite: false, fog: false })); lip.position.set(0, FLOOR - 0.2, -0.5); this.scene.add(lip);
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.fov = this.camera.aspect < 0.8 ? 64 : 50; this.camera.updateProjectionMatrix();
    const halfH = CAM_Z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.sim.setBounds(halfH * this.camera.aspect - 0.4);
  }

  // ── input: pointer → play plane ──
  private toPlane(clientX: number, clientY: number) {
    const r = this.host.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, p) ? { x: p.x, y: p.y } : null;
  }
  private pd = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest?.("button,[data-ninja-ui]")) return;
    this.pointerType = e.pointerType; this.pressing = true; this.swipeId++;
    const p = this.toPlane(e.clientX, e.clientY); this.last = p; if (p) this.addTrail(p);
    try { this.host.setPointerCapture?.(e.pointerId); } catch { /* optional */ }
  };
  private pm = (e: PointerEvent) => {
    this.pointerType = e.pointerType;
    const p = this.toPlane(e.clientX, e.clientY); if (!p) return;
    const look = this.opts.steer === "look" && e.pointerType !== "touch";
    if (look) this.gaze = p;
    if (this.pressing || look) this.addTrail(p);
    if (this.pressing && this.last) { if (Math.hypot(p.x - this.last.x, p.y - this.last.y) > 0.05) this.swipes.push({ x0: this.last.x, y0: this.last.y, x1: p.x, y1: p.y }); if (Math.hypot(p.x - this.last.x, p.y - this.last.y) > 0.6) this.audio.play("swish"); }
    this.last = p;
  };
  private pu = () => { this.pressing = false; this.last = null; };
  private addTrail(p: { x: number; y: number }) { this.trail.push({ x: p.x, y: p.y, t: this.t }); if (this.trail.length > TRAIL) this.trail.shift(); }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.lastT) / 1000); this.lastT = now;
    if (!this.paused) {
      this.acc += dt; let n = 0;
      const inp: NinjaInput = { swipes: this.swipes, gaze: this.opts.steer === "look" && this.pointerType !== "touch" ? this.gaze : null, swipeId: this.swipeId };
      this.swipes = [];
      while (this.acc >= STEP && n < 10) { this.sim.step(STEP, n === 0 ? inp : { swipes: [], gaze: inp.gaze, swipeId: inp.swipeId }); if (this.sim.events.length) this.handle(this.sim.events); this.acc -= STEP; n++; }
      if (n >= 10) this.acc = 0;
      this.t += dt;
    }
    this.render(this.paused ? 0 : dt);
  };

  private handle(evs: NinjaEvent[]) {
    for (const e of evs) {
      if (!this.opts.demo || e.t === "slice") this.audio.play(e.t === "slice" && (e.combo || 1) > 1 ? "slice" : e.t, e.combo || e.n || 0);
      if (e.t === "slice" && (e.combo || 1) > 1 && !this.opts.demo) this.audio.play("combo", e.combo);
      const v = e.id != null ? this.views.get(e.id) : undefined;
      if ((e.t === "slice" || e.t === "wrong") && v) {
        this.split(v, e.angle ?? 0.6, e.t === "slice");
        if (this.opts.demo) { const a = e.angle ?? 0; for (let k = -6; k <= 6; k++) this.trail.push({ x: e.x + Math.cos(a) * k * 0.45, y: e.y + Math.sin(a) * k * 0.45, t: this.t - (6 - k) * 0.006 }); while (this.trail.length > TRAIL) this.trail.shift(); }
        this.removeView(e.id!, true);
      }
      if (e.t === "slice") { const col = this.level.juice; this.fx.burst(e.x, e.y, 0.3, { color: [col, 0xffffff, col], count: 40, speed: 6, life: 0.8, size: 0.3, gravity: 9, spreadZ: 2 }); this.splat(e.x, e.y, col); if ((e.combo || 1) > 1) this.fx.burst(e.x, e.y + 1, 0.5, { color: [0xffe14a, 0xffffff, 0xff7ad9], count: 30 * (e.combo || 1), speed: 7, life: 1, size: 0.3, gravity: 3, spreadZ: 3 }); }
      if (e.t === "wrong") { this.fx.burst(e.x, e.y, 0.3, { color: [0x9aa3b5, 0x5a6378, 0xffffff], count: 36, speed: 4, life: 0.9, size: 0.45, gravity: -1, spreadZ: 2 }); this.splat(e.x, e.y, 0x7a8294); this.shakeT = 0.35; }
      if (e.t === "clear" && v) { this.fx.burst(e.x, e.y, 0.3, { color: [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b, 0xffffff], count: 50, speed: 7, life: 1.2, size: 0.32, gravity: 4, spreadZ: 3 }); this.removeView(e.id!); }
      if (e.t === "win") { this.audio.stopMusic(); for (let i = 0; i < 6; i++) this.fx.burst((Math.random() - 0.5) * this.sim.halfW * 1.6, 2 + Math.random() * 6, 0, { color: [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b, 0xffffff], count: 70, speed: 8, life: 1.6, size: 0.34, gravity: 4, spreadZ: 4 }); }
      if (e.t === "fail") this.audio.stopMusic();
      if (!this.opts.demo) this.cb.onEvent?.(e);
    }
    this.hudT = 0;
  }

  private view(id: number) {
    const tok = this.sim.tokens.find(t => t.id === id)!;
    const g = new THREE.Group();
    // every token in a level shares one accent colour, so only the picture/word tells them apart
    const accent = this.level.juice;
    const rim = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.25, metalness: 0.35, emissive: accent, emissiveIntensity: 0.12, side: THREE.DoubleSide });
    const face = new THREE.MeshBasicMaterial({ map: tokenTexture(tok.thing, this.opts.cardStyle, accent), toneMapped: false });
    const disc = new THREE.Group(); disc.scale.setScalar(tok.r); g.add(disc);
    const rimM = new THREE.Mesh(this.shared.rim, rim); rimM.castShadow = this.opts.quality !== "low"; disc.add(rimM);
    const front = new THREE.Mesh(this.shared.face, face); front.position.z = 0.21; disc.add(front);
    const back = new THREE.Mesh(this.shared.face, this.shared.back); back.position.z = -0.21; back.rotation.y = Math.PI; disc.add(back);
    const gold = tok.target && (this.opts.glow || this.opts.demo);
    const halo = glowSprite(gold ? 0xffd84d : 0xffffff, tok.r * (gold ? 4.4 : 3.4), gold ? 0.7 : 0.35); halo.position.z = -0.3; g.add(halo);
    const ring = new THREE.Mesh(this.shared.ring.clone(), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false })); ring.scale.setScalar(tok.r); ring.position.z = 0.3; ring.renderOrder = 9; ring.visible = false; g.add(ring);
    this.scene.add(g);
    const v: View = { g, disc, halo, ring, rim, face }; this.views.set(id, v); return v;
  }
  private removeView(id: number, keepFace = false) { const v = this.views.get(id); if (!v) return; this.scene.remove(v.g); v.rim.dispose(); if (!keepFace) v.face.dispose(); v.ring.geometry.dispose(); (v.ring.material as THREE.Material).dispose(); (v.halo.material as THREE.Material).dispose(); this.views.delete(id); }

  /** Cut a token along the blade into two halves that fly apart (the picture stays upright on each half). */
  private split(v: View, angle: number, juicy: boolean) {
    const r = v.disc.scale.x, rot = v.g.rotation.z, a = angle - rot; // the cut follows the blade
    const flesh = new THREE.MeshStandardMaterial({ color: juicy ? new THREE.Color(this.level.juice).lerp(new THREE.Color(0xffffff), 0.35) : new THREE.Color(0x8a93a6), roughness: 0.45 });
    const face = juicy ? v.face : new THREE.MeshBasicMaterial({ map: v.face.map, color: 0x9aa0ad, toneMapped: false });
    for (const s of [0, 1]) {
      const g = new THREE.Group(); g.position.copy(v.g.position); g.rotation.z = rot;
      const sh = new THREE.Shape(); sh.absarc(0, 0, r, a + s * Math.PI, a + s * Math.PI + Math.PI, false); sh.closePath();
      const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.42 * r, bevelEnabled: false, curveSegments: 24 }), [flesh, flesh]); body.position.z = -0.21 * r; g.add(body);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.999, 32, a + s * Math.PI, Math.PI), face); cap.position.z = 0.215 * r; g.add(cap);
      const rimArc = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.06 * r, 6, 24, Math.PI), v.rim.clone()); rimArc.rotation.z = a + s * Math.PI; rimArc.position.z = 0.2 * r; g.add(rimArc);
      this.scene.add(g);
      const nx = Math.cos(angle + Math.PI / 2) * (s ? -1 : 1), ny = Math.sin(angle + Math.PI / 2) * (s ? -1 : 1);
      this.halves.push({ g, vx: nx * 3.2 + (Math.random() - 0.5), vy: ny * 3.2 + 2.5, vr: (s ? 1 : -1) * (2 + Math.random() * 3), t: 0 });
    }
  }
  private splat(x: number, y: number, color: number) {
    const tex = splatTextures()[Math.floor(Math.random() * 4)];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0.75, depthWrite: false, fog: false }));
    m.position.set(x, y, -1.2); m.rotation.z = Math.random() * Math.PI * 2; m.scale.setScalar(0.7 + Math.random() * 0.6); this.scene.add(m);
    this.splats.push({ m, t: 0 }); if (this.splats.length > 14) { const old = this.splats.shift()!; this.scene.remove(old.m); old.m.geometry.dispose(); (old.m.material as THREE.Material).dispose(); }
  }

  private render(dt: number) {
    const sim = this.sim, t = this.t;
    // camera with a little shake
    let sx = 0, sy = 0; if (this.shakeT > 0) { this.shakeT -= dt; sx = (Math.random() - 0.5) * this.shakeT * 0.8; sy = (Math.random() - 0.5) * this.shakeT * 0.8; }
    this.camera.position.set(sx + Math.sin(t * 0.3) * 0.15, CAM_Y + sy + Math.sin(t * 0.23) * 0.08, CAM_Z); this.camera.lookAt(0, CAM_Y, 0);

    // tokens
    for (const tok of sim.tokens) {
      if (tok.state !== "fly") continue;
      const v = this.views.get(tok.id) ?? this.view(tok.id);
      v.g.position.set(tok.x, tok.y, 0); v.g.rotation.z = tok.rot * 0.35; v.disc.rotation.y = Math.sin(t * 2 + tok.id) * 0.25;
      if (tok.target && (this.opts.glow || this.opts.demo)) v.halo.material.opacity = 0.5 + Math.sin(t * 6 + tok.id) * 0.2;
      const p = Math.min(1, tok.dwell / this.opts.dwellMs);
      v.ring.visible = tok.looked && p > 0.02;
      if (v.ring.visible) { (v.ring.geometry as THREE.BufferGeometry).setDrawRange(0, Math.max(6, Math.floor(p * 64) * 6)); v.g.scale.setScalar(1 + p * 0.12); } else v.g.scale.setScalar(1);
    }
    for (const id of [...this.views.keys()]) if (!sim.tokens.some(k => k.id === id && k.state === "fly")) this.removeView(id);

    // halves & splats
    for (const h of this.halves) { h.t += dt; h.vy -= 14 * dt; h.g.position.x += h.vx * dt; h.g.position.y += h.vy * dt; h.g.rotation.z += h.vr * dt; h.g.position.z += dt * 0.5; }
    this.halves = this.halves.filter(h => { if (h.t < 1.8 && h.g.position.y > FLOOR - 6) return true; this.scene.remove(h.g); h.g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mats = Array.isArray(m.material) ? m.material : [m.material]; for (const x of mats) if (x !== this.shared.back) x.dispose(); } }); return false; });
    for (const s of this.splats) { s.t += dt; const mat = s.m.material as THREE.MeshBasicMaterial; mat.opacity = Math.max(0, 0.75 - Math.max(0, s.t - 2) * 0.35); s.m.position.y -= dt * 0.12; }

    // blade ribbon (fades over 0.2s) and tip
    const life = 0.2, pos = this.ribbon.geometry.attributes.position as THREE.BufferAttribute, al = this.ribbon.geometry.attributes.alpha as THREE.BufferAttribute;
    const pts = this.trail.filter(p => t - p.t < life);
    for (let i = 0; i < TRAIL; i++) {
      const p = pts[Math.max(0, pts.length - TRAIL + i)] ?? null;
      if (!p || pts.length < 2) { pos.setXYZ(i * 2, 0, 0, 0); pos.setXYZ(i * 2 + 1, 0, 0, 0); al.setX(i * 2, 0); al.setX(i * 2 + 1, 0); continue; }
      const j = Math.max(1, pts.indexOf(p)), q = pts[j - 1]; const dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy) || 1;
      const k = 1 - (t - p.t) / life, w = 0.22 * k * (this.pressing || this.opts.demo ? 1 : 0.55);
      pos.setXYZ(i * 2, p.x - dy / l * w, p.y + dx / l * w, 0.6); pos.setXYZ(i * 2 + 1, p.x + dy / l * w, p.y - dx / l * w, 0.6);
      const a = k * (this.pressing || this.opts.demo ? 0.95 : 0.45); al.setX(i * 2, a); al.setX(i * 2 + 1, a);
    }
    pos.needsUpdate = true; al.needsUpdate = true;
    const lookPt = this.opts.steer === "look" && this.pointerType !== "touch" ? this.gaze : this.pressing ? this.last : null;
    (this.tip.material as THREE.SpriteMaterial).opacity += ((lookPt && sim.state === "play" ? 0.75 : 0) - (this.tip.material as THREE.SpriteMaterial).opacity) * Math.min(1, dt * 10);
    if (lookPt) this.tip.position.set(lookPt.x, lookPt.y, 0.7);

    this.fx.update(dt);
    if (!this.ended && (sim.state === "win" || sim.state === "fail") && sim.endT > (sim.state === "win" ? 2.2 : 1.4)) { this.ended = true; this.cb.onEnd?.(sim.result()); }
    this.hudT -= dt;
    if (this.hudT <= 0 && this.cb.onHud) { this.hudT = 0.1; this.cb.onHud({ caught: sim.caught, goal: sim.level.goal, hearts: sim.hearts, hasHearts: sim.cfg.hearts, score: sim.score, state: sim.state }); }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.resizeObs.disconnect();
    if (!this.opts.demo) { this.host.removeEventListener("pointerdown", this.pd); window.removeEventListener("pointermove", this.pm); window.removeEventListener("pointerup", this.pu); window.removeEventListener("pointercancel", this.pu); }
    if (this.opts.music !== false) this.audio.stopMusic();
    this.fx.dispose(); this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.Points).isPoints) m.geometry?.dispose(); });
    this.composer?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
    const w = window as unknown as { __ninja?: { game: unknown } }; if (import.meta.env.DEV && w.__ninja?.game === this) delete w.__ninja;
  }
}
