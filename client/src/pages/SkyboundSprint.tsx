import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Coins, Gem, Heart, Lock, Pause, Play, RotateCcw, Settings, Star, Timer, Trophy, Volume2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { allLevels, LEVEL_IDS } from "@shared/skybound/levels";
import { totalGems, type LevelDef } from "@shared/skybound/sim";
import { countBits, isUnlocked, SKY_REWARDS, totalShards } from "@shared/skybound/progress";
import { SkyGame, type HudState, type RunResult } from "@/game/skybound/game";
import { SkyAudio } from "@/game/skybound/audio";
import { SkyInput } from "@/game/skybound/input";
import { SkyProgress, loadSettings, saveSettings, type SkySettings } from "@/game/skybound/save";

const fmt = (s: number) => { if (!isFinite(s)) return "--:--"; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, "0")}`; };
const isTouch = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);
const THEME_BG: Record<string, string> = {
  meadow: "linear-gradient(160deg,#4ba3ff 0%,#9be15d 100%)",
  bluffs: "linear-gradient(160deg,#2f8fe0 0%,#f2c27a 100%)",
  caverns: "linear-gradient(160deg,#160f33 0%,#6a3dff 100%)",
  clouds: "linear-gradient(160deg,#7fb6ff 0%,#ffb3dc 100%)",
  frost: "linear-gradient(160deg,#5b8fd6 0%,#e3f2ff 100%)",
  sunset: "linear-gradient(160deg,#4a2a7a 0%,#ffa25c 100%)",
  fortress: "linear-gradient(160deg,#1b1630 0%,#7a5aa8 100%)",
  storm: "linear-gradient(160deg,#120f24 0%,#ffcf4a 140%)",
};
const THEME_ICON: Record<string, string> = { meadow: "🌼", bluffs: "🌬️", caverns: "💎", clouds: "☁️", frost: "❄️", sunset: "🌅", fortress: "🏰", storm: "⚡" };

const CSS = `
.sk-font{font-family:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
.sk-title{text-shadow:0 5px 0 #3b2a7a,0 10px 24px rgba(40,20,120,.45)}
.sk-btn{transition:transform .12s,filter .12s}.sk-btn:hover{transform:translateY(-2px);filter:brightness(1.07)}.sk-btn:active{transform:translateY(1px) scale(.98)}
.sk-cloud{position:absolute;background:#fff;border-radius:999px;opacity:.9;filter:blur(.5px)}
.sk-drift{animation:skDrift linear infinite}@keyframes skDrift{from{transform:translateX(-30vw)}to{transform:translateX(130vw)}}
.sk-bob{animation:skBob 3s ease-in-out infinite}@keyframes skBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
.sk-toast{animation:skToast 2s ease-out forwards}@keyframes skToast{0%{opacity:0;transform:translateY(10px) scale(.8)}12%{opacity:1;transform:scale(1.1)}22%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}
.sk-intro{animation:skIntro 2.8s ease-out forwards}@keyframes skIntro{0%{opacity:0;transform:scale(1.4)}15%{opacity:1;transform:scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-20px)}}
.sk-pop{animation:skPop .6s cubic-bezier(.2,1.6,.4,1)}@keyframes skPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
`;

type View = "title" | "map" | "play" | "results";
type Clear = { result: RunResult; coins: number; firstClear: boolean; newShards: number; newBest: boolean; error?: string; prevShards: number };

export default function SkyboundSprint() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const levels = useRef(allLevels()).current;
  const [view, setView] = useState<View>("title");
  const [progress, setProgress] = useState<SkyProgress | null>(null);
  const [, bump] = useState(0);
  const [settings, setSettings] = useState<SkySettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [levelIdx, setLevelIdx] = useState(0);
  const [clear, setClear] = useState<Clear | null>(null);
  const audioRef = useRef<SkyAudio | null>(null);
  if (!audioRef.current) audioRef.current = new SkyAudio();

  useEffect(() => {
    if (!token || !user) return;
    let alive = true;
    SkyProgress.load(API_BASE, token, user.id).then(p => { if (alive) setProgress(p); });
    return () => { alive = false; };
  }, [token, user?.id]);
  useEffect(() => { saveSettings(settings); audioRef.current?.setVolumes(settings.music, settings.sfx); }, [settings]);
  useEffect(() => () => audioRef.current?.dispose(), []);

  const play = (i: number) => { audioRef.current?.ensure(); audioRef.current?.play("select"); setLevelIdx(i); setClear(null); setView("play"); };
  const onWin = useCallback(async (result: RunResult) => {
    const pr = progress; const prevShards = pr?.save.levels[result.levelId]?.shards || 0;
    if (!pr) { setClear({ result, coins: 0, firstClear: false, newShards: 0, newBest: false, prevShards }); setView("results"); return; }
    const out = await pr.clear({ levelId: result.levelId, time: result.time, gems: result.gems, shards: result.shards });
    setClear({ result, ...out, prevShards }); bump(x => x + 1); setView("results");
  }, [progress]);

  const save = progress?.save;
  return (
    <main className="sk-font fixed inset-0 overflow-hidden bg-sky-500 text-white select-none">
      <style>{CSS}</style>
      {view === "title" && <TitleScreen onPlay={() => { audioRef.current?.ensure(); audioRef.current?.play("select"); setView("map"); }} onHow={() => setShowHow(true)} onSettings={() => setShowSettings(true)} onBack={() => navigate("/games")} shards={save ? totalShards(save) : 0} />}
      {view === "map" && <WorldMap levels={levels} progress={progress} onPlay={play} onBack={() => setView("title")} onSettings={() => setShowSettings(true)} onHow={() => setShowHow(true)} />}
      {view === "play" && <PlayView key={levelIdx + ":" + (clear ? 1 : 0)} level={levels[levelIdx]} settings={settings} audio={audioRef.current!} onWin={onWin} onQuit={() => setView("map")} onSettings={setSettings} />}
      {view === "results" && clear && <Results clear={clear} level={levels[levelIdx]} hasNext={levelIdx + 1 < levels.length} onNext={() => play(levelIdx + 1)} onReplay={() => play(levelIdx)} onMap={() => setView("map")} />}
      {showSettings && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
      {showHow && <HowToPlay onClose={() => setShowHow(false)} />}
    </main>
  );
}

function Sky({ children, bg = "linear-gradient(180deg,#3b8cff 0%,#7cc4ff 45%,#ffe3f1 100%)" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: bg }}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div key={i} className="sk-drift pointer-events-none absolute" style={{ top: `${8 + i * 14}%`, animationDuration: `${40 + i * 13}s`, animationDelay: `${-i * 9}s` }}>
          <div className="relative" style={{ width: 160 + i * 20, height: 50 }}>
            <div className="sk-cloud" style={{ left: 0, top: 18, width: "70%", height: 32 }} /><div className="sk-cloud" style={{ left: "25%", top: 0, width: "45%", height: 44 }} /><div className="sk-cloud" style={{ left: "45%", top: 14, width: "55%", height: 36 }} />
          </div>
        </div>
      ))}
      <div className="relative min-h-full">{children}</div>
    </div>
  );
}

function TitleScreen({ onPlay, onHow, onSettings, onBack, shards }: { onPlay: () => void; onHow: () => void; onSettings: () => void; onBack: () => void; shards: number }) {
  return (
    <Sky>
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 text-center">
        <button onClick={onBack} className="sk-btn absolute left-4 top-4 flex items-center gap-2 rounded-2xl bg-black/25 px-4 py-2.5 font-black backdrop-blur"><ArrowLeft className="h-5 w-5" />Games</button>
        <button onClick={onSettings} className="sk-btn absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-2xl bg-black/25 backdrop-blur" aria-label="Settings"><Settings className="h-5 w-5" /></button>
        <div className="sk-bob text-7xl sm:text-8xl">🪂</div>
        <h1 className="sk-title mt-2 text-6xl font-black italic leading-[.9] tracking-tight sm:text-8xl"><span className="text-yellow-300">SKYBOUND</span><br /><span className="text-white">SPRINT</span></h1>
        <p className="mt-4 max-w-md rounded-2xl bg-indigo-950/35 px-4 py-2 text-lg font-bold text-white backdrop-blur-sm">Run, jump, glide and ground-pound across 8 sky worlds. Find every Star Shard and beat the Storm King!</p>
        <button onClick={onPlay} className="sk-btn mt-7 flex items-center gap-3 rounded-[1.6rem] border-b-[6px] border-amber-600 bg-gradient-to-b from-yellow-300 to-amber-400 px-10 py-4 text-3xl font-black text-amber-950 shadow-2xl"><Play className="h-8 w-8 fill-current" />PLAY</button>
        <div className="mt-4 flex gap-2">
          <button onClick={onHow} className="sk-btn rounded-2xl bg-indigo-950/40 px-5 py-2.5 font-black backdrop-blur">How to play</button>
        </div>
        <p className="mt-6 flex items-center gap-2 rounded-full bg-black/20 px-4 py-1.5 text-sm font-black backdrop-blur"><Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />{shards} / 21 Star Shards found</p>
      </div>
    </Sky>
  );
}

function WorldMap({ levels, progress, onPlay, onBack, onSettings, onHow }: { levels: LevelDef[]; progress: SkyProgress | null; onPlay: (i: number) => void; onBack: () => void; onSettings: () => void; onHow: () => void }) {
  const save = progress?.save;
  const firstOpen = levels.findIndex((_, i) => save && isUnlocked(save, i) && !save.levels[LEVEL_IDS[i]]?.done);
  return (
    <Sky bg="linear-gradient(180deg,#2b6fd6 0%,#6fb8ff 50%,#c9e9ff 100%)">
      <div className="mx-auto max-w-6xl px-3 pb-10 pt-3 sm:px-5">
        <header className="sticky top-0 z-10 -mx-3 flex items-center gap-2 bg-gradient-to-b from-[#2b6fd6] via-[#2b6fd6]/90 to-transparent px-3 pb-4 pt-1 sm:-mx-5 sm:px-5">
          <button onClick={onBack} className="sk-btn grid h-11 w-11 place-items-center rounded-2xl bg-black/25" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.3em] text-yellow-200">Skybound Sprint</p><h2 className="truncate text-2xl font-black sm:text-3xl">World Map</h2></div>
          <span className="flex items-center gap-1.5 rounded-2xl bg-black/25 px-3 py-2 text-sm font-black"><Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />{save ? totalShards(save) : 0}/21</span>
          <span className="hidden items-center gap-1.5 rounded-2xl bg-black/25 px-3 py-2 text-sm font-black sm:flex"><Coins className="h-4 w-4 text-yellow-300" />{save?.coins || 0} earned</span>
          <button onClick={onHow} className="sk-btn hidden rounded-2xl bg-black/25 px-3 py-2 text-sm font-black sm:block">How to play</button>
          <button onClick={onSettings} className="sk-btn grid h-11 w-11 place-items-center rounded-2xl bg-black/25" aria-label="Settings"><Settings className="h-5 w-5" /></button>
        </header>
        {!progress && <p className="mt-10 text-center text-lg font-black">Loading your progress…</p>}
        {progress && <>
          {progress.mode === "local" && <p className="mb-3 rounded-2xl bg-amber-300/90 px-4 py-2 text-sm font-black text-amber-950">Playing offline — progress is saved on this device for now.</p>}
          <p className="mb-4 text-sm font-bold text-white/90 drop-shadow">Clear a level to unlock the next. First clear: <b>+{SKY_REWARDS.firstClear} Reader Coins</b> · each new Star Shard: <b>+{SKY_REWARDS.shard}</b> · beat the Storm King: <b>+{SKY_REWARDS.bossClear}</b></p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {levels.map((L, i) => {
              const lp = save!.levels[L.id]; const open = isUnlocked(save!, i); const shards = lp?.shards || 0;
              return (
                <button key={L.id} disabled={!open} onClick={() => onPlay(i)} className={"sk-btn relative overflow-hidden rounded-[1.6rem] border-2 p-4 text-left shadow-xl disabled:cursor-not-allowed " + (i === firstOpen ? "border-yellow-300 ring-4 ring-yellow-300/50" : "border-white/30")} style={{ background: THEME_BG[L.theme] }}>
                  <div className="absolute -right-3 -top-3 text-7xl opacity-30">{THEME_ICON[L.theme]}</div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/85">World {L.num}{L.boss ? " · BOSS" : ""}</p>
                  <h3 className="mt-0.5 text-2xl font-black leading-tight drop-shadow">{L.name}</h3>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs font-bold text-white/90">{L.blurb}</p>
                  <div className="mt-3 flex items-center gap-1">{[0, 1, 2].map(k => <Star key={k} className={"h-6 w-6 " + ((shards >> k) & 1 ? "fill-yellow-300 text-yellow-300 drop-shadow" : "text-white/40")} />)}{L.boss && <span className="ml-1 text-xs font-black text-white/80">Boss level</span>}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                    {lp?.done ? <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-emerald-950">✓ CLEARED</span> : open ? <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-amber-950">{i === firstOpen ? "▶ PLAY NEXT" : "OPEN"}</span> : null}
                    {lp?.best ? <span className="rounded-full bg-black/30 px-2 py-0.5">⏱ {fmt(lp.best)}</span> : null}
                    {lp?.gems ? <span className="rounded-full bg-black/30 px-2 py-0.5">💎 {lp.gems}/{totalGems(L) + (L.boss ? 16 : 0)}</span> : null}
                  </div>
                  {!open && <div className="absolute inset-0 grid place-items-center bg-slate-950/55 backdrop-blur-[2px]"><div className="text-center"><Lock className="mx-auto h-9 w-9" /><p className="mt-1 text-sm font-black">Clear {levels[i - 1].num} to unlock</p></div></div>}
                </button>
              );
            })}
          </div>
        </>}
      </div>
    </Sky>
  );
}

function PlayView({ level, settings, audio, onWin, onQuit, onSettings }: { level: LevelDef; settings: SkySettings; audio: SkyAudio; onWin: (r: RunResult) => void; onQuit: () => void; onSettings: (s: SkySettings) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<SkyGame | null>(null);
  const inputRef = useRef<SkyInput | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [error, setError] = useState("");
  const [runKey, setRunKey] = useState(0);
  const [touch] = useState(isTouch);
  const toastId = useRef(0);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const input = new SkyInput(); inputRef.current = input;
    input.onPause = () => { const g = gameRef.current; if (!g) return; const p = !g.isPaused(); g.setPaused(p); setPaused(p); audio.play("pause"); };
    let game: SkyGame | null = null;
    try {
      game = new SkyGame(host, level, settings.quality, audio, input, {
        onHud: setHud,
        onWin: r => onWin(r),
        onToast: text => { const id = ++toastId.current; setToasts(t => [...t.slice(-2), { id, text }]); window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2000); },
      });
      gameRef.current = game;
    } catch (e) { console.error(e); setError("Your device couldn't start 3D graphics. Try lowering the quality in Settings."); }
    const vis = () => { if (document.hidden && gameRef.current && !gameRef.current.isPaused()) { gameRef.current.setPaused(true); setPaused(true); } };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); game?.dispose(); input.dispose(); gameRef.current = null; };
  }, [level, settings.quality, runKey]);

  const resume = () => { gameRef.current?.setPaused(false); setPaused(false); };
  const restart = () => { setPaused(false); setHud(null); setRunKey(k => k + 1); };
  const setTouchKey = (k: "left" | "right" | "jump" | "down", v: boolean) => { if (inputRef.current) inputRef.current.touch = { ...inputRef.current.touch, [k]: v }; };
  const hold = (k: "left" | "right" | "jump" | "down") => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); setTouchKey(k, true); try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* capture is optional */ } },
    onPointerUp: () => setTouchKey(k, false), onPointerCancel: () => setTouchKey(k, false), onLostPointerCapture: () => setTouchKey(k, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const tbtn = "grid touch-none select-none place-items-center rounded-full border-2 border-white/50 bg-black/35 font-black text-white shadow-lg backdrop-blur active:scale-95 active:bg-white/30";

  return (
    <div className="absolute inset-0 bg-black">
      <div ref={hostRef} className="absolute inset-0" />
      {error && <div className="absolute inset-0 grid place-items-center bg-slate-950 p-6 text-center"><div><p className="text-lg font-black">{error}</p><button onClick={onQuit} className="mt-4 rounded-2xl bg-white px-5 py-3 font-black text-slate-950">Back to map</button></div></div>}
      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 rounded-2xl bg-black/35 px-2.5 py-1.5 backdrop-blur">{Array.from({ length: Math.max(3, hud?.hearts || 3) }, (_, i) => <Heart key={i} className={"h-5 w-5 sm:h-6 sm:w-6 " + (i < (hud?.hearts ?? 3) ? "fill-rose-500 text-rose-300" : "text-white/35")} />)}{hud?.power ? <span className="ml-1 text-lg" title="Sky Feather: double-jump">🪶</span> : null}{hud && hud.star > 0 ? <span className="ml-1 text-lg">🌟</span> : null}</div>
          <div className="flex items-center gap-2 rounded-2xl bg-black/35 px-2.5 py-1 text-sm font-black backdrop-blur sm:text-base"><Gem className="h-4 w-4 text-cyan-300" />{hud?.gems ?? 0}<span className="text-white/60">/{hud?.gemsTotal ?? totalGems(level)}</span><span className="ml-1 flex">{[0, 1, 2].map(k => <Star key={k} className={"h-4 w-4 " + (((hud?.shards || 0) >> k) & 1 ? "fill-yellow-300 text-yellow-300" : "text-white/40")} />)}</span></div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 rounded-2xl bg-black/35 px-3 py-1.5 font-black tabular-nums backdrop-blur"><Timer className="h-4 w-4" />{fmt(hud?.time || 0)}</div>
        <button onClick={() => { gameRef.current?.setPaused(true); setPaused(true); audio.play("pause"); }} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-2xl bg-black/40 backdrop-blur" aria-label="Pause"><Pause className="h-5 w-5" /></button>
      </div>
      {hud?.bossHp != null && <div className="pointer-events-none absolute left-1/2 top-16 w-[min(420px,70vw)] -translate-x-1/2 text-center"><p className="text-xs font-black uppercase tracking-widest text-yellow-200 drop-shadow">⚡ Storm King</p><div className="mt-1 flex gap-1.5">{[0, 1, 2].map(i => <div key={i} className={"h-3.5 flex-1 rounded-full border-2 border-white/60 " + (i < hud.bossHp! ? "bg-gradient-to-r from-violet-500 to-fuchsia-400" : "bg-black/40")} />)}</div></div>}
      <div key={"intro" + runKey} className="sk-intro pointer-events-none absolute inset-x-0 top-[22%] text-center">
        <p className="text-sm font-black uppercase tracking-[.35em] text-yellow-200 drop-shadow-[0_2px_4px_rgba(0,0,0,.6)]">World {level.num}</p>
        <h2 className="sk-title text-5xl font-black italic sm:text-7xl">{level.name}</h2>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center gap-2">
        {toasts.map(t => <div key={t.id} className="sk-toast rounded-2xl bg-black/45 px-5 py-2 text-lg font-black backdrop-blur sm:text-2xl">{t.text}</div>)}
      </div>
      {/* touch controls */}
      {touch && !paused && <>
        <div className="absolute flex gap-3" style={{ left: "max(.75rem, env(safe-area-inset-left))", bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button {...hold("left")} className={tbtn + " h-[4.6rem] w-[4.6rem] text-3xl sm:h-24 sm:w-24"} aria-label="Move left">◀</button>
          <button {...hold("right")} className={tbtn + " h-[4.6rem] w-[4.6rem] text-3xl sm:h-24 sm:w-24"} aria-label="Move right">▶</button>
        </div>
        <div className="absolute flex items-end gap-3" style={{ right: "max(.75rem, env(safe-area-inset-right))", bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button {...hold("down")} className={tbtn + " mb-1 h-16 w-16 text-xs sm:h-20 sm:w-20"} aria-label="Ground pound">▼<span className="-mt-3 text-[10px]">POUND</span></button>
          <button {...hold("jump")} className={tbtn + " h-24 w-24 border-yellow-200/80 bg-amber-400/55 text-lg sm:h-28 sm:w-28"} aria-label="Jump">JUMP</button>
        </div>
      </>}
      {paused && (
        <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="sk-pop w-full max-w-sm rounded-[1.8rem] border border-white/20 bg-slate-950/95 p-5 text-center shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[.3em] text-slate-400">World {level.num}</p>
            <h2 className="text-3xl font-black">Paused</h2>
            <div className="mt-4 grid gap-2">
              <button onClick={resume} className="sk-btn flex items-center justify-center gap-2 rounded-2xl bg-yellow-300 py-3.5 text-lg font-black text-amber-950"><Play className="h-5 w-5 fill-current" />Resume</button>
              <button onClick={restart} className="sk-btn flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 font-black"><RotateCcw className="h-5 w-5" />Restart level</button>
              <button onClick={onQuit} className="sk-btn rounded-2xl bg-white/10 py-3 font-black">World map</button>
            </div>
            <div className="mt-4 space-y-2 text-left text-sm font-bold">
              <label className="flex items-center gap-3"><Volume2 className="h-4 w-4" />Music<input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={e => onSettings({ ...settings, music: +e.target.value })} className="flex-1 accent-yellow-300" /></label>
              <label className="flex items-center gap-3"><Volume2 className="h-4 w-4" />Sounds<input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={e => onSettings({ ...settings, sfx: +e.target.value })} className="flex-1 accent-yellow-300" /></label>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-400">{touch ? "◀ ▶ move · JUMP · tap JUMP again in the air to glide · POUND in the air" : "← → move · Space jump (again in the air to glide) · ↓ ground-pound · Esc pause"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Results({ clear, level, hasNext, onNext, onReplay, onMap }: { clear: Clear; level: LevelDef; hasNext: boolean; onNext: () => void; onReplay: () => void; onMap: () => void }) {
  const r = clear.result;
  return (
    <Sky bg={THEME_BG[level.theme]}>
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <div className="sk-pop w-full max-w-lg rounded-[2rem] border-2 border-white/30 bg-slate-950/90 p-5 text-center shadow-2xl backdrop-blur sm:p-7">
          <div className="text-5xl">{level.boss ? "🏆" : "🎉"}</div>
          <p className="mt-1 text-xs font-black uppercase tracking-[.3em] text-yellow-200">World {level.num} · {level.name}</p>
          <h2 className="sk-title text-4xl font-black italic sm:text-5xl">{level.boss ? "You saved the skies!" : "Level clear!"}</h2>
          <div className="mt-4 flex justify-center gap-2">{[0, 1, 2].map(k => { const got = (r.shards >> k) & 1, isNew = got && !((clear.prevShards >> k) & 1); return <div key={k} className={"sk-pop grid h-16 w-16 place-items-center rounded-2xl " + (got ? "bg-yellow-300/20" : "bg-white/5")} style={{ animationDelay: `${0.2 + k * 0.15}s` }}><Star className={"h-11 w-11 " + (got ? "fill-yellow-300 text-yellow-300" : "text-white/25")} />{isNew ? <span className="-mt-2 text-[9px] font-black text-yellow-200">NEW</span> : null}</div>; })}</div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/5 py-2.5"><div className="text-xl font-black tabular-nums">{fmt(r.time)}</div><div className="text-[10px] font-black uppercase text-slate-400">{clear.newBest ? "⭐ New best" : "Time"}</div></div>
            <div className="rounded-2xl bg-white/5 py-2.5"><div className="text-xl font-black">{r.gems}<span className="text-sm text-slate-400">/{r.gemsTotal}</span></div><div className="text-[10px] font-black uppercase text-slate-400">Gems</div></div>
            <div className="rounded-2xl bg-white/5 py-2.5"><div className="text-xl font-black">{r.stomps}</div><div className="text-[10px] font-black uppercase text-slate-400">Enemies bopped</div></div>
          </div>
          {clear.coins > 0 ? <p className="sk-pop mt-4 flex items-center justify-center gap-2 rounded-2xl bg-yellow-300 py-3 text-lg font-black text-amber-950"><Coins className="h-5 w-5" />+{clear.coins} Reader Coins!</p>
            : <p className="mt-4 text-sm font-bold text-slate-300">{countBits(r.shards) < 3 ? "Find the missing Star Shards to earn more Reader Coins." : "All rewards for this level collected — go for a faster time!"}</p>}
          {clear.error && <p className="mt-2 text-xs font-bold text-amber-300">{clear.error}</p>}
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {hasNext && <button onClick={onNext} className="sk-btn rounded-2xl bg-yellow-300 py-3.5 font-black text-amber-950 sm:order-3">Next level ▶</button>}
            <button onClick={onReplay} className="sk-btn flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 font-black"><RotateCcw className="h-4 w-4" />Replay</button>
            <button onClick={onMap} className="sk-btn rounded-2xl bg-white/10 py-3 font-black">World map</button>
          </div>
          {!hasNext && <p className="mt-4 flex items-center justify-center gap-2 text-sm font-black text-yellow-200"><Trophy className="h-4 w-4" />You finished Skybound Sprint! Now find all 21 Star Shards.</p>}
        </div>
      </div>
    </Sky>
  );
}

function SettingsPanel({ settings, onChange, onClose }: { settings: SkySettings; onChange: (s: SkySettings) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="sk-pop w-full max-w-sm rounded-[1.8rem] border border-white/20 bg-slate-950/95 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center"><h2 className="flex-1 text-2xl font-black">Settings</h2><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" aria-label="Close"><X className="h-5 w-5" /></button></div>
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">Graphics</p>
        <div className="mt-2 grid grid-cols-3 gap-2">{(["low", "medium", "high"] as const).map(q => <button key={q} onClick={() => onChange({ ...settings, quality: q })} className={"rounded-xl py-2.5 font-black capitalize " + (settings.quality === q ? "bg-yellow-300 text-amber-950" : "bg-white/10")}>{q}</button>)}</div>
        <p className="mt-1 text-xs font-bold text-slate-400">Use Low if the game feels slow on your device.</p>
        <div className="mt-4 space-y-3 text-sm font-bold">
          <label className="flex items-center gap-3"><span className="w-16">Music</span><input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={e => onChange({ ...settings, music: +e.target.value })} className="flex-1 accent-yellow-300" /></label>
          <label className="flex items-center gap-3"><span className="w-16">Sounds</span><input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={e => onChange({ ...settings, sfx: +e.target.value })} className="flex-1 accent-yellow-300" /></label>
        </div>
      </div>
    </div>
  );
}

function HowToPlay({ onClose }: { onClose: () => void }) {
  const rows: [string, string, string][] = [
    ["🏃", "Run", "← → / A D · touch ◀ ▶"],
    ["⤴️", "Jump", "Space / ↑ / W · touch JUMP. Hold for a higher jump"],
    ["🪂", "Glide", "Press JUMP again in the air. Glide into wind to soar up!"],
    ["💥", "Ground-pound", "↓ / S in the air · touch POUND. Smashes bricks and enemies"],
    ["🧗", "Wall-jump", "Slide down a wall, then JUMP"],
    ["👟", "Stomp", "Land on Puffs and Buzzers. Never stomp a Spiky!"],
    ["🎁", "Gift boxes", "Bump them from below for gems and power-ups"],
    ["🪶", "Sky Feather", "Double-jump + one extra hit"],
    ["🌟", "Super Star", "Invincible and super fast for a few seconds"],
    ["⭐", "Star Shards", "3 hidden in every level — they earn Reader Coins"],
  ];
  return (
    <div className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="sk-pop w-full max-w-lg rounded-[1.8rem] border border-white/20 bg-slate-950/95 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center"><h2 className="flex-1 text-2xl font-black">How to play</h2><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" aria-label="Close"><X className="h-5 w-5" /></button></div>
        <div className="mt-3 divide-y divide-white/10">{rows.map(([icon, name, how]) => <div key={name} className="flex items-center gap-3 py-2.5"><span className="w-9 text-center text-2xl">{icon}</span><div><p className="font-black">{name}</p><p className="text-sm font-bold text-slate-300">{how}</p></div></div>)}</div>
        <p className="mt-3 text-xs font-bold text-slate-400">Gamepads work too. Lanterns are checkpoints — lose all your hearts and you start again from the last one.</p>
      </div>
    </div>
  );
}
