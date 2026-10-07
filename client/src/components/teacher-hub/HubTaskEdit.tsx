// Teacher Hub: the pop-up that adds a to-do or changes one that is already on the list.
// Used by Reminders & to-dos and by the To do card on Home.
import { useState, type FormEvent } from "react";
import { addDays } from "@shared/hubDates";
import type { TaskFields } from "@shared/hubTasks";
import type { Task } from "@shared/teacherHub";
import { Field, GhostButton, Labeled, PrimaryButton, Select } from "./ui";
import { HubModal } from "./HubModal";

export function TaskModal({ task, startTitle = "", today, onSave, onClose }: {
  /** The to-do being changed, or null for a new one. */
  task: Task | null;
  startTitle?: string;
  today: string;
  onSave: (fields: TaskFields) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskFields>(() => (task
    ? { title: task.title, dueDate: task.dueDate, recurring: task.recurring, priority: task.priority === "high" }
    : { title: startTitle, dueDate: "", recurring: "", priority: false }));
  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.title.trim()) return;
    onSave(draft);
    onClose();
  }
  const chip = (active: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  return (
    <HubModal title={task ? "Edit to-do" : "New to-do"} onClose={onClose} size="sm"
      footer={<div className="flex gap-2"><PrimaryButton onClick={() => save()} disabled={!draft.title.trim()}>{task ? "Save changes" : "Save"}</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
      <form onSubmit={save} className="grid gap-3" data-testid="task-form">
        <Labeled label="To-do"><Field data-autofocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={200} /></Labeled>
        <Labeled label="Due"><Field type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></Labeled>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick due dates">
          {[["Today", today], ["Tomorrow", addDays(today, 1)], ["Next week", addDays(today, 7)]].map(([label, value]) => <button key={label} type="button" className={chip(draft.dueDate === value)} onClick={() => setDraft({ ...draft, dueDate: value })}>{label}</button>)}
          {draft.dueDate && <button type="button" className={chip(false)} onClick={() => setDraft({ ...draft, dueDate: "" })}>No date</button>}
        </div>
        <Labeled label="Repeats"><Select value={draft.recurring} onChange={(e) => setDraft({ ...draft, recurring: e.target.value })}><option value="">One-time</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option></Select></Labeled>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.checked })} /> Mark as important</label>
        <button type="submit" hidden />
      </form>
    </HubModal>
  );
}
