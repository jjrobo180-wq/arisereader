// Work Home: the teacher's classes, subjects and teachers in one place, with add, edit and remove.
// (The same editor the Lessons screen opens, so nothing needs the Lessons add-on to be switched on.)
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Workspace } from "@shared/teacherHub";
import { cleanClasses, type LessonClass } from "@shared/lessonPlanner";
import { schoolBlocks } from "@shared/hubBlocks";
import { ClassesManager } from "./HubLessons";
import { COLOR } from "./HubLessonParts";

export function HubClassesCard({ workspace, setWorkspace, makeId }: {
  workspace: Workspace; setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>; makeId: () => string;
}) {
  const classes = useMemo(() => cleanClasses((workspace as any).lessonClasses), [(workspace as any).lessonClasses]);
  const [open, setOpen] = useState<string | null | "new">(null);
  const setClasses = (fn: (all: LessonClass[]) => LessonClass[]) => setWorkspace((p) => ({ ...p, lessonClasses: fn(cleanClasses((p as any).lessonClasses)) } as any));
  const remove = (c: LessonClass) => { if (confirm(`Remove ${c.name}?`)) setClasses((all) => all.filter((x) => x.id !== c.id)); };
  const lessons = ((workspace.lessons || []) as any[]);
  return (
    <div data-testid="home-classes">
      {classes.length === 0 && <p className="mb-3 text-sm text-slate-500">Add each class or period you teach, with its subject, teacher, room and students.</p>}
      <ul className="space-y-2">
        {classes.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
            <span className={`h-3 w-3 shrink-0 rounded-full ${COLOR[c.color].dot}`} />
            <button type="button" onClick={() => setOpen(c.id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate font-semibold text-slate-900">{c.name}</span>
              <span className="block truncate text-xs text-slate-500">{[c.subject, c.teacher, c.room && `Room ${c.room}`, c.grade && `Grade ${c.grade}`, `${c.students.length} students`].filter(Boolean).join(" · ")}</span>
            </button>
            <button type="button" aria-label={`Edit ${c.name}`} onClick={() => setOpen(c.id)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
            <button type="button" aria-label={`Delete ${c.name}`} onClick={() => remove(c)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <button type="button" data-testid="home-add-class" onClick={() => setOpen("new")} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> Add a class</button>
      {open && <ManagerWithStart open={open} classes={classes} setClasses={setClasses} workspace={workspace} makeId={makeId} lessons={lessons} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Opens the editor on the class that was tapped, or on a brand new one.
function ManagerWithStart({ open, classes, setClasses, workspace, makeId, lessons, onClose }: {
  open: string; classes: LessonClass[]; setClasses: (fn: (all: LessonClass[]) => LessonClass[]) => void; workspace: Workspace; makeId: () => string; lessons: any[]; onClose: () => void;
}) {
  const [started] = useState(() => {
    if (open !== "new") return open;
    const id = makeId();
    setClasses((all) => [...all, { id, name: `Class ${all.length + 1}`, block: "", subject: "", grade: "", color: "teal", days: [], room: "", teacher: "", students: [] }]);
    return id;
  });
  return <ClassesManager initialId={started} classes={classes} setClasses={setClasses} caseload={workspace.students.map((s) => s.name)} blocks={schoolBlocks(workspace)} makeId={makeId} lessons={lessons} onClose={onClose} />;
}
