import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { BarChart3, Trophy, Award, MessageSquare, BookOpen, ChevronRight, ChevronLeft, X, Sparkles } from "lucide-react";

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

export default function ParentTutorialPopup() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [animIn, setAnimIn] = useState(false);
  const tutorialChecked = useRef(false);
  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (user.role !== "parent") { setLoading(false); return; }
    if (tutorialChecked.current) return;
    tutorialChecked.current = true;

    const checkServer = async () => {
      try {
        const token = getTokenFromCookie();
        if (!token) { setLoading(false); return; }

        const res = await fetch(`${API_BASE}/api/easter-eggs/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (data.tutorialShown) {
          setLoading(false);
          return;
        }
        // Parent tutorial not shown yet — show it
        setShow(true);
        setLoading(false);
        setTimeout(() => setAnimIn(true), 50);
      } catch {
        setLoading(false);
      }
    };
    checkServer();
  }, [user]);

  useEffect(() => {
    setAnimIn(false);
    const t = setTimeout(() => setAnimIn(true), 50);
    return () => clearTimeout(t);
  }, [currentStep]);

  const dismissServer = async () => {
    try {
      const token = getTokenFromCookie();
      if (!token) return;
      await fetch(`${API_BASE}/api/tutorial/dismiss`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } catch {}
  };

  const dismiss = () => {
    dismissServer();
    setShow(false);
  };

  const goToFeature = (path: string) => {
    dismissServer();
    setShow(false);
    navigate(path);
  };

  const nextStep = () => {
    if (currentStep < features.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (loading || !show) return null;

  const features = [
    {
      icon: BarChart3,
      title: "Your Child's Stats",
      tagline: "Track their reading journey",
      desc: "See every quiz your child has taken, every point they've earned, and every book they've read. This is your home base for monitoring their progress.",
      color: "hsl(21 100% 50%)",
      accent: "hsl(21 100% 55%)",
      path: "/parent-dashboard",
      action: "View Stats",
      stat: "All in one place",
      emoji: "📊",
    },
    {
      icon: Trophy,
      title: "Points & Achievements",
      tagline: "Celebrate their wins",
      desc: "Watch your child's points grow with every quiz they pass. See which books they've mastered and how they're climbing the leaderboard in their grade band.",
      color: "hsl(142 62% 45%)",
      accent: "hsl(142 62% 52%)",
      path: "/parent-dashboard",
      action: "See Points",
      stat: "Track their growth",
      emoji: "🏆",
    },
    {
      icon: Award,
      title: "Certificates",
      tagline: "Print their achievements",
      desc: "Every time your child passes a quiz, they earn a certificate. View and print certificates to celebrate their reading accomplishments.",
      color: "hsl(35 92% 50%)",
      accent: "hsl(35 92% 58%)",
      path: "/parent-dashboard",
      action: "View Certificates",
      stat: "Celebrate success",
      emoji: "🏅",
    },
    {
      icon: MessageSquare,
      title: "Stay Connected",
      tagline: "Message their teacher",
      desc: "Need to reach your child's teacher? Send messages directly through the platform. Keep the conversation going about your child's reading progress.",
      color: "hsl(200 80% 50%)",
      accent: "hsl(200 80% 58%)",
      path: "/parent-dashboard",
      action: "Get Started",
      stat: "Parent-teacher communication",
      emoji: "💬",
    },
  ];

  const currentFeature = features[currentStep];
  const isLastStep = currentStep === features.length - 1;
  const isFirstStep = currentStep === 0;
  const progress = ((currentStep + 1) / features.length) * 100;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 shadow-2xl"
        style={{
          borderColor: currentFeature.color + "60",
          background: "linear-gradient(145deg, hsl(0 0% 10%), hsl(0 0% 7%))",
          transform: animIn ? "scale(1) translateY(0)" : "scale(0.92) translateY(20px)",
          opacity: animIn ? 1 : 0,
          transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${currentFeature.color}, ${currentFeature.accent})`,
            }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-3xl"
              style={{
                background: `linear-gradient(135deg, ${currentFeature.color}25, ${currentFeature.accent}15)`,
                border: `2px solid ${currentFeature.color}40`,
              }}
            >
              <span className="text-5xl">{currentFeature.emoji}</span>
            </div>
          </div>

          {/* Title */}
          <div className="mb-2 text-center">
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: currentFeature.color }}
            >
              {currentFeature.tagline}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">
              {currentFeature.title}
            </h2>
          </div>

          {/* Description */}
          <p className="mx-auto mb-6 max-w-sm text-center text-sm leading-relaxed text-white/60">
            {currentFeature.desc}
          </p>

          {/* Stat badge */}
          <div className="mb-6 flex justify-center">
            <div
              className="rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{
                background: currentFeature.color + "20",
                color: currentFeature.color,
                border: `1px solid ${currentFeature.color}40`,
              }}
            >
              {currentFeature.stat}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={prevStep}
              disabled={isFirstStep}
              className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {/* Step dots */}
            <div className="flex gap-1.5">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: i === currentStep ? "24px" : "8px",
                    background: i === currentStep ? currentFeature.color : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>

            {isLastStep ? (
              <button
                onClick={() => goToFeature(currentFeature.path)}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-transform hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${currentFeature.color}, ${currentFeature.accent})`,
                  color: "#000",
                  boxShadow: `0 4px 20px ${currentFeature.color}40`,
                }}
              >
                {currentFeature.action}
                <Sparkles className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-transform hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${currentFeature.color}, ${currentFeature.accent})`,
                  color: "#000",
                }}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Skip */}
          {!isLastStep && (
            <div className="mt-4 text-center">
              <button
                onClick={dismiss}
                className="text-xs font-medium text-white/30 transition-colors hover:text-white/60"
              >
                Skip tutorial
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
