// The rest timer between sets: a big ring that counts down in the layout's own type and accent, −15s,
// stop and +15s, quick lengths, and what's next. Ticks for the last 3 seconds and a chime at zero.
// It can be shrunk to the bar at the bottom of the workout (and the choice is remembered).
import { useEffect, useRef } from "react";
import { ChevronDown, Square } from "lucide-react";
import { C, display, fmtDur, haptic, numFont } from "./fitUi";

let actx: AudioContext | null = null;
function tone(freq: number, at: number, len: number, vol = 0.22, type: OscillatorType = "sine") {
  try {
    actx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (actx.state === "suspended") void actx.resume();
    const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + len + 0.02);
  } catch { /* no sound on this phone */ }
}
export const restSounds = {
  tick: () => tone(880, 0, 0.08, 0.18, "triangle"),
  end: () => { tone(1046.5, 0, 0.2); tone(1318.5, 0.12, 0.2); tone(1568, 0.24, 0.42); },
  /** Call from a tap so iPhone lets sound play later. */
  unlock: () => tone(20, 0, 0.01, 0.0002),
};

const FULL_KEY = "arise-fit-rest-full";
export const restFullPref = () => { try { return localStorage.getItem(FULL_KEY) !== "off"; } catch { return true; } };
export const setRestFullPref = (on: boolean) => { try { localStorage.setItem(FULL_KEY, on ? "on" : "off"); } catch { /* fine */ } };
export const REST_PRESETS = [30, 60, 90, 120, 180, 300];

/** Ticks at 3, 2, 1 and a chime at 0 while a rest runs (used by both the full timer and the bar). */
export function useRestSounds(left: number, running: boolean) {
  const last = useRef(-1);
  useEffect(() => {
    if (!running) { last.current = -1; return; }
    if (left === last.current) return;
    last.current = left;
    if (left > 0 && left <= 3) restSounds.tick();
    if (left === 0) restSounds.end();
  }, [left, running]);
}

export function RestTimer({ left, total, next, onAdd, onSet, onStop, onMinimize }: {
  left: number; total: number; next?: string;
  onAdd: (secs: number) => void; onSet: (secs: number) => void; onStop: () => void; onMinimize: () => void;
}) {
  const R = 132, S = 300, c = 2 * Math.PI * R, pct = total ? Math.max(0, Math.min(1, left / total)) : 0;
  const over = left <= 0;
  return <div className="fit-up fixed inset-0 z-[78] flex flex-col items-center px-5" style={{ background: C.bg, color: C.text, paddingTop: "max(14px, var(--sat,env(safe-area-inset-top,0px)))", paddingBottom: "max(18px, env(safe-area-inset-bottom))" }} role="dialog" aria-label="Rest timer" data-testid="fit-rest-full">
    <div className="flex w-full items-center justify-between">
      <button type="button" onClick={() => { setRestFullPref(false); onMinimize(); }} aria-label="Make the timer small" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card2 }}><ChevronDown className="h-5 w-5" /></button>
      <p className="text-[13px] font-semibold uppercase tracking-[.16em]" style={{ color: C.dim }}>Rest between sets</p>
      <span className="h-11 w-11" />
    </div>
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="relative" style={{ width: "min(78vw, 340px)", aspectRatio: "1" }}>
        <svg viewBox={`0 0 ${S} ${S}`} className="h-full w-full -rotate-90" aria-hidden>
          <circle cx={S / 2} cy={S / 2} r={R} fill="none" strokeWidth={16} style={{ stroke: C.track }} />
          <circle cx={S / 2} cy={S / 2} r={R} fill="none" strokeWidth={16} strokeLinecap="round" style={{ stroke: over ? "#22c55e" : C.lime, strokeDasharray: c, strokeDashoffset: c * (1 - pct), transition: "stroke-dashoffset 1s linear, stroke .3s" }} />
        </svg>
        <div className="absolute inset-[9%] grid place-items-center rounded-full" style={{ background: C.card, boxShadow: "0 10px 40px -18px rgba(0,0,0,.45)" }}>
          <div className="text-center">
            <p className="text-[64px] leading-none tabular-nums" style={{ ...numFont, fontWeight: 700 }} aria-live="polite" data-testid="fit-rest-left">{over ? "Go!" : fmtDur(left)}</p>
            <p className="mt-2 text-[13px]" style={{ color: C.dim }}>{over ? "Rest's over" : `of ${fmtDur(total)}`}</p>
          </div>
        </div>
      </div>
      {next && <p className="mt-6 max-w-[320px] text-center text-[15px]" style={{ color: C.dim }}>Next: <span className="font-semibold" style={{ color: C.text }}>{next}</span></p>}
      <div className="mt-7 flex items-center gap-7">
        <button type="button" onClick={() => { haptic("light"); onAdd(-15); }} className="grid h-16 w-16 place-items-center rounded-full text-[15px] font-bold" style={{ background: C.card2, color: C.lime }} aria-label="15 seconds less">−15s</button>
        <button type="button" onClick={() => { haptic("medium"); onStop(); }} className="grid h-20 w-20 place-items-center rounded-full" style={{ background: C.lime, color: C.ink, boxShadow: "0 12px 28px -12px rgba(var(--fit-accent-rgb),.9)" }} aria-label="Stop the rest" data-testid="fit-rest-stop"><Square className="h-7 w-7" fill="currentColor" /></button>
        <button type="button" onClick={() => { haptic("light"); onAdd(15); }} className="grid h-16 w-16 place-items-center rounded-full text-[15px] font-bold" style={{ background: C.card2, color: C.lime }} aria-label="15 seconds more">+15s</button>
      </div>
    </div>
    <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
      {REST_PRESETS.map((s) => <button key={s} type="button" onClick={() => { haptic("light"); onSet(s); }} className="min-w-[64px] rounded-full px-3 py-2 text-[14px] font-semibold tabular-nums" style={total === s ? { background: C.lime, color: C.ink } : { background: C.card2 }}>{s < 60 ? `${s}s` : `${s / 60}${s % 60 ? `:${String(s % 60).padStart(2, "0")}` : ""} min`}</button>)}
    </div>
    <p className="mt-3 text-[11.5px]" style={{ ...display, fontFamily: "var(--fit-font)", color: C.dim }}>Taps here change this rest only. Each exercise keeps its own rest time.</p>
  </div>;
}
