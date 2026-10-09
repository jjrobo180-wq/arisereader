import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { ArrowLeft, ArrowRight, CheckCheck, Cloud, LockKeyhole, Users } from "lucide-react";
import { useLocation } from "wouter";

const field = "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

export default function AriseTodoSignIn() {
  const { login, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (mode === "signup") {
        if (!/^[a-z0-9_-]{3,30}$/.test(username.trim().toLowerCase())) throw new Error("Username: 3–30 letters, numbers, dashes or underscores.");
        if (password.length < 8) throw new Error("Your password needs at least 8 characters.");
        const response = await fetch(`${API_BASE}/api/arise-todo/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password, displayName: displayName.trim() }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message || "Could not create your To-Do account.");
      }
      await login(username.trim(), password);
      // We stay on /to-do: the dashboard opens as soon as auth has updated.
    } catch (err: any) {
      setError(err?.message || "Could not sign in. Try again.");
    } finally { setBusy(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f7fc] px-4 py-10 text-slate-900">
    <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_22px_80px_#3029671b] md:grid md:grid-cols-2">
      <div className="flex flex-col justify-between bg-[#272346] p-7 text-white sm:p-10">
        <div><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7965ed]"><CheckCheck size={26} /></span><p className="mt-8 text-xs font-black uppercase tracking-[.22em] text-violet-200">A.R.I.S.E. To-Do</p>
          <h1 className="mt-3 max-w-md text-4xl font-black leading-tight">One organized life. Every device.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-200">All your tasks and lists saved privately to your account. Open them at home, at work, or on the go.</p>
          <div className="mt-8 space-y-4 text-sm font-semibold text-slate-100"><p className="flex items-center gap-3"><Cloud className="h-5 w-5 text-violet-200" /> Cloud sync on phones, tablets and computers</p><p className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-violet-200" /> Your own private lists and deadlines</p><p className="flex items-center gap-3"><Users className="h-5 w-5 text-violet-200" /> For personal, family, or professional plans</p></div>
        </div>
        <button className="mt-10 inline-flex items-center gap-2 text-xs font-bold text-slate-200 hover:text-white" onClick={() => navigate("/")}><ArrowLeft size={16} /> A.R.I.S.E. Reader homepage</button>
      </div>
      <div className="p-6 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">Your personal workspace</p>
        <h2 className="mt-2 text-2xl font-black">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{mode === "login" ? "Sign in with your existing A.R.I.S.E. account or one made for To-Do." : "No school or teacher account needed. Just pick a username and password."}</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {mode === "signup" && <label className="block text-xs font-bold text-slate-700">Your name<input required autoComplete="name" maxLength={80} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" className={field + " mt-2"} /></label>}
          <label className="block text-xs font-bold text-slate-700">Username<input required autoComplete="username" maxLength={30} value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className={field + " mt-2"} /></label>
          <label className="block text-xs font-bold text-slate-700">Password<input required autoComplete={mode === "signup" ? "new-password" : "current-password"} type="password" minLength={mode === "signup" ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={field + " mt-2"} /></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
          <button disabled={busy || isLoading} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#705de0] px-4 font-bold text-white hover:bg-[#5c49cf] disabled:opacity-60">{busy ? "Working…" : mode === "login" ? "Sign in and open To-Do" : "Create my To-Do account"} <ArrowRight size={18} /></button>
        </form>
        <button type="button" className="mt-5 min-h-11 w-full text-center text-sm font-semibold text-violet-700 hover:underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "New here? Create a free To-Do account" : "Already have an account? Sign in"}</button>
        <p className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">If you already use A.R.I.S.E. Reader or Teacher Hub, your existing username and password work here too. Your tasks stay separate from school records.</p>
      </div>
    </div>
  </main>;
}