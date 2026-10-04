// Haven City game engine: renderer, the reader (on foot or driving), camera,
// traffic, other readers, pets and speedway races. React talks to it through a
// small API and gets HUD updates back through `onHud`.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AvatarRig, followOwner, nameTag } from "@/lib/worldAvatar";
import { createPet } from "@/lib/pets";
import { HOME_MODELS } from "@/lib/worldModels";
import { loadGltfCached } from "@/lib/worldAvatar";
import {
  LOTS, STARS, areaName, nearestSpot, rampAt, resolveCircle, type Spot, DEALER,
  ARCADE, BUMPER, COUNTER, INTERIORS, RESTAURANTS, RIDES, TABLES, cabinetPos, interiorAt, interiorEntry, type Interior, type RideId,
} from "@shared/city/layout";
import { CARS, CAR_RADIUS, GROUNDED, carFor, dashSpeed, groundAt, stepCar, stepLift, stepWalker, wrapAngle, type CarId, type CarState, type Lift } from "@shared/city/drive";
import { GRID_PLAYER, LAP_LENGTH, lapsDone, makeRivals, startTracker, stepRival, trackPoint, updateTracker, type LapTracker, type Rival } from "@shared/city/race";
import { makeTraffic, stepTraffic, type TrafficCar } from "@shared/city/traffic";
import { makeWalkers, routePoint, stepWalkers, type Walker } from "@shared/city/people";
import { buildCity, type CityScene } from "./scene";
import { makeCar, type CarRig } from "./models";
import { CityAudio } from "./audio";
import { Minimap, type MapDot } from "./minimap";
import { CHATTER, GREETINGS, Voices, speechBubble } from "./voices";
import { NavRoute } from "./nav";
import { findRoute, routeProgress } from "@shared/city/navigate";

export type CitySelf = { userId: number; displayName: string; characterId: string; petId: string; carId: string; x: number; z: number; facing: number };
export type CityPlayer = { userId: number; displayName: string; characterId: string; petId: string; carId: string; x: number; z: number; facing: number; driving: boolean; speed: number; phrase: string | null };
export type CityHome = { ownerId: number; displayName: string; homeId: string; unlocked: boolean; lot: number };

export type RacePhase = "countdown" | "racing" | "finished";
export type RaceHud = { mode: "race" | "trial"; phase: RacePhase; countdown: number; lap: number; laps: number; position: number; racers: number; timeMs: number; results: { name: string; you: boolean; timeMs: number | null }[] | null; best: number | null };
export type CityHud = {
  driving: boolean; speed: number; area: string; spot: Spot | null; nearCar: boolean; race: RaceHud | null; carName: string; airborne: boolean; stars: number; starsTotal: number;
  /** The restaurant or arcade you're inside, if any. */
  room: { id: string; kind: "restaurant" | "arcade"; name: string } | null;
  /** Food you've ordered and not eaten yet. */
  meal: string | null;
  /** 0…1 while you're eating. */
  eating: number | null;
  /** Seconds of energy left after a meal (you walk and drive a little faster). */
  energy: number;
  ride: { id: RideId; name: string; left: number } | null;
  /** Directions you're following: where to, how far, and the next turn (arrow: degrees, 0 = straight ahead). */
  nav: { name: string; left: number; turn: "left" | "right" | "straight" | "arrive"; toCorner: number; arrow: number } | null;
  bumper: { left: number; bumps: number } | null;
};
export type StarFound = { id: string; found: number; total: number };

type Remote = { data: CityPlayer; rig: AvatarRig; car: CarRig | null; carId: string; pet: THREE.Object3D | null; tag: THREE.Sprite; bubble: THREE.Sprite | null; bubbleText: string | null; target: THREE.Vector3; facing: number; seen: number };

const keyMap: Record<string, string> = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };

const RIDE_TIME: Record<RideId, number> = { wheel: 45, carousel: 24, drop: 17 };
const EAT_TIME = 7;
const ENERGY_TIME = 120;
type Npc = { room: string; role: "chef" | "diner" | "gamer" | "host"; rig: AvatarRig; home: THREE.Vector3; facing: number; seed: number; nextMove: number; bubble: THREE.Sprite | null; bubbleUntil: number };

/** A plate of food for the table, by restaurant. */
function makeFood(venue: string) {
  const g = new THREE.Group();
  const m = (c: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...extra });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.04, 24), m(0xffffff, { roughness: 0.25 })); g.add(plate);
  const at = (mesh: THREE.Mesh, x: number, y: number, z: number) => { mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh; };
  if (venue === "pizza") {
    const slice = at(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 16, 1, false, -0.4, 0.8), m(0xf2b134)), 0, 0.05, -0.12);
    slice.rotation.y = Math.PI;
    for (const [x, z] of [[0.02, 0.08], [-0.06, 0.18], [0.07, 0.2]]) at(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), m(0xb3261e)), x, 0.085, z - 0.12);
    at(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.07), m(0xc98a3a)), 0, 0.06, 0.24);
  } else if (venue === "noodles") {
    const pts = [new THREE.Vector2(0.12, 0), new THREE.Vector2(0.28, 0.08), new THREE.Vector2(0.34, 0.2), new THREE.Vector2(0.33, 0.22)];
    at(new THREE.Mesh(new THREE.LatheGeometry(pts, 20), m(0xc92a2a, { side: THREE.DoubleSide, roughness: 0.3 })), 0, 0.02, 0);
    at(new THREE.Mesh(new THREE.CircleGeometry(0.31, 20).rotateX(-Math.PI / 2), m(0xe8c98a)), 0, 0.19, 0);
    at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), m(0xffffff)), 0.1, 0.2, 0.05);
    for (const dx of [-0.03, 0.03]) { const c = at(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 5), m(0x6b4226)), 0.2 + dx, 0.24, 0); c.rotation.z = 1.35; }
  } else if (venue === "tacos") {
    for (const dx of [-0.14, 0.14]) {
      const shell = at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 16, 1, true, 0, Math.PI), m(0xe9b949, { side: THREE.DoubleSide })), dx, 0.17, 0);
      shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2;
      at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.3), m(0x5c940d)), dx, 0.2, 0);
      at(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.28), m(0xc92a2a)), dx, 0.24, 0);
    }
  } else {
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 18), m(0xd9a35b)), -0.08, 0.05, 0);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 18), m(0x5a3220)), -0.08, 0.1, 0);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.02, 18), m(0xf2c94c)), -0.08, 0.14, 0);
    at(new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m(0xd9a35b)), -0.08, 0.15, 0);
    at(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.1), m(0xc92a2a)), 0.2, 0.1, 0);
    for (let i = 0; i < 5; i++) at(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.02), m(0xf4c430)), 0.16 + i * 0.02, 0.2, (i % 2) * 0.02);
  }
  return g;
}

export class CityGame {
  /** The running game (handy for debugging from the console). */
  static current: CityGame | null = null;
  private renderer: THREE.WebGLRenderer;
  private envMap: THREE.Texture | null = null;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private city: CityScene;
  private clock = new THREE.Clock();
  private raf = 0;
  private keys = new Set<string>();
  private stick: { x: number; y: number } | null = null;
  private steerAxis: number | null = null;
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
  private lift: Lift = GROUNDED;
  private carPitch = 0;
  private walkerY = 0;
  private driving = false;
  private pet: THREE.Object3D | null = null;
  private loader = new GLTFLoader();

  // camera
  private camYaw = Math.PI;
  private camPitch = 0.32;
  private dragYaw = 0;
  private lastDrag = 0;

  // world
  private traffic: TrafficCar[] = makeTraffic(3, 5);
  private trafficRigs: CarRig[] = [];
  private remotes = new Map<number, Remote>();
  private homeRoots: THREE.Object3D[] = [];
  private showcase: CarRig[] = [];
  // people out walking: rigs are made the first time someone comes near
  private walkers: Walker[] = makeWalkers(40);
  private walkerViews: ({ rig: AvatarRig; pet: THREE.Object3D | null; bubble: THREE.Sprite | null; bubbleUntil: number; hop: number } | null)[] = [];
  private stars: { id: string; root: THREE.Object3D; x: number; y: number; z: number }[] = [];
  private starsFound = new Set<string>();
  private onStar?: (s: StarFound) => void;

  // racing
  private race: { mode: "race" | "trial"; phase: RacePhase; startAt: number; tracker: LapTracker; laps: number; rivals: Rival[]; rivalRigs: CarRig[]; finishedAt: number | null; results: RaceHud["results"] } | null = null;

  // restaurants, the arcade and rides
  private room: Interior | null = null;
  private meal: { venue: string; item: string } | null = null;
  private eating: { start: number; seatX: number; seatZ: number; food: THREE.Object3D; nextBite: number } | null = null;
  private energyUntil = 0;
  private riding: { id: RideId; until: number } | null = null;
  private bumperRun: { until: number; x: number; z: number; h: number; vx: number; vz: number; bumps: number; lastBump: number } | null = null;
  private navDest: { name: string; x: number; z: number } | null = null;
  private navPath: [number, number][] | null = null;
  private navCheck = 0;
  private navLine!: NavRoute;
  private npcs: Npc[] = [];
  readonly voices = new Voices();
  private nextChatter = 0;
  private greeted = new Map<number, number>();

  private hudAt = 0;
  private onHud: (h: CityHud) => void;
  private onBump?: () => void;
  private onNote?: (text: string) => void;

  constructor(private container: HTMLElement, self: CitySelf, opts: { onHud: (h: CityHud) => void; onBump?: () => void; onStar?: (s: StarFound) => void; onNote?: (text: string) => void }) {
    this.self = self;
    this.onHud = opts.onHud;
    this.onNote = opts.onNote;
    this.onBump = opts.onBump;
    this.onStar = opts.onStar;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // filmic colour and real reflections instead of flat cartoon shading
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 700);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.55;
    this.city = buildCity(this.scene);
    this.navLine = new NavRoute(this.scene);
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
    this.carRig.root.rotation.order = "YXZ"; // heading first, then nose up/down on ramps
    // park my car beside the plaza
    // my car waits at the edge of the plaza, pointing at the road
    const park = resolveCircle(self.x + 9, self.z + 7, CAR_RADIUS);
    this.car = { x: park.x, z: park.z, heading: Math.PI / 2, speed: 0, drift: 0 };
    this.scene.add(this.carRig.root);
    this.setPet(self.petId);

    // traffic
    for (const t of this.traffic) {
      // city traffic: plenty of yellow cabs among everyday cars in real-world colours
      const shapes = ["taxi", "sedan", "suv", "taxi", "muscle", "sedan", "coupe"] as const;
      const paints = [0xc9ccd1, 0x111316, 0xf2f2f2, 0x1d3557, 0x6b0f1a, 0x4a4e57, 0x2f4f3f, 0x8d99ae];
      const rig = makeCar("car-starter", { shape: shapes[t.id % shapes.length], tint: paints[t.id % paints.length], length: 4.5, lite: true });
      rig.root.position.set(t.x, 0, t.z); this.scene.add(rig.root); this.trafficRigs.push(rig);
    }
    // showroom cars at Velocity Motors
    (["car-super", "car-electric", "car-suv"] as CarId[]).forEach((id, i) => {
      const rig = makeCar(id, { length: 4.6 });
      const p = DEALER.showcase[i];
      rig.root.position.set(p.x, 0.35, p.z); rig.root.rotation.y = Math.PI / 2 + 0.4;
      this.scene.add(rig.root); this.showcase.push(rig);
    });

    this.buildStars();

    CityGame.current = this;
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  attachMinimap(canvas: HTMLCanvasElement | null) { this.mapCtx = canvas?.getContext("2d") ?? null; }
  setPaused(p: boolean) { this.paused = p; if (p) { this.keys.clear(); this.stick = null; this.steerAxis = null; } }
  /** Touch walking stick: x right, y forward, both -1…1 (null when released). */
  setStick(v: { x: number; y: number } | null) { this.stick = v; if (v) this.wake(); }
  /** Touch steering: -1 full left … 1 full right (null when released). */
  setSteer(v: number | null) { this.steerAxis = v; }
  /** Stars found so far (ids). */
  get foundStars() { return [...this.starsFound]; }
  press(key: string, down: boolean) { if (down) this.keys.add(key); else this.keys.delete(key); if (down) this.wake(); }
  /** Sound and voices can only start after the reader taps or presses a key. */
  private wake() { this.audio.start(); this.voices.unlock(); }

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
    this.carRig.root.rotation.order = "YXZ";
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
    if (this.race || this.lift.air) return;
    if (this.room || this.riding || this.eating || this.bumperRun) { if (!this.driving) this.onNote?.(this.riding ? "Wait for the ride to finish, or tap Get off." : this.eating ? "Finish your food first." : "Step outside to get in your car."); return; }
    this.wake();
    if (this.driving) {
      if (Math.abs(this.car.speed) > 4) { this.car.speed *= 0.3; }
      this.driving = false;
      const side = new THREE.Vector3(Math.cos(this.car.heading), 0, -Math.sin(this.car.heading)).multiplyScalar(2.4);
      const out = resolveCircle(this.car.x + side.x, this.car.z + side.z, 0.5);
      this.walker.set(out.x, 0, out.z);
      this.walkerY = groundAt(out.x, out.z);
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
        this.lift = { y: groundAt(spot.x, spot.z), vy: 0, air: false };
      }
      this.driving = true;
      this.rig.root.visible = false;
      if (this.pet) this.pet.visible = false;
      this.camYaw = this.car.heading + Math.PI;
    }
  }

  horn() { this.wake(); this.audio.horn(); }
  setMuted(m: boolean) { this.audio.muted = m; this.voices.muted = m; if (m) this.voices.stop(); }

  // ── Restaurants, the arcade and the fair ──────────────────────────────────
  get inside() { return this.room; }

  /** Walks through a restaurant or arcade door. Returns false when driving. */
  enterVenue(id: string) {
    const room = INTERIORS.find((r) => r.id === id);
    if (!room || this.driving || this.race) return false;
    this.wake();
    const e = interiorEntry(room);
    this.teleport(e.x, e.z, e.facing);
    this.camera.position.set(e.x, 3.2, e.z + 2.2);
    this.room = room;
    this.city.venues.showRoom(room.id);
    this.audio.door();
    this.spawnNpcs(room);
    const r = RESTAURANTS.find((x) => x.id === id);
    window.setTimeout(() => this.npcSay(id, r ? "chef" : "host", r ? `Welcome to ${r.name}! Order at the counter and grab any table.` : "Welcome to the Neon Arcade! Pick a machine and press start."), 450);
    return true;
  }

  /** Back out onto the street, in front of the door. */
  leaveVenue() {
    const room = this.room; if (!room) return;
    this.stopEating(false);
    const r = RESTAURANTS.find((x) => x.id === room.id);
    const door = r ? r.door : ARCADE.door;
    const facing = r ? (r.side < 0 ? Math.PI / 2 : -Math.PI / 2) : -Math.PI / 2;
    this.room = null;
    this.city.venues.showRoom(null);
    this.teleport(door.x + Math.sin(facing) * 1.5, door.z + Math.cos(facing) * 1.5, facing);
    this.audio.door();
  }

  /** Orders from the counter. The food is yours until you sit down and eat it. */
  order(item: string) {
    const room = this.room; if (!room || room.kind !== "restaurant") return;
    this.meal = { venue: room.id, item };
    this.audio.chime();
    this.npcSay(room.id, "chef", `One ${item}, coming right up! Find a seat.`);
  }

  /** Sits at a table and eats what you ordered. */
  sit(spotId: string) {
    const room = this.room; if (!room || !this.meal || this.eating) return false;
    const i = Number(spotId.split("-").pop());
    const t = TABLES(room)[i]; if (!t) return false;
    const seatX = t.x, seatZ = t.z + 1.75;
    this.walker.set(seatX, 0, seatZ); this.walkerY = 0; this.facing = Math.PI;
    this.rig.root.position.set(seatX, 0, seatZ); this.rig.root.rotation.y = Math.PI;
    this.rig.sit(true);
    const food = makeFood(this.meal.venue); food.position.set(t.x, 0.93, t.z + 0.6); this.scene.add(food);
    this.eating = { start: performance.now(), seatX, seatZ, food, nextBite: performance.now() + 900 };
    this.camYaw = 0.75; // over the shoulder, looking at the table
    return true;
  }

  private stopEating(finished: boolean) {
    const e = this.eating; if (!e) return;
    this.scene.remove(e.food);
    e.food.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.eating = null;
    this.rig.sit(false);
    this.walker.set(e.seatX, 0, e.seatZ + 0.8);
    this.camYaw = 0;
    if (finished) {
      const item = this.meal?.item ?? "meal";
      this.meal = null;
      this.energyUntil = performance.now() + ENERGY_TIME * 1000;
      this.audio.chime();
      this.onNote?.(`That ${item} hit the spot! You'll walk and drive faster for 2 minutes.`);
    }
  }

  /** Climbs aboard a ride at the fair. */
  ride(id: RideId) {
    if (this.driving || this.riding || this.race) return false;
    this.wake();
    this.riding = { id, until: performance.now() + RIDE_TIME[id] * 1000 };
    if (id === "drop") this.city.venues.startDrop(this.clock.elapsedTime);
    this.rig.root.visible = false;
    if (this.pet) this.pet.visible = false;
    this.audio.beep(true);
    return true;
  }

  stopRide() {
    const r = this.riding; if (!r) return;
    this.riding = null;
    const ride = RIDES.find((x) => x.id === r.id)!;
    this.walker.set(ride.spot.x, 0, ride.spot.z);
    this.rig.root.visible = true;
    if (this.pet) { this.pet.visible = true; this.pet.position.set(ride.spot.x + 1, 0, ride.spot.z); }
    this.camera.position.set(ride.spot.x, 5, ride.spot.z + 8);
    this.camYaw = 0;
  }

  // ── Directions ────────────────────────────────────────────────────────────
  /** Shows the way to a place (or clears directions with null). */
  navigateTo(dest: { name: string; x: number; z: number } | null) {
    this.navDest = dest;
    this.navPath = null;
    if (dest) this.reroute();
    else this.navLine.set(null);
  }
  get navigating() { return this.navDest; }
  private reroute() {
    if (!this.navDest) return;
    const p = this.getPose();
    this.navPath = findRoute(p.x, p.z, this.navDest.x, this.navDest.z);
    this.navLine.set(this.navPath);
  }
  private navHud(): CityHud["nav"] {
    const d = this.navDest; if (!d || !this.navPath) return null;
    const p = this.getPose();
    if (this.room) return { name: d.name, left: 0, turn: "straight", toCorner: 0, arrow: 180 };
    if (Math.hypot(p.x - d.x, p.z - d.z) < 9) {
      const name = d.name;
      this.navigateTo(null); this.audio.chime(); this.onNote?.(`You've arrived at ${name}!`);
      return null;
    }
    const prog = routeProgress(this.navPath, p.x, p.z);
    const now = performance.now();
    if (prog.offRoute > 16 && now - this.navCheck > 1500) { this.navCheck = now; this.reroute(); }
    const h = Math.atan2(prog.next[0] - p.x, prog.next[1] - p.z), cam = this.camYaw + Math.PI;
    return { name: d.name, left: Math.round(prog.left), turn: prog.turn, toCorner: Math.round(prog.toCorner), arrow: Math.round((-wrapAngle(h - cam) * 180) / Math.PI) };
  }

  // ── Bumper cars and fair treats ───────────────────────────────────────────
  startBumper() {
    if (this.driving || this.riding || this.bumperRun || this.race) return false;
    this.wake();
    const car = this.city.venues.bumper().player;
    car.visible = true;
    this.bumperRun = { until: performance.now() + 75_000, x: BUMPER.x, z: BUMPER.z + BUMPER.d / 2 - 2.5, h: Math.PI, vx: 0, vz: 0, bumps: 0, lastBump: 0 };
    this.rig.sit(true); if (this.pet) this.pet.visible = false;
    this.camYaw = 0;
    this.audio.beep(true);
    return true;
  }
  stopBumper() {
    const b = this.bumperRun; if (!b) return;
    this.bumperRun = null;
    this.city.venues.bumper().player.visible = false;
    this.walker.set(BUMPER.x, 0, BUMPER.z + BUMPER.d / 2 + 2.2);
    this.rig.sit(false); if (this.pet) { this.pet.visible = true; this.pet.position.set(this.walker.x + 1, 0, this.walker.z); }
    this.onNote?.(b.bumps ? `Bumper cars done: ${b.bumps} bumps!` : "Bumper cars done!");
  }
  private stepBumper(dt: number, k: Set<string>, now: number) {
    const b = this.bumperRun!;
    const stick = this.paused ? null : this.stick;
    const gas = stick ? stick.y : (k.has("w") ? 1 : 0) - (k.has("s") ? 1 : 0);
    const turn = stick ? -stick.x : (k.has("a") ? 1 : 0) - (k.has("d") ? 1 : 0);
    b.h += turn * dt * 2.6;
    b.vx += Math.sin(b.h) * gas * 14 * dt; b.vz += Math.cos(b.h) * gas * 14 * dt;
    const damp = Math.max(0, 1 - dt * 1.6); b.vx *= damp; b.vz *= damp;
    const sp = Math.hypot(b.vx, b.vz); if (sp > 8) { b.vx *= 8 / sp; b.vz *= 8 / sp; }
    b.x += b.vx * dt; b.z += b.vz * dt;
    const bump = (strength: number) => { if (now - b.lastBump > 350) { b.lastBump = now; b.bumps++; this.audio.bump(); if (strength > 4) this.onBump?.(); } };
    const minX = BUMPER.x - BUMPER.w / 2 + 1.3, maxX = BUMPER.x + BUMPER.w / 2 - 1.3, minZ = BUMPER.z - BUMPER.d / 2 + 1.3, maxZ = BUMPER.z + BUMPER.d / 2 - 1.3;
    if (b.x < minX || b.x > maxX) { b.x = Math.max(minX, Math.min(maxX, b.x)); b.vx *= -0.7; bump(Math.abs(b.vx)); }
    if (b.z < minZ || b.z > maxZ) { b.z = Math.max(minZ, Math.min(maxZ, b.z)); b.vz *= -0.7; bump(Math.abs(b.vz)); }
    const { player, cars, push } = this.city.venues.bumper();
    cars.forEach((c, i) => {
      const dx = b.x - c.position.x, dz = b.z - c.position.z, d = Math.hypot(dx, dz);
      if (d < 2.2 && d > 0.01) {
        const nx = dx / d, nz = dz / d, rel = b.vx * nx + b.vz * nz;
        b.x = c.position.x + nx * 2.2; b.z = c.position.z + nz * 2.2;
        b.vx += nx * (Math.max(0, -rel) * 1.4 + 3); b.vz += nz * (Math.max(0, -rel) * 1.4 + 3);
        push(i, -nx * 2.5, -nz * 2.5);
        bump(Math.abs(rel) + 3);
      }
    });
    player.position.set(b.x, 0, b.z); player.rotation.y = b.h;
    // you, sitting in it
    this.rig.root.position.set(b.x - Math.sin(b.h) * 0.12, 0.32, b.z - Math.cos(b.h) * 0.12); this.rig.root.rotation.y = b.h; this.facing = b.h;
    this.rig.update(dt, 0);
    this.walker.set(b.x, 0, b.z);
    this.audio.engine(true, Math.min(1, Math.hypot(b.vx, b.vz) / 8) * 0.5);
    if (now > b.until) this.stopBumper();
  }

  /** A quick fair treat: a little energy boost. */
  eatTreat(name: string) {
    this.wake();
    this.energyUntil = Math.max(this.energyUntil, performance.now() + 60_000);
    this.rig.gesture("interact");
    this.audio.bite();
    this.onNote?.(`Mmm, ${name.toLowerCase()}! A little energy boost for a minute.`);
  }

  /** Staff and customers inside a room, made the first time you walk in. */
  private spawnNpcs(room: Interior) {
    if (this.npcs.some((n) => n.room === room.id)) return;
    const add = (role: Npc["role"], character: string, x: number, z: number, facing: number, seed: number, seated = false) => {
      const rig = new AvatarRig(character, 1.8, { noWeapons: true });
      rig.root.position.set(x, 0, z); rig.root.rotation.y = facing;
      if (seated) rig.sit(true);
      this.scene.add(rig.root);
      this.npcs.push({ room: room.id, role, rig, home: new THREE.Vector3(x, 0, z), facing, seed, nextMove: performance.now() + 2000 + seed * 300, bubble: null, bubbleUntil: 0 });
    };
    const cast = ["sherlock-holmes", "alice", "sinbad", "musketeer", "odysseus", "robin-hood", "hercules", "king-arthur"];
    const k = INTERIORS.indexOf(room);
    if (room.kind === "restaurant") {
      const c = COUNTER(room);
      add("chef", cast[k % cast.length], room.x + 2.5, c.minZ - 1.1, 0, 11 + k);
      TABLES(room).forEach((t, i) => { if (i % 2 === k % 2) add("diner", cast[(k + i + 2) % cast.length], t.x, t.z - 1.75, 0, 20 + k * 4 + i, true); });
    } else {
      add("host", "alice", room.x + 4, room.z + room.d / 2 - 6, Math.PI + 0.6, 40);
      [1, 4, 6].forEach((ci, j) => {
        const p = cabinetPos(room, ci);
        add("gamer", cast[(j + 3) % cast.length], p.x + Math.sin(p.facing) * 1.25, p.z + Math.cos(p.facing) * 1.25, p.facing + Math.PI, 50 + j);
      });
    }
  }

  private npcSay(roomId: string, role: Npc["role"], text: string) {
    const n = this.npcs.find((x) => x.room === roomId && x.role === role); if (!n) return;
    if (n.bubble) n.rig.root.remove(n.bubble);
    n.bubble = speechBubble(text, role === "chef" ? "#c92a2a" : "#7c3aed"); n.bubble.position.y = 2.75; n.rig.root.add(n.bubble);
    n.bubbleUntil = performance.now() + 4200;
    n.rig.gesture("wave");
    this.voices.say(text, n.seed, 1, true);
  }

  private stepNpcs(dt: number, now: number) {
    const roomId = this.room?.id;
    for (const n of this.npcs) {
      const here = n.room === roomId;
      n.rig.root.visible = here;
      if (!here) continue;
      if (n.role === "gamer") {
        // step aside when you walk up to their machine
        const d = Math.hypot(this.walker.x - n.home.x, this.walker.z - n.home.z);
        const target = d < 2.4 ? n.home.clone().add(new THREE.Vector3(Math.sign(this.room!.x - n.home.x) * 1.4, 0, 1.6)) : n.home;
        const before = n.rig.root.position.clone();
        n.rig.root.position.lerp(target, Math.min(1, dt * 3));
        n.rig.update(dt, before.distanceTo(n.rig.root.position) / Math.max(dt, 1e-4));
      } else n.rig.update(dt, 0);
      if (now > n.nextMove) { n.nextMove = now + 2500 + ((n.seed * 977) % 3000); if (n.role !== "host") n.rig.gesture("interact"); }
      if (n.bubble && now > n.bubbleUntil) { n.rig.root.remove(n.bubble); n.bubble = null; }
    }
  }


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
    this.lift = GROUNDED;
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

  // ── People out walking ────────────────────────────────────────────────────
  private stepPeople(dt: number, t: number, now: number) {
    const me = this.driving ? { x: this.car.x, z: this.car.z } : { x: this.walker.x, z: this.walker.z };
    const blockers = [me, ...(this.driving ? [] : [{ x: this.car.x, z: this.car.z }])];
    this.walkers = stepWalkers(this.walkers, blockers, dt);
    const range = this.lowQuality ? 60 : 95;
    this.walkers.forEach((w, i) => {
      const p = routePoint(w.route, w.s);
      const near = Math.hypot(p.x - me.x, p.z - me.z) < range;
      let view = this.walkerViews[i];
      if (!near) { if (view) { view.rig.root.visible = false; if (view.pet) view.pet.visible = false; } return; }
      if (!view) {
        const rig = new AvatarRig(w.character, 1.75 * w.scale, { noWeapons: true });
        rig.root.position.set(p.x, 0, p.z); this.scene.add(rig.root);
        const pet = w.pet ? createPet(w.pet, this.loader, 0.7) : null;
        if (pet) { pet.position.set(p.x, 0, p.z); this.scene.add(pet); }
        view = this.walkerViews[i] = { rig, pet, bubble: null, bubbleUntil: 0, hop: 0 };
      }
      const prev = view.rig.root.position.clone();
      view.hop = Math.max(0, view.hop - dt * 2.5);
      view.rig.root.visible = true;
      view.rig.root.position.set(p.x, Math.sin(view.hop * Math.PI) * 0.6, p.z);
      const facing = p.heading + (w.dir < 0 ? Math.PI : 0);
      view.rig.root.rotation.y += wrapAngle(facing - view.rig.root.rotation.y) * Math.min(1, dt * 8);
      const speed = Math.hypot(p.x - prev.x, p.z - prev.z) / Math.max(dt, 1e-4);
      view.rig.update(dt, speed > 8 ? 0 : speed); // a jump after spawning isn't a sprint
      if (view.pet) { view.pet.visible = true; followOwner(view.pet, view.rig.root, dt, t, 1.2); }
      if (view.bubble && now > view.bubbleUntil) { view.rig.root.remove(view.bubble); view.bubble = null; }
    });
  }

  private walkerSay(i: number, text: string, ms = 1800) {
    const view = this.walkerViews[i]; if (!view) return;
    if (view.bubble) view.rig.root.remove(view.bubble);
    view.bubble = speechBubble(text); view.bubble.position.y = 2.7;
    view.rig.root.add(view.bubble);
    view.bubbleUntil = performance.now() + ms;
  }

  /** People say hello as you pass, and chat out loud around you. */
  private stepChatter(now: number) {
    if (this.paused || this.room || this.riding) return;
    const me = this.driving ? { x: this.car.x, z: this.car.z } : { x: this.walker.x, z: this.walker.z };
    let nearest = -1, nearestD = Infinity;
    const close: { i: number; d: number }[] = [];
    this.walkerViews.forEach((v, i) => {
      if (!v?.rig.root.visible) return;
      const p = v.rig.root.position, d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < nearestD) { nearestD = d; nearest = i; }
      if (d < 24) close.push({ i, d });
    });
    // a hello when you walk right past someone
    if (!this.driving && nearest >= 0 && nearestD < 3.2 && now - (this.greeted.get(nearest) ?? -1e9) > 45000 && now > this.nextChatter - 3000) {
      const line = GREETINGS[(nearest + Math.floor(now / 7000)) % GREETINGS.length];
      this.greeted.set(nearest, now);
      this.walkerSay(nearest, line, 2400);
      this.walkerViews[nearest]?.rig.gesture("wave");
      this.voices.say(line, this.walkers[nearest].id, 0.9);
      this.nextChatter = Math.max(this.nextChatter, now + 2500);
      return;
    }
    if (now < this.nextChatter || !close.length) return;
    const pick = close[Math.floor(Math.random() * close.length)];
    const line = CHATTER[Math.floor(Math.random() * CHATTER.length)];
    this.walkerSay(pick.i, line, 3800);
    this.voices.say(line, this.walkers[pick.i].id, this.driving ? 0 : Math.max(0, 1 - pick.d / 26));
    this.nextChatter = now + 4500 + Math.random() * 5000;
  }

  // ── Hidden stars ──────────────────────────────────────────────────────────
  private starKey() { return `city_stars_${this.self.userId}`; }

  private buildStars() {
    try { const saved = JSON.parse(localStorage.getItem(this.starKey()) || "[]"); if (Array.isArray(saved)) saved.forEach((id) => this.starsFound.add(String(id))); } catch { /* none yet */ }
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.36 : 0.85;
      if (i) shape.lineTo(Math.cos(a) * r, -Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, -Math.sin(a) * r);
    }
    const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 });
    starGeo.center();
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb300, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 });
    const beamGeo = new THREE.CylinderGeometry(0.35, 0.6, 26, 10, 1, true); beamGeo.translate(0, 13, 0);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const s of STARS) {
      if (this.starsFound.has(s.id)) continue;
      const root = new THREE.Group();
      const y = s.y ?? 1.3;
      root.position.set(s.x, y, s.z);
      const star = new THREE.Mesh(starGeo, starMat); root.add(star);
      const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.y = -y; root.add(beam);
      this.scene.add(root);
      this.stars.push({ id: s.id, root, x: s.x, y, z: s.z });
    }
  }

  private stepStars(t: number) {
    if (!this.stars.length) return;
    const px = this.driving ? this.car.x : this.walker.x, pz = this.driving ? this.car.z : this.walker.z;
    const py = (this.driving ? this.lift.y : this.walkerY) + 1;
    for (const s of this.stars) {
      s.root.children[0].rotation.y = t * 2;
      s.root.children[0].position.y = Math.sin(t * 2 + s.x) * 0.15;
      if (Math.hypot(px - s.x, pz - s.z) < (this.driving ? 3.2 : 2.2) && Math.abs(py - s.y) < 2.6) this.collectStar(s.id);
    }
  }

  private collectStar(id: string) {
    const i = this.stars.findIndex((s) => s.id === id);
    if (i < 0) return;
    this.scene.remove(this.stars[i].root);
    this.stars.splice(i, 1);
    this.starsFound.add(id);
    try { localStorage.setItem(this.starKey(), JSON.stringify([...this.starsFound])); } catch { /* still counts this visit */ }
    this.audio.chime();
    this.onStar?.({ id, found: this.starsFound.size, total: STARS.length });
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
    if (!this.driving) { const r = interiorAt(this.walker.x, this.walker.z); if (r !== this.room) { this.room = r; this.city.venues.showRoom(r?.id ?? null); } }
    if (this.riding && now > this.riding.until) { this.stopRide(); this.onNote?.("What a ride!"); }
    const energized = now < this.energyUntil;

    if (this.bumperRun) {
      this.stepBumper(dt, k, now);
      this.carRig.root.position.set(this.car.x, this.lift.y, this.car.z);
    } else if (this.riding) {
      this.rig.update(dt, 0);
      this.carRig.root.position.set(this.car.x, this.lift.y, this.car.z);
      this.audio.engine(false, 0);
    } else if (this.eating) {
      const e = this.eating;
      this.rig.root.position.set(e.seatX, 0, e.seatZ); this.rig.root.rotation.y = Math.PI;
      if (now > e.nextBite) { e.nextBite = now + 1500; this.rig.gesture("interact"); this.audio.bite(); }
      const p = (now - e.start) / (EAT_TIME * 1000);
      e.food.scale.setScalar(Math.max(0.25, 1 - p * 0.8));
      this.rig.update(dt, 0);
      if (this.pet) followOwner(this.pet, this.rig.root, dt, t, 1.4);
      if (p >= 1) this.stopEating(true);
      this.audio.engine(false, 0);
    } else if (this.driving) {
      const steer = this.steerAxis !== null && !this.paused ? -this.steerAxis : (k.has("a") ? 1 : 0) - (k.has("d") ? 1 : 0);
      const input = racingLocked ? { throttle: 0, brake: 1, steer: 0, handbrake: false }
        : this.lift.air ? { throttle: 0, brake: 0, steer: steer * 0.3, handbrake: false } // a little air control, no grip
          : { throttle: k.has("w") ? 1 : 0, brake: k.has("s") ? 1 : 0, steer, handbrake: k.has(" ") };
      const before = this.car;
      const spec = energized ? { ...CARS[this.carId], top: CARS[this.carId].top * 1.12, accel: CARS[this.carId].accel * 1.25 } : CARS[this.carId];
      const res = stepCar(this.car, input, spec, dt);
      this.car = res.car;
      // ramps: follow the slope, fly off the lip, bounce off the tall end
      const lifted = stepLift(this.lift, this.car.x, this.car.z, dt);
      if (lifted.blocked) {
        this.car = { ...before, speed: -before.speed * 0.25, drift: 0 };
        if (Math.abs(before.speed) > 3) { this.audio.bump(); this.onBump?.(); }
      } else {
        if (!this.lift.air && lifted.lift.air) this.audio.whoosh();
        if (lifted.landed > 4) this.audio.bump();
        this.lift = lifted.lift;
      }
      // people on the pavement: the car stops short and they hop out of the way
      this.walkers.forEach((w, i) => {
        const view = this.walkerViews[i]; if (!view?.rig.root.visible) return;
        const p = view.rig.root.position, dx = this.car.x - p.x, dz = this.car.z - p.z, d = Math.hypot(dx, dz);
        if (d < CAR_RADIUS + 0.8 && d > 0.01) {
          this.car.x = p.x + (dx / d) * (CAR_RADIUS + 0.8); this.car.z = p.z + (dz / d) * (CAR_RADIUS + 0.8);
          this.car.speed *= 0.15;
          if (now > view.bubbleUntil) { this.walkerSay(i, ["Whoa!", "Careful!", "Beep beep!", "Hey there!"][i % 4]); this.audio.horn(); }
          view.hop = 1;
        }
      });
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
      this.carRig.root.position.set(this.car.x, this.lift.y, this.car.z);
      this.carRig.root.rotation.y = this.car.heading + this.car.drift * 0.35;
      // nose up the ramp, then level out (and dip a little) in the air
      const on = rampAt(this.car.x, this.car.z);
      const pitchTarget = this.lift.air ? -Math.atan2(this.lift.vy, Math.max(6, Math.abs(this.car.speed))) * 0.7
        : on ? -Math.atan(on.ramp.height / on.ramp.length) * Math.cos(this.car.heading - on.ramp.heading) : 0;
      this.carPitch += (pitchTarget - this.carPitch) * Math.min(1, dt * (this.lift.air ? 3 : 12));
      this.carRig.root.rotation.x = this.carPitch;
      this.carRig.setMotion(this.car.speed, steer, dt);
      this.walker.set(this.car.x, 0, this.car.z);
      this.audio.engine(true, Math.min(1, Math.abs(this.car.speed) / CARS[this.carId].top));
    } else {
      // walk relative to the camera
      const stick = this.paused ? null : this.stick;
      const stickLen = stick ? Math.hypot(stick.x, stick.y) : 0;
      const fwd = stick ? (stickLen > 0.2 ? stick.y : 0) : (k.has("w") ? 1 : 0) - (k.has("s") ? 1 : 0);
      const side = stick ? (stickLen > 0.2 ? stick.x : 0) : (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
      const run = k.has("shift") || stickLen > 0.92;
      const yaw = this.camYaw + Math.PI; // direction the camera looks
      const dx = Math.sin(yaw) * fwd - Math.cos(yaw) * side, dz = Math.cos(yaw) * fwd + Math.sin(yaw) * side;
      let w = stepWalker(this.walker.x, this.walker.z, dx, dz, run, energized ? dt * 1.35 : dt);
      const g = groundAt(w.x, w.z);
      if (g - this.walkerY > 0.7) w = { ...w, x: this.walker.x, z: this.walker.z }; // too tall to step up
      else this.walkerY = g;
      const moved = Math.hypot(w.x - this.walker.x, w.z - this.walker.z) / Math.max(dt, 1e-4);
      this.walker.set(w.x, 0, w.z);
      if (w.facing !== null) this.facing = wrapAngle(this.facing + wrapAngle(w.facing - this.facing) * Math.min(1, dt * 12));
      this.rig.root.position.set(this.walker.x, this.walkerY, this.walker.z);
      this.rig.root.rotation.y = this.facing;
      this.rig.update(dt, moved);
      if (this.pet) followOwner(this.pet, this.rig.root, dt, t, 1.4);
      this.carRig.root.position.set(this.car.x, this.lift.y, this.car.z);
      this.carRig.root.rotation.y = this.car.heading;
      this.audio.engine(false, 0);
    }
    if (this.myBubble && now > this.myBubbleUntil) { this.rig.root.remove(this.myBubble); this.myBubble = null; }

    // traffic
    const obstacles = [{ x: this.car.x, z: this.car.z }, ...(this.driving ? [] : [{ x: this.walker.x, z: this.walker.z }])];
    for (const r of this.remotes.values()) obstacles.push({ x: r.rig.root.position.x, z: r.rig.root.position.z });
    this.traffic = stepTraffic(this.traffic, obstacles, dt, Date.now() / 1000);
    const camX = this.camera.position.x, camZ = this.camera.position.z;
    this.traffic.forEach((c, i) => {
      const rig = this.trafficRigs[i];
      // cars far beyond the fog aren't drawn at all
      rig.root.visible = !this.room && Math.hypot(c.x - camX, c.z - camZ) < 190;
      if (!rig.root.visible) return;
      rig.root.position.set(c.x, 0, c.z); rig.root.rotation.y = c.heading; rig.setMotion(c.speed, 0, dt);
    });

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
    this.stepPeople(dt, t, now);
    this.stepNpcs(dt, now);
    this.stepChatter(now);
    this.stepStars(t);
    this.audio.ambience(this.soundscape(), dt);

    this.updateCamera(dt);
    this.sun.position.set(this.walker.x - 40, 70, this.walker.z - 30);
    this.sun.target.position.set(this.walker.x, 0, this.walker.z);
    this.city.update(t, dt);
    this.navLine.update(t);
    this.renderer.render(this.scene, this.camera);

    if (now - this.hudAt > 120) {
      this.hudAt = now;
      const pose = this.getPose();
      const spot = this.riding || this.eating || this.bumperRun ? null : nearestSpot(pose.x, pose.z);
      this.onHud({
        driving: this.driving, speed: this.driving ? dashSpeed(this.car.speed) : 0, area: areaName(pose.x, pose.z), spot,
        nearCar: !this.driving && Math.hypot(this.car.x - this.walker.x, this.car.z - this.walker.z) < 7,
        race: this.raceHud(now), carName: CARS[this.carId].name,
        airborne: this.lift.air, stars: this.starsFound.size, starsTotal: STARS.length,
        room: this.room ? { id: this.room.id, kind: this.room.kind, name: this.room.name } : null,
        meal: this.meal?.item ?? null,
        eating: this.eating ? Math.min(1, (now - this.eating.start) / (EAT_TIME * 1000)) : null,
        energy: Math.max(0, Math.ceil((this.energyUntil - now) / 1000)),
        ride: this.riding ? { id: this.riding.id, name: RIDES.find((r) => r.id === this.riding!.id)!.name, left: Math.max(0, Math.ceil((this.riding.until - now) / 1000)) } : null,
        nav: this.navHud(),
        bumper: this.bumperRun ? { left: Math.max(0, Math.ceil((this.bumperRun.until - now) / 1000)), bumps: this.bumperRun.bumps } : null,
      });
      if (this.mapCtx && !this.room) {
        const dots: MapDot[] = [];
        for (const r of this.remotes.values()) dots.push({ x: r.target.x, z: r.target.z, color: "#a78bfa", size: 3 });
        for (const c of this.traffic) dots.push({ x: c.x, z: c.z, color: "rgba(255,255,255,.45)", size: 1.6 });
        if (!this.driving) dots.push({ x: this.car.x, z: this.car.z, color: "#5eead4", size: 3 });
        this.minimap.draw(this.mapCtx, { x: pose.x, z: pose.z, heading: pose.facing }, dots, this.navPath);
      }
    }
  };

  private updateCamera(dt: number) {
    if (this.bumperRun) {
      const b = this.bumperRun, yaw = b.h + Math.PI;
      this.camYaw = this.camYaw + wrapAngle(yaw - this.camYaw) * Math.min(1, dt * 4);
      const desired = new THREE.Vector3(b.x + Math.sin(this.camYaw) * 4.6, 4.4, b.z + Math.cos(this.camYaw) * 4.6);
      this.camera.position.lerp(desired, Math.min(1, dt * 6));
      // look a little past your car so you can see who you're about to bump
      this.camera.lookAt(b.x - Math.sin(this.camYaw) * 3, 0.6, b.z - Math.cos(this.camYaw) * 3);
      return;
    }
    if (this.riding) {
      const seat = this.city.venues.rideSeat(this.riding.id);
      const eye = seat.pos.clone();
      eye.y += this.riding.id === "wheel" ? -1.2 : this.riding.id === "carousel" ? 1.35 : 1.1;
      // on the wheel, sit at the front edge of the cabin so the rim isn't in your face
      if (this.riding.id === "wheel") eye.x -= 2.1;
      this.camera.position.copy(eye);
      this.camera.lookAt(seat.look);
      return;
    }
    if (this.room) {
      // indoors: a closer camera that never leaves the room
      const r = this.room, tgt = new THREE.Vector3(this.walker.x, 0, this.walker.z);
      const dist = this.eating ? 3.2 : 4.2;
      const desired = new THREE.Vector3(tgt.x + Math.sin(this.camYaw) * dist, (this.eating ? 2.1 : 2.3) + Math.max(0, this.camPitch - 0.32) * 2.5, tgt.z + Math.cos(this.camYaw) * dist);
      desired.x = Math.max(r.x - r.w / 2 + 0.8, Math.min(r.x + r.w / 2 - 0.8, desired.x));
      desired.z = Math.max(r.z - r.d / 2 + 0.8, Math.min(r.z + r.d / 2 - 0.8, desired.z));
      desired.y = Math.min(5.3, desired.y);
      if (this.camera.position.distanceTo(desired) > 30) this.camera.position.copy(desired);
      else this.camera.position.lerp(desired, Math.min(1, dt * 9));
      // look a little past the reader so the room is in view, not the floor
      const ahead = this.eating ? 0.6 : 2.2;
      this.camera.lookAt(tgt.x - Math.sin(this.camYaw) * ahead, this.eating ? 1 : 1.45, tgt.z - Math.cos(this.camYaw) * ahead);
      return;
    }
    const target = this.driving ? new THREE.Vector3(this.car.x, this.lift.y * 0.8, this.car.z) : new THREE.Vector3(this.walker.x, this.walkerY, this.walker.z);
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
    const desired = new THREE.Vector3(cx, target.y + height + Math.sin(pitch) * dist * 0.5, cz);
    this.camera.position.lerp(desired, Math.min(1, dt * (this.driving ? 6 : 9)));
    this.camera.lookAt(target.x, target.y + (this.driving ? 1.4 : 1.6), target.z);
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
  // Only one finger (or the mouse) turns the camera: the one that pressed the
  // view first. Fingers on the joystick or pedals never move the camera.
  private dragging: { id: number; x: number; y: number } | null = null;
  private onPointerDown = (e: PointerEvent) => {
    this.audio.start();
    if (this.dragging) return;
    this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.dragging.id) return;
    const dx = e.clientX - this.dragging.x, dy = e.clientY - this.dragging.y;
    this.dragging.x = e.clientX; this.dragging.y = e.clientY;
    const touch = e.pointerType === "touch" ? 1.5 : 1;
    this.camYaw -= dx * 0.006 * touch;
    this.camPitch = Math.max(0.08, Math.min(0.9, this.camPitch + dy * 0.004 * touch));
    this.lastDrag = performance.now();
  };
  private onPointerUp = (e: PointerEvent) => { if (this.dragging?.id === e.pointerId) this.dragging = null; };
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
    window.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /** What the city sounds like where you are: busy downtown, the beach, the fair, indoors. */
  private soundscape() {
    const x = this.driving ? this.car.x : this.walker.x, z = this.driving ? this.car.z : this.walker.z;
    const room = this.room;
    let near = 0;
    for (const c of this.traffic) { const d = Math.hypot(c.x - x, c.z - z); if (d < 40) near += 1 - d / 40; }
    let crowd = 0;
    this.walkerViews.forEach((v) => { if (v?.rig.root.visible) { const p = v.rig.root.position, d = Math.hypot(p.x - x, p.z - z); if (d < 30) crowd += 1 - d / 30; } });
    let train = 0;
    for (const car of this.city.venues.trainCars()) train = Math.max(train, 1 - Math.hypot(car.position.x - x, car.position.z - z) / 70);
    const downtown = Math.abs(x) < 160 && z < 40 && z > -210 ? 1 : 0;
    return {
      indoor: room ? room.kind : null,
      traffic: room ? 0 : Math.min(1, near / 3 + downtown * 0.25),
      crowd: room ? 0.5 : Math.min(1, crowd / 4 + downtown * 0.15),
      beach: room ? 0 : Math.max(0, Math.min(1, (-150 - x) / 70)),
      fair: room ? 0 : x > 322 && z > -300 && z < -62 ? 1 : Math.max(0, 1 - Math.hypot(Math.max(0, 322 - x), Math.max(0, -300 - z, z + 62)) / 60),
      train: room ? 0 : Math.max(0, train),
      park: room ? 0 : x > 170 && x < 322 && z > -90 ? 1 : 0,
    };
  }

  /** Moves the reader (on foot or in the car) to a spot. */
  teleport(x: number, z: number, facing: number) {
    if (this.bumperRun) this.stopBumper();
    if (this.riding) this.stopRide();
    if (this.driving) { this.car = { x, z, heading: facing, speed: 0, drift: 0 }; this.lift = { y: groundAt(x, z), vy: 0, air: false }; this.camYaw = facing + Math.PI; }
    else { this.walker.set(x, 0, z); this.walkerY = groundAt(x, z); this.facing = facing; this.camYaw = facing + Math.PI; }
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
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.endRace();
    this.rig.dispose();
    this.carRig.dispose();
    this.trafficRigs.forEach((r) => r.dispose());
    this.showcase.forEach((r) => r.dispose());
    for (const r of this.remotes.values()) { r.rig.dispose(); r.car?.dispose(); }
    this.walkerViews.forEach((v) => v?.rig.dispose());
    this.npcs.forEach((n) => n.rig.dispose());
    this.voices.stop();
    this.navLine.dispose();
    this.audio.dispose();
    this.city.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat) => { (mat as THREE.MeshBasicMaterial).map?.dispose(); mat.dispose(); });
    });
    this.envMap?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
