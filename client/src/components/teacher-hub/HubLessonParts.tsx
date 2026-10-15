// Pieces of the Lesson Planner shared by its screens: class colours, the AI helper call,
// the state standards picker, the file slots (worksheets, PowerPoints, answer keys), the
// slideshow and the worksheet preview.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookCheck, Pencil, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Link2, Loader2, Maximize2, Plus, Presentation, Printer,
  Search, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { answerKeyText, downloadPptx, downloadWorksheetDoc, printHtml, worksheetHtml } from "@/lib/lessonExport";
import { driveBytesUsed, type DriveFile } from "@shared/driveApp";
import {
  GRADES, LESSON_SUBJECTS, MATERIAL_LABEL, US_STATES, standardCode, standardLine,
  type ClassColor, type FoundStandard, type GenSlide, type GenWorksheet, type LessonMaterial, type MaterialKind,
} from "@shared/lessonPlanner";
import { HubModal } from "./HubModal";
import { WorksheetStudio } from "./HubWorksheet";

// ─── Colours ────────────────────────────────────────────────────────────────

/** Tailwind needs whole class names written out, so each colour's set is spelled in full. */
export const COLOR: Record<ClassColor, { dot: string; chip: string; bar: string; soft: string; ring: string; text: string }> = {
  teal: { dot: "bg-teal-500", chip: "bg-teal-50 text-teal-800 border-teal-200", bar: "border-l-teal-500", soft: "bg-teal-50", ring: "ring-teal-300", text: "text-teal-800" },
  sky: { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-800 border-sky-200", bar: "border-l-sky-500", soft: "bg-sky-50", ring: "ring-sky-300", text: "text-sky-800" },
  violet: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-800 border-violet-200", bar: "border-l-violet-500", soft: "bg-violet-50", ring: "ring-violet-300", text: "text-violet-800" },
  rose: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-800 border-rose-200", bar: "border-l-rose-500", soft: "bg-rose-50", ring: "ring-rose-300", text: "text-rose-800" },
  amber: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-900 border-amber-200", bar: "border-l-amber-500", soft: "bg-amber-50", ring: "ring-amber-300", text: "text-amber-900" },
  emerald: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 border-emerald-200", bar: "border-l-emerald-500", soft: "bg-emerald-50", ring: "ring-emerald-300", text: "text-emerald-800" },
  indigo: { dot: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-800 border-indigo-200", bar: "border-l-indigo-500", soft: "bg-indigo-50", ring: "ring-indigo-300", text: "text-indigo-800" },
  orange: { dot: "bg-orange-500", chip: "bg-orange-50 text-orange-900 border-orange-200", bar: "border-l-orange-500", soft: "bg-orange-50", ring: "ring-orange-300", text: "text-orange-900" },
  slate: { dot: "bg-slate-500", chip: "bg-slate-100 text-slate-700 border-slate-200", bar: "border-l-slate-400", soft: "bg-slate-50", ring: "ring-slate-300", text: "text-slate-700" },
};
export const NO_CLASS = COLOR.slate;

export const STATUS_STYLE: Record<string, string> = {
  idea: "bg-slate-100 text-slate-600", draft: "bg-amber-100 text-amber-800", ready: "bg-sky-100 text-sky-800", taught: "bg-emerald-100 text-emerald-800",
};

export const smallBtn = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";
export const aiBtn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-fuchsia-700 disabled:cursor-wait disabled:opacity-60";

// ─── The AI helper ──────────────────────────────────────────────────────────

export async function askLessonAi(token: string | null, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE}/api/teacher-hub/lessons/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "The AI helper couldn't answer right now. Try again.");
  return data;
}

export function Spinner({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{label}</span>;
}

// ─── State standards ────────────────────────────────────────────────────────

export function StandardsPicker({ token, chosen, onChange, state, onState, grade, subject, topic, recent }: {
  token: string | null;
  chosen: string[];
  onChange: (next: string[]) => void;
  state: string;
  onState: (state: string) => void;
  grade: string;
  subject: string;
  topic: string;
  /** Standards used on other lessons, newest first, to add again in one tap. */
  recent: string[];
}) {
  const [g, setG] = useState(grade);
  const [subj, setSubj] = useState(subject);
  const [query, setQuery] = useState(topic);
  const [found, setFound] = useState<FoundStandard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [own, setOwn] = useState("");
  useEffect(() => { setG(grade); }, [grade]);
  useEffect(() => { setSubj(subject); }, [subject]);

  const has = (s: string) => chosen.some((c) => standardCode(c).toLowerCase() === standardCode(s).toLowerCase());
  const add = (s: string) => { if (!has(s)) onChange([...chosen, s]); };
  async function search() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const data = await askLessonAi(token, { mode: "standards", state, grade: g, subject: subj, topic: query || topic });
      setFound(data.standards || []);
      if (!data.standards?.length) setError("No standards came back. Try different words.");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">On this lesson</div>
        {chosen.length ? (
          <ul className="space-y-1.5">
            {chosen.map((s) => (
              <li key={s} className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                <BookCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 break-words">{s}</span>
                <button type="button" aria-label={`Remove ${standardCode(s)}`} onClick={() => onChange(chosen.filter((c) => c !== s))} className="-m-1 rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">No standards yet. Find them below, or type your own.</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><Sparkles className="h-4 w-4 text-violet-600" /> Find state standards</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select aria-label="State" value={state} onChange={(e) => onState(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm">
            <option value="">Common Core / national</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Grade" value={g} onChange={(e) => setG(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm">
            <option value="">Any grade</option>{GRADES.map((x) => <option key={x} value={x}>Grade {x}</option>)}
          </select>
          <select aria-label="Subject" value={subj} onChange={(e) => setSubj(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm">
            <option value="">Any subject</option>{LESSON_SUBJECTS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Skill or topic, e.g. main idea, adding fractions" className="min-h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
          </div>
          <button type="submit" disabled={busy} className={aiBtn}>{busy ? <Spinner label="Finding" /> : <><Sparkles className="h-4 w-4" /> Find</>}</button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
        {found && found.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {found.map((f) => {
              const line = standardLine(f);
              const added = has(line);
              return (
                <li key={f.code} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                  <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{f.code}</span>
                  <span className="min-w-0 flex-1 text-slate-700">{f.text}</span>
                  <button type="button" disabled={added} onClick={() => add(line)} className={smallBtn}>{added ? "Added" : <><Plus className="h-3.5 w-3.5" /> Add</>}</button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-4 text-slate-500">AI-suggested codes — double-check them against your state's official standards before they go in an official plan.</p>
      </div>

      {recent.filter((r) => !has(r)).length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Used before</div>
          <div className="flex flex-wrap gap-1.5">
            {recent.filter((r) => !has(r)).slice(0, 12).map((r) => (
              <button key={r} type="button" title={r} onClick={() => add(r)} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-3 w-3" />{standardCode(r)}</button>
            ))}
          </div>
        </div>
      )}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (own.trim()) { add(own.trim()); setOwn(""); } }}>
        <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Type or paste a standard (code — description)" className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400" />
        <button type="submit" className={smallBtn + " min-h-10 px-3"}><Plus className="h-4 w-4" /> Add</button>
      </form>
    </div>
  );
}

// ─── Files: worksheets, PowerPoints, answer keys ────────────────────────────

const fileIcon = (m: LessonMaterial) => (m.slides ? <Presentation className="h-4 w-4" /> : m.url ? <Link2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />);

export function MaterialSlots({ token, files, onChange, makeId, drive, lessonTitle, color, className, aiContext, say }: {
  token: string | null;
  files: LessonMaterial[];
  onChange: (next: LessonMaterial[]) => void;
  makeId: () => string;
  /** The Hub's Drive files, so uploads count against the same storage. */
  drive: DriveFile[];
  lessonTitle: string;
  color: string;
  className: string;
  /** What the AI is told about this lesson. */
  aiContext: () => Record<string, unknown>;
  say: (text: string) => void;
}) {
  const [making, setMaking] = useState<MaterialKind | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [linkFor, setLinkFor] = useState<MaterialKind | null>(null);
  const [link, setLink] = useState({ name: "", url: "" });
  const [preview, setPreview] = useState<{ id: string; answers: boolean } | null>(null);
  const [present, setPresent] = useState<GenSlide[] | null>(null);
  const [opts, setOpts] = useState({ kind: "practice worksheet", count: 12, level: "on grade level", slides: 12 });

  const lessonBytes = useMemo(() => files.reduce((n, f) => n + (f.size || 0), 0), [files]);

  async function upload(kind: MaterialKind, list: FileList | null) {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    setError("");
    let used = driveBytesUsed(drive) + lessonBytes;
    const added: LessonMaterial[] = [];
    for (const file of picked) {
      setBusy(`Uploading ${file.name}…`);
      try {
        const res = await fetch(`${API_BASE}/api/lifehub/drive/upload`, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream", "x-drive-used-bytes": String(used), "x-drive-name": encodeURIComponent(file.name), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: file,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "That file could not be uploaded.");
        used += Number(data.size) || 0;
        added.push({ id: makeId(), kind, name: file.name, path: data.path, size: data.size, contentType: data.contentType, addedAt: new Date().toISOString() });
      } catch (e: any) { setError(`${file.name}: ${e.message}`); }
    }
    setBusy("");
    if (added.length) { onChange([...files, ...added]); say(added.length === 1 ? `${added[0].name} saved to this lesson.` : `${added.length} files saved to this lesson.`); }
  }

  async function open(m: LessonMaterial) {
    if (m.url) { window.open(m.url, "_blank", "noopener"); return; }
    if (m.slides) { setPresent(m.slides); return; }
    if (m.worksheet) { setPreview({ id: m.id, answers: m.kind === "answerKey" }); return; }
    if (!m.path) return;
    const w = window.open("", "_blank");
    try {
      const res = await fetch(`${API_BASE}/api/lifehub/drive/url`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: m.path }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.message || "That file could not be opened.");
      if (w) w.location.href = data.url; else window.location.href = data.url;
    } catch (e: any) { w?.close(); setError(e.message); }
  }

  async function remove(m: LessonMaterial) {
    onChange(files.filter((f) => f.id !== m.id));
    if (m.path && token) await fetch(`${API_BASE}/api/lifehub/drive/delete`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: m.path }) }).catch(() => {});
  }

  async function generate(kind: MaterialKind) {
    setError("");
    setBusy(kind === "slides" ? "Building your slides…" : kind === "answerKey" ? "Writing the questions and answer key…" : "Writing your worksheet…");
    try {
      if (kind === "slides") {
        const data = await askLessonAi(token, { ...aiContext(), mode: "slides", count: opts.slides });
        onChange([...files, { id: makeId(), kind: "slides", name: `${lessonTitle || "Lesson"} slides`, slides: data.slides, addedAt: new Date().toISOString() }]);
        say("Slides made. Present them here or download the PowerPoint.");
      } else {
        const data = await askLessonAi(token, { ...aiContext(), mode: "worksheet", kind: opts.kind, count: opts.count, level: opts.level });
        const ws: GenWorksheet = data.worksheet;
        const now = new Date().toISOString();
        // A worksheet always comes with its answer key, filed in the answer key slot.
        const pair = makeId();
        onChange([...files,
          { id: makeId(), kind: "worksheet", name: ws.title, worksheet: ws, addedAt: now, pair },
          { id: makeId(), kind: "answerKey", name: `${ws.title} — answer key`, worksheet: ws, addedAt: now, pair }]);
        say("Worksheet and its answer key are ready.");
      }
      setMaking(null);
    } catch (e: any) { setError(e.message); } finally { setBusy(""); }
  }

  const slots: { kind: MaterialKind; hint: string }[] = [
    { kind: "worksheet", hint: "Practice pages, quizzes, exit tickets" },
    { kind: "slides", hint: "PowerPoint, Google Slides, Canva" },
    { kind: "answerKey", hint: "Answers for grading" },
    { kind: "other", hint: "Anything else: readings, rubrics, videos" },
  ];

  return (
    <div className="space-y-3">
      {busy && <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800"><Loader2 className="h-4 w-4 animate-spin" />{busy}</div>}
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}
      {slots.map(({ kind, hint }) => {
        const mine = files.filter((f) => f.kind === kind);
        return (
          <section key={kind} className="rounded-2xl border border-slate-200 bg-white p-3" data-testid={`slot-${kind}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{MATERIAL_LABEL[kind]} {mine.length > 0 && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{mine.length}</span>}</div>
                <div className="text-xs text-slate-500">{hint}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <label className={smallBtn + " cursor-pointer"}><Upload className="h-3.5 w-3.5" /> Upload<input type="file" multiple hidden onChange={(e) => { void upload(kind, e.target.files); e.target.value = ""; }} accept={kind === "slides" ? ".ppt,.pptx,.pdf,.key,image/*" : undefined} /></label>
                <button type="button" className={smallBtn} onClick={() => { setLinkFor(linkFor === kind ? null : kind); setLink({ name: "", url: "" }); }}><Link2 className="h-3.5 w-3.5" /> Link</button>
                {kind !== "other" && <button type="button" className={smallBtn + " border-violet-200 text-violet-800 hover:bg-violet-50"} onClick={() => setMaking(making === kind ? null : kind)}><Sparkles className="h-3.5 w-3.5" /> Make with AI</button>}
              </div>
            </div>

            {linkFor === kind && (
              <form className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]" onSubmit={(e) => {
                e.preventDefault();
                const url = link.url.trim();
                if (!/^https?:\/\//i.test(url)) { setError("A link starts with https://"); return; }
                onChange([...files, { id: makeId(), kind, name: link.name.trim() || url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60), url, addedAt: new Date().toISOString() }]);
                setLinkFor(null);
              }}>
                <input value={link.name} onChange={(e) => setLink({ ...link, name: e.target.value })} placeholder="Name (optional)" className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                <input value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://docs.google.com/…" className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm" autoFocus />
                <button type="submit" className={smallBtn + " min-h-10 px-3"}>Save link</button>
              </form>
            )}

            {making === kind && (
              <div className="mt-2 rounded-xl bg-violet-50/70 p-3 ring-1 ring-violet-100">
                {kind === "slides" ? (
                  <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">About
                    <input type="number" min={4} max={20} value={opts.slides} onChange={(e) => setOpts({ ...opts, slides: Number(e.target.value) || 12 })} className="min-h-9 w-20 rounded-lg border border-slate-200 px-2" /> slides, with speaker notes
                  </label>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select aria-label="Kind" value={opts.kind} onChange={(e) => setOpts({ ...opts, kind: e.target.value })} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                      {["practice worksheet", "quiz", "unit test", "exit ticket", "homework", "warm-up", "graphing practice", "word problems", "reading comprehension with a passage", "vocabulary practice", "test review"].map((k) => <option key={k}>{k}</option>)}
                    </select>
                    <select aria-label="Level" value={opts.level} onChange={(e) => setOpts({ ...opts, level: e.target.value })} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                      {["on grade level", "below grade level (scaffolded, with word bank and examples)", "above grade level (challenge)", "modified for students with IEPs (simplified language, fewer choices, visuals described)"].map((k) => <option key={k} value={k}>{k.split(" (")[0]}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="number" min={3} max={30} value={opts.count} onChange={(e) => setOpts({ ...opts, count: Number(e.target.value) || 10 })} className="min-h-9 w-16 rounded-lg border border-slate-200 px-2" /> questions</label>
                  </div>
                )}
                {kind === "answerKey" && <p className="mt-2 text-xs text-slate-600">Makes a worksheet and its answer key together, so they match.</p>}
                <button type="button" disabled={!!busy} onClick={() => void generate(kind)} className={aiBtn + " mt-2"}><Sparkles className="h-4 w-4" /> {kind === "slides" ? "Make slides" : kind === "answerKey" ? "Make worksheet + key" : "Make worksheet"}</button>
              </div>
            )}

            {mine.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100">
                {mine.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                    <button type="button" onClick={() => void open(m)} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-slate-800 hover:text-teal-800">
                      <span className="shrink-0 rounded-lg bg-slate-100 p-1.5 text-slate-600">{fileIcon(m)}</span>
                      <span className="min-w-0 truncate">{m.name}</span>
                      {(m.worksheet || m.slides) && <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700">AI</span>}
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {m.slides && <>
                        <button type="button" className={smallBtn} onClick={() => setPresent(m.slides!)}><Maximize2 className="h-3.5 w-3.5" /> Present</button>
                        <button type="button" className={smallBtn} onClick={() => downloadPptx(m.name, m.slides!, color)}><Download className="h-3.5 w-3.5" /> .pptx</button>
                      </>}
                      {m.worksheet && <>
                        <button type="button" className={smallBtn} onClick={() => setPreview({ id: m.id, answers: m.kind === "answerKey" })}><Pencil className="h-3.5 w-3.5" /> View & edit</button>
                        <button type="button" className={smallBtn} onClick={() => { if (!printHtml(worksheetHtml(m.worksheet!, { answers: m.kind === "answerKey", className }))) setError("Allow pop-ups for this site to print."); }}><Printer className="h-3.5 w-3.5" /> Print</button>
                        <button type="button" className={smallBtn} onClick={() => downloadWorksheetDoc(m.worksheet!, m.kind === "answerKey", className)}><Download className="h-3.5 w-3.5" /> Word</button>
                      </>}
                      {m.url && <button type="button" className={smallBtn} onClick={() => window.open(m.url, "_blank", "noopener")}><ExternalLink className="h-3.5 w-3.5" /> Open</button>}
                      <button type="button" aria-label={`Remove ${m.name}`} className={smallBtn + " text-slate-400 hover:text-rose-600"} onClick={() => void remove(m)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {preview && (() => {
        const m = files.find((f) => f.id === preview.id);
        if (!m?.worksheet) return null;
        // Editing a worksheet changes its answer key too (and the other way round): they're one worksheet.
        const save = (ws: GenWorksheet) => onChange(files.map((f) => (f.id === m.id || (m.pair && f.pair === m.pair) ? { ...f, worksheet: ws, name: f.kind === "answerKey" ? `${ws.title} — answer key` : ws.title } : f)));
        return <WorksheetStudio ws={m.worksheet} startView={preview.answers ? "key" : "student"} className={className} onChange={save} onClose={() => setPreview(null)} />;
      })()}
      {present && <Slideshow slides={present} onClose={() => setPresent(null)} />}
    </div>
  );
}

export function Slideshow({ slides, onClose }: { slides: GenSlide[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  const s = slides[Math.min(i, slides.length - 1)];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") setI((n) => Math.min(slides.length - 1, n + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [slides.length, onClose]);
  const first = i === 0;
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-white" role="dialog" aria-label="Slideshow">
      <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-slate-300">
        <span>{i + 1} / {slides.length}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setNotes(!notes)} className="rounded-lg px-3 py-1.5 hover:bg-white/10">{notes ? "Hide notes" : "Speaker notes"}</button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="rounded-lg px-3 py-1.5 hover:bg-white/10"><Maximize2 className="h-4 w-4" /></button>
          <button type="button" onClick={onClose} aria-label="Close slideshow" className="rounded-lg px-3 py-1.5 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={() => setI((n) => Math.min(slides.length - 1, n + 1))}>
        <div className={`flex aspect-video w-full max-w-6xl flex-col overflow-hidden rounded-2xl shadow-2xl ${first ? "justify-end bg-gradient-to-br from-violet-700 to-indigo-800 p-[6%]" : "bg-white text-slate-900"}`}>
          {first ? (
            <>
              <h1 className="text-[clamp(1.6rem,5vw,4rem)] font-black leading-tight">{s.title}</h1>
              <div className="mt-4 space-y-1 text-[clamp(1rem,2vw,1.6rem)] text-violet-100">{s.bullets.map((b) => <p key={b}>{b}</p>)}</div>
            </>
          ) : (
            <>
              <div className="border-b-4 border-violet-600 bg-violet-50 px-[5%] py-[2.5%]"><h2 className="text-[clamp(1.2rem,3.2vw,2.8rem)] font-extrabold text-violet-800">{s.title}</h2></div>
              <ul className="flex-1 space-y-[1.6%] overflow-auto px-[6%] py-[3%] text-[clamp(.95rem,2.2vw,1.9rem)]">
                {s.bullets.map((b) => <li key={b} className="flex gap-3"><span className="mt-[.55em] h-2 w-2 shrink-0 rounded-full bg-violet-500" />{b}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>
      {notes && <div className="max-h-40 overflow-auto border-t border-white/10 px-6 py-3 text-sm text-slate-200">{s.notes || "No notes on this slide."}</div>}
      <div className="flex justify-center gap-3 pb-4">
        <button type="button" disabled={first} onClick={() => setI(i - 1)} className="rounded-full bg-white/10 p-3 disabled:opacity-30" aria-label="Previous slide"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" disabled={i >= slides.length - 1} onClick={() => setI(i + 1)} className="rounded-full bg-white/10 p-3 disabled:opacity-30" aria-label="Next slide"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

/** A labelled group of buttons that pick one value (a segmented control). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${value === o.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{o.label}</button>
      ))}
    </div>
  );
}
