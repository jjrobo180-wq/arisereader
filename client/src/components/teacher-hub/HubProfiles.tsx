// Arise WorkHub: Student profiles (a Plugin Gallery plugin). A shortcut to every student's whole profile: search,
// pin the students you open most, see who you opened last, and open a profile right here (caseload and
// supplementary students alike). The profile itself is HubStudentProfile.tsx.
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Pin, PinOff, Search } from "lucide-react";
import type { HubTab, Workspace } from "@shared/teacherHub";
import { studentProfile } from "@shared/hubStudentProfile";
import StudentProfileView from "./HubStudentProfile";
import { Card, Empty, Field } from "./ui";
import { AddStudentButton } from "./HubQuickAddStudent";

const initials = (name: string) => name.split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toUpperCase();

export default function HubProfiles({ workspace, setWorkspace, today, makeId, onOpenTab, onEdit, seats }: {
  workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; today: string; makeId: () => string; seats: number | null;
  onOpenTab: (tab: HubTab) => void; onEdit: (studentId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const pinned: string[] = Array.isArray((workspace as any).pinnedStudents) ? (workspace as any).pinnedStudents : [];
  const recent: string[] = Array.isArray((workspace as any).recentStudents) ? (workspace as any).recentStudents : [];
  const pin = (id: string) => setWorkspace((w) => { const cur: string[] = Array.isArray((w as any).pinnedStudents) ? (w as any).pinnedStudents : []; return { ...w, pinnedStudents: cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 24) } as Workspace; });
  const open = (id: string) => { setOpenId(id); setWorkspace((w) => { const cur: string[] = Array.isArray((w as any).recentStudents) ? (w as any).recentStudents : []; return { ...w, recentStudents: [id, ...cur.filter((x) => x !== id)].slice(0, 8) } as Workspace; }); };

  // A student just added opens straight away, once they're in the list.
  const [justAdded, setJustAdded] = useState("");
  useEffect(() => {
    if (!justAdded) return;
    const st = workspace.students.find((x) => x.name.trim().toLowerCase() === justAdded.trim().toLowerCase());
    if (st) { setJustAdded(""); open(st.id); }
  }, [justAdded, workspace.students]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => new Map(workspace.students.map((s) => [s.id, studentProfile(workspace, s.id, today)?.records ?? 0])), [workspace, today]);
  if (openId && workspace.students.some((s) => s.id === openId)) {
    return <StudentProfileView workspace={workspace} setWorkspace={setWorkspace} studentId={openId} today={today} makeId={makeId} onBack={() => setOpenId(null)} onPick={open} onOpenTab={onOpenTab} onEdit={onEdit} />;
  }
  const byId = new Map(workspace.students.map((s) => [s.id, s]));
  const words = q.trim().toLowerCase();
  const list = [...workspace.students].filter((s) => !words || s.name.toLowerCase().includes(words) || (s.grade || "").toLowerCase() === words).sort((a, b) => a.name.localeCompare(b.name));
  const tile = (id: string) => {
    const s = byId.get(id); if (!s) return null;
    const on = pinned.includes(id);
    return (
      <li key={id} className="flex items-stretch gap-1 rounded-2xl border border-slate-200 bg-white">
        <button type="button" onClick={() => open(id)} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left hover:bg-slate-50" data-testid="profiles-open">
          <span aria-hidden="true" className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold ${s.supplementary ? "bg-sky-100 text-sky-800" : "bg-teal-100 text-teal-800"}`}>{initials(s.name)}</span>
          <span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{s.name}</span>
            <span className="block truncate text-xs text-slate-500">{[s.grade && `Grade ${s.grade}`, s.supplementary ? "Supplementary" : "Caseload", `${counts.get(id) ?? 0} records`].filter(Boolean).join(" · ")}</span></span>
        </button>
        <button type="button" onClick={() => pin(id)} aria-label={on ? `Unpin ${s.name}` : `Pin ${s.name}`} title={on ? "Unpin" : "Pin"} className={`flex w-11 shrink-0 items-center justify-center rounded-2xl ${on ? "text-teal-700" : "text-slate-300 hover:text-slate-600"}`}>{on ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button>
      </li>
    );
  };
  return (
    <div className="space-y-5" data-testid="hub-profiles">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] max-w-md flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Field value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student" aria-label="Find a student" className="!pl-9" /></div>
        <AddStudentButton workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} seats={seats} label="Add a student (supplementary or caseload)"
          onAdded={(name) => { setQ(""); setJustAdded(name); }} />
      </div>
      {!words && pinned.some((id) => byId.has(id)) && <Card title="Pinned"><ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{pinned.map(tile)}</ul></Card>}
      {!words && recent.some((id) => byId.has(id)) && <Card title="Opened lately"><ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{recent.filter((id) => !pinned.includes(id)).map(tile)}</ul></Card>}
      <Card title={words ? "Found" : "Every student"}>{list.length ? <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{list.map((s) => tile(s.id))}</ul> : <Empty>{workspace.students.length ? "No student matches that." : "Add students on the Caseload page first."}</Empty>}</Card>
    </div>
  );
}
