// Arise WorkHub: the pop-up that adds a to-do or changes one that is already on the list, and
// checking to-dos off with a way back. Used by Reminders & to-dos and by the To do card on Home.
import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Trash2, Undo2 } from "lucide-react";
import { addDays, friendlyDate } from "@shared/hubDates";
import { recentlyDone, toggleTask, undoTask, type TaskFields } from "@shared/hubTasks";
import type { Task, Workspace } from "@shared/teacherHub";
import { localDay } from "./HubImport";
import type { ToastAction } from "./HubToast";
import { Field, GhostButton, Labeled, PrimaryButton, Select, TextArea } from "./ui";
import { HubModal } from "./HubModal";

export function TaskModal({ task, startTitle = "", today, onSave, onClose, onDelete }: {
  /** The to-do being changed, or null for a new one. */
  task: Task | null;
  startTitle?: string;
  today: string;
  onSave: (fields: TaskFields) => void;
  onClose: () => void;
  /** Shown as Delete when a to-do is being changed. */
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<TaskFields>(() => (task
    ? { title: task.title, dueDate: task.dueDate, recurring: task.recurring, priority: task.priority === "high", notes: task.notes || "" }
    : { title: startTitle, dueDate: "", recurring: "", priority: false, notes: "" }));
  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.title.trim()) return;
    onSave(draft);
    onClose();
  }
  const chip = (active: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  return (
    <HubModal title={task ? "Edit to-do" : "New to-do"} onClose={onClose} size="sm"
      footer={<div className="flex flex-wrap items-center gap-2"><PrimaryButton onClick={() => save()} disabled={!draft.title.trim()}>{task ? "Save changes" : "Save"}</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton>
        {task && onDelete && <button type="button" onClick={() => { onDelete(); onClose(); }} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50" data-testid="task-delete"><Trash2 className="h-4 w-4" /> Delete</button>}</div>}>
      <form onSubmit={save} className="grid gap-3" data-testid="task-form">
        <Labeled label="To-do"><Field data-autofocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={200} /></Labeled>
        <Labeled label="Due"><Field type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></Labeled>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick due dates">
          {[["Today", today], ["Tomorrow", addDays(today, 1)], ["Next week", addDays(today, 7)]].map(([label, value]) => <button key={label} type="button" className={chip(draft.dueDate === value)} onClick={() => setDraft({ ...draft, dueDate: value })}>{label}</button>)}
          {draft.dueDate && <button type="button" className={chip(false)} onClick={() => setDraft({ ...draft, dueDate: "" })}>No date</button>}
        </div>
        <Labeled label="Repeats"><Select value={draft.recurring} onChange={(e) => setDraft({ ...draft, recurring: e.target.value })}><option value="">One-time</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option></Select></Labeled>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.checked })} /> Mark as important</label>
        <Labeled label="Notes"><TextArea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={1000} placeholder="Details, a phone number, a link (optional)" /></Labeled>
        <button type="submit" hidden />
      </form>
    </HubModal>
  );
}

/**
 * Checks a to-do off or back on. Checking one off shows a message with Undo for about ten seconds;
 * after that it can still be undone for a day from "Done in the last day".
 */
export function taskChecker(tasksNow: () => Task[], setWorkspace: Dispatch<SetStateAction<Workspace>>, toast: (text: string, actions?: ToastAction[]) => void) {
  return (task: Task) => {
    const today = localDay(), at = new Date().toISOString();
    const result = toggleTask(tasksNow(), task.id, today, at);
    setWorkspace((p) => ({ ...p, tasks: toggleTask(p.tasks, task.id, today, at).tasks }));
    if (task.done) return;
    const undo: ToastAction[] = [{ label: "Undo", run: () => setWorkspace((p) => ({ ...p, tasks: undoTask(p.tasks, task.id, Date.now()) })) }];
    toast(result.rolledTo ? `Done. Next one is due ${friendlyDate(result.rolledTo, today)}.` : `Checked off "${task.title}".`, undo);
  };
}

/** To-dos checked off in the last day, crossed out, each with Undo. Shown under the open to-dos. */
export function RecentlyDone({ tasks, onUndo, limit }: { tasks: Task[]; onUndo: (taskId: string) => void; limit?: number }) {
  const all = recentlyDone(tasks, Date.now());
  const [more, setMore] = useState(false);
  if (!all.length) return null;
  const shown = limit && !more ? all.slice(0, limit) : all;
  return (
    <section className="mt-4" aria-label="Done in the last day" data-testid="recently-done">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Done in the last day</h3>
      <ul className="space-y-2">
        {shown.map((task) => (
          <li key={task.id} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 py-1 pl-3 pr-1">
            <div className="min-w-0 flex-1 py-1.5">
              <div className="break-words text-slate-400 line-through">{task.title}</div>
              {!task.done && task.rolled && <div className="text-xs text-slate-500">Repeats. Next one is due {friendlyDate(task.dueDate, localDay())}.</div>}
            </div>
            <button type="button" aria-label={`Undo: ${task.title}`} onClick={() => onUndo(task.id)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50" data-testid="task-undo"><Undo2 className="h-4 w-4" />Undo</button>
          </li>
        ))}
      </ul>
      {limit !== undefined && all.length > limit && <button type="button" onClick={() => setMore((v) => !v)} className="mt-1 min-h-10 text-xs font-semibold text-slate-600 underline underline-offset-4">{more ? "Show fewer" : `Show all ${all.length}`}</button>}
    </section>
  );
}
