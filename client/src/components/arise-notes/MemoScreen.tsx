// Voice memo to task: say it once ("Call the dentist Tuesday at 3") and it becomes one to-do, one
// calendar event or one note. You check it, then it goes to the planner.
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Check, ListChecks, Mic, NotebookPen, Square } from "lucide-react";
import { MEMO_MAX_SECS, fmtClock, type MemoIdea } from "@shared/ariseNotes";
import { announceSaved } from "@/lib/paneSync";
import { addToAppleReminders, addToIphoneCalendar, appleAddAvailable } from "@/lib/notesApple";
import { localDay, notesApi } from "./api";
import { recordMemo, canRecord } from "./recorder";
import { Btn, Notice, Section, Toggle, useToast } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";

// In the iPhone app a memo's to-do can also go to Apple Reminders, and its event to the iPhone
// Calendar (the same choices as the planner screen, remembered on this phone).
const APPLE_KEY = { task: "arise-notes-apple-reminders", event: "arise-notes-apple-calendar" };
const remembered = (k: string) => { try { return localStorage.getItem(k) !== "0"; } catch { return true; } };
const remember = (k: string, on: boolean) => { try { localStorage.setItem(k, on ? "1" : "0"); } catch { /* not kept */ } };

export default function MemoScreen({ ctx }: { ctx: AppCtx }) {
  const say = useToast();
  const [state, setState] = useState<"idle" | "rec" | "thinking" | "review" | "done">("idle");
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [text, setText] = useState("");
  const [idea, setIdea] = useState<MemoIdea | null>(null);
  const [noteId, setNoteId] = useState("");
  const [hub, setHub] = useState<"life" | "work">(ctx.hub);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const apple = appleAddAvailable();
  const [toApple, setToApple] = useState(() => ({ task: apple && remembered(APPLE_KEY.task), event: apple && remembered(APPLE_KEY.event) }));
  const rec = useRef<Awaited<ReturnType<typeof recordMemo>> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (tick.current) clearInterval(tick.current); void rec.current?.stop(); }, []);

  if (!ctx.me.features.memo) return <><TopBar ctx={ctx} title="Voice memo" back={() => ctx.go({ name: "home" })} /><main className="mx-auto max-w-xl px-4 pt-6"><Notice tone="warn" action={<Btn kind="primary" onClick={() => ctx.go({ name: "settings", tab: "plan" })}>See plans</Btn>}>Voice memo to task comes with Arise Notes Basic.</Notice></main></>;

  const start = async () => {
    setError("");
    try {
      rec.current = await recordMemo(MEMO_MAX_SECS, setLevel);
      setState("rec"); setSecs(0);
      tick.current = setInterval(() => { const s = rec.current?.elapsed() ?? 0; setSecs(s); if (s >= MEMO_MAX_SECS) void stop(); }, 250);
    } catch (e: any) { setError(e.message); }
  };
  const stop = async () => {
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    const r = rec.current; rec.current = null;
    const piece = await r?.stop();
    if (!piece) { setState("idle"); return; }
    setState("thinking");
    try {
      const out = await notesApi.memo(piece.blob, piece.ext, piece.secs, localDay());
      setNoteId(out.noteId); setText(out.text); setIdea(out.idea ?? (out.text ? { kind: "task", title: out.text.slice(0, 120), details: "", date: "", time: "" } : null));
      setState(out.text ? "review" : "idle");
      if (!out.text) setError("Nothing was heard. Try again a little closer to the phone.");
      void ctx.refreshMe(); ctx.refreshNotes();
    } catch (e: any) { setError(e.message); setState("idle"); }
  };
  const add = async () => {
    if (!idea || !noteId) return;
    if (idea.kind === "note") { say("Kept as a note."); ctx.go({ name: "note", id: noteId }); return; }
    setBusy(true);
    try {
      const r = await notesApi.send(noteId, idea.kind === "event"
        ? { hub, tasks: [], events: [{ title: idea.title, date: idea.date, time: idea.time, notes: idea.details }] }
        : { hub, tasks: [{ title: idea.title, who: "", due: idea.date, time: idea.time, notes: idea.details }], events: [] });
      announceSaved(hub === "work" ? "workhub" : "todo", ctx.me.user.id);
      const where = idea.kind === "event" ? `On your ${hub === "work" ? "WorkHub" : "LifeHub"} calendar` : `Added to ${hub === "work" ? "WorkHub" : r.list ? `your ${r.list} list` : "LifeHub"}`;
      let also = "";
      try {
        if (idea.kind === "task" && toApple.task) { if (await addToAppleReminders([{ title: idea.title, due: idea.date, time: idea.time, notes: idea.details }])) also = " and Apple Reminders"; }
        if (idea.kind === "event" && toApple.event) { if (await addToIphoneCalendar([{ title: idea.title, date: idea.date, time: idea.time, notes: idea.details }])) also = " and the iPhone Calendar"; }
      } catch (e: any) { say(`${where}, but not on the iPhone: ${e.message}`); setState("done"); return; }
      say(`${where}${also}.`);
      setState("done");
    } catch (e: any) { say(e.message); }
    finally { setBusy(false); }
  };
  const set = (p: Partial<MemoIdea>) => setIdea((i) => (i ? { ...i, ...p } : i));

  return <>
    <TopBar ctx={ctx} title="Voice memo" back={() => ctx.go({ name: "home" })} />
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-24 pt-6 sm:px-5">
      {(state === "idle" || state === "rec" || state === "thinking") && <section className="an-card flex flex-col items-center px-5 py-8 text-center">
        <p className="text-[15px] text-[var(--an-muted)]">{state === "rec" ? "Listening… tap to finish." : state === "thinking" ? "Writing it down…" : "Say one thing to do or remember. “Email Ms. Lee about the field trip by Friday.”"}</p>
        <button type="button" onClick={() => (state === "rec" ? void stop() : state === "idle" ? void start() : undefined)} disabled={state === "thinking" || !canRecord()} data-testid="notes-memo-button"
          className={`mt-6 grid h-28 w-28 place-items-center rounded-full text-white transition ${state === "rec" ? "an-pulse bg-[var(--an-coral)]" : "bg-[#f5a524] hover:brightness-105"} disabled:opacity-60`} aria-label={state === "rec" ? "Stop the voice memo" : "Start a voice memo"}>
          {state === "rec" ? <Square className="h-10 w-10" /> : <Mic className="h-11 w-11" />}
        </button>
        <div className="an-bars mt-4 flex h-8 items-center" aria-hidden>{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ height: `${Math.max(4, level * 30 * (0.5 + 0.5 * Math.abs(Math.sin(i + secs * 3))))}px`, background: "#f5a524" }} />)}</div>
        <p className="mt-1 font-mono text-[15px] tabular-nums text-[var(--an-muted)]">{fmtClock(secs)} / {fmtClock(MEMO_MAX_SECS)}</p>
      </section>}
      {error && <Notice tone="bad">{error}</Notice>}
      {state === "review" && idea && <Section title="Is this right?">
        <p className="mb-4 rounded-2xl bg-[var(--an-bg)] px-4 py-3 text-[14px] italic text-[var(--an-muted)]">“{text}”</p>
        <div className="mb-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="What it is">
          {([["task", "To-do", <ListChecks key="t" className="h-4 w-4" />], ["event", "Calendar", <CalendarPlus key="e" className="h-4 w-4" />], ["note", "Note", <NotebookPen key="n" className="h-4 w-4" />]] as const).map(([k, label, icon]) =>
            <button key={k} type="button" role="radio" aria-checked={idea.kind === k} onClick={() => set({ kind: k })} className={`an-btn ${idea.kind === k ? "an-primary" : "an-plain"}`}>{icon}{label}</button>)}
        </div>
        <div className="space-y-3">
          <input className="an-input" value={idea.title} onChange={(e) => set({ title: e.target.value })} aria-label="Title" maxLength={120} />
          {idea.kind !== "note" && <div className="flex flex-wrap gap-2"><input type="date" className="an-input !w-auto" value={idea.date} onChange={(e) => set({ date: e.target.value })} aria-label="Date" /><input type="time" className="an-input !w-auto" value={idea.time} onChange={(e) => set({ time: e.target.value })} aria-label="Time" /></div>}
          {idea.kind !== "note" && ctx.me.user.workHub && <div className="flex gap-2"><button type="button" className="an-chip" aria-pressed={hub === "life"} onClick={() => setHub("life")}>LifeHub</button><button type="button" className="an-chip" aria-pressed={hub === "work"} onClick={() => setHub("work")}>WorkHub</button></div>}
          {idea.kind === "event" && !idea.date && <p className="text-[13px] text-[var(--an-amber)]">Pick a day for the calendar.</p>}
          {apple && idea.kind !== "note" && (idea.kind === "task"
            ? <Toggle on={toApple.task} onChange={(v) => { setToApple((a) => ({ ...a, task: v })); remember(APPLE_KEY.task, v); }} label="Also add to Apple Reminders" />
            : <Toggle on={toApple.event} onChange={(v) => { setToApple((a) => ({ ...a, event: v })); remember(APPLE_KEY.event, v); }} label="Also add to the iPhone Calendar" />)}
          <Btn kind="primary" className="w-full" busy={busy} disabled={!idea.title.trim() || (idea.kind === "event" && !idea.date)} onClick={() => void add()} data-testid="notes-memo-add"><Check className="h-4 w-4" />{idea.kind === "note" ? "Keep as a note" : idea.kind === "event" ? "Add to calendar" : "Add the to-do"}</Btn>
        </div>
      </Section>}
      {state === "done" && <Section className="text-center"><p className="text-[16px] font-semibold">Done!</p><div className="mt-4 flex justify-center gap-2"><Btn kind="primary" onClick={() => { setState("idle"); setIdea(null); setText(""); }}><Mic className="h-4 w-4" />Another memo</Btn><Btn kind="plain" onClick={() => ctx.go({ name: "home" })}>Back to notes</Btn></div></Section>}
    </main>
  </>;
}
