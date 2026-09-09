import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { Trophy, ArrowLeft, Crown, Medal, Award, GraduationCap, Gift, Users, Star, Heart, Calendar } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalPoints: number;
  quizzesTaken: number;
  isEyeGazeUser?: boolean;
}

interface CompetitionSettings {
  monthlyPrize: string;
  monthlyDesc: string;
  yearly1stPrize: string;
  yearly1stAmount: string;
  yearly2ndPrize: string;
  yearly2ndAmount: string;
  yearly3rdPrize: string;
  yearly3rdAmount: string;
  donationNote: string;
}

const DEFAULT_SETTINGS: CompetitionSettings = {
  monthlyPrize: "Free Lunch",
  monthlyDesc: "The #1 reader from each band every month wins a free lunch!",
  yearly1stPrize: "Ultimate Prize",
  yearly1stAmount: "$300",
  yearly2ndPrize: "Prize TBD",
  yearly2ndAmount: "$100",
  yearly3rdPrize: "Prize TBD",
  yearly3rdAmount: "$50",
  donationNote: "100% of all donations go directly to student prizes. Prize amounts are goals based on donations received.",
};

const BANDS = ["K-2", "3-5", "6-8", "9-12"];

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
  const { user } = useAuth();
  const [tab, setTab] = useState<"monthly" | "yearly">("monthly");
  const [monthlyBandLeaders, setMonthlyBandLeaders] = useState<Record<string, LeaderboardEntry[]>>({});
  const [yearlyBandLeaders, setYearlyBandLeaders] = useState<Record<string, LeaderboardEntry[]>>({});
  const [overallYearlyTop, setOverallYearlyTop] = useState<LeaderboardEntry[]>([]);
  const [monthlyTop, setMonthlyTop] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [settings, setSettings] = useState<CompetitionSettings>(DEFAULT_SETTINGS);
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
            onClick={() => window.history.back()}
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
            Read books, take quizzes, and earn points to win prizes every month and at the end of the year!
          </p>
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
              {/* Monthly Prize Card */}
              <Card className="shadow-lg overflow-hidden border-2 border-yellow-500/30">
                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-600/10 p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-lg font-bold text-white">Monthly Prize</h2>
                  </div>
                  <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 text-center">
                    <Crown className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                    <p className="font-bold text-base text-yellow-400">{settings.monthlyPrize}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.monthlyDesc}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      2nd and 3rd place prizes will be announced soon.
                    </p>
                  </div>
                </div>
              </Card>

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
                              <p className="text-[10px] text-muted-foreground">{entry.quizzesTaken} quizzes passed</p>
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
                                    <p className="text-[10px] text-muted-foreground">{entry.quizzesTaken} quizzes passed</p>
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
              {/* Yearly Prize Card */}
              <Card className="shadow-lg overflow-hidden border-2 border-primary/30">
                <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold text-white">Reader of the Year Prizes</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    The readers with the most points all year win these ultimate prizes! Competition is ongoing — nothing is final yet.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1st Place */}
                    <div className="rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/5 border border-yellow-500/30 p-4 text-center">
                      <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                      <p className="font-bold text-sm text-yellow-400">1st Place</p>
                      <p className="text-xs text-foreground/80 mt-1">{settings.yearly1stPrize}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Goal: {settings.yearly1stAmount}</p>
                    </div>
                    {/* 2nd Place */}
                    <div className="rounded-xl bg-gradient-to-br from-gray-400/20 to-gray-500/5 border border-gray-400/30 p-4 text-center">
                      <Medal className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="font-bold text-sm text-gray-300">2nd Place</p>
                      <p className="text-xs text-foreground/80 mt-1">{settings.yearly2ndPrize}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Goal: {settings.yearly2ndAmount}</p>
                    </div>
                    {/* 3rd Place */}
                    <div className="rounded-xl bg-gradient-to-br from-orange-600/20 to-orange-700/5 border border-orange-600/30 p-4 text-center">
                      <Award className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                      <p className="font-bold text-sm text-orange-500">3rd Place</p>
                      <p className="text-xs text-foreground/80 mt-1">{settings.yearly3rdPrize}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Goal: {settings.yearly3rdAmount}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg bg-card/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      <Heart className="w-3 h-3 inline mr-1 text-red-400" />
                      {settings.donationNote}
                    </p>
                  </div>
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
                              <p className="text-xs text-muted-foreground">{entry.quizzesTaken} quizzes passed</p>
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
                                    <p className="text-[10px] text-muted-foreground">{entry.quizzesTaken} quizzes passed</p>
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

        {/* Donation Note */}
        <div className="rounded-xl bg-card border border-border p-4 text-center mt-6">
          <Heart className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {settings.donationNote}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Yearly prize goals: 1st place {settings.yearly1stAmount} | 2nd place {settings.yearly2ndAmount} | 3rd place {settings.yearly3rdAmount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Prize amounts depend on donations received. Monthly 2nd and 3rd place prizes will be announced soon.
          </p>
        </div>
      </main>
    </div>
  );
}
