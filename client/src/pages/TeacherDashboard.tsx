import { createContext, useContext, useEffect, useState } from "react";
import { ArrowLeft, Award, Camera, Check, GraduationCap, KeyRound, LogOut, Mail, UserRound, Users, Brain, Gift, Search, X, CheckCircle2, FileQuestion, Bell, BookOpen, Gamepad2, Lock, Unlock, Copy, ExternalLink, Clock3, Sparkles, ChevronRight, Trophy, PenLine } from "lucide-react";
import AddonsCard from "@/components/AddonsCard";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { NotificationBell } from "@/components/NotificationBell";
import { printParentInvites } from "@/lib/parentInvites";
import ParentEmailInvite from "@/components/ParentEmailInvite";
import BannerTap from "@/components/BannerTap";
import FamilyEmailInvite from "@/components/FamilyEmailInvite";
import NoProctorReview from "@/components/NoProctorReview";
import ComprehensionReview from "@/components/ComprehensionReview";
import PlayTimeManager from "@/components/PlayTimeManager";
import { PrizeManager } from "@/components/prizes/PrizeManager";

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

type Student = { id: number; displayName?: string; display_name?: string; username: string; totalPoints?: number; total_points?: number; quizzesTaken?: number; quizzes_taken?: number; teacherId?: number; teacherName?: string | null; approvedByTeacher?: boolean };
type AllStudent = { id: number; username: string; displayName: string; createdAt: string; quizzesTaken: number; quizzesMastered: number; totalPoints: number; approvedByTeacher?: boolean; teacherId?: number; teacherName?: string | null };
type Teacher = { id: number; displayName: string; username: string };
type PendingStudent = { id: number; username: string; displayName: string; teacherId?: number; teacherName?: string | null };
type PendingQuiz = { id: number; student_id: number; student_name: string; book_title: string; author: string; quiz_type: string; age_group: string; cover_url: string; status: string };
type BookRequest = { id: number; bookTitle: string; studentName: string; message: string; createdAt: string };
type ParentConnection = { id: number; displayName: string; username: string; code: string; signupUrl: string; parents: Array<{ id: number; displayName: string; username: string; email?: string | null; accountApproved: boolean }> };
type ClubClosingSchedule = { enabled: boolean; start: string; end: string; days: number[]; timeZone?: string; closedNow?: boolean; adminOverrideClosedNow?: boolean; adminSchedule?: { enabled: boolean; start: string; end: string; days: number[] } };

type Tab = "students" | "all-students" | "pending" | "book-requests" | "parents" | "proctor" | "camera-quizzes" | "comprehension" | "grade-changes" | "growth-check" | "club-controls" | "prizes";

/** The teacher's A.R.I.S.E. Reader tools. `embedded`: shown inside Arise WorkHub's A.R.I.S.E. Reader tab, without its own page header. */
export default function TeacherDashboard({ embedded = false, night = false }: { embedded?: boolean; night?: boolean } = {}) {
  // Inside WorkHub (day mode) the tools take WorkHub's light look; otherwise the site's dark look.
  const hubLook = embedded && !night;
  const styles = hubLook ? hubStyles : darkStyles;
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>(() => {
    // Other pages can open a specific tab by setting this key before navigating here.
    let requested: string | null = null;
    try { requested = sessionStorage.getItem("teacher_dashboard_tab"); sessionStorage.removeItem("teacher_dashboard_tab"); } catch {}
    const valid: Tab[] = ["students", "all-students", "pending", "book-requests", "parents", "proctor", "camera-quizzes", "comprehension", "grade-changes", "growth-check", "club-controls"];
    return valid.includes(requested as Tab) ? (requested as Tab) : "students";
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [proctorPassword, setProctorPassword] = useState("");
  const [teacherBanner, setTeacherBanner] = useState<{ text: string; bgColor: string; textColor: string; active: boolean; link?: string } | null>(null);
  const [gradeChangeRequests, setGradeChangeRequests] = useState<any[]>([]);
  const [growthCheckData, setGrowthCheckData] = useState<any[]>([]);
  // Written reading comprehension answers waiting for a grade.
  const [comprehensionPending, setComprehensionPending] = useState(0);

  // All Students tab state
  const [allStudents, setAllStudents] = useState<AllStudent[]>([]);
  const [allPending, setAllPending] = useState<PendingStudent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [actionStudent, setActionStudent] = useState<AllStudent | null>(null);
  const [actionType, setActionType] = useState<"password" | "reward" | "reassign" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardMessage, setRewardMessage] = useState("");
  const [rewardQuizCount, setRewardQuizCount] = useState("");
  const [reassignTeacherId, setReassignTeacherId] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [existingRewards, setExistingRewards] = useState<any[]>([]);
  const [pendingQuizzes, setPendingQuizzes] = useState<PendingQuiz[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [bookRequests, setBookRequests] = useState<BookRequest[]>([]);
  const [bookReqLoading, setBookReqLoading] = useState(false);
  const [bellRefreshKey, setBellRefreshKey] = useState(0);
  const [clubControls, setClubControls] = useState<any[]>([]);
  const [clubControlsLoading, setClubControlsLoading] = useState(false);
  const [parentConnections, setParentConnections] = useState<ParentConnection[]>([]);
  const [parentConnectionsLoading, setParentConnectionsLoading] = useState(false);
  const [clubClosing, setClubClosing] = useState<ClubClosingSchedule>({ enabled: false, start: "21:00", end: "07:00", days: [0,1,2,3,4,5,6] });
  const [clubClosingLoading, setClubClosingLoading] = useState(false);
  const [clubClosingSaving, setClubClosingSaving] = useState(false);
  const printLetters = (studentId?: number) => printParentInvites(studentId).catch(err => window.alert(err.message));

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

  const loadAllStudentsData = async () => {
    setAllLoading(true); setAllError("");
    try {
      const [allStudentData, allPendingData, teachersData, quizData] = await Promise.all([
        request("/api/teacher-admin/all-students"),
        request("/api/teacher-admin/pending-students"),
        request("/api/teacher-admin/teachers"),
        request("/api/teacher-admin/pending-quizzes")
      ]);
      setAllStudents(Array.isArray(allStudentData) ? allStudentData : []);
      setAllPending(Array.isArray(allPendingData) ? allPendingData : []);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
      setPendingQuizzes(quizData?.pending || []);
    } catch (err) { setAllError(err instanceof Error ? err.message : "Unable to load all students."); }
    finally { setAllLoading(false); }
  };

  const loadClubControls = async () => {
    setClubControlsLoading(true);
    try {
      const data = await request("/api/teacher/club-arise/controls");
      setClubControls(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to load Club controls.");
    } finally {
      setClubControlsLoading(false);
    }
  };

  const loadParentConnections = async () => {
    setParentConnectionsLoading(true);
    try {
      const data = await request("/api/teacher/parent-connections");
      setParentConnections(Array.isArray(data?.students) ? data.students : []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to load parent connections.");
    } finally { setParentConnectionsLoading(false); }
  };

  const loadClubClosing = async () => {
    if (user?.role !== "teacher") return;
    setClubClosingLoading(true);
    try {
      const data = await request("/api/teacher/club-closing-hours");
      setClubClosing(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to load class closing hours.");
    } finally { setClubClosingLoading(false); }
  };

  const saveClubClosing = async () => {
    if (user?.role !== "teacher") return;
    setClubClosingSaving(true); setActionError("");
    try {
      const data = await request("/api/teacher/club-closing-hours", { method: "POST", body: JSON.stringify({ enabled: clubClosing.enabled, start: clubClosing.start, end: clubClosing.end, days: clubClosing.days }) });
      setClubClosing(data);
      setActionSuccess("Your class Club closing hours are saved.");
      setTimeout(() => setActionSuccess(""), 2600);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to save class closing hours.");
    } finally { setClubClosingSaving(false); }
  };

  const copyText = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setActionSuccess(label + " copied."); setTimeout(() => setActionSuccess(""), 1800); }
    catch { setActionError("Could not copy " + label.toLowerCase() + "."); }
  };

  const saveClubControl = async (studentId: number, patch: any) => {
    const current = clubControls.find((s:any) => s.id === studentId)?.control || {};
    const next = {
      locked: patch.locked ?? current.locked ?? false,
      dailyGameLimit: patch.dailyGameLimit !== undefined ? patch.dailyGameLimit : (current.daily_game_limit ?? null),
      gamesPerPassedQuiz: patch.gamesPerPassedQuiz !== undefined ? patch.gamesPerPassedQuiz : (current.games_per_passed_quiz ?? 0),
      weeklyUnlimitedOnPass: patch.weeklyUnlimitedOnPass !== undefined ? patch.weeklyUnlimitedOnPass : (current.weekly_unlimited_on_pass ?? true),
    };
    try {
      const data = await request(`/api/teacher/club-arise/controls/${studentId}`, { method: "POST", body: JSON.stringify(next) });
      setClubControls(items => items.map((s:any) => s.id === studentId ? {...s, control:data.control, access:data.access} : s));
      setActionSuccess("Club A.R.I.S.E. control saved.");
      setTimeout(() => setActionSuccess(""), 2200);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to save Club controls.");
    }
  };

  const loadBookRequests = async () => {
    setBookReqLoading(true);
    try {
      const data = await request("/api/teacher-admin/book-requests");
      setBookRequests(data.requests || []);
    } catch (err) {
      // Endpoint may not exist yet for teachers — try notifications fallback
      try {
        const notifData = await request("/api/notifications");
        setBookRequests(notifData.pendingRequestItems || []);
      } catch {}
    }
    finally { setBookReqLoading(false); }
  };

  useEffect(() => {
    if (!user) return;
    if (!authorized) { navigate("/library"); return; }
    if (accountApproved) {
      void loadData();
      const token = getTokenFromCookie();
      if (token) {
        fetch(`${API_BASE}/api/proctor-password`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.password) setProctorPassword(data.password); })
          .catch(() => {});
        fetch(`${API_BASE}/api/banners`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.teacherBanner) setTeacherBanner(data.teacherBanner); })
          .catch(() => {});
        fetchGradeChangeRequests(token);
        fetch(`${API_BASE}/api/comprehension/review?limit=1`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setComprehensionPending(Number(data.pending) || 0); })
          .catch(() => {});
        fetch(`${API_BASE}/api/teacher/growth-check/overview`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.attempts) setGrowthCheckData(data.attempts); })
          .catch(() => {});
      }
    } else { setLoading(false); }
  }, [user, authorized, accountApproved]);

  useEffect(() => {
    if (!accountApproved) return;
    if (tab === "all-students" && !allStudents.length && !allLoading) void loadAllStudentsData();
    if (tab === "book-requests" && !bookReqLoading) void loadBookRequests();
    if (tab === "parents" && !parentConnectionsLoading) void loadParentConnections();
    if (tab === "club-controls") {
      if (!clubControlsLoading) void loadClubControls();
      if (user?.role === "teacher" && !clubClosingLoading) void loadClubClosing();
    }
  }, [tab, accountApproved]);

  const approve = async (studentId: number) => {
    try { await request(`/api/teacher/approve/${studentId}`, { method: "POST" }); setPending((items) => items.filter((item) => item.id !== studentId)); await loadData(); }
    catch (err) { window.alert(err instanceof Error ? err.message : "Unable to approve this student."); }
  };

  // All Students tab actions
  const approveAllStudent = async (studentId: number) => {
    try {
      await request(`/api/teacher-admin/students/${studentId}/approve`, { method: "POST" });
      setAllPending((items) => items.filter((item) => item.id !== studentId));
      await loadAllStudentsData();
      setActionSuccess("Student approved successfully!");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to approve student."); }
  };

  const resetPasswordAll = async (studentId: number) => {
    if (!newPassword || newPassword.length < 4) { setActionError("Password must be at least 4 characters."); return; }
    try {
      await request(`/api/teacher-admin/students/${studentId}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) });
      setActionSuccess("Password reset successfully!");
      setActionStudent(null); setActionType(null); setNewPassword("");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to reset password."); }
  };

  const addRewardAll = async (studentId: number) => {
    if (!rewardTitle || !rewardMessage) { setActionError("Title and message are required."); return; }
    try {
      await request(`/api/teacher-admin/students/${studentId}/rewards`, { method: "POST", body: JSON.stringify({ title: rewardTitle, message: rewardMessage, requiredQuizCount: rewardQuizCount || undefined }) });
      setActionSuccess("Reward added successfully!");
      setActionStudent(null); setActionType(null); setRewardTitle(""); setRewardMessage(""); setRewardQuizCount("");
      // Refresh rewards
      const data = await request(`/api/teacher-admin/students/${studentId}/rewards`);
      setExistingRewards(data.rewards || []);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to add reward."); }
  };

  const deleteRewardAll = async (studentId: number, rewardId: number) => {
    try {
      await request(`/api/teacher-admin/students/${studentId}/rewards/${rewardId}`, { method: "DELETE" });
      const data = await request(`/api/teacher-admin/students/${studentId}/rewards`);
      setExistingRewards(data.rewards || []);
      setActionSuccess("Reward deleted!");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to delete reward."); }
  };

  const reassignStudent = async (studentId: number) => {
    if (!reassignTeacherId) { setActionError("Please select a teacher."); return; }
    try {
      const data = await request(`/api/teacher-admin/students/${studentId}/reassign`, { method: "POST", body: JSON.stringify({ newTeacherId: parseInt(reassignTeacherId) }) });
      setActionSuccess(data.message || "Student reassigned!");
      setActionStudent(null); setActionType(null); setReassignTeacherId("");
      await loadAllStudentsData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to reassign student."); }
  };

  const approveQuiz = async (quizId: number) => {
    setQuizLoading(true);
    try {
      await request(`/api/teacher-admin/pending-quizzes/${quizId}/approve`, { method: "POST" });
      setPendingQuizzes((items) => items.filter((item) => item.id !== quizId));
      setActionSuccess("Quiz approved!");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to approve quiz."); }
    finally { setQuizLoading(false); }
  };

  const rejectQuiz = async (quizId: number) => {
    setQuizLoading(true);
    try {
      await request(`/api/teacher-admin/pending-quizzes/${quizId}/reject`, { method: "POST", body: JSON.stringify({ reason: "Please review and resubmit." }) });
      setPendingQuizzes((items) => items.filter((item) => item.id !== quizId));
      setActionSuccess("Quiz rejected.");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to reject quiz."); }
    finally { setQuizLoading(false); }
  };

  const dismissBookRequest = async (notifId: number) => {
    try {
      const token = getTokenFromCookie();
      if (!token) return;
      await fetch(`${API_BASE}/api/notifications/mark-seen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: notifId }),
      });
      setBookRequests((items) => items.filter((item) => item.id !== notifId));
      setBellRefreshKey((k) => k + 1);
      setActionSuccess("Request dismissed.");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) { setActionError("Unable to dismiss request."); }
  };

  const openActionModal = async (student: AllStudent, type: "password" | "reward" | "reassign") => {
    setActionStudent(student); setActionType(type); setActionError(""); setActionSuccess("");
    setNewPassword(""); setRewardTitle(""); setRewardMessage(""); setRewardQuizCount(""); setReassignTeacherId("");
    if (type === "reward") {
      try {
        const data = await request(`/api/teacher-admin/students/${student.id}/rewards`);
        setExistingRewards(data.rewards || []);
      } catch { setExistingRewards([]); }
    }
  };

  const closeActionModal = () => {
    setActionStudent(null); setActionType(null); setActionError(""); setNewPassword(""); setRewardTitle(""); setRewardMessage(""); setRewardQuizCount(""); setReassignTeacherId(""); setExistingRewards([]);
  };

  const name = (student: Student) => student.displayName || student.display_name || student.username;
  const points = (student: Student) => student.totalPoints ?? student.total_points ?? 0;
  const quizzes = (student: Student) => student.quizzesTaken ?? student.quizzes_taken ?? 0;

  const fetchGradeChangeRequests = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/grade-change-requests`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setGradeChangeRequests(data.requests || []);
      }
    } catch {}
  };

  const handleGradeChange = async (requestId: number, action: 'approve' | 'deny') => {
    try {
      const token = getTokenFromCookie();
      if (!token) return;
      await fetch(`${API_BASE}/api/grade-change-requests/${requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      await fetchGradeChangeRequests(token);
      await loadData();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to process request');
    }
  };

  // Filtered all students
  const filteredAllStudents = allStudents.filter((s) => {
    const matchesSearch = !searchQuery || 
      s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeacher = !filterTeacher || String(s.teacherId) === filterTeacher;
    return matchesSearch && matchesTeacher;
  });

  const pendingCount = allPending.length + pendingQuizzes.length;

  if (!user || !authorized) return null;
  const bell = <NotificationBell refreshKey={bellRefreshKey} onNavigate={(type, id) => { if (type === "request") setTab("book-requests"); else if (type === "user") setTab("pending"); else if (type === "ai_quiz") setTab("all-students"); }} />;
  const quick = (dark: React.CSSProperties, main = false): React.CSSProperties => hubLook ? (main ? styles.quickBtnMain : styles.quickBtn) : { ...styles.primaryBtn, width: "100%", marginTop: 0, ...dark };
  return <StyleContext.Provider value={styles}><main style={hubLook ? styles.page : embedded ? { ...styles.page, minHeight: 0, borderRadius: 24, padding: "18px clamp(12px, 3vw, 32px) 32px" } : styles.page} data-testid={embedded ? "workhub-reader-dashboard" : undefined}>
    {embedded ? <div style={hubLook ? styles.hubHead : { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, maxWidth: 1200, margin: "0 auto" }}><h2 style={{ margin: 0, fontSize: hubLook ? 18 : 22, fontWeight: hubLook ? 700 : 900, letterSpacing: "-0.02em" }}>Teacher tools</h2>{bell}</div> : <header style={styles.header}><button onClick={() => navigate("/library")} style={styles.subtleButton} data-testid="button-back-library"><ArrowLeft size={19} /> Library</button><h1 style={styles.title}>Teacher Dashboard</h1><div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>{bell}<button onClick={() => { if (window.confirm("Are you sure you want to log out?")) { logout(); navigate("/"); } }} style={styles.subtleButton} data-testid="button-teacher-logout">Logout <LogOut size={19} /></button></div></header>}
    {!accountApproved ? <section style={styles.notice} role="status" data-testid="status-teacher-pending">Your account is pending approval by the administrator.</section> : <section style={embedded && !hubLook ? { ...styles.content, marginTop: 18 } : styles.content}>
      <button onClick={() => navigate("/teacher-arise-2")} style={styles.arise2Banner} data-testid="button-teacher-arise-2">
        <span style={styles.arise2Icon}><Sparkles size={20} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={styles.arise2Eyebrow}>New for teachers</span>
          <span style={styles.arise2Title}>What A.R.I.S.E. 2.0 can do for your class</span>
          <span style={styles.arise2Sub}>Live games, game-time controls, and quiz tracking in one 2-minute read.</span>
        </span>
        <ChevronRight size={22} style={{ flexShrink: 0, opacity: 0.75 }} />
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 18 }}>
        <button onClick={() => navigate("/live-quiz")} style={quick({}, true)}>Host a live quiz</button>
        <button onClick={() => navigate("/study")} style={quick({ background: "#173b33" })} data-testid="button-teacher-study">
          <GraduationCap size={18} /> Study Squad sets
        </button>
        <button onClick={() => navigate("/leaderboard")} style={quick({ background: "linear-gradient(90deg,#b45309 0%,#d97706 50%,#f59e0b 100%)" })} data-testid="button-teacher-leaderboard">
          <Trophy size={18} /> Leaderboard
        </button>
        <button onClick={() => navigate("/teacher-scenes")} style={quick({ background: "linear-gradient(90deg,#0891b2 0%,#7c3aed 52%,#d946ef 100%)" })} data-testid="button-teacher-scenes">
          <BookOpen size={18} /> Scenes
        </button>
        {!user.isAdmin && <button onClick={() => navigate("/billing")} style={hubLook ? styles.quickBtn : { ...styles.subtleButton, width: "100%", justifyContent: "center" }} data-testid="button-teacher-plan">
          Your plan
        </button>}
      </div>
      <div style={{ marginBottom: 18 }}><AddonsCard compact returnPath="/billing" /></div>
      <div style={{ marginBottom: 18 }}><PlayTimeManager /></div>
      <div style={styles.tabs} role="tablist" aria-label="Teacher dashboard sections">
        <TabButton active={tab === "students"} onClick={() => setTab("students")} icon={<Users size={19} />}>My Students</TabButton>
        <TabButton active={tab === "all-students"} onClick={() => setTab("all-students")} icon={<Users size={19} />}>All Students</TabButton>
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")} icon={<UserRound size={19} />}>Pending Approvals{pending.length ? ` (${pending.length})` : ""}</TabButton>
        <TabButton active={tab === "book-requests"} onClick={() => setTab("book-requests")} icon={<BookOpen size={19} />}>Book Requests{bookRequests.length ? ` (${bookRequests.length})` : ""}</TabButton>
        <TabButton active={tab === "parents"} onClick={() => setTab("parents")} icon={<Users size={19} />}>Parents</TabButton>
        <TabButton active={tab === "proctor"} onClick={() => setTab("proctor")} icon={<KeyRound size={19} />}>Proctor</TabButton>
        <TabButton active={tab === "camera-quizzes"} onClick={() => setTab("camera-quizzes")} icon={<Camera size={19} />}>Camera Quizzes</TabButton>
        <TabButton active={tab === "comprehension"} onClick={() => setTab("comprehension")} icon={<PenLine size={19} />}>Reading Comprehension{comprehensionPending ? ` (${comprehensionPending})` : ""}</TabButton>
        <TabButton active={tab === "grade-changes"} onClick={() => setTab("grade-changes")} icon={<GraduationCap size={19} />}>Grade Changes{gradeChangeRequests.length ? ` (${gradeChangeRequests.length})` : ""}</TabButton>
        <TabButton active={tab === "growth-check"} onClick={() => setTab("growth-check")} icon={<Brain size={19} />}>Growth Check</TabButton>
        <TabButton active={tab === "club-controls"} onClick={() => setTab("club-controls")} icon={<Gamepad2 size={19} />}>Club Controls</TabButton>
        <TabButton active={tab === "prizes"} onClick={() => setTab("prizes")} icon={<Gift size={19} />}>Prizes</TabButton>
      </div>

      {actionSuccess && <div style={styles.successBanner}><CheckCircle2 size={18} /> {actionSuccess}</div>}
      {actionError && <div style={styles.errorBanner}><X size={18} /> {actionError}</div>}

      {/* === ALL STUDENTS TAB === */}
      {tab === "all-students" && (
        allLoading ? <p style={styles.muted}>Loading all students...</p> :
        allError ? <div style={styles.error} role="alert">{allError}</div> :
        <div>
          {/* Pending AI Quizzes Section */}
          {pendingQuizzes.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={styles.sectionTitle}><FileQuestion size={20} /> Pending AI Quizzes ({pendingQuizzes.length})</h2>
              <div style={styles.quizGrid}>
                {pendingQuizzes.map((q) => (
                  <div key={q.id} style={styles.quizCard}>
                    <div style={styles.quizCardHead}>
                      <div>
                        <h3 style={styles.quizTitle}>{q.book_title}</h3>
                        <p style={styles.quizMeta}>by {q.author || "Unknown"}</p>
                        <p style={styles.quizMeta}>Student: {q.student_name} | Type: {q.quiz_type || "book"}</p>
                      </div>
                    </div>
                    <div style={styles.quizActions}>
                      <button onClick={() => void approveQuiz(q.id)} disabled={quizLoading} style={styles.approveBtn}><Check size={16} /> Approve</button>
                      <button onClick={() => void rejectQuiz(q.id)} disabled={quizLoading} style={styles.rejectBtn}><X size={16} /> Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Student Approvals Section */}
          {allPending.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={styles.sectionTitle}><UserRound size={20} /> Pending Student Approvals ({allPending.length})</h2>
              <div style={styles.pendingList}>
                {allPending.map((s) => (
                  <div key={s.id} style={styles.pendingCard}>
                    <div>
                      <h3 style={styles.studentName}>{s.displayName || s.username}</h3>
                      <p style={styles.username}>@{s.username}</p>
                      {s.teacherName && <p style={styles.quizMeta}>Teacher: {s.teacherName}</p>}
                    </div>
                    <button onClick={() => void approveAllStudent(s.id)} style={styles.approveButton}><Check size={18} /> Approve</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter */}
          <div style={styles.searchRow}>
            <div style={styles.searchBox}>
              <Search size={18} style={styles.searchIcon} />
              <input type="text" placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchInput} />
            </div>
            <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} style={styles.filterSelect}>
              <option value="">All Teachers</option>
              {teachers.map((t) => <option key={t.id} value={String(t.id)}>{t.displayName}</option>)}
            </select>
          </div>

          {/* All Students Grid */}
          <div style={styles.grid}>
            {filteredAllStudents.length ? filteredAllStudents.map((student) => (
              <article key={student.id} style={styles.card}>
                <div style={styles.cardHead}>
                  <div>
                    <h2 style={styles.studentName}>{student.displayName || student.username}</h2>
                    <p style={styles.username}>@{student.username}</p>
                    {student.teacherName && <p style={styles.teacherLabel}>Teacher: {student.teacherName}</p>}
                    {!student.approvedByTeacher && <span style={styles.pendingBadge}>Pending</span>}
                  </div>
                </div>
                <div style={styles.stats}>
                  <span><strong>{student.totalPoints || 0}</strong> pts</span>
                  <span><strong>{student.quizzesTaken || 0}</strong> quizzes</span>
                  <span><strong>{student.quizzesMastered || 0}</strong> mastered</span>
                </div>
                <div style={styles.actions}>
                  <ActionButton onClick={() => navigate(`/student-profile/${student.id}`)} icon={<UserRound size={16} />}>View</ActionButton>
                  <ActionButton onClick={() => openActionModal(student, "password")} icon={<KeyRound size={16} />}>Password</ActionButton>
                  <ActionButton onClick={() => openActionModal(student, "reward")} icon={<Gift size={16} />}>Reward</ActionButton>
                  <ActionButton onClick={() => openActionModal(student, "reassign")} icon={<GraduationCap size={16} />}>Reassign</ActionButton>
                </div>
              </article>
            )) : <div style={styles.empty}>No students found.</div>}
          </div>
        </div>
      )}

      {/* === ACTION MODAL === */}
      {actionStudent && actionType && (
        <div style={styles.modalOverlay} onClick={closeActionModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <h3 style={styles.modalTitle}>
                {actionType === "password" && "Reset Password"}
                {actionType === "reward" && "Manage Rewards"}
                {actionType === "reassign" && "Reassign Teacher"}
              </h3>
              <button onClick={closeActionModal} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.modalStudent}>{actionStudent.displayName || actionStudent.username} (@{actionStudent.username})</p>

              {actionType === "password" && (
                <div>
                  <label style={styles.label}>New Password</label>
                  <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" style={styles.input} />
                  <button onClick={() => void resetPasswordAll(actionStudent.id)} style={styles.primaryBtn}>Reset Password</button>
                </div>
              )}

              {actionType === "reward" && (
                <div>
                  <h4 style={styles.subSectionTitle}>Add New Reward</h4>
                  <label style={styles.label}>Title</label>
                  <input type="text" value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} placeholder="e.g. 10 Quiz Champion" style={styles.input} />
                  <label style={styles.label}>Message</label>
                  <textarea value={rewardMessage} onChange={(e) => setRewardMessage(e.target.value)} placeholder="Reward message for student" style={styles.textarea} />
                  <label style={styles.label}>Required Quiz Count (optional)</label>
                  <input type="number" value={rewardQuizCount} onChange={(e) => setRewardQuizCount(e.target.value)} placeholder="e.g. 5" style={styles.input} />
                  <button onClick={() => void addRewardAll(actionStudent.id)} style={styles.primaryBtn}><Gift size={16} /> Add Reward</button>

                  {existingRewards.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={styles.subSectionTitle}>Existing Rewards ({existingRewards.length})</h4>
                      {existingRewards.map((r) => (
                        <div key={r.id} style={styles.rewardItem}>
                          <div>
                            <strong>{r.title}</strong>
                            <p style={styles.quizMeta}>{r.message}</p>
                            {r.requiredQuizCount ? <p style={styles.quizMeta}>Requires {r.requiredQuizCount} quizzes</p> : null}
                            <span style={r.active ? styles.activeBadge : styles.inactiveBadge}>{r.active ? "Active" : "Inactive"}</span>
                          </div>
                          <button onClick={() => void deleteRewardAll(actionStudent.id, r.id)} style={styles.deleteBtn}><X size={16} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {actionType === "reassign" && (
                <div>
                  <label style={styles.label}>Select New Teacher</label>
                  <select value={reassignTeacherId} onChange={(e) => setReassignTeacherId(e.target.value)} style={styles.filterSelect}>
                    <option value="">-- Select Teacher --</option>
                    {teachers.filter((t) => t.id !== actionStudent.teacherId).map((t) => (
                      <option key={t.id} value={String(t.id)}>{t.displayName} (@{t.username})</option>
                    ))}
                  </select>
                  {actionStudent.teacherName && <p style={styles.quizMeta}>Current teacher: {actionStudent.teacherName}</p>}
                  <button onClick={() => void reassignStudent(actionStudent.id)} style={styles.primaryBtn}>Reassign Student</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === BOOK REQUESTS TAB === */}
      {tab === "book-requests" && (
        bookReqLoading ? <p style={styles.muted}>Loading book requests...</p> :
        <div>
          <h2 style={styles.sectionTitle}><BookOpen size={20} /> Student Book Requests{bookRequests.length ? ` (${bookRequests.length})` : ""}</h2>
          {bookRequests.length ? (
            <div style={styles.pendingList}>
              {bookRequests.map((req) => (
                <div key={req.id} style={styles.pendingCard}>
                  <div style={{ flex: 1 }}>
                    <h3 style={styles.studentName}>{req.bookTitle}</h3>
                    <p style={styles.username}>Requested by {req.studentName}</p>
                    {req.message && <p style={styles.quizMeta}>{req.message}</p>}
                    <p style={styles.quizMeta}>{new Date(req.createdAt).toLocaleString()}</p>
                  </div>
                  <button onClick={() => void dismissBookRequest(req.id)} style={styles.copyBtn}>Dismiss</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>No book requests from students yet.</div>
          )}
        </div>
      )}

      {/* === PARENTS TAB === */}
      {tab === "parents" && (
        <div>
          <div style={{ ...styles.proctorCard, marginBottom: 18 }}>
            <h2 style={styles.proctorTitle}><Users size={22} /> Parent Codes & Accounts</h2>
            <p style={styles.proctorDesc}>Give families their private code or signup link, print letters, and see which parent/guardian accounts are already connected to your students.</p>
            <button style={styles.primaryBtn} onClick={() => printLetters()}>Print parent letters for my students</button>
          </div>
          <div style={{ marginBottom: 18 }}><FamilyEmailInvite /></div>
          {parentConnectionsLoading ? <p style={styles.muted}>Loading parent connections...</p> : (
            <div style={styles.grid}>
              {parentConnections.length ? parentConnections.map((student) => (
                <article key={student.id} style={styles.card}>
                  <div style={styles.cardHead}>
                    <div><h2 style={styles.studentName}>{student.displayName}</h2><p style={styles.username}>@{student.username}</p></div>
                    <span style={hubLook ? {...styles.pendingBadge,background:student.parents.length?"#dcfce7":"#fef3c7",color:student.parents.length?"#166534":"#92400e"} : {...styles.pendingBadge,background:student.parents.length?"hsl(145 70% 45% / .16)":"hsl(38 90% 50% / .16)",color:student.parents.length?"hsl(145 65% 62%)":"hsl(38 95% 68%)"}}>{student.parents.length ? student.parents.length + " LINKED" : "NOT LINKED"}</span>
                  </div>
                  <label style={styles.label}>Parent code</label>
                  <div style={styles.proctorDisplay}><code style={{...styles.proctorCode,fontSize:18}}>{student.code}</code><button onClick={() => void copyText(student.code, "Parent code")} style={styles.copyBtn}><Copy size={15}/> Copy</button></div>
                  <div style={{...styles.actions,marginTop:12}}>
                    <ActionButton onClick={() => printLetters(student.id)} icon={<BookOpen size={16}/>}>Print Letter</ActionButton>
                    <ActionButton onClick={() => void copyText(student.signupUrl, "Signup link")} icon={<Copy size={16}/>}>Copy Link</ActionButton>
                    <ActionButton onClick={() => window.open(student.signupUrl, "_blank", "noopener,noreferrer")} icon={<ExternalLink size={16}/>}>Open Signup</ActionButton>
                  </div>
                  <div style={{marginTop:16}}><ParentEmailInvite studentId={student.id} studentName={student.displayName} /></div>
                  <div style={{marginTop:16,borderTop:"1px solid rgba(255,255,255,.09)",paddingTop:12}}>
                    <p style={styles.label}>Linked parent / guardian accounts</p>
                    {student.parents.length ? student.parents.map((parent) => <div key={parent.id} style={{...styles.rewardItem,marginTop:8}}><div><strong>{parent.displayName}</strong><p style={styles.quizMeta}>@{parent.username}{parent.email ? " · " + parent.email : ""}</p></div><span style={parent.accountApproved?styles.activeBadge:styles.inactiveBadge}>{parent.accountApproved?"Active":"Pending"}</span></div>) : <p style={styles.quizMeta}>No parent account is linked yet.</p>}
                  </div>
                </article>
              )) : <div style={styles.empty}>No students are assigned to you.</div>}
            </div>
          )}
        </div>
      )}

      {/* === MY STUDENTS TAB (original) === */}
      {loading ? <p style={styles.muted}>Loading students...</p> : error ? <div style={styles.error} role="alert">{error}</div> : tab === "students" ? <div style={styles.grid}>{students.length ? students.map((student) => <article key={student.id} style={styles.card} data-testid={`card-student-${student.id}`}><div style={styles.cardHead}><div><h2 style={styles.studentName}>{name(student)}</h2><p style={styles.username}>@{student.username}</p></div></div><div style={styles.stats}><span><strong>{points(student)}</strong> total points</span><span><strong>{quizzes(student)}</strong> quizzes taken</span></div><div style={styles.actions}><ActionButton onClick={() => navigate(`/student-profile/${student.id}`)} icon={<UserRound size={16} />}>View Profile</ActionButton><ActionButton onClick={() => navigate(`/messages/${student.id}`)} icon={<Mail size={16} />}>Message</ActionButton><ActionButton onClick={() => { setActionStudent(student); setActionType("password"); setNewPassword(""); setActionError(""); }} icon={<KeyRound size={16} />}>Reset Password</ActionButton><ActionButton onClick={() => navigate(`/student-certificates/${student.id}`)} icon={<Award size={16} />}>Certificates</ActionButton></div></article>) : <div style={styles.empty}>No students have joined your classroom yet.</div>}</div> : null}

      {/* === PENDING TAB (original - my own pending) === */}
      {tab === "pending" && (loading ? <p style={styles.muted}>Loading...</p> : <div style={styles.pendingList}>{pending.length ? pending.map((student) => <article key={student.id} style={styles.pendingCard} data-testid={`card-pending-student-${student.id}`}><div><h2 style={styles.studentName}>{name(student)}</h2><p style={styles.username}>@{student.username}</p></div><button onClick={() => void approve(student.id)} style={styles.approveButton} data-testid={`button-approve-student-${student.id}`}><Check size={18} /> Approve</button></article>) : <div style={styles.empty}>No pending students</div>}</div>)}

      {/* === PROCTOR TAB === */}
      {tab === "proctor" && <div style={{ maxWidth: 600, margin: "0 auto" }}>{teacherBanner && teacherBanner.active && teacherBanner.text ? <BannerTap link={teacherBanner.link} style={{ ...styles.bannerCard, display: "flex", gap: 12, alignItems: "flex-start", background: teacherBanner.bgColor, color: teacherBanner.textColor }}><span style={{ minWidth: 0 }}>{teacherBanner.text}</span></BannerTap> : null}<div style={styles.proctorCard}><h2 style={styles.proctorTitle}><KeyRound size={22} /> Proctor Password</h2><p style={styles.proctorDesc}>Students use this password to enter proctor mode. Share it only when proctoring a quiz.</p><p style={styles.proctorDesc}>At the end of every book quiz, students can also write about the book for up to 10 extra points, with your code or on their own with the camera on. You grade those under <button type="button" onClick={() => setTab("comprehension")} style={{ background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>Reading Comprehension</button>.</p><div style={styles.proctorDisplay}><code style={styles.proctorCode}>{proctorPassword || "Not set"}</code><button onClick={() => { if (proctorPassword) navigator.clipboard?.writeText(proctorPassword).catch(() => {}); }} style={styles.copyBtn}>Copy</button></div></div></div>}

      {/* === GRADE CHANGES TAB === */}
      {tab === "grade-changes" && <div style={styles.pendingList}>{gradeChangeRequests.length ? gradeChangeRequests.map((req) => <div key={req.id} style={styles.pendingCard}><div><h2 style={styles.studentName}>{req.studentName}</h2><p style={styles.username}>Current: Grade {req.currentGrade} → Requested: Grade {req.requestedGrade}</p></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => void handleGradeChange(req.id, "approve")} style={styles.approveButton}><Check size={16} /> Approve</button><button onClick={() => void handleGradeChange(req.id, "deny")} style={styles.rejectBtn}><X size={16} /> Deny</button></div></div>) : <div style={styles.empty}>No grade change requests</div>}</div>}

      {/* === CLUB A.R.I.S.E. CONTROLS === */}
      {tab === "camera-quizzes" && <div style={{ maxWidth: 1000, margin: "0 auto" }}><NoProctorReview title="Camera quizzes from your students" /></div>}
      {tab === "comprehension" && <div style={{ maxWidth: 1000, margin: "0 auto" }}><ComprehensionReview title="Reading comprehension from your students" onPendingChange={setComprehensionPending} /></div>}
      {tab === "club-controls" && (
        <div>
          <div style={{ ...styles.proctorCard, marginBottom: 18 }}>
            <h2 style={styles.proctorTitle}><Gamepad2 size={22} /> Club A.R.I.S.E. Game Controls</h2>
            <p style={styles.proctorDesc}>The default rule gives a student unlimited A.R.I.S.E. world/game play for the rest of the school week after they pass one book quiz. You can turn that reward off for any student, lock Club play, or keep separate multiplayer-game limits.</p>
            <p style={styles.quizMeta}><strong>Weekly reward:</strong> A qualifying quiz passed Monday–Sunday unlocks unlimited play until the next Monday. Teacher/admin locks still override it.</p>
          </div>
          {user?.role === "teacher" && <div style={{ ...styles.proctorCard, marginBottom: 18 }}>
            <h2 style={styles.proctorTitle}><Clock3 size={22} /> My Class Closing Hours</h2>
            <p style={styles.proctorDesc}>Set when Club A.R.I.S.E. closes for students assigned to you. Admin closing hours always override teacher hours.</p>
            {clubClosingLoading ? <p style={styles.muted}>Loading class hours...</p> : <>
              {clubClosing.adminOverrideClosedNow && <div style={{...styles.notice,margin:"10px 0"}}>Admin has Club A.R.I.S.E. closed right now. Your class schedule cannot reopen it until the admin window ends.</div>}
              <label style={{...styles.label,display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={clubClosing.enabled} onChange={e=>setClubClosing(v=>({...v,enabled:e.target.checked}))}/> Use class closing hours</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:10}}>
                <label style={styles.label}>Close at<input type="time" value={clubClosing.start} onChange={e=>setClubClosing(v=>({...v,start:e.target.value}))} style={styles.input}/></label>
                <label style={styles.label}>Reopen at<input type="time" value={clubClosing.end} onChange={e=>setClubClosing(v=>({...v,end:e.target.value}))} style={styles.input}/></label>
              </div>
              <p style={{...styles.label,marginTop:12}}>Days this closing window starts</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:12}}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day,index)=>{
                const active=clubClosing.days.includes(index);
                return <button type="button" key={day} onClick={()=>setClubClosing(v=>({...v,days:active?v.days.filter(d=>d!==index):[...v.days,index].sort((a,b)=>a-b)}))} style={hubLook ? {...styles.copyBtn,background:active?"#0f172a":"#fff",color:active?"#fff":"#334155"} : {...styles.copyBtn,background:active?"#7c3aed":"#171326",color:"#fff"}}>{day}</button>;
              })}</div>
              <button disabled={clubClosingSaving} onClick={()=>void saveClubClosing()} style={styles.primaryBtn}>{clubClosingSaving?"Saving...":"Save class closing hours"}</button>
              <p style={styles.quizMeta}>Times use Mountain Time. If the closing time is later than the reopening time, the window runs overnight.</p>
            </>}
          </div>}
          {clubControlsLoading ? <p style={styles.muted}>Loading Club controls...</p> : (
            <div style={styles.grid}>
              {clubControls.length ? clubControls.map((student:any) => {
                const control=student.control||{};
                const access=student.access||{};
                return <article key={student.id} style={styles.card}>
                  <div style={styles.cardHead}>
                    <div>
                      <h2 style={styles.studentName}>{student.display_name || student.username}</h2>
                      <p style={styles.username}>@{student.username}</p>
                    </div>
                    <span style={hubLook ? {...styles.pendingBadge,background:control.locked?"#fee2e2":"#dcfce7",color:control.locked?"#b91c1c":"#166534"} : {...styles.pendingBadge,background:control.locked?"hsl(0 75% 50% / .18)":"hsl(145 70% 45% / .16)",color:control.locked?"hsl(0 85% 68%)":"hsl(145 65% 62%)"}}>
                      {control.locked?"LOCKED":"OPEN"}
                    </span>
                  </div>
                  <button
                    onClick={() => void saveClubControl(student.id,{locked:!control.locked})}
                    style={{...styles.primaryBtn,background:control.locked?"hsl(145 65% 42%)":"hsl(0 70% 48%)"}}
                  >
                    {control.locked?<><Unlock size={16}/> Unlock Club Games</>:<><Lock size={16}/> Lock Club Games</>}
                  </button>
                  <label style={styles.label}>Passed book quiz reward</label>
                  <select
                    value={(control.weekly_unlimited_on_pass ?? true) ? "on" : "off"}
                    onChange={e => void saveClubControl(student.id,{weeklyUnlimitedOnPass:e.target.value==="on"})}
                    style={styles.filterSelect}
                  >
                    <option value="on">Unlimited play for the rest of that week</option>
                    <option value="off">Off — keep normal daily play time</option>
                  </select>
                  <label style={styles.label}>Daily multiplayer game limit</label>
                  <select
                    value={control.daily_game_limit ?? ""}
                    onChange={e => void saveClubControl(student.id,{dailyGameLimit:e.target.value===""?null:Number(e.target.value)})}
                    style={styles.filterSelect}
                  >
                    <option value="">No daily limit</option>
                    <option value="1">1 game/day</option>
                    <option value="2">2 games/day</option>
                    <option value="3">3 games/day</option>
                    <option value="5">5 games/day</option>
                    <option value="10">10 games/day</option>
                    <option value="20">20 games/day</option>
                  </select>
                  <label style={styles.label}>Games unlocked per passed book quiz</label>
                  <select
                    value={control.games_per_passed_quiz ?? 0}
                    onChange={e => void saveClubControl(student.id,{gamesPerPassedQuiz:Number(e.target.value)})}
                    style={styles.filterSelect}
                  >
                    <option value="0">Off — no quiz requirement</option>
                    <option value="1">1 game per passed quiz</option>
                    <option value="2">2 games per passed quiz</option>
                    <option value="3">3 games per passed quiz</option>
                    <option value="5">5 games per passed quiz</option>
                  </select>
                  {access && <p style={styles.quizMeta}>Current access: {access.allowed?"Can play":access.locked?"Teacher locked":access.dailyRemaining===0?"Daily limit reached":"Needs another passed quiz"}</p>}
                </article>;
              }) : <div style={styles.empty}>No regular students are assigned to you.</div>}
            </div>
          )}
        </div>
      )}

      {/* === GROWTH CHECK TAB === */}
      {/* Prizes the teacher puts up for their class or school, and hands out themself. */}
      {tab === "prizes" && <div style={{ maxWidth: 900, margin: "0 auto" }}><PrizeManager token={getTokenFromCookie()} role="teacher" /></div>}
      {tab === "growth-check" && <div style={{ maxWidth: 900, margin: "0 auto" }}>{growthCheckData.length ? growthCheckData.map((attempt: any) => <div key={attempt.id} style={styles.pendingCard}><div><h2 style={styles.studentName}>{attempt.studentName || "Student"}</h2><p style={styles.username}>Score: {attempt.score}/{attempt.totalQuestions} | WCPM: {attempt.wcpm || "N/A"}</p></div></div>) : <div style={styles.empty}>No growth check data yet.</div>}</div>}
    </section>}
  </main></StyleContext.Provider>;
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { const styles = useContext(StyleContext); return <button role="tab" aria-selected={active} onClick={onClick} style={{ ...styles.tab, ...(active ? styles.activeTab : {}) }} data-testid={`tab-${active ? "active" : "inactive"}`}>{icon}{children}</button>; }
function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { const styles = useContext(StyleContext); return <button onClick={onClick} style={styles.actionButton}>{icon}{children}</button>; }

const darkStyles: Record<string, React.CSSProperties> = {
  arise2Banner: { display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "linear-gradient(110deg, rgba(124,58,237,.30), rgba(192,38,211,.18) 55%, rgba(6,182,212,.20))", border: "1px solid rgba(196,181,253,.30)", borderRadius: 18, color: "#fff", cursor: "pointer", padding: "16px 18px", marginBottom: 14, boxShadow: "0 16px 40px rgba(124,58,237,.18)" },
  arise2Icon: { display: "grid", placeItems: "center", width: 44, height: 44, flexShrink: 0, borderRadius: 14, background: "linear-gradient(135deg,#8b5cf6,#d946ef,#22d3ee)" },
  arise2Eyebrow: { display: "block", fontSize: 11, fontWeight: 900, letterSpacing: ".2em", textTransform: "uppercase", color: "#a5f3fc" },
  arise2Title: { display: "block", fontSize: 18, fontWeight: 900, marginTop: 2 },
  arise2Sub: { display: "block", fontSize: 14, color: "hsl(0 0% 78%)", marginTop: 2 },
  bannerCard: { padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 15, fontWeight: 600 },
  page: { minHeight: "100vh", background: "radial-gradient(circle at 10% 0%, rgba(124,58,237,.24), transparent 28%), radial-gradient(circle at 90% 8%, rgba(6,182,212,.16), transparent 26%), radial-gradient(circle at 52% 45%, rgba(217,70,239,.08), transparent 35%), #0b0a16", color: "#f8fafc", fontFamily: "'Barlow', system-ui, sans-serif", padding: "20px clamp(16px, 4vw, 56px) 48px" },
  header: { maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,.10)", paddingBottom: 20, gap: 12 },
  title: { background: "linear-gradient(90deg,#8b5cf6,#d946ef,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 900, letterSpacing: "-0.035em", margin: 0, textAlign: "center", whiteSpace: "nowrap" },
  subtleButton: { display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content", color: "hsl(0 0% 85%)", background: "transparent", border: 0, cursor: "pointer", fontSize: 16, fontWeight: 700, padding: 8 },
  content: { maxWidth: 1200, margin: "30px auto 0" },
  tabs: { display: "flex", flexWrap: "wrap", gap: 8, borderBottom: "1px solid rgba(255,255,255,.10)", marginBottom: 24 },
  tab: { display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", color: "hsl(0 0% 65%)", border: 0, borderBottom: "3px solid transparent", cursor: "pointer", fontSize: 17, fontWeight: 750, padding: "12px 16px" },
  activeTab: { color: "#c4b5fd", borderBottomColor: "#22d3ee", background: "linear-gradient(180deg, rgba(124,58,237,.10), rgba(217,70,239,.04))", borderRadius: "12px 12px 0 0" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 },
  card: { display: "grid", gap: 18, background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 20 },
  cardHead: { display: "flex", justifyContent: "space-between" },
  studentName: { fontSize: 20, margin: 0, color: "hsl(0 0% 98%)" },
  username: { margin: "4px 0 0", color: "hsl(0 0% 62%)", fontSize: 15 },
  teacherLabel: { margin: "4px 0 0", color: "#c4b5fd", fontSize: 13, fontWeight: 600 },
  pendingBadge: { display: "inline-block", marginTop: 6, padding: "2px 8px", borderRadius: 4, background: "hsl(45 100% 50% / 0.15)", color: "hsl(45 100% 60%)", fontSize: 12, fontWeight: 700 },
  stats: { display: "flex", justifyContent: "space-between", gap: 12, color: "hsl(0 0% 70%)", fontSize: 14 },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 },
  actionButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 38, background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 7, color: "hsl(0 0% 90%)", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "8px 4px" },
  empty: { gridColumn: "1 / -1", textAlign: "center", color: "hsl(0 0% 55%)", padding: 40, fontSize: 16 },
  muted: { color: "hsl(0 0% 55%)", textAlign: "center", padding: 40 },
  error: { background: "hsl(0 100% 50% / 0.1)", border: "1px solid hsl(0 100% 50% / 0.3)", borderRadius: 8, padding: 16, color: "hsl(0 100% 70%)", textAlign: "center" },
  notice: { maxWidth: 600, margin: "30px auto", background: "hsl(45 100% 50% / 0.1)", border: "1px solid hsl(45 100% 50% / 0.3)", borderRadius: 8, padding: 20, textAlign: "center", color: "hsl(45 100% 70%)" },
  pendingList: { display: "grid", gap: 12 },
  pendingCard: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 10, padding: 16 },
  approveButton: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(142 100% 40%)", border: 0, borderRadius: 8, color: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: "10px 18px" },
  rejectBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(0 100% 50% / 0.2)", border: "1px solid hsl(0 100% 50% / 0.4)", borderRadius: 8, color: "hsl(0 100% 70%)", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "10px 16px" },
  approveBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(142 100% 40%)", border: 0, borderRadius: 8, color: "white", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "8px 14px" },
  proctorCard: { background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 24 },
  proctorTitle: { display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px", fontSize: 22, color: "hsl(0 0% 95%)" },
  proctorDesc: { color: "hsl(0 0% 62%)", fontSize: 15, margin: "0 0 16px" },
  proctorDisplay: { display: "flex", alignItems: "center", gap: 12 },
  proctorCode: { fontSize: 28, fontWeight: 900, letterSpacing: 2, background: "#0f0d1d", padding: "12px 20px", borderRadius: 12, color: "#a5f3fc", border: "1px solid rgba(34,211,238,.18)" },
  copyBtn: { background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, color: "hsl(0 0% 85%)", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "10px 16px" },
  sectionTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 20, color: "hsl(0 0% 90%)", margin: "0 0 16px" },
  quizGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  quizCard: { background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 10, padding: 16 },
  quizCardHead: { display: "flex", justifyContent: "space-between", marginBottom: 12 },
  quizTitle: { fontSize: 17, margin: 0, color: "hsl(0 0% 95%)" },
  quizMeta: { fontSize: 13, color: "hsl(0 0% 60%)", margin: "2px 0" },
  quizActions: { display: "flex", gap: 8 },
  searchRow: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  searchBox: { flex: 1, minWidth: 200, display: "flex", alignItems: "center", background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 8, padding: "0 12px" },
  searchIcon: { color: "hsl(0 0% 50%)", flexShrink: 0 },
  searchInput: { flex: 1, background: "transparent", border: 0, color: "hsl(0 0% 90%)", fontSize: 16, padding: "10px 8px", outline: "none" },
  filterSelect: { background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 8, color: "hsl(0 0% 90%)", fontSize: 15, padding: "10px 12px", cursor: "pointer", minWidth: 150 },
  successBanner: { display: "flex", alignItems: "center", gap: 8, background: "hsl(142 100% 40% / 0.1)", border: "1px solid hsl(142 100% 40% / 0.3)", borderRadius: 8, padding: 12, marginBottom: 16, color: "hsl(142 100% 60%)", fontWeight: 600 },
  errorBanner: { display: "flex", alignItems: "center", gap: 8, background: "hsl(0 100% 50% / 0.1)", border: "1px solid hsl(0 100% 50% / 0.3)", borderRadius: 8, padding: 12, marginBottom: 16, color: "hsl(0 100% 70%)", fontWeight: 600 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "hsl(0 0% 12%)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 24, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, margin: 0, color: "#a5f3fc" },
  closeBtn: { background: "transparent", border: 0, color: "hsl(0 0% 60%)", cursor: "pointer", padding: 4 },
  modalBody: { display: "grid", gap: 12 },
  modalStudent: { fontSize: 15, color: "hsl(0 0% 70%)", marginBottom: 8 },
  label: { fontSize: 14, fontWeight: 700, color: "hsl(0 0% 75%)", marginBottom: 4 },
  input: { width: "100%", background: "#0f0d1d", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, color: "hsl(0 0% 90%)", fontSize: 15, padding: "10px 12px", outline: "none", boxSizing: "border-box" as const },
  textarea: { width: "100%", background: "#0f0d1d", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, color: "hsl(0 0% 90%)", fontSize: 15, padding: "10px 12px", outline: "none", minHeight: 60, resize: "vertical", boxSizing: "border-box" as const },
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(90deg,#7c3aed 0%,#c026d3 52%,#06b6d4 100%)", border: 0, borderRadius: 12, color: "white", cursor: "pointer", fontSize: 15, fontWeight: 900, padding: "11px 18px", marginTop: 8, boxShadow: "0 12px 28px rgba(124,58,237,.20)" },
  subSectionTitle: { fontSize: 15, color: "hsl(0 0% 80%)", margin: "16px 0 8px" },
  rewardItem: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, background: "#0f0d1d", border: "1px solid rgba(255,255,255,.10)", borderRadius: 8, padding: 12, marginBottom: 8 },
  deleteBtn: { background: "hsl(0 100% 50% / 0.15)", border: "1px solid hsl(0 100% 50% / 0.3)", borderRadius: 6, color: "hsl(0 100% 65%)", cursor: "pointer", padding: "6px 8px", flexShrink: 0 },
  activeBadge: { display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 4, background: "hsl(142 100% 40% / 0.15)", color: "hsl(142 100% 60%)", fontSize: 11, fontWeight: 700 },
  inactiveBadge: { display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 4, background: "hsl(0 0% 50% / 0.15)", color: "hsl(0 0% 60%)", fontSize: 11, fontWeight: 700 },
};

/* Inside Arise WorkHub the Reader tools take WorkHub's look: white cards with light borders,
   slate text, a row of pill tabs and slate buttons (night mode keeps the dark look above). */
const INK = "#0f172a", SOFT = "#475569", FAINT = "#64748b", LINE = "#e2e8f0", PANEL = "#ffffff", WASH = "#f8fafc";
const cardLook: React.CSSProperties = { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,.05)" };
const hubStyles: Record<string, React.CSSProperties> = {
  ...darkStyles,
  page: { color: INK, fontFamily: "inherit", padding: 0, background: "transparent" },
  hubHead: { ...cardLook, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px" },
  content: { margin: "16px 0 0" },
  arise2Banner: { ...cardLook, display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: 16, color: INK, cursor: "pointer", marginBottom: 16 },
  arise2Icon: { display: "grid", placeItems: "center", width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: "#f0fdfa", color: "#0f766e" },
  arise2Eyebrow: { display: "block", fontSize: 12, fontWeight: 700, color: "#0f766e" },
  arise2Title: { display: "block", fontSize: 16, fontWeight: 700, marginTop: 2, color: INK },
  arise2Sub: { display: "block", fontSize: 14, color: SOFT, marginTop: 2 },
  quickBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 44, borderRadius: 12, border: `1px solid ${LINE}`, background: PANEL, color: "#334155", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 14px" },
  quickBtnMain: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 44, borderRadius: 12, border: 0, background: INK, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 14px" },
  subtleButton: { display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content", color: SOFT, background: "transparent", border: 0, cursor: "pointer", fontSize: 14, fontWeight: 600, padding: 8 },
  tabs: { ...cardLook, display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 4, padding: 4, marginBottom: 16, scrollbarWidth: "none" },
  tab: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0, minHeight: 44, whiteSpace: "nowrap", background: "transparent", color: SOFT, border: 0, borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "0 16px" },
  activeTab: { background: INK, color: "#fff" },
  card: { ...cardLook, display: "grid", gap: 16, padding: 18 },
  studentName: { fontSize: 17, margin: 0, color: INK, fontWeight: 700 },
  username: { margin: "4px 0 0", color: FAINT, fontSize: 14 },
  teacherLabel: { margin: "4px 0 0", color: "#0f766e", fontSize: 13, fontWeight: 600 },
  pendingBadge: { display: "inline-block", marginTop: 6, padding: "2px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 700 },
  stats: { display: "flex", justifyContent: "space-between", gap: 12, color: SOFT, fontSize: 14 },
  actionButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 40, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, color: "#334155", cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "6px 10px" },
  empty: { gridColumn: "1 / -1", textAlign: "center", color: FAINT, padding: 32, fontSize: 15, ...cardLook, borderStyle: "dashed" },
  muted: { color: FAINT, textAlign: "center", padding: 32 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, color: "#b91c1c", textAlign: "center" },
  notice: { ...cardLook, maxWidth: 600, margin: "16px auto", background: "#fffbeb", borderColor: "#fde68a", padding: 20, textAlign: "center", color: "#92400e" },
  pendingCard: { ...cardLook, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 16, flexWrap: "wrap" },
  approveButton: { display: "inline-flex", alignItems: "center", gap: 8, background: "#0f766e", border: 0, borderRadius: 12, color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "10px 16px", minHeight: 44 },
  approveBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "#0f766e", border: 0, borderRadius: 10, color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "8px 14px", minHeight: 40 },
  rejectBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "8px 14px", minHeight: 40 },
  proctorCard: { ...cardLook, padding: 20 },
  proctorTitle: { display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: INK },
  proctorDesc: { color: SOFT, fontSize: 14, margin: "0 0 16px" },
  proctorCode: { fontSize: 26, fontWeight: 800, letterSpacing: 2, background: WASH, padding: "10px 18px", borderRadius: 12, color: "#0f766e", border: `1px solid ${LINE}` },
  copyBtn: { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, color: "#334155", cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "10px 16px", minHeight: 44 },
  sectionTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 700, color: INK, margin: "0 0 12px" },
  quizCard: { ...cardLook, padding: 16 },
  quizTitle: { fontSize: 16, margin: 0, color: INK, fontWeight: 700 },
  quizMeta: { fontSize: 13, color: FAINT, margin: "2px 0" },
  searchBox: { ...cardLook, flex: 1, minWidth: 200, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 12 },
  searchIcon: { color: "#94a3b8", flexShrink: 0 },
  searchInput: { flex: 1, background: "transparent", border: 0, color: INK, fontSize: 15, padding: "11px 8px", outline: "none" },
  filterSelect: { ...cardLook, borderRadius: 12, color: INK, fontSize: 14, padding: "10px 12px", cursor: "pointer", minHeight: 44 },
  successBanner: { display: "flex", alignItems: "center", gap: 8, background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 12, padding: 12, marginBottom: 16, color: "#115e59", fontWeight: 600 },
  errorBanner: { display: "flex", alignItems: "center", gap: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 12, marginBottom: 16, color: "#b91c1c", fontWeight: 600 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal: { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 20, padding: 22, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", color: INK, boxShadow: "0 20px 50px rgba(15,23,42,.2)" },
  modalTitle: { fontSize: 18, margin: 0, color: INK, fontWeight: 700 },
  closeBtn: { background: "transparent", border: 0, color: FAINT, cursor: "pointer", padding: 4 },
  modalStudent: { fontSize: 14, color: SOFT, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 4 },
  input: { width: "100%", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, color: INK, fontSize: 15, padding: "10px 12px", outline: "none", boxSizing: "border-box", minHeight: 44 },
  textarea: { width: "100%", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, color: INK, fontSize: 15, padding: "10px 12px", outline: "none", minHeight: 60, resize: "vertical", boxSizing: "border-box" },
  primaryBtn: { ...darkStyles.primaryBtn, background: INK, borderRadius: 12, boxShadow: "none", fontWeight: 600, minHeight: 44 },
  subSectionTitle: { fontSize: 14, fontWeight: 700, color: "#334155", margin: "16px 0 8px" },
  rewardItem: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, background: WASH, border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, marginBottom: 8, color: INK },
  deleteBtn: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", cursor: "pointer", padding: "6px 8px", flexShrink: 0 },
  activeBadge: { display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 999, background: "#ccfbf1", color: "#115e59", fontSize: 11, fontWeight: 700 },
  inactiveBadge: { display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", color: FAINT, fontSize: 11, fontWeight: 700 },
  bannerCard: { padding: "12px 16px", borderRadius: 12, marginBottom: 16, fontSize: 15, fontWeight: 600 },
};

/** The look the tab and action buttons use (set by the dashboard). */
const StyleContext = createContext<Record<string, React.CSSProperties>>(darkStyles);
