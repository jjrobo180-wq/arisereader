// The add-ons card: Arise History, Arise Math, A.R.I.S.E. Connect and Arise LifeHub.
// It shows each person what they have and the right way to get it: parents buy the Learning
// Bundle (all three) for the family, teachers add each app for their class on top of the
// Class plan, and students are told to ask a grown-up. No part of the site has a free trial.
// Prices and rules live in shared/plans.ts.
// `compact` is the quiet version for a page that isn't about plans: every add-on together
// as one group of buttons (Arise WorkHub and LifeHub for teachers, then the three apps), with
// a price and the way to the plan page. Its buttons don't wait on the add-ons request, so a
// teacher can always reach them.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Calculator, CheckCircle2, CheckSquare, ClipboardList, Landmark, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

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
  const b = data.bundle;
  const btn = "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-black disabled:opacity-50";
  const primary = `${btn} bg-violet-700 text-white hover:bg-violet-800`;
  const ghost = `${btn} border border-slate-200 bg-white text-[#141b32] hover:border-violet-300 hover:bg-violet-50`;

  const apps: { id: AppId; href: string; label: string; sub: string; icon: typeof Landmark; tone: string }[] = [
    { id: "history", href: "/history/", label: "Arise History", sub: "True stories and quizzes", icon: Landmark, tone: "text-amber-600" },
    { id: "math", href: "/math/", label: "Arise Math", sub: "Practice that levels up", icon: Calculator, tone: "text-cyan-600" },
    { id: "social", href: "/social/", label: "A.R.I.S.E. Connect", sub: "Explore every career", icon: Users, tone: "text-violet-600" },
  ];

  let bundleAction: ReactNode = null;
  const ownPlanLive = !!b.plan?.live;
  if (role === "parent") {
    if (b.paidByYou) bundleAction = <button type="button" className={ghost} disabled={!!busy} onClick={() => go("bm", "/api/billing/addon-portal", { product: "bundle", returnPath })}>Manage billing</button>;
    else if (!ownPlanLive && b.via !== "child-in-class") bundleAction = <button type="button" className={primary} disabled={!!busy || !data.payment} onClick={() => go("b", "/api/billing/addon-checkout", { product: "bundle", returnPath })} data-testid="addons-buy-bundle">{busy === "b" ? "Opening…" : `Get it for the whole family · ${money(data.prices.familyBundleCents)}/month`}</button>;
  }
  const classPremium = role === "teacher" && !!data.premium;
  /** A teacher's row for one app: its price, whether it's on, and the button to add or manage it.
   * Math and History come free with the Class plan (server grants them via "class-plan", with no
   * separate paid grant) — only Social is still sold as its own add-on. `a.access` is the source of
   * truth for "on"; `a.plan?.live` only tells us whether there's a *separate paid* grant to manage. */
  const classRow = (id: AppId) => {
    const a = data.apps[id], app = apps.find((x) => x.id === id)!;
    const live = !!a.plan?.live;
    const includedFree = a.access && !live;
    let action: ReactNode;
    if (a.paidByYou && live) action = <button type="button" className={ghost} disabled={!!busy} onClick={() => go(`m-${id}`, "/api/billing/addon-portal", { product: id, returnPath })}>Manage</button>;
    else if (live || includedFree) action = <span className="text-xs font-bold text-emerald-700">{includedFree ? "Included" : "On"}</span>;
    else if (!classPremium) action = <a className={ghost} href="/#/billing">Get the Class plan first</a>;
    else action = <button type="button" className={primary} disabled={!!busy || !data.payment} onClick={() => go(id, "/api/billing/addon-checkout", { product: id, returnPath })} data-testid={`addons-buy-${id}`}>{busy === id ? "Opening…" : `Add · ${money(data.prices.classApps[id])}/mo`}</button>;
    return (
      <div key={id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid={`addons-class-${id}`}>
        <app.icon className={`h-6 w-6 shrink-0 ${app.tone}`} />
        <a href={app.href} className="min-w-0 flex-1 hover:underline">
          <span className="block text-sm font-black text-[#141b32]">{app.label} <span className="font-bold text-slate-500">{includedFree ? "· included with your Class plan" : `· ${money(data.prices.classApps[id])}/month`}</span></span>
          <span className="block text-xs text-slate-500">{includedFree ? "On, free with your Class plan" : live ? (a.oldBundle ? "On with your class bundle" : `On for your class${a.plan?.endsAt ? ` · renews ${day(a.plan.endsAt)}` : ""}`) : "Off"}</span>
        </a>
        {action}
      </div>
    );
  };

  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Add-ons" data-testid="addons-card">
      {(role === "parent" || role === "teacher") && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3" data-testid="addons-optional">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">Optional add-ons</p>
          <p className="mt-1 text-sm font-bold text-[#141b32]">{[freeLine(data), "Everything below is an extra you can add or skip, and is paid separately."].filter(Boolean).join(" ")}</p>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-600">{role === "teacher" ? "Class add-ons" : "Learning Bundle"}</p>
          <h2 className="mt-1 text-xl font-black text-[#141b32]">Arise History, Arise Math & A.R.I.S.E. Connect</h2>
          <p className="mt-1 text-sm text-slate-600">
            {role === "teacher" ? `Arise Math and Arise History are included free with your Class plan, for up to ${data.prices.classSeats} students. A.R.I.S.E. Connect is a separate monthly add-on. A.R.I.S.E. To-Do (Work and Life hubs) is free on every plan.`
              : role === "parent" ? `One plan covers you and every child you’ve linked: ${money(data.prices.familyBundleCents)}/month. If a child’s teacher adds all three for the class, we refund your unused days. A.R.I.S.E. To-Do (Work and Life hubs) is free on every plan.`
              : "Three more ways to learn and earn points, right next to your reading."}
          </p>
        </div>
      </div>

      {role === "teacher" ? (
        <div className="mt-4 space-y-2">{(["math", "history", "social"] as AppId[]).map(classRow)}</div>
      ) : (
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {apps.map((a) => (
          <a key={a.href} href={a.href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-violet-300 hover:bg-violet-50">
            <a.icon className={`h-6 w-6 shrink-0 ${a.tone}`} />
            <span className="min-w-0"><span className="block text-sm font-black text-[#141b32]">{a.label}</span><span className="block truncate text-xs text-slate-600">{a.sub}</span></span>
          </a>
        ))}
      </div>
      )}

      <div className="mt-4 space-y-3">
        {role !== "teacher" && b.access && b.via && REASON[b.via] && <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{REASON[b.via]}{b.endsAt && b.via !== "child-in-class" ? ` · renews ${day(b.endsAt)}` : ""}</p>}
        {!b.access && <p className="text-sm font-bold text-amber-700">{role === "teacher" ? "Add the ones your class uses." : "Not added yet."}</p>}
        {role === "student" && !b.access && <p className="text-sm text-slate-600">Ask a parent to add it for your family, or ask your teacher to add it for your class.</p>}
        {role === "teacher" && <p className="text-xs text-slate-500">Math and History are included for up to {data.prices.classSeats} students; you have {data.students ?? 0}. Add A.R.I.S.E. Connect for the same class. Families paying the {money(data.prices.familyBundleCents)} Learning Bundle get their unused days refunded once your class has all three covered.</p>}
        {role === "parent" && !!data.children?.length && (
          <div className="flex flex-wrap gap-2">{data.children.map((k) => <span key={k.id} className={`rounded-full border px-3 py-1 text-xs font-bold ${k.coveredByClass ? "border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{k.name}{k.coveredByClass ? " · covered by class" : ""}</span>)}</div>
        )}
        {role === "parent" && data.refund && data.refund.cents > 0 && <p className="text-sm text-emerald-700">Your children’s teachers now cover Arise History, Math and Social, so we cancelled your plan and refunded {money(data.refund.cents)} to your card on {day(data.refund.at)}.</p>}
        {bundleAction && <div className="flex flex-wrap gap-2">{bundleAction}</div>}
        {!data.payment && (role === "parent" || role === "teacher") && !ownPlanLive && <p className="text-xs text-slate-500">Online payment isn’t open yet.</p>}
      </div>

      {showTodo && (role === "parent" || role === "teacher") && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base font-black text-[#141b32]"><BookOpen className="h-4 w-4 text-emerald-600" />A.R.I.S.E. To-Do</p>
              <p className="text-sm text-slate-600">{role === "teacher" ? "Arise WorkHub and LifeHub: free for every teacher, no subscription." : "Lists, chores, the family calendar and more. Free for every parent."}</p>
            </div>
            <a className={ghost} href="/#/lifehub">Open LifeHub</a>
          </div>
          <div className="mt-3 space-y-3">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />Free on every plan. No charge, no subscription.</p>
          </div>
        </div>
      )}

      {note && <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-[#141b32]" role="status">{note}</p>}
    </section>
  );
}
