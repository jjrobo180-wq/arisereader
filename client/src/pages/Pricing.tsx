import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { PLANS, usd } from "@shared/plans";
import "./pricing.css";

/** One public pricing page for both A.R.I.S.E. Reader and Arise To Duo. */
export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Visitors using a saved /app#/pricing link should see the light homepage's
  // pricing section, not this Reader-focused React view.
  const onTodoDomain = typeof window !== "undefined" && /^(www\.)?arisetodo\.com$/i.test(window.location.hostname);
  useEffect(() => {
    if (onTodoDomain) window.location.replace("/#pricing");
  }, [onTodoDomain]);
  if (onTodoDomain) return <main className="min-h-screen bg-[#f9fafc] p-10 text-center"><a href="/#pricing">Open Arise To Duo pricing</a></main>;

  const home = () => { window.location.assign("https://www.arisereader.com/"); };
  const startReading = () => { window.location.assign("https://www.arisereader.com/#/signin"); };
  const teacherPlan = () => {
    if (user?.role === "teacher" || user?.isAdmin) navigate("/billing");
    else window.location.assign("https://www.arisereader.com/#/teacher-signup");
  };
  const familyPlan = () => {
    window.location.assign(user?.role === "parent" ? "https://www.arisereader.com/#/subscribe" : "https://www.arisereader.com/#/parent-signup");
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
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">One plan. Every book.<br/><span className="text-violet-700">Every quiz. Every reward.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Pick the plan for your family, your class or your whole school. Already have an account? Yours stays free this school year.</p>
      </section>
      <section className="mx-auto grid grid-cols-1 max-w-6xl gap-5 px-5 pb-12 lg:grid-cols-3" aria-label="Plans">
        <article className="rounded-[1.75rem] border-2 border-violet-600 bg-white p-6 shadow-xl shadow-violet-100" data-testid="pricing-family">
          <p className="text-xs font-black uppercase tracking-widest text-violet-600">Parents &amp; families</p>
          <h2 className="mt-3 text-2xl font-black">A.R.I.S.E. Family</h2>
          <p className="mt-3 text-5xl font-black">{usd(PLANS.bundle.familyMonthlyCents)} <span className="text-sm font-semibold text-slate-500">/ month</span></p>
          <p className="mt-4 text-sm leading-6 text-slate-600">One price for the parent and up to {kids} linked children.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Reading library &amp; book quizzes</li><li>✓ Progress, achievements &amp; points</li><li>✓ Games &amp; accessible reading</li><li>✓ Certificates &amp; reading rewards</li><li>✓ Parent dashboard for every child</li></ul>
          <button onClick={familyPlan} className="mt-7 w-full rounded-xl bg-violet-700 px-5 py-3 font-bold text-white" data-testid="pricing-get-family">Get the family plan</button>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pricing-class">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Teachers<span className="ml-2 inline-block rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 align-middle text-[11px] font-black uppercase tracking-wider">Teacher discount</span></p>
          <h2 className="mt-3 text-2xl font-black">Class</h2>
          <p className="mt-3 text-5xl font-black">{perBlock} <span className="text-sm font-semibold text-slate-500">/ month</span></p>
          <p className="mt-2 text-xs font-bold text-emerald-700">Discounted classroom price for educators, about 20¢ per student.</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">A.R.I.S.E. Reader for up to {block} students.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Every student covered by your plan</li><li>✓ Classroom dashboard &amp; reports</li><li>✓ Live class games &amp; class goals</li><li>✓ Custom quizzes for your books</li><li>✓ Parents of your students follow along</li></ul>
          <button onClick={teacherPlan} className="mt-7 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white" data-testid="pricing-get-premium">Get the class plan</button>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pricing-school">
          <p className="text-xs font-black uppercase tracking-widest text-sky-700">Schools<span className="ml-2 inline-block rounded-full bg-sky-100 text-sky-800 px-2.5 py-1 align-middle text-[11px] font-black uppercase tracking-wider">School discount</span></p>
          <h2 className="mt-3 text-2xl font-black">Whole School</h2>
          <p className="mt-3 text-5xl font-black">{usd(PLANS.school.yearlyCents)} <span className="text-sm font-semibold text-slate-500">/ school year</span></p>
          <p className="mt-2 text-xs font-bold text-sky-700">Discounted school-wide price, our biggest savings per student.</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Every teacher and every student at your school, each teacher with their own account.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Unlimited teachers</li><li>✓ Up to {PLANS.school.studentCap.toLocaleString("en-US")} students</li><li>✓ Every book and quiz</li><li>✓ School-wide reports</li><li>✓ One bill for the whole school</li></ul>
          <button onClick={teacherPlan} className="mt-7 w-full rounded-xl bg-sky-700 px-5 py-3 font-bold text-white" data-testid="pricing-get-school">Get the school plan</button>
        </article>
      </section>
      <section className="mx-auto mb-12 max-w-2xl px-5 text-center text-xs leading-5 text-slate-500" data-testid="pricing-why">
        <p>A.R.I.S.E. Reader started free. As it has grown, running costs have outgrown what one teacher can cover, so we now charge a small price. Everyone who signed up before November 9, 2026 stays free for the 2026-27 school year.</p>
        <p className="mt-1">Can't afford it? <button onClick={() => navigate("/scholarship")} className="font-semibold text-violet-700 underline underline-offset-2" data-testid="pricing-scholarship">Apply for a free account</button>.</p>
      </section>
      <footer className="px-5 pb-8 text-center text-xs text-slate-500">A.R.I.S.E. — Advocating, Resilience, Inclusion, Support, Empowerment.</footer>
    </main>
  );
}
