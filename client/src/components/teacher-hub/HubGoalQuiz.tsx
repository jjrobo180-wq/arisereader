// Arise WorkHub goal quizzes (server/goalQuiz.ts, shared/hubLinks.ts). They stay in the teacher's
// WorkHub; students never see them on their own.
//   MakeGoalQuiz      on a student's profile: pick goals, AI writes the quiz, it's saved with the goals
//   GiveGoalQuiz      full screen, one question at a time, big answers; scores itself when done
//   EnterQuizScore    typing in a score from a paper copy
//   GoalQuizResults   the latest score under a goal
//   StudentQuizzes    a student's quizzes and scores on their profile
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ClipboardCheck, Loader2, Pencil, Play, Printer, Sparkles, X } from "lucide-react";
import { goalQuizzes, percentGoal, quizPercent, recordQuizScore, type GoalQuiz } from "@shared/hubLinks";
import type { Goal, Workspace } from "@shared/teacherHub";
import { API_BASE } from "@/lib/queryClient";
import { HubModal } from "./HubModal";
import { Field, GhostButton, PrimaryButton, Select } from "./ui";
import { useHubLinks } from "./HubLinks";

type SetWorkspace = (update: (w: Workspace) => Workspace) => void;
const fold = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

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
      <span className="shrink-0 text-xs font-semibold text-emerald-800">{last ? `${last.score}/${last.total} · ${quizPercent(last)}%` : "Not given yet"}</span>
    </button>;
  })}</div>;
}

/** On a student's profile: their goal quizzes, scores, and making, giving or scoring one. */
export function StudentQuizzes({ student, onMake, setWorkspace, makeId }: { student: string; onMake: () => void; setWorkspace: SetWorkspace; makeId: () => string }) {
  const ctx = useHubLinks();
  const [giving, setGiving] = useState<GoalQuiz | null>(null);
  const [scoring, setScoring] = useState<GoalQuiz | null>(null);
  if (!ctx) return null;
  const quizzes = goalQuizzes(ctx.workspace).filter((q) => fold(q.student) === fold(student));
  const save = (q: GoalQuiz, score: number, total: number) => setWorkspace((w) => recordQuizScore(w, q.id, { attemptId: newId(), score, total, completedAt: new Date().toISOString() }, makeId));
  return <div className="space-y-2" data-testid="student-quizzes">
    {quizzes.length ? <ul className="space-y-2">{quizzes.map((q) => {
      const results = [...(q.results || [])].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      const n = q.questions?.length || 0;
      return <li key={q.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm" data-testid="goal-quiz-row">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900">{q.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${results.length ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{results.length ? `${results[0].score}/${results[0].total} · ${quizPercent(results[0])}%` : "Not given yet"}</span></div>
        <div className="mt-1 text-xs text-slate-500">{n} questions · {q.goalIds.length} {q.goalIds.length === 1 ? "goal" : "goals"} · made {when(q.createdAt)}{results.length ? ` · last given ${when(results[0].completedAt)}${results.length > 1 ? ` · given ${results.length} times` : ""}` : ""}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {n > 0 && <button type="button" onClick={() => setGiving(q)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white" data-testid="give-quiz"><Play className="h-4 w-4" /> Give quiz</button>}
          <button type="button" onClick={() => setScoring(q)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><Pencil className="h-4 w-4" /> Enter a score</button>
          {n > 0 && <button type="button" onClick={() => printQuiz(q)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><Printer className="h-4 w-4" /> Print</button>}
        </div>
      </li>;
    })}</ul> : <p className="text-sm text-slate-500">Make a short quiz from this student's goals. Give it here (it scores itself) or on paper, and the score goes on their profile and into goals measured in %.</p>}
    <GhostButton onClick={onMake}><Sparkles className="h-4 w-4" /> Make a goal quiz</GhostButton>
    {giving && <GiveGoalQuiz quiz={giving} onClose={() => setGiving(null)} onDone={(score, total) => { save(giving, score, total); }} />}
    {scoring && <EnterQuizScore quiz={scoring} onClose={() => setScoring(null)} onSave={(score, total) => { save(scoring, score, total); setScoring(null); }} />}
  </div>;
}

/** A printable copy (with an answer key on its own page) for giving the quiz on paper. */
function printQuiz(q: GoalQuiz) {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const qs = q.questions || [];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(q.title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:32px;color:#111}h1{font-size:22px}ol{padding-left:20px}li{margin:0 0 18px}.o{margin:4px 0 0 8px}.key{page-break-before:always}</style></head><body>
<h1>${esc(q.title)}</h1><p>Name: ______________________ &nbsp; Date: ____________</p>
<ol>${qs.map((x) => `<li>${esc(x.prompt)}${x.options.map((o, i) => `<div class="o">${"ABCD"[i]}. ${esc(o)}</div>`).join("")}</li>`).join("")}</ol>
<div class="key"><h1>Answer key</h1><ol>${qs.map((x) => `<li>${"ABCD"[x.correct]}. ${esc(x.options[x.correct])}</li>`).join("")}</ol></div>
<script>window.onload=()=>window.print()</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

/** Giving the quiz in WorkHub: full screen, one question at a time, scored at the end. */
export function GiveGoalQuiz({ quiz, onClose, onDone }: { quiz: GoalQuiz; onClose: () => void; onDone: (score: number, total: number) => void }) {
  const qs = quiz.questions || [];
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const score = answers.filter((a, i) => qs[i] && a === qs[i].correct).length;
  const pick = (i: number) => {
    const next = [...answers]; next[at] = i; setAnswers(next);
  };
  const nextQ = () => {
    if (at < qs.length - 1) setAt(at + 1);
    else { setFinished(true); onDone(answers.filter((a, i) => a === qs[i].correct).length, qs.length); }
  };
  const q = qs[at];
  return createPortal(<div className="fixed inset-0 z-[780] flex flex-col bg-white text-slate-900" role="dialog" aria-modal="true" aria-label={quiz.title} data-testid="give-goal-quiz">
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <span className="min-w-0 flex-1 truncate font-bold">{quiz.title}</span>
      {!finished && <span className="text-sm font-semibold text-slate-500">{at + 1} of {qs.length}</span>}
      <button type="button" onClick={onClose} aria-label="Close quiz" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </div>
    <div className="h-1.5 bg-slate-100"><div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${((finished ? qs.length : at) / Math.max(1, qs.length)) * 100}%` }} /></div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        {finished ? <div className="text-center" data-testid="quiz-finished">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <p className="mt-4 text-4xl font-black">{score} / {qs.length}</p>
          <p className="mt-1 text-lg font-semibold text-slate-600">{quizPercent({ score, total: qs.length })}%</p>
          <p className="mx-auto mt-4 max-w-md text-sm text-slate-500">Saved to {quiz.student.split(" ")[0]}'s profile{quiz.goalIds.length ? ", and added to the goals measured in %" : ""}.</p>
          <ol className="mx-auto mt-6 max-w-md space-y-1.5 text-left text-sm">{qs.map((x, i) => <li key={i} className={`rounded-xl px-3 py-2 ${answers[i] === x.correct ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>{i + 1}. {answers[i] === x.correct ? "Right" : `Answer: ${x.options[x.correct]}`}</li>)}</ol>
          <div className="mt-6"><PrimaryButton onClick={onClose}>Done</PrimaryButton></div>
        </div> : q && <>
          <p className="text-xl font-bold leading-relaxed sm:text-2xl">{q.prompt}</p>
          <div className="mt-6 grid grid-cols-1 gap-3">{q.options.map((o, i) => { const on = answers[at] === i;
            return <button key={i} type="button" onClick={() => pick(i)} aria-pressed={on}
              className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-semibold transition ${on ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black ${on ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>{"ABCD"[i]}</span>{o}
            </button>; })}</div>
          <div className="mt-6 flex justify-between gap-3">
            <button type="button" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40">Back</button>
            <PrimaryButton onClick={nextQ} disabled={answers[at] === undefined}>{at === qs.length - 1 ? "Finish" : "Next"}</PrimaryButton>
          </div>
        </>}
      </div>
    </div>
  </div>, document.body);
}

/** Typing in a score from a paper copy. */
export function EnterQuizScore({ quiz, onClose, onSave }: { quiz: GoalQuiz; onClose: () => void; onSave: (score: number, total: number) => void }) {
  const [score, setScore] = useState("");
  const [total, setTotal] = useState(String(quiz.questions?.length || 10));
  const s = Number(score), t = Number(total);
  const ok = score !== "" && Number.isFinite(s) && Number.isFinite(t) && t > 0 && s >= 0 && s <= t;
  return <HubModal title={`Score: ${quiz.title}`} onClose={onClose} size="sm"
    footer={<div className="flex gap-2"><PrimaryButton onClick={() => ok && onSave(s, t)} disabled={!ok}>Save score</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
    <div className="grid grid-cols-2 gap-3">
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Right</span><Field type="number" inputMode="numeric" value={score} onChange={(e) => setScore(e.target.value)} aria-label="Number right" /></label>
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Out of</span><Field type="number" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} aria-label="Out of" /></label>
    </div>
    {ok && <p className="mt-3 text-sm text-slate-600">{quizPercent({ score: s, total: t })}% — saved to the profile and the goals measured in %.</p>}
  </HubModal>;
}

/** Pick goals; AI writes the quiz; it's saved with the student's goals in WorkHub. */
export function MakeGoalQuiz({ student, grade, goals, token, setWorkspace, onClose, onDone }: {
  student: string; grade: string; goals: Goal[]; token: string | null; setWorkspace: SetWorkspace; onClose: () => void; onDone: (q: GoalQuiz) => void;
}) {
  const [picked, setPicked] = useState<string[]>(() => goals.map((g) => g.id));
  const [count, setCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosen = useMemo(() => goals.filter((g) => picked.includes(g.id)), [goals, picked]);
  const make = async () => {
    if (busy || !chosen.length) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/teacher-hub/goal-quiz`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ grade, count, goals: chosen.map((g) => ({ area: g.area, text: g.text, baseline: g.baseline, target: g.target, unit: g.unit })) }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(j.questions)) throw new Error(j.message || "The quiz couldn't be made. Try again.");
      const quiz: GoalQuiz = { id: newId(), title: `${String(j.title || "Skill check")} · ${student.split(" ")[0]}`, student, goalIds: chosen.map((g) => g.id), createdAt: new Date().toISOString(), questions: j.questions, results: [], recorded: [] };
      setWorkspace((w) => ({ ...w, goalQuizzes: [...goalQuizzes(w), quiz],
        goals: w.goals.map((g) => quiz.goalIds.includes(g.id) ? { ...g, links: [...(g.links || []), { kind: "quiz" as const, id: quiz.id }].slice(0, 30) } : g) }));
      onDone(quiz);
    } catch (e: any) { setError(e?.message || "The quiz couldn't be made. Try again."); }
    setBusy(false);
  };
  return <HubModal title={`Goal quiz for ${student}`} onClose={onClose} size="md"
    footer={<div className="flex flex-wrap items-center gap-2"><PrimaryButton onClick={() => void make()} disabled={busy || !chosen.length}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing the quiz…</> : <><Sparkles className="h-4 w-4" /> Make the quiz</>}</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
    <div className="space-y-4" data-testid="make-goal-quiz">
      <p className="text-sm text-slate-600">AI writes a short quiz that checks the skills in these goals. It stays in your WorkHub: give it here (it scores itself), print it, or type in a score. Scores go on {student.split(" ")[0]}'s profile and into the goals measured in %.</p>
      <fieldset><legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Goals to check</legend>
        {goals.length ? <ul className="space-y-1.5">{goals.map((g) => { const on = picked.includes(g.id);
          return <li key={g.id}><label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={on} onChange={() => setPicked((p) => on ? p.filter((x) => x !== g.id) : [...p, g.id])} />
            <span className="min-w-0 text-sm"><span className="font-semibold text-slate-900">{g.area}</span> <span className="text-slate-600">{g.text}</span>{percentGoal(g) && <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />score adds to progress</span>}</span>
          </label></li>; })}</ul> : <p className="text-sm text-slate-500">This student has no goals yet. Add goals first (or read their IEP with AI).</p>}
      </fieldset>
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Questions</span>
        <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many questions">{[4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} questions</option>)}</Select></label>
      {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
    </div>
  </HubModal>;
}
