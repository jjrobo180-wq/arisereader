import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ArrowLeft, DoorOpen, Hand, Home, Lock, LocateFixed, Map as MapIcon, ShoppingBag, Unlock, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { createPet, findPetRoot, openPetCare } from "@/lib/pets";
import { createWorldExit } from "@/lib/worldPortal";
import { AvatarRig, followOwner, hashParam, loadGltfCached, nameTag } from "@/lib/worldAvatar";
import { HOME_MODELS } from "@/lib/worldModels";
import { homeInfo } from "@/lib/homes";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";
import MobileJoystick from "@/components/MobileJoystick";
import { addHalloreadHomeDecor, addHalloreadSceneDecor, HALLOREAD_ACTIVE } from "@/lib/halloread";

type Visitor = { userId: number; displayName: string; characterId: string; petId: string; homeId: string; lot: number; x: number; z: number; facing: number; updatedAt: number };
type Property = { ownerId: number; displayName: string; homeId: string; propertyId: string; lot: number; x: number; z: number; unlocked: boolean; updatedAt: number };

// World layout (server presence allows x ±44, z ±30).
const WX = 44, WZ = 30;
const ROAD_HALF = 3.6, WALK_OUT = 6;
const PARK_X = 39;
const doorOf = (h: { x: number; z: number }) => ({ x: h.x, z: h.z > 0 ? h.z - 5.1 : h.z + 5.1 });

const NIGHT = HALLOREAD_ACTIVE || (() => { const h = new Date().getHours(); return h >= 19 || h < 6; })();

function canvasTexture(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, repeat: [number, number]) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  draw(cv.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const noise = (c: CanvasRenderingContext2D, s: number, base: string, dots: string[], n: number, r = 2) => {
  c.fillStyle = base; c.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) { c.fillStyle = dots[i % dots.length]; c.fillRect(Math.random() * s, Math.random() * s, r * Math.random() + 1, r * Math.random() + 1); }
};

function mat(color: number, rough = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); }
function boxMesh(size: [number, number, number], pos: [number, number, number], m: THREE.Material, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), m); mesh.position.set(...pos);
  mesh.castShadow = shadow; mesh.receiveShadow = true; return mesh;
}

function tree(kind: number, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 8), mat(0x7c4a24)); trunk.position.y = 0.9; trunk.castShadow = true; g.add(trunk);
  const leaf = mat(NIGHT ? 0x2f6b3a : [0x4caf50, 0x3f9e4b, 0x66bb6a, 0x8bc34a][kind % 4], 0.9);
  if (kind % 2 === 0) {
    for (const [y, r] of [[2.4, 1.3], [3.2, 1.0], [3.9, 0.65]]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.4, 9), leaf); cone.position.y = y; cone.castShadow = true; g.add(cone); }
  } else {
    for (const [x, y, z, r] of [[0, 2.6, 0, 1.25], [0.6, 2.2, 0.3, 0.85], [-0.55, 2.3, -0.2, 0.9], [0, 3.3, 0, 0.8]]) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf); ball.position.set(x, y, z); ball.castShadow = true; g.add(ball);
    }
  }
  g.scale.setScalar(scale); return g;
}

function streetLamp(lights: THREE.Group, withLight: boolean) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 8), mat(0x1f2937, 0.4, { metalness: 0.6 })); pole.position.y = 2.1; pole.castShadow = true; g.add(pole);
  const arm = boxMesh([0.08, 0.08, 1], [0, 4.15, 0.45], mat(0x1f2937, 0.4, { metalness: 0.6 })); g.add(arm);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xffd88a, emissiveIntensity: NIGHT ? 3 : 0.4 })); bulb.position.set(0, 4.0, 0.9); g.add(bulb);
  if (withLight && NIGHT) { const l = new THREE.PointLight(0xffd59a, 9, 13, 1.8); l.position.set(0, 3.8, 0.9); g.add(l); lights.add(g); }
  return g;
}

function bench() {
  const g = new THREE.Group(); const wood = mat(0xb7793f), metal = mat(0x334155, 0.5, { metalness: 0.5 });
  g.add(boxMesh([2.2, 0.12, 0.6], [0, 0.55, 0], wood)); g.add(boxMesh([2.2, 0.5, 0.1], [0, 0.95, -0.28], wood));
  for (const x of [-0.95, 0.95]) g.add(boxMesh([0.1, 0.55, 0.5], [x, 0.28, 0], metal));
  return g;
}

function fence(len: number) {
  const g = new THREE.Group(); const white = mat(0xf8fafc, 0.7);
  g.add(boxMesh([len, 0.12, 0.08], [0, 0.55, 0], white, false)); g.add(boxMesh([len, 0.12, 0.08], [0, 0.95, 0], white, false));
  for (let x = -len / 2; x <= len / 2 + 0.01; x += 0.7) g.add(boxMesh([0.12, 1.2, 0.1], [x, 0.6, 0], white, false));
  return g;
}

function flowerBed(w: number) {
  const g = new THREE.Group();
  g.add(boxMesh([w, 0.25, 0.8], [0, 0.12, 0], mat(0x6b4226), false));
  const colors = [0xf43f5e, 0xfacc15, 0xa855f7, 0xffffff, 0xfb923c];
  for (let i = 0; i < w * 3; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], emissive: colors[i % colors.length], emissiveIntensity: 0.12 }));
    f.position.set(-w / 2 + 0.2 + Math.random() * (w - 0.4), 0.35 + Math.random() * 0.1, -0.25 + Math.random() * 0.5); g.add(f);
  }
  return g;
}

function mailbox(color: number) {
  const g = new THREE.Group();
  g.add(boxMesh([0.12, 1.1, 0.12], [0, 0.55, 0], mat(0x6b4226)));
  const box = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 12, 1, false, 0, Math.PI), mat(color, 0.5, { metalness: 0.3 }));
  box.rotation.z = Math.PI / 2; box.rotation.y = Math.PI / 2; box.position.y = 1.15; g.add(box);
  g.add(boxMesh([0.5, 0.25, 0.7], [0, 1.03, 0], mat(color, 0.5, { metalness: 0.3 })));
  const flag = boxMesh([0.05, 0.35, 0.12], [0.28, 1.3, 0.15], mat(0xef4444)); g.add(flag);
  return g;
}

export default function Neighborhood() {
  const { token } = useAuth(); const [, navigate] = useLocation();
  const [leavingWorld, setLeavingWorld] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const selfRigRef = useRef<AvatarRig | null>(null);
  const selfPetRef = useRef<THREE.Object3D | null>(null);
  const remoteRef = useRef(new Map<number, { rig: AvatarRig; pet: THREE.Object3D | null; target: THREE.Vector3; facing: number; petId: string; characterId: string }>());
  const propertyRootsRef = useRef(new Map<string, THREE.Group>());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const targetRef = useRef(new THREE.Vector3());
  const keysRef = useRef(new Set<string>());
  const enteringRef = useRef(false);
  const homesRef = useRef<Property[]>([]);
  const [self, setSelf] = useState<Visitor | null>(null);
  const [players, setPlayers] = useState<Visitor[]>([]);
  const [homes, setHomes] = useState<Property[]>([]);
  const [myHome, setMyHome] = useState<Property | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("Walk with the joystick or tap the ground. Walk up to a front door to go inside.");
  const [showReaders, setShowReaders] = useState(false);
  const [nearDoor, setNearDoor] = useState<Property | null>(null);
  const headers = useMemo(() => ({ Authorization: "Bearer " + token, "Content-Type": "application/json" }), [token]);
  const selfId = self?.userId;

  useEffect(() => { homesRef.current = homes; }, [homes]);

  useEffect(() => {
    if (!token) return; let active = true;
    Promise.all([
      fetch(API_BASE + "/api/neighborhood/bootstrap", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }).then(async r => { const d = await r.json(); if (!r.ok) throw Error(d.message || "Could not enter The Block."); return d; }),
      fetch(API_BASE + "/api/homes/neighborhood", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }).then(async r => { const d = await r.json(); if (!r.ok) throw Error(d.message || "Could not load homes."); return d; }),
    ]).then(([world, property]) => {
      if (!active) return;
      const me: Visitor = world.self;
      // Coming back out of a house? Start on that house's front step.
      const from = Number(hashParam("from"));
      const house = (property.homes || []).find((h: Property) => h.ownerId === from);
      if (from) { try { const u = new URL(window.location.href); u.search = ""; window.history.replaceState(window.history.state, "", u.href); } catch { /* ignore */ } }
      if (house) { const d = doorOf(house); me.x = d.x; me.z = d.z + (house.z > 0 ? -1.6 : 1.6); me.facing = house.z > 0 ? Math.PI : 0; }
      setSelf(me); setPlayers(world.players || []); setHomes(property.homes || []); setMyHome(property.myHome || null);
    }).catch(error => { if (active) setNotice(error.message); });
    return () => { active = false; void fetch(API_BASE + "/api/neighborhood/leave", { method: "POST", headers: { Authorization: "Bearer " + token }, keepalive: true }).catch(() => { }); };
  }, [token]);

  const focusCamera = (x: number, z: number) => {
    const camera = cameraRef.current, controls = controlsRef.current; if (!camera || !controls) return;
    const focus = new THREE.Vector3(x, 1.5, z); camera.position.add(focus.clone().sub(controls.target)); controls.target.copy(focus); controls.update();
  };
  const walkToDoor = (home: Property) => { const d = doorOf(home); targetRef.current.set(d.x, 0, d.z + (home.z > 0 ? -0.9 : 0.9)); };
  const goHome = () => {
    if (!myHome) { setNotice("You do not own a home yet. Buy one in Avatar World first."); return; }
    walkToDoor(myHome); setNotice("Walking to your front door…");
  };
  const walkTo = (p: Visitor) => { targetRef.current.set(p.x + 1.5, 0, p.z); setShowReaders(false); setNotice("Walking to " + p.displayName + "…"); };
  const enterHome = (home: Property) => {
    if (enteringRef.current) return;
    if (home.ownerId !== selfId && !home.unlocked) { setNotice("🔒 " + home.displayName + "'s door is locked. Ask them to unlock it!"); return; }
    enteringRef.current = true; setNotice("Opening the door…");
    navigate("/my-home?owner=" + home.ownerId);
  };
  const wave = () => { selfRigRef.current?.gesture("wave"); setNotice("👋 You waved to the neighborhood!"); };

  // ── Build the world ──
  useEffect(() => {
    const mount = mountRef.current; if (!mount || !self) return; let disposed = false;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    const horizon = NIGHT ? 0x3b3570 : 0xcfe9ff, zenith = NIGHT ? 0x0d0c2e : 0x5aaef0;
    scene.fog = new THREE.Fog(horizon, 60, 150);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(zenith) }, bottom: { value: new THREE.Color(horizon) } },
      vertexShader: "varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h=clamp(normalize(vP).y*1.6,0.,1.); gl_FragColor=vec4(mix(bottom,top,h),1.); }",
    }));
    scene.add(sky);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400); camera.position.set(self.x, 10, self.z + (self.z > 0 ? -15 : 15)); cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.3 : 1.0;
    mount.innerHTML = ""; mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(self.x, 1.4, self.z); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.46; controls.minPolarAngle = 0.3;
    controls.minDistance = 6; controls.maxDistance = 34; controls.enablePan = false; controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE; controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(NIGHT ? 0xb4b8ff : 0xffffff, NIGHT ? 0x2a2440 : 0x6a8f58, NIGHT ? 2.0 : 2.2));
    const sun = new THREE.DirectionalLight(NIGHT ? 0xc7d2fe : 0xfff1d6, NIGHT ? 1.6 : 2.8);
    sun.position.set(-30, 45, 22); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -52; sc.right = 52; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 140; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    scene.add(sun);
    if (HALLOREAD_ACTIVE) addHalloreadSceneDecor(scene, "neighborhood");
    else if (NIGHT) { const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf8fafc })); moon.position.set(-40, 50, -90); scene.add(moon); }
    if (NIGHT) { // stars
      const pts = new Float32Array(900); for (let i = 0; i < 300; i++) { const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.3; pts.set([Math.cos(a) * Math.cos(e) * 160, Math.sin(e) * 160, Math.sin(a) * Math.cos(e) * 160], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, fog: false })));
    }

    // Ground: grass, road, sidewalks, driveways.
    const grassTex = canvasTexture(256, (c, s) => noise(c, s, NIGHT ? "#4f8a4a" : "#7cc56a", NIGHT ? ["#457d41", "#5a9752"] : ["#6db35c", "#8ed37a", "#74bd62"], 2600), [30, 22]);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WX * 2 + 40, WZ * 2 + 40), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.ground = true; scene.add(ground);
    const roadTex = canvasTexture(256, (c, s) => {
      noise(c, s, "#3b4350", ["#353c48", "#444c59", "#2f3540"], 3000);
      c.fillStyle = "#facc15"; c.fillRect(0, s / 2 - 4, s * 0.55, 8);
    }, [16, 1]);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(PARK_X * 2 - 6, ROAD_HALF * 2), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }));
    road.rotation.x = -Math.PI / 2; road.position.set(-3, 0.02, 0); road.receiveShadow = true; road.userData.ground = true; scene.add(road);
    const walkTex = canvasTexture(128, (c, s) => { noise(c, s, "#d9dde3", ["#cfd4da", "#e3e6ea"], 600); c.strokeStyle = "#b8bec7"; c.lineWidth = 3; c.strokeRect(0, 0, s, s); }, [40, 1]);
    for (const z of [-(ROAD_HALF + 1.2), ROAD_HALF + 1.2]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(PARK_X * 2 - 6, 0.12, 2.4), new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.9 }));
      walk.position.set(-3, 0.06, z); walk.receiveShadow = true; walk.userData.ground = true; scene.add(walk);
      const curb = boxMesh([PARK_X * 2 - 6, 0.16, 0.18], [-3, 0.08, Math.sign(z) * ROAD_HALF], mat(0xeef0f3), false); scene.add(curb);
    }

    // Entrance arch on the west end (and the way back to Games).
    const arch = new THREE.Group(); arch.position.set(-40, 0, 0);
    const brick = mat(0xb45309, 0.8);
    arch.add(boxMesh([0.7, 6.2, 0.7], [0, 3.1, -5.2], brick)); arch.add(boxMesh([0.7, 6.2, 0.7], [0, 3.1, 5.2], brick)); arch.add(boxMesh([0.6, 0.6, 11.2], [0, 6.5, 0], brick));
    for (const z of [-5.2, 5.2]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xfbbf24, emissiveIntensity: NIGHT ? 1.6 : 0.4 })); cap.position.set(0, 6.6, z); arch.add(cap); }
    const archSign = nameTag(HALLOREAD_ACTIVE ? "🎃 THE BLOCK 🎃" : "WELCOME TO THE BLOCK", "#7c2d12"); archSign.position.set(0, 7.6, 0); archSign.scale.set(6, 1.45, 1); arch.add(archSign);
    scene.add(arch);
    const exit = createWorldExit(scene, -42.5, 0, 0x38bdf8); exit.rotation.y = Math.PI / 2;
    for (const z of [-9, 9]) { const fb = flowerBed(5); fb.position.set(-40, 0, z); fb.rotation.y = Math.PI / 2; scene.add(fb); }

    // Park on the east end: fountain, playground, benches, pond.
    const park = new THREE.Group(); park.position.set(PARK_X, 0, 0); scene.add(park);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48), new THREE.MeshStandardMaterial({ map: walkTex.clone(), roughness: 0.9 }));
    (plaza.material as THREE.MeshStandardMaterial).map!.repeat.set(4, 4); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.05; plaza.receiveShadow = true; plaza.userData.ground = true; park.add(plaza);
    const stone = mat(0xcbd5e1, 0.6);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 32, 1, true), stone); basin.position.y = 0.35; basin.castShadow = true; park.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.18, 8, 40), stone); rim.rotation.x = Math.PI / 2; rim.position.y = 0.72; park.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x0c4a6e, emissiveIntensity: NIGHT ? 0.8 : 0.2 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.55; park.add(water);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.2, 16), stone); column.position.y = 1.1; park.add(column);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.4, 0.4, 24), stone); bowl.position.y = 2.2; park.add(bowl);
    const spray = new THREE.Group(); park.add(spray);
    const dropMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 });
    const drops: THREE.Mesh[] = []; for (let i = 0; i < 40; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), dropMat); d.userData.phase = Math.random(); d.userData.angle = (i / 40) * Math.PI * 2; spray.add(d); drops.push(d); }
    if (NIGHT) { const fl = new THREE.PointLight(0x7dd3fc, 6, 10, 2); fl.position.set(0, 1.5, 0); park.add(fl); }
    for (const [x, z, r] of [[0, -5.6, 0], [0, 5.6, Math.PI], [-4.5, -3.4, 0.6], [-4.5, 3.4, Math.PI - 0.6]] as [number, number, number][]) { const b = bench(); b.position.set(x, 0, z); b.rotation.y = r; park.add(b); }
    // swings
    const swing = new THREE.Group(); swing.position.set(1, 0, -11); park.add(swing);
    const red = mat(0xef4444, 0.5, { metalness: 0.3 });
    for (const x of [-2.2, 2.2]) for (const s of [-1, 1]) { const leg = boxMesh([0.14, 3.6, 0.14], [x, 1.7, s * 0.8], red); leg.rotation.x = -s * 0.22; swing.add(leg); }
    swing.add(boxMesh([4.6, 0.16, 0.16], [0, 3.45, 0], red));
    const seats: THREE.Group[] = [];
    for (const x of [-1, 1]) { const seat = new THREE.Group(); seat.position.set(x, 3.4, 0); for (const sx of [-0.3, 0.3]) seat.add(boxMesh([0.03, 2.6, 0.03], [sx, -1.3, 0], mat(0x94a3b8), false)); seat.add(boxMesh([0.8, 0.08, 0.4], [0, -2.6, 0], mat(0x1d4ed8))); swing.add(seat); seats.push(seat); }
    // slide
    const slide = new THREE.Group(); slide.position.set(1, 0, 11); park.add(slide);
    slide.add(boxMesh([1.4, 2.4, 1.4], [-1.5, 1.2, 0], mat(0xfacc15)));
    const chute = boxMesh([3.2, 0.12, 1.1], [0.6, 1.25, 0], mat(0x22c55e, 0.4)); chute.rotation.z = -0.62; slide.add(chute);
    for (let i = 0; i < 4; i++) slide.add(boxMesh([0.9, 0.08, 0.3], [-2.4, 0.4 + i * 0.6, 0], mat(0x64748b)));
    const parkSign = nameTag("SUNNY PARK", "#166534"); parkSign.position.set(-6.8, 3, 0); parkSign.scale.set(4.2, 1, 1); park.add(parkSign);

    // Street lamps, trees, fences behind the houses.
    const lampLights = new THREE.Group(); scene.add(lampLights);
    let lampIndex = 0;
    for (let x = -31.5; x <= 32; x += 10.5) for (const s of [-1, 1]) {
      const lamp = streetLamp(lampLights, lampIndex++ % 3 === 0); lamp.position.set(x, 0, s * (WALK_OUT + 0.3)); lamp.rotation.y = s > 0 ? Math.PI : 0; scene.add(lamp);
    }
    const blockers: Array<{ x: number; z: number; r: number }> = [{ x: PARK_X, z: 0, r: 3.1 }, { x: PARK_X + 1, z: -11, r: 2.6 }, { x: PARK_X - 0.5, z: 11, r: 2 }, { x: -40, z: -5, r: 0.9 }, { x: -40, z: 5, r: 0.9 }];
    let kind = 0;
    for (const s of [-1, 1]) {
      const f = fence(64); f.position.set(0, 0, s * 21); scene.add(f);
      for (let x = -38; x <= 38; x += 4.6) { const t = tree(kind++, 0.9 + Math.random() * 0.5); const z = s * (23.5 + Math.random() * 4); t.position.set(x + Math.random() * 1.5, 0, z); t.rotation.y = Math.random() * 6; scene.add(t); }
    }
    for (const [x, z] of [[-37, -14], [-35, 14], [-38, 20], [33, -17], [45, -9], [45, 7], [34, 18], [44, 17], [33, 6.5], [33, -6.5]]) {
      const t = tree(kind++, 1.1 + Math.random() * 0.3); t.position.set(x, 0, z); scene.add(t); blockers.push({ x, z, r: 0.8 });
    }
    // drifting clouds
    const clouds = new THREE.Group(); scene.add(clouds);
    if (!NIGHT) {
      const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25, fog: false });
      for (let i = 0; i < 9; i++) {
        const cl = new THREE.Group(); for (let j = 0; j < 4; j++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 1.8, 1), cm); p.position.set(j * 2.4 - 3.6, Math.random() * 0.8, Math.random() * 1.5); p.scale.y = 0.6; cl.add(p); }
        cl.position.set(-80 + i * 20, 32 + Math.random() * 10, -60 + Math.random() * 120); clouds.add(cl);
      }
    }

    // ── Avatars ──
    const myRig = new AvatarRig(self.characterId, 2.15); selfRigRef.current = myRig;
    const spawnBlocked = Math.abs(self.z) > 20.6 || Math.abs(self.x) > WX || (homesRef.current.some(h => Math.abs(self.x - h.x) < 3.3 && Math.abs(self.z - h.z) < 3.4));
    if (spawnBlocked) { self.x = -34; self.z = 1.6; self.facing = Math.PI / 2; }
    // Start behind the player, looking down the street.
    if (self.x < -30) { camera.position.set(self.x - 3, 12, self.z + 14); controls.target.set(self.x + 1.5, 1.4, self.z); controls.update(); }
    myRig.root.position.set(self.x, 0, self.z); myRig.root.rotation.y = self.facing;
    const myTag = nameTag(self.displayName, "#0369a1"); myTag.position.y = 2.9; myTag.scale.multiplyScalar(0.7); myRig.root.add(myTag);
    scene.add(myRig.root); targetRef.current.set(self.x, 0, self.z);
    const myPet = createPet(self.petId, new GLTFLoader(), 0.9);
    if (myPet) { myPet.position.set(self.x + 1, 0, self.z + 1); scene.add(myPet); }
    selfPetRef.current = myPet;

    // Collision: houses + park objects + bounds.
    const blocked = (x: number, z: number) => {
      if (Math.abs(x) > WX || Math.abs(z) > WZ - 1) return true;
      if (Math.abs(z) > 20.6) return true; // back fences
      for (const h of homesRef.current) if (Math.abs(x - h.x) < 3.25 && Math.abs(z - h.z) < 3.35) return true;
      for (const b of blockers) if (Math.hypot(x - b.x, z - b.z) < b.r) return true;
      return false;
    };

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let pointerStart: { x: number; y: number; id: number } | null = null;
    const pointerDown = (e: PointerEvent) => { pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
    const pointerUp = (e: PointerEvent) => {
      if (!pointerStart || pointerStart.id !== e.pointerId) return; const moved = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y); pointerStart = null; if (moved > 10) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        if (findPetRoot(hit.object) && findPetRoot(hit.object) === selfPetRef.current) { openPetCare(); return; }
        let n: THREE.Object3D | null = hit.object;
        while (n) {
          if (n.userData.worldExit) { setLeavingWorld(true); return; }
          if (n.userData.propertyId) { const h = homesRef.current.find(x => x.propertyId === n!.userData.propertyId); if (h) { walkToDoor(h); setNotice("Walking to " + (h.ownerId === self.userId ? "your" : h.displayName + "'s") + " front door…"); return; } }
          n = n.parent;
        }
        if (hit.object.userData.ground) { targetRef.current.set(THREE.MathUtils.clamp(hit.point.x, -WX, WX), 0, THREE.MathUtils.clamp(hit.point.z, -WZ, WZ)); return; }
      }
    };
    const kd = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === "INPUT") return; keysRef.current.add(e.key.toLowerCase()); }, ku = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointerup", pointerUp); window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    // Portrait phones get a wider view so the street doesn't feel cramped.
    const resize = () => { camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight); camera.fov = camera.aspect < 0.8 ? 68 : 50; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); }; resize(); window.addEventListener("resize", resize);

    const clock = new THREE.Clock(); let frame = 0, lastDoor = "";
    const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const render = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
      const root = myRig.root, before = root.position.clone();
      const k = keysRef.current; let side = 0, fwdIn = 0;
      if (k.has("w") || k.has("arrowup")) fwdIn += 1; if (k.has("s") || k.has("arrowdown")) fwdIn -= 1;
      if (k.has("d") || k.has("arrowright")) side += 1; if (k.has("a") || k.has("arrowleft")) side -= 1;
      const running = k.has("shift");
      let step = new THREE.Vector3();
      if (side || fwdIn) {
        camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); right.crossVectors(fwd, up).normalize();
        step = fwd.multiplyScalar(fwdIn).add(right.multiplyScalar(side)).normalize().multiplyScalar((running ? 8 : 5) * dt);
        targetRef.current.copy(root.position).add(step);
      } else {
        const d = targetRef.current.clone().sub(root.position); d.y = 0;
        if (d.length() > 0.12) step = d.normalize().multiplyScalar(Math.min(d.length(), 5 * dt));
      }
      if (step.lengthSq() > 0) {
        const nx = root.position.x + step.x, nz = root.position.z + step.z;
        // never trap someone who is already somewhere invalid — let them walk out
        if (blocked(root.position.x, root.position.z)) root.position.set(nx, 0, nz);
        else if (!blocked(nx, nz)) root.position.set(nx, 0, nz);
        else if (!blocked(nx, root.position.z)) root.position.x = nx;
        else if (!blocked(root.position.x, nz)) root.position.z = nz;
        else targetRef.current.copy(root.position);
        const face = Math.atan2(step.x, step.z);
        let diff = face - root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, dt * 12);
      }
      const moved = root.position.clone().sub(before);
      const speed = moved.length() / Math.max(dt, 1e-4);
      myRig.update(dt, speed);
      camera.position.add(moved); controls.target.add(moved);
      if (selfPetRef.current) followOwner(selfPetRef.current, root, dt, t);

      if (Math.hypot(root.position.x + 42.5, root.position.z) < 1.6) { setLeavingWorld(true); return; }
      // front doors
      let near: Property | null = null;
      for (const h of homesRef.current) { const d = doorOf(h); const dist = Math.hypot(root.position.x - d.x, root.position.z - d.z); if (dist < 2.3) { near = h; if (dist < 0.75 && speed > 0.3) enterHome(h); break; } }
      const key = near?.propertyId || "";
      if (key !== lastDoor) { lastDoor = key; setNearDoor(near); }

      remoteRef.current.forEach(r => {
        const before2 = r.rig.root.position.clone();
        r.rig.root.position.lerp(r.target, Math.min(1, dt * 5));
        const mv = r.rig.root.position.clone().sub(before2); mv.y = 0;
        const sp = mv.length() / Math.max(dt, 1e-4);
        if (sp > 0.3) r.rig.root.rotation.y = THREE.MathUtils.lerp(r.rig.root.rotation.y, Math.atan2(mv.x, mv.z), Math.min(1, dt * 10));
        r.rig.update(dt, sp);
        if (r.pet) followOwner(r.pet, r.rig.root, dt, t);
      });

      // ambient motion
      drops.forEach(d => { const p = (d.userData.phase + t * 0.6) % 1; const a = d.userData.angle; const rr = 0.3 + p * 1.9; d.position.set(Math.cos(a) * rr, 2.4 + Math.sin(p * Math.PI) * 1.4 - p * 1.6, Math.sin(a) * rr); });
      seats.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.6 + i * 1.3) * 0.35; });
      clouds.position.x = ((t * 0.6) % 40);

      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render);
    };
    render(); setReady(true);
    return () => {
      disposed = true; cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointerup", pointerUp);
      controls.dispose(); myRig.dispose(); remoteRef.current.forEach(r => r.rig.dispose()); remoteRef.current.clear(); propertyRootsRef.current.clear();
      renderer.dispose(); sceneRef.current = null; selfRigRef.current = null; selfPetRef.current = null; setReady(false);
    };
  }, [selfId, token]);

  // ── Houses on their lots ──
  useEffect(() => {
    const scene = sceneRef.current; if (!scene || !self) return;
    let cancelled = false;
    propertyRootsRef.current.forEach(root => scene.remove(root)); propertyRootsRef.current.clear();
    for (const home of homes) {
      const mine = home.ownerId === self.userId;
      const facing = home.z > 0 ? Math.PI : 0;
      const root = new THREE.Group(); root.position.set(home.x, 0, home.z); root.userData.propertyId = home.propertyId; scene.add(root); propertyRootsRef.current.set(home.propertyId, root);
      const info = homeInfo(home.homeId);
      // yard, path, mailbox, flowers
      const yard = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.08, 10.2), mat(mine ? 0x86d07a : 0x7bc46d, 1)); yard.position.y = 0.04; yard.receiveShadow = true; yard.userData.ground = true; root.add(yard);
      const s = home.z > 0 ? -1 : 1; // toward the street
      const path = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 4.2), mat(0xe7d7b8, 0.95)); path.position.set(0, 0.07, s * 4.4); path.receiveShadow = true; path.userData.ground = true; root.add(path);
      const mb = mailbox(info.accent); mb.position.set(2.4, 0, s * 4.6); root.add(mb);
      const fb = flowerBed(1.8); fb.position.set(-2.1, 0, s * 3.75); root.add(fb);
      // door mat glow so doors are easy to find
      const matGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ color: home.unlocked || mine ? 0x4ade80 : 0xf59e0b, transparent: true, opacity: 0.55 }));
      matGlow.rotation.x = -Math.PI / 2; matGlow.position.set(0, 0.13, s * 5.1); root.add(matGlow);
      const path3 = HOME_MODELS[home.homeId] || HOME_MODELS["home-basic"];
      loadGltfCached(path3).then(gltf => {
        if (cancelled) return;
        const model = gltf.scene.clone(true);
        const b = new THREE.Box3().setFromObject(model), size = b.getSize(new THREE.Vector3());
        model.scale.setScalar(6.4 / Math.max(0.001, size.x, size.z)); model.updateMatrixWorld(true);
        const nb = new THREE.Box3().setFromObject(model), c = nb.getCenter(new THREE.Vector3());
        model.position.set(-c.x, -nb.min.y, -c.z);
        model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        const holder = new THREE.Group(); holder.rotation.y = facing; holder.add(model); root.add(holder);
      }).catch(() => { });
      if (HALLOREAD_ACTIVE) addHalloreadHomeDecor(root, home.ownerId, facing);
      const sign = nameTag(mine ? "⭐ MY HOME" : home.displayName + "'s home", mine ? "#0369a1" : home.unlocked ? "#166534" : "#334155", (home.unlocked ? "🔓 Open" : "🔒 Locked") + " · " + info.name);
      sign.position.set(0, 7.2, 0); root.add(sign);
      if (mine) { // beacon over your own house
        const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 1.5 }));
        beacon.rotation.x = Math.PI; beacon.position.y = 8.8; beacon.userData.spin = true; root.add(beacon);
        const spin = () => { if (cancelled || !beacon.parent) return; beacon.rotation.y += 0.03; beacon.position.y = 8.8 + Math.sin(performance.now() / 300) * 0.2; requestAnimationFrame(spin); }; spin();
      }
    }
    return () => { cancelled = true; };
  }, [homes, self?.userId, ready]);

  // ── Other readers ──
  useEffect(() => {
    const scene = sceneRef.current; if (!scene || !self || !ready) return;
    const active = new Set<number>();
    {
      const loader = new GLTFLoader();
      for (const p of players) {
        if (p.userId === self.userId) continue; active.add(p.userId);
        let r = remoteRef.current.get(p.userId);
        if (r && (r.characterId !== p.characterId || r.petId !== p.petId)) { scene.remove(r.rig.root); if (r.pet) scene.remove(r.pet); r.rig.dispose(); remoteRef.current.delete(p.userId); r = undefined; }
        if (!r) {
          const rig = new AvatarRig(p.characterId, 2.15); rig.root.position.set(p.x, 0, p.z); rig.root.rotation.y = p.facing;
          const tag = nameTag(p.displayName); tag.position.y = 2.9; tag.scale.multiplyScalar(0.7); rig.root.add(tag); scene.add(rig.root);
          const pet = createPet(p.petId, loader, 0.9); if (pet) { pet.position.set(p.x + 1, 0, p.z); scene.add(pet); }
          r = { rig, pet, target: new THREE.Vector3(p.x, 0, p.z), facing: p.facing, petId: p.petId, characterId: p.characterId }; remoteRef.current.set(p.userId, r);
        }
        r.target.set(p.x, 0, p.z); r.facing = p.facing;
      }
      remoteRef.current.forEach((r, id) => { if (!active.has(id)) { scene.remove(r.rig.root); if (r.pet) scene.remove(r.pet); r.rig.dispose(); remoteRef.current.delete(id); } });
    }
  }, [players, self?.userId, ready]);

  // presence sync
  useEffect(() => {
    if (!ready || !self || !token) return;
    const sync = async () => {
      const root = selfRigRef.current?.root; if (!root) return;
      try {
        const response = await fetch(API_BASE + "/api/neighborhood/presence", { method: "POST", headers, body: JSON.stringify({ x: root.position.x, z: root.position.z, facing: Math.atan2(Math.sin(root.rotation.y), Math.cos(root.rotation.y)) }) });
        const data = await response.json();
        if (response.ok) setPlayers(data.players || []);
        else if (response.status === 409) {
          const reconnect = await fetch(API_BASE + "/api/neighborhood/bootstrap", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
          const fresh = await reconnect.json(); if (reconnect.ok) setPlayers(fresh.players || []);
        }
      } catch { /* try again next tick */ }
    };
    void sync(); const interval = window.setInterval(sync, 900); return () => window.clearInterval(interval);
  }, [ready, self?.userId, token, headers]);
  useEffect(() => { if (!leavingWorld) return; const timer = window.setTimeout(() => navigate("/games"), 700); return () => window.clearTimeout(timer); }, [leavingWorld, navigate]);

  const neighbors = players.filter(p => p.userId !== self?.userId);
  const move = (key: "w" | "a" | "s" | "d", pressed: boolean) => { if (pressed) keysRef.current.add(key); else keysRef.current.delete(key); };
  const doorOpen = nearDoor && (nearDoor.ownerId === self?.userId || nearDoor.unlocked);
  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-sky-300 text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none" />
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-slate-950/85 to-transparent p-3">
      <button type="button" onClick={() => setLeavingWorld(true)} className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950/80 px-3 font-black"><ArrowLeft className="h-5 w-5" /> Exit</button>
      <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-black drop-shadow">{HALLOREAD_ACTIVE ? "The Block · Halloread" : "The Block"}</h1><p className="truncate text-xs font-bold text-white/85 drop-shadow">{NIGHT ? "Night on the block · lamps are on" : "A sunny day on the block"} · {homes.length} {homes.length === 1 ? "home" : "homes"}</p></div>
      <button type="button" onClick={() => setShowReaders(v => !v)} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/80 px-3 font-black" aria-label="Neighbors and homes"><Users className="h-4 w-4" />{neighbors.length}</button>
    </header>
    <div className="absolute left-3 top-20 z-30 flex w-36 flex-col gap-1.5 rounded-2xl bg-slate-950/80 p-1.5 backdrop-blur sm:w-44 sm:gap-2 sm:p-2">
      <button type="button" onClick={goHome} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-300 px-2 text-xs font-black text-slate-950 sm:min-h-11 sm:text-sm"><Home className="h-4 w-4" /> {myHome ? "Walk home" : "No home yet"}</button>
      {myHome ? <button type="button" onClick={() => enterHome(myHome)} className="min-h-10 rounded-xl bg-cyan-300 px-2 text-xs font-black text-slate-950 sm:min-h-11 sm:text-sm">Go inside my house</button>
        : <button type="button" onClick={() => navigate("/avatar-world")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-fuchsia-500 px-3 text-sm font-black"><ShoppingBag className="h-4 w-4" /> Buy a home</button>}
      <button type="button" onClick={() => navigate("/avatar-world")} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2 text-xs font-black"><ShoppingBag className="h-4 w-4" /> Shop</button>
    </div>
    <div className="absolute right-3 top-20 z-30 flex flex-col gap-1.5 rounded-2xl bg-slate-950/80 p-1.5 text-xs font-black backdrop-blur sm:gap-2 sm:p-2 sm:text-sm">
      <button onClick={() => { const r = selfRigRef.current?.root; if (r) focusCamera(r.position.x, r.position.z); }} className="flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3"><LocateFixed className="h-4 w-4" /> Center</button>
      <button onClick={wave} className="flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3"><Hand className="h-4 w-4" /> Wave</button>
      <button onClick={() => { targetRef.current.set(PARK_X - 7, 0, 0); setNotice("Heading to Sunny Park…"); }} className="min-h-10 rounded-xl bg-white/10 px-3">🌳 Park</button>
    </div>
    {nearDoor && <div className="absolute bottom-24 left-1/2 z-40 w-[min(360px,88vw)] -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/92 p-3 text-center shadow-2xl backdrop-blur">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-300">{homeInfo(nearDoor.homeId).name}</p>
      <p className="text-lg font-black">{nearDoor.ownerId === self?.userId ? "Your front door" : nearDoor.displayName + "'s front door"}</p>
      {doorOpen ? <button onClick={() => enterHome(nearDoor)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-slate-950"><DoorOpen className="h-5 w-5" /> Go inside</button>
        : <p className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-amber-300/20 p-2 text-sm font-black text-amber-200"><Lock className="h-4 w-4" /> Locked — only {nearDoor.displayName} can open it</p>}
    </div>}
    {showReaders && <aside className="absolute right-3 top-20 z-40 max-h-[62dvh] w-[min(320px,calc(100%-1.5rem))] overflow-y-auto rounded-2xl bg-slate-950/95 p-3 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="font-black">Neighbors here</h2><button onClick={() => setShowReaders(false)} className="grid h-10 w-10 place-items-center rounded-lg bg-white/10" aria-label="Close"><X className="h-4 w-4" /></button></div>
      {neighbors.length ? neighbors.map(p => <button key={p.userId} onClick={() => walkTo(p)} className="mt-2 min-h-12 w-full rounded-xl bg-white/10 p-3 text-left text-sm font-bold">{p.displayName}<span className="block text-xs text-cyan-200">Walk over</span></button>) : <p className="mt-3 text-sm text-white/70">You are the first reader here right now.</p>}
      <div className="mt-3 border-t border-white/10 pt-3"><p className="text-xs font-black uppercase tracking-widest text-white/45">Homes on the block</p>
        {homes.map(home => <button key={home.propertyId} onClick={() => { walkToDoor(home); setShowReaders(false); setNotice("Walking to " + (home.ownerId === self?.userId ? "your" : home.displayName + "'s") + " house…"); }} className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-xl bg-white/5 px-3 text-left text-xs font-bold">{home.unlocked ? <Unlock className="h-4 w-4 shrink-0 text-emerald-300" /> : <Lock className="h-4 w-4 shrink-0 text-amber-300" />}<span className="min-w-0 flex-1 truncate">{home.ownerId === self?.userId ? "My home" : home.displayName + "'s home"}</span><span className="text-[10px] text-white/50">{homeInfo(home.homeId).name}</span></button>)}
      </div>
    </aside>}
    <MobileJoystick onMove={move} className="bottom-24 left-3" label="Neighborhood movement controls" />
    {!nearDoor && <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-[88vw] -translate-x-1/2 rounded-xl bg-slate-950/78 px-4 py-2 text-center text-xs font-bold backdrop-blur">{notice}</div>}
    {!self && <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/70 p-5 text-center"><div><MapIcon className="mx-auto h-12 w-12 text-cyan-300" /><p className="mt-3 text-xl font-black">Opening The Block…</p><p className="mt-1 text-sm text-white/70">{notice}</p></div></div>}
    {leavingWorld && <WorldLoadingOverlay tone="block" label="Leaving The Block…" />}
  </main>;
}
