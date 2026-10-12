// Public homepage for arisetodo.com (logged-out visitors on the todo domain).
// Every claim here maps to a real feature in Arise LifeHub / Arise WorkHub —
// see shared/familyHub.ts (FAMILY_SECTIONS, SECTION_INFO in components/family-hub/Members.tsx),
// shared/pluginKit*.ts (the App Store's 100+ daily card apps) and client/src/pages/TeacherHub.tsx
// (caseloads, IEP timelines, lessons, attendance, gradebook) for the source of truth.
import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, Blocks, Brain, Calendar, Check, CheckSquare, ChefHat, ChevronRight, Compass,
  GraduationCap, Heart, LayoutGrid, LogIn, Puzzle, Repeat, Settings2, ShoppingBag, ShoppingCart,
  Sparkles, Sun, Target, Timer, UserPlus, Users, Wallet, Wrench,
} from "lucide-react";

// What the app actually does, grouped the way LifeHub groups it. Each label/detail
// is taken from, or closely paraphrases, shared/familyHub.ts's SECTION_INFO.
const coreFeatures = [
  {
    icon: CheckSquare,
    tag: "TASKS, DONE RIGHT",
    title: "To-do lists that actually fit your life",
    pitch: "Lists, due dates, repeat rules and assignees for every person in the family or team. See everything, today's tasks, upcoming, or what's done.",
    points: ["Recurring tasks (daily, weekly, custom)", "Assign tasks to anyone in the family", "A daily brief: today, at a glance, every morning"],
    accent: "from-violet-500/25 to-indigo-500/10",
    iconColor: "text-violet-300",
  },
  {
    icon: LayoutGrid,
    tag: "YOUR HUB, YOUR SHAPE",
    title: "The only to-do app that reshapes itself around you",
    pitch: "Most to-do apps give you a list. Arise gives you a home base you build: pick which sections you want, drag them into the order you want, and group them into your own folders.",
    points: ["70+ built-in sections to turn on or off", "Drag-to-reorder menu and a customizable Home screen", "Your own folders — group things the way your brain works, not ours"],
    accent: "from-fuchsia-500/25 to-rose-500/10",
    iconColor: "text-fuchsia-300",
  },
  {
    icon: ShoppingBag,
    tag: "THE APP STORE",
    title: "Over 100 add-on apps, built in",
    pitch: "Browse the Arise App Store and add exactly what your household needs: trackers, calculators, daily prompts and more, each one a tap away in your hub.",
    points: ["Habit and routine trackers with streaks", "A joke, fact, riddle or question every day — freshly stocked, not the same 14 on a loop", "Calculators for age, tips, savings goals, unit conversions and more"],
    accent: "from-amber-500/25 to-orange-500/10",
    iconColor: "text-amber-300",
  },
];

// Beyond the task list: the rest of the hub, grouped loosely by what kind of day it helps with.
const lifeExtras = [
  { icon: Calendar, title: "Shared calendar", text: "Family or team events, color-coded, with reminders." },
  { icon: Users, title: "Everyone in one place", text: "Add every family or team member, each with their own tasks and chores." },
  { icon: Wallet, title: "Bills & budget", text: "Due dates, autopay tracking and a simple monthly budget." },
  { icon: ChefHat, title: "Recipes & meal planning", text: "A recipe box that turns into a grocery list in one tap." },
  { icon: ShoppingCart, title: "Grocery lists", text: "Sorted by aisle, so the store trip actually goes fast." },
  { icon: Repeat, title: "Habits & routines", text: "Daily habits with streaks, and checklists that reset fresh every day." },
  { icon: Wrench, title: "Home & car upkeep", text: "Filters, oil changes, warranties — tracked before they become emergencies." },
  { icon: Heart, title: "Journal & gratitude", text: "A private daily journal with prompts, and three good things a day." },
  { icon: Compass, title: "Goals & bucket list", text: "Track progress on what matters this year, and someday." },
];

const adhdPoints = [
  { icon: Sun, title: "One daily brief, not six apps", text: "Every morning, what's due, what's overdue and what's next — in one glance, instead of hunting across lists in your head." },
  { icon: Timer, title: "A built-in focus timer", text: "Work in focused blocks with real breaks, right next to your task list — no separate app to remember to open." },
  { icon: LayoutGrid, title: "Hide everything you don't need today", text: "Turn off sections that add noise. A simpler hub means fewer places for a task to get lost." },
  { icon: Repeat, title: "Routines that reset themselves", text: "Daily checklists and recurring tasks come back on their own, so remembering isn't the whole job." },
  { icon: Target, title: "Small, visible wins", text: "Streaks and progress you can actually see tend to stick better than a list that just grows." },
];

const teacherPoints = [
  { icon: Users, title: "Caseloads, not spreadsheets", text: "Every student, their accommodations, IEP and reevaluation dates, in one place you control." },
  { icon: Calendar, title: "IEP & meeting timelines", text: "See what's coming up before it's urgent." },
  { icon: GraduationCap, title: "Lessons, attendance & gradebook", text: "The daily classroom tools, built into the same hub as your own to-do list." },
  { icon: Brain, title: "Teacher-made, in the App Store", text: "SEL ideas, de-escalation strategies, IEP goal frames, bell ringers and more — dozens of ready-made decks for the days you need a quick idea, not a lesson plan." },
];

const steps = [
  { title: "Create your account", text: "Takes about a minute. Free forever, with no card or trial required." },
  { title: "Turn on what you need", text: "Pick your sections from the App Store, or start with just a task list." },
  { title: "Shape it as you go", text: "Reorder, fold things into your own folders, add more from the App Store anytime." },
];

export default function TodoLanding() {
  const [, navigate] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const signUp = () => navigate("/register-independent");
  const logIn = () => navigate("/signin");

  return (
    <main className="min-h-screen bg-[#07060f] text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[120px]" />
        <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-fuchsia-400/12 blur-[100px]" />

        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-5 sm:px-8">
          <span className="text-sm font-black tracking-wide">A.R.I.S.E. <span className="text-violet-300">To-Do</span></span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.location.assign("https://www.arisereader.com/#/pricing")} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-bold text-slate-300 hover:text-white">Learning plans</button>
            <button onClick={logIn} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-slate-300 hover:text-white">
              <LogIn className="h-4 w-4" /> Log in
            </button>
            <button onClick={signUp} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-black text-slate-950 transition hover:scale-[1.03]">
              <UserPlus className="h-4 w-4" /> Sign up free
            </button>
          </div>
        </div>

        {/* Hero */}
        <section className="relative mx-auto max-w-4xl px-5 pb-14 pt-10 text-center sm:pb-20 sm:pt-14">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.24em] text-violet-200">
            <Sparkles className="h-4 w-4" /> 100% free for parents, teachers and families
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-[-.04em] sm:text-6xl">
            Your free to-do app with <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">ultimate customization</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300 sm:text-lg">
            Tasks, calendar, chores, meals, budget, habits and over 100 add-on apps — turn on what you need, hide what you don't, and arrange it all your way. Built for families. Just as fantastic for teachers.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={signUp} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.03]">
              <UserPlus className="h-4 w-4" /> Get started free
            </button>
            <span className="text-sm font-semibold text-emerald-200">Free forever · No trial or credit card</span>
          </div>
        </section>
      </div>

      {/* Customization deep dive */}
      <section className="border-t border-white/10 px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[.25em] text-fuchsia-300">Ultimate customization</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Not a template. A hub you build.</h2>
              <p className="mt-4 text-sm font-semibold leading-7 text-slate-300">
                Most to-do apps hand you one fixed layout and call it done. Arise starts with the basics — tasks, a calendar, a daily brief — and lets you add from over 100 App Store apps, turn off anything you don't use, drag the menu into your own order, and group it all into folders that make sense to you.
              </p>
              <ul className="mt-5 space-y-2.5">
                {["Turn 70+ sections on or off, anytime", "Drag-to-reorder your menu and Home screen", "Build your own folders instead of one long list", "Add daily-prompt apps from the App Store — jokes, facts, habits, calculators and more"].map(t => (
                  <li key={t} className="flex gap-2 text-sm leading-6 text-slate-200">
                    <Blocks className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-fuchsia-500/15 to-violet-500/10 p-6">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-fuchsia-200">
                <ShoppingBag className="h-4 w-4" /> From the App Store
              </div>
              <div className="mt-4 space-y-2.5">
                {["Habit & routine trackers", "Daily joke, fact or riddle", "Chore charts with rewards", "Age, tip & savings calculators", "Recipe box → grocery list", "Focus timer with breaks"].map(t => (
                  <div key={t} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm font-bold">
                    <Puzzle className="h-4 w-4 shrink-0 text-amber-300" />{t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core features */}
      <section className="px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-violet-300">What you get</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">A to-do list that becomes your whole hub</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {coreFeatures.map(({ icon: Icon, tag, title, pitch, points, accent, iconColor }) => (
              <article key={tag} className={`flex flex-col rounded-[28px] border border-white/10 bg-gradient-to-br ${accent} p-6`}>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/30 ring-1 ring-white/10">
                    <Icon className={`h-6 w-6 ${iconColor}`} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-[.24em] ${iconColor}`}>{tag}</span>
                </div>
                <h3 className="mt-4 text-xl font-black leading-snug">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{pitch}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {points.map(p => (
                    <li key={p} className="flex gap-2 text-sm leading-6 text-slate-200">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />{p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Life extras */}
      <section className="border-y border-white/10 bg-white/[.025] px-4 py-12 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">Beyond the task list</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Everything a household actually juggles</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-400">A sample of the 70+ sections in the App Store. Add only what you'll use — the rest stay out of your way.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lifeExtras.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
                <div>
                  <div className="font-black">{title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ADHD-friendly */}
      <section className="border-y border-white/10 bg-white/[.025] px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Built to help, not overwhelm</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Especially good for an ADHD brain</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
            Arise isn't a clinical tool, but the same customization that makes it flexible for anyone tends to help a lot if your brain works in bursts, needs fewer places to look, or does better with routines that show up on their own.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {adhdPoints.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-transparent p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/30 ring-1 ring-white/10">
                  <Icon className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <div className="font-black">{title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Teachers too */}
      <section className="px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-emerald-300">Also fantastic for teachers</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Built for families. Just as at home in a classroom.</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
            Parents and teachers both get free access to the Work and Life hubs, with tools for schedules, organization, school and everyday life. The A.R.I.S.E. portal also connects you to your authorized Reader, Math, History and other programs.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {teacherPoints.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/30 ring-1 ring-white/10">
                  <Icon className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <div className="font-black">{title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold text-slate-400">
            Both A.R.I.S.E. To-Do hubs are free for parents and teachers. Reader is free for students and parents (up to 3 children). Optional learning bundles are explained on the <button onClick={() => window.location.assign("https://www.arisereader.com/#/pricing")} className="font-black text-emerald-300 hover:underline">pricing page</button>.
          </p>
        </div>
      </section>

      {/* Get started */}
      <section className="border-t border-white/10 px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-violet-300">Get started</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Set up in three steps</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-sm font-black">{i + 1}</div>
                <div className="mt-3 font-black">{s.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{s.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-r from-violet-600/30 via-fuchsia-600/20 to-amber-500/20 p-7 text-center sm:p-10">
            <Settings2 className="mx-auto h-8 w-8 text-violet-200" />
            <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-black sm:text-4xl">Build the hub that fits your life.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-200">Start with a simple task list, or turn on everything at once. A.R.I.S.E. To-Do is free—there is no trial, subscription or payment required.</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={signUp} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.03]">
                Create your free account <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => window.location.assign("https://www.arisereader.com/#/pricing")} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 text-sm font-black transition hover:bg-white/10">
                See pricing
              </button>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-300">Already have an account? <button onClick={logIn} className="font-black text-violet-200 hover:underline">Log in</button></p>
          </div>
        </div>
      </section>
    </main>
  );
}
