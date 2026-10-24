// The shared frame for the eye-gazer stage games: full-screen 3D host, top bar, speech bubble and settings.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, Settings, Volume2, VolumeX, X } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import type { Quality } from "@/game/stage/stage";
import { lookByDefault, restoreLook } from "@/lib/gazeDefaults";

export type StageSettings = { dwell: boolean; voice: boolean; quality: Quality; music: number; sfx: number };
const KEY = (uid: unknown) => `arise-eye-gaze-stage:settings:${uid ?? "guest"}`;
export function loadStageSettings(uid: unknown): StageSettings {
  // Look-to-press starts on for eye-gaze readers on any device, a tablet included (lib/gazeDefaults.ts).
  const d: StageSettings = { dwell: lookByDefault(), voice: true, quality: "medium", music: 0.35, sfx: 0.85 };
  try { const v = localStorage.getItem(KEY(uid)); return v ? restoreLook("stage", uid, { ...d, ...JSON.parse(v) } as StageSettings, { dwell: true }) : d; } catch { return d; }
}
export function useStageSettings(uid: unknown) {
  const [s, set] = useState<StageSettings>(() => loadStageSettings(uid));
  useEffect(() => { try { localStorage.setItem(KEY(uid), JSON.stringify(s)); } catch { /* private mode */ } }, [s, uid]);
  return [s, set] as const;
}

export const STAGE_CSS = `
.sg-font{font-family:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
.sg-title{text-shadow:0 3px 0 rgba(15,23,42,.55),0 10px 26px rgba(0,0,0,.35)}
.sg-pop{animation:sgPop .45s cubic-bezier(.2,1.6,.4,1) both}@keyframes sgPop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.sg-up{animation:sgUp .45s cubic-bezier(.2,1.2,.4,1) both}@keyframes sgUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
`;

export default function StageShell({ title, badge, accent = "#38bdf8", hostRef, onBack, settings, onSettings, bubble, progress, children, extraSettings }: {
  title: string; badge: string; accent?: string; hostRef: RefObject<HTMLDivElement | null>; onBack: () => void;
  settings: StageSettings; onSettings: (s: StageSettings) => void; bubble?: ReactNode; progress?: ReactNode; children?: ReactNode; extraSettings?: ReactNode;
}) {
  const [open, setOpen] = useState(false); const D = settings.dwell;
  const fsRef = useRef(false);
  useEffect(() => { try { const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }; if (!document.fullscreenElement && (el.requestFullscreen || el.webkitRequestFullscreen)) { void (el.requestFullscreen || el.webkitRequestFullscreen)!.call(el)?.catch?.(() => {}); fsRef.current = true; } } catch { /* optional */ } }, []);
  const back = () => { try { if (fsRef.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {}); } catch { /* optional */ } onBack(); };
  const opt = <T,>(label: string, value: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className="mt-3"><p className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
      <div className="grid gap-1.5 rounded-2xl bg-slate-100 p-1.5" style={{ gridTemplateColumns: `repeat(${opts.length},minmax(0,1fr))` }}>
        {opts.map(([v, l]) => <GazeButton key={String(v)} dwell={D} ms={900} onSelect={() => set(v)} className={"isolate min-h-11 rounded-xl text-sm font-black " + (value === v ? "text-white shadow" : "text-slate-700")}><span className="absolute inset-0 -z-10 rounded-xl" style={{ background: value === v ? accent : "transparent" }} />{l}</GazeButton>)}
      </div></div>);
  // touch-manipulation: quick taps (popping, answering) are taps, never the tablet's double-tap zoom.
  return (
    <main className="sg-font fixed inset-0 z-[120] h-[100dvh] touch-manipulation select-none overflow-hidden bg-slate-900 text-slate-950">
      <style>{STAGE_CSS}</style>
      <div ref={hostRef} className="absolute inset-0" />
      <header data-stage-ui className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-2 sm:p-3" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
        <GazeButton dwell={D} onSelect={back} className="pointer-events-auto flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-white/90 px-3 font-black shadow-lg backdrop-blur sm:px-4" label="Back to games"><ArrowLeft className="h-5 w-5" /><span className="hidden sm:inline">Games</span></GazeButton>
        <div className="pointer-events-auto mx-auto flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur">
          <span className="text-2xl">{badge}</span><h1 className="hidden truncate text-lg font-black sm:block">{title}</h1>{progress}
        </div>
        <GazeButton dwell={D} onSelect={() => onSettings({ ...settings, voice: !settings.voice })} className="pointer-events-auto hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/90 shadow-lg backdrop-blur sm:grid" label={settings.voice ? "Turn voice off" : "Turn voice on"}>{settings.voice ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</GazeButton>
        <GazeButton dwell={D} onSelect={() => setOpen(true)} className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/90 shadow-lg backdrop-blur" label="Settings"><Settings className="h-5 w-5" /></GazeButton>
      </header>
      {bubble && <div className="pointer-events-none absolute inset-x-0 top-[4.4rem] z-10 flex justify-center px-3 sm:top-20">{bubble}</div>}
      {children}
      {open && <div data-stage-ui className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
        <div className="sg-pop my-auto w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="mb-1 flex items-center"><h2 className="flex-1 text-2xl font-black">Settings</h2><button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
          {extraSettings}
          {opt<boolean>("Look to press", settings.dwell, v => onSettings({ ...settings, dwell: v }), [[true, "On"], [false, "Tap only"]])}
          {opt<boolean>("Voice", settings.voice, v => onSettings({ ...settings, voice: v }), [[true, "🗣️ On"], [false, "Off"]])}
          {opt<Quality>("Graphics", settings.quality, v => onSettings({ ...settings, quality: v }), [["low", "Low"], ["medium", "Medium"], ["high", "High"]])}
          <label className="mt-4 flex items-center gap-3 text-sm font-black"><span className="w-16">Music</span><input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={e => onSettings({ ...settings, music: +e.target.value })} className="h-8 flex-1" /></label>
          <label className="flex items-center gap-3 text-sm font-black"><span className="w-16">Sounds</span><input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={e => onSettings({ ...settings, sfx: +e.target.value })} className="h-8 flex-1" /></label>
          <GazeButton dwell={D} onSelect={() => setOpen(false)} className="isolate mt-4 min-h-14 w-full rounded-2xl text-lg font-black text-white"><span className="absolute inset-0 -z-10" style={{ background: accent }} />Done</GazeButton>
        </div>
      </div>}
    </main>
  );
}

/** A big friendly speech bubble. */
export function Bubble({ children, tone = "info", icon }: { children: ReactNode; tone?: "info" | "good" | "oops"; icon?: ReactNode }) {
  return <div className={"sg-pop flex max-w-xl items-center gap-3 rounded-[1.6rem] border-4 px-4 py-2.5 shadow-xl sm:px-5 " + (tone === "good" ? "border-white bg-emerald-500 text-white" : tone === "oops" ? "border-white bg-amber-100" : "border-white bg-white/95")}>
    {icon && <span className="shrink-0 text-3xl">{icon}</span>}<div className="min-w-0 text-lg font-black leading-snug sm:text-2xl">{children}</div>
  </div>;
}
