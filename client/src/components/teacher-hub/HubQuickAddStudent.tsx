// Add a student without leaving IEP & Meetings.
// Uses the exact same shared student/team save function as Caseload. No second roster.
import { useState, type Dispatch, type SetStateAction } from "react";
import { Plus } from "lucide-react";
import { addStudentWithTeam, draftHasAnyone, emptyTeamDraft, type StudentDetails } from "@shared/hubStudentTeam";
import { StudentTeamFields } from "./HubStudentTeam";
import { Field, LevelSelect, PrimaryButton, TextArea } from "./ui";
import { HubModal } from "./HubModal";
import type { Workspace } from "@shared/teacherHub";

type Props = {
  workspace: Workspace;
  setWorkspace: Dispatch<SetStateAction<Workspace>>;
  makeId: () => string;
  seats: number | null;
  onAdded: (studentName: string) => void;
  onCancel?: () => void;
  /** Offer "Supplementary student" (not on the IEP caseload), ticked to start with when true. */
  supplementary?: boolean;
};

const blank = (): StudentDetails => ({
  name: "", grade: "", accommodations: "", iepDate: "", reevalDate: "",
  readingLevel: "", mathLevel: "", notes: "", disability1: "", disability2: ""
});

export default function HubQuickAddStudent({ workspace, setWorkspace, makeId, seats, onAdded, onCancel, supplementary }: Props) {
  const [form, setForm] = useState<StudentDetails>(() => (supplementary ? { ...blank(), supplementary: true } : blank()));
  const sup = !!form.supplementary;
  const [team, setTeam] = useState(emptyTeamDraft);
  const [extra, setExtra] = useState(false);
  const [error, setError] = useState("");
  const full = seats !== null && workspace.students.length >= seats;
  const showExtra = extra || !!form.disability1 || !!form.disability2 || draftHasAnyone(team);
  const update = (values: Partial<StudentDetails>) => { setForm((f) => ({ ...f, ...values })); setError(""); };

  function add() {
    if (full) { setError("Your caseload is at its student limit. You can add seats from Billing."); return; }
    const result = addStudentWithTeam(workspace, form, team, makeId, seats);
    if (!result.ok) { setError(result.message); return; }

    // The student belongs to workspace.students, just as when added from Caseload.
    // Updating the shared workspace makes the new student available immediately in
    // both tabs, the meeting wizard, the IEP guide and the scheduling poll.
    setWorkspace((current) => {
      const saved = addStudentWithTeam(current, form, team, makeId, seats);
      return saved.ok ? saved.workspace : current;
    });
    onAdded(form.name.trim().replace(/\s+/g, " "));
  }

  return <div className="space-y-3" data-testid="iep-quick-add-student">
    <p className="text-sm text-slate-600">Add the student once. They get a full profile and show in every student list (Caseload, schedules, minutes, notes and the rest).</p>
    {supplementary !== undefined && <label className="flex min-h-11 items-center gap-3 rounded-xl bg-sky-50 px-3 text-sm text-slate-800 ring-1 ring-sky-100">
      <input type="checkbox" className="h-5 w-5 shrink-0" checked={sup} onChange={(e) => update({ supplementary: e.target.checked || undefined })} data-testid="quick-add-supplementary" />
      <span><span className="font-semibold">Supplementary student</span> <span className="text-slate-600">(not on my IEP caseload: a full profile, left out of IEP lists)</span></span>
    </label>}
    {full && <div role="alert" className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">Your caseload is full ({seats} seats). <a href="#/billing" className="font-bold underline">View billing to add seats</a>.</div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-slate-700">Student name
        <Field value={form.name} autoFocus maxLength={80} onChange={(e) => update({ name: e.target.value })} placeholder="First and last name" aria-label="New student name" data-testid="iep-new-student-name" />
      </label>
      <label className="text-xs font-bold text-slate-700">Grade
        <Field value={form.grade} onChange={(e) => update({ grade: e.target.value })} placeholder="Grade" />
      </label>
      {!sup && <label className="text-xs font-bold text-slate-700">IEP deadline
        <Field type="date" value={form.iepDate} onChange={(e) => update({ iepDate: e.target.value })} />
      </label>}
      {!sup && <label className="text-xs font-bold text-slate-700">Reevaluation deadline
        <Field type="date" value={form.reevalDate} onChange={(e) => update({ reevalDate: e.target.value })} />
      </label>}
      <label className="text-xs font-bold text-slate-700">Reading level (optional)
        <LevelSelect value={form.readingLevel} onChange={(v) => update({ readingLevel: v })} aria-label="Reading level" />
      </label>
      <label className="text-xs font-bold text-slate-700">Math level (optional)
        <LevelSelect value={form.mathLevel} onChange={(v) => update({ mathLevel: v })} aria-label="Math level" />
      </label>
      <label className="text-xs font-bold text-slate-700 sm:col-span-2">Accommodations (optional)
        <Field value={form.accommodations} onChange={(e) => update({ accommodations: e.target.value })} />
      </label>
      <label className="text-xs font-bold text-slate-700 sm:col-span-2">Notes (optional)
        <TextArea value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>
    </div>
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <button type="button" onClick={() => setExtra((v) => !v)} aria-expanded={showExtra} className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm font-semibold text-slate-800">
        Disabilities and IEP team (optional)<span className="text-teal-700">{showExtra ? "Hide" : "Add"}</span>
      </button>
      {showExtra && <div className="border-t border-slate-200 p-3">
        <StudentTeamFields details={form} onDetails={update} draft={team} onDraft={(next) => { setTeam(next); setError(""); }} contacts={workspace.spedContacts} />
      </div>}
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="iep-quick-add-error">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <span data-testid="iep-quick-add-save"><PrimaryButton type="button" onClick={add} disabled={full}><Plus className="h-4 w-4"/> {sup ? "Add student" : "Add to caseload"}</PrimaryButton></span>
      {onCancel && <button type="button" onClick={onCancel} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>}
    </div>
  </div>;
}

/**
 * An "Add a student" button that opens the quick-add form, with "Supplementary student" ticked to start with
 * (it's for pages like Student profiles and Student schedules, where a gen ed student is often the one to add).
 */
export function AddStudentButton({ workspace, setWorkspace, makeId, seats, onAdded, label = "Add a student", className }: Omit<Props, "onCancel" | "supplementary"> & { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} data-testid="add-student-button"
      className={className ?? "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"}>
      <Plus className="h-4 w-4" /> {label}
    </button>
    {open && <HubModal title="Add a student" size="lg" closeOnBackdrop onClose={() => setOpen(false)}>
      <HubQuickAddStudent workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} seats={seats} supplementary onCancel={() => setOpen(false)} onAdded={(name) => { setOpen(false); onAdded(name); }} />
    </HubModal>}
  </>;
}
