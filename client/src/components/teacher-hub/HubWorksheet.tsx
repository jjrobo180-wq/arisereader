// Worksheets in the Lesson Planner: see the student copy and the answer key side by side, print
// either (or both together), save as PDF or Word, and change anything the AI wrote — questions,
// answers, choices, pictures' numbers, order, headings — before it goes to students.
//
// Also the Worksheet Maker: make a worksheet on any topic, without a lesson first.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Download, FileText, Pencil, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import { cleanWorksheet, GRADES, LESSON_SUBJECTS, type GenWorksheet, type WorksheetItem } from "@shared/lessonPlanner";
import { answerKeyText, downloadWorksheetDoc, printHtml, worksheetHtml } from "@/lib/lessonExport";
import { HubModal } from "./HubModal";
import { Segmented, Spinner, aiBtn, askLessonAi, smallBtn } from "./HubLessonParts";

type View = "student" | "key" | "edit";

export function WorksheetStudio({ ws, startView = "student", className, onChange, onClose, extraFooter }: {
  ws: GenWorksheet;
  startView?: "student" | "key";
  className: string;
  /** Saving edits. Left out, the worksheet can't be edited (just viewed and printed). */
  onChange?: (next: GenWorksheet) => void;
  onClose: () => void;
  extraFooter?: React.ReactNode;
}) {
  const [view, setView] = useState<View>(startView);
  const [draft, setDraft] = useState<GenWorksheet>(ws);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const shown = view === "edit" ? draft : ws;
  const html = useMemo(() => worksheetHtml(shown, { answers: view === "key", className }), [shown, view, className]);
  const print = (both: boolean, answers = false) => { if (!printHtml(worksheetHtml(ws, { answers, both, className }))) setNote("Allow pop-ups for this site to print."); };

  return (
    <HubModal title={ws.title} onClose={onClose} size="lg" footer={
      <div className="flex flex-wrap items-center gap-2">
        {view === "edit" && onChange ? <>
          <button type="button" onClick={() => { const clean = cleanWorksheet(draft); if (clean) { onChange(clean); setView("student"); } }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Save changes</button>
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => { setDraft(ws); setView("student"); }}>Cancel</button>
        </> : <>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" onClick={() => print(false, view === "key")}><Printer className="h-4 w-4" /> Print {view === "key" ? "answer key" : "worksheet"}</button>
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => print(true)} title="The worksheet, then the answer key on its own page"><Printer className="h-4 w-4" /> Print both</button>
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => print(false, view === "key")} title="In the print window, choose Save as PDF"><Download className="h-4 w-4" /> PDF</button>
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => downloadWorksheetDoc(ws, view === "key", className)}><FileText className="h-4 w-4" /> Word</button>
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => { void navigator.clipboard?.writeText(answerKeyText(ws)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}><Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy answers"}</button>
          {extraFooter}
        </>}
        {note && <span className="text-sm text-rose-700">{note}</span>}
      </div>
    }>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Worksheet view" value={view} onChange={(v) => { if (v === "edit") setDraft(ws); setView(v); }} options={[
          { id: "student", label: "Student copy" },
          { id: "key", label: "Answer key" },
          ...(onChange ? [{ id: "edit" as const, label: <><Pencil className="h-3.5 w-3.5" /> Edit</> }] : []),
        ]} />
        <span className="text-xs text-slate-500">{ws.sections.reduce((n, s) => n + s.items.length, 0)} questions</span>
      </div>
      {view === "edit" ? <WorksheetEditor ws={draft} onChange={setDraft} /> : (
        <iframe title={view === "key" ? "Answer key" : "Student copy"} srcDoc={html} className="h-[68vh] w-full rounded-xl border border-slate-200 bg-white" />
      )}
    </HubModal>
  );
}

/** Change a worksheet: the words, answers, choices and order of every question. */
export function WorksheetEditor({ ws, onChange }: { ws: GenWorksheet; onChange: (ws: GenWorksheet) => void }) {
  const setSection = (i: number, changes: Partial<GenWorksheet["sections"][number]>) => onChange({ ...ws, sections: ws.sections.map((s, k) => (k === i ? { ...s, ...changes } : s)) });
  const setItem = (si: number, ii: number, changes: Partial<WorksheetItem>) => setSection(si, { items: ws.sections[si].items.map((it, k) => (k === ii ? { ...it, ...changes } : it)) });
  const moveItem = (si: number, ii: number, by: number) => { const items = [...ws.sections[si].items]; const j = ii + by; if (j < 0 || j >= items.length) return; [items[ii], items[j]] = [items[j], items[ii]]; setSection(si, { items }); };
  const input = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900";
  return (
    <div className="space-y-4 text-slate-900">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Title<input value={ws.title} onChange={(e) => onChange({ ...ws, title: e.target.value })} className={input + " mt-1 text-base font-semibold"} /></label>
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Directions<textarea value={ws.instructions} onChange={(e) => onChange({ ...ws, instructions: e.target.value })} rows={2} className={input + " mt-1"} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!ws.large} onChange={(e) => onChange({ ...ws, large: e.target.checked })} /> Large print (K–2)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ws.score !== false} onChange={(e) => onChange({ ...ws, score: e.target.checked })} /> Score box in the header</label>
      </div>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Maths goes between $ signs: <code>$\frac{"{3}{4}"}$</code> prints as a stacked fraction, <code>$2\frac{"{1}{3}"}$</code> as a mixed number, <code>$x^2$</code> with an exponent, <code>$\sqrt{"{49}"}$</code> as a root. Leave ____ for a fill-in blank.</p>
      {ws.sections.map((s, si) => (
        <section key={si} className="rounded-2xl border border-slate-200 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input value={s.heading} onChange={(e) => setSection(si, { heading: e.target.value })} className={input + " font-semibold"} aria-label="Section heading" />
            <select value={s.columns || 1} onChange={(e) => setSection(si, { columns: Number(e.target.value) })} className={input} aria-label="Columns">{[1, 2, 3, 4].map((c) => <option key={c} value={c}>{c} column{c > 1 ? "s" : ""}</option>)}</select>
            <input value={s.directions || ""} onChange={(e) => setSection(si, { directions: e.target.value })} placeholder="Section directions (optional)" className={input + " sm:col-span-2"} />
            {s.passage !== undefined && <textarea value={s.passage} onChange={(e) => setSection(si, { passage: e.target.value })} rows={4} className={input + " sm:col-span-2"} aria-label="Reading passage" />}
          </div>
          <ol className="mt-3 space-y-3">
            {s.items.map((it, ii) => (
              <li key={ii} className="rounded-xl bg-slate-50 p-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 w-6 shrink-0 text-sm font-bold text-slate-500">{ii + 1}.</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <textarea value={it.prompt} onChange={(e) => setItem(si, ii, { prompt: e.target.value })} rows={2} className={input} aria-label="Question" />
                    {it.choices && (
                      <div className="grid gap-1 sm:grid-cols-2">{it.choices.map((c, ci) => <input key={ci} value={c} onChange={(e) => setItem(si, ii, { choices: it.choices!.map((x, k) => (k === ci ? e.target.value : x)) })} className={input} aria-label={`Choice ${"ABCD"[ci]}`} />)}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-rose-700">Answer</span>
                      <input value={it.answer} onChange={(e) => setItem(si, ii, { answer: e.target.value })} className={input + " flex-1 border-rose-200"} aria-label="Answer" />
                      <select value={it.kind || "short"} onChange={(e) => setItem(si, ii, { kind: e.target.value as any, ...(e.target.value === "choice" && !it.choices ? { choices: ["", "", "", ""] } : {}) })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900" aria-label="Question type">
                        <option value="short">Write answer</option><option value="work">Show work box</option><option value="choice">Multiple choice</option><option value="blank">Fill in blank</option><option value="truefalse">True / false</option><option value="graph">Picture to complete</option>
                      </select>
                      {(it.kind === "short" || !it.kind) && <select value={it.lines || 2} onChange={(e) => setItem(si, ii, { lines: Number(e.target.value) })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900" aria-label="Answer lines">{[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n} line{n > 1 ? "s" : ""}</option>)}</select>}
                      {it.kind === "work" && <select value={it.space || "medium"} onChange={(e) => setItem(si, ii, { space: e.target.value as any })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900" aria-label="Work space"><option value="small">Small box</option><option value="medium">Medium box</option><option value="large">Large box</option></select>}
                    </div>
                    {it.visual && <VisualNumbers v={it.visual} onChange={(visual) => setItem(si, ii, { visual })} />}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button type="button" aria-label="Move up" onClick={() => moveItem(si, ii, -1)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-800"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" onClick={() => moveItem(si, ii, 1)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-800"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Delete question" onClick={() => setSection(si, { items: s.items.filter((_x, k) => k !== ii) })} className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={smallBtn} onClick={() => setSection(si, { items: [...s.items, { kind: "short", prompt: "", answer: "", lines: 2 }] })}><Plus className="h-3.5 w-3.5" /> Add a question</button>
            {ws.sections.length > 1 && <button type="button" className={smallBtn + " text-slate-500"} onClick={() => onChange({ ...ws, sections: ws.sections.filter((_x, k) => k !== si) })}><Trash2 className="h-3.5 w-3.5" /> Remove section</button>}
          </div>
        </section>
      ))}
      <button type="button" className={smallBtn} onClick={() => onChange({ ...ws, sections: [...ws.sections, { heading: `Part ${ws.sections.length + 1}`, items: [{ kind: "short", prompt: "", answer: "", lines: 2 }] }] })}><Plus className="h-3.5 w-3.5" /> Add a section</button>
    </div>
  );
}

/** The numbers in a picture (a number line's ends, a fraction's parts, a clock's time…), editable. */
function VisualNumbers({ v, onChange }: { v: NonNullable<WorksheetItem["visual"]>; onChange: (v: NonNullable<WorksheetItem["visual"]>) => void }) {
  const fields: [string, string][] = v.type === "number-line" ? [["min", "From"], ["max", "To"], ["step", "Step"]]
    : v.type === "coordinate-plane" ? [["xMin", "x from"], ["xMax", "x to"], ["yMin", "y from"], ["yMax", "y to"]]
    : v.type === "fraction-bar" || v.type === "fraction-circle" ? [["parts", "Parts"], ["shaded", "Shaded"]]
    : v.type === "clock" ? [["hour", "Hour"], ["minute", "Minute"]]
    : v.type === "array" ? [["rows", "Rows"], ["cols", "Columns"]]
    : v.type === "ten-frame" ? [["filled", "Counters"]]
    : v.type === "angle" ? [["degrees", "Degrees"]]
    : v.type === "base-ten" ? [["hundreds", "Hundreds"], ["tens", "Tens"], ["ones", "Ones"]] : [];
  if (!fields.length) return <p className="text-[11px] text-slate-500">Picture: {v.type.replace("-", " ")}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
      <span className="font-semibold">Picture ({v.type.replace("-", " ")}):</span>
      {fields.map(([k, label]) => <label key={k} className="flex items-center gap-1">{label}<input type="number" value={(v as any)[k] ?? 0} onChange={(e) => onChange({ ...(v as any), [k]: Number(e.target.value) })} className="w-16 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-900" /></label>)}
    </div>
  );
}

/** Make a worksheet on any topic, without making a lesson first. It can then be saved to a lesson. */
export function WorksheetMaker({ token, state, className, lessons, onSave, onClose }: {
  token: string | null;
  state: string;
  className: string;
  /** Lessons it can be saved to: id and a label. */
  lessons: { id: string; label: string }[];
  onSave: (lessonId: string, ws: GenWorksheet) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({ topic: "", grade: "", subject: "Math", kind: "practice worksheet", count: 12, level: "on grade level", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ws, setWs] = useState<GenWorksheet | null>(null);
  const [target, setTarget] = useState("");
  async function make() {
    if (!f.topic.trim()) { setError("Type what the worksheet is about."); return; }
    setBusy(true); setError("");
    try {
      const data = await askLessonAi(token, { mode: "worksheet", topic: f.topic, grade: f.grade, subject: f.subject, state, kind: f.kind, count: f.count, level: f.level, notes: f.notes });
      setWs({ ...data.worksheet, grade: f.grade || undefined, subject: f.subject || undefined });
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  if (ws) return <WorksheetStudio ws={ws} className={className} onChange={setWs} onClose={onClose} extraFooter={lessons.length > 0 && (
    <span className="flex items-center gap-1.5">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="min-h-10 max-w-[12rem] rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900" aria-label="Save to lesson"><option value="">Save to a lesson…</option>{lessons.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
      <button type="button" disabled={!target} onClick={() => { onSave(target, ws); onClose(); }} className={smallBtn + " min-h-10 px-3"}>Save</button>
    </span>
  )} />;
  const field = "mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900";
  return (
    <HubModal title="Worksheet maker" onClose={onClose} size="lg">
      <div className="space-y-3 text-slate-900">
        <p className="text-sm text-slate-600">Printable worksheets with real maths, graphs, number lines, fraction pictures, reading passages and an answer key. Change anything before you print.</p>
        <label className="block text-xs font-semibold text-slate-500">Topic or skill<input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="e.g. adding fractions with unlike denominators; plotting points in all four quadrants; main idea of a nonfiction passage" className={field + " px-3"} autoFocus /></label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-500">Grade<select value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} className={field}><option value="">Any</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">Subject<select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className={field}>{LESSON_SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">Questions<input type="number" min={3} max={30} value={f.count} onChange={(e) => setF({ ...f, count: Number(e.target.value) || 12 })} className={field} /></label>
          <label className="text-xs font-semibold text-slate-500">Kind<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={field}>{["practice worksheet", "quiz", "unit test", "exit ticket", "homework", "warm-up", "graphing practice", "word problems", "reading comprehension with a passage", "vocabulary practice", "test review"].map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Level<select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} className={field}>{["on grade level", "below grade level (scaffolded, with examples and a word bank)", "above grade level (challenge)", "modified for students with IEPs (simplified language, fewer choices, bigger spaces)"].map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
        </div>
        <label className="block text-xs font-semibold text-slate-500">Anything else? <span className="font-normal">(optional)</span><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Include a coordinate plane; use money; Halloween theme; numbers under 100…" className={field + " px-3"} /></label>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <button type="button" disabled={busy} onClick={() => void make()} className={aiBtn + " min-h-11"}>{busy ? <Spinner label="Writing the worksheet and answer key…" /> : <><Sparkles className="h-4 w-4" /> Make worksheet</>}</button>
      </div>
    </HubModal>
  );
}
