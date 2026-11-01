// One note: the summary (with the to-dos to send to the planner), the transcript with times (tap a
// time to hear that moment, edit any line, rename speakers), and the tools (a parent-friendly email,
// translation, flashcards and a quiz). Share and export are in the share sheet.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarPlus, Check, ChevronDown, Lock, MoreHorizontal, Pause, Pencil, Play, RefreshCw, Search, Share2, Sparkles, Star, Volume2, X } from "lucide-react";
import { NOTES_PLANS, fmtClock, speakerName, templateOf, type NoteSummary, type NotesTemplateId, type Timed } from "@shared/ariseNotes";
import { sayAI, stopAiVoice } from "@/lib/aiVoice";
import { notesApi, type FullNote } from "./api";
import { usePiecePlayer, sessionAudio, type PlayPiece } from "./player";
import { Btn, IconBtn, Notice, Section, Sheet, Spinner, longDate, useToast } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";
import { IepSheet, MoreSheet, PlannerSheet, ShareSheet } from "./noteSheets";
import ToolsTab from "./noteTools";

type Tab = "summary" | "transcript" | "tools";

export default function NoteScreen({ ctx, id, at }: { ctx: AppCtx; id: string; at?: number }) {
  const say = useToast();
  const [note, setNote] = useState<FullNote | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(at !== undefined ? "transcript" : "summary");
  const [busy, setBusy] = useState("");
  const [sheet, setSheet] = useState<"" | "planner" | "iep" | "share" | "more" | "template" | "title">("");
  const [audio, setAudio] = useState<PlayPiece[]>(() => sessionAudio.get(id) ?? []);
  const [focusT, setFocusT] = useState<number | undefined>(at);
  const [translated, setTranslated] = useState<{ language: string; summary: NoteSummary } | null>(null);
  const player = usePiecePlayer(audio);

  const load = async () => {
    try { const r = await notesApi.get(id); setNote(r.note); setError(""); return r.note; }
    catch (e: any) { setError(e.message); return null; }
  };
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (note?.audio && !sessionAudio.get(id)) notesApi.audio(id).then((r) => setAudio(r.pieces)).catch(() => {}); }, [note?.audio, id]);
  useEffect(() => () => { stopAiVoice(); player.stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Still being written down: check again in a little while.
  useEffect(() => {
    if (!note || (note.status !== "processing" && note.status !== "recording")) return;
    const t = setTimeout(() => void load(), 6000);
    return () => clearTimeout(t);
  }, [note]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <><TopBar ctx={ctx} back={() => ctx.go({ name: "home" })} /><main className="mx-auto max-w-2xl p-5"><Notice tone="bad">{error}</Notice></main></>;
  if (!note) return <><TopBar ctx={ctx} back={() => ctx.go({ name: "home" })} /><Spinner /></>;

  const me = ctx.me;
  const jump = (t: number | null) => {
    if (t === null || t === undefined) return;
    setFocusT(t); setTab("transcript");
    if (player.ready) player.seek(t, true);
  };
  const run = async (what: string, fn: () => Promise<unknown>) => {
    setBusy(what);
    try { await fn(); } catch (e: any) { if (e?.code === "upgrade") { say(e.message); ctx.go({ name: "settings", tab: "plan" }); } else say(e.message); }
    finally { setBusy(""); }
  };
  const summarize = (template?: NotesTemplateId, force = false) => run("summary", async () => { const r = await notesApi.summary(note.id, { template, force }); setNote(r.note); setTranslated(null); ctx.refreshNotes(); });
  const resume = () => run("resume", async () => { const r = await notesApi.resume(note.id); if (r.note) setNote(r.note); void ctx.refreshMe(); say(r.done ? `Wrote down ${r.done} more part${r.done === 1 ? "" : "s"}.` : r.message || "Nothing new was written down."); });
  const patch = async (b: Record<string, unknown>) => { const r = await notesApi.patch(note.id, b); if (r.note) setNote(r.note); ctx.refreshNotes(); };
  const pending = note.pieces.filter((p) => p.state === "no_minutes" || p.state === "failed");
  const outOf = note.pieces.some((p) => p.state === "no_minutes");
  const t = templateOf(note.template);

  return <>
    <TopBar ctx={ctx} back={() => ctx.go({ name: "home" })} title={<button type="button" className="max-w-full truncate text-left" onClick={() => note.mine && setSheet("title")} aria-label={`Title: ${note.title}. Rename`}>{note.title || "Untitled note"}</button>}
      right={<>
        <IconBtn label="Share and export" onClick={() => setSheet("share")}><Share2 className="h-5 w-5" /></IconBtn>
        {note.mine && <IconBtn label="Note settings" onClick={() => setSheet("more")}><MoreHorizontal className="h-5 w-5" /></IconBtn>}
      </>} />
    <main className={`mx-auto max-w-3xl space-y-4 px-4 pt-4 sm:px-5 ${player.ready ? "pb-36" : "pb-24"}`}>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--an-muted)]">
        <span>{longDate(note.createdAt)}</span>
        {note.durationSecs > 0 && <span>· {fmtClock(note.durationSecs)}</span>}
        <button type="button" className="an-chip" onClick={() => note.mine && setSheet("template")} disabled={!note.mine}><span aria-hidden>{note.source === "memo" ? "⚡" : t.emoji}</span>{note.source === "memo" ? "Voice memo" : t.label}{note.mine && <ChevronDown className="h-3.5 w-3.5" aria-hidden />}</button>
        {!note.mine && <span className="an-chip">Shared with your family</span>}
      </div>
      {note.status === "processing" && <Notice>Still writing this down… it updates by itself.</Notice>}
      {pending.length > 0 && note.mine && <Notice tone={outOf ? "warn" : "bad"} action={<Btn kind="primary" busy={busy === "resume"} onClick={resume}><RefreshCw className="h-4 w-4" />{outOf ? "Write down the rest" : "Try again"}</Btn>}>
        {outOf ? `${pending.length === 1 ? "One part" : `${pending.length} parts`} of this recording are saved but not written down yet: you were out of minutes.` : "A part of this recording couldn't be written down. It's saved; try again."}
      </Notice>}

      <div role="tablist" aria-label="Note" className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-[var(--an-line)]">
        {(["summary", "transcript", "tools"] as Tab[]).map((k) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`notes-tab-${k}`}
          className={`min-h-11 flex-1 rounded-xl text-[15px] font-semibold capitalize transition ${tab === k ? "bg-[var(--an-violet)] text-white" : "text-[var(--an-muted)] hover:bg-[var(--an-violet-soft)]"}`}>{k}</button>)}
      </div>

      {tab === "summary" && <SummaryTab ctx={ctx} note={note} busy={busy} summarize={summarize} jump={jump} translated={translated} clearTranslated={() => setTranslated(null)}
        openPlanner={() => (me.features.planner || me.features.calendar ? setSheet("planner") : (say("Adding to your planner comes with Basic."), ctx.go({ name: "settings", tab: "plan" })))}
        openIep={() => setSheet("iep")} />}
      {tab === "transcript" && <TranscriptTab note={note} focusT={focusT} jump={jump} onChanged={(n) => setNote(n)} patch={patch} canPlay={player.ready} />}
      {tab === "tools" && <ToolsTab ctx={ctx} note={note} onNote={setNote} onTranslated={(x) => { setTranslated(x); setTab("summary"); }} />}
    </main>

    {player.ready && <div className="an-noprint fixed inset-x-0 bottom-0 z-40 border-t border-[var(--an-line)] bg-white/95 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4">
        <IconBtn label={player.playing ? "Pause" : "Play"} className="!bg-[var(--an-violet)] !text-white" onClick={player.toggle}>{player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</IconBtn>
        <span className="w-12 text-right font-mono text-[13px] tabular-nums text-[var(--an-muted)]">{fmtClock(player.time)}</span>
        <input type="range" min={0} max={Math.max(1, Math.round(player.total))} value={Math.round(player.time)} onChange={(e) => player.seek(Number(e.target.value), player.playing)} aria-label="Position in the recording" className="min-w-0 flex-1 accent-[var(--an-violet)]" />
        <span className="w-12 font-mono text-[13px] tabular-nums text-[var(--an-muted)]">{fmtClock(player.total)}</span>
        <button type="button" className="an-chip" onClick={() => player.setRate(player.rate >= 2 ? 1 : player.rate + 0.5)} aria-label={`Speed ${player.rate}x`}>{player.rate}×</button>
      </div>
    </div>}

    {sheet === "title" && <TitleSheet note={note} onClose={() => setSheet("")} onSave={async (title) => { await patch({ title }); setSheet(""); }} />}
    {sheet === "template" && <Sheet title="Summary style" onClose={() => setSheet("")}>
      <div className="grid grid-cols-2 gap-2">{me.templates.map((x) => <button key={x.id} type="button" onClick={() => { if (!x.allowed) { ctx.go({ name: "settings", tab: "plan" }); return; } setSheet(""); void summarize(x.id, true); }} className={`flex min-h-[72px] flex-col items-start gap-1 rounded-2xl border p-3 text-left ${note.template === x.id ? "border-[var(--an-violet)] bg-[var(--an-violet-soft)]" : "border-[var(--an-line)]"}`}>
        <span className="text-[14px] font-bold"><span aria-hidden>{x.emoji}</span> {x.label}{!x.allowed && <Lock className="ml-1 inline h-3.5 w-3.5 text-[var(--an-amber)]" aria-label="Needs a paid plan" />}</span><span className="text-[12px] text-[var(--an-muted)]">{x.blurb}</span></button>)}</div>
      <p className="mt-3 text-[13px] text-[var(--an-muted)]">Changing it writes the summary again in the new style. Your transcript stays the same.</p>
    </Sheet>}
    {sheet === "planner" && <PlannerSheet ctx={ctx} note={note} onClose={() => setSheet("")} onDone={(n) => setNote(n)} />}
    {sheet === "iep" && <IepSheet ctx={ctx} note={note} onClose={() => setSheet("")} onDone={() => { setSheet(""); void load(); }} />}
    {sheet === "share" && <ShareSheet ctx={ctx} note={note} onClose={() => setSheet("")} onNote={setNote} />}
    {sheet === "more" && <MoreSheet ctx={ctx} note={note} onClose={() => setSheet("")} patch={patch} onDeleted={() => { ctx.refreshNotes(); ctx.go({ name: "home" }); }} />}
  </>;
}

function TitleSheet({ note, onClose, onSave }: { note: FullNote; onClose: () => void; onSave: (t: string) => Promise<void> }) {
  const [v, setV] = useState(note.title);
  const [busy, setBusy] = useState(false);
  return <Sheet title="Rename" onClose={onClose}>
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onSave(v.trim() || note.title).finally(() => setBusy(false)); }} className="space-y-3">
      <input className="an-input" value={v} onChange={(e) => setV(e.target.value)} maxLength={140} aria-label="Note name" />
      <Btn kind="primary" className="w-full" busy={busy} type="submit">Save</Btn>
    </form>
  </Sheet>;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function TimeChip({ t, jump }: { t: number | null; jump: (t: number | null) => void }) {
  if (t === null) return null;
  return <button type="button" className="an-time an-extra ml-1.5 align-middle" onClick={() => jump(t)} aria-label={`Go to ${fmtClock(t)} in the transcript`}>{fmtClock(t)}</button>;
}
function List({ items, jump, icon }: { items: Timed[]; jump: (t: number | null) => void; icon?: ReactNode }) {
  return <ul className="an-read space-y-2">{items.map((x, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed"><span className="mt-[9px] shrink-0 text-[var(--an-violet)]" aria-hidden>{icon ?? <span className="block h-1.5 w-1.5 rounded-full bg-[var(--an-violet)]" />}</span><span>{x.text}<TimeChip t={x.t} jump={jump} /></span></li>)}</ul>;
}

function SummaryTab({ ctx, note, busy, summarize, jump, openPlanner, openIep, translated, clearTranslated }: {
  ctx: AppCtx; note: FullNote; busy: string; summarize: (t?: NotesTemplateId, force?: boolean) => Promise<void>; jump: (t: number | null) => void;
  openPlanner: () => void; openIep: () => void; translated: { language: string; summary: NoteSummary } | null; clearTranslated: () => void;
}) {
  const s = translated?.summary ?? note.summary;
  const [reading, setReading] = useState(false);
  if (!note.segments.length) {
    return <Section><p className="text-[15px] text-[var(--an-muted)]">{note.status === "processing" || note.status === "recording" ? "The transcript is still being written down." : "Nothing was heard in this recording. If there was talking, try again closer to the speaker."}</p></Section>;
  }
  if (!s) {
    return <Section className="text-center">
      <Sparkles className="mx-auto h-8 w-8 text-[var(--an-violet)]" aria-hidden />
      <p className="mt-2 text-[15px] text-[var(--an-muted)]">{ctx.me.services.ai ? "The summary hasn't been written yet." : "The AI isn't switched on for this site yet, so there's no summary. The transcript is ready."}</p>
      {ctx.me.services.ai && note.mine && <Btn kind="primary" className="mt-4" busy={busy === "summary"} onClick={() => void summarize()} data-testid="notes-summarize"><Sparkles className="h-4 w-4" />Write the summary</Btn>}
    </Section>;
  }
  const read = async () => {
    if (reading) { stopAiVoice(); setReading(false); return; }
    setReading(true);
    const text = [s.summary, ...s.keyPoints.map((x) => x.text), ...s.actions.map((a) => `To do: ${a.what}${a.who ? `, ${a.who}` : ""}.`)].join(" ");
    try { await sayAI(text, { voice: ctx.me.settings.voice as any }); } finally { setReading(false); }
  };
  const open = note.actions.filter((a) => !a.sentTo).length;
  return <div className="space-y-4">
    {translated && <Notice action={<Btn kind="soft" onClick={clearTranslated}>Show the original</Btn>}>Showing the summary in {translated.language}.</Notice>}
    {note.stale && note.mine && !translated && <Notice action={<Btn kind="soft" busy={busy === "summary"} onClick={() => void summarize(undefined, true)}>Update summary</Btn>}>The transcript changed since this summary was written.</Notice>}
    <Section title="Summary" icon={<Sparkles className="h-4 w-4" />} right={<IconBtn label={reading ? "Stop reading" : "Read aloud"} onClick={() => void read()}>{reading ? <X className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</IconBtn>}>
      <p className="an-read text-[16px] leading-relaxed">{s.summary}</p>
    </Section>
    {s.highlights.length > 0 && <Section title="What you marked" icon={<Star className="h-4 w-4" />}><List items={s.highlights} jump={jump} icon={<Star className="h-3.5 w-3.5 fill-current text-[#e0a100]" />} /></Section>}
    {s.keyPoints.length > 0 && <Section title="Key points"><List items={s.keyPoints} jump={jump} /></Section>}
    {s.sections.map((sec) => <Section key={sec.heading} title={sec.heading} className="an-extra"><List items={sec.items} jump={jump} /></Section>)}
    {s.decisions.length > 0 && <Section title="Decisions"><List items={s.decisions} jump={jump} icon={<Check className="h-3.5 w-3.5" />} /></Section>}
    {s.actions.length > 0 && <Section title="Action items" icon={<Check className="h-4 w-4" />} right={note.mine && open > 0 ? <Btn kind="primary" onClick={openPlanner} data-testid="notes-to-planner">{ctx.me.features.planner ? "" : <Lock className="h-4 w-4" />}Add to planner</Btn> : note.actions.length && !open ? <span className="text-[12px] font-semibold text-[var(--an-green)]">All in your planner</span> : null}>
      <ul className="an-read space-y-2">{s.actions.map((a, i) => {
        const sent = note.actions.find((x) => x.text === a.what)?.sentTo;
        return <li key={i} className="flex gap-3 rounded-xl px-1 py-1 text-[15px]">
          <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${sent ? "border-[var(--an-green)] bg-[var(--an-green)] text-white" : "border-[var(--an-line)]"}`}>{sent && <Check className="h-3.5 w-3.5" />}</span>
          <span className="min-w-0 flex-1 leading-relaxed">{a.what}{a.who && <span className="text-[var(--an-muted)]"> · {a.who}</span>}{a.due && <span className="ml-1.5 rounded-md bg-[var(--an-amber-soft)] px-1.5 text-[12px] font-semibold text-[#7a4a04]">due {a.due}</span>}<TimeChip t={a.t} jump={jump} />{sent && <span className="sr-only"> (in your {sent === "work" ? "WorkHub" : "LifeHub"})</span>}</span>
        </li>;
      })}</ul>
    </Section>}
    {s.questions.length > 0 && <Section title="Still open" className="an-extra"><List items={s.questions} jump={jump} icon={<span className="text-[13px] font-bold">?</span>} /></Section>}
    {s.dates.length > 0 && <Section title="Dates" icon={<CalendarPlus className="h-4 w-4" />} right={note.mine ? <Btn kind="soft" onClick={openPlanner}>Add to calendar</Btn> : null}>
      <ul className="space-y-1.5">{s.dates.map((d, i) => <li key={i} className="text-[15px]"><b>{d.title}</b> <span className="text-[var(--an-muted)]">· {new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}{d.time ? ` at ${d.time}` : ""}</span></li>)}</ul>
    </Section>}
    {s.iep && <IepCard note={note} iep={s.iep} onOpen={openIep} />}
    {note.summaryAt && <p className="an-extra text-center text-[12px] text-[var(--an-faint)]">Summary written {longDate(note.summaryAt)} · {templateOf(note.summaryTemplate ?? note.template).label} · AI can make mistakes; check anything important against the transcript.</p>}
  </div>;
}

function IepCard({ note, iep, onOpen }: { note: FullNote; iep: NonNullable<NoteSummary["iep"]>; onOpen: () => void }) {
  const rows: [string, string[]][] = [
    ["Attendees", iep.attendees], ["Strengths", iep.strengths], ["Concerns", iep.concerns],
    ["Goals discussed", iep.goals.map((g) => `${g.area ? `${g.area}: ` : ""}${g.text}`)],
    ["Services and minutes", iep.services.map((v) => `${v.service}: ${v.minutes} minutes a ${v.per}${v.provider ? ` (${v.provider})` : ""}`)],
    ["Accommodations", iep.accommodations], ["Decisions", iep.decisions],
    ["Next steps", iep.nextSteps.map((n) => `${n.what}${n.who ? ` · ${n.who}` : ""}${n.due ? ` · by ${n.due}` : ""}`)],
  ];
  return <Section title={<span className="flex items-center gap-2">IEP meeting draft <span className="rounded-full bg-[var(--an-amber-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-amber)]">DRAFT</span></span>}
    right={note.mine ? <Btn kind="primary" onClick={onOpen}>{note.extras.iepSent ? "File again" : "Review and file"}</Btn> : null}>
    <p className="mb-3 text-[13px] text-[var(--an-muted)]">A draft for you to review. Nothing is sent anywhere until you file it.{note.extras.iepSent && ` Filed under ${note.extras.iepSent.student} in WorkHub.`}</p>
    {iep.student && <p className="mb-2 text-[15px]"><b>Student:</b> {iep.student}</p>}
    <dl className="space-y-3">{rows.filter(([, v]) => v.length).map(([k, v]) => <div key={k}><dt className="text-[13px] font-bold uppercase tracking-wide text-[var(--an-violet-ink)]">{k}</dt><dd><ul className="mt-1 list-disc space-y-0.5 pl-5 text-[15px]">{v.map((x, i) => <li key={i}>{x}</li>)}</ul></dd></div>)}</dl>
    {iep.nextMeeting && <p className="mt-3 text-[15px]"><b>Next meeting:</b> {iep.nextMeeting}</p>}
  </Section>;
}

// ─── Transcript ──────────────────────────────────────────────────────────────

function TranscriptTab({ note, focusT, jump, onChanged, patch, canPlay }: { note: FullNote; focusT?: number; jump: (t: number | null) => void; onChanged: (n: FullNote) => void; patch: (b: Record<string, unknown>) => Promise<void>; canPlay: boolean }) {
  const say = useToast();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [names, setNames] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const speakers = useMemo(() => [...new Set(note.segments.map((s) => s.speaker).filter((x): x is string => !!x))], [note.segments]);
  const focusIdx = focusT === undefined ? -1 : note.segments.reduce((best, s, i) => (s.start <= focusT + 0.5 ? i : best), 0);
  useEffect(() => { if (focusIdx >= 0) box.current?.querySelector(`[data-i="${focusIdx}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [focusIdx]);
  const ql = q.trim().toLowerCase();
  const shown = note.segments.map((s, i) => ({ s, i })).filter(({ s }) => !ql || s.text.toLowerCase().includes(ql) || speakerName(s.speaker, note.speakers).toLowerCase().includes(ql));
  const mark = (t: string) => {
    if (!ql) return t;
    const out: ReactNode[] = [];
    let rest = t, k = 0;
    for (;;) { const at = rest.toLowerCase().indexOf(ql); if (at < 0) { out.push(rest); break; } out.push(rest.slice(0, at), <mark key={k++} className="an-mark">{rest.slice(at, at + ql.length)}</mark>); rest = rest.slice(at + ql.length); }
    return out;
  };
  const save = async (idx: number) => {
    try {
      await notesApi.editLine(note.id, idx, { text });
      onChanged({ ...note, stale: true, segments: note.segments.map((s) => (s.idx === idx ? { ...s, text: text.trim() } : s)) });
      setEditing(null);
    } catch (e: any) { say(e.message); }
  };
  if (!note.segments.length) return <Section><p className="text-[15px] text-[var(--an-muted)]">No transcript yet.</p></Section>;
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <label className="relative min-w-0 flex-1"><span className="sr-only">Search the transcript</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--an-faint)]" aria-hidden /><input className="an-input pl-9" placeholder="Find words in this transcript" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {speakers.length > 0 && note.mine && <Btn kind="plain" onClick={() => setNames(true)}>Rename speakers</Btn>}
    </div>
    {ql && <p className="text-[13px] text-[var(--an-muted)]" aria-live="polite">{shown.length} line{shown.length === 1 ? "" : "s"} found</p>}
    <div ref={box} className="an-card an-read divide-y divide-[var(--an-line)]">
      {shown.map(({ s, i }) => {
        const starred = note.highlights.some((h) => h >= s.start - 20 && h <= s.end + 5);
        const who = speakerName(s.speaker, note.speakers);
        return <div key={s.idx} data-i={i} className={`group flex gap-3 px-4 py-3 ${i === focusIdx ? "bg-[var(--an-violet-soft)]" : ""}`}>
          <button type="button" onClick={() => jump(s.start)} className="an-time h-fit shrink-0" aria-label={`${canPlay ? "Play from" : "Time"} ${fmtClock(s.start)}`}>{fmtClock(s.start)}</button>
          <div className="min-w-0 flex-1">
            {who && <div className="text-[12px] font-bold text-[var(--an-violet-ink)]">{who}</div>}
            {editing === s.idx
              ? <div className="space-y-2"><textarea className="an-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus aria-label="Edit this line" /><div className="flex gap-2"><Btn kind="primary" onClick={() => void save(s.idx)}>Save</Btn><Btn kind="ghost" onClick={() => setEditing(null)}>Cancel</Btn></div></div>
              : <p className="text-[15px] leading-relaxed">{starred && <Star className="mr-1 inline h-3.5 w-3.5 fill-[#e0a100] text-[#e0a100]" aria-label="Marked important" />}{mark(s.text)}</p>}
          </div>
          {note.mine && editing !== s.idx && <IconBtn label="Edit this line" className="opacity-60 group-hover:opacity-100 focus:opacity-100" onClick={() => { setEditing(s.idx); setText(s.text); }}><Pencil className="h-4 w-4" /></IconBtn>}
        </div>;
      })}
    </div>
    {names && <SpeakerNames note={note} speakers={speakers} onClose={() => setNames(false)} onSave={async (m) => { await patch({ speakers: m }); setNames(false); }} />}
  </div>;
}

function SpeakerNames({ note, speakers, onClose, onSave }: { note: FullNote; speakers: string[]; onClose: () => void; onSave: (m: Record<string, string>) => Promise<void> }) {
  const [m, setM] = useState<Record<string, string>>(() => Object.fromEntries(speakers.map((s) => [s, note.speakers[s] || ""])));
  const [busy, setBusy] = useState(false);
  return <Sheet title="Who's speaking?" onClose={onClose}>
    <div className="space-y-3">{speakers.map((s) => <label key={s} className="flex items-center gap-3"><span className="w-24 shrink-0 text-[14px] font-semibold">Speaker {s}</span><input className="an-input" value={m[s]} onChange={(e) => setM({ ...m, [s]: e.target.value })} placeholder="Name or role" maxLength={40} /></label>)}</div>
    <Btn kind="primary" className="mt-4 w-full" busy={busy} onClick={async () => { setBusy(true); await onSave(m).finally(() => setBusy(false)); }}>Save names</Btn>
  </Sheet>;
}

export { NOTES_PLANS };
