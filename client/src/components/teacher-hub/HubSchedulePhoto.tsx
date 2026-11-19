// Arise WorkHub, Student schedules: "Read a schedule photo". Pick the student, add a photo or screenshot of their
// schedule, and the AI reads each block of their week. The teacher checks and fixes the blocks, then adds them
// to that student: they show on Student schedules and on the student's profile (its Schedule part).
import { useState, type Dispatch, type SetStateAction } from "react";
import { Camera, Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { HUB_IMPORT_LIMITS } from "@shared/teacherHub";
import { SCHEDULE_DAYS, addScheduleRows, cleanScheduleRows, type ScheduleRow } from "@shared/hubSchedulePhoto";
import type { Workspace } from "@shared/teacherHub";
import { shrinkImage, toBase64 } from "./HubImport";
import { pdfToImages } from "@/lib/pdfPages";
import { Card, Field, Labeled, Select } from "./ui";
import { AddStudentButton } from "./HubQuickAddStudent";

export default function HubSchedulePhoto({ workspace, setWorkspace, token, students, makeId, say, seats }: {
  workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; token: string | null; seats: number | null;
  students: string[]; makeId: () => string; say: (text: string) => void;
}) {
  const [student, setStudent] = useState("");
  const [rows, setRows] = useState<(ScheduleRow & { on: boolean })[] | null>(null);
  const [summary, setSummary] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [replace, setReplace] = useState(true);
  const had = student ? workspace.schedules.filter((s) => s.student.trim().toLowerCase() === student.trim().toLowerCase()).length : 0;

  async function read(list: FileList | null) {
    const all = Array.from(list || []);
    const isPic = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name);
    // PDFs and Word, Excel and text files are read too, not only photos (the server reads what's inside).
    const isDoc = (f: File) => /\.(pdf|docx|doc|xlsx|xlsm|xls|csv|tsv|txt|pages|numbers)$/i.test(f.name) || f.type === "application/pdf";
    const files = all.filter(isPic);
    const docs = all.filter((f) => !isPic(f) && isDoc(f)).slice(0, 5);
    if (reading || (!files.length && !docs.length)) { if (all.length) setError("Choose a photo, a screenshot, a PDF or a Word document."); return; }
    if (docs.some((f) => f.size > 8 * 1024 * 1024)) { setError("That file is too large. The most this can read is 8 MB."); return; }
    if (!student) { setError("Choose the student first."); return; }
    setReading(true); setError(""); setRows(null);
    try {
      const images: string[] = [];
      for (const file of files.slice(0, HUB_IMPORT_LIMITS.images)) {
        try { images.push(await shrinkImage(file)); } catch { throw new Error("That photo could not be opened. Try a screenshot, or save it as a JPEG first."); }
      }
      // A PDF is turned into pictures of its pages here, the way a photo is read (a PDF sent as a file can be
      // turned down by the AI, like a locked school-system printout). If that can't be done, it goes as a file.
      const sendDocs: File[] = [];
      for (const doc of docs) {
        const room = HUB_IMPORT_LIMITS.images - images.length;
        if (/\.pdf$/i.test(doc.name) || doc.type === "application/pdf") {
          if (room > 0) {
            try { const pages = await pdfToImages(doc, room); if (pages.length) { images.push(...pages); continue; } }
            catch (e: any) { if (/password/i.test(String(e?.name || e?.message))) throw new Error("That PDF has a password. Open it, take a screenshot of the schedule and add that instead."); }
          }
        }
        sendDocs.push(doc);
      }
      const response = await fetch(`${API_BASE}/api/teacher-hub/import/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ images, student, files: await Promise.all(sendDocs.map(async (f) => ({ name: f.name, data: await toBase64(f) }))) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "That could not be read right now. Try again in a moment.");
      const found = cleanScheduleRows(data.rows);
      if (!found.length) throw new Error("No class times were found in that schedule. Try a clearer photo, or add the blocks yourself below.");
      setRows(found.map((r) => ({ ...r, on: true })));
      setSummary(typeof data.summary === "string" ? data.summary : "");
    } catch (e: any) {
      setError(e?.message || "That could not be read right now. Try again in a moment.");
    } finally { setReading(false); }
  }

  const edit = (i: number, change: Partial<ScheduleRow & { on: boolean }>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...change } : r)));
  const picked = (rows || []).filter((r) => r.on && (r.label.trim() || r.start));
  function save() {
    if (!student || !picked.length) return;
    setWorkspace((w) => ({ ...w, schedules: addScheduleRows(w.schedules, student, picked.map(({ on: _on, ...r }) => r), replace, makeId) }));
    say(`${picked.length} ${picked.length === 1 ? "block" : "blocks"} added to ${student}'s schedule. They're on ${student.split(/\s+/)[0]}'s profile too.`);
    setRows(null); setSummary("");
  }

  return (
    <Card title="Read a schedule with AI">
      <p className="-mt-1 mb-4 text-sm text-slate-600">Pick the student, then add a photo, screenshot, PDF or Word document of their schedule. Check the blocks the AI finds, then add them. They show here and on the student's profile.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Labeled label="Student">
          <Select value={student} onChange={(e) => { setStudent(e.target.value); setRows(null); setError(""); }} data-testid="schedule-photo-student">
            <option value="">Choose a student</option>
            {students.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Labeled>
        <div className="flex items-end"><AddStudentButton workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} seats={seats} label="New student" onAdded={(name) => { setStudent(name); setRows(null); setError(""); say(`${name} added. Now add their schedule.`); }} /></div>
        <div className="flex items-end">
          <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white ${student && !reading ? "bg-slate-950 hover:bg-slate-800" : "pointer-events-none bg-slate-300"}`} aria-disabled={!student || reading}>
            {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{reading ? "Reading…" : "Add a schedule"}
            <input type="file" accept="image/*,.pdf,application/pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" multiple className="sr-only" disabled={!student || reading} data-testid="schedule-photo-file" onChange={(e) => { void read(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {rows && (
        <div className="mt-4 space-y-3" data-testid="schedule-photo-rows">
          <p className="flex items-start gap-2 text-sm text-slate-700"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />{summary || `Found ${rows.length} blocks.`} Uncheck or fix anything that's wrong.</p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border p-2 md:grid-cols-[auto_9rem_7rem_7rem_minmax(0,1fr)_auto] ${r.on ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                <input type="checkbox" checked={r.on} onChange={(e) => edit(i, { on: e.target.checked })} className="h-5 w-5" aria-label={`Add ${r.day} ${r.label}`} />
                <Select value={r.day} onChange={(e) => edit(i, { day: e.target.value as ScheduleRow["day"] })} aria-label="Day">{SCHEDULE_DAYS.map((d) => <option key={d}>{d}</option>)}</Select>
                <Field type="time" value={r.start} onChange={(e) => edit(i, { start: e.target.value })} aria-label="Starts" className="col-start-2 md:col-start-auto" />
                <Field type="time" value={r.end} onChange={(e) => edit(i, { end: e.target.value })} aria-label="Ends" className="col-start-2 md:col-start-auto" />
                <Field value={r.label} onChange={(e) => edit(i, { label: e.target.value })} placeholder="Class / service" aria-label="Class" className="col-start-2 md:col-start-auto" />
                <button type="button" onClick={() => setRows((rs) => rs && rs.filter((_, j) => j !== i))} aria-label="Remove this block" className="col-start-2 inline-flex h-11 w-11 items-center justify-center justify-self-end rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 md:col-start-auto"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          {had > 0 && (
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-5 w-5" data-testid="schedule-photo-replace" />
              Replace {student}'s {had} existing {had === 1 ? "block" : "blocks"} (uncheck to add these beside them)
            </label>
          )}
          <button type="button" onClick={save} disabled={!picked.length} data-testid="schedule-photo-save" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
            <Check className="h-4 w-4" /> Add {picked.length} {picked.length === 1 ? "block" : "blocks"} to {student}
          </button>
        </div>
      )}
    </Card>
  );
}
