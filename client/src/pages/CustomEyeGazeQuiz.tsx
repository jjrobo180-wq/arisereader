import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle2, Trophy, RotateCcw, ArrowLeft, Volume2, VolumeX, Gamepad2, Image as ImageIcon, Footprints, Shield, Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { speakQuestion, speakOption, stopSpeaking, initVoices } from "@/lib/tts";
import Celebration, { CelebrationStyle } from "@/components/Celebration";

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

function getEyeGazeLaunchMode(): "quiz" | "picture" | "story" | "boss" | null {
  try {
    const query = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
    const mode = new URLSearchParams(query).get("mode");
    return mode === "quiz" || mode === "picture" || mode === "story" || mode === "boss" ? mode : null;
  } catch {
    return null;
  }
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
  const { user, token: authToken } = useAuth();
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<"loading" | "quiz" | "results">("loading");
  const [quiz, setQuiz] = useState<CustomQuiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [subtitle, setSubtitle] = useState("");
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const [celebrationStyle, setCelebrationStyle] = useState<CelebrationStyle>("confetti");
  const launchMode = getEyeGazeLaunchMode();
  const [gameMode, setGameMode] = useState<"picture" | "story" | "boss">(launchMode && launchMode !== "quiz" ? launchMode : "picture");
  const [showGamePicker, setShowGamePicker] = useState(!launchMode);
  const isPlainQuiz = launchMode === "quiz";
  const [bossHealth, setBossHealth] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<"correct" | "try" | null>(null);
  const correctButtonRef = useRef<HTMLElement | null>(null);

  // Spectator mode for teachers/admins
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.isAdmin;
  const [spectatorQuestions, setSpectatorQuestions] = useState<any[]>([]);
  const [spectatorLoading, setSpectatorLoading] = useState(false);

  // Fetch spectator data for teachers/admins
  useEffect(() => {
    if (!isTeacherOrAdmin || !quizId) return;
    setSpectatorLoading(true);
    const token = authToken || getTokenFromCookie();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`${API_BASE}/api/custom-quizzes/${quizId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.questions) setSpectatorQuestions(d.questions); })
      .catch(() => {})
      .finally(() => setSpectatorLoading(false));
  }, [isTeacherOrAdmin, quizId, authToken]);

  // Spectator mode render for teachers/admins
  if (isTeacherOrAdmin && (spectatorLoading || spectatorQuestions.length > 0)) {
    if (spectatorLoading) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "hsl(0 0% 10%)", color: "hsl(0 0% 96%)" }}>
          <p>Loading quiz (Spectator Mode)...</p>
        </div>
      );
    }
    return (
      <div style={{ minHeight: "100vh", padding: 16, background: "hsl(0 0% 10%)", color: "hsl(0 0% 96%)", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button onClick={() => navigate("/library")} style={{ background: "none", border: 0, color: "hsl(0 0% 60%)", cursor: "pointer", fontSize: 16 }}>← Back</button>
            <span style={{ padding: "4px 10px", borderRadius: 6, background: "hsl(200 80% 40% / 0.2)", color: "hsl(200 80% 70%)", fontSize: 13, fontWeight: 700 }}>Spectator Mode (Read-Only)</span>
          </div>
          {spectatorQuestions.map((q: any, i: number) => (
            <div key={i} style={{ background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <p style={{ fontWeight: 600, marginBottom: 12 }}><span style={{ color: "hsl(21 100% 50%)" }}>Q{i + 1}.</span> {q.prompt}</p>
              {q.question_image && (q.question_image.startsWith("http") || q.question_image.startsWith("data:")) && <img src={q.question_image} alt="Question" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, marginBottom: 8 }} />}
              {q.question_image && !(q.question_image.startsWith("http") || q.question_image.startsWith("data:")) && <span style={{ fontSize: 40, display: "block", marginBottom: 8 }}>{q.question_image}</span>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {['a', 'b', 'c', 'd'].map(opt => {
                  const text = q[`option_${opt}_text`];
                  const img = q[`option_${opt}_image`];
                  if (!text && !img) return null;
                  return (
                    <div key={opt} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, background: "hsl(0 0% 10%)" }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "hsl(0 0% 20%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{opt.toUpperCase()}</span>
                      {img && <img src={img} alt="Option" style={{ width: 40, height: 40, borderRadius: 6 }} />}
                      {text && <span style={{ fontSize: 14 }}>{text}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={() => navigate("/library")} style={{ background: "none", border: "1px solid hsl(0 0% 30%)", borderRadius: 8, color: "hsl(0 0% 80%)", padding: "8px 16px", cursor: "pointer", marginTop: 8 }}>Back to Library</button>
        </div>
      </div>
    );
  }

  // Initialize voices
  useEffect(() => {
    initVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = () => initVoices();
    }
    return () => stopSpeaking();
  }, []);

  // Load celebration preference
  useEffect(() => {
    const token = authToken || getTokenFromCookie();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`${API_BASE}/api/eye-gaze/celebration-style`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.style) setCelebrationStyle(d.style); })
      .catch(() => {});
  }, [authToken]);

  // Speak question when it changes
  useEffect(() => {
    if (phase === "quiz" && quiz && quiz.questions[currentIdx] && ttsEnabled) {
      const q = quiz.questions[currentIdx];
      const visual = q.visual || "";
      speakQuestion(q.prompt, visual, (text) => setSubtitle(text));
    }
    return () => {
      stopSpeaking();
      setSubtitle("");
    };
  }, [currentIdx, phase, quiz, ttsEnabled]);

  useEffect(() => {
    if (!user) return;
    if (phase !== "loading") return;
    const token = authToken || getTokenFromCookie();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE}/api/custom-quizzes/${quizId}/start`, {
      method: "POST",
      headers,
    })
      .then((r) => {
        if (r.status === 400 || r.status === 401) {
          return r.json().then((d) => {
            setError(d.message || "You need to be logged in to take this quiz.");
            return null;
          });
        }
        return r.json();
      })
      .then((data) => {
        if (data && data.questions) {
          setQuiz({ ...data, attemptId: data.attemptId });
          setBossHealth(data.questions.length);
          setPhase("quiz");
        }
      })
      .catch(() => setError("Failed to load quiz"));
  }, [quizId, user, phase, authToken]);

  const handleSelectAnswer = (answer: string, buttonEl?: HTMLElement) => {
    if (autoAdvancing) return;
    const currentQ = quiz?.questions[currentIdx];
    if (!currentQ) return;
    // Allow changing selection — just set the selected answer
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || autoAdvancing) return;
    const currentQ = quiz?.questions[currentIdx];
    if (!currentQ) return;
    setAutoAdvancing(true);

    // Check if answer is correct and trigger celebration
    const correctAnswer = (currentQ as any).correct_answer || "";
    const isCorrect = !!correctAnswer && selectedAnswer === correctAnswer;
    if (isCorrect) {
      setCelebrationTrigger((t) => t + 1);
      setBossHealth((hp) => Math.max(0, hp - 1));
      setLastFeedback("correct");
    } else {
      setLastFeedback("try");
    }
    window.setTimeout(() => setLastFeedback(null), 900);

    const newAnswers = { ...answers, [currentQ.id]: selectedAnswer };
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
    const token = authToken || getTokenFromCookie();
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
          {passed ? (isPlainQuiz ? "Great Job!" : gameMode === "boss" ? "Boss Defeated!" : gameMode === "story" ? "Quest Complete!" : "Picture Hunt Complete!") : "Great Try!"}
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

  if (showGamePicker) {
    const modes = [
      { id: "picture" as const, title: "Picture Hunt", subtitle: "Look, read, and choose the matching picture.", icon: <ImageIcon size={42} /> },
      { id: "story" as const, title: "Story Quest", subtitle: "Move along the reading path one challenge at a time.", icon: <Footprints size={42} /> },
      { id: "boss" as const, title: "Boss Battle", subtitle: "Correct answers take health away from the reading boss.", icon: <Shield size={42} /> },
    ];
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-6">
            <Gamepad2 className="w-14 h-14 text-primary mx-auto mb-3" />
            <h1 className="text-3xl font-black">Choose Your Reading Game</h1>
            <p className="text-muted-foreground mt-2">Pick how you want to play this quiz.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {modes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => { setGameMode(mode.id); setShowGamePicker(false); }}
                className="min-h-[220px] rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all p-5 text-center flex flex-col items-center justify-center gap-3"
              >
                <div className="w-20 h-20 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">{mode.icon}</div>
                <div className="font-black text-xl">{mode.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{mode.subtitle}</div>
              </button>
            ))}
          </div>
          <button onClick={() => navigate("/library")} className="mt-6 mx-auto block text-sm text-muted-foreground hover:text-foreground">Exit</button>
        </div>
      </div>
    );
  }

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

      {!isPlainQuiz && <div className="max-w-3xl w-full mx-auto mb-4">
        {gameMode === "boss" && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="font-black flex items-center gap-2"><Shield className="w-5 h-5 text-red-400" /> Reading Boss</span>
              <span className="text-sm font-bold">{bossHealth} HP left</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${Math.max(0, (bossHealth / Math.max(1, quiz.questions.length)) * 100)}%` }} />
            </div>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: Math.min(8, bossHealth) }).map((_, i) => <Heart key={i} className="w-4 h-4 text-red-400 fill-current" />)}
            </div>
          </div>
        )}
        {gameMode === "story" && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-center justify-between">
              <span className="font-black flex items-center gap-2"><Footprints className="w-5 h-5 text-blue-400" /> Story Quest</span>
              <span className="text-sm font-bold">Stop {currentIdx + 1} of {quiz.questions.length}</span>
            </div>
            <div className="flex items-center gap-1 mt-3">
              {quiz.questions.map((_: any, i: number) => (
                <div key={i} className={`h-3 flex-1 rounded-full ${i < currentIdx ? "bg-green-500" : i === currentIdx ? "bg-blue-500" : "bg-muted"}`} />
              ))}
            </div>
          </div>
        )}
        {gameMode === "picture" && (
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-center">
            <span className="font-black flex items-center justify-center gap-2"><ImageIcon className="w-5 h-5 text-purple-400" /> Picture Hunt</span>
          </div>
        )}
      </div>}

      {/* Question prompt */}
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "hsl(0 0% 100%)" }}>
          {currentQ.prompt}
        </h2>
        {ttsEnabled && (
          <button
            onClick={() => {
              const q = quiz.questions[currentIdx];
              const visual = q.visual || "";
              speakQuestion(q.prompt, visual, (text) => setSubtitle(text));
            }}
            style={{ marginTop: "0.5rem", background: "none", border: "1px solid hsl(0 0% 30%)", borderRadius: "0.5rem", padding: "0.3rem 0.75rem", color: "hsl(0 0% 66%)", fontSize: "0.85rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
            title="Hear question again"
          >
            <Volume2 size={14} /> Replay
          </button>
        )}
      </div>

      {/* Large visual - question image only if available */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: "1.5rem",
      }}>
        {currentQ.question_image ? (
          currentQ.question_image.startsWith("http") || currentQ.question_image.startsWith("data:") ? (
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
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
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
              {currentQ.question_image}
            </div>
          )
        ) : null}
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
          const isHovered = hoveredOption === opt.letter;
          return (
            <button
              key={opt.letter}
              onClick={(e) => handleSelectAnswer(opt.letter, e.currentTarget)}
              onMouseEnter={() => {
                if (!ttsEnabled || selectedAnswer || autoAdvancing) return;
                setHoveredOption(opt.letter);
                if (opt.text) speakOption(opt.text, (sub) => setSubtitle(sub));
              }}
              onMouseLeave={() => {
                if (!ttsEnabled || selectedAnswer || autoAdvancing) return;
                setHoveredOption(null);
                stopSpeaking();
                setSubtitle("");
              }}
              disabled={!!selectedAnswer}
              style={{
                padding: opt.image ? "1rem" : "2rem 1rem",
                fontSize: "1.5rem",
                fontWeight: 600,
                borderRadius: "1rem",
                border: isSelected ? "3px solid hsl(21 100% 50%)" : isHovered ? "2px solid hsl(21 100% 50% / 0.5)" : "2px solid hsl(0 0% 20%)",
                background: isSelected ? "hsl(21 100% 50%)" : isHovered ? "hsl(21 100% 50% / 0.08)" : "hsl(0 0% 14%)",
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
                    width: gameMode === "picture" ? "100%" : "auto",
                    maxWidth: gameMode === "picture" ? "240px" : "200px",
                    height: gameMode === "picture" ? "150px" : "auto",
                    maxHeight: "150px",
                    borderRadius: "0.75rem",
                    objectFit: "cover",
                    border: gameMode === "picture" ? "2px solid hsl(0 0% 30%)" : "none",
                  }}
                />
              )}
              {opt.text && <span>{opt.text}</span>}
            </button>
          );
        })}
      </div>

      {lastFeedback && (
        <div className={`fixed inset-x-4 top-24 z-50 mx-auto max-w-md rounded-2xl border-2 p-5 text-center shadow-2xl ${lastFeedback === "correct" ? "bg-green-600 border-green-300 text-white" : "bg-card border-amber-400 text-foreground"}`}>
          <div className="text-4xl mb-1">{lastFeedback === "correct" ? "⭐" : "💪"}</div>
          <div className="text-xl font-black">{lastFeedback === "correct" ? (gameMode === "boss" ? "HIT!" : "You got it!") : "Keep going!"}</div>
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

      {/* Submit button - shows when user has selected an answer */}
      {selectedAnswer && !autoAdvancing && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          padding: "1rem 0 0.5rem",
        }}>
          <button
            onClick={handleSubmitAnswer}
            style={{
              padding: "1.25rem 3rem",
              fontSize: "1.5rem",
              fontWeight: 800,
              borderRadius: "1rem",
              border: "none",
              background: "hsl(21 100% 50%)",
              color: "hsl(0 0% 0%)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 15px hsl(21 100% 50% / 0.4)",
            }}
          >
            ✓ Submit Answer
          </button>
        </div>
      )}
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

      {/* Celebration animation on correct answer */}
      <Celebration style={celebrationStyle} trigger={celebrationTrigger} targetRef={correctButtonRef} />
    </div>
  );
}
