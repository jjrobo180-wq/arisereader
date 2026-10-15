// Arise hubs: the AI assistant plugin's chat. A round button opens a chat panel (full screen on a phone) where the
// person asks anything and the site's AI answers (server/hubChat.ts). The chat is kept on this device for the session.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Copy, Loader2, Send, Sparkles, Trash2, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

type Turn = { role: "user" | "assistant"; content: string };
type Hub = "work" | "life";

const STARTERS: Record<Hub, string[]> = {
  work: ["Give me 3 quick warm-ups for 4th grade fractions", "Help me word an IEP reading fluency goal", "Draft a friendly email to a parent about missing work", "Ideas to keep a student on task during independent work"],
  life: ["Easy dinners for this week with chicken", "Make a kid-friendly morning routine", "Packing list for a 3-day beach trip", "Explain long division simply for my 4th grader"],
};
const NAME: Record<Hub, string> = { work: "WorkHub", life: "LifeHub" };
const keyFor = (hub: Hub) => `arise-chat-${hub}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** The chat button and panel. `accent` colours the button and the person's messages.
 *
 *  Both floating buttons sit at the bottom right, so their heights have to be worked out together
 *  or they land on top of each other. `lift` means an Add button sits below this one, so raise by
 *  its height; `raiseRem` is how far that Add button has itself been raised to clear a phone menu
 *  running along the bottom. Lift alone wasn't enough: with the menu along the bottom the Add
 *  button rose past the chat button and the two overlapped. */
export function HubChat({ hub, token, accent, lift = false, raiseRem = 0 }: { hub: Hub; token: string | null; accent: string; lift?: boolean; raiseRem?: number }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>(() => { try { return JSON.parse(sessionStorage.getItem(keyFor(hub)) || "[]"); } catch { return []; } });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { try { sessionStorage.setItem(keyFor(hub), JSON.stringify(turns.slice(-40))); } catch { /* not kept */ } }, [turns, hub]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [turns, busy, open]);
  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => box.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...turns, { role: "user" as const, content }];
    setTurns(next); setDraft(""); setError(""); setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/hub-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ hub, today: today(), messages: next.slice(-24) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "The AI couldn't answer right now.");
      setTurns((t) => [...t, { role: "assistant", content: String(body?.reply || "") }]);
    } catch (e: any) {
      setError(e?.message || "The AI couldn't answer right now.");
    } finally { setBusy(false); }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void send(draft); };
  const copy = async (i: number) => { try { await navigator.clipboard.writeText(turns[i].content); setCopied(i); window.setTimeout(() => setCopied(-1), 1500); } catch { /* can't copy here */ } };

  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} aria-label="Open the AI assistant" data-testid="hub-chat-open"
      className={`fixed right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition active:scale-90 ${accent} `} style={{ bottom: `calc(max(1.25rem, env(safe-area-inset-bottom)) + ${(lift ? 4.25 : 0) + raiseRem}rem)` }}>
      <Sparkles className="h-6 w-6" />
    </button>}
    {open && <div className="fixed inset-0 z-[650] flex items-end justify-end bg-slate-950/20 sm:bg-transparent sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="AI assistant" data-testid="hub-chat"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(640px,85vh)] sm:w-[400px] sm:rounded-3xl sm:border sm:border-slate-200">
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white ${accent}`}><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">AI assistant</p><p className="text-xs text-slate-500">{NAME[hub]} · answers can be wrong, so check what matters</p></div>
          {turns.length > 0 && <button type="button" onClick={() => { setTurns([]); setError(""); }} aria-label="Clear the chat" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><Trash2 className="h-4 w-4" /></button>}
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <div ref={list} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {!turns.length && <div>
            <p className="mb-3 text-sm text-slate-600">Ask anything. A few ideas to start:</p>
            <div className="grid grid-cols-1 gap-2">{STARTERS[hub].map((s) => <button key={s} type="button" onClick={() => void send(s)} className="min-h-11 rounded-2xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">{s}</button>)}</div>
          </div>}
          {turns.map((t, i) => t.role === "user"
            ? <div key={i} className="flex justify-end"><p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3.5 py-2 text-sm text-white ${accent}`}>{t.content}</p></div>
            : <div key={i} className="max-w-[92%]"><div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">{t.content}</div>
                <button type="button" onClick={() => void copy(i)} className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100">{copied === i ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}</button></div>)}
          {busy && <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</p>}
          {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">{error}</p>}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-slate-100 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <textarea ref={box} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
            rows={1} maxLength={4000} placeholder="Ask the AI assistant…" aria-label="Message"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 px-3.5 py-2.5 text-base outline-none focus:border-slate-400" />
          <button type="submit" disabled={!draft.trim() || busy} aria-label="Send" className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40 ${accent}`}><Send className="h-5 w-5" /></button>
        </form>
      </section>
    </div>}
  </>;
}
