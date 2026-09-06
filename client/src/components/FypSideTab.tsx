import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sparkles } from "lucide-react";

export default function FypSideTab() {
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [show, setShow] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    if (!user) { setShow(false); return; }
    // Only show for students (not admin, teacher, or parent)
    if (user.isAdmin || user.role === 'teacher' || user.role === 'parent') {
      setShow(false);
      return;
    }
    // Don't show on the FYP page itself
    const checkPath = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === '/fyp' || hash.startsWith('/fyp/')) {
        setShow(false);
      } else {
        setShow(true);
      }
    };
    checkPath();
    window.addEventListener('hashchange', checkPath);
    return () => window.removeEventListener('hashchange', checkPath);
  }, [user]);

  // Subtle pulse animation to draw attention
  useEffect(() => {
    if (!show) return;
    const interval = setInterval(() => {
      setPulseCount(c => c + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40"
      style={{
        transform: hovered || expanded
          ? "translateY(-50%) translateX(0)"
          : "translateY(-50%) translateX(calc(100% - 48px))",
        transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setExpanded(false); }}
      onClick={() => setExpanded(!expanded)}
    >
      <div
        className="flex items-center gap-2 rounded-l-2xl cursor-pointer select-none"
        style={{
          background: "linear-gradient(135deg, hsl(35 92% 50%), hsl(35 92% 58%))",
          padding: "14px 16px 14px 14px",
          boxShadow: "0 4px 24px hsl(35 92% 50% / 0.35), 0 2px 8px rgba(0,0,0,0.2)",
          animation: pulseCount > 0 ? `fypTabPulse 0.6s ease-out` : undefined,
        }}
      >
        {/* Icon circle */}
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
          style={{
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <Sparkles
            size={16}
            className="text-black"
            style={{
              animation: "fypTabSpin 3s linear infinite",
            }}
          />
        </div>

        {/* Sliding text */}
        <div
          className="overflow-hidden flex items-center"
          style={{
            maxWidth: hovered || expanded ? "160px" : "0px",
            opacity: hovered || expanded ? 1 : 0,
            transition: "max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease 0.1s",
            whiteSpace: "nowrap",
          }}
        >
          <div className="flex flex-col">
            <span
              className="text-xs font-black text-black leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              A.R.I.S.E
            </span>
            <span className="text-[10px] font-bold text-black/70 leading-tight">
              F.Y.P Feed
            </span>
          </div>
          <div
            className="ml-3 px-3 py-1.5 rounded-xl text-xs font-black text-black flex items-center gap-1"
            style={{ background: "rgba(0,0,0,0.1)" }}
            onClick={(e) => {
              e.stopPropagation();
              window.location.hash = '/fyp';
            }}
          >
            Open
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Keyframe animations injected */}
      <style>{`
        @keyframes fypTabPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); box-shadow: 0 4px 30px hsl(35 92% 50% / 0.5), 0 2px 12px rgba(0,0,0,0.3); }
          100% { transform: scale(1); }
        }
        @keyframes fypTabSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
