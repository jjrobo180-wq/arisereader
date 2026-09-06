import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, ArrowRight } from "lucide-react";

export default function FypAnnouncementPopup({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

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
      // Profile setup done, show FYP announcement
      setShow(true);
      setLoading(false);
    };
    checkReady();
  }, [user]);

  const dismiss = () => {
    sessionStorage.setItem('fyp_announcement_shown', 'true');
    // Delay the assessment popup by 30 seconds so the user can explore FYP first
    sessionStorage.setItem('fyp_announcement_dismissed_at', Date.now().toString());
    setShow(false);
  };

  const goToFyp = () => {
    sessionStorage.setItem('fyp_announcement_shown', 'true');
    sessionStorage.setItem('fyp_announcement_dismissed_at', Date.now().toString());
    setShow(false);
    onNavigate("/fyp");
  };

  if (loading || !show) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div
        className="rounded-2xl p-8 max-w-md w-full shadow-2xl border-2"
        style={{
          background: "linear-gradient(135deg, hsl(0 0% 8%), hsl(0 0% 12%))",
          borderColor: "rgba(245, 158, 11, 0.3)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: "rgba(245, 158, 11, 0.15)" }}
          >
            <Sparkles size={32} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            A.R.I.S.E F.Y.P
          </h2>
          <p className="text-sm text-muted-foreground">
            Discover your next favorite book with a TikTok-style feed
          </p>
        </div>

        {/* Feature highlights */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <span className="text-xl">📚</span>
            <div>
              <p className="text-sm font-semibold text-white">Swipe Through Books</p>
              <p className="text-xs text-muted-foreground">Scroll through hundreds of books with covers, summaries, and recommendations tailored to your grade level.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <span className="text-xl">❤️</span>
            <div>
              <p className="text-sm font-semibold text-white">Like, Save & Share</p>
              <p className="text-xs text-muted-foreground">Tap like on books you love, save them for later, and share with friends. The more you interact, the smarter it gets.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <span className="text-xl">🎯</span>
            <div>
              <p className="text-sm font-semibold text-white">Personalized For You</p>
              <p className="text-xs text-muted-foreground">An algorithm learns what you like and shows you more books you'll enjoy — all school-appropriate and matched to your reading level.</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <button
            onClick={goToFyp}
            className="w-full py-3 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            style={{
              background: "linear-gradient(135deg, hsl(35 92% 50%), hsl(21 100% 50%))",
              color: "black",
            }}
          >
            <Sparkles size={16} />
            Explore F.Y.P Now
            <ArrowRight size={16} />
          </button>
          <button
            onClick={dismiss}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
