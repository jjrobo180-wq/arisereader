// Arise Fit's guided-session player (shared/fitSessions.ts): one phase at a time with a big countdown,
// a spoken cue at each change, three beeps before it, treadmill speed and incline for intervals, and an
// expanding circle for breathing. The screen stays awake while it runs.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Gauge, Mountain, Pause, Play, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { sessionSecs, type Phase, type Session } from "@shared/fitSessions";
import { Btn, C, Card, display, fmtDur, font } from "./fitUi";

const KIND_COLOR: Record<Phase["kind"], string> = { warm: "#ffb020", work: "#ff5a1f", rest: "#4d9fff", cool: "#8d939b", pose: "#ff5a1f", "breathe-in": "#4d9fff", hold: "#b9c0c8", "breathe-out": "#ff5a1f", still: "#b9c0c8" };
const BREATH = new Set<Phase["kind"]>(["breathe-in", "hold", "breathe-out"]);

function say(text: string) {
  try { const s = window.speechSynthesis; if (!s) return; s.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; u.pitch = 0.85; s.speak(u); } catch { /* no voice on this device */ }
}
let audio: AudioContext | null = null;
function beep(high = false) {
  try {
    audio ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = high ? 1320 : 880; o.type = "square"; g.gain.value = 0.06;
    o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + (high ? 0.35 : 0.12));
  } catch { /* no sound */ }
}

/** What's said when a phase starts. */
function announce(p: Phase): string {
  if (p.kind === "breathe-in") return "In";
  if (p.kind === "breathe-out") return "Out";
  if (p.kind === "hold") return "Hold";
  const parts = [p.name];
  if (p.speed) parts.push(`${p.speed} miles per hour`);
  if (p.incline) parts.push(`incline ${p.incline}`);
  if (p.kind !== "pose" && p.secs >= 60) parts.push(`for ${Math.round(p.secs / 60)} minute${p.secs >= 120 ? "s" : ""}`);
  return parts.join(", ") + (p.cue ? `. ${p.cue}` : ".");
}

export function SessionPlayer({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: (secs: number) => void }) {
  const total = sessionSecs(session);
  const [i, setI] = useState(0);
  const [endAt, setEndAt] = useState(() => Date.now() + session.phases[0].secs * 1000);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [voice, setVoice] = useState(true);
  const [finished, setFinished] = useState(false);
  const started = useRef(Date.now());
  const lastBeep = useRef(-1);
  const p = session.phases[i];
  const leftMs = pausedLeft ?? Math.max(0, endAt - now);
  const left = Math.ceil(leftMs / 1000);
  const elapsed = session.phases.slice(0, i).reduce((t, x) => t + x.secs, 0) + (p.secs - leftMs / 1000);

  // Keep the screen on.
  useEffect(() => {
    let lock: any = null;
    (navigator as any).wakeLock?.request?.("screen").then((l: any) => { lock = l; }).catch(() => {});
    return () => { try { lock?.release?.(); } catch { /* gone */ } window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => { if (finished) return; const t = window.setInterval(() => setNow(Date.now()), 200); return () => window.clearInterval(t); }, [finished]);
  // A new phase: speak it.
  useEffect(() => { if (voice && !finished) say(announce(p)); navigator.vibrate?.(BREATH.has(p.kind) ? 20 : [120, 60, 120]); lastBeep.current = -1; }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  // Countdown beeps, and moving on when the phase ends.
  useEffect(() => {
    if (pausedLeft !== null || finished) return;
    if (!BREATH.has(p.kind) && p.secs >= 10 && left <= 3 && left >= 1 && lastBeep.current !== left) { lastBeep.current = left; beep(); }
    if (leftMs <= 0) {
      if (i + 1 >= session.phases.length) { setFinished(true); beep(true); if (voice) say("Session complete. Great work."); return; }
      if (!BREATH.has(session.phases[i + 1].kind)) beep(true);
      setI(i + 1); setEndAt(Date.now() + session.phases[i + 1].secs * 1000);
    }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (to: number) => { const n = Math.max(0, Math.min(session.phases.length - 1, to)); setI(n); if (pausedLeft !== null) setPausedLeft(session.phases[n].secs * 1000); else setEndAt(Date.now() + session.phases[n].secs * 1000); };
  const toggle = () => { if (pausedLeft !== null) { setEndAt(Date.now() + pausedLeft); setPausedLeft(null); } else { setPausedLeft(leftMs); window.speechSynthesis?.cancel(); } };
  const color = KIND_COLOR[p.kind];
  const next = session.phases[i + 1];
  const breathScale = p.kind === "breathe-in" ? 1 : p.kind === "breathe-out" ? 0.45 : p.kind === "hold" ? (session.phases[i - 1]?.kind === "breathe-in" ? 1 : 0.45) : 0.7;

  if (finished) return <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-6 text-center" style={{ background: `radial-gradient(90% 60% at 50% 20%, #3a1a0a, ${C.bg})`, color: C.text, ...font }} data-testid="fit-session-done">
    <div className="grid h-24 w-24 place-items-center rounded-full" style={{ background: C.lime }}><Trophy className="h-12 w-12" style={{ color: "#0b0b0c" }} /></div>
    <h1 className="mt-6 text-[44px] leading-none" style={display}>Done.</h1>
    <p className="mt-2 text-[16px]" style={{ color: C.steel }}>{session.name}</p>
    <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2">
      <Card className="!p-3"><p className="text-[28px] leading-none" style={display}>{fmtDur((Date.now() - started.current) / 1000)}</p><p className="mt-1 text-[11px] uppercase tracking-[.1em]" style={{ color: C.dim }}>Time</p></Card>
      <Card className="!p-3"><p className="text-[28px] leading-none" style={display}>{session.phases.filter((x) => x.kind === "work" || x.kind === "pose").length}</p><p className="mt-1 text-[11px] uppercase tracking-[.1em]" style={{ color: C.dim }}>{session.category === "yoga" ? "Poses" : session.category === "meditation" ? "Rounds" : "Intervals"}</p></Card>
    </div>
    <Btn className="mt-8 w-full max-w-sm" onClick={() => onDone(Math.round((Date.now() - started.current) / 1000))} testId="fit-session-save">Save to history</Btn>
    <button type="button" onClick={onClose} className="mt-3 h-11 text-[15px]" style={{ color: C.dim }}>Close without saving</button>
  </div>;

  return <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: `radial-gradient(110% 70% at 50% 30%, ${color}26, ${C.bg} 70%)`, color: C.text, ...font }} data-testid="fit-session">
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <button type="button" onClick={() => { if (window.confirm("End this session?")) onClose(); }} aria-label="End session" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><X className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1 text-center"><p className="truncate text-[17px]" style={display}>{session.name}</p><p className="text-[12px] tabular-nums" style={{ color: C.dim }}>{fmtDur(elapsed)} / {fmtDur(total)}</p></div>
      <button type="button" onClick={() => { setVoice((v) => !v); window.speechSynthesis?.cancel(); }} aria-label={voice ? "Mute voice" : "Turn voice on"} aria-pressed={voice} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}>{voice ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</button>
    </div>
    <div className="mx-4 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}><div className="h-full" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%`, background: C.lime, transition: "width .25s linear" }} /></div>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-[14px] tracking-[.2em]" style={{ ...display, fontWeight: 700, color }}>{i + 1} / {session.phases.length}</p>
      {BREATH.has(p.kind) || p.kind === "still"
        ? <div className="relative my-6 grid h-64 w-64 place-items-center">
            <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${color}55, ${color}11 70%)`, transform: `scale(${breathScale})`, transition: `transform ${p.secs}s ease-in-out` }} />
            <p className="relative text-[40px] leading-none" style={display}>{p.name}</p>
          </div>
        : <p className="mt-2 text-[48px] leading-[.95]" style={display} data-testid="fit-session-phase">{p.name}</p>}
      <p className="mt-2 text-[110px] leading-none tabular-nums" style={{ ...display, color: pausedLeft !== null ? C.dim : C.text }} data-testid="fit-session-left">{fmtDur(left)}</p>
      {(p.speed || p.incline) && <div className="mt-4 flex gap-2">
        {p.speed && <span className="flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[18px]" style={{ ...display, background: C.card2 }}><Gauge className="h-5 w-5" style={{ color }} />{p.speed} mph</span>}
        {p.incline !== undefined && <span className="flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[18px]" style={{ ...display, background: C.card2 }}><Mountain className="h-5 w-5" style={{ color }} />{p.incline}% incline</span>}
      </div>}
      {p.cue && <p className="mt-4 max-w-sm text-[16px] leading-snug" style={{ color: C.steel }}>{p.cue}</p>}
      {next && <p className="mt-6 text-[13px] uppercase tracking-[.12em]" style={{ color: C.dim }}>Next: <span style={{ color: C.text }}>{next.name}{next.speed ? ` · ${next.speed} mph` : ""}</span> · {fmtDur(next.secs)}</p>}
    </div>
    <div className="flex shrink-0 items-center justify-center gap-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
      <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous" className="grid h-14 w-14 place-items-center rounded-full disabled:opacity-30" style={{ background: C.card }}><ChevronLeft className="h-7 w-7" /></button>
      <button type="button" onClick={toggle} aria-label={pausedLeft !== null ? "Resume" : "Pause"} className="grid h-20 w-20 place-items-center rounded-full shadow-[0_10px_30px_rgba(255,90,31,.4)]" style={{ background: C.lime, color: "#0b0b0c" }} data-testid="fit-session-pause">{pausedLeft !== null ? <Play className="ml-1 h-9 w-9" fill="currentColor" /> : <Pause className="h-9 w-9" fill="currentColor" />}</button>
      <button type="button" onClick={() => (i + 1 < session.phases.length ? go(i + 1) : setFinished(true))} aria-label="Skip" className="grid h-14 w-14 place-items-center rounded-full" style={{ background: C.card }} data-testid="fit-session-skip"><ChevronRight className="h-7 w-7" /></button>
    </div>
  </div>;
}
