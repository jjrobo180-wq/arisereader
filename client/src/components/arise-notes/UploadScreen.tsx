// Upload: an audio or video file (MP3, M4A, WAV, WebM, MP4, MOV…), up to 2 hours or 500 MB. The file
// is cut into pieces on the device (audioSplit.ts), a few are written down at once, and the note
// opens with its summary when they're all done.
import { useRef, useState } from "react";
import { FileUp, RefreshCw, Upload } from "lucide-react";
import { DIARIZE_PIECE_SECS, NOTES_UPLOAD_MAX_BYTES, fmtClock, type NotesTemplateId } from "@shared/ariseNotes";
import { notesApi, NotesError, type FullNote } from "./api";
import { planUpload, type UploadPlan } from "./audioSplit";
import { createSender, type OutPiece, type Sender } from "./sender";
import { SpeakersToggle, TemplatePicker } from "./pickers";
import { Btn, Notice, Section, useToast, minutesText } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";

const ACCEPT = "audio/*,video/mp4,video/quicktime,video/webm,.mp3,.m4a,.wav,.webm,.mp4,.mov,.ogg,.oga,.opus,.flac,.aac,.3gp";
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`;

export default function UploadScreen({ ctx }: { ctx: AppCtx }) {
  const { me } = ctx;
  const say = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<UploadPlan | null>(null);
  const [reading, setReading] = useState(false);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<NotesTemplateId>(me.templates.find((t) => t.id === me.settings.template && t.allowed)?.id ?? "general");
  const [speakers, setSpeakers] = useState(true);
  const [problem, setProblem] = useState<{ text: string; canSave?: boolean; upgrade?: boolean } | null>(null);
  const [phase, setPhase] = useState<"pick" | "sending" | "finishing">("pick");
  const [progress, setProgress] = useState({ done: 0, total: 0, lines: 0 });
  const [step, setStep] = useState("");
  const [lost, setLost] = useState<OutPiece[]>([]);
  const [noMinutes, setNoMinutes] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const sender = useRef<Sender | null>(null);
  const note = useRef<FullNote | null>(null);
  const diarize = speakers && me.features.speakers && me.services.speakers;

  const choose = async (f: File | null | undefined, sp = speakers) => {
    if (!f) return;
    const split = sp && me.features.speakers && me.services.speakers;
    setProblem(null); setPlan(null); setFile(f);
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 140));
    if (f.size > NOTES_UPLOAD_MAX_BYTES) { setProblem({ text: `That file is ${mb(f.size)}. Files can be up to 500 MB. Save just the audio, or a shorter part, and try again.` }); return; }
    setReading(true);
    try {
      const p = await planUpload(f, { pieceSecs: split ? DIARIZE_PIECE_SECS : 600, maxBytes: me.limits.pieceBytes, name: f.name });
      setPlan(p);
      if (p.total > me.usage.maxSecs + 30) setProblem({ text: `This recording is ${minutesText(p.total)} long. On ${me.planName}, one recording can be up to ${minutesText(me.usage.maxSecs)}.`, upgrade: me.plan === "free" });
      else if (p.total && Math.ceil(p.total / 60) > me.usage.left && me.usage.left > 0) setProblem({ text: `This recording is about ${Math.ceil(p.total / 60)} minutes and you have ${me.usage.left} left this month. The rest will be saved and written down when minutes come back (or when you upgrade).` });
    } catch (e: any) { setProblem({ text: e.message || "That file couldn't be read." }); }
    finally { setReading(false); }
  };

  const start = async (saveOnly = false) => {
    if (!file || !plan) return;
    setProblem(null);
    let created;
    try {
      created = await notesApi.create({ source: "upload", title: title.trim() || undefined, defaultTitle: file.name.replace(/\.[^.]+$/, "").slice(0, 140) || "Uploaded recording", template, expectedSecs: plan.total, speakers: diarize, saveOnly: saveOnly || me.usage.left <= 0 });
    } catch (e: any) {
      setProblem({ text: e.message, canSave: e instanceof NotesError && !!e.body?.canSave, upgrade: e instanceof NotesError && (e.code === "too_long" || e.code === "minutes") });
      return;
    }
    note.current = created.note;
    setPhase("sending");
    setStep("Reading the file…");
    let lines = 0;
    const s = createSender(created.note.id, {
      concurrency: 3,
      onReply: (_p, r) => {
        if (r.ok) { lines += r.segments?.length ?? 0; setProgress((x) => ({ ...x, lines })); }
        else if (r.code === "minutes" || r.code === "cap") setNoMinutes(r.message || "Out of minutes.");
      },
      onFatal: (m) => setProblem({ text: m }),
      onProgress: (done, total) => setProgress((x) => ({ ...x, done, total: Math.max(total, plan.count) })),
    });
    sender.current = s;
    ctx.setGuard(() => window.confirm("The recording is still being sent. Leave anyway? Parts not sent yet will be missing."));
    let idx = 0;
    try {
      for await (const p of plan.pieces()) {
        // Keep only a few pieces in memory at once.
        while (s.pending() >= 4) await new Promise((r) => setTimeout(r, 300));
        setStep(`Writing down part ${Math.min(idx + 1, plan.count)} of ${plan.count}…`);
        s.add({ idx: idx++, blob: p.blob, ext: p.ext, start: p.start, secs: p.secs });
      }
    } catch (e: any) { setProblem({ text: e.message || "Part of the file couldn't be read." }); }
    await s.drained();
    if (s.failed().length) { setLost(s.failed()); setStep(""); return; }
    await wrapUp();
  };

  const wrapUp = async () => {
    const n = note.current;
    if (!n || !plan) return;
    setPhase("finishing");
    setStep("Putting your transcript together…");
    let latest: FullNote | null = null;
    try { latest = (await notesApi.finish(n.id, { durationSecs: plan.total, highlights: [] })).note; } catch (e: any) { say(e.message); }
    ctx.setGuard(null);
    if (latest?.segments.length && me.services.ai) {
      setStep("Writing your summary…");
      try { await notesApi.summary(n.id); } catch (e: any) { say(e.message); }
    }
    ctx.refreshNotes();
    void ctx.refreshMe();
    ctx.go({ name: "note", id: n.id });
  };

  const retry = async () => {
    const s = sender.current;
    if (!s) return;
    setLost([]); setStep("Sending again…");
    s.retryFailed();
    await s.drained();
    if (s.failed().length) { setLost(s.failed()); setStep(""); return; }
    await wrapUp();
  };

  if (phase !== "pick") {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return <>
      <TopBar ctx={ctx} title="Uploading" />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-24 pt-8 sm:px-5">
        <section className="an-card px-5 py-8 text-center" aria-live="polite">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[var(--an-violet-soft)] text-[var(--an-violet-ink)]"><RefreshCw className="h-9 w-9 animate-spin" aria-hidden /></div>
          <h1 className="mt-4 text-[20px] font-bold">{file?.name}</h1>
          <p className="mt-1 text-[14px] text-[var(--an-muted)]">{step}</p>
          <div className="mx-auto mt-5 h-3 max-w-md overflow-hidden rounded-full bg-[var(--an-violet-soft)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-[var(--an-violet)] transition-all" style={{ width: `${phase === "finishing" ? 100 : pct}%` }} /></div>
          <p className="mt-2 text-[13px] text-[var(--an-faint)]">{progress.done} of {progress.total || plan?.count} parts · {progress.lines} lines so far</p>
          <p className="mx-auto mt-4 max-w-sm text-[13px] leading-relaxed text-[var(--an-muted)]">Keep this page open until it's done. It takes about a minute for every half hour of audio.</p>
        </section>
        {noMinutes && <Notice tone="warn">{noMinutes} The rest of the recording is saved and will be written down when minutes come back.</Notice>}
        {problem && <Notice tone="bad">{problem.text}</Notice>}
        {lost.length > 0 && <Notice tone="bad" action={<Btn kind="primary" onClick={() => void retry()}><RefreshCw className="h-4 w-4" />Send again</Btn>}>{lost.length === 1 ? "One part" : `${lost.length} parts`} couldn't be sent. Check your connection and send again.</Notice>}
      </main>
    </>;
  }

  return <>
    <TopBar ctx={ctx} title="Upload a recording" back={() => ctx.go({ name: "home" })} />
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-24 pt-5 sm:px-5">
      <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void choose(e.dataTransfer.files?.[0]); }}
        className={`an-card flex w-full flex-col items-center gap-2 border-2 border-dashed px-5 py-10 text-center transition ${drag ? "border-[var(--an-violet)] bg-[var(--an-violet-soft)]" : "hover:border-[var(--an-violet)]"}`} data-testid="notes-pick-file">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--an-violet)] text-white"><FileUp className="h-8 w-8" aria-hidden /></span>
        <span className="mt-2 text-[18px] font-bold">{file ? file.name : "Choose a recording"}</span>
        <span className="text-[14px] text-[var(--an-muted)]">{file ? `${mb(file.size)}${plan?.total ? ` · ${fmtClock(plan.total)}` : reading ? " · reading…" : ""}` : "MP3, M4A, WAV, MP4, MOV, WebM… up to 2 hours or 500 MB"}</span>
      </button>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} data-testid="notes-file" />
      {problem && <Notice tone={problem.upgrade || problem.canSave ? "warn" : "bad"} action={<>
        {problem.canSave && <Btn kind="primary" onClick={() => void start(true)}>Save for later</Btn>}
        {problem.upgrade && <Btn kind="soft" onClick={() => ctx.go({ name: "settings", tab: "plan" })}>See plans</Btn>}
      </>}>{problem.text}</Notice>}
      {file && <>
        <Section><label className="block"><span className="mb-1.5 block text-[14px] font-bold">Name</span><input className="an-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} data-testid="notes-title" /></label></Section>
        <Section><TemplatePicker me={me} value={template} onChange={setTemplate} onLocked={() => ctx.go({ name: "settings", tab: "plan" })} /></Section>
        {(me.features.speakers ? me.services.speakers : true) && <Section><SpeakersToggle me={me} on={speakers} onChange={(v) => { setSpeakers(v); if (file) void choose(file, v); }} onLocked={() => ctx.go({ name: "settings", tab: "plan" })} /></Section>}
        <Btn kind="primary" className="w-full !min-h-14 text-[17px]" disabled={!plan || reading || (!!plan && plan.total > me.usage.maxSecs + 30)} busy={reading} onClick={() => void start()} data-testid="notes-upload-start"><Upload className="h-5 w-5" />Write it down</Btn>
        <p className="text-center text-[13px] text-[var(--an-muted)]">Uses about {plan?.total ? Math.max(1, Math.ceil(plan.total / 60)) : "…"} of your {me.usage.left.toLocaleString("en-US")} minutes left. {me.settings.audio === "delete" ? "The audio is deleted once it's written down." : me.settings.audio === "30d" ? "The audio is kept for 30 days." : "The audio is kept with the note."}</p>
      </>}
    </main>
  </>;
}
