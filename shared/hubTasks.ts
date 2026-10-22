// Arise WorkHub: sorting, filtering and repeating to-dos.
import { cleanLinks, type HubLink } from "./hubLinks";
import { addDays, addMonths, dueState } from "./hubDates";
import type { Task } from "./teacherHub";

export type TaskFilter = "open" | "done" | "all";
export type TaskSort = "due" | "priority" | "newest" | "name";

export const TASK_SORTS: { id: TaskSort; label: string }[] = [
  { id: "due", label: "Due date" },
  { id: "priority", label: "Most important" },
  { id: "newest", label: "Newest first" },
  { id: "name", label: "A to Z" },
];

/** Tasks to show: filtered, then sorted. Done tasks always sink to the bottom of "All". Ties keep the saved order (newest last in the list). */
export function arrangeTasks(tasks: Task[], filter: TaskFilter, sort: TaskSort, search = "", withArchived = false): Task[] {
  const q = search.trim().toLowerCase();
  // An archived to-do is tucked away everywhere but the Archived view.
  const indexed = tasks.map((task, index) => ({ task, index }))
    .filter(({ task }) => (withArchived || !task.archived) && (filter === "all" || (filter === "done") === !!task.done) && (!q || task.title.toLowerCase().includes(q)));
  const due = (t: Task) => (t.dueDate ? `${t.dueDate}T${t.dueTime || "23:59"}` : "9999-99-99T99:99");
  const high = (t: Task) => (t.priority === "high" ? 0 : 1);
  indexed.sort((a, b) => {
    if (!!a.task.done !== !!b.task.done) return a.task.done ? 1 : -1;
    let c = 0;
    if (sort === "due") c = due(a.task).localeCompare(due(b.task)) || high(a.task) - high(b.task);
    else if (sort === "priority") c = high(a.task) - high(b.task) || due(a.task).localeCompare(due(b.task));
    else if (sort === "newest") c = b.index - a.index;
    else c = a.task.title.localeCompare(b.task.title, undefined, { sensitivity: "base" });
    return c || a.index - b.index;
  });
  return indexed.map((x) => x.task);
}

export function taskCounts(tasks: Task[], today: string) {
  const kept = tasks.filter((t) => !t.archived);
  const open = kept.filter((t) => !t.done);
  return { open: open.length, done: kept.length - open.length, overdue: open.filter((t) => dueState(t.dueDate, today) === "overdue").length, today: open.filter((t) => dueState(t.dueDate, today) === "today").length };
}

/** The next due date for a repeating task: stays on its rhythm and lands after `today`. "" when it doesn't repeat. */
export function nextDue(dueDate: string, recurring: string, today: string): string {
  const step = { Daily: (d: string, n: number) => addDays(d, n), Weekly: (d: string, n: number) => addDays(d, 7 * n), Monthly: (d: string, n: number) => addMonths(d, n), Quarterly: (d: string, n: number) => addMonths(d, 3 * n) }[recurring as "Daily"];
  if (!step) return "";
  const base = dueDate || today;
  for (let n = 1; n <= 800; n++) {
    const next = step(base, n);
    if (next > today) return next;
  }
  return "";
}

export type TaskToggle = { tasks: Task[]; rolledTo: string | null };

/** How long a checked-off to-do is kept in view with an Undo: a day. */
export const UNDO_TASK_MS = 24 * 60 * 60 * 1000;

/**
 * Checks a task off. A repeating task isn't finished: its due date moves to the next time and it stays open.
 * `at` is the moment it happened (an ISO time); with it, the to-do can be offered back for a day.
 */
export function toggleTask(tasks: Task[], id: string, today: string, at?: string): TaskToggle {
  let rolledTo: string | null = null;
  const next = tasks.map((t) => {
    if (t.id !== id) return t;
    if (!t.done && t.recurring) {
      const due = nextDue(t.dueDate, t.recurring, today);
      if (due) {
        rolledTo = due;
        const { rolled: _was, ...rest } = t;
        return { ...rest, dueDate: due, lastDone: today, ...(at ? { rolled: { dueDate: t.dueDate, ...(t.lastDone ? { lastDone: t.lastDone } : {}), at } } : {}) };
      }
    }
    const { doneAt: _when, ...rest } = t;
    return t.done ? { ...rest, done: false } : { ...rest, done: true, ...(at ? { doneAt: at } : {}) };
  });
  return { tasks: next, rolledTo };
}

const within = (at: string | undefined, nowMs: number) => { const t = Date.parse(at || ""); return Number.isFinite(t) && nowMs - t < UNDO_TASK_MS && t <= nowMs + 60_000; };

/** Checked off in the last day (or, for a repeating to-do, moved on to its next time in the last day). Newest first. */
export function recentlyDone(tasks: Task[], nowMs: number): Task[] {
  const when = (t: Task) => Date.parse((t.done ? t.doneAt : t.rolled?.at) || "") || 0;
  return tasks.filter((t) => (t.done ? within(t.doneAt, nowMs) : within(t.rolled?.at, nowMs))).sort((a, b) => when(b) - when(a));
}

/**
 * Takes a check mark back. A finished to-do is open again; a repeating one goes back to the due date
 * it had before it moved on (for up to a day). Anything else is left as it is.
 */
export function undoTask(tasks: Task[], id: string, nowMs: number): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task || (!task.done && !within(task.rolled?.at, nowMs))) return tasks;
  return tasks.map((t) => {
    if (t.id !== id) return t;
    if (t.done) { const { doneAt: _when, ...rest } = t; return { ...rest, done: false }; }
    const { rolled, lastDone: _last, ...rest } = t;
    return { ...rest, dueDate: rolled!.dueDate, ...(rolled!.lastDone ? { lastDone: rolled!.lastDone } : {}) };
  });
}

/** The boxes of the to-do pop-up. */
export type TaskFields = { title: string; dueDate: string; dueTime?: string; recurring: string; priority: boolean; notes?: string; /** The list it goes on; "" for none. Left out keeps the list it is on. */ listId?: string; /** What it is linked to (shared/hubLinks.ts). Left out keeps the links it has. */ links?: HubLink[] };

/**
 * Saves the to-do pop-up. A new to-do goes at the end. An edited one stays the same to-do: same place,
 * same check mark, same "last done". Nothing changes when the name is empty or the to-do is gone.
 */
export function saveTask(tasks: Task[], id: string | null, fields: TaskFields, makeId: () => string): Task[] {
  const title = fields.title.trim().slice(0, 200).trim();
  if (!title) return tasks;
  const notes = (fields.notes || "").trim().slice(0, 1000);
  const dueTime = fields.dueDate && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(fields.dueTime || "") ? fields.dueTime : undefined;
  const changes = { title, dueDate: fields.dueDate, ...(dueTime ? { dueTime } : {}), recurring: fields.recurring, ...(fields.priority ? { priority: "high" as const } : {}), ...(notes ? { notes } : {}), ...(fields.listId ? { listId: fields.listId.slice(0, 60) } : {}), ...(fields.links ? { links: cleanLinks(fields.links) } : {}) };
  if (!id) return [...tasks, { id: makeId(), ...changes, done: false }];
  if (!tasks.some((t) => t.id === id)) return tasks;
  // A repeating to-do's "where it was" only makes sense while its due date and rhythm are untouched.
  return tasks.map((t) => { if (t.id !== id) return t; const { priority: _drop, notes: _notes, dueTime: _time, rolled, listId, ...rest } = t; return { ...rest, ...(fields.listId === undefined && listId ? { listId } : {}), ...changes, ...(rolled && t.dueDate === changes.dueDate && t.recurring === changes.recurring ? { rolled } : {}) }; });
}

/** A to-do that was cleared away, with the place it had, so it can be put back. */
export type ClearedTask = { task: Task; index: number };

/** "Clear finished": every checked-off to-do taken off the list. */
export function clearDone(tasks: Task[]): { tasks: Task[]; cleared: ClearedTask[] } {
  const cleared = tasks.map((task, index) => ({ task, index })).filter((x) => x.task.done);
  return cleared.length ? { tasks: tasks.filter((t) => !t.done), cleared } : { tasks, cleared };
}

/** Puts cleared to-dos back where they were (or as near as the list now allows). Ones already back are left alone. */
export function restoreTasks(tasks: Task[], cleared: ClearedTask[]): Task[] {
  const have = new Set(tasks.map((t) => t.id));
  const next = [...tasks];
  for (const { task, index } of [...cleared].sort((a, b) => a.index - b.index)) if (!have.has(task.id)) next.splice(Math.min(index, next.length), 0, task);
  return next.length === tasks.length ? tasks : next;
}

// ─── Lists, views and archiving (the LifeHub-style to-do screen) ─────────────

export type TaskView = "all" | "today" | "upcoming" | "completed" | "archived";
export const TASK_VIEWS: TaskView[] = ["all", "today", "upcoming", "completed", "archived"];
export const TASK_LIST_COLORS = ["#7566e8", "#f59e72", "#36b6a5", "#619ee6", "#db77ac", "#e5b04f", "#64748b"];
export type TaskListRow = { id: string; name: string; color: string };

/** The teacher's lists made safe: each with an id, a name and a colour, no id twice. */
export function cleanTaskLists(raw: unknown): TaskListRow[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TaskListRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const id = typeof (r as any).id === "string" ? (r as any).id.slice(0, 60) : "";
    const name = String((r as any).name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const color = typeof (r as any).color === "string" && /^#[0-9a-f]{6}$/i.test((r as any).color) ? (r as any).color : TASK_LIST_COLORS[out.length % TASK_LIST_COLORS.length];
    out.push({ id, name, color });
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * The to-dos one view of one list shows, the way LifeHub shows them: All is everything still open,
 * Today is due today or overdue, Upcoming is due after today, Completed and Archived are what they say.
 * Archived to-dos are left out of every other view. Then the teacher's chosen sort.
 */
export function viewTasks(tasks: Task[], view: TaskView, listId: string, sort: TaskSort, today: string, search = ""): Task[] {
  const picked = tasks.filter((t) => {
    if (listId && listId !== "all" && (t.listId || "") !== listId) return false;
    if (view === "archived") return !!t.archived;
    if (t.archived) return false;
    if (view === "completed") return !!t.done;
    if (t.done) return false;
    if (view === "today") return !!t.dueDate && t.dueDate <= today;
    if (view === "upcoming") return !!t.dueDate && t.dueDate > today;
    return true;
  });
  const q = search.trim().toLowerCase();
  return arrangeTasks(q ? picked.filter((t) => `${t.title} ${t.notes || ""}`.toLowerCase().includes(q)) : picked, "all", sort, "", view === "archived");
}

export function viewCounts(tasks: Task[], listId: string, today: string): Record<TaskView, number> {
  const out = {} as Record<TaskView, number>;
  for (const v of TASK_VIEWS) out[v] = viewTasks(tasks, v, listId, "due", today).length;
  return out;
}

/** Archives (or brings back) a to-do. */
export const archiveTask = (tasks: Task[], id: string, archived: boolean): Task[] =>
  tasks.map((t) => {
    if (t.id !== id) return t;
    if (archived) return { ...t, archived: true };
    const { archived: _a, ...rest } = t;
    return rest;
  });

/** Removes a list; its to-dos stay, on no list. */
export function removeTaskList<W extends { tasks: Task[]; taskLists?: TaskListRow[] }>(w: W, id: string): W {
  return { ...w, taskLists: (w.taskLists || []).filter((l) => l.id !== id), tasks: w.tasks.map((t) => { if (t.listId !== id) return t; const { listId: _l, ...rest } = t; return rest; }) };
}
