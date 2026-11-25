// Arise WorkHub and LifeHub: the sheet that adds a to-do or changes one that is already on the list, and
// checking to-dos off with a way back. Used by Reminders & to-dos and by the To do card on Home.
import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { smartDate, smartLabel } from "@shared/smartDate";
import { CalendarDays, ChevronsUpDown, Clock, Flag, List as ListIcon, Repeat as RepeatIcon, Trash2, Undo2 } from "lucide-react";
import { addDays, friendlyDate } from "@shared/hubDates";
import { recentlyDone, toggleTask, undoTask, type TaskFields } from "@shared/hubTasks";
import type { Task, Workspace } from "@shared/teacherHub";
import { localDay } from "./HubImport";
import type { ToastAction } from "./HubToast";
import { NativeSheet, SheetGroup, SheetRow, SheetSwitch } from "@/components/NativeSheet";
import { clock12 } from "@shared/teacherHub";
import { WEEKDAY_NAMES, repeatDays, weekdayRepeat } from "@shared/hubTasks";
import { LinkEditor, useHubLinks } from "./HubLinks";
import { cleanLinks, type HubLink } from "@shared/hubLinks";
import { TaskFocus } from "./HubTaskFocus";

export function TaskModal({ task, startTitle = "", today, onSave, onClose, onDelete, lists, startList = "", workspace, onOpenLink }: {
  /** The to-do being changed, or null for a new one. */
  task: Task | null;
  startTitle?: string;
  today: string;
  onSave: (fields: TaskFields) => void;
  onClose: () => void;
  /** Shown as Delete when a to-do is being changed. */
  onDelete?: () => void;
  /** The teacher's to-do lists, to pick one. Left out, there is no list picker. */
  lists?: { id: string; name: string; color: string }[];
  /** The list a new to-do starts on (the one being looked at). */
  startList?: string;
  /** The whole Hub, so the to-do can be linked to files, students, goals… (shared/hubLinks.ts). */
  workspace?: Workspace;
  /** Opens a linked thing. */
  onOpenLink?: (l: HubLink) => void;
}) {
  const ctx = useHubLinks();
  workspace = workspace ?? ctx?.workspace;
  const [draft, setDraft] = useState<TaskFields>(() => (task
    ? { title: task.title, dueDate: task.dueDate, dueTime: task.dueTime || "", recurring: task.recurring, priority: task.priority === "high", notes: task.notes || "", links: cleanLinks(task.links), ...(lists ? { listId: task.listId || "" } : {}) }
    : { title: startTitle, dueDate: "", dueTime: "", recurring: "", priority: false, notes: "", links: [], ...(lists ? { listId: startList } : {}) }));
  // Smart dates (shared/smartDate.ts): "call parent tomorrow 3pm" fills in the due date and time as
  // it's typed, unless a date was picked by hand. The words that said it come off the title on save.
  const auto = useRef<{ due: string; time: string } | null>(null);
  const typeTitle = (title: string) => {
    const found = smartDate(title);
    const a = auto.current;
    const handPicked = !!draft.dueDate && !(a && a.due === draft.dueDate && a.time === (draft.dueTime || ""));
    if (found && !handPicked) { auto.current = { due: found.date, time: found.time }; setDraft({ ...draft, title, dueDate: found.date, dueTime: found.time }); }
    else if (!found && a && !handPicked) { auto.current = null; setDraft({ ...draft, title, dueDate: "", dueTime: "" }); }
    else setDraft({ ...draft, title });
  };
  const smart = auto.current && draft.dueDate === auto.current.due ? smartDate(draft.title) : null;
  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.title.trim()) return;
    onSave(smart ? { ...draft, title: smart.title } : draft);
    onClose();
  }
  const chip = (active: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-medium ${active ? "bg-[#6e5ae0] text-white" : "bg-[#f2f2f7] text-slate-800 dark:bg-white/10 dark:text-white"}`;
  const repeatValue = repeatDays(draft.recurring).length ? "Days" : draft.recurring;
  const repeatName = repeatValue === "Days" ? repeatDays(draft.recurring).map((d) => WEEKDAY_NAMES[d]).join(", ") : draft.recurring || "Never";
  const list = lists?.find((l) => l.id === draft.listId);
  // A to-do's details, laid out like the iPhone's Reminders (components/NativeSheet.tsx): Cancel and Done at the
  // top, the title and notes, then grouped rows with switches for the date, time, repeat, list and importance.
  return (
    <NativeSheet title={task ? "Details" : "New To-do"} onClose={onClose} onDone={() => save()} doneLabel={task ? "Done" : "Add"} doneDisabled={!draft.title.trim()} testId="task-sheet" label={task ? "Edit to-do" : "New to-do"}>
      <form onSubmit={save} data-testid="task-form">
        <SheetGroup>
          <div className="px-4 py-3">
            <textarea data-autofocus value={draft.title} onChange={(e) => typeTitle(e.target.value.replace(/\n/g, " "))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} required maxLength={200} rows={1}
              placeholder="Title" aria-label="To-do" data-testid="work-task-title" className="block w-full resize-none bg-transparent text-[17px] font-semibold leading-snug outline-none [field-sizing:content] placeholder:text-slate-400" />
            {smart && <p className="mt-1 text-[13px] font-medium text-[#6e5ae0]" data-testid="work-task-smart">Due {smartLabel(smart)} · from “{smart.matched}”</p>}
          </div>
          <div className="px-4 py-3"><textarea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={1000} rows={2} placeholder="Notes" aria-label="Notes"
            className="block w-full resize-none bg-transparent text-[15px] leading-snug text-slate-700 outline-none [field-sizing:content] placeholder:text-slate-400 dark:text-white/80" /></div>
        </SheetGroup>

        <SheetGroup>
          <SheetRow icon={<CalendarDays />} color="#ff3b30" label="Date" sub={draft.dueDate ? friendlyDate(draft.dueDate, today) : undefined}
            right={<SheetSwitch on={!!draft.dueDate} label="Due date" onChange={(on) => { auto.current = null; setDraft({ ...draft, dueDate: on ? today : "", dueTime: on ? draft.dueTime : "" }); }} testId="task-date-switch" />}>
            {draft.dueDate && <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick due dates">
                {[["Today", today], ["Tomorrow", addDays(today, 1)], ["Next week", addDays(today, 7)]].map(([label, value]) => <button key={label} type="button" className={chip(draft.dueDate === value)} onClick={() => { auto.current = null; setDraft({ ...draft, dueDate: value }); }}>{label}</button>)}
              </div>
              <input type="date" aria-label="Due date" value={draft.dueDate} onChange={(e) => { auto.current = null; setDraft({ ...draft, dueDate: e.target.value, dueTime: e.target.value ? draft.dueTime : "" }); }} className="min-h-10 w-full rounded-[10px] bg-[#f2f2f7] px-3 text-[16px] outline-none dark:bg-white/10" />
            </div>}
          </SheetRow>
          <SheetRow icon={<Clock />} color="#007aff" label="Time" sub={draft.dueTime ? clock12(draft.dueTime) : undefined}
            right={<SheetSwitch on={!!draft.dueTime} disabled={!draft.dueDate} label="Due time (optional)" onChange={(on) => setDraft({ ...draft, dueTime: on ? "09:00" : "" })} testId="task-time-switch" />}>
            {draft.dueTime && <input type="time" aria-label="Due time" value={draft.dueTime} onChange={(e) => setDraft({ ...draft, dueTime: e.target.value })} className="min-h-10 w-full rounded-[10px] bg-[#f2f2f7] px-3 text-[16px] outline-none dark:bg-white/10" />}
          </SheetRow>
          <SheetRow icon={<RepeatIcon />} color="#8e8e93" label="Repeat"
            right={<label className="relative flex min-h-11 max-w-[55%] items-center gap-1 text-[17px] text-slate-500 dark:text-white/60"><span className="truncate">{repeatName}</span><ChevronsUpDown className="h-4 w-4 shrink-0" />
              <select aria-label="Repeats" value={repeatValue} onChange={(e) => setDraft({ ...draft, recurring: e.target.value === "Days" ? weekdayRepeat([1, 2, 3, 4, 5]) : e.target.value })} data-testid="task-repeat" className="absolute inset-0 cursor-pointer opacity-0">
                <option value="">Never</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option value="Days">On certain days…</option>
              </select></label>}>
            {repeatDays(draft.recurring).length > 0 && <div role="group" aria-label="Repeat on these days" className="flex flex-wrap gap-1.5" data-testid="task-repeat-days">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => { const on = repeatDays(draft.recurring).includes(d); return <button key={d} type="button" aria-pressed={on}
                onClick={() => { const cur = repeatDays(draft.recurring); const next = on ? cur.filter((x) => x !== d) : [...cur, d]; setDraft({ ...draft, recurring: weekdayRepeat(next.length ? next : cur) }); }}
                className={`h-9 w-11 rounded-full text-[14px] font-semibold ${on ? "bg-[#6e5ae0] text-white" : "bg-[#f2f2f7] text-slate-700 dark:bg-white/10 dark:text-white"}`}>{WEEKDAY_NAMES[d]}</button>; })}
            </div>}
          </SheetRow>
        </SheetGroup>

        <SheetGroup>
          {lists && lists.length > 0 && <SheetRow icon={<ListIcon />} color={list?.color || "#5856d6"} label="List"
            right={<label className="relative flex min-h-11 max-w-[55%] items-center gap-1 text-[17px] text-slate-500 dark:text-white/60"><span className="truncate">{list?.name || "None"}</span><ChevronsUpDown className="h-4 w-4 shrink-0" />
              <select aria-label="List" value={draft.listId || ""} onChange={(e) => setDraft({ ...draft, listId: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" data-testid="task-list">
                <option value="">None</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select></label>} />}
          <div data-testid="task-important-label"><SheetRow icon={<Flag />} color="#ff9500" label={<span className="text-slate-900 dark:text-white">Mark as important</span>}
            right={<SheetSwitch on={draft.priority} label="Mark as important" onChange={(on) => setDraft({ ...draft, priority: on })} />} /></div>
        </SheetGroup>

        {workspace && <SheetGroup caption="Linked"><div className="p-3"><LinkEditor workspace={workspace} links={draft.links || []} onChange={(links) => setDraft({ ...draft, links })} text={`${draft.title} ${draft.notes || ""}`} self={task ? { kind: "task", id: task.id } : undefined} onOpen={onOpenLink} /></div></SheetGroup>}
        {task && <TaskFocus task={task} />}
        {task && onDelete && <SheetGroup><button type="button" onClick={() => { onDelete(); onClose(); }} className="flex min-h-[44px] w-full items-center justify-center gap-2 text-[17px] text-[#ff3b30] active:bg-black/5" data-testid="task-delete"><Trash2 className="h-4 w-4" /> Delete To-do</button></SheetGroup>}
        <button type="submit" hidden />
      </form>
    </NativeSheet>
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
