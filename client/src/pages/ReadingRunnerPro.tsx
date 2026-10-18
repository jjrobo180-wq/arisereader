// Reading Runner — a 3D endless-runner reading game for eye-gaze, touch, mouse and keyboard players.
// Run down the train tracks, dodge trains, jump barriers, grab coins and run into the card that matches the mission.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Coins, Eye, Hand, Heart, HelpCircle, Pause, Play, RotateCcw, Settings, Star, Volume2, VolumeX, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { MISSIONS, type Mission } from "@shared/runner/missions";
import { DEFAULT_ASSISTS, type Difficulty, type RunResult, type SimEvent } from "@shared/runner/sim";
import { RunnerGame, type HudState } from "@/game/runner/game";
import { RunnerAudio } from "@/game/runner/audio";
import { RunnerInput, type Steer } from "@/game/runner/input";
import { loadProgress, loadSettings, recordRun, saveSettings, type RunnerProgress, type RunnerSettings } from "@/game/runner/save";

const CSS = `
.rr-font{font-family:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
.rr-title{text-shadow:0 4px 0 #0b1a3a,0 9px 0 rgba(11,26,58,.55),0 18px 34px rgba(0,0,0,.45)}
.rr-btn{transition:transform .14s cubic-bezier(.2,1.4,.4,1),filter .14s,box-shadow .14s}.rr-btn:hover{transform:translateY(-2px);filter:brightness(1.06)}.rr-btn:active{transform:translateY(1px) scale(.98)}
.rr-dwell{position:absolute;left:0;bottom:0;height:6px;width:0;border-radius:999px;background:linear-gradient(90deg,#fff7ae,#ffd23f);box-shadow:0 0 12px rgba(255,210,63,.9)}
.rr-dwell.on{width:100%;transition-property:width;transition-timing-function:linear}
.rr-pop{animation:rrPop .5s cubic-bezier(.2,1.6,.4,1) both}@keyframes rrPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.rr-up{animation:rrUp .55s cubic-bezier(.2,1.2,.4,1) both}@keyframes rrUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
.rr-toast{animation:rrToast 1.25s ease-out forwards}@keyframes rrToast{0%{opacity:0;transform:translateY(16px) scale(.7)}14%{opacity:1;transform:scale(1.08)}24%{transform:scale(1)}78%{opacity:1}100%{opacity:0;transform:translateY(-18px)}}
.rr-toast-long{animation-duration:2.1s}
.rr-count{animation:rrCount .7s cubic-bezier(.2,1.5,.4,1) both}@keyframes rrCount{0%{transform:scale(2.4);opacity:0}30%{transform:scale(1);opacity:1}100%{transform:scale(.85);opacity:0}}
.rr-float{animation:rrFloat 3.2s ease-in-out infinite}@keyframes rrFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}
.rr-shine{background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);background-size:250% 100%;animation:rrShine 2.8s ease-in-out infinite}@keyframes rrShine{from{background-position:150% 0}to{background-position:-100% 0}}
.rr-pip{transition:transform .3s cubic-bezier(.2,1.8,.4,1),background .2s}
.rr-scroll::-webkit-scrollbar{width:10px}.rr-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25);border-radius:9px}
`;

const SPEEDS: { id: Difficulty; icon: string; name: string; note: string }[] = [
  { id: "easy", icon: "🧸", name: "Easy", note: "Slow · helpers steer & jump · no hearts lost" },
  { id: "medium", icon: "🏃", name: "Medium", note: "Steady · auto-jump · 3 hearts" },
  { id: "hard", icon: "⚡", name: "Hard", note: "Fast · all you · 3 hearts" },
];
const MENU_DWELL = 1200;
const enterImmersive = () => { try { const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }; const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req && !document.fullscreenElement) void req.call(el)?.catch?.(() => {}); } catch { /* optional */ } };
const leaveImmersive = () => { try { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); } catch { /* optional */ } };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Look-to-select button: hover (eye gaze / mouse) for a moment to press it, or tap/click right away ──
function Dwell({ onSelect, children, className = "", disabled, dwell = true, ms = MENU_DWELL, label, onHover }: { onSelect: () => void; children: ReactNode; className?: string; disabled?: boolean; dwell?: boolean; ms?: number; label?: string; onHover?: () => void }) {
  const [on, setOn] = useState(false); const timer = useRef(0);
  const stop = () => { window.clearTimeout(timer.current); setOn(false); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button type="button" aria-label={label} disabled={disabled}
      // arm on real pointer movement (a gaze or a moving mouse) — not when a screen change slides a button under a resting cursor
      onPointerMove={e => { if (on || disabled || !dwell || e.pointerType === "touch") return; onHover?.(); setOn(true); timer.current = window.setTimeout(() => { setOn(false); onSelect(); }, ms); }}
      onPointerLeave={stop} onClick={() => { stop(); onSelect(); }}
      className={"rr-btn relative overflow-hidden disabled:cursor-not-allowed disabled:opacity-40 " + className}>
      {children}
      {dwell && !disabled && <span className={"rr-dwell" + (on ? " on" : "")} style={{ transitionDuration: on ? ms + "ms" : "0ms" }} />}
    </button>
  );
}

// ── live 3D backdrop (Riley running on autopilot) for the title screen ──
function Backdrop({ mission, quality, audio }: { mission: Mission; quality: RunnerSettings["quality"]; audio: RunnerAudio }) {
  const host = useRef<HTMLDivElement>(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = host.current; if (!el) return;
    let g: RunnerGame | null = null;
    try { g = new RunnerGame(el, mission, { difficulty: "medium", assists: DEFAULT_ASSISTS.easy, quality: quality === "high" ? "medium" : quality, cardStyle: "both", steer: "touch", demo: true, music: false, seed: 42 }, audio, null); }
    catch (e) { console.error(e); setFailed(true); }
    return () => g?.dispose();
  }, [mission, quality, audio]);
  return <div ref={host} className="absolute inset-0" style={failed ? { background: mission.look.ui } : undefined} />;
}

export default function ReadingRunnerPro({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useState<RunnerSettings>(() => loadSettings(uid));
  const [progress, setProgress] = useState<RunnerProgress>(() => loadProgress(uid));
  const [view, setView] = useState<"title" | "worlds" | "play">("title");
  const [world, setWorld] = useState(() => Math.min(MISSIONS.length - 1, loadProgress(uid).last || 0));
  const [runKey, setRunKey] = useState(0);
  const [panel, setPanel] = useState<null | "settings" | "how">(null);
  const audioRef = useRef<RunnerAudio | null>(null); if (!audioRef.current) audioRef.current = new RunnerAudio();
  const audio = audioRef.current;
  const settingsRef = useRef(settings); settingsRef.current = settings;

  useEffect(() => { saveSettings(uid, settings); audio.setVolumes(settings.music, settings.sfx); }, [settings, uid, audio]);
  useEffect(() => () => { stopSpeaking(); audio.dispose(); }, [audio]);

  const say = useCallback((text: string, calm = false) => {
    if (!settingsRef.current.voice) return;
    stopSpeaking();
    void speakCharacterAI(text, { calmMode: calm, onFallback: () => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 1.1; window.speechSynthesis.speak(u); } });
  }, []);
  const click = () => { audio.ensure(); audio.play("select"); };
  const hover = () => { audio.ensure(); audio.play("hover"); };
  const play = (i: number) => { click(); enterImmersive(); setWorld(i); setRunKey(k => k + 1); setView("play"); };
  const exit = () => { stopSpeaking(); leaveImmersive(); onBack(); };
  const dw = settings.dwellMenus;

  return (
    <main className="rr-font fixed inset-0 z-[120] h-[100dvh] overflow-hidden bg-slate-950 text-white select-none">
      <style>{CSS}</style>
      {view === "title" && (
        <section className="absolute inset-0" data-runner-ui>
          <Backdrop mission={MISSIONS[world]} quality={settings.quality} audio={audio} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/70 to-transparent" />
          <div className="absolute left-3 top-3 z-10 flex gap-2 sm:left-5 sm:top-5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <Dwell dwell={dw} onSelect={exit} onHover={hover} className="flex min-h-12 items-center gap-2 rounded-2xl bg-black/40 px-4 font-black backdrop-blur" label="Back to games"><ArrowLeft className="h-5 w-5" />Games</Dwell>
          </div>
          <div className="absolute right-3 top-3 z-10 flex gap-2 sm:right-5 sm:top-5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <Dwell dwell={dw} onSelect={() => { click(); setPanel("how"); }} onHover={hover} className="grid h-12 w-12 place-items-center rounded-2xl bg-black/40 backdrop-blur" label="How to play"><HelpCircle className="h-6 w-6" /></Dwell>
            <Dwell dwell={dw} onSelect={() => { click(); setPanel("settings"); }} onHover={hover} className="grid h-12 w-12 place-items-center rounded-2xl bg-black/40 backdrop-blur" label="Settings"><Settings className="h-6 w-6" /></Dwell>
          </div>
          <div className="relative flex h-full flex-col justify-center px-6 sm:px-12">
            <div className="rr-up max-w-xl">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[.25em] backdrop-blur">🚇 Run · Read · Rescue</p>
              <h1 className="rr-title text-6xl font-black italic leading-[.86] tracking-tight sm:text-8xl"><span className="text-amber-300">READING</span><br />RUNNER</h1>
              <p className="mt-5 max-w-md text-lg font-bold leading-snug text-white/90 sm:text-xl">Race down the train tracks with Riley and Buddy. Dodge trains, jump barriers, grab coins — and run into the card that matches the word!</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Dwell dwell={dw} onSelect={() => { click(); setView("worlds"); }} onHover={hover} className="flex min-h-[4.5rem] items-center gap-3 rounded-[1.6rem] border-b-[6px] border-amber-600 bg-gradient-to-b from-yellow-300 to-amber-400 px-10 text-3xl font-black text-amber-950 shadow-2xl"><Play className="h-8 w-8 fill-current" />PLAY</Dwell>
                {progress.worlds[world]?.clears ? null : <Dwell dwell={dw} onSelect={() => play(world)} onHover={hover} className="min-h-14 rounded-2xl bg-white/15 px-5 text-lg font-black backdrop-blur">▶ Quick start · {MISSIONS[world].look.badge} {MISSIONS[world].look.name}</Dwell>}
              </div>
              <p className="mt-6 flex items-center gap-3 text-sm font-black text-white/80">
                <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5"><Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />{Object.values(progress.worlds).reduce((a, w) => a + w.stars, 0)} / {MISSIONS.length * 3}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5"><Coins className="h-4 w-4 text-yellow-300" />{progress.coins}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5">{settings.steer === "look" ? <><Eye className="h-4 w-4" />Look to steer</> : <><Hand className="h-4 w-4" />Swipe & tap</>}</span>
              </p>
            </div>
          </div>
        </section>
      )}
      {view === "worlds" && <WorldsScreen settings={settings} progress={progress} dwell={dw} onHover={hover} onBack={() => { click(); setView("title"); }} onPlay={play}
        onSpeed={d => { click(); setSettings(s => ({ ...s, difficulty: d })); }} onSettings={() => { click(); setPanel("settings"); }} />}
      {view === "play" && <PlayView key={runKey} index={world} settings={settings} audio={audio} say={say} dwell={dw} onHover={hover}
        onRecord={r => { const out = recordRun(uid, world, r); setProgress(out.progress); return out; }}
        onReplay={() => play(world)} onNext={() => play((world + 1) % MISSIONS.length)}
        onWorlds={() => { click(); stopSpeaking(); setView("worlds"); }} onExit={exit}
        onSettings={patch => setSettings(s => ({ ...s, ...patch }))} />}
      {panel === "settings" && <SettingsPanel settings={settings} dwell={dw} onHover={hover} onChange={setSettings} onClose={() => { click(); setPanel(null); }} />}
      {panel === "how" && <HowTo steer={settings.steer} dwell={dw} onHover={hover} onClose={() => { click(); setPanel(null); }} />}
    </main>
  );
}

function WorldsScreen({ settings, progress, dwell, onHover, onBack, onPlay, onSpeed, onSettings }: { settings: RunnerSettings; progress: RunnerProgress; dwell: boolean; onHover: () => void; onBack: () => void; onPlay: (i: number) => void; onSpeed: (d: Difficulty) => void; onSettings: () => void }) {
  const next = MISSIONS.findIndex((_, i) => !progress.worlds[i]?.clears);
  return (
    <section data-runner-ui className="rr-scroll absolute inset-0 overflow-y-auto" style={{ background: "radial-gradient(circle at 80% -10%, #3b5bdb 0%, #172554 40%, #0b1022 100%)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.07]" style={{ backgroundImage: "linear-gradient(90deg,#fff 1px,transparent 1px),linear-gradient(#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#121c44] via-[#121c44]/90 to-transparent">
        <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 pb-5 pt-3 sm:px-6" style={{ paddingTop: "max(.75rem, env(safe-area-inset-top))" }}>
          <Dwell dwell={dwell} onSelect={onBack} onHover={onHover} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10" label="Back"><ArrowLeft className="h-6 w-6" /></Dwell>
          <div className="mr-auto min-w-0"><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-300">Reading Runner</p><h2 className="text-2xl font-black sm:text-3xl">Choose a world</h2></div>
          <div className="order-last flex w-full gap-1.5 rounded-2xl bg-black/30 p-1.5 sm:order-none sm:w-auto" role="radiogroup" aria-label="Speed">
            {SPEEDS.map(s => <Dwell key={s.id} dwell={dwell} onSelect={() => onSpeed(s.id)} onHover={onHover} className={"min-h-12 flex-1 rounded-xl px-3 text-base font-black sm:flex-none sm:px-4 " + (settings.difficulty === s.id ? "bg-amber-300 text-amber-950 shadow-lg" : "text-white/80")} label={s.name + " speed"}>{s.icon} {s.name}</Dwell>)}
          </div>
          <Dwell dwell={dwell} onSelect={onSettings} onHover={onHover} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10" label="Settings"><Settings className="h-6 w-6" /></Dwell>
        </header>
      </div>
      <div className="relative mx-auto max-w-6xl px-3 pb-10 sm:px-6">
        <p className="mb-4 text-sm font-bold text-white/70">{SPEEDS.find(s => s.id === settings.difficulty)!.note}{dwell ? " · Look at a world to start it." : ""}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MISSIONS.map((m, i) => {
            const w = progress.worlds[i];
            return (
              <Dwell key={i} dwell={dwell} onSelect={() => onPlay(i)} onHover={onHover} label={`World ${i + 1}, ${m.look.name}: ${m.action}`}
                className={"rr-up group isolate flex min-h-[188px] flex-col rounded-[1.6rem] border-2 p-3 text-left shadow-xl " + (i === next ? "border-amber-300 ring-4 ring-amber-300/40" : "border-white/20")}>
                <span className="absolute inset-0 -z-10" style={{ background: m.look.ui }} />
                <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <span className="absolute -right-2 -top-3 text-6xl opacity-90 drop-shadow-lg transition group-hover:scale-110">{m.look.badge}</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-white/85">World {i + 1}</span>
                <span className="mt-0.5 pr-10 text-xl font-black leading-tight drop-shadow">{m.look.name}</span>
                <span className="mt-auto flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 text-slate-950 shadow"><span className="text-2xl leading-none">{m.target.emoji}</span><span className="truncate text-sm font-black uppercase">{m.target.label}</span><span className="ml-auto text-xs font-black text-slate-500">×{m.goal}</span></span>
                <span className="mt-2 flex items-center gap-0.5">{[0, 1, 2].map(k => <Star key={k} className={"h-5 w-5 " + ((w?.stars || 0) > k ? "fill-yellow-300 text-yellow-300 drop-shadow" : "text-white/40")} />)}
                  {i === next ? <span className="ml-auto rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-950">NEXT</span> : w?.best ? <span className="ml-auto text-[11px] font-black text-white/85">🏆 {w.best}</span> : null}</span>
              </Dwell>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type Toast = { id: number; tone: "good" | "oops" | "info"; emoji?: string; big: string; small?: string; long?: boolean };

function PlayView({ index, settings, audio, say, dwell, onHover, onRecord, onReplay, onNext, onWorlds, onExit, onSettings }: {
  index: number; settings: RunnerSettings; audio: RunnerAudio; say: (t: string, calm?: boolean) => void; dwell: boolean; onHover: () => void;
  onRecord: (r: RunResult) => { newBest: boolean; firstClear: boolean }; onReplay: () => void; onNext: () => void; onWorlds: () => void; onExit: () => void; onSettings: (p: Partial<RunnerSettings>) => void;
}) {
  const mission = MISSIONS[index]; const T = mission.target;
  const host = useRef<HTMLDivElement>(null); const gameRef = useRef<RunnerGame | null>(null); const inputRef = useRef<RunnerInput | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [phase, setPhase] = useState<"intro" | "count" | "run" | "end">("intro");
  const [count, setCount] = useState<string>("");
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [end, setEnd] = useState<{ r: RunResult; newBest: boolean; firstClear: boolean } | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(true);
  const toastId = useRef(0); const catches = useRef(0);
  const cbRef = useRef({ say, onRecord }); cbRef.current = { say, onRecord };

  const show = useCallback((t: Omit<Toast, "id">) => setToast({ ...t, id: ++toastId.current }), []);
  const intro = useCallback(() => cbRef.current.say(`World ${index + 1}. ${mission.look.name}. ${mission.action}!`), [index, mission]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const input = new RunnerInput(el, { steer: settings.steer, dwellMs: settings.laneDelay }); inputRef.current = input;
    input.onPause = () => { const g = gameRef.current; if (!g || g.sim.state !== "run" && g.sim.state !== "finish") return; const p = !g.isPaused(); g.setPaused(p); setPaused(p); audio.play("pause"); };
    let game: RunnerGame | null = null;
    try {
      game = new RunnerGame(el, mission, { difficulty: settings.difficulty, assists: settings.assists[settings.difficulty], quality: settings.quality, cardStyle: settings.cardStyle, steer: settings.steer }, audio, input, {
        onHud: setHud,
        onEvent: (e: SimEvent) => {
          const s = cbRef.current.say, label = (e.label || "").toUpperCase();
          switch (e.t) {
            case "card": { catches.current++; show({ tone: "good", emoji: e.emoji, big: label + "!", small: `${e.n} of ${mission.goal}` }); s(catches.current % 3 === 0 ? `${cap(e.label!)}! Great reading!` : `${cap(e.label!)}!`); navigator.vibrate?.(40); break; }
            case "wrong": show({ tone: "oops", emoji: e.emoji, big: `That's ${/^[aeiou]/i.test(e.label!) ? "an" : "a"} ${label}`, small: `Find the ${T.label.toUpperCase()} ${T.emoji}`, long: true }); s(`That's ${/^[aeiou]/i.test(e.label!) ? "an" : "a"} ${e.label}. Find the ${T.label}!`, true); break;
            case "miss": show({ tone: "info", emoji: T.emoji, big: `More ${T.label.toUpperCase()} coming!`, small: "Run into the matching card", long: true }); break;
            case "crash": show({ tone: "oops", emoji: "💥", big: "Oops!", small: e.n != null && gameRef.current?.sim.cfg.loseHearts ? `${e.n} ${e.n === 1 ? "heart" : "hearts"} left` : "Keep running!" }); break;
            case "magnet": show({ tone: "info", emoji: "🧲", big: "Coin magnet!" }); break;
            case "shield": show({ tone: "info", emoji: "🛡️", big: "Bubble shield!" }); break;
            case "shieldPop": show({ tone: "info", emoji: "🫧", big: "Shield saved you!" }); break;
            case "goal": show({ tone: "good", emoji: "🏁", big: "You found them all!", small: "Run to the finish!", long: true }); s("You found them all! Run to the finish!"); break;
            case "win": s("Great job! World complete!"); celebrateEyeGaze(false); break;
            case "fail": s("Nice try! Let's run again.", true); break;
          }
        },
        onEnd: r => { const out = cbRef.current.onRecord(r); setEnd({ r, ...out }); setPhase("end"); },
      });
      gameRef.current = game;
    } catch (e) { console.error(e); setError("This device couldn't start the 3D game. Try Graphics: Low in Settings."); }

    // intro: mission card while the camera sweeps around Riley, then 3-2-1-GO
    const timers: number[] = [];
    const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    intro();
    at(2700, () => { setPhase("count"); setCount("3"); audio.play("count"); });
    at(3400, () => { setCount("2"); audio.play("count"); });
    at(4100, () => { setCount("1"); audio.play("count"); });
    at(4800, () => { setCount("GO!"); audio.play("go"); game?.start(); setPhase("run"); });
    at(5500, () => setCount(""));
    at(10500, () => setHint(false));
    const vis = () => { const g = gameRef.current; if (document.hidden && g && (g.sim.state === "run" || g.sim.state === "finish") && !g.isPaused()) { g.setPaused(true); setPaused(true); } };
    document.addEventListener("visibilitychange", vis);
    return () => { timers.forEach(window.clearTimeout); document.removeEventListener("visibilitychange", vis); game?.dispose(); input.dispose(); gameRef.current = null; inputRef.current = null; };
    // settings that change the course rebuild the run; others apply live below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission]);
  useEffect(() => { if (inputRef.current) inputRef.current.opts = { steer: settings.steer, dwellMs: settings.laneDelay }; if (gameRef.current) gameRef.current.opts.steer = settings.steer; }, [settings.steer, settings.laneDelay]);
  useEffect(() => { if (!toast) return; const id = toast.id; const h = window.setTimeout(() => setToast(t => (t?.id === id ? null : t)), toast.long ? 2100 : 1250); return () => window.clearTimeout(h); }, [toast]);

  const pause = () => { const g = gameRef.current; if (!g) return; g.setPaused(true); setPaused(true); audio.play("pause"); };
  const resume = () => { audio.play("select"); gameRef.current?.setPaused(false); setPaused(false); };
  const look = settings.steer === "look";
  const running = phase === "run" && !paused && !end;
  const goal = mission.goal;

  return (
    <div className="absolute inset-0 bg-black">
      <div ref={host} className="absolute inset-0" />
      {error && <div className="absolute inset-0 grid place-items-center bg-slate-950 p-6 text-center" data-runner-ui><div><p className="text-xl font-black">{error}</p><Dwell dwell={dwell} onSelect={onWorlds} className="mt-5 min-h-14 rounded-2xl bg-white px-6 font-black text-slate-950">Back to worlds</Dwell></div></div>}

      {/* look-up-to-jump zone */}
      {look && running && <div className={"pointer-events-none absolute inset-x-0 top-0 h-[17%] transition-colors duration-200 " + (hud?.lookingUp ? "bg-gradient-to-b from-amber-300/35 to-transparent" : "bg-gradient-to-b from-white/[.07] to-transparent")}>
        <p className={"absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-widest transition " + (hud?.lookingUp ? "bg-amber-300 text-amber-950" : "text-white/45")}>⤒ look up here to jump</p>
      </div>}

      {/* HUD */}
      {phase !== "intro" && !end && <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
        <Dwell dwell={dwell} onSelect={pause} onHover={onHover} className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/45 backdrop-blur" label="Pause"><Pause className="h-6 w-6" /></Dwell>
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={intro} className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/95 py-1.5 pl-1.5 pr-3 text-slate-950 shadow-xl sm:gap-3" aria-label={`Mission: ${mission.action}. ${hud?.caught ?? 0} of ${goal}`}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-3xl sm:h-12 sm:w-12">{T.emoji}</span>
            <span className="text-left"><span className="block text-lg font-black uppercase leading-none sm:text-xl">{T.label}</span>
              <span className="mt-1 flex gap-1">{Array.from({ length: goal }, (_, i) => <span key={i} className={"rr-pip h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 " + (i < (hud?.caught || 0) ? "scale-110 bg-emerald-500" : "bg-slate-300")} />)}</span></span>
            <span className="ml-1 text-xl font-black tabular-nums text-emerald-600 sm:text-2xl">{hud?.caught || 0}<span className="text-sm text-slate-400">/{goal}</span></span>
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5 rounded-2xl bg-black/45 px-3 py-1.5 font-black tabular-nums backdrop-blur"><Coins className="h-5 w-5 text-yellow-300" />{hud?.coins || 0}</div>
          {hud?.loseHearts && <div className="flex items-center gap-0.5 rounded-2xl bg-black/45 px-2 py-1.5 backdrop-blur">{[0, 1, 2].map(i => <Heart key={i} className={"h-5 w-5 " + (i < hud.hearts ? "fill-rose-500 text-rose-300" : "text-white/30")} />)}</div>}
          {(hud?.magnet || 0) > 0 && <div className="rounded-2xl bg-rose-500/80 px-2.5 py-1 text-sm font-black backdrop-blur">🧲 {Math.ceil(hud!.magnet)}s</div>}
          {(hud?.shield || 0) > 0 && <div className="rounded-2xl bg-cyan-500/80 px-2.5 py-1 text-sm font-black backdrop-blur">🛡️ {Math.ceil(hud!.shield)}s</div>}
        </div>
      </div>}

      {/* mission intro card */}
      {phase === "intro" && !error && <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
        <div className="rr-pop flex flex-col items-center text-center">
          <p className="rounded-full bg-black/45 px-4 py-1 text-sm font-black uppercase tracking-[.3em] text-amber-200 backdrop-blur">World {index + 1} · {mission.look.name}</p>
          <div className="rr-float mt-4 flex h-52 w-44 flex-col items-center justify-center rounded-[2rem] border-[6px] border-[#1b2a4a] bg-white text-slate-950 shadow-[0_0_60px_rgba(255,224,102,.75)] sm:h-64 sm:w-52">
            <span className="text-8xl leading-none sm:text-9xl">{T.emoji}</span>
            <span className="mt-3 rounded-xl bg-[#1b2a4a] px-4 py-1 text-2xl font-black uppercase text-white sm:text-3xl">{T.label}</span>
          </div>
          <h2 className="rr-title mt-5 text-4xl font-black italic sm:text-6xl">{mission.action}!</h2>
        </div>
      </div>}
      {count && <div className="pointer-events-none absolute inset-0 grid place-items-center"><div key={count} className="rr-count rr-title text-[9rem] font-black italic leading-none text-amber-300 sm:text-[12rem]">{count}</div></div>}

      {/* toasts */}
      {toast && !end && <div className="pointer-events-none absolute inset-x-0 top-[24%] flex justify-center px-4">
        <div key={toast.id} className={"rr-toast flex items-center gap-3 rounded-[1.6rem] border-4 px-5 py-3 shadow-2xl backdrop-blur " + (toast.long ? "rr-toast-long " : "") + (toast.tone === "good" ? "border-white bg-emerald-500/95" : toast.tone === "oops" ? "border-white/80 bg-slate-900/90" : "border-white/70 bg-indigo-600/90")}>
          {toast.emoji && <span className="text-5xl leading-none sm:text-6xl">{toast.emoji}</span>}
          <span><span className="block text-3xl font-black leading-none sm:text-4xl">{toast.tone === "good" && toast.emoji !== "🏁" ? "✓ " : ""}{toast.big}</span>{toast.small && <span className="mt-1 block text-base font-black text-white/85 sm:text-lg">{toast.small}</span>}</span>
        </div>
      </div>}

      {/* how-to-steer hint */}
      {hint && phase === "run" && !paused && <div className="pointer-events-none absolute inset-x-0 flex justify-center px-4" style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <p className="rr-up rounded-2xl bg-black/55 px-4 py-2 text-center text-sm font-black backdrop-blur sm:text-base">{look ? "👀 Look left · middle · right to change lanes — look up (or click) to jump" : "👆 Swipe ← → to change lanes · swipe ↑ or tap the middle to jump"}</p>
      </div>}

      {paused && !end && <PauseMenu dwell={dwell} onHover={onHover} settings={settings} onResume={resume} onRestart={onReplay} onWorlds={onWorlds} onExit={onExit} onSettings={onSettings} />}
      {end && <Results end={end} mission={mission} index={index} dwell={dwell} onHover={onHover} onNext={onNext} onReplay={onReplay} onWorlds={onWorlds} />}
    </div>
  );
}

function Panel({ children, onClose, title, wide }: { children: ReactNode; onClose?: () => void; title?: string; wide?: boolean }) {
  return (
    <div data-runner-ui className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className={"rr-pop my-auto w-full rounded-[2rem] border border-white/15 bg-slate-950/95 p-5 shadow-2xl sm:p-6 " + (wide ? "max-w-xl" : "max-w-md")} onClick={e => e.stopPropagation()}>
        {title && <div className="mb-3 flex items-center gap-3"><h2 className="flex-1 text-2xl font-black sm:text-3xl">{title}</h2>{onClose && <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10" aria-label="Close"><X className="h-6 w-6" /></button>}</div>}
        {children}
      </div>
    </div>
  );
}

function PauseMenu({ dwell, onHover, settings, onResume, onRestart, onWorlds, onExit, onSettings }: { dwell: boolean; onHover: () => void; settings: RunnerSettings; onResume: () => void; onRestart: () => void; onWorlds: () => void; onExit: () => void; onSettings: (p: Partial<RunnerSettings>) => void }) {
  return (
    <Panel title="Paused">
      <div className="grid gap-2.5">
        <Dwell dwell={dwell} onHover={onHover} onSelect={onResume} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-amber-300 text-xl font-black text-amber-950"><Play className="h-6 w-6 fill-current" />Keep running</Dwell>
        <div className="grid grid-cols-2 gap-2.5">
          <Dwell dwell={dwell} onHover={onHover} onSelect={onRestart} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 font-black"><RotateCcw className="h-5 w-5" />Restart</Dwell>
          <Dwell dwell={dwell} onHover={onHover} onSelect={onWorlds} className="min-h-14 rounded-2xl bg-white/10 font-black">🌍 Worlds</Dwell>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Dwell dwell={dwell} onHover={onHover} onSelect={() => onSettings({ voice: !settings.voice })} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 font-black">{settings.voice ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}Voice {settings.voice ? "on" : "off"}</Dwell>
          <Dwell dwell={dwell} onHover={onHover} onSelect={() => onSettings({ steer: settings.steer === "look" ? "touch" : "look" })} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 font-black">{settings.steer === "look" ? <><Eye className="h-5 w-5" />Look</> : <><Hand className="h-5 w-5" />Swipe</>}</Dwell>
        </div>
        <label className="mt-1 flex items-center gap-3 text-sm font-black"><span className="w-16">Music</span><input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={e => onSettings({ music: +e.target.value })} className="h-8 flex-1 accent-amber-300" /></label>
        <label className="flex items-center gap-3 text-sm font-black"><span className="w-16">Sounds</span><input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={e => onSettings({ sfx: +e.target.value })} className="h-8 flex-1 accent-amber-300" /></label>
        <Dwell dwell={dwell} onHover={onHover} onSelect={onExit} className="mt-1 min-h-12 rounded-2xl bg-white/5 font-black text-white/80">Leave game</Dwell>
      </div>
    </Panel>
  );
}

function Results({ end, mission, index, dwell, onHover, onNext, onReplay, onWorlds }: { end: { r: RunResult; newBest: boolean; firstClear: boolean }; mission: Mission; index: number; dwell: boolean; onHover: () => void; onNext: () => void; onReplay: () => void; onWorlds: () => void }) {
  const { r } = end; const won = r.won;
  return (
    <div data-runner-ui className="absolute inset-0 z-20 grid place-items-center overflow-y-auto p-3 sm:p-4" style={{ background: won ? "radial-gradient(circle at 50% 30%, rgba(15,23,42,.2), rgba(15,23,42,.75))" : "rgba(15,23,42,.7)" }}>
      <div className="rr-pop my-auto w-full max-w-lg rounded-[2rem] border-2 border-white/25 bg-slate-950/90 p-5 text-center shadow-2xl backdrop-blur sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.3em] text-amber-200">World {index + 1} · {mission.look.name}</p>
        <h2 className="rr-title mt-1 text-5xl font-black italic sm:text-6xl">{won ? "World clear!" : "Great try!"}</h2>
        {won ? <div className="mt-4 flex justify-center gap-2">{[0, 1, 2].map(k => <div key={k} className="rr-pop grid h-20 w-20 place-items-center rounded-3xl bg-white/5" style={{ animationDelay: `${0.25 + k * 0.18}s` }}><Star className={"h-14 w-14 " + (k < r.stars ? "fill-yellow-300 text-yellow-300 drop-shadow-[0_0_14px_rgba(253,224,71,.8)]" : "text-white/20")} /></div>)}</div>
          : <p className="mt-3 text-lg font-bold text-white/80">You found {r.caught} of {r.goal} {mission.target.emoji}. Let's run it again!</p>}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat big={`${r.caught}/${r.goal}`} small={`${mission.target.emoji} found`} />
          <Stat big={String(r.wrong)} small="oops cards" />
          <Stat big={String(r.coins)} small="coins" />
          <Stat big={String(r.score)} small={end.newBest ? "⭐ new best" : "score"} hot={end.newBest} />
        </div>
        {won && r.stars < 3 && <p className="mt-3 text-sm font-bold text-white/70">{r.wrong > 0 ? `Tip: run only into the ${mission.target.label.toUpperCase()} cards for 3 stars.` : "Tip: dodge the trains and barriers for 3 stars."}</p>}
        <div className="mt-5 grid gap-2.5">
          {won && <Dwell dwell={dwell} onHover={onHover} onSelect={onNext} className="min-h-16 rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 text-xl font-black text-amber-950 shadow-xl">{index === MISSIONS.length - 1 ? "Back to World 1 ▶" : `Next world ${MISSIONS[(index + 1) % MISSIONS.length].look.badge} ▶`}</Dwell>}
          <div className="grid grid-cols-2 gap-2.5">
            <Dwell dwell={dwell} onHover={onHover} onSelect={onReplay} className={"flex min-h-14 items-center justify-center gap-2 rounded-2xl font-black " + (won ? "bg-white/10" : "bg-amber-300 text-amber-950")}><RotateCcw className="h-5 w-5" />{won ? "Play again" : "Try again"}</Dwell>
            <Dwell dwell={dwell} onHover={onHover} onSelect={onWorlds} className="min-h-14 rounded-2xl bg-white/10 font-black">🌍 Worlds</Dwell>
          </div>
        </div>
      </div>
    </div>
  );
}
function Stat({ big, small, hot }: { big: string; small: string; hot?: boolean }) {
  return <div className={"rounded-2xl py-3 " + (hot ? "bg-amber-300/20 ring-2 ring-amber-300/60" : "bg-white/5")}><div className="text-2xl font-black tabular-nums">{big}</div><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{small}</div></div>;
}

function Seg<T extends string | number | boolean>({ value, options, onPick, dwell, onHover }: { value: T; options: { v: T; label: ReactNode }[]; onPick: (v: T) => void; dwell: boolean; onHover: () => void }) {
  return <div className="grid gap-1.5 rounded-2xl bg-white/5 p-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
    {options.map(o => <Dwell key={String(o.v)} dwell={dwell} ms={900} onHover={onHover} onSelect={() => onPick(o.v)} className={"min-h-12 rounded-xl px-2 text-sm font-black " + (value === o.v ? "bg-amber-300 text-amber-950 shadow" : "text-white/80")}>{o.label}</Dwell>)}
  </div>;
}

function SettingsPanel({ settings: s, dwell, onHover, onChange, onClose }: { settings: RunnerSettings; dwell: boolean; onHover: () => void; onChange: (s: RunnerSettings) => void; onClose: () => void }) {
  const set = (p: Partial<RunnerSettings>) => onChange({ ...s, ...p });
  const a = s.assists[s.difficulty];
  const setA = (p: Partial<typeof a>) => onChange({ ...s, assists: { ...s.assists, [s.difficulty]: { ...a, ...p } } });
  const H = ({ children }: { children: ReactNode }) => <p className="mb-1.5 mt-4 text-xs font-black uppercase tracking-widest text-slate-400 first:mt-0">{children}</p>;
  return (
    <Panel title="Settings" onClose={onClose} wide>
      <div className="rr-scroll max-h-[70dvh] overflow-y-auto pr-1">
        <H>How to steer</H>
        <Seg dwell={dwell} onHover={onHover} value={s.steer} onPick={(v: Steer) => set({ steer: v })} options={[{ v: "look", label: <span className="flex items-center justify-center gap-1.5"><Eye className="h-4 w-4" />Look (eye gaze / mouse)</span> }, { v: "touch", label: <span className="flex items-center justify-center gap-1.5"><Hand className="h-4 w-4" />Swipe, tap & keys</span> }]} />
        {s.steer === "look" && <><H>Lane change wait</H><Seg dwell={dwell} onHover={onHover} value={s.laneDelay} onPick={(v: number) => set({ laneDelay: v })} options={[{ v: 120, label: "Quick" }, { v: 300, label: "Normal" }, { v: 600, label: "Steady" }]} /></>}
        <H>Speed</H>
        <Seg dwell={dwell} onHover={onHover} value={s.difficulty} onPick={(v: Difficulty) => set({ difficulty: v })} options={SPEEDS.map(x => ({ v: x.id, label: `${x.icon} ${x.name}` }))} />
        <H>Helpers for {SPEEDS.find(x => x.id === s.difficulty)!.name}</H>
        <div className="grid gap-1.5">
          {([["autoJump", "🦘 Auto-jump barriers"], ["autoDodge", "🚇 Auto-dodge trains"], ["guide", "✨ Glow & guide to the right card"]] as const).map(([k, label]) =>
            <Dwell key={k} dwell={dwell} ms={900} onHover={onHover} onSelect={() => setA({ [k]: !a[k] })} className={"flex min-h-12 items-center justify-between rounded-xl px-3 text-left text-sm font-black " + (a[k] ? "bg-emerald-500/25 ring-2 ring-emerald-400/60" : "bg-white/5")}>{label}<span className={"rounded-full px-2 py-0.5 text-xs " + (a[k] ? "bg-emerald-400 text-emerald-950" : "bg-white/10")}>{a[k] ? "ON" : "OFF"}</span></Dwell>)}
          <button type="button" onClick={() => onChange({ ...s, assists: { ...s.assists, [s.difficulty]: { ...DEFAULT_ASSISTS[s.difficulty] } } })} className="justify-self-start text-xs font-black text-slate-400 underline">Reset helpers</button>
        </div>
        <H>Cards show</H>
        <Seg dwell={dwell} onHover={onHover} value={s.cardStyle} onPick={(v: RunnerSettings["cardStyle"]) => set({ cardStyle: v })} options={[{ v: "both", label: "🐱 + CAT" }, { v: "words", label: "Words only" }, { v: "pictures", label: "Pictures only" }]} />
        <H>Menus</H>
        <Seg dwell={dwell} onHover={onHover} value={s.dwellMenus} onPick={(v: boolean) => set({ dwellMenus: v })} options={[{ v: true, label: "Look to press buttons" }, { v: false, label: "Tap / click only" }]} />
        <H>Sound</H>
        <Seg dwell={dwell} onHover={onHover} value={s.voice} onPick={(v: boolean) => set({ voice: v })} options={[{ v: true, label: "🗣️ Voice on" }, { v: false, label: "Voice off" }]} />
        <label className="mt-3 flex items-center gap-3 text-sm font-black"><span className="w-16">Music</span><input type="range" min={0} max={1} step={0.05} value={s.music} onChange={e => set({ music: +e.target.value })} className="h-8 flex-1 accent-amber-300" /></label>
        <label className="flex items-center gap-3 text-sm font-black"><span className="w-16">Sounds</span><input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={e => set({ sfx: +e.target.value })} className="h-8 flex-1 accent-amber-300" /></label>
        <H>Graphics</H>
        <Seg dwell={dwell} onHover={onHover} value={s.quality} onPick={(v: RunnerSettings["quality"]) => set({ quality: v })} options={[{ v: "low", label: "Low" }, { v: "medium", label: "Medium" }, { v: "high", label: "High" }]} />
        <p className="mt-1.5 text-xs font-bold text-slate-400">Choose Low if the game feels slow on this device.</p>
      </div>
      <Dwell dwell={dwell} onHover={onHover} onSelect={onClose} className="mt-4 min-h-14 w-full rounded-2xl bg-amber-300 text-lg font-black text-amber-950">Done</Dwell>
    </Panel>
  );
}

function HowTo({ steer, dwell, onHover, onClose }: { steer: Steer; dwell: boolean; onHover: () => void; onClose: () => void }) {
  const rows: [string, string, string][] = [
    ["🎯", "Find the word", "Run into the card that matches the mission — like 🐱 CAT. Skip the other cards."],
    [steer === "look" ? "👀" : "👆", "Change lanes", steer === "look" ? "Look at the left, middle or right of the screen." : "Swipe left or right, tap a side, or press ← →."],
    ["⤴️", "Jump", steer === "look" ? "Look up at the top of the screen, or click." : "Swipe up, tap the middle, or press Space / ↑."],
    ["🚇", "Trains", "Move to a free lane — or run up a yellow ramp and ride on the roof!"],
    ["🚧", "Barriers", "Jump over them. On Easy and Medium, Riley jumps for you."],
    ["🪙", "Coins", "Grab them for points. 🧲 pulls coins in, 🛡️ saves you from one bump."],
    ["⭐", "Stars", "Finish with no wrong cards for 3 stars."],
  ];
  return (
    <Panel title="How to play" onClose={onClose} wide>
      <div className="divide-y divide-white/10">{rows.map(([i, n, h]) => <div key={n} className="flex items-center gap-3 py-2.5"><span className="w-10 text-center text-3xl">{i}</span><div><p className="text-lg font-black">{n}</p><p className="text-sm font-bold text-slate-300">{h}</p></div></div>)}</div>
      <Dwell dwell={dwell} onHover={onHover} onSelect={onClose} className="mt-4 min-h-14 w-full rounded-2xl bg-amber-300 text-lg font-black text-amber-950">Got it!</Dwell>
    </Panel>
  );
}
