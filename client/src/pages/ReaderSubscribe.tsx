// The screen an A.R.I.S.E. Reader account sees when it needs a plan (Reader is paid for accounts
// made from November 9, 2026; every older account keeps it free). On the website a parent pays
// here on Stripe's page and a teacher is sent to their plan page. In the iPhone app nothing is
// sold: the button opens arisereader.com in Safari (allowed on the US App Store).
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Check, ExternalLink, LogOut, Trash2 } from "lucide-react";
import AccountPrivacy from "@/components/AccountPrivacy";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { isNativeApp } from "@/lib/nativeApp";
import { usePlan } from "@/lib/plan";
import { PLANS, usd } from "@shared/plans";

const SITE = "https://arisereader.com/#/pricing";

export default function ReaderSubscribe() {
  const { user, token, logout } = useAuth();
  const { plan, refresh } = usePlan(token);
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState(false);
  const role = user?.role === "teacher" ? "teacher" : user?.role === "parent" ? "parent" : "student";
  const native = isNativeApp();

  // Back from Stripe (/?paid=cs_…#/subscribe): confirm the payment, then open the Reader.
  const confirmed = useRef(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("paid");
    if (!token || confirmed.current || !id || !/^cs_[A-Za-z0-9_]{8,200}$/.test(id)) return;
    confirmed.current = true;
    const url = new URL(window.location.href); url.searchParams.delete("paid"); window.history.replaceState(null, "", url.toString());
    setBusy(true);
    fetch(`${API_BASE}/api/billing/confirm`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }) })
      .then(() => refresh())
      .then((p) => { if (p?.reader?.access) navigate(role === "student" ? "/library" : "/reader"); else setError("We couldn't confirm the payment yet. If your card was charged, it switches on within a few minutes."); })
      .catch(() => setError("We couldn't confirm the payment yet. If your card was charged, it switches on within a few minutes."))
      .finally(() => setBusy(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  // Already paid (or covered by a teacher): nothing to do here.
  useEffect(() => { if (plan?.reader?.access) navigate(role === "student" ? "/library" : "/reader"); }, [plan?.reader?.access]); // eslint-disable-line react-hooks/exhaustive-deps

  // In the app: Safari (the app never sells anything). On the website: the pricing page.
  const openSite = () => {
    if (!native) { navigate("/pricing"); return; }
    try { if (window.open(SITE, "_blank")) return; } catch { /* below */ }
    window.location.href = SITE;
  };
  const payFamily = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/billing/addon-checkout`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ product: "bundle", returnPath: "/subscribe" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.url === "string") { window.location.href = data.url; return; }
      if (res.status === 409) { await refresh(); }
      setError(data.message || "The payment page could not be opened. Nothing was charged.");
    } catch { setError("The payment page could not be opened. Nothing was charged."); }
    setBusy(false);
  };

  const plans = [
    { who: "Families", price: usd(PLANS.bundle.familyMonthlyCents), what: `A parent and up to ${PLANS.parentMaxChildren} children` },
    { who: "Teachers", price: usd(PLANS.teacher.monthlyCents), what: `Teacher discount · up to ${PLANS.teacher.studentsPerBlock} students` },
    { who: "Schools", price: usd(PLANS.school.yearlyCents), per: "/yr", what: "School discount · every teacher and student" },
  ];

  return (
    <main className="min-h-[100dvh] bg-[#0f1020] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-white" data-testid="reader-subscribe">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <span className="text-lg font-black tracking-tight">A.R.I.S.E. <span className="text-violet-400">Reader</span></span>
          <button type="button" onClick={() => { logout(); navigate("/"); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-300 hover:bg-white/10"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20"><BookOpen className="h-6 w-6 text-violet-300" /></div>
          <h1 className="mt-4 text-2xl font-black leading-tight">
            {role === "student" ? "Your account needs a reading plan" : "Start your A.R.I.S.E. Reader plan"}
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            {role === "student"
              ? "Ask a parent to get the family plan, or ask your teacher to add you to their class. Then sign in again."
              : role === "parent"
                ? `${usd(PLANS.bundle.familyMonthlyCents)} a month covers you and up to ${PLANS.parentMaxChildren} linked children: every book, quiz and reward.`
                : `${usd(PLANS.teacher.monthlyCents)} a month covers up to ${PLANS.teacher.studentsPerBlock} students. A whole school is ${usd(PLANS.school.yearlyCents)} for the school year.`}
          </p>
          <ul className="mt-5 space-y-2.5 text-[15px] text-slate-200">
            {["Every book, story and quiz", "Points, badges, streaks and rewards", "Games and avatar worlds", "Teacher and parent dashboards"].map((t) => (
              <li key={t} className="flex gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />{t}</li>
            ))}
          </ul>
          {role === "student" && (
            <button type="button" onClick={openSite} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-base font-bold hover:bg-violet-500" data-testid="reader-subscribe-student-site">
              {native ? <>See the plans on arisereader.com <ExternalLink className="h-4 w-4" /></> : "See the plans"}
            </button>
          )}
          {role !== "student" && (native ? (
            <button type="button" onClick={openSite} className="mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl bg-violet-600 px-4 text-base font-bold hover:bg-violet-500" data-testid="reader-subscribe-site">
              Subscribe on arisereader.com
            </button>
          ) : role === "parent" ? (
            <button type="button" disabled={busy || plan?.payment === false} onClick={payFamily} className="mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl bg-violet-600 px-4 text-base font-bold hover:bg-violet-500 disabled:opacity-60" data-testid="reader-subscribe-family">
              {busy ? "Opening the payment page…" : `Subscribe · ${usd(PLANS.bundle.familyMonthlyCents)}/month`}
            </button>
          ) : (
            <button type="button" onClick={() => navigate("/billing")} className="mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl bg-violet-600 px-4 text-base font-bold hover:bg-violet-500" data-testid="reader-subscribe-teacher">
              See teacher and school plans
            </button>
          ))}
          {error && <p className="mt-3 text-sm text-rose-300" role="alert">{error}</p>}
          <button type="button" onClick={() => navigate("/scholarship")} className="mt-3 w-full text-center text-sm font-semibold text-violet-300 underline-offset-4 hover:underline" data-testid="reader-subscribe-scholarship">Can't afford it? Apply for a free account</button>
          {native && role !== "student" && <p className="mt-3 text-xs leading-5 text-slate-400">Plans are bought on the website. Once it's paid, sign in here and everything opens.</p>}
        </section>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {plans.map((p) => (
            <button type="button" key={p.who} onClick={openSite} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08] active:scale-[.98]" data-testid={`reader-subscribe-plan-${p.who.toLowerCase()}`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{p.who}</p>
              <p className="mt-1 text-xl font-black">{p.price}<span className="text-xs font-semibold text-slate-400">{(p as any).per || "/mo"}</span></p>
              <p className="mt-1 text-xs leading-4 text-slate-400">{p.what}</p>
            </button>
          ))}
        </div>
        {native && <p className="mt-3 text-center text-xs leading-5 text-slate-400">Tap a plan to see it on arisereader.com in Safari. Nothing is sold in the app.</p>}
        <button type="button" onClick={() => setAccount(true)} className="mx-auto mt-6 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-rose-300" data-testid="reader-subscribe-account">
          <Trash2 className="h-4 w-4" />Account &amp; privacy · Delete my account
        </button>
      </div>
      {account && <div className="fixed inset-0 z-[90] text-slate-900"><AccountPrivacy onClose={() => setAccount(false)} /></div>}
    </main>
  );
}
