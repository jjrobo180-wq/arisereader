import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import EyeGazeProfileDashboard from "@/components/EyeGazeProfileDashboard";

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

export default function EyeGazeHome() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState({ totalPoints: user?.totalPoints || 0, quizzesTaken: 0, rank: null as number | null });

  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) return;

    Promise.all([
      fetch(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/eye-gaze-band-rank`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      }).then(r => r.ok ? r.json() : null),
    ]).then(([profile, rank]) => {
      setStats({
        totalPoints: profile?.totalPoints ?? user?.totalPoints ?? 0,
        quizzesTaken: Array.isArray(profile?.quizResults) ? profile.quizResults.length : 0,
        rank: rank?.eyeGazeRank || rank?.overallRank || null,
      });
    }).catch(() => {});
  }, [token, user?.id, user?.totalPoints]);

  return (
    <EyeGazeProfileDashboard
      displayName={user?.displayName || user?.username || "Reader"}
      totalPoints={stats.totalPoints}
      quizzesTaken={stats.quizzesTaken}
      rank={stats.rank}
    />
  );
}
