import { useState } from "react";
import { ArrowLeft, CheckCircle2, Info, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { SchoolPicker, schoolFields, type SchoolChoice } from "@/components/SchoolPicker";

export default function TeacherSignup() {
  const [, navigate] = useLocation();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState<SchoolChoice | null>(null);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);

  const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!school) { setError("Please pick your school. Type its name in the school box, or use \"My school isn't listed\"."); return; }
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/register-teacher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName, email, ...schoolFields(school), gradesTaught: selectedGrades }),
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
      <section style={styles.panel} aria-labelledby="teacher-signup-title">
        <div style={styles.brand}>A.R.I.S.E. READER</div>
        <h1 id="teacher-signup-title" style={styles.title}>Teacher Sign Up</h1>

        {submitted ? (
          <div style={styles.success} role="status" data-testid="status-teacher-signup-success">
            <CheckCircle2 size={28} aria-hidden="true" />
            <p style={{ margin: 0 }}>Your request has been submitted! The admin will review your account and notify you when it&apos;s approved.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.infoBox}>
              <Info size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>After submitting, your account will be reviewed by the administrator. You&apos;ll receive a confirmation email when your account is approved.</span>
            </div>
            <Field id="teacher-display-name" label="Display Name" value={displayName} onChange={setDisplayName} autoComplete="name" />
            <Field id="teacher-username" label="Username" value={username} onChange={setUsername} autoComplete="username" />
            <Field id="teacher-email" label="Email (for activation notification)" value={email} onChange={setEmail} type="email" autoComplete="email" />
            <Field id="teacher-password" label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
            <div>
              <span style={{ ...styles.label, display: "block", marginBottom: 6 }}>Your School</span>
              <SchoolPicker who="teacher" value={school} onChange={setSchool} />
            </div>
            <div>
              <label style={{ ...styles.label, display: "block", marginBottom: 8 }}>Grades You Teach</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {GRADES.map((g) => {
                  const band = ["K","1","2"].includes(g) ? "K-2" : ["3","4","5"].includes(g) ? "3-5" : ["6","7","8"].includes(g) ? "6-8" : "9-12";
                  const bandColors: Record<string, string> = {
                    "K-2": "hsl(142 62% 45%)",
                    "3-5": "hsl(21 100% 50%)",
                    "6-8": "hsl(200 80% 50%)",
                    "9-12": "hsl(280 60% 55%)",
                  };
                  const isSelected = selectedGrades.includes(g);
                  const bandColor = bandColors[band];
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrades((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort((a, b) => parseInt(a || "0") - parseInt(b || "0")))}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 44,
                        minWidth: 44,
                        padding: "6px 10px",
                        fontSize: 15,
                        fontWeight: 800,
                        borderRadius: 10,
                        border: `2px solid ${isSelected ? bandColor : "hsl(0 0% 25%)"}`,
                        background: isSelected ? bandColor : "hsl(0 0% 12%)",
                        color: isSelected ? "#fff" : "hsl(0 0% 65%)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title={`Grade ${g} — ${band} Band`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {["K-2", "3-5", "6-8", "9-12"].map(b => {
                  const colors: Record<string, string> = {
                    "K-2": "hsl(142 62% 45%)",
                    "3-5": "hsl(21 100% 50%)",
                    "6-8": "hsl(200 80% 50%)",
                    "9-12": "hsl(280 60% 55%)",
                  };
                  const count = selectedGrades.filter(g => {
                    const band = ["K","1","2"].includes(g) ? "K-2" : ["3","4","5"].includes(g) ? "3-5" : ["6","7","8"].includes(g) ? "6-8" : "9-12";
                    return band === b;
                  }).length;
                  return (
                    <span key={b} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 12, padding: "2px 8px", borderRadius: 6,
                      background: count > 0 ? colors[b] + "30" : "hsl(0 0% 12%)",
                      color: count > 0 ? colors[b] : "hsl(0 0% 45%)",
                      fontWeight: 600,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[b], display: "inline-block" }} />
                      {b}{count > 0 ? ` (${count})` : ""}
                    </span>
                  );
                })}
              </div>
              <p style={{ fontSize: 13, color: "hsl(0 0% 60%)", marginTop: 6 }}>Tap each grade you teach. Colors show grade bands. Students select their grade at signup to find their teacher.</p>
            </div>
            {error && <div style={styles.error} role="alert" data-testid="text-teacher-signup-error">{error}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.primaryButton, opacity: loading ? 0.7 : 1 }} data-testid="button-request-teacher-account">
              <UserPlus size={20} aria-hidden="true" /> {loading ? "Submitting Request..." : "Request Teacher Account"}
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
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "radial-gradient(circle at 10% 0%, rgba(124,58,237,.24), transparent 28%), radial-gradient(circle at 90% 8%, rgba(6,182,212,.16), transparent 26%), radial-gradient(circle at 52% 45%, rgba(217,70,239,.08), transparent 35%), #0b0a16",
    color: "#f8fafc",
    padding: "24px",
    fontFamily: "'Barlow', system-ui, sans-serif",
  },
  panel: {
    width: "100%",
    maxWidth: 560,
    background: "linear-gradient(145deg, rgba(24,19,43,.98), rgba(15,18,35,.98))",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 28,
    padding: "clamp(24px, 5vw, 42px)",
    boxShadow: "0 28px 80px rgba(0,0,0,.32), 0 0 0 1px rgba(124,58,237,.05)",
  },
  brand: {
    background: "linear-gradient(90deg,#8b5cf6,#d946ef,#22d3ee)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    letterSpacing: "0.16em",
    fontSize: 13,
    fontWeight: 900,
    textAlign: "center",
  },
  title: {
    background: "linear-gradient(90deg,#ffffff 0%,#ddd6fe 45%,#a5f3fc 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    fontSize: "clamp(30px, 5vw, 40px)",
    lineHeight: 1.08,
    margin: "12px 0 30px",
    textAlign: "center",
    fontWeight: 900,
    letterSpacing: "-0.035em",
  },
  form: { display: "grid", gap: 18 },
  label: { display: "grid", gap: 8, color: "#e2e8f0", fontWeight: 750, fontSize: 15 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#0f0d1d",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 14,
    color: "white",
    fontSize: 16,
    minHeight: 50,
    padding: "11px 13px",
    outlineColor: "#8b5cf6",
  },
  infoBox: {
    display: "flex",
    gap: 12,
    background: "linear-gradient(90deg, rgba(124,58,237,.14), rgba(217,70,239,.10), rgba(6,182,212,.10))",
    border: "1px solid rgba(167,139,250,.26)",
    borderRadius: 16,
    color: "#dbeafe",
    fontSize: 15,
    lineHeight: 1.5,
    padding: 16,
  },
  primaryButton: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    minHeight: 52,
    border: 0,
    borderRadius: 14,
    background: "linear-gradient(90deg,#7c3aed 0%,#c026d3 52%,#06b6d4 100%)",
    color: "white",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 900,
    boxShadow: "0 14px 32px rgba(124,58,237,.22)",
  },
  error: { borderRadius: 12, padding: 12, background: "rgba(239,68,68,.12)", border: "1px solid rgba(248,113,113,.35)", color: "#fecaca" },
  success: { display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(6,182,212,.10)", border: "1px solid rgba(34,211,238,.30)", borderRadius: 14, color: "#cffafe", fontSize: 16, lineHeight: 1.5, padding: 18, marginBottom: 24 },
  backButton: { display: "inline-flex", alignItems: "center", gap: 8, color: "#c4b5fd", background: "transparent", border: 0, cursor: "pointer", fontSize: 15, fontWeight: 750, marginTop: 26, padding: 0 },
};
