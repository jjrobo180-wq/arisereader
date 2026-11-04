// Arise Fit+ Sleep Lab: three premium sleep tools.
//  • Pillow tracking: put the phone on the mattress or under your pillow, plugged in, with Arise Fit open.
//    The motion sensor feels how much you move; calm stretches count as deep sleep, small movements as
//    light sleep, big ones as awake. A smart alarm wakes you in the lightest moment of the window you pick.
//    iPhone pauses apps when the screen locks, so the screen stays on (dark) all night.
//  • Sleep sounds: rain, ocean, fan, brown noise and more, made on the phone, with a timer that fades out.
//  • Apple Watch: connect Apple Health and the watch's nights, stages and heart data come in on their own.
import { useEffect, useMemo, useRef, useState } from "react";
import { Bed, Check, Crown, Moon, Pause, Play, Waves, Watch, X } from "lucide-react";
import { addNight, emptySleep, type SleepStages } from "@shared/fitSleep";
import type { FitData } from "@shared/fit";
import { Btn, C, Card, Layer, Title, display, font, glowBg, haptic } from "./fitUi";
import { usePlus } from "./FitPlus";
import { connectHealth, healthConnected } from "./fitNative";
import { isNativeApp } from "@/lib/nativeApp";
import type { Update } from "./fitStore";

const hm = (ms: number) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// ─── Sleep sounds ────────────────────────────────────────────────────────────────────────────────
export type Sound = { id: string; name: string; blurb: string };
export const SOUNDS: Sound[] = [
  { id: "rain", name: "Rain", blurb: "Steady rain on a roof" },
  { id: "ocean", name: "Ocean", blurb: "Slow waves" },
  { id: "fan", name: "Fan", blurb: "Soft, even air" },
  { id: "brown", name: "Brown noise", blurb: "Deep and warm" },
  { id: "pink", name: "Pink noise", blurb: "Balanced, like wind" },
  { id: "white", name: "White noise", blurb: "Covers every sound" },
];
let actx: AudioContext | null = null;
function noiseBuffer(c: AudioContext, kind: "white" | "pink" | "brown") {
  const len = c.sampleRate * 4, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w * 0.5;
    else if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
  }
  return b;
}
/** Starts a looping sound; returns a function that fades it out and stops it. */
export function startSound(id: string, volume = 0.5): () => void {
  try {
    actx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const c = actx; void c.resume();
    const out = c.createGain(); out.gain.value = 0; out.connect(c.destination);
    out.gain.linearRampToValueAtTime(volume, c.currentTime + 2);
    const src = c.createBufferSource();
    const kind = id === "white" ? "white" : id === "pink" || id === "ocean" || id === "fan" ? "pink" : "brown";
    src.buffer = noiseBuffer(c, id === "rain" ? "white" : kind); src.loop = true;
    const f = c.createBiquadFilter();
    const stops: (() => void)[] = [];
    if (id === "rain") { f.type = "highpass"; f.frequency.value = 900; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000; src.connect(f); f.connect(lp); lp.connect(out); }
    else if (id === "ocean") { f.type = "lowpass"; f.frequency.value = 800; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.1; lg.gain.value = 0.45; lfo.connect(lg); const swell = c.createGain(); swell.gain.value = 0.55; lg.connect(swell.gain); src.connect(f); f.connect(swell); swell.connect(out); lfo.start(); stops.push(() => lfo.stop()); }
    else if (id === "fan") { f.type = "bandpass"; f.frequency.value = 500; f.Q.value = 0.4; src.connect(f); f.connect(out); }
    else { f.type = "lowpass"; f.frequency.value = id === "white" ? 12000 : id === "pink" ? 6000 : 1200; src.connect(f); f.connect(out); }
    src.start();
    return () => { try { out.gain.cancelScheduledValues(c.currentTime); out.gain.setValueAtTime(out.gain.value, c.currentTime); out.gain.linearRampToValueAtTime(0, c.currentTime + 2.5); } catch { /* stopped */ } window.setTimeout(() => { try { src.stop(); stops.forEach((s) => s()); out.disconnect(); } catch { /* stopped */ } }, 2700); };
  } catch { return () => {}; }
}

export function SoundsScreen({ onClose }: { onClose: () => void }) {
  const [id, setId] = useState<string | null>(null);
  const [timer, setTimer] = useState(30);
  const stop = useRef<(() => void) | null>(null);
  const end = useRef(0);
  const [left, setLeft] = useState(0);
  const halt = () => { stop.current?.(); stop.current = null; setId(null); setLeft(0); };
  const play = (s: string) => { haptic("light"); stop.current?.(); stop.current = startSound(s); setId(s); end.current = Date.now() + timer * 60_000; };
  useEffect(() => {
    if (!id) return;
    const t = window.setInterval(() => { const l = end.current - Date.now(); setLeft(l); if (l <= 0 && timer > 0) halt(); }, 1000);
    return () => window.clearInterval(t);
  }, [id, timer]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stop.current?.(); }, []);
  return <Layer><div className="fixed inset-0 z-[95] flex flex-col" style={{ backgroundColor: C.bg, backgroundImage: glowBg, color: C.text, ...font }} role="dialog" aria-modal="true" aria-label="Sleep sounds" data-testid="fit-sleep-sounds">
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><X className="h-5 w-5" /></button>
      <h1 className="min-w-0 flex-1 text-center text-[22px]" style={display}>Sleep sounds</h1><span className="w-11" />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
      <div className="grid grid-cols-2 gap-2.5">{SOUNDS.map((s) => <button key={s.id} type="button" onClick={() => (id === s.id ? halt() : play(s.id))} aria-pressed={id === s.id} className="flex min-h-[110px] flex-col justify-between rounded-[16px] p-3.5 text-left active:scale-[.98]" style={id === s.id ? { background: "linear-gradient(160deg,#312e81,#4338ca)", color: "#fff" } : { background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: id === s.id ? "rgba(255,255,255,.18)" : C.card2 }}>{id === s.id ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}</span>
        <span><span className="block text-[18px] leading-tight" style={display}>{s.name}</span><span className="block text-[12px] opacity-75">{s.blurb}</span></span></button>)}</div>
      <Title>Turn off after</Title>
      <div className="flex flex-wrap gap-2">{[15, 30, 60, 120, 0].map((m) => <button key={m} type="button" onClick={() => { setTimer(m); end.current = Date.now() + m * 60_000; }} aria-pressed={timer === m} className="h-10 rounded-full px-4 text-[14px] font-semibold" style={timer === m ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card }}>{m === 0 ? "Never" : m < 60 ? `${m} min` : `${m / 60} hr`}</button>)}</div>
      {id && timer > 0 && left > 0 && <p className="mt-3 px-1 text-[13px]" style={{ color: C.dim }}>Fades out in {Math.ceil(left / 60000)} min.</p>}
      <p className="mt-6 px-1 text-[12px]" style={{ color: C.dim }}>Sounds are made on your phone, so they work offline. Keep Arise Fit open and the screen on while they play.</p>
    </div>
  </div></Layer>;
}

// ─── Pillow tracking + smart alarm ───────────────────────────────────────────────────────────────
type Epoch = { t: number; move: number };
const EPOCH_MS = 30_000;
/** A movement score for one 30-second epoch → stage. */
const stageOf = (m: number): "deep" | "light" | "awake" => (m < 0.012 ? "deep" : m < 0.06 ? "light" : "awake");

export function summarize(epochs: Epoch[]): { stages: SleepStages; asleepMin: number } {
  let deep = 0, light = 0, awake = 0;
  // Smooth: a single moved epoch inside calm sleep isn't waking up.
  const st = epochs.map((e) => stageOf(e.move));
  for (let i = 0; i < st.length; i++) {
    let s = st[i];
    if (s === "awake" && st[i - 1] !== "awake" && st[i + 1] !== "awake") s = "light";
    if (s === "deep") deep++; else if (s === "light") light++; else awake++;
  }
  const m = EPOCH_MS / 60000;
  return { stages: { deep: Math.round(deep * m), rem: 0, core: Math.round(light * m), awake: Math.round(awake * m) }, asleepMin: Math.round((deep + light) * m) };
}

export function PillowTracker({ data, update, say, onClose }: { data: FitData; update: Update; say: (m: string) => void; onClose: () => void }) {
  const sched = data.sleep?.schedule;
  const [phase, setPhase] = useState<"setup" | "night">("setup");
  const [alarmOn, setAlarmOn] = useState(true);
  const [alarm, setAlarm] = useState(sched?.wake || "07:00");
  const [window_, setWindow_] = useState(30);
  const [sound, setSound] = useState<string>("");
  const [problem, setProblem] = useState("");
  const [now, setNow] = useState(Date.now());
  const [dim, setDim] = useState(false);
  const start = useRef(0);
  const epochs = useRef<Epoch[]>([]);
  const acc = useRef(0); const n = useRef(0); const prev = useRef<{ x: number; y: number; z: number } | null>(null);
  const stopSound = useRef<(() => void) | null>(null);
  const woke = useRef(false);

  const alarmAt = useMemo(() => { const [h, m] = alarm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); if (d.getTime() <= Date.now() + 60_000) d.setDate(d.getDate() + 1); return d.getTime(); }, [alarm, phase]);
  const begin = async () => {
    haptic("medium");
    try {
      const DM: any = (window as any).DeviceMotionEvent;
      if (DM && typeof DM.requestPermission === "function") { const r = await DM.requestPermission(); if (r !== "granted") { setProblem("Motion access was declined. In Settings > Arise Fit, allow Motion & Orientation, then try again."); return; } }
      if (!DM) { setProblem("This device can't sense motion, so pillow tracking isn't available here."); return; }
    } catch { setProblem("Couldn't turn on the motion sensor."); return; }
    start.current = Date.now(); epochs.current = []; woke.current = false; setPhase("night"); setProblem("");
    if (sound) stopSound.current = startSound(sound, 0.35);
    window.setTimeout(() => setDim(true), 1500);
  };

  // Listen to the motion sensor while the night is running; keep the screen on.
  useEffect(() => {
    if (phase !== "night") return;
    let lock: any = null;
    (navigator as any).wakeLock?.request?.("screen").then((l: any) => { lock = l; }).catch(() => {});
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity; if (!a) return;
      const cur = { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 };
      if (prev.current) { acc.current += Math.abs(cur.x - prev.current.x) + Math.abs(cur.y - prev.current.y) + Math.abs(cur.z - prev.current.z); n.current++; }
      prev.current = cur;
    };
    window.addEventListener("devicemotion", onMotion);
    const t = window.setInterval(() => {
      const t0 = Date.now(); setNow(t0);
      if (t0 - (epochs.current[epochs.current.length - 1]?.t ?? start.current) >= EPOCH_MS) {
        const move = n.current ? acc.current / n.current / 9.8 : 0; acc.current = 0; n.current = 0;
        epochs.current.push({ t: t0, move });
        // Smart alarm: inside the window, wake at the first restless moment (or at the alarm time).
        if (alarmOn && !woke.current) {
          const inWindow = t0 >= alarmAt - window_ * 60_000;
          if ((inWindow && stageOf(move) !== "deep" && epochs.current.length > 20) || t0 >= alarmAt) { woke.current = true; ring(); }
        }
      }
    }, 1000);
    return () => { window.removeEventListener("devicemotion", onMotion); window.clearInterval(t); try { lock?.release?.(); } catch { /* gone */ } };
  }, [phase, alarmOn, alarmAt, window_]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopSound.current?.(); ringStop.current?.(); }, []);

  const ringStop = useRef<(() => void) | null>(null);
  const [ringing, setRinging] = useState(false);
  const ring = () => {
    setRinging(true); setDim(false); stopSound.current?.(); stopSound.current = null;
    let on = true;
    const tick = () => { try { actx ??= new (window.AudioContext || (window as any).webkitAudioContext)(); void actx.resume(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.value = 0.25; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.35); } catch { /* silent */ } navigator.vibrate?.([300, 150, 300]); };
    tick(); const iv = window.setInterval(() => on && tick(), 1200);
    ringStop.current = () => { on = false; window.clearInterval(iv); };
  };
  const finish = (save: boolean) => {
    ringStop.current?.(); stopSound.current?.();
    const wake = Date.now();
    if (save && wake - start.current >= 30 * 60_000) {
      const { stages, asleepMin } = summarize(epochs.current);
      update((d) => ({ ...d, sleep: addNight(d.sleep ?? emptySleep(), start.current, wake, undefined, { src: "pillow", stages, asleepMin: Math.max(10, asleepMin) }) }));
      haptic("success"); say(`Good morning. You slept ${hm(asleepMin * 60000)}.`);
    } else if (save) say("That was under 30 minutes, so it wasn't saved as a night.");
    onClose();
  };

  const mins = Math.round((now - start.current) / 60000);
  const lastMove = epochs.current[epochs.current.length - 1]?.move ?? 0;
  const nowStage = stageOf(lastMove);

  if (phase === "night") return <Layer><div className="fixed inset-0 z-[130] flex flex-col items-center justify-center text-center" style={{ background: dim ? "#000" : "#0b0b12", color: dim ? "#3a3a46" : "#e5e7ff", ...font, transition: "background 1.2s, color 1.2s" }} onClick={() => !ringing && setDim((d) => !d)} data-testid="fit-pillow-night">
    {ringing ? <>
      <Moon className="h-12 w-12" style={{ color: "#fde68a" }} />
      <p className="mt-4 text-[64px] leading-none tabular-nums" style={display}>{clock(Date.now())}</p>
      <p className="mt-1 text-[16px]" style={{ color: "#c7d2fe" }}>You slept {hm(Date.now() - start.current)}</p>
      <button type="button" onClick={(e) => { e.stopPropagation(); finish(true); }} className="mt-8 min-h-[60px] w-[min(86vw,360px)] rounded-[16px] text-[22px]" style={{ ...display, background: "#fde68a", color: "#1e1b4b" }}>I'm awake</button>
    </> : <>
      <p className="text-[56px] leading-none tabular-nums" style={display}>{clock(now)}</p>
      <p className="mt-2 text-[14px]">{mins < 1 ? "Tracking started" : `Tracking · ${hm(now - start.current)}`}</p>
      {!dim && <>
        <p className="mt-3 text-[13px]" style={{ color: "#a5b4fc" }}>{nowStage === "deep" ? "Calm" : nowStage === "light" ? "Light movement" : "Restless"}{alarmOn ? ` · alarm ${clock(alarmAt)}` : ""}</p>
        <div className="mt-8 flex gap-3">
          <button type="button" onClick={(e) => { e.stopPropagation(); finish(true); }} className="h-12 rounded-full px-6 text-[16px] font-semibold" style={{ background: "#312e81", color: "#fff" }}>I'm awake</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); if (window.confirm("Stop without saving?")) finish(false); }} className="h-12 rounded-full px-6 text-[16px] font-semibold" style={{ background: "#1f1f2b", color: "#c7d2fe" }}>Cancel</button>
        </div>
        <p className="mt-6 max-w-xs px-4 text-[12px]" style={{ color: "#6b6f9a" }}>Keep the phone plugged in and Arise Fit open. Tap the screen to dim it.</p>
      </>}
    </>}
  </div></Layer>;

  return <Layer><div className="fixed inset-0 z-[95] flex flex-col" style={{ backgroundColor: C.bg, backgroundImage: glowBg, color: C.text, ...font }} role="dialog" aria-modal="true" aria-label="Pillow tracking" data-testid="fit-pillow">
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><X className="h-5 w-5" /></button>
      <h1 className="min-w-0 flex-1 text-center text-[22px]" style={display}>Pillow tracking</h1><span className="w-11" />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
      <Card className="!p-5" style={{ background: "linear-gradient(170deg,#1e1b4b,#312e81)", color: "#eef" }}>
        <Bed className="h-8 w-8" style={{ color: "#c7d2fe" }} />
        <p className="mt-3 text-[26px] leading-tight" style={display}>Put the phone on your mattress or under your pillow.</p>
        <p className="mt-2 text-[14px] leading-snug" style={{ color: "#c7d2fe" }}>Your phone feels how still you are, and finds your lightest sleep so the alarm wakes you gently. Plug it in and leave Arise Fit open.</p>
      </Card>
      <Title>Smart alarm</Title>
      <Card className="!p-4">
        <div className="flex items-center justify-between"><span className="font-semibold">Wake me gently</span>
          <button type="button" role="switch" aria-checked={alarmOn} onClick={() => setAlarmOn(!alarmOn)} className="h-8 w-14 rounded-full p-1 transition" style={{ background: alarmOn ? C.lime : C.card2 }}><span className="block h-6 w-6 rounded-full bg-white shadow transition" style={{ transform: alarmOn ? "translateX(24px)" : "none" }} /></button></div>
        {alarmOn && <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-[12px] font-semibold" style={{ color: C.dim }}>Wake by</span><input type="time" value={alarm} onChange={(e) => setAlarm(e.target.value)} className="h-12 w-full rounded-[12px] px-3 text-[17px]" style={{ background: C.card2, color: C.text }} /></label>
          <label className="block"><span className="mb-1 block text-[12px] font-semibold" style={{ color: C.dim }}>Window</span><select value={window_} onChange={(e) => setWindow_(Number(e.target.value))} className="h-12 w-full rounded-[12px] px-3 text-[17px]" style={{ background: C.card2, color: C.text }}>{[10, 20, 30, 45].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
        </div>}
        {alarmOn && <p className="mt-2 text-[12px]" style={{ color: C.dim }}>The alarm rings at the lightest moment in the {window_} minutes before {alarm}, or at {alarm} at the latest.</p>}
      </Card>
      <Title>Falling asleep</Title>
      <div className="flex flex-wrap gap-2">{[["", "Silence"], ...SOUNDS.slice(0, 4).map((s) => [s.id, s.name])].map(([id, l]) => <button key={id} type="button" onClick={() => setSound(id)} aria-pressed={sound === id} className="h-10 rounded-full px-4 text-[14px] font-semibold" style={sound === id ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card }}>{l}</button>)}</div>
      {problem && <p className="mt-4 px-1 text-[14px]" role="alert" style={{ color: C.red }}>{problem}</p>}
      <Btn className="mt-6 w-full !min-h-[56px]" onClick={begin} testId="fit-pillow-start"><Moon className="h-5 w-5" />Start tonight</Btn>
      <p className="mt-3 px-1 text-[12px]" style={{ color: C.dim }}>Movement-based estimates of light and deep sleep. They can't see REM, and aren't medical advice. For the full picture, wear an Apple Watch too.</p>
    </div>
  </div></Layer>;
}

// ─── The Sleep Lab card on the Sleep screen ──────────────────────────────────────────────────────
export function SleepLab({ data, update, say }: { data: FitData; update: Update; say: (m: string) => void }) {
  const { plus, ask } = usePlus();
  const [open, setOpen] = useState<"" | "pillow" | "sounds">("");
  const native = isNativeApp();
  const go = (w: "pillow" | "sounds") => { if (!plus) { ask("sleep-lab"); return; } setOpen(w); };
  const connected = native && healthConnected();
  const tile = (icon: React.ReactNode, title: string, sub: string, onClick: () => void, testId: string) =>
    <button type="button" onClick={() => { haptic("light"); onClick(); }} className="flex w-full items-center gap-3 rounded-[14px] p-3.5 text-left active:scale-[.985]" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }} data-testid={testId}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: "linear-gradient(145deg,#6366f1,#3730a3)", color: "#fff" }}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[16px] font-semibold leading-tight">{title}{!plus && <Crown className="h-3.5 w-3.5" style={{ color: C.lime }} />}</span><span className="block text-[12.5px] leading-snug" style={{ color: C.dim }}>{sub}</span></span>
    </button>;
  return <>
    <Title right={<span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em]" style={{ background: C.card2, color: C.lime }}>Fit+</span>}>Sleep Lab</Title>
    <div className="space-y-2" data-testid="fit-sleep-lab">
      {tile(<Bed className="h-5 w-5" />, "Pillow tracking", "Phone under your pillow measures how you move, with a smart alarm.", () => go("pillow"), "fit-lab-pillow")}
      {tile(<Waves className="h-5 w-5" />, "Sleep sounds", "Rain, ocean, fan and noise that fade out on a timer.", () => go("sounds"), "fit-lab-sounds")}
      <div className="rounded-[14px] p-3.5" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: "linear-gradient(145deg,#6366f1,#3730a3)", color: "#fff" }}><Watch className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold leading-tight">Apple Watch</span><span className="block text-[12.5px] leading-snug" style={{ color: C.dim }}>{connected ? "Connected. Wear your watch to bed and nights, stages and heart data arrive on their own." : "Wear it to bed. Nights, deep and REM sleep and heart data come in from Apple Health."}</span></span></div>
        {native && !connected && <Btn kind="soft" className="mt-3 w-full" onClick={async () => { try { await connectHealth(); say("Apple Health connected."); } catch { say("Couldn't connect Apple Health."); } }}><Check className="h-4 w-4" />Connect Apple Health</Btn>}
        {!native && <p className="mt-2 text-[12px]" style={{ color: C.dim }}>Open Arise Fit on your iPhone to connect your watch.</p>}
      </div>
    </div>
    {open === "pillow" && <PillowTracker data={data} update={update} say={say} onClose={() => setOpen("")} />}
    {open === "sounds" && <SoundsScreen onClose={() => setOpen("")} />}
  </>;
}
