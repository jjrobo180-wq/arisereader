// No part of the site has a free trial anymore (WorkHub and LifeHub are unconditionally free).
// useHubTrial is kept as a no-op (always returns null) so existing callers don't need to change;
// HubTrialNote/HubEndedNote below stay for the "hub is locked, pay to unlock" case, not trials.
import { type ReactNode } from "react";
import { Clock3, Lock } from "lucide-react";
import { NATIVE_NO_PURCHASE, isNativeApp } from "@/lib/nativeApp";

export type HubTrial = { daysLeft: number; endsAt: string } | null;

/** Always null now — neither WorkHub nor LifeHub has a trial. */
export function useHubTrial(_token?: string | null, _which?: "work" | "life", _enabled = true): HubTrial {
  return null;
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

/** Shown above the Reader tools when a hub is locked because there's no plan on the account. */
export function HubEndedNote({ which, upgradeHref, onUpgrade, children }: { which: "work" | "life"; upgradeHref?: string; onUpgrade?: () => void; children?: ReactNode }) {
  const name = which === "work" ? "WorkHub" : "LifeHub";
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm" data-testid={`${which}hub-ended`}>
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-slate-100 p-2 text-slate-600"><Lock className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-slate-950">Arise {name} needs a plan</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {which === "work" ? "Your caseload, calendar, tasks, notes and the rest of WorkHub (and LifeHub) are locked." : "Your lists, calendar, chores, food & fitness and the rest of LifeHub are locked."} Everything you saved is kept and comes back when you upgrade. Your A.R.I.S.E. Reader tools below still work.
        </p>
        {isNativeApp() && <p className="mt-2 text-sm leading-6 text-slate-600">{NATIVE_NO_PURCHASE}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {isNativeApp() ? null : onUpgrade
            ? <button type="button" onClick={onUpgrade} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">Upgrade to get {name} back</button>
            : <a href={upgradeHref} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">Upgrade to get {name} back</a>}
          {children}
        </div>
      </div>
    </div>
  </section>;
}
