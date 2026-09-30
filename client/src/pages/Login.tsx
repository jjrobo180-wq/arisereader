import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Heart, Info, Megaphone, Sparkles, PlayCircle, Eye, Users, UserRound } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import DonationGoal from "@/components/DonationGoal";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSampleChooser, setShowSampleChooser] = useState(false);
  const [sampleLoading, setSampleLoading] = useState<"student" | "eye-gaze" | "parent" | null>(null);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loginSample = async (type: "student" | "eye-gaze" | "parent") => {
    const usernameByType = {
      student: "sample",
      "eye-gaze": "sample-eye",
      parent: "sample-parent",
    } as const;
    setError("");
    setSampleLoading(type);
    try {
      await login(usernameByType[type], "sample1234");
      setShowSampleChooser(false);
    } catch (err: any) {
      setError(err.message || "Could not open that sample account.");
    } finally {
      setSampleLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-wide">A.R.I.S.E<span className="text-primary"> Reader</span></h1>
          <p className="text-muted-foreground mt-2">Read a book. Take a quiz. Earn points.</p>
          <p className="text-sm text-primary font-semibold mt-3">Endless quizzes. Millions of points to give away. All free, always.</p>
        </div>

        <DonationGoal />

        <div className="mb-6">
          <button type="button" onClick={() => navigate("/about")} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-card border border-primary/30 text-sm font-semibold text-primary hover:bg-primary/10 transition-all">
            <Heart className="w-4 h-4" /> Support Our Readers
          </button>
        </div>

        {loginBanner && <div className="rounded-lg p-3 mb-3 flex items-start gap-2" style={{ background: loginBanner.bgColor, color: loginBanner.textColor }}><Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" /><p className="text-sm font-medium leading-relaxed">{loginBanner.text}</p></div>}

        <Card className="shadow-xl bg-card">
          <CardHeader><CardTitle className="text-white">Welcome back</CardTitle><CardDescription>Log in to take quizzes and track your points</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" required className="bg-input text-white border-border" data-testid="input-username" /></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required className="bg-input text-white border-border" data-testid="input-password" /></div>
              {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3" data-testid="text-error">{error}</div>}
              <Button type="submit" className="w-full bg-primary" disabled={loading} data-testid="button-login">{loading ? "Logging in..." : "Log In"}</Button>
              <button type="button" onClick={() => setShowSampleChooser(true)} disabled={loading || !!sampleLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"><Sparkles className="w-4 h-4" /> Try Sample Account</button>
              <div className="text-center text-sm text-muted-foreground">New here?{" "}<button type="button" onClick={() => navigate("/register")} className="text-primary font-medium hover:underline">Create an account</button></div>
            </form>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tutorials</p>
                <button type="button" onClick={() => navigate("/tutorial")} className="text-xs font-bold text-primary hover:underline">View all</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => navigate("/tutorial/student")} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs font-bold text-foreground transition-all hover:border-orange-400/60 hover:bg-orange-500/10"><Users className="h-4 w-4 text-orange-400" /> Student</button>
                <button type="button" onClick={() => navigate("/tutorial/teacher")} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs font-bold text-foreground transition-all hover:border-blue-400/60 hover:bg-blue-500/10"><PlayCircle className="h-4 w-4 text-blue-400" /> Teacher</button>
                <button type="button" onClick={() => navigate("/tutorial/eye-gaze")} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs font-bold text-foreground transition-all hover:border-cyan-400/60 hover:bg-cyan-500/10"><Eye className="h-4 w-4 text-cyan-400" /> Eye Gazer</button>
                <button type="button" onClick={() => navigate("/tutorial/parent")} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs font-bold text-foreground transition-all hover:border-purple-400/60 hover:bg-purple-500/10"><Heart className="h-4 w-4 text-purple-400" /> Parent</button>
              </div>
              <button type="button" onClick={() => navigate("/leaderboard")} className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-sm font-medium text-primary hover:bg-primary/20 transition-all"><Trophy className="w-4 h-4" /> View Leaderboard</button>
              <button type="button" onClick={() => navigate('/parent-signup')} className="w-full mt-2 rounded-lg border border-primary/30 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10">Parent sign up with a code</button>
              <button type="button" onClick={() => navigate("/about")} className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted/30 border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-all"><Info className="w-4 h-4 text-primary" /> About A.R.I.S.E.</button>
              <p className="text-xs text-muted-foreground text-center mt-2">No login needed — perfect for presentations to parents, teachers, or students</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showSampleChooser && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Sample Experience</p>
              <h2 className="mt-1 text-2xl font-black text-foreground">Which account do you want to try?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sample accounts are sandbox demos. They do not appear on student leaderboards or competition rankings.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void loginSample("student")}
                disabled={!!sampleLoading}
                className="w-full rounded-2xl border-2 border-border bg-muted/20 p-4 text-left transition hover:border-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15"><Users className="h-6 w-6 text-orange-400" /></div>
                  <div>
                    <p className="font-black text-foreground">{sampleLoading === "student" ? "Opening Student..." : "Student"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try the library, quizzes, A.R.I.S.E. 2.0, Club A.R.I.S.E., arcade, avatars, pets, worlds, rewards, and more—with no game timer.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => void loginSample("eye-gaze")}
                disabled={!!sampleLoading}
                className="w-full rounded-2xl border-2 border-border bg-muted/20 p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15"><Eye className="h-6 w-6 text-cyan-400" /></div>
                  <div>
                    <p className="font-black text-foreground">{sampleLoading === "eye-gaze" ? "Opening Eye Gazer..." : "Eye Gazer"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try My Talker, visual quizzes, Eye Gazer games, Life Skills, My World, Shorts, Flash Cards, My Buddy, and progress.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => void loginSample("parent")}
                disabled={!!sampleLoading}
                className="w-full rounded-2xl border-2 border-border bg-muted/20 p-4 text-left transition hover:border-purple-400 hover:bg-purple-500/10 disabled:opacity-50"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15"><UserRound className="h-6 w-6 text-purple-400" /></div>
                  <div>
                    <p className="font-black text-foreground">{sampleLoading === "parent" ? "Opening Parent..." : "Parent"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try the linked-parent dashboard, progress, certificates, messaging, Eye Gazer family controls, My Talker setup, My World, and Life Skills controls.</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setShowSampleChooser(false)} disabled={!!sampleLoading} className="rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button type="button" onClick={() => { setShowSampleChooser(false); navigate("/tutorial"); }} disabled={!!sampleLoading} className="rounded-xl border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
                View Tutorials Instead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}