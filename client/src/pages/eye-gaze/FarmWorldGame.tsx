// Farm World — a living 3D farm for eye-gaze explorers. Look at an animal to meet it (name + its real sound),
// fly between places with big look buttons, feed animals and watch them walk over and munch.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import StageShell, { Bubble, useStageSettings } from "@/components/eye-gaze/StageShell";
import { useAuth } from "@/context/AuthContext";
import { Stage } from "@/game/stage/stage";
import { StageAudio } from "@/game/stage/audio";
import { say, stopSpeaking } from "@/game/stage/voice";
import { buildFarm, groundY, inPond, POND, type FarmWorld } from "@/game/farm/world";
import { ANIMALS, EATS, FOOD, blocked, byId, foodMesh, loadAnimal, randomTarget, soundUrl, type AnimalDef, type FoodType } from "@/game/farm/animals";
import { heightAt } from "@/game/splash/water";
import { canvasTex, EMOJI_FONT } from "@/game/runner/textures";

type Runtime = { def: AnimalDef; root: THREE.Group; model: THREE.Object3D; mixer: THREE.AnimationMixer | null; walk: THREE.AnimationAction | null; idle: THREE.AnimationAction | null; active: "walk" | "idle" | null; legs: THREE.Object3D[];
  target: THREE.Vector3; pausedUntil: number; food: string | null; eating: number; phase: number; hop: number; heartT: number; dragging: boolean };
type Food = { id: string; type: FoodType; root: THREE.Group; pos: THREE.Vector3; by: string | null; left: number };
type View = { target: THREE.Vector3; yaw: number; pitch: number; dist: number };
const PLACES: { id: string; label: string; emoji: string; v: [number, number, number, number, number, number] }[] = [
  { id: "farm", label: "Whole farm", emoji: "🏡", v: [0, 0, 4, 0.55, 0.6, 74] },
  { id: "field", label: "Cows & sheep", emoji: "🐄", v: [-22, 0, 16, 0.35, 0.4, 22] },
  { id: "horses", label: "Horses", emoji: "🐴", v: [4, 0, 10, -0.2, 0.38, 19] },
  { id: "pigs", label: "Pig pen", emoji: "🐷", v: [15, 0, 21, 0.25, 0.48, 20] },
  { id: "pond", label: "Duck pond", emoji: "🦆", v: [POND.x, 0, POND.z, -0.5, 0.55, 21] },
  { id: "coop", label: "Hen house", emoji: "🐔", v: [31, 0, 9, -0.9, 0.42, 17] },
  { id: "barns", label: "Barns", emoji: "🛖", v: [0, 2, -16, 0.0, 0.28, 34] },
];
const viewOf = (v: [number, number, number, number, number, number]): View => ({ target: new THREE.Vector3(v[0], v[1], v[2]), yaw: v[3], pitch: v[4], dist: v[5] });

function nameTag(def: AnimalDef) {
  const t = canvasTex(640, 160, c => {
    const w = 600, h = 120, x = 20, y = 20, r = 56; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    c.fillStyle = "rgba(255,255,255,.95)"; c.fill(); c.lineWidth = 8; c.strokeStyle = "#16a34a"; c.stroke();
    c.textBaseline = "middle"; c.font = `78px ${EMOJI_FONT}`; c.fillText(def.emoji, 44, 84);
    c.fillStyle = "#14223f"; let s = 60; c.font = `900 ${s}px ui-rounded,system-ui,sans-serif`; while (c.measureText(def.name).width > 470 && s > 28) { s -= 4; c.font = `900 ${s}px ui-rounded,system-ui,sans-serif`; } c.fillText(def.name, 140, 84);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false })); sp.renderOrder = 60; sp.center.set(0.5, 0); return sp;
}

export default function FarmWorldGame({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useStageSettings(uid);
  const [loaded, setLoaded] = useState(0); const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null); const [following, setFollowing] = useState(false);
  const [panel, setPanel] = useState<null | "places" | "feed" | "pick-food">(null); const [placing, setPlacing] = useState<FoodType | null>(null);
  const [bubble, setBubble] = useState<{ text: string; icon?: string; tone?: "info" | "good" | "oops"; n: number } | null>({ text: "Look at an animal to say hello!", icon: "👀", n: 0 });
  const host = useRef<HTMLDivElement>(null); const stageRef = useRef<Stage | null>(null);
  const audio = useRef<StageAudio | null>(null); if (!audio.current) audio.current = new StageAudio();
  const sRef = useRef(settings); sRef.current = settings;
  const animals = useRef(new Map<string, Runtime>()); const foods = useRef(new Map<string, Food>()); const foodN = useRef(0);
  const cam = useRef<{ cur: View; want: View; follow: string | null }>({ cur: viewOf(PLACES[0].v), want: viewOf(PLACES[0].v), follow: null });
  const placingRef = useRef<FoodType | null>(null); placingRef.current = placing;
  const selRef = useRef<string | null>(null); selRef.current = selected;
  const sfx = useRef<HTMLAudioElement | null>(null); const sfxTimer = useRef(0); const bubbleTimer = useRef(0);
  const api = useRef<{ placeFood: (type: FoodType, at: THREE.Vector3, forId?: string) => boolean } | null>(null);

  const toast = (text: string, icon?: string, tone: "info" | "good" | "oops" = "info", ms = 4200) => { window.clearTimeout(bubbleTimer.current); setBubble(b => ({ text, icon, tone, n: (b?.n ?? 0) + 1 })); bubbleTimer.current = window.setTimeout(() => setBubble(null), ms); };
  const stopSound = () => { window.clearTimeout(sfxTimer.current); if (sfx.current) { sfx.current.pause(); sfx.current = null; } };
  const playSound = (def: AnimalDef, after?: () => void) => {
    stopSound(); const a = new Audio(soundUrl(def)); a.volume = Math.min(1, 0.25 + sRef.current.sfx * 0.75); sfx.current = a; let done = false;
    const fin = () => { if (done) return; done = true; window.clearTimeout(sfxTimer.current); if (sfx.current === a) { a.pause(); sfx.current = null; } after?.(); };
    a.onended = fin; a.onerror = fin; void a.play().then(() => { sfxTimer.current = window.setTimeout(fin, def.soundSeconds * 1000); }).catch(fin);
  };
  const meet = (id: string, fact = false) => {
    const def = byId[id]; if (!def) return; const rt = animals.current.get(id);
    setSelected(id); setPanel(p => (p === "pick-food" ? p : null)); if (rt) { rt.hop = 1; rt.pausedUntil = Math.max(rt.pausedUntil, performance.now() + 2600); }
    toast(fact ? def.fact : `${def.name} says “${def.sound}!”`, def.emoji, "info", fact ? 7000 : 4200);
    stopSpeaking(); stopSound(); audio.current?.play("select");
    say(fact ? def.fact : def.name, sRef.current.voice, () => { if (!fact) playSound(def); }, true);
  };

  useEffect(() => { audio.current!.setVolumes(settings.music, settings.sfx); if (stageRef.current) stageRef.current.dwell = settings.dwell; }, [settings]);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const st = new Stage(el, { quality: settings.quality, fov: 45, camPos: [40, 40, 50], bloom: 0.18, dwell: settings.dwell, dwellMs: 1100, exposure: 1.0 });
    stageRef.current = st; st.camera.far = 600; st.camera.updateProjectionMatrix();
    const world: FarmWorld = buildFarm(st.scene, settings.quality); let disposed = false;
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    // name tag for the selected / looked-at animal
    let tag: THREE.Sprite | null = null, tagFor: string | null = null;
    const showTag = (id: string | null) => { if (tagFor === id) return; if (tag) { st.scene.remove(tag); (tag.material as THREE.SpriteMaterial).map?.dispose(); tag = null; } tagFor = id; if (id) { tag = nameTag(byId[id]); st.scene.add(tag); } };
    let hoverId: string | null = null;
    // food placement marker (look at a spot and hold still)
    const marker = new THREE.Group(); marker.visible = false; st.scene.add(marker);
    const markRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 48), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false })); markRing.rotation.x = -Math.PI / 2; markRing.position.y = 0.08; marker.add(markRing);
    const markFill = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.85, 48, 1, 0, 0.01), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false })); markFill.rotation.x = -Math.PI / 2; markFill.position.y = 0.09; marker.add(markFill);
    let ghost: THREE.Group | null = null, ghostType: FoodType | null = null; const still = { p: new THREE.Vector3(999, 0, 999), t: 0 };

    const nearestEater = (type: FoodType, at: THREE.Vector3) => { let best: Runtime | null = null, bd = Infinity; animals.current.forEach(r => { if (!EATS[r.def.kind].includes(type) || r.food || r.eating > 0) return; const d = r.root.position.distanceTo(at); if (d < bd) { bd = d; best = r; } }); return best as Runtime | null; };
    const placeFood = (type: FoodType, at: THREE.Vector3, forId?: string) => {
      const x = THREE.MathUtils.clamp(at.x, -44, 44), z = THREE.MathUtils.clamp(at.z, -33, 35);
      if (blocked(x, z) && !forId) { toast("Put the food on open grass.", "🌱", "oops"); audio.current?.play("wrong"); return false; }
      const id = "food-" + ++foodN.current; const root = foodMesh(type); root.position.set(x, 0, z); root.scale.setScalar(0.01); st.scene.add(root);
      const f: Food = { id, type, root, pos: new THREE.Vector3(x, 0, z), by: null, left: 1 }; foods.current.set(id, f);
      st.fx.burst(x, 0.6, z, { color: [0xffffff, 0xfde68a], count: 24, speed: 3, life: 0.6, size: 0.3, gravity: 4, up: 2 }); audio.current?.play("drop");
      const eater = forId ? animals.current.get(forId) ?? null : nearestEater(type, f.pos);
      if (eater) { eater.food = id; f.by = eater.def.id; eater.target.copy(f.pos); eater.pausedUntil = performance.now() + 300; toast(`${eater.def.name} is coming for the ${FOOD[type].label.toLowerCase()}!`, FOOD[type].emoji, "good"); }
      else toast(`${FOOD[type].label} is ready — nobody here eats that yet.`, FOOD[type].emoji);
      return true;
    };
    api.current = { placeFood };

    // animals load one by one (stand-ins if a model can't download)
    let count = 0;
    for (const def of ANIMALS) {
      void loadAnimal(def).then(({ model, clips, standIn }) => {
        if (disposed) return;
        const root = new THREE.Group(); root.position.set(def.x, 0, def.z); root.rotation.y = Math.random() * Math.PI * 2; root.add(model); st.scene.add(root);
        let mixer: THREE.AnimationMixer | null = null, walk: THREE.AnimationAction | null = null, idle: THREE.AnimationAction | null = null;
        if (clips.length) { mixer = new THREE.AnimationMixer(model); const wc = clips.find(c => /walk|trot|run/i.test(c.name)) ?? clips[0], ic = clips.find(c => /idle|stand|rest|eat|graze/i.test(c.name)); walk = mixer.clipAction(wc); idle = ic ? mixer.clipAction(ic) : null; if (idle) idle.play(); else { walk.play(); walk.paused = true; } }
        const legs: THREE.Object3D[] = standIn ? (model.userData.legs as THREE.Object3D[]) : [];
        if (!standIn && !mixer) model.traverse(o => { if (/leg|hoof|foot|paw|limb/i.test(o.name) && legs.length < 8) legs.push(o); });
        const rt: Runtime = { def, root, model, mixer, walk, idle, active: idle ? "idle" : null, legs, target: randomTarget(def), pausedUntil: performance.now() + Math.random() * 2500, food: null, eating: 0, phase: Math.random() * 6, hop: 0, heartT: 0, dragging: false };
        animals.current.set(def.id, rt);
        st.pick(root, { id: def.id, dwellMs: 1100, ringScale: 0.8, onHover: on => { hoverId = on ? def.id : hoverId === def.id ? null : hoverId; }, onDwell: () => meet(def.id) });
        count++; setLoaded(count); if (count === ANIMALS.length) setReady(true);
      });
    }
    window.setTimeout(() => { if (!disposed) setReady(true); }, 15000);

    // pointer: drag animals, orbit the camera, tap to place food
    let drag: { id: string; x: number; y: number; moved: boolean } | null = null, orbit: { x: number; y: number; yaw: number; pitch: number } | null = null;
    st.onPointer = (_p, kind, touch) => {
      const g = st.pointerOn(ground);
      if (kind === "down") {
        if (placingRef.current && g) { if (placeFood(placingRef.current, g)) { setPlacing(null); } return; }
        const hit = st.hitTest(); const id = hit ? (ANIMALS.find(a => animals.current.get(a.id)?.root === hit)?.id ?? null) : null;
        if (id) drag = { id, x: st.client.x, y: st.client.y, moved: false }; else orbit = { x: st.client.x, y: st.client.y, yaw: cam.current.want.yaw, pitch: cam.current.want.pitch };
        return;
      }
      if (kind === "up") { if (drag?.moved) { const rt = animals.current.get(drag.id); if (rt) { rt.dragging = false; rt.target.copy(randomTarget(rt.def)); rt.pausedUntil = performance.now() + 1500; } } drag = null; orbit = null; return; }
      if (drag && st.pointerDown) {
        if (!drag.moved && Math.hypot(st.client.x - drag.x, st.client.y - drag.y) > 12) { drag.moved = true; audio.current?.play("jump"); }
        const rt = animals.current.get(drag.id); if (drag.moved && rt && g && !blocked(g.x, g.z, rt.def)) { rt.dragging = true; rt.root.position.set(g.x, 0, g.z); rt.target.copy(rt.root.position); rt.food = null; rt.pausedUntil = performance.now() + 2500; }
      } else if (orbit && st.pointerDown) {
        cam.current.follow = null; setFollowing(false);
        cam.current.want.yaw = orbit.yaw - (st.client.x - orbit.x) * 0.006; cam.current.want.pitch = THREE.MathUtils.clamp(orbit.pitch + (st.client.y - orbit.y) * 0.004, 0.12, 1.25);
      }
      void touch;
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); cam.current.want.dist = THREE.MathUtils.clamp(cam.current.want.dist * Math.pow(1.0015, e.deltaY), 8, 110); };
    el.addEventListener("wheel", wheel, { passive: false });

    let chirp = 3;
    st.onFrame = (dt, t) => {
      world.update(dt, t);
      const now = performance.now();
      // camera: ease toward the wanted view (or follow the chosen animal)
      const c = cam.current; if (c.follow) { const rt = animals.current.get(c.follow); if (rt) c.want.target.lerp(rt.root.position.clone().add(new THREE.Vector3(0, rt.def.height * 0.6, 0)), Math.min(1, dt * 3)); }
      const k = 1 - Math.exp(-dt * 2.6); c.cur.target.lerp(c.want.target, k); c.cur.yaw += (c.want.yaw - c.cur.yaw) * k; c.cur.pitch += (c.want.pitch - c.cur.pitch) * k; c.cur.dist += (c.want.dist - c.cur.dist) * k;
      const cp = Math.cos(c.cur.pitch); st.camera.position.set(c.cur.target.x + Math.sin(c.cur.yaw) * cp * c.cur.dist, c.cur.target.y + Math.sin(c.cur.pitch) * c.cur.dist, c.cur.target.z + Math.cos(c.cur.yaw) * cp * c.cur.dist);
      const minY = groundY(st.camera.position.x, st.camera.position.z) + 2; if (st.camera.position.y < minY) st.camera.position.y = minY;
      st.camera.lookAt(c.cur.target); world.sun.target.position.copy(c.cur.target); world.sun.position.copy(c.cur.target).add(new THREE.Vector3(-30, 45, 25));
      // animals
      animals.current.forEach(rt => {
        const { root, def } = rt; let target = rt.target;
        if (rt.food) { const f = foods.current.get(rt.food); if (!f) rt.food = null; else target = f.pos; }
        const dist = Math.hypot(root.position.x - target.x, root.position.z - target.z);
        if (rt.food && dist < 1.25 && rt.eating <= 0) { rt.eating = 3.6; audio.current?.play("munch"); }
        let walking = false;
        if (rt.eating > 0) {
          rt.eating -= dt; rt.phase += dt * 7; rt.model.rotation.x = Math.max(0, Math.sin(rt.phase)) * 0.18 + 0.08; rt.heartT -= dt;
          const f = rt.food ? foods.current.get(rt.food) : null; if (f) { f.left = Math.max(0.15, rt.eating / 3.6); f.root.scale.setScalar(f.left); }
          if (rt.heartT <= 0) { rt.heartT = 0.7; st.fx.burst(root.position.x, def.height + 0.4, root.position.z, { color: [0xff4d8d, 0xff8fb1], count: 4, speed: 1.2, life: 1, size: 0.45, gravity: -1.5 }); audio.current?.play("munch"); }
          if (rt.eating <= 0) { rt.model.rotation.x = 0; if (f) { st.scene.remove(f.root); foods.current.delete(f.id); } rt.food = null; rt.target.copy(randomTarget(def)); rt.pausedUntil = now + 1200; toast(`Yum! ${def.name} loved the ${f ? FOOD[f.type].label.toLowerCase() : "snack"}!`, "💕", "good"); audio.current?.play("goal"); }
        } else if (!rt.dragging && now > rt.pausedUntil) {
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
          animals.current.forEach(o => { if (o === rt) return; const dx = root.position.x - o.root.position.x, dz = root.position.z - o.root.position.z, d = Math.hypot(dx, dz); const R = (def.height + o.def.height) * 0.55; if (d > 0 && d < R) { dir.x += (dx / d) * (R - d) * 0.8; dir.z += (dz / d) * (R - d) * 0.8; } });
          dir.normalize(); const sp = def.speed * (rt.food ? 1.6 : 1) * dt; const nx = root.position.x + dir.x * sp, nz = root.position.z + dir.z * sp;
          if (blocked(nx, nz, def) && !(def.kind === "duck")) { rt.target.copy(randomTarget(def)); if (rt.food) { const f = foods.current.get(rt.food); if (f) f.by = null; rt.food = null; } }
          else { root.position.x = nx; root.position.z = nz; let want = Math.atan2(dir.x, dir.z); let dy = want - root.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; root.rotation.y += dy * Math.min(1, dt * 4); want = 0; void want; }
          if (rt.legs.length) { rt.phase += dt * (def.kind === "chicken" || def.kind === "duck" ? 14 : 8) * (rt.food ? 1.5 : 1); rt.legs.forEach((l, i) => { l.rotation.x = Math.sin(rt.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.45; }); }
        } else if (rt.legs.length) rt.legs.forEach(l => { l.rotation.x *= 0.85; });
        // ducks float; everyone else stands on the ground; a happy hop when you say hello
        rt.hop = Math.max(0, rt.hop - dt * 2.2);
        const floating = def.kind === "duck" && inPond(root.position.x, root.position.z, -0.3);
        root.position.y = (floating ? 0.02 + heightAt(root.position.x, root.position.z, t, world.ripples.filter(Boolean)) : 0) + Math.sin(rt.hop * Math.PI) * 0.6 * Math.min(1, def.height);
        if (floating && walking && Math.random() < dt * 2) world.addRipple(root.position.x, root.position.z, 0.25);
      });
      foods.current.forEach(f => { if (!f.by || f.left === 1) f.root.scale.setScalar(Math.min(1, f.root.scale.x + dt * 4)); });
      // name tag follows the selected or looked-at animal
      const tagId = hoverId ?? selRef.current; showTag(tagId);
      if (tag && tagFor) { const rt = animals.current.get(tagFor); if (rt) { tag.position.set(rt.root.position.x, rt.root.position.y + rt.def.height + 0.5, rt.root.position.z); const d = st.camera.position.distanceTo(tag.position); tag.scale.set(d * 0.2, d * 0.05, 1); } }
      // food placement by looking
      const pf = placingRef.current; const g = pf && (st.pointerHover || st.pointerDown) ? st.pointerOn(ground) : null;
      marker.visible = !!g;
      if (pf !== ghostType) { if (ghost) marker.remove(ghost); ghost = pf ? foodMesh(pf) : null; ghostType = pf; if (ghost) { ghost.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); (m.material as THREE.Material).transparent = true; (m.material as THREE.MeshStandardMaterial).opacity = 0.6; } }); marker.add(ghost); } }
      if (g && pf) {
        marker.position.set(g.x, 0, g.z); const ok = !blocked(g.x, g.z); (markRing.material as THREE.MeshBasicMaterial).color.setHex(ok ? 0xffd23f : 0xef4444);
        const d = st.camera.position.distanceTo(g); marker.scale.setScalar(Math.max(1, d / 22));
        if (g.distanceTo(still.p) > 0.6 * marker.scale.x) { still.p.copy(g); still.t = 0; } else if (st.dwell && ok) still.t += dt;
        const kk = Math.min(1, still.t / 1.4); markFill.geometry.dispose(); markFill.geometry = new THREE.RingGeometry(0.2, 0.85, 48, 1, Math.PI / 2, Math.max(0.01, kk * Math.PI * 2));
        if (kk >= 1) { still.t = -1; if (placeFood(pf, g)) setPlacing(null); }
      }
      chirp -= dt; if (chirp <= 0) { chirp = 3 + Math.random() * 6; audio.current?.play("chirp", Math.floor(Math.random() * 3)); }
    };
    if (import.meta.env.DEV) (window as unknown as { __farm?: unknown }).__farm = { animals: animals.current, foods: foods.current, cam: cam.current, stage: st };
    return () => { disposed = true; el.removeEventListener("wheel", wheel); animals.current.forEach(r => r.mixer?.stopAllAction()); animals.current.clear(); foods.current.clear(); st.dispose(); stageRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality]);
  useEffect(() => () => { stopSpeaking(); stopSound(); audio.current?.dispose(); window.clearTimeout(bubbleTimer.current); }, []);
  useEffect(() => { if (ready) { const a = audio.current!; a.ensure(); a.startMusic(65, 76, "major", 11); a.setEnergy(0); } }, [ready]);

  const go = (i: number) => { const c = cam.current; c.follow = null; setFollowing(false); const v = viewOf(PLACES[i].v); c.want = v; setPanel(null); audio.current?.play("whoosh", 4); toast(PLACES[i].label, PLACES[i].emoji, "info", 2200); };
  const nudge = (yaw: number, zoom: number) => { const c = cam.current; c.want.yaw += yaw; c.want.dist = THREE.MathUtils.clamp(c.want.dist * zoom, 8, 110); audio.current?.play("hover"); };
  const follow = () => { const id = selRef.current; if (!id) return; const c = cam.current; if (c.follow === id) { c.follow = null; setFollowing(false); return; } c.follow = id; c.want.dist = Math.max(10, byId[id].height * 9); c.want.pitch = 0.35; setFollowing(true); toast(`Following ${byId[id].name}`, "🎥", "info", 2400); };
  const feedSelected = (type: FoodType) => {
    const id = selRef.current; const rt = id ? animals.current.get(id) : null; setPanel(null); if (!rt || !api.current) return;
    const ang = rt.root.rotation.y; let at = rt.root.position.clone().add(new THREE.Vector3(Math.sin(ang) * 2, 0, Math.cos(ang) * 2));
    if (blocked(at.x, at.z, rt.def.kind === "duck" ? undefined : rt.def)) at = rt.root.position.clone().add(new THREE.Vector3(-Math.sin(ang) * 2, 0, -Math.cos(ang) * 2));
    if (rt.def.kind === "duck") { const dx = at.x - POND.x, dz = at.z - POND.z, d = Math.hypot(dx, dz) || 1; at.set(POND.x + (dx / d) * (POND.r + 1.6), 0, POND.z + (dz / d) * (POND.r + 1.6)); }
    api.current.placeFood(type, at, rt.def.id);
  };
  const sel = selected ? byId[selected] : null; const D = settings.dwell;
  const btn = "pointer-events-auto flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 text-base font-black shadow-xl backdrop-blur sm:px-4 sm:text-lg";

  return (
    <StageShell title="Farm World" badge="🚜" accent="#16a34a" hostRef={host} settings={settings} onSettings={setSettings}
      onBack={() => { stopSpeaking(); stopSound(); audio.current?.stopMusic(); onBack(); }}
      bubble={bubble ? <Bubble key={bubble.n} tone={bubble.tone} icon={bubble.icon}>{bubble.text}</Bubble> : placing ? <Bubble icon={FOOD[placing].emoji}>Look at the grass and hold still to put down {FOOD[placing].label.toLowerCase()}</Bubble> : undefined}>
      {!ready && <div className="absolute inset-0 z-30 grid place-items-center bg-gradient-to-b from-sky-300 to-emerald-300">
        <div className="sg-pop w-[min(440px,88vw)] rounded-[2rem] border-4 border-white bg-white/90 p-6 text-center shadow-2xl">
          <div className="text-6xl">🚜</div><h2 className="mt-2 text-3xl font-black">Opening the farm…</h2>
          <p className="mt-1 font-bold text-slate-600">Bringing in the animals · {loaded} / {ANIMALS.length}</p>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(loaded / ANIMALS.length) * 100}%` }} /></div>
        </div>
      </div>}
      {/* bottom controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col-reverse items-stretch gap-2 p-2 sm:flex-row sm:items-end sm:justify-between sm:p-4" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2">
          <GazeButton dwell={D} onSelect={() => setPanel(p => p === "places" ? null : "places")} className={btn + " bg-white/90"} label="Places">📍<span className="hidden sm:inline">Places</span></GazeButton>
          <GazeButton dwell={D} onSelect={() => { setPlacing(null); setPanel(p => p === "feed" ? null : "feed"); }} className={btn + " bg-amber-300/95"} label="Feed the animals">🥕<span className="hidden sm:inline">Feed</span></GazeButton>
          {placing && <GazeButton dwell={D} onSelect={() => setPlacing(null)} className={btn + " bg-white/90"} label="Cancel food">✕<span className="hidden sm:inline">Cancel</span></GazeButton>}
        </div>
        {sel && <div data-stage-ui className="pointer-events-auto sg-up w-full max-w-md rounded-[1.6rem] border-4 border-white bg-white/94 p-3 shadow-2xl backdrop-blur sm:p-4">
          <div className="flex items-center gap-3"><span className="text-4xl">{sel.emoji}</span><div className="min-w-0 flex-1"><h2 className="truncate text-xl font-black sm:text-2xl">{sel.name}</h2><p className="text-sm font-bold text-slate-500">Says “{sel.sound}!” · eats {EATS[sel.kind].map(f => FOOD[f].emoji).join(" ")}</p></div>
            <GazeButton dwell={D} onSelect={() => { setSelected(null); if (cam.current.follow) { cam.current.follow = null; setFollowing(false); } }} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100" label="Close"><X className="h-5 w-5" /></GazeButton></div>
          <div className="mt-2 grid grid-cols-4 gap-1.5 sm:gap-2">
            <GazeButton dwell={D} onSelect={() => meet(sel.id)} className="min-h-14 rounded-xl bg-emerald-500 text-sm font-black text-white sm:text-base">🔊<br />Hello</GazeButton>
            <GazeButton dwell={D} onSelect={() => meet(sel.id, true)} className="min-h-14 rounded-xl bg-sky-500 text-sm font-black text-white sm:text-base">💡<br />Fact</GazeButton>
            <GazeButton dwell={D} onSelect={() => setPanel("pick-food")} className="min-h-14 rounded-xl bg-amber-400 text-sm font-black sm:text-base">🍽️<br />Feed</GazeButton>
            <GazeButton dwell={D} onSelect={follow} pressed={following} className={"min-h-14 rounded-xl text-sm font-black sm:text-base " + (following ? "bg-violet-600 text-white" : "bg-slate-100")}>🎥<br />{following ? "Stop" : "Follow"}</GazeButton>
          </div>
        </div>}
      </div>
      {panel && <section data-stage-ui className="absolute inset-0 z-20 grid place-items-center bg-slate-900/25 p-3" onClick={() => setPanel(null)}>
        <div className="sg-pop w-full max-w-2xl rounded-[2rem] border-4 border-white bg-white/95 p-4 shadow-2xl sm:p-5" onClick={e => e.stopPropagation()}>
          {panel === "places" && <>
            <h2 className="text-2xl font-black sm:text-3xl">Where to?</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{PLACES.map((p, i) => <GazeButton key={p.id} dwell={D} onSelect={() => go(i)} className="min-h-20 rounded-2xl border-4 border-emerald-100 bg-emerald-50 p-2 font-black"><div className="text-3xl">{p.emoji}</div>{p.label}</GazeButton>)}</div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <GazeButton dwell={D} ms={800} onSelect={() => nudge(0.5, 1)} className="min-h-14 rounded-2xl bg-slate-100 text-lg font-black">⟲ Turn</GazeButton>
              <GazeButton dwell={D} ms={800} onSelect={() => nudge(-0.5, 1)} className="min-h-14 rounded-2xl bg-slate-100 text-lg font-black">Turn ⟳</GazeButton>
              <GazeButton dwell={D} ms={800} onSelect={() => nudge(0, 0.72)} className="min-h-14 rounded-2xl bg-slate-100 text-lg font-black">➕ Closer</GazeButton>
              <GazeButton dwell={D} ms={800} onSelect={() => nudge(0, 1.38)} className="min-h-14 rounded-2xl bg-slate-100 text-lg font-black">➖ Farther</GazeButton>
            </div>
          </>}
          {panel === "feed" && <>
            <h2 className="text-2xl font-black sm:text-3xl">Pick some food</h2>
            <p className="font-bold text-slate-500">Then look at a spot on the grass (or tap it). A hungry animal will come and eat!</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{(Object.keys(FOOD) as FoodType[]).map(f => <GazeButton key={f} dwell={D} onSelect={() => { setPanel(null); setPlacing(f); setBubble(null); audio.current?.play("select"); }} className="min-h-24 rounded-2xl border-4 border-amber-100 bg-amber-50 p-2 font-black"><div className="text-4xl">{FOOD[f].emoji}</div>{FOOD[f].label}</GazeButton>)}</div>
          </>}
          {panel === "pick-food" && sel && <>
            <h2 className="text-2xl font-black sm:text-3xl">What should {sel.name} eat?</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{EATS[sel.kind].map(f => <GazeButton key={f} dwell={D} onSelect={() => feedSelected(f)} className="min-h-24 rounded-2xl border-4 border-amber-100 bg-amber-50 p-2 font-black"><div className="text-4xl">{FOOD[f].emoji}</div>{FOOD[f].label}</GazeButton>)}</div>
          </>}
          <GazeButton dwell={D} onSelect={() => setPanel(null)} className="mt-3 min-h-12 w-full rounded-2xl bg-slate-100 font-black">Close</GazeButton>
        </div>
      </section>}
    </StageShell>
  );
}
