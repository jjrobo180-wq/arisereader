import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, Trophy, Target, TrendingUp, ChevronRight, Clock, Award, BarChart3, ArrowRight, RotateCcw, CheckCircle2, Timer, Send, AlertCircle, Lock, Zap } from "lucide-react";

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

import { API_BASE } from "@/lib/queryClient";
const ASSESSMENT_TIME_LIMIT = 10 * 60;

type Phase = "intro" | "iready" | "loading" | "reading" | "questions" | "results";

interface Question {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  skill_type: string;
  question_order: number;
  passage_id?: number;
}

interface Passage {
  id: number;
  title: string;
  body: string;
  grade_level: number;
  genre: string;
  word_count: number;
}

interface Profile {
  current_level: number;
  independent_level: number;
  instructional_level: number;
  vocab_score_avg: number;
  comprehension_score_avg: number;
  inference_score_avg: number;
  retention_score_avg: number;
  last_assessed_at: string;
  next_target_level: number;
  total_assessments: number;
  iready_scale_score?: number;
  assessment_method?: string;
}

interface Book {
  id: number;
  title: string;
  author: string;
  coverUrl: string;
  pointsValue: number;
  readUrl?: string;
}

const SKILL_LABELS: Record<string, string> = {
  comprehension: "Comprehension",
  vocabulary: "Vocabulary",
  inference: "Inference",
  retention: "Retention",
};

const SKILL_ICONS: Record<string, any> = {
  comprehension: BookOpen,
  vocabulary: Brain,
  inference: Target,
  retention: TrendingUp,
};

const SKILL_COLORS: Record<string, string> = {
  comprehension: "text-blue-400",
  vocabulary: "text-purple-400",
  inference: "text-green-400",
  retention: "text-orange-400",
};

const SKILL_BAR_COLORS: Record<string, string> = {
  comprehension: "bg-blue-500",
  vocabulary: "bg-purple-500",
  inference: "bg-green-500",
  retention: "bg-orange-500",
};

function getLevelLabel(level: number): string {
  const labels: Record<number, string> = { 2: "Grade 2", 3: "Grade 3", 4: "Grade 4", 5: "Grade 5", 6: "Grade 6", 7: "Grade 7", 8: "Grade 8+" };
  return labels[level] || `Grade ${level}`;
}

function getEstimatedLabel(grade: string): string {
  const labels: Record<string, string> = {
    independent: "Independent Level",
    instructional: "Instructional Level",
    needs_support: "Needs Support",
    frustration: "Below Grade Level",
  };
  return labels[grade] || grade;
}

function getEstimatedColor(grade: string): string {
  const colors: Record<string, string> = {
    independent: "text-green-400",
    instructional: "text-blue-400",
    needs_support: "text-yellow-400",
    frustration: "text-red-400",
  };
  return colors[grade] || "text-muted-foreground";
}

function getEstimatedBg(grade: string): string {
  const colors: Record<string, string> = {
    independent: "bg-green-500/10 border-green-500/30",
    instructional: "bg-blue-500/10 border-blue-500/30",
    needs_support: "bg-yellow-500/10 border-yellow-500/30",
    frustration: "bg-red-500/10 border-red-500/30",
  };
  return colors[grade] || "";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ReadingAssessment() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("intro");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<any>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<number, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(ASSESSMENT_TIME_LIMIT);
  const [timeUsed, setTimeUsed] = useState(0);
  const [showIReadyForm, setShowIReadyForm] = useState(false);
  const [ireadyScore, setIreadyScore] = useState("");
  const [ireadyMsg, setIreadyMsg] = useState("");
  const [ireadyLocked, setIreadyLocked] = useState(false);
  const [retakeStatus, setRetakeStatus] = useState<any>(null);
  const [showRetakeForm, setShowRetakeForm] = useState(false);
  const [retakeReason, setRetakeReason] = useState("");
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [eyeGazeProfile, setEyeGazeProfile] = useState<any>(null);
  const [eyeGazeHistory, setEyeGazeHistory] = useState<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authToken = getTokenFromCookie();

  const fetchProfile = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/reading-profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        if (data.iready_scale_score) setIreadyLocked(true);
      }
    } catch {}
  }, [authToken]);

  const fetchHistory = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/reading-profile/history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, [authToken]);

  const fetchRecommendations = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/reading-profile/recommendations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch {}
  }, [authToken]);

  const fetchRetakeStatus = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/reading-assessment/retake-status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRetakeStatus(data);
      }
    } catch {}
  }, [authToken]);

  useEffect(() => {
    fetchProfile();
    fetchHistory();
    fetchRecommendations();
    fetchRetakeStatus();
    // Fetch eye gaze profile for eye gaze users
    if (user?.is_eye_gaze_user) {
      fetch(`${API_BASE}/api/eye-gaze/profile`, { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setEyeGazeProfile(data);
            setEyeGazeHistory(Array.isArray(data.history) ? data.history : []);
          }
        })
        .catch(() => {});
    }
  }, [fetchProfile, fetchHistory, fetchRecommendations, fetchRetakeStatus, user?.is_eye_gaze_user]);

  // Timer — runs during reading and questions phases
  useEffect(() => {
    if (phase === "reading" || phase === "questions") {
      timerRef.current = setInterval(() => {
        setTimeUsed((prev) => {
          const next = prev + 1;
          const remaining = ASSESSMENT_TIME_LIMIT - next;
          setTimeLeft(remaining);
          if (remaining <= 0) {
            clearInterval(timerRef.current!);
            handleSubmit(true);
          }
          return next;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [phase]);

  // Check URL for iready param (from popup)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    if (params.get("iready") === "1") {
      setShowIReadyForm(true);
    }
  }, []);

  const startAssessment = async () => {
    setShowStartConfirm(false);
    if (!authToken) return;
    setLoading(true);
    setError("");
    setPhase("loading");
    try {
      const res = await fetch(`${API_BASE}/api/reading-assessment/start-comprehensive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentAttempt(data.attempt);
        setPassages(data.passages || []);
        setQuestions(data.questions || []);
        setAnswersByQuestionId({});
        setTimeLeft(ASSESSMENT_TIME_LIMIT);
        setTimeUsed(0);
        setCurrentRound(0);
        setPhase("reading");
      } else {
        const errData = await res.json();
        setError(errData.message || "Failed to start assessment");
        setPhase("intro");
      }
    } catch {
      setError("Failed to start assessment");
      setPhase("intro");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (auto = false) => {
    if (!authToken || !currentAttempt) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/reading-assessment/${currentAttempt.id}/submit-comprehensive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answersByQuestionId, timeUsedSeconds: timeUsed }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setPhase("results");
        fetchProfile();
        fetchRecommendations();
        fetchHistory();
        fetchRetakeStatus();
      } else {
        setError("Failed to submit assessment");
      }
    } catch {
      setError("Failed to submit assessment");
    } finally {
      setLoading(false);
    }
  };

  const handleIReadyOptIn = async () => {
    if (!authToken || !ireadyScore) return;
    setLoading(true);
    setError("");
    setIreadyMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/reading-assessment/iready-optin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scaleScore: parseInt(ireadyScore) }),
      });
      if (res.ok) {
        const data = await res.json();
        setIreadyMsg(`Score saved! You've been placed at ${getLevelLabel(data.gradeLevel)}.`);
        setIreadyLocked(true);
        fetchProfile();
        fetchRecommendations();
        fetchHistory();
      } else if (res.status === 409) {
        setIreadyLocked(true);
        setIreadyMsg("Your i-Ready score is already saved. Ask your teacher to change it.");
      } else {
        const errData = await res.json();
        setError(errData.message || "Failed to save i-Ready score");
      }
    } catch {
      setError("Failed to save i-Ready score");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRetake = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reading-assessment/request-retake`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: retakeReason || "Student requested retake" }),
      });
      if (res.ok) {
        setIreadyMsg("Retake request sent to your teacher.");
        setShowRetakeForm(false);
        setRetakeReason("");
        fetchRetakeStatus();
      }
    } catch {
      setError("Failed to request retake");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: number, letter: string) => {
    setAnswersByQuestionId((prev) => ({ ...prev, [questionId]: letter }));
  };

  // Get questions for the current passage
  const currentPassage = passages[currentRound];
  const currentQuestions = currentPassage
    ? questions.filter((q) => q.passage_id === currentPassage.id)
    : [];
  const currentAnsweredCount = currentQuestions.filter((q) => answersByQuestionId[q.id]).length;
  const totalAnswered = Object.keys(answersByQuestionId).length;
  const isLastRound = currentRound >= passages.length - 1;

  // ─── LOADING PHASE (fetching assessment data) ────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading your assessment...</p>
        </div>
      </div>
    );
  }

  // ─── INTRO PHASE ─────────────────────────────────────────────────────
  if (phase === "intro") {
    const hasProfile = profile && profile.last_assessed_at;
    const canRetake = retakeStatus?.canRetake;

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => navigate(user?.isAdmin ? "/admin" : "/library")} className="text-muted-foreground hover:text-foreground text-sm">
                ← Back
              </button>
              <span className="text-muted-foreground">|</span>
              <span className="font-bold text-base sm:text-lg tracking-wide whitespace-nowrap">A.R.I.S.E<span className="text-primary"> Reader</span></span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Progress Monitor</h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
              Take a reading assessment to find your level. Read a passage, answer questions, then move to the next passage. Passages disappear during questions. A 10-minute timer tests your reading speed and comprehension.
            </p>
          </div>

          {/* Eye Gaze Profile Summary */}
          {user?.is_eye_gaze_user && eyeGazeProfile && (
            <div className="mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary">Level {eyeGazeProfile.current_level || 1}</div>
                  <div className="text-xs text-muted-foreground mt-1">Current Level</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{eyeGazeProfile.total_completed || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Quizzes Completed</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{eyeGazeProfile.total_completed > 0 ? Math.round((eyeGazeProfile.total_score || 0) / (eyeGazeProfile.total_completed || 1)) : 0}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Average Score</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{eyeGazeProfile.current_level < 5 ? `Level ${eyeGazeProfile.current_level + 1}` : "Max"}</div>
                  <div className="text-xs text-muted-foreground mt-1">Next Target</div>
                </div>
              </div>
              {/* Skill breakdown */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-bold text-sm mb-3">Skill Breakdown</h3>
                <div className="space-y-3">
                  {[
                    { label: "Identification", val: eyeGazeProfile.skill_identification || 0 },
                    { label: "Matching", val: eyeGazeProfile.skill_matching || 0 },
                    { label: "Comprehension", val: eyeGazeProfile.skill_comprehension || 0 },
                  ].map((skill) => (
                    <div key={skill.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{skill.label}</span>
                        <span className="font-semibold">{skill.val}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${skill.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Eye Gaze Quiz History */}
              {eyeGazeHistory.length > 0 && (
                <div className="mt-4 bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Eye Gazer &amp; Non-Verbal Quiz History
                  </h3>
                  <div className="space-y-2">
                    {eyeGazeHistory.slice(0, 5).map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                        <div>
                          <span className="font-medium">{h.eye_gaze_quizzes?.title || "Quiz"}</span>
                          <span className="text-muted-foreground ml-2">Level {h.eye_gaze_quizzes?.level || 1}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-primary">{h.score}/{h.total}</span>
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({Math.round((h.score / h.total) * 100)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Profile Summary */}
          {hasProfile ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-xl font-bold">{getLevelLabel(profile!.current_level)}</div>
                  <div className="text-xs text-muted-foreground">Current Level</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <Target className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-xl font-bold">{getLevelLabel(profile!.next_target_level)}</div>
                  <div className="text-xs text-muted-foreground">Next Target</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-xl font-bold">{profile!.total_assessments || 0}</div>
                  <div className="text-xs text-muted-foreground">Assessments Taken</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-xl font-bold">{getLevelLabel(profile!.independent_level)}</div>
                  <div className="text-xs text-muted-foreground">Independent Level</div>
                </div>
              </div>

              {/* Skill Breakdown */}
              <div className="bg-card border border-border rounded-xl p-5 mb-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Skill Breakdown</h3>
                <div className="space-y-3">
                  {(["comprehension", "vocabulary", "inference", "retention"] as const).map((skill) => {
                    const Icon = SKILL_ICONS[skill];
                    const profileKey = skill === "vocabulary" ? "vocab_score_avg" : `${skill}_score_avg`;
                    const score = (profile as any)[profileKey] as number;
                    return (
                      <div key={skill}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Icon className={`w-4 h-4 ${SKILL_COLORS[skill]}`} />
                            <span>{SKILL_LABELS[skill]}</span>
                          </div>
                          <span className="text-sm font-semibold">{score || 0}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${SKILL_BAR_COLORS[skill]} rounded-full transition-all duration-500`} style={{ width: `${score || 0}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Assessment History */}
              {history.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 mb-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Assessment History</h3>
                  <div className="space-y-2">
                    {history.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{h.reading_passages?.title || "Assessment"}</div>
                          <div className="text-xs text-muted-foreground">
                            {h.reading_passages?.grade_level ? `Grade ${h.reading_passages.grade_level}` : "Comprehensive"} {h.time_used_seconds ? `• ${Math.floor(h.time_used_seconds / 60)}m ${h.time_used_seconds % 60}s` : ""}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-sm font-semibold">{h.score}/{h.total}</div>
                          <div className="text-xs text-muted-foreground">{Math.round((h.score / Math.max(h.total, 1)) * 100)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {recommendations && (recommendations.startHere?.length > 0 || recommendations.stretch?.length > 0) && (
                <div className="bg-card border border-border rounded-xl p-5 mb-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Recommended Books for Your Level</h3>
                  {recommendations.startHere?.length > 0 && (
                    <>
                      <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Target className="w-4 h-4" /> Start Here — {getLevelLabel(recommendations.currentLevel)}</div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                        {(recommendations.startHere || []).slice(0, 6).map((book: any) => (
                          <div key={book.id} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate(`/book/${book.id}`)}>
                            <img src={book.coverUrl} alt={book.title} className="w-full aspect-[2/3] object-cover rounded-lg mb-1 bg-muted" />
                            <div className="text-xs font-medium truncate">{book.title}</div>
                            <div className="text-[10px] text-primary font-semibold mt-1">{book.pointsValue} pts</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {recommendations.stretch?.length > 0 && (
                    <>
                      <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Stretch Goal — Challenge Yourself</div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {(recommendations.stretch || []).slice(0, 4).map((book: any) => (
                          <div key={book.id} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate(`/book/${book.id}`)}>
                            <img src={book.coverUrl} alt={book.title} className="w-full aspect-[2/3] object-cover rounded-lg mb-1 bg-muted" />
                            <div className="text-xs font-medium truncate">{book.title}</div>
                            <div className="text-[10px] text-primary font-semibold mt-1">{book.pointsValue} pts</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-6 mb-6 text-center">
              <BookOpen className="w-8 h-8 text-primary mx-auto mb-2" />
              <h3 className="font-semibold mb-1">Welcome to Progress Monitor</h3>
              <p className="text-sm text-muted-foreground">Take a reading assessment to discover your reading level and get personalized book recommendations.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="text-center space-y-3">
            {showIReadyForm ? (
              <div className="max-w-md mx-auto p-4 rounded-lg border border-border bg-card">
                {ireadyLocked ? (
                  <>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><Lock className="w-4 h-4 text-primary" /> i-Ready Score Locked</h4>
                    <p className="text-sm text-muted-foreground mb-3">Your i-Ready score is <span className="font-semibold text-primary">{profile?.iready_scale_score}</span> ({getLevelLabel(profile?.current_level || 1)}). Ask your teacher to change it.</p>
                  </>
                ) : (
                  <>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><Brain className="w-4 h-4 text-primary" /> Enter i-Ready Reading Score</h4>
                    <p className="text-xs text-muted-foreground mb-3">Enter your i-Ready reading diagnostic scale score (100-800). We'll map it to a grade level using Colorado middle school ranges. This can only be done once — only your teacher can change it later.</p>
                    <input
                      type="number"
                      min="100"
                      max="800"
                      placeholder="e.g. 542"
                      value={ireadyScore}
                      onChange={(e) => setIreadyScore(e.target.value)}
                      className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm mb-2"
                    />
                    {ireadyMsg && <p className="text-xs text-green-400 mb-2">{ireadyMsg}</p>}
                    {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleIReadyOptIn} disabled={!ireadyScore || loading} className="flex-1">
                        <Brain className="w-3 h-3 mr-1" /> Save Score
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowIReadyForm(false); setIreadyScore(""); setIreadyMsg(""); setError(""); }} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : showRetakeForm ? (
              <div className="max-w-md mx-auto p-4 rounded-lg border border-border bg-card">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><RotateCcw className="w-4 h-4 text-primary" /> Request Assessment Retake</h4>
                <textarea
                  placeholder="Why do you want a retake? (optional)"
                  value={retakeReason}
                  onChange={(e) => setRetakeReason(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-2 min-h-[60px]"
                />
                {ireadyMsg && <p className="text-xs text-green-400 mb-2">{ireadyMsg}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleRequestRetake} disabled={loading} className="flex-1">
                    <Send className="w-3 h-3 mr-1" /> Send Request
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowRetakeForm(false); setRetakeReason(""); setIreadyMsg(""); }} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {canRetake ? (
                  <Button size="lg" onClick={() => setShowStartConfirm(true)} disabled={loading} className="px-8">
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Take Retake Assessment
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button size="lg" onClick={() => setShowStartConfirm(true)} disabled={loading} className="px-8">
                    <Brain className="w-5 h-5 mr-2" />
                    {hasProfile ? "Take New Assessment" : "Start Reading Assessment"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}

                {/* i-Ready opt-in — hidden if locked */}
                {!ireadyLocked && !showIReadyForm && (
                  <div>
                    <button
                      onClick={() => { setShowIReadyForm(true); setError(""); setIreadyMsg(""); }}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors underline"
                    >
                      Have an i-Ready score? Enter it here
                    </button>
                  </div>
                )}

                {/* If i-Ready is locked, show locked state */}
                {ireadyLocked && (
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" />
                    i-Ready score: {profile?.iready_scale_score} — ask your teacher to change it
                  </div>
                )}

                {hasProfile && !canRetake && (
                  <div>
                    <button
                      onClick={() => { setShowRetakeForm(true); setIreadyMsg(""); }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Request a retake
                    </button>
                  </div>
                )}

                {!hasProfile && (
                  <div>
                    <button
                      onClick={() => navigate("/library")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Skip for now — you can take it later from the Progress tab
                    </button>
                  </div>
                )}

                {error && <p className="text-red-400 text-sm">{error}</p>}
              </>
            )}
          </div>
        </main>

        {/* Timed Assessment Warning Dialog */}
        {showStartConfirm && (
          <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">Ready to Begin?</h2>
                <div className="text-left space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span><strong className="text-foreground">10-minute timer.</strong> The clock starts as soon as you begin and runs through all 15 passages.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span><strong className="text-foreground">Read a passage, then answer questions.</strong> The passage disappears during questions. Each round moves to a new passage.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span><strong className="text-foreground">Can't pause once started.</strong> If the timer runs out, your answers are submitted automatically.</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button size="sm" onClick={startAssessment} disabled={loading} className="flex-1">
                  <Zap className="w-4 h-4 mr-1" /> {loading ? "Starting..." : "Start Now"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowStartConfirm(false)} disabled={loading} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── READING PHASE (round-based: show current passage) ──────────────
  if (phase === "reading" && currentPassage) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <span className="font-bold text-base sm:text-lg tracking-wide whitespace-nowrap">A.R.I.S.E<span className="text-primary"> Reader</span></span>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${timeLeft < 60 ? "bg-red-500/20 text-red-400" : "bg-primary/10 text-primary"}`}>
              <Timer className="w-4 h-4" />
              <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              Passage {currentRound + 1} of {passages.length}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalAnswered}/{questions.length} answered total
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
              <BookOpen className="w-3 h-3" />
              {getLevelLabel(currentPassage.grade_level)} • {currentPassage.genre} • {currentPassage.word_count} words
            </div>
            <h2 className="text-xl font-bold mb-4">{currentPassage.title}</h2>
            <div className="prose prose-sm prose-invert max-w-none whitespace-pre-line text-sm leading-relaxed">
              {currentPassage.body}
            </div>
          </div>

          <div className="text-center">
            <Button size="lg" onClick={() => setPhase("questions")} disabled={loading} className="px-8">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              I'm Ready for the Questions
            </Button>
          </div>
          {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
        </main>
      </div>
    );
  }

  // ─── QUESTIONS PHASE (round-based: show questions for current passage) ──
  if (phase === "questions" && currentPassage) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <span className="font-bold text-base sm:text-lg tracking-wide whitespace-nowrap">A.R.I.S.E<span className="text-primary"> Reader</span></span>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground hidden sm:block">
                {currentAnsweredCount}/{currentQuestions.length} in this round
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${timeLeft < 60 ? "bg-red-500/20 text-red-400" : "bg-primary/10 text-primary"}`}>
                <Timer className="w-4 h-4" />
                <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-6 text-center">
            <AlertCircle className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-sm font-medium">Passage is no longer visible. Answer based on what you remember.</p>
          </div>

          <h3 className="font-semibold text-sm text-muted-foreground mb-4 pb-2 border-b border-border">
            {currentPassage.title} — Questions
          </h3>

          {currentQuestions.map((q, idx) => {
            const selected = answersByQuestionId[q.id];
            return (
              <div key={q.id} className="mb-6">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-primary font-bold text-sm shrink-0">{idx + 1}.</span>
                  <div>
                    <p className="text-sm font-medium">{q.question_text}</p>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{q.skill_type}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:pl-6">
                  {(["A", "B", "C", "D"] as const).map((letter) => {
                    const optText = (q as any)[`option_${letter.toLowerCase()}`];
                    const isSelected = selected === letter;
                    return (
                      <button
                        key={letter}
                        onClick={() => handleAnswer(q.id, letter)}
                        className={`text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary font-medium"
                            : "bg-muted/30 border-border hover:bg-muted hover:border-primary/50"
                        }`}
                      >
                        <span className="font-bold mr-2">{letter}.</span>{optText}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Next Passage or Submit */}
          <div className="text-center mt-4 mb-20">
            {isLastRound ? (
              <Button size="lg" onClick={() => handleSubmit(false)} disabled={loading} className="px-8 shadow-lg">
                {loading ? "Submitting..." : "Submit Assessment"}
                {!loading && <CheckCircle2 className="w-4 h-4 ml-2" />}
              </Button>
            ) : (
              <Button size="lg" onClick={() => { setCurrentRound(currentRound + 1); setPhase("reading"); }} className="px-8 shadow-lg">
                Next Passage <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {currentAnsweredCount} of {currentQuestions.length} answered in this round
            </p>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
        </main>
      </div>
    );
  }

  // ─── RESULTS PHASE ──────────────────────────────────────────────────
  if (phase === "results" && result) {
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    const passed = pct >= 70;
    const skillScores = result.skill_scores || {};
    const timeStr = timeUsed > 0 ? `${Math.floor(timeUsed / 60)}m ${timeUsed % 60}s` : "";

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <span className="font-bold text-base sm:text-lg tracking-wide whitespace-nowrap">A.R.I.S.E<span className="text-primary"> Reader</span></span>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className={`border rounded-xl p-6 mb-6 text-center ${getEstimatedBg(result.estimated_grade_level)}`}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
              {passed ? <Award className="w-8 h-8 text-primary" /> : <RotateCcw className="w-8 h-8 text-primary" />}
            </div>
            <h2 className="text-3xl font-bold mb-1">{pct}%</h2>
            <p className="text-sm text-muted-foreground mb-2">{result.score} out of {result.total} correct</p>
            <div className={`text-lg font-semibold ${getEstimatedColor(result.estimated_grade_level)}`}>
              {getEstimatedLabel(result.estimated_grade_level)}
            </div>
            {timeStr && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <Timer className="w-3 h-3" /> Completed in {timeStr}
              </p>
            )}
            {result.grade_level && (
              <p className="text-xs text-muted-foreground mt-1">Placed at {getLevelLabel(result.grade_level)}</p>
            )}
          </div>

          {Object.keys(skillScores).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Skill Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(skillScores).map(([skill, scores]: [string, any]) => {
                  const Icon = SKILL_ICONS[skill] || Brain;
                  const skillPct = scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0;
                  const color = SKILL_BAR_COLORS[skill] || "bg-primary";
                  return (
                    <div key={skill}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className={`w-4 h-4 ${SKILL_COLORS[skill] || "text-muted-foreground"}`} />
                          <span>{SKILL_LABELS[skill] || skill}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{scores.correct}/{scores.total}</span>
                          <span className="text-sm font-semibold">{skillPct}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${skillPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5 mb-6 text-center">
            {pct >= 70 ? (
              <p className="text-sm text-green-400">Great job! You've demonstrated reading proficiency at your level.</p>
            ) : pct >= 50 ? (
              <p className="text-sm text-yellow-400">Keep practicing — you're building your skills. We've adjusted your level to help you grow.</p>
            ) : (
              <p className="text-sm text-red-400">You may need more practice at this level. We've adjusted your reading level to help you build confidence.</p>
            )}
            {result.grade_level && (
              <p className="text-xs text-muted-foreground mt-2">Your new reading level: {getLevelLabel(result.grade_level)}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/library")} className="flex-1">
              <BookOpen className="w-4 h-4 mr-2" /> Browse Books
            </Button>
            <Button onClick={() => { setPhase("intro"); fetchProfile(); fetchRetakeStatus(); }} className="flex-1">
              <RotateCcw className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </div>

          <div className="text-center mt-4">
            <button
              onClick={() => { setShowRetakeForm(true); setIreadyMsg(""); }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Request a retake
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}
