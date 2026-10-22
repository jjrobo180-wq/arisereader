// "Your quiz is ready!": quizzes a student asked for that a teacher approved (shared/readyQuizzes.ts).
// Shown at the top of the student's library until they take the quiz or close the banner.
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { onNotificationsRefresh } from "@/lib/notifications";
import type { ReadyQuiz } from "@shared/readyQuizzes";

type Ready = ReadyQuiz & { path: string };
const POLL_MS = 30_000;

export function QuizReadyBanner() {
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const [quizzes, setQuizzes] = useState<Ready[]>([]);

  const load = useCallback(async () => {
    if (!token || !user || user.role !== "student") { setQuizzes([]); return; }
    try {
      const r = await fetch(`${API_BASE}/api/student/ready-quizzes`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) setQuizzes(((await r.json()).quizzes || []) as Ready[]);
    } catch { /* offline: try again on the next poll */ }
  }, [token, user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const stop = onNotificationsRefresh(() => void load());
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); stop?.(); };
  }, [load]);

  const dismiss = async (q: Ready) => {
    setQuizzes((list) => list.filter((x) => !(x.kind === q.kind && x.id === q.id)));
    try {
      await fetch(`${API_BASE}/api/student/ready-quizzes/${q.kind}/${q.id}/dismiss`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch { /* it comes back next time; nothing is lost */ }
  };

  if (!quizzes.length) return null;
  const shown = quizzes.slice(0, 3);
  return (
    <section aria-label="Quizzes ready for you" data-testid="quiz-ready-banner" className="mb-4 grid gap-2">
      {shown.map((q) => (
        <div key={`${q.kind}:${q.id}`} className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3"
          style={{ background: "linear-gradient(90deg, #dcfce7, #f0fdf4)", borderColor: "#16a34a", color: "#14532d" }}>
          <span className="text-3xl" aria-hidden="true">✅</span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black">Your quiz is ready!</span>
            <span className="block text-sm font-semibold [overflow-wrap:anywhere]" style={{ color: "#166534" }}>
              Your teacher approved your quiz for “{q.title}”. Take it now to earn your points.
            </span>
          </span>
          <button type="button" onClick={() => navigate(q.path)} data-testid="quiz-ready-take"
            className="shrink-0 rounded-xl px-4 py-2 text-sm font-black text-white transition hover:brightness-110" style={{ background: "#16a34a" }}>
            Take the quiz
          </button>
          <button type="button" onClick={() => void dismiss(q)} aria-label={`Hide: ${q.title}`} title="Hide"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg font-black hover:bg-black/5" style={{ color: "#166534" }}>
            ×
          </button>
        </div>
      ))}
      {quizzes.length > shown.length && (
        <p className="px-1 text-xs font-semibold text-muted-foreground">+{quizzes.length - shown.length} more quiz{quizzes.length - shown.length === 1 ? "" : "zes"} ready. Take one above to see the next.</p>
      )}
    </section>
  );
}
