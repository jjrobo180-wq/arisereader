import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { safeBack } from "@/lib/navigation";
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
import TheaterAdmin from "@/components/TheaterAdmin";
import UnlistedSignupsCard from "@/components/UnlistedSignupsCard";
import SchoolUsListMatch from "@/components/SchoolUsListMatch";
import NoProctorReview from "@/components/NoProctorReview";
import ArchivedProfilesCard from "@/components/ArchivedProfilesCard";
import AdminPlans from "@/components/AdminPlans";
import PlayTimeManager from "@/components/PlayTimeManager";
import StudentActivity from "@/components/StudentActivity";
import { printParentInvites } from "@/lib/parentInvites";
import {
  ArrowLeft, Users, KeyRound, Send, Trophy, BookOpen,
  Eye, PlusCircle, ImagePlus, Mail, Inbox, X, ClipboardPaste, Copy, LogOut,
  MessageSquarePlus, CheckCircle2, Search, ChevronDown, ChevronLeft, ChevronRight, Building, FileQuestion, FileSearch, RotateCcw, Brain, Trash2, BarChart3, Gift, Check, ShieldCheck, Printer, Clock3, Archive
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
    proctorType?: "parent" | "teacher" | null;
    proctorUserId?: number | null;
    proctorName?: string | null;
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
  const { user, token, logout, startAdminPreview } = useAuth();
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
  const [pointsStudent, setPointsStudent] = useState<Student | null>(null);
  const [manualPoints, setManualPoints] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  // award dialog: a paper book quiz (counts like an online quiz) or other points
  const [awardMode, setAwardMode] = useState<"quiz" | "points">("quiz");
  const [quizBookSearch, setQuizBookSearch] = useState("");
  const [quizBookId, setQuizBookId] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState("");
  const [quizTotal, setQuizTotal] = useState("");
  const [awardNotice, setAwardNotice] = useState("");
  const [activityKey, setActivityKey] = useState(0);
  const [manualHistory, setManualHistory] = useState<any[]>([]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [messageStudent, setMessageStudent] = useState<Student | null>(null);
  const [messageText, setMessageText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  // Reward state
  const [rewardStudent, setRewardStudent] = useState<Student | null>(null);
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardMessage, setRewardMessage] = useState("");
  const [rewardQuizCount, setRewardQuizCount] = useState("");
  const [rewardExpiresAt, setRewardExpiresAt] = useState("");
  const [rewardList, setRewardList] = useState<any[]>([]);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardSuccess, setRewardSuccess] = useState("");
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
  // AI Quiz Review state
  const [pendingQuizzes, setPendingQuizzes] = useState<any[]>([]);
  const [expandedQuiz, setExpandedQuiz] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingQuizId, setRejectingQuizId] = useState<number | null>(null);
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
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiKeyPreview, setAiKeyPreview] = useState("");
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);
  const [aiKeyMsg, setAiKeyMsg] = useState("");
  const [quizGuidelines, setQuizGuidelines] = useState("");
  const [eyeGazeGuidelines, setEyeGazeGuidelines] = useState("");
  const [guidelinesMsg, setGuidelinesMsg] = useState("");
  const [eyeGazeGuidelinesMsg, setEyeGazeGuidelinesMsg] = useState("");
  const [proctorPassword, setProctorPassword] = useState("");
  const [newProctorPassword, setNewProctorPassword] = useState("");
  const [proctorMsg, setProctorMsg] = useState("");
  const [clubClosingHours, setClubClosingHours] = useState({
    enabled: false,
    start: "21:00",
    end: "07:00",
    days: [0,1,2,3,4,5,6] as number[],
    timeZone: "America/Denver",
    closedNow: false,
  });
  const [clubClosingMsg, setClubClosingMsg] = useState("");
  const [clubClosingSaving, setClubClosingSaving] = useState(false);
  const [teacherClubClosingHours, setTeacherClubClosingHours] = useState<any[]>([]);
  const [teacherClubClosingSavingId, setTeacherClubClosingSavingId] = useState<number | null>(null);
  const [teacherClubClosingMsg, setTeacherClubClosingMsg] = useState("");
  const [easterEggs, setEasterEggs] = useState({ active: false, totalEggs: 0, remainingEggs: 0, pointsPerEgg: 2, claims: [] as any[] });
  const [eggCount, setEggCount] = useState(0);
  const [eggMsg, setEggMsg] = useState("");
  // Competition settings state
  const [compSettings, setCompSettings] = useState({
    monthlyCountdownDate: "",
    yearlyCountdownDate: "",
  });
  const [compMsg, setCompMsg] = useState("");
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
  const [bookPage, setBookPage] = useState(0);
  const BOOKS_PER_PAGE = 24;
  const [clubSignups, setClubSignups] = useState<any[]>([]);
  // Quiz review requests state
  const [reviewRequests, setReviewRequests] = useState<any[]>([]);
  const [reviewRequestsLoading, setReviewRequestsLoading] = useState(false);
  // Eye gaze requests state
  const [eyeGazeRequests, setEyeGazeRequests] = useState<any[]>([]);
  // Admin leaderboard state
  const [adminLeaderboard, setAdminLeaderboard] = useState<any[]>([]);
  const [adminLbLoading, setAdminLbLoading] = useState(false);
  const [adminLbBand, setAdminLbBand] = useState("");
  const [adminLbPrintCount, setAdminLbPrintCount] = useState("10");
  const [adminLbPosterTitle, setAdminLbPosterTitle] = useState("READING CHAMPIONS");
  const [adminLbPosterMessage, setAdminLbPosterMessage] = useState("Celebrating the readers who rose to the top!");
  const [adminLbRewards, setAdminLbRewards] = useState<Record<string, string>>({});
  const [activeReview, setActiveReview] = useState<any>(null);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [reviewDetailLoading, setReviewDetailLoading] = useState(false);
  const [correctedAnswers, setCorrectedAnswers] = useState<Record<string, string>>({});
  const [updateAnswerKey, setUpdateAnswerKey] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [manualReviewScore, setManualReviewScore] = useState("");
  const [regradeMsg, setRegradeMsg] = useState("");
  const [regradeBusy, setRegradeBusy] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  // i-Ready score state
  const [ireadyGrade, setIreadyGrade] = useState("");
  const [ireadyScore, setIreadyScore] = useState("");
  const [ireadyComp, setIreadyComp] = useState("");
  const [ireadyVocab, setIreadyVocab] = useState("");
  const [ireadyMsg, setIreadyMsg] = useState("");
  const [readingProgress, setReadingProgress] = useState<any>(null);
  // Growth Check state
  const [growthCheckWindows, setGrowthCheckWindows] = useState<any[]>([]);
  const [growthCheckForms, setGrowthCheckForms] = useState<any[]>([]);
  const [growthCheckOverview, setGrowthCheckOverview] = useState<any[]>([]);
  const [growthCheckLoading, setGrowthCheckLoading] = useState(true);
  const [growthCheckAssignBand, setGrowthCheckAssignBand] = useState("3-5");
  const [growthCheckSaving, setGrowthCheckSaving] = useState(false);
  const [growthCheckSuccess, setGrowthCheckSuccess] = useState("");
  const [growthCheckError, setGrowthCheckError] = useState("");

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

  const handleNotifNavigate = (type: "request" | "user" | "teacher" | "parent" | "message" | "ai_quiz", id: number) => {
    if (type === "request") {
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
      teachersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (type === "parent") {
      document.querySelector('[data-section="pending-parent-approvals"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (type === "ai_quiz") {
      document.querySelector('[data-section="ai-quiz-review"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (type === "message") {
      fetchStudentMsgs();
      fetchSentMsgs();
      fetchUnreadMsgCount();
      setShowInbox(true);
    } else {
      studentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Action notifications stay visible until the task is actually resolved.
    window.setTimeout(() => setNotifRefreshKey(k => k + 1), 250);
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
    fetchAiSettings();
    fetchProctorPassword();
    fetchClubClosingHours();
    fetchTeacherClubClosingHours();
    fetchEasterEggs();
    fetchCompetitionSettings();
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

  // Fetch pending AI quizzes on mount
  useEffect(() => {
    const fetchPendingQuizzes = async () => {
      const authToken = token || getTokenFromCookie();
      if (!authToken) return;
      try {
        const res = await fetch(`${API_BASE}/api/admin/pending-quizzes`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (res.ok) {
          const data = await res.json();
          setPendingQuizzes(data.pending || []);
        }
      } catch {}
    };
    fetchPendingQuizzes();

    // Fetch club sign-ups
    const fetchClubSignups = async () => {
      const authToken = token || getTokenFromCookie();
      if (!authToken) return;
      try {
        const res = await fetch(`${API_BASE}/api/admin/club-signups`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (res.ok) {
          const data = await res.json();
          setClubSignups(data.signups || []);
        }
      } catch {}
    };
    fetchClubSignups();
  }, []);

  const handleApproveQuiz = async (quizId: number) => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/pending-quizzes/${quizId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setPendingQuizzes(prev => prev.filter(q => q.id !== quizId));
        setExpandedQuiz(null);
      }
    } catch {}
  };

  const handleRejectQuiz = async (quizId: number) => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/pending-quizzes/${quizId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        setPendingQuizzes(prev => prev.filter(q => q.id !== quizId));
        setExpandedQuiz(null);
        setRejectingQuizId(null);
        setRejectReason("");
      }
    } catch {}
  };

  // Growth Check — fetch benchmark windows, forms, and overview on mount
  useEffect(() => {
    const fetchGrowthCheck = async () => {
      const authToken = token || getTokenFromCookie();
      if (!authToken) { setGrowthCheckLoading(false); return; }
      try {
        const [winRes, formRes, overviewRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/growth-check/windows`, { headers: { Authorization: `Bearer ${authToken}` } }),
          fetch(`${API_BASE}/api/admin/growth-check/forms`, { headers: { Authorization: `Bearer ${authToken}` } }),
          fetch(`${API_BASE}/api/teacher/growth-check/overview`, { headers: { Authorization: `Bearer ${authToken}` } }),
        ]);
        if (winRes.ok) { const d = await winRes.json(); setGrowthCheckWindows(Array.isArray(d) ? d : (d.windows || [])); }
        if (formRes.ok) { const d = await formRes.json(); setGrowthCheckForms(Array.isArray(d) ? d : (d.forms || [])); }
        if (overviewRes.ok) { const d = await overviewRes.json(); setGrowthCheckOverview(Array.isArray(d) ? d : (d.attempts || d.overview || [])); }
      } catch (err) {
        console.error("Failed to fetch Growth Check data:", err);
      } finally {
        setGrowthCheckLoading(false);
      }
    };
    fetchGrowthCheck();
  }, [token]);

  // Save (create/update) a benchmark window
  const handleSaveGrowthCheckWindow = async (window: any) => {
    setGrowthCheckSaving(true);
    setGrowthCheckSuccess("");
    setGrowthCheckError("");
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/admin/growth-check/windows`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(window),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to save window"); }
      const updated = await res.json();
      setGrowthCheckWindows(prev => {
        const idx = prev.findIndex(w => w.id === updated.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
        return [...prev, updated];
      });
      setGrowthCheckSuccess("Window updated successfully!");
      setTimeout(() => setGrowthCheckSuccess(""), 3000);
    } catch (err: any) {
      setGrowthCheckError(err.message || "Failed to save window");
    } finally {
      setGrowthCheckSaving(false);
    }
  };

  // Assign Growth Check to all students in a grade band
  const handleAssignGrowthCheckAll = async () => {
    setGrowthCheckSaving(true);
    setGrowthCheckSuccess("");
    setGrowthCheckError("");
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/admin/growth-check/assign-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ gradeBand: growthCheckAssignBand }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to assign"); }
      const data = await res.json();
      setGrowthCheckSuccess(`Assigned to ${data.assigned || data.count || "all"} students!`);
      setTimeout(() => setGrowthCheckSuccess(""), 4000);
    } catch (err: any) {
      setGrowthCheckError(err.message || "Failed to assign");
    } finally {
      setGrowthCheckSaving(false);
    }
  };

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

  const fetchAiSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAiKeyConfigured(data.configured);
        setAiKeyPreview(data.keyPreview || "");
        setQuizGuidelines(data.guidelines || "");
        setEyeGazeGuidelines(data.eyeGazeGuidelines || "");
      }
    } catch {}
  };

  const handleSaveAiKey = async () => {
    if (!token || !aiApiKey.trim()) return;
    setAiKeyMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-settings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ perplexityApiKey: aiApiKey.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiKeyMsg("API key saved! Instant AI Quiz is now ready.");
        setAiApiKey("");
        fetchAiSettings();
        setTimeout(() => setAiKeyMsg(""), 4000);
      } else {
        setAiKeyMsg(data.message || "Failed to save API key.");
      }
    } catch {
      setAiKeyMsg("Failed to save API key.");
    }
  };

  const handleSaveGuidelines = async () => {
    if (!token) return;
    setGuidelinesMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/quiz-guidelines`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ guidelines: quizGuidelines }),
      });
      const data = await res.json();
      if (res.ok) {
        setGuidelinesMsg("Guidelines saved! All new AI quizzes will follow these.");
        setTimeout(() => setGuidelinesMsg(""), 4000);
      } else {
        setGuidelinesMsg(data.message || "Failed to save guidelines.");
      }
    } catch {
      setGuidelinesMsg("Failed to save guidelines.");
    }
  };

  const handleSaveEyeGazeGuidelines = async () => {
    if (!token) return;
    setEyeGazeGuidelinesMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/eye-gaze-guidelines`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ guidelines: eyeGazeGuidelines }),
      });
      const data = await res.json();
      if (res.ok) {
        setEyeGazeGuidelinesMsg("Eye gaze guidelines saved! All new eye gaze quizzes will follow these.");
        setTimeout(() => setEyeGazeGuidelinesMsg(""), 4000);
      } else {
        setEyeGazeGuidelinesMsg(data.message || "Failed to save guidelines.");
      }
    } catch {
      setEyeGazeGuidelinesMsg("Failed to save guidelines.");
    }
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

  const fetchTeacherClubClosingHours = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/teacher-club-closing-hours`, { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTeacherClubClosingHours(Array.isArray(data?.teachers) ? data.teachers : []);
      }
    } catch {}
  };

  const saveTeacherClubClosingHours = async (teacherId: number) => {
    const authToken = token || getTokenFromCookie();
    const row = teacherClubClosingHours.find((item:any) => item.id === teacherId);
    if (!authToken || !row) return;
    setTeacherClubClosingSavingId(teacherId);
    setTeacherClubClosingMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/teacher-club-closing-hours/${teacherId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(row.schedule),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setTeacherClubClosingMsg(data.message || "Could not override class hours."); return; }
      setTeacherClubClosingHours(items => items.map((item:any) => item.id === teacherId ? { ...item, schedule: data.schedule } : item));
      setTeacherClubClosingMsg("Teacher class hours overridden.");
      setTimeout(() => setTeacherClubClosingMsg(""), 3000);
    } catch {
      setTeacherClubClosingMsg("Could not override class hours.");
    } finally { setTeacherClubClosingSavingId(null); }
  };

  const fetchClubClosingHours = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/club-closing-hours`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setClubClosingHours(prev => ({ ...prev, ...data }));
      }
    } catch {}
  };

  const handleSaveClubClosingHours = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    setClubClosingSaving(true);
    setClubClosingMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/club-closing-hours`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(clubClosingHours),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setClubClosingMsg(data.message || "Could not save Club closing hours.");
        return;
      }
      setClubClosingHours(prev => ({ ...prev, ...data }));
      setClubClosingMsg("Club closing hours saved.");
      setTimeout(() => setClubClosingMsg(""), 3500);
    } catch {
      setClubClosingMsg("Could not save Club closing hours.");
    } finally {
      setClubClosingSaving(false);
    }
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

  // === Competition Settings ===
  const fetchCompetitionSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/competition-settings`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setCompSettings({
            monthlyCountdownDate: data.settings.monthlyCountdownDate || "",
            yearlyCountdownDate: data.settings.yearlyCountdownDate || "",
          });
        }
      }
    } catch {}
  };

  const handleSaveCompSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/competition-settings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify(compSettings),
      });
      const data = await res.json();
      if (res.ok) {
        setCompMsg("Competition settings saved!");
        setTimeout(() => setCompMsg(""), 3000);
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
    if (!confirm(`Delete ${parentName}'s account for good? This can't be undone.\n\nTo hide the account without deleting anything, use Archive instead.`)) return;
    if (await handleDeleteUser(parentId, parentName)) {
      fetchAllParents();
      fetchPendingParents();
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

  const printAdminLeaderboard = () => {
    if (!adminLeaderboard.length) return;
    const requestedCount = adminLbPrintCount === "all" ? adminLeaderboard.length : Math.max(1, Number(adminLbPrintCount) || 10);
    const leaders = adminLeaderboard.slice(0, requestedCount);
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      alert("Please allow pop-ups so the leaderboard poster preview can open.");
      return;
    }

    const escapeHtml = (value: any) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const bandLabel = adminLbBand ? adminLbBand + " BAND" : "ALL READING BANDS";
    const listLabel = adminLbPrintCount === "all" ? "FULL LEADERBOARD" : "TOP " + leaders.length + " READERS";
    const printedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const placeWords = ["1ST PLACE", "2ND PLACE", "3RD PLACE"];
    const placeIcons = ["1", "2", "3"];
    const topThree = leaders.slice(0, 3).map((entry: any, idx: number) => {
      const rank = idx + 1;
      const detail = [entry.grade ? "Grade " + escapeHtml(entry.grade) : "", entry.schoolName ? escapeHtml(entry.schoolName) : ""].filter(Boolean).join(" • ");
      const reward = (adminLbRewards[String(entry.id ?? rank)] || "").trim();
      return `<article class="champ-card place-${rank}">
        <div class="place-badge"><span>${placeIcons[idx]}</span> ${placeWords[idx]}</div>
        <div class="champ-name">${escapeHtml(entry.displayName || "Reader")}</div>
        <div class="champ-meta">${detail || "A.R.I.S.E. Reader"}</div>
        <div class="score-row"><div><b>${Number(entry.totalPoints || 0).toLocaleString()}</b><span>POINTS</span></div><div><b>${Number(entry.quizzesTaken || 0)}</b><span>QUIZZES</span></div></div>
        ${reward ? `<div class="reward"><span>REWARD</span><strong>${escapeHtml(reward)}</strong></div>` : ""}
      </article>`;
    }).join("");

    const remainingRows = leaders.slice(3).map((entry: any, offset: number) => {
      const rank = offset + 4;
      const studentDetail = [entry.grade ? "Grade " + escapeHtml(entry.grade) : "", entry.schoolName ? escapeHtml(entry.schoolName) : ""].filter(Boolean).join(" • ");
      const reward = (adminLbRewards[String(entry.id ?? rank)] || "").trim();
      return `<div class="standing-row">
        <div class="rank-bubble">#${rank}</div>
        <div class="standing-reader"><strong>${escapeHtml(entry.displayName || "Reader")}</strong><small>${studentDetail || "A.R.I.S.E. Reader"}</small></div>
        <div class="standing-stat"><b>${Number(entry.quizzesTaken || 0)}</b><span>QUIZZES</span></div>
        <div class="standing-stat points"><b>${Number(entry.totalPoints || 0).toLocaleString()}</b><span>POINTS</span></div>
        <div class="standing-reward"><span>REWARD</span><strong>${reward ? escapeHtml(reward) : "—"}</strong></div>
      </div>`;
    }).join("");

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>A.R.I.S.E. Reader Hallway Leaderboard</title>
<style>
  @page { size: Letter portrait; margin: 0.28in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #101828; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .poster { position: relative; width: 100%; min-height: 10.2in; overflow: hidden; border: 2px solid #111827; background:
    radial-gradient(circle at 8% 88%, rgba(124,58,237,.07), transparent 20%),
    radial-gradient(circle at 94% 78%, rgba(14,165,233,.08), transparent 22%),
    linear-gradient(180deg,#ffffff 0%,#fbfcff 100%); }
  .top-stripe { height: 10px; background: linear-gradient(90deg,#f4b400 0 20%,#7c3aed 20% 40%,#0ea5e9 40% 60%,#22c55e 60% 80%,#f97316 80% 100%); }
  .hero { position: relative; overflow: hidden; padding: 26px 30px 25px; text-align: center; color: #ffffff;
    background:
      radial-gradient(circle at 15% 15%,rgba(124,58,237,.46),transparent 31%),
      radial-gradient(circle at 88% 10%,rgba(14,165,233,.34),transparent 30%),
      linear-gradient(135deg,#070b14 0%,#111827 52%,#172554 100%);
    border-bottom: 5px solid #f4b400; }
  .hero:before { content:""; position:absolute; width:250px; height:250px; border:1px solid rgba(255,255,255,.10); border-radius:50%; left:-145px; top:-140px; }
  .hero:after { content:""; position:absolute; width:300px; height:300px; border:1px solid rgba(255,255,255,.08); border-radius:50%; right:-170px; bottom:-210px; }
  .confetti { position:absolute; inset:0; pointer-events:none; }
  .confetti i { position:absolute; display:block; width:7px; height:7px; border-radius:50%; background:#f4b400; box-shadow:0 0 12px rgba(244,180,0,.7); opacity:.8; }
  .confetti i:nth-child(1){left:7%;top:28%}.confetti i:nth-child(2){left:16%;top:72%;background:#38bdf8}.confetti i:nth-child(3){left:28%;top:14%;background:#a78bfa}.confetti i:nth-child(4){right:8%;top:26%;background:#34d399}.confetti i:nth-child(5){right:18%;top:70%;background:#f4b400}.confetti i:nth-child(6){right:30%;top:13%;background:#fb7185}
  .brand { position:relative; z-index:2; display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; background:#f4b400; color:#111827; font-size:9px; font-weight:1000; letter-spacing:2px; box-shadow:0 4px 18px rgba(244,180,0,.24); }
  h1 { position:relative; z-index:2; margin:10px auto 5px; max-width:760px; font-size:40px; line-height:.95; letter-spacing:-1.5px; font-weight:1000; text-transform:uppercase; text-shadow:0 3px 18px rgba(0,0,0,.35); }
  .message { position:relative; z-index:2; margin:8px auto 0; max-width:650px; color:#dbeafe; font-size:13px; line-height:1.45; font-weight:700; }
  .hero-meta { position:relative; z-index:2; display:flex; justify-content:center; gap:7px; flex-wrap:wrap; margin-top:14px; }
  .pill { padding:5px 10px; border:1px solid rgba(255,255,255,.24); border-radius:999px; background:rgba(255,255,255,.09); color:#ffffff; font-size:7px; font-weight:900; letter-spacing:.8px; }
  .champions-label { margin:17px 18px 9px; display:flex; align-items:center; gap:10px; font-size:10px; font-weight:1000; letter-spacing:1.9px; color:#7c3aed; text-transform:uppercase; }
  .champions-label:before,.champions-label:after { content:""; height:3px; flex:1; border-radius:99px; background:linear-gradient(90deg,transparent,#f4b400,#7c3aed); }
  .champions-label:after { background:linear-gradient(90deg,#7c3aed,#0ea5e9,transparent); }
  .podium { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:0 14px; align-items:stretch; }
  .champ-card { position:relative; overflow:hidden; min-height:198px; padding:15px 11px 13px; border:2px solid #d8dee7; border-radius:16px; text-align:center; break-inside:avoid; background:#ffffff; box-shadow:0 6px 0 rgba(17,24,39,.08); }
  .champ-card:before { content:"★"; position:absolute; right:10px; top:5px; font-size:40px; line-height:1; color:rgba(17,24,39,.06); transform:rotate(9deg); }
  .champ-card:after { content:""; position:absolute; left:-10%; right:-10%; bottom:-47px; height:74px; border-radius:50%; opacity:.13; }
  .place-1 { border-color:#e8b20f; background:linear-gradient(180deg,#fff7cc 0%,#ffffff 58%); box-shadow:0 7px 0 #e8b20f; transform:translateY(-4px); }
  .place-1:after{background:#f4b400}.place-2 { border-color:#9aa5b1; background:linear-gradient(180deg,#f4f6f8 0%,#ffffff 60%); box-shadow:0 6px 0 #9aa5b1; }.place-2:after{background:#94a3b8}.place-3 { border-color:#d97706; background:linear-gradient(180deg,#fff0dc 0%,#ffffff 60%); box-shadow:0 6px 0 #d97706; }.place-3:after{background:#d97706}
  .place-badge { position:relative; z-index:2; display:inline-flex; align-items:center; gap:4px; padding:5px 9px; border-radius:999px; background:#111827; color:#fff; font-size:8px; font-weight:1000; letter-spacing:.8px; }
  .place-1 .place-badge { background:#9a6a00; } .place-2 .place-badge { background:#475467; } .place-3 .place-badge { background:#a45111; }
  .champ-name { position:relative; z-index:2; margin-top:12px; min-height:38px; display:flex; align-items:center; justify-content:center; font-size:19px; line-height:1.02; font-weight:1000; letter-spacing:-.45px; color:#111827; }
  .champ-meta { position:relative; z-index:2; margin-top:4px; min-height:12px; font-size:8px; font-weight:700; color:#667085; }
  .score-row { position:relative; z-index:2; display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:11px; }
  .score-row div { padding:8px 4px; border-radius:10px; background:rgba(255,255,255,.82); border:1px solid rgba(17,24,39,.10); }
  .score-row b { display:block; font-size:18px; line-height:1; color:#111827; }
  .score-row span { display:block; margin-top:3px; font-size:6px; font-weight:1000; letter-spacing:1px; color:#667085; }
  .reward { position:relative; z-index:2; margin-top:9px; padding:8px; border-radius:10px; background:#111827; color:#ffffff; }
  .reward span { display:block; color:#facc15; font-size:7px; font-weight:1000; letter-spacing:1.2px; }
  .reward strong { display:block; margin-top:2px; font-size:10px; line-height:1.15; }
  .standings { padding:0 14px 5px; }
  .standings-title { display:flex; justify-content:space-between; align-items:end; margin:17px 2px 7px; border-bottom:2px solid #111827; padding-bottom:6px; }
  .standings-title h2 { margin:0; font-size:14px; font-weight:1000; text-transform:uppercase; letter-spacing:.4px; }
  .standings-title span { font-size:7px; color:#7c3aed; font-weight:900; letter-spacing:.8px; }
  .standing-row { position:relative; display:grid; grid-template-columns:42px minmax(0,1fr) 58px 72px minmax(105px,145px); align-items:center; gap:7px; margin-bottom:6px; padding:7px 9px; border:1px solid #e3e8ef; border-radius:10px; background:#ffffff; break-inside:avoid; overflow:hidden; }
  .standing-row:nth-child(even) { background:#f8fafc; }
  .standing-row:before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:linear-gradient(180deg,#7c3aed,#0ea5e9); }
  .rank-bubble { width:31px;height:31px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#111827;color:#facc15;font-size:10px;font-weight:1000; box-shadow:0 2px 0 #f4b400; }
  .standing-reader strong { display:block; font-size:10px; color:#111827; } .standing-reader small { display:block; margin-top:2px; color:#667085; font-size:7px; }
  .standing-stat { text-align:center; border-left:1px solid #e7ebf0; } .standing-stat b { display:block; font-size:10px; color:#111827; } .standing-stat span { display:block; font-size:6px; color:#667085; font-weight:900; letter-spacing:.7px; }
  .standing-stat.points b { color:#7c3aed; }
  .standing-reward { border-left:1px solid #e7ebf0; padding-left:8px; min-width:0; }
  .standing-reward span { display:block; font-size:6px; color:#9a6a00; font-weight:1000; letter-spacing:.7px; }
  .standing-reward strong { display:block; margin-top:2px; font-size:8px; line-height:1.15; color:#111827; overflow-wrap:anywhere; }
  .footer { margin:12px 0 0; padding:10px 14px 11px; background:#111827; display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:7px; color:#cbd5e1; }
  .footer strong { color:#ffffff; font-size:9px; letter-spacing:1px; } .rise { font-weight:1000; color:#facc15; letter-spacing:.4px; }
  @media print { body { background:#fff; } .poster { page-break-after:avoid; } }
</style></head>
<body><main class="poster">
  <div class="top-stripe"></div>
  <section class="hero">
    <div class="confetti"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="brand">A.R.I.S.E. READER</div>
    <h1>${escapeHtml(adminLbPosterTitle || "READING CHAMPIONS")}</h1>
    <div class="message">${escapeHtml(adminLbPosterMessage || "Celebrating the readers who rose to the top!")}</div>
    <div class="hero-meta"><span class="pill">${escapeHtml(listLabel)}</span><span class="pill">${escapeHtml(bandLabel)}</span><span class="pill">${escapeHtml(printedOn)}</span></div>
  </section>
  <div class="champions-label">TOP READERS</div>
  <section class="podium">${topThree}</section>
  ${remainingRows ? `<section class="standings"><div class="standings-title"><h2>Reader Standings</h2><span>CURRENT RESULTS</span></div>${remainingRows}</section>` : ""}
  <footer class="footer"><strong>A.R.I.S.E. READER</strong><span class="rise">READ • LEARN • EARN • PLAY • GROW</span><span>Keep reading. Keep rising.</span></footer>
</main></body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => setTimeout(() => { printWindow.focus(); printWindow.print(); }, 150);
  };

  const openManualPoints = async (student: Student) => {
    setPointsStudent(student);
    setManualPoints("");
    setManualReason("");
    setManualError("");
    setAwardMode("quiz"); setQuizBookSearch(""); setQuizBookId(null); setQuizScore(""); setQuizTotal(""); setAwardNotice("");
    setManualDate(new Date().toLocaleDateString("en-CA"));
    if (!books.length) fetchBooks();
    setManualHistory([]);
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${student.id}/manual-points`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setManualHistory(await res.json());
      else setManualError("Could not load point history.");
    } catch { setManualError("Could not load point history."); }
  };

  const awardManualPoints = async () => {
    if (!pointsStudent || manualSaving) return;
    const points = Number(manualPoints);
    if (!Number.isSafeInteger(points) || points < 1 || points > 1000 || manualReason.trim().length < 3 || !manualDate) {
      setManualError("Enter 1–1000 whole points, a reason, and the date earned.");
      return;
    }
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    if (!window.confirm(`Award ${points} points to ${pointsStudent.displayName} for ${manualReason.trim()}?`)) return;
    setManualSaving(true);
    setManualError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${pointsStudent.id}/manual-points`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ points, reason: manualReason.trim(), earnedOn: manualDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not award points.");
      setManualHistory(prev => [data, ...prev]);
      setManualPoints("");
      setManualReason("");
      setActivityKey(k => k + 1);
      refreshOpenDetail();
      await fetchStudents();
      fetchAdminLeaderboard();
    } catch (error: any) { setManualError(error.message || "Could not award points."); }
    finally { setManualSaving(false); }
  };

  // keeps the open student's totals and quiz list current after adding points
  const refreshOpenDetail = async () => {
    if (!detailStudent) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${detailStudent.id}`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      if (res.ok) setStudentDetail(await res.json());
    } catch { /* keep what's shown */ }
  };

  const creditBookQuiz = async () => {
    if (!pointsStudent || manualSaving) return;
    const score = Number(quizScore), total = Number(quizTotal);
    const book = books.find(b => b.id === quizBookId);
    if (!book) { setManualError("Choose the book the quiz was for."); return; }
    if (!Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(score) || score < 0 || score > total) { setManualError("Enter how many they got right and how many questions there were."); return; }
    if (!manualDate) { setManualError("Enter the date the quiz was taken."); return; }
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    if (!window.confirm(`Save ${score}/${total} on the ${book.title} quiz for ${pointsStudent.displayName}?`)) return;
    setManualSaving(true); setManualError(""); setAwardNotice("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${pointsStudent.id}/book-quiz-credit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, score, total, takenOn: manualDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not save the quiz.");
      setAwardNotice(data.message);
      refreshOpenDetail();
      setQuizBookId(null); setQuizBookSearch(""); setQuizScore(""); setQuizTotal("");
      setActivityKey(k => k + 1);
      await fetchStudents();
      fetchAdminLeaderboard();
    } catch (error: any) { setManualError(error.message || "Could not save the quiz."); }
    finally { setManualSaving(false); }
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
  const [archiveRefresh, setArchiveRefresh] = useState(0);
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

  /** Takes a profile out of every list on this page (after it's deleted or archived). */
  const dropFromLists = (userId: number) => {
    setPendingTeachers(prev => prev.filter((t) => t.id !== userId));
    setAllTeachers(prev => prev.filter((t) => t.id !== userId));
    setStudents(prev => prev.filter((s) => s.id !== userId));
    setAllParents(prev => prev.filter((p: any) => p.id !== userId));
  };

  /** Deletes a profile for good (the caller asks first). Returns true when it's gone. */
  const handleDeleteUser = async (userId: number, name = "This profile"): Promise<boolean> => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return false;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        dropFromLists(userId);
        return true;
      }
      if (res.status === 409) {
        // Something still points at the profile: offer to archive it instead.
        if (window.confirm(`${data.message || `${name} can't be deleted yet.`}\n\nArchive ${name} now?`)) await handleArchiveUser(userId, name, true);
        return false;
      }
      alert(data.message || "Failed to delete user. Please refresh and try again.");
    } catch {
      alert("Network error. Please refresh and try again.");
    }
    return false;
  };

  /** Archives a profile: signed out and hidden everywhere, nothing deleted, can be restored. */
  const handleArchiveUser = async (userId: number, name: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm(`Archive ${name}?\n\nThey'll be signed out and hidden from lists, rosters and leaderboards. Nothing is deleted, and you can restore them anytime from Archived profiles.`)) return;
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/archive`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || "Could not archive this profile. Please refresh and try again.");
        return;
      }
      dropFromLists(userId);
      setArchiveRefresh((n) => n + 1);
    } catch {
      alert("Network error. Please refresh and try again.");
    }
  };

  const handleDeleteTeacher = async (t: { id: number; display_name?: string; displayName?: string; username?: string }) => {
    const name = t.display_name || t.displayName || t.username || "this teacher";
    if (!window.confirm(`Delete ${name}'s account for good? This can't be undone. Their students stay, without a teacher.\n\nTo hide the account without deleting anything, use Archive instead.`)) return;
    await handleDeleteUser(t.id, name);
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`Delete ${student.displayName} (@${student.username}) for good?\n\nTheir quizzes and points are removed and this can't be undone. To hide the account without deleting anything, use Archive instead.`)) return;
    await handleDeleteUser(student.id, student.displayName);
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

  // === Reward handlers ===
  const fetchRewards = async (studentId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${studentId}/rewards`, {
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRewardList(data.rewards || []);
      }
    } catch (e) {}
  };

  const handleAddReward = async () => {
    if (!rewardStudent || !rewardTitle.trim() || !rewardMessage.trim()) return;
    setRewardSaving(true);
    setRewardSuccess("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${rewardStudent.id}/rewards`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: rewardTitle,
          message: rewardMessage,
          requiredQuizCount: rewardQuizCount || undefined,
          expiresAt: rewardExpiresAt || undefined,
        }),
      });
      if (res.ok) {
        setRewardTitle("");
        setRewardMessage("");
        setRewardQuizCount("");
        setRewardExpiresAt("");
        setRewardSuccess("Reward added!");
        await fetchRewards(rewardStudent.id);
        setTimeout(() => setRewardSuccess(""), 2500);
      }
    } catch (e) {}
    setRewardSaving(false);
  };

  const handleToggleReward = async (studentId: number, rewardId: number, currentActive: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${studentId}/rewards/${rewardId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) await fetchRewards(studentId);
    } catch (e) {}
  };

  const handleDeleteReward = async (studentId: number, rewardId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${studentId}/rewards/${rewardId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` },
      });
      if (res.ok) await fetchRewards(studentId);
    } catch (e) {}
  };

  const handleRewardClaim = async (studentId: number, rewardId: number, claimStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${studentId}/rewards/${rewardId}/claim`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || getTokenFromCookie()}` },
        body: JSON.stringify({ claimStatus }),
      });
      if (res.ok) await fetchRewards(studentId);
    } catch (e) {}
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
    setManualReviewScore("");
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
          initialCorrected[String(q.id)] = String(q.correctAnswer || "").trim().toUpperCase();
        });
        setCorrectedAnswers(initialCorrected);
      }
    } catch (err) {
      console.error("Failed to fetch review detail:", err);
    } finally {
      setReviewDetailLoading(false);
    }
  };

  const handleRegrade = async (manualScore?: number) => {
    if (!token || !activeReview || regradeBusy) return;
    setRegradeBusy(true);
    setRegradeMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/review-requests/${activeReview.id}/regrade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || getTokenFromCookie()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          correctedAnswers,
          updateAnswerKey,
          adminNotes: adminNotes || undefined,
          manualScore: manualScore === undefined ? undefined : manualScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegradeMsg(data.message || "Could not save the new grade.");
        return;
      }
      setRegradeMsg(`Saved. New grade: ${data.newScore}/${data.total}. Points: ${data.newPoints} (was ${data.oldPoints}).`);
      fetchReviewRequests();
      fetchStudents();
      setNotifRefreshKey(k => k + 1);
      setTimeout(() => {
        setActiveReview(null);
        setReviewDetail(null);
        setRegradeMsg("");
      }, 3500);
    } catch (err) {
      console.error("Failed to regrade:", err);
      setRegradeMsg("Could not save the new grade.");
    } finally {
      setRegradeBusy(false);
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <header className="sticky top-0 z-50 w-full max-w-full overflow-x-hidden bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="w-full max-w-5xl min-w-0 mx-auto px-3 sm:px-4 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-1.5 sm:gap-3 min-h-16 py-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/progress")} className="flex-shrink-0">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Progress</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => safeBack(navigate, "/admin")}
            className="flex-shrink-0"
            title="Go back within your signed-in A.R.I.S.E. session"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/polls")} className="flex-shrink-0">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Polls</span>
          </Button>
          <div className="order-first basis-full sm:order-none sm:basis-auto sm:flex-1 min-w-0 text-center sm:text-left pb-1 sm:pb-0">
            <h1 className="font-bold text-base sm:text-base truncate">Admin Dashboard</h1>
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

      <main className="w-full max-w-5xl min-w-0 mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6 overflow-x-hidden">
        <Card className="border-primary/20 bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-primary">Student Experience Preview</p>
                <h2 className="mt-1 text-lg font-bold">View A.R.I.S.E. exactly like a student</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Non-Eye Gazer is the default. Switch modes anytime from the preview bar. Preview quiz results do not enter student leaderboards or competitions.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-[300px]">
                <Button
                  variant="default"
                  onClick={() => { startAdminPreview("regular"); navigate("/profile"); }}
                  className="font-bold"
                >
                  <Users className="mr-2 h-4 w-4" /> Non-Eye Gazer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { startAdminPreview("eye-gaze"); navigate("/eye-gaze-home"); }}
                  className="font-bold"
                >
                  <Eye className="mr-2 h-4 w-4" /> Eye Gazer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <PlayTimeManager />

        <Card className="border-violet-400/25 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/[.05] to-cyan-400/[.07] shadow-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl arise-icon-tile">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-violet-200">Admin Only · Club A.R.I.S.E.</p>
                  <h2 className="mt-1 text-lg font-black">Game Closing Hours</h2>
                  <p className="mt-1 text-sm text-slate-400">Set the hours when all Club games and worlds are unavailable to student accounts. Times use Mountain Time.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${clubClosingHours.enabled ? (clubClosingHours.closedNow ? "bg-fuchsia-500/15 text-fuchsia-200" : "bg-cyan-500/15 text-cyan-200") : "bg-white/[.06] text-slate-400"}`}>
                  {!clubClosingHours.enabled ? "OFF" : clubClosingHours.closedNow ? "CLOSED NOW" : "OPEN NOW"}
                </span>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3">
                <input
                  type="checkbox"
                  checked={clubClosingHours.enabled}
                  onChange={(e) => setClubClosingHours(s => ({ ...s, enabled: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold">Enable automatic closing hours</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">Close games at</span>
                  <input type="time" value={clubClosingHours.start} onChange={(e) => setClubClosingHours(s => ({...s,start:e.target.value}))} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0f0d1d] px-3 text-white" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">Reopen games at</span>
                  <input type="time" value={clubClosingHours.end} onChange={(e) => setClubClosingHours(s => ({...s,end:e.target.value}))} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0f0d1d] px-3 text-white" />
                </label>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Closing days</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, day) => {
                    const selected = clubClosingHours.days.includes(day);
                    return <button key={label} type="button" onClick={() => setClubClosingHours(s => ({...s,days:selected?s.days.filter(d=>d!==day):[...s.days,day].sort((a,b)=>a-b)}))} className={`rounded-xl border px-2 py-2 text-xs font-black transition ${selected?"border-violet-400/35 bg-violet-500/15 text-violet-100":"border-white/10 bg-white/[.03] text-slate-500"}`}>{label}</button>;
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-400">An overnight schedule such as 9:00 PM → 7:00 AM closes the Club across midnight automatically.</p>
                <Button onClick={handleSaveClubClosingHours} disabled={clubClosingSaving} className="arise-gradient-button rounded-xl font-black">
                  {clubClosingSaving ? "Saving…" : "Save Closing Hours"}
                </Button>
              </div>
              {clubClosingMsg && <p className="text-xs font-bold text-cyan-200">{clubClosingMsg}</p>}

              <details className="rounded-2xl border border-white/10 bg-black/10 p-3">
                <summary className="cursor-pointer text-sm font-black text-violet-100">Teacher class hours · admin override</summary>
                <p className="mt-2 text-xs text-slate-400">Teachers can set hours for their own students. You can review or replace any teacher's class schedule here. The global admin closing window above still takes priority over every class.</p>
                <div className="mt-3 space-y-3">
                  {teacherClubClosingHours.length ? teacherClubClosingHours.map((teacher:any) => {
                    const schedule = teacher.schedule || { enabled:false,start:"21:00",end:"07:00",days:[0,1,2,3,4,5,6] };
                    return <div key={teacher.id} className="rounded-xl border border-white/10 bg-[#0f0d1d] p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div><p className="font-black text-white">{teacher.displayName}</p><p className="text-xs text-slate-500">@{teacher.username}</p></div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${schedule.enabled ? (schedule.closedNow ? "bg-fuchsia-500/15 text-fuchsia-200" : "bg-cyan-500/15 text-cyan-200") : "bg-white/[.06] text-slate-400"}`}>{!schedule.enabled ? "OFF" : schedule.closedNow ? "CLOSED NOW" : "OPEN NOW"}</span>
                      </div>
                      <label className="mb-3 flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={!!schedule.enabled} onChange={e=>setTeacherClubClosingHours(items=>items.map((item:any)=>item.id===teacher.id?{...item,schedule:{...schedule,enabled:e.target.checked}}:item))}/> Use class hours</label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-bold text-slate-400">Close at<input type="time" value={schedule.start} onChange={e=>setTeacherClubClosingHours(items=>items.map((item:any)=>item.id===teacher.id?{...item,schedule:{...schedule,start:e.target.value}}:item))} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-white"/></label>
                        <label className="text-xs font-bold text-slate-400">Reopen at<input type="time" value={schedule.end} onChange={e=>setTeacherClubClosingHours(items=>items.map((item:any)=>item.id===teacher.id?{...item,schedule:{...schedule,end:e.target.value}}:item))} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-white"/></label>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label,day)=>{
                        const selected=(schedule.days||[]).includes(day);
                        return <button type="button" key={label} onClick={()=>setTeacherClubClosingHours(items=>items.map((item:any)=>item.id===teacher.id?{...item,schedule:{...schedule,days:selected?schedule.days.filter((d:number)=>d!==day):[...schedule.days,day].sort((a:number,b:number)=>a-b)}}:item))} className={`rounded-lg border px-2 py-1.5 text-[10px] font-black ${selected?"border-violet-400/40 bg-violet-500/15 text-violet-100":"border-white/10 text-slate-500"}`}>{label}</button>;
                      })}</div>
                      <Button size="sm" onClick={()=>void saveTeacherClubClosingHours(teacher.id)} disabled={teacherClubClosingSavingId===teacher.id} className="mt-3 rounded-xl font-black">{teacherClubClosingSavingId===teacher.id?"Saving…":"Override class hours"}</Button>
                    </div>;
                  }) : <p className="text-xs text-slate-500">No teacher accounts found.</p>}
                </div>
                {teacherClubClosingMsg && <p className="mt-2 text-xs font-bold text-cyan-200">{teacherClubClosingMsg}</p>}
              </details>
            </div>
          </CardContent>
        </Card>

        <TheaterAdmin token={token || getTokenFromCookie()} />

        {/* Pending AI quiz alert banner */}
        {pendingQuizzes.length > 0 && (
          <div className="rounded-2xl bg-orange-500/10 border-2 border-orange-500/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-orange-400">
                {pendingQuizzes.length} AI Quiz {pendingQuizzes.length === 1 ? 'Request' : 'Requests'} Pending Review
              </p>
              <p className="text-sm text-muted-foreground">
                Students are waiting for their quizzes to be approved. Review them now.
              </p>
            </div>
            <Button
              size="sm"
              variant="default"
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => {
                const el = document.querySelector('[data-section="ai-quiz-review"]');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              Review Now
            </Button>
          </div>
        )}
        {/* Welcome banner */}
        <div className="rounded-2xl bg-primary text-white p-4 sm:p-8 shadow-lg">
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-1 text-white/90">Welcome back! Here's your platform overview.</p>
          <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-6 mt-4 sm:flex-wrap">
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
          <Card className="shadow-md">
            <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{students.length}</div>
                <div className="text-xs text-muted-foreground">Students</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{totalQuizzes}</div>
                <div className="text-xs text-muted-foreground">Quizzes Completed</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold">{totalMastered}</div>
                <div className="text-xs text-muted-foreground">Quizzes Mastered</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{books.filter(b => b.readUrl).length}</div>
                <div className="text-xs text-muted-foreground">Books to Read</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
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
            <div className="flex flex-wrap items-center gap-2">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <Label className="text-sm font-medium">Announcement Banner</Label>
            </div>
            <p className="text-xs text-muted-foreground">This message appears at the top of every student's Library page.</p>
            <div className="flex flex-col sm:flex-row gap-2">
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted-foreground">Bg:</label>
                <input type="color" value={studentBanner.bgColor} onChange={(e) => setStudentBanner({ ...studentBanner, bgColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted-foreground">Bg:</label>
                <input type="color" value={teacherBanner.bgColor} onChange={(e) => setTeacherBanner({ ...teacherBanner, bgColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex flex-wrap items-center gap-3">
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

          {/* AI Quiz Settings */}
          <div className="space-y-3 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">Instant AI Quiz — Perplexity API Key</Label>
            <p className="text-xs text-muted-foreground">Students can generate 10-question quizzes for any book. Get a key from docs.perplexity.ai → API Keys.</p>
            {aiKeyConfigured ? (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Configured ({aiKeyPreview})
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-yellow-400">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                Not configured — students will see an error message
              </div>
            )}
            {aiKeyMsg && <p className="text-sm text-green-400">{aiKeyMsg}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="Paste your Perplexity API key (pplx-...)"
                className="bg-muted/30 border-border text-foreground"
              />
              <Button size="sm" variant="outline" onClick={handleSaveAiKey} disabled={!aiApiKey.trim()}>
                Save Key
              </Button>
            </div>
          </div>

          {/* Quiz Generation Guidelines */}
          <div className="space-y-3 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">AI Quiz Guidelines</Label>
            <p className="text-xs text-muted-foreground">Control how the AI generates quizzes. Leave empty for defaults. These instructions are added to every AI-generated quiz.</p>
            {guidelinesMsg && <p className="text-sm text-green-400">{guidelinesMsg}</p>}
            <textarea
              value={quizGuidelines}
              onChange={(e) => setQuizGuidelines(e.target.value)}
              placeholder={"Examples:\n- Focus on character motivation and plot twists\n- Include 2 vocabulary questions\n- Make questions challenging but fair\n- Avoid questions about minor details"}
              rows={5}
              className="w-full rounded-md bg-muted/30 border border-border text-foreground text-sm p-2 resize-y"
            />
            <Button size="sm" variant="outline" onClick={handleSaveGuidelines}>
              Save Guidelines
            </Button>
          </div>

          {/* Eye Gaze Quiz Guidelines */}
          <div className="space-y-3 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">Eye Gaze Quiz Standards</Label>
            <p className="text-xs text-muted-foreground">Control how the AI generates eye gaze quizzes for non-verbal and eye gaze students. Leave empty for defaults. These instructions are added to every eye gaze quiz.</p>
            {eyeGazeGuidelinesMsg && <p className="text-sm text-green-400">{eyeGazeGuidelinesMsg}</p>}
            <textarea
              value={eyeGazeGuidelines}
              onChange={(e) => setEyeGazeGuidelines(e.target.value)}
              placeholder={"Examples:\n- Use only single-word answers (nouns)\n- Make distractors very different from the correct answer\n- Focus on identification and matching\n- Use simple, concrete concepts\n- Avoid abstract reasoning for Level 1-2"}
              rows={5}
              className="w-full rounded-md bg-muted/30 border border-border text-foreground text-sm p-2 resize-y"
            />
            <Button size="sm" variant="outline" onClick={handleSaveEyeGazeGuidelines}>
              Save Eye Gaze Guidelines
            </Button>
          </div>

          {/* Donation Goal Settings */}
          <div className="space-y-3 pt-4 border-t border-border mt-4">
            <Label className="text-sm font-medium">Donation Goal (shows on student library page)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={proctorPassword}
                className="flex-1 px-3 py-1.5 rounded-lg bg-muted/30 border border-border text-foreground text-sm font-mono"
              />
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(proctorPassword)}>Copy</Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base">🥚</span>
              <Label className="text-sm font-bold">FYP Easter Eggs</Label>
              <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold ${easterEggs.active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                {easterEggs.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
            <div className="flex flex-wrap items-center gap-2">
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

        {/* Plans and billing */}
        <AdminPlans />

        {/* Competition Settings */}
        <Card className="shadow-md border-yellow-500/30">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Competition Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">A.R.I.S.E. gives no prizes of its own. Parents, teachers and schools put up their own prizes, and those show on the competition page for their readers.</p>
            {compMsg && <span className="text-xs text-green-400">{compMsg}</span>}

            {/* Monthly */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-sm font-bold text-yellow-400">Monthly Competition</Label>
              <div>
                <span className="text-xs text-muted-foreground">Monthly Countdown Date (optional — shows a live countdown to this date)</span>
                <input type="date" value={compSettings.monthlyCountdownDate} onChange={(e) => setCompSettings(s => ({ ...s, monthlyCountdownDate: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm" />
              </div>
            </div>

            {/* Yearly */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-sm font-bold text-primary">Reader of the Year</Label>
              <div>
                <span className="text-xs text-muted-foreground">Yearly Countdown Date (optional — shows a live countdown to this date)</span>
                <input type="date" value={compSettings.yearlyCountdownDate} onChange={(e) => setCompSettings(s => ({ ...s, yearlyCountdownDate: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm" />
              </div>
            </div>

            <Button onClick={handleSaveCompSettings} className="w-full bg-yellow-600 hover:bg-yellow-700">
              <Trophy className="w-4 h-4 mr-1" /> Save Competition Settings
            </Button>
          </CardContent>
        </Card>

        {/* Eye Gaze Change Requests */}
        {eyeGazeRequests.length > 0 && (
        <Card className="shadow-md border-blue-500/30">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Eye className="w-5 h-5 text-blue-500" />
              Eye Gaze Change Requests ({eyeGazeRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eyeGazeRequests.map((r) => (
              <div key={r.id || r.userId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div>
                  <p className="font-semibold text-sm">{r.displayName || r.username}</p>
                  <p className="text-xs text-muted-foreground">@{r.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {r.currentStatus ? 'Enable' : 'Disable'} Eye Gaze access
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-shrink-0">
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
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Leaderboard (Admin View)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium">View Band:</span>
              <select
                value={adminLbBand}
                onChange={(e) => {
                  setAdminLbBand(e.target.value);
                  fetchAdminLeaderboard(e.target.value);
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
              >
                <option value="">All Bands</option>
                <option value="K-2">K-2 Band</option>
                <option value="3-5">3-5 Band</option>
                <option value="6-8">6-8 Band</option>
                <option value="9-12">9-12 Band</option>
              </select>
              <div className="hidden sm:block h-7 w-px bg-border" />
              <span className="text-sm font-medium">Poster:</span>
              <select
                value={adminLbPrintCount}
                onChange={(e) => setAdminLbPrintCount(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                aria-label="Number of leaderboard students to print"
              >
                <option value="3">Top 3</option>
                <option value="5">Top 5</option>
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
                <option value="all">All Students</option>
              </select>
              <Button
                type="button"
                onClick={printAdminLeaderboard}
                disabled={adminLbLoading || adminLeaderboard.length === 0}
                className="w-full sm:w-auto gap-2 font-semibold"
              >
                <Printer className="w-4 h-4" />
                Print Hallway Poster
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 font-semibold text-foreground"><Trophy className="w-5 h-5 text-primary" /> Hallway Poster Setup</div>
                <p className="mt-1 text-xs text-muted-foreground">Make the printed leaderboard feel like an awards poster. Add a headline and tell everyone exactly what the top winners earned.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs font-bold">Poster headline</Label>
                  <Input value={adminLbPosterTitle} onChange={(e) => setAdminLbPosterTitle(e.target.value)} maxLength={45} placeholder="READING CHAMPIONS" className="mt-1 font-bold" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Poster message</Label>
                  <Input value={adminLbPosterMessage} onChange={(e) => setAdminLbPosterMessage(e.target.value)} maxLength={90} placeholder="Celebrating the readers who rose to the top!" className="mt-1" />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student rewards</div>
                    <p className="mt-1 text-xs text-muted-foreground">Optional. Edit the prize for any student included on this printout.</p>
                  </div>
                  {Object.keys(adminLbRewards).length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAdminLbRewards({})}>Clear rewards</Button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-background">
                  {adminLeaderboard
                    .slice(0, adminLbPrintCount === "all" ? adminLeaderboard.length : Math.max(1, Number(adminLbPrintCount) || 10))
                    .map((entry: any, idx: number) => {
                      const rewardKey = String(entry.id ?? idx + 1);
                      return (
                        <div key={rewardKey} className="grid gap-2 sm:grid-cols-[44px_minmax(0,1fr)_minmax(190px,1fr)] items-center p-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">#{idx + 1}</div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{entry.displayName || "Reader"}</div>
                            <div className="text-[11px] text-muted-foreground">{Number(entry.totalPoints || 0).toLocaleString()} points • {Number(entry.quizzesTaken || 0)} quizzes</div>
                          </div>
                          <Input
                            value={adminLbRewards[rewardKey] || ""}
                            onChange={(e) => setAdminLbRewards((prev) => ({ ...prev, [rewardKey]: e.target.value }))}
                            maxLength={80}
                            placeholder="Optional prize / reward"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The printout uses a clean Letter-size school poster layout. Your current reading-band filter, student list, and any rewards you enter are added automatically.</p>
            {adminLbLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : adminLeaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No students in this band yet.</p>
            ) : (
              <div className="space-y-2">
                {adminLeaderboard.slice(0, 20).map((entry: any, idx: number) => (
                  <div key={entry.id} className="grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-3 p-3 sm:p-4 rounded-xl bg-muted/30">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 bg-muted text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{entry.displayName}</p>
                        {entry.isEyeGaze || entry.isEyeGazeUser ? (
                          <span className="inline-flex flex-shrink-0 items-center px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] sm:text-xs font-semibold">EG</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs text-muted-foreground">
                        <span>{entry.quizzesTaken} quizzes</span>
                        {entry.schoolName && <span>· {entry.schoolName}</span>}
                        {entry.grade && <span>· Gr {entry.grade}</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right rounded-lg bg-primary/10 px-2.5 py-1.5 sm:px-3">
                      <div className="font-bold text-base sm:text-lg leading-none text-primary">{entry.totalPoints}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">pts</div>
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
            <CardTitle className="flex flex-wrap items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.836 5.253 9.5 4.5 8 4.5c-1.5 0-2.836.753-4 1.753v13c1.164-.991 2.5-1.753 4-1.753 1.5 0 2.836.753 4 1.753 1.164-.991 2.5-1.753 4-1.753 1.5 0 2.836.753 4 1.753v-13c-1.164-.991-2.5-1.753-4-1.753-1.5 0-2.836.753-4 1.753z" />
              </svg>
              Grade Change Requests ({gradeChangeRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {gradeChangeRequests.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div>
                  <p className="font-semibold text-sm">{r.displayName || r.username}</p>
                  <p className="text-xs text-muted-foreground">@{r.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Grade {r.oldGrade || 'N/A'} ({r.oldBand || 'N/A'} Band) → Grade {r.newGrade} ({r.newBand} Band)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-shrink-0">
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
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
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
                <p className="text-xs text-muted-foreground mb-2">New teachers get in on their own by confirming their school email (.edu, .net, .org or .us). The teachers listed here haven&apos;t entered their code yet, or signed up before school emails were required. Approve turns an account on by hand.</p>
                <div className="space-y-2">
                  {pendingTeachers.map((t) => (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                      <div>
                        <span className="font-semibold text-white">{t.display_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">@{t.username}</span>
                        {t.email && <span className="text-xs text-muted-foreground ml-2">| {t.email}</span>}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button onClick={() => handleApproveTeacher(t.id)} className="w-full sm:w-auto px-3 py-1.5 text-sm font-semibold rounded bg-primary text-white hover:opacity-90">Approve</button>
                        <button onClick={() => void handleDeleteTeacher(t)} className="w-full sm:w-auto px-3 py-1.5 text-sm font-semibold rounded bg-red-600 text-white hover:opacity-90">Delete</button>
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
                  <div key={t.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/30 hover:bg-muted/50 transition-colors rounded-xl p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                        {(t.display_name || "?").charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{t.display_name}</div>
                        <div className="text-xs text-muted-foreground">@{t.username}{t.email ? " | " + t.email : ""}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                      <button onClick={() => void handleArchiveUser(t.id, t.display_name || t.username || "this teacher")} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded bg-white/10 text-white hover:bg-white/15" data-testid={`button-archive-teacher-${t.id}`}><Archive className="w-3.5 h-3.5" />Archive</button>
                      <button onClick={() => void handleDeleteTeacher(t)} className="px-3 py-1.5 text-sm font-semibold rounded bg-red-600/80 text-white hover:opacity-90">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Students whose school/teacher wasn't listed at signup */}
        <UnlistedSignupsCard />

        {/* Quizzes students took on their own with the camera on */}
        <NoProctorReview />

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
          <Card data-section="pending-parent-approvals" className="shadow-md border-blue-500/30">
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
                    <Button size="sm" variant="outline" onClick={() => void handleArchiveUser(p.id, p.display_name || p.displayName || "this parent")} title="Archive" data-testid={`button-archive-parent-${p.id}`}>
                      <Archive className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">Archive</span>
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
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Users className="w-5 h-5" />
              Students ({students.length})
            </CardTitle>
            <Button variant="outline" onClick={() => printParentInvites().catch(e => window.alert(e.message))}>Print all parent letters</Button>
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
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-full sm:w-auto flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {s.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{s.displayName}</p>
                        <p className="text-xs text-muted-foreground break-words">@{s.username}{sBand ? ` · ${sBand} Band${sGrade ? ` · Grade ${sGrade}` : ''}` : ''}</p>
                        </div>
                      </div>
                      <div className="w-full sm:w-auto flex sm:block items-center justify-between sm:text-right flex-shrink-0 px-1 sm:px-0">
                        <div className="font-bold text-sm">{s.totalPoints} pts</div>
                        <div className="text-xs text-muted-foreground">{s.quizzesTaken} quizzes</div>
                      </div>
                    <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-1 w-full sm:w-auto flex-shrink-0">
                      <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center" onClick={() => openManualPoints(s)}>
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span className="ml-1">Points</span>
                      </Button>
                      {/* View detail */}
                      <Button variant="ghost" size="sm" className="w-full sm:w-auto justify-center border border-border sm:border-0" onClick={() => handleViewStudent(s)}>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="ml-1">Details</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto justify-center"
                        onClick={async () => {
                          const authToken = token || getTokenFromCookie();
                          if (!authToken) return;
                          const res = await fetch(`${API_BASE}/api/admin/students/${s.id}/reset-daily-challenge`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${authToken}` },
                          });
                          const data = await res.json().catch(() => ({}));
                          window.alert(res.ok ? (data.message || "Daily Challenge reset.") : (data.message || "Could not reset Daily Challenge."));
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="ml-1">Daily Reset</span>
                      </Button>

                      {/* Reset password */}
                      <Dialog open={resetStudent?.id === s.id} onOpenChange={(open) => {
                        if (open) { setResetStudent(s); setResetSuccess(""); }
                        else { setResetStudent(null); setNewPassword(""); setResetSuccess(""); }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center">
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="ml-1">Reset</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
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
                          <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center">
                            <Send className="w-3.5 h-3.5" />
                            <span className="ml-1">Message</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
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

                      {/* Drop Reward */}
                      <Dialog open={rewardStudent?.id === s.id} onOpenChange={(open) => {
                        if (open) {
                          setRewardStudent(s);
                          setRewardTitle(""); setRewardMessage(""); setRewardQuizCount(""); setRewardExpiresAt("");
                          setRewardSuccess("");
                          fetchRewards(s.id);
                        } else {
                          setRewardStudent(null); setRewardList([]); setRewardSuccess("");
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center">
                            <Gift className="w-3.5 h-3.5" />
                            <span className="ml-1">Reward</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-lg max-h-[92dvh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Drop a Reward for {s.displayName}</DialogTitle>
                          </DialogHeader>
                          {rewardSuccess ? (
                            <div className="text-center py-4">
                              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                              <p className="text-sm text-green-400 font-medium">{rewardSuccess}</p>
                            </div>
                          ) : null}
                          <div className="space-y-4">
                            {/* Create new reward */}
                            <div className="space-y-3 p-4 rounded-lg bg-muted/30">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Create New Reward</p>
                              <div className="space-y-2">
                                <Label className="text-xs">Reward Title</Label>
                                <Input
                                  value={rewardTitle}
                                  onChange={(e) => setRewardTitle(e.target.value)}
                                  placeholder="e.g., Snack Reward"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Message (shown on student profile)</Label>
                                <Textarea
                                  value={rewardMessage}
                                  onChange={(e) => setRewardMessage(e.target.value)}
                                  placeholder="e.g., Complete 1 quiz this week and show this to get your snack!"
                                  rows={3}
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label className="text-xs">Required Quizzes (optional)</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={rewardQuizCount}
                                    onChange={(e) => setRewardQuizCount(e.target.value)}
                                    placeholder="e.g., 1"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Expires (optional)</Label>
                                  <Input
                                    type="date"
                                    value={rewardExpiresAt}
                                    onChange={(e) => setRewardExpiresAt(e.target.value)}
                                  />
                                </div>
                              </div>
                              <Button onClick={handleAddReward} disabled={!rewardTitle.trim() || !rewardMessage.trim() || rewardSaving} className="w-full">
                                <Gift className="w-4 h-4 mr-1" />
                                {rewardSaving ? "Adding..." : "Drop Reward"}
                              </Button>
                            </div>
                            {/* Existing rewards */}
                            {rewardList.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Active Rewards</p>
                                {rewardList.map((r) => (
                                  <div key={r.id} className={`p-3 rounded-lg border ${r.active ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20 opacity-60"}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-sm font-medium">{r.title}</p>
                                          {r.claimStatus === "requested" && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white">CLAIMED</span>
                                          )}
                                          {r.claimStatus === "approved" && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white">APPROVED</span>
                                          )}
                                          {r.claimStatus === "used" && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500 text-white">USED</span>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{r.message}</p>
                                        {r.requiredQuizCount > 0 && (
                                          <p className="text-[10px] text-primary font-medium mt-1">Requires {r.requiredQuizCount} quiz{r.requiredQuizCount > 1 ? "es" : ""}</p>
                                        )}
                                        {r.expiresAt && (
                                          <p className="text-[10px] text-muted-foreground">Expires: {new Date(r.expiresAt).toLocaleDateString()}</p>
                                        )}
                                        {r.claimStatus === "requested" && (
                                          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-1">Student requested to claim this reward on {r.claimedAt ? new Date(r.claimedAt).toLocaleDateString() : ""}</p>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-1 flex-shrink-0">
                                        {r.claimStatus === "requested" && (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleRewardClaim(s.id, r.id, "approved")}
                                              className="text-xs text-green-600 hover:text-green-400"
                                            >
                                              <Check className="w-3.5 h-3.5 mr-1" /> Approve
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleRewardClaim(s.id, r.id, "denied")}
                                              className="text-xs text-red-500 hover:text-red-400"
                                            >
                                              <X className="w-3.5 h-3.5 mr-1" /> Deny
                                            </Button>
                                          </>
                                        )}
                                        {r.claimStatus === "approved" && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRewardClaim(s.id, r.id, "used")}
                                            className="text-xs text-gray-600 dark:text-gray-400"
                                          >
                                            Mark Used
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleToggleReward(s.id, r.id, r.active)}
                                          className="text-xs"
                                        >
                                          {r.active ? "Deactivate" : "Activate"}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteReward(s.id, r.id)}
                                          className="text-red-500 hover:text-red-400"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Archive or delete the student */}
                      <Button variant="ghost" size="sm" onClick={() => void handleArchiveUser(s.id, s.displayName)} title="Archive" data-testid={`button-archive-student-${s.id}`}>
                        <Archive className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline ml-1">Archive</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteStudent(s)} className="text-red-500 hover:text-red-400">
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

        {/* Archived students, teachers and parents */}
        <ArchivedProfilesCard refreshKey={archiveRefresh} onRestored={() => { void fetchStudents(); void fetchTeachers(); void fetchAllParents(); }} />

        {/* Book cover management */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
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
                  onChange={(e) => { setBookSearch(e.target.value); setBookPage(0); }}
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
                        onClick={() => { setAdminSortBy(opt.val as any); setShowAdminSortMenu(false); setBookPage(0); }}
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
            ) : (() => {
              const filtered = (books || []).filter(b =>
                (b?.title || "").toLowerCase().includes(bookSearch.toLowerCase()) ||
                (b?.author || "").toLowerCase().includes(bookSearch.toLowerCase())
              ).sort((a, b) => {
                if (adminSortBy === "new") return b.id - a.id;
                if (adminSortBy === "recent") return (!a.readUrl ? 1 : 0) - (!b.readUrl ? 1 : 0);
                if (adminSortBy === "classics") return (a.readUrl ? 1 : 0) - (b.readUrl ? 1 : 0);
                if (adminSortBy === "popular") return 0;
                return (b.pointsValue || 0) - (a.pointsValue || 0);
              });
              if (filtered.length === 0) {
                return <p className="text-center text-muted-foreground py-8">No books match your search.</p>;
              }
              const totalPages = Math.ceil(filtered.length / BOOKS_PER_PAGE);
              const safePage = Math.min(bookPage, Math.max(0, totalPages - 1));
              const pageBooks = filtered.slice(safePage * BOOKS_PER_PAGE, (safePage + 1) * BOOKS_PER_PAGE);
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {pageBooks.map((b) => (
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
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage === 0}
                        onClick={() => setBookPage(safePage - 1)}
                        className="h-8"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {safePage + 1} of {totalPages} ({filtered.length} books)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages - 1}
                        onClick={() => setBookPage(safePage + 1)}
                        className="h-8"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* Reading Club Sign-Ups */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Reading Club Sign-Ups
              {clubSignups.filter(s => s.status === "pending").length > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {clubSignups.filter(s => s.status === "pending").length} pending
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clubSignups.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No Reading Club sign-ups yet.</p>
            ) : (
              <div className="space-y-3">
                {clubSignups.map((s) => (
                  <div key={s.id} className={`rounded-xl border p-4 ${s.status === "pending" ? "border-amber-500/30 bg-amber-500/5" : s.status === "confirmed" ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/30"}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div>
                        <span className="font-semibold">{s.student_name}</span>
                        {s.grade && <span className="text-sm text-muted-foreground ml-2">· {s.grade}</span>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "pending" ? "bg-amber-500/20 text-amber-400" : s.status === "confirmed" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {s.status}
                      </span>
                    </div>
                    {(s.parent_name || s.parent_contact || s.parent_email) && (
                      <div className="text-sm text-muted-foreground mb-2">
                        {s.parent_name && <span>Parent: {s.parent_name}</span>}
                        {s.parent_contact && <span className="ml-3">📞 {s.parent_contact}</span>}
                        {s.parent_email && <span className="ml-3">✉ {s.parent_email}</span>}
                      </div>
                    )}
                    {s.notes && <p className="text-sm text-muted-foreground italic mb-2">"{s.notes}"</p>}
                    <p className="text-xs text-muted-foreground">Signed up: {new Date(s.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                    {s.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={async () => {
                          const authToken = token || getTokenFromCookie();
                          if (!authToken) return;
                          await fetch(`${API_BASE}/api/admin/club-signups/${s.id}/status`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "confirmed" }),
                          });
                          const res = await fetch(`${API_BASE}/api/admin/club-signups`, { headers: { Authorization: `Bearer ${authToken}` } });
                          if (res.ok) { const data = await res.json(); setClubSignups(data.signups || []); }
                        }}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirm
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={async () => {
                          const authToken = token || getTokenFromCookie();
                          if (!authToken) return;
                          await fetch(`${API_BASE}/api/admin/club-signups/${s.id}/status`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "denied" }),
                          });
                          const res = await fetch(`${API_BASE}/api/admin/club-signups`, { headers: { Authorization: `Bearer ${authToken}` } });
                          if (res.ok) { const data = await res.json(); setClubSignups(data.signups || []); }
                        }}>
                          Deny
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quiz Review Requests */}
        <Card className="shadow-md" ref={reviewRef}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
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
            <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-3xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-lg">
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-muted/50 p-3">
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
                      const studentAns = String(q.studentAnswer || "").trim().toUpperCase();
                      const correctAns = String(correctedAnswers[String(q.id)] || q.correctAnswer || "").trim().toUpperCase();
                      const isCorrect = !!studentAns && studentAns === correctAns;
                      return (
                        <div key={q.id} className={`rounded-lg border p-4 ${isCorrect ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                          <p className="font-medium mb-2">{idx + 1}. {q.questionText}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {[
                              { letter: "A", text: q.optionA },
                              { letter: "B", text: q.optionB },
                              { letter: "C", text: q.optionC },
                              { letter: "D", text: q.optionD },
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
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-4 border-t border-border pt-4">
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                      <p className="font-semibold">Automatic recheck: {reviewDetail.calculatedScore ?? "—"}/{reviewDetail.attempt?.total}</p>
                      <p className="mt-1 text-sm text-muted-foreground">If the answer key is correct, this is the grade the student should receive. Press the button below and you are done.</p>
                      <Button disabled={regradeBusy} onClick={() => void handleRegrade()} className="mt-3 w-full">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirm automatic grade
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border p-4">
                      <p className="font-semibold">Or enter a grade yourself</p>
                      <p className="mt-1 text-sm text-muted-foreground">Use this only when you want to override the calculated score. Enter the number correct, from 0 to {reviewDetail.attempt?.total}.</p>
                      <div className="mt-3 flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={reviewDetail.attempt?.total || 10}
                          step={1}
                          value={manualReviewScore}
                          onChange={(e) => setManualReviewScore(e.target.value)}
                          placeholder={`0-${reviewDetail.attempt?.total || 10}`}
                        />
                        <Button
                          variant="secondary"
                          disabled={regradeBusy || manualReviewScore === "" || Number(manualReviewScore) < 0 || Number(manualReviewScore) > Number(reviewDetail.attempt?.total || 10)}
                          onClick={() => void handleRegrade(Number(manualReviewScore))}
                        >
                          Save manual grade
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                      <p className="font-semibold">Was the quiz answer key wrong?</p>
                      <p className="mt-1 text-sm text-muted-foreground">Change the correct answer on the question above. Turn this on only if future students should use your corrected answer key too.</p>
                      <label className="mt-3 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          id="updateKey"
                          checked={updateAnswerKey}
                          onChange={(e) => setUpdateAnswerKey(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Save my changed answers to the quiz for future students
                      </label>
                    </div>

                    <Textarea
                      placeholder="Notes to remember why you changed the grade (optional)"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
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
            <CardTitle className="flex flex-wrap items-center gap-2">
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
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Building className="w-5 h-5" />
              Schools & Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Create school */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
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

                    {/* Where this school is in the US school list */}
                    <SchoolUsListMatch school={school} onChanged={fetchSchools} />

                    {/* Create class under school */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
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
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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

        {/* AI Quiz Review Section */}
        {pendingQuizzes.length > 0 && (
          <div data-section="ai-quiz-review" className="mb-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold">AI Quiz Review</h2>
              <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                {pendingQuizzes.length} pending
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Students requested these AI-generated quizzes. Review the questions and approve or reject each one.
            </p>
            <div className="space-y-3">
              {pendingQuizzes.map((quiz) => {
                let questions = [];
                try { questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions; } catch {}
                if (!Array.isArray(questions)) questions = [];
                const isExpanded = expandedQuiz === quiz.id;
                const isRejecting = rejectingQuizId === quiz.id;
                return (
                  <div key={quiz.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{quiz.book_title}</span>
                          <span className="text-xs text-muted-foreground">by {quiz.author}</span>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {quiz.quiz_type === 'eye_gaze' ? 'Eye Gaze' : quiz.quiz_type === 'iarise' ? 'iArise' : quiz.quiz_type === 'favorite_topic' ? 'Favorite Topic' : 'Book Quiz'}
                          </span>
                          <span className="text-xs text-muted-foreground">Grade {quiz.age_group}</span>
                          <span className="text-xs text-muted-foreground">{quiz.student_name || 'Unknown student'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedQuiz(isExpanded ? null : quiz.id)}
                        className="text-xs text-primary hover:underline"
                      >{isExpanded ? 'Hide' : 'Review'}</button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        {questions.length === 0 && (
                          <p className="text-sm text-muted-foreground italic">No questions could be loaded.</p>
                        )}
                        {questions.map((q: any, qIdx: number) => {
                          const questionText = q.prompt || q.question || '';
                          const opts = q.option_a_text ? [
                            { letter: 'A', text: q.option_a_text, image: q.option_a_image },
                            { letter: 'B', text: q.option_b_text, image: q.option_b_image },
                            { letter: 'C', text: q.option_c_text, image: q.option_c_image },
                            { letter: 'D', text: q.option_d_text, image: q.option_d_image },
                          ] : (q.options || []).map((opt: any, i: number) => ({
                            letter: String.fromCharCode(65 + i),
                            text: typeof opt === 'string' ? opt : (opt.text || ''),
                            image: typeof opt === 'string' ? null : (opt.image || null),
                          }));
                          const correctLetter = (q.correct_answer || q.correct || 'A').toString().toUpperCase().charAt(0);
                          const qImage = q.question_image || q.image || null;
                          return (
                          <div key={qIdx} className="bg-muted/50 rounded-lg p-3">
                            <p className="text-sm font-medium mb-2">{qIdx + 1}. {questionText}</p>
                            {qImage && (
                              <div className="mb-2">
                                {qImage.startsWith('http') || qImage.startsWith('data:') ? (
                                  <img src={qImage} alt="Question visual" style={{ maxWidth: 100, maxHeight: 100, borderRadius: 6 }} />
                                ) : (
                                  <span style={{ fontSize: 28 }}>{qImage}</span>
                                )}
                              </div>
                            )}
                            <div className="space-y-1">
                              {opts.map((opt: any, oIdx: number) => (
                                <div key={oIdx} className={`text-xs px-2 py-1 rounded ${
                                  opt.letter === correctLetter ? 'bg-emerald-500/10 text-emerald-600 font-medium' : 'text-muted-foreground'
                                }`}>
                                  {opt.letter}) {opt.text}{opt.letter === correctLetter ? ' ✓' : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                          );
                        })}

                        {isRejecting ? (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <input
                              type="text"
                              placeholder="Reason for rejection (optional)..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-border text-sm bg-background"
                            />
                            <Button size="sm" variant="destructive" onClick={() => handleRejectQuiz(quiz.id)}>
                              Confirm Reject
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setRejectingQuizId(null); setRejectReason(""); }}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button size="sm" variant="default" onClick={() => handleApproveQuiz(quiz.id)}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve & Publish
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRejectingQuizId(quiz.id)}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Growth Check Section */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Brain className="w-5 h-5" />
              Arise Reading Growth Check
            </CardTitle>
            <p className="text-sm text-muted-foreground">Manage benchmark windows, forms, and student assignments</p>
          </CardHeader>
          <CardContent>
            {growthCheckLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Success / Error messages */}
                {growthCheckSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    {growthCheckSuccess}
                  </div>
                )}
                {growthCheckError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <X className="w-4 h-4 flex-shrink-0" />
                    {growthCheckError}
                  </div>
                )}

                {/* Benchmark Windows */}
                <div>
                  <h3 className="font-semibold text-sm mb-3">Benchmark Windows</h3>
                  <div className="space-y-2">
                    {growthCheckWindows.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No benchmark windows configured.</p>
                    ) : (
                      growthCheckWindows.map((w) => (
                        <div key={w.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/30 rounded-xl p-3">
                          <div>
                            <div className="font-medium text-sm capitalize">{w.window_name || w.name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">
                              {w.school_year || w.term}{w.start_date && ` • ${w.start_date}${w.end_date ? ` to ${w.end_date}` : ""}`}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSaveGrowthCheckWindow({ ...w, is_active: !w.is_active })}
                            disabled={growthCheckSaving}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                              w.is_active
                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                            } disabled:opacity-50`}
                          >
                            {w.is_active ? "Active" : "Inactive"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Assign Growth Check */}
                <div>
                  <h3 className="font-semibold text-sm mb-3">Assign Growth Check</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={growthCheckAssignBand}
                      onChange={(e) => setGrowthCheckAssignBand(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                    >
                      <option value="K-2">K-2</option>
                      <option value="3-5">3-5</option>
                      <option value="6-8">6-8</option>
                      <option value="9-12">9-12</option>
                    </select>
                    <Button
                      onClick={handleAssignGrowthCheckAll}
                      disabled={growthCheckSaving}
                      className="bg-primary"
                    >
                      Assign to All Students
                    </Button>
                  </div>
                </div>

                {/* Student Results Overview */}
                <div>
                  <h3 className="font-semibold text-sm mb-3">Student Results Overview</h3>
                  {growthCheckOverview.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No student attempts yet.</p>
                  ) : (
                    <div className="overflow-x-auto -mx-2 px-2">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="py-2 px-2">Student</th>
                            <th className="py-2 px-2">Grade Band</th>
                            <th className="py-2 px-2">Arise Score</th>
                            <th className="py-2 px-2">Window</th>
                            <th className="py-2 px-2">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {growthCheckOverview.map((r, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 px-2 font-medium">{r.studentName || r.student_name || r.displayName || "Student #" + (r.student_id || "—")}</td>
                              <td className="py-2 px-2">{r.gradeBand || r.grade_band || r.formGradeBand || "—"}</td>
                              <td className="py-2 px-2">{r.ariseScore ?? r.arise_reading_score ?? r.score ?? "—"}</td>
                              <td className="py-2 px-2 capitalize">{r.windowName || r.window_name || "—"}</td>
                              <td className="py-2 px-2 text-muted-foreground">{r.dateTaken || r.submitted_at || r.completedAt || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Student detail dialog */}
      <Dialog open={!!pointsStudent} onOpenChange={(open) => { if (!open && !manualSaving) setPointsStudent(null); }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle>Add points for {pointsStudent?.displayName}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted/40" role="tablist" aria-label="What are you adding?">
            <button type="button" role="tab" aria-selected={awardMode === "quiz"} onClick={() => { setAwardMode("quiz"); setManualError(""); }} className={`py-2 rounded-md text-sm font-semibold ${awardMode === "quiz" ? "bg-background shadow" : "text-muted-foreground"}`}>Book quiz</button>
            <button type="button" role="tab" aria-selected={awardMode === "points"} onClick={() => { setAwardMode("points"); setManualError(""); }} className={`py-2 rounded-md text-sm font-semibold ${awardMode === "points" ? "bg-background shadow" : "text-muted-foreground"}`}>Other points</button>
          </div>
          {awardMode === "quiz" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">For a book quiz taken on paper. It's saved as a real quiz result: the student gets the book's points at 70% or higher, it shows in their quiz list, and it unlocks games just like a quiz taken on the computer.</p>
              <div>
                <Label htmlFor="quiz-book">Book</Label>
                {quizBookId ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border">
                    <span className="text-sm font-medium truncate">{books.find(b => b.id === quizBookId)?.title} <span className="text-muted-foreground font-normal">· {books.find(b => b.id === quizBookId)?.pointsValue ?? 0} pts</span></span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setQuizBookId(null)}>Change</Button>
                  </div>
                ) : (
                  <>
                    <Input id="quiz-book" placeholder="Search by title or author" value={quizBookSearch} onChange={e => setQuizBookSearch(e.target.value)} autoComplete="off" />
                    {quizBookSearch.trim().length >= 2 && (
                      <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                        {books.filter(b => `${b.title} ${b.author}`.toLowerCase().includes(quizBookSearch.trim().toLowerCase())).slice(0, 30).map(b => (
                          <li key={b.id}><button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/40" onClick={() => setQuizBookId(b.id)}>
                            <span className="font-medium">{b.title}</span> <span className="text-muted-foreground">· {b.author} · {b.pointsValue ?? 0} pts</span>
                          </button></li>
                        ))}
                        {!books.some(b => `${b.title} ${b.author}`.toLowerCase().includes(quizBookSearch.trim().toLowerCase())) && <li className="px-3 py-2 text-sm text-muted-foreground">{books.length ? "No book matches that." : "Loading books…"}</li>}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label htmlFor="quiz-score">Number correct</Label><Input id="quiz-score" type="number" min="0" step="1" value={quizScore} onChange={e => setQuizScore(e.target.value)} /></div>
                <div><Label htmlFor="quiz-total">Out of</Label><Input id="quiz-total" type="number" min="1" step="1" placeholder="10" value={quizTotal} onChange={e => setQuizTotal(e.target.value)} /></div>
              </div>
              {quizScore !== "" && quizTotal !== "" && Number(quizTotal) > 0 && (
                <p className={`text-sm ${Number(quizScore) >= Math.ceil(Number(quizTotal) * 0.7) ? "text-emerald-400" : "text-amber-400"}`}>
                  {Math.round((Number(quizScore) / Number(quizTotal)) * 100)}%: {Number(quizScore) >= Math.ceil(Number(quizTotal) * 0.7) ? `passes, earns ${books.find(b => b.id === quizBookId)?.pointsValue ?? "the book's"} points and counts toward unlocking games` : "under 70%, saved with no points"}
                </p>
              )}
              <div><Label htmlFor="quiz-date">Date taken</Label><Input id="quiz-date" type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} /></div>
              <p className="text-xs text-muted-foreground">Games unlock for the week the quiz is dated, so use today's date for a quiz they just finished.</p>
              {manualError && <p role="alert" className="text-sm text-destructive">{manualError}</p>}
              {awardNotice && <p role="status" className="text-sm text-emerald-400">{awardNotice}</p>}
              <Button disabled={manualSaving} onClick={creditBookQuiz} className="w-full">{manualSaving ? "Saving..." : "Save quiz result"}</Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">For anything that isn't a book quiz. This adds points to the student's total and the month of the date earned, but doesn't count as a quiz or unlock games.</p>
              <div className="space-y-3">
                <div><Label htmlFor="manual-points">Points</Label><Input id="manual-points" type="number" min="1" max="1000" step="1" value={manualPoints} onChange={e => setManualPoints(e.target.value)} /></div>
                <div><Label htmlFor="manual-reason">Reason</Label><Input id="manual-reason" maxLength={200} placeholder="Reading log, class reward…" value={manualReason} onChange={e => setManualReason(e.target.value)} /></div>
                <div><Label htmlFor="manual-date">Date earned</Label><Input id="manual-date" type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} /></div>
                {manualError && <p role="alert" className="text-sm text-destructive">{manualError}</p>}
                <Button disabled={manualSaving} onClick={awardManualPoints} className="w-full">{manualSaving ? "Saving..." : "Award points"}</Button>
              </div>
            </>
          )}
          <div className="max-h-40 overflow-y-auto text-sm space-y-1">
            <p className="font-medium">Recent manual awards</p>
            {manualHistory.length === 0 ? <p className="text-muted-foreground">No manual awards recorded.</p> : manualHistory.map(a => (
              <p key={a.id}>{a.earned_on}: +{a.points} points — {a.reason}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailStudent} onOpenChange={(open) => { if (!open) { setDetailStudent(null); setStudentDetail(null); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-2xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-lg">
              <Users className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{detailStudent?.displayName}</span>
            </DialogTitle>
          </DialogHeader>
          {detailStudent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" className="w-full" onClick={() => printParentInvites(detailStudent.id).catch(e => window.alert(e.message))}>
                Print parent letter
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const authToken = token || getTokenFromCookie();
                  if (!authToken) return;
                  const res = await fetch(`${API_BASE}/api/admin/students/${detailStudent.id}/reset-daily-challenge`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    window.alert(data.message || "Daily Challenge reset.");
                  } else {
                    window.alert(data.message || "Could not reset Daily Challenge.");
                  }
                }}
              >
                Reset Daily Challenge
              </Button>
            </div>
          )}
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : studentDetail ? (
            <div className="space-y-4">
              {/* Student info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
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

              {/* Everything the student has done */}
              <div className="p-3 rounded-xl border border-border">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold text-sm">Activity</h4>
                  <Button size="sm" variant="outline" onClick={() => detailStudent && openManualPoints(detailStudent)}>Add points or a paper quiz</Button>
                </div>
                {detailStudent && <StudentActivity studentId={detailStudent.id} token={token || getTokenFromCookie() || ""} refreshKey={activityKey} />}
              </div>

              {/* Assign School */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <Label className="text-xs text-muted-foreground mb-2 block">Assign School</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    className="w-full sm:flex-1 px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm"
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    className="w-full sm:flex-1 px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm"
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
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="w-10 h-14 sm:w-8 sm:h-12 flex-shrink-0">
                          {q.coverUrl ? (
                            <img src={q.coverUrl} alt={q.title} className="w-full h-full object-cover rounded" />
                          ) : (
                            <div className="w-full h-full rounded bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{q.title}</p>
                          <p className="text-xs text-muted-foreground">{q.pointsValue || 10} pts</p>
                          {q.proctorType && (
                            <p className={`mt-1 text-[11px] font-bold ${q.proctorType === "camera" ? "text-amber-300" : q.proctorType === "parent" ? "text-cyan-300" : "text-violet-300"}`}>
                              {q.proctorType === "paper" ? "Paper quiz · entered by staff" : q.proctorType === "camera" ? "On their own · camera on" : q.proctorType === "parent" ? "Parent proctored" : "Teacher / staff proctored"}
                              {q.proctorName && q.proctorType !== "camera" && q.proctorType !== "paper" ? ` · ${q.proctorName}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="w-full sm:w-auto flex sm:block items-center justify-between sm:text-right flex-shrink-0">
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
                        <div className="shrink-0 ml-2 text-right">
                          <span className="font-semibold">{h.score}/{h.total}</span>
                          {h.proctor_type && (
                            <div className={`text-[10px] font-bold ${h.proctor_type === "parent" ? "text-cyan-300" : "text-violet-300"}`}>
                              {h.proctor_type === "parent" ? "Parent" : "Teacher / staff"}{h.proctor_name ? ` · ${h.proctor_name}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* i-Ready entry form */}
                <div className="rounded-lg border border-border p-3 bg-muted/20">
                  <div className="text-xs font-semibold mb-2 text-muted-foreground">Enter i-Ready Reading Score (bypasses initial assessment)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-2xl max-h-[92dvh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex flex-wrap items-center gap-2">
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
                    <div className="flex flex-col sm:flex-row gap-2">
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
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                      <div className="flex flex-wrap items-center gap-2">
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
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
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
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-3xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
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
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Label className="text-sm font-medium">Grade Band</Label>
                  <button type="button" onClick={handleSuggestBand} disabled={bandSuggesting || !quizForm.title.trim()} className="text-xs px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {bandSuggesting ? "Suggesting..." : "Suggest Band"}
                  </button>
                </div>
                {bandSuggestion && (
                  <p className="text-xs text-green-400">Suggested: <span className="font-semibold">{bandSuggestion}</span></p>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{qi + 1}</span>
                        <Input value={q.question} onChange={(e) => {
                          const newQs = [...questions];
                          newQs[qi] = { ...q, question: e.target.value };
                          setQuestions(newQs);
                        }} placeholder="Question text" className="h-8 text-sm" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
