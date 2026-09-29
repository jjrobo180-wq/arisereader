import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Flame, Gamepad2, Gift, Sparkles, Target, Trophy, Zap } from "lucide-react";

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

export function EngagementHub({ onCreateQuiz, onReadingLevelUp }: { onCreateQuiz?: () => void; onReadingLevelUp?: () => void }) {
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
    return <div className="mb-3 h-16 rounded-xl bg-muted/30 animate-pulse" />;
  }
  if (!summary) return null;

  return (
    <>
      <section className="mb-4 border-b border-border/70 pb-3 md:pb-4" data-testid="engagement-hub">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-black">Level {summary.level.level} · {summary.level.name}</span>
              <span className="font-semibold text-foreground/80">{summary.totalPoints} pts</span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground/80"><Flame className="h-3.5 w-3.5 text-orange-500" /> {summary.streak} day streak</span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground/80"><Target className="h-3.5 w-3.5 text-primary" /> {summary.completedMissions}/3 missions</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-48 max-w-[45vw] overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${summary.level.progress}%` }} />
              </div>
              <span className="text-[10px] font-bold text-foreground/65">{levelText}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!user?.is_eye_gaze_user && (
              <Button size="sm" onClick={() => window.location.hash = "/live-quiz"} className="h-9 shrink-0 rounded-lg bg-foreground px-3 text-xs font-black text-background hover:bg-foreground/90">
                <Gamepad2 className="mr-1.5 h-4 w-4" /> Join Live
              </Button>
            )}
            {onCreateQuiz && (
              <Button size="sm" variant="outline" onClick={onCreateQuiz} className="h-9 shrink-0 rounded-lg px-3 text-xs font-black">
                <Sparkles className="mr-1.5 h-4 w-4" /> Create Quiz
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={openChallenge} className="h-9 rounded-lg px-3 text-xs font-black">
              <Zap className="mr-1.5 h-4 w-4 text-amber-500" /> {summary.quickChallengeCompleted ? "Challenge done" : "Quick Challenge"}
            </Button>
            {onReadingLevelUp && !user?.is_eye_gaze_user && (
              <Button size="sm" variant="ghost" onClick={onReadingLevelUp} className="h-9 rounded-lg px-3 text-xs font-black">
                <Trophy className="mr-1.5 h-4 w-4 text-primary" /> Level Up
              </Button>
            )}
            {summary.mystery.claimedToday ? (
              <span className="inline-flex h-9 items-center gap-1.5 px-2 text-xs font-bold text-amber-500"><Gift className="h-4 w-4" /> +{summary.mystery.reward || 0}</span>
            ) : summary.mystery.unlocked ? (
              <Button onClick={claimMystery} disabled={claiming} size="sm" variant="ghost" className="h-9 rounded-lg px-3 text-xs font-black text-amber-600">
                <Gift className="mr-1.5 h-4 w-4" /> {claiming ? "Opening..." : "Mystery Box"}
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
