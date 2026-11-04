// Arise WorkHub: minutes for a whole class with one touch.
// The "By class" look on the minutes page: a card for each block (or half of a block) and whose class it is.
// Tapping a card opens a pop-up with everyone ticked; untick whoever did not show up, and one save logs
// the rest and marks the unticked ones absent. The rules are in shared/hubClassMinutes.ts.
import { useMemo, useState } from "react";
import { Check, ChevronRight, NotebookPen, Trash2, UserPlus, UserX, Users } from "lucide-react";
import { schoolBlocks } from "@shared/hubBlocks";
import { friendlyDate } from "@shared/hubDates";
import { countedPlan, optionalDays } from "@shared/hubProgress";
import { ABSENT_REASON, classCandidates, classGroups, classLogs, startPicks, waiting, type ClassGroup, type ClassResult } from "@shared/hubClassMinutes";
import { cleanName, minuteNames } from "@shared/hubMinutesBulk";
import { cleanPushInNotes, noteKey } from "@shared/pushIn";
import type { Workspace } from "@shared/teacherHub";
import { Empty, Field, GhostButton, Labeled, PrimaryButton } from "./ui";
import { HubModal } from "./HubModal";
import { MinutesPick } from "./HubMinutesBulk";

const people = (n: number) => `${n} ${n === 1 ? "student" : "students"}`;

/** The classes the teacher sees today, as cards to tap. */
export function ClassMinutesView({ workspace, today, onOpen, onNotes, onAdd, onDelete }: { workspace: Workspace; today: string; onOpen: (key: string) => void; /** Opens the class's notes (the "Class notes" look). */ onNotes?: (key: string) => void; onAdd?: (key: string) => void; onDelete?: (key: string) => void }) {
  const groups = useClassGroups(workspace, today);
  const blocks = useMemo(() => schoolBlocks(workspace), [workspace.minuteBlocks]);
  const noteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of cleanPushInNotes(workspace.pushInNotes)) counts.set(noteKey(n, blocks), (counts.get(noteKey(n, blocks)) || 0) + 1);
    return counts;
  }, [workspace.pushInNotes, blocks]);
  if (!groups.length) return <Empty>No classes yet. Give each student's required minutes a block (and, for push-in, whose class it is) with “Set required minutes” or “Add several students”, and each class shows up here to log with one touch.</Empty>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="class-cards">
      {groups.map((g) => {
        const due = g.students.filter((s) => s.due);
        const left = due.filter(waiting).length;
        const done = due.length > 0 && left === 0;
        const notes = noteCounts.get(g.key) || 0;
        return (
          <div key={g.key} className={`flex min-h-[88px] w-full flex-col overflow-hidden rounded-3xl border shadow-sm transition hover:border-slate-400 ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
            <button type="button" onClick={() => onOpen(g.key)} data-testid="class-card" className="flex min-h-[88px] w-full flex-1 items-center gap-3 p-4 text-left">
              <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${done ? "bg-emerald-600 text-white" : "bg-slate-950 text-white"}`} aria-hidden>{done ? <Check className="h-5 w-5" /> : <Users className="h-5 w-5" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold text-slate-950">{g.title}</span>
                {g.label && <span className="block truncate text-sm font-medium text-slate-700">{g.label}</span>}
                <span className="block text-xs text-slate-500">{people(g.students.length)}{due.length ? (done ? " · all logged today" : ` · ${left} to log today`) : " · none due today"}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            </button>
            {onNotes && (
              <button type="button" onClick={() => onNotes(g.key)} data-testid="class-notes" aria-label={`Class notes for ${[g.title, g.label].filter(Boolean).join(", ")}${notes ? `, ${notes} saved` : ""}`}
                className={`flex min-h-11 w-full items-center gap-2 border-t px-4 text-sm font-semibold ${done ? "border-emerald-200 text-emerald-900 hover:bg-emerald-100" : "border-slate-100 text-slate-700 hover:bg-slate-50"}`}>
                <NotebookPen className="h-4 w-4" aria-hidden /> Class notes{notes > 0 && <span className="rounded-full bg-slate-900/10 px-2 text-xs">{notes}</span>}
              </button>
            )}
            {(onAdd || onDelete) && <div className={`grid grid-cols-2 border-t ${done ? "border-emerald-200" : "border-slate-100"}`}>
              {onAdd && <button type="button" onClick={() => onAdd(g.key)} data-testid="class-add" aria-label={`Add students to ${[g.title, g.label].filter(Boolean).join(", ")}`} className="flex min-h-11 items-center gap-2 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><UserPlus className="h-4 w-4" aria-hidden /> Add students</button>}
              {onDelete && <button type="button" onClick={() => onDelete(g.key)} data-testid="class-delete" aria-label={`Delete ${[g.title, g.label].filter(Boolean).join(", ")}`} className="flex min-h-11 items-center gap-2 border-l border-inherit px-4 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" aria-hidden /> Delete class</button>}
            </div>}
          </div>
        );
      })}
    </div>
  );
}

/** Adds students to a class already made. They get the same service, days and minutes as the class. */
export function AddToClassModal({ workspace, today, groupKey, onSave, onClose }: { workspace: Workspace; today: string; groupKey: string; onSave: (group: ClassGroup, names: string[]) => void; onClose: () => void }) {
  const groups = useClassGroups(workspace, today);
  const group = groups.find((g) => g.key === groupKey);
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState<string[]>([]);
  const [name, setName] = useState("");
  if (!group) return <HubModal title="Class" size="sm" onClose={onClose}><p className="text-sm text-slate-600">This class isn't here any more.</p></HubModal>;
  const model = group.students[0];
  const list = classCandidates(minuteNames(workspace, typed), group, model.kind, groups);
  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const addTyped = () => { const n = cleanName(name); if (!n) return; if (!group.students.some((s) => s.student.toLowerCase() === n.toLowerCase())) { setTyped((t) => [...t, n]); setPicked((p) => (p.includes(n) ? p : [...p, n])); } setName(""); };
  const title = [group.title, group.label].filter(Boolean).join(" · ");
  return (
    <HubModal title={`Add students to ${title}`} size="sm" onClose={onClose}
      footer={<div className="flex flex-wrap gap-2"><span data-testid="class-add-save"><PrimaryButton onClick={() => onSave(group, picked)} disabled={!picked.length}>{picked.length ? `Add ${people(picked.length)}` : "Add students"}</PrimaryButton></span><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
      <div className="grid grid-cols-1 gap-3" data-testid="class-add-modal">
        <p className="text-sm text-slate-600">They get the same service, days and minutes as {model.student}: {model.kind}{model.subject ? `, ${model.subject}` : ""}. You can change anyone's minutes later under By student.</p>
        <div className="flex gap-2"><input className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm" aria-label="Student's name" placeholder="Type a name not listed" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }} /><GhostButton onClick={addTyped}>Add name</GhostButton></div>
        {list.length ? <ul className="space-y-2" aria-label="Students to add">{list.map((c) => { const on = picked.includes(c.name); return <li key={c.name}><button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(c.name)} data-testid="class-add-student" className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left text-sm ${on ? "border-slate-950 bg-white" : "border-slate-200 bg-slate-50"}`}>
          <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white"}`} aria-hidden>{on && <Check className="h-4 w-4" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-950">{c.name}</span>{c.movesFrom && <span className="block truncate text-xs font-medium text-amber-700">Moves here from {c.movesFrom}</span>}</span>
        </button></li>; })}</ul> : <p className="text-sm text-slate-500">Everyone on your list is already in this class. Type a name above to add someone new.</p>}
      </div>
    </HubModal>
  );
}

/** Confirms deleting a class. Its students and logged minutes stay unless asked otherwise. */
export function DeleteClassModal({ workspace, today, groupKey, onDelete, onClose }: { workspace: Workspace; today: string; groupKey: string; onDelete: (group: ClassGroup, removeMinutes: boolean) => void; onClose: () => void }) {
  const group = useClassGroups(workspace, today).find((g) => g.key === groupKey);
  const [removeMinutes, setRemoveMinutes] = useState(false);
  if (!group) return <HubModal title="Class" size="sm" onClose={onClose}><p className="text-sm text-slate-600">This class isn't here any more.</p></HubModal>;
  const title = [group.title, group.label].filter(Boolean).join(" · ");
  return (
    <HubModal title={`Delete ${title}?`} size="sm" onClose={onClose}
      footer={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => onDelete(group, removeMinutes)} data-testid="class-delete-confirm" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"><Trash2 className="h-4 w-4" aria-hidden /> Delete class</button><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
      <div className="grid grid-cols-1 gap-3 text-sm text-slate-700" data-testid="class-delete-modal">
        <p>The class comes off this page. Its students stay on your list, and minutes already logged are kept.</p>
        <label className="flex min-h-11 items-center gap-3 font-medium"><input type="checkbox" className="h-5 w-5" checked={removeMinutes} onChange={(e) => setRemoveMinutes(e.target.checked)} data-testid="class-delete-minutes" />Also remove their required minutes for this class</label>
      </div>
    </HubModal>
  );
}

/** The classes on a date, from the teacher's plans as they count. */
export function useClassGroups(workspace: Workspace, date: string): ClassGroup[] {
  return useMemo(() => {
    const optional = optionalDays(workspace);
    const plans = workspace.services.map((p) => countedPlan(p, optional));
    return classGroups(plans, schoolBlocks(workspace), workspace.serviceLogs, date);
  }, [workspace.services, workspace.serviceLogs, workspace.minuteBlocks, workspace.minuteOptionalDays, date]);
}

/** The pop-up for one class: everyone ticked, untick who did not show up, one save. */
export function ClassMinutesModal({ workspace, today, groupKey, onSave, onClose }: {
  workspace: Workspace; today: string; groupKey: string; onSave: (result: ClassResult, title: string) => void; onClose: () => void;
}) {
  const [date, setDate] = useState(today);
  const groups = useClassGroups(workspace, date);
  const group = groups.find((g) => g.key === groupKey);
  // Who is ticked, kept per day: changing the day starts over with that day's students.
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const picked = group ? picks[date] ?? startPicks(group) : [];
  const [minutes, setMinutes] = useState("");
  const [absent, setAbsent] = useState(true);
  if (!group) return <HubModal title="Class" size="sm" onClose={onClose}><p className="text-sm text-slate-600">This class has no students on this day any more.</p></HubModal>;

  const open = group.students.filter(waiting);
  const result = classLogs(group, picked, { date, minutes, absent });
  const title = [group.title, group.label].filter(Boolean).join(" · ");
  const setPicked = (next: string[]) => setPicks((p) => ({ ...p, [date]: next }));
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const dup = (name: string) => group.students.filter((s) => s.student === name).length > 1;
  const canSave = result.logs.length > 0 && !result.missing.length;
  const saveWords = result.given && result.absent ? `Log ${people(result.given)} · ${result.absent} absent` : result.given ? `Log ${people(result.given)}` : result.absent ? `Mark ${result.absent} absent` : "Nothing to log";

  return (
    <HubModal title={title} size="sm" onClose={onClose}
      footer={<div className="flex flex-wrap gap-2"><span data-testid="class-save"><PrimaryButton onClick={() => onSave(result, title)} disabled={!canSave}>{saveWords}</PrimaryButton></span><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
      <div className="grid grid-cols-1 gap-4" data-testid="class-modal">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm text-slate-600">{date === today ? "Today" : friendlyDate(date, today)}. Everyone is ticked. Untick anyone who didn't show up.</p>
          {open.length > 1 && <div className="flex gap-1.5">
            <button type="button" className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setPicked(open.map((s) => s.planId))}>All</button>
            <button type="button" className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setPicked([])}>None</button>
          </div>}
        </div>

        <ul className="space-y-2" aria-label="Students in this class">
          {group.students.map((s) => {
            const on = picked.includes(s.planId);
            const shown = minutes.trim() || (s.minutes ? String(s.minutes) : "");
            if (!waiting(s)) {
              return (
                <li key={s.planId} className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500" data-testid="class-done">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200" aria-hidden>{s.notMet ? <UserX className="h-4 w-4" /> : <Check className="h-4 w-4" />}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.student}{dup(s.student) ? ` · ${s.kind}` : ""}</span>
                  <span className="shrink-0 text-xs font-semibold">{s.notMet ? "Did not meet" : `${s.logged} min logged`}</span>
                </li>
              );
            }
            return (
              <li key={s.planId}>
                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(s.planId)} data-testid="class-student"
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left text-sm transition ${on ? "border-slate-950 bg-white" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white"}`} aria-hidden>{on && <Check className="h-4 w-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${on ? "text-slate-950" : "line-through decoration-slate-300"}`}>{s.student}{dup(s.student) ? ` · ${s.kind}` : ""}</span>
                    <span className="block truncate text-xs text-slate-500">{[s.subject, !s.due ? "not usually today" : ""].filter(Boolean).join(" · ") || s.kind}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${on ? "text-slate-800" : absent && s.due ? "text-red-700" : ""}`}>{on ? (shown ? `${shown} min` : "min?") : absent && s.due ? "Absent" : "Skip"}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <MinutesPick value={minutes} onChange={setMinutes} label={minutes ? "Minutes for everyone ticked" : "Minutes (blank = each student's usual)"} />
        {minutes && <button type="button" onClick={() => setMinutes("")} className="-mt-2 min-h-9 justify-self-start text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">Use each student's usual minutes</button>}

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 px-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-slate-900" checked={absent} onChange={(e) => setAbsent(e.target.checked)} data-testid="class-absent" />
          <span>Mark unticked students “{ABSENT_REASON}”</span>
        </label>
        {result.missing.length > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">{result.missing.join(", ")} {result.missing.length === 1 ? "has" : "have"} no usual minutes for this day. Pick the minutes above.</p>}
        <Labeled label="Date"><Field type="date" value={date} onChange={(e) => setDate(e.target.value || today)} aria-label="Date" /></Labeled>
      </div>
    </HubModal>
  );
}
