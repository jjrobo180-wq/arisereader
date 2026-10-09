// The free-trial note shown at the top of every tab in Arise WorkHub and Arise LifeHub, and the
// reminder of what stays once a trial ends: A.R.I.S.E. Reader is kept, the rest of the hub isn't.
import { useEffect, useState, type ReactNode } from "react";
import { Clock3, Lock } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

export type HubTrial = { daysLeft: number; endsAt: string } | null;

const DAY = 86_400_000;
const daysUntil = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / DAY));

/** The teacher's WorkHub free month, or the parent's LifeHub trial, read from /api/addons. Null when not on a trial. */
export function useHubTrial(token: string | null | undefined, which: "work" | "life", enabled = true): HubTrial {
  const [trial, setTrial] = useState<HubTrial>(null);
  useEffect(() => {
    if (!enabled || !token) { setTrial(null); return; }
    let live = true;
    fetch(`${API_BASE}/api/addons`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return;
        // A teacher's LifeHub comes with WorkHub, so both hubs follow the WorkHub free month.
        const ends = d.hub?.via === "free-month" ? d.hub.endsAt : which === "life" && d.todo?.via === "trial" ? d.todo.trialEndsAt : null;
        setTrial(ends ? { endsAt: ends, daysLeft: daysUntil(ends) } : null);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [token, which, enabled]);
  return trial;
}

export function HubTrialNote({ trial, which, upgradeHref, onUpgrade }: { trial: HubTrial; which: "work" | "life"; upgradeHref?: string; onUpgrade?: () => void }) {
  if (!trial) return null;
  const name = which === "work" ? "WorkHub" : "LifeHub";
  const left = trial.daysLeft === 0 ? "ends today" : `${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"} left`;
  return <div role="note" className="hub-trial-note flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center" data-testid={`${which}hub-trial-note`}>
    <Clock3 className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
    <p className="min-w-0 flex-1 leading-6">
      <b>You're on a free trial of Arise {name} · {left}.</b>{" "}
      If you don't upgrade, everything in {name} goes away when the trial ends{which === "work" ? " (LifeHub too)" : ""}. You'll keep your A.R.I.S.E. Reader tools, and your saved work comes back if you upgrade later.
    </p>
    {onUpgrade
      ? <button type="button" onClick={onUpgrade} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 px-4 font-bold text-slate-950 hover:bg-amber-400">Upgrade</button>
      : <a href={upgradeHref} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 px-4 font-bold text-slate-950 hover:bg-amber-400">Upgrade</a>}
  </div>;
}

/** Shown above the Reader tools once a hub's trial is over. */
export function HubEndedNote({ which, upgradeHref, onUpgrade, children }: { which: "work" | "life"; upgradeHref?: string; onUpgrade?: () => void; children?: ReactNode }) {
  const name = which === "work" ? "WorkHub" : "LifeHub";
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm" data-testid={`${which}hub-ended`}>
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-slate-100 p-2 text-slate-600"><Lock className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-slate-950">Your Arise {name} free trial has ended</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {which === "work" ? "Your caseload, calendar, tasks, notes and the rest of WorkHub (and LifeHub) are locked." : "Your lists, calendar, chores, food & fitness and the rest of LifeHub are locked."} Everything you saved is kept and comes back when you upgrade. Your A.R.I.S.E. Reader tools below still work.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {onUpgrade
            ? <button type="button" onClick={onUpgrade} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">Upgrade to get {name} back</button>
            : <a href={upgradeHref} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">Upgrade to get {name} back</a>}
          {children}
        </div>
      </div>
    </div>
  </section>;
}
