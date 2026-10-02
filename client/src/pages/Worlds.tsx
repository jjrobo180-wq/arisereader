import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";
import { GAMES } from "@shared/arcade/catalog";
import "./worlds.css";

type WorldId = "club" | "theater" | "neighborhood" | "laser" | "board" | "halloread" | "chess" | "space" | "racetrack";
type World = { id: WorldId; title: string; short: string; emoji: string; tag: string; description: string; path?: string; color: number };
const WORLDS: World[] = [
  { id: "club", title: "A.R.I.S.E Arcade", short: "Arcade", emoji: "🕹️", tag: "Games", description: `Dance, meet readers, hunt for stars, and play ${GAMES.length} arcade games with readers or the computer.`, path: "/arise-arcade", color: 0xc026d3 },
  { id: "chess", title: "Ultimate Chess", short: "Chess", emoji: "♛", tag: "Strategy", description: "Enter a cinematic chess arena, challenge the computer, or battle another reader live.", path: "/ultimate-chess", color: 0xe5c55f },
  { id: "neighborhood", title: "The Block", short: "The Block", emoji: "🏡", tag: "Explore", description: "Walk your neighborhood, find your house, and see other readers.", path: "/neighborhood", color: 0x4ade80 },
  { id: "theater", title: "A.R.I.S.E. Cinema", short: "Cinema", emoji: "🍿", tag: "Movies", description: "Sit with friends, grab popcorn, and watch the always-on Club movie channel.", path: "/club-arise/theater", color: 0xf59e0b },
  { id: "board", title: "Board Quest", short: "Board Quest", emoji: "🎲", tag: "Team game", description: "The original A.R.I.S.E. team board game with dice rolls, learning questions, power-ups, Rock Paper Scissors battles, points, shields, and multiplayer.", path: "/board-game-world", color: 0x22d3ee },
  { id: "halloread", title: "Halloread: Midnight Mystery", short: "Halloread", emoji: "🎃", tag: "Mystery", description: "Halloween after-hours mystery survival: security cameras, clues, roaming mascot robots, suspense encounters, multiplayer teams, and zero gore.", path: "/halloread-mystery", color: 0xf97316 },
  { id: "laser", title: "Prism Paintball", short: "Paintball", emoji: "🎨", tag: "Action", description: "5v5 third-person paintball: three paint markers, forts, inflatable bunkers, smart bots and live multiplayer.", path: "/paintball-arena", color: 0x22d3ee },
  { id: "space", title: "Skybound Sprint", short: "Skybound", emoji: "☁️", tag: "Adventure", description: "A 3D platform adventure across 8 sky worlds: run, jump, glide on the wind, ground-pound, collect Star Shards and defeat the Storm King.", path: "/skybound-sprint", color: 0x8b5cf6 },
  { id: "racetrack", title: "Aurora Racers", short: "Racers", emoji: "🏎️", tag: "Racing", description: "Kart racing on 4 wild tracks: drift for mini-turbos, throw paint bombs, win the Grand Prix and upgrade your kart.", path: "/aurora-rally", color: 0xf87171 },
];
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const SAVED_KEY = "worlds_selected";

function sphere(radius: number, color: number, roughness = .8) { return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), new THREE.MeshStandardMaterial({ color, roughness, metalness: .1 })); }
function marker(text: string) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128; const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(7,15,35,.91)"; ctx.beginPath(); ctx.roundRect(8, 10, 496, 106, 30); ctx.fill(); ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = "white"; ctx.font = "bold 39px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })); sprite.scale.set(3.7, .95, 1); return sprite;
}
function makeWorld(id: WorldId, color: number) {
  const group = new THREE.Group(); group.userData.worldId = id;
  const surface = sphere(1.25, id === "club" ? 0x251b51 : id === "theater" ? 0x2a1621 : id === "neighborhood" ? 0x65af7a : id === "laser" ? 0x102d3b : id === "board" ? 0x5b3a13 : id === "halloread" ? 0x190822 : id === "chess" ? 0x241b32 : id === "space" ? 0x27205d : 0x34775d); group.add(surface);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.4, .045, 10, 64), new THREE.MeshBasicMaterial({ color })); band.rotation.x = Math.PI / 2.5; group.add(band);
  if (id === "club") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.65, .8, .28, 12), new THREE.MeshStandardMaterial({ color: 0x191936, emissive: color, emissiveIntensity: .25 })); base.position.y = 1.16; group.add(base);
    for (const x of [-.4, 0, .4]) { const tower = new THREE.Mesh(new THREE.BoxGeometry(.3, .65, .3), new THREE.MeshStandardMaterial({ color: x === 0 ? 0x22d3ee : color, emissive: x === 0 ? 0x22d3ee : color, emissiveIntensity: .8 })); tower.position.set(x, 1.5, 0); group.add(tower); }
    const ball = sphere(.2, 0xffffff, .15); ball.position.set(0, 2.1, 0); group.add(ball);
  } else if (id === "theater") {
    const building = new THREE.Mesh(new THREE.BoxGeometry(1.35, .85, .95), new THREE.MeshStandardMaterial({ color: 0x241321, emissive: 0x7c2d12, emissiveIntensity: .25, roughness: .45 })); building.position.set(0, 1.45, 0); group.add(building);
    const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.55, .28, .18), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.2 })); marquee.position.set(0, 1.88, .5); group.add(marquee);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(.92, .5), new THREE.MeshBasicMaterial({ color: 0xe0f2fe })); screen.position.set(0, 1.48, .49); group.add(screen);
    for (const x of [-.48, 0, .48]) { const light = sphere(.08, 0xfef3c7, .15); light.position.set(x, 2.12, .05); group.add(light); }
    const popcorn = new THREE.Mesh(new THREE.CylinderGeometry(.18, .14, .34, 12), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: .6 })); popcorn.position.set(.72, 1.34, .55); group.add(popcorn);
    for (let i = 0; i < 5; i++) { const kernel = sphere(.07, 0xfef3c7, .5); kernel.position.set(.62 + (i % 3) * .08, 1.56 + Math.floor(i / 3) * .06, .54); group.add(kernel); }
  } else if (id === "neighborhood") {
    for (const x of [-.55, .45]) { const house = new THREE.Mesh(new THREE.BoxGeometry(.65, .6, .55), new THREE.MeshStandardMaterial({ color: x < 0 ? 0xffcf9a : 0xcce4fb })); house.position.set(x, 1.26, 0); group.add(house); const roof = new THREE.Mesh(new THREE.ConeGeometry(.52, .36, 4), new THREE.MeshStandardMaterial({ color: x < 0 ? 0xbe4859 : 0x208d7c })); roof.position.set(x, 1.76, 0); roof.rotation.y = Math.PI / 4; group.add(roof); }
  } else if (id === "laser") {
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(.92, .92, .18, 32), new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0x0e7490, emissiveIntensity: .65, metalness: .35 })); arena.position.y = 1.18; group.add(arena);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.78, .05, 8, 48), new THREE.MeshBasicMaterial({ color: 0x22d3ee })); ring2.rotation.x = Math.PI / 2; ring2.position.y = 1.3; group.add(ring2);
    for (let i = 0; i < 4; i++) { const tower = new THREE.Mesh(new THREE.BoxGeometry(.18, .65, .18), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x22d3ee : 0xf472b6, emissive: i % 2 ? 0x22d3ee : 0xf472b6, emissiveIntensity: 1.1 })); const a = i * Math.PI / 2; tower.position.set(Math.cos(a) * .62, 1.58, Math.sin(a) * .62); group.add(tower); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.5, 8), new THREE.MeshBasicMaterial({ color: 0x67e8f9 })); beam.rotation.z = Math.PI / 2; beam.position.set(0, 1.65, .15); group.add(beam);
    const shield = new THREE.Mesh(new THREE.OctahedronGeometry(.22, 0), new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x60a5fa, emissiveIntensity: 1.4 })); shield.position.set(0, 2.05, 0); group.add(shield);
  } else if (id === "board") {
    const building = new THREE.Mesh(new THREE.BoxGeometry(1.45, .9, .9), new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0e7490, emissiveIntensity: .2, roughness: .5 })); building.position.y = 1.5; group.add(building);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, .18, 1.02), new THREE.MeshStandardMaterial({ color: 0x111827, metalness: .25, roughness: .45 })); roof.position.y = 2.02; group.add(roof);
    for (const x of [-.42, 0, .42]) { const cam = new THREE.Mesh(new THREE.BoxGeometry(.28, .22, .16), new THREE.MeshStandardMaterial({ color: 0x172033, emissive: x === 0 ? 0xef4444 : 0x22d3ee, emissiveIntensity: 1.2 })); cam.position.set(x, 1.55, .47); group.add(cam); }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, .22, .08), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.4 })); sign.position.set(0, 2.2, .2); group.add(sign);
    const mascot = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .35, 4, 8), new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: .35, roughness: .5 })); mascot.position.set(.55, 2.48, 0); group.add(mascot);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfacc15 })); eye.position.set(.55, 2.63, .18); group.add(eye);
  } else if (id === "halloread") {
    const mansion = new THREE.Mesh(new THREE.BoxGeometry(1.25, .95, .72), new THREE.MeshStandardMaterial({ color: 0x21102e, emissive: 0x2e1065, emissiveIntensity: .28, roughness: .75 })); mansion.position.y = 1.55; group.add(mansion);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(.92, .72, 4), new THREE.MeshStandardMaterial({ color: 0x09040e, roughness: .9 })); roof.position.y = 2.28; roof.rotation.y = Math.PI / 4; group.add(roof);
    for (const x of [-.34, .34]) { const eye = new THREE.Mesh(new THREE.PlaneGeometry(.16, .2), new THREE.MeshBasicMaterial({ color: 0xff8a24 })); eye.position.set(x, 1.72, .37); group.add(eye); }
    const pumpkin = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12, emissiveIntensity: .6 })); pumpkin.scale.set(1, .82, 1); pumpkin.position.set(.75, 1.28, .42); group.add(pumpkin);
    for (const x of [-.7, .7]) { const web = new THREE.Mesh(new THREE.TorusGeometry(.35, .018, 6, 24), new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: .62 })); web.position.set(x, 2.45, .1); web.rotation.x = Math.PI / 2; group.add(web); }
  } else if (id === "chess") {
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.42, .14, 1.42), new THREE.MeshStandardMaterial({ color: 0x33263e, metalness: .28, roughness: .45 })); board.position.y = 1.23; group.add(board);
    for (let r = 0; r < 4; r++) for (let cc = 0; cc < 4; cc++) { const tile = new THREE.Mesh(new THREE.BoxGeometry(.3, .045, .3), new THREE.MeshStandardMaterial({ color: (r + cc) % 2 ? 0x5b476b : 0xe5d8bc, roughness: .52 })); tile.position.set(-.45 + cc * .3, 1.32, -.45 + r * .3); group.add(tile); }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.23, .34, .25, 20), new THREE.MeshStandardMaterial({ color: 0xf0df9b, metalness: .4, roughness: .3 })); base.position.set(0, 1.48, 0); group.add(base);
    const king = new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, .55, 18), new THREE.MeshStandardMaterial({ color: 0xf0df9b, metalness: .4, roughness: .3 })); king.position.set(0, 1.84, 0); group.add(king);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.27, .32, 5), new THREE.MeshStandardMaterial({ color: 0xe5b940, emissive: 0x7c5c12, emissiveIntensity: .65, metalness: .55, roughness: .26 })); crown.position.set(0, 2.25, 0); group.add(crown);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(.83, .035, 8, 48), new THREE.MeshBasicMaterial({ color: 0xf6d76d })); glow.rotation.x = Math.PI / 2; glow.position.y = 1.15; group.add(glow);
  } else if (id === "space") {
    const moon = sphere(.46, 0xffdcab); moon.position.set(.8, 1.6, 0); group.add(moon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .045, 8, 48), new THREE.MeshBasicMaterial({ color: 0xe9b8ff })); ring.position.copy(moon.position); ring.rotation.x = .5; group.add(ring);
    for (let i = 0; i < 6; i++) { const star = sphere(.07, 0xffffff); star.position.set(Math.sin(i * 2.4) * 1.6, Math.cos(i * 3) * 1.6, Math.cos(i * 2.4) * .9); group.add(star); }
  } else {
    const track = new THREE.Mesh(new THREE.TorusGeometry(.82, .19, 12, 48), new THREE.MeshStandardMaterial({ color: 0x202637 })); track.position.y = 1.24; track.rotation.x = Math.PI / 2; group.add(track);
    const car = new THREE.Mesh(new THREE.BoxGeometry(.5, .22, .3), new THREE.MeshStandardMaterial({ color: 0xff5563, emissive: 0x8b172b, emissiveIntensity: .4 })); car.position.set(.55, 1.45, .55); group.add(car);
  }
  const label = marker(WORLDS.find(world => world.id === id)!.title); label.position.y = 2.65; group.add(label);
  group.userData.label = label;
  return group;
}

export default function Worlds() {
  const [, navigate] = useLocation(); const mountRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<WorldId>(() => {
    try { const saved = localStorage.getItem(SAVED_KEY) as WorldId | null; if (saved && WORLDS.some(w => w.id === saved)) return saved; } catch { /* private mode */ }
    return "neighborhood";
  });
  const [travel, setTravel] = useState<{ path: string; label: string } | null>(null);
  const selectedRef = useRef(selected);
  const cardRefs = useRef<Partial<Record<WorldId, HTMLButtonElement | null>>>({});
  const world = WORLDS.find(item => item.id === selected)!;
  const index = WORLDS.indexOf(world);
  const step = (delta: number) => setSelected(WORLDS[(index + delta + WORLDS.length) % WORLDS.length].id);

  useEffect(() => {
    selectedRef.current = selected;
    try { localStorage.setItem(SAVED_KEY, selected); } catch { /* private mode */ }
    cardRefs.current[selected]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    // Warm the next world chunk while the student is reading its card.
    if (selected === "club") void import("./ClubArise");
    else if (selected === "theater") void import("./ClubTheater");
    else if (selected === "neighborhood") void import("./Neighborhood");
    else if (selected === "board") void import("./BoardGameWorld");
    else if (selected === "halloread") void import("./MidnightMystery");
    else if (selected === "chess") void import("./UltimateChess");
    else if (selected === "laser") void import("./PaintballArena");
    else if (selected === "space") void import("./SkyboundSprint");
    else if (selected === "racetrack") void import("./AuroraRally");
  }, [selected]);
  useEffect(() => {
    if (!travel) return;
    const timer = window.setTimeout(() => navigate(travel.path), 450);
    return () => window.clearTimeout(timer);
  }, [travel, navigate]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (travel || (e.target as HTMLElement | null)?.closest?.("input, textarea")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070b1b);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 100); camera.position.set(0, 7, 19);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0, 0); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 11; controls.maxDistance = 42; controls.minPolarAngle = .35; controls.maxPolarAngle = Math.PI - .35;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x233766, 2.5)); const sun = new THREE.DirectionalLight(0xffffff, 3.2); sun.position.set(-8, 12, 12); scene.add(sun);
    const galaxy = new THREE.Group(); scene.add(galaxy);
    const earth = sphere(3.15, 0x176a9d, .66); galaxy.add(earth);
    const landMaterial = new THREE.MeshStandardMaterial({ color: 0x55bb77, roughness: .9 });
    for (let i = 0; i < 45; i++) {
      const latitude = Math.asin(Math.sin(i * 2.39996) * .78), longitude = i * 2.41;
      const patch = new THREE.Mesh(new THREE.IcosahedronGeometry(.32 + (i % 5) * .08, 0), landMaterial);
      patch.position.set(Math.cos(latitude) * Math.cos(longitude) * 3.08, Math.sin(latitude) * 3.08, Math.cos(latitude) * Math.sin(longitude) * 3.08);
      patch.scale.set(1.4, .6, 1); earth.add(patch);
    }
    // Soft clouds drift over the land, a little faster than the planet turns.
    const clouds = new THREE.Group(); galaxy.add(clouds);
    const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: .55 });
    for (let i = 0; i < 18; i++) {
      const latitude = Math.asin(Math.sin(i * 1.7 + .4) * .7), longitude = i * 1.93;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(.22 + (i % 3) * .07, 10, 8), cloudMaterial);
      puff.position.set(Math.cos(latitude) * Math.cos(longitude) * 3.32, Math.sin(latitude) * 3.32, Math.cos(latitude) * Math.sin(longitude) * 3.32);
      puff.scale.set(1.8, 1.1, .5); puff.lookAt(0, 0, 0); clouds.add(puff);
    }
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(3.45, 40, 32), new THREE.MeshBasicMaterial({ color: 0x55baff, transparent: true, opacity: .11, depthWrite: false })); galaxy.add(atmosphere);
    const glowShell = new THREE.Mesh(new THREE.SphereGeometry(3.8, 40, 32), new THREE.MeshBasicMaterial({ color: 0x3fb6ff, transparent: true, opacity: .06, depthWrite: false, side: THREE.BackSide })); galaxy.add(glowShell);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(5.55, .025, 8, 128), new THREE.MeshBasicMaterial({ color: 0x57bce9, transparent: true, opacity: .6 })); halo.rotation.x = Math.PI / 2.7; galaxy.add(halo);
    const orbit = new THREE.Group(); galaxy.add(orbit);
    const RADIUS = 6.7;
    const track = new THREE.Mesh(new THREE.TorusGeometry(RADIUS, .018, 6, 180), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: .22 })); track.rotation.x = Math.PI / 2; orbit.add(track);
    const worlds: THREE.Group[] = [];
    const angles: number[] = [];
    WORLDS.forEach((item, i) => { const angle = i * 2 * Math.PI / WORLDS.length - .55; angles.push(angle); const planet = makeWorld(item.id, item.color); planet.position.set(Math.sin(angle) * RADIUS, (i % 2 ? -.8 : .9), Math.cos(angle) * RADIUS); orbit.add(planet); worlds.push(planet); });
    // A ring that always faces the camera marks the chosen world.
    const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, depthWrite: false });
    const reticle = new THREE.Mesh(new THREE.TorusGeometry(2.05, .055, 10, 96), reticleMaterial); scene.add(reticle);
    const starsNear = new THREE.BufferGeometry(); const positions = new Float32Array(600 * 3); for (let i = 0; i < 600; i++) { positions[i * 3] = (Math.random() - .5) * 85; positions[i * 3 + 1] = (Math.random() - .5) * 65; positions[i * 3 + 2] = (Math.random() - .5) * 85; } starsNear.setAttribute("position", new THREE.BufferAttribute(positions, 3)); const starField = new THREE.Points(starsNear, new THREE.PointsMaterial({ color: 0xc4dafa, size: .09, sizeAttenuation: true, transparent: true, opacity: .95 })); scene.add(starField);

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down: { x: number; y: number } | null = null;
    const worldAt = (e: PointerEvent): WorldId | null => {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
      for (const hit of ray.intersectObjects(worlds, true)) { let node: THREE.Object3D | null = hit.object; while (node) { if (node.userData.worldId) return node.userData.worldId as WorldId; node = node.parent; } }
      return null;
    };
    const pointerDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const pointerUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return; }
      down = null;
      const id = worldAt(e);
      if (id) setSelected(id);
    };
    let lastHover = 0;
    const pointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || down) return;
      const now = performance.now(); if (now - lastHover < 90) return; lastHover = now;
      renderer.domElement.style.cursor = worldAt(e) ? "pointer" : "grab";
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointerup", pointerUp); renderer.domElement.addEventListener("pointermove", pointerMove);
    const resize = () => { const width = mount.clientWidth, height = mount.clientHeight; camera.aspect = width / Math.max(height, 1); if (width < 640) { camera.position.set(0, 12, 33); } else { camera.position.set(0, 6.5, 18); } camera.updateProjectionMatrix(); renderer.setSize(width, height); controls.update(); }; resize(); window.addEventListener("resize", resize);

    let raf = 0; const clock = new THREE.Clock(); const worldPos = new THREE.Vector3();
    let shownId: WorldId | null = null;
    // After a new pick the orbit swings that world to the front, then lets the student spin freely.
    let focusUntil = 0;
    const animate = () => {
      const dt = Math.min(clock.getDelta(), .05); const t = clock.elapsedTime;
      earth.rotation.y += dt * .075; clouds.rotation.y += dt * .11; atmosphere.rotation.y -= dt * .035;
      const sel = Math.max(0, WORLDS.findIndex(w => w.id === selectedRef.current));
      if (shownId !== WORLDS[sel].id) { shownId = WORLDS[sel].id; reticleMaterial.color.setHex(WORLDS[sel].color); focusUntil = t + 1.8; }
      if (t < focusUntil) {
        const azimuth = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
        let turn = azimuth - angles[sel] - orbit.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        orbit.rotation.y += calm ? turn : turn * Math.min(1, dt * 3.2);
      } else if (!calm) orbit.rotation.y += dt * .018;
      worlds.forEach((planet, i) => {
        const chosen = i === sel;
        planet.rotation.y += dt * (chosen ? .35 : .09);
        const goal = chosen ? 1.38 : .86;
        planet.scale.setScalar(THREE.MathUtils.lerp(planet.scale.x, goal, calm ? 1 : Math.min(1, dt * 5)));
        const label = planet.userData.label as THREE.Sprite | undefined;
        if (label) (label.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((label.material as THREE.SpriteMaterial).opacity, chosen ? 1 : .42, Math.min(1, dt * 6));
      });
      const chosenPlanet = worlds[sel];
      chosenPlanet.getWorldPosition(worldPos);
      reticle.position.copy(worldPos);
      reticle.quaternion.copy(camera.quaternion);
      reticle.scale.setScalar(chosenPlanet.scale.x * (calm ? 1 : 1 + Math.sin(t * 3) * .035));
      starField.rotation.y += dt * .004;
      controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(animate);
    }; animate();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointerup", pointerUp); renderer.domElement.removeEventListener("pointermove", pointerMove); controls.dispose(); scene.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) mesh.geometry.dispose(); if (mesh.material) { const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach(material => { if ("map" in material && (material as THREE.SpriteMaterial).map) (material as THREE.SpriteMaterial).map?.dispose(); material.dispose(); }); } }); renderer.dispose(); mount.removeChild(renderer.domElement); };
  }, []);

  return <main className="club-world-root worlds-root" style={{ ["--world" as any]: hex(world.color) }}>
    <div ref={mountRef} className="worlds-canvas" aria-hidden="true" />
    <header className="worlds-top">
      <button type="button" className="worlds-back" onClick={() => setTravel({ path: "/library", label: "Returning to the library…" })}><ArrowLeft /> Library</button>
      <div className="worlds-title">
        <h1>Choose a world</h1>
        <p>Drag to spin, pinch to zoom, tap a world</p>
      </div>
    </header>

    <section className="worlds-dock" aria-label="Worlds">
      <div className="worlds-detail" aria-live="polite">
        <button type="button" className="worlds-step" onClick={() => step(-1)} aria-label="Previous world"><ChevronLeft /></button>
        <div className="worlds-detail-text">
          <span className="worlds-badge"><span aria-hidden="true">{world.emoji}</span> {world.tag}</span>
          <h2>{world.title}</h2>
          <p>{world.description}</p>
        </div>
        <button type="button" className="worlds-step" onClick={() => step(1)} aria-label="Next world"><ChevronRight /></button>
        {world.path
          ? <button type="button" className="worlds-enter" onClick={() => setTravel({ path: world.path!, label: `Entering ${world.title}…` })}>Enter {world.short}<ArrowRight /></button>
          : <div className="worlds-enter locked"><LockKeyhole /> Coming soon</div>}
      </div>
      <div className="worlds-rail" role="listbox" aria-label="Pick a world">
        {WORLDS.map(item => (
          <button key={item.id} ref={(el) => { cardRefs.current[item.id] = el; }} type="button" role="option" aria-selected={selected === item.id}
            className="worlds-card" style={{ ["--card" as any]: hex(item.color) }} onClick={() => setSelected(item.id)}>
            <span className="worlds-card-em" aria-hidden="true">{item.emoji}</span>
            <b>{item.short}</b>
            <small>{item.tag}</small>
          </button>
        ))}
      </div>
    </section>
    {travel && <WorldLoadingOverlay tone="universe" label={travel.label} />}
  </main>;
}
