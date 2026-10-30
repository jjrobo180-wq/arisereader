// Plays a list of timed steps — work, rest, a stretch, a pose — with a big countdown, beeps on the
// last three seconds, the step's name spoken aloud, and the screen kept on. Used by the interval
// timer, workouts, stretching, yoga, Couch to 5K, the toothbrush timer and more.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, X, Volume2, VolumeX } from "lucide-react";
import { beep, chime, fmtDuration, speak, useTick, useWakeLock, vibrate } from "./kit";
import { stopAiVoice } from "@/lib/aiVoice";

export type Step = { label: string; sec: number; kind?: "work" | "rest" | "prep" | "cool"; note?: string; color?: string; say?: string };
const KIND_COLOR = { work: "#ea580c", rest: "#0ea5e9", prep: "#64748b", cool: "#16a34a" };

export function SequencePlayer({ steps, title, onDone, onClose, color = "#ea580c", voice = true, kid }: { steps: Step[]; title: string; onDone?: (seconds: number) => void; onClose: () => void; color?: string; voice?: boolean; kid?: boolean }) {
  const [i, setI] = useState(0);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [talk, setTalk] = useState(voice);
  const [done, setDone] = useState(false);
  const started = useRef(Date.now());
  const lastBeep = useRef(-1);
  useWakeLock(!done);
  useTick(endAt !== null && pausedLeft === null && !done, 100);
  const step = steps[i];
  const left = done ? 0 : pausedLeft !== null ? pausedLeft : endAt !== null ? Math.max(0, endAt - Date.now()) : (step?.sec || 0) * 1000;
  const begin = (k: number) => {
    const s = steps[k]; if (!s) return;
    setI(k); setPausedLeft(null); setEndAt(Date.now() + s.sec * 1000); lastBeep.current = -1;
    if (talk) speak(s.say || s.label); else beep(s.kind === "rest" ? 520 : 880, 220);
    vibrate(80);
  };
  useEffect(() => { begin(0); started.current = Date.now(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (done || endAt === null || pausedLeft !== null) return;
    const sec = Math.ceil(left / 1000);
    if (sec <= 3 && sec >= 1 && lastBeep.current !== sec && step.sec > 5) { lastBeep.current = sec; beep(660, 120, 0.2); }
    if (left <= 0) {
      if (i + 1 < steps.length) begin(i + 1);
      else { setDone(true); setEndAt(null); chime(); if (talk) speak(kid ? "All done! Great job!" : "Done. Great work!"); onDone?.(Math.round((Date.now() - started.current) / 1000)); }
    }
  });
  const total = steps.reduce((a, s) => a + s.sec, 0);
  const elapsed = steps.slice(0, i).reduce((a, s) => a + s.sec, 0) + (step ? step.sec - left / 1000 : 0);
  const c = step?.color || (step?.kind ? KIND_COLOR[step.kind] : color);
  const frac = step ? 1 - left / 1000 / step.sec : 1;
  const R = 130, C = 2 * Math.PI * R;
  const pause = () => { if (pausedLeft === null && endAt !== null) { setPausedLeft(Math.max(0, endAt - Date.now())); } else if (pausedLeft !== null) { setEndAt(Date.now() + pausedLeft); setPausedLeft(null); } };
  return <div className="fixed inset-0 z-[1400] flex flex-col items-center justify-between overflow-auto p-4 text-white transition-colors sm:p-8" style={{ background: done ? "#0f172a" : `linear-gradient(160deg, ${c}, ${c}cc 60%, #0f172a)` }}>
    <div className="flex w-full max-w-3xl items-center justify-between">
      <p className="text-sm font-bold opacity-80">{title}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setTalk(!talk)} aria-label={talk ? "Mute voice" : "Voice on"} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">{talk ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <button type="button" onClick={() => { stopAiVoice(); onClose(); }} aria-label="Stop" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><X size={20} /></button>
      </div>
    </div>
    {done ? <div className="text-center">
      <p className="text-6xl">🎉</p><p className="mt-3 text-3xl font-black">{kid ? "All done!" : "Finished!"}</p>
      <p className="mt-1 text-lg opacity-80">{fmtDuration(total)} · {steps.length} steps</p>
      <button type="button" onClick={onClose} className="mt-6 rounded-full bg-white px-6 py-3 text-base font-black text-slate-900">Close</button>
    </div> : <div className="flex flex-col items-center text-center">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] opacity-80">Step {i + 1} of {steps.length}{step?.kind ? ` · ${step.kind === "work" ? "Go" : step.kind === "rest" ? "Rest" : step.kind === "prep" ? "Get ready" : "Cool down"}` : ""}</p>
      <div className="relative" style={{ width: R * 2 + 24, height: R * 2 + 24 }}>
        <svg width={R * 2 + 24} height={R * 2 + 24} className="-rotate-90"><circle cx={R + 12} cy={R + 12} r={R} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="14" /><circle cx={R + 12} cy={R + 12} r={R} fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * frac} /></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-7xl font-black tabular-nums">{fmtDuration(Math.ceil(left / 1000))}</span>{pausedLeft !== null && <span className="text-sm font-bold opacity-80">Paused</span>}</div>
      </div>
      <p className="mt-4 max-w-xl text-3xl font-black sm:text-4xl">{step?.label}</p>
      {step?.note && <p className="mt-2 max-w-xl text-base opacity-90">{step.note}</p>}
      {steps[i + 1] && <p className="mt-4 text-sm font-semibold opacity-75">Next: {steps[i + 1].label} ({fmtDuration(steps[i + 1].sec)})</p>}
    </div>}
    {!done && <div className="w-full max-w-3xl">
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} /></div>
      <div className="flex items-center justify-center gap-4">
        <button type="button" onClick={() => begin(Math.max(0, i - 1))} aria-label="Previous step" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><SkipBack size={22} /></button>
        <button type="button" onClick={pause} aria-label={pausedLeft !== null ? "Resume" : "Pause"} className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl">{pausedLeft !== null ? <Play size={32} /> : <Pause size={32} />}</button>
        <button type="button" onClick={() => (i + 1 < steps.length ? begin(i + 1) : setEndAt(Date.now()))} aria-label="Next step" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><SkipForward size={22} /></button>
      </div>
      <p className="mt-3 text-center text-xs opacity-70">{fmtDuration(elapsed)} of {fmtDuration(total)}</p>
    </div>}
  </div>;
}
