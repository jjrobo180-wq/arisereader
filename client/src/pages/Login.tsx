import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GraduationCap, BookUser, UserCog, Trophy, BookOpen, FileQuestion, Star, Heart, Eye, Info, Megaphone, Sparkles, PlayCircle } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import DonationGoal from "@/components/DonationGoal";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginBanner, setLoginBanner] = useState<{ text: string; bgColor: string; textColor: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/banners/login`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && data.text) setLoginBanner(data); })
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
          <p className="text-sm text-primary font-semibold mt-3">
            Endless quizzes. Millions of points to give away. All free, always.
          </p>
        </div>

        {/* Donation goal — admin controlled */}
        <DonationGoal />

        {/* Support Our Readers link */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate("/about")}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-card border border-primary/30 text-sm font-semibold text-primary hover:bg-primary/10 transition-all"
          >
            <Heart className="w-4 h-4" />
            Support Our Readers
          </button>
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
              <button
                type="button"
                onClick={async () => {
                  setError("");
                  setLoading(true);
                  try {
                    await login("sample", "sample1234");
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Try Sample Account
              </button>
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
                  onClick={() => navigate("/tutorial")}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border text-sm font-medium text-white hover:bg-muted hover:border-primary/50 transition-all"
                >
                  <PlayCircle className="w-4 h-4 text-primary" />
                  Tutorial
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
