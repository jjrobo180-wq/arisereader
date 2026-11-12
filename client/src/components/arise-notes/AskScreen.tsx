// Ask: two kinds of answers and three looks, each a toggle.
//   From:  "My notes" answers only from what you've recorded, with the note and the moment each part
//          came from; "Anything" is Undercover's AI (live web, the date, the weather; askUndercover.ts).
//   Look:  "Chat" (bubbles and source chips), "Notes" (reads like your own meeting notes on a page),
//          "Text" (looks like a text thread). Both choices are remembered on this device.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileText, MessageCircle, MessagesSquare, Send, Sparkles } from "lucide-react";
import { fmtClock } from "@shared/ariseNotes";
import { answerLines, type UndercoverMsg } from "@shared/undercover";
import { askAi, undercoverPrefs } from "@/undercover/askUndercover";
import { localDay, notesApi, type AskReply } from "./api";
import { Btn, Notice } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";

type From = "notes" | "anything";
type Look = "chat" | "doc" | "text";
type Turn = { q: string; from: From; a?: AskReply; text?: string; error?: string };
const EXAMPLES: Record<From, string[]> = {
  notes: ["What did I promise Maya's mom last month?", "What homework is due this week?", "What did the doctor say about the dose?", "What did we decide about the field trip?"],
  anything: ["What's the weather tomorrow?", "What does EBITDA mean?", "How do I push back on a deadline politely?", "Give me 3 smart questions for this meeting"],
};
const KEY = "arise-notes-ask-view";
const loadView = (): { from: From; look: Look } => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return { from: v?.from === "notes" ? "notes" : "anything", look: v?.look === "doc" || v?.look === "text" ? v.look : "chat" }; } catch { return { from: "anything", look: "chat" }; }
};

function Toggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string, ReactNode][]; onChange: (v: T) => void }) {
  return <div role="group" aria-label={label} className="flex rounded-full bg-[color-mix(in_srgb,var(--an-ink)_7%,transparent)] p-1">
    {options.map(([v, text, icon]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
      className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition ${value === v ? "bg-white text-[var(--an-ink)] shadow-sm" : "text-[var(--an-muted)]"}`}>{icon}{text}</button>)}
  </div>;
}

export default function AskScreen({ ctx }: { ctx: AppCtx }) {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [view, setViewState] = useState(loadView);
  const setView = (v: Partial<typeof view>) => setViewState((old) => { const next = { ...old, ...v }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not kept */ } return next; });
  const { from, look } = view;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);
  const notesLocked = !ctx.me.features.ask;

  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 2 || busy) return;
    setQ(""); setBusy(true);
    const mine = from;
    setTurns((t) => [...t, { q: text, from: mine }]);
    const done = (patch: Partial<Turn>) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, ...patch } : x)));
    try {
      if (mine === "notes") done({ a: await notesApi.ask(text, localDay()) });
      else {
        // The "Anything" side remembers the conversation so far (only its own turns).
        const history: UndercoverMsg[] = turns.filter((t) => t.from === "anything" && t.text).flatMap((t) => [{ role: "user" as const, content: t.q }, { role: "assistant" as const, content: t.text! }]).slice(-14);
        const theme = look === "text" ? "text" : look === "doc" ? "docNotes" : "docComments";
        done({ text: await askAi(theme, [...history, { role: "user", content: text }], undercoverPrefs()) });
      }
    } catch (e: any) { done({ error: e?.message || "Couldn't get an answer." }); }
    finally { setBusy(false); }
  };

  // [2] in an answer becomes a small number that opens the note at that moment.
  const answer = (a: AskReply) => a.answer.split(/(\[\d{1,2}\])/g).map((part, i) => {
    const m = /^\[(\d{1,2})\]$/.exec(part);
    const c = m && a.cites.find((x) => x.n === Number(m[1]));
    return c ? <button key={i} type="button" onClick={() => ctx.go({ name: "note", id: c.noteId, t: c.t })} className="an-time mx-0.5 align-super text-[11px]" aria-label={`Source ${c.n}: ${c.title}, at ${fmtClock(c.t)}`}>{c.n}</button> : <span key={i}>{part}</span>;
  });
  const cites = (a: AskReply, small = false) => a.cites.length > 0 && <div className={`flex flex-wrap gap-2 ${small ? "mt-1.5" : "mt-3"}`}>{a.cites.map((c) => <button key={c.n} type="button" onClick={() => ctx.go({ name: "note", id: c.noteId, t: c.t })} className={`an-chip text-left ${small ? "!min-h-0 !py-1 text-[12px]" : ""}`} title={c.text}><b>{c.n}</b> {c.title} · {new Date(`${c.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmtClock(c.t)}</button>)}</div>;
  const body = (t: Turn) => t.a ? answer(t.a) : t.text ?? "";
  const pending = (t: Turn) => !t.a && !t.text && !t.error;

  const chatView = turns.map((t, i) => <div key={i} className="space-y-3">
    <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--an-violet)] px-4 py-2.5 text-[15px] text-white">{t.q}</div>
    {t.error ? <Notice tone="bad">{t.error}</Notice> : pending(t) ? <div className="w-fit rounded-2xl bg-white px-4 py-3 text-[14px] text-[var(--an-muted)] shadow-sm">{t.from === "notes" ? "Looking through your notes…" : "Thinking…"}</div> : <div className="an-card max-w-[92%] px-4 py-3">
      <p className="an-read whitespace-pre-line text-[15px] leading-relaxed">{body(t)}</p>
      {t.a && cites(t.a)}
    </div>}
  </div>);

  const docView = <div className="rounded-[6px] bg-white px-[clamp(20px,6vw,64px)] py-[clamp(24px,5vw,56px)] text-[#1f2937] shadow-[0_1px_3px_rgba(15,23,42,.12)]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
    <h2 className="m-0 text-[24px] font-semibold">Notes</h2>
    <p className="mb-4 mt-1 text-[14px] text-[#475569]">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
    {!turns.length && <p className="text-[15px] text-[#94a3b8]">Type a question below. The answer is written here like your own notes.</p>}
    {turns.map((t, i) => <div key={i} className="mb-4 text-[16px] leading-[1.6]">
      <div className="font-semibold">{t.q}</div>
      {t.error ? <div className="text-[14px] text-[#b91c1c]">{t.error}</div> : pending(t) ? <div className="text-[#64748b]">…</div>
        : t.a ? <><div>{answer(t.a)}</div>{cites(t.a, true)}</>
          : <ul className="m-0 pl-5">{answerLines(t.text || "").map((l, j) => <li key={j}>{l}</li>)}</ul>}
    </div>)}
  </div>;

  const textView = <div className="overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-[var(--an-line)]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
    <div className="flex items-center gap-3 border-b border-[#e5e7eb] px-4 py-3">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-[#c7d2fe] font-semibold text-[#3730a3]">{from === "notes" ? "N" : "S"}</div>
      <div><div className="text-[15px] font-semibold text-[#111827]">{from === "notes" ? "Notes" : "Sam"}</div><div className="text-[12px] text-[#4b5563]">{busy ? "typing…" : "Active now"}</div></div>
    </div>
    <div className="flex min-h-[40vh] flex-col gap-2 p-4">
      {turns.map((t, i) => <div key={i} className="flex flex-col gap-2">
        <div className="max-w-[78%] self-end whitespace-pre-wrap rounded-[18px] bg-[#2563eb] px-3.5 py-2.5 text-[15px] leading-snug text-white">{t.q}</div>
        {t.error ? <div className="self-center text-[12px] text-[#b91c1c]">Not delivered. {t.error}</div>
          : pending(t) ? <div className="self-start rounded-[18px] bg-[#f1f5f9] px-3.5 py-2.5 text-[15px] text-[#4b5563]">typing…</div>
            : <div className="max-w-[78%] self-start rounded-[18px] bg-[#f1f5f9] px-3.5 py-2.5 text-[15px] leading-snug text-[#111827]"><span className="whitespace-pre-wrap">{body(t)}</span>{t.a && cites(t.a, true)}</div>}
      </div>)}
    </div>
  </div>;

  const empty = !turns.length && look === "chat" && <div className="pt-6 text-center">
    <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--an-violet-soft)] text-[var(--an-violet)]"><Sparkles className="h-8 w-8" aria-hidden /></div>
    <h1 className="mt-4 text-[22px] font-bold">{from === "notes" ? "Ask anything you've recorded" : "Ask anything"}</h1>
    <p className="mx-auto mt-1 max-w-md text-[15px] text-[var(--an-muted)]">{from === "notes" ? "Answers come only from your own notes, with the note and the moment each part came from." : "Live answers from the web, with today's date and the real weather."}</p>
  </div>;

  return <>
    <TopBar ctx={ctx} title="Ask" back={() => ctx.go({ name: "home" })} />
    <main className="mx-auto flex max-w-3xl flex-col px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <Toggle label="Answer from" value={from} onChange={(v) => setView({ from: v })} options={[["anything", "Notes + web", <Sparkles key="a" className="h-4 w-4" aria-hidden />], ["notes", "Only my notes", <FileText key="n" className="h-4 w-4" aria-hidden />]]} />
        <Toggle label="Look" value={look} onChange={(v) => setView({ look: v })} options={[["chat", "Chat", <MessagesSquare key="c" className="h-4 w-4" aria-hidden />], ["doc", "Notes", <FileText key="d" className="h-4 w-4" aria-hidden />], ["text", "Text", <MessageCircle key="t" className="h-4 w-4" aria-hidden />]]} />
      </div>
      {from === "notes" && notesLocked ? <Notice tone="warn" action={<Btn kind="primary" onClick={() => ctx.go({ name: "settings", tab: "plan" })}>See plans</Btn>}>Asking your own notes comes with Arise Notes Basic. "Anything" works on every plan.</Notice> : <>
        <div className="flex-1 space-y-5" aria-live="polite">
          {empty}
          {!turns.length && <div className="flex flex-wrap justify-center gap-2">{EXAMPLES[from].map((e) => <button key={e} type="button" className="an-chip" onClick={() => void ask(e)}>{e}</button>)}</div>}
          {look === "doc" ? docView : look === "text" ? textView : chatView}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl gap-2 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-[var(--an-line)]" data-testid="notes-ask-bar">
          <input className="an-input border-0 focus:shadow-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder={look === "text" ? "Text message" : from === "notes" ? "Ask a question about your notes" : "Ask anything"} aria-label="Your question" maxLength={500} data-testid="notes-ask-input" />
          <Btn kind="primary" type="submit" busy={busy} disabled={q.trim().length < 2} aria-label="Ask"><Send className="h-4 w-4" /></Btn>
        </form>
      </>}
    </main>
  </>;
}
