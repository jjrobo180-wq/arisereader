// Arise Notes on its own (arisetodo.com/notes/): installable on a phone from the browser, with the
// same A.R.I.S.E. accounts. Signed out it shows what Notes does, a sign-in and a free account; a
// view-only share link (#/s/…) opens without signing in.
import "../lib/accountStorageBoot";
import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { CheckCircle2, Eye, EyeOff, Loader2, Mic, Shield, Sparkles, Upload } from "lucide-react";
import "../index.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { installMediaUnlock, voiceElement } from "@/lib/mediaUnlock";
import { configureAiVoice } from "@/lib/aiVoice";
import { API_BASE } from "@/lib/queryClient";
import NotesApp, { Logo } from "@/components/arise-notes/NotesApp";
import PrivacyPage from "@/components/arise-notes/PrivacyPage";
import { notesApi } from "@/components/arise-notes/api";
import { fmtClock, speakerName, templateOf, type NoteSummary, type Segment } from "@shared/ariseNotes";
import "@/components/arise-notes/notes.css";

installMediaUnlock();
configureAiVoice({ base: API_BASE, element: voiceElement });
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

const shareToken = () => /^#\/s\/([A-Za-z0-9_-]{16,64})/.exec(window.location.hash)?.[1] ?? "";
const mainApp = () => (/^(www\.)?arisetodo\.com$/i.test(window.location.hostname) ? "/app#" : "/#");

function Root() {
  const { user, isLoading } = useAuth();
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const f = () => setHash(window.location.hash); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  const token = shareToken();
  if (token) return <div className="an-root min-h-[100dvh]"><SharedNote token={token} /></div>;
  if (isLoading) return <div className="an-root grid min-h-[100dvh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--an-faint)]" /></div>;
  if (!user) return <div className="an-root min-h-[100dvh]">{/^#\/privacy/.test(hash) ? <PrivacyPage onBack={() => { window.location.hash = "#/"; }} /> : <Welcome />}</div>;
  return <NotesApp mode="standalone" />;
}

// ─── Signed out ──────────────────────────────────────────────────────────────
function Welcome() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"in" | "up" | "code">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.message || "That didn't work. Try again.");
    return d;
  };
  const run = (fn: () => Promise<void>) => async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(""); try { await fn(); } catch (x: any) { setError(x?.message || "That didn't work."); } finally { setBusy(false); } };
  const signIn = run(async () => { await login(username.trim(), password); });
  const signUp = run(async () => {
    const clean = username.trim().toLowerCase();
    if (name.trim().length < 2) throw new Error("Enter your name.");
    if (!/^[a-z0-9_-]{3,30}$/.test(clean)) throw new Error("Usernames are 3–30 letters, numbers, dashes or underscores.");
    if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
    const d = await post("/api/arise-todo/register", { username: clean, displayName: name.trim(), password, email: email.trim() });
    if (d?.confirmEmail) { setNotice(d.message || `We sent a 6-digit code to ${email.trim()}.`); setMode("code"); return; }
    await login(clean, password);
  });
  const confirm = run(async () => { await post("/api/arise-todo/confirm-email", { username: username.trim().toLowerCase(), code }); await login(username.trim().toLowerCase(), password); });
  const other = () => { try { sessionStorage.setItem("arise_return_to", "/notes/"); } catch { /* signs in there */ } window.location.assign(`${mainApp()}/signin`); };
  const field = "an-input";
  return <div className="mx-auto grid max-w-5xl gap-8 px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] md:grid-cols-[1.1fr_1fr] md:pt-16">
    <section className="space-y-6">
      <div className="flex items-center gap-3"><Logo size={44} /><span className="text-[22px] font-extrabold tracking-tight">Arise Notes</span></div>
      <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-.02em] sm:text-[44px]">Every meeting, class and visit, written down for you.</h1>
      <p className="max-w-lg text-[17px] leading-relaxed text-[var(--an-muted)]">Record or upload. Get a transcript with times, a clear summary, decisions and the to-dos, straight into your Arise To Duo planner. Made for teachers, special education teams, students and families.</p>
      <ul className="space-y-3">
        {[[<Mic key="m" className="h-5 w-5" />, "Record live or upload up to 2 hours"], [<Sparkles key="s" className="h-5 w-5" />, "Summaries for IEP meetings, parent conferences, lectures, doctor visits"], [<Upload key="u" className="h-5 w-5" />, "Action items become to-dos after you check them"], [<Shield key="p" className="h-5 w-5" />, "Audio deleted after transcription by default. Never used to train AI."]].map(([icon, text], i) =>
          <li key={i} className="flex items-center gap-3 text-[15px] font-medium"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--an-violet-soft)] text-[var(--an-violet)]">{icon}</span>{text}</li>)}
      </ul>
      <p className="text-[14px] text-[var(--an-muted)]">Free: 60 minutes a month. Basic $4.99, Plus $7.99 (or $79.99 a year), Family $9.99 for 4 people. <a href="#/privacy" className="font-semibold text-[var(--an-violet)] underline-offset-2 hover:underline">Student data privacy</a></p>
    </section>
    <section className="an-card h-fit p-6">
      {mode === "code" ? <form onSubmit={confirm} className="space-y-3">
        <h2 className="text-[20px] font-bold">Check your email</h2>
        <p className="text-[14px] text-[var(--an-muted)]">{notice}</p>
        <input className={`${field} text-center text-[22px] tracking-[.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="6-digit code" />
        {error && <p role="alert" className="text-[14px] text-[#b4182f]">{error}</p>}
        <button className="an-btn an-primary w-full" disabled={busy || code.length < 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirm</button>
      </form> : <form onSubmit={mode === "in" ? signIn : signUp} className="space-y-3">
        <h2 className="text-[20px] font-bold">{mode === "in" ? "Sign in" : "Create a free account"}</h2>
        <p className="text-[14px] text-[var(--an-muted)]">{mode === "in" ? "Use your Arise To Duo or A.R.I.S.E. account." : "One account for Arise Notes, Arise To Duo and A.R.I.S.E."}</p>
        {mode === "up" && <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Your name" />}
        <input className={field} placeholder={mode === "in" ? "Username or email" : "Choose a username"} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} aria-label="Username" />
        {mode === "up" && <input className={field} type="email" placeholder="Email (for a confirmation code)" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Email" />}
        <div className="relative"><input className={`${field} pr-12`} type={show ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} aria-label="Password" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-[var(--an-faint)]">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
        {error && <p role="alert" className="text-[14px] text-[#b4182f]">{error}</p>}
        <button className="an-btn an-primary w-full" disabled={busy || !username.trim() || !password}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "in" ? "Sign in" : "Create account"}</button>
        <button type="button" className="an-btn an-ghost w-full" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); }}>{mode === "in" ? "New here? Create a free account" : "Have an account? Sign in"}</button>
        {mode === "in" && <button type="button" className="w-full text-center text-[13px] font-semibold text-[var(--an-violet)]" onClick={other}>Forgot your password, or signed up with Apple or a school? Sign in another way</button>}
        <p className="flex items-center justify-center gap-1.5 pt-1 text-[12px] text-[var(--an-faint)]"><CheckCircle2 className="h-3.5 w-3.5" />Students sign in with the account their teacher or parent made.</p>
      </form>}
    </section>
  </div>;
}

// ─── A view-only shared note ─────────────────────────────────────────────────
function SharedNote({ token }: { token: string }) {
  const [n, setN] = useState<{ title: string; createdAt: string; durationSecs: number; template: any; summary: NoteSummary | null; segments: Segment[]; speakers: Record<string, string> } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { notesApi.shared(token).then((r) => setN(r.note)).catch((e) => setError(e.message)); }, [token]);
  if (error) return <main className="mx-auto max-w-xl p-6 pt-20 text-center"><Logo size={44} /><p className="mt-4 text-[16px]">{error}</p></main>;
  if (!n) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--an-faint)]" /></div>;
  const s = n.summary;
  const list = (title: string, items: { text: string }[]) => items.length ? <section className="mt-5"><h2 className="text-[16px] font-bold">{title}</h2><ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px]">{items.map((x, i) => <li key={i}>{x.text}</li>)}</ul></section> : null;
  return <main className="mx-auto max-w-3xl px-4 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-[var(--an-muted)]"><Logo size={28} />Arise Notes · shared, view only</div>
    <article className="an-card p-6">
      <h1 className="text-[26px] font-extrabold tracking-tight">{n.title}</h1>
      <p className="text-[13px] text-[var(--an-muted)]">{new Date(n.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}{n.durationSecs ? ` · ${fmtClock(n.durationSecs)}` : ""} · {templateOf(n.template).label}</p>
      {s && <><p className="an-read mt-5 text-[16px] leading-relaxed">{s.summary}</p>
        {list("Key points", s.keyPoints)}{s.sections.map((x) => <div key={x.heading}>{list(x.heading, x.items)}</div>)}{list("Decisions", s.decisions)}{list("Action items", s.actions.map((a) => ({ text: `${a.what}${a.who ? ` (${a.who})` : ""}${a.due ? `, due ${a.due}` : ""}` })))}{list("Still open", s.questions)}</>}
      {n.segments.length > 0 && <section className="mt-7"><h2 className="text-[16px] font-bold">Transcript</h2><div className="mt-2 space-y-2">{n.segments.map((g) => <p key={g.idx} className="text-[14px] leading-relaxed"><span className="an-time mr-2">{fmtClock(g.start)}</span>{g.speaker && <b className="mr-1">{speakerName(g.speaker, n.speakers)}:</b>}{g.text}</p>)}</div></section>}
    </article>
    <p className="mt-6 text-center text-[13px] text-[var(--an-faint)]"><a href="/notes/" className="font-semibold text-[var(--an-violet)]">Make your own notes with Arise Notes</a></p>
  </main>;
}

createRoot(document.getElementById("root")!).render(<AuthProvider><Root /></AuthProvider>);
