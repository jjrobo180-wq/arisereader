import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, LogOut, User, Settings, Trophy, PlusCircle, X, Search, Inbox, ChevronDown, Send, MoreVertical, Brain, Sparkles, BarChart3, Clock, GraduationCap, Bookmark, ShieldCheck, CheckCircle2, Gift } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { BrandText } from "@/components/BrandText";
import { getMascotEmoji } from "@/lib/schoolTheme";
import { ReportProblemButton } from "@/components/ReportProblemButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QuizGeneratingOverlay from "@/components/QuizGeneratingOverlay";

// Book IDs that appear in the school curriculum section
const CURRICULUM_BOOK_IDS = [303, 38]; // Shadow Shaper, The Outsiders

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
let libraryCache: { books: Book[]; results: QuizResult[]; announcement: string; quizCount?: number; studentBanner?: { text: string; bgColor: string; textColor: string; active: boolean } } = {
  books: [],
  results: [],
  announcement: "",
  studentBanner: undefined,
};

export default function Library() {
  const { user, token, logout, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  // Initialize from cache so data shows instantly on remount
  const [books, setBooks] = useState<Book[]>(libraryCache.books);
  const [quizCount, setQuizCount] = useState(libraryCache.quizCount || 0);
  const [results, setResults] = useState<QuizResult[]>(libraryCache.results);
  const [loading, setLoading] = useState(libraryCache.books.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [adminBandFilter, setAdminBandFilter] = useState("");
  const [bookBands, setBookBands] = useState<Record<string, string>>({});
  const [userBand, setUserBand] = useState("");
  const [showBandInfo, setShowBandInfo] = useState(false);
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
  const [studentBanner, setStudentBanner] = useState<{ text: string; bgColor: string; textColor: string; active: boolean } | undefined>(libraryCache.studentBanner);
  const [teacherBanner, setTeacherBanner] = useState<{ text: string; bgColor: string; textColor: string; active: boolean } | undefined>();
  const [iAriseBookIds, setIAriseBookIds] = useState<number[]>([]);
  const [iAriseEstTimes, setIAriseEstTimes] = useState<Record<string, string>>({});

  const [showRequest, setShowRequest] = useState(false);
  const [requestBook, setRequestBook] = useState("");
  const [requestAuthor, setRequestAuthor] = useState("");
  const [requestMsg, setRequestMsg] = useState("");
  const [requestError, setRequestError] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Instant AI quiz state
  const [showInstant, setShowInstant] = useState(false);
  const [showGenerating, setShowGenerating] = useState(false);
  const [pendingBookId, setPendingBookId] = useState<number | null>(null);
  const [showQuizDisclaimer, setShowQuizDisclaimer] = useState(false);
  const [showEyeGazeInstant, setShowEyeGazeInstant] = useState(false);
  const [animeComicFilter, setAnimeComicFilter] = useState(false);
  const [animeComicIds, setAnimeComicIds] = useState<number[]>([]);
  const [classReadingIds, setClassReadingIds] = useState<number[]>([]);
  const [favTopics, setFavTopics] = useState<string[]>([]);
  const [favBookIds, setFavBookIds] = useState<number[]>([]);
  const [suggestedBooks, setSuggestedBooks] = useState<{topic: string; title: string; author: string; coverUrl: string}[]>([]);
  const [favOnboarded, setFavOnboarded] = useState(false);
  const [showFavOnboarding, setShowFavOnboarding] = useState(false);
  const [favSearch, setFavSearch] = useState("");
  const [favPicks, setFavPicks] = useState<string[]>([]);
  const [favError, setFavError] = useState("");
  const [favSaving, setFavSaving] = useState(false);
  const [favQuizTopic, setFavQuizTopic] = useState("");
  const [favQuizError, setFavQuizError] = useState("");
  const [pendingFavBookId, setPendingFavBookId] = useState<number | null>(null);
  const [iariseTopics, setIariseTopics] = useState<string[]>([]);
  const [iariseBookIds, setIariseBookIds] = useState<number[]>([]);
  const [showIariseCustomize, setShowIariseCustomize] = useState(false);
  const [iarisePicks, setIarisePicks] = useState<string[]>([]);
  const [iariseSearch, setIariseSearch] = useState("");
  const [iariseError, setIariseError] = useState("");
  const [iariseSaving, setIariseSaving] = useState(false);
  const [iariseQuizTopic, setIariseQuizTopic] = useState("");
  const [pendingIariseBookId, setPendingIariseBookId] = useState<number | null>(null);
  const [showBookAction, setShowBookAction] = useState(false);
  const [selectedBookForAction, setSelectedBookForAction] = useState<any>(null);
  const [bookActionMsg, setBookActionMsg] = useState("");
  const [bookActionStep, setBookActionStep] = useState<"options" | "confirm-quiz">("options");
  const [eyeGazeTopic, setEyeGazeTopic] = useState("");
  const [eyeGazeError, setEyeGazeError] = useState("");
  const [pendingEyeGazeQuizId, setPendingEyeGazeQuizId] = useState<number | null>(null);
  const [instantBook, setInstantBook] = useState("");
  const [instantAuthor, setInstantAuthor] = useState("");
  const [instantMsg, setInstantMsg] = useState("");
  const [instantError, setInstantError] = useState("");
  const [instantLoading, setInstantLoading] = useState(false);
  const [studentRewards, setStudentRewards] = useState<any[]>([]);
  const [showRewardsPage, setShowRewardsPage] = useState(false);
  const [claimingRewardId, setClaimingRewardId] = useState<number | null>(null);
  const [claimMsg, setClaimMsg] = useState("");

  const [eyeGazeQuizzes, setEyeGazeQuizzes] = useState<any[]>([]);
  const [customQuizzes, setCustomQuizzes] = useState<any[]>([]);
  const [regularCustomQuizzes, setRegularCustomQuizzes] = useState<any[]>([]);
  const [showEyeGaze, setShowEyeGaze] = useState(false);
  const [eyeGazeSortBy, setEyeGazeSortBy] = useState<"new" | "title" | "level">("new");
  const [eyeGazeSearch, setEyeGazeSearch] = useState("");

  // Reset eye gaze state when user changes (handles login/logout switching)
  useEffect(() => {
    if (!user) {
      setEyeGazeQuizzes([]);
      setCustomQuizzes([]);
      setRegularCustomQuizzes([]);
      setShowEyeGaze(false);
    } else if (user.username === 'sample') {
      // Sample student: show eye gaze section with 5 example quizzes for tutorial
      setShowEyeGaze(true);
      setEyeGazeQuizzes([
        { id: 'sample-eg-1', title: 'Animals — What Do You See?', description: 'Look at the picture and pick the right animal', level: 'K-2', pointsValue: 5, cover_visual: '🐶', coverUrl: '', _sample: true, hasCompleted: false },
        { id: 'sample-eg-2', title: 'Colors — Find the Red One', description: 'Eye gaze to the correct color', level: 'K-2', pointsValue: 5, cover_visual: '🔴', coverUrl: '', _sample: true, hasCompleted: false },
        { id: 'sample-eg-3', title: 'Shapes — Circle, Square, Triangle', description: 'Identify shapes by looking', level: 'K-2', pointsValue: 5, cover_visual: '⭕', coverUrl: '', _sample: true, hasCompleted: false },
        { id: 'sample-eg-4', title: 'Everyday Objects — What Is This?', description: 'Look at common objects and identify them', level: '3-5', pointsValue: 10, cover_visual: '🎒', coverUrl: '', _sample: true, hasCompleted: false },
        { id: 'sample-eg-5', title: 'Actions — What Are They Doing?', description: 'Identify actions by gazing at the right picture', level: '3-5', pointsValue: 10, cover_visual: '🏃', coverUrl: '', _sample: true, hasCompleted: false },
      ]);
      setCustomQuizzes([]);
    } else {
      // Only show eye gaze section for eye gaze users
      setShowEyeGaze(!!user.is_eye_gaze_user);
      if (!user.is_eye_gaze_user) {
        setEyeGazeQuizzes([]);
        setCustomQuizzes([]);
      }
    }
  }, [user?.id, user?.is_eye_gaze_user, user?.username]);

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
      // Fetch iArise book IDs and estimated times
      try {
        const [iAriseRes, estTimesRes] = await Promise.all([
          fetch(`${API_BASE}/api/i-arise-book-ids`),
          fetch(`${API_BASE}/api/i-arise-est-times`)
        ]);
        if (iAriseRes.ok) {
          const iAriseData = await iAriseRes.json();
          setIAriseBookIds(Array.isArray(iAriseData.bookIds) ? iAriseData.bookIds : []);
        }
        if (estTimesRes.ok) {
          setIAriseEstTimes(await estTimesRes.json());
        }
      } catch {}
      // Fetch book grade bands for admin filtering
      if (user?.isAdmin) {
        try {
          const bandsRes = await fetch(`${API_BASE}/api/admin/book-bands`, { headers: { Authorization: `Bearer ${authToken}` } });
          if (bandsRes.ok) {
            const bandsData = await bandsRes.json();
            setBookBands(bandsData);
          }
        } catch {}
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
      // Fetch user's grade band
      try {
        const bandRes = await fetch(`${API_BASE}/api/grade-band-info`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (bandRes.ok) {
          const bandData = await bandRes.json();
          if (bandData?.band) setUserBand(bandData.band);
        }
      } catch {}
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
      // Also fetch banners
      const bannerRes = await fetch(`${API_BASE}/api/banners`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (bannerRes.ok) {
        const bannerData = await bannerRes.json();
        if (bannerData.studentBanner) {
          setStudentBanner(bannerData.studentBanner);
          libraryCache.studentBanner = bannerData.studentBanner;
        }
        if (bannerData.teacherBanner) {
          setTeacherBanner(bannerData.teacherBanner);
        }
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
    // Fetch anime/comic book IDs for filtering (all users)
    fetch(`${API_BASE}/api/settings/anime_comic_book_ids`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.value) {
          try { setAnimeComicIds(JSON.parse(data.value)); } catch {}
        }
      })
      .catch(() => {});
    // Fetch class reading book IDs (all users)
    fetch(`${API_BASE}/api/settings/class_reading_book_ids`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.value) {
          try { setClassReadingIds(JSON.parse(data.value)); } catch {}
        }
      })
      .catch(() => {});
    // Fetch student favorites (students only, not admin/teacher/parent)
    if (!user?.isAdmin && user?.role !== 'teacher' && user?.role !== 'parent') {
      const authToken = token || getTokenFromCookie();
      if (authToken) {
        fetch(`${API_BASE}/api/student/favorites`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data) {
              setFavTopics(data.topics || []);
              setFavBookIds(data.bookIds || []);
              setFavOnboarded(data.onboarded || false);
              if (!data.onboarded) {
                setShowFavOnboarding(true);
                setFavPicks(data.topics || []);
              }
            }
          })
          .catch(() => {});
        // Fetch iArise custom topics
        fetch(`${API_BASE}/api/student/iarise-topics`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data) {
              setIariseTopics(data.topics || []);
              setIariseBookIds(data.bookIds || []);
            }
          })
          .catch(() => {});
        // Fetch suggested real books from Open Library based on favorites
        fetch(`${API_BASE}/api/student/suggested-books`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && data.books) {
              setSuggestedBooks(data.books);
            }
          })
          .catch(() => {});
        // Fetch student rewards (admin-assigned)
        fetch(`${API_BASE}/api/student/rewards`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && data.rewards) {
              setStudentRewards(data.rewards);
            }
          })
          .catch(() => {});
      }
    }
    const interval = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(interval);
  }, [fetchBooks, fetchAnnouncement, token, user?.is_eye_gaze_user]);

  // Refresh user points when library loads (catches quiz completions)
  useEffect(() => {
    refreshUser();
  }, []);

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

  const handleClaimReward = async (rewardId: number) => {
    setClaimingRewardId(rewardId);
    setClaimMsg("");
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/student/rewards/${rewardId}/claim`, {
        method: "POST",
 headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to claim reward");
      setClaimMsg(data.message || "Reward request sent!");
      // Refresh rewards
      const res2 = await fetch(`${API_BASE}/api/student/rewards`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data2 = await res2.json();
      if (data2 && data2.rewards) setStudentRewards(data2.rewards);
    } catch (err: any) {
      setClaimMsg(err.message);
    } finally {
      setClaimingRewardId(null);
    }
  };

  const handleInstantQuiz = async () => {
    setInstantError("");
    setInstantMsg("");
    if (!instantBook.trim() || !instantAuthor.trim()) return;
    setInstantLoading(true);
    setShowGenerating(true);
    setShowInstant(false);
    setPendingBookId(null);
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/instant-quiz`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookTitle: instantBook.trim(), author: instantAuthor.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.bookId) setPendingBookId(data.bookId);
        setInstantMsg(data.message || "Quiz generated!");
        fetchBooks();
      } else if (data.needsManualReview) {
        // Quiz requires manual review — show the message, stop loading
        setShowGenerating(false);
        setInstantError(data.message);
        setShowInstant(true);
      } else {
        setInstantError(data.message || "Failed to generate quiz.");
        setShowGenerating(false);
      }
    } catch {
      setInstantError("Failed to generate quiz. Please try again.");
      setShowGenerating(false);
    } finally {
      setInstantLoading(false);
    }
  };

  const handleGeneratingComplete = () => {
    setShowGenerating(false);
    setInstantBook("");
    setInstantAuthor("");
    setInstantMsg("");
    // Show disclaimer before launching the quiz
    if (pendingBookId) {
      setShowQuizDisclaimer(true);
    } else {
      navigate("/library");
    }
  };

  const handleDisclaimerProceed = () => {
    setShowQuizDisclaimer(false);
    if (pendingBookId) {
      navigate(`/quiz/${pendingBookId}`);
    } else {
      navigate("/library");
    }
  };

  // Eye Gaze instant AI quiz
  const handleEyeGazeInstant = async () => {
    setEyeGazeError("");
    if (!eyeGazeTopic.trim()) return;
    setShowEyeGazeInstant(false);
    setShowGenerating(true);
    setPendingEyeGazeQuizId(null);
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/instant-quiz-eye-gaze`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: eyeGazeTopic.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.quizId) setPendingEyeGazeQuizId(data.quizId);
      } else {
        setEyeGazeError(data.message || "Failed to generate quiz.");
        setShowGenerating(false);
      }
    } catch {
      setEyeGazeError("Failed to generate quiz. Please try again.");
      setShowGenerating(false);
    }
  };

  const handleEyeGazeGeneratingComplete = () => {
    setShowGenerating(false);
    setEyeGazeTopic("");
    setEyeGazeError("");
    if (pendingEyeGazeQuizId) {
      navigate(`/eye-gaze-quiz/${pendingEyeGazeQuizId}`);
    } else {
      navigate("/library");
    }
  };

  // --- Favorites handlers ---
  const SUGGESTED_TOPICS = [
    "Real Pigeons", "Basketball", "Soccer", "Football", "Science Fiction", "Fantasy",
    "Adventure", "Mystery", "Animals", "Space", "Dinosaurs", "Superheroes",
    "History", "Nature", "Technology", "Art", "Music", "Cooking", "Video Games",
    "Greek Mythology", "Robots", "Spy Stories", "Ocean Life", "Weather",
    "Fairy Tales", "Detective Stories", "Cars", "Aviation", "Winter Sports",
  ];

  // iArise topics — school-age appropriate learning, hobbies, and life skills
  const IARISE_TOPICS = [
    "Being a Good Friend", "All About Feelings", "Bullying Prevention", "Conflict Resolution",
    "Study Skills", "Time Management", "Healthy Habits", "Sports and Fitness",
    "Cooking Basics", "Music Appreciation", "Art and Creativity", "Digital Citizenship",
    "Money Management", "Leadership", "Teamwork", "Environmental Awareness",
    "Community Service", "Career Exploration", "Cultural Diversity", "Stress Management",
    "Goal Setting", "Public Speaking", "Critical Thinking", "Problem Solving",
    "Reading Habits", "Writing Stories", "Science Experiments", "Math in Real Life",
    "Gardening", "Photography", "Drawing", "Coding Basics",
  ];

  const handleSaveFavorites = async () => {
    if (favPicks.length < 1) {
      setFavError("Pick at least 1 favorite!");
      return;
    }
    setFavSaving(true);
    setFavError("");
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/student/favorites`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topics: favPicks }),
      });
      const data = await res.json();
      if (res.ok) {
        setFavTopics(favPicks);
        setFavOnboarded(true);
        setShowFavOnboarding(false);
        setFavPicks([]);
        // Fetch fresh book suggestions based on new favorites
        fetch(`${API_BASE}/api/student/suggested-books`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data && data.books) setSuggestedBooks(data.books); })
          .catch(() => {});
      } else {
        setFavError(data.message || "Failed to save favorites.");
      }
    } catch {
      setFavError("Failed to save favorites. Please try again.");
    }
    setFavSaving(false);
  };

  const handleOpenChangeFavorites = () => {
    setFavPicks([...favTopics]);
    setFavSearch("");
    setFavError("");
    setShowFavOnboarding(true);
  };

  const handleTogglePick = (topic: string) => {
    if (favPicks.includes(topic)) {
      setFavPicks(favPicks.filter(t => t !== topic));
    } else {
      if (favPicks.length >= 5) {
        setFavError("You can pick up to 5 favorites.");
        return;
      }
      setFavPicks([...favPicks, topic]);
      setFavError("");
    }
  };

  const handleAddCustomPick = () => {
    const term = favSearch.trim();
    if (!term) return;
    if (favPicks.some(t => t.toLowerCase() === term.toLowerCase())) {
      setFavError("You already picked that!");
      return;
    }
    if (favPicks.length >= 5) {
      setFavError("You can pick up to 5 favorites.");
      return;
    }
    setFavPicks([...favPicks, term]);
    setFavSearch("");
    setFavError("");
  };

  const handleCreateFavQuiz = async (topic: string) => {
    setFavQuizError("");
    setFavQuizTopic(topic);
    setShowGenerating(true);
    setPendingFavBookId(null);
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/student/favorite-quiz`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.bookId) setPendingFavBookId(data.bookId);
        // Refresh books so the new quiz shows up
        fetchBooks();
      } else {
        setFavQuizError(data.message || "Failed to generate quiz.");
        setShowGenerating(false);
      }
    } catch {
      setFavQuizError("Failed to generate quiz. Please try again.");
      setShowGenerating(false);
    }
  };

  const handleFavQuizComplete = () => {
    setShowGenerating(false);
    setFavQuizTopic("");
    setFavQuizError("");
    if (pendingFavBookId) {
      navigate(`/quiz/${pendingFavBookId}`);
    } else {
      navigate("/library");
    }
  };

  // --- Book action modal (ask parents / generate quiz) ---
  const handleBookTap = (book: any) => {
    setSelectedBookForAction(book);
    setBookActionMsg("");
    setBookActionStep("options");
    setShowBookAction(true);
  };

  const handleAskParents = async () => {
    if (!selectedBookForAction) return;
    setBookActionMsg("");
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messageText: `I'd like to read "${selectedBookForAction.title}" by ${selectedBookForAction.author || "Unknown"}. Can you get this book for me?`,
        }),
      });
      if (res.ok) {
        setBookActionMsg("Request sent! Ask your parents or teacher to check their messages.");
      } else {
        setBookActionMsg("Failed to send request. Please try again.");
      }
    } catch {
      setBookActionMsg("Failed to send request. Please try again.");
    }
  };

  const handleGenerateQuizFromBook = async () => {
    if (!selectedBookForAction) return;
    const book = selectedBookForAction;
    setShowBookAction(false);
    // Check if quiz already exists for this book (by ID or title)
    const existingQuiz = sortedBooks.find(b => b.id === book.id || b.title.toLowerCase() === (book.title || "").toLowerCase());
    if (existingQuiz) {
      navigate(`/quiz/${existingQuiz.id}`);
      return;
    }
    // Generate quiz using the instant quiz endpoint
    setInstantBook(book.title);
    setInstantAuthor(book.author || "");
    setShowGenerating(true);
    setPendingBookId(null);
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/instant-quiz`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bookTitle: book.title, author: book.author || "Unknown" }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.bookId) setPendingBookId(data.bookId);
        fetchBooks();
      } else {
        setShowGenerating(false);
      }
    } catch {
      setShowGenerating(false);
    }
  };

  // --- iArise customization handlers ---
  const handleSaveIarise = async () => {
    if (iarisePicks.length < 1) {
      setIariseError("Pick at least 1 topic!");
      return;
    }
    setIariseSaving(true);
    setIariseError("");
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/student/iarise-topics`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topics: iarisePicks }),
      });
      const data = await res.json();
      if (res.ok) {
        setIariseTopics(iarisePicks);
        setShowIariseCustomize(false);
        setIarisePicks([]);
      } else {
        setIariseError(data.message || "Failed to save.");
      }
    } catch {
      setIariseError("Failed to save. Please try again.");
    }
    setIariseSaving(false);
  };

  const handleToggleIarisePick = (topic: string) => {
    if (iarisePicks.includes(topic)) {
      setIarisePicks(iarisePicks.filter(t => t !== topic));
    } else {
      if (iarisePicks.length >= 5) {
        setIariseError("You can pick up to 5 topics.");
        return;
      }
      setIarisePicks([...iarisePicks, topic]);
      setIariseError("");
    }
  };

  const handleAddIariseCustomPick = () => {
    const term = iariseSearch.trim();
    if (!term) return;
    if (iarisePicks.some(t => t.toLowerCase() === term.toLowerCase())) {
      setIariseError("Already picked!");
      return;
    }
    if (iarisePicks.length >= 5) {
      setIariseError("Max 5 topics.");
      return;
    }
    setIarisePicks([...iarisePicks, term]);
    setIariseSearch("");
    setIariseError("");
  };

  const handleCreateIariseQuiz = async (topic: string) => {
    setIariseQuizTopic(topic);
    setShowGenerating(true);
    setPendingIariseBookId(null);
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/student/iarise-quiz`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.bookId) setPendingIariseBookId(data.bookId);
        fetchBooks();
      } else {
        setShowGenerating(false);
      }
    } catch {
      setShowGenerating(false);
    }
  };

  const handleIariseQuizComplete = () => {
    setShowGenerating(false);
    setIariseQuizTopic("");
    if (pendingIariseBookId) {
      navigate(`/quiz/${pendingIariseBookId}`);
    } else {
      navigate("/library");
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
  const totalPoints = user?.totalPoints ?? (results || []).reduce((sum, r) => sum + (r.pointsEarned ?? r.score ?? 0), 0);

  // Filter books by search and admin band filter
  const filteredBooks = (searchQuery.trim()
    ? (books || []).filter(b => 
        (b?.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b?.author || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (books || [])
  ).filter(b => {
    if (user?.isAdmin && adminBandFilter) {
      const band = bookBands[String(b.id)];
      if (band !== adminBandFilter) return false;
    }
    return true;
  });

  // Sort books
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    // Curriculum books always appear first
    const aCur = CURRICULUM_BOOK_IDS.includes(a.id) ? 0 : 1;
    const bCur = CURRICULUM_BOOK_IDS.includes(b.id) ? 0 : 1;
    if (aCur !== bCur) return aCur - bCur;
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

  // Separate iArise books, curriculum books, and the rest
  const isSampleStudent = user?.username === 'sample';
  const [iAriseExpanded, setIAriseExpanded] = useState(false);
  const iAriseBooks = sortedBooks.filter(b => iAriseBookIds.includes(b.id) && !animeComicIds.includes(b.id) && !classReadingIds.includes(b.id));
  // For sample student, limit iArise to 5 books unless expanded
  const displayedIAriseBooks = isSampleStudent && !iAriseExpanded ? iAriseBooks.slice(0, 5) : iAriseBooks;
  const curriculumBooks = sortedBooks.filter(b => CURRICULUM_BOOK_IDS.includes(b.id) && !iAriseBookIds.includes(b.id) && !animeComicIds.includes(b.id) && !classReadingIds.includes(b.id));
  const nonCurriculumBooks = sortedBooks.filter(b => !CURRICULUM_BOOK_IDS.includes(b.id) && !iAriseBookIds.includes(b.id) && !animeComicIds.includes(b.id) && !classReadingIds.includes(b.id));
  const animeComicBooks = sortedBooks.filter(b => animeComicIds.includes(b.id));
  const classReadingBooks = sortedBooks.filter(b => classReadingIds.includes(b.id));
  const favoriteBooks = sortedBooks.filter(b => favBookIds.includes(b.id));
  const iAriseCustomBooks = sortedBooks.filter(b => iariseBookIds.includes(b.id));
  // Match favorites to existing books on the site (by title keyword match)
  const matchedFavBooks = favTopics.length > 0 ? sortedBooks.filter(b => {
    const titleLower = (b.title || "").toLowerCase();
    const authorLower = (b.author || "").toLowerCase();
    return favTopics.some(t => {
      const topicLower = t.toLowerCase();
      return titleLower.includes(topicLower) || authorLower.includes(topicLower) ||
        topicLower.includes(titleLower);
    });
  }).filter(b => !favBookIds.includes(b.id)) : [];

  // Pagination — 10 books per page
  const booksPerPage = 10;
  const totalPages = Math.ceil(nonCurriculumBooks.length / booksPerPage);
  const pagedBooks = nonCurriculumBooks.slice((currentPage - 1) * booksPerPage, currentPage * booksPerPage);

  // Group by points value (only when sorting by points)
  const pointsGroups: Record<string, Book[]> = {};
  const pointsOrder = ["10", "20", "30"];
  if (sortBy === "points") {
    nonCurriculumBooks.forEach(b => {
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
            <BrandText />
            {userBand && !user?.isAdmin && (
              <button
                onClick={() => setShowBandInfo(!showBandInfo)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"
                title="Click to learn about grade bands"
                data-testid="band-badge"
                data-tour="band-badge"
              >
                <GraduationCap className="w-3 h-3" />
                {userBand} Band
              </button>
            )}
            {showBandInfo && userBand && (
              <div className="absolute top-16 left-3 z-50 max-w-xs rounded-xl bg-card border border-border shadow-lg p-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-primary">Your Grade Band: {userBand}</span>
                  <button onClick={() => setShowBandInfo(false)} className="text-muted-foreground hover:text-foreground">×</button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Grade bands group students by reading level so you compete with peers at your level.
                  <br /><br />
                  <strong className="text-foreground">K-2:</strong> Kindergarten–2nd grade (Early Readers)<br />
                  <strong className="text-foreground">3-5:</strong> 3rd–5th grade (Elementary)<br />
                  <strong className="text-foreground">6-8:</strong> 6th–8th grade (Middle School)<br />
                  <strong className="text-foreground">9-12:</strong> 9th–12th grade (High School)<br /><br />
                  Your library, leaderboard, and quizzes are all filtered to your band. You can request a band change from your Profile page.
                </p>
              </div>
            )}
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
            <div data-tour="points" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 text-primary font-semibold text-sm">
              <Trophy className="w-4 h-4" />
              {totalPoints} pts
            </div>
            <div className="hidden sm:flex items-center relative" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "0.5rem" }}>
              <button data-tour="fyp" onClick={() => navigate("/fyp")} className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-primary/10 rounded-l-lg">
                <Sparkles className="w-4 h-4 mr-1" style={{ color: "#f59e0b" }} />
                <span className="hidden md:inline" style={{ color: "#f59e0b", fontWeight: 600 }}>F.Y.P</span>
              </button>
              <button onClick={() => { window.location.hash = '/saved'; }} className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-primary/10 rounded-r-lg border-l border-primary/20">
                <Bookmark className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                <span className="hidden md:inline" style={{ color: "#f59e0b", fontWeight: 600 }}>My Books</span>
              </button>
              {studentRewards.length > 0 && (
                <button onClick={() => setShowRewardsPage(true)} className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-primary/10 rounded-lg border-l border-primary/20">
                  <Gift className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                  <span className="hidden md:inline" style={{ color: "#f59e0b", fontWeight: 600 }}>My Rewards</span>
                  {studentRewards.some(r => r.claimStatus === "approved") && (
                    <span className="ml-0.5 w-2 h-2 rounded-full bg-green-500" />
                  )}
                </button>
              )}
              {studentRewards.length === 0 && !user?.isAdmin && user?.role !== 'teacher' && user?.role !== 'parent' && (
                <button onClick={() => setShowRewardsPage(true)} className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-primary/10 rounded-lg border-l border-primary/20">
                  <Gift className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                  <span className="hidden md:inline" style={{ color: "#f59e0b", fontWeight: 600 }}>My Rewards</span>
                </button>
              )}
              <button onClick={() => navigate("/competition")} className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-primary/10 rounded-lg border-l border-primary/20">
                <Trophy className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                <span className="hidden md:inline" style={{ color: "#f59e0b", fontWeight: 600 }}>Competition</span>
              </button>
            </div>
            {/* More dropdown - works on both desktop and mobile */}
            <div className="relative" ref={(el) => { mobileMenuRef.current = el; }}>
              <Button variant="ghost" size="sm" onClick={() => setShowMobileMenu(!showMobileMenu)}>
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showMobileMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-card border border-border shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border sm:hidden">
                    <span className="text-sm font-semibold text-primary">{totalPoints} pts</span>
                  </div>
                  <button onClick={() => { navigate("/fyp"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2 sm:hidden" style={{ color: "#f59e0b", fontWeight: 600 }}>
                    <Sparkles className="w-4 h-4" /> A.R.I.S.E F.Y.P
                  </button>
                  <button onClick={() => { window.location.hash = '/saved'; setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2 sm:hidden" style={{ color: "#f59e0b" }}>
                    <Bookmark className="w-4 h-4" /> My Books
                  </button>
                  {studentRewards.length > 0 ? (
                    <button onClick={() => { setShowRewardsPage(true); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2" style={{ color: "#f59e0b" }}>
                      <Gift className="w-4 h-4" /> My Rewards
                      {studentRewards.some(r => r.claimStatus === "approved") && <span className="ml-1 w-2 h-2 rounded-full bg-green-500" />}
                    </button>
                  ) : !user?.isAdmin && user?.role !== 'teacher' && user?.role !== 'parent' ? (
                    <button onClick={() => { setShowRewardsPage(true); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2" style={{ color: "#f59e0b" }}>
                      <Gift className="w-4 h-4" /> My Rewards
                    </button>
                  ) : null}
                  <button onClick={() => { navigate("/progress"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Progress
                  </button>
                  <button data-tour="leaderboard-link" onClick={() => { navigate("/leaderboard"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                    <Trophy className="w-4 h-4" /> Leaderboard
                  </button>
                  <button onClick={() => { navigate("/competition"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2" style={{ color: "#f59e0b", fontWeight: 600 }}>
                    <Gift className="w-4 h-4" /> Competition
                  </button>
                  <button onClick={() => { navigate("/polls"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Polls
                  </button>
                  <button onClick={() => { navigate("/profile"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                    <User className="w-4 h-4" /> {user?.displayName || "Profile"}
                  </button>
                  {user?.isAdmin && (
                    <button onClick={() => { navigate("/admin"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Admin
                    </button>
                  )}
                  {user?.role === 'teacher' && (
                    <button onClick={() => { navigate("/teacher-dashboard"); setShowMobileMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Teacher
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
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Banner from admin - student banner only for students, teacher banner only for teachers/admins */}
        {user?.role === 'student' && studentBanner && studentBanner.active && studentBanner.text && (
          <div className="mb-6 rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: studentBanner.bgColor + '20', borderColor: studentBanner.bgColor, borderWidth: 1 }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: studentBanner.bgColor + '40' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={studentBanner.textColor} strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm" style={{ color: studentBanner.textColor }}>{studentBanner.text}</p>
            </div>
          </div>
        )}
        {(user?.role === 'teacher' || user?.isAdmin) && teacherBanner && teacherBanner.active && teacherBanner.text && (
          <div className="mb-6 rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: teacherBanner.bgColor + '20', borderColor: teacherBanner.bgColor, borderWidth: 1 }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: teacherBanner.bgColor + '40' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={teacherBanner.textColor} strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm" style={{ color: teacherBanner.textColor }}>{teacherBanner.text}</p>
            </div>
          </div>
        )}

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

        {/* Student Rewards banner (admin-assigned) */}
        {!user?.isAdmin && user?.role !== 'teacher' && user?.role !== 'parent' && studentRewards.length > 0 && (
          <div className="mb-6 space-y-3">
            {studentRewards.map((reward) => {
              const status = reward.claimStatus;
              return (
              <div
                key={reward.id}
                className={`rounded-xl px-4 py-4 flex items-start gap-3 ${status === "approved" ? "bg-green-500/15 border border-green-500/30" : status === "requested" ? "bg-blue-500/15 border border-blue-500/30" : reward.completed ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-amber-500/15 border border-amber-500/30"}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${status === "approved" ? "bg-green-500/30" : status === "requested" ? "bg-blue-500/30" : reward.completed ? "bg-emerald-500/30" : "bg-amber-500/30"}`}>
                  {status === "approved" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : status === "requested" ? (
                    <Clock className="w-5 h-5 text-blue-400" />
                  ) : reward.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-foreground">{reward.title}</p>
                    {status === "approved" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white">APPROVED</span>
                    )}
                    {status === "requested" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white">PENDING</span>
                    )}
                    {reward.completed && !status && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">EARNED</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 mt-1">{reward.message}</p>
                  {reward.progress && (
                    <p className="text-xs text-primary font-medium mt-2">
                      Progress: {reward.progress} quizzes completed
                      {reward.completed && !status ? " — You earned it! Tap View My Rewards to claim." : ""}
                    </p>
                  )}
                  {reward.expiresAt && (
                    <p className="text-[10px] text-muted-foreground mt-1">Expires: {new Date(reward.expiresAt).toLocaleDateString()}</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 text-xs"
                    onClick={() => setShowRewardsPage(true)}
                  >
                    <Gift className="w-3.5 h-3.5 mr-1" />
                    {status === "approved" ? "Show Approved Reward" : status === "requested" ? "View Status" : "View My Rewards"}
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Welcome banner */}
        <div className="mb-8 rounded-2xl bg-primary text-white p-6 sm:p-8 shadow-lg">
          <h1 data-tour="welcome" className="text-2xl sm:text-3xl font-bold">{getMascotEmoji() && <span className="mr-2">{getMascotEmoji()}</span>}Hi, {user?.displayName}!</h1>
          {user?.role === 'teacher' || user?.isAdmin ? (
            <p className="mt-1 text-white/90">Browse the library and view student stats below.</p>
          ) : (
            <p className="mt-1 text-white/90">Pick a book you've read and take the quiz to earn points.</p>
          )}
          <div className="flex gap-4 sm:gap-6 mt-4 flex-wrap">
            <div data-tour="points-trophy">
              <div className="text-3xl font-bold">{totalPoints}</div>
              <div className="text-sm text-white/80">Points earned</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{results.length}</div>
              <div className="text-sm text-white/80">Quizzes done</div>
            </div>
          </div>
        </div>

        {/* Create a Quiz - students only */}
        {!(user?.role === 'teacher' || user?.isAdmin) && (
          <div className="mb-8" data-tour="request-quiz">
            <Button
              onClick={() => { setShowInstant(true); setInstantError(""); setInstantMsg(""); }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Create a Quiz
            </Button>
          </div>
        )}

        {/* Create a Quiz modal */}
        {showInstant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !instantLoading && setShowInstant(false)}>
            <Card className="w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    Create a Quiz
                  </h3>
                  {!instantLoading && (
                    <Button variant="ghost" size="sm" onClick={() => setShowInstant(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {instantMsg ? (
                  <div className="text-center py-6">
                    <Sparkles className="w-10 h-10 text-green-400 mx-auto mb-3" />
                    <p className="text-sm text-green-400 font-medium">{instantMsg}</p>
                  </div>
                ) : (
                  <>
                    {instantError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {instantError}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="instant-title">Book Title *</Label>
                      <Input
                        id="instant-title"
                        value={instantBook}
                        onChange={(e) => setInstantBook(e.target.value)}
                        placeholder="e.g., Charlotte's Web"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instant-author">Author *</Label>
                      <Input
                        id="instant-author"
                        value={instantAuthor}
                        onChange={(e) => setInstantAuthor(e.target.value)}
                        placeholder="e.g., E.B. White"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                      A 10-question quiz will be created instantly. We use premium AI technology — not ChatGPT or Google — with guidelines set by educators. After students complete quizzes, educators review questions and adjust scoring as needed.
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleInstantQuiz} disabled={!instantBook.trim() || !instantAuthor.trim() || instantLoading} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                        <Sparkles className="w-4 h-4 mr-1" />
                        Create Quiz
                      </Button>
                      <Button variant="outline" onClick={() => setShowInstant(false)} className="flex-1">
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
          <div data-tour="eye-gaze-section" className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">Eye Gazer &amp; Non-Verbal</h2>
              <button
                onClick={() => { setShowEyeGazeInstant(true); setEyeGazeError(""); setEyeGazeTopic(""); }}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Quiz
              </button>
            </div>
            {/* Eye Gaze search + sort bar */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search quizzes..."
                  value={eyeGazeSearch}
                  onChange={(e) => setEyeGazeSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <select
                value={eyeGazeSortBy}
                onChange={(e) => setEyeGazeSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="new">Newest</option>
                <option value="title">Title A-Z</option>
                <option value="level">By Level</option>
              </select>
            </div>
            {(() => {
              const allEyeGazeItems = [
                ...eyeGazeQuizzes.map(q => ({ ...q, _builtin: true, _key: `b-${q.id}` })),
                ...customQuizzes.map(q => ({ ...q, _builtin: false, _key: `c-${q.id}` })),
              ];
              // Filter by search
              const searched = eyeGazeSearch.trim()
                ? allEyeGazeItems.filter(q =>
                    (q.title || "").toLowerCase().includes(eyeGazeSearch.toLowerCase()) ||
                    (q.description || "").toLowerCase().includes(eyeGazeSearch.toLowerCase())
                  )
                : allEyeGazeItems;
              // Sort
              const sorted = [...searched].sort((a, b) => {
                if (eyeGazeSortBy === "title") return (a.title || "").localeCompare(b.title || "");
                if (eyeGazeSortBy === "level") return (a.level || 1) - (b.level || 1);
                // newest: by created_at desc, fallback to id desc
                const da = a.created_at || "";
                const db = b.created_at || "";
                if (da !== db) return db.localeCompare(da);
                return (b.id || 0) - (a.id || 0);
              });
              if (sorted.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No quizzes found for "{eyeGazeSearch}".</p>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sorted.map((quiz) => quiz._builtin ? (
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
              ) : (
                <button
                  key={quiz._key}
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
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
              );
            })()}
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
          {user?.isAdmin && (
            <select value={adminBandFilter} onChange={(e) => setAdminBandFilter(e.target.value)} className="px-3 py-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Bands</option>
              <option value="K-2">K-2</option>
              <option value="3-5">3-5</option>
              <option value="6-8">6-8</option>
              <option value="9-12">9-12</option>
            </select>
          )}
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
          {/* Anime & Comics filter removed — now a separate section */}
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
        ) : (
          <>
            {/* iArise Section */}
            <div className="mb-10" data-tour="iarise-section">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">iArise</h2>
                </div>
                {!user?.isAdmin && user?.role !== 'teacher' && user?.role !== 'parent' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => { setIarisePicks(iariseTopics); setShowIariseCustomize(true); }}
                  >
                    <Settings className="w-4 h-4" /> Customize
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4 ml-7">Read. Learn. Rise.</p>
              {iAriseBooks.length > 0 ? (
                <>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollSnapType: 'x mandatory' }}>
                  {displayedIAriseBooks.map((book, index) => {
                    const result = results.find(r => r.bookId === book.id);
                    const isDone = completedIds.has(book.id);
                    return (
                      <Card
                        key={book.id}
                        data-tour={index === 0 ? "first-book" : undefined}
                        className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 ring-2 ring-primary/30 flex-shrink-0 w-[160px] sm:w-[180px]"
                        style={{ scrollSnapAlign: 'start' }}
                        onClick={() => navigate(`/course/${book.id}`)}
                      >
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary text-white p-4 text-center">
                              <span className="font-bold text-sm">{book.title}</span>
                            </div>
                          )}
                          {isDone && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">✓ Done</div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{book.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary">
                              <Trophy className="w-3 h-3" />{book.pointsValue || 10} pts
                            </span>
                            {iAriseEstTimes[String(book.id)] && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                                <Clock className="w-3 h-3" />{iAriseEstTimes[String(book.id)]}
                              </span>
                            )}
                          </div>
                          {result && (
                            <p className="text-xs text-primary font-semibold mt-1">{result.score}/{result.total} correct</p>
                          )}
                          <div className="mt-2">
                            <Button size="sm" variant="default" className="h-7 text-xs w-full">
                              <BookOpen className="w-3 h-3 mr-1" />Start Course
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                {/* Show student's custom iArise generated books + create-quiz cards (always visible if student has topics) */}
                {iariseTopics.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 ml-7">My Custom iArise Lessons</p>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollSnapType: 'x mandatory' }}>
                      {iAriseCustomBooks.map((book) => {
                        const result = results.find(r => r.bookId === book.id);
                        const isDone = completedIds.has(book.id);
                        return (
                          <Card
                            key={`iarise-${book.id}`}
                            className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[180px] ring-1 ring-primary/20"
                            style={{ scrollSnapAlign: 'start' }}
                            onClick={() => navigate(`/quiz/${book.id}`)}
                          >
                            <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                              {book.coverUrl ? (
                                <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center p-4">
                                  <span className="text-sm font-medium text-center text-muted-foreground">{book.title}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <p className="text-white text-xs font-semibold line-clamp-2 mb-1">{book.title}</p>
                                <p className="text-white/70 text-[10px]">{book.author}</p>
                              </div>
                              {isDone && (
                                <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1.5">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <CardContent className="p-3">
                              <p className="text-sm font-semibold text-foreground line-clamp-1">{book.title}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary">
                                  <Trophy className="w-3 h-3" />{book.pointsValue || 2} pts
                                </span>
                                {result && (
                                  <span className="text-[10px] text-muted-foreground ml-auto">{result.score}/{result.total}</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {/* Create-quiz cards for each iArise topic — always visible */}
                      {iariseTopics.map((topic) => {
                        const hasQuiz = iAriseCustomBooks.some(b => b.title.toLowerCase() === topic.toLowerCase());
                        return (
                          <Card
                            key={`iarise-topic-${topic}`}
                            className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[180px] border-2 border-dashed border-primary/30"
                            style={{ scrollSnapAlign: 'start' }}
                            onClick={() => handleCreateIariseQuiz(topic)}
                          >
                            <div className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4">
                              <div className="text-center">
                                <PlusCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                                <p className="text-sm font-bold text-foreground line-clamp-2">{topic}</p>
                                <p className="text-xs text-muted-foreground mt-1">{hasQuiz ? "Create another" : "Tap to create quiz"}</p>
                              </div>
                            </div>
                            <CardContent className="p-3">
                              <p className="text-sm font-semibold text-foreground line-clamp-1">{topic}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-primary font-medium">{hasQuiz ? "Quiz exists" : "Ready to generate"}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isSampleStudent && iAriseBooks.length > 5 && (
                  <div className="mt-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => setIAriseExpanded(!iAriseExpanded)}>
                      {iAriseExpanded ? "Show Less" : `See All ${iAriseBooks.length} iArise Books`}
                    </Button>
                  </div>
                )}
                </>
              ) : (
                <>
                  {iariseTopics.length > 0 ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
                      <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Your custom iArise lessons are ready below. Pick a topic to generate a quiz!</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
                      <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Coming soon: quick reads about current events, hobbies, sports, and life skills.</p>
                    </div>
                  )}
                  {/* Show custom iArise section even when no iArise books exist */}
                  {iariseTopics.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 ml-7">My Custom iArise Lessons</p>
                      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollSnapType: 'x mandatory' }}>
                        {iAriseCustomBooks.map((book) => {
                          const result = results.find(r => r.bookId === book.id);
                          const isDone = completedIds.has(book.id);
                          return (
                            <Card
                              key={`iarise-empty-${book.id}`}
                              className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[180px] ring-1 ring-primary/20"
                              style={{ scrollSnapAlign: 'start' }}
                              onClick={() => navigate(`/quiz/${book.id}`)}
                            >
                              <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                                {book.coverUrl ? (
                                  <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center p-4">
                                    <span className="text-sm font-medium text-center text-muted-foreground">{book.title}</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                  <p className="text-white text-xs font-semibold line-clamp-2 mb-1">{book.title}</p>
                                  <p className="text-white/70 text-[10px]">{book.author}</p>
                                </div>
                                {isDone && (
                                  <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1.5">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <CardContent className="p-3">
                                <p className="text-sm font-semibold text-foreground line-clamp-1">{book.title}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary">
                                    <Trophy className="w-3 h-3" />{book.pointsValue || 2} pts
                                  </span>
                                  {result && (
                                    <span className="text-[10px] text-muted-foreground ml-auto">{result.score}/{result.total}</span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                        {iariseTopics.map((topic) => {
                          const hasQuiz = iAriseCustomBooks.some(b => b.title.toLowerCase() === topic.toLowerCase());
                          return (
                            <Card
                              key={`iarise-empty-topic-${topic}`}
                              className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[180px] border-2 border-dashed border-primary/30"
                              style={{ scrollSnapAlign: 'start' }}
                              onClick={() => handleCreateIariseQuiz(topic)}
                            >
                              <div className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4">
                                <div className="text-center">
                                  <PlusCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                                  <p className="text-sm font-bold text-foreground line-clamp-2">{topic}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{hasQuiz ? "Create another" : "Tap to create quiz"}</p>
                                </div>
                              </div>
                              <CardContent className="p-3">
                                <p className="text-sm font-semibold text-foreground line-clamp-1">{topic}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-primary font-medium">{hasQuiz ? "Quiz exists" : "Ready to generate"}</span>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* What You're Reading in Class Section */}
            {classReadingBooks.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">What You're Reading in Class</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{classReadingBooks.length} quizzes</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4 ml-7">Books assigned for your class.</p>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollSnapType: 'x mandatory' }}>
                  {classReadingBooks.map((book) => {
                    const result = results.find(r => r.bookId === book.id);
                    const isDone = completedIds.has(book.id);
                    const passed = result?.passed;
                    const score = result?.score;
                    const total = result?.total;
                    return (
                      <Card
                        key={book.id}
                        className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[180px]"
                        style={{ scrollSnapAlign: 'start' }}
                        onClick={() => navigate(`/quiz/${book.id}`)}
                      >
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-4">
                              <span className="text-sm font-medium text-center text-muted-foreground">{book.title}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white text-xs font-semibold line-clamp-2 mb-1">{book.title}</p>
                            <p className="text-white/70 text-[10px]">{book.author}</p>
                          </div>
                          {isDone && (
                            <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1.5">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {passed && (
                            <div className="absolute top-2 left-2 bg-blue-500 rounded-full px-2 py-0.5">
                              <span className="text-white text-[10px] font-bold">PASSED</span>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">{book.title}</p>
                          <p className="text-xs text-muted-foreground">{book.author}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary">
                              <Trophy className="w-3 h-3" />{book.pointsValue || 10} pts
                            </span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{book.ageGroup}</span>
                            {isDone && result && (
                              <span className="text-[10px] text-muted-foreground ml-auto">{score}/{total}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Your Picks Section (students only) */}
            {!user?.isAdmin && user?.role !== 'teacher' && user?.role !== 'parent' && favOnboarded && favTopics.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Your Picks</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{favTopics.length} picks</span>
                  <button
                    onClick={handleOpenChangeFavorites}
                    className="ml-auto text-xs text-primary hover:underline font-medium"
                  >Change Favorites</button>
                </div>
                <p className="text-sm text-muted-foreground mb-4 ml-7">Books picked just for you, based on your favorite topics. Tap a book to ask your parents or take a quiz!</p>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollSnapType: 'x mandatory' }}>
                  {/* Show suggested REAL books from Open Library based on favorites */}
                  {suggestedBooks.map((sbook, idx) => {
                    const existingQuiz = sortedBooks.find(b => b.title.toLowerCase() === sbook.title.toLowerCase());
                    const isDone = existingQuiz && completedIds.has(existingQuiz.id);
                    return (
                      <Card
                        key={`sugg-${idx}`}
                        className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[180px] ring-1 ring-primary/20"
                        style={{ scrollSnapAlign: 'start' }}
                        onClick={() => handleBookTap({ title: sbook.title, author: sbook.author, coverUrl: sbook.coverUrl, id: existingQuiz?.id })}
                      >
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {sbook.coverUrl ? (
                            <img src={sbook.coverUrl} alt={`Cover of ${sbook.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-4">
                              <span className="text-sm font-medium text-center text-muted-foreground">{sbook.title}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white text-xs font-semibold line-clamp-2 mb-1">{sbook.title}</p>
                            <p className="text-white/70 text-[10px]">{sbook.author}</p>
                          </div>
                          {isDone && (
                            <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1.5">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">{sbook.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-primary font-medium">{existingQuiz ? 'Quiz ready!' : 'Tap for options'}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {/* Show existing site books that match favorite topics — tap for options */}
                  {matchedFavBooks.map((book) => {
                    const result = results.find(r => r.bookId === book.id);
                    const isDone = completedIds.has(book.id);
                    return (
                      <Card
                        key={`match-${book.id}`}
                        className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[180px] ring-1 ring-primary/20"
                        style={{ scrollSnapAlign: 'start' }}
                        onClick={() => handleBookTap(book)}
                      >
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-4">
                              <span className="text-sm font-medium text-center text-muted-foreground">{book.title}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white text-xs font-semibold line-clamp-2 mb-1">{book.title}</p>
                            <p className="text-white/70 text-[10px]">{book.author}</p>
                          </div>
                          {isDone && (
                            <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1.5">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">{book.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary">
                              <Trophy className="w-3 h-3" />{book.pointsValue || 10} pts
                            </span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{book.ageGroup}</span>
                            {result && (
                              <span className="text-[10px] text-muted-foreground ml-auto">{result.score}/{result.total}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Anime & Comics Section */}
            {animeComicBooks.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Anime & Comics</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{animeComicBooks.length} quizzes</span>
                  <span className="text-xs text-primary font-medium">5 points each</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4 ml-7">Fun quizzes from your favorite anime and comic books.</p>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollSnapType: 'x mandatory' }}>
                  {animeComicBooks.map((book) => {
                    const result = results.find(r => r.bookId === book.id);
                    const isDone = completedIds.has(book.id);
                    const passed = result?.passed;
                    const score = result?.score;
                    const total = result?.total;
                    return (
                      <Card
                        key={book.id}
                        className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[180px]"
                        style={{ scrollSnapAlign: 'start' }}
                        onClick={() => navigate(`/quiz/${book.id}`)}
                      >
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary text-white p-4 text-center">
                              <span className="font-bold text-sm">{book.title}</span>
                            </div>
                          )}
                          {isDone && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">✓ Done</div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{book.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary">
                              <Trophy className="w-3 h-3" />{book.pointsValue || 5} pts
                            </span>
                          </div>
                          {result && (
                            <p className="text-xs text-primary font-semibold mt-1">{score}/{total} correct</p>
                          )}
                          <div className="mt-2">
                            <Button size="sm" variant="default" className="h-7 text-xs w-full">
                              <BookOpen className="w-3 h-3 mr-1" />Take Quiz
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Curriculum Section - hidden for eye gaze students */}
            {curriculumBooks.length > 0 && (!showEyeGaze || isSampleStudent) && !user?.isAdmin && (
              <div data-tour="book-quizzes" className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Books in Your School Curriculum</h2>
                  <span className="text-sm text-muted-foreground ml-1">({curriculumBooks.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {curriculumBooks.map((book) => {
                    const result = results.find(r => r.bookId === book.id);
                    const isDone = completedIds.has(book.id);
                    return (
                      <Card
                        key={book.id}
                        className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 ring-2 ring-primary/30"
                        onClick={() => navigate(`/quiz/${book.id}`)}
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
            )}
            {/* Regular book sections - hidden for eye gaze students */}
            {(!showEyeGaze || isSampleStudent || user?.isAdmin) && sortBy === "points" ? (
          pointsOrder.filter(k => pointsGroups[k]).map((pts) => {
            const groupBooks = pointsGroups[pts];
            return (
            <div key={pts} className="mb-10" data-tour={pts === pointsOrder.filter(k => pointsGroups[k])[0] ? "point-books" : undefined}>
              <h2 className="text-lg font-bold mb-4 text-foreground">{pts} Point Books</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {groupBooks.map((book) => {
                  const result = results.find(r => r.bookId === book.id);
                  const isDone = completedIds.has(book.id);
                  return (
                    <Card
                      key={book.id}
                      className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
                      onClick={() => navigate(`/quiz/${book.id}`)}
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
                            {user?.role === 'teacher' || user?.isAdmin ? 'View' : 'Quiz'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
          })
        ) : (showEyeGaze && !isSampleStudent && !user?.isAdmin) ? null : (
          <div className="mb-10">
            {searchQuery.trim() && nonCurriculumBooks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg font-semibold mb-2">No quiz found for "{searchQuery}"</p>
                <p className="text-sm text-muted-foreground mb-6">We couldn't find that book in the library. Create a quiz for it instantly!</p>
                {!(user?.role === 'teacher' || user?.isAdmin) && (
                  <Button
                    onClick={() => { setShowInstant(true); setInstantError(""); setInstantMsg(""); setInstantBook(searchQuery.trim()); }}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Create a Quiz for "{searchQuery.trim()}"
                  </Button>
                )}
              </div>
            ) : (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pagedBooks.map((book) => {
                const result = results.find(r => r.bookId === book.id);
                const isDone = completedIds.has(book.id);
                return (
                  <Card
                    key={book.id}
                    className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
                    onClick={() => navigate(`/quiz/${book.id}`)}
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
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/quiz/${book.id}`);
                          }}
                        >
                          {user?.role === 'teacher' || user?.isAdmin ? 'View' : 'Quiz'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
            </>
            )}
          </div>
        )}
        </>
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

      {/* Quiz Generating Loading Screen */}
      {showGenerating && (
        <QuizGeneratingOverlay
          bookTitle={showEyeGazeInstant ? eyeGazeTopic : showFavOnboarding ? "" : favQuizTopic || iariseQuizTopic || instantBook}
          author={showEyeGazeInstant ? "" : showFavOnboarding ? "" : instantAuthor}
          ready={showEyeGazeInstant ? !!pendingEyeGazeQuizId : pendingIariseBookId ? !!pendingIariseBookId : pendingFavBookId ? !!pendingFavBookId : !!pendingBookId}
          onComplete={showEyeGazeInstant ? handleEyeGazeGeneratingComplete : pendingIariseBookId ? handleIariseQuizComplete : pendingFavBookId ? handleFavQuizComplete : handleGeneratingComplete}
          isEyeGaze={showEyeGazeInstant}
        />
      )}

      {/* Favorites Onboarding Modal */}
      {showFavOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg shadow-xl my-8">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Pick Your Favorites</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Choose 1 to 5 topics you love. We'll create quizzes just for you based on your picks!
              </p>

              {/* Search bar */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search or type a topic..."
                    value={favSearch}
                    onChange={(e) => setFavSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomPick(); } }}
                    className="w-full pl-10 pr-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <Button size="sm" onClick={handleAddCustomPick} disabled={!favSearch.trim() || favPicks.length >= 5}>Add</Button>
              </div>

              {/* Selected picks */}
              {favPicks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {favPicks.map((pick) => (
                    <div key={pick} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
                      {pick}
                      <button onClick={() => handleTogglePick(pick)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested topics */}
              <div className="flex flex-wrap gap-2 mb-4 max-h-48 overflow-y-auto">
                {SUGGESTED_TOPICS.filter(t =>
                  favSearch.trim() ? t.toLowerCase().includes(favSearch.toLowerCase()) : true
                ).map((topic) => {
                  const selected = favPicks.includes(topic);
                  return (
                    <button
                      key={topic}
                      onClick={() => handleTogglePick(topic)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      }`}
                    >
                      {selected ? "✓ " : ""}{topic}
                    </button>
                  );
                })}
              </div>

              {favError && (
                <p className="text-sm text-destructive mb-3">{favError}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{favPicks.length}/5 selected {favPicks.length < 1 && "(pick at least 1)"}</span>
                <div className="flex gap-2">
                  {favOnboarded && (
                    <Button variant="outline" size="sm" onClick={() => setShowFavOnboarding(false)}>Cancel</Button>
                  )}
                  <Button
                    onClick={handleSaveFavorites}
                    disabled={favPicks.length < 1 || favSaving}
                    className="bg-gradient-to-r from-primary to-orange-600 text-white"
                  >
                    {favSaving ? "Saving..." : favOnboarded ? "Update Favorites" : "Save My Picks"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Eye Gaze Create Quiz modal */}
      {showEyeGazeInstant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Create Eye Gaze Quiz</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowEyeGazeInstant(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {eyeGazeError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {eyeGazeError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="eyegaze-topic">Topic *</Label>
                <Input
                  id="eyegaze-topic"
                  value={eyeGazeTopic}
                  onChange={(e) => setEyeGazeTopic(e.target.value)}
                  placeholder="e.g., Animals, Colors, Shapes"
                />
                <p className="text-xs text-muted-foreground">Type any topic and a 10-question eye gaze quiz will be created instantly with visual prompts.</p>
              </div>
              <Button onClick={handleEyeGazeInstant} disabled={!eyeGazeTopic.trim()} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                <Sparkles className="w-4 h-4 mr-1" />
                Create Quiz
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pre-Quiz Disclaimer Modal */}
      {showQuizDisclaimer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Before You Begin</h3>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Educators actively review quiz questions and do not fully rely on AI. AI is a tool — not the end-all-be-all. Our teachers verify quiz content, check for accuracy, and adjust questions as needed.
                </p>
                <p>
                  If you feel a question is unfair or incorrect, you can request a full educator review at any time. A real teacher will review the quiz and your answers, and adjust your score if needed.
                </p>
              </div>
              <Button onClick={handleDisclaimerProceed} className="w-full" size="lg">
                I Understand — Start Quiz
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Book Action Modal — Ask parents / Take quiz */}
      {showBookAction && selectedBookForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-foreground">{selectedBookForAction.title}</h3>
                  <p className="text-sm text-muted-foreground">by {selectedBookForAction.author || "Unknown"}</p>
                </div>
                <button onClick={() => { setShowBookAction(false); setBookActionMsg(""); setBookActionStep("options"); }} className="text-muted-foreground hover:text-foreground">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {selectedBookForAction.coverUrl && (
                <img src={selectedBookForAction.coverUrl} alt={selectedBookForAction.title} className="w-32 h-48 object-cover mx-auto rounded-lg mb-4" />
              )}
              {bookActionMsg ? (
                <div className="space-y-3">
                  <p className="text-sm text-emerald-600 font-medium text-center">{bookActionMsg}</p>
                  <Button onClick={() => { setShowBookAction(false); setBookActionMsg(""); setBookActionStep("options"); }} className="w-full" variant="outline">Close</Button>
                </div>
              ) : bookActionStep === "options" ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-sm text-muted-foreground">Want to read this book? Ask your parents to get it for you first!</p>
                  </div>
                  <Button onClick={handleAskParents} className="w-full">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Ask Parents for This Book
                  </Button>
                  <Button onClick={() => setBookActionStep("confirm-quiz")} className="w-full" variant="outline">
                    <BookOpen className="w-4 h-4 mr-2" />
                    I've Finished Reading — Take Quiz
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 text-center">
                    <BookOpen className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground mb-1">Have you finished reading this book?</p>
                    <p className="text-xs text-muted-foreground">Only take the quiz after you've read the whole book. If you haven't read it yet, ask your parents first!</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setBookActionStep("options")} className="flex-1" variant="outline">
                      Not Yet
                    </Button>
                    <Button onClick={handleGenerateQuizFromBook} className="flex-1">
                      Yes, I've Read It
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* iArise Customize Modal */}
      {showIariseCustomize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg shadow-xl my-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg text-foreground">Customize Your iArise Lessons</h3>
                </div>
                <button onClick={() => setShowIariseCustomize(false)} className="text-muted-foreground hover:text-foreground">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Pick 1 to 5 topics you want to learn about. These are iArise lessons — short reads about hobbies, life skills, and interesting topics.</p>

              {/* Search bar */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Search iArise topics..."
                  value={iariseSearch}
                  onChange={(e) => setIariseSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddIariseCustomPick(); } }}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                />
                <Button size="sm" onClick={handleAddIariseCustomPick} disabled={!iariseSearch.trim() || iarisePicks.length >= 5}>Add</Button>
              </div>

              {/* Selected picks */}
              {iarisePicks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {iarisePicks.map((pick, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-primary text-primary-foreground font-medium">
                      {pick}
                      <button onClick={() => handleToggleIarisePick(pick)} className="hover:text-primary-foreground/70">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {IARISE_TOPICS.filter(t => !iarisePicks.includes(t)).slice(0, 16).map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleToggleIarisePick(topic)}
                      className="px-3 py-1.5 rounded-full text-sm bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              {iariseError && <p className="text-sm text-destructive mb-3">{iariseError}</p>}

              <div className="flex gap-2">
                <Button onClick={handleSaveIarise} disabled={iarisePicks.length < 1 || iariseSaving} className="flex-1">
                  {iariseSaving ? "Saving..." : "Save My iArise Topics"}
                </Button>
                <Button variant="outline" onClick={() => setShowIariseCustomize(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* My Rewards Dialog */}
      <Dialog open={showRewardsPage} onOpenChange={(v) => { setShowRewardsPage(v); if (!v) setClaimMsg(""); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              My Rewards
            </DialogTitle>
          </DialogHeader>
          {studentRewards.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-2xl mb-3">🎁</p>
              <p className="text-muted-foreground">No rewards yet. Complete quizzes and check back!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {claimMsg && (
                <div className={`rounded-lg p-3 text-sm ${claimMsg.includes("sent") || claimMsg.includes("approved") ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
                  {claimMsg}
                </div>
              )}
              {studentRewards.map((reward) => {
                const canClaim = reward.completed && !reward.claimStatus;
                const status = reward.claimStatus;
                return (
                  <div
                    key={reward.id}
                    className={`rounded-xl p-4 border ${status === "approved" ? "bg-green-500/10 border-green-500/30" : status === "requested" ? "bg-blue-500/10 border-blue-500/30" : status === "used" ? "bg-gray-500/10 border-gray-500/30" : reward.completed ? "bg-amber-500/10 border-amber-500/30" : "bg-card border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-foreground">{reward.title}</p>
                        <p className="text-sm text-foreground/80 mt-1">{reward.message}</p>
                      </div>
                      {status === "approved" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white whitespace-nowrap">APPROVED</span>
                      )}
                      {status === "requested" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white whitespace-nowrap">PENDING</span>
                      )}
                      {status === "used" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500 text-white whitespace-nowrap">USED</span>
                      )}
                    </div>
                    {reward.progress && (
                      <p className="text-xs text-primary font-medium mt-2">
                        Progress: {reward.progress} quizzes completed
                        {reward.completed ? " — You earned it!" : ""}
                      </p>
                    )}
                    {reward.expiresAt && (
                      <p className="text-[10px] text-muted-foreground mt-1">Expires: {new Date(reward.expiresAt).toLocaleDateString()}</p>
                    )}
                    {/* Claim button */}
                    {canClaim && (
                      <Button
                        size="sm"
                        className="mt-3 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                        disabled={claimingRewardId === reward.id}
                        onClick={() => handleClaimReward(reward.id)}
                      >
                        <Gift className="w-4 h-4 mr-1" />
                        {claimingRewardId === reward.id ? "Sending..." : "Claim This Reward"}
                      </Button>
                    )}
                    {status === "requested" && (
                      <div className="mt-3 text-center text-xs text-blue-600 dark:text-blue-400 font-medium">
                        Request sent to your admin — waiting for approval.
                      </div>
                    )}
                    {status === "approved" && (
                      <div className="mt-3 text-center text-xs text-green-600 dark:text-green-400 font-medium">
                        Approved! Show this screen to your teacher to use your reward.
                      </div>
                    )}
                    {status === "used" && (
                      <div className="mt-3 text-center text-xs text-gray-500 font-medium">
                        Reward used. Great job!
                      </div>
                    )}
                    {status === "denied" && (
                      <div className="mt-3 text-center text-xs text-red-500 font-medium">
                        Not approved yet — please ask your teacher.
                      </div>
                    )}
                    {!reward.completed && !status && reward.requiredQuizCount > 0 && (
                      <div className="mt-3 text-center text-xs text-muted-foreground">
                        Complete {reward.requiredQuizCount} quiz to unlock this reward.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
