// Arise LifeHub · Sleep: the full-screen moments. The reading screen, the breathing screen,
// Lights out, and the now-playing dock with the sleep timer. None of them ever shows a clock:
// knowing the time at night only starts the "how many hours are left" math.
import { useEffect, useRef, useState } from "react";
import { Moon, Pause, Play, SkipBack, SkipForward, Square, Timer, X } from "lucide-react";
import { SOUNDS, TIMER_CHOICES_LABELS, breathCycleSecs, type BreathPattern, type BreathStep } from "@shared/sleepContent";
import { displayRef } from "@shared/sleepScripts";
import { narrator } from "./narrator";
import { sleepSounds } from "./soundEngine";
import { useMinutesLeft, useNarrator, useReducedMotion, useSounds } from "./hooks";
import { useSleep } from "./context";
import { Choices, Sheet } from "./parts";

const timerWords = (min: number | null) => (min === null ? "No sleep timer" : min <= 1 ? "Fading out now" : `Fades out in ${min} min`);

// ── Reading ──────────────────────────────────────────────────────────────────

export function ReadStage({ onClose, onLightsOut }: { onClose: () => void; onLightsOut: () => void }) {
  const { app } = useSleep();
  const v = useNarrator();
  const sounds = useSounds();
  const left = useMinutesLeft(sounds.timerEnd);
  const [finished, setFinished] = useState(false);
  const played = useRef(false);
  useEffect(() => {
    if (v.state !== "idle") { played.current = true; setFinished(false); }
    else if (played.current) setFinished(true);
  }, [v.state]);
  const close = () => { narrator.stop(); onClose(); };
  const progress = v.total ? Math.round(((v.index + 1) / v.total) * 100) : 0;
  return <div className="sl-stage" role="dialog" aria-modal="true" aria-label={v.title || "Reading"}>
    <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
      <button type="button" onClick={close} className="sl-btn sl-ghost sl-icon -ml-2" aria-label="Stop reading and close"><X size={22} aria-hidden /></button>
      <p className="sl-small min-w-0 truncate text-center text-[var(--sl-faint)]">{v.title}</p>
      <button type="button" onClick={onLightsOut} className="sl-btn sl-quiet"><Moon size={16} aria-hidden /> Lights out</button>
    </div>
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-6">
      {finished
        ? <div>
            <p className="sl-display">That's the end.</p>
            <p className="mt-4 max-w-md text-[1.0625rem]">Stay right here, eyes closed, for as long as you like. There's nothing else you need to do.</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <button type="button" onClick={onLightsOut} className="sl-btn sl-primary"><Moon size={16} aria-hidden /> Lights out</button>
              <button type="button" onClick={onClose} className="sl-btn sl-quiet">Close</button>
            </div>
          </div>
        : app.settings.showWords && v.line
          ? <p key={v.index} className="sl-read !text-[1.375rem] !leading-[1.7] sm:!text-[1.6rem]" aria-live="polite">{v.line}</p>
          : <p className="sl-read !text-[1.375rem] !text-[var(--sl-faint)]">{v.state === "loading" ? "Getting the voice ready…" : "Close your eyes and listen."}</p>}
    </div>
    {!finished && <div className="mx-auto w-full max-w-3xl">
      <div className="h-[3px] overflow-hidden rounded-full bg-[var(--sl-veil)]" aria-hidden><div className="h-full bg-[var(--sl-ember)] transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" onClick={() => narrator.skip(-1)} className="sl-btn sl-ghost sl-icon" aria-label="Back one sentence"><SkipBack size={20} aria-hidden /></button>
        {v.state === "paused"
          ? <button type="button" onClick={() => narrator.resume()} className="sl-btn sl-primary h-14 w-14 !p-0" aria-label="Keep reading"><Play size={24} aria-hidden /></button>
          : <button type="button" onClick={() => narrator.pause()} className="sl-btn sl-primary h-14 w-14 !p-0" aria-label="Pause"><Pause size={24} aria-hidden /></button>}
        <button type="button" onClick={() => narrator.skip(1)} className="sl-btn sl-ghost sl-icon" aria-label="Skip one sentence"><SkipForward size={20} aria-hidden /></button>
      </div>
      <p className="sl-small mt-3 text-center text-[var(--sl-faint)]">{timerWords(left)}{v.device ? ". Reading with your phone's voice." : ""}</p>
    </div>}
  </div>;
}

// ── Breathing ────────────────────────────────────────────────────────────────

export type BreathMode = { kind: "pattern"; pattern: BreathPattern } | { kind: "count" } | { kind: "the" };
const COUNT_STEPS: BreathStep[] = [{ kind: "in", secs: 4 }, { kind: "out", secs: 6 }];
const THE_STEPS: BreathStep[] = [{ kind: "in", secs: 1 }, { kind: "out", secs: 1 }];

function speakCue(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.8; u.pitch = 0.95; u.volume = 0.8;
    window.speechSynthesis.speak(u);
  } catch { /* no phone voice */ }
}

export function BreathStage({ mode, minutes, onClose, onLightsOut }: { mode: BreathMode; minutes: number; onClose: () => void; onLightsOut: () => void }) {
  const { app } = useSleep();
  const reduced = useReducedMotion();
  const steps = mode.kind === "pattern" ? mode.pattern.steps : mode.kind === "count" ? COUNT_STEPS : THE_STEPS;
  const prayer = mode.kind === "pattern" ? mode.pattern.prayer : undefined;
  const [at, setAt] = useState(0);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const [paused, setPaused] = useState(false);
  // The orb starts small and grows with the first breath in, rather than appearing full size.
  const [ready, setReady] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r); }, []);
  const elapsed = useRef(0);
  const step = steps[at % steps.length];

  useEffect(() => {
    if (done || paused) return;
    const cue = app.settings.breathCue;
    // Counting goes 1 to 10 on each breath out, then starts over at 1.
    const next = mode.kind === "count" && step.kind === "out" ? (count % 10) + 1 : count;
    if (next !== count) setCount(next);
    if (mode.kind !== "the") {
      if (cue === "chime") sleepSounds.chime(step.kind === "in2" ? "in" : step.kind);
      else if (cue === "voice") speakCue(label(step, prayer, mode, next));
    }
    const t = setTimeout(() => {
      elapsed.current += step.secs;
      const endOfBreath = (at % steps.length) === steps.length - 1;
      if (minutes && endOfBreath && elapsed.current >= minutes * 60) { setDone(true); if (cue !== "none") sleepSounds.chime("end"); return; }
      setAt((i) => i + 1);
    }, step.secs * 1000);
    return () => clearTimeout(t);
  }, [at, paused, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const big = step.kind === "in" ? 1 : step.kind === "in2" ? 1.12 : step.kind === "out" ? 0.55 : (steps[(at - 1 + steps.length) % steps.length].kind === "out" ? 0.55 : 1);
  const words = mode.kind === "the" ? "the" : label(step, prayer, mode, count);
  const total = breathCycleSecs({ steps });
  return <div className="sl-stage items-center" role="dialog" aria-modal="true" aria-label="Breathing">
    <div className="flex w-full max-w-3xl items-center justify-between gap-3">
      <button type="button" onClick={onClose} className="sl-btn sl-ghost sl-icon -ml-2" aria-label="Stop and close"><X size={22} aria-hidden /></button>
      <p className="sl-small text-[var(--sl-faint)]">{mode.kind === "pattern" ? mode.pattern.name : mode.kind === "count" ? "Count breaths to ten" : "The word “the”"}</p>
      <button type="button" onClick={onLightsOut} className="sl-btn sl-quiet"><Moon size={16} aria-hidden /> Lights out</button>
    </div>
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      {done
        ? <div className="max-w-md text-center">
            <p className="sl-display">Well done.</p>
            <p className="mt-4">Let your breathing go back to its own rhythm. Stay here as long as you like.</p>
            <div className="mt-7 flex justify-center gap-2">
              <button type="button" onClick={onLightsOut} className="sl-btn sl-primary"><Moon size={16} aria-hidden /> Lights out</button>
              <button type="button" onClick={onClose} className="sl-btn sl-quiet">Close</button>
            </div>
          </div>
        : <>
            <div className="relative flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80" aria-hidden>
              <div className="sl-orb absolute inset-0" style={{ transform: `scale(${reduced ? 0.8 : ready ? big : 0.55})`, opacity: reduced ? (big > 0.8 ? 1 : 0.55) : 1, transition: `transform ${step.secs}s ease-in-out, opacity ${step.secs}s ease-in-out` }} />
            </div>
            <p className="sl-title mt-8 min-h-[2.5em] max-w-sm text-center" aria-live="polite">{words}</p>
            {prayer && <p className="sl-small mt-1 text-[var(--sl-faint)]">{displayRef(prayer.ref)}</p>}
            {mode.kind === "the" && <p className="sl-small mt-2 max-w-xs text-center text-[var(--sl-faint)]">Silently say "the" each time it glows. Nothing else to think about.</p>}
          </>}
    </div>
    {!done && <div className="flex items-center gap-2">
      <button type="button" onClick={() => setPaused((p) => !p)} className="sl-btn sl-quiet">{paused ? <><Play size={16} aria-hidden /> Keep going</> : <><Pause size={16} aria-hidden /> Pause</>}</button>
      <p className="sl-small text-[var(--sl-faint)]">{minutes ? `${minutes} minutes` : "Until you stop"}, {Math.round(60 / total)} breaths a minute</p>
    </div>}
  </div>;
}

function label(step: BreathStep, prayer: BreathPattern["prayer"], mode: BreathMode, count: number) {
  if (mode.kind === "count") return step.kind === "out" ? String(Math.max(1, count)) : "Breathe in";
  if (step.kind === "in") return prayer ? prayer.in : "Breathe in";
  if (step.kind === "in2") return "A little more";
  if (step.kind === "hold") return "Hold";
  return prayer ? prayer.out : "Breathe out";
}

// ── Lights out ───────────────────────────────────────────────────────────────

export function LightsOut({ onExit }: { onExit: () => void }) {
  const v = useNarrator();
  const sounds = useSounds();
  const left = useMinutesLeft(sounds.timerEnd);
  const [controls, setControls] = useState(false);
  useEffect(() => {
    if (!controls) return;
    const t = setTimeout(() => setControls(false), 7000);
    return () => clearTimeout(t);
  }, [controls]);
  const stopAll = () => { narrator.stop(); sleepSounds.stopAll(); sleepSounds.clearTimer(); onExit(); };
  return <div className="sl-lights-out" role="dialog" aria-modal="true" aria-label="Lights out. Tap to show controls." onClick={() => setControls((c) => !c)}>
    <div className="flex h-full w-full items-center justify-center"><div className="sl-ember" aria-hidden /></div>
    {controls && <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
      <p className="sl-small text-[#7a6a62]">{v.state !== "idle" ? v.title : sounds.playing ? "Sounds playing" : "Nothing playing"}. {timerWords(left)}.</p>
      <div className="flex flex-wrap justify-center gap-2">
        {v.state === "playing" && <button type="button" onClick={() => narrator.pause()} className="sl-btn border border-[#3a2a22] text-[#b08f72]"><Pause size={16} aria-hidden /> Pause</button>}
        {v.state === "paused" && <button type="button" onClick={() => narrator.resume()} className="sl-btn border border-[#3a2a22] text-[#b08f72]"><Play size={16} aria-hidden /> Keep reading</button>}
        <button type="button" onClick={onExit} className="sl-btn border border-[#3a2a22] text-[#b08f72]">Lights on</button>
        <button type="button" onClick={stopAll} className="sl-btn border border-[#3a2a22] text-[#b08f72]"><Square size={14} aria-hidden /> Stop everything</button>
      </div>
    </div>}
  </div>;
}

// ── Now playing ──────────────────────────────────────────────────────────────

export function Dock({ onOpenReading, onLightsOut }: { onOpenReading: () => void; onLightsOut: () => void }) {
  const { app, update } = useSleep();
  const v = useNarrator();
  const sounds = useSounds();
  const left = useMinutesLeft(sounds.timerEnd);
  const [picking, setPicking] = useState(false);
  const names = SOUNDS.filter((s) => sounds.levels[s.id]).map((s) => s.name);
  const what = [v.state !== "idle" ? v.title : "", names.length > 2 ? `${names.slice(0, 2).join(", ")} and more` : names.join(" and ")].filter(Boolean).join(", with ");
  const stop = () => { narrator.stop(); sleepSounds.stopAll(); sleepSounds.clearTimer(); };
  return <>
    <div className="sl-dock sl-sheet flex items-center gap-2 p-2 pl-4 shadow-[0_18px_40px_rgba(0,0,0,0.55)]" role="region" aria-label="Now playing">
      <span className="sl-ember shrink-0" style={{ width: 10, height: 10, background: "var(--sl-ember)" }} aria-hidden />
      <button type="button" onClick={v.state !== "idle" ? onOpenReading : () => setPicking(true)} className="min-w-0 flex-1 py-1 text-left">
        <span className="block truncate text-[0.9375rem] font-semibold text-[var(--sl-parchment)]">{what}</span>
        <span className="sl-small block text-[var(--sl-faint)]">{timerWords(left)}</span>
      </button>
      <button type="button" onClick={() => setPicking(true)} className="sl-btn sl-ghost sl-icon" aria-label="Sleep timer"><Timer size={18} aria-hidden /></button>
      <button type="button" onClick={onLightsOut} className="sl-btn sl-ghost sl-icon" aria-label="Lights out"><Moon size={18} aria-hidden /></button>
      <button type="button" onClick={stop} className="sl-btn sl-ghost sl-icon" aria-label="Stop everything"><Square size={16} aria-hidden /></button>
    </div>
    {picking && <Sheet title="Sleep timer" onClose={() => setPicking(false)}>
      <p className="mb-4">Sounds fade out slowly over the last few minutes, and reading stops. Your choice is remembered for next time.</p>
      <Choices label="Sleep timer" value={left === null ? 0 : app.settings.timer} options={TIMER_CHOICES_LABELS}
        onChange={(m) => { sleepSounds.startTimer(m); update((a) => ({ ...a, settings: { ...a.settings, timer: m } })); setPicking(false); }} />
    </Sheet>}
  </>;
}
