import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { BookOpen, Trophy, Users, Calendar, Star, ArrowLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ReadingClub() {
  const { user } = useAuth();
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
              onClick={() => navigate("/library")}
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
              <p className="text-white/80 text-sm sm:text-base">CGMS · Every week · Earn 100 points</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
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
                  <h3 className="font-semibold text-sm">Show Up Once a Week</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Join us at the CGMS reading club meeting every week. Just being there counts.
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

        {/* CTA */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Ready to read and earn? Head to the library to find your next book.
          </p>
          <Button size="lg" onClick={() => navigate("/library")}>
            <BookOpen className="w-5 h-5 mr-2" /> Browse Books
          </Button>
        </div>
      </main>
    </div>
  );
}
