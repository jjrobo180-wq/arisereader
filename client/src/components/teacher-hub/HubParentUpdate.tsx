// Arise WorkHub: the weekly parent update, on the Parents tab. Pick a student and a week; the email or text is
// written from the Minutes page (push-in notes with how they did, participation, behavior and notes; logged
// minutes) and the Lessons page (each lesson's marks). Edit it if you like, copy it, and log it as sent.
// The writing is shared/parentUpdate.ts.
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ClipboardCopy, Mail, MessageSquareText, RotateCcw, Save } from "lucide-react";
import { addDays } from "@shared/lessonPlanner";
import { DEFAULT_PARTS, UPDATE_PARTS, gatherWeek, isEmptyWeek, updateStudents, weekOf, writeUpdate, type UpdateFormat, type UpdatePart } from "@shared/parentUpdate";
import { fold } from "@shared/pushIn";
import type { Workspace } from "@shared/teacherHub";
import { Card, Field, Labeled, Select, TextArea } from "./ui";

const PARTS_KEY = "arise-hub-parent-update-parts";
function savedParts(): Record<UpdatePart, boolean> {
  try { const raw = JSON.parse(localStorage.getItem(PARTS_KEY) || "null"); if (raw && typeof raw === "object") return { ...DEFAULT_PARTS, ...raw }; } catch { /* use the defaults */ }
  return DEFAULT_PARTS;
}
const monthDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok;
    } catch { return false; }
  }
}

export default function HubParentUpdate({ workspace, setWorkspace, today, makeId }: {
  workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; today: string; makeId: () => string;
}) {
  const students = useMemo(() => updateStudents(workspace as any), [workspace.students, workspace.pushInNotes, workspace.lessons, workspace.serviceLogs]);
  const [student, setStudent] = useState("");
  const [day, setDay] = useState(today);
  const [format, setFormat] = useState<UpdateFormat>("email");
  const [parts, setParts] = useState<Record<UpdatePart, boolean>>(savedParts);
  const [guardian, setGuardian] = useState("");
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState<"" | "body" | "subject" | "logged">("");

  const teacher = workspace.profile.senderName || "";
  const role = workspace.profile.role || "";
  const setProfile = (change: Partial<Workspace["profile"]>) => setWorkspace((w) => ({ ...w, profile: { ...w.profile, ...change } }));

  const { from, to } = weekOf(day);
  const facts = useMemo(() => (student ? gatherWeek(student, from, to, { pushInNotes: workspace.pushInNotes, lessons: workspace.lessons, serviceLogs: workspace.serviceLogs }) : null),
    [student, from, to, workspace.pushInNotes, workspace.lessons, workspace.serviceLogs]);
  const written = useMemo(() => (facts ? writeUpdate(facts, { format, parts, teacher, role, guardian }) : null), [facts, format, parts, teacher, role, guardian]);
  const body = edited ?? written?.body ?? "";

  // A new student, week or format writes it fresh; the parent's name is the one used last time for that student.
  useEffect(() => { setEdited(null); setCopied(""); }, [student, from, format]);
  useEffect(() => {
    if (!student) return;
    const last = workspace.parentLogs.find((p) => fold(p.student) === fold(student) && p.guardian.trim());
    setGuardian(last?.guardian || "");
  }, [student]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(PARTS_KEY, JSON.stringify(parts)); } catch { /* not kept */ } }, [parts]);

  const flash = (what: typeof copied) => { setCopied(what); window.setTimeout(() => setCopied((c) => (c === what ? "" : c)), 2000); };
  const copyBody = async () => { if (await copy(body)) flash("body"); };
  const copySubject = async () => { if (written?.subject && await copy(written.subject)) flash("subject"); };
  const logIt = () => {
    if (!student || !body.trim()) return;
    const message = format === "email" && written?.subject ? `${written.subject}\n\n${body}` : body;
    setWorkspace((w) => ({ ...w, parentLogs: [{ id: makeId(), student, guardian, message, status: "Sent", date: today }, ...w.parentLogs] }));
    flash("logged");
  };
  const mailto = written?.subject ? `mailto:?subject=${encodeURIComponent(written.subject)}&body=${encodeURIComponent(body)}` : "";

  const pill = (on: boolean) => `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${on ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;

  return (
    <Card title="Weekly parent update">
      <p className="-mt-1 mb-4 text-sm text-slate-600">Pick a student and a week. The message is written from your Minutes notes and your lesson marks, including participation and behavior. Change anything you like, then copy it.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="parent-update-form">
        <Labeled label="Student">
          <Select value={student} onChange={(e) => setStudent(e.target.value)} data-testid="parent-update-student">
            <option value="">Choose a student</option>
            {students.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Labeled>
        <Labeled label={`Week of ${monthDay(from)}–${monthDay(to)}`}>
          <div className="flex gap-1.5">
            <Field type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="A day in the week" />
          </div>
        </Labeled>
        <Labeled label="Parent or guardian">
          <Field value={guardian} onChange={(e) => setGuardian(e.target.value)} placeholder="Ms. Ramirez" />
        </Labeled>
        <Labeled label="Send as">
          <div className="flex gap-1.5" role="group" aria-label="Email or text">
            <button type="button" aria-pressed={format === "email"} onClick={() => setFormat("email")} className={pill(format === "email")}><Mail className="h-4 w-4" /> Email</button>
            <button type="button" aria-pressed={format === "text"} onClick={() => setFormat("text")} className={pill(format === "text")}><MessageSquareText className="h-4 w-4" /> Text</button>
          </div>
        </Labeled>
        <Labeled label="Your name (how you sign)">
          <Field value={teacher} onChange={(e) => setProfile({ senderName: e.target.value })} placeholder="Mr. J" />
        </Labeled>
        <Labeled label="Your position" className="md:col-span-2">
          <Field value={role} onChange={(e) => setProfile({ role: e.target.value })} placeholder="math lab teacher (I also push in to math class)" />
        </Labeled>
        <div className="flex items-end gap-1.5">
          <button type="button" onClick={() => setDay(today)} className={pill(weekOf(today).from === from)}>This week</button>
          <button type="button" onClick={() => setDay(addDays(weekOf(today).from, -7))} className={pill(addDays(weekOf(today).from, -7) === from)}>Last week</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="What to include">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Include</span>
        {UPDATE_PARTS.map((p) => (
          <button key={p.id} type="button" aria-pressed={parts[p.id]} onClick={() => setParts((x) => ({ ...x, [p.id]: !x[p.id] }))}
            className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition ${parts[p.id] ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
            {parts[p.id] && <Check className="h-3.5 w-3.5" />}{p.label}
          </button>
        ))}
      </div>

      {!student ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Choose a student to write their update.</p>
      ) : (
        <div className="mt-4 space-y-3" data-testid="parent-update-result">
          {facts && isEmptyWeek(facts) && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nothing is saved for {student} this week yet. Mark them on the Minutes page or in a lesson's Students tab, or type a highlight below.</p>
          )}
          {facts && !isEmptyWeek(facts) && (
            <p className="text-xs text-slate-500">From {facts.entries.filter((e) => e.source === "class").length} class notes, {facts.entries.filter((e) => e.source === "lesson").length} lessons and {facts.sessions} logged sessions.</p>
          )}
          {format === "email" && written?.subject && (
            <div className="flex items-center gap-2">
              <Field value={written.subject} readOnly aria-label="Subject" />
              <button type="button" onClick={copySubject} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {copied === "subject" ? <Check className="h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="h-4 w-4" />} Subject
              </button>
            </div>
          )}
          <TextArea value={body} onChange={(e) => setEdited(e.target.value)} rows={format === "email" ? 16 : 7} aria-label="Message" data-testid="parent-update-body" className="font-[inherit] leading-6" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copyBody} data-testid="parent-update-copy" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              {copied === "body" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}{copied === "body" ? "Copied" : `Copy ${format === "email" ? "email" : "text"}`}
            </button>
            {format === "email" && mailto && <a href={mailto} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Mail className="h-4 w-4" /> Open in email</a>}
            <button type="button" onClick={logIt} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {copied === "logged" ? <Check className="h-4 w-4 text-emerald-600" /> : <Save className="h-4 w-4" />}{copied === "logged" ? "Saved to contact log" : "Save to contact log"}
            </button>
            {edited !== null && <button type="button" onClick={() => setEdited(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-500 hover:bg-slate-100"><RotateCcw className="h-4 w-4" /> Rewrite from notes</button>}
          </div>
        </div>
      )}
    </Card>
  );
}
