// Arise WorkHub: Problem Solver. Snap, upload or paste a worksheet problem in any subject; read what the AI
// read (and fix it), then get the steps and the answer. Every answer is solved twice and its arithmetic is
// recomputed (shared/problemSolver.ts, server/problemSolver.ts); the badge says how well it was checked.
// Fractions show as real fractions.
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Camera, Check, ClipboardPaste, Copy, FileUp, History, RotateCcw, ShieldAlert, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { cleanSolved, solutionText, type SolveResult, type SolvedProblem } from "@shared/problemSolver";
import type { Workspace } from "@shared/teacherHub";
import { API_BASE } from "@/lib/queryClient";
import { mathHtml } from "@/lib/lessonExport";
import { pdfToImages, pdfToText } from "@/lib/pdfPages";
import { Card } from "./ui";

type Props = { workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; token: string | null; makeId: () => string; say: (t: string) => void };

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const light = btn + " border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
const SUBJECTS = ["Any subject", "Math", "ELA / Reading", "Writing & Grammar", "Science", "Social Studies", "Spanish", "Other"];
const GRADES = ["", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

async function post(token: string | null, path: string, body: unknown) {
  const res = await fetch(`${API_BASE}/api/teacher-hub/solver/${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "That didn't work. Try again.");
  return data;
}
async function photoData(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("bad image")); i.src = url; });
    // Big enough to read small print and exponents.
    const k = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally { URL.revokeObjectURL(url); }
}
/** Math in $…$ shown as real math (stacked fractions); everything else as plain, safe text. */
const Math_ = ({ text, className = "" }: { text: string; className?: string }) => <span className={className} dangerouslySetInnerHTML={{ __html: mathHtml(text, "katex") }} />;

export default function HubProblemSolver({ workspace, setWorkspace, token, makeId, say }: Props) {
  const history = useMemo(() => cleanSolved((workspace as any).solved), [(workspace as any).solved]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [problem, setProblem] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState<"" | "reading" | "solving">("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const camera = useRef<HTMLInputElement>(null), upload = useRef<HTMLInputElement>(null);

  // The KaTeX style sheet, so fractions stack on screen.
  useEffect(() => {
    if (document.getElementById("katex-css")) return;
    const l = document.createElement("link"); l.id = "katex-css"; l.rel = "stylesheet"; l.href = "/vendor/katex/katex.min.css"; document.head.appendChild(l);
  }, []);

  async function addFiles(list: FileList | File[] | null) {
    if (!list || !("length" in list) || !list.length) return;
    setError("");
    const next = [...photos];
    for (const f of [...list]) {
      try {
        if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
          const text = (await pdfToText(f, 4)).trim();
          if (text.replace(/\s+/g, "").length > 30) { setProblem((p) => (p ? `${p}\n\n${text}` : text)); continue; }
          next.push(...(await pdfToImages(f, 4 - next.length, 1800)));
        } else if (f.type.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/i.test(f.name)) {
          if (next.length < 4) next.push(await photoData(f));
        }
      } catch { setError(`“${f.name}” couldn't be opened. Try a screenshot instead.`); }
    }
    setPhotos(next.slice(0, 4));
    if (next.length > photos.length) await read(next);
  }
  // A screenshot pasted with ⌘V / Ctrl+V anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
      if (files.length && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); void addFiles(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  async function read(images: string[]) {
    setBusy("reading"); setResult(null);
    try { const d = await post(token, "read", { images }); setProblem(d.read); }
    catch (e: any) { setError(e.message); } finally { setBusy(""); }
  }
  async function solve() {
    setBusy("solving"); setError(""); setResult(null);
    try {
      const d: SolveResult = await post(token, "solve", { problem, subject: subject === SUBJECTS[0] ? "" : subject, grade });
      setResult(d);
      const saved: SolvedProblem = { ...d, id: makeId(), at: new Date().toISOString() };
      setWorkspace((w) => ({ ...w, solved: [saved, ...cleanSolved((w as any).solved)].slice(0, 50) } as Workspace));
    } catch (e: any) { setError(e.message); } finally { setBusy(""); }
  }
  const reset = () => { setPhotos([]); setProblem(""); setResult(null); setError(""); };
  async function copy(r: SolveResult) {
    try { await navigator.clipboard.writeText(solutionText(r)); say("Copied."); } catch { say("Couldn't copy on this device."); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Problem Solver</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Snap a worksheet problem in any subject. You'll see what was read, then the steps and the answer. Every answer is solved twice and its math is rechecked.</p>
        </div>
        {history.length > 0 && <button type="button" className={light} onClick={() => setShowHistory(!showHistory)}><History className="h-4 w-4" /> Recent ({history.length})</button>}
      </div>

      {showHistory && <Card title="Recent problems">
        <ul className="divide-y divide-slate-100">{history.map((h) => <li key={h.id} className="flex items-center gap-3 py-2">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setResult(h); setProblem(h.read); setShowHistory(false); }}>
            <div className="truncate text-sm font-semibold text-slate-900"><Math_ text={h.solution.question || h.read} /></div>
            <div className="truncate text-xs text-slate-500">Answer: <Math_ text={h.solution.answer} /></div>
          </button>
          <button type="button" aria-label="Delete" className="h-9 w-9 rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setWorkspace((w) => ({ ...w, solved: cleanSolved((w as any).solved).filter((x) => x.id !== h.id) } as Workspace))}><Trash2 className="mx-auto h-4 w-4" /></button>
        </li>)}</ul>
      </Card>}

      <Card title="1. The problem">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn + " bg-violet-700 text-white hover:bg-violet-800"} onClick={() => camera.current?.click()} data-testid="solver-camera"><Camera className="h-4 w-4" /> Take a picture</button>
            <button type="button" className={light} onClick={() => upload.current?.click()}><FileUp className="h-4 w-4" /> Upload a screenshot or PDF</button>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><ClipboardPaste className="h-3.5 w-3.5" /> or paste a screenshot (⌘V)</span>
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={upload} type="file" accept="image/*,.pdf,application/pdf" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          </div>
          {photos.length > 0 && <div className="flex flex-wrap gap-2">{photos.map((p, i) => <div key={i} className="relative"><img src={p} alt={`Problem photo ${i + 1}`} className="h-28 rounded-xl object-cover ring-1 ring-slate-200" />
            <button type="button" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow ring-1 ring-slate-200"><X className="h-3.5 w-3.5" /></button></div>)}</div>}
          <label className="block text-sm font-semibold text-slate-800">{photos.length ? "What was read (fix anything that's wrong before solving):" : "Or type the problem:"}
            <textarea value={problem} onChange={(e) => { setProblem(e.target.value); setResult(null); }} rows={Math.min(12, Math.max(4, problem.split("\n").length + 1))} maxLength={6000} disabled={busy === "reading"}
              placeholder={busy === "reading" ? "Reading the picture…" : "A soccer field is 120 yards long. Han measures 358 feet, 10 inches. What is the percent error?"}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal leading-relaxed text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" data-testid="solver-problem" />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-600">Subject<select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 block min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Explain for grade<select value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 block min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">{GRADES.map((g) => <option key={g} value={g}>{g ? (g === "K" ? "Kindergarten" : `Grade ${g}`) : "The problem's grade"}</option>)}</select></label>
            <button type="button" disabled={!!busy || problem.trim().length < 2} onClick={() => void solve()} className={btn + " bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm"} data-testid="solver-solve">
              <Sparkles className="h-4 w-4" />{busy === "solving" ? "Solving and double-checking…" : busy === "reading" ? "Reading the picture…" : "Solve it"}
            </button>
            {(problem || photos.length > 0) && <button type="button" className={light} onClick={reset}><RotateCcw className="h-4 w-4" /> New problem</button>}
          </div>
          {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
        </div>
      </Card>

      {result && <Card title="2. How to solve it" right={<button type="button" className={light} onClick={() => void copy(result)}><Copy className="h-4 w-4" /> Copy</button>}>
        <div className="space-y-4">
          <Verdict r={result} />
          {result.solution.question && <p className="text-base text-slate-800"><span className="font-semibold">The question: </span><Math_ text={result.solution.question} /></p>}
          <ol className="space-y-3">{result.solution.steps.map((st, i) => <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">{i + 1}</span>
            <Math_ text={st.text} className="block flex-1 text-[17px] leading-relaxed text-slate-900" />
          </li>)}</ol>
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
            <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Answer</div>
            <Math_ text={result.solution.answer} className="mt-1 block text-xl font-bold leading-relaxed text-slate-950" />
          </div>
        </div>
      </Card>}
    </div>
  );
}

function Verdict({ r }: { r: SolveResult }) {
  const good = r.verdict !== "unsure";
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${good ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`} data-testid="solver-verdict">
      {good ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      <span><b>{r.verdict === "checked" ? "Checked twice" : r.verdict === "settled" ? "Checked three times" : "Look this one over"}.</b> {r.note}{good && <Check className="ml-1 inline h-3.5 w-3.5" />}</span>
    </div>
  );
}
