import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Flame, Gift, Sparkles, Target, Trophy, Zap } from "lucide-react";

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

type Mission = { id: string; label: string; detail: string; completed: boolean };
type Summary = {
  missions: Mission[];
  completedMissions: number;
  streak: number;
  totalPoints: number;
  level: { level: number; name: string; progress: number; nextName: string | null; nextPoints: number | null };
  personalBest: { thisWeekPoints: number; lastWeekPoints: number; beatLastWeek: boolean };
  mystery: { unlocked: boolean; claimedToday: boolean; reward: number | null };
  quickChallengeCompleted: boolean;
};

type Challenge = {
  completed?: boolean;
  score?: number;
  points?: number;
  book?: { id: number; title: string; author: string; coverUrl?: string | null };
  questions?: Array<{ id: number; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string }>;
};

export function EngagementHub() {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [rewardReveal, setRewardReveal] = useState<number | null>(null);

  const authToken = token || getTokenFromCookie();

  const loadSummary = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/engagement/summary`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      if (res.ok) setSummary(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "student" && !user?.isAdmin) loadSummary();
  }, [user?.id, token]);

  const openChallenge = async () => {
    if (!authToken) return;
    setShowChallenge(true);
    setChallengeLoading(true);
    setResult(null);
    setAnswers({});
    try {
      const res = await fetch(`${API_BASE}/api/engagement/quick-challenge`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      const data = await res.json();
      setChallenge(data);
    } catch {
      setChallenge(null);
    } finally {
      setChallengeLoading(false);
    }
  };

  const submitChallenge = async () => {
    if (!authToken || !challenge?.book || !challenge.questions) return;
    if (Object.keys(answers).length < challenge.questions.length) return;
    setChallengeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/engagement/quick-challenge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: challenge.book.id, answers }),
      });
      const data = await res.json();
      setResult(data);
      if (res.ok) {
        await loadSummary();
        window.dispatchEvent(new Event("arise-points-updated"));
      }
    } finally {
      setChallengeLoading(false);
    }
  };

  const claimMystery = async () => {
    if (!authToken || claiming) return;
    setClaiming(true);
    try {
      const res = await fetch(`${API_BASE}/api/engagement/mystery`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRewardReveal(data.points);
        await loadSummary();
        window.dispatchEvent(new Event("arise-points-updated"));
      } else {
        window.alert(data.message || "Could not open Mystery Box.");
      }
    } finally {
      setClaiming(false);
    }
  };

  const levelText = useMemo(() => {
    if (!summary) return "";
    if (!summary.level.nextPoints) return "MAX LEVEL";
    return `${Math.max(0, summary.level.nextPoints - summary.totalPoints)} pts to ${summary.level.nextName}`;
  }, [summary]);

  if (user?.role !== "student" || user?.isAdmin) return null;

  if (loading) {
    return <div className="mb-8 h-40 rounded-2xl bg-muted/30 animate-pulse" />;
  }
  if (!summary) return null;

  return (
    <>
      <section className="mb-8 space-y-4" data-testid="engagement-hub">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="w-4 h-4 text-primary" /> Level {summary.level.level}</div>
              <div className="font-bold mt-1">{summary.level.name}</div>
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${summary.level.progress}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{levelText}</p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="w-4 h-4 text-orange-400" /> Reading Streak</div>
              <div className="text-2xl font-bold mt-1">{summary.streak} day{summary.streak === 1 ? "" : "s"}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Do one reading activity today to keep it going.</p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Zap className="w-4 h-4 text-green-400" /> This Week</div>
              <div className="text-2xl font-bold mt-1">{summary.personalBest.thisWeekPoints} pts</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Last week: {summary.personalBest.lastWeekPoints} pts
                {summary.personalBest.beatLastWeek ? " · New personal best!" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className={summary.mystery.unlocked ? "border-amber-500/50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Gift className="w-4 h-4 text-amber-400" /> Mystery Box</div>
              {summary.mystery.claimedToday ? (
                <>
                  <div className="font-bold mt-1">Opened!</div>
                  <p className="text-[11px] text-muted-foreground mt-1">You won +{summary.mystery.reward || 0} points today.</p>
                </>
              ) : summary.mystery.unlocked ? (
                <Button onClick={claimMystery} disabled={claiming} size="sm" className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-black">
                  <Sparkles className="w-4 h-4 mr-1" /> {claiming ? "Opening..." : "Open Box"}
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-2">Complete any 2 missions to unlock it.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-primary/30">
          <CardContent className="p-0">
            <div className="p-4 sm:p-5 bg-primary/10 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">Today's Missions</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{summary.completedMissions}/3 complete · Finish any 2 to unlock your Mystery Box.</p>
              </div>
              <Button variant={summary.quickChallengeCompleted ? "outline" : "default"} onClick={openChallenge}>
                <Zap className="w-4 h-4 mr-1" />
                {summary.quickChallengeCompleted ? "View Quick Challenge" : "3-Question Challenge"}
              </Button>
            </div>

            <div className="grid sm:grid-cols-3 gap-px bg-border">
              {summary.missions.map((mission) => (
                <div key={mission.id} className="bg-card p-4 flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${mission.completed ? "bg-green-500/20" : "bg-muted"}`}>
                    {mission.completed ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Target className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${mission.completed ? "text-green-400" : ""}`}>{mission.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{mission.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={showChallenge} onOpenChange={setShowChallenge}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-6"><Zap className="w-5 h-5 text-amber-400" /> Daily Quick Challenge</DialogTitle>
          </DialogHeader>

          {challengeLoading && !challenge ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading today's challenge...</div>
          ) : challenge?.completed ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="font-bold text-lg">Already completed today!</h3>
              <p className="text-sm text-muted-foreground mt-1">Score: {challenge.score}/3 · +{challenge.points || 0} points</p>
            </div>
          ) : result ? (
            <div className="py-6 text-center">
              <div className="text-5xl mb-3">{result.passed ? "⚡" : "💪"}</div>
              <h3 className="font-bold text-xl">{result.passed ? "Challenge cleared!" : "Challenge complete!"}</h3>
              <p className="text-muted-foreground mt-2">You got {result.score}/3 correct.</p>
              <p className="font-bold text-primary text-lg mt-2">+{result.points || 0} points</p>
              {!result.passed && <p className="text-xs text-muted-foreground mt-2">You still completed today's mission. Try again tomorrow for a new challenge.</p>}
              <Button className="mt-5" onClick={() => setShowChallenge(false)}>Done</Button>
            </div>
          ) : challenge?.book && challenge.questions ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Today's challenge</p>
                <p className="font-bold">{challenge.book.title}</p>
                <p className="text-xs text-muted-foreground">{challenge.book.author}</p>
              </div>

              {challenge.questions.map((q, index) => (
                <div key={q.id} className="space-y-2">
                  <p className="font-semibold text-sm">{index + 1}. {q.questionText}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(["A", "B", "C", "D"] as const).map(letter => {
                      const text = q[`option${letter}` as keyof typeof q] as string;
                      const selected = answers[String(q.id)] === letter;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => setAnswers(prev => ({ ...prev, [String(q.id)]: letter }))}
                          className={`text-left rounded-lg border p-3 text-sm transition-colors ${selected ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card hover:bg-muted/50"}`}
                        >
                          <span className="font-bold mr-1">{letter})</span>{text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <Button className="w-full" onClick={submitChallenge} disabled={challengeLoading || Object.keys(answers).length < 3}>
                {challengeLoading ? "Checking..." : "Submit Challenge"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">2 out of 3 correct earns +5 leaderboard points.</p>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">No Daily Quick Challenge is available right now.</div>
          )}
        </DialogContent>
      </Dialog>

      {rewardReveal !== null && (
        <Dialog open={rewardReveal !== null} onOpenChange={() => setRewardReveal(null)}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader><DialogTitle>Mystery Box Opened!</DialogTitle></DialogHeader>
            <div className="py-6">
              <div className="text-6xl mb-4">🎁</div>
              <p className="text-lg">You found</p>
              <p className="text-4xl font-black text-primary my-2">+{rewardReveal}</p>
              <p className="font-semibold">BONUS POINTS!</p>
              <Button className="mt-6 w-full" onClick={() => setRewardReveal(null)}>Nice!</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
