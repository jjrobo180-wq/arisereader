import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { BookOpen, Trophy, Users, Calendar, Star, ArrowLeft, GraduationCap, CheckCircle2, Clock, User, Phone, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE } from "@/lib/queryClient";

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
  const [signupStatus, setSignupStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form fields
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentContact, setParentContact] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) { setLoading(false); return; }

    // Fetch existing sign-up status
    fetch(`${API_BASE}/api/club/signup-status`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.signup) {
          setSignupStatus(data.signup);
          setStudentName(data.signup.student_name || user?.displayName || "");
        } else {
          setStudentName(user?.displayName || "");
        }
      })
      .catch(() => setStudentName(user?.displayName || ""))
      .finally(() => setLoading(false));
  }, [token, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setError("Student name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    const authToken = token || getTokenFromCookie();
    if (!authToken) { setError("Not logged in"); setSubmitting(false); return; }

    try {
      const res = await fetch(`${API_BASE}/api/club/signup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: studentName.trim(),
          grade: grade.trim() || undefined,
          parentName: parentName.trim() || undefined,
          parentContact: parentContact.trim() || undefined,
          parentEmail: parentEmail.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to sign up");
      } else {
        setSuccess(true);
        setSignupStatus(data.signup);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "confirmed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-400">
          <CheckCircle2 className="w-4 h-4" /> Confirmed
        </span>
      );
    }
    if (status === "denied") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-500/20 text-red-400">
          <AlertCircle className="w-4 h-4" /> Not Approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-500/20 text-amber-400">
        <Clock className="w-4 h-4" /> Pending
      </span>
    );
  };

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
                <div className="text-2xl font-bold text-primary">3:30</div>
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

        {/* Sign-up form or status */}
        {loading ? (
          <Card className="shadow-md">
            <CardContent className="p-8 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </CardContent>
          </Card>
        ) : success || (signupStatus && signupStatus.status === "pending") ? (
          <Card className="shadow-md border-green-500/30">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">You're Signed Up!</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {signupStatus?.student_name || studentName}, you're registered for the A.R.I.S.E Reading Club on Thursdays after school.
              </p>
              <div className="flex items-center justify-center gap-2 mb-4">
                {statusBadge(signupStatus?.status || "pending")}
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-left text-sm space-y-2 max-w-md mx-auto">
                <p className="font-semibold text-foreground">What happens next?</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Your teacher will review and confirm your sign-up</li>
                  <li>• You'll get a notification when confirmed</li>
                  <li>• Show up every Thursday after school at CGMS</li>
                  <li>• Earn 100 points each week you attend</li>
                </ul>
              </div>
              <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate(user?.role === "parent" ? "/parent-dashboard" : "/library")}>
                Back to {user?.role === "parent" ? "Parent Portal" : "Library"}
              </Button>
            </CardContent>
          </Card>
        ) : signupStatus && signupStatus.status === "confirmed" ? (
          <Card className="shadow-md border-green-500/30">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">You're Confirmed!</h2>
              <p className="text-sm text-muted-foreground mb-4">
                See you every Thursday after school at CGMS. Don't forget to show up and earn your 100 points!
              </p>
              {statusBadge("confirmed")}
            </CardContent>
          </Card>
        ) : signupStatus && signupStatus.status === "denied" ? (
          <Card className="shadow-md border-red-500/30">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Sign-Up Not Approved</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Your previous sign-up was not approved. Please contact your teacher or admin for more information.
              </p>
              <Button variant="outline" size="sm" onClick={() => { setSignupStatus(null); setSuccess(false); }}>
                Sign Up Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-md border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Sign Up for Reading Club
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentName">Student Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="studentName"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Student name"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade</Label>
                    <Input
                      id="grade"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="e.g. 3rd grade"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentName">Parent / Guardian Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="parentName"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        placeholder="Parent or guardian name"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentContact">Parent Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="parentContact"
                        type="tel"
                        value={parentContact}
                        onChange={(e) => setParentContact(e.target.value)}
                        placeholder="Phone number"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentEmail">Parent Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="parentEmail"
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="Parent email address"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything your teacher should know? (allergies, accommodations, etc.)"
                    rows={3}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Signing Up...</>
                  ) : (
                    <><BookOpen className="w-5 h-5 mr-2" /> Sign Up for Reading Club</>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By signing up, you agree to attend the Reading Club every Thursday after school.
                </p>
              </form>
            </CardContent>
          </Card>
        )}

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
