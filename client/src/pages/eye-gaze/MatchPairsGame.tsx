// Match Pairs — 3D word ↔ picture cards on a felt table. Look at a card (or tap it), then find its partner.
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RotateCcw, Star } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import StageShell, { Bubble, useStageSettings } from "@/components/eye-gaze/StageShell";
import { useAuth } from "@/context/AuthContext";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { MATCH_SETS, MatchGame, type MatchEvent } from "@shared/eyegaze/wordgames";
import { Stage, gradientSky } from "@/game/stage/stage";
import { StageAudio } from "@/game/stage/audio";
import { say, stopSpeaking } from "@/game/stage/voice";
import { cardBack, cardFace, checkBadge, feltTexture, woodTexture } from "@/game/stage/textures";
import { roundedBox } from "@/game/runner/models";

const ACCENTS = [0x7c3aed, 0x16a34a, 0xe11d48, 0xea580c, 0x0891b2, 0x2563eb, 0xca8a04, 0xdb2777];
const SIZES = [2, 3, 4, 6] as const;
type CardView = { g: THREE.Group; flip: number; lift: number; shake: number; glow: THREE.Mesh; check: THREE.Mesh; home: THREE.Vector3; matchedT: number };

class Table {
  views = new Map<string, CardView>(); private group = new THREE.Group();
  constructor(private stage: Stage) {
    const s = stage.scene;
    gradientSky(s, 0xffd9a8, 0xfff3e2, 0xe2c49a);
    s.add(new THREE.HemisphereLight(0xfff6ea, 0x8a6a4a, 1.25));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(-6, 9, 14); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 40 }); key.shadow.normalBias = 0.02; s.add(key);
    const wood = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 })); wood.position.z = -0.32; wood.receiveShadow = true; s.add(wood);
    s.add(this.group);
  }
  private felt: THREE.Mesh | null = null;
  build(game: MatchGame, accent: number, onPick: (id: string) => void, enabled: (id: string) => boolean) {
    for (const v of this.views.values()) { this.stage.unpick(v.g); this.group.remove(v.g); }
    this.views.clear(); if (this.felt) { this.stage.scene.remove(this.felt); this.felt = null; }
    const n = game.cards.length, { hw, hh } = this.stage.view();
    const top = hh * 0.56, bottom = -hh * 0.94, usableW = hw * 2 * 0.9, usableH = (top - bottom) * 0.9, cardAspect = 0.76;
    let best = { cols: 1, w: 0 };
    for (let cols = 1; cols <= n; cols++) { const rows = Math.ceil(n / cols); const w = Math.min(usableW / (cols * 1.12), usableH / (rows * 1.12) * cardAspect); if (w > best.w) best = { cols, w }; }
    const W = Math.min(best.w, 3.4), H = W / cardAspect, gap = W * 0.12, cols = best.cols, rows = Math.ceil(n / cols);
    const totalW = cols * W + (cols - 1) * gap, totalH = rows * H + (rows - 1) * gap, cy = (top + bottom) / 2;
    this.felt = new THREE.Mesh(roundedBox(totalW + W * 0.5, totalH + W * 0.5, 0.06, W * 0.25), new THREE.MeshStandardMaterial({ map: feltTexture(0x166b4a), roughness: 1 }));
    this.felt.position.set(0, cy, -0.28); this.felt.receiveShadow = true; this.stage.scene.add(this.felt);
    const body = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    game.cards.forEach((c, i) => {
      const r = Math.floor(i / cols), k = i % cols, inRow = Math.min(cols, n - r * cols);
      const x = (k - (inRow - 1) / 2) * (W + gap), y = cy + ((rows - 1) / 2 - r) * (H + gap);
      const g = new THREE.Group(); g.position.set(x, y, 0);
      const box = new THREE.Mesh(roundedBox(W, H, 0.09, W * 0.1), body); box.castShadow = true; g.add(box);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.98, H * 0.98), new THREE.MeshBasicMaterial({ map: cardFace(c.kind, c.pic.word, c.pic.emoji, accent), transparent: true, toneMapped: false })); front.position.z = 0.05; g.add(front);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.98, H * 0.98), new THREE.MeshBasicMaterial({ map: cardBack(accent), transparent: true, toneMapped: false })); back.position.z = -0.05; back.rotation.y = Math.PI; g.add(back);
      const glow = new THREE.Mesh(roundedBox(W * 1.1, H * 1.08, 0.02, W * 0.14), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, toneMapped: false })); glow.position.z = -0.06; g.add(glow);
      const check = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.36, W * 0.36), new THREE.MeshBasicMaterial({ map: checkBadge(), transparent: true, toneMapped: false })); check.position.set(W * 0.36, H * 0.42, 0.08); check.scale.setScalar(0.001); g.add(check);
      g.rotation.y = c.faceUp ? 0 : Math.PI;
      this.group.add(g);
      const v: CardView = { g, flip: c.faceUp ? 0 : 1, lift: 0, shake: 0, glow, check, home: g.position.clone(), matchedT: -1 };
      this.views.set(c.id, v);
      this.stage.pick(g, { id: c.id, onDwell: () => onPick(c.id), enabled: () => enabled(c.id), ringScale: 1.05 });
    });
  }
  apply(game: MatchGame, first: string | null) {
    for (const c of game.cards) { const v = this.views.get(c.id); if (!v) continue; v.lift = c.matched ? 0 : c.id === first ? 1 : 0; }
  }
  event(e: MatchEvent) {
    const a = e.a ? this.views.get(e.a) : undefined, b = e.b ? this.views.get(e.b) : undefined;
    if (e.t === "nomatch") { if (a) a.shake = 1; if (b) b.shake = 1; }
    if (e.t === "match" && a && b) {
      a.matchedT = b.matchedT = 0;
      const fx = this.stage.fx; for (const v of [a, b]) fx.burst(v.home.x, v.home.y, 0.6, { color: [0xffe14a, 0xffffff, 0x7dff6b, 0x4dd8ff], count: 50, speed: 6, life: 0.9, size: 0.3, gravity: 4, spreadZ: 2 });
    }
  }
  update(dt: number, t: number, game: MatchGame) {
    for (const c of game.cards) {
      const v = this.views.get(c.id); if (!v) continue;
      const want = c.faceUp ? 0 : Math.PI; v.g.rotation.y += (want - v.g.rotation.y) * Math.min(1, dt * 10);
      const lift = v.lift * 0.9, z = lift + (v.matchedT >= 0 && v.matchedT < 0.9 ? Math.sin(v.matchedT / 0.9 * Math.PI) * 1.3 : 0);
      v.g.position.z += (z - v.g.position.z) * Math.min(1, dt * 10);
      v.g.rotation.z = v.shake > 0 ? Math.sin(t * 40) * 0.08 * v.shake : 0; v.shake = Math.max(0, v.shake - dt * 2.2);
      if (v.matchedT >= 0) { v.matchedT += dt; const k = Math.min(1, v.matchedT / 0.9); v.g.rotation.x = v.matchedT < 0.9 ? Math.sin(k * Math.PI * 2) * 0.25 : 0; v.check.scale.setScalar(Math.min(1, v.matchedT * 2.5)); }
      const glowOp = c.matched ? 0.55 + Math.sin(t * 3) * 0.1 : v.lift > 0 ? 0.85 : 0;
      const gm = v.glow.material as THREE.MeshBasicMaterial; gm.color.setHex(c.matched ? 0x22c55e : 0xffd23f); gm.opacity += (glowOp - gm.opacity) * Math.min(1, dt * 8);
    }
  }
}

export default function MatchPairsGame({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useStageSettings(uid);
  const progressKey = `arise-match-pairs-v2:${uid ?? "guest"}`;
  const [stars, setStars] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem(progressKey) || "{}"); } catch { return {}; } });
  const [setIdx, setSetIdx] = useState(0); const [pairs, setPairs] = useState<number>(3); const [mode, setMode] = useState<"look" | "memory">("look");
  const [view, setView] = useState<"pick" | "play" | "done">("pick");
  const [bubble, setBubble] = useState<{ text: string; tone: "info" | "good" | "oops"; icon?: string }>({ text: "Choose a set of cards!", tone: "info", icon: "🃏" });
  const [matched, setMatched] = useState(0); const [result, setResult] = useState<{ stars: number; misses: number } | null>(null);
  const host = useRef<HTMLDivElement>(null); const stageRef = useRef<Stage | null>(null); const tableRef = useRef<Table | null>(null); const gameRef = useRef<MatchGame | null>(null);
  const audio = useRef<StageAudio | null>(null); if (!audio.current) audio.current = new StageAudio();
  const sRef = useRef(settings); sRef.current = settings; const rebuild = useRef<((t: Table) => void) | null>(null);

  useEffect(() => { audio.current!.setVolumes(settings.music, settings.sfx); if (stageRef.current) stageRef.current.dwell = settings.dwell; }, [settings]);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const st = new Stage(el, { quality: settings.quality, fov: 40, camPos: [0, -3.2, 17], target: [0, 0, 0], bloom: 0.25, dwell: settings.dwell });
    stageRef.current = st; const table = new Table(st); tableRef.current = table; rebuild.current?.(table);
    st.onFrame = (dt, t) => { const g = gameRef.current; if (g) table.update(dt, t, g); };
    return () => { st.dispose(); stageRef.current = null; tableRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality]);
  useEffect(() => () => { stopSpeaking(); audio.current?.dispose(); }, []);

  const set = MATCH_SETS[setIdx], accent = ACCENTS[setIdx % ACCENTS.length];
  const pick = useCallback((id: string) => {
    const g = gameRef.current, table = tableRef.current; if (!g || !table) return;
    const card = g.card(id); const evs = g.select(id); if (!evs.length && g.first !== id) return;
    const a = audio.current!; a.ensure(); const v = sRef.current.voice;
    if (!evs.length) { a.play("flip"); }
    for (const e of evs) {
      table.event(e);
      if (e.t === "flip") a.play("flip");
      if (e.t === "match") { a.play("match", g.cards.filter(c => c.matched).length); setMatched(g.cards.filter(c => c.matched).length / 2); setBubble({ text: `Yes! ${card.pic.word.toUpperCase()}!`, tone: "good", icon: card.pic.emoji }); say(`Yes! ${card.pic.word}!`, v); }
      if (e.t === "nomatch") { a.play("nomatch"); setBubble({ text: "Not a match — try again!", tone: "oops", icon: "🤔" }); say("Not a match. Try again!", v, undefined, true);
        if (g.mode === "memory") window.setTimeout(() => { for (const h of g.hideMismatch()) { table.event(h); } a.play("flip"); table.apply(g, g.first); }, 1300); }
      if (e.t === "win") window.setTimeout(() => { a.play("win"); celebrateEyeGaze(false); const r = { stars: g.stars(), misses: g.misses }; setResult(r); setView("done"); say("You matched them all! Great reading!", v);
        setStars(s => { const k = `${g.set.id}:${g.pairs}:${g.mode}`, next = { ...s, [k]: Math.max(s[k] || 0, r.stars) }; try { localStorage.setItem(progressKey, JSON.stringify(next)); } catch { /* ignore */ } return next; }); }, 900);
    }
    if (!evs.some(e => e.t === "match" || e.t === "nomatch") && g.first === id) {
      setBubble({ text: card.kind === "word" ? `${card.pic.word.toUpperCase()} — now find its picture` : `Now find the word for ${card.pic.emoji}`, tone: "info", icon: card.kind === "word" ? "🔤" : card.pic.emoji });
      say(card.pic.word, v);
    }
    table.apply(g, g.first);
  }, [progressKey]);

  const start = (si = setIdx, p = pairs, m = mode) => {
    const st = stageRef.current, table = tableRef.current; if (!st || !table) return;
    audio.current!.ensure(); audio.current!.play("select"); audio.current!.startMusic(65, 96, "major", si * 17 + p); audio.current!.setEnergy(0);
    const g = new MatchGame(MATCH_SETS[si], p, m); gameRef.current = g; setMatched(0); setResult(null);
    rebuild.current = t => { t.build(g, ACCENTS[si % ACCENTS.length], pick, id => g.canSelect(id)); t.apply(g, g.first); }; rebuild.current(table); st.calm(900);
    setView("play"); setBubble({ text: m === "look" ? "Look at a word or a picture to start." : "Turn over two cards to find a pair!", tone: "info", icon: "👀" });
    say(m === "look" ? "Match each word with its picture." : "Find the pairs. A word goes with its picture.", sRef.current.voice);
  };
  const D = settings.dwell;
  const k = (si: number) => `${MATCH_SETS[si].id}:${pairs}:${mode}`;

  return (
    <StageShell title="Match Pairs" badge="🃏" accent="#7c3aed" hostRef={host} onBack={() => { stopSpeaking(); audio.current?.stopMusic(); onBack(); }} settings={settings} onSettings={setSettings}
      bubble={view === "play" ? <Bubble tone={bubble.tone} icon={bubble.icon}>{bubble.text}</Bubble> : undefined}
      progress={view !== "pick" ? <span className="flex items-center gap-1 text-sm font-black text-violet-700">{Array.from({ length: pairs }, (_, i) => <span key={i} className={"h-3 w-3 rounded-full " + (i < matched ? "bg-violet-600" : "bg-slate-300")} />)}</span> : undefined}>
      {view === "pick" && <section data-stage-ui className="sg-up absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto max-w-4xl rounded-[2rem] border-4 border-white bg-white/92 p-4 shadow-2xl backdrop-blur sm:p-6">
          <h2 className="text-3xl font-black sm:text-4xl">Match Pairs</h2>
          <p className="font-bold text-slate-600">Match each word with its picture. Look at a card — or tap it.</p>
          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:mt-4 sm:gap-2">
            {MATCH_SETS.map((s, i) => <GazeButton key={s.id} dwell={D} ms={900} onSelect={() => { setSetIdx(i); audio.current?.ensure(); audio.current?.play("flip"); }} pressed={setIdx === i}
              className={"min-h-20 rounded-2xl border-4 p-1 text-center sm:min-h-24 sm:p-2 " + (setIdx === i ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white")}>
              <div className="text-3xl sm:text-4xl">{s.emoji}</div><div className="text-[11px] font-black leading-tight sm:text-base">{s.name}</div>
              <div className="mt-0.5 flex justify-center">{[0, 1, 2].map(n => <Star key={n} className={"h-3 w-3 sm:h-4 sm:w-4 " + ((stars[k(i)] || 0) > n ? "fill-amber-400 text-amber-400" : "text-slate-300")} />)}</div>
            </GazeButton>)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><p className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-500">How many pairs</p><div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-100 p-1.5">{SIZES.map(n => <GazeButton key={n} dwell={D} ms={900} onSelect={() => setPairs(n)} className={"min-h-12 rounded-xl text-lg font-black " + (pairs === n ? "bg-violet-600 text-white" : "text-slate-700")}>{n}</GazeButton>)}</div></div>
            <div><p className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-500">Cards</p><div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5">{([["look", "👀 Face up"], ["memory", "🧠 Memory"]] as const).map(([m, l]) => <GazeButton key={m} dwell={D} ms={900} onSelect={() => setMode(m)} className={"min-h-12 rounded-xl font-black " + (mode === m ? "bg-violet-600 text-white" : "text-slate-700")}>{l}</GazeButton>)}</div></div>
          </div>
          <GazeButton dwell={D} onSelect={() => start()} className="mt-4 min-h-16 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-2xl font-black text-white shadow-xl">▶ Play {set.emoji} {set.name}</GazeButton>
        </div>
      </section>}
      {view === "done" && result && <section data-stage-ui className="absolute inset-0 z-10 grid place-items-center bg-slate-900/40 p-3 backdrop-blur-[2px]">
        <div className="sg-pop w-full max-w-md rounded-[2rem] border-4 border-white bg-white p-6 text-center shadow-2xl">
          <div className="text-5xl">{set.emoji}🎉</div><h2 className="mt-1 text-4xl font-black">All matched!</h2>
          <div className="mt-3 flex justify-center gap-2">{[0, 1, 2].map(n => <Star key={n} className={"h-12 w-12 " + (n < result.stars ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}</div>
          <p className="mt-2 font-bold text-slate-600">{result.misses === 0 ? "Perfect — no mistakes!" : `${result.misses} ${result.misses === 1 ? "try" : "tries"} that didn't match.`}</p>
          <div className="mt-4 grid gap-2">
            <GazeButton dwell={D} onSelect={() => { const n = (setIdx + 1) % MATCH_SETS.length; setSetIdx(n); start(n); }} className="min-h-16 rounded-2xl bg-violet-600 text-xl font-black text-white">Next set {MATCH_SETS[(setIdx + 1) % MATCH_SETS.length].emoji} ▶</GazeButton>
            <div className="grid grid-cols-2 gap-2">
              <GazeButton dwell={D} onSelect={() => start()} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-100 font-black"><RotateCcw className="h-5 w-5" />Again</GazeButton>
              <GazeButton dwell={D} onSelect={() => { setView("pick"); gameRef.current = null; rebuild.current = null; tableRef.current?.build(new MatchGame(set, 0, "look"), accent, () => {}, () => false); }} className="min-h-14 rounded-2xl bg-slate-100 font-black">Choose cards</GazeButton>
            </div>
          </div>
        </div>
      </section>}
    </StageShell>
  );
}
