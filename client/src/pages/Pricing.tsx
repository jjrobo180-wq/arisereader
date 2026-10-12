import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { PLANS, usd } from "@shared/plans";
import "./pricing.css";

/** One public pricing page for both A.R.I.S.E. Reader and A.R.I.S.E. To-Do. */
export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // arisetodo.com has its own pricing page. A.R.I.S.E. Reader's learning
  // bundles are separate products and should never replace To-Do pricing.
  const onTodoDomain = typeof window !== "undefined" && /^(www\\.)?arisetodo\\.com$/i.test(window.location.hostname);
  if (onTodoDomain) return (
    <main className="min-h-screen bg-[#07060f] text-white">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
        <button onClick={() => navigate("/")} className="text-lg font-black tracking-tight">A.R.I.S.E. <span className="text-violet-300">To-Do</span></button>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-300 hover:text-white">Back to home</button>
          <button onClick={() => navigate("/signin")} className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950">Log in</button>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-5 pb-12 pt-12 text-center sm:pt-20">
        <p className="text-xs font-black uppercase tracking-[.24em] text-violet-300">A.R.I.S.E. To-Do pricing</p>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Your whole life, organized. <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">Completely free.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Both Work and Life hubs are included for parents and teachers. Make your own space and customize it your way.</p>
      </section>
      <section aria-label="To-Do plans" className="mx-auto grid max-w-5xl gap-5 px-5 pb-10 md:grid-cols-2">
        <article className="rounded-[28px] border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-indigo-500/5 p-7" data-testid="todo-pricing-life">
          <p className="text-xs font-black uppercase tracking-widest text-violet-300">Personal &amp; family</p>
          <h2 className="mt-3 text-2xl font-black">A.R.I.S.E. To-Do · Life</h2>
          <p className="mt-5 text-5xl font-black">$0 <span className="text-sm font-semibold text-slate-300">/ month</span></p>
          <p className="mt-5 text-sm leading-7 text-slate-300">Plan your day, take care of your household and keep what matters in one place.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-100">
            <li>✓ Tasks, calendars and family schedules</li>
            <li>✓ Habits, routines, meals and grocery lists</li>
            <li>✓ Budget, health and household trackers</li>
            <li>✓ Custom sections, layouts and App Store tools</li>
          </ul>
        </article>
        <article className="rounded-[28px] border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/15 to-violet-500/5 p-7" data-testid="todo-pricing-work">
          <p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">Work &amp; education</p>
          <h2 className="mt-3 text-2xl font-black">A.R.I.S.E. To-Do · Work</h2>
          <p className="mt-5 text-5xl font-black">$0 <span className="text-sm font-semibold text-slate-300">/ month</span></p>
          <p className="mt-5 text-sm leading-7 text-slate-300">Bring tasks, schedules and daily planning together in a workspace you control.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-100">
            <li>✓ To-do lists, recurring tasks and reminders</li>
            <li>✓ Calendars, meetings and notes</li>
            <li>✓ Educator organization and planning tools</li>
            <li>✓ Custom Home screens, menus and folders</li>
          </ul>
        </article>
      </section>
      <section className="mx-auto max-w-5xl px-5 pb-20 pt-5 text-center">
        <p className="text-sm font-semibold leading-6 text-slate-300">One A.R.I.S.E. account gives you access to both hubs.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={() => navigate("/register-independent")} className="min-h-12 rounded-full bg-white px-8 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.03]">Get started free</button>
          <button onClick={() => navigate("/signin")} className="min-h-12 rounded-full border border-white/30 px-8 py-3 text-sm font-black text-white hover:bg-white/10">I already have an account</button>
        </div>
      </section>
    </main>
  );
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
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Parents and teachers use one secure A.R.I.S.E. portal to open their learning programs. Your A.R.I.S.E. To-Do Work and Life hubs are both free.</p>
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
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ A.R.I.S.E. Math</li><li>✓ A.R.I.S.E. History</li><li>✓ A.R.I.S.E. Connect</li><li>✓ Family access across linked accounts</li></ul>
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
