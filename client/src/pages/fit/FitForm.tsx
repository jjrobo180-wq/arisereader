// Arise Fit AI form check: the camera watches you lift, an on-device pose model (Google MediaPipe Pose
// Landmarker "full", loaded from jsDelivr) finds 33 body points in 2D and in 3D, and shared/fitForm.ts
// smooths them, checks the phone is set up right, counts reps and grades each one. A ding for a clean rep,
// a buzz for one to fix, and the coach says what to fix. Video never leaves the phone.
//   1. Set up: pick the lift, then a picture and steps show exactly where the phone goes.
//   2. Framing: a live checklist (whole body, distance, angle, light) has to go green.
//   3. Countdown: 3, 2, 1 with ticks, then every rep is counted and graded.
import { useEffect, useRef, useState } from "react";
import { Camera, Check, CheckCircle2, Lightbulb, RefreshCw, ScanEye, Square, Volume2, VolumeX, XCircle } from "lucide-react";
import { BONES, LIFTS, PoseSmoother, RepCounter, anglesOf, framing, plankOk, type FormLift, type FramingCheck, type Pt, type RepResult } from "@shared/fitForm";
import { sayAI, stopAiVoice } from "@/lib/aiVoice";
import { Btn, C, Card, Chips, Sheet, Title, display, fmtDur } from "./fitUi";

const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELS = {
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};
const within = <T,>(p: Promise<T>, ms: number, what: string) => Promise.race([p, new Promise<T>((_, no) => window.setTimeout(() => no(new Error(`${what} timed out`)), ms))]);

let landmarker: Promise<any> | null = null;
/** The pose model, loaded once. The accurate "full" model first; the GPU is tried briefly (it can hang on
 *  some iPhones), then the CPU; the smaller "lite" model only if the full one can't load at all. */
function loadPose(): Promise<any> {
  landmarker ??= (async () => {
    const mod: any = await within(import(/* @vite-ignore */ `${VISION}/vision_bundle.mjs`), 30_000, "Loading");
    const files = await within(mod.FilesetResolver.forVisionTasks(`${VISION}/wasm`), 30_000, "Loading");
    const make = (model: string, delegate: "GPU" | "CPU") => mod.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: model, delegate }, runningMode: "VIDEO", numPoses: 1,
      minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6, minTrackingConfidence: 0.6 });
    for (const model of [MODELS.full, MODELS.lite]) {
      try { return await within(make(model, "GPU"), 12_000, "GPU"); } catch { /* next */ }
      try { return await within(make(model, "CPU"), 40_000, "CPU"); } catch { /* next */ }
    }
    throw new Error("no model");
  })().catch((e) => { landmarker = null; throw e; });
  return landmarker;
}

// ── Sounds (made on the phone, no files) ──
let actx: AudioContext | null = null;
const audio = () => { try { actx ??= new (window.AudioContext || (window as any).webkitAudioContext)(); if (actx.state === "suspended") void actx.resume(); return actx; } catch { return null; } };
function tone(freq: number, at: number, len: number, type: OscillatorType = "sine", vol = 0.22) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + len + 0.02);
}
const sfx = {
  good: () => { tone(1046.5, 0, 0.18); tone(1568, 0.09, 0.32); },
  bad: () => { tone(196, 0, 0.16, "square", 0.12); tone(165, 0.19, 0.24, "square", 0.12); },
  tick: () => tone(880, 0, 0.09, "triangle", 0.2),
  go: () => { tone(1318.5, 0, 0.14); tone(1760, 0.08, 0.36); },
  ready: () => tone(660, 0, 0.12, "triangle", 0.16),
  done: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, n) => tone(f, n * 0.1, 0.32)),
};

const coach = (t: string) => { stopAiVoice(); void sayAI(t, { voice: "troy" }).catch(() => {}); };

/** Where the phone goes, drawn: the person, the phone on its stand, how far and how high. */
function PhoneGuide({ lift }: { lift: FormLift }) {
  const rule = LIFTS[lift];
  const floor = lift === "pushup" || lift === "plank";
  const phoneY = floor ? 146 : rule.upper ? 70 : 104;
  return <svg viewBox="0 0 320 170" className="h-auto w-full" role="img" aria-label={`Phone placement for ${rule.name}: ${rule.phone}`}>
    <line x1="10" y1="160" x2="310" y2="160" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
    {/* Phone on a stand or the floor, screen toward the person. */}
    <rect x="34" y={phoneY - 22} width="14" height="26" rx="3" fill="var(--fit-accent)" />
    {!floor && <line x1="41" y1={phoneY + 4} x2="41" y2="160" stroke="currentColor" strokeOpacity=".45" strokeWidth="2" />}
    {!floor && <line x1="31" y1="160" x2="51" y2="160" stroke="currentColor" strokeOpacity=".45" strokeWidth="3" />}
    <path d={`M48 ${phoneY - 9} L 210 ${floor ? 120 : 30} M48 ${phoneY - 9} L 210 ${floor ? 158 : 160}`} stroke="var(--fit-accent)" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
    {/* The person, side-on. */}
    {floor
      ? <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none"><circle cx="276" cy="128" r="8" fill="currentColor" /><path d="M266 132 L190 148 M266 132 L262 158 M190 148 L176 158" /></g>
      : <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none"><circle cx="240" cy="40" r="10" fill="currentColor" /><path d="M240 52 L240 104 M240 66 L252 86 M240 104 L236 132 L240 158 M240 104 L246 132 L250 158" /></g>}
    {/* Distance. */}
    <path d="M56 167 L 228 167" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.5" markerEnd="url(#ar)" markerStart="url(#ar)" />
    <defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="currentColor" fillOpacity=".6" /></marker></defs>
    <text x="142" y="164" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity=".75">{floor ? "5–6 ft · 1.5–2 m" : rule.upper ? "5–7 ft · 1.5–2 m" : "7–9 ft · 2–3 m"}</text>
  </svg>;
}

function setupSteps(lift: FormLift): string[] {
  const rule = LIFTS[lift];
  return [
    `Stand the phone up (portrait) against something steady: a water bottle, a bag, a bench or a tripod. ${rule.phone}`,
    rule.view === "front" ? "Face the phone." : rule.view === "either" ? "Stand side-on to the phone for the best depth reading (or facing it to check your knees)." : "Turn so your side faces the phone: it measures your joints best from the side.",
    "Light in front of you or above you, not a bright window behind you. Fitted clothes help it see your joints.",
    `Use the back camera if someone can hold or prop it; the front camera lets you watch yourself. The checklist goes green when you're set up, then a 3-2-1 countdown starts.`,
  ];
}

/** `lift` starts on that lift; `onLog` (during a workout) puts the reps counted into the set. */
export function FormCheck({ onClose, lift: startLift, onLog, logLabel }: { onClose: () => void; lift?: FormLift; onLog?: (r: { reps: number; clean: number; secs: number; faults: string[] }) => void; logLabel?: string }) {
  const [lift, setLift] = useState<FormLift>(startLift ?? "squat");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [reps, setReps] = useState<RepResult[]>([]);
  const [cue, setCue] = useState<{ text: string; good: boolean } | null>(null);
  const [live, setLive] = useState<{ drive: number; seen: number } | null>(null);
  const [stage, setStage] = useState<"frame" | "count" | "go">("frame");
  const [checks, setChecks] = useState<{ checks: FramingCheck[]; tip: string } | null>(null);
  const [count, setCount] = useState(0);
  const [hold, setHold] = useState(0);
  const [done, setDone] = useState(false);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem("arise-fit-form-sound") !== "off"; } catch { return true; } });
  const [voice, setVoice] = useState(() => { try { return localStorage.getItem("arise-fit-form-voice") !== "off"; } catch { return true; } });
  const soundRef = useRef(sound); soundRef.current = sound;
  const voiceRef = useRef(voice); voiceRef.current = voice;
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const counter = useRef(new RepCounter("squat"));
  const holdRef = useRef({ ms: 0, last: 0, broke: 0 });
  const play = (k: keyof typeof sfx) => { if (soundRef.current) sfx[k](); };
  const say = (t: string) => { if (voiceRef.current) coach(t); };

  // Start loading the model as soon as the screen opens, so it's ready by the time the phone is set up.
  useEffect(() => { void loadPose().catch(() => {}); }, []);

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null, raf = 0, alive = true;
    counter.current = new RepCounter(lift); holdRef.current = { ms: 0, last: 0, broke: 0 };
    const smooth = new PoseSmoother(1.2, 0.02), smoothW = new PoseSmoother(1.2, 0.02);
    const probe = document.createElement("canvas"); probe.width = 24; probe.height = 32;
    let bright: number | undefined, frames = 0, okSince = 0, countFrom = 0, lastTick = -1, lostSince = 0, phase: "frame" | "count" | "go" = "frame", lastTip = "", tipAt = 0;
    setReps([]); setCue(null); setHold(0); setStage("frame"); setChecks(null); setFailed(false); setStatus("Starting the camera…");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } }, audio: false });
        if (!alive || !video.current) return;
        video.current.srcObject = stream; await video.current.play();
        setStatus("Loading the AI coach… (first time takes a few seconds)");
        const pose = await loadPose();
        if (!alive) return;
        setStatus("");
        say(`${LIFTS[lift].name}. ${LIFTS[lift].view === "side" ? "Turn sideways to the phone and" : ""} step back until the checklist goes green.`);
        let lastT = 0;
        const loop = () => {
          if (!alive || !video.current || !canvas.current) return;
          const v = video.current, cv = canvas.current, ctx = cv.getContext("2d")!;
          if (v.videoWidth && (cv.width !== v.videoWidth || cv.height !== v.videoHeight)) { cv.width = v.videoWidth; cv.height = v.videoHeight; }
          const now = performance.now();
          if (now - lastT < 1) { raf = requestAnimationFrame(loop); return; }
          lastT = now;
          // Brightness, twice a second.
          if (frames++ % 15 === 0 && v.videoWidth) { try { const p = probe.getContext("2d", { willReadFrequently: true })!; p.drawImage(v, 0, 0, 24, 32); const d = p.getImageData(0, 0, 24, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; bright = s / (d.length / 4); } catch { /* fine */ } }
          let res: any = null; try { res = pose.detectForVideo(v, now); } catch { /* a dropped frame */ }
          const raw: Pt[] | undefined = res?.landmarks?.[0], rawW: Pt[] | undefined = res?.worldLandmarks?.[0];
          const lm = raw ? smooth.push(raw, now) : undefined, world = rawW ? smoothW.push(rawW, now) : undefined;
          ctx.clearRect(0, 0, cv.width, cv.height);
          const rule = LIFTS[lift];
          let good = true;

          if (phase !== "go") {
            // Framing, then the countdown. Losing the framing during the countdown starts it over.
            const fr = framing(lm, lift, bright);
            setChecks({ checks: fr.checks, tip: fr.tip });
            if (fr.tip !== lastTip && now - tipAt > 3500 && phase === "frame") { lastTip = fr.tip; tipAt = now; if (fr.ok) { play("ready"); say(fr.tip); } else if (frames > 60) say(fr.tip); }
            if (fr.ok) { okSince ||= now; } else { okSince = 0; if (phase === "count") { phase = "frame"; setStage("frame"); } }
            if (phase === "frame" && okSince && now - okSince > 900) { phase = "count"; countFrom = now; lastTick = -1; setStage("count"); }
            if (phase === "count") {
              const left = 3 - Math.floor((now - countFrom) / 1000);
              if (left !== lastTick) { lastTick = left; if (left > 0) { setCount(left); play("tick"); } else { phase = "go"; setStage("go"); play("go"); say(rule.hold ? "Hold" : "Go"); holdRef.current.last = 0; } }
            }
            good = fr.ok;
          } else if (lm) {
            const a = anglesOf(lm, world);
            setLive({ drive: Math.round(a[rule.drive] ?? 0), seen: a.seen });
            if (a.seen < 0.5) { lostSince ||= now; } else lostSince = 0;
            if (rule.hold) {
              const h = holdRef.current;
              good = plankOk(a);
              if (good && h.last) h.ms += now - h.last;
              if (!good && a.seen >= 0.5 && now - h.broke > 4000) { h.broke = now; const f = rule.faults(a, a)[0] ?? "Hold the line"; setCue({ text: f, good: false }); play("bad"); say(f); }
              if (good && h.broke && now - h.broke > 1500 && Math.floor(h.ms / 10000) !== Math.floor((h.ms - (now - h.last)) / 10000)) { play("good"); say(`${Math.round(h.ms / 1000)} seconds`); }
              h.last = now; setHold(h.ms / 1000);
            } else {
              const r = counter.current.push(a, now);
              if (r) {
                setReps([...counter.current.reps]);
                const tip = r.tips?.[0];
                setCue({ text: r.good ? (tip ?? `Good rep${r.downS ? ` · ${r.downS}s down` : ""}`) : r.faults[0], good: r.good });
                play(r.good ? "good" : "bad");
                say(r.good ? (tip && r.n % 3 === 0 ? `${r.n}. ${tip}` : String(r.n)) : `${r.n}. ${r.faults[0]}`);
                navigator.vibrate?.(r.good ? 30 : [60, 40, 60]); good = r.good;
              }
            }
          } else { lostSince ||= now; setLive(null); }

          // Skeleton: green when it's right, red when it's not.
          if (lm) {
            const W = cv.width, H = cv.height;
            ctx.lineWidth = Math.max(4, W / 150); ctx.lineCap = "round";
            ctx.strokeStyle = good ? "rgba(52,211,153,.95)" : "rgba(255,69,58,.95)";
            for (const [i, j] of BONES) { const p = lm[i], q = lm[j]; if ((p.visibility ?? 1) < 0.45 || (q.visibility ?? 1) < 0.45) continue; ctx.beginPath(); ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(q.x * W, q.y * H); ctx.stroke(); }
            ctx.fillStyle = "#fff";
            for (const k of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) { const p = lm[k]; if ((p.visibility ?? 1) < 0.45) continue; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, Math.max(5, W / 110), 0, Math.PI * 2); ctx.fill(); }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        setFailed(true);
        setStatus(e?.name === "NotAllowedError" ? "Camera access is off. Turn it on in Settings → Arise Fit → Camera, then tap Try again."
          : e?.name === "NotFoundError" || e?.name === "OverconstrainedError" ? "That camera isn't available. Switch cameras and try again."
          : "The AI coach couldn't load. Check your internet (it downloads once, then it's quick) and tap Try again.");
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); stopAiVoice(); };
  }, [on, lift, facing]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { audio(); setOn(true); };
  const stop = () => { setOn(false); setDone(true); if (reps.length || hold > 1) play("done"); };
  const rule = LIFTS[lift];
  const clean = reps.filter((r) => r.good).length;
  const score = reps.length ? Math.round((clean / reps.length) * 100) : 0;
  const downs = reps.map((r) => r.downS).filter((n): n is number => n != null && n > 0);
  const toggle = (k: "sound" | "voice") => {
    const next = !(k === "sound" ? sound : voice);
    (k === "sound" ? setSound : setVoice)(next);
    try { localStorage.setItem(`arise-fit-form-${k}`, next ? "on" : "off"); } catch { /* fine */ }
    if (k === "voice" && !next) stopAiVoice();
  };
  const white = { color: "#fff" };

  if (done) {
    const faultCount = new Map<string, number>(); for (const r of reps) for (const f of r.faults) faultCount.set(f, (faultCount.get(f) ?? 0) + 1);
    const top = [...faultCount.entries()].sort((a, b) => b[1] - a[1]);
    return <Sheet title="Form report" onClose={onClose} testId="fit-form-report">
      <div className="mt-2 text-center"><p className="text-[13px] tracking-[.16em]" style={{ ...display, fontWeight: 700, color: C.lime }}>{rule.name}</p>
        <p className="text-[72px] leading-none" style={display}>{rule.hold ? fmtDur(hold) : `${score}%`}</p>
        <p className="text-[14px]" style={{ color: C.dim }}>{rule.hold ? "in a good line" : `${clean} of ${reps.length} reps clean`}</p></div>
      {!rule.hold && reps.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[["Reps", String(reps.length)], ["Avg down", downs.length ? `${(downs.reduce((a, b) => a + b, 0) / downs.length).toFixed(1)}s` : "—"], ["Best depth", `${Math.min(...reps.map((r) => r.depth ?? 999)) === 999 ? "—" : Math.min(...reps.map((r) => r.depth ?? 999)) + "°"}`]].map(([k, v]) => <Card key={k} className="!p-3"><p className="text-[11px] uppercase tracking-[.12em]" style={{ color: C.dim }}>{k}</p><p className="text-[22px] leading-tight" style={display}>{v}</p></Card>)}
      </div>}
      {top.length > 0 && <Card className="mt-3 !p-4"><p className="flex items-center gap-2 text-[12px] tracking-[.14em]" style={{ ...display, fontWeight: 700, color: C.lime }}><Lightbulb className="h-4 w-4" /> Fix this first</p>
        <p className="mt-1 text-[16px]">{top[0][0]}</p><p className="text-[13px]" style={{ color: C.dim }}>On {top[0][1]} of {reps.length} reps.{top[1] ? ` Then: ${top[1][0].toLowerCase()}.` : ""}</p></Card>}
      {!rule.hold && reps.length > 0 && <><Title>Every rep</Title><div className="space-y-2">{reps.map((r) => <Card key={r.n} className="flex items-start gap-3 !p-3">
        {r.good ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.green }} /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.red }} />}
        <div className="min-w-0"><p className="text-[17px] leading-tight" style={display}>Rep {r.n}</p>
          <p className="text-[13px]" style={{ color: C.dim }}>{r.good ? "Clean." : r.faults.join(" · ")}</p>
          <p className="text-[12px] tabular-nums" style={{ color: C.dim }}>{[r.depth != null ? `${rule.drive === "body" ? "line" : rule.drive} ${r.depth}°` : "", r.downS ? `${r.downS}s down` : "", r.upS ? `${r.upS}s up` : ""].filter(Boolean).join(" · ")}{r.tips?.length ? ` · ${r.tips[0]}` : ""}</p></div></Card>)}</div></>}
      {onLog && (rule.hold ? hold >= 1 : reps.length > 0) && <Btn className="mt-6 w-full" testId="fit-form-log" onClick={() => { onLog({ reps: reps.length, clean, secs: Math.round(hold), faults: [...new Set(reps.flatMap((r) => r.faults))].slice(0, 3) }); onClose(); }}>
        <CheckCircle2 className="h-5 w-5" />{logLabel ?? "Log it"}: {rule.hold ? fmtDur(hold) : `${reps.length} reps`}</Btn>}
      <Btn kind={onLog ? "soft" : "primary"} className="mt-3 w-full" onClick={() => { setDone(false); start(); }}>Go again</Btn>
      <p className="mt-6 text-[11px] leading-relaxed" style={{ color: C.dim }}>The AI coach measures your joints from video, so treat it as a second pair of eyes, not a trainer. Your video is processed on your phone and never uploaded.</p>
    </Sheet>;
  }

  return <Sheet title="AI form check" onClose={onClose} testId="fit-form" right={<div className="flex gap-1">
    <button type="button" onClick={() => toggle("sound")} aria-pressed={sound} aria-label={sound ? "Dings on" : "Dings off"} className="grid h-10 w-10 place-items-center rounded-full" style={{ background: C.card2 }}>{sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</button>
  </div>}>
    {!on && <>
      <div className="mt-1 rounded-[14px] p-4" style={{ background: `linear-gradient(150deg, ${C.emberSoft}, ${C.card})` }}>
        <ScanEye className="h-8 w-8" style={{ color: C.lime }} />
        <p className="mt-2 text-[26px] leading-none" style={display}>Your AI spotter</p>
        <p className="mt-1 text-[14px] leading-snug" style={{ color: C.steel }}>It counts every rep, measures your depth, lockout and body line in 3D, dings when a rep is clean and buzzes when there's something to fix.</p>
      </div>
      <Title>Lift</Title>
      <Chips label="Lift" value={lift} onChange={setLift} items={(Object.keys(LIFTS) as FormLift[]).map((k) => ({ id: k, label: LIFTS[k].name }))} />
      <Title>Set up your phone</Title>
      <Card className="!p-4" testId="fit-form-guide">
        <div style={{ color: C.text }}><PhoneGuide lift={lift} /></div>
        <ol className="mt-3 space-y-2.5">{setupSteps(lift).map((t, n) => <li key={n} className="flex gap-3 text-[14.5px] leading-snug"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: C.lime, color: C.ink }}>{n + 1}</span><span>{t}</span></li>)}</ol>
      </Card>
      <Title>Camera</Title>
      <div className="grid grid-cols-2 gap-2">{(["user", "environment"] as const).map((f) => <button key={f} type="button" onClick={() => setFacing(f)} aria-pressed={facing === f} className="h-11 rounded-[10px] text-[14px] font-semibold" style={facing === f ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }}>{f === "user" ? "Front (see yourself)" : "Back (sharper)"}</button>)}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => toggle("sound")} aria-pressed={sound} className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold" style={{ background: C.card2 }}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}Dings {sound ? "on" : "off"}</button>
        <button type="button" onClick={() => toggle("voice")} aria-pressed={voice} className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold" style={{ background: C.card2 }}>{voice ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}Coach voice {voice ? "on" : "off"}</button>
      </div>
      <Btn className="mt-4 w-full" onClick={start} testId="fit-form-start"><Camera className="h-5 w-5" />Start form check</Btn>
      <p className="mt-4 text-[11px] leading-relaxed" style={{ color: C.dim }}>Uses Google's MediaPipe pose model on your phone. Video never leaves your device.</p>
    </>}
    {on && <>
      <div className="relative mt-1 overflow-hidden rounded-[14px] bg-black" style={{ aspectRatio: "3 / 4" }}>
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
        <canvas ref={canvas} className="absolute inset-0 h-full w-full object-cover" style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
        {stage === "go" && <div className="absolute left-3 top-3 rounded-[10px] px-3 py-2" style={{ background: "rgba(10,10,11,.75)" }}>
          <p className="text-[11px] uppercase tracking-[.14em]" style={{ color: "rgba(255,255,255,.7)" }}>{rule.hold ? "Hold" : "Reps"}</p>
          <p className="text-[44px] leading-none tabular-nums" style={{ ...display, ...white }} data-testid="fit-form-reps">{rule.hold ? fmtDur(hold) : reps.length}</p>
        </div>}
        {stage === "go" && !rule.hold && reps.length > 0 && <div className="absolute right-3 top-3 rounded-[10px] px-3 py-2 text-right" style={{ background: "rgba(10,10,11,.75)" }}><p className="text-[11px] uppercase tracking-[.14em]" style={{ color: "rgba(255,255,255,.7)" }}>Form</p><p className="text-[30px] leading-none" style={{ ...display, color: score >= 80 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171" }}>{score}%</p></div>}
        {/* Setting up: the checklist that has to go green. */}
        {!status && stage !== "go" && checks && <div className="absolute inset-x-3 top-3 rounded-[12px] p-3" style={{ background: "rgba(10,10,11,.78)", ...white }} data-testid="fit-form-framing">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">{checks.checks.map((c) => <p key={c.id} className="flex items-center gap-1.5 text-[13.5px] font-semibold"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: c.ok ? "#22c55e" : "rgba(255,255,255,.18)" }}>{c.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}</span>{c.text}</p>)}</div>
          <p className="mt-2 text-[15px] font-bold" style={{ color: checks.checks.every((c) => c.ok) ? "#4ade80" : "#fde68a" }}>{checks.tip}</p>
        </div>}
        {stage === "count" && <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(0,0,0,.25)" }}><p className="text-[120px] leading-none" style={{ ...display, ...white, textShadow: "0 4px 24px rgba(0,0,0,.6)" }}>{count}</p></div>}
        {cue && stage === "go" && <p className="absolute inset-x-3 bottom-3 rounded-[10px] px-3 py-2 text-center text-[17px]" style={{ ...display, background: cue.good ? "rgba(52,211,153,.94)" : "rgba(255,69,58,.94)", color: "#0b0b0c" }}>{cue.text}</p>}
        {(status || (stage === "go" && live && live.seen < 0.5)) && <div className="absolute inset-0 grid place-items-center px-6 text-center" style={{ background: "rgba(10,10,11,.6)" }}>
          <div><p className="text-[16px] font-semibold" style={white}>{status || "Step back into view so the camera sees your whole body."}</p>
            {failed && <Btn className="mt-4" onClick={() => { setOn(false); window.setTimeout(start, 50); }}><RefreshCw className="h-4 w-4" />Try again</Btn>}</div>
        </div>}
      </div>
      {stage === "go" && live && <p className="mt-2 text-center text-[12px] tabular-nums" style={{ color: C.dim }}>{rule.drive === "body" ? "Body line" : `${rule.drive[0].toUpperCase()}${rule.drive.slice(1)} angle`}: {live.drive}° · measured in 3D</p>}
      {stage !== "go" && !status && <p className="mt-2 text-center text-[13px]" style={{ color: C.dim }}>{rule.phone}</p>}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Btn kind="danger" onClick={stop} testId="fit-form-stop"><Square className="h-4 w-4" />Finish</Btn>
        <Btn kind="soft" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} className="!px-3"><RefreshCw className="h-5 w-5" /></Btn>
      </div>
    </>}
  </Sheet>;
}
