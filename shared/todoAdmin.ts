// The To-Do admin: who signed up, who is on what plan, and the counts that go with it. Pure functions, so the
// server and the tests share one set of rules. The screen is client/src/pages/TodoAdmin.tsx.

import { UNLIMITED_MONTHLY_CENTS, UNLIMITED_YEARLY_CENTS } from "./todoPlan";
import { grantLive, usd, type PlanGrant, type PlanKind } from "./plans";

/** Does this Stripe secret key move real money ("live"), play money ("test"), or is there none? */
export function stripeKeyMode(key: unknown): "live" | "test" | "unset" {
  const k = String(key ?? "").trim();
  return !k ? "unset" : /^(sk|rk)_test_/.test(k) ? "test" : "live";
}

export type PersonRole = "student" | "teacher" | "parent" | "todo";
export const ROLE_FILTERS = ["todo", "teacher", "parent", "student", "all"] as const;
export type RoleFilter = (typeof ROLE_FILTERS)[number];
export const ROLE_LABEL: Record<RoleFilter, string> = { todo: "A.R.I.S.E. To-Do", teacher: "Teachers", parent: "Parents", student: "Students", all: "Everyone" };
export const PLAN_FILTERS = ["all", "paid", "trial", "vip", "free", "problem", "off"] as const;
export type PlanFilter = (typeof PLAN_FILTERS)[number];
export const PLAN_FILTER_LABEL: Record<PlanFilter, string> = { all: "All plans", paid: "Paying", trial: "Free trial or gift", vip: "Free forever (VIP)", free: "Free plan", problem: "Needs a look", off: "Switched off" };
export const SORTS = ["newest", "oldest", "name", "active", "paid"] as const;
export type PersonSort = (typeof SORTS)[number];
export const SORT_LABEL: Record<PersonSort, string> = { newest: "Newest first", oldest: "Oldest first", name: "Name A to Z", active: "Last seen", paid: "Most paid" };

/** What the plan records say about one person's To-Do plan. */
export type PlanInfo = {
  kind: PlanKind;
  source: "stripe" | "admin";
  status: "active" | "past_due" | "canceled";
  live: boolean;
  endsAt: string | null;
  trial: boolean;
  cancelAtPeriodEnd: boolean;
  customerId?: string;
  subscriptionId?: string;
  note?: string;
};

export const TODO_PLAN_KINDS: readonly PlanKind[] = ["todo_unlimited", "todo_unlimited_year", "todo_family"];

export function infoFromGrant(g: PlanGrant, now: number): PlanInfo {
  return {
    kind: g.kind, source: g.source, status: g.status, live: grantLive(g, now), endsAt: g.endsAt ?? null, trial: !!g.trial,
    cancelAtPeriodEnd: !!g.cancelAtPeriodEnd, ...(g.stripeCustomerId ? { customerId: g.stripeCustomerId } : {}),
    ...(g.stripeSubscriptionId ? { subscriptionId: g.stripeSubscriptionId } : {}), ...(g.note ? { note: g.note } : {}),
  };
}

/** Of one person's To-Do plan records, the one that matters: a running plan before an ended one, Unlimited before the old family plan. */
export function bestInfo(list: PlanInfo[]): PlanInfo | null {
  const rank = (i: PlanInfo) => (i.live ? 0 : 10) + (i.kind === "todo_family" ? 1 : 0) + (i.source === "stripe" ? 0 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export type PlanTier = "free" | "paid" | "trial" | "gift" | "vip" | "past_due" | "ended";
export type PlanView = { tier: PlanTier; label: string; detail: string; endsAt: string | null; canceling: boolean; unlimited: boolean };

const dayWords = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" });
};

export function planView(info: PlanInfo | null, vip: boolean, now: number): PlanView {
  if (vip) return { tier: "vip", label: "Free forever (VIP)", detail: "On the admin's VIP list", endsAt: null, canceling: false, unlimited: true };
  if (!info) return { tier: "free", label: "Free", detail: "", endsAt: null, canceling: false, unlimited: false };
  const family = info.kind === "todo_family";
  const price = info.kind === "todo_unlimited_year" ? `${usd(UNLIMITED_YEARLY_CENTS)}/year` : info.kind === "todo_unlimited" ? `${usd(UNLIMITED_MONTHLY_CENTS)}/month` : "";
  const name = family ? "LifeHub family plan" : "Unlimited";
  if (!info.live) {
    return { tier: "ended", label: "Free", detail: `${info.source === "admin" ? (info.trial ? "Free trial" : "Free access") : name} ended${info.endsAt ? ` ${dayWords(info.endsAt)}` : ""}`, endsAt: info.endsAt, canceling: false, unlimited: false };
  }
  if (info.source === "admin") {
    return info.endsAt
      ? { tier: "trial", label: "Free trial", detail: `Unlimited until ${dayWords(info.endsAt)}`, endsAt: info.endsAt, canceling: false, unlimited: true }
      : { tier: "gift", label: "Free access", detail: "Unlimited, no end date", endsAt: null, canceling: false, unlimited: true };
  }
  if (info.status === "past_due") return { tier: "past_due", label: "Payment failed", detail: `${name}${price ? ` · ${price}` : ""} · card was declined`, endsAt: info.endsAt, canceling: false, unlimited: !family };
  return {
    tier: "paid", label: `${name}${price ? ` · ${price}` : ""}`,
    detail: info.cancelAtPeriodEnd ? `Cancelling: ends ${dayWords(info.endsAt)}` : info.endsAt ? `Renews ${dayWords(info.endsAt)}` : "Active",
    endsAt: info.endsAt, canceling: info.cancelAtPeriodEnd, unlimited: !family,
  };
}

export type Person = {
  id: number; name: string; username: string; email: string; role: PersonRole; createdAt: string;
  /** Not archived: able to sign in. */
  enabled: boolean;
  /** Email confirmed / approved. */
  confirmed: boolean;
  lastActiveAt: string | null;
  plan: PlanView;
  paidCents: number | null;
  refundedCents: number | null;
};

const norm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9@.+ ]+/g, " ").replace(/\s+/g, " ").trim();

export function matchesRole(p: Person, role: RoleFilter) { return role === "all" || p.role === role; }

export function matchesPlan(p: Person, plan: PlanFilter): boolean {
  switch (plan) {
    case "paid": return p.plan.tier === "paid" || p.plan.tier === "past_due";
    case "trial": return p.plan.tier === "trial" || p.plan.tier === "gift";
    case "vip": return p.plan.tier === "vip";
    case "free": return p.plan.tier === "free" || p.plan.tier === "ended";
    case "problem": return p.plan.tier === "past_due" || p.plan.canceling || (!p.confirmed && p.enabled);
    case "off": return !p.enabled;
    default: return true;
  }
}

export function matchesQuery(p: Person, q: string): boolean {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = norm(`${p.name} ${p.username} ${p.email}`);
  return words.every((w) => hay.includes(w));
}

export function sortPeople(list: Person[], sort: PersonSort): Person[] {
  const t = (iso: string | null) => { const n = Date.parse(iso || ""); return Number.isFinite(n) ? n : 0; };
  const by: Record<PersonSort, (a: Person, b: Person) => number> = {
    newest: (a, b) => t(b.createdAt) - t(a.createdAt) || b.id - a.id,
    oldest: (a, b) => t(a.createdAt) - t(b.createdAt) || a.id - b.id,
    name: (a, b) => (a.name || a.username).localeCompare(b.name || b.username, undefined, { sensitivity: "base" }) || a.id - b.id,
    active: (a, b) => t(b.lastActiveAt) - t(a.lastActiveAt) || b.id - a.id,
    paid: (a, b) => (b.paidCents ?? 0) - (a.paidCents ?? 0) || t(b.createdAt) - t(a.createdAt),
  };
  return [...list].sort(by[sort]);
}

export const PAGE_SIZES = [25, 50, 100] as const;

export function pageOf<T>(list: T[], page: number, size: number): { rows: T[]; page: number; pages: number; total: number } {
  const per = Math.max(1, Math.min(100, Math.floor(size) || 25));
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / per));
  const at = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { rows: list.slice((at - 1) * per, at * per), page: at, pages, total };
}

/** A whole number of days, as the trial buttons offer them. 0 means no end date. */
export const TRIAL_CHOICES: readonly { days: number; label: string }[] = [
  { days: 7, label: "7 days" }, { days: 14, label: "14 days" }, { days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 365, label: "1 year" }, { days: 0, label: "No end date" },
];
export const TRIAL_MAX_DAYS = 3650;
export function cleanTrialDays(v: unknown): number | null {
  if (!(typeof v === "number" || (typeof v === "string" && v.trim() !== ""))) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= TRIAL_MAX_DAYS ? n : null;
}

// ─── The counts ────────────────────────────────────────────────────────────

export type Counts = { today: number; week: number; month: number };
export type Overview = {
  generatedAt: string;
  accounts: { total: number; byRole: Record<PersonRole, number>; off: number; unconfirmed: number };
  newAccounts: { all: Counts; todo: Counts };
  active: { now: number; all: Counts; todo: Counts };
  plans: { paid: number; monthly: number; yearly: number; trials: number; gifts: number; vip: number; pastDue: number; canceling: number; todoFree: number; todoTotal: number };
  money: { available: boolean; mode: "live" | "test" | "unset"; collectedCents: number; refundedCents: number; todoCollectedCents: number; monthlyRecurringCents: number; payments: number; truncated: boolean; note: string };
};

export function emptyCounts(): Counts { return { today: 0, week: 0, month: 0 }; }
const ZERO_ROLES = (): Record<PersonRole, number> => ({ student: 0, teacher: 0, parent: 0, todo: 0 });

/** What a month of the paying To-Do plans adds up to: a yearly plan counts a twelfth. */
export function monthlyRecurringCents(people: Pick<Person, "plan">[], infoOf: (p: Pick<Person, "plan">) => PlanInfo | null): number {
  let cents = 0;
  for (const p of people) {
    if (p.plan.tier !== "paid" || p.plan.canceling) continue;
    const info = infoOf(p);
    if (!info || info.source !== "stripe") continue;
    if (info.kind === "todo_unlimited") cents += UNLIMITED_MONTHLY_CENTS;
    else if (info.kind === "todo_unlimited_year") cents += Math.round(UNLIMITED_YEARLY_CENTS / 12);
  }
  return cents;
}
export { ZERO_ROLES };
