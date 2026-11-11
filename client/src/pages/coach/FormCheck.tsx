// Video form checks: the client films a set in Cooked; the trainer pauses, draws on the frame, writes a note
// for each moment and can add a voice note; the client plays it back with the drawings at those moments.
// Shapes: shared/coachFormCheck.ts. Server: server/coach.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Mic, Pencil, Square, Trash2, Undo2, Video, X } from "lucide-react";
import { MARK_COLORS, markAt, strokePath, type FormCheck, type FormFeedback, type FormMark, type Stroke } from "@shared/coachFormCheck";
import { ago, coachApi, post, put, usePoll } from "./coachApi";
import { Btn, C, Card, Field, Sheet, Title, inputCls, inputStyle } from "../fit/fitUi";

type Check2 = FormCheck & { videoUrl: string; voiceUrl: string };
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

async function uploadTo(token: string | null, linkId: string, blob: Blob, type: string): Promise<string> {
  const u = await post<{ url: string; path: string }>(token, `/links/${linkId}/form-checks/upload`, { type, size: blob.size });
  const r = await fetch(u.url, { method: "PUT", headers: { "Content-Type": type, "x-upsert": "false" }, body: blob });
  if (!r.ok) throw new Error("The upload didn't go through. Check your connection and try again.");
  return u.path;
}
const videoSecs = (f: File) => new Promise<number>((res) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => { res(Number.isFinite(v.duration) ? v.duration : 0); URL.revokeObjectURL(v.src); }; v.onerror = () => res(0); v.src = URL.createObjectURL(f); });

/** The drawings for one mark, over the video. */
function Overlay({ strokes, live }: { strokes: Stroke[]; live?: Stroke | null }) {
  return <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
    {[...strokes, ...(live ? [live] : [])].map((s, i) => <path key={i} d={strokePath(s, 1000, 1000)} fill="none" stroke={s.color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }} />)}
  </svg>;
}

/** Plays a reviewed video, pausing on each note with its drawing. */
export function FormPlayer({ c, autoStopAtMarks = true }: { c: Check2; autoStopAtMarks?: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [stopped, setStopped] = useState<string[]>([]);
  const marks = c.feedback?.marks ?? [];
  const cur = markAt(marks, t);
  const onTime = () => {
    const el = v.current; if (!el) return; setT(el.currentTime);
    if (!autoStopAtMarks || el.paused) return;
    const m = marks.find((x) => !stopped.includes(x.id) && el.currentTime >= x.t && el.currentTime - x.t < 0.6);
    if (m) { el.pause(); el.currentTime = m.t; setStopped((s) => [...s, m.id]); }
  };
  return <div>
    <div className="relative overflow-hidden rounded-[14px] bg-black">
      <video ref={v} src={c.videoUrl} playsInline controls className="max-h-[60vh] w-full" onTimeUpdate={onTime} onSeeked={() => setT(v.current?.currentTime ?? 0)} onPlay={() => { if ((v.current?.currentTime ?? 0) < 0.3) setStopped([]); }} data-testid="fc-video" />
      {cur && <Overlay strokes={cur.strokes} />}
      {cur?.text && <p className="absolute inset-x-3 bottom-14 rounded-[10px] bg-black/75 px-3 py-2 text-[15px] font-semibold text-white">{cur.text}</p>}
    </div>
    {marks.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{marks.map((m, i) => <button key={m.id} type="button" onClick={() => { if (v.current) { v.current.pause(); v.current.currentTime = m.t; setT(m.t); } }} className="h-8 rounded-full px-3 text-[13px] font-semibold" style={cur?.id === m.id ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }}>{i + 1} · {fmt(m.t)}</button>)}</div>}
  </div>;
}

function FeedbackView({ c }: { c: Check2 }) {
  const f = c.feedback; if (!f) return null;
  return <div className="mt-3 space-y-2">
    {f.rating && <p className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold" style={f.rating === "good" ? { background: "rgba(52,199,89,.15)", color: C.green } : { background: C.emberSoft, color: C.orange }}>{f.rating === "good" ? <><Check className="h-4 w-4" />Looks good</> : "A few things to fix"}</p>}
    {f.text && <p className="whitespace-pre-line text-[16px] leading-relaxed">{f.text}</p>}
    {c.voiceUrl && <audio src={c.voiceUrl} controls className="w-full" data-testid="fc-voice" />}
    {f.marks.filter((m) => m.text).length > 0 && <ol className="space-y-1">{f.marks.filter((m) => m.text).map((m) => <li key={m.id} className="text-[14px]"><b style={{ color: C.lime }}>{fmt(m.t)}</b> {m.text}</li>)}</ol>}
  </div>;
}

/** Cooked: the client's form checks with this trainer. */
export function ClientFormChecks({ token, linkId, trainer, say }: { token: string | null; linkId: string; trainer: string; say: (m: string) => void }) {
  const { data, reload } = usePoll(() => coachApi<{ checks: Check2[] }>(token, `/links/${linkId}/form-checks`), [token, linkId], 60_000);
  const [file, setFile] = useState<File | null>(null);
  const [ex, setEx] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(""); const [open, setOpen] = useState<Check2 | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 100 * 1024 * 1024) { say("That video is over 100 MB. Trim it to just the set."); return; } setFile(f); };
  const send = async () => {
    if (!file) return; setBusy("Uploading…");
    try {
      const type = (file.type || "video/mp4").split(";")[0]; const secs = await videoSecs(file);
      const path = await uploadTo(token, linkId, file, type);
      setBusy("Sending…");
      await post(token, `/links/${linkId}/form-checks`, { video: path, exName: ex, note, secs });
      setFile(null); setEx(""); setNote(""); reload(); say(`Sent to ${trainer}.`);
    } catch (e: any) { say(e.message); } finally { setBusy(""); }
  };
  const list = data?.checks ?? [];
  return <div data-testid="fc-client">
    {!file ? <label className="flex min-h-[86px] cursor-pointer items-center gap-3 rounded-[16px] p-4" style={{ background: "linear-gradient(150deg, var(--fit-accent), var(--fit-accent-deep))", color: "var(--fit-on-accent)" }} data-testid="fc-record">
      <Video className="h-7 w-7 shrink-0" /><span className="flex-1"><b className="block text-[17px]">Film a set for {trainer}</b><span className="text-[13px] opacity-90">Prop your phone up, film from the side, send it. {trainer} draws on it and tells you what to fix.</span></span>
      <input type="file" accept="video/*" capture="environment" className="sr-only" onChange={pick} /></label>
      : <Card className="!p-4">
        <video src={preview} playsInline muted controls className="max-h-64 w-full rounded-[12px] bg-black" />
        <Field label="Which exercise?"><input value={ex} onChange={(e) => setEx(e.target.value.slice(0, 80))} placeholder="Back squat, 3rd set" className={inputCls} style={inputStyle} data-testid="fc-ex" /></Field>
        <div className="mt-2"><Field label={`Anything for ${trainer}? (optional)`}><textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 600))} rows={2} placeholder="My knee felt weird on the way up" className="w-full rounded-[12px] p-3 text-[16px] outline-none" style={inputStyle} /></Field></div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2"><Btn kind="soft" disabled={!!busy} onClick={() => setFile(null)}>Cancel</Btn><Btn disabled={!!busy} onClick={send} testId="fc-send">{busy || `Send to ${trainer}`}</Btn></div>
      </Card>}
    <Title>Your videos</Title>
    {list.length ? <div className="space-y-2">{list.map((c) => <Card key={c.id} onClick={() => setOpen(c)} className="!p-3.5"><div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: c.status === "reviewed" ? C.lime : C.card2, color: c.status === "reviewed" ? "var(--fit-on-accent)" : C.dim }}>{c.status === "reviewed" ? <Check className="h-5 w-5" /> : <Video className="h-5 w-5" />}</span>
      <span className="min-w-0 flex-1"><b className="block truncate">{c.exName}</b><span className="text-[13px]" style={{ color: C.dim }}>{c.status === "reviewed" ? `Reviewed · ${c.feedback?.marks.length || 0} notes on the video` : `Waiting for ${trainer}`} · {ago(c.at)}</span></span></div></Card>)}</div>
      : <p className="text-[14px]" style={{ color: C.dim }}>{data ? "No videos yet." : "Loading…"}</p>}
    {open && <Sheet title={open.exName} onClose={() => setOpen(null)} testId="fc-view">
      <FormPlayer c={open} />
      {open.note && <p className="mt-3 text-[14px]" style={{ color: C.dim }}>You: {open.note}</p>}
      {open.feedback ? <FeedbackView c={open} /> : <p className="mt-3 text-[15px]" style={{ color: C.dim }}>{trainer} hasn't reviewed this yet. You'll get a notification.</p>}
      <button type="button" onClick={async () => { if (!window.confirm("Delete this video?")) return; await put(token, `/links/${linkId}/form-checks/${open.id}`, { remove: true }).catch(() => {}); setOpen(null); reload(); }} className="mt-6 w-full py-2 text-[13px] font-semibold" style={{ color: C.dim }}>Delete video</button>
    </Sheet>}
  </div>;
}

/** Cooked PT: a client's form checks, to review. */
export function TrainerFormChecks({ token, linkId, name, say }: { token: string | null; linkId: string; name: string; say: (m: string) => void }) {
  const { data, reload } = usePoll(() => coachApi<{ checks: Check2[] }>(token, `/links/${linkId}/form-checks`), [token, linkId], 60_000);
  const [open, setOpen] = useState<Check2 | null>(null);
  const list = data?.checks ?? [];
  const first = name.split(" ")[0];
  return <div data-testid="fc-trainer">
    {list.length ? <div className="space-y-2">{list.map((c) => <Card key={c.id} onClick={() => setOpen(c)} className="!p-3.5"><div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: c.status === "new" ? C.lime : C.card2, color: c.status === "new" ? "var(--fit-on-accent)" : C.dim }}><Video className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><b className="block truncate">{c.exName}</b><span className="text-[13px]" style={{ color: C.dim }}>{c.status === "new" ? "Needs your review" : "Reviewed"} · {ago(c.at)}{c.note ? ` · "${c.note.slice(0, 40)}"` : ""}</span></span></div></Card>)}</div>
      : <Card className="text-center"><Video className="mx-auto h-7 w-7" style={{ color: C.dim }} /><p className="mt-2 text-[14px]" style={{ color: C.dim }}>{data ? `When ${first} films a set in Cooked (My trainer → Form), it shows up here for you to draw on and reply.` : "Loading…"}</p></Card>}
    {open && <Reviewer token={token} linkId={linkId} c={open} first={first} say={say} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}
  </div>;
}

function Reviewer({ token, linkId, c, first, say, onClose, onDone }: { token: string | null; linkId: string; c: Check2; first: string; say: (m: string) => void; onClose: () => void; onDone: () => void }) {
  const v = useRef<HTMLVideoElement>(null); const box = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<FormMark[]>(c.feedback?.marks ?? []);
  const [text, setText] = useState(c.feedback?.text ?? ""); const [rating, setRating] = useState<FormFeedback["rating"]>(c.feedback?.rating ?? "");
  const [drawing, setDrawing] = useState<FormMark | null>(null); const [live, setLive] = useState<Stroke | null>(null); const [color, setColor] = useState(MARK_COLORS[0]);
  const [voice, setVoice] = useState(c.feedback?.voice ?? ""); const [voiceUrl, setVoiceUrl] = useState(c.voiceUrl);
  const [rec, setRec] = useState<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const [busy, setBusy] = useState("");
  const [t, setT] = useState(0);
  const startMark = () => { const el = v.current; if (!el) return; el.pause(); setDrawing({ id: Math.random().toString(36).slice(2, 10), t: Math.round(el.currentTime * 100) / 100, strokes: [], text: "" }); };
  const pt = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))] as [number, number]; };
  const down = (e: React.PointerEvent) => { if (!drawing) return; (e.target as Element).setPointerCapture?.(e.pointerId); setLive({ color, pts: [pt(e)] }); };
  const move = (e: React.PointerEvent) => { if (!live) return; const p = pt(e); const last = live.pts[live.pts.length - 1]; if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.004 && live.pts.length < 400) setLive({ ...live, pts: [...live.pts, p] }); };
  const up = () => { if (live && drawing && live.pts.length > 1) setDrawing({ ...drawing, strokes: [...drawing.strokes, live] }); setLive(null); };
  const keep = () => { if (drawing && (drawing.strokes.length || drawing.text.trim())) setMarks((m) => [...m.filter((x) => x.id !== drawing.id), drawing].sort((a, b) => a.t - b.t)); setDrawing(null); };
  const recStart = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/mp4", "audio/webm"].find((x) => (window as any).MediaRecorder?.isTypeSupported?.(x)) ?? "";
      const r = new MediaRecorder(s, type ? { mimeType: type } : undefined); chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        s.getTracks().forEach((x) => x.stop());
        const kind = (r.mimeType || type || "audio/mp4").split(";")[0]; const blob = new Blob(chunks.current, { type: kind });
        setBusy("Saving voice note…");
        try { const p = await uploadTo(token, linkId, blob, kind); setVoice(p); setVoiceUrl(URL.createObjectURL(blob)); } catch (e: any) { say(e.message); } finally { setBusy(""); }
      };
      r.start(); setRec(r);
    } catch { say("Cooked PT needs the microphone for voice notes. Allow it in Settings."); }
  };
  const save = async () => {
    setBusy("Sending…");
    try { await post(token, `/links/${linkId}/form-checks/${c.id}/feedback`, { feedback: { text, marks, voice, rating } }); say(`Sent to ${first}.`); onDone(); } catch (e: any) { say(e.message); setBusy(""); }
  };
  const cur = drawing ?? markAt(marks, t);
  return <Sheet title={c.exName} onClose={onClose} testId="fc-review">
    {c.note && <p className="mb-2 rounded-[12px] p-3 text-[15px]" style={{ background: C.card2 }}><b>{first}:</b> {c.note}</p>}
    <div ref={box} className="relative overflow-hidden rounded-[14px] bg-black" style={{ touchAction: drawing ? "none" : undefined }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <video ref={v} src={c.videoUrl} playsInline controls={!drawing} className="max-h-[58vh] w-full" onTimeUpdate={() => setT(v.current?.currentTime ?? 0)} onSeeked={() => setT(v.current?.currentTime ?? 0)} />
      {cur && <Overlay strokes={cur.strokes} live={drawing ? live : null} />}
      {drawing && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white">Drawing at {fmt(drawing.t)}</span>}
    </div>
    {!drawing ? <Btn className="mt-3 w-full" onClick={startMark} testId="fc-draw"><Pencil className="h-5 w-5" />Pause here and draw</Btn>
      : <Card className="mt-3 !p-3">
        <div className="flex items-center gap-2">{MARK_COLORS.map((x) => <button key={x} type="button" aria-label={`Color ${x}`} onClick={() => setColor(x)} className="h-8 w-8 rounded-full" style={{ background: x, boxShadow: color === x ? `0 0 0 3px ${C.bg}, 0 0 0 5px ${x}` : "inset 0 0 0 1px rgba(0,0,0,.2)" }} />)}
          <button type="button" aria-label="Undo" onClick={() => setDrawing({ ...drawing, strokes: drawing.strokes.slice(0, -1) })} className="ml-auto grid h-9 w-9 place-items-center rounded-full" style={{ background: C.card2 }}><Undo2 className="h-4 w-4" /></button></div>
        <input value={drawing.text} onChange={(e) => setDrawing({ ...drawing, text: e.target.value.slice(0, 300) })} placeholder="Note for this moment: knees out, chest up…" className={`${inputCls} mt-2`} style={inputStyle} data-testid="fc-mark-text" />
        <div className="mt-2 grid grid-cols-2 gap-2"><Btn kind="soft" onClick={() => setDrawing(null)}>Cancel</Btn><Btn onClick={keep} testId="fc-keep">Keep this note</Btn></div>
      </Card>}
    {marks.length > 0 && <><Title>Notes on the video · {marks.length}</Title><div className="space-y-1.5">{marks.map((m, i) => <div key={m.id} className="flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: C.card }}>
      <button type="button" onClick={() => { if (v.current) { v.current.pause(); v.current.currentTime = m.t; } }} className="text-[14px] font-bold" style={{ color: C.lime }}>{i + 1} · {fmt(m.t)}</button>
      <span className="min-w-0 flex-1 truncate text-[14px]">{m.text || `${m.strokes.length} drawing${m.strokes.length === 1 ? "" : "s"}`}</span>
      <button type="button" aria-label="Remove note" onClick={() => setMarks(marks.filter((x) => x.id !== m.id))} style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>)}</div></>}
    <Title>Your reply</Title>
    <div className="grid grid-cols-2 gap-2">{([["good", "Looks good"], ["fix", "A few things to fix"]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setRating(rating === id ? "" : id)} className="h-11 rounded-[10px] text-[14px] font-semibold" style={rating === id ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }}>{l}</button>)}</div>
    <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={3} placeholder={`What ${first} should change next set`} className="mt-2 w-full rounded-[12px] p-3 text-[16px] outline-none" style={inputStyle} data-testid="fc-text" />
    <div className="mt-2 flex items-center gap-2">
      {rec ? <Btn kind="danger" className="flex-1" onClick={() => { rec.stop(); setRec(null); }}><Square className="h-4 w-4" />Stop recording</Btn>
        : <Btn kind="soft" className="flex-1" disabled={!!busy} onClick={recStart} testId="fc-voice-rec"><Mic className="h-4 w-4" />{voice ? "Record again" : "Add a voice note"}</Btn>}
      {voice && !rec && <button type="button" aria-label="Remove voice note" onClick={() => { setVoice(""); setVoiceUrl(""); }} className="grid h-12 w-12 place-items-center rounded-[12px]" style={{ background: C.card2, color: C.dim }}><X className="h-5 w-5" /></button>}
    </div>
    {voiceUrl && voice && <audio src={voiceUrl} controls className="mt-2 w-full" />}
    <Btn className="mt-5 w-full" disabled={!!busy || !!drawing || !!rec || (!text.trim() && !marks.length && !voice)} onClick={save} testId="fc-send-feedback">{busy || `Send to ${first}`}</Btn>
  </Sheet>;
}
