// The sign-in and sign-up screens of the Arise To Duo iPhone app (only inside the app; the website
// keeps pages/SignIn.tsx). Built like an iPhone app's first screen: a welcome page with Sign in with
// Apple first, then email sign-in and a free account on their own screens, with grouped fields,
// a back button, and nothing that reads like a web page (no header, no marketing columns, no
// sample accounts). Signing in here is the same account as the website's.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Bell, Briefcase, ChevronLeft, Eye, EyeOff, HeartHandshake, Loader2, Mail } from "lucide-react";
import ForgotSignIn from "@/components/auth/ForgotSignIn";
import { useAuth } from "@/context/AuthContext";
import { APPLE_LOGO_PATH, appleSignInAvailable, askApple } from "@/lib/appleSignIn";
import { LEGAL } from "@/lib/nativeApp";
import { API_BASE } from "@/lib/queryClient";
import { TEACHER_CONFIRM_KEY } from "@shared/schoolEmail";

type Screen = "welcome" | "signin" | "signup" | "code" | "forgot";

/** Both hubs open with their menus showing after a first sign-in in the app. */
const showHubMenus = () => { try { localStorage.setItem("arise-hub-rail", "open"); localStorage.setItem("arise-life-rail", "open"); } catch { /* default menus */ } };

const font = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif" };

export default function NativeSignIn() {
  const { login, signInWithApple } = useAuth();
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeFor, setCodeFor] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"" | "apple" | "form">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const go = (next: Screen) => { setScreen(next); setError(""); setNotice(""); setShow(false); if (next !== "code") setCode(""); };

  const run = async (kind: "apple" | "form", fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind); setError("");
    try { await fn(); }
    catch (e: any) {
      if (e?.confirmEmail) { try { sessionStorage.setItem(TEACHER_CONFIRM_KEY, e.username || username.trim()); } catch { /* the page asks again */ } navigate("/teacher-signup"); return; }
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally { setBusy(""); }
  };

  // Sign in with Apple: signs in, or makes a free account the first time.
  const withApple = () => run("apple", async () => {
    const apple = await askApple("com.arisereader.arisetodo");
    if (!apple) return; // closed the Apple sheet
    await signInWithApple(apple);
    showHubMenus();
  });

  const signIn = (e: FormEvent) => { e.preventDefault(); void run("form", async () => { await login(username.trim(), password); showHubMenus(); }); };

  const signUp = (e: FormEvent) => {
    e.preventDefault();
    void run("form", async () => {
      const clean = username.trim().toLowerCase();
      if (name.trim().length < 2) throw new Error("Enter your name.");
      if (!/^[a-z0-9_-]{3,30}$/.test(clean)) throw new Error("Usernames are 3–30 letters, numbers, dashes or underscores.");
      if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(email.trim())) throw new Error("Enter an email address we can send a code to.");
      if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
      const res = await fetch(`${API_BASE}/api/arise-todo/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: clean, displayName: name.trim(), password, email: email.trim() }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Couldn't create your account.");
      // The account stays off until the emailed code is typed back (unless no code could be sent).
      if (data?.confirmEmail) { setCodeFor(clean); setNotice(data?.message || ""); setScreen("code"); return; }
      await login(clean, password); showHubMenus();
    });
  };

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    void run("form", async () => {
      const res = await fetch(`${API_BASE}/api/arise-todo/confirm-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: codeFor, code }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "That code didn't work.");
      await login(codeFor, password); showHubMenus();
    });
  };

  const resend = () => void run("form", async () => {
    const res = await fetch(`${API_BASE}/api/arise-todo/resend-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: codeFor }) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "Couldn't send another code.");
    setNotice(data?.message || "A new code is on its way.");
  });

  const apple = appleSignInAvailable();

  if (screen === "welcome") return <Shell>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
      <img src="/icon-512.png" alt="" width={88} height={88} className="h-[88px] w-[88px] rounded-[22px] shadow-[0_18px_40px_-16px_rgba(76,58,190,.55)] ring-1 ring-black/5" />
      <h1 className="mt-6 text-[34px] font-bold leading-[1.1] tracking-[-.02em] text-[#111018]">Arise To Duo</h1>
      <p className="mt-2 max-w-[18rem] text-[17px] leading-snug text-[#6b6879] [text-wrap:balance]">Your life and your work, side by side.</p>
      <ul className="mt-9 w-full max-w-[20rem] space-y-5 text-left">
        <Feature tint="#6a55dc" icon={<HeartHandshake className="h-[22px] w-[22px]" />} title="LifeHub" text="Home, family, calendar, health and money." />
        <Feature tint="#0f766e" icon={<Briefcase className="h-[22px] w-[22px]" />} title="WorkHub" text="Projects, meetings and to-dos for work." />
        <Feature tint="#e0465f" icon={<Bell className="h-[22px] w-[22px]" />} title="Reminders" text="A heads-up before what matters, on your iPhone." />
      </ul>
    </div>
    <div className="shrink-0 space-y-3 px-6 pb-2">
      {apple && <button type="button" onClick={withApple} disabled={!!busy} data-testid="native-apple"
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-black text-[17px] font-semibold text-white transition active:opacity-80 disabled:opacity-60">
        {busy === "apple" ? <Loader2 className="h-5 w-5 animate-spin" /> : <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={APPLE_LOGO_PATH} /></svg>}
        Continue with Apple
      </button>}
      <button type="button" onClick={() => go("signin")} disabled={!!busy} data-testid="native-email"
        className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold transition active:opacity-80 disabled:opacity-60 ${apple ? "bg-[#ecebf3] text-[#111018]" : "bg-[#5b4fe0] text-white"}`}>
        <Mail className="h-5 w-5" /> Sign in with email
      </button>
      <button type="button" onClick={() => go("signup")} className="flex h-11 w-full items-center justify-center text-[15px] font-semibold text-[#5b4fe0]" data-testid="native-create">Create a free account</button>
      {error && <p role="alert" className="text-center text-[14px] text-[#d0263e]">{error}</p>}
      <Legal />
    </div>
  </Shell>;

  if (screen === "forgot") return <Shell>
    <NavBar title="Forgot sign-in" onBack={() => go("signin")} />
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-2">
      <p className="mb-4 text-[15px] leading-snug text-[#6b6879]">We'll email your username and a link to choose a new password.</p>
      <ForgotSignIn />
    </div>
  </Shell>;

  if (screen === "code") return <Shell>
    <NavBar title="" onBack={() => go("signup")} />
    <form onSubmit={confirm} className="flex min-h-0 flex-1 flex-col px-5">
      <Heading title="Check your email" text={notice || `We sent a 6-digit code to ${email.trim()}. It can take a minute, so check your junk folder too.`} />
      <input aria-label="6-digit code" required autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} data-testid="native-code"
        className="h-[60px] w-full rounded-[14px] bg-white text-center text-[28px] font-semibold tracking-[.45em] text-[#111018] outline-none ring-1 ring-black/[.06] focus:ring-2 focus:ring-[#5b4fe0]" />
      <Message error={error} notice="" />
      <div className="mt-auto space-y-2 pb-2 pt-6">
        <Primary busy={busy === "form"} disabled={code.length < 6}>Confirm</Primary>
        <button type="button" onClick={resend} disabled={!!busy} className="h-11 w-full text-[15px] font-semibold text-[#5b4fe0] disabled:opacity-50">Send a new code</button>
      </div>
    </form>
  </Shell>;

  const signingUp = screen === "signup";
  return <Shell>
    <NavBar title="" onBack={() => go("welcome")} />
    <form onSubmit={signingUp ? signUp : signIn} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
      <Heading title={signingUp ? "Create your account" : "Sign in"} text={signingUp ? "Free, for anyone. You get LifeHub and WorkHub." : "Use your Arise To Duo or A.R.I.S.E. Reader account."} />
      <Group>
        {signingUp && <Field label="Name" value={name} onChange={setName} autoComplete="name" placeholder="Your name" testId="native-name" />}
        <Field label="Username" value={username} onChange={setUsername} autoComplete="username" placeholder={signingUp ? "Choose a username" : "Username or email"} testId="native-username" plain />
        {signingUp && <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="you@example.com" testId="native-signup-email" plain />}
        <Field label="Password" value={password} onChange={setPassword} type={show ? "text" : "password"} autoComplete={signingUp ? "new-password" : "current-password"} placeholder={signingUp ? "8 or more characters" : "Required"} testId="native-password" plain
          trailing={<button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="-mr-2 grid h-11 w-11 place-items-center text-[#8e8b9c]">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>} />
      </Group>
      {!signingUp && <button type="button" onClick={() => go("forgot")} className="mt-3 self-start px-1 py-2 text-[15px] font-semibold text-[#5b4fe0]">Forgot username or password?</button>}
      {signingUp && <p className="mt-3 px-1 text-[13px] leading-snug text-[#8e8b9c]">We'll email a 6-digit code to confirm it. Your email is also how you reset your password.</p>}
      <Message error={error} notice={notice} />
      <div className="mt-auto space-y-3 pb-2 pt-8">
        <Primary busy={busy === "form"} disabled={!username.trim() || !password || (signingUp && (!name.trim() || !email.trim()))}>{signingUp ? "Create account" : "Sign in"}</Primary>
        {apple && <button type="button" onClick={withApple} disabled={!!busy}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-black text-[17px] font-semibold text-white active:opacity-80 disabled:opacity-60">
          {busy === "apple" ? <Loader2 className="h-5 w-5 animate-spin" /> : <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={APPLE_LOGO_PATH} /></svg>}
          {signingUp ? "Sign up with Apple" : "Sign in with Apple"}
        </button>}
        <button type="button" onClick={() => go(signingUp ? "signin" : "signup")} className="h-11 w-full text-[15px] text-[#6b6879]">
          {signingUp ? <>Already have an account? <b className="font-semibold text-[#5b4fe0]">Sign in</b></> : <>New to Arise To Duo? <b className="font-semibold text-[#5b4fe0]">Create an account</b></>}
        </button>
      </div>
    </form>
  </Shell>;
}

/** The whole screen: the iPhone's safe areas, a soft page colour, no page scroll behind it. */
function Shell({ children }: { children: ReactNode }) {
  useEffect(() => { const was = document.documentElement.style.background; document.documentElement.style.background = "#f6f5fb"; return () => { document.documentElement.style.background = was; }; }, []);
  return <main className="fixed inset-0 flex flex-col overflow-hidden bg-[#f6f5fb] pb-[max(12px,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-[#111018]" style={font} data-testid="native-signin">
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[45%] bg-[radial-gradient(80%_70%_at_50%_0%,rgba(122,104,235,.16),transparent_70%)]" />
    <div className="relative mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">{children}</div>
  </main>;
}

function NavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return <div className="relative flex h-11 shrink-0 items-center px-2">
    <button type="button" onClick={onBack} className="flex h-11 items-center gap-0.5 pr-3 text-[17px] text-[#5b4fe0]" data-testid="native-back"><ChevronLeft className="h-7 w-7" strokeWidth={2.2} />Back</button>
    {title && <span className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold">{title}</span>}
  </div>;
}

function Heading({ title, text }: { title: string; text: string }) {
  return <div className="mb-6 mt-3 px-1">
    <h1 className="text-[30px] font-bold leading-tight tracking-[-.02em]">{title}</h1>
    <p className="mt-1.5 text-[15px] leading-snug text-[#6b6879]">{text}</p>
  </div>;
}

function Feature({ tint, icon, title, text }: { tint: string; icon: ReactNode; title: string; text: string }) {
  return <li className="flex items-center gap-4">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white" style={{ background: tint }}>{icon}</span>
    <span className="min-w-0"><span className="block text-[16px] font-semibold leading-tight">{title}</span><span className="mt-0.5 block text-[14px] leading-snug text-[#6b6879]">{text}</span></span>
  </li>;
}

/** Fields grouped like iPhone Settings: one white card, rows separated by hairlines. */
function Group({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-black/[.07] overflow-hidden rounded-[14px] bg-white ring-1 ring-black/[.04]">{children}</div>;
}

function Field({ label, value, onChange, type = "text", autoComplete, placeholder, trailing, testId, plain }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete: string; placeholder: string; trailing?: ReactNode; testId: string;
  /** Usernames, emails and passwords: no capitals, spelling or autocorrect. */ plain?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return <label className="flex min-h-[52px] items-center gap-3 px-4" onClick={() => ref.current?.focus()}>
    <span className="w-[5.75rem] shrink-0 text-[16px] font-medium">{label}</span>
    {/* 17px text: iPhone never zooms the page when a field is tapped. */}
    <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} type={type} autoComplete={autoComplete} placeholder={placeholder} data-testid={testId}
      {...(plain ? { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } : {})}
      className="h-[52px] min-w-0 flex-1 bg-transparent text-[17px] text-[#111018] outline-none placeholder:text-[#b3b0c0]" />
    {trailing}
  </label>;
}

function Primary({ busy, disabled, children }: { busy: boolean; disabled?: boolean; children: ReactNode }) {
  return <button type="submit" disabled={busy || disabled} data-testid="native-submit"
    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#5b4fe0] text-[17px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(91,79,224,.8)] transition active:opacity-85 disabled:opacity-45 disabled:shadow-none">
    {busy && <Loader2 className="h-5 w-5 animate-spin" />}{children}
  </button>;
}

function Message({ error, notice }: { error: string; notice: string }) {
  if (error) return <p role="alert" className="mt-4 rounded-[12px] bg-[#fdecef] px-4 py-3 text-[14px] leading-snug text-[#b4182f]">{error}</p>;
  if (notice) return <p role="status" className="mt-4 rounded-[12px] bg-white px-4 py-3 text-[14px] leading-snug text-[#3d3a4b]">{notice}</p>;
  return null;
}

function Legal() {
  return <p className="px-4 pt-1 text-center text-[12px] leading-snug text-[#8e8b9c]">
    By continuing you agree to the <a href={LEGAL.terms} target="_blank" rel="noreferrer" className="underline underline-offset-2">Terms of Use</a> and <a href={LEGAL.privacy} target="_blank" rel="noreferrer" className="underline underline-offset-2">Privacy Policy</a>.
  </p>;
}
