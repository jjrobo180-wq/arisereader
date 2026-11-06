// WorkHub's Tasks screen: views and coloured lists down the side, numbers across the top, progress and what's
// next beside the list. LifeHub uses this same screen (pages/AriseTodo.tsx) over its own to-dos (shared/hubSwap.ts).
import { openHubEmail } from "@/components/teacher-hub/HubInbox";
import { useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { Archive, ArchiveRestore, ListTodo, FolderPlus, Circle, Search, CalendarDays, CheckCircle2, Check, Clock3, Link2, Mail, Pencil, Plus, Save, Sparkles, Trash2, Flag, Sun, Repeat, X, MoreHorizontal } from "lucide-react";
import { dueState, friendlyDate, type DueState } from "@shared/hubDates";
import { TASK_LIST_COLORS, TASK_SORTS, TASK_VIEWS, archiveTask, cleanTaskLists, clearDone, removeTaskList, restoreTasks, saveTask, taskCounts, undoTask, viewCounts, viewTasks, type TaskSort, type TaskView } from "@shared/hubTasks";
import { resolveLink, type HubLink } from "@shared/hubLinks";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { clock12, type Task, type Workspace } from "@shared/teacherHub";
import { type ToastAction } from "@/components/teacher-hub/HubToast";
import { Field, PrimaryButton, Select } from "@/components/teacher-hub/ui";
import { RecentlyDone, TaskModal, taskChecker } from "@/components/teacher-hub/HubTaskEdit";
import { PinButton } from "@/components/teacher-hub/HubPins";

/** "Julian Sikora + 2 more" for a to-do's links (the things still there). */
function linkSummary(workspace: Workspace, links: HubLink[]): string {
  const names = links.map((l) => resolveLink(workspace, l)?.label).filter(Boolean) as string[];
  if (!names.length) return "Linked";
  return names.length > 1 ? `${names[0].slice(0, 28)} + ${names.length - 1} more` : names[0].slice(0, 40);
}

const TODAY = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
type SectionProps = {
  workspace: Workspace;
  setWorkspace: Dispatch<SetStateAction<Workspace>>;
  remove: <K extends keyof Workspace>(key: K, rowId: string) => void;
};

export function TaskRow({ plain = false, task, today, workspace, setWorkspace, makeId, onToggle, onEdit, onDelete, list, onArchive }: { plain?: boolean; task: Task; today: string; workspace: Workspace; setWorkspace: SectionProps["setWorkspace"]; makeId: () => string; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; list?: { name: string; color: string }; onArchive?: (task: Task, archived: boolean) => void }) {
  const email = task.emailId ? workspace.emails.find((e) => e.id === task.emailId) : undefined;
  return (
    <li className="group flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1 rounded-2xl border border-[#ececf3] bg-white p-3 transition hover:border-violet-200 hover:bg-[#fcfbff] sm:gap-y-2 sm:p-4" data-testid="task-row">
      <label className={`relative mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 transition ${task.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-violet-500"}`}>
        <input type="checkbox" className="absolute inset-0 cursor-pointer opacity-0" aria-label={`Done: ${task.title}`} checked={task.done} onChange={() => onToggle(task)} />
        <Check className="h-[15px] w-[15px]" />
      </label>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} data-testid="task-edit">
        <div className={task.done ? "text-sm font-bold text-slate-400 line-through [overflow-wrap:anywhere] sm:text-base" : "text-sm font-bold text-slate-800 [overflow-wrap:anywhere] sm:text-base"}>{email?.unread && !task.done && <NewChip />}{task.priority === "high" && <Flag className="mr-1 inline h-4 w-4 text-red-500" aria-label="Important" />}{task.title}</div>
        {email?.message && !task.done ? (
          <>
            <p className="mt-0.5 text-xs font-medium text-slate-600 [overflow-wrap:anywhere]" data-testid="task-email-from">{[email.from && `From ${email.from}`, email.sent && `Sent ${email.sent}`].filter(Boolean).join(" · ")}</p>
            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500 [overflow-wrap:anywhere] sm:line-clamp-3" data-testid="task-email-message">{email.message.replace(/<https?:\/\/[^\s<>]+>/g, "").replace(/\n{2,}/g, "\n").trim()}</p>
          </>
        ) : task.notes && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500 [overflow-wrap:anywhere]" data-testid="task-notes">{task.notes}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          {list && <span className="rounded-lg bg-slate-50 px-2 py-1 text-slate-500"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: list.color }} />{list.name}</span>}
          {task.priority === "high" && !task.done && <span className="rounded-lg bg-orange-50 px-2 py-1 text-orange-600">High priority</span>}
          {!task.done && <DueChip date={task.dueDate} time={task.dueTime} today={today} />}
          {task.done && task.dueDate && <span>Was due {friendlyDate(task.dueDate, today)}{task.dueTime ? ` · ${clock12(task.dueTime)}` : ""}</span>}
          {!task.dueDate && !task.done && <span>No due date</span>}
          {task.recurring && <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />{task.recurring}</span>}
          {task.emailId && <span className="inline-flex items-center gap-1" data-testid="task-from-email"><Mail className="h-3.5 w-3.5" />From an email</span>}
          {(task.links?.length ?? 0) > 0 && <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1 text-teal-800" data-testid="task-links"><Link2 className="h-3.5 w-3.5" />{linkSummary(workspace, task.links!)}</span>}
          {task.lastDone && <span>Last done {friendlyDate(task.lastDone, today)}</span>}
          <span className="inline-flex items-center gap-1 font-medium text-teal-700"><Pencil className="h-3.5 w-3.5" />Edit</span>
        </div>
      </button>
      {/* On a phone these sit on their own line under the to-do, so the words get the full width. */}
      <div className={email ? "flex basis-full items-center gap-3 pl-9 sm:contents" : "contents"}>
        {email && (
          <div className="min-w-0 sm:order-last sm:basis-full sm:pl-9">
            <button type="button" onClick={() => openHubEmail(email.id)} aria-label={`Open the email: ${email.subject || task.title}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-100" data-testid="task-open-email"><Mail className="h-4 w-4" />Open the email</button>
          </div>
        )}
        <span className="ml-auto sm:hidden" aria-hidden="true" />
        {!plain && <PinButton workspace={workspace} setWorkspace={setWorkspace} kind="task" refId={task.id} title={task.title} makeId={makeId} />}
        {onArchive && <button type="button" aria-label={task.archived ? `Restore ${task.title} from archive` : `Archive ${task.title}`} title={task.archived ? "Restore" : "Archive"} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-violet-50 hover:text-violet-700" onClick={() => onArchive(task, !task.archived)}>{task.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button>}
        <button type="button" aria-label={`Delete ${task.title}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(task)}><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  );
}

/** Marks a forwarded email that hasn't been opened yet. */
export function NewChip() {
  return <span className="mr-1.5 inline-flex items-center rounded-full bg-teal-600 px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-white" data-testid="email-new">New</span>;
}

const DUE_STYLE: Record<DueState, string> = { none: "bg-slate-100 text-slate-500", overdue: "bg-red-100 text-red-700", today: "bg-amber-100 text-amber-800", soon: "bg-sky-100 text-sky-800", later: "bg-slate-100 text-slate-600" };

function DueChip({ date, time, today }: { date: string; time?: string; today: string }) {
  if (!date) return null;
  const state = dueState(date, today);
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${DUE_STYLE[state]}`}>{state === "overdue" ? "Overdue · " : ""}{friendlyDate(date, today)}{time ? ` · ${clock12(time)}` : ""}</span>;
}

export function Tasks({ workspace, setWorkspace, remove, makeId, toast, controls, plain = false }: SectionProps & {
  makeId: () => string; toast: (text: string, actions?: ToastAction[]) => void;
  /** LifeHub keeps the view and list itself (Home and the calendar jump here), so it passes them in. */
  controls?: { view: TaskView; setView: (v: TaskView) => void; list: string; setList: (id: string) => void };
  /** LifeHub's to-dos have no emails or pins, so those are left out. */
  plain?: boolean;
}) {
  // Laid out like LifeHub's to-do lists: views (All, Today, Upcoming, Completed, Archived) and the
  // teacher's own coloured lists down the side, numbers across the top, progress and what's next
  // beside the list. The view, the list and the sort picked are remembered until changed.
  const today = TODAY();
  const lists = cleanTaskLists(workspace.taskLists);
  const [savedView, setSavedView] = useSavedChoice<TaskView>("hub-tasks-view", "all", TASK_VIEWS);
  const [savedList, setSavedList] = useSavedChoice<string>("hub-tasks-list", "all");
  const view = controls ? controls.view : savedView;
  const setView = controls ? controls.setView : setSavedView;
  const listPick = controls ? controls.list : savedList;
  const setListPick = controls ? controls.setList : setSavedList;
  const listId = listPick === "all" || lists.some((l) => l.id === listPick) ? listPick : "all";
  const [sort, setSort] = useSavedChoice<TaskSort>("hub-tasks-sort", "due", TASK_SORTS.map((o) => o.id));
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState("");
  const [addingList, setAddingList] = useState(false);
  const [newList, setNewList] = useState("");
  /** The to-do open in the pop-up: `id: null` is a new one. */
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const counts = taskCounts(workspace.tasks, today);
  const views = viewCounts(workspace.tasks, listId, today);
  const shown = useMemo(() => viewTasks(workspace.tasks, view, listId, sort, today, search), [workspace.tasks, view, listId, sort, today, search]);
  const kept = workspace.tasks.filter((t) => !t.archived);
  const done = kept.filter((t) => t.done).length;
  const upcoming = kept.filter((t) => !t.done && t.dueDate && t.dueDate > today).sort((a, b) => `${a.dueDate}${a.dueTime || ""}`.localeCompare(`${b.dueDate}${b.dueTime || ""}`));
  const listName = listId === "all" ? "Everything" : lists.find((l) => l.id === listId)?.name || "Everything";
  const VIEW_INFO: Record<TaskView, { title: string; icon: ReactNode }> = {
    all: { title: "All tasks", icon: <ListTodo className="h-4 w-4" /> },
    today: { title: "Today", icon: <Sun className="h-4 w-4" /> },
    upcoming: { title: "Upcoming", icon: <CalendarDays className="h-4 w-4" /> },
    completed: { title: "Completed", icon: <CheckCircle2 className="h-4 w-4" /> },
    archived: { title: "Archived", icon: <Archive className="h-4 w-4" /> },
  };

  function quickAdd(e: FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setWorkspace((p) => ({ ...p, tasks: [...p.tasks, { id: makeId(), title, dueDate: view === "today" ? today : "", recurring: "", done: false, ...(listId !== "all" ? { listId } : {}) }] }));
    setQuick("");
  }
  function addList(e: FormEvent) {
    e.preventDefault();
    const name = newList.trim().slice(0, 60);
    if (!name) return;
    const list = { id: makeId(), name, color: TASK_LIST_COLORS[lists.length % TASK_LIST_COLORS.length] };
    setWorkspace((p) => ({ ...p, taskLists: [...cleanTaskLists(p.taskLists), list] }));
    setListPick(list.id);
    setNewList(""); setAddingList(false);
  }
  function deleteList(listToGo: { id: string; name: string }) {
    if (!confirm(`Delete the list "${listToGo.name}"? Its to-dos stay, on no list.`)) return;
    setWorkspace((p) => removeTaskList(p, listToGo.id));
    setListPick("all");
  }
  const archive = (task: Task, on: boolean) => {
    setWorkspace((p) => ({ ...p, tasks: archiveTask(p.tasks, task.id, on) }));
    toast(on ? `Archived "${task.title}".` : `Brought back "${task.title}".`, [{ label: "Undo", run: () => setWorkspace((p) => ({ ...p, tasks: archiveTask(p.tasks, task.id, !on) })) }]);
  };
  const toggle = taskChecker(() => workspace.tasks, setWorkspace, toast);
  /** Takes every finished to-do off the list, with Undo. */
  function clearFinished() {
    const { cleared } = clearDone(workspace.tasks);
    if (!cleared.length) return;
    setWorkspace((p) => ({ ...p, tasks: clearDone(p.tasks).tasks }));
    toast(`Cleared ${cleared.length} finished ${cleared.length === 1 ? "to-do" : "to-dos"}.`, [{ label: "Undo", run: () => setWorkspace((p) => ({ ...p, tasks: restoreTasks(p.tasks, cleared) })) }]);
  }
  const navBtn = (active: boolean) => `flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] font-bold transition sm:min-h-11 sm:px-4 sm:text-sm lg:w-full ${active ? "bg-[#eeeafe] text-[#5f4dc8]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[13.5rem_minmax(0,1fr)]" data-testid="hub-todo">
      {/* Views and lists: a column on a computer, two scrolling rows on a phone. */}
      <nav aria-label="To-do views and lists" className="min-w-0 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-2 lg:self-start lg:p-3">
        <p className="hidden px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[.16em] text-slate-500 lg:block">Tasks</p>
        {/* Phone: the five views as one even row of tiles. Computer: a column. */}
        <div className="grid grid-cols-5 gap-1 lg:hidden" data-testid="task-views-phone">
          {TASK_VIEWS.map((v) => <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} data-testid={`task-view-${v}`}
            className={`flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-2 transition ${view === v ? "bg-[#6e5ae0] text-white shadow-[0_6px_16px_#6e5ae040]" : "text-slate-500 active:bg-slate-50"}`}>
            <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{VIEW_INFO[v].icon}</span>
            <span className={`text-[17px] font-black leading-none tabular-nums ${view === v ? "text-white" : "text-slate-800"}`}>{views[v]}</span>
            <span className="w-full truncate text-center text-[10.5px] font-bold">{v === "all" ? "All" : v === "completed" ? "Done" : VIEW_INFO[v].title}</span>
          </button>)}
        </div>
        <div className="hidden lg:block lg:space-y-1">
          {TASK_VIEWS.map((v) => <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={navBtn(view === v)}>{VIEW_INFO[v].icon}<span>{VIEW_INFO[v].title}</span><span className="ml-auto rounded-lg px-1.5 text-xs font-semibold opacity-65">{views[v]}</span></button>)}
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-slate-100 px-2 pb-1.5 pt-3 lg:mt-2 lg:border-0 lg:px-3 lg:pt-5"><span className="text-[11px] font-black uppercase tracking-[.16em] text-slate-400">My lists</span><button type="button" onClick={() => setAddingList(true)} className="hidden lg:inline-flex rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700" title="New list" aria-label="New list"><FolderPlus className="h-[18px] w-[18px]" /></button></div>
        <div className="-mx-2 flex gap-1.5 overflow-x-auto px-2 py-1 [scrollbar-width:none] lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0 lg:py-0">
          <button type="button" onClick={() => setListPick("all")} className={`flex min-h-9 shrink-0 items-center gap-3 rounded-full px-3.5 text-[13px] font-bold ring-1 lg:min-h-10 lg:w-full lg:rounded-xl lg:px-4 lg:text-sm lg:ring-0 ${listId === "all" ? "bg-[#f4f2ff] text-[#6c5cce] ring-[#d9d2fb]" : "text-slate-600 ring-slate-200 hover:bg-slate-50"}`}><Circle className="hidden h-3 w-3 lg:block" />Everything</button>
          {lists.map((l) => <button key={l.id} type="button" onClick={() => setListPick(l.id)} className={`flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-bold ring-1 lg:min-h-10 lg:w-full lg:rounded-xl lg:px-4 lg:text-sm lg:ring-0 ${listId === l.id ? "bg-[#f4f2ff] text-[#6c5cce] ring-[#d9d2fb]" : "text-slate-600 ring-slate-200 hover:bg-slate-50"}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} /><span className="max-w-32 truncate">{l.name}</span><span className="ml-auto hidden text-xs opacity-60 lg:inline">{kept.filter((t) => !t.done && t.listId === l.id).length}</span></button>)}
          {!addingList && <button type="button" onClick={() => setAddingList(true)} className="flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-slate-50 px-3.5 text-[13px] font-bold text-violet-700 ring-1 ring-slate-200 lg:hidden"><Plus className="h-3.5 w-3.5" /> New list</button>}
        </div>
        {addingList && <form onSubmit={addList} className="mt-2 flex gap-2 px-1"><input className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm" value={newList} autoFocus maxLength={60} onChange={(e) => setNewList(e.target.value)} placeholder="List name (IEP paperwork, Copies…)" aria-label="New list name" /><button type="submit" className="rounded-xl bg-[#705ee2] px-3 text-white" aria-label="Save list"><Check className="h-[18px] w-[18px]" /></button><button type="button" onClick={() => { setAddingList(false); setNewList(""); }} className="rounded-xl bg-slate-100 px-2 text-slate-500" aria-label="Cancel list"><X className="h-[18px] w-[18px]" /></button></form>}
      </nav>

      <div className="min-w-0">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="task-alerts">
          {[
            { label: "Open tasks", count: counts.open, icon: <ListTodo className="h-[17px] w-[17px]" />, tint: "text-violet-600 bg-violet-50", go: "all" as TaskView },
            { label: "Due today", count: counts.today, icon: <Sun className="h-[17px] w-[17px]" />, tint: "text-amber-600 bg-amber-50", go: "today" as TaskView },
            { label: "Overdue", count: counts.overdue, icon: <Clock3 className="h-[17px] w-[17px]" />, tint: "text-rose-600 bg-rose-50", go: "today" as TaskView },
            { label: "Completed", count: done, icon: <CheckCircle2 className="h-[17px] w-[17px]" />, tint: "text-emerald-600 bg-emerald-50", go: "completed" as TaskView },
          ].map((s) => <button key={s.label} type="button" onClick={() => setView(s.go)} className="rounded-2xl border border-[#e7e8ef] bg-white p-4 text-left shadow-[0_3px_16px_#17152b08] transition hover:border-violet-200 sm:p-5"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{s.label}</span><span className={`rounded-xl p-2 ${s.tint}`}>{s.icon}</span></div><p className="text-3xl font-black text-[#242238]">{s.count}</p></button>)}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          <section className="min-w-0 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600">{listName}</p><h2 className="mt-1 text-xl font-black text-slate-900">{VIEW_INFO[view].title}</h2></div>
              <button type="button" onClick={() => setEditing({ id: null })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6e5ae0] px-4 text-sm font-bold text-white hover:bg-[#5948c8]"><Plus className="h-[17px] w-[17px]" /> Add task</button>
            </div>
            {view !== "completed" && view !== "archived" && (
              <form onSubmit={quickAdd} className="mt-5 flex gap-2">
                <Field placeholder={`Add a to-do${listId !== "all" ? ` to ${listName}` : ""} and press Enter`} aria-label="Quick add a to-do" value={quick} onChange={(e) => setQuick(e.target.value)} />
<button type="button" onClick={() => setEditing({ id: null })} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label="More options: due date, time, notes, repeat" title="Add a due date, time, notes or repeat" data-testid="tasks-quick-more"><MoreHorizontal className="h-4 w-4" /> More</button>
                <PrimaryButton type="submit" disabled={!quick.trim()}>Add</PrimaryButton>
              </form>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Field type="search" placeholder="Search tasks and notes" aria-label="Search to-dos" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
              <Select aria-label="Sort to-dos" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)}>{TASK_SORTS.map((o) => <option key={o.id} value={o.id}>Sort: {o.label}</option>)}</Select>
            </div>
            {shown.length ? <ul className="mt-5 space-y-2">{shown.map((task) => (
              <TaskRow key={task.id} plain={plain} task={task} today={today} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} onToggle={toggle} onEdit={(t) => setEditing({ id: t.id })} onDelete={(t) => remove("tasks", t.id)} list={lists.find((l) => l.id === task.listId)} onArchive={archive} />
            ))}</ul> : (
              <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center">
                <span className="rounded-2xl bg-violet-50 p-4 text-violet-600">{view === "archived" ? <Archive className="h-[26px] w-[26px]" /> : <Sparkles className="h-[26px] w-[26px]" />}</span>
                <p className="mt-4 text-lg font-extrabold text-slate-900">{search ? "No matching tasks" : view === "completed" ? "Nothing completed yet" : view === "archived" ? "Nothing archived" : "A fresh start"}</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{search ? "Try another search." : view === "today" ? "No tasks due today or overdue. Enjoy the breathing room." : view === "upcoming" ? "Nothing scheduled ahead yet." : view === "completed" ? "Finished tasks will appear here." : view === "archived" ? "Tasks you archive are tucked away here, and can always be brought back." : "Add your first task and start planning your day."}</p>
              </div>
            )}
            {view === "completed" && counts.done > 0 && !search.trim() && (
              <div className="mt-3 text-center"><button type="button" onClick={clearFinished} className="min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4" data-testid="clear-done">Clear all {counts.done} finished</button></div>
            )}
            {(view === "all" || view === "today") && !search.trim() && <RecentlyDone tasks={workspace.tasks} onUndo={(taskId) => setWorkspace((p) => ({ ...p, tasks: undoTask(p.tasks, taskId, Date.now()) }))} />}
            {listId !== "all" && <button type="button" onClick={() => { const l = lists.find((x) => x.id === listId); if (l) deleteList(l); }} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-rose-500 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete this list</button>}
          </section>

          <aside className="space-y-5">
            <section className="rounded-[1.5rem] bg-[#292446] p-5 text-white shadow-[0_12px_24px_#2924461f]">
              <div className="flex items-center gap-2 text-[#bcb2ff]"><Sparkles className="h-[17px] w-[17px]" /><span className="text-[11px] font-extrabold uppercase tracking-[.14em]">Your progress</span></div>
              <p className="mt-5 text-3xl font-black">{kept.length ? Math.round((done / kept.length) * 100) : 0}%</p>
              <p className="mt-1 text-xs text-slate-300">of all tasks completed</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#a38cfa] transition-all" style={{ width: `${kept.length ? (done / kept.length) * 100 : 0}%` }} /></div>
              <p className="mt-4 text-xs font-medium leading-5 text-slate-300">Every little step counts. Keep going at your own pace.</p>
            </section>
            <section className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5">
              <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-slate-900">Coming up next</h3><CalendarDays className="h-[17px] w-[17px] text-violet-500" /></div>
              {upcoming.length ? <div className="mt-4 space-y-3">{upcoming.slice(0, 5).map((task) => <button key={task.id} type="button" onClick={() => setEditing({ id: task.id })} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 pb-3 text-left last:border-b-0 last:pb-0"><span className="min-w-0 truncate text-xs font-semibold text-slate-700">{task.title}</span><span className="shrink-0 text-[11px] font-bold text-violet-600">{friendlyDate(task.dueDate, today)}</span></button>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">Your calendar is clear for now.</p>}
            </section>
          </aside>
        </div>
      </div>
      {editing && <TaskModal task={editing.id ? workspace.tasks.find((t) => t.id === editing.id) || null : null} startTitle={quick} today={today} lists={lists} startList={listId === "all" ? "" : listId}
        onSave={(fields) => { setWorkspace((p) => ({ ...p, tasks: saveTask(p.tasks, editing.id, fields, makeId) })); if (!editing.id) setQuick(""); }} onClose={() => setEditing(null)} onDelete={editing.id ? () => remove("tasks", editing.id!) : undefined} />}
    </div>
  );
}
