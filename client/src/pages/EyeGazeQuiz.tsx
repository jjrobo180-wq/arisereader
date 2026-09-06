import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle2, Trophy, RotateCcw, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ProctorGate } from "@/components/ProctorGate";
import { speakQuestion, stopSpeaking, initVoices } from "@/lib/tts";

import { API_BASE } from "@/lib/queryClient";

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

interface Question {
  id: number;
  prompt: string;
  visual: string;
  visual_type: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  question_order: number;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  level: number;
  cover_visual: string;
  questions: Question[];
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1: Look and Choose",
  2: "Level 2: Match and Identify",
  3: "Level 3: Simple Story Questions",
  4: "Level 4: Comprehension",
  5: "Level 5: Advanced",
};

export default function EyeGazeQuiz() {
  const { id } = useParams<{ id: string }>();
  const quizId = parseInt(id || "0");
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<"proctor" | "loading" | "quiz" | "results">("proctor");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize voices
  useEffect(() => {
    initVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = () => initVoices();
    }
    return () => stopSpeaking();
  }, []);

  // Speak question when it changes
  useEffect(() => {
    if (phase === "quiz" && quiz && quiz.questions[currentIdx] && ttsEnabled) {
      const q = quiz.questions[currentIdx];
      // Check all options for animal/sound keywords
      const options = [q.option_a, q.option_b, q.option_c, q.option_d];
      speakQuestion(q.prompt, options.join(" "));
    }
    return () => stopSpeaking();
  }, [currentIdx, phase, quiz, ttsEnabled]);

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

  const handleSelectAnswer = (answer: string) => {
    if (selectedAnswer || autoAdvancing) return;
    const currentQ = quiz?.questions[currentIdx];
    if (!currentQ) return;
    setSelectedAnswer(answer);
    setAutoAdvancing(true);

    const newAnswers = { ...answers, [currentQ.id]: answer };
    setAnswers(newAnswers);

    // Auto-advance after 1.5s so user sees their selection
    advanceTimer.current = setTimeout(() => {
      if (currentIdx < (quiz?.questions?.length || 0) - 1) {
        setCurrentIdx((idx) => idx + 1);
        setSelectedAnswer(null);
        setAutoAdvancing(false);
      } else {
        // Submit
        submitQuiz(newAnswers);
      }
    }, 1500);
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

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem" }}>
        <div style={{ fontSize: "3rem" }}>⚠️</div>
        <p style={{ fontSize: "1.5rem", color: "hsl(0 0% 66%)" }}>{error}</p>
        <button onClick={() => navigate("/library")} className="btn btn-primary" style={{ fontSize: "1.25rem", padding: "1rem 2rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "hsl(21 100% 50%)", color: "hsl(0 0% 0%)", border: "none", borderRadius: "0.5rem", cursor: "pointer", textDecoration: "none" }}>
          <ArrowLeft size={24} /> Back to Quizzes
        </button>
      </div>
    );
  }

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

  if (phase === "proctor") {
    return (
      <ProctorGate
        quizTitle={"Eye Gaze Assessment"}
        onAuthorized={() => setPhase("loading")}
      />
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
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800 }}>
          {passed ? "Great Job!" : "Nice Try!"}
        </h1>
        <div style={{ fontSize: "3rem", fontWeight: 700, color: passed ? "hsl(21 100% 50%)" : "hsl(0 0% 66%)" }}>
          {result.score}/{result.total}
        </div>
        <p style={{ fontSize: "1.5rem", color: "hsl(0 0% 66%)" }}>
          {Math.round(result.pct)}% correct
        </p>
        {result.passed && result.pointsEarned ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "hsl(21 100% 50% / 0.15)", padding: "0.75rem 1.5rem", borderRadius: "0.75rem" }}>
            <Trophy size={24} color="hsl(21 100% 50%)" />
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "hsl(21 100% 50%)" }}>+{result.pointsEarned} points earned!</span>
          </div>
        ) : null}
        <button onClick={() => navigate("/library")} className="btn btn-primary" style={{ fontSize: "1.5rem", padding: "1.25rem 2.5rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "hsl(21 100% 50%)", color: "hsl(0 0% 0%)", border: "none", borderRadius: "0.5rem", cursor: "pointer", textDecoration: "none" }}>
          <ArrowLeft size={28} /> Back to Quizzes
        </button>
      </div>
    );
  }

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
        <button onClick={() => navigate("/library")} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "hsl(0 0% 66%)", fontSize: "1rem", textDecoration: "none", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={20} /> Exit
        </button>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* TTS Toggle */}
          <button
            onClick={() => {
              const next = !ttsEnabled;
              setTtsEnabled(next);
              if (!next) stopSpeaking();
              else if (quiz?.questions?.[currentIdx]) {
                const q = quiz.questions[currentIdx];
                const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
                speakQuestion(q.prompt, opts.join(" "));
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

      {/* Large answer buttons - 2x2 grid */}
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
          return (
            <button
              key={opt.letter}
              onClick={() => handleSelectAnswer(opt.letter)}
              disabled={!!selectedAnswer}
              style={{
                padding: "2rem 1rem",
                fontSize: "1.5rem",
                fontWeight: 600,
                borderRadius: "1rem",
                border: isSelected ? "3px solid hsl(21 100% 50%)" : "2px solid hsl(0 0% 20%)",
                background: isSelected ? "hsl(21 100% 50%)" : "hsl(0 0% 14%)",
                color: isSelected ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)",
                cursor: selectedAnswer ? "default" : "pointer",
                transition: "all 0.2s ease",
                minHeight: "120px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
              }}
            >
              {isSelected && <CheckCircle2 size={28} />}
              {opt.text}
            </button>
          );
        })}
      </div>

      {/* Auto-advance indicator */}
      {autoAdvancing && (
        <div style={{
          textAlign: "center",
          padding: "0.5rem",
          color: "hsl(0 0% 66%)",
          fontSize: "1rem",
        }}>
          {currentIdx < quiz.questions.length - 1 ? "Moving to next question..." : "Submitting..."}
        </div>
      )}
    </div>
  );
}
