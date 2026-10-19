// Arise WorkHub goal quizzes (server/goalQuiz.ts, shared/hubLinks.ts):
//   useGoalQuizSync   brings finished attempts back from A.R.I.S.E. Reader and adds them to the goals
//   MakeGoalQuiz      the pop-up on a student's profile: pick goals and the Reader account, AI writes it
//   GoalQuizResults   the latest score under a goal
//   StudentQuizzes    a student's quizzes and scores on their profile
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import { applyQuizResults, goalQuizzes, percentGoal, quizPercent, type GoalQuiz } from "@shared/hubLinks";
import type { Goal, Workspace } from "@shared/teacherHub";
import { API_BASE } from "@/lib/queryClient";
import { HubModal } from "./HubModal";
import { GhostButton, PrimaryButton, Select } from "./ui";
import { useHubLinks } from "./HubLinks";

type SetWorkspace = (update: (w: Workspace) => Workspace) => void;
const fold = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Checks the Reader for finished goal quizzes when the Hub opens, then every few minutes while it's in view. */
export function useGoalQuizSync(workspace: Workspace, setWorkspace: SetWorkspace, token: string | null, makeId: () => string, ready: boolean) {
  const ids = goalQuizzes(workspace).map((q) => q.id).join(",");
  const latest = useRef({ setWorkspace, makeId }); latest.current = { setWorkspace, makeId };
  useEffect(() => {
    if (!ready || !token || !ids) return;
    let live = true;
    const check = () => {
      if (document.hidden) return;
      fetch(`${API_BASE}/api/teacher-hub/goal-quiz-results?ids=${encodeURIComponent(ids)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (live && Array.isArray(j?.results) && j.results.length) latest.current.setWorkspace((w) => applyQuizResults(w, j.results, latest.current.makeId)); })
        .catch(() => { /* tried again next time */ });
    };
    check();
    const t = window.setInterval(check, 3 * 60_000);
    const vis = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; window.clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [ids, token, ready]);
}

const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

/** Under a goal: the quizzes made from it and the latest score on each. */
export function GoalQuizResults({ goal }: { goal: Goal }) {
  const ctx = useHubLinks();
  if (!ctx) return null;
  const quizzes = goalQuizzes(ctx.workspace).filter((q) => q.goalIds.includes(goal.id));
  if (!quizzes.length) return null;
  return <div className="mt-3 space-y-1.5" data-testid="goal-quiz-results">{quizzes.map((q) => {
    const last = [...(q.results || [])].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
    return <button key={q.id} type="button" onClick={() => ctx.openLink({ kind: "quiz", id: q.id })} className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-emerald-50 px-3 text-left text-sm">
      <ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-700" />
      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{q.title}</span>
      <span className="shrink-0 text-xs font-semibold text-emerald-800">{last ? `${last.score}/${last.total} · ${quizPercent(last)}%${percentGoal(goal) ? " · added" : ""}` : "Not taken yet"}</span>
    </button>;
  })}</div>;
}

/** On a student's profile: their goal quizzes, scores, and a way to make one. */
export function StudentQuizzes({ student, onMake }: { student: string; onMake: () => void }) {
  const ctx = useHubLinks();
  if (!ctx) return null;
  const quizzes = goalQuizzes(ctx.workspace).filter((q) => fold(q.student) === fold(student));
  return <div className="space-y-2" data-testid="student-quizzes">
    {quizzes.length ? <ul className="space-y-2">{quizzes.map((q) => {
      const results = [...(q.results || [])].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      return <li key={q.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900">{q.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${results.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{results.length ? `${results[0].score}/${results[0].total} · ${quizPercent(results[0])}%` : "Waiting for the student"}</span></div>
        <div className="mt-1 text-xs text-slate-500">{q.goalIds.length} {q.goalIds.length === 1 ? "goal" : "goals"} · made {when(q.createdAt)}{results.length ? ` · taken ${when(results[0].completedAt)}` : " · it's in their A.R.I.S.E. Library under “From your teacher”"}</div>
      </li>;
    })}</ul> : <p className="text-sm text-slate-500">Make a short quiz from this student's goals. They take it on A.R.I.S.E. Reader and the score comes back here and into their goals.</p>}
    <GhostButton onClick={onMake}><Sparkles className="h-4 w-4" /> Make a goal quiz</GhostButton>
  </div>;
}

type ReaderStudent = { id: number; displayName?: string; username?: string };

/** Pick goals and the student's Reader account; AI writes the quiz; it goes to that student only. */
export function MakeGoalQuiz({ student, grade, goals, token, setWorkspace, makeId, onClose, onDone }: {
  student: string; grade: string; goals: Goal[]; token: string | null; setWorkspace: SetWorkspace; makeId: () => string; onClose: () => void; onDone: (q: GoalQuiz) => void;
}) {
  const [picked, setPicked] = useState<string[]>(() => goals.map((g) => g.id));
  const [readers, setReaders] = useState<ReaderStudent[] | null>(null);
  const [reader, setReader] = useState("");
  const [count, setCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/teacher/students`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : [])).then((rows: ReaderStudent[]) => {
        const list = Array.isArray(rows) ? rows : [];
        setReaders(list);
        // The account whose name matches this student is picked for you.
        const match = list.find((r) => fold(r.displayName) === fold(student)) || list.find((r) => fold(r.displayName).split(" ")[0] === fold(student).split(" ")[0] && list.filter((x) => fold(x.displayName).split(" ")[0] === fold(student).split(" ")[0]).length === 1);
        if (match) setReader(String(match.id));
      }).catch(() => setReaders([]));
  }, [token, student]);
  const chosen = useMemo(() => goals.filter((g) => picked.includes(g.id)), [goals, picked]);
  const make = async () => {
    if (busy || !chosen.length || !reader) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/teacher-hub/goal-quiz`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ student, grade, readerUserId: Number(reader), count, goals: chosen.map((g) => ({ area: g.area, text: g.text, baseline: g.baseline, target: g.target, unit: g.unit })) }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.id) throw new Error(j.message || "The quiz couldn't be made. Try again.");
      const quiz: GoalQuiz = { id: String(j.id), title: String(j.title || "Goal quiz"), student, readerUserId: Number(reader), goalIds: chosen.map((g) => g.id), createdAt: new Date().toISOString(), recorded: [], results: [] };
      setWorkspace((w) => ({ ...w, goalQuizzes: [...goalQuizzes(w), quiz],
        goals: w.goals.map((g) => quiz.goalIds.includes(g.id) ? { ...g, links: [...(g.links || []), { kind: "quiz" as const, id: quiz.id }].slice(0, 30) } : g) }));
      void makeId;
      onDone(quiz);
    } catch (e: any) { setError(e?.message || "The quiz couldn't be made. Try again."); }
    setBusy(false);
  };
  return <HubModal title={`Goal quiz for ${student}`} onClose={onClose} size="md"
    footer={<div className="flex flex-wrap items-center gap-2"><PrimaryButton onClick={() => void make()} disabled={busy || !chosen.length || !reader}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing the quiz…</> : <><Sparkles className="h-4 w-4" /> Make the quiz</>}</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
    <div className="space-y-4" data-testid="make-goal-quiz">
      <p className="text-sm text-slate-600">AI writes a short quiz that practises the skills in these goals. It appears only in {student.split(" ")[0]}'s A.R.I.S.E. Library under “From your teacher”. When they finish, the score shows on their profile and, for goals measured in %, is added to the goal's progress.</p>
      <fieldset><legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Goals to check</legend>
        {goals.length ? <ul className="space-y-1.5">{goals.map((g) => { const on = picked.includes(g.id);
          return <li key={g.id}><label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={on} onChange={() => setPicked((p) => on ? p.filter((x) => x !== g.id) : [...p, g.id])} />
            <span className="min-w-0 text-sm"><span className="font-semibold text-slate-900">{g.area}</span> <span className="text-slate-600">{g.text}</span>{percentGoal(g) && <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />score adds to progress</span>}</span>
          </label></li>; })}</ul> : <p className="text-sm text-slate-500">This student has no goals yet. Add goals first (or read their IEP with AI).</p>}
      </fieldset>
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Their A.R.I.S.E. Reader account</span>
        <Select value={reader} onChange={(e) => setReader(e.target.value)} aria-label="Reader account">
          <option value="">{readers === null ? "Loading your class…" : readers.length ? "Choose the student" : "No students in your Reader class yet"}</option>
          {(readers || []).map((r) => <option key={r.id} value={r.id}>{r.displayName || r.username}</option>)}
        </Select></label>
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Questions</span>
        <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many questions">{[4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} questions</option>)}</Select></label>
      {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
    </div>
  </HubModal>;
}
