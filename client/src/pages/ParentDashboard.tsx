import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trophy, BookOpen, Award, LogOut } from "lucide-react";
import { generateCertificate } from "@/lib/certificate";

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

interface QuizResult {
  bookId: number;
  title: string;
  author: string;
  coverUrl: string | null;
  readUrl: string | null;
  pointsValue: number;
  score: number;
  total: number;
  pointsEarned: number;
  passed: boolean;
  passingScore: number;
  completedAt: string;
}

interface ProfileData {
  student: { id: number; displayName: string; username: string; isEyeGazeUser: boolean; teacherId: number | null };
  totalPoints: number;
  quizzesTaken: number;
  totalBooks: number;
  quizResults: QuizResult[];
}

export default function ParentDashboard() {
  const { token, user } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) { setLoading(false); return; }
    fetch(`${API_BASE}/api/parent/student-profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load student profile");
        return res.json();
      })
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleLogout = () => {
    document.cookie = "arise_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    window.location.hash = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-red-400">{error}</p>
        <p className="text-sm text-muted-foreground">If you haven't been linked to a student yet, please contact your school administrator.</p>
        <Button variant="ghost" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-3 h-16">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Parent Portal</h1>
            <p className="text-xs text-muted-foreground">{user?.displayName || user?.username || ""}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Logout</span>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Student header */}
        <div className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border">
          <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
            {data.student.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{data.student.displayName}</h2>
            <p className="text-sm text-muted-foreground">@{data.student.username}</p>
            {data.student.isEyeGazeUser && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-400">
                Eye Gazer / Non-Verbal
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{data.totalPoints}</div>
                <div className="text-xs text-muted-foreground">Total Points</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">{data.quizzesTaken}</div>
                <div className="text-xs text-muted-foreground">Quizzes Taken</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">{Math.max(0, data.totalBooks - data.quizzesTaken)}</div>
                <div className="text-xs text-muted-foreground">Books Left</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quiz History */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Quiz History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.quizResults.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {data.student.displayName} hasn't taken any quizzes yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.quizResults.map((r) => (
                  <div
                    key={r.bookId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
                  >
                    <div className="w-10 h-14 flex-shrink-0">
                      {r.coverUrl ? (
                        <img src={r.coverUrl} alt={r.title} className="w-full h-full object-cover rounded" />
                      ) : (
                        <div className="w-full h-full rounded bg-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.author}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(r.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm">{r.score}/{r.total}</div>
                      <div className="text-xs text-primary font-semibold">
                        {r.pointsEarned || 0} pts
                      </div>
                      <div className={`text-xs font-semibold ${r.passed ? "text-green-400" : "text-red-400"}`}>
                        {r.passed ? "Passed" : "Not Passed"}
                      </div>
                      {r.passed && (
                        <button
                          onClick={() => {
                            generateCertificate(
                              data.student.displayName,
                              r.title,
                              r.pointsEarned ?? 0,
                              new Date(r.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                            );
                          }}
                          className="text-xs text-primary hover:underline mt-1 flex items-center gap-0.5"
                        >
                          <Award className="w-3 h-3" />
                          Certificate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
