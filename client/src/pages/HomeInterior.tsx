import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Camera, DoorOpen, Hand, Home, Lightbulb, Lock, Paintbrush, ShoppingBag, Sparkles, Unlock, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { createPet, findPetRoot, openPetCare } from "@/lib/pets";
import { AvatarRig, followOwner, hashParam } from "@/lib/worldAvatar";
import { FURNITURE_INFO, homeInfo, homeRank } from "@/lib/homes";
import MobileJoystick from "@/components/MobileJoystick";

type CatalogItem = { id: string; type: string; name: string; price: number; rarity: string };
type HomeMeta = { ownerId: number; displayName: string; homeId: string; propertyId: string; lot: number; x: number; z: number; unlocked: boolean };
type State = { selectedCharacter: string; equipped: Record<string, string>; purchased: string[]; furniture: string[] };
type Payload = { economy?: { wallet: number }; state: State; catalog?: CatalogItem[]; home: HomeMeta; isOwner: boolean };
type Hotspot = { id: string; label: string; emoji: string; x: number; z: number; r: number };

// House footprint: x −16…16, z −11…11. Front door at z = 11 (x −2.5…2.5).
const ROOMS = [
  { name: "Front Hall", test: (x: number, z: number) => Math.abs(x) < 2.6 && z > 8 },
  { name: "Living Room", test: (x: number, z: number) => x < 0 && z > 3 },
  { name: "Kitchen", test: (x: number, z: number) => x >= 0 && z > 3 },
  { name: "Game Room", test: (x: number, z: number) => x < -5 && z <= 3 && z >= -3 },
  { name: "Bathroom", test: (x: number, z: number) => x > 5 && z <= 3 && z >= -3 },
  { name: "Reading Room", test: (x: number, z: number) => x < 0 && z < -3 },
  { name: "Bedroom", test: (x: number, z: number) => x >= 0 && z < -3 },
];

function texture(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, repeat: [number, number]) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size; draw(cv.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
function shade(n: number, f: number) { const c = new THREE.Color(n); c.multiplyScalar(f); return "#" + c.getHexString(); }

let audio: AudioContext | null = null;
function playNotes(notes: number[], gap = 0.22, type: OscillatorType = "triangle") {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext; if (!Ctx) return;
    audio = audio || new Ctx();
    notes.forEach((f, i) => {
      if (!f) return;
      const o = audio!.createOscillator(), g = audio!.createGain(), t = audio!.currentTime + i * gap;
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + gap * 1.8);
      o.connect(g).connect(audio!.destination); o.start(t); o.stop(t + gap * 2);
    });
  } catch { /* optional */ }
}
const MELODY = [523, 523, 784, 784, 880, 880, 784, 0, 698, 698, 659, 659, 587, 587, 523];

export default function HomeInterior() {
  const { token, user } = useAuth(); const [, navigate] = useLocation();
  const ownerParam = Number(hashParam("owner") || user?.id || 0);
  const ownerId = Number.isFinite(ownerParam) && ownerParam > 0 ? ownerParam : Number(user?.id || 0);
  const mountRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<AvatarRig | null>(null), petRef = useRef<THREE.Object3D | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null), controlsRef = useRef<OrbitControls | null>(null);
  const keysRef = useRef(new Set<string>()), targetRef = useRef(new THREE.Vector3(0, 0, 9));
  const actionsRef = useRef<Record<string, () => void>>({});
  const [payload, setPayload] = useState<Payload | null>(null);
  const [notice, setNotice] = useState("Opening home…");
  const [room, setRoom] = useState("Front Hall");
  const [decorate, setDecorate] = useState(false);
  const [busy, setBusy] = useState("");
  const [cameraPreset, setCameraPreset] = useState<"follow" | "wide" | "top">("follow");
  const [hotspot, setHotspot] = useState<Hotspot | null>(null);
  const [lightsOn, setLightsOn] = useState(true);
  const [napping, setNapping] = useState(false);
  const lightsRef = useRef(true);
  const presetRef = useRef<"follow" | "wide" | "top">("follow");
  const headers = useMemo(() => ({ Authorization: "Bearer " + token, "Content-Type": "application/json" }), [token]);

  const load = async () => {
    if (!token || !ownerId) return;
    try {
      const homeResponse = await fetch(API_BASE + "/api/homes/" + ownerId, { headers, cache: "no-store" });
      const homeData = await homeResponse.json(); if (!homeResponse.ok) throw Error(homeData.message || "Could not enter this home.");
      if (homeData.isOwner) {
        const worldResponse = await fetch(API_BASE + "/api/avatar-world", { headers, cache: "no-store" });
        const world = await worldResponse.json(); if (!worldResponse.ok) throw Error(world.message || "Could not load your home.");
        setPayload({ ...homeData, economy: world.economy, catalog: world.catalog, state: world.state });
      } else setPayload(homeData);
      setNotice(homeData.isOwner ? "Welcome home! Walk up to things to use them." : "You are visiting " + homeData.home.displayName + "'s home. Look around — only the owner can change things.");
    } catch (error: any) { setNotice(error.message || "Could not enter this home."); setPayload(null); }
  };
  useEffect(() => { void load(); }, [token, ownerId]);

  const customize = async (body: any) => {
    if (!payload?.isOwner || busy) return; setBusy("save");
    try {
      const r = await fetch(API_BASE + "/api/avatar-world/customize", { method: "POST", headers, body: JSON.stringify(body) });
      const d = await r.json(); if (!r.ok) throw Error(d.message || "Could not update your home.");
      setPayload(p => p ? { ...p, state: d.state, economy: d.economy, catalog: d.catalog, home: { ...p.home, homeId: d.state.equipped.home || p.home.homeId } } : p); setNotice("Home updated.");
    } catch (error: any) { setNotice(error.message || "Could not update your home."); } finally { setBusy(""); }
  };
  const toggleDoor = async () => {
    if (!payload?.isOwner || busy) return; setBusy("door");
    try {
      const r = await fetch(API_BASE + "/api/homes/door", { method: "POST", headers, body: JSON.stringify({ unlocked: !payload.home.unlocked }) });
      const d = await r.json(); if (!r.ok) throw Error(d.message || "Could not change the door.");
      setPayload(p => p ? { ...p, home: { ...p.home, unlocked: d.home.unlocked } } : p);
      setNotice(d.home.unlocked ? "Front door unlocked. Friends can visit!" : "Front door locked. Only you can come in.");
    } catch (error: any) { setNotice(error.message || "Could not change the door."); } finally { setBusy(""); }
  };
  const goOutside = () => navigate("/neighborhood?from=" + (payload?.home.ownerId || ownerId));

  const applyCamera = (preset: "follow" | "wide" | "top") => {
    setCameraPreset(preset); presetRef.current = preset;
    const root = rigRef.current?.root, camera = cameraRef.current, controls = controlsRef.current; if (!root || !camera || !controls) return;
    const p = root.position;
    if (preset === "follow") camera.position.set(p.x, 7.5, p.z + 9.5); else if (preset === "wide") camera.position.set(p.x + 9, 14, p.z + 15); else camera.position.set(p.x, 23, p.z + 5);
    controls.target.set(p.x, 1.2, p.z); controls.update();
  };

  const homeId = payload?.home.homeId || "home-basic";
  const furnitureKey = (payload?.state.furniture || []).join("|");

  useEffect(() => {
    const mount = mountRef.current; if (!mount || !payload) return;
    let disposed = false, raf = 0, lastRoom = "", lastSpot = "";
    const info = homeInfo(homeId), rank = homeRank(homeId), loft = homeId === "home-loft";
    const has = (id: string) => payload.state.furniture.includes(id);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(loft ? 0x0b1020 : 0x1e293b);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120); camera.position.set(0, 7.5, 18.5); cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping;
    mount.innerHTML = ""; mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.09; controls.enablePan = false;
    controls.minDistance = 5; controls.maxDistance = 26; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.2; controls.target.set(0, 1.2, 9); controlsRef.current = controls;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x6b5a48, loft ? 1.1 : 1.9); scene.add(hemi);
    const sun = new THREE.DirectionalLight(loft ? 0xc4b5fd : 0xfff1d6, loft ? 0.9 : 2.2); sun.position.set(-12, 22, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 16, bottom: -16 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0005; scene.add(sun);
    const roomLights = new THREE.Group(); scene.add(roomLights);
    for (const [x, z] of [[-8, 7], [8, 7], [-10, 0], [10, 0], [-8, -7], [8, -7]]) { const l = new THREE.PointLight(0xffe2b0, loft ? 10 : 7, 13, 1.6); l.position.set(x, 3.6, z); roomLights.add(l); }
    const solids: Array<[number, number, number, number]> = []; // x1,x2,z1,z2
    const solid = (cx: number, cz: number, w: number, d: number) => solids.push([cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2]);
    const m = (color: number, rough = 0.8, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
    const box = (size: [number, number, number], pos: [number, number, number], material: THREE.Material, parent: THREE.Object3D = scene, shadow = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...pos); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const glow = (color: number, i = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4 });
    const hotspots: Hotspot[] = [];
    const animators: Array<(t: number, dt: number) => void> = [];

    // Floors: wood planks in living spaces, tiles in kitchen & bath, carpet in bedroom.
    const wood = texture(256, (c, s) => { c.fillStyle = hex(info.floor); c.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 32) { c.fillStyle = shade(info.floor, 0.86 + Math.random() * 0.2); c.fillRect(0, y, s, 30); c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(0, y + 30, s, 2); const x = Math.random() * s; c.fillRect(x, y, 2, 30); } }, [8, 6]);
    const tiles = texture(128, (c, s) => { c.fillStyle = loft ? "#3f3a4f" : "#eef2f5"; c.fillRect(0, 0, s, s); c.strokeStyle = loft ? "#2a2636" : "#c9d1da"; c.lineWidth = 4; for (let i = 0; i <= s; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.moveTo(0, i); c.lineTo(s, i); c.stroke(); } }, [8, 4]);
    const carpet = texture(128, (c, s) => { c.fillStyle = hex(info.accent); c.fillRect(0, 0, s, s); for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; c.fillRect(Math.random() * s, Math.random() * s, 2, 2); } }, [4, 4]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 22), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.ground = true; scene.add(floor);
    const patch = (x: number, z: number, w: number, d: number, map: THREE.Texture, rough = 0.6) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map, roughness: rough })); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.01, z); p.receiveShadow = true; p.userData.ground = true; scene.add(p); return p; };
    patch(8, 7, 16, 8, tiles, 0.4); patch(10.5, 0, 11, 6, tiles, 0.3); const bedCarpet = carpet.clone(); bedCarpet.repeat.set(3, 2); patch(8, -7, 16, 8, bedCarpet, 1);
    const rug = (x: number, z: number, w: number, d: number, color: number) => { const r = new THREE.Mesh(new THREE.CircleGeometry(1, 40), m(color, 1)); r.scale.set(w / 2, d / 2, 1); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.02, z); r.receiveShadow = true; r.userData.ground = true; scene.add(r); };

    // Walls (low cut-away front wall so the camera always sees in).
    const wallMat = m(info.wall, 0.95), trimMat = m(info.trim, 0.6);
    const wall = (w: number, h: number, d: number, x: number, z: number) => { const mesh = box([w, h, d], [x, h / 2, z], wallMat, scene, false); box([w + 0.02, 0.22, d + 0.04], [x, 0.11, z], trimMat, scene, false); solid(x, z, w, d); return mesh; };
    wall(32, 3.4, 0.3, 0, -11); wall(0.3, 3.4, 22, -16, 0); wall(0.3, 3.4, 22, 16, 0);
    wall(13.5, 1.1, 0.3, -9.25, 11); wall(13.5, 1.1, 0.3, 9.25, 11);
    wall(11.5, 2.8, 0.22, -10.2, 3); wall(11.5, 2.8, 0.22, 10.2, 3); wall(11.5, 2.8, 0.22, -10.2, -3); wall(11.5, 2.8, 0.22, 10.2, -3);
    wall(0.22, 2.8, 2.9, 0, 6.55); wall(0.22, 2.8, 5.4, 0, -7.8);
    // Front door frame + doormat.
    const doorFrame = new THREE.Group(); doorFrame.position.set(0, 0, 11); scene.add(doorFrame);
    box([0.35, 3.2, 0.4], [-2.6, 1.6, 0], trimMat, doorFrame); box([0.35, 3.2, 0.4], [2.6, 1.6, 0], trimMat, doorFrame); box([5.6, 0.35, 0.4], [0, 3.2, 0], trimMat, doorFrame);
    const doormat = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.3), m(0x92400e, 1)); doormat.rotation.x = -Math.PI / 2; doormat.position.set(0, 0.02, 10.1); scene.add(doormat);
    hotspots.push({ id: "door", label: "Go outside to The Block", emoji: "🚪", x: 0, z: 10.45, r: 1.0 });

    // Windows on the back and side walls (city skyline in the loft).
    const windowTex = (night: boolean) => texture(256, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, night ? "#0b1030" : "#7cc4ff"); g.addColorStop(1, night ? "#3b1c5a" : "#dff3ff"); c.fillStyle = g; c.fillRect(0, 0, s, s);
      if (night) { for (let i = 0; i < 12; i++) { const w = 14 + Math.random() * 24, h = 60 + Math.random() * 140, x = i * 22; c.fillStyle = "#111827"; c.fillRect(x, s - h, w, h); for (let y = s - h + 6; y < s; y += 12) for (let xx = x + 3; xx < x + w - 3; xx += 7) if (Math.random() < 0.5) { c.fillStyle = Math.random() < 0.5 ? "#fde68a" : "#f9a8d4"; c.fillRect(xx, y, 3, 5); } } }
      else { c.fillStyle = "rgba(255,255,255,.9)"; for (let i = 0; i < 4; i++) { const x = Math.random() * s, y = 30 + Math.random() * 80; c.beginPath(); c.ellipse(x, y, 30, 12, 0, 0, Math.PI * 2); c.fill(); } c.fillStyle = "#6ab04c"; c.fillRect(0, s * 0.8, s, s * 0.2); }
    }, [1, 1]);
    const winTex = windowTex(loft);
    const addWindow = (x: number, z: number, rotY: number, w = 3.2) => {
      const g = new THREE.Group(); g.position.set(x, 1.85, z); g.rotation.y = rotY; scene.add(g);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.7), new THREE.MeshBasicMaterial({ map: winTex })); pane.position.z = 0.17; g.add(pane);
      box([w + 0.3, 0.14, 0.12], [0, 0.9, 0.2], trimMat, g, false); box([w + 0.3, 0.14, 0.12], [0, -0.9, 0.2], trimMat, g, false);
      box([0.14, 1.9, 0.12], [-w / 2 - 0.08, 0, 0.2], trimMat, g, false); box([0.14, 1.9, 0.12], [w / 2 + 0.08, 0, 0.2], trimMat, g, false); box([0.08, 1.7, 0.1], [0, 0, 0.2], trimMat, g, false);
    };
    for (const x of [-12, -4, 4, 12]) addWindow(x, -11, 0);
    for (const z of [-7, 7]) { addWindow(-16, z, Math.PI / 2); addWindow(16, z, -Math.PI / 2); }

    // Wall art.
    const art = (x: number, z: number, rotY: number, colors: string[]) => {
      const tex = texture(128, (c, s) => { c.fillStyle = colors[0]; c.fillRect(0, 0, s, s); c.fillStyle = colors[1]; c.beginPath(); c.arc(s * 0.35, s * 0.4, s * 0.22, 0, Math.PI * 2); c.fill(); c.fillStyle = colors[2]; c.fillRect(s * 0.15, s * 0.65, s * 0.7, s * 0.18); }, [1, 1]);
      const g = new THREE.Group(); g.position.set(x, 2.1, z); g.rotation.y = rotY; scene.add(g);
      box([1.5, 1.2, 0.08], [0, 0, 0], m(0x1f2937, 0.5), g, false);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1), new THREE.MeshStandardMaterial({ map: tex })); pic.position.z = 0.05; g.add(pic);
    };
    art(-8.5, 3.13, 0, ["#fef3c7", "#f97316", "#0ea5e9"]); art(5, 3.13, 0, ["#e0f2fe", "#22c55e", "#a855f7"]); art(-3.5, -2.87, Math.PI, ["#fce7f3", "#ec4899", "#1d4ed8"]);

    // Generic furniture builders.
    const couch = (x: number, z: number, color: number, rot = 0, w = 4.6) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); const c = m(color, 0.95);
      box([w, 0.55, 1.6], [0, 0.42, 0], c, g); box([w, 1.1, 0.35], [0, 0.95, -0.65], c, g); box([0.4, 0.85, 1.6], [-w / 2 + 0.2, 0.62, 0], c, g); box([0.4, 0.85, 1.6], [w / 2 - 0.2, 0.62, 0], c, g);
      for (let i = 0; i < 3; i++) box([w / 3.4, 0.22, 1.2], [-w / 3 + i * w / 3, 0.8, 0.1], m(new THREE.Color(color).offsetHSL(0, 0, 0.08).getHex(), 1), g);
      const rotW = Math.abs(Math.sin(rot)) > 0.5; solid(x, z, rotW ? 1.7 : w, rotW ? w : 1.7); return g;
    };
    const tableAt = (x: number, z: number, w = 2.4, d = 1.3, color = 0x7c4a24, h = 0.75) => {
      box([w, 0.12, d], [x, h, z], m(color, 0.5)); for (const dx of [-w / 2 + 0.15, w / 2 - 0.15]) for (const dz of [-d / 2 + 0.15, d / 2 - 0.15]) box([0.1, h, 0.1], [x + dx, h / 2, z + dz], m(color, 0.6));
      solid(x, z, w, d);
    };
    const plant = (x: number, z: number, s = 1) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); scene.add(g);
      box([0.7, 0.6, 0.7], [0, 0.3, 0], m(0xc2410c, 0.9), g);
      for (let i = 0; i < 7; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), m(0x22a35a, 0.9)); leaf.scale.set(0.7, 1.6, 0.4); leaf.position.set(Math.cos(i) * 0.25, 1 + (i % 3) * 0.25, Math.sin(i) * 0.25); leaf.rotation.z = Math.cos(i) * 0.5; leaf.castShadow = true; g.add(leaf); }
      solid(x, z, 0.8 * s, 0.8 * s);
    };
    const lamp = (x: number, z: number) => {
      box([0.1, 2.2, 0.1], [x, 1.1, z], m(0x334155, 0.4, { metalness: 0.5 })); box([0.6, 0.06, 0.6], [x, 0.03, z], m(0x334155));
      const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 0.6, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfde68a, emissiveIntensity: 0.6, side: THREE.DoubleSide })); shadeMesh.position.set(x, 2.3, z); scene.add(shadeMesh);
      solid(x, z, 0.5, 0.5);
    };
    const bookshelf = (x: number, z: number, rot = 0, w = 4.4) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); const woodM = m(0x6b3f20, 0.8);
      box([w, 2.8, 0.45], [0, 1.4, 0], woodM, g); const colors = [0x2563eb, 0xdc2626, 0x16a34a, 0xca8a04, 0x7c3aed, 0xdb2777, 0x0891b2];
      for (let shelf = 0; shelf < 4; shelf++) { box([w - 0.2, 0.08, 0.5], [0, 0.35 + shelf * 0.65, 0.05], woodM, g, false); for (let i = 0; i < Math.floor(w / 0.32); i++) { if (Math.random() < 0.12) continue; const h = 0.38 + Math.random() * 0.18; box([0.24, h, 0.32], [-w / 2 + 0.3 + i * 0.32, 0.42 + shelf * 0.65 + h / 2, 0.12], m(colors[(i * 3 + shelf) % colors.length], 0.7), g, false); } }
      const rotW = Math.abs(Math.sin(rot)) > 0.5; solid(x, z, rotW ? 0.6 : w, rotW ? w : 0.6);
    };
    const tvAt = (x: number, z: number, rot: number, id: string) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
      box([2.6, 0.6, 0.6], [0, 0.3, 0], m(0x1f2937, 0.5), g);
      box([3.4, 1.95, 0.12], [0, 1.75, 0], m(0x05070d, 0.25, { metalness: 0.4 }), g);
      const cv = document.createElement("canvas"); cv.width = 256; cv.height = 144; const ctx = cv.getContext("2d")!;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: tex })); screen.position.set(0, 1.75, 0.07); g.add(screen);
      let on = false;
      const draw = (t: number) => {
        if (!on) { ctx.fillStyle = "#0b0f19"; ctx.fillRect(0, 0, 256, 144); ctx.fillStyle = "#1e293b"; ctx.font = "bold 14px system-ui"; ctx.fillText("● OFF", 10, 20); tex.needsUpdate = true; return; }
        const g2 = ctx.createLinearGradient(0, 0, 256, 144); g2.addColorStop(0, `hsl(${(t * 40) % 360},80%,55%)`); g2.addColorStop(1, `hsl(${(t * 40 + 120) % 360},80%,45%)`); ctx.fillStyle = g2; ctx.fillRect(0, 0, 256, 144);
        ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(60 + Math.sin(t * 2) * 30, 80 + Math.cos(t * 3) * 14, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "900 26px system-ui"; ctx.fillText("A.R.I.S.E TV", 92, 46); ctx.font = "bold 14px system-ui"; ctx.fillText("Story Time Cartoons", 100, 72);
        tex.needsUpdate = true;
      };
      draw(0); let acc = 0;
      animators.push((t, dt) => { acc += dt; if (on && acc > 0.1) { acc = 0; draw(t); } });
      actionsRef.current[id] = () => { on = !on; draw(performance.now() / 1000); if (on) playNotes([392, 523, 659], 0.09); setNotice(on ? "📺 TV on — cartoons are playing!" : "TV off."); };
      const front = new THREE.Vector3(0, 0, 2.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      hotspots.push({ id, label: "Turn the TV on/off", emoji: "📺", x: x + front.x, z: z + front.z, r: 1.8 });
      const rotW = Math.abs(Math.sin(rot)) > 0.5; solid(x, z, rotW ? 0.7 : 2.6, rotW ? 2.6 : 0.7);
    };

    // ── Living room ──
    rug(-8.5, 7.2, 7, 4.4, loft ? 0x581c87 : 0x1d4ed8);
    tvAt(-8.5, 3.55, 0, "tv-living"); couch(-8.5, 8.9, loft ? 0x6d28d9 : 0x475569, Math.PI);
    tableAt(-8.5, 6.6, 2.2, 1.1, 0x92400e, 0.45);
    plant(-15, 10); lamp(-12.6, 10.2);
    if (has("furniture-fireplace") || rank >= 3) {
      const fp = new THREE.Group(); fp.position.set(-15.5, 0, 6.6); fp.rotation.y = Math.PI / 2; scene.add(fp);
      box([3.2, 2.6, 0.7], [0, 1.3, 0], m(0x9ca3af, 0.9), fp); box([2, 1.3, 0.3], [0, 0.75, 0.25], m(0x111827, 1), fp); box([3.6, 0.2, 0.9], [0, 2.65, 0.1], m(0x6b3f20), fp);
      const flames: THREE.Mesh[] = []; for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 8), glow(i === 1 ? 0xfacc15 : 0xf97316, 2.5)); f.position.set(-0.45 + i * 0.45, 0.6, 0.35); fp.add(f); flames.push(f); }
      const fl = new THREE.PointLight(0xff8a3d, 8, 8, 2); fl.position.set(0, 1, 1); fp.add(fl);
      let lit = true;
      animators.push(t => { flames.forEach((f, i) => { f.scale.y = lit ? 0.8 + Math.sin(t * 9 + i * 2) * 0.25 : 0.001; }); fl.intensity = lit ? 7 + Math.sin(t * 13) * 1.5 : 0; });
      actionsRef.current.fire = () => { lit = !lit; setNotice(lit ? "🔥 The fire is crackling." : "The fire is out."); };
      hotspots.push({ id: "fire", label: "Light / put out the fire", emoji: "🔥", x: -13.6, z: 6.6, r: 1.6 });
      solid(-15.5, 6.6, 0.9, 3.4);
    }
    if (has("furniture-piano") || rank >= 3) {
      const pg = new THREE.Group(); pg.position.set(-3.4, 0, 6.4); pg.rotation.y = Math.PI / 2; scene.add(pg);
      const black = m(0x0b0b0f, 0.12, { metalness: 0.35 });
      box([2.2, 0.42, 1.7], [0, 1.0, -0.1], black, pg);
      const lid = box([2.1, 0.05, 1.6], [0, 1.55, -0.45], black, pg); lid.rotation.x = -0.55;
      box([0.04, 0.75, 0.04], [0.9, 1.35, 0.35], black, pg, false);
      box([2.3, 0.14, 0.42], [0, 0.94, 0.88], black, pg);
      box([2.1, 0.06, 0.36], [0, 1.03, 0.9], m(0xf8fafc, 0.3), pg, false);
      for (let i = 0; i < 14; i++) if (i % 7 !== 2 && i % 7 !== 6) box([0.07, 0.05, 0.2], [-0.98 + i * 0.15, 1.08, 0.82], black, pg, false);
      box([0.6, 0.5, 0.05], [0, 1.3, 0.72], black, pg, false);
      for (const [lx, lz] of [[-0.95, -0.7], [0.95, -0.7], [0, 0.55]]) box([0.14, 0.8, 0.14], [lx, 0.4, lz], black, pg);
      box([1.1, 0.5, 0.45], [0, 0.25, 1.55], m(0x0b0b0f, 0.4), pg);
      actionsRef.current.piano = () => { playNotes(MELODY, 0.24, "sine"); setNotice("🎹 You played Twinkle Twinkle Little Star!"); };
      hotspots.push({ id: "piano", label: "Play the piano", emoji: "🎹", x: -1.2, z: 6.4, r: 1.4 });
      solid(-3.3, 6.4, 1.9, 2.4);
    }
    if (rank >= 3) { // chandelier
      const ch = new THREE.Group(); ch.position.set(-8.5, 3.6, 7); scene.add(ch);
      box([0.04, 1, 0.04], [0, 0.5, 0], m(0xd4af37, 0.3, { metalness: 1 }), ch, false);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 32), m(0xd4af37, 0.3, { metalness: 1 })); ring.rotation.x = Math.PI / 2; ch.add(ring);
      for (let i = 0; i < 14; i++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0xbae6fd, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.05 })); const a = i / 14 * Math.PI * 2; cr.position.set(Math.cos(a) * 0.9, -0.25 - (i % 2) * 0.15, Math.sin(a) * 0.9); ch.add(cr); }
      const cl = new THREE.PointLight(0xfff7e6, 10, 12, 1.8); cl.position.y = -0.4; ch.add(cl);
      animators.push(t => { ch.rotation.y = t * 0.2; });
    }

    // ── Kitchen ──
    const counterMat = m(loft ? 0x1f1b2e : 0xf8fafc, 0.3), cabMat = m(new THREE.Color(info.accent).offsetHSL(0, -0.2, 0.15).getHex(), 0.6);
    box([9, 0.95, 1.1], [8.5, 0.48, 10.3], cabMat); box([9.2, 0.1, 1.25], [8.5, 1.0, 10.3], counterMat); solid(8.5, 10.3, 9, 1.1);
    box([9, 1, 0.5], [8.5, 2.6, 10.6], cabMat);
    box([1.2, 0.05, 0.7], [6, 1.06, 10.2], m(0x94a3b8, 0.2, { metalness: 0.8 }));
    box([1.6, 3, 1.2], [14.9, 1.5, 9.9], m(0xcbd5e1, 0.25, { metalness: 0.6 })); box([0.05, 1.2, 0.05], [14.2, 1.8, 9.25], m(0x475569)); solid(14.9, 9.9, 1.6, 1.2);
    actionsRef.current.fridge = () => { const snacks = ["🍎 an apple", "🧀 some cheese", "🥕 a carrot", "🍓 strawberries", "🥛 a glass of milk", "🍪 a cookie"]; setNotice("You grabbed " + snacks[Math.floor(Math.random() * snacks.length)] + "! Yum."); playNotes([660, 880], 0.08); };
    hotspots.push({ id: "fridge", label: "Grab a snack", emoji: "🧊", x: 14.6, z: 8.2, r: 1.4 });
    box([3.4, 0.95, 1.4], [9, 0.48, 6.6], cabMat); box([3.6, 0.1, 1.6], [9, 1.0, 6.6], counterMat); solid(9, 6.6, 3.4, 1.4);
    for (const dx of [-1.1, 0, 1.1]) { box([0.1, 0.75, 0.1], [9 + dx, 0.38, 5.35], m(0x334155)); const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16), m(info.accent, 0.5)); seat.position.set(9 + dx, 0.8, 5.35); scene.add(seat); }
    tableAt(3.3, 7.4, 2, 1.6, 0xa16207); for (const [cx, cz] of [[2.5, 6.3], [4.1, 6.3], [2.5, 8.5], [4.1, 8.5]]) box([0.55, 0.5, 0.55], [cx, 0.25, cz], m(info.accent, 0.7));
    const fruit = new THREE.Group(); fruit.position.set(3.3, 0.85, 7.4); scene.add(fruit); for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), m([0xef4444, 0xfacc15, 0x22c55e, 0xf97316, 0xef4444][i], 0.5)); f.position.set(Math.cos(i * 1.3) * 0.18, 0.05, Math.sin(i * 1.3) * 0.18); fruit.add(f); }
    if (has("furniture-sofa")) couch(13.4, 5, 0x7c3aed, -Math.PI / 2, 3.2);

    // ── Game room ──
    rug(-10.5, 0, 7, 4.6, loft ? 0x312e81 : 0x0f766e);
    tvAt(-15.6, 0, Math.PI / 2, "tv-game"); couch(-10.6, 0, info.accent, -Math.PI / 2, 3.6);
    const consoleBox = box([0.8, 0.15, 0.5], [-15.2, 0.68, 1.6], m(0xf8fafc, 0.3)); void consoleBox;
    if (has("furniture-beanbags")) { for (const [bx, bz, c] of [[-13, 2.2, 0xf97316], [-8.3, -2.1, 0x22c55e], [-8.6, 2.3, 0xec4899]] as [number, number, number][]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), m(c, 0.95)); b.scale.y = 0.6; b.position.set(bx, 0.42, bz); b.castShadow = true; scene.add(b); solid(bx, bz, 1.2, 1.2); } }
    const arcadeCab = (x: number, z: number, rot: number, color: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
      box([1.1, 2.2, 0.9], [0, 1.1, 0], m(0x111827, 0.5), g); const sc = box([0.9, 0.7, 0.05], [0, 1.6, 0.46], glow(color, 1.6), g, false); void sc;
      box([1.1, 0.25, 0.95], [0, 2.3, 0], glow(color, 2), g, false); box([0.9, 0.1, 0.4], [0, 1.05, 0.55], m(0x334155), g);
      solid(x, z, 1.1, 1.1);
    };
    if (has("furniture-arcade")) {
      arcadeCab(-6, -2.3, 0, 0x22d3ee);
      actionsRef.current.arcade = () => { setNotice("🕹️ Heading to A.R.I.S.E Arcade…"); window.setTimeout(() => navigate("/arise-arcade"), 500); };
      hotspots.push({ id: "arcade", label: "Play in the Arcade", emoji: "🕹️", x: -6, z: -0.9, r: 1.3 });
    }
    if (loft || rank >= 2) { // neon arcade wall + DJ booth
      [0xf472b6, 0x22d3ee, 0xa3e635].forEach((c, i) => arcadeCab(-14.9 + i * 1.3, -2.35, 0, c));
      const neon = new THREE.Group(); scene.add(neon);
      for (const [x, z, w, d, c] of [[-10.2, 2.85, 11.4, 0.05, 0xf472b6], [-10.2, -2.85, 11.4, 0.05, 0x22d3ee]] as [number, number, number, number, number][]) box([w, 0.08, d], [x, 2.65, z], glow(c, 3), neon, false);
      const dj = new THREE.Group(); dj.position.set(-6.4, 0, 2); scene.add(dj);
      box([2, 1.05, 0.9], [0, 0.52, 0], m(0x111827, 0.4), dj); box([2.1, 0.08, 1], [0, 1.08, 0], glow(0xa855f7, 1.5), dj, false);
      const decks: THREE.Mesh[] = []; for (const dx of [-0.5, 0.5]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), m(0x0f172a, 0.3)); d.position.set(dx, 1.15, 0); dj.add(d); decks.push(d); }
      solid(-6.4, 2, 2, 0.9);
      const party = [new THREE.PointLight(0xf472b6, 0, 12, 1.5), new THREE.PointLight(0x22d3ee, 0, 12, 1.5), new THREE.PointLight(0xa3e635, 0, 12, 1.5)];
      party.forEach(p => { p.position.set(-10, 2.6, 0); scene.add(p); });
      let partying = false, beatAt = 0;
      animators.push((t) => {
        decks.forEach(d => { d.rotation.y = partying ? t * 6 : 0; });
        party.forEach((p, i) => { p.intensity = partying ? 9 : 0; p.position.set(-10 + Math.cos(t * 2 + i * 2) * 4, 2.6, Math.sin(t * 2 + i * 2) * 2); });
        if (partying && t > beatAt) { beatAt = t + 0.5; playNotes([110, 0, 220], 0.12, "square"); }
      });
      actionsRef.current.dj = () => { partying = !partying; setNotice(partying ? "🎧 Party mode ON! 🪩" : "Party mode off."); };
      hotspots.push({ id: "dj", label: "Party mode (DJ booth)", emoji: "🎧", x: -6.4, z: 0.6, r: 1.3 });
    }

    // ── Bathroom ──
    if (rank >= 3) {
      const tub = new THREE.Group(); tub.position.set(9.2, 0, -0.4); scene.add(tub);
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.9, 32, 1, true), m(0xf8fafc, 0.3)); shell.position.y = 0.45; shell.castShadow = true; tub.add(shell);
      const water = new THREE.Mesh(new THREE.CircleGeometry(1.65, 32), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.75; tub.add(water);
      const bubbles: THREE.Mesh[] = []; for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); b.userData.a = Math.random() * 6; b.userData.r = Math.random() * 1.4; tub.add(b); bubbles.push(b); }
      animators.push(t => bubbles.forEach((b, i) => { const p = (t * 0.7 + i / 18) % 1; b.position.set(Math.cos(b.userData.a + t) * b.userData.r, 0.75 + p * 0.25, Math.sin(b.userData.a + t) * b.userData.r); }));
      solid(9.2, -0.4, 3.6, 3.6);
    } else {
      box([4.2, 1, 2], [8.9, 0.5, -1.6], m(0xf8fafc, 0.3)); const w = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.6), m(0x7dd3fc, 0.1)); w.rotation.x = -Math.PI / 2; w.position.set(8.9, 0.9, -1.6); scene.add(w); solid(8.9, -1.6, 4.2, 2);
    }
    box([2.4, 0.9, 1], [13.2, 0.45, 2.3], m(0xf8fafc, 0.3)); box([2, 1.4, 0.06], [13.2, 2, 2.75], m(0xcbd5e1, 0.05, { metalness: 0.9 }), scene, false); solid(13.2, 2.3, 2.4, 1);
    box([0.8, 0.8, 1], [15.3, 0.4, -2], m(0xf8fafc, 0.3)); solid(15.3, -2, 0.8, 1);
    rug(11.5, 0.2, 2.4, 1.4, 0xbfdbfe);

    // ── Reading room ──
    rug(-8.5, -6.8, 6.5, 4, 0x0f766e);
    bookshelf(-8.5, -10.55);
    actionsRef.current.books = () => { setNotice("📚 Opening the library…"); window.setTimeout(() => navigate("/library"), 500); };
    hotspots.push({ id: "books", label: "Pick a book to read", emoji: "📚", x: -8.5, z: -9.3, r: 1.6 });
    couch(-8.5, -5.2, 0x0f766e, Math.PI, 3.6); lamp(-12.2, -4.2);
    if (has("furniture-books")) bookshelf(-15.55, -7, Math.PI / 2, 5);
    if (has("furniture-neon")) { const sign = new THREE.Group(); sign.position.set(-4, 2.6, -10.8); scene.add(sign); for (let i = 0; i < 4; i++) box([0.5, 0.7, 0.06], [-0.9 + i * 0.6, 0, 0], glow([0x22d3ee, 0xf472b6, 0xfacc15, 0xa3e635][i], 3), sign, false); const nl = new THREE.PointLight(0x22d3ee, 4, 8); nl.position.set(-4, 2.4, -9.8); scene.add(nl); }
    if (has("furniture-telescope")) {
      const tg = new THREE.Group(); tg.position.set(-14.6, 0, -9.6); tg.rotation.y = -0.6; scene.add(tg);
      for (let i = 0; i < 3; i++) { const leg = box([0.06, 1.4, 0.06], [Math.cos(i * 2.1) * 0.3, 0.65, Math.sin(i * 2.1) * 0.3], m(0x334155), tg); leg.rotation.z = Math.cos(i * 2.1) * 0.25; }
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 16), m(0xf8fafc, 0.3, { metalness: 0.4 })); tube.rotation.z = Math.PI / 2.6; tube.position.y = 1.45; tg.add(tube);
      actionsRef.current.telescope = () => setNotice(["🔭 You spotted Saturn's rings!", "🔭 A shooting star zooms by!", "🔭 You can see craters on the Moon!"][Math.floor(Math.random() * 3)]);
      hotspots.push({ id: "telescope", label: "Look through the telescope", emoji: "🔭", x: -13.6, z: -8.6, r: 1.3 }); solid(-14.6, -9.6, 0.9, 0.9);
    }
    if (rank >= 1) { // art corner
      const ez = new THREE.Group(); ez.position.set(-2.4, 0, -5.4); ez.rotation.y = -0.5; scene.add(ez);
      for (const dx of [-0.45, 0.45]) { const l = box([0.07, 2, 0.07], [dx, 1, 0], m(0x92400e), ez); l.rotation.z = dx * -0.12; }
      const canvasArt = texture(128, (c, s) => { c.fillStyle = "#fffbeb"; c.fillRect(0, 0, s, s); ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(30 + i * 22, 50 + (i % 2) * 30, 18, 0, Math.PI * 2); c.fill(); }); }, [1, 1]);
      const cnv = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.8), new THREE.MeshStandardMaterial({ map: canvasArt })); cnv.position.set(0, 1.45, 0.06); ez.add(cnv); solid(-2.4, -5.4, 1, 0.8);
      for (const [px, pz] of [[-15.2, -3.8], [15.2, 3.8], [-1, 10.2]]) { const hang = new THREE.Group(); hang.position.set(px, 2.6, pz); scene.add(hang); for (let i = 0; i < 6; i++) { const v = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), m(0x16a34a, 0.9)); v.position.set(Math.sin(i) * 0.15, -i * 0.25, Math.cos(i) * 0.15); hang.add(v); } }
    }
    if (has("furniture-plants")) { plant(-1.2, -10.2, 1.2); plant(15, -10.2, 1.1); plant(1.2, 10.2, 1); plant(-15.1, -3.9, 0.9); }

    // ── Bedroom ──
    const bedG = new THREE.Group(); bedG.position.set(9, 0, -8); scene.add(bedG);
    box([3.6, 0.5, 5], [0, 0.3, 0], m(0x6b3f20, 0.7), bedG); box([3.4, 0.4, 4.7], [0, 0.72, 0.05], m(0xf8fafc, 0.9), bedG);
    box([3.45, 0.25, 3], [0, 0.95, 0.85], m(info.accent, 0.9), bedG); box([3.8, 1.8, 0.25], [0, 0.95, -2.5], m(new THREE.Color(info.accent).offsetHSL(0, 0, -0.1).getHex(), 0.8), bedG);
    for (const dx of [-0.85, 0.85]) box([1.3, 0.28, 0.7], [dx, 1.02, -1.75], m(0xffffff, 1), bedG);
    solid(9, -8, 3.6, 5.2);
    actionsRef.current.bed = () => { setNapping(true); setNotice("😴 Zzz… what a cozy nap."); window.setTimeout(() => setNapping(false), 2600); };
    hotspots.push({ id: "bed", label: "Take a nap", emoji: "🛏️", x: 9, z: -4.6, r: 1.6 });
    box([0.9, 0.7, 0.7], [11.5, 0.35, -10.2], m(0x6b3f20)); box([0.9, 0.7, 0.7], [6.5, 0.35, -10.2], m(0x6b3f20)); solid(11.5, -10.2, 0.9, 0.7); solid(6.5, -10.2, 0.9, 0.7);
    const nl2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), glow(0xfde68a, 1.2)); nl2.position.set(11.5, 0.95, -10.2); scene.add(nl2);
    rug(9, -4.4, 4.6, 1.8, 0xfef3c7);
    if (has("furniture-desk")) {
      tableAt(2.6, -9.9, 2.6, 1, 0x713f12); box([1.6, 0.95, 0.08], [2.6, 1.4, -10.2], m(0x111827, 0.3)); box([1.45, 0.8, 0.02], [2.6, 1.4, -10.15], glow(0x38bdf8, 0.9), scene, false);
      box([0.6, 0.9, 0.6], [2.6, 0.45, -8.9], m(info.accent, 0.6));
    }
    if (has("furniture-trophy")) {
      const sh = new THREE.Group(); sh.position.set(15.6, 0, -6.5); sh.rotation.y = -Math.PI / 2; scene.add(sh);
      box([3, 0.1, 0.5], [0, 1.4, 0], m(0x6b3f20), sh); box([3, 0.1, 0.5], [0, 2.2, 0], m(0x6b3f20), sh);
      for (let i = 0; i < 6; i++) { const tr = new THREE.Group(); tr.position.set(-1.2 + (i % 3) * 1.2, i < 3 ? 1.45 : 2.25, 0); sh.add(tr); const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.3, 12), m(i % 2 ? 0xd4af37 : 0xc0c0c0, 0.2, { metalness: 1 })); cup.position.y = 0.3; tr.add(cup); box([0.24, 0.12, 0.24], [0, 0.06, 0], m(0x1f2937), tr, false); }
    }
    if (has("furniture-aquarium") || rank >= 1) {
      const aq = new THREE.Group(); aq.position.set(13.3, 0, -3.55); aq.rotation.y = Math.PI; scene.add(aq);
      box([3.2, 0.8, 0.9], [0, 0.4, 0], m(0x1f2937, 0.5), aq);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0e7490, emissiveIntensity: 0.6, transparent: true, opacity: 0.45, roughness: 0.05 })); glass.position.y = 1.45; aq.add(glass);
      const fish: THREE.Mesh[] = []; for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), glow([0xf97316, 0xfacc15, 0xef4444, 0x22d3ee, 0xa855f7, 0xf472b6][i], 1)); f.rotation.z = Math.PI / 2; aq.add(f); fish.push(f); }
      for (let i = 0; i < 5; i++) { const weed = box([0.06, 0.5 + Math.random() * 0.4, 0.06], [-1.3 + i * 0.6, 1.0, -0.2], m(0x16a34a), aq, false); void weed; }
      animators.push(t => fish.forEach((f, i) => { const p = t * (0.4 + i * 0.07) + i; f.position.set(Math.sin(p) * 1.3, 1.2 + (i % 3) * 0.28 + Math.sin(p * 2) * 0.06, Math.cos(p * 1.3) * 0.2); f.rotation.z = Math.cos(p) > 0 ? Math.PI / 2 : -Math.PI / 2; }));
      const aql = new THREE.PointLight(0x22d3ee, 3, 5); aql.position.set(13.3, 1.6, -4.5); scene.add(aql);
      solid(13.3, -3.55, 3.2, 0.9);
    }

    // ── Avatar & pet ──
    const rig = new AvatarRig(payload.state.selectedCharacter || "robin-hood"); rigRef.current = rig;
    rig.root.position.set(0, 0, 8.6); rig.root.rotation.y = Math.PI; scene.add(rig.root); targetRef.current.copy(rig.root.position);
    const pet = createPet(payload.state.equipped.pet, new GLTFLoader(), 0.9);
    if (pet) { pet.position.set(1, 0, 9.4); scene.add(pet); petRef.current = pet; }

    const blocked = (x: number, z: number) => {
      if (x < -15.5 || x > 15.5 || z < -10.5) return true;
      if (z > 10.6) return true;
      const r = 0.32;
      return solids.some(([x1, x2, z1, z2]) => x > x1 - r && x < x2 + r && z > z1 - r && z < z2 + r);
    };

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const pu = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 9) { down = null; return; } down = null;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
      const hits = ray.intersectObjects(scene.children, true);
      if (payload.isOwner && petRef.current && hits.some(h => findPetRoot(h.object) === petRef.current)) { openPetCare(); return; }
      const hit = hits.find(h => h.object.userData.ground);
      if (hit && !blocked(hit.point.x, hit.point.z)) targetRef.current.set(hit.point.x, 0, hit.point.z);
    };
    const kd = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase()), ku = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    renderer.domElement.addEventListener("pointerdown", pd); renderer.domElement.addEventListener("pointerup", pu); window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    const resize = () => { camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight); camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); }; resize(); window.addEventListener("resize", resize);
    const clock = new THREE.Clock(); const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    applyCamera(presetRef.current);

    const loop = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime, root = rig.root, before = root.position.clone();
      const k = keysRef.current; let side = 0, fwdIn = 0;
      if (k.has("w") || k.has("arrowup")) fwdIn += 1; if (k.has("s") || k.has("arrowdown")) fwdIn -= 1;
      if (k.has("d") || k.has("arrowright")) side += 1; if (k.has("a") || k.has("arrowleft")) side -= 1;
      let step = new THREE.Vector3();
      if (side || fwdIn) {
        camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); right.crossVectors(fwd, up).normalize();
        step = fwd.multiplyScalar(fwdIn).add(right.multiplyScalar(side)).normalize().multiplyScalar(4.4 * dt); targetRef.current.copy(root.position).add(step);
      } else { const d = targetRef.current.clone().sub(root.position); d.y = 0; if (d.length() > 0.1) step = d.normalize().multiplyScalar(Math.min(d.length(), 4.2 * dt)); }
      if (step.lengthSq() > 0) {
        const nx = root.position.x + step.x, nz = root.position.z + step.z;
        if (blocked(root.position.x, root.position.z) || !blocked(nx, nz)) root.position.set(nx, 0, nz); else if (!blocked(nx, root.position.z)) root.position.x = nx; else if (!blocked(root.position.x, nz)) root.position.z = nz; else targetRef.current.copy(root.position);
        let diff = Math.atan2(step.x, step.z) - root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); root.rotation.y += diff * Math.min(1, dt * 12);
      }
      const moved = root.position.clone().sub(before);
      rig.update(dt, moved.length() / Math.max(dt, 1e-4));
      if (presetRef.current !== "top") camera.position.add(moved); controls.target.add(moved);
      if (petRef.current) followOwner(petRef.current, root, dt, t, 1.1);
      animators.forEach(a => a(t, dt));
      roomLights.visible = lightsRef.current; hemi.intensity = lightsRef.current ? (loft ? 1.1 : 1.9) : 0.35; sun.intensity = lightsRef.current ? (loft ? 0.9 : 2.2) : 0.15;
      const current = ROOMS.find(r => r.test(root.position.x, root.position.z))?.name || "Front Hall";
      if (current !== lastRoom) { lastRoom = current; setRoom(current); }
      let near: Hotspot | null = null, best = Infinity;
      for (const h of hotspots) { const d = Math.hypot(root.position.x - h.x, root.position.z - h.z); if (d < h.r && d < best) { best = d; near = h; } }
      const key = near?.id || ""; if (key !== lastSpot) { lastSpot = key; setHotspot(near); }
      controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      renderer.domElement.removeEventListener("pointerdown", pd); renderer.domElement.removeEventListener("pointerup", pu);
      controls.dispose(); rig.dispose(); renderer.dispose(); mount.innerHTML = ""; rigRef.current = null; petRef.current = null; actionsRef.current = {};
    };
  }, [payload?.home.propertyId, homeId, payload?.state.selectedCharacter, payload?.state.equipped.pet, furnitureKey]);

  useEffect(() => { lightsRef.current = lightsOn; }, [lightsOn]);

  const activateHotspot = () => { if (!hotspot) return; if (hotspot.id === "door") { goOutside(); return; } actionsRef.current[hotspot.id]?.(); };
  const move = (key: "w" | "a" | "s" | "d", on: boolean) => { if (on) keysRef.current.add(key); else keysRef.current.delete(key); };
  const ownedHomes: CatalogItem[] = [{ id: "home-basic", type: "home", name: "Starter Cottage", price: 0, rarity: "starter" }, ...(payload?.catalog || []).filter(x => x.type === "home" && payload?.state.purchased.includes(x.id))];
  const allFurniture = (payload?.catalog || []).filter(x => x.type === "furniture");

  if (!payload) return <main className="relative grid h-[100dvh] place-items-center bg-slate-950 p-5 text-center text-white"><div><Home className="mx-auto h-12 w-12 text-cyan-300" /><h1 className="mt-3 text-2xl font-black">{notice}</h1><div className="mt-5 flex flex-wrap justify-center gap-2"><button onClick={() => navigate("/neighborhood")} className="rounded-xl bg-white/10 px-5 py-3 font-black">Back to The Block</button>{notice.toLowerCase().includes("buy") && <button onClick={() => navigate("/avatar-world")} className="flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950"><ShoppingBag className="h-4 w-4" /> Buy a home</button>}</div></div></main>;

  const info = homeInfo(homeId);
  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-slate-950 text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none" />
    {napping && <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-slate-950/85 text-6xl font-black transition-opacity">😴 Zzz…</div>}
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent p-2.5 sm:p-4">
      <button onClick={goOutside} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/88 px-3 font-black shadow-xl"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">The Block</span></button>
      <div className="min-w-0 flex-1"><p className="truncate text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">{payload.isOwner ? "My " + info.name : payload.home.displayName + "'s " + info.name}</p><h1 className="truncate text-base font-black sm:text-xl">{room}</h1></div>
      {payload.isOwner && <button onClick={() => void toggleDoor()} disabled={!!busy} className={"pointer-events-auto flex min-h-11 items-center gap-2 rounded-2xl px-3 text-xs font-black shadow-xl " + (payload.home.unlocked ? "bg-emerald-400 text-slate-950" : "bg-amber-300 text-slate-950")}>{payload.home.unlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}<span className="hidden sm:inline">{payload.home.unlocked ? "Door open" : "Door locked"}</span></button>}
      {payload.isOwner && <button onClick={() => setDecorate(true)} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-2xl bg-fuchsia-600/90 px-3 text-xs font-black shadow-xl"><Paintbrush className="h-4 w-4" /><span className="hidden sm:inline">Decorate</span></button>}
    </header>
    <div className="absolute right-3 top-20 z-30 flex flex-col gap-1 rounded-2xl border border-white/10 bg-slate-950/80 p-1.5 backdrop-blur">
      <div className="flex gap-1"><Camera className="m-2 h-4 w-4 text-cyan-300" />{(["follow", "wide", "top"] as const).map(p => <button key={p} onClick={() => applyCamera(p)} className={"min-h-9 rounded-xl px-2 text-[10px] font-black uppercase " + (cameraPreset === p ? "bg-cyan-300 text-slate-950" : "bg-white/10")}>{p}</button>)}</div>
      <div className="flex gap-1">
        <button onClick={() => setLightsOn(v => !v)} className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-white/10 px-2 text-[10px] font-black uppercase"><Lightbulb className="h-3.5 w-3.5" />{lightsOn ? "Lights off" : "Lights on"}</button>
        <button onClick={() => { rigRef.current?.gesture("wave"); setNotice("👋 Hi!"); }} className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-white/10 px-2 text-[10px] font-black uppercase"><Hand className="h-3.5 w-3.5" />Wave</button>
      </div>
    </div>
    {hotspot && <button onClick={activateHotspot} className="absolute bottom-24 left-1/2 z-40 flex min-h-14 -translate-x-1/2 items-center gap-2 rounded-2xl border-2 border-white/30 bg-emerald-400 px-5 text-base font-black text-slate-950 shadow-2xl">{hotspot.id === "door" ? <DoorOpen className="h-5 w-5" /> : <span className="text-2xl">{hotspot.emoji}</span>}{hotspot.label}</button>}
    <MobileJoystick onMove={move} className="bottom-24 left-4" label="Home movement controls" />
    {!hotspot && <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 max-w-[70vw] -translate-x-1/2 rounded-xl bg-slate-950/76 px-3 py-2 text-center text-[11px] font-bold text-white/90 backdrop-blur sm:text-xs">{notice}</div>}
    {decorate && payload.isOwner && <div className="fixed inset-0 z-[100] flex items-end bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:justify-center" onClick={() => setDecorate(false)}>
      <section className="max-h-[82dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-slate-950 p-4 shadow-2xl sm:max-w-2xl sm:rounded-[2rem]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3"><div className="flex-1"><p className="text-xs font-black uppercase tracking-widest text-cyan-300">My Property</p><h2 className="text-2xl font-black">Decorate Home</h2></div><span className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-black text-slate-950">🪙 {payload.economy?.wallet ?? 0}</span><button onClick={() => setDecorate(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10" aria-label="Close"><X /></button></div>
        <h3 className="mt-4 font-black">Which house to live in</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">{ownedHomes.map(home => <button key={home.id} disabled={!!busy} onClick={() => void customize({ action: "equip", slot: "home", itemId: home.id })} className={"min-h-16 rounded-xl border p-3 text-left font-black " + (payload.state.equipped.home === home.id || (home.id === "home-basic" && !payload.state.equipped.home) ? "border-cyan-200 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/5")}><span className="block">{homeInfo(home.id).name}</span><span className="text-[10px] uppercase opacity-60">{homeInfo(home.id).features.slice(-1)[0]}</span></button>)}</div>
        <h3 className="mt-5 flex items-center gap-2 font-black"><Sparkles className="h-4 w-4 text-amber-300" /> Furniture</h3>
        <p className="text-xs font-bold text-white/50">Tap furniture you own to place or remove it. Locked items can be bought in the shop.</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{allFurniture.map(item => {
          const owned = payload.state.purchased.includes(item.id), active = payload.state.furniture.includes(item.id);
          return <button key={item.id} disabled={!!busy} onClick={() => owned ? void customize({ action: "furniture", itemIds: active ? payload.state.furniture.filter(id => id !== item.id) : [...payload.state.furniture, item.id] }) : navigate("/avatar-world")} className={"min-h-20 rounded-xl border p-3 text-left font-black " + (active ? "border-emerald-200 bg-emerald-300 text-slate-950" : owned ? "border-white/10 bg-white/5" : "border-dashed border-white/15 bg-black/20 text-white/60")}>
            <span className="text-2xl">{FURNITURE_INFO[item.id]?.emoji || "🛋️"}</span><span className="block text-sm">{item.name}</span><span className="text-[10px] uppercase opacity-70">{active ? "✓ Placed" : owned ? "Tap to place" : "🔒 " + item.price + " coins"}</span>
          </button>;
        })}</div>
        <button onClick={() => navigate("/avatar-world")} className="mt-5 min-h-12 w-full rounded-xl bg-amber-300 font-black text-slate-950">Open the Shop</button>
      </section>
    </div>}
  </main>;
}
