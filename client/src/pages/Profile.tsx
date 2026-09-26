import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Trophy, BookOpen, MessageSquare, Send, ExternalLink, Mail, Award, Lock, User, LayoutGrid, LogOut, Brain, Info } from "lucide-react";
import { CELEBRATION_OPTIONS, CelebrationStyle } from "@/components/Celebration";
import { NotificationBell } from "@/components/NotificationBell";
import { ReportProblemButton } from "@/components/ReportProblemButton";
import { generateCertificate } from "@/lib/certificate";
import { printMyParentInvite } from "@/lib/parentInvites";

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

interface QuizResult {
  bookId: number;
  title: string;
  author: string;
  coverUrl: string | null;
  score: number;
  total: number;
  completedAt: string;
  pointsValue?: number;
  pointsEarned?: number;
  readUrl?: string | null;
  passed?: boolean;
  passingScore?: number;
}

interface Message {
  id: number;
  senderType: string;
  messageText: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Classmate {
  id: number;
  displayName: string;
  totalPoints: number;
  isEyeGazeUser: boolean;
}

// Module-level cache — survives component unmount/remount during navigation
let profileCache: {
  totalPoints: number;
  quizzesTaken: number;
  totalBooks: number;
  quizResults: QuizResult[];
  messages: Message[];
  leaderboard: { id: number; displayName: string; totalPoints: number; quizzesTaken: number }[];
  teacher: { id: number; displayName: string; approved: boolean } | null;
  classmates: Classmate[];
} = {
  totalPoints: 0,
  quizzesTaken: 0,
  totalBooks: 0,
  quizResults: [],
  messages: [],
  leaderboard: [],
  teacher: null,
  classmates: [],
};

// Grade Band Change component for students
function GradeBandChange() {
  const { token } = useAuth();
  const [gradeInfo, setGradeInfo] = useState<{ grade: string; band: string; bookCount: number } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [newGrade, setNewGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    fetch(`${API_BASE}/api/grade-band-info`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setGradeInfo(data); })
      .catch(() => {});
    fetch(`${API_BASE}/api/grade-change-request`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.request) setPendingRequest(data.request); })
      .catch(() => {});
  }, [token]);

  const submitRequest = async () => {
    if (!newGrade) return;
    setSubmitting(true);
    setMsg("");
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/grade-change-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newGrade })
      });
      const data = await res.json();
      if (res.ok) {
        setPendingRequest({ newGrade, newBand: ['K','1','2'].includes(newGrade) ? 'K-2' : ['3','4','5'].includes(newGrade) ? '3-5' : ['6','7','8'].includes(newGrade) ? '6-8' : '9-12', status: 'pending' });
        setNewGrade("");
        setMsg("Grade change request submitted! Your teacher will review it.");
      } else {
        setMsg(data.message || "Failed to submit request");
      }
    } catch (e: any) {
      setMsg("Error submitting request");
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingRequest) {
    const band = ['K','1','2'].includes(pendingRequest.newGrade) ? 'K-2' : ['3','4','5'].includes(pendingRequest.newGrade) ? '3-5' : ['6','7','8'].includes(pendingRequest.newGrade) ? '6-8' : '9-12';
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Current Group:</span>
          <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-bold">{gradeInfo?.band || 'N/A'}</span>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
          <p className="text-sm text-amber-400 font-medium">Pending Request</p>
          <p className="text-xs text-muted-foreground mt-1">
            You requested to switch to Grade {pendingRequest.newGrade} ({band} Band). Waiting for teacher/admin approval.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Current Group:</span>
        <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-bold">{gradeInfo?.band || 'N/A'}</span>
        {gradeInfo && <span className="text-xs text-muted-foreground">({gradeInfo.bookCount} books available)</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Want to switch to a different grade band? Submit a request and your teacher or admin will review it.
        If approved, your library, leaderboard, and profile will update to reflect your new group.
      </p>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Select your new grade band:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { band: "K-2", grades: ["K", "1", "2"], label: "Early Readers", color: "bg-green-500/20" },
            { band: "3-5", grades: ["3", "4", "5"], label: "Elementary", color: "bg-blue-500/20" },
            { band: "6-8", grades: ["6", "7", "8"], label: "Middle School", color: "bg-purple-500/20" },
            { band: "9-12", grades: ["9", "10", "11", "12"], label: "High School", color: "bg-orange-500/20" },
          ].map((band) => (
            <div key={band.band} className={`rounded-lg ${band.color} border border-border p-2 space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{band.band} Band</span>
                <span className="text-xs text-muted-foreground">{band.label}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {band.grades.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setNewGrade(g)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      newGrade === g ? "bg-primary text-primary-foreground" : "bg-muted/50 text-white hover:bg-muted"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={submitRequest}
          disabled={!newGrade || submitting}
          className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Request Change"}
        </button>
      </div>
      {msg && <p className="text-xs text-green-400">{msg}</p>}
    </div>
  );
}

export default function Profile() {
  const { user, token, logout } = useAuth();
  const [, navigate] = useLocation();
  const [totalPoints, setTotalPoints] = useState(profileCache.totalPoints);
  const [quizzesTaken, setQuizzesTaken] = useState(profileCache.quizzesTaken);
  const [totalBooks, setTotalBooks] = useState(profileCache.totalBooks);
  const [quizResults, setQuizResults] = useState<QuizResult[]>(profileCache.quizResults);
  const [messages, setMessages] = useState<Message[]>(profileCache.messages);
  const [loading, setLoading] = useState(profileCache.quizResults.length === 0);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ id: number; displayName: string; totalPoints: number; quizzesTaken: number }[]>(profileCache.leaderboard);
  const [teacher, setTeacher] = useState<{ id: number; displayName: string; approved: boolean } | null>(profileCache.teacher);
  const [classmates, setClassmates] = useState<Classmate[]>(profileCache.classmates);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [nameNew, setNameNew] = useState(user?.displayName || "");
  const [nameMsg, setNameMsg] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [eyeGazeEnabled, setEyeGazeEnabled] = useState(user?.is_eye_gaze_user || false);
  const [eyeGazeRankInfo, setEyeGazeRankInfo] = useState<{ band: string; overallRank: number | null; eyeGazeRank: number | null; totalInBand: number; totalEyeGazeInBand: number } | null>(null);
  const [showEyeGazeRank, setShowEyeGazeRank] = useState(false);
  const [eyeGazeLoading, setEyeGazeLoading] = useState(false);
  const [celebrationStyle, setCelebrationStyle] = useState<CelebrationStyle>("confetti");
  const [badges, setBadges] = useState<Array<{ id: string; name: string; emoji: string; description: string; unlocked: boolean }>>([]);
  const [badgeCounts, setBadgeCounts] = useState({ unlocked: 0, total: 0 });
  const [activeTab, setActiveTab] = useState<"profile" | "leaderboard">("profile");
  const [lbPeriod, setLbPeriod] = useState<"all-time" | "monthly">("all-time");
  const [lbMonth, setLbMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchData = useCallback(async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) {
      setLoading(false);
      return;
    }
    try {
      const lbUrl = lbPeriod === "monthly"
        ? `${API_BASE}/api/leaderboard?month=${lbMonth}`
        : `${API_BASE}/api/leaderboard`;
      // Use Promise.race with timeout to prevent infinite loading
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000));
      const [profileRes, msgRes, lbRes, classmatesRes] = await Promise.race([
        Promise.all([
          fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${authToken}` } }),
          fetch(`${API_BASE}/api/messages`, { headers: { Authorization: `Bearer ${authToken}` } }),
          fetch(lbUrl, { headers: { Authorization: `Bearer ${authToken}` } }),
          fetch(`${API_BASE}/api/student/classmates`, { headers: { Authorization: `Bearer ${authToken}` } }),
        ]),
        timeout
      ]);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const tp = profileData?.totalPoints || 0;
        const qt = profileData?.quizzesTaken || 0;
        const tb = profileData?.totalBooks || 0;
        const qr = profileData.quizResults || [];
        const ti = profileData.teacher || null;
        setTotalPoints(tp);
        setQuizzesTaken(qt);
        setTotalBooks(tb);
        setQuizResults(qr);
        setTeacher(ti);
        profileCache.totalPoints = tp;
        profileCache.quizzesTaken = qt;
        profileCache.totalBooks = tb;
        profileCache.quizResults = qr;
        profileCache.teacher = ti;
      }
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const msgArr = Array.isArray(msgData) ? msgData : [];
        setMessages(msgArr);
        profileCache.messages = msgArr;
        // Mark unread messages as read
        msgArr.forEach((m: Message) => {
          if (!m.isRead) {
            fetch(`${API_BASE}/api/messages/${m.id}/read`, {
              method: "POST",
              headers: { Authorization: `Bearer ${authToken}` },
            }).catch(() => {});
          }
        });
      }
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        const lbArr = Array.isArray(lbData) ? lbData : [];
        setLeaderboard(lbArr);
        profileCache.leaderboard = lbArr;
      }
      if (classmatesRes.ok) {
        const cmData = await classmatesRes.json();
        const cmArr = Array.isArray(cmData) ? cmData : [];
        setClassmates(cmArr);
        profileCache.classmates = cmArr;
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }, [token, lbPeriod, lbMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const isStudentAccount = !!user && !user.isAdmin && user.role !== "teacher" && user.role !== "parent" && user.role !== "admin";
    if (!isStudentAccount) return;
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    const loadBadges = () => {
      fetch(`${API_BASE}/api/engagement/badges`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          setBadges(Array.isArray(data.badges) ? data.badges : []);
          setBadgeCounts({ unlocked: data.unlockedCount || 0, total: data.totalCount || 0 });
        })
        .catch(() => {});
    };
    loadBadges();
    window.addEventListener("arise-points-updated", loadBadges);
    return () => window.removeEventListener("arise-points-updated", loadBadges);
  }, [user?.id, user?.role, token]);

  // Fetch eye gaze band rank for eye gaze students
  const fetchEyeGazeRank = async () => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze-band-rank`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        setEyeGazeRankInfo(data);
      }
    } catch {}
  };

  useEffect(() => {
    if (user?.is_eye_gaze_user) {
      fetchEyeGazeRank();
    }
  }, [user?.is_eye_gaze_user]);

  // Load celebration style preference
  useEffect(() => {
    if (!eyeGazeEnabled) return;
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    fetch(`${API_BASE}/api/eye-gaze/celebration-style`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.style) setCelebrationStyle(d.style); })
      .catch(() => {});
  }, [eyeGazeEnabled]);

  // Retry profile fetch after a delay if quizResults are still empty
  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;
    if (quizResults.length > 0) return;
    const retryTimer = setTimeout(() => {
      const tk = token || getTokenFromCookie();
      if (!tk) return;
      fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${tk}` } })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            const tp = data?.totalPoints || 0;
            const qt = data?.quizzesTaken || 0;
            const qr = data?.quizResults || [];
            setTotalPoints(tp);
            setQuizzesTaken(qt);
            setQuizResults(qr);
            profileCache.totalPoints = tp;
            profileCache.quizzesTaken = qt;
            profileCache.quizResults = qr;
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(retryTimer);
  }, [token, quizResults.length]);

  // Clear caches on global logout event
  useEffect(() => {
    const clearCaches = () => {
      profileCache.messages = [];
      profileCache.leaderboard = [];
      profileCache.totalPoints = 0;
      profileCache.quizzesTaken = 0;
      profileCache.quizResults = [];
      profileCache.teacher = null;
      profileCache.classmates = [];
      setMessages([]);
      setLeaderboard([]);
      setTotalPoints(0);
      setQuizzesTaken(0);
      setQuizResults([]);
      setTeacher(null);
      setClassmates([]);
    };
    window.addEventListener("arise-logout", clearCaches);
    return () => window.removeEventListener("arise-logout", clearCaches);
  }, []);

  // Refetch leaderboard when period/month changes
  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (activeTab === "leaderboard" && authToken) {
      const lbUrl = lbPeriod === "monthly"
        ? `${API_BASE}/api/leaderboard?month=${lbMonth}`
        : `${API_BASE}/api/leaderboard`;
      fetch(lbUrl, { headers: { Authorization: `Bearer ${authToken}` } })
        .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); })
        .then(data => { if (Array.isArray(data)) setLeaderboard(data); })
        .catch(() => {
          // Retry once after 1.5s if the first attempt failed (token race condition)
          setTimeout(() => {
            const retryToken = token || getTokenFromCookie();
            if (!retryToken) return;
            fetch(lbUrl, { headers: { Authorization: `Bearer ${retryToken}` } })
              .then(res => { if (!res.ok) return; return res.json(); })
              .then(data => { if (Array.isArray(data)) setLeaderboard(data); })
              .catch(() => {});
          }, 1500);
        });
    }
  }, [lbPeriod, lbMonth, activeTab, token]);

  const monthLabelsArr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const recentMonths = useMemo(() => {
    const d = new Date();
    const months: { ym: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      months.push({ ym, label: `${monthLabelsArr[dt.getMonth()]} ${dt.getFullYear()}` });
    }
    return months;
  }, []);

  const handleSendMessage = async () => {
    const authToken = token || getTokenFromCookie();
    if (!messageText.trim() || !authToken) return;
    setSendingMessage(true);
    try {
      await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messageText }),
      });
      setMessageText("");
      fetchData();
      setNotifRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg("");
    setPwError("");
    if (pwNew.length < 4) {
      setPwError("New password must be at least 4 characters.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    if (!token) return;
    setPwLoading(true);
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPwMsg("Password changed successfully");
        setPwCurrent("");
        setPwNew("");
        setPwConfirm("");
        setTimeout(() => setPwMsg(""), 3000);
      } else {
        setPwError(data.message || "Failed to change password.");
      }
    } catch (err) {
      setPwError("Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangeName = async () => {
    setNameMsg("");
    setNameError("");
    if (nameNew.trim().length < 2) {
      setNameError("Display name must be at least 2 characters.");
      return;
    }
    if (!token) return;
    setNameLoading(true);
    try {
      const authToken = token || getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/change-name`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameNew.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNameMsg("Name updated successfully");
        setTimeout(() => setNameMsg(""), 3000);
      } else {
        setNameError(data.message || "Failed to update name.");
      }
    } catch (err) {
      setNameError("Failed to update name.");
    } finally {
      setNameLoading(false);
    }
  };

  const [eyeGazeRequestPending, setEyeGazeRequestPending] = useState(false);

  const handleToggleEyeGaze = async () => {
    const newVal = !eyeGazeEnabled;
    setEyeGazeLoading(true);
    try {
      const authToken = token || getTokenFromCookie();
      // Create a request for teacher/admin approval instead of directly toggling
      const res = await fetch(`${API_BASE}/api/eye-gaze-toggle-request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestedStatus: newVal }),
      });
      if (res.ok) {
        setEyeGazeRequestPending(true);
        setEyeGazeEnabled(!newVal); // revert UI, the change happens when approved
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to submit request');
      }
    } catch (err) {
      alert('Error submitting eye gaze change request');
    } finally {
      setEyeGazeLoading(false);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    // Clear module-level caches
    profileCache.messages = [];
    profileCache.leaderboard = [];
    profileCache.totalPoints = 0;
    profileCache.quizzesTaken = 0;
    profileCache.totalBooks = 0;
    profileCache.teacher = null;
    profileCache.classmates = [];
    logout();
    navigate("/");
  };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 flex items-center gap-1 sm:gap-3 h-16">
          <Button variant="ghost" size="sm" onClick={() => navigate("/progress")}>
            <Brain className="w-4 h-4" />
            <span className="hidden md:inline">Progress</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </Button>
          <div className="flex-1 flex items-center gap-1">
            <span className="px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Account</span>
            </span>
            {user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent' && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/leaderboard")}>
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">My Progress</span>
              </Button>
            )}
          </div>
          <NotificationBell refreshKey={notifRefreshKey} />
          <div className="hidden sm:flex"><ReportProblemButton variant="ghost" size="sm" /></div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <span className="hidden sm:inline">Logout</span>
            <LogOut className="w-4 h-4 sm:hidden" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <>
        {user?.role === 'student' && (
          <Card className="shadow-md border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Parent Sign-Up Letter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Print or show this letter to your parent or caregiver. It contains your private code so they can create a parent account connected to you.
              </p>
              <Button className="w-full sm:w-auto" onClick={() => printMyParentInvite().catch(e => window.alert(e.message))}>
                Print / View My Parent Code
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalPoints}</div>
                <div className="text-xs text-muted-foreground">Total Points</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">{quizzesTaken}</div>
                <div className="text-xs text-muted-foreground">Quizzes Taken</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalBooks - quizzesTaken}</div>
                <div className="text-xs text-muted-foreground">Books Left</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Teacher */}
        {teacher && (
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <User className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">My Teacher</div>
                <div className="font-bold text-lg">{teacher.displayName}</div>
                <div className={`text-xs font-medium mt-0.5 ${teacher.approved ? "text-green-400" : "text-yellow-400"}`}>
                  {teacher.approved ? "Approved - in class" : "Pending approval"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Classmates */}
        {teacher && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5" />
                Classmates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {classmates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No classmates yet.</p>
              ) : (
                <div className="space-y-2">
                  {classmates.map((cm) => (
                    <div
                      key={cm.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        cm.id === user?.id ? "bg-primary/10 border border-primary/30" : "bg-muted/30"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {cm.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{cm.displayName}</p>
                        {cm.isEyeGazeUser && (
                          <span className="text-[10px] text-purple-400 font-medium">Eye Gazer</span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-sm text-primary">{cm.totalPoints}</div>
                        <div className="text-xs text-muted-foreground">pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Conversation with teacher */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Conversation with Teacher
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Send one below!</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === "teacher" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl ${
                        msg.senderType === "teacher"
                          ? "bg-muted/50 border border-border rounded-tl-sm"
                          : "bg-primary text-white rounded-tr-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${
                          msg.senderType === "teacher" ? "text-muted-foreground" : "text-white/80"
                        }`}>
                          {msg.senderType === "teacher" ? "Teacher" : "You"}
                        </span>
                        <span className={`text-xs ${
                          msg.senderType === "teacher" ? "text-muted-foreground" : "text-white/60"
                        }`}>
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={`text-sm ${
                        msg.senderType === "teacher" ? "text-white" : "text-white"
                      }`}>{msg.messageText}</p>
                      {msg.linkUrl && (
                        <a
                          href={msg.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 mt-2 text-xs hover:underline ${
                            msg.senderType === "teacher" ? "text-primary" : "text-white/80"
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open link
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Send message to teacher */}
            <div className="pt-3 border-t border-border">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Send a message to your teacher..."
                className="mb-2"
                rows={2}
                data-testid="input-message"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sendingMessage}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4 mr-1" />
                Send
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quiz history */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Quiz History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quizResults.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  You haven't taken any quizzes yet. Visit the library to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {quizResults.map((r) => {
                  const passed = r.passed ?? (r.score >= Math.ceil((r.total || 10) * 0.7));
                  return (
                  <div
                    key={r.bookId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/library")}
                  >
                    <div className="w-10 h-14 flex-shrink-0">
                      {r.coverUrl ? (
                        <img src={r.coverUrl} alt={r.title} className="w-full h-full object-cover rounded" />
                      ) : (
                        <div className="w-full h-full rounded bg-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.author}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm">{r.score}/{r.total}</div>
                      <div className="text-xs text-primary font-semibold">
                        {(r.pointsEarned ?? 0) || 0} pts
                        {r.pointsValue && (
                          <span className="text-muted-foreground font-normal"> out of {r.pointsValue}</span>
                        )}
                      </div>
                      {passed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateCertificate(
                              user?.displayName || "Student",
                              r.title,
                              r.pointsEarned ?? 0,
                              new Date(r.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                            );
                          }}
                          className="text-xs text-primary hover:underline mt-1 flex items-center gap-0.5"
                        >
                          <Award className="w-3 h-3" />
                          Certificate
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change name */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Change Name
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {nameMsg && (
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/20 text-sm text-green-400">
                {nameMsg}
              </div>
            )}
            {nameError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {nameError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name-new">New Display Name</Label>
              <Input
                id="name-new"
                type="text"
                value={nameNew}
                onChange={(e) => setNameNew(e.target.value)}
                placeholder="Your new display name"
              />
            </div>
            <Button
              onClick={handleChangeName}
              disabled={nameLoading || !nameNew.trim()}
              data-testid="button-change-name"
            >
              <User className="w-4 h-4 mr-1" />
              {nameLoading ? "Updating..." : "Update Name"}
            </Button>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pwMsg && (
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/20 text-sm text-green-400">
                {pwMsg}
              </div>
            )}
            {pwError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {pwError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pw-current">Current Password</Label>
              <Input
                id="pw-current"
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                placeholder="Your current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-new">New Password</Label>
              <Input
                id="pw-new"
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                placeholder="At least 4 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Confirm New Password</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
              data-testid="button-change-password"
            >
              <Lock className="w-4 h-4 mr-1" />
              {pwLoading ? "Changing..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>

        {/* Eye Gaze Settings */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Eye Gazer &amp; Non-Verbal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Eye Gazer &amp; Non-Verbal Testing</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {eyeGazeEnabled
                    ? "Accessible quizzes with large buttons and visual choices are shown in your Library."
                    : "Enable to see accessible quizzes with large buttons and visual choices in your Library."
                  }
                </p>
                {eyeGazeRequestPending && (
                  <p className="text-xs text-amber-500 mt-1 font-medium">⏳ Change request submitted - awaiting teacher/admin approval</p>
                )}
              </div>
              <button
                onClick={handleToggleEyeGaze}
                disabled={eyeGazeLoading || eyeGazeRequestPending}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  eyeGazeEnabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  eyeGazeEnabled ? "translate-x-7" : "translate-x-1"
                }`} />
              </button>
            </div>

            {/* Celebration Style Picker */}
            {eyeGazeEnabled && (
              <div className="mt-4 pt-4 border-t border-muted">
                <p className="text-sm font-medium mb-1">Celebration Animation</p>
                <p className="text-xs text-muted-foreground mb-3">Pick what happens when your student answers correctly</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CELEBRATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setCelebrationStyle(opt.value as CelebrationStyle);
                        const token = authToken || getTokenFromCookie();
                        const headers: Record<string, string> = { "Content-Type": "application/json" };
                        if (token) headers["Authorization"] = `Bearer ${token}`;
                        fetch(`${API_BASE}/api/eye-gaze/celebration-style`, {
                          method: "POST",
                          headers,
                          body: JSON.stringify({ style: opt.value }),
                        }).catch(() => {});
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        celebrationStyle === opt.value
                          ? "bg-primary text-primary-foreground border-2 border-primary"
                          : "bg-muted text-muted-foreground border-2 border-transparent hover:bg-muted/80"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade Band Change Request - Students only */}
        {user?.role === 'student' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.836 5.253 9.5 4.5 8 4.5c-1.5 0-2.836.753-4 1.753v13c1.164-.991 2.5-1.753 4-1.753 1.5 0 2.836.753 4 1.753 1.164-.991 2.5-1.753 4-1.753 1.5 0 2.836.753 4 1.753v-13c-1.164-.991-2.5-1.753-4-1.753-1.5 0-2.836.753-4 1.753z" />
              </svg>
              Grade Band &amp; Group
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GradeBandChange />
          </CardContent>
        </Card>
        )}
        </>

      </main>
    </div>
  );
}
