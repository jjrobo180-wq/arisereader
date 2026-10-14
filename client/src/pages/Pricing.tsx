import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { PLANS, usd } from "@shared/plans";
import { UNLIMITED_MONTHLY_CENTS, UNLIMITED_YEARLY_CENTS } from "@shared/todoPlan";
import "./pricing.css";

/** One public pricing page for both A.R.I.S.E. Reader and A.R.I.S.E. To-Do. */
export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Visitors using a saved /app#/pricing link should see the light homepage's
  // pricing section, not this Reader-focused React view.
  const onTodoDomain = typeof window !== "undefined" && /^(www\.)?arisetodo\.com$/i.test(window.location.hostname);
  useEffect(() => {
    if (onTodoDomain) window.location.replace("/#pricing");
  }, [onTodoDomain]);
  if (onTodoDomain) return <main className="min-h-screen bg-[#f9fafc] p-10 text-center"><a href="/#pricing">Open A.R.I.S.E. To-Do pricing</a></main>;

  const home = () => { window.location.assign("https://www.arisereader.com/"); };
  const todo = () => { window.location.assign("https://arisetodo.com/app#/signin"); };
  const startReading = () => { window.location.assign("https://www.arisereader.com/#/signin"); };
  const teacherPlan = () => {
    if (user?.role === "teacher" || user?.isAdmin) navigate("/billing");
    else window.location.assign("https://www.arisereader.com/#/teacher-signup");
  };
  const familyPlan = () => {
    window.location.assign(user?.role === "parent" ? "https://arisetodo.com/app#/lifehub" : "https://www.arisereader.com/#/parent-signup");
  };
  const kids = PLANS.parentMaxChildren;
  const block = PLANS.teacher.studentsPerBlock;
  const perBlock = usd(PLANS.teacher.monthlyCents);
  return (
    <main className="pr min-h-screen bg-[#f7f8ff] text-[#191b35]">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
        <button className="text-xl font-black tracking-tight" onClick={home}>A.R.I.S.E. <span className="text-violet-700">Reader</span></button>
        <div className="flex items-center gap-3"><button onClick={home} className="rounded-full px-3 py-2 text-sm font-bold">Back to home</button><button onClick={startReading} className="rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white">Sign in</button></div>
      </header>
      <section className="mx-auto max-w-4xl px-5 pb-8 pt-10 text-center">
        <p className="text-xs font-black uppercase tracking-[.22em] text-violet-700">Simple, straightforward pricing</p>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">A.R.I.S.E. Reader stays free.<br/><span className="text-violet-700">Pay only for extra learning.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Parents and teachers use one secure A.R.I.S.E. portal to open their learning programs.</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-12 lg:grid-cols-3" aria-label="Plans">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pricing-free">
          <p className="text-xs font-black uppercase tracking-widest text-violet-600">Students &amp; parents</p>
          <h2 className="mt-3 text-2xl font-black">A.R.I.S.E. Reader</h2>
          <p className="mt-3 text-5xl font-black">$0 <span className="text-sm font-semibold text-slate-500">forever</span></p>
          <p className="mt-4 text-sm leading-6 text-slate-600">100% free for every student and their parent or guardian, with up to {kids} linked children per parent.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Reading library &amp; book quizzes</li><li>✓ Progress, achievements &amp; points</li><li>✓ Games &amp; accessible reading</li><li>✓ Parent monitoring and learning support</li><li>✓ A.R.I.S.E. To-Do (Work &amp; Life hubs) free plan included</li></ul>
          <button onClick={startReading} className="mt-7 w-full rounded-xl border border-violet-300 bg-violet-50 px-5 py-3 font-bold text-violet-800" data-testid="pricing-start-free">Start reading free</button>
        </article>
        <article className="rounded-[1.75rem] border-2 border-violet-600 bg-white p-6 shadow-xl shadow-violet-100" data-testid="pricing-family">
          <p className="text-xs font-black uppercase tracking-widest text-violet-600">Optional family learning bundle</p>
          <h2 className="mt-3 text-2xl font-black">Math, History &amp; Connect</h2>
          <p className="mt-3 text-5xl font-black">{usd(PLANS.bundle.familyMonthlyCents)} <span className="text-sm font-semibold text-slate-500">/ month</span></p>
          <p className="mt-4 text-sm leading-6 text-slate-600">One price for the parent and all {kids} linked children. Reading stays free even without the bundle.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ A.R.I.S.E. Math</li><li>✓ A.R.I.S.E. History</li><li>✓ A.R.I.S.E. Connect</li><li>✓ Family access across linked accounts</li><li>✓ A.R.I.S.E. To-Do (Work &amp; Life hubs) free plan included</li></ul>
          <ToDoAddOn base={PLANS.bundle.familyMonthlyCents} />
          <button onClick={familyPlan} className="mt-7 w-full rounded-xl bg-violet-700 px-5 py-3 font-bold text-white">Get the family bundle</button>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pricing-class">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Teachers</p>
          <h2 className="mt-3 text-2xl font-black">Class Learning</h2>
          <p className="mt-3 text-5xl font-black">{perBlock} <span className="text-sm font-semibold text-slate-500">/ month</span></p>
          <p className="mt-4 text-sm leading-6 text-slate-600">Includes A.R.I.S.E. Reader, Math, History and Connect for up to {block} students. Add another {block} students for {perBlock} more per month.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ A.R.I.S.E. Reader included — library, book quizzes &amp; classroom dashboard</li><li>✓ Math, History &amp; Connect included</li><li>✓ {block} students per paid block</li><li>✓ Parent accounts remain free</li><li>✓ A.R.I.S.E. To-Do (Work &amp; Life hubs) free plan included</li></ul>
          <ToDoAddOn base={PLANS.teacher.monthlyCents} />
          <button onClick={teacherPlan} className="mt-7 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white" data-testid="pricing-get-premium">View class plan</button>
        </article>
      </section>
      <section className="mx-auto mb-16 max-w-6xl rounded-[1.75rem] border border-indigo-100 bg-white px-6 py-9 shadow-sm sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-widest text-violet-600">Free to start · Unlimited {usd(UNLIMITED_MONTHLY_CENTS)}/month</p><h2 className="mt-2 text-2xl font-black">A.R.I.S.E. To-Do — Work &amp; Life hubs</h2><p className="mt-3 text-sm leading-7 text-slate-600">Your portal for tasks, calendars, family planning, educator tools and access to your A.R.I.S.E. programs. The free plan includes both hubs and up to 3 apps from the App Store. A.R.I.S.E. To-Do Unlimited adds all 575+ apps and AI for {usd(UNLIMITED_MONTHLY_CENTS)} a month ({usd(UNLIMITED_YEARLY_CENTS)} a year for a limited time). Cancel anytime; nothing is deleted.</p></div>
          <button onClick={todo} className="rounded-xl bg-[#1b1842] px-6 py-3 font-bold text-white">Open A.R.I.S.E. To-Do</button>
        </div>
      </section>
      <footer className="px-5 pb-8 text-center text-xs text-slate-500">A.R.I.S.E. — Advocating, Resilience, Inclusion, Support, Empowerment.</footer>
    </main>
  );
}

/** On a plan card: the optional A.R.I.S.E. To-Do Unlimited add-on, with the card's total once it's added. */
function ToDoAddOn({ base }: { base: number }) {
  return <div className="mt-5 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-4 text-left" data-testid="pricing-todo-addon">
    <p className="flex items-baseline justify-between gap-2"><span className="text-sm font-black text-violet-900">+ A.R.I.S.E. To-Do Unlimited</span><span className="text-sm font-black text-violet-900">+{usd(UNLIMITED_MONTHLY_CENTS)}<span className="text-xs font-semibold text-violet-700">/mo</span></span></p>
    <p className="mt-1 text-xs leading-5 text-violet-800">Every app in the App Store and AI. {usd(base + UNLIMITED_MONTHLY_CENTS)}/month total, or {usd(UNLIMITED_YEARLY_CENTS)}/year for the add-on for a limited time.</p>
  </div>;
}
