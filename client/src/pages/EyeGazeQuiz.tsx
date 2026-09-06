import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { ArrowLeft, CheckCircle2, RotateCcw, Trophy, Volume2, VolumeX, Eye } from "lucide-react";
import { initVoices, speakQuestion, speak, stopSpeaking } from "@/lib/tts";

function getTokenFromCookie(): string | null {
  const match = document.cookie.match(/arise_session=([^;]+)/);
  if (!match) return null;
  try {
    const decoded = JSON.parse(atob(match[1]));
    return decoded.token || null;
  } catch {
    return null;
  }
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1: Identification",
  2: "Level 2: Matching",
  3: "Level 3: Discrimination",
  4: "Level 4: Comprehension",
  5: "Level 5: Advanced",
};

interface Quiz {
  questions: any[];
  attemptId: number;
}

export default function EyeGazeQuiz() {
  const { id } = useParams<{ id: string }>();
  const quizId = parseInt(id || "0");
  const { user } = useAuth();
  const [, navigate] = useLocation();
  // No proctor phase - eye gaze quizzes don't require a password
  const [phase, setPhase] = useState<"loading" | "quiz" | "results">("loading");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [subtitle, setSubtitle] = useState("");
  const [answersRead, setAnswersRead] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownAnswer, setCountdownAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize voices
  useEffect(() => {
    initVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = () => initVoices();
    }
    return () => stopSpeaking();
  }, []);

  // Load quiz data when phase is loading
  useEffect(() => {
    if (!user) return;
    if (phase !== "loading") return;
    const token = getTokenFromCookie();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE}/api/eye-gaze/quizzes/${quizId}/start`, {
      method: "POST",
      headers,
    })
      .then((r) => {
        if (r.status === 400) {
          return r.json().then((d) => {
            setError(d.message);
            return null;
          });
        }
        return r.json();
      })
      .then((data) => {
        if (data && data.questions) {
          setQuiz({ ...data, attemptId: data.attemptId });
          setPhase("quiz");
        }
      })
      .catch(() => setError("Failed to load quiz"));
  }, [quizId, user, phase]);

  // Speak question, then read all answer options back-to-back
  useEffect(() => {
    if (phase === "quiz" && quiz && quiz.questions[currentIdx] && ttsEnabled) {
      const q = quiz.questions[currentIdx];
      const visual = q.visual || "";
      setAnswersRead(false);
      setSelectedAnswer(null);
      setCountdown(null);
      setCountdownAnswer(null);

      speakQuestion(q.prompt, visual, (text) => setSubtitle(text), () => {
        // After question is read, read all answer options back-to-back
        const options = [
          { letter: "A", text: q.option_a },
          { letter: "B", text: q.option_b },
          { letter: "C", text: q.option_c },
          { letter: "D", text: q.option_d },
        ].filter(o => o.text);

        const optionsText = options.map(o => `${o.letter}. ${o.text}`).join(". ");
        speak(optionsText, {
          rate: 0.9,
          onSubtitle: (sub) => setSubtitle(sub),
          onEnd: () => {
            setAnswersRead(true);
            setSubtitle("");
          },
        });
      });
    }
    return () => {
      stopSpeaking();
      setSubtitle("");
    };
  }, [currentIdx, phase, quiz, ttsEnabled]);

  // Countdown timer logic
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      // Time's up - confirm the answer
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      setCountdown(null);
      confirmAnswer(countdownAnswer || "");
      return;
    }
    // Tick down every second
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [countdown]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      stopSpeaking();
    };
  }, []);

  // Spectator mode for teachers/admins
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.isAdmin;
  const [spectatorQuestions, setSpectatorQuestions] = useState<any[]>([]);
  const [spectatorLoading, setSpectatorLoading] = useState(false);

  useEffect(() => {
    if (!isTeacherOrAdmin || !quizId) return;
    setSpectatorLoading(true);
    const token = getTokenFromCookie();
    fetch(`${API_BASE}/api/eye-gaze/quizzes/${quizId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then(r => r.json())
      .then(d => {
        if (d.questions) setSpectatorQuestions(d.questions);
        else if (d.error) setError(d.error);
      })
      .catch(() => {})
      .finally(() => setSpectatorLoading(false));
  }, [isTeacherOrAdmin, quizId]);

  if (isTeacherOrAdmin && (spectatorLoading || spectatorQuestions.length > 0)) {
    if (spectatorLoading) {
      return (
        <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
          <div className="spinner" style={{ width: 60, height: 60, border: "5px solid hsl(0 0% 20%)", borderTopColor: "hsl(21 100% 50%)" }} />
          <p style={{ fontSize: "1.25rem", color: "hsl(0 0% 66%)" }}>Loading quiz for viewing...</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen p-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4 p-4 rounded-xl bg-muted/30 border border-border">
            <h1 className="text-xl font-bold">Eye Gaze Quiz (Spectator Mode)</h1>
            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">Read-Only - You cannot take this quiz</span>
          </div>
          <div className="space-y-3">
            {spectatorQuestions.map((q: any, i: number) => (
              <div key={i} className="p-4 rounded-xl bg-muted/20 border border-border">
                <p className="font-medium mb-3"><span className="text-primary font-bold">Q{i + 1}.</span> {q.prompt || q.question}</p>
                <div className="space-y-2">
                  {['A', 'B', 'C', 'D'].map(opt => (
                    <div key={opt} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <span className="w-6 h-6 rounded-full bg-muted text-xs flex items-center justify-center font-bold">{opt}</span>
                      <span className="text-sm">{q[`option${opt}`] || q[`option_${opt.toLowerCase()}`]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate("/library")} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Library
          </button>
        </div>
      </div>
    );
  }

  if (phase === "loading" || !quiz) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <div className="spinner" style={{ width: 60, height: 60, border: "5px solid hsl(0 0% 20%)", borderTopColor: "hsl(21 100% 50%)" }} />
        <p style={{ fontSize: "1.25rem", color: "hsl(0 0% 66%)" }}>Loading your quiz...</p>
      </div>
    );
  }

  // Results screen
  if (phase === "results" && result) {
    const passed = result.pct >= 70;
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2rem", padding: "2rem" }}>
        {passed ? (
          <div style={{ fontSize: "5rem" }}>
            <Trophy size={80} color="hsl(21 100% 50%)" />
          </div>
        ) : (
          <div style={{ fontSize: "5rem" }}>
            <RotateCcw size={80} color="hsl(0 0% 66%)" />
          </div>
        )}
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: passed ? "hsl(21 100% 50%)" : "hsl(0 0% 100%)" }}>
            {passed ? "Great Job!" : "Try Again!"}
          </h1>
          <p style={{ fontSize: "1.5rem", color: "hsl(0 0% 66%)" }}>
            You scored {result.score} out of {result.total} correct
          </p>
          <p style={{ fontSize: "1.25rem", color: "hsl(0 0% 66%)" }}>
            ({result.pct}%)
          </p>
          {result.pointsEarned ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "hsl(21 100% 50% / 0.15)", padding: "0.75rem 1.5rem", borderRadius: "0.75rem", marginTop: "1rem" }}>
              <Trophy size={24} color="hsl(21 100% 50%)" />
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "hsl(21 100% 50%)" }}>+{result.pointsEarned} points earned!</span>
            </div>
          ) : null}
          <button onClick={() => navigate("/library")} className="btn btn-primary" style={{ fontSize: "1.5rem", padding: "1.25rem 2.5rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "hsl(21 100% 50%)", color: "hsl(0 0% 0%)", border: "none", borderRadius: "0.5rem", cursor: "pointer", textDecoration: "none", marginTop: "1rem" }}>
            <ArrowLeft size={28} /> Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <p style={{ fontSize: "1.5rem", color: "hsl(0 0% 66%)" }}>{error}</p>
        <button onClick={() => navigate("/library")} className="btn btn-primary" style={{ fontSize: "1.25rem", padding: "1rem 2rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "hsl(21 100% 50%)", color: "hsl(0 0% 0%)", border: "none", borderRadius: "0.5rem", cursor: "pointer" }}>
          <ArrowLeft size={24} /> Back to Quizzes
        </button>
      </div>
    );
  }

  const handleSelectAnswer = (answer: string) => {
    if (submitting) return;
    const currentQ = quiz.questions[currentIdx];
    if (!currentQ) return;

    // Stop any ongoing TTS and say "You chose A. Cat"
    stopSpeaking();
    setSelectedAnswer(answer);
    setCountdownAnswer(answer);

    // Find the answer text
    const optMap: Record<string, string> = {
      A: currentQ.option_a,
      B: currentQ.option_b,
      C: currentQ.option_c,
      D: currentQ.option_d,
    };
    const answerText = optMap[answer] || "";
    speak(`You chose ${answer}. ${answerText}`, {
      rate: 0.9,
      onSubtitle: (sub) => setSubtitle(sub),
      onEnd: () => {
        setSubtitle("");
        // Start 5-second countdown
        setCountdown(5);
      },
    });
  };

  const confirmAnswer = (answer: string) => {
    if (!answer) return;
    const currentQ = quiz.questions[currentIdx];
    if (!currentQ) return;

    setSubmitting(true);
    stopSpeaking();
    const newAnswers = { ...answers, [currentQ.id]: answer };
    setAnswers(newAnswers);

    if (currentIdx < (quiz.questions?.length || 0) - 1) {
      setCurrentIdx((idx) => idx + 1);
      setSelectedAnswer(null);
      setSubmitting(false);
    } else {
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = (finalAnswers: Record<number, string>) => {
    const token = getTokenFromCookie();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE}/api/eye-gaze/quizzes/${quiz.attemptId}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ answers: finalAnswers }),
    })
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setPhase("results");
      })
      .catch(() => setError("Failed to submit quiz"));
  };

  // Replay question + answers
  const handleReplay = () => {
    if (!quiz || !quiz.questions[currentIdx]) return;
    const q = quiz.questions[currentIdx];
    const visual = q.visual || "";
    setAnswersRead(false);
    speakQuestion(q.prompt, visual, (text) => setSubtitle(text), () => {
      const options = [
        { letter: "A", text: q.option_a },
        { letter: "B", text: q.option_b },
        { letter: "C", text: q.option_c },
        { letter: "D", text: q.option_d },
      ].filter(o => o.text);
      const optionsText = options.map(o => `${o.letter}. ${o.text}`).join(". ");
      speak(optionsText, {
        rate: 0.9,
        onSubtitle: (sub) => setSubtitle(sub),
        onEnd: () => {
          setAnswersRead(true);
          setSubtitle("");
        },
      });
    });
  };

  // Quiz screen
  const currentQ = quiz.questions[currentIdx];
  if (!currentQ) return null;
  const options = [
    { letter: "A", text: currentQ.option_a },
    { letter: "B", text: currentQ.option_b },
    { letter: "C", text: currentQ.option_c },
    { letter: "D", text: currentQ.option_d },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <button onClick={() => { stopSpeaking(); navigate("/library"); }} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "hsl(0 0% 66%)", fontSize: "1rem", textDecoration: "none", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={20} /> Exit
        </button>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* TTS Toggle */}
          <button
            onClick={() => {
              const next = !ttsEnabled;
              setTtsEnabled(next);
              if (!next) {
                stopSpeaking();
                setSubtitle("");
              }
            }}
            title={ttsEnabled ? "Turn off voice" : "Turn on voice"}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.75rem", borderRadius: "0.5rem", background: ttsEnabled ? "hsl(21 100% 50% / 0.15)" : "hsl(0 0% 14%)", border: ttsEnabled ? "1px solid hsl(21 100% 50% / 0.4)" : "1px solid hsl(0 0% 20%)", color: ttsEnabled ? "hsl(21 100% 50%)" : "hsl(0 0% 66%)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}
          >
            {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {ttsEnabled ? "Voice On" : "Voice Off"}
          </button>
          <span style={{ color: "hsl(21 100% 50%)", fontSize: "1rem", fontWeight: 600 }}>
            Question {currentIdx + 1} of {quiz.questions.length}
          </span>
          <div style={{ width: "120px", height: "8px", background: "hsl(0 0% 14%)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              width: `${((currentIdx + 1) / quiz.questions.length) * 100}%`,
              height: "100%",
              background: "hsl(21 100% 50%)",
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      </div>

      {/* Question prompt */}
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "hsl(0 0% 100%)" }}>
          {currentQ.prompt}
        </h2>
        {/* Replay button - replays question + all answers */}
        {ttsEnabled && (
          <button
            onClick={handleReplay}
            style={{ marginTop: "0.5rem", background: "none", border: "1px solid hsl(0 0% 30%)", borderRadius: "0.5rem", padding: "0.3rem 0.75rem", color: "hsl(0 0% 66%)", fontSize: "0.85rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
            title="Hear question and answers again"
          >
            <Volume2 size={14} /> Replay
          </button>
        )}
      </div>

      {/* Large visual */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: "1.5rem",
      }}>
        <div style={{
          fontSize: "8rem",
          lineHeight: 1,
          padding: "1rem",
          background: "hsl(0 0% 14%)",
          borderRadius: "1rem",
          border: "2px solid hsl(0 0% 20%)",
        }}>
          {currentQ.visual}
        </div>
      </div>

      {/* Answer options - highlight each as it's being read */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.75rem",
        flex: 1,
        maxWidth: "800px",
        margin: "0 auto",
        width: "100%",
      }}>
        {options.map((opt) => {
          const isSelected = selectedAnswer === opt.letter;
          // Highlight the option currently being spoken
          const isHighlighted = subtitle && subtitle.includes(opt.letter + ".") && !answersRead;
          return (
            <button
              key={opt.letter}
              onClick={() => answersRead && handleSelectAnswer(opt.letter)}
              disabled={!answersRead || !!countdown || submitting}
              style={{
                padding: "2rem 1rem",
                fontSize: "1.5rem",
                fontWeight: 600,
                borderRadius: "1rem",
                border: isSelected ? "3px solid hsl(21 100% 50%)" : isHighlighted ? "2px solid hsl(21 100% 50% / 0.5)" : "2px solid hsl(0 0% 20%)",
                background: isSelected ? "hsl(21 100% 50%)" : isHighlighted ? "hsl(21 100% 50% / 0.08)" : "hsl(0 0% 14%)",
                color: isSelected ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)",
                cursor: !answersRead || countdown ? "default" : "pointer",
                transition: "all 0.2s ease",
                minHeight: "120px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                opacity: !answersRead ? 0.7 : 1,
              }}
            >
              {isSelected && <CheckCircle2 size={28} />}
              <span style={{ fontWeight: 800 }}>{opt.letter}.</span> {opt.text}
            </button>
          );
        })}
      </div>

      {/* Countdown overlay - shows when user has selected an answer */}
      {countdown !== null && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          zIndex: 200,
        }}>
          <div style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            border: "4px solid hsl(21 100% 50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "3.5rem",
            fontWeight: 800,
            color: "hsl(21 100% 50%)",
          }}>
            {countdown}
          </div>
          <p style={{ fontSize: "1.5rem", color: "hsl(0 0% 100%)", fontWeight: 700, textAlign: "center" }}>
            Submitting your answer...
          </p>
          <p style={{ fontSize: "1rem", color: "hsl(0 0% 66%)", textAlign: "center" }}>
            Tap a different answer to change your selection
          </p>
          {/* Show answer options during countdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", maxWidth: "400px", width: "100%" }}>
            {options.map((opt) => {
              const isSelected = countdownAnswer === opt.letter;
              return (
                <button
                  key={opt.letter}
                  onClick={() => {
                    // Reset countdown with new answer
                    if (countdownInterval.current) clearInterval(countdownInterval.current);
                    setCountdownAnswer(opt.letter);
                    setSelectedAnswer(opt.letter);
                    setCountdown(5);
                  }}
                  style={{
                    padding: "1rem",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    borderRadius: "0.75rem",
                    border: isSelected ? "3px solid hsl(21 100% 50%)" : "2px solid hsl(0 0% 20%)",
                    background: isSelected ? "hsl(21 100% 50%)" : "hsl(0 0% 14%)",
                    color: isSelected ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {opt.letter}. {opt.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtitles bar - shows what's being spoken */}
      {ttsEnabled && subtitle && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "hsl(0 0% 8% / 0.95)",
          borderTop: "2px solid hsl(21 100% 50%)",
          padding: "0.75rem 1rem",
          textAlign: "center",
          zIndex: 100,
        }}>
          <p style={{
            fontSize: "1.1rem",
            color: "hsl(0 0% 100%)",
            fontWeight: 500,
            lineHeight: 1.4,
          }}>
            {subtitle}
          </p>
        </div>
      )}
    </div>
  );
}
