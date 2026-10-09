// Add-ons (Arise History, Math and Social, and Arise LifeHub) built from the hub's own parts.
// Same rules and buttons as the site's add-ons card (components/AddonsCard.tsx): what's free,
// the free-trial countdowns, the family Learning Bundle or a teacher's class add-ons, LifeHub.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Calculator, CheckCircle2, CheckSquare, Clock3, Landmark, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Meter, Pill, fmtDay, kit, type Which } from "./kit";

type Access = { access: boolean; via: string | null; endsAt: string | null; trialEndsAt: string | null; trialDaysLeft: number | null; plan: { live: boolean; endsAt: string | null } | null; paidByYou: boolean; oldBundle?: boolean };
type AppId = "math" | "history" | "social";
type Addons = {
  role: string; payment: boolean; trialDays: number;
  prices: { familyBundleCents: number; todoCents: number; hubCents: number; classSeats: number; classApps: Record<AppId, number> };
  apps: Record<AppId, Access>; bundle: Access; todo: Access;
  premium?: boolean; premiumVia?: string | null; premiumEndsAt?: string | null; students?: number; hub?: { access: boolean; via: string | null; endsAt: string | null };
  children?: { id: number; name: string; coveredByClass: boolean }[];
  refund?: { cents: number; toCard: boolean; at: string } | null;
};
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const longDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
const REASON: Record<string, string> = {
  "family-plan": "Included with your family's plan", "class-plan": "On for your class", "child-in-class": "Included through your children's class plans",
  "social-plan": "Included with your Arise Social plan", admin: "Included for admins", demo: "Included in this sample account", hub: "Included with Arise WorkHub", "todo-plan": "Included with your LifeHub plan",
};
const APPS: { id: AppId; href: string; label: string; sub: string; icon: typeof Landmark }[] = [
  { id: "history", href: "/history/", label: "Arise History", sub: "True stories and quizzes", icon: Landmark },
  { id: "math", href: "/math/", label: "Arise Math", sub: "Practice that levels up", icon: Calculator },
  { id: "social", href: "/social/", label: "Arise Social", sub: "Explore every career", icon: Users },
];

function useCountdown(endsAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!endsAt) return; const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, [endsAt]);
  if (!endsAt) return null;
  const ms = Math.max(0, Date.parse(endsAt) - now);
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return { ms, text: d > 0 ? `${d} day${d === 1 ? "" : "s"}, ${h} hr` : `${h} hr, ${m} min` };
}

function Trial({ which, endsAt, total, label }: { which: Which; endsAt: string; total: number; label: string }) {
  const k = kit(which), c = useCountdown(endsAt);
  if (!c) return null;
  return <div className={k.rowWarn} data-testid="trial-countdown">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 font-semibold text-amber-950"><Clock3 className="h-4 w-4 text-amber-600" />{label}</span>
      <span className="font-semibold tabular-nums text-amber-900">{c.text} left</span>
    </div>
    <div className="mt-2"><Meter which={which} value={c.ms} max={total * 86_400_000} warn /></div>
    <p className="mt-1.5 text-xs text-amber-900">Free until {fmtDay(endsAt)}. No card needed.</p>
  </div>;
}

export default function HubAddons({ which, returnPath = "/billing", showLifeHub = true }: { which: Which; returnPath?: string; showLifeHub?: boolean }) {
  const { user, token } = useAuth();
  const k = kit(which);
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
    const id = new URLSearchParams(window.location.search).get("paid");
    const paid = id && /^cs_[A-Za-z0-9_]{8,200}$/.test(id) ? id : null;
    if (paid && !confirmed.current && !window.location.hash.startsWith("#/billing")) {
      confirmed.current = true;
      const url = new URL(window.location.href); url.searchParams.delete("paid"); window.history.replaceState(null, "", url.toString());
      call("/api/billing/confirm", { method: "POST", body: JSON.stringify({ sessionId: paid }) })
        .then(() => setNote("Payment received. Your add-on is on."))
        .catch(() => setNote("We couldn't confirm the payment yet. If your card was charged, it will switch on within a few minutes."))
        .finally(load);
    } else load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (what: string, path: string, body: unknown) => {
    setBusy(what); setNote("");
    try { const r = await call(path, { method: "POST", body: JSON.stringify(body) }); if (typeof r.url === "string" && r.url.startsWith("https://")) { window.location.href = r.url; return; } }
    catch (e: any) { setNote(e.message); }
    setBusy("");
  };

  if (!user) return null;
  if (!data) return <p className={k.small}>Loading add-ons…</p>;
  const role = data.role, b = data.bundle, t = data.todo, teacher = role === "teacher";

  const free = role === "parent" ? "Your parent account is always free: your child's progress, game limits and the proctor code never cost anything."
    : teacher && data.premiumVia === "grandfathered" ? `Reading with your class is free for you this school year${data.premiumEndsAt ? `, until ${longDay(data.premiumEndsAt)}` : ""}.`
    : teacher && data.premiumVia === "free-month" ? `Your Class plan is on a 30-day free trial${data.premiumEndsAt ? `, until ${longDay(data.premiumEndsAt)}` : ""}.`
    : teacher && (data.premiumVia === "teacher-plan" || data.premiumVia === "school-plan") ? "Reading with your class is already covered by your plan." : "";

  let bundleAction: ReactNode = null;
  if (role === "parent") {
    if (b.paidByYou) bundleAction = <button type="button" className={k.ghost} disabled={!!busy} onClick={() => go("bm", "/api/billing/addon-portal", { product: "bundle", returnPath })}>Manage billing</button>;
    else if (!b.plan?.live && b.via !== "child-in-class") bundleAction = <button type="button" className={k.primary} disabled={!!busy || !data.payment} onClick={() => go("b", "/api/billing/addon-checkout", { product: "bundle", returnPath })} data-testid="addons-buy-bundle">{busy === "b" ? "Opening…" : `${b.via === "trial" ? "Keep it" : "Get it"} for the whole family · ${money(data.prices.familyBundleCents)}/month`}</button>;
  }

  return <div className="space-y-4" data-testid="hub-addons">
    {(role === "parent" || teacher) && <p className={k.text}>{[free, "Everything here is optional and paid separately."].filter(Boolean).join(" ")}</p>}

    <div>
      <p className={k.eyebrow}>{teacher ? "Class add-ons" : "Learning Bundle"}</p>
      <p className={`mt-1 ${k.text}`}>{teacher ? `Add any of them for your whole class (up to ${data.prices.classSeats} students), on top of the Class plan. Each is its own monthly add-on.`
        : role === "parent" ? `One plan covers you and every child you've linked: ${money(data.prices.familyBundleCents)}/month. If a child's teacher adds all three for the class, we refund your unused days.`
        : "Three more ways to learn and earn points, right next to your reading."}</p>
    </div>

    <ul className="space-y-2">{APPS.map((app) => {
      const a = data.apps[app.id], live = !!a.plan?.live, Icon = app.icon;
      let right: ReactNode = null;
      if (teacher) {
        if (a.paidByYou && live) right = <button type="button" className={k.ghost} disabled={!!busy} onClick={() => go(`m-${app.id}`, "/api/billing/addon-portal", { product: app.id, returnPath })}>Manage</button>;
        else if (live) right = <Pill which={which} tone="green">On</Pill>;
        else if (!data.premium) right = <a className={k.ghost} href="/#/billing">Get the Class plan first</a>;
        else right = <button type="button" className={k.primary} disabled={!!busy || !data.payment} onClick={() => go(app.id, "/api/billing/addon-checkout", { product: app.id, returnPath })} data-testid={`addons-buy-${app.id}`}>{busy === app.id ? "Opening…" : `${a.via === "trial" ? "Keep" : "Add"} · ${money(data.prices.classApps[app.id])}/mo`}</button>;
      }
      const status = teacher ? (live ? (a.oldBundle ? "On with your class bundle" : `On for your class${a.plan?.endsAt ? ` · renews ${fmtDay(a.plan.endsAt)}` : ""}`) : a.via === "trial" ? "On during your free trial" : "Off") : app.sub;
      return <li key={app.id} className={`${k.row} flex flex-wrap items-center gap-3`} data-testid={`addons-${teacher ? "class" : "app"}-${app.id}`}>
        <span className={k.tile}><Icon className="h-5 w-5" /></span>
        <a href={app.href} className="min-w-0 flex-1 hover:underline"><span className={`block ${k.h}`}>{app.label}{teacher ? <span className="font-normal text-slate-500"> · {money(data.prices.classApps[app.id])}/month</span> : null}</span><span className={`block ${k.small}`}>{status}</span></a>
        {right}
      </li>;
    })}</ul>

    <div className="space-y-3">
      {teacher && data.premiumVia === "free-month" && data.premiumEndsAt && <Trial which={which} endsAt={data.premiumEndsAt} total={data.trialDays} label="Class plan free trial" />}
      {b.via === "trial" && b.trialEndsAt && <Trial which={which} endsAt={b.trialEndsAt} total={data.trialDays} label={teacher ? "History, Math & Social free trial" : "Your free trial"} />}
      {!teacher && b.access && b.via && b.via !== "trial" && REASON[b.via] && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{REASON[b.via]}{b.endsAt && b.via !== "child-in-class" ? ` · renews ${fmtDay(b.endsAt)}` : ""}</p>}
      {!b.access && <p className="text-sm font-semibold text-amber-800">{teacher ? "Your free trial of History, Math and Social has ended. Add the ones your class uses." : "Your free trial has ended."}</p>}
      {role === "student" && (!b.access || b.via === "trial") && <p className={k.small}>To keep it after your trial, ask a parent to add it for your family, or ask your teacher to add it for your class.</p>}
      {teacher && <p className={k.small}>Each add-on covers up to {data.prices.classSeats} students; you have {data.students ?? 0}. Families paying the {money(data.prices.familyBundleCents)} Learning Bundle get their unused days refunded once your class has all three.</p>}
      {role === "parent" && !!data.children?.length && <div className="flex flex-wrap gap-2">{data.children.map((c) => <Pill key={c.id} which={which} tone={c.coveredByClass ? "green" : "slate"}>{c.name}{c.coveredByClass ? " · covered by class" : ""}</Pill>)}</div>}
      {role === "parent" && data.refund && data.refund.cents > 0 && <p className={k.ok}>Your children's teachers now cover Arise History, Math and Social, so we cancelled your plan and refunded {money(data.refund.cents)} to your card on {fmtDay(data.refund.at)}.</p>}
      {bundleAction && <div className="flex flex-wrap gap-2">{bundleAction}</div>}
      {!data.payment && (role === "parent" || teacher) && !b.plan?.live && <p className={k.small}>Online payment isn't open yet. Your free days still count down.</p>}
    </div>

    {showLifeHub && (role === "parent" || teacher) && <div className={`${k.soft} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><span className={k.tile}><CheckSquare className="h-5 w-5" /></span>
          <span className="min-w-0"><span className={`block ${k.h}`}>Arise LifeHub</span><span className={`block ${k.small}`}>{teacher ? "Comes with Arise WorkHub: one subscription, both hubs." : `Lists, chores, the family calendar and more: ${money(data.prices.todoCents)}/month after your free trial.`}</span></span></div>
        {which === "work" && <a className={k.ghost} href="/#/lifehub">Open LifeHub</a>}
      </div>
      {t.via === "trial" && t.trialEndsAt && <Trial which={which} endsAt={t.trialEndsAt} total={data.trialDays} label="LifeHub free trial" />}
      {teacher && data.hub?.via === "free-month" && data.hub.endsAt && <Trial which={which} endsAt={data.hub.endsAt} total={data.trialDays} label="Arise WorkHub & LifeHub free trial" />}
      {t.access && t.via && t.via !== "trial" && REASON[t.via] && !(teacher && data.hub?.via === "free-month") && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{REASON[t.via]}</p>}
      {!t.access && <p className="text-sm font-semibold text-amber-800">{teacher ? "Get Arise WorkHub to keep using LifeHub." : "Your LifeHub free trial has ended."}</p>}
      <div className="flex flex-wrap gap-2">
        {role === "parent" && (t.paidByYou
          ? <button type="button" className={k.ghost} disabled={!!busy} onClick={() => go("tm", "/api/billing/addon-portal", { product: "todo", returnPath })}>Manage LifeHub billing</button>
          : !t.plan?.live && <button type="button" className={k.primary} disabled={!!busy || !data.payment} onClick={() => go("t", "/api/billing/addon-checkout", { product: "todo", returnPath })} data-testid="addons-buy-todo">{busy === "t" ? "Opening…" : `${t.via === "trial" ? "Keep" : "Get"} LifeHub · ${money(data.prices.todoCents)}/month`}</button>)}
        {teacher && data.hub?.via !== "hub-teacher-plan" && data.hub?.via !== "hub-school-plan" && <a className={k.ghost} href="/#/billing">Arise WorkHub: {money(data.prices.hubCents)}/month</a>}
      </div>
    </div>}

    {note && <p className={k.ok} role="status">{note}</p>}
  </div>;
}
