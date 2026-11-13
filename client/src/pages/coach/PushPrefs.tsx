// The "From other people" switches in Cooked and Cooked PT's Notifications screens: which alerts the
// server sends (messages, check-ins, buddies, groups…). Saved on the server (shared/fitPush.ts), so they
// hold on every phone the person signs in on.
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FIT_PUSH_KINDS, FIT_PUSH_LABELS, defaultFitPushPrefs, type FitPushKind, type FitPushPrefs } from "@shared/fitPush";
import { coachApi, put } from "./coachApi";
import { C, display } from "../fit/fitUi";

export function Switch({ label, sub, on, flip, testId, disabled }: { label: string; sub?: string; on: boolean; flip: () => void; testId?: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} onClick={flip} disabled={disabled} className="flex w-full items-center gap-3 rounded-[12px] p-4 text-left disabled:opacity-50" style={{ background: C.card }} data-testid={testId}>
    <span className="min-w-0 flex-1"><span className="block text-[19px] leading-none" style={display}>{label}</span>{sub && <span className="mt-1 block text-[12px]" style={{ color: C.dim }}>{sub}</span>}</span>
    <span className="relative h-7 w-12 shrink-0 rounded-full transition" style={{ background: on ? C.lime : C.card2 }}><span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? 24 : 4 }} /></span>
  </button>;
}

/** All of them off at once ("Pause all") is `all: false`; the single switches keep their choice underneath. */
export function usePushPrefs() {
  const { token } = useAuth();
  const [prefs, setPrefs] = useState<FitPushPrefs | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { let live = true; coachApi<{ prefs: FitPushPrefs }>(token, "/push-prefs").then((r) => { if (live) setPrefs(r.prefs); }).catch(() => { if (live) setPrefs(defaultFitPushPrefs()); }); return () => { live = false; }; }, [token]);
  const save = async (next: FitPushPrefs) => {
    const was = prefs; setPrefs(next); setErr("");
    try { const r = await put<{ prefs: FitPushPrefs }>(token, "/push-prefs", { prefs: next }); setPrefs(r.prefs); }
    catch (e: any) { setPrefs(was); setErr(e.message); }
  };
  return { prefs, save, err };
}

export function PushPrefsList({ app, prefs, save }: { app: "fit" | "trainer"; prefs: FitPushPrefs | null; save: (p: FitPushPrefs) => void }) {
  if (!prefs) return <p className="px-1 text-[13px]" style={{ color: C.dim }}>Loading…</p>;
  const kinds = FIT_PUSH_KINDS.filter((k) => FIT_PUSH_LABELS[k].apps.includes(app));
  return <div className="space-y-2">{kinds.map((k: FitPushKind) => <Switch key={k} label={FIT_PUSH_LABELS[k].label} sub={FIT_PUSH_LABELS[k].sub} on={prefs.all && prefs[k]} disabled={!prefs.all}
    flip={() => save({ ...prefs, [k]: !prefs[k] })} testId={`push-${k}`} />)}</div>;
}
