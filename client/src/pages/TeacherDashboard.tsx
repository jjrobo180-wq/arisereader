import { useEffect, useState } from "react";
import { ArrowLeft, Award, Check, GraduationCap, KeyRound, LogOut, Mail, UserRound, Users, Brain, Gift, Search, X, CheckCircle2, FileQuestion, Bell, BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { NotificationBell } from "@/components/NotificationBell";

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

type Tab = "students" | "all-students" | "pending" | "book-requests" | "proctor" | "grade-changes" | "growth-check";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("students");
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
      void loadAllStudentsData();
      void loadBookRequests();
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
        fetch(`${API_BASE}/api/teacher/growth-check/overview`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.attempts) setGrowthCheckData(data.attempts); })
          .catch(() => {});
      }
    } else { setLoading(false); }
  }, [user, authorized, accountApproved]);

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
  return <main style={styles.page}>
    <header style={styles.header}><button onClick={() => navigate("/library")} style={styles.subtleButton} data-testid="button-back-library"><ArrowLeft size={19} /> Library</button><h1 style={styles.title}>Teacher Dashboard</h1><div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}><NotificationBell refreshKey={bellRefreshKey} onNavigate={(type, id) => { if (type === "request") setTab("book-requests"); else if (type === "user") setTab("pending"); else if (type === "ai_quiz") setTab("all-students"); }} /><button onClick={() => { if (window.confirm("Are you sure you want to log out?")) { logout(); navigate("/"); } }} style={styles.subtleButton} data-testid="button-teacher-logout">Logout <LogOut size={19} /></button></div></header>
    {!accountApproved ? <section style={styles.notice} role="status" data-testid="status-teacher-pending">Your account is pending approval by the administrator.</section> : <section style={styles.content}>
      <div style={styles.tabs} role="tablist" aria-label="Teacher dashboard sections">
        <TabButton active={tab === "students"} onClick={() => setTab("students")} icon={<Users size={19} />}>My Students</TabButton>
        <TabButton active={tab === "all-students"} onClick={() => setTab("all-students")} icon={<Users size={19} />}>All Students</TabButton>
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")} icon={<UserRound size={19} />}>Pending Approvals{pending.length ? ` (${pending.length})` : ""}</TabButton>
        <TabButton active={tab === "book-requests"} onClick={() => setTab("book-requests")} icon={<BookOpen size={19} />}>Book Requests{bookRequests.length ? ` (${bookRequests.length})` : ""}</TabButton>
        <TabButton active={tab === "proctor"} onClick={() => setTab("proctor")} icon={<KeyRound size={19} />}>Proctor</TabButton>
        <TabButton active={tab === "grade-changes"} onClick={() => setTab("grade-changes")} icon={<GraduationCap size={19} />}>Grade Changes{gradeChangeRequests.length ? ` (${gradeChangeRequests.length})` : ""}</TabButton>
        <TabButton active={tab === "growth-check"} onClick={() => setTab("growth-check")} icon={<Brain size={19} />}>Growth Check</TabButton>
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

      {/* === MY STUDENTS TAB (original) === */}
      {loading ? <p style={styles.muted}>Loading students...</p> : error ? <div style={styles.error} role="alert">{error}</div> : tab === "students" ? <div style={styles.grid}>{students.length ? students.map((student) => <article key={student.id} style={styles.card} data-testid={`card-student-${student.id}`}><div style={styles.cardHead}><div><h2 style={styles.studentName}>{name(student)}</h2><p style={styles.username}>@{student.username}</p></div></div><div style={styles.stats}><span><strong>{points(student)}</strong> total points</span><span><strong>{quizzes(student)}</strong> quizzes taken</span></div><div style={styles.actions}><ActionButton onClick={() => navigate(`/student-profile/${student.id}`)} icon={<UserRound size={16} />}>View Profile</ActionButton><ActionButton onClick={() => navigate(`/messages/${student.id}`)} icon={<Mail size={16} />}>Message</ActionButton><ActionButton onClick={() => void resetPassword(student.id)} icon={<KeyRound size={16} />}>Reset Password</ActionButton><ActionButton onClick={() => navigate(`/student-certificates/${student.id}`)} icon={<Award size={16} />}>Certificates</ActionButton></div></article>) : <div style={styles.empty}>No students have joined your classroom yet.</div>}</div> : null}

      {/* === PENDING TAB (original - my own pending) === */}
      {tab === "pending" && (loading ? <p style={styles.muted}>Loading...</p> : <div style={styles.pendingList}>{pending.length ? pending.map((student) => <article key={student.id} style={styles.pendingCard} data-testid={`card-pending-student-${student.id}`}><div><h2 style={styles.studentName}>{name(student)}</h2><p style={styles.username}>@{student.username}</p></div><button onClick={() => void approve(student.id)} style={styles.approveButton} data-testid={`button-approve-student-${student.id}`}><Check size={18} /> Approve</button></article>) : <div style={styles.empty}>No pending students</div>}</div>)}

      {/* === PROCTOR TAB === */}
      {tab === "proctor" && <div style={{ maxWidth: 600, margin: "0 auto" }}>{teacherBanner && teacherBanner.active && teacherBanner.text ? <div style={{ ...styles.bannerCard, background: teacherBanner.bgColor, color: teacherBanner.textColor }}>{teacherBanner.text}</div> : null}<div style={styles.proctorCard}><h2 style={styles.proctorTitle}><KeyRound size={22} /> Proctor Password</h2><p style={styles.proctorDesc}>Students use this password to enter proctor mode. Share it only when proctoring a quiz.</p><div style={styles.proctorDisplay}><code style={styles.proctorCode}>{proctorPassword || "Not set"}</code><button onClick={() => { if (proctorPassword) navigator.clipboard?.writeText(proctorPassword).catch(() => {}); }} style={styles.copyBtn}>Copy</button></div></div></div>}

      {/* === GRADE CHANGES TAB === */}
      {tab === "grade-changes" && <div style={styles.pendingList}>{gradeChangeRequests.length ? gradeChangeRequests.map((req) => <div key={req.id} style={styles.pendingCard}><div><h2 style={styles.studentName}>{req.studentName}</h2><p style={styles.username}>Current: Grade {req.currentGrade} → Requested: Grade {req.requestedGrade}</p></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => void handleGradeChange(req.id, "approve")} style={styles.approveButton}><Check size={16} /> Approve</button><button onClick={() => void handleGradeChange(req.id, "deny")} style={styles.rejectBtn}><X size={16} /> Deny</button></div></div>) : <div style={styles.empty}>No grade change requests</div>}</div>}

      {/* === GROWTH CHECK TAB === */}
      {tab === "growth-check" && <div style={{ maxWidth: 900, margin: "0 auto" }}>{growthCheckData.length ? growthCheckData.map((attempt: any) => <div key={attempt.id} style={styles.pendingCard}><div><h2 style={styles.studentName}>{attempt.studentName || "Student"}</h2><p style={styles.username}>Score: {attempt.score}/{attempt.totalQuestions} | WCPM: {attempt.wcpm || "N/A"}</p></div></div>) : <div style={styles.empty}>No growth check data yet.</div>}</div>}
    </section>}
  </main>;
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button role="tab" aria-selected={active} onClick={onClick} style={{ ...styles.tab, ...(active ? styles.activeTab : {}) }} data-testid={`tab-${active ? "active" : "inactive"}`}>{icon}{children}</button>; }
function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button onClick={onClick} style={styles.actionButton}>{icon}{children}</button>; }

const styles: Record<string, React.CSSProperties> = {
  bannerCard: { padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 15, fontWeight: 600 },
  page: { minHeight: "100vh", background: "hsl(0 0% 10%)", color: "hsl(0 0% 96%)", fontFamily: "system-ui, sans-serif", padding: "20px clamp(16px, 4vw, 56px) 48px" },
  header: { maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", borderBottom: "1px solid hsl(0 0% 20%)", paddingBottom: 20, gap: 12 },
  title: { color: "hsl(21 100% 50%)", fontSize: "clamp(26px, 4vw, 36px)", margin: 0, textAlign: "center", whiteSpace: "nowrap" },
  subtleButton: { display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content", color: "hsl(0 0% 85%)", background: "transparent", border: 0, cursor: "pointer", fontSize: 16, fontWeight: 700, padding: 8 },
  content: { maxWidth: 1200, margin: "30px auto 0" },
  tabs: { display: "flex", flexWrap: "wrap", gap: 8, borderBottom: "1px solid hsl(0 0% 20%)", marginBottom: 24 },
  tab: { display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", color: "hsl(0 0% 65%)", border: 0, borderBottom: "3px solid transparent", cursor: "pointer", fontSize: 17, fontWeight: 750, padding: "12px 16px" },
  activeTab: { color: "hsl(21 100% 50%)", borderBottomColor: "hsl(21 100% 50%)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 },
  card: { display: "grid", gap: 18, background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 12, padding: 20 },
  cardHead: { display: "flex", justifyContent: "space-between" },
  studentName: { fontSize: 20, margin: 0, color: "hsl(0 0% 98%)" },
  username: { margin: "4px 0 0", color: "hsl(0 0% 62%)", fontSize: 15 },
  teacherLabel: { margin: "4px 0 0", color: "hsl(21 100% 60%)", fontSize: 13, fontWeight: 600 },
  pendingBadge: { display: "inline-block", marginTop: 6, padding: "2px 8px", borderRadius: 4, background: "hsl(45 100% 50% / 0.15)", color: "hsl(45 100% 60%)", fontSize: 12, fontWeight: 700 },
  stats: { display: "flex", justifyContent: "space-between", gap: 12, color: "hsl(0 0% 70%)", fontSize: 14 },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 },
  actionButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 38, background: "hsl(0 0% 18%)", border: "1px solid hsl(0 0% 28%)", borderRadius: 7, color: "hsl(0 0% 90%)", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "8px 4px" },
  empty: { gridColumn: "1 / -1", textAlign: "center", color: "hsl(0 0% 55%)", padding: 40, fontSize: 16 },
  muted: { color: "hsl(0 0% 55%)", textAlign: "center", padding: 40 },
  error: { background: "hsl(0 100% 50% / 0.1)", border: "1px solid hsl(0 100% 50% / 0.3)", borderRadius: 8, padding: 16, color: "hsl(0 100% 70%)", textAlign: "center" },
  notice: { maxWidth: 600, margin: "30px auto", background: "hsl(45 100% 50% / 0.1)", border: "1px solid hsl(45 100% 50% / 0.3)", borderRadius: 8, padding: 20, textAlign: "center", color: "hsl(45 100% 70%)" },
  pendingList: { display: "grid", gap: 12 },
  pendingCard: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 10, padding: 16 },
  approveButton: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(142 100% 40%)", border: 0, borderRadius: 8, color: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: "10px 18px" },
  rejectBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(0 100% 50% / 0.2)", border: "1px solid hsl(0 100% 50% / 0.4)", borderRadius: 8, color: "hsl(0 100% 70%)", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "10px 16px" },
  approveBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(142 100% 40%)", border: 0, borderRadius: 8, color: "white", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "8px 14px" },
  proctorCard: { background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 12, padding: 24 },
  proctorTitle: { display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px", fontSize: 22, color: "hsl(0 0% 95%)" },
  proctorDesc: { color: "hsl(0 0% 62%)", fontSize: 15, margin: "0 0 16px" },
  proctorDisplay: { display: "flex", alignItems: "center", gap: 12 },
  proctorCode: { fontSize: 28, fontWeight: 800, letterSpacing: 2, background: "hsl(0 0% 10%)", padding: "12px 20px", borderRadius: 8, color: "hsl(21 100% 55%)" },
  copyBtn: { background: "hsl(0 0% 18%)", border: "1px solid hsl(0 0% 28%)", borderRadius: 6, color: "hsl(0 0% 85%)", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "10px 16px" },
  sectionTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 20, color: "hsl(0 0% 90%)", margin: "0 0 16px" },
  quizGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  quizCard: { background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 10, padding: 16 },
  quizCardHead: { display: "flex", justifyContent: "space-between", marginBottom: 12 },
  quizTitle: { fontSize: 17, margin: 0, color: "hsl(0 0% 95%)" },
  quizMeta: { fontSize: 13, color: "hsl(0 0% 60%)", margin: "2px 0" },
  quizActions: { display: "flex", gap: 8 },
  searchRow: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  searchBox: { flex: 1, minWidth: 200, display: "flex", alignItems: "center", background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, padding: "0 12px" },
  searchIcon: { color: "hsl(0 0% 50%)", flexShrink: 0 },
  searchInput: { flex: 1, background: "transparent", border: 0, color: "hsl(0 0% 90%)", fontSize: 16, padding: "10px 8px", outline: "none" },
  filterSelect: { background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, color: "hsl(0 0% 90%)", fontSize: 15, padding: "10px 12px", cursor: "pointer", minWidth: 150 },
  successBanner: { display: "flex", alignItems: "center", gap: 8, background: "hsl(142 100% 40% / 0.1)", border: "1px solid hsl(142 100% 40% / 0.3)", borderRadius: 8, padding: 12, marginBottom: 16, color: "hsl(142 100% 60%)", fontWeight: 600 },
  errorBanner: { display: "flex", alignItems: "center", gap: 8, background: "hsl(0 100% 50% / 0.1)", border: "1px solid hsl(0 100% 50% / 0.3)", borderRadius: 8, padding: 12, marginBottom: 16, color: "hsl(0 100% 70%)", fontWeight: 600 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 25%)", borderRadius: 12, padding: 24, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, margin: 0, color: "hsl(21 100% 55%)" },
  closeBtn: { background: "transparent", border: 0, color: "hsl(0 0% 60%)", cursor: "pointer", padding: 4 },
  modalBody: { display: "grid", gap: 12 },
  modalStudent: { fontSize: 15, color: "hsl(0 0% 70%)", marginBottom: 8 },
  label: { fontSize: 14, fontWeight: 700, color: "hsl(0 0% 75%)", marginBottom: 4 },
  input: { width: "100%", background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 25%)", borderRadius: 6, color: "hsl(0 0% 90%)", fontSize: 15, padding: "10px 12px", outline: "none", boxSizing: "border-box" as const },
  textarea: { width: "100%", background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 25%)", borderRadius: 6, color: "hsl(0 0% 90%)", fontSize: 15, padding: "10px 12px", outline: "none", minHeight: 60, resize: "vertical", boxSizing: "border-box" as const },
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "hsl(21 100% 50%)", border: 0, borderRadius: 8, color: "white", cursor: "pointer", fontSize: 15, fontWeight: 700, padding: "10px 16px", marginTop: 8 },
  subSectionTitle: { fontSize: 15, color: "hsl(0 0% 80%)", margin: "16px 0 8px" },
  rewardItem: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, padding: 12, marginBottom: 8 },
  deleteBtn: { background: "hsl(0 100% 50% / 0.15)", border: "1px solid hsl(0 100% 50% / 0.3)", borderRadius: 6, color: "hsl(0 100% 65%)", cursor: "pointer", padding: "6px 8px", flexShrink: 0 },
  activeBadge: { display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 4, background: "hsl(142 100% 40% / 0.15)", color: "hsl(142 100% 60%)", fontSize: 11, fontWeight: 700 },
  inactiveBadge: { display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 4, background: "hsl(0 0% 50% / 0.15)", color: "hsl(0 0% 60%)", fontSize: 11, fontWeight: 700 },
};
