import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import MonthCountdown from "@/components/MonthCountdown";
import { monthLabel, schoolYearMonth } from "@shared/schoolMonth";
import { isSampleAccount } from "@shared/sampleAccounts";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell, type NotificationCounts } from "@/components/NotificationBell";
import { ReportProblemButton } from "@/components/ReportProblemButton";
import TheaterAdmin from "@/components/TheaterAdmin";
import UnlistedSignupsCard from "@/components/UnlistedSignupsCard";
import SchoolUsListMatch from "@/components/SchoolUsListMatch";
import NoProctorReview from "@/components/NoProctorReview";
import ArchivedProfilesCard from "@/components/ArchivedProfilesCard";
import AdminPlans from "@/components/AdminPlans";
import PlayTimeManager from "@/components/PlayTimeManager";
import StudentActivity from "@/components/StudentActivity";
import AdminInbox from "@/components/admin/AdminInbox";
import AlertSettingsCard from "@/components/admin/AlertSettings";
import BookPointsDialog from "@/components/admin/BookPointsDialog";
// charts are only downloaded when the Stats tab is opened
const AdminStats = lazy(() => import("@/components/admin/AdminStats"));
import {
  ActionMenu, AdminSection, CountBadge, EmptyState, INPUT_CLASS, PersonRow, SELECT_CLASS, SegmentedTabs, StatTile, StatusPill,
} from "@/components/admin/AdminUi";
import { useToast } from "@/hooks/use-toast";
import { refreshNotifications } from "@/lib/notifications";
import { printParentInvites } from "@/lib/parentInvites";
import { cn } from "@/lib/utils";
import {
  Users, KeyRound, Send, Trophy, BookOpen, Eye, PlusCircle, ImagePlus, Mail, Inbox, X, ClipboardPaste, Copy, LogOut,
  MessageSquarePlus, CheckCircle2, Search, ChevronDown, ChevronLeft, ChevronRight, Building, FileQuestion, FileSearch,
  RotateCcw, Brain, Trash2, BarChart3, Gift, Check, ShieldCheck, Clock3, Archive, Printer, LayoutDashboard, ListTodo,
  GraduationCap, Library, Settings, BellRing, Megaphone, Gamepad2, Sparkles, MoreVertical, UserPlus, PartyPopper,
  TrendingUp, School, SlidersHorizontal, Camera,
  ClipboardList,
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
  quizzesMastered?: number;
  schoolId?: number | null;
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
    proctorType?: "parent" | "teacher" | "camera" | "paper" | null;
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
  /** True when the admin chose this book's points (AR BookFinder then leaves them alone). */
  pointsSetByAdmin?: boolean;
  arPoints?: number | null;
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

type AdminTab = "overview" | "stats" | "todo" | "inbox" | "people" | "library" | "schools" | "settings";
type PeopleTab = "students" | "teachers" | "parents" | "archived";
type SettingsSection = "alerts" | "banners" | "club" | "ai" | "extras" | "security";
const ADMIN_TABS: AdminTab[] = ["overview", "stats", "todo", "inbox", "people", "library", "schools", "settings"];
const TAB_STORAGE = "arise_admin_tab";

// Module-level cache — survives component unmount/remount during navigation
let adminCache: { students: Student[]; books: BookItem[] } = {
  students: [],
  books: [],
};

export default function Admin() {
  const { user, token, logout, startAdminPreview } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const say = useCallback((text: string, ok = true) => {
    toast({ title: ok ? text : "Something went wrong", description: ok ? undefined : text, variant: ok ? "default" : "destructive" });
  }, [toast]);
  const [students, setStudents] = useState<Student[]>(adminCache.students);
  // sample accounts (made to try the site out) are kept out of the student and parent counts
  const [sampleStudents, setSampleStudents] = useState<any[]>([]);
  const [sampleParents, setSampleParents] = useState<any[]>([]);
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
  // The book whose points are being set in the Library.
  const [pointsBook, setPointsBook] = useState<BookItem | null>(null);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const bellActionRef = useRef(-1);
  const [inboxOpen, setInboxOpen] = useState<{ userId: number; nonce: number } | null>(null);
  // Which part of the page is showing. Kept for the browser tab, so a refresh comes back here.
  const [tab, setTabState] = useState<AdminTab>(() => {
    try { const saved = sessionStorage.getItem(TAB_STORAGE) as AdminTab | null; return saved && ADMIN_TABS.includes(saved) ? saved : "overview"; } catch { return "overview"; }
  });
  const [peopleTab, setPeopleTab] = useState<PeopleTab>("students");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("alerts");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showResolvedReviews, setShowResolvedReviews] = useState(false);
  const [showCompletedRequests, setShowCompletedRequests] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [lbExpanded, setLbExpanded] = useState(false);
  // AI Quiz Review state
  const [pendingQuizzes, setPendingQuizzes] = useState<any[]>([]);
  const [expandedQuiz, setExpandedQuiz] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingQuizId, setRejectingQuizId] = useState<number | null>(null);
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
  // this month's race by default; all-time is one click away
  const [adminLbPeriod, setAdminLbPeriodState] = useState<"month" | "all">("month");
  const adminLbPeriodRef = useRef<"month" | "all">("month");
  const adminLbBandRef = useRef("");
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
      const everyStudent = (Array.isArray(data) ? data : []).filter((s: any) => s.role === 'student' || (!s.role && !s.isAdmin));
      const studentsArr = everyStudent.filter((s: any) => !isSampleAccount(s));
      setSampleStudents(everyStudent.filter((s: any) => isSampleAccount(s)));
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

  const setTab = useCallback((next: AdminTab) => {
    setTabState(next);
    try { sessionStorage.setItem(TAB_STORAGE, next); } catch {}
  }, []);

  /** Shows a tab (and part of it), then scrolls to an element on it and briefly highlights it. */
  const goTo = useCallback((next: AdminTab, targetId?: string, sub?: { people?: PeopleTab; settings?: SettingsSection }) => {
    setTab(next);
    if (sub?.people) setPeopleTab(sub.people);
    if (sub?.settings) setSettingsSection(sub.settings);
    if (!targetId) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setHighlightId(targetId);
    let tries = 0;
    const find = () => {
      const el = document.getElementById(targetId);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (++tries < 20) window.setTimeout(find, 100);
    };
    window.setTimeout(find, 60);
    window.setTimeout(() => setHighlightId((current) => (current === targetId ? null : current)), 4000);
  }, [setTab]);

  const openConversation = useCallback((userId: number) => {
    setTab("inbox");
    setInboxOpen({ userId, nonce: Date.now() });
    window.scrollTo({ top: 0 });
  }, [setTab]);

  const handleNotifNavigate = (type: string, id: number) => {
    if (type === "request") {
      goTo("todo", "quiz-requests");
      const req = quizRequests.find(r => r.id === id);
      if (req) handleCreateQuizFromRequest(req);
    } else if (type === "teacher") {
      goTo("people", pendingTeachers.some((t) => t.id === id) ? "pending-teachers" : `teacher-${id}`, { people: "teachers" });
    } else if (type === "parent") {
      goTo("people", pendingParents.some((p) => p.id === id) ? "pending-parents" : `parent-${id}`, { people: "parents" });
    } else if (type === "user") {
      goTo("people", "pending-students", { people: "students" });
    } else if (type === "unlisted") {
      goTo("people", "unlisted-signups", { people: "students" });
    } else if (type === "student") {
      const student = students.find((s) => s.id === id);
      goTo("people", undefined, { people: "students" });
      if (student) void handleViewStudent(student);
    } else if (type === "ai_quiz") {
      setExpandedQuiz(id);
      goTo("todo", "ai-quiz-review");
    } else if (type === "review") {
      goTo("todo", "grade-reviews");
      void handleViewReview(id);
    } else if (type === "club") {
      goTo("todo", "club-signups");
    } else if (type === "grade_change" || type === "eye_gaze") {
      goTo("todo", "student-requests");
    } else if (type === "message") {
      openConversation(id);
    } else {
      goTo("overview");
    }
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
        refreshNotifications();
        say("Request marked done.");
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
          handleNotifNavigate(String(type), parseInt(id));
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
      setUnreadMsgCount(0);
      setQuizRequests([]);
      setReviewRequests([]);
    };
    window.addEventListener("arise-logout", clearCaches);
    return () => window.removeEventListener("arise-logout", clearCaches);
  }, []);

  const fetchPendingQuizzes = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/pending-quizzes`, { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPendingQuizzes(data.pending || []);
      }
    } catch {}
  };

  const fetchClubSignups = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/club-signups`, { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setClubSignups(data.signups || []);
      }
    } catch {}
  };

  const setClubStatus = async (signupId: number, status: "confirmed" | "denied") => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/club-signups/${signupId}/status`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setClubSignups((list) => list.map((s) => (s.id === signupId ? { ...s, status } : s)));
      say(status === "confirmed" ? "Reading Club sign-up confirmed." : "Reading Club sign-up denied.");
      refreshNotifications();
      void fetchClubSignups();
    } catch {
      say("Couldn't update that sign-up. Please try again.", false);
    }
  };

  // Everything on the to-do list, reloaded when the bell sees something change.
  const refreshTodo = () => {
    void fetchPendingQuizzes();
    void fetchClubSignups();
    void fetchQuizRequests();
    void fetchReviewRequests();
    void fetchGradeChangeRequests();
    void fetchEyeGazeRequests();
    void fetchTeachers();
    void fetchPendingParents();
    void fetchStudents();
  };

  useEffect(() => {
    void fetchPendingQuizzes();
    void fetchClubSignups();
  }, []);

  const handleBellCounts = (counts: NotificationCounts) => {
    setUnreadMsgCount(counts.inboxUnread);
    // Something was added or dealt with somewhere else: reload the lists it could be on.
    if (bellActionRef.current >= 0 && bellActionRef.current !== counts.actionCount) refreshTodo();
    bellActionRef.current = counts.actionCount;
  };

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
        say("Quiz approved and published. The student has been told.");
        refreshNotifications();
      } else {
        const data = await res.json().catch(() => ({}));
        say(data.message || "Couldn't approve that quiz.", false);
      }
    } catch { say("Couldn't approve that quiz.", false); }
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
        say("Quiz rejected. The student has been told.");
        refreshNotifications();
      } else {
        say("Couldn't reject that quiz.", false);
      }
    } catch { say("Couldn't reject that quiz.", false); }
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
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || err.error || "Failed to save window"); }
      const body = await res.json();
      const { window: _saved, ...updated } = body;
      setGrowthCheckWindows(prev => {
        // only one window is open at a time: opening this one closes the others
        const others = updated.is_active ? prev.map(w => (w.id === updated.id ? w : { ...w, is_active: false })) : prev;
        const idx = others.findIndex(w => w.id === updated.id);
        if (idx >= 0) { const n = [...others]; n[idx] = updated; return n; }
        return [...others, updated];
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
        say(data.hasEmail ? "Parent approved. We emailed them." : "Parent approved. There's no email on file, so let them know yourself.");
        fetchPendingParents();
        fetchAllParents();
        refreshNotifications();
      } else {
        const data = await res.json().catch(() => ({}));
        say(data.message || "Failed to approve parent", false);
      }
    } catch {
      say("Failed to approve parent", false);
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
        say("Parent account rejected.");
        fetchPendingParents();
        fetchAllParents();
        refreshNotifications();
      } else {
        say("Failed to reject parent", false);
      }
    } catch {
      say("Failed to reject parent", false);
    }
  };

  const fetchAllParents = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/all-parents`, { headers: { Authorization: `Bearer ${token || getTokenFromCookie()}` } });
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      setAllParents(list.filter((p: any) => !isSampleAccount(p)));
      setSampleParents(list.filter((p: any) => isSampleAccount(p)));
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
        alert(`Password reset. New password: ${newPassword}`);
      } else {
        say("Failed to reset password.", false);
      }
    } catch {
      say("Network error. Please try again.", false);
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
        say(data.hasEmail ? "Parent approved. We emailed them." : "Parent approved. There's no email on file.");
        fetchAllParents();
        fetchPendingParents();
        refreshNotifications();
      } else {
        say("Failed to approve parent.", false);
      }
    } catch {
      say("Failed to approve parent.", false);
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
        say(action === 'approve' ? "Grade change approved." : "Grade change denied.");
        await fetchGradeChangeRequests();
        refreshNotifications();
      } else {
        const data = await res.json();
        say(data.message || 'Failed to process request', false);
      }
    } catch (err) {
      say('Error processing request', false);
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
        say(approved ? "Eye Gaze request approved." : "Eye Gaze request denied.");
        await fetchEyeGazeRequests();
        await fetchStudents();
        refreshNotifications();
      } else {
        const data = await res.json();
        say(data.message || 'Failed to process request', false);
      }
    } catch (err) {
      say('Error processing request', false);
    }
  };

  // Fetch admin leaderboard with optional band filter
  const fetchAdminLeaderboard = async (band: string = adminLbBandRef.current, period: "month" | "all" = adminLbPeriodRef.current) => {
    if (!token) return;
    adminLbBandRef.current = band;
    setAdminLbLoading(true);
    try {
      const params = new URLSearchParams();
      if (band) params.set("band", band);
      if (period === "month") params.set("month", schoolYearMonth());
      const url = `${API_BASE}/api/leaderboard${params.toString() ? `?${params.toString()}` : ""}`;
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

  const setAdminLbPeriod = (period: "month" | "all") => {
    adminLbPeriodRef.current = period;
    setAdminLbPeriodState(period);
    void fetchAdminLeaderboard(adminLbBandRef.current, period);
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
    const bandLabel = (adminLbPeriod === "month" ? monthLabel(schoolYearMonth()).toUpperCase() + " • " : "ALL-TIME • ") + (adminLbBand ? adminLbBand + " BAND" : "ALL READING BANDS");
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
        refreshNotifications();
        say(data.hasEmail ? "Teacher account turned on. We emailed them." : "Teacher account turned on. There's no email on file, so let them know yourself.");
      } else {
        say(data.message || "Failed to approve teacher. Please try again.", false);
      }
    } catch {
      say("Network error. Please refresh the page and try again.", false);
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
        refreshNotifications();
        say(`${name} was deleted.`);
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
      refreshNotifications();
      say(`${name} was archived. Restore them anytime from People → Archived.`);
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
        say(`${studentName} is approved. They'll see a welcome message next time they log in.`);
        fetchStudents();
        refreshNotifications();
      } else {
        say("Failed to approve student. Please try again.", false);
      }
    } catch {
      say("Network error. Please refresh and try again.", false);
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
          refreshNotifications();
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
      refreshNotifications();
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

  const totalQuizzes = (students || []).reduce((sum, s) => sum + (s?.quizzesTaken || 0), 0);
  const totalMastered = (students || []).reduce((sum, s) => sum + (s?.quizzesMastered || 0), 0);

  // ─── Page layout ─────────────────────────────────────────────────────────────
  const pendingStudentList = (students || []).filter((s) => s.approvedByTeacher === false);
  const pendingReviewList = reviewRequests.filter((r) => r.status === "pending");
  const resolvedReviewList = reviewRequests.filter((r) => r.status !== "pending");
  const pendingRequestList = quizRequests.filter((r) => r.status !== "completed");
  const completedRequestList = quizRequests.filter((r) => r.status === "completed");
  const pendingClubList = clubSignups.filter((s) => s.status === "pending");
  const otherClubList = clubSignups.filter((s) => s.status !== "pending");
  const studentRequestCount = gradeChangeRequests.length + eyeGazeRequests.length;
  const todoCount = pendingQuizzes.length + pendingReviewList.length + pendingRequestList.length + pendingClubList.length + studentRequestCount;
  const peopleAttention = pendingTeachers.length + pendingParents.length + pendingStudentList.length;
  const schoolName = (id?: number | null) => (id ? schools.find((s: any) => Number(s.id) === Number(id))?.name || "" : "");

  const attention = [
    { count: pendingQuizzes.length, label: "AI quizzes to review", icon: Brain, tone: "violet" as const, go: () => goTo("todo", "ai-quiz-review") },
    { count: pendingReviewList.length, label: "Grade reviews requested", icon: FileSearch, tone: "orange" as const, go: () => goTo("todo", "grade-reviews") },
    { count: pendingRequestList.length, label: "Quiz requests", icon: MessageSquarePlus, tone: "orange" as const, go: () => goTo("todo", "quiz-requests") },
    { count: studentRequestCount, label: "Grade change & Eye Gaze requests", icon: TrendingUp, tone: "amber" as const, go: () => goTo("todo", "student-requests") },
    { count: pendingClubList.length, label: "Reading Club sign-ups", icon: PartyPopper, tone: "amber" as const, go: () => goTo("todo", "club-signups") },
    { count: unreadMsgCount, label: "Unread messages", icon: Inbox, tone: "emerald" as const, go: () => goTo("inbox") },
    { count: pendingTeachers.length, label: "Teacher accounts not turned on", icon: GraduationCap, tone: "amber" as const, go: () => goTo("people", "pending-teachers", { people: "teachers" }) },
    { count: pendingParents.length, label: "Parents waiting for approval", icon: ShieldCheck, tone: "cyan" as const, go: () => goTo("people", "pending-parents", { people: "parents" }) },
    { count: pendingStudentList.length, label: "Students waiting for a teacher's OK", icon: Users, tone: "blue" as const, go: () => goTo("people", "pending-students", { people: "students" }) },
  ].filter((item) => item.count > 0);

  const NAV: { id: AdminTab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "todo", label: "To-do", icon: ListTodo, badge: todoCount },
    { id: "inbox", label: "Inbox", icon: Inbox, badge: unreadMsgCount },
    { id: "people", label: "People", icon: Users, badge: peopleAttention },
    { id: "library", label: "Library", icon: Library },
    { id: "schools", label: "Schools & plans", icon: School },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const openReward = (s: Student) => {
    setRewardStudent(s);
    setRewardTitle(""); setRewardMessage(""); setRewardQuizCount(""); setRewardExpiresAt("");
    setRewardSuccess("");
    fetchRewards(s.id);
  };

  const resetDailyChallenge = async (s: { id: number; displayName: string }) => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/students/${s.id}/reset-daily-challenge`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json().catch(() => ({}));
      say(res.ok ? (data.message || `${s.displayName}'s Daily Challenge was reset.`) : (data.message || "Could not reset the Daily Challenge."), res.ok);
    } catch {
      say("Could not reset the Daily Challenge.", false);
    }
  };

  const assignTeacherSchool = async (teacherId: number, value: string) => {
    const schoolId = value ? parseInt(value) : null;
    const authToken = token || getTokenFromCookie();
    try {
      const res = await fetch(`${API_BASE}/api/admin/teachers/${teacherId}/assign-school`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      if (!res.ok) throw new Error();
      setAllTeachers((list) => list.map((t) => (t.id === teacherId ? { ...t, school_id: schoolId } : t)));
      say("School updated.");
    } catch {
      say("Couldn't change the school. Please try again.", false);
    }
  };

  const toggleTeacherGrade = async (teacherId: number, grade: string) => {
    if (!grade) return;
    const authToken = token || getTokenFromCookie();
    const currentGrades: string[] = (window as any).__teacherGrades?.[teacherId] || [];
    const newGrades = currentGrades.includes(grade) ? currentGrades.filter((g) => g !== grade) : [...currentGrades, grade];
    try {
      const res = await fetch(`${API_BASE}/api/admin/teachers/${teacherId}/assign-grades`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ grades: newGrades }),
      });
      if (!res.ok) throw new Error();
      (window as any).__teacherGrades = (window as any).__teacherGrades || {};
      (window as any).__teacherGrades[teacherId] = newGrades;
      say(currentGrades.includes(grade) ? `Grade ${grade} removed.` : `Grade ${grade} added.`);
      fetchTeachers();
    } catch {
      say("Couldn't change the grades. Please try again.", false);
    }
  };

  const gradeToBandLabel = (g: string) => {
    if (['K', '1', '2'].includes(g)) return 'K-2';
    if (['3', '4', '5'].includes(g)) return '3-5';
    if (['6', '7', '8'].includes(g)) return '6-8';
    if (['9', '10', '11', '12'].includes(g)) return '9-12';
    return '';
  };
  const filteredStudents = (students || []).filter((s) => {
    const q = studentSearch.toLowerCase();
    const nameMatch = (s?.displayName || "").toLowerCase().includes(q) || (s?.username || "").toLowerCase().includes(q);
    if (!nameMatch) return false;
    const sGrade = userGradesMap[String(s.id)] || '';
    if (filterBand && gradeToBandLabel(sGrade) !== filterBand) return false;
    if (filterSchool && String(s.schoolId || '') !== filterSchool) return false;
    if (filterGrade && sGrade !== filterGrade) return false;
    if (filterTeacher && String(s.teacherId || '') !== filterTeacher) return false;
    return true;
  });
  const activeFilterCount = [filterBand, filterSchool, filterGrade, filterTeacher].filter(Boolean).length;

  const sectionGroup = "divide-y divide-border/60 [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0";

  const overviewTab = (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-black sm:text-2xl">Welcome back{user?.displayName ? `, ${user.displayName}` : ""}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's what's happening on A.R.I.S.E. Reader.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatTile icon={Users} tone="blue" label="Students" value={students.length} />
        <StatTile icon={GraduationCap} tone="amber" label="Teachers" value={allTeachers.length} />
        <StatTile icon={ShieldCheck} tone="cyan" label="Parents" value={allParents.length} />
        <StatTile icon={BookOpen} tone="emerald" label="Quizzes taken" value={totalQuizzes} />
        <StatTile icon={Trophy} tone="violet" label="Quizzes passed" value={totalMastered} />
        <StatTile icon={FileQuestion} tone="orange" label="Quizzes available" value={quizCount} hint={`${books.filter(b => b.readUrl).length} books to read online`} />
      </div>
      <button
        type="button"
        onClick={() => goTo("stats")}
        data-testid="open-stats"
        className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/[.07] p-3 text-left transition-colors hover:bg-violet-500/[.12] sm:p-4"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><BarChart3 className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Stats and charts</span>
          <span className="block text-xs text-muted-foreground">Growth over time, who's online, sign-ins, quizzes and the students who haven't been on lately.</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>

      <AdminSection
        id="needs-attention"
        icon={ListTodo}
        tone="fuchsia"
        title="Needs your attention"
        count={attention.reduce((sum, item) => sum + item.count, 0)}
        description="Items leave this list, and the bell, as soon as they're dealt with."
      >
        {attention.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="You're all caught up" hint="New requests, messages and approvals will show up here." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {attention.map((item) => (
              <li key={item.label}>
                <button type="button" onClick={item.go} className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", item.tone === "violet" ? "bg-violet-500/15 text-violet-300" : item.tone === "orange" ? "bg-orange-500/15 text-orange-300" : item.tone === "amber" ? "bg-amber-500/15 text-amber-300" : item.tone === "emerald" ? "bg-emerald-500/15 text-emerald-300" : item.tone === "cyan" ? "bg-cyan-500/15 text-cyan-300" : "bg-blue-500/15 text-blue-300")}>
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{item.label}</span>
                  <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-fuchsia-500/15 px-2 text-sm font-black tabular-nums text-fuchsia-200">{item.count}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection id="quick-actions" icon={Sparkles} tone="cyan" title="Quick actions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Button variant="outline" className="h-auto justify-start gap-2 whitespace-normal py-3 text-left leading-snug" onClick={() => setShowAddQuiz(true)}><PlusCircle className="h-4 w-4" />Add a quiz</Button>
          <Button variant="outline" className="h-auto justify-start gap-2 whitespace-normal py-3 text-left leading-snug" onClick={() => goTo("inbox")}><MessageSquarePlus className="h-4 w-4" />Send a message</Button>
          <Button variant="outline" className="h-auto justify-start gap-2 whitespace-normal py-3 text-left leading-snug" onClick={() => { setShowTeacherForm(true); goTo("people", "teacher-form", { people: "teachers" }); }}><UserPlus className="h-4 w-4" />Add a teacher</Button>
          <Button variant="outline" className="h-auto justify-start gap-2 whitespace-normal py-3 text-left leading-snug" onClick={() => { startAdminPreview("regular"); navigate("/profile"); }}><Users className="h-4 w-4" />View as a student</Button>
          <Button variant="outline" className="h-auto justify-start gap-2 whitespace-normal py-3 text-left leading-snug" onClick={() => { startAdminPreview("eye-gaze"); navigate("/eye-gaze-home"); }}><Eye className="h-4 w-4" />View as an Eye Gazer</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Previews show A.R.I.S.E. exactly like a student. Quiz results in a preview don't count on leaderboards or competitions.</p>
      </AdminSection>

      <AdminSection
        id="leaderboard"
        icon={Trophy}
        tone="amber"
        title="Leaderboard"
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Leaderboard period">
            <button type="button" onClick={() => setAdminLbPeriod("month")} aria-pressed={adminLbPeriod === "month"} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", adminLbPeriod === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} data-testid="button-admin-lb-month">This month</button>
            <button type="button" onClick={() => setAdminLbPeriod("all")} aria-pressed={adminLbPeriod === "all"} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", adminLbPeriod === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} data-testid="button-admin-lb-all">All-time</button>
          </div>
          <select
            value={adminLbBand}
            onChange={(e) => { setAdminLbBand(e.target.value); fetchAdminLeaderboard(e.target.value); }}
            className={cn(SELECT_CLASS, "sm:w-40")}
            aria-label="Reading band"
          >
            <option value="">All bands</option>
            <option value="K-2">K-2 band</option>
            <option value="3-5">3-5 band</option>
            <option value="6-8">6-8 band</option>
            <option value="9-12">9-12 band</option>
          </select>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {adminLbPeriod === "month"
            ? <MonthCountdown compact onNewMonth={() => { void fetchAdminLeaderboard(); }} />
            : <p className="text-xs text-muted-foreground">All-time points</p>}
          <button type="button" onClick={() => navigate("/leaderboard")} className="text-xs font-semibold text-primary hover:underline" data-testid="button-admin-lb-open">Open full leaderboard</button>
        </div>
        {adminLbLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : adminLeaderboard.length === 0 ? (
          <EmptyState icon={Trophy} title={adminLbPeriod === "month" ? `No points yet in ${monthLabel(schoolYearMonth())}` : "No students in this band yet"} />
        ) : (
          <ol className="space-y-2">
            {adminLeaderboard.slice(0, lbExpanded ? 20 : 5).map((entry: any, idx: number) => (
              <li key={entry.id} className="grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-3 rounded-xl bg-muted/30 p-3">
                <span className={cn("grid h-9 w-9 place-items-center rounded-full text-sm font-bold", idx === 0 ? "bg-amber-400/20 text-amber-300" : idx === 1 ? "bg-slate-300/15 text-slate-200" : idx === 2 ? "bg-orange-500/15 text-orange-300" : "bg-muted text-muted-foreground")}>{idx + 1}</span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium sm:text-base">{entry.displayName}</span>
                    {(entry.isEyeGaze || entry.isEyeGazeUser) && <StatusPill tone="blue">EG</StatusPill>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
                    <span>{entry.quizzesTaken} quizzes</span>
                    {entry.schoolName && <span className="truncate">· {entry.schoolName}</span>}
                    {entry.grade && <span>· Gr {entry.grade}</span>}
                  </span>
                </span>
                <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-right">
                  <span className="block text-base font-bold leading-none text-primary">{entry.totalPoints}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">pts</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {adminLeaderboard.length > 5 && (
          <button type="button" onClick={() => setLbExpanded(!lbExpanded)} className="mt-3 text-sm font-semibold text-primary hover:underline">
            {lbExpanded ? "Show top 5" : `Show top ${Math.min(20, adminLeaderboard.length)}`}
          </button>
        )}
        <details className="group mt-4 rounded-xl border border-border/70 bg-muted/10 p-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
            <Printer className="h-4 w-4 text-primary" /> Print a hallway poster
            <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={adminLbPrintCount}
                onChange={(e) => setAdminLbPrintCount(e.target.value)}
                className={cn(SELECT_CLASS, "sm:w-44")}
                aria-label="Number of leaderboard students to print"
              >
                <option value="3">Top 3</option>
                <option value="5">Top 5</option>
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
                <option value="all">All students</option>
              </select>
              <Button type="button" onClick={printAdminLeaderboard} disabled={adminLbLoading || adminLeaderboard.length === 0} className="gap-2 font-semibold">
                <Printer className="h-4 w-4" /> Print hallway poster
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
          </div>
        </details>
      </AdminSection>
    </div>
  );

  const todoTab = (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-black sm:text-2xl">To-do</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything waiting for you. Each item leaves this page, and the bell, once it's handled.</p>
      </div>

      <AdminSection id="ai-quiz-review" icon={Brain} tone="violet" title="AI quiz review" count={pendingQuizzes.length} description="Students made these quizzes with AI. Check the questions, then approve or reject. The student is told either way.">
        {pendingQuizzes.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No AI quizzes waiting" />
        ) : (
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
                      className="self-start rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-muted"
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
        )}
      </AdminSection>

      <AdminSection id="grade-reviews" icon={FileSearch} tone="orange" title="Grade reviews" count={pendingReviewList.length} description="Students who think a quiz was graded wrong.">
        {reviewRequestsLoading && reviewRequests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : pendingReviewList.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No grade reviews waiting" />
        ) : (
          <div className="space-y-2">
            {pendingReviewList.map((r) => (
              <PersonRow
                key={r.id}
                id={`review-${r.id}`}
                name={r.studentName}
                avatarTone="orange"
                highlight={highlightId === `review-${r.id}` ? "orange" : undefined}
                meta={<>
                  <p>“{r.bookTitle}” · Score {r.original_score}/{r.total || 10} · {r.original_points} pts</p>
                  {r.reason && <p className="italic">“{r.reason}”</p>}
                </>}
                actions={<Button size="sm" onClick={() => handleViewReview(r.id)}><FileSearch className="h-4 w-4" />Review quiz</Button>}
              />
            ))}
          </div>
        )}
        {resolvedReviewList.length > 0 && (
          <div className="mt-4">
            <button type="button" onClick={() => setShowResolvedReviews(!showResolvedReviews)} className="text-sm font-semibold text-primary hover:underline">
              {showResolvedReviews ? "Hide finished reviews" : `Show finished reviews (${resolvedReviewList.length})`}
            </button>
            {showResolvedReviews && (
              <ul className="mt-2 divide-y divide-border/60 rounded-xl border border-border/70">
                {resolvedReviewList.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                    <span className="font-medium">{r.studentName}</span>
                    <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">“{r.bookTitle}”</span>
                    <span className="ml-auto text-xs text-emerald-300">{r.original_score} → {r.reviewed_score ?? "—"}/{r.total || 10} · {r.reviewed_points ?? 0} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </AdminSection>

      <AdminSection id="quiz-requests" icon={MessageSquarePlus} tone="orange" title="Quiz requests" count={pendingRequestList.length} description="Books students want a quiz for.">
        {quizRequestsLoading && quizRequests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : pendingRequestList.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No quiz requests waiting" />
        ) : (
          <div className="space-y-2">
            {pendingRequestList.map((req) => {
              const studentName = req.studentName || req.student?.displayName || req.student?.username || "Unknown student";
              return (
                <PersonRow
                  key={req.id}
                  id={`request-${req.id}`}
                  name={req.bookTitle}
                  avatarTone="orange"
                  highlight={highlightId === `request-${req.id}` ? "orange" : undefined}
                  meta={<>
                    {req.author && <p>by {req.author}</p>}
                    <p>Asked by {studentName} · {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </>}
                  actions={<>
                    <Button size="sm" onClick={() => handleCreateQuizFromRequest(req)}><PlusCircle className="h-4 w-4" />Create quiz</Button>
                    <Button size="sm" variant="outline" onClick={() => handleMarkRequestComplete(req.id)}><CheckCircle2 className="h-4 w-4" />Mark done</Button>
                  </>}
                />
              );
            })}
          </div>
        )}
        {completedRequestList.length > 0 && (
          <div className="mt-4">
            <button type="button" onClick={() => setShowCompletedRequests(!showCompletedRequests)} className="text-sm font-semibold text-primary hover:underline">
              {showCompletedRequests ? "Hide finished requests" : `Show finished requests (${completedRequestList.length})`}
            </button>
            {showCompletedRequests && (
              <ul className="mt-2 divide-y divide-border/60 rounded-xl border border-border/70">
                {completedRequestList.map((req) => (
                  <li key={req.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                    <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{req.bookTitle}</span>
                    <span className="text-xs text-muted-foreground">{req.studentName || req.student?.displayName || ""}</span>
                    <StatusPill tone="emerald">Done</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </AdminSection>

      <AdminSection id="student-requests" icon={TrendingUp} tone="amber" title="Grade change & Eye Gaze requests" count={studentRequestCount} description="Students asking to change their grade band or turn Eye Gaze mode on or off.">
        {studentRequestCount === 0 ? (
          <EmptyState icon={CheckCircle2} title="No requests waiting" />
        ) : (
          <div className="space-y-2">
            {gradeChangeRequests.map((r) => (
              <PersonRow
                key={`grade-${r.id}`}
                name={r.displayName || r.username}
                avatarTone="amber"
                badges={<StatusPill tone="amber">Grade change</StatusPill>}
                meta={<>
                  <p>@{r.username}</p>
                  <p>Grade {r.oldGrade || 'N/A'} ({r.oldBand || 'N/A'} band) → Grade {r.newGrade} ({r.newBand} band)</p>
                </>}
                actions={<>
                  <Button size="sm" className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleGradeChange(r.id, 'approve')}><Check className="h-4 w-4" />Approve</Button>
                  <Button size="sm" variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => handleGradeChange(r.id, 'deny')}><X className="h-4 w-4" />Deny</Button>
                </>}
              />
            ))}
            {eyeGazeRequests.map((r) => (
              <PersonRow
                key={`eye-${r.id || r.userId}`}
                name={r.displayName || r.username}
                avatarTone="blue"
                badges={<StatusPill tone="blue">Eye Gaze</StatusPill>}
                meta={<>
                  <p>@{r.username}</p>
                  <p>Wants Eye Gaze mode {r.requestedStatus ? "on" : "off"}</p>
                </>}
                actions={<>
                  <Button size="sm" className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleEyeGazeRequest(r.id, true)}><Check className="h-4 w-4" />Approve</Button>
                  <Button size="sm" variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => handleEyeGazeRequest(r.id, false)}><X className="h-4 w-4" />Deny</Button>
                </>}
              />
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection id="club-signups" icon={PartyPopper} tone="amber" title="Reading Club sign-ups" count={pendingClubList.length} description="Thursdays after school. The family is emailed when you confirm or deny.">
        {clubSignups.length === 0 ? (
          <EmptyState icon={PartyPopper} title="No Reading Club sign-ups yet" />
        ) : (
          <div className="space-y-2">
            {[...pendingClubList, ...otherClubList].map((s) => (
              <PersonRow
                key={s.id}
                id={`club-${s.id}`}
                name={s.student_name}
                avatarTone="amber"
                highlight={s.status === "pending" ? "amber" : undefined}
                badges={<StatusPill tone={s.status === "pending" ? "amber" : s.status === "confirmed" ? "emerald" : "red"}>{s.status}</StatusPill>}
                meta={<>
                  <p>{[s.grade && `Grade ${s.grade}`, `Signed up ${new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`].filter(Boolean).join(" · ")}</p>
                  {(s.parent_name || s.parent_contact || s.parent_email) && <p>{[s.parent_name && `Parent: ${s.parent_name}`, s.parent_contact, s.parent_email].filter(Boolean).join(" · ")}</p>}
                  {s.notes && <p className="italic">“{s.notes}”</p>}
                </>}
                actions={s.status === "pending" ? <>
                  <Button size="sm" className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void setClubStatus(s.id, "confirmed")}><CheckCircle2 className="h-4 w-4" />Confirm</Button>
                  <Button size="sm" variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => void setClubStatus(s.id, "denied")}>Deny</Button>
                </> : undefined}
              />
            ))}
          </div>
        )}
      </AdminSection>

      <div id="camera-quizzes" className="min-w-0 scroll-mt-32 lg:scroll-mt-20">
        <NoProctorReview />
      </div>
    </div>
  );

  const studentsPanel = (
    <div className="space-y-4">
      {pendingStudentList.length > 0 && (
        <AdminSection id="pending-students" icon={CheckCircle2} tone="amber" title="Waiting for a teacher's OK" count={pendingStudentList.length} description="These students picked a teacher who hasn't approved them yet. Approve them here if their teacher can't.">
          <div className="space-y-2">
            {pendingStudentList.map((s) => (
              <PersonRow
                key={s.id}
                name={s.displayName}
                avatarTone="amber"
                highlight="amber"
                meta={<p>@{s.username}{s.teacherName ? ` · waiting for ${s.teacherName}` : ""}</p>}
                actions={<Button size="sm" className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleApproveStudent(s.id, s.displayName)}><CheckCircle2 className="h-4 w-4" />Approve</Button>}
              />
            ))}
          </div>
        </AdminSection>
      )}

      <div id="unlisted-signups" className="min-w-0 scroll-mt-32 lg:scroll-mt-20">
        <UnlistedSignupsCard />
      </div>

      <AdminSection
        id="students"
        icon={Users}
        tone="blue"
        title={`Students (${students.length})`}
        actions={<Button variant="outline" size="sm" onClick={() => printParentInvites().catch(e => window.alert(e.message))}><Printer className="h-4 w-4" />Print all parent letters</Button>}
      >
        <div className="mb-4 space-y-2">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Search by name or username" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className={cn(INPUT_CLASS, "pl-9")} aria-label="Search students" />
            </div>
            <Button variant="outline" className="h-10 shrink-0" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filters</span>{activeFilterCount > 0 && <CountBadge count={activeFilterCount} />}
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <select value={filterBand} onChange={(e) => setFilterBand(e.target.value)} className={SELECT_CLASS} aria-label="Band">
                <option value="">All bands</option>
                <option value="K-2">K-2 band</option>
                <option value="3-5">3-5 band</option>
                <option value="6-8">6-8 band</option>
                <option value="9-12">9-12 band</option>
              </select>
              <select value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)} className={SELECT_CLASS} aria-label="School">
                <option value="">All schools</option>
                {schools.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
              <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className={SELECT_CLASS} aria-label="Grade">
                <option value="">All grades</option>
                {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
              <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className={SELECT_CLASS} aria-label="Teacher">
                <option value="">All teachers</option>
                {allTeachers.map(t => <option key={t.id} value={String(t.id)}>{t.display_name || t.username}</option>)}
              </select>
              {activeFilterCount > 0 && (
                <button type="button" onClick={() => { setFilterBand(""); setFilterSchool(""); setFilterGrade(""); setFilterTeacher(""); }} className="text-left text-sm font-semibold text-primary hover:underline sm:col-span-2 lg:col-span-4">Clear filters</button>
              )}
            </div>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState icon={Users} title="No students yet" hint="Share the sign-up link with your students." />
        ) : filteredStudents.length === 0 ? (
          <EmptyState icon={Search} title="No students match" hint="Try a different search or clear the filters." />
        ) : (
          <div className="space-y-2">
            {filteredStudents.map((s) => {
              const sGrade = userGradesMap[String(s.id)] || '';
              const sBand = gradeToBandLabel(sGrade);
              return (
                <PersonRow
                  key={s.id}
                  id={`student-${s.id}`}
                  name={s.displayName}
                  avatarTone="violet"
                  highlight={highlightId === `student-${s.id}` ? "violet" : undefined}
                  badges={s.approvedByTeacher === false ? <StatusPill tone="amber">Waiting</StatusPill> : undefined}
                  meta={<>
                    <p>@{s.username}{sBand ? ` · ${sBand} band` : ""}{sGrade ? ` · Grade ${sGrade}` : ""}</p>
                    {s.teacherName && <p>Teacher: {s.teacherName}</p>}
                  </>}
                  aside={<>
                    <div className="text-sm font-bold tabular-nums">{s.totalPoints} pts</div>
                    <div className="text-xs text-muted-foreground">{s.quizzesTaken} {s.quizzesTaken === 1 ? "quiz" : "quizzes"}</div>
                  </>}
                  actions={<div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-2 sm:flex sm:w-auto">
                    <Button size="sm" variant="outline" className="px-2 sm:px-3" onClick={() => handleViewStudent(s)}><Eye className="hidden h-4 w-4 sm:block" />Details</Button>
                    <Button size="sm" variant="outline" className="px-2 sm:px-3" onClick={() => openManualPoints(s)}><PlusCircle className="hidden h-4 w-4 sm:block" />Points</Button>
                    <Button size="sm" variant="outline" className="px-2 sm:px-3" onClick={() => openConversation(s.id)}><Send className="hidden h-4 w-4 sm:block" />Message</Button>
                    <ActionMenu
                      label={`More for ${s.displayName}`}
                      items={[
                        { label: "Reset password", icon: KeyRound, onSelect: () => { setResetStudent(s); setResetSuccess(""); setNewPassword(""); } },
                        { label: "Drop a reward", icon: Gift, onSelect: () => openReward(s) },
                        { label: "Reset Daily Challenge", icon: RotateCcw, onSelect: () => void resetDailyChallenge(s) },
                        { label: "Archive", icon: Archive, onSelect: () => void handleArchiveUser(s.id, s.displayName), separatorBefore: true, testId: `button-archive-student-${s.id}` },
                        { label: "Delete", icon: Trash2, onSelect: () => void handleDeleteStudent(s), danger: true },
                      ]}
                    />
                  </div>}
                />
              );
            })}
          </div>
        )}
      </AdminSection>

      {sampleStudents.length + sampleParents.length > 0 && (
        <AdminSection
          id="sample-accounts"
          icon={Eye}
          tone="blue"
          title={`Sample accounts (${sampleStudents.length + sampleParents.length})`}
          description="Accounts whose sign-in name starts with “sample” or whose name starts with “Sample”. They aren't counted as students or parents and never show on a leaderboard."
        >
          <div className="space-y-2" data-testid="list-sample-accounts">
            {[...sampleStudents.map((u) => ({ ...u, kind: "Student" })), ...sampleParents.map((u) => ({ ...u, kind: "Parent" }))].map((u: any) => (
              <PersonRow
                key={`sample-${u.kind}-${u.id}`}
                id={`sample-${u.id}`}
                name={u.displayName || u.display_name || u.username}
                avatarTone="blue"
                badges={<StatusPill tone="blue">Sample {u.kind.toLowerCase()}</StatusPill>}
                meta={<p>@{u.username}</p>}
                actions={u.kind === "Student" ? (
                  <Button size="sm" variant="outline" onClick={() => handleViewStudent(u)}><Eye className="h-4 w-4" />Details</Button>
                ) : undefined}
              />
            ))}
          </div>
        </AdminSection>
      )}
    </div>
  );

  const teachersPanel = (
    <div className="space-y-4">
      {pendingTeachers.length > 0 && (
        <AdminSection id="pending-teachers" icon={GraduationCap} tone="amber" title="Teacher accounts not turned on" count={pendingTeachers.length} description="New teachers turn their own account on with the code sent to their school email (.edu, .net, .org or .us). These haven't entered it yet, or signed up before school emails were required. Turn one on here if you know them.">
          <div className="space-y-2">
            {pendingTeachers.map((t) => (
              <PersonRow
                key={t.id}
                id={`teacher-${t.id}`}
                name={t.display_name}
                avatarTone="amber"
                highlight="amber"
                meta={<p>@{t.username}{t.email ? ` · ${t.email}` : ""}</p>}
                actions={<>
                  <Button size="sm" onClick={() => handleApproveTeacher(t.id)}><CheckCircle2 className="h-4 w-4" />Turn on account</Button>
                  <Button size="sm" variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => void handleDeleteTeacher(t)}><Trash2 className="h-4 w-4" />Delete</Button>
                </>}
              />
            ))}
          </div>
        </AdminSection>
      )}

      <AdminSection
        id="teachers"
        icon={GraduationCap}
        tone="amber"
        title={`Teachers (${allTeachers.length})`}
        actions={<Button size="sm" onClick={() => setShowTeacherForm(!showTeacherForm)}><UserPlus className="h-4 w-4" />{showTeacherForm ? "Close" : "Add a teacher"}</Button>}
      >
        {showTeacherForm && (
          <div id="teacher-form" className="mb-4 scroll-mt-36 rounded-xl border border-border bg-background p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted-foreground">Display name
                <input type="text" value={teacherForm.displayName} onChange={(e) => setTeacherForm({ ...teacherForm, displayName: e.target.value })} placeholder="Ms. Johnson" className={cn(INPUT_CLASS, "mt-1")} />
              </label>
              <label className="block text-xs text-muted-foreground">Username
                <input type="text" value={teacherForm.username} onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })} placeholder="mjohnson" className={cn(INPUT_CLASS, "mt-1")} />
              </label>
              <label className="block text-xs text-muted-foreground">Password
                <input type="text" value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} placeholder="At least 6 characters" className={cn(INPUT_CLASS, "mt-1")} />
              </label>
              <label className="block text-xs text-muted-foreground">Email (optional)
                <input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} placeholder="teacher@school.org" className={cn(INPUT_CLASS, "mt-1")} />
              </label>
            </div>
            {teacherFormError && <p className="mt-2 text-sm text-red-400">{teacherFormError}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={handleCreateTeacher} disabled={teacherFormLoading}>{teacherFormLoading ? "Creating…" : "Create teacher"}</Button>
              <Button variant="outline" onClick={() => { setShowTeacherForm(false); setTeacherFormError(""); }}>Cancel</Button>
              <p className="text-xs text-muted-foreground">The account is on right away.</p>
            </div>
          </div>
        )}
        {allTeachers.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No teachers yet" />
        ) : (
          <div className="space-y-2">
            {allTeachers.map((t) => {
              const grades: string[] = (window as any).__teacherGrades?.[t.id] || [];
              return (
                <PersonRow
                  key={t.id}
                  id={`teacher-${t.id}`}
                  name={t.display_name || t.username}
                  avatarTone="amber"
                  highlight={highlightId === `teacher-${t.id}` ? "amber" : undefined}
                  meta={<>
                    <p>@{t.username}{t.email ? ` · ${t.email}` : ""}</p>
                    {grades.length > 0 && <p>Grades: {grades.join(", ")}</p>}
                  </>}
                  actions={<>
                    <Button size="sm" variant="outline" onClick={() => handleResetTeacherPassword(t.id)}><KeyRound className="h-4 w-4" />Reset password</Button>
                    <ActionMenu
                      label={`More for ${t.display_name || t.username}`}
                      items={[
                        { label: "Archive", icon: Archive, onSelect: () => void handleArchiveUser(t.id, t.display_name || t.username || "this teacher"), testId: `button-archive-teacher-${t.id}` },
                        { label: "Delete", icon: Trash2, onSelect: () => void handleDeleteTeacher(t), danger: true },
                      ]}
                    />
                  </>}
                >
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <label className="min-w-0 text-xs text-muted-foreground">School
                      <select className={cn(SELECT_CLASS, "mt-1")} value={t.school_id || ""} onChange={(e) => void assignTeacherSchool(t.id, e.target.value)}>
                        <option value="">No school</option>
                        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                    <label className="min-w-0 text-xs text-muted-foreground">Add or remove a grade
                      <select className={cn(SELECT_CLASS, "mt-1")} value="" onChange={(e) => void toggleTeacherGrade(t.id, e.target.value)}>
                        <option value="">Choose a grade…</option>
                        {["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((g) => <option key={g} value={g}>Grade {g}{grades.includes(g) ? " ✓" : ""}</option>)}
                      </select>
                    </label>
                  </div>
                </PersonRow>
              );
            })}
          </div>
        )}
      </AdminSection>
    </div>
  );

  const parentsPanel = (
    <div className="space-y-4">
      {pendingParents.length > 0 && (
        <AdminSection id="pending-parents" icon={ShieldCheck} tone="cyan" title="Parents waiting for approval" count={pendingParents.length} description="They'll be connected to their student once approved.">
          <div className="space-y-2">
            {pendingParents.map((p) => (
              <PersonRow
                key={p.id}
                name={p.display_name}
                avatarTone="cyan"
                highlight="blue"
                meta={<>
                  <p>@{p.username}{p.email ? ` · ${p.email}` : ""}</p>
                  {p.studentName && <p>Student: {p.studentName}</p>}
                </>}
                actions={<>
                  <Button size="sm" className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleApproveParent(p.id)}><CheckCircle2 className="h-4 w-4" />Approve</Button>
                  <Button size="sm" variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => handleRejectParent(p.id)}><X className="h-4 w-4" />Reject</Button>
                </>}
              />
            ))}
          </div>
        </AdminSection>
      )}

      <AdminSection id="parents" icon={ShieldCheck} tone="cyan" title={`Parents (${allParents.length})`}>
        {allParents.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No parent accounts yet" />
        ) : (
          <div className="space-y-2">
            {allParents.map((p) => {
              const name = p.display_name || p.displayName || "this parent";
              return (
                <PersonRow
                  key={p.id}
                  id={`parent-${p.id}`}
                  name={p.display_name || p.displayName}
                  avatarTone="cyan"
                  highlight={highlightId === `parent-${p.id}` ? "cyan" : undefined}
                  badges={<StatusPill tone={p.accountApproved ? "emerald" : "amber"}>{p.accountApproved ? "Active" : "Pending"}</StatusPill>}
                  meta={<>
                    <p>@{p.username}{p.email ? ` · ${p.email}` : ""}</p>
                    {p.studentName && <p>Student: {p.studentName}</p>}
                  </>}
                  actions={<>
                    {!p.accountApproved && <Button size="sm" className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleApproveParentParent(p.id)}><CheckCircle2 className="h-4 w-4" />Approve</Button>}
                    <Button size="sm" variant="outline" onClick={() => handleResetParentPassword(p.id, name)}><KeyRound className="h-4 w-4" />Reset password</Button>
                    <ActionMenu
                      label={`More for ${name}`}
                      items={[
                        { label: "Archive", icon: Archive, onSelect: () => void handleArchiveUser(p.id, name), testId: `button-archive-parent-${p.id}` },
                        { label: "Delete", icon: Trash2, onSelect: () => handleDeleteParent(p.id, name), danger: true },
                      ]}
                    />
                  </>}
                />
              );
            })}
          </div>
        )}
      </AdminSection>
    </div>
  );

  const peopleTabContent = (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black sm:text-2xl">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">Students, teachers and parents, with anyone waiting on you at the top.</p>
      </div>
      <SegmentedTabs
        ariaLabel="People"
        dataAttr="data-people-tab"
        value={peopleTab}
        onChange={setPeopleTab}
        options={[
          { value: "students", label: `Students (${students.length})`, count: pendingStudentList.length },
          { value: "teachers", label: `Teachers (${allTeachers.length})`, count: pendingTeachers.length },
          { value: "parents", label: `Parents (${allParents.length})`, count: pendingParents.length },
          { value: "archived", label: "Archived", icon: Archive },
        ]}
      />
      {peopleTab === "students" && studentsPanel}
      {peopleTab === "teachers" && teachersPanel}
      {peopleTab === "parents" && parentsPanel}
      {peopleTab === "archived" && (
        <ArchivedProfilesCard refreshKey={archiveRefresh} onRestored={() => { void fetchStudents(); void fetchTeachers(); void fetchAllParents(); }} />
      )}
    </div>
  );

  const libraryTab = (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-black sm:text-2xl">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quizzes, book covers and the reading Growth Check.</p>
      </div>
      <AdminSection
        id="books"
        icon={ImagePlus}
        tone="violet"
        title={`Books & covers (${books.length})`}
        actions={<Button size="sm" onClick={() => setShowAddQuiz(true)}><PlusCircle className="h-4 w-4" />Add a quiz</Button>}
      >
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
                    <button
                      type="button" onClick={() => setPointsBook(b)} data-testid="book-points-open"
                      aria-label={`${b.pointsValue ?? 0} points for ${b.title}. Change the points.`}
                      className="min-h-9 rounded-lg px-2 text-xs font-semibold text-primary underline decoration-primary/40 underline-offset-4 hover:bg-muted/40"
                    >
                      {b.pointsValue ?? 0} pts{b.pointsSetByAdmin ? " · set by you" : ""}
                    </button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCoverBook(b); setCoverUrl(b.coverUrl || ""); setCoverSuccess(""); }}>
                      <ImagePlus className="w-3 h-3 mr-1" />
                      Cover
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
      </AdminSection>
      <AdminSection id="growth-check" icon={Brain} tone="cyan" title="Arise Reading Growth Check" description="Benchmark windows, forms and student results.">
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
      </AdminSection>
    </div>
  );

  const schoolsTab = (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-black sm:text-2xl">Schools & plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">Schools, classes and Premium plans.</p>
      </div>
      <AdminSection id="schools" icon={Building} tone="blue" title={`Schools & classes (${schools.length})`}>
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
      </AdminSection>
      <AdminPlans />
    </div>
  );

  const settingsTab = (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Notifications, banners, Club hours and the rest of the site's switches.</p>
      </div>
      <SegmentedTabs
        ariaLabel="Settings"
        dataAttr="data-settings-section"
        value={settingsSection}
        onChange={setSettingsSection}
        options={[
          { value: "alerts", label: "Notifications", icon: BellRing },
          { value: "banners", label: "Banners", icon: Megaphone },
          { value: "club", label: "Club & play time", icon: Gamepad2 },
          { value: "ai", label: "AI quizzes", icon: Brain },
          { value: "extras", label: "Competition & extras", icon: Trophy },
          { value: "security", label: "Proctor password", icon: KeyRound },
        ]}
      />
      {settingsSection === "alerts" && <AlertSettingsCard token={token || getTokenFromCookie()} />}
      {settingsSection === "banners" && (
        <AdminSection id="banners" icon={Megaphone} tone="amber" title="Announcement & banners" description="Messages shown across the site.">
          <div className={sectionGroup}>
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <div className="space-y-2">
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
          </div>
        </AdminSection>
      )}
      {settingsSection === "club" && (
        <div className="space-y-4">
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
        </div>
      )}
      {settingsSection === "ai" && (
        <AdminSection id="ai-settings" icon={Brain} tone="violet" title="AI quizzes" description="The key that powers Instant AI Quiz, and the rules every AI quiz follows.">
          <div className={sectionGroup}>
            <div className="space-y-3">
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
            <div className="space-y-3">
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
            <div className="space-y-3">
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
          </div>
        </AdminSection>
      )}
      {settingsSection === "extras" && (
        <div className="space-y-4">
          <AdminSection id="competition" icon={Trophy} tone="amber" title="Competition">
            <div className="space-y-4">
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
            </div>
          </AdminSection>
          <AdminSection id="donation" icon={Gift} tone="emerald" title="Donation goal">
            <div className="space-y-3">
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
          </AdminSection>
          <AdminSection id="easter-eggs" icon={Sparkles} tone="fuchsia" title="FYP Easter eggs">
            <div className="space-y-3">
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
          </AdminSection>
        </div>
      )}
      {settingsSection === "security" && (
        <AdminSection id="proctor" icon={KeyRound} tone="cyan" title="Proctor password" description="One password for every proctored quiz and test.">
            <div className="space-y-2">
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
        </AdminSection>
      )}
    </div>
  );

  const navButton = (item: (typeof NAV)[number], variant: "bar" | "side") => {
    const active = tab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        data-admin-tab={item.id}
        onClick={() => { setTab(item.id); window.scrollTo({ top: 0 }); }}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative inline-flex shrink-0 items-center gap-2 font-semibold transition-colors",
          variant === "bar"
            ? cn("rounded-full px-3.5 py-2 text-[13px]", active ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:text-foreground")
            : cn("w-full rounded-xl px-3 py-2.5 text-sm", active ? "bg-primary/15 text-foreground ring-1 ring-primary/30" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"),
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
        {item.badge ? <CountBadge count={item.badge} className={variant === "side" ? "ml-auto" : ""} /> : null}
      </button>
    );
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:px-4 lg:px-6">
          <button type="button" onClick={() => { setTab("overview"); window.scrollTo({ top: 0 }); }} className="flex min-w-0 items-center gap-2.5" aria-label="Admin overview">
            <span className="arise-icon-tile grid h-9 w-9 shrink-0 place-items-center rounded-xl"><ShieldCheck className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 text-left leading-tight">
              <span className="block truncate text-[15px] font-black">Admin</span>
              <span className="hidden truncate text-[11px] text-muted-foreground sm:block">A.R.I.S.E. Reader</span>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <button type="button" onClick={() => navigate("/teacher-hub")} className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-muted sm:flex sm:w-auto sm:items-center sm:gap-1.5 sm:px-3" aria-label="Teacher Hub" title="Your Teacher Hub" data-testid="button-admin-teacher-hub">
              <ClipboardList className="h-5 w-5 text-teal-400" />
              <span className="hidden text-sm font-semibold sm:inline">Teacher Hub</span>
            </button>
            <button type="button" onClick={() => navigate("/leaderboard")} className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-muted sm:flex sm:w-auto sm:items-center sm:gap-1.5 sm:px-3" aria-label="Leaderboard" title="Leaderboard" data-testid="button-admin-leaderboard">
              <Trophy className="h-5 w-5 text-amber-400" />
              <span className="hidden text-sm font-semibold sm:inline">Leaderboard</span>
            </button>
            <NotificationBell onNavigate={handleNotifNavigate} onCounts={handleBellCounts} />
            <button type="button" onClick={() => { setTab("inbox"); window.scrollTo({ top: 0 }); }} className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-muted" aria-label={unreadMsgCount ? `Inbox, ${unreadMsgCount} unread` : "Inbox"} data-testid="button-admin-inbox">
              <Inbox className="h-5 w-5" />
              {unreadMsgCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-background">{unreadMsgCount > 9 ? "9+" : unreadMsgCount}</span>}
            </button>
            <div className="hidden sm:flex"><ReportProblemButton variant="ghost" size="sm" /></div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-muted" aria-label="More">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuLabel className="text-xs text-muted-foreground">{user?.displayName || "Admin"}</DropdownMenuLabel>
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => navigate("/teacher-hub")}><ClipboardList className="h-4 w-4" />My Teacher Hub</DropdownMenuItem>
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => navigate("/progress")}><Brain className="h-4 w-4" />Student progress</DropdownMenuItem>
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => navigate("/polls")}><BarChart3 className="h-4 w-4" />Polls</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => { startAdminPreview("regular"); navigate("/profile"); }}><Users className="h-4 w-4" />Preview as a student</DropdownMenuItem>
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => { startAdminPreview("eye-gaze"); navigate("/eye-gaze-home"); }}><Eye className="h-4 w-4" />Preview as an Eye Gazer</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => { setTab("settings"); setSettingsSection("alerts"); }}><BellRing className="h-4 w-4" />Notification settings</DropdownMenuItem>
                <DropdownMenuItem className="gap-2 py-2 text-red-400 focus:text-red-300" onSelect={handleLogout}><LogOut className="h-4 w-4" />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav aria-label="Admin sections" className="border-t border-border/60 lg:hidden">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV.map((item) => navButton(item, "bar"))}
          </div>
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-3 sm:px-4 lg:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav aria-label="Admin sections" className="sticky top-14 space-y-1 py-6">
            {NAV.map((item) => navButton(item, "side"))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 py-4 pb-24 sm:py-6">
          {tab === "overview" && overviewTab}
          {tab === "stats" && (
            <Suspense fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-card-border bg-card" />)}</div>}>
              <AdminStats
                token={token || getTokenFromCookie() || ""}
                onOpenStudent={(id) => {
                  const student = students.find((s) => s.id === id);
                  if (student) void handleViewStudent(student);
                }}
              />
            </Suspense>
          )}
          {tab === "todo" && todoTab}
          {tab === "inbox" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-black sm:text-2xl">Inbox</h1>
                <p className="mt-1 text-sm text-muted-foreground">Messages and problem reports from students, parents and teachers.</p>
              </div>
              <AdminInbox
                token={token || getTokenFromCookie()}
                people={students.map((s) => ({ id: s.id, displayName: s.displayName, username: s.username }))}
                openConversation={inboxOpen}
                onUnreadChange={setUnreadMsgCount}
              />
            </div>
          )}
          {tab === "people" && peopleTabContent}
          {tab === "library" && libraryTab}
          {tab === "schools" && schoolsTab}
          {tab === "settings" && settingsTab}
        </main>
      </div>

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

      {/* Reset a student's password */}
      <Dialog open={!!resetStudent} onOpenChange={(open) => { if (!open) { setResetStudent(null); setNewPassword(""); setResetSuccess(""); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Reset password for {resetStudent?.displayName}</DialogTitle>
          </DialogHeader>
          {resetSuccess ? (
            <div className="py-6 text-center">
              <p className="mb-2 text-sm font-medium text-green-400">{resetSuccess}</p>
              <p className="text-xs text-muted-foreground">Tell the student their new password.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 4 characters" />
              </div>
              <Button onClick={handleResetPassword} disabled={!newPassword || newPassword.length < 4} className="w-full">Reset password</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drop a reward */}
      <Dialog open={!!rewardStudent} onOpenChange={(open) => { if (!open) { setRewardStudent(null); setRewardList([]); setRewardSuccess(""); } }}>
        {rewardStudent && (
          <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-lg max-h-[92dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Drop a Reward for {rewardStudent.displayName}</DialogTitle>
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
                                onClick={() => handleRewardClaim(rewardStudent.id, r.id, "approved")}
                                className="text-xs text-green-600 hover:text-green-400"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRewardClaim(rewardStudent.id, r.id, "denied")}
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
                              onClick={() => handleRewardClaim(rewardStudent.id, r.id, "used")}
                              className="text-xs text-gray-600 dark:text-gray-400"
                            >
                              Mark Used
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleReward(rewardStudent.id, r.id, r.active)}
                            className="text-xs"
                          >
                            {r.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteReward(rewardStudent.id, r.id)}
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
        )}
      </Dialog>

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
                        if (!detailStudent) return;
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
                        if (!detailStudent) return;
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

      <BookPointsDialog book={pointsBook} token={token || getTokenFromCookie()} onClose={() => setPointsBook(null)} onSaved={fetchBooks} />

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
                  <p className="text-xs text-muted-foreground">Students who pass earn exactly this many points. You can change it later in the Library.</p>
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
