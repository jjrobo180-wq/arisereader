// Farm World engine — an open farm you explore as your own character (like A.R.I.S.E. City, but with animals).
// Walk (keys, hold-to-walk buttons, tap, or look at a spot), meet animals, feed them, climb on and ride
// horses, ponies, cows, pigs, sheep and goats, and hunt for golden horseshoes. React drives the HUD.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Stage, type Quality } from "@/game/stage/stage";
import { StageAudio } from "@/game/stage/audio";
import { AvatarRig, nameTag } from "@/lib/worldAvatar";
import { buildFarm, type FarmWorld } from "@/game/farm/world";
import { ANIMALS, EATS, FOOD, blocked, byId, foodMesh, loadAnimal, randomTarget, saddle, type AnimalDef, type FoodType } from "@/game/farm/animals";
import { HORSESHOES, ON_FOOT, POND, ROAM, OBSTACLES, areaName, groundY, horseshoesInReach, inPond, stepMover, walkable, type Mover, type MoveParams } from "@shared/farm/layout";
import { heightAt } from "@/game/splash/water";
import { canvasTex, EMOJI_FONT } from "@/game/runner/textures";

type Runtime = { def: AnimalDef; root: THREE.Group; model: THREE.Object3D; mixer: THREE.AnimationMixer | null; walk: THREE.AnimationAction | null; idle: THREE.AnimationAction | null; active: "walk" | "idle" | null; legs: THREE.Object3D[];
  target: THREE.Vector3; pausedUntil: number; food: string | null; eating: number; phase: number; hop: number; heartT: number; rider: boolean; waiting: number };
type Food = { id: string; type: FoodType; root: THREE.Group; pos: THREE.Vector3; by: string | null; left: number };
export type FarmHud = { riding: string | null; near: string | null; nearRide: string | null; area: string; walking: boolean; run: boolean; speed: number };
export type FarmEvents = { onHud: (h: FarmHud) => void; onMeet: (id: string) => void; onNote: (text: string, icon?: string, tone?: "info" | "good" | "oops") => void; onHorseshoe: (id: string) => void; onFed?: (id: string) => void };

const SFX = { mount: "jump", dismount: "land", step: "hover" } as const;
/** a seated rider's hips sit this far above their feet */
const SEAT_DROP = 0.48;
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

function animalTag(def: AnimalDef) {
  const t = canvasTex(640, 160, c => {
    const w = 600, h = 120, x = 20, y = 20, r = 56; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    c.fillStyle = "rgba(255,255,255,.95)"; c.fill(); c.lineWidth = 8; c.strokeStyle = def.ride ? "#d97706" : "#16a34a"; c.stroke();
    c.textBaseline = "middle"; c.font = `78px ${EMOJI_FONT}`; c.fillText(def.emoji, 44, 84);
    c.fillStyle = "#14223f"; let s = 60; c.font = `900 ${s}px ui-rounded,system-ui,sans-serif`; while (c.measureText(def.name).width > 470 && s > 28) { s -= 4; c.font = `900 ${s}px ui-rounded,system-ui,sans-serif`; } c.fillText(def.name, 140, 84);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false })); sp.renderOrder = 60; sp.center.set(0.5, 0); return sp;
}
function horseshoeMesh() {
  const g = new THREE.Group(); const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.85, roughness: 0.22, emissive: 0x7a4a00, emissiveIntensity: 0.55 });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 12, 32, Math.PI * 1.35), gold); arc.rotation.z = -Math.PI * 0.175 + Math.PI / 2; arc.castShadow = true; g.add(arc);
  for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.175 + Math.PI / 2 + (i / 5) * Math.PI * 1.35; const n = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshStandardMaterial({ color: 0x8a5a00, metalness: 0.6, roughness: 0.4 })); n.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.1); g.add(n); }
  const glowT = canvasTex(64, 64, c => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,235,150,.9)"); gr.addColorStop(1, "rgba(255,200,60,0)"); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(2.2); g.add(glow);
  return g;
}

export class FarmGame {
  stage: Stage; world: FarmWorld; audio = new StageAudio();
  animals = new Map<string, Runtime>(); foods = new Map<string, Food>(); private foodN = 0;
  rig: AvatarRig; me: Mover; private target: { x: number; z: number } | null = null; private targetRide: string | null = null;
  riding: string | null = null; private hold = { forward: 0, turn: 0 }; private keys = new Set<string>(); run = false;
  private cam = { yaw: Math.PI, pitch: 0.36, dist: 9, userYaw: 0, userPitch: 0, pos: new THREE.Vector3(0, 8, 40), look: new THREE.Vector3() };
  private shoes = new Map<string, THREE.Group>(); found: string[];
  private tag: THREE.Sprite | null = null; private tagFor: string | null = null; hoverId: string | null = null; selected: string | null = null;
  private marker = new THREE.Group(); private markFill: THREE.Mesh; private markRing: THREE.Mesh; private still = { p: new THREE.Vector3(999, 0, 999), t: 0 }; private goal = new THREE.Group();
  placing: FoodType | null = null; lookToWalk = true; private ghost: THREE.Group | null = null; private ghostType: FoodType | null = null;
  private birds: { obj: THREE.Object3D; mixer: THREE.AnimationMixer; r: number; h: number; sp: number; ph: number; cx: number; cz: number }[] = [];
  private wild: { obj: THREE.Object3D; mixer: THREE.AnimationMixer; ph: number }[] = [];
  private hudLast = ""; private hudT = 0; private disposed = false; private chirp = 3; private stepT = 0;
  private drag: { id: string; x: number; y: number; moved: boolean } | null = null; private orbit: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;
  ready = false; loaded = 0;

  constructor(private host: HTMLElement, opts: { quality: Quality; dwell: boolean; characterId: string; found: string[] }, private ev: FarmEvents) {
    this.found = [...opts.found];
    this.stage = new Stage(host, { quality: opts.quality, fov: 50, camPos: [0, 8, 40], bloom: 0.15, dwell: opts.dwell, dwellMs: 1100, exposure: 1.0 });
    const st = this.stage; st.camera.far = 700; st.camera.updateProjectionMatrix();
    this.world = buildFarm(st.scene, opts.quality);
    // you
    this.rig = new AvatarRig(opts.characterId, 1.75, { noWeapons: true });
    this.me = { x: 0, z: 31, facing: Math.PI, speed: 0 };
    this.rig.root.position.set(this.me.x, 0, this.me.z); st.scene.add(this.rig.root);
    const youTag = nameTag("You"); youTag.scale.multiplyScalar(0.32); youTag.position.y = 2.25; this.rig.root.add(youTag);
    // where you're heading
    this.markRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 48), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false })); this.markRing.rotation.x = -Math.PI / 2; this.markRing.position.y = 0.08; this.marker.add(this.markRing);
    this.markFill = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.85, 48, 1, 0, 0.01), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false })); this.markFill.rotation.x = -Math.PI / 2; this.markFill.position.y = 0.09; this.marker.add(this.markFill);
    this.marker.visible = false; st.scene.add(this.marker);
    const gr = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 40), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })); gr.rotation.x = -Math.PI / 2; gr.position.y = 0.07; this.goal.add(gr); this.goal.visible = false; st.scene.add(this.goal);
    // golden horseshoes
    for (const h of HORSESHOES) { if (this.found.includes(h.id)) continue; const m = horseshoeMesh(); m.position.set(h.x, 1.0, h.z); st.scene.add(m); this.shoes.set(h.id, m); }
    // animals (real models; hand-built stand-ins if a model can't download)
    for (const def of ANIMALS) void loadAnimal(def).then(r => { if (!this.disposed) this.addAnimal(def, r); });
    window.setTimeout(() => { if (!this.disposed && !this.ready) { this.ready = true; this.pushHud(true); } }, 15000);
    this.loadSkyLife();
    // input
    st.onPointer = (_p, kind) => this.pointer(kind);
    st.onFrame = (dt, t) => this.frame(dt, t);
    host.addEventListener("wheel", this.wheel, { passive: false });
    window.addEventListener("keydown", this.kd); window.addEventListener("keyup", this.ku);
    if (import.meta.env.DEV) (window as unknown as { __farm?: FarmGame }).__farm = this;
  }

  private addAnimal(def: AnimalDef, { model, clips, standIn }: { model: THREE.Object3D; clips: THREE.AnimationClip[]; standIn: boolean }) {
    const st = this.stage; const root = new THREE.Group(); root.position.set(def.x, 0, def.z); root.rotation.y = Math.random() * Math.PI * 2; root.add(model); st.scene.add(root);
    if (def.ride?.saddle) root.add(saddle(def));
    let mixer: THREE.AnimationMixer | null = null, walk: THREE.AnimationAction | null = null, idle: THREE.AnimationAction | null = null;
    if (clips.length) { mixer = new THREE.AnimationMixer(model); const wc = clips.find(c => /walk|trot|run|gallop/i.test(c.name)) ?? clips[0], ic = clips.find(c => /idle|stand|rest|eat|graze/i.test(c.name)); walk = mixer.clipAction(wc); idle = ic ? mixer.clipAction(ic) : null; if (idle) idle.play(); else { walk.play(); walk.paused = true; } }
    const legs: THREE.Object3D[] = standIn ? (model.userData.legs as THREE.Object3D[]) : [];
    if (!standIn && !mixer) model.traverse(o => { if (/leg|hoof|foot|paw|limb/i.test(o.name) && legs.length < 8) legs.push(o); });
    const rt: Runtime = { def, root, model, mixer, walk, idle, active: idle ? "idle" : null, legs, target: randomTarget(def), pausedUntil: performance.now() + Math.random() * 2500, food: null, eating: 0, phase: Math.random() * 6, hop: 0, heartT: 0, rider: false, waiting: 0 };
    this.animals.set(def.id, rt);
    st.pick(root, { id: def.id, dwellMs: 1100, ringScale: 0.8, enabled: () => !rt.rider, onHover: on => { this.hoverId = on ? def.id : this.hoverId === def.id ? null : this.hoverId; }, onDwell: () => { if (this.drag?.moved) return; this.ev.onMeet(def.id); } });
    this.loaded++; if (this.loaded === ANIMALS.length) { this.ready = true; this.pushHud(true); }
  }
  /** storks, parrots and flamingos flying over; a herd of wild horses galloping on the hills */
  private loadSkyLife() {
    const loader = new GLTFLoader(); const st = this.stage;
    const fly = (file: string, n: number, scale: number, h: [number, number], r: [number, number]) => loader.load(file, g => {
      if (this.disposed) return;
      for (let i = 0; i < n; i++) { const o = i ? g.scene.clone() : g.scene; o.scale.setScalar(scale); st.scene.add(o); const mixer = new THREE.AnimationMixer(o); if (g.animations[0]) { const a = mixer.clipAction(g.animations[0]); a.play(); a.time = Math.random(); } this.birds.push({ obj: o, mixer, r: r[0] + Math.random() * (r[1] - r[0]), h: h[0] + Math.random() * (h[1] - h[0]), sp: 0.08 + Math.random() * 0.06, ph: Math.random() * 6, cx: (Math.random() - 0.5) * 40, cz: (Math.random() - 0.5) * 30 }); }
    }, undefined, () => {});
    fly("/farm/Stork.glb", 3, 0.035, [18, 26], [25, 45]); fly("/farm/Parrot.glb", 4, 0.022, [10, 16], [12, 30]); fly("/farm/Flamingo.glb", 3, 0.03, [14, 22], [30, 50]);
    loader.load("/farm/Horse.glb", g => {
      if (this.disposed) return;
      for (let i = 0; i < 5; i++) { const o = i ? g.scene.clone() : g.scene; o.scale.setScalar(0.022); st.scene.add(o); o.traverse(m => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; }); const mixer = new THREE.AnimationMixer(o); if (g.animations[0]) { const a = mixer.clipAction(g.animations[0]); a.play(); a.time = i * 0.17; } this.wild.push({ obj: o, mixer, ph: i * 0.09 }); }
    }, undefined, () => {});
  }

  // ── input ──
  private kd = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.("input,textarea")) return; const k = e.key.toLowerCase(); this.keys.add(k); if (k === "shift") this.run = true; if (k === "e" && !e.repeat) { if (this.riding) this.dismount(); else { const n = this.nearest(3.5, true); if (n) this.ride(n); } } if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { this.target = null; this.targetRide = null; } };
  private ku = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); this.keys.delete(k); if (k === "shift") this.run = false; };
  private wheel = (e: WheelEvent) => { e.preventDefault(); this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * Math.pow(1.0015, e.deltaY), 4, 26); };
  /** hold-to-walk buttons: forward (-1…1) and turn (-1 left … 1 right) */
  setHold(forward: number, turn: number) { this.hold.forward = forward; this.hold.turn = turn; if (forward || turn) { this.target = null; this.targetRide = null; } }
  setRun(on: boolean) { this.run = on; }
  zoom(f: number) { this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * f, 4, 26); }
  turnCamera(a: number) { this.cam.userYaw += a; }
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointer(kind: "move" | "down" | "up") {
    const st = this.stage;
    if (kind === "down") {
      const hit = st.hitTest(); const id = hit ? [...this.animals.values()].find(r => r.root === hit)?.def.id ?? null : null;
      if (id) this.drag = { id, x: st.client.x, y: st.client.y, moved: false }; else this.orbit = { x: st.client.x, y: st.client.y, yaw: this.cam.userYaw, pitch: this.cam.userPitch, moved: false };
      return;
    }
    if (kind === "up") {
      if (this.orbit && !this.orbit.moved) { const g = st.pointerOn(this.ground); if (g) { if (this.placing) { if (this.placeFood(this.placing, g)) this.placing = null; } else this.goTo(g.x, g.z); } }
      if (this.drag?.moved) { const rt = this.animals.get(this.drag.id); if (rt) { rt.target.copy(randomTarget(rt.def)); rt.pausedUntil = performance.now() + 1500; } }
      this.drag = null; this.orbit = null; return;
    }
    if (this.orbit && st.pointerDown) {
      const dx = st.client.x - this.orbit.x, dy = st.client.y - this.orbit.y; if (Math.hypot(dx, dy) > 10) this.orbit.moved = true;
      if (this.orbit.moved) { this.cam.userYaw = this.orbit.yaw - dx * 0.006; this.cam.userPitch = THREE.MathUtils.clamp(this.orbit.pitch + dy * 0.004, -0.25, 0.7); }
    } else if (this.drag && st.pointerDown) {
      if (!this.drag.moved && Math.hypot(st.client.x - this.drag.x, st.client.y - this.drag.y) > 12) this.drag.moved = true;
      const rt = this.animals.get(this.drag.id); const g = st.pointerOn(this.ground);
      if (this.drag.moved && rt && !rt.rider && g && !blocked(g.x, g.z, rt.def)) { rt.root.position.set(g.x, 0, g.z); rt.target.copy(rt.root.position); rt.food = null; rt.pausedUntil = performance.now() + 2500; }
    }
  }

  // ── actions ──
  goTo(x: number, z: number) {
    if (!walkable(x, z)) { this.ev.onNote("You can't go there — try open grass.", "🚧", "oops"); this.audio.play("wrong"); return; }
    this.target = { x, z }; this.targetRide = null; this.goal.position.set(x, 0, z); this.goal.visible = true; this.audio.play("select");
  }
  teleport(x: number, z: number, facing = Math.PI) {
    if (this.riding) { const rt = this.animals.get(this.riding); if (rt) rt.root.position.set(x, 0, z); }
    this.me = { x, z, facing, speed: 0 }; this.target = null; this.cam.userYaw = 0;
  }
  nearest(r: number, rideOnly = false) {
    let best: string | null = null, bd = r;
    this.animals.forEach(rt => { if (rt.rider || (rideOnly && !rt.def.ride)) return; const d = Math.hypot(rt.root.position.x - this.me.x, rt.root.position.z - this.me.z); if (d < bd) { bd = d; best = rt.def.id; } });
    return best as string | null;
  }
  /** climb on (walking over first if it's far away) */
  ride(id: string) {
    const rt = this.animals.get(id); if (!rt?.def.ride) return; if (this.riding) this.dismount();
    const d = Math.hypot(rt.root.position.x - this.me.x, rt.root.position.z - this.me.z);
    rt.pausedUntil = performance.now() + 15000; rt.food = null; rt.eating = 0;
    if (d > 2.6) { this.targetRide = id; this.target = { x: rt.root.position.x, z: rt.root.position.z }; this.goal.visible = false; this.ev.onNote(`Walking over to ${rt.def.name}…`, rt.def.emoji); return; }
    this.mount(rt);
  }
  private mount(rt: Runtime) {
    this.targetRide = null; this.target = null; this.goal.visible = false;
    rt.rider = true; this.riding = rt.def.id; this.selected = rt.def.id;
    const seat = rt.def.height * (rt.def.ride?.seat ?? 0.8);
    rt.root.add(this.rig.root); this.rig.root.position.set(0, seat - SEAT_DROP, -0.05); this.rig.root.rotation.set(0, 0, 0); this.rig.sit(true);
    this.me = { x: rt.root.position.x, z: rt.root.position.z, facing: rt.root.rotation.y, speed: 0 };
    rt.hop = 1; this.audio.play(SFX.mount); this.ev.onNote(`You're riding ${rt.def.name}! Hold ⬆ to go.`, rt.def.emoji, "good"); this.pushHud(true);
  }
  dismount() {
    const id = this.riding; if (!id) return; const rt = this.animals.get(id); this.riding = null;
    if (rt) {
      rt.rider = false; rt.pausedUntil = performance.now() + 2500; rt.target.copy(rt.root.position);
      const side = new THREE.Vector3(Math.cos(rt.root.rotation.y), 0, -Math.sin(rt.root.rotation.y)).multiplyScalar(1.4);
      let x = rt.root.position.x + side.x, z = rt.root.position.z + side.z; if (!walkable(x, z)) { x = rt.root.position.x - side.x; z = rt.root.position.z - side.z; }
      this.me = { x, z, facing: rt.root.rotation.y, speed: 0 };
    }
    this.stage.scene.add(this.rig.root); this.rig.sit(false); this.rig.root.rotation.set(0, this.me.facing, 0);
    this.audio.play(SFX.dismount); this.pushHud(true);
  }
  placeFood(type: FoodType, at: THREE.Vector3, forId?: string) {
    const x = THREE.MathUtils.clamp(at.x, -44, 44), z = THREE.MathUtils.clamp(at.z, -33, 35);
    if (blocked(x, z) && !forId) { this.ev.onNote("Put the food on open grass.", "🌱", "oops"); this.audio.play("wrong"); return false; }
    const id = "food-" + ++this.foodN; const root = foodMesh(type); root.position.set(x, 0, z); root.scale.setScalar(0.01); this.stage.scene.add(root);
    const f: Food = { id, type, root, pos: new THREE.Vector3(x, 0, z), by: null, left: 1 }; this.foods.set(id, f);
    this.stage.fx.burst(x, 0.6, z, { color: [0xffffff, 0xfde68a], count: 24, speed: 3, life: 0.6, size: 0.3, gravity: 4, up: 2 }); this.audio.play("drop");
    let eater: Runtime | null = forId ? this.animals.get(forId) ?? null : null;
    if (!eater) { let bd = Infinity; this.animals.forEach(r => { if (!EATS[r.def.kind].includes(type) || r.food || r.eating > 0 || r.rider) return; const d = r.root.position.distanceTo(f.pos); if (d < bd) { bd = d; eater = r; } }); }
    const e = eater as Runtime | null;
    if (e && !e.rider) { e.food = id; f.by = e.def.id; e.target.copy(f.pos); e.pausedUntil = performance.now() + 300; this.ev.onNote(`${e.def.name} is coming for the ${FOOD[type].label.toLowerCase()}!`, FOOD[type].emoji, "good"); }
    else this.ev.onNote(`${FOOD[type].label} is ready — nobody nearby eats that.`, FOOD[type].emoji);
    return true;
  }
  /** food right in front of an animal (from its card) */
  feed(id: string, type: FoodType) {
    const rt = this.animals.get(id); if (!rt) return;
    const a = rt.root.rotation.y; let at = rt.root.position.clone().add(new THREE.Vector3(Math.sin(a) * 2, 0, Math.cos(a) * 2));
    if (blocked(at.x, at.z, rt.def.kind === "duck" ? undefined : rt.def)) at = rt.root.position.clone().add(new THREE.Vector3(-Math.sin(a) * 2, 0, -Math.cos(a) * 2));
    if (rt.def.kind === "duck") { const dx = at.x - POND.x, dz = at.z - POND.z, d = Math.hypot(dx, dz) || 1; at.set(POND.x + (dx / d) * (POND.r + 1.6), 0, POND.z + (dz / d) * (POND.r + 1.6)); }
    this.placeFood(type, at, id);
  }
  hop(id: string) { const rt = this.animals.get(id); if (rt) { rt.hop = 1; if (!rt.rider) rt.pausedUntil = Math.max(rt.pausedUntil, performance.now() + 2600); } }

  // ── every frame ──
  private frame(dt: number, t: number) {
    const st = this.stage; const now = performance.now();
    this.world.update(dt, t);
    // keys + held buttons
    const kf = (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) - (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0);
    const kt = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    const forward = THREE.MathUtils.clamp(kf + this.hold.forward, -1, 1), turn = -THREE.MathUtils.clamp(kt + this.hold.turn, -1, 1);
    const ridden = this.riding ? this.animals.get(this.riding) ?? null : null;
    const params: MoveParams = ridden?.def.ride ? { walk: ridden.def.ride.walk, run: ridden.def.ride.run, turnRate: 2.2, accel: 4 } : ON_FOOT;
    if (this.targetRide) { const rt = this.animals.get(this.targetRide); if (rt) this.target = { x: rt.root.position.x, z: rt.root.position.z }; }
    const r = stepMover(this.me, { forward, turn, run: this.run, target: this.target }, params, dt);
    this.me = r.m;
    if (this.targetRide) { const rt = this.animals.get(this.targetRide); if (rt && Math.hypot(rt.root.position.x - this.me.x, rt.root.position.z - this.me.z) < 2.4) this.mount(rt); }
    else if (r.arrived && this.target) { this.target = null; this.goal.visible = false; }
    const gy = groundY(this.me.x, this.me.z);
    if (ridden) {
      ridden.root.position.set(this.me.x, gy + Math.sin(ridden.hop * Math.PI) * 0.4, this.me.z); ridden.root.rotation.y = this.me.facing;
      const sp = Math.abs(this.me.speed);
      if (ridden.mixer && ridden.walk) {
        if (sp > 0.3 && ridden.active !== "walk") { ridden.idle?.fadeOut(0.25); ridden.walk.paused = false; ridden.walk.reset().fadeIn(0.25).play(); ridden.active = "walk"; }
        else if (sp <= 0.3 && ridden.active === "walk") { ridden.walk.fadeOut(0.25); if (ridden.idle) { ridden.idle.reset().fadeIn(0.25).play(); ridden.active = "idle"; } else { ridden.walk.paused = true; ridden.active = null; } }
        ridden.walk.timeScale = THREE.MathUtils.clamp(sp / Math.max(1.2, ridden.def.ride!.walk * 0.55), 0.6, 2.6);
      }
      if (ridden.legs.length && sp > 0.3) { ridden.phase += dt * sp * 2.4; ridden.legs.forEach((l, i) => { l.rotation.x = Math.sin(ridden.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5; }); }
      ridden.hop = Math.max(0, ridden.hop - dt * 2);
      // a bouncy ride: bob the rider with the stride
      this.rig.root.position.y = ridden.def.height * (ridden.def.ride?.seat ?? 0.8) - SEAT_DROP + Math.abs(Math.sin(t * (4 + sp))) * Math.min(0.12, sp * 0.015);
      this.rig.update(dt, 0);
      if (sp > 6 && Math.random() < dt * 8) st.fx.burst(this.me.x, 0.2, this.me.z, { color: [0xd6c3a5, 0xc8b08a], count: 3, speed: 1.2, life: 0.6, size: 0.35, gravity: -0.4 });
    } else {
      this.rig.root.position.set(this.me.x, gy, this.me.z); this.rig.root.rotation.y = this.me.facing; this.rig.update(dt, Math.abs(this.me.speed));
      if (Math.abs(this.me.speed) > 0.5) { this.stepT -= dt * Math.abs(this.me.speed); if (this.stepT <= 0) { this.stepT = 1.6; } }
    }
    // horseshoes
    for (const m of this.shoes.values()) { m.rotation.y += dt * 1.8; m.position.y = 1.0 + Math.sin(t * 2 + m.position.x) * 0.15; }
    for (const id of horseshoesInReach(this.me.x, this.me.z, this.found, ridden ? 2.4 : 1.6)) {
      const m = this.shoes.get(id); this.found.push(id);
      if (m) { st.fx.burst(m.position.x, m.position.y, m.position.z, { color: [0xffe14a, 0xffffff, 0xffb02e], count: 70, speed: 6, life: 1, size: 0.3, gravity: 5, spreadZ: 2 }); st.scene.remove(m); this.shoes.delete(id); }
      this.audio.play("coin", this.found.length); this.audio.play("card"); this.ev.onHorseshoe(id);
    }
    this.animalsFrame(dt, t, now);
    this.cameraFrame(dt);
    this.lookToWalk_(dt);
    // name tag over the animal you're looking at / chose
    const tagId = this.hoverId ?? this.selected; if (tagId !== this.tagFor) { if (this.tag) { st.scene.remove(this.tag); (this.tag.material as THREE.SpriteMaterial).map?.dispose(); this.tag = null; } this.tagFor = tagId; if (tagId && byId[tagId]) { this.tag = animalTag(byId[tagId]); st.scene.add(this.tag); } }
    if (this.tag && this.tagFor) { const rt = this.animals.get(this.tagFor); if (rt) { const extra = rt.rider ? 1.4 : 0.5; this.tag.position.set(rt.root.position.x, rt.root.position.y + rt.def.height + extra, rt.root.position.z); const d = st.camera.position.distanceTo(this.tag.position); this.tag.scale.set(d * 0.13, d * 0.0325, 1); } }
    // sky life
    for (const b of this.birds) { const a = t * b.sp + b.ph; b.obj.position.set(b.cx + Math.cos(a) * b.r, b.h + Math.sin(a * 2.3) * 1.2, b.cz + Math.sin(a) * b.r * 0.8); b.obj.rotation.y = -a + (b.sp > 0 ? 0 : Math.PI); b.mixer.update(dt); }
    for (const w of this.wild) { const a = t * 0.05 + w.ph; const x = Math.cos(a) * 66, z = Math.sin(a) * 56; w.obj.position.set(x, groundY(x, z), z); w.obj.rotation.y = -a + Math.PI; w.mixer.update(dt); }
    this.chirp -= dt; if (this.chirp <= 0) { this.chirp = 3 + Math.random() * 6; this.audio.play("chirp", Math.floor(Math.random() * 3)); }
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.2; this.pushHud(); }
  }

  private cameraFrame(dt: number) {
    const c = this.cam, st = this.stage; const moving = Math.abs(this.me.speed) > 0.5;
    if (moving && !this.orbit) { c.userYaw *= Math.pow(0.35, dt); c.userPitch *= Math.pow(0.5, dt); }
    const yaw = this.me.facing + Math.PI + c.userYaw, pitch = THREE.MathUtils.clamp(c.pitch + c.userPitch, 0.05, 1.2);
    const ridden = this.riding ? this.animals.get(this.riding) : null; const dist = c.dist * (ridden ? 1.25 : 1);
    const look = new THREE.Vector3(this.me.x, groundY(this.me.x, this.me.z) + (ridden ? ridden.def.height + 0.9 : 1.5), this.me.z);
    const want = look.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist));
    want.y = Math.max(want.y, groundY(want.x, want.z) + 1.2);
    const k = 1 - Math.exp(-dt * 5); c.pos.lerp(want, k); c.look.lerp(look, 1 - Math.exp(-dt * 8));
    st.camera.position.copy(c.pos); st.camera.lookAt(c.look);
    this.world.sun.target.position.copy(look); this.world.sun.position.copy(look).add(new THREE.Vector3(-30, 45, 25));
  }

  private lookToWalk_(dt: number) {
    const st = this.stage; const pf = this.placing;
    const g = (pf || this.lookToWalk) && st.dwell && st.pointerHover && !st.hovering ? st.pointerOn(this.ground) : null;
    this.marker.visible = !!g && (!!pf || (this.target === null && !this.targetRide));
    if (pf !== this.ghostType) { if (this.ghost) this.marker.remove(this.ghost); this.ghost = pf ? foodMesh(pf) : null; this.ghostType = pf; if (this.ghost) { this.ghost.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); (m.material as THREE.Material).transparent = true; (m.material as THREE.MeshStandardMaterial).opacity = 0.6; } }); this.marker.add(this.ghost); } }
    if (!g || !this.marker.visible) { this.still.t = 0; return; }
    this.marker.position.set(g.x, 0, g.z);
    const ok = pf ? !blocked(g.x, g.z) : walkable(g.x, g.z) && Math.hypot(g.x - this.me.x, g.z - this.me.z) > 2.2;
    (this.markRing.material as THREE.MeshBasicMaterial).color.setHex(ok ? (pf ? 0xffd23f : 0x38bdf8) : 0xef4444);
    const d = st.camera.position.distanceTo(g); this.marker.scale.setScalar(Math.max(0.7, d / 18));
    if (g.distanceTo(this.still.p) > 0.6 * this.marker.scale.x) { this.still.p.copy(g); this.still.t = 0; } else if (ok) this.still.t += dt;
    const kk = Math.min(1, this.still.t / (pf ? 1.4 : 1.2)); this.markFill.geometry.dispose(); this.markFill.geometry = new THREE.RingGeometry(0.2, 0.85, 48, 1, Math.PI / 2, Math.max(0.01, kk * Math.PI * 2));
    if (kk >= 1) { this.still.t = -1.5; if (pf) { if (this.placeFood(pf, g)) this.placing = null; } else this.goTo(g.x, g.z); }
  }

  private animalsFrame(dt: number, t: number, now: number) {
    const st = this.stage;
    this.animals.forEach(rt => {
      if (rt.rider) { rt.mixer?.update(dt); return; }
      const { root, def } = rt; let target = rt.target;
      if (rt.food) { const f = this.foods.get(rt.food); if (!f) rt.food = null; else target = f.pos; }
      const dist = Math.hypot(root.position.x - target.x, root.position.z - target.z);
      if (rt.food && dist < 1.25 && rt.eating <= 0) { rt.eating = 3.6; this.audio.play("munch"); }
      let walking = false;
      const meDist = Math.hypot(root.position.x - this.me.x, root.position.z - this.me.z);
      if (rt.eating > 0) {
        rt.eating -= dt; rt.phase += dt * 7; rt.model.rotation.x = Math.max(0, Math.sin(rt.phase)) * 0.18 + 0.08; rt.heartT -= dt;
        const f = rt.food ? this.foods.get(rt.food) : null; if (f) { f.left = Math.max(0.15, rt.eating / 3.6); f.root.scale.setScalar(f.left); }
        if (rt.heartT <= 0) { rt.heartT = 0.7; st.fx.burst(root.position.x, def.height + 0.4, root.position.z, { color: [0xff4d8d, 0xff8fb1], count: 4, speed: 1.2, life: 1, size: 0.45, gravity: -1.5 }); this.audio.play("munch"); }
        if (rt.eating <= 0) { rt.model.rotation.x = 0; if (f) { st.scene.remove(f.root); this.foods.delete(f.id); } rt.food = null; rt.target.copy(randomTarget(def)); rt.pausedUntil = now + 1200; this.ev.onNote(`Yum! ${def.name} loved the ${f ? FOOD[f.type].label.toLowerCase() : "snack"}!`, "💕", "good"); this.audio.play("goal"); this.ev.onFed?.(def.id); }
      } else if (!rt.food && meDist < 2.6 && !this.riding) {
        // say hello: stop and turn to look at you
        let dy = Math.atan2(this.me.x - root.position.x, this.me.z - root.position.z) - root.rotation.y; dy = wrap(dy); root.rotation.y += dy * Math.min(1, dt * 3); rt.pausedUntil = Math.max(rt.pausedUntil, now + 800);
      } else if (now > rt.pausedUntil) {
        if (dist < 0.4 && !rt.food) { rt.pausedUntil = now + 1500 + Math.random() * 3500; rt.target.copy(randomTarget(def)); }
        else walking = true;
      }
      if (rt.mixer) {
        rt.mixer.update(dt);
        if (walking && rt.walk && rt.active !== "walk") { rt.idle?.fadeOut(0.25); rt.walk.paused = false; rt.walk.reset().fadeIn(0.25).play(); rt.active = "walk"; }
        else if (!walking && rt.active === "walk") { rt.walk?.fadeOut(0.25); if (rt.idle) { rt.idle.reset().fadeIn(0.25).play(); rt.active = "idle"; } else { if (rt.walk) rt.walk.paused = true; rt.active = null; } }
        if (rt.walk) rt.walk.timeScale = rt.food ? 1.5 : 1;
      }
      if (walking) {
        const dir = new THREE.Vector3(target.x - root.position.x, 0, target.z - root.position.z); if (dir.lengthSq() > 1e-4) dir.normalize();
        this.animals.forEach(o => { if (o === rt || o.rider) return; const dx = root.position.x - o.root.position.x, dz = root.position.z - o.root.position.z, d = Math.hypot(dx, dz); const R = (def.height + o.def.height) * 0.55; if (d > 0 && d < R) { dir.x += (dx / d) * (R - d) * 0.8; dir.z += (dz / d) * (R - d) * 0.8; } });
        if (meDist < 1.6) { dir.x += (root.position.x - this.me.x) / meDist; dir.z += (root.position.z - this.me.z) / meDist; }
        dir.normalize(); const sp = def.speed * (rt.food ? 1.6 : 1) * dt; const nx = root.position.x + dir.x * sp, nz = root.position.z + dir.z * sp;
        if (blocked(nx, nz, def) && def.kind !== "duck") { rt.target.copy(randomTarget(def)); if (rt.food) { const f = this.foods.get(rt.food); if (f) f.by = null; rt.food = null; } }
        else { root.position.x = nx; root.position.z = nz; const dy = wrap(Math.atan2(dir.x, dir.z) - root.rotation.y); root.rotation.y += dy * Math.min(1, dt * 4); }
        if (rt.legs.length) { rt.phase += dt * (def.kind === "chicken" || def.kind === "duck" ? 14 : 8) * (rt.food ? 1.5 : 1); rt.legs.forEach((l, i) => { l.rotation.x = Math.sin(rt.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.45; }); }
      } else if (rt.legs.length) rt.legs.forEach(l => { l.rotation.x *= 0.85; });
      rt.hop = Math.max(0, rt.hop - dt * 2.2);
      const floating = def.kind === "duck" && inPond(root.position.x, root.position.z, -0.3);
      root.position.y = (floating ? 0.02 + heightAt(root.position.x, root.position.z, t, this.world.ripples.filter(Boolean)) : 0) + Math.sin(rt.hop * Math.PI) * 0.6 * Math.min(1, def.height);
      if (floating && walking && Math.random() < dt * 2) this.world.addRipple(root.position.x, root.position.z, 0.25);
    });
    this.foods.forEach(f => { if (!f.by || f.left === 1) f.root.scale.setScalar(Math.min(1, f.root.scale.x + dt * 4)); });
  }

  private pushHud(force = false) {
    const h: FarmHud = { riding: this.riding, near: this.riding ? null : this.nearest(3.2), nearRide: this.riding ? null : this.nearest(3.5, true), area: areaName(this.me.x, this.me.z), walking: !!this.target, run: this.run, speed: Math.round(Math.abs(this.me.speed) * 10) / 10 };
    const k = JSON.stringify(h); if (!force && k === this.hudLast) return; this.hudLast = k; this.ev.onHud(h);
  }

  /** a little top-down map: fields, buildings, the pond, animals, horseshoes and you */
  drawMap(cv: HTMLCanvasElement) {
    const c = cv.getContext("2d"); if (!c) return; const W = cv.width, H = cv.height;
    const sx = W / (ROAM.maxX - ROAM.minX + 6), sz = H / (ROAM.maxZ - ROAM.minZ + 6), s = Math.min(sx, sz);
    const X = (x: number) => W / 2 + x * s, Z = (z: number) => H / 2 + (z - (ROAM.maxZ + ROAM.minZ) / 2) * s;
    c.clearRect(0, 0, W, H); c.fillStyle = "#86b85a"; c.beginPath(); c.roundRect(0, 0, W, H, 16); c.fill();
    c.fillStyle = "#c9a875"; c.fillRect(X(-2.5), Z(-14), 5 * s, 74 * s);
    c.fillStyle = "#38bdf8"; c.beginPath(); c.arc(X(POND.x), Z(POND.z), POND.r * s, 0, 7); c.fill();
    c.fillStyle = "#b91c1c"; for (const o of OBSTACLES) c.fillRect(X(o.minX), Z(o.minZ), (o.maxX - o.minX) * s, (o.maxZ - o.minZ) * s);
    for (const h of HORSESHOES) if (!this.found.includes(h.id)) { c.fillStyle = "#facc15"; c.beginPath(); c.arc(X(h.x), Z(h.z), 3.2, 0, 7); c.fill(); c.strokeStyle = "#78350f"; c.lineWidth = 1; c.stroke(); }
    this.animals.forEach(rt => { if (rt.rider) return; c.fillStyle = rt.def.ride ? "#ffffff" : "#fde68a"; c.beginPath(); c.arc(X(rt.root.position.x), Z(rt.root.position.z), rt.def.baby ? 1.8 : 2.6, 0, 7); c.fill(); });
    const px = X(this.me.x), pz = Z(this.me.z), f = this.me.facing;
    c.save(); c.translate(px, pz); c.rotate(-f + Math.PI); c.fillStyle = this.riding ? "#f97316" : "#2563eb"; c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2.5); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
  }

  dispose() {
    this.disposed = true; this.host.removeEventListener("wheel", this.wheel); window.removeEventListener("keydown", this.kd); window.removeEventListener("keyup", this.ku);
    this.animals.forEach(r => r.mixer?.stopAllAction()); this.rig.dispose(); this.audio.dispose(); this.stage.dispose();
    const w = window as unknown as { __farm?: FarmGame }; if (w.__farm === this) delete w.__farm;
  }
}
