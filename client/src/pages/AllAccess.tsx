// Arise All Access: one $10-a-month plan for every Arise app (shared/plans.ts "all_access", sold in
// server/plans.ts). To Duo Unlimited, Arise Notes Plus, Cooked+ (with its guest pass) and ad-free
// Podster. Sold on the website only; the iPhone apps show what's on the account, never a price.
import { useEffect, useRef, useState } from "react";
import { Check, Crown, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { NATIVE_NO_PURCHASE, isNativeApp } from "@/lib/nativeApp";
import AllAccessOffer from "@/components/AllAccessOffer";
import { appleStoreReady, manageAppleSubscription } from "@/lib/appleStore";

type Status = { live: boolean; admin: boolean; source?: "stripe" | "admin" | "apple" | null; priceCents: number; payment: boolean; endsAt: string | null; cancelAtPeriodEnd: boolean; canManage: boolean; canBuy: boolean; about?: string };

const PERKS: [string, string][] = [
  ["Arise To Duo Unlimited", "Every plugin in the Plugin Gallery and AI, in WorkHub and LifeHub."],
  ["Arise Notes Plus", "1,500 minutes a month, speaker labels, IEP mode and rollover."],
  ["Cooked+", "Every Fit+ feature, plus a free guest pass for one friend."],
  ["Ad-free Podster", "Ads are found and skipped in the episodes you play."],
];

export default function AllAccessPage() {
  const { token } = useAuth();
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const confirmed = useRef(false);
  const native = isNativeApp();
  const call = (path: string, body?: unknown) => fetch(`${API_BASE}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const load = () => call("/api/all-access").then((r) => r.json()).then(setS).catch(() => setNote("Your plan couldn't be loaded. Check your connection and try again."));
  useEffect(() => {
    if (!token) return;
    const id = new URLSearchParams(window.location.search).get("paid");
    if (id && /^cs_[A-Za-z0-9_]{8,200}$/.test(id) && !confirmed.current) {
      confirmed.current = true;
      try { const u = new URL(window.location.href); u.searchParams.delete("paid"); history.replaceState(null, "", u.toString()); } catch { /* keep the address */ }
      call("/api/billing/confirm", { sessionId: id })
        .then((r) => setNote(r.ok ? "Payment received. All Access is on." : "We couldn't confirm the payment yet. If your card was charged, All Access switches on within a few minutes."))
        .catch(() => setNote("We couldn't confirm the payment yet. If your card was charged, All Access switches on within a few minutes."))
        .finally(() => void load());
    } else void load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = async (path: string) => {
    setBusy(true); setNote("");
    try {
      const r = await call(path, { returnPath: "/all-access" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && typeof d.url === "string" && d.url.startsWith("https://")) { window.location.href = d.url; return; }
      setNote(d.message || "That didn't work. Please try again.");
    } catch { setNote("That didn't work. Please check your connection and try again."); }
    setBusy(false);
  };
  const price = `$${((s?.priceCents ?? 1000) / 100).toFixed(0)}`;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "");
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10" data-testid="all-access">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-6 pb-6 pt-7 text-white">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20"><Crown className="h-6 w-6" /></span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight">{s?.live ? "You have All Access" : "Arise All Access"}</h1>
          <p className="mt-1.5 text-sm text-white/90">One plan for every Arise app.{!native && !s?.live ? ` ${price} a month.` : ""}</p>
        </div>
        <div className="px-6 py-5">
          <ul className="space-y-3">{PERKS.map(([t, d]) => <li key={t} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" /><span><span className="block font-bold text-slate-900">{t}</span><span className="block text-sm text-slate-600">{d}</span></span></li>)}</ul>
          {note && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{note}</p>}
          <div className="mt-5">
            {!s ? <div className="flex justify-center py-3"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>
              : s.live ? <>
                  <p className="text-sm text-slate-600">{s.admin ? "The admin account always has All Access." : s.endsAt ? `${s.cancelAtPeriodEnd ? "Ends" : "Renews"} ${date(s.endsAt)}.` : "On your account."}</p>
                  {s.source === "apple" && (native && appleStoreReady()
                    ? <button type="button" onClick={() => void manageAppleSubscription()} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">Manage subscription</button>
                    : <p className="mt-2 text-sm text-slate-600">Bought in the iPhone app. Change or cancel it in Settings › Apple ID › Subscriptions.</p>)}
                  {s.canManage && !native && <button type="button" disabled={busy} onClick={() => void go("/api/all-access/portal")} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">{busy ? "Opening…" : "Manage billing"}</button>}
                </>
              : native ? <AllAccessOffer note={NATIVE_NO_PURCHASE} authToken={token} onBought={() => void load()} />
              : !s.canBuy ? <p className="text-sm text-slate-600">All Access is for adult accounts. Ask a parent or teacher about it.</p>
              : !s.payment ? <p className="text-sm text-slate-600">Payments aren't switched on for this site yet.</p>
              : <button type="button" disabled={busy} onClick={() => void go("/api/all-access/checkout")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60" data-testid="all-access-buy">{busy ? "Opening checkout…" : `Get All Access · ${price} a month`}</button>}
          </div>
          <p className="mt-4 text-xs text-slate-500">Cancel any time. Already paying for To Duo Unlimited, a Notes plan or Fit+? You keep it. If you switch to All Access, those end at the close of their current period so you're never charged twice.</p>
        </div>
      </div>
    </main>
  );
}
