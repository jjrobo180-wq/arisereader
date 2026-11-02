// Ask your notes: a question about anything you've recorded, answered from your own notes, with
// the note and the moment each part of the answer came from.
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { fmtClock } from "@shared/ariseNotes";
import { localDay, notesApi, type AskReply } from "./api";
import { Btn, Notice } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";

type Turn = { q: string; a?: AskReply; error?: string };
const EXAMPLES = ["What did I promise Maya's mom last month?", "What homework is due this week?", "What did the doctor say about the dose?", "What did we decide about the field trip?"];

export default function AskScreen({ ctx }: { ctx: AppCtx }) {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);
  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setQ(""); setBusy(true);
    setTurns((t) => [...t, { q: text }]);
    try { const a = await notesApi.ask(text, localDay()); setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x))); }
    catch (e: any) { setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: e.message } : x))); }
    finally { setBusy(false); }
  };
  // [2] in an answer becomes a small number that opens the note at that moment.
  const answer = (a: AskReply) => a.answer.split(/(\[\d{1,2}\])/g).map((part, i) => {
    const m = /^\[(\d{1,2})\]$/.exec(part);
    const c = m && a.cites.find((x) => x.n === Number(m[1]));
    return c ? <button key={i} type="button" onClick={() => ctx.go({ name: "note", id: c.noteId, t: c.t })} className="an-time mx-0.5 align-super text-[11px]" aria-label={`Source ${c.n}: ${c.title}, at ${fmtClock(c.t)}`}>{c.n}</button> : <span key={i}>{part}</span>;
  });
  return <>
    <TopBar ctx={ctx} title="Ask your notes" back={() => ctx.go({ name: "home" })} />
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col px-4 pb-6 pt-5 sm:px-5">
      {!ctx.me.features.ask ? <Notice tone="warn" action={<Btn kind="primary" onClick={() => ctx.go({ name: "settings", tab: "plan" })}>See plans</Btn>}>Ask your notes comes with Arise Notes Basic: ask anything you've recorded and get the answer with the note and minute it came from.</Notice> : <>
        <div className="flex-1 space-y-5" aria-live="polite">
          {!turns.length && <div className="pt-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--an-violet-soft)] text-[var(--an-violet)]"><Sparkles className="h-8 w-8" aria-hidden /></div>
            <h1 className="mt-4 text-[22px] font-bold">Ask anything you've recorded</h1>
            <p className="mx-auto mt-1 max-w-md text-[15px] text-[var(--an-muted)]">Answers come only from your own notes, with the note and the moment each part came from.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">{EXAMPLES.map((e) => <button key={e} type="button" className="an-chip" onClick={() => void ask(e)}>{e}</button>)}</div>
          </div>}
          {turns.map((t, i) => <div key={i} className="space-y-3">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--an-violet)] px-4 py-2.5 text-[15px] text-white">{t.q}</div>
            {t.error ? <Notice tone="bad">{t.error}</Notice> : !t.a ? <div className="w-fit rounded-2xl bg-white px-4 py-3 text-[14px] text-[var(--an-muted)] shadow-sm">Looking through your notes…</div> : <div className="an-card max-w-[92%] px-4 py-3">
              <p className="an-read text-[15px] leading-relaxed">{answer(t.a)}</p>
              {t.a.cites.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{t.a.cites.map((c) => <button key={c.n} type="button" onClick={() => ctx.go({ name: "note", id: c.noteId, t: c.t })} className="an-chip text-left" title={c.text}><b>{c.n}</b> {c.title} · {new Date(`${c.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmtClock(c.t)}</button>)}</div>}
            </div>}
          </div>)}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="sticky bottom-[max(.75rem,env(safe-area-inset-bottom))] mt-4 flex gap-2 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-[var(--an-line)]">
          <input className="an-input border-0 focus:shadow-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question about your notes" aria-label="Your question" maxLength={500} data-testid="notes-ask-input" />
          <Btn kind="primary" type="submit" busy={busy} disabled={q.trim().length < 3} aria-label="Ask"><Send className="h-4 w-4" /></Btn>
        </form>
      </>}
    </main>
  </>;
}
