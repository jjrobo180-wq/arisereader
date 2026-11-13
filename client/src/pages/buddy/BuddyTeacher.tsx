// TTS Buddy on the teacher's phone: snap a worksheet, check how it was split into questions, send it to the class,
// and link each laptop by the 4-digit code on its screen. Answers come in live.
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, Laptop as LaptopIcon, Loader2, Plus, RotateCcw, Send, Sparkles, Trash2, Unlink, Volume2, X } from "lucide-react";
import { ACC_KEYS, ACC_LABEL, LETTERS, cleanAcc, type Acc, type Item, type ItemKind, type Laptop, type Supports, type Worksheet } from "@shared/ttsBuddy";
import { API_BASE } from "@/lib/queryClient";
import { B, BRAND_FONT, FONT, call, cropPhoto, loadImage, shrinkPhoto, snapBox, teacherKey, useBuddyFont, useVoice, type Clip } from "./buddyApi";
import { BuddyMark } from "./BuddyMark";
import { Figure, Words } from "./BuddyLaptop";

type Summary = { id: string; title: string; questions: number; steps: number; createdAt: string };
type LaptopView = Laptop & { answered: number; questions: number; worksheetTitle: string };
type Home = { classCode: string; current: string; worksheets: Summary[]; laptops: LaptopView[]; aiReady: boolean; acc: Acc };
const KIND: Record<ItemKind, string> = { read: "Directions or reading", choice: "Multiple choice", short: "Short answer", long: "Write sentences" };

const Btn = ({ children, onClick, kind = "main", disabled, className = "", testId }: { children: React.ReactNode; onClick?: () => void; kind?: "main" | "soft" | "ink"; disabled?: boolean; className?: string; testId?: string }) =>
  <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className={`flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-4 text-[17px] font-bold disabled:opacity-40 ${className}`}
    style={kind === "main" ? { background: B.accent, color: "#fff", boxShadow: `0 4px 0 ${B.accentDeep}` } : kind === "ink" ? { background: B.ink, color: "#fff" } : { background: B.card, color: B.ink, border: `2px solid ${B.line}` }}>{children}</button>;

export default function BuddyTeacher() {
  useBuddyFont();
  const [home, setHome] = useState<Home | null>(null);
  const [open, setOpen] = useState<string>("");
  const [toast, setToast] = useState("");
  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? "" : t)), 3500); }, []);
  const load = useCallback(async () => { try { setHome(await call<Home>("/teacher", { teacher: true })); } catch (e: any) { say(e.message); } }, [say]);
  useEffect(() => { void load(); const t = setInterval(() => { if (!document.hidden) void load(); }, 4000); return () => clearInterval(t); }, [load]);

  return <div className="min-h-[100dvh] w-full" style={{ background: B.bg, color: B.ink, fontFamily: FONT }} data-testid="buddy-teacher">
    <div className="mx-auto max-w-xl px-4 pb-16 pt-4">
      {open ? <Editor id={open} onBack={() => { setOpen(""); void load(); }} onSent={() => { setOpen(""); void load(); say("Sent to the class"); }} say={say} />
        : <Main home={home} reload={load} onOpen={setOpen} say={say} />}
    </div>
    {toast && <div className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-md rounded-[14px] px-4 py-3 text-center text-[16px] font-bold text-white" style={{ background: B.ink }} role="status">{toast}</div>}
  </div>;
}

function Main({ home, reload, onOpen, say }: { home: Home | null; reload: () => void; onOpen: (id: string) => void; say: (m: string) => void }) {
  const current = home?.worksheets.find((w) => w.id === home.current);
  return <>
    <header className="flex items-center gap-3"><BuddyMark size={40} /><p className="flex-1 text-[26px] font-semibold" style={{ fontFamily: BRAND_FONT }}>TTS Buddy</p>
      {home?.classCode && <span className="rounded-[10px] px-3 py-1.5 text-[15px] font-bold" style={{ background: B.card, border: `2px solid ${B.line}` }}>Class <b style={{ letterSpacing: ".15em" }}>{home.classCode}</b></span>}</header>
    <Snap onDone={(ws) => { onOpen(ws.id); reload(); }} say={say} aiReady={home?.aiReady !== false} first={!home?.worksheets.length} />
    {current && <ClassPanel home={home!} current={current} reload={reload} say={say} />}
    {home && home.worksheets.length > 0 && <>
      <h2 className="mt-8 text-[20px] font-bold">My worksheets</h2>
      <div className="mt-3 space-y-2">{home.worksheets.map((w) => <button key={w.id} type="button" onClick={() => onOpen(w.id)} className="flex w-full items-center gap-3 rounded-[16px] p-4 text-left" style={{ background: B.card, border: `2px solid ${w.id === home.current ? B.accent : B.line}` }}>
        <span className="min-w-0 flex-1"><span className="block truncate text-[18px] font-bold">{w.title}</span><span className="text-[14px]" style={{ color: B.dim }}>{w.questions} question{w.questions === 1 ? "" : "s"} · {new Date(w.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{w.id === home.current ? " · on laptops now" : ""}</span></span>
        <ChevronRight className="h-5 w-5" style={{ color: B.dim }} /></button>)}</div>
    </>}
    {!home && <div className="mt-10 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: B.dim }} /></div>}
    {home && !home.worksheets.length && <Steps />}
  </>;
}

function Steps() {
  return <div className="mt-8 space-y-3">{[
    ["Snap the worksheet", "Take a photo of each page. TTS Buddy splits it into one question at a time."],
    ["Open arisetodo.com/buddy on the laptop", "The child picks “I'm a student”. The laptop shows a 4-digit code."],
    ["Type the code here", "The worksheet appears on that laptop and reads every question and answer out loud, word by word."],
  ].map(([t, d], i) => <div key={i} className="flex gap-3 rounded-[16px] p-4" style={{ background: B.card, border: `2px solid ${B.line}` }}>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[17px] font-bold text-white" style={{ background: B.ink, fontFamily: BRAND_FONT }}>{i + 1}</span>
    <div><p className="text-[17px] font-bold">{t}</p><p className="text-[15px]" style={{ color: B.dim }}>{d}</p></div></div>)}</div>;
}

function Snap({ onDone, say, aiReady, first }: { onDone: (ws: Worksheet) => void; say: (m: string) => void; aiReady: boolean; first: boolean }) {
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    try { const shrunk = await Promise.all(Array.from(files).slice(0, 4).map(shrinkPhoto)); setPages((p) => [...p, ...shrunk].slice(0, 4)); } catch (e: any) { say(e.message); }
    if (input.current) input.current.value = "";
  };
  const read = async () => {
    setBusy(true);
    try {
      const r = await call<{ worksheet: Worksheet }>("/teacher/read", { teacher: true, body: { images: pages } });
      // Pictures: the reader marked where each one is; cut them out of the photos right here and save them.
      const figs = r.worksheet.items.filter((i) => i.figure && !i.figure.img && pages[i.figure.page - 1]);
      if (figs.length) setStage(`Cutting out ${figs.length} picture${figs.length === 1 ? "" : "s"}…`);
      for (const it of figs) {
        try {
          const photo = await loadImage(pages[it.figure!.page - 1]);
          const box = snapBox(photo, it.figure!.box);
          const image = await cropPhoto(photo, box, 12);
          await call(`/teacher/worksheets/${r.worksheet.id}/figures/${it.id}`, { method: "PUT", teacher: true, body: { image, page: it.figure!.page, box, alt: it.figure!.alt } });
        }
        catch { /* the teacher can add it in the editor */ }
      }
      setPages([]); onDone(r.worksheet);
    }
    catch (e: any) { say(e.message); } finally { setBusy(false); setStage(""); }
  };
  return <section className="mt-5 rounded-[22px] p-5" style={{ background: first ? B.ink : B.card, color: first ? "#fff" : B.ink, border: first ? "none" : `2px solid ${B.line}` }}>
    <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void pick(e.target.files)} data-testid="buddy-photo-input" />
    {first && !pages.length && <><p className="text-[28px] font-semibold leading-tight" style={{ fontFamily: BRAND_FONT }}>Snap a worksheet.<br />It reads it to your students.</p><p className="mt-2 text-[16px] opacity-80">One question at a time, out loud, with each word lit up as it's read.</p></>}
    {pages.length > 0 && <div className="mb-4 flex gap-2 overflow-x-auto">{pages.map((p, i) => <div key={i} className="relative shrink-0"><img src={p} alt={`Page ${i + 1}`} className="h-28 w-20 rounded-[10px] object-cover" style={{ border: `2px solid ${B.line}` }} />
      <button type="button" aria-label={`Remove page ${i + 1}`} onClick={() => setPages((x) => x.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-white shadow" style={{ color: B.ink }}><X className="h-4 w-4" /></button></div>)}
      {pages.length < 4 && <button type="button" onClick={() => input.current?.click()} className="grid h-28 w-20 shrink-0 place-items-center rounded-[10px] text-[13px] font-bold" style={{ border: `2px dashed ${B.dim}`, color: first ? "#fff" : B.dim }}><span className="grid place-items-center"><Plus className="h-6 w-6" />Page</span></button>}</div>}
    {!aiReady ? <p className="text-[15px] opacity-80">Reading worksheets isn't turned on yet.</p>
      : pages.length ? <Btn className="w-full" onClick={read} disabled={busy} testId="buddy-read-photos">{busy ? <><Loader2 className="h-5 w-5 animate-spin" />{stage || "Reading the worksheet…"}</> : <>Make it a quiz ({pages.length} page{pages.length === 1 ? "" : "s"})</>}</Btn>
      : <Btn className={`w-full ${first ? "mt-5" : ""}`} onClick={() => input.current?.click()} testId="buddy-snap"><Camera className="h-5 w-5" />Snap a worksheet</Btn>}
  </section>;
}

/** On/off switches for each accommodation (shared by the class default and each laptop). */
function AccSwitches({ acc, onChange, compact }: { acc: Acc; onChange: (a: Acc) => void; compact?: boolean }) {
  return <div className={compact ? "flex flex-wrap gap-1.5" : "space-y-1.5"} data-testid="buddy-acc">{ACC_KEYS.map((k) => {
    const on = acc[k];
    return compact ? <button key={k} type="button" aria-pressed={on} onClick={() => onChange({ ...acc, [k]: !on })} className="rounded-full px-3 py-1.5 text-[14px] font-bold" style={{ background: on ? B.ink : B.bg, color: on ? "#fff" : B.dim, border: `2px solid ${on ? B.ink : B.line}` }}>{on ? "✓ " : ""}{ACC_LABEL[k][0]}</button>
      : <label key={k} className="flex cursor-pointer items-start gap-3 rounded-[12px] p-2" style={{ background: on ? B.soft : "transparent" }}>
        <input type="checkbox" checked={on} onChange={() => onChange({ ...acc, [k]: !on })} className="mt-1 h-5 w-5 shrink-0" />
        <span><span className="block text-[16px] font-bold">{ACC_LABEL[k][0]}</span><span className="text-[13px]" style={{ color: B.dim }}>{ACC_LABEL[k][1]}</span></span></label>;
  })}</div>;
}

function ClassPanel({ home, current, reload, say }: { home: Home; current: Summary; reload: () => void; say: (m: string) => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [busy, setBusy] = useState(false);
  const [openLaptop, setOpenLaptop] = useState("");
  const [showAcc, setShowAcc] = useState(false);
  const link = async () => {
    setBusy(true);
    try { await call("/teacher/link", { teacher: true, body: { code, name, worksheetId: current.id } }); setCode(""); setName(""); say("Linked. The worksheet is on that laptop now."); reload(); }
    catch (e: any) { say(e.message); } finally { setBusy(false); }
  };
  const setDefault = async (acc: Acc, everyone = false) => { try { const r = await call<{ changed: number }>("/teacher/acc", { teacher: true, body: { acc, everyone } }); say(everyone ? `Set for ${r.changed} laptop${r.changed === 1 ? "" : "s"}` : "Saved for new laptops"); reload(); } catch (e: any) { say(e.message); } };
  const anyOn = ACC_KEYS.filter((k) => home.acc?.[k]);
  return <section className="mt-5 rounded-[22px] p-5" style={{ background: B.card, border: `2px solid ${B.line}` }} data-testid="buddy-class">
    <p className="text-[14px] font-bold uppercase tracking-wide" style={{ color: B.dim }}>On laptops now</p>
    <p className="text-[22px] font-bold">{current.title}</p>
    <div className="mt-4 rounded-[16px] p-4" style={{ background: B.bg }}>
      <p className="text-[16px] font-bold">Link a laptop</p>
      <p className="text-[14px]" style={{ color: B.dim }}>Type the 4 numbers on the laptop's screen (arisetodo.com/buddy). Students can also type the class code <b style={{ color: B.ink, letterSpacing: ".1em" }}>{home.classCode}</b>.</p>
      <div className="mt-3 flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1234" aria-label="Laptop code" data-testid="buddy-link-code"
          className="w-28 rounded-[12px] px-3 py-3 text-center text-[24px] font-bold tracking-[.2em] outline-none" style={{ border: `2px solid ${B.ink}`, fontFamily: BRAND_FONT, background: "#fff" }} />
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="Name or seat (optional)" aria-label="Student name or seat" className="min-w-0 flex-1 rounded-[12px] px-3 text-[16px] outline-none" style={{ border: `2px solid ${B.line}`, background: "#fff" }} />
      </div>
      <Btn className="mt-3 w-full" disabled={code.length !== 4 || busy} onClick={link} testId="buddy-link">{busy ? "Linking…" : "Link laptop"}</Btn>
    </div>
    <button type="button" onClick={() => setShowAcc((x) => !x)} className="mt-4 flex w-full items-center gap-2 text-left" data-testid="buddy-class-acc-toggle">
      <span className="flex-1"><span className="block text-[16px] font-bold">Accommodations for new laptops</span><span className="text-[13px]" style={{ color: B.dim }}>{anyOn.length ? anyOn.map((k) => ACC_LABEL[k][0]).join(", ") : "None. Each laptop can have its own; tap a laptop below."}</span></span>
      <ChevronDown className={`h-5 w-5 transition-transform ${showAcc ? "rotate-180" : ""}`} /></button>
    {showAcc && <div className="mt-2"><AccSwitches acc={cleanAcc(home.acc)} onChange={(a) => void setDefault(a)} />
      {home.laptops.length > 0 && <Btn kind="soft" className="mt-2 w-full !text-[15px]" onClick={() => void setDefault(cleanAcc(home.acc), true)}>Use these for every linked laptop now</Btn>}</div>}
    <p className="mt-5 text-[16px] font-bold">{home.laptops.length ? `${home.laptops.length} laptop${home.laptops.length === 1 ? "" : "s"}` : "No laptops linked yet"}</p>
    <div className="mt-2 space-y-2">{home.laptops.map((l, i) => <LaptopRow key={l.id} l={l} n={i} open={openLaptop === l.id} onToggle={() => setOpenLaptop((x) => (x === l.id ? "" : l.id))} reload={reload} say={say} worksheetId={current.id} />)}</div>
  </section>;
}

function LaptopRow({ l, n, open, onToggle, reload, say, worksheetId }: { l: LaptopView; n: number; open: boolean; onToggle: () => void; reload: () => void; say: (m: string) => void; worksheetId: string }) {
  const [ws, setWs] = useState<Worksheet | null>(null);
  useEffect(() => { if (open && !ws) call<{ worksheet: Worksheet }>(`/teacher/worksheets/${l.worksheetId}`, { teacher: true }).then((r) => setWs(r.worksheet)).catch(() => {}); }, [open, ws, l.worksheetId]);
  const away = Date.now() - Date.parse(l.seen) > 90_000;
  const label = l.name || `Laptop ${n + 1}`;
  const patch = async (body: any, msg: string) => { try { await call(`/teacher/laptops/${l.id}`, { method: "PATCH", teacher: true, body }); say(msg); reload(); } catch (e: any) { say(e.message); } };
  const pct = l.questions ? Math.round((l.answered / l.questions) * 100) : 0;
  const acc = cleanAcc(l.acc); const accOn = ACC_KEYS.filter((k) => acc[k]);
  return <div className="rounded-[14px]" style={{ border: `2px solid ${B.line}` }} data-testid="buddy-laptop-row">
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
      <LaptopIcon className="h-6 w-6 shrink-0" style={{ color: away ? B.dim : B.green }} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[17px] font-bold">{label}</span>
        <span className="text-[13px]" style={{ color: B.dim }}>{l.done ? "Finished" : `${l.answered} of ${l.questions} answered`}{away ? " · not seen lately" : ""}{l.worksheetId !== worksheetId ? ` · ${l.worksheetTitle}` : ""}{accOn.length ? ` · ${accOn.length} accommodation${accOn.length === 1 ? "" : "s"}` : ""}</span>
        <span className="mt-1.5 block h-2 overflow-hidden rounded-full" style={{ background: B.line }}><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: l.done ? B.green : B.accent }} /></span></span>
      {l.done && <Check className="h-6 w-6" style={{ color: B.green }} />}
    </button>
    {open && <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: B.line }}>
      <p className="mb-1.5 text-[14px] font-bold" style={{ color: B.dim }}>Accommodations for {label}</p>
      <AccSwitches compact acc={acc} onChange={(a) => void patch({ acc: a }, "Updated. The laptop changes in a few seconds.")} />
      <div className="mt-3">{ws ? ws.items.filter((i) => i.kind !== "read").map((q, i) => <div key={q.id} className="py-1.5 text-[15px]"><p style={{ color: B.dim }}>{q.number || i + 1}. {q.text}</p><p className="font-bold">{(l.answers[q.id] || "").trim() || <span style={{ color: B.dim, fontWeight: 400 }}>No answer yet</span>}</p></div>) : <Loader2 className="h-5 w-5 animate-spin" />}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn kind="soft" className="!min-h-10 !text-[14px]" onClick={() => { const v = prompt("Name or seat", l.name); if (v != null) void patch({ name: v }, "Renamed"); }}>Rename</Btn>
        <Btn kind="soft" className="!min-h-10 !text-[14px]" onClick={() => void patch({ restart: true }, "Started over")}><RotateCcw className="h-4 w-4" />Start over</Btn>
        <Btn kind="soft" className="!min-h-10 !text-[14px]" onClick={() => void patch({ unlink: true }, "Unlinked")}><Unlink className="h-4 w-4" />Unlink</Btn>
      </div>
    </div>}
  </div>;
}

/** Fix where a picture is cut from (drag the box or its corners), or add one to a question that has none. */
function CropFixer({ ws, item, onDone, onClose, say }: { ws: Worksheet; item: Item; onDone: (w: Worksheet) => void; onClose: () => void; say: (m: string) => void }) {
  const [page, setPage] = useState(item.figure?.page || 1);
  const [box, setBox] = useState<[number, number, number, number]>(item.figure?.box || [150, 150, 850, 500]);
  const [src, setSrc] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let gone = false; let made = ""; setSrc(""); setErr("");
    fetch(`${API_BASE}/api/buddy/teacher/worksheets/${ws.id}/pages/${page}`, { headers: { "x-buddy-teacher": teacherKey() } })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "That page photo isn't available."); return r.blob(); })
      .then((b) => { if (!gone) { made = URL.createObjectURL(b); setSrc(made); } }).catch((e) => !gone && setErr(e.message));
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [ws.id, page]);
  const drag = (mode: "move" | "tl" | "br") => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = frame.current; if (!el) return;
    const r = el.getBoundingClientRect(); const start = { x: e.clientX, y: e.clientY, box };
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.x) / r.width) * 1000, dy = ((ev.clientY - start.y) / r.height) * 1000;
      const [a, b, c, d] = start.box; const cl = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
      if (mode === "move") { const w = c - a, h = d - b; const nx = cl(Math.min(1000 - w, Math.max(0, a + dx))), ny = cl(Math.min(1000 - h, Math.max(0, b + dy))); setBox([nx, ny, nx + w, ny + h]); }
      else if (mode === "tl") setBox([cl(Math.min(a + dx, c - 30)), cl(Math.min(b + dy, d - 30)), c, d]);
      else setBox([a, b, cl(Math.max(c + dx, a + 30)), cl(Math.max(d + dy, b + 30))]);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const save = async () => {
    setBusy(true);
    try { const image = await cropPhoto(await loadImage(src), box, 0); const r = await call<{ worksheet: Worksheet }>(`/teacher/worksheets/${ws.id}/figures/${item.id}`, { method: "PUT", teacher: true, body: { image, page, box, alt: item.figure?.alt || "" } }); onDone(r.worksheet); }
    catch (e: any) { say(e.message); } finally { setBusy(false); }
  };
  const handle = "absolute h-7 w-7 rounded-full border-[3px] border-white shadow touch-none";
  return <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(20,24,33,.92)" }} data-testid="buddy-cropper">
    <div className="flex items-center gap-2 p-3 text-white"><button type="button" onClick={onClose} className="p-2" aria-label="Close"><X className="h-6 w-6" /></button><p className="flex-1 text-[17px] font-bold">Drag the box around the picture</p>
      {ws.pages > 1 && <select value={page} onChange={(e) => setPage(Number(e.target.value))} className="rounded-[8px] px-2 py-1 text-[15px] text-black" aria-label="Page">{Array.from({ length: ws.pages }, (_, i) => <option key={i} value={i + 1}>Page {i + 1}</option>)}</select>}</div>
    <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
      {err ? <p className="max-w-xs text-center text-[16px] text-white">{err}</p> : !src ? <Loader2 className="h-8 w-8 animate-spin text-white" /> :
        <div ref={frame} className="relative inline-block max-h-full select-none">
          <img src={src} alt={`Page ${page}`} className="block max-h-[70vh] w-auto max-w-full" draggable={false} />
          <div className="absolute touch-none" onPointerDown={drag("move")} style={{ left: `${box[0] / 10}%`, top: `${box[1] / 10}%`, width: `${(box[2] - box[0]) / 10}%`, height: `${(box[3] - box[1]) / 10}%`, border: `3px solid ${B.accent}`, boxShadow: "0 0 0 9999px rgba(0,0,0,.45)", cursor: "move" }}>
            <span onPointerDown={drag("tl")} className={handle} style={{ left: -14, top: -14, background: B.accent }} />
            <span onPointerDown={drag("br")} className={handle} style={{ right: -14, bottom: -14, background: B.accent }} />
          </div>
        </div>}
    </div>
    <div className="flex gap-2 p-3"><Btn kind="soft" className="flex-1" onClick={onClose}>Cancel</Btn><Btn className="flex-[2]" disabled={!src || busy} onClick={save} testId="buddy-crop-save">{busy ? "Saving…" : "Use this picture"}</Btn></div>
  </div>;
}

/** The AI-drafted accommodations for one item, editable. */
function SupportsEditor({ it, onChange }: { it: Item; onChange: (s: Supports) => void }) {
  const s: Supports = it.supports || { simple: "", steps: [], starter: "", bank: [], vocab: [], keep: [] };
  const set = (p: Partial<Supports>) => onChange({ ...s, ...p });
  const field = "w-full rounded-[8px] px-2 py-1.5 text-[15px] outline-none";
  return <div className="mt-2 space-y-2.5 rounded-[12px] p-3 text-[14px]" style={{ background: B.soft }} data-testid="buddy-supports">
    <label className="block"><span className="font-bold">{it.kind === "read" ? "Short, simple summary" : "In simpler words"}</span>
      <textarea value={s.simple} onChange={(e) => set({ simple: e.target.value })} rows={2} className={field} style={{ background: "#fff" }} /></label>
    {it.kind !== "read" && <label className="block"><span className="font-bold">Hints, one at a time (one per line)</span>
      <textarea value={s.steps.join("\n")} onChange={(e) => set({ steps: e.target.value.split("\n").slice(0, 4) })} rows={Math.max(2, s.steps.length)} className={field} style={{ background: "#fff" }} /></label>}
    {(it.kind === "short" || it.kind === "long") && <label className="block"><span className="font-bold">Sentence starter</span>
      <input value={s.starter} onChange={(e) => set({ starter: e.target.value })} className={field} style={{ background: "#fff" }} /></label>}
    {it.kind === "short" && <label className="block"><span className="font-bold">Word bank (commas between)</span>
      <input value={s.bank.join(", ")} onChange={(e) => set({ bank: e.target.value.split(",").map((x) => x.trimStart()).slice(0, 8) })} className={field} style={{ background: "#fff" }} /></label>}
    <label className="block"><span className="font-bold">Word meanings (word: meaning, one per line)</span>
      <textarea value={s.vocab.map((v) => `${v.w}: ${v.m}`).join("\n")} onChange={(e) => set({ vocab: e.target.value.split("\n").slice(0, 4).map((l) => { const [w, ...m] = l.split(":"); return { w: w.trim(), m: m.join(":").trim() }; }) })} rows={Math.max(2, s.vocab.length)} className={field} style={{ background: "#fff" }} /></label>
    {it.kind === "choice" && <div><span className="font-bold">With fewer choices, show:</span>
      <div className="mt-1 flex flex-wrap gap-1.5">{it.choices.map((c, i) => { const on = s.keep.includes(i); return <button key={i} type="button" onClick={() => set({ keep: on ? s.keep.filter((x) => x !== i) : [...s.keep, i].sort() })} className="rounded-full px-2.5 py-1 font-bold" style={{ background: on ? B.ink : "#fff", color: on ? "#fff" : B.dim }}>{LETTERS[i]}. {c}</button>; })}</div></div>}
  </div>;
}

function Editor({ id, onBack, onSent, say }: { id: string; onBack: () => void; onSent: () => void; say: (m: string) => void }) {
  const [ws, setWs] = useState<Worksheet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [openSup, setOpenSup] = useState<Record<string, boolean>>({});
  const [cropping, setCropping] = useState<Item | null>(null);
  useEffect(() => { call<{ worksheet: Worksheet }>(`/teacher/worksheets/${id}`, { teacher: true }).then((r) => setWs(r.worksheet)).catch((e) => { say(e.message); onBack(); }); }, [id, say, onBack]);
  const fetchClip = useCallback((itemId: string, part: string) => call<Clip>("/speak", { teacher: true, body: { worksheetId: id, itemId, part } }), [id]);
  const voice = useVoice(fetchClip, 1);
  const edit = (i: number, patch: Partial<Item>) => { setWs((w) => w && { ...w, items: w.items.map((it, j) => (j === i ? { ...it, ...patch, ...(patch.text != null ? { say: "" } : {}) } : it)) }); setDirty(true); };
  const save = async () => { if (!ws) return false; try { const r = await call<{ worksheet: Worksheet }>(`/teacher/worksheets/${id}`, { method: "PUT", teacher: true, body: ws }); setWs(r.worksheet); setDirty(false); return true; } catch (e: any) { say(e.message); return false; } };
  const send = async () => { setBusy(true); try { if (dirty && !(await save())) return; await call("/teacher/send", { teacher: true, body: { worksheetId: id } }); onSent(); } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  const remove = async () => { if (!confirm("Delete this worksheet?")) return; try { await call(`/teacher/worksheets/${id}`, { method: "DELETE", teacher: true }); onBack(); } catch (e: any) { say(e.message); } };
  const draft = async () => {
    setDrafting(true);
    try { if (dirty && !(await save())) return; const r = await call<{ worksheet: Worksheet; made: number }>(`/teacher/worksheets/${id}/supports`, { method: "POST", teacher: true, body: {} }); setWs(r.worksheet); setOpenSup(Object.fromEntries(r.worksheet.items.map((i) => [i.id, true]))); say(`Accommodations ready for ${r.made} step${r.made === 1 ? "" : "s"}. Check them, then turn them on per student.`); }
    catch (e: any) { say(e.message); } finally { setDrafting(false); }
  };
  const removePicture = async (it: Item) => { try { const r = await call<{ worksheet: Worksheet }>(`/teacher/worksheets/${id}/figures/${it.id}`, { method: "PUT", teacher: true, body: { remove: true } }); setWs(r.worksheet); } catch (e: any) { say(e.message); } };
  if (!ws) return <div className="mt-20 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: B.dim }} /></div>;
  const qs = ws.items.filter((i) => i.kind !== "read").length;
  const withSupports = ws.items.filter((i) => i.supports).length;
  return <div data-testid="buddy-editor">
    <div className="flex items-center gap-2"><button type="button" onClick={onBack} className="flex items-center gap-1 py-2 text-[16px] font-bold" style={{ color: B.dim }}><ChevronLeft className="h-5 w-5" />Back</button><div className="flex-1" />
      <button type="button" onClick={remove} aria-label="Delete worksheet" className="p-2" style={{ color: B.dim }}><Trash2 className="h-5 w-5" /></button></div>
    <input value={ws.title} onChange={(e) => { setWs({ ...ws, title: e.target.value.slice(0, 80) }); setDirty(true); }} aria-label="Worksheet title" className="mt-1 w-full bg-transparent text-[26px] font-bold outline-none" />
    <p className="text-[15px]" style={{ color: B.dim }}>{qs} question{qs === 1 ? "" : "s"}{ws.items.length > qs ? ` and ${ws.items.length - qs} reading step${ws.items.length - qs === 1 ? "" : "s"}` : ""}. Check the words, then send it. Tap the speaker to hear it.</p>
    <div className="mt-4 rounded-[16px] p-4" style={{ background: B.card, border: `2px solid ${B.line}` }}>
      <p className="text-[17px] font-bold">Accommodations</p>
      <p className="text-[14px]" style={{ color: B.dim }}>{withSupports ? `Ready for ${withSupports} of ${ws.items.length} steps. Edit any of them below; turn them on for each student under Link a laptop.` : "Simpler wording, short summaries, hints, a word bank, sentence starters, word meanings and fewer choices, drafted for every question. You can edit them, then turn them on for each student."}</p>
      <Btn kind={withSupports ? "soft" : "ink"} className="mt-3 w-full" onClick={draft} disabled={drafting} testId="buddy-draft">{drafting ? <><Loader2 className="h-5 w-5 animate-spin" />Writing accommodations…</> : <><Sparkles className="h-5 w-5" />{withSupports ? "Write them again" : "Make accommodations"}</>}</Btn>
    </div>
    <div className="mt-4 space-y-3">{ws.items.map((it, i) => {
      const speaking = voice.playing?.itemId === it.id && voice.playing.part === "q" ? voice.playing : null;
      return <div key={it.id} className="rounded-[16px] p-4" style={{ background: B.card, border: `2px solid ${B.line}` }} data-testid="buddy-edit-item">
        <div className="flex items-center gap-2">
          <select value={it.kind} onChange={(e) => { const k = e.target.value as ItemKind; edit(i, { kind: k, choices: k === "choice" ? (it.choices.length >= 2 ? it.choices : ["", ""]) : [] }); }} aria-label="Kind of step" className="rounded-[8px] px-2 py-1 text-[14px] font-bold" style={{ background: B.bg }}>
            {(Object.keys(KIND) as ItemKind[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</select>
          <div className="flex-1" />
          <button type="button" aria-label="Hear it" onClick={() => (speaking ? voice.stop() : void voice.play(it.id, ["q", ...it.choices.map((_, c) => `c${c}`)]))} disabled={dirty} title={dirty ? "Save to hear your changes" : ""} className="grid h-9 w-9 place-items-center rounded-full disabled:opacity-30" style={{ background: B.bg, color: B.blue }}>{speaking ? <X className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
          <button type="button" aria-label="Remove" onClick={() => { setWs({ ...ws, items: ws.items.filter((_, j) => j !== i) }); setDirty(true); }} className="grid h-9 w-9 place-items-center rounded-full" style={{ background: B.bg, color: B.dim }}><X className="h-5 w-5" /></button>
        </div>
        {speaking ? <p className="mt-2 text-[17px] leading-relaxed"><Words text={it.text} word={speaking.word} active /></p>
          : <textarea value={it.text} onChange={(e) => edit(i, { text: e.target.value })} rows={Math.min(8, Math.max(2, Math.ceil(it.text.length / 38)))} aria-label="Question" className="mt-2 w-full resize-y rounded-[10px] p-2 text-[17px] leading-relaxed outline-none" style={{ background: B.bg }} />}
        {it.figure?.img && <Figure wid={ws.id} item={it} auth={{ teacher: true }} />}
        <div className="mt-2 flex flex-wrap gap-3 text-[14px] font-bold" style={{ color: B.blue }}>
          {it.figure?.img ? <><button type="button" onClick={() => setCropping(it)} data-testid="buddy-fix-picture">Fix picture</button><button type="button" onClick={() => void removePicture(it)} style={{ color: B.dim }}>Remove picture</button></>
            : <button type="button" onClick={() => setCropping(it)} className="flex items-center gap-1"><ImageIcon className="h-4 w-4" />Add a picture from the worksheet</button>}
          <button type="button" onClick={() => setOpenSup((o) => ({ ...o, [it.id]: !o[it.id] }))} className="ml-auto" data-testid="buddy-sup-toggle">{it.supports ? "Accommodations" : "Add accommodations"} {openSup[it.id] ? "▴" : "▾"}</button>
        </div>
        {it.kind === "choice" && <div className="mt-2 space-y-1.5">{it.choices.map((c, ci) => <div key={ci} className="flex items-center gap-2">
          <span className="w-6 text-center text-[15px] font-bold" style={{ color: B.dim }}>{LETTERS[ci]}</span>
          <input value={c} onChange={(e) => edit(i, { choices: it.choices.map((x, k) => (k === ci ? e.target.value : x)) })} aria-label={`Answer ${LETTERS[ci]}`} className="min-w-0 flex-1 rounded-[8px] px-2 py-1.5 text-[16px] outline-none" style={{ background: B.bg }} />
          {it.choices.length > 2 && <button type="button" aria-label={`Remove answer ${LETTERS[ci]}`} onClick={() => edit(i, { choices: it.choices.filter((_, k) => k !== ci) })} style={{ color: B.dim }}><X className="h-4 w-4" /></button>}</div>)}
          {it.choices.length < 6 && <button type="button" onClick={() => edit(i, { choices: [...it.choices, ""] })} className="ml-8 text-[14px] font-bold" style={{ color: B.blue }}>+ Add answer</button>}</div>}
        {openSup[it.id] && <SupportsEditor it={it} onChange={(sp) => edit(i, { supports: sp })} />}
      </div>;
    })}</div>
    {voice.error && <p className="mt-3 text-[15px]" style={{ color: B.accentDeep }}>{voice.error}</p>}
    <div className="sticky bottom-0 -mx-4 mt-5 flex gap-2 px-4 pb-3 pt-3" style={{ background: B.bg }}>
      {dirty && <Btn kind="soft" className="flex-1" onClick={() => void save().then((ok) => ok && say("Saved"))}>Save</Btn>}
      <Btn className="flex-[2]" onClick={send} disabled={busy} testId="buddy-send"><Send className="h-5 w-5" />{busy ? "Sending…" : "Send to laptops"}</Btn>
    </div>
    {cropping && <CropFixer ws={ws} item={cropping} say={say} onClose={() => setCropping(null)} onDone={(w) => { setWs((cur) => cur && { ...cur, items: cur.items.map((x) => (x.id === cropping.id ? w.items.find((y) => y.id === x.id) || x : x)) }); setCropping(null); say("Picture saved"); }} />}
  </div>;
}
