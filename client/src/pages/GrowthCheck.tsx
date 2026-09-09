import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BrandText } from "@/components/BrandText";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Brain,
  Target,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Send,
  Award,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  ClipboardList,
  Lightbulb,
  Calendar,
  Info,
} from "lucide-react";

// ─── Auth helpers ─────────────────────────────────────────────────────
const SESSION_COOKIE = "arise_session";
function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (const c of cookies) {
      const trimmed = c.trim();
      if (trimmed.startsWith(SESSION_COOKIE + "=")) {
        const raw = trimmed.substring(SESSION_COOKIE.length + 1);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────

interface GrowthCheckItem {
  id: number;
  question_text: string;
  question_type: "multiple_choice" | "short_response";
  options_json: string[];
  primary_skill: string;
  secondary_skills_json: string[];
  points: number;
}

interface GrowthCheckPassage {
  id: number;
  title: string;
  passage_text: string;
  genre: string;
  grade_band: string;
  items: GrowthCheckItem[];
}

interface GrowthCheckForm {
  id: number;
  grade_band: string;
  title: string;
  pilot_label?: string;
  passages: GrowthCheckPassage[];
}

interface GrowthCheckAttempt {
  id: number;
  status: "not_started" | "in_progress" | "completed";
  started_at?: string;
  submitted_at?: string;
  arise_reading_score?: number;
  raw_score?: number;
  max_score?: number;
  skill_summary_json?: SkillSummary[];
  student_summary?: string;
  next_steps_json?: NextStep[];
}

interface SkillSummary {
  skill: string;
  skillName: string;
  correct: number;
  total: number;
  pct: number;
  level: "strength" | "developing" | "practice" | "more_evidence";
}

interface NextStep {
  skill: string;
  level: string;
  action: string;
}

interface CurrentResponse {
  available: boolean;
  message?: string;
  window?: {
    window_name: string;
    school_year: string;
    start_date?: string;
    end_date?: string;
  };
  form?: GrowthCheckForm;
  attempt?: GrowthCheckAttempt;
  responses?: Record<number, any>;
}

interface ResultsResponse {
  available: boolean;
  latest?: GrowthCheckAttempt;
  previous?: GrowthCheckAttempt | null;
  scoreChange?: number;
  skillSummary?: SkillSummary[];
  quizAccuracy?: number;
  allAttempts?: GrowthCheckAttempt[];
}

interface SubmitResponse {
  attempt: GrowthCheckAttempt;
  skillSummary: SkillSummary[];
  studentSummary: string;
  nextSteps: NextStep[];
}

type Phase = "loading" | "landing" | "assessment" | "results";

// ─── Constants ────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0a0a0a",
  card: "#1a1a1a",
  cardHover: "#222222",
  border: "#333333",
  teal: "#14b8a6",
  gold: "#fbbf24",
  text: "#f5f5f5",
  textMuted: "#999999",
  green: "#22c55e",
  blue: "#3b82f6",
  orange: "#f97316",
  gray: "#6b7280",
};

const SKILL_LEVEL_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; message: string }
> = {
  strength: {
    label: "Strength",
    color: COLORS.green,
    bgColor: "rgba(34, 197, 94, 0.12)",
    message: "Strong skill",
  },
  developing: {
    label: "Developing",
    color: COLORS.blue,
    bgColor: "rgba(59, 130, 246, 0.12)",
    message: "Building this skill",
  },
  practice: {
    label: "Practice Recommended",
    color: COLORS.orange,
    bgColor: "rgba(249, 115, 22, 0.12)",
    message: "Keep practicing",
  },
  more_evidence: {
    label: "More Evidence Needed",
    color: COLORS.gray,
    bgColor: "rgba(107, 114, 128, 0.12)",
    message: "We need more information",
  },
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// ─── Helper: Circular Score Gauge ────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const min = 100;
  const max = 900;
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)));
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - pct);
  const color =
    score >= 700
      ? COLORS.green
      : score >= 500
        ? COLORS.teal
        : score >= 300
          ? COLORS.gold
          : COLORS.orange;

  return (
    <div
      style={{
        position: "relative",
        width: 220,
        height: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto",
      }}
    >
      <svg width={220} height={220} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={110}
          cy={110}
          r={90}
          fill="none"
          stroke={COLORS.border}
          strokeWidth={14}
        />
        {/* Progress arc */}
        <circle
          cx={110}
          cy={110}
          r={90}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: "stroke-dashoffset 1.2s ease",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: COLORS.text,
            lineHeight: 1,
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            marginTop: 4,
          }}
        >
          Arise Reading Score
        </span>
        <span
          style={{
            fontSize: 11,
            color: COLORS.textMuted,
            marginTop: 2,
          }}
        >
          Scale: 100 – 900
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export default function GrowthCheck() {
  const { token: authToken, user } = useAuth();
  const token = authToken || getTokenFromCookie();
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("loading");
  const [currentData, setCurrentData] = useState<CurrentResponse | null>(null);
  const [resultsData, setResultsData] = useState<ResultsResponse | null>(null);
  const [submitResponse, setSubmitResponse] = useState<SubmitResponse | null>(
    null,
  );
  const [currentPassageIdx, setCurrentPassageIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Fetch current growth check status ─────────────────────────────
  const fetchCurrent = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/growth-check/current", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: CurrentResponse = await res.json();

      if (!data.available) {
        // No active window — check results
        await fetchResults();
        return;
      }

      setCurrentData(data);

      // Restore answers from existing responses
      if (data.responses) {
        const restored: Record<number, string> = {};
        for (const [itemId, resp] of Object.entries(data.responses)) {
          const r = resp as any;
          if (r.response_json?.answer) {
            restored[Number(itemId)] = r.response_json.answer;
          }
        }
        setAnswers(restored);
      }

      // Determine phase
      if (data.attempt?.status === "completed") {
        await fetchResults();
      } else if (
        data.attempt?.status === "in_progress" &&
        Object.keys(data.responses || {}).length > 0
      ) {
        setPhase("assessment");
      } else {
        setPhase("landing");
      }
    } catch {
      setError("Could not load the Growth Check. Please try again.");
      setPhase("landing");
    }
  };

  // ─── Fetch results ──────────────────────────────────────────────────
  const fetchResults = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/growth-check/results", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ResultsResponse = await res.json();
      if (data.available) {
        setResultsData(data);
        setPhase("results");
      } else {
        setPhase("landing");
      }
    } catch {
      setPhase("landing");
    }
  };

  useEffect(() => {
    fetchCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ─── Start the assessment ───────────────────────────────────────────
  const handleStart = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/growth-check/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Could not start the Growth Check.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (currentData) {
        setCurrentData({ ...currentData, attempt: data.attempt });
      }
      setCurrentPassageIdx(0);
      setPhase("assessment");
    } catch {
      setError("Could not start the Growth Check. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Submit the assessment ──────────────────────────────────────────
  const handleSubmit = async () => {
    if (!token || !currentData?.attempt) return;
    setLoading(true);
    setError("");
    try {
      const responses = Object.entries(answers).map(([itemId, answer]) => ({
        itemId: Number(itemId),
        answer,
      }));

      const res = await fetch("/api/growth-check/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptId: currentData.attempt.id,
          responses,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Could not submit the Growth Check.");
        setLoading(false);
        return;
      }

      const data: SubmitResponse = await res.json();
      setSubmitResponse(data);
      setPhase("results");
    } catch {
      setError("Could not submit the Growth Check. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Answer handling ────────────────────────────────────────────────
  const handleAnswer = (itemId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: answer }));
  };

  // ─── Derived values ─────────────────────────────────────────────────
  const passages = currentData?.form?.passages || [];
  const currentPassage = passages[currentPassageIdx];
  const isLastPassage = currentPassageIdx >= passages.length - 1;
  const answeredCount = Object.keys(answers).length;
  const totalItems = passages.reduce(
    (sum, p) => sum + (p.items?.length || 0),
    0,
  );

  // ─── Loading phase ──────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: `4px solid ${COLORS.border}`,
              borderTopColor: COLORS.teal,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: COLORS.textMuted, fontSize: 14 }}>
            Loading your Growth Check...
          </p>
        </div>
      </div>
    );
  }

  // ─── Landing phase ──────────────────────────────────────────────────
  if (phase === "landing") {
    const windowName = currentData?.window?.window_name || "Benchmark";
    const schoolYear = currentData?.window?.school_year || "";
    const pilotLabel = currentData?.form?.pilot_label || "Pilot";

    return (
      <div style={{ minHeight: "100vh", backgroundColor: COLORS.bg }}>
        {/* Header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            backgroundColor: "rgba(26, 26, 26, 0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              maxWidth: 960,
              margin: "0 auto",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 64,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() =>
                  navigate(user?.isAdmin ? "/admin" : "/library")
                }
                style={{
                  color: COLORS.textMuted,
                  fontSize: 14,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <span style={{ color: COLORS.textMuted }}>|</span>
              <BrandText />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "32px 16px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            {/* Icon */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: "rgba(20, 184, 166, 0.1)",
                marginBottom: 16,
              }}
            >
              <BookOpen
                style={{ width: 32, height: 32, color: COLORS.teal }}
              />
            </div>

            {/* Title with Pilot badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: COLORS.text,
                  margin: 0,
                }}
              >
                Arise Reading Growth Check
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: "rgba(251, 191, 36, 0.15)",
                  color: COLORS.gold,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: `1px solid rgba(251, 191, 36, 0.3)`,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                <Sparkles style={{ width: 12, height: 12 }} />
                {pilotLabel}
              </span>
            </div>

            {/* Window info */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: COLORS.textMuted,
                fontSize: 14,
                marginTop: 4,
              }}
            >
              <Calendar style={{ width: 14, height: 14 }} />
              <span>
                {windowName} Benchmark
                {schoolYear ? ` • ${schoolYear}` : ""}
              </span>
            </div>
          </div>

          {/* Intro card */}
          <div
            style={{
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              padding: 28,
              marginBottom: 24,
            }}
          >
            <p
              style={{
                color: COLORS.text,
                fontSize: 16,
                lineHeight: 1.7,
                marginBottom: 16,
              }}
            >
              The Growth Check is a short reading check-in that helps you see
              how your reading skills are growing. You'll read a few passages
              and answer questions about them.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: "rgba(20, 184, 166, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BookOpen
                    style={{ width: 14, height: 14, color: COLORS.teal }}
                  />
                </div>
                <div>
                  <p
                    style={{
                      color: COLORS.text,
                      fontSize: 14,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    Read each passage carefully
                  </p>
                  <p
                    style={{
                      color: COLORS.textMuted,
                      fontSize: 13,
                      margin: "2px 0 0",
                    }}
                  >
                    Take your time — there's no rush.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: "rgba(251, 191, 36, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Target
                    style={{ width: 14, height: 14, color: COLORS.gold }}
                  />
                </div>
                <div>
                  <p
                    style={{
                      color: COLORS.text,
                      fontSize: 14,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    Answer questions about what you read
                  </p>
                  <p
                    style={{
                      color: COLORS.textMuted,
                      fontSize: 13,
                      margin: "2px 0 0",
                    }}
                  >
                    Some are multiple choice, some ask you to write a response.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TrendingUp
                    style={{ width: 14, height: 14, color: COLORS.green }}
                  />
                </div>
                <div>
                  <p
                    style={{
                      color: COLORS.text,
                      fontSize: 14,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    See your results and next steps
                  </p>
                  <p
                    style={{
                      color: COLORS.textMuted,
                      fontSize: 13,
                      margin: "2px 0 0",
                    }}
                  >
                    Your score is a snapshot of your reading skills — not a
                    grade.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "12px 16px",
              backgroundColor: "rgba(20, 184, 166, 0.06)",
              border: `1px solid rgba(20, 184, 166, 0.2)`,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <Info
              style={{
                width: 16,
                height: 16,
                color: COLORS.teal,
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <p
              style={{
                color: COLORS.textMuted,
                fontSize: 13,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              This is a pilot program. Your Growth Check helps your teacher
              understand how to support you as a reader. Every reader grows at
              their own pace.
            </p>
          </div>

          {/* Start button */}
          <div style={{ textAlign: "center" }}>
            {error && (
              <p
                style={{
                  color: COLORS.orange,
                  fontSize: 14,
                  marginBottom: 12,
                }}
              >
                {error}
              </p>
            )}
            <Button
              size="lg"
              onClick={handleStart}
              disabled={loading}
              style={{
                backgroundColor: COLORS.teal,
                color: "#fff",
                padding: "12px 32px",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              <BookOpen style={{ width: 18, height: 18, marginRight: 8 }} />
              Start Growth Check
              <ArrowRight
                style={{ width: 16, height: 16, marginLeft: 8 }}
              />
            </Button>
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => navigate("/library")}
                style={{
                  color: COLORS.textMuted,
                  fontSize: 13,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Skip for now — you can take it later
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Assessment phase ───────────────────────────────────────────────
  if (phase === "assessment" && currentPassage) {
    const passageItems = currentPassage.items || [];
    const passageAnswered = passageItems.filter(
      (item) => answers[item.id],
    ).length;

    return (
      <div style={{ minHeight: "100vh", backgroundColor: COLORS.bg }}>
        {/* Header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            backgroundColor: "rgba(26, 26, 26, 0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              maxWidth: 800,
              margin: "0 auto",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 56,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
                color: COLORS.text,
              }}
            >
              <BookOpen
                style={{ width: 16, height: 16, color: COLORS.teal }}
              />
              Arise Reading Growth Check
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: "rgba(251, 191, 36, 0.15)",
                color: COLORS.gold,
                padding: "2px 8px",
                borderRadius: 999,
                border: `1px solid rgba(251, 191, 36, 0.3)`,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Pilot
            </span>
          </div>
        </header>

        {/* Progress bar */}
        <div
          style={{
            backgroundColor: COLORS.card,
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "10px 16px",
          }}
        >
          <div
            style={{
              maxWidth: 800,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: COLORS.textMuted,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Passage {currentPassageIdx + 1} of {passages.length}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                backgroundColor: COLORS.border,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${
                    ((currentPassageIdx + 1) / passages.length) * 100
                  }%`,
                  height: "100%",
                  backgroundColor: COLORS.teal,
                  borderRadius: 999,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 13,
                color: COLORS.textMuted,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {answeredCount}/{totalItems} answered
            </span>
          </div>
        </div>

        {/* Main content */}
        <main
          style={{
            maxWidth: 800,
            margin: "0 auto",
            padding: "24px 16px 48px",
          }}
        >
          {/* Passage */}
          <div
            style={{
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: COLORS.teal,
                  backgroundColor: "rgba(20, 184, 166, 0.1)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                <BookOpen style={{ width: 12, height: 12 }} />
                {currentPassage.genre || "Reading"}
              </span>
              {currentPassage.grade_band && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                    backgroundColor: COLORS.border,
                    padding: "3px 8px",
                    borderRadius: 6,
                  }}
                >
                  Grades {currentPassage.grade_band}
                </span>
              )}
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.text,
                marginBottom: 16,
                margin: "0 0 16px",
              }}
            >
              {currentPassage.title}
            </h2>
            <div
              style={{
                color: COLORS.text,
                fontSize: 15,
                lineHeight: 1.8,
                whiteSpace: "pre-wrap",
              }}
            >
              {currentPassage.passage_text}
            </div>
          </div>

          {/* Questions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {passageItems.map((item, idx) => {
              const selectedAnswer = answers[item.id] || "";
              const isMultiple =
                item.question_type === "multiple_choice";
              const options = item.options_json || [];

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: COLORS.card,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 16,
                    padding: 20,
                  }}
                >
                  {/* Question header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        backgroundColor: "rgba(20, 184, 166, 0.12)",
                        color: COLORS.teal,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <p
                      style={{
                        color: COLORS.text,
                        fontSize: 15,
                        fontWeight: 600,
                        lineHeight: 1.5,
                        margin: "4px 0 0",
                      }}
                    >
                      {item.question_text}
                    </p>
                  </div>

                  {/* Multiple choice options */}
                  {isMultiple ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        paddingLeft: 38,
                      }}
                    >
                      {options.map((option, optIdx) => {
                        const letter = LETTERS[optIdx];
                        const isSelected = selectedAnswer === letter;
                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleAnswer(item.id, letter)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: `1px solid ${
                                isSelected
                                  ? COLORS.teal
                                  : COLORS.border
                              }`,
                              backgroundColor: isSelected
                                ? "rgba(20, 184, 166, 0.1)"
                                : "rgba(255,255,255,0.02)",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span
                              style={{
                                flexShrink: 0,
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                border: `2px solid ${
                                  isSelected
                                    ? COLORS.teal
                                    : COLORS.border
                                }`,
                                backgroundColor: isSelected
                                  ? COLORS.teal
                                  : "transparent",
                                color: isSelected ? "#fff" : COLORS.textMuted,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {letter}
                            </span>
                            <span
                              style={{
                                color: COLORS.text,
                                fontSize: 14,
                                lineHeight: 1.4,
                              }}
                            >
                              {option}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ paddingLeft: 38 }}>
                      <Textarea
                        value={selectedAnswer}
                        onChange={(e: any) =>
                          handleAnswer(item.id, e.target.value)
                        }
                        placeholder="Type your answer here..."
                        style={{
                          width: "100%",
                          minHeight: 80,
                          backgroundColor: "rgba(255,255,255,0.03)",
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 10,
                          color: COLORS.text,
                          fontSize: 14,
                          padding: 12,
                          resize: "vertical",
                        }}
                      />
                    </div>
                  )}

                  {/* Answered indicator */}
                  {selectedAnswer && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 10,
                        paddingLeft: 38,
                        color: COLORS.green,
                        fontSize: 12,
                      }}
                    >
                      <CheckCircle2 style={{ width: 14, height: 14 }} />
                      <span>Answered</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {/* Previous button */}
            {currentPassageIdx > 0 ? (
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPassageIdx(currentPassageIdx - 1)
                }
                style={{
                  borderColor: COLORS.border,
                  color: COLORS.text,
                  backgroundColor: COLORS.card,
                }}
              >
                <ChevronLeft
                  style={{ width: 16, height: 16, marginRight: 4 }}
                />
                Previous
              </Button>
            ) : (
              <div />
            )}

            {/* Next / Submit button */}
            {isLastPassage ? (
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={loading || answeredCount === 0}
                style={{
                  backgroundColor: COLORS.teal,
                  color: "#fff",
                  fontWeight: 700,
                  padding: "10px 24px",
                }}
              >
                <Send style={{ width: 16, height: 16, marginRight: 8 }} />
                {loading ? "Submitting..." : "Submit Growth Check"}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() =>
                  setCurrentPassageIdx(currentPassageIdx + 1)
                }
                style={{
                  backgroundColor: COLORS.teal,
                  color: "#fff",
                  fontWeight: 700,
                  padding: "10px 24px",
                }}
              >
                Next Passage
                <ChevronRight
                  style={{ width: 16, height: 16, marginLeft: 4 }}
                />
              </Button>
            )}
          </div>

          {error && (
            <p
              style={{
                color: COLORS.orange,
                fontSize: 14,
                textAlign: "center",
                marginTop: 16,
              }}
            >
              {error}
            </p>
          )}

          {/* Unanswered warning */}
          {!isLastPassage && passageAnswered < passageItems.length && (
            <p
              style={{
                color: COLORS.textMuted,
                fontSize: 12,
                textAlign: "center",
                marginTop: 12,
              }}
            >
              You can move on and come back to answer later.
            </p>
          )}
          {isLastPassage && answeredCount < totalItems && (
            <p
              style={{
                color: COLORS.gold,
                fontSize: 12,
                textAlign: "center",
                marginTop: 12,
              }}
            >
              You've answered {answeredCount} of {totalItems} questions. You
              can submit now or go back to answer more.
            </p>
          )}
        </main>
      </div>
    );
  }

  // ─── Results phase ───────────────────────────────────────────────────
  if (phase === "results") {
    // Use submit response if available (just submitted), otherwise use results data
    const skillSummary =
      submitResponse?.skillSummary ||
      resultsData?.skillSummary ||
      resultsData?.latest?.skill_summary_json ||
      [];
    const studentSummary =
      submitResponse?.studentSummary ||
      resultsData?.latest?.student_summary ||
      "";
    const nextSteps =
      submitResponse?.nextSteps ||
      resultsData?.latest?.next_steps_json ||
      [];
    const ariseScore =
      submitResponse?.attempt?.arise_reading_score ||
      resultsData?.latest?.arise_reading_score ||
      0;
    const scoreChange = resultsData?.scoreChange || 0;

    return (
      <div style={{ minHeight: "100vh", backgroundColor: COLORS.bg }}>
        {/* Header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            backgroundColor: "rgba(26, 26, 26, 0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              maxWidth: 800,
              margin: "0 auto",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 56,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
                color: COLORS.text,
              }}
            >
              <Award
                style={{ width: 16, height: 16, color: COLORS.gold }}
              />
              Growth Check Results
            </div>
            <button
              onClick={() => navigate("/library")}
              style={{
                color: COLORS.textMuted,
                fontSize: 13,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Done →
            </button>
          </div>
        </header>

        <main
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "32px 16px 48px",
          }}
        >
          {/* Score section */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginBottom: 16,
              }}
            >
              <Sparkles
                style={{ width: 18, height: 18, color: COLORS.gold }}
              />
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: COLORS.text,
                  margin: 0,
                }}
              >
                Your Results
              </h1>
            </div>

            <ScoreGauge score={ariseScore} />

            {/* Score change indicator */}
            {scoreChange !== 0 && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  color: scoreChange > 0 ? COLORS.green : COLORS.orange,
                }}
              >
                <TrendingUp style={{ width: 16, height: 16 }} />
                {scoreChange > 0
                  ? `+${scoreChange} from last check`
                  : `${scoreChange} from last check`}
              </div>
            )}

            <p
              style={{
                color: COLORS.textMuted,
                fontSize: 13,
                marginTop: 12,
                maxWidth: 420,
                margin: "12px auto 0",
              }}
            >
              This is a snapshot of your reading skills — not a grade. It helps
              your teacher know how to support you.
            </p>
          </div>

          {/* Student summary */}
          {studentSummary && (
            <div
              style={{
                backgroundColor: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <ClipboardList
                  style={{ width: 16, height: 16, color: COLORS.teal }}
                />
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: COLORS.text,
                    margin: 0,
                  }}
                >
                  Your Reading Summary
                </h3>
              </div>
              <p
                style={{
                  color: COLORS.text,
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {studentSummary}
              </p>
            </div>
          )}

          {/* Skill breakdown */}
          {skillSummary.length > 0 && (
            <div
              style={{
                backgroundColor: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Target
                  style={{ width: 16, height: 16, color: COLORS.teal }}
                />
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: COLORS.text,
                    margin: 0,
                  }}
                >
                  Skill Breakdown
                </h3>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {skillSummary.map((skill, idx) => {
                  const config =
                    SKILL_LEVEL_CONFIG[skill.level] ||
                    SKILL_LEVEL_CONFIG.more_evidence;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "12px 14px",
                        backgroundColor: config.bgColor,
                        borderRadius: 10,
                        border: `1px solid ${config.color}30`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: config.color,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              color: COLORS.text,
                              fontSize: 14,
                              fontWeight: 600,
                              margin: 0,
                            }}
                          >
                            {skill.skillName}
                          </p>
                          <p
                            style={{
                              color: COLORS.textMuted,
                              fontSize: 12,
                              margin: "2px 0 0",
                            }}
                          >
                            {config.message}
                            {skill.total > 0 &&
                              ` • ${skill.correct}/${skill.total} correct`}
                          </p>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: config.color,
                          backgroundColor: `${config.color}20`,
                          padding: "3px 8px",
                          borderRadius: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {config.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next steps */}
          {nextSteps.length > 0 && (
            <div
              style={{
                backgroundColor: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Lightbulb
                  style={{ width: 16, height: 16, color: COLORS.gold }}
                />
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: COLORS.text,
                    margin: 0,
                  }}
                >
                  Next Steps
                </h3>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {nextSteps.map((step, idx) => {
                  const config =
                    SKILL_LEVEL_CONFIG[step.level] ||
                    SKILL_LEVEL_CONFIG.more_evidence;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          backgroundColor: `${config.color}20`,
                          color: config.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <p
                          style={{
                            color: COLORS.text,
                            fontSize: 13,
                            fontWeight: 600,
                            margin: "0 0 2px",
                          }}
                        >
                          {step.skill}
                        </p>
                        <p
                          style={{
                            color: COLORS.textMuted,
                            fontSize: 13,
                            lineHeight: 1.5,
                            margin: 0,
                          }}
                        >
                          {step.action}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Encouragement message */}
          <div
            style={{
              textAlign: "center",
              padding: "20px 16px",
              backgroundColor: "rgba(20, 184, 166, 0.06)",
              border: `1px solid rgba(20, 184, 166, 0.2)`,
              borderRadius: 16,
              marginBottom: 24,
            }}
          >
            <Sparkles
              style={{
                width: 24,
                height: 24,
                color: COLORS.gold,
                margin: "0 auto 8px",
              }}
            />
            <p
              style={{
                color: COLORS.text,
                fontSize: 16,
                fontWeight: 600,
                margin: 0,
              }}
            >
              Every reader grows at their own pace. Keep reading!
            </p>
          </div>

          {/* Done button */}
          <div style={{ textAlign: "center" }}>
            <Button
              size="lg"
              onClick={() => navigate("/library")}
              style={{
                backgroundColor: COLORS.teal,
                color: "#fff",
                fontWeight: 700,
                padding: "10px 32px",
              }}
            >
              <ArrowRight style={{ width: 16, height: 16, marginRight: 8 }} />
              Back to Library
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ─── Fallback (shouldn't reach here) ────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <Button onClick={() => navigate("/library")}>Go to Library</Button>
      </div>
    </div>
  );
}
