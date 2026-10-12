import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { PLANS, usd } from "@shared/plans";
import "./pricing.css";

/** One public pricing page for both A.R.I.S.E. Reader and A.R.I.S.E. To-Do. */
export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
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
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Parents and teachers use one secure A.R.I.S.E. portal to open their learning programs. Your A.R.I.S.E. To-Do Work and Life hubs are both free—no payment or free-trial countdown required.</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-12 lg:grid-cols-3" aria-label="Plans">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pricing-free">
          <p className="text-xs font-black uppercase tracking-widest text-violet-600">Students &amp; parents</p>
          <h2 className="mt-3 text-2xl font-black">A.R.I.S.E. Reader</h2>
          <p className="mt-3 text-5xl font-black">$0 <span className="text-sm font-semibold text-slate-500">forever</span></p>
          <p className="mt-4 text-sm leading-6 text-slate-600">100% free for every student and their parent or guardian, with up to {kids} linked children per parent.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Reading library &amp; book quizzes</li><li>✓ Progress, achievements &amp; points</li><li>✓ Games &amp; accessible reading</li><li>✓ Parent monitoring and learning support</li></ul>
          <button onClick={startReading} className="mt-7 w-full rounded-xl border border-violet-300 bg-violet-50 px-5 py-3 font-bold text-violet-800" data-testid="pricing-start-free">Start reading free</button>
        </article>
        <article className="rounded-[1.75rem] border-2 border-violet-600 bg-white p-6 shadow-xl shadow-violet-100" data-testid="pricing-family">
          <p className="text-xs font-black uppercase tracking-widest text-violet-600">Optional family learning bundle</p>
          <h2 className="mt-3 text-2xl font-black">Math, History &amp; Connect</h2>
          <p className="mt-3 text-5xl font-black">{usd(PLANS.bundle.familyMonthlyCents)} <span className="text-sm font-semibold text-slate-500">/ month</span></p>
          <p className="mt-4 text-sm leading-6 text-slate-600">One price for the parent and all {kids} linked children. Reading stays free even without the bundle.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ A.R.I.S.E. Math</li><li>✓ A.R.I.S.E. History</li><li>✓ A.R.I.S.E. Connect (career discovery; restricted student connections under development)</li><li>✓ Family access across linked accounts</li></ul>
          <button onClick={familyPlan} className="mt-7 w-full rounded-xl bg-violet-700 px-5 py-3 font-bold text-white">Get the family bundle</button>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pricing-class">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Teachers</p>
          <h2 className="mt-3 text-2xl font-black">Class Learning</h2>
          <p className="mt-3 text-5xl font-black">{perBlock} <span className="text-sm font-semibold text-slate-500">/ month</span></p>
          <p className="mt-4 text-sm leading-6 text-slate-600">Includes A.R.I.S.E. Reader, Math and History for up to {block} students. Add another {block} students for {perBlock} more per month.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Reader classroom dashboard &amp; quizzes</li><li>✓ Math and History included</li><li>✓ {block} students per paid block</li><li>✓ Parent accounts remain free</li></ul>
          <button onClick={teacherPlan} className="mt-7 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white" data-testid="pricing-get-premium">View class plan</button>
        </article>
      </section>
      <section className="mx-auto mb-16 max-w-6xl rounded-[1.75rem] border border-indigo-100 bg-white px-6 py-9 shadow-sm sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-widest text-violet-600">Free for parents and teachers</p><h2 className="mt-2 text-2xl font-black">A.R.I.S.E. To-Do — Work &amp; Life hubs</h2><p className="mt-3 text-sm leading-7 text-slate-600">Your portal for tasks, calendars, family planning, educator tools and access to your A.R.I.S.E. programs. No charge. No subscription. No trial. Parents and teachers can switch between their own Work and Life spaces.</p></div>
          <button onClick={todo} className="rounded-xl bg-[#1b1842] px-6 py-3 font-bold text-white">Open A.R.I.S.E. To-Do</button>
        </div>
      </section>
      <footer className="px-5 pb-8 text-center text-xs text-slate-500">A.R.I.S.E. — Advocating, Resilience, Inclusion, Support, Empowerment.</footer>
    </main>
  );
}
