// Reading Runner — ties the simulation to the 3D scene, camera, characters, effects and sound.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CARD_Y, LANE_X, Sim, type Assists, type Difficulty, type RunResult, type SimEvent, type SimInput } from "@shared/runner/sim";
import type { Mission } from "@shared/runner/missions";
import { Fx } from "@/game/skybound/fx";
import { World, type Quality } from "./world";
import { RunnerAudio } from "./audio";
import type { RunnerInput, Steer } from "./input";
import type { CardStyle } from "./textures";
import { coinGeometry, coinMaterials, makeBarrier, makeCard, makeDog, makeFinishGate, makeHero, makePower, makeRamp, makeTrain, type DogRig, type HeroRig } from "./models";

export type GameOptions = { difficulty: Difficulty; assists: Assists; quality: Quality; cardStyle: CardStyle; steer: Steer; demo?: boolean; seed?: number; music?: boolean };
export type HudState = { caught: number; goal: number; coins: number; hearts: number; loseHearts: boolean; score: number; magnet: number; shield: number; state: Sim["state"]; lookingUp: boolean };
export type GameCallbacks = { onHud?: (h: HudState) => void; onEvent?: (e: SimEvent) => void; onEnd?: (r: RunResult) => void };

const STEP = 1 / 120;
const COIN_CAP = 360;
const ease = (k: number) => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

export class RunnerGame {
  sim: Sim; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000); renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null; private bloom: UnrealBloomPass | null = null;
  private world: World; private fx: Fx; private hero: HeroRig; private dog: DogRig;
  private sun: THREE.DirectionalLight; private heroLight: THREE.PointLight | null = null;
  private obViews = new Map<number, THREE.Group>(); private pool = new Map<string, THREE.Group[]>();
  private cardViews = new Map<number, THREE.Group>(); private powerViews = new Map<number, THREE.Group>();
  private coins: THREE.InstancedMesh; private ghosts: { m: THREE.Mesh; t: number; from: THREE.Vector3 }[] = [];
  private gate: THREE.Group | null = null;
  private raf = 0; private last = 0; private acc = 0; private t = 0; private paused = false; private disposed = false; private ended = false;
  private prev = { s: 0, x: 0, y: 0 }; private runPhase = 0; private lean = 0; private camY = 4.4; private shakeT = 0; private shakeA = 0; private introT = 0; private winCam = 0;
  private hudT = 0; private dogX = 0.75; private dogY = 0; private resizeObs: ResizeObserver; private phone: boolean;

  constructor(private host: HTMLElement, public mission: Mission, public opts: GameOptions, private audio: RunnerAudio, private input: RunnerInput | null, private cb: GameCallbacks = {}) {
    this.sim = new Sim(mission, { difficulty: opts.difficulty, assists: opts.demo ? { autoJump: true, autoDodge: true, guide: true } : opts.assists, seed: opts.seed, demo: opts.demo });
    const q = opts.quality; this.phone = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "high" ? 2 : q === "medium" ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = q !== "low"; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
    host.appendChild(this.renderer.domElement);

    const L = mission.look;
    this.world = new World(L, q, (opts.seed ?? 1) + mission.goal); this.scene.add(this.world.group);
    this.scene.fog = new THREE.Fog(L.fog, L.fogNear, L.fogFar);
    this.scene.add(new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemi));
    this.sun = new THREE.DirectionalLight(L.sun, L.sunI);
    this.sun.castShadow = q !== "low"; this.sun.shadow.mapSize.set(q === "high" ? 2048 : 1024, q === "high" ? 2048 : 1024);
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 34, bottom: -14, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    if (L.night) { this.heroLight = new THREE.PointLight(0xfff0d0, 9, 12, 1.6); this.scene.add(this.heroLight); }

    this.fx = new Fx(this.scene, this.renderer.getPixelRatio());
    this.hero = makeHero(); this.scene.add(this.hero.root);
    this.dog = makeDog(); this.scene.add(this.dog.root);
    for (const r of [this.hero.root, this.dog.root]) r.traverse(o => { if ((o as THREE.Mesh).isMesh && o !== this.hero.shield) (o as THREE.Mesh).castShadow = q !== "low"; });

    this.coins = new THREE.InstancedMesh(coinGeometry, coinMaterials(), COIN_CAP);
    this.coins.frustumCulled = false; this.coins.castShadow = q === "high"; this.coins.count = 0; this.scene.add(this.coins);
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(coinGeometry, coinMaterials()); m.visible = false; m.scale.setScalar(0.8); this.scene.add(m); this.ghosts.push({ m, t: 9, from: new THREE.Vector3() }); }

    if (q === "high" || (q === "medium" && !this.phone)) {
      const size = new THREE.Vector2(); this.renderer.getDrawingBufferSize(size);
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q === "high" ? 4 : 0 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), L.night ? 0.7 : 0.32, 0.55, L.night ? 0.72 : 0.86);
      this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    }

    this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(host); this.resize();
    if (opts.music !== false) { this.audio.startMusic(L.music.root, L.music.tempo, L.music.mode, mission.goal * 977 + L.name.length * 131); this.audio.setEnergy(opts.demo ? 0 : 0); }
    if (opts.demo) { this.sim.start(); this.introT = 1; }
    if (import.meta.env.DEV) (window as unknown as { __runner?: unknown }).__runner = { game: this, sim: this.sim };
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  start() { this.sim.start(); this.audio.setEnergy(1); }
  setPaused(p: boolean) {
    if (this.paused === p) return; this.paused = p;
    if (p) this.audio.stopMusic(); else { const m = this.mission.look.music; if (this.opts.music !== false) { this.audio.startMusic(m.root, m.tempo, m.mode, this.mission.goal * 977 + this.mission.look.name.length * 131); this.audio.setEnergy(this.sim.state === "finish" ? 2 : 1); } this.last = performance.now(); }
  }
  isPaused() { return this.paused; }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    // keep all three lanes in view on tall phone screens
    this.camera.fov = this.camera.aspect < 0.62 ? 76 : this.camera.aspect < 0.9 ? 68 : this.camera.aspect < 1.25 ? 62 : 56;
    this.camera.updateProjectionMatrix();
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (!this.paused) {
      this.acc += dt; let n = 0;
      const first: SimInput = this.input ? this.input.read() : { moves: [], jump: false, lane: null };
      while (this.acc >= STEP && n < 10) {
        this.prev = { s: this.sim.p.s, x: this.sim.p.x, y: this.sim.p.y };
        this.sim.step(STEP, n === 0 ? first : { moves: [], jump: false, lane: first.lane });
        if (this.sim.events.length) this.handle(this.sim.events);
        this.acc -= STEP; n++;
      }
      if (n >= 10) this.acc = 0;
      this.t += dt;
    }
    this.render(this.paused ? 0 : dt);
  };

  private shake(t: number, a: number) { this.shakeT = Math.max(this.shakeT, t); this.shakeA = Math.max(this.shakeA, a); }

  private handle(evs: SimEvent[]) {
    const fx = this.fx, a = this.audio;
    for (const e of evs) {
      const z = -e.s;
      if (!this.opts.demo) a.play(e.t, e.n || 0);
      switch (e.t) {
        case "coin":
          fx.burst(e.x, e.y, z, { color: [0xffe14a, 0xfff6c0], count: 6, speed: 2.4, life: 0.35, size: 0.18, gravity: 1, spreadZ: 1 });
          if (e.magnet) { const g = this.ghosts.find(q => q.t > 1) || this.ghosts[0]; g.t = 0; g.from.set(e.x, e.y, z); g.m.visible = true; }
          break;
        case "card": fx.burst(e.x, e.y + 0.3, z, { color: [0xffe14a, 0xffffff, 0x7dff6b, 0x4dd8ff, 0xff7ad9], count: 70, speed: 7, life: 1, size: 0.3, gravity: 3, spreadZ: 4 }); this.shake(0.12, 0.08); break;
        case "wrong": fx.burst(e.x, e.y, z, { color: [0xc8d0e0, 0x8a94a8], count: 22, speed: 3, life: 0.6, size: 0.3, gravity: 1, spreadZ: 1.5 }); break;
        case "jump": fx.burst(e.x, e.y + 0.1, z, { color: 0xf5efe0, count: 8, speed: 2.2, life: 0.4, size: 0.28, gravity: 1, spreadZ: 1 }); break;
        case "land": fx.burst(e.x, e.y + 0.05, z, { color: 0xf5efe0, count: 6, speed: 1.8, life: 0.35, size: 0.26, gravity: 0, spreadZ: 1 }); break;
        case "landHard": fx.burst(e.x, e.y + 0.05, z, { color: 0xf5efe0, count: 14, speed: 3.5, life: 0.45, size: 0.32, gravity: 0, spreadZ: 2 }); this.shake(0.12, 0.1); break;
        case "crash": this.shake(0.45, 0.35); fx.burst(e.x, e.y + 1, z, { color: [0xffffff, 0xffe14a, 0xff7a8a], count: 30, speed: 6, life: 0.6, size: 0.3, gravity: 4, spreadZ: 3 }); break;
        case "bump": this.shake(0.2, 0.15); fx.burst(e.x, e.y + 1, z, { color: 0xffffff, count: 10, speed: 3, life: 0.4, size: 0.25 }); break;
        case "smash": fx.bricks(LANE_X[e.lane ?? 1], 0.8, this.mission.look.barrier[0]); break;
        case "magnet": case "shield": fx.burst(e.x, e.y, z, { color: e.t === "magnet" ? [0xff4f6d, 0xffffff] : [0x7fe9ff, 0xffffff], count: 40, speed: 5, life: 0.7, size: 0.3, gravity: 0, spreadZ: 3 }); break;
        case "shieldPop": fx.burst(e.x, e.y + 1, z, { color: [0x7fe9ff, 0xffffff], count: 40, speed: 7, life: 0.6, size: 0.3, gravity: 0, spreadZ: 4 }); this.shake(0.2, 0.15); break;
        case "goal": this.audio.setEnergy(2); break;
        case "win": this.audio.stopMusic(); break;
        case "fail": this.audio.stopMusic(); break;
      }
      if (!this.opts.demo) this.cb.onEvent?.(e);
    }
    this.hudT = 0;
  }

  // ── views ──
  private take(key: string, make: () => THREE.Group) {
    const list = this.pool.get(key); const v = list?.pop();
    if (v) { v.visible = true; return v; }
    const g = make(); g.userData.poolKey = key;
    g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = this.opts.quality !== "low"; m.receiveShadow = m.receiveShadow || false; } });
    this.scene.add(g); return g;
  }
  private give(v: THREE.Group) { v.visible = false; const k = v.userData.poolKey as string; if (!this.pool.has(k)) this.pool.set(k, []); this.pool.get(k)!.push(v); }

  private syncViews(ps: number, dt: number) {
    const sim = this.sim, L = this.mission.look, t = this.t;
    // obstacles
    const live = new Set<number>();
    for (const o of sim.obstacles) {
      live.add(o.id);
      let v = this.obViews.get(o.id);
      if (!v) {
        v = o.k === "train" ? this.take("train" + o.cars, () => makeTrain(L, o.cars)) : o.k === "ramp" ? this.take("ramp", () => makeRamp(L)) : this.take("barrier", () => makeBarrier(L));
        v.userData.hitT = 0; const b = v.userData.body as THREE.Group | undefined; if (b) { b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); }
        this.obViews.set(o.id, v);
      }
      v.position.set(LANE_X[o.lane], 0, o.k === "barrier" ? -(o.s0 + 0.25) : -o.s0);
      v.visible = o.s0 - ps < 170;
      if (o.k === "barrier") {
        (v.userData.lamp as THREE.Mesh).visible = Math.floor(t * 3 + o.id) % 2 === 0;
        if (o.hit) { v.userData.hitT += dt; const k = v.userData.hitT as number, b = v.userData.body as THREE.Group; b.position.set(Math.sin(o.id) * k * 3, k * 5 - k * k * 9, -k * 9); b.rotation.set(-k * 7, k * 2, k * 3); if (k > 1.2) v.visible = false; }
      }
    }
    for (const [id, v] of this.obViews) if (!live.has(id)) { this.give(v); this.obViews.delete(id); }

    // coins (instanced) + other pickups
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    let n = 0; const seen = new Set<number>();
    for (const c of sim.pickups) {
      if (c.k === "coin") {
        if (!c.alive || c.s - ps > 150 || n >= COIN_CAP) continue;
        e.set(0, t * 3.2 + c.s * 0.35, 0); q.setFromEuler(e);
        m4.compose(pos.set(LANE_X[c.lane], c.y + Math.sin(t * 4 + c.s) * 0.06, -c.s), q, s1); this.coins.setMatrixAt(n++, m4);
        continue;
      }
      seen.add(c.id);
      if (c.k === "card") {
        let v = this.cardViews.get(c.id);
        if (!v) { v = makeCard(c.card!, this.opts.cardStyle, c.card!.target && (this.opts.demo || this.sim.opts.assists.guide)); v.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = this.opts.quality === "high"; }); v.userData.dieT = 0; this.scene.add(v); this.cardViews.set(c.id, v); }
        const inner = v.userData.inner as THREE.Group, halo = v.userData.halo as THREE.Sprite, shadow = v.userData.shadow as THREE.Mesh;
        const by = CARD_Y + 0.62;
        v.position.set(LANE_X[c.lane], by, -c.s); shadow.position.y = -by + 0.06;
        v.visible = c.s - ps < 150;
        if (c.alive) {
          inner.position.y = Math.sin(t * 2.4 + c.id) * 0.1; inner.rotation.y = Math.sin(t * 1.3 + c.id) * 0.22; inner.scale.setScalar(1);
          if (v.userData.target) { halo.material.opacity = 0.55 + Math.sin(t * 6) * 0.25; halo.scale.setScalar(4.1 + Math.sin(t * 6) * 0.3); }
        } else {
          v.userData.dieT += dt; const k = v.userData.dieT as number;
          const won = c.card!.target && sim.caught > 0 && Math.abs(c.s - ps) < 3;
          inner.position.y += dt * (won ? 6 : 1.5); inner.rotation.y *= 0.8; inner.rotation.z = won ? Math.sin(k * 30) * 0.12 : 0;
          inner.scale.setScalar(Math.max(0.01, won ? 1 + k * 0.9 : 1 - k * 2.5));
          (v.userData.face as THREE.MeshBasicMaterial).opacity = (v.userData.edge as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - k * 2.2);
          halo.material.opacity = Math.max(0, 0.6 - k * 2); (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.22 - k);
          if (k > 0.55) v.visible = false;
        }
      } else {
        let v = this.powerViews.get(c.id);
        if (!v) { v = makePower(c.k as "magnet" | "shield"); this.scene.add(v); this.powerViews.set(c.id, v); }
        v.visible = c.alive && c.s - ps < 150; v.position.set(LANE_X[c.lane], c.y + 0.2 + Math.sin(t * 3) * 0.15, -c.s); (v.userData.inner as THREE.Group).rotation.y = t * 2.5;
      }
    }
    this.coins.count = n; this.coins.instanceMatrix.needsUpdate = true;
    for (const [id, v] of this.cardViews) if (!seen.has(id)) { this.scene.remove(v); v.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); for (const mm of Array.isArray(m.material) ? m.material : [m.material]) mm.dispose(); } }); this.cardViews.delete(id); }
    for (const [id, v] of this.powerViews) if (!seen.has(id)) { this.scene.remove(v); this.powerViews.delete(id); }

    // magnet ghosts fly into Riley
    const target = this.hero.root.position;
    for (const g of this.ghosts) { if (g.t > 1) continue; g.t += dt / 0.22; const k = Math.min(1, g.t); g.m.position.lerpVectors(g.from, new THREE.Vector3(target.x, target.y + 1.2, target.z), k * k); g.m.rotation.y += dt * 20; if (k >= 1) { g.m.visible = false; g.t = 9; } }

    // finish gate
    if (Number.isFinite(sim.finishS) && !this.gate) { this.gate = makeFinishGate(); this.gate.position.set(0, 0, -sim.finishS); this.scene.add(this.gate); }
  }

  private animateHero(px: number, py: number, ps: number, dt: number) {
    const h = this.hero, p = this.sim.p, t = this.t, st = this.sim.state;
    h.root.position.set(px, py, -ps);
    const speed = p.speed;
    // lean into lane changes
    const targetLean = (LANE_X[p.lane] - px) * -0.16;
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 12);
    h.root.rotation.z = this.lean; h.body.rotation.y = Math.PI - this.lean * 0.8;
    let thL = 0, thR = 0, knL = 0.15, knR = 0.15, shL = 0, shR = 0, elL = -1.1, elR = -1.1, bob = 0, tilt = 0.08, armOut = 0.12;
    const rising = !p.grounded && p.vy > 0;
    if (st === "ready") {
      const b = Math.sin(t * 2.4); bob = b * 0.015; shL = 0.05; shR = -0.05; elL = elR = -0.35; tilt = 0; armOut = 0.15 + b * 0.02;
      h.head.rotation.y = Math.sin(t * 0.9) * 0.35;
    } else if (st === "win") {
      const k = Math.min(1, this.sim.winT * 1.4);
      h.body.rotation.y = Math.PI * (1 - ease(k)) + (k >= 1 ? Math.sin(t * 3) * 0.08 : 0);
      const hop = k >= 1 ? Math.abs(Math.sin(t * 6)) : 0; bob = hop * 0.35;
      shL = shR = -2.9 + Math.sin(t * 12) * 0.25; elL = elR = -0.2; armOut = 0.5; thL = thR = -hop * 0.4; knL = knR = hop * 0.8; tilt = -0.05;
    } else if (st === "fail") {
      tilt = -0.25; bob = -0.25; thL = thR = -1.4; knL = knR = 1.6; shL = shR = 0.4; elL = elR = -0.6; h.head.rotation.z = Math.sin(t * 4) * 0.3;
    } else if (p.grounded) {
      this.runPhase += dt * (3.2 + speed * 0.62);
      const s = Math.sin(this.runPhase), c = Math.cos(this.runPhase);
      thL = s * 0.95; thR = -s * 0.95; knL = 0.25 + Math.max(0, -c) * 1.35; knR = 0.25 + Math.max(0, c) * 1.35;
      shL = s * 0.85; shR = -s * 0.85; elL = elR = -1.35; bob = Math.abs(c) * 0.09; tilt = 0.22;
      h.head.rotation.y *= 0.9;
    } else {
      thL = rising ? -1.0 : -0.5; thR = rising ? 0.3 : -0.2; knL = 1.5; knR = rising ? 1.2 : 0.6;
      shL = rising ? -2.6 : -1.2; shR = rising ? -2.2 : -0.9; elL = elR = -0.5; armOut = 0.45; tilt = rising ? 0.05 : 0.18;
    }
    // stumble wobble & landing squash
    if (p.stumbleT > 0 && st !== "fail") { tilt += Math.sin(t * 24) * 0.18 * p.stumbleT; h.root.rotation.z += Math.sin(t * 19) * 0.12 * p.stumbleT; }
    const k = Math.min(1, dt * 18);
    const lerp = (o: THREE.Object3D, ax: "x" | "z", v: number) => { o.rotation[ax] += (v - o.rotation[ax]) * k; };
    lerp(h.legL.root, "x", -thL); lerp(h.legR.root, "x", -thR); lerp(h.legL.joint, "x", knL); lerp(h.legR.joint, "x", knR);
    lerp(h.armL.root, "x", shL); lerp(h.armR.root, "x", shR); lerp(h.armL.joint, "x", elL); lerp(h.armR.joint, "x", elR);
    lerp(h.armL.root, "z", -armOut); lerp(h.armR.root, "z", armOut);
    h.torso.rotation.x += (tilt - h.torso.rotation.x) * k;
    h.body.position.y = bob;
    let sy = 1; if (p.landT > 0) sy = 1 - p.landT * 1.3; else if (!p.grounded) sy = 1 + THREE.MathUtils.clamp(p.vy * 0.01, -0.06, 0.1);
    const sxz = 1 / Math.sqrt(Math.max(0.6, sy)); h.body.scale.set(sxz, sy, sxz);
    h.pack.rotation.x = Math.sin(this.runPhase * 2) * 0.06 + (rising ? -0.2 : 0);
    // power looks
    h.shield.visible = p.shieldT > 0 && (p.shieldT > 2.5 || Math.floor(t * 8) % 2 === 0);
    if (h.shield.visible) { h.shield.rotation.y = t; h.shield.scale.setScalar(1 + Math.sin(t * 5) * 0.03); }
    h.magnet.visible = p.magnetT > 0 && (p.magnetT > 2 || Math.floor(t * 8) % 2 === 0);
    if (h.magnet.visible) { h.magnet.position.y = 2.3 + Math.sin(t * 5) * 0.08; h.magnet.rotation.y = t * 3; }
    h.root.visible = !(p.invulT > 0 && st !== "fail" && Math.floor(t * 14) % 2 === 0);

    // Buddy the puppy runs alongside, on Riley's right
    const d = this.dog;
    this.dogX += (px + 0.78 - this.dogX) * Math.min(1, dt * 6);
    this.dogY += (py - this.dogY) * Math.min(1, dt * (py > this.dogY ? 7 : 10));
    const hop = st === "win" ? Math.abs(Math.sin(t * 7)) * 0.4 : 0;
    d.root.position.set(this.dogX, this.dogY + hop, -ps + 0.2);
    const ph = this.runPhase * 1.15, run = st === "run" || st === "finish";
    d.legs.forEach((l, i) => { l.rotation.x = run ? Math.sin(ph + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.4) * 0.9 : 0; });
    d.body.position.y = run ? Math.abs(Math.sin(ph)) * 0.07 : 0;
    d.body.rotation.x = run ? Math.sin(ph) * 0.06 : 0;
    d.tail.rotation.y = Math.sin(t * (run ? 18 : 10)) * 0.6;
    d.ears.forEach((ear, i) => { ear.rotation.x = run ? -0.4 + Math.sin(ph + i) * 0.15 : 0; });
    d.root.rotation.y = st === "win" ? THREE.MathUtils.lerp(d.root.rotation.y, 0, Math.min(1, dt * 3)) : Math.PI;
  }

  private render(dt: number) {
    const sim = this.sim, p = sim.p, t = this.t;
    const a = this.acc / STEP;
    const ps = this.prev.s + (p.s - this.prev.s) * a, px = this.prev.x + (p.x - this.prev.x) * a, py = this.prev.y + (p.y - this.prev.y) * a;
    this.animateHero(px, py, ps, dt);
    if (this.heroLight) this.heroLight.position.set(px, py + 2.6, -ps + 1.5);

    // camera: a sweeping intro, then a chase cam that eases up onto train roofs
    this.introT = Math.min(1, this.introT + dt / 2.6);
    const tall = this.camera.aspect < 0.9;
    this.camY += ((tall ? 5.0 : 4.3) + py * 0.6 - this.camY) * Math.min(1, dt * 4);
    const run = new THREE.Vector3(px * 0.62, this.camY, -ps + (tall ? 8.6 : 7.8));
    const runLook = new THREE.Vector3(px * 0.35, 1.4 + py * 0.55, -ps - 13);
    const k = ease(this.introT);
    const intro = new THREE.Vector3(px - 3.2, 2.0, -ps - 5.5), introLook = new THREE.Vector3(px, 1.2, -ps);
    const pos = intro.lerp(run, k), look = introLook.lerp(runLook, k);
    if (sim.state === "win") {
      this.winCam = Math.min(1, this.winCam + dt / 1.6); const w = ease(this.winCam);
      pos.lerp(new THREE.Vector3(px + 1.8, py + 2.7, -ps - 6.6), w); look.lerp(new THREE.Vector3(px, py + 1.2, -ps), w);
    }
    if (this.shakeT > 0) { this.shakeT -= dt; const s = this.shakeA * Math.max(0, this.shakeT) * 3; pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; if (this.shakeT <= 0) this.shakeA = 0; }
    this.camera.position.copy(pos); this.camera.lookAt(look);
    const baseFov = this.camera.aspect < 0.62 ? 76 : this.camera.aspect < 0.9 ? 68 : this.camera.aspect < 1.25 ? 62 : 56;
    const fovT = baseFov + Math.min(6, Math.max(0, p.speed - 9) * 0.45);
    if (Math.abs(this.camera.fov - fovT) > 0.05) { this.camera.fov += (fovT - this.camera.fov) * Math.min(1, dt * 2); this.camera.updateProjectionMatrix(); }
    this.sun.position.set(px - 9, 24, -ps + 8); this.sun.target.position.set(px, 0, -ps - 12);

    // world, views and weather
    const showGlow = !this.opts.demo && (sim.state === "run" || sim.state === "finish");
    this.world.setLaneGlow(p.lane, this.opts.steer === "look" ? this.input?.pendingLane() ?? this.input?.gazeLane ?? null : null, showGlow);
    this.world.update(ps, this.camera, t, dt);
    this.syncViews(ps, dt);
    if (this.gate) { const g = this.gate; g.children.forEach((c, i) => { if ((c as THREE.Mesh).geometry?.type === "SphereGeometry") c.position.y = 7.8 + Math.sin(t * 2 + i) * 0.25; }); }
    this.world.ambient(this.fx, ps, dt);
    if (p.magnetT > 0 && Math.random() < 0.5) this.fx.one(px + (Math.random() - 0.5) * 2, py + 1 + Math.random(), -ps - 2 - Math.random() * 6, 0, 0.3, 0xff7a8a, 0.4, 0.15);
    if (sim.state === "win" && dt > 0 && Math.random() < 0.7) this.fx.burst(px + (Math.random() - 0.5) * 8, py + 4 + Math.random() * 3, -ps - 3 - Math.random() * 4, { color: [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b, 0xffffff], count: 8, speed: 5, life: 1.2, size: 0.3, gravity: 4, spreadZ: 3 });
    if (p.grounded && p.speed > 13 && Math.random() < 0.3 && sim.state === "run") this.fx.one(px + (Math.random() - 0.5) * 0.6, py + 0.1, -ps + 0.6, 0, 0.6, 0xf5efe0, 0.35, 0.2);
    this.fx.update(dt);

    // end of run
    if (!this.ended && ((sim.state === "win" && sim.winT > 3.0) || (sim.state === "fail" && sim.failT > 1.8))) { this.ended = true; this.cb.onEnd?.(sim.result()); }

    // HUD
    this.hudT -= dt;
    if (this.hudT <= 0 && this.cb.onHud) {
      this.hudT = 0.1;
      this.cb.onHud({ caught: sim.caught, goal: sim.mission.goal, coins: sim.coins, hearts: p.hearts, loseHearts: sim.cfg.loseHearts, score: sim.score(), magnet: p.magnetT, shield: p.shieldT, state: sim.state, lookingUp: !!this.input?.lookingUp });
    }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.resizeObs.disconnect();
    if (this.opts.music !== false) this.audio.stopMusic();
    this.world.dispose(); this.fx.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry !== coinGeometry) m.geometry?.dispose(); });
    this.composer?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
    const w = window as unknown as { __runner?: { game: unknown } };
    if (import.meta.env.DEV && w.__runner?.game === this) delete w.__runner;
  }
}
