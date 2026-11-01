// Record: pick the kind of meeting, a reminder to tell everyone, then record with pause and
// "this part matters" highlights. Every few minutes the part so far is written down, so the
// transcript grows while you record; when you stop, the summary is written and the note opens.
import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Star, Download, RefreshCw } from "lucide-react";
import { fmtClock, NOTES_PLANS, type NotesTemplateId, type Segment } from "@shared/ariseNotes";
import { localDay, notesApi, NotesError, type FullNote, type PieceReply } from "./api";
import { NotesRecorder, canRecord } from "./recorder";
import { createPhoneSender, createSender, type OutPiece, type Sender } from "./sender";
import { allowOnDeviceSpeech, hintsFor, summarizeOnDevice, type PrivacyLevel } from "@/lib/onDevice";
import { PrivacyPicker, defaultPrivacy, rememberPrivacy, strictSummaryWorks, useOnDevice } from "./privacyMode";
import { newLocalId, saveLocalNote, type LocalNote } from "./localNotes";
import { sessionAudio } from "./player";
import { ConsentCard, SpeakersToggle, TemplatePicker } from "./pickers";
import { Btn, Notice, Section, useToast, minutesText } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";
import { download } from "./exporters";

type Phase = "setup" | "recording" | "finishing";

export default function RecordScreen({ ctx }: { ctx: AppCtx }) {
  const { me } = ctx;
  const say = useToast();
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<NotesTemplateId>(me.templates.find((t) => t.id === me.settings.template && t.allowed)?.id ?? "general");
  const [speakers, setSpeakers] = useState(true);
  const [told, setTold] = useState(!me.settings.consent);
  const [phase, setPhase] = useState<Phase>("setup");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; canSave?: boolean } | null>(null);
  const [secs, setSecs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(0);
  const [lines, setLines] = useState<Segment[]>([]);
  const [highlights, setHighlights] = useState<number[]>([]);
  const [outOfMinutes, setOutOfMinutes] = useState("");
  const [sent, setSent] = useState({ done: 0, total: 0 });
  const [step, setStep] = useState("");
  const [lost, setLost] = useState<OutPiece[]>([]);
  const rec = useRef<NotesRecorder | null>(null);
  const note = useRef<FullNote | null>(null);
  const sender = useRef<Sender | null>(null);
  const limits = useRef({ pieceSecs: me.limits.pieceSecs, maxSecs: me.limits.maxSecs });
  const pieces = useRef<{ start: number; secs: number; url: string }[]>([]);
  const lineBox = useRef<HTMLDivElement>(null);
  // Private and Strict modes (Notes iPhone app): written down on the phone (privacyMode.tsx).
  const device = useOnDevice();
  const [privacy, setPrivacy] = useState<PrivacyLevel>(defaultPrivacy);
  const local = useRef<LocalNote | null>(null);
  const heard = useRef<Segment[]>([]);
  const strict = () => !!local.current;

  // Leaving while recording asks first; closing the tab warns.
  useEffect(() => {
    if (phase === "setup") { ctx.setGuard(null); return; }
    ctx.setGuard(() => {
      if (!window.confirm(phase === "recording" ? "Stop recording and leave? What's recorded so far is kept." : "The last part is still being sent. Leave anyway?")) return false;
      void stopNow(true);
      return true;
    });
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  useEffect(() => () => { void rec.current?.stop(); ctx.setGuard(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { lineBox.current?.scrollTo({ top: lineBox.current.scrollHeight, behavior: "smooth" }); }, [lines.length]);

  // Space pauses, H marks a highlight (when not typing).
  useEffect(() => {
    if (phase !== "recording") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      if (e.key === " ") { e.preventDefault(); togglePause(); }
      else if (e.key.toLowerCase() === "h") { e.preventDefault(); mark(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPiece = (p: { idx: number; blob: Blob; ext: string; start: number; secs: number }) => {
    pieces.current.push({ start: p.start, secs: p.secs, url: URL.createObjectURL(p.blob) });
    if (note.current && privacy === "standard") sessionAudio.set(note.current.id, [...pieces.current]);
    sender.current?.add(p);
  };

  const begin = async (saveOnly = false) => {
    setBusy(true); setProblem(null);
    let created: { note: FullNote; limits: { pieceSecs: number; maxSecs: number } };
    const now = new Date();
    const defaultTitle = `Recording, ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    if (privacy !== "standard") {
      try { await allowOnDeviceSpeech(); } catch (e: any) { setBusy(false); setProblem({ text: e.message }); return; }
      rememberPrivacy(privacy);
    }
    const onReply = (_p: OutPiece, r: PieceReply) => {
      if (r.ok && r.segments?.length) { heard.current = [...heard.current, ...r.segments].sort((a, b) => a.idx - b.idx); setLines(heard.current); }
      if (!r.ok && (r.code === "minutes" || r.code === "cap")) setOutOfMinutes(r.message || "Out of minutes.");
      if (!r.ok && r.code === "failed") say("A part couldn't be written down yet. It's saved; you can retry it from the note.");
      if (r.usage) void ctx.refreshMe();
    };
    if (privacy === "strict") {
      // Strict: nothing goes to the server. The note is made and kept on this iPhone.
      local.current = { id: newLocalId(), title: title.trim() || defaultTitle, template, source: "record", createdAt: now.toISOString(), durationSecs: 0, segments: [], highlights: [], summary: null, summaryProblem: "" };
      created = { note: null as unknown as FullNote, limits: { pieceSecs: 300, maxSecs: 2 * 3600 } };
      limits.current = created.limits;
      sender.current = createPhoneSender({ hints: hintsFor(template), onReply, onFatal: (m) => say(m), onProgress: (done, total) => setSent({ done, total }) });
    } else {
      try {
        created = await notesApi.create({ source: "record", title: title.trim() || undefined, defaultTitle, template, speakers: privacy === "standard" && speakers && me.features.speakers, saveOnly, privacy: privacy === "private" ? "private" : undefined });
      } catch (e: any) {
        setBusy(false);
        setProblem({ text: e.message, canSave: privacy === "standard" && e instanceof NotesError && e.code !== "too_long" && !!e.body?.canSave });
        return;
      }
      note.current = created.note;
      limits.current = created.limits;
      sender.current = createSender(created.note.id, {
        concurrency: 1,
        onReply,
        onFatal: (m) => say(m),
        onProgress: (done, total) => setSent({ done, total }),
        onPhone: privacy === "private" ? { hints: hintsFor(template) } : undefined,
      });
    }
    const r = new NotesRecorder({
      onPiece, onLevel: setLevel, onTick: setSecs,
      onAutoStop: (why) => { say(why === "limit" ? `That's the longest recording on ${NOTES_PLANS[me.plan].name} (${minutesText(limits.current.maxSecs)}). It's saved.` : "The microphone stopped (another app may be using it). What was recorded is saved."); void finish(); },
    }, created.limits);
    try { await r.start(); }
    catch (e: any) {
      setBusy(false);
      setProblem({ text: e.message });
      if (note.current) void notesApi.remove(note.current.id).catch(() => {});
      note.current = null;
      local.current = null;
      return;
    }
    rec.current = r;
    setBusy(false);
    setPhase("recording");
  };

  const togglePause = () => {
    const r = rec.current;
    if (!r) return;
    if (r.state === "recording") { r.pause(); setPaused(true); } else if (r.state === "paused") { r.resume(); setPaused(false); }
  };
  const mark = () => {
    const r = rec.current;
    if (!r) return;
    const t = Math.round(r.elapsed);
    setHighlights((h) => (h.includes(t) ? h : [...h, t]));
    say(`Marked ${fmtClock(t)} as important`);
  };

  const stopNow = async (leaving = false) => {
    await rec.current?.stop();
    if (leaving) void finishQuietly();
  };
  /** Leaving mid-way: finish in the background so the note is complete. */
  const finishQuietly = async () => {
    const n = note.current, s = sender.current;
    if (local.current && s) {
      await s.drained();
      await saveLocalNote({ ...local.current, durationSecs: rec.current?.elapsed ?? 0, highlights, segments: heard.current }).catch(() => {});
      ctx.refreshNotes();
      return;
    }
    if (!n || !s) return;
    await s.drained();
    await notesApi.finish(n.id, { durationSecs: rec.current?.elapsed ?? 0, highlights }).catch(() => {});
    ctx.refreshNotes();
  };

  const finish = async () => {
    const n = note.current, s = sender.current;
    if ((!n && !strict()) || !s) return;
    setPhase("finishing");
    setStep(strict() ? "Writing down the last part on this iPhone…" : "Saving the last part…");
    await rec.current?.stop();
    const duration = rec.current?.elapsed ?? secs;
    await s.drained();
    if (s.failed().length) { setLost(s.failed()); setStep(""); return; }
    if (local.current) {
      // Strict: saved on this iPhone, then summarized by the iPhone's own AI when it can.
      let ln: LocalNote = { ...local.current, durationSecs: duration, highlights, segments: heard.current };
      await saveLocalNote(ln);
      if (ln.segments.length && strictSummaryWorks(device.st)) {
        setStep("Writing your summary on this iPhone…");
        try {
          const summary = await summarizeOnDevice({ segments: ln.segments, template: ln.template, highlights, today: localDay(), onStep: setStep });
          ln = { ...ln, summary, title: !title.trim() && summary.title ? summary.title : ln.title };
        } catch (e: any) { ln = { ...ln, summaryProblem: String(e?.message || "") }; }
        await saveLocalNote(ln);
      }
      ctx.setGuard(null);
      ctx.refreshNotes();
      ctx.go({ name: "local", id: ln.id });
      return;
    }
    if (!n) return;
    setStep("Putting your transcript together…");
    let latest: FullNote | null = null;
    try { latest = (await notesApi.finish(n.id, { durationSecs: duration, highlights })).note; } catch (e: any) { say(e.message); }
    ctx.setGuard(null);
    if (latest && latest.segments.length && me.services.ai) {
      setStep("Writing your summary…");
      try { await notesApi.summary(n.id); } catch (e: any) { say(e.message); }
    }
    ctx.refreshNotes();
    void ctx.refreshMe();
    ctx.go({ name: "note", id: n.id });
  };

  const retryLost = async () => {
    const s = sender.current;
    if (!s) return;
    setLost([]);
    setStep("Sending again…");
    s.retryFailed();
    await finish();
  };
  /** The parts that couldn't be sent, saved to this device so they can be uploaded later. */
  const saveLost = () => { lost.forEach((p, i) => download(`Arise Notes recording part ${i + 1}.${p.ext}`, p.blob, p.blob.type || "application/octet-stream")); };

  const left = limits.current.maxSecs - secs;

  if (phase === "setup") {
    return <>
      <TopBar ctx={ctx} title="Record" back={() => ctx.go({ name: "home" })} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-24 pt-5 sm:px-5">
        {!canRecord() && <Notice tone="bad">Recording doesn't work in this browser. Try Chrome or Safari, or upload a recording instead.</Notice>}
        {device.available && <Section><PrivacyPicker value={privacy} onChange={setPrivacy} st={device.st} /></Section>}
        {me.usage.left <= 0 && privacy !== "strict" && <Notice tone="bad">{me.usage.capLeft <= 0 ? "This account has used its monthly safety limit." : "You're out of minutes for this month."} You can still record: the audio is saved and written down when minutes come back.</Notice>}
        <Section>
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-bold">Name it <span className="font-normal text-[var(--an-faint)]">(optional)</span></span>
            <input className="an-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Staff meeting, Biology lecture…" maxLength={140} data-testid="notes-title" />
          </label>
        </Section>
        <Section><TemplatePicker me={me} value={template} onChange={setTemplate} onLocked={() => { say("That template comes with a paid plan."); ctx.go({ name: "settings", tab: "plan" }); }} /></Section>
        {privacy === "standard" && (me.features.speakers ? me.services.speakers : true) && <Section><SpeakersToggle me={me} on={speakers} onChange={setSpeakers} onLocked={() => ctx.go({ name: "settings", tab: "plan" })} /></Section>}
        {me.settings.consent && <ConsentCard checked={told} onChange={setTold} />}
        {problem && <Notice tone="bad" action={problem.canSave ? <Btn kind="primary" onClick={() => void begin(true)}>Record and save for later</Btn> : undefined}>{problem.text}</Notice>}
        <Btn kind="record" className="w-full !min-h-14 text-[17px]" busy={busy} disabled={!told || !canRecord()} onClick={() => void begin(privacy === "standard" && me.usage.left <= 0)} data-testid="notes-start">
          <Mic className="h-5 w-5" />Start recording
        </Btn>
        <p className="text-center text-[13px] leading-relaxed text-[var(--an-muted)]">{privacy === "strict" ? "Strict recordings stay on this iPhone and don't use minutes (up to 2 hours)." : <>Up to {minutesText(me.usage.maxSecs)} on {me.planName}. {me.usage.left > 0 ? `${me.usage.left.toLocaleString("en-US")} minutes left this month.` : ""}</>} Keep this screen open while recording{/iPhone|iPad/.test(navigator.userAgent) ? "; locking an iPhone pauses the microphone" : ""}.</p>
      </main>
    </>;
  }

  return <>
    <TopBar ctx={ctx} title={phase === "recording" ? (paused ? "Paused" : "Recording") : "Finishing"} />
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-24 pt-5 sm:px-5">
      <section className="an-card flex flex-col items-center px-5 py-7 text-center" aria-live="polite">
        <div className={`grid h-24 w-24 place-items-center rounded-full ${phase === "recording" && !paused ? "an-pulse bg-[var(--an-coral)] text-white" : "bg-[var(--an-violet-soft)] text-[var(--an-violet-ink)]"}`}>
          {phase === "finishing" ? <RefreshCw className="h-9 w-9 animate-spin" aria-hidden /> : paused ? <Pause className="h-10 w-10" aria-hidden /> : <Mic className="h-10 w-10" aria-hidden />}
        </div>
        <div className="mt-4 font-mono text-[44px] font-bold tabular-nums tracking-tight" aria-label={`${fmtClock(secs)} recorded`}>{fmtClock(secs)}</div>
        <div className="an-bars mt-2 flex h-10 items-center" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => <span key={i} style={{ height: `${Math.max(4, (phase === "recording" && !paused ? level : 0) * 40 * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + secs))))}px` }} />)}
        </div>
        <p className="mt-2 text-[14px] text-[var(--an-muted)]">{phase === "finishing" ? step : paused ? "Paused. Nothing is being recorded." : highlights.length ? `${highlights.length} part${highlights.length === 1 ? "" : "s"} marked important` : "Tap ★ when something matters. It goes first in the summary."}</p>
        {phase === "recording" && <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Btn kind="plain" onClick={togglePause} aria-keyshortcuts="Space" data-testid="notes-pause">{paused ? <><Play className="h-4 w-4" />Resume</> : <><Pause className="h-4 w-4" />Pause</>}</Btn>
          <Btn kind="soft" onClick={mark} disabled={paused} aria-keyshortcuts="H" data-testid="notes-highlight"><Star className="h-4 w-4" />This matters</Btn>
          <Btn kind="record" onClick={() => void finish()} data-testid="notes-stop"><Square className="h-4 w-4" />Stop</Btn>
        </div>}
      </section>
      {phase === "recording" && left <= 120 && left > 0 && <Notice tone="warn">{Math.ceil(left / 60)} minute{left > 60 ? "s" : ""} left: {me.planName} recordings can be up to {minutesText(limits.current.maxSecs)}.</Notice>}
      {outOfMinutes && <Notice tone="bad" action={<Btn kind="primary" onClick={() => ctx.go({ name: "settings", tab: "plan" })}>Upgrade</Btn>}>{outOfMinutes} Your recording is still being saved.</Notice>}
      {lost.length > 0 && <Notice tone="bad" action={<Btn kind="primary" onClick={() => void retryLost()}><RefreshCw className="h-4 w-4" />Send again</Btn>}>
        {lost.length === 1 ? "One part" : `${lost.length} parts`} of the recording couldn't be sent (no connection). It's still on this device: check your connection, then send again. Don't close this page until it's sent.
        <button type="button" className="mt-2 flex items-center gap-1.5 font-semibold underline underline-offset-2" onClick={saveLost}><Download className="h-4 w-4" aria-hidden />Save it to this device too</button>
      </Notice>}
      <Section title="Transcript so far" right={<span className="text-[12px] font-semibold text-[var(--an-faint)]">{sent.total ? `${sent.done}/${sent.total} parts written down` : ""}</span>}>
        <div ref={lineBox} className="an-read max-h-[40vh] space-y-2 overflow-y-auto pr-1" aria-live="polite">
          {lines.length ? lines.map((l) => <p key={l.idx} className="text-[15px] leading-relaxed"><span className="an-time mr-2">{fmtClock(l.start)}</span>{l.speaker && <b className="mr-1 text-[var(--an-violet-ink)]">S{l.speaker}:</b>}{l.text}</p>)
            : <p className="text-[14px] text-[var(--an-muted)]">What's said appears here a few minutes in, then every {Math.round(limits.current.pieceSecs / 60)} minutes, as each part is written down.</p>}
        </div>
      </Section>
    </main>
  </>;
}
