import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { Trophy, ArrowLeft, Crown, Medal, Award, GraduationCap, Gift, Users, Star, Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalPoints: number;
  quizzesTaken: number;
  isEyeGazeUser?: boolean;
}

const BANDS = ["K-2", "3-5", "6-8", "9-12"];

const BAND_LABELS: Record<string, string> = {
  "K-2": "K-2 Band",
  "3-5": "3-5 Band",
  "6-8": "6-8 Band",
  "9-12": "9-12 Band",
};

const BAND_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  "K-2": { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", accent: "from-blue-500 to-blue-600" },
  "3-5": { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", accent: "from-green-500 to-green-600" },
  "6-8": { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", accent: "from-purple-500 to-purple-600" },
  "9-12": { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", accent: "from-orange-500 to-orange-600" },
};

export default function Competition() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [bandLeaders, setBandLeaders] = useState<Record<string, LeaderboardEntry[]>>({});
  const [overallTop, setOverallTop] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Fetch all bands in parallel using the public endpoint
        const promises = BANDS.map(async (band) => {
          const res = await fetch(`${API_BASE}/api/tutorial/leaderboard?band=${encodeURIComponent(band)}`);
          if (!res.ok) return { band, data: [] };
          const data = await res.json();
          return { band, data: Array.isArray(data) ? data : [] };
        });
        const results = await Promise.all(promises);

        const leaders: Record<string, LeaderboardEntry[]> = {};
        let allEntries: LeaderboardEntry[] = [];

        for (const { band, data } of results) {
          leaders[band] = data.slice(0, 3); // Top 3 per band
          allEntries = allEntries.concat(data);
        }

        // Sort all entries by points for overall top reader
        allEntries.sort((a, b) => b.totalPoints - a.totalPoints);
        setOverallTop(allEntries.slice(0, 3));
        setBandLeaders(leaders);
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const medalIcons = [Crown, Medal, Award];
  const medalColors = ["text-yellow-400", "text-gray-300", "text-orange-500"];
  const medalLabels = ["1st Place", "2nd Place", "3rd Place"];

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
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/30 to-orange-600/10 flex items-center justify-center mx-auto mb-4 border-2 border-yellow-500/30">
            <Trophy className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Reading Competition</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            Read books, take quizzes, and earn points to climb the leaderboard. The top readers win amazing prizes!
          </p>
        </div>

        {/* Prize Overview Card */}
        <Card className="shadow-lg mb-8 overflow-hidden border-2 border-primary/30">
          <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-white">Prizes</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1st Place */}
              <div className="rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/5 border border-yellow-500/30 p-4 text-center">
                <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <p className="font-bold text-sm text-yellow-400">1st Place</p>
                <p className="text-xs text-foreground/80 mt-1">Free Lunch</p>
                <p className="text-[10px] text-muted-foreground mt-1">+ Ultimate Prize Goal: $300</p>
              </div>
              {/* 2nd Place */}
              <div className="rounded-xl bg-gradient-to-br from-gray-400/20 to-gray-500/5 border border-gray-400/30 p-4 text-center">
                <Medal className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="font-bold text-sm text-gray-300">2nd Place</p>
                <p className="text-xs text-foreground/80 mt-1">Prize TBD</p>
                <p className="text-[10px] text-muted-foreground mt-1">Goal: $100</p>
              </div>
              {/* 3rd Place */}
              <div className="rounded-xl bg-gradient-to-br from-orange-600/20 to-orange-700/5 border border-orange-600/30 p-4 text-center">
                <Award className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="font-bold text-sm text-orange-500">3rd Place</p>
                <p className="text-xs text-foreground/80 mt-1">Prize TBD</p>
                <p className="text-[10px] text-muted-foreground mt-1">Goal: $50</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-card/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                <Heart className="w-3 h-3 inline mr-1 text-red-400" />
                100% of donations go directly to student prizes. Prize amounts are goals based on donations received.
              </p>
            </div>
          </div>
        </Card>

        {/* Top Reader of the Year */}
        <Card className="shadow-lg mb-8 overflow-hidden border-2 border-yellow-500/30">
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-600/10 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold text-white">Reader of the Year</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300">ULTIMATE PRIZE</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              The top reader across the entire platform earns the ultimate prize!
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : overallTop.length > 0 ? (
              <div className="space-y-2">
                {overallTop.map((entry, idx) => {
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
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Be the first to earn points!</p>
              </div>
            )}
          </div>
        </Card>

        {/* Band Leaders */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-white">Top Readers by Band</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            The #1 reader from each band wins a free lunch! 2nd and 3rd place prizes will be announced soon.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {BANDS.map((band) => {
                const leaders = bandLeaders[band] || [];
                const colors = BAND_COLORS[band];
                if (leaders.length === 0) return null;
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
                          const isWinner = idx === 0;
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-3 p-2.5 rounded-lg ${isWinner ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-muted/20"}`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isWinner ? "bg-yellow-500/30" : "bg-muted"}`}>
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
                              {isWinner && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300 whitespace-nowrap">
                                  FREE LUNCH
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
          )}
        </div>

        {/* How to Earn Points */}
        <Card className="shadow-md mb-8">
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
        <div className="rounded-xl bg-card border border-border p-4 text-center">
          <Heart className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            100% of all donations go directly to student prizes.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Prize goals: 1st place up to $300 | 2nd place up to $100 | 3rd place up to $50
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Prize amounts depend on donations received. 2nd and 3rd place prizes will be announced soon.
          </p>
        </div>
      </main>
    </div>
  );
}
