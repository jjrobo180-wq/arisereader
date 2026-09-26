import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Gamepad2, Trophy, Star, Eye, Settings, Volume2, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";

type BuddyConfig = {
  type: "preset" | "upload";
  preset: "puppy" | "dino" | "robot" | "bunny";
  name: string;
  imageData: string | null;
  voiceEnabled: boolean;
};

const PRESETS: Record<string, { emoji: string; label: string }> = {
  puppy: { emoji: "🐶", label: "Puppy" },
  dino: { emoji: "🦖", label: "Dino" },
  robot: { emoji: "🤖", label: "Robot" },
  bunny: { emoji: "🐰", label: "Bunny" },
};

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

function BuddyHero({ buddy }: { buddy: BuddyConfig }) {
  if (buddy.type === "upload" && buddy.imageData) {
    return (
      <img
        src={buddy.imageData}
        alt={buddy.name}
        className="w-40 h-40 sm:w-52 sm:h-52 rounded-[2rem] object-cover border-4 border-white/70 shadow-lg"
      />
    );
  }
  const preset = PRESETS[buddy.preset] || PRESETS.puppy;
  return (
    <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-[2rem] bg-white/70 border-4 border-white flex items-center justify-center text-8xl sm:text-9xl shadow-lg">
      {preset.emoji}
    </div>
  );
}

export default function EyeGazeProfileDashboard({
  displayName,
  totalPoints,
  quizzesTaken,
  rank,
}: {
  displayName: string;
  totalPoints: number;
  quizzesTaken: number;
  rank?: number | null;
}) {
  const [, navigate] = useLocation();
  const [buddy, setBuddy] = useState<BuddyConfig>({
    type: "preset",
    preset: "puppy",
    name: "Buddy",
    imageData: null,
    voiceEnabled: true,
  });
  const [eyeStats, setEyeStats] = useState<any>(null);

  useEffect(() => {
    const token = getTokenFromCookie();
    if (!token) return;

    Promise.all([
      fetch(`${API_BASE}/api/eye-gaze/learning-buddy`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/eye-gaze/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).then(r => r.ok ? r.json() : null),
    ])
      .then(([buddyData, profileData]) => {
        if (buddyData) setBuddy(buddyData);
        if (profileData) setEyeStats(profileData);
      })
      .catch(() => {});
  }, []);

  const firstName = displayName?.split(" ")[0] || "Reader";
  const level = eyeStats?.current_level || 1;
  const completed = eyeStats?.total_completed || quizzesTaken || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="font-black text-xl mr-auto">A.R.I.S.E. Reader</div>

          <Button variant="ghost" className="h-11" onClick={() => navigate("/library")}>
            <BookOpen className="w-5 h-5 mr-2" /> Read
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => navigate("/eye-gaze-games")}>
            <Gamepad2 className="w-5 h-5 mr-2" /> Games
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => navigate("/leaderboard")}>
            <Trophy className="w-5 h-5 mr-2" /> My Progress
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-amber-500/10 p-5 sm:p-8">
          <div className="absolute top-5 right-6 text-5xl opacity-20">⭐</div>
          <div className="absolute bottom-3 right-24 text-4xl opacity-20">🌈</div>

          <div className="relative flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <div className="animate-pulse">
                <BuddyHero buddy={buddy} />
              </div>
              <div className="absolute -bottom-2 -right-2 rounded-full bg-green-500 text-white px-3 py-1 text-xs font-black shadow">
                READY!
              </div>
            </div>

            <div className="flex-1 min-w-0 text-center md:text-left">
              <p className="text-sm font-black uppercase tracking-widest text-primary">My Learning Buddy</p>
              <h1 className="text-3xl sm:text-4xl font-black mt-1">Hi, {firstName}!</h1>

              <div className="mt-4 rounded-3xl md:rounded-tl-md border-2 border-primary/25 bg-card/90 px-5 py-5">
                <p className="text-xl sm:text-2xl font-black leading-snug">
                  I'm {buddy.name}! What should we learn today?
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  We can read, play a game, or practice together.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                <Button className="h-14 px-6 text-base font-black" onClick={() => navigate("/eye-gaze-games")}>
                  <Gamepad2 className="w-5 h-5 mr-2" /> Play With {buddy.name}
                </Button>
                <Button variant="outline" className="h-14 px-6 text-base font-bold" onClick={() => navigate("/eye-gaze-games")}>
                  <Settings className="w-5 h-5 mr-2" /> Change Buddy
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <Star className="w-6 h-6 text-amber-400 mb-2 fill-current" />
              <div className="text-3xl font-black">{totalPoints}</div>
              <div className="text-xs text-muted-foreground font-bold">POINTS</div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <Eye className="w-6 h-6 text-primary mb-2" />
              <div className="text-3xl font-black">Level {level}</div>
              <div className="text-xs text-muted-foreground font-bold">EYE GAZE LEVEL</div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <BookOpen className="w-6 h-6 text-blue-400 mb-2" />
              <div className="text-3xl font-black">{completed}</div>
              <div className="text-xs text-muted-foreground font-bold">ACTIVITIES</div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <Trophy className="w-6 h-6 text-purple-400 mb-2" />
              <div className="text-3xl font-black">{rank ? `#${rank}` : "—"}</div>
              <div className="text-xs text-muted-foreground font-bold">RANK</div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-black">Choose What To Do</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => navigate("/library")}
              className="min-h-[180px] rounded-3xl border-2 border-blue-500/25 bg-blue-500/5 p-6 text-left hover:border-blue-400 transition-colors"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center mb-4">
                <BookOpen className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-black">Read & Learn</h3>
              <p className="text-sm text-muted-foreground mt-2">Open your Eye Gaze reading activities and quizzes.</p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/eye-gaze-games")}
              className="min-h-[180px] rounded-3xl border-2 border-amber-500/25 bg-amber-500/5 p-6 text-left hover:border-amber-400 transition-colors"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
                <Gamepad2 className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-black">Reading Games</h3>
              <p className="text-sm text-muted-foreground mt-2">{buddy.name} teaches while you play.</p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/leaderboard")}
              className="min-h-[180px] rounded-3xl border-2 border-purple-500/25 bg-purple-500/5 p-6 text-left hover:border-purple-400 transition-colors"
            >
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-4">
                <Trophy className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-black">My Progress</h3>
              <p className="text-sm text-muted-foreground mt-2">See points, badges, rewards, and rankings.</p>
            </button>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
                {buddy.voiceEnabled ? <Volume2 className="w-7 h-7 text-green-400" /> : <Volume2 className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <p className="font-black">Buddy Voice</p>
                <p className="text-sm text-muted-foreground">{buddy.voiceEnabled ? "Your buddy talks during games." : "Buddy voice is turned off."}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${buddy.voiceEnabled ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
                {buddy.voiceEnabled ? "ON" : "OFF"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-black">Eye Gazer Profile</p>
                <p className="text-sm text-muted-foreground">This simplified dashboard is only shown to Eye Gazer students.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
