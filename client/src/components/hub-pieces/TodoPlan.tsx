// Arise To Duo's Free plan and $5 Unlimited upgrade in the hubs (rules in shared/todoPlan.ts):
//  - useTodoPlan: Free or Unlimited, apps added in each hub, and this month's AI, from the server.
//  - openUpgrade(...): opens the "Get Unlimited" box from anywhere (a 4th app, AI tapped on Free).
//  - appsBlocked(...): would a change add an app past Free's 3? (The hubs ask before saving.)
//  - <UpgradeHost>: the box itself. It also opens on its own when the server answers that the free
//    plan is full (any 402 with the plan's codes), and finishes a checkout when the page comes back.
//  - <PlanCard>: Free or Unlimited, and apps used, for the Customize panel and the App Store.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Infinity as InfinityIcon, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { NATIVE_NO_PURCHASE, isNativeApp } from "@/lib/nativeApp";
import { AI_LIMIT, APPS_FULL, FREE_APPS, growsPastFree } from "@shared/todoPlan";

export type TodoPlan = {
  unlimited: boolean; via: string | null; endsAt: string | null; apps: { work: number; life: number; limit: number | null };
  ai: { limit: number; used: number; left: number }; priceCents: number; yearlyCents: number | null; payment: boolean; paidByYou: boolean; paidProduct: "unlimited" | "unlimited_year" | null; fairUse: string;
};
type Reason = "apps" | "ai" | "plan";

const OPEN = "arise-upgrade";
const REFRESH = "arise-plan:refresh";
export const openUpgrade = (reason: Reason = "plan") => window.dispatchEvent(new CustomEvent(OPEN, { detail: { reason } }));
export const refreshTodoPlan = () => window.dispatchEvent(new Event(REFRESH));

/** Free or Unlimited for the signed-in person. `null` while loading (or offline): nothing is blocked then; the server still checks. */
export function useTodoPlan(): TodoPlan | null {
  const { token } = useAuth();
  const [plan, setPlan] = useState<TodoPlan | null>(null);
  const load = useCallback(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/todo-plan`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && typeof d.unlimited === "boolean") setPlan(d); }).catch(() => {});
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener(REFRESH, load);
    return () => window.removeEventListener(REFRESH, load);
  }, [load]);
  return plan;
}

/**
 * Would this change add an app past Free's 3? `before` and `after` are this hub's app counts; the
 * other hub's comes from the plan. Before loading finishes, the local free allowance is enforced.
 */
export function appsBlocked(plan: TodoPlan | null, hub: "work" | "life", before: number, after: number): boolean {
  if (plan?.unlimited || after <= before) return false;
  // Before /api/todo-plan finishes, enforce the free allowance locally rather
  // than allowing unlimited installs during a slow initial request. Paid accounts
  // become unrestricted immediately when their entitlement is confirmed.
  const other = plan ? (hub === "work" ? plan.apps.life : plan.apps.work) : 0;
  return growsPastFree(before + other, after + other, plan?.apps.limit ?? FREE_APPS);
}
/** Is a free account already at its 3 apps (counting this hub's `here` apps now)? */
export function appsFull(plan: TodoPlan | null, hub: "work" | "life", here: number): boolean {
  if (plan?.unlimited) return false;
  // Do not treat "still loading" as Unlimited; otherwise a fast sequence of
  // installs can slip well beyond the three-app allowance before the plan loads.
  const other = plan ? (hub === "work" ? plan.apps.life : plan.apps.work) : 0;
  return here + other >= (plan?.apps.limit ?? FREE_APPS);
}

/** Watches every answer from the site: a "free plan is full" one opens the upgrade box. Installed once. */
let watching = false;
function watchForLimits() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const real = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await real(...args);
    if (res.status === 402) {
      res.clone().json().then((d: any) => {
        if (d?.code === AI_LIMIT) { refreshTodoPlan(); openUpgrade("ai"); }
        else if (d?.code === APPS_FULL) { refreshTodoPlan(); openUpgrade("apps"); }
      }).catch(() => {});
    }
    return res;
  };
}

const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** The "Get Unlimited" box, for one hub. Put one in each hub page. */
export function UpgradeHost({ hub }: { hub: "work" | "life" }) {
  const { token } = useAuth();
  const plan = useTodoPlan();
  const [reason, setReason] = useState<Reason | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const confirmed = useRef(false);

  useEffect(() => { watchForLimits(); }, []);
  useEffect(() => {
    const open = (e: Event) => { setNote(""); setReason(((e as CustomEvent).detail?.reason as Reason) || "plan"); };
    window.addEventListener(OPEN, open);
    return () => window.removeEventListener(OPEN, open);
  }, []);

  // Back from Stripe's payment page: switch Unlimited on now rather than waiting for Stripe's message.
  useEffect(() => {
    if (!token || confirmed.current) return;
    const id = new URLSearchParams(window.location.search).get("paid");
    if (!id || !/^cs_[A-Za-z0-9_]{8,200}$/.test(id)) return;
    if (!window.location.hash.startsWith(hub === "work" ? "#/workhub" : "#/lifehub")) return;
    confirmed.current = true;
    const url = new URL(window.location.href); url.searchParams.delete("paid"); window.history.replaceState(null, "", url.toString());
    fetch(`${API_BASE}/api/billing/confirm`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }) })
      .then((r) => { setNote(r.ok ? "Payment received. You're on Unlimited." : "We couldn't confirm the payment yet. If your card was charged, Unlimited switches on within a few minutes."); })
      .catch(() => setNote("We couldn't confirm the payment yet. If your card was charged, Unlimited switches on within a few minutes."))
      .finally(() => { refreshTodoPlan(); setReason("plan"); });
  }, [token, hub]);

  const go = async (path: string, product: "unlimited" | "unlimited_year" = "unlimited") => {
    if (!token) return;
    setBusy(true); setNote("");
    try {
      const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ product, returnPath: hub === "work" ? "/workhub" : "/lifehub" }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && typeof d.url === "string" && d.url.startsWith("https://")) { window.location.href = d.url; return; }
      setNote(d.message || "That didn't work. Please try again.");
    } catch { setNote("That didn't work. Please check your connection and try again."); }
    setBusy(false);
  };

  if (!reason) return null;
  const price = usd(plan?.priceCents ?? 500);
  const yearly = plan?.yearlyCents ?? null;
  const saves = yearly && plan ? Math.round((1 - yearly / (plan.priceCents * 12)) * 100) : 0;
  const title = plan?.unlimited ? "You're on Unlimited"
    : reason === "apps" ? `You're using your ${FREE_APPS} free apps`
    : reason === "ai" ? "AI is part of Unlimited"
    : "Get Arise To Duo Unlimited";
  const lead = plan?.unlimited ? "Every app in the App Gallery, and AI for everyday use, in WorkHub and LifeHub."
    : reason === "apps" ? `The free plan includes up to ${FREE_APPS} apps from the App Gallery. Remove one to make room, or go Unlimited for all 450+.`
    : reason === "ai" ? `Add with AI, the AI assistant and meal estimates come with Unlimited, along with every app in the App Gallery, for ${price} a month.`
    : "Every app in the App Gallery (450+), and AI, across WorkHub and LifeHub.";

  return (
    <div className="fixed inset-0 kb-sheet z-[320] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="upgrade-title" data-testid="todo-upgrade" onClick={(e) => { if (e.target === e.currentTarget) setReason(null); }}>
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <button type="button" onClick={() => setReason(null)} aria-label="Close" className="absolute right-3 top-3 grid grid-cols-1 h-10 w-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" data-testid="todo-upgrade-close"><X className="h-5 w-5" /></button>
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-6 pb-5 pt-6 text-white">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20"><InfinityIcon className="h-6 w-6" /></span>
          <h2 id="upgrade-title" className="mt-3 pr-8 text-xl font-extrabold leading-tight">{title}</h2>
          <p className="mt-1.5 text-sm leading-6 text-white/90">{lead}</p>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="font-bold text-slate-900">Free</p>
              <p className="text-xs text-slate-500">$0</p>
              <ul className="mt-2 space-y-1 text-slate-600">
                <li>Up to {FREE_APPS} apps</li>
                <li>No AI</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-violet-500 bg-violet-50 p-3">
              <p className="font-bold text-violet-900">Unlimited</p>
              <p className="text-xs text-violet-700">{price} a month{yearly ? ` or ${usd(yearly)} a year` : ""}</p>
              <ul className="mt-2 space-y-1 text-violet-900">
                <li className="flex gap-1"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />All 575+ apps</li>
                <li className="flex gap-1"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />AI every day</li>
                <li className="flex gap-1"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />Both hubs</li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Built-in sections like Calendar, Tasks and Notes are always free. Your {FREE_APPS} apps are shared by WorkHub and LifeHub, and nothing is ever deleted, even if you go back to Free. Already on a $10 Arise Reader plan? Unlimited is the same price on top.</p>
          {note && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{note}</p>}
          <div className="mt-4">
            {isNativeApp()
              ? <div className="space-y-2">
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" data-testid="todo-plan-native">{NATIVE_NO_PURCHASE}</p>
                  <button type="button" onClick={() => setReason(null)} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">OK</button>
                </div>
              : !plan
              ? <button type="button" onClick={refreshTodoPlan} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700" data-testid="todo-upgrade-check-plan">Checking your plan… Tap to retry</button>
              : plan.unlimited
              ? (plan.paidByYou
                ? <button type="button" disabled={busy} onClick={() => go("/api/billing/addon-portal", plan.paidProduct ?? "unlimited")} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50" data-testid="todo-upgrade-manage">{busy ? "Opening…" : "Manage billing"}</button>
                : <button type="button" onClick={() => setReason(null)} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">Done</button>)
              : <div className="space-y-2">
                  {yearly && plan?.payment !== false && <button type="button" disabled={busy} onClick={() => go("/api/billing/addon-checkout", "unlimited_year")} className="relative flex min-h-14 w-full flex-col items-center justify-center rounded-2xl bg-violet-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60" data-testid="todo-upgrade-buy-year">
                    <span className="absolute -top-2 right-3 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950">Limited time</span>
                    <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" />{busy ? "Opening checkout…" : `${usd(yearly)} a year`}</span>
                    {!busy && <span className="text-[11px] font-semibold text-white/85">Save {saves}% vs. monthly</span>}
                  </button>}
                  <button type="button" disabled={busy || plan?.payment === false} onClick={() => go("/api/billing/addon-checkout", "unlimited")} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-60 ${yearly ? "border border-violet-300 bg-white text-violet-800 hover:bg-violet-50" : "bg-violet-600 text-white shadow-sm hover:bg-violet-700"}`} data-testid="todo-upgrade-buy">
                    {!yearly && <Sparkles className="h-4 w-4" />}{busy ? "Opening checkout…" : plan?.payment === false ? "Payments aren't set up yet" : `${price} a month`}
                  </button>
                </div>}
          </div>
          <details className="mt-3 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold">Fair use</summary>
            <p className="mt-1 leading-5">{plan?.fairUse}</p>
          </details>
        </div>
      </div>
    </div>
  );
}

/** Free or Unlimited, with the apps added across both hubs, for the Customize panel and the App Store. `hubApps` is this hub's count now. */
export function PlanCard({ hub, hubApps }: { hub: "work" | "life"; hubApps: number }) {
  const plan = useTodoPlan();
  if (!plan) return null;
  if (plan.unlimited) {
    return <button type="button" onClick={() => openUpgrade("plan")} className="mb-3 flex w-full items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-left text-sm text-violet-900" data-testid="todo-plan-card">
      <InfinityIcon className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><span className="block font-bold">Unlimited</span><span className="block text-xs text-violet-700">Every app in the App Gallery · {plan.ai.left} AI uses left this month</span></span>
    </button>;
  }
  const used = hubApps + (hub === "work" ? plan.apps.life : plan.apps.work);
  const limit = plan.apps.limit ?? FREE_APPS;
  const full = used >= limit;
  return <div className="mb-3 rounded-xl border border-slate-200 p-3 text-sm" data-testid="todo-plan-card">
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold text-slate-900">Free plan</span>
      <button type="button" onClick={() => openUpgrade("plan")} className="min-h-10 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white hover:bg-violet-700" data-testid="todo-plan-upgrade">Get Unlimited</button>
    </div>
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1" aria-hidden>{Array.from({ length: limit }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < used ? (full ? "bg-amber-500" : "bg-violet-500") : "bg-slate-100"}`} />)}</div>
      <span className={`shrink-0 text-xs font-semibold ${full ? "text-amber-700" : "text-slate-600"}`}>{Math.min(used, 99)} of {limit} apps</span>
    </div>
    <p className="mt-1.5 text-xs text-slate-500">{used > limit ? "You can keep every app you have. To add another, remove one or go Unlimited." : "Apps from the App Gallery, shared by WorkHub and LifeHub. Built-in sections are always free."} · No AI on Free</p>
  </div>;
}
