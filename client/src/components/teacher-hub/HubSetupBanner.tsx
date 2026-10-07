// "One-time setup needed": shown when the database is missing something the Hub uses.
// The site owner gets the exact code to paste and the link to the page to paste it into;
// a teacher is only told, in plain words, that something is not switched on yet.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

type Missing = { id: string; what: string; effect: string; needed: boolean };
type Report = { ok: boolean; blocking: boolean; missing: Missing[]; sqlEditorUrl?: string; fixAllSql?: string };

const HIDE_KEY = "arise-hub-setup-hidden";
const readHidden = () => { try { return sessionStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } };

export default function HubSetupBanner({ token, isAdmin }: { token: string | null; isAdmin: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [hidden, setHidden] = useState(readHidden);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const look = useCallback(async (fresh: boolean) => {
    if (!token) return;
    setChecking(true);
    try {
      const r = await fetch(`${API_BASE}/api/teacher-hub/setup-check${fresh ? "?fresh=1" : ""}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await r.json().catch(() => null);
      if (r.ok && data && Array.isArray(data.missing)) setReport(data);
    } catch {
      /* a check that can't run says nothing: the Hub works as it did */
    } finally {
      setChecking(false);
    }
  }, [token]);

  useEffect(() => { void look(false); }, [look]);

  if (!report || report.ok || hidden) return null;
  // A teacher can't fix this, so they only hear about what a feature needs when it really matters.
  if (!isAdmin && !report.blocking) return null;

  async function copy() {
    const sql = report?.fixAllSql || "";
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      // Some phones won't copy from a button: show the code so it can be selected by hand.
      setShowCode(true);
    }
  }

  const hot = report.blocking;
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold";

  return (
    <section className={`rounded-2xl border p-4 text-sm sm:p-5 ${hot ? "border-red-200 bg-red-50 text-red-950" : "border-amber-200 bg-amber-50 text-amber-950"}`} role="region" aria-label="One-time setup" data-testid="hub-setup">
      <div className="flex items-start gap-3">
        <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${hot ? "text-red-600" : "text-amber-600"}`} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">{isAdmin ? "One-time setup needed" : "A few Hub features are not switched on yet"}</h2>
          <p className="mt-1 leading-6">{isAdmin ? "Some things in the Hub can't work until a short piece of code is added to your database." : "The site owner needs to finish a setup step. Everything else works as usual."}</p>
          <ul className="mt-3 space-y-2">
            {report.missing.map((m) => (
              <li key={m.id} className="rounded-xl bg-white/70 p-3">
                <div className="font-semibold">{m.what}</div>
                <div className="mt-0.5 text-slate-700">{m.effect}</div>
              </li>
            ))}
          </ul>

          {isAdmin && report.fixAllSql && (
            <div className="mt-4">
              <ol className="space-y-2 leading-6">
                <li><strong>1.</strong> Tap <strong>Copy the code</strong>.</li>
                <li><strong>2.</strong> Tap <strong>Open Supabase</strong>, paste into the big box, and tap <strong>Run</strong>.</li>
                <li><strong>3.</strong> Come back here and tap <strong>Check again</strong>.</li>
              </ol>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={copy} className={`${button} bg-slate-950 text-white hover:bg-slate-800`} data-testid="hub-setup-copy">
                  {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy the code</>}
                </button>
                {report.sqlEditorUrl && (
                  <a href={report.sqlEditorUrl} target="_blank" rel="noopener noreferrer" className={`${button} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`} data-testid="hub-setup-open">
                    <ExternalLink className="h-4 w-4" /> Open Supabase
                  </a>
                )}
                <button type="button" onClick={() => look(true)} disabled={checking} className={`${button} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-60`} data-testid="hub-setup-check">
                  <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> {checking ? "Checking…" : "Check again"}
                </button>
              </div>
              <button type="button" onClick={() => setShowCode((v) => !v)} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">{showCode ? "Hide the code" : "Show the code"}</button>
              {showCode && (
                <textarea readOnly value={report.fixAllSql} onFocus={(e) => e.currentTarget.select()} rows={8} aria-label="The code to paste into Supabase" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800" />
              )}
            </div>
          )}

          <button type="button" onClick={() => { try { sessionStorage.setItem(HIDE_KEY, "1"); } catch { /* fine */ } setHidden(true); }} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-slate-700 underline underline-offset-4">Remind me later</button>
        </div>
      </div>
    </section>
  );
}
