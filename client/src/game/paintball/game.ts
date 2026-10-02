// Prism Paintball — game engine: rendering, local player, remote interpolation, combat.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  PB, F, MAP, WEAPONS, clamp, wrapAngle, stepBody, raycastWorld, rayPlayer, pelletDirs, aimDir, lineOfSight,
  type Body, type Snapshot, type RoomMeta, type GameEvent, type Team, type V3, type PlayerMeta, type Phase,
} from "@shared/paintball";
import { World, type Quality } from "./world";
import { Character, disposeCharacterShared } from "./character";
import { Effects } from "./effects";
import { GameAudio } from "./audio";
import { NetClient } from "./net";
import { HudStore, type GameSettings, type FeedItem, type Toast } from "./hud";

interface Sample { t: number; x: number; y: number; z: number; yaw: number; pitch: number; flags: number; weapon: number; hp: number; vx: number; vy: number; vz: number }

interface Remote {
  id: number;
  meta: PlayerMeta;
  ch: Character;
  samples: Sample[];
  x: number; y: number; z: number; yaw: number; pitch: number;
  vx: number; vz: number; vy: number;
  flags: number; weapon: number; hp: number;
  shown: boolean;
  lastHitAt: number;
  visibleCheck: number;
  inSight: boolean;
}

interface QueuedEvent { at: number; ev: GameEvent }

export interface GameOptions {
  apiBase: string;
  token: string;
  myId: number;
  initial: Snapshot;
  settings: GameSettings;
  touch: boolean;
  onRoomEnded: (message: string) => void;
}

export interface DomBindings {
  crosshair?: HTMLElement | null;
  hitmarker?: HTMLElement | null;
  minimap?: HTMLCanvasElement | null;
  vignette?: HTMLElement | null;
}

const RESPAWN_MS = PB.RESPAWN_MS;
let toastId = 1;

function detectQuality(pref: GameSettings["quality"], touch: boolean): Quality {
  if (pref !== "auto") return pref;
  let gpu = "";
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
      gpu = name;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return "low";
      if (/mali|adreno|powervr|apple gpu/i.test(name) && touch) return "low";
    }
  } catch { /* ignore */ }
  if (touch) return "low";
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory || 8;
  const integrated = /intel|uhd|iris|hd graphics|vega [0-9]\b|radeon\(tm\) graphics/i.test(gpu);
  if ((cores <= 4 && integrated) || mem <= 2) return "low";
  if (cores <= 4 || mem <= 4 || integrated) return "medium";
  return "high";
}

export class PaintballGame {
  readonly store = new HudStore();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private world: World;
  private effects: Effects;
  private audio = new GameAudio();
  private net: NetClient;
  private quality: Quality;
  private settings: GameSettings;
  private raf = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private dom: DomBindings = {};

  // match state
  private meta: RoomMeta | null = null;
  private phase: Phase = "lobby";
  private phaseEndsLocal = 0;
  private scores: [number, number] = [0, 0];
  private processedSeq = 0;
  private queue: QueuedEvent[] = [];
  private remotes = new Map<number, Remote>();
  private feed: FeedItem[] = [];
  private toasts: Toast[] = [];
  private damage: { id: number; angle: number; t: number }[] = [];

  // local player
  private myId: number;
  private me: Character | null = null;
  private myTeam: Team = 0;
  private body: Body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, crouch: false };
  private yaw = Math.PI / 2;
  private pitch = 0;
  private life = -1;
  private alive = false;
  private hp = 100;
  private protectedUntil = 0;
  private respawnAt = 0;
  private deathPos = new THREE.Vector3();
  private killedBy: { name: string; team: Team; weapon: number } | null = null;
  private weapon = 0;
  private lastWeapon = 1;
  private ammo = WEAPONS.map((w) => w.mag);
  private reloadStart = 0;
  private reloadEnd = 0;
  private switchEnd = 0;
  private nextFire = 0;
  private shotId = 1;
  private bloomSpread = 0;
  private crouch = false;
  private ads = false;
  private adsBlend = 0;
  private sprinting = false;
  private sprintBlockUntil = 0;
  private streak = 0;
  private camShake = 0;
  private recoilPitch = 0;
  private eyeH = 1.58;
  private camDist = 3;
  private camShoulder = 0.6;
  private aimOnEnemy = false;
  private hitFlash = 0;
  private lastHudAt = 0;
  private lastMinimapAt = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;
  private slowFrames = 0;
  private fastFrames = 0;
  private pixelRatio = 1;
  private maxPixelRatio = 1;
  private triggerHeld = false;
  private triggerConsumed = false;
  private connection = { mode: "connecting" as "ws" | "http" | "connecting", ok: true, rtt: 0 };
  private countdownBeep = -1;
  private minimapBase: HTMLCanvasElement | null = null;
  private perfHintShown = false;

  // input
  private keys = new Set<string>();
  private locked = false;
  private touch: boolean;
  private touchMove = { x: 0, y: 0 };
  private touchFire = false;
  private wantJump = false;
  private ctrlCrouch = false;

  constructor(private container: HTMLElement, private opts: GameOptions) {
    this.myId = opts.myId;
    this.settings = { ...opts.settings };
    this.touch = opts.touch;

    this.quality = detectQuality(this.settings.quality, this.touch);
    const q = this.quality;
    // low quality renders straight to the canvas (MSAA there); otherwise MSAA happens in the composer target
    this.renderer = new THREE.WebGLRenderer({ antialias: q === "low", powerPreference: "high-performance", stencil: false });
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, q === "high" ? 2 : q === "medium" ? 1.5 : 1.25);
    this.pixelRatio = this.maxPixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = q !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 1500);
    this.world = new World(this.scene, this.renderer, q);
    this.world.batchStatic();
    this.effects = new Effects(this.scene, q);
    this.decoratePaint();

    if (q !== "low") {
      const size = new THREE.Vector2(); this.renderer.getDrawingBufferSize(size);
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q === "high" ? 4 : 2 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.88);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.effects.onLocalHit = (shotId, pellet, targetId, head, p) => {
      this.net.send({ k: "hit", id: shotId, i: pellet, tg: targetId, head: head ? 1 : 0, p });
      this.showHitmarker(head, false);
      this.audio.hitMarker(head);
      const r = this.remotes.get(targetId);
      if (r) { r.lastHitAt = performance.now(); r.ch.addPaint(new THREE.Vector3(p[0], p[1], p[2]), this.myTeam); }
    };
    this.effects.onBodyHit = (targetId, p, team) => {
      if (targetId === this.myId) return;
      const r = this.remotes.get(targetId);
      if (r) r.ch.addPaint(new THREE.Vector3(p[0], p[1], p[2]), team);
    };
    this.effects.onImpact = (p, local, player) => { if (!player || !local) this.audio.splat({ x: p[0], y: p[1], z: p[2] }, player); };

    this.net = new NetClient(opts.apiBase, opts.token, opts.initial.meta?.code || "", {
      onSnapshot: (s) => this.onSnapshot(s),
      onRoomEnded: (m) => opts.onRoomEnded(m),
      onConnection: (c) => { this.connection = c; },
    });
    this.net.getState = () => this.localState();
    this.processedSeq = opts.initial.seq;
    this.net.ingest(opts.initial);
    this.net.start(true);

    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost, false);
    this.store.set({ quality: q });
    // development-only handle for automated visual tests (stripped from production builds)
    if (import.meta.env.DEV) (window as unknown as { __pb?: PaintballGame }).__pb = this;
    this.clock.start();
    this.loop();
  }

  // ===========================================================================
  // Public API for the React layer
  // ===========================================================================

  bind(dom: DomBindings) { this.dom = { ...this.dom, ...dom }; }

  setSettings(s: GameSettings) {
    this.settings = { ...s };
    this.audio.setVolume(s.volume);
  }

  requestLock() {
    this.audio.unlock();
    if (this.touch) return;
    const el = this.renderer.domElement as HTMLCanvasElement & { requestPointerLock?: (o?: unknown) => Promise<void> | void };
    try {
      const r = el.requestPointerLock?.({ unadjustedMovement: true } as unknown);
      if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => { try { el.requestPointerLock?.(); } catch { /* ignore */ } });
    } catch { try { el.requestPointerLock?.(); } catch { /* ignore */ } }
  }

  releaseLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ } }

  touchSetMove(x: number, y: number) { this.touchMove.x = clamp(x, -1, 1); this.touchMove.y = clamp(y, -1, 1); }
  touchLook(dx: number, dy: number) { this.applyLook(dx * 2.2, dy * 2.2); }
  touchSetFire(v: boolean) { this.touchFire = v; this.audio.unlock(); }
  touchJump() { this.wantJump = true; this.audio.unlock(); }
  touchReload() { this.startReload(); }
  touchToggleAds() { this.ads = !this.ads; }
  touchToggleCrouch() { this.crouch = !this.crouch; }
  selectWeapon(i: number) { this.switchWeapon(i); }

  // ===========================================================================
  // Input
  // ===========================================================================

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.renderer.domElement.addEventListener("wheel", this.onWheel, { passive: false });
    this.renderer.domElement.addEventListener("contextmenu", this.prevent);
  }

  private unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.renderer.domElement.removeEventListener("wheel", this.onWheel);
    this.renderer.domElement.removeEventListener("contextmenu", this.prevent);
  }

  private prevent = (e: Event) => e.preventDefault();

  private onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const k = e.code;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    if (k === "Space") this.wantJump = true;
    else if (k === "KeyC") this.crouch = !this.crouch;
    else if (k === "ControlLeft" || k === "ControlRight") this.ctrlCrouch = true;
    else if (k === "KeyR") this.startReload();
    else if (k === "Digit1") this.switchWeapon(0);
    else if (k === "Digit2") this.switchWeapon(1);
    else if (k === "Digit3") this.switchWeapon(2);
    else if (k === "KeyQ") this.switchWeapon(this.lastWeapon);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "ControlLeft" || e.code === "ControlRight") this.ctrlCrouch = false;
  };
  private onBlur = () => { this.keys.clear(); this.triggerHeld = false; this.ads = false; this.ctrlCrouch = false; };
  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.renderer.domElement;
    if (!this.locked) { this.triggerHeld = false; this.ads = false; this.keys.clear(); }
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    // ignore absurd spikes some browsers emit when locking
    if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
    this.applyLook(e.movementX, e.movementY);
  };
  private onMouseDown = (e: MouseEvent) => {
    this.audio.unlock();
    if (!this.locked && !this.touch) { this.requestLock(); return; }
    if (e.button === 0) { this.triggerHeld = true; this.triggerConsumed = false; }
    if (e.button === 2) this.ads = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.triggerHeld = false;
    if (e.button === 2) this.ads = false;
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!this.locked) return;
    this.switchWeapon((this.weapon + (e.deltaY > 0 ? 1 : WEAPONS.length - 1)) % WEAPONS.length);
  };

  private applyLook(dx: number, dy: number) {
    if (!this.alive || this.phase === "finished") return;
    const w = WEAPONS[this.weapon];
    const zoom = 1 + (w.zoom - 1) * this.adsBlend;
    let sens = 0.0022 * this.settings.sensitivity / zoom;
    if (this.touch && this.aimOnEnemy) sens *= 0.6;
    this.yaw = wrapAngle(this.yaw - dx * sens);
    this.pitch = clamp(this.pitch - dy * sens * (this.settings.invertY ? -1 : 1), -1.3, 1.3);
  }

  // ===========================================================================
  // Weapons
  // ===========================================================================

  private switchWeapon(i: number) {
    if (i === this.weapon || i < 0 || i >= WEAPONS.length || !this.alive) return;
    this.lastWeapon = this.weapon;
    this.weapon = i;
    this.reloadEnd = 0;
    this.switchEnd = performance.now() + 320;
    this.audio.swap();
  }

  private startReload() {
    const w = WEAPONS[this.weapon];
    const now = performance.now();
    if (!this.alive || this.ammo[this.weapon] >= w.mag || this.reloadEnd > now) return;
    this.reloadStart = now;
    this.reloadEnd = now + w.reload;
    this.me?.startReload();
    this.audio.reload(this.weapon);
  }

  private tryFire(now: number) {
    const w = WEAPONS[this.weapon];
    const trigger = this.triggerHeld || this.touchFire;
    if (!trigger) { this.triggerConsumed = false; return; }
    if (!w.auto && this.triggerConsumed) return;
    if (!this.alive || this.phase !== "playing" || now < this.switchEnd || now < this.nextFire) return;
    if (this.reloadEnd > now) return;
    if (this.ammo[this.weapon] <= 0) {
      this.triggerConsumed = true;
      this.audio.empty();
      this.startReload();
      this.nextFire = now + 250;
      return;
    }
    this.triggerConsumed = true;
    this.nextFire = now + w.interval;
    this.ammo[this.weapon]--;
    this.sprintBlockUntil = now + 380;

    const muzzle = this.me ? this.me.muzzleWorld.clone() : new THREE.Vector3(this.body.x, this.body.y + 1.4, this.body.z);
    const cam = this.camera.position;
    const fwd = aimDir(this.yaw, this.pitch);
    // find what the crosshair is on
    const target = this.crosshairTarget(cam, fwd, 260);
    const aim = new THREE.Vector3(cam.x + fwd[0] * target.t, cam.y + fwd[1] * target.t, cam.z + fwd[2] * target.t);
    let dir = aim.clone().sub(muzzle);
    // if the muzzle is behind the camera's target point or blocked very close, shoot straight
    if (dir.length() < 1.2 || dir.dot(new THREE.Vector3(fwd[0], fwd[1], fwd[2])) <= 0) dir = new THREE.Vector3(fwd[0], fwd[1], fwd[2]);
    dir.normalize();
    // compensate for drop toward the aim point
    const dist = aim.distanceTo(muzzle);
    const tFlight = dist / w.speed;
    const drop = 0.5 * w.grav * tFlight * tFlight;
    if (dist > 2) { dir.multiplyScalar(dist).add(new THREE.Vector3(0, drop * 0.85, 0)).normalize(); }

    const speed = Math.hypot(this.body.vx, this.body.vz);
    let spread = (this.adsBlend > 0.6 ? w.adsSpread : w.spread) + w.moveSpread * clamp(speed / PB.SPRINT_SPEED, 0, 1) + this.bloomSpread;
    if (!this.body.grounded) spread += 0.03;
    if (this.crouch && this.body.grounded) spread *= 0.7;
    const seed = (Math.random() * 2 ** 31) >>> 0 || 1;
    const d: V3 = [dir.x, dir.y, dir.z];
    const o: V3 = [muzzle.x, muzzle.y, muzzle.z];
    const dirs = pelletDirs(d, spread, w.pellets, seed);
    const id = this.shotId++;
    this.effects.fire(o, dirs, w, this.myTeam, this.myId, true, id);
    this.net.send({ k: "fire", id, w: this.weapon, o, d, sp: Math.round(spread * 1000) / 1000, seed });
    this.audio.shoot(this.weapon, null);
    this.me?.kick(this.weapon);
    this.recoilPitch += w.recoil * (0.7 + Math.random() * 0.5);
    this.yaw += (Math.random() - 0.5) * w.recoil * 0.4;
    this.camShake = Math.min(1, this.camShake + (this.weapon === 0 ? 0.08 : 0.25));
    if (this.weapon === 0) this.bloomSpread = Math.min(0.022, this.bloomSpread + 0.0032);
    this.protectedUntil = 0;
    if (this.ammo[this.weapon] <= 0) window.setTimeout(() => { if (!this.disposed && this.ammo[this.weapon] <= 0) this.startReload(); }, 260);
  }

  /** Distance along the camera ray to whatever the crosshair is on. */
  private crosshairTarget(cam: THREE.Vector3, fwd: V3, maxT: number): { t: number; enemy: Remote | null } {
    // start the ray level with the player so walls behind the camera never count
    const startT = Math.max(0, this.camDist - 0.3);
    const sx = cam.x + fwd[0] * startT, sy = cam.y + fwd[1] * startT, sz = cam.z + fwd[2] * startT;
    const wh = raycastWorld(sx, sy, sz, fwd[0], fwd[1], fwd[2], maxT);
    let t = wh ? wh.t + startT : maxT;
    let enemy: Remote | null = null;
    this.remotes.forEach((r) => {
      if (!r.shown || !(r.flags & F.ALIVE)) return;
      const h = rayPlayer(cam.x, cam.y, cam.z, fwd[0], fwd[1], fwd[2], t, r.x, r.y, r.z, !!(r.flags & F.CROUCH));
      if (h && h.t >= startT && h.t < t) { t = h.t; enemy = r.meta.team !== this.myTeam ? r : null; }
    });
    return { t, enemy };
  }

  // ===========================================================================
  // Networking
  // ===========================================================================

  private localState(): { life: number; st?: number[] } {
    if (!this.alive) return { life: this.life };
    const b = this.body;
    let flags = 0;
    if (b.grounded) flags |= F.GROUNDED;
    if (this.sprinting) flags |= F.SPRINT;
    if (this.adsBlend > 0.5) flags |= F.ADS;
    if (b.crouch) flags |= F.CROUCH;
    if (this.reloadEnd > performance.now()) flags |= F.RELOAD;
    const r = (n: number) => Math.round(n * 100) / 100;
    return { life: this.life, st: [r(b.x), r(b.y), r(b.z), Math.round(this.yaw * 1000) / 1000, Math.round(this.pitch * 1000) / 1000, flags, this.weapon, r(b.vx), r(b.vy), r(b.vz)] };
  }

  private nameOf(id: number) { return this.meta?.players.find((p) => p.id === id)?.name || "Player"; }
  private teamOf(id: number): Team { return (this.meta?.players.find((p) => p.id === id)?.team ?? 0) as Team; }

  private onSnapshot(s: Snapshot) {
    const nowLocal = Date.now();
    if (s.meta) this.applyMeta(s.meta);
    if (s.phase !== this.phase) this.onPhase(s.phase, this.phase);
    this.phase = s.phase;
    this.phaseEndsLocal = s.phaseEnds ? this.net.serverToLocal(s.phaseEnds) : 0;
    if (s.scores[0] !== this.scores[0] || s.scores[1] !== this.scores[1]) this.audio.crowdCheer();
    this.scores = [s.scores[0], s.scores[1]];
    const sampleT = this.net.serverToLocal(s.now);

    let myAlive = false;
    for (const ps of s.ps) {
      const id = ps[0];
      if (id === this.myId) {
        this.hp = ps[8];
        const aliveNow = !!(ps[6] & F.ALIVE);
        myAlive = aliveNow;
        if (ps[6] & F.PROTECTED) this.protectedUntil = performance.now() + 250; else if (this.protectedUntil > performance.now() + 300) this.protectedUntil = 0;
        if (!aliveNow && this.alive) this.die(null);
        continue;
      }
      const r = this.remotes.get(id);
      if (!r) continue;
      const smp: Sample = { t: sampleT, x: ps[1], y: ps[2], z: ps[3], yaw: ps[4], pitch: ps[5], flags: ps[6], weapon: ps[7], hp: ps[8], vx: ps[9], vy: ps[10], vz: ps[11] };
      const last = r.samples[r.samples.length - 1];
      if (last && smp.t <= last.t) continue;
      r.samples.push(smp);
      if (r.samples.length > 30) r.samples.shift();
    }

    if (s.you) {
      if (s.you.life !== this.life && myAlive) {
        this.life = s.you.life;
        this.respawn(s.you.x, s.you.y, s.you.z, s.you.yaw);
      } else if (s.you.life !== this.life) {
        this.life = s.you.life;
      } else if (s.you.fix) {
        this.body.x = s.you.x; this.body.y = s.you.y; this.body.z = s.you.z; this.body.vx = this.body.vy = this.body.vz = 0;
      }
    }

    if (s.ev) {
      const playAt = sampleT + this.net.interpDelay - 20;
      for (const ev of s.ev) {
        if (ev.s <= this.processedSeq) continue;
        this.processedSeq = ev.s;
        this.handleEventNow(ev, playAt);
      }
    }
    void nowLocal;
  }

  private applyMeta(meta: RoomMeta) {
    this.meta = meta;
    const mine = meta.players.find((p) => p.id === this.myId);
    if (mine && mine.team !== this.myTeam) {
      this.myTeam = mine.team;
      this.rebuildMe();
      this.remotes.forEach((r) => this.rebuildRemote(r));
    }
    if (!this.me && mine) this.rebuildMe();
    // add / update / remove remote characters
    const seen = new Set<number>();
    meta.players.forEach((p, idx) => {
      if (p.id === this.myId) return;
      seen.add(p.id);
      const r = this.remotes.get(p.id);
      if (!r) {
        const ch = this.makeCharacter(p, idx);
        this.remotes.set(p.id, { id: p.id, meta: p, ch, samples: [], x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, vy: 0, flags: 0, weapon: 0, hp: 100, shown: false, lastHitAt: 0, visibleCheck: 0, inSight: false });
      } else if (r.meta.team !== p.team || r.meta.name !== p.name) {
        r.meta = p;
        this.rebuildRemote(r);
      } else r.meta = p;
    });
    Array.from(this.remotes.keys()).forEach((id) => {
      if (!seen.has(id)) { const r = this.remotes.get(id)!; r.ch.dispose(); this.remotes.delete(id); }
    });
  }

  private makeCharacter(p: PlayerMeta, idx: number) {
    const mate = p.team === this.myTeam;
    const ch = new Character({ team: p.team, look: p.look, name: p.name, number: ((Math.abs(p.id) % 89) + 10 + idx) % 100, showTag: true, isMate: mate, castShadow: this.quality !== "low" });
    ch.root.visible = false;
    ch.onStep = (x, y, z, loud) => this.audio.footstep({ x, y, z }, loud);
    ch.onLand = (x, y, z) => this.audio.land({ x, y, z });
    this.scene.add(ch.root);
    return ch;
  }

  private rebuildRemote(r: Remote) {
    r.ch.dispose();
    r.ch = this.makeCharacter(r.meta, 0);
  }

  private rebuildMe() {
    const meta = this.meta?.players.find((p) => p.id === this.myId);
    if (!meta) return;
    this.me?.dispose();
    this.me = new Character({ team: meta.team, look: meta.look, name: meta.name, number: (Math.abs(meta.id) % 89) + 10, showTag: false, isMate: true, castShadow: this.quality !== "low" });
    this.me.onStep = (_x, _y, _z, loud) => this.audio.footstep(null, loud);
    this.me.onLand = () => this.audio.land(null);
    this.me.setWeapon(this.weapon, true);
    this.scene.add(this.me.root);
  }

  private onPhase(next: Phase, prev: Phase) {
    if (next === "countdown") {
      this.effects.clearBalls();
      this.feed = []; this.toasts = [];
      this.countdownBeep = -1;
    }
    if (next === "playing" && prev === "countdown") { this.audio.beep(true); this.pushToast("GO! Splat the other team", "streak"); }
    if (next === "finished") {
      const w = this.meta?.winner;
      this.audio.stinger(w === -1 || w === null || w === undefined ? null : w === this.myTeam);
      this.releaseLock();
    }
  }

  private handleEventNow(ev: GameEvent, playAt: number) {
    const me = this.myId;
    if (ev.k === "shot") {
      if (ev.by !== me) this.queue.push({ at: playAt, ev });
    } else if (ev.k === "hit") {
      if (ev.tg === me) {
        this.hp = ev.hp;
        const r = this.remotes.get(ev.by);
        const ang = r ? Math.atan2(r.x - this.body.x, r.z - this.body.z) - this.yaw : 0;
        this.damage.push({ id: toastId++, angle: wrapAngle(ang), t: performance.now() });
        this.hitFlash = 1;
        this.camShake = Math.min(1, this.camShake + 0.35);
        this.audio.hurt();
        this.me?.addPaint(new THREE.Vector3(ev.p[0], ev.p[1], ev.p[2]), this.teamOf(ev.by));
      } else if (ev.by !== me) {
        this.queue.push({ at: playAt, ev });
      }
    } else if (ev.k === "ko") {
      const item: FeedItem = { id: toastId++, killer: this.nameOf(ev.by), kTeam: this.teamOf(ev.by), victim: this.nameOf(ev.tg), vTeam: this.teamOf(ev.tg), weapon: ev.w, head: !!ev.head, mine: ev.by === me || ev.tg === me, t: performance.now() };
      this.feed = [...this.feed, item].slice(-6);
      if (ev.by === me) {
        this.streak = ev.streak;
        this.showHitmarker(!!ev.head, true);
        this.audio.elimination();
        const msg = ev.streak >= 5 ? `UNSTOPPABLE! ${ev.streak} splat streak` : ev.streak === 4 ? "QUAD SPLAT!" : ev.streak === 3 ? "TRIPLE SPLAT!" : ev.streak === 2 ? "DOUBLE SPLAT!" : `Splatted ${item.victim}${ev.head ? " — headshot!" : ""}`;
        this.pushToast(msg, ev.streak >= 2 ? "streak" : "splat");
      }
      if (ev.tg === me) {
        this.killedBy = { name: item.killer, team: item.kTeam, weapon: ev.w };
        this.die(this.killedBy);
      } else {
        this.queue.push({ at: playAt, ev });
      }
    } else if (ev.k === "info") {
      this.pushToast(ev.text, "info");
    }
  }

  private playEvent(ev: GameEvent) {
    if (ev.k === "shot") {
      const w = WEAPONS[ev.w];
      if (!w) return;
      const r = this.remotes.get(ev.by);
      const team = r ? r.meta.team : this.teamOf(ev.by);
      const dirs = pelletDirs(ev.d, ev.sp, w.pellets, ev.seed);
      // start from the rendered muzzle so the ball visibly leaves the marker
      let o: V3 = ev.o;
      if (r && r.shown) { const m = r.ch.muzzleWorld; if (m.distanceTo(new THREE.Vector3(ev.o[0], ev.o[1], ev.o[2])) < 2.5) o = [m.x, m.y, m.z]; }
      this.effects.fire(o, dirs, w, team, ev.by, false, 0);
      r?.ch.kick(ev.w);
      this.audio.shoot(ev.w, { x: o[0], y: o[1], z: o[2] });
    } else if (ev.k === "hit") {
      const r = this.remotes.get(ev.tg);
      if (r) r.ch.addPaint(new THREE.Vector3(ev.p[0], ev.p[1], ev.p[2]), this.teamOf(ev.by));
    } else if (ev.k === "ko") {
      const r = this.remotes.get(ev.tg);
      if (r) this.effects.elimination(r.x, r.y, r.z, this.teamOf(ev.by));
    }
  }

  private pushToast(text: string, kind: Toast["kind"]) {
    this.toasts = [...this.toasts, { id: toastId++, text, kind, t: performance.now() }].slice(-4);
  }

  private die(by: { name: string; team: Team; weapon: number } | null) {
    if (!this.alive) return;
    this.alive = false;
    this.respawnAt = performance.now() + RESPAWN_MS;
    this.deathPos.set(this.body.x, this.body.y, this.body.z);
    if (by) this.killedBy = by;
    this.streak = 0;
    this.triggerHeld = false;
    this.ads = false;
    this.reloadEnd = 0;
    this.effects.elimination(this.body.x, this.body.y, this.body.z, by ? by.team : (this.myTeam === 0 ? 1 : 0));
    this.audio.splatted();
  }

  private respawn(x: number, y: number, z: number, yaw: number) {
    this.body = { x, y, z, vx: 0, vy: 0, vz: 0, grounded: true, crouch: false };
    this.yaw = yaw; this.pitch = 0;
    this.alive = true;
    this.hp = PB.MAX_HP;
    this.ammo = WEAPONS.map((w) => w.mag);
    this.reloadEnd = 0;
    this.crouch = false;
    this.killedBy = null;
    this.protectedUntil = performance.now() + PB.SPAWN_PROTECT_MS;
    this.me?.clearPaint();
  }

  // ===========================================================================
  // Frame loop
  // ===========================================================================

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.elapsed += dt;
    try {
      this.frame(dt);
    } catch (err) {
      console.error("[paintball] frame error", err);
    }
  };

  private frame(dt: number) {
    const now = performance.now();
    const nowLocal = Date.now();
    // play queued network events whose time has come
    if (this.queue.length) {
      const due = this.queue.filter((q) => q.at <= nowLocal);
      if (due.length) { this.queue = this.queue.filter((q) => q.at > nowLocal); due.forEach((q) => this.playEvent(q.ev)); }
      if (this.queue.length > 400) this.queue.splice(0, this.queue.length - 400);
    }

    this.updateLocal(dt, now);
    this.updateRemotes(dt, nowLocal, now);
    this.updateCamera(dt, now);

    // effects need everyone's rendered bodies for hit tests
    const bodies = [] as { id: number; team: number; x: number; y: number; z: number; crouch: boolean; alive: boolean }[];
    this.remotes.forEach((r) => { if (r.shown) bodies.push({ id: r.id, team: r.meta.team, x: r.x, y: r.y, z: r.z, crouch: !!(r.flags & F.CROUCH), alive: !!(r.flags & F.ALIVE) }); });
    if (this.alive) bodies.push({ id: this.myId, team: this.myTeam, x: this.body.x, y: this.body.y, z: this.body.z, crouch: this.body.crouch, alive: true });
    this.effects.update(dt, bodies);

    this.world.update(dt, this.elapsed);
    this.world.focusShadows(this.camera.position.x + Math.sin(this.yaw) * 12, this.camera.position.z + Math.cos(this.yaw) * 12);
    if (now - this.lastHudAt > 250) {
      const secs = Math.max(0, Math.ceil((this.phaseEndsLocal - nowLocal) / 1000));
      this.world.setScoreboard(this.scores, this.phase === "playing" ? secs : 0, this.phase === "playing" ? "FIRST TO " + PB.SCORE_TO_WIN : this.phase === "countdown" ? "GET READY" : this.phase === "finished" ? "FINAL" : "WARM UP");
    }
    this.audio.setListener({ x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z }, this.yaw);

    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);

    this.updatePerf(dt);
    this.updateDom(now);
    if (now - this.lastHudAt > 90) { this.lastHudAt = now; this.pushHud(now, nowLocal); }
    if (now - this.lastMinimapAt > 120) { this.lastMinimapAt = now; this.drawMinimap(); }
  }

  private updateLocal(dt: number, now: number) {
    const w = WEAPONS[this.weapon];
    const playing = this.phase === "playing";
    const canMove = this.alive && playing;
    // countdown beeps
    if (this.phase === "countdown") {
      const left = Math.ceil((this.phaseEndsLocal - Date.now()) / 1000);
      if (left !== this.countdownBeep && left > 0 && left <= 3) { this.countdownBeep = left; this.audio.beep(false); }
    }
    let f = 0, r = 0;
    if (this.locked || this.touch) {
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) f += 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) f -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) r += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) r -= 1;
    }
    if (this.touch) { f += -this.touchMove.y; r += this.touchMove.x; }
    const mag = Math.min(1, Math.hypot(f, r));
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    let wx = 0, wz = 0;
    if (mag > 0.05) { const l = Math.hypot(f, r); wx = ((fx * f + rx * r) / l) * mag; wz = ((fz * f + rz * r) / l) * mag; }
    const crouching = (this.crouch || this.ctrlCrouch) && this.body.grounded;
    const wantsSprint = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || (this.touch && Math.hypot(this.touchMove.x, this.touchMove.y) > 0.93 && this.touchMove.y < -0.5)) && f > 0.3 && !crouching && this.adsBlend < 0.3 && now > this.sprintBlockUntil;
    this.sprinting = canMove && wantsSprint && mag > 0.1;
    if (this.sprinting && this.crouch) this.crouch = false;
    if (this.sprinting) this.ads = this.touch ? this.ads : false;
    this.adsBlend += ((this.ads && this.alive && !this.sprinting ? 1 : 0) - this.adsBlend) * (1 - Math.exp(-dt * 14));
    let speed: number = PB.WALK_SPEED;
    if (this.sprinting) speed = PB.SPRINT_SPEED; else if (crouching) speed = PB.CROUCH_SPEED; else if (this.adsBlend > 0.5) speed = PB.ADS_SPEED;
    if (!canMove) { wx = 0; wz = 0; }

    if (this.alive) {
      this.body.crouch = crouching;
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const jump = this.wantJump && canMove;
      for (let i = 0; i < steps; i++) {
        const res = stepBody(this.body, { wx, wz, speed, jump: jump && i === 0 }, dt / steps);
        if (res.jumped) this.audio.jump();
      }
      // fell out somehow: put back on the field
      if (this.body.y < -5) { this.body.y = 2; this.body.vy = 0; }
    }
    this.wantJump = false;

    // reload completion
    if (this.reloadEnd && now >= this.reloadEnd) { this.ammo[this.weapon] = w.mag; this.reloadEnd = 0; }
    this.bloomSpread = Math.max(0, this.bloomSpread - dt * 0.045);
    this.recoilPitch *= Math.exp(-dt * 10);
    this.tryFire(now);

    // recoil recovery is applied on top of the aim
    if (this.recoilPitch > 0.0001) { const k = this.recoilPitch * Math.min(1, dt * 14); this.pitch = clamp(this.pitch + k * 0.9, -1.3, 1.3); }

    // animate my character
    if (this.me) {
      const reloading = this.reloadEnd > now;
      const showMe = this.alive || now < this.respawnAt;
      this.me.root.visible = showMe;
      const px = this.alive ? this.body.x : this.deathPos.x, py = this.alive ? this.body.y : this.deathPos.y, pz = this.alive ? this.body.z : this.deathPos.z;
      this.me.update(dt, px, py, pz, {
        vx: this.alive ? this.body.vx : 0, vz: this.alive ? this.body.vz : 0, vy: this.body.vy,
        aimYaw: this.yaw, aimPitch: this.pitch, grounded: this.body.grounded || !this.alive,
        crouch: this.body.crouch, ads: this.adsBlend > 0.5, sprint: this.sprinting, reloading,
        alive: this.alive, protected: this.protectedUntil > now, weapon: this.weapon,
      });
    }
  }

  private updateRemotes(dt: number, nowLocal: number, now: number) {
    const renderT = nowLocal - this.net.interpDelay;
    const camPos = this.camera.position;
    const fwd = aimDir(this.yaw, this.pitch);
    const target = this.alive ? this.crosshairTarget(camPos, fwd, 200) : { t: 0, enemy: null as Remote | null };
    this.aimOnEnemy = !!target.enemy;
    this.remotes.forEach((r) => {
      const S = r.samples;
      if (!S.length) { r.ch.root.visible = false; r.shown = false; return; }
      // drop samples we no longer need
      while (S.length > 2 && S[1].t <= renderT) S.shift();
      let a = S[0], b = S[0], t = 0;
      if (S.length >= 2 && renderT >= S[0].t) {
        a = S[0]; b = S[1]; t = clamp((renderT - a.t) / Math.max(1, b.t - a.t), 0, 1.4);
      } else if (renderT < S[0].t) { a = b = S[0]; t = 0; }
      let x: number, y: number, z: number, yaw: number, pitch: number;
      const teleport = Math.hypot(b.x - a.x, b.z - a.z) > 4;
      if (teleport || a === b) {
        const s = t >= 0.5 || a === b ? b : a;
        x = s.x; y = s.y; z = s.z; yaw = s.yaw; pitch = s.pitch;
        if (t > 1 && a === b) { const ex = Math.min(0.2, (renderT - b.t) / 1000); x += b.vx * ex; z += b.vz * ex; }
      } else {
        const tt = Math.min(t, 1), ext = Math.max(0, t - 1) * ((b.t - a.t) / 1000);
        x = a.x + (b.x - a.x) * tt + b.vx * Math.min(ext, 0.2);
        y = a.y + (b.y - a.y) * tt;
        z = a.z + (b.z - a.z) * tt + b.vz * Math.min(ext, 0.2);
        yaw = a.yaw + wrapAngle(b.yaw - a.yaw) * tt;
        pitch = a.pitch + (b.pitch - a.pitch) * tt;
      }
      const src = t >= 0.5 ? b : a;
      const flags = src.flags;
      const alive = !!(flags & F.ALIVE);
      // velocity from rendered motion so feet match exactly what you see
      if (r.shown && !teleport && dt > 0) {
        const k = 1 - Math.exp(-dt * 14);
        const ivx = (x - r.x) / dt, ivz = (z - r.z) / dt, ivy = (y - r.y) / dt;
        if (Math.hypot(ivx, ivz) < 15) { r.vx += (ivx - r.vx) * k; r.vz += (ivz - r.vz) * k; r.vy += (ivy - r.vy) * k; }
      } else { r.vx = src.vx; r.vz = src.vz; r.vy = src.vy; }
      const wasAlive = !!(r.flags & F.ALIVE);
      r.x = x; r.y = y; r.z = z; r.yaw = yaw; r.pitch = pitch; r.flags = flags; r.weapon = src.weapon; r.hp = src.hp;
      if (!wasAlive && alive) { r.vx = r.vz = r.vy = 0; }
      r.shown = true;
      // name tags: teammates always, enemies when aimed at or recently hit
      const mate = r.meta.team === this.myTeam;
      const aimed = target.enemy === r;
      r.ch.setTagVisible(alive && (mate || aimed || now - r.lastHitAt < 2500));
      r.ch.update(dt, x, y, z, {
        vx: r.vx, vz: r.vz, vy: r.vy, aimYaw: yaw, aimPitch: pitch,
        grounded: !!(flags & F.GROUNDED), crouch: !!(flags & F.CROUCH), ads: !!(flags & F.ADS), sprint: !!(flags & F.SPRINT),
        reloading: !!(flags & F.RELOAD), alive, protected: !!(flags & F.PROTECTED), weapon: r.weapon,
      });
      // enemy minimap visibility
      if (now > r.visibleCheck) {
        r.visibleCheck = now + 250 + Math.random() * 100;
        r.inSight = alive && !mate && this.alive && lineOfSight(camPos.x, camPos.y, camPos.z, x, y + 1.3, z);
      }
    });
  }

  private updateCamera(dt: number, now: number) {
    const w = WEAPONS[this.weapon];
    const cam = this.camera;
    const k = (r: number) => 1 - Math.exp(-dt * r);
    let px: number, py: number, pz: number;
    if (this.alive) {
      this.eyeH += ((this.body.crouch ? 1.12 : 1.58) - this.eyeH) * k(12);
      px = this.body.x; py = this.body.y + this.eyeH; pz = this.body.z;
    } else {
      // slow orbit around where we were splatted
      px = this.deathPos.x; py = this.deathPos.y + 1.4; pz = this.deathPos.z;
      this.yaw = wrapAngle(this.yaw + dt * 0.35);
      this.pitch += (-0.35 - this.pitch) * k(2);
    }
    const scoped = this.weapon === 2 && this.adsBlend > 0.85 && this.alive;
    const wantDist = !this.alive ? 5.2 : scoped ? 0.05 : 3.0 - this.adsBlend * 1.45 + (this.sprinting ? 0.25 : 0);
    const wantShoulder = !this.alive ? 0 : scoped ? 0.18 : 0.62 - this.adsBlend * 0.18;
    this.camDist += (wantDist - this.camDist) * k(12);
    this.camShoulder += (wantShoulder - this.camShoulder) * k(12);
    const fwd = aimDir(this.yaw, this.pitch);
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    const pivot = new THREE.Vector3(px + rx * this.camShoulder, py + 0.12, pz + rz * this.camShoulder);
    // camera collision
    let dist = this.camDist;
    const back: V3 = [-fwd[0], -fwd[1], -fwd[2]];
    const hit = raycastWorld(px, py + 0.12, pz, pivot.x - px - fwd[0] * dist, pivot.y - (py + 0.12) - fwd[1] * dist, pivot.z - pz - fwd[2] * dist, 1);
    if (hit) dist = Math.max(0.2, dist * hit.t - 0.25);
    let cx = pivot.x + back[0] * dist, cy = pivot.y + back[1] * dist, cz = pivot.z + back[2] * dist;
    if (cy < 0.25) cy = 0.25;
    // shake
    this.camShake = Math.max(0, this.camShake - dt * 3);
    const sh = this.camShake * this.camShake * 0.06;
    cx += (Math.random() - 0.5) * sh; cy += (Math.random() - 0.5) * sh; cz += (Math.random() - 0.5) * sh;
    // sprint bob
    if (this.sprinting && this.body.grounded) cy += Math.sin(this.elapsed * 15) * 0.025;
    cam.position.set(cx, cy, cz);
    cam.lookAt(cx + fwd[0], cy + fwd[1], cz + fwd[2]);
    if (import.meta.env.DEV) {
      // development-only camera override for automated visual tests
      const dbg = (window as unknown as { __pbCam?: number[] }).__pbCam;
      if (dbg) {
        const ox = dbg[6] ? this.body.x : 0, oy = dbg[6] ? this.body.y : 0, oz = dbg[6] ? this.body.z : 0;
        cam.position.set(dbg[0] + ox, dbg[1] + oy, dbg[2] + oz); cam.lookAt(dbg[3] + ox, dbg[4] + oy, dbg[5] + oz);
        if (this.me) this.me.root.visible = true;
      }
    }
    const zoom = 1 + (w.zoom - 1) * this.adsBlend;
    const fov = 74 / zoom + (this.sprinting ? 4 : 0);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * k(16); cam.updateProjectionMatrix(); }
    // hide my character when the camera is inside it
    if (this.me) this.me.root.visible = this.me.root.visible && dist > 0.75 && !scoped;
    void now;
  }

  // ===========================================================================
  // HUD / DOM
  // ===========================================================================

  private hitmarkerTimer = 0;
  private showHitmarker(head: boolean, kill: boolean) {
    const el = this.dom.hitmarker;
    if (!el) return;
    el.dataset.kind = kill ? "kill" : head ? "head" : "hit";
    el.classList.remove("pb-hit-on");
    void el.offsetWidth;
    el.classList.add("pb-hit-on");
    window.clearTimeout(this.hitmarkerTimer);
    this.hitmarkerTimer = window.setTimeout(() => el.classList.remove("pb-hit-on"), kill ? 520 : 240);
  }

  private updateDom(now: number) {
    const ch = this.dom.crosshair;
    if (ch) {
      const w = WEAPONS[this.weapon];
      const speed = Math.hypot(this.body.vx, this.body.vz);
      const spread = (this.adsBlend > 0.6 ? w.adsSpread : w.spread) + w.moveSpread * clamp(speed / PB.SPRINT_SPEED, 0, 1) + this.bloomSpread + (this.body.grounded ? 0 : 0.03);
      const px = (spread / Math.tan((this.camera.fov * Math.PI) / 360)) * (this.container.clientHeight / 2);
      ch.style.setProperty("--spread", Math.max(3, px).toFixed(1) + "px");
      ch.dataset.enemy = this.aimOnEnemy ? "1" : "0";
      ch.style.opacity = !this.alive || this.sprinting || (this.weapon === 2 && this.adsBlend > 0.85) ? "0" : "1";
    }
    if (this.dom.vignette) {
      this.hitFlash = Math.max(0, this.hitFlash - 1 / 60);
      const low = this.alive ? clamp((45 - this.hp) / 45, 0, 1) : 0;
      this.dom.vignette.style.opacity = String(Math.max(this.hitFlash * 0.9, low * (0.55 + Math.sin(now / 180) * 0.15)));
    }
  }

  private pushHud(now: number, nowLocal: number) {
    const w = WEAPONS[this.weapon];
    this.feed = this.feed.filter((f) => now - f.t < 7000);
    this.toasts = this.toasts.filter((t) => now - t.t < 2600);
    this.damage = this.damage.filter((d) => now - d.t < 1400);
    this.store.set({
      ready: true,
      phase: this.phase,
      phaseEndsLocal: this.phaseEndsLocal,
      scores: this.scores,
      myTeam: this.myTeam,
      hp: Math.round(this.hp),
      alive: this.alive,
      protectedUntilLocal: this.protectedUntil > now ? nowLocal + (this.protectedUntil - now) : 0,
      respawnAtLocal: this.alive ? 0 : nowLocal + Math.max(0, this.respawnAt - now),
      killedBy: this.killedBy,
      weapon: this.weapon,
      ammo: this.ammo.slice(),
      reload: this.reloadEnd > now ? clamp((now - this.reloadStart) / w.reload, 0, 1) : -1,
      ads: this.adsBlend > 0.5,
      scoped: this.weapon === 2 && this.adsBlend > 0.85 && this.alive,
      crouch: this.body.crouch,
      sprint: this.sprinting,
      connection: this.connection,
      fps: Math.round(this.fps),
      locked: this.locked,
      meta: this.meta,
      feed: this.feed,
      toasts: this.toasts,
      damage: this.damage,
      streak: this.streak,
    });
  }

  private updatePerf(dt: number) {
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0; this.fpsFrames = 0;
      // adaptive resolution keeps the game smooth on slower devices
      if (this.fps < 42) { this.slowFrames++; this.fastFrames = 0; } else if (this.fps > 57) { this.fastFrames++; this.slowFrames = 0; } else { this.slowFrames = 0; this.fastFrames = 0; }
      if (this.slowFrames >= 3 && this.pixelRatio > 0.6) { this.pixelRatio = Math.max(0.6, this.pixelRatio - 0.15); this.slowFrames = 0; this.applyPixelRatio(); }
      else if (this.slowFrames >= 12 && this.quality !== "low" && !this.perfHintShown) { this.perfHintShown = true; this.pushToast("Running slowly? Pause → Graphics → LOW", "warn"); }
      else if (this.fastFrames >= 8 && this.pixelRatio < this.maxPixelRatio) { this.pixelRatio = Math.min(this.maxPixelRatio, this.pixelRatio + 0.1); this.fastFrames = 0; this.applyPixelRatio(); }
    }
  }

  private applyPixelRatio() {
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
  }

  private resize = () => {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(w, h);
    }
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.store.set({ error: "Graphics were reset by the browser. Leave and rejoin the match to continue." });
  };

  // ===========================================================================
  // Minimap
  // ===========================================================================

  private drawMinimap() {
    const cv = this.dom.minimap;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width, H = cv.height;
    const sx = W / (PB.ARENA_X * 2 + 4), sz = H / (PB.ARENA_Z * 2 + 4);
    const toX = (x: number) => (x + PB.ARENA_X + 2) * sx, toY = (z: number) => (z + PB.ARENA_Z + 2) * sz;
    if (!this.minimapBase) {
      const base = document.createElement("canvas"); base.width = W; base.height = H;
      const b = base.getContext("2d")!;
      b.fillStyle = "rgba(21,48,30,0.92)"; b.fillRect(0, 0, W, H);
      b.fillStyle = "rgba(34,211,238,0.14)"; b.fillRect(toX(-PB.ARENA_X), toY(-PB.ARENA_Z), toX(-30) - toX(-PB.ARENA_X), toY(PB.ARENA_Z) - toY(-PB.ARENA_Z));
      b.fillStyle = "rgba(240,71,154,0.14)"; b.fillRect(toX(30), toY(-PB.ARENA_Z), toX(PB.ARENA_X) - toX(30), toY(PB.ARENA_Z) - toY(-PB.ARENA_Z));
      b.strokeStyle = "rgba(255,255,255,0.35)"; b.lineWidth = 1;
      b.strokeRect(toX(-PB.ARENA_X), toY(-PB.ARENA_Z), toX(PB.ARENA_X) - toX(-PB.ARENA_X), toY(PB.ARENA_Z) - toY(-PB.ARENA_Z));
      b.beginPath(); b.moveTo(toX(0), toY(-PB.ARENA_Z)); b.lineTo(toX(0), toY(PB.ARENA_Z)); b.stroke();
      for (const c of MAP.colliders) {
        if (c.vis === "net" || c.vis === "post" || c.vis === "roof") continue;
        b.fillStyle = c.vis === "deck" || c.vis === "ramp" || c.vis === "rail" ? "rgba(196,150,96,0.85)" : c.team === 0 ? "rgba(34,211,238,0.85)" : c.team === 1 ? "rgba(240,71,154,0.85)" : c.vis === "prism" ? "rgba(255,255,255,0.95)" : "rgba(226,232,240,0.7)";
        if (c.kind === "cyl") { b.beginPath(); b.arc(toX(c.x), toY(c.z), Math.max(1.5, c.r * sx), 0, Math.PI * 2); b.fill(); }
        else {
          b.save(); b.translate(toX(c.x), toY(c.z)); b.rotate(-c.rot);
          b.fillRect((-c.w / 2) * sx, (-c.d / 2) * sz, Math.max(1.5, c.w * sx), Math.max(1.5, c.d * sz));
          b.restore();
        }
      }
      this.minimapBase = base;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.minimapBase, 0, 0);
    this.remotes.forEach((r) => {
      if (!r.shown || !(r.flags & F.ALIVE)) return;
      const mate = r.meta.team === this.myTeam;
      if (!mate && !r.inSight && !(r.flags & F.FIRING)) return;
      ctx.fillStyle = r.meta.team === 0 ? "#22d3ee" : "#f0479a";
      ctx.strokeStyle = mate ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(toX(r.x), toY(r.z), mate ? 3.5 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    // me
    const mx = toX(this.alive ? this.body.x : this.deathPos.x), my = toY(this.alive ? this.body.z : this.deathPos.z);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.PI - this.yaw);
    ctx.fillStyle = "#fde047"; ctx.strokeStyle = "#111827"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ===========================================================================
  // Decoration
  // ===========================================================================

  /** Pre-splatter the field so it looks played-in. */
  private decoratePaint() {
    let seed = 1337;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const covers = MAP.colliders.filter((c) => c.vis !== "net" && c.vis !== "post" && c.vis !== "roof" && c.vis !== "prism");
    for (let i = 0; i < 110; i++) {
      const c = covers[Math.floor(rnd() * covers.length)];
      const a = rnd() * Math.PI * 2, h = c.y + 0.3 + rnd() * 1.4;
      const ox = c.x + Math.cos(a) * 8, oz = c.z + Math.sin(a) * 8;
      const dx = c.x - ox, dy = (c.y + 0.4) - h, dz = c.z - oz;
      const hit = raycastWorld(ox, h, oz, dx, dy, dz, 1.2);
      const team = c.x < 0 ? (rnd() < 0.75 ? 1 : 0) : (rnd() < 0.75 ? 0 : 1);
      if (hit) this.effects.addSplat([ox + dx * hit.t, h + dy * hit.t, oz + dz * hit.t], [hit.nx, hit.ny, hit.nz], team, 0.35 + rnd() * 0.35);
    }
    for (let i = 0; i < 70; i++) {
      const x = (rnd() - 0.5) * PB.ARENA_X * 1.9, z = (rnd() - 0.5) * PB.ARENA_Z * 1.9;
      this.effects.addSplat([x, 0.005, z], [0, 1, 0], x < 0 ? 1 : 0, 0.35 + rnd() * 0.5);
    }
  }

  // ===========================================================================

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.net.stop();
    this.unbindInput();
    window.removeEventListener("resize", this.resize);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost);
    this.releaseLock();
    this.remotes.forEach((r) => r.ch.dispose());
    this.remotes.clear();
    this.me?.dispose();
    this.effects.dispose();
    this.world.dispose();
    disposeCharacterShared();
    this.composer?.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch { /* ignore */ }
    this.renderer.domElement.remove();
  }
}
