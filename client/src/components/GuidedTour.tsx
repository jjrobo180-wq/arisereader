import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

interface TourStep {
  selector: string;
  title: string;
  desc: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="welcome"]',
    title: "Welcome to A.R.I.S.E Reader!",
    desc: "This is your library. Browse books, take quizzes, and earn points. Let me show you around — click Next to start.",
    position: "bottom",
  },
  {
    selector: '[data-tour="iarise-section"]',
    title: "iArise Lessons",
    desc: "These are quick skill-building lessons. Each one has a 10-question quiz. As a sample user, you'll get 3 questions per quiz.",
    position: "bottom",
  },
  {
    selector: '[data-tour="first-book"]',
    title: "Try a Sample Quiz",
    desc: "Click any book here to take a 3-question sample quiz. When you're ready for the full experience, create a free account!",
    position: "right",
  },
  {
    selector: '[data-tour="points"]',
    title: "Your Points",
    desc: "Earn points by taking quizzes, finding easter eggs on the FYP, and completing iArise lessons. Compete on the leaderboard!",
    position: "bottom",
  },
  {
    selector: '[data-tour="fyp"]',
    title: "FYP Feed",
    desc: "Swipe through book recommendations like TikTok. Find hidden easter eggs for bonus points! This is where reading gets fun.",
    position: "bottom",
  },
];

export default function GuidedTour({ onComplete }: { onComplete?: () => void }) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [arrowPos, setArrowPos] = useState({ top: 0, left: 0 });
  const [arrowDir, setArrowDir] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!user || user.username !== "sample") return;
    if (startedRef.current) return;
    startedRef.current = true;

    if (sessionStorage.getItem("guided_tour_dismissed") === "true") {
      if (onCompleteRef.current) onCompleteRef.current();
      return;
    }

    // Wait for page to load, then start tour
    timerRef.current = setTimeout(() => setActive(true), 3000);
    // No cleanup - startedRef prevents duplicate timeouts, 
    // and we want the timeout to survive re-renders
  }, [user]);

  // Find target and position tooltip
  useEffect(() => {
    if (!active) return;

    const findTarget = () => {
      const tourStep = TOUR_STEPS[step];
      if (!tourStep) {
        finishTour();
        return;
      }

      const el = document.querySelector(tourStep.selector);
      if (!el) {
        // Skip step if target not found
        if (step < TOUR_STEPS.length - 1) {
          setStep(step + 1);
        } else {
          finishTour();
        }
        return;
      }

      el.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        positionTooltip(rect, tourStep.position);
      }, 600);
    };

    findTarget();
  }, [active, step]);

  const positionTooltip = (rect: DOMRect, position: string) => {
    const tw = 320;
    const th = 160;
    const gap = 20;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;
    let dir: "top" | "bottom" | "left" | "right" = "bottom";

    if (position === "bottom") {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tw / 2;
      dir = "top";
    } else if (position === "top") {
      top = rect.top - th - gap;
      left = rect.left + rect.width / 2 - tw / 2;
      dir = "bottom";
    } else if (position === "right") {
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.right + gap;
      dir = "left";
    } else {
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.left - tw - gap;
      dir = "right";
    }

    left = Math.max(16, Math.min(left, vw - tw - 16));
    top = Math.max(16, Math.min(top, vh - th - 16));

    setTooltipPos({ top, left });
    setArrowDir(dir);

    let arrowTop = 0, arrowLeft = 0;
    if (dir === "top") {
      arrowTop = -20;
      arrowLeft = rect.left + rect.width / 2 - left;
    } else if (dir === "bottom") {
      arrowTop = th;
      arrowLeft = rect.left + rect.width / 2 - left;
    } else if (dir === "left") {
      arrowTop = th / 2 - 10;
      arrowLeft = -20;
    } else {
      arrowTop = th / 2 - 10;
      arrowLeft = tw;
    }
    setArrowPos({ top: arrowTop, left: arrowLeft });
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finishTour();
    }
  };

  const finishTour = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setActive(false);
    sessionStorage.setItem("guided_tour_dismissed", "true");
    if (onCompleteRef.current) onCompleteRef.current();
  };

  // Reposition on resize/scroll
  useEffect(() => {
    if (!active || !targetRect) return;
    const handler = () => {
      const tourStep = TOUR_STEPS[step];
      if (!tourStep) return;
      const el = document.querySelector(tourStep.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        positionTooltip(rect, tourStep.position);
      }
    };
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [active, step, targetRect]);

  if (!active || !targetRect) return null;

  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const pad = 8;

  const spotlightStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    pointerEvents: "none",
    background: "rgba(0,0,0,0.85)",
    clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 ${targetRect.top - pad}px,${targetRect.right + pad}px ${targetRect.top - pad}px,${targetRect.right + pad}px ${targetRect.bottom + pad}px,${targetRect.left - pad}px ${targetRect.bottom + pad}px,${targetRect.left - pad}px ${targetRect.top - pad}px,0 ${targetRect.top - pad}px)`,
  };

  const arrowStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = { position: "absolute", width: 0, height: 0 };
    if (arrowDir === "top") return { ...base, top: -20, left: arrowPos.left, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderBottom: "20px solid #f97316" };
    if (arrowDir === "bottom") return { ...base, top: 160, left: arrowPos.left, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "20px solid #f97316" };
    if (arrowDir === "left") return { ...base, top: arrowPos.top, left: -20, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderRight: "20px solid #f97316" };
    return { ...base, top: arrowPos.top, left: 320, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "20px solid #f97316" };
  })();

  return (
    <>
      <div style={spotlightStyle} />
      <div
        style={{
          position: "fixed",
          top: targetRect.top - pad,
          left: targetRect.left - pad,
          width: targetRect.width + pad * 2,
          height: targetRect.height + pad * 2,
          borderRadius: 12,
          border: "3px solid #f97316",
          zIndex: 201,
          pointerEvents: "none",
          animation: "tourPulse 1.5s ease-in-out infinite",
        }}
      />
      <div style={{ position: "fixed", top: tooltipPos.top, left: tooltipPos.left, width: 320, zIndex: 202 }}>
        <div style={arrowStyle} />
        <div
          style={{
            background: "linear-gradient(160deg, hsl(0 0% 12%), hsl(0 0% 8%))",
            border: "2px solid #f97316",
            borderRadius: 16,
            padding: "20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(249,115,22,0.2)",
            animation: "tourFadeIn 0.3s ease",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>
              {step === 0 ? "👋" : step === 1 ? "🎯" : step === 2 ? "📖" : step === 3 ? "⭐" : "📱"}
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", margin: 0 }}>{currentStep.title}</h3>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            {currentStep.desc}
          </p>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === step ? "#f97316" : "rgba(255,255,255,0.2)",
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={finishTour}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Skip tour
            </button>
            <button
              onClick={next}
              style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                border: "none",
                borderRadius: 10,
                padding: "8px 20px",
                color: "white",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isLast ? "Got it!" : "Next →"}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes tourPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.4); } 50% { box-shadow: 0 0 0 8px rgba(249,115,22,0); } }
        @keyframes tourFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  );
}
