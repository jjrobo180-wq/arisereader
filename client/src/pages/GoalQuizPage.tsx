// A goal quiz a teacher sent as a link (shared/hubIep.ts). No sign-in: the student answers one
// question at a time, and the score goes straight into the teacher's WorkHub. The answers are never
// sent to this page, so the student sees their score, not the key.
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

type Quiz = { title: string; student: string; questions: { prompt: string; options: string[] }[] };

export default function GoalQuizPage() {
  const [, params] = useRoute("/goal-quiz/:code");
  const code = String(params?.code || "");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`${API_BASE}/api/goal-quiz/${encodeURIComponent(code)}`).then(async (r) => { const j = await r.json().catch(() => ({})); if (!live) return; if (!r.ok) setError(j.message || "This quiz couldn't open."); else setQuiz(j); }).catch(() => live && setError("This quiz couldn't open. Check your internet and try again."));
    return () => { live = false; };
  }, [code]);
  async function finish() {
    setSending(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/goal-quiz/${encodeURIComponent(code)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || "Your answers couldn't be sent. Try again.");
      setResult(j);
    } catch (e: any) { setError(e.message); }
    setSending(false);
  }
  const qs = quiz?.questions || [];
  const q = qs[at];
  return (
    <main className="min-h-screen bg-white text-slate-900" data-testid="goal-quiz-page">
      <header className="sticky top-0 border-b border-slate-100 bg-white/90 px-5 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3"><span className="min-w-0 flex-1 truncate text-lg font-semibold">{quiz?.title || "Quiz"}</span>{quiz && !result && <span className="text-sm font-semibold text-slate-500">{at + 1} of {qs.length}</span>}</div>
      </header>
      {quiz && !result && <div className="h-1 bg-slate-100"><div className="h-full bg-slate-900 transition-[width]" style={{ width: `${(at / Math.max(1, qs.length)) * 100}%` }} /></div>}
      <div className="mx-auto max-w-2xl px-5 py-8">
        {!quiz && !error && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">{error}</p>}
        {result ? (
          <div className="py-10 text-center" data-testid="goal-quiz-done">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <p className="mt-4 text-4xl font-semibold">{result.score} / {result.total}</p>
            <p className="mt-2 text-slate-600">Nice work{quiz?.student ? `, ${quiz.student}` : ""}! Your teacher has your score.</p>
          </div>
        ) : quiz && q && (
          <>
            {at === 0 && quiz.student && <p className="mb-4 text-sm text-slate-500">Hi {quiz.student}. Pick the best answer for each question.</p>}
            <p className="text-xl font-semibold leading-relaxed sm:text-2xl">{q.prompt}</p>
            <div className="mt-6 grid gap-3">{q.options.map((o, i) => { const on = answers[at] === i; return (
              <button key={i} type="button" aria-pressed={on} onClick={() => { const next = [...answers]; next[at] = i; setAnswers(next); }} className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-medium ${on ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{"ABCD"[i]}</span>{o}
              </button>); })}</div>
            <div className="mt-8 flex justify-between gap-3">
              <button type="button" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0} className="min-h-12 rounded-2xl border border-slate-200 px-5 font-semibold text-slate-700 disabled:opacity-40">Back</button>
              {at < qs.length - 1
                ? <button type="button" onClick={() => setAt(at + 1)} disabled={answers[at] === undefined} className="min-h-12 rounded-2xl bg-slate-900 px-6 font-semibold text-white disabled:opacity-40">Next</button>
                : <button type="button" onClick={() => void finish()} disabled={sending || answers.filter((a) => a !== undefined).length !== qs.length} className="min-h-12 rounded-2xl bg-slate-900 px-6 font-semibold text-white disabled:opacity-40" data-testid="goal-quiz-finish">{sending ? "Sending…" : "Finish"}</button>}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
