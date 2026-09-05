import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { Trophy, ArrowLeft, Crown, Medal, Award, GraduationCap } from "lucide-react";
import { BrandText } from "@/components/BrandText";

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalPoints: number;
  quizzesTaken: number;
}

function getMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[m - 1]} ${y}`;
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getRecentMonths(count: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export default function LeaderboardPage() {
  const [, navigate] = useLocation();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all-time" | "monthly">("all-time");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [boardType, setBoardType] = useState<"regular" | "eye-gaze">("regular");
  const [userBand, setUserBand] = useState<string | null>(null);
  const recentMonths = getRecentMonths(6);

  // Fetch user's grade band
  useEffect(() => {
    const token = document.cookie.split('; ').find(c => c.startsWith('token='))?.split('=')[1];
    if (token) {
      fetch(`${API_BASE}/api/user-grade`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.band) setUserBand(data.band); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const base = boardType === "eye-gaze" ? `${API_BASE}/api/tutorial/eye-gaze-leaderboard` : `${API_BASE}/api/tutorial/leaderboard`;
    const params = new URLSearchParams();
    if (period === "monthly") params.set("month", selectedMonth);
    if (userBand) params.set("band", userBand);
    const url = `${base}${params.toString() ? `?${params.toString()}` : ""}`;
    fetch(url)
      .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); })
      .then(data => {
        if (Array.isArray(data)) setLeaderboard(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period, selectedMonth, boardType, userBand]);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const medalColors = [
    { bg: "bg-gradient-to-br from-yellow-500/30 to-yellow-600/10", text: "text-yellow-400", border: "border-yellow-500/30", icon: Crown },
    { bg: "bg-gradient-to-br from-gray-400/30 to-gray-500/10", text: "text-gray-300", border: "border-gray-400/30", icon: Medal },
    { bg: "bg-gradient-to-br from-orange-600/30 to-orange-700/10", text: "text-orange-500", border: "border-orange-600/30", icon: Award },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Login
            </button>
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">A.R.I.S.E<span className="text-primary"> Reader</span></h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
          {userBand ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 mb-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">Your Group: Grades {userBand}</span>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {boardType === "eye-gaze" ? "Eye Gaze / Non-Verbal leaderboard" : "Top readers ranked by points earned"}
          </p>
          {userBand && (
            <p className="text-xs text-muted-foreground mt-1">
              You are competing only with students in your grade band.
            </p>
          )}
        </div>

        {/* Board Type Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setBoardType("regular")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              boardType === "regular"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 border border-border text-foreground hover:bg-muted"
            }`}
          >
            Regular
          </button>
          <button
            onClick={() => setBoardType("eye-gaze")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              boardType === "eye-gaze"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 border border-border text-foreground hover:bg-muted"
            }`}
          >
            Eye Gaze / Non-Verbal
          </button>
        </div>

        {/* Period Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setPeriod("all-time")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === "all-time"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 border border-border text-foreground hover:bg-muted"
            }`}
          >
            All-Time
          </button>
          <button
            onClick={() => setPeriod("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === "monthly"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 border border-border text-foreground hover:bg-muted"
            }`}
          >
            Monthly
          </button>
        </div>

        {/* Month Selector (only for monthly) */}
        {period === "monthly" && (
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            {recentMonths.map(ym => (
              <button
                key={ym}
                onClick={() => setSelectedMonth(ym)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedMonth === ym
                    ? "bg-primary/20 text-primary border border-primary/50"
                    : "bg-muted/30 border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {getMonthLabel(ym)}
              </button>
            ))}
          </div>
        )}

        {/* Period Label */}
        <div className="text-center mb-6">
          <span className="text-sm text-muted-foreground">
            {period === "monthly" ? getMonthLabel(selectedMonth) : "All-Time"} Leaderboard
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <Card className="shadow-md">
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {period === "monthly"
                  ? `No quizzes completed in ${getMonthLabel(selectedMonth)} yet. Check back soon!`
                  : boardType === "eye-gaze"
                    ? "No eye gaze quizzes completed yet. Check back soon!"
                    : "No students have taken quizzes yet. Check back soon!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {top3.map((entry, idx) => {
                  const colors = medalColors[idx];
                  const Icon = colors.icon;
                  return (
                    <Card
                      key={idx}
                      className={`shadow-lg ${colors.border} border-2 overflow-hidden ${
                        idx === 0 ? "sm:order-2 sm:scale-105" : idx === 1 ? "sm:order-1" : "sm:order-3"
                      }`}
                    >
                      <div className={`${colors.bg} p-4 text-center`}>
                        <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center mx-auto mb-2`}>
                          <Icon className={`w-6 h-6 ${colors.text}`} />
                        </div>
                        <p className={`text-lg font-bold ${colors.text}`}>#{entry.rank}</p>
                        <p className="font-bold text-sm text-white mt-1 truncate">{entry.displayName}</p>
                      </div>
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl font-bold text-primary">{entry.totalPoints}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                        <div className="text-xs text-muted-foreground mt-1">{entry.quizzesTaken} quizzes passed</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Remaining entries */}
            {rest.length > 0 && (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Trophy className="w-4 h-4 text-primary" />
                    All Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {rest.map((entry) => (
                      <div
                        key={entry.rank}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm text-muted-foreground flex-shrink-0">
                          {entry.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{entry.displayName}</p>
                          <p className="text-xs text-muted-foreground">{entry.quizzesTaken} quizzes passed</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm text-primary">{entry.totalPoints}</div>
                          <div className="text-xs text-muted-foreground">pts</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Login CTA */}
            <div className="text-center mt-8">
              <p className="text-sm text-muted-foreground mb-4">
                Want to see your name here? Log in and start earning points!
              </p>
              <Button size="lg" onClick={() => navigate("/")} className="gap-2">
                <Trophy className="w-5 h-5" />
                Login to Start Earning Points
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
