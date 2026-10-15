// The Daily Brief app, for WorkHub and LifeHub: today at a glance, opened from the header's sun button, from
// search, or by itself the first time the hub opens each morning (a choice kept on this device). It can read
// itself aloud, be copied to share, or be printed.
import { useEffect, useState } from "react";
import { ArrowRight, Copy, Printer, Square, Sun, Volume2, X } from "lucide-react";
import { briefText, type Brief } from "@shared/dailyBrief";

const autoKey = (hub: string) => `arise-brief-auto-${hub}`;
const seenKey = (hub: string) => `arise-brief-seen-${hub}`;

/** Whether the brief opens by itself today: on unless turned off, once a day, in the morning. */
export function useMorningBrief(hub: "work" | "life", today: string, ready: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!ready) return;
    try {
      if (localStorage.getItem(autoKey(hub)) === "off" || localStorage.getItem(seenKey(hub)) === today || new Date().getHours() >= 12) return;
      localStorage.setItem(seenKey(hub), today);
      setOpen(true);
    } catch { /* storage off: don't pop up */ }
  }, [hub, today, ready]);
  return [open, setOpen] as const;
}

export function BriefButton({ onOpen, className = "" }: { onOpen: () => void; className?: string }) {
  return <button type="button" onClick={onOpen} aria-label="Daily brief" title="Daily brief" data-testid="brief-open"
    className={`inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 ${className}`}><Sun className="h-4 w-4 text-amber-500" /><span className="hidden 2xl:inline">Brief</span></button>;
}

export function DailyBrief({ brief, hub, onClose, onOpen, tint = "from-[#2b2a8f] via-[#6d4fd8] to-[#f29a14]" }: { brief: Brief; hub: "work" | "life"; onClose: () => void; onOpen: (where: string) => void; tint?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [auto, setAuto] = useState(() => { try { return localStorage.getItem(autoKey(hub)) !== "off"; } catch { return true; } });
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    const { overflow } = document.body.style; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = overflow; try { speechSynthesis.cancel(); } catch { /* none */ } };
  }, [onClose]);
  const speak = () => {
    try {
      if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
      const u = new SpeechSynthesisUtterance(briefText(brief)); u.rate = 0.98; u.onend = () => setSpeaking(false);
      speechSynthesis.cancel(); speechSynthesis.speak(u); setSpeaking(true);
    } catch { setSpeaking(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(briefText(brief)); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* can't copy */ } };
  const setAutoOn = (on: boolean) => { setAuto(on); try { localStorage.setItem(autoKey(hub), on ? "on" : "off"); } catch { /* not kept */ } };
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const filled = brief.sections.filter((s) => s.lines.length), empty = brief.sections.filter((s) => !s.lines.length);

  return <div className="fixed inset-0 z-[680] overflow-y-auto bg-slate-100 print:static print:bg-white" role="dialog" aria-modal="true" aria-label="Daily brief" data-testid="daily-brief">
    <div className="mx-auto max-w-4xl px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
      <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><Sun className="h-4 w-4 text-amber-500" />Daily brief</p>
        <div className="flex gap-1.5">
          {canSpeak && <button type="button" onClick={speak} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">{speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}<span className="hidden sm:inline">{speaking ? "Stop" : "Read aloud"}</span></button>}
          <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"><Copy className="h-4 w-4" /><span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span></button>
          <button type="button" onClick={() => window.print()} className="hidden min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm sm:inline-flex"><Printer className="h-4 w-4" />Print</button>
          <button type="button" onClick={onClose} aria-label="Close the brief" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <section className={`rounded-[2rem] bg-gradient-to-br ${tint} p-6 text-white shadow-lg sm:p-8`}>
        <p className="text-sm font-semibold opacity-85">{brief.date}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{brief.greeting}</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed opacity-95 sm:text-lg">{brief.summary}</p>
      </section>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {filled.map((s) => <section key={s.id} className="rounded-3xl bg-white p-4 shadow-sm sm:p-5" data-testid={`brief-${s.id}`}>
          <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-base font-black text-slate-900">{s.title}</h2>
            {s.open && <button type="button" onClick={() => { onClose(); onOpen(s.open!); }} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 print:hidden">Open<ArrowRight className="h-3.5 w-3.5" /></button>}</div>
          <ul className="divide-y divide-slate-100">{s.lines.slice(0, 12).map((l, i) => <li key={i} className="flex items-start gap-3 py-2">
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{l.text}</span>{l.sub && <span className="block text-xs text-slate-500">{l.sub}</span>}</span>
            {l.when && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${l.tone === "warn" ? "bg-rose-50 text-rose-700" : l.tone === "good" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{l.when}</span>}
          </li>)}</ul>
          {s.lines.length > 12 && <p className="pt-1 text-xs text-slate-500">and {s.lines.length - 12} more</p>}
        </section>)}
      </div>
      {empty.length > 0 && <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-500">{empty.map((s) => s.empty).join(" ")}</p>}
      <label className="mt-5 flex min-h-11 items-center gap-3 text-sm text-slate-600 print:hidden"><input type="checkbox" className="h-5 w-5" checked={auto} onChange={(e) => setAutoOn(e.target.checked)} />Show my brief the first time I open the hub each morning</label>
    </div>
  </div>;
}
