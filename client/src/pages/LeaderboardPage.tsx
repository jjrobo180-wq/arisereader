import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { Trophy, ArrowLeft, Crown, Medal, Award, GraduationCap, Users, Pizza } from "lucide-react";
import { BrandText } from "@/components/BrandText";

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalPoints: number;
  quizzesTaken: number;
  isEyeGazeUser?: boolean;
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
  const [userBand, setUserBand] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<string | null>(null);
  const [showEGInfo, setShowEGInfo] = useState(false);
  const [advisoryData, setAdvisoryData] = useState<any[]>([]);
  const [view, setView] = useState<"individual" | "advisory">("individual");
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
    const token = document.cookie.split('; ').find(c => c.startsWith('token='))?.split('=')[1];
    // Use authenticated endpoint when logged in (respects teacher band filtering),
    // fall back to public tutorial endpoint when not logged in
    const isAuthed = !!token;
    const base = isAuthed ? `${API_BASE}/api/leaderboard` : `${API_BASE}/api/tutorial/leaderboard`;
    const params = new URLSearchParams();
    if (period === "monthly") params.set("month", selectedMonth);
    if (selectedBand) params.set("band", selectedBand);
    else if (userBand) params.set("band", userBand);
    const url = `${base}${params.toString() ? `?${params.toString()}` : ""}`;
    const headers: Record<string, string> = isAuthed ? { Authorization: `Bearer ${token}` } : {};
    fetch(url, { headers })
      .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); })
      .then(data => {
        if (Array.isArray(data)) setLeaderboard(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period, selectedMonth, userBand, selectedBand]);

  // Fetch advisory leaderboard
  useEffect(() => {
    const authToken = document.cookie.match(/arise_session=([^;]+)/);
    if (!authToken) return;
    try {
      const token = JSON.parse(atob(authToken[1])).token;
      fetch(`${API_BASE}/api/advisory-leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(data => { if (Array.isArray(data)) setAdvisoryData(data); })
        .catch(() => {});
    } catch {}
  }, []);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const medalColors = [
    { bg: "bg-gradient-to-br from-yellow-500/30 to-yellow-600/10", text: "text-yellow-400", border: "border-yellow-500/30", icon: Crown },
    { bg: "bg-gradient-to-br from-gray-400/30 to-gray-500/10", text: "text-gray-300", border: "border-gray-400/30", icon: Medal },
    { bg: "bg-gradient-to-br from-fuchsia-500/25 to-violet-600/10", text: "text-fuchsia-300", border: "border-fuchsia-400/25", icon: Award },
  ];

  return (
    <div className="min-h-screen arise-page-bg">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0d0b1a]/92 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Login
            </button>
          </div>
          <h1 className="text-xl font-black text-white tracking-[-.025em]">A.R.I.S.E<span className="arise-gradient-text"> Reader</span></h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl arise-icon-tile flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-[-.035em]">Leaderboard</h1>
          {userBand ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/14 via-fuchsia-500/10 to-cyan-400/12 border border-violet-400/25 mb-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-violet-200">Your Group: Grades {userBand}</span>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Top readers ranked by points earned
          </p>
          {userBand && (
            <p className="text-xs text-muted-foreground mt-1">
              You are competing only with students in your grade band.
            </p>
          )}
        </div>

        {/* View Tabs */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setView("individual")}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
              view === "individual"
                ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-lg shadow-violet-500/15"
                : "bg-white/[.04] border border-white/10 text-slate-300 hover:bg-white/[.08]"
            }`}
          >
            <Trophy className="w-4 h-4" />
            Individual
          </button>
          <button
            onClick={() => setView("advisory")}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
              view === "advisory"
                ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-lg shadow-violet-500/15"
                : "bg-white/[.04] border border-white/10 text-slate-300 hover:bg-white/[.08]"
            }`}
          >
            <Pizza className="w-4 h-4" />
            Advisory Challenge
          </button>
        </div>

        {view === "individual" ? (
        <>
        {/* Band Filter Buttons */}
        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setSelectedBand(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedBand
                ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-lg shadow-violet-500/15"
                : "bg-white/[.04] border border-white/10 text-slate-300 hover:bg-white/[.08]"
            }`}
          >
            <Users className="w-3 h-3 inline mr-1" />
            All Bands
          </button>
          {["K-2", "3-5", "6-8", "9-12"].map((band) => (
            <button
              key={band}
              onClick={() => setSelectedBand(band)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedBand === band
                  ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-lg shadow-violet-500/15"
                  : "bg-white/[.04] border border-white/10 text-slate-300 hover:bg-white/[.08]"
              }`}
            >
              Grades {band}
            </button>
          ))}
        </div>

        {/* Period Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setPeriod("all-time")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === "all-time"
                ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-lg shadow-violet-500/15"
                : "bg-white/[.04] border border-white/10 text-slate-300 hover:bg-white/[.08]"
            }`}
          >
            All-Time
          </button>
          <button
            onClick={() => setPeriod("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === "monthly"
                ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-lg shadow-violet-500/15"
                : "bg-white/[.04] border border-white/10 text-slate-300 hover:bg-white/[.08]"
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
                    : "bg-white/[.04] border border-white/10 text-slate-400 hover:bg-white/[.08]"
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
          <Card className="arise-surface border-white/10 shadow-md">
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {period === "monthly"
                  ? `No quizzes completed in ${getMonthLabel(selectedMonth)} yet. Check back soon!`
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
                      className={`arise-surface shadow-lg ${colors.border} border-2 overflow-hidden ${
                        idx === 0 ? "sm:order-2 sm:scale-105" : idx === 1 ? "sm:order-1" : "sm:order-3"
                      }`}
                    >
                      <div className={`${colors.bg} p-4 text-center`}>
                        <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center mx-auto mb-2`}>
                          <Icon className={`w-6 h-6 ${colors.text}`} />
                        </div>
                        <p className={`text-lg font-bold ${colors.text}`}>#{entry.rank}</p>
                        <p className="font-bold text-sm text-white mt-1 truncate flex items-center gap-1 justify-center">
                          {entry.displayName}
                          {entry.isEyeGazeUser && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShowEGInfo(!showEGInfo); }}
                              className="ml-1 text-xs px-1 py-0.5 rounded bg-yellow-500/30 text-yellow-300 font-semibold cursor-pointer hover:bg-yellow-500/50 transition-colors"
                            >!EG</button>
                          )}
                        </p>
                      </div>
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl font-bold text-violet-300">{entry.totalPoints}</div>
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
              <Card className="arise-surface border-white/10 shadow-md">
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
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[.035] hover:bg-white/[.07] border border-white/[.06] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-400/15 border border-white/10 flex items-center justify-center font-bold text-sm text-slate-300 flex-shrink-0">
                          {entry.rank}
                        </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate flex items-center gap-1">
                              {entry.displayName}
                              {entry.isEyeGazeUser && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setShowEGInfo(!showEGInfo); }}
                                  className="text-xs px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-semibold flex-shrink-0 cursor-pointer hover:bg-yellow-500/40 transition-colors"
                                >!EG</button>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{entry.quizzesTaken} quizzes passed</p>
                          </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm text-violet-300">{entry.totalPoints}</div>
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
              <Button size="lg" onClick={() => navigate("/")} className="gap-2 arise-gradient-button rounded-full font-black px-6">
                <Trophy className="w-5 h-5" />
                Login to Start Earning Points
              </Button>
            </div>
          </>
        )}
        </>
        ) : (
          /* Advisory Challenge View */
          <>
            {/* Advisory Challenge — Pizza Party */}
            <div className="rounded-2xl overflow-hidden border border-violet-400/25 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
              <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 py-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Pizza className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Advisory Challenge</h2>
                  <p className="text-sm text-white/90">The advisory with the most points wins a PIZZA PARTY!</p>
                </div>
              </div>
              <div className="bg-[#151326] p-4 sm:p-6">
                {advisoryData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No advisory data yet. Keep reading!</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {advisoryData.map((adv: any) => (
                        <div
                          key={adv.teacherId}
                          className={`flex items-center gap-4 rounded-xl p-4 transition-all ${
                            adv.rank === 1
                              ? "bg-gradient-to-r from-violet-500/12 via-fuchsia-500/[.08] to-cyan-400/[.08] border border-violet-400/25"
                              : "bg-muted/30 border border-border"
                          }`}
                        >
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            adv.rank === 1
                              ? "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-white"
                              : adv.rank === 2
                              ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white"
                              : adv.rank === 3
                              ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {adv.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-sm sm:text-base text-foreground">{adv.teacherName}'s Advisory</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {adv.studentCount} student{adv.studentCount !== 1 ? "s" : ""} · {adv.quizzesCompleted} quiz{adv.quizzesCompleted !== 1 ? "zes" : ""} completed
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-lg text-violet-300">{adv.totalPoints}</div>
                            <div className="text-[10px] text-muted-foreground">pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                      Points are earned by every student in each advisory class through reading quizzes. The advisory with the highest total at the end of the competition wins a pizza party!
                    </p>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* !EG Info Popup */}
        {showEGInfo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowEGInfo(false)}
          >
            <div
              className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 font-bold">!EG</span>
                  <h3 className="font-bold text-base">What does !EG mean?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEGInfo(false)}
                  className="text-muted-foreground hover:text-foreground text-lg leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">!EG</strong> stands for <strong className="text-foreground">Eye Gaze</strong>. Students with this badge use eye-tracking technology or alternative access methods to take their quizzes.
                </p>
                <p>
                  These students compete on the <strong className="text-foreground">same leaderboard</strong> as everyone else in their grade band. We recognize that they navigate reading and comprehension differently, so their quiz points are <strong className="text-foreground">curved higher</strong> to ensure they're never at a disadvantage.
                </p>
                <p>
                  We regularly review performance data to adjust point values. You may notice a slight increase on an EG student's leaderboard score from time to time (never a decrease) to keep competition fair and inclusive.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full mt-5"
                onClick={() => setShowEGInfo(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
