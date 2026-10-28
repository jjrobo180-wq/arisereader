// AI help while grading reading comprehension: a suggested score from 0 to 10 with the reason for
// each area (accuracy, comprehension, details, organization, spelling & grammar, effort) and a draft
// note to the student. The teacher can use the score, use it with the note, or ignore it and grade
// on their own; nothing is saved or sent until they press Save. Used by ComprehensionReview (site
// and admin) and HubComprehension (WorkHub).
import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { COMPREHENSION, type AiSuggestion } from "@shared/comprehension";

const MAX = COMPREHENSION.bonusPoints;
const tone = (n: number) => (n >= 8 ? "bg-emerald-500" : n >= 5 ? "bg-amber-400" : "bg-rose-500");

export default function AiGradeSuggestion({ itemId, headers, onUse, autoOpen = false }: {
  itemId: number;
  headers: () => Record<string, string>;
  /** Puts the AI's points (and note, when asked) into the grade boxes. The teacher still saves. */
  onUse: (points: number, note?: string) => void;
  autoOpen?: boolean;
}) {
  const [s, setS] = useState<AiSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(autoOpen);

  const ask = async (again = false) => {
    setBusy(true); setError(""); setOpen(true);
    try {
      const res = await fetch(`${API_BASE}/api/comprehension/review/${itemId}/suggest`, { method: "POST", headers: headers(), body: JSON.stringify(again ? { again: true } : {}) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Could not get an AI suggestion.");
      setS(d.suggestion);
    } catch (e: any) { setError(e?.message || "Could not get an AI suggestion."); }
    finally { setBusy(false); }
  };

  if (!open && !s) {
    return <button type="button" onClick={() => void ask()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3.5 text-sm font-bold text-violet-800 hover:bg-violet-100" data-testid="ai-suggest">
      <Sparkles className="h-4 w-4" /> AI suggested score
    </button>;
  }

  return <div className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-3.5 text-slate-800 sm:p-4" data-testid="ai-suggestion">
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-violet-700"><Sparkles className="h-4 w-4" /> AI suggestion</span>
      {s && !busy && <button type="button" onClick={() => void ask(true)} className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-white hover:text-slate-800"><RefreshCw className="h-3.5 w-3.5" /> Ask again</button>}
    </div>

    {busy && <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Reading the answers…</p>}
    {error && !busy && <p className="mt-3 text-sm text-rose-700" role="alert">{error} <button type="button" className="font-semibold underline" onClick={() => void ask()}>Try again</button></p>}

    {s && !busy && <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-1" aria-label={`AI suggests ${s.points} out of ${MAX}`}>
          <span className="text-4xl font-black leading-none text-violet-800">{s.points}</span><span className="text-sm font-bold text-slate-500">/{MAX}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onUse(s.points)} className="min-h-10 rounded-xl bg-violet-600 px-3.5 text-sm font-bold text-white hover:bg-violet-700" data-testid="ai-use-score">Use {s.points}</button>
          {s.note && <button type="button" onClick={() => onUse(s.points, s.note)} className="min-h-10 rounded-xl border border-violet-300 bg-white px-3.5 text-sm font-bold text-violet-800 hover:bg-violet-50" data-testid="ai-use-both">Use {s.points} + note</button>}
        </div>
        <span className="text-xs text-slate-500">Or change the points below and grade it your way.</span>
      </div>
      {s.summary && <p className="mt-3 text-sm leading-6 text-slate-700">{s.summary}</p>}
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Score by area">
        {s.areas.map((a) => <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="flex items-center justify-between gap-2"><b className="text-sm">{a.label}</b><span className="text-sm font-black tabular-nums">{a.score}<span className="text-xs font-semibold text-slate-400">/{MAX}</span></span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${tone(a.score)}`} style={{ width: `${(a.score / MAX) * 100}%` }} /></div>
          <p className="mt-1.5 text-xs leading-5 text-slate-600">{a.why}</p>
        </li>)}
      </ul>
      {s.note && <p className="mt-3 rounded-xl bg-white p-2.5 text-sm text-slate-700 ring-1 ring-slate-200"><b className="text-xs uppercase tracking-wider text-slate-500">Suggested note</b><br />{s.note}</p>}
      {s.flags.length > 0 && <ul className="mt-3 space-y-1">{s.flags.map((f, i) => <li key={i} className="flex gap-2 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{f}</li>)}</ul>}
      <p className="mt-3 text-[11px] text-slate-400">The AI can be wrong. You decide the grade; nothing is sent until you press Save.</p>
    </>}
  </div>;
}
