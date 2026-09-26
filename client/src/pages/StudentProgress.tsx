import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Award, CheckCircle2, Flame, Gift, Lock, Medal, Trophy, Zap } from "lucide-react";

const SESSION_COOKIE = "arise_session";
function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim();
      if (cookie.startsWith(SESSION_COOKIE + "=")) {
        const raw = cookie.substring(SESSION_COOKIE.length + 1);
        return JSON.parse(atob(raw)).token || null;
      }
    }
  } catch {}
  return null;
}

type Badge = { id: string; name: string; emoji: string; description: string; unlocked: boolean };
type Reward = {
  id: number;
  title: string;
  message: string;
  progress?: string | null;
  completed?: boolean;
  claimStatus?: string | null;
  expiresAt?: string | null;
  requiredQuizCount?: number;
};
type LeaderboardEntry = {
  rank?: number;
  id?: number;
  userId?: number;
  displayName: string;
  totalPoints: number;
  quizzesTaken: number;
};
type Engagement = {
  streak: number;
  totalPoints: number;
  level: { level: number; name: string; progress: number; nextName: string | null; nextPoints: number | null };
  personalBest: { thisWeekPoints: number; lastWeekPoints: number; beatLastWeek: boolean };
};

export default function StudentProgress() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"badges" | "rewards" | "leaderboard">("badges");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgeCounts, setBadgeCounts] = useState({ unlocked: 0, total: 0 });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const authToken = token || getTokenFromCookie();

  const load = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const [badgesRes, rewardsRes, leaderboardRes, engagementRes] = await Promise.all([
        fetch(`${API_BASE}/api/engagement/badges`, { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" }),
        fetch(`${API_BASE}/api/student/rewards`, { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" }),
        fetch(`${API_BASE}/api/leaderboard`, { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" }),
        fetch(`${API_BASE}/api/engagement/summary`, { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" }),
      ]);
      if (badgesRes.ok) {
        const data = await badgesRes.json();
        setBadges(Array.isArray(data.badges) ? data.badges : []);
        setBadgeCounts({ unlocked: data.unlockedCount || 0, total: data.totalCount || 0 });
      }
      if (rewardsRes.ok) {
        const data = await rewardsRes.json();
        setRewards(Array.isArray(data.rewards) ? data.rewards : []);
      }
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json();
        setLeaderboard(Array.isArray(data) ? data : []);
      }
      if (engagementRes.ok) setEngagement(await engagementRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("arise-points-updated", refresh);
    return () => window.removeEventListener("arise-points-updated", refresh);
  }, [user?.id, token]);

  const myRank = useMemo(() => {
    if (!user) return null;
    const idx = leaderboard.findIndex((entry) => (entry.userId || entry.id) === user.id);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboard, user?.id]);

  const claimReward = async (rewardId: number) => {
    if (!authToken) return;
    setClaiming(rewardId);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/student/rewards/${rewardId}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      setMessage(data.message || (res.ok ? "Reward request sent!" : "Could not claim reward."));
      if (res.ok) await load();
    } finally {
      setClaiming(null);
    }
  };

  if (loading && !engagement) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Library
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">My Progress</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Badges, rewards, and rankings in one place</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>Account</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {engagement && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Level</p>
                <p className="font-black text-lg">{engagement.level.level} · {engagement.level.name}</p>
                <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${engagement.level.progress}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> Streak</div>
                <p className="font-black text-2xl">{engagement.streak}</p>
                <p className="text-xs text-muted-foreground">days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Points</div>
                <p className="font-black text-2xl">{engagement.totalPoints}</p>
                <p className="text-xs text-muted-foreground">total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Medal className="w-3.5 h-3.5" /> Rank</div>
                <p className="font-black text-2xl">{myRank ? `#${myRank}` : "—"}</p>
                <p className="text-xs text-muted-foreground">leaderboard</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-muted/40">
          <button
            onClick={() => setTab("badges")}
            className={`rounded-lg px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 ${tab === "badges" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}
          >
            <Award className="w-4 h-4" />
            <span className="hidden sm:inline">Badges</span>
            <span className="sm:hidden">Badges</span>
          </button>
          <button
            onClick={() => setTab("rewards")}
            className={`rounded-lg px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 ${tab === "rewards" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}
          >
            <Gift className="w-4 h-4" /> Rewards
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className={`rounded-lg px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 ${tab === "leaderboard" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Leaderboard</span>
            <span className="sm:hidden">Ranks</span>
          </button>
        </div>

        {message && (
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm">{message}</div>
        )}

        {tab === "badges" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Award className="w-5 h-5 text-amber-400" /> My Badges</span>
                <span className="text-xs text-muted-foreground">{badgeCounts.unlocked}/{badgeCounts.total} unlocked</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`rounded-xl border p-4 text-center ${badge.unlocked ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-muted/20 opacity-50"}`}
                  >
                    <div className="text-4xl mb-2">{badge.unlocked ? badge.emoji : <Lock className="w-8 h-8 mx-auto text-muted-foreground" />}</div>
                    <p className="font-bold text-sm">{badge.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                    {badge.unlocked && <span className="inline-block mt-2 text-[10px] font-black text-green-400">UNLOCKED</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "rewards" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gift className="w-5 h-5 text-primary" /> My Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              {rewards.length === 0 ? (
                <div className="text-center py-10">
                  <Gift className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold">No rewards yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Keep completing quizzes and challenges.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards.map((reward) => {
                    const status = reward.claimStatus;
                    const canClaim = !!reward.completed && !status;
                    return (
                      <div key={reward.id} className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{reward.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{reward.message}</p>
                            {reward.progress && <p className="text-xs text-primary mt-2">Progress: {reward.progress}</p>}
                          </div>
                          {status && (
                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                              status === "approved" ? "bg-green-500/20 text-green-400" :
                              status === "requested" ? "bg-blue-500/20 text-blue-400" :
                              status === "used" ? "bg-muted text-muted-foreground" :
                              "bg-red-500/20 text-red-400"
                            }`}>
                              {status.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {canClaim && (
                          <Button className="w-full mt-3" onClick={() => claimReward(reward.id)} disabled={claiming === reward.id}>
                            <Gift className="w-4 h-4 mr-1" /> {claiming === reward.id ? "Sending..." : "Claim Reward"}
                          </Button>
                        )}
                        {status === "approved" && (
                          <div className="mt-3 rounded-lg bg-green-500/10 text-green-400 text-sm p-3 text-center font-medium">
                            Approved! Show this to your teacher.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "leaderboard" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground">No rankings yet.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => {
                    const uid = entry.userId || entry.id;
                    const mine = uid === user?.id;
                    return (
                      <div key={uid || index} className={`flex items-center gap-3 rounded-xl p-3 ${mine ? "bg-primary/15 border border-primary/30" : "bg-muted/30"}`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black ${index < 3 ? "bg-amber-500/15 text-amber-400" : "bg-muted text-muted-foreground"}`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{entry.displayName}{mine ? " (You)" : ""}</p>
                          <p className="text-xs text-muted-foreground">{entry.quizzesTaken} quizzes</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary">{entry.totalPoints}</p>
                          <p className="text-[10px] text-muted-foreground">pts</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Want more points?</p>
              <p className="text-xs text-muted-foreground">Go back to the Library for today's missions and Daily Quick Challenge.</p>
            </div>
            <Button size="sm" onClick={() => navigate("/library")}>Go</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
