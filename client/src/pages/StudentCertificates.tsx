import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Award, Trophy } from "lucide-react";
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

interface Certificate {
  bookId: number;
  title: string;
  pointsEarned: number;
  completedAt: string;
}

export default function StudentCertificates() {
  const [match, params] = useRoute("/student-certificates/:id");
  const studentId = match ? params.id : null;
  const { token } = useAuth();
  const [studentName, setStudentName] = useState("");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;
    const authToken = token || getTokenFromCookie();
    if (!authToken) { setLoading(false); return; }
    fetch(`${API_BASE}/api/teacher/student/${studentId}/certificates`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(res => { if (!res.ok) throw new Error("Failed to load certificates"); return res.json(); })
      .then(data => {
        setStudentName(data.student?.displayName || "");
        setCertificates(Array.isArray(data.certificates) ? data.certificates : []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [studentId, token]);

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
        <Button variant="ghost" onClick={() => window.location.hash = "/teacher-dashboard"}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-3 h-16">
          <Button variant="ghost" size="sm" onClick={() => window.location.hash = "/teacher-dashboard"}>
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-white">
              {studentName ? `${studentName}'s Certificates` : "Certificates"}
            </h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Earned Certificates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {certificates.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No certificates earned yet. Certificates are awarded when a student passes a quiz (70% or higher).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {certificates.map((cert) => (
                  <div
                    key={cert.bookId}
                    className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Award className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{cert.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {cert.pointsEarned} points earned
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(cert.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        generateCertificate(
                          studentName,
                          cert.title,
                          cert.pointsEarned,
                          new Date(cert.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        );
                      }}
                    >
                      <Award className="w-4 h-4 mr-1" />
                      Print
                    </Button>
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
