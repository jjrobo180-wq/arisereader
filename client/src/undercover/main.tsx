// Arise Undercover on the web (arisetodo.com/undercover/): signed out it's the website (what it does,
// the six looks, sign in or make a free account, same A.R.I.S.E. accounts); signed in it's the app.
import "../lib/accountStorageBoot";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { UNDERCOVER_THEMES } from "@shared/undercover";
import UndercoverApp from "./UndercoverApp";

const INK = "#0f172a", MUTED = "#475569", VIOLET = "#6d3df5";
const FONT = "Inter, system-ui, -apple-system, sans-serif";

function Root() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div style={{ minHeight: "100dvh" }} />;
  return user ? <UndercoverApp /> : <Website />;
}

// Small drawings of each look, for the website.
const bubble = (me: boolean, text: string, dark = false): ReactNode => <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start" }}>
  <div style={{ maxWidth: "80%", padding: "6px 10px", borderRadius: 14, fontSize: 11, lineHeight: 1.35, background: me ? (dark ? "#16a34a" : "#2563eb") : dark ? "#1f1f23" : "#f1f5f9", color: me || dark ? "#fff" : INK }}>{text}</div>
</div>;
function Mini({ id }: { id: string }) {
  const frame: CSSProperties = { height: 260, borderRadius: 22, overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 6, padding: 12, boxSizing: "border-box" };
  if (id === "text") return <div style={{ ...frame, background: "#fff" }}><b style={{ fontSize: 12 }}>Sam</b>{bubble(true, "what does EBITDA mean")}{bubble(false, "Profit from running the business, before interest, taxes and accounting stuff.")}</div>;
  if (id === "group") return <div style={{ ...frame, background: "#0b0b0f", color: "#f3f4f6" }}><b style={{ fontSize: 12, textAlign: "center" }}>Weekend plans</b>{bubble(true, "how do i push back on this timeline", true)}{bubble(false, "say you're in, but ask what we drop", true)}{bubble(false, "\"which of these three should we cut?\"", true)}</div>;
  if (id === "inbox") return <div style={{ ...frame, background: "#f8fafc" }}><b style={{ fontSize: 18 }}>Chats</b>{["Alex · sounds good", "Mom · Call me when you can", "Team lunch · Tacos again?", "Chris · Thanks!"].map((r) => <div key={r} style={{ fontSize: 11, padding: "8px 0", borderBottom: "1px solid #e2e8f0", color: MUTED }}>{r}</div>)}</div>;
  const page: CSSProperties = { ...frame, background: "#eef1f5", fontFamily: "'Source Serif 4', Georgia, serif" };
  const sheet: CSSProperties = { background: "#fff", padding: 12, borderRadius: 6, flex: 1, fontSize: 11, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 4 };
  if (id === "docNotes") return <div style={page}><div style={sheet}><b style={{ fontSize: 14 }}>Meeting notes</b><b>What's a pilot vs a beta?</b><span>Pilot: a small group uses it for real. Beta: a wider release to find bugs.</span></div></div>;
  if (id === "docComments") return <div style={{ ...page, flexDirection: "row" }}><div style={{ ...sheet, flex: 1.2 }}><b style={{ fontSize: 13 }}>Proposal</b><span>24-month fixed rate, net-60…</span></div><div style={{ ...sheet, fontFamily: FONT, background: "#f8fafc" }}><b>You</b><span>is net-60 normal?</span><b>Priya</b><span>Common. Ask for net-30.</span></div></div>;
  return <div style={{ ...frame, background: "#fff", fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 11 }}><b style={{ fontSize: 14 }}>Notes — Tue</b><b>Standup update?</b><ul style={{ margin: 0, paddingLeft: 16 }}><li>Yesterday: auth endpoints</li><li>Today: payments</li><li>Blocker: staging access</li></ul></div>;
}

function Website() {
  return <div style={{ fontFamily: FONT, color: INK }}>
    <header style={{ maxWidth: 1120, margin: "0 auto", padding: "max(16px, env(safe-area-inset-top)) 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/app-icons/undercover-1024.png" alt="" width={36} height={36} style={{ borderRadius: 9 }} />
      <span style={{ fontWeight: 800, fontSize: 18 }}>Arise Undercover</span>
      <a href="#signin" style={{ marginLeft: "auto", color: VIOLET, fontWeight: 600, textDecoration: "none", padding: "10px 4px" }}>Sign in</a>
    </header>
    <section style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 20px 24px", display: "grid", gap: 32, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(34px, 6vw, 54px)", lineHeight: 1.05, letterSpacing: "-.02em", fontWeight: 800 }}>Ask AI in the meeting. It just looks like texting.</h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: MUTED, maxWidth: 520 }}>Arise Undercover is an AI chat dressed up as a text thread, a group chat or a document. Ask what a term means, what to say next or for a quick summary, and the answer shows up like a text from a friend or a line in your notes.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="#signin" style={{ background: VIOLET, color: "#fff", padding: "14px 22px", borderRadius: 999, fontWeight: 600, textDecoration: "none" }}>Try it free</a>
          <a href="#looks" style={{ border: "1px solid #cbd5e1", color: INK, padding: "14px 22px", borderRadius: 999, fontWeight: 600, textDecoration: "none" }}>See the 6 looks</a>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}><Mini id="text" /><Mini id="docNotes" /></div>
    </section>
    <section id="looks" style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 20px" }}>
      <h2 style={{ fontSize: 30, margin: "0 0 6px", fontWeight: 800 }}>Six looks. Switch any time.</h2>
      <p style={{ margin: "0 0 24px", color: MUTED, fontSize: 16 }}>Three that look like texting, three that look like a document.</p>
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {UNDERCOVER_THEMES.map((t) => <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Mini id={t.id} />
          <div><div style={{ fontSize: 12, fontWeight: 600, color: VIOLET }}>{t.kind === "text" ? "Texting" : "Document"}</div><div style={{ fontWeight: 700 }}>{t.name}</div><div style={{ fontSize: 14, color: MUTED }}>{t.blurb}</div></div>
        </div>)}
      </div>
    </section>
    <section style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 20px 40px", display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
      {[["Answers that blend in", "Texts come back short like a friend's. Doc answers read like your own notes or a colleague's comment."], ["Quick hide", "In the inbox look, tap the name to swap to a boring decoy chat. In the phone doc, tap the title to hide every answer."], ["Private by design", "Your chats stay on your device. We don't keep them on our servers or use them to train AI."]].map(([h, p]) =>
        <div key={h} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}><h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{h}</h3><p style={{ margin: 0, color: MUTED, lineHeight: 1.55 }}>{p}</p></div>)}
    </section>
    <section id="signin" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}><div style={{ maxWidth: 440, margin: "0 auto", padding: "48px 20px 64px" }}><SignIn /></div></section>
    <footer style={{ textAlign: "center", padding: "20px 20px max(20px, env(safe-area-inset-bottom))", fontSize: 13, color: MUTED }}>
      Arise Undercover is part of A.R.I.S.E. · <a href="/privacy" style={{ color: MUTED }}>Privacy</a> · <a href="/terms" style={{ color: MUTED }}>Terms</a>
    </footer>
  </div>;
}

function SignIn() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"in" | "up" | "code">("up");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
    if (name.trim().length < 2) throw new Error("Enter your name.");
    if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
    const d = await post("/api/arise-todo/register", { displayName: name.trim(), password, email: email.trim() });
    const clean = String(d?.username || email.trim().toLowerCase());
    setUsername(clean);
    if (d?.confirmEmail) { setNotice(d.message || `We sent a 6-digit code to ${email.trim()}.`); setMode("code"); return; }
    await login(clean, password);
  });
  const confirm = run(async () => { await post("/api/arise-todo/confirm-email", { username: username.trim().toLowerCase(), code }); await login(username.trim().toLowerCase(), password); });
  const field: CSSProperties = { height: 48, border: "1px solid #cbd5e1", borderRadius: 12, padding: "0 14px", fontSize: 16, fontFamily: FONT, background: "#fff" };
  const label: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 500 };
  const submit: CSSProperties = { height: 48, borderRadius: 999, border: 0, background: VIOLET, color: "#fff", fontWeight: 600, fontSize: 16, fontFamily: FONT, cursor: "pointer", opacity: busy ? 0.7 : 1 };
  const swap: CSSProperties = { border: 0, background: "none", color: VIOLET, fontWeight: 600, fontFamily: FONT, fontSize: 15, padding: 10, cursor: "pointer" };
  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{mode === "in" ? "Sign in" : mode === "code" ? "Check your email" : "Make a free account"}</h2>
    <p style={{ margin: 0, color: MUTED }}>{mode === "code" ? notice : "Use your A.R.I.S.E. account, or make one in a few seconds."}</p>
    {mode === "in" && <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={label}>Email or username<input style={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
      <label style={label}>Password<input style={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      <button style={submit} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>}
    {mode === "up" && <form onSubmit={signUp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={label}>Your name<input style={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
      <label style={label}>Email<input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label style={label}>Password<input style={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required /></label>
      <button style={submit} disabled={busy}>{busy ? "Making your account…" : "Make my account"}</button>
    </form>}
    {mode === "code" && <form onSubmit={confirm} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={label}>6-digit code<input style={field} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required /></label>
      <button style={submit} disabled={busy}>{busy ? "Checking…" : "Confirm"}</button>
    </form>}
    {error && <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>}
    {mode !== "code" && <button style={swap} onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); }}>{mode === "in" ? "New here? Make a free account" : "Have an account? Sign in"}</button>}
  </div>;
}

createRoot(document.getElementById("root")!).render(<AuthProvider><Root /></AuthProvider>);
