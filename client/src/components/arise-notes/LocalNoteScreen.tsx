// A Strict-mode note: kept only on this iPhone. The summary is written by the iPhone's own AI; to-dos
// and dates can go to Apple Reminders and the Calendar. Copy, PDF, rename and delete all happen here.
import { useEffect, useState } from "react";
import { CalendarPlus, Copy, FileText, ListChecks, Lock, Pencil, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { fmtClock, noteText, templateOf, type NoteForExport, type Timed } from "@shared/ariseNotes";
import { summarizeOnDevice } from "@/lib/onDevice";
import { addToAppleReminders, addToIphoneCalendar, appleAddAvailable } from "@/lib/notesApple";
import { getLocalNote, removeLocalNote, saveLocalNote, type LocalNote } from "./localNotes";
import { copyText, download, fileName, notePdf, pdfCanShow } from "./exporters";
import { strictSummaryWhy, strictSummaryWorks, useOnDevice } from "./privacyMode";
import { Btn, Notice, Section, Spinner, shortDate, useToast } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";
import { localDay } from "./api";

const forExport = (n: LocalNote): NoteForExport => ({ title: n.title, createdAt: n.createdAt, durationSecs: n.durationSecs, template: n.template, summary: n.summary, segments: n.segments, speakers: {} });

function Items({ title, items }: { title: string; items: Timed[] }) {
  if (!items.length) return null;
  return <div><h3 className="mb-1 text-[14px] font-bold">{title}</h3><ul className="list-disc space-y-1 pl-5 text-[15px] leading-snug">{items.map((x, i) => <li key={i}>{x.text}{x.t !== null && <span className="an-time ml-2">{fmtClock(x.t)}</span>}</li>)}</ul></div>;
}

export default function LocalNoteScreen({ ctx, id }: { ctx: AppCtx; id: string }) {
  const say = useToast();
  const { st } = useOnDevice();
  const [note, setNote] = useState<LocalNote | null | undefined>(undefined);
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"summary" | "transcript">("summary");
  useEffect(() => { void getLocalNote(id).then(setNote).catch(() => setNote(null)); }, [id]);

  const save = async (n: LocalNote) => { setNote(n); await saveLocalNote(n); ctx.refreshNotes(); };
  const summarize = async () => {
    if (!note) return;
    setBusy("summary");
    try {
      const summary = await summarizeOnDevice({ segments: note.segments, template: note.template, highlights: note.highlights, today: localDay(), onStep: setStep });
      await save({ ...note, summary, summaryProblem: "", title: note.title.startsWith("Recording, ") && summary.title ? summary.title : note.title });
    } catch (e: any) { say(e.message); await save({ ...note, summaryProblem: String(e?.message || "") }); }
    finally { setBusy(""); setStep(""); }
  };

  if (note === undefined) return <><TopBar ctx={ctx} title="Note" back={() => ctx.go({ name: "home" })} /><Spinner /></>;
  if (!note) return <><TopBar ctx={ctx} title="Note" back={() => ctx.go({ name: "home" })} /><main className="mx-auto max-w-2xl px-4 pt-6"><Notice tone="bad">That note isn't on this iPhone. It may have been deleted.</Notice></main></>;

  const s = note.summary;
  const apple = appleAddAvailable();
  const from = `From Arise Notes: ${note.title}`;
  const toReminders = async () => {
    if (!s?.actions.length) return;
    setBusy("reminders");
    try { const n = await addToAppleReminders(s.actions.map((a) => ({ title: a.what, due: a.due, time: "", notes: [a.who && `For ${a.who}`, from].filter(Boolean).join("\n") }))); say(`Added ${n} to Apple Reminders.`); }
    catch (e: any) { say(e.message); } finally { setBusy(""); }
  };
  const toCalendar = async () => {
    if (!s?.dates.length) return;
    setBusy("calendar");
    try { const n = await addToIphoneCalendar(s.dates.map((d) => ({ title: d.title, date: d.date, time: d.time, notes: from }))); say(`Added ${n} to the Calendar.`); }
    catch (e: any) { say(e.message); } finally { setBusy(""); }
  };
  const rename = async () => {
    const t = window.prompt("Name this note", note.title)?.trim();
    if (t) await save({ ...note, title: t.slice(0, 140) });
  };
  const remove = async () => {
    if (!window.confirm("Delete this note from this iPhone? It isn't saved anywhere else, so it can't be brought back.")) return;
    await removeLocalNote(note.id);
    ctx.refreshNotes();
    say("Deleted.");
    ctx.go({ name: "home" });
  };
  const pdf = () => {
    const text = noteText(forExport(note));
    if (!pdfCanShow(text)) { say("This note has characters the PDF can't show. Use Copy instead."); return; }
    download(fileName(note.title, "pdf"), notePdf(forExport(note)), "application/pdf");
  };

  return <>
    <TopBar ctx={ctx} title={note.title || "Note"} back={() => ctx.go({ name: "home" })} />
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-5 sm:px-5" data-testid="notes-local-note">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--an-violet-soft)] px-3 py-1 text-[12px] font-bold text-[var(--an-violet-ink)]"><Lock className="h-3.5 w-3.5" aria-hidden />Strict · only on this iPhone</span>
        <span className="text-[13px] text-[var(--an-muted)]">{shortDate(note.createdAt)}{note.durationSecs ? ` · ${fmtClock(note.durationSecs)}` : ""} · {templateOf(note.template).label}</span>
      </div>
      <div role="tablist" className="flex gap-2">
        <button type="button" role="tab" className="an-chip" aria-selected={tab === "summary"} aria-pressed={tab === "summary"} onClick={() => setTab("summary")}>Summary</button>
        <button type="button" role="tab" className="an-chip" aria-selected={tab === "transcript"} aria-pressed={tab === "transcript"} onClick={() => setTab("transcript")}>Transcript</button>
      </div>

      {tab === "summary" ? <>
        {s ? <Section title="Summary" icon={<Sparkles className="h-4 w-4" />}>
          <div className="space-y-4">
            {s.summary && <p className="text-[15px] leading-relaxed">{s.summary}</p>}
            <Items title="Marked as important" items={s.highlights} />
            <Items title="Key points" items={s.keyPoints} />
            <Items title="Decisions" items={s.decisions} />
            {s.actions.length > 0 && <div>
              <h3 className="mb-1 text-[14px] font-bold">To-dos</h3>
              <ul className="space-y-1 text-[15px]">{s.actions.map((a, i) => <li key={i} className="flex gap-2"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[var(--an-green)]" aria-hidden /><span>{a.what}{a.who && <span className="text-[var(--an-muted)]"> · {a.who}</span>}{a.due && <span className="text-[var(--an-muted)]"> · {a.due}</span>}</span></li>)}</ul>
              {apple && <Btn kind="soft" className="mt-2" busy={busy === "reminders"} onClick={() => void toReminders()} data-testid="notes-local-reminders">Add to Apple Reminders</Btn>}
            </div>}
            {s.dates.length > 0 && <div>
              <h3 className="mb-1 text-[14px] font-bold">Dates</h3>
              <ul className="space-y-1 text-[15px]">{s.dates.map((d, i) => <li key={i} className="flex gap-2"><CalendarPlus className="mt-0.5 h-4 w-4 shrink-0 text-[var(--an-violet)]" aria-hidden />{d.title} · {d.date}{d.time ? ` ${d.time}` : ""}</li>)}</ul>
              {apple && <Btn kind="soft" className="mt-2" busy={busy === "calendar"} onClick={() => void toCalendar()} data-testid="notes-local-calendar">Add to the Calendar</Btn>}
            </div>}
            <Items title="Open questions" items={s.questions} />
          </div>
          {strictSummaryWorks(st) && <Btn kind="plain" className="mt-4" busy={busy === "summary"} onClick={() => void summarize()}><RefreshCw className="h-4 w-4" />Write it again</Btn>}
        </Section> : <Section title="Summary" icon={<Sparkles className="h-4 w-4" />}>
          {note.segments.length === 0 ? <p className="text-[15px] text-[var(--an-muted)]">Nothing was heard in this recording.</p>
            : strictSummaryWorks(st) ? <>
              {note.summaryProblem && <Notice tone="warn">{note.summaryProblem}</Notice>}
              <Btn kind="primary" busy={busy === "summary"} onClick={() => void summarize()} data-testid="notes-local-summarize"><Sparkles className="h-4 w-4" />Write the summary on this iPhone</Btn>
              {step && <p className="mt-2 text-[13px] text-[var(--an-muted)]">{step}</p>}
            </> : <Notice tone="warn">{strictSummaryWhy(st)} The full transcript is below.</Notice>}
        </Section>}
        {busy === "summary" && step && s && <p className="text-[13px] text-[var(--an-muted)]">{step}</p>}
      </> : <Section title="Transcript">
        {note.segments.length ? <div className="an-read space-y-2">{note.segments.map((l) => <p key={l.idx} className="text-[15px] leading-relaxed"><span className="an-time mr-2">{fmtClock(l.start)}</span>{l.text}</p>)}</div>
          : <p className="text-[15px] text-[var(--an-muted)]">Nothing was heard in this recording.</p>}
      </Section>}

      <div className="flex flex-wrap gap-2">
        <Btn kind="soft" onClick={() => void copyText(noteText(forExport(note))).then((ok) => say(ok ? "Copied." : "Couldn't copy."))}><Copy className="h-4 w-4" />Copy</Btn>
        <Btn kind="soft" onClick={pdf}><FileText className="h-4 w-4" />PDF</Btn>
        <Btn kind="plain" onClick={() => void rename()}><Pencil className="h-4 w-4" />Rename</Btn>
        <Btn kind="danger" onClick={() => void remove()} data-testid="notes-local-delete"><Trash2 className="h-4 w-4" />Delete</Btn>
      </div>
    </main>
  </>;
}
