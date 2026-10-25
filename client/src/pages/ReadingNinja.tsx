// Reading Ninja — a 3D slicing game for eye-gaze, touch and mouse players.
// Tokens with pictures and words fly up; slice only the ones that match the mission.
// Eye gaze: look at a token until the ring fills. Touch/mouse: swipe through it.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Eye, Hand, Heart, HelpCircle, Pause, Play, RotateCcw, Settings, Star, Volume2, VolumeX, X } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import { useAuth } from "@/context/AuthContext";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { LEVELS, type NinjaLevel } from "@shared/ninja/missions";
import { DEFAULT_DWELL, type Difficulty, type NinjaResult } from "@shared/ninja/sim";
import { NinjaGame, type NinjaHud, type Quality, type Steer } from "@/game/ninja/game";
import { NinjaAudio } from "@/game/ninja/audio";
import type { CardStyle } from "@/game/runner/textures";
import { lookByDefault, restoreLook } from "@/lib/gazeDefaults";

type Settings = { difficulty: Difficulty; steer: Steer; look: "quick" | "normal" | "steady"; slowLook: boolean; glow: Record<Difficulty, boolean>; cardStyle: CardStyle; voice: boolean; dwellMenus: boolean; music: number; sfx: number; quality: Quality };
type Progress = { levels: Record<number, { stars: number; best: number; clears: number }>; last: number };
// Look to slice and look-to-press start on for eye-gaze readers on any device, a tablet included (lib/gazeDefaults.ts).
const DEFAULTS = (): Settings => ({ difficulty: "easy", steer: lookByDefault() ? "look" : "touch", look: "normal", slowLook: true, glow: { easy: true, medium: false, hard: false }, cardStyle: "both", voice: true, dwellMenus: lookByDefault(), music: 0.45, sfx: 0.85, quality: "medium" });
const LOOK_SCALE = { quick: 0.7, normal: 1, steady: 1.6 } as const;
const key = (uid: unknown, w: string) => `arise-reading-ninja-v2:${w}:${uid ?? "guest"}`;
function load<T extends object>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const SPEEDS: { id: Difficulty; icon: string; name: string; note: string }[] = [
  { id: "easy", icon: "🧸", name: "Easy", note: "Slow tokens · matches glow · no hearts lost" },
  { id: "medium", icon: "🥷", name: "Medium", note: "Arcade speed · 3 hearts" },
  { id: "hard", icon: "⚡", name: "Hard", note: "Fast and busy · 3 hearts" },
];
const enterImmersive = () => { try { const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }; const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req && !document.fullscreenElement) void req.call(el)?.catch?.(() => {}); } catch { /* optional */ } };
const leaveImmersive = () => { try { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); } catch { /* optional */ } };
const plural = (w: string) => (/(s|sh|ch)$/.test(w) ? w + "es" : w + "s");

const CSS = `
.nj-font{font-family:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
.nj-title{text-shadow:0 4px 0 #2a0b3a,0 9px 0 rgba(42,11,58,.5),0 18px 34px rgba(0,0,0,.45)}
.nj-pop{animation:njPop .5s cubic-bezier(.2,1.6,.4,1) both}@keyframes njPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.nj-up{animation:njUp .5s cubic-bezier(.2,1.2,.4,1) both}@keyframes njUp{from{transform:translateY(22px);opacity:0}to{transform:none;opacity:1}}
.nj-toast{animation:njToast 1.15s ease-out forwards}@keyframes njToast{0%{opacity:0;transform:translateY(14px) scale(.7)}15%{opacity:1;transform:scale(1.1)}25%{transform:scale(1)}78%{opacity:1}100%{opacity:0;transform:translateY(-16px)}}
.nj-combo{animation:njCombo .9s cubic-bezier(.2,1.6,.4,1) forwards}@keyframes njCombo{0%{opacity:0;transform:scale(2.4) rotate(-8deg)}25%{opacity:1;transform:scale(1) rotate(-4deg)}80%{opacity:1}100%{opacity:0;transform:scale(1.1) rotate(-4deg) translateY(-20px)}}
.nj-count{animation:njCount .7s cubic-bezier(.2,1.5,.4,1) both}@keyframes njCount{0%{transform:scale(2.4);opacity:0}30%{transform:scale(1);opacity:1}100%{transform:scale(.85);opacity:0}}
.nj-float{animation:njFloat 3s ease-in-out infinite}@keyframes njFloat{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-10px) rotate(4deg)}}
`;

function Backdrop({ level, quality, audio }: { level: NinjaLevel; quality: Quality; audio: NinjaAudio }) {
  const host = useRef<HTMLDivElement>(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = host.current; if (!el) return; let g: NinjaGame | null = null;
    try { g = new NinjaGame(el, level, { difficulty: "medium", dwellMs: 350, slowLook: false, glow: true, quality: quality === "high" ? "medium" : quality, cardStyle: "both", steer: "touch", demo: true, music: false, seed: 11 }, audio); }
    catch (e) { console.error(e); setFailed(true); }
    return () => g?.dispose();
  }, [level, quality, audio]);
  return <div ref={host} className="absolute inset-0" style={failed ? { background: level.look.ui } : undefined} />;
}

export default function ReadingNinja({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useState<Settings>(() => restoreLook("ninja", uid, load(key(uid, "settings"), DEFAULTS()), { steer: "look", dwellMenus: true }));
  const [progress, setProgress] = useState<Progress>(() => load(key(uid, "progress"), { levels: {}, last: 0 }));
  const [view, setView] = useState<"title" | "levels" | "play">("title");
  const [level, setLevel] = useState(() => Math.min(LEVELS.length - 1, progress.last || 0));
  const [runKey, setRunKey] = useState(0);
  const [panel, setPanel] = useState<null | "settings" | "how">(null);
  const audioRef = useRef<NinjaAudio | null>(null); if (!audioRef.current) audioRef.current = new NinjaAudio();
  const audio = audioRef.current; const sRef = useRef(settings); sRef.current = settings;
  useEffect(() => { save(key(uid, "settings"), settings); audio.setVolumes(settings.music, settings.sfx); }, [settings, uid, audio]);
  useEffect(() => () => { stopSpeaking(); audio.dispose(); }, [audio]);

  const say = useCallback((text: string, calm = false) => {
    if (!sRef.current.voice) return; stopSpeaking();
    void speakCharacterAI(text, { calmMode: calm, onFallback: () => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 1.1; window.speechSynthesis.speak(u); } });
  }, []);
  const click = () => { audio.ensure(); audio.play("select"); };
  const hover = () => { audio.ensure(); audio.play("hover"); };
  const play = (i: number) => { click(); enterImmersive(); setLevel(i); setRunKey(k => k + 1); setView("play"); };
  const exit = () => { stopSpeaking(); leaveImmersive(); onBack(); };
  const record = (i: number, r: NinjaResult) => {
    const old = progress.levels[i] || { stars: 0, best: 0, clears: 0 }; const newBest = r.won && r.score > old.best;
    const next: Progress = { last: i, levels: { ...progress.levels, [i]: { stars: r.won ? Math.max(old.stars, r.stars) : old.stars, best: r.won ? Math.max(old.best, r.score) : old.best, clears: old.clears + (r.won ? 1 : 0) } } };
    setProgress(next); save(key(uid, "progress"), next); return { newBest };
  };
  const D = settings.dwellMenus; const totalStars = Object.values(progress.levels).reduce((a, l) => a + l.stars, 0);

  return (
    <main className="nj-font fixed inset-0 z-[120] h-[100dvh] touch-manipulation select-none overflow-hidden bg-slate-950 text-white">
      <style>{CSS}</style>
      {view === "title" && <section data-ninja-ui className="absolute inset-0">
        <Backdrop level={LEVELS[level]} quality={settings.quality} audio={audio} />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-transparent" />
        <div className="absolute left-3 top-3 z-10 sm:left-5 sm:top-5"><GazeButton dwell={D} onHover={hover} onSelect={exit} className="flex min-h-12 items-center gap-2 rounded-2xl bg-black/40 px-4 font-black backdrop-blur" label="Back to games"><ArrowLeft className="h-5 w-5" />Games</GazeButton></div>
        <div className="absolute right-3 top-3 z-10 flex gap-2 sm:right-5 sm:top-5">
          <GazeButton dwell={D} onHover={hover} onSelect={() => { click(); setPanel("how"); }} className="grid h-12 w-12 place-items-center rounded-2xl bg-black/40 backdrop-blur" label="How to play"><HelpCircle className="h-6 w-6" /></GazeButton>
          <GazeButton dwell={D} onHover={hover} onSelect={() => { click(); setPanel("settings"); }} className="grid h-12 w-12 place-items-center rounded-2xl bg-black/40 backdrop-blur" label="Settings"><Settings className="h-6 w-6" /></GazeButton>
        </div>
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-12"><div className="nj-up max-w-xl">
          <p className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[.25em] backdrop-blur">🥷 Look · Slice · Read</p>
          <h1 className="nj-title text-6xl font-black italic leading-[.86] tracking-tight sm:text-8xl"><span className="text-fuchsia-300">READING</span><br />NINJA</h1>
          <p className="mt-5 max-w-md text-lg font-bold leading-snug text-white/90 sm:text-xl">Tokens fly up with pictures and words. Slice only the ones that match — look at one until the ring fills, or swipe right through it!</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <GazeButton dwell={D} onHover={hover} onSelect={() => { click(); setView("levels"); }} className="flex min-h-[4.5rem] items-center gap-3 rounded-[1.6rem] border-b-[6px] border-fuchsia-800 bg-gradient-to-b from-fuchsia-300 to-pink-400 px-10 text-3xl font-black text-fuchsia-950 shadow-2xl"><Play className="h-8 w-8 fill-current" />PLAY</GazeButton>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm font-black text-white/80">
            <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5"><Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />{totalStars} / {LEVELS.length * 3}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5">{settings.steer === "look" ? <><Eye className="h-4 w-4" />Look to slice</> : <><Hand className="h-4 w-4" />Swipe to slice</>}</span>
          </p>
        </div></div>
      </section>}

      {view === "levels" && <section data-ninja-ui className="absolute inset-0 overflow-y-auto" style={{ background: "radial-gradient(circle at 80% -10%, #a21caf 0%, #3b0764 40%, #0f0a1f 100%)" }}>
        <div className="sticky top-0 z-10 bg-gradient-to-b from-[#2a0b45] via-[#2a0b45]/90 to-transparent">
          <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 pb-5 pt-3 sm:px-6">
            <GazeButton dwell={D} onHover={hover} onSelect={() => { click(); setView("title"); }} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10" label="Back"><ArrowLeft className="h-6 w-6" /></GazeButton>
            <div className="mr-auto"><p className="text-[10px] font-black uppercase tracking-[.3em] text-fuchsia-300">Reading Ninja</p><h2 className="text-2xl font-black sm:text-3xl">Choose a level</h2></div>
            <div className="order-last flex w-full gap-1.5 rounded-2xl bg-black/30 p-1.5 sm:order-none sm:w-auto">
              {SPEEDS.map(s => <GazeButton key={s.id} dwell={D} onHover={hover} onSelect={() => { click(); setSettings(x => ({ ...x, difficulty: s.id })); }} className={"min-h-12 flex-1 rounded-xl px-3 font-black sm:flex-none sm:px-4 " + (settings.difficulty === s.id ? "bg-fuchsia-300 text-fuchsia-950 shadow-lg" : "text-white/80")} label={s.name + " speed"}>{s.icon} {s.name}</GazeButton>)}
            </div>
            <GazeButton dwell={D} onHover={hover} onSelect={() => { click(); setPanel("settings"); }} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10" label="Settings"><Settings className="h-6 w-6" /></GazeButton>
          </header>
        </div>
        <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-6">
          <p className="mb-4 text-sm font-bold text-white/70">{SPEEDS.find(s => s.id === settings.difficulty)!.note}{D ? " · Look at a level to start it." : ""}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {LEVELS.map((l, i) => { const p = progress.levels[i]; return (
              <GazeButton key={i} dwell={D} onHover={hover} onSelect={() => play(i)} label={`Level ${i + 1}, ${l.name}: ${l.prompt}`} className="nj-up isolate flex min-h-[188px] flex-col rounded-[1.6rem] border-2 border-white/20 p-3 text-left shadow-xl">
                <span className="absolute inset-0 -z-10" style={{ background: l.look.ui }} /><span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <span className="absolute -right-1 -top-2 text-6xl drop-shadow-lg">{l.badge}</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-white/85">Level {i + 1}</span>
                <span className="mt-0.5 pr-10 text-xl font-black leading-tight drop-shadow">{l.name}</span>
                <span className="mt-auto flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 text-slate-950 shadow"><span className="text-2xl leading-none">{l.target.emoji}</span><span className="truncate text-sm font-black uppercase">{l.target.label}</span><span className="ml-auto text-xs font-black text-slate-500">×{l.goal}</span></span>
                <span className="mt-2 flex items-center gap-0.5">{[0, 1, 2].map(k => <Star key={k} className={"h-5 w-5 " + ((p?.stars || 0) > k ? "fill-yellow-300 text-yellow-300" : "text-white/40")} />)}{p?.best ? <span className="ml-auto text-[11px] font-black text-white/85">🏆 {p.best}</span> : null}</span>
              </GazeButton>); })}
          </div>
        </div>
      </section>}

      {view === "play" && <PlayView key={runKey} index={level} settings={settings} audio={audio} say={say} dwell={D} onHover={hover}
        onRecord={r => record(level, r)} onReplay={() => play(level)} onNext={() => play((level + 1) % LEVELS.length)} onLevels={() => { click(); stopSpeaking(); setView("levels"); }} onExit={exit}
        onSettings={p => setSettings(s => ({ ...s, ...p }))} />}
      {panel === "settings" && <SettingsPanel s={settings} dwell={D} onHover={hover} onChange={setSettings} onClose={() => { click(); setPanel(null); }} />}
      {panel === "how" && <HowTo steer={settings.steer} dwell={D} onHover={hover} onClose={() => { click(); setPanel(null); }} />}
    </main>
  );
}

type Toast = { id: number; tone: "good" | "oops" | "info"; emoji?: string; big: string; small?: string };
function PlayView({ index, settings, audio, say, dwell, onHover, onRecord, onReplay, onNext, onLevels, onExit, onSettings }: {
  index: number; settings: Settings; audio: NinjaAudio; say: (t: string, calm?: boolean) => void; dwell: boolean; onHover: () => void;
  onRecord: (r: NinjaResult) => { newBest: boolean }; onReplay: () => void; onNext: () => void; onLevels: () => void; onExit: () => void; onSettings: (p: Partial<Settings>) => void;
}) {
  const L = LEVELS[index]; const T = L.target;
  const host = useRef<HTMLDivElement>(null); const gameRef = useRef<NinjaGame | null>(null);
  const [hud, setHud] = useState<NinjaHud | null>(null); const [phase, setPhase] = useState<"intro" | "count" | "play">("intro"); const [count, setCount] = useState("");
  const [paused, setPaused] = useState(false); const [toast, setToast] = useState<Toast | null>(null); const [combo, setCombo] = useState<{ id: number; n: number } | null>(null);
  const [end, setEnd] = useState<{ r: NinjaResult; newBest: boolean } | null>(null); const [error, setError] = useState(""); const [hint, setHint] = useState(true);
  const tid = useRef(0); const cb = useRef({ say, onRecord }); cb.current = { say, onRecord };
  const show = useCallback((t: Omit<Toast, "id">) => setToast({ ...t, id: ++tid.current }), []);
  const intro = useCallback(() => cb.current.say(`Level ${index + 1}. ${L.name}. ${L.prompt} Slice only the ${plural(T.label)}.`), [index, L, T]);

  useEffect(() => {
    const el = host.current; if (!el) return; let g: NinjaGame | null = null;
    const dwellMs = Math.round(DEFAULT_DWELL[settings.difficulty] * LOOK_SCALE[settings.look]);
    try {
      g = new NinjaGame(el, L, { difficulty: settings.difficulty, dwellMs, slowLook: settings.slowLook, glow: settings.glow[settings.difficulty], quality: settings.quality, cardStyle: settings.cardStyle, steer: settings.steer }, audio, {
        onHud: setHud,
        onEvent: e => {
          const s = cb.current.say, label = (e.label || "").toUpperCase();
          if (e.t === "slice") { show({ tone: "good", emoji: e.emoji, big: label + "!", small: `${e.n} of ${L.goal}` }); if ((e.combo || 1) > 1) setCombo({ id: Date.now(), n: e.combo! }); if ((e.combo || 1) === 1 && (e.n || 0) % 3 === 1) s(`${T.label}!`); navigator.vibrate?.(30); }
          if (e.t === "wrong") { show({ tone: "oops", emoji: e.emoji, big: `That's ${/^[aeiou]/i.test(e.label!) ? "an" : "a"} ${label}`, small: `Slice the ${T.label.toUpperCase()} ${T.emoji}` }); s(`That's ${/^[aeiou]/i.test(e.label!) ? "an" : "a"} ${e.label}. Slice the ${plural(T.label)}!`, true); }
          if (e.t === "win") { s(`Level complete! You sliced all the ${plural(T.label)}!`); celebrateEyeGaze(false); }
          if (e.t === "fail") s("Nice try! Let's play again.", true);
        },
        onEnd: r => { const out = cb.current.onRecord(r); setEnd({ r, ...out }); },
      });
      gameRef.current = g;
    } catch (e) { console.error(e); setError("This device couldn't start the 3D game. Try Graphics: Low in Settings."); }
    const timers: number[] = []; const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    intro();
    at(2600, () => { setPhase("count"); setCount("3"); audio.play("count"); });
    at(3300, () => { setCount("2"); audio.play("count"); });
    at(4000, () => { setCount("1"); audio.play("count"); });
    at(4700, () => { setCount("GO!"); audio.play("go"); g?.start(); setPhase("play"); });
    at(5400, () => setCount("")); at(11000, () => setHint(false));
    const key = (e: KeyboardEvent) => { if (e.code === "Escape" || e.code === "KeyP") { const gg = gameRef.current; if (gg && gg.sim.state === "play") { const p = !gg.isPaused(); gg.setPaused(p); setPaused(p); audio.play("pause"); } } };
    const vis = () => { const gg = gameRef.current; if (document.hidden && gg && gg.sim.state === "play" && !gg.isPaused()) { gg.setPaused(true); setPaused(true); } };
    window.addEventListener("keydown", key); document.addEventListener("visibilitychange", vis);
    return () => { timers.forEach(window.clearTimeout); window.removeEventListener("keydown", key); document.removeEventListener("visibilitychange", vis); g?.dispose(); gameRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);
  useEffect(() => { if (gameRef.current) gameRef.current.opts.steer = settings.steer; }, [settings.steer]);
  useEffect(() => { if (!toast) return; const id = toast.id; const h = window.setTimeout(() => setToast(t => (t?.id === id ? null : t)), toast.tone === "oops" ? 1900 : 1150); return () => window.clearTimeout(h); }, [toast]);

  const pause = () => { const g = gameRef.current; if (!g || g.sim.state !== "play") return; g.setPaused(true); setPaused(true); audio.play("pause"); };
  const resume = () => { audio.play("select"); gameRef.current?.setPaused(false); setPaused(false); };
  const look = settings.steer === "look";

  return (
    <div className="absolute inset-0 bg-black">
      <div ref={host} className="absolute inset-0" style={{ cursor: look ? "none" : "crosshair" }} />
      {error && <div data-ninja-ui className="absolute inset-0 grid place-items-center bg-slate-950 p-6 text-center"><div><p className="text-xl font-black">{error}</p><GazeButton dwell={dwell} onSelect={onLevels} className="mt-5 min-h-14 rounded-2xl bg-white px-6 font-black text-slate-950">Back to levels</GazeButton></div></div>}

      {phase !== "intro" && !end && <div data-ninja-ui className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
        <GazeButton dwell={dwell} onSelect={pause} onHover={onHover} className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/45 backdrop-blur" label="Pause"><Pause className="h-6 w-6" /></GazeButton>
        <div className="flex min-w-0 flex-1 justify-center">
          <button type="button" onClick={intro} className="pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-2xl bg-white/95 py-1.5 pl-1.5 pr-2.5 text-slate-950 shadow-xl sm:gap-3 sm:pr-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fuchsia-100 text-2xl sm:h-12 sm:w-12 sm:text-3xl">{T.emoji}</span>
            <span className="min-w-0 text-left"><span className="block truncate text-base font-black uppercase leading-none sm:text-xl">{T.label}</span>
              <span className="mt-1 flex gap-0.5 sm:gap-1">{Array.from({ length: L.goal }, (_, i) => <span key={i} className={"h-2 w-2 rounded-full transition sm:h-3 sm:w-3 " + (i < (hud?.caught || 0) ? "scale-110 bg-fuchsia-500" : "bg-slate-300")} />)}</span></span>
            <span className="ml-0.5 shrink-0 text-lg font-black tabular-nums text-fuchsia-600 sm:ml-1 sm:text-2xl">{hud?.caught || 0}<span className="text-xs text-slate-400 sm:text-sm">/{L.goal}</span></span>
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="rounded-2xl bg-black/45 px-2.5 py-1.5 text-sm font-black tabular-nums backdrop-blur sm:px-3 sm:text-base">⭐ {hud?.score || 0}</div>
          {hud?.hasHearts && <div className="flex items-center gap-0.5 rounded-2xl bg-black/45 px-1.5 py-1.5 backdrop-blur sm:px-2">{[0, 1, 2].map(i => <Heart key={i} className={"h-4 w-4 sm:h-5 sm:w-5 " + (i < hud.hearts ? "fill-rose-500 text-rose-300" : "text-white/30")} />)}</div>}
        </div>
      </div>}

      {phase === "intro" && !error && <div className="pointer-events-none absolute inset-0 grid place-items-center p-4"><div className="nj-pop flex flex-col items-center text-center">
        <p className="rounded-full bg-black/45 px-4 py-1 text-sm font-black uppercase tracking-[.3em] text-fuchsia-200 backdrop-blur">Level {index + 1} · {L.name}</p>
        <div className="nj-float mt-4 flex h-48 w-48 flex-col items-center justify-center rounded-full border-[8px] border-fuchsia-400 bg-white text-slate-950 shadow-[0_0_60px_rgba(240,171,252,.8)] sm:h-56 sm:w-56">
          <span className="text-8xl leading-none">{T.emoji}</span><span className="mt-2 rounded-xl bg-[#14223f] px-4 py-1 text-xl font-black uppercase text-white sm:text-2xl">{T.label}</span>
        </div>
        <h2 className="nj-title mt-5 text-4xl font-black italic sm:text-6xl">{L.prompt}</h2>
      </div></div>}
      {count && <div className="pointer-events-none absolute inset-0 grid place-items-center"><div key={count} className="nj-count nj-title text-[9rem] font-black italic leading-none text-fuchsia-300 sm:text-[12rem]">{count}</div></div>}

      {toast && !end && <div className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center px-4"><div key={toast.id} className={"nj-toast flex items-center gap-3 rounded-[1.6rem] border-4 px-5 py-2.5 shadow-2xl backdrop-blur " + (toast.tone === "good" ? "border-white bg-fuchsia-600/90" : toast.tone === "oops" ? "border-white/80 bg-slate-900/90" : "border-white/70 bg-indigo-600/90")}>
        {toast.emoji && <span className="text-5xl leading-none">{toast.emoji}</span>}
        <span><span className="block text-3xl font-black leading-none sm:text-4xl">{toast.tone === "good" ? "✓ " : ""}{toast.big}</span>{toast.small && <span className="mt-1 block text-base font-black text-white/85">{toast.small}</span>}</span>
      </div></div>}
      {combo && !end && <div key={combo.id} className="nj-combo pointer-events-none absolute right-[8%] top-[34%] text-right"><div className="nj-title text-5xl font-black italic text-yellow-300 sm:text-7xl">COMBO ×{combo.n}!</div></div>}

      {hint && phase === "play" && !paused && <div className="pointer-events-none absolute inset-x-0 flex justify-center px-4" style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <p className="nj-up rounded-2xl bg-black/55 px-4 py-2 text-center text-sm font-black backdrop-blur sm:text-base">{look ? `👀 Look at a ${T.label} until the ring fills — or click and swipe through it` : `👆 Swipe through the ${plural(T.label)} — or tap them`}</p>
      </div>}

      {paused && !end && <Panel title="Paused">
        <div className="grid gap-2.5">
          <GazeButton dwell={dwell} onHover={onHover} onSelect={resume} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-fuchsia-300 text-xl font-black text-fuchsia-950"><Play className="h-6 w-6 fill-current" />Keep playing</GazeButton>
          <div className="grid grid-cols-2 gap-2.5">
            <GazeButton dwell={dwell} onHover={onHover} onSelect={onReplay} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 font-black"><RotateCcw className="h-5 w-5" />Restart</GazeButton>
            <GazeButton dwell={dwell} onHover={onHover} onSelect={onLevels} className="min-h-14 rounded-2xl bg-white/10 font-black">🥷 Levels</GazeButton>
            <GazeButton dwell={dwell} onHover={onHover} onSelect={() => onSettings({ voice: !settings.voice })} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 font-black">{settings.voice ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}Voice {settings.voice ? "on" : "off"}</GazeButton>
            <GazeButton dwell={dwell} onHover={onHover} onSelect={() => onSettings({ steer: look ? "touch" : "look" })} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 font-black">{look ? <><Eye className="h-5 w-5" />Look</> : <><Hand className="h-5 w-5" />Swipe</>}</GazeButton>
          </div>
          <GazeButton dwell={dwell} onHover={onHover} onSelect={onExit} className="min-h-12 rounded-2xl bg-white/5 font-black text-white/80">Leave game</GazeButton>
        </div>
      </Panel>}

      {end && <div data-ninja-ui className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-[2px]">
        <div className="nj-pop my-auto w-full max-w-lg rounded-[2rem] border-2 border-white/25 bg-slate-950/90 p-5 text-center shadow-2xl sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.3em] text-fuchsia-200">Level {index + 1} · {L.name}</p>
          <h2 className="nj-title mt-1 text-5xl font-black italic sm:text-6xl">{end.r.won ? "Level clear!" : "Great try!"}</h2>
          {end.r.won ? <div className="mt-4 flex justify-center gap-2">{[0, 1, 2].map(k => <div key={k} className="nj-pop grid h-20 w-20 place-items-center rounded-3xl bg-white/5" style={{ animationDelay: `${0.25 + k * 0.18}s` }}><Star className={"h-14 w-14 " + (k < end.r.stars ? "fill-yellow-300 text-yellow-300" : "text-white/20")} /></div>)}</div>
            : <p className="mt-3 text-lg font-bold text-white/80">You sliced {end.r.caught} of {end.r.goal} {T.emoji}. Let's go again!</p>}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[[`${end.r.caught}/${end.r.goal}`, `${T.emoji} sliced`], [String(end.r.wrong), "oops"], [`×${Math.max(1, end.r.bestCombo)}`, "best combo"], [String(end.r.score), end.newBest ? "⭐ new best" : "score"]].map(([b, s]) => <div key={s} className="rounded-2xl bg-white/5 py-3"><div className="text-2xl font-black tabular-nums">{b}</div><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{s}</div></div>)}
          </div>
          {end.r.won && end.r.stars < 3 && <p className="mt-3 text-sm font-bold text-white/70">Tip: slice only the {T.label.toUpperCase()} tokens for 3 stars.</p>}
          <div className="mt-5 grid gap-2.5">
            {end.r.won && <GazeButton dwell={dwell} onHover={onHover} onSelect={onNext} className="min-h-16 rounded-2xl bg-gradient-to-b from-fuchsia-300 to-pink-400 text-xl font-black text-fuchsia-950 shadow-xl">{index === LEVELS.length - 1 ? "Back to Level 1 ▶" : `Next level ${LEVELS[index + 1].badge} ▶`}</GazeButton>}
            <div className="grid grid-cols-2 gap-2.5">
              <GazeButton dwell={dwell} onHover={onHover} onSelect={onReplay} className={"flex min-h-14 items-center justify-center gap-2 rounded-2xl font-black " + (end.r.won ? "bg-white/10" : "bg-fuchsia-300 text-fuchsia-950")}><RotateCcw className="h-5 w-5" />{end.r.won ? "Play again" : "Try again"}</GazeButton>
              <GazeButton dwell={dwell} onHover={onHover} onSelect={onLevels} className="min-h-14 rounded-2xl bg-white/10 font-black">🥷 Levels</GazeButton>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}

function Panel({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title: string }) {
  return <div data-ninja-ui className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm" onClick={onClose}>
    <div className="nj-pop my-auto w-full max-w-lg rounded-[2rem] border border-white/15 bg-slate-950/95 p-5 shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>
      <div className="mb-3 flex items-center gap-3"><h2 className="flex-1 text-2xl font-black sm:text-3xl">{title}</h2>{onClose && <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10" aria-label="Close"><X className="h-6 w-6" /></button>}</div>
      {children}
    </div>
  </div>;
}

function SettingsPanel({ s, dwell, onHover, onChange, onClose }: { s: Settings; dwell: boolean; onHover: () => void; onChange: (s: Settings) => void; onClose: () => void }) {
  const Row = <K extends keyof Settings>({ title, k, opts }: { title: string; k: K; opts: [Settings[K], ReactNode][] }) => (
    <div className="mt-3 first:mt-0"><p className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
      <div className="grid gap-1.5 rounded-2xl bg-white/5 p-1.5" style={{ gridTemplateColumns: `repeat(${opts.length},minmax(0,1fr))` }}>
        {opts.map(([v, label]) => <GazeButton key={String(v)} dwell={dwell} ms={900} onHover={onHover} onSelect={() => onChange({ ...s, [k]: v })} className={"min-h-12 rounded-xl px-2 text-sm font-black " + (s[k] === v ? "bg-fuchsia-300 text-fuchsia-950 shadow" : "text-white/80")}>{label}</GazeButton>)}
      </div></div>);
  return <Panel title="Settings" onClose={onClose}>
    <div className="max-h-[68dvh] overflow-y-auto pr-1">
      <Row title="How to slice" k="steer" opts={[["look", <span key="l" className="flex items-center justify-center gap-1.5"><Eye className="h-4 w-4" />Look (eye gaze / mouse)</span>], ["touch", <span key="t" className="flex items-center justify-center gap-1.5"><Hand className="h-4 w-4" />Swipe & tap</span>]]} />
      <Row title="Look time to slice" k="look" opts={[["quick", "Quick"], ["normal", "Normal"], ["steady", "Steady"]]} />
      <Row title="Slow down the token I'm looking at" k="slowLook" opts={[[true, "On"], [false, "Off"]]} />
      <Row title="Speed" k="difficulty" opts={SPEEDS.map(x => [x.id, `${x.icon} ${x.name}`] as [Difficulty, ReactNode])} />
      <div className="mt-3"><p className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-400">Make the matching tokens glow ({SPEEDS.find(x => x.id === s.difficulty)!.name})</p>
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white/5 p-1.5">{[true, false].map(v => <GazeButton key={String(v)} dwell={dwell} ms={900} onHover={onHover} onSelect={() => onChange({ ...s, glow: { ...s.glow, [s.difficulty]: v } })} className={"min-h-12 rounded-xl text-sm font-black " + (s.glow[s.difficulty] === v ? "bg-fuchsia-300 text-fuchsia-950" : "text-white/80")}>{v ? "✨ Glow" : "No glow"}</GazeButton>)}</div></div>
      <Row title="Tokens show" k="cardStyle" opts={[["both", "🍎 + APPLE"], ["words", "Words only"], ["pictures", "Pictures only"]]} />
      <Row title="Menus" k="dwellMenus" opts={[[true, "Look to press"], [false, "Tap only"]]} />
      <Row title="Voice" k="voice" opts={[[true, "🗣️ On"], [false, "Off"]]} />
      <label className="mt-3 flex items-center gap-3 text-sm font-black"><span className="w-16">Music</span><input type="range" min={0} max={1} step={0.05} value={s.music} onChange={e => onChange({ ...s, music: +e.target.value })} className="h-8 flex-1 accent-fuchsia-300" /></label>
      <label className="flex items-center gap-3 text-sm font-black"><span className="w-16">Sounds</span><input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={e => onChange({ ...s, sfx: +e.target.value })} className="h-8 flex-1 accent-fuchsia-300" /></label>
      <Row title="Graphics" k="quality" opts={[["low", "Low"], ["medium", "Medium"], ["high", "High"]]} />
    </div>
    <GazeButton dwell={dwell} onHover={onHover} onSelect={onClose} className="mt-4 min-h-14 w-full rounded-2xl bg-fuchsia-300 text-lg font-black text-fuchsia-950">Done</GazeButton>
  </Panel>;
}

function HowTo({ steer, dwell, onHover, onClose }: { steer: Steer; dwell: boolean; onHover: () => void; onClose: () => void }) {
  const rows: [string, string, string][] = [
    ["🎯", "Slice the match", "Only slice tokens that match the mission — like 🍎 APPLE. Leave the others alone."],
    steer === "look" ? ["👀", "Look to slice", "Look at a token. It slows down and a gold ring fills — then it splits in two!"] : ["👆", "Swipe to slice", "Swipe right through a token, or tap it."],
    ["🔥", "Combos", "Slice two or more matches in one swipe for a COMBO and bonus points."],
    ["❤️", "Hearts", "On Medium and Hard, slicing the wrong token costs a heart. Easy never does."],
    ["⭐", "Stars", "No wrong slices = 3 stars."],
  ];
  return <Panel title="How to play" onClose={onClose}>
    <div className="divide-y divide-white/10">{rows.map(([i, n, h]) => <div key={n} className="flex items-center gap-3 py-2.5"><span className="w-10 text-center text-3xl">{i}</span><div><p className="text-lg font-black">{n}</p><p className="text-sm font-bold text-slate-300">{h}</p></div></div>)}</div>
    <GazeButton dwell={dwell} onHover={onHover} onSelect={onClose} className="mt-4 min-h-14 w-full rounded-2xl bg-fuchsia-300 text-lg font-black text-fuchsia-950">Got it!</GazeButton>
  </Panel>;
}
