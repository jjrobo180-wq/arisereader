// Add-ons (Arise History, Math and Social, and Arise LifeHub) built from the hub's own parts.
// Same rules and buttons as the site's add-ons card (components/AddonsCard.tsx): what's free,
// the family Learning Bundle or a teacher's class add-ons, LifeHub. No part of the site has a free trial.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Calculator, CheckCircle2, CheckSquare, Landmark, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { appHref } from "@/lib/hubs";
import { NATIVE_NO_PURCHASE, isNativeApp } from "@/lib/nativeApp";
import { Pill, fmtDay, kit, type Which } from "./kit";

type Access = { access: boolean; via: string | null; endsAt: string | null; plan: { live: boolean; endsAt: string | null } | null; paidByYou: boolean; oldBundle?: boolean };
type AppId = "math" | "history" | "social";
type Addons = {
  role: string; payment: boolean;
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
  "social-plan": "Included with your A.R.I.S.E. Connect plan", admin: "Included for admins", demo: "Included in this sample account", hub: "Free with Arise To Duo", "todo-plan": "Arise To Duo is free", free: "Always free",
};
const APPS: { id: AppId; href: string; label: string; sub: string; icon: typeof Landmark }[] = [
  { id: "history", href: "/history/", label: "Arise History", sub: "True stories and quizzes", icon: Landmark },
  { id: "math", href: "/math/", label: "Arise Math", sub: "Practice that levels up", icon: Calculator },
  { id: "social", href: "/social/", label: "A.R.I.S.E. Connect", sub: "Explore every career", icon: Users },
];

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

  // In the iPhone app: what's on the account, with no prices or buttons to buy (App Review 3.1.1).
  if (isNativeApp()) return <div className="space-y-3" data-testid="hub-addons">
    <p className={k.text}>{NATIVE_NO_PURCHASE}</p>
    <ul className="space-y-2">{APPS.map((app) => {
      const a = data.apps[app.id], on = !!a.access || !!a.plan?.live || (teacher && !!data.premium), Icon = app.icon;
      return <li key={app.id} className={`${k.row} flex items-center gap-3`} data-testid={`addons-app-${app.id}`}>
        <span className={k.tile}><Icon className="h-5 w-5" /></span>
        <a href={app.href} className="min-w-0 flex-1 hover:underline"><span className={`block ${k.h}`}>{app.label}</span><span className={`block ${k.small}`}>{on ? "On for your account" : "Not on this account"}</span></a>
      </li>;
    })}</ul>
  </div>;

  const free = role === "parent" ? "Your parent account is always free: your child's progress, game limits and the proctor code never cost anything."
    : teacher && data.premiumVia === "grandfathered" ? `Reading with your class is free for you this school year${data.premiumEndsAt ? `, until ${longDay(data.premiumEndsAt)}` : ""}.`
    : teacher && (data.premiumVia === "teacher-plan" || data.premiumVia === "school-plan") ? "Reading with your class is already covered by your plan." : "";

  let bundleAction: ReactNode = null;
  if (role === "parent") {
    if (b.paidByYou) bundleAction = <button type="button" className={k.ghost} disabled={!!busy} onClick={() => go("bm", "/api/billing/addon-portal", { product: "bundle", returnPath })}>Manage billing</button>;
    else if (!b.plan?.live && b.via !== "child-in-class") bundleAction = <button type="button" className={k.primary} disabled={!!busy || !data.payment} onClick={() => go("b", "/api/billing/addon-checkout", { product: "bundle", returnPath })} data-testid="addons-buy-bundle">{busy === "b" ? "Opening…" : `Get it for the whole family · ${money(data.prices.familyBundleCents)}/month`}</button>;
  }

  return <div className="space-y-4" data-testid="hub-addons">
    {(role === "parent" || teacher) && <p className={k.text}>{[free, "Arise To Duo Work & Life are both free. Optional learning bundles are billed separately."].filter(Boolean).join(" ")}</p>}

    <div>
      <p className={k.eyebrow}>{teacher ? "Class add-ons" : "Learning Bundle"}</p>
      <p className={`mt-1 ${k.text}`}>{teacher ? `Your Class plan includes Reader, Math, History and A.R.I.S.E. Connect for 30 students per $10/month, with another $10/month per additional 30.`
        : role === "parent" ? `One plan covers you and every child you've linked: ${money(data.prices.familyBundleCents)}/month. If a child's teacher adds all three for the class, we refund your unused days.`
        : "Three more ways to learn and earn points, right next to your reading."}</p>
    </div>

    <ul className="space-y-2">{APPS.map((app) => {
      const a = data.apps[app.id], live = !!a.plan?.live, Icon = app.icon;
      let right: ReactNode = null;
      if (teacher) {
        if (a.paidByYou && live) right = <button type="button" className={k.ghost} disabled={!!busy} onClick={() => go(`m-${app.id}`, "/api/billing/addon-portal", { product: app.id, returnPath })}>Manage previous plan</button>;
        else if (live || data.premium) right = <Pill which={which} tone="green">Included with Class</Pill>;
        else if (!data.premium) right = <a className={k.ghost} href={appHref("/billing")}>Get the Class plan first</a>;
        else right = <button type="button" className={k.primary} disabled={!!busy || !data.payment} onClick={() => go(app.id, "/api/billing/addon-checkout", { product: app.id, returnPath })} data-testid={`addons-buy-${app.id}`}>{busy === app.id ? "Opening…" : `Add · ${money(data.prices.classApps[app.id])}/mo`}</button>;
      }
      const status = teacher && data.premium ? "Included with Class" : teacher ? (live ? (a.oldBundle ? "On with your class bundle" : `On for your class${a.plan?.endsAt ? ` · renews ${fmtDay(a.plan.endsAt)}` : ""}`) : "Off") : app.sub;
      return <li key={app.id} className={`${k.row} flex flex-wrap items-center gap-3`} data-testid={`addons-${teacher ? "class" : "app"}-${app.id}`}>
        <span className={k.tile}><Icon className="h-5 w-5" /></span>
        <a href={app.href} className="min-w-0 flex-1 hover:underline"><span className={`block ${k.h}`}>{app.label}</span><span className={`block ${k.small}`}>{status}</span></a>
        {right}
      </li>;
    })}</ul>

    <div className="space-y-3">
      {!teacher && b.access && b.via && REASON[b.via] && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{REASON[b.via]}{b.endsAt && b.via !== "child-in-class" ? ` · renews ${fmtDay(b.endsAt)}` : ""}</p>}
      {!b.access && <p className="text-sm font-semibold text-amber-800">{teacher ? "Add the ones your class uses." : "Not added yet."}</p>}
      {role === "student" && !b.access && <p className={k.small}>Ask a parent to add it for your family, or ask your teacher to add it for your class.</p>}
      {teacher && <p className={k.small}>Reader, Math and History are included for every student covered by your Class plan. Your teacher plan can grow in blocks of 30 students.</p>}
      {role === "parent" && !!data.children?.length && <div className="flex flex-wrap gap-2">{data.children.map((c) => <Pill key={c.id} which={which} tone={c.coveredByClass ? "green" : "slate"}>{c.name}{c.coveredByClass ? " · covered by class" : ""}</Pill>)}</div>}
      {role === "parent" && data.refund && data.refund.cents > 0 && <p className={k.ok}>Your children's teachers now cover Arise History, Math and Social, so we cancelled your plan and refunded {money(data.refund.cents)} to your card on {fmtDay(data.refund.at)}.</p>}
      {bundleAction && <div className="flex flex-wrap gap-2">{bundleAction}</div>}
      {!data.payment && (role === "parent" || teacher) && !b.plan?.live && <p className={k.small}>Online payment isn't open yet.</p>}
    </div>

    {showLifeHub && (role === "parent" || teacher) && <div className={`${k.soft} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><span className={k.tile}><CheckSquare className="h-5 w-5" /></span>
          <span className="min-w-0"><span className={`block ${k.h}`}>Arise To Duo — Work &amp; Life</span><span className={`block ${k.small}`}>Both hubs are free for parents and teachers, with no trial or subscription.</span></span>
        </div>
        <div className="flex flex-wrap gap-2"><a className={k.ghost} href="/#/workhub">Open Work</a><a className={k.ghost} href="/#/lifehub">Open Life</a></div>
      </div>
      {t.paidByYou && <button type="button" className={k.ghost} disabled={!!busy} onClick={() => go("tm", "/api/billing/addon-portal", { product: "todo", returnPath })}>Manage a previous LifeHub subscription</button>}
    </div>}

    {note && <p className={k.ok} role="status">{note}</p>}
  </div>;
}
