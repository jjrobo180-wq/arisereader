import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, UserPlus, Link2 } from "lucide-react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { SignupShell, lightStyles } from "@/components/SignupShell";
import { isReaderHost } from "@/lib/hubs";

export default function ParentSignup() {
  const [, navigate] = useLocation();
  const { login, user } = useAuth();
  // Opens the next page only once the new sign-in has reached every screen, so the plan page never
  // shows a "sign in" banner for a moment before it knows who is signed in.
  const [goNext, setGoNext] = useState(false);
  useEffect(() => { if (goNext && user) navigate(isReaderHost() ? "/subscribe" : "/signin", { replace: true }); }, [goNext, user]); // eslint-disable-line react-hooks/exhaustive-deps
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [parentCode, setParentCode] = useState("");
  const [linkNow, setLinkNow] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // The plan page comes right after sign-up: have its code ready so it opens without a loading screen.
  useEffect(() => { void import("./ReaderSubscribe").catch(() => {}); }, []);
  useEffect(() => {
    try {
      const query = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
      const code = new URLSearchParams(query).get("code");
      if (code) { setParentCode(code.toUpperCase()); setLinkNow(true); }
    } catch {}
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    let going = false;

    try {
      const response = await fetch(`${API_BASE}/api/auth/register-parent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          displayName,
          email,
          parentCode: linkNow ? parentCode.trim() : "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to submit your request.");
      // One calm step: the button keeps saying "Creating your account…" while it signs in, then the plan
      // page (Arise Reader) opens in place. No success box, spinner pages or hops in between.
      try {
        await login(String(data.username || email.trim()), password);
        setGoNext(true);
        going = true;
        return;
      } catch { setSubmitted(true); /* they can sign in from the button below */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      if (!going) setLoading(false); // still "Creating your account…" until the plan page opens
    }
  };

  return (
    <SignupShell eyebrow="Parents & families" title={<>Parent <span className="text-violet-700">Sign Up</span></>} titleId="parent-signup-title" intro="Make your account in a few seconds. You add your child after.">

        {submitted ? (
          <div style={styles.success} role="status" data-testid="status-parent-signup-success">
            <CheckCircle2 size={28} aria-hidden="true" />
            <p style={{ margin: 0 }}>{linkNow ? "Your account is ready and connected to your child." : "Your parent account is ready! Open Arise Reader from LifeHub to create your child’s independent reader account or connect an existing student."}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <Field id="parent-display-name" label="Your name" value={displayName} onChange={setDisplayName} autoComplete="name" />
            <Field id="parent-email" label="Email (you sign in with this)" value={email} onChange={setEmail} type="email" autoComplete="username" />
            <Field id="parent-password" label="Password (6 or more characters)" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
            {!linkNow
              ? <button type="button" onClick={() => setLinkNow(true)} style={{ ...styles.backButton, marginTop: 0, justifyContent: "flex-start" }} data-testid="parent-link-choice">Have a parent code from your child's school? Add it</button>
              : <div data-testid="parent-link-choice">
                  <label htmlFor="parent-code" style={styles.label}><Link2 size={14} style={{ display: "inline", marginRight: 4 }} /> Parent code (optional)</label>
                  <input id="parent-code" type="text" value={parentCode} onChange={(e) => setParentCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" style={styles.input} data-testid="input-parent-code" />
                  <p style={styles.hint}>Connects you to your child's school account. You can also add your child after signing up.</p>
                </div>}
            {error && <div style={styles.error} role="alert" data-testid="text-parent-signup-error">{error}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.primaryButton, opacity: loading ? 0.7 : 1 }} data-testid="button-request-parent-account">
              <UserPlus size={20} aria-hidden="true" /> {loading ? "Creating your account…" : "Create my account"}
            </button>
          </form>
        )}

        <button type="button" onClick={() => navigate("/signin")} style={styles.backButton} data-testid="link-back-to-login">
          <ArrowLeft size={18} aria-hidden="true" /> Back to Login
        </button>
    </SignupShell>
  );
}

function Field({ id, label, value, onChange, type = "text", autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete: string }) {
  return <label htmlFor={id} style={styles.label}>{label}<input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required autoComplete={autoComplete} style={styles.input} data-testid={`input-${id}`} /></label>;
}

const styles: Record<string, React.CSSProperties> = {
  ...lightStyles,
  codeChoice: { border: "1px solid #e5e8f4", borderRadius: 16, padding: 15, margin: 0, background: "#fafaff" },
  choice: { display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 3px", color: "#191b35", cursor: "pointer" },
  success: { ...lightStyles.success, marginBottom: 8 },
};
