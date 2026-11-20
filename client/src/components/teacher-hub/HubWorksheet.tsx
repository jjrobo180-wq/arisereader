// Worksheets in the Lesson Planner: see the student copy and the answer key side by side, print
// either (or both together), save as PDF or Word, and change anything the AI wrote — questions,
// answers, choices, pictures' numbers, order, headings — before it goes to students.
//
// Also the Worksheet Maker: make a worksheet on any topic, without a lesson first.
import { useMemo, useState } from "react";
import { UPLOAD_ACCEPT, UPLOAD_LIMITS, type UploadedFile } from "@shared/uploads";
import { ArrowDown, ArrowUp, Copy, Download, FileText, Pencil, Plus, Printer, Scissors, Sparkles, Trash2, Upload } from "lucide-react";
import { cleanWorksheet, GRADES, LESSON_SUBJECTS, type GenWorksheet, type WorksheetItem } from "@shared/lessonPlanner";
import { answerKeyText, cutSheetsHtml, downloadWorksheetDoc, printHtml, worksheetHtml } from "@/lib/lessonExport";
import { groupByLevel, levelInstruction, levelLabel, parseLevel, type LeveledStudent } from "@shared/levelWorksheets";
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
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => downloadWorksheetDoc(ws, false, className)} title="The student worksheet as its own Word file, no answers" data-testid="ws-word-student"><FileText className="h-4 w-4" /> Worksheet file</button>
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => downloadWorksheetDoc(ws, true, className)} title="The answer sheet as its own separate Word file" data-testid="ws-word-key"><FileText className="h-4 w-4" /> Answer sheet file</button>
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{it.choices.map((c, ci) => <input key={ci} value={c} onChange={(e) => setItem(si, ii, { choices: it.choices!.map((x, k) => (k === ci ? e.target.value : x)) })} className={input} aria-label={`Choice ${"ABCD"[ci]}`} />)}</div>
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

const fileBase64 = (file: File): Promise<string> => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ""));
  r.onerror = () => no(new Error("read failed"));
  r.readAsDataURL(file);
});
/** A photo shrunk to 1600 px so a phone picture uploads quickly. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("bad image")); i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}
const IS_PHOTO = /\.(png|jpe?g|webp)$/i;

/** Make a worksheet on any topic, without making a lesson first. It can then be saved to a lesson. */
export function WorksheetMaker({ token, state, className, lessons, onSave, onClose, start }: {
  token: string | null;
  /** What the form starts with (a progress-monitoring probe for a goal, say). */
  start?: Partial<{ topic: string; grade: string; subject: string; kind: string; count: number; level: string; notes: string }>;
  state: string;
  className: string;
  /** Lessons it can be saved to: id and a label. */
  lessons: { id: string; label: string }[];
  onSave: (lessonId: string, ws: GenWorksheet) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({ topic: "", grade: "", subject: "Math", kind: "practice worksheet", count: 12, level: "on grade level", notes: "", ...start });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ws, setWs] = useState<GenWorksheet | null>(null);
  const [target, setTarget] = useState("");
  // An example to copy: typed or pasted problems, links, files (PDF, Word, ...) and photos.
  const [exText, setExText] = useState("");
  const [exLinks, setExLinks] = useState("");
  const [exFiles, setExFiles] = useState<UploadedFile[]>([]);
  const [exPhotos, setExPhotos] = useState<{ name: string; data: string }[]>([]);
  const hasExample = !!(exText.trim() || exLinks.trim() || exFiles.length || exPhotos.length);
  async function addExample(picked: FileList | null) {
    if (!picked?.length) return;
    setError("");
    const files = [...exFiles], photos = [...exPhotos];
    for (const file of [...picked]) {
      if (IS_PHOTO.test(file.name) || file.type.startsWith("image/")) {
        if (photos.length >= 6) { setError("Up to 6 photos."); continue; }
        try { photos.push({ name: file.name, data: await shrinkPhoto(file) }); } catch { setError(`“${file.name}” couldn’t be read. Try another picture.`); }
      } else {
        if (files.length >= UPLOAD_LIMITS.files) { setError(`Up to ${UPLOAD_LIMITS.files} files at a time.`); continue; }
        if (file.size > UPLOAD_LIMITS.fileBytes) { setError(`“${file.name}” is too big. The most for one file is ${Math.round(UPLOAD_LIMITS.fileBytes / 1_000_000)} MB.`); continue; }
        try { files.push({ name: file.name, data: await fileBase64(file) }); } catch { setError(`“${file.name}” couldn’t be read. Try adding it again.`); }
      }
    }
    setExFiles(files); setExPhotos(photos);
  }
  async function make() {
    if (!f.topic.trim() && !hasExample) { setError("Type what the worksheet is about, or add an example to copy."); return; }
    setBusy(true); setError("");
    try {
      const data = await askLessonAi(token, { mode: "worksheet", topic: f.topic, grade: f.grade, subject: f.subject, state, kind: f.kind, count: f.count, level: f.level, notes: f.notes, ...(hasExample ? { exampleText: exText, links: exLinks, files: exFiles, images: exPhotos.map((p) => p.data) } : {}) });
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
        <p className="text-sm text-slate-600">Printable worksheets with real maths, graphs, number lines, fraction pictures, reading passages and an answer sheet. The student worksheet and the answer sheet are separate files. Change anything before you print.</p>
        <label className="block text-xs font-semibold text-slate-500">Topic or skill <span className="font-normal">{hasExample ? "(optional when you add an example)" : ""}</span><input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="e.g. adding fractions with unlike denominators; plotting points in all four quadrants; main idea of a nonfiction passage" className={field + " px-3"} autoFocus /></label>
        <fieldset className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-3" data-testid="ws-example">
          <legend className="px-1 text-sm font-bold text-violet-900">Copy an example <span className="font-normal text-violet-700">(optional)</span></legend>
          <p className="text-sm text-slate-700">Give the AI a problem or a page you like. It writes new practice that are exact models of it (same kind of problem, same steps, new numbers and wording), so students get a different one than the one you show.</p>
          <label className="block text-xs font-semibold text-slate-600">Paste or type an example problem
            <textarea value={exText} onChange={(e) => setExText(e.target.value)} rows={3} maxLength={12000} placeholder="e.g. A shirt costs $24 and is 25% off. What is the sale price?" className={field + " py-2"} data-testid="ws-example-text" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">Link to the example: a web page or a Google Doc, Slides or Sheet (up to 3; set Google files to “Anyone with the link can view”)
            <input value={exLinks} onChange={(e) => setExLinks(e.target.value)} inputMode="url" autoComplete="off" maxLength={600} placeholder="https://…" className={field} data-testid="ws-example-links" />
          </label>
          <div>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white">
              <Upload className="h-4 w-4" /> Upload from this computer: photo, screenshot, PDF, Word, Excel…
              <input type="file" multiple hidden accept={UPLOAD_ACCEPT} onChange={(e) => { void addExample(e.target.files); e.target.value = ""; }} data-testid="ws-example-upload" />
            </label>
            <p className="mt-1 text-xs text-slate-600">Pictures or screenshots of a page, book or board, or a PDF, Word, Excel, PowerPoint or text file. Up to {UPLOAD_LIMITS.files} files and 6 photos.</p>
            {(exFiles.length > 0 || exPhotos.length > 0) && <ul className="mt-2 flex flex-wrap gap-2">
              {exFiles.map((x, i) => <li key={`f${i}`} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-300"><FileText className="h-3.5 w-3.5" />{x.name}<button type="button" aria-label={`Remove ${x.name}`} onClick={() => setExFiles(exFiles.filter((_, k) => k !== i))} className="ml-1 text-slate-500 hover:text-rose-600">×</button></li>)}
              {exPhotos.map((x, i) => <li key={`p${i}`} className="flex items-center gap-1 rounded-full bg-white py-1 pl-1 pr-3 text-xs font-semibold text-slate-800 ring-1 ring-slate-300"><img src={x.data} alt="" className="h-6 w-6 rounded object-cover" />{x.name}<button type="button" aria-label={`Remove ${x.name}`} onClick={() => setExPhotos(exPhotos.filter((_, k) => k !== i))} className="ml-1 text-slate-500 hover:text-rose-600">×</button></li>)}
            </ul>}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-500">Grade<select value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} className={field}><option value="">Any</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">Subject<select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className={field}>{LESSON_SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">How many questions<input type="number" min={1} max={30} value={f.count} onChange={(e) => setF({ ...f, count: Number(e.target.value) || 12 })} className={field} /></label>
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

/**
 * The leveled versions made for a class: who gets which, a look at (and changes to) each version,
 * and printing every student's copy with their name on it, ready to cut apart and hand out.
 */
function StudentPackets({ packets, className, note, onChange, onClose }: {
  packets: { ws: GenWorksheet; level: string; students: string[] }[];
  className: string;
  note: string;
  onChange: (next: { ws: GenWorksheet; level: string; students: string[] }[]) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState(note);
  const total = packets.reduce((n, p) => n + p.students.length, 0);
  const print = (keys: boolean) => { if (!printHtml(cutSheetsHtml(packets, { className, keys }))) setMsg("Allow pop-ups for this site to print."); };
  if (open !== null && packets[open]) return <WorksheetStudio ws={packets[open].ws} className={className} onChange={(ws) => onChange(packets.map((p, i) => (i === open ? { ...p, ws } : p)))} onClose={() => setOpen(null)} />;
  return (
    <HubModal title="Student copies" onClose={onClose} size="lg" footer={
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => print(false)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" data-testid="ws-print-cut"><Scissors className="h-4 w-4" /> Print {total} student copies</button>
        <button type="button" onClick={() => print(true)} className={smallBtn + " min-h-10 px-3"}><Printer className="h-4 w-4" /> Print copies + answer keys</button>
        <button type="button" onClick={() => print(false)} className={smallBtn + " min-h-10 px-3"} title="In the print window, choose Save as PDF"><Download className="h-4 w-4" /> PDF</button>
        {msg && <span className="text-sm text-rose-700">{msg}</span>}
      </div>
    }>
      <p className="mb-3 text-sm text-slate-600">{packets.length} version{packets.length === 1 ? "" : "s"} for {total} student{total === 1 ? "" : "s"}. Each copy prints with the student's name on top, in a dashed box to cut out. Open a version to check or change it first.</p>
      <ul className="space-y-2">
        {packets.map((p, i) => (
          <li key={i} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-slate-900">{p.level || "On grade level"} <span className="font-normal text-slate-500">· {p.ws.title}</span></div>
                <div className="mt-1 flex flex-wrap gap-1">{p.students.map((n) => <span key={n} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">{n}</span>)}</div>
              </div>
              <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => setOpen(i)}><Pencil className="h-4 w-4" /> Look / change</button>
            </div>
          </li>
        ))}
      </ul>
    </HubModal>
  );
}

/**
 * Modify for students: the teacher's own assignment (a photo, PDF, Word file, link or pasted text),
 * rewritten for each picked student at their reading or math level from their profile. Nothing else
 * to fill in: same tasks, same order, made easier to get into. Printed as cut-apart copies, one per
 * student, with their name on top.
 */
export function StudentCopiesMaker({ token, state, className, students, classes, onClose }: {
  token: string | null;
  state: string;
  className: string;
  students: LeveledStudent[];
  classes: { id: string; name: string; grade?: string; students: string[] }[];
  onClose: () => void;
}) {
  const [exText, setExText] = useState("");
  const [exLinks, setExLinks] = useState("");
  const [exFiles, setExFiles] = useState<UploadedFile[]>([]);
  const [exPhotos, setExPhotos] = useState<{ name: string; data: string }[]>([]);
  const [classPick, setClassPick] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [kind, setKind] = useState<"reading" | "math">("reading");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [packets, setPackets] = useState<{ ws: GenWorksheet; level: string; students: string[] }[] | null>(null);
  const hasOriginal = !!(exText.trim() || exLinks.trim() || exFiles.length || exPhotos.length);
  const listed = classPick ? students.filter((s) => classes.find((c) => c.id === classPick)?.students.includes(s.name)) : students;
  const levelOf = (s: LeveledStudent) => parseLevel(kind === "math" ? s.mathLevel : s.readingLevel) || parseLevel(s.grade);
  const chosen = students.filter((s) => picked.includes(s.name));
  const groups = groupByLevel(chosen, kind);

  async function addOriginal(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const files = [...exFiles], photos = [...exPhotos];
    for (const file of [...list]) {
      if (IS_PHOTO.test(file.name) || file.type.startsWith("image/")) {
        if (photos.length >= 6) { setError("Up to 6 photos."); continue; }
        try { photos.push({ name: file.name, data: await shrinkPhoto(file) }); } catch { setError(`“${file.name}” couldn’t be read. Try another picture.`); }
      } else {
        if (files.length >= UPLOAD_LIMITS.files) { setError(`Up to ${UPLOAD_LIMITS.files} files at a time.`); continue; }
        if (file.size > UPLOAD_LIMITS.fileBytes) { setError(`“${file.name}” is too big. The most for one file is ${Math.round(UPLOAD_LIMITS.fileBytes / 1_000_000)} MB.`); continue; }
        try { files.push({ name: file.name, data: await fileBase64(file) }); } catch { setError(`“${file.name}” couldn’t be read. Try adding it again.`); }
      }
    }
    setExFiles(files); setExPhotos(photos);
  }

  async function make() {
    if (!hasOriginal) { setError("Add the assignment first: upload it, paste it, or link it."); return; }
    if (!chosen.length) { setError("Pick at least one student."); return; }
    const classGrade = classes.find((c) => c.id === classPick)?.grade || "";
    setBusy(true); setError("");
    const made: { ws: GenWorksheet; level: string; students: string[] }[] = [];
    try {
      for (const [i, g] of groups.entries()) {
        setProgress(`Writing ${i + 1} of ${groups.length}: ${g.level ? levelLabel(g.level) : "original level"} (${g.students.length} student${g.students.length === 1 ? "" : "s"})…`);
        const data = await askLessonAi(token, {
          mode: "modify", subject: kind === "math" ? "Math" : "ELA", state, grade: g.level || classGrade, level: g.level ? levelInstruction(g.level, kind, classGrade) : "",
          exampleText: exText, links: exLinks, files: exFiles, images: exPhotos.map((p) => p.data),
        });
        made.push({ ws: { ...data.worksheet, grade: g.level || undefined }, level: g.level ? levelLabel(g.level) : "", students: g.students });
      }
      setPackets(made);
    } catch (e: any) {
      if (made.length) { setPackets(made); setError(`Only ${made.length} of ${groups.length} versions were made: ${e.message}`); }
      else setError(e.message);
    } finally { setBusy(false); setProgress(""); }
  }

  if (packets) return <StudentPackets packets={packets} className={className} note={error} onChange={setPackets} onClose={onClose} />;
  const field = "mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900";
  return (
    <HubModal title="Modify for students" onClose={onClose} size="lg" footer={
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !hasOriginal || !chosen.length} onClick={() => void make()} className={aiBtn + " min-h-11"} data-testid="copies-make">
          {busy ? <Spinner label={progress || "Writing…"} /> : <><Scissors className="h-4 w-4" /> Make {chosen.length || ""} student cop{chosen.length === 1 ? "y" : "ies"}</>}
        </button>
        {!busy && chosen.length > 0 && <span className="text-sm text-slate-600">{groups.length} version{groups.length === 1 ? "" : "s"}: {groups.map((g) => g.level ? levelLabel(g.level) : "original level").join(", ")}</span>}
        {error && <span className="w-full text-sm text-rose-700" role="alert">{error}</span>}
      </div>
    }>
      <div className="space-y-4 text-slate-900">
        <section className="space-y-2">
          <h3 className="text-sm font-extrabold text-slate-900"><span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs text-white">1</span>The assignment</h3>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white">
            <Upload className="h-4 w-4" /> Upload: photo, screenshot, PDF, Word…
            <input type="file" multiple hidden accept={UPLOAD_ACCEPT} onChange={(e) => { void addOriginal(e.target.files); e.target.value = ""; }} />
          </label>
          {(exFiles.length > 0 || exPhotos.length > 0) && <ul className="flex flex-wrap gap-2">
            {exFiles.map((x, i) => <li key={`f${i}`} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-300"><FileText className="h-3.5 w-3.5" />{x.name}<button type="button" aria-label={`Remove ${x.name}`} onClick={() => setExFiles(exFiles.filter((_, k) => k !== i))} className="ml-1 text-slate-500 hover:text-rose-600">×</button></li>)}
            {exPhotos.map((x, i) => <li key={`p${i}`} className="flex items-center gap-1 rounded-full bg-white py-1 pl-1 pr-3 text-xs font-semibold text-slate-800 ring-1 ring-slate-300"><img src={x.data} alt="" className="h-6 w-6 rounded object-cover" />{x.name}<button type="button" aria-label={`Remove ${x.name}`} onClick={() => setExPhotos(exPhotos.filter((_, k) => k !== i))} className="ml-1 text-slate-500 hover:text-rose-600">×</button></li>)}
          </ul>}
          <details className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-700">Or paste it, or link it (Google Doc, web page)</summary>
            <textarea value={exText} onChange={(e) => setExText(e.target.value)} rows={4} maxLength={12000} placeholder="Paste the assignment or test here" className={field + " py-2"} />
            <input value={exLinks} onChange={(e) => setExLinks(e.target.value)} inputMode="url" autoComplete="off" maxLength={600} placeholder="https://docs.google.com/… (set to Anyone with the link)" className={field + " mt-2"} />
          </details>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-extrabold text-slate-900"><span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs text-white">2</span>The students</h3>
          <div className="flex flex-wrap items-end gap-2">
            {classes.length > 0 && <label className="text-xs font-semibold text-slate-600">Class
              <select value={classPick} onChange={(e) => { const id = e.target.value; setClassPick(id); const c = classes.find((x) => x.id === id); setPicked(c ? students.filter((s) => c.students.includes(s.name)).map((s) => s.name) : []); }} className={field + " min-w-[10rem]"}>
                <option value="">All my students</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>}
            <Segmented label="Which level" value={kind} onChange={(v) => setKind(v as "reading" | "math")} options={[{ id: "reading", label: "Reading level" }, { id: "math", label: "Math level" }]} />
            <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => setPicked(Array.from(new Set([...picked, ...listed.map((s) => s.name)])))}>Select all</button>
            <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => setPicked(picked.filter((n) => !listed.some((s) => s.name === n)))}>Clear</button>
          </div>
          <ul className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-xl bg-white p-2 ring-1 ring-slate-200 sm:grid-cols-2">
            {listed.map((s) => { const l = levelOf(s); return (
              <li key={s.name}><label className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-slate-900 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4" checked={picked.includes(s.name)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.name] : picked.filter((n) => n !== s.name))} />
                <span className="flex-1 truncate">{s.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${l ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-500"}`}>{l ? levelLabel(l) : "original level"}</span>
              </label></li>); })}
            {!listed.length && <li className="p-2 text-sm text-slate-500">No students here yet.</li>}
          </ul>
          <p className="text-xs text-slate-500">Each student gets the assignment rewritten at their {kind} level, with their name on top. Set levels in Caseload → Edit. A student with no level gets the assignment at its own level, cleaned up.</p>
        </section>
      </div>
    </HubModal>
  );
}
