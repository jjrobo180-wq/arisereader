import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NotificationBell } from "@/components/NotificationBell";
import { ReportProblemButton } from "@/components/ReportProblemButton";
import {
  ArrowLeft, Users, KeyRound, Send, Trophy, BookOpen,
  Eye, PlusCircle, ImagePlus, Mail, Inbox, X, ClipboardPaste, Copy, LogOut,
  MessageSquarePlus, CheckCircle2, Search, ChevronDown, ChevronLeft, Building, FileQuestion, FileSearch, RotateCcw, Brain, Trash2, BarChart3
} from "lucide-react";

// Read token from cookie as fallback when context token is null
const SESSION_COOKIE = "arise_session";
function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith(SESSION_COOKIE + "=")) {
        const raw = c.substring(SESSION_COOKIE.length + 1);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}

interface Student {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
  quizzesTaken: number;
  totalPoints: number;
  approvedByTeacher?: boolean;
  teacherId?: number;
  teacherName?: string | null;
}

interface StudentDetail {
  user: { id: number; username: string; displayName: string; createdAt: string; schoolId?: number };
  totalPoints: number;
  quizzesTaken: number;
  totalBooks: number;
  schoolId?: number;
  quizHistory: {
    bookId: number;
    title: string;
    author: string;
    coverUrl: string | null;
    ageGroup: string;
    pointsValue?: number;
    pointsEarned?: number;
    score: number;
    total: number;
    completedAt: string;
  }[];
  messages: any[];
}

interface BookItem {
  id: number;
  title: string;
  author: string;
  ageGroup: string;
  coverUrl: string | null;
  pointsValue?: number;
  readUrl?: string | null;
}

interface StudentMsg {
  id: number;
  userId: number;
  studentName: string;
  studentUsername: string;
  messageText: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface QuizRequestItem {
  id: number;
  bookTitle: string;
  author: string | null;
  status: string;
  createdAt: string;
  student?: { displayName?: string; username?: string } | null;
  studentName?: string;
}

interface QuestionForm {
  question: string;
  options: string[];
  correct: string;
}

// Module-level cache — survives component unmount/remount during navigation
let adminCache: { students: Student[]; books: BookItem[] } = {
  students: [],
  books: [],
};

export default function Admin() {
  const { user, token, logout } = useAuth();
  const [, navigate] = useLocation();
  const [students, setStudents] = useState<Student[]>(adminCache.students);
  const [loading, setLoading] = useState(adminCache.students.length === 0);
  const [studentSearch, setStudentSearch] = useState("");
  const [filterBand, setFilterBand] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [userGradesMap, setUserGradesMap] = useState<Record<string, string>>({});
  const [resetStudent, setResetStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [messageStudent, setMessageStudent] = useState<Student | null>(null);
  const [messageText, setMessageText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [books, setBooks] = useState<BookItem[]>(adminCache.books);
  const [quizCount, setQuizCount] = useState(0);
  const [coverBook, setCoverBook] = useState<BookItem | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverSuccess, setCoverSuccess] = useState("");
  const [studentMsgs, setStudentMsgs] = useState<StudentMsg[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [inboxTab, setInboxTab] = useState<"inbox" | "sent">("inbox");
  const [sentMsgs, setSentMsgs] = useState<any[]>([]);
  const [replyMsgId, setReplyMsgId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLink, setReplyLink] = useState("");
  const [replySuccess, setReplySuccess] = useState("");
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  // DM-style conversation state
  const [activeConversationUserId, setActiveConversationUserId] = useState<number | null>(null);
  const studentsRef = useRef<HTMLDivElement>(null);
  const quizRequestsRef = useRef<HTMLDivElement>(null);
  const teachersRef = useRef<HTMLDivElement>(null);
  const [showAddQuiz, setShowAddQuiz] = useState(false);
  const [adminSortBy, setAdminSortBy] = useState<"points" | "popular" | "recent" | "classics" | "new">("points");
  const [showAdminSortMenu, setShowAdminSortMenu] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [studentBanner, setStudentBanner] = useState({ text: "", bgColor: "#f59e0b", textColor: "#1a1a1a", active: true });
  const [teacherBanner, setTeacherBanner] = useState({ text: "", bgColor: "#3b82f6", textColor: "#ffffff", active: true });
  const [loginBanner, setLoginBanner] = useState({ text: "", bgColor: "#f59e0b", textColor: "#1a1a1a", active: true });
  const [bannerMsg, setBannerMsg] = useState("");
  const [donationSettings, setDonationSettings] = useState({ goalAmount: 1000, currentAmount: 0, title: "Support Our Readers", description: "Help us keep A.R.I.S.E Reader free for students", donateUrl: "", milestonesText: "", active: false });
  const [donationMsg, setDonationMsg] = useState("");
  const [proctorPassword, setProctorPassword] = useState("");
  const [newProctorPassword, setNewProctorPassword] = useState("");
  const [proctorMsg, setProctorMsg] = useState("");
  const [easterEggs, setEasterEggs] = useState({ active: false, totalEggs: 0, remainingEggs: 0, pointsPerEgg: 2, claims: [] as any[] });
  const [eggCount, setEggCount] = useState(0);
  const [eggMsg, setEggMsg] = useState("");
  const [pendingParents, setPendingParents] = useState<any[]>([]);
  const [allParents, setAllParents] = useState<any[]>([]);
  const [gradeChangeRequests, setGradeChangeRequests] = useState<any[]>([]);
  const [quizForm, setQuizForm] = useState({
    title: "",
    author: "",
    coverUrl: "",
    description: "",
    pointsValue: 20,
    readUrl: "",
  });
  const [quizGradeBand, setQuizGradeBand] = useState("");
  const [bandSuggestion, setBandSuggestion] = useState("");
  const [bandSuggesting, setBandSuggesting] = useState(false);
  const [questions, setQuestions] = useState<QuestionForm[]>(
    Array.from({ length: 10 }, () => ({ question: "", options: ["", "", "", ""], correct: "A" }))
  );
  const [quizSuccess, setQuizSuccess] = useState("");
  // Schools & Classes state
  const [schools, setSchools] = useState<any[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<Record<number, any[]>>({});
  const [classStats, setClassStats] = useState<Record<number, any>>({});
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newClassName, setNewClassName] = useState<Record<number, string>>({});
  const [quizError, setQuizError] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");
  const [quizRequests, setQuizRequests] = useState<QuizRequestItem[]>([]);
  const [quizRequestsLoading, setQuizRequestsLoading] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [bookSearch, setBookSearch] = useState("");
  // Quiz review requests state
  const [reviewRequests, setReviewRequests] = useState<any[]>([]);
  const [reviewRequestsLoading, setReviewRequestsLoading] = useState(false);
  // Eye gaze requests state
  const [eyeGazeRequests, setEyeGazeRequests] = useState<any[]>([]);
  // Admin leaderboard state
  const [adminLeaderboard, setAdminLeaderboard] = useState<any[]>([]);
  const [adminLbLoading, setAdminLbLoading] = useState(false);
  const [adminLbBand, setAdminLbBand] = useState("");
  const [activeReview, setActiveReview] = useState<any>(null);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [reviewDetailLoading, setReviewDetailLoading] = useState(false);
  const [correctedAnswers, setCorrectedAnswers] = useState<Record<string, string>>({});
  const [updateAnswerKey, setUpdateAnswerKey] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [regradeMsg, setRegradeMsg] = useState("");
  const reviewRef = useRef<HTMLDivElement>(null);
  // i-Ready score state
  const [ireadyGrade, setIreadyGrade] = useState("");
  const [ireadyScore, setIreadyScore] = useState("");
  const [ireadyComp, setIreadyComp] = useState("");
  const [ireadyVocab, setIreadyVocab] = useState("");
  const [ireadyMsg, setIreadyMsg] = useState("");
  const [readingProgress, setReadingProgress] = useState<any>(null);

  // Schools & Classes handlers
  const fetchSchools = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/schools`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSchools(data);
        // Fetch classes for each school
        for (const school of data) {
          const clsRes = await fetch(`${API_BASE}/api/admin/schools/${school.id}/classes`, {
            headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
          });
          const clsData = await clsRes.json();
          setSchoolClasses(prev => ({ ...prev, [school.id]: Array.isArray(clsData) ? clsData : [] }));
        }
        // Fetch class stats
        const statsRes = await fetch(`${API_BASE}/api/admin/school-stats`, {
          headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
        });
        const statsData = await statsRes.json();
        if (Array.isArray(statsData)) {
          const statsMap: Record<number, any> = {};
          for (const school of statsData) {
            for (const cls of (school.classes || [])) {
              // Fetch class-specific stats
              const cRes = await fetch(`${API_BASE}/api/admin/schools/${school.id}/class-stats`, {
                headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
              });
              const cData = await cRes.json();
              if (Array.isArray(cData)) {
                for (const c of cData) {
                  statsMap[c.id] = c;
                }
              }
            }
          }
          setClassStats(statsMap);
        }
      }
    } catch (err) {
      console.error("Failed to fetch schools:", err);
    }
  };

  const handleCreateSchool = async () => {
    if (!token || !newSchoolName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/schools`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSchoolName.trim() }),
      });
      if (res.ok) {
        setNewSchoolName("");
        fetchSchools();
      }
    } catch (err) {
      console.error("Failed to create school:", err);
    }
  };

  const handleCreateClass = async (schoolId: number) => {
    if (!token || !(newClassName[schoolId] || "").trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/schools/${schoolId}/classes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: (newClassName[schoolId] || "").trim() }),
      });
      if (res.ok) {
        setNewClassName(prev => ({ ...prev, [schoolId]: "" }));
        fetchSchools();
      }
    } catch (err) {
      console.error("Failed to create class:", err);
    }
  };

  const handleDeleteSchool = async (schoolId: number, schoolName: string) => {
    if (!window.confirm(`Delete school "${schoolName}"? This will also delete all classes in it and unassign students.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/schools/${schoolId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || "Failed to delete school");
        return;
      }
      setSchools(prev => prev.filter(s => s.id !== schoolId));
      setSchoolClasses(prev => { const n = { ...prev }; delete n[schoolId]; return n; });
    } catch (err) {
      alert("Failed to delete school");
    }
  };

  const handleDeleteClass = async (classId: number, className: string) => {
    if (!window.confirm(`Delete class "${className}"? Students in it will be unassigned.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/classes/${classId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || "Failed to delete class");
        return;
      }
      fetchSchools();
    } catch (err) {
      alert("Failed to delete class");
    }
  };

  const fetchStudents = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) { console.error("Students fetch failed:", res.status); return; }
      const data = await res.json();
      const studentsArr = (Array.isArray(data) ? data : []).filter((s: any) => s.role === 'student' || (!s.role && !s.isAdmin));
      setStudents(studentsArr);
      adminCache.students = studentsArr;
      // Fetch user grades for band filtering
      try {
        const grRes = await fetch(`${API_BASE}/api/admin/user-grades`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
        if (grRes.ok) {
          const grades = await grRes.json();
          setUserGradesMap(grades);
        }
      } catch {}
    } catch (err) {
      console.error("Failed to fetch students:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/books`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) { console.error("Books fetch failed:", res.status); return; }
      const data = await res.json();
      const booksArr = Array.isArray(data) ? data : [];
      setBooks(booksArr);
      adminCache.books = booksArr;
    } catch (err) {
      console.error("Failed to fetch books:", err);
    }
  };

  const fetchStudentMsgs = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/messages`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setStudentMsgs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  const fetchSentMsgs = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/messages/sent`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSentMsgs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch sent messages:", err);
    }
  };

  const handleReply = async (msgId: number) => {
    if (!token || !replyText.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/messages/${msgId}/reply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messageText: replyText, linkUrl: replyLink || undefined }),
      });
      if (res.ok) {
        setReplySuccess("Reply sent!");
        setReplyText("");
        setReplyLink("");
        setReplyMsgId(null);
        setNotifRefreshKey(k => k + 1);
        fetchUnreadMsgCount();
        fetchStudentMsgs();
        fetchSentMsgs();
        setTimeout(() => setReplySuccess(""), 2000);
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
    }
  };

  // Send a message directly to a student from the DM conversation view
  const handleConversationSend = async () => {
    if (!token || !activeConversationUserId || !replyText.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${activeConversationUserId}/message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messageText: replyText, linkUrl: replyLink || undefined }),
      });
      if (res.ok) {
        setReplySuccess("Message sent!");
        setReplyText("");
        setReplyLink("");
        setNotifRefreshKey(k => k + 1);
        fetchStudentMsgs();
        fetchSentMsgs();
        fetchUnreadMsgCount();
        setTimeout(() => setReplySuccess(""), 2000);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const [showCompose, setShowCompose] = useState(false);
  const [composeStudent, setComposeStudent] = useState<Student | null>(null);
  const [composeText, setComposeText] = useState("");
  const [composeLink, setComposeLink] = useState("");
  const [composeSuccess, setComposeSuccess] = useState("");

  const handleComposeSend = async () => {
    if (!token || !composeStudent || !composeText.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${composeStudent.id}/message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messageText: composeText, linkUrl: composeLink || undefined }),
      });
      if (res.ok) {
        setComposeSuccess(`Message sent to ${composeStudent.displayName}!`);
        setComposeText("");
        setComposeLink("");
        setTimeout(() => { setShowCompose(false); setComposeStudent(null); setComposeSuccess(""); }, 2000);
        fetchStudentMsgs();
        fetchSentMsgs();
        fetchUnreadMsgCount();
        setNotifRefreshKey(k => k + 1);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const fetchUnreadMsgCount = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/messages/unread-count`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadMsgCount(data.count || 0);
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  };

  const handleNotifNavigate = (type: "request" | "user" | "teacher" | "message", id: number) => {
    if (type === "request") {
      // Scroll to quiz requests and open create dialog for this request
      quizRequestsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const req = quizRequests.find(r => r.id === id);
      if (req) {
        setActiveRequestId(req.id);
        setQuizForm({
          title: req.bookTitle,
          author: req.author || "",
          coverUrl: "",
          description: "",
          pointsValue: 20,
          readUrl: "",
        });
        setShowAddQuiz(true);
      }
    } else if (type === "teacher") {
      // Scroll to teachers section
      teachersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Scroll to students table
      studentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Refresh notifications (NotificationBell will auto-mark-read on open, but this ensures the badge clears)
    setNotifRefreshKey(k => k + 1);
  };

  const fetchQuizRequests = async () => {
    if (!token) return;
    setQuizRequestsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/quiz-requests`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setQuizRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch quiz requests:", err);
    } finally {
      setQuizRequestsLoading(false);
    }
  };

  const handleMarkRequestComplete = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/quiz-requests/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        fetchQuizRequests();
        setNotifRefreshKey(k => k + 1);
      }
    } catch (err) {
      console.error("Failed to mark request complete:", err);
    }
  };

  const handleCreateQuizFromRequest = (req: QuizRequestItem) => {
    setActiveRequestId(req.id);
    setQuizForm({
      title: req.bookTitle || "",
      author: req.author || "",
      coverUrl: "",
      description: "",
      pointsValue: 20,
      readUrl: "",
    });
    setQuestions(Array.from({ length: 10 }, () => ({ question: "", options: ["", "", "", ""], correct: "A" })));
    setQuizError("");
    setQuizSuccess("");
    setShowAddQuiz(true);
  };

  const fetchQuizCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/stats`);
      if (res.ok) {
        const data = await res.json();
        setQuizCount(data.quizzesAvailable || 0);
      }
    } catch {
      // ignore — keep 0 as fallback
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchBooks();
    fetchQuizCount();
    fetchStudentMsgs();
    fetchUnreadMsgCount();
    fetchQuizRequests();
    fetchReviewRequests();
    fetchAnnouncement();
    fetchBanners();
    fetchDonationSettings();
    fetchProctorPassword();
    fetchEasterEggs();
    fetchPendingParents();
    fetchAllParents();
    fetchGradeChangeRequests();
    fetchEyeGazeRequests();
    fetchAdminLeaderboard();
    fetchSchools();
    fetchTeachers();
  }, [token, user]);

  // Handle notification navigation from Library page
  useEffect(() => {
    const stored = sessionStorage.getItem('admin_notif');
    if (stored) {
      sessionStorage.removeItem('admin_notif');
      try {
        const { type, id } = JSON.parse(stored);
        setTimeout(() => {
          handleNotifNavigate(type, parseInt(id));
        }, 500);
      } catch {}
    }
  }, []);

  // Clear caches on global logout event
  useEffect(() => {
    const clearCaches = () => {
      adminCache.students = [];
      adminCache.books = [];
      setStudents([]);
      setBooks([]);
      setStudentMsgs([]);
      setUnreadMsgCount(0);
      setQuizRequests([]);
      setReviewRequests([]);
    };
    window.addEventListener("arise-logout", clearCaches);
    return () => window.removeEventListener("arise-logout", clearCaches);
  }, []);

  const fetchAnnouncement = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/announcement`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      if (res.ok) {
        const data = await res.json();
        setAnnouncementText(data.text || "");
      }
    } catch {}
  };

  const handleUpdateAnnouncement = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/announcement`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: announcementText }),
      });
      if (res.ok) {
        setAnnouncementMsg("Announcement updated!");
        setTimeout(() => setAnnouncementMsg(""), 3000);
      }
    } catch {}
  };

  const fetchBanners = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/banners`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.studentBanner) setStudentBanner(data.studentBanner);
        if (data.teacherBanner) setTeacherBanner(data.teacherBanner);
        if (data.loginBanner) setLoginBanner(data.loginBanner);
      }
    } catch {}
  };

  const fetchDonationSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/donation-settings`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const milestonesText = (data.milestones || []).map((m: any) => `${m.amount}|${m.label}`).join("\n");
          setDonationSettings({
            goalAmount: data.goalAmount || 1000,
            currentAmount: data.currentAmount || 0,
            title: data.title || "Support Our Readers",
            description: data.description || "",
            donateUrl: data.donateUrl || "",
            milestonesText,
            active: data.active !== false,
          });
        }
      }
    } catch {}
  };

  const handleUpdateDonation = async () => {
    if (!token) return;
    try {
      const milestones = donationSettings.milestonesText
        .split("\n")
        .filter(Boolean)
        .map(line => {
          const [amount, ...labelParts] = line.split("|");
          return { amount: Number(amount), label: labelParts.join("|") || `Goal ${amount}` };
        });
      const res = await fetch(`${API_BASE}/api/admin/donation-settings`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          goalAmount: donationSettings.goalAmount,
          currentAmount: donationSettings.currentAmount,
          title: donationSettings.title,
          description: donationSettings.description,
          donateUrl: donationSettings.donateUrl,
          milestones,
          active: donationSettings.active,
        }),
      });
      if (res.ok) {
        setDonationMsg("Donation settings saved!");
        setTimeout(() => setDonationMsg(""), 3000);
      }
    } catch {}
  };

  const handleUpdateStudentBanner = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/banners/student`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify(studentBanner),
      });
      if (res.ok) {
        setBannerMsg("Student banner updated!");
        setTimeout(() => setBannerMsg(""), 3000);
      }
    } catch {}
  };

  const handleUpdateTeacherBanner = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/banners/teacher`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify(teacherBanner),
      });
      if (res.ok) {
        setBannerMsg("Teacher banner updated!");
        setTimeout(() => setBannerMsg(""), 3000);
      }
    } catch {}
  };

  const handleUpdateLoginBanner = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/banners/login`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify(loginBanner),
      });
      if (res.ok) {
        setBannerMsg("Login banner updated!");
        setTimeout(() => setBannerMsg(""), 3000);
      }
    } catch {}
  };

  const handleSyncBanners = async (direction: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/banners/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      if (res.ok) {
        setBannerMsg("Banners synced!");
        setTimeout(() => setBannerMsg(""), 3000);
        fetchBanners();
      }
    } catch {}
  };

  const fetchProctorPassword = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/proctor-password`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      if (res.ok) {
        const data = await res.json();
        setProctorPassword(data.password || "");
      }
    } catch {}
  };

  const handleUpdateProctorPassword = async () => {
    if (!token || !newProctorPassword.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/proctor-password`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: newProctorPassword.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProctorPassword(data.password);
        setNewProctorPassword("");
        setProctorMsg("Proctor password updated! All teachers notified.");
        setTimeout(() => setProctorMsg(""), 4000);
      } else {
        const data = await res.json();
        setProctorMsg(data.message || "Failed to update");
        setTimeout(() => setProctorMsg(""), 4000);
      }
    } catch {}
  };

  const fetchEasterEggs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/easter-eggs`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      if (res.ok) {
        const data = await res.json();
        setEasterEggs(data);
        setEggCount(data.totalEggs || 0);
      }
    } catch {}
  };

  const handleUpdateEasterEggs = async (activate: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/easter-eggs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ totalEggs: eggCount, active: activate }),
      });
      const data = await res.json();
      if (res.ok) {
        setEggMsg(data.message || "Updated!");
        setTimeout(() => setEggMsg(""), 3000);
        fetchEasterEggs();
      }
    } catch {}
  };

  const fetchPendingParents = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/pending-parents`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      if (res.ok) {
        const data = await res.json();
        setPendingParents(data);
      }
    } catch {}
  };

  const handleApproveParent = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/parent-approve/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasEmail) {
          alert("Parent approved! A confirmation email has been sent.");
        } else {
          alert("Parent approved! (No email on file - please notify them manually)");
        }
        fetchPendingParents();
        fetchAllParents();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Failed to approve parent");
      }
    } catch {
      alert("Failed to approve parent");
    }
  };

  const handleRejectParent = async (userId: number) => {
    if (!window.confirm("Reject this parent account? This will delete their account.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/parent-reject/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        alert("Parent account rejected.");
        fetchPendingParents();
        fetchAllParents();
      } else {
        alert("Failed to reject parent");
      }
    } catch {
      alert("Failed to reject parent");
    }
  };

  const fetchAllParents = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/all-parents`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      const data = res.ok ? await res.json() : [];
      setAllParents(data);
    } catch {}
  };

  const handleResetParentPassword = async (parentId: number, parentName: string) => {
    const newPassword = prompt(`Enter new password for ${parentName} (min 4 characters):`);
    if (!newPassword) return;
    if (newPassword.length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${parentId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || getTokenFromCookie()}` },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        alert(`Password reset successfully! New password: ${newPassword}`);
      } else {
        alert("Failed to reset password.");
      }
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleDeleteParent = async (parentId: number, parentName: string) => {
    if (!confirm(`Are you sure? This deletes ${parentName}'s account permanently.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${parentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        alert("Parent account deleted.");
        fetchAllParents();
        fetchPendingParents();
      } else {
        alert("Failed to delete parent.");
      }
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleApproveParentParent = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/parent-approve/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasEmail) {
          alert("Parent approved! A confirmation email has been sent.");
        } else {
          alert("Parent approved! (No email on file)");
        }
        fetchAllParents();
        fetchPendingParents();
      } else {
        alert("Failed to approve parent.");
      }
    } catch {
      alert("Failed to approve parent.");
    }
  };

  const fetchGradeChangeRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/grade-change-requests`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      if (res.ok) {
        const data = await res.json();
        setGradeChangeRequests(data.requests || []);
      }
    } catch {}
  };

  const handleGradeChange = async (requestId: number, action: 'approve' | 'deny') => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/grade-change-requests/${requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        await fetchGradeChangeRequests();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to process request');
      }
    } catch (err) {
      alert('Error processing request');
    }
  };

  // Fetch eye gaze change requests
  const fetchEyeGazeRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze-requests`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        const data = await res.json();
        const reqs = Array.isArray(data) ? data : (data.requests || []);
        setEyeGazeRequests(reqs);
      }
    } catch {}
  };

  // Handle eye gaze request approval/denial
  const handleEyeGazeRequest = async (requestId: number, approved: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/eye-gaze-approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, approved })
      });
      if (res.ok) {
        await fetchEyeGazeRequests();
        await fetchStudents();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to process request');
      }
    } catch (err) {
      alert('Error processing request');
    }
  };

  // Fetch admin leaderboard with optional band filter
  const fetchAdminLeaderboard = async (band?: string) => {
    if (!token) return;
    setAdminLbLoading(true);
    try {
      const url = band
        ? `${API_BASE}/api/leaderboard?band=${band}`
        : `${API_BASE}/api/leaderboard`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminLeaderboard(Array.isArray(data) ? data : []);
      }
    } catch {}
    setAdminLbLoading(false);
  };

  const handleResetPassword = async () => {
    if (!resetStudent || !token || !newPassword) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${resetStudent.id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        setResetSuccess(`Password reset for ${resetStudent.displayName}. New password: ${newPassword}`);
        setNewPassword("");
        setTimeout(() => { setResetStudent(null); setResetSuccess(""); }, 3000);
      }
    } catch (err) {
      console.error("Failed to reset password:", err);
    }
  };

  // Teacher management
  const [pendingTeachers, setPendingTeachers] = useState<any[]>([]);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [teacherForm, setTeacherForm] = useState({ displayName: "", username: "", password: "", email: "" });
  const [teacherFormError, setTeacherFormError] = useState("");
  const [teacherFormLoading, setTeacherFormLoading] = useState(false);

  const fetchTeachers = async () => {
    if (!token) return;
    try {
      const authToken = token || getTokenFromCookie();
      const [pendingRes, allRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/pending-teachers`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`${API_BASE}/api/teachers`, { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      if (pendingRes.ok) setPendingTeachers(await pendingRes.json());
      // Filter out admin accounts from the teachers list shown in admin panel
      if (allRes.ok) {
        const teachers = await allRes.json();
        setAllTeachers(teachers.filter((t: any) => !t.is_admin && t.role !== 'admin'));
      }
    } catch {}
  };

  const handleApproveTeacher = async (userId: number) => {
    try {
      const authToken = token || getTokenFromCookie();
      if (!authToken) {
        alert("Session expired. Please refresh and log in again.");
        return;
      }
      const res = await fetch(`${API_BASE}/api/admin/teacher-approve/${userId}`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPendingTeachers(prev => prev.filter((t) => t.id !== userId));
        fetchTeachers();
        if (data.hasEmail) {
          alert("Teacher approved! An email notification has been sent to the teacher.");
        } else {
          alert("Teacher approved. No email on file - please contact them manually.");
        }
      } else {
        alert(data.message || "Failed to approve teacher. Please try again.");
      }
    } catch {
      alert("Network error. Please refresh the page and try again.");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure? This deletes the user permanently.")) return;
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    // Optimistically remove from UI immediately
    setPendingTeachers(prev => prev.filter((t) => t.id !== userId));
    setAllTeachers(prev => prev.filter((t) => t.id !== userId));
    setStudents(prev => prev.filter((s) => s.id !== userId));
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        alert("User deleted.");
      } else {
        alert("Failed to delete user. Please refresh and try again.");
      }
    } catch {
      alert("Network error. Please refresh and try again.");
    }
  };

  const handleApproveStudent = async (studentId: number, studentName: string) => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/teacher/approve/${studentId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        alert(`${studentName} has been approved! They will see the welcome message next time they log in.`);
        fetchStudents();
      } else {
        alert("Failed to approve student. Please try again.");
      }
    } catch {
      alert("Network error. Please refresh and try again.");
    }
  };

  const handleResetTeacherPassword = async (teacherId: number) => {
    const newPassword = prompt("Enter new password for this teacher (min 4 characters):");
    if (!newPassword) return;
    if (newPassword.length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/admin/teachers/${teacherId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`Password reset successfully! New password: ${newPassword}`);
      } else {
        alert(data.message || "Failed to reset password.");
      }
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleCreateTeacher = async () => {
    setTeacherFormError("");
    if (!teacherForm.displayName.trim() || !teacherForm.username.trim() || !teacherForm.password.trim()) {
      setTeacherFormError("Display name, username, and password are required.");
      return;
    }
    if (teacherForm.username.length < 3) {
      setTeacherFormError("Username must be at least 3 characters.");
      return;
    }
    if (teacherForm.password.length < 6) {
      setTeacherFormError("Password must be at least 6 characters.");
      return;
    }
    setTeacherFormLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/teachers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          username: teacherForm.username.toLowerCase(),
          password: teacherForm.password,
          displayName: teacherForm.displayName,
          email: teacherForm.email || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create teacher.");
      if (data.hasEmail) {
        alert(`Teacher created! ${teacherForm.displayName} can log in with username: ${teacherForm.username.toLowerCase()}. An email notification has been sent.`);
      } else {
        alert(`Teacher created! ${teacherForm.displayName} can log in with username: ${teacherForm.username.toLowerCase()}`);
      }
      setTeacherForm({ displayName: "", username: "", password: "", email: "" });
      setShowTeacherForm(false);
      fetchTeachers();
    } catch (err: any) {
      setTeacherFormError(err.message || "Failed to create teacher.");
    } finally {
      setTeacherFormLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageStudent || !token || !messageText.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${messageStudent.id}/message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messageText, linkUrl }),
      });
      if (res.ok) {
        setSendSuccess(`Message sent to ${messageStudent.displayName}!`);
        setMessageText("");
        setLinkUrl("");
        setTimeout(() => { setMessageStudent(null); setSendSuccess(""); }, 2000);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleViewStudent = async (student: Student) => {
    setDetailStudent(student);
    setStudentDetail(null);
    setDetailLoading(true);
    setIreadyGrade("");
    setIreadyScore("");
    setIreadyComp("");
    setIreadyVocab("");
    setIreadyMsg("");
    setReadingProgress(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${student.id}`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudentDetail(data || null);
      }
      // Fetch reading progress
      const rpRes = await fetch(`${API_BASE}/api/admin/students/${student.id}/reading-progress`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (rpRes.ok) {
        const rpData = await rpRes.json();
        setReadingProgress(rpData);
      }
    } catch (err) {
      console.error("Failed to fetch student detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleIreadySubmit = async () => {
    if (!token || !detailStudent || !ireadyGrade || !ireadyScore) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${detailStudent.id}/iready-score`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeLevel: parseInt(ireadyGrade),
          scaleScore: parseInt(ireadyScore),
          comprehensionPct: ireadyComp ? parseInt(ireadyComp) : undefined,
          vocabularyPct: ireadyVocab ? parseInt(ireadyVocab) : undefined,
        }),
      });
      if (res.ok) {
        setIreadyMsg("i-Ready score saved! Student's reading level updated.");
        // Refresh reading progress
        const rpRes = await fetch(`${API_BASE}/api/admin/students/${detailStudent.id}/reading-progress`, {
          headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
        });
        if (rpRes.ok) {
          const rpData = await rpRes.json();
          setReadingProgress(rpData);
        }
        setTimeout(() => setIreadyMsg(""), 4000);
      } else {
        setIreadyMsg("Failed to save i-Ready score.");
      }
    } catch (err) {
      setIreadyMsg("Failed to save i-Ready score.");
    }
  };

  const handleUpdateCover = async () => {
    if (!coverBook || !token || !coverUrl) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/books/${coverBook.id}/cover`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl }),
      });
      if (res.ok) {
        setCoverSuccess("Cover updated!");
        setCoverUrl("");
        setTimeout(() => { setCoverBook(null); setCoverSuccess(""); }, 2000);
        fetchBooks();
      }
    } catch (err) {
      console.error("Failed to update cover:", err);
    }
  };

  const handleMarkMsgRead = async (msgId: number) => {
    try {
      await fetch(`${API_BASE}/api/admin/messages/${msgId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      fetchStudentMsgs();
      fetchUnreadMsgCount();
      setNotifRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Failed to mark message:", err);
    }
  };

  const handleParsePaste = () => {
    setQuizError("");
    setPasteMsg("");
    const text = pasteText.trim();
    if (!text) {
      setQuizError("Paste some quiz text first.");
      return;
    }

    let parsed: QuestionForm[] = [];

    // Try JSON format first
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) {
        parsed = json.map((item: any) => ({
          question: item.question || "",
          options: Array.isArray(item.options) && item.options.length === 4
            ? item.options.map((o: any) => String(o))
            : ["", "", "", ""],
          correct: item.correct && ["A", "B", "C", "D"].includes(String(item.correct).toUpperCase())
            ? String(item.correct).toUpperCase()
            : "A",
        }));
      }
    } catch {
      // Not JSON, parse as text format
      parsed = parseTextFormat(text);
    }

    if (parsed.length === 0) {
      setQuizError("Could not parse any questions. Check the format and try again.");
      return;
    }

    // Fill into the 10-question editor
    const newQuestions = Array.from({ length: 10 }, () => ({ question: "", options: ["", "", "", ""], correct: "A" }));
    for (let i = 0; i < Math.min(parsed.length, 10); i++) {
      newQuestions[i] = parsed[i];
    }
    setQuestions(newQuestions);
    setPasteMsg(`Parsed ${parsed.length} question${parsed.length === 1 ? "" : "s"}.`);
  };

  const parseTextFormat = (text: string): QuestionForm[] => {
    const questions: QuestionForm[] = [];
    // Split by question number pattern (1. 2. etc.) or double newlines
    const blocks = text.split(/\n(?=\d+\.\s)/);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // Extract question text (everything before first option)
      const lines = trimmed.split(/\n/).map(l => l.trim());
      const questionLine = lines.find(l => /^\d+\.\s/.test(l));
      if (!questionLine) continue;
      const questionText = questionLine.replace(/^\d+\.\s/, "").trim();
      if (!questionText) continue;

      const options: string[] = [];
      let correct = "A";

      for (const line of lines) {
        // Match A) Option or A. Option or A: Option
        const optMatch = line.match(/^([A-D])\)\s*(.+)/);
        if (optMatch) {
          const letter = optMatch[1];
          const text = optMatch[2].trim();
          options.push(text);
          continue;
        }
        // Match Answer: B
        const ansMatch = line.match(/^Answer:\s*([A-D])/i);
        if (ansMatch) {
          correct = ansMatch[1].toUpperCase();
        }
      }

      if (options.length >= 4) {
        questions.push({
          question: questionText,
          options: options.slice(0, 4),
          correct,
        });
      }
    }
    return questions;
  };

  const handleCopyPrompt = () => {
    const bookTitle = quizForm.title || "[BOOK TITLE]";
    const author = quizForm.author || "[AUTHOR]";
    const prompt = `Generate a 10-question multiple choice quiz for ${bookTitle} by ${author}. Format each question as:
1. Question text
A) Option
B) Option  
C) Option
D) Option
Answer: [correct letter]

Generate exactly 10 questions.`;

    // Use clipboard API with fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(prompt).then(() => {
        setPasteMsg("Prompt copied to clipboard!");
        setTimeout(() => setPasteMsg(""), 2000);
      }).catch(() => {
        setQuizError("Could not copy to clipboard. Select and copy the text manually.");
      });
    } else {
      setQuizError("Clipboard not available. Select and copy the text manually.");
    }
  };

  const handleSuggestBand = async () => {
    if (!quizForm.title.trim()) {
      setQuizError("Enter a book title first.");
      return;
    }
    setBandSuggesting(true);
    setQuizError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/suggest-band`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: quizForm.title, author: quizForm.author }),
      });
      if (res.ok) {
        const data = await res.json();
        setBandSuggestion(data.band || "");
        setQuizGradeBand(data.band || "");
      } else {
        setQuizError("Could not suggest a band. Please select manually.");
      }
    } catch {
      setQuizError("Could not suggest a band. Please select manually.");
    } finally {
      setBandSuggesting(false);
    }
  };

  const handleAddQuiz = async () => {
    setQuizError("");
    setQuizSuccess("");
    if (!quizForm.title || !quizForm.author) {
      setQuizError("Title and author are required.");
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || q.options.some(o => !o)) {
        setQuizError(`Question ${i + 1} is incomplete. Fill in all fields.`);
        return;
      }
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/books`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quizForm,
          pointsValue: quizForm.pointsValue || 10,
          readUrl: quizForm.readUrl || null,
          gradeBand: quizGradeBand || null,
          questions: questions.map(q => ({
            question: q.question,
            options: q.options,
            correct: q.correct,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuizSuccess(`"${quizForm.title}" added successfully!`);
        // If this was created from a quiz request, mark it complete
        if (activeRequestId) {
          await fetch(`${API_BASE}/api/admin/quiz-requests/${activeRequestId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "completed" }),
          });
          setActiveRequestId(null);
          fetchQuizRequests();
          setNotifRefreshKey(k => k + 1);
        }
        setTimeout(() => {
          setShowAddQuiz(false);
          setQuizSuccess("");
          setQuizForm({ title: "", author: "", coverUrl: "", description: "", pointsValue: 20, readUrl: "" });
          setQuestions(Array.from({ length: 10 }, () => ({ question: "", options: ["", "", "", ""], correct: "A" })));
        }, 2000);
        fetchBooks();
      } else {
        setQuizError(data.message || "Failed to add quiz.");
      }
    } catch (err) {
      setQuizError("Failed to add quiz.");
    }
  };

  const fetchReviewRequests = async () => {
    if (!token) return;
    setReviewRequestsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/review-requests`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setReviewRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch review requests:", err);
    } finally {
      setReviewRequestsLoading(false);
    }
  };

  const handleViewReview = async (reviewId: number) => {
    setActiveReview(reviewRequests.find(r => r.id === reviewId) || null);
    setReviewDetail(null);
    setReviewDetailLoading(true);
    setCorrectedAnswers({});
    setUpdateAnswerKey(false);
    setAdminNotes("");
    setRegradeMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/review-requests/${reviewId}`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReviewDetail(data);
        const initialCorrected: Record<string, string> = {};
        (data.questions || []).forEach((q: any) => {
          initialCorrected[String(q.id)] = q.correctAnswer;
        });
        setCorrectedAnswers(initialCorrected);
      }
    } catch (err) {
      console.error("Failed to fetch review detail:", err);
    } finally {
      setReviewDetailLoading(false);
    }
  };

  const handleRegrade = async () => {
    if (!token || !activeReview) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/review-requests/${activeReview.id}/regrade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          correctedAnswers,
          updateAnswerKey,
          adminNotes: adminNotes || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRegradeMsg(`Regraded! New score: ${data.newScore}/${data.total}. Points: ${data.newPoints} (was ${data.oldPoints}).`);
        fetchReviewRequests();
        fetchStudents();
        setNotifRefreshKey(k => k + 1);
        setTimeout(() => {
          setActiveReview(null);
          setReviewDetail(null);
          setRegradeMsg("");
        }, 4000);
      }
    } catch (err) {
      console.error("Failed to regrade:", err);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    // Clear module-level caches to prevent stale data
    adminCache.students = [];
    adminCache.books = [];
    logout();
    navigate("/");
  };

  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate("/");
    }
  }, [user, navigate]);

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPointsAll = (students || []).reduce((sum, s) => sum + (s?.totalPoints || 0), 0);
  const totalQuizzes = (students || []).reduce((sum, s) => sum + (s?.quizzesTaken || 0), 0);
  const totalMastered = (students || []).reduce((sum, s) => sum + (s?.quizzesMastered || 0), 0);
  const unreadMsgs = (studentMsgs || []).filter(m => !m.isRead).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 flex items-center gap-1 sm:gap-3 h-16">
          <Button variant="ghost" size="sm" onClick={() => navigate("/progress")} className="flex-shrink-0">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Progress</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/polls")} className="flex-shrink-0">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Polls</span>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm sm:text-base truncate">Admin Dashboard</h1>
          </div>
          <NotificationBell refreshKey={notifRefreshKey} onNavigate={handleNotifNavigate} />
          <Button variant="outline" size="sm" onClick={() => { fetchStudentMsgs(); fetchSentMsgs(); fetchUnreadMsgCount(); setActiveConversationUserId(null); setReplyText(""); setReplyLink(""); setReplySuccess(""); setShowInbox(true); }} className="relative">
            <Inbox className="w-4 h-4" />
            <span className="hidden sm:inline">Inbox</span>
            {unreadMsgCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadMsgCount > 9 ? "9+" : unreadMsgCount}</span>
            )}
          </Button>
          <div className="hidden sm:flex"><ReportProblemButton variant="ghost" size="sm" /></div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <span className="hidden sm:inline">Logout</span>
            <LogOut className="w-4 h-4 sm:hidden" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome banner */}
        <div className="rounded-2xl bg-primary text-white p-6 sm:p-8 shadow-lg">
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-1 text-white/90">Welcome back! Here's your platform overview.</p>
          <div className="flex gap-4 sm:gap-6 mt-4 flex-wrap">
            <div>
              <div className="text-3xl font-bold">{students.length}</div>
              <div className="text-sm text-white/80">Students</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{totalQuizzes}</div>
              <div className="text-sm text-white/80">Quizzes Completed</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{totalMastered}</div>
              <div className="text-sm text-white/80">Quizzes Mastered</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{books.filter(b => b.readUrl).length}</div>
              <div className="text-sm text-white/80">Books to Read</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{quizCount}</div>
              <div className="text-sm text-white/80">Quizzes Available</div>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{students.length}</div>
                <div className="text-xs text-muted-foreground">Students</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{totalQuizzes}</div>
                <div className="text-xs text-muted-foreground">Quizzes Completed</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold">{totalMastered}</div>
                <div className="text-xs text-muted-foreground">Quizzes Mastered</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{books.filter(b => b.readUrl).length}</div>
                <div className="text-xs text-muted-foreground">Books to Read</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <FileQuestion className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{quizCount}</div>
                <div className="text-xs text-muted-foreground">Quizzes Available</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowAddQuiz(true)} className="bg-primary">
            <PlusCircle className="w-4 h-4 mr-1" />
            Add Quiz
          </Button>

          {/* Announcement banner */}
          <div className="space-y-2 pt-4 border-t border-border mt-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <Label className="text-sm font-medium">Announcement Banner</Label>
            </div>
            <p className="text-xs text-muted-foreground">This message appears at the top of every student's Library page.</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter an announcement (leave empty to clear)..."
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button size="sm" variant="outline" onClick={handleUpdateAnnouncement}>
                Update
              </Button>
            </div>
            {announcementMsg && <span className="text-xs text-green-400">{announcementMsg}</span>}
          </div>

          {/* Student Banner */}
          <div className="space-y-2 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">Student Banner (visible to students)</Label>
            <textarea
              placeholder="Banner text for students..."
              value={studentBanner.text}
              onChange={(e) => setStudentBanner({ ...studentBanner, text: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px]"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Bg:</label>
                <input type="color" value={studentBanner.bgColor} onChange={(e) => setStudentBanner({ ...studentBanner, bgColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Text:</label>
                <input type="color" value={studentBanner.textColor} onChange={(e) => setStudentBanner({ ...studentBanner, textColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={studentBanner.active} onChange={(e) => setStudentBanner({ ...studentBanner, active: e.target.checked })} />
                Active
              </label>
              <Button size="sm" variant="outline" onClick={handleUpdateStudentBanner}>Update</Button>
            </div>
          </div>

          {/* Teacher Banner */}
          <div className="space-y-2 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">Teacher Banner (visible to teachers only)</Label>
            <textarea
              placeholder="Banner text for teachers..."
              value={teacherBanner.text}
              onChange={(e) => setTeacherBanner({ ...teacherBanner, text: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px]"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Bg:</label>
                <input type="color" value={teacherBanner.bgColor} onChange={(e) => setTeacherBanner({ ...teacherBanner, bgColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Text:</label>
                <input type="color" value={teacherBanner.textColor} onChange={(e) => setTeacherBanner({ ...teacherBanner, textColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={teacherBanner.active} onChange={(e) => setTeacherBanner({ ...teacherBanner, active: e.target.checked })} />
                Active
              </label>
              <Button size="sm" variant="outline" onClick={handleUpdateTeacherBanner}>Update</Button>
            </div>
            {/* Sync buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => handleSyncBanners("student-to-teacher")}>
                Copy Student → Teacher
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSyncBanners("teacher-to-student")}>
                Copy Teacher → Student
              </Button>
            </div>
            {bannerMsg && <span className="text-xs text-green-400">{bannerMsg}</span>}
          </div>

          {/* Login Banner */}
          <div className="space-y-2 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">Login Page Banner (visible on the login page to everyone)</Label>
            <Input
              value={loginBanner.text}
              onChange={(e) => setLoginBanner({ ...loginBanner, text: e.target.value })}
              placeholder="e.g. Site maintenance tonight at 9 PM. Expect brief downtime."
              className="bg-muted/30 border-border text-foreground"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">BG</span>
                <input type="color" value={loginBanner.bgColor} onChange={(e) => setLoginBanner({ ...loginBanner, bgColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Text</span>
                <input type="color" value={loginBanner.textColor} onChange={(e) => setLoginBanner({ ...loginBanner, textColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <div className="flex items-center gap-1">
                <input type="checkbox" checked={loginBanner.active} onChange={(e) => setLoginBanner({ ...loginBanner, active: e.target.checked })} />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <Button size="sm" variant="outline" onClick={handleUpdateLoginBanner}>Update</Button>
            </div>
          </div>

          {/* Donation Goal Settings */}
          <div className="space-y-3 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">Donation Goal (shows on student library page)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground">Goal Amount ($)</span>
                <Input
                  type="number"
                  value={donationSettings.goalAmount}
                  onChange={(e) => setDonationSettings({ ...donationSettings, goalAmount: Number(e.target.value) })}
                  className="bg-muted/30 border-border text-foreground"
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Current Amount ($)</span>
                <Input
                  type="number"
                  value={donationSettings.currentAmount}
                  onChange={(e) => setDonationSettings({ ...donationSettings, currentAmount: Number(e.target.value) })}
                  className="bg-muted/30 border-border text-foreground"
                />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Title</span>
              <Input
                value={donationSettings.title}
                onChange={(e) => setDonationSettings({ ...donationSettings, title: e.target.value })}
                placeholder="Support Our Readers"
                className="bg-muted/30 border-border text-foreground"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Description</span>
              <Input
                value={donationSettings.description}
                onChange={(e) => setDonationSettings({ ...donationSettings, description: e.target.value })}
                placeholder="Help us keep A.R.I.S.E Reader free for students"
                className="bg-muted/30 border-border text-foreground"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Donation Link (URL)</span>
              <Input
                value={donationSettings.donateUrl}
                onChange={(e) => setDonationSettings({ ...donationSettings, donateUrl: e.target.value })}
                placeholder="https://donate.stripe.com/..."
                className="bg-muted/30 border-border text-foreground"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Milestones (one per line, format: amount|label)</span>
              <textarea
                value={donationSettings.milestonesText}
                onChange={(e) => setDonationSettings({ ...donationSettings, milestonesText: e.target.value })}
                placeholder={"250|First Goal\n500|Halfway\n1000|Fully Funded"}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-foreground text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={donationSettings.active}
                  onChange={(e) => setDonationSettings({ ...donationSettings, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-muted-foreground">Active (show on library page)</span>
              </label>
              <Button size="sm" variant="outline" onClick={handleUpdateDonation}>Save Donation Settings</Button>
            </div>
            {donationMsg && <span className="text-xs text-green-400">{donationMsg}</span>}
          </div>

          {/* Proctor Password */}
          <div className="space-y-2 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">Proctor Password (All Proctored Tests)</Label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={proctorPassword}
                className="flex-1 px-3 py-1.5 rounded-lg bg-muted/30 border border-border text-foreground text-sm font-mono"
              />
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(proctorPassword)}>Copy</Button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New proctor password..."
                value={newProctorPassword}
                onChange={(e) => setNewProctorPassword(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button size="sm" variant="outline" onClick={handleUpdateProctorPassword}>Update</Button>
            </div>
            <p className="text-xs text-muted-foreground">Updating the proctor password sends a notification to all teachers with a direct link to view it.</p>
            {proctorMsg && <span className="text-xs text-green-400">{proctorMsg}</span>}
          </div>

          {/* Easter Eggs */}
          <div className="space-y-3 pt-4 border-t border-border mt-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🥚</span>
              <Label className="text-sm font-bold">FYP Easter Eggs</Label>
              <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold ${easterEggs.active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                {easterEggs.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-lg font-bold">{easterEggs.totalEggs}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Remaining</div>
                <div className="text-lg font-bold text-amber-500">{easterEggs.remainingEggs}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Claimed</div>
                <div className="text-lg font-bold text-green-400">{easterEggs.claims.length}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Number of eggs..."
                value={eggCount}
                onChange={(e) => setEggCount(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => handleUpdateEasterEggs(false)}>Save</Button>
              <Button size="sm" onClick={() => handleUpdateEasterEggs(true)} className="bg-amber-500 hover:bg-amber-600 text-black">
                {easterEggs.active ? "Reset & Reactivate" : "Activate"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Each egg gives {easterEggs.pointsPerEgg} leaderboard points. Students find them randomly while scrolling the FYP. Each student can only claim once.</p>
            {eggMsg && <span className="text-xs text-green-400">{eggMsg}</span>}
            {easterEggs.claims.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                <div className="text-xs font-semibold text-muted-foreground">Claims:</div>
                {easterEggs.claims.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/20">
                    <span className="font-medium">{c.displayName}</span>
                    <span className="text-muted-foreground">@{c.username}</span>
                    <span className="text-amber-500 font-bold">+{c.points_awarded}</span>
                    <span className="text-muted-foreground">{new Date(c.claimed_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Eye Gaze Change Requests */}
        {eyeGazeRequests.length > 0 && (
        <Card className="shadow-md border-blue-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-500" />
              Eye Gaze Change Requests ({eyeGazeRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eyeGazeRequests.map((r) => (
              <div key={r.id || r.userId} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div>
                  <p className="font-semibold text-sm">{r.displayName || r.username}</p>
                  <p className="text-xs text-muted-foreground">@{r.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {r.currentStatus ? 'Enable' : 'Disable'} Eye Gaze access
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEyeGazeRequest(r.id, true)}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >Approve</button>
                  <button
                    onClick={() => handleEyeGazeRequest(r.id, false)}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >Deny</button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        )}

        {/* Admin Leaderboard with Band Switching */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Leaderboard (Admin View)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">View Band:</span>
              <select
                value={adminLbBand}
                onChange={(e) => {
                  setAdminLbBand(e.target.value);
                  fetchAdminLeaderboard(e.target.value);
                }}
                className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm"
              >
                <option value="">All Bands</option>
                <option value="K-2">K-2 Band</option>
                <option value="3-5">3-5 Band</option>
                <option value="6-8">6-8 Band</option>
                <option value="9-12">9-12 Band</option>
              </select>
            </div>
            {adminLbLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : adminLeaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No students in this band yet.</p>
            ) : (
              <div className="space-y-2">
                {adminLeaderboard.slice(0, 20).map((entry: any, idx: number) => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 bg-muted text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {entry.displayName}
                        {entry.isEyeGaze || entry.isEyeGazeUser ? (
                          <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">EG</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.quizzesTaken} quizzes
                        {entry.schoolName && <span className="ml-1">· {entry.schoolName}</span>}
                        {entry.grade && <span className="ml-1">· Gr {entry.grade}</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm text-primary">{entry.totalPoints}</div>
                      <div className="text-xs text-muted-foreground">pts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade Change Requests */}
        {gradeChangeRequests.length > 0 && (
        <Card className="shadow-md border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.836 5.253 9.5 4.5 8 4.5c-1.5 0-2.836.753-4 1.753v13c1.164-.991 2.5-1.753 4-1.753 1.5 0 2.836.753 4 1.753 1.164-.991 2.5-1.753 4-1.753 1.5 0 2.836.753 4 1.753v-13c-1.164-.991-2.5-1.753-4-1.753-1.5 0-2.836.753-4 1.753z" />
              </svg>
              Grade Change Requests ({gradeChangeRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {gradeChangeRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div>
                  <p className="font-semibold text-sm">{r.displayName || r.username}</p>
                  <p className="text-xs text-muted-foreground">@{r.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Grade {r.oldGrade || 'N/A'} ({r.oldBand || 'N/A'} Band) → Grade {r.newGrade} ({r.newBand} Band)
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleGradeChange(r.id, 'approve')}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >Approve</button>
                  <button
                    onClick={() => handleGradeChange(r.id, 'deny')}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >Deny</button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        )}

        {/* Teachers Section */}
        <div ref={teachersRef}>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Teachers ({allTeachers.length})
              </span>
              <button onClick={() => setShowTeacherForm(!showTeacherForm)} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-white hover:opacity-90">
                + Add Teacher
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Create Teacher Form */}
            {showTeacherForm && (
              <div className="mb-4 p-4 rounded-lg bg-background border border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Display Name</label>
                    <input type="text" value={teacherForm.displayName} onChange={(e) => setTeacherForm({ ...teacherForm, displayName: e.target.value })} placeholder="Ms. Johnson" className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Username</label>
                    <input type="text" value={teacherForm.username} onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })} placeholder="mjohnson" className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Password</label>
                    <input type="text" value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} placeholder="At least 6 chars" className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Email (optional)</label>
                    <input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} placeholder="teacher@school.com" className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm" />
                  </div>
                </div>
                {teacherFormError && <p className="text-sm text-red-500 mt-2">{teacherFormError}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={handleCreateTeacher} disabled={teacherFormLoading} className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50">
                    {teacherFormLoading ? "Creating..." : "Create Teacher"}
                  </button>
                  <button onClick={() => { setShowTeacherForm(false); setTeacherFormError(""); }} className="px-4 py-2 text-sm font-semibold rounded-lg bg-muted text-muted-foreground hover:opacity-80">
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Teacher will be created as approved and can log in immediately.</p>
              </div>
            )}

            {/* Pending Teacher Approvals */}
            {pendingTeachers.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-sm text-yellow-500 mb-2">Pending Approvals</h3>
                <div className="space-y-2">
                  {pendingTeachers.map((t) => (
                    <div key={t.id} className="flex items-center justify-between bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                      <div>
                        <span className="font-semibold text-white">{t.display_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">@{t.username}</span>
                        {t.email && <span className="text-xs text-muted-foreground ml-2">| {t.email}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveTeacher(t.id)} className="px-3 py-1.5 text-sm font-semibold rounded bg-primary text-white hover:opacity-90">Approve</button>
                        <button onClick={() => handleDeleteUser(t.id)} className="px-3 py-1.5 text-sm font-semibold rounded bg-red-600 text-white hover:opacity-90">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Teachers List */}
            {allTeachers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No teachers registered yet.</p>
            ) : (
              <div className="space-y-2">
                {allTeachers.map((t) => (
                  <div key={t.id} className="flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                        {(t.display_name || "?").charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{t.display_name}</div>
                        <div className="text-xs text-muted-foreground">@{t.username}{t.email ? " | " + t.email : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs"
                        defaultValue={t.school_id || ""}
                        onChange={async (e) => {
                          const schoolId = e.target.value ? parseInt(e.target.value) : null;
                          const authToken = token || getTokenFromCookie();
                          try {
                            const res = await fetch(`${API_BASE}/api/admin/teachers/${t.id}/assign-school`, {
                              method: "POST",
                              headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
                              body: JSON.stringify({ schoolId }),
                            });
                            if (res.ok) {
                              fetchTeachers();
                            }
                          } catch {}
                        }}
                      >
                        <option value="">No school</option>
                        {schools.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <select
                        className="px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs"
                        defaultValue={""}
                        onChange={async (e) => {
                          const grade = e.target.value;
                          if (!grade) return;
                          const authToken = token || getTokenFromCookie();
                          const currentGrades = (window as any).__teacherGrades?.[t.id] || [];
                          const newGrades = currentGrades.includes(grade) ? currentGrades.filter((g: string) => g !== grade) : [...currentGrades, grade];
                          try {
                            const res = await fetch(`${API_BASE}/api/admin/teachers/${t.id}/assign-grades`, {
                              method: "POST",
                              headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
                              body: JSON.stringify({ grades: newGrades }),
                            });
                            if (res.ok) {
                              (window as any).__teacherGrades = (window as any).__teacherGrades || {};
                              (window as any).__teacherGrades[t.id] = newGrades;
                              fetchTeachers();
                            }
                          } catch {}
                        }}
                      >
                        <option value="">Assign grade...</option>
                        {["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((g) => (
                          <option key={g} value={g}>Grade {g}</option>
                        ))}
                      </select>
                      <button onClick={() => handleResetTeacherPassword(t.id)} className="px-3 py-1.5 text-sm font-semibold rounded bg-blue-600/80 text-white hover:opacity-90">Reset</button>
                      <button onClick={() => handleDeleteUser(t.id)} className="px-3 py-1.5 text-sm font-semibold rounded bg-red-600/80 text-white hover:opacity-90">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Pending Student Approvals */}
        {students.filter(s => s.approvedByTeacher === false).length > 0 && (
          <Card className="shadow-md border-yellow-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-500">
                <CheckCircle2 className="w-5 h-5" />
                Pending Student Approvals ({students.filter(s => s.approvedByTeacher === false).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">These students selected a teacher and are waiting to be approved. Use this to approve them when their teacher is unavailable.</p>
              <div className="space-y-2">
                {students.filter(s => s.approvedByTeacher === false).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                    <div className="w-10 h-10 rounded-full bg-yellow-500 text-black flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {s.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{s.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{s.username}{s.teacherName ? ` — waiting for ${s.teacherName}` : ""}</p>
                    </div>
                    <Button size="sm" onClick={() => handleApproveStudent(s.id, s.displayName)} className="bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">Approve</span>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Parent Approvals */}
        {pendingParents.length > 0 && (
          <Card className="shadow-md border-blue-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Users className="w-5 h-5" />
                Pending Parent Approvals ({pendingParents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">Parents who signed up and are waiting for approval. They will be linked to their student once approved.</p>
              <div className="space-y-2">
                {pendingParents.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {p.display_name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{p.username}{p.email ? ` — ${p.email}` : ""}</p>
                      {p.studentName && <p className="text-xs text-blue-400">Linked student: {p.studentName}</p>}
                    </div>
                    <Button size="sm" onClick={() => handleApproveParent(p.id)} className="bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">Approve</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectParent(p.id)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Parents Management */}
        <Card className="shadow-md border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-400">
              <Users className="w-5 h-5" />
              Parents ({allParents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allParents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No parent accounts yet.</p>
            ) : (
              <div className="space-y-2">
                {allParents.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-purple-500/30 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {p.display_name?.charAt(0).toUpperCase() || p.displayName?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.display_name || p.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{p.username}{p.email ? ` — ${p.email}` : ""}</p>
                      {p.studentName && <p className="text-xs text-purple-400">Student: {p.studentName}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.accountApproved ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {p.accountApproved ? "ACTIVE" : "PENDING"}
                    </span>
                    {!p.accountApproved && (
                      <Button size="sm" onClick={() => handleApproveParentParent(p.id)} className="bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline ml-1">Approve</span>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleResetParentPassword(p.id, p.display_name || p.displayName || "this parent")} className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">Reset</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteParent(p.id, p.display_name || p.displayName || "this parent")} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">Delete</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students table */}
        <Card className="shadow-md" ref={studentsRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Student search + filters */}
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search students by name or username..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={filterBand} onChange={(e) => setFilterBand(e.target.value)} className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs">
                  <option value="">All Bands</option>
                  <option value="K-2">K-2 Band</option>
                  <option value="3-5">3-5 Band</option>
                  <option value="6-8">6-8 Band</option>
                  <option value="9-12">9-12 Band</option>
                </select>
                <select value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)} className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs">
                  <option value="">All Schools</option>
                  {schools.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs">
                  <option value="">All Grades</option>
                  {['K','1','2','3','4','5','6','7','8','9','10','11','12'].map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
                <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs">
                  <option value="">All Teachers</option>
                  {allTeachers.map(t => <option key={t.id} value={String(t.id)}>{t.display_name || t.username}</option>)}
                </select>
                {(filterBand || filterSchool || filterGrade || filterTeacher) && (
                  <button onClick={() => { setFilterBand(""); setFilterSchool(""); setFilterGrade(""); setFilterTeacher(""); }} className="px-3 py-1.5 text-xs text-primary hover:underline">Clear filters</button>
                )}
              </div>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students registered yet. Share the link with your students!
              </p>
            ) : (() => {
              const gradeToBand = (g: string) => {
                if (['K','1','2'].includes(g)) return 'K-2';
                if (['3','4','5'].includes(g)) return '3-5';
                if (['6','7','8'].includes(g)) return '6-8';
                if (['9','10','11','12'].includes(g)) return '9-12';
                return '';
              };
              const filtered = (students || []).filter(s => {
                const nameMatch = (s?.displayName || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (s?.username || "").toLowerCase().includes(studentSearch.toLowerCase());
                if (!nameMatch) return false;
                const sGrade = userGradesMap[String(s.id)] || '';
                const sBand = gradeToBand(sGrade);
                if (filterBand && sBand !== filterBand) return false;
                if (filterSchool && String(s.schoolId || '') !== filterSchool) return false;
                if (filterGrade && sGrade !== filterGrade) return false;
                if (filterTeacher && String(s.teacherId || '') !== filterTeacher) return false;
                return true;
              });
              if (filtered.length === 0) {
                return <p className="text-center text-muted-foreground py-8">No students found with these filters.</p>;
              }
              return (
                <div className="space-y-2">
                  {filtered.map((s) => {
                    const sGrade = userGradesMap[String(s.id)] || '';
                    const sBand = gradeToBand(sGrade);
                    return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {s.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{s.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{s.username}{sBand ? ` · ${sBand} Band${sGrade ? ` · Grade ${sGrade}` : ''}` : ''}</p>
                      </div>
                      <div className="text-right flex-shrink-0 hidden sm:block">
                        <div className="font-bold text-sm">{s.totalPoints} pts</div>
                        <div className="text-xs text-muted-foreground">{s.quizzesTaken} quizzes</div>
                      </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {/* View detail */}
                      <Button variant="ghost" size="sm" onClick={() => handleViewStudent(s)}>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline ml-1">Details</span>
                      </Button>

                      {/* Reset password */}
                      <Dialog open={resetStudent?.id === s.id} onOpenChange={(open) => {
                        if (open) { setResetStudent(s); setResetSuccess(""); }
                        else { setResetStudent(null); setNewPassword(""); setResetSuccess(""); }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline ml-1">Reset</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reset Password for {s.displayName}</DialogTitle>
                          </DialogHeader>
                          {resetSuccess ? (
                            <div className="text-center py-6">
                              <p className="text-sm text-green-400 font-medium mb-2">{resetSuccess}</p>
                              <p className="text-xs text-muted-foreground">
                                Tell the student their new password.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <Input
                                  id="new-password"
                                  type="text"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="Enter new password"
                                />
                              </div>
                              <Button onClick={handleResetPassword} disabled={!newPassword || newPassword.length < 4} className="w-full">
                                Reset Password
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      {/* Send message */}
                      <Dialog open={messageStudent?.id === s.id} onOpenChange={(open) => {
                        if (open) { setMessageStudent(s); setSendSuccess(""); }
                        else { setMessageStudent(null); setMessageText(""); setLinkUrl(""); setSendSuccess(""); }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Send className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline ml-1">Message</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Send Message to {s.displayName}</DialogTitle>
                          </DialogHeader>
                          {sendSuccess ? (
                            <div className="text-center py-6">
                              <p className="text-sm text-green-400 font-medium">{sendSuccess}</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="message-text">Message</Label>
                                <Textarea
                                  id="message-text"
                                  value={messageText}
                                  onChange={(e) => setMessageText(e.target.value)}
                                  placeholder="Type your message..."
                                  rows={3}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="link-url">Link (optional)</Label>
                                <Input
                                  id="link-url"
                                  type="url"
                                  value={linkUrl}
                                  onChange={(e) => setLinkUrl(e.target.value)}
                                  placeholder="https://..."
                                />
                              </div>
                              <Button onClick={handleSendMessage} disabled={!messageText.trim()} className="w-full">
                                <Send className="w-4 h-4 mr-1" />
                                Send Message
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      {/* Delete user */}
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(s.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline ml-1">Delete</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
              </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Book cover management */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImagePlus className="w-5 h-5" />
              Book Covers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Book search + sort */}
            <div className="mb-4 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search books..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowAdminSortMenu(!showAdminSortMenu)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm hover:bg-muted transition-colors whitespace-nowrap"
                >
                  <span className="font-medium">
                    {adminSortBy === "points" ? "Points" : adminSortBy === "popular" ? "Popular" : adminSortBy === "recent" ? "Recent" : adminSortBy === "classics" ? "Classics" : "New"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
                {showAdminSortMenu && (
                  <div className="absolute right-0 mt-1 w-36 rounded-xl bg-card border border-border shadow-lg z-50 overflow-hidden">
                    {[
                      { val: "points", label: "By Points" },
                      { val: "popular", label: "Popular" },
                      { val: "recent", label: "Recent Novels" },
                      { val: "classics", label: "Classics" },
                      { val: "new", label: "Newly Added" },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => { setAdminSortBy(opt.val as any); setShowAdminSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${adminSortBy === opt.val ? "text-primary font-medium" : "text-foreground"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {books.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Loading books...</p>
            ) : (books || []).filter(b =>
                (b?.title || "").toLowerCase().includes(bookSearch.toLowerCase()) ||
                (b?.author || "").toLowerCase().includes(bookSearch.toLowerCase())
              ).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No books match your search.</p>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(books || []).filter(b =>
                (b?.title || "").toLowerCase().includes(bookSearch.toLowerCase()) ||
                (b?.author || "").toLowerCase().includes(bookSearch.toLowerCase())
              ).sort((a, b) => {
                if (adminSortBy === "new") return b.id - a.id;
                if (adminSortBy === "recent") return (!a.readUrl ? 1 : 0) - (!b.readUrl ? 1 : 0);
                if (adminSortBy === "classics") return (a.readUrl ? 1 : 0) - (b.readUrl ? 1 : 0);
                if (adminSortBy === "popular") return 0; // admin doesn't have attempt data handy
                // points: sort by pointsValue desc
                return (b.pointsValue || 0) - (a.pointsValue || 0);
              }).map((b) => (
                <div key={b.id} className="flex flex-col items-center gap-2 p-2 rounded-xl bg-muted/20">
                  <div className="w-16 h-24 flex-shrink-0">
                    {b.coverUrl ? (
                      <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover rounded" />
                    ) : (
                      <div className="w-full h-full rounded bg-primary flex items-center justify-center text-xs text-white text-center p-1">{b.title}</div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-center line-clamp-2">{b.title}</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCoverBook(b); setCoverUrl(b.coverUrl || ""); setCoverSuccess(""); }}>
                    <ImagePlus className="w-3 h-3 mr-1" />
                    Update
                  </Button>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Quiz Review Requests */}
        <Card className="shadow-md" ref={reviewRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-orange-400" />
              Quiz Review Requests
              {reviewRequests.filter(r => r.status === "pending").length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {reviewRequests.filter(r => r.status === "pending").length} pending
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviewRequestsLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading review requests...</p>
            ) : reviewRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No quiz review requests yet.</p>
            ) : (
              <div className="space-y-3">
                {reviewRequests.map((r) => (
                  <div key={r.id} className={`rounded-xl border p-4 ${r.status === "pending" ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-muted/30"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold">{r.studentName}</span>
                        <span className="text-sm text-muted-foreground ml-2">{r.bookTitle}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "pending" ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Score: {r.original_score}/{r.total || 10} | Points: {r.original_points}
                      {r.reviewed_score !== null && r.status === "resolved" && (
                        <span className="ml-2 text-green-400">→ Reviewed: {r.reviewed_score}/{r.total || 10}, {r.reviewed_points} pts</span>
                      )}
                      {r.reason && <span className="block mt-1 italic">"{r.reason}"</span>}
                    </div>
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => handleViewReview(r.id)}>
                        <FileSearch className="w-4 h-4 mr-1" />
                        Review Quiz
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Detail Dialog */}
        {activeReview && (
          <Dialog open={!!activeReview} onOpenChange={(open) => { if (!open) { setActiveReview(null); setReviewDetail(null); } }}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-orange-400" />
                  Quiz Review: {activeReview.studentName}
                </DialogTitle>
              </DialogHeader>
              {reviewDetailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : reviewDetail ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div>
                      <p className="font-semibold">{reviewDetail.book?.title}</p>
                      <p className="text-sm text-muted-foreground">Student: {reviewDetail.student?.displayName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Original: <span className="font-semibold">{reviewDetail.review?.original_score}/{reviewDetail.attempt?.total}</span></p>
                      <p className="text-sm">Points: <span className="font-semibold">{reviewDetail.review?.original_points}</span></p>
                    </div>
                  </div>
                  {regradeMsg && (
                    <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-400">
                      {regradeMsg}
                    </div>
                  )}
                  <div className="space-y-3">
                    {(reviewDetail.questions || []).map((q: any, idx: number) => {
                      const studentAns = q.studentAnswer;
                      const correctAns = correctedAnswers[String(q.id)] || q.correctAnswer;
                      const isCorrect = studentAns === correctAns;
                      return (
                        <div key={q.id} className={`rounded-lg border p-4 ${isCorrect ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                          <p className="font-medium mb-2">{idx + 1}. {q.questionText}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {[
                              { letter: "a", text: q.optionA },
                              { letter: "b", text: q.optionB },
                              { letter: "c", text: q.optionC },
                              { letter: "d", text: q.optionD },
                            ].map((opt) => {
                              const isStudent = studentAns === opt.letter;
                              const isCorrectOpt = correctAns === opt.letter;
                              return (
                                <div key={opt.letter} className={`rounded px-3 py-2 ${
                                  isCorrectOpt ? "bg-green-500/15 border border-green-500/30" : isStudent ? "bg-red-500/15 border border-red-500/30" : "bg-muted/30 border border-border"
                                }`}>
                                  <span className="font-medium uppercase">{opt.letter})</span> {opt.text}
                                  {isStudent && <span className="ml-2 text-xs text-red-400">(student)</span>}
                                  {isCorrectOpt && <span className="ml-2 text-xs text-green-400">(correct)</span>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Change correct answer:</label>
                            <select
                              value={correctedAnswers[String(q.id)] || q.correctAnswer}
                              onChange={(e) => setCorrectedAnswers(prev => ({ ...prev, [String(q.id)]: e.target.value }))}
                              className="bg-background border border-border rounded px-2 py-1 text-sm"
                            >
                              <option value="a">A</option>
                              <option value="b">B</option>
                              <option value="c">C</option>
                              <option value="d">D</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="updateKey"
                        checked={updateAnswerKey}
                        onChange={(e) => setUpdateAnswerKey(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="updateKey" className="text-sm">Also update the answer key for future students</label>
                    </div>
                    <Textarea
                      placeholder="Admin notes (optional)..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                    <Button onClick={handleRegrade} className="w-full">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Regrade Quiz
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Failed to load review details.</p>
              )}
            </DialogContent>
          </Dialog>
        )}

        {/* Quiz requests */}
        <Card className="shadow-md" ref={quizRequestsRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5" />
              Quiz Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quizRequestsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : quizRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No quiz requests yet.</p>
            ) : (
              <div className="space-y-3">
                {quizRequests.map((req) => {
                  const isPending = req.status !== "completed";
                  const studentName = req.studentName
                    || req.student?.displayName
                    || req.student?.username
                    || "Unknown student";
                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-muted/30 border border-border"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm">{req.bookTitle}</p>
                          {req.author && (
                            <p className="text-xs text-muted-foreground mt-0.5">by {req.author}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Requested by {studentName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(req.createdAt).toLocaleDateString("en-US", {
                              year: "numeric", month: "short", day: "numeric",
                            })}
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${
                          isPending ? "bg-primary/20 text-primary" : "bg-green-500/20 text-green-400"
                        }`}>
                          {isPending ? "Pending" : "Completed"}
                        </span>
                      </div>
                      {isPending && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            className="flex-1"
                            size="sm"
                            onClick={() => handleCreateQuizFromRequest(req)}
                          >
                            <PlusCircle className="w-3.5 h-3.5 mr-1" />
                            Create Quiz
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleMarkRequestComplete(req.id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Mark Complete
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schools & Classes Section */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Schools & Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Create school */}
            <div className="flex gap-2 mb-4">
              <Input
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="New school name"
                className="text-sm"
              />
              <Button onClick={handleCreateSchool} size="sm" className="bg-primary whitespace-nowrap">
                <PlusCircle className="w-4 h-4 mr-1" />
                Add School
              </Button>
            </div>

            {/* Schools list */}
            {schools.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No schools added yet. Create one above.</p>
            ) : (
              <div className="space-y-3">
                {schools.map((school: any) => (
                  <div key={school.id} className="rounded-xl border border-border p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-sm">{school.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {schoolClasses[school.id]?.length || 0} classes
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSchool(school.id, school.name)}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded"
                      >
                        Delete School
                      </button>
                    </div>

                    {/* Create class under school */}
                    <div className="flex gap-2 mb-3">
                      <Input
                        value={newClassName[school.id] || ""}
                        onChange={(e) => setNewClassName({ ...newClassName, [school.id]: e.target.value })}
                        placeholder="New class name"
                        className="h-8 text-sm"
                      />
                      <Button
                        onClick={() => handleCreateClass(school.id)}
                        size="sm"
                        className="bg-muted border border-border text-foreground hover:bg-muted/80 whitespace-nowrap h-8"
                      >
                        Add Class
                      </Button>
                    </div>

                    {/* Classes under this school */}
                    {(schoolClasses[school.id] || []).map((cls: any) => {
                      const stats = classStats[cls.id];
                      return (
                        <div key={cls.id} className="rounded-lg bg-background/50 p-3 mb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">{cls.name}</span>
                              {stats && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {stats.studentCount} students | {stats.totalPoints} pts | {stats.quizzesCompleted} quizzes
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteClass(cls.id, cls.name)}
                              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Student detail dialog */}
      <Dialog open={!!detailStudent} onOpenChange={(open) => { if (!open) { setDetailStudent(null); setStudentDetail(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {detailStudent?.displayName}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : studentDetail ? (
            <div className="space-y-4">
              {/* Student info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-primary/10">
                  <div className="text-xl font-bold text-primary">{studentDetail.totalPoints}</div>
                  <div className="text-xs text-muted-foreground">Points</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-blue-500/10">
                  <div className="text-xl font-bold text-blue-400">{studentDetail.quizzesTaken}</div>
                  <div className="text-xs text-muted-foreground">Quizzes</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-green-500/10">
                  <div className="text-xl font-bold text-green-400">{(studentDetail.totalBooks || 0) - (studentDetail.quizzesTaken || 0)}</div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                </div>
              </div>

              {/* Assign School */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <Label className="text-xs text-muted-foreground mb-2 block">Assign School</Label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                    defaultValue={detailStudent?.schoolId || ""}
                    onChange={async (e) => {
                      const schoolId = e.target.value ? parseInt(e.target.value) : null;
                      const authToken = token || getTokenFromCookie();
                      try {
                        const res = await fetch(`${API_BASE}/api/admin/students/${detailStudent.id}/assign-school`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
                          body: JSON.stringify({ schoolId }),
                        });
                        if (res.ok) {
                          setDetailStudent(prev => prev ? { ...prev, schoolId } : null);
                          fetchStudents();
                        }
                      } catch {}
                    }}
                  >
                    <option value="">No school assigned</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assign Grade */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <Label className="text-xs text-muted-foreground mb-2 block">Assign Grade Level</Label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                    defaultValue={""}
                    onChange={async (e) => {
                      const grade = e.target.value;
                      if (!grade) return;
                      const authToken = token || getTokenFromCookie();
                      try {
                        const res = await fetch(`${API_BASE}/api/admin/users/${detailStudent.id}/assign-grade`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
                          body: JSON.stringify({ grade }),
                        });
                        if (res.ok) {
                          fetchStudents();
                        }
                      } catch {}
                    }}
                  >
                    <option value="">Select grade...</option>
                    {["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((g) => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quiz history */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  Books Read & Scores
                </h4>
                {studentDetail.quizHistory?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No quizzes taken yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(studentDetail.quizHistory || []).map((q, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <div className="w-8 h-12 flex-shrink-0">
                          {q.coverUrl ? (
                            <img src={q.coverUrl} alt={q.title} className="w-full h-full object-cover rounded" />
                          ) : (
                            <div className="w-full h-full rounded bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{q.title}</p>
                          <p className="text-xs text-muted-foreground">{q.pointsValue || 10} pts</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm">{q.score}/{q.total}</div>
                          <div className="text-xs text-muted-foreground">{q.pointsEarned || q.score} pts earned</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* i-Ready Score & Reading Progress */}
              <div className="border-t border-border pt-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-1">
                  <Brain className="w-4 h-4" />
                  Reading Level & Progress
                </h4>
                {readingProgress?.profile && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <div className="text-sm font-bold text-primary">Grade {readingProgress.profile.current_level}</div>
                      <div className="text-[10px] text-muted-foreground">Current Level</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <div className="text-sm font-bold text-blue-400">Grade {readingProgress.profile.independent_level}</div>
                      <div className="text-[10px] text-muted-foreground">Independent</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <div className="text-sm font-bold text-green-400">Grade {readingProgress.profile.next_target_level}</div>
                      <div className="text-[10px] text-muted-foreground">Next Target</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <div className="text-sm font-bold text-orange-400">{readingProgress.profile.total_assessments || 0}</div>
                      <div className="text-[10px] text-muted-foreground">Assessments</div>
                    </div>
                  </div>
                )}
                {readingProgress?.history?.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {readingProgress.history.slice(0, 5).map((h: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/20">
                        <span className="truncate">{h.reading_passages?.title || "Assessment"}</span>
                        <span className="font-semibold shrink-0 ml-2">{h.score}/{h.total}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* i-Ready entry form */}
                <div className="rounded-lg border border-border p-3 bg-muted/20">
                  <div className="text-xs font-semibold mb-2 text-muted-foreground">Enter i-Ready Reading Score (bypasses initial assessment)</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <Label className="text-xs">Grade Level</Label>
                      <select
                        value={ireadyGrade}
                        onChange={(e) => setIreadyGrade(e.target.value)}
                        className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                      >
                        <option value="">Select...</option>
                        {[2, 3, 4, 5, 6, 7, 8].map((g) => (
                          <option key={g} value={g}>Grade {g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Scale Score</Label>
                      <Input type="number" placeholder="e.g. 542" value={ireadyScore} onChange={(e) => setIreadyScore(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <Label className="text-xs">Comprehension % (optional)</Label>
                      <Input type="number" placeholder="e.g. 75" value={ireadyComp} onChange={(e) => setIreadyComp(e.target.value)} className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Vocabulary % (optional)</Label>
                      <Input type="number" placeholder="e.g. 80" value={ireadyVocab} onChange={(e) => setIreadyVocab(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  {ireadyMsg && <p className="text-xs text-green-400 mb-2">{ireadyMsg}</p>}
                  <Button size="sm" onClick={handleIreadySubmit} disabled={!ireadyGrade || !ireadyScore} className="w-full">
                    <Brain className="w-3 h-3 mr-1" />
                    Save i-Ready Score
                  </Button>
                </div>
              </div>

              {/* Messages */}
              {(studentDetail.messages || []).length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Messages
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(studentDetail.messages || []).map((msg: any, i: number) => (
                      <div key={i} className={`p-2 rounded-lg text-sm ${msg.senderType === "teacher" ? "bg-primary/5" : "bg-muted/30"}`}>
                        <span className="text-xs font-semibold text-muted-foreground">{msg.senderType === "teacher" ? "Teacher" : "Student"}</span>
                        <p>{msg.messageText}</p>
                        {msg.linkUrl && <a href={msg.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Link</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Failed to load student details.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Inbox dialog — DM style */}
      <Dialog open={showInbox} onOpenChange={(open) => { setShowInbox(open); if (!open) setActiveConversationUserId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              {activeConversationUserId && (
                <button
                  onClick={() => { setActiveConversationUserId(null); setReplyText(""); setReplyLink(""); setReplySuccess(""); }}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  aria-label="Back"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <Inbox className="w-5 h-5" />
              <DialogTitle className="text-base">
                {activeConversationUserId ? "Conversation" : "Inbox"}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {activeConversationUserId && (
                <button
                  onClick={() => handleConversationSend()}
                  disabled={!replyText.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50"
                >
                  Send
                </button>
              )}
              {!activeConversationUserId && (
                <button
                  onClick={() => { setShowCompose(true); setComposeStudent(null); setComposeText(""); setComposeLink(""); setComposeSuccess(""); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 flex items-center gap-1"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  Compose
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {replySuccess && (
              <div className="mx-4 mt-3 p-2 rounded-lg bg-green-500/20 text-green-400 text-sm text-center">{replySuccess}</div>
            )}
            {/* Compose form (shown from list view) */}
            {showCompose && !activeConversationUserId && (
              <div className="m-4 p-4 rounded-xl bg-background border border-border space-y-3">
                <h4 className="font-semibold text-sm">New Message</h4>
                {composeSuccess ? (
                  <p className="text-sm text-green-400 text-center py-2">{composeSuccess}</p>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs">To (select student)</Label>
                      <select
                        value={composeStudent?.id || ""}
                        onChange={(e) => {
                          const s = students.find(s => s.id === parseInt(e.target.value));
                          setComposeStudent(s || null);
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select a student...</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.displayName} (@{s.username})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Message</Label>
                      <textarea
                        placeholder="Type your message..."
                        value={composeText}
                        onChange={(e) => setComposeText(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Optional Link URL</Label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={composeLink}
                        onChange={(e) => setComposeLink(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleComposeSend} disabled={!composeStudent || !composeText.trim()} className="flex-1">
                        <Send className="w-3 h-3 mr-1" />
                        Send Message
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowCompose(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Conversation list view */}
            {!activeConversationUserId ? (
              (() => {
                // Build conversation list from studentMsgs + sentMsgs
                const convoMap = new Map<number, { name: string; username: string; lastMsg: string; lastDate: string; unread: boolean }>();
                studentMsgs.forEach((m) => {
                  const existing = convoMap.get(m.userId);
                  if (!existing || new Date(m.createdAt) > new Date(existing.lastDate)) {
                    convoMap.set(m.userId, { name: m.studentName, username: m.studentUsername, lastMsg: m.messageText, lastDate: m.createdAt, unread: existing?.unread || !m.isRead });
                  } else if (!m.isRead) {
                    existing.unread = true;
                  }
                });
                sentMsgs.forEach((m: any) => {
                  const existing = convoMap.get(m.userId);
                  if (!existing || new Date(m.createdAt) > new Date(existing.lastDate)) {
                    convoMap.set(m.userId, { name: m.studentName, username: m.studentUsername, lastMsg: `You: ${m.messageText}`, lastDate: m.createdAt, unread: existing?.unread || false });
                  }
                });
                const convos = Array.from(convoMap.entries()).sort((a, b) => new Date(b[1].lastDate).getTime() - new Date(a[1].lastDate).getTime());
                if (convos.length === 0 && !showCompose) {
                  return <p className="text-sm text-muted-foreground text-center py-12">No conversations yet. Click Compose to start one.</p>;
                }
                return (
                  <div className="divide-y divide-border">
                    {convos.map(([userId, convo]) => (
                      <button
                        key={userId}
                        onClick={() => {
                          setActiveConversationUserId(userId);
                          setReplyText("");
                          setReplyLink("");
                          setReplySuccess("");
                          // Mark incoming messages from this student as read
                          studentMsgs.filter(m => m.userId === userId && !m.isRead).forEach(m => handleMarkMsgRead(m.id));
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                          {convo.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm truncate ${convo.unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{convo.name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{new Date(convo.lastDate).toLocaleDateString()}</span>
                          </div>
                          <p className={`text-xs truncate ${convo.unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>{convo.lastMsg}</p>
                        </div>
                        {convo.unread && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()
            ) : (
              // Conversation thread view
              (() => {
                const thread = [
                  ...studentMsgs.filter(m => m.userId === activeConversationUserId).map(m => ({ ...m, senderType: "student" as const })),
                  ...sentMsgs.filter((m: any) => m.userId === activeConversationUserId).map((m: any) => ({ ...m, senderType: "teacher" as const })),
                ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const student = students.find(s => s.id === activeConversationUserId);
                const studentName = student?.displayName || thread.find(m => m.senderType === "student")?.studentName || "Student";
                return (
                  <>
                    {/* Thread header */}
                    <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                        {studentName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{studentName}</p>
                        {student && <p className="text-xs text-muted-foreground">@{student.username}</p>}
                      </div>
                    </div>
                    {/* Messages */}
                    <div className="p-4 space-y-3">
                      {thread.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No messages in this conversation.</p>
                      ) : (
                        thread.map((msg: any) => (
                          <div key={msg.id} className={`flex ${msg.senderType === "teacher" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] p-3 rounded-2xl ${
                              msg.senderType === "teacher"
                                ? "bg-primary text-white rounded-tr-sm"
                                : "bg-muted/50 border border-border rounded-tl-sm"
                            }`}>
                              <p className={`text-sm ${msg.senderType === "teacher" ? "text-white" : "text-foreground"}`}>{msg.messageText}</p>
                              {msg.linkUrl && (
                                <a href={msg.linkUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 mt-1 text-xs hover:underline ${msg.senderType === "teacher" ? "text-white/80" : "text-primary"}`}>
                                  Open link
                                </a>
                              )}
                              <p className={`text-xs mt-1 ${msg.senderType === "teacher" ? "text-white/60" : "text-muted-foreground"}`}>
                                {new Date(msg.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {/* Reply box */}
                    <div className="px-4 py-3 border-t border-border sticky bottom-0 bg-card">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type a message..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && replyText.trim()) handleConversationSend(); }}
                          className="flex-1 px-3 py-2 rounded-full bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={handleConversationSend}
                          disabled={!replyText.trim()}
                          className="p-2 rounded-full bg-primary text-white disabled:opacity-50 hover:bg-primary/90 transition-colors"
                          aria-label="Send"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Optional link URL"
                        value={replyLink}
                        onChange={(e) => setReplyLink(e.target.value)}
                        className="w-full mt-2 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Update cover dialog */}
      <Dialog open={!!coverBook} onOpenChange={(open) => { if (!open) { setCoverBook(null); setCoverUrl(""); setCoverSuccess(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Cover for {coverBook?.title}</DialogTitle>
          </DialogHeader>
          {coverSuccess ? (
            <div className="text-center py-6">
              <p className="text-sm text-green-400 font-medium">{coverSuccess}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {coverBook?.coverUrl && (
                  <div className="w-12 h-18 flex-shrink-0">
                    <img src={coverBook.coverUrl} alt="Current cover" className="w-full h-full object-cover rounded" />
                  </div>
                )}
                {coverUrl && (
                  <div className="w-12 h-18 flex-shrink-0">
                    <img src={coverUrl} alt="New cover" className="w-full h-full object-cover rounded" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover-url">Cover Image URL</Label>
                <Input
                  id="cover-url"
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://covers.openlibrary.org/b/id/..."
                />
                <p className="text-xs text-muted-foreground">Paste a direct image URL. You can find covers on Open Library.</p>
              </div>
              <Button onClick={handleUpdateCover} disabled={!coverUrl} className="w-full">
                Update Cover
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add quiz dialog */}
      <Dialog open={showAddQuiz} onOpenChange={setShowAddQuiz}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Add New Quiz
            </DialogTitle>
          </DialogHeader>
          {quizSuccess ? (
            <div className="text-center py-8">
              <p className="text-sm text-green-400 font-medium text-lg">{quizSuccess}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {quizError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{quizError}</div>
              )}
              {pasteMsg && (
                <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/20 text-sm text-green-400">{pasteMsg}</div>
              )}

              {/* Paste AI Quiz section */}
              <div className="p-4 rounded-xl bg-muted border border-primary/20">
                <Label htmlFor="paste-quiz" className="flex items-center gap-1.5 font-semibold text-sm mb-2">
                  <ClipboardPaste className="w-4 h-4 text-primary" />
                  Paste AI-Generated Quiz
                </Label>
                <Textarea
                  id="paste-quiz"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`1. What is the main character's name?\nA) Option one\nB) Option two\nC) Option three\nD) Option four\nAnswer: B\n\n2. Next question...`}
                  rows={6}
                  className="text-sm font-mono"
                />
                <div className="flex gap-2 mt-2">
                  <Button onClick={handleParsePaste} size="sm" variant="default">
                    <ClipboardPaste className="w-3.5 h-3.5 mr-1" />
                    Parse
                  </Button>
                  <Button onClick={handleCopyPrompt} size="sm" variant="outline">
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy AI Prompt
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Paste AI-generated quiz text or JSON. Parser fills the 10-question editor below.
                </p>
              </div>

              {/* Book info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="q-title">Book Title *</Label>
                  <Input id="q-title" value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} placeholder="Book title" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-author">Author *</Label>
                  <Input id="q-author" value={quizForm.author} onChange={(e) => setQuizForm({ ...quizForm, author: e.target.value })} placeholder="Author" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-points">Points Value *</Label>
                  <select id="q-points" value={quizForm.pointsValue} onChange={(e) => setQuizForm({ ...quizForm, pointsValue: parseInt(e.target.value) })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value={10}>10 pts (Easy)</option>
                    <option value={20}>20 pts (Medium)</option>
                    <option value={30}>30 pts (Hard)</option>
                  </select>
                </div>
              </div>
              {/* Grade Band Suggestion */}
              <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Grade Band</Label>
                  <button type="button" onClick={handleSuggestBand} disabled={bandSuggesting || !quizForm.title.trim()} className="text-xs px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {bandSuggesting ? "Suggesting..." : "Suggest Band"}
                  </button>
                </div>
                {bandSuggestion && (
                  <p className="text-xs text-green-400">Suggested: <span className="font-semibold">{bandSuggestion}</span></p>
                )}
                <div className="flex gap-2">
                  {["K-2", "3-5", "6-8", "9-12"].map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => { setQuizGradeBand(b); setBandSuggestion(b); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${quizGradeBand === b ? "bg-primary text-primary-foreground" : "bg-muted text-white hover:bg-muted/80"}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Selects which grade bands see this book in their library.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="q-cover">Cover URL</Label>
                  <Input id="q-cover" value={quizForm.coverUrl} onChange={(e) => setQuizForm({ ...quizForm, coverUrl: e.target.value })} placeholder="https://..." />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-read">Read URL (optional)</Label>
                  <Input id="q-read" value={quizForm.readUrl} onChange={(e) => setQuizForm({ ...quizForm, readUrl: e.target.value })} placeholder="https://... (reading page link)" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="q-desc">Description</Label>
                <Textarea id="q-desc" value={quizForm.description} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} placeholder="Brief description" rows={2} />
              </div>

              {/* Questions */}
              <div className="border-t pt-4">
                <p className="font-semibold text-sm mb-3">10 Questions (each with 4 options + correct answer)</p>
                <div className="space-y-4">
                  {questions.map((q, qi) => (
                    <div key={qi} className="p-3 rounded-xl bg-muted/20 border border-border space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{qi + 1}</span>
                        <Input value={q.question} onChange={(e) => {
                          const newQs = [...questions];
                          newQs[qi] = { ...q, question: e.target.value };
                          setQuestions(newQs);
                        }} placeholder="Question text" className="h-8 text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const newQs = [...questions];
                                newQs[qi] = { ...q, correct: ["A", "B", "C", "D"][oi] };
                                setQuestions(newQs);
                              }}
                              className={`w-6 h-6 rounded text-xs font-bold flex-shrink-0 flex items-center justify-center ${
                                q.correct === ["A", "B", "C", "D"][oi]
                                  ? "bg-green-500 text-white"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                              title="Mark as correct answer"
                            >
                              {["A", "B", "C", "D"][oi]}
                            </button>
                            <Input value={opt} onChange={(e) => {
                              const newQs = [...questions];
                              const newOpts = [...q.options];
                              newOpts[oi] = e.target.value;
                              newQs[qi] = { ...q, options: newOpts };
                              setQuestions(newQs);
                            }} placeholder={`Option ${["A", "B", "C", "D"][oi]}`} className="h-8 text-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleAddQuiz} className="w-full bg-primary">
                <PlusCircle className="w-4 h-4 mr-1" />
                Create Quiz
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
