import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Info, KeyRound, MailCheck, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { SchoolPicker, schoolFields, type SchoolChoice } from "@/components/SchoolPicker";
import { TEACHER_CONFIRM_KEY, checkSchoolEmail } from "@shared/schoolEmail";
import { PLANS, usd } from "@shared/plans";
import { SignupShell, lightStyles } from "@/components/SignupShell";

const waitingUsername = () => { try { return (sessionStorage.getItem(TEACHER_CONFIRM_KEY) || "").trim().toLowerCase(); } catch { return ""; } };

/**
 * form  fill in the sign-up form
 * code  type the 6-digit code that was emailed to the school address
 * stuck the code could not be emailed; the admin turns the account on (or the teacher tries the email again)
 * done  confirmed, but there is no password on this page to sign in with (they came back later from the login page)
 */
type Step = "form" | "code" | "stuck" | "done";

export default function TeacherSignup() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  // The login page sends a teacher here when their school email still needs its code.
  const [returning] = useState(waitingUsername);
  useEffect(() => { try { sessionStorage.removeItem(TEACHER_CONFIRM_KEY); } catch {} }, []);
  const [step, setStep] = useState<Step>(returning ? "code" : "form");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState(returning);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState<SchoolChoice | null>(null);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);

  const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
    return data;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNote("");
    const schoolEmail = checkSchoolEmail(email);
    if (!schoolEmail.ok) { setError(schoolEmail.message); return; }
    if (!school) { setError("Please pick your school. Type its name in the school box, or use \"My school isn't listed\"."); return; }
    setLoading(true);

    try {
      const data = await post("/api/auth/register-teacher", { username, password, displayName, email: schoolEmail.email, ...schoolFields(school), gradesTaught: selectedGrades });
      if (data.username) setUsername(data.username);
      setEmail(data.email || schoolEmail.email);
      setStep(data.confirmEmail ? "code" : "stuck");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNote("");
    setLoading(true);
    try {
      await post("/api/auth/confirm-teacher-email", { username, code });
      // Straight in when the password is still on this page; otherwise they sign in on the login page.
      if (password) {
        try {
          await login(username.trim().toLowerCase(), password);
          navigate("/signin");
          return;
        } catch { /* the account is on either way: fall through to the log-in button */ }
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm your code.");
    } finally {
      setLoading(false);
    }
  };

  const sendNewCode = async () => {
    setError("");
    setNote("");
    setLoading(true);
    try {
      const data = await post("/api/auth/resend-teacher-code", { username });
      if (data.alreadyOn) { setStep("done"); return; }
      setCode("");
      setNote(data.message || "A new code is on its way to your school email.");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send a new code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignupShell eyebrow="For teachers" title={<>Teacher <span className="text-violet-700">Sign Up</span></>} titleId="teacher-signup-title" intro="Set up your class in a few minutes with your school email.">

        {step === "done" && (
          <>
            <div style={styles.success} role="status" data-testid="status-teacher-signup-success">
              <CheckCircle2 size={28} aria-hidden="true" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0 }}>Your school email is confirmed and your teacher account is ready. Log in with the username and password you chose.</p>
            </div>
            <button type="button" onClick={() => navigate("/signin")} style={{ ...styles.primaryButton, width: "100%" }} data-testid="button-teacher-go-login">Log In</button>
          </>
        )}

        {step === "stuck" && (
          <>
            <div style={styles.infoBox} role="status" data-testid="status-teacher-signup-stuck">
              <Info size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Your account was created, but we couldn&apos;t email your confirmation code to {email || "your school email"} just now. The site admin has been told and will turn your account on. You can also try sending the code again.</span>
            </div>
            {note && <div style={styles.note} role="status">{note}</div>}
            {error && <div style={styles.error} role="alert" data-testid="text-teacher-signup-error">{error}</div>}
            <button type="button" onClick={sendNewCode} disabled={loading} style={{ ...styles.primaryButton, width: "100%", marginTop: 18, opacity: loading ? 0.7 : 1 }} data-testid="button-teacher-try-code-again">
              <MailCheck size={20} aria-hidden="true" /> {loading ? "Sending..." : "Try sending the code again"}
            </button>
          </>
        )}

        {step === "code" && (
          <form onSubmit={handleConfirm} style={styles.form}>
            <div style={styles.infoBox} data-testid="status-teacher-code-sent">
              <MailCheck size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>We emailed a 6-digit code to {email ? <strong>{email}</strong> : "your school email"}. Enter it here and your account turns on right away. There is no wait for approval. School email can take a minute, so check your junk or spam folder too.</span>
            </div>
            {returning && <Field id="teacher-confirm-username" label="Username" value={username} onChange={setUsername} autoComplete="username" />}
            <label htmlFor="teacher-email-code" style={styles.label}>6-digit code
              <input id="teacher-email-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" autoFocus style={{ ...styles.input, fontSize: 26, fontWeight: 800, letterSpacing: "0.4em", textAlign: "center" }} data-testid="input-teacher-email-code" />
            </label>
            {note && <div style={styles.note} role="status">{note}</div>}
            {error && <div style={styles.error} role="alert" data-testid="text-teacher-signup-error">{error}</div>}
            <button type="submit" disabled={loading || code.length !== 6} style={{ ...styles.primaryButton, opacity: loading || code.length !== 6 ? 0.7 : 1 }} data-testid="button-confirm-teacher-email">
              <KeyRound size={20} aria-hidden="true" /> {loading ? "Checking..." : "Confirm and Open My Account"}
            </button>
            <button type="button" onClick={sendNewCode} disabled={loading} style={styles.linkButton} data-testid="button-teacher-new-code">Send a new code</button>
          </form>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.infoBox}>
              <Info size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Sign up with your <strong>school email</strong> (ending in .edu, .net, .org or .us). We&apos;ll email you a 6-digit code to confirm it, and then your account is open right away. No waiting for approval. Arise WorkHub and Arise LifeHub (Arise To Duo) are free from day one, on every plan. The Class plan is {usd(PLANS.teacher.monthlyCents)}/month and covers A.R.I.S.E. Reader for up to {PLANS.teacher.studentsPerBlock} students.</span>
            </div>
            <Field id="teacher-display-name" label="Display Name" value={displayName} onChange={setDisplayName} autoComplete="name" />
            <Field id="teacher-username" label="Username" value={username} onChange={setUsername} autoComplete="username" />
            <Field id="teacher-email" label="School Email (.edu, .net, .org or .us)" value={email} onChange={setEmail} type="email" autoComplete="email" />
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
                        border: `2px solid ${isSelected ? bandColor : "#dfe2ee"}`,
                        background: isSelected ? bandColor : "#fff",
                        color: isSelected ? "#fff" : "#475569",
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
                      background: count > 0 ? colors[b].replace(")", " / .14)") : "#f1f5f9",
                      color: count > 0 ? colors[b] : "#64748b",
                      fontWeight: 600,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[b], display: "inline-block" }} />
                      {b}{count > 0 ? ` (${count})` : ""}
                    </span>
                  );
                })}
              </div>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>Tap each grade you teach. Colors show grade bands. Students select their grade at signup to find their teacher.</p>
            </div>
            {error && <div style={styles.error} role="alert" data-testid="text-teacher-signup-error">{error}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.primaryButton, opacity: loading ? 0.7 : 1 }} data-testid="button-request-teacher-account">
              <UserPlus size={20} aria-hidden="true" /> {loading ? "Creating Your Account..." : "Create Teacher Account"}
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

const styles = lightStyles;
