import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, Trophy, Sparkles, BarChart3, Library, X, ArrowRight } from "lucide-react";

export default function FypAnnouncementPopup({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    // Only show for students (not admin/teacher)
    if (user.isAdmin || user.role === 'teacher') {
      setLoading(false);
      return;
    }
    // Check if already shown this session
    if (sessionStorage.getItem('fyp_announcement_shown') === 'true') {
      setLoading(false);
      return;
    }

    // Wait for profile setup to complete first
    const checkReady = () => {
      const setupInProgress = sessionStorage.getItem('show_profile_setup') === 'true';
      if (setupInProgress) {
        setTimeout(checkReady, 500);
        return;
      }
      // Profile setup done, show tutorial
      setShow(true);
      setLoading(false);
    };
    checkReady();
  }, [user]);

  const dismiss = () => {
    sessionStorage.setItem('fyp_announcement_shown', 'true');
    sessionStorage.setItem('fyp_announcement_dismissed_at', Date.now().toString());
    setShow(false);
  };

  const goToFeature = (path: string) => {
    sessionStorage.setItem('fyp_announcement_shown', 'true');
    sessionStorage.setItem('fyp_announcement_dismissed_at', Date.now().toString());
    setShow(false);
    onNavigate(path);
  };

  if (loading || !show) return null;

  const features = [
    {
      icon: Library,
      title: "Library & Quizzes",
      desc: "Browse hundreds of books matched to your grade level. Read a book, then take a 10-question quiz to earn points toward the leaderboard.",
      color: "hsl(21 100% 50%)",
      path: "/library",
      action: "Browse Books",
    },
    {
      icon: Sparkles,
      title: "A.R.I.S.E F.Y.P",
      desc: "A TikTok-style book feed! Scroll through book covers and summaries rewritten to get you excited. Like, save, and share books you love. The feed learns what you like.",
      color: "hsl(35 92% 50%)",
      path: "/fyp",
      action: "Explore F.Y.P",
    },
    {
      icon: Trophy,
      title: "Leaderboard",
      desc: "See how you rank against other students in your grade band. Earn points from quizzes and easter eggs to climb the ranks!",
      color: "hsl(142 62% 45%)",
      path: "/leaderboard",
      action: "View Rankings",
    },
    {
      icon: BookOpen,
      title: "iArise Lessons",
      desc: "Special 5-lesson series with 10 questions each. Perfect for building reading skills step by step. Available in the Eye Gaze section too!",
      color: "hsl(200 80% 50%)",
      path: "/iarise",
      action: "Start iArise",
    },
    {
      icon: BarChart3,
      title: "Progress & Profile",
      desc: "Track your quiz history, points earned, books read, and certificates. Your profile shows everything you've accomplished.",
      color: "hsl(280 60% 55%)",
      path: "/profile",
      action: "View Profile",
    },
  ];

  const currentFeature = features[currentStep];
  const isLastStep = currentStep === features.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4">
      <div
        className="rounded-2xl max-w-lg w-full shadow-2xl border-2 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(0 0% 8%), hsl(0 0% 12%))",
          borderColor: "rgba(245, 158, 11, 0.3)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-amber-500 tracking-wider">A.R.I.S.E READER</span>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-6 pt-4">
          {features.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                flex: 1,
                background: i === currentStep ? currentFeature.color : i < currentStep ? currentFeature.color + "60" : "hsl(0 0% 25%)",
              }}
            />
          ))}
        </div>

        {/* Feature content */}
        <div className="px-6 py-6">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: currentFeature.color + "20" }}
          >
            <currentFeature.icon size={28} style={{ color: currentFeature.color }} />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">{currentFeature.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{currentFeature.desc}</p>

          {/* Navigation buttons */}
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-white transition-colors"
              >
                Back
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={dismiss}
              className="px-4 py-2.5 text-sm text-muted-foreground hover:text-white transition-colors"
            >
              Skip
            </button>
            {isLastStep ? (
              <button
                onClick={() => goToFeature(currentFeature.path)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                style={{ background: currentFeature.color, color: "#000" }}
              >
                {currentFeature.action}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                style={{ background: currentFeature.color, color: "#000" }}
              >
                Next
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Quick links footer */}
        <div className="px-6 py-4 border-t border-white/10 flex flex-wrap gap-2">
          {features.map((f, i) => (
            <button
              key={f.title}
              onClick={() => setCurrentStep(i)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors"
              style={{
                background: i === currentStep ? f.color + "20" : "transparent",
                color: i === currentStep ? f.color : "hsl(0 0% 50%)",
                fontWeight: 600,
              }}
            >
              <f.icon size={12} />
              {f.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
