import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { PLANS, usd } from "@shared/plans";
import "./pricing.css";

/** One public pricing page for both Arise Reader and Arise To Do. */
export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Visitors using a saved /app#/pricing link should see the light homepage's
  // pricing section, not this Reader-focused React view.
  const onTodoDomain = typeof window !== "undefined" && /^(www\.)?arisetodo\.com$/i.test(window.location.hostname);
  useEffect(() => {
    if (onTodoDomain) window.location.replace("/#pricing");
  }, [onTodoDomain]);
  if (onTodoDomain) return <main className="min-h-screen bg-[#f9fafc] p-10 text-center"><a href="/#pricing">Open Arise To Do pricing</a></main>;

  const home = () => { window.location.assign("https://www.arisereader.com/"); };
  const startReading = () => { window.location.assign("https://www.arisereader.com/#/signin"); };
  const teacherPlan = () => {
    if (user?.role === "teacher" || user?.isAdmin) navigate("/billing");
    else window.location.assign("https://www.arisereader.com/#/teacher-signup");
  };
  const kids = PLANS.parentMaxChildren;
  const startFree = () => { window.location.assign("https://www.arisereader.com/#/signin"); };
  return (
    <main className="pr min-h-screen bg-[#f7f8ff] text-[#191b35]">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
        <button className="text-xl font-black tracking-tight" onClick={home}>Arise <span className="text-violet-700">Reader</span></button>
        <div className="flex items-center gap-3"><button onClick={home} className="rounded-full px-3 py-2 text-sm font-bold">Back to home</button><button onClick={startReading} className="rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white">Sign in</button></div>
      </header>
      <section className="mx-auto max-w-4xl px-5 pb-8 pt-10 text-center">
        <p className="text-xs font-black uppercase tracking-[.22em] text-violet-700">Simple, straightforward pricing</p>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">Free for every reader.<br/><span className="text-violet-700">Schools get the teacher tools.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Arise Reader is free for students and parents: every book, every quiz, every reward. Teacher accounts, with classes and the teacher dashboard, come with a school or district license.</p>
      </section>
      <section className="mx-auto grid grid-cols-1 max-w-6xl gap-5 px-5 pb-12 lg:grid-cols-3" aria-label="Plans">
        <article className="rounded-[1.75rem] border-2 border-violet-600 bg-white p-6 shadow-xl shadow-violet-100" data-testid="pricing-family">
          <p className="text-xs font-black uppercase tracking-widest text-violet-600">Students &amp; parents</p>
          <h2 className="mt-3 text-2xl font-black">Free</h2>
          <p className="mt-3 text-5xl font-black">$0</p>
          <p className="mt-4 text-sm leading-6 text-slate-600">For every student and parent, with up to {kids} children linked to a parent.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Reading library &amp; book quizzes</li><li>✓ Progress, achievements &amp; points</li><li>✓ Games &amp; accessible reading</li><li>✓ Rewards you set for your child</li><li>✓ Parent dashboard for every child</li></ul>
          <button onClick={startFree} className="mt-7 w-full rounded-xl bg-violet-700 px-5 py-3 font-bold text-white" data-testid="pricing-get-family">Start reading free</button>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pricing-school">
          <p className="text-xs font-black uppercase tracking-widest text-sky-700">Schools</p>
          <h2 className="mt-3 text-2xl font-black">Whole School</h2>
          <p className="mt-3 text-5xl font-black">{usd(PLANS.school.yearlyCents)} <span className="text-sm font-semibold text-slate-500">/ school year</span></p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Every teacher and every student at your school, each teacher with their own account.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Teacher accounts &amp; classroom dashboard</li><li>✓ Up to {PLANS.school.studentCap.toLocaleString("en-US")} students</li><li>✓ Live class games, goals &amp; challenges</li><li>✓ Custom quizzes &amp; class prizes</li><li>✓ One bill for the whole school</li></ul>
          <button onClick={teacherPlan} className="mt-7 w-full rounded-xl bg-sky-700 px-5 py-3 font-bold text-white" data-testid="pricing-get-school">Get the school plan</button>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pricing-district">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Districts &amp; networks</p>
          <h2 className="mt-3 text-2xl font-black">District</h2>
          <p className="mt-3 text-5xl font-black">{usd(PLANS.district.yearlyCents)} <span className="text-sm font-semibold text-slate-500">/ year</span></p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Every school in your district or charter network on one license, up to {PLANS.district.studentCap.toLocaleString("en-US")} students.</p>
          <ul className="mt-6 space-y-3 text-sm font-semibold"><li>✓ Everything in the school plan, at every school</li><li>✓ District-wide reports</li><li>✓ One contract and one yearly bill</li></ul>
          <a href="https://arisetodo.com/support/" target="_blank" rel="noopener noreferrer" className="mt-7 block w-full rounded-xl bg-emerald-700 px-5 py-3 text-center font-bold text-white" data-testid="pricing-district-contact">Ask about a district license</a>
        </article>
      </section>
      <section className="mx-auto mb-12 max-w-2xl px-5 text-center text-xs leading-5 text-slate-500" data-testid="pricing-why">
        <p>Teachers who signed up before November 23, 2026 keep their teacher accounts. Students can always read free on their own accounts, with or without a school license.</p>
        <p className="mt-2">School can't fit it in the budget? <button onClick={() => navigate("/scholarship")} className="font-bold text-violet-700 underline" data-testid="pricing-scholarship">Ask for a scholarship</button></p>
      </section>
      <footer className="px-5 pb-8 text-center text-xs text-slate-500">A.R.I.S.E. — Advocating, Resilience, Inclusion, Support, Empowerment.</footer>
    </main>
  );
}
