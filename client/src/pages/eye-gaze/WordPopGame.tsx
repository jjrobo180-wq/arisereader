// Word Pop — find the word on the sign, then pop the soap bubble that says it. Bubbles hold still while you look at them.
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RotateCcw, Star } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import StageShell, { useStageSettings } from "@/components/eye-gaze/StageShell";
import { useAuth } from "@/context/AuthContext";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { POP_LEVELS, popBubbles, type PopRound } from "@shared/eyegaze/wordgames";
import { Stage, gradientSky } from "@/game/stage/stage";
import { StageAudio } from "@/game/stage/audio";
import { say, stopSpeaking } from "@/game/stage/voice";
import { signFace, wordSprite } from "@/game/stage/textures";

const bubbleMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uPop: { value: 0 } },
  vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }",
  fragmentShader: `uniform float uTime; uniform float uPop; varying vec3 vN; varying vec3 vV;
    vec3 film(float t){ return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + t)); }
    void main(){ float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0); float rim = pow(f, 2.2);
      vec3 col = film(f * 1.6 + uTime * 0.08 + vN.y * 0.3) * 0.9 + 0.1;
      vec3 L = normalize(vec3(-0.5, 0.7, 0.6)); float spec = pow(max(dot(reflect(-L, normalize(vN)), normalize(vV)), 0.0), 60.0);
      float a = clamp(0.06 + rim * 0.75 + spec, 0.0, 1.0) * (1.0 - uPop);
      gl_FragColor = vec4(col * (0.55 + rim) + vec3(spec * 1.5), a);
      #include <colorspace_fragment>
    }` });

type B = { g: THREE.Group; mat: THREE.ShaderMaterial; word: string; x: number; y: number; rest: number; life: number; phase: number; r: number; hovered: boolean; pop: number; push: number; squash: number; correct: boolean };

class Sky {
  bubbles: B[] = []; sign: THREE.Mesh; private deco: THREE.Points; private decoVel: Float32Array; private signMat: THREE.MeshBasicMaterial;
  constructor(private stage: Stage) {
    const s = stage.scene; gradientSky(s, 0x5fb8ff, 0xcdeeff, 0xfdf3ff);
    s.add(new THREE.HemisphereLight(0xffffff, 0xbad7ff, 1.4));
    // soft clouds
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const c = cv.getContext("2d")!;
    for (const [x, y, r] of [[70, 80, 46], [120, 62, 58], [175, 78, 44], [140, 92, 40], [95, 96, 36]] as const) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85 })); sp.position.set(-30 + i * 10 + Math.random() * 4, 3 + Math.random() * 12, -30 - Math.random() * 10); sp.scale.set(18, 9, 1); s.add(sp); }
    // little decorative bubbles drifting up behind
    const n = 70, pos = new Float32Array(n * 3); this.decoVel = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 24, -6 - Math.random() * 10], i * 3); this.decoVel[i] = 0.3 + Math.random() * 0.8; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dc = document.createElement("canvas"); dc.width = dc.height = 64; const d = dc.getContext("2d")!; d.strokeStyle = "rgba(255,255,255,.9)"; d.lineWidth = 4; d.beginPath(); d.arc(32, 32, 26, 0, 7); d.stroke(); d.fillStyle = "rgba(255,255,255,.25)"; d.fill(); d.fillStyle = "#fff"; d.beginPath(); d.arc(22, 22, 6, 0, 7); d.fill();
    const dt = new THREE.CanvasTexture(dc);
    this.deco = new THREE.Points(dg, new THREE.PointsMaterial({ map: dt, size: 0.9, transparent: true, depthWrite: false, opacity: 0.7 })); s.add(this.deco);
    this.signMat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), this.signMat); this.sign.visible = false; s.add(this.sign);
  }
  setSign(top: string, word: string, accent: number) { this.signMat.map = signFace(top, word.toUpperCase(), accent); this.signMat.needsUpdate = true; this.sign.visible = true; this.signBump = 1; }
  private signBump = 0;
  spawn(words: string[], target: string, onPick: (b: B) => void) {
    for (const b of this.bubbles) { this.stage.unpick(b.g); this.stage.scene.remove(b.g); b.mat.dispose(); }
    const { hw, hh } = this.stage.view(); const n = words.length; if (!n) { this.bubbles = []; return; }
    const ss = Math.min(1.25, (hw * 2 * 0.86) / 6); this.sign.scale.setScalar(ss);
    const signBottom = hh - 1.5 - ss * 3; this.sign.position.set(0, hh - 1.5 - ss * 1.5, -0.5);
    // bubbles rest in the band between the sign and the bottom of the screen: one row, or 2×2 on a tall screen
    const cols = hw / hh < 0.9 ? 2 : n, rows = Math.ceil(n / cols);
    const bandTop = signBottom - 0.3, bandBot = -hh + 0.3, cellW = (hw * 2 * 0.94) / cols, cellH = (bandTop - bandBot) / rows;
    const r = Math.min(cellW / 2.25, cellH / 2.25, 2.3);
    this.bubbles = words.map((w, i) => {
      const g = new THREE.Group(); const mat = bubbleMat();
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), mat); g.add(sphere);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: wordSprite(w), transparent: true, depthWrite: false })); label.scale.set(r * 1.7, r * 0.85, 1); label.renderOrder = 2; g.add(label);
      const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), k = i % cols;
      const x = (k - (inRow - 1) / 2) * cellW, restY = bandTop - cellH * (row + 0.5);
      const b: B = { g, mat, word: w, x, y: -hh - r - 0.4 - i * 0.7, rest: restY, phase: Math.random() * 6, life: 0, r, hovered: false, pop: 0, push: 0, squash: 0, correct: w === target };
      g.position.set(x, b.y, 0); this.stage.scene.add(g);
      this.stage.pick(g, { id: w + i, ringScale: 1.08, enabled: () => b.pop === 0, onHover: on => { b.hovered = on; }, onDwell: () => onPick(b) });
      return b;
    });
  }
  popAll() { for (const b of this.bubbles) if (b.pop === 0) b.pop = 0.001; }
  update(dt: number, t: number) {
    const pos = this.deco.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { let y = pos.getY(i) + this.decoVel[i] * dt; if (y > 14) y = -14; pos.setY(i, y); pos.setX(i, pos.getX(i) + Math.sin(t + i) * dt * 0.2); } pos.needsUpdate = true;
    for (const b of this.bubbles) {
      b.mat.uniforms.uTime.value = t;
      if (b.pop > 0) { b.pop += dt * 3; b.mat.uniforms.uPop.value = Math.min(1, b.pop); b.g.scale.setScalar(1 + b.pop * 0.5); b.g.children[1].visible = b.pop < 0.3; if (b.pop >= 1) b.g.visible = false; continue; }
      // float up into place, then bob gently — and hold still while someone is looking at it
      if (!b.hovered) b.life += dt;
      const gap = b.rest - b.y; b.y += Math.sign(gap) * Math.min(Math.abs(gap), Math.max(0.4, Math.abs(gap) * 2.2) * dt);
      b.push *= Math.pow(0.15, dt); b.squash = Math.max(0, b.squash - dt * 2);
      const calm = b.hovered ? 0.15 : 1;
      b.g.position.set(b.x + Math.sin(b.life * 0.8 + b.phase) * 0.22 * calm + b.push, b.y + Math.sin(b.life * 1.3 + b.phase) * 0.14 * calm, 0);
      const sq = 1 + Math.sin(t * 18) * 0.1 * b.squash; b.g.scale.set(sq, 2 - sq, 1);
    }
    this.signBump = Math.max(0, this.signBump - dt * 3);
    this.sign.rotation.z = Math.sin(t * 0.8) * 0.02; const sb = this.sign.scale.x; this.sign.scale.set(sb, sb, 1); this.sign.position.z = -0.5 + this.signBump * 0.8;
  }
  burst(b: B) { this.stage.fx.burst(b.g.position.x, b.g.position.y, 0.4, { color: [0xff7ad9, 0x7fe9ff, 0xfff27a, 0x9dff9b, 0xffffff], count: 70, speed: 7, life: 0.9, size: 0.28, gravity: 3, spreadZ: 2 }); }
}

export default function WordPopGame({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useStageSettings(uid);
  const pk = `arise-word-pop-v2:${uid ?? "guest"}`;
  const [best, setBest] = useState<Record<number, number>>(() => { try { return JSON.parse(localStorage.getItem(pk) || "{}"); } catch { return {}; } });
  const [level, setLevel] = useState(0); const [round, setRound] = useState(0); const [view, setView] = useState<"pick" | "play" | "done">("pick");
  const [wrongs, setWrongs] = useState(0);
  const host = useRef<HTMLDivElement>(null); const stageRef = useRef<Stage | null>(null); const skyRef = useRef<Sky | null>(null);
  const audio = useRef<StageAudio | null>(null); if (!audio.current) audio.current = new StageAudio();
  const sRef = useRef(settings); sRef.current = settings; const lock = useRef(false); const wr = useRef(0); const resume = useRef<(() => void) | null>(null); const cur = useRef("");

  useEffect(() => { audio.current!.setVolumes(settings.music, settings.sfx); if (stageRef.current) stageRef.current.dwell = settings.dwell; }, [settings]);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const st = new Stage(el, { quality: settings.quality, fov: 45, camPos: [0, 0, 16], bloom: 0.4, dwell: settings.dwell, dwellMs: 1000 });
    stageRef.current = st; const sky = new Sky(st); skyRef.current = sky; st.onFrame = (dt, t) => sky.update(dt, t); resume.current?.();
    return () => { st.dispose(); stageRef.current = null; skyRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality]);
  useEffect(() => () => { stopSpeaking(); audio.current?.dispose(); }, []);

  const lvl = POP_LEVELS[level];
  const showRound = useCallback((li: number, ri: number) => {
    const r: PopRound = POP_LEVELS[li].rounds[ri]; const sky = skyRef.current; if (!sky) return;
    lock.current = false; stageRef.current?.calm(500); sky.setSign("FIND THIS WORD", r.target, 0x2563eb); resume.current = () => showRound(li, ri); cur.current = `${li}:${ri}`;
    say(`Find the word ${r.target}.`, sRef.current.voice);
    sky.spawn(popBubbles(r), r.target, b => {
      if (lock.current || b.pop > 0) return;
      const a = audio.current!; a.ensure();
      if (b.correct) {
        lock.current = true; b.pop = 0.001; sky.burst(b); a.play("pop"); a.play("match", ri);
        sky.setSign("POP! YOU FOUND", r.target, 0x16a34a); say(`${r.target}!`, sRef.current.voice);
        window.setTimeout(() => { sky.popAll(); a.play("bubble"); }, 650);
        window.setTimeout(() => {
          if (ri + 1 < POP_LEVELS[li].rounds.length) { setRound(ri + 1); showRound(li, ri + 1); }
          else { const stars = wr.current === 0 ? 3 : wr.current <= 2 ? 2 : 1; resume.current = null; setView("done"); a.play("win"); celebrateEyeGaze(false); say("You popped every word! Great reading!", sRef.current.voice);
            setBest(s => { const n = { ...s, [li]: Math.max(s[li] || 0, stars) }; try { localStorage.setItem(pk, JSON.stringify(n)); } catch { /* ignore */ } return n; }); }
        }, 1500);
      } else {
        wr.current++; setWrongs(wr.current); b.squash = 1; b.push = (b.x > 0 ? -1 : 1) * 0.8; a.play("bounce");
        sky.setSign(`THAT SAYS ${b.word.toUpperCase()} · FIND`, r.target, 0xd97706); window.setTimeout(() => { if (!lock.current && skyRef.current === sky && cur.current === `${li}:${ri}`) sky.setSign("FIND THIS WORD", r.target, 0x2563eb); }, 2200); say(`That says ${b.word}. Find ${r.target}.`, sRef.current.voice, undefined, true);
      }
    });
  }, [pk]);
  const start = (li = level) => { audio.current!.ensure(); audio.current!.play("select"); audio.current!.startMusic(67, 100, "major", li * 31 + 5); audio.current!.setEnergy(0); setLevel(li); setRound(0); wr.current = 0; setWrongs(0); setView("play"); window.setTimeout(() => showRound(li, 0), 50); };
  const D = settings.dwell;

  return (
    <StageShell title="Word Pop" badge="🫧" accent="#2563eb" hostRef={host} onBack={() => { stopSpeaking(); audio.current?.stopMusic(); onBack(); }} settings={settings} onSettings={setSettings}
      progress={view !== "pick" ? <span className="flex items-center gap-1">{lvl.rounds.map((_, i) => <span key={i} className={"h-3 w-3 rounded-full " + (i < round || view === "done" ? "bg-sky-500" : i === round ? "bg-sky-300" : "bg-slate-300")} />)}</span> : undefined}>
      {view === "pick" && <section data-stage-ui className="sg-up absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto max-w-3xl rounded-[2rem] border-4 border-white bg-white/92 p-4 shadow-2xl backdrop-blur sm:p-6">
          <h2 className="text-3xl font-black sm:text-4xl">Word Pop</h2>
          <p className="font-bold text-slate-600">Read the word on the sign, then pop the bubble that says it. Bubbles hold still while you look at them.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {POP_LEVELS.map((l, i) => <GazeButton key={i} dwell={D} onSelect={() => start(i)} className="min-h-28 rounded-2xl border-4 border-sky-100 bg-sky-50 p-3 text-left">
              <div className="flex items-center gap-2"><span className="text-4xl">{l.emoji}</span><span><span className="block text-xs font-black uppercase tracking-widest text-sky-700">Level {i + 1}</span><span className="text-xl font-black">{l.name}</span></span></div>
              <div className="mt-1 text-sm font-bold text-slate-500">{l.rounds.slice(0, 3).map(r => r.target.toUpperCase()).join(" · ")}…</div>
              <div className="mt-1 flex">{[0, 1, 2].map(n => <Star key={n} className={"h-5 w-5 " + ((best[i] || 0) > n ? "fill-amber-400 text-amber-400" : "text-slate-300")} />)}</div>
            </GazeButton>)}
          </div>
        </div>
      </section>}
      {view === "done" && <section data-stage-ui className="absolute inset-0 z-10 grid place-items-center bg-slate-900/30 p-3">
        <div className="sg-pop w-full max-w-md rounded-[2rem] border-4 border-white bg-white p-6 text-center shadow-2xl">
          <div className="text-5xl">🫧🎉</div><h2 className="mt-1 text-4xl font-black">Level done!</h2>
          <div className="mt-3 flex justify-center gap-2">{[0, 1, 2].map(n => <Star key={n} className={"h-12 w-12 " + (n < (wrongs === 0 ? 3 : wrongs <= 2 ? 2 : 1) ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}</div>
          <p className="mt-2 font-bold text-slate-600">{wrongs === 0 ? "Every bubble right the first time!" : `${wrongs} look-alike ${wrongs === 1 ? "bubble" : "bubbles"} bounced away.`}</p>
          <div className="mt-4 grid gap-2">
            {level + 1 < POP_LEVELS.length && <GazeButton dwell={D} onSelect={() => start(level + 1)} className="min-h-16 rounded-2xl bg-sky-500 text-xl font-black text-white">Next: {POP_LEVELS[level + 1].emoji} {POP_LEVELS[level + 1].name} ▶</GazeButton>}
            <div className="grid grid-cols-2 gap-2">
              <GazeButton dwell={D} onSelect={() => start(level)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-100 font-black"><RotateCcw className="h-5 w-5" />Again</GazeButton>
              <GazeButton dwell={D} onSelect={() => { skyRef.current?.spawn([], "", () => {}); if (skyRef.current) skyRef.current.sign.visible = false; setView("pick"); }} className="min-h-14 rounded-2xl bg-slate-100 font-black">Levels</GazeButton>
            </div>
          </div>
        </div>
      </section>}
    </StageShell>
  );
}
