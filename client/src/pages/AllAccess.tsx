// Arise All Access (shared/allAccess.ts): the one plan sold now, $10 a month for Arise To Duo, Arise Fit,
// Arise Notes and Pod+. Public: what's in it and the price; signed in: get it, or this month's use and
// Manage billing. Every app's upgrade button sends people to its own checkout, which comes back to that app;
// this page is the one to link to from anywhere else (Pod+'s "Go ad-free", emails, the website).
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Check, Headphones, ListChecks, Loader2, Mic, Sparkles, Dumbbell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { NATIVE_NO_PURCHASE, isNativeApp } from "@/lib/nativeApp";
import { ALL_ACCESS_AI_PER_MONTH, ALL_ACCESS_AUDIO_MINUTES, ALL_ACCESS_MONTHLY_CENTS, ALL_ACCESS_NAME, ALL_ACCESS_SPEAKER_MINUTES } from "@shared/allAccess";

type Status = {
  live: boolean; admin: boolean; endsAt: string | null; cancelAtPeriodEnd: boolean; canManage: boolean; payment: boolean;
  ai: { limit: number; used: number; left: number }; audio: { limit: number; left: number }; speakers: { limit: number; left: number };
};

const APPS = [
  { name: "Arise To Duo", icon: ListChecks, tint: "#6d5ae6", points: ["Every plugin in WorkHub and LifeHub", "AI: add with AI, the assistant, meal estimates"] },
  { name: "Arise Fit", icon: Dumbbell, tint: "#3f9a3a", points: ["Everything in Fit+: AI scanning, rep counting, recipes", "A free guest pass for one friend"] },
  { name: "Arise Notes", icon: Mic, tint: "#c2410c", points: ["20 hours of recordings turned into notes", "Speaker names, IEP mode and every tool"] },
  { name: "Pod+", icon: Headphones, tint: "#0e7490", points: ["Ad-free podcasts", "Study Pod+, Meeting Pod and audiobook recaps"] },
];

export default function AllAccess() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const native = isNativeApp();
  const price = `$${ALL_ACCESS_MONTHLY_CENTS / 100}`;

  const load = () => {
    if (!token) return;
    fetch(`${API_BASE}/api/all-access/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setStatus(d)).catch(() => {});
  };
  useEffect(load, [token]);
  // Back from Stripe: confirm now rather than waiting for Stripe's message.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("paid");
    if (!token || !id || !/^cs_[A-Za-z0-9_]{8,200}$/.test(id)) return;
    const url = new URL(window.location.href); url.searchParams.delete("paid"); window.history.replaceState(null, "", url.toString());
    fetch(`${API_BASE}/api/billing/confirm`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }) })
      .then((r) => setNote(r.ok ? `Payment received. You have ${ALL_ACCESS_NAME}.` : "We couldn't confirm the payment yet. If your card was charged, it switches on within a few minutes."))
      .finally(load);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (path: string) => {
    setBusy(path); setNote("");
    try {
      const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ returnPath: "/all-access" }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && typeof d.url === "string" && d.url.startsWith("https://")) { window.location.href = d.url; return; }
      setNote(d.message || "That didn't work. Please try again.");
    } catch { setNote("That didn't work. Check your connection and try again."); }
    setBusy("");
  };
  const signIn = () => { try { sessionStorage.setItem("after_signin", "/all-access"); } catch { /* fine */ } navigate("/signin"); };

  const meter = (label: string, left: number, limit: number, unit: string) => (
    <div>
      <div className="flex items-baseline justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span className="tabular-nums text-slate-500"><b className="text-slate-900">{left.toLocaleString("en-US")}</b> of {limit.toLocaleString("en-US")} {unit} left</span></div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, (left / Math.max(1, limit)) * 100))}%` }} /></div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white px-4 pb-16 pt-10 sm:px-6" data-testid="all-access">
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-sm font-bold uppercase tracking-[.18em] text-violet-600">One plan · four apps</p>
        <h1 className="mt-2 text-center text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{ALL_ACCESS_NAME}</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-lg text-slate-600">Arise To Duo, Arise Fit, Arise Notes and Pod+, with everything unlocked, for <b className="text-slate-900">{price} a month</b>.</p>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          {APPS.map((a) => { const Icon = a.icon; return (
            <div key={a.name} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: a.tint }}><Icon className="h-5 w-5" /></span><h2 className="text-lg font-bold text-slate-900">{a.name}</h2></div>
              <ul className="mt-3 space-y-1.5">{a.points.map((p) => <li key={p} className="flex gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{p}</li>)}</ul>
            </div>
          ); })}
        </section>

        <section className="mt-4 rounded-3xl border border-violet-200 bg-violet-50/60 p-5">
          <h2 className="font-bold text-violet-950">Shared by all four apps, every month</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-violet-950/90">
            <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />{ALL_ACCESS_AI_PER_MONTH.toLocaleString("en-US")} AI requests (about 33 a day)</li>
            <li className="flex gap-2"><Mic className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />{ALL_ACCESS_AUDIO_MINUTES / 60} hours of audio: Notes recordings, and Pod+ episodes made ad-free for the first time ({ALL_ACCESS_SPEAKER_MINUTES / 60} with speaker names)</li>
            <li className="flex gap-2"><Headphones className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />Episodes someone already made ad-free never count, so most listening is unlimited</li>
          </ul>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {note && <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{note}</p>}
          {native ? <p className="text-sm text-slate-600">{NATIVE_NO_PURCHASE}</p>
            : !user ? <button type="button" onClick={signIn} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-violet-600 text-base font-bold text-white hover:bg-violet-700" data-testid="all-access-signin">Sign in to get {ALL_ACCESS_NAME}</button>
            : !status ? <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            : status.live ? <div className="space-y-4">
                <p className="text-base font-bold text-slate-900">{status.admin ? "You have everything (admin)." : `You have ${ALL_ACCESS_NAME}.`}{status.endsAt && !status.admin ? <span className="ml-1 font-normal text-slate-500">{status.cancelAtPeriodEnd ? "Ends" : "Renews"} {new Date(status.endsAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.</span> : null}</p>
                {meter("AI requests", status.ai.left, status.ai.limit, "")}
                {meter("Audio", status.audio.left, status.audio.limit, "minutes")}
                {meter("Speaker names", status.speakers.left, status.speakers.limit, "minutes")}
                {status.canManage && <button type="button" disabled={!!busy} onClick={() => void post("/api/all-access/portal")} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">{busy ? "Opening…" : "Manage billing, receipts or cancel"}</button>}
              </div>
            : <button type="button" disabled={!!busy || !status.payment} onClick={() => void post("/api/all-access/checkout")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-base font-bold text-white hover:bg-violet-700 disabled:opacity-60" data-testid="all-access-buy">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{!status.payment ? "Payments aren't set up yet" : `Get ${ALL_ACCESS_NAME} · ${price} a month`}
              </button>}
          <p className="mt-3 text-center text-xs text-slate-500">One person per plan. Cancel any time. Already on Duo Unlimited, a Notes plan or Fit+? You keep it at your price.</p>
        </section>
      </div>
    </main>
  );
}
