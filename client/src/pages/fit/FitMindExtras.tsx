// Extras for Yoga and Breathe/Meditation: follow-along video classes (opened on YouTube), a quiet timer and a
// tap counter for people who just want to count breaths, mantras or rounds. Everything here draws on a solid
// full-screen background so it is always easy to read.
import { useEffect, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, RotateCcw, Video, X } from "lucide-react";
import { dayKey, uid, type FitData } from "@shared/fit";
import { Btn, C, Layer, Title, display, fmtDur, font, glowBg, haptic } from "./fitUi";
import type { Update } from "./fitStore";

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

type Clip = { title: string; sub: string; q: string };
const YOGA_CLIPS: Clip[] = [
  { title: "Yoga for beginners", sub: "20 to 30 minutes · slow and clear", q: "yoga for complete beginners 20 minute" },
  { title: "Morning flow", sub: "10 minutes · wake up your body", q: "10 minute morning yoga flow" },
  { title: "Yoga for lifters", sub: "Hips, hamstrings and shoulders", q: "yoga for lifters recovery stretch" },
  { title: "Back & neck relief", sub: "Gentle · good for desk days", q: "yoga for back pain neck relief 15 minutes" },
  { title: "Power yoga", sub: "30 minutes · build strength and heat", q: "power yoga full body 30 minutes" },
  { title: "Bedtime yoga", sub: "Wind down before sleep", q: "bedtime yoga relaxing before sleep" },
];
const MIND_CLIPS: Clip[] = [
  { title: "Guided meditation", sub: "10 minutes · calm and focus", q: "10 minute guided meditation" },
  { title: "Breathwork", sub: "Box breathing and 4-7-8, guided", q: "guided breathwork box breathing 4-7-8" },
  { title: "Body scan", sub: "Release tension head to toe", q: "body scan meditation 15 minutes" },
  { title: "Anxiety & stress", sub: "Settle a busy mind", q: "guided meditation for anxiety and stress" },
  { title: "Sleep meditation", sub: "Fall asleep faster", q: "guided sleep meditation" },
  { title: "Yoga nidra", sub: "Deep rest, lying down", q: "yoga nidra 20 minutes" },
];

/** Follow-along classes: each opens YouTube's results for it, so there are always fresh videos to pick from. */
export function FollowAlong({ kind }: { kind: "yoga" | "mind" }) {
  const clips = kind === "yoga" ? YOGA_CLIPS : MIND_CLIPS;
  return <>
    <Title>{kind === "yoga" ? "Yoga videos" : "Meditation videos"}</Title>
    <div className="grid grid-cols-2 gap-2" data-testid={`fit-${kind}-videos`}>
      {clips.map((c, i) => <a key={c.title} href={yt(c.q)} target="_blank" rel="noopener noreferrer" onClick={() => haptic("light")}
        className="fit-in flex min-h-[92px] flex-col justify-between rounded-[14px] p-3 active:scale-[.98]" style={{ background: C.card, color: C.text, animationDelay: `${i * 30}ms`, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: C.card2 }}><Video className="h-3.5 w-3.5" style={{ color: C.lime }} /></span>
        <span><span className="block text-[15px] font-semibold leading-tight">{c.title}</span><span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: C.dim }}>{c.sub}</span></span>
      </a>)}
    </div>
    <p className="mt-2 px-1 text-[11.5px]" style={{ color: C.dim }}>Videos open on YouTube and belong to their creators.</p>
  </>;
}

/** A card that opens the counter / quiet timer. */
export function CounterCard({ kind, onOpen }: { kind: "yoga" | "mind"; onOpen: () => void }) {
  return <button type="button" onClick={() => { haptic("light"); onOpen(); }} className="mt-4 flex w-full items-center gap-3 rounded-[14px] p-3.5 text-left active:scale-[.985]" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }} data-testid={`fit-${kind}-counter`}>
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: C.lime, color: "var(--fit-on-accent)" }}><Plus className="h-5 w-5" /></span>
    <span className="min-w-0 flex-1"><span className="block text-[17px] font-semibold leading-tight">{kind === "yoga" ? "Just a timer or counter" : "Counter & quiet timer"}</span>
      <span className="block text-[12.5px] leading-snug" style={{ color: C.dim }}>{kind === "yoga" ? "Count breaths or rounds, or hold a pose with a timer." : "Tap to count breaths or mantras, or sit in silence with a bell."}</span></span>
  </button>;
}

let ctx: AudioContext | null = null;
function bell() {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;
    for (const [f, g] of [[528, 0.12], [1056, 0.04]] as const) {
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(a); a.connect(ctx.destination); o.start(t); o.stop(t + 3.3);
    }
  } catch { /* no sound */ }
}

/** Tap counter and quiet timer, full screen on a solid background. */
export function CounterScreen({ kind, update, say, onClose }: { kind: "yoga" | "mind"; update: Update; say: (m: string) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"count" | "timer">("count");
  const [n, setN] = useState(0);
  const [target, setTarget] = useState<number>(kind === "mind" ? 108 : 10);
  const [mins, setMins] = useState(10);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(mins * 60);
  const endAt = useRef(0);
  const started = useRef(Date.now());
  const done = mode === "timer" && left <= 0;

  useEffect(() => {
    let lock: any = null;
    (navigator as any).wakeLock?.request?.("screen").then((l: any) => { lock = l; }).catch(() => {});
    return () => { try { lock?.release?.(); } catch { /* gone */ } };
  }, []);
  useEffect(() => { if (!running) setLeft(mins * 60); }, [mins]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) { setRunning(false); bell(); haptic("success"); }
    }, 250);
    return () => window.clearInterval(t);
  }, [running]);

  const tap = () => { setN((x) => { const v = x + 1; if (target && v === target) { bell(); haptic("success"); } else haptic("light"); return v; }); };
  const toggle = () => { if (running) { setRunning(false); return; } endAt.current = Date.now() + left * 1000; setRunning(true); if (left === mins * 60) bell(); };
  const reset = () => { setRunning(false); setN(0); setLeft(mins * 60); };
  const save = () => {
    const secs = mode === "timer" ? Math.max(0, mins * 60 - left) : Math.round((Date.now() - started.current) / 1000);
    if (secs < 30) { say("Nothing to save yet."); return; }
    const cat = kind === "yoga" ? "yoga" : "meditation";
    update((d: FitData) => ({ ...d, workouts: [...d.workouts, { id: uid(), date: new Date().toISOString(), name: mode === "count" ? `${kind === "yoga" ? "Yoga" : "Meditation"} · ${n} counted` : `${kind === "yoga" ? "Yoga" : "Meditation"} timer`, programId: `session-${cat}`, dayId: `counter-${dayKey()}`, secs, exercises: [] }] }));
    haptic("success"); say("Saved to your history."); onClose();
  };
  const pct = mode === "count" ? (target ? Math.min(1, n / target) : 0) : 1 - left / (mins * 60);
  const R = 118, L = 2 * Math.PI * R;
  return <Layer><div className="fixed inset-0 z-[95] flex flex-col" style={{ backgroundColor: C.bg, backgroundImage: glowBg, color: C.text, ...font }} role="dialog" aria-modal="true" aria-label="Counter and timer" data-testid="fit-counter">
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><X className="h-5 w-5" /></button>
      <div className="flex flex-1 justify-center"><div className="flex rounded-full p-0.5" style={{ background: C.card2 }}>{([["count", "Counter"], ["timer", "Timer"]] as const).map(([id, l]) =>
        <button key={id} type="button" onClick={() => { setMode(id); setRunning(false); }} aria-pressed={mode === id} className="h-9 rounded-full px-5 text-[14px] font-semibold" style={mode === id ? { background: C.lime, color: "var(--fit-on-accent)" } : { color: C.dim }}>{l}</button>)}</div></div>
      <button type="button" onClick={save} className="h-11 rounded-full px-4 text-[14px] font-semibold" style={{ background: C.card }}>Save</button>
    </div>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
      <button type="button" onClick={mode === "count" ? tap : toggle} aria-label={mode === "count" ? "Count one" : running ? "Pause" : "Start"} className="relative grid h-72 w-72 place-items-center rounded-full active:scale-[.98]" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        <svg className="absolute inset-0" viewBox="0 0 260 260" aria-hidden><circle cx="130" cy="130" r={R} fill="none" strokeWidth="8" style={{ stroke: C.track }} />
          <circle cx="130" cy="130" r={R} fill="none" strokeWidth="8" strokeLinecap="round" transform="rotate(-90 130 130)" strokeDasharray={L} strokeDashoffset={L * (1 - pct)} style={{ stroke: C.lime, transition: "stroke-dashoffset .3s" }} /></svg>
        <span className="relative text-center">
          <span className="block text-[84px] leading-none tabular-nums" style={display}>{mode === "count" ? n : fmtDur(left)}</span>
          <span className="mt-1 block text-[13px] uppercase tracking-[.14em]" style={{ color: C.dim }}>{mode === "count" ? (target ? `of ${target}` : "tap to count") : done ? "Complete" : running ? "Tap to pause" : "Tap to start"}</span>
        </span>
      </button>
      {mode === "count" ? <>
        <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Goal">{[0, 10, 21, 54, 108].map((t) => <button key={t} type="button" onClick={() => setTarget(t)} aria-pressed={target === t} className="h-10 rounded-full px-4 text-[14px] font-semibold" style={target === t ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card, color: C.text }}>{t === 0 ? "No goal" : t}</button>)}</div>
        <div className="mt-5 flex items-center gap-4"><button type="button" onClick={() => setN((x) => Math.max(0, x - 1))} aria-label="Subtract one" className="grid h-12 w-12 place-items-center rounded-full" style={{ background: C.card }}><Minus className="h-5 w-5" /></button>
          <button type="button" onClick={reset} aria-label="Reset" className="grid h-12 w-12 place-items-center rounded-full" style={{ background: C.card }}><RotateCcw className="h-5 w-5" /></button></div>
      </> : <>
        <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Minutes">{[1, 3, 5, 10, 15, 20, 30].map((m) => <button key={m} type="button" disabled={running} onClick={() => setMins(m)} aria-pressed={mins === m} className="h-10 rounded-full px-4 text-[14px] font-semibold disabled:opacity-50" style={mins === m ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card, color: C.text }}>{m} min</button>)}</div>
        <div className="mt-5 flex items-center gap-4"><Btn onClick={toggle} className="!px-8">{running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" fill="currentColor" />}{running ? "Pause" : left < mins * 60 && left > 0 ? "Resume" : "Start"}</Btn>
          <button type="button" onClick={reset} aria-label="Reset" className="grid h-12 w-12 place-items-center rounded-full" style={{ background: C.card }}><RotateCcw className="h-5 w-5" /></button></div>
      </>}
    </div>
    <div className="shrink-0 px-6 pb-[max(20px,env(safe-area-inset-bottom))] text-center text-[12px]" style={{ color: C.dim }}>Saved sessions show up in your history and count toward your streak.</div>
  </div></Layer>;
}

