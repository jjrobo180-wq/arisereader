// Pod+ sign in, create account and forgot password. Accounts use an email and a password; email
// codes prove the email is yours (creating an account, resetting a password, or signing in without
// one). Listening never needs an account; it's the Pod+ Membership (ad skip, creator earnings).
import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type Mode = "signin" | "signup" | "forgot" | "code";

export function AuthScreen({ api, onDone, onClose, dark, start = "signin" }: { api: Api; onDone: (token: string, email: string) => void; onClose: () => void; dark: boolean; start?: Mode }) {
  const [mode, setMode] = useState<Mode>(start);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const go = (m: Mode) => { setMode(m); setSent(false); setCode(""); setErr(""); setInfo(""); setPassword(""); setConfirm(""); };
  const ok = email.includes("@") && email.includes(".");
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e: any) { setErr(e?.message || "That didn't work. Try again."); } finally { setBusy(false); } };

  const signIn = () => run(async () => { const b = await api("/api/earshot/account/login", { method: "POST", body: { email: email.trim(), password } }); onDone(b.token, b.email); });
  const sendCode = () => run(async () => { await api("/api/earshot/account/code", { method: "POST", body: { email: email.trim() } }); setSent(true); setInfo(`We sent a 6-digit code to ${email.trim()}. Check your spam folder if it isn't there.`); });
  const verify = (withPassword: boolean) => run(async () => {
    const b = await api("/api/earshot/account/verify", { method: "POST", body: { email: email.trim(), code, ...(withPassword ? { password } : {}) } });
    onDone(b.token, b.email);
  });

  const C = dark
    ? { card: "bg-[#1c1c1c] text-[#f1f1f1]", sub: "text-[#aaaaaa]", input: "border-[#3a3a3a] bg-[#121212] text-[#f1f1f1] placeholder:text-[#777]", primary: "bg-[#f1f1f1] text-[#0f0f0f]", link: "text-[#3ea6ff]", tab: "bg-[#272727]", tabOn: "bg-[#f1f1f1] text-[#0f0f0f]", hover: "hover:bg-[#272727]" }
    : { card: "bg-white text-[#0f0f0f]", sub: "text-[#606060]", input: "border-[#d3d3d3] bg-white text-[#0f0f0f] placeholder:text-[#888]", primary: "bg-[#0f0f0f] text-white", link: "text-[#065fd4]", tab: "bg-[#f2f2f2]", tabOn: "bg-[#0f0f0f] text-white", hover: "hover:bg-[#f2f2f2]" };
  const input = `h-12 w-full rounded-xl border px-4 text-base outline-none focus:border-[#1c62b9] ${C.input}`;
  const label = `mb-1.5 block text-sm font-medium`;
  const primary = `mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-40 ${C.primary}`;
  const pwField = (id: string, value: string, set: (v: string) => void, text: string, auto: string) => <div>
    <label htmlFor={id} className={label}>{text}</label>
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} className={`${input} pr-12`} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className={`absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-full ${C.hover}`}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  </div>;
  const codeField = <div className="mt-4">
    <label htmlFor="ps-auth-code" className={label}>Code from the email</label>
    <input id="ps-auth-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className={`${input} text-center text-2xl font-bold tracking-[.4em]`} />
  </div>;
  const titles: Record<Mode, string> = { signin: "Sign in", signup: "Create your account", forgot: "Reset your password", code: "Sign in with an email code" };
  const pwOk = password.length >= 8;

  return <div role="dialog" aria-modal="true" aria-labelledby="ps-auth-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:items-center">
    <div className={`relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 shadow-2xl ${C.card}`} style={{ fontFamily: "Roboto, Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <button type="button" onClick={onClose} aria-label="Close" className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full ${C.hover}`}><X size={20} /></button>
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#ff6a1f]">Pod+</p>
      <h2 id="ps-auth-title" className="mt-1 pr-8 text-[26px] font-bold leading-tight tracking-tight">{titles[mode]}</h2>

      {(mode === "signin" || mode === "signup") && <div className={`mt-4 grid grid-cols-2 rounded-full p-1 ${C.tab}`} role="tablist">
        {(["signin", "signup"] as Mode[]).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => go(m)} className={`h-10 rounded-full text-sm font-semibold ${mode === m ? C.tabOn : ""}`}>{m === "signin" ? "Sign in" : "Create account"}</button>)}
      </div>}

      {mode === "signup" && !sent && <ul className={`mt-4 grid gap-1.5 text-sm ${C.sub}`}>
        {["Listening stays free, no account needed", "Members skip ads and can get paid for their show", "Your Pod Modes, likes and place on every device"].map((t) => <li key={t} className="flex items-center gap-2"><Check size={15} className="shrink-0 text-[#ff6a1f]" />{t}</li>)}
      </ul>}

      <form className="mt-5" onSubmit={(e) => {
        e.preventDefault(); if (busy) return;
        if (mode === "signin") { if (ok && password) signIn(); return; }
        if (!sent) { if (!ok) return; if (mode === "signup" && (!pwOk || password !== confirm)) return; sendCode(); return; }
        if (code.length !== 6) return;
        if (mode === "forgot" && (!pwOk || password !== confirm)) return;
        verify(mode !== "code");
      }}>
        {!sent && <div>
          <label htmlFor="ps-auth-email" className={label}>Email</label>
          <input id="ps-auth-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} />
        </div>}

        {mode === "signin" && <>
          <div className="mt-4">{pwField("ps-auth-pw", password, setPassword, "Password", "current-password")}</div>
          <div className="mt-2 flex justify-between text-sm"><button type="button" onClick={() => go("forgot")} className={`font-medium ${C.link}`}>Forgot password?</button><button type="button" onClick={() => go("code")} className={`font-medium ${C.link}`}>Email me a code instead</button></div>
          <button type="submit" disabled={busy || !ok || !password} className={primary}>{busy && <Loader2 size={18} className="animate-spin" />}Sign in</button>
        </>}

        {mode === "signup" && !sent && <>
          <div className="mt-4">{pwField("ps-auth-newpw", password, setPassword, "Password (at least 8 characters)", "new-password")}</div>
          <div className="mt-4">{pwField("ps-auth-confirm", confirm, setConfirm, "Confirm password", "new-password")}</div>
          {confirm && password !== confirm && <p className="mt-2 text-sm text-[#e5484d]">The passwords don't match.</p>}
          <button type="submit" disabled={busy || !ok || !pwOk || password !== confirm} className={primary}>{busy && <Loader2 size={18} className="animate-spin" />}Create account</button>
          <p className={`mt-3 text-center text-xs ${C.sub}`}>We'll email you a code to confirm it's you.</p>
        </>}

        {mode === "forgot" && !sent && <>
          <p className={`mt-3 text-sm ${C.sub}`}>We'll email you a code. Then you can choose a new password.</p>
          <button type="submit" disabled={busy || !ok} className={primary}>{busy && <Loader2 size={18} className="animate-spin" />}Email me a code</button>
        </>}
        {mode === "code" && !sent && <button type="submit" disabled={busy || !ok} className={primary}>{busy && <Loader2 size={18} className="animate-spin" />}Email me a code</button>}

        {sent && <>
          {info && <p className={`text-sm ${C.sub}`}>{info}</p>}
          {codeField}
          {mode === "forgot" && <>
            <div className="mt-4">{pwField("ps-auth-reset", password, setPassword, "New password (at least 8 characters)", "new-password")}</div>
            <div className="mt-4">{pwField("ps-auth-reset2", confirm, setConfirm, "Confirm new password", "new-password")}</div>
            {confirm && password !== confirm && <p className="mt-2 text-sm text-[#e5484d]">The passwords don't match.</p>}
          </>}
          <button type="submit" disabled={busy || code.length !== 6 || (mode === "forgot" && (!pwOk || password !== confirm))} className={primary}>{busy && <Loader2 size={18} className="animate-spin" />}{mode === "signup" ? "Confirm and create account" : mode === "forgot" ? "Save new password" : "Sign in"}</button>
          <div className="mt-3 flex justify-between text-sm"><button type="button" onClick={() => { setSent(false); setCode(""); }} className={`font-medium ${C.link}`}>Use another email</button><button type="button" onClick={sendCode} disabled={busy} className={`font-medium ${C.link}`}>Send a new code</button></div>
        </>}
      </form>

      {err && <p role="alert" className="mt-4 text-sm text-[#e5484d]">{err}</p>}
      {(mode === "forgot" || mode === "code") && <button onClick={() => go("signin")} className={`mt-5 w-full text-center text-sm font-medium ${C.link}`}>Back to sign in</button>}
    </div>
  </div>;
}
