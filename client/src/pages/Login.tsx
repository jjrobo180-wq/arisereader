import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GraduationCap, BookUser, UserCog, Trophy, BookOpen, FileQuestion, Star, Heart, ChevronDown, ChevronUp, Eye, Info, Megaphone } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ booksAvailable: number; quizzesAvailable: number; totalPoints: number } | null>(null);
  const [donationExpanded, setDonationExpanded] = useState(false);
  const [loginBanner, setLoginBanner] = useState<{ text: string; bgColor: string; textColor: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/banners/login`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && data.text) setLoginBanner(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/stats`)
      .then(res => res.json())
      .then(data => { setStats(data); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      // Navigation is handled by AppRouter redirects based on isAdmin
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-wide">A.R.I.S.E<span className="text-primary"> Reader</span></h1>
          <p className="text-muted-foreground mt-2">Read a book. Take a quiz. Earn points.</p>
          {stats && (
            <div className="flex items-center justify-center gap-3 sm:gap-6 mt-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-white font-bold">{stats.booksAvailable}</span>
                <span className="text-muted-foreground">Books to Read</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5 text-sm">
                <FileQuestion className="w-4 h-4 text-primary" />
                <span className="text-white font-bold">{stats.quizzesAvailable}</span>
                <span className="text-muted-foreground">Quizzes</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-white font-bold">{stats.totalPoints.toLocaleString()}</span>
                <span className="text-muted-foreground">Points</span>
              </div>
            </div>
          )}
        </div>

        {/* Donation section — expandable, at top */}
        <div className="mb-6 rounded-2xl border border-primary/30 bg-card p-4 shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setDonationExpanded(!donationExpanded)}
            className="w-full flex items-center gap-2"
          >
            <Heart className="w-5 h-5 text-primary flex-shrink-0" />
            <h2 className="text-base font-bold text-white text-left flex-1">Support A.R.I.S.E Reader — Free for Schools</h2>
            {donationExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
          </button>
          {!donationExpanded && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              I'm a teacher who built this free alternative to Accelerated Reader — a program that costs schools $2,000 to $10,000+ per year. Click to learn more and support our mission.
            </p>
          )}
          {donationExpanded && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                I'm a teacher who created A.R.I.S.E Reader because I saw firsthand how
                Accelerated Reader transformed my students' reading habits. But
                Accelerated Reader costs schools <span className="text-white font-medium">$2,000 to $10,000+ per year</span>{" "}
                — pricing out countless schools and leaving students without access
                to the tools that help them grow as readers.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A.R.I.S.E Reader is free for every student and teacher. Your donation
                helps us keep the platform running, add more books and quizzes, and
                reach schools that can't afford expensive reading programs.
              </p>
              <a
                href="https://buy.stripe.com/7sY6oHbUD7qrfwf3UFcIE04"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
              >
                <Heart className="w-4 h-4" />
                Donate with Stripe
              </a>
              <p className="text-xs text-muted-foreground text-center">
                Every contribution, big or small, makes a difference
              </p>
            </div>
          )}
        </div>

        {loginBanner && (
          <div
            className="rounded-lg p-3 mb-3 flex items-start gap-2"
            style={{ background: loginBanner.bgColor, color: loginBanner.textColor }}
          >
            <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">{loginBanner.text}</p>
          </div>
        )}

        <Card className="shadow-xl bg-card">
          <CardHeader>
            <CardTitle className="text-white">Welcome back</CardTitle>
            <CardDescription>Log in to take quizzes and track your points</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your username"
                  required
                  className="bg-input text-white border-border"
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  className="bg-input text-white border-border"
                  data-testid="input-password"
                />
              </div>
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3" data-testid="text-error">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full bg-primary" disabled={loading} data-testid="button-login">
                {loading ? "Logging in..." : "Log In"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                New here?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="text-primary font-medium hover:underline"
                >
                  Create an account
                </button>
              </div>
            </form>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/tutorial/student")}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border text-sm font-medium text-white hover:bg-muted hover:border-primary/50 transition-all"
                >
                  <BookUser className="w-4 h-4 text-primary" />
                  Student & Parent Tutorial
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/tutorial/teacher")}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border text-sm font-medium text-white hover:bg-muted hover:border-primary/50 transition-all"
                >
                  <UserCog className="w-4 h-4 text-primary" />
                  Teacher Tutorial
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/tutorial/eye-gaze")}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border text-sm font-medium text-white hover:bg-muted hover:border-primary/50 transition-all"
                >
                  <Eye className="w-4 h-4 text-primary" />
                  Eye Gaze / Non-Verbal Tutorial
                </button>
              </div>
              <button
                type="button"
                onClick={() => navigate("/leaderboard")}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-sm font-medium text-primary hover:bg-primary/20 transition-all"
              >
                <Trophy className="w-4 h-4" />
                View Leaderboard
              </button>
              <button
                type="button"
                onClick={() => navigate("/about")}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted/30 border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-all"
              >
                <Info className="w-4 h-4 text-primary" />
                About A.R.I.S.E.
              </button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                No login needed — perfect for presentations to parents, teachers, or students
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
