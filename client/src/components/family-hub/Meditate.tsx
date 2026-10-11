// Meditate (a Plugin Store add-on): guided breathing with a circle to follow, a quiet timer with
// a soft bell, and a log of minutes so a streak can grow.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Wind } from "lucide-react";
import { PageHead, Panel, plain, primary, type SectionProps } from "./ui";

type Phase = { label: "Breathe in" | "Hold" | "Breathe out"; secs: number };
const PATTERNS: { id: string; name: string; detail: string; phases: Phase[] }[] = [
  { id: "calm", name: "Calm breath", detail: "In for 5, out for 5. Easy and even.", phases: [{ label: "Breathe in", secs: 5 }, { label: "Breathe out", secs: 5 }] },
  { id: "box", name: "Box breathing", detail: "In, hold, out, hold: 4 each. Steadies you before something big.", phases: [{ label: "Breathe in", secs: 4 }, { label: "Hold", secs: 4 }, { label: "Breathe out", secs: 4 }, { label: "Hold", secs: 4 }] },
  { id: "478", name: "4-7-8 relax", detail: "In for 4, hold for 7, out for 8. Good for winding down at night.", phases: [{ label: "Breathe in", secs: 4 }, { label: "Hold", secs: 7 }, { label: "Breathe out", secs: 8 }] },
  { id: "quiet", name: "Quiet timer", detail: "No guide, just stillness and a bell at the end.", phases: [] },
];
const LENGTHS = [1, 3, 5, 10, 15, 20];

function bell() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [528, 792].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(i ? 0.08 : 0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4);
      osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 4.1);
    });
    window.setTimeout(() => void ctx.close(), 4500);
  } catch { /* no sound on this device */ }
}

const dayBefore = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

export default function Meditate({ family, setFamily, today, makeId, say }: SectionProps) {
  const [pattern, setPattern] = useState(PATTERNS[0]);
  const [minutes, setMinutes] = useState(5);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const tick = useRef<number | null>(null);
  const total = minutes * 60;

  useEffect(() => {
    if (!running) return;
    tick.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (tick.current) window.clearInterval(tick.current); };
  }, [running]);

  const log = (secs: number) => {
    const mins = Math.round(secs / 60);
    if (mins < 1) return;
    setFamily((f) => ({ ...f, meditations: [...f.meditations, { id: makeId(), date: today, minutes: mins, kind: pattern.id }] }));
  };
  useEffect(() => {
    if (!started || elapsed < total) return;
    setRunning(false); setStarted(false); setElapsed(0);
    bell(); log(total);
    say(`Well done: ${minutes} minute${minutes === 1 ? "" : "s"} of calm.`);
  }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { setElapsed(0); setStarted(true); setRunning(true); };
  const stop = () => { log(elapsed); setRunning(false); setStarted(false); setElapsed(0); };

  // Where in the breathing pattern we are.
  const cycle = pattern.phases.reduce((s, p) => s + p.secs, 0);
  let phase: Phase | null = null, phaseLeft = 0;
  if (cycle && started) {
    let t = elapsed % cycle;
    for (const p of pattern.phases) { if (t < p.secs) { phase = p; phaseLeft = p.secs - t; break; } t -= p.secs; }
  }
  const big = phase ? phase.label === "Breathe in" || (phase.label === "Hold" && pattern.phases[pattern.phases.indexOf(phase) - 1]?.label === "Breathe in") : started;
  const left = total - elapsed;

  const week = family.meditations.filter((m) => m.date > dayBefore(today, 7)).reduce((s, m) => s + m.minutes, 0);
  const days = new Set(family.meditations.map((m) => m.date));
  let streak = 0;
  for (let d = days.has(today) ? today : dayBefore(today, 1); days.has(d); d = dayBefore(d, 1)) streak++;

  return <div className="space-y-6">
    <PageHead eyebrow="Meditate" title="Take a breath" blurb="Follow the circle, or sit quietly until the bell. A few minutes a day adds up." />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="relative flex h-64 w-64 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-200 to-sky-200 opacity-70" style={{ transform: `scale(${big ? 1 : 0.55})`, transition: `transform ${phase ? phase.secs : 1.5}s ease-in-out` }} aria-hidden />
            <div className="relative">
              <p className="text-2xl font-black text-[#232139]" aria-live="polite">{started ? (phase ? phase.label : "Be still") : "Ready"}</p>
              {started && <p className="mt-1 text-sm font-bold tabular-nums text-violet-700">{phase ? phaseLeft : ""}</p>}
            </div>
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums tracking-tight">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</p>
          <div className="mt-5 flex gap-2">
            {!started && <button type="button" onClick={start} className={primary + " px-6"}><Play size={17} />Begin</button>}
            {started && <button type="button" onClick={() => setRunning((r) => !r)} className={plain}>{running ? <><Pause size={16} />Pause</> : <><Play size={16} />Resume</>}</button>}
            {started && <button type="button" onClick={stop} className={plain}><Square size={15} />End</button>}
          </div>
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title="Choose">
          <div className="space-y-2" role="radiogroup" aria-label="Kind of session">{PATTERNS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={pattern.id === p.id} disabled={started} onClick={() => setPattern(p)}
            className={`w-full rounded-2xl border p-3 text-left transition disabled:opacity-60 ${pattern.id === p.id ? "border-violet-300 bg-violet-50" : "border-slate-100 hover:bg-slate-50"}`}>
            <span className="block text-sm font-extrabold">{p.name}</span><span className="block text-xs text-slate-500">{p.detail}</span>
          </button>)}</div>
          <p className="mb-2 mt-4 text-xs font-bold text-slate-500">Minutes</p>
          <div className="flex flex-wrap gap-1.5">{LENGTHS.map((m) => <button key={m} type="button" disabled={started} onClick={() => setMinutes(m)} aria-pressed={minutes === m} className={`min-h-10 min-w-10 rounded-xl px-3 text-sm font-bold disabled:opacity-60 ${minutes === m ? "bg-[#292446] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{m}</button>)}</div>
        </Panel>
        <Panel title="Your practice">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Streak", `${streak} day${streak === 1 ? "" : "s"}`], ["This week", `${week} min`], ["Sessions", String(family.meditations.length)]].map(([k, v]) => <div key={k} className="rounded-2xl bg-slate-50 p-3"><p className="text-lg font-black">{v}</p><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k}</p></div>)}
          </div>
          {!family.meditations.length && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Wind size={14} />Finish a session to start your streak.</p>}
        </Panel>
      </div>
    </div>
  </div>;
}
