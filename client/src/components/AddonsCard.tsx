// The add-ons card: Arise History, Arise Math, A.R.I.S.E. Connect and Arise LifeHub.
// It shows each person what they have and the right way to get it: parents buy the Learning
// Bundle (all three) for the family; a teacher's Class plan already includes all three for
// their class, so for a teacher this card is a "what's included" display, not something to
// buy from. Students are told to ask a grown-up. No part of the site has a free trial.
// Prices and rules live in shared/plans.ts.
// `compact` is the quiet version for a page that isn't about plans: every add-on together
// as one group of buttons (Arise WorkHub and LifeHub for teachers, then the three apps), with
// a price and the way to the plan page. Its buttons don't wait on the add-ons request, so a
// teacher can always reach them.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Calculator, CheckCircle2, CheckSquare, ClipboardList, Landmark, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { appHref } from "@/lib/hubs";
import { NATIVE_NO_PURCHASE, isNativeApp } from "@/lib/nativeApp";

type Access = { access: boolean; via: string | null; endsAt: string | null; plan: { live: boolean; endsAt: string | null } | null; paidByYou: boolean; oldBundle?: boolean };
type AppId = "math" | "history" | "social";
type Addons = {
  role: string; payment: boolean;
  prices: { familyBundleCents: number; todoCents: number; hubCents: number; classSeats: number; classApps: Record<AppId, number> };
  apps: Record<AppId, Access>;
  bundle: Access; todo: Access;
  premium?: boolean; premiumVia?: string | null; premiumEndsAt?: string | null; students?: number; hub?: { access: boolean; via: string | null; endsAt: string | null };
  children?: { id: number; name: string; coveredByClass: boolean }[];
  refund?: { cents: number; toCard: boolean; at: string } | null;
};

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

/** "?paid=cs_..." after Stripe sends someone back to a page other than the plan page. */
function paidParam(): string | null {
  const id = new URLSearchParams(window.location.search).get("paid");
  return id && /^cs_[A-Za-z0-9_]{8,200}$/.test(id) ? id : null;
}

const longDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");

/** What this person already has for free, said before any price is shown. */
function freeLine(data: Addons): string {
  if (data.role === "parent") return "Your parent account is always free: your child's progress, game limits and the proctor code never cost anything.";
  if (data.role !== "teacher") return "";
  const until = data.premiumEndsAt ? `, until ${longDay(data.premiumEndsAt)}` : "";
  if (data.premiumVia === "grandfathered") return `Reading with your class is free for you this school year${until}.`;
  if (data.premiumVia === "teacher-plan" || data.premiumVia === "school-plan") return "Reading with your class is already covered by your plan.";
  return "";
}

const REASON: Record<string, string> = {
  "family-plan": "Included with your family’s plan",
  "class-plan": "On for your class",
  "child-in-class": "Included through your children’s class plans",
  "social-plan": "Included with your A.R.I.S.E. Connect plan",
  admin: "Included for admins",
  demo: "Included in this sample account",
  hub: "Included with Arise WorkHub",
  "todo-plan": "Included with your LifeHub plan",
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
      ...(teacher ? [{ href: "/#/workhub", label: "Arise WorkHub", icon: ClipboardList, tone: "text-teal-300", testId: "button-teacher-hub" }] : []),
      ...(user.role !== "student" ? [{ href: "/#/lifehub", label: "LifeHub", icon: CheckSquare, tone: "text-emerald-400", testId: "button-teacher-todo" }] : []),
      { href: "/history/", label: "Arise History", icon: Landmark, tone: "text-amber-400", testId: "button-teacher-history" },
      { href: "/math/", label: "Arise Math", icon: Calculator, tone: "text-cyan-400", testId: "button-teacher-math" },
      { href: "/social/", label: "A.R.I.S.E. Connect", icon: Users, tone: "text-violet-400", testId: "button-teacher-social" },
    ];
    const bundle = data?.bundle;
    const status = !bundle || bundle.access ? "" : "Not added";
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[.03] p-3 sm:p-4" aria-label="Add-ons" data-testid="addons-group">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
          <h2 className="text-[11px] font-black uppercase tracking-[.2em] text-muted-foreground">Add-ons</h2>
          <p className="text-xs text-muted-foreground">
            {status}
            {!user.isAdmin && !isNativeApp() && <>{status && " · "}<a href={appHref("/billing")} className="font-bold text-violet-300 underline-offset-4 hover:underline">Prices</a></>}
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
  const b = data.bundle;
  const btn = "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-black disabled:opacity-50";
  const primary = `${btn} bg-violet-700 text-white hover:bg-violet-800`;
  const ghost = `${btn} border border-slate-200 bg-white text-[#141b32] hover:border-violet-300 hover:bg-violet-50`;

  const apps: { id: AppId; href: string; label: string; sub: string; icon: typeof Landmark; tone: string }[] = [
    { id: "history", href: "/history/", label: "Arise History", sub: "True stories and quizzes", icon: Landmark, tone: "text-amber-600" },
    { id: "math", href: "/math/", label: "Arise Math", sub: "Practice that levels up", icon: Calculator, tone: "text-cyan-600" },
    { id: "social", href: "/social/", label: "A.R.I.S.E. Connect", sub: "Explore every career", icon: Users, tone: "text-violet-600" },
  ];

  // Students: one slim strip on the library page — the three apps as small links and one line on how to get them.
  if (role === "student") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4" aria-label="Learning Bundle" data-testid="addons-card">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-sm font-black text-[#141b32]">Learning Bundle</h2>
          <div className="flex flex-wrap gap-1.5">
            {apps.map((a) => (
              <a key={a.href} href={a.href} title={a.sub} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-[#141b32] hover:border-violet-300 hover:bg-violet-50">
                <a.icon className={`h-4 w-4 shrink-0 ${a.tone}`} />{a.label}
              </a>
            ))}
          </div>
          <p className="basis-full text-xs text-slate-600 sm:basis-auto sm:ml-auto">
            {b.access
              ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{(b.via && REASON[b.via]) || "On for you"}</span>
              : <><span className="font-bold text-amber-700">Not added yet.</span> Ask a parent or your teacher to add it.</>}
          </p>
        </div>
        {note && <p className="mt-2 text-xs text-slate-600" role="status">{note}</p>}
      </section>
    );
  }

  // In the iPhone app: what's on the account, with no prices or buttons to buy (App Review 3.1.1).
  if (isNativeApp()) return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Add-ons" data-testid="addons-card">
      <h2 className="text-lg font-black text-[#141b32]">Add-ons</h2>
      <p className="mt-1 text-sm text-slate-600">{NATIVE_NO_PURCHASE}</p>
      <div className="mt-3 space-y-2">{apps.map((app) => {
        const on = !!data.apps[app.id]?.access;
        return <a key={app.id} href={app.href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid={`addons-native-${app.id}`}>
          <app.icon className={`h-6 w-6 shrink-0 ${app.tone}`} />
          <span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#141b32]">{app.label}</span><span className="block text-xs text-slate-500">{on ? "On for your account" : "Not on this account"}</span></span>
        </a>;
      })}</div>
    </section>
  );

  let bundleAction: ReactNode = null;
  const ownPlanLive = !!b.plan?.live;
  if (role === "parent") {
    if (b.paidByYou) bundleAction = <button type="button" className={ghost} disabled={!!busy} onClick={() => go("bm", "/api/billing/addon-portal", { product: "bundle", returnPath })}>Manage billing</button>;
    else if (!ownPlanLive && b.via !== "child-in-class") bundleAction = <button type="button" className={primary} disabled={!!busy || !data.payment} onClick={() => go("b", "/api/billing/addon-checkout", { product: "bundle", returnPath })} data-testid="addons-buy-bundle">{busy === "b" ? "Opening…" : `Get it for the whole family · ${money(data.prices.familyBundleCents)}/month`}</button>;
  }
  /** A teacher's row for one app: the Class plan now includes Math, History and Connect
   * together for every student it covers — there is nothing left to buy per app, so this
   * is a plain "what's included" row, not an add/manage control. `a.access` is still the
   * source of truth for whether it's really on (handles admin/demo/grandfathered too). */
  const classRow = (id: AppId) => {
    const a = data.apps[id], app = apps.find((x) => x.id === id)!;
    return (
      <div key={id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid={`addons-class-${id}`}>
        <app.icon className={`h-6 w-6 shrink-0 ${app.tone}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-[#141b32]">{app.label}</span>
          <span className="block text-xs text-slate-500">{a.access ? "Included with your Class plan" : "Included once you get the Class plan"}</span>
        </span>
        {a.access
          ? <span className="text-xs font-bold text-emerald-700">Included</span>
          : <a className={ghost} href={appHref("/billing")}>Get the Class plan</a>}
      </div>
    );
  };
  /** Arise To Duo as one more checklist row, matching classRow/apps styling — it's always
   * free, so it's never a separate titled section, just another included line item. */
  const todoRow = () => (
    <div key="todo" className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="addons-todo-row">
      <BookOpen className="h-6 w-6 shrink-0 text-emerald-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[#141b32]">Arise To Duo</span>
        <span className="block text-xs text-slate-500">{role === "teacher" ? "Work and Life hubs — free on every plan" : "Lists, chores, the family calendar and more — free for every parent"}</span>
      </span>
      <span className="text-xs font-bold text-emerald-700">Free</span>
      <a className={ghost} href="/#/lifehub">Open LifeHub</a>
    </div>
  );

  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Add-ons" data-testid="addons-card">
      {role === "parent" && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3" data-testid="addons-optional">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">Optional add-on</p>
          <p className="mt-1 text-sm font-bold text-[#141b32]">{[freeLine(data), "This is an extra you can add or skip, and is paid separately."].filter(Boolean).join(" ")}</p>
        </div>
      )}
      {role === "teacher" && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3" data-testid="addons-optional">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">Included with your Class plan</p>
          <p className="mt-1 text-sm font-bold text-[#141b32]">Nothing extra to buy — your Class plan covers all three.</p>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-600">{role === "teacher" ? "Included with your Class plan" : "Learning Bundle"}</p>
          <h2 className="mt-1 text-xl font-black text-[#141b32]">Arise History, Arise Math & A.R.I.S.E. Connect</h2>
          <p className="mt-1 text-sm text-slate-600">
            {role === "teacher" ? `One price covers everything: Reader, Math, History and Connect are all included in your Class plan, for up to ${data.prices.classSeats} students. Arise To Duo (Work and Life hubs) is free on every plan.`
              : role === "parent" ? `One plan covers you and every child you’ve linked: ${money(data.prices.familyBundleCents)}/month. If a child’s teacher's Class plan already covers them, we refund your unused days. Arise To Duo (Work and Life hubs) is free on every plan.`
              : "Three more ways to learn and earn points, right next to your reading."}
          </p>
        </div>
      </div>

      {role === "teacher" ? (
        <div className="mt-4 space-y-2">
          {(["math", "history", "social"] as AppId[]).map(classRow)}
          {showTodo && todoRow()}
        </div>
      ) : (
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {apps.map((a) => (
          <a key={a.href} href={a.href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-violet-300 hover:bg-violet-50">
            <a.icon className={`h-6 w-6 shrink-0 ${a.tone}`} />
            <span className="min-w-0"><span className="block text-sm font-black text-[#141b32]">{a.label}</span><span className="block truncate text-xs text-slate-600">{a.sub}</span></span>
          </a>
        ))}
        {showTodo && role === "parent" && (
          <a href="/#/lifehub" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-violet-300 hover:bg-violet-50">
            <BookOpen className="h-6 w-6 shrink-0 text-emerald-600" />
            <span className="min-w-0"><span className="block text-sm font-black text-[#141b32]">Arise To Duo</span><span className="block truncate text-xs text-slate-600">Free on every plan</span></span>
          </a>
        )}
      </div>
      )}

      <div className="mt-4 space-y-3">
        {role !== "teacher" && b.access && b.via && REASON[b.via] && <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{REASON[b.via]}{b.endsAt && b.via !== "child-in-class" ? ` · renews ${day(b.endsAt)}` : ""}</p>}
        {!b.access && <p className="text-sm font-bold text-amber-700">{role === "teacher" ? "Get the Class plan to turn these on." : "Not added yet."}</p>}
        {role === "student" && !b.access && <p className="text-sm text-slate-600">Ask a parent to add it for your family, or ask your teacher to get the Class plan.</p>}
        {role === "teacher" && <p className="text-xs text-slate-500">Covers up to {data.prices.classSeats} students; you have {data.students ?? 0}. Families paying the {money(data.prices.familyBundleCents)} Learning Bundle get their unused days refunded once your class covers all three.</p>}
        {role === "parent" && !!data.children?.length && (
          <div className="flex flex-wrap gap-2">{data.children.map((k) => <span key={k.id} className={`rounded-full border px-3 py-1 text-xs font-bold ${k.coveredByClass ? "border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{k.name}{k.coveredByClass ? " · covered by class" : ""}</span>)}</div>
        )}
        {role === "parent" && data.refund && data.refund.cents > 0 && <p className="text-sm text-emerald-700">Your children’s Class plans now cover Arise History, Arise Math and A.R.I.S.E. Connect, so we cancelled your Learning Bundle and refunded {money(data.refund.cents)} to your card on {day(data.refund.at)}.</p>}
        {bundleAction && <div className="flex flex-wrap gap-2">{bundleAction}</div>}
        {!data.payment && (role === "parent" || role === "teacher") && !ownPlanLive && <p className="text-xs text-slate-500">Online payment isn’t open yet.</p>}
      </div>

      {note && <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-[#141b32]" role="status">{note}</p>}
    </section>
  );
}
