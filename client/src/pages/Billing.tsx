// A teacher's plan: what they have, and how to get or change Premium.
// Payment happens on Stripe's own page; this page only starts it and reads the result.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { usePlan, type PlanInfo } from "@/lib/plan";
import { PLANS, blocksFor, seatsFor, teacherMonthlyCents, usd } from "@shared/plans";
import "./pricing.css";
import "./billing.css";

const day = (isoDate: string | null | undefined) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};
const count = (n: number) => n.toLocaleString("en-US");

/** The Checkout id Stripe puts in the address when the buyer comes back: #/billing?paid=cs_... */
function paidSession(): string | null {
  const hash = window.location.hash, at = hash.indexOf("?");
  const id = at >= 0 ? new URLSearchParams(hash.slice(at + 1)).get("paid") : null;
  return id && /^cs_[A-Za-z0-9_]+$/.test(id) ? id : null;
}

function status(plan: PlanInfo): { title: string; lines: string[]; tone: "good" | "need" | "plain" } {
  const school = plan.school?.name || "your school";
  switch (plan.via) {
    case "teacher-plan":
      return { tone: "good", title: "You have Premium", lines: [
        `Your teacher plan covers up to ${count(plan.seats ?? 0)} students. You have ${count(plan.students ?? 0)}.`,
        plan.teacherPlan?.paidOnline ? `It renews on ${day(plan.endsAt)}.` : plan.endsAt ? `It runs until ${day(plan.endsAt)}.` : "It has no end date.",
      ] };
    case "school-plan":
      if (plan.school?.plan?.free) {
        return { tone: "good", title: `Premium is free at ${school}`, lines: [
          `Every teacher at ${school} has Premium at no charge, each with their own account.`,
          "There is nothing to pay, and it has no end date.",
        ] };
      }
      return { tone: "good", title: "You have Premium through your school", lines: [
        `${school}'s plan covers up to ${count(plan.seats ?? PLANS.school.studentCap)} students, and every teacher there has their own account.`,
        plan.endsAt ? `It runs until ${day(plan.endsAt)}.` : "It has no end date.",
      ] };
    case "grandfathered":
      return { tone: "good", title: "Premium is free for you this school year", lines: [
        "You signed up before October 1, 2026, so you keep everything at no cost.",
        `Your free year runs until ${day(plan.endsAt)}. There is nothing to pay before then.`,
      ] };
    case "rules-off":
      return { tone: "plain", title: "Plans haven't started yet", lines: ["Every teacher tool is open to you for now. You don't need to do anything."] };
    case "admin":
    case "demo":
      return { tone: "plain", title: "This account always has Premium", lines: ["Nothing to pay."] };
    default:
      return { tone: "need", title: "Your teacher account needs Premium", lines: [
        "Teacher tools are part of A.R.I.S.E. Premium: your dashboard, live class games, game controls and more.",
        "Your students keep reading, taking quizzes and playing for free either way.",
      ] };
  }
}

export default function Billing() {
  const { user, token, logout } = useAuth();
  const [, navigate] = useLocation();
  const isTeacher = !!user && user.role === "teacher" && !user.isAdmin;
  const { plan, loading, refresh } = usePlan(user ? token : null);
  const [blocks, setBlocks] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"none" | "checking" | "done" | "late">(() => (paidSession() ? "checking" : "none"));
  const confirmed = useRef(false);

  const students = plan?.students ?? 0;
  const needed = useMemo(() => blocksFor(students), [students]);
  // Start the stepper at what they pay for now, and never below what their class needs.
  const paidSeats = plan?.teacherPlan?.live ? plan.teacherPlan.seats : 0;
  useEffect(() => { setBlocks((b) => Math.max(b, needed, Math.round(paidSeats / PLANS.teacher.studentsPerBlock))); }, [needed, paidSeats]);

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "That didn't work. Please try again.");
    return data;
  };

  // Back from paying: ask the server to check with Stripe, then drop the id from the address.
  useEffect(() => {
    const id = paidSession();
    if (!id || !token || confirmed.current) return;
    confirmed.current = true;
    post("/api/billing/confirm", { sessionId: id })
      .then(async () => { await refresh(); setConfirm("done"); })
      .catch(async () => { await refresh(); setConfirm("late"); })
      .finally(() => { window.history.replaceState(null, "", "#/billing"); });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (what: string, path: string, body: unknown) => {
    setBusy(what); setError("");
    try {
      const data = await post(path, body);
      if (typeof data.url === "string" && data.url.startsWith("https://")) { window.location.href = data.url; return; }
      await refresh();
    } catch (e: any) { setError(e.message || "That didn't work. Please try again."); }
    setBusy(null);
  };

  if (!user) return null;
  const s = plan ? status(plan) : null;
  const locked = !!plan && plan.enforced && !plan.premium;
  const ownPlan = plan?.teacherPlan?.live ? plan.teacherPlan : null;
  const schoolPlan = plan?.school?.plan?.live ? plan.school.plan : null;
  // Buying is offered to a teacher who needs Premium. While plans haven't started, or during a free year, there is nothing to pay.
  const canBuy = isTeacher && !!plan && plan.enforced && !plan.premium && !ownPlan && !schoolPlan;
  const freeYear = isTeacher && plan?.via === "grandfathered";
  const price = teacherMonthlyCents(blocks);

  return (
    <main className="pr bl">
      <span className="pr-glow pr-glow-a" aria-hidden="true" />
      <header className="pr-top">
        <button type="button" className="pr-mark" onClick={() => navigate("/pricing")}>A.R.I.S.E. <span>Reader</span></button>
        <nav aria-label="Account">
          {!locked && <button type="button" className="pr-link" onClick={() => navigate("/")}>Back to my dashboard</button>}
          <button type="button" className="pr-link" onClick={() => { logout(); navigate("/"); }}>Log out</button>
        </nav>
      </header>

      <section className="bl-wrap">
        <h1>Your plan</h1>

        {confirm === "checking" && <p className="bl-banner" role="status">Checking your payment…</p>}
        {confirm === "done" && <p className="bl-banner good" role="status">Payment received. Premium is on.</p>}
        {confirm === "late" && <p className="bl-banner" role="status">We couldn't confirm the payment yet. If your card was charged, Premium will switch on within a few minutes. Refresh this page to check.</p>}

        {loading && !plan && <p className="bl-banner" role="status">Loading your plan…</p>}
        {!loading && !plan && <p className="bl-banner" role="alert">Your plan couldn't be loaded. Check your connection and refresh the page.</p>}

        {s && (
          <div className={"bl-status " + s.tone}>
            <h2>{s.title}</h2>
            {s.lines.map((line) => <p key={line}>{line}</p>)}
            {!locked && s.tone !== "need" && <button type="button" className="pr-pill pr-pill-sm" onClick={() => navigate("/")} data-testid="billing-continue">Go to my dashboard</button>}
          </div>
        )}

        {error && <p className="bl-banner bad" role="alert">{error}</p>}

        {isTeacher && ownPlan?.paidOnline && plan && (
          <div className="bl-card">
            <h2>Change your teacher plan</h2>
            <p>Each block covers {PLANS.teacher.studentsPerBlock} students for {usd(PLANS.teacher.monthlyCents)} a month. You have {count(students)} students.</p>
            <Stepper blocks={blocks} min={needed} onChange={setBlocks} />
            <div className="bl-actions">
              <button type="button" className="pr-pill" disabled={!!busy || seatsFor(blocks) === plan.seats} onClick={() => go("blocks", "/api/billing/blocks", { blocks })}>
                {busy === "blocks" ? "Saving…" : `Change to ${count(seatsFor(blocks))} students, ${usd(price)} a month`}
              </button>
              <button type="button" className="pr-pill pr-pill-ghost" disabled={!!busy} onClick={() => go("portal", "/api/billing/portal", { kind: "teacher" })}>{busy === "portal" ? "Opening…" : "Manage billing"}</button>
            </div>
            <small>Manage billing opens Stripe, where you can change your card, see receipts or cancel.</small>
          </div>
        )}
        {isTeacher && schoolPlan?.canManage && (
          <div className="bl-card">
            <h2>Your school's plan</h2>
            <p>The teacher who paid for the school plan can change the card, see receipts or cancel.</p>
            <div className="bl-actions"><button type="button" className="pr-pill pr-pill-ghost" disabled={!!busy} onClick={() => go("school-portal", "/api/billing/portal", { kind: "school" })}>{busy === "school-portal" ? "Opening…" : "Manage school billing"}</button></div>
          </div>
        )}

        {freeYear && plan && (
          <div className="bl-card">
            <h2>When your free year ends</h2>
            <p>After {day(plan.endsAt)}, Premium is {usd(PLANS.teacher.monthlyCents)} a month for each {PLANS.teacher.studentsPerBlock} students, or {usd(PLANS.school.yearlyCents)} a year for a whole school of up to {count(PLANS.school.studentCap)} students. You'll be able to pay on this page when the time comes.</p>
          </div>
        )}

        {canBuy && plan && (
          <>
            <h2 className="bl-h2">Get Premium</h2>
            {!plan.payment && <p className="bl-banner">Online payment isn't open yet. You'll be able to pay here soon.</p>}
            <div className="bl-options">
              <div className="bl-card">
                <h3>One teacher</h3>
                <p className="bl-price"><b>{usd(price)}</b> a month</p>
                <p>Covers your class of up to {count(seatsFor(blocks))} students. You have {count(students)}.</p>
                <Stepper blocks={blocks} min={needed} onChange={setBlocks} />
                <button type="button" className="pr-pill pr-wide" disabled={!!busy || !plan.payment} onClick={() => go("teacher", "/api/billing/checkout", { kind: "teacher", blocks })} data-testid="billing-buy-teacher">
                  {busy === "teacher" ? "Opening the payment page…" : `Pay ${usd(price)} a month`}
                </button>
                <small>Billed monthly. Cancel any time.</small>
              </div>
              <div className="bl-card">
                <h3>Whole school</h3>
                <p className="bl-price"><b>{usd(PLANS.school.yearlyCents)}</b> a year</p>
                {plan.school
                  ? <p>Covers {plan.school.name}: up to {count(PLANS.school.studentCap)} students, with a separate account for every teacher. The school has {count(plan.school.students)} students on A.R.I.S.E. now.</p>
                  : <p>Your account isn't connected to a school yet, so a school plan can't be bought from it. Ask the site admin to connect you to your school.</p>}
                <button type="button" className="pr-pill pr-wide" disabled={!!busy || !plan.payment || !plan.school} onClick={() => go("school", "/api/billing/checkout", { kind: "school" })} data-testid="billing-buy-school">
                  {busy === "school" ? "Opening the payment page…" : `Pay ${usd(PLANS.school.yearlyCents)} a year`}
                </button>
                <small>Runs a full 12 months, so summer reading clubs and competitions are covered.</small>
              </div>
            </div>
            <p className="bl-foot">Card details are entered on Stripe's secure payment page, never on A.R.I.S.E. <button type="button" className="bl-text" onClick={() => navigate("/pricing")}>See what Premium includes</button></p>
          </>
        )}
      </section>
    </main>
  );
}

function Stepper({ blocks, min, onChange }: { blocks: number; min: number; onChange: (n: number) => void }) {
  const max = PLANS.teacher.maxBlocks;
  return (
    <div className="bl-stepper" role="group" aria-label="Students covered">
      <button type="button" onClick={() => onChange(Math.max(min, blocks - 1))} disabled={blocks <= min} aria-label={`Cover ${PLANS.teacher.studentsPerBlock} fewer students`}>−</button>
      <span aria-live="polite"><b>{count(seatsFor(blocks))}</b> students</span>
      <button type="button" onClick={() => onChange(Math.min(max, blocks + 1))} disabled={blocks >= max} aria-label={`Cover ${PLANS.teacher.studentsPerBlock} more students`}>+</button>
    </div>
  );
}
