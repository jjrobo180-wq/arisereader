// Arise Fit AI form check: the camera watches you lift, an on-device pose model (Google MediaPipe Pose
// Landmarker, loaded from jsDelivr) finds 33 body points, and shared/fitForm.ts counts reps and grades
// each one. The coach calls out faults in the AI voice. Video never leaves the phone.
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RefreshCw, ScanEye, Square, XCircle } from "lucide-react";
import { BONES, LIFTS, RepCounter, anglesOf, plankOk, type FormLift, type Pt, type RepResult } from "@shared/fitForm";
import { sayAI, stopAiVoice } from "@/lib/aiVoice";
import { Btn, C, Card, Chips, Sheet, Title, display, fmtDur } from "./fitUi";

const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let landmarker: Promise<any> | null = null;
function loadPose(): Promise<any> {
  landmarker ??= (async () => {
    const mod: any = await import(/* @vite-ignore */ `${VISION}/vision_bundle.mjs`);
    const files = await mod.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
    const make = (delegate: "GPU" | "CPU") => mod.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numPoses: 1 });
    try { return await make("GPU"); } catch { return await make("CPU"); }
  })().catch((e) => { landmarker = null; throw e; });
  return landmarker;
}

const coach = (t: string) => { stopAiVoice(); void sayAI(t, { voice: "troy" }).catch(() => {}); };

export function FormCheck({ onClose }: { onClose: () => void }) {
  const [lift, setLift] = useState<FormLift>("squat");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState("");
  const [reps, setReps] = useState<RepResult[]>([]);
  const [cue, setCue] = useState("");
  const [live, setLive] = useState<{ drive: number; seen: number } | null>(null);
  const [hold, setHold] = useState(0);
  const [done, setDone] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const counter = useRef(new RepCounter("squat"));
  const holdRef = useRef({ ms: 0, last: 0, broke: 0 });

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null, raf = 0, alive = true;
    counter.current = new RepCounter(lift); holdRef.current = { ms: 0, last: 0, broke: 0 };
    setReps([]); setCue(""); setHold(0); setStatus("Starting the camera…");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: false });
        if (!alive || !video.current) return;
        video.current.srcObject = stream; await video.current.play();
        setStatus("Loading the AI coach…");
        const pose = await loadPose();
        if (!alive) return;
        setStatus("");
        coach(`${LIFTS[lift].name}. ${LIFTS[lift].setup} Start when you're ready.`);
        const loop = () => {
          if (!alive || !video.current || !canvas.current) return;
          const v = video.current, cv = canvas.current, ctx = cv.getContext("2d")!;
          if (v.videoWidth && (cv.width !== v.videoWidth || cv.height !== v.videoHeight)) { cv.width = v.videoWidth; cv.height = v.videoHeight; }
          const res = pose.detectForVideo(v, performance.now());
          const lm: Pt[] | undefined = res?.landmarks?.[0];
          ctx.clearRect(0, 0, cv.width, cv.height);
          if (lm) {
            const a = anglesOf(lm);
            const rule = LIFTS[lift];
            setLive({ drive: Math.round(a[rule.drive]), seen: a.seen });
            let good = true;
            if (rule.hold) {
              const now = performance.now(), h = holdRef.current;
              good = plankOk(a);
              if (good && h.last) h.ms += now - h.last;
              if (!good && a.seen >= 0.5 && now - h.broke > 4000) { h.broke = now; setCue(rule.faults(a, a)[0] ?? ""); coach(rule.faults(a, a)[0] ?? "Hold the line"); }
              h.last = now; setHold(h.ms / 1000);
            } else {
              const r = counter.current.push(a);
              if (r) { setReps([...counter.current.reps]); setCue(r.faults[0] ?? "Good rep"); coach(r.good ? String(r.n) : `${r.n}. ${r.faults[0]}`); navigator.vibrate?.(r.good ? 30 : [60, 40, 60]); good = r.good; }
            }
            // Skeleton.
            const W = cv.width, H = cv.height;
            ctx.lineWidth = Math.max(4, W / 160); ctx.lineCap = "round";
            ctx.strokeStyle = good ? "rgba(255,90,31,.95)" : "rgba(255,59,48,.95)";
            for (const [i, j] of BONES) { const p = lm[i], q = lm[j]; if ((p.visibility ?? 1) < 0.4 || (q.visibility ?? 1) < 0.4) continue; ctx.beginPath(); ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(q.x * W, q.y * H); ctx.stroke(); }
            ctx.fillStyle = "#fff";
            for (const k of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) { const p = lm[k]; if ((p.visibility ?? 1) < 0.4) continue; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, Math.max(5, W / 110), 0, Math.PI * 2); ctx.fill(); }
          } else setLive(null);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        setStatus(e?.name === "NotAllowedError" ? "Camera access is off. Turn it on in Settings → Arise Fit → Camera." : "The AI coach couldn't start. Check your connection and try again.");
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); stopAiVoice(); };
  }, [on, lift, facing]);

  const stop = () => { setOn(false); setDone(true); };
  const rule = LIFTS[lift];
  const score = reps.length ? Math.round((reps.filter((r) => r.good).length / reps.length) * 100) : 0;

  if (done) return <Sheet title="Form report" onClose={onClose} testId="fit-form-report">
    <div className="mt-2 text-center"><p className="text-[13px] tracking-[.16em]" style={{ ...display, fontWeight: 700, color: C.lime }}>{rule.name}</p>
      <p className="text-[72px] leading-none" style={display}>{rule.hold ? fmtDur(hold) : `${score}%`}</p>
      <p className="text-[14px]" style={{ color: C.dim }}>{rule.hold ? "in a good line" : `${reps.filter((r) => r.good).length} of ${reps.length} reps clean`}</p></div>
    {!rule.hold && reps.length > 0 && <><Title>Every rep</Title><div className="space-y-2">{reps.map((r) => <Card key={r.n} className="flex items-start gap-3 !p-3">
      {r.good ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "#4ade80" }} /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.red }} />}
      <div><p className="text-[17px] leading-tight" style={display}>Rep {r.n}</p><p className="text-[13px]" style={{ color: C.dim }}>{r.good ? "Clean." : r.faults.join(" · ")}</p></div></Card>)}</div></>}
    <Btn className="mt-6 w-full" onClick={() => { setDone(false); setOn(true); }}>Go again</Btn>
    <p className="mt-6 text-[11px] leading-relaxed" style={{ color: C.dim }}>The AI coach estimates joint angles from video, so treat it as a second pair of eyes, not a trainer. Your video is processed on your phone and never uploaded.</p>
  </Sheet>;

  return <Sheet title="AI form check" onClose={onClose} testId="fit-form">
    {!on && <>
      <div className="mt-1 rounded-[14px] p-4" style={{ background: "linear-gradient(150deg, #2a160c, #202329)" }}>
        <ScanEye className="h-8 w-8" style={{ color: C.lime }} />
        <p className="mt-2 text-[26px] leading-none" style={display}>Your AI spotter</p>
        <p className="mt-1 text-[14px] leading-snug" style={{ color: C.steel }}>Prop your phone up, step back, and lift. It counts every rep, grades your depth, lockout and body line, and calls out what to fix.</p>
      </div>
      <Title>Lift</Title>
      <Chips label="Lift" value={lift} onChange={setLift} items={(Object.keys(LIFTS) as FormLift[]).map((k) => ({ id: k, label: LIFTS[k].name }))} />
      <Card className="mt-3 !p-4"><p className="text-[12px] tracking-[.14em]" style={{ ...display, fontWeight: 700, color: C.lime }}>Setup</p><p className="mt-1 text-[15px]">{rule.setup}</p></Card>
      <div className="mt-3 grid grid-cols-2 gap-2">{(["user", "environment"] as const).map((f) => <button key={f} type="button" onClick={() => setFacing(f)} aria-pressed={facing === f} className="h-11 rounded-[10px] text-[14px] font-semibold" style={facing === f ? { background: C.lime, color: "#0b0b0c" } : { background: C.card }}>{f === "user" ? "Front camera" : "Back camera"}</button>)}</div>
      <Btn className="mt-4 w-full" onClick={() => setOn(true)} testId="fit-form-start"><Camera className="h-5 w-5" />Start form check</Btn>
      <p className="mt-4 text-[11px] leading-relaxed" style={{ color: C.dim }}>Uses Google's MediaPipe pose model on your phone. Video never leaves your device.</p>
    </>}
    {on && <>
      <div className="relative mt-1 overflow-hidden rounded-[14px] bg-black" style={{ aspectRatio: "3 / 4" }}>
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
        <canvas ref={canvas} className="absolute inset-0 h-full w-full object-cover" style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
        <div className="absolute left-3 top-3 rounded-[10px] px-3 py-2" style={{ background: "rgba(10,10,11,.75)" }}>
          <p className="text-[11px] uppercase tracking-[.14em]" style={{ color: C.dim }}>{rule.hold ? "Hold" : "Reps"}</p>
          <p className="text-[44px] leading-none tabular-nums" style={display} data-testid="fit-form-reps">{rule.hold ? fmtDur(hold) : reps.length}</p>
        </div>
        {!rule.hold && reps.length > 0 && <div className="absolute right-3 top-3 rounded-[10px] px-3 py-2 text-right" style={{ background: "rgba(10,10,11,.75)" }}><p className="text-[11px] uppercase tracking-[.14em]" style={{ color: C.dim }}>Form</p><p className="text-[30px] leading-none" style={{ ...display, color: score >= 80 ? "#4ade80" : score >= 50 ? C.orange : C.red }}>{score}%</p></div>}
        {cue && <p className="absolute inset-x-3 bottom-3 rounded-[10px] px-3 py-2 text-center text-[17px]" style={{ ...display, background: cue === "Good rep" ? "rgba(74,222,128,.9)" : "rgba(255,90,31,.92)", color: "#0b0b0c" }}>{cue}</p>}
        {(status || (live && live.seen < 0.5)) && <p className="absolute inset-0 grid place-items-center px-6 text-center text-[16px]" style={{ background: "rgba(10,10,11,.55)" }}>{status || "Step back so your whole body is in the frame."}</p>}
      </div>
      {live && <p className="mt-2 text-center text-[12px] tabular-nums" style={{ color: C.dim }}>{rule.drive === "body" ? "Body line" : `${rule.drive[0].toUpperCase()}${rule.drive.slice(1)} angle`}: {live.drive}°</p>}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Btn kind="danger" onClick={stop} testId="fit-form-stop"><Square className="h-4 w-4" />Finish</Btn>
        <Btn kind="soft" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} className="!px-3" ><RefreshCw className="h-5 w-5" /></Btn>
      </div>
    </>}
  </Sheet>;
}
