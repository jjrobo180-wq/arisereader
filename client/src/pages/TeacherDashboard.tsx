import { useEffect, useState } from "react";
import { ArrowLeft, Award, Check, GraduationCap, KeyRound, LogOut, Mail, UserRound, Users, Brain, Gift, Search, X, CheckCircle2, FileQuestion, Bell, BookOpen, Gamepad2, Lock, Unlock, Copy, ExternalLink, Clock3, Sparkles, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { NotificationBell } from "@/components/NotificationBell";
import { printParentInvites } from "@/lib/parentInvites";
import NoProctorReview from "@/components/NoProctorReview";
import PlayTimeManager from "@/components/PlayTimeManager";
import { PrizeManager } from "@/components/prizes/PrizeManager";
import { SectionNav, SectionTitle, scrollToPart, type NavSection } from "@/components/SectionNav";
import { TEACHER_SECTIONS, teacherSectionFor, type TeacherSectionId } from "@/lib/dashboardSections";

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

/** Where the open section is remembered while this browser tab stays open. */
const SECTION_KEY = "teacher_dashboard_section";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  // Other pages can ask for a part of this page by setting "teacher_dashboard_tab"
  // before coming here. They still use the names of the old tabs, which are
  // matched to where each one lives now. Otherwise the section that was open
  // last is opened again.
  const [start] = useState(() => {
    let requested: string | null = null, last: string | null = null;
    try { requested = sessionStorage.getItem("teacher_dashboard_tab"); sessionStorage.removeItem("teacher_dashboard_tab"); last = sessionStorage.getItem(SECTION_KEY); } catch {}
    return teacherSectionFor(requested || last);
  });
  const [section, setSection] = useState<TeacherSectionId>(start.section);
  /** Open a section. With `part`, also bring that part of it into view. */
  const openSection = (id: TeacherSectionId, part?: string) => {
    setSection(id);
    try { sessionStorage.setItem(SECTION_KEY, id); } catch {}
    if (part) scrollToPart(part);
  };
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [proctorPassword, setProctorPassword] = useState("");
  const [teacherBanner, setTeacherBanner] = useState<{ text: string; bgColor: string; textColor: string; active: boolean } | null>(null);
  const [gradeChangeRequests, setGradeChangeRequests] = useState<any[]>([]);
  const [growthCheckData, setGrowthCheckData] = useState<any[]>([]);

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
        void loadBookRequests();
        fetch(`${API_BASE}/api/teacher/growth-check/overview`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.attempts) setGrowthCheckData(data.attempts); })
          .catch(() => {});
      }
    } else { setLoading(false); }
  }, [user, authorized, accountApproved]);

  useEffect(() => {
    if (!accountApproved) return;
    if (section === "all" && !allStudents.length && !allLoading) void loadAllStudentsData();
    if (section === "families" && !parentConnectionsLoading) void loadParentConnections();
    if (section === "games") {
      if (!clubControlsLoading) void loadClubControls();
      if (user?.role === "teacher" && !clubClosingLoading) void loadClubClosing();
    }
  }, [section, accountApproved]);

  // Arriving from another page that asked for one part of a section
  useEffect(() => { if (start.part && accountApproved) scrollToPart(start.part); }, []);

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

  const sectionIcons: Record<TeacherSectionId, React.ReactNode> = {
    students: <Users size={18} />, requests: <CheckCircle2 size={18} />, families: <Mail size={18} />, quizzes: <FileQuestion size={18} />,
    games: <Gamepad2 size={18} />, prizes: <Gift size={18} />, all: <GraduationCap size={18} />,
  };
  const waiting: Partial<Record<TeacherSectionId, number>> = {
    requests: pending.length + gradeChangeRequests.length + bookRequests.length,
    all: allPending.length + pendingQuizzes.length,
  };
  const navSections: Array<NavSection<TeacherSectionId>> = TEACHER_SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: sectionIcons[s.id], waiting: waiting[s.id] }));
  const sectionInfo = TEACHER_SECTIONS.find((s) => s.id === section) || TEACHER_SECTIONS[0];

  if (!user || !authorized) return null;
  return <main style={styles.page}>
    <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-white/10 pb-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:pb-5">
      <button onClick={() => navigate("/library")} style={styles.subtleButton} data-testid="button-back-library"><ArrowLeft size={19} /> Library</button>
      <h1 style={styles.title} className="order-first basis-full sm:order-none sm:basis-auto">Teacher Dashboard</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
        {!user.isAdmin && <button onClick={() => navigate("/billing")} style={styles.subtleButton} data-testid="button-teacher-plan">Your plan</button>}
        <NotificationBell refreshKey={bellRefreshKey} onNavigate={(type) => { if (type === "request") openSection("requests", "book-requests"); else if (type === "user") openSection("requests", "pending-students"); else if (type === "ai_quiz") openSection("all"); }} />
        <button onClick={() => { if (window.confirm("Are you sure you want to log out?")) { try { sessionStorage.removeItem(SECTION_KEY); } catch {} logout(); navigate("/"); } }} style={styles.subtleButton} data-testid="button-teacher-logout">Logout <LogOut size={19} /></button>
      </div>
    </header>
    {!accountApproved ? <section style={styles.notice} role="status" data-testid="status-teacher-pending">Your account is pending approval by the administrator.</section> : <section style={styles.content}>
      {/* A message from the admin to every teacher */}
      {teacherBanner && teacherBanner.active && teacherBanner.text ? <div style={{ ...styles.bannerCard, background: teacherBanner.bgColor, color: teacherBanner.textColor }} role="status" data-testid="teacher-banner">{teacherBanner.text}</div> : null}

      <div style={{ marginBottom: 24 }}>
        <SectionNav label="Teacher dashboard sections" sections={navSections} current={section} onChange={(id) => openSection(id)} />
      </div>

      {actionSuccess && <div style={styles.successBanner}><CheckCircle2 size={18} /> {actionSuccess}</div>}
      {actionError && <div style={styles.errorBanner}><X size={18} /> {actionError}</div>}

      {section !== "students" && <div style={{ marginBottom: 20 }}><SectionTitle title={sectionInfo.label} about={sectionInfo.about} /></div>}

      {/* === MY STUDENTS === */}
      {section === "students" && <>
      <button onClick={() => navigate("/teacher-arise-2")} style={styles.arise2Banner} data-testid="button-teacher-arise-2">
        <span style={styles.arise2Icon}><Sparkles size={20} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={styles.arise2Eyebrow}>New for teachers</span>
          <span style={styles.arise2Title}>What A.R.I.S.E. 2.0 can do for your class</span>
          <span style={styles.arise2Sub}>Live games, game-time controls, and quiz tracking in one 2-minute read.</span>
        </span>
        <ChevronRight size={22} style={{ flexShrink: 0, opacity: 0.75 }} />
      </button>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
          <button onClick={() => navigate("/live-quiz")} style={{ ...styles.primaryBtn, width: "100%", marginTop: 0 }} data-testid="button-teacher-live-quiz">Host a live quiz</button>
          <button onClick={() => navigate("/study")} style={{ ...styles.primaryBtn, width: "100%", marginTop: 0, background: "#173b33" }} data-testid="button-teacher-study">
            <GraduationCap size={18} /> Study Squad sets
          </button>
          <button onClick={() => navigate("/teacher-scenes")} style={{ ...styles.primaryBtn, width: "100%", marginTop: 0, background: "linear-gradient(90deg,#0891b2 0%,#7c3aed 52%,#d946ef 100%)" }} data-testid="button-teacher-scenes">
            <BookOpen size={18} /> Scenes
          </button>
        </div>
        <h2 style={styles.sectionTitle}><Users size={20} /> My students{students.length ? ` (${students.length})` : ""}</h2>
        {loading ? <p style={styles.muted}>Loading students...</p> : error ? <div style={styles.error} role="alert">{error}</div> : <div style={styles.grid}>{students.length ? students.map((student) => <article key={student.id} style={styles.card} data-testid={`card-student-${student.id}`}><div style={styles.cardHead}><div><h2 style={styles.studentName}>{name(student)}</h2><p style={styles.username}>@{student.username}</p></div></div><div style={styles.stats}><span><strong>{points(student)}</strong> total points</span><span><strong>{quizzes(student)}</strong> quizzes taken</span></div><div style={styles.actions}><ActionButton onClick={() => navigate(`/student-profile/${student.id}`)} icon={<UserRound size={16} />}>View Profile</ActionButton><ActionButton onClick={() => navigate(`/messages/${student.id}`)} icon={<Mail size={16} />}>Message</ActionButton><ActionButton onClick={() => { setActionStudent(student); setActionType("password"); setNewPassword(""); setActionError(""); }} icon={<KeyRound size={16} />}>Reset Password</ActionButton><ActionButton onClick={() => navigate(`/student-certificates/${student.id}`)} icon={<Award size={16} />}>Certificates</ActionButton></div></article>) : <div style={styles.empty}>No students have joined your classroom yet.</div>}</div>}
      </>}

      {/* === REQUESTS: everything waiting on the teacher === */}
      {section === "requests" && <div style={styles.stack}>
        <div data-section="pending-students">
          <h2 style={styles.sectionTitle}><UserRound size={20} /> Students waiting to join your class{pending.length ? ` (${pending.length})` : ""}</h2>
          {(loading ? <p style={styles.muted}>Loading...</p> : <div style={styles.pendingList}>{pending.length ? pending.map((student) => <article key={student.id} style={styles.pendingCard} data-testid={`card-pending-student-${student.id}`}><div><h2 style={styles.studentName}>{name(student)}</h2><p style={styles.username}>@{student.username}</p></div><button onClick={() => void approve(student.id)} style={styles.approveButton} data-testid={`button-approve-student-${student.id}`}><Check size={18} /> Approve</button></article>) : <div style={styles.none}>No one is waiting to join your class.</div>}</div>)}
        </div>
        <div data-section="grade-changes">
          <h2 style={styles.sectionTitle}><GraduationCap size={20} /> Grade changes{gradeChangeRequests.length ? ` (${gradeChangeRequests.length})` : ""}</h2>
          {<div style={styles.pendingList}>{gradeChangeRequests.length ? gradeChangeRequests.map((req) => <div key={req.id} style={styles.pendingCard}><div><h2 style={styles.studentName}>{req.studentName}</h2><p style={styles.username}>Current: Grade {req.currentGrade} → Requested: Grade {req.requestedGrade}</p></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => void handleGradeChange(req.id, "approve")} style={styles.approveButton}><Check size={16} /> Approve</button><button onClick={() => void handleGradeChange(req.id, "deny")} style={styles.rejectBtn}><X size={16} /> Deny</button></div></div>) : <div style={styles.none}>No grade changes to answer.</div>}</div>}
        </div>
        <div data-section="book-requests">
      {(
        bookReqLoading ? <p style={styles.muted}>Loading book requests...</p> :
        <div>
          <h2 style={styles.sectionTitle}><BookOpen size={20} /> Book requests{bookRequests.length ? ` (${bookRequests.length})` : ""}</h2>
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
            <div style={styles.none}>No book requests from students yet.</div>
          )}
        </div>
      )}
        </div>
      </div>}

      {/* === FAMILIES === */}
      {section === "families" && <>
      {(
        <div>
          <div style={{ ...styles.proctorCard, marginBottom: 18 }}>
            <h2 style={styles.proctorTitle}><Users size={22} /> Parent Codes & Accounts</h2>
            <p style={styles.proctorDesc}>Give families their private code or signup link, print letters, and see which parent/guardian accounts are already connected to your students.</p>
            <button style={styles.primaryBtn} onClick={() => printLetters()}>Print parent letters for my students</button>
          </div>
          {parentConnectionsLoading ? <p style={styles.muted}>Loading parent connections...</p> : (
            <div style={styles.grid}>
              {parentConnections.length ? parentConnections.map((student) => (
                <article key={student.id} style={styles.card}>
                  <div style={styles.cardHead}>
                    <div><h2 style={styles.studentName}>{student.displayName}</h2><p style={styles.username}>@{student.username}</p></div>
                    <span style={{...styles.pendingBadge,background:student.parents.length?"hsl(145 70% 45% / .16)":"hsl(38 90% 50% / .16)",color:student.parents.length?"hsl(145 65% 62%)":"hsl(38 95% 68%)"}}>{student.parents.length ? student.parents.length + " LINKED" : "NOT LINKED"}</span>
                  </div>
                  <label style={styles.label}>Parent code</label>
                  <div style={styles.proctorDisplay}><code style={{...styles.proctorCode,fontSize:18}}>{student.code}</code><button onClick={() => void copyText(student.code, "Parent code")} style={styles.copyBtn}><Copy size={15}/> Copy</button></div>
                  <div style={{...styles.actions,marginTop:12}}>
                    <ActionButton onClick={() => printLetters(student.id)} icon={<BookOpen size={16}/>}>Print Letter</ActionButton>
                    <ActionButton onClick={() => void copyText(student.signupUrl, "Signup link")} icon={<Copy size={16}/>}>Copy Link</ActionButton>
                    <ActionButton onClick={() => window.open(student.signupUrl, "_blank", "noopener,noreferrer")} icon={<ExternalLink size={16}/>}>Open Signup</ActionButton>
                  </div>
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
      </>}

      {/* === QUIZZES === */}
      {section === "quizzes" && <div style={{ ...styles.stack, maxWidth: 900 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button onClick={() => navigate("/live-quiz")} style={{ ...styles.primaryBtn, marginTop: 0 }}>Host a live quiz</button>
          <button onClick={() => navigate("/study")} style={{ ...styles.copyBtn, display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 12, fontSize: 15 }}><GraduationCap size={18} /> Study Squad sets</button>
        </div>
        <div data-section="proctor">
          <div style={styles.proctorCard}><h2 style={styles.proctorTitle}><KeyRound size={22} /> Proctor Password</h2><p style={styles.proctorDesc}>Students use this password to enter proctor mode. Share it only when proctoring a quiz.</p><div style={styles.proctorDisplay}><code style={styles.proctorCode}>{proctorPassword || "Not set"}</code><button onClick={() => { if (proctorPassword) navigator.clipboard?.writeText(proctorPassword).catch(() => {}); }} style={styles.copyBtn}>Copy</button></div></div>
        </div>
        <div data-section="camera-quizzes"><NoProctorReview title="Camera quizzes from your students" /></div>
        <div data-section="growth-check">
          <h2 style={styles.sectionTitle}><Brain size={20} /> Growth Check results</h2>
                <div style={styles.pendingList}>{growthCheckData.length ? growthCheckData.map((attempt: any) => <div key={attempt.id} style={styles.pendingCard}><div><h2 style={styles.studentName}>{attempt.studentName || "Student"}</h2><p style={styles.username}>Score: {attempt.score}/{attempt.totalQuestions} | WCPM: {attempt.wcpm || "N/A"}</p></div></div>) : <div style={styles.none}>No Growth Check results yet.</div>}</div>
        </div>
      </div>}

      {/* === GAMES === */}
      {section === "games" && <>
        <div style={{ marginBottom: 18 }}><PlayTimeManager /></div>
        <div data-section="club-controls">
      {(
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
                return <button type="button" key={day} onClick={()=>setClubClosing(v=>({...v,days:active?v.days.filter(d=>d!==index):[...v.days,index].sort((a,b)=>a-b)}))} style={{...styles.copyBtn,background:active?"#7c3aed":"#171326",color:"#fff"}}>{day}</button>;
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
                    <span style={{...styles.pendingBadge,background:control.locked?"hsl(0 75% 50% / .18)":"hsl(145 70% 45% / .16)",color:control.locked?"hsl(0 85% 68%)":"hsl(145 65% 62%)"}}>
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
        </div>
      </>}

      {/* === PRIZES: what the teacher puts up for their class or school, and hands out themself === */}
      {section === "prizes" && <div style={{ maxWidth: 900 }}><PrizeManager token={getTokenFromCookie()} role="teacher" /></div>}

      {/* === ALL STUDENTS === */}
      {section === "all" && <>
      {(
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
      </>}

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
    </section>}
  </main>;
}

function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button onClick={onClick} style={styles.actionButton}>{icon}{children}</button>; }

const styles: Record<string, React.CSSProperties> = {
  arise2Banner: { display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "linear-gradient(110deg, rgba(124,58,237,.30), rgba(192,38,211,.18) 55%, rgba(6,182,212,.20))", border: "1px solid rgba(196,181,253,.30)", borderRadius: 18, color: "#fff", cursor: "pointer", padding: "16px 18px", marginBottom: 14, boxShadow: "0 16px 40px rgba(124,58,237,.18)" },
  arise2Icon: { display: "grid", placeItems: "center", width: 44, height: 44, flexShrink: 0, borderRadius: 14, background: "linear-gradient(135deg,#8b5cf6,#d946ef,#22d3ee)" },
  arise2Eyebrow: { display: "block", fontSize: 11, fontWeight: 900, letterSpacing: ".2em", textTransform: "uppercase", color: "#a5f3fc" },
  arise2Title: { display: "block", fontSize: 18, fontWeight: 900, marginTop: 2 },
  arise2Sub: { display: "block", fontSize: 14, color: "hsl(0 0% 78%)", marginTop: 2 },
  bannerCard: { padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 15, fontWeight: 600 },
  page: { minHeight: "100vh", background: "radial-gradient(circle at 10% 0%, rgba(124,58,237,.24), transparent 28%), radial-gradient(circle at 90% 8%, rgba(6,182,212,.16), transparent 26%), radial-gradient(circle at 52% 45%, rgba(217,70,239,.08), transparent 35%), #0b0a16", color: "#f8fafc", fontFamily: "'Barlow', system-ui, sans-serif", padding: "20px clamp(16px, 4vw, 56px) 48px" },
  title: { background: "linear-gradient(90deg,#8b5cf6,#d946ef,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, letterSpacing: "-0.035em", margin: 0, textAlign: "center", whiteSpace: "nowrap" },
  subtleButton: { display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content", color: "hsl(0 0% 85%)", background: "transparent", border: 0, cursor: "pointer", fontSize: 16, fontWeight: 700, padding: 8 },
  content: { maxWidth: 1200, margin: "30px auto 0" },
  stack: { display: "grid", gap: 32 },
  none: { color: "hsl(0 0% 62%)", fontSize: 15, padding: "14px 16px", border: "1px dashed rgba(255,255,255,.16)", borderRadius: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 },
  card: { display: "grid", gap: 18, background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 20 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
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
  pendingCard: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 10, padding: 16 },
  approveButton: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(142 100% 40%)", border: 0, borderRadius: 8, color: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: "10px 18px" },
  rejectBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(0 100% 50% / 0.2)", border: "1px solid hsl(0 100% 50% / 0.4)", borderRadius: 8, color: "hsl(0 100% 70%)", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "10px 16px" },
  approveBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(142 100% 40%)", border: 0, borderRadius: 8, color: "white", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "8px 14px" },
  proctorCard: { background: "linear-gradient(145deg,rgba(24,19,43,.96),rgba(15,18,35,.96))", border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 24 },
  proctorTitle: { display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px", fontSize: 22, color: "hsl(0 0% 95%)" },
  proctorDesc: { color: "hsl(0 0% 62%)", fontSize: 15, margin: "0 0 16px" },
  proctorDisplay: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 },
  proctorCode: { fontSize: 28, fontWeight: 900, letterSpacing: 2, maxWidth: "100%", overflowWrap: "anywhere", background: "#0f0d1d", padding: "12px 20px", borderRadius: 12, color: "#a5f3fc", border: "1px solid rgba(34,211,238,.18)" },
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
