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
import AddonsCard from "@/components/AddonsCard";

const day = (isoDate: string | null | undefined) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};
const count = (n: number) => n.toLocaleString("en-US");

/**
 * The Checkout id Stripe puts in the address when the buyer comes back.
 * It arrives in front of the "#" (/?paid=cs_...#/billing), which is where the
 * site's router keeps a query. The older form, #/billing?paid=cs_..., is read too.
 */
function paidSession(): string | null {
  const hash = window.location.hash, at = hash.indexOf("?");
  const id = new URLSearchParams(window.location.search).get("paid") ?? (at >= 0 ? new URLSearchParams(hash.slice(at + 1)).get("paid") : null);
  return id && /^cs_[A-Za-z0-9_]+$/.test(id) ? id : null;
}
/** Takes the Checkout id back out of the address, so reloading the page doesn't check the same payment again. */
function clearPaidSession() {
  try {
    const params = new URLSearchParams(window.location.search);
    params.delete("paid");
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}#/billing`);
  } catch { /* the address stays as it is; nothing else depends on it */ }
}
/** This site's own address, without the ?query and #page parts. Stripe sends the buyer back here. */
const siteAddress = () => window.location.origin + window.location.pathname;

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
        "The add-ons further down this page (Teacher Hub and the Learning Bundle) are optional and paid separately.",
      ] };
    case "free-month":
      return { tone: "good", title: "Your first month is free", lines: [
        "Your teacher account, Arise Math and Teacher Hub are all open to you at no cost.",
        `Your free month runs until ${day(plan.endsAt)}. There is nothing to pay before then.`,
      ] };
    case "rules-off":
      return { tone: "plain", title: "Plans haven't started yet", lines: ["Every teacher tool is open to you for now. You don't need to do anything."] };
    case "admin":
    case "demo":
      return { tone: "plain", title: "This account always has Premium", lines: ["Nothing to pay."] };
    default: {
      const ended = plan.freeMonthEndsAt && Date.parse(plan.freeMonthEndsAt) <= Date.now() ? day(plan.freeMonthEndsAt) : "";
      return { tone: "need", title: "Your teacher account needs Premium", lines: [
        ...(ended ? [`Your free month ended on ${ended}.`] : []),
        "Teacher tools are part of A.R.I.S.E. Premium: your dashboard, Arise Math, live class games, game controls and more.",
        "Your students keep reading, taking quizzes and playing for free either way.",
      ] };
    }
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
  const [confirm, setConfirm] = useState<"none" | "checking" | "done" | "done-hub" | "done-addon" | "late">(() => (paidSession() ? "checking" : "none"));
  const [hubBlocks, setHubBlocks] = useState(1);
  const confirmed = useRef(false);

  const students = plan?.students ?? 0;
  const needed = useMemo(() => blocksFor(students), [students]);
  // Start the stepper at what they pay for now, and never below what their class needs.
  const paidSeats = plan?.teacherPlan?.live ? plan.teacherPlan.seats : 0;
  useEffect(() => { setBlocks((b) => Math.max(b, needed, Math.round(paidSeats / PLANS.teacher.studentsPerBlock))); }, [needed, paidSeats]);
  // The same for Teacher Hub, counted against the students in the Hub caseload.
  const hub = plan?.hub;
  const hubStudents = hub?.students ?? 0;
  const hubNeeded = useMemo(() => blocksFor(hubStudents), [hubStudents]);
  const hubPaidSeats = hub?.teacherPlan?.live ? hub.teacherPlan.seats : 0;
  useEffect(() => { setHubBlocks((b) => Math.max(b, hubNeeded, Math.round(hubPaidSeats / PLANS.hub.studentsPerBlock))); }, [hubNeeded, hubPaidSeats]);

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
      .then(async (data) => { await refresh(); const k = String(data?.plan?.kind || ""); setConfirm(k.startsWith("hub_") ? "done-hub" : /^(bundle|todo|social)/.test(k) ? "done-addon" : "done"); })
      .catch(async () => { await refresh(); setConfirm("late"); })
      .finally(clearPaidSession);
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
  // Buying is offered to a teacher who needs Premium. While plans haven't started, or during a free year or free month, there is nothing to pay.
  const canBuy = isTeacher && !!plan && plan.enforced && !plan.premium && !ownPlan && !schoolPlan;
  const freeYear = isTeacher && plan?.via === "grandfathered";
  const freeMonth = isTeacher && plan?.via === "free-month";
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
        {confirm === "done-hub" && <p className="bl-banner good" role="status">Payment received. Teacher Hub is on. <button type="button" className="bl-text" onClick={() => navigate("/teacher-hub")}>Open Teacher Hub</button></p>}
        {confirm === "done-addon" && <p className="bl-banner good" role="status">Payment received. Your add-on is on.</p>}
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

        {isTeacher && <div style={{ margin: "18px 0" }}><AddonsCard key={confirm} returnPath="/billing" /></div>}

        {isTeacher && ownPlan?.paidOnline && plan && (
          <div className="bl-card">
            <h2>Change your teacher plan</h2>
            <p>Each block covers {PLANS.teacher.studentsPerBlock} students for {usd(PLANS.teacher.monthlyCents)} a month. You have {count(students)} students.</p>
            <Stepper blocks={blocks} min={needed} onChange={setBlocks} />
            <div className="bl-actions">
              <button type="button" className="pr-pill" disabled={!!busy || seatsFor(blocks) === plan.seats} onClick={() => go("blocks", "/api/billing/blocks", { blocks })}>
                {busy === "blocks" ? "Saving…" : `Change to ${count(seatsFor(blocks))} students, ${usd(price)} a month`}
              </button>
              <button type="button" className="pr-pill pr-pill-ghost" disabled={!!busy} onClick={() => go("portal", "/api/billing/portal", { kind: "teacher", returnTo: siteAddress() })}>{busy === "portal" ? "Opening…" : "Manage billing"}</button>
            </div>
            <small>Manage billing opens Stripe, where you can change your card, see receipts or cancel.</small>
          </div>
        )}
        {isTeacher && schoolPlan?.canManage && (
          <div className="bl-card">
            <h2>Your school's plan</h2>
            <p>The teacher who paid for the school plan can change the card, see receipts or cancel.</p>
            <div className="bl-actions"><button type="button" className="pr-pill pr-pill-ghost" disabled={!!busy} onClick={() => go("school-portal", "/api/billing/portal", { kind: "school", returnTo: siteAddress() })}>{busy === "school-portal" ? "Opening…" : "Manage school billing"}</button></div>
          </div>
        )}

        {(freeYear || freeMonth) && plan && (
          <div className="bl-card">
            <h2>When your free {freeMonth ? "month" : "year"} ends</h2>
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
                <button type="button" className="pr-pill pr-wide" disabled={!!busy || !plan.payment} onClick={() => go("teacher", "/api/billing/checkout", { kind: "teacher", blocks, returnTo: siteAddress() })} data-testid="billing-buy-teacher">
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
                <button type="button" className="pr-pill pr-wide" disabled={!!busy || !plan.payment || !plan.school} onClick={() => go("school", "/api/billing/checkout", { kind: "school", returnTo: siteAddress() })} data-testid="billing-buy-school">
                  {busy === "school" ? "Opening the payment page…" : `Pay ${usd(PLANS.school.yearlyCents)} a year`}
                </button>
                <small>Runs a full 12 months, so summer reading clubs and competitions are covered.</small>
              </div>
            </div>
            <p className="bl-foot">Card details are entered on Stripe's secure payment page, never on A.R.I.S.E. <button type="button" className="bl-text" onClick={() => navigate("/pricing")}>See what Premium includes</button></p>
          </>
        )}

        {isTeacher && hub && (
          <HubSection
            plan={plan!}
            hub={hub}
            blocks={hubBlocks}
            min={hubNeeded}
            setBlocks={setHubBlocks}
            busy={busy}
            go={go}
            open={() => navigate("/teacher-hub")}
            pricing={() => navigate("/pricing")}
          />
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

/** Teacher Hub, the add-on: what the teacher has, and buying or changing it. */
function HubSection({ plan, hub, blocks, min, setBlocks, busy, go, open, pricing }: {
  plan: PlanInfo;
  hub: NonNullable<PlanInfo["hub"]>;
  blocks: number;
  min: number;
  setBlocks: (n: number) => void;
  busy: string | null;
  go: (what: string, path: string, body: unknown) => Promise<void>;
  open: () => void;
  pricing: () => void;
}) {
  const H = PLANS.hub;
  const own = hub.teacherPlan?.live ? hub.teacherPlan : null;
  const school = hub.schoolPlan?.live ? hub.schoolPlan : null;
  const price = blocks * H.monthlyCents;
  const freeMonth = hub.via === "free-month";
  return (
    <div className="bl-hub" data-testid="billing-hub">
      <h2 className="bl-h2">Teacher Hub <span className="bl-tag">Add-on</span></h2>
      <p className="bl-hub-lede">Your private workspace for caseloads, IEP timelines, lessons, notes, attendance, grades, parent contact and schedules. Teacher Hub is sold on its own and isn't part of Premium.</p>

      {hub.access ? (
        <div className="bl-status good">
          <h2>{freeMonth ? "Teacher Hub is free for your first month" : hub.via === "hub-school-plan" ? "You have Teacher Hub through your school" : "You have Teacher Hub"}</h2>
          {freeMonth
            ? <p>Your free month runs until {day(hub.endsAt)}, with no limit on the students in your caseload.</p>
            : hub.via === "hub-school-plan"
              ? <p>{plan.school?.name || "Your school"}'s plan covers up to {count(hub.seats ?? H.schoolStudentCap)} students, and every teacher there gets their own Hub.</p>
              : <p>Your plan covers up to {count(hub.seats ?? 0)} students in your caseload. You have {count(hub.students)}.</p>}
          <p>{freeMonth
            ? `After that, Teacher Hub is ${usd(H.monthlyCents)} a month for each ${H.studentsPerBlock} students, or ${usd(H.schoolYearlyCents)} a year for a whole school. You'll be able to pay on this page when the time comes, and everything you saved stays in your account.`
            : own?.paidOnline ? `It renews on ${day(hub.endsAt)}.` : hub.endsAt ? `It runs until ${day(hub.endsAt)}.` : "It has no end date."}</p>
          <button type="button" className="pr-pill pr-pill-sm" onClick={open} data-testid="billing-open-hub">Open Teacher Hub</button>
        </div>
      ) : (
        <>
          {!plan.payment && <p className="bl-banner">Online payment isn't open yet. You'll be able to pay here soon.</p>}
          <div className="bl-options">
            <div className="bl-card">
              <h3>One teacher</h3>
              <p className="bl-price"><b>{usd(price)}</b> a month</p>
              <p>Covers a caseload of up to {count(blocks * H.studentsPerBlock)} students.{hub.students ? ` You have ${count(hub.students)}.` : ""}</p>
              <HubStepper blocks={blocks} min={min} onChange={setBlocks} />
              <button type="button" className="pr-pill pr-wide" disabled={!!busy || !plan.payment} onClick={() => go("hub-teacher", "/api/billing/checkout", { kind: "hub_teacher", blocks, returnTo: siteAddress() })} data-testid="billing-buy-hub-teacher">
                {busy === "hub-teacher" ? "Opening the payment page…" : `Pay ${usd(price)} a month`}
              </button>
              <small>Billed monthly. Cancel any time.</small>
            </div>
            <div className="bl-card">
              <h3>Whole school</h3>
              <p className="bl-price"><b>{usd(H.schoolYearlyCents)}</b> a year</p>
              {plan.school
                ? <p>Gives every teacher at {plan.school.name} their own Teacher Hub, for up to {count(H.schoolStudentCap)} students.</p>
                : <p>Your account isn't connected to a school yet, so a school plan can't be bought from it.</p>}
              <button type="button" className="pr-pill pr-wide" disabled={!!busy || !plan.payment || !plan.school} onClick={() => go("hub-school", "/api/billing/checkout", { kind: "hub_school", returnTo: siteAddress() })} data-testid="billing-buy-hub-school">
                {busy === "hub-school" ? "Opening the payment page…" : `Pay ${usd(H.schoolYearlyCents)} a year`}
              </button>
              <small>Runs a full 12 months.</small>
            </div>
          </div>
          <p className="bl-foot">After a teacher's free first month, Teacher Hub isn't included free with any A.R.I.S.E. plan or school. <button type="button" className="bl-text" onClick={pricing}>See what Teacher Hub includes</button></p>
        </>
      )}

      {own?.paidOnline && (
        <div className="bl-card">
          <h2>Change your Teacher Hub plan</h2>
          <p>Each block covers {H.studentsPerBlock} students for {usd(H.monthlyCents)} a month. Your caseload has {count(hub.students)} students.</p>
          <HubStepper blocks={blocks} min={min} onChange={setBlocks} />
          <div className="bl-actions">
            <button type="button" className="pr-pill" disabled={!!busy || blocks * H.studentsPerBlock === own.seats} onClick={() => go("hub-blocks", "/api/billing/blocks", { kind: "hub_teacher", blocks })}>
              {busy === "hub-blocks" ? "Saving…" : `Change to ${count(blocks * H.studentsPerBlock)} students, ${usd(price)} a month`}
            </button>
            <button type="button" className="pr-pill pr-pill-ghost" disabled={!!busy} onClick={() => go("hub-portal", "/api/billing/portal", { kind: "hub_teacher", returnTo: siteAddress() })}>{busy === "hub-portal" ? "Opening…" : "Manage billing"}</button>
          </div>
        </div>
      )}
      {school?.canManage && (
        <div className="bl-card">
          <h2>Your school's Teacher Hub plan</h2>
          <p>The teacher who paid for it can change the card, see receipts or cancel.</p>
          <div className="bl-actions"><button type="button" className="pr-pill pr-pill-ghost" disabled={!!busy} onClick={() => go("hub-school-portal", "/api/billing/portal", { kind: "hub_school", returnTo: siteAddress() })}>{busy === "hub-school-portal" ? "Opening…" : "Manage school billing"}</button></div>
        </div>
      )}
    </div>
  );
}

function HubStepper({ blocks, min, onChange }: { blocks: number; min: number; onChange: (n: number) => void }) {
  const H = PLANS.hub;
  return (
    <div className="bl-stepper" role="group" aria-label="Students in your caseload">
      <button type="button" onClick={() => onChange(Math.max(min, blocks - 1))} disabled={blocks <= min} aria-label={`Cover ${H.studentsPerBlock} fewer students`}>−</button>
      <span aria-live="polite"><b>{count(blocks * H.studentsPerBlock)}</b> students</span>
      <button type="button" onClick={() => onChange(Math.min(H.maxBlocks, blocks + 1))} disabled={blocks >= H.maxBlocks} aria-label={`Cover ${H.studentsPerBlock} more students`}>+</button>
    </div>
  );
}
