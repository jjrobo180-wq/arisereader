import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Gamepad2, Image as ImageIcon, Footprints, Shield, ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

export default function EyeGazeGames() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authToken = token || getTokenFromCookie();
    if (!authToken) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`${API_BASE}/api/eye-gaze/quizzes`, { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/custom-quizzes`, { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.ok ? r.json() : []),
    ])
      .then(([builtIn, custom]) => {
        const built = (Array.isArray(builtIn) ? builtIn : []).map((q: any) => ({ ...q, kind: "builtin" }));
        const customEye = (Array.isArray(custom) ? custom : [])
          .filter((q: any) => q.quiz_type !== "regular")
          .map((q: any) => ({ ...q, kind: "custom" }));
        setItems([...built, ...customEye]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const play = (quiz: any, mode: "picture" | "story" | "boss") => {
    const route = quiz.kind === "builtin" ? `/eye-gaze-quiz/${quiz.id}` : `/custom-quiz/${quiz.id}`;
    navigate(`${route}?mode=${mode}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Library
          </Button>
          <div className="flex-1">
            <h1 className="font-black text-lg flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" /> Eye Gaze Reading Games
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Play with the same reading skills in a more interactive way.</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-5 text-center">
              <ImageIcon className="w-10 h-10 mx-auto text-purple-400 mb-2" />
              <h2 className="font-black">Picture Hunt</h2>
              <p className="text-xs text-muted-foreground mt-1">Read and choose the matching picture.</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-5 text-center">
              <Footprints className="w-10 h-10 mx-auto text-blue-400 mb-2" />
              <h2 className="font-black">Story Quest</h2>
              <p className="text-xs text-muted-foreground mt-1">Move through reading challenges step by step.</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-5 text-center">
              <Shield className="w-10 h-10 mx-auto text-red-400 mb-2" />
              <h2 className="font-black">Boss Battle</h2>
              <p className="text-xs text-muted-foreground mt-1">Correct answers take health away from the boss.</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-black">Choose a Reading Set</h2>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No Eye Gaze reading sets are available yet.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {items.map((quiz) => (
              <Card key={`${quiz.kind}-${quiz.id}`} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="mb-4">
                    <h3 className="font-black text-lg">{quiz.title}</h3>
                    {quiz.description && <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button variant="outline" className="h-14 border-purple-500/30" onClick={() => play(quiz, "picture")} disabled={quiz.hasCompleted}>
                      <ImageIcon className="w-4 h-4 mr-2 text-purple-400" /> Picture Hunt
                    </Button>
                    <Button variant="outline" className="h-14 border-blue-500/30" onClick={() => play(quiz, "story")} disabled={quiz.hasCompleted}>
                      <Footprints className="w-4 h-4 mr-2 text-blue-400" /> Story Quest
                    </Button>
                    <Button variant="outline" className="h-14 border-red-500/30" onClick={() => play(quiz, "boss")} disabled={quiz.hasCompleted}>
                      <Shield className="w-4 h-4 mr-2 text-red-400" /> Boss Battle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
