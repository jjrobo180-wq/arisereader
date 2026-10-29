// The one sign-in screen for A.R.I.S.E., on arisereader.com and arisetodo.com alike.
// "Teacher or parent" is the default tab: after signing in, adults always land in their hub on
// arisetodo.com (WorkHub for teachers, LifeHub for parents). The "Student" tab is the same form
// with student wording; students go to their A.R.I.S.E. Reader library. (AppRoutes and
// AfterSignIn do the sending; this page only signs in.)
import ForgotSignIn from "@/components/auth/ForgotSignIn";
import { LEGAL } from "@/lib/nativeApp";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { TEACHER_CONFIRM_KEY } from "@shared/schoolEmail";
import { API_BASE } from "@/lib/queryClient";
import { isTodoHost } from "@/lib/hubs";
import {
  ArrowLeft, ArrowRight, BookOpen, Briefcase, Check, ChevronRight, Eye, EyeOff,
  GraduationCap, Heart, LockKeyhole, Sparkles, UserRound, Users
} from "lucide-react";

type Who = "adult" | "student";
type SampleType = "student" | "eye-gaze" | "parent";

const studentAccounts = [
  { label: "School student", description: "Read and play with your school", path: "/register", icon: Users },
  { label: "Independent student", description: "Build your own reading adventure", path: "/register-independent", icon: UserRound },
] as const;

export default function SignIn() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const onTodo = isTodoHost();
  // arisetodo.com is for anyone, so it has one sign-in (students sign in on arisereader.com).
  const [who, setWho] = useState<Who>(() => !onTodo && /[?&]as=student(?:&|$)/.test(window.location.hash) ? "student" : "adult");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [personalSignup, setPersonalSignup] = useState(false);
  const [email, setEmail] = useState("");
  /** Set once the sign-up has sent a code: the form becomes "type the code we emailed you". */
  const [codeFor, setCodeFor] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const adult = who === "adult";
  // "Student sign in" and "Sign in" links switch the tab even when this screen is already open.
  useEffect(() => {
    const sync = () => setWho(!onTodo && /[?&]as=student(?:&|$)/.test(window.location.hash) ? "student" : "adult");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const pick = (next: Who) => { setWho(next); setError(""); setShowAccounts(false); setShowSamples(false); };
  const goHome = () => { if (onTodo) window.location.assign("/"); else navigate("/"); };
  const showHubMenuOnLogin = () => {
    if (!onTodo) return; // Reader-domain sign-in uses the secure To-Do handoff.
    try {
      localStorage.setItem("arise-hub-rail", "open");
      localStorage.setItem("arise-life-rail", "open");
    } catch { /* the hubs still show their default menus */ }
  };
  // A personal LifeHub account (no school needed) is made on arisetodo.com.
  const lifeHubSignup = () => { if (!onTodo) { window.location.assign("https://arisetodo.com/app#/signin"); return; } setPersonalSignup(true); setShowAccounts(false); setShowSamples(false); setError(""); };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await login(username.trim(), password);
      showHubMenuOnLogin();
      // AuthContext updates the user; the /signin route then opens their hub (or their library).
    } catch (err: any) {
      if (err?.confirmEmail) {
        try { sessionStorage.setItem(TEACHER_CONFIRM_KEY, err.username || username.trim()); } catch {}
        navigate("/teacher-signup");
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Typing the emailed code back. A right code turns the account on and signs the person in. */
  const confirmCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(""); setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/arise-todo/confirm-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: codeFor, code }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "That code didn't work.");
      await login(codeFor, password);
      showHubMenuOnLogin();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
    } finally { setSubmitting(false); }
  };

  const resendCode = async () => {
    if (submitting) return;
    setError(""); setNotice(""); setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/arise-todo/resend-code`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: codeFor }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Couldn't send another code.");
      setNotice(data?.message || "A new code is on its way.");
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Couldn't send another code.");
    } finally { setSubmitting(false); }
  };

  const handlePersonalSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9_-]{3,30}$/.test(cleanUsername)) {
        throw new Error("Username must have 3–30 letters, numbers, dashes, or underscores.");
      }
      if (displayName.trim().length < 2) {
        throw new Error("Please enter your name.");
      }
      if (password.length < 8) {
        throw new Error("Use a password with at least 8 characters.");
      }
      if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(email.trim())) {
        throw new Error("Enter an email address we can send your code to.");
      }
      const response = await fetch(`${API_BASE}/api/arise-todo/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername, displayName: displayName.trim(), password, email: email.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Couldn't create your account.");
      // The account is made switched off until the emailed code is typed back. If no code could be
      // sent, the server lets the person straight in rather than stranding them.
      if (data?.confirmEmail) { setCodeFor(cleanUsername); setNotice(data?.message || ""); return; }
      await login(cleanUsername, password);
      showHubMenuOnLogin();
      // The sign-in route opens the newly created person's LifeHub after authentication.
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Couldn't create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  const trySample = async (type: SampleType) => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const accounts = {
      student: ["sample", "sample1234"],
      "eye-gaze": ["tutorial-eye", "sample1234"],
      parent: ["sample-parent", "sample1234"],
    };
    try {
      await login(accounts[type][0], accounts[type][1]);
      showHubMenuOnLogin();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Unable to open the sample account.");
    } finally {
      setSubmitting(false);
    }
  };

  const accountButton = (label: string, description: string, Icon: typeof Users, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-[#e5e7f4] p-3 text-left transition hover:border-[#aba4f5] hover:bg-[#faf9ff]">
      <span className="grid grid-cols-1 h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eeebff] text-[#5b53df]"><Icon size={18}/></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="block text-xs text-[#717a93]">{description}</span></span><ArrowRight className="shrink-0 text-[#837da9]" size={16}/>
    </button>
  );

  return (
    <div className="min-h-[100dvh] bg-[#f8f9ff] text-[#19203b]" style={{fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <header className="border-b border-[#e8eafb] bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <button type="button" onClick={goHome} className="flex items-center gap-3 text-left" aria-label="A.R.I.S.E. home">
            <span className="grid grid-cols-1 h-11 w-11 place-items-center rounded-2xl bg-[#5b53df] text-white shadow-md shadow-violet-200"><BookOpen size={24} strokeWidth={2.3}/></span>
            <span>
              <span className="block text-[19px] font-black leading-tight tracking-[-.05em]">A.R.I.S.E.</span>
              <span className="block text-[10px] font-bold uppercase tracking-[.13em] text-[#717a95]">Reader · WorkHub · LifeHub</span>
            </span>
          </button>
          <button type="button" onClick={goHome} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e2e5f3] bg-white px-4 text-sm font-bold text-[#3a4162] transition hover:border-[#7b73ec] hover:text-[#5b53df]">
            <ArrowLeft size={17}/> Back to home
          </button>
        </div>
      </header>

      <main className="relative mx-auto grid grid-cols-1 min-h-[calc(100dvh-83px)] w-full max-w-6xl items-center gap-12 overflow-hidden px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-20 lg:py-16">
        <section className="relative order-2 max-w-xl lg:order-1">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dcd7fd] bg-[#eeebff] px-4 py-2 text-[11px] font-black uppercase tracking-[.12em] text-[#6257d7]">
            <Sparkles size={15}/> {onTodo ? "One sign-in for everyone" : adult ? "One sign-in for teachers and families" : "Your reading adventure awaits"}
          </div>
          <h1 className="max-w-lg text-4xl font-black leading-[1.09] tracking-[-.06em] sm:text-5xl xl:text-6xl">
            {adult ? <>Welcome back. <span className="text-[#5b53df]">Your hub is ready.</span></> : <>Welcome back to <span className="text-[#5b53df]">your next chapter.</span></>}
          </h1>
          <p className="mt-6 max-w-md text-base font-medium leading-8 text-[#68728b] sm:text-lg">
            {onTodo
              ? "Your Work and Life hubs, for anyone: home, family, work, school and everything in between. Already use A.R.I.S.E. Reader? Same username and password."
              : adult
              ? "Teachers open Arise WorkHub. Parents open Arise LifeHub. Same username and password on arisereader.com and arisetodo.com."
              : "Your books, quizzes, rewards, and favorite learning spaces are all right where you left them."}
          </p>
          <div className="mt-10 grid grid-cols-1 max-w-lg gap-4 sm:grid-cols-2">
            <div className="rounded-[22px] border border-[#deddf8] bg-white p-5 shadow-[0_12px_40px_rgba(68,56,122,.05)]">
              <span className="grid grid-cols-1 h-10 w-10 place-items-center rounded-xl bg-[#e9f9ee] text-[#2f9967]">{adult ? <Briefcase size={21}/> : <BookOpen size={21}/>}</span>
              <div className="mt-3 font-black">{onTodo ? "Work" : adult ? "Teachers" : "Read and discover"}</div>
              <p className="mt-1 text-xs leading-5 text-[#707992]">{onTodo ? "Projects, meetings, to-dos and your workday in WorkHub." : adult ? "Your class, caseload, plans and A.R.I.S.E. Reader tools in WorkHub." : "Find another great story."}</p>
            </div>
            <div className="rounded-[22px] border border-[#deddf8] bg-white p-5 shadow-[0_12px_40px_rgba(68,56,122,.05)]">
              <span className="grid grid-cols-1 h-10 w-10 place-items-center rounded-xl bg-[#f4eaff] text-[#795ed6]">{adult ? <Heart size={21}/> : <Sparkles size={21}/>}</span>
              <div className="mt-3 font-black">{onTodo ? "Life" : adult ? "Parents" : "Keep growing"}</div>
              <p className="mt-1 text-xs leading-5 text-[#707992]">{onTodo ? "Home, family, calendar, health and everyday plans in LifeHub." : adult ? "Your family, to-dos, calendar and your child's reading in LifeHub." : "Celebrate every reading win."}</p>
            </div>
          </div>
          <p className="mt-7 flex items-start gap-2 text-xs font-semibold text-[#7d839d]"><Check size={16} className="mt-0.5 shrink-0 text-[#409b72]"/> Designed for students, educators, families, and every kind of learner.</p>
        </section>

        <section className="relative order-1 z-10 lg:order-2">
          <div className="pointer-events-none absolute -inset-5 -z-10 rounded-[40px] bg-gradient-to-br from-[#e5ddff] via-[#f4f1ff] to-[#dcf8f9] blur-lg"/>
          <div className="rounded-[28px] border border-[#e3e5f6] bg-white p-6 shadow-[0_24px_70px_rgba(65,51,139,.10)] sm:p-8">
            {codeFor ? (
              /* The account exists but is switched off until this code is typed back. */
              <section aria-label="Confirm your email">
                <div className="mb-7">
                  <p className="text-xs font-black uppercase tracking-[.13em] text-[#695ede]">Last step</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-.045em]">Check your email</h2>
                  <p className="mt-2 text-sm leading-6 text-[#737b94]">{notice || `We sent a 6-digit code to ${email}. Enter it to finish setting up your account.`} It can take a minute, and it's worth a look in your junk folder.</p>
                </div>
                <form onSubmit={confirmCode} className="space-y-5">
                  <div>
                    <label htmlFor="personal-code" className="mb-2 block text-sm font-bold text-[#2e3653]">6-digit code</label>
                    <input id="personal-code" required autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code"
                      value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} data-testid="personal-code"
                      className="h-14 w-full rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 text-center text-2xl font-black tracking-[0.4em] text-[#17213b] outline-none focus:border-[#665ae6]"/>
                  </div>
                  {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                  <button type="submit" disabled={submitting || code.length < 6} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5b53df] px-5 text-sm font-black text-white transition hover:bg-[#4941cb] disabled:opacity-60">
                    {submitting ? "Checking…" : "Confirm and open my hubs"} <ArrowRight size={18}/>
                  </button>
                </form>
                <div className="mt-5 flex flex-col gap-2 text-center text-sm">
                  <button type="button" onClick={resendCode} disabled={submitting} className="min-h-11 font-bold text-[#5b53df] hover:underline disabled:opacity-60">Send a new code</button>
                  <button type="button" onClick={() => { setCodeFor(""); setCode(""); setError(""); setNotice(""); }} className="min-h-11 text-[#7d839d] hover:underline">Use a different email</button>
                </div>
              </section>
            ) : personalSignup ? (
              <section aria-label="Create your personal A.R.I.S.E. account">
                <div className="mb-7">
                  <p className="text-xs font-black uppercase tracking-[.13em] text-[#695ede]">{onTodo ? "Arise To Duo" : "Personal Life Hub"}</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-.045em]">Create your free account</h2>
                  <p className="mt-2 text-sm leading-6 text-[#737b94]">{onTodo ? "For anyone. No school or work email needed. You get both hubs, Work and Life." : "No school account needed. Your tasks and lists will be saved to your account."}</p>
                </div>
                <form onSubmit={handlePersonalSignup} className="space-y-5">
                  <div>
                    <label htmlFor="personal-display-name" className="mb-2 block text-sm font-bold text-[#2e3653]">Your name</label>
                    <input id="personal-display-name" required autoComplete="name" maxLength={80} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" className="h-12 w-full rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 text-base text-[#17213b] outline-none focus:border-[#665ae6]"/>
                  </div>
                  <div>
                    <label htmlFor="personal-username" className="mb-2 block text-sm font-bold text-[#2e3653]">Username</label>
                    <input id="personal-username" required autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={30} value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" className="h-12 w-full rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 text-base text-[#17213b] outline-none focus:border-[#665ae6]"/>
                  </div>
                  <div>
                    <label htmlFor="personal-email" className="mb-2 block text-sm font-bold text-[#2e3653]">Email</label>
                    <input id="personal-email" required type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={160} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 w-full rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 text-base text-[#17213b] outline-none focus:border-[#665ae6]" data-testid="personal-email"/>
                    <p className="mt-1.5 text-xs leading-5 text-[#7d839d]">We'll send a 6-digit code to confirm it. This is how you reset your password later.</p>
                  </div>
                  <div>
                    <label htmlFor="personal-password" className="mb-2 block text-sm font-bold text-[#2e3653]">Password</label>
                    <div className="relative">
                      <input id="personal-password" required type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className="h-12 w-full rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 pr-12 text-base text-[#17213b] outline-none focus:border-[#665ae6]"/>
                      <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 grid grid-cols-1 w-12 place-items-center text-[#788098]">{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                    </div>
                  </div>
                  {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                  <button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5b53df] px-5 text-sm font-black text-white transition hover:bg-[#4941cb] disabled:opacity-60">
                    {submitting ? "Creating account…" : "Create my free account"} <ArrowRight size={18}/>
                  </button>
                </form>
                <button type="button" onClick={() => { setPersonalSignup(false); setPassword(""); setError(""); }} className="mt-5 min-h-11 w-full text-center text-sm font-bold text-[#5b53df] hover:underline">Already have an account? Sign in</button>
              </section>
            ) : (
              <>
            {!onTodo && <div role="tablist" aria-label="Who is signing in" className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-[#f1f0fb] p-1">
              {([["adult", "Teacher or parent", Briefcase], ["student", "Student", GraduationCap]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" role="tab" aria-selected={who === id} onClick={() => pick(id)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${who === id ? "bg-white text-[#4d45cf] shadow-sm" : "text-[#6c7290] hover:text-[#3d3a7a]"}`}>
                  <Icon size={17}/> {label}
                </button>
              ))}
            </div>}
            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[.13em] text-[#695ede]">{onTodo ? "Arise To Duo" : adult ? "Teachers and parents" : "Student sign in"}</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-.045em]">Sign in</h2>
              <p className="mt-2 text-sm text-[#737b94]">{onTodo ? "Your hubs open as soon as you sign in." : adult ? "Your hub opens as soon as you sign in." : "Use the username and password from your teacher or parent."}</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="reader-username" className="mb-2 block text-sm font-bold text-[#2e3653]">{adult || onTodo ? "Username or email" : "Username"}</label>
                <input id="reader-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} required placeholder={adult || onTodo ? "Your username or email" : "Your username"} className="h-12 w-full rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 text-base text-[#17213b] outline-none transition focus:border-[#665ae6] focus:ring-2 focus:ring-[#dfdcff]"/>
              </div>
              <div>
                <label htmlFor="reader-password" className="mb-2 block text-sm font-bold text-[#2e3653]">Password</label>
                <div className="relative">
                  <input id="reader-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className="h-12 w-full rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 pr-12 text-base text-[#17213b] outline-none transition focus:border-[#665ae6] focus:ring-2 focus:ring-[#dfdcff]"/>
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 grid grid-cols-1 w-12 place-items-center text-[#788098] hover:text-[#5b53df]">
                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                  </button>
                </div>
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
              <button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5b53df] px-5 text-sm font-black text-white shadow-md shadow-violet-200 transition hover:bg-[#4941cb] disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Signing you in…" : onTodo ? "Sign in and open my hubs" : adult ? "Sign in and open my hub" : "Sign in to A.R.I.S.E. Reader"} <ArrowRight size={18}/>
              </button>
            </form>
            <ForgotSignIn />
            <div className="my-6 flex items-center gap-3 text-xs text-[#8b91a5]"><span className="h-px flex-1 bg-[#e5e7f4]"/><span>New to A.R.I.S.E.?</span><span className="h-px flex-1 bg-[#e5e7f4]"/></div>
            {onTodo ? <>
              {/* arisetodo.com is for anyone: the main sign-up is a free personal account with no school email.
                  Teacher accounts (which can see students' data) still confirm a school email, on their own page. */}
              <button type="button" onClick={lifeHubSignup} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d9d5fb] bg-[#f5f3ff] text-sm font-black text-[#5b53df] hover:bg-[#eeebff]" data-testid="todo-create-account">
                Create a free account <ArrowRight size={18}/>
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-[#7d839d]">
                Using A.R.I.S.E. Reader? <button type="button" onClick={() => navigate("/teacher-signup")} className="font-bold text-[#5b53df] hover:underline">Teacher with a class</button>
                {" · "}<button type="button" onClick={() => navigate("/parent-signup")} className="font-bold text-[#5b53df] hover:underline">Parent of a reader</button>
                {" · "}<a href="https://www.arisereader.com/#/signin?as=student" className="font-bold text-[#5b53df] hover:underline">Student sign in</a>
              </p>
            </> : <>
            <button type="button" aria-expanded={showAccounts} onClick={() => setShowAccounts(v => !v)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d9d5fb] bg-[#f5f3ff] text-sm font-black text-[#5b53df] hover:bg-[#eeebff]">
              Create an account <ChevronRight size={18} className={showAccounts ? "rotate-90 transition-transform" : "transition-transform"}/>
            </button>
            {showAccounts && <div className="mt-3 grid grid-cols-1 gap-2">
              {adult ? <>
                {accountButton("Teacher", "Your class, WorkHub and A.R.I.S.E. Reader tools", GraduationCap, () => navigate("/teacher-signup"))}
                {accountButton("Parent or guardian", "LifeHub for your family and your reader", Heart, () => navigate("/parent-signup"))}
                {accountButton("Just me", "A personal LifeHub, no school needed", UserRound, lifeHubSignup)}
              </> : studentAccounts.map(({ label, description, path, icon }) => accountButton(label, description, icon, () => navigate(path)))}
            </div>}
            </>}
            <button type="button" aria-expanded={showSamples} onClick={() => setShowSamples(v => !v)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#6d668c] hover:bg-[#f7f7ff] hover:text-[#554bd2]">
              <Sparkles size={17}/> Try a sample account
            </button>
            {showSamples && (adult
              ? <div className="mt-2 grid grid-cols-1 gap-2">
                  <button disabled={submitting} onClick={() => void trySample("parent")} className="min-h-12 rounded-lg border border-[#dfe1ee] bg-[#fbfbff] p-2 text-xs font-bold hover:border-[#9087eb] disabled:opacity-50">Sample parent</button>
                </div>
              : <div className="mt-2 grid grid-cols-2 gap-2">
                  <button disabled={submitting} onClick={() => void trySample("student")} className="min-h-12 rounded-lg border border-[#dfe1ee] bg-[#fbfbff] p-2 text-xs font-bold hover:border-[#9087eb] disabled:opacity-50">Student</button>
                  <button disabled={submitting} onClick={() => void trySample("eye-gaze")} className="min-h-12 rounded-lg border border-[#dfe1ee] bg-[#fbfbff] p-2 text-xs font-bold hover:border-[#9087eb] disabled:opacity-50">Eye Gazer</button>
                </div>)}
              </>
            )}
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-semibold text-[#848ba4]">
            <LockKeyhole size={14}/> Secure access to your A.R.I.S.E. account
          </div>
          <nav aria-label="Policies" className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-[#6b7290]">
            <a href={LEGAL.privacy} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">Privacy Policy</a>
            <a href={LEGAL.terms} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">Terms of Use</a>
            <a href={LEGAL.support} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">Support</a>
          </nav>
        </section>
      </main>
    </div>
  );
}
