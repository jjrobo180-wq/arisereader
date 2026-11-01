// Arise Fit: your gym and its machines.
// - My gym: pick your gym (Planet Fitness, LA Fitness, a home or apartment gym…) and the equipment it
//   has; take photos of a home or apartment gym and the AI finds the equipment. Built-for-you workouts
//   then use only what you have (shared/fitGym.ts, shared/fitRecovery.ts).
// - Scan a machine: point the camera at the QR code on a machine (gym chains put them on their
//   equipment) or take a photo of it, and see what it works, how to set it up and the exercises to do on it.
// - Swap an exercise during a workout for another that works the same muscle with your equipment.
// - After a workout: when you'll be sore, what to eat and by when, water, and facts on creatine and pre-workout.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Bell, Camera, Check, ChevronRight, Droplets, Loader2, QrCode, ScanLine, Search, Sparkles, Utensils } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { shrinkPhoto } from "@/lib/foodLookup";
import { CATALOG_BY_ID, type FitData, type Workout } from "@shared/fit";
import { GEAR, GEAR_BY_ID, GYM_BY_ID, GYM_TYPES, exercisesOn, gearFromText, gymLabel, type Gear, type GearKind, type MyGym } from "@shared/fitGym";
import { alternatives } from "@shared/fitRecovery";
import { SUPPLEMENTS, debrief } from "@shared/fitDebrief";
import { fitApi, type Update } from "./fitStore";
import { scheduleRefuel } from "./fitNative";
import { Btn, C, Card, Chips, Sheet, Title, display, haptic, inputCls, inputStyle } from "./fitUi";

type GearAnswer = { gear: string[]; name: string; note: string };
const KIND_NAME: Record<GearKind, string> = { free: "Free weights", station: "Racks, benches and bars", machine: "Machines", cable: "Cables", cardio: "Cardio", small: "Small equipment" };
const KINDS: GearKind[] = ["free", "station", "machine", "cable", "cardio", "small"];
const MUSCLE_NAME: Record<string, string> = { chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Core", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", "full body": "Full body", cardio: "Cardio" };

async function identify(token: string | null, file: File, mode: "machine" | "gym"): Promise<GearAnswer> {
  const image = await shrinkPhoto(file);
  return fitApi<GearAnswer>(token, "/identify", { method: "POST", body: JSON.stringify({ image, mode }) });
}

/** Which equipment choice the workout builder should use for this person. */
export const myEquip = (data: FitData) => (data.profile.gym ? { equip: "mygym" as const, gear: data.profile.gym.gear } : { equip: "gym" as const, gear: undefined });

// ——— My gym ———————————————————————————————————————————————————————————————————————————————————————
export function GymSheet({ data, update, onClose }: { data: FitData; update: Update; onClose: () => void }) {
  const { token } = useAuth();
  const saved = data.profile.gym;
  const [type, setType] = useState<string | null>(saved?.type ?? null);
  const [gear, setGear] = useState<Set<string>>(new Set(saved?.gear ?? []));
  const [name, setName] = useState(saved?.name ?? "");
  const [found, setFound] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const photos = useRef<HTMLInputElement>(null);
  const kind = type ? GYM_BY_ID.get(type) : null;
  const pick = (id: string) => { haptic("light"); setType(id); setGear(new Set(saved?.type === id ? saved.gear : GYM_BY_ID.get(id)!.gear)); setFound([]); setErr(""); };
  const toggle = (id: string) => setGear((g) => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const scan = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(""); const got = new Set<string>();
    try {
      const list = [...files].slice(0, 6);
      for (let i = 0; i < list.length; i++) {
        setBusy(`Looking at photo ${i + 1} of ${list.length}…`);
        (await identify(token, list[i], "gym")).gear.forEach((g) => got.add(g));
      }
      setGear((g) => new Set([...g, ...got]));
      setFound([...got]);
      if (!got.size) setErr("No equipment was found in those photos. Try photos with the machines in full view, or tick them off below.");
    } catch (e: any) { setErr(e?.message || "The photos couldn't be read. Tick off your equipment below instead."); }
    finally { setBusy(""); if (photos.current) photos.current.value = ""; }
  };
  const save = () => {
    if (!type) return;
    const gym: MyGym = { type, gear: [...gear], ...(name.trim() ? { name: name.trim().slice(0, 60) } : {}) };
    update((d) => ({ ...d, profile: { ...d.profile, gym } }));
    haptic("success"); onClose();
  };
  return <Sheet title="My gym" onClose={onClose} testId="fit-gym">
    {!type ? <>
      <p className="px-1 text-[15px]" style={{ color: C.steel }}>Where do you train? Workouts built for you will only use equipment your gym has.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">{GYM_TYPES.map((g) => <button key={g.id} type="button" onClick={() => pick(g.id)} className="fit-in flex min-h-[86px] flex-col items-start rounded-[14px] p-3 text-left active:scale-[.98]" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }} data-testid={`fit-gym-type-${g.id}`}>
        <span className="text-[22px]" aria-hidden>{g.e}</span><span className="mt-1 text-[17px] leading-tight" style={display}>{g.name}</span></button>)}</div>
    </> : <>
      <Card className="!p-4"><div className="flex items-start gap-3"><span className="text-[28px]" aria-hidden>{kind?.e}</span>
        <div className="min-w-0 flex-1"><p className="text-[24px] leading-none" style={display}>{kind?.name}</p><p className="mt-1 text-[13px]" style={{ color: C.steel }}>{kind?.blurb}</p></div>
        <button type="button" onClick={() => setType(null)} className="text-[14px] font-semibold" style={{ color: C.lime }}>Change</button></div></Card>
      <label className="mt-3 block px-1 text-[13px] font-semibold" style={{ color: C.dim }} htmlFor="fit-gym-name">Name (optional)</label>
      <input id="fit-gym-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind?.scan ? "My garage gym" : `${kind?.name} on Main St`} className={inputCls} style={inputStyle} maxLength={60} />
      <Btn kind="soft" className="mt-3 w-full" onClick={() => photos.current?.click()} disabled={!!busy} testId="fit-gym-photos">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}{busy || "Scan with photos"}</Btn>
      <input ref={photos} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => void scan(e.target.files)} />
      <p className="mt-1.5 px-1 text-[12px]" style={{ color: C.dim }}>Take a few photos around the room. The AI lists what it sees; photos aren't kept.</p>
      {found.length > 0 && <p className="mt-2 rounded-[10px] px-3 py-2 text-[14px]" style={{ background: C.tint }} role="status"><Sparkles className="mr-1 inline h-4 w-4" style={{ color: C.lime }} />Found {found.map((g) => GEAR_BY_ID.get(g)?.name).join(", ")}.</p>}
      {err && <p className="mt-2 text-[14px]" style={{ color: C.red }} role="alert">{err}</p>}
      <p className="mt-3 px-1 text-[13px]" style={{ color: C.dim }}>{kind?.scan ? "Tick what you have." : "Typical for this gym. Every location is different: switch off anything yours doesn't have."}</p>
      {KINDS.map((k) => <div key={k}><Title>{KIND_NAME[k]}</Title>
        <div className="grid grid-cols-2 gap-2">{GEAR.filter((g) => g.kind === k).map((g) => { const on = gear.has(g.id); return <button key={g.id} type="button" onClick={() => toggle(g.id)} aria-pressed={on} className="flex min-h-12 items-center gap-2 rounded-[10px] px-2.5 text-left text-[14px] font-semibold" style={on ? { background: C.lime, color: "#0b0b0c" } : { background: C.card, color: C.text, boxShadow: `inset 0 0 0 1px ${C.line}` }} data-testid={`fit-gear-${g.id}`}>
          <span aria-hidden>{on ? <Check className="h-4 w-4" /> : g.e}</span><span className="leading-tight">{g.name}</span></button>; })}</div></div>)}
      <Btn className="mt-6 w-full" onClick={save} testId="fit-gym-save"><Check className="h-5 w-5" />Save my gym</Btn>
      {saved && <button type="button" onClick={() => { update((d) => { const { gym: _g, ...profile } = d.profile; return { ...d, profile }; }); onClose(); }} className="mt-3 h-11 w-full text-[14px] font-semibold" style={{ color: C.dim }}>Forget my gym</button>}
    </>}
  </Sheet>;
}

// ——— Scan a machine ——————————————————————————————————————————————————————————————————————————————
let qrLib: Promise<(data: Uint8ClampedArray, w: number, h: number) => { data: string } | null> | null = null;
/** jsQR (loaded the first time it's needed) reads QR codes on phones whose browser can't. */
const loadQr = () => (qrLib ??= import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm").then((m: any) => m.default ?? m).catch((e) => { qrLib = null; throw e; }));

function QrScanner({ onText, onError }: { onText: (t: string) => void; onError: (m: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stream: MediaStream | null = null, timer = 0, alive = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (!alive || !video.current) return;
        video.current.srcObject = stream; video.current.setAttribute("playsinline", ""); await video.current.play().catch(() => {});
        const BD = (window as any).BarcodeDetector;
        let built: any = null;
        try { if (BD && (await BD.getSupportedFormats?.())?.includes("qr_code")) built = new BD({ formats: ["qr_code"] }); } catch { built = null; }
        const jsqr = built ? null : await loadQr();
        const tick = async () => {
          if (!alive || !video.current || !canvas.current) return;
          const v = video.current;
          if (v.videoWidth) {
            let text = "";
            if (built) { const r = await built.detect(v).catch(() => []); text = r?.[0]?.rawValue || ""; }
            else if (jsqr) {
              const scale = Math.min(1, 640 / v.videoWidth), w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
              const cv = canvas.current; cv.width = w; cv.height = h;
              const ctx = cv.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(v, 0, 0, w, h);
              text = jsqr(ctx.getImageData(0, 0, w, h).data, w, h)?.data || "";
            }
            if (text) { navigator.vibrate?.(40); onText(text); return; }
          }
          timer = window.setTimeout(() => void tick(), 220);
        };
        void tick();
      } catch (e: any) {
        onError(e?.name === "NotAllowedError" ? "Camera access is off. Turn it on in Settings, or take a photo instead." : "The QR reader couldn't start. Take a photo of the machine instead.");
      }
    })();
    return () => { alive = false; window.clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="relative mt-2 overflow-hidden rounded-[14px] bg-black" style={{ aspectRatio: "3 / 4" }}>
    <video ref={video} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
    <canvas ref={canvas} className="hidden" />
    <div className="absolute inset-[18%] rounded-[18px]" style={{ boxShadow: "0 0 0 2000px rgba(0,0,0,.35), inset 0 0 0 3px #fff" }} aria-hidden />
    <p className="absolute inset-x-3 bottom-3 rounded-[10px] px-3 py-2 text-center text-[14px] font-semibold text-white" style={{ background: "rgba(10,10,11,.7)" }}>Point at the QR code on the machine</p>
  </div>;
}

/** What a machine works, how to use it, and the exercises to do on it. */
export function MachineGuide({ gear, data, update, onUse, useLabel = "Add to workout" }: { gear: Gear; data: FitData; update: Update; onUse?: (exId: string) => void; useLabel?: string }) {
  const exercises = exercisesOn(gear.id).slice(0, 8);
  const gym = data.profile.gym;
  const missing = gym && !gym.gear.includes(gear.id);
  return <div data-testid="fit-machine">
    <Card className="!p-4"><div className="flex items-center gap-3"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-[12px] text-[30px]" style={{ background: C.tint }} aria-hidden>{gear.e}</span>
      <div className="min-w-0"><p className="text-[26px] leading-none" style={display}>{gear.name}</p>
        <p className="mt-1 text-[13px]" style={{ color: C.steel }}>Works {gear.works.map((m) => MUSCLE_NAME[m] ?? m).join(", ").toLowerCase()}</p></div></div></Card>
    <Title>How to use it</Title>
    <Card className="!p-4"><ol className="space-y-2">{gear.how.map((h, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-snug"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px]" style={{ ...display, background: C.lime, color: "#0b0b0c" }}>{i + 1}</span>{h}</li>)}</ol></Card>
    <Title>Avoid</Title>
    <Card className="!p-4"><ul className="space-y-1.5">{gear.avoid.map((a, i) => <li key={i} className="text-[15px] leading-snug">✕ {a}</li>)}</ul></Card>
    {exercises.length > 0 && <><Title>Exercises on it</Title>
      <div className="space-y-2">{exercises.map((e) => <Card key={e.id} className="flex items-center gap-3 !p-3">
        <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-semibold">{e.name}</p><p className="text-[12px]" style={{ color: C.dim }}>{MUSCLE_NAME[e.muscle]}{e.cues[0] ? ` · ${e.cues[0]}` : ""}</p></div>
        {onUse && <Btn className="!min-h-10 !px-3 text-[14px]" onClick={() => { haptic("medium"); onUse(e.id); }} testId={`fit-machine-use-${e.id}`}>{useLabel}</Btn>}
      </Card>)}</div></>}
    {missing && <Btn kind="soft" className="mt-4 w-full" onClick={() => { update((d) => d.profile.gym ? { ...d, profile: { ...d.profile, gym: { ...d.profile.gym, gear: [...d.profile.gym.gear, gear.id] } } } : d); haptic("success"); }} testId="fit-machine-add-gym">Add to {gymLabel(gym!)}</Btn>}
  </div>;
}

export function ScanMachine({ data, update, onClose, onUse, useLabel }: { data: FitData; update: Update; onClose: () => void; onUse?: (exId: string) => void; useLabel?: string }) {
  const { token } = useAuth();
  const [mode, setMode] = useState<"qr" | "photo" | "list">("qr");
  const [gear, setGear] = useState<Gear | null>(null);
  const [also, setAlso] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const photo = useRef<HTMLInputElement>(null);
  const fromQr = (text: string) => {
    const g = gearFromText(text);
    if (g) { setGear(g); setNote(""); haptic("success"); }
    else { setMode("photo"); setNote("That QR code doesn't say which machine it is. Take a photo of the machine instead."); }
  };
  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setNote("");
    try {
      const r = await identify(token, file, "machine");
      const g = r.gear[0] ? GEAR_BY_ID.get(r.gear[0]) : null;
      if (g) { setGear(g); setAlso(r.gear.slice(1, 4)); haptic("success"); }
      else setNote(r.note || "That didn't look like gym equipment. Try again with the whole machine in the photo, or pick it from the list.");
    } catch (e: any) { setNote(e?.message || "The photo couldn't be read. Pick the machine from the list."); }
    finally { setBusy(false); if (photo.current) photo.current.value = ""; }
  };
  const list = useMemo(() => GEAR.filter((g) => !q.trim() || `${g.name} ${g.aka.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  if (gear) return <Sheet title="Machine" onClose={onClose} testId="fit-scan">
    <MachineGuide gear={gear} data={data} update={update} onUse={onUse ? (id) => { onUse(id); onClose(); } : undefined} useLabel={useLabel} />
    {also.length > 0 && <p className="mt-4 px-1 text-[13px]" style={{ color: C.dim }}>Not it? It might be: {also.map((id) => <button key={id} type="button" className="mr-2 font-semibold underline" style={{ color: C.lime }} onClick={() => { setGear(GEAR_BY_ID.get(id)!); setAlso([]); }}>{GEAR_BY_ID.get(id)?.name}</button>)}</p>}
    <Btn kind="soft" className="mt-4 w-full" onClick={() => { setGear(null); setAlso([]); }}><ScanLine className="h-5 w-5" />Scan another</Btn>
  </Sheet>;
  return <Sheet title="Scan a machine" onClose={onClose} testId="fit-scan">
    <Chips label="How to find it" value={mode} onChange={(m) => { setMode(m); setNote(""); }} items={[{ id: "qr", label: "QR code" }, { id: "photo", label: "Photo" }, { id: "list", label: "Pick from list" }]} />
    {note && <p className="mt-3 rounded-[10px] px-3 py-2 text-[14px]" style={{ background: C.tint }} role="status">{note}</p>}
    {mode === "qr" && <QrScanner onText={fromQr} onError={(m) => { setMode("photo"); setNote(m); }} />}
    {mode === "qr" && <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Works with the QR codes many gyms put on their machines.</p>}
    {mode === "photo" && <>
      <button type="button" onClick={() => photo.current?.click()} disabled={busy} className="mt-3 flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-[14px] text-center" style={{ background: C.card, boxShadow: `inset 0 0 0 2px ${C.line}` }} data-testid="fit-scan-photo">
        {busy ? <Loader2 className="h-10 w-10 animate-spin" style={{ color: C.lime }} /> : <Camera className="h-10 w-10" style={{ color: C.lime }} />}
        <span className="text-[22px]" style={display}>{busy ? "Looking at it…" : "Take a photo of the machine"}</span>
        <span className="px-6 text-[13px]" style={{ color: C.dim }}>Get the whole machine in the shot. The photo isn't kept.</span></button>
      <input ref={photo} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void fromPhoto(e.target.files?.[0])} />
    </>}
    {mode === "list" && <>
      <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.dim }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leg press, rower…" aria-label="Search machines" className={`${inputCls} !pl-9`} style={inputStyle} /></div>
      <div className="mt-2 space-y-1.5">{list.map((g) => <button key={g.id} type="button" onClick={() => setGear(g)} className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left" style={{ background: C.card }} data-testid={`fit-scan-pick-${g.id}`}>
        <span aria-hidden>{g.e}</span><span className="flex-1 text-[15px] font-semibold">{g.name}</span><ChevronRight className="h-4 w-4" style={{ color: C.dim }} /></button>)}</div>
    </>}
  </Sheet>;
}

// ——— Swapping an exercise during a workout ————————————————————————————————————————————————————————
export function SwapSheet({ exId, data, exclude, onPick, onScan, onClose }: { exId: string; data: FitData; exclude: string[]; onPick: (exId: string) => void; onScan: () => void; onClose: () => void }) {
  const ex = CATALOG_BY_ID.get(exId);
  const { equip, gear } = myEquip(data);
  const alts = useMemo(() => alternatives(exId, equip, exclude, data.workouts, gear).slice(0, 12), [exId, equip, exclude, data.workouts, gear]);
  return <Sheet title="Swap exercise" onClose={onClose} testId="fit-swap">
    <p className="px-1 text-[15px]" style={{ color: C.steel }}>{ex ? `Same muscle as ${ex.name} (${(MUSCLE_NAME[ex.muscle] ?? ex.muscle).toLowerCase()})` : "Pick a replacement"}{data.profile.gym ? `, with equipment at ${gymLabel(data.profile.gym)}.` : "."}</p>
    <div className="mt-3 space-y-2">{alts.map((a) => <Card key={a.id} onClick={() => { haptic("medium"); onPick(a.id); }} className="flex items-center gap-3 !p-3" testId={`fit-swap-${a.id}`}>
      <ArrowLeftRight className="h-5 w-5 shrink-0" style={{ color: C.lime }} />
      <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-semibold">{a.name}</p><p className="text-[12px] capitalize" style={{ color: C.dim }}>{a.equipment}</p></div></Card>)}
      {!alts.length && <p className="px-1 text-[14px]" style={{ color: C.dim }}>Nothing else works this muscle with your equipment. Scan a machine you see instead.</p>}</div>
    <Btn kind="soft" className="mt-4 w-full" onClick={onScan}><QrCode className="h-5 w-5" />Scan a machine instead</Btn>
  </Sheet>;
}

// ——— After the workout ——————————————————————————————————————————————————————————————————————————
export function Debrief({ w, data }: { w: Workout; data: FitData }) {
  const d = useMemo(() => debrief(w, data), [w, data]);
  const [reminded, setReminded] = useState<"" | "set" | "web">("");
  const [open, setOpen] = useState<string | null>(null);
  const by = new Date(d.eatBy).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const levelColor = { light: C.green, moderate: C.orange, strong: C.red } as const;
  const remind = async () => {
    const ok = await scheduleRefuel(Date.now() + 60 * 60_000, `Have ${d.protein.lo}–${d.protein.hi} g of protein${d.carbs ? ` and ${d.carbs.lo}–${d.carbs.hi} g of carbs` : ""} in the next hour.`);
    setReminded(ok ? "set" : "web"); haptic("light");
  };
  return <div data-testid="fit-debrief">
    {d.sore.length > 0 && <><Title>Expect to feel</Title>
      <Card className="!p-4"><p className="text-[14px]" style={{ color: C.steel }}>Soreness usually peaks {d.peak}.</p>
        <ul className="mt-3 space-y-2">{d.sore.map((s) => <li key={s.muscle} className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: levelColor[s.level] }} aria-hidden />
          <span className="flex-1 text-[15px] font-semibold">{s.muscle}</span>
          <span className="text-[13px]" style={{ color: C.dim }}>{s.level === "strong" ? "Very sore" : s.level === "moderate" ? "Sore" : "A little sore"}{s.isNew ? " · new exercise" : ""}</span></li>)}</ul></Card></>}
    <Title>Refuel</Title>
    <Card className="!p-4"><div className="flex items-start gap-3"><Utensils className="mt-0.5 h-6 w-6 shrink-0" style={{ color: C.lime }} />
      <div className="min-w-0 flex-1"><p className="text-[22px] leading-none" style={display}>Eat by {by}</p>
        <p className="mt-1.5 text-[15px]"><b>{d.protein.lo}–{d.protein.hi} g protein</b>{d.carbs ? <> and <b>{d.carbs.lo}–{d.carbs.hi} g carbs</b></> : null}.</p>
        <p className="mt-1 text-[13px]" style={{ color: C.dim }}>Like a protein shake and a banana, chicken and rice, or Greek yogurt with fruit. Within a couple of hours is plenty.</p></div></div>
      <Btn kind="soft" className="mt-3 w-full" onClick={() => void remind()} disabled={reminded === "set"} testId="fit-refuel-remind"><Bell className="h-5 w-5" />{reminded === "set" ? "Reminder set for 1 hour" : "Remind me in 1 hour"}</Btn>
      {reminded === "web" && <p className="mt-2 text-[13px]" style={{ color: C.dim }}>Reminders work in the Arise Fit iPhone app with notifications on.</p>}</Card>
    <Card className="mt-2 flex items-center gap-3 !p-4"><Droplets className="h-6 w-6 shrink-0" style={{ color: C.blue }} /><p className="text-[15px]">Drink about <b>{d.waterMl >= 1000 ? `${(d.waterMl / 1000).toFixed(1)} L` : `${d.waterMl} ml`}</b> ({Math.round(d.waterMl / 29.6)} oz) over the next hour.</p></Card>
    <Title>Recovery</Title>
    <Card className="!p-4"><ul className="space-y-2">{d.tips.map((t, i) => <li key={i} className="text-[15px] leading-snug">• {t}</li>)}</ul></Card>
    <Title>Supplements</Title>
    <div className="space-y-2">{SUPPLEMENTS.map((s) => <Card key={s.id} className="!p-4">
      <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id} className="flex w-full items-center gap-3 text-left" data-testid={`fit-supp-${s.id}`}>
        <span className="text-[24px]" aria-hidden>{s.e}</span><span className="min-w-0 flex-1"><span className="block text-[20px] leading-none" style={display}>{s.name}</span><span className="mt-1 block text-[13px]" style={{ color: C.steel }}>{s.lead}</span></span>
        <ChevronRight className="h-5 w-5 shrink-0 transition-transform" style={{ color: C.dim, transform: open === s.id ? "rotate(90deg)" : undefined }} /></button>
      {open === s.id && <ul className="mt-3 space-y-1.5">{s.points.map((p, i) => <li key={i} className="text-[14px] leading-snug">• {p}</li>)}</ul>}
    </Card>)}</div>
    <p className="mt-4 px-1 text-[11px] leading-relaxed" style={{ color: C.dim }}>General guidance for healthy adults, not medical advice. Ask a doctor or dietitian about your own needs.</p>
  </div>;
}
