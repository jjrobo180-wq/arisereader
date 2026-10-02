// Aurora Racers — kart stats, arcade physics (drift + mini-turbo) and the 3D kart model.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { TrackSpace } from "./tracks";

// ---------------------------------------------------------------------------
// Stats & progression data
// ---------------------------------------------------------------------------

import { BODIES, UPGRADES, UPGRADE_COST, MAX_UPGRADE, PAINTS, type Stats, type BodyDef, type UpgradeId } from "@shared/racing";
export { BODIES, UPGRADES, UPGRADE_COST, MAX_UPGRADE, PAINTS };
export type { Stats, BodyDef, UpgradeId };

export interface Physics { maxSpeed: number; accel: number; turn: number; grip: number; weight: number; boostMul: number }

export function physicsFor(body: BodyDef, up: Record<UpgradeId, number>, cc: number): Physics {
  const s = body.base;
  return {
    maxSpeed: (24 + s.speed * 0.95 + up.engine * 0.75) * cc,
    accel: (10 + s.accel * 1.25 + up.turbo * 0.9) * Math.sqrt(cc),
    turn: 1.55 + s.handling * 0.075 + up.tires * 0.05,
    grip: 5 + s.handling * 0.5 + up.tires * 0.45,
    weight: s.weight,
    boostMul: 1 + up.turbo * 0.06,
  };
}

// ---------------------------------------------------------------------------
// Physics body
// ---------------------------------------------------------------------------

export interface KartInput { gas: number; brake: number; steer: number; drift: boolean }

export const GRAVITY = 26;

export class KartBody {
  pos = new THREE.Vector3();
  yaw = 0;
  vel = new THREE.Vector2(); // x, z
  vy = 0;
  grounded = true;
  hint = 0;
  s = 0; // progress along the lap
  lat = 0;
  lap = 0; // completed laps (0 before crossing the line the first time)
  lapStartS = 0;
  passedHalf = false;
  finished = false;
  finishTime = 0;
  progress = 0; // for ranking
  driftDir = 0;
  driftCharge = 0;
  driftLevel = 0;
  boostTime = 0;
  boostPower = 1;
  spinTime = 0;
  spinYaw = 0;
  shieldTime = 0;
  rushTime = 0;
  coins = 0;
  offroad = false;
  wrongWay = 0;
  pitch = 0;
  roll = 0;
  airTime = 0;
  hitWall = 0;
  lastLanding = 0;
  steerVis = 0;
  speed = 0; // signed forward speed (for HUD / audio)
  rocketReady = false;
  events: string[] = [];

  constructor(public phys: Physics) {}

  get forward() { return new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw)); }

  place(track: TrackSpace, s: number, lat: number) {
    const p = track.point(s, lat, 0);
    this.pos.copy(p);
    const f = track.at(s);
    this.yaw = Math.atan2(f.t.x, f.t.z);
    this.vel.set(0, 0); this.vy = 0;
    this.hint = f.index;
    this.s = ((s % track.length) + track.length) % track.length;
    this.lapStartS = 0;
  }

  /** Apply a hit from an item. Returns false if the shield absorbed it. */
  hit(power = 1) {
    if (this.rushTime > 0) return false;
    if (this.shieldTime > 0) { this.shieldTime = 0; this.events.push("shield-break"); return false; }
    this.spinTime = 1.15 * power;
    this.driftDir = 0; this.driftCharge = 0; this.driftLevel = 0;
    this.boostTime = 0;
    this.coins = Math.max(0, this.coins - 2);
    this.events.push("spin");
    return true;
  }

  boost(seconds: number, power = 1.32) {
    this.boostTime = Math.max(this.boostTime, seconds);
    this.boostPower = Math.max(power, this.boostTime > 0 ? this.boostPower : 1);
    this.events.push("boost");
  }

  step(dt: number, input: KartInput, track: TrackSpace, raceTime: number) {
    const P = this.phys;
    const fwd = this.forward;
    const right = new THREE.Vector2(-fwd.y, fwd.x); // lateral axis (to the right of travel, matches track n)
    let v = this.vel.x * fwd.x + this.vel.y * fwd.y;
    let side = this.vel.x * right.x + this.vel.y * right.y;

    const pr = track.project(this.pos.x, this.pos.z, this.hint);
    this.offroad = Math.abs(pr.lat) > track.half + 0.3;
    const spinning = this.spinTime > 0;
    const boosting = this.boostTime > 0 || this.rushTime > 0;

    // ---- longitudinal ----
    let max = P.maxSpeed * (1 + Math.min(this.coins, 10) * 0.006);
    if (this.offroad && !boosting) max *= 0.58;
    if (boosting) max *= (this.rushTime > 0 ? 1.28 : this.boostPower) * P.boostMul;
    if (spinning) {
      v *= Math.exp(-3.2 * dt);
    } else if (this.grounded) {
      if (input.gas > 0 && v < max) v += P.accel * input.gas * (1 - Math.max(0, v) / max) * dt * (boosting ? 2.6 : 1) + (v < 3 ? 6 * dt : 0);
      if (input.brake > 0) v -= (v > 0 ? 26 : 12) * input.brake * dt;
      if (input.gas <= 0 && input.brake <= 0) v -= Math.sign(v) * Math.min(Math.abs(v), 5 * dt);
      if (v > max) v -= Math.min(v - max, (this.offroad ? 30 : 10) * dt);
      if (v < -9) v = -9;
    }

    // ---- steering & drift ----
    const steer = spinning ? 0 : THREE.MathUtils.clamp(input.steer, -1, 1);
    this.steerVis += (steer - this.steerVis) * Math.min(1, dt * 10);
    const speedFactor = THREE.MathUtils.clamp(Math.abs(v) / 9, 0, 1) * (1 - 0.22 * THREE.MathUtils.clamp(v / P.maxSpeed, 0, 1));
    let yawRate = 0;
    if (spinning) {
      this.spinYaw += dt * 13;
    } else {
      if (input.drift && this.grounded && !this.driftDir && Math.abs(steer) > 0.25 && v > 11) {
        this.driftDir = steer > 0 ? 1 : -1;
        this.vy = 3.4; this.grounded = false; // hop
        this.driftCharge = 0; this.driftLevel = 0;
        this.events.push("hop");
      }
      if (this.driftDir && (!input.drift || v < 7)) {
        // release: mini-turbo
        if (this.driftLevel > 0 && v >= 7) { const secs = [0, 0.55, 1.05, 1.6][this.driftLevel]; this.boost(secs, 1.28 + this.driftLevel * 0.04); this.events.push("mt" + this.driftLevel); }
        this.driftDir = 0; this.driftCharge = 0; this.driftLevel = 0;
      }
      if (this.driftDir) {
        const tight = steer * this.driftDir; // -1 wide .. +1 tight
        yawRate = -this.driftDir * P.turn * (0.82 + 0.5 * tight) * speedFactor; // +yaw turns left
        if (this.grounded) this.driftCharge += dt * (0.9 + Math.max(0, tight) * 0.9);
        const lvl = this.driftCharge > 2.7 ? 3 : this.driftCharge > 1.6 ? 2 : this.driftCharge > 0.7 ? 1 : 0;
        if (lvl > this.driftLevel) { this.driftLevel = lvl; this.events.push("spark" + lvl); }
      } else {
        yawRate = -steer * P.turn * speedFactor * Math.sign(v || 1);
        if (!this.grounded) yawRate *= 0.35;
      }
    }
    this.yaw += yawRate * dt;

    // ---- lateral grip ----
    const grip = this.driftDir ? P.grip * 0.32 : this.offroad ? P.grip * 0.7 : P.grip;
    if (this.grounded) side *= Math.exp(-grip * dt);
    if (this.driftDir && this.grounded) side += -this.driftDir * Math.abs(v) * 0.9 * dt; // outward slide

    const nf = this.forward, nr = new THREE.Vector2(-nf.y, nf.x);
    this.vel.set(nf.x * v + nr.x * side, nf.y * v + nr.y * side);
    this.speed = v;

    // ---- integrate position ----
    const oldGround = pr.height;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    let np = track.project(this.pos.x, this.pos.z, pr.index);
    // walls
    const lim = track.limit - 0.9;
    this.hitWall = Math.max(0, this.hitWall - dt);
    if (Math.abs(np.lat) > lim) {
      const sideSign = Math.sign(np.lat);
      const push = np.lat - sideSign * lim;
      this.pos.x -= np.frame.n.x * push; this.pos.z -= np.frame.n.z * push;
      // remove outward velocity and bounce a little
      const outward = this.vel.x * np.frame.n.x * sideSign + this.vel.y * np.frame.n.z * sideSign;
      if (outward > 0) {
        // arcade wall: cancel the outward push with a small bounce and keep sliding along the wall
        this.vel.x -= np.frame.n.x * sideSign * outward * 1.25;
        this.vel.y -= np.frame.n.z * sideSign * outward * 1.25;
        this.vel.multiplyScalar(0.985);
        if (outward > 4 && this.hitWall <= 0) { this.events.push("wall"); this.hitWall = 0.4; }
      }
      // turn the nose to run parallel with the wall instead of pinning against it
      const tYaw = Math.atan2(np.frame.t.x, np.frame.t.z);
      let diff = Math.atan2(Math.sin(tYaw - this.yaw), Math.cos(tYaw - this.yaw));
      if (Math.abs(diff) > Math.PI / 2) diff = Math.atan2(Math.sin(tYaw + Math.PI - this.yaw), Math.cos(tYaw + Math.PI - this.yaw));
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const facingOut = (fx * np.frame.n.x + fz * np.frame.n.z) * sideSign; // >0: nose points at the wall
      if (facingOut > 0.05) {
        // prefer the direction of travel along the track when nearly head-on
        if (facingOut > 0.9) diff = Math.atan2(Math.sin(tYaw - this.yaw), Math.cos(tYaw - this.yaw));
        this.yaw += diff * Math.min(1, dt * 9);
      }
      if (this.driftDir === sideSign) { this.driftDir = 0; this.driftCharge = 0; this.driftLevel = 0; }
      np = track.project(this.pos.x, this.pos.z, np.index);
    }
    this.hint = np.index;
    this.lat = np.lat;

    // ---- vertical ----
    const ground = np.height;
    if (this.grounded) {
      const followVy = (ground - oldGround) / Math.max(dt, 1e-4);
      if (ground < this.pos.y - 0.35) {
        // ground fell away (ramp lip / crest): fly
        this.grounded = false;
        this.vy = THREE.MathUtils.clamp(followVy > -50 ? this.vy : 0, -10, 20);
      } else {
        this.vy = THREE.MathUtils.clamp(followVy, -30, 30);
        this.pos.y = ground;
      }
    }
    if (!this.grounded) {
      this.airTime += dt;
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        this.pos.y = ground;
        if (this.airTime > 0.35) { this.events.push("land"); this.lastLanding = raceTime; }
        this.grounded = true; this.airTime = 0;
        this.vy = 0;
      }
    } else this.airTime = 0;

    // ---- visual attitude ----
    const ahead = track.project(this.pos.x + nf.x * 1.4, this.pos.z + nf.y * 1.4, np.index, 6).height;
    const behind = track.project(this.pos.x - nf.x * 1.4, this.pos.z - nf.y * 1.4, np.index, 6).height;
    const targetPitch = this.grounded ? -Math.atan2(ahead - behind, 2.8) : THREE.MathUtils.clamp(-this.vy * 0.03, -0.4, 0.4);
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 10);
    const bankRoll = np.frame.bank * Math.cos(this.yaw - Math.atan2(np.frame.t.x, np.frame.t.z));
    const lean = -this.steerVis * 0.06 * speedFactor - this.driftDir * 0.12;
    this.roll += (bankRoll + lean - this.roll) * Math.min(1, dt * 8);

    // ---- timers ----
    this.boostTime = Math.max(0, this.boostTime - dt);
    if (this.boostTime <= 0) this.boostPower = 1;
    this.spinTime = Math.max(0, this.spinTime - dt);
    if (this.spinTime <= 0) this.spinYaw = 0;
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    this.rushTime = Math.max(0, this.rushTime - dt);

    // ---- lap progress ----
    const prevS = this.s;
    this.s = np.s;
    const L = track.length;
    if (Math.abs(this.s - L * 0.5) < L * 0.1) this.passedHalf = true;
    if (prevS > L * 0.85 && this.s < L * 0.15) {
      if (this.passedHalf || this.lap === 0) { this.lap++; this.passedHalf = false; this.events.push("lap"); }
    } else if (prevS < L * 0.15 && this.s > L * 0.85 && this.lap > 0) {
      // crossed the line backwards
      this.lap--; this.passedHalf = true;
    }
    this.progress = (this.lap - 1) * L + this.s;
    const along = nf.x * np.frame.t.x + nf.y * np.frame.t.z;
    this.wrongWay = along < -0.35 && Math.abs(v) > 4 ? this.wrongWay + dt : 0;
  }
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface KartLook { body: string; paint: number; driver: number; helmet: number; name: string }

const DRIVER_SKIN = [0xf1c7a4, 0xe0ac86, 0xc68a5f, 0x9c6a43, 0x6e4a32];

export class KartModel {
  readonly root = new THREE.Group();
  private chassis = new THREE.Group();
  private wheels: THREE.Object3D[] = [];
  private frontPivots: THREE.Object3D[] = [];
  private flames: THREE.Mesh[] = [];
  private flameMat: THREE.MeshBasicMaterial;
  private shield: THREE.Mesh;
  private rushAura: THREE.Mesh;
  private head: THREE.Group;
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private wheelSpin = 0;
  private tag: THREE.Sprite | null = null;
  readonly sparkPoints: THREE.Object3D[] = [];

  constructor(look: KartLook, opts: { castShadow: boolean; tag?: boolean }) {
    const cast = opts.castShadow;
    const mat = (o: THREE.MeshStandardMaterialParameters | THREE.MeshPhysicalMaterialParameters, physical = false) => {
      const m = physical ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o);
      this.mats.push(m); return m;
    };
    const geo = <T extends THREE.BufferGeometry>(g: T) => { this.geos.push(g); return g; };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(geo(g), m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o;
    };
    const paint = mat({ color: look.paint, roughness: 0.28, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 }, true);
    const dark = mat({ color: 0x15171c, roughness: 0.55, metalness: 0.35 });
    const chrome = mat({ color: 0xd9dee5, roughness: 0.18, metalness: 1 });
    const seat = mat({ color: 0x23262d, roughness: 0.8 });
    const accent = new THREE.Color(look.paint).offsetHSL(0, 0, 0.18);
    const acc = mat({ color: accent, roughness: 0.35, metalness: 0.2 });

    this.root.add(this.chassis);
    const b = look.body;
    // chassis shapes per body
    const lenF = b === "bolt" ? 1.25 : b === "rhino" ? 1.05 : 1.1;
    const wid = b === "rhino" ? 1.55 : b === "swirl" ? 1.3 : 1.4;
    mesh(new RoundedBoxGeometry(wid, 0.32, 2.5 * lenF, 3, 0.12), paint, this.chassis, 0, 0.42, 0.05);
    mesh(new RoundedBoxGeometry(wid * 0.92, 0.22, 0.9, 3, 0.1), paint, this.chassis, 0, 0.62, 0.85 * lenF); // nose
    mesh(new RoundedBoxGeometry(wid * 0.7, 0.3, 0.6, 3, 0.1), acc, this.chassis, 0, 0.66, 1.12 * lenF);
    mesh(new RoundedBoxGeometry(wid + 0.25, 0.18, 0.35, 2, 0.08), dark, this.chassis, 0, 0.36, 1.45 * lenF); // front bumper
    mesh(new RoundedBoxGeometry(wid + 0.2, 0.22, 0.35, 2, 0.08), dark, this.chassis, 0, 0.4, -1.32); // rear bumper
    for (const sx of [-1, 1]) mesh(new RoundedBoxGeometry(0.28, 0.24, 1.2, 2, 0.08), acc, this.chassis, sx * (wid / 2 + 0.06), 0.5, 0.05); // side pods
    mesh(new RoundedBoxGeometry(0.75, 0.6, 0.5, 3, 0.14), seat, this.chassis, 0, 0.82, -0.45);
    // steering wheel
    const sw = mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), dark, this.chassis, 0, 1.0, 0.42);
    sw.rotation.x = -0.9;
    // engine & exhausts
    mesh(new RoundedBoxGeometry(0.8, 0.42, 0.55, 2, 0.08), chrome, this.chassis, 0, 0.72, -1.05);
    for (const sx of [-0.24, 0.24]) {
      const ex = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 10), chrome, this.chassis, sx, 0.72, -1.38);
      ex.rotation.x = Math.PI / 2;
    }
    if (b === "bolt") {
      mesh(new RoundedBoxGeometry(1.7, 0.08, 0.45, 2, 0.03), paint, this.chassis, 0, 1.28, -1.25);
      for (const sx of [-0.6, 0.6]) mesh(new THREE.BoxGeometry(0.06, 0.45, 0.2), dark, this.chassis, sx, 1.05, -1.25);
    } else if (b === "rhino") {
      for (const sx of [-0.45, 0.45]) { const horn = mesh(new THREE.ConeGeometry(0.12, 0.45, 10), chrome, this.chassis, sx, 0.5, 1.65); horn.rotation.x = Math.PI / 2; }
    } else if (b === "swirl") {
      const fin = mesh(new RoundedBoxGeometry(0.08, 0.55, 0.7, 2, 0.03), acc, this.chassis, 0, 1.05, -1.1);
      fin.rotation.x = -0.3;
    } else {
      mesh(new RoundedBoxGeometry(1.3, 0.07, 0.35, 2, 0.03), acc, this.chassis, 0, 1.12, -1.25);
    }
    // number plate light strip
    const glow = mat({ color: 0xffffff, emissive: accent, emissiveIntensity: 1.6 });
    mesh(new THREE.BoxGeometry(wid * 0.8, 0.05, 0.05), glow, this.chassis, 0, 0.5, 1.63 * lenF);

    // driver
    const skin = mat({ color: DRIVER_SKIN[look.driver % DRIVER_SKIN.length], roughness: 0.8 });
    const suit = mat({ color: look.helmet, roughness: 0.65 });
    const torso = mesh(new THREE.CapsuleGeometry(0.27, 0.32, 4, 12), suit, this.chassis, 0, 1.22, -0.3);
    torso.rotation.x = -0.18;
    for (const sx of [-1, 1]) {
      const arm = mesh(new THREE.CapsuleGeometry(0.08, 0.42, 3, 8), suit, this.chassis, sx * 0.26, 1.18, 0.05);
      arm.rotation.set(-1.1, 0, -sx * 0.35);
      mesh(new THREE.SphereGeometry(0.09, 10, 8), dark, this.chassis, sx * 0.15, 1.02, 0.36);
    }
    this.head = new THREE.Group();
    this.head.position.set(0, 1.72, -0.25);
    this.chassis.add(this.head);
    const helmet = mat({ color: look.helmet, roughness: 0.25, metalness: 0.2, clearcoat: 1 }, true);
    mesh(new THREE.SphereGeometry(0.34, 22, 16), helmet, this.head, 0, 0, 0);
    const visor = mat({ color: 0x0b1220, roughness: 0.05, metalness: 0.7, iridescence: 1, iridescenceIOR: 1.5, clearcoat: 1 }, true);
    const v = mesh(new THREE.SphereGeometry(0.345, 22, 10, Math.PI / 2 - 0.95, 1.9, 1.1, 0.75), visor, this.head, 0, 0.02, 0.02);
    v.scale.set(1, 1, 1.02);
    mesh(new THREE.BoxGeometry(0.08, 0.3, 0.6), acc, this.head, 0, 0.2, -0.05); // stripe
    mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 10), skin, this.head, 0, -0.34, 0);

    // wheels
    const tireGeo = geo(new THREE.CylinderGeometry(0.38, 0.38, 0.34, 20));
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = geo(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12));
    rimGeo.rotateZ(Math.PI / 2);
    const tire = mat({ color: 0x111215, roughness: 0.85 });
    for (const [x, z, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]] as [number, number, boolean][]) {
      const pivot = new THREE.Group();
      pivot.position.set(x * (wid / 2 + 0.22), 0.38, z * (front ? 1.0 * lenF : 0.95));
      this.chassis.add(pivot);
      const wheel = new THREE.Group();
      pivot.add(wheel);
      const t = new THREE.Mesh(tireGeo, tire); t.castShadow = cast; wheel.add(t);
      const r = new THREE.Mesh(rimGeo, chrome); wheel.add(r);
      const scale = front ? 1 : 1.12;
      wheel.scale.setScalar(scale);
      this.wheels.push(wheel);
      if (front) this.frontPivots.push(pivot);
      else { const sp = new THREE.Object3D(); sp.position.set(0, -0.36, 0); pivot.add(sp); this.sparkPoints.push(sp); }
    }

    // boost flames
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.mats.push(this.flameMat);
    const flameGeo = geo(new THREE.ConeGeometry(0.13, 0.9, 10));
    flameGeo.rotateX(-Math.PI / 2); flameGeo.translate(0, 0, -0.45);
    for (const sx of [-0.24, 0.24]) { const f = new THREE.Mesh(flameGeo, this.flameMat); f.position.set(sx, 0.72, -1.6); f.visible = false; this.chassis.add(f); this.flames.push(f); }

    const shMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mats.push(shMat);
    this.shield = new THREE.Mesh(geo(new THREE.SphereGeometry(1.9, 24, 16)), shMat);
    this.shield.position.y = 0.9; this.shield.scale.set(1, 0.8, 1.25); this.shield.visible = false;
    this.root.add(this.shield);
    const rushMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mats.push(rushMat);
    this.rushAura = new THREE.Mesh(geo(new THREE.SphereGeometry(2.1, 20, 14)), rushMat);
    this.rushAura.position.y = 0.9; this.rushAura.visible = false;
    this.root.add(this.rushAura);

    if (opts.tag) {
      const c = document.createElement("canvas"); c.width = 256; c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.font = "900 34px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 7; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(look.name, 128, 32, 240);
      ctx.fillStyle = "#fff"; ctx.fillText(look.name, 128, 32, 240);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false });
      this.mats.push(sm);
      this.tag = new THREE.Sprite(sm);
      this.tag.scale.set(0.12, 0.03, 1);
      this.tag.position.y = 2.6;
      this.root.add(this.tag);
      this.root.userData.tagTex = tex;
    }
  }

  update(dt: number, k: KartBody, t: number, showTag: boolean) {
    this.root.position.copy(k.pos);
    this.root.rotation.set(0, 0, 0);
    this.root.rotateY(k.yaw + k.spinYaw - k.driftDir * 0.32);
    this.chassis.rotation.set(k.pitch, 0, k.roll);
    // bounce on landing
    const sinceLand = (t - k.lastLanding);
    this.chassis.position.y = sinceLand < 0.3 ? -Math.sin(sinceLand / 0.3 * Math.PI) * 0.12 : Math.sin(t * 30) * 0.008 * Math.min(1, Math.abs(k.speed) / 10);
    this.wheelSpin += (k.speed / 0.38) * dt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    for (const p of this.frontPivots) p.rotation.y = -k.steerVis * 0.45;
    this.head.rotation.set(0, -k.steerVis * 0.3 - k.driftDir * 0.25, k.steerVis * 0.08);
    const flame = k.boostTime > 0 || k.rushTime > 0;
    for (const f of this.flames) {
      f.visible = flame;
      if (flame) { const s = 0.8 + Math.random() * 0.6; f.scale.set(1, 1, s * (k.boostPower > 1.3 ? 1.4 : 1)); }
    }
    this.flameMat.color.setHex(k.driftLevel === 3 ? 0xd946ef : k.boostPower > 1.36 ? 0x60a5fa : 0xffb02e);
    this.shield.visible = k.shieldTime > 0;
    if (this.shield.visible) this.shield.rotation.y += dt * 2;
    this.rushAura.visible = k.rushTime > 0;
    if (this.rushAura.visible) (this.rushAura.material as THREE.MeshBasicMaterial).color.setHSL((t * 1.5) % 1, 1, 0.6);
    if (this.tag) this.tag.visible = showTag;
  }

  dispose() {
    this.mats.forEach((m) => m.dispose());
    this.geos.forEach((g) => g.dispose());
    (this.root.userData.tagTex as THREE.Texture | undefined)?.dispose();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
    this.root.parent?.remove(this.root);
  }
}
