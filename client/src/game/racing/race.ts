// Aurora Racers — race engine: karts, AI rivals, items, camera, effects and lap logic.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { TRACKS, TrackSpace } from "./tracks";
import { buildTrack, THEMES, type BuiltTrack, type Quality } from "./builder";
import { KartBody, KartModel, physicsFor, type BodyDef, type KartInput, type KartLook, type UpgradeId, type Physics } from "./kart";
import { RaceAudio } from "./audio";
import type { RacingNet } from "./net";
import { KF, type RaceSnap, type RaceStandingRow, type KartState } from "@shared/racing";

export type Mode = "gp" | "race" | "tt" | "online";
export type ItemType = "turbo" | "triple" | "slick" | "bomb" | "orb" | "shield" | "rush";
export const ITEM_INFO: Record<ItemType, { name: string; icon: string; hint: string }> = {
  turbo: { name: "Turbo Ink", icon: "🚀", hint: "Speed boost" },
  triple: { name: "Triple Turbo", icon: "🚀🚀🚀", hint: "Three boosts" },
  slick: { name: "Paint Slick", icon: "🫧", hint: "Drop behind you" },
  bomb: { name: "Paint Bomb", icon: "💣", hint: "Throw straight ahead" },
  orb: { name: "Homing Orb", icon: "🔮", hint: "Chases the racer ahead" },
  shield: { name: "Bubble Shield", icon: "🛡️", hint: "Blocks one hit" },
  rush: { name: "Prism Rush", icon: "🌈", hint: "Invincible speed burst" },
};

export interface RacerInfo { id: string; name: string; look: KartLook; body: BodyDef; upgrades: Record<UpgradeId, number>; isPlayer: boolean; skill?: number; /** online: driven by another browser */ remote?: boolean; /** online: a bot this browser drives */ localBot?: boolean }

export interface Standing { id: string; name: string; color: number; isPlayer: boolean; finished: boolean; time: number; bestLap: number; coins: number }

export interface RaceResult { place: number; time: number; bestLap: number; coins: number; standings: Standing[]; trackId: string }

export interface RaceHud {
  phase: "loading" | "intro" | "countdown" | "racing" | "finished";
  countdown: number;
  position: number;
  total: number;
  lap: number;
  laps: number;
  time: number;
  lapTimes: number[];
  item: ItemType | null;
  itemCount: number;
  rolling: boolean;
  rollIcon: string;
  coins: number;
  kmh: number;
  driftLevel: number;
  boosting: boolean;
  wrongWay: boolean;
  toast: { id: number; text: string } | null;
  standings: Standing[];
  result: RaceResult | null;
  fps: number;
  quality: Quality;
}

export interface RaceOptions {
  trackId: string;
  mode: Mode;
  cc: number;
  racers: RacerInfo[]; // player first
  quality: "auto" | Quality;
  sfx: number;
  music: number;
  touch: boolean;
  autoGas: boolean;
  onFinish: (r: RaceResult) => void;
  online?: { net: RacingNet; myId: string; startAt: number; laps: number };
}

const FIXED = 1 / 120;
const PLACE_COINS = [100, 80, 65, 50, 40, 30, 20, 10];

function detectQuality(pref: RaceOptions["quality"], touch: boolean): Quality {
  if (pref !== "auto") return pref;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (/swiftshader|llvmpipe|software/i.test(name)) return "low";
      if (touch) return "low";
      const cores = navigator.hardwareConcurrency || 4;
      if (cores <= 4 && /intel|uhd|iris|hd graphics|mali|adreno|powervr/i.test(name)) return "low";
      if (cores <= 4) return "medium";
    }
  } catch { /* ignore */ }
  return touch ? "low" : "high";
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

interface Particle { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; grow: number; color: THREE.Color; grav: number }

class Particles {
  readonly mesh: THREE.InstancedMesh;
  private list: Particle[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  constructor(scene: THREE.Scene, private max = 900) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.mesh);
  }
  add(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number, color: THREE.Color | number, grav = 0, grow = 0) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ p: p.clone(), v: v.clone(), life, max: life, size, grow, color: color instanceof THREE.Color ? color : new THREE.Color(color), grav });
  }
  update(dt: number) {
    let n = 0;
    this.list = this.list.filter((x) => (x.life -= dt) > 0);
    for (const x of this.list) {
      x.v.y -= x.grav * dt;
      x.p.addScaledVector(x.v, dt);
      const k = x.life / x.max;
      this.s.setScalar(Math.max(0.001, x.size * (x.grow ? 1 + (1 - k) * x.grow : k)));
      this.m.compose(x.p, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, x.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.parent?.remove(this.mesh); }
}

// ---------------------------------------------------------------------------
// Racer runtime
// ---------------------------------------------------------------------------

interface Racer {
  info: RacerInfo;
  body: KartBody;
  model: KartModel;
  basePhys: Physics;
  input: KartInput;
  item: ItemType | null;
  itemCount: number;
  rollUntil: number;
  rollItem: ItemType | null;
  heldSince: number;
  lapStart: number;
  lapTimes: number[];
  bestLap: number;
  ai: { lane: number; skill: number; laneTimer: number; nextItemCheck: number; driftHold: number } | null;
  lastPos: number;
  remote: boolean;
  samples: { t: number; st: KartState }[];
}

interface Hazard { kind: "slick" | "bomb" | "orb"; pos: THREE.Vector3; s: number; lat: number; owner: Racer; age: number; target: Racer | null; mesh: THREE.Object3D; dead: boolean; hid: string }

let toastSeq = 1;

export class Race {
  readonly hud: RaceHud;
  private listeners = new Set<() => void>();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3000);
  private composer: EffectComposer | null = null;
  private track: TrackSpace;
  private built: BuiltTrack;
  private racers: Racer[] = [];
  private player: Racer;
  private hazards: Hazard[] = [];
  private particles: Particles;
  private audio = new RaceAudio();
  private quality: Quality;
  private raf = 0;
  private clock = new THREE.Clock();
  private acc = 0;
  private t = 0; // seconds since load
  private raceTime = 0;
  private phaseStart = 0;
  private disposed = false;
  private keys = new Set<string>();
  private touchSteer = 0;
  private touchGas = false;
  private touchBrake = false;
  private touchDrift = false;
  private itemPressed = false;
  private gasHeldAt = -1;
  private lastHud = 0;
  private fpsAcc = 0; private fpsN = 0; private fps = 60;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private finishedAt = -1;
  private resultSent = false;
  private minimap: HTMLCanvasElement | null = null;
  private mapBase: HTMLCanvasElement | null = null;
  private lastBeep = -1;
  private hazardGeo = { slick: new THREE.CylinderGeometry(1.4, 1.5, 0.08, 20), bomb: new THREE.SphereGeometry(0.45, 16, 12), orb: new THREE.SphereGeometry(0.5, 16, 12) };
  private hazardMat = {
    slick: new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.15, metalness: 0.2, emissive: 0x3b0764, emissiveIntensity: 0.4 }),
    bomb: new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.3, emissive: 0x831843, emissiveIntensity: 0.5 }),
    orb: new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x2563eb, emissiveIntensity: 1.4, roughness: 0.2 }),
  };

  constructor(private container: HTMLElement, private opts: RaceOptions) {
    const def = TRACKS.find((t) => t.id === opts.trackId) || TRACKS[0];
    this.track = new TrackSpace(def);
    this.quality = detectQuality(opts.quality, opts.touch);
    const q = this.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: q === "low", powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === "high" ? 2 : q === "medium" ? 1.5 : 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = THEMES[def.theme].exposure;
    this.renderer.shadowMap.enabled = q !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    Object.assign(this.renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });
    container.appendChild(this.renderer.domElement);

    this.built = buildTrack(this.scene, this.renderer, this.track, q);
    this.particles = new Particles(this.scene);

    if (q !== "low") {
      const size = new THREE.Vector2(); this.renderer.getDrawingBufferSize(size);
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q === "high" ? 4 : 2 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 32.0), clamp(c.a, 0.0, 1.0)); }",
      }));
      const night = THEMES[def.theme].night;
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), night ? 0.85 : 0.3, 0.6, night ? 0.6 : 0.9));
      this.composer.addPass(new OutputPass());
    }

    // racers on the grid
    const grid = opts.mode === "tt" ? [opts.racers[0]] : opts.racers;
    const order = grid.slice(1);
    // online: the server decides the grid order; offline the player starts mid-pack
    const slots: RacerInfo[] = opts.online ? grid.slice() : [...order.slice(0, 5), grid[0], ...order.slice(5)];
    this.laps = opts.online ? opts.online.laps : def.laps;
    slots.forEach((info, i) => {
      const phys = physicsFor(info.body, info.upgrades, opts.cc);
      const body = new KartBody({ ...phys });
      const row = Math.floor(i / 2), col = i % 2;
      body.place(this.track, this.track.length - 8 - row * 6.5, (col ? 1 : -1) * 3.6 + (row % 2 ? 0.6 : -0.6));
      body.lap = 0;
      const model = new KartModel(info.look, { castShadow: q !== "low", tag: !info.isPlayer });
      this.scene.add(model.root);
      const r: Racer = {
        info, body, model, basePhys: { ...phys }, input: { gas: 0, brake: 0, steer: 0, drift: false },
        item: null, itemCount: 0, rollUntil: 0, rollItem: null, heldSince: 0, lapStart: 0, lapTimes: [], bestLap: 0,
        ai: info.isPlayer || info.remote ? null : { lane: (Math.random() - 0.5) * 0.7, skill: info.skill ?? 0.95, laneTimer: 0, nextItemCheck: 0, driftHold: 0 },
        lastPos: 0,
        remote: !!info.remote,
        samples: [],
      };
      this.racers.push(r);
    });
    this.player = this.racers.find((r) => r.info.isPlayer)!;

    this.hud = {
      phase: "intro", countdown: 3, position: this.racers.indexOf(this.player) + 1, total: this.racers.length, lap: 1, laps: this.laps,
      time: 0, lapTimes: [], item: null, itemCount: 0, rolling: false, rollIcon: "", coins: 0, kmh: 0, driftLevel: 0, boosting: false,
      wrongWay: false, toast: null, standings: [], result: null, fps: 60, quality: q,
    };
    this.audio.setVolumes(opts.sfx, opts.music);

    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("resize", this.resize);
    this.resize();
    const p = this.player.body;
    this.camPos.copy(p.pos).add(new THREE.Vector3(30, 18, 30));
    this.camLook.copy(p.pos);
    if (opts.online) {
      const on = opts.online;
      this.unlisten = on.net.listen((snap) => this.onNet(snap));
      on.net.getState = () => this.netState();
    }
    if (import.meta.env.DEV) (window as unknown as { __race?: Race }).__race = this;
    this.clock.start();
    this.loop();
  }

  // ===========================================================================
  // public API
  // ===========================================================================

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getHud = () => this.hud;
  private emit(patch: Partial<RaceHud>) { Object.assign(this.hud, patch); (this as { hud: RaceHud }).hud = { ...this.hud }; this.listeners.forEach((l) => l()); }

  bindMinimap(c: HTMLCanvasElement | null) { this.minimap = c; }
  unlockAudio() { this.audio.unlock(); }
  setVolumes(sfx: number, music: number) { this.audio.setVolumes(sfx, music); }
  touchControls(s: { steer?: number; gas?: boolean; brake?: boolean; drift?: boolean }) {
    if (s.steer !== undefined) this.touchSteer = s.steer;
    if (s.gas !== undefined) this.touchGas = s.gas;
    if (s.brake !== undefined) this.touchBrake = s.brake;
    if (s.drift !== undefined) this.touchDrift = s.drift;
    this.audio.unlock();
  }
  useItem() { this.itemPressed = true; this.audio.unlock(); }
  private paused = false;
  setPaused(v: boolean) { this.paused = v; if (v) this.keys.clear(); }
  skipIntro() { if (this.hud.phase === "intro" && !this.opts.online) this.startCountdown(); }
  private laps = 3;
  private unlisten: (() => void) | null = null;
  private hazardSeq = 1;
  private netSeq = 0;

  // ===========================================================================
  // input
  // ===========================================================================

  private onKey = (e: KeyboardEvent) => {
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    this.audio.unlock();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (["KeyE", "KeyF", "ControlLeft", "ControlRight", "KeyX"].includes(e.code)) this.itemPressed = true;
    if (this.hud.phase === "intro" && (e.code === "Space" || e.code === "Enter")) this.skipIntro();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onBlur = () => { this.keys.clear(); };

  private playerInput(): KartInput {
    const k = this.keys;
    const left = k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0, right = k.has("ArrowRight") || k.has("KeyD") ? 1 : 0;
    const gas = k.has("ArrowUp") || k.has("KeyW") || this.touchGas || (this.opts.touch && this.opts.autoGas) ? 1 : 0;
    const brake = k.has("ArrowDown") || k.has("KeyS") || this.touchBrake ? 1 : 0;
    const drift = k.has("Space") || k.has("ShiftLeft") || k.has("ShiftRight") || this.touchDrift;
    return { gas, brake, steer: THREE.MathUtils.clamp(right - left + this.touchSteer, -1, 1), drift };
  }

  // ===========================================================================
  // loop
  // ===========================================================================

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = Math.min(this.clock.getDelta(), 0.1);
    const dt = this.paused ? 0 : raw;
    try { this.frame(dt); } catch (err) { console.error("[racing] frame error", err); }
  };

  private startCountdown() {
    this.emit({ phase: "countdown", countdown: 3 });
    this.phaseStart = this.t;
    this.audio.startMusic(this.track.def.theme);
  }

  private frame(dt: number) {
    this.t += dt;
    const phase = this.hud.phase;
    const on = this.opts.online;
    if (on) {
      // online: the countdown follows the server clock so everyone starts together
      const until = (on.net.serverToLocal(on.startAt) - Date.now()) / 1000;
      if (phase === "intro" && until <= 3) { this.startCountdown(); this.phaseStart = this.t - (3 - Math.max(0, until)); }
    } else if (phase === "intro" && this.t > 3.2) this.startCountdown();

    // countdown with start lights + rocket start
    if (phase === "countdown") {
      const el = this.t - this.phaseStart;
      const left = Math.max(0, 3 - Math.floor(el));
      const lights = this.built.startLights;
      lights.forEach((l, i) => { const m = l.material as THREE.MeshStandardMaterial; const on = i < Math.min(3, Math.floor(el) + 1) && el < 3; m.emissive.setHex(on ? 0xff2222 : el >= 3 ? 0x22ff55 : 0x000000); m.color.setHex(on ? 0xff4444 : el >= 3 ? 0x44ff77 : 0x220000); });
      if (left !== this.lastBeep && left > 0) { this.lastBeep = left; this.audio.beep(false); }
      const pin = this.playerInput();
      if (pin.gas && this.gasHeldAt < 0) this.gasHeldAt = el; else if (!pin.gas) this.gasHeldAt = -1;
      if (left !== this.hud.countdown) this.emit({ countdown: left });
      if (el >= 3) {
        this.audio.beep(true);
        this.emit({ phase: "racing", countdown: 0 });
        this.raceTime = on ? Math.max(0, (Date.now() - on.net.serverToLocal(on.startAt)) / 1000) : 0;
        // rocket start: press the gas just as the last light comes on
        if (this.gasHeldAt >= 1.9 && this.gasHeldAt <= 2.6) { this.player.body.boost(1.2, 1.4); this.toast("ROCKET START!"); this.audio.boost(); }
        for (const r of this.racers) { r.lapStart = 0; if (r.ai && Math.random() < 0.5 * r.ai.skill) r.body.boost(0.8, 1.3); }
      }
    }

    const racing = this.hud.phase === "racing" || this.hud.phase === "finished";
    if (racing) {
      this.raceTime += dt;
      this.updateAI(dt);
      const pin = this.playerInput();
      if (this.player.body.finished) { this.player.input = this.aiInput(this.player, dt); }
      else this.player.input = pin;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED && steps < 16) {
        for (const r of this.racers) if (!r.remote) r.body.step(FIXED, r.input, this.track, this.raceTime);
        this.collide();
        this.acc -= FIXED; steps++;
      }
      if (steps >= 16) this.acc = 0;
      this.pickups();
      this.updateItems(dt);
      this.updateHazards(dt);
      this.processEvents();
      this.checkFinish();
    }

    if (on) this.updateRemotes(dt);
    // visuals
    for (const r of this.racers) {
      const showTag = !r.info.isPlayer && r.body.pos.distanceTo(this.player.body.pos) < 45;
      r.model.update(dt, r.body, this.t, showTag);
      this.kartParticles(r, dt);
    }
    this.particles.update(dt);
    this.built.update(dt, this.t);
    for (const b of this.built.itemBoxes) b.respawn = Math.max(0, b.respawn - dt);
    for (const c of this.built.coins) if (c.taken && (c.respawn -= dt) <= 0) c.taken = false;
    this.updateCamera(dt);
    const snow = this.built.group.userData.snow as THREE.Points | undefined;
    if (snow) snow.position.set(this.camera.position.x, this.camera.position.y - 20, this.camera.position.z);
    const sp = this.player.body.pos;
    const texel = 120 / 2048;
    const fx = Math.round(sp.x / texel) * texel, fz = Math.round(sp.z / texel) * texel;
    this.built.sun.position.set(fx + 60, sp.y + 110, fz + 40);
    this.built.sun.target.position.set(fx, sp.y, fz);
    this.built.sun.target.updateMatrixWorld();

    const pb = this.player.body;
    this.audio.engine(pb.speed, pb.phys.maxSpeed, this.player.input.gas, pb.boostTime > 0 || pb.rushTime > 0, !!pb.driftDir && pb.grounded, this.hud.phase !== "intro" && !this.disposed);

    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);

    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    if (this.t - this.lastHud > 0.08) { this.lastHud = this.t; this.pushHud(); }
    this.drawMinimap();
  }

  // ===========================================================================
  // AI
  // ===========================================================================

  private aiInput(r: Racer, dt: number): KartInput {
    const b = r.body, tr = this.track;
    const ai = r.ai || { lane: 0, skill: 0.95, laneTimer: 0, nextItemCheck: 0, driftHold: 0 };
    const speed = Math.max(8, Math.abs(b.speed));
    const look = 7 + speed * 0.55;
    const ahead = tr.at(b.s + look);
    const curvAhead = tr.at(b.s + look * 1.6);
    const curv = tr.sample(curvAhead.index).curv;
    // racing line: lean to the inside of upcoming corners, plus personal lane
    let latT = (ai.lane + THREE.MathUtils.clamp(curv * 28, -0.55, 0.55)) * tr.half;
    // steer around nearby karts and hazards ahead
    for (const o of this.racers) {
      if (o === r) continue;
      const ds = o.body.progress - b.progress;
      if (ds > 0 && ds < 12 && Math.abs(o.body.lat - latT) < 2.4) latT += (o.body.lat > latT ? -1 : 1) * 2.6;
    }
    for (const h of this.hazards) {
      if (h.kind !== "slick") continue;
      const ds = h.s - b.s;
      if (ds > 0 && ds < 25 && Math.abs(h.lat - latT) < 2.6) latT += (h.lat > latT ? -1 : 1) * 3;
    }
    latT = THREE.MathUtils.clamp(latT, -tr.half + 1.5, tr.half - 1.5);
    const target = tr.point(b.s + look, latT, 0);
    const desired = Math.atan2(target.x - b.pos.x, target.z - b.pos.z);
    const diff = Math.atan2(Math.sin(desired - b.yaw), Math.cos(desired - b.yaw));
    let steer = THREE.MathUtils.clamp(-diff * 2.4, -1, 1); // + = right
    let drift = false;
    if (Math.abs(curv) > 0.018 && speed > 16 && ai.skill > 0.86) { drift = true; ai.driftHold = 1.4; }
    else if (ai.driftHold > 0) { ai.driftHold -= dt; drift = true; }
    if (b.driftDir && Math.sign(steer) !== b.driftDir && Math.abs(diff) > 0.35) drift = false;
    const brake = Math.abs(diff) > 0.9 && speed > 14 ? 1 : 0;
    void ahead;
    if (b.wrongWay > 1) steer = 1;
    return { gas: brake ? 0 : 1, brake, steer, drift };
  }

  private updateAI(dt: number) {
    const pp = this.player.body.progress;
    const rubber = this.opts.mode === "tt" ? 0 : 1;
    for (const r of this.racers) {
      if (!r.ai) continue;
      const ai = r.ai;
      // rubber-banding keeps the pack close and races exciting
      const delta = pp - r.body.progress;
      const band = 1 + THREE.MathUtils.clamp(delta / 160, -0.07, 0.09) * rubber;
      r.body.phys.maxSpeed = r.basePhys.maxSpeed * ai.skill * band;
      r.body.phys.accel = r.basePhys.accel * (0.9 + ai.skill * 0.1);
      ai.laneTimer -= dt;
      if (ai.laneTimer <= 0) { ai.laneTimer = 2 + Math.random() * 4; ai.lane = THREE.MathUtils.clamp(ai.lane + (Math.random() - 0.5) * 0.4, -0.45, 0.45); }
      r.input = this.aiInput(r, dt);
      // items
      if (r.item && this.t > ai.nextItemCheck) {
        ai.nextItemCheck = this.t + 0.4;
        const held = this.t - r.heldSince;
        const ahead = this.racers.filter((o) => o !== r && o.body.progress > r.body.progress).sort((a, b) => a.body.progress - b.body.progress)[0];
        const behind = this.racers.find((o) => o !== r && r.body.progress - o.body.progress > 2 && r.body.progress - o.body.progress < 18);
        const straight = Math.abs(this.track.sample(this.track.at(r.body.s + 25).index).curv) < 0.012;
        let use = false;
        switch (r.item) {
          case "turbo": case "triple": use = straight && held > 0.6; break;
          case "shield": case "rush": use = held > 0.4; break;
          case "slick": use = !!behind || held > 7; break;
          case "bomb": use = (!!ahead && ahead.body.progress - r.body.progress < 45 && Math.abs(ahead.body.lat - r.body.lat) < 3.5) || held > 9; break;
          case "orb": use = !!ahead && held > 1; break;
        }
        if (use) this.fireItem(r);
      }
    }
  }

  // ===========================================================================
  // collisions, pickups, items
  // ===========================================================================

  private collide() {
    const R = this.racers;
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const a = R[i].body, b = R[j].body;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dy = b.pos.y - a.pos.y;
      const d = Math.hypot(dx, dz);
      if (d > 1.9 || d < 1e-4 || Math.abs(dy) > 1.5) continue;
      const nx = dx / d, nz = dz / d, over = 1.9 - d;
      const wa = a.phys.weight + (a.rushTime > 0 ? 50 : 0), wb = b.phys.weight + (b.rushTime > 0 ? 50 : 0);
      const ra = R[i].remote, rb = R[j].remote;
      if (ra && rb) continue;
      // remote karts are moved by their own browser: push only the local one
      const ka = ra ? 0 : rb ? 1 : wb / (wa + wb), kb = rb ? 0 : ra ? 1 : wa / (wa + wb);
      a.pos.x -= nx * over * ka; a.pos.z -= nz * over * ka;
      b.pos.x += nx * over * kb; b.pos.z += nz * over * kb;
      const rel = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * nz;
      if (rel < 0) {
        const imp = -rel * 1.25;
        a.vel.x -= nx * imp * ka; a.vel.y -= nz * imp * ka;
        b.vel.x += nx * imp * kb; b.vel.y += nz * imp * kb;
        if (imp > 3) {
          if (a.rushTime > 0 && b.rushTime <= 0 && !rb) b.hit(); else if (b.rushTime > 0 && a.rushTime <= 0 && !ra) a.hit();
          if (R[i] === this.player || R[j] === this.player) this.audio.wall();
        }
      }
    }
  }

  private pickups() {
    for (const r of this.racers) {
      if (r.remote) continue;
      const p = r.body.pos;
      for (const b of this.built.itemBoxes) {
        if (b.respawn > 0) continue;
        if (Math.abs(p.x - b.pos.x) < 1.6 && Math.abs(p.z - b.pos.z) < 1.6 && Math.abs(p.y + 0.8 - b.pos.y) < 2) {
          b.respawn = 2.5;
          for (let k = 0; k < 10; k++) this.particles.add(b.pos, new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8), 0.6, 0.12, new THREE.Color().setHSL(Math.random(), 1, 0.65), 9);
          if (!r.item && r.rollUntil <= 0) {
            r.rollUntil = this.t + (r.info.isPlayer ? 1.4 : 0.8);
            r.rollItem = this.rollItem(r);
            if (r === this.player) this.audio.itemBox();
          }
        }
      }
      for (const c of this.built.coins) {
        if (c.taken) continue;
        if (Math.abs(p.x - c.pos.x) < 1.4 && Math.abs(p.z - c.pos.z) < 1.4 && Math.abs(p.y + 0.6 - c.pos.y) < 1.8) {
          c.taken = true; c.respawn = 12;
          r.body.coins = Math.min(r.body.coins + 1, 99);
          if (r === this.player) { this.audio.coin(); for (let k = 0; k < 6; k++) this.particles.add(c.pos, new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4), 0.5, 0.1, 0xffd34d, 10); }
        }
      }
      for (const bp of this.built.boostPads) {
        const ds = Math.abs(r.body.s - bp.s);
        if ((ds < 3 || ds > this.track.length - 3) && Math.abs(r.body.lat - bp.lat) < 2 && r.body.grounded) {
          if (r.body.boostTime < 0.9) { r.body.boost(1.0, 1.35); }
        }
      }
      if (r.rollUntil > 0 && this.t >= r.rollUntil) {
        r.rollUntil = 0;
        r.item = r.rollItem; r.itemCount = r.item === "triple" ? 3 : 1; r.heldSince = this.t;
        if (r === this.player) this.audio.gotItem();
      }
    }
  }

  private rank(r: Racer) { return this.sorted().indexOf(r); }

  private rollItem(r: Racer): ItemType {
    if (this.opts.mode === "tt") return "turbo";
    const n = this.racers.length, pos = this.rank(r) / Math.max(1, n - 1); // 0 first .. 1 last
    const table: [ItemType, number][] = pos < 0.15
      ? [["slick", 40], ["shield", 25], ["turbo", 20], ["bomb", 15]]
      : pos < 0.6
        ? [["turbo", 25], ["bomb", 22], ["slick", 14], ["orb", 16], ["shield", 11], ["triple", 12]]
        : [["triple", 30], ["orb", 22], ["rush", 18], ["turbo", 18], ["bomb", 12]];
    const total = table.reduce((a, [, w]) => a + w, 0);
    let x = Math.random() * total;
    for (const [it, w] of table) { if ((x -= w) <= 0) return it; }
    return "turbo";
  }

  private fireItem(r: Racer) {
    const it = r.item;
    if (!it) return;
    const b = r.body;
    const isP = r === this.player;
    switch (it) {
      case "turbo": case "triple": b.boost(1.15, 1.42); if (isP) this.audio.boost(); break;
      case "shield": b.shieldTime = 9; if (isP) this.audio.shield(); break;
      case "rush": b.rushTime = 6; b.boost(0.5, 1.3); if (isP) this.audio.rush(); break;
      case "slick": {
        const s = b.s - 3.2;
        const pos = this.track.point(s, b.lat, 0.05);
        this.netItem(r, this.addHazard("slick", r, s, b.lat, pos));
        if (isP) this.audio.throwItem();
        break;
      }
      case "bomb": {
        const s = b.s + 3;
        this.netItem(r, this.addHazard("bomb", r, s, b.lat, this.track.point(s, b.lat, 1)));
        if (isP) this.audio.throwItem();
        break;
      }
      case "orb": {
        const ahead = this.racers.filter((o) => o !== r && o.body.progress > b.progress).sort((x, y) => x.body.progress - y.body.progress)[0] || null;
        const s = b.s + 3;
        const h = this.addHazard("orb", r, s, b.lat, this.track.point(s, b.lat, 1));
        h.target = ahead;
        this.netItem(r, h);
        if (isP) this.audio.throwItem();
        break;
      }
    }
    r.itemCount--;
    if (r.itemCount <= 0) { r.item = null; r.itemCount = 0; }
    r.heldSince = this.t;
  }

  private addHazard(kind: Hazard["kind"], owner: Racer, s: number, lat: number, pos: THREE.Vector3, hid?: string) {
    const mesh = new THREE.Mesh(this.hazardGeo[kind], this.hazardMat[kind]);
    mesh.position.copy(pos);
    mesh.castShadow = this.quality !== "low";
    this.scene.add(mesh);
    const h: Hazard = { kind, pos: pos.clone(), s, lat, owner, age: 0, target: null, mesh, dead: false, hid: hid || (this.opts.online?.myId || "l") + "-" + this.hazardSeq++ };
    this.hazards.push(h);
    if (this.hazards.length > 40) { const old = this.hazards.shift()!; this.scene.remove(old.mesh); }
    return h;
  }

  private updateItems(_dt: number) {
    if (this.itemPressed) {
      this.itemPressed = false;
      if (this.hud.phase === "racing" && this.player.item && !this.player.body.finished) this.fireItem(this.player);
    }
  }

  private updateHazards(dt: number) {
    const L = this.track.length;
    for (const h of this.hazards) {
      if (h.dead) continue;
      h.age += dt;
      if (h.kind === "bomb") {
        h.s += 46 * dt;
        h.pos.copy(this.track.point(h.s, h.lat, 0.6 + Math.abs(Math.sin(h.age * 7)) * 0.9));
        if (h.age > 3) this.explode(h);
      } else if (h.kind === "orb") {
        const tgt = h.target;
        h.s += 54 * dt;
        if (tgt) h.lat += (tgt.body.lat - h.lat) * Math.min(1, dt * 3);
        h.pos.copy(this.track.point(h.s, h.lat, 1 + Math.sin(h.age * 10) * 0.2));
        if (tgt) {
          let ds = tgt.body.s - (h.s % L); if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L;
          if (Math.abs(ds) < 2.5 && !tgt.remote) { if (tgt.body.hit()) this.onHit(tgt); this.splash(h.pos, 0x60a5fa); h.dead = true; this.netGone(h); }
        }
        if (h.age > 7) h.dead = true;
      } else {
        h.mesh.rotation.y += dt;
        if (h.age > 60) h.dead = true;
      }
      if (h.dead) continue;
      h.mesh.position.copy(h.pos);
      for (const r of this.racers) {
        if ((r === h.owner && h.age < 0.6) || r.body.spinTime > 0 || r.remote) continue;
        const d = r.body.pos.distanceTo(h.pos);
        if (d < (h.kind === "slick" ? 1.7 : 1.8)) {
          if (h.kind === "bomb") { this.explode(h); break; }
          if (r.body.hit()) this.onHit(r);
          this.splash(h.pos, h.kind === "slick" ? 0x9333ea : 0x60a5fa);
          h.dead = true;
          this.netGone(h);
          break;
        }
      }
    }
    for (const h of this.hazards) if (h.dead) this.scene.remove(h.mesh);
    this.hazards = this.hazards.filter((h) => !h.dead);
  }

  private explode(h: Hazard) {
    h.dead = true;
    this.splash(h.pos, 0xec4899, 2);
    for (const r of this.racers) if (!r.remote && r.body.pos.distanceTo(h.pos) < 4.5 && r.body.spinTime <= 0) { if (r.body.hit()) this.onHit(r); }
    this.netGone(h);
  }

  private onHit(r: Racer) {
    if (r === this.player) this.toast("SPLATTED!");
  }

  private splash(p: THREE.Vector3, color: number, power = 1) {
    for (let k = 0; k < 26 * power; k++) this.particles.add(p, new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 8, (Math.random() - 0.5) * 12).multiplyScalar(power > 1 ? 1.3 : 1), 0.8, 0.18, color, 14);
    if (p.distanceTo(this.player.body.pos) < 40) this.audio.splat();
  }

  private kartParticles(r: Racer, dt: number) {
    const b = r.body;
    const near = b.pos.distanceTo(this.camera.position) < 60;
    if (!near) return;
    // drift sparks
    if (b.driftDir && b.grounded && b.driftLevel > 0) {
      const color = b.driftLevel === 3 ? 0xd946ef : b.driftLevel === 2 ? 0xfb923c : 0x38bdf8;
      for (const sp of r.model.sparkPoints) {
        const w = sp.getWorldPosition(new THREE.Vector3());
        for (let k = 0; k < 2; k++) this.particles.add(w, new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3), 0.25, 0.07, color, 12);
      }
    } else if (b.driftDir && b.grounded) {
      for (const sp of r.model.sparkPoints) if (Math.random() < 0.5) this.particles.add(sp.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0.8, 0), 0.5, 0.16, 0xd4d4d8, -0.5, 2.5);
    }
    // off-road dust / snow
    if (b.offroad && Math.abs(b.speed) > 6 && b.grounded && Math.random() < dt * 30) {
      const theme = this.track.def.theme;
      const c = theme === "frost" ? 0xffffff : theme === "shores" ? 0xf3e2b0 : theme === "books" ? 0xd6b48a : 0x6366f1;
      for (const sp of r.model.sparkPoints) this.particles.add(sp.getWorldPosition(new THREE.Vector3()), new THREE.Vector3((Math.random() - 0.5) * 2, 1.2, (Math.random() - 0.5) * 2), 0.7, 0.25, c, -0.5, 2.2);
    }
    // spin stars
    if (b.spinTime > 0 && Math.random() < dt * 20) this.particles.add(b.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), new THREE.Vector3((Math.random() - 0.5) * 3, 2, (Math.random() - 0.5) * 3), 0.6, 0.12, 0xfde047, 4);
  }

  private processEvents() {
    for (const r of this.racers) {
      const isP = r === this.player;
      for (const e of r.body.events) {
        if (e === "lap") this.onLap(r);
        if (!isP) continue;
        if (e === "boost") { /* sound handled by caller */ }
        else if (e === "hop") this.audio.hop();
        else if (e.startsWith("spark")) this.audio.spark(Number(e.slice(5)));
        else if (e.startsWith("mt")) { this.audio.miniTurbo(Number(e.slice(2))); if (Number(e.slice(2)) >= 2) this.toast(e === "mt3" ? "ULTRA MINI-TURBO!" : "SUPER MINI-TURBO!"); }
        else if (e === "land") this.audio.land();
        else if (e === "wall") this.audio.wall();
        else if (e === "spin") this.audio.spin();
        else if (e === "shield-break") this.audio.shieldBreak();
      }
      r.body.events.length = 0;
    }
  }

  private onLap(r: Racer) {
    const b = r.body;
    if (b.lap <= 1) { r.lapStart = this.raceTime; return; }
    const lapTime = this.raceTime - r.lapStart;
    r.lapStart = this.raceTime;
    r.lapTimes.push(lapTime);
    if (!r.bestLap || lapTime < r.bestLap) r.bestLap = lapTime;
    const laps = this.laps;
    if (b.lap > laps && !b.finished) {
      b.finished = true; b.finishTime = this.raceTime;
      if (this.opts.online && !r.remote) this.opts.online.net.send({ k: "finish", time: Math.round(this.raceTime * 1000) / 1000, id: r.info.id });
      if (r === this.player) {
        this.finishedAt = this.t;
        const place = this.rank(r) + 1;
        this.audio.finish(place);
        this.toast(place === 1 ? "YOU WIN!" : "FINISH!");
        this.emit({ phase: "finished" });
        r.ai = { lane: 0, skill: 0.9, laneTimer: 0, nextItemCheck: 0, driftHold: 0 };
      }
    } else if (r === this.player) {
      if (b.lap === laps) { this.toast("FINAL LAP!"); this.audio.lap(true); } else { this.toast(`LAP ${b.lap}`); this.audio.lap(false); }
    }
  }

  private sorted() {
    return [...this.racers].sort((a, b) => {
      if (a.body.finished && b.body.finished) return a.body.finishTime - b.body.finishTime;
      if (a.body.finished) return -1;
      if (b.body.finished) return 1;
      return b.body.progress - a.body.progress;
    });
  }

  private checkFinish() {
    if (this.opts.online) return; // the server publishes online results
    if (this.finishedAt < 0 || this.resultSent) return;
    // give the rest of the field a few seconds, then estimate their times
    if (this.t - this.finishedAt < 4 && !this.racers.every((r) => r.body.finished)) return;
    this.resultSent = true;
    const L = this.track.length, laps = this.laps;
    const standings: Standing[] = this.sorted().map((r) => {
      let time = r.body.finishTime;
      if (!r.body.finished) {
        const remaining = Math.max(0, laps * L - r.body.progress);
        time = this.raceTime + remaining / Math.max(12, r.basePhys.maxSpeed * 0.85);
      }
      return { id: r.info.id, name: r.info.name, color: r.info.look.paint, isPlayer: r.info.isPlayer, finished: r.body.finished, time, bestLap: r.bestLap, coins: r.body.coins };
    }).sort((a, b) => a.time - b.time);
    const place = standings.findIndex((s) => s.isPlayer) + 1;
    const coins = this.opts.mode === "tt" ? this.player.body.coins : this.player.body.coins + Math.round(PLACE_COINS[place - 1] * (0.7 + this.opts.cc * 0.3));
    const result: RaceResult = { place, time: this.player.body.finishTime, bestLap: this.player.bestLap, coins, standings, trackId: this.track.def.id };
    this.emit({ result, standings });
    this.opts.onFinish(result);
  }

  private toast(text: string) { this.emit({ toast: { id: toastSeq++, text } }); }

  // ===========================================================================
  // camera & HUD
  // ===========================================================================

  private updateCamera(dt: number) {
    const b = this.player.body;
    const phase = this.hud.phase;
    const fwd = new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw));
    let want: THREE.Vector3, look: THREE.Vector3, k = 1 - Math.exp(-dt * 6);
    if (phase === "intro") {
      const a = this.t * 0.35;
      want = b.pos.clone().add(new THREE.Vector3(Math.cos(a) * 22, 9 + Math.sin(this.t * 0.5) * 2, Math.sin(a) * 22));
      look = b.pos.clone().add(new THREE.Vector3(0, 1, 0));
      k = 1 - Math.exp(-dt * 2);
    } else if (phase === "finished" || b.finished) {
      const a = this.t * 0.4;
      want = b.pos.clone().add(new THREE.Vector3(Math.cos(a) * 9, 3.5, Math.sin(a) * 9));
      look = b.pos.clone().add(new THREE.Vector3(0, 1, 0));
      k = 1 - Math.exp(-dt * 3);
    } else {
      const swing = -b.driftDir * 0.28;
      const back = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), swing);
      const dist = 6.6 + Math.min(1.4, Math.max(0, b.speed) * 0.025) + (b.boostTime > 0 ? 0.6 : 0);
      want = b.pos.clone().addScaledVector(back, -dist).add(new THREE.Vector3(0, 2.6, 0));
      look = b.pos.clone().addScaledVector(fwd, 5).add(new THREE.Vector3(0, 1.1, 0));
      if (b.spinTime > 0) k *= 0.5;
    }
    this.camPos.lerp(want, k);
    this.camLook.lerp(look, 1 - Math.exp(-dt * 10));
    // keep above the road / ground
    const pr = this.track.project(this.camPos.x, this.camPos.z, b.hint, 60);
    if (this.camPos.y < pr.height + 1.2) this.camPos.y = pr.height + 1.2;
    this.camera.position.copy(this.camPos);
    if (b.boostTime > 0 && phase === "racing") this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, 0));
    this.camera.lookAt(this.camLook);
    const fov = 68 + THREE.MathUtils.clamp(b.speed / b.phys.maxSpeed, 0, 1.4) * 10 + (b.boostTime > 0 || b.rushTime > 0 ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4); this.camera.updateProjectionMatrix(); }
  }

  // ===========================================================================
  // online
  // ===========================================================================

  private netItem(r: Racer, h: Hazard) {
    const on = this.opts.online;
    if (!on || r.remote) return;
    on.net.send({ k: "item", kind: h.kind, hid: h.hid, at: Math.round(h.s * 100) / 100, lat: Math.round(h.lat * 100) / 100, target: h.target ? h.target.info.id : null, by: r.info.id });
  }

  private netGone(h: Hazard) {
    const on = this.opts.online;
    if (on) on.net.send({ k: "gone", hid: h.hid });
  }

  private encode(b: KartBody): KartState {
    let f = 0;
    if (b.grounded) f |= KF.GROUNDED;
    if (b.boostTime > 0) f |= KF.BOOST;
    if (b.shieldTime > 0) f |= KF.SHIELD;
    if (b.rushTime > 0) f |= KF.RUSH;
    if (b.finished) f |= KF.FINISHED;
    if (b.spinTime > 0) f |= KF.SPIN;
    if (b.offroad) f |= KF.OFFROAD;
    const r2 = (n: number) => Math.round(n * 100) / 100, r3 = (n: number) => Math.round(n * 1000) / 1000;
    return [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z), r3(b.yaw), r2(b.speed), f, b.lap, r2(b.s), r3(b.pitch), r3(b.roll), r3(b.steerVis), b.driftDir, b.driftLevel, r3(b.spinYaw), b.coins];
  }

  private netState() {
    if (this.hud.phase === "intro" && !this.player.body.finished && this.raceTime === 0 && this.hud.countdown === 3 && this.t < 0.5) return {};
    return {
      st: this.encode(this.player.body),
      bots: this.racers.filter((r) => r.info.localBot).map((r) => ({ id: r.info.id, st: this.encode(r.body) })),
    };
  }

  private onNet(snap: RaceSnap) {
    const on = this.opts.online!;
    const t = on.net.serverToLocal(snap.now);
    for (const p of snap.ps) {
      const r = this.racers.find((x) => x.info.id === p.id);
      if (!r || !r.remote) continue;
      const last = r.samples[r.samples.length - 1];
      if (last && t <= last.t) continue;
      r.samples.push({ t, st: p.st });
      if (r.samples.length > 30) r.samples.shift();
    }
    if (snap.meta) {
      const ids = new Set(snap.meta.players.map((p) => p.id));
      for (const r of this.racers) if (r.remote && !ids.has(r.info.id)) r.model.root.visible = false;
    }
    for (const ev of snap.ev || []) {
      if (ev.s <= this.netSeq) continue;
      this.netSeq = ev.s;
      if (ev.k === "item") {
        if (this.hazards.some((h) => h.hid === ev.hid)) continue; // our own echo
        const owner = this.racers.find((x) => x.info.id === ev.by);
        if (!owner || !owner.remote) continue;
        const pos = this.track.point(ev.at, ev.lat, ev.kind === "slick" ? 0.05 : 1);
        const h = this.addHazard(ev.kind, owner, ev.at, ev.lat, pos, ev.hid);
        h.target = ev.target ? this.racers.find((x) => x.info.id === ev.target) || null : null;
        if (pos.distanceTo(this.player.body.pos) < 50) this.audio.throwItem();
      } else if (ev.k === "gone") {
        const h = this.hazards.find((x) => x.hid === ev.hid);
        if (h && !h.dead) { h.dead = true; this.scene.remove(h.mesh); this.splash(h.pos, h.kind === "slick" ? 0x9333ea : h.kind === "bomb" ? 0xec4899 : 0x60a5fa); }
      } else if (ev.k === "finish") {
        const r = this.racers.find((x) => x.info.id === ev.id);
        if (r && r.remote) { r.body.finished = true; r.body.finishTime = ev.time; }
      }
    }
    if (snap.results && !this.resultSent) {
      this.resultSent = true;
      const rows: RaceStandingRow[] = snap.results;
      const me = rows.find((x) => x.id === on.myId);
      const result: RaceResult = {
        place: me ? me.place : rows.length, time: me?.time || this.player.body.finishTime || this.raceTime, bestLap: this.player.bestLap, coins: me?.coins || 0, trackId: this.track.def.id,
        standings: rows.map((x) => ({ id: x.id, name: x.name, color: x.paint, isPlayer: x.id === on.myId, finished: x.finished, time: x.time, bestLap: 0, coins: x.coins })),
      };
      if (this.hud.phase !== "finished") this.emit({ phase: "finished" });
      this.emit({ result, standings: result.standings });
      this.opts.onFinish(result);
    }
  }

  private updateRemotes(dt: number) {
    const on = this.opts.online!;
    const renderT = Date.now() - on.net.interpDelay;
    for (const r of this.racers) {
      if (!r.remote) continue;
      const S = r.samples;
      if (!S.length) continue;
      while (S.length > 2 && S[1].t <= renderT) S.shift();
      let a = S[0], b = S[0], k = 0;
      if (S.length >= 2 && renderT >= S[0].t) { a = S[0]; b = S[1]; k = THREE.MathUtils.clamp((renderT - a.t) / Math.max(1, b.t - a.t), 0, 1.3); }
      const A = a.st, B = b.st;
      const teleport = Math.hypot(B[0] - A[0], B[2] - A[2]) > 25;
      const kk = teleport ? 1 : k;
      const lerp = (i: number) => A[i] + (B[i] - A[i]) * kk;
      const body = r.body;
      const nx = lerp(0), ny = lerp(1), nz = lerp(2);
      body.pos.set(nx, ny, nz);
      body.yaw = A[3] + Math.atan2(Math.sin(B[3] - A[3]), Math.cos(B[3] - A[3])) * kk;
      body.speed = lerp(4);
      const f = (kk < 0.5 ? A : B)[5];
      body.grounded = !!(f & KF.GROUNDED);
      body.boostTime = f & KF.BOOST ? 0.2 : 0;
      body.boostPower = f & KF.BOOST ? 1.35 : 1;
      body.shieldTime = f & KF.SHIELD ? 1 : 0;
      body.rushTime = f & KF.RUSH ? 1 : 0;
      body.spinTime = f & KF.SPIN ? 0.5 : 0;
      body.offroad = !!(f & KF.OFFROAD);
      body.finished = body.finished || !!(f & KF.FINISHED);
      body.lap = B[6];
      body.s = B[7];
      body.pitch = lerp(8); body.roll = lerp(9); body.steerVis = lerp(10);
      body.driftDir = B[11]; body.driftLevel = B[12]; body.spinYaw = lerp(13); body.coins = B[14];
      body.progress = (body.lap - 1) * this.track.length + body.s;
      const pr = this.track.project(nx, nz, body.hint);
      body.hint = pr.index; body.lat = pr.lat;
      body.vel.set(Math.sin(body.yaw) * body.speed, Math.cos(body.yaw) * body.speed);
    }
    void dt;
  }

  private pushHud() {
    const p = this.player, b = p.body;
    const order = this.sorted();
    const icons = Object.values(ITEM_INFO).map((i) => i.icon.slice(0, 2));
    this.emit({
      position: order.indexOf(p) + 1,
      total: this.racers.length,
      lap: Math.max(1, Math.min(this.laps, b.lap)),
      time: this.hud.phase === "racing" || this.hud.phase === "finished" ? (b.finished ? b.finishTime : this.raceTime) : 0,
      lapTimes: p.lapTimes.slice(),
      item: p.item, itemCount: p.itemCount,
      rolling: p.rollUntil > 0,
      rollIcon: p.rollUntil > 0 ? icons[Math.floor(this.t * 12) % icons.length] : "",
      coins: b.coins,
      kmh: Math.round(Math.abs(b.speed) * 3.6),
      driftLevel: b.driftDir ? b.driftLevel : 0,
      boosting: b.boostTime > 0 || b.rushTime > 0,
      wrongWay: b.wrongWay > 1.2,
      standings: order.map((r) => ({ id: r.info.id, name: r.info.name, color: r.info.look.paint, isPlayer: r.info.isPlayer, finished: r.body.finished, time: r.body.finishTime, bestLap: r.bestLap, coins: r.body.coins })),
      fps: Math.round(this.fps),
    });
    if (p.rollUntil > 0) this.audio.roulette();
  }

  private drawMinimap() {
    const cv = this.minimap;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width, H = cv.height, S = this.track.samples;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of S) { minX = Math.min(minX, s.p.x); maxX = Math.max(maxX, s.p.x); minZ = Math.min(minZ, s.p.z); maxZ = Math.max(maxZ, s.p.z); }
    const sc = Math.min((W - 16) / (maxX - minX), (H - 16) / (maxZ - minZ));
    const ox = (W - (maxX - minX) * sc) / 2, oz = (H - (maxZ - minZ) * sc) / 2;
    const X = (x: number) => ox + (x - minX) * sc, Z = (z: number) => oz + (z - minZ) * sc;
    if (!this.mapBase) {
      const base = document.createElement("canvas"); base.width = W; base.height = H;
      const b = base.getContext("2d")!;
      b.lineJoin = "round"; b.lineCap = "round";
      for (const [w, c] of [[9, "rgba(0,0,0,0.55)"], [5, "rgba(255,255,255,0.92)"]] as [number, string][]) {
        b.strokeStyle = c; b.lineWidth = w; b.beginPath();
        S.forEach((s, i) => (i ? b.lineTo(X(s.p.x), Z(s.p.z)) : b.moveTo(X(s.p.x), Z(s.p.z))));
        b.closePath(); b.stroke();
      }
      const st = S[0];
      b.fillStyle = "#111"; b.fillRect(X(st.p.x) - 4, Z(st.p.z) - 4, 8, 8);
      this.mapBase = base;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.mapBase, 0, 0);
    for (const r of [...this.racers].reverse()) {
      const isP = r === this.player;
      ctx.fillStyle = "#" + new THREE.Color(r.info.look.paint).getHexString();
      ctx.strokeStyle = isP ? "#fff" : "rgba(0,0,0,.7)";
      ctx.lineWidth = isP ? 2.5 : 1.5;
      ctx.beginPath(); ctx.arc(X(r.body.pos.x), Z(r.body.pos.z), isP ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  private resize = () => {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unlisten?.();
    if (this.opts.online) this.opts.online.net.getState = () => ({});
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.resize);
    this.audio.dispose();
    for (const r of this.racers) r.model.dispose();
    for (const h of this.hazards) this.scene.remove(h.mesh);
    Object.values(this.hazardGeo).forEach((g) => g.dispose());
    Object.values(this.hazardMat).forEach((m) => m.dispose());
    this.particles.dispose();
    this.built.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch { /* ignore */ }
    this.renderer.domElement.remove();
  }
}
