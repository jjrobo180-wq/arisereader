import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { safeBack } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { Trophy, ArrowLeft, Crown, Medal, Award, GraduationCap, Users, Star, Calendar } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PrizeBoard } from "@/components/prizes/PrizeBoard";

/** "1 quiz passed" / "3 quizzes passed" (older servers only sent quizzes taken). */
const passedLabel = (entry: { quizzesPassed?: number; quizzesTaken?: number }) => {
  const n = Number(entry.quizzesPassed ?? entry.quizzesTaken ?? 0);
  return `${n} ${n === 1 ? "quiz" : "quizzes"} passed`;
};

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalPoints: number;
  quizzesTaken: number;
  quizzesPassed?: number;
  isEyeGazeUser?: boolean;
}

interface CompetitionSettings {
  monthlyCountdownDate: string;
  yearlyCountdownDate: string;
}

const DEFAULT_SETTINGS: CompetitionSettings = {
  monthlyCountdownDate: "",
  yearlyCountdownDate: "",
};

const BANDS = ["K-2", "3-5", "6-8", "9-12"];

// Countdown timer component — shows days/hours/minutes/seconds remaining
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!targetDate) { setTimeLeft(null); return; }
    const calc = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate + "T23:59:59").getTime();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft(null); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  const parts = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Min", value: timeLeft.minutes },
    { label: "Sec", value: timeLeft.seconds },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mt-3">
      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Ends in</span>
      {parts.map((p) => (
        <div key={p.label} className="flex flex-col items-center">
          <div className="bg-card border border-border rounded-lg px-2 py-1 min-w-[36px] text-center">
            <span className="text-sm font-bold text-primary tabular-nums">{String(p.value).padStart(2, "0")}</span>
          </div>
          <span className="text-[8px] text-muted-foreground mt-0.5">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

const BAND_LABELS: Record<string, string> = {
  "K-2": "K-2 Band",
  "3-5": "3-5 Band",
  "6-8": "6-8 Band",
  "9-12": "9-12 Band",
};

const BAND_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "K-2": { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  "3-5": { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400" },
  "6-8": { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400" },
  "9-12": { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400" },
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
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

export default function Competition() {
  const [, navigate] = useLocation();
  const { user, token } = useAuth();
  const [tab, setTab] = useState<"monthly" | "yearly">("monthly");
  const [monthlyBandLeaders, setMonthlyBandLeaders] = useState<Record<string, LeaderboardEntry[]>>({});
  const [yearlyBandLeaders, setYearlyBandLeaders] = useState<Record<string, LeaderboardEntry[]>>({});
  const [overallYearlyTop, setOverallYearlyTop] = useState<LeaderboardEntry[]>([]);
  const [monthlyTop, setMonthlyTop] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [settings, setSettings] = useState<CompetitionSettings>(DEFAULT_SETTINGS);
  const [advisoryData, setAdvisoryData] = useState<any[]>([]);
  const recentMonths = getRecentMonths(6);

  useEffect(() => {
    // Fetch competition settings (public)
    fetch(`${API_BASE}/api/competition-settings`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        }
      })
      .catch(() => {});

    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch monthly leaderboard for all bands
        const monthlyPromises = BANDS.map(async (band) => {
          const res = await fetch(`${API_BASE}/api/tutorial/leaderboard?band=${encodeURIComponent(band)}&month=${encodeURIComponent(selectedMonth)}`);
          if (!res.ok) return { band, data: [] };
          const data = await res.json();
          return { band, data: Array.isArray(data) ? data : [] };
        });
        const monthlyResults = await Promise.all(monthlyPromises);

        const mLeaders: Record<string, LeaderboardEntry[]> = {};
        let monthlyAll: LeaderboardEntry[] = [];
        for (const { band, data } of monthlyResults) {
          mLeaders[band] = data.slice(0, 3);
          monthlyAll = monthlyAll.concat(data);
        }
        monthlyAll.sort((a, b) => b.totalPoints - a.totalPoints);
        setMonthlyBandLeaders(mLeaders);
        setMonthlyTop(monthlyAll.slice(0, 3));

        // Fetch all-time (yearly) leaderboard for all bands
        const yearlyPromises = BANDS.map(async (band) => {
          const res = await fetch(`${API_BASE}/api/tutorial/leaderboard?band=${encodeURIComponent(band)}`);
          if (!res.ok) return { band, data: [] };
          const data = await res.json();
          return { band, data: Array.isArray(data) ? data : [] };
        });
        const yearlyResults = await Promise.all(yearlyPromises);

        const yLeaders: Record<string, LeaderboardEntry[]> = {};
        let yearlyAll: LeaderboardEntry[] = [];
        for (const { band, data } of yearlyResults) {
          yLeaders[band] = data.slice(0, 3);
          yearlyAll = yearlyAll.concat(data);
        }
        yearlyAll.sort((a, b) => b.totalPoints - a.totalPoints);
        setYearlyBandLeaders(yLeaders);
        setOverallYearlyTop(yearlyAll.slice(0, 3));

        // Fetch advisory leaderboard
        try {
          const authToken = document.cookie.match(/arise_session=([^;]+)/);
          const headers: Record<string, string> = {};
          if (authToken) headers["Authorization"] = `Bearer ${JSON.parse(atob(authToken[1])).token}`;
          // the advisory standings need a signed-in account; visitors just see the empty state
          const advisoryRes = headers["Authorization"] ? await fetch(`${API_BASE}/api/advisory-leaderboard`, { headers }) : null;
          if (advisoryRes?.ok) {
            const advData = await advisoryRes.json();
            if (Array.isArray(advData)) setAdvisoryData(advData);
          }
        } catch {}

        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    };
    fetchAll();
  }, [selectedMonth]);

  const medalIcons = [Crown, Medal, Award];
  const medalColors = ["text-yellow-400", "text-gray-300", "text-orange-500"];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => safeBack(navigate)}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <h1 className="text-xl font-bold text-white tracking-wide">A.R.I.S.E<span className="text-primary"> Reader</span></h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/30 to-orange-600/10 flex items-center justify-center mx-auto mb-4 border-2 border-yellow-500/30">
            <Trophy className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Reading Competition</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Read books, pass quizzes, and earn points to climb the monthly and yearly leaderboards.
          </p>
        </div>

        {/* Prizes this reader's own family, teacher and school have put up. Nothing shows when there are none. */}
        <div className="mb-6 empty:hidden">
          <PrizeBoard token={token} />
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setTab("monthly")}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
              tab === "monthly"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 border border-border text-foreground hover:bg-muted"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Monthly
          </button>
          <button
            onClick={() => setTab("yearly")}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
              tab === "yearly"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 border border-border text-foreground hover:bg-muted"
            }`}
          >
            <Star className="w-4 h-4" />
            Reader of the Year
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === "monthly" ? (
          <>
            {/* Monthly Competition */}
            <div className="space-y-6">
              {/* Countdown to the end of this month's competition, when the admin has set one */}
              {settings.monthlyCountdownDate && (
                <Card className="shadow-lg overflow-hidden border-2 border-yellow-500/30">
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-600/10 p-4 sm:p-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-yellow-400" />
                      <h2 className="text-lg font-bold text-white">This month's competition</h2>
                    </div>
                    <CountdownTimer targetDate={settings.monthlyCountdownDate} />
                  </div>
                </Card>
              )}

              {/* Month Selector */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {recentMonths.map((ym) => (
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

              {/* Month Label */}
              <div className="text-center">
                <span className="text-sm text-muted-foreground font-medium">
                  {getMonthLabel(selectedMonth)} Leaderboard
                </span>
              </div>

              {/* Monthly Overall Top 3 */}
              {monthlyTop.length > 0 && (
                <Card className="shadow-md overflow-hidden border border-yellow-500/20">
                  <div className="bg-gradient-to-r from-yellow-500/15 to-transparent px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <h3 className="font-bold text-sm text-white">Top Readers This Month — All Bands</h3>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      {monthlyTop.map((entry, idx) => {
                        const Icon = medalIcons[idx] || Star;
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 p-2.5 rounded-lg ${idx === 0 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-muted/20"}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${idx === 0 ? "bg-yellow-500/30" : "bg-muted"}`}>
                              <Icon className={`w-4 h-4 ${medalColors[idx]}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-white truncate">{entry.displayName}</p>
                              <p className="text-[10px] text-muted-foreground">{passedLabel(entry)}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-sm text-primary">{entry.totalPoints}</div>
                              <div className="text-[10px] text-muted-foreground">pts</div>
                            </div>
                            {idx === 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300 whitespace-nowrap">
                                CURRENT LEADER
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Monthly Band Leaders */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-white">Top Readers by Band — {getMonthLabel(selectedMonth)}</h2>
                </div>

                <div className="space-y-4">
                  {BANDS.map((band) => {
                    const leaders = monthlyBandLeaders[band] || [];
                    if (leaders.length === 0) return null;
                    const colors = BAND_COLORS[band];
                    return (
                      <Card key={band} className={`shadow-md overflow-hidden border ${colors.border}`}>
                        <div className={`${colors.bg} px-4 py-3 flex items-center gap-2`}>
                          <GraduationCap className={`w-4 h-4 ${colors.text}`} />
                          <h3 className={`font-bold text-sm ${colors.text}`}>{BAND_LABELS[band]}</h3>
                          <span className="text-[10px] text-muted-foreground ml-auto">Top {leaders.length}</span>
                        </div>
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            {leaders.map((entry, idx) => {
                              const Icon = medalIcons[idx] || Star;
                              const isLeader = idx === 0;
                              return (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg ${isLeader ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-muted/20"}`}
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isLeader ? "bg-yellow-500/30" : "bg-muted"}`}>
                                    <Icon className={`w-4 h-4 ${medalColors[idx]}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-white truncate">{entry.displayName}</p>
                                    <p className="text-[10px] text-muted-foreground">{passedLabel(entry)}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="font-bold text-sm text-primary">{entry.totalPoints}</div>
                                    <div className="text-[10px] text-muted-foreground">pts</div>
                                  </div>
                                  {isLeader && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300 whitespace-nowrap">
                                      CURRENT LEADER
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Yearly Competition — Reader of the Year */}
            <div className="space-y-6">
              {/* Reader of the Year */}
              <Card className="shadow-lg overflow-hidden border-2 border-primary/30">
                <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold text-white">Reader of the Year</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The readers with the most points all year earn the title. The competition is still going, so nothing is final yet.
                  </p>
                  {settings.yearlyCountdownDate && (
                    <CountdownTimer targetDate={settings.yearlyCountdownDate} />
                  )}
                </div>
              </Card>

              {/* Year Label */}
              <div className="text-center">
                <span className="text-sm text-muted-foreground font-medium">
                  {new Date().getFullYear()} All-Time Leaderboard — Competition Ongoing
                </span>
              </div>

              {/* Overall Top 3 — Reader of the Year */}
              {overallYearlyTop.length > 0 && (
                <Card className="shadow-lg overflow-hidden border-2 border-yellow-500/30">
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-600/10 p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-yellow-400" />
                      <h2 className="text-lg font-bold text-white">Reader of the Year</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300">IN PROGRESS</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Current leaders across the entire platform for {new Date().getFullYear()}. Nothing is final — keep reading!
                    </p>
                    <div className="space-y-2">
                      {overallYearlyTop.map((entry, idx) => {
                        const Icon = medalIcons[idx] || Star;
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 p-3 rounded-xl ${idx === 0 ? "bg-yellow-500/15 border border-yellow-500/30" : "bg-muted/30"}`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${idx === 0 ? "bg-yellow-500/30" : "bg-muted"}`}>
                              <Icon className={`w-5 h-5 ${medalColors[idx]}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-white truncate">{entry.displayName}</p>
                              <p className="text-xs text-muted-foreground">{passedLabel(entry)}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-lg text-primary">{entry.totalPoints}</div>
                              <div className="text-[10px] text-muted-foreground">pts</div>
                            </div>
                            {idx === 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300 whitespace-nowrap">
                                CURRENT LEADER
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              )}

              {/* Yearly Band Leaders */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-white">Top Readers by Band — All-Time</h2>
                </div>

                <div className="space-y-4">
                  {BANDS.map((band) => {
                    const leaders = yearlyBandLeaders[band] || [];
                    if (leaders.length === 0) return null;
                    const colors = BAND_COLORS[band];
                    return (
                      <Card key={band} className={`shadow-md overflow-hidden border ${colors.border}`}>
                        <div className={`${colors.bg} px-4 py-3 flex items-center gap-2`}>
                          <GraduationCap className={`w-4 h-4 ${colors.text}`} />
                          <h3 className={`font-bold text-sm ${colors.text}`}>{BAND_LABELS[band]}</h3>
                          <span className="text-[10px] text-muted-foreground ml-auto">Top {leaders.length}</span>
                        </div>
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            {leaders.map((entry, idx) => {
                              const Icon = medalIcons[idx] || Star;
                              const isLeader = idx === 0;
                              return (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg ${isLeader ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-muted/20"}`}
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isLeader ? "bg-yellow-500/30" : "bg-muted"}`}>
                                    <Icon className={`w-4 h-4 ${medalColors[idx]}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-white truncate">{entry.displayName}</p>
                                    <p className="text-[10px] text-muted-foreground">{passedLabel(entry)}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="font-bold text-sm text-primary">{entry.totalPoints}</div>
                                    <div className="text-[10px] text-muted-foreground">pts</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Advisory Challenge */}
        <div className="mt-8">
          <div className="rounded-2xl overflow-hidden border-2 border-orange-500/30 shadow-lg">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-orange-600 to-red-500 px-5 py-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Advisory Challenge</h2>
                <p className="text-sm text-white/90">Which advisory class has read its way to the most points?</p>
              </div>
            </div>

            {/* Advisory list */}
            <div className="bg-card p-4 sm:p-6">
              {advisoryData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No advisory data yet. Keep reading!</p>
              ) : (
                <div className="space-y-3">
                  {advisoryData.map((adv: any) => (
                    <div
                      key={adv.teacherId}
                      className={`flex items-center gap-4 rounded-xl p-4 transition-all ${
                        adv.rank === 1
                          ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border-2 border-yellow-500/30"
                          : "bg-muted/30 border border-border"
                      }`}
                    >
                      {/* Rank */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        adv.rank === 1
                          ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white"
                          : adv.rank === 2
                          ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white"
                          : adv.rank === 3
                          ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {adv.rank}
                      </div>

                      {/* Advisory name + details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-foreground">{adv.teacherName}'s Advisory</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {adv.studentCount} student{adv.studentCount !== 1 ? "s" : ""} · {adv.quizzesCompleted} quiz{adv.quizzesCompleted !== 1 ? "zes" : ""} completed
                        </p>
                      </div>

                      {/* Points */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-lg text-primary">{adv.totalPoints}</div>
                        <div className="text-[10px] text-muted-foreground">pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-4 text-center">
                Points are earned by every student in each advisory class through reading quizzes. The advisory with the highest total at the end of the competition wins the challenge.
              </p>
            </div>
          </div>
        </div>

        {/* How to Earn Points — always visible */}
        <Card className="shadow-md mt-6">
          <div className="bg-gradient-to-r from-primary/15 to-primary/5 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-white">How to Climb the Leaderboard</h2>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold flex-shrink-0">1.</span>
                <span>Read a book from your library or Your Picks section</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold flex-shrink-0">2.</span>
                <span>Take and pass the quiz for that book</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold flex-shrink-0">3.</span>
                <span>Each quiz you pass earns you points</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold flex-shrink-0">4.</span>
                <span>The more quizzes you pass, the higher you climb!</span>
              </div>
            </div>
            {user && !user.isAdmin && user.role !== "teacher" && user.role !== "parent" && (
              <Button
                className="w-full mt-4"
                onClick={() => { window.location.hash = "/library"; }}
              >
                <Trophy className="w-4 h-4 mr-1" />
                Start Earning Points
              </Button>
            )}
          </div>
        </Card>

      </main>
    </div>
  );
}
