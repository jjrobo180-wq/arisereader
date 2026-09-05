import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle2, Trophy, RotateCcw, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ProctorGate } from "@/components/ProctorGate";

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

interface CustomQuestion {
  id: number;
  prompt: string;
  question_image: string | null;
  option_a_text: string;
  option_a_image: string | null;
  option_b_text: string;
  option_b_image: string | null;
  option_c_text: string;
  option_c_image: string | null;
  option_d_text: string;
  option_d_image: string | null;
  question_order: number;
}

interface CustomQuiz {
  id: number;
  title: string;
  description: string;
  level: string;
  questions: CustomQuestion[];
  attemptId?: number;
}

export default function CustomEyeGazeQuiz() {
  const { id } = useParams<{ id: string }>();
  const quizId = parseInt(id || "0");
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<"proctor" | "loading" | "quiz" | "results">("proctor");
  const [quiz, setQuiz] = useState<CustomQuiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    if (phase !== "loading") return;
    const token = getTokenFromCookie();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE}/api/custom-quizzes/${quizId}/start`, {
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
  }, [quizId, user]);

  const handleSelectAnswer = (answer: string) => {
    if (selectedAnswer || autoAdvancing) return;
    const currentQ = quiz?.questions[currentIdx];
    if (!currentQ) return;
    setSelectedAnswer(answer);
    setAutoAdvancing(true);

    const newAnswers = { ...answers, [currentQ.id]: answer };
    setAnswers(newAnswers);

    advanceTimer.current = setTimeout(() => {
      if (currentIdx < (quiz?.questions?.length || 0) - 1) {
        setCurrentIdx((idx) => idx + 1);
        setSelectedAnswer(null);
        setAutoAdvancing(false);
      } else {
        submitQuiz(newAnswers);
      }
    }, 1500);
  };

  const submitQuiz = (finalAnswers: Record<number, string>) => {
    const token = getTokenFromCookie();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE}/api/custom-quizzes/${quiz.attemptId}/submit`, {
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
          <Trophy size={80} color="hsl(21 100% 50%)" />
        ) : (
          <RotateCcw size={80} color="hsl(0 0% 66%)" />
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
    { letter: "A", text: currentQ.option_a_text, image: currentQ.option_a_image },
    { letter: "B", text: currentQ.option_b_text, image: currentQ.option_b_image },
    { letter: "C", text: currentQ.option_c_text, image: currentQ.option_c_image },
    { letter: "D", text: currentQ.option_d_text, image: currentQ.option_d_image },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <button onClick={() => navigate("/library")} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "hsl(0 0% 66%)", fontSize: "1rem", textDecoration: "none", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={20} /> Exit
        </button>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
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

      {/* Large visual - question image or emoji */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: "1.5rem",
      }}>
        {currentQ.question_image ? (
          <img
            src={currentQ.question_image}
            alt="Question"
            style={{
              maxWidth: "400px",
              maxHeight: "350px",
              borderRadius: "1rem",
              border: "2px solid hsl(0 0% 20%)",
              objectFit: "contain",
              background: "hsl(0 0% 14%)",
            }}
          />
        ) : (
          <div style={{
            fontSize: "8rem",
            lineHeight: 1,
            padding: "1rem",
            background: "hsl(0 0% 14%)",
            borderRadius: "1rem",
            border: "2px solid hsl(0 0% 20%)",
          }}>
            📖
          </div>
        )}
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
          const hasContent = opt.text || opt.image;
          if (!hasContent) return null;
          return (
            <button
              key={opt.letter}
              onClick={() => handleSelectAnswer(opt.letter)}
              disabled={!!selectedAnswer}
              style={{
                padding: opt.image ? "1rem" : "2rem 1rem",
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
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              {isSelected && <CheckCircle2 size={28} style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }} />}
              {opt.image && (
                <img
                  src={opt.image}
                  alt={`Option ${opt.letter}`}
                  style={{
                    maxWidth: "200px",
                    maxHeight: "150px",
                    borderRadius: "0.5rem",
                    objectFit: "contain",
                  }}
                />
              )}
              {opt.text && <span>{opt.text}</span>}
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
