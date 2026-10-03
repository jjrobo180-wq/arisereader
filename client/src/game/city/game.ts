// Haven City game engine: renderer, the reader (on foot or driving), camera,
// traffic, other readers, pets and speedway races. React talks to it through a
// small API and gets HUD updates back through `onHud`.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AvatarRig, followOwner, nameTag } from "@/lib/worldAvatar";
import { createPet } from "@/lib/pets";
import { HOME_MODELS } from "@/lib/worldModels";
import { loadGltfCached } from "@/lib/worldAvatar";
import { LOTS, areaName, nearestSpot, resolveCircle, type Spot, DEALER } from "@shared/city/layout";
import { CARS, CAR_RADIUS, carFor, dashSpeed, stepCar, stepWalker, wrapAngle, type CarId, type CarState } from "@shared/city/drive";
import { GRID_PLAYER, LAP_LENGTH, lapsDone, makeRivals, startTracker, stepRival, trackPoint, updateTracker, type LapTracker, type Rival } from "@shared/city/race";
import { makeTraffic, stepTraffic, type TrafficCar } from "@shared/city/traffic";
import { buildCity, type CityScene } from "./scene";
import { makeCar, type CarRig } from "./models";
import { CityAudio } from "./audio";
import { Minimap, type MapDot } from "./minimap";

export type CitySelf = { userId: number; displayName: string; characterId: string; petId: string; carId: string; x: number; z: number; facing: number };
export type CityPlayer = { userId: number; displayName: string; characterId: string; petId: string; carId: string; x: number; z: number; facing: number; driving: boolean; speed: number; phrase: string | null };
export type CityHome = { ownerId: number; displayName: string; homeId: string; unlocked: boolean; lot: number };

export type RacePhase = "countdown" | "racing" | "finished";
export type RaceHud = { mode: "race" | "trial"; phase: RacePhase; countdown: number; lap: number; laps: number; position: number; racers: number; timeMs: number; results: { name: string; you: boolean; timeMs: number | null }[] | null; best: number | null };
export type CityHud = { driving: boolean; speed: number; area: string; spot: Spot | null; nearCar: boolean; race: RaceHud | null; carName: string };

type Remote = { data: CityPlayer; rig: AvatarRig; car: CarRig | null; carId: string; pet: THREE.Object3D | null; tag: THREE.Sprite; bubble: THREE.Sprite | null; bubbleText: string | null; target: THREE.Vector3; facing: number; seen: number };

const keyMap: Record<string, string> = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };

export class CityGame {
  /** The running game (handy for debugging from the console). */
  static current: CityGame | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private city: CityScene;
  private clock = new THREE.Clock();
  private raf = 0;
  private keys = new Set<string>();
  private paused = false;
  private disposed = false;
  readonly audio = new CityAudio();
  readonly minimap = new Minimap(170);
  private mapCtx: CanvasRenderingContext2D | null = null;

  // the reader
  private self: CitySelf;
  private rig: AvatarRig;
  private walker = new THREE.Vector3();
  private facing = 0;
  private carId: CarId;
  private carRig: CarRig;
  private car: CarState;
  private driving = false;
  private pet: THREE.Object3D | null = null;
  private loader = new GLTFLoader();

  // camera
  private camYaw = Math.PI;
  private camPitch = 0.32;
  private dragYaw = 0;
  private lastDrag = 0;

  // world
  private traffic: TrafficCar[] = makeTraffic(3);
  private trafficRigs: CarRig[] = [];
  private remotes = new Map<number, Remote>();
  private homeRoots: THREE.Object3D[] = [];
  private showcase: CarRig[] = [];

  // racing
  private race: { mode: "race" | "trial"; phase: RacePhase; startAt: number; tracker: LapTracker; laps: number; rivals: Rival[]; rivalRigs: CarRig[]; finishedAt: number | null; results: RaceHud["results"] } | null = null;

  private hudAt = 0;
  private onHud: (h: CityHud) => void;
  private onBump?: () => void;

  constructor(private container: HTMLElement, self: CitySelf, opts: { onHud: (h: CityHud) => void; onBump?: () => void }) {
    this.self = self;
    this.onHud = opts.onHud;
    this.onBump = opts.onBump;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 700);

    this.city = buildCity(this.scene);
    this.sun = new THREE.DirectionalLight(0xffd2a8, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);

    // me
    this.walker.set(self.x, 0, self.z);
    this.facing = self.facing;
    this.camYaw = self.facing + Math.PI;
    this.rig = new AvatarRig(self.characterId, 1.85, { noWeapons: true });
    this.rig.root.position.copy(this.walker);
    this.scene.add(this.rig.root);
    this.carId = carFor(self.carId);
    this.carRig = makeCar(this.carId);
    // park my car beside the plaza
    // my car waits at the edge of the plaza, pointing at the road
    const park = resolveCircle(self.x + 9, self.z + 7, CAR_RADIUS);
    this.car = { x: park.x, z: park.z, heading: Math.PI / 2, speed: 0, drift: 0 };
    this.scene.add(this.carRig.root);
    this.setPet(self.petId);

    // traffic
    for (const t of this.traffic) {
      const rig = makeCar(t.id % 3 === 0 ? "car-suv" : "car-starter", { tint: t.color, length: 4.3 });
      rig.root.position.set(t.x, 0, t.z); this.scene.add(rig.root); this.trafficRigs.push(rig);
    }
    // showroom cars at Velocity Motors
    (["car-super", "car-electric", "car-suv"] as CarId[]).forEach((id, i) => {
      const rig = makeCar(id, { length: 4.6 });
      const p = DEALER.showcase[i];
      rig.root.position.set(p.x, 0.35, p.z); rig.root.rotation.y = Math.PI / 2 + 0.4;
      this.scene.add(rig.root); this.showcase.push(rig);
    });

    CityGame.current = this;
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  attachMinimap(canvas: HTMLCanvasElement | null) { this.mapCtx = canvas?.getContext("2d") ?? null; }
  setPaused(p: boolean) { this.paused = p; if (p) this.keys.clear(); }
  press(key: string, down: boolean) { if (down) this.keys.add(key); else this.keys.delete(key); if (down) this.audio.start(); }

  getPose() {
    return this.driving
      ? { x: this.car.x, z: this.car.z, facing: this.car.heading, driving: true, speed: this.car.speed }
      : { x: this.walker.x, z: this.walker.z, facing: this.facing, driving: false, speed: 0 };
  }

  get isRacing() { return !!this.race; }

  setCar(id: string) {
    const next = carFor(id);
    if (next === this.carId) return;
    this.carId = next;
    const old = this.carRig;
    this.carRig = makeCar(next);
    this.carRig.root.position.copy(old.root.position); this.carRig.root.rotation.copy(old.root.rotation);
    this.scene.remove(old.root); old.dispose();
    this.scene.add(this.carRig.root);
  }

  setPet(petId: string) {
    if (this.pet) this.scene.remove(this.pet);
    this.pet = createPet(petId, this.loader, 0.8);
    if (this.pet) { this.pet.position.set(this.walker.x + 1, 0, this.walker.z + 1); this.pet.visible = !this.driving; this.scene.add(this.pet); }
  }

  /** Gets in (bringing the car over if it's far away) or gets out. */
  toggleCar() {
    if (this.race) return;
    this.audio.start();
    if (this.driving) {
      if (Math.abs(this.car.speed) > 4) { this.car.speed *= 0.3; }
      this.driving = false;
      const side = new THREE.Vector3(Math.cos(this.car.heading), 0, -Math.sin(this.car.heading)).multiplyScalar(2.4);
      const out = resolveCircle(this.car.x + side.x, this.car.z + side.z, 0.5);
      this.walker.set(out.x, 0, out.z);
      this.facing = this.car.heading;
      this.car.speed = 0;
      this.rig.root.visible = true;
      if (this.pet) { this.pet.visible = true; this.pet.position.set(out.x + 1, 0, out.z); }
    } else {
      const d = Math.hypot(this.car.x - this.walker.x, this.car.z - this.walker.z);
      if (d > 7) {
        // bring the car right next to the reader
        const side = new THREE.Vector3(Math.cos(this.facing), 0, -Math.sin(this.facing)).multiplyScalar(2.6);
        const spot = resolveCircle(this.walker.x + side.x, this.walker.z + side.z, CAR_RADIUS);
        this.car = { x: spot.x, z: spot.z, heading: this.facing, speed: 0, drift: 0 };
      }
      this.driving = true;
      this.rig.root.visible = false;
      if (this.pet) this.pet.visible = false;
      this.camYaw = this.car.heading + Math.PI;
    }
  }

  horn() { this.audio.start(); this.audio.horn(); }
  setMuted(m: boolean) { this.audio.muted = m; }

  /** Places homes on their lots. */
  setHomes(homes: CityHome[], myId: number) {
    this.homeRoots.forEach((r) => this.scene.remove(r));
    this.homeRoots = [];
    for (const l of LOTS) {
      const home = homes.find((h) => h.lot === l.index);
      const root = new THREE.Group(); root.position.set(l.x, 0, l.z); this.scene.add(root); this.homeRoots.push(root);
      const yard = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 14), new THREE.MeshStandardMaterial({ color: home?.ownerId === myId ? 0x86d07a : 0x6fbf62, roughness: 1 }));
      yard.position.y = 0.05; yard.receiveShadow = true; root.add(yard);
      const pathMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0xe7d7b8 }));
      pathMesh.position.set(0, 0.08, (l.doorZ - l.z) * 0.85); root.add(pathMesh);
      if (!home) {
        const sign = nameTag("Open lot", "#334155"); sign.position.set(0, 2.2, 0); sign.scale.multiplyScalar(0.6); root.add(sign);
        continue;
      }
      const mine = home.ownerId === myId;
      loadGltfCached(HOME_MODELS[home.homeId] || HOME_MODELS["home-basic"]).then((gltf) => {
        if (this.disposed) return;
        const model = gltf.scene.clone(true);
        const b = new THREE.Box3().setFromObject(model), size = b.getSize(new THREE.Vector3());
        model.scale.setScalar(9.2 / Math.max(0.001, size.x, size.z)); model.updateMatrixWorld(true);
        const nb = new THREE.Box3().setFromObject(model), c = nb.getCenter(new THREE.Vector3());
        model.position.set(-c.x, -nb.min.y, -c.z);
        model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        const holder = new THREE.Group(); holder.rotation.y = l.facing; holder.add(model); root.add(holder);
      }).catch(() => { /* lot stays empty */ });
      const sign = nameTag(mine ? "My home" : `${home.displayName}'s home`, mine ? "#0369a1" : home.unlocked ? "#166534" : "#334155", mine ? "Press F at the door" : home.unlocked ? "Door open" : "Door locked");
      sign.position.set(0, 7.4, 0); sign.scale.multiplyScalar(0.62); root.add(sign);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ color: mine || home.unlocked ? 0x4ade80 : 0xf59e0b, transparent: true, opacity: 0.6 }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.12, l.doorZ - l.z); root.add(glow);
    }
  }

  /** Other readers from the server. */
  setPlayers(players: CityPlayer[]) {
    const now = performance.now();
    for (const p of players) {
      if (p.userId === this.self.userId) continue;
      let r = this.remotes.get(p.userId);
      if (!r) {
        const rig = new AvatarRig(p.characterId, 1.85, { noWeapons: true });
        rig.root.position.set(p.x, 0, p.z);
        const tag = nameTag(p.displayName); tag.position.y = 2.45; tag.scale.multiplyScalar(0.4); rig.root.add(tag);
        this.scene.add(rig.root);
        const pet = createPet(p.petId, this.loader, 0.8); if (pet) { pet.position.set(p.x + 1, 0, p.z); this.scene.add(pet); }
        r = { data: p, rig, car: null, carId: "", pet, tag, bubble: null, bubbleText: null, target: new THREE.Vector3(p.x, 0, p.z), facing: p.facing, seen: now };
        this.remotes.set(p.userId, r);
      }
      r.data = p; r.seen = now;
      r.target.set(p.x, 0, p.z); r.facing = p.facing;
      if (p.driving && (!r.car || r.carId !== p.carId)) {
        if (r.car) { this.scene.remove(r.car.root); r.car.dispose(); }
        r.car = makeCar(carFor(p.carId)); r.carId = p.carId;
        r.car.root.position.set(p.x, 0, p.z); this.scene.add(r.car.root);
      }
      if (r.car) r.car.root.visible = p.driving;
      r.rig.root.visible = !p.driving;
      if (r.pet) r.pet.visible = !p.driving;
      if (p.phrase !== r.bubbleText) {
        if (r.bubble) { (r.car?.root ?? r.rig.root).remove(r.bubble); r.rig.root.remove(r.bubble); r.bubble = null; }
        r.bubbleText = p.phrase;
        if (p.phrase) { r.bubble = nameTag(p.phrase, "#7c3aed"); r.bubble.position.y = 3.4; r.bubble.scale.multiplyScalar(0.6); r.rig.root.add(r.bubble); }
      }
    }
    for (const [id, r] of this.remotes) {
      if (!players.some((p) => p.userId === id)) {
        this.scene.remove(r.rig.root); r.rig.dispose();
        if (r.car) { this.scene.remove(r.car.root); r.car.dispose(); }
        if (r.pet) this.scene.remove(r.pet);
        this.remotes.delete(id);
      }
    }
  }

  private myBubble: THREE.Sprite | null = null;
  private myBubbleUntil = 0;
  say(text: string) {
    if (this.myBubble) this.rig.root.remove(this.myBubble);
    this.myBubble = nameTag(text, "#7c3aed"); this.myBubble.position.y = 3.4; this.myBubble.scale.multiplyScalar(0.6);
    this.rig.root.add(this.myBubble);
    this.myBubbleUntil = performance.now() + 5000;
  }

  // ── Racing ────────────────────────────────────────────────────────────────
  startRace(mode: "race" | "trial") {
    this.endRace();
    if (!this.driving) this.toggleCar();
    this.car = { x: GRID_PLAYER.x, z: GRID_PLAYER.z, heading: GRID_PLAYER.heading, speed: 0, drift: 0 };
    this.camYaw = GRID_PLAYER.heading + Math.PI;
    const rivals = mode === "race" ? makeRivals() : [];
    const rivalRigs = rivals.map((r) => { const rig = makeCar("car-super", { tint: r.color, length: 4.4 }); this.scene.add(rig.root); return rig; });
    this.race = { mode, phase: "countdown", startAt: performance.now() + 3000, tracker: startTracker(this.car.x, this.car.z), laps: mode === "race" ? 3 : 1, rivals, rivalRigs, finishedAt: null, results: null };
    this.audio.beep();
  }

  endRace() {
    if (!this.race) return;
    for (const rig of this.race.rivalRigs) { this.scene.remove(rig.root); rig.dispose(); }
    this.race = null;
  }

  private bestKey(mode: string) { return `city_best_${mode}_${this.carId}`; }
  private readBest(mode: string) { try { const v = Number(localStorage.getItem(this.bestKey(mode))); return v > 0 ? v : null; } catch { return null; } }

  private stepRace(now: number, dt: number) {
    const race = this.race!;
    if (race.phase === "countdown") {
      const left = Math.ceil((race.startAt - now) / 1000);
      if (left !== (race as any)._last) { (race as any)._last = left; if (left > 0) this.audio.beep(); else this.audio.beep(true); }
      if (now >= race.startAt) { race.phase = "racing"; race.startAt = now; }
      return;
    }
    const elapsed = now - race.startAt;
    if (race.phase === "racing") {
      race.tracker = updateTracker(race.tracker, this.car.x, this.car.z);
      if (race.tracker.distance >= race.laps * LAP_LENGTH) {
        race.phase = "finished"; race.finishedAt = elapsed;
        const prev = this.readBest(race.mode);
        if (!prev || elapsed < prev) { try { localStorage.setItem(this.bestKey(race.mode), String(Math.round(elapsed))); } catch { /* ignore */ } }
      }
    }
    const t = now / 1000;
    race.rivals = race.rivals.map((r) => {
      if (r.finishedAt !== null) return r;
      const next = stepRival(r, dt, t);
      if (next.distance >= race.laps * LAP_LENGTH) next.finishedAt = elapsed;
      return next;
    });
    if (race.phase === "finished" && !race.results) {
      const all = [{ name: "You", you: true, timeMs: race.finishedAt, dist: race.tracker.distance }, ...race.rivals.map((r) => ({ name: r.name, you: false, timeMs: r.finishedAt, dist: r.distance }))];
      // rivals still racing get a projected time from their pace
      race.results = all
        .map((a) => ({ ...a, timeMs: a.timeMs ?? (race.finishedAt ?? elapsed) * ((race.laps * LAP_LENGTH) / Math.max(1, a.dist)) }))
        .sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0))
        .map(({ name, you, timeMs }) => ({ name, you, timeMs }));
    }
  }

  private raceHud(now: number): RaceHud | null {
    const race = this.race; if (!race) return null;
    const elapsed = race.phase === "countdown" ? 0 : race.finishedAt ?? now - race.startAt;
    const dists = [race.tracker.distance, ...race.rivals.map((r) => r.distance)];
    const position = 1 + dists.slice(1).filter((d) => d > race.tracker.distance).length;
    return {
      mode: race.mode, phase: race.phase, countdown: Math.max(0, Math.ceil((race.startAt - now) / 1000)),
      lap: Math.min(race.laps, lapsDone(race.tracker) + 1), laps: race.laps, position, racers: dists.length,
      timeMs: elapsed, results: race.results, best: this.readBest(race.mode),
    };
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = this.clock.getDelta();
    this.watchFrameRate(rawDt);
    const dt = Math.min(rawDt, 0.05);
    const t = this.clock.elapsedTime;
    const now = performance.now();
    const k = this.paused ? new Set<string>() : this.keys;
    const racingLocked = this.race?.phase === "countdown";

    if (this.race) this.stepRace(now, dt);

    if (this.driving) {
      const input = racingLocked ? { throttle: 0, brake: 1, steer: 0, handbrake: false } : {
        throttle: k.has("w") ? 1 : 0, brake: k.has("s") ? 1 : 0,
        steer: (k.has("a") ? 1 : 0) - (k.has("d") ? 1 : 0), handbrake: k.has(" "),
      };
      const before = this.car;
      const res = stepCar(this.car, input, CARS[this.carId], dt);
      this.car = res.car;
      // bump into traffic and race rivals (nobody is hurt; cars just nudge apart)
      const others: { x: number; z: number }[] = [...this.traffic, ...(this.race?.rivals.map((r) => trackPoint(r.s, r.offset)) ?? [])];
      for (const o of others) {
        const dx = this.car.x - o.x, dz = this.car.z - o.z, d = Math.hypot(dx, dz);
        if (d < CAR_RADIUS * 2 && d > 0.01) {
          this.car.x = o.x + (dx / d) * CAR_RADIUS * 2; this.car.z = o.z + (dz / d) * CAR_RADIUS * 2;
          if (Math.abs(this.car.speed) > 4) { this.audio.bump(); this.onBump?.(); }
          this.car.speed *= 0.5;
        }
      }
      if (res.bumped) { this.audio.bump(); this.onBump?.(); }
      void before;
      this.carRig.root.position.set(this.car.x, 0, this.car.z);
      this.carRig.root.rotation.y = this.car.heading + this.car.drift * 0.35;
      this.carRig.setMotion(this.car.speed, (k.has("a") ? 1 : 0) - (k.has("d") ? 1 : 0), dt);
      this.walker.set(this.car.x, 0, this.car.z);
      this.audio.engine(true, Math.min(1, Math.abs(this.car.speed) / CARS[this.carId].top));
    } else {
      // walk relative to the camera
      const fwd = (k.has("w") ? 1 : 0) - (k.has("s") ? 1 : 0), side = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
      const yaw = this.camYaw + Math.PI; // direction the camera looks
      const dx = Math.sin(yaw) * fwd - Math.cos(yaw) * side, dz = Math.cos(yaw) * fwd + Math.sin(yaw) * side;
      const w = stepWalker(this.walker.x, this.walker.z, dx, dz, k.has("shift"), dt);
      const moved = Math.hypot(w.x - this.walker.x, w.z - this.walker.z) / Math.max(dt, 1e-4);
      this.walker.set(w.x, 0, w.z);
      if (w.facing !== null) this.facing = wrapAngle(this.facing + wrapAngle(w.facing - this.facing) * Math.min(1, dt * 12));
      this.rig.root.position.copy(this.walker);
      this.rig.root.rotation.y = this.facing;
      this.rig.update(dt, moved);
      if (this.pet) followOwner(this.pet, this.rig.root, dt, t, 1.4);
      this.carRig.root.position.set(this.car.x, 0, this.car.z);
      this.carRig.root.rotation.y = this.car.heading;
      this.audio.engine(false, 0);
    }
    if (this.myBubble && now > this.myBubbleUntil) { this.rig.root.remove(this.myBubble); this.myBubble = null; }

    // traffic
    const obstacles = [{ x: this.car.x, z: this.car.z }, ...(this.driving ? [] : [{ x: this.walker.x, z: this.walker.z }])];
    for (const r of this.remotes.values()) obstacles.push({ x: r.rig.root.position.x, z: r.rig.root.position.z });
    this.traffic = stepTraffic(this.traffic, obstacles, dt);
    this.traffic.forEach((c, i) => { const rig = this.trafficRigs[i]; rig.root.position.set(c.x, 0, c.z); rig.root.rotation.y = c.heading; rig.setMotion(c.speed, 0, dt); });

    // rivals
    if (this.race) this.race.rivals.forEach((r, i) => { const p = trackPoint(r.s, r.offset); const rig = this.race!.rivalRigs[i]; rig.root.position.set(p.x, 0, p.z); rig.root.rotation.y = p.heading; rig.setMotion(r.base, 0, dt); });

    // other readers glide toward their latest position
    for (const r of this.remotes.values()) {
      const node = r.data.driving && r.car ? r.car.root : r.rig.root;
      const from = node.position.clone();
      node.position.lerp(r.target, Math.min(1, dt * 6));
      node.rotation.y = node.rotation.y + wrapAngle(r.facing - node.rotation.y) * Math.min(1, dt * 8);
      const speed = from.distanceTo(node.position) / Math.max(dt, 1e-4);
      if (r.data.driving) { r.rig.root.position.copy(node.position); r.car?.setMotion(speed, 0, dt); }
      else r.rig.update(dt, speed);
      if (r.pet && !r.data.driving) followOwner(r.pet, r.rig.root, dt, t, 1.4);
    }
    this.showcase.forEach((s) => { s.root.rotation.y += dt * 0.3; });

    this.updateCamera(dt);
    this.sun.position.set(this.walker.x - 40, 70, this.walker.z - 30);
    this.sun.target.position.set(this.walker.x, 0, this.walker.z);
    this.city.update(t);
    this.renderer.render(this.scene, this.camera);

    if (now - this.hudAt > 120) {
      this.hudAt = now;
      const pose = this.getPose();
      const spot = nearestSpot(pose.x, pose.z);
      this.onHud({
        driving: this.driving, speed: this.driving ? dashSpeed(this.car.speed) : 0, area: areaName(pose.x, pose.z), spot,
        nearCar: !this.driving && Math.hypot(this.car.x - this.walker.x, this.car.z - this.walker.z) < 7,
        race: this.raceHud(now), carName: CARS[this.carId].name,
      });
      if (this.mapCtx) {
        const dots: MapDot[] = [];
        for (const r of this.remotes.values()) dots.push({ x: r.target.x, z: r.target.z, color: "#a78bfa", size: 3 });
        for (const c of this.traffic) dots.push({ x: c.x, z: c.z, color: "rgba(255,255,255,.45)", size: 1.6 });
        if (!this.driving) dots.push({ x: this.car.x, z: this.car.z, color: "#5eead4", size: 3 });
        this.minimap.draw(this.mapCtx, { x: pose.x, z: pose.z, heading: pose.facing }, dots);
      }
    }
  };

  private updateCamera(dt: number) {
    const target = this.driving ? new THREE.Vector3(this.car.x, 0, this.car.z) : this.walker.clone();
    if (this.driving && performance.now() - this.lastDrag > 1200) {
      // ease back behind the car
      const behind = this.car.heading + Math.PI + (this.car.speed < -1 ? Math.PI : 0);
      this.camYaw = this.camYaw + wrapAngle(behind - this.camYaw) * Math.min(1, dt * 3);
    }
    const dist = this.driving ? 10 + Math.min(4, Math.abs(this.car.speed) * 0.12) : 7.5;
    const height = this.driving ? 4.2 : 3.4;
    const pitch = this.camPitch;
    const cx = target.x + Math.sin(this.camYaw) * dist * Math.cos(pitch);
    const cz = target.z + Math.cos(this.camYaw) * dist * Math.cos(pitch);
    const desired = new THREE.Vector3(cx, height + Math.sin(pitch) * dist * 0.5, cz);
    this.camera.position.lerp(desired, Math.min(1, dt * (this.driving ? 6 : 9)));
    this.camera.lookAt(target.x, this.driving ? 1.4 : 1.6, target.z);
    void this.dragYaw;
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.("input, textarea, select") || this.paused) return;
    const key = keyMap[e.key.toLowerCase()] ?? e.key.toLowerCase();
    if (["w", "a", "s", "d", " ", "shift"].includes(key)) { e.preventDefault(); this.press(key, true); }
    else if (key === "e" && !e.repeat) this.toggleCar();
    else if (key === "h" && !e.repeat) this.horn();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const key = keyMap[e.key.toLowerCase()] ?? e.key.toLowerCase();
    this.keys.delete(key);
  };
  private dragging: { x: number; y: number } | null = null;
  private onPointerDown = (e: PointerEvent) => { this.dragging = { x: e.clientX, y: e.clientY }; this.audio.start(); };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.dragging.x, dy = e.clientY - this.dragging.y;
    this.dragging = { x: e.clientX, y: e.clientY };
    this.camYaw -= dx * 0.006;
    this.camPitch = Math.max(0.08, Math.min(0.9, this.camPitch + dy * 0.004));
    this.lastDrag = performance.now();
  };
  private onPointerUp = () => { this.dragging = null; };
  private onBlur = () => this.keys.clear();

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /** Moves the reader (on foot or in the car) to a spot. */
  teleport(x: number, z: number, facing: number) {
    if (this.driving) { this.car = { x, z, heading: facing, speed: 0, drift: 0 }; this.camYaw = facing + Math.PI; }
    else { this.walker.set(x, 0, z); this.facing = facing; this.camYaw = facing + Math.PI; }
    this.camera.position.set(x - Math.sin(facing) * 9, 5, z - Math.cos(facing) * 9);
  }

  // Lowers quality on slow devices: after a few slow seconds, drop shadows and resolution.
  private slowFrames = 0;
  private lowQuality = false;
  private watchFrameRate(dt: number) {
    if (this.lowQuality) return;
    this.slowFrames = dt > 1 / 28 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 90) {
      this.lowQuality = true;
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
      this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => { mat.needsUpdate = true; }); });
      this.resize();
    }
  }

  dispose() {
    if (CityGame.current === this) CityGame.current = null;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.endRace();
    this.rig.dispose();
    this.carRig.dispose();
    this.trafficRigs.forEach((r) => r.dispose());
    this.showcase.forEach((r) => r.dispose());
    for (const r of this.remotes.values()) { r.rig.dispose(); r.car?.dispose(); }
    this.audio.dispose();
    this.city.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat) => { (mat as THREE.MeshBasicMaterial).map?.dispose(); mat.dispose(); });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
