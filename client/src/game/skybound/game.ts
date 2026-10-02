// Skybound Sprint — ties the simulation to the 3D scene, camera, effects and sound.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { Sim, PLAYER_SIZE, type LevelDef, type SimEvent } from "@shared/skybound/sim";
import { World } from "./world";
import { Fx } from "./fx";
import { SkyAudio } from "./audio";
import { SkyInput } from "./input";
import { gemGeometry, makeBoss, makeBuzzer, makeCheckpoint, makeGoal, makeHero, makeItem, makeMover, makePuff, makeShard, makeSign, makeSpiky, makeSpring, type HeroRig } from "./models";

export type Quality = "low" | "medium" | "high";
export type HudState = { hearts: number; gems: number; gemsTotal: number; shards: number; time: number; power: number; star: number; bossHp: number | null; retries: number };
export type RunResult = ReturnType<Sim["result"]>;
export type GameCallbacks = { onHud: (h: HudState) => void; onWin: (r: RunResult) => void; onToast?: (text: string) => void };

const STEP = 1 / 120;
const GEM_COLORS = [0x4dfff0, 0x7dff6b, 0xff6bd5, 0xffd84d];

export class SkyGame {
  sim: Sim; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900); renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private world: World; private fx: Fx; private hero: HeroRig;
  private gemMesh: THREE.InstancedMesh; private shardViews: THREE.Group[] = [];
  private enemyViews = new Map<number, THREE.Group>(); private itemViews = new Map<number, THREE.Group>();
  private checkViews: THREE.Group[] = []; private goalView: THREE.Group | null = null; private springViews: THREE.Group[] = []; private moverViews: THREE.Group[] = [];
  private bossView: THREE.Group | null = null; private slamRing: THREE.Mesh | null = null; private boltViews: { warn: THREE.Mesh; beam: THREE.Mesh; light: THREE.PointLight }[] = [];
  private popGems: { m: THREE.Mesh; t: number }[] = [];
  private sun: THREE.DirectionalLight; private heroLight: THREE.PointLight | null = null;
  private raf = 0; private last = 0; private acc = 0; private t = 0; private paused = false; private disposed = false;
  private camX = 0; private camY = 0; private baseY = 0; private look = 0; private shakeT = 0; private shakeA = 0;
  private hudT = 0; private winT = -1; private runPhase = 0; private prevX = 0; private prevY = 0; private flashT = 0;
  private resizeObs: ResizeObserver;
  private starOn = false;

  constructor(private host: HTMLElement, public level: LevelDef, private quality: Quality, private audio: SkyAudio, private input: SkyInput, private cb: GameCallbacks) {
    this.sim = new Sim(level);
    const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "high" ? 2 : quality === "medium" ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== "low"; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
    host.appendChild(this.renderer.domElement);

    this.world = new World(level, quality); this.scene.add(this.world.group);
    const th = this.world.theme;
    this.scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    this.scene.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiIntensity));
    this.sun = new THREE.DirectionalLight(th.sun, th.sunIntensity);
    this.sun.castShadow = quality !== "low"; this.sun.shadow.mapSize.set(quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 14, bottom: -10, near: 1, far: 70 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    if (th.night) { this.heroLight = new THREE.PointLight(0xfff0d0, 7, 10, 1.6); this.scene.add(this.heroLight); }

    this.fx = new Fx(this.scene, this.renderer.getPixelRatio());
    this.hero = makeHero(); this.scene.add(this.hero.root);
    this.hero.root.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });

    // collectibles & props
    const gemCap = this.sim.gemList.length + 20;
    this.gemMesh = new THREE.InstancedMesh(gemGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1, emissive: 0x2a6f8a, emissiveIntensity: 0.6 }), gemCap);
    this.gemMesh.frustumCulled = false; this.gemMesh.castShadow = quality === "high";
    for (let i = 0; i < gemCap; i++) this.gemMesh.setColorAt(i, new THREE.Color(GEM_COLORS[i % GEM_COLORS.length]));
    this.scene.add(this.gemMesh);
    for (const s of this.sim.shardList) { const v = makeShard(); v.position.set(s.x, s.y, 0); this.scene.add(v); this.shardViews.push(v); }
    for (const c of this.sim.checks) { const v = makeCheckpoint(); v.position.set(c.x, c.y, 0); this.scene.add(v); this.checkViews.push(v); }
    for (const s of this.sim.springs) { const v = makeSpring(); v.position.set(s.x, s.y, 0); this.scene.add(v); this.springViews.push(v); }
    for (const m of this.sim.movers) { const v = makeMover(m.w, level.theme); this.scene.add(v); this.moverViews.push(v); }
    for (const u of this.sim.updrafts) this.world.addUpdraft(u.x, u.y, u.w, u.h);
    for (const e of level.ents) if (e.k === "sign") { const v = makeSign(e.text); v.position.set(e.x, e.y, 0); this.scene.add(v); }
    if (this.sim.goal) { this.goalView = makeGoal(); this.goalView.position.set(this.sim.goal.x, this.sim.goal.y, 0); this.scene.add(this.goalView); }
    if (this.sim.boss) {
      this.bossView = makeBoss(); this.scene.add(this.bossView);
      this.slamRing = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.5, 40), new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
      this.slamRing.rotation.x = -Math.PI / 2; this.slamRing.visible = false; this.scene.add(this.slamRing);
    }
    for (let i = 0; i < 4; i++) {
      const warn = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      warn.rotation.x = -Math.PI / 2; warn.visible = false; this.scene.add(warn);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 16, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6a0, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.visible = false; this.scene.add(beam);
      const light = new THREE.PointLight(0xfff6a0, 0, 14, 1.5); this.scene.add(light);
      this.boltViews.push({ warn, beam, light });
    }
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(gemGeometry, new THREE.MeshStandardMaterial({ color: 0x4dfff0, emissive: 0x2aa6c9, emissiveIntensity: 0.8 })); m.visible = false; this.scene.add(m); this.popGems.push({ m, t: 9 }); }

    if (quality === "high" || (quality === "medium" && !phone)) {
      const size = new THREE.Vector2(); this.renderer.getDrawingBufferSize(size);
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: quality === "high" ? 4 : 0 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0,0.0,0.0,1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 32.0), clamp(c.a, 0.0, 1.0)); }",
      }));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), th.night ? 0.55 : 0.35, 0.5, 0.82));
      this.composer.addPass(new OutputPass());
    }

    const p = this.sim.p;
    this.camX = p.x + 4; this.camY = p.y + 2.5; this.baseY = p.y; this.prevX = p.x; this.prevY = p.y;
    this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(host); this.resize();
    this.audio.startMusic(th.music.root, th.music.tempo, th.music.mode, level.id.length * 1013 + level.w);
    if (import.meta.env.DEV) (window as any).__sky = { game: this, sim: this.sim };
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  private camDistance() {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    if (this.level.boss) return Math.max(18, (38 / this.camera.aspect) / (2 * tan), 22 / (2 * tan));
    const minWide = 18; // always show at least this many tiles across
    return THREE.MathUtils.clamp(Math.max(19.5, (minWide / this.camera.aspect) / (2 * tan)), 19.5, 44);
  }

  setPaused(p: boolean) {
    if (this.paused === p) return; this.paused = p;
    if (p) this.audio.stopMusic(); else { const m = this.world.theme.music; this.audio.startMusic(m.root, m.tempo, m.mode, this.level.id.length * 1013 + this.level.w); this.last = performance.now(); }
  }
  isPaused() { return this.paused; }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      const inp = this.input.read();
      while (this.acc >= STEP && n < 8) {
        this.prevX = this.sim.p.x; this.prevY = this.sim.p.y;
        this.sim.step(STEP, inp);
        if (this.sim.events.length) this.handleEvents(this.sim.events);
        this.acc -= STEP; n++;
      }
      if (n >= 8) this.acc = 0;
      this.t += dt;
    }
    this.render(this.paused ? 0 : dt);
  };

  private handleEvents(evs: SimEvent[]) {
    const fx = this.fx, a = this.audio;
    for (const e of evs) {
      a.play(e.t, e.n || 0);
      switch (e.t) {
        case "jump": case "walljump": fx.burst(e.x, e.y + 0.1, 0, { color: 0xf5efe0, count: 8, speed: 2.5, life: 0.4, size: 0.3, gravity: 1 }); break;
        case "flutter": fx.burst(e.x, e.y + 0.5, 0, { color: [0xffe38a, 0xffffff], count: 14, speed: 3, life: 0.5, size: 0.22, gravity: 2 }); break;
        case "land": fx.burst(e.x, e.y + 0.05, 0, { color: 0xf5efe0, count: 6, speed: 2, life: 0.35, size: 0.28, gravity: 0 }); break;
        case "landHard": fx.burst(e.x, e.y + 0.05, 0, { color: 0xf5efe0, count: 14, speed: 4, life: 0.45, size: 0.35, gravity: 0 }); this.shake(0.12, 0.12); break;
        case "gem": fx.burst(e.x, e.y, 0, { color: GEM_COLORS, count: 10, speed: 3.5, life: 0.45, size: 0.2, gravity: 2 }); break;
        case "gemPop": this.popGem(e.x, e.y); break;
        case "shard": fx.burst(e.x, e.y, 0, { color: [0xffe14a, 0xffffff, 0xffb000], count: 60, speed: 7, life: 1, size: 0.35, gravity: 2 }); this.cb.onToast?.("⭐ Star Shard!"); this.flashT = 0.25; break;
        case "stomp": case "kick": fx.burst(e.x, e.y, 0, { color: [0xffffff, 0xffe14a], count: 16, speed: 5, life: 0.5, size: 0.3, gravity: 3 }); break;
        case "break": fx.bricks(e.x, e.y, 0xe07f42); fx.burst(e.x, e.y, 0, { color: 0xc96a35, count: 10, speed: 4, life: 0.5, size: 0.25, gravity: 8 }); break;
        case "crumble": fx.bricks(e.x, e.y, 0xc2a27a); break;
        case "sprout": fx.burst(e.x, e.y + 0.5, 0, { color: [0xffffff, 0xffe14a], count: 18, speed: 3, life: 0.6, size: 0.25, gravity: 0 }); break;
        case "powerUp": fx.burst(e.x, e.y, 0, { color: [0xffe14a, 0xfff6c0], count: 40, speed: 6, life: 0.8, size: 0.3, gravity: 0 }); this.cb.onToast?.("🪶 Sky Feather! Double-jump unlocked"); break;
        case "star": fx.burst(e.x, e.y, 0, { color: [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b], count: 50, speed: 7, life: 0.9, size: 0.3, gravity: 0 }); this.cb.onToast?.("🌟 Super Star!"); break;
        case "powerDown": fx.burst(e.x, e.y + 1, 0, { color: 0xffe14a, count: 20, speed: 4, life: 0.6, size: 0.25, gravity: 4 }); break;
        case "hurt": this.shake(0.25, 0.25); fx.burst(e.x, e.y + 0.8, 0, { color: 0xff4d6d, count: 14, speed: 4, life: 0.5, size: 0.28, gravity: 4 }); break;
        case "pound": this.shake(0.22, 0.3); fx.burst(e.x, e.y + 0.1, 0, { color: 0xf5efe0, count: 26, speed: 7, life: 0.5, size: 0.4, gravity: 0, spreadZ: 1 }); break;
        case "spring": case "bounce": fx.burst(e.x, e.y, 0, { color: [0xffffff, 0xff8fd0], count: 12, speed: 3.5, life: 0.4, size: 0.25 }); break;
        case "check": fx.burst(e.x + 0.4, e.y + 0.8, -0.4, { color: [0xffb02e, 0xffe14a], count: 30, speed: 5, life: 0.8, size: 0.3, gravity: 1 }); this.cb.onToast?.("🏮 Checkpoint!"); break;
        case "heartUp": fx.burst(e.x, e.y, 0, { color: 0xff4d6d, count: 20, speed: 4, life: 0.7, size: 0.3, gravity: -1 }); this.cb.onToast?.("❤️ Extra heart!"); break;
        case "fall": this.cb.onToast?.("Whoops! Back to the checkpoint"); break;
        case "faint": this.cb.onToast?.("Out of hearts — try again from the checkpoint!"); break;
        case "win": this.winT = 0; this.audio.stopMusic(); fx.burst(e.x, e.y + 2.4, 0, { color: [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b, 0xffffff], count: 140, speed: 10, life: 1.6, size: 0.35, gravity: 3 }); break;
        case "bossSlam": this.shake(0.4, 0.5); fx.burst(e.x, e.y, 0, { color: 0xc0b8ff, count: 40, speed: 9, life: 0.6, size: 0.45, gravity: 0 }); break;
        case "bolt": this.shake(0.15, 0.25); fx.burst(e.x, e.y, 0, { color: [0xfff6a0, 0xffffff], count: 24, speed: 6, life: 0.4, size: 0.3, gravity: 4 }); break;
        case "bossHit": this.shake(0.3, 0.35); fx.burst(e.x, e.y, 0, { color: [0xffe14a, 0xffffff], count: 40, speed: 8, life: 0.7, size: 0.35, gravity: 2 }); this.cb.onToast?.(`💥 Hit! ${e.n} to go`); break;
        case "bossDefeat": this.shake(0.6, 0.6); this.cb.onToast?.("🏆 The Storm King is defeated!"); break;
        case "bossGone": fx.burst(e.x, e.y + 1, 0, { color: [0xffe14a, 0x4dd8ff, 0xff4dd8], count: 120, speed: 10, life: 1.4, size: 0.4, gravity: 2 }); this.goalView = makeGoal(); this.goalView.position.set(this.sim.goal!.x, this.sim.goal!.y, 0); this.scene.add(this.goalView); this.rebuildGemCapacity(); break;
        case "respawn": fx.burst(e.x, e.y + 0.8, 0, { color: 0xffffff, count: 24, speed: 4, life: 0.6, size: 0.3, gravity: -1 }); break;
      }
    }
    this.hudT = 0;
  }

  private rebuildGemCapacity() { /* gem capacity reserves 20 extra slots for the boss reward */ }
  private popGem(x: number, y: number) {
    const slot = this.popGems.find(p => p.t > 0.6) || this.popGems[0];
    slot.t = 0; slot.m.position.set(x, y, 0); slot.m.visible = true;
    this.fx.burst(x, y + 0.8, 0, { color: GEM_COLORS, count: 8, speed: 3, life: 0.4, size: 0.2, gravity: 1 });
  }
  private shake(time: number, amp: number) { this.shakeT = Math.max(this.shakeT, time); this.shakeA = Math.max(this.shakeA, amp); }

  private render(dt: number) {
    const sim = this.sim, p = sim.p, t = this.t;
    const alpha = this.acc / STEP;
    const px = this.prevX + (p.x - this.prevX) * alpha, py = this.prevY + (p.y - this.prevY) * alpha;
    this.animateHero(px, py, dt);
    if (this.heroLight) this.heroLight.position.set(px, py + 2.2, 2.5);

    // camera
    const L = this.level;
    const dist = this.camDistance();
    const halfW = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    if (L.boss) { this.camX = L.w / 2; this.camY = 9.5; }
    else {
      this.look += ((p.face * 2.6 + p.vx * 0.15) - this.look) * Math.min(1, dt * 2.2);
      const tx = THREE.MathUtils.clamp(px + this.look, halfW - 0.5, L.w - halfW + 0.5);
      this.camX += (tx - this.camX) * Math.min(1, dt * 5);
      if (p.grounded || p.wallSliding) this.baseY = p.y;
      let ty = this.baseY + 3.4;
      if (py > this.baseY + 4.5) ty = py - 1.1; if (py < this.baseY - 0.5) ty = py + 3.4;
      ty = Math.max(ty, Math.min(5.5, L.h / 2));
      this.camY += (ty - this.camY) * Math.min(1, dt * (py < this.baseY ? 6 : 3.5));
    }
    let sx = 0, sy = 0;
    if (this.shakeT > 0) { this.shakeT -= dt; const k = this.shakeA * Math.max(0, this.shakeT) * 4; sx = (Math.random() - 0.5) * k; sy = (Math.random() - 0.5) * k; if (this.shakeT <= 0) this.shakeA = 0; }
    this.camera.position.set(this.camX + sx, this.camY + 1.6 + sy, dist);
    this.camera.lookAt(this.camX + sx * 0.5, this.camY + sy * 0.5, 0);
    this.sun.position.set(px - 8, py + 18, 12); this.sun.target.position.set(px, py, 0);

    this.world.sync(sim, t); this.world.settle(sim); this.world.update(t, dt, this.camera);

    // gems
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), s0 = new THREE.Vector3(0, 0, 0), pos = new THREE.Vector3();
    const gl = sim.gemList;
    for (let i = 0; i < this.gemMesh.count; i++) {
      const g = gl[i];
      if (!g || !g.alive || Math.abs(g.x - this.camX) > halfW + 4) { m4.compose(pos.set(0, -999, 0), q.identity(), s0); }
      else { e.set(0, t * 2.4 + i, 0); q.setFromEuler(e); m4.compose(pos.set(g.x, g.y + Math.sin(t * 3 + i * 0.7) * 0.08, 0), q, s1); }
      this.gemMesh.setMatrixAt(i, m4);
    }
    this.gemMesh.instanceMatrix.needsUpdate = true;
    for (const pg of this.popGems) { if (pg.t > 0.6) { pg.m.visible = false; continue; } pg.t += dt; pg.m.position.y += dt * (6 - pg.t * 14); pg.m.rotation.y += dt * 14; }
    sim.shardList.forEach((s, i) => { const v = this.shardViews[i]; v.visible = s.alive; v.rotation.y = t * 1.6; v.position.y = s.y + Math.sin(t * 2 + i) * 0.15; (v.userData.halo as THREE.Mesh).rotation.z = t; });
    sim.checks.forEach((c, i) => {
      const v = this.checkViews[i]; const ud = v.userData;
      if (c.lit && !ud.lit) { ud.lit = true; (ud.flameMat as THREE.MeshStandardMaterial).color.setHex(0xffd27a); (ud.flameMat as THREE.MeshStandardMaterial).emissive.setHex(0xff8a1a); (ud.flameMat as THREE.MeshStandardMaterial).emissiveIntensity = 2.2; ((ud.flag as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(0xff4d5e); const l = new THREE.PointLight(0xffa040, 5, 7, 1.8); l.position.set(0.42, 1.8, 0); v.add(l); }
      (ud.flag as THREE.Mesh).rotation.y = Math.sin(t * 3 + i) * 0.25; (ud.lantern as THREE.Group).rotation.z = Math.sin(t * 2 + i) * 0.06;
    });
    sim.springs.forEach((s, i) => { const v = this.springViews[i]; const c = s.t > 0 ? 0.55 + (0.3 - s.t) * 1.5 : 1; (v.userData.coil as THREE.Group).scale.y = Math.min(1.3, c); (v.userData.pad as THREE.Mesh).position.y = 0.2 + 0.45 * Math.min(1.3, c); });
    sim.movers.forEach((m, i) => { const v = this.moverViews[i]; v.position.set(m.x, m.y, 0); for (const pr of v.userData.props as THREE.Object3D[]) pr.rotation.y = t * 18; });
    if (this.goalView) { (this.goalView.userData.portal as THREE.Mesh).rotation.z = -t * 1.5; (this.goalView.userData.ring as THREE.Mesh).rotation.z = Math.sin(t) * 0.05; if (Math.random() < 0.3) this.fx.one(this.goalView.position.x + (Math.random() - 0.5) * 3, this.goalView.position.y + 1 + Math.random() * 3, -0.2, 0, 0.8, 0x9ff3ff, 1.2, 0.18); }

    // enemies
    for (const en of sim.enemies) {
      let v = this.enemyViews.get(en.id);
      if (!v) { v = en.k === "puff" ? makePuff() : en.k === "spiky" ? makeSpiky() : makeBuzzer(); this.scene.add(v); this.enemyViews.set(en.id, v); }
      const far = Math.abs(en.x - this.camX) > halfW + 6;
      v.visible = !far && (en.alive || en.deadT < 0.9);
      if (!v.visible) continue;
      v.position.set(en.x, en.y, 0);
      v.rotation.y = en.dir > 0 ? 0.8 : -0.8;
      const body = v.userData.body as THREE.Group;
      if (en.alive) {
        body.scale.set(1, 1, 1); v.rotation.z = 0;
        if (en.k === "buzzer") { for (const w of v.userData.wings as THREE.Mesh[]) w.rotation.y = Math.sin(t * 40) * 0.6; body.position.y = Math.sin(t * 6 + en.id) * 0.05; }
        else { body.position.y = Math.abs(Math.sin(t * 9 + en.id)) * 0.06; (v.userData.feet as THREE.Mesh[]).forEach((f, k) => { f.position.z = 0.05 + Math.sin(t * 9 + en.id + k * Math.PI) * 0.12; }); }
      } else if (en.squash) { body.scale.set(1.3, Math.max(0.15, 1 - en.deadT * 6), 1.3); v.visible = en.deadT < 0.5; }
      else { v.rotation.z = Math.PI; }
    }
    // items
    for (const it of sim.items) {
      let v = this.itemViews.get(it.id);
      if (!v) { v = makeItem(it.k); this.scene.add(v); this.itemViews.set(it.id, v); }
      v.visible = it.alive; if (!it.alive) continue;
      v.position.set(it.x, it.y, 0); v.rotation.y = t * 2;
      if (it.k === "star") ((v.userData.rainbow as THREE.MeshStandardMaterial).emissive).setHSL((t * 0.8) % 1, 1, 0.5);
    }
    // boss & lightning
    if (this.bossView && sim.boss) {
      const b = sim.boss, v = this.bossView, ud = v.userData;
      v.visible = b.state !== "gone";
      v.position.set(b.x, b.y, -0.2);
      (ud.dizzy as THREE.Group).visible = b.state === "dazed"; (ud.dizzy as THREE.Group).rotation.y = t * 4;
      (ud.hands as THREE.Mesh[]).forEach((h, k) => { h.position.y = 1.1 + Math.sin(t * 3 + k * 2) * 0.25; });
      const flash = b.inv > 0 && Math.floor(t * 16) % 2 === 0;
      for (const m of ud.mats as THREE.MeshStandardMaterial[]) { if (m.userData.e === undefined) m.userData.e = m.emissive.getHex(); m.emissive.setHex(flash ? 0xff3355 : m.userData.e); }
      const body = ud.body as THREE.Group;
      if (b.state === "windup") body.rotation.z = Math.sin(t * 40) * 0.05; else body.rotation.z = 0;
      if (this.slamRing) { const show = b.state === "windup" || b.state === "slam"; this.slamRing.visible = show; if (show) { this.slamRing.position.set(b.x, 3.04, 0); (this.slamRing.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.4 * Math.abs(Math.sin(t * 14)); } }
      if (b.state === "dazed") body.scale.set(1.15, 0.85, 1.1); else body.scale.set(1, 1, 1);
      if (b.state === "defeated") { v.rotation.z = Math.sin(t * 20) * 0.2; v.scale.setScalar(Math.max(0.01, 1 - b.t / 2.4)); if (Math.random() < 0.5) this.fx.burst(b.x, b.y + 1.2, 0, { color: [0xffe14a, 0xffffff], count: 4, speed: 6, life: 0.5, size: 0.3 }); }
    }
    this.boltViews.forEach((bv, i) => {
      const bo = sim.bolts[i];
      bv.warn.visible = !!bo && bo.warn > 0; bv.beam.visible = !!bo && bo.warn <= 0; bv.light.intensity = bo && bo.warn <= 0 ? 30 : 0;
      if (!bo) return;
      bv.warn.position.set(bo.x, 3.05, 0); (bv.warn.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.5 * Math.abs(Math.sin(t * 18));
      bv.beam.position.set(bo.x, 3 + 8, 0); bv.beam.scale.set(0.6 + Math.random() * 0.6, 1, 0.6 + Math.random() * 0.6); bv.light.position.set(bo.x, 5, 1);
    });

    // star power music & trail
    const starNow = p.starT > 0;
    if (starNow !== this.starOn) { this.starOn = starNow; this.audio.setStarMode(starNow); }
    if (starNow && Math.random() < 0.7) this.fx.one(px + (Math.random() - 0.5) * 0.5, py + Math.random() * 1.4, 0, -p.vx * 0.1, 0.5, [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b][Math.floor(Math.random() * 4)], 0.5, 0.25);
    if (p.gliding && Math.random() < 0.4) this.fx.one(px - p.face * 0.4, py + 0.9, -0.2, -p.vx * 0.2, 0, 0xffffff, 0.5, 0.12);
    if (p.wallSliding && Math.random() < 0.5) this.fx.one(px + p.wallDir * 0.4, py + 0.3, 0, 0, 0.5, 0xf5efe0, 0.4, 0.2);
    if (p.grounded && Math.abs(p.vx) > 7 && Math.random() < 0.25) this.fx.one(px - p.face * 0.3, py + 0.1, 0.3, -p.vx * 0.1, 0.8, 0xf5efe0, 0.4, 0.22);
    this.fx.ambient(this.world.theme.ambient, this.camX, this.camY, dt);
    this.fx.update(dt);

    // win sequence
    if (this.winT >= 0 && dt > 0) {
      this.winT += dt;
      if (Math.random() < 0.6) this.fx.burst(this.sim.goal!.x + (Math.random() - 0.5) * 6, this.sim.goal!.y + 3 + Math.random() * 3, 0, { color: [0xff4dd8, 0x4dd8ff, 0xffe14a, 0x7dff6b], count: 6, speed: 5, life: 1, size: 0.3, gravity: 3 });
      if (this.winT > 2.6) { this.winT = -99; this.cb.onWin(sim.result()); }
    }

    // HUD
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.12;
      this.cb.onHud({ hearts: p.hearts, gems: sim.gems, gemsTotal: sim.gemsTotal, shards: sim.shards, time: sim.time, power: p.power, star: p.starT, bossHp: sim.boss && sim.boss.state !== "gone" ? sim.boss.hp : null, retries: sim.retries });
    }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  private animateHero(px: number, py: number, dt: number) {
    const h = this.hero, p = this.sim.p, t = this.t;
    h.root.position.set(px, py, 0);
    const targetRot = p.face > 0 ? 0.95 : -0.95;
    h.root.rotation.y += (targetRot - h.root.rotation.y) * Math.min(1, dt * 14);
    const speed = Math.abs(p.vx);
    let legSwing = 0, armSwing = 0, armOut = 0.15, bob = 0, lean = 0;
    const capeBase = [0.15, 0.1, 0.1];
    let capeSpread = 1;
    if (p.grounded) {
      this.runPhase += dt * (4 + speed * 1.6);
      const k = Math.min(1, speed / 6);
      legSwing = Math.sin(this.runPhase) * 0.95 * k; armSwing = -Math.sin(this.runPhase) * 0.8 * k; bob = Math.abs(Math.sin(this.runPhase)) * 0.08 * k; lean = 0.12 * k;
      capeBase[0] = 0.2 + k * 0.6; capeBase[1] = 0.2 + Math.sin(this.runPhase * 2) * 0.2 * k;
    } else if (p.gliding) {
      armOut = 1.35; legSwing = 0.5; lean = 0.35; capeBase[0] = 1.25; capeBase[1] = 0.05 + Math.sin(t * 14) * 0.05; capeBase[2] = 0.05; capeSpread = 2.3;
    } else if (p.wallSliding) {
      armOut = 0.6; armSwing = -2.2; legSwing = 0.4; lean = -0.15;
    } else if (p.pound) {
      armOut = 0.4; legSwing = 0; lean = 0.2; capeBase[0] = -0.4;
    } else {
      legSwing = p.vy > 0 ? 0.7 : 0.3; armSwing = p.vy > 0 ? -2.4 : -0.6; armOut = p.vy > 0 ? 0.3 : 0.9; capeBase[0] = p.vy > 0 ? 0.3 : 0.9 + Math.sin(t * 16) * 0.15;
    }
    h.legL.rotation.x = legSwing; h.legR.rotation.x = p.grounded ? -legSwing : -legSwing * 0.6 - 0.4;
    h.armL.rotation.x = armSwing; h.armR.rotation.x = p.grounded ? -armSwing : armSwing * 0.9;
    h.armL.rotation.z = -armOut; h.armR.rotation.z = armOut;
    h.body.position.y = bob; h.body.rotation.x = lean;
    h.cape.forEach((c, i) => { c.rotation.x += (capeBase[i] - c.rotation.x) * Math.min(1, dt * 12); c.scale.x += (capeSpread - c.scale.x) * Math.min(1, dt * 10); });
    h.scarfTail.rotation.x = 0.3 + Math.sin(t * 12) * 0.15 + Math.min(0.8, speed * 0.05);
    // squash & stretch
    let sy = 1;
    if (p.landT > 0) sy = 1 - p.landT * 1.6; else if (!p.grounded) sy = 1 + THREE.MathUtils.clamp(p.vy * 0.012, -0.08, 0.14);
    const sxz = 1 / Math.sqrt(Math.max(0.6, sy));
    h.body.scale.set(sxz, sy, sxz);
    // ground-pound spin
    if (p.pound === 1) h.body.rotation.x = -(1 - p.poundT / 0.13) * Math.PI * 2; else if (p.pound === 2) h.body.rotation.x = 0;
    // faint / win spin
    if (p.respawnT > 0) { h.root.rotation.y += dt * 14; h.body.scale.multiplyScalar(Math.max(0.05, p.respawnT / 1.3)); }
    if (this.sim.state === "win") { h.root.rotation.y += dt * 10; h.body.scale.multiplyScalar(Math.max(0.05, 1 - this.sim.winT / 1.6)); }
    // power looks
    h.featherPlume.visible = p.power === 1;
    if (p.starT > 0) { const c = new THREE.Color().setHSL((t * 1.6) % 1, 1, 0.5); for (const m of h.allMats) { m.emissive.copy(c); m.emissiveIntensity = 0.55; } }
    else {
      for (const m of h.allMats) { if (m.userData.baseE === undefined) { m.userData.baseE = m.emissive.getHex(); m.userData.baseI = m.emissiveIntensity; } m.emissive.setHex(m.userData.baseE); m.emissiveIntensity = m.userData.baseI; }
      if (p.power) { h.capeMat.color.setHex(0xffc93c); h.capeMat.emissive.setHex(0xff9d00); h.capeMat.emissiveIntensity = 0.45; } else h.capeMat.color.setHex(0x7b4dff);
    }
    h.root.visible = !(p.invT > 0 && p.respawnT <= 0 && Math.floor(t * 14) % 2 === 0);
    void PLAYER_SIZE;
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.resizeObs.disconnect(); this.audio.stopMusic();
    this.world.dispose(); this.fx.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry && m.geometry !== gemGeometry) m.geometry.dispose(); });
    this.composer?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
    if (import.meta.env.DEV && (window as any).__sky?.game === this) delete (window as any).__sky;
  }
}
