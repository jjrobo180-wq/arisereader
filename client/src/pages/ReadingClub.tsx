import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { BookOpen, Trophy, Users, Calendar, Star, ArrowLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const SESSION_COOKIE = "arise_session";
function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith(SESSION_COOKIE + "=")) {
        const raw = c.substring(SESSION_COOKIE.length + 1);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}

export default function ReadingClub() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-orange-600 text-white py-8 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
              onClick={() => navigate(user?.role === "parent" ? "/parent-dashboard" : "/library")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">A.R.I.S.E Reading Club</h1>
              <p className="text-white/80 text-sm sm:text-base">Thursdays after school · Earn 100 points</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* When & Where */}
        <Card className="shadow-md border-primary/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Thursdays After School</h2>
                <p className="text-sm text-muted-foreground">Weekly reading club at CGMS</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/40 p-4 text-center">
                <div className="text-2xl font-bold text-primary">Thu</div>
                <div className="text-xs text-muted-foreground mt-1">Every Thursday</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-center">
                <div className="text-2xl font-bold text-primary">4:30</div>
                <div className="text-xs text-muted-foreground mt-1">After School</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-center">
                <div className="text-2xl font-bold text-primary">100</div>
                <div className="text-xs text-muted-foreground mt-1">Points Each Week</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What is it */}
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">What is the Reading Club?</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The A.R.I.S.E Reading Club is a weekly meet-up at CGMS where students gather to read, explore books,
              and take quizzes together. It's a fun, relaxed time to discover new stories, check out books online,
              and grow as a reader — all while earning points.
            </p>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="shadow-md">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">How It Works</h2>
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Show Up Every Thursday</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Join us at the CGMS reading club meeting after school every Thursday. Just being there counts.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Read & Explore</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the time to read a book, browse the online library for new books to check out, or take quizzes.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Earn 100 Points</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Show up and stay for the session to automatically receive <strong>100 points</strong> added to your account.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Climb the Leaderboard</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your points count toward the monthly and yearly reading competitions. Keep showing up to stay on top.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sign up via Bloomz */}
        <Card className="shadow-md border-primary/30">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Ready to Join?</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              To sign up for the A.R.I.S.E Reading Club, please check the Bloomz app for sign-up instructions. We'll see you every Thursday after school at CGMS!
            </p>
            <div className="rounded-xl bg-muted/40 p-4 text-left text-sm space-y-2 max-w-md mx-auto">
              <p className="font-semibold text-foreground">What happens next?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Check the Bloomz app for sign-up instructions</li>
                <li>• Show up every Thursday after school at CGMS</li>
                <li>• Earn 100 points each week you attend</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Quick rules */}
        <Card className="shadow-md border-primary/20">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-3">The Rules</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                You must show up and stay for the entire session to get your 100 points.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                Use the time to read, explore books online, or take quizzes on A.R.I.S.E Reader.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                Points are awarded after the session ends — check your total on your profile.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">4.</span>
                Be respectful, bring a book or find one in the library, and have fun reading.
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
