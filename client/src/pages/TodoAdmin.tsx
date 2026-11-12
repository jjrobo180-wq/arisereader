// The To-Do admin: a separate admin screen, not part of the Reader admin (arisetodo.com/#/todo-admin).
// Who signed up, how many people are using the site, who is on which plan and what they paid, and the buttons
// to switch an account off or on, give a free trial, cancel a plan or refund a payment. Admin only.
// The numbers come from /api/todo-admin (server/todoAdmin.ts); the labels and rules from shared/todoAdmin.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, CreditCard, Gift, Loader2, Mail, RefreshCw, Search, ShieldCheck, Sparkles, Undo2, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { usd } from "@shared/plans";
import {
  PAGE_SIZES, PLAN_FILTERS, PLAN_FILTER_LABEL, ROLE_FILTERS, ROLE_LABEL, SORTS, SORT_LABEL, TRIAL_CHOICES,
  type Overview, type Person, type PersonSort, type PlanFilter, type RoleFilter, type ProgramId, type ProgramMembership, type ProgramRow, type ProgramStats,
} from "@shared/todoAdmin";
import { lockPageScroll } from "@/lib/scrollLock";

type ListData = { rows: (Person & { memberships: ProgramMembership[] })[]; page: number; pages: number; total: number; counts: Record<PlanFilter, number>; moneyAvailable: boolean };
type Payment = { id: string; at: string; cents: number; refundedCents: number; description: string };
type Detail = {
  person: Person; payments: Payment[]; paymentsNote: string; hasCustomer: boolean; mode: "live" | "test" | "unset";
  plan: { kind: string; source: "stripe" | "admin"; status: string; live: boolean; endsAt: string | null; trial: boolean; cancelAtPeriodEnd: boolean; note: string; paidOnline: boolean; canCancel: boolean } | null;
  programs: ProgramRow[]; usedOn: { days: number; last: string[] }; vip: boolean;
};

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch { return null; }
}

const date = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
};
const ago = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "Never";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days < 31 ? `${days} day${days === 1 ? "" : "s"} ago` : date(iso);
};
const n = (v: number) => v.toLocaleString("en-US");
const money = (cents: number) => usd(Math.round(cents));

const TIER_STYLE: Record<string, string> = {
  free: "bg-slate-100 text-slate-700", ended: "bg-slate-100 text-slate-600", paid: "bg-emerald-100 text-emerald-800", past_due: "bg-rose-100 text-rose-800",
  trial: "bg-sky-100 text-sky-800", gift: "bg-sky-100 text-sky-800", vip: "bg-violet-100 text-violet-800",
};
const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 sm:text-sm";
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
const btnMain = `${btn} bg-violet-600 text-white hover:bg-violet-700`;
const btnLine = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
const btnDanger = `${btn} border border-rose-300 bg-white text-rose-700 hover:bg-rose-50`;

function useApi() {
  const { token } = useAuth();
  return useCallback(async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init?.method || "GET", cache: "no-store",
      headers: { Authorization: `Bearer ${token || cookieToken()}`, ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "That didn't work. Please try again.");
    return data as T;
  }, [token]);
}

// ─── Small pieces ────────────────────────────────────────────────────────

function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 break-words text-2xl font-black sm:text-3xl ${tone === "warn" ? "text-rose-700" : tone === "good" ? "text-emerald-700" : "text-slate-900"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className="group inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50">
      <span className={`relative h-7 w-12 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div><h2 className="text-lg font-black text-slate-900">{title}</h2>{hint && <p className="text-sm text-slate-500">{hint}</p>}</div>
      {children}
    </section>
  );
}

// ─── The numbers ─────────────────────────────────────────────────────────

function OverviewPanel({ data, error, onRetry }: { data: Overview | null; error: string; onRetry: () => void }) {
  if (error && !data) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error} <button type="button" onClick={onRetry} className="font-bold underline">Try again</button></div>;
  if (!data) return <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading the numbers…</div>;
  const { accounts: a, active, newAccounts: nw, plans: p, money: m } = data;
  return (
    <div className="space-y-8">
      <Section title="People using the site" hint="Everyone with an account, not counting your admin account or the sample accounts. “Active” means they opened the site that day.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Accounts" value={n(a.total)} sub={`${n(a.byRole.todo)} To-Do · ${n(a.byRole.teacher)} teachers · ${n(a.byRole.parent)} parents · ${n(a.byRole.student)} students`} />
          <Stat label="Online now" value={n(active.now)} sub="In the last 10 minutes" tone={active.now ? "good" : undefined} />
          <Stat label="Active today" value={n(active.all.today)} sub={`${n(active.all.week)} this week · ${n(active.all.month)} this month`} />
          <Stat label="New sign-ups" value={n(nw.all.week)} sub={`${n(nw.all.today)} today · ${n(nw.all.month)} in 30 days`} />
        </div>
        {(a.off > 0 || a.unconfirmed > 0) && (
          <p className="text-sm text-slate-600">{a.off > 0 && <span><b>{n(a.off)}</b> switched off. </span>}{a.unconfirmed > 0 && <span><b>{n(a.unconfirmed)}</b> waiting on their email code.</span>}</p>
        )}
      </Section>

      <Section title="Arise To Duo" hint="People with a To-Do account, and how they are paying.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="To-Do accounts" value={n(p.todoTotal)} sub={`${n(nw.todo.week)} new this week · ${n(active.todo.week)} active this week`} />
          <Stat label="Paying" value={n(p.paid)} sub={`${n(p.monthly)} monthly · ${n(p.yearly)} yearly`} tone={p.paid ? "good" : undefined} />
          <Stat label="Free trials and gifts" value={n(p.trials + p.gifts)} sub={`${n(p.trials)} ${p.trials === 1 ? "trial" : "trials"} · ${n(p.gifts)} with no end date`} />
          <Stat label="Free forever (VIP)" value={n(p.vip)} sub={`${n(p.todoFree)} other To-Do ${p.todoFree === 1 ? "account" : "accounts"} on the free plan`} />
        </div>
        {(p.pastDue > 0 || p.canceling > 0) && (
          <p className="text-sm text-slate-700">{p.pastDue > 0 && <span className="font-semibold text-rose-700">{n(p.pastDue)} with a failed payment. </span>}{p.canceling > 0 && <span><b>{n(p.canceling)}</b> set to cancel at the end of the month they paid for.</span>}</p>
        )}
      </Section>

      <Section title="Money" hint="From Stripe.">
        {m.available ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Collected, all plans" value={money(m.collectedCents - m.refundedCents)} sub={m.refundedCents ? `${money(m.refundedCents)} refunded` : `${n(m.payments)} payments`} />
              <Stat label="From To-Do plans" value={money(m.todoCollectedCents)} />
              <Stat label="Coming in each month" value={money(m.monthlyRecurringCents)} sub="Paying To-Do plans" />
              <Stat label="Stripe mode" value={m.mode === "live" ? "Live" : "Test"} sub={m.mode === "test" ? "No real money moves" : "Real payments"} tone={m.mode === "test" ? "warn" : "good"} />
            </div>
            {m.note && <p className="text-xs text-slate-500">{m.note}</p>}
          </>
        ) : <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{m.note}</p>}
      </Section>
    </div>
  );
}

// ─── One person ──────────────────────────────────────────────────────────

function PersonSheet({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const api = useApi();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [days, setDays] = useState(14);
  const [note, setNote] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try { setDetail(await api<Detail>(`/api/todo-admin/people/${id}`)); setLoadError(""); }
    catch (e: any) { setLoadError(e.message); }
  }, [api, id]);
  useEffect(() => { setDetail(null); setMsg(null); void load(); }, [load]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    const unlock = lockPageScroll();
    closeRef.current?.focus();
    return () => { window.removeEventListener("keydown", key); unlock(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(what: string, path: string, body: unknown, ok: string, confirmText?: string) {
    if (busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(what); setMsg(null);
    try {
      await api(`/api/todo-admin/people/${id}${path}`, { method: "POST", body });
      setMsg({ ok: true, text: ok });
      await load();
      onChanged();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(""); }
  }

  const p = detail?.person;
  const plan = detail?.plan;
  const name = p?.name || p?.username || "Person";
  const paying = !!plan?.paidOnline && plan.live;
  const firstName = name.split(" ")[0];
  const refundable = !!detail?.payments.some((c) => c.refundedCents < c.cents);
  const totalPaid = detail ? detail.payments.reduce((sum, c) => sum + c.cents, 0) : 0;
  const totalBack = detail ? detail.payments.reduce((sum, c) => sum + c.refundedCents, 0) : 0;
  const row = "flex items-start justify-between gap-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 kb-sheet z-50 flex items-end justify-center bg-slate-950/50 md:items-stretch md:justify-end" role="dialog" aria-modal="true" aria-label={`${name}, details`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="person-sheet">
      <div className="flex max-h-[94dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl md:max-h-none md:max-w-xl md:rounded-none">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-black text-slate-900">{name}</h2>
            {p && <p className="break-all text-sm text-slate-500">@{p.username}{p.email ? ` · ${p.email}` : ""}</p>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {loadError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{loadError} <button type="button" onClick={() => void load()} className="font-bold underline">Try again</button></p>}
          {!detail && !loadError && <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
          {msg && <p role="status" className={`rounded-xl p-3 text-sm font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{msg.text}</p>}

          {detail && p && <>
            <section className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Account">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0"><div className="font-bold text-slate-900">{p.enabled ? "Account is on" : "Account is off"}</div><div className="text-xs text-slate-500">{p.enabled ? "They can sign in." : "They are signed out and can't sign in."}</div></div>
                <Switch on={p.enabled} label={`Account on for ${name}`} disabled={!!busy}
                  onChange={(next) => void act("active", "/active", { active: next }, next ? `${name} is switched on.` : `${name} is switched off and signed out.`, next ? undefined : `Switch off ${name}?\n\nThey will be signed out everywhere and can't sign in until you switch them back on. Nothing they made is deleted.`)} />
              </div>
              <div className="divide-y divide-slate-100 pt-1">
                <div className={row}><span className="text-slate-500">Kind of account</span><b className="text-right">{p.role === "todo" ? "Arise To Duo" : p.role[0].toUpperCase() + p.role.slice(1)}</b></div>
                <div className={row}><span className="text-slate-500">Signed up</span><b className="text-right">{date(p.createdAt) || "—"}</b></div>
                <div className={row}><span className="text-slate-500">Last on the site</span><b className="text-right">{ago(p.lastActiveAt)}</b></div>
                <div className={row}><span className="text-slate-500">Days used, last 5 weeks</span><b className="text-right">{detail.usedOn.days}</b></div>
                <div className={row}><span className="text-slate-500">Email</span><b className="text-right">{p.confirmed ? "Confirmed" : "Waiting on the code we emailed"}</b></div>
              </div>
              {!p.confirmed && <button type="button" disabled={!!busy} className={`${btnLine} mt-2 w-full`} onClick={() => void act("confirm", "/confirm", {}, `${name}'s account is turned on.`, `Turn on ${name}'s account without their email code?`)}><Mail className="h-4 w-4" /> Turn on without the email code</button>}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Memberships" data-testid="sheet-memberships">
              <h3 className="font-black text-slate-900">Memberships in every program</h3>
              <ul className="divide-y divide-slate-100">
                {detail.programs.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0"><div className="text-sm font-bold text-slate-900">{g.name}</div><div className="text-xs text-slate-500">{g.plan.tier === "free" || g.plan.tier === "ended" ? g.plan.detail || "No membership" : g.plan.detail}</div></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TIER_STYLE[g.plan.tier] || "bg-slate-100 text-slate-700"}`}>{g.plan.label}</span>
                      {g.id !== "todo" && g.canGive && p.role !== "student" && (g.given
                        ? <button type="button" className={btnLine} disabled={!!busy} onClick={() => void act(`end-${g.id}`, "/program/end", { program: g.id }, `${firstName}'s free ${g.name} membership ended.`, `End ${firstName}'s free ${g.name} membership now?`)}>End free</button>
                        : (g.plan.tier === "free" || g.plan.tier === "ended") && <button type="button" className={btnMain} disabled={!!busy} onClick={() => void act(`give-${g.id}`, "/program", { program: g.id, days }, `${firstName} has a free ${g.name} membership.`)}><Gift className="h-4 w-4" /> Give</button>)}
                    </div>
                  </li>
                ))}
              </ul>
              <label className="block text-xs font-semibold text-slate-600">How long a free membership lasts
                <select className={`${field} mt-1`} value={days} onChange={(e) => setDays(Number(e.target.value))}>{TRIAL_CHOICES.map((c) => <option key={c.days} value={c.days}>{c.label}</option>)}</select>
              </label>
              <p className="text-xs text-slate-500">Arise To Duo has its own trial, cancel and refund buttons just below. Arise Reader teacher plans are given in the Reader admin.</p>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Plan">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-slate-900">Arise To Duo plan</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${TIER_STYLE[p.plan.tier]}`}>{p.plan.label}</span>
              </div>
              {p.plan.detail && <p className="text-sm text-slate-600">{p.plan.detail}</p>}
              {plan?.note && <p className="text-xs text-slate-500">Note: {plan.note}</p>}
              {detail.mode === "test" && <p className="rounded-xl bg-amber-50 p-2 text-xs font-semibold text-amber-900">Stripe is in test mode: payments here are not real money.</p>}

              {plan?.canCancel && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="text-sm font-bold text-slate-800">Paying {firstName}'s plan</div>
                  {plan.cancelAtPeriodEnd
                    ? <button type="button" className={`${btnLine} w-full`} disabled={!!busy} onClick={() => void act("keep", "/keep", {}, "Their plan will keep renewing.")}><Undo2 className="h-4 w-4" /> Keep their plan (undo cancel)</button>
                    : <button type="button" className={`${btnDanger} w-full`} disabled={!!busy} onClick={() => void act("cancel-end", "/cancel", { when: "period_end" }, "Their plan will end when the time they paid for runs out.", `Cancel ${name}'s plan at the end of the time they paid for?\n\nThey keep Unlimited until then and are not charged again.`)}>Cancel at the end of what they paid for</button>}
                  <button type="button" className={`${btnDanger} w-full`} disabled={!!busy} onClick={() => void act("cancel-now", "/cancel", { when: "now" }, "Their plan is cancelled now.", `Cancel ${name}'s plan right now?\n\nThey lose Unlimited immediately. This does not refund anything: use “Refund last payment” for that.`)}>Cancel right now</button>
                </div>
              )}

              {plan && plan.source === "admin" && plan.live && (
                <button type="button" className={`${btnDanger} w-full`} disabled={!!busy} onClick={() => void act("end-trial", "/trial/end", {}, "Their free access has ended.", `End ${name}'s free ${plan.endsAt ? "trial" : "access"} now?`)}>End their free {plan.endsAt ? "trial" : "access"} now</button>
              )}

              {!paying && p.role !== "student" && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Gift className="h-4 w-4 text-violet-600" /> {plan?.live && plan.source === "admin" ? "Change their free time" : "Give a free trial"}</div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How long">
                    {TRIAL_CHOICES.map((c) => (
                      <button key={c.days} type="button" role="radio" aria-checked={days === c.days} onClick={() => setDays(c.days)}
                        className={`min-h-11 rounded-xl border-2 px-3 text-sm font-bold ${days === c.days ? "border-violet-600 bg-violet-50 text-violet-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{c.label}</button>
                    ))}
                  </div>
                  <input className={field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Note for yourself (optional)" aria-label="Note for yourself" />
                  <button type="button" className={`${btnMain} w-full`} disabled={!!busy} onClick={() => void act("trial", "/trial", { days, note }, days ? `${firstName} has Unlimited free for ${TRIAL_CHOICES.find((c) => c.days === days)?.label}.` : `${firstName} has free Unlimited with no end date.`)}>
                    {busy === "trial" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {days ? `Give ${TRIAL_CHOICES.find((c) => c.days === days)?.label} of Unlimited` : "Give Unlimited with no end date"}
                  </button>
                </div>
              )}

              {p.role !== "student" && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ShieldCheck className="h-4 w-4 text-violet-600" /> Free forever (VIP)</div><div className="text-xs text-slate-500">Unlimited with no payment, until you take it off.</div></div>
                  <Switch on={detail.vip} label={`Free forever for ${name}`} disabled={!!busy} onChange={(next) => void act("vip", "/vip", { on: next }, next ? `${name} is on the VIP list.` : `${name} is off the VIP list.`)} />
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Payments">
              <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-black text-slate-900"><CreditCard className="h-4 w-4" /> What they paid</h3>{detail.payments.length > 0 && <b className="text-slate-900">{money(totalPaid - totalBack)}</b>}</div>
              {detail.paymentsNote && <p className="text-sm text-slate-600">{detail.paymentsNote}</p>}
              {!detail.hasCustomer && <p className="text-sm text-slate-600">No online payments. Nothing to charge or refund.</p>}
              {detail.hasCustomer && !detail.paymentsNote && detail.payments.length === 0 && <p className="text-sm text-slate-600">No payments yet.</p>}
              {detail.payments.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {detail.payments.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0"><span className="block font-semibold text-slate-800">{date(c.at)}</span><span className="block truncate text-xs text-slate-500">{c.description || "Payment"}</span></span>
                      <span className="shrink-0 text-right"><b>{money(c.cents)}</b>{c.refundedCents > 0 && <span className="block text-xs text-rose-700">{money(c.refundedCents)} refunded</span>}</span>
                    </li>
                  ))}
                </ul>
              )}
              {refundable && <button type="button" className={`${btnDanger} w-full`} disabled={!!busy} onClick={() => void act("refund", "/refund", {}, "The last payment was refunded.", `Refund ${name}'s last payment?\n\nThe money goes back to their card. This does not cancel their plan.`)}>Refund last payment</button>}
            </section>
            <section className="space-y-2 rounded-2xl border border-rose-200 bg-white p-4" aria-label="Delete account">
              <h3 className="font-black text-rose-800">Delete this account</h3>
              <p className="text-sm text-slate-600">Removes {firstName} from every Arise program and deletes what they made. This can't be undone. To only stop them signing in, use the switch at the top.</p>
              <button type="button" className={`${btnDanger} w-full`} disabled={!!busy} data-testid="sheet-delete" onClick={() => {
                const t = window.prompt(`Delete ${name} for good?\n\nType their username (${p.username}) to delete.`);
                if (t === null) return;
                setBusy("delete"); setMsg(null);
                api(`/api/todo-admin/people/${id}/delete`, { method: "POST", body: { confirm: t } }).then(() => { onChanged(); onClose(); }).catch((e: any) => setMsg({ ok: false, text: e.message })).finally(() => setBusy(""));
              }}>Delete account</button>
            </section>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─── The list ────────────────────────────────────────────────────────────

function PersonRow({ p, showMoney, onOpen, onToggle, busy, picked, onPick }: { p: Person & { memberships: ProgramMembership[] }; showMoney: boolean; onOpen: () => void; onToggle: (next: boolean) => void; busy: boolean; picked: boolean; onPick: (on: boolean) => void }) {
  const first = p.name || p.username;
  return (
    <li className={`${p.enabled ? "bg-white" : "bg-slate-50"} cursor-pointer px-3 py-3 hover:bg-violet-50/40 sm:px-4 md:grid md:grid-cols-[minmax(0,2.3fr)_minmax(0,1.4fr)_7rem_minmax(0,1.7fr)_5.5rem_3.5rem] md:items-center md:gap-4`}
      onClick={onOpen} data-testid={`person-${p.id}`}>
      <div className="flex min-w-0 items-start justify-between gap-3 md:block">
       <div className="flex min-w-0 items-start gap-3">
        <input type="checkbox" checked={picked} onChange={(e) => onPick(e.target.checked)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${first}`} className="mt-1 h-5 w-5 shrink-0 accent-violet-600" data-testid={`pick-${p.id}`} />
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="min-w-0 text-left" aria-label={`Open ${first}`}>
          <span className={`block break-words text-base font-bold ${p.enabled ? "text-slate-900" : "text-slate-500"}`}>{first}
            {!p.enabled && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 align-middle text-[11px] font-bold text-slate-700">Off</span>}
            {p.enabled && !p.confirmed && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[11px] font-bold text-amber-900">Needs email code</span>}
          </span>
          <span className="block break-all text-xs text-slate-500">@{p.username}{p.email ? ` · ${p.email}` : ""}</span>
        </button>
       </div>
        <span className="md:hidden"><Switch on={p.enabled} disabled={busy} label={`Account on for ${first}`} onChange={onToggle} /></span>
      </div>
      <div className="mt-2 text-xs text-slate-600 md:mt-0 md:text-sm">
        <span className="md:block">Joined {date(p.createdAt) || "—"}</span><span className="mx-1 md:hidden">·</span><span className="text-slate-500 md:block">Seen {ago(p.lastActiveAt).replace(/^(Never|Just now)$/, (w) => w.toLowerCase())}</span>
      </div>
      <div className="hidden text-sm font-semibold text-slate-700 md:block">{p.role === "todo" ? "To-Do" : p.role[0].toUpperCase() + p.role.slice(1)}</div>
      <div className="mt-2 min-w-0 md:mt-0">
        <div className="flex flex-wrap gap-1">
          {p.plan.tier === "vip" && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TIER_STYLE.vip}`}>VIP</span>}
          {p.memberships.map((m) => <span key={m.id} title={m.label} className={`rounded-full px-2.5 py-1 text-xs font-bold ${TIER_STYLE[m.tier]}`}>{m.name.replace("Arise ", "")}: {m.tier === "paid" ? "Paid" : m.tier === "trial" ? "Trial" : m.tier === "gift" ? "Free" : "Payment failed"}</span>)}
          {!p.memberships.length && p.plan.tier !== "vip" && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">No membership</span>}
        </div>
      </div>
      <div className="mt-2 text-sm md:mt-0 md:text-right">
        <span className="text-xs text-slate-500 md:hidden">Paid </span>
        <b className="text-slate-900">{showMoney ? (p.paidCents ? money(p.paidCents - (p.refundedCents || 0)) : "$0") : "—"}</b>
      </div>
      <div className="hidden justify-self-end md:block"><Switch on={p.enabled} disabled={busy} label={`Account on for ${first}`} onChange={onToggle} /></div>
    </li>
  );
}

export default function TodoAdmin() {
  const { user } = useAuth();
  const api = useApi();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [list, setList] = useState<ListData | null>(null);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleFilter>("all");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [sort, setSort] = useState<PersonSort>("newest");
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(25);
  const [open, setOpen] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const ticket = useRef(0);
  const [programs, setPrograms] = useState<ProgramStats[] | null>(null);
  const [program, setProgram] = useState<ProgramId | "any">("any");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const loadPrograms = useCallback(async () => { try { setPrograms((await api<{ programs: ProgramStats[] }>("/api/todo-admin/programs")).programs); } catch { /* the tabs show without numbers */ } }, [api]);
  useEffect(() => { void loadPrograms(); }, [loadPrograms]);

  useEffect(() => { const t = window.setTimeout(() => { setQ(typed.trim()); setPage(1); }, 300); return () => window.clearTimeout(t); }, [typed]);

  const loadOverview = useCallback(async () => {
    try { setOverview(await api<Overview>("/api/todo-admin/overview")); setOverviewError(""); }
    catch (e: any) { setOverviewError(e.message); }
  }, [api]);
  const loadList = useCallback(async () => {
    const mine = ++ticket.current;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ role, plan, sort, q, page: String(page), size: String(size), ...(program !== "any" ? { program } : {}) });
      const data = await api<ListData>(`/api/todo-admin/people?${qs}`);
      if (mine !== ticket.current) return; // a newer search has gone out
      setList(data); setListError("");
      if (data.page !== page) setPage(data.page);
    } catch (e: any) { if (mine === ticket.current) setListError(e.message); }
    finally { if (mine === ticket.current) setLoading(false); }
  }, [api, role, plan, sort, q, page, size, program]);
  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { void loadList(); }, [loadList]);
  const refresh = () => { void loadOverview(); void loadList(); void loadPrograms(); };

  async function toggle(p: Person, next: boolean) {
    if (toggling) return;
    if (!next && !window.confirm(`Switch off ${p.name || p.username}?\n\nThey will be signed out everywhere and can't sign in until you switch them back on. Nothing they made is deleted.`)) return;
    setToggling(p.id); setFlash(null);
    try {
      await api(`/api/todo-admin/people/${p.id}/active`, { method: "POST", body: { active: next } });
      setFlash({ ok: true, text: `${p.name || p.username} is ${next ? "on" : "off"}.` });
      refresh();
    } catch (e: any) { setFlash({ ok: false, text: e.message }); }
    finally { setToggling(null); }
  }

  const pickedHere = list ? list.rows.filter((r) => picked.has(r.id)).length : 0;
  const allHere = !!list && list.rows.length > 0 && pickedHere === list.rows.length;
  async function deleteSelected() {
    if (!picked.size || toggling) return;
    const typedWord = window.prompt(`Delete ${picked.size} account${picked.size === 1 ? "" : "s"} for good?\n\nThis removes them from every Arise program and can't be undone.\n\nType DELETE to continue.`);
    if (typedWord === null) return;
    setToggling(-1); setFlash(null);
    try {
      const r = await api<{ deleted: number; skipped: { name: string; why: string }[] }>("/api/todo-admin/people/delete-many", { method: "POST", body: { ids: [...picked], confirm: typedWord } });
      setPicked(new Set());
      setFlash({ ok: r.skipped.length === 0, text: `${r.deleted} deleted.${r.skipped.length ? ` Not deleted: ${r.skipped.map((s) => `${s.name || "someone"} (${s.why})`).join("; ")}.` : ""}` });
      refresh();
    } catch (e: any) { setFlash({ ok: false, text: e.message }); }
    finally { setToggling(null); }
  }

  const planOptions = useMemo(() => PLAN_FILTERS.map((f) => ({ f, label: `${PLAN_FILTER_LABEL[f]}${list ? ` (${list.counts[f] ?? 0})` : ""}` })), [list]);

  if (!user) return null;
  if (!user.isAdmin) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center"><div><h1 className="text-xl font-black text-slate-900">Admins only</h1><p className="mt-1 text-slate-600">This page is for the site admin.</p><a href="#/" className={`${btnMain} mt-4`}>Go back</a></div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16 text-slate-900" data-testid="todo-admin">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <a href="#/lifehub" aria-label="Back to LifeHub" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></a>
            <div className="min-w-0"><div className="truncate text-base font-black sm:text-lg">Arise Admin</div><div className="hidden truncate text-xs text-slate-500 sm:block">People, memberships and payments, program by program</div></div>
          </div>
          <button type="button" onClick={refresh} className={btnLine} aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Refresh</span></button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-3 py-5 sm:px-5 sm:py-8">
        <Section title="Programs" hint="Each program's numbers. Tap one to list only its members below.">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" data-testid="program-cards">
            {(programs ?? []).map((g) => (
              <button key={g.id} type="button" onClick={() => { setProgram(program === g.id ? "any" : g.id); setPage(1); setPicked(new Set()); }} aria-pressed={program === g.id}
                className={`min-w-0 rounded-2xl border-2 bg-white p-3 text-left ${program === g.id ? "border-violet-600" : "border-slate-200 hover:border-slate-300"}`}>
                <div className="truncate text-sm font-black text-slate-900">{g.name}</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{n(g.members)}</div>
                <div className="text-xs text-slate-500">{n(g.paying)} paying · {n(g.given)} free{g.pastDue ? ` · ${n(g.pastDue)} failed` : ""}</div>
              </button>
            ))}
          </div>
        </Section>

        <>
        <OverviewPanel data={overview} error={overviewError} onRetry={() => void loadOverview()} />

        <Section title={program === "any" ? "Everyone" : `${(programs ?? []).find((g) => g.id === program)?.name ?? ""} members`} hint="Tick people to delete several at once. Tap a person for their memberships, payments and a delete button. The switch turns their account on or off.">
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Kind of account">
            {ROLE_FILTERS.map((r) => (
              <button key={r} type="button" role="tab" aria-selected={role === r} onClick={() => { setRole(r); setPage(1); setPicked(new Set()); }}
                className={`min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-bold ${role === r ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                {ROLE_LABEL[r]}{overview ? ` (${n(r === "all" ? overview.accounts.total : overview.accounts.byRole[r])})` : ""}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_14rem_12rem]">
            <label className="relative block sm:col-span-2 lg:col-span-1">
              <span className="sr-only">Search by name, username or email</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${field} pl-9`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search name, username or email" type="search" autoComplete="off" data-testid="people-search" />
            </label>
            <select className={field} value={plan} onChange={(e) => { setPlan(e.target.value as PlanFilter); setPage(1); }} aria-label="Plan">{planOptions.map((o) => <option key={o.f} value={o.f}>{o.label}</option>)}</select>
            <select className={field} value={sort} onChange={(e) => { setSort(e.target.value as PersonSort); setPage(1); }} aria-label="Sort by">{SORTS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}</select>
          </div>

          {list && list.rows.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200" data-testid="bulk-bar">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="h-5 w-5 accent-violet-600" checked={allHere} onChange={(e) => setPicked((c) => { const x = new Set(c); for (const r of list.rows) { if (e.target.checked) x.add(r.id); else x.delete(r.id); } return x; })} />Select everyone on this page</label>
            {picked.size > 0 && <><span className="text-sm text-slate-600">{picked.size} selected</span>
              <button type="button" className={btnDanger} onClick={() => void deleteSelected()} disabled={!!toggling} data-testid="bulk-delete">Delete selected</button>
              <button type="button" className={btnLine} onClick={() => setPicked(new Set())}>Clear</button></>}
          </div>}
          {flash && <p role="status" className={`rounded-xl p-3 text-sm font-semibold ${flash.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{flash.text}</p>}
          {listError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{listError} <button type="button" onClick={() => void loadList()} className="font-bold underline">Try again</button></p>}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="hidden grid-cols-[minmax(0,2.3fr)_minmax(0,1.4fr)_7rem_minmax(0,1.7fr)_5.5rem_3.5rem] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
              <span>Person</span><span>Joined / seen</span><span>Account</span><span>Memberships</span><span className="text-right">Paid</span><span className="text-right">On</span>
            </div>
            {!list && !listError && <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading people…</div>}
            {list && list.rows.length === 0 && <div className="p-8 text-center text-sm text-slate-500" data-testid="people-empty">{q || plan !== "all" ? "No one matches that. Try a different search or filter." : "No one here yet."}</div>}
            {list && list.rows.length > 0 && (
              <ul className={`divide-y divide-slate-100 ${loading ? "opacity-60" : ""}`} data-testid="people-list">
                {list.rows.map((p) => <PersonRow key={p.id} p={p} showMoney={list.moneyAvailable} busy={toggling === p.id} onOpen={() => setOpen(p.id)} onToggle={(next) => void toggle(p, next)} picked={picked.has(p.id)} onPick={(on) => setPicked((c) => { const x = new Set(c); if (on) x.add(p.id); else x.delete(p.id); return x; })} />)}
              </ul>
            )}
          </div>

          {list && list.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600" aria-live="polite">{n(list.total)} {list.total === 1 ? "person" : "people"} · page {list.page} of {list.pages}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }} aria-label="People per page">{PAGE_SIZES.map((s) => <option key={s} value={s}>{s} per page</option>)}</select>
                <button type="button" className={btnLine} disabled={list.page <= 1 || loading} onClick={() => setPage(list.page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span></button>
                <button type="button" className={btnLine} disabled={list.page >= list.pages || loading} onClick={() => setPage(list.page + 1)} aria-label="Next page"><span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </Section>
        </>
        <p className="flex items-center gap-2 text-xs text-slate-500"><Users className="h-3.5 w-3.5" /> Only you can see this page.</p>
      </div>

      {open !== null && <PersonSheet id={open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </main>
  );
}
