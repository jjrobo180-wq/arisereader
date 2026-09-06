import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

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

import { API_BASE } from "@/lib/queryClient";

export default function AssessmentPopup({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Use login response data if available — avoids an extra API call
    if (!user || user.isAdmin) {
      setLoading(false);
      return;
    }
    if (user.assessmentPromptShown) {
      setShow(false);
      setLoading(false);
      return;
    }
    // Wait for profile setup overlay to complete before showing the popup
    // (prevents the popup from appearing during the loading screen)
    const checkReady = () => {
      const setupInProgress = sessionStorage.getItem('show_profile_setup') === 'true';
      const fypAnnouncementPending = sessionStorage.getItem('fyp_announcement_shown') !== 'true';
      if (setupInProgress || fypAnnouncementPending) {
        // Setup or FYP announcement still running, check again in 500ms
        setTimeout(checkReady, 500);
        return;
      }
      // Wait 45 seconds after FYP announcement is dismissed before showing progress popup
      const fypDismissedAt = sessionStorage.getItem('fyp_announcement_dismissed_at');
      if (fypDismissedAt) {
        const elapsed = Date.now() - parseInt(fypDismissedAt);
        if (elapsed < 45000) {
          setTimeout(checkReady, 500);
          return;
        }
      }
      // Setup is done (or was never needed), proceed with popup check
      if (user.assessmentPromptShown === undefined) {
        const token = getTokenFromCookie();
        if (!token) {
          setLoading(false);
          return;
        }
        fetch(`${API_BASE}/api/assessment-popup-status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (!data.shown) {
              setShow(true);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      } else {
        setShow(true);
        setLoading(false);
      }
    };
    checkReady();
  }, [user]);

  const dismiss = (action: "assessment" | "iready" | "skip") => {
    const token = getTokenFromCookie();
    if (!token) return;
    fetch(`${API_BASE}/api/assessment-popup-dismiss`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }).catch(() => {});
    setShow(false);
    setDismissed(true);
    if (action === "assessment") {
      onNavigate("/progress");
    } else if (action === "iready") {
      onNavigate("/progress?iready=1");
    }
  };

  if (loading || dismissed || !show || !user || user.isAdmin) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <span className="text-2xl">📚</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Welcome to A.R.I.S.E Reader!</h2>
          <p className="text-sm text-muted-foreground">
            To find your reading level and get personalized book recommendations, let's start with a quick reading assessment. Or, if you have an i-Ready score from school, you can enter that instead.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => dismiss("assessment")}
            className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            🧪 Take Reading Assessment
          </button>
          <button
            onClick={() => dismiss("iready")}
            className="w-full py-3 px-4 rounded-lg bg-muted/40 border border-border text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            📊 Enter i-Ready Score
          </button>
          <button
            onClick={() => dismiss("skip")}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
          >
            Skip for now — I'll do it later
          </button>
        </div>
      </div>
    </div>
  );
}
