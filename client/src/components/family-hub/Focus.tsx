// Focus timer (a Plugin Gallery add-on, in LifeHub and WorkHub): work in focused blocks with short breaks (the
// Pomodoro method), with a soft chime at each switch and a count of focused minutes. In the Arise To Duo iPhone
// app each block and break also shows on the Lock Screen and in the Dynamic Island (lib/duoFocus.ts).
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, Smartphone, Timer } from "lucide-react";
import { addDaysTo } from "@shared/lifePlugins";
import { focusSupported, readFocus, startFocus, stopFocus } from "@/lib/duoFocus";
import { isNativeApp } from "@/lib/nativeApp";
import { PageHead, Panel, plain, primary, type SectionProps } from "./ui";

/** The Dynamic Island timer's id for these blocks (not a to-do's id, so its Done just ends the timer). */
export const FOCUS_BLOCK_ID = "focus-timer";

const PRESETS = [{ label: "25 / 5", work: 25, rest: 5 }, { label: "50 / 10", work: 50, rest: 10 }, { label: "15 / 3", work: 15, rest: 3 }];

function chime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.25 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 1.2); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.25); o.stop(ctx.currentTime + i * 0.25 + 1.3); });
    window.setTimeout(() => void ctx.close(), 2000);
  } catch { /* no sound here */ }
}

export type FocusLogEntry = { id: string; date: string; minutes: number };

/** LifeHub's Focus section. */
export default function Focus({ family, setFamily, today, makeId, say }: SectionProps) {
  return <FocusTimer log={family.focusLog} onFocused={(minutes) => setFamily((f) => ({ ...f, focusLog: [...f.focusLog, { id: makeId(), date: today, minutes }] }))} today={today} say={say} />;
}

/** The timer itself, for either hub: `log` is the focused blocks so far, `onFocused` adds one. */
export function FocusTimer({ log, onFocused, today, say }: { log: FocusLogEntry[]; onFocused: (minutes: number) => void; today: string; say: (text: string) => void }) {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [phase, setPhase] = useState<"work" | "rest">("work");
  const [left, setLeft] = useState(PRESETS[0].work * 60);
  const [running, setRunning] = useState(false);
  const [task, setTask] = useState("");
  const endAt = useRef(0);

  // Counts down from a fixed end time, so a phone that sleeps still lands on the right second.
  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const t = window.setInterval(() => setLeft(Math.max(0, Math.round((endAt.current - Date.now()) / 1000))), 250);
    return () => window.clearInterval(t);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running || left > 0) return;
    chime();
    if (phase === "work") {
      onFocused(preset.work);
      say(`Nice focus! Take a ${preset.rest}-minute break.`);
      setPhase("rest"); setLeft(preset.rest * 60);
    } else { say("Break's over. Ready for another round?"); setPhase("work"); setLeft(preset.work * 60); setRunning(false); }
    endAt.current = Date.now() + (phase === "work" ? preset.rest : preset.work) * 60_000;
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Dynamic Island and Lock Screen (iPhone app): follows the timer, a block or a break at a time.
  const island = focusSupported();
  const runningRef = useRef(running);
  runningRef.current = running;
  useEffect(() => {
    if (!island) return;
    if (!running) { void stopFocus(); return; }
    const isWork = phase === "work";
    void startFocus({ id: FOCUS_BLOCK_ID, title: isWork ? (task.trim() || "Focus") : "Break" }, Math.max(1, left) / 60, isWork ? "#7c6cf0" : "#10b981")
      .catch((e: any) => say(e?.message || "The Dynamic Island timer couldn't start."));
  }, [running, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // Stop or Done tapped on the island: the timer here pauses too (checked when the app comes back).
  useEffect(() => {
    if (!island) return;
    const back = () => { if (document.visibilityState !== "visible") return; void readFocus().then((f) => { if (!f || f.id !== FOCUS_BLOCK_ID) setRunning(false); }); };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [island]);
  // Leaving the page with nothing running leaves nothing on the island.
  useEffect(() => () => { if (island) void readFocus().then((f) => { if (f?.id === FOCUS_BLOCK_ID && !runningRef.current) void stopFocus(); }); }, [island]);

  const choose = (p: (typeof PRESETS)[number]) => { setPreset(p); setPhase("work"); setLeft(p.work * 60); setRunning(false); };
  const reset = () => { setRunning(false); setPhase("work"); setLeft(preset.work * 60); };
  const skip = () => { setRunning(false); const next = phase === "work" ? "rest" : "work"; setPhase(next); setLeft((next === "work" ? preset.work : preset.rest) * 60); };

  const total = (phase === "work" ? preset.work : preset.rest) * 60;
  const todayMin = log.filter((l) => l.date === today).reduce((s, l) => s + l.minutes, 0);
  const weekMin = log.filter((l) => l.date > addDaysTo(today, -7)).reduce((s, l) => s + l.minutes, 0);
  const r = 110, circ = 2 * Math.PI * r;

  return <div className="space-y-6">
    <PageHead eyebrow="Focus timer" title="One thing at a time" blurb="Work in focused blocks with short breaks between. A chime tells you when to switch." />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel>
        <div className="flex flex-col items-center py-4">
          <input value={task} onChange={(e) => setTask(e.target.value)} maxLength={80} placeholder="What are you working on?" className="mb-4 w-full max-w-sm border-b border-slate-200 bg-transparent py-2 text-center text-base font-bold outline-none focus:border-violet-400" aria-label="What you're working on" />
          <div className="relative h-64 w-64">
            <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90" aria-hidden><circle cx="120" cy="120" r={r} fill="none" stroke="#eef0f6" strokeWidth="12" /><circle cx="120" cy="120" r={r} fill="none" stroke={phase === "work" ? "#6e5ae0" : "#10b981"} strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - left / total)} style={{ transition: "stroke-dashoffset .3s linear" }} /></svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center"><p className={`text-xs font-black uppercase tracking-[.2em] ${phase === "work" ? "text-violet-600" : "text-emerald-600"}`}>{phase === "work" ? "Focus" : "Break"}</p><p className="text-5xl font-black tabular-nums tracking-tight" aria-live="off">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</p></div>
          </div>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setRunning((x) => !x)} className={primary + " px-6"}>{running ? <><Pause size={17} />Pause</> : <><Play size={17} />{left === total ? "Start" : "Resume"}</>}</button>
            <button type="button" onClick={skip} className={plain} aria-label="Skip to the next part"><SkipForward size={16} /></button>
            <button type="button" onClick={reset} className={plain} aria-label="Reset"><RotateCcw size={16} /></button>
          </div>
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title="Dynamic Island">{island
          ? <p className="flex items-start gap-2 text-sm text-slate-600"><Smartphone size={16} className="mt-0.5 shrink-0 text-violet-600" />Each focus block and break shows on your Lock Screen and in the Dynamic Island while it runs.</p>
          : <p className="flex items-start gap-2 text-sm text-slate-600"><Smartphone size={16} className="mt-0.5 shrink-0 text-slate-400" />{isNativeApp() ? "Update Arise To Duo to see the timer in the Dynamic Island." : "Open this in the Arise To Duo iPhone app to see the timer on your Lock Screen and in the Dynamic Island."}</p>}</Panel>
        <Panel title="Rhythm"><div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p.label} type="button" onClick={() => choose(p)} aria-pressed={preset.label === p.label} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${preset.label === p.label ? "bg-[#292446] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{p.label}</button>)}</div><p className="mt-2 text-xs text-slate-500">Minutes of focus / minutes of break.</p></Panel>
        <Panel title="Focused time"><div className="grid grid-cols-2 gap-2 text-center">{[["Today", todayMin], ["This week", weekMin]].map(([k, v]) => <div key={k} className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{v} min</p><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k}</p></div>)}</div>
          {!log.length && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Timer size={14} />Finish a focus block to start counting.</p>}</Panel>
      </div>
    </div>
  </div>;
}
