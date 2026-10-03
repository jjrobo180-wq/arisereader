import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { BookOpen, ArrowLeft, CheckCircle2, XCircle, Award, FileSearch, Sparkles, Volume2, Square } from "lucide-react";
import { generateCertificate } from "@/lib/certificate";
import BookAccessLinks from "@/components/BookAccessLinks";
import { NEWS_AUTHOR, newsByTitle } from "@shared/ariseNews";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { speakCharacterAI, stopSpeaking as stopAiSpeaking } from "@/lib/tts";
import NoProctorGate, { type CameraSession } from "@/components/NoProctorGate";
import { AutoTurnInNote, CameraBubble, CameraOffDialog, LeaveWarning, OnYourOwnStrip, StopDialog, TurningIn } from "@/components/NoProctorParts";
import { CAMERA_CONSTRAINTS, NoProctorMonitor, cameraErrorMessage, canUseCamera, type MonitorEvent } from "@/lib/noProctorMonitor";

interface SafeQuestion {
  id: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  questionOrder: number;
}

interface Book {
  id: number;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string;
  ageGroup: string;
  readUrl?: string | null;
  pointsValue?: number;
}

/** Per question: when it was first answered (ms after the start) and how many times the answer changed. */
type AnswerTimes = Record<string, { first: number; changes: number }>;
/** A no-proctor try saved on this device, so a reload or an accidental close can pick it up again. */
type SavedTry = { token: string; userId: number; answers: Record<string, string>; answerTimes: AnswerTimes; leaves: number };
type ResumeInfo = { token: string; leaves: number; startedAt: number; snapshotEveryMs: number; leavesBeforeTurnIn: number; answers: Record<string, string>; answerTimes: AnswerTimes };

function readSavedTry(key: string, userId: number | undefined): SavedTry | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved || typeof saved.token !== "string" || !userId || saved.userId !== userId) return null;
    return {
      token: saved.token,
      userId,
      answers: saved.answers && typeof saved.answers === "object" ? saved.answers : {},
      answerTimes: saved.answerTimes && typeof saved.answerTimes === "object" ? saved.answerTimes : {},
      leaves: Number(saved.leaves) || 0,
    };
  } catch {
    return null;
  }
}
function writeSavedTry(key: string, value: SavedTry) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage off: no resume */ }
}
function clearSavedTry(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export default function Quiz() {
  const { id } = useParams();
  const { token, user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [book, setBook] = useState<Book | null>(null);
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [alreadyTaken, setAlreadyTaken] = useState<{ score: number; total: number; points?: number } | null>(null);
  const [proctorVerified, setProctorVerified] = useState(false);
  const [proctorError, setProctorError] = useState("");
  const [proctorLoading, setProctorLoading] = useState(false);
  const [proctorSessionToken, setProctorSessionToken] = useState("");
  const [proctorIdentity, setProctorIdentity] = useState<{ type: "parent" | "teacher"; name: string } | null>(null);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [speakingQId, setSpeakingQId] = useState<number | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // No-proctor (camera) quizzes
  const [camera, setCamera] = useState<CameraSession | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [leaves, setLeaves] = useState(0);
  const [leaveWarning, setLeaveWarning] = useState<{ awayMs: number } | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [autoTurnIn, setAutoTurnIn] = useState<null | "sending" | "failed">(null);
  const [turnedInAuto, setTurnedInAuto] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const monitorRef = useRef<NoProctorMonitor | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const answerTimesRef = useRef<AnswerTimes>({});
  const clockStartRef = useRef(0);
  const submittedRef = useRef(false);
  const pendingTurnInRef = useRef<{ body: string; auto: boolean; events: MonitorEvent[] } | null>(null);
  const savedKey = `noproctor:book:${id}`;
  const savedKeyRef = useRef(savedKey);
  savedKeyRef.current = savedKey;
  const userIdRef = useRef<number | undefined>(user?.id);
  userIdRef.current = user?.id;

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.isAdmin;
  const isSampleStudent = !!user?.username?.startsWith('sample') || user?.username === 'tutorial-eye';

  const handleRequestReview = async () => {
    if (!token || !result?.attemptId) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/quiz-review/${result.attemptId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reviewReason.trim() || undefined }),
      });
      if (res.ok) {
        setReviewSubmitted(true);
        setTimeout(() => {
          setShowReviewRequest(false);
          setReviewSubmitted(false);
          setReviewReason("");
        }, 3000);
      }
    } catch {} finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!token || !id) return;
      try {
        const res = await fetch(`${API_BASE}/api/books/${id}/quiz`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.status === 403 && data.score !== undefined) {
          setAlreadyTaken({ score: data.score, total: data.total, points: data.points });
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError(data.message || "Failed to load quiz");
          setLoading(false);
          return;
        }
        setBook(data.book || null);
        const qs = Array.isArray(data.questions) ? data.questions : [];
        const sorted = qs.sort((a: SafeQuestion, b: SafeQuestion) => a.questionOrder - b.questionOrder);
        // Sample accounts get the complete quiz experience; the server keeps demo attempts noncompetitive.
        setQuestions(sorted);
      } catch (err) {
        setError("Failed to load quiz");
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [token, id]);

  // --- Neural AI text-to-speech for quiz questions ---
  const speakQuestion = (q: SafeQuestion, idx: number) => {
    if (speakingQId === q.id) {
      stopAiSpeaking();
      setSpeakingQId(null);
      return;
    }

    stopAiSpeaking();
    const opts = ["A", "B", "C", "D"] as const;
    const optionTexts = opts.map(letter => {
      const text = q[`option${letter}` as keyof SafeQuestion] as string;
      return text ? `${letter}. ${text}` : "";
    }).filter(Boolean);
    const fullText = `Question ${idx + 1}. ${q.questionText}. Answer choices: ${optionTexts.join(". ")}`;

    setSpeakingQId(q.id);
    void speakCharacterAI(fullText, {
      onEnd: () => setSpeakingQId(null),
      onFallback: () => setSpeakingQId(null),
    });
  };

  const stopSpeaking = () => {
    stopAiSpeaking();
    setSpeakingQId(null);
  };

  // Stop neural speech when leaving the page
  useEffect(() => {
    return () => stopAiSpeaking();
  }, []);

  // A no-proctor try saved on this device (after a reload or an accidental close)
  // is picked up again if the server says it's still going.
  useEffect(() => {
    if (!token || !id || !user?.id) return;
    const saved = readSavedTry(savedKey, user.id);
    if (!saved) { setResumeChecked(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/integrity/live/${saved.token}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (data?.status === "active" && Number(data.quizId) === Number(id)) {
          const offset = data.serverNow ? Date.now() - Date.parse(data.serverNow) : 0;
          setResume({
            token: saved.token,
            leaves: Math.max(Number(data.leaves) || 0, saved.leaves),
            startedAt: (Date.parse(data.startedAt) || Date.now()) + (Number.isFinite(offset) ? offset : 0),
            snapshotEveryMs: Number(data.snapshotEveryMs) || 30_000,
            leavesBeforeTurnIn: Number(data.leavesBeforeTurnIn) || 2,
            answers: saved.answers,
            answerTimes: saved.answerTimes,
          });
        } else if (data || res.status === 404) {
          clearSavedTry(savedKey);
        }
      } catch {
        // Offline: start normally.
      } finally {
        if (!cancelled) setResumeChecked(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, user?.id]);

  const saveTry = (patch: Partial<SavedTry> = {}) => {
    if (!camera || !user?.id || submittedRef.current || monitorRef.current?.preview) return;
    writeSavedTry(savedKey, {
      token: camera.token,
      userId: user.id,
      answers: answersRef.current,
      answerTimes: answerTimesRef.current,
      leaves: monitorRef.current?.leaves ?? 0,
      ...patch,
    });
  };

  const handleAnswer = (questionId: number, answer: string) => {
    const key = String(questionId);
    if (camera) {
      const timing = answerTimesRef.current[key];
      if (!timing) answerTimesRef.current[key] = { first: Math.max(0, Date.now() - clockStartRef.current), changes: 0 };
      else if (answersRef.current[key] !== answer) timing.changes += 1;
    }
    answersRef.current = { ...answersRef.current, [key]: answer };
    setAnswers(prev => ({ ...prev, [key]: answer }));
  };

  useEffect(() => {
    answersRef.current = answers;
    saveTry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  // What happens when the student leaves the quiz and comes back. Kept in refs so
  // the monitor (created once) always calls the current version.
  const onLeaveRef = useRef<(leaves: number) => void>(() => {});
  const onReturnRef = useRef<(leaves: number, awayMs: number) => void>(() => {});
  onLeaveRef.current = (n) => {
    setLeaves(n);
    saveTry({ leaves: n });
    if (camera && n >= camera.leavesBeforeTurnIn) void turnIn(true);
  };
  onReturnRef.current = (n, awayMs) => {
    if (!camera || submittedRef.current) return;
    if (n >= 1 && n < camera.leavesBeforeTurnIn) setLeaveWarning({ awayMs });
  };

  const startCameraQuiz = (session: CameraSession) => {
    const restored = session.resumed && resume?.token === session.token ? resume : null;
    const startAnswers = restored?.answers ?? {};
    answersRef.current = startAnswers;
    answerTimesRef.current = restored?.answerTimes ?? {};
    clockStartRef.current = session.startedAt;
    submittedRef.current = false;
    const monitor = new NoProctorMonitor({
      apiBase: API_BASE,
      token: session.token,
      startedAt: session.startedAt,
      leaves: session.leaves,
      snapshotEveryMs: session.snapshotEveryMs,
      onLeave: (n) => onLeaveRef.current(n),
      onReturn: (n, ms) => onReturnRef.current(n, ms),
      onCamera: (on) => setCameraOn(on),
    });
    monitorRef.current = monitor;
    monitor.setStream(session.stream);
    monitor.start(session.resumed ? "resumed" : "start");
    if (session.resumed) monitor.note("resumed");
    setAnswers(startAnswers);
    setLeaves(session.leaves);
    setCamera(session);
    if (user?.id && !monitor.preview) {
      writeSavedTry(savedKey, { token: session.token, userId: user.id, answers: startAnswers, answerTimes: answerTimesRef.current, leaves: session.leaves });
    }
  };

  const restartCamera = async () => {
    if (!canUseCamera()) throw new Error("This browser can't use a camera here.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    } catch (e) {
      throw new Error(cameraErrorMessage(e));
    }
    if (monitorRef.current) monitorRef.current.setStream(stream);
    else stream.getTracks().forEach((t) => t.stop());
  };

  /** Sends a no-proctor quiz to be graded. Retries keep the same answers and log. */
  const deliverTurnIn = async () => {
    const pending = pendingTurnInRef.current;
    if (!pending || !token || !id) return;
    setSubmitError("");
    if (pending.auto) setAutoTurnIn("sending"); else setSubmitting(true);
    const post = (keepalive: boolean) => fetch(`${API_BASE}/api/books/${id}/quiz`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: pending.body,
      keepalive,
    });
    let res: Response | null = null;
    try {
      // keepalive lets an automatic turn-in finish even while the page is closing.
      res = await post(pending.auto && pending.body.length < 60_000);
    } catch {
      try { res = await post(false); } catch { res = null; }
    }
    if (!res) {
      if (pending.auto) {
        setAutoTurnIn("failed");
      } else {
        // Let the student keep going and try again.
        pendingTurnInRef.current = null;
        submittedRef.current = false;
        monitorRef.current?.requeue(pending.events);
        monitorRef.current?.unpause();
        setSubmitting(false);
        setSubmitError("Your quiz didn't go through. Check your internet connection and try again.");
      }
      return;
    }
    const data = await res.json().catch(() => ({}));
    pendingTurnInRef.current = null;
    monitorRef.current?.stop();
    clearSavedTry(savedKey);
    setSubmitting(false);
    setAutoTurnIn(null);
    setLeaveWarning(null);
    if (!res.ok) {
      // The same try may already have been turned in (for example from the page that
      // closed): show that result instead of an error.
      if (res.status === 403) {
        try {
          const check = await fetch(`${API_BASE}/api/books/${id}/quiz`, { headers: { Authorization: `Bearer ${token}` } });
          const taken = await check.json().catch(() => ({}));
          if (check.status === 403 && taken.score !== undefined) {
            setAlreadyTaken({ score: taken.score, total: taken.total, points: taken.points });
            return;
          }
        } catch { /* show the error below */ }
      }
      setError(data.message || "Failed to submit quiz");
      return;
    }
    if (pending.auto) setTurnedInAuto(true);
    setResult(data);
  };

  /**
   * Turns in a no-proctor quiz: by the student (auto = false), or automatically
   * after the second leave. `from` is a saved try being turned in after a reload.
   */
  const turnIn = (auto: boolean, from?: { token: string; answers: Record<string, string>; answerTimes: AnswerTimes }) => {
    const sessionToken = from?.token ?? camera?.token;
    if (submittedRef.current || !sessionToken) return;
    submittedRef.current = true;
    const monitor = monitorRef.current;
    monitor?.pause();
    if (!auto) monitor?.snap("end");
    // Built right away (this can run while the page is closing); the queued log goes along.
    const events = monitor?.drain() ?? [];
    pendingTurnInRef.current = {
      auto,
      events,
      body: JSON.stringify({
        answers: from?.answers ?? answersRef.current,
        integritySessionToken: sessionToken,
        autoSubmitted: auto,
        answerTimes: from?.answerTimes ?? answerTimesRef.current,
        integrityEvents: events,
      }),
    };
    return deliverTurnIn();
  };

  // A saved try that already used up its leaves (the page was closed a second time) is turned in.
  useEffect(() => {
    if (resume && resume.leaves >= resume.leavesBeforeTurnIn && !result && !alreadyTaken) {
      void turnIn(true, { token: resume.token, answers: resume.answers, answerTimes: resume.answerTimes });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  const stopCameraQuiz = () => {
    const monitor = monitorRef.current;
    monitorRef.current = null;
    monitor?.leaveForGood("stopped");
    clearSavedTry(savedKey);
    setConfirmStop(false);
    navigate("/library");
  };

  // During a no-proctor quiz: no copy, paste, right-click menu, dragging or printing,
  // a prompt before reloading, and no pull-to-refresh on phones.
  useEffect(() => {
    if (!camera || result) return;
    const blockAndLog = (e: Event) => { e.preventDefault(); monitorRef.current?.copyAttempt(); };
    const block = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "c" || k === "x" || k === "v") { e.preventDefault(); monitorRef.current?.copyAttempt(); }
      else if (k === "a" || k === "p" || k === "s" || k === "u") e.preventDefault();
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (submittedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("copy", blockAndLog);
    document.addEventListener("cut", blockAndLog);
    document.addEventListener("paste", blockAndLog);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", beforeUnload);
    const root = document.documentElement;
    const overscroll = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";
    return () => {
      document.removeEventListener("copy", blockAndLog);
      document.removeEventListener("cut", blockAndLog);
      document.removeEventListener("paste", blockAndLog);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", beforeUnload);
      root.style.overscrollBehaviorY = overscroll;
    };
  }, [camera, result]);

  // Leaving the quiz page inside the app counts as leaving the quiz; the saved
  // try keeps that count so it carries over if the student comes back.
  useEffect(() => () => {
    const monitor = monitorRef.current;
    monitorRef.current = null;
    if (!monitor) return;
    if (submittedRef.current || monitor.preview) { monitor.stop(); return; }
    const n = monitor.leaveForGood("page");
    const saved = readSavedTry(savedKeyRef.current, userIdRef.current);
    if (saved) writeSavedTry(savedKeyRef.current, { ...saved, leaves: Math.max(saved.leaves, n) });
  }, []);

  const handleProctorVerify = async (code: string) => {
    if (!token || !code) return;
    setProctorLoading(true);
    setProctorError("");
    try {
      const res = await fetch(`${API_BASE}/api/verify-proctor`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: code, quizKind: "book", quizId: Number(id) }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setProctorSessionToken(String(data.proctorSessionToken || ""));
        setProctorIdentity({
          type: data.proctorType === "parent" ? "parent" : "teacher",
          name: String(data.proctorName || (data.proctorType === "parent" ? "Parent / Guardian" : "Teacher / School Staff")),
        });
        // A proctor takes over: an unfinished camera try on this device is dropped.
        clearSavedTry(savedKey);
        setResume(null);
        setProctorVerified(true);
      } else {
        setProctorError(data.message || "Incorrect password");
      }
    } catch {
      setProctorError("Failed to verify password");
    } finally {
      setProctorLoading(false);
    }
  };

  const allAnswered = questions.every(q => answers[String(q.id)]);

  const handleSubmit = async () => {
    if (!token || !id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}/quiz`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers, proctorSessionToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to submit quiz");
        return;
      }
      setResult(data);
    } catch (err) {
      setError("Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  // Spectator mode: teachers/admins can view quizzes but not take them
  if (isTeacherOrAdmin && !loading && book && questions.length > 0) {
    return (
      <div className="min-h-screen p-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-xl mb-4">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {book.coverUrl ? <img src={book.coverUrl} alt="Cover" className="w-full h-full object-cover" /> : <BookOpen className="w-8 h-8 m-auto mt-6" />}
              </div>
              <div>
                <h1 className="text-xl font-bold">{book.title}</h1>
                <p className="text-sm text-muted-foreground">by {book.author}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">Spectator Mode (Read-Only)</span>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <Card key={q.id} className="shadow-md">
                <CardContent className="p-4">
                  <p className="font-medium mb-3"><span className="text-primary font-bold">Q{i + 1}.</span> {q.questionText}</p>
                  <div className="space-y-2">
                    {['A', 'B', 'C', 'D'].map(opt => (
                      <div key={opt} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                        <span className="w-6 h-6 rounded-full bg-muted text-xs flex items-center justify-center font-bold">{opt}</span>
                        <span className="text-sm">{q[`option${opt}` as keyof SafeQuestion] as string}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/library")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Library
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (alreadyTaken) {
    const passingScore = Math.ceil(alreadyTaken.total * 0.70);
    const passed = alreadyTaken.score >= passingScore;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">You've already taken this quiz!</h2>
            <p className="text-muted-foreground mb-4">
              You scored {alreadyTaken.score} out of {alreadyTaken.total}.
            </p>
            {passed ? (
              <p className="text-sm text-green-400 font-semibold mb-4">You passed and earned {alreadyTaken.points ?? 0} points!</p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">You needed {passingScore} correct to pass and earn points.</p>
            )}
            <Button onClick={() => navigate("/library")} data-testid="button-back-library">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    // Sample student: show special result screen
    if (result.isSample) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Sample Quiz Complete!</h2>
              <p className="text-muted-foreground mb-6">{book?.title}</p>
              <div className="rounded-2xl p-6 mb-6 bg-amber-500/20">
                <div className="text-5xl font-bold text-amber-400">{result.score}/{result.total}</div>
                <div className="text-sm text-muted-foreground mt-1">questions correct</div>
              </div>
              <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-4 mb-6">
                <p className="text-sm font-bold text-primary mb-1">Want to earn real points?</p>
                <p className="text-xs text-muted-foreground">Create a free account to take the full 10-question quiz, earn points, climb the leaderboard, and win certificates!</p>
              </div>
              <Button onClick={() => { logout(); navigate("/register"); }} className="w-full bg-primary mb-2" size="lg">
                <Sparkles className="w-4 h-4 mr-2" />Create Free Account
              </Button>
              <Button onClick={() => navigate("/library")} variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />Back to Library
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    const percentage = Math.round((result.score / result.total) * 100);
    const passed = result.passed !== undefined ? result.passed : result.score >= Math.ceil(result.total * 0.7);
    const passingScore = result.passingScore || Math.ceil(result.total * 0.7);
    const certDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg ${
              passed ? "bg-primary" : "bg-muted"
            }`}>
              {passed ? <CheckCircle2 className="w-10 h-10 text-white" /> : <XCircle className="w-10 h-10 text-white" />}
            </div>
            <h2 className="text-2xl font-bold mb-2">{passed ? "Passed!" : "Not Passed"}</h2>
            <p className="text-muted-foreground mb-6">{book?.title}</p>
            {(turnedInAuto || result.integrity?.autoSubmitted) && <AutoTurnInNote />}
            <div className={`rounded-2xl p-6 mb-6 ${
              passed ? "bg-primary text-white" : "bg-muted text-muted-foreground"
            }`}>
              <div className="text-5xl font-bold">{result.score}</div>
              <div className="text-sm opacity-80 mt-1">out of {result.total} correct</div>
              <div className="text-3xl font-bold mt-2">{percentage}%</div>
            </div>
            {passed ? (
              <div className="mb-6">
                <p className="text-lg font-bold text-primary">
                  You earned {result.points} {result.points === 1 ? "point" : "points"}!
                </p>
                {result.bookPoints && (
                  <p className="text-sm text-muted-foreground mt-1">
                    out of {result.bookPoints} possible
                  </p>
                )}
                <Button
                  onClick={() => generateCertificate(
                    result.studentName || user?.displayName || "Student",
                    result.bookTitle || book?.title || "Book",
                    result.points,
                    certDate
                  )}
                  className="w-full mt-4"
                  variant="default"
                  data-testid="button-certificate"
                >
                  <Award className="w-4 h-4 mr-2" />
                  Get Certificate
                </Button>
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                  You needed {passingScore} correct to pass and earn points.
                </p>
                <p className="text-sm font-semibold text-muted-foreground mt-2">
                  No points awarded. Better luck next time!
                </p>
              </div>
            )}
            <Button onClick={() => navigate("/library")} className="w-full" variant="outline" data-testid="button-back-library">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
            <Button
              onClick={() => setShowReviewRequest(true)}
              className="w-full mt-2"
              variant="ghost"
              data-testid="button-request-review"
            >
              <FileSearch className="w-4 h-4 mr-2" />
              Request Manual Review
            </Button>
            <Dialog open={showReviewRequest} onOpenChange={setShowReviewRequest}>
              <DialogContent className="max-w-md">
                {reviewSubmitted ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                    <p className="text-lg font-semibold">Review Request Sent!</p>
                    <p className="text-sm text-muted-foreground text-center">
                      Your teacher will review the quiz questions and update your score if needed.
                    </p>
                  </div>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <FileSearch className="w-5 h-5 text-primary" />
                        Request Manual Review
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Think something is wrong with the quiz grading? Describe the issue and your teacher will review the questions and your answers.
                      </p>
                      <Textarea
                        placeholder="Describe the issue (optional)..."
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowReviewRequest(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRequestReview}
                        disabled={reviewSubmitting}
                      >
                        {reviewSubmitting ? "Sending..." : "Send Request"}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proctorVerified && !camera && !isSampleStudent && !user?.isAdmin && !result && !alreadyTaken && !error && book) {
    if (autoTurnIn || (resume && resume.leaves >= resume.leavesBeforeTurnIn)) {
      // A saved try that was already used up is being turned in.
      return (
        <div className="min-h-screen bg-background">
          <TurningIn failed={autoTurnIn === "failed"} onRetry={() => void deliverTurnIn()} />
        </div>
      );
    }
    if (!resumeChecked) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <NoProctorGate
        book={book}
        questionCount={questions.length}
        quizId={Number(id)}
        authToken={token}
        resume={resume && resume.leaves < resume.leavesBeforeTurnIn ? resume : null}
        proctorError={proctorError}
        proctorLoading={proctorLoading}
        onVerifyCode={(code) => void handleProctorVerify(code)}
        onCameraReady={startCameraQuiz}
        onBack={() => navigate("/library")}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate("/library")}>Back to Library</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={"min-h-screen bg-background" + (camera ? " np-noselect" : "")}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-3 h-16">
          <Button variant="ghost" size="sm" onClick={() => (camera ? setConfirmStop(true) : navigate("/library"))}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-sm truncate">{book?.title}</h1>
            <p className="text-xs text-muted-foreground">{book?.author}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {camera && <OnYourOwnStrip warningUsed={leaves >= 1} />}
        {isSampleStudent && (
          <div className="mb-6 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-center">
            <p className="text-sm font-bold text-amber-400">🎯 Sample Account Mode</p>
            <p className="text-xs text-muted-foreground mt-1">This is the full quiz experience. Your score is shown, but demo attempts and points are not saved to student rankings.</p>
          </div>
        )}
        {/* Book cover and info */}
        <div className="flex gap-4 mb-8 items-start">
          <div className="w-24 sm:w-32 flex-shrink-0">
            {book?.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={`Cover of ${book.title}`}
                className="w-full rounded-lg shadow-lg"
              />
            ) : (
              <div className="w-full aspect-[2/3] rounded-lg shadow-lg bg-primary text-white flex items-center justify-center p-2 text-center">
                <span className="font-bold text-xs">{book?.title}</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{book?.title}</h2>
            <p className="text-sm text-muted-foreground mb-2">by {book?.author}</p>
            <p className="text-sm text-muted-foreground">{book?.description}</p>
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">
              <BookOpen className="w-3 h-3" />
              {questions.length} questions
            </div>
            {/* Opening the book now would mean leaving a no-proctor quiz. */}
            {!camera && <BookAccessLinks bookTitle={book?.title || ""} author={book?.author} readUrl={book?.readUrl} />}
            {!camera && newsByTitle(book?.title) && book?.author === NEWS_AUTHOR && (
              <button type="button" onClick={() => navigate(`/news/${newsByTitle(book?.title)!.slug}`)} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#17143b] hover:bg-violet-100">
                <BookOpen className="w-3.5 h-3.5" /> Read the Arise News story
              </button>
            )}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <Card key={q.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="font-medium text-base flex-1">{q.questionText}</p>
                  <button
                    onClick={() => speakQuestion(q, idx)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-muted hover:bg-primary/10 text-primary"
                    title={speakingQId === q.id ? "Stop reading" : "Read question aloud"}
                  >
                    {speakingQId === q.id ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                    {speakingQId === q.id ? "Stop" : "Listen"}
                  </button>
                </div>
                <RadioGroup
                  value={answers[String(q.id)] || ""}
                  onValueChange={(val) => handleAnswer(q.id, val)}
                  className="space-y-2"
                >
                  {(["A", "B", "C", "D"] as const).map((letter) => {
                    const text = q[`option${letter}` as keyof SafeQuestion] as string;
                    const isSelected = answers[String(q.id)] === letter;
                    return (
                      <Label
                        key={letter}
                        htmlFor={`q${q.id}-${letter}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <RadioGroupItem value={letter} id={`q${q.id}-${letter}`} />
                        <span className="text-sm">{text}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit (extra room at the bottom so the camera picture doesn't cover it) */}
        <div className={camera ? "mt-6 pb-48" : "mt-6 pb-12"}>
          {submitError && <p className="text-sm text-red-400 mb-3 text-center" role="alert">{submitError}</p>}
          <Button
            onClick={camera ? () => void turnIn(false) : handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full"
            size="lg"
            data-testid="button-submit-quiz"
          >
            {submitting ? "Submitting..." : allAnswered ? "Submit Quiz" : `Answer all questions (${Object.keys(answers).length}/${questions.length})`}
          </Button>
        </div>
      </main>

      {camera && monitorRef.current && <CameraBubble monitor={monitorRef.current} cameraOn={cameraOn} />}
      {camera && !cameraOn && !autoTurnIn && !submitting && (
        <CameraOffDialog onRestart={restartCamera} onTurnIn={() => void turnIn(false)} />
      )}
      {leaveWarning && !autoTurnIn && (
        <LeaveWarning awayMs={leaveWarning.awayMs} onClose={() => { monitorRef.current?.warned(); setLeaveWarning(null); }} />
      )}
      {confirmStop && !autoTurnIn && <StopDialog onKeepGoing={() => setConfirmStop(false)} onStop={stopCameraQuiz} />}
      {autoTurnIn && <TurningIn failed={autoTurnIn === "failed"} onRetry={() => void deliverTurnIn()} />}
    </div>
  );
}
