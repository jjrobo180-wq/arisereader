import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Info, UserPlus, Link2 } from "lucide-react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { SignupShell, lightStyles } from "@/components/SignupShell";

export default function ParentSignup() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [parentCode, setParentCode] = useState("");
  const [linkNow, setLinkNow] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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

    try {
      const response = await fetch(`${API_BASE}/api/auth/register-parent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          displayName,
          email,
          parentCode: linkNow ? parentCode.trim() : "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to submit your request.");
      setSubmitted(true);
      // Straight into LifeHub: sign in with the new account (the sign-in screen opens the hub).
      try { await login(username.trim(), password); navigate("/signin"); return; } catch { /* they can sign in from the button below */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignupShell eyebrow="Parents & families" title={<>Parent <span className="text-violet-700">Sign Up</span></>} titleId="parent-signup-title" intro="Create your family account, then set up your child or connect the account they already have.">

        {submitted ? (
          <div style={styles.success} role="status" data-testid="status-parent-signup-success">
            <CheckCircle2 size={28} aria-hidden="true" />
            <p style={{ margin: 0 }}>{linkNow ? "Your account is ready and connected to your child." : "Your parent account is ready! Open A.R.I.S.E. Reader from LifeHub to create your child’s independent reader account or connect an existing student."}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.infoBox}>
              <Info size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>You can create a parent account without a code. Then set up a new independent reader for your child. Have a school code already? You can link that account instead.</span>
            </div>
            <Field id="parent-display-name" label="Your Name" value={displayName} onChange={setDisplayName} autoComplete="name" />
            <Field id="parent-username" label="Username" value={username} onChange={setUsername} autoComplete="username" />
            <Field id="parent-email" label="Email (for activation notification)" value={email} onChange={setEmail} type="email" autoComplete="email" />
            <Field id="parent-password" label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
            <fieldset style={styles.codeChoice} data-testid="parent-link-choice">
              <legend style={styles.label}>How would you like to start?</legend>
              <label style={styles.choice}><input type="radio" name="family-mode" checked={!linkNow} onChange={() => setLinkNow(false)} /><span><strong>Set up my child myself</strong><small style={styles.hint}>No code needed. Create an independent reader after signup.</small></span></label>
              <label style={styles.choice}><input type="radio" name="family-mode" checked={linkNow} onChange={() => setLinkNow(true)} /><span><strong>Connect an existing student</strong><small style={styles.hint}>Use a parent code from your child's school or A.R.I.S.E. account.</small></span></label>
              {linkNow && <div style={{ marginTop: 14 }}>
                <label htmlFor="parent-code" style={styles.label}><Link2 size={14} style={{ display: "inline", marginRight: 4 }} /> Parent connection code</label>
                <input id="parent-code" type="text" value={parentCode} onChange={(e) => setParentCode(e.target.value.toUpperCase())} required placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" style={styles.input} data-testid="input-parent-code" />
                <p style={styles.hint}>No code? Choose “Set up my child myself.” You can connect an existing student later too.</p>
              </div>}
            </fieldset>
            {error && <div style={styles.error} role="alert" data-testid="text-parent-signup-error">{error}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.primaryButton, opacity: loading ? 0.7 : 1 }} data-testid="button-request-parent-account">
              <UserPlus size={20} aria-hidden="true" /> {loading ? "Creating Account..." : "Create Parent Account"}
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
