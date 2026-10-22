// Sentence Train — look at the word blocks in order to load them onto the train, then the train reads the
// sentence back and chugs away. Picture + spoken sentence up top; wrong blocks wobble; hints after two misses.
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RotateCcw, Star, Volume2 } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import StageShell, { useStageSettings } from "@/components/eye-gaze/StageShell";
import { useAuth } from "@/context/AuthContext";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { SENTENCES, isNextWord, sentenceTiles, type Sentence } from "@shared/eyegaze/wordgames";
import { Stage, gradientSky } from "@/game/stage/stage";
import { StageAudio } from "@/game/stage/audio";
import { say, stopSpeaking } from "@/game/stage/voice";
import { blockFace, pictureFace } from "@/game/stage/textures";
import { mesh, roundedBox, std } from "@/game/runner/models";

const TRIPS = [
  { name: "Little Line", emoji: "🚂", color: 0xe11d48, list: SENTENCES.slice(0, 6) },
  { name: "Valley Express", emoji: "🚞", color: 0x2563eb, list: SENTENCES.slice(6, 12) },
  { name: "Mountain Run", emoji: "⛰️", color: 0x16a34a, list: SENTENCES.slice(12, 18) },
];
const BLOCK_COLORS = [0xf97316, 0x8b5cf6, 0x0ea5e9, 0x10b981, 0xec4899, 0xeab308, 0x6366f1, 0xef4444];
const sentenceText = (s: Sentence) => s.words.join(" ").toLowerCase().replace(/^\w/, c => c.toUpperCase()).replace(/\bi\b/g, "I") + ".";

type Block = { id: string; word: string; g: THREE.Group; home: THREE.Vector3; shake: number; hover: boolean; hint: boolean; placed: boolean; fly: { t: number; from: THREE.Vector3; car: number } | null };
type Car = { g: THREE.Group; ghost: THREE.Mesh; bounce: number; slotY: number };

function wheel(r: number) {
  const g = new THREE.Group();
  const tire = mesh(new THREE.CylinderGeometry(r, r, 0.22, 20), std(0x1f2937, 0.6), g); tire.rotation.x = Math.PI / 2;
  const hub = mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.26, 16), std(0xfacc15, 0.35, { metalness: 0.3 }), g); hub.rotation.x = Math.PI / 2;
  const spoke = mesh(new THREE.BoxGeometry(r * 1.7, r * 0.18, 0.28), std(0xfacc15, 0.35), g); spoke.userData.spin = true;
  return g;
}
function makeEngine(color: number) {
  const g = new THREE.Group(); const wheels: THREE.Group[] = [];
  const body = std(color, 0.4, { metalness: 0.15 }), dark = std(0x1e293b, 0.5), gold = std(0xfacc15, 0.3, { metalness: 0.5 });
  mesh(roundedBox(3.2, 0.36, 1.3, 0.1), dark, g, [0, 0.55, 0]);
  const boiler = mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.0, 24), body, g, [-0.55, 1.35, 0]); boiler.rotation.z = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.12, 24), gold, g, [-1.55, 1.35, 0]).rotation.z = Math.PI / 2;
  for (const x of [-0.95, -0.2]) mesh(new THREE.TorusGeometry(0.64, 0.05, 8, 24), gold, g, [x, 1.35, 0]).rotation.y = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.75, 14), dark, g, [-1.15, 2.25, 0]);
  mesh(new THREE.CylinderGeometry(0.36, 0.22, 0.2, 14), dark, g, [-1.15, 2.7, 0]);
  mesh(new THREE.SphereGeometry(0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, g, [-0.35, 1.95, 0]);
  mesh(roundedBox(1.2, 1.5, 1.3, 0.12), body, g, [0.95, 1.5, 0]);
  mesh(roundedBox(1.45, 0.16, 1.5, 0.06), dark, g, [0.95, 2.32, 0]);
  const win = std(0xbae6fd, 0.1, { emissive: 0x7dd3fc, emissiveIntensity: 0.25 });
  mesh(new THREE.PlaneGeometry(0.55, 0.5), win, g, [0.95, 1.75, 0.66], false);
  const lamp = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 14), std(0xfff7c2, 0.2, { emissive: 0xfff3a0, emissiveIntensity: 1.6 }), g, [-1.72, 1.5, 0]); lamp.rotation.z = Math.PI / 2;
  const catcher = mesh(new THREE.ConeGeometry(0.55, 0.6, 4), std(0xdc2626, 0.5), g, [-1.75, 0.55, 0]); catcher.rotation.z = Math.PI / 2; catcher.scale.set(1, 1, 1.8);
  for (const [x, r] of [[-1.05, 0.34], [-0.2, 0.34], [0.95, 0.48]] as const) { const w = wheel(r); w.position.set(x, r + 0.05, 0.62); g.add(w); wheels.push(w); const w2 = wheel(r); w2.position.set(x, r + 0.05, -0.62); g.add(w2); wheels.push(w2); }
  return { g, wheels, chimney: new THREE.Vector3(-1.15, 2.85, 0) };
}
function makeCar(color: number, len: number) {
  const g = new THREE.Group(); const wheels: THREE.Group[] = [];
  mesh(roundedBox(len, 0.42, 1.3, 0.1), std(color, 0.45), g, [0, 0.62, 0]);
  mesh(roundedBox(len + 0.1, 0.1, 1.4, 0.04), std(0xfacc15, 0.35), g, [0, 0.86, 0]);
  mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), std(0x334155), g, [-len / 2 - 0.2, 0.55, 0]);
  for (const x of [-len * 0.3, len * 0.3]) for (const z of [0.6, -0.6]) { const w = wheel(0.3); w.position.set(x, 0.33, z); g.add(w); wheels.push(w); }
  const ghost = new THREE.Mesh(roundedBox(len * 0.86, 1.0, 0.9, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  ghost.position.set(0, 1.45, 0); g.add(ghost);
  return { g, wheels, ghost };
}

class Line {
  blocks: Block[] = []; cars: Car[] = []; train = new THREE.Group(); private wheels: THREE.Group[] = []; private chimney = new THREE.Vector3();
  private pic: THREE.Mesh; private picMat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
  private trainX = 0; private trainV = 0; private targetX = 0; private leaving = false; private smokeT = 0; carLen = 2.6; trainScale = 1;
  private cloudsG = new THREE.Group();
  constructor(private stage: Stage) {
    const s = stage.scene; gradientSky(s, 0x60b6ff, 0xd4f0ff, 0x9ad17a);
    s.add(new THREE.HemisphereLight(0xffffff, 0x6b8f4e, 1.15));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.4); sun.position.set(-8, 14, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 14, bottom: -14, near: 1, far: 60 }); sun.shadow.normalBias = 0.03; s.add(sun);
    // rolling hills, trees and clouds
    const hillM = [std(0x7cc45a, 0.95), std(0x5fae4a, 0.95), std(0x92d26c, 0.95)];
    for (let i = 0; i < 9; i++) { const h = mesh(new THREE.SphereGeometry(1, 32, 16), hillM[i % 3], s, [-40 + i * 10 + (i % 2) * 3, -9, -22 - (i % 3) * 6], false); h.scale.set(9 + (i % 3) * 3, 5 + (i % 4) * 1.6, 5); h.receiveShadow = true; }
    const trunk = std(0x8b5a2b, 0.8), leaf = [std(0x2f9e44, 0.8), std(0x40c057, 0.8)];
    for (let i = 0; i < 16; i++) { const t = new THREE.Group(); const x = -30 + i * 4 + Math.sin(i * 7) * 1.5, z = -9 - (i % 3) * 3; mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.2, 8), trunk, t, [0, 0.6, 0]); mesh(new THREE.SphereGeometry(0.95, 14, 10), leaf[i % 2], t, [0, 1.7, 0]); mesh(new THREE.SphereGeometry(0.7, 14, 10), leaf[(i + 1) % 2], t, [0.45, 2.2, 0.1]); t.position.set(x, -6.4, z); t.scale.setScalar(0.9 + (i % 3) * 0.25); s.add(t); }
    const cloudM = std(0xffffff, 1, { emissive: 0xffffff, emissiveIntensity: 0.25 });
    for (let i = 0; i < 6; i++) { const c = new THREE.Group(); for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(1 + (k % 2) * 0.4, 14, 10), cloudM, c, [k * 1.3 - 2, Math.sin(k * 2) * 0.4, 0], false); c.position.set(-34 + i * 13, 7 + (i % 3) * 2.2, -26); c.scale.setScalar(1.3); this.cloudsG.add(c); }
    s.add(this.cloudsG);
    this.pic = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.28), this.picMat); this.pic.visible = false; s.add(this.pic);
    s.add(this.train);
  }
  /** Lay out the ground, track and picture for the current screen; returns the track height. */
  private ground: THREE.Group | null = null;
  layout() {
    const { hw, hh } = this.stage.view(); const trackY = -hh * 0.62;
    if (this.ground) this.stage.scene.remove(this.ground);
    const gr = new THREE.Group(); this.ground = gr;
    const grass = mesh(new THREE.PlaneGeometry(200, 40), std(0x86c95f, 0.95), gr, [0, trackY - 0.05, -10], false); grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
    const bed = mesh(new THREE.BoxGeometry(200, 0.2, 2.4), std(0xb59a7a, 0.95), gr, [0, trackY + 0.02, 0], false); bed.receiveShadow = true;
    const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.14, 2.0), std(0x7c4a26, 0.85), 220); sleepers.receiveShadow = true;
    const m = new THREE.Matrix4(); for (let i = 0; i < 220; i++) { m.makeTranslation(-110 + i, trackY + 0.16, 0); sleepers.setMatrixAt(i, m); } gr.add(sleepers);
    for (const z of [0.62, -0.62]) mesh(new THREE.BoxGeometry(200, 0.12, 0.1), std(0x94a3b8, 0.3, { metalness: 0.7 }), gr, [0, trackY + 0.28, z], false);
    // a little station platform on the left
    mesh(roundedBox(6, 0.5, 2.4, 0.08), std(0xd6c3a5, 0.9), gr, [-hw + 1.5, trackY + 0.25, -1.9], false);
    this.stage.scene.add(gr);
    this.train.position.y = trackY + 0.2;
    return trackY;
  }
  private picBump = 0;
  /** the picture board at the top; its caption carries the prompts and feedback */
  setPicture(text: string, emoji: string, accent = 0x0f766e) {
    const { hw, hh } = this.stage.view(); const ss = Math.min(1.15, (hw * 2 * 0.7) / 6);
    this.picMat.map = pictureFace(text, emoji, accent); this.picMat.needsUpdate = true; this.pic.visible = true; this.picBump = 1;
    this.pic.scale.setScalar(ss); this.pic.position.set(0, hh - 1.45 - ss * 1.64, -0.4);
    return hh - 1.45 - ss * 3.28;
  }
  build(s: Sentence, tiles: { id: string; word: string }[], color: number, onPick: (b: Block) => void, arriving: boolean) {
    for (const b of this.blocks) { this.stage.unpick(b.g); this.stage.scene.remove(b.g); }
    this.train.clear(); this.cars = []; this.wheels = [];
    const { hw } = this.stage.view(); const trackY = this.layout();
    const picBottom = this.setPicture("LISTEN, THEN LOAD THE WORDS", s.picture);
    // train: engine on the left, one car per word behind it
    const n = s.words.length; this.carLen = 2.6;
    const need = 3.4 + n * (this.carLen + 0.35); this.trainScale = Math.min(1, (hw * 2 - 0.8) / need);
    const eng = makeEngine(color); this.train.add(eng.g); this.wheels.push(...eng.wheels); this.chimney.copy(eng.chimney);
    for (let i = 0; i < n; i++) {
      const c = makeCar([0x0ea5e9, 0xf59e0b, 0x22c55e, 0xa855f7][i % 4], this.carLen);
      c.g.position.x = 1.6 + 0.3 + this.carLen / 2 + i * (this.carLen + 0.35) + 0.05; this.train.add(c.g); this.wheels.push(...c.wheels);
      this.cars.push({ g: c.g, ghost: c.ghost, bounce: 0, slotY: 1.45 });
    }
    this.train.scale.setScalar(this.trainScale);
    this.targetX = -hw + 0.4 + 1.8 * this.trainScale; this.train.position.x = this.targetX; this.trainX = arriving ? hw + 4 : this.targetX; this.trainV = 0; this.leaving = false;
    // word blocks in the band between the picture and the train
    const bandTop = picBottom - 0.3, bandBot = trackY + 3.4 * this.trainScale + 0.3, nt = tiles.length;
    const cols = hw < 6 ? 2 : Math.min(nt, nt > 6 ? Math.ceil(nt / 2) : nt), rows = Math.ceil(nt / cols);
    const cellW = (hw * 2 * 0.94) / cols, cellH = (bandTop - bandBot) / rows;
    const bw = Math.min(cellW * 0.86, cellH * 0.86 * 2, 4.2), bh = bw / 2;
    this.blocks = tiles.map((t, i) => {
      const g = new THREE.Group();
      const col = BLOCK_COLORS[i % BLOCK_COLORS.length];
      const body = mesh(roundedBox(bw, bh, bh * 0.7, bh * 0.16), std(col, 0.6), g); body.castShadow = true;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.97, bh * 0.97), new THREE.MeshBasicMaterial({ map: blockFace(t.word, col), transparent: true, toneMapped: false })); face.position.z = bh * 0.36; g.add(face);
      const row = Math.floor(i / cols), inRow = Math.min(cols, nt - row * cols), k = i % cols;
      const home = new THREE.Vector3((k - (inRow - 1) / 2) * cellW, bandTop - cellH * (row + 0.5), 0.5);
      g.position.copy(home); g.scale.setScalar(0.001); this.stage.scene.add(g);
      const b: Block = { id: t.id, word: t.word, g, home, shake: 0, hover: false, hint: false, placed: false, fly: null };
      g.userData.delay = 0.08 * i + (arriving ? 0.6 : 0); g.userData.bw = bw;
      this.stage.pick(g, { id: t.id, enabled: () => !b.placed && !b.fly && !this.leaving, onHover: on => { b.hover = on; }, onDwell: () => onPick(b), ringScale: 0.9 });
      return b;
    });
  }
  /** fly a block onto car i */
  load(b: Block, car: number) { b.fly = { t: 0, from: b.g.position.clone(), car }; this.stage.unpick(b.g); }
  private carSlot(i: number) { const c = this.cars[i]; const p = new THREE.Vector3(0, c.slotY, 0.0); c.g.localToWorld(p); return p; }
  bounceCar(i: number) { if (this.cars[i]) this.cars[i].bounce = 1; }
  depart() { this.leaving = true; for (const b of this.blocks) if (!b.placed && !b.fly) b.g.visible = false; }
  get gone() { return this.leaving && this.trainX < -this.stage.view().hw * 1.4 - this.cars.length * this.carLen * this.trainScale - 6; }
  update(dt: number, t: number) {
    // train motion
    if (this.leaving) { this.trainV = Math.max(-14, this.trainV - dt * 5); this.trainX += this.trainV * dt; }
    else { const d = this.targetX - this.trainX; this.trainV = d * 2.4; this.trainX += this.trainV * dt; }
    this.train.position.x = this.trainX;
    this.picBump = Math.max(0, this.picBump - dt * 3); this.pic.position.z = -0.4 + Math.sin(this.picBump * Math.PI) * 0.5; this.pic.rotation.z = Math.sin(t * 0.7) * 0.015;
    const speed = Math.abs(this.trainV);
    for (const w of this.wheels) w.rotation.z += this.trainV * dt / 0.35;
    this.train.position.y += Math.sin(t * 20) * 0.004 * Math.min(1, speed);
    this.smokeT -= dt;
    if (this.smokeT <= 0) { this.smokeT = speed > 0.5 ? 0.12 : 0.6; const p = this.chimney.clone(); this.train.localToWorld(p); this.stage.fx.burst(p.x, p.y, p.z, { color: [0xffffff, 0xe2e8f0], count: speed > 0.5 ? 5 : 2, speed: 0.8, life: 1.4, size: 0.9 * this.trainScale, gravity: -1.2, drag: 1.5, up: 1 }); }
    for (const [i, c] of this.cars.entries()) { c.bounce = Math.max(0, c.bounce - dt * 2.6); c.g.position.y = Math.sin(c.bounce * Math.PI) * 0.5; (c.ghost.material as THREE.MeshBasicMaterial).opacity = c.ghost.visible ? 0.28 + Math.sin(t * 3 + i) * 0.06 : 0; }
    // blocks
    for (const b of this.blocks) {
      const d = b.g.userData.delay as number; if (d > 0) { b.g.userData.delay = d - dt; continue; }
      if (b.fly) {
        b.fly.t = Math.min(1, b.fly.t + dt * 1.6); const k = b.fly.t, e = k * k * (3 - 2 * k);
        const to = this.carSlot(b.fly.car); const p = b.fly.from.clone().lerp(to, e); p.y += Math.sin(k * Math.PI) * 2.2; p.z += Math.sin(k * Math.PI) * 1.5;
        b.g.position.copy(p); b.g.rotation.z = Math.sin(k * Math.PI) * 0.4; b.g.scale.setScalar(THREE.MathUtils.lerp(1, this.fitScale(b), e));
        if (k >= 1) { const car = b.fly.car; b.fly = null; b.placed = true; this.attach(b, car); }
        continue;
      }
      if (b.placed) continue;
      const s = b.g.scale.x; const want = b.hover ? 1.08 : 1; b.g.scale.setScalar(s + (want - s) * Math.min(1, dt * 9));
      b.shake = Math.max(0, b.shake - dt * 2.4);
      b.g.position.set(b.home.x + Math.sin(t * 38) * 0.18 * b.shake, b.home.y + Math.sin(t * 1.6 + b.home.x) * 0.06 + (b.hint ? Math.abs(Math.sin(t * 4)) * 0.25 : 0), b.home.z + (b.hover ? 0.5 : 0));
      b.g.rotation.z = Math.sin(t * 30) * 0.06 * b.shake;
    }
  }
  private fitScale(b: Block) { return (this.carLen * 0.86 * this.trainScale) / (b.g.userData.bw as number); }
  private attach(b: Block, i: number) {
    // re-parent onto the car so it travels with the train
    const car = this.cars[i]; car.g.add(b.g); b.g.position.set(0, car.slotY, 0); b.g.rotation.set(0, 0, 0); b.g.scale.setScalar(this.fitScale(b) / this.trainScale);
    car.ghost.visible = false; car.bounce = 1;
    const p = new THREE.Vector3(0, car.slotY, 0.4); car.g.localToWorld(p); this.stage.fx.burst(p.x, p.y, p.z, { color: [0xffe14a, 0xffffff, 0x7dff6b], count: 30, speed: 4, life: 0.6, size: 0.25, gravity: 5 });
  }
  hint(word: string) { for (const b of this.blocks) b.hint = !b.placed && b.word === word && !this.blocks.some(o => o !== b && o.hint && !o.placed); }
  clearHints() { for (const b of this.blocks) b.hint = false; }
}

export default function SentenceTrainGame({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useStageSettings(uid);
  const pk = `arise-sentence-train-v2:${uid ?? "guest"}`;
  const [best, setBest] = useState<Record<number, number>>(() => { try { return JSON.parse(localStorage.getItem(pk) || "{}"); } catch { return {}; } });
  const [trip, setTrip] = useState(0); const [idx, setIdx] = useState(0); const [view, setView] = useState<"pick" | "play" | "done">("pick");
  const [placed, setPlaced] = useState(0); const [misses, setMisses] = useState(0);
  const host = useRef<HTMLDivElement>(null); const stageRef = useRef<Stage | null>(null); const lineRef = useRef<Line | null>(null);
  const audio = useRef<StageAudio | null>(null); if (!audio.current) audio.current = new StageAudio();
  const sRef = useRef(settings); sRef.current = settings;
  const st = useRef({ trip: 0, idx: 0, placed: 0, misses: 0, wrongHere: 0, busy: false, token: 0 });
  const resume = useRef<(() => void) | null>(null);

  useEffect(() => { audio.current!.setVolumes(settings.music, settings.sfx); if (stageRef.current) stageRef.current.dwell = settings.dwell; }, [settings]);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const s = new Stage(el, { quality: settings.quality, fov: 42, camPos: [0, 1.2, 18], target: [0, 0, 0], bloom: 0.3, dwell: settings.dwell, dwellMs: 1000 });
    stageRef.current = s; const line = new Line(s); lineRef.current = line; line.layout(); line.setPicture("ALL ABOARD!", "🚂🚃🚃");
    s.onFrame = (dt, t) => line.update(dt, t); resume.current?.();
    return () => { s.dispose(); stageRef.current = null; lineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality]);
  useEffect(() => () => { stopSpeaking(); audio.current?.dispose(); }, []);

  const sentence = TRIPS[trip].list[idx];
  const show = useCallback((ti: number, si: number, arriving: boolean) => {
    const line = lineRef.current; if (!line) return; const S = st.current; const tok = ++S.token;
    const s = TRIPS[ti].list[si]; S.trip = ti; S.idx = si; S.placed = 0; S.wrongHere = 0; S.busy = false; setPlaced(0); setIdx(si);
    resume.current = () => show(ti, si, false);
    stageRef.current?.calm(600);
    line.build(s, sentenceTiles(s), TRIPS[ti].color, b => {
      const a = audio.current!; a.ensure(); const v = sRef.current.voice;
      if (S.busy || S.token !== tok) return;
      if (isNextWord(s, S.placed, b.word)) {
        const car = S.placed; S.placed++; S.wrongHere = 0; setPlaced(S.placed); line.clearHints(); line.load(b, car); a.play("block"); window.setTimeout(() => a.play("couple"), 600);
        say(b.word.toLowerCase(), v);
        if (S.placed === s.words.length) {
          S.busy = true; line.setPicture(sentenceText(s).toUpperCase(), s.picture, 0x16a34a);
          window.setTimeout(() => {
            if (S.token !== tok) return; a.play("chime", 0);
            s.words.forEach((_, i) => window.setTimeout(() => { if (S.token === tok) { line.bounceCar(i); a.play("chime", i * 2); } }, 450 + i * 420));
            say(sentenceText(s), v, () => {
              if (S.token !== tok) return; a.play("toot"); window.setTimeout(() => a.play("chug"), 350); line.depart();
              const next = si + 1;
              window.setTimeout(() => {
                if (S.token !== tok) return;
                if (next < TRIPS[ti].list.length) { a.play("toot"); show(ti, next, true); }
                else { resume.current = null; const stars = S.misses <= 1 ? 3 : S.misses <= 5 ? 2 : 1; setView("done"); a.play("win"); celebrateEyeGaze(false); say("You built every sentence! All aboard!", v);
                  setBest(o => { const n = { ...o, [ti]: Math.max(o[ti] || 0, stars) }; try { localStorage.setItem(pk, JSON.stringify(n)); } catch { /* ignore */ } return n; }); }
              }, 2600);
            });
          }, 1000);
        } else line.setPicture(s.words.slice(0, S.placed).join(" ") + " …", s.picture);
      } else {
        S.misses++; S.wrongHere++; setMisses(S.misses); b.shake = 1; a.play("bounce");
        const want = s.words[S.placed];
        if (S.wrongHere >= 2) { line.hint(want); line.setPicture(`LOOK FOR ${want}`, s.picture, 0xd97706); say(`That says ${b.word.toLowerCase()}. Look for ${want.toLowerCase()}.`, v, undefined, true); }
        else { line.setPicture(`THAT SAYS ${b.word} · WHAT COMES NEXT?`, s.picture, 0xd97706); say(`That says ${b.word.toLowerCase()}. Which word comes next?`, v, undefined, true); }
      }
    }, arriving);
    window.setTimeout(() => { if (S.token === tok) say(sentenceText(s), sRef.current.voice); }, arriving ? 1200 : 300);
  }, [pk]);
  const start = (ti = trip) => { const a = audio.current!; a.ensure(); a.play("select"); a.startMusic(62, 104, "major", ti * 13 + 3); a.setEnergy(0.1); setTrip(ti); st.current.misses = 0; setMisses(0); setView("play"); window.setTimeout(() => { a.play("toot"); show(ti, 0, true); }, 60); };
  const D = settings.dwell;

  return (
    <StageShell title="Sentence Train" badge="🚂" accent="#e11d48" hostRef={host} onBack={() => { stopSpeaking(); audio.current?.stopMusic(); onBack(); }} settings={settings} onSettings={setSettings}
      progress={view !== "pick" ? <span className="flex items-center gap-1">{TRIPS[trip].list.map((_, i) => <span key={i} className={"h-3 w-3 rounded-full " + (i < idx || view === "done" ? "bg-rose-500" : i === idx ? "bg-rose-300" : "bg-slate-300")} />)}</span> : undefined}>
      {view === "play" && <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex gap-2 sm:bottom-5 sm:right-5">
        <GazeButton dwell={D} onSelect={() => say(sentenceText(sentence), true)} label="Hear the sentence" className="pointer-events-auto flex min-h-14 items-center gap-2 rounded-2xl bg-white/92 px-4 text-lg font-black shadow-xl backdrop-blur"><Volume2 className="h-6 w-6 text-rose-600" /><span>Hear it</span></GazeButton>
      </div>}
      {view === "play" && <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-2xl bg-white/85 px-3 py-2 text-sm font-black text-slate-600 shadow sm:bottom-5 sm:left-5">{placed} / {sentence.words.length} words</div>}
      {view === "pick" && <section data-stage-ui className="sg-up absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto max-w-3xl rounded-[2rem] border-4 border-white bg-white/92 p-4 shadow-2xl backdrop-blur sm:p-6">
          <h2 className="text-3xl font-black sm:text-4xl">Sentence Train</h2>
          <p className="font-bold text-slate-600">Listen to the sentence, then look at the words in order to load the train. All aboard!</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {TRIPS.map((t, i) => <GazeButton key={i} dwell={D} onSelect={() => start(i)} className="min-h-24 rounded-2xl border-4 border-rose-100 bg-rose-50 p-3 text-left">
              <div className="flex items-center gap-2"><span className="text-4xl">{t.emoji}</span><span><span className="block text-xs font-black uppercase tracking-widest text-rose-700">Trip {i + 1}</span><span className="text-xl font-black">{t.name}</span></span></div>
              <div className="mt-1 text-sm font-bold text-slate-500">{t.list.length} sentences · {t.list.map(s => s.picture.slice(0, 2)).slice(0, 3).join(" ")}</div>
              <div className="mt-1 flex">{[0, 1, 2].map(n => <Star key={n} className={"h-5 w-5 " + ((best[i] || 0) > n ? "fill-amber-400 text-amber-400" : "text-slate-300")} />)}</div>
            </GazeButton>)}
          </div>
        </div>
      </section>}
      {view === "done" && <section data-stage-ui className="absolute inset-0 z-10 grid place-items-center bg-slate-900/30 p-3">
        <div className="sg-pop w-full max-w-md rounded-[2rem] border-4 border-white bg-white p-6 text-center shadow-2xl">
          <div className="text-5xl">🚂🎉</div><h2 className="mt-1 text-4xl font-black">Trip complete!</h2>
          <div className="mt-3 flex justify-center gap-2">{[0, 1, 2].map(n => <Star key={n} className={"h-12 w-12 " + (n < (misses <= 1 ? 3 : misses <= 5 ? 2 : 1) ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}</div>
          <p className="mt-2 font-bold text-slate-600">{misses === 0 ? "Every word in the right order!" : `${misses} ${misses === 1 ? "block" : "blocks"} wobbled back.`}</p>
          <div className="mt-4 grid gap-2">
            {trip + 1 < TRIPS.length && <GazeButton dwell={D} onSelect={() => start(trip + 1)} className="min-h-16 rounded-2xl bg-rose-600 text-xl font-black text-white">Next: {TRIPS[trip + 1].emoji} {TRIPS[trip + 1].name} ▶</GazeButton>}
            <div className="grid grid-cols-2 gap-2">
              <GazeButton dwell={D} onSelect={() => start(trip)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-100 font-black"><RotateCcw className="h-5 w-5" />Again</GazeButton>
              <GazeButton dwell={D} onSelect={() => { st.current.token++; setView("pick"); }} className="min-h-14 rounded-2xl bg-slate-100 font-black">Trips</GazeButton>
            </div>
          </div>
        </div>
      </section>}
    </StageShell>
  );
}
