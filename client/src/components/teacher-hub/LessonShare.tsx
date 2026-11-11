// "Share with school": a link anyone can open without signing in (an admin, a coach, a sub) to see your lesson
// plans, read only. Students' names, marks and scores, reteach groups and your reflections never go out.
import { useEffect, useState } from "react";
import { Check, Copy, Link2, RefreshCw, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

/** The link to give out: this site's page for it (on arisetodo.com the app lives at /app; the iPhone app uses the website). */
export const lessonShareUrl = (token: string) => {
  const o = typeof window !== "undefined" && /^https:\/\//.test(window.location.origin) ? window.location.origin : "https://arisetodo.com";
  return /arisetodo\.com$/i.test(new URL(o).hostname) ? `${o}/app#/plans/${token}` : `${o}/#/plans/${token}`;
};

export function LessonSharePanel({ token, onClose }: { token: string | null; onClose: () => void }) {
  const [state, setState] = useState<{ token: string | null; on: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const call = async (body?: object) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/teacher-hub/lesson-share`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "That didn't work. Try again.");
      setState(data);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { void call(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const url = state?.on && state.token ? lessonShareUrl(state.token) : "";
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError("Couldn't copy. Press and hold the link to copy it."); } };
  return <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70" data-testid="lesson-share">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Link2 className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-slate-900">Share your lesson plans with your school</h3>
        <p className="mt-0.5 text-sm leading-6 text-slate-500">A link anyone can open without signing in: your principal, a coach, a sub. They see each lesson, what you wrote, your worksheets and links, read only. Student names, marks, scores and your reflections are never shown.</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
    </div>
    {state === null ? <p className="mt-3 text-sm text-slate-500">Loading…</p> : url ? <div className="mt-3 space-y-2">
      <div className="flex gap-2"><input readOnly value={url} onFocus={(e) => e.target.select()} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700" aria-label="Lesson plan link" data-testid="lesson-share-url" />
        <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button></div>
      <div className="flex flex-wrap gap-2 text-sm">
        <a href={url} target="_blank" rel="noopener" className="min-h-9 rounded-lg px-2 py-2 font-medium text-teal-800 hover:bg-teal-50">See what they see</a>
        <button type="button" disabled={busy} onClick={() => void call({ on: true, fresh: true })} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-medium text-slate-600 hover:bg-slate-100"><RefreshCw className="h-3.5 w-3.5" />New link (the old one stops)</button>
        <button type="button" disabled={busy} onClick={() => void call({ on: false })} className="min-h-9 rounded-lg px-2 font-medium text-rose-700 hover:bg-rose-50" data-testid="lesson-share-off">Turn off</button>
      </div>
    </div> : <button type="button" disabled={busy} onClick={() => void call({ on: true })} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60" data-testid="lesson-share-on"><Link2 className="h-4 w-4" />Make a share link</button>}
    {error && <p className="mt-2 text-sm text-rose-700" role="alert">{error}</p>}
  </section>;
}
