// The add-ons card: Arise History, Arise Math, Arise Social and A.R.I.S.E. To-Do.
// It shows each person what they have, a live countdown of their 30-day free trial, and the right
// way to keep it: parents buy the Learning Bundle (all three) for the family, teachers add each app
// for their class on top of the Class plan, and students are told to ask a grown-up.
// Prices and rules live in shared/plans.ts.
// `compact` is the quiet version for a page that isn't about plans: every add-on together
// as one group of buttons (Teacher Hub and To-Do for teachers, then the three apps), with
// where the free trial stands and the way to the plan page. Its buttons don't wait on the
// add-ons request, so a teacher can always reach them.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Calculator, CheckCircle2, CheckSquare, ClipboardList, Clock3, Landmark, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type Access = { access: boolean; via: string | null; endsAt: string | null; trialEndsAt: string | null; trialDaysLeft: number | null; plan: { live: boolean; endsAt: string | null } | null; paidByYou: boolean; oldBundle?: boolean };
type AppId = "math" | "history" | "social";
type Addons = {
  role: string; payment: boolean; trialDays: number;
  prices: { familyBundleCents: number; todoCents: number; hubCents: number; classSeats: number; classApps: Record<AppId, number> };
  apps: Record<AppId, Access>;
  bundle: Access; todo: Access;
  premium?: boolean; premiumVia?: string | null; premiumEndsAt?: string | null; students?: number; hub?: { access: boolean; via: string | null; endsAt: string | null };
  children?: { id: number; name: string; coveredByClass: boolean }[];
  refund?: { cents: number; toCard: boolean; at: string } | null;
};

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

/** Days, hours and minutes until a time, refreshed every half minute. */
function useCountdown(endsAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  const ms = Math.max(0, Date.parse(endsAt) - now);
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return { ms, d, h, m, text: d > 0 ? `${d} day${d === 1 ? "" : "s"}, ${h} hr` : `${h} hr, ${m} min` };
}

/** "?paid=cs_..." after Stripe sends someone back to a page other than the plan page. */
function paidParam(): string | null {
  const id = new URLSearchParams(window.location.search).get("paid");
  return id && /^cs_[A-Za-z0-9_]{8,200}$/.test(id) ? id : null;
}

function TrialMeter({ endsAt, total, label }: { endsAt: string; total: number; label: string }) {
  const c = useCountdown(endsAt);
  if (!c) return null;
  const pct = Math.min(100, Math.max(0, (c.ms / (total * 86_400_000)) * 100));
  return (
    <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-3" data-testid="trial-countdown">
      <div className="flex items-center justify-between gap-2 text-sm font-black">
        <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-amber-400" />{label}</span>
        <span className="tabular-nums text-amber-300">{c.text} left</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1.5 text-xs text-muted-foreground">Free until {day(endsAt)}. No card needed.</p>
    </div>
  );
}

const longDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");

/** What this person already has for free, said before any price is shown. */
function freeLine(data: Addons): string {
  if (data.role === "parent") return "Your parent account is always free: your child's progress, game limits and the proctor code never cost anything.";
  if (data.role !== "teacher") return "";
  const until = data.premiumEndsAt ? `, until ${longDay(data.premiumEndsAt)}` : "";
  if (data.premiumVia === "grandfathered") return `Reading with your class is free for you this school year${until}.`;
  if (data.premiumVia === "free-month") return `Your Class plan is on a 30-day free trial${until}.`;
  if (data.premiumVia === "teacher-plan" || data.premiumVia === "school-plan") return "Reading with your class is already covered by your plan.";
  return "";
}

const REASON: Record<string, string> = {
  "family-plan": "Included with your family’s plan",
  "class-plan": "On for your class",
  "child-in-class": "Included through your children’s class plans",
  "social-plan": "Included with your Arise Social plan",
  admin: "Included for admins",
  demo: "Included in this sample account",
  hub: "Included with Teacher Hub",
  "todo-plan": "Included with your To-Do plan",
};

export default function AddonsCard({ returnPath = "/billing", showTodo = true, compact = false }: { returnPath?: string; showTodo?: boolean; compact?: boolean }) {
  const { user, token } = useAuth();
  const [data, setData] = useState<Addons | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const confirmed = useRef(false);

  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "That didn't work. Please try again.");
    return body;
  };
  const load = () => call("/api/addons").then(setData).catch(() => setData(null));

  useEffect(() => {
    if (!token) return;
    const paid = paidParam();
    // The plan page confirms its own payments; everywhere else this card does.
    if (paid && !confirmed.current && !window.location.hash.startsWith("#/billing")) {
      confirmed.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("paid");
      window.history.replaceState(null, "", url.toString());
      call("/api/billing/confirm", { method: "POST", body: JSON.stringify({ sessionId: paid }) })
        .then(() => setNote("Payment received. Your add-on is on."))
        .catch(() => setNote("We couldn't confirm the payment yet. If your card was charged, it will switch on within a few minutes."))
        .finally(load);
    } else load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (what: string, path: string, body: unknown) => {
    setBusy(what); setNote("");
    try {
      const r = await call(path, { method: "POST", body: JSON.stringify(body) });
      if (typeof r.url === "string" && r.url.startsWith("https://")) { window.location.href = r.url; return; }
    } catch (e: any) { setNote(e.message); }
    setBusy("");
  };

  if (compact) {
    if (!user) return null;
    const teacher = user.role === "teacher" || !!user.isAdmin;
    const tiles = [
      ...(teacher ? [{ href: "/#/teacher-hub", label: "Teacher Hub", icon: ClipboardList, tone: "text-teal-300", testId: "button-teacher-hub" }] : []),
      ...(user.role !== "student" ? [{ href: "/#/to-do", label: "To-Do", icon: CheckSquare, tone: "text-emerald-400", testId: "button-teacher-todo" }] : []),
      { href: "/history/", label: "Arise History", icon: Landmark, tone: "text-amber-400", testId: "button-teacher-history" },
      { href: "/math/", label: "Arise Math", icon: Calculator, tone: "text-cyan-400", testId: "button-teacher-math" },
      { href: "/social/", label: "Arise Social", icon: Users, tone: "text-violet-400", testId: "button-teacher-social" },
    ];
    const bundle = data?.bundle;
    const days = bundle?.trialDaysLeft;
    const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
    // A teacher on the 30-day Class trial sees that countdown first.
    const classDays = data?.role === "teacher" && data.premiumVia === "free-month" && data.premiumEndsAt
      ? Math.max(0, Math.ceil((Date.parse(data.premiumEndsAt) - Date.now()) / 86_400_000)) : null;
    const status = classDays != null ? `Free trial: ${plural(classDays)} left`
      : !bundle ? ""
      : bundle.via === "trial" && days != null ? `Free trial: ${plural(days)} left`
      : !bundle.access ? "Free trial ended" : "";
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[.03] p-3 sm:p-4" aria-label="Add-ons" data-testid="addons-group">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
          <h2 className="text-[11px] font-black uppercase tracking-[.2em] text-muted-foreground">Add-ons</h2>
          <p className="text-xs text-muted-foreground">
            {status}
            {!user.isAdmin && <>{status && " · "}<a href="/#/billing" className="font-bold text-violet-300 underline-offset-4 hover:underline">Prices</a></>}
          </p>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t, i) => (
            <a key={t.href} href={t.href} data-testid={t.testId}
              className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-foreground hover:bg-white/10 ${i === 0 && tiles.length % 2 ? "col-span-2 sm:col-span-1" : ""}`}>
              <t.icon className={`h-5 w-5 shrink-0 ${t.tone}`} />
              <span className="truncate">{t.label}</span>
            </a>
          ))}
        </div>
        {note && <p className="mt-3 px-1 text-sm text-muted-foreground" role="status">{note}</p>}
      </section>
    );
  }

  if (!user || !data) return null;
  const role = data.role;
  const b = data.bundle, t = data.todo;
  const btn = "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-black disabled:opacity-50";
  const primary = `${btn} arise-gradient-button text-white`;
  const ghost = `${btn} border border-white/15 bg-white/5 hover:bg-white/10`;

  const apps: { id: AppId; href: string; label: string; sub: string; icon: typeof Landmark; tone: string }[] = [
    { id: "history", href: "/history/", label: "Arise History", sub: "True stories and quizzes", icon: Landmark, tone: "text-amber-400" },
    { id: "math", href: "/math/", label: "Arise Math", sub: "Practice that levels up", icon: Calculator, tone: "text-cyan-400" },
    { id: "social", href: "/social/", label: "Arise Social", sub: "Explore every career", icon: Users, tone: "text-violet-400" },
  ];

  let bundleAction: ReactNode = null;
  const ownPlanLive = !!b.plan?.live;
  if (role === "parent") {
    if (b.paidByYou) bundleAction = <button type="button" className={ghost} disabled={!!busy} onClick={() => go("bm", "/api/billing/addon-portal", { product: "bundle", returnPath })}>Manage billing</button>;
    else if (!ownPlanLive && b.via !== "child-in-class") bundleAction = <button type="button" className={primary} disabled={!!busy || !data.payment} onClick={() => go("b", "/api/billing/addon-checkout", { product: "bundle", returnPath })} data-testid="addons-buy-bundle">{busy === "b" ? "Opening…" : `${b.via === "trial" ? "Keep it" : "Get it"} for the whole family · ${money(data.prices.familyBundleCents)}/month`}</button>;
  }
  const classPremium = role === "teacher" && !!data.premium;
  /** A teacher's row for one app: its price, whether it's on, and the button to add or manage it. */
  const classRow = (id: AppId) => {
    const a = data.apps[id], app = apps.find((x) => x.id === id)!;
    const live = !!a.plan?.live;
    let action: ReactNode;
    if (a.paidByYou && live) action = <button type="button" className={ghost} disabled={!!busy} onClick={() => go(`m-${id}`, "/api/billing/addon-portal", { product: id, returnPath })}>Manage</button>;
    else if (live) action = <span className="text-xs font-bold text-emerald-300">On</span>;
    else if (!classPremium) action = <a className={ghost} href="/#/billing">Get the Class plan first</a>;
    else action = <button type="button" className={primary} disabled={!!busy || !data.payment} onClick={() => go(id, "/api/billing/addon-checkout", { product: id, returnPath })} data-testid={`addons-buy-${id}`}>{busy === id ? "Opening…" : `${a.via === "trial" ? "Keep" : "Add"} · ${money(data.prices.classApps[id])}/mo`}</button>;
    return (
      <div key={id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3" data-testid={`addons-class-${id}`}>
        <app.icon className={`h-6 w-6 shrink-0 ${app.tone}`} />
        <a href={app.href} className="min-w-0 flex-1 hover:underline">
          <span className="block text-sm font-black">{app.label} <span className="font-bold text-muted-foreground">· {money(data.prices.classApps[id])}/month</span></span>
          <span className="block text-xs text-muted-foreground">{live ? (a.oldBundle ? "On with your class bundle" : `On for your class${a.plan?.endsAt ? ` · renews ${day(a.plan.endsAt)}` : ""}`) : a.via === "trial" ? "On during your free trial" : "Off"}</span>
        </a>
        {action}
      </div>
    );
  };

  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-[#1b1638] via-[#151326] to-[#10202a] p-5 sm:p-6" aria-label="Add-ons" data-testid="addons-card">
      {(role === "parent" || role === "teacher") && (
        <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3" data-testid="addons-optional">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Optional add-ons</p>
          <p className="mt-1 text-sm font-bold text-foreground">{[freeLine(data), "Everything below is an extra you can add or skip, and is paid separately."].filter(Boolean).join(" ")}</p>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">{role === "teacher" ? "Class add-ons" : "Learning Bundle"}</p>
          <h2 className="mt-1 text-xl font-black">Arise History, Arise Math & Arise Social</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === "teacher" ? `Add any of them for your whole class (up to ${data.prices.classSeats} students), on top of the Class plan. Each is its own monthly add-on.`
              : role === "parent" ? `One plan covers you and every child you’ve linked: ${money(data.prices.familyBundleCents)}/month. If a child’s teacher adds all three for the class, we refund your unused days.`
              : "Three more ways to learn and earn points, right next to your reading."}
          </p>
        </div>
      </div>

      {role === "teacher" ? (
        <div className="mt-4 space-y-2">{(["math", "history", "social"] as AppId[]).map(classRow)}</div>
      ) : (
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {apps.map((a) => (
          <a key={a.href} href={a.href} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10">
            <a.icon className={`h-6 w-6 shrink-0 ${a.tone}`} />
            <span className="min-w-0"><span className="block text-sm font-black">{a.label}</span><span className="block truncate text-xs text-muted-foreground">{a.sub}</span></span>
          </a>
        ))}
      </div>
      )}

      <div className="mt-4 space-y-3">
        {role === "teacher" && data.premiumVia === "free-month" && data.premiumEndsAt && <TrialMeter endsAt={data.premiumEndsAt} total={data.trialDays} label="Class plan free trial" />}
        {b.via === "trial" && b.trialEndsAt && <TrialMeter endsAt={b.trialEndsAt} total={data.trialDays} label={role === "teacher" ? "History, Math & Social free trial" : "Your free trial"} />}
        {role !== "teacher" && b.access && b.via && b.via !== "trial" && REASON[b.via] && <p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4" />{REASON[b.via]}{b.endsAt && b.via !== "child-in-class" ? ` · renews ${day(b.endsAt)}` : ""}</p>}
        {!b.access && <p className="text-sm font-bold text-amber-300">{role === "teacher" ? "Your free trial of History, Math and Social has ended. Add the ones your class uses." : "Your free trial has ended."}</p>}
        {role === "student" && (!b.access || b.via === "trial") && <p className="text-sm text-muted-foreground">To keep it after your trial, ask a parent to add it for your family, or ask your teacher to add it for your class.</p>}
        {role === "teacher" && <p className="text-xs text-muted-foreground">Each add-on covers up to {data.prices.classSeats} students; you have {data.students ?? 0}. Families paying the {money(data.prices.familyBundleCents)} Learning Bundle get their unused days refunded once your class has all three.</p>}
        {role === "parent" && !!data.children?.length && (
          <div className="flex flex-wrap gap-2">{data.children.map((k) => <span key={k.id} className={`rounded-full border px-3 py-1 text-xs font-bold ${k.coveredByClass ? "border-emerald-400/40 text-emerald-300" : "border-white/15 text-muted-foreground"}`}>{k.name}{k.coveredByClass ? " · covered by class" : ""}</span>)}</div>
        )}
        {role === "parent" && data.refund && data.refund.cents > 0 && <p className="text-sm text-emerald-300">Your children’s teachers now cover Arise History, Math and Social, so we cancelled your plan and refunded {money(data.refund.cents)} to your card on {day(data.refund.at)}.</p>}
        {bundleAction && <div className="flex flex-wrap gap-2">{bundleAction}</div>}
        {!data.payment && (role === "parent" || role === "teacher") && !ownPlanLive && <p className="text-xs text-muted-foreground">Online payment isn’t open yet. Your free days still count down.</p>}
      </div>

      {showTodo && (role === "parent" || role === "teacher") && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base font-black"><BookOpen className="h-4 w-4 text-emerald-400" />A.R.I.S.E. To-Do</p>
              <p className="text-sm text-muted-foreground">{role === "teacher" ? "Comes with Teacher Hub: one subscription, both tools." : `Lists, chores, the family calendar and more: ${money(data.prices.todoCents)}/month after your free trial.`}</p>
            </div>
            <a className={ghost} href="/#/to-do">Open To-Do</a>
          </div>
          <div className="mt-3 space-y-3">
            {t.via === "trial" && t.trialEndsAt && <TrialMeter endsAt={t.trialEndsAt} total={data.trialDays} label="To-Do free trial" />}
            {role === "teacher" && data.hub?.via === "free-month" && data.hub.endsAt && <TrialMeter endsAt={data.hub.endsAt} total={data.trialDays} label="Teacher Hub & To-Do free trial" />}
            {t.access && t.via && t.via !== "trial" && REASON[t.via] && !(role === "teacher" && data.hub?.via === "free-month") && <p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4" />{REASON[t.via]}</p>}
            {!t.access && <p className="text-sm font-bold text-amber-300">{role === "teacher" ? "Get Teacher Hub to keep using To-Do." : "Your To-Do free trial has ended."}</p>}
            <div className="flex flex-wrap gap-2">
              {role === "parent" && (t.paidByYou
                ? <button type="button" className={ghost} disabled={!!busy} onClick={() => go("tm", "/api/billing/addon-portal", { product: "todo", returnPath })}>Manage To-Do billing</button>
                : !t.plan?.live && <button type="button" className={primary} disabled={!!busy || !data.payment} onClick={() => go("t", "/api/billing/addon-checkout", { product: "todo", returnPath })} data-testid="addons-buy-todo">{busy === "t" ? "Opening…" : `${t.via === "trial" ? "Keep" : "Get"} To-Do · ${money(data.prices.todoCents)}/month`}</button>)}
              {role === "teacher" && data.hub?.via !== "hub-teacher-plan" && data.hub?.via !== "hub-school-plan" && <a className={ghost} href="/#/billing">Teacher Hub: {money(data.prices.hubCents)}/month</a>}
            </div>
          </div>
        </div>
      )}

      {note && <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm" role="status">{note}</p>}
    </section>
  );
}
