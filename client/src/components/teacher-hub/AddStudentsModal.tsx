// Add many students at once: download a CSV template, upload a filled-in CSV,
// or paste rows copied straight out of a spreadsheet. Every row needs a first
// name, last name and student number; the student number becomes both the
// student's username and their starting password (they're asked to pick
// their own password the first time they sign in — see ForcePasswordChange).
import { useMemo, useRef, useState } from "react";
import { Download, Upload, ClipboardPaste, UserPlus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { HubModal } from "./HubModal";
import { Card, Field, GhostButton, PrimaryButton, TextArea } from "./ui";

type Row = { firstName: string; lastName: string; studentNumber: string };
type Problem = { row: number; message: string };

const TEMPLATE_HEADER = "First name,Last name,Student number";
const TEMPLATE_EXAMPLE = "Jordan,Rivera,10234\nAvery,Chen,10235";

function downloadTemplate() {
  const blob = new Blob([`${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE}\n`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arise-student-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** A small, dependency-free parser for CSV or pasted spreadsheet rows (comma or
 *  tab separated, with basic double-quote support for fields containing a comma). */
function parseRows(text: string): Row[] {
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  const rows: Row[] = [];
  for (const line of lines) {
    const delim = line.includes("\t") ? "\t" : ",";
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === delim) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    const [first = "", last = "", number = ""] = cells.map((c) => c.trim());
    // Skip a header row ("First name, Last name, Student number" or similar).
    if (/^(first\s*name|first)$/i.test(first) && /^(last\s*name|last)$/i.test(last)) continue;
    if (!first && !last && !number) continue;
    rows.push({ firstName: first, lastName: last, studentNumber: number });
  }
  return rows;
}

export default function AddStudentsModal({ onClose, request, onDone }: {
  onClose: () => void;
  request: (path: string, options?: RequestInit) => Promise<any>;
  onDone: (text: string) => void;
}) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [pasted, setPasted] = useState("");
  const [uploadedRows, setUploadedRows] = useState<Row[] | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const pastedRows = useMemo(() => (mode === "paste" ? parseRows(pasted) : []), [mode, pasted]);
  const rows = mode === "upload" ? (uploadedRows || []) : pastedRows;

  const onFile = async (file: File) => {
    setError(""); setProblems([]);
    const text = await file.text();
    const parsed = parseRows(text);
    if (!parsed.length) { setError("That file doesn't have any usable rows. Make sure it has First name, Last name and Student number columns."); return; }
    setUploadedRows(parsed);
    setUploadedFileName(file.name);
  };

  const submit = async () => {
    if (!rows.length) return;
    setBusy(true); setError(""); setProblems([]);
    try {
      const data = await request("/api/teacher/students/bulk-add", {
        method: "POST",
        body: JSON.stringify({ students: rows }),
      });
      setSuccessCount(data.created?.length || 0);
      onDone(`Added ${data.created?.length || 0} student${data.created?.length === 1 ? "" : "s"}.`);
      onClose();
    } catch (e: any) {
      if (Array.isArray(e.problems)) setProblems(e.problems);
      else setError(e.message || "Couldn't add those students. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <HubModal title="Add students" onClose={onClose} size="lg" footer={
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length ? `${rows.length} student${rows.length === 1 ? "" : "s"} ready to add` : "No rows yet"}</p>
        <div className="flex gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={busy || !rows.length}>
            <UserPlus className="h-4 w-4" /> {busy ? "Adding…" : "Add students"}
          </PrimaryButton>
        </div>
      </div>
    }>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Each student's username and starting password are both their student number — they'll be asked to set their own password the first time they sign in.
        </p>

        <div className="flex rounded-xl border border-slate-200 p-1" role="tablist" aria-label="How to add students">
          <button type="button" role="tab" aria-selected={mode === "upload"} onClick={() => setMode("upload")} className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-semibold ${mode === "upload" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Upload a file</button>
          <button type="button" role="tab" aria-selected={mode === "paste"} onClick={() => setMode("paste")} className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-semibold ${mode === "paste" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Paste from a spreadsheet</button>
        </div>

        {mode === "upload" ? (
          <Card title="Upload a CSV">
            <div className="space-y-3">
              <GhostButton onClick={downloadTemplate}><Download className="h-4 w-4" /> Download the template (.csv)</GhostButton>
              <p className="text-sm text-slate-500">Fill in First name, Last name and Student number for each student, then upload it below.</p>
              <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
              <GhostButton onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> {uploadedFileName || "Choose a CSV file"}</GhostButton>
            </div>
          </Card>
        ) : (
          <Card title="Paste rows">
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Copy a First name / Last name / Student number range from a spreadsheet and paste it here (comma or tab separated — one student per line).</p>
              <TextArea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={"Jordan\tRivera\t10234\nAvery\tChen\t10235"}
                rows={8}
                className="font-mono text-sm"
                aria-label="Pasted student rows"
              />
            </div>
          </Card>
        )}

        {rows.length > 0 && (
          <Card title={`Preview (${rows.length})`}>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">First name</th><th className="py-1 pr-3">Last name</th><th className="py-1">Student number</th></tr></thead>
                <tbody>{rows.slice(0, 200).map((r, i) => <tr key={i} className="border-t border-slate-100"><td className="py-1.5 pr-3 text-slate-900">{r.firstName}</td><td className="py-1.5 pr-3 text-slate-900">{r.lastName}</td><td className="py-1.5 font-mono text-slate-700">{r.studentNumber}</td></tr>)}</tbody>
              </table>
              {rows.length > 200 && <p className="mt-2 text-xs text-slate-500">Showing the first 200 of {rows.length} rows.</p>}
            </div>
          </Card>
        )}

        {error && <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {problems.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="alert">
            <p className="font-semibold">Fix these rows and try again:</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{problems.slice(0, 30).map((p, i) => <li key={i}>Row {p.row}: {p.message}</li>)}</ul>
          </div>
        )}
        {successCount > 0 && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Added {successCount} student{successCount === 1 ? "" : "s"}.</div>}
      </div>
    </HubModal>
  );
}
