// Ask Fit: ask the AI about your own past and future workouts, food, sleep and weight. In every layout:
// a card on Today opens it. The server answers from what's saved (server/fit.ts POST /api/fit/ask), so it
// only knows what you've logged. Part of Fit+.
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { fitApi } from "./fitStore";
import { isPlusError, usePlus } from "./FitPlus";
import { C, Sheet, cardStyle, display, haptic, inputStyle } from "./fitUi";

type Turn = { role: "user" | "assistant"; text: string };
const KEY = "arise-fit-ask";
const IDEAS = [
  "How did my last month of training go?",
  "Am I on track for my goal weight?",
  "What should I train next?",
  "Which lift is improving fastest?",
  "When could I hit a new bench record?",
  "Am I eating enough protein?",
  "How is my sleep affecting my workouts?",
  "What muscles am I skipping?",
];

/** The entry card on Today (every layout). */
export function AskFitCard({ onOpen }: { onOpen: () => void }) {
  return <button type="button" onClick={() => { haptic("light"); onOpen(); }} className="fit-in mt-3 flex w-full items-center gap-3 rounded-[16px] p-3.5 text-left active:scale-[.99]" style={cardStyle} data-testid="fit-ask-card">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: C.lime, color: C.ink }}><Sparkles className="h-5 w-5" /></span>
    <span className="min-w-0 flex-1"><span className="block text-[16px]" style={display}>Ask Fit</span>
      <span className="block truncate text-[13px]" style={{ color: C.dim }}>Ask about your past or future workouts</span></span>
  </button>;
}

export function FitAsk({ token, onClose }: { token: string | null; onClose: () => void }) {
  const { ask } = usePlus();
  const [turns, setTurns] = useState<Turn[]>(() => { try { return JSON.parse(sessionStorage.getItem(KEY) || "[]").slice(-20); } catch { return []; } });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-20))); } catch { /* not kept */ } end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  const send = async (text: string) => {
    const question = text.trim(); if (!question || busy) return;
    haptic("light"); setErr(""); setQ(""); setBusy(true);
    const history = turns.slice(-6);
    setTurns((t) => [...t, { role: "user", text: question }]);
    try {
      const r = await fitApi<{ answer: string }>(token, "/ask", { method: "POST", body: JSON.stringify({ question, history }) });
      setTurns((t) => [...t, { role: "assistant", text: r.answer }]);
    } catch (e: any) {
      setTurns((t) => t.slice(0, -1)); setQ(question);
      if (isPlusError(e)) ask("ask-fit"); else setErr(e?.message || "Couldn't answer right now. Try again in a minute.");
    } finally { setBusy(false); }
  };

  return <Sheet title="Ask Fit" onClose={onClose} testId="fit-ask" right={turns.length ? <button type="button" onClick={() => setTurns([])} className="text-[14px] font-semibold" style={{ color: C.lime }}>Clear</button> : undefined}>
    <div className="flex min-h-[60vh] flex-col">
      {!turns.length && <div className="mb-4">
        <p className="text-[15px]" style={{ color: C.dim }}>Ask anything about what you've logged: workouts, lifts, food, water, sleep and weight, plus where your trends are heading.</p>
        <div className="mt-3 flex flex-wrap gap-2">{IDEAS.map((i) => <button key={i} type="button" onClick={() => void send(i)} className="rounded-full px-3 py-2 text-left text-[13.5px] font-semibold" style={{ background: C.card2 }}>{i}</button>)}</div>
      </div>}
      <div className="flex-1 space-y-2.5" aria-live="polite">
        {turns.map((t, n) => <div key={n} className={`max-w-[88%] whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 text-[15px] leading-[1.45] ${t.role === "user" ? "ml-auto" : ""}`}
          style={t.role === "user" ? { background: C.lime, color: C.ink } : { background: C.card2 }}>{t.text}</div>)}
        {busy && <div className="flex items-center gap-2 text-[14px]" style={{ color: C.dim }}><Loader2 className="h-4 w-4 animate-spin" /> Looking at your numbers…</div>}
        {err && <p className="text-[14px]" style={{ color: "#ef4444" }}>{err}</p>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(q); }} className="sticky bottom-0 mt-3 flex items-end gap-2 pb-1 pt-2" style={{ background: C.bg }}>
        <textarea value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(q); } }} rows={1} maxLength={400}
          placeholder="Ask about your workouts…" aria-label="Your question" className="max-h-32 min-h-[48px] flex-1 resize-none rounded-[14px] px-3.5 py-3 text-[16px] outline-none" style={inputStyle} data-testid="fit-ask-input" />
        <button type="submit" disabled={!q.trim() || busy} aria-label="Ask" className="grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-40" style={{ background: C.lime, color: C.ink }} data-testid="fit-ask-send"><ArrowUp className="h-5 w-5" /></button>
      </form>
      <p className="mt-1 text-center text-[11.5px]" style={{ color: C.dim }}>AI answers from your logged data. Forecasts are estimates, not medical advice.</p>
    </div>
  </Sheet>;
}
