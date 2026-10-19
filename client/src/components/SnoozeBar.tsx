// The snooze bar: when a reminder notification is tapped (iPhone notifications can't have buttons),
// the app opens on the right screen with this bar at the bottom: one tap snoozes it. It reads what the
// service worker (public/sw.js) put in the address: n (which reminder), nt/nb (its words), nu (where it
// goes), nuid/ns (who, and the signature that lets /api/push/snooze accept it).
import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

type Pending = { key: string; title: string; body: string; url: string; u: string; sig: string };
const PARAMS = ["n", "nt", "nb", "nu", "nuid", "ns"];

/** Minutes until tomorrow at 8:00 in the morning. */
function untilTomorrowMorning(now = new Date()): number {
  const t = new Date(now); t.setDate(t.getDate() + 1); t.setHours(8, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 60_000);
}
export const SNOOZE_PICKS = [
  { label: "15 min", minutes: () => 15 },
  { label: "1 hour", minutes: () => 60 },
  { label: "3 hours", minutes: () => 180 },
  { label: "Tomorrow", minutes: () => untilTomorrowMorning() },
];

/** Reads the reminder out of the address and tidies the address, so a refresh doesn't bring the bar back. */
function takeFromAddress(): Pending | null {
  const hash = window.location.hash;
  const q = hash.indexOf("?");
  if (q < 0) return null;
  const params = new URLSearchParams(hash.slice(q + 1));
  const key = params.get("n");
  if (!key) return null;
  const found = { key, title: params.get("nt") || "Reminder", body: params.get("nb") || "", url: params.get("nu") || "/", u: params.get("nuid") || "", sig: params.get("ns") || "" };
  for (const p of PARAMS) params.delete(p);
  const rest = params.toString();
  try { window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash.slice(0, q)}${rest ? `?${rest}` : ""}`); } catch { /* fine */ }
  return found;
}

export default function SnoozeBar() {
  const [pending, setPending] = useState<Pending | null>(() => (typeof window === "undefined" ? null : takeFromAddress()));
  const [state, setState] = useState<"" | "busy" | "done" | "error">("");
  const [doneWords, setDoneWords] = useState("");
  useEffect(() => {
    const look = () => { const p = takeFromAddress(); if (p) { setPending(p); setState(""); } };
    window.addEventListener("hashchange", look);
    return () => window.removeEventListener("hashchange", look);
  }, []);
  useEffect(() => { if (state !== "done") return; const t = window.setTimeout(() => setPending(null), 2500); return () => window.clearTimeout(t); }, [state]);
  if (!pending) return null;
  const snooze = async (minutes: number) => {
    setState("busy");
    try {
      const res = await fetch(`${API_BASE}/api/push/snooze`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ u: Number(pending.u), sig: pending.sig, key: pending.key, minutes, title: pending.title, body: pending.body, url: pending.url }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      setDoneWords(`Snoozed. It comes back ${new Date(j.until).toLocaleString(undefined, { weekday: minutes > 600 ? "short" : undefined, hour: "numeric", minute: "2-digit" })}.`);
      setState("done");
    } catch { setState("error"); }
  };
  return <div className="fixed inset-x-0 bottom-0 z-[650] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" role="region" aria-label="Snooze this reminder" data-testid="snooze-bar">
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl">
      <div className="flex items-start gap-2">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
        <p className="min-w-0 flex-1 text-sm font-bold leading-5">{state === "done" ? doneWords : pending.title}</p>
        <button type="button" onClick={() => setPending(null)} aria-label="Close" className="-m-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      {state !== "done" && <>
        <p className="mt-1 pl-7 text-xs text-slate-500">{state === "error" ? "That didn't go through. Try again." : "Not now? Snooze it:"}</p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">{SNOOZE_PICKS.map((p) => <button key={p.label} type="button" disabled={state === "busy"} onClick={() => void snooze(p.minutes())}
          className="min-h-11 rounded-xl bg-violet-50 px-1 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50" data-testid={`snooze-${p.label}`}>{p.label}</button>)}</div>
      </>}
    </div>
  </div>;
}
