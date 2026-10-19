// The Library's "From your teacher" row: goal check-in quizzes a teacher made for this student in
// WorkHub (server/goalQuiz.ts). Only the student it was made for sees it; it goes once it's taken.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ClipboardCheck } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

type Quiz = { id: number; title: string; level?: string; hasCompleted?: boolean };

export default function TeacherCheckIns({ token }: { token: string | null }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!token) return;
    let live = true;
    fetch(`${API_BASE}/api/custom-quizzes`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { if (live && Array.isArray(rows)) setQuizzes(rows.filter((q: Quiz) => q.level === "Goal check" && !q.hasCompleted)); })
      .catch(() => {});
    return () => { live = false; };
  }, [token]);
  if (!quizzes.length) return null;
  return <section className="mb-8" data-testid="teacher-check-ins" aria-label="From your teacher">
    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ClipboardCheck className="h-5 w-5 text-emerald-500" /> From your teacher</h2>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {quizzes.map((q) => <button key={q.id} type="button" onClick={() => navigate(`/custom-quiz/${q.id}?mode=quiz`)}
        className="flex min-h-16 items-center gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4 text-left transition hover:bg-emerald-500/20">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white"><ClipboardCheck className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate font-bold">{q.title}</span><span className="block text-sm opacity-75">A quick check-in quiz · tap to start</span></span>
      </button>)}
    </div>
  </section>;
}
