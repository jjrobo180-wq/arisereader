import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, Info, UserPlus, Link2 } from "lucide-react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";

export default function ParentSignup() {
  const [, navigate] = useLocation();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/schools`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSchools(Array.isArray(data) ? data : []))
      .catch(() => {});
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
          schoolId: selectedSchoolId ? parseInt(selectedSchoolId) : null,
          studentUsername: studentUsername.toLowerCase(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to submit your request.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.panel} aria-labelledby="parent-signup-title">
        <div style={styles.brand}>A.R.I.S.E. READER</div>
        <h1 id="parent-signup-title" style={styles.title}>Parent Sign Up</h1>

        {submitted ? (
          <div style={styles.success} role="status" data-testid="status-parent-signup-success">
            <CheckCircle2 size={28} aria-hidden="true" />
            <p style={{ margin: 0 }}>Your request has been submitted! The admin will review your account and link you to your student. You'll receive a confirmation email when your account is approved.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.infoBox}>
              <Info size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>After submitting, your account will be reviewed by the administrator. Once approved, you'll be linked to your student and can view their progress, print certificates, and message their teacher.</span>
            </div>
            <Field id="parent-display-name" label="Your Name" value={displayName} onChange={setDisplayName} autoComplete="name" />
            <Field id="parent-username" label="Username" value={username} onChange={setUsername} autoComplete="username" />
            <Field id="parent-email" label="Email (for activation notification)" value={email} onChange={setEmail} type="email" autoComplete="email" />
            <Field id="parent-password" label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
            <div>
              <label htmlFor="parent-school" style={{ ...styles.label, display: "block", marginBottom: 6 }}>Select Your School</label>
              <select
                id="parent-school"
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                required
                style={styles.input}
                data-testid="select-parent-school"
              >
                <option value="">Choose your school...</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="parent-student" style={{ ...styles.label, display: "block", marginBottom: 6 }}>
                <Link2 size={14} style={{ display: "inline", marginRight: 4 }} />
                Your Student's Username
              </label>
              <input
                id="parent-student"
                type="text"
                value={studentUsername}
                onChange={(e) => setStudentUsername(e.target.value)}
                required
                placeholder="Enter your child's username exactly"
                style={styles.input}
                data-testid="input-parent-student"
              />
              <p style={{ fontSize: 13, color: "hsl(0 0% 60%)", marginTop: 4 }}>
                This links your parent account to your student so you can view their progress, certificates, and messages.
              </p>
            </div>
            {error && <div style={styles.error} role="alert" data-testid="text-parent-signup-error">{error}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.primaryButton, opacity: loading ? 0.7 : 1 }} data-testid="button-request-parent-account">
              <UserPlus size={20} aria-hidden="true" /> {loading ? "Submitting Request..." : "Request Parent Account"}
            </button>
          </form>
        )}

        <button type="button" onClick={() => navigate("/")} style={styles.backButton} data-testid="link-back-to-login">
          <ArrowLeft size={18} aria-hidden="true" /> Back to Login
        </button>
      </section>
    </main>
  );
}

function Field({ id, label, value, onChange, type = "text", autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete: string }) {
  return <label htmlFor={id} style={styles.label}>{label}<input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required autoComplete={autoComplete} style={styles.input} data-testid={`input-${id}`} /></label>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "hsl(0 0% 10%)", color: "hsl(0 0% 96%)", padding: "24px", fontFamily: "system-ui, sans-serif" },
  panel: { width: "100%", maxWidth: 520, background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 16, padding: "clamp(24px, 5vw, 40px)", boxShadow: "0 24px 56px hsl(0 0% 0% / 0.28)" },
  brand: { color: "hsl(0 0% 66%)", letterSpacing: "0.12em", fontSize: 13, fontWeight: 700, textAlign: "center" },
  title: { color: "hsl(21 100% 50%)", fontSize: "clamp(28px, 5vw, 36px)", lineHeight: 1.15, margin: "10px 0 28px", textAlign: "center" },
  form: { display: "grid", gap: 18 }, label: { display: "grid", gap: 8, color: "hsl(0 0% 92%)", fontWeight: 650, fontSize: 16 },
  input: { width: "100%", boxSizing: "border-box", background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 28%)", borderRadius: 8, color: "white", fontSize: 17, minHeight: 48, padding: "10px 12px", outlineColor: "hsl(21 100% 50%)" },
  infoBox: { display: "flex", gap: 12, background: "hsl(21 100% 50% / 0.12)", border: "1px solid hsl(21 100% 50% / 0.4)", borderRadius: 10, color: "hsl(0 0% 89%)", fontSize: 16, lineHeight: 1.45, padding: 16 },
  primaryButton: { display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 9, minHeight: 50, border: 0, borderRadius: 8, background: "hsl(21 100% 50%)", color: "hsl(0 0% 8%)", cursor: "pointer", fontSize: 17, fontWeight: 800 },
  error: { borderRadius: 8, padding: 12, background: "hsl(0 73% 42% / 0.2)", border: "1px solid hsl(0 73% 55%)", color: "hsl(0 100% 88%)" },
  success: { display: "flex", alignItems: "flex-start", gap: 12, background: "hsl(142 62% 35% / 0.18)", border: "1px solid hsl(142 62% 45%)", borderRadius: 10, color: "hsl(142 64% 82%)", fontSize: 17, lineHeight: 1.5, padding: 18, marginBottom: 24 },
  backButton: { display: "inline-flex", alignItems: "center", gap: 8, color: "hsl(0 0% 78%)", background: "transparent", border: 0, cursor: "pointer", fontSize: 16, fontWeight: 650, marginTop: 26, padding: 0 },
};
