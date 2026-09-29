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
  challenge?: { id: string; topic: string; title: string; passage: string };
  questions?: Array<{ id: string; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string }>;
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
    if (!authToken || !challenge?.challenge || !challenge.questions) return;
    if (Object.keys(answers).length < challenge.questions.length) return;
    setChallengeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/engagement/quick-challenge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.challenge.id, answers }),
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
    return <div className="mb-4 h-20 rounded-2xl bg-muted/30 animate-pulse" />;
  }
  if (!summary) return null;

  return (
    <>
      <section className="mb-5 rounded-2xl border border-border bg-card/70 p-3 sm:p-4" data-testid="engagement-hub">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-black text-sm">Level {summary.level.level}: {summary.level.name}</span>
                <span className="text-xs font-bold text-muted-foreground">{summary.totalPoints} pts</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-400"><Flame className="h-3.5 w-3.5" /> {summary.streak} day streak</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${summary.level.progress}%` }} />
              </div>
              <p className="mt-1 text-[10px] font-medium text-muted-foreground">{levelText}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-black"><Target className="h-3.5 w-3.5 text-primary" /> Missions {summary.completedMissions}/3</div>
              <div className="mt-1 flex gap-1">
                {summary.missions.map(mission => <span key={mission.id} title={mission.label} className={`h-2 w-6 rounded-full ${mission.completed ? "bg-green-500" : "bg-muted"}`} />)}
              </div>
            </div>

            <Button size="sm" variant={summary.quickChallengeCompleted ? "outline" : "default"} onClick={openChallenge} className="h-10 rounded-xl">
              <Zap className="mr-1 h-4 w-4" /> {summary.quickChallengeCompleted ? "Challenge done" : "Quick Challenge"}
            </Button>

            {summary.mystery.claimedToday ? (
              <div className="h-10 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 flex items-center gap-2 text-xs font-black text-amber-500">
                <Gift className="h-4 w-4" /> +{summary.mystery.reward || 0}
              </div>
            ) : summary.mystery.unlocked ? (
              <Button onClick={claimMystery} disabled={claiming} size="sm" className="h-10 rounded-xl bg-amber-500 text-black hover:bg-amber-600">
                <Gift className="mr-1 h-4 w-4" /> {claiming ? "Opening..." : "Mystery Box"}
              </Button>
            ) : null}
          </div>
        </div>
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
          ) : challenge?.challenge && challenge.questions ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-primary">{challenge.challenge.topic}</p>
                  <span className="text-[10px] text-muted-foreground">Read this first</span>
                </div>
                <p className="font-bold text-base">{challenge.challenge.title}</p>
                <p className="text-sm leading-relaxed mt-2 text-foreground/90">{challenge.challenge.passage}</p>
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
              <p className="text-center text-xs text-muted-foreground">No book required. Read the short passage above, then get 2 out of 3 correct for +5 leaderboard points.</p>
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
