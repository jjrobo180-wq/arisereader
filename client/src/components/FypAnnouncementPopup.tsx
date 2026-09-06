import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  BookOpen,
  Trophy,
  Sparkles,
  BarChart3,
  Library,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  Gift,
} from "lucide-react";

export default function FypAnnouncementPopup({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [animIn, setAnimIn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const stepRef = useRef(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (user.isAdmin || user.role === "teacher") {
      setLoading(false);
      return;
    }
    if (localStorage.getItem("fyp_announcement_shown") === "true") {
      setLoading(false);
      return;
    }

    const checkReady = () => {
      const setupInProgress = sessionStorage.getItem("show_profile_setup") === "true";
      if (setupInProgress) {
        setTimeout(checkReady, 500);
        return;
      }
      setShow(true);
      setLoading(false);
      setTimeout(() => setAnimIn(true), 50);
    };
    checkReady();
  }, [user]);

  useEffect(() => {
    // Reset and trigger entrance animation on step change
    setAnimIn(false);
    const t = setTimeout(() => setAnimIn(true), 50);
    return () => clearTimeout(t);
  }, [currentStep]);

  const dismiss = () => {
    localStorage.setItem("fyp_announcement_shown", "true");
    localStorage.setItem("fyp_announcement_dismissed_at", Date.now().toString());
    setShow(false);
  };

  const goToFeature = (path: string) => {
    localStorage.setItem("fyp_announcement_shown", "true");
    localStorage.setItem("fyp_announcement_dismissed_at", Date.now().toString());
    setShow(false);
    onNavigate(path);
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
      icon: Library,
      title: "The Library",
      tagline: "Your book universe awaits",
      desc: "Hundreds of books matched to your grade. Read one, then take a 10-question quiz to prove you know it. Pass and watch those points stack up.",
      color: "hsl(21 100% 50%)",
      accent: "hsl(21 100% 55%)",
      path: "/library",
      action: "Browse Books",
      stat: "Hundreds of books",
      emoji: "📚",
    },
    {
      icon: Sparkles,
      title: "A.R.I.S.E F.Y.P",
      tagline: "Your daily book scroll",
      desc: "Swipe through book covers and summaries written to get you hooked. Like what you see? Tap the heart. Found a hidden Easter Egg? Grab those bonus points.",
      color: "hsl(35 92% 50%)",
      accent: "hsl(35 92% 58%)",
      path: "/fyp",
      action: "Start Scrolling",
      stat: "New books daily",
      emoji: "✨",
    },
    {
      icon: Trophy,
      title: "The Leaderboard",
      tagline: "Climb to the top",
      desc: "Compete with students in your grade band. Earn points from quizzes, iArise lessons, and Easter Eggs to rise through the ranks. Can you hit #1?",
      color: "hsl(142 62% 45%)",
      accent: "hsl(142 62% 52%)",
      path: "/leaderboard",
      action: "See Rankings",
      stat: "Compete with your grade",
      emoji: "🏆",
    },
    {
      icon: BookOpen,
      title: "iArise Lessons",
      tagline: "Level up your reading",
      desc: "Five focused lessons, each with 10 questions. Build your skills step by step and earn points for every lesson you crush. Eye Gaze users get these too.",
      color: "hsl(200 80% 50%)",
      accent: "hsl(200 80% 58%)",
      path: "/iarise",
      action: "Start Lessons",
      stat: "5 lessons to master",
      emoji: "🎯",
    },
    {
      icon: BarChart3,
      title: "Your Progress",
      tagline: "Track your wins",
      desc: "See every quiz you've taken, every point you've earned, and every certificate you've unlocked. Your profile is your trophy case. Make it impressive.",
      color: "hsl(280 60% 55%)",
      accent: "hsl(280 60% 62%)",
      path: "/profile",
      action: "View Profile",
      stat: "Your achievement hub",
      emoji: "📊",
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
      onClick={dismiss}
    >
      <div
        className="rounded-3xl max-w-[460px] w-full shadow-2xl overflow-hidden relative"
        style={{
          background: "linear-gradient(160deg, hsl(0 0% 7%), hsl(0 0% 10%))",
          border: `1px solid ${currentFeature.color}40`,
          boxShadow: `0 0 60px ${currentFeature.color}15, 0 20px 60px rgba(0,0,0,0.6)`,
          transform: animIn ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
          opacity: animIn ? 1 : 0,
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div
          className="h-1.5 w-full transition-all duration-500"
          style={{ background: `linear-gradient(90deg, ${currentFeature.color}, ${currentFeature.accent})` }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest text-white/40">A.R.I.S.E READER</span>
          </div>
          <button
            onClick={dismiss}
            className="text-white/30 hover:text-white transition-all hover:scale-110"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${currentFeature.color}, ${currentFeature.accent})`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-bold text-white/30">
              STEP {currentStep + 1} OF {features.length}
            </span>
            {isLastStep ? (
              <span className="text-[10px] font-bold text-green-400 flex items-center gap-1">
                <Check size={10} /> READY
              </span>
            ) : (
              <span className="text-[10px] font-bold text-white/30">
                {features.length - currentStep - 1} more to go
              </span>
            )}
          </div>
        </div>

        {/* Feature content */}
        <div className="px-5 pb-5">
          {/* Icon with glow */}
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl relative mb-4"
            style={{
              background: `linear-gradient(135deg, ${currentFeature.color}25, ${currentFeature.color}08)`,
              border: `1px solid ${currentFeature.color}30`,
              transform: animIn ? "scale(1)" : "scale(0.5)",
              opacity: animIn ? 1 : 0,
              transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s",
            }}
          >
            <currentFeature.icon size={30} style={{ color: currentFeature.color }} />
            {/* Glow */}
            <div
              className="absolute inset-0 rounded-2xl blur-xl -z-10"
              style={{ background: currentFeature.color + "30" }}
            />
          </div>

          {/* Title and tagline */}
          <div
            style={{
              transform: animIn ? "translateY(0)" : "translateY(10px)",
              opacity: animIn ? 1 : 0,
              transition: "all 0.4s ease 0.15s",
            }}
          >
            <h2 className="text-2xl font-black text-white mb-0.5" style={{ letterSpacing: "-0.02em" }}>
              {currentFeature.title}
            </h2>
            <p className="text-xs font-bold mb-3" style={{ color: currentFeature.color }}>
              {currentFeature.tagline}
            </p>
          </div>

          {/* Description */}
          <p
            className="text-sm text-white/60 leading-relaxed mb-4"
            style={{
              transform: animIn ? "translateY(0)" : "translateY(8px)",
              opacity: animIn ? 1 : 0,
              transition: "all 0.4s ease 0.25s",
            }}
          >
            {currentFeature.desc}
          </p>

          {/* Stat chip */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
            style={{
              background: currentFeature.color + "12",
              border: `1px solid ${currentFeature.color}25`,
              transform: animIn ? "scale(1)" : "scale(0.8)",
              opacity: animIn ? 1 : 0,
              transition: "all 0.4s ease 0.35s",
            }}
          >
            <Zap size={12} style={{ color: currentFeature.color }} />
            <span className="text-xs font-bold" style={{ color: currentFeature.color }}>
              {currentFeature.stat}
            </span>
          </div>

          {/* Navigation - hidden on last step */}
          {!isLastStep && (
            <div className="flex items-center gap-2 mt-5">
              {!isFirstStep ? (
                <button
                  onClick={prevStep}
                  className="px-3 py-2.5 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              ) : (
                <div />
              )}
              <div className="flex-1" />
              <button
                onClick={dismiss}
                className="px-3 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors font-semibold"
              >
                Skip
              </button>
              <button
                onClick={nextStep}
                className="px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${currentFeature.color}, ${currentFeature.accent})`,
                  color: "#000",
                  boxShadow: `0 4px 20px ${currentFeature.color}30`,
                }}
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Final step CTA (shown above dots on last step) */}
        {isLastStep && (
          <div
            className="px-5 pb-4"
            style={{
              transform: animIn ? "translateY(0)" : "translateY(10px)",
              opacity: animIn ? 1 : 0,
              transition: "all 0.4s ease 0.4s",
            }}
          >
            <div
              className="rounded-2xl p-3 mb-3"
              style={{
                background: `linear-gradient(135deg, ${currentFeature.color}12, transparent)`,
                border: `1px solid ${currentFeature.color}20`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Gift size={14} style={{ color: currentFeature.color }} />
                <span className="text-xs font-bold text-white/70">Quick tip</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                Look for Easter Eggs hidden in the FYP feed while scrolling. Each one gives you bonus leaderboard points.
              </p>
            </div>
            <button
              onClick={() => goToFeature("/fyp")}
              className="w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, hsl(35 92% 50%), hsl(35 92% 58%))",
                color: "#000",
                boxShadow: "0 4px 24px hsl(35 92% 50%)30",
              }}
            >
              <Sparkles size={18} />
              Let's Go
            </button>
          </div>
        )}

        {/* Step dots - always at bottom */}
        <div className="px-5 pb-5 flex justify-center gap-2">
          {features.map((f, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === currentStep ? "24px" : "8px",
                height: "8px",
                background: i === currentStep ? f.color : i < currentStep ? f.color + "50" : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
