// A.R.I.S.E. To-Do's Free and Unlimited plans in the hubs (rules in shared/todoPlan.ts):
//  - useTodoPlan: Free or Unlimited, and this month's AI uses, from the server.
//  - openUpgrade(...): opens the "Get Unlimited" box from anywhere (a 6th menu button, AI used up).
//  - <UpgradeHost>: the box itself. It also opens on its own when the server answers that the free
//    plan is full (any 402 with the plan's codes), and finishes a checkout when the page comes back.
//  - <PlanCard>: Free or Unlimited, buttons and AI used, for the Customize panel.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Infinity as InfinityIcon, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { AI_LIMIT, BUTTONS_FULL, FREE_AI_PER_MONTH, FREE_MENU_BUTTONS } from "@shared/todoPlan";

export type TodoPlan = {
  unlimited: boolean; via: string | null; endsAt: string | null; buttons: number | null;
  ai: { limit: number; used: number; left: number }; priceCents: number; payment: boolean; paidByYou: boolean; fairUse: string;
};
type Reason = "buttons" | "ai" | "plan";

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

/** True when a free hub can't take another menu button. */
export const freeIsFull = (plan: TodoPlan | null, used: number) => !!plan && !plan.unlimited && used >= FREE_MENU_BUTTONS;

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
        if (d?.code === AI_LIMIT) { refreshTodoPlan(); if (!d.unlimited) openUpgrade("ai"); }
        else if (d?.code === BUTTONS_FULL) openUpgrade("buttons");
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

  const go = async (path: string) => {
    if (!token) return;
    setBusy(true); setNote("");
    try {
      const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ product: "unlimited", returnPath: hub === "work" ? "/workhub" : "/lifehub" }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && typeof d.url === "string" && d.url.startsWith("https://")) { window.location.href = d.url; return; }
      setNote(d.message || "That didn't work. Please try again.");
    } catch { setNote("That didn't work. Please check your connection and try again."); }
    setBusy(false);
  };

  if (!reason) return null;
  const price = usd(plan?.priceCents ?? 1000);
  const title = plan?.unlimited ? "You're on Unlimited"
    : reason === "buttons" ? `Your ${FREE_MENU_BUTTONS} free menu buttons are in use`
    : reason === "ai" ? `You've used your ${FREE_AI_PER_MONTH} free AI uses this month`
    : "Get A.R.I.S.E. To-Do Unlimited";
  const lead = plan?.unlimited ? "Every menu button you want, and AI for everyday use, in WorkHub and LifeHub."
    : reason === "buttons" ? `The free plan has room for ${FREE_MENU_BUTTONS} menu buttons in each hub: any mix of sections, apps and your own lists. Remove one in Customize to make room, or go Unlimited.`
    : reason === "ai" ? "Your free AI uses come back on the 1st. Go Unlimited to keep using AI now."
    : "Add every section, app and list you want, and use AI every day.";

  return (
    <div className="fixed inset-0 z-[320] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="upgrade-title" data-testid="todo-upgrade" onClick={(e) => { if (e.target === e.currentTarget) setReason(null); }}>
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <button type="button" onClick={() => setReason(null)} aria-label="Close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" data-testid="todo-upgrade-close"><X className="h-5 w-5" /></button>
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
                <li>{FREE_MENU_BUTTONS} menu buttons per hub</li>
                <li>{FREE_AI_PER_MONTH} AI uses a month</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-violet-500 bg-violet-50 p-3">
              <p className="font-bold text-violet-900">Unlimited</p>
              <p className="text-xs text-violet-700">{price} a month</p>
              <ul className="mt-2 space-y-1 text-violet-900">
                <li className="flex gap-1"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />Every button</li>
                <li className="flex gap-1"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />AI every day</li>
                <li className="flex gap-1"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />Both hubs</li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Home, Settings and A.R.I.S.E. Reader are always free and never count as buttons. Nothing is ever deleted if you go back to Free.</p>
          {note && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{note}</p>}
          <div className="mt-4">
            {plan?.unlimited
              ? (plan.paidByYou
                ? <button type="button" disabled={busy} onClick={() => go("/api/billing/addon-portal")} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50" data-testid="todo-upgrade-manage">{busy ? "Opening…" : "Manage billing"}</button>
                : <button type="button" onClick={() => setReason(null)} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">Done</button>)
              : <button type="button" disabled={busy || plan?.payment === false} onClick={() => go("/api/billing/addon-checkout")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60" data-testid="todo-upgrade-buy">
                  <Sparkles className="h-4 w-4" />{busy ? "Opening checkout…" : plan?.payment === false ? "Payments aren't set up yet" : `Get Unlimited for ${price} a month`}
                </button>}
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

/** Free or Unlimited, with this hub's buttons and this month's AI, for the Customize panel. */
export function PlanCard({ used }: { used: number }) {
  const plan = useTodoPlan();
  if (!plan) return null;
  if (plan.unlimited) {
    return <button type="button" onClick={() => openUpgrade("plan")} className="mb-3 flex w-full items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-left text-sm text-violet-900" data-testid="todo-plan-card">
      <InfinityIcon className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><span className="block font-bold">Unlimited</span><span className="block text-xs text-violet-700">Every menu button · {plan.ai.left} AI uses left this month</span></span>
    </button>;
  }
  const full = used >= FREE_MENU_BUTTONS;
  return <div className="mb-3 rounded-xl border border-slate-200 p-3 text-sm" data-testid="todo-plan-card">
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold text-slate-900">Free plan</span>
      <button type="button" onClick={() => openUpgrade("plan")} className="min-h-10 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white hover:bg-violet-700" data-testid="todo-plan-upgrade">Get Unlimited</button>
    </div>
    <div className="mt-2 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-violet-500"}`} style={{ width: `${Math.min(100, (used / FREE_MENU_BUTTONS) * 100)}%` }} /></div>
      <span className={`shrink-0 text-xs font-semibold ${full ? "text-amber-700" : "text-slate-600"}`}>{used} of {FREE_MENU_BUTTONS} menu buttons</span>
    </div>
    {used > FREE_MENU_BUTTONS && <p className="mt-1.5 text-xs text-slate-500">You can keep everything you have. To add something new, remove a button or go Unlimited.</p>}
    <p className="mt-1.5 text-xs text-slate-500">{plan.ai.left} of {plan.ai.limit} AI uses left this month · Home, Settings and A.R.I.S.E. Reader don't count.</p>
  </div>;
}
