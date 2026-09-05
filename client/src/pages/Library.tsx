import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, LogOut, User, Settings, Trophy, PlusCircle, X, Search, Inbox, ChevronDown, Send, MoreVertical, Brain } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { ReportProblemButton } from "@/components/ReportProblemButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

interface Message {
  id: number;
  senderType: string;
  messageText: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Book {
  id: number;
  title: string;
  author: string;
  ageGroup: string;
  coverUrl: string | null;
  description: string;
  pointsValue: number;
  readUrl: string | null;
}

interface QuizResult {
  bookId: number;
  score: number;
  total: number;
  title: string;
  pointsValue?: number;
  pointsEarned?: number;
  readUrl?: string | null;
}

// Module-level cache — survives component unmount/remount during navigation
let libraryCache: { books: Book[]; results: QuizResult[]; announcement: string; quizCount?: number } = {
  books: [],
  results: [],
  announcement: "",
};

export default function Library() {
  const { user, token, logout } = useAuth();
  const [, navigate] = useLocation();
  // Initialize from cache so data shows instantly on remount
  const [books, setBooks] = useState<Book[]>(libraryCache.books);
  const [quizCount, setQuizCount] = useState(libraryCache.quizCount || 0);
  const [results, setResults] = useState<QuizResult[]>(libraryCache.results);
  const [loading, setLoading] = useState(libraryCache.books.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"points" | "popular" | "recent" | "classics" | "new">("points");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [announcement, setAnnouncement] = useState(libraryCache.announcement);

  const [showRequest, setShowRequest] = useState(false);
  const [requestBook, setRequestBook] = useState("");
  const [requestAuthor, setRequestAuthor] = useState("");
  const [requestMsg, setRequestMsg] = useState("");
  const [requestError, setRequestError] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [eyeGazeQuizzes, setEyeGazeQuizzes] = useState<any[]>([]);
  const [customQuizzes, setCustomQuizzes] = useState<any[]>([]);
  const [regularCustomQuizzes, setRegularCustomQuizzes] = useState<any[]>([]);
  const [showEyeGaze, setShowEyeGaze] = useState(false);

  // Reset eye gaze state when user changes (handles login/logout switching)
  useEffect(() => {
    if (!user) {
      setEyeGazeQuizzes([]);
      setCustomQuizzes([]);
      setRegularCustomQuizzes([]);
      setShowEyeGaze(false);
    } else {
      // Only show eye gaze section for eye gaze users
      setShowEyeGaze(!!user.is_eye_gaze_user);
      if (!user.is_eye_gaze_user) {
        setEyeGazeQuizzes([]);
        setCustomQuizzes([]);
      }
    }
  }, [user?.id, user?.is_eye_gaze_user]);

  const fetchBooks = useCallback(async () => {
    // Use context token, or fall back to cookie token
    const authToken = token || getTokenFromCookie();
    if (!authToken) {
      setLoading(false);
      return;
    }
    try {
      const booksRes = await fetch(`${API_BASE}/api/books`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (booksRes.ok) {
        const booksData = await booksRes.json();
        const booksArr = Array.isArray(booksData) ? booksData : [];
        setBooks(booksArr);
        libraryCache.books = booksArr;
      }
      // Fetch quiz count from public stats (no auth needed)
      try {
        const statsRes = await fetch(`${API_BASE}/api/public/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setQuizCount(statsData.quizzesAvailable || 0);
          libraryCache.quizCount = statsData.quizzesAvailable || 0;
        }
      } catch {
        // ignore stats fetch failure
      }
      // Fetch profile separately — don't block books if profile fails
      try {
        const profileRes = await fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const quizResults = profileData?.quizResults || [];
          setResults(quizResults);
          libraryCache.results = quizResults;
        }
      } catch (e) {
        console.error("Failed to fetch profile:", e);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAnnouncement = useCallback(async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/announcement`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        const text = data.text || "";
        setAnnouncement(text);
        libraryCache.announcement = text;
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchBooks();
    fetchAnnouncement();
    fetchUnreadCount();
    // Fetch eye gaze quizzes for eye gaze users
    if (user?.is_eye_gaze_user) {
      const authToken = token || getTokenFromCookie();
      if (authToken) {
        fetch(`${API_BASE}/api/eye-gaze/quizzes`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(r => r.ok ? r.json() : [])
          .then(data => { setEyeGazeQuizzes(Array.isArray(data) ? data : []); setShowEyeGaze(true); })
          .catch(() => {});
        // Fetch custom quizzes created by teachers/parents
        fetch(`${API_BASE}/api/custom-quizzes`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(r => r.ok ? r.json() : [])
          .then(data => {
            const arr = Array.isArray(data) ? data : [];
            setCustomQuizzes(arr.filter((q: any) => q.quiz_type !== 'regular'));
            setRegularCustomQuizzes(arr.filter((q: any) => q.quiz_type === 'regular'));
          })
          .catch(() => {});
      }
    }
    const interval = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(interval);
  }, [fetchBooks, fetchAnnouncement, token, user?.is_eye_gaze_user]);

  // Clear caches on global logout event
  useEffect(() => {
    const clearCaches = () => {
      libraryCache.books = [];
      libraryCache.results = [];
      libraryCache.announcement = "";
      libraryCache.quizCount = 0;
      setBooks([]);
      setResults([]);
      setUnreadCount(0);
    };
    window.addEventListener("arise-logout", clearCaches);
    return () => window.removeEventListener("arise-logout", clearCaches);
  }, []);

  // Retry profile fetch after a delay if results are still empty
  useEffect(() => {
    if (!token && !getTokenFromCookie()) return;
    if (results.length > 0) return;
    const retryTimer = setTimeout(() => {
      const authToken = token || getTokenFromCookie();
      if (!authToken) return;
      fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${authToken}` } })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            const quizResults = data?.quizResults || [];
            setResults(quizResults);
            libraryCache.results = quizResults;
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(retryTimer);
  }, [token, results.length]);

  // Close mobile menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    // Clear module-level caches to prevent stale data on next login
    libraryCache.books = [];
    libraryCache.results = [];
    libraryCache.announcement = "";
    libraryCache.quizCount = 0;
    logout();
    navigate("/");
  };

  const handleSubmitRequest = async () => {
    setRequestError("");
    setRequestMsg("");
    if (!requestBook.trim() || !requestAuthor.trim() || !token) return;
    setSubmittingRequest(true);
    try {
      const res = await fetch(`${API_BASE}/api/quiz-requests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bookTitle: requestBook.trim(), author: requestAuthor.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRequestMsg("Quiz request submitted! Your teacher will create it soon.");
        setRequestBook("");
        setRequestAuthor("");
        setTimeout(() => {
          setShowRequest(false);
          setRequestMsg("");
        }, 2500);
      } else {
        setRequestError(data.message || "Failed to submit request.");
      }
    } catch (err) {
      setRequestError("Failed to submit request.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const fetchMessages = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/messages`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
        // Mark unread as read
        (Array.isArray(data) ? data : []).forEach((m: Message) => {
          if (m.senderType === "teacher" && !m.isRead) {
            fetch(`${API_BASE}/api/messages/${m.id}/read`, {
              method: "POST",
              headers: { Authorization: `Bearer ${authToken}` },
            });
          }
        });
        // After opening inbox, clear the unread badge
        setUnreadCount(0);
      }
    } catch {}
  };

  const fetchUnreadCount = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/messages/unread-count`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch {}
  };

  const handleSendMsg = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken || !messageText.trim()) return;
    setSendingMsg(true);
    try {
      await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messageText }),
      });
      setMessageText("");
      fetchMessages();
    } catch {}
    setSendingMsg(false);
  };

  const completedIds = new Set((results || []).map(r => r.bookId));
  const totalPoints = (results || []).reduce((sum, r) => sum + (r.pointsEarned ?? r.score ?? 0), 0);

  // Filter books by search
  const filteredBooks = searchQuery.trim()
    ? (books || []).filter(b => 
        (b?.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b?.author || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (books || []);

  // Sort books
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (sortBy === "popular") {
      // Sort by how many times the quiz was taken (use results as proxy)
      const aTries = (results || []).filter(r => r.bookId === a.id).length;
      const bTries = (results || []).filter(r => r.bookId === b.id).length;
      return bTries - aTries;
    }
    if (sortBy === "recent") {
      // Modern novels first (those without readUrl)
      const aMod = !a.readUrl ? 1 : 0;
      const bMod = !b.readUrl ? 1 : 0;
      return bMod - aMod;
    }
    if (sortBy === "classics") {
      // Classic books first (those with readUrl)
      const aCl = a.readUrl ? 1 : 0;
      const bCl = b.readUrl ? 1 : 0;
      return bCl - aCl;
    }
    if (sortBy === "new") {
      // Newest books first (higher ID = newer)
      return b.id - a.id;
    }
    // Default: group by points
    return 0;
  });

  // Group by points value (only when sorting by points)
  const pointsGroups: Record<string, Book[]> = {};
  const pointsOrder = ["10", "20", "30"];
  if (sortBy === "points") {
    sortedBooks.forEach(b => {
      const key = String(b.pointsValue || 10);
      if (!pointsGroups[key]) pointsGroups[key] = [];
      pointsGroups[key].push(b);
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-base sm:text-lg tracking-wide whitespace-nowrap">A.R.I.S.E<span className="text-primary"> Reader</span></span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <NotificationBell onNavigate={(type, id) => {
              if (user?.isAdmin) {
                // Store the notification context for Admin to pick up
                sessionStorage.setItem('admin_notif', JSON.stringify({ type, id }));
                navigate("/admin");
              } else {
                navigate("/profile");
              }
            }} />
            <Button variant="outline" size="sm" onClick={() => { fetchMessages(); setShowInbox(true); }} className="relative">
              <Inbox className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Inbox</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </Button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 text-primary font-semibold text-sm">
              <Trophy className="w-4 h-4" />
              {totalPoints} pts
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/progress")} className="hidden sm:flex">
              <Brain className="w-4 h-4 mr-1" />
              <span className="hidden md:inline">Progress</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} data-testid="button-profile" className="hidden sm:flex">
              <User className="w-4 h-4 mr-1" />
              <span className="hidden md:inline">{user?.displayName}</span>
            </Button>
            {user?.isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} data-testid="button-admin" className="hidden sm:flex">
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline">Admin</span>
              </Button>
            )}
            {user?.role === 'teacher' && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/teacher-dashboard")} data-testid="button-teacher" className="hidden sm:flex">
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline">Teacher</span>
              </Button>
            )}
            <div className="hidden sm:flex"><ReportProblemButton variant="ghost" size="sm" /></div>
            {/* Mobile more menu */}
            <div className="sm:hidden relative" ref={(el) => { mobileMenuRef.current = el; }}>
              <Button variant="ghost" size="sm" onClick={() => setShowMobileMenu(!showMobileMenu)}>
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showMobileMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-card border border-border shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border">
                    <span className="text-sm font-semibold text-primary">{totalPoints} pts</span>
                  </div>
                  <button onClick={() => { navigate("/progress"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Progress
                  </button>
                  <button onClick={() => { navigate("/profile"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                    <User className="w-4 h-4" /> {user?.displayName || "Profile"}
                  </button>
                  {user?.isAdmin && (
                    <button onClick={() => { navigate("/admin"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Admin
                    </button>
                  )}
                  <div className="px-2 py-1">
                    <ReportProblemButton variant="ghost" size="sm" />
                  </div>
                  <button onClick={handleLogout} data-testid="button-logout" className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout" className="hidden sm:flex">
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Announcement banner */}
        {announcement && (
          <div className="mb-6 rounded-xl bg-primary/10 border border-primary/30 px-4 py-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">{announcement}</p>
            </div>
          </div>
        )}

        {/* Welcome banner */}
        <div className="mb-8 rounded-2xl bg-primary text-white p-6 sm:p-8 shadow-lg">
          <h1 className="text-2xl sm:text-3xl font-bold">Hi, {user?.displayName}!</h1>
          {user?.role === 'teacher' || user?.isAdmin ? (
            <p className="mt-1 text-white/90">Browse the library and view student stats below.</p>
          ) : (
            <p className="mt-1 text-white/90">Pick a book you've read and take the quiz to earn points.</p>
          )}
          <div className="flex gap-4 sm:gap-6 mt-4 flex-wrap">
            <div>
              <div className="text-3xl font-bold">{totalPoints}</div>
              <div className="text-sm text-white/80">Points earned</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{results.length}</div>
              <div className="text-sm text-white/80">Quizzes done</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{books.filter(b => b.readUrl).length}</div>
              <div className="text-sm text-white/80">Books to read</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{quizCount}</div>
              <div className="text-sm text-white/80">Quizzes available</div>
            </div>
          </div>
        </div>

        {/* Request a quiz - students only */}
        {!(user?.role === 'teacher' || user?.isAdmin) && (
          <div className="mb-8">
            <Button
              variant="outline"
              onClick={() => { setShowRequest(true); setRequestError(""); setRequestMsg(""); }}
              data-testid="button-request-quiz"
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              Request a Quiz
            </Button>
          </div>
        )}

        {showRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowRequest(false)}>
            <Card className="w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">Request a Quiz</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowRequest(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {requestMsg ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-green-400 font-medium">{requestMsg}</p>
                  </div>
                ) : (
                  <>
                    {requestError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {requestError}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="request-title">Book Title *</Label>
                      <Input
                        id="request-title"
                        value={requestBook}
                        onChange={(e) => setRequestBook(e.target.value)}
                        placeholder="The book you want a quiz for"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="request-author">Author *</Label>
                      <Input
                        id="request-author"
                        value={requestAuthor}
                        onChange={(e) => setRequestAuthor(e.target.value)}
                        placeholder="Author name"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSubmitRequest} disabled={!requestBook.trim() || !requestAuthor.trim() || submittingRequest} className="flex-1">
                        {submittingRequest ? "Submitting..." : "Submit Request"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowRequest(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Eye Gaze Testing Section */}
        {showEyeGaze && (eyeGazeQuizzes.length > 0 || customQuizzes.length > 0) && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">Eye Gazer &amp; Non-Verbal</h2>
              <button
                onClick={() => navigate("/quiz-builder")}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Quiz
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {eyeGazeQuizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  onClick={() => navigate(`/eye-gaze-quiz/${quiz.id}`)}
                  disabled={quiz.hasCompleted}
                  className={`group relative rounded-2xl overflow-hidden border-2 transition-all ${
                    quiz.hasCompleted
                      ? "border-green-500/30 bg-card/50 opacity-60 cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/50 hover:shadow-lg"
                  }`}
                  style={{ minHeight: "140px" }}
                >
                  <div className="flex items-center gap-4 p-5">
                    <div style={{ fontSize: "3rem", lineHeight: 1 }}>
                      {quiz.cover_visual}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-base">{quiz.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{quiz.description}</p>
                      <span className="inline-block mt-2 text-xs font-semibold text-primary">
                        Level {quiz.level}
                      </span>
                    </div>
                  </div>
                  {quiz.hasCompleted && (
                    <div className="absolute top-2 right-2">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
              {/* Custom quizzes created by teachers/parents */}
              {customQuizzes.map((quiz) => (
                <button
                  key={`custom-${quiz.id}`}
                  onClick={() => navigate(`/custom-quiz/${quiz.id}`)}
                  disabled={quiz.hasCompleted}
                  className={`group relative rounded-2xl overflow-hidden border-2 transition-all ${
                    quiz.hasCompleted
                      ? "border-green-500/30 bg-card/50 opacity-60 cursor-not-allowed"
                      : "border-primary/30 bg-card hover:border-primary/50 hover:shadow-lg"
                  }`}
                  style={{ minHeight: "140px" }}
                >
                  <div className="flex items-center gap-4 p-5">
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />\n                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-base">{quiz.title}</h3>
                      {quiz.description && <p className="text-xs text-muted-foreground mt-1">{quiz.description}</p>}
                      <span className="inline-block mt-2 text-xs font-semibold text-primary">
                        {quiz.level || "Custom"}
                      </span>
                    </div>
                  </div>
                  {quiz.hasCompleted && (
                    <div className="absolute top-2 right-2">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {/* Edit/Delete buttons if user is creator */}
                  {user && quiz.creator_user_id === user.id && (
                    <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/quiz-builder/${quiz.id}`); }}
                        className="px-2 py-0.5 text-xs font-semibold rounded bg-primary text-white hover:opacity-90"
                      >Edit</button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Delete "${quiz.title}"? This cannot be undone.`)) return;
                          const token = getTokenFromCookie();
                          const res = await fetch(`${API_BASE}/api/custom-quizzes/${quiz.id}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (res.ok) {
                            setCustomQuizzes(prev => prev.filter((cq) => cq.id !== quiz.id));
                          } else {
                            alert("Failed to delete quiz.");
                          }
                        }}
                        className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 text-white hover:opacity-90"
                      >Delete</button>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Regular Teacher Quizzes Section */}
        {regularCustomQuizzes.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">Teacher Quizzes</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {regularCustomQuizzes.map((quiz) => {
                const canEdit = user?.id === quiz.creator_user_id || user?.isAdmin;
                return (
                  <div key={quiz.id} className="relative">
                    <button
                      onClick={() => navigate(`/custom-quiz/${quiz.id}`)}
                      disabled={quiz.hasCompleted}
                      className={`w-full text-left p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all ${quiz.hasCompleted ? "opacity-60 cursor-not-allowed" : "hover:shadow-lg"}`}
                    >
                      {quiz.hasCompleted && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <h3 className="font-bold text-base mb-1">{quiz.title}</h3>
                      {quiz.description && <p className="text-xs text-muted-foreground mb-2">{quiz.description}</p>}
                      <span className="text-xs text-primary font-semibold">{quiz.level || "Custom"}</span>
                    </button>
                    {canEdit && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => navigate(`/quiz-builder/${quiz.id}`)} className="flex-1 text-xs py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground">Edit</button>
                        <button onClick={async () => { if (confirm("Delete this quiz?")) { const t = token || getTokenFromCookie(); await fetch(`${API_BASE}/api/custom-quizzes/${quiz.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } }); setRegularCustomQuizzes(prev => prev.filter(q => q.id !== quiz.id)); } }} className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500">Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search bar + Sort */}
        <div className="mb-6 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search books by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm hover:bg-muted transition-colors whitespace-nowrap"
            >
              <span className="font-medium">
                {sortBy === "points" ? "By Points" : sortBy === "popular" ? "Popular" : sortBy === "recent" ? "Recent" : sortBy === "classics" ? "Classics" : "Newly Added"}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-44 rounded-xl bg-card border border-border shadow-lg z-50 overflow-hidden">
                {[
                  { val: "points", label: "By Points" },
                  { val: "popular", label: "Popular" },
                  { val: "recent", label: "Recent Novels" },
                  { val: "classics", label: "Classics" },
                  { val: "new", label: "Newly Added" },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => { setSortBy(opt.val as any); setShowSortMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${sortBy === opt.val ? "text-primary font-medium" : "text-foreground"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading books...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-1">No books found</h3>
            <p className="text-sm text-muted-foreground mb-1">
              We couldn't find a quiz for "{searchQuery}".
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Request it and we'll create a quiz in 1-3 days. Keep an eye on your inbox or notifications!
            </p>
            <Button
              onClick={() => { setRequestBook(searchQuery); setShowRequest(true); }}
              className="bg-primary"
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              Request This Quiz
            </Button>
          </div>
        ) : sortBy === "points" ? (
          pointsOrder.filter(k => pointsGroups[k]).map((pts) => {
            const groupBooks = pointsGroups[pts];
            return (
            <div key={pts} className="mb-10">
              <h2 className="text-lg font-bold mb-4 text-foreground">{pts} Point Books</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {groupBooks.map((book) => {
                  const result = results.find(r => r.bookId === book.id);
                  const isDone = completedIds.has(book.id);
                  return (
                    <Card
                      key={book.id}
                      className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
                      onClick={() => { if (!(user?.role === 'teacher' || user?.isAdmin)) navigate(`/quiz/${book.id}`); }}
                      data-testid={`card-book-${book.id}`}
                    >
                      <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt={`Cover of ${book.title}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary text-white p-4 text-center">
                            <span className="font-bold text-sm">{book.title}</span>
                          </div>
                        )}
                        {isDone && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                            ✓ Done
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{book.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
                        {/* Points badge */}
                        <div className="mt-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            book.pointsValue === 10 ? "bg-green-500/20 text-green-400" :
                            book.pointsValue === 20 ? "bg-primary/20 text-primary" :
                            book.pointsValue === 30 ? "bg-red-500/20 text-red-400" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            <Trophy className="w-3 h-3" />
                            {book.pointsValue || 10} pts
                          </span>
                        </div>
                        {result && (
                          <p className="text-xs text-primary font-semibold mt-1">
                            {result.score}/{result.total} correct
                          </p>
                        )}
                        {/* Action buttons */}
                        <div className="flex gap-1.5 mt-2">
                          {book.readUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/read/${book.id}`);
                              }}
                              data-testid={`button-read-${book.id}`}
                            >
                              <BookOpen className="w-3 h-3 mr-1" />
                              Read
                            </Button>
                          )}
                          {!(user?.role === 'teacher' || user?.isAdmin) && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/quiz/${book.id}`);
                            }}
                            data-testid={`button-quiz-${book.id}`}
                          >
                            Quiz
                          </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
          })
        ) : (
          <div className="mb-10">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sortedBooks.map((book) => {
                const result = results.find(r => r.bookId === book.id);
                const isDone = completedIds.has(book.id);
                return (
                  <Card
                    key={book.id}
                    className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
                    onClick={() => { if (!(user?.role === 'teacher' || user?.isAdmin)) navigate(`/quiz/${book.id}`); }}
                  >
                    <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={`Cover of ${book.title}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary text-white p-4 text-center">
                          <span className="font-bold text-sm">{book.title}</span>
                        </div>
                      )}
                      {isDone && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                          ✓ Done
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{book.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          book.pointsValue === 10 ? "bg-green-500/20 text-green-400" :
                          book.pointsValue === 20 ? "bg-primary/20 text-primary" :
                          book.pointsValue === 30 ? "bg-red-500/20 text-red-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          <Trophy className="w-3 h-3" />
                          {book.pointsValue || 10} pts
                        </span>
                      </div>
                      {result && (
                        <p className="text-xs text-primary font-semibold mt-1">
                          {result.score}/{result.total} correct
                        </p>
                      )}
                      <div className="flex gap-1.5 mt-2">
                        {book.readUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/read/${book.id}`);
                            }}
                          >
                            <BookOpen className="w-3 h-3 mr-1" />
                            Read
                          </Button>
                        )}
                        {!(user?.role === 'teacher' || user?.isAdmin) && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/quiz/${book.id}`);
                          }}
                        >
                          Quiz
                        </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Student Inbox Dialog */}
      <Dialog open={showInbox} onOpenChange={setShowInbox}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5" />
              Conversation with Teacher
            </DialogTitle>
          </DialogHeader>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Send one below!</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderType === "teacher" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.senderType === "teacher"
                      ? "bg-muted/50 border border-border rounded-tl-sm"
                      : "bg-primary text-white rounded-tr-sm"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${msg.senderType === "teacher" ? "text-muted-foreground" : "text-white/80"}`}>
                        {msg.senderType === "teacher" ? "Teacher" : "You"}
                      </span>
                      <span className={`text-xs ${msg.senderType === "teacher" ? "text-muted-foreground" : "text-white/60"}`}>
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-sm ${msg.senderType === "teacher" ? "text-foreground" : "text-white"}`}>{msg.messageText}</p>
                    {msg.linkUrl && (
                      <a href={msg.linkUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 mt-2 text-xs hover:underline ${msg.senderType === "teacher" ? "text-primary" : "text-white/80"}`}>
                        Open link
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="pt-3 border-t border-border">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Send a message to your teacher..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none mb-2"
            />
            <Button size="sm" onClick={handleSendMsg} disabled={!messageText.trim() || sendingMsg}>
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
