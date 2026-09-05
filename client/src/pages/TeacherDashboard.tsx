import { useEffect, useState } from "react";
import { ArrowLeft, Award, Check, KeyRound, LogOut, Mail, UserRound, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";

function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith("arise_session=")) {
        const raw = c.substring("arise_session".length + 1);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}

type Student = { id: number; displayName?: string; display_name?: string; username: string; totalPoints?: number; total_points?: number; quizzesTaken?: number; quizzes_taken?: number };
type Tab = "students" | "pending";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authorized = Boolean(user && (user.role === "teacher" || user.isAdmin));
  const accountApproved = user?.accountApproved !== false;

  const request = async (path: string, options: RequestInit = {}) => {
    const token = getTokenFromCookie();
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
    return data;
  };

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [studentData, pendingData] = await Promise.all([request("/api/teacher/students"), request("/api/teacher/pending-students")]);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setPending(Array.isArray(pendingData) ? pendingData : []);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load students."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user) return;
    if (!authorized) { navigate("/library"); return; }
    if (accountApproved) void loadData(); else setLoading(false);
  }, [user, authorized, accountApproved]);

  const approve = async (studentId: number) => {
    try { await request(`/api/teacher/approve/${studentId}`, { method: "POST" }); setPending((items) => items.filter((item) => item.id !== studentId)); await loadData(); }
    catch (err) { window.alert(err instanceof Error ? err.message : "Unable to approve this student."); }
  };
  const resetPassword = async (studentId: number) => {
    try { const data = await request(`/api/teacher/reset-password/${studentId}`, { method: "POST" }); window.alert(`New temporary password: ${data.tempPassword || data.newPassword || "not provided"}`); }
    catch (err) { window.alert(err instanceof Error ? err.message : "Unable to reset this password."); }
  };
  const name = (student: Student) => student.displayName || student.display_name || student.username;
  const points = (student: Student) => student.totalPoints ?? student.total_points ?? 0;
  const quizzes = (student: Student) => student.quizzesTaken ?? student.quizzes_taken ?? 0;

  if (!user || !authorized) return null;
  return <main style={styles.page}>
    <header style={styles.header}><button onClick={() => navigate("/library")} style={styles.subtleButton} data-testid="button-back-library"><ArrowLeft size={19} /> Library</button><h1 style={styles.title}>Teacher Dashboard</h1><button onClick={() => { if (window.confirm("Are you sure you want to log out?")) { logout(); navigate("/"); } }} style={styles.subtleButton} data-testid="button-teacher-logout">Logout <LogOut size={19} /></button></header>
    {!accountApproved ? <section style={styles.notice} role="status" data-testid="status-teacher-pending">Your account is pending approval by the administrator.</section> : <section style={styles.content}>
      <div style={styles.tabs} role="tablist" aria-label="Teacher dashboard sections"><TabButton active={tab === "students"} onClick={() => setTab("students")} icon={<Users size={19} />}>My Students</TabButton><TabButton active={tab === "pending"} onClick={() => setTab("pending")} icon={<UserRound size={19} />}>Pending Approvals{pending.length ? ` (${pending.length})` : ""}</TabButton></div>
      {loading ? <p style={styles.muted}>Loading students...</p> : error ? <div style={styles.error} role="alert">{error}</div> : tab === "students" ? <div style={styles.grid}>{students.length ? students.map((student) => <article key={student.id} style={styles.card} data-testid={`card-student-${student.id}`}><div style={styles.cardHead}><div><h2 style={styles.studentName}>{name(student)}</h2><p style={styles.username}>@{student.username}</p></div></div><div style={styles.stats}><span><strong>{points(student)}</strong> total points</span><span><strong>{quizzes(student)}</strong> quizzes taken</span></div><div style={styles.actions}><ActionButton onClick={() => navigate(`/student-profile/${student.id}`)} icon={<UserRound size={16} />}>View Profile</ActionButton><ActionButton onClick={() => navigate(`/messages/${student.id}`)} icon={<Mail size={16} />}>Message</ActionButton><ActionButton onClick={() => void resetPassword(student.id)} icon={<KeyRound size={16} />}>Reset Password</ActionButton><ActionButton onClick={() => navigate(`/student-certificates/${student.id}`)} icon={<Award size={16} />}>Print Certificates</ActionButton></div></article>) : <div style={styles.empty}>No students have joined your classroom yet.</div>}</div> : <div style={styles.pendingList}>{pending.length ? pending.map((student) => <article key={student.id} style={styles.pendingCard} data-testid={`card-pending-student-${student.id}`}><div><h2 style={styles.studentName}>{name(student)}</h2><p style={styles.username}>@{student.username}</p></div><button onClick={() => void approve(student.id)} style={styles.approveButton} data-testid={`button-approve-student-${student.id}`}><Check size={18} /> Approve</button></article>) : <div style={styles.empty}>No pending students</div>}</div>}
    </section>}
  </main>;
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button role="tab" aria-selected={active} onClick={onClick} style={{ ...styles.tab, ...(active ? styles.activeTab : {}) }} data-testid={`tab-${active ? "active" : "inactive"}`}>{icon}{children}</button>; }
function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button onClick={onClick} style={styles.actionButton}>{icon}{children}</button>; }

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "hsl(0 0% 10%)", color: "hsl(0 0% 96%)", fontFamily: "system-ui, sans-serif", padding: "20px clamp(16px, 4vw, 56px) 48px" }, header: { maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", borderBottom: "1px solid hsl(0 0% 20%)", paddingBottom: 20, gap: 12 }, title: { color: "hsl(21 100% 50%)", fontSize: "clamp(26px, 4vw, 36px)", margin: 0, textAlign: "center", whiteSpace: "nowrap" }, subtleButton: { display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content", color: "hsl(0 0% 85%)", background: "transparent", border: 0, cursor: "pointer", fontSize: 16, fontWeight: 700, padding: 8 }, content: { maxWidth: 1200, margin: "30px auto 0" }, tabs: { display: "flex", flexWrap: "wrap", gap: 8, borderBottom: "1px solid hsl(0 0% 20%)", marginBottom: 24 }, tab: { display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", color: "hsl(0 0% 65%)", border: 0, borderBottom: "3px solid transparent", cursor: "pointer", fontSize: 17, fontWeight: 750, padding: "12px 16px" }, activeTab: { color: "hsl(21 100% 50%)", borderBottomColor: "hsl(21 100% 50%)" }, grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }, card: { display: "grid", gap: 18, background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 12, padding: 20 }, cardHead: { display: "flex", justifyContent: "space-between" }, studentName: { fontSize: 20, margin: 0, color: "hsl(0 0% 98%)" }, username: { margin: "4px 0 0", color: "hsl(0 0% 62%)", fontSize: 15 }, stats: { display: "flex", justifyContent: "space-between", gap: 12, color: "hsl(0 0% 70%)", fontSize: 14 }, actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }, actionButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 38, background: "hsl(0 0% 18%)", border: "1px solid hsl(0 0% 28%)", borderRadius: 7, color: "hsl(0 0% 90%)", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 8px" }, pendingList: { display: "grid", gap: 12, maxWidth: 760 }, pendingCard: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 12, padding: 20 }, approveButton: { display: "inline-flex", alignItems: "center", gap: 7, background: "hsl(21 100% 50%)", border: 0, borderRadius: 7, color: "hsl(0 0% 8%)", cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "10px 14px" }, notice: { maxWidth: 760, margin: "56px auto", background: "hsl(21 100% 50% / 0.12)", border: "1px solid hsl(21 100% 50% / 0.45)", borderRadius: 12, color: "hsl(0 0% 92%)", fontSize: 18, lineHeight: 1.5, padding: 22, textAlign: "center" }, empty: { background: "hsl(0 0% 14%)", border: "1px dashed hsl(0 0% 28%)", borderRadius: 12, color: "hsl(0 0% 65%)", fontSize: 17, padding: 32, textAlign: "center" }, muted: { color: "hsl(0 0% 66%)", fontSize: 17 }, error: { background: "hsl(0 73% 42% / 0.18)", border: "1px solid hsl(0 73% 55%)", borderRadius: 9, color: "hsl(0 100% 88%)", padding: 16 },
};
