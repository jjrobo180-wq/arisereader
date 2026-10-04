import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

interface TourStep {
  selector: string;
  title: string;
  desc: string;
  position: "top" | "bottom" | "left" | "right";
  noTarget?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="welcome"]',
    title: "Welcome to A.R.I.S.E. Reader 2.0!",
    desc: "This is your reading home. The original library is still here, but now reading also connects to live quiz games, rewards, avatars, pets, worlds, Club A.R.I.S.E., and more.",
    position: "bottom",
  },
  {
    selector: '[data-tour="band-badge"]',
    title: "Your Grade Band",
    desc: "Your grade band helps organize reading and competition with students at an appropriate level. You can still open it anytime to learn how your band works.",
    position: "bottom",
  },
  {
    selector: '[data-tour="reads"]',
    title: "Read on Arise and iARISE Lessons",
    desc: "Read full books and articles right on the site. This is also where iARISE lives: short real-life learning lessons on topics like friendship, feelings, wellness, money, careers, study skills, mindset, and digital citizenship — each connected to a quiz.",
    position: "bottom",
  },
  {
    selector: '[data-tour="request-quiz"]',
    title: "Request a Quiz or Use Instant AI",
    desc: "Don't see your book? Request it, or use Instant AI Quiz when available. A.R.I.S.E. is built so one missing title does not stop you from reading something you actually chose.",
    position: "bottom",
  },
  {
    selector: '[data-tour="fyp"]',
    title: "Discover Books Fast",
    desc: "Use the FYP-style book feed to swipe through recommendations, save books, and discover something that looks worth reading without digging through a giant list.",
    position: "left",
  },
  {
    selector: '[data-tour="points"]',
    title: "Points + Reader Coins",
    desc: "Leaderboard points celebrate reading performance. Reader Coins are separate and can be spent on characters, pets, homes, care, and other A.R.I.S.E. experiences.",
    position: "bottom",
  },
  {
    selector: '[data-tour="leaderboard-link"]',
    title: "Leaderboards & Rewards",
    desc: "See eligible reader standings, badges, certificates, and teacher rewards. Sample accounts and admin previews never compete with real students.",
    position: "bottom",
  },
  {
    selector: '[data-tour="eye-gaze-section"]',
    title: "Eye Gazer Learning",
    desc: "A.R.I.S.E. also includes a dedicated Eye Gazer experience with visual quizzes, My Talker AAC, games, Life Skills, My World, Shorts, Flash Cards, My Buddy, and family controls.",
    position: "bottom",
  },
  {
    selector: '[data-tour="welcome"]',
    title: "A.R.I.S.E. Live",
    desc: "Teachers can launch a live classroom quiz. Students join with a short code, answer in real time, and watch the live board update — A.R.I.S.E.'s own live game-show learning experience.",
    position: "bottom",
    noTarget: true,
  },
  {
    selector: '[data-tour="welcome"]',
    title: "Club A.R.I.S.E., Arcade & Worlds",
    desc: "Reading can unlock Club A.R.I.S.E., multiplayer or computer arcade games, Avatar World, pets, homes, The Block, the cinema, Board Quest, and expanding 3D worlds. Teachers and families can control access.",
    position: "bottom",
    noTarget: true,
  },
  {
    selector: '[data-tour="welcome"]',
    title: "You're ready — nothing was removed",
    desc: "Everything you used before is still part of the experience. A.R.I.S.E. 2.0 builds on the reading program instead of replacing it. Use the Quick Menu whenever you want a fast way into the newest features.",
    position: "bottom",
    noTarget: true,
  },
];

export default function GuidedTour({ onComplete, onActiveChange }: { onComplete?: () => void; onActiveChange?: (active: boolean) => void }) {
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
    if (!user) return;
    if (startedRef.current) return;
    startedRef.current = true;

    // For non-sample students, check sessionStorage dismissal
    if (!String(user.username || "").startsWith("sample") && sessionStorage.getItem("guided_tour_dismissed") === "true") {
      if (onCompleteRef.current) onCompleteRef.current();
      return;
    }

    // Wait for profile setup overlay to finish (if active), then start tour
    const startTour = () => {
      timerRef.current = setTimeout(() => {
        setActive(true);
        if (onActiveChange) onActiveChange(true);
      }, 1500);
    };

    // Check if profile setup overlay is showing
    if (sessionStorage.getItem("show_profile_setup") === "true") {
      // Poll until the overlay is done
      const checkInterval = setInterval(() => {
        if (sessionStorage.getItem("show_profile_setup") !== "true") {
          clearInterval(checkInterval);
          startTour();
        }
      }, 500);
      // Safety timeout: start after 20 seconds no matter what
      setTimeout(() => {
        clearInterval(checkInterval);
        startTour();
      }, 20000);
    } else {
      // No setup overlay, start after page loads
      startTour();
    }
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

      // No-target step: show centered tooltip without spotlight
      if (tourStep.noTarget) {
        setTargetRect(null);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setTooltipPos({ top: vh / 2 - 80, left: vw / 2 - 160 });
        setArrowDir("bottom");
        setArrowPos({ top: 0, left: 0 });
        return;
      }

      const el = Array.from(document.querySelectorAll(tourStep.selector))
        .find(node => {
          const target = node as HTMLElement;
          return target.offsetWidth > 0 && target.offsetHeight > 0;
        }) as HTMLElement | undefined;
      if (!el) {
        // Skip step if target not found or invisible
        if (step < TOUR_STEPS.length - 1) {
          setStep(step + 1);
        } else {
          finishTour();
        }
        return;
      }

      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Scroll up a bit more so there's room for the tooltip below
      setTimeout(() => window.scrollBy({ top: -80, behavior: "smooth" }), 100);

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
    const th = 200; // taller estimate for longer descriptions
    const gap = 20;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;
    let dir: "top" | "bottom" | "left" | "right" = "bottom";

    // Calculate both positions and pick the one that fits better
    const bottomTop = rect.bottom + gap;
    const topTop = rect.top - th - gap;

    if (position === "bottom") {
      // If tooltip would go past 65% of viewport, flip to top
      if (bottomTop + th > vh * 0.65 && topTop > 16) {
        top = topTop;
        dir = "bottom";
      } else {
        top = bottomTop;
        dir = "top";
      }
      left = rect.left + rect.width / 2 - tw / 2;
    } else if (position === "top") {
      if (topTop < 16 && bottomTop + th < vh - 16) {
        top = bottomTop;
        dir = "top";
      } else {
        top = topTop;
        dir = "bottom";
      }
      left = rect.left + rect.width / 2 - tw / 2;
    } else if (position === "right") {
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.right + gap;
      dir = "left";
    } else {
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.left - tw - gap;
      dir = "right";
    }

    // Clamp to viewport with safe margins
    left = Math.max(16, Math.min(left, vw - tw - 16));
    top = Math.max(16, Math.min(top, vh - th - 16));

    setTooltipPos({ top, left });
    setArrowDir(dir);

    let arrowTop = 0, arrowLeft = 0;
    if (dir === "top") {
      arrowTop = -20;
      arrowLeft = rect.left + rect.width / 2 - left;
    } else if (dir === "bottom") {
      arrowTop = 200;
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
    if (onActiveChange) onActiveChange(false);
    sessionStorage.setItem("guided_tour_dismissed", "true");
    if (onCompleteRef.current) onCompleteRef.current();
  };

  // Reposition on resize/scroll
  useEffect(() => {
    if (!active || !targetRect) return;
    const handler = () => {
      const tourStep = TOUR_STEPS[step];
      if (!tourStep) return;
      const el = Array.from(document.querySelectorAll(tourStep.selector))
        .find(node => {
          const target = node as HTMLElement;
          return target.offsetWidth > 0 && target.offsetHeight > 0;
        }) as HTMLElement | undefined;
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

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const pad = 8;
  const hasTarget = !!targetRect && !currentStep?.noTarget;

  // Full-screen click blocker — prevents clicking outside the tour
  const blockerStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    pointerEvents: "auto",
    background: hasTarget ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.9)",
    clipPath: hasTarget ? `polygon(0 0,100% 0,100% 100%,0 100%,0 ${targetRect!.top - pad}px,${targetRect!.right + pad}px ${targetRect!.top - pad}px,${targetRect!.right + pad}px ${targetRect!.bottom + pad}px,${targetRect!.left - pad}px ${targetRect!.bottom + pad}px,${targetRect!.left - pad}px ${targetRect!.top - pad}px,0 ${targetRect!.top - pad}px)` : undefined,
  };

  const arrowStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = { position: "absolute", width: 0, height: 0 };
    if (arrowDir === "top") return { ...base, top: -20, left: arrowPos.left, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderBottom: "20px solid #f97316" };
    if (arrowDir === "bottom") return { ...base, top: 200, left: arrowPos.left, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "20px solid #f97316" };
    if (arrowDir === "left") return { ...base, top: arrowPos.top, left: -20, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderRight: "20px solid #f97316" };
    return { ...base, top: arrowPos.top, left: 320, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "20px solid #f97316" };
  })();

  return (
    <>
      <div style={blockerStyle} />
      {hasTarget && targetRect && (
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
      )}
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
              {step === 0 ? "👋" : step === 1 ? "🎓" : step === 2 ? "🎯" : step === 3 ? "📖" : step === 4 ? "📚" : step === 5 ? "🏆" : step === 6 ? "⭐" : step === 7 ? "📊" : step === 8 ? "👁️" : step === 9 ? "📱" : "✨"}
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
