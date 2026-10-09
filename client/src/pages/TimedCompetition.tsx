// The page of a short competition (the Fall Break Competition): its own leaderboard, counting only
// points earned between its start and its end. Anyone with the link can open it, signed in or not.
// The rules are in shared/timedCompetitions.ts; the list comes from /api/competitions/<slug>.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Award, Crown, Medal, RefreshCw, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { safeBack } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { timeLeft } from "@shared/schoolMonth";

type Entry = { rank: number; tied: boolean; displayName: string; points: number; quizzesPassed: number; isEyeGazeUser: boolean };
type Board = {
  competition: { slug: string; title: string; prize: string; startsAt: string; endsAt: string; startText: string; endText: string };
  phase: "soon" | "live" | "over";
  entries: Entry[];
  updatedAt: string;
};

/** How often the list is read again while the page is open. */
const REFRESH_MS = 60_000;
const MEDALS = [Crown, Medal, Award];
const MEDAL_COLORS = ["text-yellow-400", "text-gray-300", "text-orange-500"];
const quizzes = (n: number) => `${n} ${n === 1 ? "quiz" : "quizzes"} passed`;
const points = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? "point" : "points"}`;

function Countdown({ to, label, onDone }: { to: number; label: string; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = to - now;
  useEffect(() => { if (left <= 0) onDone(); }, [left <= 0]);
  if (left <= 0) return null;
  const t = timeLeft(left);
  const parts: [string, number][] = [["Days", t.days], ["Hours", t.hours], ["Min", t.minutes], ["Sec", t.seconds]];
  return (
    <div className="mt-4 flex items-center justify-center gap-2" role="timer" aria-label={`${label} ${t.days} days, ${t.hours} hours, ${t.minutes} minutes`} data-testid="competition-countdown">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {parts.map(([name, value]) => (
        <div key={name} className="flex flex-col items-center">
          <div className="min-w-[40px] rounded-lg border border-border bg-card px-2 py-1 text-center"><span className="text-base font-bold tabular-nums text-primary">{String(value).padStart(2, "0")}</span></div>
          <span className="mt-0.5 text-[9px] text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  );
}

export default function TimedCompetition({ slug }: { slug: string }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let current = true;
    fetch(`${API_BASE}/api/competitions/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (r) => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.message || "The leaderboard could not be loaded."); return data as Board; })
      .then((data) => { if (current) { setBoard(data); setError(""); } })
      .catch((e) => { if (current) setError(e?.message || "The leaderboard could not be loaded."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [slug, tick]);
  // The list keeps itself up to date while the page is open.
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), REFRESH_MS); return () => clearInterval(t); }, []);

  const c = board?.competition;
  const leaders = board?.entries.filter((e) => e.rank === 1) || [];
  const reload = () => setTick((n) => n + 1);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => safeBack(navigate)} className="flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Back</button>
          <div className="text-xl font-bold tracking-wide text-white">A.R.I.S.E<span className="text-primary"> Reader</span></div>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8" data-testid="timed-competition">
        {loading && !board ? (
          <div className="flex items-center justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : !board || !c ? (
          <div className="py-16 text-center">
            <p role="alert" className="text-sm text-destructive">{error || "The leaderboard could not be loaded."}</p>
            <button onClick={reload} className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted">Try again</button>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/30 to-orange-600/10"><Trophy className="h-10 w-10 text-yellow-400" /></div>
              <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">{c.title}</h1>
              <p className="mx-auto max-w-md text-base font-semibold text-yellow-300" data-testid="competition-prize">The reader who earns the most points wins {c.prize}.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground" data-testid="competition-dates">{c.startText} to {c.endText}, Mountain Time.</p>
              {board.phase === "live" && <Countdown to={Date.parse(c.endsAt)} label="Ends in" onDone={reload} />}
              {board.phase === "soon" && <Countdown to={Date.parse(c.startsAt)} label="Starts in" onDone={reload} />}
              {board.phase === "over" && (
                <p className="mx-auto mt-4 max-w-md rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-white" data-testid="competition-over">
                  {leaders.length === 0 ? "The competition is over. Nobody earned points in it." : leaders.length === 1 ? `The competition is over. ${leaders[0].displayName} won with ${points(leaders[0].points)}!` : `The competition is over. It ended in a tie at ${points(leaders[0].points)}: ${leaders.map((l) => l.displayName).join(" and ")}.`}
                </p>
              )}
            </div>

            <Card className="overflow-hidden border border-yellow-500/20 shadow-md">
              <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-yellow-500/15 to-transparent px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Trophy className="h-4 w-4 text-yellow-400" /> {board.phase === "over" ? "Final standings" : "Leaderboard"}</h2>
                <button onClick={reload} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Refresh the leaderboard"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
              </div>
              <CardContent className="p-3">
                {board.entries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground" data-testid="competition-empty">{board.phase === "soon" ? "It has not started yet. Points count from the start time." : board.phase === "live" ? "No points yet. Be the first: read a book and pass its quiz." : "Nobody earned points."}</p>
                ) : (
                  <ol className="space-y-2" data-testid="competition-list">
                    {board.entries.map((entry, i) => {
                      const Icon = MEDALS[entry.rank - 1];
                      return (
                        <li key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${entry.rank === 1 ? "border-yellow-500/40 bg-yellow-500/10" : "border-border bg-muted/20"}`} data-testid="competition-entry">
                          <div className="flex w-9 shrink-0 flex-col items-center">
                            {Icon ? <Icon className={`h-5 w-5 ${MEDAL_COLORS[entry.rank - 1]}`} aria-hidden /> : null}
                            <span className="text-xs font-bold text-muted-foreground">{entry.tied ? `T${entry.rank}` : `#${entry.rank}`}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="break-words text-sm font-bold text-white">{entry.displayName}</div>
                            <div className="text-xs text-muted-foreground">{quizzes(entry.quizzesPassed)}{entry.tied ? " · tied" : ""}</div>
                          </div>
                          <div className="shrink-0 text-right"><span className="text-lg font-bold tabular-nums text-primary">{Number.isInteger(entry.points) ? entry.points : entry.points.toFixed(1)}</span>{" "}<span className="text-xs text-muted-foreground">pts</span></div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground" data-testid="competition-rules">
              <h2 className="mb-2 text-sm font-bold text-white">How it works</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Only points earned from {c.startText} to {c.endText} count here. Points from before do not.</li>
                <li>Read a book, then pass its quiz with 70% or higher to earn that book's points.</li>
                <li>If readers finish with the same points, they are shown as tied.</li>
              </ul>
              {board.phase !== "over" && (
                <button onClick={() => navigate(user ? "/library" : "/")} className="mt-4 min-h-11 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90">{user ? "Find a book" : "Log in to play"}</button>
              )}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground" data-testid="competition-updated">Updated {new Date(board.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. The list refreshes every minute.</p>
          </>
        )}
      </main>
    </div>
  );
}
