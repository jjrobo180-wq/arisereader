// WorkHub's Gradebook plugin: assignments in weighted categories, scores with missing, excused and late
// work, and each student's grade as it stands. Enter a whole assignment's scores in one sheet, or open one
// student to see what a family sees. An assignment can stay a draft (hidden from families) until it's
// published. Families see their child's published work and grade when the teacher shares the Gradebook.
// The math is in shared/classRecords.ts (studentGrade); the server side is server/classRecords.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { downloadCsv, shortDay } from "@/lib/records";
import { assignmentAverage, studentGrade, type Assignment, type Gradebook, type Score } from "@shared/classRecords";
import { HubModal } from "./HubModal";
import { Avatar, Btn, ErrorNote, Loading, Panel, PluginHead, ShareCard, Toggle, ink, useRecords, useRecordsSetup } from "./records/RecordsUI";

type Student = { id: number; name: string };
type Data = { book: Gradebook; students: Student[] };
type View = "grades" | "students" | "settings";
const field = "min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white";
const pctTone = (p: number | null) => (p === null ? "text-slate-500" : p >= 80 ? "text-emerald-700 dark:text-emerald-300" : p >= 70 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300");

function cellText(s: Score | undefined, a: Assignment) {
  if (!s) return "";
  if (s.excused) return "Exc";
  if (s.missing) return "Miss";
  return typeof s.score === "number" ? `${s.score}` : "";
}

export default function HubClassGradebook() {
  const req = useRecords();
  const records = useRecordsSetup();
  const [view, setView] = useSavedChoice<View>("hub-gradebook-view", "grades", ["grades", "students", "settings"]);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Assignment | "new" | null>(null);
  const [scoring, setScoring] = useState<{ a: Assignment; focus?: number } | null>(null);
  const [flash, setFlash] = useState("");

  const load = useCallback(() => req<Data>("/api/records/grades").then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)), [req]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(""), 5000); return () => window.clearTimeout(t); }, [flash]);
  const setBook = (book: Gradebook) => setData((d) => (d ? { ...d, book } : d));
  const run = async (fn: () => Promise<any>, ok?: string) => { try { await fn(); if (ok) setFlash(ok); } catch (e: any) { setFlash(e.message); } };

  const assignments = useMemo(() => [...(data?.book.assignments ?? [])].sort((a, b) => (b.due || b.createdAt).localeCompare(a.due || a.createdAt)), [data]);
  const grades = useMemo(() => new Map((data?.students ?? []).map((s) => [s.id, studentGrade(data!.book, s.id)])), [data]);
  const catName = (id: string) => data?.book.categories.find((c) => c.id === id)?.name || "";
  const familiesSee = !!records.setup?.share.parents.grades;

  function exportCsv() {
    if (!data) return;
    downloadCsv("gradebook.csv", [
      ["Student", "Grade %", "Letter", "Missing", ...assignments.map((a) => `${a.title} (${a.points})`)],
      ...data.students.map((s) => { const g = grades.get(s.id)!; return [s.name, g.percent, g.letter, g.missing.length, ...assignments.map((a) => cellText(data.book.scores[a.id]?.[String(s.id)], a))]; }),
    ]);
  }

  return <div className="space-y-5" data-testid="hub-class-gradebook">
    <PluginHead title="Gradebook" blurb="Assignments, scores and each student's grade." shared={records.setup ? familiesSee : undefined}
      tabs={[{ id: "grades", label: "Grades" }, { id: "students", label: "By student" }, { id: "settings", label: "Categories and sharing" }]} tab={view} setTab={setView}
      right={data && view === "grades" ? <><Btn onClick={exportCsv} disabled={!data.students.length}><Download className="h-4 w-4" />CSV</Btn><Btn kind="primary" onClick={() => setEditing("new")} testid="gradebook-new"><Plus className="h-4 w-4" />New assignment</Btn></> : undefined} />
    <ErrorNote text={error && !data ? error : ""} retry={() => void load()} />
    {!data && !error && <Loading label="Loading your gradebook…" />}

    {data && view === "grades" && (assignments.length ? <Panel className="p-0 sm:p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[13rem] border-b border-slate-200 bg-white p-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-[#151325]">Student</th>
              <th className="border-b border-slate-200 p-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10">Grade</th>
              {assignments.map((a) => { const avg = assignmentAverage(data.book, a.id); return (
                <th key={a.id} className="min-w-[7.5rem] border-b border-l border-slate-200 p-2 text-left align-top font-normal dark:border-white/10">
                  <button type="button" onClick={() => setScoring({ a })} className="block w-full rounded-lg p-1 text-left hover:bg-slate-50 dark:hover:bg-white/5" title="Enter scores">
                    <span className={`line-clamp-2 text-[13px] font-semibold leading-snug ${ink}`}>{a.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{catName(a.categoryId)} · {a.points} pts{a.due ? ` · ${shortDay(a.due)}` : ""}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">{a.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{a.published ? "Published" : "Draft"}{avg !== null ? ` · avg ${avg}%` : ""}</span>
                  </button>
                </th>
              ); })}
            </tr>
          </thead>
          <tbody>{data.students.map((s) => { const g = grades.get(s.id)!; return (
            <tr key={s.id} className="group">
              <td className="sticky left-0 z-10 border-b border-slate-100 bg-white p-3 group-hover:bg-slate-50 dark:border-white/5 dark:bg-[#151325] dark:group-hover:bg-white/5">
                <span className="flex items-center gap-2.5"><Avatar id={s.id} name={s.name} size={28} /><span className={`truncate font-semibold ${ink}`}>{s.name}</span>{g.missing.length > 0 && <span className="shrink-0 rounded-full bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-700">{g.missing.length} missing</span>}</span>
              </td>
              <td className={`border-b border-slate-100 p-3 text-right font-bold tabular-nums dark:border-white/5 ${pctTone(g.percent)}`}>{g.percent === null ? "—" : `${g.percent}% ${g.letter}`}</td>
              {assignments.map((a) => { const sc = data.book.scores[a.id]?.[String(s.id)]; const t = cellText(sc, a); return (
                <td key={a.id} className="border-b border-l border-slate-100 p-0 dark:border-white/5">
                  <button type="button" onClick={() => setScoring({ a, focus: s.id })} aria-label={`${s.name}, ${a.title}: ${t || "no score"}`}
                    className={`flex h-11 w-full items-center justify-center gap-1 text-[14px] tabular-nums hover:bg-[#f4f2ff] dark:hover:bg-violet-500/10 ${sc?.missing ? "bg-rose-50 font-semibold text-rose-700 dark:bg-rose-500/10" : sc?.excused ? "text-sky-700" : ink}`}>
                    {t || <span className="text-slate-300">—</span>}{sc?.late && <span className="text-[10px] font-bold text-amber-600">L</span>}{sc?.comment && <span className="h-1.5 w-1.5 rounded-full bg-[#6e5ae0]" aria-hidden="true" />}
                  </button>
                </td>
              ); })}
            </tr>
          ); })}</tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-white/10">Tap an assignment to enter everyone's scores, or a box for one student. Miss counts as 0; Exc doesn't count. L is late; a dot means a comment.</p>
    </Panel> : <Panel><div className="py-8 text-center"><p className={`text-lg font-bold ${ink}`}>No assignments yet</p><p className="mt-1 text-sm text-slate-500">Add your first assignment to start your gradebook.</p><div className="mt-4"><Btn kind="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />New assignment</Btn></div></div></Panel>)}

    {data && view === "students" && <ByStudent data={data} grades={grades} assignments={assignments} catName={catName} />}
    {data && view === "settings" && <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Setup book={data.book} save={(body) => run(async () => setBook((await req("/api/records/grades/setup", { method: "PUT", body })).book), "Gradebook settings saved.")} />
      <ShareCard plugin="grades" share={records.setup?.share} onChange={records.saveShare} extra={<p className="mt-3 text-sm text-slate-500">Families see published assignments only, with your comments, and their child's grade.</p>} />
    </div>}

    {editing && data && <AssignmentModal book={data.book} assignment={editing === "new" ? null : editing} onClose={() => setEditing(null)}
      onSave={(body) => run(async () => {
        if (editing === "new") { const r = await req("/api/records/grades/assignments", { body }); setBook(r.book); setEditing(null); setScoring({ a: r.assignment }); }
        else { setBook((await req(`/api/records/grades/assignments/${editing.id}`, { method: "PUT", body })).book); setEditing(null); }
      }, editing === "new" ? "Assignment added. Enter scores now or later." : "Assignment saved.")}
      onDelete={editing !== "new" ? () => run(async () => { if (!window.confirm(`Delete "${editing.title}" and its scores?`)) return; setBook((await req(`/api/records/grades/assignments/${editing.id}`, { method: "DELETE" })).book); setEditing(null); }, "Assignment deleted.") : undefined} />}

    {scoring && data && <ScoreSheet a={data.book.assignments.find((x) => x.id === scoring.a.id) ?? scoring.a} focus={scoring.focus} students={data.students} scores={data.book.scores[scoring.a.id] ?? {}}
      onEdit={() => { setEditing(data.book.assignments.find((x) => x.id === scoring.a.id) ?? scoring.a); setScoring(null); }}
      onClose={() => setScoring(null)}
      onSave={(scores) => run(async () => { setBook((await req("/api/records/grades/scores", { method: "PUT", body: { assignmentId: scoring.a.id, scores } })).book); setScoring(null); }, "Scores saved.")} />}

    {flash && <div role="status" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[700] mx-auto max-w-md rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">{flash}</div>}
  </div>;
}

/** Everyone's score for one assignment, in one sheet. Enter moves down; flags sit beside each score. */
function ScoreSheet({ a, students, scores, focus, onSave, onClose, onEdit }: { a: Assignment; students: Student[]; scores: Record<string, Score>; focus?: number; onSave: (s: Record<string, Score | null>) => void; onClose: () => void; onEdit: () => void }) {
  const [draft, setDraft] = useState<Record<string, Score>>(() => JSON.parse(JSON.stringify(scores)));
  const [commentFor, setCommentFor] = useState<number | null>(null);
  useEffect(() => { if (focus) window.setTimeout(() => document.getElementById(`score-${focus}`)?.focus(), 60); }, [focus]);
  const set = (id: number, patch: Partial<Score>) => setDraft((d) => {
    const next: Score = { ...(d[String(id)] ?? {}), ...patch };
    if (patch.missing) { delete next.excused; delete next.score; }
    if (patch.excused) { delete next.missing; }
    if (patch.score !== undefined && patch.score !== null) delete next.missing;
    return { ...d, [String(id)]: next };
  });
  const changed = () => {
    const out: Record<string, Score | null> = {};
    const ids = new Set([...Object.keys(scores), ...Object.keys(draft)]);
    for (const id of ids) {
      const s = draft[id];
      const clean = s && (s.missing || s.excused || s.late || s.comment || typeof s.score === "number") ? s : null;
      if (JSON.stringify(clean) !== JSON.stringify(scores[id] ?? null)) out[id] = clean;
    }
    return out;
  };
  const fillBlank = () => setDraft((d) => { const n = { ...d }; for (const s of students) { const k = String(s.id); if (!n[k] || (n[k].score === undefined && !n[k].missing && !n[k].excused)) n[k] = { ...(n[k] ?? {}), missing: true }; } return n; });
  const flag = (on: boolean) => `min-h-9 rounded-lg border px-2 text-xs font-semibold ${on ? "border-transparent" : "border-slate-200 text-slate-500 dark:border-white/15"}`;
  return <HubModal title={a.title} onClose={onClose} size="lg">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
      <span>Out of {a.points}{a.due ? ` · due ${shortDay(a.due)}` : ""} · {a.published ? "Published" : "Draft, hidden from families"}</span>
      <span className="flex gap-2"><Btn onClick={onEdit}><Pencil className="h-4 w-4" />Edit assignment</Btn><Btn onClick={fillBlank} title="Mark everyone without a score missing">Blanks to missing</Btn></span>
    </div>
    <ul className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-white/10">{students.map((s, i) => { const sc = draft[String(s.id)] ?? {}; return (
      <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
        <span className={`min-w-[9rem] flex-1 truncate font-semibold ${ink}`}>{s.name}</span>
        <input id={`score-${s.id}`} type="number" inputMode="decimal" min={0} step="any" aria-label={`Score for ${s.name}`} value={sc.score ?? ""} disabled={!!sc.excused}
          onChange={(e) => set(s.id, { score: e.target.value === "" ? undefined : Number(e.target.value) })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById(`score-${students[i + 1]?.id}`)?.focus(); } }}
          className="min-h-10 w-20 rounded-xl border border-slate-200 bg-white px-2 text-right text-[15px] tabular-nums disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-white" />
        <span className="w-12 text-xs tabular-nums text-slate-500">{typeof sc.score === "number" ? `${Math.round((100 * sc.score) / a.points)}%` : ""}</span>
        <button type="button" aria-pressed={!!sc.missing} onClick={() => set(s.id, { missing: !sc.missing })} className={`${flag(!!sc.missing)} ${sc.missing ? "bg-rose-600 text-white" : ""}`}>Missing</button>
        <button type="button" aria-pressed={!!sc.excused} onClick={() => set(s.id, { excused: !sc.excused })} className={`${flag(!!sc.excused)} ${sc.excused ? "bg-sky-600 text-white" : ""}`}>Excused</button>
        <button type="button" aria-pressed={!!sc.late} onClick={() => set(s.id, { late: !sc.late })} className={`${flag(!!sc.late)} ${sc.late ? "bg-amber-500 text-white" : ""}`}>Late</button>
        <button type="button" onClick={() => setCommentFor(commentFor === s.id ? null : s.id)} className={`${flag(!!sc.comment)} ${sc.comment ? "bg-[#6e5ae0] text-white" : ""}`}>Comment</button>
        {commentFor === s.id && <input autoFocus value={sc.comment ?? ""} maxLength={300} onChange={(e) => set(s.id, { comment: e.target.value })} placeholder={`A note for ${s.name.split(" ")[0]} and family`} aria-label={`Comment for ${s.name}`} className={`basis-full ${field}`} />}
      </li>
    ); })}</ul>
    <div className="mt-4 flex justify-end gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => onSave(changed())} testid="scores-save"><Check className="h-4 w-4" />Save scores</Btn></div>
  </HubModal>;
}

function AssignmentModal({ book, assignment, onSave, onClose, onDelete }: { book: Gradebook; assignment: Assignment | null; onSave: (b: Partial<Assignment>) => void; onClose: () => void; onDelete?: () => void }) {
  const [a, setA] = useState<Partial<Assignment>>(assignment ?? { title: "", categoryId: book.categories[0]?.id, points: 100, due: "", published: true });
  return <HubModal title={assignment ? "Edit assignment" : "New assignment"} onClose={onClose} size="md">
    <form onSubmit={(e) => { e.preventDefault(); onSave(a); }} className="space-y-4">
      <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-white/80">Name</span><input autoFocus required value={a.title} maxLength={120} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="Chapter 3 quiz" className={`w-full ${field}`} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-white/80">Category</span><select value={a.categoryId} onChange={(e) => setA({ ...a, categoryId: e.target.value })} className={`w-full ${field}`}>{book.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-white/80">Points</span><input type="number" min={1} step="any" value={a.points} onChange={(e) => setA({ ...a, points: Number(e.target.value) })} className={`w-full ${field}`} /></label>
      </div>
      <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-white/80">Due (optional)</span><input type="date" value={a.due} onChange={(e) => setA({ ...a, due: e.target.value })} className={`w-full ${field}`} /></label>
      <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-white/80">Note for families (optional)</span><input value={a.note ?? ""} maxLength={500} onChange={(e) => setA({ ...a, note: e.target.value })} placeholder="What it covers" className={`w-full ${field}`} /></label>
      <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5"><span className="min-w-0 flex-1 text-sm"><span className={`block font-semibold ${ink}`}>Published</span><span className="text-slate-500">Families see published work. A draft stays with you.</span></span><Toggle on={!!a.published} onChange={(v) => setA({ ...a, published: v })} label="Published" /></label>
      <div className="flex flex-wrap justify-between gap-2">
        {onDelete ? <Btn kind="danger" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete</Btn> : <span />}
        <div className="flex gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" type="submit">{assignment ? "Save" : "Add assignment"}</Btn></div>
      </div>
    </form>
  </HubModal>;
}

function ByStudent({ data, grades, assignments, catName }: { data: Data; grades: Map<number, ReturnType<typeof studentGrade>>; assignments: Assignment[]; catName: (id: string) => string }) {
  const [sid, setSid] = useState(data.students[0]?.id ?? 0);
  const s = data.students.find((x) => x.id === sid);
  const g = s ? grades.get(s.id)! : null;
  if (!s || !g) return <Panel><p className="text-sm text-slate-500">No students yet.</p></Panel>;
  return <div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
    <Panel className="lg:self-start">
      <label className="block"><span className="sr-only">Student</span><select value={sid} onChange={(e) => setSid(Number(e.target.value))} className={`w-full ${field}`}>{data.students.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <div className="mt-5 flex items-center gap-3"><Avatar id={s.id} name={s.name} size={48} /><div><p className={`text-3xl font-bold tabular-nums ${pctTone(g.percent)}`}>{g.percent === null ? "—" : `${g.percent}%`}</p><p className="text-sm text-slate-500">{g.letter ? `Grade ${g.letter}` : "No grade yet"}</p></div></div>
      <ul className="mt-5 space-y-2 text-sm">{g.categories.map((c) => <li key={c.id} className="flex justify-between gap-2"><span className="text-slate-600 dark:text-white/70">{c.name} <span className="text-slate-400">· {c.weight}%</span></span><span className={`font-semibold tabular-nums ${pctTone(c.percent)}`}>{c.percent === null ? "—" : `${c.percent}%`}</span></li>)}</ul>
      {g.missing.length > 0 && <div className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"><p className="font-semibold">{g.missing.length} missing</p><ul className="mt-1 list-disc pl-5">{g.missing.map((a) => <li key={a.id}>{a.title}</li>)}</ul></div>}
    </Panel>
    <Panel>
      <h3 className={`mb-3 text-base font-bold ${ink}`}>Work</h3>
      <ul className="divide-y divide-slate-100 dark:divide-white/10">{assignments.map((a) => { const sc = data.book.scores[a.id]?.[String(s.id)]; return (
        <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1"><span className={`block font-semibold ${ink}`}>{a.title}{!a.published && <span className="ml-2 text-xs font-normal text-slate-500">Draft</span>}</span><span className="text-xs text-slate-500">{catName(a.categoryId)}{a.due ? ` · ${shortDay(a.due)}` : ""}{sc?.comment ? ` · “${sc.comment}”` : ""}</span></span>
          <span className={`font-semibold tabular-nums ${sc?.missing ? "text-rose-700" : sc?.excused ? "text-sky-700" : ink}`}>{sc?.missing ? "Missing" : sc?.excused ? "Excused" : typeof sc?.score === "number" ? `${sc.score} / ${a.points}` : "—"}{sc?.late ? " · late" : ""}</span>
        </li>
      ); })}</ul>
    </Panel>
  </div>;
}

function Setup({ book, save }: { book: Gradebook; save: (b: { categories: Gradebook["categories"]; scale: Gradebook["scale"] }) => void }) {
  const [cats, setCats] = useState(book.categories);
  const [scale, setScale] = useState(book.scale);
  useEffect(() => { setCats(book.categories); setScale(book.scale); }, [book]);
  const total = cats.reduce((n, c) => n + (Number(c.weight) || 0), 0);
  const dirty = JSON.stringify({ cats, scale }) !== JSON.stringify({ cats: book.categories, scale: book.scale });
  return <Panel>
    <h3 className={`text-base font-bold ${ink}`}>Categories and weights</h3>
    <p className="mt-1 text-sm text-slate-500">A grade is each category's score, weighted. Categories with no scores yet don't count, so early grades stay fair.</p>
    <ul className="mt-4 space-y-2">{cats.map((c, i) => <li key={`${c.id}-${i}`} className="flex items-center gap-2">
      <input aria-label="Category" value={c.name} maxLength={40} onChange={(e) => setCats(cats.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className={`min-w-0 flex-1 ${field}`} />
      <label className="flex items-center gap-1 text-sm text-slate-500"><input aria-label={`Weight for ${c.name}`} type="number" min={0} max={100} value={c.weight} onChange={(e) => setCats(cats.map((x, k) => (k === i ? { ...x, weight: Number(e.target.value) } : x)))} className={`w-20 ${field}`} />%</label>
      <button type="button" disabled={cats.length < 2} onClick={() => setCats(cats.filter((_, k) => k !== i))} aria-label={`Remove ${c.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
    </li>)}</ul>
    <p className={`mt-2 text-sm ${total === 100 ? "text-slate-500" : "font-semibold text-amber-700"}`}>Weights add up to {total}%{total === 100 ? "." : ". They're scaled to 100%, but 100 is clearest."}</p>
    <Btn onClick={() => setCats([...cats, { id: "", name: "New category", weight: 0 }])}><Plus className="h-4 w-4" />Add a category</Btn>

    <h3 className={`mt-7 text-base font-bold ${ink}`}>Letter grades</h3>
    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{scale.map((r, i) => <li key={i} className="flex items-center gap-1.5">
      <input aria-label="Letter" value={r.letter} maxLength={3} onChange={(e) => setScale(scale.map((x, k) => (k === i ? { ...x, letter: e.target.value } : x)))} className={`w-14 text-center font-semibold ${field}`} />
      <span className="text-sm text-slate-500">from</span>
      <input aria-label={`Lowest percent for ${r.letter}`} type="number" min={0} max={100} value={r.min} disabled={i === scale.length - 1} onChange={(e) => setScale(scale.map((x, k) => (k === i ? { ...x, min: Number(e.target.value) } : x)))} className={`w-16 ${field}`} />
    </li>)}</ul>
    <div className="mt-6 flex gap-2"><Btn kind="primary" disabled={!dirty} onClick={() => save({ categories: cats, scale })}><Check className="h-4 w-4" />Save</Btn>{dirty && <Btn onClick={() => { setCats(book.categories); setScale(book.scale); }}>Undo changes</Btn>}</div>
  </Panel>;
}
